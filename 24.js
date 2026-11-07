// ============================================================================
// mod34.js - "Yankı" karakteri (zamanlamalı karşılık / yansıtma)
// Ana dosyaya dokunmaz. index.html'de TÜM mod script'lerinden SONRA eklenmeli:
//   <script src="mod34.js"></script>
//
// Yankı hiçbir şey fırlatmaz: mermi, ışın, koni, loblu atış, çağırma, düşman
// fırlatma, dondurma/soğutma, bağ/zincir, kement, temas hasarı YOK.
// Tek silahı düşmanın KENDİ mermisi: aynayı doğru anda kaldırırsan mermi yok
// olur ve hasarı anında mermiyi atan düşmana işler (çarpan çarpar).
//
//  - Ana saldırı (Ayna Duruşu): Sağ joystick'i düşmana doğru çek-bırak.
//    0.6 sn boyunca o yönde (±70°) bir ayna kalkar. Mermi aynaya değerse yok
//    olur, atan düşman hasar alır. İlk 0.3 sn "MÜKEMMEL" penceredir (x2.5),
//    sonrası normal yansıtma (x1.2). Ayna slime botların patlamasını da engeller.
//    1 cephane harcar.
//  - Yetenek 1 (KIŞKIRT): Menzildeki botlar hemen sana ateş eder, 3 sn boyunca
//    yansıtılan hasarları %50 artar. Hazır ol ve ayna kaldır!
//  - Yetenek 2 (AYNA ADIMI): Joystick yönünde kısa atılım; atılım sırasında ve
//    sonrasında 0.4 sn her yönden gelen mermiler yansıtılır, çok kısa
//    dokunulmaz olursun.
//  - Güç (SONSUZ YANSIMA): 6 sn boyunca her yönden gelen her mermi otomatik
//    x2.5 yansıtılır; botlar 1.2 sn'de bir otomatik kışkırtılır.
//  - Bar: yansıtılan hasarla ve zamanla dolar.
//  Not: Sis botu ve yuvalar ateş etmediği için aynadan hasar almaz.
// ============================================================================
(function () {
    'use strict';
    const ID = 'yanki';
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

    window.GAME_EXT = window.GAME_EXT || { characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {} };
    window.GAME_EXT.characters[ID] = { color: '#00cec9', hp: 3800, speed: 3.2 };

    // ---- Denge ayarları (buradan oynayabilirsin) ----
    const CFG = {
        mirror: { frames: 36, perfect: 18, arc: 70 * Math.PI / 180, rOut: 60, multPerfect: 2.5, mult: 1.2 },
        omni: { frames: 24, mult: 1.2 },
        dash: { dist: 130, frames: 8, inv: 10 },
        q: { cd: 600, provMs: 3000, provMul: 1.5 },
        e: { cd: 540 },
        ult: { time: 360, mult: 2.5, provEvery: 72, rOut: 70 },
        passive: 0.025, chargeDiv: 25
    };

    let stance = null, omniT = 0, dash = null, invT = 0, ultT = 0, provT = 0, rings = [], lastT = 0, wasStarted = false;

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
            addFloatingNumber(player.x, player.y - 40, 'YANSIMA HAZIR!', '#00cec9');
        }
    }

    const bulletDmg = b => {
        const easy = window.GAME_DIFFICULTY === 'easy';
        if (b.type === 'stationary_bot_bullet') return easy ? 300 : 350;
        if (b.type === 'boomerang') return easy ? 200 : 250;
        return easy ? 480 : 500;
    };
    function nearestEnemy(x, y) {
        let best = null, bd = 1e9;
        getActiveEnemies().forEach(e => { if (e.hp <= 0) return; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } });
        return best;
    }

    // ---- Yansıtma ----
    function reflectBullet(b, mult, perfect) {
        const now = Date.now();
        const owner = (b.owner && b.owner.hp > 0 && !b.owner.isDead && b.owner.isActive !== false)
            ? b.owner : nearestEnemy(b.sx !== undefined ? b.sx : b.x, b.sy !== undefined ? b.sy : b.y);
        if (owner) {
            let dmg = bulletDmg(b) * mult;
            if (owner.cProv > now) dmg *= CFG.q.provMul;
            dmg = Math.round(dmg);
            owner.hp -= dmg;
            addFloatingNumber(owner.x, owner.y, dmg, perfect ? '#ffeaa7' : '#81ecec');
            charge(dmg / CFG.chargeDiv);
            rings.push({ x: owner.x, y: owner.y, r: 8, max: 42, life: 10, maxLife: 10, col: '255,255,255' });
            spawnParticles(owner.x, owner.y, '#dfe6e9', 'normal');
        }
        spawnParticles(b.x, b.y, '#dfe6e9', 'normal');
        if (perfect) addFloatingNumber(player.x, player.y - 45, 'MÜKEMMEL!', '#ffeaa7');
    }
    function inArc(x, y) {
        return stance && Math.abs(angDiff(Math.atan2(y - player.y, x - player.x), stance.ang)) <= CFG.mirror.arc;
    }
    function processReflect() {
        const ultOn = ultT > 0;
        if (!(ultOn || omniT > 0 || stance)) return;
        const M = CFG.mirror, rOut = ultOn ? CFG.ult.rOut : M.rOut;
        for (let i = botBullets.length - 1; i >= 0; i--) {
            const b = botBullets[i];
            if (Math.hypot(b.x - player.x, b.y - player.y) > rOut) continue;
            let mult = 0, perfect = false;
            if (ultOn) mult = CFG.ult.mult;
            if (omniT > 0) mult = Math.max(mult, CFG.omni.mult);
            if (stance && inArc(b.x, b.y)) {
                const per = stance.t > M.frames - M.perfect, m = per ? M.multPerfect : M.mult;
                if (m > mult) { mult = m; perfect = per; }
            }
            if (mult > 0) { reflectBullet(b, mult, perfect); botBullets.splice(i, 1); }
        }
        // slime botların patlamasını engelle
        getActiveEnemies().forEach(e => {
            if (!slimeBots.includes(e) || e.hp <= 0) return;
            if (Math.hypot(e.x - player.x, e.y - player.y) > player.radius + e.radius + 14) return;
            if (ultOn || omniT > 0 || inArc(e.x, e.y)) { e.hp = 0; addFloatingNumber(e.x, e.y - 10, 'YANSIDI!', '#81ecec'); charge(5); }
        });
    }

    function provoke() {
        const until = Date.now() + CFG.q.provMs;
        getActiveEnemies().forEach(e => {
            if (e.shootInterval === undefined) return;
            e.lastShot = 0; e.cProv = until;
            rings.push({ x: e.x, y: e.y, r: 10, max: 50, life: 14, maxLife: 14, col: '231,76,60' });
        });
    }

    // ---- Ana saldırı: Ayna Duruşu ----
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== ID) return origFire.call(this, a, pull);
        stance = { ang: a, t: CFG.mirror.frames };
        this.consumeAmmo();
    };

    // ---- Yetenekler ----
    const origG1 = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== ID) return origG1.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        provoke();
        addFloatingNumber(this.x, this.y - 30, 'KIŞKIRT!', '#e74c3c');
        this.setCooldown(); this.gadgetCooldown = CFG.q.cd;
    };

    const origG2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== ID) return origG2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        dash = { ang: a !== undefined ? a : this.angle, frames: CFG.dash.frames, step: CFG.dash.dist / CFG.dash.frames };
        omniT = CFG.omni.frames; invT = CFG.dash.inv; this.jumpInvulnerable = true;
        spawnParticles(this.x, this.y, '#81ecec', 'smoke');
        addFloatingNumber(this.x, this.y - 30, 'AYNA ADIMI!', '#81ecec');
        this.gadget2Ready = false; this.gadget2Cooldown = CFG.e.cd; gadgetBtn2.classList.add('cooldown');
    };

    const origUlt = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== ID) return origUlt.call(this, a, pull);
        if (!this.ultReady || this.isDead || ultT > 0) return;
        ultT = CFG.ult.time; provT = 0; provoke();
        addFloatingNumber(this.x, this.y - 40, 'SONSUZ YANSIMA!', '#00cec9'); screenShake = Math.max(screenShake, 8);
        this.ultReady = false; this.ultCharge = 0; ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    };

    // ---- Güncelleme ----
    function update(ts) {
        charge(CFG.passive * ts);
        if (player.isDead) { stance = null; omniT = 0; dash = null; ultT = 0; return; }

        if (stance) { stance.t -= ts; if (stance.t <= 0) stance = null; }
        if (omniT > 0) omniT -= ts;
        if (ultT > 0) {
            ultT -= ts; provT += ts;
            if (provT >= CFG.ult.provEvery) { provT = 0; provoke(); }
            if (ultT <= 0) { ultT = 0; addFloatingNumber(player.x, player.y - 30, 'YANSIMA BİTTİ', '#00cec9'); }
        }
        if (dash) {
            const mv = dash.step * ts;
            player.x += Math.cos(dash.ang) * mv; player.y += Math.sin(dash.ang) * mv;
            const pad = WALL_THICKNESS + player.radius;
            player.x = cl(player.x, pad, canvas.width - pad); player.y = cl(player.y, pad, canvas.height - pad);
            dash.frames -= ts; if (dash.frames <= 0) dash = null;
        }
        if (invT > 0) { invT -= ts; if (invT <= 0 && !player.isJumping) player.jumpInvulnerable = false; }

        processReflect();
        for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= ts; if (rings[i].life <= 0) rings.splice(i, 1); }
    }

    // ---- Çizim ----
    function draw() {
        ctx.save();
        const t = Date.now();
        // halkalar
        rings.forEach(r => {
            const k = 1 - r.life / r.maxLife;
            ctx.save(); ctx.strokeStyle = 'rgba(' + r.col + ',' + (1 - k) + ')'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.r + (r.max - r.r) * k, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        });
        // ayna duruşu
        if (stance) {
            const per = stance.t > CFG.mirror.frames - CFG.mirror.perfect;
            ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(stance.ang);
            ctx.globalAlpha = 0.9 * cl(stance.t / 8, 0, 1);
            ctx.beginPath(); ctx.arc(0, 0, 46, -CFG.mirror.arc, CFG.mirror.arc);
            ctx.lineCap = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = per ? '#ffeaa7' : '#81ecec';
            ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14; ctx.stroke(); ctx.restore();
        }
        // 360° ayna (ayna adımı)
        if (omniT > 0) {
            ctx.save(); ctx.globalAlpha = 0.8 * cl(omniT / 8, 0, 1);
            ctx.beginPath(); ctx.arc(player.x, player.y, 46, 0, Math.PI * 2);
            ctx.lineWidth = 5; ctx.strokeStyle = '#81ecec'; ctx.shadowColor = '#81ecec'; ctx.shadowBlur = 12; ctx.stroke(); ctx.restore();
        }
        // sonsuz yansıma
        if (ultT > 0) {
            ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(t / 500);
            ctx.globalAlpha = Math.min(1, ultT / 30) * 0.9;
            ctx.beginPath(); ctx.arc(0, 0, 54, 0, Math.PI * 2);
            ctx.setLineDash([16, 10]); ctx.lineWidth = 5; ctx.strokeStyle = '#00cec9';
            ctx.shadowColor = '#00cec9'; ctx.shadowBlur = 18; ctx.stroke(); ctx.restore();
            ctx.save(); ctx.fillStyle = '#00cec9'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
            ctx.fillText('SONSUZ YANSIMA ' + Math.ceil(ultT / 60) + 's', canvas.width / 2, 66); ctx.restore();
        }
        // nişan önizlemesi
        if (aimData.active && player.ammo >= 1 && !player.isDead) {
            ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(aimData.angle);
            ctx.setLineDash([6, 6]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(129,236,236,0.6)';
            ctx.beginPath(); ctx.arc(0, 0, 46, -CFG.mirror.arc, CFG.mirror.arc); ctx.stroke(); ctx.restore();
        }
        ctx.restore();
    }

    // ---- Arayüz kurulumu (oyun başlayınca) ----
    function clearState() {
        if (player.charType === ID && !player.isJumping) player.jumpInvulnerable = false;
        stance = null; omniT = 0; dash = null; invT = 0; ultT = 0; provT = 0; rings = [];
    }
    function setupUI() {
        if (player.charType !== ID) return;
        ultiBtn.style.display = 'flex'; gadgetBtn.style.display = 'flex'; gadgetBtn2.style.display = 'flex';
        gadgetBtn.innerHTML = 'KIŞKIRT<br><span id="gadget-timer"></span>';
        gadgetBtn2.innerHTML = 'AYNA<br>ADIMI<br><span id="gadget-timer-2"></span>';
        gadgetTimerText = document.getElementById('gadget-timer');
        gadgetTimerText2 = document.getElementById('gadget-timer-2');
        clearState();
        ultFill.style.width = '0%'; ultiBtn.classList.remove('ready');
    }

    // Kendi döngüm: ana döngüden sonra çalışır, başka mod dosyalarının hook'larını ezmez
    function loop(t) {
        requestAnimationFrame(loop);
        const ts = Math.min(3, (t - lastT) / 16.666); lastT = t;
        if (!gameStarted) { wasStarted = false; stance = null; omniT = 0; dash = null; invT = 0; ultT = 0; rings = []; return; }
        if (!wasStarted) { wasStarted = true; setupUI(); }
        if (player.charType !== ID) { stance = null; omniT = 0; dash = null; invT = 0; ultT = 0; rings = []; return; }
        update(ts); draw();
    }
    requestAnimationFrame(loop);

    // ---- Karakter kartı ----
    (function addCard() {
        const box = document.querySelector('.char-select-container');
        if (!box || document.getElementById('char-' + ID)) return;
        const card = document.createElement('div');
        card.className = 'char-card'; card.id = 'char-' + ID;
        card.innerHTML = '<div class="char-color-preview" style="background:#00cec9;"></div><span>Yankı</span><small>Hasar: Karşılık<br>Güç: Yansıma</small>';
        card.addEventListener('click', () => {
            selectedCharacter = ID;
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
        box.appendChild(card);
    })();
})();
