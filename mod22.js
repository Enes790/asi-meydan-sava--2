/* ==========================================================================
   mod9.js  -  YENİ KARAKTER: "RESSAM"  (Mürekkep & Mühür Ustası)
   --------------------------------------------------------------------------
   Ana oyun koduna DOKUNMAZ. Sadece window.GAME_EXT kaydı + kendi rAF döngüsü
   + oyuncu metotlarını (sadece bu karakter seçiliyken) sarmalayarak çalışır.

   KİT:
   * Pasif  - MÜREKKEP İZİ: Gittiğin her yerde ~3 sn süren mürekkep izi bırakırsın.
              Düşmanlar izine değerse mürekkeplenir (yavaşlar, %30 fazla hasar alır).
   * MÜHÜR  - İzinle KAPALI BİR ÇEMBER çizersen (kendi izine geri dönersen)
              çemberin büyüklüğüne göre bir MÜHÜR patlar: hasar + sersemletme +
              mermi silme + 1 mermi geri + can. (Karakterin imza mekaniği!)
   * Ana atak - MÜREKKEP DAMLASI: Düz giden damla, çarpınca zemine mürekkep
              gölcüğü bırakır (yavaşlatır, hasar verir, SENİ hızlandırır).
   * Aksesuar 1 - MÜREKKEP PERDESİ: Düşman mermilerini yutan duvar. İçinden
              geçen damlalar %40 güçlenir.
   * Aksesuar 2 - ÇİZGİ ATILIMI: Hızlı, dokunulmaz bir atılım; arkasında uzun
              çizgi bırakır (çember çizmeyi kolaylaştırır).
   * ULTİ   - BAŞYAPIT: Hedefe dev bir ÇERÇEVE kurar; 1.2 sn sonra kapanır:
              içindekilere ağır hasar + uzun sersemletme, sonra 4 sn boyunca
              içeride düşmanlar yavaşlayıp erir, sen iyileşirsin.
   ========================================================================== */
(function () {
    'use strict';

    const ID = 'ressam';
    if (typeof window === 'undefined' || !window.GAME_EXT || typeof player === 'undefined') return;

    const P = player;
    const INK = '72,219,251', INKC = '#48dbfb', DEEP = '#0984e3';
    const TRAIL_LIFE = 190, MIN_AREA = 5500;

    // ---------------------------------------------------------------- KAYIT
    window.GAME_EXT.characters[ID] = { color: '#0abde3', hp: 3300, speed: 3.5 };

    // ---------------------------------------------------------- KARAKTER KARTI
    (function addCard() {
        const cont = document.querySelector('.char-select-container');
        if (!cont || document.getElementById('char-' + ID)) return;
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:radial-gradient(circle at 35% 30%,#b8f3ff,#0abde3 55%,#05547a)"></div>' +
            '<span>Ressam</span><small>Hasar: 700 + Mühür<br>Güç: Başyapıt</small>';
        card.addEventListener('click', () => {
            selectedCharacter = ID;
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
        cont.appendChild(card);
    })();

    // ------------------------------------------------------------------ DURUM
    let trail = [], puddles = [], walls = [], darts = [], frames = [], zones = [], flashes = [];
    let sealCd = 0, hint = null, wasActive = false, last = 0;
    let dashRef = null, dashSeen = 0, onInkNow = false, warned = false;

    function resetState() {
        trail = []; puddles = []; walls = []; darts = []; frames = []; zones = []; flashes = [];
        sealCd = 0; hint = null; dashRef = null; dashSeen = 0; onInkNow = false;
        if (P.charType === ID && P.originalSpeed) P.speed = P.originalSpeed;
        [bot, bot2].forEach(b => { b._m9ink = 0; b._m9stun = 0; b._m9px = undefined; b._m9py = undefined; });
    }

    // ---------------------------------------------------------------- YARDIMCI
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const ink = (e, f) => { e._m9ink = Math.max(e._m9ink || 0, f); };
    const inkBonus = e => (e._m9ink > 0 ? 1.3 : 1);
    function hurt(e, dmg, col) { e.hp -= dmg; addFloatingNumber(e.x, e.y, Math.floor(dmg), col || INKC); }
    function distSeg(p, a, b) {
        const abx = b.x - a.x, aby = b.y - a.y;
        let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby);
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
    }
    function polyArea(poly) {
        let s = 0;
        for (let i = 0, n = poly.length; i < n; i++) {
            const a = poly[i], b = poly[(i + 1) % n];
            s += a.x * b.y - b.x * a.y;
        }
        return Math.abs(s) / 2;
    }
    function clampRange(v, lo, hi) { return lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)); }
    function pullOf(aim, den) {
        if (aim.isMouse && typeof lastMouseX !== 'undefined') return Math.min(1, Math.hypot(lastMouseX - P.x, lastMouseY - P.y) / den);
        const p = aim.pull;
        return (p === undefined || p < 0.05) ? 1 : p;
    }
    function charge(n) {
        if (P.ultReady || P.isDead) return;
        P.ultCharge = Math.min(100, P.ultCharge + n);
        if (ultFill) ultFill.style.width = P.ultCharge + '%';
        if (P.ultCharge >= 100) {
            P.ultReady = true; ultiBtn.classList.add('ready');
            addFloatingNumber(P.x, P.y - 40, 'BAŞYAPIT HAZIR!', '#f1c40f');
        }
    }
    function addPuddle(x, y, r, life) {
        const blobs = [];
        for (let i = 0; i < 6; i++) blobs.push({ a: Math.random() * 6.28, d: r * (0.55 + Math.random() * 0.6), r: r * (0.18 + Math.random() * 0.2) });
        puddles.push({ x, y, r, life, max: life, tick: 0, blobs });
        if (puddles.length > 14) puddles.shift();
    }

    // ------------------------------------------------------ GEOMETRİ (aksesuar/ulti)
    function wallSpec(angle, pull) {
        const d = 70 + pull * 130, L = 85;
        const cx = clampRange(P.x + Math.cos(angle) * d, WALL_THICKNESS + 20, canvas.width - WALL_THICKNESS - 20);
        const cy = clampRange(P.y + Math.sin(angle) * d, WALL_THICKNESS + 20, canvas.height - WALL_THICKNESS - 20);
        const pa = angle + Math.PI / 2, ux = Math.cos(pa) * L, uy = Math.sin(pa) * L;
        return { cx, cy, a: { x: cx - ux, y: cy - uy }, b: { x: cx + ux, y: cy + uy } };
    }
    function ultCenter(angle) {
        const half = Math.max(90, Math.min(150, (Math.min(canvas.width, canvas.height) - WALL_THICKNESS * 2) / 2 - 10));
        const x = clampRange(P.x + Math.cos(angle) * 190, WALL_THICKNESS + half, canvas.width - WALL_THICKNESS - half);
        const y = clampRange(P.y + Math.sin(angle) * 190, WALL_THICKNESS + half, canvas.height - WALL_THICKNESS - half);
        return { x, y, half };
    }

    // ------------------------------------------------- OYUNCU METOTLARI (SARMALAMA)
    const orig = { fire: P.fire, g1: P.activateGadget, g2: P.activateGadget2, ult: P.fireUlti };

    P.fire = function (a, pull) {
        if (this.charType !== ID) return orig.fire.call(this, a, pull);
        if (this.isDead || this.ammo < 1) return;
        const sp = 11;
        darts.push({
            x: this.x + Math.cos(a) * this.radius, y: this.y + Math.sin(a) * this.radius,
            sx: this.x, sy: this.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: 700, boost: false
        });
        this.angle = a;
        this.consumeAmmo();
    };

    P.activateGadget = function (a, pull) {
        if (this.charType !== ID) return orig.g1.call(this, a, pull);
        if (!this.gadgetReady || this.isDead || this.isDashing) return;
        const ang = a !== undefined ? a : this.angle;
        const pl = pull !== undefined ? Math.max(0, Math.min(1, pull)) : 1;
        const s = wallSpec(ang, pl);
        walls.push({ a: s.a, b: s.b, cx: s.cx, cy: s.cy, life: 210, max: 210, hits: 0 });
        addFloatingNumber(s.cx, s.cy - 20, 'PERDE!', INKC);
        spawnParticles(s.cx, s.cy, INKC, 'normal');
        this.gadgetReady = false; this.gadgetCooldown = 780;
        gadgetBtn.classList.remove('active'); gadgetBtn.classList.add('cooldown');
    };

    P.activateGadget2 = function (a, pull) {
        if (this.charType !== ID) return orig.g2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        const ang = a !== undefined ? a : this.angle;
        const pl = pull !== undefined ? Math.max(0, Math.min(1, pull)) : 1;
        this.angle = ang;
        this.isDashing = true; this.dashAngle = ang; this.dashHitTargets = [];
        this.dashTimer = 8 + 14 * pl;
        spawnParticles(this.x, this.y, INKC, 'smoke');
        addFloatingNumber(this.x, this.y - 30, 'ÇİZGİ!', INKC);
        this.gadget2Ready = false; this.gadget2Cooldown = 600;
        gadgetBtn2.classList.add('cooldown');
    };

    P.fireUlti = function (a, pull) {
        if (this.charType !== ID) return orig.ult.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;
        const ang = a !== undefined ? a : this.angle;
        const c = ultCenter(ang);
        frames.push({ x: c.x, y: c.y, half: c.half, t: 72, max: 72 });
        addFloatingNumber(this.x, this.y - 40, 'BAŞYAPIT!', INKC);
        this.ultReady = false; this.ultCharge = 0;
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    };

    // ------------------------------------------------------------- ARAYÜZ DÜZELTME
    function ensureUI() {
        [ultiBtn, gadgetBtn, gadgetBtn2].forEach(el => { if (el.style.display !== 'flex') el.style.display = 'flex'; });
        if (gadgetBtn.dataset.m9 !== '1') {
            gadgetBtn.innerHTML = 'PERDE<br><span id="gadget-timer"></span>';
            gadgetBtn2.innerHTML = 'ÇİZGİ<br>ATILIM<br><span id="gadget-timer-2"></span>';
            gadgetBtn.dataset.m9 = '1';
            gadgetTimerText = document.getElementById('gadget-timer');
            gadgetTimerText2 = document.getElementById('gadget-timer-2');
        }
    }

    // ----------------------------------------------------------------- MÜHÜR
    function doSeal(poly, area) {
        let cx = 0, cy = 0;
        poly.forEach(p => { cx += p.x; cy += p.y; });
        cx /= poly.length; cy /= poly.length;
        const req = Math.sqrt(area / Math.PI);
        const R = Math.min(240, req * 1.35 + 70);
        let hits = 0;
        getActiveEnemies().forEach(e => {
            if (dist({ x: cx, y: cy }, e) < R + e.radius * 0.5) {
                hurt(e, 900 * inkBonus(e), INKC);
                e._m9stun = Math.max(e._m9stun || 0, 70);
                ink(e, 200);
                hits++;
            }
        });
        for (let i = botBullets.length - 1; i >= 0; i--) {
            if (Math.hypot(botBullets[i].x - cx, botBullets[i].y - cy) < req + 20) botBullets.splice(i, 1);
        }
        flashes.push({ poly: poly.map(p => ({ x: p.x, y: p.y })), cx, cy, R, life: 45, max: 45 });
        spawnParticles(cx, cy, INKC, 'normal');
        trail = [];
        sealCd = 60;
        addFloatingNumber(cx, cy - 20, 'MÜHÜR!', INKC);
        if (hits > 0) {
            P.ammo = Math.min(P.maxAmmo, P.ammo + 1);
            P.hp = Math.min(P.maxHp, P.hp + 180);
            addFloatingNumber(P.x, P.y - 10, '♥ +180', '#2ecc71');
            charge(18);
            screenShake = 8;
        }
    }

    function checkLoop() {
        hint = null;
        const n = trail.length;
        if (n < 16) return;
        const cur = { x: P.x, y: P.y };
        for (let k = 0; k < n - 14; k++) {
            const q = trail[k], d = dist(cur, q);
            if (d < 55) {
                const poly = trail.slice(k);
                const area = polyArea(poly);
                if (area >= MIN_AREA) {
                    if (d < 20) { doSeal(poly, area); return; }
                    if (!hint) hint = q;
                }
            }
        }
    }

    // ------------------------------------------------------------- BAŞYAPIT VURUŞU
    function strikeFrame(f) {
        getActiveEnemies().forEach(e => {
            if (Math.abs(e.x - f.x) < f.half + e.radius * 0.5 && Math.abs(e.y - f.y) < f.half + e.radius * 0.5) {
                hurt(e, 1300 * inkBonus(e), INKC);
                e._m9stun = Math.max(e._m9stun || 0, 110);
                ink(e, 240);
            }
        });
        for (let i = botBullets.length - 1; i >= 0; i--) {
            const b = botBullets[i];
            if (Math.abs(b.x - f.x) < f.half && Math.abs(b.y - f.y) < f.half) botBullets.splice(i, 1);
        }
        zones.push({ x: f.x, y: f.y, half: f.half, life: 240, max: 240, tick: 0 });
        flashes.push({ frame: true, cx: f.x, cy: f.y, half: f.half, life: 30, max: 30 });
        spawnParticles(f.x, f.y, INKC, 'smoke');
        screenShake = 14;
        addFloatingNumber(f.x, f.y - 20, 'TABLO KAPANDI!', INKC);
    }

    // ------------------------------------------------------------------ GÜNCELLE
    function tick(dt) {
        const now = Date.now();
        const en = getActiveEnemies();
        charge(0.5 * dt / 60);

        // --- mürekkep izi ---
        if (!P.isDead) {
            const lt = trail[trail.length - 1];
            if (!lt) trail.push({ x: P.x, y: P.y, life: TRAIL_LIFE });
            else {
                const dx = P.x - lt.x, dy = P.y - lt.y, d = Math.hypot(dx, dy);
                if (d >= 6) {
                    const n = Math.min(40, Math.floor(d / 6));
                    for (let i = 1; i <= n; i++) trail.push({ x: lt.x + dx * i / n, y: lt.y + dy * i / n, life: TRAIL_LIFE });
                }
            }
        }
        trail.forEach(p => { p.life -= dt; });
        while (trail.length && trail[0].life <= 0) trail.shift();

        sealCd -= dt;
        if (!P.isDead && sealCd <= 0) checkLoop(); else hint = null;

        // --- iz düşmana değerse ---
        en.forEach(e => {
            for (let i = 0; i < trail.length; i += 2) {
                const p = trail[i];
                if (Math.abs(p.x - e.x) < e.radius + 8 && Math.abs(p.y - e.y) < e.radius + 8 && dist(p, e) < e.radius + 7) { ink(e, 45); break; }
            }
        });

        // --- atılım takibi ---
        if (P.isDashing && P.dashHitTargets) {
            if (dashRef !== P.dashHitTargets) { dashRef = P.dashHitTargets; dashSeen = 0; }
            while (dashSeen < dashRef.length) { const e = dashRef[dashSeen++]; ink(e, 200); charge(9); }
        }

        // --- gölcükler ---
        onInkNow = false;
        for (let i = puddles.length - 1; i >= 0; i--) {
            const p = puddles[i];
            p.life -= dt; p.tick += dt;
            if (p.life <= 0) { puddles.splice(i, 1); continue; }
            const showNum = p.tick >= 60; if (showNum) p.tick = 0;
            en.forEach(e => {
                if (dist(e, p) < p.r + e.radius * 0.6) {
                    ink(e, 20);
                    e.hp -= 70 / 60 * dt;
                    if (showNum) addFloatingNumber(e.x, e.y, 70, INKC);
                }
            });
            if (!P.isDead && dist(P, p) < p.r + 8) onInkNow = true;
        }

        // --- Başyapıt çerçeveleri ---
        for (let i = frames.length - 1; i >= 0; i--) {
            frames[i].t -= dt;
            if (frames[i].t <= 0) { strikeFrame(frames[i]); frames.splice(i, 1); }
        }
        // --- tablo bölgeleri ---
        for (let i = zones.length - 1; i >= 0; i--) {
            const z = zones[i];
            z.life -= dt; z.tick += dt;
            if (z.life <= 0) { zones.splice(i, 1); continue; }
            const showNum = z.tick >= 60; if (showNum) z.tick = 0;
            en.forEach(e => {
                if (Math.abs(e.x - z.x) < z.half + e.radius * 0.5 && Math.abs(e.y - z.y) < z.half + e.radius * 0.5) {
                    ink(e, 20);
                    e.hp -= 80 / 60 * dt;
                    if (showNum) addFloatingNumber(e.x, e.y, 80, INKC);
                }
            });
            if (!P.isDead && Math.abs(P.x - z.x) < z.half && Math.abs(P.y - z.y) < z.half) {
                onInkNow = true;
                P.hp = Math.min(P.maxHp, P.hp + 110 / 60 * dt);
                if (showNum && P.hp < P.maxHp) addFloatingNumber(P.x, P.y, '♥ +110', '#2ecc71');
            }
        }
        P.speed = P.originalSpeed * (onInkNow ? 1.18 : 1);

        // --- perdeler ---
        for (let i = walls.length - 1; i >= 0; i--) {
            const w = walls[i];
            w.life -= dt;
            for (let j = botBullets.length - 1; j >= 0; j--) {
                const b = botBullets[j];
                if (distSeg(b, w.a, w.b) < 14) {
                    spawnParticles(b.x, b.y, INKC, 'normal');
                    botBullets.splice(j, 1); w.hits++; charge(5);
                }
            }
            if (w.life <= 0 || w.hits >= 10) {
                spawnParticles(w.cx, w.cy, INKC, 'smoke');
                walls.splice(i, 1);
            }
        }

        // --- damlalar ---
        for (let i = darts.length - 1; i >= 0; i--) {
            const d = darts[i];
            d.x += d.vx * dt; d.y += d.vy * dt;
            walls.forEach(w => {
                if (!d.boost && distSeg(d, w.a, w.b) < 14) {
                    d.boost = true; d.dmg *= 1.4;
                    addFloatingNumber(d.x, d.y - 10, 'DERİN!', '#feca57');
                }
            });
            let hit = null;
            for (const e of en) { if (dist(d, e) < e.radius + 9) { hit = e; break; } }
            if (hit) {
                hurt(hit, d.dmg, d.boost ? '#feca57' : INKC);
                ink(hit, 150); charge(9);
                addPuddle(hit.x, hit.y, 42, 130);
                spawnParticles(d.x, d.y, INKC, 'normal');
                darts.splice(i, 1); continue;
            }
            let blocked = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (dist(d, o) < o.radius + 6) { o.hp -= 120; blocked = true; break; }
            }
            const out = d.x < WALL_THICKNESS + 6 || d.x > canvas.width - WALL_THICKNESS - 6 ||
                        d.y < WALL_THICKNESS + 6 || d.y > canvas.height - WALL_THICKNESS - 6;
            const far = Math.hypot(d.x - d.sx, d.y - d.sy) > RANGE;
            if (blocked || out || far) {
                addPuddle(clampRange(d.x, WALL_THICKNESS + 10, canvas.width - WALL_THICKNESS - 10),
                          clampRange(d.y, WALL_THICKNESS + 10, canvas.height - WALL_THICKNESS - 10), 34, 110);
                spawnParticles(d.x, d.y, INKC, 'normal');
                darts.splice(i, 1);
            }
        }

        // --- flaşlar ---
        for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].life -= dt; if (flashes[i].life <= 0) flashes.splice(i, 1); }

        // --- düşman durumları (yavaşlama / sersemleme) ---
        en.forEach(e => {
            let drag = 0;
            if (e._m9stun > 0) {
                drag = 1; e._m9stun -= dt;
                if (e.lastShot !== undefined) e.lastShot = now - (e.shootInterval || 1500) * 0.55;
            } else if (e._m9ink > 0) { drag = 0.4; }
            if (e._m9ink > 0) e._m9ink -= dt;
            if (drag > 0 && e._m9px !== undefined) {
                const dx = e.x - e._m9px, dy = e.y - e._m9py;
                if (Math.hypot(dx, dy) < 25) { e.x = e._m9px + dx * (1 - drag); e.y = e._m9py + dy * (1 - drag); }
            }
            e._m9px = e.x; e._m9py = e.y;
        });
    }

    // ------------------------------------------------------------------- ÇİZİM
    function drawGround() {
        const t = Date.now();
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';

        flashes.forEach(f => {
            const k = f.life / f.max;
            if (f.frame) {
                ctx.fillStyle = `rgba(${INK},${0.35 * k})`;
                ctx.fillRect(f.cx - f.half, f.cy - f.half, f.half * 2, f.half * 2);
                return;
            }
            ctx.beginPath();
            f.poly.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
            ctx.closePath();
            ctx.fillStyle = `rgba(${INK},${0.3 * k})`; ctx.fill();
            ctx.strokeStyle = `rgba(255,255,255,${0.8 * k})`; ctx.lineWidth = 3; ctx.stroke();
            ctx.beginPath();
            ctx.arc(f.cx, f.cy, f.R * Math.min(1, (1 - k) * 2.5), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${INK},${k})`; ctx.lineWidth = 5; ctx.stroke();
        });

        zones.forEach(z => {
            const k = Math.min(1, z.life / 40);
            ctx.fillStyle = `rgba(${INK},${0.12 * k})`;
            ctx.fillRect(z.x - z.half, z.y - z.half, z.half * 2, z.half * 2);
            ctx.save();
            ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t / 40;
            ctx.strokeStyle = `rgba(${INK},${0.85 * k})`; ctx.lineWidth = 4;
            ctx.strokeRect(z.x - z.half, z.y - z.half, z.half * 2, z.half * 2);
            ctx.restore();
            ctx.strokeStyle = `rgba(255,255,255,${0.12 * k})`; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const r = z.half * (0.25 + i * 0.17), a = t / 700 + i;
                ctx.moveTo(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r);
                ctx.arc(z.x, z.y, r, a, a + 1.6);
            }
            ctx.stroke();
        });

        // iz
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 1; i < trail.length; i++) {
            const a = trail[i - 1], b = trail[i];
            const al = Math.min(0.6, b.life / 90);
            ctx.strokeStyle = `rgba(${INK},${al})`; ctx.lineWidth = 8;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,255,${al * 0.35})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }

        // gölcükler
        puddles.forEach(p => {
            const al = Math.min(0.5, p.life / 50);
            ctx.fillStyle = `rgba(${INK},${al})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
            p.blobs.forEach(b => { ctx.beginPath(); ctx.arc(p.x + Math.cos(b.a) * b.d, p.y + Math.sin(b.a) * b.d, b.r, 0, Math.PI * 2); ctx.fill(); });
            ctx.strokeStyle = `rgba(9,132,227,${al + 0.1})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.92, 0, Math.PI * 2); ctx.stroke();
        });
        ctx.restore();
    }

    function drawTop() {
        const t = Date.now();
        ctx.save();
        ctx.lineCap = 'round';

        // perdeler
        walls.forEach(w => {
            const k = Math.min(1, w.life / 40);
            ctx.save();
            ctx.globalAlpha = k;
            ctx.shadowColor = INKC; ctx.shadowBlur = 14;
            ctx.strokeStyle = DEEP; ctx.lineWidth = 12;
            ctx.beginPath(); ctx.moveTo(w.a.x, w.a.y); ctx.lineTo(w.b.x, w.b.y); ctx.stroke();
            ctx.strokeStyle = INKC; ctx.lineWidth = 7;
            ctx.beginPath(); ctx.moveTo(w.a.x, w.a.y); ctx.lineTo(w.b.x, w.b.y); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(w.a.x, w.a.y); ctx.lineTo(w.b.x, w.b.y); ctx.stroke();
            ctx.shadowBlur = 0; ctx.fillStyle = INKC;
            for (let i = 0; i < 7; i++) {
                const u = (i + 0.5) / 7, x = w.a.x + (w.b.x - w.a.x) * u, y = w.a.y + (w.b.y - w.a.y) * u;
                ctx.beginPath(); ctx.arc(x, y + 7 + Math.sin(t / 200 + i) * 2, 2.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
            }
            // dayanıklılık
            ctx.fillStyle = '#444'; ctx.fillRect(w.cx - 20, w.cy - 22, 40, 4);
            ctx.fillStyle = INKC; ctx.fillRect(w.cx - 20, w.cy - 22, 40 * (1 - w.hits / 10), 4);
            ctx.restore();
        });

        // Başyapıt çerçevesi (kapanırken)
        frames.forEach(f => {
            const prog = 1 - f.t / f.max;
            const s = f.half * (1 + (1 - prog) * 0.9);
            ctx.save();
            ctx.fillStyle = `rgba(${INK},${0.06 + 0.16 * prog})`;
            ctx.fillRect(f.x - f.half, f.y - f.half, f.half * 2, f.half * 2);
            ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.5 * prog})`; ctx.lineWidth = 3 + prog * 3;
            ctx.strokeRect(f.x - s, f.y - s, s * 2, s * 2);
            ctx.strokeStyle = INKC; ctx.lineWidth = 2;
            ctx.strokeRect(f.x - s - 8, f.y - s - 8, s * 2 + 16, s * 2 + 16);
            ctx.fillStyle = '#feca57';
            [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(c => { ctx.beginPath(); ctx.arc(f.x + c[0] * (s + 8), f.y + c[1] * (s + 8), 7, 0, Math.PI * 2); ctx.fill(); });
            ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
            ctx.fillText(Math.ceil(f.t / 60 * 10) / 10 + 's', f.x, f.y + 6);
            ctx.restore();
        });

        // damlalar
        darts.forEach(d => {
            ctx.save();
            ctx.strokeStyle = d.boost ? 'rgba(254,202,87,.55)' : `rgba(${INK},.5)`;
            ctx.lineWidth = 9;
            ctx.beginPath(); ctx.moveTo(d.x - d.vx * 1.6, d.y - d.vy * 1.6); ctx.lineTo(d.x, d.y); ctx.stroke();
            ctx.fillStyle = d.boost ? '#feca57' : '#0abde3';
            ctx.beginPath(); ctx.arc(d.x, d.y, d.boost ? 10 : 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.8)';
            ctx.beginPath(); ctx.arc(d.x - 2, d.y - 2, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });

        // mühür ipucu
        if (hint) {
            ctx.save();
            const r = 18 + Math.sin(t / 90) * 4;
            ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(hint.x, hint.y, r, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = INKC; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
            ctx.fillText('MÜHÜRLE!', hint.x, hint.y - r - 6);
            ctx.restore();
        }

        drawPreviews();
        drawPlayer(t);
        ctx.restore();
    }

    function drawPreviews() {
        if (P.isDead) return;
        if (gadAim.active && P.gadgetReady) {
            const s = wallSpec(gadAim.angle, pullOf(gadAim, RANGE * 0.8));
            ctx.save();
            ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(72,219,251,.5)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(s.cx, s.cy); ctx.stroke();
            ctx.setLineDash([]); ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(72,219,251,.45)';
            ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
            ctx.restore();
        }
        if (gadAim2.active && P.gadget2Ready) {
            const pl = pullOf(gadAim2, RANGE * 0.65);
            const dd = (8 + 14 * pl) * P.speed * 2.5;
            const tx = P.x + Math.cos(gadAim2.angle) * dd, ty = P.y + Math.sin(gadAim2.angle) * dd;
            ctx.save();
            ctx.strokeStyle = 'rgba(72,219,251,.55)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.beginPath(); ctx.arc(tx, ty, 14, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(72,219,251,.25)'; ctx.fill();
            ctx.restore();
        }
        if (ultAim.active && P.ultReady) {
            const c = ultCenter(ultAim.angle);
            ctx.save();
            ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(241,196,15,.6)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(c.x, c.y); ctx.stroke();
            ctx.strokeStyle = 'rgba(241,196,15,.9)'; ctx.lineWidth = 3;
            ctx.strokeRect(c.x - c.half, c.y - c.half, c.half * 2, c.half * 2);
            ctx.fillStyle = 'rgba(72,219,251,.12)';
            ctx.fillRect(c.x - c.half, c.y - c.half, c.half * 2, c.half * 2);
            ctx.restore();
        }
    }

    function drawPlayer(t) {
        if (P.isDead) return;
        ctx.save();
        ctx.translate(P.x, P.y);
        if (P.isInvisible) ctx.globalAlpha = 0.4;
        if (onInkNow) {
            ctx.beginPath(); ctx.arc(0, 0, P.radius + 7 + Math.sin(t / 120) * 2, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(72,219,251,.7)'; ctx.lineWidth = 3; ctx.stroke();
        }
        ctx.rotate(P.angle);
        // fırça
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#e1b97b'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(2, 11); ctx.lineTo(P.radius + 8, 11); ctx.stroke();
        ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(P.radius + 8, 11); ctx.lineTo(P.radius + 12, 11); ctx.stroke();
        ctx.save();
        ctx.shadowColor = INKC; ctx.shadowBlur = 10;
        ctx.fillStyle = INKC;
        ctx.beginPath(); ctx.arc(P.radius + 15, 11, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // bere
        ctx.fillStyle = '#2e3a8c';
        ctx.beginPath(); ctx.ellipse(-2, -2, 12, 10, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1b1f5a';
        ctx.beginPath(); ctx.arc(-2, -2, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(-2, -2, 12, 10, -0.3, 3.6, 5.2); ctx.stroke();
        ctx.restore();
    }

    // ------------------------------------------------------------- ANA DÖNGÜ
    function loop(t) {
        requestAnimationFrame(loop);
        if (!last) last = t;
        const dt = Math.min(3, Math.max(0, (t - last) / 16.666));
        last = t;

        const mine = gameStarted && P.charType === ID;
        if (!mine) {
            if (wasActive) { resetState(); wasActive = false; }
            if (gameStarted && gadgetBtn.dataset.m9 === '1') delete gadgetBtn.dataset.m9;
            return;
        }
        try {
            if (!wasActive) {
                resetState(); wasActive = true;
                addFloatingNumber(P.x, P.y - 45, 'ÇEMBER ÇİZ → MÜHÜRLE!', INKC);
            }
            ensureUI();
            tick(dt);
            drawGround();
            drawTop();
        } catch (err) {
            if (!warned) { warned = true; console.warn('[mod9] hata:', err); }
        }
    }
    requestAnimationFrame(loop);
})();
