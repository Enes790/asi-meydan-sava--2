// ============================================================================
// KARAKTER: ODAKÇI (mod7.js)
// ----------------------------------------------------------------------------
// Bu karakterde mermi, tek vuruş, koni ya da sekme YOK. Saldırı sürekli bir ışın:
// sağ joystick'i TUTTUĞUN sürece ışın nişan yönünde yanar, çizgi üzerindeki herkese
// saniyelik hasar verir. Cephane burada "enerji": ışın yandıkça tükenir, bırakınca dolar.
//
// SALDIRI - Işın: 700 hasar/sn, çizgideki tüm düşmanlara. Engele çarpınca durur.
//   Enerji bitince ışın kesilir, yeniden yanması için biraz dolması gerekir.
// AKSESUAR 1 - Odak: 3 sn boyunca ışın daralır ve 2 kat hasar verir (enerjiyi %40 fazla yer).
// AKSESUAR 2 - Perde: 2 sn boyunca etrafındaki 70 yarıçapa giren düşman mermilerini siler.
// ULTİ - Kıyamet Hattı: yarım sn hazırlanır (çizgi görünür), sonra 1.5 sn boyunca
//   tüm haritayı kesen kalın bir ışın saniyede 1400 hasar verir, engelleri de yıkar.
//   Hazırlanırken ve ateşlerken oyuncu çok yavaş hareket eder (denge bedeli).
// ============================================================================

(function () {
    'use strict';
    console.log('[MOD YÜKLENDİ] odakci');

    const CHAR_ID = 'odakci';
    const CHAR_COLOR = '#e84393';
    const CHAR_HP = 3400;
    const CHAR_SPEED = 3.3;

    // Işın
    const BEAM_RANGE = RANGE * 1.15;
    const BEAM_WIDTH = 22;
    const BEAM_DPS = 700;
    const BEAM_DRAIN = 1.8 / 60;         // kare başına enerji tüketimi (1.8/sn)
    const BEAM_RESTART_AT = 0.6;         // enerji bitince bu kadar dolmadan yanmaz
    const BEAM_OBSTACLE_DPS = 120;
    const BEAM_CHARGE_PER_TICK = 6;      // yarım saniyede bir ulti şarjı
    const CLICK_BURST_FRAMES = 36;       // bilgisayarda tık ile kısa ışın

    // Aksesuar 1: Odak
    const FOCUS_COOLDOWN = 900;
    const FOCUS_FRAMES = 180;
    const FOCUS_DAMAGE_MULT = 2;
    const FOCUS_WIDTH_MULT = 0.6;
    const FOCUS_DRAIN_MULT = 1.4;

    // Aksesuar 2: Perde
    const GUARD_COOLDOWN = 840;
    const GUARD_FRAMES = 120;
    const GUARD_RADIUS = 70;

    // Ulti: Kıyamet Hattı
    const ULTI_CHARGE_FRAMES = 36;
    const ULTI_FIRE_FRAMES = 90;
    const ULTI_WIDTH = 70;
    const ULTI_DPS = 1400;
    const ULTI_OBSTACLE_DPS = 1500;
    const ULTI_MOVE_MULT = 0.3;

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let focusTimer = 0;
    let guardTimer = 0;
    let beamLocked = false;
    let clickBeamT = 0;
    let clickAngle = 0;
    let beamDraw = null;
    let ultiState = null;                // {phase, t, angle}
    let chargeAcc = 0;
    let suppressCharge = false;
    const hitRecords = new Map();        // düşman -> {acc, t}

    // ---- Karakter kartı ----
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Odakçı</span>' +
            '<small>Hasar: Işın<br>Güç: Kıyamet Hattı</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            if (typeof prev === 'function') prev.apply(this, args);
            return fn.apply(this, args);
        };
    }

    function endUlti() {
        ultiState = null;
        player.speed = player.originalSpeed;
    }

    function resetState() {
        focusTimer = 0; guardTimer = 0; beamLocked = false; clickBeamT = 0;
        beamDraw = null; chargeAcc = 0; hitRecords.clear();
        if (ultiState) endUlti();
    }

    // Ulti şarjı (ışın hasarının ürettiği sayılar otomatik şarj yapmasın diye kendi sayacımız)
    function addCharge(amount) {
        if (!gameStarted || player.ultReady || ultiState) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount);
        if (player.ultCharge === 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, 'GÜÇ HAZIR!', '#f1c40f');
        }
        if (ultFill) ultFill.style.width = player.ultCharge + '%';
    }

    const originalChargeUlti = window.chargeUlti;
    window.chargeUlti = function (amount) {
        if (player.charType !== CHAR_ID) return originalChargeUlti(amount);
        // bu karakterde şarj sadece ışının kendi sayacından gelir
    };

    // ---- Işın geometrisi ----
    function castBeam(angle, maxLen, width, pierceObstacles) {
        const dx = Math.cos(angle), dy = Math.sin(angle);
        let len = maxLen;
        const minX = WALL_THICKNESS, maxX = canvas.width - WALL_THICKNESS;
        const minY = WALL_THICKNESS, maxY = canvas.height - WALL_THICKNESS;
        if (dx > 0.0001) len = Math.min(len, (maxX - player.x) / dx);
        else if (dx < -0.0001) len = Math.min(len, (minX - player.x) / dx);
        if (dy > 0.0001) len = Math.min(len, (maxY - player.y) / dy);
        else if (dy < -0.0001) len = Math.min(len, (minY - player.y) / dy);
        len = Math.max(0, len);

        let blocker = null;
        const pierced = [];
        for (const o of obstacles.concat(cactusWalls || [])) {
            const ox = o.x - player.x, oy = o.y - player.y;
            const t = ox * dx + oy * dy;
            if (t < 0) continue;
            const perp = Math.abs(ox * dy - oy * dx);
            if (pierceObstacles) {
                if (perp < o.radius + width / 2 && t < len) pierced.push(o);
            } else if (perp < o.radius) {
                const hitT = t - Math.sqrt(Math.max(0, o.radius * o.radius - perp * perp));
                if (hitT >= 0 && hitT < len) { len = hitT; blocker = o; }
            }
        }

        const enemies = [];
        getActiveEnemies().forEach(e => {
            const ex = e.x - player.x, ey = e.y - player.y;
            const t = ex * dx + ey * dy;
            if (t < 0 || t > len + e.radius) return;
            const perp = Math.abs(ex * dy - ey * dx);
            if (perp < e.radius + width / 2) enemies.push(e);
        });
        return { len, enemies, blocker, pierced };
    }

    // Işın hasarını uygular, düşmanlara yarım saniyede bir toplam hasarı sayı olarak gösterir
    function applyBeamDamage(res, dps, ts) {
        const seen = new Set();
        let any = false;
        res.enemies.forEach(e => {
            const dmg = dps / 60 * ts;
            e.hp -= dmg;
            any = true;
            seen.add(e);
            let rec = hitRecords.get(e);
            if (!rec) { rec = { acc: 0, t: 0 }; hitRecords.set(e, rec); }
            rec.acc += dmg; rec.t += ts;
            if (rec.t >= 30) {
                suppressCharge = true;
                addFloatingNumber(e.x, e.y, Math.round(rec.acc), CHAR_COLOR);
                suppressCharge = false;
                rec.acc = 0; rec.t = 0;
            }
        });
        hitRecords.forEach((rec, e) => { if (!seen.has(e)) hitRecords.delete(e); });
        return any;
    }

    // ---- Player override'ları ----
    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            resetState();
            this.reloadSpeed = 0.015;
            this.speed = this.originalSpeed;
            gadgetBtn.innerHTML = 'ODAK<br><span id="gadget-timer"></span>';
            gadgetBtn2.innerHTML = 'PERDE<br><span id="gadget-timer-2"></span>';
            gadgetBtn.classList.remove('cooldown', 'active');
            gadgetBtn2.classList.remove('cooldown');
            this.ultReady = false;
            this.ultCharge = 0;
            if (ultFill) ultFill.style.width = '0%';
            if (ultiBtn) ultiBtn.classList.remove('ready');
        }
    };

    // Joystick bırakılınca ana dosya fire çağırıyor: ışın zaten sürekli yandığı için o yolda bir şey yapmıyoruz.
    // Bilgisayarda tık (joystick yokken) kısa bir ışın patlaması veriyor.
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        if (aimData.active || this.isDead || this.ammo < 1 || ultiState) return;
        this.consumeAmmo();
        clickAngle = a;
        clickBeamT = CLICK_BURST_FRAMES;
    };

    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        focusTimer = FOCUS_FRAMES;
        addFloatingNumber(this.x, this.y - 30, 'ODAK!', CHAR_COLOR);
        spawnParticles(this.x, this.y, CHAR_COLOR, 'normal');
        this.gadgetReady = false;
        this.gadgetCooldown = FOCUS_COOLDOWN;
        gadgetBtn.classList.remove('active');
        gadgetBtn.classList.add('cooldown');
    };

    const originalActivateGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        guardTimer = GUARD_FRAMES;
        addFloatingNumber(this.x, this.y - 30, 'PERDE!', '#74b9ff');
        this.gadget2Ready = false;
        this.gadget2Cooldown = GUARD_COOLDOWN;
        gadgetBtn2.classList.add('cooldown');
    };

    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pull);
        if (!this.ultReady || this.isDead || ultiState) return;
        ultiState = { phase: 'charge', t: ULTI_CHARGE_FRAMES, angle: a !== undefined ? a : this.angle };
        this.speed = this.originalSpeed * ULTI_MOVE_MULT;
        addFloatingNumber(this.x, this.y - 40, 'KIYAMET HATTI!', CHAR_COLOR);
        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = '0%';
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    chainHook('onReset', function () { resetState(); });

    // ---- Çizim ----
    function drawBeam(c, b, alpha) {
        const flicker = 0.85 + Math.random() * 0.15;
        c.save();
        c.translate(b.x, b.y);
        c.rotate(b.angle);
        c.globalAlpha = alpha * 0.3 * flicker;
        c.fillStyle = CHAR_COLOR;
        c.fillRect(0, -b.width * 0.95, b.len, b.width * 1.9);
        c.globalAlpha = alpha * 0.85;
        c.fillStyle = '#ff9ccf';
        c.fillRect(0, -b.width / 2, b.len, b.width);
        c.globalAlpha = alpha;
        c.fillStyle = '#ffffff';
        c.fillRect(0, -b.width / 5, b.len, b.width * 0.4);
        c.beginPath(); c.arc(b.len, 0, b.width * 0.7 * flicker, 0, Math.PI * 2);
        c.globalAlpha = alpha * 0.8;
        c.fillStyle = '#ffffff'; c.fill();
        c.restore();
    }

    chainHook('onDraw', function (c) {
        if (player.charType !== CHAR_ID) return;

        if (guardTimer > 0) {
            const fade = Math.min(1, guardTimer / 30);
            c.save();
            c.translate(player.x, player.y);
            c.globalAlpha = 0.15 * fade;
            c.beginPath(); c.arc(0, 0, GUARD_RADIUS, 0, Math.PI * 2);
            c.fillStyle = '#74b9ff'; c.fill();
            c.globalAlpha = 0.8 * fade;
            c.strokeStyle = '#74b9ff'; c.lineWidth = 3;
            c.setLineDash([10, 8]); c.lineDashOffset = -Date.now() / 40; c.stroke();
            c.restore();
        }

        if (focusTimer > 0) {
            c.save();
            c.translate(player.x, player.y);
            c.globalAlpha = 0.7;
            c.beginPath(); c.arc(0, 0, player.radius + 8 + Math.sin(Date.now() / 90) * 2, 0, Math.PI * 2);
            c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
            c.restore();
        }

        // Ulti hazırlık çizgisi ve ışını
        if (ultiState) {
            const len = Math.hypot(canvas.width, canvas.height);
            if (ultiState.phase === 'charge') {
                const pulse = 0.35 + Math.abs(Math.sin(Date.now() / 60)) * 0.4;
                c.save();
                c.translate(player.x, player.y);
                c.rotate(ultiState.angle);
                c.globalAlpha = pulse * 0.35;
                c.fillStyle = CHAR_COLOR;
                c.fillRect(0, -ULTI_WIDTH / 2, len, ULTI_WIDTH);
                c.globalAlpha = pulse;
                c.strokeStyle = '#fff'; c.lineWidth = 2; c.setLineDash([12, 8]);
                c.strokeRect(0, -ULTI_WIDTH / 2, len, ULTI_WIDTH);
                c.restore();
            } else {
                const b = ultiState.beam;
                if (b) drawBeam(c, b, Math.min(1, ultiState.t / 20));
            }
        }

        if (beamDraw) drawBeam(c, beamDraw, 1);

        // Ulti nişan önizlemesi (ana dosya bu karakter için çizmiyor)
        if (ultAim.active && player.ultReady && !player.isDead) {
            c.save();
            c.translate(player.x, player.y);
            c.rotate(ultAim.angle);
            c.globalAlpha = 0.2;
            c.fillStyle = CHAR_COLOR;
            c.fillRect(0, -ULTI_WIDTH / 2, Math.hypot(canvas.width, canvas.height), ULTI_WIDTH);
            c.globalAlpha = 0.6;
            c.strokeStyle = CHAR_COLOR; c.lineWidth = 2; c.setLineDash([12, 8]);
            c.strokeRect(0, -ULTI_WIDTH / 2, Math.hypot(canvas.width, canvas.height), ULTI_WIDTH);
            c.restore();
        }
    });

    // ---- Güncelleme ----
    let lastT = 0;
    function oLoop(t) {
        if (!lastT) lastT = t;
        const ts = Math.min(3, (t - lastT) / 16.666);
        lastT = t;
        if (gameStarted) oUpdate(ts);
        requestAnimationFrame(oLoop);
    }
    requestAnimationFrame(oLoop);

    function oUpdate(ts) {
        beamDraw = null;
        if (player.charType !== CHAR_ID) return;

        // ana dosya bu karakteri listede bulamayıp butonları gizliyor, her karede geri açıyoruz
        if (ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
        if (gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
        if (gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';

        if (player.isDead) { if (ultiState) endUlti(); return; }

        if (focusTimer > 0) focusTimer -= ts;
        if (guardTimer > 0) guardTimer -= ts;

        // Perde: yakındaki düşman mermilerini siler
        if (guardTimer > 0) {
            for (let i = botBullets.length - 1; i >= 0; i--) {
                if (getDist(botBullets[i], player) < GUARD_RADIUS) {
                    spawnParticles(botBullets[i].x, botBullets[i].y, '#74b9ff', 'normal');
                    botBullets.splice(i, 1);
                }
            }
        }

        // Ulti: Kıyamet Hattı
        if (ultiState) {
            ultiState.t -= ts;
            if (ultiState.phase === 'charge') {
                if (ultiState.t <= 0) {
                    ultiState.phase = 'fire';
                    ultiState.t = ULTI_FIRE_FRAMES;
                    screenShake = 10;
                }
            } else {
                const res = castBeam(ultiState.angle, Math.hypot(canvas.width, canvas.height), ULTI_WIDTH, true);
                ultiState.beam = { x: player.x, y: player.y, angle: ultiState.angle, len: res.len, width: ULTI_WIDTH };
                applyBeamDamage(res, ULTI_DPS, ts);
                res.pierced.forEach(o => { o.hp -= ULTI_OBSTACLE_DPS / 60 * ts; });
                player.lastHitTime = player.lastShotTime = Date.now();
                if (ultiState.t <= 0) endUlti();
            }
            return; // ulti sırasında normal ışın yanmaz
        }

        // Normal ışın: joystick tutulduğu sürece yanar
        const aiming = aimData.active && Math.hypot(aimData.x, aimData.y) > 0.25;
        if (beamLocked && player.ammo >= BEAM_RESTART_AT) beamLocked = false;

        let firing = false, angle = 0, drain = 0;
        if (aiming && !beamLocked && player.ammo > 0.02) {
            firing = true;
            angle = aimData.angle;
            drain = BEAM_DRAIN * (focusTimer > 0 ? FOCUS_DRAIN_MULT : 1) * ts;
        } else if (clickBeamT > 0) {
            firing = true;
            angle = clickAngle;
            clickBeamT -= ts;
        }
        if (aiming && !beamLocked && player.ammo <= 0.02) beamLocked = true;

        if (!firing) { chargeAcc = 0; hitRecords.clear(); return; }

        player.ammo = Math.max(0, player.ammo - drain);
        player.lastHitTime = player.lastShotTime = Date.now();

        const focused = focusTimer > 0;
        const width = BEAM_WIDTH * (focused ? FOCUS_WIDTH_MULT : 1);
        const res = castBeam(angle, BEAM_RANGE, width, false);
        beamDraw = { x: player.x, y: player.y, angle, len: res.len, width };

        const any = applyBeamDamage(res, BEAM_DPS * (focused ? FOCUS_DAMAGE_MULT : 1), ts);
        if (res.blocker) res.blocker.hp -= BEAM_OBSTACLE_DPS / 60 * ts;

        if (any) {
            chargeAcc += ts;
            if (chargeAcc >= 30) { chargeAcc = 0; addCharge(BEAM_CHARGE_PER_TICK); }
        }
    }

})();
