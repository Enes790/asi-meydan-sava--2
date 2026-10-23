// ========== mod29.js (BUZCU) - BUZ USTASI v4 ==========
// Karakter Dili: soğuk, keskin, kristal, sessiz
// Renk: #e8f6ff (buz beyazı) / #aed6f1 (açık buz) / #5dade2 (ana buz)
// Şekil: üçgen (buz kırığı), elmas (kristal), tırtıklı daire (çatlamış yüzey)
// İmza: Buzcu'nun dokunduğu her şey buzlaşır
(function () {
    'use strict';

    const CHAR_ID = 'buzcu';
    const C_WHITE = '#e8f6ff';
    const C_LIGHT = '#aed6f1';
    const C_MAIN = '#5dade2';
    const CHAR_HP = 2600;
    const CHAR_SPEED = 3.8;

    const DART_COUNT = 3;
    const DART_DAMAGE = 250;
    const DART_SPEED = PLAYER_BULLET_SPEED * 0.9;
    const DART_RANGE = 250;
    const DART_SPREAD = Math.PI * 30 / 180;
    const DART_PIERCE = 2;
    const DART_SLOW_FACTOR = 0.70;
    const DART_SLOW_DURATION = 60;

    const BUZ_RADIUS = 90;
    const BUZ_SLOW = 0.3;
    const BUZ_SLOW_DURATION = 180;
    const BUZ_SILENCE_MS = 2000;
    const BUZ_COOLDOWN = 900;

    const NEFES_RANGE = 170;
    const NEFES_HALF_ANGLE = Math.PI / 4;
    const NEFES_MAX = 4;
    const NEFES_DOT_TOTAL = 400;
    const NEFES_DURATION = 180;
    const NEFES_SILENCE_MS = 2000;
    const NEFES_BURST = 400;
    const NEFES_SPLASH = 400;
    const NEFES_SPLASH_RADIUS = 60;
    const NEFES_COOLDOWN = 1000;

    const ULTI_RADIUS = 114;
    const ULTI_PLACE_MAX = 280;
    const ULTI_PLACE_MIN = 80;
    const ULTI_DELAY = 180;
    const ULTI_SLOW_FACTOR = 0.56;
    const ULTI_BASE_DMG = 650;
    const ULTI_PER_BOT = 170;
    const ULTI_MAX_DMG = 2300;

    window.GAME_EXT.characters[CHAR_ID] = { color: C_MAIN, hp: CHAR_HP, speed: CHAR_SPEED };

    let buzcuDarts = [];
    let buzcuSlows = [];
    let buzcuNefes = [];
    let buzcuZones = [];
    let silencedBots = new Map();
    let buzcuUltiDrag = { active: false, startX: 0, startY: 0, angle: 0, pull: 0, touchId: null, isMouse: false };

    // ===== KENDİ EFEKT SİSTEMLERİ (base kullanılmıyor) =====
    let buzBursts = [];      // Patlama efektleri (4 katman)
    let buzShards = [];      // Buz kırıkları (üçgen/elmas)
    let buzFlashes = [];     // Merkez parlamaları (anticipation)
    let buzTexts = [];       // Hasar yazıları (kendi)
    let buzLingers = [];     // Kalıntı buz lekeleri (yerde)

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

    function applySilence(target, durationMs) {
        if (!target || target.isDead) return;
        const existing = silencedBots.get(target);
        if (existing) {
            existing.until = Math.max(existing.until, Date.now() + durationMs);
        } else {
            silencedBots.set(target, { until: Date.now() + durationMs, origInterval: target.shootInterval });
            target.shootInterval = 999999;
        }
    }

    // ===== EFEKT ÜRETİCİLERİ =====
    // Hasar yazısı (ulti doldurmaz, kendi renk paletimizde)
    function buzDamage(x, y, val) {
        buzTexts.push({
            x: x + (Math.random() - .5) * 20,
            y: y - 20,
            val: val,
            life: 55, maxLife: 55
        });
    }

    // Merkez parlaması — anticipation (küçük, hızlı, 5 frame)
    function buzFlash(x, y, size) {
        buzFlashes.push({ x, y, size: size || 30, life: 5, maxLife: 5 });
    }

    // Buz kırığı — asimetrik, üçgen veya elmas
    function buzShard(x, y, baseAngle, speed, isElmas) {
        const angleJitter = (Math.random() - .5) * 0.35; // ±10°
        const ang = baseAngle + angleJitter;
        const sp = speed * (0.6 + Math.random() * 0.8); // 0.6-1.4 çarpanı
        const life = 22 + Math.random() * 18; // 22-40 frame
        const upward = Math.random() < 0.3; // %30 yukarı süzülür
        buzShards.push({
            x, y,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp + (upward ? -0.5 : 0),
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - .5) * 0.3,
            size: 4 + Math.random() * 4,
            life, maxLife: life,
            isElmas: isElmas || Math.random() < 0.4,
            gravity: 0.05
        });
    }

    // Yer kalıntısı — soluk buz lekesi
    function buzLinger(x, y, radius, duration) {
        buzLingers.push({ x, y, radius: radius * 0.8, life: duration || 90, maxLife: duration || 90 });
    }

    // Tam patlama efekti (Buz aksesuarı, Nefes patlaması, Ulti için ortak kullanım)
    function buzExplosion(x, y, radius, intensity) {
        intensity = intensity || 1;
        // Faz 1: Merkez parlaması (anticipation)
        buzFlash(x, y, radius * 0.4);
        // Faz 2: Buz kırıkları (asimetrik, 10-14 adet)
        const shardCount = Math.floor(10 + Math.random() * 5) * intensity;
        for (let i = 0; i < shardCount; i++) {
            const baseAng = (i / shardCount) * Math.PI * 2;
            buzShard(x, y, baseAng, 5 + radius / 40, Math.random() < 0.35);
        }
        // Faz 3: Şok dalgası (tırtıklı halka) — ayrı efekt nesnesi
        buzBursts.push({
            x, y, radius: radius * 0.15, targetRadius: radius,
            life: 30, maxLife: 30, tırtıklı: true,
            innerRadius: radius * 0.15, innerLife: 12, innerMaxLife: 12
        });
        // Faz 4: Yer kalıntısı
        buzLinger(x, y, radius, 100);
    }

    // ===== KARAKTER KARTI =====
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + C_MAIN + ';"></div>' +
            '<span>Buzcu</span>' +
            '<small>Hasar: 3×250 + yavaş<br>Güç: Buz + Nefes<br>Ulti: Buz Delme</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function clearBuzcuState() {
        buzcuDarts = [];
        buzcuZones = [];
        buzcuNefes = [];
        buzBursts = [];
        buzShards = [];
        buzFlashes = [];
        buzTexts = [];
        buzLingers = [];
        silencedBots.forEach((v, bot) => { if (bot) bot.shootInterval = v.origInterval; });
        silencedBots.clear();
        buzcuSlows.forEach(s => { if (s.target && !s.target.isDead) s.target.speed = s.origSpeed; });
        buzcuSlows = [];
    }

    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            clearBuzcuState();
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
                ultiBtn.style.background = 'radial-gradient(circle, ' + C_MAIN + ', #2874a6)';
            }
            gadgetTimerText = document.getElementById('gadget-timer');
            gadgetTimerText2 = document.getElementById('gadget-timer-2');
        } else {
            clearBuzcuState();
            if (ultiBtn) ultiBtn.style.background = '';
        }
    };

    // ===== ANA SALDIRI =====
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

    // ===== BUZ (Aksesuar 1) =====
    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        let hit = 0;
        getActiveEnemies().forEach(e => {
            if (getDist(this, e) <= BUZ_RADIUS + e.radius) {
                applySlow(e, BUZ_SLOW, BUZ_SLOW_DURATION);
                applySilence(e, BUZ_SILENCE_MS);
                hit++;
            }
        });
        // Tam 4 katmanlı buz patlaması (merkez + kırık + halka + kalıntı)
        buzExplosion(this.x, this.y, BUZ_RADIUS, 1);
        buzTexts.push({
            x: this.x, y: this.y - 40,
            val: hit > 0 ? "BUZ! (" + hit + ")" : "BUZ!",
            life: 70, maxLife: 70, isLabel: true
        });
        this.gadgetReady = false;
        this.gadgetCooldown = BUZ_COOLDOWN;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(BUZ_COOLDOWN / 60) + "s";
    };

    // ===== SOĞUK NEFES (Aksesuar 2) =====
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
        const chosen = candidates.slice(0, NEFES_MAX);
        chosen.forEach(({ e }) => {
            const existing = buzcuNefes.find(n => n.target === e);
            if (existing) {
                existing.dotTimer = NEFES_DURATION;
                existing.tickTimer = 0;
                existing.dealt = 0;
            } else {
                buzcuNefes.push({
                    target: e, dotTimer: NEFES_DURATION, tickTimer: 0, dealt: 0, splashDone: false
                });
            }
            applySilence(e, NEFES_SILENCE_MS);
        });
        // Nefes konisi kısa bir parlama — anticipation
        buzFlash(this.x + Math.cos(angle) * NEFES_RANGE * 0.5, this.y + Math.sin(angle) * NEFES_RANGE * 0.5, 20);
        buzTexts.push({
            x: this.x, y: this.y - 30,
            val: "SOĞUK NEFES! (" + chosen.length + ")",
            life: 70, maxLife: 70, isLabel: true
        });
        this.gadget2Ready = false;
        this.gadget2Cooldown = NEFES_COOLDOWN;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(NEFES_COOLDOWN / 60) + "s";
    };

    // ===== ULTI =====
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
        buzTexts.push({
            x: this.x, y: this.y - 40,
            val: "BUZ DELME!", life: 70, maxLife: 70, isLabel: true
        });
        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    // ===== ULTİ DOLUMU — %50 yavaş =====
    chainHook('onChargeUlti', function (amount) {
        if (player.charType !== CHAR_ID) return;
        if (!gameStarted || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount * 0.5);
        if (player.ultCharge >= 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
            buzTexts.push({
                x: player.x, y: player.y - 40,
                val: "GÜÇ HAZIR!", life: 90, maxLife: 90, isLabel: true
            });
        }
        if (ultFill) ultFill.style.width = player.ultCharge + "%";
    });

    chainHook('onReset', function () { clearBuzcuState(); });

    // ===== KONİ NİŞAN — base çizimi bloke =====
    chainHook('onPreDraw', function (ctx2) {
        if (player.charType === CHAR_ID && aimData.active && !player.isDead && player.ammo >= 1) {
            player._buzcuAimHide = true;
            aimData.active = false;
        }
    });

    chainHook('onPostDraw', function (ctx2) {
        if (player._buzcuAimHide) {
            aimData.active = true;
            player._buzcuAimHide = false;
        }
    });

    // ===== ULTI DRAG =====
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
        e.preventDefault(); e.stopImmediatePropagation();
        const t = e.changedTouches[0];
        buzcuUltiDrag.touchId = t.identifier;
        ultiDragStart(t.clientX, t.clientY);
    }, { capture: true, passive: false });

    window.addEventListener('touchmove', e => {
        if (!buzcuUltiDrag.active || player.charType !== CHAR_ID) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === buzcuUltiDrag.touchId)
                ultiDragMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
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
        e.preventDefault(); e.stopImmediatePropagation();
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

    // ===== UPDATE =====
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
        // Silence timer
        silencedBots.forEach((v, bot) => {
            if (!bot || bot.isDead || Date.now() >= v.until) {
                if (bot) bot.shootInterval = v.origInterval;
                silencedBots.delete(bot);
            }
        });
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
            if (!n.target || n.target.isDead) { buzcuNefes.splice(i, 1); continue; }
            n.dotTimer -= ts; n.tickTimer += ts;
            if (n.tickTimer >= 30 && n.dealt < NEFES_DOT_TOTAL) {
                n.tickTimer = 0;
                const tick = Math.min(NEFES_DOT_TOTAL / 6, NEFES_DOT_TOTAL - n.dealt);
                n.target.hp -= tick;
                n.dealt += tick;
                buzDamage(n.target.x, n.target.y, Math.round(tick));
            }
            if (n.dotTimer <= 0) {
                if (!n.target.isDead && !n.splashDone) {
                    n.target.hp -= NEFES_BURST;
                    buzDamage(n.target.x, n.target.y - 10, NEFES_BURST);
                    buzExplosion(n.target.x, n.target.y, NEFES_SPLASH_RADIUS, 0.7);
                    getActiveEnemies().forEach(other => {
                        if (other === n.target || other.isDead) return;
                        if (getDist(n.target, other) < NEFES_SPLASH_RADIUS + other.radius) {
                            other.hp -= NEFES_SPLASH;
                            buzDamage(other.x, other.y, NEFES_SPLASH);
                        }
                    });
                    n.splashDone = true;
                }
                buzcuNefes.splice(i, 1);
            }
        }
        // Dart'lar
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
                    buzDamage(e.x, e.y, DART_DAMAGE);
                    applySlow(e, DART_SLOW_FACTOR, DART_SLOW_DURATION);
                    // Vuruş anı: küçük buz kırığı patlaması (anlık, kalıcı değil)
                    for (let k = 0; k < 3; k++) {
                        buzShard(e.x, e.y, (k / 3) * Math.PI * 2, 3.5, false);
                    }
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
                botsIn.forEach(e => { e.hp -= dmg; buzDamage(e.x, e.y, dmg); });
                buzExplosion(z.x, z.y, ULTI_RADIUS, 1.4);
                // Ekstra: dikey buz sarkıtı
                buzShards.push({
                    x: z.x, y: z.y - 120, vx: 0, vy: 18,
                    rot: 0, rotSpeed: 0, size: 8,
                    life: 20, maxLife: 20, isElmas: true, gravity: 0,
                    isSarkit: true
                });
                screenShake = 12;
                buzTexts.push({
                    x: z.x, y: z.y - 40,
                    val: n > 0 ? "DELDİ! (" + n + ")" : "BOŞ!",
                    life: 80, maxLife: 80, isLabel: true
                });
                buzcuZones.splice(i, 1);
            }
        }
        // ===== Efekt güncellemeleri =====
        for (let i = buzFlashes.length - 1; i >= 0; i--) {
            buzFlashes[i].life -= ts;
            if (buzFlashes[i].life <= 0) buzFlashes.splice(i, 1);
        }
        for (let i = buzBursts.length - 1; i >= 0; i--) {
            const b = buzBursts[i];
            b.life -= ts;
            const prog = 1 - (b.life / b.maxLife);
            b.radius = b.targetRadius * (0.15 + prog * 0.85);
            b.innerLife -= ts;
            if (b.life <= 0) buzBursts.splice(i, 1);
        }
        for (let i = buzShards.length - 1; i >= 0; i--) {
            const s = buzShards[i];
            if (s.isSarkit) {
                s.y += s.vy * ts;
                if (s.y >= s.y + 120) {} // hedef yok, aşağı düşer
            } else {
                s.x += s.vx * ts;
                s.y += s.vy * ts;
                s.vy += s.gravity * ts;
                s.vx *= 0.97;
                s.vy *= 0.97;
            }
            s.rot += s.rotSpeed * ts;
            s.life -= ts;
            if (s.life <= 0) buzShards.splice(i, 1);
        }
        for (let i = buzTexts.length - 1; i >= 0; i--) {
            const t = buzTexts[i];
            t.y -= 0.7 * ts;
            t.life -= ts;
            if (t.life <= 0) buzTexts.splice(i, 1);
        }
        for (let i = buzLingers.length - 1; i >= 0; i--) {
            buzLingers[i].life -= ts;
            if (buzLingers[i].life <= 0) buzLingers.splice(i, 1);
        }
    }

    // ===== ÇİZİM =====
    function drawBuzShard(ctx2, s) {
        const alpha = Math.min(1, s.life / (s.maxLife * 0.4));
        ctx2.save();
        ctx2.translate(s.x, s.y);
        ctx2.rotate(s.rot);
        ctx2.globalAlpha = alpha;
        ctx2.beginPath();
        if (s.isElmas) {
            // Elmas (kristal)
            ctx2.moveTo(0, -s.size * 1.4);
            ctx2.lineTo(s.size * 0.9, 0);
            ctx2.lineTo(0, s.size * 1.4);
            ctx2.lineTo(-s.size * 0.9, 0);
            ctx2.closePath();
        } else {
            // Üçgen (buz kırığı)
            ctx2.moveTo(0, -s.size * 1.3);
            ctx2.lineTo(s.size, s.size * 0.8);
            ctx2.lineTo(-s.size, s.size * 0.8);
            ctx2.closePath();
        }
        ctx2.fillStyle = 'rgba(174,214,241,0.7)';
        ctx2.fill();
        ctx2.strokeStyle = C_WHITE;
        ctx2.lineWidth = 1.2;
        ctx2.stroke();
        // İç parlama
        ctx2.beginPath();
        ctx2.arc(0, 0, s.size * 0.3, 0, Math.PI * 2);
        ctx2.fillStyle = 'rgba(232,246,255,0.9)';
        ctx2.fill();
        ctx2.restore();
    }

    function drawTirtikliHalka(ctx2, x, y, radius, alpha) {
        const points = 18;
        ctx2.save();
        ctx2.translate(x, y);
        ctx2.beginPath();
        for (let i = 0; i <= points; i++) {
            const ang = (i / points) * Math.PI * 2;
            // Her noktaya ±8 rastgele offset (deterministik — frame'e bağlı)
            const offset = Math.sin(i * 7.3 + x * 0.1 + y * 0.1) * 6;
            const r = radius + offset;
            if (i === 0) ctx2.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
            else ctx2.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        ctx2.closePath();
        ctx2.strokeStyle = `rgba(232,246,255,${alpha})`;
        ctx2.lineWidth = 2.5;
        ctx2.stroke();
        ctx2.restore();
    }

    chainHook('onDraw', function (ctx2) {
        // ===== Kalıntılar (yerde, en altta) =====
        buzLingers.forEach(l => {
            const alpha = Math.min(0.35, l.life / l.maxLife * 0.35);
            ctx2.save();
            ctx2.beginPath();
            ctx2.ellipse(l.x, l.y, l.radius, l.radius * 0.55, 0, 0, Math.PI * 2);
            ctx2.fillStyle = `rgba(93,173,226,${alpha})`;
            ctx2.fill();
            ctx2.restore();
        });
        // ===== Şok dalgaları =====
        buzBursts.forEach(b => {
            const prog = 1 - (b.life / b.maxLife);
            const alpha = 1 - prog;
            // Dış tırtıklı halka
            drawTirtikliHalka(ctx2, b.x, b.y, b.radius, alpha * 0.85);
            // İç hızlı halka
            if (b.innerLife > 0) {
                const innerProg = 1 - (b.innerLife / b.innerMaxLife);
                ctx2.save();
                ctx2.beginPath();
                ctx2.arc(b.x, b.y, b.innerRadius + (b.radius * 0.5) * innerProg, 0, Math.PI * 2);
                ctx2.strokeStyle = `rgba(232,246,255,${(1 - innerProg) * 0.9})`;
                ctx2.lineWidth = 3;
                ctx2.stroke();
                ctx2.restore();
            }
        });
        // ===== Buz kırıkları =====
        buzShards.forEach(s => drawBuzShard(ctx2, s));
        // ===== Merkez parlamaları =====
        buzFlashes.forEach(f => {
            const prog = 1 - (f.life / f.maxLife);
            const size = f.size * (0.4 + prog * 0.6);
            ctx2.save();
            const grad = ctx2.createRadialGradient(f.x, f.y, 0, f.x, f.y, size);
            grad.addColorStop(0, `rgba(232,246,255,${(1 - prog) * 0.9})`);
            grad.addColorStop(0.5, `rgba(174,214,241,${(1 - prog) * 0.5})`);
            grad.addColorStop(1, 'rgba(93,173,226,0)');
            ctx2.beginPath();
            ctx2.arc(f.x, f.y, size, 0, Math.PI * 2);
            ctx2.fillStyle = grad;
            ctx2.fill();
            ctx2.restore();
        });
        // ===== Dart'lar =====
        buzcuDarts.forEach(d => {
            ctx2.save();
            ctx2.translate(d.x, d.y); ctx2.rotate(d.angle);
            ctx2.beginPath();
            ctx2.moveTo(10, 0); ctx2.lineTo(0, -4); ctx2.lineTo(-8, 0); ctx2.lineTo(0, 4);
            ctx2.closePath();
            ctx2.fillStyle = C_MAIN; ctx2.fill();
            ctx2.strokeStyle = C_LIGHT; ctx2.lineWidth = 1.5; ctx2.stroke();
            ctx2.beginPath(); ctx2.arc(3, 0, 2, 0, Math.PI * 2); ctx2.fillStyle = C_WHITE; ctx2.fill();
            ctx2.restore();
        });
        // ===== Ulti bölgeleri =====
        buzcuZones.forEach(z => {
            const prog = 1 - Math.max(0, z.timer / ULTI_DELAY);
            ctx2.save(); ctx2.translate(z.x, z.y);
            // Dolgu
            ctx2.beginPath(); ctx2.arc(0, 0, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.fillStyle = `rgba(93,173,226,${0.12 + prog * 0.18})`; ctx2.fill();
            // Ana halka
            ctx2.beginPath(); ctx2.arc(0, 0, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.strokeStyle = C_MAIN; ctx2.lineWidth = 3; ctx2.stroke();
            // Dolan süre halkası
            ctx2.beginPath();
            ctx2.arc(0, 0, ULTI_RADIUS - 5, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
            ctx2.strokeStyle = C_LIGHT; ctx2.lineWidth = 4; ctx2.stroke();
            // İç süslemeler — buz ışınları
            ctx2.globalAlpha = prog * 0.7;
            for (let k = 0; k < 6; k++) {
                const a2 = (k / 6) * Math.PI * 2 + Date.now() / 600;
                ctx2.beginPath();
                ctx2.moveTo(Math.cos(a2) * 20, Math.sin(a2) * 20);
                ctx2.lineTo(Math.cos(a2) * (ULTI_RADIUS - 10), Math.sin(a2) * (ULTI_RADIUS - 10));
                ctx2.strokeStyle = C_LIGHT; ctx2.lineWidth = 1.5; ctx2.stroke();
            }
            ctx2.restore();
        });
        // ===== Koni nişan çizgisi (sade, net) =====
        if (player.charType === CHAR_ID && player._buzcuAimHide && !player.isDead && player.ammo >= 1) {
            const ang = aimData.angle;
            ctx2.save();
            // Koni dolgusu
            ctx2.beginPath();
            ctx2.moveTo(player.x, player.y);
            ctx2.arc(player.x, player.y, DART_RANGE, ang - DART_SPREAD / 2, ang + DART_SPREAD / 2);
            ctx2.closePath();
            ctx2.fillStyle = 'rgba(93,173,226,0.14)'; ctx2.fill();
            // Koni kenarları
            ctx2.strokeStyle = 'rgba(174,214,241,0.75)'; ctx2.lineWidth = 2;
            ctx2.stroke();
            // İç yay (buz hattı) — çok silik
            ctx2.beginPath();
            ctx2.arc(player.x, player.y, DART_RANGE * 0.75, ang - DART_SPREAD / 2 * 0.85, ang + DART_SPREAD / 2 * 0.85);
            ctx2.strokeStyle = 'rgba(232,246,255,0.35)'; ctx2.lineWidth = 1; ctx2.stroke();
            ctx2.restore();
        }
        // ===== Soğuk Nefes konisi (drag sırasında) =====
        if (player.charType === CHAR_ID && gadAim2.active && player.gadget2Ready && !player.isDead) {
            const ang = gadAim2.angle;
            ctx2.save();
            ctx2.beginPath();
            ctx2.moveTo(player.x, player.y);
            ctx2.arc(player.x, player.y, NEFES_RANGE, ang - NEFES_HALF_ANGLE, ang + NEFES_HALF_ANGLE);
            ctx2.closePath();
            // Yumuşak nefes dolgusu — gradient
            const grad = ctx2.createRadialGradient(player.x, player.y, 0, player.x, player.y, NEFES_RANGE);
            grad.addColorStop(0, 'rgba(93,173,226,0.4)');
            grad.addColorStop(0.5, 'rgba(93,173,226,0.2)');
            grad.addColorStop(1, 'rgba(93,173,226,0.05)');
            ctx2.fillStyle = grad; ctx2.fill();
            ctx2.strokeStyle = 'rgba(174,214,241,0.8)'; ctx2.lineWidth = 2; ctx2.stroke();
            // İç kar taneleri — nefes hissi
            const tNow = Date.now() / 1000;
            for (let k = 0; k < 8; k++) {
                const rk = ((k * 37 + tNow * 20) % NEFES_RANGE);
                const aK = ang + Math.sin(k + tNow * 2) * NEFES_HALF_ANGLE * 0.7;
                const px = player.x + Math.cos(aK) * rk;
                const py = player.y + Math.sin(aK) * rk;
                ctx2.beginPath();
                ctx2.arc(px, py, 2, 0, Math.PI * 2);
                ctx2.fillStyle = `rgba(232,246,255,${1 - rk / NEFES_RANGE})`;
                ctx2.fill();
            }
            ctx2.restore();
        }
        // ===== Ulti drag göstergesi =====
        if (player.charType === CHAR_ID && buzcuUltiDrag.active && player.ultReady && !player.isDead) {
            const pullMag = buzcuUltiDrag.pull < 0.05 ? 1 : buzcuUltiDrag.pull;
            const dist = ULTI_PLACE_MIN + (ULTI_PLACE_MAX - ULTI_PLACE_MIN) * pullMag;
            const tx = clampPos(player.x + Math.cos(buzcuUltiDrag.angle) * dist, WALL_THICKNESS + ULTI_RADIUS + 10, canvas.width - WALL_THICKNESS - ULTI_RADIUS - 10);
            const ty = clampPos(player.y + Math.sin(buzcuUltiDrag.angle) * dist, WALL_THICKNESS + ULTI_RADIUS + 10, canvas.height - WALL_THICKNESS - ULTI_RADIUS - 10);
            ctx2.save();
            ctx2.beginPath();
            ctx2.moveTo(player.x, player.y); ctx2.lineTo(tx, ty);
            ctx2.strokeStyle = 'rgba(93,173,226,0.5)'; ctx2.lineWidth = 3; ctx2.setLineDash([8, 6]); ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.beginPath(); ctx2.arc(tx, ty, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(93,173,226,0.15)'; ctx2.fill();
            ctx2.strokeStyle = C_MAIN; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.restore();
        }
        // ===== Hasar yazıları (en üstte) =====
        buzTexts.forEach(t => {
            const alpha = Math.min(1, t.life / 20);
            ctx2.save();
            ctx2.globalAlpha = alpha;
            ctx2.font = t.isLabel ? 'bold 15px Arial' : 'bold 13px Arial';
            ctx2.textAlign = 'center';
            ctx2.fillStyle = C_WHITE;
            ctx2.strokeStyle = 'rgba(40,116,166,0.8)';
            ctx2.lineWidth = 3;
            ctx2.strokeText(t.val, t.x, t.y);
            ctx2.fillText(t.val, t.x, t.y);
            ctx2.restore();
        });
    });
})();