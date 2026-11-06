// ========== mod35.js (FİLİZ) — Büyüyen Mermi ==========
(function () {
    'use strict';

    const CHAR_ID = 'filiz';
    const C_MAIN = '#27ae60';
    const C_LIGHT = '#58d68d';
    const C_DARK = '#145a32';
    const C_GROW = '#a9dfbf';
    const C_WHITE = '#ffffff';
    const C_HEAL = '#2ecc71';

    const CHAR_HP = 2600;
    const CHAR_SPEED = 3.4;
    const RANGE = 300;

    const BULLET_SPEED = 6;
    const BULLET_GROW_INTERVAL = 30;
    const BULLET_GROW_RATE = 0.25;
    const BULLET_MAX_MULT = 3;
    const BULLET_BASE_RADIUS = 6;
    const BULLET_BASE_DMG = 100;

    const AOE_RADIUS = 60;
    const AOE_PUSH = 40;

    const AKS1_CD = 960;
    const AKS1_HEAL = 400;

    const AKS2_CD = 720;
    const AKS2_JUMP = 50;

    const ULTI_BASE_MULT = 5;
    const ULTI_GROW_RATE = 0.5;
    const ULTI_MAX_MULT = 10;
    const ULTI_DMG = 1500;
    const ULTI_PUSH = 100;
    const ULTI_AOE = 200;

    window.GAME_EXT.characters[CHAR_ID] = { color: C_MAIN, hp: CHAR_HP, speed: CHAR_SPEED };

    let filizBullets = [];
    let filizFX = [];
    let screenFlash = 0;
    let aks1CD = 0, aks1Ready = true;
    let aks2CD = 0, aks2Ready = true;
    let recoilDir = null;

    if (!window._filizOrigDrawEntity) {
        window._filizOrigDrawEntity = window.drawEntity;
        window.drawEntity = function (e, isP) {
            if (!e) return;
            if (isP && player && player.charType === CHAR_ID) return;
            return window._filizOrigDrawEntity.call(this, e, isP);
        };
    }

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let pr; if (typeof prev === 'function') pr = prev.apply(this, args);
            const or = fn.apply(this, args);
            if (typeof pr === 'boolean' || typeof or === 'boolean') return !!pr || !!or;
            return or !== undefined ? or : pr;
        };
    }

    function burst(x, y, n, c, speed) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const sp = speed || 4;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = 1 + Math.random() * sp;
            filizFX.push({
                x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                size: 1.5 + Math.random() * 2,
                life: 20 + Math.random() * 20, maxLife: 40,
                color: c, gravity: 0.05
            });
        }
    }

    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + C_MAIN + ';"></div>' +
            '<span>Filiz</span>' +
            '<small>Büyüyen Mermi<br>Mesafe = Güç<br>Ulti: Dev Mermi</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function clearAll() {
        filizBullets = [];
        filizFX = [];
        screenFlash = 0;
        aks1CD = 0; aks1Ready = true;
        aks2CD = 0; aks2Ready = true;
        recoilDir = null;
    }

    const origSet = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        origSet.call(this, type);
        if (type === CHAR_ID) {
            clearAll();
            this.hp = this.maxHp = CHAR_HP;
            this.speed = this.originalSpeed = CHAR_SPEED;
            if (gadgetBtn) {
                gadgetBtn.style.display = 'flex';
                gadgetBtn.innerHTML = 'CAN<br><span id="gadget-timer"></span>';
                gadgetBtn.classList.remove('cooldown');
            }
            if (gadgetBtn2) {
                gadgetBtn2.style.display = 'flex';
                gadgetBtn2.innerHTML = 'GERİ<br>TEPME<br><span id="gadget-timer-2"></span>';
                gadgetBtn2.classList.remove('cooldown');
            }
            if (ultiBtn) {
                ultiBtn.style.display = 'flex';
                ultiBtn.style.background = 'radial-gradient(circle, #58d68d, #145a32)';
            }
            if (typeof gadgetTimerText !== 'undefined') gadgetTimerText = document.getElementById('gadget-timer');
            if (typeof gadgetTimerText2 !== 'undefined') gadgetTimerText2 = document.getElementById('gadget-timer-2');
        } else {
            clearAll();
            if (ultiBtn) ultiBtn.style.background = '';
        }
    };

    // ===== ANA SALDIRI =====
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== CHAR_ID) return origFire.call(this, a, pull);
        if (this.ammo < 1 || this.isDead) return;
        if (!Number.isFinite(a)) a = this.angle || 0;

        filizBullets.push({
            x: this.x, y: this.y, sx: this.x, sy: this.y,
            vx: Math.cos(a) * BULLET_SPEED,
            vy: Math.sin(a) * BULLET_SPEED,
            angle: a, life: 0, maxLife: 200,
            mult: 1, growTimer: 0, isDead: false,
            isUlti: false, hitTargets: new Set()
        });
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ===== AKSESUAR 1 — CAN =====
    const origGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget.call(this, a, pull);
        if (!aks1Ready || this.isDead) return;
        this.hp = Math.min(this.maxHp, this.hp + AKS1_HEAL);
        aks1Ready = false;
        aks1CD = AKS1_CD;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(AKS1_CD / 60) + "s";
        addFloatingNumber(this.x, this.y - 30, '+' + AKS1_HEAL, C_HEAL);
        burst(this.x, this.y, 10, C_HEAL);
    };

    // ===== AKSESUAR 2 — GERİ TEPME =====
    const origGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget2.call(this, a, pull);
        if (!aks2Ready || this.isDead) return;
        const ang = (a !== undefined && Number.isFinite(a)) ? a : this.angle;
        recoilDir = { angle: ang + Math.PI, speed: 15, frames: 10 };
        aks2Ready = false;
        aks2CD = AKS2_CD;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(AKS2_CD / 60) + "s";
        addFloatingNumber(this.x, this.y - 30, 'GERİ TEPME!', C_LIGHT);
        burst(this.x, this.y, 8, C_LIGHT);
    };

    // ===== ULTI — DEV MERMİ =====
    const origUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return origUlti.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;
        if (!Number.isFinite(a)) a = this.angle || 0;

        filizBullets.push({
            x: this.x, y: this.y, sx: this.x, sy: this.y,
            vx: Math.cos(a) * BULLET_SPEED * 0.8,
            vy: Math.sin(a) * BULLET_SPEED * 0.8,
            angle: a, life: 0, maxLife: 200,
            mult: ULTI_BASE_MULT, growTimer: 0, isDead: false,
            isUlti: true, hitTargets: new Set()
        });

        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = '0%';
        if (ultiBtn) ultiBtn.classList.remove('ready');
        addFloatingNumber(this.x, this.y - 40, 'DEV MERMİ!', C_MAIN);
        screenFlash = 8;
    };

    chainHook('onReset', function () { clearAll(); });

    // ===== UPDATE =====
    chainHook('onUpdate', function (ts) {
        if (player.charType !== CHAR_ID) return;
        if (!gameStarted) return;

        if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
        if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
        if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';

        // CD
        if (aks1CD > 0) {
            aks1CD -= ts;
            if (aks1CD <= 0) {
                aks1CD = 0; aks1Ready = true;
                if (gadgetBtn) gadgetBtn.classList.remove('cooldown');
                if (gadgetTimerText) gadgetTimerText.innerText = '';
            }
        }
        if (aks2CD > 0) {
            aks2CD -= ts;
            if (aks2CD <= 0) {
                aks2CD = 0; aks2Ready = true;
                if (gadgetBtn2) gadgetBtn2.classList.remove('cooldown');
                if (gadgetTimerText2) gadgetTimerText2.innerText = '';
            }
        }

        // Geri tepme hareket
        if (recoilDir && recoilDir.frames > 0) {
            player.x += Math.cos(recoilDir.angle) * recoilDir.speed * ts;
            player.y += Math.sin(recoilDir.angle) * recoilDir.speed * ts;
            player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
            player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
            recoilDir.frames -= ts;
            if (recoilDir.frames <= 0) recoilDir = null;
        }

        // FX
        for (let i = filizFX.length - 1; i >= 0; i--) {
            const p = filizFX[i];
            p.x += p.vx * ts; p.y += p.vy * ts;
            p.vy += p.gravity * ts;
            p.vx *= 0.95; p.vy *= 0.95;
            p.life -= ts;
            if (p.life <= 0) filizFX.splice(i, 1);
        }
        if (screenFlash > 0) screenFlash -= ts;
    });

    // ===== MERMİ ÇARPIŞMA =====
    const _origUBL = window.updateBulletLogic;
    window.updateBulletLogic = function (list, isBot, ts) {
        if (!isBot && player.charType === CHAR_ID) {
            for (let i = filizBullets.length - 1; i >= 0; i--) {
                const b = filizBullets[i];
                if (b.isDead) { filizBullets.splice(i, 1); continue; }

                b.x += b.vx * ts; b.y += b.vy * ts;
                b.life += ts;

                // Büyüme
                b.growTimer += ts;
                const growInterval = b.isUlti ? 20 : BULLET_GROW_INTERVAL;
                const growRate = b.isUlti ? ULTI_GROW_RATE : BULLET_GROW_RATE;
                const maxMult = b.isUlti ? ULTI_MAX_MULT : BULLET_MAX_MULT;
                while (b.growTimer >= growInterval && b.mult < maxMult) {
                    b.growTimer -= growInterval;
                    b.mult = Math.min(maxMult, b.mult + growRate);
                }

                // Menzil / duvar kontrolü
                const distFromOrigin = getDist(b, { x: b.sx, y: b.sy });
                if (distFromOrigin > RANGE) {
                    filizBullets.splice(i, 1); continue;
                }
                if (b.x < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS ||
                    b.y < WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) {
                    filizBullets.splice(i, 1); continue;
                }

                // Siper
                let hitWall = false;
                for (const o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(b, o) < o.radius + BULLET_BASE_RADIUS * b.mult) {
                        const dmg = Math.floor(BULLET_BASE_DMG * b.mult);
                        o.hp -= dmg;
                        addFloatingNumber(o.x, o.y, dmg, C_GROW);
                        hitWall = true; break;
                    }
                }
                if (hitWall) { filizBullets.splice(i, 1); continue; }

                // Düşman çarpışma
                let hitEnemy = null;
                for (const e of getActiveEnemies()) {
                    if (e.isDead) continue;
                    if (b.hitTargets.has(e)) continue;
                    if (getDist(b, e) < e.radius + BULLET_BASE_RADIUS * b.mult) {
                        hitEnemy = e; break;
                    }
                }

                if (hitEnemy) {
                    if (b.isUlti) {
                        // Ulti mermisi — patla
                        hitEnemy.hp -= ULTI_DMG;
                        addFloatingNumber(hitEnemy.x, hitEnemy.y, ULTI_DMG, C_MAIN);

                        // AOE
                        getActiveEnemies().forEach(e => {
                            if (e === hitEnemy || e.isDead) return;
                            if (getDist(b, e) < ULTI_AOE + e.radius) {
                                e.hp -= ULTI_DMG * 0.5;
                                addFloatingNumber(e.x, e.y, Math.floor(ULTI_DMG * 0.5), C_LIGHT);
                                const ang = Math.atan2(e.y - b.y, e.x - b.x);
                                e.kbX = Math.cos(ang) * ULTI_PUSH;
                                e.kbY = Math.sin(ang) * ULTI_PUSH;
                            }
                        });

                        // İtme
                        const ang = Math.atan2(hitEnemy.y - b.y, hitEnemy.x - b.x);
                        hitEnemy.kbX = Math.cos(ang) * ULTI_PUSH;
                        hitEnemy.kbY = Math.sin(ang) * ULTI_PUSH;

                        filizFX.push({ type: 'supernova', x: b.x, y: b.y, radius: 0, maxRadius: ULTI_AOE, life: 25, maxLife: 25 });
                        screenShake = 15;
                        screenFlash = 10;
                        burst(b.x, b.y, 30, C_MAIN, 10);
                        filizBullets.splice(i, 1);
                    } else {
                        const dmg = Math.floor(BULLET_BASE_DMG * b.mult);
                        hitEnemy.hp -= dmg;
                        addFloatingNumber(hitEnemy.x, hitEnemy.y, dmg, C_GROW);
                        b.hitTargets.add(hitEnemy);

                        // Max boyutta ise → patla
                        if (b.mult >= BULLET_MAX_MULT) {
                            getActiveEnemies().forEach(e => {
                                if (e === hitEnemy || e.isDead) return;
                                if (getDist(b, e) < AOE_RADIUS + e.radius) {
                                    e.hp -= Math.floor(dmg * 0.5);
                                    addFloatingNumber(e.x, e.y, Math.floor(dmg * 0.5), C_LIGHT);
                                    const ang = Math.atan2(e.y - b.y, e.x - b.x);
                                    e.kbX = Math.cos(ang) * AOE_PUSH;
                                    e.kbY = Math.sin(ang) * AOE_PUSH;
                                }
                            });
                            // İtme
                            const ang = Math.atan2(hitEnemy.y - b.y, hitEnemy.x - b.x);
                            hitEnemy.kbX = Math.cos(ang) * AOE_PUSH;
                            hitEnemy.kbY = Math.sin(ang) * AOE_PUSH;

                            filizFX.push({ type: 'growPop', x: b.x, y: b.y, radius: 0, maxRadius: AOE_RADIUS, life: 15, maxLife: 15 });
                            burst(b.x, b.y, 15, C_MAIN, 6);
                            filizBullets.splice(i, 1);
                        }
                    }
                }
            }
        }
        return _origUBL(list, isBot, ts);
    };

    // ===== ÇİZİM =====
    chainHook('onDraw', function (ctx2) {
        if (player.charType !== CHAR_ID || !gameStarted) return;

        // Karakter
        if (!player.isDead) {
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.fillStyle = 'rgba(0,0,0,0.35)';
            ctx2.beginPath(); ctx2.ellipse(0, player.radius * 0.4, player.radius * 0.9, player.radius * 0.35, 0, 0, Math.PI * 2); ctx2.fill();
            ctx2.rotate(player.angle);
            ctx2.fillStyle = C_MAIN;
            ctx2.beginPath(); ctx2.arc(0, 0, player.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = C_DARK; ctx2.lineWidth = 2.5; ctx2.stroke();
            ctx2.beginPath(); ctx2.arc(player.radius - 4, 0, 5, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(0,0,0,.4)'; ctx2.fill();
            ctx2.restore();

            // HP bar
            ctx2.save();
            ctx2.fillStyle = '#444';
            ctx2.fillRect(player.x - 20, player.y - player.radius - 15, 40, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(player.x - 20, player.y - player.radius - 15, Math.max(0, player.hp) / player.maxHp * 40, 5);
            ctx2.restore();
        }

        // Mermiler (büyüyen)
        filizBullets.forEach(b => {
            const r = BULLET_BASE_RADIUS * b.mult;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            // Dış halka (gelişim)
            ctx2.globalAlpha = 0.3;
            ctx2.beginPath(); ctx2.arc(0, 0, r + 3, 0, Math.PI * 2);
            ctx2.fillStyle = b.isUlti ? C_MAIN : C_GROW; ctx2.fill();
            ctx2.globalAlpha = 1;
            // Ana gövde
            const grad = ctx2.createRadialGradient(0, 0, 0, 0, 0, r);
            grad.addColorStop(0, C_LIGHT);
            grad.addColorStop(1, b.isUlti ? C_DARK : C_MAIN);
            ctx2.beginPath(); ctx2.arc(0, 0, r, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();
            ctx2.strokeStyle = C_WHITE; ctx2.lineWidth = 1.5; ctx2.stroke();
            // Boyut göstergesi (küçük iç nokta)
            if (b.mult > 1.5) {
                ctx2.beginPath(); ctx2.arc(0, 0, r * 0.4, 0, Math.PI * 2);
                ctx2.fillStyle = 'rgba(255,255,255,0.5)'; ctx2.fill();
            }
            ctx2.restore();
        });

        // FX
        filizFX.forEach(fx => {
            ctx2.save();
            const a = fx.life / fx.maxLife;
            if (fx.type === 'supernova') {
                ctx2.globalAlpha = a * 0.7;
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
                ctx2.strokeStyle = C_MAIN; ctx2.lineWidth = 5; ctx2.stroke();
                ctx2.globalAlpha = a * 0.3;
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, fx.radius * 0.7, 0, Math.PI * 2);
                ctx2.fillStyle = C_LIGHT; ctx2.fill();
            } else if (fx.type === 'growPop') {
                ctx2.globalAlpha = a * 0.5;
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
                ctx2.strokeStyle = C_LIGHT; ctx2.lineWidth = 3; ctx2.stroke();
            } else {
                ctx2.globalAlpha = Math.min(1, fx.life / 15);
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, fx.size, 0, Math.PI * 2);
                ctx2.fillStyle = fx.color; ctx2.fill();
            }
            ctx2.restore();
        });

        // Aim
        if (aimData.active && !player.isDead && player.ammo >= 1) {
            const ang = aimData.angle;
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.rotate(ang);
            ctx2.fillStyle = 'rgba(255,255,255,0.08)';
            ctx2.fillRect(0, -8, RANGE, 16);
            ctx2.strokeStyle = C_LIGHT;
            ctx2.globalAlpha = 0.5;
            ctx2.lineWidth = 1.5;
            ctx2.strokeRect(0, -8, RANGE, 16);
            // Büyüme işareti (uzakta büyük daire)
            ctx2.beginPath(); ctx2.arc(RANGE * 0.7, 0, 12, 0, Math.PI * 2);
            ctx2.strokeStyle = C_MAIN; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.beginPath(); ctx2.arc(RANGE, 0, 18, 0, Math.PI * 2);
            ctx2.strokeStyle = C_LIGHT; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.restore();
        }

        // Ekran flash
        if (screenFlash > 0) {
            ctx2.save();
            ctx2.globalAlpha = screenFlash / 10 * 0.4;
            ctx2.fillStyle = C_MAIN;
            ctx2.fillRect(0, 0, canvas.width, canvas.height);
            ctx2.restore();
        }
    });

    console.log('[MOD YÜKLENDİ] filiz (büyüyen mermi)');
})();