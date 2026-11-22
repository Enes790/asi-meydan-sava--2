/* ==========================================================================
   mod39.js  -  İKİ YENİ KARAKTER (MERMİ ATAN): "BOĞA" (Bull gibi) & "PIRIL" (Bonnie gibi, 2 formlu)
   --------------------------------------------------------------------------
   mod30 / mod37 / mod38 ile AYNI yapı. Ana oyuna DOKUNMAZ. Mermiler bu dosyanın KENDİ
   mermi sistemidir (ana oyunun mermi koduna güvenmez): düşmana, engele ve duvara çarparlar.
   Her karakter: 2 aksesuar (Q/E) + 1 güç (ulti) + 2 pasif.

   BOĞA (Bull gibi: yakın menzil pompalı tank)    HP 4600 / hız 3.2
     Ana atak   - ÇİFTE NAMLU    : 5 saçma, kısa menzil (230 px), her biri 230 hasar (yakında en çok 1150).
     Pasif 1    - ÇILGIN BOĞA    : Canın %60'ın altındayken mühimmat 2 kat hızlı dolar.
     Pasif 2    - SERT ADAM      : Canın %40'ın altındayken aldığın hasar %30 azalır.
     Q          - T-BONE AŞISI   : Anında 1000 can yeniler. BK 17 sn
     E          - EZİCİ BASIŞ    : 130 yarıçap, 300 hasar + itme, yavaşlatır (1.5 sn). BK 12 sn
     Güç        - BULDOZER       : 380 px hızlı hücum; yoldaki herkese 1000 hasar, engelleri ezer.

   PIRIL (Bonnie gibi: iki formlu)                 HP 4400 / hız 3.1
     PIRIL formu - CEKET SAÇMASI : 3 patlayıcı mermi yelpazesi, her biri 450 hasar (şarj kazandırmaz).
     TOSUN formu - UZUN DİŞ      : Tek uzun menzilli mermi, 1500 hasar (şarj kazandırır).
     Pasif 1    - BARUT TOZU     : Güç sıçraması %36 daha uzağa gider.
     Pasif 2    - BİLGELİK DİŞİ  : Tosun mermisi bitince çapraz 4 küçük mermiye (her biri %25) bölünür.
     Q          - ŞEKER HIZI     : 5 sn hız +%30 ve mühimmat daha hızlı dolar. BK 14 sn
     E          - ÇARPMA TESTİ   : 140 px atılır, yoldakilere 300 hasar + itme. BK 11 sn
     Güç        - YILDIZ FIRLATICI: Havaya fırlar (hasar almaz), inince 140 yarıçapta 900 hasar ve
                                    FORM DEĞİŞİR (Piril <-> Tosun).
   ========================================================================== */
(function () {
    'use strict';

    if (typeof window === 'undefined' || !window.GAME_EXT) return;

    const BG = 'boga', PR = 'piril';
    const EXT = window.GAME_EXT;
    const CHARGE_PER_FRAME = 100 / 3600; // ~60 sn'de dolar
    const CHARGE_PER_KILL = 25;

    // ---- Boğa denge sabitleri ----
    const BG_PELLETS = 8, BG_PELLET_DMG = 500, BG_SPREAD = 0.46, BG_SPEED = 13, BG_RANGE = 230, BG_PELLET_R = 5;
    const BG_BERSERK_HP = 0.6, BG_BERSERK_EVERY = 75;
    const BG_TOUGH_HP = 0.4, BG_TOUGH_RED = 0.3;
    const BG_HEAL = 1000, BG_Q_CD = 1020;
    const BG_STOMP_R = 130, BG_STOMP_DMG = 300, BG_SLOW_TIME = 90, BG_SLOW_MULT = 0.55, BG_E_CD = 720;
    const BG_RUSH_DIST = 380, BG_RUSH_FRAMES = 24, BG_RUSH_DMG = 1000, BG_RUSH_OBST = 900;

    // ---- Piril denge sabitleri ----
    const PR_SHELLS = 3, PR_SHELL_DMG = 750, PR_SHELL_SPREAD = 0.3, PR_SHELL_SPEED = 12, PR_SHELL_RANGE = 270, PR_SHELL_R = 7;
    const PR_TOOTH_DMG = 3500, PR_TOOTH_SPEED = 17, PR_TOOTH_RANGE = 360, PR_TOOTH_R = 8, PR_TOOTH_GAP = 40;
    const PR_SPLIT_RANGE = 130, PR_SPLIT_FRAC = 0.25;
    const PR_JUMP_DIST = 300, PR_JUMP_BONUS = 1.36, PR_JUMP_FRAMES = 30, PR_LAND_R = 140, PR_LAND_DMG = 900;
    const PR_RUSH_TIME = 300, PR_RUSH_SPEED = 1.3, PR_RUSH_EVERY = 45, PR_Q_CD = 840;
    const PR_CRASH_DIST = 140, PR_CRASH_FRAMES = 9, PR_CRASH_DMG = 900, PR_E_CD = 660;

    // ---------------------------------------------------------------- KAYIT
    EXT.characters[BG] = { color: '#c0612b', hp: 4600, speed: 3.2 };
    EXT.characters[PR] = { color: '#ff9bd2', hp: 4400, speed: 3.1 };

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
    addCard(BG, 'Boğa',
        'radial-gradient(circle at 35% 30%,#ffd1a3,#c0612b 55%,#5a230a)',
        'Yakın menzil · pompalı<br>Yetenek: T-Bone Aşısı / Ezici Basış<br>Güç: Buldozer');
    addCard(PR, 'Piril',
        'radial-gradient(circle at 35% 30%,#ffe3f3,#ff9bd2 55%,#8a2a63)',
        '2 formlu · Piril / Tosun<br>Yetenek: Şeker Hızı / Çarpma Testi<br>Güç: Yıldız Fırlatıcı');

    // ------------------------------------------------------------------ DURUM
    let fx = [], beams = [], knocked = [], shots = [], slowed = [];
    let now = 0;
    const bg = { rush: null, ammoT: 0, swing: 0 };
    const pr = { cannon: false, air: null, dash: null, sugar: 0, sugarT: 0, lastTooth: -999 };
    const hpw = { last: 0, lastHit: 0 };
    let curChar = null, wasActive = false, last = 0, warned = false, needReset = false;

    function resetState() {
        knocked.forEach(e => { e._m39kx = 0; e._m39ky = 0; });
        slowed.forEach(s => { if (s.e && s.base) s.e.speed = s.base; });
        fx = []; beams = []; knocked = []; shots = []; slowed = [];
        bg.rush = null; bg.ammoT = 0; bg.swing = 0;
        pr.cannon = false; pr.air = null; pr.dash = null; pr.sugar = 0; pr.sugarT = 0; pr.lastTooth = -999;
        if (typeof player !== 'undefined') {
            player.jumpInvulnerable = false;
            hpw.last = player.hp; hpw.lastHit = now;
            if (player.originalSpeed) player.speed = player.originalSpeed;
        }
    }

    // ---------------------------------------------------------------- YARDIMCI
    const isPr = p => p.charType === PR;
    const isBg = p => p.charType === BG;
    const isMine = p => isPr(p) || isBg(p);
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
        if (player.ultReady || player.isDead || bg.rush || pr.air) return;
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
        e._m39kx = (e._m39kx || 0) + Math.cos(ang) * power;
        e._m39ky = (e._m39ky || 0) + Math.sin(ang) * power;
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
    function addShot(x, y, ang, speed, range, dmg, r, col, kind) {
        shots.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, left: range, dmg, r, col, kind: kind || 'pellet', ang });
    }
    function shotEnd(b, hitEnemy) { // hitEnemy: çarpılan düşman (bölünen mermiler ona tekrar vurmaz)
        // Pasif 2 (Piril): Bilgelik Dişi - Tosun mermisi biterken çapraz 4 mermiye bölünür
        if (b.kind === 'tooth') {
            for (let i = 0; i < 4; i++) {
                const a = b.ang + Math.PI / 4 + i * Math.PI / 2;
                addShot(b.x, b.y, a, 11, PR_SPLIT_RANGE, Math.round(PR_TOOTH_DMG * PR_SPLIT_FRAC), 5, '#ffd2ec', 'split');
                shots[shots.length - 1].skip = hitEnemy || null;
            }
            ring(b.x, b.y, '#ff9bd2', 40, 14);
        } else if (b.kind === 'shell') {
            ring(b.x, b.y, '#ffb86a', 34, 14);
        }
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
                if (b.x < WALL_THICKNESS || b.y < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) {
                    dead = true; shotEnd(b, false); break;
                }
                for (const o of obs) {
                    if (Math.hypot(b.x - o.x, b.y - o.y) < o.radius + b.r) {
                        o.hp -= b.kind === 'tooth' ? 200 : 60;
                        dead = true; shotEnd(b, false); break;
                    }
                }
                if (dead) break;
                for (const e of en) {
                    if (!(e.hp > 0) || e === b.skip) continue;
                    if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + b.r) {
                        hurt(e, b.dmg, b.col);
                        knock(e, Math.atan2(b.vy, b.vx), b.kind === 'tooth' ? 6 : 2.5);
                        if (isPr(player) && (b.kind === 'tooth' || b.kind === 'split')) charge(b.kind === 'tooth' ? 14 : 2);
                        else if (isBg(player)) charge(3);
                        dead = true; shotEnd(b, e); break;
                    }
                }
            }
            if (!dead && b.left <= 0) { dead = true; shotEnd(b, false); }
            if (dead) shots.splice(i, 1);
        }
        if (shots.length > 160) shots.splice(0, shots.length - 160);
    }

    // ------------------------------------------------- OYUNCU METOTLARI (SARMALAMA)
    function install(p) {
        if (p.__m39) return;
        p.__m39 = true;
        const orig = { fire: p.fire, g1: p.activateGadget, g2: p.activateGadget2, ult: p.fireUlti };

        p.fire = function (a, pull) {
            if (isBg(this)) return bgShot.call(this, a, pull);
            if (isPr(this)) return prShot.call(this, a, pull);
            return orig.fire.apply(this, arguments);
        };
        p.activateGadget = function (a, pull) {
            if (isBg(this)) return bgHeal.call(this, a, pull);
            if (isPr(this)) return prSugar.call(this, a, pull);
            return orig.g1.apply(this, arguments);
        };
        p.activateGadget2 = function (a, pull) {
            if (isBg(this)) return bgStomp.call(this, a, pull);
            if (isPr(this)) return prCrash.call(this, a, pull);
            return orig.g2.apply(this, arguments);
        };
        p.fireUlti = function (a, pull) {
            if (isBg(this)) return bgDozer.call(this, a, pull);
            if (isPr(this)) return prLaunch.call(this, a, pull);
            return orig.ult.apply(this, arguments);
        };
    }

    // ========================================================================
    //  BOĞA
    // ========================================================================
    // Ana atak: ÇİFTE NAMLU (5 saçma)
    function bgShot(a) {
        if (this.isDead || this.ammo < 1 || bg.rush) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        this.consumeAmmo();
        for (let i = 0; i < BG_PELLETS; i++) {
            const f = BG_PELLETS === 1 ? 0 : i / (BG_PELLETS - 1) - 0.5;
            const aa = ang + f * BG_SPREAD;
            addShot(this.x + Math.cos(aa) * this.radius, this.y + Math.sin(aa) * this.radius, aa,
                    BG_SPEED * (0.94 + Math.random() * 0.12), BG_RANGE, BG_PELLET_DMG, BG_PELLET_R, '#ffb86a', 'pellet');
        }
        bg.swing = 8;
        puff(this.x + Math.cos(ang) * 30, this.y + Math.sin(ang) * 30, '#ffb86a', 4);
        shake(3);
    }

    // Q: T-BONE AŞISI
    function bgHeal() {
        if (!this.gadgetReady || this.isDead) return;
        const before = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + BG_HEAL);
        hpw.last = this.hp; // iyileşme hasar sayılmasın
        say(this.x, this.y - 34, '+' + Math.round(this.hp - before), '#2ecc71');
        ring(this.x, this.y, '#2ecc71', 60, 22);
        puff(this.x, this.y, '#8be0a4', 10);
        setCd1(this, BG_Q_CD);
    }

    // E: EZİCİ BASIŞ
    function bgStomp() {
        if (!this.gadget2Ready || this.isDead) return;
        let hits = 0;
        getActiveEnemies().forEach(e => {
            if (!(e.hp > 0) || dist(this, e) > BG_STOMP_R + e.radius) return;
            hurt(e, BG_STOMP_DMG, '#ffb86a');
            knock(e, angOf(this, e), 7);
            slowEnemy(e, BG_SLOW_TIME, BG_SLOW_MULT);
            hits++;
        });
        ring(this.x, this.y, '#ffb86a', BG_STOMP_R, 24);
        ring(this.x, this.y, '#ffffff', BG_STOMP_R * 0.5, 18);
        puff(this.x, this.y, '#d9a066', 12);
        say(this.x, this.y - 34, 'EZİCİ BASIŞ!', '#ffb86a');
        shake(8);
        charge(5 + hits * 4);
        setCd2(this, BG_E_CD);
    }
    function slowEnemy(e, frames, mult) {
        if (typeof e.speed !== 'number') return;
        let s = slowed.find(x => x.e === e);
        if (!s) { s = { e, base: e.speed, t: 0 }; slowed.push(s); }
        s.t = frames;
        e.speed = s.base * mult;
    }

    // Güç: BULDOZER
    function bgDozer(a) {
        if (!this.ultReady || this.isDead || bg.rush) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        bg.rush = { t: BG_RUSH_FRAMES, ang, hit: [] };
        this.jumpInvulnerable = false;
        say(this.x, this.y - 40, 'BULDOZER!', '#ff7a3d');
        ring(this.x, this.y, '#ff7a3d', 90, 24);
        shake(10);
        spendUlt();
    }

    // ========================================================================
    //  PIRIL
    // ========================================================================
    function prShot(a) {
        if (this.isDead || this.ammo < 1 || pr.air || pr.dash) return;
        const ang = a !== undefined ? a : this.angle;
        if (pr.cannon) {
            if (now - pr.lastTooth < PR_TOOTH_GAP) return;
            pr.lastTooth = now;
            this.angle = ang;
            this.consumeAmmo();
            addShot(this.x + Math.cos(ang) * this.radius, this.y + Math.sin(ang) * this.radius, ang,
                    PR_TOOTH_SPEED, PR_TOOTH_RANGE, PR_TOOTH_DMG, PR_TOOTH_R, '#ff9bd2', 'tooth');
            puff(this.x + Math.cos(ang) * 30, this.y + Math.sin(ang) * 30, '#ffd2ec', 5);
            shake(5);
        } else {
            this.angle = ang;
            this.consumeAmmo();
            for (let i = 0; i < PR_SHELLS; i++) {
                const f = PR_SHELLS === 1 ? 0 : i / (PR_SHELLS - 1) - 0.5;
                const aa = ang + f * 2 * PR_SHELL_SPREAD;
                addShot(this.x + Math.cos(aa) * this.radius, this.y + Math.sin(aa) * this.radius, aa,
                        PR_SHELL_SPEED, PR_SHELL_RANGE, PR_SHELL_DMG, PR_SHELL_R, '#ffb86a', 'shell');
            }
            puff(this.x + Math.cos(ang) * 28, this.y + Math.sin(ang) * 28, '#ffb86a', 4);
            shake(3);
        }
    }

    // Q: ŞEKER HIZI
    function prSugar() {
        if (!this.gadgetReady || this.isDead) return;
        pr.sugar = PR_RUSH_TIME; pr.sugarT = 0;
        ring(this.x, this.y, '#ff9bd2', 70, 22);
        say(this.x, this.y - 34, 'ŞEKER HIZI!', '#ff9bd2');
        setCd1(this, PR_Q_CD);
    }

    // E: ÇARPMA TESTİ
    function prCrash(a) {
        if (!this.gadget2Ready || this.isDead || pr.dash || pr.air) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        pr.dash = { t: PR_CRASH_FRAMES, ang, hit: [] };
        say(this.x, this.y - 30, 'ÇARPMA TESTİ!', '#ffb86a');
        setCd2(this, PR_E_CD);
    }

    // Güç: YILDIZ FIRLATICI (havaya fırlama + form değişimi)
    function prLaunch(a, pull) {
        if (!this.ultReady || this.isDead || pr.air) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        const dd = PR_JUMP_DIST * PR_JUMP_BONUS; // Pasif 1: Barut Tozu
        const tx = clampRange(this.x + Math.cos(ang) * dd, WALL_THICKNESS + this.radius, canvas.width - WALL_THICKNESS - this.radius);
        const ty = clampRange(this.y + Math.sin(ang) * dd, WALL_THICKNESS + this.radius, canvas.height - WALL_THICKNESS - this.radius);
        pr.air = { t: PR_JUMP_FRAMES, sx: this.x, sy: this.y, tx, ty };
        this.jumpInvulnerable = true;
        pr.dash = null;
        ring(this.x, this.y, '#ffe3f3', 90, 24);
        say(this.x, this.y - 40, 'YILDIZ FIRLATICI!', '#ffe3f3');
        spendUlt();
    }
    function prLand() {
        const P = player, A = pr.air;
        pr.air = null;
        P.jumpInvulnerable = false;
        // engelin içine inersek dışarı çıkar
        for (const o of allObstacles()) {
            const d = Math.hypot(P.x - o.x, P.y - o.y);
            if (d < o.radius + P.radius) {
                const a = d > 0.5 ? Math.atan2(P.y - o.y, P.x - o.x) : 0;
                P.x = o.x + Math.cos(a) * (o.radius + P.radius + 2);
                P.y = o.y + Math.sin(a) * (o.radius + P.radius + 2);
            }
        }
        getActiveEnemies().forEach(e => {
            if (e.hp > 0 && dist(P, e) <= PR_LAND_R + e.radius) { hurt(e, PR_LAND_DMG, '#ffe3f3'); knock(e, angOf(P, e), 10); }
        });
        pr.cannon = !pr.cannon; // FORM DEĞİŞİR
        ring(P.x, P.y, '#ffe3f3', PR_LAND_R, 26);
        ring(P.x, P.y, '#ff9bd2', PR_LAND_R * 0.6, 20);
        puff(P.x, P.y, '#ffd2ec', 14);
        say(P.x, P.y - 40, pr.cannon ? 'TOSUN FORMU!' : 'PIRIL FORMU!', '#ff9bd2');
        shake(11);
    }

    // ------------------------------------------------------------- ARAYÜZ
    function ensureUI() {
        [ultiBtn, gadgetBtn, gadgetBtn2].forEach(el => { if (el.style.display !== 'flex') el.style.display = 'flex'; });
        const tag = player.charType;
        if (gadgetBtn.dataset.m39 !== tag) {
            const L = tag === BG ? ['T-BONE<br>AŞISI', 'EZİCİ<br>BASIŞ'] : ['ŞEKER<br>HIZI', 'ÇARPMA<br>TESTİ'];
            gadgetBtn.innerHTML = L[0] + '<br><span id="gadget-timer"></span>';
            gadgetBtn2.innerHTML = L[1] + '<br><span id="gadget-timer-2"></span>';
            gadgetBtn.dataset.m39 = tag;
            gadgetTimerText = document.getElementById('gadget-timer');
            gadgetTimerText2 = document.getElementById('gadget-timer-2');
        }
    }

    // ------------------------------------------------------------- GÜNCELLE
    function moveWithPush(P, ang, step, plow) {
        const nx = clampRange(P.x + Math.cos(ang) * step, WALL_THICKNESS + P.radius, canvas.width - WALL_THICKNESS - P.radius);
        const ny = clampRange(P.y + Math.sin(ang) * step, WALL_THICKNESS + P.radius, canvas.height - WALL_THICKNESS - P.radius);
        if (!plow) {
            for (const o of allObstacles()) if (Math.hypot(nx - o.x, ny - o.y) < P.radius + o.radius) return false;
        }
        P.x = nx; P.y = ny;
        return true;
    }

    function tick(dt) {
        const P = player;
        const en = getActiveEnemies();
        now += dt;
        const alive = new Set(en);

        // --- Hasar filtresi: Boğa'nın Sert Adam pasifi ---
        if (!P.isDead && P.hp < hpw.last) {
            const d = hpw.last - P.hp;
            if (isBg(P) && P.hp > 0 && hpw.last < P.maxHp * BG_TOUGH_HP) {
                P.hp = Math.min(P.maxHp, P.hp + d * BG_TOUGH_RED);
            }
            hpw.lastHit = now;
        }

        if (!P.isDead) charge(CHARGE_PER_FRAME * dt);

        // --- Boğa: Çılgın Boğa (hızlı dolum) ---
        if (isBg(P) && !P.isDead) {
            if (P.hp < P.maxHp * BG_BERSERK_HP && P.ammo < P.maxAmmo) {
                bg.ammoT += dt;
                if (bg.ammoT >= BG_BERSERK_EVERY) { bg.ammoT = 0; P.ammo = Math.min(P.maxAmmo, P.ammo + 1); }
            } else bg.ammoT = 0;
        }
        if (bg.swing > 0) bg.swing -= dt;

        // --- Boğa: Buldozer hücumu ---
        if (bg.rush) {
            const R = bg.rush;
            const step = (BG_RUSH_DIST / BG_RUSH_FRAMES) * dt;
            moveWithPush(P, R.ang, step, true);
            puff(P.x, P.y, '#ff7a3d', 1);
            en.forEach(e => {
                if (!(e.hp > 0) || R.hit.indexOf(e) >= 0) return;
                if (dist(P, e) < P.radius + e.radius + 8) {
                    R.hit.push(e);
                    hurt(e, BG_RUSH_DMG, '#ff7a3d');
                    knock(e, R.ang + (Math.random() < 0.5 ? 0.9 : -0.9), 10);
                    charge(0);
                }
            });
            allObstacles().forEach(o => {
                if (R.hit.indexOf(o) >= 0) return;
                if (Math.hypot(P.x - o.x, P.y - o.y) < P.radius + o.radius + 6) { R.hit.push(o); o.hp -= BG_RUSH_OBST; shake(5); }
            });
            R.t -= dt;
            if (R.t <= 0 || P.isDead) {
                bg.rush = null;
                for (const o of allObstacles()) {
                    const d = Math.hypot(P.x - o.x, P.y - o.y);
                    if (o.hp > 0 && d < o.radius + P.radius) {
                        const a = d > 0.5 ? Math.atan2(P.y - o.y, P.x - o.x) : 0;
                        P.x = o.x + Math.cos(a) * (o.radius + P.radius + 2);
                        P.y = o.y + Math.sin(a) * (o.radius + P.radius + 2);
                    }
                }
                ring(P.x, P.y, '#ff7a3d', 70, 18);
            }
        }

        // --- Piril: çarpma testi atılımı ---
        if (pr.dash) {
            const D = pr.dash;
            const step = (PR_CRASH_DIST / PR_CRASH_FRAMES) * dt;
            if (P.isDead || !moveWithPush(P, D.ang, step, false)) pr.dash = null;
            else {
                puff(P.x, P.y, '#ffb86a', 1);
                en.forEach(e => {
                    if (!(e.hp > 0) || D.hit.indexOf(e) >= 0) return;
                    if (dist(P, e) < P.radius + e.radius + 6) { D.hit.push(e); hurt(e, PR_CRASH_DMG, '#ffb86a'); knock(e, D.ang, 9); charge(4); }
                });
                D.t -= dt;
                if (D.t <= 0) pr.dash = null;
            }
        }

        // --- Piril: havada uçuş ---
        if (pr.air) {
            const A = pr.air;
            A.t -= dt;
            const k = 1 - Math.max(0, A.t) / PR_JUMP_FRAMES;
            P.x = A.sx + (A.tx - A.sx) * k;
            P.y = A.sy + (A.ty - A.sy) * k;
            if (Math.random() < 0.6 * dt) puff(P.x, P.y, '#ffe3f3', 1);
            if (A.t <= 0 || P.isDead) prLand();
        }

        // --- Piril: Şeker Hızı ---
        if (pr.sugar > 0) {
            pr.sugar -= dt;
            pr.sugarT += dt;
            if (pr.sugarT >= PR_RUSH_EVERY) { pr.sugarT = 0; P.ammo = Math.min(P.maxAmmo, P.ammo + 1); }
            if (Math.random() < 0.4 * dt) puff(P.x, P.y, '#ff9bd2', 1);
            if (pr.sugar < 0) pr.sugar = 0;
        }

        // --- Hız çarpanı ---
        if (P.originalSpeed) {
            let m = 1;
            if (isPr(P) && pr.sugar > 0) m *= PR_RUSH_SPEED;
            P.speed = P.originalSpeed * m;
        }

        // --- Yavaşlatma süreleri ---
        for (let i = slowed.length - 1; i >= 0; i--) {
            const s = slowed[i];
            s.t -= dt;
            if (s.t <= 0 || !alive.has(s.e)) { if (s.e) s.e.speed = s.base; slowed.splice(i, 1); }
        }

        updateShots(dt);

        // --- İtme ---
        for (let i = knocked.length - 1; i >= 0; i--) {
            const e = knocked[i];
            const vx = e._m39kx || 0, vy = e._m39ky || 0;
            if (Math.hypot(vx, vy) < 0.3 || !alive.has(e)) { e._m39kx = 0; e._m39ky = 0; knocked.splice(i, 1); continue; }
            e.x = clampRange(e.x + vx * dt, WALL_THICKNESS + e.radius, canvas.width - WALL_THICKNESS - e.radius);
            e.y = clampRange(e.y + vy * dt, WALL_THICKNESS + e.radius, canvas.height - WALL_THICKNESS - e.radius);
            const fr = Math.pow(0.82, dt);
            e._m39kx = vx * fr; e._m39ky = vy * fr;
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
            c.fillStyle = b.col;
            c.shadowColor = b.col; c.shadowBlur = b.kind === 'tooth' ? 14 : 6;
            c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
            c.shadowBlur = 0;
            c.strokeStyle = '#ffffff'; c.lineWidth = 1.2; c.stroke();
            if (b.kind === 'tooth') {
                c.globalAlpha = 0.35; c.strokeStyle = b.col; c.lineWidth = b.r;
                c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - b.vx * 1.4, b.y - b.vy * 1.4); c.stroke();
            }
            c.restore();
        });
    }

    function drawBoga() {
        const P = player, c = ctx, t = Date.now(), r = P.radius;
        const low = P.hp < P.maxHp * BG_BERSERK_HP, tough = P.hp < P.maxHp * BG_TOUGH_HP;
        c.save();
        if (P.isInvisible) c.globalAlpha = 0.4;
        if (bg.rush) {
            c.strokeStyle = 'rgba(255,122,61,0.6)'; c.lineWidth = 3;
            const back = (P.angle || 0) + Math.PI;
            for (let k = -1; k <= 1; k++) {
                const ox = Math.cos(back + Math.PI / 2) * k * 9, oy = Math.sin(back + Math.PI / 2) * k * 9;
                c.beginPath();
                c.moveTo(P.x + ox + Math.cos(back) * (r + 4), P.y + oy + Math.sin(back) * (r + 4));
                c.lineTo(P.x + ox + Math.cos(back) * (r + 40), P.y + oy + Math.sin(back) * (r + 40));
                c.stroke();
            }
        }
        // boynuzlar + gözler + namlu
        c.save(); c.translate(P.x, P.y); c.rotate(P.angle || 0);
        c.strokeStyle = '#f1e2c6'; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(r * 0.55, -r * 0.55); c.quadraticCurveTo(r * 1.2, -r * 0.9, r * 1.35, -r * 0.35); c.stroke();
        c.beginPath(); c.moveTo(r * 0.55, r * 0.55); c.quadraticCurveTo(r * 1.2, r * 0.9, r * 1.35, r * 0.35); c.stroke();
        c.fillStyle = '#ffe9d1';
        c.beginPath(); c.arc(r * 0.45, -r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(r * 0.45, r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#3d3a37'; c.fillRect(r * 0.3, -5, r * 1.0 + (bg.swing > 0 ? -3 : 0), 4); c.fillRect(r * 0.3, 1, r * 1.0 + (bg.swing > 0 ? -3 : 0), 4);
        c.restore();
        if (low) { c.beginPath(); c.arc(P.x, P.y, r + 5, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,90,60,' + (0.4 + 0.2 * Math.sin(t / 120)) + ')'; c.lineWidth = 2; c.stroke(); }
        if (tough) { c.beginPath(); c.arc(P.x, P.y, r + 9, 0, Math.PI * 2); c.strokeStyle = 'rgba(190,200,210,0.7)'; c.lineWidth = 3; c.stroke(); }
        c.restore();
    }

    function drawPiril() {
        const P = player, c = ctx, t = Date.now(), r = P.radius;
        const air = !!pr.air;
        const lift = air ? Math.sin((1 - pr.air.t / PR_JUMP_FRAMES) * Math.PI) * 26 : 0;
        c.save();
        if (P.isInvisible) c.globalAlpha = 0.4;
        if (air) {
            c.save(); c.globalAlpha = 0.3; c.fillStyle = '#000';
            c.beginPath(); c.ellipse(P.x, P.y + r * 0.6, r * 0.9, r * 0.3, 0, 0, Math.PI * 2); c.fill();
            c.restore();
        }
        c.save(); c.translate(P.x, P.y - lift); c.rotate(P.angle || 0);
        if (pr.cannon) {
            c.fillStyle = '#5a4a56'; c.beginPath(); c.arc(0, 0, r + 8, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#2c2430'; c.lineWidth = 3; c.stroke();
            c.fillStyle = '#7a6678'; c.fillRect(4, -8, r + 24, 16);
            c.strokeStyle = '#2c2430'; c.lineWidth = 2; c.strokeRect(4, -8, r + 24, 16);
            c.fillStyle = '#ff9bd2'; c.fillRect(r + 24, -5, 4, 10);
        } else {
            c.fillStyle = '#ffe3f3';
            c.beginPath(); c.arc(r * 0.5, -r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.arc(r * 0.5, r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#6b4a5f'; c.fillRect(r * 0.55, -3, r * 0.9, 6);
        }
        c.restore();
        if (!pr.cannon) { // küçük yıldız: form göstergesi
            c.fillStyle = '#ffd2ec'; c.font = 'bold 12px monospace'; c.textAlign = 'center';
            c.fillText('★', P.x, P.y - r - 8 - lift);
        }
        if (pr.sugar > 0) {
            c.beginPath(); c.arc(P.x, P.y - lift, r + 6, 0, Math.PI * 2);
            c.strokeStyle = 'rgba(255,155,210,0.6)'; c.lineWidth = 2; c.stroke();
        }
        c.restore();
        if (pr.cannon) drawBar('TOSUN FORMU', 1, '#ff9bd2');
    }

    function drawPreviews() {
        const c = ctx, P = player;
        if (P.isDead) return;
        const aim = (typeof aimData !== 'undefined' && aimData && aimData.active) ? aimData : null;
        c.save();
        c.setLineDash([8, 6]); c.lineWidth = 2;
        if (aim && P.ammo >= 1) {
            c.strokeStyle = 'rgba(255,184,106,0.6)';
            c.beginPath(); c.moveTo(P.x, P.y);
            if (isBg(P)) {
                c.arc(P.x, P.y, BG_RANGE, aim.angle - BG_SPREAD / 2, aim.angle + BG_SPREAD / 2);
                c.closePath();
            } else if (pr.cannon) {
                c.lineTo(P.x + Math.cos(aim.angle) * PR_TOOTH_RANGE, P.y + Math.sin(aim.angle) * PR_TOOTH_RANGE);
            } else {
                c.arc(P.x, P.y, PR_SHELL_RANGE, aim.angle - PR_SHELL_SPREAD, aim.angle + PR_SHELL_SPREAD);
                c.closePath();
            }
            c.stroke();
        }
        if (gadAim.active && P.gadgetReady) {
            c.strokeStyle = 'rgba(46,204,113,0.7)';
            c.beginPath(); c.arc(P.x, P.y, 50, 0, Math.PI * 2); c.stroke();
        }
        if (gadAim2.active && P.gadget2Ready) {
            c.strokeStyle = 'rgba(255,184,106,0.8)';
            if (isBg(P)) { c.beginPath(); c.arc(P.x, P.y, BG_STOMP_R, 0, Math.PI * 2); c.stroke(); }
            else { c.lineWidth = 6; c.beginPath(); c.moveTo(P.x, P.y); c.lineTo(P.x + Math.cos(gadAim2.angle) * PR_CRASH_DIST, P.y + Math.sin(gadAim2.angle) * PR_CRASH_DIST); c.stroke(); }
        }
        if (ultAim.active && P.ultReady) {
            c.strokeStyle = 'rgba(241,196,15,0.8)'; c.lineWidth = 4;
            const L = isBg(P) ? BG_RUSH_DIST : PR_JUMP_DIST * PR_JUMP_BONUS;
            c.beginPath(); c.moveTo(P.x, P.y); c.lineTo(P.x + Math.cos(ultAim.angle) * L, P.y + Math.sin(ultAim.angle) * L); c.stroke();
            if (isPr(P)) { c.beginPath(); c.arc(P.x + Math.cos(ultAim.angle) * L, P.y + Math.sin(ultAim.angle) * L, PR_LAND_R, 0, Math.PI * 2); c.stroke(); }
        }
        c.restore();
    }

    function drawWorld() {
        drawBeams();
        drawFx();
        drawShots();
        drawPreviews();
        if (player.isDead) return;
        if (isBg(player)) drawBoga(); else drawPiril();
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
            if (gameStarted && gadgetBtn.dataset.m39) delete gadgetBtn.dataset.m39;
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
            if (!warned) { warned = true; console.warn('[mod39] hata:', err); }
        }
    }
    requestAnimationFrame(loop);
})();
