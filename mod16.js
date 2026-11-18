/*
 * MOD9.JS — VEZİR / KOZMİK SATRANÇ USTASI
 *
 * Ana oyunun kodunu değiştirmeden yüklenir. Dosyayı ana <script> bloğundan
 * SONRA çağırın: <script src="mod9.js"></script>
 *
 * ANA SALDIRI — AT HÂMLESİ
 * Normal mermi atmaz. Nişan yönünün ilerisinde, sırayla sağ ve sol taraftaki
 * L biçimli satranç karesini vurur. Duvarlardan geçmez/dash yapmaz; oyuncu
 * hiçbir yere ışınlanmaz ve yerde iz bırakmaz.
 *
 * AKSESUAR 1 — ÇATAL
 * Sonraki At Hâmlesi hem sağ hem sol L karesini aynı anda vurur.
 *
 * AKSESUAR 2 — HÂMLE TEKRARI
 * Son üç ana saldırı karesini aynı anda yeniden vurur. Geçmiş hâmle yoksa
 * oyuncunun çevresindeki dört At karesini vurur.
 *
 * ULTİ — ŞAH MAT
 * Hedefe 5×5 kozmik satranç tahtası kurar. Kale, Fil, At ve Vezir desenleri
 * sırayla parlar ve üzerindeki düşmanlara hasar verir; finalde MAT patlar.
 *
 * ÖNEMLİ UYUMLULUK NOTU
 * Ana dosyadaki Player/player/gameStarted/getActiveEnemies gibi değişkenler
 * `let` veya `const` ile tanımlı olsa bile aynı sayfadaki klasik scriptler
 * bunlara global lexical binding üzerinden erişebilir. Bu mod bu nedenle
 * yalnızca window.Player'a güvenmez; mobilde çalışmayan eski sürümün temel
 * problemi buydu.
 */
(function () {
    'use strict';

    const KEY = 'vezir';
    const GOLD = '#ffd166';
    const CYAN = '#54e8ff';
    const NAVY = '#18233f';
    const VIOLET = '#6c5ce7';
    const DANGER = '#ff5d73';
    const WALL = 25;

    window.GAME_EXT = window.GAME_EXT || {
        characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {}
    };

    window.GAME_EXT.characters[KEY] = {
        color: NAVY,
        hp: 3900,
        speed: 3.15,
        label: 'Vezir',
        desc: 'Ana: At Hâmlesi • Güç: Şah Mat'
    };

    // Mod tek başına kullanıldığında da küçük telefon ekranlarını düzeltir.
    function installMobileStyles() {
        if (document.getElementById('mod9-mobile-style')) return;
        const style = document.createElement('style');
        style.id = 'mod9-mobile-style';
        style.textContent = `
            #char-vezir, #gadget-btn, #gadget-btn-2, #ulti-btn{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
            .difficulty-track{touch-action:pan-y!important}
            @media(max-width:600px){
                #start-screen{overflow-y:auto;padding-top:14px;padding-bottom:20px;justify-content:flex-start}
                .char-select-container{gap:7px;margin-bottom:14px}
                .char-card{width:calc(33.333% - 8px);min-width:84px;padding:8px 4px}
                .joystick-container{width:118px;height:118px;bottom:22px}
                #left-joystick{left:14px} #right-joystick{right:14px}
                #gadget-btn{right:20px;bottom:153px}
                #gadget-btn-2{right:91px;bottom:153px}
                #ulti-btn{right:20px;bottom:224px}
            }
            @media(max-height:500px) and (orientation:landscape){
                #start-screen{padding-top:7px}
                #start-screen h1{font-size:24px;margin:0 0 7px}
                .char-select-container{flex-wrap:nowrap;margin-bottom:8px}
                .char-card{min-width:94px;padding:5px 3px}
                .joystick-container{width:106px;height:106px;bottom:12px}
                #gadget-btn,#gadget-btn-2{bottom:124px}
                #ulti-btn{bottom:194px}
            }
        `;
        document.head.appendChild(style);
    }

    const state = {
        strikes: [],
        history: [],
        boards: [],
        flashes: [],
        forkArmed: false,
        nextSide: 1,
        uid: 0,
        lastCharacter: ''
    };

    // ---------------------------------------------------------------------
    // Ana oyun değişkenlerine güvenli erişim
    // ---------------------------------------------------------------------
    function getPlayer() {
        try { if (typeof player !== 'undefined') return player; } catch (_) {}
        return window.player || null;
    }

    function getCanvas() {
        try { if (typeof canvas !== 'undefined') return canvas; } catch (_) {}
        return document.getElementById('gameCanvas');
    }

    function getEnemies() {
        try {
            if (typeof getActiveEnemies === 'function') return getActiveEnemies();
        } catch (_) {}
        if (typeof window.getActiveEnemies === 'function') return window.getActiveEnemies();
        return [];
    }

    function isRunning() {
        try { if (typeof gameStarted !== 'undefined') return !!gameStarted; } catch (_) {}
        const p = getPlayer();
        return !!(p && document.getElementById('start-screen') &&
            document.getElementById('start-screen').style.display === 'none');
    }

    function d(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function text(x, y, value, color) {
        try {
            if (typeof addFloatingNumber === 'function') {
                addFloatingNumber(x, y, value, color, false);
                return;
            }
        } catch (_) {}
        if (typeof window.addFloatingNumber === 'function') {
            window.addFloatingNumber(x, y, value, color, false);
        }
    }

    function particles(x, y, color, kind) {
        try {
            if (typeof spawnParticles === 'function') {
                spawnParticles(x, y, color, kind || 'normal');
                return;
            }
        } catch (_) {}
        if (typeof window.spawnParticles === 'function') {
            window.spawnParticles(x, y, color, kind || 'normal');
        }
    }

    function shake(amount) {
        try {
            if (typeof screenShake !== 'undefined') screenShake = Math.max(screenShake, amount);
        } catch (_) {}
    }

    function activeCharacter() {
        const p = getPlayer();
        return !!(p && p.charType === KEY && !p.isDead);
    }

    // ---------------------------------------------------------------------
    // Karakter seçme kartı — dokunma ve tıklama destekli
    // ---------------------------------------------------------------------
    function chooseVezir(card) {
        try { selectedCharacter = KEY; } catch (_) { window.selectedCharacter = KEY; }
        document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
        card.classList.add('selected');
        if (navigator.vibrate) navigator.vibrate(18);
    }

    function installCard() {
        const container = document.querySelector('.char-select-container');
        if (!container) return;

        let card = document.getElementById('char-' + KEY);
        if (!card) {
            card = document.createElement('div');
            card.id = 'char-' + KEY;
            card.className = 'char-card';
            container.appendChild(card);
        }

        card.innerHTML =
            '<div class="char-color-preview" style="position:relative;background:radial-gradient(circle at 35% 30%,#54e8ff 0 12%,#27365f 13% 58%,#0d1326 59%);box-shadow:0 0 12px #ffd166"></div>' +
            '<span>Vezir</span>' +
            '<small>Hasar: At Hâmlesi<br>Güç: Şah Mat</small>';

        if (!card.dataset.mod9Bound) {
            card.dataset.mod9Bound = '1';
            card.addEventListener('click', () => chooseVezir(card));
            card.addEventListener('pointerup', e => {
                if (e.pointerType !== 'mouse') chooseVezir(card);
            });
        }
    }

    // ---------------------------------------------------------------------
    // Mobil arayüz
    // ---------------------------------------------------------------------
    function writeButtonLabels() {
        const g1 = document.getElementById('gadget-btn');
        const g2 = document.getElementById('gadget-btn-2');
        if (g1) {
            g1.innerHTML = 'ÇATAL<br><span id="gadget-timer"></span>';
            g1.style.background = 'radial-gradient(circle at 35% 30%,#ffe69a,#b7791f)';
            g1.style.color = '#11182c';
        }
        if (g2) {
            g2.innerHTML = 'HÂMLE<br>TEKRARI<br><span id="gadget-timer-2"></span>';
            g2.style.background = 'radial-gradient(circle at 35% 30%,#62efff,#3949ab)';
        }
    }

    function showMobileButtons() {
        if (!activeCharacter() || !isRunning()) return;
        const g1 = document.getElementById('gadget-btn');
        const g2 = document.getElementById('gadget-btn-2');
        const ult = document.getElementById('ulti-btn');
        if (g1) g1.style.display = 'flex';
        if (g2) g2.style.display = 'flex';
        if (ult) {
            ult.style.display = 'flex';
            ult.firstChild && (ult.firstChild.nodeValue = 'ŞAH MAT');
        }
    }

    function resetState() {
        state.strikes.length = 0;
        state.history.length = 0;
        state.boards.length = 0;
        state.flashes.length = 0;
        state.forkArmed = false;
        state.nextSide = 1;
    }

    // ---------------------------------------------------------------------
    // At Hâmlesi geometrisi
    // ---------------------------------------------------------------------
    function knightPoint(p, aimAngle, side, forward, lateral) {
        forward = forward || 155;
        lateral = lateral || 92;
        const c = getCanvas();
        const x = p.x + Math.cos(aimAngle) * forward + Math.cos(aimAngle + Math.PI / 2) * lateral * side;
        const y = p.y + Math.sin(aimAngle) * forward + Math.sin(aimAngle + Math.PI / 2) * lateral * side;
        const margin = WALL + 54;
        return {
            x: clamp(x, margin, Math.max(margin, (c ? c.width : innerWidth) - margin)),
            y: clamp(y, margin, Math.max(margin, (c ? c.height : innerHeight) - margin))
        };
    }

    function rememberPoint(pt) {
        state.history.unshift({ x: pt.x, y: pt.y });
        if (state.history.length > 3) state.history.length = 3;
    }

    function queueStrike(x, y, options) {
        options = options || {};
        state.strikes.push({
            id: ++state.uid,
            x, y,
            radius: options.radius || 54,
            damage: options.damage || 900,
            delay: options.delay === undefined ? 18 : options.delay,
            maxDelay: options.delay === undefined ? 18 : options.delay,
            life: options.life || 22,
            maxLife: options.life || 22,
            color: options.color || GOLD,
            label: options.label || '',
            source: options.source || 'main',
            hit: false
        });
    }

    function damageStrike(s) {
        if (s.hit) return;
        s.hit = true;
        let hits = 0;
        getEnemies().forEach(enemy => {
            if (!enemy || enemy.isDead || enemy.hp <= 0) return;
            if (d(s, enemy) <= s.radius + (enemy.radius || 18)) {
                enemy.hp -= s.damage;
                text(enemy.x, enemy.y, String(s.damage), s.color);
                hits++;
            }
        });

        state.flashes.push({ x: s.x, y: s.y, radius: 12, maxRadius: s.radius + 20, life: 16, maxLife: 16, color: s.color });
        particles(s.x, s.y, s.color, 'normal');
        if (s.label) text(s.x, s.y - 35, s.label, s.color);
        if (hits) {
            chargeUltimate(s.source === 'replay' ? 8 * hits : 17 * hits);
            shake(hits > 1 ? 9 : 5);
        }
    }

    function chargeUltimate(amount) {
        const p = getPlayer();
        if (!p || p.charType !== KEY || p.ultReady) return;
        p.ultCharge = Math.min(100, (p.ultCharge || 0) + amount);
        const fill = document.getElementById('ult-fill');
        const btn = document.getElementById('ulti-btn');
        if (fill) fill.style.width = p.ultCharge + '%';
        if (p.ultCharge >= 100) {
            p.ultReady = true;
            if (btn) btn.classList.add('ready');
            text(p.x, p.y - 44, 'ŞAH MAT HAZIR!', GOLD);
            if (navigator.vibrate) navigator.vibrate([35, 35, 55]);
        }
    }

    // ---------------------------------------------------------------------
    // Oyuncu metotlarını yama
    // ---------------------------------------------------------------------
    function patchPlayer() {
        let PlayerClass = null;
        try { if (typeof Player !== 'undefined') PlayerClass = Player; } catch (_) {}
        if (!PlayerClass) PlayerClass = window.Player;
        if (!PlayerClass || PlayerClass.prototype.__vezirMod9Patched) return;

        const proto = PlayerClass.prototype;
        proto.__vezirMod9Patched = true;

        const oldSetCharacter = proto.setCharacter;
        const oldFire = proto.fire;
        const oldGadget1 = proto.activateGadget;
        const oldGadget2 = proto.activateGadget2;
        const oldUlti = proto.fireUlti;

        proto.setCharacter = function (type) {
            oldSetCharacter.call(this, type);
            if (type !== KEY) return;
            this.color = NAVY;
            this.maxHp = 3900;
            this.hp = 3900;
            this.speed = 3.15;
            this.originalSpeed = 3.15;
            this.reloadSpeed = 0.019;
            this.ammo = this.maxAmmo;
            this.ultCharge = 0;
            this.ultReady = false;
            this.gadgetReady = true;
            this.gadget2Ready = true;
            resetState();
            writeButtonLabels(); // startGame sayaç spanlarını bundan sonra yakalar.
        };

        proto.fire = function (aimAngle) {
            if (this.charType !== KEY) return oldFire.apply(this, arguments);
            if (this.isDead || this.ammo < 1 || Date.now() - this.lastShotTime <= 150) return;

            const sides = state.forkArmed ? [-1, 1] : [state.nextSide];
            sides.forEach((side, index) => {
                const pt = knightPoint(this, aimAngle, side);
                queueStrike(pt.x, pt.y, {
                    damage: state.forkArmed ? 760 : 940,
                    delay: 17 + index * 2,
                    radius: 55,
                    color: side < 0 ? CYAN : GOLD,
                    label: state.forkArmed ? 'ÇATAL!' : '',
                    source: 'main'
                });
                rememberPoint(pt);
            });

            if (state.forkArmed) {
                state.forkArmed = false;
                const g1 = document.getElementById('gadget-btn');
                if (g1) g1.classList.remove('active');
            } else {
                state.nextSide *= -1;
            }

            this.consumeAmmo();
            this.angle = aimAngle;
            text(this.x, this.y - 32, sides.length === 2 ? 'ÇİFTE HÂMLE!' : 'AT HÂMLESİ', GOLD);
            if (navigator.vibrate) navigator.vibrate(12);
        };

        proto.activateGadget = function () {
            if (this.charType !== KEY) return oldGadget1.apply(this, arguments);
            if (this.isDead || !this.gadgetReady || state.forkArmed) return;

            state.forkArmed = true;
            this.gadgetReady = false;
            this.gadgetCooldown = 720; // 12 saniye
            const btn = document.getElementById('gadget-btn');
            if (btn) btn.classList.add('cooldown', 'active');
            text(this.x, this.y - 42, 'ÇATAL HAZIR!', GOLD);
            particles(this.x, this.y, GOLD, 'normal');
            if (navigator.vibrate) navigator.vibrate([20, 20, 20]);
        };

        proto.activateGadget2 = function (aimAngle) {
            if (this.charType !== KEY) return oldGadget2.apply(this, arguments);
            if (this.isDead || !this.gadget2Ready) return;

            let points = state.history.slice(0, 3);
            if (!points.length) {
                const a = aimAngle === undefined ? this.angle : aimAngle;
                points = [-1, 1].map(side => knightPoint(this, a, side));
                points.push(knightPoint(this, a + Math.PI, -1));
                points.push(knightPoint(this, a + Math.PI, 1));
            }

            points.forEach((pt, index) => queueStrike(pt.x, pt.y, {
                damage: 680,
                delay: 14 + index * 3,
                radius: 58,
                color: CYAN,
                label: index === 0 ? 'TEKRAR!' : '',
                source: 'replay'
            }));

            this.gadget2Ready = false;
            this.gadget2Cooldown = 900; // 15 saniye
            const btn = document.getElementById('gadget-btn-2');
            if (btn) btn.classList.add('cooldown');
            text(this.x, this.y - 42, 'HÂMLELER GERİ DÖNDÜ!', CYAN);
            if (navigator.vibrate) navigator.vibrate([18, 25, 18]);
        };

        proto.fireUlti = function (aimAngle, pull) {
            if (this.charType !== KEY) return oldUlti.apply(this, arguments);
            if (this.isDead || !this.ultReady) return;

            const c = getCanvas();
            const mag = pull === undefined ? 1 : clamp(pull, 0.22, 1);
            const range = 300 * mag;
            const margin = 150;
            const maxX = c ? c.width - margin : innerWidth - margin;
            const maxY = c ? c.height - margin : innerHeight - margin;
            const tx = clamp(this.x + Math.cos(aimAngle) * range, margin, Math.max(margin, maxX));
            const ty = clamp(this.y + Math.sin(aimAngle) * range, margin, Math.max(margin, maxY));

            state.boards.push({
                x: tx, y: ty,
                cell: 50,
                size: 5,
                phase: 0,
                timer: 58,
                maxTimer: 58,
                hitThisPhase: false,
                finalDone: false,
                life: 58 * 5 + 26
            });

            this.ultReady = false;
            this.ultCharge = 0;
            const fill = document.getElementById('ult-fill');
            const btn = document.getElementById('ulti-btn');
            if (fill) fill.style.width = '0%';
            if (btn) btn.classList.remove('ready');
            text(tx, ty - 155, 'ŞAH MAT TAHTASI!', GOLD);
            particles(tx, ty, VIOLET, 'smoke');
            shake(12);
            if (navigator.vibrate) navigator.vibrate([40, 35, 70]);
        };
    }

    // ---------------------------------------------------------------------
    // Şah Mat desenleri
    // ---------------------------------------------------------------------
    function activeCell(phase, row, col) {
        const r = row - 2;
        const c = col - 2;
        if (phase === 0) return r === 0 || c === 0;                         // Kale
        if (phase === 1) return Math.abs(r) === Math.abs(c);               // Fil
        if (phase === 2) return Math.abs(r * c) === 2;                     // At
        if (phase === 3) return r === 0 || c === 0 || Math.abs(r) === Math.abs(c); // Vezir
        return true;                                                        // MAT
    }

    function cellAt(board, entity) {
        const half = board.cell * board.size / 2;
        const col = Math.floor((entity.x - (board.x - half)) / board.cell);
        const row = Math.floor((entity.y - (board.y - half)) / board.cell);
        return { row, col, inside: row >= 0 && row < board.size && col >= 0 && col < board.size };
    }

    function strikeBoardPhase(board) {
        const phase = board.phase;
        let hits = 0;
        getEnemies().forEach(enemy => {
            if (!enemy || enemy.isDead || enemy.hp <= 0) return;
            const pos = cellAt(board, enemy);
            if (!pos.inside || !activeCell(phase, pos.row, pos.col)) return;
            const damage = phase === 4 ? 1200 : (phase === 3 ? 760 : 610);
            enemy.hp -= damage;
            text(enemy.x, enemy.y, phase === 4 ? '1200 MAT!' : String(damage), phase === 4 ? DANGER : GOLD);
            hits++;
        });
        if (hits) shake(phase === 4 ? 18 : 8);
        particles(board.x, board.y, phase === 4 ? DANGER : GOLD, phase === 4 ? 'smoke' : 'normal');
    }

    // ---------------------------------------------------------------------
    // Her kare güncelleme — ana oyunun hazır hook noktasından çağrılır
    // ---------------------------------------------------------------------
    function update(ts) {
        if (!isRunning()) return;
        const p = getPlayer();
        if (!p || p.charType !== KEY) return;
        showMobileButtons();

        for (let i = state.strikes.length - 1; i >= 0; i--) {
            const s = state.strikes[i];
            if (s.delay > 0) {
                s.delay -= ts;
                if (s.delay <= 0) damageStrike(s);
            } else {
                s.life -= ts;
                if (s.life <= 0) state.strikes.splice(i, 1);
            }
        }

        for (let i = state.flashes.length - 1; i >= 0; i--) {
            const f = state.flashes[i];
            f.life -= ts;
            f.radius += (f.maxRadius - f.radius) * 0.22 * ts;
            if (f.life <= 0) state.flashes.splice(i, 1);
        }

        for (let i = state.boards.length - 1; i >= 0; i--) {
            const b = state.boards[i];
            b.life -= ts;
            b.timer -= ts;

            if (!b.hitThisPhase && b.timer <= 22) {
                b.hitThisPhase = true;
                strikeBoardPhase(b);
            }

            if (b.timer <= 0) {
                b.phase++;
                b.timer = b.maxTimer;
                b.hitThisPhase = false;
                if (b.phase === 4) text(b.x, b.y - 150, 'MAT!', DANGER);
                if (b.phase > 4) {
                    state.boards.splice(i, 1);
                    continue;
                }
            }
        }
    }

    // ---------------------------------------------------------------------
    // Çizim
    // ---------------------------------------------------------------------
    function roundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else {
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
        }
    }

    function drawArena(ctx, c) {
        // onDraw ana çizimden sonra çalışır; destination-over ile benzersiz mekânı
        // savaşçıların arkasına yerleştiriyoruz.
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#070b18';
        ctx.fillRect(0, 0, c.width, c.height);

        const cell = Math.max(42, Math.min(70, c.width / 9));
        const offX = ((Date.now() / 180) % cell);
        ctx.globalAlpha = 0.24;
        for (let y = WALL; y < c.height - WALL; y += cell) {
            for (let x = WALL; x < c.width - WALL; x += cell) {
                const even = (Math.floor((x + offX) / cell) + Math.floor(y / cell)) % 2 === 0;
                ctx.fillStyle = even ? '#16254b' : '#0b132b';
                ctx.fillRect(x, y, cell - 2, cell - 2);
            }
        }
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < 34; i++) {
            const x = (i * 97 + 31) % Math.max(1, c.width);
            const y = (i * 53 + 17) % Math.max(1, c.height);
            ctx.fillStyle = i % 4 === 0 ? GOLD : CYAN;
            ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
        }
        ctx.restore();
    }

    function drawKnightAim(ctx, p) {
        let a;
        try { a = (typeof aimData !== 'undefined') ? aimData : window.aimData; } catch (_) { a = window.aimData; }
        if (!a || !a.active || p.ammo < 1 || p.isDead) return;

        const sides = state.forkArmed ? [-1, 1] : [state.nextSide];
        sides.forEach(side => {
            const elbow = {
                x: p.x + Math.cos(a.angle) * 155,
                y: p.y + Math.sin(a.angle) * 155
            };
            const pt = knightPoint(p, a.angle, side);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(elbow.x, elbow.y);
            ctx.lineTo(pt.x, pt.y);
            ctx.setLineDash([5, 7]);
            ctx.strokeStyle = side < 0 ? 'rgba(84,232,255,.72)' : 'rgba(255,209,102,.72)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 55, 0, Math.PI * 2);
            ctx.fillStyle = side < 0 ? 'rgba(84,232,255,.12)' : 'rgba(255,209,102,.12)';
            ctx.fill();
            ctx.strokeStyle = side < 0 ? CYAN : GOLD;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        });
    }

    function drawUltAim(ctx, p) {
        let a;
        try { a = (typeof ultAim !== 'undefined') ? ultAim : window.ultAim; } catch (_) { a = window.ultAim; }
        if (!a || !a.active || !p.ultReady || p.isDead) return;
        const pull = a.pull === undefined ? 1 : clamp(a.pull, .22, 1);
        const c = getCanvas();
        const margin = 150;
        const tx = clamp(p.x + Math.cos(a.angle) * 300 * pull, margin, Math.max(margin, c.width - margin));
        const ty = clamp(p.y + Math.sin(a.angle) * 300 * pull, margin, Math.max(margin, c.height - margin));
        const size = 250;

        ctx.save();
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty);
        ctx.strokeStyle = 'rgba(255,209,102,.55)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.stroke();
        ctx.setLineDash([]);
        for (let r = 0; r < 5; r++) for (let col = 0; col < 5; col++) {
            ctx.fillStyle = (r + col) % 2 ? 'rgba(84,232,255,.13)' : 'rgba(255,209,102,.16)';
            ctx.fillRect(tx - size / 2 + col * 50, ty - size / 2 + r * 50, 49, 49);
        }
        ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.strokeRect(tx - size / 2, ty - size / 2, size, size);
        ctx.restore();
    }

    function drawBoards(ctx) {
        const labels = ['KALE', 'FİL', 'AT', 'VEZİR', 'MAT'];
        state.boards.forEach(b => {
            const half = b.cell * b.size / 2;
            const warning = b.timer <= 22;
            ctx.save();
            ctx.translate(b.x - half, b.y - half);
            for (let row = 0; row < b.size; row++) {
                for (let col = 0; col < b.size; col++) {
                    const active = activeCell(b.phase, row, col);
                    ctx.fillStyle = active
                        ? (warning ? 'rgba(255,93,115,.62)' : 'rgba(255,209,102,.31)')
                        : ((row + col) % 2 ? 'rgba(19,32,66,.54)' : 'rgba(7,12,29,.54)');
                    ctx.fillRect(col * b.cell + 1, row * b.cell + 1, b.cell - 2, b.cell - 2);
                    if (active) {
                        ctx.strokeStyle = warning ? DANGER : GOLD;
                        ctx.lineWidth = warning ? 2.5 : 1;
                        ctx.strokeRect(col * b.cell + 3, row * b.cell + 3, b.cell - 6, b.cell - 6);
                    }
                }
            }
            ctx.strokeStyle = GOLD;
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, b.cell * b.size, b.cell * b.size);
            ctx.fillStyle = '#fff';
            ctx.font = '900 15px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(labels[Math.min(4, b.phase)], half, -11);
            ctx.restore();
        });
    }

    function drawCharacterOverlay(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        // At başı rozeti
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.moveTo(-7, -13); ctx.lineTo(7, -15); ctx.lineTo(12, -4);
        ctx.lineTo(4, 3); ctx.lineTo(-7, 1); ctx.lineTo(-11, -7); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = NAVY;
        ctx.beginPath(); ctx.arc(5, -8, 2, 0, Math.PI * 2); ctx.fill();
        // Yön göstergesi
        ctx.strokeStyle = CYAN; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(25, 0); ctx.stroke();
        ctx.restore();

        // Sıradaki sol/sağ hâmle göstergesi
        ctx.save();
        ctx.fillStyle = 'rgba(7,11,24,.78)';
        roundedRect(ctx, p.x - 38, p.y + 29, 76, 20, 8); ctx.fill();
        ctx.fillStyle = state.forkArmed ? GOLD : (state.nextSide < 0 ? CYAN : GOLD);
        ctx.font = '800 10px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(state.forkArmed ? 'ÇATAL HAZIR' : (state.nextSide < 0 ? 'SONRAKİ: SOL' : 'SONRAKİ: SAĞ'), p.x, p.y + 43);
        ctx.restore();
    }

    function draw(ctx) {
        if (!isRunning()) return;
        const p = getPlayer();
        if (!p || p.charType !== KEY) return;
        const c = getCanvas();
        if (!c) return;

        drawArena(ctx, c);
        drawBoards(ctx);

        state.strikes.forEach(s => {
            ctx.save();
            const pulse = 1 + Math.sin(Date.now() / 75 + s.id) * .08;
            ctx.translate(s.x, s.y);
            ctx.scale(pulse, pulse);
            ctx.beginPath();
            ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
            ctx.fillStyle = s.hit ? 'rgba(255,255,255,.08)' : (s.color === CYAN ? 'rgba(84,232,255,.16)' : 'rgba(255,209,102,.16)');
            ctx.fill();
            ctx.strokeStyle = s.hit ? '#fff' : s.color;
            ctx.lineWidth = s.hit ? 4 : 2.5;
            ctx.setLineDash(s.hit ? [] : [7, 6]);
            ctx.stroke();
            if (!s.hit) {
                ctx.setLineDash([]);
                ctx.fillStyle = s.color;
                ctx.font = '900 22px Georgia, serif';
                ctx.textAlign = 'center';
                ctx.fillText('♞', 0, 8);
            }
            ctx.restore();
        });

        state.flashes.forEach(f => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
            ctx.beginPath(); ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
            ctx.strokeStyle = f.color; ctx.lineWidth = 6; ctx.stroke();
            ctx.restore();
        });

        drawKnightAim(ctx, p);
        drawUltAim(ctx, p);
        drawCharacterOverlay(ctx, p);
    }

    // ---------------------------------------------------------------------
    // Hook zincirleri
    // ---------------------------------------------------------------------
    const previousSpawnTick = window.GAME_EXT.hooks.onBotSpawnTick;
    window.GAME_EXT.hooks.onBotSpawnTick = function (ts) {
        if (typeof previousSpawnTick === 'function') previousSpawnTick(ts);
        update(ts || 1);
    };

    const previousDraw = window.GAME_EXT.hooks.onDraw;
    window.GAME_EXT.hooks.onDraw = function (ctx) {
        if (typeof previousDraw === 'function') previousDraw(ctx);
        draw(ctx);
    };

    const previousReset = window.GAME_EXT.hooks.onReset;
    window.GAME_EXT.hooks.onReset = function () {
        if (typeof previousReset === 'function') previousReset();
        resetState();
    };

    installMobileStyles();
    installCard();
    patchPlayer();
    document.addEventListener('DOMContentLoaded', () => {
        installMobileStyles();
        installCard();
        patchPlayer();
    }, { once: true });

    // Bazı mod yükleyicileri Player sınıfını kısa gecikmeyle yayınlıyor.
    let attempts = 0;
    const patchTimer = setInterval(() => {
        installCard();
        patchPlayer();
        if (++attempts > 30) clearInterval(patchTimer);
    }, 100);

    console.info('mod9.js hazır: Vezir — At Hâmlesi / Çatal / Hâmle Tekrarı / Şah Mat');
})();
