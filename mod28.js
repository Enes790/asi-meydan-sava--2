/* ==========================================================================
   mod23.js  -  İKİ YENİ KARAKTER: "UNUTKAN" & "PEÇELİ"
   --------------------------------------------------------------------------
   mod9.js ile AYNI yapıyı kullanır: window.GAME_EXT kaydı + kendi rAF döngüsü
   + oyuncu metotlarını (sadece bu karakterler seçiliyken) sarmalama.
   Ana oyun koduna DOKUNMAZ.

   UNUTKAN (unutkanlık teması)
     Pasif      - SİLİNEN ANI     : Aldığın hasarın %40'ı 2.5 sn sonra geri gelir.
     Ana atak   - KARALAMA        : Hızlı mürekkep damlası.
     Q          - YAPIŞKAN NOT    : 3 not kağıdı yelpaze halinde. "Tekrar" sonrası 1.5 kat.
     E          - TEKRAR DENE     : Yakına 140 hasar. Vurursa sonraki Q güçlenir.
     Güç        - HER ŞEYİ UNUTTUM: 230 yarıçapta 600 hasar, 300 can.

   PEÇELİ (peçe / mühür teması)
     Pasif      - SIKLAŞAN PERDE  : 4 sn hasar almazsan şarj 2 kat hızlı dolar.
     Ana atak   - PEÇE PARÇASI    : Hızlı mermi.
     Q          - MÜHÜR           : Nişandaki düşmanı 5 sn mühürler; aldığı hasarın %50'si ek hasar.
     E          - MÜHÜR PATLAMASI : Tüm mühürlülere 250 hasar, mühürleri çözer.
     Güç        - PEÇEYİ KALDIR   : 260 yarıçapta 500 hasar ve 5 sn mühür.
   ========================================================================== */
(function () {
    'use strict';

    if (typeof window === 'undefined' || !window.GAME_EXT) return;

    const UK = 'unutkan', PC = 'peceli';
    const EXT = window.GAME_EXT;
    const CHARGE_PER_FRAME = 100 / 3600; // ~60 sn'de dolar
    const VEIL_Y = -6;                   // Peçeli peçesinin dikey konumu
    const ORBIT_R = 15;                  // Unutkan'ın etrafında dönen notların yarıçapı

    // ---------------------------------------------------------------- KAYIT
    EXT.characters[UK] = { color: '#7d8fa6', hp: 3100, speed: 3.1 };
    EXT.characters[PC] = { color: '#5b2a4e', hp: 3000, speed: 3.3 };

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
    addCard(UK, 'Unutkan',
        'radial-gradient(circle at 35% 30%,#dfe6ee,#7d8fa6 55%,#3b4658)',
        'Yetenek: Yapışkan Not / Tekrar Dene<br>Güç: Her Şeyi Unuttum');
    addCard(PC, 'Peçeli',
        'radial-gradient(circle at 35% 30%,#c98ab4,#5b2a4e 55%,#25102f)',
        'Yetenek: Mühür / Mühür Patlaması<br>Güç: Peçeyi Kaldır');

    // ------------------------------------------------------------------ DURUM
    let now = 0;                 // geçen kare sayısı (dt ile birikir)
    let projs = [], fx = [];
    const uk = { refunds: [], echo: false, lastHp: 0 };
    const pc = { lastHp: 0, lastHit: 0 };
    let wasActive = false, last = 0, warned = false, needReset = false;

    function resetState() {
        projs = []; fx = [];
        uk.refunds = []; uk.echo = false; uk.lastHp = player.hp;
        pc.lastHp = player.hp; pc.lastHit = now;
        try {
            getActiveEnemies().forEach(e => { e._m23mark = null; });
        } catch (e) { /* düşmanlar henüz yoksa sorun değil */ }
    }

    // ---------------------------------------------------------------- YARDIMCI
    const isUk = p => p.charType === UK;
    const isPc = p => p.charType === PC;
    const isMine = p => isUk(p) || isPc(p);
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    function angDiff(a, b) {
        let d = a - b;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return d;
    }
    function hurt(e, dmg, col) {
        if (!e || !(e.hp > 0)) return;
        e.hp -= dmg;
        addFloatingNumber(e.x, e.y, Math.floor(dmg), col || '#ffffff');
    }
    function say(x, y, s, col) { addFloatingNumber(x, y, s, col || '#ffffff'); }
    function ring(x, y, col, r) { fx.push({ x, y, col, r, life: 22, max: 22 }); }
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
    function spendUlt() {
        player.ultReady = false; player.ultCharge = 0;
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }
    function setCooldown1(p, frames) {
        p.gadgetReady = false; p.gadgetCooldown = frames;
        gadgetBtn.classList.remove('active'); gadgetBtn.classList.add('cooldown');
    }
    function setCooldown2(p, frames) {
        p.gadget2Ready = false; p.gadget2Cooldown = frames;
        gadgetBtn2.classList.add('cooldown');
    }

    // ------------------------------------------------- OYUNCU METOTLARI (SARMALAMA)
    // mod9 gibi: player NESNESİNİN üstüne sarılır (prototype'a değil).
    function install(p) {
        if (p.__m23) return;
        p.__m23 = true;
        const orig = { fire: p.fire, g1: p.activateGadget, g2: p.activateGadget2, ult: p.fireUlti };

        p.fire = function (a, pull) {
            if (!isMine(this)) return orig.fire.call(this, a, pull);
            return myFire.call(this, a, pull);
        };
        p.activateGadget = function (a, pull) {
            if (isUk(this)) return ukNote.call(this, a, pull);
            if (isPc(this)) return pcMark.call(this, a, pull);
            return orig.g1.call(this, a, pull);
        };
        p.activateGadget2 = function (a, pull) {
            if (isUk(this)) return ukRecall.call(this, a, pull);
            if (isPc(this)) return pcBurst.call(this, a, pull);
            return orig.g2.call(this, a, pull);
        };
        p.fireUlti = function (a, pull) {
            if (isUk(this)) return ukUlti.call(this, a, pull);
            if (isPc(this)) return pcUlti.call(this, a, pull);
            return orig.ult.call(this, a, pull);
        };
    }

    // ------------------------------------------------------------ ANA SALDIRI
    function myFire(a) {
        if (this.isDead || this.ammo < 1) return;
        const sp = 11;
        projs.push({
            kind: isUk(this) ? 'ink' : 'veil',
            x: this.x + Math.cos(a) * this.radius, y: this.y + Math.sin(a) * this.radius,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            travel: 0, range: RANGE, dmg: 600, rot: a, hitR: 9, main: true
        });
        this.angle = a;
        this.consumeAmmo();
    }

    // ---------------------------------------------------------- UNUTKAN YETENEKLERİ
    // Q: 3 not kağıdı yelpaze halinde. E ile vurulduysa 1.5 kat hasar.
    function ukNote(a) {
        if (!this.gadgetReady || this.isDead || this.isDashing) return;
        const mult = uk.echo ? 1.5 : 1;
        if (uk.echo) { uk.echo = false; say(this.x, this.y - 34, 'TEKRAR!', '#f4e04d'); }
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        [-0.2, 0, 0.2].forEach(off => {
            const an = ang + off;
            projs.push({
                kind: 'note', x: this.x, y: this.y,
                vx: Math.cos(an) * 9, vy: Math.sin(an) * 9,
                travel: 0, range: 260, dmg: Math.round(80 * mult), rot: an, hitR: 6, main: false
            });
        });
        setCooldown1(this, 300);
    }

    // E: Tekrar Dene. Yakındaki düşmanlara 140 hasar; vurursa sonraki Q güçlenir.
    function ukRecall() {
        if (!this.gadget2Ready || this.isDead) return;
        let hits = 0;
        getActiveEnemies().forEach(e => {
            if (!(e.hp > 0)) return;
            if (dist(this, e) <= 120 + e.radius) { hurt(e, 140, '#ffd166'); hits++; }
        });
        ring(this.x, this.y, '#ffd166', 120);
        if (hits > 0) {
            uk.echo = true;
            say(this.x, this.y - 34, 'HATIRLADIM!', '#ffd166');
            setCooldown2(this, 540);
            charge(4 + hits * 3);
        } else {
            say(this.x, this.y - 34, 'NE YAPIYORDUM?', '#aab4c3');
            setCooldown2(this, 270);
        }
    }

    // Güç: Her Şeyi Unuttum. 230 yarıçapta 600 hasar, 300 can yenilenir.
    function ukUlti() {
        if (!this.ultReady || this.isDead) return;
        getActiveEnemies().forEach(e => {
            if (!(e.hp > 0)) return;
            if (dist(this, e) <= 230 + e.radius) hurt(e, 600, '#dfe6ee');
        });
        const heal = Math.min(this.maxHp - this.hp, 300);
        this.hp += heal;
        if (heal > 0) say(this.x, this.y, '+' + Math.floor(heal), '#2ecc71');
        ring(this.x, this.y, '#7d8fa6', 230);
        ring(this.x, this.y, '#dfe6ee', 150);
        say(this.x, this.y - 40, 'HER ŞEYİ UNUTTUM!', '#dfe6ee');
        shake(10);
        spendUlt();
    }

    // ----------------------------------------------------------- PEÇELİ YETENEKLERİ
    // Q: Mühür. Nişan yönüne en yakın düşmanı 5 saniyeliğine mühürler.
    function pcMark(a) {
        if (!this.gadgetReady || this.isDead || this.isDashing) return;
        const ang = a !== undefined ? a : this.angle;
        let best = null, bestScore = 1e9;
        getActiveEnemies().forEach(e => {
            if (!(e.hp > 0)) return;
            const d = dist(this, e);
            if (d > 320) return;
            const ea = Math.atan2(e.y - this.y, e.x - this.x);
            const score = d + Math.abs(angDiff(ea, ang)) * 120;
            if (score < bestScore) { bestScore = score; best = e; }
        });
        if (!best) { say(this.x, this.y - 34, 'HEDEF YOK', '#aab4c3'); return; } // bekleme harcanmaz
        best._m23mark = { until: now + 300, last: best.hp };
        ring(best.x, best.y, '#8e2c4f', 50);
        say(best.x, best.y - best.radius - 10, 'MÜHÜR', '#c0392b');
        setCooldown1(this, 480);
    }

    // E: Mühür Patlaması. Tüm mühürlü düşmanlara 250 hasar verir ve mühürleri çözer.
    function pcBurst() {
        if (!this.gadget2Ready || this.isDead) return;
        let n = 0;
        getActiveEnemies().forEach(e => {
            if (!e._m23mark || !(e.hp > 0)) return;
            hurt(e, 250, '#c0392b');
            e._m23mark = null;
            ring(e.x, e.y, '#c0392b', 70);
            n++;
        });
        if (!n) { say(this.x, this.y - 34, 'MÜHÜR YOK', '#aab4c3'); return; } // bekleme harcanmaz
        charge(8 * n);
        say(this.x, this.y - 34, 'ÇÖZÜLDÜ x' + n, '#c0392b');
        setCooldown2(this, 900);
    }

    // Güç: Peçeyi Kaldır. 260 yarıçapta 500 hasar ve düşmanları 5 saniye mühürler.
    function pcUlti() {
        if (!this.ultReady || this.isDead) return;
        getActiveEnemies().forEach(e => {
            if (!(e.hp > 0)) return;
            if (dist(this, e) <= 260 + e.radius) {
                hurt(e, 500, '#c0392b');
                e._m23mark = { until: now + 300, last: e.hp };
            }
        });
        ring(this.x, this.y, '#5b2a4e', 260);
        ring(this.x, this.y, '#c0392b', 140);
        say(this.x, this.y - 40, 'PEÇEYİ KALDIRDIM', '#c0392b');
        shake(12);
        spendUlt();
    }

    // ------------------------------------------------------------- ARAYÜZ
    function ensureUI() {
        [ultiBtn, gadgetBtn, gadgetBtn2].forEach(el => { if (el.style.display !== 'flex') el.style.display = 'flex'; });
        const tag = player.charType;
        if (gadgetBtn.dataset.m23 !== tag) {
            const L = tag === UK ? ['NOT', 'TEKRAR'] : ['MÜHÜR', 'PATLAT'];
            gadgetBtn.innerHTML = L[0] + '<br><span id="gadget-timer"></span>';
            gadgetBtn2.innerHTML = L[1] + '<br><span id="gadget-timer-2"></span>';
            gadgetBtn.dataset.m23 = tag;
            gadgetTimerText = document.getElementById('gadget-timer');
            gadgetTimerText2 = document.getElementById('gadget-timer-2');
        }
    }

    // ------------------------------------------------------------- GÜNCELLE
    function tick(dt) {
        const P = player;
        now += dt;
        const en = getActiveEnemies();

        if (!P.isDead) {
            if (isUk(P)) {
                // Pasif: Silinen Anı. Aldığın hasarın %40'ı 150 kare sonra geri gelir.
                if (P.hp < uk.lastHp) uk.refunds.push({ amt: (uk.lastHp - P.hp) * 0.4, at: now + 150 });
                for (let i = uk.refunds.length - 1; i >= 0; i--) {
                    const r = uk.refunds[i];
                    if (now >= r.at) { P.hp = Math.min(P.maxHp, P.hp + r.amt); uk.refunds.splice(i, 1); }
                }
                uk.lastHp = P.hp;
                charge(CHARGE_PER_FRAME * dt);
            } else {
                // Pasif: Sıklaşan Perde. 4 saniye hasar almazsa şarj iki kat hızlı dolar.
                if (P.hp < pc.lastHp) pc.lastHit = now;
                pc.lastHp = P.hp;
                const unhit = now - pc.lastHit >= 240;
                charge(CHARGE_PER_FRAME * dt * (unhit ? 2 : 1));
            }
        }

        // Düşman üzerindeki mühür: her hasar kaynağının %50'si ek hasar olarak uygulanır.
        en.forEach(e => {
            const m = e._m23mark;
            if (!m) return;
            if (now >= m.until || !(e.hp > 0)) { e._m23mark = null; return; }
            const drop = m.last - e.hp;
            if (drop > 0) e.hp -= drop * 0.5;
            m.last = e.hp;
        });

        // Mermiler ve notlar
        for (let i = projs.length - 1; i >= 0; i--) {
            const s = projs[i];
            s.x += s.vx * dt; s.y += s.vy * dt;
            s.travel += Math.hypot(s.vx, s.vy) * dt;
            s.rot += s.kind === 'note' ? 0.15 * dt : 0;
            let hit = null;
            for (const e of en) { if (e.hp > 0 && dist(s, e) < e.radius + s.hitR) { hit = e; break; } }
            if (hit) {
                hurt(hit, s.dmg, s.kind === 'note' ? '#f4e04d' : (s.kind === 'ink' ? '#aab4c3' : '#c0392b'));
                ring(hit.x, hit.y, s.kind === 'note' ? '#f4e04d' : '#c0a0d0', 30);
                if (s.main) charge(8);
                projs.splice(i, 1);
                continue;
            }
            let blocked = false;
            for (const o of allObstacles()) {
                if (dist(s, o) < o.radius + 6) { if (s.main) o.hp -= 120; blocked = true; break; }
            }
            const out = s.x < WALL_THICKNESS + 6 || s.x > canvas.width - WALL_THICKNESS - 6 ||
                        s.y < WALL_THICKNESS + 6 || s.y > canvas.height - WALL_THICKNESS - 6;
            if (blocked || out || s.travel >= s.range) projs.splice(i, 1);
        }

        for (let i = fx.length - 1; i >= 0; i--) { fx[i].life -= dt; if (fx[i].life <= 0) fx.splice(i, 1); }
    }

    // ------------------------------------------------------------------- ÇİZİM
    function drawUnutkan() {
        const p = player, c = ctx;
        const base = now * 0.05;
        for (let k = 0; k < 2; k++) {
            const a = base + k * Math.PI;
            const x = p.x + Math.cos(a) * ORBIT_R;
            const y = p.y - 6 + Math.sin(a) * ORBIT_R * 0.6;
            c.save();
            c.translate(x, y); c.rotate(a * 2);
            c.globalAlpha = 0.85;
            c.fillStyle = '#f6ecb2'; c.fillRect(-4, -3, 8, 6);
            c.fillStyle = '#c9a227'; c.fillRect(-4, -3, 8, 1.5);
            c.restore();
        }
        if (uk.echo) { // Tekrar hazır: parlayan halka
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 140);
            c.save();
            c.globalAlpha = 0.3 + 0.4 * pulse;
            c.strokeStyle = '#f4e04d'; c.lineWidth = 2.5;
            c.beginPath(); c.arc(p.x, p.y, p.radius + 8, 0, Math.PI * 2); c.stroke();
            c.restore();
        }
    }

    function drawPeceli() {
        const p = player, c = ctx;
        const hx = p.x, hy = p.y + VEIL_Y;
        const sway = Math.sin(now * 0.08) * 2;
        const unhit = now - pc.lastHit >= 240;
        const alpha = unhit ? 0.95 : 0.6;
        c.save();
        c.fillStyle = 'rgba(91,42,78,' + alpha + ')';
        c.beginPath();
        c.moveTo(hx - 7, hy - 3);
        c.quadraticCurveTo(hx, hy + 4, hx + 7, hy - 3);
        c.lineTo(hx + 6, hy + 5);
        c.quadraticCurveTo(hx, hy + 8, hx - 6, hy + 5);
        c.closePath(); c.fill();
        c.strokeStyle = 'rgba(91,42,78,0.55)'; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(hx - 6, hy + 5); c.quadraticCurveTo(hx - 11 + sway, hy + 10, hx - 9 + sway, hy + 16);
        c.stroke();
        c.beginPath();
        c.moveTo(hx + 6, hy + 5); c.quadraticCurveTo(hx + 11 - sway, hy + 10, hx + 9 - sway, hy + 16);
        c.stroke();
        c.fillStyle = '#f5f5f5';
        c.fillRect(hx - 4, hy - 5, 2, 2);
        c.fillRect(hx + 2, hy - 5, 2, 2);
        c.restore();
    }

    function drawMarks() {
        const c = ctx;
        getActiveEnemies().forEach(e => {
            if (!e._m23mark || !(e.hp > 0)) return;
            const x = e.x - e.radius - 9, y = e.y;
            c.save();
            c.globalAlpha = 0.6 + 0.4 * Math.sin(now * 0.2);
            c.fillStyle = '#8e2c4f'; c.strokeStyle = '#f1d3dd'; c.lineWidth = 1.5;
            c.beginPath();
            c.moveTo(x, y - 5); c.lineTo(x + 4, y); c.lineTo(x, y + 5); c.lineTo(x - 4, y);
            c.closePath(); c.fill(); c.stroke();
            c.restore();
        });
    }

    function drawProjs() {
        const c = ctx;
        projs.forEach(s => {
            c.save();
            if (s.kind === 'note') {
                c.translate(s.x, s.y); c.rotate(s.rot);
                c.fillStyle = '#f6ecb2'; c.fillRect(-6, -5, 12, 10);
                c.fillStyle = '#c9a227'; c.fillRect(-6, -5, 12, 2);
            } else if (s.kind === 'ink') {
                c.strokeStyle = 'rgba(125,143,166,.5)'; c.lineWidth = 8; c.lineCap = 'round';
                c.beginPath(); c.moveTo(s.x - s.vx * 1.6, s.y - s.vy * 1.6); c.lineTo(s.x, s.y); c.stroke();
                c.fillStyle = '#3b4658';
                c.beginPath(); c.arc(s.x, s.y, 8, 0, Math.PI * 2); c.fill();
                c.fillStyle = 'rgba(255,255,255,.7)';
                c.beginPath(); c.arc(s.x - 2, s.y - 2, 2.5, 0, Math.PI * 2); c.fill();
            } else {
                c.strokeStyle = 'rgba(142,44,79,.5)'; c.lineWidth = 7; c.lineCap = 'round';
                c.beginPath(); c.moveTo(s.x - s.vx * 1.8, s.y - s.vy * 1.8); c.lineTo(s.x, s.y); c.stroke();
                c.fillStyle = '#8e2c4f';
                c.beginPath(); c.arc(s.x, s.y, 8, 0, Math.PI * 2); c.fill();
                c.strokeStyle = '#f1d3dd'; c.lineWidth = 1.5; c.stroke();
            }
            c.restore();
        });
    }

    function drawFx() {
        const c = ctx;
        fx.forEach(f => {
            const t = 1 - f.life / f.max;
            c.save();
            c.globalAlpha = Math.max(0, 1 - t);
            c.strokeStyle = f.col; c.lineWidth = 3;
            c.beginPath(); c.arc(f.x, f.y, f.r * (0.25 + 0.75 * t), 0, Math.PI * 2); c.stroke();
            c.restore();
        });
    }

    function drawPreviews() {
        const c = ctx, p = player;
        if (p.isDead) return;
        if (gadAim.active && p.gadgetReady) {
            c.save();
            c.setLineDash([8, 6]); c.lineWidth = 2;
            if (isUk(p)) {
                c.strokeStyle = 'rgba(246,236,178,.7)';
                [-0.2, 0, 0.2].forEach(off => {
                    c.beginPath(); c.moveTo(p.x, p.y);
                    c.lineTo(p.x + Math.cos(gadAim.angle + off) * 260, p.y + Math.sin(gadAim.angle + off) * 260);
                    c.stroke();
                });
            } else {
                c.strokeStyle = 'rgba(142,44,79,.7)';
                c.beginPath(); c.moveTo(p.x, p.y);
                c.lineTo(p.x + Math.cos(gadAim.angle) * 320, p.y + Math.sin(gadAim.angle) * 320);
                c.stroke();
            }
            c.restore();
        }
        if (gadAim2.active && p.gadget2Ready && isUk(p)) {
            c.save();
            c.setLineDash([6, 6]); c.strokeStyle = 'rgba(255,209,102,.7)'; c.lineWidth = 2;
            c.beginPath(); c.arc(p.x, p.y, 120, 0, Math.PI * 2); c.stroke();
            c.restore();
        }
        if (ultAim.active && p.ultReady) {
            c.save();
            c.setLineDash([10, 8]); c.lineWidth = 2;
            c.strokeStyle = isUk(p) ? 'rgba(223,230,238,.7)' : 'rgba(192,57,43,.7)';
            c.beginPath(); c.arc(p.x, p.y, isUk(p) ? 230 : 260, 0, Math.PI * 2); c.stroke();
            c.restore();
        }
    }

    function drawWorld() {
        drawMarks();
        drawProjs();
        drawFx();
        drawPreviews();
        if (player.isDead) return;
        if (isUk(player)) drawUnutkan(); else drawPeceli();
    }

    // ----------------------------------------------------- HOOK'LAR (varsa)
    const H = EXT.hooks;
    if (H) {
        const prevKilled = H.onEnemyKilled, prevReset = H.onReset;
        H.onEnemyKilled = function () {
            if (prevKilled) prevKilled.apply(this, arguments);
            if (typeof player !== 'undefined' && isMine(player)) charge(25);
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
            if (gameStarted && gadgetBtn.dataset.m23) delete gadgetBtn.dataset.m23;
            return;
        }
        try {
            if (!wasActive || needReset) { resetState(); wasActive = true; needReset = false; }
            ensureUI();
            tick(dt);
            drawWorld();
        } catch (err) {
            if (!warned) { warned = true; console.warn('[mod23] hata:', err); }
        }
    }
    requestAnimationFrame(loop);
})();
