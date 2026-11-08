// ============================================================================
// mod37.js - "Tetik" karakteri (nişancı, 3 mermi türü)
// Ana dosyaya dokunmaz. index.html'de TÜM mod script'lerinden SONRA eklenmeli:
//   <script src="mod37.js"></script>
//
// Tetik bir NİŞANCIDIR. Karakterin üstünde 3 renkli bölgeli bir BAR sürekli
// sağa sola gider. Sağ joystick'e dokunup NİŞAN ALMAYA BAŞLADIĞIN AN bar DURUR
// ve durduğu bölge mermi türünü seçer (sonra rahatça nişan alırsın):
//   MAVİ  (B) Büyüyen mermi : uzaklaştıkça büyür, hasarı 350 -> 1300 artar.
//   YEŞİL (K) Kök mermisi   : 600 hasar. İsabet eden düşman 2 sn boyunca
//                             vurulduğu yerden 20 birimden fazla uzaklaşamaz.
//   MOR   (T) Takas mermisi : 400 hasar. İsabet eden düşmanla YER DEĞİŞTİRİRSİN
//                             (kısa dokunulmazlık). 2 cephane harcar.
//  - Yetenek 1 (KİLİT): Barı durdurur, seçili tür sonraki 3 atış için kilitlenir.
//  - Yetenek 2 (AV İŞARETİ): Joystick yönündeki düşmanı 4 sn işaretler. Tüm
//    mermilerin işaretliye doğru kıvrılır ve işaretli senden %25 fazla hasar alır.
//  - Güç (KADER MERMİSİ): Yavaş, dev bir mermi. Sağ joystick'i çevirerek mermiyi
//    SEN YÖNLENDİRİRSİN (4 sn uçar). Uçtukça büyür ve hasarı 900 -> 2400 artar,
//    duvardan 1 kez seker, çarpınca büyük patlar ve çevredekileri 2 sn yerinde
//    tutar (kök). Uçarken normal atış kapalıdır.
//  - Bar: mermi isabetleriyle ve zamanla dolar.
// ============================================================================
(function () {
    'use strict';
    const ID = 'tetik';
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const clamp01 = v => Math.max(0, Math.min(1, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

    window.GAME_EXT = window.GAME_EXT || { characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {} };
    window.GAME_EXT.characters[ID] = { color: '#f1f2f6', hp: 3400, speed: 3.4 };

    // ---- Denge ayarları (buradan oynayabilirsin) ----
    const CFG = {
        bar: { period: 90, w: 72, h: 9 },
        b1: { speed: PLAYER_BULLET_SPEED * 0.95, range: RANGE * 1.3, rMin: 6, rMax: 28, dmgMin: 350, dmgMax: 1300 },
        b2: { speed: PLAYER_BULLET_SPEED * 1.15, range: RANGE * 1.2, r: 8, dmg: 600, rootLimit: 20, rootFrames: 120 },
        b3: { speed: PLAYER_BULLET_SPEED, range: RANGE * 1.25, r: 9, dmg: 400, cost: 2, inv: 24 },
        mark: { time: 240, mult: 1.25, turn: 0.07, maxAngle: 2.2, cd: 540 },
        lock: { shots: 3, cd: 480 },
        fate: { speed: 4.6, life: 240, turn: 0.08, r0: 18, r1: 46, dmg0: 900, dmg1: 2400, expR: 130, splash: 0.6, rootFrames: 120, expireFactor: 0.6 },
        passive: 0.02, chargeDiv: 25
    };
    const COL = ['#0abde3', '#10ac84', '#a55eea'], LET = ['B', 'K', 'T'];

    let shots = [], fate = null, mark = null, lockShots = 0, lockType = 0;
    let phase = 0, frozen = false, frozenType = 0, frozenPos = 0, lastAim = false, invT = 0, lastMM = 0;
    let lastT = 0, wasStarted = false;
    window.addEventListener('mousemove', () => { lastMM = Date.now(); });

    // ---- Güç şarjı: ana oyunun şarjı bu karakter için kapalı, kendi barımız var ----
    const prevCharge = window.chargeUlti;
    window.chargeUlti = function () {
        if (player.charType === ID) return;
        return prevCharge.apply(this, arguments);
    };
    function charge(n) {
        if (!gameStarted || player.charType !== ID || player.ultReady || fate) return;
        player.ultCharge = Math.min(100, player.ultCharge + n);
        ultFill.style.width = player.ultCharge + '%';
        if (player.ultCharge >= 100) {
            player.ultReady = true; ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, 'KADER HAZIR!', '#f1f2f6');
        }
    }

    // ---- Bar ----
    function barPos() { const u = (phase % CFG.bar.period) / CFG.bar.period; return u < 0.5 ? u * 2 : (1 - u) * 2; }
    const zoneOf = p => Math.min(2, Math.floor(p * 3));
    const currentType = () => lockShots > 0 ? lockType : (frozen ? frozenType : zoneOf(barPos()));
    const costOf = t => t === 2 ? CFG.b3.cost : 1;
    const rangeOf = t => t === 0 ? CFG.b1.range : (t === 1 ? CFG.b2.range : CFG.b3.range);

    // ---- Mermi ----
    function mkShot(type, x, y, a) {
        const C = type === 0 ? CFG.b1 : (type === 1 ? CFG.b2 : CFG.b3);
        return { type, x, y, ang: a, vx: Math.cos(a) * C.speed, vy: Math.sin(a) * C.speed, speed: C.speed, range: C.range, dist: 0, r: type === 0 ? C.rMin : C.r };
    }
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== ID) return origFire.call(this, a, pull);
        if (fate) return;                                   // Kader Mermisi uçarken normal atış kapalı (joystick yönlendirme içindir)
        const type = currentType(), cost = costOf(type);
        if (this.ammo < cost) { addFloatingNumber(this.x, this.y - 30, 'CEPHANE YETMEDİ!', '#e74c3c'); return; }
        if (lockShots > 0) { lockShots--; if (lockShots === 0) addFloatingNumber(this.x, this.y - 40, 'KİLİT BİTTİ', '#f1f2f6'); }
        shots.push(mkShot(type, this.x, this.y, a));
        for (let i = 0; i < cost; i++) this.consumeAmmo();
    };

    function hitEnemy(s, e, g) {
        let dmg = s.type === 0 ? lerp(CFG.b1.dmgMin, CFG.b1.dmgMax, g) : (s.type === 1 ? CFG.b2.dmg : CFG.b3.dmg);
        if (mark && mark.e === e) dmg *= CFG.mark.mult;
        dmg = Math.round(dmg);
        e.hp -= dmg; addFloatingNumber(e.x, e.y, dmg, COL[s.type]); charge(dmg / CFG.chargeDiv);
        if (s.type === 1) {
            e.cRoot = { x: e.x, y: e.y, t: CFG.b2.rootFrames };
            addFloatingNumber(e.x, e.y - 22, 'KÖK!', COL[1]);
        } else if (s.type === 2 && !e.isNest && !player.isDead) {
            const px = player.x, py = player.y;
            spawnParticles(px, py, COL[2], 'smoke');
            player.x = e.x; player.y = e.y; e.x = px; e.y = py; e.cRoot = null;
            if (e.kbX !== undefined) { e.kbX = 0; e.kbY = 0; }
            spawnParticles(player.x, player.y, COL[2], 'smoke');
            player.jumpInvulnerable = true; invT = CFG.b3.inv;
            addFloatingNumber(player.x, player.y - 30, 'TAKAS!', COL[2]);
        }
    }

    function updateShots(ts, enemies) {
        const mk = (mark && mark.e.hp > 0) ? mark.e : null;
        for (let i = shots.length - 1; i >= 0; i--) {
            const s = shots[i];
            if (mk) {
                const diff = angDiff(Math.atan2(mk.y - s.y, mk.x - s.x), s.ang);
                if (Math.abs(diff) < CFG.mark.maxAngle) {
                    s.ang += cl(diff, -CFG.mark.turn * ts, CFG.mark.turn * ts);
                    s.vx = Math.cos(s.ang) * s.speed; s.vy = Math.sin(s.ang) * s.speed;
                }
            }
            s.x += s.vx * ts; s.y += s.vy * ts; s.dist += s.speed * ts;
            const g = clamp01(s.dist / s.range);
            if (s.type === 0) s.r = lerp(CFG.b1.rMin, CFG.b1.rMax, g);
            if (Math.random() < 0.5 * Math.min(1, ts)) particles.push({ x: s.x, y: s.y, vx: (Math.random() - .5), vy: (Math.random() - .5), life: 16, maxLife: 30, color: COL[s.type], size: 2.5, type: 'normal' });
            const pad = WALL_THICKNESS + 3;
            let remove = s.x < pad || s.x > canvas.width - pad || s.y < pad || s.y > canvas.height - pad || s.dist >= s.range;
            if (!remove) for (const o of obstacles) if (getDist(s, o) < o.radius + s.r) { o.hp -= 150; remove = true; break; }
            if (!remove) for (const e of enemies) {
                if (e.hp <= 0 || getDist(s, e) >= e.radius + s.r) continue;
                hitEnemy(s, e, g); remove = true; break;
            }
            if (remove) { spawnParticles(s.x, s.y, COL[s.type], 'normal'); shots.splice(i, 1); }
        }
    }

    // ---- Yetenekler ----
    const origG1 = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== ID) return origG1.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        lockType = currentType(); lockShots = CFG.lock.shots; frozen = false;
        addFloatingNumber(this.x, this.y - 30, 'KİLİT: ' + LET[lockType] + ' x' + lockShots, COL[lockType]);
        this.setCooldown(); this.gadgetCooldown = CFG.lock.cd;
    };

    function pickEnemy(angle) {
        const ang = angle !== undefined ? angle : player.angle;
        let best = null, bs = 1e9;
        getActiveEnemies().forEach(e => {
            if (e.hp <= 0) return;
            const diff = Math.abs(angDiff(getAngle(player, e), ang));
            if (diff > 1.05) return;                    // ~60°
            const score = diff * 300 + getDist(player, e) * 0.3;
            if (score < bs) { bs = score; best = e; }
        });
        return best;
    }
    const origG2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== ID) return origG2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        const e = pickEnemy(a);
        if (!e) { addFloatingNumber(this.x, this.y - 30, 'HEDEF YOK!', '#e74c3c'); return; }
        mark = { e, t: CFG.mark.time };
        addFloatingNumber(e.x, e.y - 30, 'AV İŞARETİ!', '#ff4757');
        this.gadget2Ready = false; this.gadget2Cooldown = CFG.mark.cd; gadgetBtn2.classList.add('cooldown');
    };

    const origUlt = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== ID) return origUlt.call(this, a, pull);
        if (!this.ultReady || this.isDead || fate) return;
        fate = { x: this.x, y: this.y, ang: a, age: 0, r: CFG.fate.r0, bounces: 0 };
        addFloatingNumber(this.x, this.y - 40, 'KADER MERMİSİ!', '#f1f2f6'); screenShake = Math.max(screenShake, 6);
        this.ultReady = false; this.ultCharge = 0; ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    };

    // ---- Kader Mermisi ----
    function explodeFate(direct, factor) {
        const F = CFG.fate, f = fate, g = clamp01(f.age / F.life);
        const base = lerp(F.dmg0, F.dmg1, g) * factor;
        getActiveEnemies().forEach(e => {
            if (e.hp <= 0) return;
            const isDirect = e === direct;
            if (!isDirect && getDist(f, e) >= F.expR + e.radius) return;
            let dmg = base * (isDirect ? 1 : F.splash);
            if (mark && mark.e === e) dmg *= CFG.mark.mult;
            dmg = Math.round(dmg);
            e.hp -= dmg; addFloatingNumber(e.x, e.y, dmg, '#f1f2f6'); charge(0);
            e.cRoot = { x: e.x, y: e.y, t: F.rootFrames };
        });
        obstacles.forEach(o => { if (getDist(f, o) < F.expR + o.radius) o.hp -= 600; });
        explosions.push({ x: f.x, y: f.y, radius: 0, maxRadius: F.expR, life: 16, maxLife: 16 });
        spawnParticles(f.x, f.y, '#f1f2f6', 'smoke'); screenShake = Math.max(screenShake, 12);
        fate = null;
    }
    function updateFate(ts, enemies) {
        const F = CFG.fate, f = fate;
        f.age += ts;
        const g = clamp01(f.age / F.life);
        f.r = lerp(F.r0, F.r1, g);
        let want = null;
        if (aimData.active) want = aimData.angle;
        else if (Date.now() - lastMM < 3000) want = Math.atan2(lastMouseY - f.y, lastMouseX - f.x);
        if (want !== null) f.ang += cl(angDiff(want, f.ang), -F.turn * ts, F.turn * ts);
        f.x += Math.cos(f.ang) * F.speed * ts; f.y += Math.sin(f.ang) * F.speed * ts;
        if (Math.random() < 0.8 * Math.min(1, ts)) particles.push({ x: f.x, y: f.y, vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2, life: 20, maxLife: 40, color: '#f1f2f6', size: 3 + f.r * 0.1, type: 'normal' });

        const pad = WALL_THICKNESS + f.r * 0.5;
        let bounced = false;
        if (f.x < pad || f.x > canvas.width - pad) { f.ang = Math.PI - f.ang; f.x = cl(f.x, pad, canvas.width - pad); bounced = true; }
        if (f.y < pad || f.y > canvas.height - pad) { f.ang = -f.ang; f.y = cl(f.y, pad, canvas.height - pad); bounced = true; }
        if (bounced) { f.bounces++; if (f.bounces > 1) { explodeFate(null, 1); return; } }

        for (const e of enemies) if (e.hp > 0 && getDist(f, e) < e.radius + f.r) { explodeFate(e, 1); return; }
        for (const o of obstacles) if (getDist(f, o) < o.radius + f.r) { explodeFate(null, 1); return; }
        if (f.age >= F.life) explodeFate(null, F.expireFactor);
    }

    // ---- Güncelleme ----
    function update(ts) {
        charge(CFG.passive * ts);
        const enemies = getActiveEnemies(), eset = new Set(enemies);

        // kök: vurulduğu yerden 20 birimden fazla uzaklaşamaz
        enemies.forEach(e => {
            const r = e.cRoot; if (!r) return;
            r.t -= ts; if (r.t <= 0) { e.cRoot = null; return; }
            const dx = e.x - r.x, dy = e.y - r.y, d = Math.hypot(dx, dy);
            if (d > CFG.b2.rootLimit) { e.x = r.x + dx / d * CFG.b2.rootLimit; e.y = r.y + dy / d * CFG.b2.rootLimit; }
        });

        // takas sonrası kısa dokunulmazlık
        if (invT > 0) { invT -= ts; if (invT <= 0 && !player.isJumping) player.jumpInvulnerable = false; }

        // av işareti
        if (mark) { mark.t -= ts; if (mark.t <= 0 || mark.e.hp <= 0 || !eset.has(mark.e)) mark = null; }

        // bar: nişan alma başlayınca durur
        const aiming = aimData.active && !player.isDead && !fate;
        if (aiming && !lastAim && lockShots <= 0) { frozen = true; frozenPos = barPos(); frozenType = zoneOf(frozenPos); }
        if (!aiming && lastAim) frozen = false;
        lastAim = aiming;
        if (!frozen && lockShots <= 0 && !fate) phase += ts;

        updateShots(ts, enemies);
        if (fate) updateFate(ts, enemies);
    }

    // ---- Çizim ----
    function drawBar() {
        const B = CFG.bar, x = player.x - B.w / 2, y = player.y - 54;
        ctx.save();
        if (fate) ctx.globalAlpha = 0.35;
        for (let z = 0; z < 3; z++) { ctx.globalAlpha = (fate ? 0.3 : 0.85); ctx.fillStyle = COL[z]; ctx.fillRect(x + z * B.w / 3, y, B.w / 3, B.h); }
        ctx.globalAlpha = fate ? 0.4 : 1;
        ctx.fillStyle = '#fff'; ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
        for (let z = 0; z < 3; z++) ctx.fillText(LET[z], x + (z + 0.5) * B.w / 3, y + B.h - 1.5);
        const pos = lockShots > 0 ? (lockType + 0.5) / 3 : (frozen ? frozenPos : barPos());
        ctx.fillStyle = '#fff'; ctx.fillRect(x + pos * B.w - 1.5, y - 3, 3, B.h + 6);
        if (frozen || lockShots > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, B.w + 2, B.h + 2); }
        if (lockShots > 0) { ctx.fillStyle = COL[lockType]; ctx.font = 'bold 11px Arial'; ctx.fillText('KİLİT x' + lockShots, player.x, y - 6); }
        ctx.restore();
    }
    function draw() {
        ctx.save();
        const enemies = getActiveEnemies();

        // kök halkaları
        enemies.forEach(e => {
            if (!e.cRoot) return;
            ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(16,172,132,0.9)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(e.cRoot.x, e.cRoot.y, CFG.b2.rootLimit + e.radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        });
        // av işareti
        if (mark && mark.e.hp > 0) {
            const e = mark.e, t = Date.now() / 300;
            ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(t);
            ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, e.radius + 10, 0, Math.PI * 2); ctx.stroke();
            for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(e.radius + 5, 0); ctx.lineTo(e.radius + 16, 0); ctx.stroke(); }
            ctx.restore();
            ctx.save(); ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(mark.t / CFG.mark.time));
            ctx.strokeStyle = 'rgba(255,71,87,0.6)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        }

        // mermiler
        shots.forEach(s => {
            ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang);
            ctx.beginPath(); ctx.arc(0, 0, s.r, 0, Math.PI * 2); ctx.fillStyle = COL[s.type]; ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            if (s.type === 2) { ctx.rotate(Date.now() / 100); ctx.beginPath(); ctx.arc(0, 0, s.r * 0.55, 0, Math.PI * 1.4); ctx.stroke(); }
            if (s.type === 1) { ctx.beginPath(); ctx.arc(0, 0, s.r + 4, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(16,172,132,0.6)'; ctx.stroke(); }
            ctx.restore();
        });
        // Kader Mermisi
        if (fate) {
            const f = fate, F = CFG.fate;
            ctx.save(); ctx.translate(f.x, f.y);
            const gr = ctx.createRadialGradient(0, 0, f.r * 0.1, 0, 0, f.r);
            gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#a55eea'); gr.addColorStop(1, '#2d1b4e');
            ctx.beginPath(); ctx.arc(0, 0, f.r, 0, Math.PI * 2); ctx.fillStyle = gr; ctx.fill();
            ctx.strokeStyle = '#f1f2f6'; ctx.lineWidth = 3; ctx.stroke();
            ctx.rotate(Date.now() / 200); ctx.setLineDash([8, 8]);
            ctx.beginPath(); ctx.arc(0, 0, f.r + 8, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
            ctx.restore();
            ctx.save(); ctx.fillStyle = '#f1f2f6'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
            ctx.fillText('KADER ' + Math.ceil((F.life - f.age) / 60) + 's - joystick ile yönlendir', canvas.width / 2, 66); ctx.restore();
        }

        // nişan önizlemesi (seçili türe göre)
        if (aimData.active && player.ammo >= 1 && !player.isDead && !fate) {
            const t = currentType(), rg = rangeOf(t);
            const ex = player.x + Math.cos(aimData.angle) * rg, ey = player.y + Math.sin(aimData.angle) * rg;
            const lack = player.ammo < costOf(t);
            ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = lack ? 'rgba(231,76,60,0.7)' : COL[t]; ctx.globalAlpha = 0.7; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.setLineDash([]); ctx.beginPath(); ctx.arc(ex, ey, t === 0 ? CFG.b1.rMax : 10, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        // av işareti: kimi seçecek?
        if (gadAim2.active && player.gadget2Ready && !player.isDead) {
            const e = pickEnemy(gadAim2.angle);
            if (e) {
                ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,71,87,0.8)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(e.x, e.y); ctx.stroke();
                ctx.setLineDash([]); ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 12, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
            }
        }
        // Kader Mermisi önizlemesi
        if (ultAim.active && player.ultReady && !player.isDead && !fate) {
            ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(165,94,234,0.8)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(player.x, player.y);
            ctx.lineTo(player.x + Math.cos(ultAim.angle) * 160, player.y + Math.sin(ultAim.angle) * 160); ctx.stroke();
            ctx.setLineDash([]); ctx.beginPath(); ctx.arc(player.x + Math.cos(ultAim.angle) * 40, player.y + Math.sin(ultAim.angle) * 40, CFG.fate.r0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }

        if (!player.isDead) drawBar();
        ctx.restore();
    }

    // ---- Arayüz kurulumu (oyun başlayınca) ----
    function clearState() {
        if (player.charType === ID && !player.isJumping) player.jumpInvulnerable = false;
        [bot, bot2].concat(getActiveEnemies()).forEach(e => { if (e) e.cRoot = null; });
        shots = []; fate = null; mark = null; lockShots = 0; phase = 0; frozen = false; lastAim = false; invT = 0;
    }
    function setupUI() {
        if (player.charType !== ID) return;
        ultiBtn.style.display = 'flex'; gadgetBtn.style.display = 'flex'; gadgetBtn2.style.display = 'flex';
        gadgetBtn.innerHTML = 'KİLİT<br><span id="gadget-timer"></span>';
        gadgetBtn2.innerHTML = 'AV<br>İŞARETİ<br><span id="gadget-timer-2"></span>';
        gadgetTimerText = document.getElementById('gadget-timer');
        gadgetTimerText2 = document.getElementById('gadget-timer-2');
        clearState();
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    // Kendi döngüm: ana döngüden sonra çalışır, başka mod dosyalarının hook'larını ezmez
    function loop(t) {
        requestAnimationFrame(loop);
        const ts = Math.min(3, (t - lastT) / 16.666); lastT = t;
        if (!gameStarted) { wasStarted = false; shots = []; fate = null; mark = null; lockShots = 0; frozen = false; lastAim = false; return; }
        if (!wasStarted) { wasStarted = true; setupUI(); }
        if (player.charType !== ID) { shots = []; fate = null; mark = null; lockShots = 0; frozen = false; lastAim = false; return; }
        update(ts); draw();
    }
    requestAnimationFrame(loop);

    // ---- Karakter kartı ----
    (function addCard() {
        const box = document.querySelector('.char-select-container');
        if (!box || document.getElementById('char-' + ID)) return;
        const card = document.createElement('div');
        card.className = 'char-card'; card.id = 'char-' + ID;
        card.innerHTML = '<div class="char-color-preview" style="background:linear-gradient(135deg,#0abde3,#10ac84,#a55eea);"></div><span>Tetik</span><small>Hasar: 3 Mermi<br>Güç: Kader</small>';
        card.addEventListener('click', () => {
            selectedCharacter = ID;
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
        box.appendChild(card);
    })();
})();
