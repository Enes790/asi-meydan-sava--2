// ========== mod30.js (KISKAÇ) - v2 FINAL ==========
// - Ana Saldırı: 2 paralel mermi, 300 hasar, kıskaç bonusu 750 (birleşik "KISKAÇ! 750" yazısı)
// - Her mermi 100 can verir (2 mermi aynı bota = 200 can birleşik)
// - Reload: Ninja seviyesi (0.015)
// - Zehir Mermisi: homing, 300 + 3s DoT (splash'lı)
// - Kum Fırtınası: mermi takip, 10 itme + 300 hasar
// - Ulti: Zıplayan mermi, alan küçültme 5s
// - Nişan çizgisi: içi boş beyaz dikdörtgen

(function () {
    'use strict';

    const CHAR_ID = 'kiskac';
    const C_MAIN = '#d35400';
    const C_DARK = '#2c3e50';
    const C_ACCENT = '#e67e22';
    const C_LIGHT = '#f5b041';
    const C_WHITE = '#ffffff';
    const C_POISON = '#27ae60';
    const C_SHRINK = '#8e44ad';
    
    const CHAR_HP = 2600;
    const CHAR_SPEED = 5.1;
    
    // ===== ANA SALDIRI =====
    const BULLET_COUNT = 2;
    const BULLET_DMG = 300;
    const BULLET_BONUS_DMG = 450;       // Kıskaç bonusu
    const BULLET_HEAL = 100;            // Her mermi için
    const BULLET_SPEED = PLAYER_BULLET_SPEED * 0.9;
    const BULLET_RANGE = 300;
    const BULLET_OFFSET = 15;
    const RELOAD_SPEED = 0.015;
    
    // ===== ZEHİR MERMİSİ (Aks 1) =====
    const POISON_DMG = 300;
    const POISON_DOT_TICK = 100;        // saniyede bir tick
    const POISON_DOT_TICKS = 3;         // 3 tick = 3s
    const POISON_SPLASH_R = 80;
    const POISON_BULLET_SPEED = PLAYER_BULLET_SPEED * 0.75;
    const POISON_CD = 540;              // 9s
    const POISON_HOMING = 0.08;
    
    // ===== KUM FIRTINASI (Aks 2) =====
    const STORM_DMG = 300;
    const STORM_PUSH = 10;
    const STORM_RADIUS = 50;
    const STORM_SPEED = PLAYER_BULLET_SPEED * 0.8;
    const STORM_DURATION = 360;         // 6s
    const STORM_TICK = 18;              // 0.3s = 18 frames
    const STORM_CD = 660;               // 11s
    const STORM_FLIGHT_TIME = 40;
    
    // ===== ULTİ =====
    const ULTI_RADIUS = 90;
    const ULTI_DURATION = 300;          // 5s
    const ULTI_FLIGHT_TIME = 40;
    const ULTI_PLACE_MAX = 280;
    const ULTI_PLACE_MIN = 80;
    
    // ===== DEBUFF =====
    const SHRINK_SPEED_MULT = 0.6;
    const SHRINK_DMG_TAKEN = 1.5;
    const SHRINK_RADIUS_MULT = 0.7;

    window.GAME_EXT.characters[CHAR_ID] = { color: C_MAIN, hp: CHAR_HP, speed: CHAR_SPEED };

    let kiskacBullets = [];
    let poisonBullet = null;
    let poisonTargets = [];
    let storm = null;
    let stormBulletFlight = null;
    let ultiProjectile = null;
    let ultiZone = null;
    let ultiDrag = { active: false, startX: 0, startY: 0, angle: 0, pull: 0, touchId: null, isMouse: false };
    let kiskacFX = [];
    let kiskacTexts = [];
    let poisonReady = true;
    let poisonCD = 0;
    let stormReady = true;
    let stormCD = 0;

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
        kiskacTexts.push({ x, y, val: v, life: 55, maxLife: 55, isLabel: !!l, color: col || C_LIGHT });
    }

    function burst(x, y, n, c) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
            kiskacFX.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 1.5 + Math.random() * 2, life: 15 + Math.random() * 15, maxLife: 30, color: c, gravity: 0.05 });
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
            '<span>Kıskaç</span>' +
            '<small>Hasar: 2×300 (kıskaç 750)<br>Güç: Zehir + Fırtına<br>Ulti: Alan Küçültme</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function clearAll() {
        kiskacBullets = []; poisonBullet = null; poisonTargets = [];
        storm = null; stormBulletFlight = null;
        ultiProjectile = null; ultiZone = null;
        kiskacFX = []; kiskacTexts = [];
        poisonReady = true; poisonCD = 0;
        stormReady = true; stormCD = 0;
        getActiveEnemies().forEach(b => {
            if (b._shrinkOrig) {
                b.speed = b._shrinkOrig.speed;
                b.radius = b._shrinkOrig.radius;
                delete b._shrinkOrig;
            }
        });
    }

    const origSet = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        origSet.call(this, type);
        if (type === CHAR_ID) {
            clearAll();
            this.reloadSpeed = RELOAD_SPEED;
            if (gadgetBtn) { gadgetBtn.style.display = 'flex'; gadgetBtn.innerHTML = 'ZEHİR<br><span id="gadget-timer"></span>'; gadgetBtn.classList.remove('cooldown'); }
            if (gadgetBtn2) { gadgetBtn2.style.display = 'flex'; gadgetBtn2.innerHTML = 'FIRTINA<br><span id="gadget-timer-2"></span>'; gadgetBtn2.classList.remove('cooldown'); }
            if (ultiBtn) { ultiBtn.style.display = 'flex'; ultiBtn.style.background = 'radial-gradient(circle, ' + C_MAIN + ', ' + C_DARK + ')'; }
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
        if (this.ammo < 1 || this.isDead || ultiZone) return;
        if (!Number.isFinite(a)) a = this.angle || 0;

        const perpAngle = a + Math.PI / 2;
        const cosP = Math.cos(perpAngle), sinP = Math.sin(perpAngle);

        [-BULLET_OFFSET / 2, BULLET_OFFSET / 2].forEach(off => {
            const sx = this.x + cosP * off;
            const sy = this.y + sinP * off;
            kiskacBullets.push({
                x: sx, y: sy, sx, sy,
                vx: Math.cos(a) * BULLET_SPEED,
                vy: Math.sin(a) * BULLET_SPEED,
                angle: a,
                isDead: false,
                trail: [],
                clawOpen: 1
            });
        });

        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ===== ZEHİR MERMİSİ (Aks 1) =====
    const origGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget.call(this, a, pull);
        if (!poisonReady || this.isDead || ultiZone || poisonBullet) return;
        const ang = safe(a, this.angle || 0);
        if (!Number.isFinite(ang)) return;
        poisonBullet = {
            x: this.x, y: this.y,
            vx: Math.cos(ang) * POISON_BULLET_SPEED,
            vy: Math.sin(ang) * POISON_BULLET_SPEED,
            angle: ang,
            isDead: false,
            trail: []
        };
        poisonReady = false;
        poisonCD = POISON_CD;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(POISON_CD / 60) + "s";
        burst(this.x, this.y, 6, C_POISON);
    };

    // ===== KUM FIRTINASI (Aks 2) =====
    const origGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget2.call(this, a, pull);
        if (!stormReady || this.isDead || ultiZone || stormBulletFlight || storm) return;
        const ang = safe(a, this.angle || 0);
        if (!Number.isFinite(ang)) return;
        const dist = 180;
        const tx = clampPos(this.x + Math.cos(ang) * dist, WALL_THICKNESS + 30, canvas.width - WALL_THICKNESS - 30);
        const ty = clampPos(this.y + Math.sin(ang) * dist, WALL_THICKNESS + 30, canvas.height - WALL_THICKNESS - 30);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
        stormBulletFlight = {
            x: this.x, y: this.y,
            startX: this.x, startY: this.y,
            targetX: tx, targetY: ty,
            progress: 0,
            duration: STORM_FLIGHT_TIME
        };
        stormReady = false;
        stormCD = STORM_CD;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(STORM_CD / 60) + "s";
        burst(this.x, this.y, 6, C_ACCENT);
    };

    // ===== ULTİ =====
    const origUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return origUlti.call(this, a, pull);
        if (!Number.isFinite(a)) a = this.angle || 0;
        if (!Number.isFinite(pull)) pull = 1;
        if (!this.ultReady || this.isDead || ultiZone || ultiProjectile) return;

        const pullMag = pull > 0.05 ? pull : 1;
        const dist = ULTI_PLACE_MIN + (ULTI_PLACE_MAX - ULTI_PLACE_MIN) * pullMag;
        const tx = clampPos(this.x + Math.cos(a) * dist, WALL_THICKNESS + 40, canvas.width - WALL_THICKNESS - 40);
        const ty = clampPos(this.y + Math.sin(a) * dist, WALL_THICKNESS + 40, canvas.height - WALL_THICKNESS - 40);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

        ultiProjectile = {
            x: this.x, y: this.y,
            startX: this.x, startY: this.y,
            targetX: tx, targetY: ty,
            progress: 0,
            duration: ULTI_FLIGHT_TIME
        };

        addText(this.x, this.y - 40, "KÜÇÜLT!", true, C_SHRINK);
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
        if (player.charType === CHAR_ID && aimData.active && !player.isDead) {
            player._kiskacHideAim = true;
            aimData.active = false;
        }
    });

    chainHook('onPostDraw', function (ctx2) {
        if (player._kiskacHideAim) {
            aimData.active = true;
            player._kiskacHideAim = false;
        }
    });

    // ===== ULTİ DRAG =====
    function uS(cx, cy) {
        if (player.charType !== CHAR_ID) return;
        if (!player.ultReady || player.isDead || ultiZone) return;
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
        if (gameStarted) { try { update(ts); } catch (e) { console.error('[KISKAC]', e); } }
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    function update(ts) {
        // NaN kurtarıcı
        if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) {
            player.x = canvas.width / 2;
            player.y = canvas.height / 2;
        }

        if (player.charType === CHAR_ID) {
            if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
            if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
            if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';
        }

        // Cooldown'lar
        if (poisonCD > 0) { poisonCD -= ts; if (poisonCD <= 0) { poisonCD = 0; poisonReady = true; if (gadgetBtn) gadgetBtn.classList.remove('cooldown'); if (gadgetTimerText) gadgetTimerText.innerText = ""; } }
        if (stormCD > 0) { stormCD -= ts; if (stormCD <= 0) { stormCD = 0; stormReady = true; if (gadgetBtn2) gadgetBtn2.classList.remove('cooldown'); if (gadgetTimerText2) gadgetTimerText2.innerText = ""; } }

        // ===== ULTİ PROJEKTİL =====
        if (ultiProjectile) {
            ultiProjectile.progress += ts / ultiProjectile.duration;
            if (ultiProjectile.progress >= 1) {
                ultiZone = {
                    x: ultiProjectile.targetX,
                    y: ultiProjectile.targetY,
                    radius: ULTI_RADIUS,
                    timer: ULTI_DURATION,
                    maxTimer: ULTI_DURATION
                };
                ultiProjectile = null;
                burst(ultiZone.x, ultiZone.y, 20, C_SHRINK);
                screenShake = 8;
                addText(ultiZone.x, ultiZone.y - 40, "KÜÇÜLDÜ!", true, C_SHRINK);
                // Alan içindeki botları küçült
                getActiveEnemies().forEach(e => {
                    if (getDist(ultiZone, e) < ULTI_RADIUS + e.radius) {
                        applyShrink(e);
                    }
                });
            }
        }

        // ===== ULTİ ALANI =====
        if (ultiZone) {
            ultiZone.timer -= ts;
            // Alan içine giren botlara küçültme uygula
            getActiveEnemies().forEach(e => {
                if (getDist(ultiZone, e) < ULTI_RADIUS + e.radius) {
                    if (!e._shrinkOrig) {
                        applyShrink(e);
                    }
                    // Süreyi yenile
                    e._shrinkUntil = Date.now() + 500;
                }
            });
            if (ultiZone.timer <= 0) {
                ultiZone = null;
            }
        }

        // Küçültme süresi kontrolü
        getActiveEnemies().forEach(e => {
            if (e._shrinkOrig && (!e._shrinkUntil || Date.now() > e._shrinkUntil)) {
                e.speed = e._shrinkOrig.speed;
                e.radius = e._shrinkOrig.radius;
                delete e._shrinkOrig;
                delete e._shrinkUntil;
            }
        });

        // ===== KUM FIRTINASI PROJEKTİL =====
        if (stormBulletFlight) {
            stormBulletFlight.progress += ts / stormBulletFlight.duration;
            if (stormBulletFlight.progress >= 1) {
                storm = {
                    x: stormBulletFlight.targetX,
                    y: stormBulletFlight.targetY,
                    radius: STORM_RADIUS,
                    timer: STORM_DURATION,
                    tickTimer: 0,
                    angle: 0
                };
                stormBulletFlight = null;
                burst(storm.x, storm.y, 10, C_ACCENT);
            }
        }

        // ===== KUM FIRTINASI =====
        if (storm) {
            storm.timer -= ts;
            storm.angle += 0.2 * ts;
            // Mermi takip
            if (kiskacBullets.length > 0) {
                const target = kiskacBullets[0];
                const ang = Math.atan2(target.y - storm.y, target.x - storm.x);
                storm.x += Math.cos(ang) * STORM_SPEED * ts;
                storm.y += Math.sin(ang) * STORM_SPEED * ts;
            } else {
                // Oyuncuya doğru yavaşça
                const ang = Math.atan2(player.y - storm.y, player.x - storm.x);
                const d = getDist(storm, player);
                if (d > 80) {
                    storm.x += Math.cos(ang) * STORM_SPEED * 0.4 * ts;
                    storm.y += Math.sin(ang) * STORM_SPEED * 0.4 * ts;
                }
            }
            storm.x = clampPos(storm.x, WALL_THICKNESS + 10, canvas.width - WALL_THICKNESS - 10);
            storm.y = clampPos(storm.y, WALL_THICKNESS + 10, canvas.height - WALL_THICKNESS - 10);

            storm.tickTimer += ts;
            if (storm.tickTimer >= STORM_TICK) {
                storm.tickTimer = 0;
                getActiveEnemies().forEach(e => {
                    if (getDist(storm, e) < STORM_RADIUS + e.radius) {
                        const ang = Math.atan2(e.y - storm.y, e.x - storm.x);
                        e.x += Math.cos(ang) * STORM_PUSH;
                        e.y += Math.sin(ang) * STORM_PUSH;
                        e.x = clampPos(e.x, e.radius + WALL_THICKNESS, canvas.width - e.radius - WALL_THICKNESS);
                        e.y = clampPos(e.y, e.radius + WALL_THICKNESS, canvas.height - e.radius - WALL_THICKNESS);
                        e.hp -= STORM_DMG;
                        addFloatingNumber(e.x, e.y, STORM_DMG, C_ACCENT);
                        burst(e.x, e.y, 4, C_LIGHT);
                    }
                });
            }
            if (storm.timer <= 0) {
                storm = null;
            }
        }

        // ===== ZEHİR MERMİSİ =====
        if (poisonBullet) {
            // Homing
            let nearest = null, nd = Infinity;
            getActiveEnemies().forEach(e => {
                if (e.isDead) return;
                const d = getDist(poisonBullet, e);
                if (d < 400 && d < nd) { nd = d; nearest = e; }
            });
            if (nearest) {
                const targetAng = Math.atan2(nearest.y - poisonBullet.y, nearest.x - poisonBullet.x);
                const currentAng = Math.atan2(poisonBullet.vy, poisonBullet.vx);
                let diff = targetAng - currentAng;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                const newAng = currentAng + Math.max(-POISON_HOMING, Math.min(POISON_HOMING, diff)) * ts;
                const spd = Math.hypot(poisonBullet.vx, poisonBullet.vy);
                poisonBullet.vx = Math.cos(newAng) * spd;
                poisonBullet.vy = Math.sin(newAng) * spd;
            }

            poisonBullet.x += poisonBullet.vx * ts;
            poisonBullet.y += poisonBullet.vy * ts;
            poisonBullet.trail.push({ x: poisonBullet.x, y: poisonBullet.y, life: 15 });
            if (poisonBullet.trail.length > 10) poisonBullet.trail.shift();

            // Çarpışma
            if (poisonBullet.x < WALL_THICKNESS || poisonBullet.x > canvas.width - WALL_THICKNESS ||
                poisonBullet.y < WALL_THICKNESS || poisonBullet.y > canvas.height - WALL_THICKNESS) {
                poisonBullet = null;
            } else {
                for (const e of getActiveEnemies()) {
                    if (e.isDead) continue;
                    if (getDist(poisonBullet, e) < e.radius + 12) {
                        // Zehirle
                        applyPoison(e);
                        burst(poisonBullet.x, poisonBullet.y, 8, C_POISON);
                        poisonBullet = null;
                        break;
                    }
                }
            }
        }

        // Zehir DoT
        for (let i = poisonTargets.length - 1; i >= 0; i--) {
            const p = poisonTargets[i];
            if (!p.bot || p.bot.isDead) { poisonTargets.splice(i, 1); continue; }
            p.timer -= ts;
            p.tickTimer = (p.tickTimer || 0) + ts;
            if (p.tickTimer >= 60) {
                p.tickTimer = 0;
                // Ana hedef hasar
                p.bot.hp -= POISON_DOT_TICK;
                addFloatingNumber(p.bot.x, p.bot.y, POISON_DOT_TICK, C_POISON);
                // Splash: yanındaki botlara aynı hasar (zehir bulaşmaz)
                getActiveEnemies().forEach(e => {
                    if (e === p.bot || e.isDead) return;
                    if (getDist(p.bot, e) < POISON_SPLASH_R + e.radius) {
                        e.hp -= POISON_DOT_TICK;
                        addFloatingNumber(e.x, e.y, POISON_DOT_TICK, C_POISON);
                    }
                });
            }
            if (p.timer <= 0) poisonTargets.splice(i, 1);
        }

        // ===== ANA MERMİLER (Kıskaç Bonusu Birleşik) =====
        const hitLog = [];

        for (let i = kiskacBullets.length - 1; i >= 0; i--) {
            const b = kiskacBullets[i];
            if (b.isDead) { kiskacBullets.splice(i, 1); continue; }

            b.x += b.vx * ts;
            b.y += b.vy * ts;
            b.trail.push({ x: b.x, y: b.y, life: 15 });
            if (b.trail.length > 12) b.trail.shift();
            b.clawOpen = Math.max(0.3, 1 - (getDist({ x: b.sx, y: b.sy }, b) / BULLET_RANGE) * 0.5);

            if (getDist({ x: b.sx, y: b.sy }, b) > BULLET_RANGE) { kiskacBullets.splice(i, 1); continue; }
            if (b.x < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS || b.y < WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) {
                kiskacBullets.splice(i, 1); continue;
            }

            let hit = null;
            for (const e of getActiveEnemies()) {
                if (e.isDead) continue;
                if (getDist(b, e) < e.radius + 8) { hit = e; break; }
            }

            if (hit) {
                // Bu frame'de aynı bota isabet var mı?
                let log = hitLog.find(h => h.bot === hit);
                const isDuplicate = !!log;
                const dmgMult = (hit._shrinkOrig && hit._shrinkUntil && Date.now() < hit._shrinkUntil) ? SHRINK_DMG_TAKEN : 1;
                const dmg = (isDuplicate ? BULLET_BONUS_DMG : BULLET_DMG) * dmgMult;

                if (!log) {
                    log = { bot: hit, damage: 0, heal: 0, isPincer: false };
                    hitLog.push(log);
                }
                log.damage += dmg;
                log.heal += BULLET_HEAL;
                if (isDuplicate) log.isPincer = true;

                hit.hp -= dmg;
                player.hp = Math.min(player.maxHp, player.hp + BULLET_HEAL);

                burst(b.x, b.y, 5, C_ACCENT);
                kiskacBullets.splice(i, 1);
            }
        }

        // Birleşik hasar yazıları
        hitLog.forEach(h => {
            if (h.bot.isDead) return;
            const label = h.isPincer ? "KISKAÇ! " : "";
            addText(h.bot.x, h.bot.y - 10, label + Math.round(h.damage), false, C_MAIN);
            if (h.heal > 0) {
                addText(player.x, player.y - 20, "+" + h.heal, false, "#2ecc71");
            }
        });

        // ===== FX =====
        for (let i = kiskacFX.length - 1; i >= 0; i--) {
            const p = kiskacFX[i];
            p.x += p.vx * ts; p.y += p.vy * ts;
            p.vy += p.gravity * ts;
            p.vx *= 0.95; p.vy *= 0.95;
            p.life -= ts;
            if (p.life <= 0) kiskacFX.splice(i, 1);
        }
        for (let i = kiskacTexts.length - 1; i >= 0; i--) {
            const t = kiskacTexts[i];
            t.y -= 0.7 * ts; t.life -= ts;
            if (t.life <= 0) kiskacTexts.splice(i, 1);
        }
    }

    function applyPoison(bot) {
        if (!bot || bot.isDead) return;
        const existing = poisonTargets.find(p => p.bot === bot);
        if (existing) {
            existing.timer = 180;
            existing.tickTimer = 0;
        } else {
            poisonTargets.push({ bot, timer: 180, tickTimer: 0 });
        }
        bot.hp -= POISON_DMG;
        addFloatingNumber(bot.x, bot.y, POISON_DMG, C_POISON);
    }

    function applyShrink(bot) {
        if (!bot || bot.isDead || bot._shrinkOrig) return;
        bot._shrinkOrig = { speed: bot.speed, radius: bot.radius };
        bot.speed = bot.speed * SHRINK_SPEED_MULT;
        bot.radius = bot.radius * SHRINK_RADIUS_MULT;
        bot._shrinkUntil = Date.now() + 500;
    }

    // ===== ÇİZİM =====
    chainHook('onDraw', function (ctx2) {
        // Ulti alanı
        if (ultiZone) {
            const prog = ultiZone.timer / ultiZone.maxTimer;
            ctx2.save();
            ctx2.globalAlpha = 0.3 + Math.sin(Date.now() / 200) * 0.1;
            const grad = ctx2.createRadialGradient(ultiZone.x, ultiZone.y, 0, ultiZone.x, ultiZone.y, ultiZone.radius);
            grad.addColorStop(0, 'rgba(142,68,173,0.4)');
            grad.addColorStop(1, 'rgba(142,68,173,0)');
            ctx2.beginPath();
            ctx2.arc(ultiZone.x, ultiZone.y, ultiZone.radius, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();
            ctx2.globalAlpha = 0.8;
            ctx2.beginPath();
            ctx2.arc(ultiZone.x, ultiZone.y, ultiZone.radius, 0, Math.PI * 2);
            ctx2.strokeStyle = C_SHRINK;
            ctx2.lineWidth = 3;
            ctx2.setLineDash([8, 6]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            // Geri sayım
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = C_WHITE;
            ctx2.font = 'bold 16px Arial';
            ctx2.textAlign = 'center';
            ctx2.fillText(Math.ceil(ultiZone.timer / 60) + "s", ultiZone.x, ultiZone.y - 20);
            ctx2.restore();
        }

        // Ulti projektili
        if (ultiProjectile) {
            const prog = ultiProjectile.progress;
            const cx = ultiProjectile.startX + (ultiProjectile.targetX - ultiProjectile.startX) * prog;
            const cy = ultiProjectile.startY + (ultiProjectile.targetY - ultiProjectile.startY) * prog;
            const arc = Math.sin(prog * Math.PI) * 100;
            ctx2.save();
            // Yer hedef işareti
            ctx2.globalAlpha = 0.5;
            ctx2.beginPath();
            ctx2.arc(ultiProjectile.targetX, ultiProjectile.targetY, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.strokeStyle = C_SHRINK;
            ctx2.lineWidth = 3;
            ctx2.setLineDash([6, 4]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            // Mermi
            ctx2.globalAlpha = 1;
            ctx2.beginPath();
            ctx2.arc(cx, cy - arc, 10, 0, Math.PI * 2);
            ctx2.fillStyle = C_SHRINK;
            ctx2.fill();
            ctx2.strokeStyle = C_WHITE;
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.restore();
        }

        // Kum fırtınası
        if (storm) {
            ctx2.save();
            ctx2.translate(storm.x, storm.y);
            ctx2.rotate(storm.angle);
            // Dış halka
            ctx2.globalAlpha = 0.6;
            ctx2.beginPath();
            ctx2.arc(0, 0, STORM_RADIUS, 0, Math.PI * 2);
            ctx2.strokeStyle = C_ACCENT;
            ctx2.lineWidth = 3;
            ctx2.setLineDash([8, 6]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            // İç dönme
            for (let k = 0; k < 5; k++) {
                const a = (k / 5) * Math.PI * 2 + storm.angle * 3;
                ctx2.beginPath();
                ctx2.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
                ctx2.lineTo(Math.cos(a) * (STORM_RADIUS - 5), Math.sin(a) * (STORM_RADIUS - 5));
                ctx2.strokeStyle = 'rgba(230,126,34,0.4)';
                ctx2.lineWidth = 2;
                ctx2.stroke();
            }
            ctx2.restore();
        }

        // Kum fırtınası projekti
        if (stormBulletFlight) {
            const prog = stormBulletFlight.progress;
            const cx = stormBulletFlight.startX + (stormBulletFlight.targetX - stormBulletFlight.startX) * prog;
            const cy = stormBulletFlight.startY + (stormBulletFlight.targetY - stormBulletFlight.startY) * prog;
            const arc = Math.sin(prog * Math.PI) * 80;
            ctx2.save();
            ctx2.beginPath();
            ctx2.arc(cx, cy - arc, 8, 0, Math.PI * 2);
            ctx2.fillStyle = C_ACCENT;
            ctx2.fill();
            ctx2.strokeStyle = C_WHITE;
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.restore();
        }

        // Zehir mermisi
        if (poisonBullet) {
            poisonBullet.trail.forEach(pt => {
                ctx2.save();
                ctx2.globalAlpha = (pt.life / 15) * 0.4;
                ctx2.beginPath();
                ctx2.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
                ctx2.fillStyle = C_POISON;
                ctx2.fill();
                ctx2.restore();
            });
            ctx2.save();
            ctx2.translate(poisonBullet.x, poisonBullet.y);
            const grad = ctx2.createRadialGradient(0, 0, 0, 0, 0, 12);
            grad.addColorStop(0, C_WHITE);
            grad.addColorStop(0.4, C_POISON);
            grad.addColorStop(1, 'rgba(39,174,96,0)');
            ctx2.beginPath();
            ctx2.arc(0, 0, 12, 0, Math.PI * 2);
            ctx2.fillStyle = grad;
            ctx2.fill();
            ctx2.restore();
        }

        // Kıskaç mermileri (gerçek pençe görünümü)
        kiskacBullets.forEach(b => {
            b.trail.forEach(pt => {
                ctx2.save();
                ctx2.globalAlpha = (pt.life / 15) * 0.4;
                ctx2.beginPath();
                ctx2.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
                ctx2.fillStyle = C_ACCENT;
                ctx2.fill();
                ctx2.restore();
            });

            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.rotate(b.angle);
            // İki pençe
            const clawOffset = 5 * b.clawOpen;
            ctx2.fillStyle = C_MAIN;
            ctx2.strokeStyle = C_WHITE;
            ctx2.lineWidth = 1.5;
            // Üst pençe
            ctx2.beginPath();
            ctx2.moveTo(0, -clawOffset);
            ctx2.quadraticCurveTo(8, -clawOffset - 4, 12, -clawOffset);
            ctx2.quadraticCurveTo(8, -clawOffset + 2, 0, -clawOffset);
            ctx2.fill();
            ctx2.stroke();
            // Alt pençe
            ctx2.beginPath();
            ctx2.moveTo(0, clawOffset);
            ctx2.quadraticCurveTo(8, clawOffset + 4, 12, clawOffset);
            ctx2.quadraticCurveTo(8, clawOffset - 2, 0, clawOffset);
            ctx2.fill();
            ctx2.stroke();
            ctx2.restore();
        });

        // FX
        kiskacFX.forEach(p => {
            ctx2.save();
            ctx2.globalAlpha = Math.min(1, p.life / 15);
            ctx2.beginPath();
            ctx2.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx2.fillStyle = p.color;
            ctx2.fill();
            ctx2.restore();
        });

        // Texts
        kiskacTexts.forEach(t => {
            ctx2.save();
            ctx2.globalAlpha = Math.min(1, t.life / 20);
            ctx2.font = t.isLabel ? 'bold 15px Arial' : 'bold 13px Arial';
            ctx2.textAlign = 'center';
            ctx2.fillStyle = t.color || C_LIGHT;
            ctx2.strokeStyle = 'rgba(20,10,5,0.9)';
            ctx2.lineWidth = 3;
            ctx2.strokeText(t.val, t.x, t.y);
            ctx2.fillText(t.val, t.x, t.y);
            ctx2.restore();
        });

        // Nişan çizgisi (içi boş beyaz dikdörtgen)
        if (player.charType === CHAR_ID && player._kiskacHideAim && !player.isDead && player.ammo >= 1) {
            const ang = aimData.angle;
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.rotate(ang);
            // Hafif beyaz dolgu
            ctx2.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx2.fillRect(0, -10, BULLET_RANGE, 20);
            // Beyaz kenar
            ctx2.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx2.lineWidth = 1.5;
            ctx2.strokeRect(0, -10, BULLET_RANGE, 20);
            // Uç nokta
            ctx2.beginPath();
            ctx2.arc(BULLET_RANGE, 0, 5, 0, Math.PI * 2);
            ctx2.fillStyle = C_MAIN;
            ctx2.fill();
            ctx2.strokeStyle = C_WHITE;
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.restore();
        }

        // Ulti drag
        if (player.charType === CHAR_ID && ultiDrag.active && player.ultReady && !player.isDead) {
            const pullMag = ultiDrag.pull < 0.05 ? 1 : ultiDrag.pull;
            const dist = ULTI_PLACE_MIN + (ULTI_PLACE_MAX - ULTI_PLACE_MIN) * pullMag;
            const tx = clampPos(player.x + Math.cos(ultiDrag.angle) * dist, WALL_THICKNESS + 40, canvas.width - WALL_THICKNESS - 40);
            const ty = clampPos(player.y + Math.sin(ultiDrag.angle) * dist, WALL_THICKNESS + 40, canvas.height - WALL_THICKNESS - 40);
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
            ctx2.strokeStyle = C_SHRINK;
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.restore();
        }
    });

    // ===== ARENA DÖNÜŞÜ =====
    (function () {
        const n = document.getElementById('diff-normal');
        const e = document.getElementById('diff-easy');
        if (n) { n.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); n.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
        if (e) { e.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); e.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
    })();

    console.log('[MOD YÜKLENDİ] kiskac (v2)');
})();