// ============================================================================
// KARAKTER: TUZAKÇI (mod5.js)
// ----------------------------------------------------------------------------
// Tema: av ve tuzak. Yansıma/gölge/zehir/hız gibi alışılmış temalar yok.
//
// NORMAL ATIŞ - Ok: düz giden tek ok, 1100 hasar. Kapana yakalanmış (köklenmiş)
//   hedefe %50 fazla vurur (1650) - aksesuarlarla birlikte oynamayı ödüllendirir.
// AKSESUAR 1 - Kapan: fırlatılan yere kurulur (en fazla 2 tane, 10 sn durur).
//   Bir düşman üstüne basınca kapanır: 500 hasar + 2 sn yerinden kıpırdayamaz.
// AKSESUAR 2 - Yem: atılan yerde 4 sn durur; 280 menzildeki botlar oyuncu yerine
//   YEMİ hedef alır (mermileri yemi vurur, slime'lar yeme çarpıp patlar).
//   Yemi kapanın yanına koyup düşmanları kapana çekmek asıl taktik.
// ULTİ - Büyük Ağ: seçilen yere 130 yarıçaplı ağ açılır, 5 sn durur. İçindeki
//   herkes köklenir ve saniyede 100 hasar alır. Ağdaki hedefe oklar %50 fazla vurur.
//
// Ağ hasarı ulti şarjı doldurmaz (ulti kendi kendini doldurmasın diye).
// ============================================================================

(function () {
    'use strict';
    console.log('[MOD YÜKLENDİ] tuzakci');

    const CHAR_ID = 'tuzakci';
    const CHAR_COLOR = '#2e86de';
    const CHAR_HP = 3200;
    const CHAR_SPEED = 3.5;

    // Normal atış
    const BOLT_DAMAGE = 1100;
    const BOLT_SPEED = PLAYER_BULLET_SPEED * 1.2;
    const BOLT_RANGE = RANGE;            // ana dosyadaki nişan çizgisiyle birebir uyuşsun
    const SNARED_BONUS = 1.5;

    // Aksesuar 1: Kapan
    const TRAP_COOLDOWN = 600;           // 10 sn
    const TRAP_THROW_RANGE = 0.8;
    const TRAP_MAX = 2;
    const TRAP_LIFE = 600;               // 10 sn
    const TRAP_ARM_TIME = 30;            // atıldıktan yarım sn sonra kurulur
    const TRAP_RADIUS = 34;
    const TRAP_DAMAGE = 500;
    const TRAP_ROOT = 120;               // 2 sn

    // Aksesuar 2: Yem
    const BAIT_COOLDOWN = 840;           // 14 sn
    const BAIT_THROW_RANGE = 0.7;
    const BAIT_LIFE = 240;               // 4 sn
    const BAIT_LURE_RADIUS = 280;
    const BAIT_RADIUS = 16;

    // Ulti: Büyük Ağ
    const NET_THROW_RANGE = 0.9;
    const NET_RADIUS = 130;
    const NET_LIFE = 300;                // 5 sn
    const NET_TICK_DAMAGE = 100;
    const NET_ROOT_REFRESH = 20;

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let tBolts = [];
    let tLobs = [];
    let traps = [];
    let nets = [];
    let bait = null;
    const snared = new Map();            // düşman -> {timer, origSpeed}
    let suppressCharge = false;

    // ---- Karakter kartı ----
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Tuzakçı</span>' +
            '<small>Hasar: 1100<br>Güç: Büyük Ağ</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            if (typeof prev === 'function') prev.apply(this, args);
            return fn.apply(this, args);
        };
    }

    // ---- Kök (kapan/ağ) yardımcıları ----
    function snareEnemy(e, frames) {
        let s = snared.get(e);
        if (!s) {
            s = { timer: 0, origSpeed: e.speed };
            snared.set(e, s);
            e.speed = 0;
        }
        s.timer = Math.max(s.timer, frames);
    }

    function releaseAll() {
        snared.forEach((s, e) => { e.speed = s.origSpeed; });
        snared.clear();
    }

    function resetState() {
        releaseAll();
        tBolts = []; tLobs = []; traps = []; nets = []; bait = null;
    }

    // ---- Hedef hesabı ----
    function aimTarget(angle, pull, rangeMul, minDist) {
        const p = (pull === undefined || pull < 0.05) ? 1 : Math.min(1, pull);
        const d = Math.max(minDist, RANGE * rangeMul * p);
        return {
            x: clampPos(player.x + Math.cos(angle) * d, WALL_THICKNESS + 25, canvas.width - WALL_THICKNESS - 25),
            y: clampPos(player.y + Math.sin(angle) * d, WALL_THICKNESS + 25, canvas.height - WALL_THICKNESS - 25)
        };
    }

    function launchLob(kind, t) {
        tLobs.push({
            kind, x: player.x, y: player.y, tx: t.x, ty: t.y,
            total: Math.hypot(t.x - player.x, t.y - player.y) || 1, progress: 0
        });
    }

    function landLob(l) {
        if (l.kind === 'trap') {
            traps.push({ x: l.tx, y: l.ty, life: TRAP_LIFE, arm: TRAP_ARM_TIME });
            if (traps.length > TRAP_MAX) traps.shift();
            spawnParticles(l.tx, l.ty, '#1abc9c', 'normal');
        } else if (l.kind === 'bait') {
            bait = { x: l.tx, y: l.ty, life: BAIT_LIFE, radius: BAIT_RADIUS, hp: 999999, maxHp: 999999 };
            spawnParticles(l.tx, l.ty, '#f39c12', 'normal');
        } else if (l.kind === 'net') {
            nets.push({ x: l.tx, y: l.ty, life: NET_LIFE, tick: 0 });
            spawnParticles(l.tx, l.ty, '#74b9ff', 'normal');
            screenShake = 6;
        }
    }

    // ---- Player override'ları ----
    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            resetState();
            gadgetBtn.innerHTML = 'KAPAN<br><span id="gadget-timer"></span>';
            gadgetBtn2.innerHTML = 'YEM<br><span id="gadget-timer-2"></span>';
            gadgetBtn.classList.remove('cooldown', 'active');
            gadgetBtn2.classList.remove('cooldown');
            this.ultReady = false;
            this.ultCharge = 0;
            if (ultFill) ultFill.style.width = '0%';
            if (ultiBtn) ultiBtn.classList.remove('ready');
        }
    };

    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        if (this.isDead || this.ammo < 1) return;
        tBolts.push({
            x: this.x, y: this.y, sx: this.x, sy: this.y,
            vx: Math.cos(a) * BOLT_SPEED, vy: Math.sin(a) * BOLT_SPEED, angle: a
        });
        this.consumeAmmo();
    };

    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        const angle = a !== undefined ? a : this.angle;
        launchLob('trap', aimTarget(angle, pull, TRAP_THROW_RANGE, 60));
        this.gadgetReady = false;
        this.gadgetCooldown = TRAP_COOLDOWN;
        gadgetBtn.classList.remove('active');
        gadgetBtn.classList.add('cooldown');
    };

    const originalActivateGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        const angle = a !== undefined ? a : this.angle;
        launchLob('bait', aimTarget(angle, pull, BAIT_THROW_RANGE, 60));
        this.gadget2Ready = false;
        this.gadget2Cooldown = BAIT_COOLDOWN;
        gadgetBtn2.classList.add('cooldown');
    };

    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;
        // ultiBtn ana dosyada mesafeyi iletmiyor, doğrudan ultAim.pull'dan okunuyor
        const p = (pull !== undefined) ? pull : (ultAim && ultAim.pull !== undefined ? ultAim.pull : 1);
        launchLob('net', aimTarget(a, p, NET_THROW_RANGE, 70));
        addFloatingNumber(this.x, this.y - 40, 'BÜYÜK AĞ!', CHAR_COLOR);
        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = '0%';
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    // Ulti şarjı: ana dosyanın listesi bu karakteri tanımıyor
    const originalChargeUlti = window.chargeUlti;
    window.chargeUlti = function (amount) {
        if (player.charType !== CHAR_ID) return originalChargeUlti(amount);
        if (!gameStarted || player.ultReady || suppressCharge) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount);
        if (player.ultCharge === 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, 'GÜÇ HAZIR!', '#f1c40f');
        }
        if (ultFill) ultFill.style.width = player.ultCharge + '%';
    };

    // ---- Yem: botların hedefini ve menzil hesabını yönlendirir ----
    const prevGetBotTarget = window.GAME_EXT.hooks.getBotTarget;
    window.GAME_EXT.hooks.getBotTarget = function (e) {
        if (bait && getDist(bait, e) < BAIT_LURE_RADIUS) return bait;
        return (typeof prevGetBotTarget === 'function') ? prevGetBotTarget.call(this, e) : null;
    };

    const prevGetEngageDistance = window.GAME_EXT.hooks.getEngageDistance;
    window.GAME_EXT.hooks.getEngageDistance = function (e) {
        if (bait && getDist(bait, e) < BAIT_LURE_RADIUS) return getDist(bait, e);
        return (typeof prevGetEngageDistance === 'function') ? prevGetEngageDistance.call(this, e) : getDist(player, e);
    };

    // Yem bot mermilerini üstüne çeker (hasarı kendi canına yazılır, önemsiz)
    const prevGetExtraTargets = window.GAME_EXT.hooks.getExtraTargets;
    window.GAME_EXT.hooks.getExtraTargets = function () {
        const prevList = (typeof prevGetExtraTargets === 'function') ? (prevGetExtraTargets.call(this) || []) : [];
        return bait ? prevList.concat([bait]) : prevList;
    };

    chainHook('onReset', function () { resetState(); });

    // ---- Çizim ----
    function drawPreview(c, aim, ready, rangeMul, minDist, radius, color) {
        if (!aim.active || !ready) return;
        const t = aimTarget(aim.angle, aim.pull, rangeMul, minDist);
        c.save();
        c.beginPath(); c.moveTo(player.x, player.y); c.lineTo(t.x, t.y);
        c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 2; c.setLineDash([5, 5]); c.stroke();
        c.setLineDash([]);
        c.globalAlpha = 0.22;
        c.beginPath(); c.arc(t.x, t.y, radius, 0, Math.PI * 2);
        c.fillStyle = color; c.fill();
        c.globalAlpha = 1;
        c.strokeStyle = color; c.lineWidth = 2; c.stroke();
        c.restore();
    }

    chainHook('onDraw', function (c) {
        nets.forEach(n => {
            const fade = Math.min(1, n.life / 60);
            c.save();
            c.translate(n.x, n.y);
            c.globalAlpha = 0.25 * fade;
            c.beginPath(); c.arc(0, 0, NET_RADIUS, 0, Math.PI * 2);
            c.fillStyle = '#2e86de'; c.fill();
            c.globalAlpha = 0.8 * fade;
            c.strokeStyle = '#74b9ff'; c.lineWidth = 2;
            c.stroke();
            for (let r = 1; r <= 3; r++) { c.beginPath(); c.arc(0, 0, NET_RADIUS * r / 4, 0, Math.PI * 2); c.stroke(); }
            for (let k = 0; k < 8; k++) {
                const a = k * Math.PI / 4;
                c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * NET_RADIUS, Math.sin(a) * NET_RADIUS); c.stroke();
            }
            c.restore();
        });

        traps.forEach(t => {
            const armed = t.arm <= 0;
            const blink = t.life < 120 && Math.floor(t.life / 8) % 2 === 0;
            c.save();
            c.translate(t.x, t.y);
            c.globalAlpha = blink ? 0.3 : (armed ? 1 : 0.5);
            for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4;
                c.beginPath();
                c.moveTo(Math.cos(a - 0.25) * 10, Math.sin(a - 0.25) * 10);
                c.lineTo(Math.cos(a) * 20, Math.sin(a) * 20);
                c.lineTo(Math.cos(a + 0.25) * 10, Math.sin(a + 0.25) * 10);
                c.closePath();
                c.fillStyle = armed ? '#1abc9c' : '#7f8c8d';
                c.fill();
            }
            c.beginPath(); c.arc(0, 0, 11, 0, Math.PI * 2);
            c.fillStyle = '#2c3e50'; c.fill();
            c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
            c.restore();
        });

        if (bait) {
            c.save();
            c.translate(bait.x, bait.y);
            c.globalAlpha = 0.12;
            c.beginPath(); c.arc(0, 0, BAIT_LURE_RADIUS, 0, Math.PI * 2);
            c.fillStyle = '#f39c12'; c.fill();
            c.globalAlpha = 0.5;
            c.strokeStyle = '#f39c12'; c.lineWidth = 2; c.setLineDash([8, 10]); c.stroke();
            c.setLineDash([]);
            c.globalAlpha = 1;
            c.beginPath();
            c.arc(0, 0, BAIT_RADIUS + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (bait.life / BAIT_LIFE));
            c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
            const pulse = 1 + Math.sin(Date.now() / 150) * 0.12;
            c.scale(pulse, pulse);
            c.beginPath(); c.arc(0, 0, BAIT_RADIUS, 0, Math.PI * 2);
            c.fillStyle = '#e67e22'; c.fill();
            c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
            c.beginPath(); c.arc(-4, -4, 5, 0, Math.PI * 2);
            c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();
            c.restore();
        }

        snared.forEach((s, e) => {
            if (e.isDead) return;
            c.save();
            c.translate(e.x, e.y);
            c.rotate(Date.now() / 400);
            c.beginPath(); c.arc(0, 0, e.radius + 8, 0, Math.PI * 2);
            c.strokeStyle = '#1abc9c'; c.lineWidth = 3; c.setLineDash([6, 6]); c.stroke();
            c.restore();
        });

        tLobs.forEach(l => {
            const h = Math.sin((l.progress || 0) * Math.PI);
            const scale = 1 + h * 1.2;
            const color = l.kind === 'trap' ? '#1abc9c' : (l.kind === 'bait' ? '#e67e22' : '#2e86de');
            c.save();
            c.translate(l.x, l.y);
            c.save();
            c.translate(0, h * 25);
            c.scale(1 / scale, 0.5 / scale);
            c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2);
            c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
            c.restore();
            c.scale(scale, scale);
            c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2);
            c.fillStyle = color; c.fill();
            c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
            c.restore();
        });

        tBolts.forEach(b => {
            c.save();
            c.translate(b.x, b.y);
            c.rotate(b.angle);
            c.beginPath(); c.moveTo(12, 0); c.lineTo(-4, -5); c.lineTo(-4, 5); c.closePath();
            c.fillStyle = CHAR_COLOR; c.fill();
            c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
            c.beginPath(); c.moveTo(-4, 0); c.lineTo(-14, 0);
            c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.stroke();
            c.restore();
        });

        if (player.charType === CHAR_ID && !player.isDead) {
            drawPreview(c, gadAim, player.gadgetReady, TRAP_THROW_RANGE, 60, TRAP_RADIUS, '#1abc9c');
            drawPreview(c, gadAim2, player.gadget2Ready, BAIT_THROW_RANGE, 60, BAIT_LURE_RADIUS, '#f39c12');
            drawPreview(c, ultAim, player.ultReady, NET_THROW_RANGE, 70, NET_RADIUS, '#2e86de');
        }
    });

    // ---- Güncelleme ----
    let lastT = 0;
    function tLoop(t) {
        if (!lastT) lastT = t;
        const ts = Math.min(3, (t - lastT) / 16.666);
        lastT = t;
        if (gameStarted) tUpdate(ts);
        requestAnimationFrame(tLoop);
    }
    requestAnimationFrame(tLoop);

    function tUpdate(ts) {
        // ana dosya bu karakteri listede bulamayıp butonları gizliyor, her karede geri açıyoruz
        if (player.charType === CHAR_ID) {
            if (ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
            if (gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
            if (gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';
        }

        snared.forEach((s, e) => {
            s.timer -= ts;
            if (s.timer <= 0 || e.isDead) { e.speed = s.origSpeed; snared.delete(e); }
        });

        for (let i = tLobs.length - 1; i >= 0; i--) {
            const l = tLobs[i];
            const d = getDist(l, { x: l.tx, y: l.ty });
            const move = PLAYER_BULLET_SPEED * 1.3 * ts;
            if (d <= move) { landLob(l); tLobs.splice(i, 1); }
            else {
                const ang = Math.atan2(l.ty - l.y, l.tx - l.x);
                l.x += Math.cos(ang) * move; l.y += Math.sin(ang) * move;
                l.progress = 1 - d / l.total;
            }
        }

        for (let i = traps.length - 1; i >= 0; i--) {
            const t = traps[i];
            t.life -= ts;
            if (t.life <= 0) { spawnParticles(t.x, t.y, '#7f8c8d', 'normal'); traps.splice(i, 1); continue; }
            if (t.arm > 0) { t.arm -= ts; continue; }
            const victim = getActiveEnemies().find(e => getDist(t, e) < TRAP_RADIUS + e.radius * 0.5);
            if (victim) {
                victim.hp -= TRAP_DAMAGE;
                addFloatingNumber(victim.x, victim.y, TRAP_DAMAGE, '#1abc9c');
                addFloatingNumber(victim.x, victim.y - 24, 'KAPAN!', '#1abc9c');
                snareEnemy(victim, TRAP_ROOT);
                spawnParticles(t.x, t.y, '#1abc9c', 'normal');
                traps.splice(i, 1);
            }
        }

        if (bait) {
            bait.life -= ts;
            if (bait.life <= 0) bait = null;
        }

        for (let i = nets.length - 1; i >= 0; i--) {
            const n = nets[i];
            n.life -= ts;
            if (n.life <= 0) { nets.splice(i, 1); continue; }
            n.tick += ts;
            const doTick = n.tick >= 60;
            if (doTick) n.tick = 0;
            getActiveEnemies().forEach(e => {
                if (getDist(n, e) < NET_RADIUS + e.radius) {
                    snareEnemy(e, NET_ROOT_REFRESH);
                    if (doTick) {
                        e.hp -= NET_TICK_DAMAGE;
                        suppressCharge = true;
                        addFloatingNumber(e.x, e.y, NET_TICK_DAMAGE, '#74b9ff');
                        suppressCharge = false;
                    }
                }
            });
        }

        for (let i = tBolts.length - 1; i >= 0; i--) {
            const b = tBolts[i];
            b.x += b.vx * ts; b.y += b.vy * ts;

            const outOfRange = getDist(b, { x: b.sx, y: b.sy }) > BOLT_RANGE;
            const hitWall = b.x < WALL_THICKNESS + 3 || b.x > canvas.width - WALL_THICKNESS - 3 ||
                             b.y < WALL_THICKNESS + 3 || b.y > canvas.height - WALL_THICKNESS - 3;
            if (outOfRange || hitWall) { tBolts.splice(i, 1); continue; }

            let blocked = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(b, o) < o.radius + 6) {
                    o.hp -= 150;
                    spawnParticles(b.x, b.y, '#7f8c8d', 'normal');
                    blocked = true;
                    break;
                }
            }
            if (blocked) { tBolts.splice(i, 1); continue; }

            const target = getActiveEnemies().find(e => getDist(b, e) < e.radius + 10);
            if (target) {
                const bonus = snared.has(target);
                const dmg = Math.round(BOLT_DAMAGE * (bonus ? SNARED_BONUS : 1));
                target.hp -= dmg;
                addFloatingNumber(target.x, target.y, dmg, bonus ? '#f1c40f' : CHAR_COLOR);
                spawnParticles(b.x, b.y, CHAR_COLOR, 'normal');
                tBolts.splice(i, 1);
            }
        }
    }

})();
