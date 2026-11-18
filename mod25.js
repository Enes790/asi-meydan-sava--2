/* ==========================================================================
   mod8.js  -  YENİ KARAKTER: "KANAL AVCISI"  (Televizyon temalı, yüksek hasar)
   --------------------------------------------------------------------------
   mod9.js ile AYNI yapıyı kullanır: window.GAME_EXT kaydı + kendi rAF döngüsü
   + oyuncu metotlarını (sadece bu karakter seçiliyken) sarmalama.
   Ana oyun koduna DOKUNMAZ.

   KİT:
   * Ana atak   - STATİK MERMİSİ  : Hızlı, yüksek hasarlı ekran mermisi.
   * Aksesuar 1 - SİNYAL IŞINI    : Nişan yönünde delici lazer, geçtiği herkese hasar.
   * Aksesuar 2 - BOMBA KANALI    : Hedefe mini TV bombası bırakır, 1.25 sn sonra patlar.
   * ULTİ       - KESİNTİSİZ YAYIN: 3 sn boyunca en yakın düşmana sürekli şimşek.
   ========================================================================== */
(function () {
    'use strict';

    if (typeof window === 'undefined' || !window.GAME_EXT) return;

    const ID = 'kanal_avcisi';
    const EXT = window.GAME_EXT;
    const PINK = '#ff2e63';

    // ---------------------------------------------------------------- KAYIT
    EXT.characters[ID] = { color: PINK, hp: 2800, speed: 3.1 };

    // ---------------------------------------------------------- KARAKTER KARTI
    (function addCard() {
        const cont = document.querySelector('.char-select-container');
        if (!cont || document.getElementById('char-' + ID)) return;
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:radial-gradient(circle at 35% 30%,#ffb3c6,#ff2e63 55%,#7a0f2e)"></div>' +
            '<span>Kanal Avcısı</span><small>Yetenek: Sinyal Işını / Bomba Kanalı<br>Güç: Kesintisiz Yayın</small>';
        card.addEventListener('click', () => {
            selectedCharacter = ID;
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
        cont.appendChild(card);
    })();

    // ------------------------------------------------------------------ DURUM
    let beams = [], bombs = [], blasts = [], bolts = [], shots = [];
    const ult = { t: 0, acc: 0 };
    let flick = 0, wasActive = false, last = 0, warned = false, needReset = false;

    function resetState() {
        beams = []; bombs = []; blasts = []; bolts = []; shots = [];
        ult.t = 0; ult.acc = 0; flick = 0;
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
    function segDist(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
        let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
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
    function hurt(e, dmg, col) { e.hp -= dmg; addFloatingNumber(e.x, e.y, Math.floor(dmg), col || PINK); }
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
            addFloatingNumber(player.x, player.y - 40, 'YAYIN HAZIR!', '#f1c40f');
        }
    }

    // ------------------------------------------------- OYUNCU METOTLARI (SARMALAMA)
    // mod9 gibi: player NESNESİNİN üstüne sarılır (prototype'a değil).
    function install(p) {
        if (p.__m8) return;
        p.__m8 = true;
        const orig = { fire: p.fire, g1: p.activateGadget, g2: p.activateGadget2, ult: p.fireUlti };

        p.fire = function (a, pull) {
            if (!isMine(this)) return orig.fire.call(this, a, pull);
            return myFire.call(this, a, pull);
        };
        p.activateGadget = function (a, pull) {
            if (!isMine(this)) return orig.g1.call(this, a, pull);
            return sinyalIsini.call(this, a, pull);
        };
        p.activateGadget2 = function (a, pull) {
            if (!isMine(this)) return orig.g2.call(this, a, pull);
            return bombaKanali.call(this, a, pull);
        };
        p.fireUlti = function (a, pull) {
            if (!isMine(this)) return orig.ult.call(this, a, pull);
            return kesintisizYayin.call(this, a, pull);
        };
    }

    // ------------------------------------------------------------ ANA SALDIRI
    function myFire(a) {
        if (this.isDead || this.ammo < 1) return;
        const sp = 11;
        shots.push({
            x: this.x + Math.cos(a) * this.radius, y: this.y + Math.sin(a) * this.radius,
            sx: this.x, sy: this.y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            dmg: 700, ang: a
        });
        this.angle = a;
        this.consumeAmmo();
    }

    // ---------------------------------------------------------------- YETENEKLER
    // Q: Sinyal Işını - nişan yönünde delici lazer
    function sinyalIsini(a) {
        if (!this.gadgetReady || this.isDead || this.isDashing) return;
        const ang = a !== undefined ? a : this.angle;
        this.angle = ang;
        const L = 480;
        const x2 = this.x + Math.cos(ang) * L, y2 = this.y + Math.sin(ang) * L;
        let n = 0;
        getActiveEnemies().forEach(e => {
            if (segDist(e.x, e.y, this.x, this.y, x2, y2) <= 22 + e.radius) { hurt(e, 380, PINK); n++; }
        });
        beams.push({ x1: this.x, y1: this.y, x2, y2, life: 14, max: 14 });
        addFloatingNumber(this.x, this.y - 30, 'SİNYAL IŞINI!', PINK);
        this.gadgetReady = false; this.gadgetCooldown = 480;
        gadgetBtn.classList.remove('active'); gadgetBtn.classList.add('cooldown');
        charge(8 + n * 6);
    }

    // E: Bomba Kanalı - hedefe bomba bırakır, 75 karede patlar
    function bombaKanali(a, pull) {
        if (!this.gadget2Ready || this.isDead) return;
        const ang = a !== undefined ? a : this.angle;
        const pl = pull !== undefined ? Math.max(0, Math.min(1, pull)) : 1;
        const d = 70 + pl * 190;
        const x = clampRange(this.x + Math.cos(ang) * d, WALL_THICKNESS + 20, canvas.width - WALL_THICKNESS - 20);
        const y = clampRange(this.y + Math.sin(ang) * d, WALL_THICKNESS + 20, canvas.height - WALL_THICKNESS - 20);
        bombs.push({ x, y, t: 0, life: 75, max: 75 });
        addFloatingNumber(x, y - 25, 'BOMBA KANALI!', '#ffca28');
        this.gadget2Ready = false; this.gadget2Cooldown = 900;
        gadgetBtn2.classList.add('cooldown');
        charge(8);
    }

    // R: Kesintisiz Yayın - 3 sn boyunca en yakın düşmana sürekli şimşek
    function kesintisizYayin() {
        if (!this.ultReady || this.isDead || ult.t > 0) return;
        ult.t = 180; ult.acc = 0;
        blasts.push({ x: this.x, y: this.y, r: 160, life: 30, max: 30, col: PINK });
        addFloatingNumber(this.x, this.y - 40, 'KESİNTİSİZ YAYIN!', PINK);
        this.ultReady = false; this.ultCharge = 0;
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    function explodeBomb(b) {
        let n = 0;
        getActiveEnemies().forEach(e => {
            if (dist(e, b) <= 220) { hurt(e, 520, '#ffca28'); n++; }
        });
        allObstacles().forEach(o => { if (dist(o, b) <= 220) o.hp -= 200; });
        blasts.push({ x: b.x, y: b.y, r: 220, life: 28, max: 28, col: '#ffca28' });
        screenShake = Math.max(typeof screenShake === 'number' ? screenShake : 0, 8);
        if (n > 0) charge(8 + n * 6);
    }

    // ------------------------------------------------------------- ARAYÜZ
    function ensureUI() {
        [ultiBtn, gadgetBtn, gadgetBtn2].forEach(el => { if (el.style.display !== 'flex') el.style.display = 'flex'; });
        if (gadgetBtn.dataset.m8 !== '1') {
            gadgetBtn.innerHTML = 'SİNYAL<br>IŞINI<br><span id="gadget-timer"></span>';
            gadgetBtn2.innerHTML = 'BOMBA<br>KANALI<br><span id="gadget-timer-2"></span>';
            gadgetBtn.dataset.m8 = '1';
            gadgetTimerText = document.getElementById('gadget-timer');
            gadgetTimerText2 = document.getElementById('gadget-timer-2');
        }
    }

    // ------------------------------------------------------------- GÜNCELLE
    function tick(dt) {
        const P = player;
        const en = getActiveEnemies();

        if (!P.isDead) charge(100 * dt / 3600); // pasif şarj: ~60 sn
        else ult.t = 0;

        // Bombalar
        for (let i = bombs.length - 1; i >= 0; i--) {
            const b = bombs[i];
            b.t += dt; b.life -= dt;
            if (b.life <= 0) { bombs.splice(i, 1); explodeBomb(b); }
        }

        // Kesintisiz Yayın: her 9 karede en yakın düşmana 110 hasar
        if (ult.t > 0) {
            ult.t -= dt; ult.acc += dt;
            while (ult.acc >= 9) {
                ult.acc -= 9;
                let best = null, bd = 650;
                en.forEach(e => { const d = dist(e, P); if (d < bd) { bd = d; best = e; } });
                if (best) {
                    hurt(best, 110, '#7df9ff');
                    bolts.push({ x1: P.x, y1: P.y, x2: best.x, y2: best.y, life: 8, max: 8 });
                }
            }
        }

        // Mermiler (Statik Mermisi)
        for (let i = shots.length - 1; i >= 0; i--) {
            const s = shots[i];
            s.x += s.vx * dt; s.y += s.vy * dt;
            let hit = null;
            for (const e of en) { if (dist(s, e) < e.radius + 9) { hit = e; break; } }
            if (hit) {
                hurt(hit, s.dmg, PINK);
                blasts.push({ x: s.x, y: s.y, r: 40, life: 10, max: 10, col: PINK });
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
            if (blocked || out || far) {
                blasts.push({ x: s.x, y: s.y, r: 28, life: 8, max: 8, col: PINK });
                shots.splice(i, 1);
            }
        }

        [beams, blasts, bolts].forEach(arr => {
            for (let k = arr.length - 1; k >= 0; k--) { arr[k].life -= dt; if (arr[k].life <= 0) arr.splice(k, 1); }
        });
        flick = (flick + dt) % 60;
    }

    // ------------------------------------------------------------------- ÇİZİM
    const BARS = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff'];

    function drawTv() {
        const p = player;
        if (p.isDead) return;
        const x = p.x, y = p.y;
        const charged = !!p.ultReady;
        const aim = p.angle || 0;
        ctx.save();
        if (p.isInvisible) ctx.globalAlpha = 0.4;

        // Dolu güçte nabız gibi atan aura
        if (charged) {
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
            ctx.save();
            ctx.globalAlpha = 0.25 + 0.25 * pulse;
            ctx.strokeStyle = PINK; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(x, y - 16, 34 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        // Anten
        ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 36); ctx.lineTo(x - 14, y - 56);
        ctx.moveTo(x + 4, y - 36); ctx.lineTo(x + 14, y - 56);
        ctx.stroke();
        ctx.fillStyle = charged ? PINK : '#eceff1';
        ctx.shadowColor = PINK; ctx.shadowBlur = charged ? 12 : 0;
        ctx.beginPath();
        ctx.arc(x - 14, y - 56, 3, 0, Math.PI * 2);
        ctx.arc(x + 14, y - 56, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Ayaklar
        ctx.fillStyle = '#263238';
        ctx.fillRect(x - 14, y + 2, 6, 6);
        ctx.fillRect(x + 8, y + 2, 6, 6);

        // Gövde
        const g = ctx.createLinearGradient(x, y - 38, x, y + 4);
        g.addColorStop(0, '#546e7a'); g.addColorStop(1, '#1c262b');
        ctx.fillStyle = g;
        rr(x - 26, y - 38, 52, 42, 7); ctx.fill();
        ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1; ctx.stroke();

        // Yan düğmeler
        ctx.fillStyle = '#ffca28';
        ctx.beginPath(); ctx.arc(x + 19, y - 26, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = charged ? PINK : '#00e676';
        ctx.beginPath(); ctx.arc(x + 19, y - 17, 2, 0, Math.PI * 2); ctx.fill();

        // Ekran
        const sx = x - 20, sy = y - 34, sw = 40, sh = 30;
        ctx.fillStyle = '#050505';
        rr(sx, sy, sw, sh, 4); ctx.fill();
        ctx.save();
        rr(sx, sy, sw, sh, 4); ctx.clip();

        // Renk çubukları (hafif titreşimli)
        const bw = sw / BARS.length;
        for (let i = 0; i < BARS.length; i++) {
            ctx.globalAlpha = 0.75;
            ctx.fillStyle = BARS[i];
            const jit = (Math.random() < 0.08) ? (Math.random() * 3 - 1.5) : 0;
            ctx.fillRect(sx + i * bw, sy + jit, bw + 0.5, sh);
        }
        ctx.globalAlpha = 1;

        // Gözler ve kaşlar (nişana bakar)
        const px = Math.cos(aim) * 1.5, py = Math.sin(aim) * 1.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(sx + 12, sy + 14, 4.5, 5.5, 0, 0, Math.PI * 2);
        ctx.ellipse(sx + 28, sy + 14, 4.5, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d0d0d';
        ctx.beginPath();
        ctx.arc(sx + 12 + px, sy + 14 + py, 2, 0, Math.PI * 2);
        ctx.arc(sx + 28 + px, sy + 14 + py, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PINK; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx + 7, sy + 7); ctx.lineTo(sx + 16, sy + 10);
        ctx.moveTo(sx + 33, sy + 7); ctx.lineTo(sx + 24, sy + 10);
        ctx.stroke();

        // Cam parlaması
        const gl = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
        gl.addColorStop(0, 'rgba(255,255,255,0.22)');
        gl.addColorStop(0.5, 'rgba(255,255,255,0)');
        ctx.fillStyle = gl;
        ctx.fillRect(sx, sy, sw, sh);

        // Tarama çizgileri
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let yy = sy; yy < sy + sh; yy += 3) ctx.fillRect(sx, yy, sw, 1);
        ctx.restore();
        ctx.restore();
    }

    function drawBeamLine(b) {
        const a = Math.max(0, b.life / b.max);
        ctx.save();
        ctx.globalAlpha = a; ctx.lineCap = 'round';
        ctx.shadowColor = PINK; ctx.shadowBlur = 18;
        ctx.strokeStyle = PINK; ctx.lineWidth = 22 * a + 4;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6 * a + 1;
        ctx.stroke();
        ctx.restore();
    }

    function drawBolt(b) {
        const a = Math.max(0, b.life / b.max), segs = 6;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#7df9ff'; ctx.lineWidth = 2;
        ctx.shadowColor = '#7df9ff'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
        for (let s = 1; s < segs; s++) {
            const f = s / segs;
            ctx.lineTo(b.x1 + (b.x2 - b.x1) * f + (Math.random() * 2 - 1) * 10,
                       b.y1 + (b.y2 - b.y1) * f + (Math.random() * 2 - 1) * 10);
        }
        ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.restore();
    }

    function drawBomb(b) {
        const k = Math.max(0, b.life / b.max);
        const blink = (Math.floor(b.t) % 12) < 6;
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, b.y, 20 + 200 * (1 - k), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#263238';
        rr(b.x - 11, b.y - 9, 22, 17, 3); ctx.fill();
        ctx.fillStyle = blink ? PINK : '#ffca28';
        ctx.fillRect(b.x - 8, b.y - 6, 16, 11);
        ctx.restore();
    }

    function drawBlast(f) {
        const a = Math.max(0, f.life / f.max);
        ctx.save();
        ctx.globalAlpha = a * 0.3; ctx.fillStyle = f.col;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - a * 0.4), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a; ctx.strokeStyle = f.col; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - a * 0.4), 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        for (let s = 0; s < 10; s++) {
            ctx.fillRect(f.x + (Math.random() * 2 - 1) * f.r, f.y + (Math.random() * 2 - 1) * f.r, 2 + Math.random() * 6, 2);
        }
        ctx.restore();
    }

    function drawShot(s) {
        ctx.save();
        ctx.lineCap = 'round';
        const tx = s.x - s.vx * 1.8, ty = s.y - s.vy * 1.8;
        for (let i = 0; i < BARS.length; i++) {
            const off = (i - 3) * 1.6;
            ctx.globalAlpha = 0.45;
            ctx.strokeStyle = BARS[i]; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(tx - Math.sin(s.ang) * off, ty + Math.cos(s.ang) * off);
            ctx.lineTo(s.x - Math.sin(s.ang) * off, s.y + Math.cos(s.ang) * off);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowColor = PINK; ctx.shadowBlur = 12;
        ctx.fillStyle = PINK;
        ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawPreviews() {
        if (player.isDead) return;
        if (gadAim.active && player.gadgetReady) {
            ctx.save();
            ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(255,46,99,.7)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(player.x, player.y);
            ctx.lineTo(player.x + Math.cos(gadAim.angle) * 480, player.y + Math.sin(gadAim.angle) * 480);
            ctx.stroke();
            ctx.restore();
        }
        if (gadAim2.active && player.gadget2Ready) {
            const pl = pullOf(gadAim2, RANGE * 0.8);
            const d = 70 + pl * 190;
            const tx = clampRange(player.x + Math.cos(gadAim2.angle) * d, WALL_THICKNESS + 20, canvas.width - WALL_THICKNESS - 20);
            const ty = clampRange(player.y + Math.sin(gadAim2.angle) * d, WALL_THICKNESS + 20, canvas.height - WALL_THICKNESS - 20);
            ctx.save();
            ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,202,40,.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.beginPath(); ctx.arc(tx, ty, 220, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(255,202,40,.12)'; ctx.fill();
            ctx.restore();
        }
        if (ultAim.active && player.ultReady) {
            ctx.save();
            ctx.setLineDash([10, 10]); ctx.strokeStyle = 'rgba(125,249,255,.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(player.x, player.y, 650, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }
    }

    function drawWorld() {
        beams.forEach(drawBeamLine);
        bolts.forEach(drawBolt);
        bombs.forEach(drawBomb);
        shots.forEach(drawShot);
        blasts.forEach(drawBlast);
        drawPreviews();

        if (ult.t > 0) {
            ctx.save();
            ctx.globalAlpha = 0.6 + 0.4 * (flick < 30 ? 1 : 0.4);
            ctx.fillStyle = (flick < 30) ? PINK : '#ffffff';
            ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
            ctx.fillText('◉ KESİNTİSİZ YAYIN ◉', canvas.width / 2, 60);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(canvas.width / 2 - 120, 72, 240, 6);
            ctx.fillStyle = PINK;
            ctx.fillRect(canvas.width / 2 - 120, 72, 240 * Math.max(0, ult.t / 180), 6);
            ctx.restore();
        }

        drawTv();
    }

    // ----------------------------------------------------- HOOK'LAR (varsa)
    const H = EXT.hooks;
    if (H) {
        const prevKilled = H.onEnemyKilled, prevReset = H.onReset;
        H.onEnemyKilled = function (enemy) {
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
            if (gameStarted && gadgetBtn.dataset.m8) delete gadgetBtn.dataset.m8;
            return;
        }
        try {
            if (!wasActive || needReset) { resetState(); wasActive = true; needReset = false; }
            ensureUI();
            tick(dt);
            drawWorld();
        } catch (err) {
            if (!warned) { warned = true; console.warn('[mod8] hata:', err); }
        }
    }
    requestAnimationFrame(loop);
})();
