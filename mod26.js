/* ==========================================================================
   mod10.js  -  İKİ YENİ KARAKTER: "UYKUCU" & "RÜYAGEZER"
   --------------------------------------------------------------------------
   mod9.js ile AYNI yapıyı kullanır: window.GAME_EXT kaydı + kendi rAF döngüsü
   + oyuncu metotlarını (sadece bu karakterler seçiliyken) sarmalama.
   Ana oyun koduna DOKUNMAZ.

   UYKUCU   (tank / kontrol)
     Ana atak  - UYKU TOZU      : Yavaş mermi, çarpınca düşmanı yavaşlatır.
     Aksesuar1 - UYKU PERDESİ   : Hedefe uyku alanı; içindekiler yavaşlar + erir.
     Aksesuar2 - YASTIK KALKANI : 2.5 sn mermi yutan kalkan + iyileşme.
     ULTİ      - DERİN UYKU     : Yakındaki herkesi 4.5 sn uyutur (ateş edemez).

   RÜYAGEZER (hareketli / patlama hasarı)
     Ana atak  - YILDIZ KIVILCIMI: Hızlı yıldız mermisi.
     Aksesuar1 - RÜYA ATILIMI    : Hızlı atılım.
     Aksesuar2 - HAYAL AYNASI    : Mermi yutan kopya; yok olunca patlar.
     ULTİ      - YILDIZ YAĞMURU  : Hedef bölgeye 7 meteor düşürür.
   ========================================================================== */
(function () {
    'use strict';

    if (typeof window === 'undefined' || !window.GAME_EXT) return;

    const UYKU = 'uykucu', RUYA = 'ruyagezer';
    const EXT = window.GAME_EXT;

    // ---------------------------------------------------------------- KAYIT
    EXT.characters[UYKU] = { color: '#5f4bb7', hp: 3400, speed: 3.0 };
    EXT.characters[RUYA] = { color: '#16a085', hp: 3000, speed: 3.5 };

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
    addCard(UYKU, 'Uykucu',
        'radial-gradient(circle at 35% 35%,#b2a8ff,#4b3f9e)',
        'Yetenek: Uyku Perdesi / Yastık Kalkanı<br>Güç: Derin Uyku');
    addCard(RUYA, 'Rüyagezer',
        'radial-gradient(circle at 35% 35%,#a0fff0,#0e7d6b)',
        'Yetenek: Rüya Atılımı / Hayal Aynası<br>Güç: Yıldız Yağmuru');

    // ------------------------------------------------------------------ DURUM
    let fx = [], rings = [], zones = [], meteors = [], shots = [];
    let clone = null, shield = 0, shieldSetInv = false;
    let wasActive = false, last = 0, warned = false, needReset = false;

    function resetState() {
        fx = []; rings = []; zones = []; meteors = []; shots = [];
        clone = null; shield = 0;
        if (typeof player !== 'undefined' && shieldSetInv) player.jumpInvulnerable = false;
        shieldSetInv = false;
        try {
            [bot, bot2].forEach(b => { if (b) { b._m10sleep = 0; b._m10slow = 0; b._m10px = undefined; b._m10py = undefined; } });
        } catch (e) { /* bot'lar henüz yoksa sorun değil */ }
    }

    // ---------------------------------------------------------------- YARDIMCI
    const isMine = p => p.charType === UYKU || p.charType === RUYA;
    const isUyku = () => player.charType === UYKU;
    const isRuya = () => player.charType === RUYA;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
    function clampRange(v, lo, hi) { return lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)); }
    function pullOf(aim, den) {
        if (aim.isMouse && typeof lastMouseX !== 'undefined') return Math.min(1, Math.hypot(lastMouseX - player.x, lastMouseY - player.y) / den);
        const p = aim.pull;
        return (p === undefined || p < 0.05) ? 1 : p;
    }
    function aimPoint(ang, d, m) {
        return {
            x: clampRange(player.x + Math.cos(ang) * d, WALL_THICKNESS + m, canvas.width - WALL_THICKNESS - m),
            y: clampRange(player.y + Math.sin(ang) * d, WALL_THICKNESS + m, canvas.height - WALL_THICKNESS - m)
        };
    }
    const hasClone = () => !!clone && clone.life > 0 && clone.hp > 0;
    function hurt(e, dmg, col) { e.hp -= dmg; addFloatingNumber(e.x, e.y, Math.floor(dmg), col); }
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

    function fxPush(o) {
        o.maxLife = o.life; o.vx = o.vx || 0; o.vy = o.vy || 0;
        o.size = o.size || 4; o.color = o.color || '#fff';
        o.type = o.type || 'dot'; o.rot = o.rot || 0;
        fx.push(o);
    }
    function fxBurst(x, y, color, n, type) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
            fxPush({ type: type || 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                     life: 25 + Math.random() * 15, size: 2 + Math.random() * 3, color, rot: Math.random() * 3 });
        }
    }
    function ringPush(x, y, R, color, life) { rings.push({ x, y, R, color, life, maxLife: life }); }

    function drawStar(x, y, r, color, rot) {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(rot || 0);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const rr = i % 2 === 0 ? r : r * 0.42, an = i * Math.PI / 4;
            if (i === 0) ctx.moveTo(Math.cos(an) * rr, Math.sin(an) * rr);
            else ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
        }
        ctx.closePath();
        ctx.fillStyle = color; ctx.fill();
        ctx.restore();
    }
    function drawZ(x, y, size, alpha, color) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = color;
        ctx.font = 'bold ' + Math.round(size) + 'px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Z', x, y);
        ctx.restore();
    }

    // ------------------------------------------------- OYUNCU METOTLARI (SARMALAMA)
    // mod9 gibi: player NESNESİNİN üstüne sarılır (prototype'a değil).
    function install(p) {
        if (p.__m10) return;
        p.__m10 = true;
        const orig = { fire: p.fire, g1: p.activateGadget, g2: p.activateGadget2, ult: p.fireUlti };

        p.fire = function (a, pull) {
            if (!isMine(this)) return orig.fire.call(this, a, pull);
            return myFire.call(this, a, pull);
        };
        p.activateGadget = function (a, pull) {
            if (this.charType === UYKU) return uykuQ.call(this, a, pull);
            if (this.charType === RUYA) return ruyaQ.call(this, a, pull);
            return orig.g1.call(this, a, pull);
        };
        p.activateGadget2 = function (a, pull) {
            if (this.charType === UYKU) return uykuE.call(this, a, pull);
            if (this.charType === RUYA) return ruyaE.call(this, a, pull);
            return orig.g2.call(this, a, pull);
        };
        p.fireUlti = function (a, pull) {
            if (this.charType === UYKU) return uykuR.call(this, a, pull);
            if (this.charType === RUYA) return ruyaR.call(this, a, pull);
            return orig.ult.call(this, a, pull);
        };
    }

    // ------------------------------------------------------------ ANA SALDIRI
    function myFire(a) {
        if (this.isDead || this.ammo < 1) return;
        const u = this.charType === UYKU;
        const sp = u ? 9 : 13;
        shots.push({
            kind: u ? 'u' : 'r',
            x: this.x + Math.cos(a) * this.radius, y: this.y + Math.sin(a) * this.radius,
            sx: this.x, sy: this.y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            dmg: u ? 650 : 620, rot: 0
        });
        this.angle = a;
        this.consumeAmmo();
    }

    // ---------------------------------------------------------- UYKUCU YETENEKLERİ
    function uykuQ(a, pull) {
        if (!this.gadgetReady || this.isDead || this.isDashing) return;
        const ang = a !== undefined ? a : this.angle;
        const pm = pull !== undefined ? Math.max(0, Math.min(1, pull)) : 1;
        const tgt = aimPoint(ang, Math.max(50, RANGE * 0.75 * pm), 110);
        zones.push({ x: tgt.x, y: tgt.y, r: 115, life: 360, max: 360 });
        ringPush(tgt.x, tgt.y, 115, '#8e7cf0', 30);
        for (let i = 0; i < 10; i++) {
            fxPush({ type: 'z', x: tgt.x + (Math.random() - .5) * 150, y: tgt.y + (Math.random() - .5) * 150,
                     vy: -0.6, life: 70, size: 14 + Math.random() * 8, color: '#c7b8ff' });
        }
        addFloatingNumber(tgt.x, tgt.y - 30, 'UYKU PERDESİ!', '#8e7cf0');
        this.gadgetReady = false; this.gadgetCooldown = 900;
        gadgetBtn.classList.remove('active'); gadgetBtn.classList.add('cooldown');
        charge(15);
    }

    function uykuE() {
        if (!this.gadget2Ready || this.isDead) return;
        shield = 150;
        this.jumpInvulnerable = true; shieldSetInv = true;
        const heal = Math.min(this.maxHp - this.hp, 250);
        if (heal > 0) { this.hp += heal; addFloatingNumber(this.x, this.y, '+' + Math.floor(heal), '#2ecc71'); }
        ringPush(this.x, this.y, 90, '#dfe6ff', 25);
        for (let i = 0; i < 6; i++) {
            const an = i / 6 * Math.PI * 2;
            fxPush({ type: 'z', x: this.x + Math.cos(an) * 25, y: this.y + Math.sin(an) * 25,
                     vx: Math.cos(an) * 0.4, vy: -0.7, life: 55, size: 12, color: '#dfe6ff' });
        }
        addFloatingNumber(this.x, this.y - 35, 'YASTIK KALKANI!', '#dfe6ff');
        this.gadget2Ready = false; this.gadget2Cooldown = 1200;
        gadgetBtn2.classList.add('cooldown');
        charge(15);
    }

    function uykuR() {
        if (!this.ultReady || this.isDead) return;
        const me = this, R = 300;
        let n = 0;
        getActiveEnemies().forEach(e => {
            if (dist(e, me) < R + e.radius) { e._m10sleep = 270; n++; }
        });
        ringPush(me.x, me.y, R, '#a29bfe', 40);
        ringPush(me.x, me.y, R * 0.55, '#dfe6e9', 26);
        for (let i = 0; i < 14; i++) {
            const an = (i / 14) * Math.PI * 2;
            fxPush({ type: 'z', x: me.x + Math.cos(an) * 30, y: me.y + Math.sin(an) * 30,
                     vx: Math.cos(an) * 0.6, vy: -0.8, life: 60, size: 16 + Math.random() * 6, color: '#c7b8ff' });
        }
        addFloatingNumber(me.x, me.y - 40, n > 0 ? 'DERİN UYKU! (' + n + ')' : 'DERİN UYKU!', '#a29bfe');
        this.ultReady = false; this.ultCharge = 0;
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    // -------------------------------------------------------- RÜYAGEZER YETENEKLERİ
    function ruyaQ(a, pull) {
        if (!this.gadgetReady || this.isDead || this.isDashing) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        this.isDashing = true; this.dashAngle = ang; this.dashHitTargets = [];
        this.dashTimer = 18;
        fxBurst(this.x, this.y, '#7ef9ff', 14, 'star');
        addFloatingNumber(this.x, this.y - 30, 'RÜYA ATILIMI!', '#7ef9ff');
        this.gadgetReady = false; this.gadgetCooldown = 600;
        gadgetBtn.classList.remove('active'); gadgetBtn.classList.add('cooldown');
        charge(10);
    }

    function ruyaE(a) {
        if (!this.gadget2Ready || this.isDead) return;
        const ang = a !== undefined ? a : this.angle;
        const tgt = aimPoint(ang, 100, 40);
        clone = { x: tgt.x, y: tgt.y, radius: 20, hp: 1200, maxHp: 1200, life: 300, max: 300, angle: ang };
        ringPush(tgt.x, tgt.y, 100, '#1abc9c', 30);
        fxBurst(tgt.x, tgt.y, '#7ef9ff', 12, 'star');
        addFloatingNumber(this.x, this.y - 35, 'HAYAL AYNASI!', '#1abc9c');
        this.gadget2Ready = false; this.gadget2Cooldown = 1500;
        gadgetBtn2.classList.add('cooldown');
        charge(15);
    }

    function ruyaR(a, pull) {
        if (!this.ultReady || this.isDead) return;
        const ang = a !== undefined ? a : this.angle;
        const d = pull === undefined ? RANGE * 0.7 : Math.max(90, RANGE * 0.9 * Math.max(0, Math.min(1, pull)));
        const tgt = aimPoint(ang, d, 90);
        for (let i = 0; i < 7; i++) {
            const T = 50 + i * 14;
            meteors.push({
                x: clampRange(tgt.x + (Math.random() - .5) * 220, WALL_THICKNESS + 20, canvas.width - WALL_THICKNESS - 20),
                y: clampRange(tgt.y + (Math.random() - .5) * 220, WALL_THICKNESS + 20, canvas.height - WALL_THICKNESS - 20),
                t: T, T
            });
        }
        ringPush(tgt.x, tgt.y, 120, '#7ef9ff', 30);
        addFloatingNumber(this.x, this.y - 40, 'YILDIZ YAĞMURU!', '#7ef9ff');
        this.ultReady = false; this.ultCharge = 0;
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    function meteorImpact(m) {
        getActiveEnemies().forEach(e => {
            if (dist(e, m) < 70 + e.radius) {
                hurt(e, 450, '#7ef9ff');
                const an = angleTo(m, e);
                e.x = clampRange(e.x + Math.cos(an) * 18, WALL_THICKNESS + e.radius, canvas.width - WALL_THICKNESS - e.radius);
                e.y = clampRange(e.y + Math.sin(an) * 18, WALL_THICKNESS + e.radius, canvas.height - WALL_THICKNESS - e.radius);
            }
        });
        obstacles.forEach(o => { if (dist(o, m) < 70 + o.radius) o.hp -= 300; });
        ringPush(m.x, m.y, 70, '#fdfd96', 24);
        fxBurst(m.x, m.y, '#7ef9ff', 14);
        fxBurst(m.x, m.y, '#fdfd96', 6, 'star');
        screenShake = Math.max(typeof screenShake === 'number' ? screenShake : 0, 5);
    }

    function cloneBlast() {
        const c = clone;
        getActiveEnemies().forEach(e => { if (dist(c, e) < 130) hurt(e, 400, '#1abc9c'); });
        ringPush(c.x, c.y, 130, '#1abc9c', 30);
        fxBurst(c.x, c.y, '#1abc9c', 16);
        clone = null;
    }

    // ------------------------------------------------------------- ARAYÜZ
    function ensureUI() {
        [ultiBtn, gadgetBtn, gadgetBtn2].forEach(el => { if (el.style.display !== 'flex') el.style.display = 'flex'; });
        const tag = player.charType;
        if (gadgetBtn.dataset.m10 !== tag) {
            const L = tag === UYKU
                ? ['UYKU<br>PERDESİ', 'YASTIK<br>KALKANI']
                : ['RÜYA<br>ATILIMI', 'HAYAL<br>AYNASI'];
            gadgetBtn.innerHTML = L[0] + '<br><span id="gadget-timer"></span>';
            gadgetBtn2.innerHTML = L[1] + '<br><span id="gadget-timer-2"></span>';
            gadgetBtn.dataset.m10 = tag;
            gadgetTimerText = document.getElementById('gadget-timer');
            gadgetTimerText2 = document.getElementById('gadget-timer-2');
        }
    }

    // ------------------------------------------------------------- GÜNCELLE
    function tick(dt) {
        const now = Date.now();
        const en = getActiveEnemies();
        const P = player;

        if (!P.isDead) charge(100 * dt / 3600); // pasif şarj: ~60 sn

        // Yastık kalkanı: süre + mermi yutma
        if (shield > 0) {
            shield -= dt;
            if (!P.isDead) {
                for (let i = botBullets.length - 1; i >= 0; i--) {
                    const b = botBullets[i];
                    if (Math.hypot(b.x - P.x, b.y - P.y) < P.radius + 16) { botBullets.splice(i, 1); fxBurst(b.x, b.y, '#dfe6ff', 3); }
                }
            }
            if (shield <= 0) {
                shield = 0;
                if (shieldSetInv) { P.jumpInvulnerable = false; shieldSetInv = false; }
            }
        }

        // Uyku perdeleri
        for (let i = zones.length - 1; i >= 0; i--) {
            const z = zones[i];
            z.life -= dt;
            if (z.life <= 0) { zones.splice(i, 1); continue; }
            en.forEach(e => {
                if (dist(e, z) < z.r + e.radius) {
                    e._m10slow = Math.max(e._m10slow || 0, 10);
                    e.hp -= 0.5 * dt; // ~30 dps
                }
            });
            if (Math.random() < 0.05 * dt) {
                fxPush({ type: 'z', x: z.x + (Math.random() - .5) * z.r, y: z.y + (Math.random() - .5) * z.r,
                         vy: -0.5, life: 60, size: 12 + Math.random() * 6, color: '#a29bfe' });
            }
        }

        // Meteorlar
        for (let i = meteors.length - 1; i >= 0; i--) {
            const m = meteors[i];
            m.t -= dt;
            if (m.t <= 0) { meteorImpact(m); meteors.splice(i, 1); }
        }

        // Hayal aynası
        if (clone) {
            clone.life -= dt;
            for (let i = botBullets.length - 1; i >= 0; i--) {
                const b = botBullets[i];
                if (Math.hypot(b.x - clone.x, b.y - clone.y) < clone.radius + 10) {
                    clone.hp -= (b.damage || b.dmg || 150);
                    botBullets.splice(i, 1);
                }
            }
            if (clone.hp <= 0) cloneBlast();
            else if (clone.life <= 0) { fxBurst(clone.x, clone.y, '#1abc9c', 10); clone = null; }
            else {
                let best = null, bd = 1e9;
                en.forEach(e => { const d = dist(clone, e); if (d < bd) { bd = d; best = e; } });
                if (best) clone.angle = angleTo(clone, best);
            }
        }

        // Mermiler (Uyku Tozu / Yıldız Kıvılcımı)
        for (let i = shots.length - 1; i >= 0; i--) {
            const s = shots[i];
            s.x += s.vx * dt; s.y += s.vy * dt; s.rot += 0.2 * dt;
            let hit = null;
            for (const e of en) { if (dist(s, e) < e.radius + 9) { hit = e; break; } }
            if (hit) {
                if (s.kind === 'u') {
                    hurt(hit, s.dmg, '#a29bfe');
                    hit._m10slow = Math.max(hit._m10slow || 0, 120);
                    fxBurst(s.x, s.y, '#c7b8ff', 6);
                } else {
                    hurt(hit, s.dmg, '#7ef9ff');
                    fxBurst(s.x, s.y, '#fff3b0', 6, 'star');
                }
                charge(8);
                shots.splice(i, 1);
                continue;
            }
            let blocked = false;
            for (const o of allObstacles()) {
                if (dist(s, o) < o.radius + 6) { o.hp -= 120; blocked = true; break; }
            }
            const out = s.x < WALL_THICKNESS + 6 || s.x > canvas.width - WALL_THICKNESS - 6 ||
                        s.y < WALL_THICKNESS + 6 || s.y > canvas.height - WALL_THICKNESS - 6;
            const far = Math.hypot(s.x - s.sx, s.y - s.sy) > RANGE;
            if (blocked || out || far) {
                fxBurst(s.x, s.y, s.kind === 'u' ? '#c7b8ff' : '#fff3b0', 4);
                shots.splice(i, 1);
            }
        }

        // Ortam efektleri
        if (!P.isDead) {
            if (isUyku() && Math.random() < 0.02 * dt) {
                fxPush({ type: 'z', x: P.x + 10, y: P.y - 28, vx: 0.35, vy: -0.6, life: 70, size: 13 + Math.random() * 5, color: '#c7b8ff' });
            }
            if (isRuya() && Math.random() < 0.05 * dt) {
                fxPush({ type: 'star', x: P.x + (Math.random() - .5) * 30, y: P.y - 30,
                         vx: (Math.random() - .5) * 0.3, vy: -0.5, life: 60, size: 3 + Math.random() * 2, color: '#fff3b0' });
            }
            if (isRuya() && P.isDashing) {
                fxPush({ type: 'star', x: P.x, y: P.y, vx: (Math.random() - .5), vy: (Math.random() - .5), life: 30, size: 5, color: '#7ef9ff' });
            }
        }

        for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= dt; if (rings[i].life <= 0) rings.splice(i, 1); }
        for (let i = fx.length - 1; i >= 0; i--) {
            const p = fx[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
            if (p.life <= 0) fx.splice(i, 1);
        }
        if (fx.length > 260) fx.splice(0, fx.length - 260);

        // Düşman durumları (uyku = tam durdurma, yavaşlama = hareketi kırpma)
        en.forEach(e => {
            let drag = 0;
            if (e._m10sleep > 0) {
                drag = 1; e._m10sleep -= dt;
                if (e.lastShot !== undefined) e.lastShot = now - (e.shootInterval || 1500) * 0.55;
            } else if (e._m10slow > 0) { drag = 0.6; }
            if (e._m10slow > 0) e._m10slow -= dt;
            if (drag > 0 && e._m10px !== undefined) {
                const dx = e.x - e._m10px, dy = e.y - e._m10py;
                if (Math.hypot(dx, dy) < 25) { e.x = e._m10px + dx * (1 - drag); e.y = e._m10py + dy * (1 - drag); }
            }
            e._m10px = e.x; e._m10py = e.y;
        });
    }

    // ------------------------------------------------------------------- ÇİZİM
    function drawUltHalo(p) {
        if (!p.ultReady) return;
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 12 + pulse * 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(241,196,15,' + (0.4 + pulse * 0.4) + ')';
        ctx.lineWidth = 2; ctx.stroke();
    }

    function drawUykuPlayer() {
        const p = player, r = p.radius, x = p.x, y = p.y, t = Date.now();
        ctx.save();
        ctx.globalAlpha = p.isInvisible ? 0.4 : 1;
        const pulse = 0.5 + 0.5 * Math.sin(t / 450);
        ctx.beginPath();
        ctx.arc(x, y, r + 7 + pulse * 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(162,155,254,' + (0.25 + pulse * 0.3) + ')';
        ctx.lineWidth = 3; ctx.stroke();

        const sway = Math.sin(t / 350) * 3;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.9, y - r * 0.25);
        ctx.quadraticCurveTo(x - r * 0.5, y - r * 1.5, x + r * 0.2 + sway, y - r * 1.95);
        ctx.quadraticCurveTo(x + r * 0.65, y - r * 1.4, x + r * 0.9, y - r * 0.25);
        ctx.closePath();
        ctx.fillStyle = '#fd79a8'; ctx.fill();
        ctx.strokeStyle = '#e84393'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + r * 0.2 + sway, y - r * 1.95, r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();

        ctx.save();
        ctx.translate(x, y); ctx.rotate(p.angle || 0);
        ctx.strokeStyle = '#1e1b4b'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(r * 0.5, s * r * 0.3, r * 0.17, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
        }
        ctx.restore();
        drawUltHalo(p);
        ctx.restore();
    }

    function drawRuyaPlayer() {
        const p = player, r = p.radius, x = p.x, y = p.y, t = Date.now();
        ctx.save();
        ctx.globalAlpha = p.isInvisible ? 0.4 : 1;
        const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
        g.addColorStop(0, 'rgba(26,188,156,0.35)');
        g.addColorStop(1, 'rgba(26,188,156,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();

        for (let i = 0; i < 3; i++) {
            const an = t / 700 + i * Math.PI * 2 / 3;
            drawStar(x + Math.cos(an) * (r + 16), y + Math.sin(an) * (r + 16) * 0.55,
                     4 + (i % 2) * 1.5, '#fff3b0', t / 300 + i);
        }

        const cx = x + r * 0.95, cy = y - r * 1.55 + Math.sin(t / 500) * 2, R = 9;
        ctx.beginPath();
        ctx.moveTo(cx, cy - R);
        ctx.quadraticCurveTo(cx + R * 1.6, cy, cx, cy + R);
        ctx.quadraticCurveTo(cx + R * 0.2, cy, cx, cy - R);
        ctx.closePath();
        ctx.fillStyle = '#fff3b0';
        ctx.shadowColor = '#fff3b0'; ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.save();
        ctx.translate(x, y); ctx.rotate(p.angle || 0);
        ctx.fillStyle = '#e0fff9';
        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(r * 0.5, s * r * 0.3, r * 0.17, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        drawUltHalo(p);
        ctx.restore();
    }

    function drawWorld() {
        const t = Date.now();
        ctx.save();
        ctx.lineCap = 'round';

        // Uyku perdeleri
        zones.forEach(z => {
            const k = Math.min(1, z.life / 40);
            ctx.save();
            ctx.globalAlpha = k;
            const g = ctx.createRadialGradient(z.x, z.y, z.r * 0.1, z.x, z.y, z.r);
            g.addColorStop(0, 'rgba(142,124,240,0.45)');
            g.addColorStop(1, 'rgba(30,27,75,0.08)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
            ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t / 40;
            ctx.strokeStyle = '#a29bfe'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        });

        // Meteorlar
        meteors.forEach(m => {
            const k = Math.max(0, m.t / m.T);
            ctx.save();
            ctx.globalAlpha = 0.3 + (1 - k) * 0.5;
            ctx.beginPath(); ctx.arc(m.x, m.y, 20 + k * 60, 0, Math.PI * 2);
            ctx.strokeStyle = '#7ef9ff'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.stroke();
            ctx.restore();

            const hy = m.y - k * 260;
            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.shadowColor = '#7ef9ff'; ctx.shadowBlur = 16;
            ctx.beginPath(); ctx.arc(m.x, hy, 9, 0, Math.PI * 2);
            ctx.fillStyle = '#fdfd96'; ctx.fill();
            ctx.beginPath(); ctx.moveTo(m.x, hy); ctx.lineTo(m.x + 6, hy - 26);
            ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(253,253,150,0.6)'; ctx.stroke();
            ctx.restore();
        });

        // Hayal aynası
        if (hasClone()) {
            const c = clone;
            const al = Math.min(1, c.life / 40) * (0.5 + 0.2 * Math.sin(t / 120)) + 0.25;
            ctx.save();
            ctx.globalAlpha = Math.min(1, al);
            ctx.beginPath(); ctx.arc(c.x, c.y, c.radius + 6 + Math.sin(t / 200) * 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#7ef9ff'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(26,188,156,0.7)'; ctx.fill();
            ctx.save();
            ctx.translate(c.x, c.y); ctx.rotate(c.angle || 0);
            ctx.fillStyle = '#e0fff9';
            ctx.beginPath(); ctx.arc(c.radius * 0.5, -c.radius * 0.28, c.radius * 0.16, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(c.radius * 0.5, c.radius * 0.28, c.radius * 0.16, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            ctx.fillStyle = '#444'; ctx.fillRect(c.x - 20, c.y - c.radius - 12, 40, 4);
            ctx.fillStyle = '#7ef9ff'; ctx.fillRect(c.x - 20, c.y - c.radius - 12, 40 * Math.max(0, c.hp / c.maxHp), 4);
            ctx.restore();
        }

        // Uyuyan düşmanların üstünde Z'ler
        getActiveEnemies().forEach(e => {
            if (!(e._m10sleep > 0)) return;
            const tt = t / 25;
            for (let k = 0; k < 2; k++) {
                const ph = (tt + k * 30) % 40;
                drawZ(e.x + 10 + k * 8, e.y - e.radius - 14 - ph, 14 - k * 3, 1 - ph / 40, '#c7b8ff');
            }
        });

        // Mermiler
        shots.forEach(s => {
            ctx.save();
            if (s.kind === 'u') {
                ctx.strokeStyle = 'rgba(162,155,254,.5)'; ctx.lineWidth = 9;
                ctx.beginPath(); ctx.moveTo(s.x - s.vx * 1.6, s.y - s.vy * 1.6); ctx.lineTo(s.x, s.y); ctx.stroke();
                ctx.fillStyle = '#c7b8ff';
                ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, Math.PI * 2); ctx.fill();
                drawZ(s.x, s.y, 11, 1, '#4b3f9e');
            } else {
                ctx.strokeStyle = 'rgba(126,249,255,.5)'; ctx.lineWidth = 6;
                ctx.beginPath(); ctx.moveTo(s.x - s.vx * 1.8, s.y - s.vy * 1.8); ctx.lineTo(s.x, s.y); ctx.stroke();
                drawStar(s.x, s.y, 10, '#fff3b0', s.rot);
            }
            ctx.restore();
        });

        // Karakter görünümü
        if (!player.isDead) {
            if (isUyku()) drawUykuPlayer(); else drawRuyaPlayer();
        }

        // Yastık kalkanı balonları
        if (shield > 0 && !player.isDead) {
            const tt = t / 400;
            const blink = (shield < 40 && Math.floor(shield / 4) % 2 === 0) ? 0.35 : 1;
            ctx.save();
            ctx.globalAlpha = blink;
            for (let i = 0; i < 7; i++) {
                const an = tt + i * Math.PI * 2 / 7;
                ctx.beginPath();
                ctx.arc(player.x + Math.cos(an) * (player.radius + 12), player.y + Math.sin(an) * (player.radius + 12), 8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(235,240,255,0.7)'; ctx.fill();
            }
            ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 14, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(200,215,255,0.45)'; ctx.lineWidth = 2; ctx.stroke();
            ctx.restore();
        }

        drawPreviews();

        // Halkalar
        rings.forEach(r => {
            const k = 1 - r.life / r.maxLife;
            ctx.save();
            ctx.globalAlpha = (1 - k) * 0.8;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.R * (0.25 + 0.75 * k), 0, Math.PI * 2);
            ctx.strokeStyle = r.color; ctx.lineWidth = 2 + 3 * (1 - k); ctx.stroke();
            ctx.restore();
        });

        // Parçacıklar
        fx.forEach(p => {
            const a = Math.max(0, p.life / p.maxLife);
            if (p.type === 'z') drawZ(p.x, p.y, p.size, a, p.color);
            else if (p.type === 'star') drawStar(p.x, p.y, p.size * (0.5 + a * 0.5), p.color, p.rot + (p.maxLife - p.life) * 0.08);
            else {
                ctx.save();
                ctx.globalAlpha = a; ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        });
        ctx.restore();
    }

    function drawPreviews() {
        if (player.isDead) return;
        if (gadAim.active && player.gadgetReady) {
            ctx.save();
            if (isUyku()) {
                const tgt = aimPoint(gadAim.angle, Math.max(50, RANGE * 0.75 * pullOf(gadAim, RANGE * 0.8)), 110);
                ctx.beginPath(); ctx.arc(tgt.x, tgt.y, 115, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(142,124,240,0.18)'; ctx.fill();
                ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(162,155,254,0.8)'; ctx.lineWidth = 2; ctx.stroke();
            } else {
                ctx.strokeStyle = 'rgba(126,249,255,0.7)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
                ctx.setLineDash([10, 8]);
                ctx.beginPath(); ctx.moveTo(player.x, player.y);
                ctx.lineTo(player.x + Math.cos(gadAim.angle) * 160, player.y + Math.sin(gadAim.angle) * 160);
                ctx.stroke();
            }
            ctx.restore();
        }
        if (gadAim2.active && player.gadget2Ready) {
            ctx.save();
            ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
            if (isUyku()) {
                ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 18, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(223,230,255,0.8)'; ctx.stroke();
            } else {
                const tgt = aimPoint(gadAim2.angle, 100, 40);
                ctx.beginPath(); ctx.arc(tgt.x, tgt.y, 20, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(26,188,156,0.9)'; ctx.stroke();
            }
            ctx.restore();
        }
        if (ultAim.active && player.ultReady) {
            ctx.save();
            ctx.setLineDash([10, 10]); ctx.lineWidth = 2;
            if (isUyku()) {
                ctx.beginPath(); ctx.arc(player.x, player.y, 300, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(162,155,254,0.7)'; ctx.stroke();
            } else {
                const tgt = aimPoint(ultAim.angle, RANGE * 0.7, 90);
                ctx.beginPath(); ctx.arc(tgt.x, tgt.y, 90, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(126,249,255,0.8)'; ctx.stroke();
            }
            ctx.restore();
        }
    }

    // ----------------------------------------------- BOT HEDEFLEME (hook varsa)
    // Ana kod bu hook'ları çağırıyorsa botlar aynayı da hedef alır;
    // çağırmıyorsa da ayna mermileri yutarak çalışır (tick içinde).
    const H = EXT.hooks;
    if (H) {
        const prevTarget = H.getBotTarget, prevEngage = H.getEngageDistance, prevExtra = H.getExtraTargets;
        const prevKilled = H.onEnemyKilled, prevReset = H.onReset;
        H.getBotTarget = function (b) {
            const t = prevTarget ? prevTarget(b) : null;
            if (t) return t;
            return hasClone() ? clone : null;
        };
        H.getEngageDistance = function (b) {
            const custom = prevTarget ? prevTarget(b) : null;
            if (!custom && hasClone()) return dist(clone, b);
            return prevEngage ? prevEngage(b) : dist(player, b);
        };
        H.getExtraTargets = function () {
            const base = prevExtra ? (prevExtra() || []) : [];
            return hasClone() ? base.concat([clone]) : base;
        };
        H.onEnemyKilled = function (enemy) {
            if (prevKilled) prevKilled(enemy);
            if (typeof player !== 'undefined' && isMine(player)) charge(25);
        };
        H.onReset = function () {
            if (prevReset) prevReset();
            needReset = true;
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
            if (gameStarted && gadgetBtn.dataset.m10) delete gadgetBtn.dataset.m10;
            return;
        }
        try {
            if (!wasActive || needReset) { resetState(); wasActive = true; needReset = false; }
            ensureUI();
            tick(dt);
            drawWorld();
        } catch (err) {
            if (!warned) { warned = true; console.warn('[mod10] hata:', err); }
        }
    }
    requestAnimationFrame(loop);
})();
