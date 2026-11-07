// ============================================================================
// mod33.js - "Kement" karakteri (hareketle çizilen döngü / mühür)
// Ana dosyaya dokunmaz. index.html'de TÜM mod script'lerinden SONRA eklenmeli:
//   <script src="mod33.js"></script>
//
// Kement hiçbir şey fırlatmaz: mermi, ışın, koni, loblu atış, çağırma, düşman
// fırlatma, botlar arası bağ, temas hasarı YOK.
//
// ÖZGÜN MEKANİK - KEMENT (iz döngüsü): Yürüdüğün yol arkanda parlayan bir iz
// bırakır (5 sn yaşar). İzin kendi kendini kesecek şekilde bir DÖNGÜ kapatırsan
// (bir düşmanın etrafında dön!), içi MÜHÜRLENİR:
//   - İçindeki düşmanlar 3 sn boyunca yerinde kilitlenir, ateş edemez ve
//     yuvalar slime üretemez; her saniye hasar alırlar.
//   - Süre bitince mühür içeri çöker: 400 + alan x 0.02 hasar (en fazla 1200).
//     Büyük döngü = daha çok hasar ama daha riskli.
//  - Ana saldırı (Atılım): Sağ joystick'i çek-bırak, yönünde kısa bir atılım
//    yaparsın (çok kısa dokunulmaz). İz çizmeye ve kaçmaya yarar. 1 cephane.
//  - Yetenek 1 (SIKIŞTIR): Açık mühürleri hemen çöktürür (%35 fazla hasar).
//  - Yetenek 2 (ZORLA KAPAT): İzini baştan sona kapatıp döngü yapar; tam
//    döngü çizemediğinde kurtarıcı.
//  - Güç (KEMENT FIRTINASI): 8 sn boyunca iz solmaz, hızın %20 artar, kapanan
//    her döngü ANINDA çöker (%50 fazla hasar). Zincirleme döngüler yap!
//  - Bar: mühür hasarıyla ve zamanla dolar.
// ============================================================================
(function () {
    'use strict';
    const ID = 'kement';
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));

    window.GAME_EXT = window.GAME_EXT || { characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {} };
    window.GAME_EXT.characters[ID] = { color: '#ffb142', hp: 3600, speed: 3.6 };

    // ---- Denge ayarları (buradan oynayabilirsin) ----
    const CFG = {
        sample: 8, life: 300, maxPts: 240,          // iz: nokta aralığı (px), ömür (kare), en çok nokta
        gap: 22, close: 18, closeUlt: 30, minArea: 3000,  // döngü kapanma şartları
        sealLife: 180, dotDmg: 30, dotEvery: 15, maxSeals: 3,
        impBase: 400, impAreaK: 0.02, impCap: 1200,  // çöküş hasarı
        dash: { dist: 150, frames: 8 },
        q: { cd: 420, mul: 1.35 },
        e: { cd: 540 },
        ult: { time: 480, speedMul: 1.2, mul: 1.5 },
        passive: 0.02, chargeDiv: 14
    };

    let trail = [], lastRec = null, seals = [], fx = [], dash = null, ultT = 0, lastT = 0, wasStarted = false;

    // ---- Güç şarjı: ana oyunun şarjı bu karakter için kapalı, kendi barımız var ----
    const prevCharge = window.chargeUlti;
    window.chargeUlti = function () {
        if (player.charType === ID) return;
        return prevCharge.apply(this, arguments);
    };
    function charge(n) {
        if (!gameStarted || player.charType !== ID || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + n);
        ultFill.style.width = player.ultCharge + '%';
        if (player.ultCharge >= 100) {
            player.ultReady = true; ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, 'KEMENT HAZIR!', '#ffb142');
        }
    }

    // ---- Geometri ----
    function inside(x, y, poly) {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
        }
        return c;
    }
    function polyArea(poly) {
        let a = 0;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
        return Math.abs(a) / 2;
    }
    function centroid(poly) {
        let x = 0, y = 0; poly.forEach(p => { x += p.x; y += p.y; });
        return { x: x / poly.length, y: y / poly.length };
    }

    // ---- İz kaydı ----
    function recordTrail(ts) {
        const life = ultT > 0 ? Infinity : CFG.life;
        trail.forEach(p => p.age += ts);
        while (trail.length && trail[0].age > life) trail.shift();
        const pos = { x: player.x, y: player.y };
        if (!lastRec || Math.hypot(pos.x - lastRec.x, pos.y - lastRec.y) > 220) { lastRec = pos; trail = [{ x: pos.x, y: pos.y, age: 0 }]; return; }
        let d = Math.hypot(pos.x - lastRec.x, pos.y - lastRec.y);
        while (d >= CFG.sample) {
            const f = CFG.sample / d;
            lastRec = { x: lastRec.x + (pos.x - lastRec.x) * f, y: lastRec.y + (pos.y - lastRec.y) * f };
            trail.push({ x: lastRec.x, y: lastRec.y, age: 0 });
            d = Math.hypot(pos.x - lastRec.x, pos.y - lastRec.y);
        }
        while (trail.length > CFG.maxPts) trail.shift();
    }

    function checkClose() {
        const n = trail.length;
        if (n < CFG.gap + 2) return;
        const P = trail[n - 1], thr = ultT > 0 ? CFG.closeUlt : CFG.close;
        for (let j = 0; j < n - CFG.gap; j++) {
            if (Math.hypot(P.x - trail[j].x, P.y - trail[j].y) >= thr) continue;
            const poly = trail.slice(j, n).map(p => ({ x: p.x, y: p.y }));
            const area = polyArea(poly);
            if (area < CFG.minArea) continue;
            makeSeal(poly, area);
            trail = trail.slice(0, j);
            return;
        }
    }

    // ---- Mühür ----
    function makeSeal(poly, area) {
        const c = centroid(poly);
        const s = { poly, area, cx: c.x, cy: c.y, life: CFG.sealLife, tick: 0, victims: new Map() };
        addFloatingNumber(c.x, c.y - 10, 'MÜHÜR!', '#ffb142');
        spawnParticles(c.x, c.y, '#ffb142', 'normal');
        if (ultT > 0) { implode(s, CFG.ult.mul); return; }
        if (seals.length >= CFG.maxSeals) implode(seals.shift(), 1);
        seals.push(s);
    }
    function implode(s, mul) {
        const dmg = Math.round(Math.min(CFG.impCap, CFG.impBase + s.area * CFG.impAreaK) * mul);
        let hit = 0;
        getActiveEnemies().forEach(e => {
            if (e.hp <= 0 || !inside(e.x, e.y, s.poly)) return;
            e.hp -= dmg; hit++;
            addFloatingNumber(e.x, e.y, dmg, '#ffb142'); charge(dmg / CFG.chargeDiv);
        });
        fx.push({ poly: s.poly, cx: s.cx, cy: s.cy, life: 14, maxLife: 14 });
        spawnParticles(s.cx, s.cy, '#ffb142', 'normal');
        screenShake = Math.max(screenShake, Math.min(12, 5 + hit * 2));
    }

    // ---- Ana saldırı: Atılım ----
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== ID) return origFire.call(this, a, pull);
        dash = { ang: a, frames: CFG.dash.frames, step: CFG.dash.dist / CFG.dash.frames };
        this.jumpInvulnerable = true;
        spawnParticles(this.x, this.y, '#ffb142', 'smoke');
        this.consumeAmmo();
    };

    // ---- Yetenekler ----
    const origG1 = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== ID) return origG1.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        if (!seals.length) { addFloatingNumber(this.x, this.y - 30, 'MÜHÜR YOK!', '#e74c3c'); return; }
        seals.forEach(s => implode(s, CFG.q.mul));
        seals = [];
        addFloatingNumber(this.x, this.y - 30, 'SIKIŞTIR!', '#ffb142');
        this.setCooldown(); this.gadgetCooldown = CFG.q.cd;
    };

    const origG2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== ID) return origG2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        if (trail.length < CFG.gap) { addFloatingNumber(this.x, this.y - 30, 'İZ KISA!', '#e74c3c'); return; }
        const poly = trail.map(p => ({ x: p.x, y: p.y })), area = polyArea(poly);
        if (area < CFG.minArea) { addFloatingNumber(this.x, this.y - 30, 'ALAN KÜÇÜK!', '#e74c3c'); return; }
        makeSeal(poly, area); trail = [];
        this.gadget2Ready = false; this.gadget2Cooldown = CFG.e.cd; gadgetBtn2.classList.add('cooldown');
    };

    const origUlt = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== ID) return origUlt.call(this, a, pull);
        if (!this.ultReady || this.isDead || ultT > 0) return;
        ultT = CFG.ult.time; this.speed = this.originalSpeed * CFG.ult.speedMul;
        addFloatingNumber(this.x, this.y - 40, 'KEMENT FIRTINASI!', '#ff7675'); screenShake = Math.max(screenShake, 8);
        this.ultReady = false; this.ultCharge = 0; ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    };

    // ---- Güncelleme ----
    function update(ts) {
        charge(CFG.passive * ts);
        if (player.isDead) { trail = []; lastRec = null; dash = null; return; }

        // atılım
        if (dash) {
            const mv = dash.step * ts;
            player.x += Math.cos(dash.ang) * mv; player.y += Math.sin(dash.ang) * mv;
            const pad = WALL_THICKNESS + player.radius;
            player.x = cl(player.x, pad, canvas.width - pad); player.y = cl(player.y, pad, canvas.height - pad);
            dash.frames -= ts;
            if (dash.frames <= 0) { dash = null; if (!player.isJumping) player.jumpInvulnerable = false; }
        }

        // ult süresi
        if (ultT > 0) { ultT -= ts; if (ultT <= 0) { ultT = 0; player.speed = player.originalSpeed; addFloatingNumber(player.x, player.y - 30, 'FIRTINA BİTTİ', '#ffb142'); } }

        recordTrail(ts);
        checkClose();

        // mühürler: kilitleme, sessizleştirme, hasar, çöküş
        const enemies = getActiveEnemies(), rooted = new Map();
        seals.forEach(s => {
            enemies.forEach(e => {
                if (e.hp <= 0) return;
                if (inside(e.x, e.y, s.poly)) {
                    let anc = s.victims.get(e);
                    if (!anc) { anc = { x: e.x, y: e.y }; s.victims.set(e, anc); }
                    if (!rooted.has(e)) rooted.set(e, anc);
                } else s.victims.delete(e);
            });
        });
        rooted.forEach((anc, e) => {
            e.x = anc.x; e.y = anc.y;
            if (e.shootInterval !== undefined) e.lastShot = Date.now();
            if (e.isNest) e.lastSpawn = Date.now();
        });
        for (let i = seals.length - 1; i >= 0; i--) {
            const s = seals[i];
            s.life -= ts; s.tick += ts;
            if (s.tick >= CFG.dotEvery) {
                s.tick = 0;
                s.victims.forEach((anc, e) => {
                    if (e.hp <= 0) return;
                    e.hp -= CFG.dotDmg; addFloatingNumber(e.x, e.y, CFG.dotDmg, '#ffd32a'); charge(CFG.dotDmg / CFG.chargeDiv);
                });
            }
            if (s.life <= 0) { implode(s, 1); seals.splice(i, 1); }
        }
        for (let i = fx.length - 1; i >= 0; i--) { fx[i].life -= ts; if (fx[i].life <= 0) fx.splice(i, 1); }
    }

    // ---- Çizim ----
    function pathPoly(poly, scale, cx, cy) {
        ctx.beginPath();
        poly.forEach((p, i) => {
            const x = cx + (p.x - cx) * scale, y = cy + (p.y - cy) * scale;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.closePath();
    }
    function draw() {
        ctx.save();
        // iz
        if (trail.length > 1) {
            ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 5;
            const life = ultT > 0 ? CFG.life * 2 : CFG.life;
            for (let i = 1; i < trail.length; i++) {
                const al = cl(1 - trail[i].age / life, 0.15, 1) * 0.9;
                ctx.strokeStyle = ultT > 0 ? 'rgba(255,118,117,' + al + ')' : 'rgba(255,234,167,' + al + ')';
                ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
            }
            ctx.restore();
        }
        // mühürler
        seals.forEach(s => {
            ctx.save();
            pathPoly(s.poly, 1, s.cx, s.cy);
            ctx.fillStyle = 'rgba(255,177,66,' + (0.15 + 0.08 * Math.sin(Date.now() / 150)) + ')'; ctx.fill();
            ctx.setLineDash([12, 8]); ctx.lineDashOffset = -Date.now() / 40;
            ctx.strokeStyle = '#ffb142'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
            ctx.beginPath(); ctx.arc(s.cx, s.cy, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, s.life / CFG.sealLife));
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
            s.victims.forEach((anc, e) => {
                ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 8, 0, Math.PI * 2);
                ctx.setLineDash([5, 5]); ctx.strokeStyle = '#ffd32a'; ctx.lineWidth = 2; ctx.stroke();
            });
            ctx.restore();
        });
        // çöküş efekti
        fx.forEach(f => {
            const t = 1 - f.life / f.maxLife;
            ctx.save(); pathPoly(f.poly, 1 - t, f.cx, f.cy);
            ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * (1 - t)) + ')'; ctx.fill();
            ctx.strokeStyle = 'rgba(255,177,66,' + (1 - t) + ')'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
        });
        // atılım önizlemesi
        if (aimData.active && player.ammo >= 1 && !player.isDead) {
            const ex = player.x + Math.cos(aimData.angle) * CFG.dash.dist, ey = player.y + Math.sin(aimData.angle) * CFG.dash.dist;
            ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,177,66,0.7)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.setLineDash([]); ctx.beginPath(); ctx.arc(ex, ey, 10, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        // zorla kapat önizlemesi
        if (gadAim2.active && player.gadget2Ready && trail.length >= CFG.gap && !player.isDead) {
            const poly = trail.map(p => ({ x: p.x, y: p.y })), c = centroid(poly);
            ctx.save(); pathPoly(poly, 1, c.x, c.y);
            ctx.fillStyle = 'rgba(255,177,66,0.15)'; ctx.fill();
            ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,177,66,0.8)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        }
        // ult süresi
        if (ultT > 0) {
            ctx.save(); ctx.fillStyle = '#ff7675'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
            ctx.fillText('KEMENT FIRTINASI ' + Math.ceil(ultT / 60) + 's', canvas.width / 2, 66); ctx.restore();
        }
        ctx.restore();
    }

    // ---- Arayüz kurulumu (oyun başlayınca) ----
    function clearState() {
        if (ultT > 0 && player.charType === ID) player.speed = player.originalSpeed;
        trail = []; lastRec = null; seals = []; fx = []; dash = null; ultT = 0;
    }
    function setupUI() {
        if (player.charType !== ID) return;
        ultiBtn.style.display = 'flex'; gadgetBtn.style.display = 'flex'; gadgetBtn2.style.display = 'flex';
        gadgetBtn.innerHTML = 'SIKIŞTIR<br><span id="gadget-timer"></span>';
        gadgetBtn2.innerHTML = 'ZORLA<br>KAPAT<br><span id="gadget-timer-2"></span>';
        gadgetTimerText = document.getElementById('gadget-timer');
        gadgetTimerText2 = document.getElementById('gadget-timer-2');
        clearState();
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    // Kendi döngüm: ana döngüden sonra çalışır, başka mod dosyalarının hook'larını ezmez
    function loop(t) {
        requestAnimationFrame(loop);
        const ts = Math.min(3, (t - lastT) / 16.666); lastT = t;
        if (!gameStarted) { wasStarted = false; trail = []; lastRec = null; seals = []; fx = []; dash = null; ultT = 0; return; }
        if (!wasStarted) { wasStarted = true; setupUI(); }
        if (player.charType !== ID) { trail = []; lastRec = null; seals = []; fx = []; dash = null; ultT = 0; return; }
        update(ts); draw();
    }
    requestAnimationFrame(loop);

    // ---- Karakter kartı ----
    (function addCard() {
        const box = document.querySelector('.char-select-container');
        if (!box || document.getElementById('char-' + ID)) return;
        const card = document.createElement('div');
        card.className = 'char-card'; card.id = 'char-' + ID;
        card.innerHTML = '<div class="char-color-preview" style="background:#ffb142;"></div><span>Kement</span><small>Hasar: Mühür<br>Güç: Fırtına</small>';
        card.addEventListener('click', () => {
            selectedCharacter = ID;
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
        box.appendChild(card);
    })();
})();
