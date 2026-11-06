// ========== mod33.js (MOIRA) — 3 Farklı Mermi + Kader Aksesuarları ==========
(function () {
    'use strict';

    const CHAR_ID = 'moira';
    const C_MAIN = '#e67e22';
    const C_LIGHT = '#f39c12';
    const C_DARK = '#7e5109';
    const C_DIST = '#3498db';
    const C_TELE = '#9b59b6';
    const C_TETHER = '#e74c3c';
    const C_WHITE = '#ffffff';

    const CHAR_HP = 2800;
    const CHAR_SPEED = 3.5;

    const M1_DMG_NEAR = 150;
    const M1_DMG_MID = 250;
    const M1_DMG_FAR = 400;
    const M1_AOE_NEAR = 40;
    const M1_AOE_MID = 60;
    const M1_AOE_FAR = 80;
    const M1_RANGE = 320;

    const M2_DMG = 150;
    const M2_TELEPORT_MAX = 200;
    const M2_STUN = 30;
    const M2_RANGE = 250;

    const M3_DMG = 200;
    const M3_TETHER_RADIUS = 20;
    const M3_TETHER_TIME = 120;
    const M3_RANGE = 250;

    const BULLET_SPEED = PLAYER_BULLET_SPEED;
    const RELOAD_SPEED = 0.012;

    const AKS1_CD = 1200;
    const AKS1_DURATION = 300;
    const AKS2_CD = 720;
    const ULTI_DURATION = 240;

    window.GAME_EXT.characters[CHAR_ID] = { color: C_MAIN, hp: CHAR_HP, speed: CHAR_SPEED };

    let moiraBullets = [];
    let moiraFX = [];
    let screenFlash = 0;
    let moiraAks1CD = 0, moiraAks1Ready = true;
    let moiraAks2CD = 0, moiraAks2Ready = true;
    let moiraReloadBoost = 0;
    let moiraNextShot2x = false;
    let moiraUltiActive = 0;

    if (!window._moiraOrigDrawEntity) {
        window._moiraOrigDrawEntity = window.drawEntity;
        window.drawEntity = function (e, isP) {
            if (!e) return;
            if (isP && player && player.charType === CHAR_ID) return;
            return window._moiraOrigDrawEntity.call(this, e, isP);
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
            moiraFX.push({
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
            '<span>Moira</span>' +
            '<small>3 Mermi Tipi<br>Uzaklık / Işınlanma / Pranga<br>Kaderin Üç Yüzü</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function clearAll() {
        moiraBullets = [];
        moiraFX = [];
        screenFlash = 0;
        moiraAks1CD = 0; moiraAks1Ready = true;
        moiraAks2CD = 0; moiraAks2Ready = true;
        moiraReloadBoost = 0;
        moiraNextShot2x = false;
        moiraUltiActive = 0;
        if (player) {
            player._moiraIdx = 0;
            player.reloadSpeed = RELOAD_SPEED;
        }
    }

    const origSet = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        origSet.call(this, type);
        if (type === CHAR_ID) {
            clearAll();
            this.reloadSpeed = RELOAD_SPEED;
            this._moiraIdx = 0;
            if (gadgetBtn) {
                gadgetBtn.style.display = 'flex';
                gadgetBtn.innerHTML = 'İP<br><span id="gadget-timer"></span>';
                gadgetBtn.classList.remove('cooldown');
            }
            if (gadgetBtn2) {
                gadgetBtn2.style.display = 'flex';
                gadgetBtn2.innerHTML = 'MAKAS<br><span id="gadget-timer-2"></span>';
                gadgetBtn2.classList.remove('cooldown');
            }
            if (ultiBtn) {
                ultiBtn.style.display = 'flex';
                ultiBtn.style.background = 'radial-gradient(circle, #9b59b6, #6c3483)';
            }
            if (typeof gadgetTimerText !== 'undefined') gadgetTimerText = document.getElementById('gadget-timer');
            if (typeof gadgetTimerText2 !== 'undefined') gadgetTimerText2 = document.getElementById('gadget-timer-2');
        } else {
            clearAll();
            if (ultiBtn) ultiBtn.style.background = '';
            if (this.reloadSpeed === RELOAD_SPEED) this.reloadSpeed = 0.015;
        }
    };

    // ===== ANA SALDIRI =====
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== CHAR_ID) return origFire.call(this, a, pull);
        if (this.ammo < 1 || this.isDead) return;
        if (!Number.isFinite(a)) a = this.angle || 0;

        if (this.ammo >= this.maxAmmo - 0.01) {
            this._moiraIdx = 0;
        }

        const idx = (this._moiraIdx || 0) % 3;
        const types = ['dist', 'tele', 'tether'];
        const mult = moiraNextShot2x ? 2 : 1;

        if (moiraUltiActive > 0) {
            // Ulti: her tipten 1 mermi (toplam 3)
            types.forEach(type => {
                moiraBullets.push({
                    x: this.x, y: this.y, sx: this.x, sy: this.y,
                    vx: Math.cos(a) * BULLET_SPEED,
                    vy: Math.sin(a) * BULLET_SPEED,
                    angle: a, life: 0, maxLife: 60,
                    type: type, isDead: false, damageMult: mult
                });
            });
            burst(this.x, this.y, 8, C_TELE);
        } else {
            // Normal: 3 fan of current type
            const type = types[idx];
            const angles = [-0.06, 0, 0.06];
            angles.forEach(offset => {
                const ang = a + offset;
                moiraBullets.push({
                    x: this.x, y: this.y, sx: this.x, sy: this.y,
                    vx: Math.cos(ang) * BULLET_SPEED,
                    vy: Math.sin(ang) * BULLET_SPEED,
                    angle: ang, life: 0, maxLife: 60,
                    type: type, isDead: false, damageMult: mult
                });
            });
        }

        this._moiraIdx = (this._moiraIdx || 0) + 1;
        if (moiraNextShot2x) moiraNextShot2x = false;
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ===== AKSESUAR 1 — KLOTHO'NUN İPİ =====
    const origGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget.call(this, a, pull);
        if (!moiraAks1Ready || this.isDead) return;
        moiraReloadBoost = AKS1_DURATION;
        this.reloadSpeed = RELOAD_SPEED * 3;
        moiraAks1Ready = false;
        moiraAks1CD = AKS1_CD;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(AKS1_CD / 60) + "s";
        addFloatingNumber(this.x, this.y - 40, 'HIZLI ATIŞ!', C_DIST);
        burst(this.x, this.y, 10, C_DIST);
    };

    // ===== AKSESUAR 2 — ATROPOS'UN MAKASI =====
    const origGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget2.call(this, a, pull);
        if (!moiraAks2Ready || this.isDead) return;
        moiraNextShot2x = true;
        moiraAks2Ready = false;
        moiraAks2CD = AKS2_CD;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(AKS2_CD / 60) + "s";
        addFloatingNumber(this.x, this.y - 40, 'MAKAS!', C_TETHER);
        burst(this.x, this.y, 10, C_TETHER);
    };

    // ===== ULTİ — KADER BAĞI =====
    const origUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return origUlti.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;
        moiraUltiActive = ULTI_DURATION;
        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = '0%';
        if (ultiBtn) ultiBtn.classList.remove('ready');
        addFloatingNumber(this.x, this.y - 40, 'KADER BAĞI!', C_TELE);
        screenFlash = 10;
    };

    chainHook('onReset', function () { clearAll(); });

    // ===== UPDATE =====
    chainHook('onUpdate', function (ts) {
        if (player.charType !== CHAR_ID) return;
        if (!gameStarted) return;

        if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
        if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
        if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';

        // Aks 1 timer
        if (moiraReloadBoost > 0) {
            moiraReloadBoost -= ts;
            if (moiraReloadBoost <= 0) {
                moiraReloadBoost = 0;
                player.reloadSpeed = RELOAD_SPEED;
            }
        }
        if (moiraAks1CD > 0) {
            moiraAks1CD -= ts;
            if (moiraAks1CD <= 0) {
                moiraAks1CD = 0; moiraAks1Ready = true;
                if (gadgetBtn) gadgetBtn.classList.remove('cooldown');
                if (gadgetTimerText) gadgetTimerText.innerText = '';
            }
        }
        if (moiraAks2CD > 0) {
            moiraAks2CD -= ts;
            if (moiraAks2CD <= 0) {
                moiraAks2CD = 0; moiraAks2Ready = true;
                if (gadgetBtn2) gadgetBtn2.classList.remove('cooldown');
                if (gadgetTimerText2) gadgetTimerText2.innerText = '';
            }
        }
        if (moiraUltiActive > 0) {
            moiraUltiActive -= ts;
            if (moiraUltiActive <= 0) moiraUltiActive = 0;
        }

        // Tether kontrolü
        getActiveEnemies().forEach(e => {
            if (e.isDead || !e._moiraTether) return;
            const t = e._moiraTether;
            if (t.timer <= 0) { delete e._moiraTether; return; }
            const d = getDist(e, t);
            if (d > M3_TETHER_RADIUS) {
                const ang = Math.atan2(e.y - t.y, e.x - t.x);
                e.x = t.x + Math.cos(ang) * M3_TETHER_RADIUS;
                e.y = t.y + Math.sin(ang) * M3_TETHER_RADIUS;
            }
            t.timer -= ts;
        });

        for (let i = moiraFX.length - 1; i >= 0; i--) {
            const p = moiraFX[i];
            p.x += p.vx * ts; p.y += p.vy * ts;
            p.vy += p.gravity * ts;
            p.vx *= 0.95; p.vy *= 0.95;
            p.life -= ts;
            if (p.life <= 0) moiraFX.splice(i, 1);
        }
        if (screenFlash > 0) screenFlash -= ts;

        // Ulti aktifken buton rengini değiştir
        if (ultiBtn) {
            if (moiraUltiActive > 0) ultiBtn.style.boxShadow = '0 0 25px #9b59b6';
            else ultiBtn.style.boxShadow = '';
        }
    });

    // ===== MERMİ ÇARPIŞMA =====
    const _origUBL = window.updateBulletLogic;
    window.updateBulletLogic = function (list, isBot, ts) {
        if (!isBot && player.charType === CHAR_ID) {
            for (let i = moiraBullets.length - 1; i >= 0; i--) {
                const b = moiraBullets[i];
                if (b.isDead) { moiraBullets.splice(i, 1); continue; }

                b.x += b.vx * ts; b.y += b.vy * ts;
                b.life += ts;

                const distFromOrigin = getDist(b, { x: b.sx, y: b.sy });
                const maxRange = b.type === 'dist' ? M1_RANGE : (b.type === 'tele' ? M2_RANGE : M3_RANGE);

                if (b.life > b.maxLife || distFromOrigin > maxRange) {
                    moiraBullets.splice(i, 1); continue;
                }
                if (b.x < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS ||
                    b.y < WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) {
                    moiraBullets.splice(i, 1); continue;
                }

                let hitWall = false;
                for (const o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(b, o) < o.radius + 5) { hitWall = true; break; }
                }
                if (hitWall) {
                    if (b.type === 'dist') {
                        const aoe = distFromOrigin < 100 ? M1_AOE_NEAR : (distFromOrigin < 200 ? M1_AOE_MID : M1_AOE_FAR);
                        burst(b.x, b.y, 8, C_DIST);
                        moiraFX.push({ type: 'aoeBurst', x: b.x, y: b.y, radius: 0, maxRadius: aoe, life: 12, maxLife: 12, color: C_DIST });
                    }
                    moiraBullets.splice(i, 1); continue;
                }

                let hitEnemy = null;
                for (const e of getActiveEnemies()) {
                    if (e.isDead) continue;
                    if (getDist(b, e) < e.radius + 6) { hitEnemy = e; break; }
                }

                if (hitEnemy) {
                    const mult = b.damageMult || 1;

                    if (b.type === 'dist') {
                        let dmg, aoe;
                        if (distFromOrigin < 100) { dmg = M1_DMG_NEAR; aoe = M1_AOE_NEAR; }
                        else if (distFromOrigin < 200) { dmg = M1_DMG_MID; aoe = M1_AOE_MID; }
                        else { dmg = M1_DMG_FAR; aoe = M1_AOE_FAR; }
                        dmg = Math.floor(dmg * mult);

                        hitEnemy.hp -= dmg;
                        addFloatingNumber(hitEnemy.x, hitEnemy.y, dmg, C_DIST);
                        burst(hitEnemy.x, hitEnemy.y, 8, C_DIST);

                        getActiveEnemies().forEach(e => {
                            if (e === hitEnemy || e.isDead) return;
                            if (getDist(b, e) < aoe + e.radius) {
                                const aoeDmg = Math.floor(dmg * 0.5);
                                e.hp -= aoeDmg;
                                addFloatingNumber(e.x, e.y, aoeDmg, C_DIST);
                            }
                        });
                        moiraFX.push({ type: 'aoeBurst', x: b.x, y: b.y, radius: 0, maxRadius: aoe, life: 12, maxLife: 12, color: C_DIST });
                    }
                    else if (b.type === 'tele') {
                        const dmg = Math.floor(M2_DMG * mult);
                        hitEnemy.hp -= dmg;
                        addFloatingNumber(hitEnemy.x, hitEnemy.y, dmg, C_TELE);

                        const tpDist = getDist(player, hitEnemy);
                        if (tpDist > 10) {
                            const tpAng = Math.atan2(hitEnemy.y - player.y, hitEnemy.x - player.x);
                            const tpMax = Math.min(tpDist, M2_TELEPORT_MAX);
                            player.x = clampPos(player.x + Math.cos(tpAng) * tpMax, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
                            player.y = clampPos(player.y + Math.sin(tpAng) * tpMax, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
                        }
                        hitEnemy._stunTimer = Math.max(hitEnemy._stunTimer || 0, M2_STUN);

                        burst(player.x, player.y, 15, C_TELE);
                        burst(hitEnemy.x, hitEnemy.y, 8, C_TELE);
                        moiraFX.push({ type: 'teleport', x: player.x, y: player.y, radius: 0, maxRadius: 40, life: 15, maxLife: 15, color: C_TELE });
                        screenFlash = 5;
                    }
                    else if (b.type === 'tether') {
                        const dmg = Math.floor(M3_DMG * mult);
                        hitEnemy.hp -= dmg;
                        addFloatingNumber(hitEnemy.x, hitEnemy.y, dmg, C_TETHER);
                        hitEnemy._moiraTether = { x: b.x, y: b.y, timer: M3_TETHER_TIME };
                        burst(hitEnemy.x, hitEnemy.y, 10, C_TETHER);
                    }
                    moiraBullets.splice(i, 1);
                    continue;
                }
            }
        }
        return _origUBL(list, isBot, ts);
    };

    // ===== ÇİZİM =====
    chainHook('onDraw', function (ctx2) {
        if (player.charType !== CHAR_ID || !gameStarted) return;

        if (!player.isDead) {
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.fillStyle = 'rgba(0,0,0,0.35)';
            ctx2.beginPath(); ctx2.ellipse(0, player.radius * 0.4, player.radius * 0.9, player.radius * 0.35, 0, 0, Math.PI * 2); ctx2.fill();

            // Ulti aktifken aura
            if (moiraUltiActive > 0) {
                ctx2.save();
                ctx2.globalAlpha = 0.3 + Math.sin(Date.now() / 150) * 0.15;
                ctx2.beginPath(); ctx2.arc(0, 0, player.radius + 12, 0, Math.PI * 2);
                ctx2.fillStyle = C_TELE; ctx2.fill();
                ctx2.restore();
            }

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

            // Mermi tipi göstergesi
            const idx = (player._moiraIdx || 0) % 3;
            const colors = [C_DIST, C_TELE, C_TETHER];
            const labels = ['1', '2', '3'];
            ctx2.save();
            if (moiraUltiActive > 0) {
                // Ulti sırasında 3 renk de göster
                for (let r = 0; r < 3; r++) {
                    ctx2.fillStyle = colors[r];
                    ctx2.beginPath();
                    ctx2.arc(player.x - 12 + r * 12, player.y - player.radius - 28, 5, 0, Math.PI * 2);
                    ctx2.fill();
                    ctx2.strokeStyle = '#fff';
                    ctx2.lineWidth = 1.5;
                    ctx2.stroke();
                }
            } else {
                ctx2.fillStyle = colors[idx];
                ctx2.beginPath();
                ctx2.arc(player.x, player.y - player.radius - 28, 6, 0, Math.PI * 2);
                ctx2.fill();
                ctx2.strokeStyle = '#fff';
                ctx2.lineWidth = 1.5;
                ctx2.stroke();
                ctx2.fillStyle = '#fff';
                ctx2.font = 'bold 9px Arial';
                ctx2.textAlign = 'center';
                ctx2.fillText(labels[idx], player.x, player.y - player.radius - 24);
            }
            ctx2.restore();
        }

        // Tether görseli
        getActiveEnemies().forEach(e => {
            if (e.isDead || !e._moiraTether) return;
            const t = e._moiraTether;
            ctx2.save();
            ctx2.beginPath();
            ctx2.moveTo(t.x, t.y);
            ctx2.lineTo(e.x, e.y);
            ctx2.strokeStyle = C_TETHER;
            ctx2.lineWidth = 2;
            ctx2.setLineDash([4, 3]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.beginPath();
            ctx2.arc(t.x, t.y, 6, 0, Math.PI * 2);
            ctx2.fillStyle = C_TETHER;
            ctx2.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
            ctx2.fill();
            ctx2.restore();
        });

        // Mermiler
        moiraBullets.forEach(b => {
            ctx2.save();
            ctx2.translate(b.x, b.y); ctx2.rotate(b.angle);
            if (b.type === 'dist') {
                const dist = getDist(b, { x: b.sx, y: b.sy });
                const scale = 1 + (dist / 300) * 0.8;
                ctx2.scale(scale, scale);
                ctx2.beginPath(); ctx2.arc(0, 0, 7, 0, Math.PI * 2);
                ctx2.fillStyle = C_DIST; ctx2.fill();
                ctx2.strokeStyle = C_WHITE; ctx2.lineWidth = 1.5; ctx2.stroke();
            } else if (b.type === 'tele') {
                ctx2.beginPath(); ctx2.arc(0, 0, 6, 0, Math.PI * 2);
                ctx2.fillStyle = C_TELE; ctx2.fill();
                ctx2.strokeStyle = C_WHITE; ctx2.lineWidth = 1.5; ctx2.stroke();
                ctx2.rotate(Date.now() / 100);
                ctx2.beginPath(); ctx2.moveTo(0, -9); ctx2.lineTo(0, 9);
                ctx2.strokeStyle = C_TELE; ctx2.lineWidth = 1.5; ctx2.stroke();
            } else {
                ctx2.beginPath(); ctx2.arc(0, 0, 6, 0, Math.PI * 2);
                ctx2.fillStyle = C_TETHER; ctx2.fill();
                ctx2.strokeStyle = C_WHITE; ctx2.lineWidth = 1.5; ctx2.stroke();
            }
            if (b.damageMult && b.damageMult > 1) {
                ctx2.globalAlpha = 0.5;
                ctx2.beginPath(); ctx2.arc(0, 0, 10, 0, Math.PI * 2);
                ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 2; ctx2.stroke();
            }
            ctx2.restore();
        });

        // FX
        moiraFX.forEach(fx => {
            ctx2.save();
            const a = fx.life / fx.maxLife;
            if (fx.type === 'aoeBurst') {
                ctx2.globalAlpha = a * 0.6;
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, fx.radius || 0, 0, Math.PI * 2);
                ctx2.strokeStyle = fx.color; ctx2.lineWidth = 3; ctx2.stroke();
                ctx2.globalAlpha = a * 0.2;
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, fx.radius || 0, 0, Math.PI * 2);
                ctx2.fillStyle = fx.color; ctx2.fill();
            } else if (fx.type === 'teleport') {
                ctx2.globalAlpha = a * 0.7;
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, fx.radius || 0, 0, Math.PI * 2);
                ctx2.strokeStyle = fx.color; ctx2.lineWidth = 3; ctx2.stroke();
            } else {
                ctx2.globalAlpha = Math.min(1, fx.life / 15);
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, fx.size || 2, 0, Math.PI * 2);
                ctx2.fillStyle = fx.color; ctx2.fill();
            }
            ctx2.restore();
        });

        // Aim
        if (aimData.active && !player.isDead && player.ammo >= 1) {
            const ang = aimData.angle;
            const idx = (player._moiraIdx || 0) % 3;
            const aimRange = moiraUltiActive > 0 ? M1_RANGE : (idx === 0 ? M1_RANGE : (idx === 1 ? M2_RANGE : M3_RANGE));
            const aimColor = moiraUltiActive > 0 ? C_TELE : (idx === 0 ? C_DIST : (idx === 1 ? C_TELE : C_TETHER));
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.rotate(ang);
            ctx2.fillStyle = 'rgba(255,255,255,0.08)';
            ctx2.fillRect(0, -8, aimRange, 16);
            ctx2.strokeStyle = aimColor;
            ctx2.globalAlpha = 0.6;
            ctx2.lineWidth = 1.5;
            ctx2.strokeRect(0, -8, aimRange, 16);
            ctx2.globalAlpha = 1;
            ctx2.beginPath(); ctx2.arc(aimRange, 0, 5, 0, Math.PI * 2);
            ctx2.fillStyle = aimColor; ctx2.fill();
            ctx2.strokeStyle = C_WHITE; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        }

        // Ekran flash
        if (screenFlash > 0) {
            ctx2.save();
            ctx2.globalAlpha = screenFlash / 10 * 0.4;
            ctx2.fillStyle = C_TELE;
            ctx2.fillRect(0, 0, canvas.width, canvas.height);
            ctx2.restore();
        }
    });

    console.log('[MOD YÜKLENDİ] moira (v2 - aksesuar + ulti)');
})();