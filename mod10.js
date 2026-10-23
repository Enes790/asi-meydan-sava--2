// ========== mod31.js (ZIPLAYAN) - ZİNCİR USTASI v3 ==========
(function () {
    'use strict';

    const CHAR_ID = 'ziplayan';
    const C_MAIN = '#8e44ad';
    const C_LIGHT = '#bb8fce';
    const C_SPARK = '#f1c40f';
    const C_WHITE = '#fff';
    const CHAR_HP = 2800;
    const CHAR_SPEED = 3.6;

    const DMG_1 = 700;
    const DMG_2 = 400;
    const DMG_3 = 100;
    const BULLET_SPEED = PLAYER_BULLET_SPEED * 0.95;
    const BULLET_RANGE = 280;
    const MAX_BOT_HITS = 3;
    const MAX_WALL_HITS = 6;
    const WALL_RANGE = 150;
    const RELOAD_SPEED = 0.012;
    const SIIPER_HASAR = 80;

    const DASH_MAX_BOUNCE = 4;
    const DASH_DAMAGE = 200;
    const DASH_SPEED = 16;
    const DASH_LEG = 120;
    const DASH_COOLDOWN = 900;

    const HEAL_PER_WALL = 200;
    const HEAL_MAX = 1000;
    const HEAL_COOLDOWN = 1200;

    const ULTI_RADIUS = 85;
    const ULTI_DAMAGE = 400;
    const ULTI_JUMP_MAX = 8;
    const ULTI_PER_BOT_ULTI = 10;
    const ULTI_PER_BOT_HEAL = 100;
    const ULTI_PLACE_MAX = 260;
    const ULTI_PLACE_MIN = 60;
    const ULTI_AIR_TIME = 40;

    const BOT_JUMP_FRAMES = 48;
    const BOT_JUMP_HEIGHT = 65;
    const BOT_JUMP_AOE_RADIUS = 50;
    const BOT_JUMP_AOE_DMG = 400;

    window.GAME_EXT.characters[CHAR_ID] = { color: C_MAIN, hp: CHAR_HP, speed: CHAR_SPEED };

    let zipBullets = [];
    let zipTexts = [];
    let zipParticles = [];
    let zipSparks = [];
    let dashState = { active: false, vx: 0, vy: 0, bouncesLeft: 0, hitTargets: new Set(), remainingRange: 0 };
    let healReady = false;
    let ultiState = { active: false, startX: 0, startY: 0, targetX: 0, targetY: 0, progress: 0 };
    let ultiDrag = { active: false, startX: 0, startY: 0, angle: 0, pull: 0, touchId: null, isMouse: false };

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') return !!prevResult || !!ownResult;
            return ownResult !== undefined ? ownResult : prevResult;
        };
    }

    function zipText(x, y, val, isLabel) {
        zipTexts.push({ x, y, val, life: 55, maxLife: 55, isLabel: !!isLabel });
    }

    function sparkBurst(x, y, n, color) {
        for (let i = 0; i < (n || 6); i++) {
            const ang = Math.random() * Math.PI * 2;
            const sp = 2 + Math.random() * 4;
            zipParticles.push({
                x, y,
                vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                size: 1.5 + Math.random() * 2,
                life: 15 + Math.random() * 15, maxLife: 30,
                color: color || C_SPARK,
                gravity: 0.05
            });
        }
    }

    function triggerBotJump(bot) {
        if (!bot || bot.isDead || bot._zipJumpActive) return false;
        bot._zipJumpActive = true;
        bot._zipJumpTimer = BOT_JUMP_FRAMES;
        bot._zipJumpOrigY = bot.y;
        bot._zipJumpOrigSpeed = bot.speed;
        bot._zipJumpOrigRadius = bot.radius;
        bot._zipJumpOrigInterval = bot.shootInterval;
        bot.speed = 0;
        bot.radius = 0.1;
        bot.shootInterval = 999999;
        return true;
    }

    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + C_MAIN + ';"></div>' +
            '<span>Zıplayan</span>' +
            '<small>Hasar: 700→400→100<br>Güç: Seken Dash + Can<br>Ulti: Zıplatma</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function clearZipState() {
        zipBullets = [];
        zipTexts = [];
        zipParticles = [];
        zipSparks = [];
        dashState = { active: false, vx: 0, vy: 0, bouncesLeft: 0, hitTargets: new Set(), remainingRange: 0 };
        ultiState = { active: false, startX: 0, startY: 0, targetX: 0, targetY: 0, progress: 0 };
        healReady = false;
        player.isJumping = false;
        player.jumpInvulnerable = false;
        getActiveEnemies().forEach(b => {
            if (b._zipJumpActive) {
                b._zipJumpActive = false;
                b.y = b._zipJumpOrigY || b.y;
                b.speed = b._zipJumpOrigSpeed || b.speed;
                b.radius = b._zipJumpOrigRadius || b.radius;
                b.shootInterval = b._zipJumpOrigInterval || b.shootInterval;
            }
        });
    }

    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            clearZipState();
            this.reloadSpeed = RELOAD_SPEED;
            if (gadgetBtn) {
                gadgetBtn.style.display = 'flex';
                gadgetBtn.innerHTML = 'SEKEN<br>DASH<br><span id="gadget-timer"></span>';
                gadgetBtn.classList.remove('cooldown');
            }
            if (gadgetBtn2) {
                gadgetBtn2.style.display = 'flex';
                gadgetBtn2.innerHTML = 'DUVARDA<br>CAN<br><span id="gadget-timer-2"></span>';
                gadgetBtn2.classList.remove('cooldown');
            }
            if (ultiBtn) {
                ultiBtn.style.display = 'flex';
                ultiBtn.style.background = 'radial-gradient(circle, ' + C_MAIN + ', #4a235a)';
            }
            gadgetTimerText = document.getElementById('gadget-timer');
            gadgetTimerText2 = document.getElementById('gadget-timer-2');
        } else {
            clearZipState();
            if (ultiBtn) ultiBtn.style.background = '';
            if (this.reloadSpeed === RELOAD_SPEED) this.reloadSpeed = 0.015;
        }
    };

    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        if (this.ammo < 1 || this.isDead || ultiState.active) return;
        zipBullets.push({
            x: this.x, y: this.y, sx: this.x, sy: this.y,
            vx: Math.cos(a) * BULLET_SPEED,
            vy: Math.sin(a) * BULLET_SPEED,
            angle: a, botHits: 0, wallHits: 0,
            hitTargets: new Set(),
            remainingRange: BULLET_RANGE,
            isDead: false, trail: [],
            healThisShot: healReady ? HEAL_MAX : 0,
            showHeal: healReady
        });
        if (healReady) healReady = false;
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead || dashState.active || ultiState.active) return;
        const ang = a !== undefined ? a : this.angle;
        dashState.active = true;
        dashState.vx = Math.cos(ang) * DASH_SPEED;
        dashState.vy = Math.sin(ang) * DASH_SPEED;
        dashState.bouncesLeft = DASH_MAX_BOUNCE;
        dashState.hitTargets = new Set();
        dashState.remainingRange = DASH_LEG;
        this.gadgetReady = false;
        this.gadgetCooldown = DASH_COOLDOWN;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(DASH_COOLDOWN / 60) + "s";
        sparkBurst(this.x, this.y, 8, C_MAIN);
    };

    const originalActivateGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        healReady = true;
        this.gadget2Ready = false;
        this.gadget2Cooldown = HEAL_COOLDOWN;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(HEAL_COOLDOWN / 60) + "s";
    };

    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pull);
        if (pull === undefined) return;
        if (!this.ultReady || this.isDead || ultiState.active || dashState.active) return;
        const pullMag = pull > 0.05 ? pull : 1;
        const dist = ULTI_PLACE_MIN + (ULTI_PLACE_MAX - ULTI_PLACE_MIN) * pullMag;
        const tx = clampPos(this.x + Math.cos(a) * dist, WALL_THICKNESS + 30, canvas.width - WALL_THICKNESS - 30);
        const ty = clampPos(this.y + Math.sin(a) * dist, WALL_THICKNESS + 30, canvas.height - WALL_THICKNESS - 30);
        ultiState.active = true;
        ultiState.startX = this.x;
        ultiState.startY = this.y;
        ultiState.targetX = tx;
        ultiState.targetY = ty;
        ultiState.progress = 0;
        // Base jump animasyonu
        this.isJumping = true;
        this.jumpInvulnerable = true;
        this.jumpProgress = 0;
        this.jumpDuration = 9999999;
        this.jumpStartX = this.x;
        this.jumpStartY = this.y;
        this.jumpTargetX = tx;
        this.jumpTargetY = ty;
        this.jumpDamage = 0;
        this.jumpKnockback = 0;
        this.jumpLabel = "";
        zipText(this.x, this.y - 40, "ZIPLAT!", true);
        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    chainHook('onChargeUlti', function (amount) {
        if (player.charType !== CHAR_ID) return;
        if (!gameStarted || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount * 0.5);
        if (player.ultCharge >= 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
        }
        if (ultFill) ultFill.style.width = player.ultCharge + "%";
    });

    chainHook('onReset', function () { clearZipState(); });

    // Base aim çizgisini blokla
    chainHook('onPreDraw', function (ctx2) {
        if (player.charType === CHAR_ID && aimData.active && !player.isDead && !dashState.active) {
            player._zipHideBaseAim = true;
            aimData.active = false;
        }
    });

    chainHook('onPostDraw', function (ctx2) {
        if (player._zipHideBaseAim) {
            aimData.active = true;
            player._zipHideBaseAim = false;
        }
    });

    function ultiDragStart(cx, cy) {
        if (!player.ultReady || player.isDead || player.charType !== CHAR_ID) return;
        const r = ultiBtn.getBoundingClientRect();
        ultiDrag.active = true;
        ultiDrag.startX = r.left + r.width / 2;
        ultiDrag.startY = r.top + r.height / 2;
        ultiDrag.angle = player.angle;
        ultiDrag.pull = 0;
    }
    function ultiDragMove(cx, cy) {
        if (!ultiDrag.active) return;
        ultiDrag.angle = Math.atan2(cy - ultiDrag.startY, cx - ultiDrag.startX);
        ultiDrag.pull = Math.min(1, Math.hypot(cx - ultiDrag.startX, cy - ultiDrag.startY) / 160);
    }
    function ultiDragEnd() {
        if (!ultiDrag.active) return;
        ultiDrag.active = false;
        player.fireUlti(ultiDrag.angle, ultiDrag.pull);
    }

    ultiBtn.addEventListener('touchstart', e => {
        if (player.charType !== CHAR_ID) return;
        e.preventDefault(); e.stopImmediatePropagation();
        const t = e.changedTouches[0];
        ultiDrag.touchId = t.identifier;
        ultiDragStart(t.clientX, t.clientY);
    }, { capture: true, passive: false });

    window.addEventListener('touchmove', e => {
        if (!ultiDrag.active || player.charType !== CHAR_ID) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === ultiDrag.touchId)
                ultiDragMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        }
    }, { passive: false });

    window.addEventListener('touchend', e => {
        if (!ultiDrag.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === ultiDrag.touchId) ultiDragEnd();
        }
    });

    ultiBtn.addEventListener('mousedown', e => {
        if (player.charType !== CHAR_ID) return;
        e.preventDefault(); e.stopImmediatePropagation();
        ultiDrag.isMouse = true;
        ultiDragStart(e.clientX, e.clientY);
    }, { capture: true });

    window.addEventListener('mousemove', e => {
        if (ultiDrag.active && ultiDrag.isMouse) ultiDragMove(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
        if (ultiDrag.active && ultiDrag.isMouse) {
            ultiDrag.isMouse = false;
            ultiDragEnd();
        }
    });

    let lastT = 0;
    function zipLoop(t) {
        if (!lastT) lastT = t;
        const ts = Math.min(3, (t - lastT) / 16.666);
        lastT = t;
        if (gameStarted) {
            try { zipUpdate(ts); } catch (err) { console.error('[ZIP]', err); }
        }
        requestAnimationFrame(zipLoop);
    }
    requestAnimationFrame(zipLoop);

    function zipUpdate(ts) {
        if (player.charType === CHAR_ID) {
            if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
            if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
            if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';
        }

        // ===== Bot zıplatma — 1. Geçiş: hareket + iniş zamanlaması =====
        const landingBots = [];
        getActiveEnemies().forEach(e => {
            if (e._zipJumpActive) {
                e._zipJumpTimer -= ts;
                if (e._zipJumpTimer <= 0) {
                    landingBots.push(e);
                } else {
                    const prog = 1 - (e._zipJumpTimer / BOT_JUMP_FRAMES);
                    const jumpH = Math.sin(prog * Math.PI);
                    e.y = Math.max(WALL_THICKNESS + 20, e._zipJumpOrigY - jumpH * BOT_JUMP_HEIGHT);
                }
            }
        });
        // ===== Bot zıplatma — 2. Geçiş: iniş restore =====
        landingBots.forEach(e => {
            e._zipJumpActive = false;
            e.y = e._zipJumpOrigY;
            e.speed = e._zipJumpOrigSpeed;
            e.radius = e._zipJumpOrigRadius;
            e.shootInterval = e._zipJumpOrigInterval;
        });
        // ===== Bot zıplatma — 3. Geçiş: iniş AoE =====
        landingBots.forEach(e => {
            getActiveEnemies().forEach(other => {
                if (other === e || other.isDead) return;
                const otherY = other._zipJumpActive ? other._zipJumpOrigY : other.y;
                const otherRadius = other._zipJumpActive ? other._zipJumpOrigRadius : other.radius;
                const dist = Math.hypot(e.x - other.x, e.y - otherY);
                if (dist < BOT_JUMP_AOE_RADIUS + otherRadius) {
                    other.hp -= BOT_JUMP_AOE_DMG;
                    addFloatingNumber(other.x, otherY, BOT_JUMP_AOE_DMG, C_MAIN);
                }
            });
            zipSparks.push({ x: e.x, y: e.y, radius: 5, targetRadius: BOT_JUMP_AOE_RADIUS, life: 15, maxLife: 15 });
            sparkBurst(e.x, e.y, 8, C_MAIN);
        });

        // ===== Dash =====
        if (dashState.active && !player.isDead) {
            const stepX = dashState.vx * ts;
            const stepY = dashState.vy * ts;
            player.x += stepX;
            player.y += stepY;
            dashState.remainingRange -= Math.hypot(stepX, stepY);

            getActiveEnemies().forEach(e => {
                if (dashState.hitTargets.has(e)) return;
                if (getDist(player, e) < e.radius + player.radius + 5) {
                    dashState.hitTargets.add(e);
                    e.hp -= DASH_DAMAGE;
                    addFloatingNumber(e.x, e.y, DASH_DAMAGE, C_MAIN);
                    sparkBurst(e.x, e.y, 5, C_SPARK);
                }
            });

            let bounced = false;
            if (player.x < WALL_THICKNESS + player.radius) { player.x = WALL_THICKNESS + player.radius; dashState.vx = Math.abs(dashState.vx); bounced = true; }
            else if (player.x > canvas.width - WALL_THICKNESS - player.radius) { player.x = canvas.width - WALL_THICKNESS - player.radius; dashState.vx = -Math.abs(dashState.vx); bounced = true; }
            if (player.y < WALL_THICKNESS + player.radius) { player.y = WALL_THICKNESS + player.radius; dashState.vy = Math.abs(dashState.vy); bounced = true; }
            else if (player.y > canvas.height - WALL_THICKNESS - player.radius) { player.y = canvas.height - WALL_THICKNESS - player.radius; dashState.vy = -Math.abs(dashState.vy); bounced = true; }

            obstacles.concat(cactusWalls || []).forEach(o => {
                if (getDist(player, o) < o.radius + player.radius) {
                    const ang = getAngle(o, player);
                    const nx = Math.cos(ang), ny = Math.sin(ang);
                    const dot = dashState.vx * nx + dashState.vy * ny;
                    dashState.vx -= 2 * dot * nx;
                    dashState.vy -= 2 * dot * ny;
                    const overlap = o.radius + player.radius - getDist(player, o);
                    player.x += nx * overlap;
                    player.y += ny * overlap;
                    bounced = true;
                }
            });

            if (bounced) {
                dashState.bouncesLeft--;
                dashState.remainingRange = DASH_LEG;
                sparkBurst(player.x, player.y, 6, C_SPARK);
                if (dashState.bouncesLeft <= 0) {
                    dashState.active = false;
                    sparkBurst(player.x, player.y, 10, C_MAIN);
                }
            }
            if (dashState.remainingRange <= 0) {
                dashState.active = false;
                sparkBurst(player.x, player.y, 8, C_MAIN);
            }
        }

        // ===== Ulti zıplama (base flag senkronize) =====
        if (ultiState.active && !player.isDead) {
            ultiState.progress += ts / ULTI_AIR_TIME;
            const t = Math.min(1, ultiState.progress);
            player.isJumping = true;
            player.jumpInvulnerable = true;
            player.jumpProgress = t;
            player.x = ultiState.startX + (ultiState.targetX - ultiState.startX) * t;
            player.y = ultiState.startY + (ultiState.targetY - ultiState.startY) * t;

            if (ultiState.progress >= 1) {
                player.x = ultiState.targetX;
                player.y = ultiState.targetY;
                player.jumpInvulnerable = false;
                player.isJumping = false;
                ultiState.active = false;

                let jumped = 0;
                const inRange = [];
                getActiveEnemies().forEach(e => {
                    if (getDist(player, e) < ULTI_RADIUS + e.radius) inRange.push(e);
                });
                inRange.sort((a, b) => getDist(player, a) - getDist(player, b));
                inRange.slice(0, ULTI_JUMP_MAX).forEach(e => {
                    e.hp -= ULTI_DAMAGE;
                    addFloatingNumber(e.x, e.y, ULTI_DAMAGE, C_MAIN);
                    if (triggerBotJump(e)) jumped++;
                });

                if (jumped > 0) {
                    const ultiGain = jumped * ULTI_PER_BOT_ULTI;
                    const healGain = jumped * ULTI_PER_BOT_HEAL;
                    if (!player.ultReady) {
                        player.ultCharge = Math.min(100, player.ultCharge + ultiGain);
                        if (player.ultCharge >= 100) {
                            player.ultReady = true;
                            if (ultiBtn) ultiBtn.classList.add('ready');
                        }
                        if (ultFill) ultFill.style.width = player.ultCharge + "%";
                    }
                    player.hp = Math.min(player.maxHp, player.hp + healGain);
                }

                zipSparks.push({ x: player.x, y: player.y, radius: 10, targetRadius: ULTI_RADIUS, life: 20, maxLife: 20 });
                sparkBurst(player.x, player.y, 20, C_MAIN);
                screenShake = 8;
            }
        }

        // ===== Mermiler =====
        for (let i = zipBullets.length - 1; i >= 0; i--) {
            const b = zipBullets[i];
            if (b.isDead) { zipBullets.splice(i, 1); continue; }

            const stepX = b.vx * ts;
            const stepY = b.vy * ts;
            b.x += stepX;
            b.y += stepY;
            b.remainingRange -= Math.hypot(stepX, stepY);

            b.trail.push({ x: b.x, y: b.y, life: 15 });
            if (b.trail.length > 12) b.trail.shift();

            if (b.x < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS ||
                b.y < WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) {
                let bounced = false;
                if (b.x < WALL_THICKNESS) { b.x = WALL_THICKNESS; b.vx = Math.abs(b.vx); bounced = true; }
                if (b.x > canvas.width - WALL_THICKNESS) { b.x = canvas.width - WALL_THICKNESS; b.vx = -Math.abs(b.vx); bounced = true; }
                if (b.y < WALL_THICKNESS) { b.y = WALL_THICKNESS; b.vy = Math.abs(b.vy); bounced = true; }
                if (b.y > canvas.height - WALL_THICKNESS) { b.y = canvas.height - WALL_THICKNESS; b.vy = -Math.abs(b.vy); bounced = true; }
                if (bounced) {
                    b.wallHits++;
                    b.angle = Math.atan2(b.vy, b.vx);
                    b.remainingRange = WALL_RANGE;
                    sparkBurst(b.x, b.y, 3, C_SPARK);
                    if (b.showHeal && b.healThisShot > 0) {
                        const heal = Math.min(HEAL_PER_WALL, b.healThisShot);
                        b.healThisShot -= heal;
                        player.hp = Math.min(player.maxHp, player.hp + heal);
                    }
                    if (b.wallHits >= MAX_WALL_HITS) {
                        b.isDead = true;
                        sparkBurst(b.x, b.y, 5, C_MAIN);
                        continue;
                    }
                }
            }

            let obsHit = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(b, o) < o.radius + 8) {
                    o.hp -= SIIPER_HASAR;
                    const ang = getAngle(o, b);
                    const nx = Math.cos(ang), ny = Math.sin(ang);
                    const dot = b.vx * nx + b.vy * ny;
                    b.vx -= 2 * dot * nx;
                    b.vy -= 2 * dot * ny;
                    b.angle = Math.atan2(b.vy, b.vx);
                    b.remainingRange = WALL_RANGE;
                    b.wallHits++;
                    obsHit = true;
                    sparkBurst(b.x, b.y, 4, C_SPARK);
                    if (b.showHeal && b.healThisShot > 0) {
                        const heal = Math.min(HEAL_PER_WALL, b.healThisShot);
                        b.healThisShot -= heal;
                        player.hp = Math.min(player.maxHp, player.hp + heal);
                    }
                    if (b.wallHits >= MAX_WALL_HITS) {
                        b.isDead = true;
                        sparkBurst(b.x, b.y, 5, C_MAIN);
                    }
                    break;
                }
            }
            if (b.isDead) continue;

            let botHit = null;
            for (const e of getActiveEnemies()) {
                if (b.hitTargets.has(e)) continue;
                if (e._zipJumpActive) continue;
                if (getDist(b, e) < e.radius + 10) { botHit = e; break; }
            }

            if (botHit) {
                b.hitTargets.add(botHit);
                b.botHits++;
                const dmg = b.botHits === 1 ? DMG_1 : b.botHits === 2 ? DMG_2 : DMG_3;
                botHit.hp -= dmg;
                addFloatingNumber(botHit.x, botHit.y, dmg, C_MAIN);
                sparkBurst(botHit.x, botHit.y, 6, C_SPARK);

                if (b.botHits >= MAX_BOT_HITS) {
                    b.isDead = true;
                    sparkBurst(b.x, b.y, 8, C_MAIN);
                    continue;
                }

                let nearest = null, nearestDist = Infinity;
                getActiveEnemies().forEach(e => {
                    if (b.hitTargets.has(e) || e.isDead || e._zipJumpActive) return;
                    const d = getDist(b, e);
                    if (d < BULLET_RANGE && d < nearestDist) { nearestDist = d; nearest = e; }
                });

                if (nearest) {
                    const ang = Math.atan2(nearest.y - b.y, nearest.x - b.x);
                    b.vx = Math.cos(ang) * BULLET_SPEED;
                    b.vy = Math.sin(ang) * BULLET_SPEED;
                    b.angle = ang;
                    b.remainingRange = BULLET_RANGE;
                } else {
                    b.isDead = true;
                    sparkBurst(b.x, b.y, 6, C_MAIN);
                }
            }

            if (b.remainingRange <= 0 && !b.isDead) {
                b.isDead = true;
                sparkBurst(b.x, b.y, 4, C_MAIN);
            }
        }

        zipBullets.forEach(b => {
            for (let i = b.trail.length - 1; i >= 0; i--) {
                b.trail[i].life -= ts;
                if (b.trail[i].life <= 0) b.trail.splice(i, 1);
            }
        });

        for (let i = zipParticles.length - 1; i >= 0; i--) {
            const p = zipParticles[i];
            p.x += p.vx * ts; p.y += p.vy * ts;
            p.vy += p.gravity * ts;
            p.vx *= 0.95; p.vy *= 0.95;
            p.life -= ts;
            if (p.life <= 0) zipParticles.splice(i, 1);
        }

        for (let i = zipTexts.length - 1; i >= 0; i--) {
            const t = zipTexts[i];
            t.y -= 0.7 * ts;
            t.life -= ts;
            if (t.life <= 0) zipTexts.splice(i, 1);
        }

        for (let i = zipSparks.length - 1; i >= 0; i--) {
            const s = zipSparks[i];
            const prog = 1 - (s.life / s.maxLife);
            s.radius = s.targetRadius * prog;
            s.life -= ts;
            if (s.life <= 0) zipSparks.splice(i, 1);
        }
    }

    // ===== Çizim =====
    chainHook('onDraw', function (ctx2) {
        // Zıplayan botlar — shadow + büyük görsel overlay
        getActiveEnemies().forEach(e => {
            if (e._zipJumpActive) {
                const prog = 1 - Math.max(0, e._zipJumpTimer / BOT_JUMP_FRAMES);
                const jumpH = Math.sin(prog * Math.PI);
                const origRadius = e._zipJumpOrigRadius || 20;
                
                // Shadow at ground level
                ctx2.save();
                ctx2.globalAlpha = 0.55 * (1 - jumpH * 0.7);
                ctx2.beginPath();
                ctx2.ellipse(e.x, e._zipJumpOrigY + origRadius * 0.4,
                             origRadius * (0.9 + jumpH * 0.3),
                             origRadius * 0.35, 0, 0, Math.PI * 2);
                ctx2.fillStyle = 'rgba(0,0,0,0.6)';
                ctx2.fill();
                ctx2.restore();
                
                // Bot overlay at elevated position
                const scale = 1 + jumpH * 0.3;
                ctx2.save();
                ctx2.translate(e.x, e.y);
                ctx2.scale(scale, scale);
                ctx2.rotate(e.angle || 0);
                ctx2.beginPath();
                ctx2.arc(0, 0, origRadius, 0, Math.PI * 2);
                ctx2.fillStyle = e.color || C_MAIN;
                ctx2.fill();
                ctx2.beginPath();
                ctx2.arc(origRadius - 4, 0, 4, 0, Math.PI * 2);
                ctx2.fillStyle = 'rgba(0,0,0,0.4)';
                ctx2.fill();
                ctx2.beginPath();
                ctx2.arc(0, 0, origRadius, 0, Math.PI * 2);
                ctx2.strokeStyle = C_SPARK;
                ctx2.lineWidth = 2.5;
                ctx2.stroke();
                ctx2.restore();
            }
        });

        if (dashState.active && player.charType === CHAR_ID) {
            ctx2.save();
            ctx2.globalAlpha = 0.5;
            ctx2.beginPath();
            ctx2.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
            ctx2.strokeStyle = C_SPARK;
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.restore();
        }

        // ===== Ana saldırı ince nişan çizgisi =====
        if (player.charType === CHAR_ID && player._zipHideBaseAim && !player.isDead && player.ammo >= 1) {
            const ang = aimData.angle;
            const endX = player.x + Math.cos(ang) * BULLET_RANGE;
            const endY = player.y + Math.sin(ang) * BULLET_RANGE;
            ctx2.save();
            ctx2.beginPath();
            ctx2.moveTo(player.x, player.y);
            ctx2.lineTo(endX, endY);
            ctx2.strokeStyle = 'rgba(142,68,173,0.65)';
            ctx2.lineWidth = 1.5;
            ctx2.setLineDash([12, 8]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.beginPath();
            ctx2.arc(endX, endY, 4, 0, Math.PI * 2);
            ctx2.fillStyle = C_MAIN;
            ctx2.fill();
            ctx2.strokeStyle = C_SPARK;
            ctx2.lineWidth = 1.5;
            ctx2.stroke();
            ctx2.restore();
        }

        // ===== Dash nişan çizgisi =====
        if (player.charType === CHAR_ID && gadAim.active && player.gadgetReady && !player.isDead && !dashState.active) {
            const ang = gadAim.angle;
            const startX = player.x, startY = player.y;
            const endX = startX + Math.cos(ang) * DASH_LEG;
            const endY = startY + Math.sin(ang) * DASH_LEG;
            ctx2.save();
            ctx2.beginPath();
            ctx2.moveTo(startX, startY);
            ctx2.lineTo(endX, endY);
            ctx2.strokeStyle = 'rgba(142,68,173,0.7)';
            ctx2.lineWidth = 1.5;
            ctx2.setLineDash([12, 8]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.beginPath();
            ctx2.arc(endX, endY, 6, 0, Math.PI * 2);
            ctx2.fillStyle = C_MAIN;
            ctx2.fill();
            ctx2.strokeStyle = C_SPARK;
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.restore();
        }

        // Mermiler
        zipBullets.forEach(b => {
            b.trail.forEach(pt => {
                const alpha = (pt.life / 15) * 0.5;
                ctx2.save();
                ctx2.globalAlpha = alpha;
                ctx2.beginPath();
                ctx2.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
                ctx2.fillStyle = C_LIGHT;
                ctx2.fill();
                ctx2.restore();
            });

            ctx2.save();
            ctx2.translate(b.x, b.y);
            const grad = ctx2.createRadialGradient(0, 0, 0, 0, 0, 12);
            grad.addColorStop(0, C_WHITE);
            grad.addColorStop(0.4, C_LIGHT);
            grad.addColorStop(1, 'rgba(142,68,173,0)');
            ctx2.beginPath(); ctx2.arc(0, 0, 12, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();
            ctx2.rotate(b.angle);
            ctx2.beginPath();
            ctx2.moveTo(8, 0); ctx2.lineTo(-6, -4); ctx2.lineTo(-6, 4);
            ctx2.closePath();
            ctx2.fillStyle = C_MAIN;
            ctx2.fill();
            ctx2.restore();
        });

        // Ulti hedef göstergesi
        if (ultiState.active && player.charType === CHAR_ID) {
            ctx2.save();
            ctx2.globalAlpha = 0.4;
            ctx2.beginPath();
            ctx2.arc(ultiState.targetX, ultiState.targetY, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.strokeStyle = C_MAIN;
            ctx2.lineWidth = 3;
            ctx2.setLineDash([8, 6]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.restore();
        }

        // Sparks
        zipSparks.forEach(s => {
            const alpha = s.life / s.maxLife;
            ctx2.save();
            ctx2.globalAlpha = alpha;
            ctx2.beginPath();
            ctx2.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx2.strokeStyle = C_MAIN;
            ctx2.lineWidth = 4;
            ctx2.stroke();
            ctx2.beginPath();
            ctx2.arc(s.x, s.y, s.radius * 0.7, 0, Math.PI * 2);
            ctx2.strokeStyle = C_SPARK;
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.restore();
        });

        zipParticles.forEach(p => {
            const alpha = Math.min(1, p.life / 15);
            ctx2.save();
            ctx2.globalAlpha = alpha;
            ctx2.beginPath();
            ctx2.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx2.fillStyle = p.color;
            ctx2.fill();
            ctx2.restore();
        });

        zipTexts.forEach(t => {
            const alpha = Math.min(1, t.life / 20);
            ctx2.save();
            ctx2.globalAlpha = alpha;
            ctx2.font = t.isLabel ? 'bold 15px Arial' : 'bold 12px Arial';
            ctx2.textAlign = 'center';
            ctx2.fillStyle = C_LIGHT;
            ctx2.strokeStyle = 'rgba(30,10,40,0.9)';
            ctx2.lineWidth = 3;
            ctx2.strokeText(t.val, t.x, t.y);
            ctx2.fillText(t.val, t.x, t.y);
            ctx2.restore();
        });

        // Ulti drag göstergesi
        if (player.charType === CHAR_ID && ultiDrag.active && player.ultReady && !player.isDead) {
            const pullMag = ultiDrag.pull < 0.05 ? 1 : ultiDrag.pull;
            const dist = ULTI_PLACE_MIN + (ULTI_PLACE_MAX - ULTI_PLACE_MIN) * pullMag;
            const tx = clampPos(player.x + Math.cos(ultiDrag.angle) * dist, WALL_THICKNESS + 30, canvas.width - WALL_THICKNESS - 30);
            const ty = clampPos(player.y + Math.sin(ultiDrag.angle) * dist, WALL_THICKNESS + 30, canvas.height - WALL_THICKNESS - 30);
            ctx2.save();
            ctx2.beginPath();
            ctx2.moveTo(player.x, player.y);
            ctx2.lineTo(tx, ty);
            ctx2.strokeStyle = 'rgba(142,68,173,0.6)';
            ctx2.lineWidth = 3;
            ctx2.setLineDash([8, 6]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.beginPath();
            ctx2.arc(tx, ty, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(142,68,173,0.15)';
            ctx2.fill();
            ctx2.strokeStyle = C_MAIN;
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.restore();
        }
    });
})();