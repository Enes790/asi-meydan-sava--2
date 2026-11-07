// ============================================================================
// mod35.js - "Volt" karakteri (bobin çağırıcı)  [v2: Aşırı Yük + sabit Dev]
// Ana dosyaya dokunmaz. index.html'de TÜM mod script'lerinden SONRA eklenmeli:
//   <script src="mod35.js"></script>
//
// Volt'un çağırdıkları koşup vurmaz, YERİNDE DURUP elektrik alanı yayar. Yer
// seçimi ve taktik her şeydir.
//  - Ana saldırı (Bobin): Sağ joystick'i çek-bırak, çektiğin mesafeye bir TESLA
//    BOBİNİ düşer (1 cephane). En fazla 3 bobin; 4.'yü koyarsan en eskisi gider.
//    Bobin 1.6 sn'de bir çevresine darbe yayar: içindeki düşmanlara hasar verir
//    ve ~0.7 sn ateş edemez hâle getirir. Bobinler düşman mermilerini yutar.
//  - Özgün mekanik - REZONANS: Bir düşman birden fazla bobinin (veya Dev'in)
//    alanındaysa darbe hasarı her ekstra kaynak için %40 artar.
//  - Yetenek 1 (DEŞARJ): Tüm bobinler ve Dev AYNI ANDA büyük bir darbe yapar.
//    Hasar, düşmanı kaç kaynağın kapsadığına göre katlanır (1 kaynak: 340,
//    2 kaynak: ~920, 3 kaynak: ~1730) ve 1 sn sersemletir. Üçgen kur, deşarj et!
//  - Yetenek 2 (AŞIRI YÜK): Joystick yönündeki bobini 3 sn aşırı yükler: alan x1.5,
//    hasar x2, darbe 0.6 sn'de bir. Süre bitince bobin büyük bir patlamayla yanıp
//    gider (hasar x2.5 ek darbe). Hangi bobini ne zaman seçtiğin önemli!
//  - Güç (ELEKTRO DEV): Nişan aldığın yere HAREKETSİZ, dev bir elektrik kulesi
//    diker (16 sn, 5000 can). Çok geniş alanı (220) güçlü darbelerle tarar, 220
//    birim yakınındaki bobinleri 2 kat hızlı çalıştırır, ona isabet eden
//    mermilerin atanı şok olur. Ölünce/süresi bitince patlar. Aynı anda 1 Dev.
//  - Bar: darbe hasarıyla ve zamanla dolar.
// ============================================================================
(function () {
    'use strict';
    const ID = 'volt';
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const clamp01 = v => Math.max(0, Math.min(1, v));
    const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

    window.GAME_EXT = window.GAME_EXT || { characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {} };
    window.GAME_EXT.characters[ID] = { color: '#fff200', hp: 3800, speed: 3.3 };

    // ---- Denge ayarları (buradan oynayabilirsin) ----
    const CFG = {
        coil: { radius: 9, hp: 100, life: 640, period: 100, pulseR: 125, dmg: 180, stunMs: 1200, overlap: 0.4, max: 3, drop: 10 },
        over: { time: 220, rMul: 1.5, dmgMul: 2, period: 60, endMul: 2.5, cd: 540 },
        discharge: { base: 340, coverK: 0.35, stunMs: 1000, cd: 720 },
        tower: { radius: 30, hp: 5000, life: 760, pulseR: 180, pulseDmg: 300, pulseEvery: 55, stunMs: 1400,
                 reflect: 0.5, reflectStunMs: 1000, endR: 200, endDmg: 800 },
        boost: { near: 220, mul: 2 },
        q: { cd: 720 },
        passive: 0.02, chargeDiv: 30
    };

    let coils = [], tower = null, rings = [], lastT = 0, wasStarted = false;
    const blockers = () => obstacles.concat(cactusWalls || []);
    const coilR = c => CFG.coil.pulseR * (c.over > 0 ? CFG.over.rMul : 1);

    // ---- Güç şarjı: ana oyunun şarjı bu karakter için kapalı, kendi barımız var ----
    const prevCharge = window.chargeUlti;
    window.chargeUlti = function () {
        if (player.charType === ID) return;
        return prevCharge.apply(this, arguments);
    };
    function charge(n) {
        if (!gameStarted || player.charType !== ID || player.ultReady || tower) return;
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
    // Güç butonunun çekme miktarı (dokunmatikte ultAim.pull, klavyede fare mesafesi)
    function ultPull() {
        if (typeof ultAim.pull === 'number') return ultAim.pull < 0.05 ? 1 : clamp01(ultAim.pull);
        return cl(Math.hypot(lastMouseX - player.x, lastMouseY - player.y) / (RANGE * 0.8), 0.1, 1);
    }
    const bulletDmg = b => {
        const easy = window.GAME_DIFFICULTY === 'easy';
        if (b.type === 'stationary_bot_bullet') return easy ? 300 : 350;
        if (b.type === 'boomerang') return easy ? 200 : 250;
        return easy ? 480 : 500;
    };

    // ---- Darbe (REZONANS: çakışan alanlar hasarı artırır) ----
    function rawCover(e) {
        let n = 0;
        coils.forEach(c => { if (c.drop <= 0 && getDist(c, e) < coilR(c) + e.radius) n++; });
        if (tower && getDist(tower, e) < CFG.tower.pulseR + e.radius) n++;
        return n;
    }
    function spark(e) {
        for (let i = 0; i < 3; i++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, life: 15, maxLife: 30, color: '#fff200', size: 3, type: 'normal' });
    }
    function stun(e, ms) {
        if (e.shootInterval !== undefined) e.lastShot = Math.max(e.lastShot || 0, Date.now() - e.shootInterval + ms);
    }
    function pulse(src, R, dmg, stunMs) {
        let hit = 0;
        getActiveEnemies().forEach(e => {
            if (e.hp <= 0 || getDist(src, e) >= R + e.radius) return;
            const cover = Math.max(1, rawCover(e)), d = Math.round(dmg * (1 + CFG.coil.overlap * (cover - 1)));
            e.hp -= d; hit++;
            addFloatingNumber(e.x, e.y, d, cover > 1 ? '#fff200' : '#f5d742'); charge(d / CFG.chargeDiv);
            stun(e, stunMs); spark(e);
        });
        if (hit && rings.length < 14) rings.push({ x: src.x, y: src.y, r: 10, max: R, life: 12, maxLife: 12 });
        return hit;
    }
    function discharge() {
        const D = CFG.discharge;
        const targets = getActiveEnemies().filter(e => e.hp > 0 && rawCover(e) > 0);
        if (!targets.length) return false;
        targets.forEach(e => {
            const cover = rawCover(e), d = Math.round(D.base * cover * (1 + D.coverK * (cover - 1)));
            e.hp -= d; addFloatingNumber(e.x, e.y, d, '#fff200'); charge(d / CFG.chargeDiv);
            stun(e, D.stunMs); spark(e); spark(e);
        });
        coils.forEach(c => { if (c.drop <= 0) { c.pt = 0; if (rings.length < 14) rings.push({ x: c.x, y: c.y, r: 10, max: coilR(c), life: 14, maxLife: 14 }); } });
        if (tower) { tower.pt = 0; if (rings.length < 14) rings.push({ x: tower.x, y: tower.y, r: 10, max: CFG.tower.pulseR, life: 14, maxLife: 14 }); }
        screenShake = Math.max(screenShake, 7);
        return true;
    }
    function pickCoil(angle) {
        let best = null, bd = 1e9;
        const ang = angle !== undefined ? angle : player.angle;
        coils.forEach(c => {
            if (c.drop > 0 || getDist(player, c) < 1) return;
            const diff = Math.abs(angDiff(getAngle(player, c), ang));
            if (diff < bd) { bd = diff; best = c; }
        });
        return best;
    }

    // ---- Ana saldırı: Bobin koy ----
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== ID) return origFire.call(this, a, pull);
        const p = spawnPoint(a, pull !== undefined ? clamp01(pull) : summonPull(), CFG.coil.radius);
        if (coils.length >= CFG.coil.max) { const old = coils.shift(); spawnParticles(old.x, old.y, '#fff200', 'smoke'); }
        coils.push({ x: p.x, y: p.y, radius: CFG.coil.radius, hp: CFG.coil.hp, maxHp: CFG.coil.hp, life: CFG.coil.life, pt: 40, drop: CFG.coil.drop, over: 0 });
        spawnParticles(p.x, p.y, '#fff200', 'normal');
        this.consumeAmmo();
    };

    // ---- Yetenekler ----
    const origG1 = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== ID) return origG1.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        if (!coils.length && !tower) { addFloatingNumber(this.x, this.y - 30, 'BOBİN YOK!', '#e74c3c'); return; }
        if (!discharge()) { addFloatingNumber(this.x, this.y - 30, 'HEDEF YOK!', '#e74c3c'); return; }
        addFloatingNumber(this.x, this.y - 30, 'DEŞARJ!', '#fff200');
        this.setCooldown(); this.gadgetCooldown = CFG.q.cd;
    };

    const origG2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== ID) return origG2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        const c = pickCoil(a);
        if (!c) { addFloatingNumber(this.x, this.y - 30, 'BOBİN YOK!', '#e74c3c'); return; }
        if (c.over > 0) { addFloatingNumber(c.x, c.y - 25, 'ZATEN YÜKLÜ!', '#e74c3c'); return; }
        c.over = CFG.over.time; c.pt = Math.max(c.pt, 30);
        spawnParticles(c.x, c.y, '#ff9f1a', 'normal');
        addFloatingNumber(c.x, c.y - 25, 'AŞIRI YÜK!', '#ff9f1a'); screenShake = Math.max(screenShake, 4);
        this.gadget2Ready = false; this.gadget2Cooldown = CFG.over.cd; gadgetBtn2.classList.add('cooldown');
    };

    const origUlt = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== ID) return origUlt.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;
        if (tower) { addFloatingNumber(this.x, this.y - 40, 'DEV ZATEN VAR!', '#e74c3c'); return; }
        const T = CFG.tower, p = spawnPoint(a, ultPull(), T.radius);
        tower = { x: p.x, y: p.y, radius: T.radius, hp: T.hp, maxHp: T.hp, life: T.life, pt: 30, age: 0, isGiant: true };
        spawnParticles(p.x, p.y, '#fff200', 'smoke'); screenShake = Math.max(screenShake, 10);
        addFloatingNumber(p.x, p.y - 50, 'ELEKTRO DEV!', '#fff200');
        this.ultReady = false; this.ultCharge = 0; ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    };

    // ---- Güncelleme ----
    function update(ts) {
        charge(CFG.passive * ts);
        const O = CFG.over;

        coils.forEach(c => {
            c.life -= ts;
            if (c.drop > 0) { c.drop -= ts; return; }
            const wasOver = c.over > 0, rOver = CFG.coil.pulseR * O.rMul;
            if (wasOver) c.over -= ts;
            const boosted = tower && getDist(tower, c) < CFG.boost.near;
            c.pt += ts * (boosted ? CFG.boost.mul : 1);
            const period = wasOver ? O.period : CFG.coil.period;
            if (c.pt >= period) { c.pt = 0; pulse(c, wasOver ? rOver : CFG.coil.pulseR, CFG.coil.dmg * (wasOver ? O.dmgMul : 1), CFG.coil.stunMs); }
            if (wasOver && c.over <= 0) {   // aşırı yük bitti: büyük patlama ve bobin yanar
                pulse(c, rOver, CFG.coil.dmg * O.endMul, 1000);
                explosions.push({ x: c.x, y: c.y, radius: 0, maxRadius: rOver, life: 14, maxLife: 14 });
                screenShake = Math.max(screenShake, 8); c.hp = 0;
            }
        });

        if (tower) {
            const T = CFG.tower;
            tower.age += ts; tower.life -= ts; tower.pt += ts;
            if (tower.pt >= T.pulseEvery) { tower.pt = 0; pulse(tower, T.pulseR, T.pulseDmg, T.stunMs); }
        }

        // düşman mermileri bobinlere / Dev'e isabet eder
        const allies = coils.filter(c => c.drop <= 0);
        if (tower) allies.push(tower);
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
                if (a === tower && b.owner && b.owner.hp > 0 && !b.owner.isDead) {   // Dev: atanı şoklar
                    const o = b.owner, sd = Math.round(dmg * CFG.tower.reflect);
                    o.hp -= sd; addFloatingNumber(o.x, o.y, sd, '#fff200'); stun(o, CFG.tower.reflectStunMs);
                    if (rings.length < 14) rings.push({ x: o.x, y: o.y, r: 8, max: 40, life: 10, maxLife: 10 });
                }
                if (b.type !== 'boomerang') { botBullets.splice(bi, 1); break; }
            }
        }

        // ömür / ölüm
        for (let i = coils.length - 1; i >= 0; i--) {
            const c = coils[i];
            if (c.life <= 0 || c.hp <= 0) { spawnParticles(c.x, c.y, '#fff200', 'smoke'); coils.splice(i, 1); }
        }
        if (tower && (tower.life <= 0 || tower.hp <= 0)) {
            const T = CFG.tower;
            getActiveEnemies().forEach(e => {
                if (e.hp <= 0 || getDist(tower, e) >= T.endR + e.radius) return;
                e.hp -= T.endDmg; addFloatingNumber(e.x, e.y, T.endDmg, '#fff200'); stun(e, 1000);
            });
            explosions.push({ x: tower.x, y: tower.y, radius: 0, maxRadius: T.endR, life: 14, maxLife: 14 });
            spawnParticles(tower.x, tower.y, '#fff200', 'smoke'); screenShake = Math.max(screenShake, 10);
            tower = null;
        }
        for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= ts; if (rings[i].life <= 0) rings.splice(i, 1); }
    }

    // ---- Çizim ----
    function bar(x, y, w, f, col) {
        ctx.fillStyle = '#444'; ctx.fillRect(x - w / 2, y, w, 4);
        ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, Math.max(0, f) * w, 4);
    }
    function drawCoil(c) {
        if (c.drop <= 0) {
            const over = c.over > 0, col = over ? '#ff9f1a' : '#fff200';
            ctx.save(); ctx.globalAlpha = over ? 0.16 : 0.1; ctx.beginPath(); ctx.arc(c.x, c.y, coilR(c), 0, Math.PI * 2);
            ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = over ? 0.6 : 0.3; ctx.setLineDash([8, 10]);
            ctx.strokeStyle = col; ctx.lineWidth = over ? 3 : 2; ctx.stroke(); ctx.restore();
        }
        const dropK = Math.max(0, c.drop) / CFG.coil.drop;
        ctx.save(); ctx.translate(c.x, c.y - dropK * 40);
        if (c.life < 120 && Math.floor(Date.now() / 100) % 2) ctx.globalAlpha = 0.45;
        const s = (1 + dropK * 0.8) * (c.over > 0 ? 1 + Math.sin(Date.now() / 50) * 0.08 : 1); ctx.scale(s, s);
        ctx.beginPath(); ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
        ctx.fillStyle = c.over > 0 ? '#6e2b00' : '#2f3640'; ctx.fill();
        ctx.strokeStyle = c.over > 0 ? '#ff9f1a' : '#fff200'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -3, 5, 0, Math.PI * 2); ctx.fillStyle = c.over > 0 ? '#ff9f1a' : '#fff200'; ctx.fill();
        if (c.drop <= 0) {
            const per = c.over > 0 ? CFG.over.period : CFG.coil.period;
            ctx.beginPath(); ctx.arc(0, 0, c.radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(c.pt / per));
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
        }
        ctx.restore();
        bar(c.x, c.y - c.radius - 12, 28, c.hp / c.maxHp, c.over > 0 ? '#ff9f1a' : '#fff200');
        if (c.over > 0) bar(c.x, c.y - c.radius - 18, 28, c.over / CFG.over.time, '#e74c3c');
    }
    function drawTower(g) {
        const T = CFG.tower;
        ctx.save(); ctx.globalAlpha = 0.08; ctx.beginPath(); ctx.arc(g.x, g.y, T.pulseR, 0, Math.PI * 2);
        ctx.fillStyle = '#fff200'; ctx.fill(); ctx.globalAlpha = 0.3; ctx.setLineDash([10, 12]);
        ctx.strokeStyle = '#fff200'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        ctx.save(); ctx.translate(g.x, g.y);
        if (g.life < 120 && Math.floor(Date.now() / 100) % 2) ctx.globalAlpha = 0.5;
        ctx.beginPath();
        for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3 + Math.PI / 6; j ? ctx.lineTo(Math.cos(a) * g.radius, Math.sin(a) * g.radius) : ctx.moveTo(Math.cos(a) * g.radius, Math.sin(a) * g.radius); }
        ctx.closePath(); ctx.fillStyle = '#2f3640'; ctx.fill(); ctx.strokeStyle = '#fff200'; ctx.lineWidth = 4; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4, -22); ctx.lineTo(-10, 4); ctx.lineTo(-1, 4); ctx.lineTo(-5, 22); ctx.lineTo(10, -4); ctx.lineTo(1, -4); ctx.closePath();
        ctx.fillStyle = '#fff200'; ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, g.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(g.pt / T.pulseEvery));
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
        bar(g.x, g.y - g.radius - 16, 70, g.hp / g.maxHp, '#fff200');
        bar(g.x, g.y - g.radius - 10, 70, g.life / T.life, '#74b9ff');
    }
    function draw() {
        ctx.save();
        coils.forEach(drawCoil);
        if (tower) drawTower(tower);

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
        // aşırı yük: hangi bobin seçilir?
        if (gadAim2.active && player.gadget2Ready && !player.isDead) {
            const c = pickCoil(gadAim2.angle);
            if (c) {
                ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,159,26,0.9)'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(c.x, c.y, c.radius + 9, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.arc(c.x, c.y, CFG.coil.pulseR * CFG.over.rMul, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
            }
        }
        // Dev önizlemesi
        if (ultAim.active && player.ultReady && !player.isDead) {
            const p = spawnPoint(ultAim.angle, ultPull(), CFG.tower.radius);
            ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,242,0,0.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(p.x, p.y); ctx.stroke();
            ctx.beginPath(); ctx.arc(p.x, p.y, CFG.tower.pulseR, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]); ctx.beginPath(); ctx.arc(p.x, p.y, CFG.tower.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,242,0,0.25)'; ctx.fill(); ctx.stroke(); ctx.restore();
        }
        ctx.restore();
    }

    // ---- Arayüz kurulumu (oyun başlayınca) ----
    function setupUI() {
        if (player.charType !== ID) return;
        ultiBtn.style.display = 'flex'; gadgetBtn.style.display = 'flex'; gadgetBtn2.style.display = 'flex';
        gadgetBtn.innerHTML = 'DEŞARJ<br><span id="gadget-timer"></span>';
        gadgetBtn2.innerHTML = 'AŞIRI<br>YÜK<br><span id="gadget-timer-2"></span>';
        gadgetTimerText = document.getElementById('gadget-timer');
        gadgetTimerText2 = document.getElementById('gadget-timer-2');
        coils = []; tower = null; rings = [];
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    // Kendi döngüm: ana döngüden sonra çalışır, başka mod dosyalarının hook'larını ezmez
    function loop(t) {
        requestAnimationFrame(loop);
        const ts = Math.min(3, (t - lastT) / 16.666); lastT = t;
        if (!gameStarted) { wasStarted = false; coils = []; tower = null; rings = []; return; }
        if (!wasStarted) { wasStarted = true; setupUI(); }
        if (player.charType !== ID) { coils = []; tower = null; rings = []; return; }
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
