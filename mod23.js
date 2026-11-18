/* ==========================================================================
   mod29.js  -  YENİ KARAKTER: "DEMİRCİ"  (Yakın menzil)
   --------------------------------------------------------------------------
   mod9.js ile AYNI yapıyı kullanır: window.GAME_EXT kaydı + kendi rAF döngüsü
   + oyuncu metotlarını (sadece bu karakter seçiliyken) sarmalama.
   Ana oyun koduna DOKUNMAZ.

   Tema: çekiç, körük, kızgın demir
   * Ana atak   - ÇEKİÇ VURUŞU    : Yakın yay içinde çekiç darbesi.
   * Q          - KÖRÜK SAVURMA   : 360° yakın alan darbesi.
   * E          - KISKAÇ          : En yakın düşmanı kıskaca alır, sabitler, zamanla hasar verir.
   * Güç        - DEV ÇEKİÇ       : Gecikmeli, telegraf'lı yer darbesi.
   * Pasif 1    - KOR BİRİKİMİ    : Vuruşlar ısı biriktirir, ısı hasarı artırır.
   * Pasif 2    - SON NEFES ATEŞİ : Can %35 altına düşünce ısınma 2 katı, hasar +%25.
   ========================================================================== */
(function () {
    'use strict';

    if (typeof window === 'undefined' || !window.GAME_EXT) return;

    const ID = 'demirci';
    const COLOR = '#c0662b';
    const EXT = window.GAME_EXT;

    // ---- Denge sabitleri ----
    const HIT_DMG = 280;        // temel çekiç vuruşu
    const HIT_RANGE = 95;       // çekiç menzili (düşman yarıçapı eklenir)
    const HIT_HALF = 0.62;      // yay yarı açısı (rad)
    const HEAT_MAX = 100;
    const SPIN_RANGE = 100;
    const SPIN_DMG = 340;
    const SPIN_CD = 420;        // ~7 sn
    const PIN_RANGE = 170;
    const PIN_TIME = 150;       // ~2.5 sn
    const PIN_TICK_EVERY = 25;
    const PIN_DMG = 120;
    const PIN_CD = 780;         // ~13 sn
    const SLAM_DIST = 210;
    const SLAM_RADIUS = 150;
    const SLAM_DMG = 1100;
    const SLAM_DELAY = 60;      // ~1 sn telegraf
    const CHARGE_PER_FRAME = 100 / 4200;
    const CHARGE_PER_HIT = 3;
    const CHARGE_PER_KILL = 25;

    // ---------------------------------------------------------------- KAYIT
    EXT.characters[ID] = { color: COLOR, hp: 3500, speed: 2.9 };

    // ---------------------------------------------------------- KARAKTER KARTI
    (function addCard() {
        const cont = document.querySelector('.char-select-container');
        if (!cont || document.getElementById('char-' + ID)) return;
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + COLOR + ';"></div>' +
            '<span>Demirci</span><small>Hasar: Isı ile artar<br>Güç: Dev Çekiç</small>';
        card.addEventListener('click', () => {
            selectedCharacter = ID;
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
        cont.appendChild(card);
    })();

    // ------------------------------------------------------------------ DURUM
    let pins = [];     // { e, x, y, timer, tick }
    let slams = [];    // { x, y, timer, max }
    let fx = [];       // görsel halkalar { x, y, r, life, maxLife }
    let knocked = [];  // geri itilen düşmanlar (kendi itme sistemimiz)
    const dem = { heat: 0, idle: 0, swing: null, furyOn: false };
    let wasActive = false, last = 0, warned = false, needReset = false;

    function resetState() {
        pins = []; slams = []; fx = []; knocked = [];
        dem.heat = 0; dem.idle = 0; dem.swing = null; dem.furyOn = false;
    }

    // ---------------------------------------------------------------- YARDIMCI
    const isMine = p => p.charType === ID;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const angOf = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
    function angDiff(a, b) {
        let d = a - b;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return Math.abs(d);
    }
    function clampRange(v, lo, hi) { return lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)); }
    function hurt(e, dmg, col) { e.hp -= dmg; addFloatingNumber(e.x, e.y, Math.floor(dmg), col || '#e67e22'); }
    function particles(x, y, col, type) { if (typeof spawnParticles === 'function') spawnParticles(x, y, col, type); }
    function shake(n) { screenShake = Math.max(typeof screenShake === 'number' ? screenShake : 0, n); }
    function allObstacles() {
        const extra = (typeof cactusWalls !== 'undefined' && cactusWalls) ? cactusWalls : [];
        return obstacles.concat(extra);
    }
    function charge(n) {
        if (player.ultReady || player.isDead) return;
        player.ultCharge = Math.min(100, player.ultCharge + n);
        if (ultFill) ultFill.style.width = player.ultCharge + '%';
        if (player.ultCharge >= 100) {
            player.ultReady = true;
            ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, 'GÜÇ HAZIR!', '#f1c40f');
        }
    }
    // Düşmanı itmek için (e.kbX gibi ana kod alanlarına güvenmeden kendi itmemiz)
    function knock(e, ang, power) {
        e._m29kx = (e._m29kx || 0) + Math.cos(ang) * power;
        e._m29ky = (e._m29ky || 0) + Math.sin(ang) * power;
        if (knocked.indexOf(e) < 0) knocked.push(e);
    }

    // ------------------------------------------------- OYUNCU METOTLARI (SARMALAMA)
    // mod9 gibi: player NESNESİNİN üstüne sarılır (prototype'a değil).
    function install(p) {
        if (p.__m29) return;
        p.__m29 = true;
        const orig = { fire: p.fire, g1: p.activateGadget, g2: p.activateGadget2, ult: p.fireUlti };

        p.fire = function (a, pull) {
            if (!isMine(this)) return orig.fire.call(this, a, pull);
            return hammerHit.call(this, a, pull);
        };
        p.activateGadget = function (a, pull) {
            if (!isMine(this)) return orig.g1.call(this, a, pull);
            return korukSavurma.call(this, a, pull);
        };
        p.activateGadget2 = function (a, pull) {
            if (!isMine(this)) return orig.g2.call(this, a, pull);
            return kiskac.call(this, a, pull);
        };
        p.fireUlti = function (a, pull) {
            if (!isMine(this)) return orig.ult.call(this, a, pull);
            return devCekic.call(this, a, pull);
        };
    }

    // ------------------------------------------------------------ ANA SALDIRI
    // Yakın yay içinde çekiç vuruşu (mühimmat harcar)
    function hammerHit(a) {
        if (this.isDead || this.ammo < 1) return;
        const ang = (a !== undefined) ? a : this.angle;
        this.angle = ang;
        this.consumeAmmo();
        dem.swing = { ang: ang, t: 0, dur: 12 };

        const fury = dem.furyOn ? 1.25 : 1;
        const dmg = Math.round(HIT_DMG * (1 + dem.heat / 200) * fury);
        let hits = 0;
        getActiveEnemies().forEach(e => {
            if (dist(this, e) > HIT_RANGE + e.radius) return;
            if (angDiff(angOf(this, e), ang) > HIT_HALF) return;
            hurt(e, dmg, '#f39c12');
            hits++;
            knock(e, angOf(this, e), 6);
        });
        allObstacles().forEach(o => {
            if (dist(this, o) <= HIT_RANGE + o.radius && angDiff(angOf(this, o), ang) <= HIT_HALF) o.hp -= 120;
        });
        if (hits > 0) {
            dem.heat = Math.min(HEAT_MAX, dem.heat + (dem.furyOn ? 30 : 15));
            dem.idle = 0;
            charge(CHARGE_PER_HIT * hits);
        }
        particles(this.x + Math.cos(ang) * 36, this.y + Math.sin(ang) * 36, '#f39c12', 'normal');
    }

    // ---------------------------------------------------------------- YETENEKLER
    // Q: Körük Savurma (360° yakın alan)
    function korukSavurma() {
        if (!this.gadgetReady || this.isDead || this.isDashing) return;
        dem.idle = 0;
        const dmg = Math.round(SPIN_DMG * (dem.furyOn ? 1.25 : 1));
        let hits = 0;
        getActiveEnemies().forEach(e => {
            if (dist(this, e) > SPIN_RANGE + e.radius) return;
            hurt(e, dmg, '#e67e22');
            hits++;
            knock(e, angOf(this, e), 9);
        });
        allObstacles().forEach(o => { if (dist(this, o) <= SPIN_RANGE + o.radius) o.hp -= 150; });
        fx.push({ x: this.x, y: this.y, r: SPIN_RANGE, life: 18, maxLife: 18 });
        addFloatingNumber(this.x, this.y - 30, 'SAVURMA!', '#e67e22');
        shake(8);
        particles(this.x, this.y, '#e67e22', 'normal');
        dem.heat = Math.min(HEAT_MAX, dem.heat + 20);
        charge(CHARGE_PER_HIT * hits);
        this.gadgetReady = false; this.gadgetCooldown = SPIN_CD;
        gadgetBtn.classList.remove('active'); gadgetBtn.classList.add('cooldown');
    }

    // E: Kıskaç (en yakın düşmanı sabitler)
    function kiskac() {
        if (!this.gadget2Ready || this.isDead) return;
        let best = null, bestD = Infinity;
        getActiveEnemies().forEach(e => {
            if (pins.some(pn => pn.e === e)) return;
            const dd = dist(this, e) - e.radius;
            if (dd <= PIN_RANGE && dd < bestD) { bestD = dd; best = e; }
        });
        if (!best) {
            addFloatingNumber(this.x, this.y - 30, 'HEDEF YOK!', '#95a5a6');
            return; // hedef yoksa bekleme süresi harcanmaz
        }
        pins.push({ e: best, x: best.x, y: best.y, timer: PIN_TIME, tick: 0 });
        addFloatingNumber(best.x, best.y - 20, 'KISKAÇ!', '#e67e22');
        this.gadget2Ready = false; this.gadget2Cooldown = PIN_CD;
        gadgetBtn2.classList.add('cooldown');
    }

    // Güç: Dev Çekiç (gecikmeli yer darbesi)
    function devCekic(a) {
        if (!this.ultReady || this.isDead) return;
        const ang = (a !== undefined) ? a : this.angle;
        const m = SLAM_RADIUS * 0.5;
        const tx = clampRange(this.x + Math.cos(ang) * SLAM_DIST, WALL_THICKNESS + m, canvas.width - WALL_THICKNESS - m);
        const ty = clampRange(this.y + Math.sin(ang) * SLAM_DIST, WALL_THICKNESS + m, canvas.height - WALL_THICKNESS - m);
        slams.push({ x: tx, y: ty, timer: SLAM_DELAY, max: SLAM_DELAY });
        addFloatingNumber(this.x, this.y - 40, 'DEV ÇEKİÇ!', '#e67e22');
        dem.heat = Math.min(HEAT_MAX, dem.heat + 40);
        this.ultReady = false; this.ultCharge = 0;
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    function detonate(s) {
        getActiveEnemies().forEach(e => {
            if (dist(s, e) > SLAM_RADIUS + e.radius) return;
            hurt(e, SLAM_DMG, '#e67e22');
            knock(e, angOf(s, e), 8);
        });
        obstacles.forEach(o => { if (dist(s, o) <= SLAM_RADIUS + o.radius) o.hp -= 400; });
        particles(s.x, s.y, '#e67e22', 'normal');
        particles(s.x, s.y, '#7f8c8d', 'smoke');
        shake(18);
        fx.push({ x: s.x, y: s.y, r: SLAM_RADIUS, life: 16, maxLife: 16 });
        fx.push({ x: s.x, y: s.y, r: SLAM_RADIUS * 0.6, life: 22, maxLife: 22 });
    }

    // ------------------------------------------------------------- ARAYÜZ
    function ensureUI() {
        [ultiBtn, gadgetBtn, gadgetBtn2].forEach(el => { if (el.style.display !== 'flex') el.style.display = 'flex'; });
        if (gadgetBtn.dataset.m29 !== '1') {
            gadgetBtn.innerHTML = 'SAVURMA<br><span id="gadget-timer"></span>';
            gadgetBtn2.innerHTML = 'KISKAÇ<br><span id="gadget-timer-2"></span>';
            gadgetBtn.dataset.m29 = '1';
            gadgetTimerText = document.getElementById('gadget-timer');
            gadgetTimerText2 = document.getElementById('gadget-timer-2');
        }
    }

    // ------------------------------------------------------------- GÜNCELLE
    function tick(dt) {
        const P = player;
        const en = getActiveEnemies();

        if (!P.isDead) {
            // Pasif 2: Son Nefes Ateşi
            const low = P.hp < P.maxHp * 0.35;
            if (low !== dem.furyOn) {
                dem.furyOn = low;
                if (low) addFloatingNumber(P.x, P.y - 40, 'SON NEFES ATEŞİ!', '#f39c12');
            }
            // Pasif 1: ısı sönümü (2 sn vuruş yoksa)
            dem.idle += dt;
            if (dem.idle > 120 && dem.heat > 0) {
                dem.heat = Math.max(0, dem.heat - 0.2 * dt * (dem.furyOn ? 0.5 : 1));
            }
            charge(CHARGE_PER_FRAME * dt);
            if (dem.swing) { dem.swing.t += dt; if (dem.swing.t >= dem.swing.dur) dem.swing = null; }
        }

        // Kıskaç: sabitleme ve periyodik hasar
        const alive = new Set(en);
        for (let i = pins.length - 1; i >= 0; i--) {
            const pn = pins[i], e = pn.e;
            pn.timer -= dt; pn.tick += dt;
            const ok = alive.has(e) && e.hp > 0 && pn.timer > 0;
            if (!ok) { pins.splice(i, 1); continue; }
            e.x = pn.x; e.y = pn.y;
            e._m29kx = 0; e._m29ky = 0;
            if (pn.tick >= PIN_TICK_EVERY) { pn.tick = 0; hurt(e, PIN_DMG, '#e67e22'); }
        }

        // Dev Çekiç: gecikmeli patlama
        for (let i = slams.length - 1; i >= 0; i--) {
            const s = slams[i];
            s.timer -= dt;
            if (s.timer <= 0) { detonate(s); slams.splice(i, 1); }
        }

        // İtme (geri savrulma)
        for (let i = knocked.length - 1; i >= 0; i--) {
            const e = knocked[i];
            const vx = e._m29kx || 0, vy = e._m29ky || 0;
            if (Math.hypot(vx, vy) < 0.3 || !alive.has(e)) { e._m29kx = 0; e._m29ky = 0; knocked.splice(i, 1); continue; }
            e.x = clampRange(e.x + vx * dt, WALL_THICKNESS + e.radius, canvas.width - WALL_THICKNESS - e.radius);
            e.y = clampRange(e.y + vy * dt, WALL_THICKNESS + e.radius, canvas.height - WALL_THICKNESS - e.radius);
            const fr = Math.pow(0.82, dt);
            e._m29kx = vx * fr; e._m29ky = vy * fr;
        }

        for (let i = fx.length - 1; i >= 0; i--) { fx[i].life -= dt; if (fx[i].life <= 0) fx.splice(i, 1); }
    }

    // ------------------------------------------------------------------- ÇİZİM
    function drawWorld() {
        const c = ctx, p = player, d = dem;
        c.save();

        // Dev Çekiç telegraf'ı
        slams.forEach(s => {
            const t = 1 - s.timer / s.max;
            c.beginPath(); c.arc(s.x, s.y, SLAM_RADIUS, 0, Math.PI * 2);
            c.fillStyle = 'rgba(230,126,34,' + (0.08 + 0.14 * t) + ')'; c.fill();
            c.setLineDash([8, 6]); c.strokeStyle = 'rgba(230,126,34,0.8)'; c.lineWidth = 2; c.stroke();
            c.setLineDash([]);
            c.beginPath(); c.arc(s.x, s.y, Math.max(4, SLAM_RADIUS * t), 0, Math.PI * 2);
            c.strokeStyle = 'rgba(241,196,15,0.9)'; c.lineWidth = 3; c.stroke();
        });

        // Kıskaç zinciri ve halkası
        pins.forEach(pn => {
            const e = pn.e;
            const a = angOf(p, e);
            c.beginPath();
            c.moveTo(p.x + Math.cos(a) * (p.radius + 2), p.y + Math.sin(a) * (p.radius + 2));
            c.lineTo(e.x, e.y);
            c.strokeStyle = 'rgba(230,126,34,0.7)'; c.lineWidth = 2;
            c.setLineDash([5, 4]); c.lineDashOffset = -Date.now() / 60; c.stroke();
            c.beginPath(); c.arc(e.x, e.y, e.radius + 8, 0, Math.PI * 2);
            c.strokeStyle = '#e67e22'; c.lineWidth = 3;
            c.setLineDash([6, 4]); c.lineDashOffset = -Date.now() / 40; c.stroke();
            c.setLineDash([]); c.lineDashOffset = 0;
        });

        // Halkalar ve şok dalgaları
        fx.forEach(f => {
            const t = 1 - f.life / f.maxLife;
            c.globalAlpha = Math.max(0, f.life / f.maxLife);
            c.beginPath(); c.arc(f.x, f.y, f.r * (0.3 + 0.7 * t), 0, Math.PI * 2);
            c.strokeStyle = '#e67e22'; c.lineWidth = 4; c.stroke();
            c.globalAlpha = 1;
        });

        if (!p.isDead) {
            // Nişan önizlemeleri
            if (ultAim.active && p.ultReady) {
                const m = SLAM_RADIUS * 0.5;
                const tx = clampRange(p.x + Math.cos(ultAim.angle) * SLAM_DIST, WALL_THICKNESS + m, canvas.width - WALL_THICKNESS - m);
                const ty = clampRange(p.y + Math.sin(ultAim.angle) * SLAM_DIST, WALL_THICKNESS + m, canvas.height - WALL_THICKNESS - m);
                c.beginPath(); c.arc(tx, ty, SLAM_RADIUS, 0, Math.PI * 2);
                c.setLineDash([6, 6]); c.strokeStyle = 'rgba(241,196,15,0.7)'; c.lineWidth = 2; c.stroke();
                c.setLineDash([]);
            }
            if (gadAim.active && p.gadgetReady) {
                c.beginPath(); c.arc(p.x, p.y, SPIN_RANGE, 0, Math.PI * 2);
                c.fillStyle = 'rgba(230,126,34,0.12)'; c.fill();
                c.strokeStyle = 'rgba(230,126,34,0.6)'; c.lineWidth = 2; c.stroke();
            }
            if (gadAim2.active && p.gadget2Ready) {
                c.beginPath(); c.arc(p.x, p.y, PIN_RANGE, 0, Math.PI * 2);
                c.setLineDash([6, 6]); c.strokeStyle = 'rgba(230,126,34,0.5)'; c.lineWidth = 2; c.stroke();
                c.setLineDash([]);
            }

            const r = p.radius;
            // Isı halkası (gövdenin hemen dışında)
            if (d.heat > 0) {
                const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 160);
                c.beginPath(); c.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
                c.strokeStyle = d.heat >= 50
                    ? 'rgba(231,76,60,' + (0.3 + 0.5 * (d.heat / 100) * pulse) + ')'
                    : 'rgba(243,156,18,' + (0.3 + 0.5 * (d.heat / 100)) + ')';
                c.lineWidth = 2.5; c.stroke();
            }

            // Çekiç (elde, nişan yönünde; savurmada hareket eder)
            let base = p.angle || 0, off = 0;
            if (d.swing) {
                const pr = Math.min(1, d.swing.t / d.swing.dur);
                base = d.swing.ang;
                off = -0.8 + 1.3 * pr;
            }
            const ca = base + off;
            const hx = Math.cos(ca), hy = Math.sin(ca);
            c.beginPath();
            c.moveTo(p.x + hx * (r - 2), p.y + hy * (r - 2));
            c.lineTo(p.x + hx * (r + 6), p.y + hy * (r + 6));
            c.strokeStyle = '#6e4b2a'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
            c.save();
            c.translate(p.x + hx * (r + 6), p.y + hy * (r + 6));
            c.rotate(ca);
            c.fillStyle = '#5d6d7e'; c.fillRect(-2, -4, 8, 8);
            c.fillStyle = '#aab7b8'; c.fillRect(-2, -4, 8, 2);
            c.restore();

            // Isı barı (oyuncunun altında)
            c.fillStyle = '#444'; c.fillRect(p.x - 20, p.y + r + 10, 40, 3);
            c.fillStyle = d.heat >= 50 ? '#e74c3c' : '#f39c12';
            c.fillRect(p.x - 20, p.y + r + 10, 40 * (d.heat / 100), 3);

            // Savurma yayı
            if (d.swing) {
                const a = 1 - d.swing.t / d.swing.dur;
                c.beginPath(); c.moveTo(p.x, p.y);
                c.arc(p.x, p.y, HIT_RANGE, d.swing.ang - HIT_HALF, d.swing.ang + HIT_HALF);
                c.closePath();
                c.fillStyle = 'rgba(230,126,34,' + (0.25 * Math.max(0, a)) + ')'; c.fill();
            }
        }
        c.restore();
    }

    // ----------------------------------------------------- HOOK'LAR (varsa)
    const H = EXT.hooks;
    if (H) {
        const prevKilled = H.onEnemyKilled, prevReset = H.onReset;
        H.onEnemyKilled = function (e) {
            if (prevKilled) prevKilled.apply(this, arguments);
            if (typeof player !== 'undefined' && isMine(player)) charge(CHARGE_PER_KILL);
        };
        H.onReset = function () {
            needReset = true;
            if (prevReset) return prevReset.apply(this, arguments);
        };
    }

    // ------------------------------------------------------------- ANA DÖNGÜ
    function loop(t) {
        requestAnimationFrame(loop);
        if (typeof player === 'undefined' || typeof gameStarted === 'undefined') return;
        install(player);

        if (!last) last = t;
        const dt = Math.min(3, Math.max(0, (t - last) / 16.666));
        last = t;

        const mine = gameStarted && isMine(player);
        if (!mine) {
            if (wasActive) { resetState(); wasActive = false; }
            if (gameStarted && gadgetBtn.dataset.m29) delete gadgetBtn.dataset.m29;
            return;
        }
        try {
            if (!wasActive || needReset) { resetState(); wasActive = true; needReset = false; }
            ensureUI();
            tick(dt);
            drawWorld();
        } catch (err) {
            if (!warned) { warned = true; console.warn('[mod29] hata:', err); }
        }
    }
    requestAnimationFrame(loop);
})();
