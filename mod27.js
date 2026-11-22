/* ==========================================================================
   mod40.js  -  İKİ YENİ KARAKTER (MERMİ ATAN): "SİLAHŞOR" (Colt gibi) & "BARMEN" (Barley gibi)
   --------------------------------------------------------------------------
   mod30 / 37 / 38 / 39 ile AYNI yapı. Ana oyuna DOKUNMAZ; mermiler ve şişeler bu
   dosyanın KENDİ sistemidir (düşmana, engele, duvara çarparlar).
   Her karakter: 2 aksesuar (Q/E) + 1 güç (ulti) + 2 pasif.

   SİLAHŞOR (Colt gibi: uzun menzil, çok mermili)     HP 3200 / hız 3.2
     Ana atak   - ALTI PATLAR     : 6 mermilik seri atış, her mermi 280 hasar (hepsi isabet: 1680).
     Pasif 1    - KAYGAN ÇİZMELER : Hız +%13.
     Pasif 2    - MAGNUM ÖZEL     : Menzil ve mermi hızı +%11.
     Q          - HIZLI DOLDUR    : Anında 2 mühimmat yükler. BK 12 sn
     E          - GÜMÜŞ KURŞUN    : Bir sonraki seri: mermiler engel ve düşmanlardan geçer, +%30 hasar. BK 14 sn
     Güç        - KURŞUN FIRTINASI: 12 mermilik geniş yelpaze (300 hasar), çok uzun menzil, siperleri kırar.

   BARMEN (Barley gibi: topçu, şişe atar)              HP 2900 / hız 3.0
     Ana atak   - SULANDIRILMAMIŞ : Şişe fırlatır (çekiş uzaklığı belirler), 900 sıçrama hasarı,
                                    yere düşünce 3 sn yanan/zehirli birikinti bırakır.
     Pasif 1    - TIBBİ KULLANIM  : Şişen birine isabet ederse 180 can yenilenir.
     Pasif 2    - AŞIRI ZEHİRLİ   : Birikintiler saniyede +200 fazla hasar verir.
     Q          - YAPIŞKAN ŞURUP  : Yere yavaşlatan birikinti (yarıçap 90, 5 sn). BK 13 sn
     E          - BİTKİSEL TONİK  : Olduğun yere iyileştirici alan (3 sn, saniyede 240 can). BK 16 sn
     Güç        - SON ÇAĞRI       : 5 ateşli şişe birden, her biri 800 hasar + yanan alan.
   ========================================================================== */
(function () {
    'use strict';

    if (typeof window === 'undefined' || !window.GAME_EXT) return;

    const SH = 'silahsor', BM = 'barmen';
    const EXT = window.GAME_EXT;
    const CHARGE_PER_FRAME = 100 / 3600; // ~60 sn'de dolar
    const CHARGE_PER_KILL = 25;

    // ---- Silahşor denge sabitleri ----
    const SH_BULLETS = 6, SH_DMG = 280, SH_GAP = 2, SH_SPEED = 18, SH_RANGE = 520, SH_R = 5, SH_JIT = 0.03;
    const SH_BOOT = 1.13, SH_MAGNUM = 1.11;
    const SH_Q_AMMO = 2, SH_Q_CD = 720;
    const SH_SILVER_MULT = 1.3, SH_E_CD = 840;
    const SH_STORM_N = 12, SH_STORM_DMG = 300, SH_STORM_SPREAD = 0.3, SH_STORM_GAP = 2, SH_STORM_RANGE = 660, SH_STORM_SPEED = 20, SH_STORM_COVER = 300;

    // ---- Barmen denge sabitleri ----
    const BM_DMG = 900, BM_SPLASH = 70, BM_MIN = 110, BM_MAX = 470, BM_DEFAULT = 340, BM_FLIGHT = 34;
    const BM_PUDDLE_R = 80, BM_PUDDLE_TIME = 180, BM_TICK = 20, BM_PUDDLE_DMG = 60, BM_NOXIOUS = 200 / 3; // +200/sn = +67 / 20 kare
    const BM_HEAL_HIT = 180;
    const BM_SYRUP_R = 90, BM_SYRUP_TIME = 300, BM_SLOW = 0.5, BM_Q_CD = 780;
    const BM_TONIC_R = 90, BM_TONIC_TIME = 180, BM_TONIC_HEAL = 240 / 3, BM_E_CD = 960; // 240/sn = 80 / 20 kare
    const BM_ULT_N = 5, BM_ULT_DMG = 800, BM_ULT_SPREAD = 120, BM_ULT_GAP = 5, BM_ULT_SPLASH = 65;

    // ---------------------------------------------------------------- KAYIT
    EXT.characters[SH] = { color: '#d9a441', hp: 3200, speed: 3.2 };
    EXT.characters[BM] = { color: '#8bc34a', hp: 2900, speed: 3.0 };

    // ---------------------------------------------------------- KARAKTER KARTLARI
    function addCard(id, name, grad, desc) {
        const cont = document.querySelector('.char-select-container');
        if (!cont || document.getElementById('char-' + id)) return;
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + id;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + grad + '"></div>' +
            '<span>' + name + '</span><small>' + desc + '</small>';
        card.addEventListener('click', () => {
            selectedCharacter = id;
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
        cont.appendChild(card);
    }
    addCard(SH, 'Silahşor',
        'radial-gradient(circle at 35% 30%,#ffe7b0,#d9a441 55%,#6b4a12)',
        'Uzun menzil · 6 mermi<br>Yetenek: Hızlı Doldur / Gümüş Kurşun<br>Güç: Kurşun Fırtınası');
    addCard(BM, 'Barmen',
        'radial-gradient(circle at 35% 30%,#e3f6c4,#8bc34a 55%,#33531a)',
        'Topçu · şişe atar<br>Yetenek: Yapışkan Şurup / Bitkisel Tonik<br>Güç: Son Çağrı');

    // ------------------------------------------------------------------ DURUM
    let fx = [], beams = [], knocked = [], shots = [], lobs = [], zones = [], queue = [];
    let now = 0;
    const sh = { silver: false, storm: false };
    const hpw = { last: 0, lastHit: 0 };
    let curChar = null, wasActive = false, last = 0, warned = false, needReset = false;

    function resetState() {
        knocked.forEach(e => { e._m40kx = 0; e._m40ky = 0; });
        zones.forEach(z => { if (z.slowed) z.slowed.forEach(s => { if (s.e) s.e.speed = s.base; }); });
        fx = []; beams = []; knocked = []; shots = []; lobs = []; zones = []; queue = [];
        sh.silver = false; sh.storm = false;
        if (typeof player !== 'undefined') {
            hpw.last = player.hp; hpw.lastHit = now;
            if (player.originalSpeed) player.speed = player.originalSpeed;
        }
    }

    // ---------------------------------------------------------------- YARDIMCI
    const isBm = p => p.charType === BM;
    const isSh = p => p.charType === SH;
    const isMine = p => isBm(p) || isSh(p);
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const angOf = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
    function absAngDiff(a, b) {
        let d = a - b;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return Math.abs(d);
    }
    function clampRange(v, lo, hi) { return lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)); }
    function hurt(e, dmg, col) {
        if (!e || !(e.hp > 0)) return;
        e.hp -= dmg;
        addFloatingNumber(e.x, e.y, Math.floor(dmg), col || '#ffffff');
    }
    function say(x, y, s, col) { addFloatingNumber(x, y, s, col || '#ffffff'); }
    function ring(x, y, col, r, life) { fx.push({ kind: 'ring', x, y, col, r, life: life || 22, max: life || 22 }); }
    function puff(x, y, col, n) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 0.5 + Math.random() * 1.8;
            fx.push({ kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.4,
                      size: 2 + Math.random() * 3, col, life: 26 + Math.random() * 16, max: 42 });
        }
    }
    function shake(n) { screenShake = Math.max(typeof screenShake === 'number' ? screenShake : 0, n); }
    function allObstacles() {
        const extra = (typeof cactusWalls !== 'undefined' && cactusWalls) ? cactusWalls : [];
        return obstacles.concat(extra);
    }
    function charge(n) {
        if (player.ultReady || player.isDead || sh.storm) return;
        player.ultCharge = Math.min(100, player.ultCharge + n);
        if (ultFill) ultFill.style.width = player.ultCharge + '%';
        if (player.ultCharge >= 100) {
            player.ultReady = true;
            ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, 'GÜÇ HAZIR!', '#f1c40f');
        }
    }
    function spendUlt() {
        player.ultReady = false; player.ultCharge = 0;
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }
    function setCd1(p, frames) {
        p.gadgetReady = false; p.gadgetCooldown = frames;
        gadgetBtn.classList.remove('active'); gadgetBtn.classList.add('cooldown');
    }
    function setCd2(p, frames) {
        p.gadget2Ready = false; p.gadget2Cooldown = frames;
        gadgetBtn2.classList.add('cooldown');
    }
    // Düşmanı itmek için kendi itme sistemimiz (ana kodun alanlarına güvenmez)
    function knock(e, ang, power) {
        e._m40kx = (e._m40kx || 0) + Math.cos(ang) * power;
        e._m40ky = (e._m40ky || 0) + Math.sin(ang) * power;
        if (knocked.indexOf(e) < 0) knocked.push(e);
    }
    function heal(P, amount) {
        if (amount <= 0 || P.isDead) return;
        P.hp = Math.min(P.maxHp, P.hp + amount);
    }
    // Çizgi taraması: engel olmadan ulaşılan uzaklık + çizgideki düşmanlar (yakından uzağa)
    function scanLine(ox, oy, ang, L, halfW) {
        const cx = Math.cos(ang), sy = Math.sin(ang);
        let blockD = L, blocker = null;
        allObstacles().forEach(o => {
            const dx = o.x - ox, dy = o.y - oy;
            const proj = dx * cx + dy * sy;
            const perp = Math.abs(dx * sy - dy * cx);
            if (proj > 0 && proj <= L + o.radius && perp <= o.radius + 2) {
                const d = Math.max(0, proj - o.radius);
                if (d < blockD) { blockD = d; blocker = o; }
            }
        });
        const list = [];
        getActiveEnemies().forEach(e => {
            if (!(e.hp > 0)) return;
            const dx = e.x - ox, dy = e.y - oy;
            const proj = dx * cx + dy * sy;
            const perp = Math.abs(dx * sy - dy * cx);
            if (proj > 0 && proj <= blockD + e.radius * 0.5 && proj <= L + e.radius && perp <= halfW + e.radius) {
                list.push({ e, proj });
            }
        });
        list.sort((p, q) => p.proj - q.proj);
        return { list, blockD, blocker };
    }


    // ---------------------------------------------------------- KENDİ MERMİ SİSTEMİMİZ
    function addShot(x, y, ang, speed, range, dmg, r, col, opt) {
        const b = { x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, left: range, dmg, r, col, hit: [], pierce: false, thru: false, cover: 60 };
        if (opt) Object.assign(b, opt);
        shots.push(b);
    }
    function updateShots(dt) {
        const en = getActiveEnemies();
        const obs = allObstacles();
        for (let i = shots.length - 1; i >= 0; i--) {
            const b = shots[i];
            const sp = Math.hypot(b.vx, b.vy) * dt;
            const steps = Math.max(1, Math.ceil(sp / 8));
            let dead = false;
            for (let s = 0; s < steps && !dead; s++) {
                b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
                b.left -= sp / steps;
                if (b.x < WALL_THICKNESS || b.y < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) { dead = true; break; }
                if (!b.thru) {
                    for (const o of obs) {
                        if (Math.hypot(b.x - o.x, b.y - o.y) < o.radius + b.r) { o.hp -= b.cover; dead = true; break; }
                    }
                    if (dead) break;
                }
                for (const e of en) {
                    if (!(e.hp > 0) || b.hit.indexOf(e) >= 0) continue;
                    if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + b.r) {
                        hurt(e, b.dmg, b.col);
                        knock(e, Math.atan2(b.vy, b.vx), 1.5);
                        charge(b.storm ? 1 : 2);
                        b.hit.push(e);
                        if (!b.pierce) { dead = true; break; }
                    }
                }
            }
            if (!dead && b.left <= 0) dead = true;
            if (dead) shots.splice(i, 1);
        }
        if (shots.length > 200) shots.splice(0, shots.length - 200);
    }

    // ---- Barmen: fırlatılan şişeler (havadan gider, engelleri aşar) ----
    function addLob(sx, sy, tx, ty, dmg, splash, delay, big) {
        lobs.push({ sx, sy, tx, ty, t: -(delay || 0), dur: BM_FLIGHT, dmg, splash, big: !!big });
    }
    function addPuddle(x, y, r, time, kind) {
        zones.push({ x, y, r, left: time, tick: 6, kind, slowed: [] });
    }
    function lobLand(L) {
        let hit = 0;
        getActiveEnemies().forEach(e => {
            if (e.hp > 0 && Math.hypot(e.x - L.tx, e.y - L.ty) <= L.splash + e.radius) {
                hurt(e, L.dmg, '#b9f26a');
                knock(e, Math.atan2(e.y - L.ty, e.x - L.tx), 4);
                hit++;
            }
        });
        allObstacles().forEach(o => { if (Math.hypot(o.x - L.tx, o.y - L.ty) <= L.splash + o.radius) o.hp -= 150; });
        if (hit > 0) {
            charge(8 * hit);
            if (isBm(player) && !player.isDead) { // Pasif 1: Tıbbi Kullanım
                player.hp = Math.min(player.maxHp, player.hp + BM_HEAL_HIT);
                hpw.last = player.hp;
                say(player.x, player.y - 30, '+' + BM_HEAL_HIT, '#2ecc71');
            }
        }
        ring(L.tx, L.ty, '#b9f26a', L.splash, 18);
        puff(L.tx, L.ty, '#d7f59a', 8);
        shake(L.big ? 7 : 4);
        addPuddle(L.tx, L.ty, BM_PUDDLE_R, BM_PUDDLE_TIME, 'burn');
    }
    function updateLobs(dt) {
        for (let i = lobs.length - 1; i >= 0; i--) {
            const L = lobs[i];
            L.t += dt;
            if (L.t >= L.dur) { lobs.splice(i, 1); lobLand(L); }
        }
    }
    function enemySlow(z, e) {
        if (typeof e.speed !== 'number') return;
        let s = z.slowed.find(x => x.e === e);
        if (!s) { s = { e, base: e.speed }; z.slowed.push(s); }
        e.speed = s.base * BM_SLOW;
    }
    function updateZones(dt) {
        const en = getActiveEnemies();
        for (let i = zones.length - 1; i >= 0; i--) {
            const z = zones[i];
            z.left -= dt; z.tick -= dt;
            const doTick = z.tick <= 0;
            if (doTick) z.tick += (z.kind === 'tonic' ? BM_TICK : BM_TICK);
            if (z.kind === 'burn' && doTick) {
                en.forEach(e => {
                    if (e.hp > 0 && Math.hypot(e.x - z.x, e.y - z.y) <= z.r + e.radius) hurt(e, Math.round(BM_PUDDLE_DMG + BM_NOXIOUS), '#9be04a');
                }); // Pasif 2: Aşırı Zehirli (+200/sn)
            }
            if (z.kind === 'syrup') {
                // yavaşlat: içindekilere hız çarpanı, çıkanlara geri ver
                en.forEach(e => {
                    const inside = e.hp > 0 && Math.hypot(e.x - z.x, e.y - z.y) <= z.r + e.radius;
                    const rec = z.slowed.find(s => s.e === e);
                    if (inside) enemySlow(z, e);
                    else if (rec) { e.speed = rec.base; z.slowed.splice(z.slowed.indexOf(rec), 1); }
                });
            }
            if (z.kind === 'tonic' && doTick && !player.isDead && Math.hypot(player.x - z.x, player.y - z.y) <= z.r + player.radius) {
                const b = player.hp;
                player.hp = Math.min(player.maxHp, player.hp + BM_TONIC_HEAL);
                hpw.last = player.hp;
                if (player.hp > b) say(player.x, player.y - 30, '+' + Math.round(player.hp - b), '#2ecc71');
            }
            if (Math.random() < 0.4 * dt) puff(z.x + (Math.random() - 0.5) * z.r * 1.6, z.y + (Math.random() - 0.5) * z.r * 1.6,
                z.kind === 'burn' ? '#9be04a' : z.kind === 'syrup' ? '#c98c3d' : '#7ef0a1', 1);
            if (z.left <= 0) {
                z.slowed.forEach(s => { if (s.e) s.e.speed = s.base; });
                zones.splice(i, 1);
            }
        }
    }

    // ---- sıralı atışlar (seri) ----
    function updateQueue(dt) {
        for (let i = queue.length - 1; i >= 0; i--) {
            const q = queue[i];
            q.wait -= dt;
            while (q.wait <= 0 && q.n > 0) {
                q.fn(q.total - q.n);
                q.n--; q.wait += q.gap;
            }
            if (q.n <= 0) queue.splice(i, 1);
        }
    }

    // ------------------------------------------------- OYUNCU METOTLARI (SARMALAMA)
    function install(p) {
        if (p.__m40) return;
        p.__m40 = true;
        const orig = { fire: p.fire, g1: p.activateGadget, g2: p.activateGadget2, ult: p.fireUlti };

        p.fire = function (a, pull) {
            if (isSh(this)) return shShot.call(this, a, pull);
            if (isBm(this)) return bmBottle.call(this, a, pull);
            return orig.fire.apply(this, arguments);
        };
        p.activateGadget = function (a, pull) {
            if (isSh(this)) return shReload.call(this, a, pull);
            if (isBm(this)) return bmSyrup.call(this, a, pull);
            return orig.g1.apply(this, arguments);
        };
        p.activateGadget2 = function (a, pull) {
            if (isSh(this)) return shSilver.call(this, a, pull);
            if (isBm(this)) return bmTonic.call(this, a, pull);
            return orig.g2.apply(this, arguments);
        };
        p.fireUlti = function (a, pull) {
            if (isSh(this)) return shStorm.call(this, a, pull);
            if (isBm(this)) return bmLastCall.call(this, a, pull);
            return orig.ult.apply(this, arguments);
        };
    }

    // ========================================================================
    //  SİLAHŞOR
    // ========================================================================
    function shRangeK() { return SH_MAGNUM; } // Pasif 2: Magnum Özel

    // Ana atak: ALTI PATLAR
    function shShot(a) {
        if (this.isDead || this.ammo < 1 || sh.storm) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        this.consumeAmmo();
        const silver = sh.silver;
        sh.silver = false;
        const K = shRangeK();
        queue.push({ wait: 0, gap: SH_GAP, n: SH_BULLETS, total: SH_BULLETS, fn: () => {
            const P = player;
            if (P.isDead) return;
            const aa = ang + (Math.random() * 2 - 1) * SH_JIT;
            addShot(P.x + Math.cos(aa) * P.radius, P.y + Math.sin(aa) * P.radius, aa, SH_SPEED * K, SH_RANGE * K,
                    Math.round(SH_DMG * (silver ? SH_SILVER_MULT : 1)), SH_R, silver ? '#e6e6f0' : '#ffd36a',
                    silver ? { pierce: true, thru: true } : null);
            puff(P.x + Math.cos(aa) * 26, P.y + Math.sin(aa) * 26, '#ffd36a', 1);
        } });
        shake(2);
    }

    // Q: HIZLI DOLDUR
    function shReload() {
        if (!this.gadgetReady || this.isDead) return;
        this.ammo = Math.min(this.maxAmmo, this.ammo + SH_Q_AMMO);
        ring(this.x, this.y, '#ffd36a', 55, 20);
        say(this.x, this.y - 34, 'HIZLI DOLDUR!', '#ffd36a');
        setCd1(this, SH_Q_CD);
    }

    // E: GÜMÜŞ KURŞUN
    function shSilver() {
        if (!this.gadget2Ready || this.isDead) return;
        sh.silver = true;
        ring(this.x, this.y, '#e6e6f0', 55, 20);
        say(this.x, this.y - 34, 'GÜMÜŞ KURŞUN!', '#e6e6f0');
        setCd2(this, SH_E_CD);
    }

    // Güç: KURŞUN FIRTINASI
    function shStorm(a) {
        if (!this.ultReady || this.isDead || sh.storm) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        sh.storm = true;
        spendUlt();
        say(this.x, this.y - 40, 'KURŞUN FIRTINASI!', '#ffd36a');
        const K = shRangeK();
        queue.push({ wait: 0, gap: SH_STORM_GAP, n: SH_STORM_N, total: SH_STORM_N, fn: idx => {
            const P = player;
            if (P.isDead) { sh.storm = false; return; }
            const f = SH_STORM_N === 1 ? 0 : idx / (SH_STORM_N - 1) - 0.5;
            const aa = ang + f * 2 * SH_STORM_SPREAD;
            addShot(P.x + Math.cos(aa) * P.radius, P.y + Math.sin(aa) * P.radius, aa, SH_STORM_SPEED * K, SH_STORM_RANGE * K,
                    SH_STORM_DMG, 6, '#ffb347', { cover: SH_STORM_COVER, storm: true });
            if (idx === SH_STORM_N - 1) sh.storm = false;
            shake(3);
        } });
    }

    // ========================================================================
    //  BARMEN
    // ========================================================================
    function targetDist(pull) {
        if (typeof pull === 'number' && pull > 0 && pull <= 1) return BM_MIN + pull * (BM_MAX - BM_MIN);
        return BM_DEFAULT;
    }
    function clampPoint(x, y) {
        return { x: clampRange(x, WALL_THICKNESS + 8, canvas.width - WALL_THICKNESS - 8),
                 y: clampRange(y, WALL_THICKNESS + 8, canvas.height - WALL_THICKNESS - 8) };
    }

    // Ana atak: SULANDIRILMAMIŞ
    function bmBottle(a, pull) {
        if (this.isDead || this.ammo < 1) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        this.consumeAmmo();
        const d = targetDist(pull);
        const t = clampPoint(this.x + Math.cos(ang) * d, this.y + Math.sin(ang) * d);
        addLob(this.x, this.y, t.x, t.y, BM_DMG, BM_SPLASH, 0, false);
        puff(this.x + Math.cos(ang) * 24, this.y + Math.sin(ang) * 24, '#b9f26a', 3);
    }

    // Q: YAPIŞKAN ŞURUP
    function bmSyrup(a, pull) {
        if (!this.gadgetReady || this.isDead) return;
        const ang = a !== undefined ? a : this.angle;
        const d = Math.min(targetDist(pull), 300);
        const t = clampPoint(this.x + Math.cos(ang) * d, this.y + Math.sin(ang) * d);
        addPuddle(t.x, t.y, BM_SYRUP_R, BM_SYRUP_TIME, 'syrup');
        ring(t.x, t.y, '#c98c3d', BM_SYRUP_R, 22);
        say(this.x, this.y - 34, 'YAPIŞKAN ŞURUP!', '#c98c3d');
        setCd1(this, BM_Q_CD);
    }

    // E: BİTKİSEL TONİK
    function bmTonic() {
        if (!this.gadget2Ready || this.isDead) return;
        addPuddle(this.x, this.y, BM_TONIC_R, BM_TONIC_TIME, 'tonic');
        ring(this.x, this.y, '#7ef0a1', BM_TONIC_R, 22);
        say(this.x, this.y - 34, 'BİTKİSEL TONİK!', '#7ef0a1');
        setCd2(this, BM_E_CD);
    }

    // Güç: SON ÇAĞRI
    function bmLastCall(a, pull) {
        if (!this.ultReady || this.isDead) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        const d = targetDist(pull) + 40;
        const c = clampPoint(this.x + Math.cos(ang) * d, this.y + Math.sin(ang) * d);
        for (let i = 0; i < BM_ULT_N; i++) {
            const k = (i / BM_ULT_N) * Math.PI * 2 + Math.random();
            const rr = i === 0 ? 0 : 40 + Math.random() * BM_ULT_SPREAD * 0.7;
            const t = clampPoint(c.x + Math.cos(k) * rr, c.y + Math.sin(k) * rr);
            addLob(this.x, this.y, t.x, t.y, BM_ULT_DMG, BM_ULT_SPLASH, i * BM_ULT_GAP, true);
        }
        say(this.x, this.y - 40, 'SON ÇAĞRI!', '#ff8a3a');
        shake(8);
        spendUlt();
    }

    // ------------------------------------------------------------- ARAYÜZ
    function ensureUI() {
        [ultiBtn, gadgetBtn, gadgetBtn2].forEach(el => { if (el.style.display !== 'flex') el.style.display = 'flex'; });
        const tag = player.charType;
        if (gadgetBtn.dataset.m40 !== tag) {
            const L = tag === SH ? ['HIZLI<br>DOLDUR', 'GÜMÜŞ<br>KURŞUN'] : ['YAPIŞKAN<br>ŞURUP', 'BİTKİSEL<br>TONİK'];
            gadgetBtn.innerHTML = L[0] + '<br><span id="gadget-timer"></span>';
            gadgetBtn2.innerHTML = L[1] + '<br><span id="gadget-timer-2"></span>';
            gadgetBtn.dataset.m40 = tag;
            gadgetTimerText = document.getElementById('gadget-timer');
            gadgetTimerText2 = document.getElementById('gadget-timer-2');
        }
    }

    // ------------------------------------------------------------- GÜNCELLE
    function tick(dt) {
        const P = player;
        const en = getActiveEnemies();
        now += dt;
        const alive = new Set(en);

        if (!P.isDead && P.hp < hpw.last) hpw.lastHit = now;
        if (!P.isDead) charge(CHARGE_PER_FRAME * dt);

        updateQueue(dt);
        updateShots(dt);
        updateLobs(dt);
        updateZones(dt);

        // --- Hız çarpanı (Silahşor: Kaygan Çizmeler) ---
        if (P.originalSpeed) {
            let m = 1;
            if (isSh(P)) m *= SH_BOOT;
            P.speed = P.originalSpeed * m;
        }

        // --- İtme ---
        for (let i = knocked.length - 1; i >= 0; i--) {
            const e = knocked[i];
            const vx = e._m40kx || 0, vy = e._m40ky || 0;
            if (Math.hypot(vx, vy) < 0.3 || !alive.has(e)) { e._m40kx = 0; e._m40ky = 0; knocked.splice(i, 1); continue; }
            e.x = clampRange(e.x + vx * dt, WALL_THICKNESS + e.radius, canvas.width - WALL_THICKNESS - e.radius);
            e.y = clampRange(e.y + vy * dt, WALL_THICKNESS + e.radius, canvas.height - WALL_THICKNESS - e.radius);
            const fr = Math.pow(0.82, dt);
            e._m40kx = vx * fr; e._m40ky = vy * fr;
        }

        // --- Efektler ---
        for (let i = fx.length - 1; i >= 0; i--) {
            const f = fx[i];
            f.life -= dt;
            if (f.kind === 'dot') { f.x += f.vx * dt; f.y += f.vy * dt; }
            if (f.life <= 0) fx.splice(i, 1);
        }
        if (fx.length > 220) fx.splice(0, fx.length - 220);
        for (let i = beams.length - 1; i >= 0; i--) { beams[i].life -= dt; if (beams[i].life <= 0) beams.splice(i, 1); }

        hpw.last = P.hp;
    }

    // ------------------------------------------------------------------- ÇİZİM
    function drawBar(label, frac, col, y) {
        const c = ctx;
        c.save();
        c.globalAlpha = 0.9;
        c.fillStyle = col; c.font = 'bold 22px monospace'; c.textAlign = 'center';
        c.fillText(label, canvas.width / 2, y || 60);
        c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(canvas.width / 2 - 120, (y || 60) + 12, 240, 6);
        c.fillStyle = col; c.fillRect(canvas.width / 2 - 120, (y || 60) + 12, 240 * Math.max(0, Math.min(1, frac)), 6);
        c.restore();
    }

    function drawBeams() {
        const c = ctx;
        beams.forEach(b => {
            const a = Math.max(0, b.life / b.max);
            const col = b.col || '#ff7a3d';
            c.save();
            c.globalAlpha = a; c.lineCap = 'round';
            c.shadowColor = col; c.shadowBlur = 14;
            c.strokeStyle = col; c.lineWidth = 12 * a + 3;
            c.beginPath(); c.moveTo(b.x1, b.y1); c.lineTo(b.x2, b.y2); c.stroke();
            c.shadowBlur = 0;
            c.strokeStyle = '#ffffff'; c.lineWidth = 3 * a + 1; c.stroke();
            c.restore();
        });
    }

    function drawFx() {
        const c = ctx;
        fx.forEach(f => {
            const a = Math.max(0, f.life / f.max);
            c.save();
            if (f.kind === 'ring') {
                const t = 1 - a;
                c.globalAlpha = a; c.strokeStyle = f.col; c.lineWidth = 2 + 3 * a;
                c.beginPath(); c.arc(f.x, f.y, f.r * (0.25 + 0.75 * t), 0, Math.PI * 2); c.stroke();
            } else {
                c.globalAlpha = a * 0.8; c.fillStyle = f.col;
                c.beginPath(); c.arc(f.x, f.y, f.size, 0, Math.PI * 2); c.fill();
            }
            c.restore();
        });
    }


    function drawShots() {
        const c = ctx;
        shots.forEach(b => {
            c.save();
            c.globalAlpha = 0.4; c.strokeStyle = b.col; c.lineWidth = b.r;
            c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - b.vx * 1.2, b.y - b.vy * 1.2); c.stroke();
            c.globalAlpha = 1; c.fillStyle = b.col;
            c.shadowColor = b.col; c.shadowBlur = 7;
            c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
            c.restore();
        });
    }

    function drawLobsAndZones() {
        const c = ctx;
        zones.forEach(z => {
            const k = Math.min(1, z.left / 30);
            const col = z.kind === 'burn' ? '155,224,74' : z.kind === 'syrup' ? '201,140,61' : '126,240,161';
            c.save();
            c.globalAlpha = 0.8 * k;
            const g = c.createRadialGradient(z.x, z.y, z.r * 0.1, z.x, z.y, z.r);
            g.addColorStop(0, 'rgba(' + col + ',0.45)');
            g.addColorStop(1, 'rgba(' + col + ',0.18)');
            c.fillStyle = g;
            c.beginPath(); c.arc(z.x, z.y, z.r, 0, Math.PI * 2); c.fill();
            c.strokeStyle = 'rgba(' + col + ',0.9)'; c.lineWidth = 2; c.setLineDash([6, 6]);
            c.beginPath(); c.arc(z.x, z.y, z.r, 0, Math.PI * 2); c.stroke();
            c.restore();
        });
        lobs.forEach(L => {
            if (L.t < 0) return;
            const k = L.t / L.dur;
            const x = L.sx + (L.tx - L.sx) * k, y = L.sy + (L.ty - L.sy) * k - Math.sin(k * Math.PI) * 60;
            c.save();
            c.globalAlpha = 0.5; c.strokeStyle = '#d7f59a'; c.lineWidth = 2; c.setLineDash([4, 5]);
            c.beginPath(); c.arc(L.tx, L.ty, L.splash, 0, Math.PI * 2); c.stroke();
            c.setLineDash([]); c.globalAlpha = 0.3; c.fillStyle = '#000';
            c.beginPath(); c.ellipse(x, y + Math.sin(k * Math.PI) * 60, 6, 3, 0, 0, Math.PI * 2); c.fill();
            c.globalAlpha = 1; c.fillStyle = L.big ? '#ff8a3a' : '#8bc34a';
            c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#2b3a14'; c.lineWidth = 1.5; c.stroke();
            c.restore();
        });
    }

    function drawSilahsor() {
        const P = player, c = ctx, t = Date.now(), r = P.radius;
        c.save();
        if (P.isInvisible) c.globalAlpha = 0.4;
        c.save(); c.translate(P.x, P.y); c.rotate(P.angle || 0);
        c.fillStyle = '#f3dcc0';
        c.beginPath(); c.arc(r * 0.45, -r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(r * 0.45, r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
        c.fillStyle = sh.silver ? '#e6e6f0' : '#5a4a3a';
        c.fillRect(r * 0.4, -r * 0.55, r * 0.95, 4); c.fillRect(r * 0.4, r * 0.55 - 4, r * 0.95, 4); // çift tabanca
        c.restore();
        // kovboy şapkası
        c.fillStyle = '#6b3f1a';
        c.beginPath(); c.ellipse(P.x, P.y - r * 0.55, r * 1.05, r * 0.3, 0, 0, Math.PI * 2); c.fill();
        c.fillRect(P.x - r * 0.45, P.y - r * 1.15, r * 0.9, r * 0.6);
        if (sh.silver) { c.beginPath(); c.arc(P.x, P.y, r + 6, 0, Math.PI * 2); c.strokeStyle = 'rgba(230,230,240,0.8)'; c.lineWidth = 2; c.stroke(); }
        if (sh.storm) drawBar('KURŞUN FIRTINASI', 1, '#ffb347');
        c.restore();
    }

    function drawBarmen() {
        const P = player, c = ctx, r = P.radius;
        c.save();
        if (P.isInvisible) c.globalAlpha = 0.4;
        c.save(); c.translate(P.x, P.y); c.rotate(P.angle || 0);
        c.fillStyle = '#eef8d8';
        c.beginPath(); c.arc(r * 0.45, -r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(r * 0.45, r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
        // elindeki şişe
        c.fillStyle = '#8bc34a'; c.fillRect(r * 0.7, -4, 12, 8);
        c.fillStyle = '#2b3a14'; c.fillRect(r * 0.7 + 12, -2, 6, 4);
        c.restore();
        // önlük
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.fillRect(P.x - r * 0.5, P.y + r * 0.15, r, r * 0.6);
        c.restore();
    }

    function drawPreviews() {
        const c = ctx, P = player;
        if (P.isDead) return;
        const aim = (typeof aimData !== 'undefined' && aimData && aimData.active) ? aimData : null;
        c.save();
        c.setLineDash([8, 6]); c.lineWidth = 2;
        if (aim && P.ammo >= 1) {
            if (isSh(P)) {
                c.strokeStyle = 'rgba(255,211,106,0.6)';
                const L = SH_RANGE * SH_MAGNUM;
                c.beginPath(); c.moveTo(P.x, P.y); c.lineTo(P.x + Math.cos(aim.angle) * L, P.y + Math.sin(aim.angle) * L); c.stroke();
            } else {
                const d = targetDist(aim.pull);
                const tx = P.x + Math.cos(aim.angle) * d, ty = P.y + Math.sin(aim.angle) * d;
                c.strokeStyle = 'rgba(139,195,74,0.7)';
                c.beginPath(); c.moveTo(P.x, P.y); c.lineTo(tx, ty); c.stroke();
                c.beginPath(); c.arc(tx, ty, BM_SPLASH, 0, Math.PI * 2); c.stroke();
            }
        }
        if (gadAim.active && P.gadgetReady && isBm(P)) {
            const d = Math.min(targetDist(gadAim.pull), 300);
            c.strokeStyle = 'rgba(201,140,61,0.8)';
            c.beginPath(); c.arc(P.x + Math.cos(gadAim.angle) * d, P.y + Math.sin(gadAim.angle) * d, BM_SYRUP_R, 0, Math.PI * 2); c.stroke();
        }
        if (gadAim2.active && P.gadget2Ready && isBm(P)) {
            c.strokeStyle = 'rgba(126,240,161,0.8)';
            c.beginPath(); c.arc(P.x, P.y, BM_TONIC_R, 0, Math.PI * 2); c.stroke();
        }
        if (ultAim.active && P.ultReady) {
            c.strokeStyle = 'rgba(241,196,15,0.8)'; c.lineWidth = 3;
            if (isSh(P)) {
                const L = SH_STORM_RANGE * SH_MAGNUM;
                for (const s of [-SH_STORM_SPREAD, 0, SH_STORM_SPREAD]) {
                    c.beginPath(); c.moveTo(P.x, P.y); c.lineTo(P.x + Math.cos(ultAim.angle + s) * L, P.y + Math.sin(ultAim.angle + s) * L); c.stroke();
                }
            } else {
                const d = targetDist(ultAim.pull) + 40;
                c.beginPath(); c.arc(P.x + Math.cos(ultAim.angle) * d, P.y + Math.sin(ultAim.angle) * d, BM_ULT_SPREAD, 0, Math.PI * 2); c.stroke();
            }
        }
        c.restore();
    }

    function drawWorld() {
        drawLobsAndZones();
        drawBeams();
        drawFx();
        drawShots();
        drawPreviews();
        if (player.isDead) return;
        if (isSh(player)) drawSilahsor(); else drawBarmen();
    }

    // ----------------------------------------------------- HOOK'LAR (varsa)
    const H = EXT.hooks;
    if (H) {
        const prevKilled = H.onEnemyKilled, prevReset = H.onReset;
        H.onEnemyKilled = function () {
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
            if (wasActive) { resetState(); wasActive = false; curChar = null; }
            if (gameStarted && gadgetBtn.dataset.m40) delete gadgetBtn.dataset.m40;
            return;
        }
        try {
            if (!wasActive || needReset || curChar !== player.charType) {
                resetState(); wasActive = true; needReset = false; curChar = player.charType;
            }
            ensureUI();
            tick(dt);
            drawWorld();
        } catch (err) {
            if (!warned) { warned = true; console.warn('[mod40] hata:', err); }
        }
    }
    requestAnimationFrame(loop);
})();
