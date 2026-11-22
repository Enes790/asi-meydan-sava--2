/* ==========================================================================
   mod38.js  -  İKİ YENİ KARAKTER (TEMA: PRİZMA): "KIRILIM" (yakın) & "SPEKTRUM" (uzak)
   --------------------------------------------------------------------------
   mod30 / mod37 ile AYNI yapı. Ana oyuna DOKUNMAZ, tüm saldırılar anlıktır.
   Hasarlar bilinçli yüksek: yakın menzil vuruşu 1200, uzak menzil ışını 1300.
   Her karakter: 2 aksesuar (Q/E) + 1 güç (ulti) + 2 pasif.

   KIRILIM (yakın menzil, kristal savaşçı)       HP 4200 / hız 2.9
     Ana atak   - KRİSTAL KILIÇ   : Önünde geniş yay (100 px), 1200 hasar.
     Pasif 1    - SPEKTRUM YÜKÜ   : Her isabet +%10 hasar (en çok 4 kat), 3 sn vurmazsan sıfırlanır.
     Pasif 2    - YANSITMA        : Aldığın hasarın %15'i en yakın düşmana (160 px) geri yansır.
     Q          - KIRILMA ATILIMI : 150 px atılır, yoldakilere 600 hasar, 1 mühimmat geri. BK 9 sn
     E          - CAM KALKAN      : 2 sn %70 hasar azaltma; bitince 150 yarıçapta 400 hasar. BK 14 sn
     Güç        - BEYAZ IŞIK      : 6 sn prizma formu: yay TAM DAİRE (r 120), hasar x1.2, hız x1.15.

   SPEKTRUM (uzak menzil, ışık nişancısı)        HP 2800 / hız 3.2
     Ana atak   - IŞIN            : Anlık çizgi, ilk düşmana 1300 hasar.
     Pasif 1    - ODAK            : 250 px'ten uzak hedefe +%25 hasar.
     Pasif 2    - KIRINIM         : Işın isabet edince en yakın 2. düşmana (200 px) %40 hasarla sıçrar.
     Q          - YANSIMA ADIMI   : Nişan yönünde 180 px anında ışınlanır. BK 9 sn
     E          - KÖR EDİCİ FLAŞ  : 150 yarıçap, 450 hasar + itme, yakındaki mermileri siler. BK 13 sn
     Güç        - GÖKKUŞAĞI IŞINI : 0.4 sn hedef kilidi, sonra 800 px'lik devasa ışın, hepsine 2400 hasar.
   ========================================================================== */
(function () {
    'use strict';

    if (typeof window === 'undefined' || !window.GAME_EXT) return;

    const KR = 'kirilim', SP = 'spektrum';
    const EXT = window.GAME_EXT;
    const CHARGE_PER_FRAME = 100 / 3600; // ~60 sn'de dolar
    const CHARGE_PER_KILL = 25;

    // ---- Kırılım denge sabitleri ----
    const KR_DMG = 1200, KR_RANGE = 100, KR_HALF = 0.8;
    const KR_STACK = 0.1, KR_STACK_MAX = 4, KR_STACK_TIME = 180;
    const KR_REFLECT = 0.15, KR_REFLECT_R = 160;
    const KR_DASH_DIST = 150, KR_DASH_FRAMES = 9, KR_DASH_DMG = 600, KR_Q_CD = 540;
    const KR_GLASS_TIME = 120, KR_GLASS_RED = 0.7, KR_GLASS_R = 150, KR_GLASS_DMG = 400, KR_E_CD = 840;
    const KR_FORM_TIME = 360, KR_FORM_RANGE = 120, KR_FORM_MULT = 1.2, KR_FORM_SPEED = 1.15;

    // ---- Spektrum denge sabitleri ----
    const SP_DMG = 1300, SP_HALF_W = 14, SP_LEN = 620;
    const SP_FAR = 250, SP_FAR_MULT = 1.25;
    const SP_JUMP_R = 200, SP_JUMP_MULT = 0.4;
    const SP_BLINK = 180, SP_Q_CD = 540;
    const SP_FLASH_R = 150, SP_FLASH_DMG = 450, SP_E_CD = 780;
    const SP_ULT_LOCK = 24, SP_ULT_LEN = 800, SP_ULT_HALF_W = 34, SP_ULT_DMG = 2400;

    // ---------------------------------------------------------------- KAYIT
    EXT.characters[KR] = { color: '#7fd8ff', hp: 4200, speed: 2.9 };
    EXT.characters[SP] = { color: '#ff7be5', hp: 2800, speed: 3.2 };

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
    addCard(KR, 'Kırılım',
        'radial-gradient(circle at 35% 30%,#ffffff,#7fd8ff 50%,#2a5fa8)',
        'Yakın menzil · 1200 hasar<br>Yetenek: Kırılma Atılımı / Cam Kalkan<br>Güç: Beyaz Işık');
    addCard(SP, 'Spektrum',
        'radial-gradient(circle at 35% 30%,#fff2fb,#ff7be5 50%,#6a2a9a)',
        'Uzak menzil · 1300 hasar<br>Yetenek: Yansıma Adımı / Kör Edici Flaş<br>Güç: Gökkuşağı Işını');

    // ------------------------------------------------------------------ DURUM
    let fx = [], beams = [], knocked = [];
    let now = 0;
    const kr = { stacks: 0, stackT: 0, dash: null, glass: 0, form: 0, swing: null };
    const sp = { cast: null, swing: 0 };
    const hpw = { last: 0, lastHit: 0 };
    let curChar = null, wasActive = false, last = 0, warned = false, needReset = false;

    function resetState() {
        knocked.forEach(e => { e._m38kx = 0; e._m38ky = 0; });
        fx = []; beams = []; knocked = [];
        kr.stacks = 0; kr.stackT = 0; kr.dash = null; kr.glass = 0; kr.form = 0; kr.swing = null;
        sp.cast = null;
        if (typeof player !== 'undefined') {
            hpw.last = player.hp; hpw.lastHit = now;
            if (player.originalSpeed) player.speed = player.originalSpeed;
        }
    }

    // ---------------------------------------------------------------- YARDIMCI
    const isSp = p => p.charType === SP;
    const isKr = p => p.charType === KR;
    const isMine = p => isSp(p) || isKr(p);
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
        if (player.ultReady || player.isDead || kr.form > 0 || sp.cast) return;
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
        e._m38kx = (e._m38kx || 0) + Math.cos(ang) * power;
        e._m38ky = (e._m38ky || 0) + Math.sin(ang) * power;
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


    // ------------------------------------------------- OYUNCU METOTLARI (SARMALAMA)
    function install(p) {
        if (p.__m38) return;
        p.__m38 = true;
        const orig = { fire: p.fire, g1: p.activateGadget, g2: p.activateGadget2, ult: p.fireUlti };

        p.fire = function (a, pull) {
            if (isKr(this)) return krSlash.call(this, a, pull);
            if (isSp(this)) return spBeam.call(this, a, pull);
            return orig.fire.apply(this, arguments);
        };
        p.activateGadget = function (a, pull) {
            if (isKr(this)) return krDash.call(this, a, pull);
            if (isSp(this)) return spBlink.call(this, a, pull);
            return orig.g1.apply(this, arguments);
        };
        p.activateGadget2 = function (a, pull) {
            if (isKr(this)) return krGlass.call(this, a, pull);
            if (isSp(this)) return spFlash.call(this, a, pull);
            return orig.g2.apply(this, arguments);
        };
        p.fireUlti = function (a, pull) {
            if (isKr(this)) return krForm.call(this, a, pull);
            if (isSp(this)) return spRainbow.call(this, a, pull);
            return orig.ult.apply(this, arguments);
        };
    }

    // ========================================================================
    //  KIRILIM
    // ========================================================================
    function krRange() { return kr.form > 0 ? KR_FORM_RANGE : KR_RANGE; }
    function krHalf() { return kr.form > 0 ? Math.PI : KR_HALF; }

    // Ana atak: KRİSTAL KILIÇ
    function krSlash(a) {
        if (this.isDead || this.ammo < 1) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        this.consumeAmmo();
        const form = kr.form > 0;
        const range = krRange(), half = krHalf();
        const dmg = Math.round(KR_DMG * (1 + kr.stacks * KR_STACK) * (form ? KR_FORM_MULT : 1));
        kr.swing = { ang, t: 0, dur: form ? 16 : 11, range, half, form };
        let hits = 0;
        getActiveEnemies().forEach(e => {
            if (!(e.hp > 0)) return;
            if (dist(this, e) > range + e.radius) return;
            if (!form && absAngDiff(angOf(this, e), ang) > half) return;
            hurt(e, dmg, form ? '#ffffff' : '#7fd8ff');
            knock(e, angOf(this, e), form ? 9 : 6);
            hits++;
        });
        allObstacles().forEach(o => {
            if (dist(this, o) <= range + o.radius && (form || absAngDiff(angOf(this, o), ang) <= half)) o.hp -= 150;
        });
        if (hits > 0) {
            kr.stacks = Math.min(KR_STACK_MAX, kr.stacks + 1); // Pasif 1: Spektrum Yükü
            kr.stackT = KR_STACK_TIME;
            charge(6 * hits);
        }
        puff(this.x + Math.cos(ang) * 44, this.y + Math.sin(ang) * 44, form ? '#ffffff' : '#7fd8ff', form ? 6 : 3);
        if (form) shake(hits ? 6 : 2);
    }

    // Q: KIRILMA ATILIMI
    function krDash(a) {
        if (!this.gadgetReady || this.isDead || kr.dash) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        kr.dash = { t: KR_DASH_FRAMES, ang, hit: [] };
        say(this.x, this.y - 30, 'KIRILMA ATILIMI!', '#7fd8ff');
        setCd1(this, KR_Q_CD);
    }

    // E: CAM KALKAN
    function krGlass() {
        if (!this.gadget2Ready || this.isDead) return;
        kr.glass = KR_GLASS_TIME;
        ring(this.x, this.y, '#bfefff', 60, 24);
        say(this.x, this.y - 34, 'CAM KALKAN!', '#bfefff');
        setCd2(this, KR_E_CD);
    }

    function glassEnd() {
        const P = player;
        let hits = 0;
        getActiveEnemies().forEach(e => {
            if (e.hp > 0 && dist(P, e) <= KR_GLASS_R + e.radius) { hurt(e, KR_GLASS_DMG, '#bfefff'); knock(e, angOf(P, e), 9); hits++; }
        });
        ring(P.x, P.y, '#bfefff', KR_GLASS_R, 26);
        ring(P.x, P.y, '#ffffff', KR_GLASS_R * 0.6, 20);
        puff(P.x, P.y, '#bfefff', 12);
        say(P.x, P.y - 40, 'KIRILDI!', '#bfefff');
        shake(8);
        charge(4 + hits * 4);
    }

    // Güç: BEYAZ IŞIK (form değiştirme)
    function krForm() {
        if (!this.ultReady || this.isDead || kr.form > 0) return;
        kr.form = KR_FORM_TIME;
        ring(this.x, this.y, '#ffffff', 150, 30);
        ring(this.x, this.y, '#7fd8ff', 100, 24);
        puff(this.x, this.y, '#ffffff', 16);
        say(this.x, this.y - 40, 'BEYAZ IŞIK!', '#ffffff');
        shake(12);
        spendUlt();
    }

    // ========================================================================
    //  SPEKTRUM
    // ========================================================================
    // Ana atak: IŞIN
    function spBeam(a) {
        if (this.isDead || this.ammo < 1 || sp.cast) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        this.consumeAmmo();
        const sc = scanLine(this.x, this.y, ang, SP_LEN, SP_HALF_W);
        const len = Math.min(SP_LEN, sc.blockD);
        const first = sc.list[0];
        let hits = 0, endLen = len;
        if (first) {
            const far = first.proj >= SP_FAR; // Pasif 1: Odak
            const dmg = Math.round(SP_DMG * (far ? SP_FAR_MULT : 1));
            hurt(first.e, dmg, far ? '#ffb3f0' : '#ff7be5');
            endLen = first.proj;
            hits++;
            // Pasif 2: Kırınım
            let near = null, nd = Infinity;
            getActiveEnemies().forEach(e => {
                if (e === first.e || !(e.hp > 0)) return;
                const d = dist(first.e, e);
                if (d <= SP_JUMP_R && d < nd) { nd = d; near = e; }
            });
            if (near) {
                hurt(near, Math.round(dmg * SP_JUMP_MULT), '#ffd2f6');
                beams.push({ x1: first.e.x, y1: first.e.y, x2: near.x, y2: near.y, life: 10, max: 10, col: '#ffb3f0' });
                hits++;
            }
        }
        if (sc.blocker) sc.blocker.hp -= 150;
        beams.push({ x1: this.x + Math.cos(ang) * this.radius, y1: this.y + Math.sin(ang) * this.radius,
                     x2: this.x + Math.cos(ang) * endLen, y2: this.y + Math.sin(ang) * endLen, life: 10, max: 10, col: '#ff7be5' });
        if (hits > 0) charge(9 * hits);
    }

    // Q: YANSIMA ADIMI (anlık ışınlanma)
    function spBlink(a) {
        if (!this.gadgetReady || this.isDead) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        let d = SP_BLINK;
        const sc = scanLine(this.x, this.y, ang, SP_BLINK + this.radius, 1);
        if (sc.blocker) d = Math.max(0, Math.min(d, sc.blockD - this.radius - 4));
        const nx = clampRange(this.x + Math.cos(ang) * d, WALL_THICKNESS + this.radius, canvas.width - WALL_THICKNESS - this.radius);
        const ny = clampRange(this.y + Math.sin(ang) * d, WALL_THICKNESS + this.radius, canvas.height - WALL_THICKNESS - this.radius);
        ring(this.x, this.y, '#ff7be5', 50, 20);
        puff(this.x, this.y, '#ffb3f0', 8);
        this.x = nx; this.y = ny;
        ring(this.x, this.y, '#ffffff', 50, 20);
        puff(this.x, this.y, '#ffb3f0', 8);
        say(this.x, this.y - 30, 'YANSIMA ADIMI!', '#ff7be5');
        setCd1(this, SP_Q_CD);
    }

    // E: KÖR EDİCİ FLAŞ
    function spFlash() {
        if (!this.gadget2Ready || this.isDead) return;
        let hits = 0;
        getActiveEnemies().forEach(e => {
            if (e.hp > 0 && dist(this, e) <= SP_FLASH_R + e.radius) { hurt(e, SP_FLASH_DMG, '#ffffff'); knock(e, angOf(this, e), 11); hits++; }
        });
        for (let i = botBullets.length - 1; i >= 0; i--) {
            const b = botBullets[i];
            if (b && Math.hypot(b.x - this.x, b.y - this.y) < SP_FLASH_R) botBullets.splice(i, 1);
        }
        ring(this.x, this.y, '#ffffff', SP_FLASH_R, 24);
        ring(this.x, this.y, '#ff7be5', SP_FLASH_R * 0.55, 18);
        puff(this.x, this.y, '#ffd2f6', 12);
        say(this.x, this.y - 34, 'KÖR EDİCİ FLAŞ!', '#ffffff');
        shake(8);
        charge(5 + hits * 4);
        setCd2(this, SP_E_CD);
    }

    // Güç: GÖKKUŞAĞI IŞINI (kısa hedef kilidi, sonra devasa ışın)
    function spRainbow(a) {
        if (!this.ultReady || this.isDead || sp.cast) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        sp.cast = { t: SP_ULT_LOCK, ang };
        say(this.x, this.y - 40, 'GÖKKUŞAĞI!', '#ffffff');
        spendUlt();
    }

    function rainbowFire() {
        const P = player, ang = sp.cast.ang;
        const sc = scanLine(P.x, P.y, ang, SP_ULT_LEN, SP_ULT_HALF_W);
        const len = Math.min(SP_ULT_LEN, sc.blockD);
        sc.list.forEach(h => { hurt(h.e, SP_ULT_DMG, '#ffffff'); knock(h.e, ang, 8); });
        if (sc.blocker) sc.blocker.hp -= 600;
        beams.push({ x1: P.x, y1: P.y, x2: P.x + Math.cos(ang) * len, y2: P.y + Math.sin(ang) * len,
                     life: 22, max: 22, col: '#ff7be5', wide: true });
        puff(P.x + Math.cos(ang) * 30, P.y + Math.sin(ang) * 30, '#ffffff', 12);
        shake(14);
        sp.cast = null;
    }

    // ------------------------------------------------------------- ARAYÜZ
    function ensureUI() {
        [ultiBtn, gadgetBtn, gadgetBtn2].forEach(el => { if (el.style.display !== 'flex') el.style.display = 'flex'; });
        const tag = player.charType;
        if (gadgetBtn.dataset.m38 !== tag) {
            const L = tag === KR ? ['KIRILMA<br>ATILIMI', 'CAM<br>KALKAN'] : ['YANSIMA<br>ADIMI', 'KÖR EDİCİ<br>FLAŞ'];
            gadgetBtn.innerHTML = L[0] + '<br><span id="gadget-timer"></span>';
            gadgetBtn2.innerHTML = L[1] + '<br><span id="gadget-timer-2"></span>';
            gadgetBtn.dataset.m38 = tag;
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

        // --- Hasar filtresi (cam kalkan) + Pasif 2: Yansıtma ---
        if (!P.isDead && P.hp < hpw.last) {
            const d = hpw.last - P.hp;
            if (isKr(P)) {
                if (kr.glass > 0 && P.hp > 0) P.hp = Math.min(P.maxHp, P.hp + d * KR_GLASS_RED);
                let near = null, nd = Infinity;
                en.forEach(e => {
                    const dd = dist(P, e);
                    if (e.hp > 0 && dd <= KR_REFLECT_R + e.radius && dd < nd) { nd = dd; near = e; }
                });
                if (near) hurt(near, Math.round(d * KR_REFLECT), '#bfefff');
            }
            hpw.lastHit = now;
        }

        if (!P.isDead) charge(CHARGE_PER_FRAME * dt); // pasif şarj

        // --- Kırılım: atılım ---
        if (kr.dash) {
            const D = kr.dash;
            const step = (KR_DASH_DIST / KR_DASH_FRAMES) * dt;
            const nx = clampRange(P.x + Math.cos(D.ang) * step, WALL_THICKNESS + P.radius, canvas.width - WALL_THICKNESS - P.radius);
            const ny = clampRange(P.y + Math.sin(D.ang) * step, WALL_THICKNESS + P.radius, canvas.height - WALL_THICKNESS - P.radius);
            let blocked = false;
            for (const o of allObstacles()) {
                if (Math.hypot(nx - o.x, ny - o.y) < P.radius + o.radius) { blocked = true; break; }
            }
            if (blocked || P.isDead) {
                kr.dash = null;
            } else {
                P.x = nx; P.y = ny;
                puff(P.x, P.y, '#7fd8ff', 1);
                let any = false;
                en.forEach(e => {
                    if (!(e.hp > 0) || D.hit.indexOf(e) >= 0) return;
                    if (dist(P, e) < P.radius + e.radius + 6) {
                        D.hit.push(e);
                        hurt(e, KR_DASH_DMG, '#7fd8ff');
                        knock(e, D.ang, 7);
                        charge(5);
                        any = true;
                    }
                });
                if (any) P.ammo = Math.min(P.maxAmmo, P.ammo + 1);
                D.t -= dt;
                if (D.t <= 0) kr.dash = null;
            }
        }

        // --- Kırılım: kalkan, form, yük sönümü ---
        if (kr.glass > 0) {
            kr.glass -= dt;
            if (kr.glass <= 0) { kr.glass = 0; glassEnd(); }
        }
        if (kr.form > 0) {
            kr.form -= dt;
            if (Math.random() < 0.3 * dt) puff(P.x, P.y, '#ffffff', 1);
            if (kr.form <= 0) { kr.form = 0; ring(P.x, P.y, '#ffffff', 100, 24); say(P.x, P.y - 40, 'FORM BİTTİ', '#bfefff'); }
        }
        if (kr.stacks > 0) { kr.stackT -= dt; if (kr.stackT <= 0) kr.stacks = 0; }
        if (kr.swing) { kr.swing.t += dt; if (kr.swing.t >= kr.swing.dur) kr.swing = null; }

        // --- Spektrum: ulti hedef kilidi ---
        if (sp.cast) {
            sp.cast.t -= dt;
            if (P.isDead) sp.cast = null;
            else if (sp.cast.t <= 0) rainbowFire();
        }

        // --- Hız çarpanı ---
        if (P.originalSpeed) {
            let m = 1;
            if (isKr(P) && kr.form > 0) m *= KR_FORM_SPEED;
            if (isSp(P) && sp.cast) m *= 0.5;
            P.speed = P.originalSpeed * m;
        }

        // --- İtme ---
        for (let i = knocked.length - 1; i >= 0; i--) {
            const e = knocked[i];
            const vx = e._m38kx || 0, vy = e._m38ky || 0;
            if (Math.hypot(vx, vy) < 0.3 || !alive.has(e)) { e._m38kx = 0; e._m38ky = 0; knocked.splice(i, 1); continue; }
            e.x = clampRange(e.x + vx * dt, WALL_THICKNESS + e.radius, canvas.width - WALL_THICKNESS - e.radius);
            e.y = clampRange(e.y + vy * dt, WALL_THICKNESS + e.radius, canvas.height - WALL_THICKNESS - e.radius);
            const fr = Math.pow(0.82, dt);
            e._m38kx = vx * fr; e._m38ky = vy * fr;
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
            c.strokeStyle = col; c.lineWidth = (b.wide ? 34 : 12) * a + 3;
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


    function drawKirilim() {
        const P = player, c = ctx, t = Date.now(), r = P.radius;
        const form = kr.form > 0;
        c.save();
        if (P.isInvisible) c.globalAlpha = 0.4;
        // kristal çıkıntılar
        const n = form ? 8 : 5;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + t / (form ? 400 : 1200), rr = r + (form ? 14 : 8);
            c.save(); c.translate(P.x + Math.cos(a) * rr, P.y + Math.sin(a) * rr); c.rotate(a);
            c.fillStyle = form ? 'rgba(255,255,255,0.9)' : 'rgba(127,216,255,0.85)';
            c.beginPath(); c.moveTo(7, 0); c.lineTo(-4, -4); c.lineTo(-4, 4); c.closePath(); c.fill();
            c.restore();
        }
        c.save(); c.translate(P.x, P.y); c.rotate(P.angle || 0);
        c.fillStyle = '#e8f9ff';
        c.beginPath(); c.arc(r * 0.5, -r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(r * 0.5, r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#bfefff'; c.fillRect(r * 0.6, -2, r * 1.0, 4); // kristal kılıç
        c.restore();
        if (kr.glass > 0) {
            const blink = (kr.glass < 30 && Math.floor(kr.glass / 4) % 2 === 0) ? 0.4 : 1;
            c.save(); c.globalAlpha = blink; c.translate(P.x, P.y); c.rotate(t / 700);
            c.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = i * Math.PI / 3, rr = r + 15;
                if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            c.closePath();
            c.fillStyle = 'rgba(191,239,255,0.25)'; c.fill();
            c.strokeStyle = '#bfefff'; c.lineWidth = 3; c.stroke();
            c.restore();
        }
        for (let i = 0; i < KR_STACK_MAX; i++) {
            c.beginPath(); c.arc(P.x - 15 + i * 10, P.y + r + 12, 3, 0, Math.PI * 2);
            c.fillStyle = i < kr.stacks ? '#7fd8ff' : 'rgba(255,255,255,0.18)'; c.fill();
        }
        if (kr.swing) {
            const s = kr.swing, a = 1 - s.t / s.dur;
            c.beginPath(); c.moveTo(P.x, P.y);
            if (s.form) c.arc(P.x, P.y, s.range, 0, Math.PI * 2); else c.arc(P.x, P.y, s.range, s.ang - s.half, s.ang + s.half);
            c.closePath();
            c.fillStyle = (s.form ? 'rgba(255,255,255,' : 'rgba(127,216,255,') + (0.3 * Math.max(0, a)) + ')'; c.fill();
            c.strokeStyle = 'rgba(255,255,255,' + (0.6 * Math.max(0, a)) + ')'; c.lineWidth = 2; c.stroke();
        }
        c.restore();
        if (form) drawBar('BEYAZ IŞIK', kr.form / KR_FORM_TIME, '#ffffff');
    }

    function drawSpektrum() {
        const P = player, c = ctx, t = Date.now(), r = P.radius;
        c.save();
        if (P.isInvisible) c.globalAlpha = 0.4;
        // dönen prizma
        c.save(); c.translate(P.x, P.y - r - 10); c.rotate(t / 600);
        c.beginPath(); c.moveTo(0, -8); c.lineTo(7, 5); c.lineTo(-7, 5); c.closePath();
        c.fillStyle = 'rgba(255,255,255,0.85)'; c.fill();
        c.strokeStyle = '#ff7be5'; c.lineWidth = 2; c.stroke();
        c.restore();
        c.save(); c.translate(P.x, P.y); c.rotate(P.angle || 0);
        c.fillStyle = '#ffeefb';
        c.beginPath(); c.arc(r * 0.5, -r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(r * 0.5, r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#6a2a9a'; c.fillRect(r * 0.55, -2.5, r * 1.1, 5);
        c.restore();
        if (sp.cast) {
            const k = 1 - sp.cast.t / SP_ULT_LOCK;
            c.strokeStyle = 'rgba(255,255,255,' + (0.4 + 0.5 * k) + ')'; c.lineWidth = 2 + 6 * k;
            c.beginPath(); c.moveTo(P.x, P.y);
            c.lineTo(P.x + Math.cos(sp.cast.ang) * SP_ULT_LEN, P.y + Math.sin(sp.cast.ang) * SP_ULT_LEN); c.stroke();
        }
        c.restore();
    }

    function drawPreviews() {
        const c = ctx, P = player;
        if (P.isDead) return;
        const aim = (typeof aimData !== 'undefined' && aimData && aimData.active) ? aimData : null;
        c.save();
        c.setLineDash([8, 6]); c.lineWidth = 2;
        if (aim && P.ammo >= 1) {
            if (isKr(P)) {
                c.strokeStyle = 'rgba(127,216,255,0.6)';
                c.beginPath(); c.moveTo(P.x, P.y);
                if (kr.form > 0) c.arc(P.x, P.y, KR_FORM_RANGE, 0, Math.PI * 2);
                else c.arc(P.x, P.y, KR_RANGE, aim.angle - KR_HALF, aim.angle + KR_HALF);
                c.closePath(); c.stroke();
            } else {
                c.strokeStyle = 'rgba(255,123,229,0.6)';
                c.beginPath(); c.moveTo(P.x, P.y);
                c.lineTo(P.x + Math.cos(aim.angle) * SP_LEN, P.y + Math.sin(aim.angle) * SP_LEN); c.stroke();
            }
        }
        if (gadAim.active && P.gadgetReady) {
            c.strokeStyle = isKr(P) ? 'rgba(127,216,255,0.8)' : 'rgba(255,123,229,0.8)'; c.lineWidth = 6;
            const L = isKr(P) ? KR_DASH_DIST : SP_BLINK;
            c.beginPath(); c.moveTo(P.x, P.y);
            c.lineTo(P.x + Math.cos(gadAim.angle) * L, P.y + Math.sin(gadAim.angle) * L); c.stroke();
        }
        if (gadAim2.active && P.gadget2Ready) {
            c.strokeStyle = isKr(P) ? 'rgba(191,239,255,0.8)' : 'rgba(255,255,255,0.8)';
            c.beginPath(); c.arc(P.x, P.y, isKr(P) ? KR_GLASS_R : SP_FLASH_R, 0, Math.PI * 2); c.stroke();
        }
        if (ultAim.active && P.ultReady) {
            c.strokeStyle = 'rgba(241,196,15,0.8)';
            if (isSp(P)) {
                c.lineWidth = 4; c.beginPath(); c.moveTo(P.x, P.y);
                c.lineTo(P.x + Math.cos(ultAim.angle) * SP_ULT_LEN, P.y + Math.sin(ultAim.angle) * SP_ULT_LEN); c.stroke();
            } else { c.beginPath(); c.arc(P.x, P.y, KR_FORM_RANGE, 0, Math.PI * 2); c.stroke(); }
        }
        c.restore();
    }

    function drawWorld() {
        drawBeams();
        drawFx();
        drawPreviews();
        if (player.isDead) return;
        if (isKr(player)) drawKirilim(); else drawSpektrum();
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
            if (gameStarted && gadgetBtn.dataset.m38) delete gadgetBtn.dataset.m38;
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
            if (!warned) { warned = true; console.warn('[mod38] hata:', err); }
        }
    }
    requestAnimationFrame(loop);
})();
