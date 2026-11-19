/* ==========================================================================
   mod30.js  -  İKİ ÖZGÜN KARAKTER: "ÇARKÇI" (yakın menzil) & "PERVANE" (orta menzil)
   --------------------------------------------------------------------------
   mod9.js ile AYNI yapıyı kullanır: window.GAME_EXT kaydı + kendi rAF döngüsü
   + oyuncu metotlarını (sadece bu karakterler seçiliyken) sarmalama.
   Ana oyun koduna DOKUNMAZ. Hiçbir karakter MERMİ ATMAZ: tüm saldırılar anlıktır.

   ÇARKÇI (yakın menzil, dayanıklı)          HP 3600 / hız 2.9
     Ana atak   - ÇARK VURUŞU    : Önündeki yay içinde herkese 650 hasar.
     Pasif 1    - DİŞLİ HIZI     : Art arda isabette +%8 hasar (en çok 5 kat), 3 sn vurmazsan sıfırlanır.
     Pasif 2    - KENDİNİ ONARIM : 4 sn hasar almazsan saniyede 90 can yenilenir.
     Q          - DİŞLİ ATILIMI  : 140 px atılır, yoldakilere 320 hasar, 1 mühimmat geri.
     E          - ZIRH PLAKASI   : 2.5 sn hasarın %60'ı iptal; bitince emilen hasar (en çok 700) patlar.
     Güç        - DEV MAKİNE     : 8 sn makine formu: menzil 170, hasar x1.5, hız x0.8, %20 hasar azaltma.

   PERVANE (orta menzil, hareketli)          HP 3000 / hız 3.4
     Ana atak   - RÜZGÂR ŞERİDİ  : Anlık çizgi, önündeki ilk 2 düşmana 520 hasar.
     Pasif 1    - HAFİF AYAK     : 3 sn hasar almazsan hız +%12.
     Pasif 2    - YÜKSEK İRTİFA  : 170 px'ten uzak hedefe +%20 hasar.
     Q          - RÜZGÂR PATLAMASI: 130 yarıçap, 350 hasar + itme, yakındaki mermileri siler.
     E          - TURBO          : 3.5 sn hız x1.4, 1 mühimmat geri.
     Güç        - HAVALAN        : 5 sn uçuş: hasar almaz, hız x1.3, ana atak +%25 hasar/menzil,
                                    inişte 150 yarıçapta 450 hasar.
   ========================================================================== */
(function () {
    'use strict';

    if (typeof window === 'undefined' || !window.GAME_EXT) return;

    const CK = 'carkci', PV = 'pervane';
    const EXT = window.GAME_EXT;
    const CHARGE_PER_FRAME = 100 / 3600; // ~60 sn'de dolar
    const CHARGE_PER_KILL = 25;

    // ---- Çarkçı denge sabitleri ----
    const CK_HIT_DMG = 650, CK_RANGE = 95, CK_HALF = 0.7;
    const CK_STACK = 0.08, CK_STACK_MAX = 5, CK_STACK_TIME = 180;
    const CK_REGEN_DELAY = 240, CK_REGEN_PER_FRAME = 90 / 60;
    const CK_DASH_DIST = 140, CK_DASH_FRAMES = 10, CK_DASH_DMG = 320, CK_Q_CD = 600;
    const CK_PLATE_TIME = 150, CK_PLATE_RED = 0.6, CK_PLATE_CAP = 700, CK_PLATE_R = 110, CK_E_CD = 900;
    const CK_FORM_TIME = 480, CK_FORM_RANGE = 170, CK_FORM_HALF = 0.45;
    const CK_FORM_MULT = 1.5, CK_FORM_SPEED = 0.8, CK_FORM_RED = 0.2;

    // ---- Pervane denge sabitleri ----
    const PV_DMG = 520, PV_HALF_W = 16, PV_PIERCE = 2, PV_LEN_K = 0.8;
    const PV_FAR = 170, PV_FAR_MULT = 1.2;
    const PV_PASSIVE_DELAY = 180, PV_PASSIVE_SPEED = 1.12;
    const PV_Q_R = 130, PV_Q_DMG = 350, PV_Q_CD = 720;
    const PV_E_TIME = 210, PV_E_SPEED = 1.4, PV_E_CD = 780;
    const PV_FLY_TIME = 300, PV_FLY_SPEED = 1.3, PV_FLY_MULT = 1.25;
    const PV_LAND_R = 150, PV_LAND_DMG = 450;

    // ---------------------------------------------------------------- KAYIT
    EXT.characters[CK] = { color: '#b0773a', hp: 3600, speed: 2.9 };
    EXT.characters[PV] = { color: '#3fb6d8', hp: 3000, speed: 3.4 };

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
    addCard(CK, 'Çarkçı',
        'radial-gradient(circle at 35% 30%,#f0c98a,#b0773a 55%,#4a2f12)',
        'Yakın menzil<br>Yetenek: Dişli Atılımı / Zırh Plakası<br>Güç: Dev Makine');
    addCard(PV, 'Pervane',
        'radial-gradient(circle at 35% 30%,#c9f1fb,#3fb6d8 55%,#16627a)',
        'Orta menzil<br>Yetenek: Rüzgâr Patlaması / Turbo<br>Güç: Havalan');

    // ------------------------------------------------------------------ DURUM
    let fx = [], beams = [], knocked = [];
    let now = 0;
    const ck = { stacks: 0, stackT: 0, dash: null, plate: 0, absorbed: 0, form: 0, swing: null, regenAcc: 0 };
    const pv = { turbo: 0, fly: 0, setInv: false };
    const hpw = { last: 0, lastHit: 0 };
    let curChar = null, wasActive = false, last = 0, warned = false, needReset = false;

    function resetState() {
        fx = []; beams = []; knocked = [];
        ck.stacks = 0; ck.stackT = 0; ck.dash = null; ck.plate = 0; ck.absorbed = 0;
        ck.form = 0; ck.swing = null; ck.regenAcc = 0;
        if (pv.setInv && typeof player !== 'undefined') player.jumpInvulnerable = false;
        pv.turbo = 0; pv.fly = 0; pv.setInv = false;
        if (typeof player !== 'undefined') {
            hpw.last = player.hp; hpw.lastHit = now;
            if (player.originalSpeed) player.speed = player.originalSpeed;
        }
    }

    // ---------------------------------------------------------------- YARDIMCI
    const isCk = p => p.charType === CK;
    const isPv = p => p.charType === PV;
    const isMine = p => isCk(p) || isPv(p);
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
        if (player.ultReady || player.isDead || ck.form > 0 || pv.fly > 0) return;
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
        e._m30kx = (e._m30kx || 0) + Math.cos(ang) * power;
        e._m30ky = (e._m30ky || 0) + Math.sin(ang) * power;
        if (knocked.indexOf(e) < 0) knocked.push(e);
    }

    // ------------------------------------------------- OYUNCU METOTLARI (SARMALAMA)
    // mod9 gibi: player NESNESİNİN üstüne sarılır (prototype'a değil).
    function install(p) {
        if (p.__m30) return;
        p.__m30 = true;
        const orig = { fire: p.fire, g1: p.activateGadget, g2: p.activateGadget2, ult: p.fireUlti };

        p.fire = function (a, pull) {
            if (isCk(this)) return ckHammer.call(this, a, pull);
            if (isPv(this)) return pvSlash.call(this, a, pull);
            return orig.fire.call(this, a, pull);
        };
        p.activateGadget = function (a, pull) {
            if (isCk(this)) return ckDash.call(this, a, pull);
            if (isPv(this)) return pvBurst.call(this, a, pull);
            return orig.g1.call(this, a, pull);
        };
        p.activateGadget2 = function (a, pull) {
            if (isCk(this)) return ckPlate.call(this, a, pull);
            if (isPv(this)) return pvTurbo.call(this, a, pull);
            return orig.g2.call(this, a, pull);
        };
        p.fireUlti = function (a, pull) {
            if (isCk(this)) return ckForm.call(this, a, pull);
            if (isPv(this)) return pvFly.call(this, a, pull);
            return orig.ult.call(this, a, pull);
        };
    }

    // ========================================================================
    //  ÇARKÇI
    // ========================================================================
    // Ana atak: ÇARK VURUŞU (yakın yay, anlık)
    function ckHammer(a) {
        if (this.isDead || this.ammo < 1) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        this.consumeAmmo();
        const form = ck.form > 0;
        const range = form ? CK_FORM_RANGE : CK_RANGE;
        const half = form ? CK_FORM_HALF : CK_HALF;
        const mult = (1 + ck.stacks * CK_STACK) * (form ? CK_FORM_MULT : 1);
        const dmg = Math.round(CK_HIT_DMG * mult);
        ck.swing = { ang, t: 0, dur: form ? 16 : 11, range, half, form };
        let hits = 0;
        getActiveEnemies().forEach(e => {
            if (!(e.hp > 0)) return;
            if (dist(this, e) > range + e.radius) return;
            if (absAngDiff(angOf(this, e), ang) > half) return;
            hurt(e, dmg, form ? '#e74c3c' : '#f39c12');
            knock(e, angOf(this, e), form ? 10 : 6);
            hits++;
        });
        allObstacles().forEach(o => {
            if (dist(this, o) <= range + o.radius && absAngDiff(angOf(this, o), ang) <= half) o.hp -= 120;
        });
        if (hits > 0) {
            ck.stacks = Math.min(CK_STACK_MAX, ck.stacks + 1);
            ck.stackT = CK_STACK_TIME;
            charge(4 * hits);
        }
        puff(this.x + Math.cos(ang) * 40, this.y + Math.sin(ang) * 40, form ? '#bdc3c7' : '#f39c12', form ? 6 : 3);
        if (form) shake(hits ? 6 : 2);
    }

    // Q: DİŞLİ ATILIMI
    function ckDash(a) {
        if (!this.gadgetReady || this.isDead || ck.dash) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        ck.dash = { t: CK_DASH_FRAMES, ang, hit: [] };
        say(this.x, this.y - 30, 'DİŞLİ ATILIMI!', '#f39c12');
        setCd1(this, CK_Q_CD);
    }

    // E: ZIRH PLAKASI
    function ckPlate() {
        if (!this.gadget2Ready || this.isDead) return;
        ck.plate = CK_PLATE_TIME;
        ck.absorbed = 0;
        ring(this.x, this.y, '#aab7b8', 60, 24);
        say(this.x, this.y - 34, 'ZIRH PLAKASI!', '#aab7b8');
        setCd2(this, CK_E_CD);
    }

    function plateEnd() {
        const P = player;
        const dmg = Math.min(CK_PLATE_CAP, Math.round(ck.absorbed));
        ck.absorbed = 0;
        if (dmg < 50) { ring(P.x, P.y, '#7f8c8d', 50, 14); return; }
        getActiveEnemies().forEach(e => {
            if (dist(P, e) <= CK_PLATE_R + e.radius) { hurt(e, dmg, '#aab7b8'); knock(e, angOf(P, e), 9); }
        });
        ring(P.x, P.y, '#aab7b8', CK_PLATE_R, 26);
        ring(P.x, P.y, '#f39c12', CK_PLATE_R * 0.6, 20);
        say(P.x, P.y - 40, 'KARŞILIK! ' + dmg, '#f39c12');
        shake(8);
        charge(8);
    }

    // Güç: DEV MAKİNE (form değiştirme)
    function ckForm() {
        if (!this.ultReady || this.isDead || ck.form > 0) return;
        ck.form = CK_FORM_TIME;
        ring(this.x, this.y, '#e74c3c', 150, 30);
        ring(this.x, this.y, '#bdc3c7', 90, 22);
        puff(this.x, this.y, '#bdc3c7', 16);
        say(this.x, this.y - 40, 'DEV MAKİNE!', '#e74c3c');
        shake(12);
        spendUlt();
    }

    // ========================================================================
    //  PERVANE
    // ========================================================================
    function pvLen() { return RANGE * PV_LEN_K * (pv.fly > 0 ? PV_FLY_MULT : 1); }

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

    // Ana atak: RÜZGÂR ŞERİDİ (anlık çizgi, mermi yok)
    function pvSlash(a) {
        if (this.isDead || this.ammo < 1) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        this.consumeAmmo();
        const flying = pv.fly > 0;
        const L = pvLen();
        const base = PV_DMG * (flying ? PV_FLY_MULT : 1);
        const sc = scanLine(this.x, this.y, ang, L, PV_HALF_W);
        let hits = 0;
        sc.list.slice(0, PV_PIERCE).forEach(h => {
            const far = h.proj >= PV_FAR;
            hurt(h.e, Math.round(base * (far ? PV_FAR_MULT : 1)), far ? '#9be7ff' : '#3fb6d8');
            hits++;
        });
        if (sc.blocker) sc.blocker.hp -= 120;
        const len = Math.min(L, sc.blockD);
        beams.push({
            x1: this.x + Math.cos(ang) * this.radius, y1: this.y + Math.sin(ang) * this.radius,
            x2: this.x + Math.cos(ang) * len, y2: this.y + Math.sin(ang) * len, life: 9, max: 9
        });
        if (hits > 0) charge(8 * hits);
    }

    // Q: RÜZGÂR PATLAMASI
    function pvBurst() {
        if (!this.gadgetReady || this.isDead) return;
        let hits = 0;
        getActiveEnemies().forEach(e => {
            if (!(e.hp > 0)) return;
            if (dist(this, e) <= PV_Q_R + e.radius) {
                hurt(e, PV_Q_DMG, '#9be7ff');
                knock(e, angOf(this, e), 11);
                hits++;
            }
        });
        for (let i = botBullets.length - 1; i >= 0; i--) {
            const b = botBullets[i];
            if (b && Math.hypot(b.x - this.x, b.y - this.y) < PV_Q_R) botBullets.splice(i, 1);
        }
        ring(this.x, this.y, '#9be7ff', PV_Q_R, 24);
        ring(this.x, this.y, '#ffffff', PV_Q_R * 0.55, 18);
        puff(this.x, this.y, '#d6f4ff', 12);
        say(this.x, this.y - 34, 'RÜZGÂR PATLAMASI!', '#9be7ff');
        shake(7);
        charge(6 + hits * 4);
        setCd1(this, PV_Q_CD);
    }

    // E: TURBO
    function pvTurbo() {
        if (!this.gadget2Ready || this.isDead) return;
        pv.turbo = PV_E_TIME;
        this.ammo = Math.min(this.maxAmmo, this.ammo + 1);
        ring(this.x, this.y, '#7ef9ff', 70, 22);
        say(this.x, this.y - 34, 'TURBO!', '#7ef9ff');
        setCd2(this, PV_E_CD);
    }

    // Güç: HAVALAN (uçuş)
    function pvFly() {
        if (!this.ultReady || this.isDead || pv.fly > 0) return;
        pv.fly = PV_FLY_TIME;
        this.jumpInvulnerable = true; pv.setInv = true; // ana kod: bu bayrakta bot mermileri/slime etkilemez
        ring(this.x, this.y, '#d6f4ff', 130, 28);
        puff(this.x, this.y, '#d6f4ff', 14);
        say(this.x, this.y - 40, 'HAVALAN!', '#d6f4ff');
        shake(6);
        spendUlt();
    }

    function pvLand() {
        const P = player;
        if (pv.setInv) { P.jumpInvulnerable = false; pv.setInv = false; }
        getActiveEnemies().forEach(e => {
            if (!(e.hp > 0)) return;
            if (dist(P, e) <= PV_LAND_R + e.radius) {
                hurt(e, PV_LAND_DMG, '#9be7ff');
                knock(e, angOf(P, e), 10);
            }
        });
        ring(P.x, P.y, '#9be7ff', PV_LAND_R, 26);
        ring(P.x, P.y, '#ffffff', PV_LAND_R * 0.6, 20);
        say(P.x, P.y - 40, 'İNİŞ!', '#9be7ff');
        shake(10);
    }

    // ------------------------------------------------------------- ARAYÜZ
    function ensureUI() {
        [ultiBtn, gadgetBtn, gadgetBtn2].forEach(el => { if (el.style.display !== 'flex') el.style.display = 'flex'; });
        const tag = player.charType;
        if (gadgetBtn.dataset.m30 !== tag) {
            const L = tag === CK ? ['DİŞLİ<br>ATILIMI', 'ZIRH<br>PLAKASI'] : ['RÜZGÂR<br>PATLAT', 'TURBO'];
            gadgetBtn.innerHTML = L[0] + '<br><span id="gadget-timer"></span>';
            gadgetBtn2.innerHTML = L[1] + '<br><span id="gadget-timer-2"></span>';
            gadgetBtn.dataset.m30 = tag;
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

        // --- Hasar filtresi (plaka / form / uçuş): alınan hasarın bir kısmı geri verilir ---
        if (!P.isDead && P.hp < hpw.last) {
            const d = hpw.last - P.hp;
            let red;
            if (pv.fly > 0) {
                red = 1;
            } else {
                const pr = ck.plate > 0 ? CK_PLATE_RED : 0;
                const fr = ck.form > 0 ? CK_FORM_RED : 0;
                red = 1 - (1 - pr) * (1 - fr);
                if (pr > 0) ck.absorbed += d * pr;
            }
            if (red > 0 && P.hp > 0) P.hp = Math.min(P.maxHp, P.hp + d * red);
            hpw.lastHit = now;
        }

        if (!P.isDead) {
            charge(CHARGE_PER_FRAME * dt); // pasif şarj
            const unhit = now - hpw.lastHit;

            if (isCk(P)) {
                // Pasif 1: Dişli Hızı sönümü
                if (ck.stacks > 0) { ck.stackT -= dt; if (ck.stackT <= 0) ck.stacks = 0; }
                // Pasif 2: Kendini Onarım
                if (unhit >= CK_REGEN_DELAY && P.hp < P.maxHp) {
                    const inc = Math.min(P.maxHp - P.hp, CK_REGEN_PER_FRAME * dt);
                    P.hp += inc; ck.regenAcc += inc;
                    if (ck.regenAcc >= 45) { say(P.x, P.y - 30, '+' + Math.round(ck.regenAcc), '#2ecc71'); ck.regenAcc = 0; }
                } else {
                    ck.regenAcc = 0;
                }
            }
        }

        // --- Çarkçı: atılım ---
        if (ck.dash) {
            const D = ck.dash;
            const step = (CK_DASH_DIST / CK_DASH_FRAMES) * dt;
            const nx = clampRange(P.x + Math.cos(D.ang) * step, WALL_THICKNESS + P.radius, canvas.width - WALL_THICKNESS - P.radius);
            const ny = clampRange(P.y + Math.sin(D.ang) * step, WALL_THICKNESS + P.radius, canvas.height - WALL_THICKNESS - P.radius);
            let blocked = false;
            for (const o of allObstacles()) {
                if (Math.hypot(nx - o.x, ny - o.y) < P.radius + o.radius) { blocked = true; break; }
            }
            if (blocked || P.isDead) {
                ck.dash = null;
            } else {
                P.x = nx; P.y = ny;
                puff(P.x, P.y, '#f39c12', 1);
                let any = false;
                en.forEach(e => {
                    if (!(e.hp > 0) || D.hit.indexOf(e) >= 0) return;
                    if (dist(P, e) < P.radius + e.radius + 6) {
                        D.hit.push(e);
                        hurt(e, CK_DASH_DMG, '#f39c12');
                        knock(e, D.ang, 7);
                        charge(5);
                        any = true;
                    }
                });
                if (any) P.ammo = Math.min(P.maxAmmo, P.ammo + 1);
                D.t -= dt;
                if (D.t <= 0) ck.dash = null;
            }
        }

        // --- Çarkçı: plaka ve form süreleri ---
        if (ck.plate > 0) {
            ck.plate -= dt;
            if (ck.plate <= 0) { ck.plate = 0; plateEnd(); }
        }
        if (ck.form > 0) {
            ck.form -= dt;
            if (Math.random() < 0.25 * dt) puff(P.x, P.y - P.radius, '#bdc3c7', 1);
            if (ck.form <= 0) {
                ck.form = 0;
                ring(P.x, P.y, '#bdc3c7', 100, 24);
                say(P.x, P.y - 40, 'FORM BİTTİ', '#bdc3c7');
            }
        }
        if (ck.swing) { ck.swing.t += dt; if (ck.swing.t >= ck.swing.dur) ck.swing = null; }

        // --- Pervane: turbo ve uçuş ---
        if (pv.turbo > 0) {
            pv.turbo -= dt;
            if (Math.random() < 0.5 * dt) puff(P.x, P.y, '#7ef9ff', 1);
            if (pv.turbo < 0) pv.turbo = 0;
        }
        if (pv.fly > 0) {
            pv.fly -= dt;
            if (Math.random() < 0.4 * dt) puff(P.x, P.y + P.radius, '#d6f4ff', 1);
            if (pv.fly <= 0 || P.isDead) { pv.fly = 0; pvLand(); }
        }

        // --- Hız çarpanı (form / turbo / uçuş / Hafif Ayak) ---
        if (P.originalSpeed) {
            let m = 1;
            if (isCk(P) && ck.form > 0) m *= CK_FORM_SPEED;
            if (isPv(P)) {
                if (pv.turbo > 0) m *= PV_E_SPEED;
                if (pv.fly > 0) m *= PV_FLY_SPEED;
                if (!P.isDead && now - hpw.lastHit >= PV_PASSIVE_DELAY) m *= PV_PASSIVE_SPEED; // Pasif 1: Hafif Ayak
            }
            P.speed = P.originalSpeed * m;
        }

        // --- İtme (geri savrulma) ---
        for (let i = knocked.length - 1; i >= 0; i--) {
            const e = knocked[i];
            const vx = e._m30kx || 0, vy = e._m30ky || 0;
            if (Math.hypot(vx, vy) < 0.3 || !alive.has(e)) { e._m30kx = 0; e._m30ky = 0; knocked.splice(i, 1); continue; }
            e.x = clampRange(e.x + vx * dt, WALL_THICKNESS + e.radius, canvas.width - WALL_THICKNESS - e.radius);
            e.y = clampRange(e.y + vy * dt, WALL_THICKNESS + e.radius, canvas.height - WALL_THICKNESS - e.radius);
            const fr = Math.pow(0.82, dt);
            e._m30kx = vx * fr; e._m30ky = vy * fr;
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
    function drawGear(x, y, r, teeth, rot, fill, stroke) {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(rot);
        const step = Math.PI * 2 / teeth, r0 = r * 0.78;
        ctx.beginPath();
        for (let i = 0; i < teeth; i++) {
            const b = i * step;
            const pts = [[b, r0], [b + step * 0.15, r], [b + step * 0.45, r], [b + step * 0.6, r0]];
            pts.forEach((p, k) => {
                const px = Math.cos(p[0]) * p[1], py = Math.sin(p[0]) * p[1];
                if (i === 0 && k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            });
        }
        ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
        ctx.restore();
    }

    function drawBar(label, frac, col) {
        const c = ctx;
        c.save();
        c.globalAlpha = 0.9;
        c.fillStyle = col; c.font = 'bold 24px monospace'; c.textAlign = 'center';
        c.fillText(label, canvas.width / 2, 60);
        c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(canvas.width / 2 - 120, 72, 240, 6);
        c.fillStyle = col; c.fillRect(canvas.width / 2 - 120, 72, 240 * Math.max(0, Math.min(1, frac)), 6);
        c.restore();
    }

    function drawCarkci() {
        const P = player, c = ctx, t = Date.now(), r = P.radius;
        const form = ck.form > 0;
        c.save();
        if (P.isInvisible) c.globalAlpha = 0.4;

        // Arkadaki dişli
        drawGear(P.x, P.y, r + (form ? 16 : 8), form ? 12 : 8, t / (form ? 220 : 520), form ? '#7f8c8d' : '#b0773a', '#3b2a14');
        if (form) {
            // makine zırhı
            c.beginPath(); c.arc(P.x, P.y, r + 12, 0, Math.PI * 2);
            c.strokeStyle = 'rgba(189,195,199,0.9)'; c.lineWidth = 4; c.stroke();
            c.beginPath(); c.arc(P.x, P.y, r + 17, 0, Math.PI * 2);
            c.strokeStyle = 'rgba(231,76,60,' + (0.35 + 0.25 * Math.sin(t / 120)) + ')'; c.lineWidth = 2; c.stroke();
            // kızgın göz çizgisi
            c.save(); c.translate(P.x, P.y); c.rotate(P.angle || 0);
            c.fillStyle = '#ff5e57'; c.fillRect(r * 0.25, -2, r * 0.6, 4);
            c.restore();
        } else {
            c.save(); c.translate(P.x, P.y); c.rotate(P.angle || 0);
            c.fillStyle = '#f0c98a';
            c.beginPath(); c.arc(r * 0.5, -r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.arc(r * 0.5, r * 0.28, r * 0.14, 0, Math.PI * 2); c.fill();
            c.restore();
        }

        // Zırh plakası
        if (ck.plate > 0) {
            const k = ck.plate / CK_PLATE_TIME;
            const blink = (ck.plate < 40 && Math.floor(ck.plate / 4) % 2 === 0) ? 0.4 : 1;
            c.save(); c.globalAlpha = blink;
            c.translate(P.x, P.y); c.rotate(t / 900);
            c.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = i * Math.PI / 3, rr = r + 15;
                if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            c.closePath();
            c.fillStyle = 'rgba(170,183,184,0.22)'; c.fill();
            c.strokeStyle = '#aab7b8'; c.lineWidth = 3; c.stroke();
            c.restore();
            c.fillStyle = '#444'; c.fillRect(P.x - 20, P.y - r - 20, 40, 3);
            c.fillStyle = '#aab7b8'; c.fillRect(P.x - 20, P.y - r - 20, 40 * k, 3);
        }

        // Dişli Hızı: art arda vuruş göstergesi
        for (let i = 0; i < CK_STACK_MAX; i++) {
            c.beginPath(); c.arc(P.x - 20 + i * 10, P.y + r + 12, 3, 0, Math.PI * 2);
            c.fillStyle = i < ck.stacks ? '#f39c12' : 'rgba(255,255,255,0.18)'; c.fill();
        }

        // Çekiç vuruşu yayı
        if (ck.swing) {
            const s = ck.swing, a = 1 - s.t / s.dur;
            c.beginPath(); c.moveTo(P.x, P.y);
            c.arc(P.x, P.y, s.range, s.ang - s.half, s.ang + s.half);
            c.closePath();
            c.fillStyle = (s.form ? 'rgba(231,76,60,' : 'rgba(243,156,18,') + (0.3 * Math.max(0, a)) + ')'; c.fill();
            c.strokeStyle = (s.form ? 'rgba(255,255,255,' : 'rgba(255,230,180,') + (0.6 * Math.max(0, a)) + ')';
            c.lineWidth = 2; c.stroke();
        }
        c.restore();

        if (form) drawBar('⚙ DEV MAKİNE ⚙', ck.form / CK_FORM_TIME, '#e74c3c');
    }

    function drawPervane() {
        const P = player, c = ctx, t = Date.now(), r = P.radius;
        const fly = pv.fly > 0;
        const lift = fly ? 12 : 0;
        c.save();
        if (P.isInvisible) c.globalAlpha = 0.4;

        // Uçarken yerde gölge
        if (fly) {
            c.save(); c.globalAlpha = 0.3; c.fillStyle = '#000';
            c.beginPath(); c.ellipse(P.x, P.y + r + 14, r * 0.9, r * 0.3, 0, 0, Math.PI * 2); c.fill();
            c.restore();
            // rüzgâr halkası
            c.save(); c.translate(P.x, P.y - lift * 0.5); c.rotate(t / 160);
            c.strokeStyle = 'rgba(214,244,255,0.7)'; c.lineWidth = 3;
            for (let k = 0; k < 3; k++) {
                c.beginPath(); c.arc(0, 0, r + 14, k * 2.094, k * 2.094 + 1.1); c.stroke();
            }
            c.restore();
        }

        // Gözler
        c.save(); c.translate(P.x, P.y - lift); c.rotate(P.angle || 0);
        c.fillStyle = '#e6fbff';
        c.beginPath(); c.arc(r * 0.5, -r * 0.28, r * 0.15, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(r * 0.5, r * 0.28, r * 0.15, 0, Math.PI * 2); c.fill();
        c.restore();

        // Pervane (kafanın üstünde)
        const px = P.x, py = P.y - r - 10 - lift;
        c.save(); c.translate(px, py);
        c.strokeStyle = '#5d6d7e'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(0, 8); c.lineTo(0, 0); c.stroke();
        c.globalAlpha = (P.isInvisible ? 0.4 : 1) * 0.35;
        c.beginPath(); c.ellipse(0, 0, 20, 4, 0, 0, Math.PI * 2);
        c.fillStyle = '#d6f4ff'; c.fill();
        c.globalAlpha = P.isInvisible ? 0.4 : 1;
        c.rotate(t / (fly ? 30 : 70));
        c.fillStyle = '#3fb6d8';
        c.beginPath(); c.ellipse(10, 0, 10, 2.6, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(-10, 0, 10, 2.6, 0, 0, Math.PI * 2); c.fill();
        c.restore();

        // Turbo: hız çizgileri
        if (pv.turbo > 0) {
            c.strokeStyle = 'rgba(126,249,255,0.55)'; c.lineWidth = 2;
            const back = (P.angle || 0) + Math.PI;
            for (let k = -1; k <= 1; k++) {
                const ox = Math.cos(back + Math.PI / 2) * k * 8, oy = Math.sin(back + Math.PI / 2) * k * 8;
                c.beginPath();
                c.moveTo(P.x + ox + Math.cos(back) * (r + 4), P.y + oy + Math.sin(back) * (r + 4));
                c.lineTo(P.x + ox + Math.cos(back) * (r + 26), P.y + oy + Math.sin(back) * (r + 26));
                c.stroke();
            }
        }

        // Pasif 1: Hafif Ayak hazırken ince hız halkası
        if (!fly && now - hpw.lastHit >= PV_PASSIVE_DELAY) {
            c.beginPath(); c.arc(P.x, P.y, r + 5, 0, Math.PI * 2);
            c.strokeStyle = 'rgba(126,249,255,0.35)'; c.lineWidth = 2; c.stroke();
        }
        c.restore();

        if (fly) drawBar('✈ HAVALAN ✈', pv.fly / PV_FLY_TIME, '#9be7ff');
    }

    function drawBeams() {
        const c = ctx;
        beams.forEach(b => {
            const a = Math.max(0, b.life / b.max);
            c.save();
            c.globalAlpha = a; c.lineCap = 'round';
            c.shadowColor = '#3fb6d8'; c.shadowBlur = 14;
            c.strokeStyle = '#3fb6d8'; c.lineWidth = 12 * a + 3;
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

    function drawPreviews() {
        const c = ctx, P = player;
        if (P.isDead) return;
        const aim = (typeof aimData !== 'undefined' && aimData && aimData.active) ? aimData : null;
        c.save();
        c.setLineDash([8, 6]); c.lineWidth = 2;
        if (aim && P.ammo >= 1) {
            if (isCk(P)) {
                const form = ck.form > 0;
                c.strokeStyle = 'rgba(243,156,18,0.55)';
                c.beginPath(); c.moveTo(P.x, P.y);
                c.arc(P.x, P.y, form ? CK_FORM_RANGE : CK_RANGE, aim.angle - (form ? CK_FORM_HALF : CK_HALF), aim.angle + (form ? CK_FORM_HALF : CK_HALF));
                c.closePath(); c.stroke();
            } else {
                c.strokeStyle = 'rgba(63,182,216,0.6)';
                c.beginPath(); c.moveTo(P.x, P.y);
                c.lineTo(P.x + Math.cos(aim.angle) * pvLen(), P.y + Math.sin(aim.angle) * pvLen());
                c.stroke();
            }
        }
        if (gadAim.active && P.gadgetReady) {
            if (isCk(P)) {
                c.strokeStyle = 'rgba(243,156,18,0.7)'; c.lineWidth = 6;
                c.beginPath(); c.moveTo(P.x, P.y);
                c.lineTo(P.x + Math.cos(gadAim.angle) * CK_DASH_DIST, P.y + Math.sin(gadAim.angle) * CK_DASH_DIST);
                c.stroke();
            } else {
                c.strokeStyle = 'rgba(155,231,255,0.8)';
                c.beginPath(); c.arc(P.x, P.y, PV_Q_R, 0, Math.PI * 2); c.stroke();
            }
        }
        if (gadAim2.active && P.gadget2Ready && isCk(P)) {
            c.strokeStyle = 'rgba(170,183,184,0.8)';
            c.beginPath(); c.arc(P.x, P.y, CK_PLATE_R, 0, Math.PI * 2); c.stroke();
        }
        if (ultAim.active && P.ultReady) {
            c.strokeStyle = 'rgba(241,196,15,0.8)';
            c.beginPath(); c.arc(P.x, P.y, isCk(P) ? 60 : PV_LAND_R, 0, Math.PI * 2); c.stroke();
        }
        c.restore();
    }

    function drawWorld() {
        drawBeams();
        drawFx();
        drawPreviews();
        if (player.isDead) return;
        if (isCk(player)) drawCarkci(); else drawPervane();
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
            if (gameStarted && gadgetBtn.dataset.m30) delete gadgetBtn.dataset.m30;
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
            if (!warned) { warned = true; console.warn('[mod30] hata:', err); }
        }
    }
    requestAnimationFrame(loop);
})();
