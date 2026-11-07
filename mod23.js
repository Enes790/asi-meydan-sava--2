// ============================================================================
// mod32.js - "Sarsıcı" karakteri (fizik / çarpışma ustası)
// Ana dosyaya dokunmaz. index.html'de TÜM mod script'lerinden SONRA eklenmeli:
//   <script src="mod32.js"></script>
//
// Sarsıcı HİÇBİR ŞEY fırlatmaz: mermi yok, ışın yok, koni yok, loblu atış yok,
// çağırma yok, temas hasarı yok. Düşmanları FIRLATIR; hasarı düşmanın duvara,
// siperlere ve diğer düşmanlara ÇARPMA HIZI verir (hız x 45). Çarpan düşman
// ayrıca yaklaşık 1 saniye sersemler (ateş edemez).
//  - Ana saldırı (Kuvvet Dalgası): Etrafındaki düşmanları senden uzağa fırlatır.
//    Sağ joystick'i hangi yöne çekersen fırlatma o yöne doğru kayar, yani
//    düşmanları istediğin duvara yönlendirirsin.
//  - Yetenek 1 (ÇEKİM): Etraftaki düşmanları sana doğru çeker; birbirlerine
//    çarpıp hasar alırlar, hemen ardından dalga ile fırlatılırlar.
//  - Yetenek 2 (SEKME DUVARI): 6 saniye boyunca duvarlar ve siperler zıplatır;
//    fırlatılan düşman sürekli sekip her çarpışmada tekrar hasar alır.
//  - Güç (ÇÖKÜŞ): Haritadaki TÜM düşmanları dışa doğru çok hızlı fırlatır,
//    6 saniye sekme duvarı + %20 fazla çarpma hasarı verir.
//  - Bar: çarpışma hasarıyla ve zamanla dolar.
// ============================================================================
(function () {
    'use strict';
    const ID = 'sarsici';
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));

    window.GAME_EXT = window.GAME_EXT || { characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {} };
    window.GAME_EXT.characters[ID] = { color: '#fd79a8', hp: 4000, speed: 3.3 };

    // ---- Denge ayarları (buradan oynayabilirsin) ----
    const CFG = {
        pulse: { radius: 250, speed: 22, aimBias: 0.7 },
        pull: { radius: 330, speed: 15, cd: 540 },
        bounce: { time: 360, cd: 780, rest: 0.92, friction: 0.93 },
        rest: 0.35, friction: 0.9,           // normal duvar sekmesi / sürtünme
        k: 45, impactMin: 4, dmgCap: 1800, maxSpeed: 45, obsFrac: 0.25,
        ee: { k: 40, rest: 0.5 },            // düşman-düşman çarpışması
        stunMs: 1000, hitCd: 6,
        ult: { speed: 32, time: 360, mul: 1.2 },
        passive: 0.02, chargeDiv: 12
    };

    let movers = new Set(), rings = [], bounceT = 0, boostT = 0, lastT = 0, wasStarted = false;
    const blockers = () => obstacles.concat(cactusWalls || []);

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
            addFloatingNumber(player.x, player.y - 40, 'ÇÖKÜŞ HAZIR!', '#fd79a8');
        }
    }

    // ---- Fırlatma / çarpma ----
    function launch(e, dx, dy, speed) {
        if (e.isNest) return;
        const l = Math.hypot(dx, dy) || 1;
        e.cvx = (e.cvx || 0) + dx / l * speed; e.cvy = (e.cvy || 0) + dy / l * speed;
        const sp = Math.hypot(e.cvx, e.cvy);
        if (sp > CFG.maxSpeed) { e.cvx *= CFG.maxSpeed / sp; e.cvy *= CFG.maxSpeed / sp; }
        movers.add(e);
    }
    function impact(e, vn, ix, iy, k) {
        if (vn < CFG.impactMin || (e.cHit || 0) > 0) return 0;
        const dmg = Math.round(Math.min(CFG.dmgCap, vn * (k || CFG.k) * (boostT > 0 ? CFG.ult.mul : 1)));
        e.hp -= dmg; addFloatingNumber(e.x, e.y, dmg, '#fd79a8'); charge(dmg / CFG.chargeDiv);
        e.cHit = CFG.hitCd;
        if (e.shootInterval !== undefined) e.lastShot = Math.max(e.lastShot || 0, Date.now() - e.shootInterval + CFG.stunMs);
        spawnParticles(ix, iy, '#fd79a8', 'normal');
        rings.push({ x: ix, y: iy, r: 6, max: 20 + vn * 1.2, life: 10, maxLife: 10, col: '255,234,167', inward: false });
        screenShake = Math.max(screenShake, Math.min(10, vn / 3));
        return dmg;
    }

    function physics(ts, enemies) {
        const bounce = bounceT > 0, rest = bounce ? CFG.bounce.rest : CFG.rest;
        const fr = Math.pow(bounce ? CFG.bounce.friction : CFG.friction, ts);
        const alive = new Set(enemies);
        movers.forEach(m => { if (!alive.has(m)) { m.cvx = m.cvy = 0; movers.delete(m); } });
        enemies.forEach(e => { if (e.cHit > 0) e.cHit -= ts; });

        movers.forEach(e => {
            e.x += e.cvx * ts; e.y += e.cvy * ts;
            const minX = WALL_THICKNESS + e.radius, maxX = canvas.width - minX, minY = minX, maxY = canvas.height - minX;
            if (e.x < minX) { e.x = minX; if (e.cvx < 0) { impact(e, -e.cvx, e.x - e.radius, e.y); e.cvx = -e.cvx * rest; } }
            else if (e.x > maxX) { e.x = maxX; if (e.cvx > 0) { impact(e, e.cvx, e.x + e.radius, e.y); e.cvx = -e.cvx * rest; } }
            if (e.y < minY) { e.y = minY; if (e.cvy < 0) { impact(e, -e.cvy, e.x, e.y - e.radius); e.cvy = -e.cvy * rest; } }
            else if (e.y > maxY) { e.y = maxY; if (e.cvy > 0) { impact(e, e.cvy, e.x, e.y + e.radius); e.cvy = -e.cvy * rest; } }
            for (const o of blockers()) {
                const d = getDist(e, o) || 0.001, min = e.radius + o.radius;
                if (d >= min) continue;
                const nx = (e.x - o.x) / d, ny = (e.y - o.y) / d;
                e.x = o.x + nx * min; e.y = o.y + ny * min;
                const vn = e.cvx * nx + e.cvy * ny;
                if (vn < 0) {
                    const dmg = impact(e, -vn, o.x + nx * o.radius, o.y + ny * o.radius);
                    if (dmg) o.hp -= Math.round(dmg * CFG.obsFrac);
                    e.cvx -= (1 + rest) * vn * nx; e.cvy -= (1 + rest) * vn * ny;
                }
            }
            e.cvx *= fr; e.cvy *= fr;
            if (Math.hypot(e.cvx, e.cvy) < 0.6) { e.cvx = e.cvy = 0; movers.delete(e); }
        });

        // düşman - düşman çarpışması
        for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
            const a = enemies[i], b = enemies[j];
            if (!(a.cvx || a.cvy || b.cvx || b.cvy)) continue;
            const d = getDist(a, b) || 0.001, min = a.radius + b.radius;
            if (d >= min) continue;
            const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d, ov = min - d;
            if (a.isNest) { b.x += nx * ov; b.y += ny * ov; }
            else if (b.isNest) { a.x -= nx * ov; a.y -= ny * ov; }
            else { a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2; }
            const rv = ((a.cvx || 0) - (b.cvx || 0)) * nx + ((a.cvy || 0) - (b.cvy || 0)) * ny;
            if (rv <= 0) continue;
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            impact(a, rv, mx, my, CFG.ee.k); impact(b, rv, mx, my, CFG.ee.k);
            let Ja = 0, Jb = 0; const f = 1 + CFG.ee.rest;
            if (a.isNest) Jb = rv * f; else if (b.isNest) Ja = rv * f; else Ja = Jb = rv * f / 2;
            if (!a.isNest) { a.cvx = (a.cvx || 0) - nx * Ja; a.cvy = (a.cvy || 0) - ny * Ja; movers.add(a); }
            if (!b.isNest) { b.cvx = (b.cvx || 0) + nx * Jb; b.cvy = (b.cvy || 0) + ny * Jb; movers.add(b); }
        }
    }

    // ---- Ana saldırı: Kuvvet Dalgası ----
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== ID) return origFire.call(this, a, pull);
        const P = CFG.pulse;
        getActiveEnemies().forEach(e => {
            if (e.hp <= 0 || e.isNest) return;
            const d = getDist(this, e);
            if (d > P.radius + e.radius) return;
            const rx = (e.x - this.x) / (d || 1), ry = (e.y - this.y) / (d || 1);
            launch(e, rx + Math.cos(a) * P.aimBias, ry + Math.sin(a) * P.aimBias, P.speed * (1.2 - 0.4 * Math.min(1, d / P.radius)));
        });
        rings.push({ x: this.x, y: this.y, r: 20, max: P.radius, life: 14, maxLife: 14, col: '253,121,168', inward: false });
        screenShake = Math.max(screenShake, 4);
        this.consumeAmmo();
    };

    // ---- Yetenekler ----
    const origG1 = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== ID) return origG1.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        const C = CFG.pull;
        getActiveEnemies().forEach(e => {
            if (e.hp <= 0 || e.isNest || slimeBots.includes(e)) return;   // sümük botları çekmiyoruz (sana çarpıp patlarlardı)
            const d = getDist(this, e);
            if (d > C.radius + e.radius || d < 40) return;
            launch(e, this.x - e.x, this.y - e.y, C.speed);
        });
        rings.push({ x: this.x, y: this.y, r: 30, max: C.radius, life: 16, maxLife: 16, col: '162,155,254', inward: true });
        addFloatingNumber(this.x, this.y - 30, 'ÇEKİM!', '#a29bfe');
        this.setCooldown(); this.gadgetCooldown = C.cd;
    };

    const origG2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== ID) return origG2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        bounceT = CFG.bounce.time;
        addFloatingNumber(this.x, this.y - 30, 'SEKME DUVARI!', '#ffeaa7');
        this.gadget2Ready = false; this.gadget2Cooldown = CFG.bounce.cd; gadgetBtn2.classList.add('cooldown');
    };

    const origUlt = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== ID) return origUlt.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;
        getActiveEnemies().forEach(e => {
            if (e.hp <= 0 || e.isNest) return;
            let dx = e.x - this.x, dy = e.y - this.y;
            if (Math.hypot(dx, dy) < 1) { const r = Math.random() * Math.PI * 2; dx = Math.cos(r); dy = Math.sin(r); }
            launch(e, dx, dy, CFG.ult.speed);
        });
        bounceT = Math.max(bounceT, CFG.ult.time); boostT = CFG.ult.time;
        rings.push({ x: this.x, y: this.y, r: 20, max: 420, life: 24, maxLife: 24, col: '253,121,168', inward: false });
        screenShake = 16; addFloatingNumber(this.x, this.y - 40, 'ÇÖKÜŞ!', '#fd79a8');
        this.ultReady = false; this.ultCharge = 0; ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    };

    // ---- Güncelleme ----
    function update(ts) {
        charge(CFG.passive * ts);
        if (bounceT > 0) bounceT -= ts;
        if (boostT > 0) boostT -= ts;
        physics(ts, getActiveEnemies());
        for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= ts; if (rings[i].life <= 0) rings.splice(i, 1); }
    }

    // ---- Çizim ----
    function draw() {
        ctx.save();
        // sekme duvarı çerçevesi
        if (bounceT > 0) {
            const a = Math.min(1, bounceT / 40) * (0.55 + 0.25 * Math.sin(Date.now() / 120));
            ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#ffeaa7'; ctx.lineWidth = 6;
            ctx.shadowColor = '#fd79a8'; ctx.shadowBlur = 18;
            ctx.strokeRect(WALL_THICKNESS, WALL_THICKNESS, canvas.width - WALL_THICKNESS * 2, canvas.height - WALL_THICKNESS * 2);
            blockers().forEach(o => { ctx.beginPath(); ctx.arc(o.x, o.y, o.radius + 3, 0, Math.PI * 2); ctx.stroke(); });
            ctx.restore();
        }
        // fırlatılan düşmanların hız izi
        movers.forEach(e => {
            const sp = Math.hypot(e.cvx, e.cvy) || 1;
            ctx.save(); ctx.globalAlpha = Math.min(0.5, sp / 40);
            ctx.strokeStyle = '#fd79a8'; ctx.lineWidth = e.radius * 1.3; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(e.x - e.cvx / sp * e.radius * 0.6, e.y - e.cvy / sp * e.radius * 0.6);
            ctx.lineTo(e.x - e.cvx * 2.4, e.y - e.cvy * 2.4); ctx.stroke(); ctx.restore();
        });
        // halkalar
        rings.forEach(r => {
            const t = 1 - r.life / r.maxLife, rad = r.inward ? r.max - (r.max - r.r) * t : r.r + (r.max - r.r) * t;
            ctx.save(); ctx.strokeStyle = 'rgba(' + r.col + ',' + (1 - t) + ')'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(1, rad), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        });
        // nişan önizlemeleri
        if (aimData.active && player.ammo >= 1 && !player.isDead) {
            ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(253,121,168,0.55)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(player.x, player.y, CFG.pulse.radius, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]); ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(player.x, player.y);
            ctx.lineTo(player.x + Math.cos(aimData.angle) * 90, player.y + Math.sin(aimData.angle) * 90); ctx.stroke(); ctx.restore();
        }
        if (gadAim.active && player.gadgetReady && !player.isDead) {
            ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(162,155,254,0.6)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(player.x, player.y, CFG.pull.radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        if (ultAim.active && player.ultReady && !player.isDead) {
            ctx.save(); ctx.setLineDash([12, 10]); ctx.strokeStyle = 'rgba(253,121,168,0.6)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(player.x, player.y, 300, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        ctx.restore();
    }

    // ---- Arayüz kurulumu (oyun başlayınca) ----
    function clearState() {
        movers.forEach(e => { e.cvx = e.cvy = 0; e.cHit = 0; });
        movers.clear(); rings = []; bounceT = 0; boostT = 0;
    }
    function setupUI() {
        if (player.charType !== ID) return;
        ultiBtn.style.display = 'flex'; gadgetBtn.style.display = 'flex'; gadgetBtn2.style.display = 'flex';
        gadgetBtn.innerHTML = 'ÇEKİM<br><span id="gadget-timer"></span>';
        gadgetBtn2.innerHTML = 'SEKME<br>DUVARI<br><span id="gadget-timer-2"></span>';
        gadgetTimerText = document.getElementById('gadget-timer');
        gadgetTimerText2 = document.getElementById('gadget-timer-2');
        clearState();
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    // Kendi döngüm: ana döngüden sonra çalışır, başka mod dosyalarının hook'larını ezmez
    function loop(t) {
        requestAnimationFrame(loop);
        const ts = Math.min(3, (t - lastT) / 16.666); lastT = t;
        if (!gameStarted) { wasStarted = false; if (movers.size || rings.length) clearState(); return; }
        if (!wasStarted) { wasStarted = true; setupUI(); }
        if (player.charType !== ID) { if (movers.size || rings.length) clearState(); return; }
        update(ts); draw();
    }
    requestAnimationFrame(loop);

    // ---- Karakter kartı ----
    (function addCard() {
        const box = document.querySelector('.char-select-container');
        if (!box || document.getElementById('char-' + ID)) return;
        const card = document.createElement('div');
        card.className = 'char-card'; card.id = 'char-' + ID;
        card.innerHTML = '<div class="char-color-preview" style="background:#fd79a8;"></div><span>Sarsıcı</span><small>Hasar: Çarpışma<br>Güç: Çöküş</small>';
        card.addEventListener('click', () => {
            selectedCharacter = ID;
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
        box.appendChild(card);
    })();
})();
