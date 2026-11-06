// ========== mod32.js (ANACHOR) — Zehir + Yalnızlık + Teleport + İntikam ==========
(function () {
    'use strict';

    const CHAR_ID = 'anachor';
    const C_MAIN = '#7c5c9a';
    const C_LIGHT = '#b8a0d4';
    const C_DARK = '#4a3a5a';
    const C_ALONE = '#9b6fd4';
    const C_CROWD = '#5a406e';
    const C_POISON = '#22c55e';
    const C_SHIELD = '#60a5fa';
    const C_HEAL = '#2ecc71';
    const C_TELEPORT = '#a78bfa';
    const C_REVENGE = '#a855f7';

    const CHAR_HP = 2000;
    const CHAR_SPEED = 3.6;
    const ALONE_RADIUS = 125;

    const BULLET_DMG = 200;
    const POISON_TICK_DMG = 200;
    const POISON_AOE_DMG = 400;
    const POISON_TICK_INTERVAL = 30;
    const POISON_ALONE_TIME = 120;
    const POISON_CROWD_TIME = 90;

    const TEMAS_DMG = 400;
    const TEMAS_CD = 240;

    const ULTI_ATTACKS = 3;
    const ULTI_INTERVAL = 24;
    const ULTI_APPEAR_TIME = 12;
    const ULTI_MISSILE_COUNT = 3;
    const ULTI_MISSILE_DMG = 200;
    const ULTI_MISSILE_SPREAD = 0.15;
    const ULTI_NEAR_RADIUS = 250;

    const AKS1_CD = 960;
    const AKS1_DMG_ALONE = 500;
    const AKS1_DMG_CROWD = 300;
    const AKS1_WINDOW_ALONE = 2500;
    const AKS1_WINDOW_CROWD = 2000;

    const AKS2_CD = 1260;
    const DASH_DIST = 150;
    const DASH_FRAMES = 25;
    const DASH_DMG = 500;
    const DASH_PUSH = 20;
    const DASH_MAX_BOTS = 3;

    const WALL_DMG_ALONE = 110;
    const WALL_DMG_CROWD = 80;
    const HEAL_PCT = 0.20;
    const SPEED_MULT = 1.20;

    window.GAME_EXT.characters[CHAR_ID] = { color: C_MAIN, hp: CHAR_HP, speed: CHAR_SPEED };

    let yrictBullets = [];
    let yrictPoisonBots = new Map();
    let yrictSilenced = new Map();
    let poisonPools = [];
    let yrictDash = null;
    let yrictAks2Aim = { active: false, angle: 0, isMouse: false, touchId: null };
    let yrictAks1Cd = 0, yrictAks1Ready = true;
    let yrictAks2Cd = 0, yrictAks2Ready = true;
    let yrictIsAlone = true;
    let yrictLastHp = 0;
    let yrictSpeedMult = 1;
    let yrictFX = [];
    let ultiState = null;
    let ultiReturnMarker = null;
    let screenFlash = 0;

    // Base drawEntity — Yrict için base çizimi engelle (kendi çizimimiz + HP bar)
    if (!window._anachorOrigDrawEntity) {
        window._anachorOrigDrawEntity = window.drawEntity;
        window.drawEntity = function (e, isP) {
            if (!e) return;
            if (isP && player && player.charType === CHAR_ID) return;
            return window._anachorOrigDrawEntity(e, isP);
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

    function isYrictAlone() {
        const enemies = getActiveEnemies();
        for (const e of enemies) {
            if (!e.isDead && getDist(player, e) < ALONE_RADIUS) return false;
        }
        return true;
    }

    function yrictCharge(amount) {
        if (player.charType !== CHAR_ID) return;
        if (!gameStarted || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount);
        if (player.ultCharge >= 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
        }
        if (ultFill) ultFill.style.width = player.ultCharge + '%';
    }

    const _origChargeUlti = window.chargeUlti;
    window.chargeUlti = function (amount) {
        if (player && player.charType === CHAR_ID) return;
        return _origChargeUlti.call(this, amount);
    };

    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + C_MAIN + ';"></div>' +
            '<span>Anachor</span>' +
            '<small>Zehir + Yalnızlık<br>Güç: İntikam + Dash<br>Ulti: Işınlanma</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function clearAll() {
        yrictBullets = [];
        yrictPoisonBots.clear();
        yrictSilenced.clear();
        poisonPools = [];
        yrictDash = null;
        yrictAks2Aim = { active: false, angle: 0, isMouse: false, touchId: null };
        yrictAks1Cd = 0; yrictAks1Ready = true;
        yrictAks2Cd = 0; yrictAks2Ready = true;
        yrictIsAlone = true;
        yrictLastHp = 0;
        yrictSpeedMult = 1;
        yrictFX = [];
        ultiState = null;
        ultiReturnMarker = null;
        screenFlash = 0;
        if (player) {
            player._yrictDashing = false;
            player.jumpInvulnerable = false;
        }
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
                gadgetBtn.innerHTML = 'İNTİKAM<br><span id="gadget-timer"></span>';
                gadgetBtn.classList.remove('cooldown');
            }
            if (gadgetBtn2) {
                gadgetBtn2.style.display = 'flex';
                gadgetBtn2.innerHTML = 'DASH<br><span id="gadget-timer-2"></span>';
                gadgetBtn2.classList.remove('cooldown');
            }
            if (ultiBtn) {
                ultiBtn.style.display = 'flex';
                ultiBtn.style.background = 'radial-gradient(circle, #4a3a5a, #1a0f2a)';
            }
            if (typeof gadgetTimerText !== 'undefined') gadgetTimerText = document.getElementById('gadget-timer');
            if (typeof gadgetTimerText2 !== 'undefined') gadgetTimerText2 = document.getElementById('gadget-timer-2');
        } else {
            clearAll();
            if (ultiBtn) ultiBtn.style.background = '';
        }
    };

    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== CHAR_ID) return origFire.call(this, a, pull);
        if (this.ammo < 1 || this.isDead || (yrictDash && yrictDash.active) || ultiState) return;
        if (!Number.isFinite(a)) a = this.angle || 0;
        yrictBullets.push({
            x: this.x, y: this.y, sx: this.x, sy: this.y,
            vx: Math.cos(a) * PLAYER_BULLET_SPEED,
            vy: Math.sin(a) * PLAYER_BULLET_SPEED,
            angle: a, life: 0, maxLife: 60,
            isDead: false, isUlti: false, isRevenge: false
        });
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    const origGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget.call(this, a, pull);
        if (!yrictAks1Ready || this.isDead || ultiState) return;
        const now = Date.now();
        const alone = isYrictAlone();
        const dmg = alone ? AKS1_DMG_ALONE : AKS1_DMG_CROWD;
        const windowMs = alone ? AKS1_WINDOW_ALONE : AKS1_WINDOW_CROWD;

        const targets = new Set();
        getActiveEnemies().forEach(e => {
            if (e.isDead) return;
            if (e._yrictHitPlayerAt && now - e._yrictHitPlayerAt < windowMs) {
                targets.add(e);
            }
        });
        const sorted = getActiveEnemies().filter(e => !e.isDead).sort((a, b) => getDist(player, a) - getDist(player, b));
        for (let i = 0; i < Math.min(2, sorted.length); i++) targets.add(sorted[i]);

        targets.forEach(target => {
            const ang = Math.atan2(target.y - player.y, target.x - player.x);
            yrictBullets.push({
                x: player.x, y: player.y, sx: player.x, sy: player.y,
                vx: Math.cos(ang) * PLAYER_BULLET_SPEED * 1.5,
                vy: Math.sin(ang) * PLAYER_BULLET_SPEED * 1.5,
                angle: ang, life: 0, maxLife: 120,
                isDead: false, isUlti: false, isRevenge: true,
                revengeDmg: dmg, target: target,
                hitEnemies: new Set()
            });
        });

        yrictAks1Ready = false;
        yrictAks1Cd = AKS1_CD;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(AKS1_CD / 60) + "s";
        addFloatingNumber(this.x, this.y - 40, targets.size > 0 ? 'İNTİKAM!' : 'BOŞ!', C_TELEPORT);
        yrictFX.push({ type: 'shieldBurst', x: this.x, y: this.y, life: 20, maxLife: 20 });
    };

    const origGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget2.call(this, a, pull);
        if (!yrictAks2Ready || this.isDead || yrictDash || ultiState) return;
        const ang = a !== undefined ? a : this.angle;
        const dist = DASH_DIST;
        const tx = clampPos(this.x + Math.cos(ang) * dist, WALL_THICKNESS + this.radius, canvas.width - WALL_THICKNESS - this.radius);
        const ty = clampPos(this.y + Math.sin(ang) * dist, WALL_THICKNESS + this.radius, canvas.height - WALL_THICKNESS - this.radius);
        yrictDash = {
            active: true, timer: DASH_FRAMES,
            startX: this.x, startY: this.y,
            targetX: tx, targetY: ty,
            hitBots: new Set()
        };
        this._yrictDashing = true;
        yrictAks2Ready = false;
        yrictAks2Cd = AKS2_CD;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(AKS2_CD / 60) + "s";
        yrictFX.push({ type: 'dashStart', x: this.x, y: this.y, life: 15, maxLife: 15 });
    };

    const origUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return origUlti.call(this, a, pull);
        if (!this.ultReady || this.isDead || (yrictDash && yrictDash.active) || ultiState) return;
        if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) return;

        const enemies = [];
        getActiveEnemies().forEach(e => {
            if (!e.isDead && getDist(player, e) < ULTI_NEAR_RADIUS + e.radius) {
                enemies.push({ e, dist: getDist(player, e) });
            }
        });
        enemies.sort((a, b) => a.dist - b.dist);

        const targets = [];
        if (enemies.length === 0) {
            for (let i = 0; i < ULTI_ATTACKS; i++) {
                const ang = (i / ULTI_ATTACKS) * Math.PI * 2;
                targets.push({
                    x: clampPos(player.x + Math.cos(ang) * 120, WALL_THICKNESS + 40, canvas.width - WALL_THICKNESS - 40),
                    y: clampPos(player.y + Math.sin(ang) * 120, WALL_THICKNESS + 40, canvas.height - WALL_THICKNESS - 40)
                });
            }
        } else if (enemies.length === 1) {
            const e = enemies[0].e;
            for (let i = 0; i < ULTI_ATTACKS; i++) {
                const ang = (i / ULTI_ATTACKS) * Math.PI * 2;
                const r = e.radius + 60;
                targets.push({
                    x: clampPos(e.x + Math.cos(ang) * r, WALL_THICKNESS + 30, canvas.width - WALL_THICKNESS - 30),
                    y: clampPos(e.y + Math.sin(ang) * r, WALL_THICKNESS + 30, canvas.height - WALL_THICKNESS - 30)
                });
            }
        } else if (enemies.length === 2) {
            const eA = enemies[0].e, eB = enemies[1].e;
            [eA, eB, eA].forEach(e => {
                const ang = Math.random() * Math.PI * 2;
                const r = e.radius + 60;
                targets.push({
                    x: clampPos(e.x + Math.cos(ang) * r, WALL_THICKNESS + 30, canvas.width - WALL_THICKNESS - 30),
                    y: clampPos(e.y + Math.sin(ang) * r, WALL_THICKNESS + 30, canvas.height - WALL_THICKNESS - 30)
                });
            });
        } else {
            for (let i = 0; i < ULTI_ATTACKS; i++) {
                const e = enemies[i].e;
                const ang = Math.random() * Math.PI * 2;
                const r = e.radius + 60;
                targets.push({
                    x: clampPos(e.x + Math.cos(ang) * r, WALL_THICKNESS + 30, canvas.width - WALL_THICKNESS - 30),
                    y: clampPos(e.y + Math.sin(ang) * r, WALL_THICKNESS + 30, canvas.height - WALL_THICKNESS - 30)
                });
            }
        }

        ultiReturnMarker = { x: this.x, y: this.y, timer: ULTI_ATTACKS * ULTI_INTERVAL + 30 };
        ultiState = {
            attackIndex: 0,
            timer: ULTI_INTERVAL,
            startX: this.x,
            startY: this.y,
            targets: targets,
            appearTimer: ULTI_APPEAR_TIME,
            missilesFired: false,
            currentX: this.x,
            currentY: this.y
        };

        this.jumpInvulnerable = true;
        screenFlash = 8;
        addFloatingNumber(this.x, this.y - 40, 'IŞINLAN!', C_TELEPORT);

        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = '0%';
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    chainHook('onReset', function () { clearAll(); });

    chainHook('onUpdate', function (ts) {
        if (player.charType !== CHAR_ID || player.isDead) return;
        if (!gameStarted) return;
        if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
        if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
        if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';

        // ULTI TELEPORT
        if (ultiState) {
            if (ultiState.appearTimer > 0) {
                ultiState.appearTimer -= ts;
                if (ultiState.appearTimer <= 0 && !ultiState.missilesFired) {
                    let nearestE = null, nearestD = Infinity;
                    getActiveEnemies().forEach(e => {
                        if (e.isDead) return;
                        const d = getDist({x: ultiState.currentX, y: ultiState.currentY}, e);
                        if (d < nearestD) { nearestD = d; nearestE = e; }
                    });
                    let ang;
                    if (nearestE) {
                        ang = Math.atan2(nearestE.y - ultiState.currentY, nearestE.x - ultiState.currentX);
                    } else {
                        ang = Math.random() * Math.PI * 2;
                    }
                    for (let i = 0; i < ULTI_MISSILE_COUNT; i++) {
                        const spread = (i - (ULTI_MISSILE_COUNT - 1) / 2) * ULTI_MISSILE_SPREAD;
                        const fireAng = ang + spread;
                        yrictBullets.push({
                            x: ultiState.currentX, y: ultiState.currentY,
                            sx: ultiState.currentX, sy: ultiState.currentY,
                            vx: Math.cos(fireAng) * PLAYER_BULLET_SPEED * 1.2,
                            vy: Math.sin(fireAng) * PLAYER_BULLET_SPEED * 1.2,
                            angle: fireAng, life: 0, maxLife: 45,
                            isDead: false, isUlti: true, isRevenge: false
                        });
                    }
                    ultiState.missilesFired = true;
                    yrictFX.push({ type: 'teleportBurst', x: ultiState.currentX, y: ultiState.currentY, life: 15, maxLife: 15 });
                }
            }

            ultiState.timer -= ts;
            if (ultiState.timer <= 0) {
                ultiState.attackIndex++;
                if (ultiState.attackIndex >= ultiState.targets.length) {
                    player.x = ultiState.startX;
                    player.y = ultiState.startY;
                    player.jumpInvulnerable = false;
                    yrictFX.push({ type: 'teleportBurst', x: player.x, y: player.y, life: 20, maxLife: 20 });
                    screenFlash = 8;
                    addFloatingNumber(player.x, player.y - 40, 'GERİ DÖNDÜ!', C_TELEPORT);
                    ultiState = null;
                } else {
                    const t = ultiState.targets[ultiState.attackIndex];
                    ultiState.currentX = t.x;
                    ultiState.currentY = t.y;
                    ultiState.timer = ULTI_INTERVAL;
                    ultiState.appearTimer = ULTI_APPEAR_TIME;
                    ultiState.missilesFired = false;
                    yrictFX.push({ type: 'teleportIn', x: t.x, y: t.y, life: ULTI_APPEAR_TIME, maxLife: ULTI_APPEAR_TIME });
                }
            }
        }

        if (ultiReturnMarker) {
            ultiReturnMarker.timer -= ts;
            if (ultiReturnMarker.timer <= 0) ultiReturnMarker = null;
        }

        if (screenFlash > 0) screenFlash -= ts;

        const alone = isYrictAlone();
        yrictIsAlone = alone;

        const targetMult = alone ? SPEED_MULT : 1;
        if (Math.abs(targetMult - yrictSpeedMult) > 0.001) {
            player.speed = player.speed / yrictSpeedMult * targetMult;
            yrictSpeedMult = targetMult;
        }

        if (yrictAks1Cd > 0) {
            yrictAks1Cd -= ts;
            if (yrictAks1Cd <= 0) {
                yrictAks1Cd = 0; yrictAks1Ready = true;
                if (gadgetBtn) gadgetBtn.classList.remove('cooldown');
                if (gadgetTimerText) gadgetTimerText.innerText = '';
            }
        }
        if (yrictAks2Cd > 0) {
            yrictAks2Cd -= ts;
            if (yrictAks2Cd <= 0) {
                yrictAks2Cd = 0; yrictAks2Ready = true;
                if (gadgetBtn2) gadgetBtn2.classList.remove('cooldown');
                if (gadgetTimerText2) gadgetTimerText2.innerText = '';
            }
        }

        if (yrictLastHp > 0 && player.hp < yrictLastHp) {
            let taken = yrictLastHp - player.hp;
            if (alone && taken > 0) {
                const heal = taken * HEAL_PCT;
                player.hp = Math.min(player.maxHp, player.hp + heal);
            }
        }
        yrictLastHp = player.hp;

        yrictPoisonBots.forEach((v, e) => {
            if (!e || e.isDead) {
                if (e && v.timer > 0) {
                    poisonPools.push({ x: e.x, y: e.y, timer: v.timer, tickTimer: v.tickTimer });
                }
                yrictPoisonBots.delete(e);
                return;
            }
            v.timer -= ts;
            v.tickTimer += ts;
            if (v.tickTimer >= POISON_TICK_INTERVAL && v.timer > 0) {
                v.tickTimer = 0;
                e.hp -= POISON_TICK_DMG;
                addFloatingNumber(e.x, e.y - 10, POISON_TICK_DMG, C_POISON);
                yrictCharge(3);
            }
            if (v.timer <= 0) {
                const aoe = POISON_AOE_DMG;
                e.hp -= aoe;
                addFloatingNumber(e.x, e.y, aoe, C_POISON);
                getActiveEnemies().forEach(other => {
                    if (other !== e && !other.isDead && getDist(e, other) < 100 + other.radius) {
                        other.hp -= aoe;
                        addFloatingNumber(other.x, other.y, aoe, C_POISON);
                    }
                });
                yrictFX.push({ type: 'poisonAoe', x: e.x, y: e.y, radius: 0, maxRadius: 100, life: 15, maxLife: 15 });
                yrictCharge(5);
                yrictPoisonBots.delete(e);
            }
        });

        yrictSilenced.forEach((v, e) => {
            if (!e || e.isDead) { yrictSilenced.delete(e); return; }
            const remaining = v - ts;
            if (remaining <= 0) {
                yrictSilenced.delete(e);
            } else {
                yrictSilenced.set(e, remaining);
                e.shootInterval = 999999;
            }
        });

        for (let i = poisonPools.length - 1; i >= 0; i--) {
            const p = poisonPools[i];
            p.timer -= ts;
            p.tickTimer += ts;
            if (p.tickTimer >= POISON_TICK_INTERVAL && p.timer > 0) {
                p.tickTimer = 0;
                getActiveEnemies().forEach(e => {
                    if (!e.isDead && getDist(p, e) < 50 + e.radius) {
                        e.hp -= POISON_TICK_DMG;
                        addFloatingNumber(e.x, e.y - 10, POISON_TICK_DMG, C_POISON);
                    }
                });
            }
            if (p.timer <= 0) {
                getActiveEnemies().forEach(e => {
                    if (!e.isDead && getDist(p, e) < 100 + e.radius) {
                        e.hp -= POISON_AOE_DMG;
                        addFloatingNumber(e.x, e.y, POISON_AOE_DMG, C_POISON);
                    }
                });
                yrictFX.push({ type: 'poisonAoe', x: p.x, y: p.y, radius: 0, maxRadius: 100, life: 15, maxLife: 15 });
                poisonPools.splice(i, 1);
            }
        }

        if (!ultiState) {
            getActiveEnemies().forEach(e => {
                if (e.isDead) return;
                if (e._yrictTemasCd > 0) { e._yrictTemasCd -= ts; return; }
                if (getDist(player, e) < player.radius + e.radius + 3) {
                    e.hp -= TEMAS_DMG;
                    e._yrictTemasCd = TEMAS_CD;
                    addFloatingNumber(e.x, e.y, TEMAS_DMG, C_POISON);
                    yrictCharge(6);
                }
            });
        }

        if (yrictDash && yrictDash.active) {
            yrictDash.timer -= ts;
            const prog = 1 - (yrictDash.timer / DASH_FRAMES);
            player.x = yrictDash.startX + (yrictDash.targetX - yrictDash.startX) * Math.min(1, prog);
            player.y = yrictDash.startY + (yrictDash.targetY - yrictDash.startY) * Math.min(1, prog);

            getActiveEnemies().forEach(e => {
                if (e.isDead || yrictDash.hitBots.has(e)) return;
                if (yrictDash.hitBots.size >= DASH_MAX_BOTS) return;
                if (getDist(player, e) < e.radius + player.radius + 15) {
                    yrictDash.hitBots.add(e);
                    const ang = getAngle(player, e);
                    e.x += Math.cos(ang) * DASH_PUSH;
                    e.y += Math.sin(ang) * DASH_PUSH;
                    e.hp -= DASH_DMG;
                    addFloatingNumber(e.x, e.y, DASH_DMG, '#c084fc');
                    yrictCharge(5);
                }
            });

            if (yrictDash.timer <= 0) {
                yrictDash.active = false;
                player.x = yrictDash.targetX;
                player.y = yrictDash.targetY;
                player._yrictDashing = false;
                yrictFX.push({ type: 'dashEnd', x: player.x, y: player.y, life: 12, maxLife: 12 });
                yrictDash = null;
            }
        }

        for (let i = yrictFX.length - 1; i >= 0; i--) {
            yrictFX[i].life -= ts;
            if (yrictFX[i].radius !== undefined) {
                yrictFX[i].radius = (yrictFX[i].maxRadius || 0) * (1 - yrictFX[i].life / yrictFX[i].maxLife);
            }
            if (yrictFX[i].life <= 0) yrictFX.splice(i, 1);
        }

        if (ultiBtn && player.ultReady) ultiBtn.classList.add('ready');
    });

    const _origUBL = window.updateBulletLogic;
    window.updateBulletLogic = function (list, isBot, ts) {
        // Bot tracking (intikam için)
        if (isBot && player.charType === CHAR_ID && !player.isDead) {
            for (const b of list) {
                if (b.owner && !b.owner.isDead && getDist(b, player) < player.radius + 15) {
                    b.owner._yrictHitPlayerAt = Date.now();
                }
            }
        }

        if (!isBot && player.charType === CHAR_ID) {
            for (let i = yrictBullets.length - 1; i >= 0; i--) {
                const b = yrictBullets[i];
                b.x += b.vx * ts; b.y += b.vy * ts;
                b.life += ts;
                if (b.life > b.maxLife) { yrictBullets.splice(i, 1); continue; }

                if (b.x < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS ||
                    b.y < WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) {
                    yrictBullets.splice(i, 1); continue;
                }

                // İNTİKAM MERMİSİ — piercing, siperden geçer
                if (b.isRevenge) {
                    if (b.target && b.target.isDead) { yrictBullets.splice(i, 1); continue; }
                    let stopped = false;
                    for (const e of getActiveEnemies()) {
                        if (e.isDead || b.hitEnemies.has(e)) continue;
                        if (getDist(b, e) < e.radius + 8) {
                            e.hp -= b.revengeDmg;
                            addFloatingNumber(e.x, e.y, b.revengeDmg, C_REVENGE);
                            b.hitEnemies.add(e);
                            if (e === b.target) { stopped = true; break; }
                        }
                    }
                    if (stopped) yrictBullets.splice(i, 1);
                    continue;
                }

                // Normal / ulti mermisi
                let hitWall = false;
                for (const o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(b, o) < o.radius + 5) {
                        if (!b.isUlti) {
                            const wallDmg = yrictIsAlone ? WALL_DMG_ALONE : WALL_DMG_CROWD;
                            o.hp -= wallDmg;
                            addFloatingNumber(o.x, o.y, wallDmg, C_LIGHT);
                        }
                        hitWall = true; break;
                    }
                }
                if (hitWall) { yrictBullets.splice(i, 1); continue; }
                let hitEnemy = null;
                for (const e of getActiveEnemies()) {
                    if (e.isDead) continue;
                    if (getDist(b, e) < e.radius + 8) { hitEnemy = e; break; }
                }
                if (hitEnemy) {
                    const dmg = b.isUlti ? ULTI_MISSILE_DMG : BULLET_DMG;
                    hitEnemy.hp -= dmg;
                    addFloatingNumber(hitEnemy.x, hitEnemy.y, dmg, b.isUlti ? C_TELEPORT : C_LIGHT);
                    if (!b.isUlti) {
                        const dur = yrictIsAlone ? POISON_ALONE_TIME : POISON_CROWD_TIME;
                        const existing = yrictPoisonBots.get(hitEnemy);
                        if (existing) {
                            existing.timer = Math.max(existing.timer, dur);
                        } else {
                            yrictPoisonBots.set(hitEnemy, { timer: dur, tickTimer: 0 });
                        }
                        yrictCharge(4);
                    }
                    yrictBullets.splice(i, 1);
                    continue;
                }
            }
        }
        return _origUBL(list, isBot, ts);
    };

    chainHook('onDraw', function (ctx2) {
        if (player.charType !== CHAR_ID || !gameStarted) return;

        // Karakter çizimi (ulti sırasında gizle)
        if (!ultiState) {
            const alone = yrictIsAlone;
            const scale = alone ? 1.10 : 0.90;
            const bodyColor = alone ? C_ALONE : C_CROWD;
            const pulse = alone ? Math.sin(Date.now() / 600) * 1.5 : 0;

            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.scale(scale, scale);
            ctx2.rotate(player.angle);
            ctx2.fillStyle = 'rgba(0,0,0,0.35)';
            ctx2.beginPath(); ctx2.ellipse(0, player.radius * 0.4, player.radius * 0.9, player.radius * 0.35, 0, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = bodyColor;
            ctx2.beginPath(); ctx2.arc(0, 0, player.radius + pulse, 0, Math.PI * 2); ctx2.fill();
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

        // Ulti geri dönüş işareti
        if (ultiReturnMarker) {
            ctx2.save();
            ctx2.globalAlpha = 0.5 + Math.sin(Date.now() / 200) * 0.2;
            ctx2.beginPath();
            ctx2.arc(ultiReturnMarker.x, ultiReturnMarker.y, 22, 0, Math.PI * 2);
            ctx2.strokeStyle = C_TELEPORT;
            ctx2.lineWidth = 3;
            ctx2.setLineDash([8, 5]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.globalAlpha = 0.35;
            ctx2.beginPath();
            ctx2.arc(ultiReturnMarker.x, ultiReturnMarker.y, 10, 0, Math.PI * 2);
            ctx2.fillStyle = C_TELEPORT;
            ctx2.fill();
            ctx2.restore();
        }

        // Ulti belirme efekti
        if (ultiState) {
            if (ultiState.appearTimer > 0) {
                const prog = 1 - (ultiState.appearTimer / ULTI_APPEAR_TIME);
                ctx2.save();
                for (let r = 0; r < 3; r++) {
                    ctx2.globalAlpha = (1 - prog) * 0.6;
                    ctx2.beginPath();
                    ctx2.arc(ultiState.currentX, ultiState.currentY, 10 + prog * 25 + r * 5, 0, Math.PI * 2);
                    ctx2.strokeStyle = C_TELEPORT;
                    ctx2.lineWidth = 2;
                    ctx2.stroke();
                }
                ctx2.globalAlpha = (1 - prog) * 0.5;
                ctx2.beginPath();
                ctx2.arc(ultiState.currentX, ultiState.currentY, 25 * prog, 0, Math.PI * 2);
                ctx2.fillStyle = C_TELEPORT;
                ctx2.fill();
                ctx2.restore();
            }
            if (ultiState.missilesFired && ultiState.timer > ULTI_INTERVAL - 8) {
                const f = (ultiState.timer - (ULTI_INTERVAL - 8)) / 8;
                ctx2.save();
                ctx2.globalAlpha = f * 0.7;
                ctx2.beginPath();
                ctx2.arc(ultiState.currentX, ultiState.currentY, 15 + (1 - f) * 10, 0, Math.PI * 2);
                ctx2.strokeStyle = C_TELEPORT;
                ctx2.lineWidth = 3;
                ctx2.stroke();
                ctx2.restore();
            }
        }

        // Dash sisi
        if (yrictDash && yrictDash.active) {
            ctx2.save();
            ctx2.globalAlpha = 0.75;
            const grad = ctx2.createRadialGradient(player.x, player.y, 0, player.x, player.y, 40);
            grad.addColorStop(0, 'rgba(15, 10, 25, 0.9)');
            grad.addColorStop(1, 'rgba(15, 10, 25, 0)');
            ctx2.fillStyle = grad;
            ctx2.beginPath(); ctx2.arc(player.x, player.y, 40, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        }

        // Zehirli düşmanlar
        yrictPoisonBots.forEach((v, e) => {
            if (!e || e.isDead) return;
            ctx2.save();
            ctx2.globalAlpha = 0.4;
            ctx2.beginPath(); ctx2.arc(e.x, e.y, e.radius + 5, 0, Math.PI * 2);
            ctx2.fillStyle = C_POISON; ctx2.fill();
            ctx2.restore();
        });

        // Zehir havuzları
        poisonPools.forEach(p => {
            ctx2.save();
            const pl = 1 + Math.sin(Date.now() / 200) * 0.1;
            ctx2.globalAlpha = 0.25;
            ctx2.beginPath(); ctx2.arc(p.x, p.y, 50 * pl, 0, Math.PI * 2);
            ctx2.fillStyle = C_POISON; ctx2.fill();
            ctx2.globalAlpha = 0.55;
            ctx2.beginPath(); ctx2.arc(p.x, p.y, 50 * pl, 0, Math.PI * 2);
            ctx2.strokeStyle = C_POISON; ctx2.lineWidth = 2;
            ctx2.setLineDash([6, 4]); ctx2.stroke(); ctx2.setLineDash([]);
            ctx2.globalAlpha = 0.7;
            ctx2.beginPath(); ctx2.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx2.fillStyle = C_POISON; ctx2.fill();
            ctx2.restore();
        });

        // Mermiler
        yrictBullets.forEach(b => {
            ctx2.save();
            ctx2.translate(b.x, b.y); ctx2.rotate(b.angle);
            if (b.isUlti) {
                ctx2.beginPath();
                ctx2.moveTo(10, 0); ctx2.lineTo(-5, -3); ctx2.lineTo(-5, 3); ctx2.closePath();
                ctx2.fillStyle = C_TELEPORT; ctx2.fill();
                ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 1.5; ctx2.stroke();
            } else if (b.isRevenge) {
                ctx2.globalAlpha = 0.4;
                ctx2.beginPath(); ctx2.moveTo(-8, 0); ctx2.lineTo(-24, 0);
                ctx2.strokeStyle = C_REVENGE; ctx2.lineWidth = 4; ctx2.stroke();
                ctx2.globalAlpha = 1;
                ctx2.beginPath();
                ctx2.moveTo(12, 0); ctx2.lineTo(-8, -5); ctx2.lineTo(-8, 5); ctx2.closePath();
                ctx2.fillStyle = C_REVENGE; ctx2.fill();
                ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 2; ctx2.stroke();
            } else {
                ctx2.beginPath();
                ctx2.moveTo(8, 0); ctx2.lineTo(-6, -4); ctx2.lineTo(-6, 4); ctx2.closePath();
                ctx2.fillStyle = C_POISON; ctx2.fill();
                ctx2.strokeStyle = C_LIGHT; ctx2.lineWidth = 1; ctx2.stroke();
            }
            ctx2.restore();
        });

        // FX
        yrictFX.forEach(fx => {
            ctx2.save();
            const a = fx.life / fx.maxLife;
            if (fx.type === 'darkBurst' || fx.type === 'poisonAoe') {
                ctx2.globalAlpha = a * 0.6;
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, fx.radius || 0, 0, Math.PI * 2);
                ctx2.fillStyle = fx.type === 'darkBurst' ? '#4a3a5a' : C_POISON; ctx2.fill();
            } else if (fx.type === 'shieldBurst') {
                ctx2.globalAlpha = a * 0.7;
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, player.radius + 10 + (1-a)*15, 0, Math.PI * 2);
                ctx2.strokeStyle = C_TELEPORT; ctx2.lineWidth = 3; ctx2.stroke();
            } else if (fx.type === 'dashStart' || fx.type === 'dashEnd') {
                ctx2.globalAlpha = a * 0.6;
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, 20 + (1-a)*15, 0, Math.PI * 2);
                ctx2.strokeStyle = C_DARK; ctx2.lineWidth = 3; ctx2.stroke();
            } else if (fx.type === 'teleportBurst') {
                ctx2.globalAlpha = a * 0.8;
                const r = 30 * (1 - a);
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, r + 5, 0, Math.PI * 2);
                ctx2.strokeStyle = C_TELEPORT; ctx2.lineWidth = 4; ctx2.stroke();
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, r * 0.5, 0, Math.PI * 2);
                ctx2.fillStyle = C_TELEPORT; ctx2.globalAlpha = a * 0.4; ctx2.fill();
            } else if (fx.type === 'teleportIn') {
                ctx2.globalAlpha = a * 0.6;
                const r = 40 * (1 - a);
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, r, 0, Math.PI * 2);
                ctx2.strokeStyle = C_TELEPORT; ctx2.lineWidth = 2; ctx2.stroke();
            }
            ctx2.restore();
        });

        // Dash aim
        if (yrictAks2Aim.active && !ultiState) {
            const a = yrictAks2Aim.angle;
            const dist = DASH_DIST;
            const tx = clampPos(player.x + Math.cos(a) * dist, WALL_THICKNESS + 20, canvas.width - WALL_THICKNESS - 20);
            const ty = clampPos(player.y + Math.sin(a) * dist, WALL_THICKNESS + 20, canvas.height - WALL_THICKNESS - 20);
            ctx2.save();
            ctx2.beginPath(); ctx2.moveTo(player.x, player.y); ctx2.lineTo(tx, ty);
            ctx2.strokeStyle = 'rgba(255,255,255,0.7)'; ctx2.lineWidth = 2; ctx2.setLineDash([8, 6]); ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.beginPath(); ctx2.arc(tx, ty, 8, 0, Math.PI * 2);
            ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        }

        // Ekran flash
        if (screenFlash > 0) {
            ctx2.save();
            ctx2.globalAlpha = screenFlash / 10 * 0.4;
            ctx2.fillStyle = C_TELEPORT;
            ctx2.fillRect(0, 0, canvas.width, canvas.height);
            ctx2.restore();
        }
    });

    // Dash aim kontrolleri
    if (gadgetBtn2) {
        gadgetBtn2.addEventListener('touchstart', (e) => {
            if (player.charType !== CHAR_ID || !yrictAks2Ready || yrictDash || ultiState) return;
            e.preventDefault(); e.stopImmediatePropagation();
            const t = e.changedTouches[0];
            yrictAks2Aim.active = true;
            yrictAks2Aim.touchId = t.identifier;
            yrictAks2Aim.angle = player.angle;
        }, { capture: true, passive: false });

        window.addEventListener('touchmove', (e) => {
            if (!yrictAks2Aim.active) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === yrictAks2Aim.touchId) {
                    const t = e.changedTouches[i];
                    const r = gadgetBtn2.getBoundingClientRect();
                    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                    yrictAks2Aim.angle = Math.atan2(t.clientY - cy, t.clientX - cx);
                }
            }
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            if (!yrictAks2Aim.active) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === yrictAks2Aim.touchId) {
                    yrictAks2Aim.active = false;
                    player.activateGadget2(yrictAks2Aim.angle);
                }
            }
        });

        gadgetBtn2.addEventListener('mousedown', (e) => {
            if (player.charType !== CHAR_ID || !yrictAks2Ready || yrictDash || ultiState) return;
            e.preventDefault(); e.stopImmediatePropagation();
            yrictAks2Aim.active = true;
            yrictAks2Aim.isMouse = true;
            yrictAks2Aim.angle = player.angle;
        }, { capture: true });

        window.addEventListener('mousemove', (e) => {
            if (!yrictAks2Aim.active || !yrictAks2Aim.isMouse) return;
            const r = gadgetBtn2.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            yrictAks2Aim.angle = Math.atan2(e.clientY - cy, e.clientX - cx);
        });

        window.addEventListener('mouseup', () => {
            if (yrictAks2Aim.active && yrictAks2Aim.isMouse) {
                yrictAks2Aim.isMouse = false;
                yrictAks2Aim.active = false;
                player.activateGadget2(yrictAks2Aim.angle);
            }
        });
    }

    console.log('[MOD YÜKLENDİ] anachor (v3 - intikam)');
})();