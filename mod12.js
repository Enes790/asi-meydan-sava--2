// ========== mod31.js (DONDURUCU) - v5 (GÖRSEL REVİZYON) ==========
// Değişiklikler:
// 1. Ana saldırı: Emz tarzı konik sprey bulutu (ok başı + gradient kaldırıldı)
// 2. Ulti patlama: çizgi sayısı yarıya indirildi, halka kaldırıldı
// Mekanik (hasar, hız, menzil, MAX_BOTS_HIT) DEĞİŞMEDİ

(function () {
    'use strict';

    const CHAR_ID = 'dondurucu';
    const C_MAIN = '#4a5c6a';
    const C_LIGHT = '#85c1e9';
    const C_DARK = '#1a252f';
    const C_WHITE = '#ffffff';
    const C_FROZEN = '#00bcd4';
    const C_HEAL = '#2ecc71';
    const CHAR_HP = 3200;
    const CHAR_SPEED = 3.6;

    const WAVE_RANGE = 200;
    const WAVE_SPEED = PLAYER_BULLET_SPEED * 1.0;
    const WAVE_ANGLES = [-0.18, 0.18, 0];
    const CENTER_DMG = 800;
    const SIDE_DMG = 100;
    const MAX_BOTS_HIT = 4;
    const WALL_DMG = 60;
    const RELOAD_SPEED = 0.014;
    const HEAL_PER_HIT = 70;

    const AKS1_HEAL = 300;
    const AKS1_EXTRA_TIME = 60;
    const AKS1_CD = 900;

    const AKS2_JUMP_TIME = 24;
    const AKS2_JUMP_HEIGHT = 60;
    const AKS2_CD = 900;

    const ULTI_RADIUS = 100;
    const ULTI_JUMP_TIME = 40;
    const ULTI_DELAY = 30;
    const ULTI_FREEZE_TIME = 120;
    const ULTI_BURST_DMG = 400;
    const ULTI_BURST_RADIUS = 80;
    const ULTI_MAX_BOTS = 5;
    const ULTI_PLACE_MIN = 60;
    const ULTI_PLACE_MAX = 260;

    window.GAME_EXT.characters[CHAR_ID] = { color: C_MAIN, hp: CHAR_HP, speed: CHAR_SPEED };

    let waves = [];
    let frozenBots = new Map();
    let jumpedBots = new Map();
    let aks1Buff = false;
    let aks2Active = false;
    let aks1CD = 0, aks1Ready = true;
    let aks2CD = 0, aks2Ready = true;
    let ultiState = null;
    let ultiDrag = { active: false, startX: 0, startY: 0, angle: 0, pull: 0, touchId: null, isMouse: false };
    let dondurucuFX = [];
    let dondurucuTexts = [];
    let screenFlash = 0;

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let pr; if (typeof prev === 'function') pr = prev.apply(this, args);
            const or = fn.apply(this, args);
            if (typeof pr === 'boolean' || typeof or === 'boolean') return !!pr || !!or;
            return or !== undefined ? or : pr;
        };
    }

    function safe(v, fb) { return Number.isFinite(v) ? v : (fb !== undefined ? fb : 0); }

    function addText(x, y, v, l, col) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        dondurucuTexts.push({ x, y, val: v, life: 55, maxLife: 55, isLabel: !!l, color: col || C_LIGHT });
    }

    function burst(x, y, n, c, speed) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const sp = speed || 4;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = 1 + Math.random() * sp;
            dondurucuFX.push({
                x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                size: 1.5 + Math.random() * 2,
                life: 20 + Math.random() * 20, maxLife: 40,
                color: c, gravity: 0.05
            });
        }
    }

    // ===== KART =====
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + C_MAIN + ';"></div>' +
            '<span>Dondurucu</span>' +
            '<small>Hasar: 800 (orta) + 100×2<br>Güç: Buz + Zıplatma<br>Ulti: Dondurma</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function clearAll() {
        waves = [];
        dondurucuFX = [];
        dondurucuTexts = [];
        aks1Buff = false;
        aks2Active = false;
        aks1CD = 0; aks1Ready = true;
        aks2CD = 0; aks2Ready = true;
        ultiState = null;
        screenFlash = 0;
        frozenBots.forEach((v, b) => {
            if (b && !b.isDead) {
                b.speed = v.origSpeed;
                b.shootInterval = v.origShoot;
                delete b._frozen;
            }
        });
        frozenBots.clear();
        jumpedBots.forEach((v, b) => {
            if (b && !b.isDead) {
                b.y = v.origY;
                delete b._dondurucuJumpActive;
            }
        });
        jumpedBots.clear();
        if (player) {
            player.jumpInvulnerable = false;
            player.isJumping = false;
            player._dondurucuHideAim = false;
        }
    }

    const origSet = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        origSet.call(this, type);
        if (type === CHAR_ID) {
            clearAll();
            this.reloadSpeed = RELOAD_SPEED;
            if (gadgetBtn) {
                gadgetBtn.style.display = 'flex';
                gadgetBtn.innerHTML = 'BUZ<br>BUFF<br><span id="gadget-timer"></span>';
                gadgetBtn.classList.remove('cooldown');
            }
            if (gadgetBtn2) {
                gadgetBtn2.style.display = 'flex';
                gadgetBtn2.innerHTML = 'ZIPLATMA<br><span id="gadget-timer-2"></span>';
                gadgetBtn2.classList.remove('cooldown');
            }
            if (ultiBtn) {
                ultiBtn.style.display = 'flex';
                ultiBtn.style.background = 'radial-gradient(circle, ' + C_LIGHT + ', ' + C_MAIN + ')';
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
        if (this.ammo < 1 || this.isDead || (ultiState && ultiState.phase === 'jumping')) return;
        if (!Number.isFinite(a)) a = this.angle || 0;

        const isAks2 = aks2Active;
        const sharedHitBots = new Set();

        WAVE_ANGLES.forEach((offset, idx) => {
            const ang = a + offset;
            waves.push({
                x: this.x, y: this.y,
                sx: this.x, sy: this.y,
                vx: Math.cos(ang) * WAVE_SPEED,
                vy: Math.sin(ang) * WAVE_SPEED,
                angle: ang,
                isCenter: idx === 2,
                isDead: false,
                hitBots: sharedHitBots,
                travelDist: 0,
                trail: [],
                isAks2: isAks2
            });
        });

        if (aks2Active) aks2Active = false;
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ===== AKS 1 =====
    const origGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget.call(this, a, pull);
        if (!aks1Ready || this.isDead || (ultiState && ultiState.phase === 'jumping')) return;
        aks1Buff = true;
        aks1Ready = false;
        aks1CD = AKS1_CD;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(AKS1_CD / 60) + "s";
        addText(this.x, this.y - 30, "BUZ BUFF!", true, C_FROZEN);
        burst(this.x, this.y, 8, C_FROZEN);
    };

    // ===== AKS 2 =====
    const origGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget2.call(this, a, pull);
        if (!aks2Ready || this.isDead || (ultiState && ultiState.phase === 'jumping')) return;
        aks2Active = true;
        aks2Ready = false;
        aks2CD = AKS2_CD;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(AKS2_CD / 60) + "s";
        addText(this.x, this.y - 30, "ZIPLATMA HAZIR!", true, C_LIGHT);
        burst(this.x, this.y, 8, C_LIGHT);
    };

    // ===== ULTİ =====
    const origUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return origUlti.call(this, a, pull);
        if (!Number.isFinite(a)) a = this.angle || 0;
        if (!Number.isFinite(pull)) pull = 1;
        if (!this.ultReady || this.isDead || (ultiState && ultiState.phase === 'jumping')) return;
        if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) return;

        const pullMag = pull > 0.05 ? pull : 1;
        const dist = ULTI_PLACE_MIN + (ULTI_PLACE_MAX - ULTI_PLACE_MIN) * pullMag;
        const tx = clampPos(this.x + Math.cos(a) * dist, WALL_THICKNESS + 40, canvas.width - WALL_THICKNESS - 40);
        const ty = clampPos(this.y + Math.sin(a) * dist, WALL_THICKNESS + 40, canvas.height - WALL_THICKNESS - 40);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

        ultiState = {
            phase: 'jumping', timer: ULTI_JUMP_TIME,
            startX: this.x, startY: this.y,
            targetX: tx, targetY: ty, affectedBots: []
        };
        this.isJumping = true;
        this.jumpInvulnerable = true;
        this.jumpProgress = 0;
        this.jumpDuration = ULTI_JUMP_TIME;
        this.jumpStartX = this.x;
        this.jumpStartY = this.y;
        this.jumpTargetX = tx;
        this.jumpTargetY = ty;
        this.jumpDamage = 0.01;
        this.jumpKnockback = 0.01;
        this.jumpLabel = " ";

        addText(this.x, this.y - 40, "DONDUR!", true, C_FROZEN);
        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    chainHook('onChargeUlti', function (amount) {
        if (player.charType !== CHAR_ID) return;
        if (!gameStarted || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount);
        if (player.ultCharge >= 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
        }
        if (ultFill) ultFill.style.width = player.ultCharge + "%";
    });

    chainHook('onReset', function () { clearAll(); });

    chainHook('onPreDraw', function (ctx2) {
        if (player.charType === CHAR_ID && aimData.active && !player.isDead && !(ultiState && ultiState.phase === 'jumping')) {
            player._dondurucuHideAim = true;
            aimData.active = false;
        }
    });

    chainHook('onPostDraw', function (ctx2) {
        if (player._dondurucuHideAim) {
            aimData.active = true;
            player._dondurucuHideAim = false;
        }
    });

    // ===== ULTİ DRAG =====
    function uS(cx, cy) {
        if (player.charType !== CHAR_ID) return;
        if (!player.ultReady || player.isDead || (ultiState && ultiState.phase === 'jumping')) return;
        const r = ultiBtn.getBoundingClientRect();
        ultiDrag.active = true;
        ultiDrag.startX = r.left + r.width / 2;
        ultiDrag.startY = r.top + r.height / 2;
        ultiDrag.angle = player.angle;
        ultiDrag.pull = 0;
    }
    function uM(cx, cy) {
        if (!ultiDrag.active) return;
        ultiDrag.angle = Math.atan2(cy - ultiDrag.startY, cx - ultiDrag.startX);
        ultiDrag.pull = Math.min(1, Math.hypot(cx - ultiDrag.startX, cy - ultiDrag.startY) / 160);
    }
    function uE() {
        if (!ultiDrag.active) return;
        ultiDrag.active = false;
        player.fireUlti(ultiDrag.angle, ultiDrag.pull);
    }

    ultiBtn.addEventListener('touchstart', e => {
        if (player.charType !== CHAR_ID) return;
        e.preventDefault(); e.stopImmediatePropagation();
        const t = e.changedTouches[0];
        ultiDrag.touchId = t.identifier;
        uS(t.clientX, t.clientY);
    }, { capture: true, passive: false });

    window.addEventListener('touchmove', e => {
        if (!ultiDrag.active || player.charType !== CHAR_ID) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === ultiDrag.touchId)
                uM(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        }
    }, { passive: false });

    window.addEventListener('touchend', e => {
        if (!ultiDrag.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === ultiDrag.touchId) uE();
        }
    });

    ultiBtn.addEventListener('mousedown', e => {
        if (player.charType !== CHAR_ID) return;
        e.preventDefault(); e.stopImmediatePropagation();
        ultiDrag.isMouse = true;
        uS(e.clientX, e.clientY);
    }, { capture: true });

    window.addEventListener('mousemove', e => {
        if (ultiDrag.active && ultiDrag.isMouse) uM(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
        if (ultiDrag.active && ultiDrag.isMouse) {
            ultiDrag.isMouse = false;
            uE();
        }
    });

    // ===== LOOP =====
    let lastT = 0;
    function loop(t) {
        if (!lastT) lastT = t;
        const ts = Math.min(3, (t - lastT) / 16.666);
        lastT = t;
        if (gameStarted) { try { update(ts); } catch (e) { console.error('[DONDURUCU]', e); } }
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    function update(ts) {
        if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) {
            player.x = canvas.width / 2;
            player.y = canvas.height / 2;
            player.jumpInvulnerable = false;
            player.isJumping = false;
            if (ultiState) ultiState = null;
        }

        if (player.charType === CHAR_ID) {
            if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
            if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
            if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';
        }

        if (aks1CD > 0) { aks1CD -= ts; if (aks1CD <= 0) { aks1CD = 0; aks1Ready = true; if (gadgetBtn) gadgetBtn.classList.remove('cooldown'); if (gadgetTimerText) gadgetTimerText.innerText = ""; } }
        if (aks2CD > 0) { aks2CD -= ts; if (aks2CD <= 0) { aks2CD = 0; aks2Ready = true; if (gadgetBtn2) gadgetBtn2.classList.remove('cooldown'); if (gadgetTimerText2) gadgetTimerText2.innerText = ""; } }

        // ===== ULTİ =====
        if (ultiState) {
            if (ultiState.phase === 'jumping') {
                ultiState.timer -= ts;
                if (!player.isJumping || ultiState.timer <= 0) {
                    player.isJumping = false;
                    player.x = ultiState.targetX;
                    player.y = ultiState.targetY;
                    ultiState.phase = 'landing';
                    ultiState.timer = ULTI_DELAY;
                    screenShake = 10;
                    screenFlash = 6;
                    burst(player.x, player.y, 25, C_FROZEN, 8);

                    const inRange = [];
                    getActiveEnemies().forEach(e => {
                        if (getDist(player, e) < ULTI_RADIUS + e.radius) inRange.push(e);
                    });
                    ultiState.affectedBots = inRange.slice(0, ULTI_MAX_BOTS);
                    const freezeDuration = ULTI_FREEZE_TIME + (aks1Buff ? AKS1_EXTRA_TIME : 0);
                    ultiState.affectedBots.forEach(e => {
                        if (e.isDead) return;
                        if (!e._frozen) {
                            frozenBots.set(e, {
                                timer: freezeDuration,
                                origSpeed: e.speed,
                                origShoot: e.shootInterval
                            });
                            e.speed = 0;
                            e.shootInterval = 999999;
                            e._frozen = true;
                        } else {
                            const f = frozenBots.get(e);
                            if (f) f.timer = Math.max(f.timer, freezeDuration);
                        }
                        if (aks1Buff) {
                            player.hp = Math.min(player.maxHp, player.hp + AKS1_HEAL);
                            addFloatingNumber(player.x, player.y - 20, "+" + AKS1_HEAL, C_HEAL);
                        }
                        burst(e.x, e.y, 6, C_FROZEN);
                    });
                    if (aks1Buff) aks1Buff = false;
                    addText(player.x, player.y - 50, "DONDUR!", true, C_FROZEN);
                }
            } else if (ultiState.phase === 'landing') {
                ultiState.timer -= ts;
                if (ultiState.timer <= 0) {
                    player.jumpInvulnerable = false;
                    ultiState = null;
                }
            }
        }

        // ===== DONDURULAN BOTLAR =====
        frozenBots.forEach((v, b) => {
            v.timer -= ts;
            if (!b) {
                frozenBots.delete(b);
                return;
            }
            if (b.isDead) {
                if (v.origSpeed !== undefined) b.speed = v.origSpeed;
                if (v.origShoot !== undefined) b.shootInterval = v.origShoot;
                delete b._frozen;
                frozenBots.delete(b);
                return;
            }
            b.speed = 0;
            b.shootInterval = 999999;
            b.lastShot = Date.now();
            if (v.timer <= 0) {
                b.speed = v.origSpeed;
                b.shootInterval = v.origShoot;
                delete b._frozen;
                frozenBots.delete(b);

                b.hp -= ULTI_BURST_DMG;
                addFloatingNumber(b.x, b.y, ULTI_BURST_DMG, C_FROZEN);
                burst(b.x, b.y, 6, C_FROZEN, 4);
                getActiveEnemies().forEach(e => {
                    if (e !== b && !e.isDead && getDist(b, e) < ULTI_BURST_RADIUS + e.radius) {
                        e.hp -= ULTI_BURST_DMG;
                        addFloatingNumber(e.x, e.y, ULTI_BURST_DMG, C_LIGHT);
                    }
                });
                screenShake = Math.max(screenShake, 6);
            }
        });

        // ===== AKS 2 ZIPLATMA =====
        jumpedBots.forEach((v, b) => {
            v.timer -= ts;
            if (!b) {
                jumpedBots.delete(b);
                return;
            }
            if (b.isDead) {
                if (v.origY !== undefined) b.y = v.origY;
                delete b._dondurucuJumpActive;
                jumpedBots.delete(b);
                return;
            }
            const prog = 1 - (v.timer / AKS2_JUMP_TIME);
            if (prog >= 0 && prog <= 1) {
                const jumpH = Math.sin(prog * Math.PI);
                b.y = v.origY - jumpH * AKS2_JUMP_HEIGHT;
            }
            if (v.timer <= 0) {
                b.y = v.origY;
                delete b._dondurucuJumpActive;
                jumpedBots.delete(b);
            }
        });

        // ===== SES DALGALARI =====
        for (let i = waves.length - 1; i >= 0; i--) {
            const w = waves[i];
            if (w.isDead) { waves.splice(i, 1); continue; }

            w.x += w.vx * ts;
            w.y += w.vy * ts;
            w.travelDist += Math.hypot(w.vx * ts, w.vy * ts);
            w.trail.push({ x: w.x, y: w.y, life: 12 });
            if (w.trail.length > 8) w.trail.shift();

            if (w.travelDist > WAVE_RANGE) { waves.splice(i, 1); continue; }

            if (w.x < WALL_THICKNESS || w.x > canvas.width - WALL_THICKNESS ||
                w.y < WALL_THICKNESS || w.y > canvas.height - WALL_THICKNESS) {
                waves.splice(i, 1);
                continue;
            }

            let hitWall = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(w, o) < o.radius + 5) {
                    o.hp -= WALL_DMG;
                    addFloatingNumber(o.x, o.y, WALL_DMG, C_LIGHT);
                    burst(w.x, w.y, 5, C_LIGHT);
                    hitWall = true;
                    break;
                }
            }
            if (hitWall) {
                waves.splice(i, 1);
                continue;
            }

            if (w.hitBots.size >= MAX_BOTS_HIT) continue;

            for (const e of getActiveEnemies()) {
                if (e.isDead) continue;
                if (w.hitBots.has(e)) continue;
                if (getDist(w, e) < e.radius + 8) {
                    const dmg = w.isCenter ? CENTER_DMG : SIDE_DMG;
                    e.hp -= dmg;
                    addFloatingNumber(e.x, e.y, dmg, w.isCenter ? C_FROZEN : C_LIGHT);
                    player.hp = Math.min(player.maxHp, player.hp + HEAL_PER_HIT);
                    addFloatingNumber(player.x, player.y - 20, "+" + HEAL_PER_HIT, C_HEAL);
                    w.hitBots.add(e);
                    burst(e.x, e.y, 4, C_LIGHT);

                    if (w.isAks2 && !e._dondurucuJumpActive && !e._frozen) {
                        e._dondurucuJumpActive = true;
                        jumpedBots.set(e, { timer: AKS2_JUMP_TIME, origY: e.y });
                    }

                    if (w.hitBots.size >= MAX_BOTS_HIT) break;
                }
            }
        }

        // ===== FX =====
        for (let i = dondurucuFX.length - 1; i >= 0; i--) {
            const p = dondurucuFX[i];
            if (p.isRing) {
                p.ringRadius += p.ringSpeed * ts;
                p.life -= ts;
                if (p.life <= 0) dondurucuFX.splice(i, 1);
            } else {
                p.x += p.vx * ts; p.y += p.vy * ts;
                p.vy += p.gravity * ts;
                p.vx *= 0.95; p.vy *= 0.95;
                p.life -= ts;
                if (p.life <= 0) dondurucuFX.splice(i, 1);
            }
        }
        for (let i = dondurucuTexts.length - 1; i >= 0; i--) {
            const t = dondurucuTexts[i];
            t.y -= 0.7 * ts;
            t.life -= ts;
            if (t.life <= 0) dondurucuTexts.splice(i, 1);
        }
        if (screenFlash > 0) screenFlash -= ts;
    }

    // ===== ÇİZİM =====
    chainHook('onDraw', function (ctx2) {
        frozenBots.forEach((v, b) => {
            if (!b || b.isDead) return;
            ctx2.save();
            ctx2.globalAlpha = 0.4;
            ctx2.beginPath(); ctx2.arc(b.x, b.y, b.radius + 4, 0, Math.PI * 2);
            ctx2.fillStyle = C_FROZEN; ctx2.fill();
            ctx2.restore();
            ctx2.save();
            ctx2.translate(b.x, b.y - b.radius - 18);
            ctx2.globalAlpha = 0.8 + Math.sin(Date.now() / 150) * 0.2;
            ctx2.fillStyle = C_FROZEN;
            ctx2.font = 'bold 18px Arial';
            ctx2.textAlign = 'center';
            ctx2.fillText('❄', 0, 0);
            ctx2.restore();
            ctx2.save();
            ctx2.beginPath();
            ctx2.arc(b.x, b.y, b.radius + 6, 0, Math.PI * 2);
            ctx2.strokeStyle = C_FROZEN;
            ctx2.lineWidth = 2;
            ctx2.setLineDash([4, 4]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.restore();
        });

        // === ANA SALDIRI — EMZ TARZI KONİK SPREY ===
        waves.forEach(w => {
            // Sprey izi — geride küçük buz bulutçukları
            w.trail.forEach(pt => {
                ctx2.save();
                const fade = pt.life / 12;
                const tSize = 6 + (1 - fade) * 10;
                ctx2.globalAlpha = fade * 0.3;
                ctx2.beginPath(); ctx2.arc(pt.x, pt.y, tSize, 0, Math.PI * 2);
                ctx2.fillStyle = C_LIGHT; ctx2.fill();
                ctx2.restore();
            });

            // Ana sprey bulutu — mesafeyle genişler
            ctx2.save();
            ctx2.translate(w.x, w.y);
            const expand = 1 + (w.travelDist / WAVE_RANGE) * 2.5;
            const baseSize = (w.isCenter ? 22 : 16) * expand;

            // Yumuşak bulut (3 katman)
            for (let L = 0; L < 3; L++) {
                const r = baseSize * (1 - L * 0.28);
                ctx2.globalAlpha = 0.18 - L * 0.04;
                ctx2.beginPath(); ctx2.arc(0, 0, r, 0, Math.PI * 2);
                ctx2.fillStyle = w.isCenter ? C_FROZEN : C_LIGHT;
                ctx2.fill();
            }

            // İçinde buz tozu noktaları
            const seed = (w.sx + w.sy) * 0.013;
            for (let i = 0; i < 5; i++) {
                const a = seed + i * 1.7;
                const rad = baseSize * (0.2 + ((seed * 0.7 + i * 0.31) % 0.7));
                ctx2.globalAlpha = 0.55;
                ctx2.beginPath();
                ctx2.arc(Math.cos(a) * rad, Math.sin(a) * rad, 1.5 + (i % 2), 0, Math.PI * 2);
                ctx2.fillStyle = C_WHITE;
                ctx2.fill();
            }
            ctx2.restore();
        });

        dondurucuFX.forEach(p => {
            if (p.isRing) {
                ctx2.save();
                ctx2.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.7;
                ctx2.beginPath(); ctx2.arc(p.x, p.y, p.ringRadius, 0, Math.PI * 2);
                ctx2.strokeStyle = p.color; ctx2.lineWidth = 4; ctx2.stroke();
                ctx2.restore();
            } else {
                ctx2.save();
                ctx2.globalAlpha = Math.min(1, p.life / 15);
                ctx2.beginPath(); ctx2.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx2.fillStyle = p.color; ctx2.fill();
                ctx2.restore();
            }
        });

        dondurucuTexts.forEach(t => {
            ctx2.save();
            ctx2.globalAlpha = Math.min(1, t.life / 20);
            ctx2.font = t.isLabel ? 'bold 16px Arial' : 'bold 13px Arial';
            ctx2.textAlign = 'center';
            ctx2.fillStyle = t.color || C_LIGHT;
            ctx2.strokeStyle = 'rgba(15,25,35,0.9)';
            ctx2.lineWidth = 3;
            ctx2.strokeText(t.val, t.x, t.y);
            ctx2.fillText(t.val, t.x, t.y);
            ctx2.restore();
        });

        if (player.charType === CHAR_ID && player._dondurucuHideAim && !player.isDead && player.ammo >= 1) {
            const ang = aimData.angle;
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.rotate(ang);
            ctx2.beginPath();
            ctx2.moveTo(0, 0);
            ctx2.arc(0, 0, WAVE_RANGE, -0.22, 0.22);
            ctx2.closePath();
            ctx2.fillStyle = 'rgba(133, 193, 233, 0.12)';
            ctx2.fill();
            ctx2.beginPath();
            ctx2.moveTo(0, 0);
            ctx2.lineTo(Math.cos(-0.18) * WAVE_RANGE, Math.sin(-0.18) * WAVE_RANGE);
            ctx2.moveTo(0, 0);
            ctx2.lineTo(Math.cos(0.18) * WAVE_RANGE, Math.sin(0.18) * WAVE_RANGE);
            ctx2.strokeStyle = 'rgba(133, 193, 233, 0.6)';
            ctx2.lineWidth = 1.5;
            ctx2.stroke();
            ctx2.restore();
        }

        if (screenFlash > 0) {
            ctx2.save();
            ctx2.globalAlpha = screenFlash / 10 * 0.5;
            ctx2.fillStyle = C_FROZEN;
            ctx2.fillRect(0, 0, canvas.width, canvas.height);
            ctx2.restore();
        }

        if (player.charType === CHAR_ID && ultiDrag.active && player.ultReady && !player.isDead && !ultiState) {
            const pullMag = ultiDrag.pull < 0.05 ? 1 : ultiDrag.pull;
            const dist = ULTI_PLACE_MIN + (ULTI_PLACE_MAX - ULTI_PLACE_MIN) * pullMag;
            const tx = clampPos(player.x + Math.cos(ultiDrag.angle) * dist, WALL_THICKNESS + 40, canvas.width - WALL_THICKNESS - 40);
            const ty = clampPos(player.y + Math.sin(ultiDrag.angle) * dist, WALL_THICKNESS + 40, canvas.height - WALL_THICKNESS - 40);
            ctx2.save();
            ctx2.beginPath();
            ctx2.moveTo(player.x, player.y);
            ctx2.lineTo(tx, ty);
            ctx2.strokeStyle = 'rgba(133, 193, 233, 0.6)';
            ctx2.lineWidth = 3;
            ctx2.setLineDash([8, 6]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.beginPath();
            ctx2.arc(tx, ty, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(133, 193, 233, 0.15)';
            ctx2.fill();
            ctx2.strokeStyle = C_LIGHT;
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.restore();
        }
    });

    (function () {
        const n = document.getElementById('diff-normal');
        const e = document.getElementById('diff-easy');
        if (n) { n.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); n.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
        if (e) { e.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); e.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
    })();

    console.log('[MOD YÜKLENDİ] dondurucu (v5 görsel revizyon)');
})();