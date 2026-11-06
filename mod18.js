// ============================================================================
// mod29.js - "Çığ" karakteri
// Ana dosyaya dokunmaz. index.html'de TÜM mod script'lerinden SONRA eklenmeli:
//   <script src="mod29.js"></script>
//
// Çığ:
//  - Mermi (Çığ Topu): gittikçe büyür. Büyüdükçe hasarı artar (350 -> 1500).
//    Yol boyunca çevresindeki düşmanları hafifçe iter ve küçük alan hasarı verir
//    (menzil 12 -> 30, tik hasarı 6 -> 30).
//  - Yetenek 1 (HAZIRLIK): Sonraki mermi yarı büyük başlar ve daha hızlı gider.
//  - Yetenek 2 (BÜYÜTME HALKASI): Hedefe halka koyar. İçinden geçen mermiler
//    büyür, içindeki oyuncu iyileşir.
//  - Güç (DEV ÇIĞ): Dev, yavaş çığ. Delip geçer, düşmanları ezip iter, engelleri
//    parçalar, sonunda patlar. Duvara çarpan düşman "DUVAR STUN" yer.
// ============================================================================
(function () {
    'use strict';
    const ID = 'cig';
    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp01 = v => Math.max(0, Math.min(1, v));

    window.GAME_EXT = window.GAME_EXT || { characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {} };
    window.GAME_EXT.characters[ID] = { color: '#74b9ff', hp: 3400, speed: 3.3 };

    // ---- Denge ayarları (buradan oynayabilirsin) ----
    const CFG = {
        normal: { range: RANGE, speed: PLAYER_BULLET_SPEED * 0.85, rMin: 8, rMax: 34, dmgMin: 350, dmgMax: 1500 },
        ult:    { range: RANGE * 1.7, speed: PLAYER_BULLET_SPEED * 0.55, rMin: 24, rMax: 90, dmgMin: 700, dmgMax: 2200, endDmg: 800, endRadius: 150 },
        auraMin: 12, auraMax: 30,      // yol boyu itme menzili (maks 30)
        tickMin: 6, tickMax: 30,       // yol boyu alan hasarı (maks 30)
        tickEvery: 15,                 // kare
        splashFrac: 0.35,              // isabette çevreye giden hasar oranı
        endFrac: 0.4,                  // menzil sonunda / duvarda patlama hasar oranı
        g1: { cd: 600, bonus: 0.45, speedMul: 1.2 },
        g2: { cd: 900, radius: 95, life: 420, bonus: 0.3, heal: 2 }
    };

    let shots = [], ring = null, lastT = 0, wasStarted = false;
    const growth = s => clamp01(s.dist / s.range + s.bonus);

    // ---- Güç şarjı: ana oyunun şarj sistemi bu karakter için kapatılır ----
    const origCharge = window.chargeUlti;
    window.chargeUlti = function () {
        if (player.charType === ID) return;
        return origCharge.apply(this, arguments);
    };
    function cigCharge(n) {
        if (!gameStarted || player.charType !== ID || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + n);
        ultFill.style.width = player.ultCharge + '%';
        if (player.ultCharge >= 100) {
            player.ultReady = true; ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, 'DEV ÇIĞ HAZIR!', '#74b9ff');
        }
    }

    function mkShot(x, y, a, speed, range, bonus, ult) {
        return { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, ang: a, speed, range, bonus,
                 ult, hit: new Set(), rings: new Set(), dist: 0, tick: 0, g: 0, r: 8, aura: 12 };
    }

    // ---- Ateş / yetenekler ----
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== ID) return origFire.call(this, a, pull);
        const primed = this.cigPrimed; this.cigPrimed = false;
        const C = CFG.normal;
        shots.push(mkShot(this.x, this.y, a, C.speed * (primed ? CFG.g1.speedMul : 1), C.range, primed ? CFG.g1.bonus : 0, false));
        this.consumeAmmo();
    };

    const origG1 = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== ID) return origG1.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        this.cigPrimed = true;
        addFloatingNumber(this.x, this.y - 30, 'ÇIĞ HAZIR!', '#74b9ff');
        this.setCooldown(); this.gadgetCooldown = CFG.g1.cd;
    };

    const origG2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== ID) return origG2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        const ang = a !== undefined ? a : this.angle;
        const p = pull !== undefined ? clamp01(pull) : 1;
        const dist = Math.max(60, RANGE * 0.7 * p), pad = WALL_THICKNESS + 40;
        const tx = Math.max(pad, Math.min(canvas.width - pad, this.x + Math.cos(ang) * dist));
        const ty = Math.max(pad, Math.min(canvas.height - pad, this.y + Math.sin(ang) * dist));
        ring = { x: tx, y: ty, radius: CFG.g2.radius, life: CFG.g2.life, healAcc: 0 };
        spawnParticles(tx, ty, '#74b9ff', 'normal');
        addFloatingNumber(tx, ty, 'BÜYÜTME HALKASI!', '#74b9ff');
        this.gadget2Ready = false; this.gadget2Cooldown = CFG.g2.cd; gadgetBtn2.classList.add('cooldown');
    };

    const origUlt = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== ID) return origUlt.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;
        const U = CFG.ult;
        shots.push(mkShot(this.x, this.y, a, U.speed, U.range, 0, true));
        addFloatingNumber(this.x, this.y - 40, 'DEV ÇIĞ!', '#74b9ff');
        this.ultReady = false; this.ultCharge = 0; ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    };

    // ---- Patlama ----
    function burst(x, y, radius, dmg, skip) {
        getActiveEnemies().forEach(e => {
            if (e === skip || e.hp <= 0) return;
            if (getDist({ x, y }, e) < radius + e.radius) { e.hp -= dmg; addFloatingNumber(e.x, e.y, dmg, '#74b9ff'); }
        });
        explosions.push({ x, y, radius: 0, maxRadius: radius, life: 14, maxLife: 14 });
        spawnParticles(x, y, '#74b9ff', 'normal');
    }

    // ---- Güncelleme ----
    function updateShots(ts) {
        const enemies = getActiveEnemies();
        for (let i = shots.length - 1; i >= 0; i--) {
            const s = shots[i], C = s.ult ? CFG.ult : CFG.normal;
            s.x += s.vx * ts; s.y += s.vy * ts; s.dist += s.speed * ts;

            if (ring && !s.rings.has(ring) && getDist(s, ring) < ring.radius) {
                s.rings.add(ring); s.bonus += CFG.g2.bonus;
                spawnParticles(s.x, s.y, '#74b9ff', 'normal');
                addFloatingNumber(s.x, s.y - 15, 'BÜYÜDÜ!', '#74b9ff');
            }
            const g = growth(s); s.g = g; s.r = lerp(C.rMin, C.rMax, g);
            s.aura = lerp(CFG.auraMin, CFG.auraMax, g);

            if (Math.random() < 0.6 * Math.min(1, ts)) {
                particles.push({ x: s.x + (Math.random() - .5) * s.r, y: s.y + (Math.random() - .5) * s.r,
                    vx: (Math.random() - .5) * 1.5, vy: (Math.random() - .5) * 1.5, life: 20, maxLife: 30,
                    color: '#dff6ff', size: 2 + s.r * 0.12, type: 'normal' });
            }

            const pad = WALL_THICKNESS + (s.ult ? s.r * 0.4 : 3);
            const hitWall = s.x < pad || s.x > canvas.width - pad || s.y < pad || s.y > canvas.height - pad;
            const ended = s.dist >= s.range;

            if (s.ult) {
                for (const o of obstacles) if (getDist(s, o) < o.radius + s.r) o.hp -= 30 * ts;
                for (const e of enemies) {
                    if (e.hp <= 0 || getDist(s, e) >= e.radius + s.r) continue;
                    if (!s.hit.has(e)) {
                        s.hit.add(e);
                        const dmg = Math.round(lerp(C.dmgMin, C.dmgMax, g));
                        e.hp -= dmg; addFloatingNumber(e.x, e.y, dmg, '#74b9ff');
                        if (!e.isNest) { const kb = 16 + 8 * g; e.kbX = (e.kbX || 0) + Math.cos(s.ang) * kb; e.kbY = (e.kbY || 0) + Math.sin(s.ang) * kb; }
                        screenShake = Math.max(screenShake, 6);
                    } else if (!e.isNest) {
                        e.x += Math.cos(s.ang) * (2 + 2 * g) * ts; e.y += Math.sin(s.ang) * (2 + 2 * g) * ts;
                    }
                }
                if (hitWall || ended) { burst(s.x, s.y, C.endRadius, C.endDmg); screenShake = 14; shots.splice(i, 1); }
                continue;
            }

            // normal Çığ Topu
            let direct = null, obs = null;
            for (const e of enemies) if (e.hp > 0 && getDist(s, e) < e.radius + s.r) { direct = e; break; }
            for (const o of obstacles) if (getDist(s, o) < o.radius + s.r * 0.8) { obs = o; break; }

            s.tick += ts;
            const doTick = s.tick >= CFG.tickEvery; if (doTick) s.tick = 0;
            for (const e of enemies) {
                if (e.hp <= 0) continue;
                const d = getDist(s, e);
                if (d < e.radius + s.r + s.aura) {
                    if (!e.isNest) {
                        const ax = (e.x - s.x) / (d || 1), ay = (e.y - s.y) / (d || 1);
                        const fx = ax * 0.6 + Math.cos(s.ang) * 0.4, fy = ay * 0.6 + Math.sin(s.ang) * 0.4;
                        const p = (0.8 + 1.4 * g) * ts; e.x += fx * p; e.y += fy * p;
                    }
                    if (doTick) {
                        const td = Math.round(lerp(CFG.tickMin, CFG.tickMax, g));
                        e.hp -= td; addFloatingNumber(e.x, e.y, td, '#a5d8ff'); cigCharge(0.6);
                    }
                }
            }

            const dmg = Math.round(lerp(C.dmgMin, C.dmgMax, g));
            if (direct) {
                direct.hp -= dmg; addFloatingNumber(direct.x, direct.y, dmg, '#74b9ff');
                if (!direct.isNest) { const kb = 4 + 10 * g; direct.kbX = (direct.kbX || 0) + Math.cos(s.ang) * kb; direct.kbY = (direct.kbY || 0) + Math.sin(s.ang) * kb; }
                burst(s.x, s.y, s.r + 40, Math.round(dmg * CFG.splashFrac), direct);
                cigCharge(6 + 14 * g); screenShake = Math.max(screenShake, 3 + 5 * g);
                shots.splice(i, 1); continue;
            }
            if (obs) {
                obs.hp -= Math.round(120 + 300 * g);
                burst(s.x, s.y, s.r + 30, Math.round(dmg * CFG.endFrac));
                shots.splice(i, 1); continue;
            }
            if (hitWall || ended) {
                burst(s.x, s.y, s.r + 30, Math.round(dmg * CFG.endFrac));
                shots.splice(i, 1);
            }
        }

        if (ring) {
            ring.life -= ts;
            if (ring.life <= 0) ring = null;
            else if (!player.isDead && getDist(player, ring) < ring.radius) {
                const h = CFG.g2.heal * ts;
                if (player.hp < player.maxHp) { player.hp = Math.min(player.maxHp, player.hp + h); ring.healAcc += h; }
                if (ring.healAcc >= 120) { addFloatingNumber(player.x, player.y, '+' + Math.floor(ring.healAcc), '#2ecc71'); ring.healAcc = 0; }
            }
        }
    }

    // ---- Çizim ----
    function draw() {
        ctx.save();
        if (ring) {
            const a = Math.min(1, ring.life / 60);
            ctx.save(); ctx.translate(ring.x, ring.y); ctx.globalAlpha = 0.5 * a;
            ctx.beginPath(); ctx.arc(0, 0, ring.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(116,185,255,0.18)'; ctx.fill();
            ctx.strokeStyle = '#74b9ff'; ctx.lineWidth = 3; ctx.stroke();
            ctx.rotate(Date.now() / 500); ctx.setLineDash([12, 14]);
            ctx.beginPath(); ctx.arc(0, 0, ring.radius - 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#dff6ff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        }
        if (player.cigPrimed && !player.isDead) {
            ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 6 + Math.sin(Date.now() / 120) * 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#74b9ff'; ctx.lineWidth = 3; ctx.stroke();
        }
        // nişan önizlemeleri
        if (aimData.active && player.ammo >= 1 && !player.isDead) {
            const C = CFG.normal, ex = player.x + Math.cos(aimData.angle) * C.range, ey = player.y + Math.sin(aimData.angle) * C.range;
            ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(116,185,255,0.6)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(ex, ey, C.rMax, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        if (ultAim.active && player.ultReady && !player.isDead) {
            const U = CFG.ult, a = ultAim.angle, nx = -Math.sin(a), ny = Math.cos(a);
            const ex = player.x + Math.cos(a) * U.range, ey = player.y + Math.sin(a) * U.range;
            ctx.beginPath();
            ctx.moveTo(player.x + nx * U.rMin, player.y + ny * U.rMin); ctx.lineTo(ex + nx * U.rMax, ey + ny * U.rMax);
            ctx.lineTo(ex - nx * U.rMax, ey - ny * U.rMax); ctx.lineTo(player.x - nx * U.rMin, player.y - ny * U.rMin);
            ctx.closePath(); ctx.fillStyle = 'rgba(116,185,255,0.18)'; ctx.fill();
            ctx.strokeStyle = 'rgba(116,185,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
        }
        if (gadAim2.active && player.gadget2Ready && !player.isDead) {
            const p = (gadAim2.pull === undefined || gadAim2.pull < 0.05) ? 1 : gadAim2.pull;
            const dist = Math.max(60, RANGE * 0.7 * p);
            const tx = player.x + Math.cos(gadAim2.angle) * dist, ty = player.y + Math.sin(gadAim2.angle) * dist;
            ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(116,185,255,0.6)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.setLineDash([]); ctx.beginPath(); ctx.arc(tx, ty, CFG.g2.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(116,185,255,0.15)'; ctx.fill(); ctx.stroke(); ctx.restore();
        }
        // mermiler
        shots.forEach(s => {
            ctx.save(); ctx.translate(s.x, s.y);
            if (!s.ult) {
                ctx.beginPath(); ctx.arc(0, 0, s.r + s.aura, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(165,216,255,0.25)'; ctx.lineWidth = 2; ctx.stroke();
            } else { ctx.shadowColor = '#74b9ff'; ctx.shadowBlur = 25; }
            const grad = ctx.createRadialGradient(-s.r * 0.3, -s.r * 0.3, s.r * 0.1, 0, 0, s.r);
            grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#74b9ff');
            ctx.beginPath(); ctx.arc(0, 0, s.r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
            ctx.strokeStyle = '#0984e3'; ctx.lineWidth = 3; ctx.stroke();
            ctx.shadowBlur = 0; ctx.rotate(Date.now() / 120); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
            for (let k = 0; k < 3; k++) {
                ctx.rotate(Math.PI * 2 / 3); ctx.beginPath();
                ctx.arc(0, 0, s.r * 0.6, 0, Math.PI / 3); ctx.stroke();
            }
            ctx.restore();
        });
        ctx.restore();
    }

    // ---- Arayüz kurulumu (oyun başlayınca) ----
    function setupUI() {
        if (player.charType !== ID) return;
        ultiBtn.style.display = 'flex'; gadgetBtn.style.display = 'flex'; gadgetBtn2.style.display = 'flex';
        gadgetBtn.innerHTML = 'HAZIRLIK<br><span id="gadget-timer"></span>';
        gadgetBtn2.innerHTML = 'BÜYÜTME<br>HALKASI<br><span id="gadget-timer-2"></span>';
        gadgetTimerText = document.getElementById('gadget-timer');
        gadgetTimerText2 = document.getElementById('gadget-timer-2');
        player.cigPrimed = false; shots = []; ring = null;
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    // Kendi döngüm: ana döngüden sonra çalışır, başka mod dosyalarının hook'larını ezmez
    function loop(t) {
        requestAnimationFrame(loop);
        const ts = Math.min(3, (t - lastT) / 16.666); lastT = t;
        if (!gameStarted) { wasStarted = false; shots = []; ring = null; return; }
        if (!wasStarted) { wasStarted = true; setupUI(); }
        if (player.charType !== ID) { shots = []; ring = null; return; }
        updateShots(ts); draw();
    }
    requestAnimationFrame(loop);

    // ---- Karakter kartı ----
    (function addCard() {
        const box = document.querySelector('.char-select-container');
        if (!box || document.getElementById('char-' + ID)) return;
        const card = document.createElement('div');
        card.className = 'char-card'; card.id = 'char-' + ID;
        card.innerHTML = '<div class="char-color-preview" style="background:#74b9ff;"></div><span>Çığ</span><small>Hasar: 350-1500<br>Güç: Dev Çığ</small>';
        card.addEventListener('click', () => {
            selectedCharacter = ID;
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
        box.appendChild(card);
        const st = document.createElement('style');
        st.textContent = '.char-card{width:calc(20% - 8px)!important;min-width:60px!important}';
        document.head.appendChild(st);
    })();
})();
