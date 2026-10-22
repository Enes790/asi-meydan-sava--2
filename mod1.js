// ========== mod29.js (BUZCU) - BUZ USTASI v2 ==========
(function () {
    'use strict';

    const CHAR_ID = 'buzcu';
    const CHAR_COLOR = '#5dade2';
    const CHAR_HP = 2600;
    const CHAR_SPEED = 3.8;

    const DART_COUNT = 3;
    const DART_DAMAGE = 250;
    const DART_SPEED = PLAYER_BULLET_SPEED * 0.9;
    const DART_RANGE = 320;
    const DART_SPREAD = Math.PI * 40 / 180;
    const DART_PIERCE = 2;

    const BUZ_RADIUS = 115;
    const BUZ_SLOW = 0.3;
    const BUZ_DURATION = 120;
    const BUZ_COOLDOWN = 900;

    const NEFES_RANGE = 170;
    const NEFES_HALF_ANGLE = Math.PI / 4;
    const NEFES_MAX_TARGETS = 4;
    const NEFES_DOT_TOTAL = 100;
    const NEFES_BURST = 400;
    const NEFES_DURATION = 120;
    const NEFES_COOLDOWN = 1000;

    const ULTI_RADIUS = 114;
    const ULTI_PLACE_MAX = 300;
    const ULTI_PLACE_MIN = 80;
    const ULTI_DELAY = 180;
    const ULTI_SLOW_FACTOR = 0.65;
    const ULTI_BASE_DMG = 400;
    const ULTI_PER_BOT = 150;
    const ULTI_MAX_DMG = 2300;

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let buzcuDarts = [];
    let buzcuSlows = [];
    let buzcuNefes = [];
    let buzcuZones = [];
    let buzcuUltiDrag = { active: false, startX: 0, startY: 0, angle: 0, pull: 0, touchId: null, isMouse: false };

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

    function applySlow(target, factor, duration) {
        if (!target || target.isDead) return;
        if (!target._buzcuOrigSpeed) target._buzcuOrigSpeed = target.speed;
        const existing = buzcuSlows.find(s => s.target === target);
        if (existing) {
            if (factor < existing.factor) existing.factor = factor;
            if (duration > existing.timer) existing.timer = duration;
        } else {
            buzcuSlows.push({ target, origSpeed: target._buzcuOrigSpeed, factor, timer: duration });
        }
    }

    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Buzcu</span>' +
            '<small>Hasar: 3×250 delici<br>Güç: Buz + Soğuk Nefes<br>Ulti: Buz Delme</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            buzcuDarts = [];
            buzcuZones = [];
            buzcuNefes.forEach(n => {
                if (n.target) { n.target.shootInterval = n.origInterval; delete n.target._buzcuSilenced; }
            });
            buzcuNefes = [];
            buzcuSlows.forEach(s => { if (s.target && !s.target.isDead) s.target.speed = s.origSpeed; });
            buzcuSlows = [];
            if (gadgetBtn) {
                gadgetBtn.style.display = 'flex';
                gadgetBtn.innerHTML = 'BUZ<br><span id="gadget-timer"></span>';
                gadgetBtn.classList.remove('cooldown');
            }
            if (gadgetBtn2) {
                gadgetBtn2.style.display = 'flex';
                gadgetBtn2.innerHTML = 'SOĞUK<br>NEFES<br><span id="gadget-timer-2"></span>';
                gadgetBtn2.classList.remove('cooldown');
            }
            if (ultiBtn) {
                ultiBtn.style.display = 'flex';
                ultiBtn.style.background = 'radial-gradient(circle, #5dade2, #2874a6)';
            }
            gadgetTimerText = document.getElementById('gadget-timer');
            gadgetTimerText2 = document.getElementById('gadget-timer-2');
        } else {
            buzcuNefes.forEach(n => {
                if (n.target) { n.target.shootInterval = n.origInterval; delete n.target._buzcuSilenced; }
            });
            buzcuNefes = [];
            buzcuSlows.forEach(s => { if (s.target && !s.target.isDead) s.target.speed = s.origSpeed; });
            buzcuSlows = [];
            if (ultiBtn) ultiBtn.style.background = '';
        }
    };

    // ==== ANA SALDIRI ====
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        if (this.ammo < 1 || this.isDead) return;
        for (let i = 0; i < DART_COUNT; i++) {
            const offset = -DART_SPREAD / 2 + (DART_SPREAD / (DART_COUNT - 1)) * i;
            const ang = a + offset;
            buzcuDarts.push({
                x: this.x, y: this.y, sx: this.x, sy: this.y,
                vx: Math.cos(ang) * DART_SPEED,
                vy: Math.sin(ang) * DART_SPEED,
                angle: ang, pierceLeft: DART_PIERCE, hitTargets: []
            });
        }
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ==== BUZ (Aks 1) ====
    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        let hit = 0;
        getActiveEnemies().forEach(e => {
            if (getDist(this, e) <= BUZ_RADIUS + e.radius) {
                applySlow(e, BUZ_SLOW, BUZ_DURATION);
                hit++;
            }
        });
        explosions.push({ x: this.x, y: this.y, radius: 10, maxRadius: BUZ_RADIUS, life: 18, maxLife: 18 });
        for (let k = 0; k < 10; k++) {
            const ang = Math.random() * Math.PI * 2;
            spawnParticles(this.x + Math.cos(ang) * BUZ_RADIUS * 0.7, this.y + Math.sin(ang) * BUZ_RADIUS * 0.7, CHAR_COLOR, 'smoke');
        }
        addFloatingNumber(this.x, this.y - 30, hit > 0 ? "BUZ! (" + hit + ")" : "BUZ!", CHAR_COLOR);
        this.gadgetReady = false;
        this.gadgetCooldown = BUZ_COOLDOWN;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(BUZ_COOLDOWN / 60) + "s";
    };

    // ==== SOĞUK NEFES (Aks 2) — drag koni ====
    const originalActivateGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        const angle = a !== undefined ? a : this.angle;
        const candidates = [];
        getActiveEnemies().forEach(e => {
            const d = getDist(this, e);
            if (d > NEFES_RANGE + e.radius) return;
            const botAng = Math.atan2(e.y - this.y, e.x - this.x);
            let diff = Math.abs(botAng - angle);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff <= NEFES_HALF_ANGLE) candidates.push({ e, diff });
        });
        candidates.sort((x, y) => x.diff - y.diff);
        const chosen = candidates.slice(0, NEFES_MAX_TARGETS);
        chosen.forEach(({ e }) => {
            const existing = buzcuNefes.find(n => n.target === e);
            if (existing) {
                existing.dotTimer = NEFES_DURATION;
                existing.tickTimer = 0;
                existing.dotDealt = 0;
            } else {
                buzcuNefes.push({
                    target: e, dotTimer: NEFES_DURATION, tickTimer: 0,
                    dotDealt: 0, origInterval: e.shootInterval
                });
            }
            e._buzcuSilenced = true;
            e.shootInterval = 999999;
        });
        addFloatingNumber(this.x, this.y - 30, "SOĞUK NEFES! (" + chosen.length + ")", CHAR_COLOR);
        this.gadget2Ready = false;
        this.gadget2Cooldown = NEFES_COOLDOWN;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(NEFES_COOLDOWN / 60) + "s";
    };

    // ==== ULTI ====
    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pull);
        if (pull === undefined) return;
        if (!this.ultReady || this.isDead) return;
        let pullMag = (pull > 0.05) ? pull : 1;
        let dist = ULTI_PLACE_MIN + (ULTI_PLACE_MAX - ULTI_PLACE_MIN) * pullMag;
        let tx = clampPos(this.x + Math.cos(a) * dist, WALL_THICKNESS + ULTI_RADIUS + 10, canvas.width - WALL_THICKNESS - ULTI_RADIUS - 10);
        let ty = clampPos(this.y + Math.sin(a) * dist, WALL_THICKNESS + ULTI_RADIUS + 10, canvas.height - WALL_THICKNESS - ULTI_RADIUS - 10);
        buzcuZones.push({ x: tx, y: ty, timer: ULTI_DELAY, hitSet: new Set() });
        addFloatingNumber(this.x, this.y - 40, "BUZ DELME!", CHAR_COLOR);
        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    // ==== ULTİ DOLUMU (core.js onChargeUlti wrapper'ı) ====
    chainHook('onChargeUlti', function (amount) {
        if (player.charType !== CHAR_ID) return;
        if (!gameStarted || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount);
        if (player.ultCharge >= 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, "GÜÇ HAZIR!", CHAR_COLOR);
        }
        if (ultFill) ultFill.style.width = player.ultCharge + "%";
    });

    chainHook('onReset', function () {
        buzcuDarts = [];
        buzcuZones = [];
        buzcuNefes.forEach(n => {
            if (n.target) { n.target.shootInterval = n.origInterval; delete n.target._buzcuSilenced; }
        });
        buzcuNefes = [];
        buzcuSlows.forEach(s => { if (s.target && !s.target.isDead) s.target.speed = s.origSpeed; });
        buzcuSlows = [];
    });

    // ==== ULTI DRAG (base listener'ı bloke eder) ====
    function ultiDragStart(cx, cy) {
        if (!player.ultReady || player.isDead || player.charType !== CHAR_ID) return;
        const r = ultiBtn.getBoundingClientRect();
        buzcuUltiDrag.active = true;
        buzcuUltiDrag.startX = r.left + r.width / 2;
        buzcuUltiDrag.startY = r.top + r.height / 2;
        buzcuUltiDrag.angle = player.angle;
        buzcuUltiDrag.pull = 0;
    }
    function ultiDragMove(cx, cy) {
        if (!buzcuUltiDrag.active) return;
        buzcuUltiDrag.angle = Math.atan2(cy - buzcuUltiDrag.startY, cx - buzcuUltiDrag.startX);
        buzcuUltiDrag.pull = Math.min(1, Math.hypot(cx - buzcuUltiDrag.startX, cy - buzcuUltiDrag.startY) / 160);
    }
    function ultiDragEnd() {
        if (!buzcuUltiDrag.active) return;
        buzcuUltiDrag.active = false;
        player.fireUlti(buzcuUltiDrag.angle, buzcuUltiDrag.pull);
    }

    ultiBtn.addEventListener('touchstart', e => {
        if (player.charType !== CHAR_ID) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const t = e.changedTouches[0];
        buzcuUltiDrag.touchId = t.identifier;
        ultiDragStart(t.clientX, t.clientY);
    }, { capture: true, passive: false });

    window.addEventListener('touchmove', e => {
        if (!buzcuUltiDrag.active || player.charType !== CHAR_ID) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === buzcuUltiDrag.touchId) {
                ultiDragMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
            }
        }
    }, { passive: false });

    window.addEventListener('touchend', e => {
        if (!buzcuUltiDrag.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === buzcuUltiDrag.touchId) ultiDragEnd();
        }
    });

    ultiBtn.addEventListener('mousedown', e => {
        if (player.charType !== CHAR_ID) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        buzcuUltiDrag.isMouse = true;
        ultiDragStart(e.clientX, e.clientY);
    }, { capture: true });

    window.addEventListener('mousemove', e => {
        if (buzcuUltiDrag.active && buzcuUltiDrag.isMouse) ultiDragMove(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
        if (buzcuUltiDrag.active && buzcuUltiDrag.isMouse) {
            buzcuUltiDrag.isMouse = false;
            ultiDragEnd();
        }
    });

    // ==== ANA UPDATE ====
    let lastT = 0;
    function buzcuLoop(t) {
        if (!lastT) lastT = t;
        const ts = Math.min(3, (t - lastT) / 16.666);
        lastT = t;
        if (gameStarted) {
            try { buzcuUpdate(ts); } catch (err) { console.error('[BUZCU]', err); }
        }
        requestAnimationFrame(buzcuLoop);
    }
    requestAnimationFrame(buzcuLoop);

    function buzcuUpdate(ts) {
        if (player.charType === CHAR_ID) {
            if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
            if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
            if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';
        }
        // Yavaşlatma
        for (let i = buzcuSlows.length - 1; i >= 0; i--) {
            const s = buzcuSlows[i];
            if (!s.target || s.target.isDead) { buzcuSlows.splice(i, 1); continue; }
            s.target.speed = s.origSpeed * s.factor;
            s.timer -= ts;
            if (s.timer <= 0) {
                if (!s.target.isDead) s.target.speed = s.origSpeed;
                buzcuSlows.splice(i, 1);
            }
        }
        // Soğuk Nefes DoT + patlama
        for (let i = buzcuNefes.length - 1; i >= 0; i--) {
            const n = buzcuNefes[i];
            if (!n.target || n.target.isDead) {
                if (n.target) { n.target.shootInterval = n.origInterval; delete n.target._buzcuSilenced; }
                buzcuNefes.splice(i, 1); continue;
            }
            n.dotTimer -= ts; n.tickTimer += ts;
            if (n.tickTimer >= 30 && n.dotDealt < NEFES_DOT_TOTAL) {
                n.tickTimer = 0;
                n.target.hp -= 25;
                n.dotDealt += 25;
                addFloatingNumber(n.target.x, n.target.y, 25, CHAR_COLOR);
            }
            if (n.dotTimer <= 0) {
                if (!n.target.isDead) {
                    n.target.hp -= NEFES_BURST;
                    addFloatingNumber(n.target.x, n.target.y - 10, NEFES_BURST, CHAR_COLOR);
                    explosions.push({ x: n.target.x, y: n.target.y, radius: 5, maxRadius: 50, life: 10, maxLife: 10 });
                }
                n.target.shootInterval = n.origInterval;
                delete n.target._buzcuSilenced;
                buzcuNefes.splice(i, 1);
            }
        }
        // Mermiler
        for (let i = buzcuDarts.length - 1; i >= 0; i--) {
            const d = buzcuDarts[i];
            d.x += d.vx * ts; d.y += d.vy * ts;
            const hw = d.x < WALL_THICKNESS + 5 || d.x > canvas.width - WALL_THICKNESS - 5 ||
                       d.y < WALL_THICKNESS + 5 || d.y > canvas.height - WALL_THICKNESS - 5;
            const oor = getDist({ x: d.sx, y: d.sy }, d) > DART_RANGE;
            if (hw || oor) { buzcuDarts.splice(i, 1); continue; }
            let hitObs = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(d, o) < o.radius + 5) { o.hp -= 50; hitObs = true; break; }
            }
            if (hitObs) { buzcuDarts.splice(i, 1); continue; }
            let removed = false;
            for (const e of getActiveEnemies()) {
                if (d.hitTargets.includes(e)) continue;
                if (getDist(d, e) < e.radius + 10) {
                    e.hp -= DART_DAMAGE;
                    addFloatingNumber(e.x, e.y, DART_DAMAGE, CHAR_COLOR);
                    d.hitTargets.push(e);
                    d.pierceLeft--;
                    if (d.pierceLeft <= 0) { buzcuDarts.splice(i, 1); removed = true; break; }
                }
            }
            if (removed) continue;
        }
        // Ulti bölgeleri
        for (let i = buzcuZones.length - 1; i >= 0; i--) {
            const z = buzcuZones[i];
            z.timer -= ts;
            getActiveEnemies().forEach(e => {
                if (!z.hitSet.has(e) && getDist(z, e) < ULTI_RADIUS + e.radius) {
                    applySlow(e, ULTI_SLOW_FACTOR, ULTI_DELAY);
                    z.hitSet.add(e);
                }
            });
            if (z.timer <= 0) {
                const botsIn = getActiveEnemies().filter(e => getDist(z, e) < ULTI_RADIUS + e.radius);
                const n = botsIn.length;
                const dmg = Math.min(ULTI_MAX_DMG, ULTI_BASE_DMG + n * ULTI_PER_BOT);
                botsIn.forEach(e => { e.hp -= dmg; addFloatingNumber(e.x, e.y, dmg, CHAR_COLOR); });
                explosions.push({ x: z.x, y: z.y, radius: 5, maxRadius: ULTI_RADIUS, life: 18, maxLife: 18 });
                explosions.push({ x: z.x, y: z.y, radius: 0, maxRadius: ULTI_RADIUS * 1.3, life: 25, maxLife: 25 });
                for (let k = 0; k < 15; k++) {
                    const ang = Math.random() * Math.PI * 2;
                    const dist = Math.random() * ULTI_RADIUS;
                    spawnParticles(z.x + Math.cos(ang) * dist, z.y + Math.sin(ang) * dist, CHAR_COLOR, 'normal');
                }
                screenShake = 12;
                addFloatingNumber(z.x, z.y - 40, n > 0 ? "DELDİ! (" + n + ")" : "BOŞ!", CHAR_COLOR);
                buzcuZones.splice(i, 1);
            }
        }
    }

    // ==== ÇİZİM ====
    chainHook('onDraw', function (ctx2) {
        // Yavaş bot görseli: mavi tonlama + dönen buz halkası
        if (player.charType === CHAR_ID) {
            getActiveEnemies().forEach(e => {
                const s = buzcuSlows.find(sl => sl.target === e);
                if (!s) return;
                const alpha = s.factor < 0.5 ? 0.45 : 0.25;
                ctx2.save();
                ctx2.beginPath(); ctx2.arc(e.x, e.y, e.radius + 2, 0, Math.PI * 2);
                ctx2.fillStyle = `rgba(93,173,226,${alpha})`; ctx2.fill();
                ctx2.translate(e.x, e.y);
                ctx2.rotate(Date.now() / 400);
                ctx2.beginPath();
                ctx2.arc(0, 0, e.radius + 6, 0, Math.PI * 2);
                ctx2.strokeStyle = `rgba(174,214,241,${alpha * 1.5})`;
                ctx2.lineWidth = 2; ctx2.setLineDash([6, 8]); ctx2.stroke();
                ctx2.setLineDash([]); ctx2.restore();
            });
        }
        // Dart'lar
        buzcuDarts.forEach(d => {
            ctx2.save();
            ctx2.translate(d.x, d.y); ctx2.rotate(d.angle);
            ctx2.beginPath();
            ctx2.moveTo(10, 0); ctx2.lineTo(0, -4); ctx2.lineTo(-8, 0); ctx2.lineTo(0, 4);
            ctx2.closePath();
            ctx2.fillStyle = CHAR_COLOR; ctx2.fill();
            ctx2.strokeStyle = '#aed6f1'; ctx2.lineWidth = 1.5; ctx2.stroke();
            ctx2.beginPath(); ctx2.arc(3, 0, 2, 0, Math.PI * 2); ctx2.fillStyle = '#fff'; ctx2.fill();
            ctx2.restore();
        });
        // Ulti bölgeleri
        buzcuZones.forEach(z => {
            const prog = 1 - Math.max(0, z.timer / ULTI_DELAY);
            ctx2.save(); ctx2.translate(z.x, z.y);
            ctx2.beginPath(); ctx2.arc(0, 0, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.fillStyle = `rgba(93,173,226,${0.15 + prog * 0.15})`; ctx2.fill();
            ctx2.beginPath(); ctx2.arc(0, 0, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.strokeStyle = CHAR_COLOR; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.beginPath();
            ctx2.arc(0, 0, ULTI_RADIUS - 5, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
            ctx2.strokeStyle = '#aed6f1'; ctx2.lineWidth = 4; ctx2.stroke();
            ctx2.globalAlpha = prog;
            for (let k = 0; k < 6; k++) {
                const a2 = (k / 6) * Math.PI * 2 + Date.now() / 500;
                ctx2.beginPath();
                ctx2.moveTo(Math.cos(a2) * 20, Math.sin(a2) * 20);
                ctx2.lineTo(Math.cos(a2) * (ULTI_RADIUS - 10), Math.sin(a2) * (ULTI_RADIUS - 10));
                ctx2.strokeStyle = '#aed6f1'; ctx2.lineWidth = 1.5; ctx2.stroke();
            }
            ctx2.restore();
        });
        // ❄ ikonu
        buzcuNefes.forEach(n => {
            if (!n.target || n.target.isDead) return;
            const e = n.target;
            const alpha = 0.6 + Math.sin(Date.now() / 150) * 0.3;
            ctx2.save();
            ctx2.globalAlpha = alpha;
            ctx2.font = 'bold 18px Arial';
            ctx2.textAlign = 'center';
            ctx2.fillStyle = '#aed6f1';
            ctx2.fillText('❄', e.x, e.y - e.radius - 20);
            ctx2.restore();
        });
        // Soğuk Nefes koni (drag sırasında)
        if (player.charType === CHAR_ID && gadAim2.active && player.gadget2Ready && !player.isDead) {
            const ang = gadAim2.angle;
            const ax = player.x, ay = player.y;
            ctx2.save();
            ctx2.beginPath();
            ctx2.moveTo(ax, ay);
            ctx2.arc(ax, ay, NEFES_RANGE, ang - NEFES_HALF_ANGLE, ang + NEFES_HALF_ANGLE);
            ctx2.closePath();
            ctx2.fillStyle = 'rgba(93,173,226,0.25)'; ctx2.fill();
            ctx2.strokeStyle = 'rgba(174,214,241,0.8)'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.globalAlpha = 0.4 + Math.sin(Date.now() / 100) * 0.15;
            for (let k = 1; k <= 3; k++) {
                const r = (NEFES_RANGE / 4) * k;
                ctx2.beginPath();
                ctx2.arc(ax, ay, r, ang - NEFES_HALF_ANGLE * (1 - k / 4), ang + NEFES_HALF_ANGLE * (1 - k / 4));
                ctx2.strokeStyle = '#aed6f1'; ctx2.lineWidth = 1.5; ctx2.stroke();
            }
            ctx2.restore();
        }
        // Ulti drag göstergesi
        if (player.charType === CHAR_ID && buzcuUltiDrag.active && player.ultReady && !player.isDead) {
            const pullMag = buzcuUltiDrag.pull < 0.05 ? 1 : buzcuUltiDrag.pull;
            const dist = ULTI_PLACE_MIN + (ULTI_PLACE_MAX - ULTI_PLACE_MIN) * pullMag;
            const tx = clampPos(player.x + Math.cos(buzcuUltiDrag.angle) * dist, WALL_THICKNESS + ULTI_RADIUS + 10, canvas.width - WALL_THICKNESS - ULTI_RADIUS - 10);
            const ty = clampPos(player.y + Math.sin(buzcuUltiDrag.angle) * dist, WALL_THICKNESS + ULTI_RADIUS + 10, canvas.height - WALL_THICKNESS - ULTI_RADIUS - 10);
            ctx2.save();
            ctx2.beginPath();
            ctx2.moveTo(player.x, player.y); ctx2.lineTo(tx, ty);
            ctx2.strokeStyle = 'rgba(93,173,226,0.6)'; ctx2.lineWidth = 3; ctx2.setLineDash([8, 6]); ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.beginPath(); ctx2.arc(tx, ty, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(93,173,226,0.15)'; ctx2.fill();
            ctx2.strokeStyle = CHAR_COLOR; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.restore();
        }
    });
})();