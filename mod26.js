// ============================================================================
// mod35.js - "Volt" karakteri (bobin çağırıcı)
// Ana dosyaya dokunmaz. index.html'de TÜM mod script'lerinden SONRA eklenmeli:
//   <script src="mod35.js"></script>
//
// Volt'un çağırdıkları Çağrı'nın çıraklarından tamamen farklı hisseder: koşup
// vurmazlar, YERİNDE DURUP elektrik alanı yayarlar.
//  - Ana saldırı (Bobin): Sağ joystick'i çek-bırak, çektiğin mesafeye bir
//    TESLA BOBİNİ düşer (1 cephane). Aynı anda en fazla 3 bobin; 4.'yü koyarsan
//    en eskisi gider. Bobin 1.6 sn'de bir çevresine elektrik darbesi yayar:
//    içindeki düşmanlara hasar verir ve ~0.7 sn ateş edemez hâle getirir.
//    Bobinler düşman mermilerini yutar (siper görevi görür) ve hasar görebilir.
//  - Özgün mekanik - REZONANS: Bir düşman birden fazla bobinin (veya Dev'in)
//    alanındaysa darbe hasarı her ekstra kaynak için %40 artar. Bir botun
//    etrafına üçgen şeklinde bobin koy, hasar patlasın.
//  - Yetenek 1 (DEŞARJ): Tüm bobinler ve Dev anında darbe yayar, sayaçları
//    sıfırlanır. Zamanlamayı sen belirlersin.
//  - Yetenek 2 (BOBİN TAŞI): En eski bobini joystick yönüne/mesafesine ışınlar.
//  - Güç (ELEKTRO DEV): Ağır, yavaş bir dev (5000 can, 14 sn). Yürürken
//    çevresine güçlü darbe yayar, ona isabet eden mermilerin atanı şok olur
//    (hasar + sersemleme). Yakınındaki bobinler 2 kat hızlı darbe yayar. Ölünce
//    patlar. Aynı anda 1 Dev.
//  - Bar: darbe hasarıyla ve zamanla dolar.
// ============================================================================
(function () {
    'use strict';
    const ID = 'volt';
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const clamp01 = v => Math.max(0, Math.min(1, v));

    window.GAME_EXT = window.GAME_EXT || { characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {} };
    window.GAME_EXT.characters[ID] = { color: '#fff200', hp: 3800, speed: 3.3 };

    // ---- Denge ayarları (buradan oynayabilirsin) ----
    const CFG = {
        coil: { radius: 16, hp: 700, life: 840, period: 100, pulseR: 125, dmg: 220, stunMs: 700, overlap: 0.4, max: 3, drop: 10 },
        giant: { radius: 40, hp: 5000, speed: 1.3, life: 840, pulseR: 150, pulseDmg: 200, pulseEvery: 60, stopDist: 110,
                 reflect: 0.5, reflectStunMs: 1000, endR: 170, endDmg: 700 },
        boost: { near: 200, mul: 2 },
        q: { cd: 480 }, e: { cd: 420 },
        passive: 0.02, chargeDiv: 30
    };

    let coils = [], giant = null, rings = [], lastT = 0, wasStarted = false;
    const blockers = () => obstacles.concat(cactusWalls || []);

    // ---- Güç şarjı: ana oyunun şarjı bu karakter için kapalı, kendi barımız var ----
    const prevCharge = window.chargeUlti;
    window.chargeUlti = function () {
        if (player.charType === ID) return;
        return prevCharge.apply(this, arguments);
    };
    function charge(n) {
        if (!gameStarted || player.charType !== ID || player.ultReady || giant) return;
        player.ultCharge = Math.min(100, player.ultCharge + n);
        ultFill.style.width = player.ultCharge + '%';
        if (player.ultCharge >= 100) {
            player.ultReady = true; ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, 'ELEKTRO DEV HAZIR!', '#fff200');
        }
    }

    function freeSpot(x, y, r) {
        const pad = WALL_THICKNESS + r + 4;
        x = cl(x, pad, canvas.width - pad); y = cl(y, pad, canvas.height - pad);
        for (let it = 0; it < 6; it++) {
            let moved = false;
            for (const o of blockers()) {
                const d = getDist({ x, y }, o) || 0.001, min = o.radius + r + 2;
                if (d < min) { x += (x - o.x) / d * (min - d); y += (y - o.y) / d * (min - d); moved = true; }
            }
            x = cl(x, pad, canvas.width - pad); y = cl(y, pad, canvas.height - pad);
            if (!moved) break;
        }
        return { x, y };
    }
    function summonPull() {
        let pull = Math.hypot(aimData.x, aimData.y);
        if (!(aimData.active && pull >= 0.1)) pull = Math.hypot(lastMouseX - player.x, lastMouseY - player.y) / (RANGE * 0.8);
        return cl(pull, 0.1, 1);
    }
    function spawnPoint(a, pull, r) {
        const dist = Math.max(60, pull * RANGE * 0.8);
        return freeSpot(player.x + Math.cos(a) * dist, player.y + Math.sin(a) * dist, r);
    }
    const bulletDmg = b => {
        const easy = window.GAME_DIFFICULTY === 'easy';
        if (b.type === 'stationary_bot_bullet') return easy ? 300 : 350;
        if (b.type === 'boomerang') return easy ? 200 : 250;
        return easy ? 480 : 500;
    };
    function nearestEnemy(from, enemies) {
        let best = null, bd = 1e9;
        for (const e of enemies) { if (e.hp <= 0) continue; const d = getDist(from, e); if (d < bd) { bd = d; best = e; } }
        return best;
    }
    function moveAlly(m, tx, ty, speed, ts) {
        const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1;
        let dirx = dx / d, diry = dy / d;
        for (const o of blockers()) {
            const od = getDist(m, o) || 0.001, reach = o.radius + m.radius + 38;
            if (od < reach) {
                const nx = (m.x - o.x) / od, ny = (m.y - o.y) / od;
                let tx2 = -ny, ty2 = nx;
                if (tx2 * dirx + ty2 * diry < 0) { tx2 = -tx2; ty2 = -ty2; }
                const w = (reach - od) / 38 * 1.6;
                dirx += (nx * 0.5 + tx2) * w; diry += (ny * 0.5 + ty2) * w;
            }
        }
        const l = Math.hypot(dirx, diry) || 1;
        m.x += dirx / l * speed * ts; m.y += diry / l * speed * ts;
    }
    function resolveAlly(m) {
        for (const o of blockers()) {
            const d = getDist(m, o) || 0.001, min = m.radius + o.radius;
            if (d < min) { m.x += (m.x - o.x) / d * (min - d); m.y += (m.y - o.y) / d * (min - d); }
        }
        const pad = WALL_THICKNESS + m.radius;
        m.x = cl(m.x, pad, canvas.width - pad); m.y = cl(m.y, pad, canvas.height - pad);
    }

    // ---- Darbe (REZONANS: çakışan alanlar hasarı artırır) ----
    function coverCount(e) {
        let n = 0;
        coils.forEach(c => { if (c.drop <= 0 && getDist(c, e) < CFG.coil.pulseR + e.radius) n++; });
        if (giant && getDist(giant, e) < CFG.giant.pulseR + e.radius) n++;
        return Math.max(1, n);
    }
    function pulse(src, R, dmg, stunMs) {
        const now = Date.now(); let hit = 0;
        getActiveEnemies().forEach(e => {
            if (e.hp <= 0 || getDist(src, e) >= R + e.radius) return;
            const cover = coverCount(e), d = Math.round(dmg * (1 + CFG.coil.overlap * (cover - 1)));
            e.hp -= d; hit++;
            addFloatingNumber(e.x, e.y, d, cover > 1 ? '#fff200' : '#f5d742'); charge(d / CFG.chargeDiv);
            if (e.shootInterval !== undefined) e.lastShot = Math.max(e.lastShot || 0, now - e.shootInterval + stunMs);
            for (let i = 0; i < 3; i++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, life: 15, maxLife: 30, color: '#fff200', size: 3, type: 'normal' });
        });
        if (hit && rings.length < 12) rings.push({ x: src.x, y: src.y, r: 10, max: R, life: 12, maxLife: 12 });
        return hit;
    }

    // ---- Ana saldırı: Bobin koy ----
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== ID) return origFire.call(this, a, pull);
        const p = spawnPoint(a, pull !== undefined ? clamp01(pull) : summonPull(), CFG.coil.radius);
        if (coils.length >= CFG.coil.max) { const old = coils.shift(); spawnParticles(old.x, old.y, '#fff200', 'smoke'); }
        coils.push({ x: p.x, y: p.y, radius: CFG.coil.radius, hp: CFG.coil.hp, maxHp: CFG.coil.hp, life: CFG.coil.life, pt: 40, drop: CFG.coil.drop });
        spawnParticles(p.x, p.y, '#fff200', 'normal');
        this.consumeAmmo();
    };

    // ---- Yetenekler ----
    const origG1 = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== ID) return origG1.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        if (!coils.length && !giant) { addFloatingNumber(this.x, this.y - 30, 'BOBİN YOK!', '#e74c3c'); return; }
        coils.forEach(c => { if (c.drop <= 0) { c.pt = 0; pulse(c, CFG.coil.pulseR, CFG.coil.dmg, CFG.coil.stunMs); } });
        if (giant) { giant.pt = 0; pulse(giant, CFG.giant.pulseR, CFG.giant.pulseDmg, CFG.coil.stunMs); }
        addFloatingNumber(this.x, this.y - 30, 'DEŞARJ!', '#fff200'); screenShake = Math.max(screenShake, 5);
        this.setCooldown(); this.gadgetCooldown = CFG.q.cd;
    };

    const origG2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== ID) return origG2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        if (!coils.length) { addFloatingNumber(this.x, this.y - 30, 'BOBİN YOK!', '#e74c3c'); return; }
        const c = coils[0], ang = a !== undefined ? a : this.angle;
        const p = spawnPoint(ang, pull !== undefined ? clamp01(pull) : 1, CFG.coil.radius);
        spawnParticles(c.x, c.y, '#fff200', 'smoke');
        c.x = p.x; c.y = p.y; c.drop = 8;
        spawnParticles(p.x, p.y, '#fff200', 'normal');
        addFloatingNumber(p.x, p.y - 25, 'TAŞINDI!', '#fff200');
        coils.push(coils.shift());   // taşınan bobin artık "en yeni" olur
        this.gadget2Ready = false; this.gadget2Cooldown = CFG.e.cd; gadgetBtn2.classList.add('cooldown');
    };

    const origUlt = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== ID) return origUlt.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;
        if (giant) { addFloatingNumber(this.x, this.y - 40, 'DEV ZATEN VAR!', '#e74c3c'); return; }
        const G = CFG.giant, p = freeSpot(this.x + Math.cos(a) * 110, this.y + Math.sin(a) * 110, G.radius);
        giant = { x: p.x, y: p.y, radius: G.radius, hp: G.hp, maxHp: G.hp, life: G.life, age: 0, pt: 30, face: a, isGiant: true };
        spawnParticles(p.x, p.y, '#fff200', 'smoke'); screenShake = Math.max(screenShake, 10);
        addFloatingNumber(this.x, this.y - 40, 'ELEKTRO DEV!', '#fff200');
        this.ultReady = false; this.ultCharge = 0; ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    };

    // ---- Güncelleme ----
    function update(ts) {
        charge(CFG.passive * ts);
        const enemies = getActiveEnemies();

        coils.forEach(c => {
            c.life -= ts;
            if (c.drop > 0) { c.drop -= ts; return; }
            const boosted = giant && getDist(giant, c) < CFG.boost.near;
            c.pt += ts * (boosted ? CFG.boost.mul : 1);
            if (c.pt >= CFG.coil.period) { c.pt = 0; pulse(c, CFG.coil.pulseR, CFG.coil.dmg, CFG.coil.stunMs); }
        });

        if (giant) {
            const G = CFG.giant;
            giant.age += ts; giant.life -= ts; giant.pt += ts;
            const t = nearestEnemy(giant, enemies);
            if (t) {
                giant.face = getAngle(giant, t);
                if (getDist(giant, t) > G.stopDist) moveAlly(giant, t.x, t.y, G.speed, ts);
            } else if (getDist(giant, player) > 130) moveAlly(giant, player.x, player.y, G.speed, ts);
            if (giant.pt >= G.pulseEvery) { giant.pt = 0; pulse(giant, G.pulseR, G.pulseDmg, CFG.coil.stunMs); }
            resolveAlly(giant);
        }

        // düşman mermileri bobinlere / Dev'e isabet eder
        const allies = coils.filter(c => c.drop <= 0);
        if (giant) allies.push(giant);
        for (let bi = botBullets.length - 1; bi >= 0; bi--) {
            const b = botBullets[bi];
            for (const a of allies) {
                if (getDist(b, a) >= a.radius + 10) continue;
                if (b.type === 'boomerang') {
                    b.hitTargets = b.hitTargets || [];
                    if (b.hitTargets.includes(a)) continue;
                    b.hitTargets.push(a);
                }
                const dmg = bulletDmg(b);
                a.hp -= dmg; addFloatingNumber(a.x, a.y, dmg, '#e74c3c');
                if (a === giant && b.owner && b.owner.hp > 0 && !b.owner.isDead) {   // Dev: atanı şoklar
                    const o = b.owner, sd = Math.round(dmg * CFG.giant.reflect);
                    o.hp -= sd; addFloatingNumber(o.x, o.y, sd, '#fff200');
                    if (o.shootInterval !== undefined) o.lastShot = Math.max(o.lastShot || 0, Date.now() - o.shootInterval + CFG.giant.reflectStunMs);
                    if (rings.length < 12) rings.push({ x: o.x, y: o.y, r: 8, max: 40, life: 10, maxLife: 10 });
                }
                if (b.type !== 'boomerang') { botBullets.splice(bi, 1); break; }
            }
        }

        // ömür / ölüm
        for (let i = coils.length - 1; i >= 0; i--) {
            const c = coils[i];
            if (c.life <= 0 || c.hp <= 0) { spawnParticles(c.x, c.y, '#fff200', 'smoke'); coils.splice(i, 1); }
        }
        if (giant && (giant.life <= 0 || giant.hp <= 0)) {
            const G = CFG.giant;
            enemies.forEach(e => {
                if (e.hp <= 0 || getDist(giant, e) >= G.endR + e.radius) return;
                e.hp -= G.endDmg; addFloatingNumber(e.x, e.y, G.endDmg, '#fff200');
                if (e.shootInterval !== undefined) e.lastShot = Math.max(e.lastShot || 0, Date.now() - e.shootInterval + 1000);
            });
            explosions.push({ x: giant.x, y: giant.y, radius: 0, maxRadius: G.endR, life: 14, maxLife: 14 });
            spawnParticles(giant.x, giant.y, '#fff200', 'smoke'); screenShake = Math.max(screenShake, 10);
            giant = null;
        }
        for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= ts; if (rings[i].life <= 0) rings.splice(i, 1); }
    }

    // ---- Çizim ----
    function bar(x, y, w, f, col) {
        ctx.fillStyle = '#444'; ctx.fillRect(x - w / 2, y, w, 4);
        ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, Math.max(0, f) * w, 4);
    }
    function drawCoil(c) {
        // alan göstergesi
        if (c.drop <= 0) {
            ctx.save(); ctx.globalAlpha = 0.1; ctx.beginPath(); ctx.arc(c.x, c.y, CFG.coil.pulseR, 0, Math.PI * 2);
            ctx.fillStyle = '#fff200'; ctx.fill(); ctx.globalAlpha = 0.3; ctx.setLineDash([8, 10]);
            ctx.strokeStyle = '#fff200'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        }
        const dropK = Math.max(0, c.drop) / CFG.coil.drop;
        ctx.save(); ctx.translate(c.x, c.y - dropK * 40);
        if (c.life < 120 && Math.floor(Date.now() / 100) % 2) ctx.globalAlpha = 0.45;
        const s = 1 + dropK * 0.8; ctx.scale(s, s);
        ctx.beginPath(); ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#2f3640'; ctx.fill(); ctx.strokeStyle = '#fff200'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -3, 5, 0, Math.PI * 2); ctx.fillStyle = '#fff200'; ctx.fill();
        if (c.drop <= 0) {
            ctx.beginPath(); ctx.arc(0, 0, c.radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(c.pt / CFG.coil.period));
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
        }
        ctx.restore();
        bar(c.x, c.y - c.radius - 12, 28, c.hp / c.maxHp, '#fff200');
    }
    function drawGiant(g) {
        const G = CFG.giant;
        ctx.save(); ctx.globalAlpha = 0.08; ctx.beginPath(); ctx.arc(g.x, g.y, G.pulseR, 0, Math.PI * 2);
        ctx.fillStyle = '#fff200'; ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(g.x, g.y);
        if (g.life < 120 && Math.floor(Date.now() / 100) % 2) ctx.globalAlpha = 0.5;
        ctx.beginPath();
        for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3 + Math.PI / 6; j ? ctx.lineTo(Math.cos(a) * g.radius, Math.sin(a) * g.radius) : ctx.moveTo(Math.cos(a) * g.radius, Math.sin(a) * g.radius); }
        ctx.closePath(); ctx.fillStyle = '#2f3640'; ctx.fill(); ctx.strokeStyle = '#fff200'; ctx.lineWidth = 4; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4, -22); ctx.lineTo(-10, 4); ctx.lineTo(-1, 4); ctx.lineTo(-5, 22); ctx.lineTo(10, -4); ctx.lineTo(1, -4); ctx.closePath();
        ctx.fillStyle = '#fff200'; ctx.fill();
        ctx.restore();
        bar(g.x, g.y - g.radius - 14, 70, g.hp / g.maxHp, '#fff200');
        bar(g.x, g.y - g.radius - 8, 70, g.life / G.life, '#74b9ff');
    }
    function draw() {
        ctx.save();
        coils.forEach(drawCoil);
        if (giant) drawGiant(giant);

        // elektrik halkaları (kırık çizgili)
        rings.forEach(r => {
            const k = 1 - r.life / r.maxLife, rad = r.r + (r.max - r.r) * k;
            ctx.save(); ctx.strokeStyle = 'rgba(255,242,0,' + (1 - k) + ')'; ctx.lineWidth = 3; ctx.beginPath();
            for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.22) {
                const rr = rad + (Math.random() - 0.5) * 8;
                a ? ctx.lineTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr) : ctx.moveTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr);
            }
            ctx.stroke(); ctx.restore();
        });

        // bobin koyma önizlemesi
        if (aimData.active && player.ammo >= 1 && !player.isDead) {
            const p = spawnPoint(aimData.angle, summonPull(), CFG.coil.radius);
            ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,242,0,0.6)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(p.x, p.y); ctx.stroke();
            ctx.beginPath(); ctx.arc(p.x, p.y, CFG.coil.pulseR, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]); ctx.beginPath(); ctx.arc(p.x, p.y, CFG.coil.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,242,0,0.3)'; ctx.fill(); ctx.stroke(); ctx.restore();
        }
        // bobin taşıma önizlemesi
        if (gadAim2.active && player.gadget2Ready && coils.length && !player.isDead) {
            const p = spawnPoint(gadAim2.angle, (gadAim2.pull === undefined || gadAim2.pull < 0.05) ? 1 : clamp01(gadAim2.pull), CFG.coil.radius);
            ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,242,0,0.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(coils[0].x, coils[0].y, coils[0].radius + 8, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(coils[0].x, coils[0].y); ctx.lineTo(p.x, p.y); ctx.stroke();
            ctx.beginPath(); ctx.arc(p.x, p.y, CFG.coil.pulseR, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        // Dev önizlemesi
        if (ultAim.active && player.ultReady && !player.isDead) {
            const p = freeSpot(player.x + Math.cos(ultAim.angle) * 110, player.y + Math.sin(ultAim.angle) * 110, CFG.giant.radius);
            ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, CFG.giant.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,242,0,0.25)'; ctx.fill();
            ctx.strokeStyle = 'rgba(255,242,0,0.7)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
        }
        ctx.restore();
    }

    // ---- Arayüz kurulumu (oyun başlayınca) ----
    function setupUI() {
        if (player.charType !== ID) return;
        ultiBtn.style.display = 'flex'; gadgetBtn.style.display = 'flex'; gadgetBtn2.style.display = 'flex';
        gadgetBtn.innerHTML = 'DEŞARJ<br><span id="gadget-timer"></span>';
        gadgetBtn2.innerHTML = 'BOBİN<br>TAŞI<br><span id="gadget-timer-2"></span>';
        gadgetTimerText = document.getElementById('gadget-timer');
        gadgetTimerText2 = document.getElementById('gadget-timer-2');
        coils = []; giant = null; rings = [];
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    // Kendi döngüm: ana döngüden sonra çalışır, başka mod dosyalarının hook'larını ezmez
    function loop(t) {
        requestAnimationFrame(loop);
        const ts = Math.min(3, (t - lastT) / 16.666); lastT = t;
        if (!gameStarted) { wasStarted = false; coils = []; giant = null; rings = []; return; }
        if (!wasStarted) { wasStarted = true; setupUI(); }
        if (player.charType !== ID) { coils = []; giant = null; rings = []; return; }
        update(ts); draw();
    }
    requestAnimationFrame(loop);

    // ---- Karakter kartı ----
    (function addCard() {
        const box = document.querySelector('.char-select-container');
        if (!box || document.getElementById('char-' + ID)) return;
        const card = document.createElement('div');
        card.className = 'char-card'; card.id = 'char-' + ID;
        card.innerHTML = '<div class="char-color-preview" style="background:#fff200;"></div><span>Volt</span><small>Hasar: Bobinler<br>Güç: Elektro Dev</small>';
        card.addEventListener('click', () => {
            selectedCharacter = ID;
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
        box.appendChild(card);
    })();
})();
