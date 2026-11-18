/* ==========================================================================
   mod6.js  -  YENİ KARAKTER: "HAZİNEDAR"  (Hazine temalı)
   --------------------------------------------------------------------------
   mod9.js ile AYNI yapıyı kullanır: window.GAME_EXT kaydı + kendi rAF döngüsü
   + oyuncu metotlarını (sadece bu karakter seçiliyken) sarmalama.
   Ana oyun koduna DOKUNMAZ.

   KİT:
   * Pasif      - ALTIN AVI      : Ölen düşmanlar altın bırakır. Altınlar sana uçar,
                                   toplayınca can ve güç verir.
   * Ana atak   - ALTIN PARA     : Hızlı para mermisi, çarpınca altın düşürür.
   * Aksesuar 1 - MİMİK KAPANI   : Sandık kapanı kurar; düşman yaklaşınca kapanır,
                                   alana hasar verir ve altın saçar.
   * Aksesuar 2 - ALTIN SAÇMASI  : Nişan yönüne 5 altın parçası fırlatır.
   * ULTİ       - KRAL HAZİNESİ  : Anında 200 can, 4 sn etrafında dönen altınlar
                                   yakındaki düşmanlara sürekli hasar verir.
   ========================================================================== */
(function () {
    'use strict';

    if (typeof window === 'undefined' || !window.GAME_EXT) return;

    const ID = 'hazinedar';
    const EXT = window.GAME_EXT;
    const GOLD = '#ffca28';
    const COIN_LIFE = 600, COIN_PICK = 20, COIN_PULL = 140, COIN_CAP = 80;

    // ---------------------------------------------------------------- KAYIT
    EXT.characters[ID] = { color: '#c79a2b', hp: 3300, speed: 2.8 };

    // ---------------------------------------------------------- KARAKTER KARTI
    (function addCard() {
        const cont = document.querySelector('.char-select-container');
        if (!cont || document.getElementById('char-' + ID)) return;
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:radial-gradient(circle at 35% 30%,#ffe9a0,#c79a2b 55%,#5a3b0a)"></div>' +
            '<span>Hazinedar</span><small>Pasif: Altın Avı<br>Yetenek: Mimik Kapanı / Altın Saçması<br>Güç: Kral Hazinesi</small>';
        card.addEventListener('click', () => {
            selectedCharacter = ID;
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
        cont.appendChild(card);
    })();

    // ------------------------------------------------------------------ DURUM
    let traps = [], coins = [], fx = [], shots = [], seen = [];
    const king = { t: 0 };
    let wasActive = false, last = 0, warned = false, needReset = false;

    function resetState() {
        traps = []; coins = []; fx = []; shots = []; seen = [];
        king.t = 0;
    }

    // ---------------------------------------------------------------- YARDIMCI
    const isMine = p => p.charType === ID;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    function clampRange(v, lo, hi) { return lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)); }
    function pullOf(aim, den) {
        if (aim.isMouse && typeof lastMouseX !== 'undefined') return Math.min(1, Math.hypot(lastMouseX - player.x, lastMouseY - player.y) / den);
        const p = aim.pull;
        return (p === undefined || p < 0.05) ? 1 : p;
    }
    function angleDiff(a, b) {
        let d = a - b;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return Math.abs(d);
    }
    function rr(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
    function hurt(e, dmg, col) { e.hp -= dmg; addFloatingNumber(e.x, e.y, Math.floor(dmg), col || GOLD); }
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
            addFloatingNumber(player.x, player.y - 40, 'HAZİNE HAZIR!', '#f1c40f');
        }
    }

    // ------------------------------------------------- OYUNCU METOTLARI (SARMALAMA)
    // mod9 gibi: player NESNESİNİN üstüne sarılır (prototype'a değil).
    function install(p) {
        if (p.__m6) return;
        p.__m6 = true;
        const orig = { fire: p.fire, g1: p.activateGadget, g2: p.activateGadget2, ult: p.fireUlti };

        p.fire = function (a, pull) {
            if (!isMine(this)) return orig.fire.call(this, a, pull);
            return myFire.call(this, a, pull);
        };
        p.activateGadget = function (a, pull) {
            if (!isMine(this)) return orig.g1.call(this, a, pull);
            return mimikKapani.call(this, a, pull);
        };
        p.activateGadget2 = function (a, pull) {
            if (!isMine(this)) return orig.g2.call(this, a, pull);
            return altinSacmasi.call(this, a, pull);
        };
        p.fireUlti = function (a, pull) {
            if (!isMine(this)) return orig.ult.call(this, a, pull);
            return kralHazinesi.call(this, a, pull);
        };
    }

    // ------------------------------------------------------------ ANA SALDIRI
    function myFire(a) {
        if (this.isDead || this.ammo < 1) return;
        const sp = 10;
        shots.push({
            x: this.x + Math.cos(a) * this.radius, y: this.y + Math.sin(a) * this.radius,
            sx: this.x, sy: this.y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            dmg: 650, t: 0
        });
        this.angle = a;
        this.consumeAmmo();
    }

    // ------------------------------------------------------------- PASİF: ALTIN AVI
    function dropCoins(x, y, n) {
        for (let i = 0; i < n; i++) {
            coins.push({ x, y, vx: (Math.random() * 2 - 1) * 3, vy: -1 - Math.random() * 2.5, life: COIN_LIFE, t: 0 });
        }
        if (coins.length > COIN_CAP) coins.splice(0, coins.length - COIN_CAP);
    }

    // Ölüm tespiti: (1) listeden çıkan ve canı 0 olan, (2) listede kalıp canı 0'a düşen düşman
    function killWatch(en) {
        en.forEach(e => {
            if (e.hp <= 0) {
                if (!e._m6dead) { e._m6dead = true; dropCoins(e.x, e.y, 2); }
            } else if (e._m6dead) {
                e._m6dead = false; // yeniden doğdu
            }
        });
        seen.forEach(e => {
            if (en.indexOf(e) < 0 && e.hp <= 0 && !e._m6dead) { e._m6dead = true; dropCoins(e.x, e.y, 2); }
        });
        seen = en.slice();
    }

    function coinUpdate(dt) {
        const P = player;
        for (let i = coins.length - 1; i >= 0; i--) {
            const c = coins[i];
            c.t += dt;
            c.x += c.vx * dt; c.y += c.vy * dt;
            const fr = Math.pow(0.9, dt);
            c.vx *= fr; c.vy *= fr;
            c.life -= dt;
            if (c.life <= 0) { coins.splice(i, 1); continue; }
            if (P.isDead) continue;
            const d = dist(P, c);
            if (d > COIN_PULL) continue;
            if (d <= COIN_PICK) {
                P.hp = Math.min(P.maxHp, P.hp + 25);
                charge(2);
                fx.push({ kind: 'txt', x: P.x, y: P.y - 50, text: '+25', life: 20, max: 20 });
                coins.splice(i, 1);
            } else {
                c.x += (P.x - c.x) / d * 6 * dt;
                c.y += (P.y - c.y) / d * 6 * dt;
            }
        }
    }

    // ---------------------------------------------------------------- YETENEKLER
    // Q: Mimik Kapanı
    function mimikKapani(a, pull) {
        if (!this.gadgetReady || this.isDead || this.isDashing) return;
        const ang = a !== undefined ? a : this.angle;
        const pl = pull !== undefined ? Math.max(0, Math.min(1, pull)) : 1;
        const d = 70 + pl * 150;
        const x = clampRange(this.x + Math.cos(ang) * d, WALL_THICKNESS + 20, canvas.width - WALL_THICKNESS - 20);
        const y = clampRange(this.y + Math.sin(ang) * d, WALL_THICKNESS + 20, canvas.height - WALL_THICKNESS - 20);
        traps.push({ x, y, t: 0, life: 360, max: 360 });
        addFloatingNumber(x, y - 25, 'MİMİK KAPANI!', GOLD);
        this.gadgetReady = false; this.gadgetCooldown = 600;
        gadgetBtn.classList.remove('active'); gadgetBtn.classList.add('cooldown');
    }

    // E: Altın Saçması - 5 parça, her biri önündeki ilk düşmana 150 hasar
    function altinSacmasi(a) {
        if (!this.gadget2Ready || this.isDead) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        const R = 330;
        const en = getActiveEnemies();
        let n = 0;
        for (let k = 0; k < 5; k++) {
            const pa = ang - 0.25 + k * 0.125;
            let best = null, bd = R;
            en.forEach(e => {
                const d = dist(e, this);
                if (d < bd && angleDiff(Math.atan2(e.y - this.y, e.x - this.x), pa) < 0.12) { bd = d; best = e; }
            });
            const len = best ? bd : R;
            if (best) { hurt(best, 150, GOLD); n++; }
            fx.push({ kind: 'shot', x1: this.x, y1: this.y, x2: this.x + Math.cos(pa) * len, y2: this.y + Math.sin(pa) * len, life: 10, max: 10 });
        }
        addFloatingNumber(this.x, this.y - 30, 'ALTIN SAÇMASI!', GOLD);
        this.gadget2Ready = false; this.gadget2Cooldown = 720;
        gadgetBtn2.classList.add('cooldown');
        charge(4 + n * 2);
    }

    // R: Kral Hazinesi
    function kralHazinesi() {
        if (!this.ultReady || this.isDead || king.t > 0) return;
        king.t = 240;
        const heal = Math.min(this.maxHp - this.hp, 200);
        this.hp += heal;
        if (heal > 0) addFloatingNumber(this.x, this.y, '+' + Math.floor(heal), '#2ecc71');
        fx.push({ kind: 'ring', x: this.x, y: this.y, r: 150, life: 30, max: 30, col: GOLD });
        addFloatingNumber(this.x, this.y - 40, 'KRAL HAZİNESİ!', GOLD);
        this.ultReady = false; this.ultCharge = 0;
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    // ------------------------------------------------------------- ARAYÜZ
    function ensureUI() {
        [ultiBtn, gadgetBtn, gadgetBtn2].forEach(el => { if (el.style.display !== 'flex') el.style.display = 'flex'; });
        if (gadgetBtn.dataset.m6 !== '1') {
            gadgetBtn.innerHTML = 'MİMİK<br>KAPANI<br><span id="gadget-timer"></span>';
            gadgetBtn2.innerHTML = 'ALTIN<br>SAÇMASI<br><span id="gadget-timer-2"></span>';
            gadgetBtn.dataset.m6 = '1';
            gadgetTimerText = document.getElementById('gadget-timer');
            gadgetTimerText2 = document.getElementById('gadget-timer-2');
        }
    }

    // ------------------------------------------------------------- GÜNCELLE
    function tick(dt) {
        const P = player;
        const en = getActiveEnemies();

        if (!P.isDead) charge(100 * dt / 3600); // pasif şarj: ~60 sn
        else king.t = 0;

        killWatch(en);

        // Mimik kapanları: 20 kare sonra aktif, düşman yaklaşınca kapanır
        for (let i = traps.length - 1; i >= 0; i--) {
            const tr = traps[i];
            tr.t += dt; tr.life -= dt;
            if (tr.life <= 0) { traps.splice(i, 1); continue; }
            if (tr.t < 20) continue;
            const near = en.some(e => dist(e, tr) <= 40 + e.radius);
            if (!near) continue;
            traps.splice(i, 1);
            fx.push({ kind: 'ring', x: tr.x, y: tr.y, r: 90, life: 24, max: 24, col: GOLD });
            let n = 0;
            en.forEach(e => { if (dist(e, tr) <= 90 + e.radius * 0.5) { hurt(e, 450, GOLD); n++; } });
            dropCoins(tr.x, tr.y, 5);
            if (n > 0) charge(8 + n * 4);
            screenShake = Math.max(typeof screenShake === 'number' ? screenShake : 0, 6);
        }

        coinUpdate(dt);

        // Kral Hazinesi: her 15 karede 80 yarıçaptaki düşmanlara 80 hasar
        if (king.t > 0) {
            const before = king.t;
            king.t -= dt;
            if (Math.floor(before / 15) !== Math.floor(king.t / 15)) {
                en.forEach(e => { if (dist(e, P) <= 80 + e.radius) hurt(e, 80, GOLD); });
            }
        }

        // Mermiler (Altın Para)
        for (let i = shots.length - 1; i >= 0; i--) {
            const s = shots[i];
            s.x += s.vx * dt; s.y += s.vy * dt; s.t += dt;
            let hit = null;
            for (const e of en) { if (dist(s, e) < e.radius + 9) { hit = e; break; } }
            if (hit) {
                hurt(hit, s.dmg, GOLD);
                dropCoins(hit.x, hit.y, 1);
                charge(9);
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
            if (blocked || out || far) shots.splice(i, 1);
        }

        for (let i = fx.length - 1; i >= 0; i--) { fx[i].life -= dt; if (fx[i].life <= 0) fx.splice(i, 1); }
    }

    // ------------------------------------------------------------------- ÇİZİM
    function drawCoin(c) {
        const sq = Math.abs(Math.cos(c.t * 0.12)) * 0.8 + 0.2; // dönme efekti
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, c.life / 60));
        ctx.translate(c.x, c.y);
        ctx.scale(sq, 1);
        ctx.fillStyle = '#ffd54f'; ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff8e1';
        ctx.beginPath(); ctx.arc(-1.5, -1.5, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawTrap(tr) {
        const armed = tr.t >= 20;
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 120);
        ctx.save();
        ctx.globalAlpha = armed ? 0.5 + 0.5 * pulse : 0.45;
        ctx.fillStyle = '#6d4c41';
        rr(tr.x - 12, tr.y - 7, 24, 14, 2); ctx.fill();
        ctx.fillStyle = armed ? GOLD : '#8d6e63';
        ctx.fillRect(tr.x - 2, tr.y - 4, 4, 6);
        if (armed) {
            ctx.globalAlpha = 0.25 * pulse;
            ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(tr.x, tr.y, 40, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    }

    function drawFx(f) {
        const a = Math.max(0, f.life / f.max);
        ctx.save();
        if (f.kind === 'ring') {
            ctx.globalAlpha = a; ctx.strokeStyle = f.col; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - a * 0.3), 0, Math.PI * 2); ctx.stroke();
        } else if (f.kind === 'shot') {
            ctx.globalAlpha = a; ctx.lineCap = 'round';
            ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3 * a + 1;
            ctx.shadowColor = GOLD; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        } else if (f.kind === 'txt') {
            ctx.globalAlpha = a; ctx.fillStyle = '#ffd54f';
            ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
            ctx.fillText(f.text, f.x, f.y - (1 - a) * 20);
        }
        ctx.restore();
    }

    function drawShot(s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,213,79,.45)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x - s.vx * 1.6, s.y - s.vy * 1.6); ctx.lineTo(s.x, s.y); ctx.stroke();
        drawCoin({ x: s.x, y: s.y, t: s.t * 2, life: 999 });
        ctx.restore();
    }

    function drawHazinedar() {
        const p = player;
        if (p.isDead) return;
        const x = p.x, y = p.y, t = Date.now();
        const active = king.t > 0;
        const charged = !!p.ultReady;
        const aim = p.angle || 0;
        const lift = active ? 7 : (charged ? 3 : 0); // kapak ne kadar açık
        const lb = y - 22 - lift;                    // kapağın alt kenarı
        const px = Math.cos(aim) * 1.5, py = Math.sin(aim) * 1.5;
        ctx.save();
        if (p.isInvisible) ctx.globalAlpha = 0.4;

        // Dolu güçte nabız gibi atan altın halka
        if (charged) {
            const pulse = 0.5 + 0.5 * Math.sin(t / 150);
            ctx.save();
            ctx.globalAlpha = 0.25 + 0.25 * pulse;
            ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(x, y - 12, 38 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        // Gölge
        ctx.save();
        ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(x, y + 9, 24, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Bacaklar
        ctx.fillStyle = '#3e2415';
        ctx.fillRect(x - 17, y + 2, 7, 7);
        ctx.fillRect(x + 10, y + 2, 7, 7);

        // Gövde (ahşap)
        const g = ctx.createLinearGradient(0, y - 22, 0, y + 6);
        g.addColorStop(0, '#a0662b'); g.addColorStop(1, '#4e2c12');
        ctx.fillStyle = g;
        rr(x - 24, y - 22, 48, 28, 4); ctx.fill();
        ctx.strokeStyle = '#2b1709'; ctx.lineWidth = 1.5; ctx.stroke();

        // Ağız: kapak kalkınca içeride karanlık boşluk ve dişler
        if (lift > 0) {
            ctx.fillStyle = '#1a0a00';
            ctx.fillRect(x - 22, lb, 44, lift + 1);
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 5; i++) {
                const tx = x - 18 + i * 9;
                ctx.beginPath();
                ctx.moveTo(tx, y - 21); ctx.lineTo(tx + 4, y - 21); ctx.lineTo(tx + 2, y - 22 - lift * 0.8);
                ctx.closePath(); ctx.fill();
            }
        }

        // Gövde bantları ve kilit
        ctx.fillStyle = '#ffc107';
        ctx.fillRect(x - 17, y - 22, 3, 28);
        ctx.fillRect(x + 14, y - 22, 3, 28);
        ctx.fillStyle = GOLD;
        rr(x - 5, y - 10, 10, 10, 2); ctx.fill();
        ctx.fillStyle = '#3e2415';
        ctx.fillRect(x - 1, y - 7, 2, 4);

        // Kapak
        const lg = ctx.createLinearGradient(0, lb - 44, 0, lb);
        lg.addColorStop(0, '#c58a3c'); lg.addColorStop(1, '#7a4a1c');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(x - 24, lb); ctx.quadraticCurveTo(x, lb - 44, x + 24, lb);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#2b1709'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#ffc107';
        ctx.fillRect(x - 24, lb - 3, 48, 3);

        // Değerli taş gözler (nişana bakar)
        ctx.fillStyle = charged ? '#ff4081' : '#e040fb';
        if (charged) { ctx.shadowColor = '#ff4081'; ctx.shadowBlur = 8; }
        ctx.beginPath(); ctx.arc(x - 9 + px, y - 16 + py, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 9 + px, y - 16 + py, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x - 10 + px, y - 17 + py, 1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 8 + px, y - 17 + py, 1, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawPreviews() {
        if (player.isDead) return;
        if (gadAim.active && player.gadgetReady) {
            const pl = pullOf(gadAim, RANGE * 0.8);
            const d = 70 + pl * 150;
            const tx = clampRange(player.x + Math.cos(gadAim.angle) * d, WALL_THICKNESS + 20, canvas.width - WALL_THICKNESS - 20);
            const ty = clampRange(player.y + Math.sin(gadAim.angle) * d, WALL_THICKNESS + 20, canvas.height - WALL_THICKNESS - 20);
            ctx.save();
            ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,202,40,.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.beginPath(); ctx.arc(tx, ty, 90, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(255,202,40,.12)'; ctx.fill();
            ctx.restore();
        }
        if (gadAim2.active && player.gadget2Ready) {
            ctx.save();
            ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(255,213,79,.7)'; ctx.lineWidth = 2;
            for (let k = 0; k < 5; k += 4) {
                const pa = gadAim2.angle - 0.25 + k * 0.125;
                ctx.beginPath(); ctx.moveTo(player.x, player.y);
                ctx.lineTo(player.x + Math.cos(pa) * 330, player.y + Math.sin(pa) * 330);
                ctx.stroke();
            }
            ctx.restore();
        }
        if (ultAim.active && player.ultReady) {
            ctx.save();
            ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(255,202,40,.8)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(player.x, player.y, 80, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }
    }

    function drawWorld() {
        traps.forEach(drawTrap);
        coins.forEach(drawCoin);
        shots.forEach(drawShot);
        fx.forEach(drawFx);
        drawPreviews();

        if (king.t > 0 && !player.isDead) {
            const o = player;
            ctx.save();
            ctx.globalAlpha = 0.35; ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]); ctx.lineDashOffset = -king.t;
            ctx.beginPath(); ctx.arc(o.x, o.y, 80, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // Etrafında dönen 4 altın
            for (let i = 0; i < 4; i++) {
                const ang = king.t * 0.1 + i * Math.PI / 2;
                drawCoin({ x: o.x + Math.cos(ang) * 56, y: o.y - 12 + Math.sin(ang) * 20, t: king.t * 3 + i * 9, life: 999 });
            }

            // Üstte geri sayım barı
            ctx.save();
            ctx.globalAlpha = 0.6 + 0.4 * ((king.t % 20) < 10 ? 1 : 0.4);
            ctx.fillStyle = '#ffd54f'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
            ctx.fillText('★ KRAL HAZİNESİ ★', canvas.width / 2, 60);
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(canvas.width / 2 - 120, 72, 240, 6);
            ctx.fillStyle = GOLD;
            ctx.fillRect(canvas.width / 2 - 120, 72, 240 * Math.max(0, king.t / 240), 6);
            ctx.restore();
        }

        drawHazinedar();
    }

    // ----------------------------------------------------- HOOK'LAR (varsa)
    const H = EXT.hooks;
    if (H) {
        const prevKilled = H.onEnemyKilled, prevReset = H.onReset;
        H.onEnemyKilled = function (enemy) {
            if (prevKilled) prevKilled.apply(this, arguments);
            if (typeof player !== 'undefined' && isMine(player)) {
                charge(25);
                if (enemy && typeof enemy.x === 'number' && !enemy._m6dead) { enemy._m6dead = true; dropCoins(enemy.x, enemy.y, 2); }
            }
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
            if (gameStarted && gadgetBtn.dataset.m6) delete gadgetBtn.dataset.m6;
            return;
        }
        try {
            if (!wasActive || needReset) { resetState(); wasActive = true; needReset = false; }
            ensureUI();
            tick(dt);
            drawWorld();
        } catch (err) {
            if (!warned) { warned = true; console.warn('[mod6] hata:', err); }
        }
    }
    requestAnimationFrame(loop);
})();
