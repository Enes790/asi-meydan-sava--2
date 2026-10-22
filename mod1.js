// ========== mod29.js (BUZCU) - BUZ USTASI ==========
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
    const DART_SPREAD = Math.PI / 15;
    const DART_PIERCE_MAX = 2;

    const BUZ_RADIUS = 115;
    const BUZ_SLOW_FACTOR = 0.3;
    const BUZ_DURATION = 120;
    const BUZ_COOLDOWN = 900;

    const NEFES_RANGE = 170;
    const NEFES_HALF_ANGLE = Math.PI / 4;
    const NEFES_MAX_TARGETS = 4;
    const NEFES_BURST_DAMAGE = 400;
    const NEFES_DURATION = 120;
    const NEFES_COOLDOWN = 1000;

    const ULTI_RADIUS = 114;
    const ULTI_PLACE_RANGE = 300;
    const ULTI_DELAY = 180;
    const ULTI_SLOW_FACTOR = 0.65;
    const ULTI_BASE_DAMAGE = 400;
    const ULTI_PER_BOT = 150;
    const ULTI_MAX_DAMAGE = 2300;

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let buzcuDarts = [];
    let buzcuZones = [];
    let buzcuSlows = [];
    let buzcuNefes = [];
    let buzcuUltiDrag = { active: false, x: 0, y: 0, angle: 0, pull: 0, touchId: null, isMouse: false };

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
        const existing = buzcuSlows.find(s => s.target === target);
        if (existing) {
            if (factor < existing.factor) existing.factor = factor;
            if (duration > existing.timer) existing.timer = duration;
        } else {
            buzcuSlows.push({
                target,
                origSpeed: target._buzcuOrigSpeed || target.speed,
                factor, timer: duration
            });
            if (!target._buzcuOrigSpeed) target._buzcuOrigSpeed = target.speed;
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
            '<small>Hasar: 3x250 delici<br>Güç: Buz + Soğuk Nefes<br>Ulti: Buz Delme</small>';
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
                if (n.target) {
                    n.target.shootInterval = n.origInterval;
                    delete n.target._buzcuSilenced;
                    delete n.target._buzcuOrigInterval;
                }
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
            if (ultiBtn) ultiBtn.style.display = 'flex';
        } else {
            buzcuNefes.forEach(n => {
                if (n.target) {
                    n.target.shootInterval = n.origInterval;
                    delete n.target._buzcuSilenced;
                    delete n.target._buzcuOrigInterval;
                }
            });
            buzcuNefes = [];
            buzcuSlows.forEach(s => { if (s.target && !s.target.isDead) s.target.speed = s.origSpeed; });
            buzcuSlows = [];
        }
    };

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
                angle: ang, hitTargets: [], pierceLeft: DART_PIERCE_MAX
            });
        }
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        let hit = 0;
        getActiveEnemies().forEach(e => {
            if (getDist(this, e) <= BUZ_RADIUS + e.radius) {
                applySlow(e, BUZ_SLOW_FACTOR, BUZ_DURATION);
                hit++;
            }
        });
        explosions.push({x: this.x, y: this.y, radius: 10, maxRadius: BUZ_RADIUS, life: 12, maxLife: 12});
        for (let k = 0; k < 8; k++) {
            const ang = Math.random() * Math.PI * 2;
            spawnParticles(this.x + Math.cos(ang) * BUZ_RADIUS * 0.7, this.y + Math.sin(ang) * BUZ_RADIUS * 0.7, CHAR_COLOR, 'smoke');
        }
        addFloatingNumber(this.x, this.y - 30, hit > 0 ? "BUZ! (" + hit + ")" : "BUZ!", CHAR_COLOR);
        this.gadgetReady = false;
        this.gadgetCooldown = BUZ_COOLDOWN;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(BUZ_COOLDOWN / 60) + "s";
    };

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
        candidates.sort((a2, b2) => a2.diff - b2.diff);
        const chosen = candidates.slice(0, NEFES_MAX_TARGETS);
        chosen.forEach(({ e }) => {
            const existing = buzcuNefes.find(n => n.target === e);
            if (existing) {
                existing.dotTimer = NEFES_DURATION;
                existing.tickTimer = 0;
            } else {
                buzcuNefes.push({
                    target: e, dotTimer: NEFES_DURATION, tickTimer: 0,
                    origInterval: e.shootInterval
                });
                e._buzcuOrigInterval = e.shootInterval;
            }
            e._buzcuSilenced = true;
            e.shootInterval = 999999;
        });
        addFloatingNumber(this.x, this.y - 30, "SOĞUK NEFES! (" + chosen.length + ")", CHAR_COLOR);
        explosions.push({x: this.x, y: this.y, radius: 0, maxRadius: NEFES_RANGE, life: 15, maxLife: 15});
        this.gadget2Ready = false;
        this.gadget2Cooldown = NEFES_COOLDOWN;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(NEFES_COOLDOWN / 60) + "s";
    };

    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;
        let pullMag = (pull !== undefined && pull > 0.05) ? pull : 1;
        let dist = Math.max(80, ULTI_PLACE_RANGE * pullMag);
        let tx = clampPos(this.x + Math.cos(a) * dist, WALL_THICKNESS + ULTI_RADIUS + 10, canvas.width - WALL_THICKNESS - ULTI_RADIUS - 10);
        let ty = clampPos(this.y + Math.sin(a) * dist, WALL_THICKNESS + ULTI_RADIUS + 10, canvas.height - WALL_THICKNESS - ULTI_RADIUS - 10);
        buzcuZones.push({ x: tx, y: ty, timer: ULTI_DELAY, innerSlowApplied: new Set() });
        addFloatingNumber(this.x, this.y - 40, "BUZ DELME!", CHAR_COLOR);
        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    chainHook('onReset', function () {
        buzcuNefes.forEach(n => {
            if (n.target) {
                n.target.shootInterval = n.origInterval;
                delete n.target._buzcuSilenced;
                delete n.target._buzcuOrigInterval;
            }
        });
        buzcuNefes = [];
        buzcuDarts = [];
        buzcuZones = [];
        buzcuSlows.forEach(s => { if (s.target && !s.target.isDead) s.target.speed = s.origSpeed; });
        buzcuSlows = [];
    });

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

    function buzcuUltiStart(cx, cy) {
        if (!player.ultReady || player.isDead || player.charType !== CHAR_ID) return;
        const r = ultiBtn.getBoundingClientRect();
        buzcuUltiDrag.active = true;
        buzcuUltiDrag.x = r.left + r.width / 2;
        buzcuUltiDrag.y = r.top + r.height / 2;
        buzcuUltiDrag.angle = player.angle;
        buzcuUltiDrag.pull = 0;
    }
    function buzcuUltiMove(cx, cy) {
        if (!buzcuUltiDrag.active) return;
        buzcuUltiDrag.angle = Math.atan2(cy - buzcuUltiDrag.y, cx - buzcuUltiDrag.x);
        buzcuUltiDrag.pull = Math.min(1, Math.hypot(cx - buzcuUltiDrag.x, cy - buzcuUltiDrag.y) / 160);
    }
    function buzcuUltiEnd() {
        if (!buzcuUltiDrag.active) return;
        buzcuUltiDrag.active = false;
        const pull = buzcuUltiDrag.pull < 0.05 ? 1 : buzcuUltiDrag.pull;
        player.fireUlti(buzcuUltiDrag.angle, pull);
    }

    ultiBtn.addEventListener('touchstart', e => {
        if (player.charType !== CHAR_ID) return;
        e.preventDefault(); e.stopImmediatePropagation();
        const t = e.changedTouches[0];
        buzcuUltiDrag.touchId = t.identifier;
        buzcuUltiStart(t.clientX, t.clientY);
    }, { capture: true, passive: false });

    window.addEventListener('touchmove', e => {
        if (!buzcuUltiDrag.active || player.charType !== CHAR_ID) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === buzcuUltiDrag.touchId) {
                buzcuUltiMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
            }
        }
    }, { passive: false });

    window.addEventListener('touchend', e => {
        if (!buzcuUltiDrag.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === buzcuUltiDrag.touchId) buzcuUltiEnd();
        }
    });

    ultiBtn.addEventListener('mousedown', e => {
        if (player.charType !== CHAR_ID) return;
        e.preventDefault(); e.stopImmediatePropagation();
        buzcuUltiDrag.isMouse = true;
        buzcuUltiStart(e.clientX, e.clientY);
    }, { capture: true });

    window.addEventListener('mousemove', e => {
        if (buzcuUltiDrag.active && buzcuUltiDrag.isMouse) buzcuUltiMove(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
        if (buzcuUltiDrag.active && buzcuUltiDrag.isMouse) {
            buzcuUltiDrag.isMouse = false;
            buzcuUltiEnd();
        }
    });

    function buzcuUpdate(ts) {
        if (player.charType === CHAR_ID) {
            if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
            if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
            if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';
        }
        for (let i = buzcuSlows.length - 1; i >= 0; i--) {
            const s = buzcuSlows[i];
            if (!s.target || s.target.isDead) {
                if (s.target && s.target._buzcuOrigSpeed) delete s.target._buzcuOrigSpeed;
                buzcuSlows.splice(i, 1); continue;
            }
            s.target.speed = s.origSpeed * s.factor;
            s.timer -= ts;
            if (s.timer <= 0) {
                if (!s.target.isDead) s.target.speed = s.origSpeed;
                delete s.target._buzcuOrigSpeed;
                buzcuSlows.splice(i, 1);
            }
        }
        for (let i = buzcuNefes.length - 1; i >= 0; i--) {
            const n = buzcuNefes[i];
            if (!n.target || n.target.isDead) {
                if (n.target && n.target._buzcuSilenced) {
                    n.target.shootInterval = n.origInterval;
                    delete n.target._buzcuSilenced;
                    delete n.target._buzcuOrigInterval;
                }
                buzcuNefes.splice(i, 1); continue;
            }
            n.dotTimer -= ts; n.tickTimer += ts;
            if (n.tickTimer >= 30) {
                n.tickTimer = 0;
                n.target.hp -= 25;
                addFloatingNumber(n.target.x, n.target.y, 25, CHAR_COLOR);
            }
            if (n.dotTimer <= 0) {
                if (!n.target.isDead) {
                    n.target.hp -= NEFES_BURST_DAMAGE;
                    addFloatingNumber(n.target.x, n.target.y - 10, NEFES_BURST_DAMAGE, CHAR_COLOR);
                    explosions.push({x: n.target.x, y: n.target.y, radius: 5, maxRadius: 50, life: 10, maxLife: 10});
                }
                n.target.shootInterval = n.origInterval;
                delete n.target._buzcuSilenced;
                delete n.target._buzcuOrigInterval;
                buzcuNefes.splice(i, 1);
            }
        }
        for (let i = buzcuDarts.length - 1; i >= 0; i--) {
            const d = buzcuDarts[i];
            d.x += d.vx * ts; d.y += d.vy * ts;
            const hw = d.x < WALL_THICKNESS + 5 || d.x > canvas.width - WALL_THICKNESS - 5 ||
                       d.y < WALL_THICKNESS + 5 || d.y > canvas.height - WALL_THICKNESS - 5;
            const oor = getDist({x: d.sx, y: d.sy}, d) > DART_RANGE;
            if (hw || oor) { buzcuDarts.splice(i, 1); continue; }
            let hitObs = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(d, o) < o.radius + 5) { o.hp -= 50; hitObs = true; break; }
            }
            if (hitObs) { buzcuDarts.splice(i, 1); continue; }
            let dead = false;
            for (const e of getActiveEnemies()) {
                if (d.hitTargets.includes(e)) continue;
                if (getDist(d, e) < e.radius + 10) {
                    e.hp -= DART_DAMAGE;
                    addFloatingNumber(e.x, e.y, DART_DAMAGE, CHAR_COLOR);
                    d.hitTargets.push(e);
                    d.pierceLeft--;
                    if (d.pierceLeft <= 0) { buzcuDarts.splice(i, 1); dead = true; break; }
                }
            }
            if (dead) continue;
        }
        for (let i = buzcuZones.length - 1; i >= 0; i--) {
            const z = buzcuZones[i];
            z.timer -= ts;
            getActiveEnemies().forEach(e => {
                if (getDist(z, e) < ULTI_RADIUS + e.radius && !z.innerSlowApplied.has(e)) {
                    applySlow(e, ULTI_SLOW_FACTOR, ULTI_DELAY);
                    z.innerSlowApplied.add(e);
                }
            });
            if (z.timer <= 0) {
                const botsIn = getActiveEnemies().filter(e => getDist(z, e) < ULTI_RADIUS + e.radius);
                const botCount = botsIn.length;
                const totalDmg = Math.min(ULTI_MAX_DAMAGE, ULTI_BASE_DAMAGE + botCount * ULTI_PER_BOT);
                botsIn.forEach(e => {
                    e.hp -= totalDmg;
                    addFloatingNumber(e.x, e.y, totalDmg, CHAR_COLOR);
                });
                explosions.push({x: z.x, y: z.y, radius: 5, maxRadius: ULTI_RADIUS, life: 18, maxLife: 18});
                explosions.push({x: z.x, y: z.y, radius: 0, maxRadius: ULTI_RADIUS * 1.3, life: 25, maxLife: 25});
                for (let k = 0; k < 15; k++) {
                    const ang = Math.random() * Math.PI * 2;
                    const dist = Math.random() * ULTI_RADIUS;
                    spawnParticles(z.x + Math.cos(ang) * dist, z.y + Math.sin(ang) * dist, CHAR_COLOR, 'normal');
                }
                screenShake = 12;
                addFloatingNumber(z.x, z.y - 40, botCount > 0 ? "DELDİ! (" + botCount + ")" : "BOŞ!", CHAR_COLOR);
                buzcuZones.splice(i, 1);
            }
        }
    }

    chainHook('onDraw', function (ctx2) {
        if (player.charType !== CHAR_ID) return;
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
        buzcuZones.forEach(z => {
            const prog = 1 - Math.max(0, z.timer / ULTI_DELAY);
            ctx2.save(); ctx2.translate(z.x, z.y);
            ctx2.beginPath(); ctx2.arc(0, 0, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.fillStyle = `rgba(93, 173, 226, ${0.15 + prog * 0.15})`; ctx2.fill();
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
        buzcuNefes.forEach(n => {
            if (!n.target || n.target.isDead) return;
            const e = n.target;
            ctx2.save();
            ctx2.translate(e.x, e.y - e.radius - 20);
            ctx2.globalAlpha = 0.8 + Math.sin(Date.now() / 150) * 0.2;
            ctx2.fillStyle = '#aed6f1';
            ctx2.font = 'bold 16px Arial';
            ctx2.textAlign = 'center';
            ctx2.fillText('❄', 0, 0);
            ctx2.restore();
        });
        if (buzcuUltiDrag.active && player.ultReady && !player.isDead) {
            const dist = Math.max(80, ULTI_PLACE_RANGE * (buzcuUltiDrag.pull < 0.05 ? 1 : buzcuUltiDrag.pull));
            const tx = clampPos(player.x + Math.cos(buzcuUltiDrag.angle) * dist, WALL_THICKNESS + ULTI_RADIUS + 10, canvas.width - WALL_THICKNESS - ULTI_RADIUS - 10);
            const ty = clampPos(player.y + Math.sin(buzcuUltiDrag.angle) * dist, WALL_THICKNESS + ULTI_RADIUS + 10, canvas.height - WALL_THICKNESS - ULTI_RADIUS - 10);
            ctx2.save();
            ctx2.beginPath();
            ctx2.moveTo(player.x, player.y);
            ctx2.lineTo(tx, ty);
            ctx2.strokeStyle = 'rgba(93, 173, 226, 0.6)';
            ctx2.lineWidth = 3; ctx2.setLineDash([8, 6]); ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.beginPath(); ctx2.arc(tx, ty, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(93, 173, 226, 0.15)'; ctx2.fill();
            ctx2.strokeStyle = CHAR_COLOR; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.restore();
        }
    });
})();