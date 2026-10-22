// ========== mod29.js (BUZCU) - KAR FIRTINASI ==========
(function () {
    'use strict';

    const CHAR_ID = 'buzcu';
    const CHAR_COLOR = '#5dade2';
    const CHAR_HP = 3000;
    const CHAR_SPEED = 3.4;

    // Ana saldırı
    const DART_DAMAGE = 250;
    const DART_SPEED = PLAYER_BULLET_SPEED * 0.9;
    const DART_RANGE = 280;
    const DART_SPREAD = Math.PI / 12;
    const DART_COUNT = 3;
    const DART_SLOW_DURATION = 90;
    const DART_SLOW_FACTOR = 0.6;

    // Buz Kalkanı
    const SHIELD_DURATION = 90;
    const SHIELD_DAMAGE_REDUCTION = 0.5;
    const SHIELD_BURST_DAMAGE = 400;
    const SHIELD_BURST_RADIUS = 100;
    const SHIELD_COOLDOWN = 900;

    // Donmuş Zemin
    const ICE_PATCH_RADIUS = 90;
    const ICE_PATCH_DURATION = 300;
    const ICE_PATCH_SLOW = 0.4;
    const ICE_PATCH_COOLDOWN = 900;
    const ICE_PATCH_DISTANCE = 150;

    // Kar Fırtınası
    const BLIZZARD_RADIUS = 200;
    const BLIZZARD_DURATION = 360;
    const BLIZZARD_DPS = 150;
    const BLIZZARD_SLOW = 0.5;
    const BLIZZARD_FREEZE_DAMAGE = 800;
    const BLIZZARD_FREEZE_DURATION = 60;

    // Pasif
    const AURA_RADIUS = 80;
    const AURA_SLOW = 0.85;

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let darts = [];
    let icePatches = [];
    let blizzards = [];
    let slowEffects = [];

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') {
                return !!prevResult || !!ownResult;
            }
            return ownResult !== undefined ? ownResult : prevResult;
        };
    }

    function applySlow(target, factor, duration) {
        if (!target || target.isDead) return;
        const existing = slowEffects.find(s => s.target === target);
        if (existing) {
            existing.timer = Math.max(existing.timer, duration);
            existing.factor = Math.min(existing.factor, factor);
        } else {
            slowEffects.push({
                target,
                originalSpeed: target.speed,
                factor,
                timer: duration
            });
        }
        target.speed = target.speed; // bir sonraki tick uygulanır
    }

    // ========== KARAKTER KARTI ==========
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Buzcu</span>' +
            '<small>Hasar: 3x250 + yavaşlat<br>Güç: Kar Fırtınası</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    // ========== SET CHARACTER ==========
    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            darts = [];
            icePatches = [];
            blizzards = [];
            slowEffects.forEach(s => { if (s.target && !s.target.isDead) s.target.speed = s.originalSpeed; });
            slowEffects = [];
            this.buzcuShieldActive = false;
            this.buzcuShieldTimer = 0;
            if (gadgetBtn) {
                gadgetBtn.style.display = 'flex';
                gadgetBtn.innerHTML = 'BUZ<br>KALKANI<br><span id="gadget-timer"></span>';
                gadgetBtn.classList.remove('cooldown');
            }
            if (gadgetBtn2) {
                gadgetBtn2.style.display = 'flex';
                gadgetBtn2.innerHTML = 'DONMUŞ<br>ZEMİN<br><span id="gadget-timer-2"></span>';
                gadgetBtn2.classList.remove('cooldown');
            }
        } else {
            slowEffects.forEach(s => { if (s.target && !s.target.isDead) s.target.speed = s.originalSpeed; });
            slowEffects = [];
        }
    };

    // ========== ANA SALDIRI ==========
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        if (this.ammo < 1 || this.isDead) return;

        for (let i = 0; i < DART_COUNT; i++) {
            const offset = -DART_SPREAD / 2 + (DART_SPREAD / (DART_COUNT - 1)) * i;
            const ang = a + offset;
            darts.push({
                x: this.x, y: this.y, sx: this.x, sy: this.y,
                vx: Math.cos(ang) * DART_SPEED,
                vy: Math.sin(ang) * DART_SPEED,
                angle: ang, isDead: false
            });
        }
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ========== BUZ KALKANI ==========
    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;

        this.buzcuShieldActive = true;
        this.buzcuShieldTimer = SHIELD_DURATION;
        this.gadgetReady = false;
        this.gadgetCooldown = SHIELD_COOLDOWN;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(SHIELD_COOLDOWN / 60) + "s";
        addFloatingNumber(this.x, this.y - 30, "BUZ KALKANI!", CHAR_COLOR);
    };

    // ========== DONMUŞ ZEMİN ==========
    const originalActivateGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;

        const angle = a !== undefined ? a : this.angle;
        const tx = clampPos(this.x + Math.cos(angle) * ICE_PATCH_DISTANCE,
                            WALL_THICKNESS + ICE_PATCH_RADIUS, canvas.width - WALL_THICKNESS - ICE_PATCH_RADIUS);
        const ty = clampPos(this.y + Math.sin(angle) * ICE_PATCH_DISTANCE,
                            WALL_THICKNESS + ICE_PATCH_RADIUS, canvas.height - WALL_THICKNESS - ICE_PATCH_RADIUS);
        icePatches.push({ x: tx, y: ty, radius: ICE_PATCH_RADIUS, timer: ICE_PATCH_DURATION });

        this.gadget2Ready = false;
        this.gadget2Cooldown = ICE_PATCH_COOLDOWN;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(ICE_PATCH_COOLDOWN / 60) + "s";
        addFloatingNumber(this.x, this.y - 30, "DONMUŞ ZEMİN!", CHAR_COLOR);
    };

    // ========== ULTİ ==========
    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pullOverride);
        if (!this.ultReady || this.isDead) return;

        blizzards.push({
            x: this.x, y: this.y,
            radius: BLIZZARD_RADIUS,
            timer: BLIZZARD_DURATION,
            tickTimer: 0,
            hitEnemies: new Set()
        });
        addFloatingNumber(this.x, this.y - 40, "KAR FIRTINASI!", CHAR_COLOR);
        screenShake = 10;

        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    // ========== ON RESET ==========
    chainHook('onReset', function () {
        darts = [];
        icePatches = [];
        blizzards = [];
        slowEffects.forEach(s => { if (s.target && !s.target.isDead) s.target.speed = s.originalSpeed; });
        slowEffects = [];
    });

    // ========== GÜNCELLEME DÖNGÜSÜ ==========
    let lastUpdateTime = 0;
    function buzcuLoop(t) {
        if (!lastUpdateTime) lastUpdateTime = t;
        const ts = Math.min(3, (t - lastUpdateTime) / 16.666);
        lastUpdateTime = t;
        if (gameStarted) {
            try { buzcuUpdate(ts); } catch (e) { console.error('[BUZCU]', e); }
        }
        requestAnimationFrame(buzcuLoop);
    }
    requestAnimationFrame(buzcuLoop);

    function buzcuUpdate(ts) {
        // Yavaşlatma efektleri
        for (let i = slowEffects.length - 1; i >= 0; i--) {
            const s = slowEffects[i];
            if (!s.target || s.target.isDead) { slowEffects.splice(i, 1); continue; }
            s.target.speed = s.originalSpeed * s.factor;
            s.timer -= ts;
            if (s.timer <= 0) {
                if (!s.target.isDead) s.target.speed = s.originalSpeed;
                slowEffects.splice(i, 1);
            }
        }

        if (player.charType === CHAR_ID && !player.isDead) {
            // Kalkan süresi
            if (player.buzcuShieldActive) {
                player.buzcuShieldTimer -= ts;
                if (player.buzcuShieldTimer <= 0) {
                    player.buzcuShieldActive = false;
                    getActiveEnemies().forEach(e => {
                        if (getDist(player, e) <= SHIELD_BURST_RADIUS + e.radius) {
                            e.hp -= SHIELD_BURST_DAMAGE;
                            addFloatingNumber(e.x, e.y, SHIELD_BURST_DAMAGE, CHAR_COLOR);
                            applySlow(e, 0.5, 60);
                        }
                    });
                    explosions.push({ x: player.x, y: player.y, radius: 10, maxRadius: SHIELD_BURST_RADIUS, life: 12, maxLife: 12 });
                    addFloatingNumber(player.x, player.y - 30, "PATLADI!", CHAR_COLOR);
                }
            }
            // Soğuk Aura
            getActiveEnemies().forEach(e => {
                if (getDist(player, e) < AURA_RADIUS + e.radius) {
                    if (!e._buzcuAuraSlowed) {
                        e._buzcuAuraSlowed = true;
                        e._buzcuAuraOrigSpeed = e.speed;
                        e.speed *= AURA_SLOW;
                    }
                } else if (e._buzcuAuraSlowed) {
                    e._buzcuAuraSlowed = false;
                    e.speed = e._buzcuAuraOrigSpeed;
                }
            });
        } else {
            getActiveEnemies().forEach(e => {
                if (e._buzcuAuraSlowed) { e._buzcuAuraSlowed = false; e.speed = e._buzcuAuraOrigSpeed; }
            });
        }

        // Dartlar
        for (let i = darts.length - 1; i >= 0; i--) {
            const d = darts[i];
            d.x += d.vx * ts; d.y += d.vy * ts;
            const hwX = d.x < WALL_THICKNESS + 4 || d.x > canvas.width - WALL_THICKNESS - 4;
            const hwY = d.y < WALL_THICKNESS + 4 || d.y > canvas.height - WALL_THICKNESS - 4;
            if (hwX || hwY || getDist({ x: d.sx, y: d.sy }, d) > DART_RANGE) { darts.splice(i, 1); continue; }
            let hitObs = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(d, o) < o.radius + 4) { hitObs = true; break; }
            }
            if (hitObs) { darts.splice(i, 1); continue; }
            let hit = false;
            for (const e of getActiveEnemies()) {
                if (getDist(d, e) < e.radius + 6) {
                    e.hp -= DART_DAMAGE;
                    addFloatingNumber(e.x, e.y, DART_DAMAGE, CHAR_COLOR);
                    applySlow(e, DART_SLOW_FACTOR, DART_SLOW_DURATION);
                    hit = true; break;
                }
            }
            if (hit) { darts.splice(i, 1); continue; }
        }

        // Donmuş zeminler
        for (let i = icePatches.length - 1; i >= 0; i--) {
            const p = icePatches[i];
            p.timer -= ts;
            getActiveEnemies().forEach(e => {
                if (getDist(p, e) < p.radius + e.radius) applySlow(e, ICE_PATCH_SLOW, 30);
            });
            if (p.timer <= 0) icePatches.splice(i, 1);
        }

        // Kar fırtınaları
        for (let i = blizzards.length - 1; i >= 0; i--) {
            const b = blizzards[i];
            b.timer -= ts; b.tickTimer += ts;
            const doTick = b.tickTimer >= 60;
            if (doTick) b.tickTimer = 0;
            getActiveEnemies().forEach(e => {
                if (getDist(b, e) < b.radius + e.radius) {
                    e.hp -= (BLIZZARD_DPS / 60) * ts;
                    if (doTick) addFloatingNumber(e.x, e.y, BLIZZARD_DPS, CHAR_COLOR);
                    applySlow(e, BLIZZARD_SLOW, 30);
                    b.hitEnemies.add(e);
                }
            });
            if (b.timer <= 0) {
                b.hitEnemies.forEach(e => {
                    if (e.isDead) return;
                    e.hp -= BLIZZARD_FREEZE_DAMAGE;
                    addFloatingNumber(e.x, e.y, BLIZZARD_FREEZE_DAMAGE, "#5dade2");
                    e.kbX = 0; e.kbY = 0;
                    applySlow(e, 0.05, BLIZZARD_FREEZE_DURATION);
                });
                explosions.push({ x: b.x, y: b.y, radius: 10, maxRadius: b.radius, life: 15, maxLife: 15 });
                screenShake = 12;
                blizzards.splice(i, 1);
            }
        }
    }

    // ========== ÇİZİM ==========
    chainHook('onDraw', function (ctx2) {
        if (player.charType !== CHAR_ID) return;

        icePatches.forEach(p => {
            const alpha = Math.min(0.4, p.timer / 60);
            ctx2.save(); ctx2.translate(p.x, p.y);
            ctx2.beginPath(); ctx2.arc(0, 0, p.radius, 0, Math.PI * 2);
            ctx2.fillStyle = `rgba(93, 173, 226, ${alpha})`; ctx2.fill();
            ctx2.strokeStyle = `rgba(174, 214, 241, ${alpha * 2})`;
            ctx2.lineWidth = 2; ctx2.setLineDash([8, 8]); ctx2.stroke();
            ctx2.setLineDash([]); ctx2.restore();
        });

        blizzards.forEach(b => {
            const alpha = Math.min(0.35, b.timer / 60);
            ctx2.save(); ctx2.translate(b.x, b.y);
            const grad = ctx2.createRadialGradient(0, 0, 0, 0, 0, b.radius);
            grad.addColorStop(0, `rgba(200, 230, 255, ${alpha})`);
            grad.addColorStop(1, `rgba(93, 173, 226, 0)`);
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();
            ctx2.strokeStyle = `rgba(93, 173, 226, ${alpha * 2})`;
            ctx2.lineWidth = 2; ctx2.setLineDash([12, 10]); ctx2.stroke();
            ctx2.setLineDash([]); ctx2.restore();
        });

        darts.forEach(d => {
            ctx2.save(); ctx2.translate(d.x, d.y); ctx2.rotate(d.angle);
            ctx2.beginPath();
            ctx2.moveTo(8, 0); ctx2.lineTo(0, -5); ctx2.lineTo(-6, 0); ctx2.lineTo(0, 5);
            ctx2.closePath();
            ctx2.fillStyle = '#5dade2'; ctx2.fill();
            ctx2.strokeStyle = '#aed6f1'; ctx2.lineWidth = 1.5; ctx2.stroke();
            ctx2.restore();
        });

        if (player.buzcuShieldActive) {
            const alpha = Math.min(0.7, player.buzcuShieldTimer / 60);
            ctx2.save(); ctx2.translate(player.x, player.y);
            ctx2.beginPath(); ctx2.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
            ctx2.strokeStyle = `rgba(174, 214, 241, ${alpha})`; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.beginPath(); ctx2.arc(0, 0, player.radius + 12, 0, Math.PI * 2);
            ctx2.fillStyle = `rgba(93, 173, 226, ${alpha * 0.25})`; ctx2.fill();
            ctx2.restore();
        }
    });
})();