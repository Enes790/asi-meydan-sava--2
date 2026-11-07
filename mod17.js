// ============================================================================
// mod30.js - "Çağrı" karakteri (çağırıcı)
// Ana dosyaya dokunmaz. index.html'de TÜM mod script'lerinden SONRA eklenmeli:
//   <script src="mod30.js"></script>
//
// Çağrı kendisi HİÇ hasar vermez (mermi yok, alan yok, temas yok). Tüm hasarı
// çağırdığı yaratıklar verir.
//  - Ana saldırı: Sağ joystick'i çek-bırak -> nişan yönünde, çektiğin mesafede
//    bir ÇIRAK doğar (1 cephane harcar). Aynı anda en fazla 3 çırak; 4.'yü
//    çağırırsan en eskisi kaybolur. Çıraklar en yakın düşmana koşar ve vurur.
//    Siperlerin, kaktüs duvarlarının ve arena duvarlarının üstünden geçemezler.
//  - Özgün mekanik - BAĞ HATTI: birbirine 340 birimden yakın iki yardımcı
//    arasında enerji hattı oluşur. Hattan geçen düşman hasar alır, hattı
//    kesen düşman mermileri yok olur. Konumlandırma oyunu!
//  - Yetenek 1 (YER DEĞİŞ): Nişan yönündeki yardımcıyla yer değiştirirsin
//    (kısa süre dokunulmaz).
//  - Yetenek 2 (FEDA ET): Nişan yönündeki çırağı patlatır; düşmanlara hasar
//    verir ve seni iyileştirir.
//  - Güç (TİTAN): Bar zamanla ve yardımcıların vuruşlarıyla dolar. Dolunca dev
//    bir Titan çağırır (aynı anda 1 tane). Yer sarsıp alan hasarı verir.
//  - Düşman mermileri yardımcılara da isabet eder (siper görevi görürler).
// ============================================================================
(function () {
    'use strict';
    const ID = 'cagri';
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const clamp01 = v => Math.max(0, Math.min(1, v));

    window.GAME_EXT = window.GAME_EXT || { characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {} };
    window.GAME_EXT.characters[ID] = { color: '#55efc4', hp: 3400, speed: 3.4 };

    // ---- Denge ayarları (buradan oynayabilirsin) ----
    const CFG = {
        maxMinions: 3,
        m: { radius: 14, hp: 700, speed: 3.1, life: 900, dmg: 150, atkEvery: 40, chargeHit: 0.6 },
        t: { radius: 36, hp: 4000, speed: 1.7, life: 720, slamR: 130, slamDmg: 450, slamEvery: 75, kb: 9 },
        link: { max: 340, dmg: 45, every: 20, chargeTick: 0.3 },
        passive: 0.03,                       // kare başına bar dolumu
        g1: { cd: 600, inv: 24 },
        g2: { cd: 720, r: 130, dmg: 600, heal: 350, kb: 8 }
    };

    let minions = [], titan = null, lastT = 0, wasStarted = false, linkT = 0, swapInv = 0;

    const blockers = () => obstacles.concat(cactusWalls || []);
    const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

    // ---- Güç şarjı: ana oyunun şarjı bu karakter için kapalı, kendi barımız var ----
    const prevCharge = window.chargeUlti;
    window.chargeUlti = function () {
        if (player.charType === ID) return;
        return prevCharge.apply(this, arguments);
    };
    function charge(n) {
        if (!gameStarted || player.charType !== ID || player.ultReady || titan) return;
        player.ultCharge = Math.min(100, player.ultCharge + n);
        ultFill.style.width = player.ultCharge + '%';
        if (player.ultCharge >= 100) {
            player.ultReady = true; ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, 'TİTAN HAZIR!', '#55efc4');
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

    // ---- Ateş = çırak çağır ----
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== ID) return origFire.call(this, a, pullOverride);
        const p = spawnPoint(a, pullOverride !== undefined ? clamp01(pullOverride) : summonPull(), CFG.m.radius);
        if (minions.length >= CFG.maxMinions) {
            const old = minions.shift();
            spawnParticles(old.x, old.y, '#55efc4', 'smoke');
        }
        minions.push({ x: p.x, y: p.y, radius: CFG.m.radius, hp: CFG.m.hp, maxHp: CFG.m.hp, life: CFG.m.life,
                       age: 0, spawnT: 0, atk: 15, lunge: 0, face: a });
        spawnParticles(p.x, p.y, '#55efc4', 'normal');
        this.consumeAmmo();
    };

    // ---- Yetenekler ----
    function pickAlly(angle, includeTitan) {
        const list = includeTitan && titan ? minions.concat([titan]) : minions;
        let best = null, bd = 1e9;
        const ang = angle !== undefined ? angle : player.angle;
        for (const a of list) {
            if (getDist(player, a) < 1) continue;
            const diff = Math.abs(angDiff(getAngle(player, a), ang));
            if (diff < bd) { bd = diff; best = a; }
        }
        return best;
    }

    const origG1 = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== ID) return origG1.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        const ally = pickAlly(a, true);
        if (!ally) { addFloatingNumber(this.x, this.y - 30, 'YARDIMCI YOK!', '#e74c3c'); return; }
        const px = this.x, py = this.y;
        spawnParticles(px, py, '#55efc4', 'smoke'); spawnParticles(ally.x, ally.y, '#55efc4', 'smoke');
        this.x = ally.x; this.y = ally.y; ally.x = px; ally.y = py;
        this.jumpInvulnerable = true; swapInv = CFG.g1.inv;
        addFloatingNumber(this.x, this.y - 30, 'YER DEĞİŞTİ!', '#55efc4');
        this.setCooldown(); this.gadgetCooldown = CFG.g1.cd;
    };

    const origG2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== ID) return origG2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        const ally = pickAlly(a, false);
        if (!ally) { addFloatingNumber(this.x, this.y - 30, 'ÇIRAK YOK!', '#e74c3c'); return; }
        const G = CFG.g2;
        getActiveEnemies().forEach(e => {
            if (e.hp <= 0 || getDist(ally, e) >= G.r + e.radius) return;
            e.hp -= G.dmg; addFloatingNumber(e.x, e.y, G.dmg, '#55efc4');
            if (!e.isNest) { const ang = getAngle(ally, e); e.kbX = (e.kbX || 0) + Math.cos(ang) * G.kb; e.kbY = (e.kbY || 0) + Math.sin(ang) * G.kb; }
        });
        explosions.push({ x: ally.x, y: ally.y, radius: 0, maxRadius: G.r, life: 14, maxLife: 14 });
        spawnParticles(ally.x, ally.y, '#55efc4', 'normal'); screenShake = Math.max(screenShake, 8);
        minions.splice(minions.indexOf(ally), 1);
        this.hp = Math.min(this.maxHp, this.hp + G.heal);
        addFloatingNumber(this.x, this.y, '+' + G.heal, '#2ecc71');
        this.gadget2Ready = false; this.gadget2Cooldown = G.cd; gadgetBtn2.classList.add('cooldown');
    };

    const origUlt = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== ID) return origUlt.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;
        if (titan) { addFloatingNumber(this.x, this.y - 40, 'TİTAN ZATEN VAR!', '#e74c3c'); return; }
        const p = freeSpot(this.x + Math.cos(a) * 110, this.y + Math.sin(a) * 110, CFG.t.radius);
        titan = { x: p.x, y: p.y, radius: CFG.t.radius, hp: CFG.t.hp, maxHp: CFG.t.hp, life: CFG.t.life,
                  age: 0, spawnT: 0, slam: 20, slamAnim: 0, face: a, isTitan: true };
        spawnParticles(p.x, p.y, '#55efc4', 'smoke'); screenShake = Math.max(screenShake, 10);
        addFloatingNumber(this.x, this.y - 40, 'TİTAN!', '#55efc4');
        this.ultReady = false; this.ultCharge = 0; ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    };

    // ---- Yardımcı hareketi (siperlerden dolanır) ----
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

    function segDist(px, py, ax, ay, bx, by) {
        const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
        let t = l2 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0; t = cl(t, 0, 1);
        return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
    }
    const bulletDmg = b => {
        const easy = window.GAME_DIFFICULTY === 'easy';
        if (b.type === 'stationary_bot_bullet') return easy ? 300 : 350;
        if (b.type === 'boomerang') return easy ? 200 : 250;
        return easy ? 480 : 500;
    };

    // ---- Güncelleme ----
    function update(ts) {
        if (swapInv > 0) { swapInv -= ts; if (swapInv <= 0 && !player.isJumping) player.jumpInvulnerable = false; }
        charge(CFG.passive * ts);

        const enemies = getActiveEnemies();

        for (const m of minions) {
            m.age += ts; m.life -= ts; m.spawnT = Math.min(1, m.age / 12);
            const t = nearestEnemy(m, enemies);
            if (t) {
                const d = getDist(m, t);
                m.face = getAngle(m, t);
                if (d > m.radius + t.radius + 6) moveAlly(m, t.x, t.y, CFG.m.speed, ts);
                else {
                    m.atk -= ts;
                    if (m.atk <= 0) {
                        m.atk = CFG.m.atkEvery; m.lunge = 8;
                        t.hp -= CFG.m.dmg; addFloatingNumber(t.x, t.y, CFG.m.dmg, '#55efc4');
                        charge(CFG.m.chargeHit);
                    }
                }
            } else if (getDist(m, player) > 110) moveAlly(m, player.x, player.y, CFG.m.speed * 0.8, ts);
            if (m.lunge > 0) m.lunge -= ts;
        }

        if (titan) {
            const T = titan, C = CFG.t;
            T.age += ts; T.life -= ts; T.spawnT = Math.min(1, T.age / 20);
            const t = nearestEnemy(T, enemies);
            if (t) {
                const d = getDist(T, t);
                T.face = getAngle(T, t);
                if (d > T.radius + t.radius + 40) moveAlly(T, t.x, t.y, C.speed, ts);
                else {
                    T.slam -= ts;
                    if (T.slam <= 0) {
                        T.slam = C.slamEvery; T.slamAnim = 12;
                        enemies.forEach(e => {
                            if (e.hp <= 0 || getDist(T, e) >= C.slamR + e.radius) return;
                            e.hp -= C.slamDmg; addFloatingNumber(e.x, e.y, C.slamDmg, '#00b894');
                            if (!e.isNest) { const ang = getAngle(T, e); e.kbX = (e.kbX || 0) + Math.cos(ang) * C.kb; e.kbY = (e.kbY || 0) + Math.sin(ang) * C.kb; }
                        });
                        obstacles.forEach(o => { if (getDist(T, o) < C.slamR + o.radius) o.hp -= 250; });
                        explosions.push({ x: T.x, y: T.y, radius: 0, maxRadius: C.slamR, life: 14, maxLife: 14 });
                        spawnParticles(T.x, T.y, '#00b894', 'smoke'); screenShake = Math.max(screenShake, 8);
                    }
                }
            } else if (getDist(T, player) > 130) moveAlly(T, player.x, player.y, C.speed * 0.8, ts);
            if (T.slamAnim > 0) T.slamAnim -= ts;
        }

        // yardımcılar birbirinin içine girmesin
        const all = titan ? minions.concat([titan]) : minions;
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
            const a = all[i], b = all[j], d = getDist(a, b) || 0.001, ov = a.radius + b.radius - d;
            if (ov <= 0) continue;
            const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
            if (a.isTitan) { b.x += nx * ov; b.y += ny * ov; }
            else if (b.isTitan) { a.x -= nx * ov; a.y -= ny * ov; }
            else { a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2; }
        }
        all.forEach(resolveAlly);

        // düşman mermileri yardımcılara isabet eder
        for (let bi = botBullets.length - 1; bi >= 0; bi--) {
            const b = botBullets[bi];
            for (const a of all) {
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

        // BAĞ HATTI: yakın yardımcılar arasında enerji hattı
        linkT += ts;
        const doTick = linkT >= CFG.link.every; if (doTick) linkT = 0;
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
            const a = all[i], b = all[j];
            if (getDist(a, b) > CFG.link.max) continue;
            for (let bi = botBullets.length - 1; bi >= 0; bi--) {
                const bl = botBullets[bi];
                if (segDist(bl.x, bl.y, a.x, a.y, b.x, b.y) < 9) { spawnParticles(bl.x, bl.y, '#55efc4', 'normal'); botBullets.splice(bi, 1); }
            }
            if (doTick) enemies.forEach(e => {
                if (e.hp <= 0 || segDist(e.x, e.y, a.x, a.y, b.x, b.y) >= e.radius + 4) return;
                e.hp -= CFG.link.dmg; addFloatingNumber(e.x, e.y, CFG.link.dmg, '#55efc4'); charge(CFG.link.chargeTick);
            });
        }

        // ömür / ölüm
        for (let i = minions.length - 1; i >= 0; i--) {
            const m = minions[i];
            if (m.life <= 0 || m.hp <= 0) { spawnParticles(m.x, m.y, '#55efc4', 'smoke'); minions.splice(i, 1); }
        }
        if (titan && (titan.life <= 0 || titan.hp <= 0)) {
            spawnParticles(titan.x, titan.y, '#00b894', 'smoke'); screenShake = Math.max(screenShake, 8); titan = null;
        }
    }

    // ---- Çizim ----
    function drawBar(x, y, w, frac, col) {
        ctx.fillStyle = '#444'; ctx.fillRect(x - w / 2, y, w, 4);
        ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, Math.max(0, frac) * w, 4);
    }
    function drawMinion(m) {
        ctx.save(); ctx.translate(m.x, m.y);
        if (m.life < 120 && Math.floor(Date.now() / 100) % 2) ctx.globalAlpha = 0.4;
        ctx.scale(m.spawnT, m.spawnT);
        ctx.beginPath(); ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#55efc4'; ctx.fill(); ctx.strokeStyle = '#00b894'; ctx.lineWidth = 3; ctx.stroke();
        ctx.rotate(m.face || 0);
        ctx.beginPath(); ctx.arc(m.radius * 0.45, 0, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#2d3436'; ctx.fill();
        if (m.lunge > 0) { ctx.beginPath(); ctx.arc(m.radius + 4, 0, 6 + m.lunge, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.restore();
        drawBar(m.x, m.y - m.radius - 10, 28, m.hp / m.maxHp, '#55efc4');
    }
    function drawTitan(T) {
        ctx.save(); ctx.translate(T.x, T.y); ctx.scale(T.spawnT, T.spawnT);
        if (T.life < 120 && Math.floor(Date.now() / 100) % 2) ctx.globalAlpha = 0.5;
        ctx.beginPath();
        for (let j = 0; j < 16; j++) {
            const a = j * Math.PI / 8, r = j % 2 === 0 ? T.radius : T.radius - 7;
            if (j === 0) ctx.moveTo(r, 0); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fillStyle = '#00b894'; ctx.fill(); ctx.strokeStyle = '#006266'; ctx.lineWidth = 4; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, T.radius * 0.55, 0, Math.PI * 2); ctx.fillStyle = '#019875'; ctx.fill();
        ctx.rotate(T.face || 0);
        ctx.fillStyle = '#dff9f1'; ctx.beginPath(); ctx.arc(T.radius * 0.3, -7, 4, 0, Math.PI * 2); ctx.arc(T.radius * 0.3, 7, 4, 0, Math.PI * 2); ctx.fill();
        if (T.slamAnim > 0) { ctx.beginPath(); ctx.arc(0, 0, T.radius + 8 + (12 - T.slamAnim) * 4, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.stroke(); }
        ctx.restore();
        drawBar(T.x, T.y - T.radius - 14, 70, T.hp / T.maxHp, '#55efc4');
        drawBar(T.x, T.y - T.radius - 8, 70, T.life / CFG.t.life, '#f1c40f');
    }
    function draw() {
        ctx.save();
        const all = titan ? minions.concat([titan]) : minions;
        // bağ hatları
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
            const a = all[i], b = all[j], d = getDist(a, b);
            if (d > CFG.link.max) continue;
            ctx.save();
            ctx.globalAlpha = 0.35 + 0.45 * (1 - d / CFG.link.max);
            ctx.strokeStyle = '#55efc4'; ctx.lineWidth = 3; ctx.shadowColor = '#55efc4'; ctx.shadowBlur = 12;
            ctx.setLineDash([14, 8]); ctx.lineDashOffset = -Date.now() / 30;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
        }
        minions.forEach(drawMinion);
        if (titan) drawTitan(titan);

        // çağırma önizlemesi
        if (aimData.active && player.ammo >= 1 && !player.isDead) {
            const p = spawnPoint(aimData.angle, summonPull(), CFG.m.radius);
            ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(85,239,196,0.6)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(p.x, p.y); ctx.stroke();
            ctx.setLineDash([]); ctx.beginPath(); ctx.arc(p.x, p.y, CFG.m.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(85,239,196,0.3)'; ctx.fill(); ctx.stroke(); ctx.restore();
        }
        // titan önizlemesi
        if (ultAim.active && player.ultReady && !player.isDead) {
            const p = freeSpot(player.x + Math.cos(ultAim.angle) * 110, player.y + Math.sin(ultAim.angle) * 110, CFG.t.radius);
            ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, CFG.t.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(85,239,196,0.25)'; ctx.fill();
            ctx.strokeStyle = 'rgba(85,239,196,0.7)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
        }
        // yetenek hedef vurgusu
        const mark = (ally, col) => { if (!ally) return; ctx.save(); ctx.beginPath(); ctx.arc(ally.x, ally.y, ally.radius + 8, 0, Math.PI * 2); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); };
        if (gadAim.active && player.gadgetReady && !player.isDead) mark(pickAlly(gadAim.angle, true), '#f1c40f');
        if (gadAim2.active && player.gadget2Ready && !player.isDead) {
            const t = pickAlly(gadAim2.angle, false); mark(t, '#e74c3c');
            if (t) { ctx.save(); ctx.beginPath(); ctx.arc(t.x, t.y, CFG.g2.r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(231,76,60,0.12)'; ctx.fill(); ctx.restore(); }
        }
        ctx.restore();
    }

    // ---- Arayüz kurulumu (oyun başlayınca) ----
    function setupUI() {
        if (player.charType !== ID) return;
        ultiBtn.style.display = 'flex'; gadgetBtn.style.display = 'flex'; gadgetBtn2.style.display = 'flex';
        gadgetBtn.innerHTML = 'YER<br>DEĞİŞ<br><span id="gadget-timer"></span>';
        gadgetBtn2.innerHTML = 'FEDA<br>ET<br><span id="gadget-timer-2"></span>';
        gadgetTimerText = document.getElementById('gadget-timer');
        gadgetTimerText2 = document.getElementById('gadget-timer-2');
        minions = []; titan = null; linkT = 0; swapInv = 0;
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    // Kendi döngüm: ana döngüden sonra çalışır, başka mod dosyalarının hook'larını ezmez
    function loop(t) {
        requestAnimationFrame(loop);
        const ts = Math.min(3, (t - lastT) / 16.666); lastT = t;
        if (!gameStarted) { wasStarted = false; minions = []; titan = null; return; }
        if (!wasStarted) { wasStarted = true; setupUI(); }
        if (player.charType !== ID) { minions = []; titan = null; return; }
        update(ts); draw();
    }
    requestAnimationFrame(loop);

    // ---- Karakter kartı ----
    (function addCard() {
        const box = document.querySelector('.char-select-container');
        if (!box || document.getElementById('char-' + ID)) return;
        const card = document.createElement('div');
        card.className = 'char-card'; card.id = 'char-' + ID;
        card.innerHTML = '<div class="char-color-preview" style="background:#55efc4;"></div><span>Çağrı</span><small>Hasar: Çıraklar<br>Güç: Titan</small>';
        card.addEventListener('click', () => {
            selectedCharacter = ID;
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
        box.appendChild(card);
    })();
})();
