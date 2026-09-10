// ============================================================================
// KARAKTER: BUMERANGCI (mod2.js) — v5 (yeni ulti: saplanan dev bumerang)
// ----------------------------------------------------------------------------
// ULTI DAVRANIŞI:
// 1) Ulti tuşuna basınca dev bir bumerang fırlar (nişan yönünde)
// 2) İlk çarptığı düşmanın olduğu noktada saplanıp durur
// 3) Orada döner: her 0.5 saniyede bir (yarım saniyede bir), o noktanın
//    yakınındaki düşmanlara 200 hasar verir
// 4) Bunu 6 kez tekrarlar (6 x 0.5sn = 3 saniye)
// 5) Sonra oyuncuya doğru geri uçar, ulaşınca +250 can verir
// 6) Eğer hiçbir düşmana çarpmadan menzilin sonuna ulaşırsa, direkt geri
//    döner (saplanma/dönme aşaması atlanır)
//
// NORMAL ATIŞ (fire): önceki sürümle aynı - 300 gidiş / 700 dönüş hasarı,
// gidişte 3 düşmana vurunca otomatik geri dönüyor, engellere hasar veriyor.
// ============================================================================

(function () {
    'use strict';

    const CHAR_ID = 'bumerangci';
    const CHAR_COLOR = '#16a085';           // [VARSAYIM]
    const CHAR_HP = 3000;                   // [VARSAYIM]
    const CHAR_SPEED = 3.4;                 // [VARSAYIM]

    // --- Normal atış ayarları ---
    const OUTBOUND_DAMAGE = 300;
    const RETURN_DAMAGE = 700;
    const OBSTACLE_DAMAGE = 200;            // [VARSAYIM]
    const NORMAL_RANGE = RANGE;
    const NORMAL_SPEED = PLAYER_BULLET_SPEED;
    const RETURN_HEAL = 200;
    const MAX_HITS_BEFORE_RETURN = 3;

    // --- Ulti ayarları ---
    const ULTI_TRAVEL_RANGE = RANGE * 1.4;  // [VARSAYIM] menzilin sonuna kadar giderse
    const ULTI_SPIN_DAMAGE = 200;
    const ULTI_SPIN_RADIUS = 90;            // [VARSAYIM] saplandığı noktadan etki yarıçapı
    const ULTI_SPIN_INTERVAL = 30;          // 0.5 saniye (60fps varsayımıyla)
    const ULTI_SPIN_COUNT = 6;              // 6 x 0.5sn = 3 saniye
    const ULTI_RETURN_HEAL = 250;

    const CHARGE_PER_HIT = 5;               // ulti yavaş dolsun diye düşük tutuldu

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let bBolts = [];   // normal atışlar
    let uBolts = [];   // ulti (dev, saplanan) bumerang(lar)

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') {
                return !!prevResult || !!ownResult;
            }
            return ownResult;
        };
    }

    // ---- Normal atış ----
    function spawnBoomerang(angle) {
        bBolts.push({
            x: player.x, y: player.y, sx: player.x, sy: player.y,
            vx: Math.cos(angle) * NORMAL_SPEED, vy: Math.sin(angle) * NORMAL_SPEED,
            returning: false, hitTargets: []
        });
    }

    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        spawnBoomerang(a);
        this.consumeAmmo();
    };

    // ---- Ulti: dev, saplanan bumerang ----
    function spawnUltiBoomerang(angle) {
        uBolts.push({
            x: player.x, y: player.y, sx: player.x, sy: player.y,
            vx: Math.cos(angle) * NORMAL_SPEED, vy: Math.sin(angle) * NORMAL_SPEED,
            phase: 'out',       // 'out' -> 'spin' -> 'return'
            spinTimer: 0, spinCount: 0
        });
        addFloatingNumber(player.x, player.y - 40, "DEV BUMERANG!", "#f1c40f");
    }

    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pullOverride);
        if (!this.ultReady || this.isDead) return;

        spawnUltiBoomerang(a);

        this.ultReady = false; this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    const originalChargeUlti = window.chargeUlti;
    window.chargeUlti = function (amount) {
        if (player.charType !== CHAR_ID) return originalChargeUlti(amount);
        if (!gameStarted || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount);
        if (player.ultCharge === 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, "GÜÇ HAZIR!", "#f1c40f");
        }
        if (ultFill) ultFill.style.width = player.ultCharge + "%";
    };

    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) { bBolts = []; uBolts = []; }
    };

    const charContainer = document.querySelector('.char-select-container');
    if (charContainer && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Bumerangcı</span>' +
            '<small>Hasar: 300/700<br>Güç: Saplanan Dev</small>';
        charContainer.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    chainHook('onReset', function () {
        bBolts = []; uBolts = [];
    });

    // ---- Çizim ----
    chainHook('onDraw', function (ctx2) {
        bBolts.forEach(b => {
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.rotate(Date.now() / 100);
            ctx2.beginPath();
            ctx2.moveTo(15, 0); ctx2.lineTo(-10, 10); ctx2.lineTo(-5, 0); ctx2.lineTo(-10, -10);
            ctx2.closePath();
            ctx2.fillStyle = CHAR_COLOR;
            ctx2.fill();
            ctx2.strokeStyle = '#ffffff'; ctx2.lineWidth = 1; ctx2.stroke();
            ctx2.restore();
        });

        uBolts.forEach(u => {
            if (u.phase === 'spin') {
                ctx2.save();
                ctx2.translate(u.x, u.y);
                ctx2.globalAlpha = 0.25;
                ctx2.beginPath(); ctx2.arc(0, 0, ULTI_SPIN_RADIUS, 0, Math.PI * 2);
                ctx2.fillStyle = '#f1c40f'; ctx2.fill();
                ctx2.restore();
            }
            ctx2.save();
            ctx2.translate(u.x, u.y);
            ctx2.rotate(Date.now() / 60); // dev bumerang daha hızlı dönüyor
            ctx2.scale(2, 2);
            ctx2.beginPath();
            ctx2.moveTo(15, 0); ctx2.lineTo(-10, 10); ctx2.lineTo(-5, 0); ctx2.lineTo(-10, -10);
            ctx2.closePath();
            ctx2.fillStyle = '#f1c40f';
            ctx2.fill();
            ctx2.strokeStyle = '#ffffff'; ctx2.lineWidth = 1; ctx2.stroke();
            ctx2.restore();
        });
    });

    let bLastTime = 0;
    function bLoop(t) {
        if (!bLastTime) bLastTime = t;
        const ts = Math.min(3, (t - bLastTime) / 16.666);
        bLastTime = t;
        if (gameStarted) bUpdate(ts);
        requestAnimationFrame(bLoop);
    }
    requestAnimationFrame(bLoop);

    function bUpdate(ts) {
        // ana kod her karede gizlemeye çalışsa da burada zorla açık tutuluyor
        if (player.charType === CHAR_ID && ultiBtn && ultiBtn.style.display !== 'flex') {
            ultiBtn.style.display = 'flex';
        }

        // ---- Normal bumerangların güncellemesi ----
        for (let i = bBolts.length - 1; i >= 0; i--) {
            const b = bBolts[i];

            if (!b.returning) {
                b.x += b.vx * ts; b.y += b.vy * ts;

                const outOfRange = getDist(b, { x: b.sx, y: b.sy }) > NORMAL_RANGE;
                const hitWall = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - WALL_THICKNESS - 5 ||
                                 b.y < WALL_THICKNESS + 5 || b.y > canvas.height - WALL_THICKNESS - 5;

                let hitObstacle = false;
                for (const o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(b, o) < o.radius + 5) {
                        o.hp -= OBSTACLE_DAMAGE;
                        hitObstacle = true;
                        break;
                    }
                }

                if (outOfRange || hitWall || hitObstacle) {
                    b.returning = true;
                    b.hitTargets = [];
                }

                if (!b.returning) {
                    getActiveEnemies().forEach(e => {
                        if (b.hitTargets.includes(e)) return;
                        if (getDist(b, e) < e.radius + 12) {
                            e.hp -= OUTBOUND_DAMAGE;
                            addFloatingNumber(e.x, e.y, OUTBOUND_DAMAGE, "#e74c3c");
                            window.chargeUlti(CHARGE_PER_HIT);
                            b.hitTargets.push(e);
                            if (b.hitTargets.length >= MAX_HITS_BEFORE_RETURN) {
                                b.returning = true;
                                b.hitTargets = [];
                            }
                        }
                    });
                }
            } else {
                const ang = getAngle(b, player);
                b.vx = Math.cos(ang) * NORMAL_SPEED;
                b.vy = Math.sin(ang) * NORMAL_SPEED;
                b.x += b.vx * ts; b.y += b.vy * ts;

                getActiveEnemies().forEach(e => {
                    if (b.hitTargets.includes(e)) return;
                    if (getDist(b, e) < e.radius + 12) {
                        e.hp -= RETURN_DAMAGE;
                        addFloatingNumber(e.x, e.y, RETURN_DAMAGE, "#e74c3c");
                        window.chargeUlti(CHARGE_PER_HIT);
                        b.hitTargets.push(e);
                    }
                });

                if (getDist(b, player) < player.radius + 15) {
                    player.hp = Math.min(player.maxHp, player.hp + RETURN_HEAL);
                    addFloatingNumber(player.x, player.y, "+" + RETURN_HEAL, "#2ecc71");
                    bBolts.splice(i, 1);
                    continue;
                }
            }
        }

        // ---- Ulti (dev, saplanan) bumerangların güncellemesi ----
        for (let i = uBolts.length - 1; i >= 0; i--) {
            const u = uBolts[i];

            if (u.phase === 'out') {
                u.x += u.vx * ts; u.y += u.vy * ts;

                let hitEnemy = null;
                getActiveEnemies().forEach(e => {
                    if (!hitEnemy && getDist(u, e) < e.radius + 16) hitEnemy = e;
                });

                const outOfRange = getDist(u, { x: u.sx, y: u.sy }) > ULTI_TRAVEL_RANGE;
                const hitWall = u.x < WALL_THICKNESS + 5 || u.x > canvas.width - WALL_THICKNESS - 5 ||
                                 u.y < WALL_THICKNESS + 5 || u.y > canvas.height - WALL_THICKNESS - 5;

                if (hitEnemy) {
                    // ilk çarptığı düşmanın olduğu noktada saplanıp dönmeye başlıyor
                    u.phase = 'spin';
                    u.spinTimer = 0; u.spinCount = 0;
                } else if (outOfRange || hitWall) {
                    // kimseye çarpmadan menzil bittiyse direkt geri dön
                    u.phase = 'return';
                }
            } else if (u.phase === 'spin') {
                u.spinTimer += ts;
                if (u.spinTimer >= ULTI_SPIN_INTERVAL) {
                    u.spinTimer = 0;
                    u.spinCount++;
                    getActiveEnemies().forEach(e => {
                        if (getDist(u, e) < ULTI_SPIN_RADIUS + e.radius) {
                            e.hp -= ULTI_SPIN_DAMAGE;
                            addFloatingNumber(e.x, e.y, ULTI_SPIN_DAMAGE, "#f1c40f");
                        }
                    });
                    if (u.spinCount >= ULTI_SPIN_COUNT) {
                        u.phase = 'return';
                    }
                }
            } else if (u.phase === 'return') {
                const ang = getAngle(u, player);
                u.vx = Math.cos(ang) * NORMAL_SPEED;
                u.vy = Math.sin(ang) * NORMAL_SPEED;
                u.x += u.vx * ts; u.y += u.vy * ts;

                if (getDist(u, player) < player.radius + 20) {
                    player.hp = Math.min(player.maxHp, player.hp + ULTI_RETURN_HEAL);
                    addFloatingNumber(player.x, player.y, "+" + ULTI_RETURN_HEAL, "#2ecc71");
                    uBolts.splice(i, 1);
                }
            }
        }
    }

})();
