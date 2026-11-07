// ============================================================================
// mod36.js - "Asalak" karakteri (sülük çağırıcı)
// Ana dosyaya dokunmaz. index.html'de TÜM mod script'lerinden SONRA eklenmeli:
//   <script src="mod36.js"></script>
//
// Asalak'ın çağırdıkları Çağrı'nın koşan çıraklarından da, Volt'un yerinde
// duran bobinlerinden de farklı hisseder: SÜLÜKLER düşmana hızla gidip YAPIŞIR,
// beslendikçe büyür ve güçlenir, emdikleri canın bir kısmı sana geri döner.
//  - Ana saldırı (Sülük): Sağ joystick'i çek-bırak, çektiğin mesafede bir sülük
//    doğar (1 cephane). Aynı anda en fazla 3 sülük (4.'yü çağırırsan en eskisi
//    gider). Sülük, üzerinde en az sülük olan en yakın düşmanı seçer, yapışır ve
//    her 0.5 sn can emer. Uçarken düşman mermisi isabet ederse ölür.
//  - Özgün mekanik - BESLENME: Sülük emdikçe 3 kademe büyür (1 -> 2 -> 3).
//    Emme hasarı kademeyle artar ve düşmanın o anki canının %1'i kadar ek hasar
//    verir (dev botlara karşı iyi). Emilen canın %20'si sana şifa olur.
//    Düşman ölünce sülük kademesini koruyarak yeni konağa gider.
//  - Yetenek 1 (KULUÇKA): Tüm sülükleri anında bir konağa yapıştırır ve eksik
//    sülükleri (3'e kadar) doğrudan düşmanların üzerinde doğurur.
//  - Yetenek 2 (KAN HIRSI): 6 sn boyunca emme hasarı x1.6, şifa x2, sülük hızı x1.5.
//  - Güç (KRALİÇE): Ağır bir Kraliçe Asalak yanında belirir (12 sn). Her 0.75 sn'de
//    bir yavru sülük doğurur (en fazla 8); yavrular hemen düşmana yapışıp 3 sn emer.
//    Kraliçe seni takip eder, düşman mermilerini yutar. Aynı anda 1 Kraliçe.
//  - Bar: emilen hasarla ve zamanla dolar.
// ============================================================================
(function () {
    'use strict';
    const ID = 'asalak';
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const clamp01 = v => Math.max(0, Math.min(1, v));

    window.GAME_EXT = window.GAME_EXT || { characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {} };
    window.GAME_EXT.characters[ID] = { color: '#b33771', hp: 3600, speed: 3.4 };

    // ---- Denge ayarları (buradan oynayabilirsin) ----
    const CFG = {
        leech: { radius: [11, 14, 18], hp: 350, speed: 4.2, life: 1200, max: 3, tickEvery: 30,
                 drainBase: [45, 70, 100], hostPct: 0.01, feedStage: [400, 1000], heal: 0.2 },
        baby: { radius: 8, hp: 150, speed: 5, drainBase: 35, attachLife: 200, max: 8 },
        frenzy: { time: 360, drain: 1.6, heal: 2, speed: 1.5, cd: 660 },
        q: { cd: 480 },
        queen: { radius: 30, hp: 3500, life: 720, birthEvery: 45, followDist: 110, speed: 1.6 },
        passive: 0.02, chargeDiv: 30
    };

    let leeches = [], queen = null, frenzyT = 0, healAcc = 0, healT = 0, rings = [], lastT = 0, wasStarted = false;
    const blockers = () => obstacles.concat(cactusWalls || []);

    // ---- Güç şarjı: ana oyunun şarjı bu karakter için kapalı, kendi barımız var ----
    const prevCharge = window.chargeUlti;
    window.chargeUlti = function () {
        if (player.charType === ID) return;
        return prevCharge.apply(this, arguments);
    };
    function charge(n) {
        if (!gameStarted || player.charType !== ID || player.ultReady || queen) return;
        player.ultCharge = Math.min(100, player.ultCharge + n);
        ultFill.style.width = player.ultCharge + '%';
        if (player.ultCharge >= 100) {
            player.ultReady = true; ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, 'KRALİÇE HAZIR!', '#b33771');
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
        m.fa = Math.atan2(diry, dirx);
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

    // ---- Sülük yardımcıları ----
    function mkLeech(x, y, baby) {
        const hp = baby ? CFG.baby.hp : CFG.leech.hp;
        return { x, y, radius: baby ? CFG.baby.radius : CFG.leech.radius[0], hp, maxHp: hp, life: CFG.leech.life,
                 host: null, ang: Math.random() * Math.PI * 2, fa: 0, feed: 0, stage: 1, tick: 0, baby: !!baby,
                 attachT: 0, drop: baby ? 0 : 8, wig: Math.random() * 10 };
    }
    const nonBaby = () => leeches.filter(l => !l.baby);
    function hostCounts() {
        const cnt = new Map();
        leeches.forEach(l => { if (l.host) cnt.set(l.host, (cnt.get(l.host) || 0) + 1); });
        return cnt;
    }
    function pickHost(from, enemies, cnt) {
        let best = null, bs = 1e9;
        for (const e of enemies) {
            if (e.hp <= 0) continue;
            const s = (cnt.get(e) || 0) * 600 + getDist(from, e);
            if (s < bs) { bs = s; best = e; }
        }
        return best;
    }
    function attach(l, h, cnt) {
        l.host = h; l.ang = Math.random() * Math.PI * 2;
        l.x = h.x + Math.cos(l.ang) * h.radius * 0.85; l.y = h.y + Math.sin(l.ang) * h.radius * 0.85;
        cnt.set(h, (cnt.get(h) || 0) + 1);
    }

    // ---- Ana saldırı: Sülük çağır ----
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== ID) return origFire.call(this, a, pull);
        const p = spawnPoint(a, pull !== undefined ? clamp01(pull) : summonPull(), CFG.leech.radius[0]);
        const nb = nonBaby();
        if (nb.length >= CFG.leech.max) { const old = nb[0]; spawnParticles(old.x, old.y, '#e84393', 'smoke'); leeches.splice(leeches.indexOf(old), 1); }
        leeches.push(mkLeech(p.x, p.y, false));
        spawnParticles(p.x, p.y, '#e84393', 'normal');
        this.consumeAmmo();
    };

    // ---- Yetenekler ----
    const origG1 = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== ID) return origG1.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        const enemies = getActiveEnemies().filter(e => e.hp > 0);
        if (!enemies.length) { addFloatingNumber(this.x, this.y - 30, 'HEDEF YOK!', '#e74c3c'); return; }
        const cnt = hostCounts();
        nonBaby().forEach(l => { if (!l.host) { const h = pickHost(l, enemies, cnt); if (h) { attach(l, h, cnt); l.drop = 0; } } });
        while (nonBaby().length < CFG.leech.max) {
            const h = pickHost(this, enemies, cnt); if (!h) break;
            const l = mkLeech(h.x, h.y, false); l.drop = 0; leeches.push(l); attach(l, h, cnt);
            spawnParticles(l.x, l.y, '#e84393', 'normal');
        }
        rings.push({ x: this.x, y: this.y, r: 20, max: 90, life: 14, maxLife: 14 });
        addFloatingNumber(this.x, this.y - 30, 'KULUÇKA!', '#e84393');
        this.setCooldown(); this.gadgetCooldown = CFG.q.cd;
    };

    const origG2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== ID) return origG2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        frenzyT = CFG.frenzy.time;
        rings.push({ x: this.x, y: this.y, r: 20, max: 80, life: 14, maxLife: 14 });
        addFloatingNumber(this.x, this.y - 30, 'KAN HIRSI!', '#ff4757');
        this.gadget2Ready = false; this.gadget2Cooldown = CFG.frenzy.cd; gadgetBtn2.classList.add('cooldown');
    };

    const origUlt = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== ID) return origUlt.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;
        if (queen) { addFloatingNumber(this.x, this.y - 40, 'KRALİÇE ZATEN VAR!', '#e74c3c'); return; }
        const Q = CFG.queen, p = freeSpot(this.x + Math.cos(a) * 110, this.y + Math.sin(a) * 110, Q.radius);
        queen = { x: p.x, y: p.y, radius: Q.radius, hp: Q.hp, maxHp: Q.hp, life: Q.life, birth: 20, fa: a };
        spawnParticles(p.x, p.y, '#b33771', 'smoke'); screenShake = Math.max(screenShake, 8);
        addFloatingNumber(this.x, this.y - 40, 'KRALİÇE!', '#b33771');
        this.ultReady = false; this.ultCharge = 0; ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    };

    // ---- Güncelleme ----
    function update(ts) {
        charge(CFG.passive * ts);
        const enemies = getActiveEnemies(), eset = new Set(enemies);
        const frenzy = frenzyT > 0; if (frenzy) frenzyT -= ts;

        leeches.forEach(l => { if (l.host && !(eset.has(l.host) && l.host.hp > 0)) l.host = null; });
        const cnt = hostCounts();

        leeches.forEach(l => {
            if (!l.baby) l.life -= ts;
            if (l.drop > 0) { l.drop -= ts; return; }
            if (l.host) {
                const h = l.host;
                l.x = h.x + Math.cos(l.ang) * h.radius * 0.85; l.y = h.y + Math.sin(l.ang) * h.radius * 0.85;
                l.fa = l.ang + Math.PI;
                if (l.baby) { l.attachT += ts; if (l.attachT >= CFG.baby.attachLife) l.life = -1; }
                l.tick += ts;
                if (l.tick >= CFG.leech.tickEvery) {
                    l.tick = 0;
                    const base = l.baby ? CFG.baby.drainBase : CFG.leech.drainBase[l.stage - 1];
                    const d = Math.round((base + CFG.leech.hostPct * h.hp) * (frenzy ? CFG.frenzy.drain : 1));
                    h.hp -= d; l.feed += d;
                    addFloatingNumber(h.x, h.y, d, '#ff6b81'); charge(d / CFG.chargeDiv);
                    if (!player.isDead) {
                        const hl = d * CFG.leech.heal * (frenzy ? CFG.frenzy.heal : 1);
                        player.hp = Math.min(player.maxHp, player.hp + hl); healAcc += hl;
                    }
                    if (!l.baby) {
                        const ns = l.feed >= CFG.leech.feedStage[1] ? 3 : (l.feed >= CFG.leech.feedStage[0] ? 2 : 1);
                        if (ns > l.stage) { l.stage = ns; l.radius = CFG.leech.radius[ns - 1]; addFloatingNumber(l.x, l.y - 18, 'BESLENDİ!', '#ff6b81'); }
                    }
                }
            } else {
                const target = pickHost(l, enemies, cnt);
                const sp = (l.baby ? CFG.baby.speed : CFG.leech.speed) * (frenzy && !l.baby ? CFG.frenzy.speed : 1);
                if (target) {
                    moveAlly(l, target.x, target.y, sp, ts);
                    if (getDist(l, target) < target.radius + l.radius + 3) attach(l, target, cnt);
                } else if (getDist(l, player) > 90) moveAlly(l, player.x, player.y, sp * 0.8, ts);
                resolveAlly(l);
            }
        });

        // şifa yazısı (toplu)
        healT += ts;
        if (healT >= 60) { if (healAcc >= 20) addFloatingNumber(player.x, player.y, '+' + Math.floor(healAcc), '#2ecc71'); healAcc = 0; healT = 0; }

        // Kraliçe
        if (queen) {
            const Q = CFG.queen;
            queen.life -= ts; queen.birth += ts;
            if (getDist(queen, player) > Q.followDist) moveAlly(queen, player.x, player.y, Q.speed, ts);
            resolveAlly(queen);
            const babies = leeches.filter(l => l.baby).length;
            if (queen.birth >= Q.birthEvery && babies < CFG.baby.max && enemies.length) {
                queen.birth = 0; leeches.push(mkLeech(queen.x, queen.y, true));
                spawnParticles(queen.x, queen.y, '#ff9ff3', 'normal');
            }
        }

        // düşman mermileri: uçan sülükleri ve Kraliçe'yi vurur
        const targets = leeches.filter(l => !l.host && l.drop <= 0);
        if (queen) targets.push(queen);
        for (let bi = botBullets.length - 1; bi >= 0; bi--) {
            const b = botBullets[bi];
            for (const a of targets) {
                if (getDist(b, a) >= a.radius + 10) continue;
                if (b.type === 'boomerang') {
                    b.hitTargets = b.hitTargets || [];
                    if (b.hitTargets.includes(a)) continue;
                    b.hitTargets.push(a);
                }
                const dmg = bulletDmg(b);
                a.hp -= dmg; addFloatingNumber(a.x, a.y, dmg, '#e74c3c');
                if (b.type !== 'boomerang') { botBullets.splice(bi, 1); break; }
            }
        }

        // ömür / ölüm
        for (let i = leeches.length - 1; i >= 0; i--) {
            const l = leeches[i];
            if (l.life <= 0 || l.hp <= 0) { spawnParticles(l.x, l.y, '#e84393', 'normal'); leeches.splice(i, 1); }
        }
        if (queen && (queen.life <= 0 || queen.hp <= 0)) { spawnParticles(queen.x, queen.y, '#b33771', 'smoke'); screenShake = Math.max(screenShake, 6); queen = null; }
        for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= ts; if (rings[i].life <= 0) rings.splice(i, 1); }
    }

    // ---- Çizim ----
    function bar(x, y, w, f, col) {
        ctx.fillStyle = '#444'; ctx.fillRect(x - w / 2, y, w, 4);
        ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, Math.max(0, f) * w, 4);
    }
    function drawLeech(l) {
        const t = Date.now();
        const col = l.baby ? '#ff9ff3' : ['#e84393', '#d63031', '#7b1e1e'][l.stage - 1];
        ctx.save(); ctx.translate(l.x, l.y);
        if (l.drop > 0) { const k = l.drop / 8; ctx.translate(0, -k * 30); ctx.scale(1 + k * 0.6, 1 + k * 0.6); }
        if (!l.baby && l.life < 120 && Math.floor(t / 100) % 2) ctx.globalAlpha = 0.45;
        ctx.rotate(l.fa || 0);
        const r = l.radius, wig = Math.sin(t / (l.baby ? 60 : 90) + l.wig) * r * 0.35;
        ctx.fillStyle = col; ctx.strokeStyle = '#3b0a1e'; ctx.lineWidth = 2;
        [[r * 0.6, 0, r], [-r * 0.4, wig * 0.5, r * 0.85], [-r * 1.3, wig, r * 0.6]].forEach(c => {
            ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        });
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * 1.0, -r * 0.35, r * 0.2, 0, Math.PI * 2); ctx.arc(r * 1.0, r * 0.35, r * 0.2, 0, Math.PI * 2); ctx.fill();
        if (frenzyT > 0 && !l.baby) { ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,71,87,0.7)'; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.restore();
        if (!l.host && !l.baby && l.drop <= 0) bar(l.x, l.y - l.radius - 10, 24, l.hp / l.maxHp, '#e84393');
    }
    function drawQueen(q) {
        ctx.save(); ctx.translate(q.x, q.y);
        if (q.life < 120 && Math.floor(Date.now() / 100) % 2) ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.ellipse(0, 0, q.radius * 1.15, q.radius, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#6c1d45'; ctx.fill(); ctx.strokeStyle = '#ff9ff3'; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = '#b33771';
        [[-10, -8, 6], [8, -4, 5], [-2, 10, 7], [14, 9, 4]].forEach(s => { ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, Math.PI * 2); ctx.fill(); });
        ctx.beginPath(); ctx.moveTo(-12, -q.radius + 2); ctx.lineTo(-6, -q.radius - 10); ctx.lineTo(0, -q.radius + 1); ctx.lineTo(6, -q.radius - 10); ctx.lineTo(12, -q.radius + 2);
        ctx.strokeStyle = '#f9ca24'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
        bar(q.x, q.y - q.radius - 18, 70, q.hp / q.maxHp, '#ff9ff3');
        bar(q.x, q.y - q.radius - 12, 70, q.life / CFG.queen.life, '#f9ca24');
    }
    function draw() {
        ctx.save();
        rings.forEach(r => {
            const k = 1 - r.life / r.maxLife;
            ctx.save(); ctx.strokeStyle = 'rgba(232,67,147,' + (1 - k) + ')'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.r + (r.max - r.r) * k, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        });
        leeches.forEach(drawLeech);
        if (queen) drawQueen(queen);
        // kan hırsı: oyuncu çevresinde kırmızı halka
        if (frenzyT > 0 && !player.isDead) {
            ctx.save(); ctx.globalAlpha = 0.6 * clamp01(frenzyT / 30);
            ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 8 + Math.sin(Date.now() / 100) * 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
            ctx.save(); ctx.fillStyle = '#ff4757'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
            ctx.fillText('KAN HIRSI ' + Math.ceil(frenzyT / 60) + 's', canvas.width / 2, 66); ctx.restore();
        }
        // sülük çağırma önizlemesi: hangi düşmana gidecek?
        if (aimData.active && player.ammo >= 1 && !player.isDead) {
            const p = spawnPoint(aimData.angle, summonPull(), CFG.leech.radius[0]);
            const h = pickHost(p, getActiveEnemies(), hostCounts());
            ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(232,67,147,0.7)';
            ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
            ctx.beginPath(); ctx.arc(p.x, p.y, CFG.leech.radius[0], 0, Math.PI * 2); ctx.fillStyle = 'rgba(232,67,147,0.3)'; ctx.fill(); ctx.stroke();
            if (h) { ctx.beginPath(); ctx.arc(h.x, h.y, h.radius + 8, 0, Math.PI * 2); ctx.stroke(); }
            ctx.restore();
        }
        // Kraliçe önizlemesi
        if (ultAim.active && player.ultReady && !player.isDead) {
            const p = freeSpot(player.x + Math.cos(ultAim.angle) * 110, player.y + Math.sin(ultAim.angle) * 110, CFG.queen.radius);
            ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, CFG.queen.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(179,55,119,0.3)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,159,243,0.8)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
        }
        ctx.restore();
    }

    // ---- Arayüz kurulumu (oyun başlayınca) ----
    function clearState() { leeches = []; queen = null; frenzyT = 0; healAcc = 0; healT = 0; rings = []; }
    function setupUI() {
        if (player.charType !== ID) return;
        ultiBtn.style.display = 'flex'; gadgetBtn.style.display = 'flex'; gadgetBtn2.style.display = 'flex';
        gadgetBtn.innerHTML = 'KULUÇKA<br><span id="gadget-timer"></span>';
        gadgetBtn2.innerHTML = 'KAN<br>HIRSI<br><span id="gadget-timer-2"></span>';
        gadgetTimerText = document.getElementById('gadget-timer');
        gadgetTimerText2 = document.getElementById('gadget-timer-2');
        clearState();
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    // Kendi döngüm: ana döngüden sonra çalışır, başka mod dosyalarının hook'larını ezmez
    function loop(t) {
        requestAnimationFrame(loop);
        const ts = Math.min(3, (t - lastT) / 16.666); lastT = t;
        if (!gameStarted) { wasStarted = false; clearState(); return; }
        if (!wasStarted) { wasStarted = true; setupUI(); }
        if (player.charType !== ID) { clearState(); return; }
        update(ts); draw();
    }
    requestAnimationFrame(loop);

    // ---- Karakter kartı ----
    (function addCard() {
        const box = document.querySelector('.char-select-container');
        if (!box || document.getElementById('char-' + ID)) return;
        const card = document.createElement('div');
        card.className = 'char-card'; card.id = 'char-' + ID;
        card.innerHTML = '<div class="char-color-preview" style="background:#b33771;"></div><span>Asalak</span><small>Hasar: Sülükler<br>Güç: Kraliçe</small>';
        card.addEventListener('click', () => {
            selectedCharacter = ID;
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
        box.appendChild(card);
    })();
})();
