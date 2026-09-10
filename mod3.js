// ========== mod2.js (YAPRAKÇI) - RÜZGAR SAVURMASI ==========
// - Aksesuar 1: Rüzgar Savurması. Kendi etrafında Ninja alanından %30 daha
//   büyük bir alandaki tüm botları 30 birim otomatik uzaklaştırır.
// - Aksesuar 2: Takip Eden Alan (değişmedi).
// - Ulti dolumu düzeltildi, cooldown göstergesi çalışıyor.
// - Mimari: hook tabanlı, global override yok.

(function () {
    'use strict';

    const CHAR_ID = 'yaprakci';
    const CHAR_COLOR = '#229954';
    const CHAR_HP = 2600;
    const CHAR_SPEED = 4.2;

    const LEAF_RANGE = 357;
    const LEAF_BULLET_SPEED = PLAYER_BULLET_SPEED * 0.75;
    const MID_DAMAGE = 500;
    const SIDE_DAMAGE = 400;
    const SIDE_OFFSET = 12;
    const SIDE_DELAY_MS = 100;
    const KNOCKBACK_MAG = 2.5;
    const LEAF_HIT_PAD = 8;
    const OBSTACLE_DAMAGE = 30;

    // Rüzgar Savurması (Aksesuar 1)
    const WIND_KNOCKBACK_RADIUS = 148;  // Ninja alanı 114 * 1.3 ≈ 148
    const WIND_KNOCKBACK_FORCE = 30;    // 30 birim itme
    const WIND_COOLDOWN = 900;          // 15 saniye

    // Takip Eden Alan (Aksesuar 2)
    const FOLLOW_BUFF_DURATION = 900;
    const FOLLOW_GADGET2_COOLDOWN = 1200;

    // Ulti
    const ULTI_ZONE_RADIUS = 96;
    const ULTI_ZONE_DURATION = 480;
    const ULTI_ZONE_DPS = 150;
    const ULTI_SLOW_FACTOR = 0.4;
    const ULTI_BONUS_DAMAGE = 100;
    const ULTI_HIT_HEAL = 50;
    const ULTI_STANDING_HEAL_PER_SEC = 200;

    const SPAWN_GROW_FRAMES = 10;

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let leafBullets = [];
    let leafZones = [];
    let wasJumping = false;

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') {
                return !!prevResult || !!ownResult;
            }
            return ownResult !== undefined ? ownResult : prevResult;
        };
    }

    function spawnLeaf(x, y, angle, dmg, options = {}) {
        leafBullets.push({
            x, y, sx: x, sy: y,
            vx: Math.cos(angle) * LEAF_BULLET_SPEED,
            vy: Math.sin(angle) * LEAF_BULLET_SPEED,
            angle, dmg, age: 0, hitTargets: [],
            isAutoLeaf: options.isAutoLeaf || false
        });
    }

    function playerInOwnZone() {
        return leafZones.some(z => getDist(player, z) < z.radius);
    }

    // ========== TEMEL SALDIRI ==========
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);

        const fx = this.x, fy = this.y;
        const perpAngle = a + Math.PI / 2;

        spawnLeaf(fx, fy, a, MID_DAMAGE, {});
        this.consumeAmmo();

        setTimeout(() => {
            if (!gameStarted || this.isDead) return;
            [-SIDE_OFFSET, SIDE_OFFSET].forEach(off => {
                spawnLeaf(
                    fx + Math.cos(perpAngle) * off,
                    fy + Math.sin(perpAngle) * off,
                    a, SIDE_DAMAGE, {}
                );
            });
        }, SIDE_DELAY_MS);
    };

    // ========== AKSESUAR 1: RÜZGAR SAVURMASI ==========
    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;

        // Etki: Etrafındaki tüm düşmanları 30 birim uzağa it
        const etkilenenler = [];
        getActiveEnemies().forEach(e => {
            if (getDist(this, e) <= WIND_KNOCKBACK_RADIUS + e.radius) {
                const angle = getAngle(this, e);
                e.kbX = Math.cos(angle) * WIND_KNOCKBACK_FORCE;
                e.kbY = Math.sin(angle) * WIND_KNOCKBACK_FORCE;
                etkilenenler.push(e);
            }
        });

        if (etkilenenler.length > 0) {
            addFloatingNumber(this.x, this.y - 40, "RÜZGAR SAVURMASI!", "#229954");
            // Görsel efekt: yeşil halka
            explosions.push({x: this.x, y: this.y, radius: 10, maxRadius: WIND_KNOCKBACK_RADIUS, life: 12, maxLife: 12});
            for (let k = 0; k < 10; k++) {
                const ang = Math.random() * Math.PI * 2;
                const dist = Math.random() * WIND_KNOCKBACK_RADIUS * 0.7;
                spawnParticles(this.x + Math.cos(ang) * dist, this.y + Math.sin(ang) * dist, '#2ecc71', 'smoke');
            }
        } else {
            addFloatingNumber(this.x, this.y - 30, "YAKINDA DÜŞMAN YOK", "#7f8c8d");
        }

        this.gadgetReady = false;
        this.gadgetCooldown = WIND_COOLDOWN;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(WIND_COOLDOWN / 60) + "s";
    };

    // ========== AKSESUAR 2: TAKİP EDEN ALAN ==========
    const originalActivateGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;

        this.kFollowUltiBuff = true;
        this.kFollowUltiBuffTimer = FOLLOW_BUFF_DURATION;
        addFloatingNumber(this.x, this.y - 30, "TAKİP EDEN ALAN HAZIR!", "#229954");

        this.gadget2Ready = false;
        this.gadget2Cooldown = FOLLOW_GADGET2_COOLDOWN;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(FOLLOW_GADGET2_COOLDOWN / 60) + "s";
    };

    // ========== ULTİ ==========
    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pullOverride);
        if (!this.ultReady || this.isDead) return;

        const willFollow = !!this.kFollowUltiBuff;
        leafZones.push({
            x: this.x, y: this.y, radius: ULTI_ZONE_RADIUS, life: ULTI_ZONE_DURATION,
            maxLife: ULTI_ZONE_DURATION, tickTimer: 0, followsPlayer: willFollow
        });
        addFloatingNumber(this.x, this.y - 40, willFollow ? "TAKİP EDEN ALAN!" : "YAPRAK ALANI!", "#229954");

        if (willFollow) { this.kFollowUltiBuff = false; this.kFollowUltiBuffTimer = 0; }

        this.ultReady = false; this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    // ========== ULTİ DOLDURMA ==========
    chainHook('onChargeUlti', function (amount) {
        if (player.charType !== CHAR_ID) return;
        if (player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount / 2);
        if (player.ultCharge >= 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, "GÜÇ HAZIR!", "#f1c40f");
        }
        if (ultFill) ultFill.style.width = player.ultCharge + "%";
    });

    // ========== KARAKTER KARTI ==========
    const charContainer = document.querySelector('.char-select-container');
    if (charContainer && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Yaprakçı</span>' +
            '<small>Hasar: 500+400x2<br>Güç: Rüzgar Savurması + Alan</small>';
        charContainer.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    // ========== HOOK: RESET ==========
    chainHook('onReset', function () {
        leafBullets = [];
        leafZones = [];
    });

    // ========== HOOK: DRAW ==========
    chainHook('onDraw', function (ctx2) {
        if (player.charType !== CHAR_ID) return;

        // Ulti alanları
        leafZones.forEach(z => {
            const lifeRatio = Math.max(0, z.life / z.maxLife);
            const pulse = 1 + Math.sin(Date.now() / 180) * 0.04;
            ctx2.save();
            ctx2.translate(z.x, z.y);

            const grad = ctx2.createRadialGradient(0, 0, 0, 0, 0, z.radius * pulse);
            grad.addColorStop(0, `rgba(46, 204, 113, ${0.28 * lifeRatio})`);
            grad.addColorStop(0.7, `rgba(34, 153, 84, ${0.18 * lifeRatio})`);
            grad.addColorStop(1, `rgba(34, 153, 84, 0)`);
            ctx2.beginPath(); ctx2.arc(0, 0, z.radius * pulse, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();

            ctx2.globalAlpha = 0.8 * lifeRatio;
            ctx2.beginPath(); ctx2.arc(0, 0, z.radius * pulse, 0, Math.PI * 2);
            ctx2.strokeStyle = '#2ecc71'; ctx2.lineWidth = 2.5; ctx2.stroke();

            ctx2.rotate(Date.now() / 500);
            ctx2.globalAlpha = 0.7 * lifeRatio;
            ctx2.beginPath(); ctx2.arc(0, 0, z.radius * 0.82, 0, Math.PI * 2);
            ctx2.strokeStyle = '#a9dfbf'; ctx2.lineWidth = 2; ctx2.setLineDash([9, 14]);
            ctx2.stroke(); ctx2.setLineDash([]);

            ctx2.restore();
        });

        // Yaprak mermileri
        leafBullets.forEach(b => {
            const growT = Math.min(1, (b.age || 0) / SPAWN_GROW_FRAMES);
            const scale = 0.35 + 0.65 * growT;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.rotate(b.angle);
            ctx2.scale(scale, scale);

            // Gölge
            ctx2.beginPath(); ctx2.ellipse(1, 2, 9, 5, 0, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(0,0,0,0.25)'; ctx2.fill();

            // Sap
            ctx2.beginPath(); ctx2.moveTo(-12, 0); ctx2.lineTo(-4, 0);
            ctx2.strokeStyle = '#6b4226'; ctx2.lineWidth = 2; ctx2.stroke();

            // Yaprak gövdesi
            const leafGrad = ctx2.createLinearGradient(-6, 0, 8, 0);
            leafGrad.addColorStop(0, '#1e8449');
            leafGrad.addColorStop(1, '#2ecc71');
            ctx2.beginPath(); ctx2.ellipse(2, 0, 9, 5, 0, 0, Math.PI * 2);
            ctx2.fillStyle = leafGrad; ctx2.fill();
            ctx2.strokeStyle = '#145a32'; ctx2.lineWidth = 1.5; ctx2.stroke();

            // Damar
            ctx2.beginPath(); ctx2.moveTo(-6, 0); ctx2.lineTo(10, 0);
            ctx2.strokeStyle = 'rgba(20,90,50,0.6)'; ctx2.lineWidth = 1; ctx2.stroke();

            ctx2.restore();
        });
    });

    // ========== HOOK: UPDATE ==========
    chainHook('onUpdate', function (ts) {
        if (player.charType !== CHAR_ID) return;
        leafUpdate(ts);
        ensureLeafUI();
    });

    // ========== UI GÜNCELLEME ==========
    function ensureLeafUI() {
        if (!gameStarted) return;
        if (player.charType === CHAR_ID) {
            if (gadgetBtn) gadgetBtn.style.display = 'flex';
            if (gadgetBtn2) gadgetBtn2.style.display = 'flex';
            if (ultiBtn) ultiBtn.style.display = 'flex';

            // Buton etiketlerini sadece bir kez ayarla
            if (gadgetBtn && gadgetBtn.dataset.yaprakLabelSet !== '1') {
                gadgetBtn.innerHTML = 'RÜZGAR<br>SAVURMA<br><span id="gadget-timer"></span>';
                gadgetBtn.dataset.yaprakLabelSet = '1';
                gadgetTimerText = document.getElementById('gadget-timer'); // Referansı güncelle
            }
            if (gadgetBtn2 && gadgetBtn2.dataset.yaprakLabelSet !== '1') {
                gadgetBtn2.innerHTML = 'TAKİP<br>EDEN ALAN<br><span id="gadget-timer-2"></span>';
                gadgetBtn2.dataset.yaprakLabelSet = '1';
                gadgetTimerText2 = document.getElementById('gadget-timer-2'); // Referansı güncelle
            }

            // Cooldown göstergeleri
            if (player.gadgetCooldown > 0) {
                if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(player.gadgetCooldown / 60) + "s";
                gadgetBtn.classList.add('cooldown');
            } else {
                if (gadgetTimerText) gadgetTimerText.innerText = "";
                gadgetBtn.classList.remove('cooldown');
            }
            if (player.gadget2Cooldown > 0) {
                if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(player.gadget2Cooldown / 60) + "s";
                gadgetBtn2.classList.add('cooldown');
            } else {
                if (gadgetTimerText2) gadgetTimerText2.innerText = "";
                gadgetBtn2.classList.remove('cooldown');
            }
        }

        // Takip eden alan buff süresi
        if (player.charType === CHAR_ID && player.kFollowUltiBuff) {
            player.kFollowUltiBuffTimer -= 1;
            if (player.kFollowUltiBuffTimer <= 0) {
                player.kFollowUltiBuff = false;
                addFloatingNumber(player.x, player.y, "ALAN TAKİBİ SÖNDÜ", "#7f8c8d");
            }
        }
    }

    // ========== MERMİ VE ALAN GÜNCELLEME ==========
    function leafUpdate(ts) {
        // ---- Ulti alanları ----
        for (let i = leafZones.length - 1; i >= 0; i--) {
            const z = leafZones[i];
            if (z.followsPlayer) { z.x = player.x; z.y = player.y; }
            z.life -= ts;
            z.tickTimer = (z.tickTimer || 0) + ts;
            const doTick = z.tickTimer >= 60;
            if (doTick) z.tickTimer = 0;

            getActiveEnemies().forEach(e => {
                const inZone = getDist(z, e) < z.radius;
                if (inZone) {
                    e.hp -= (ULTI_ZONE_DPS / 60) * ts;
                    if (doTick) addFloatingNumber(e.x, e.y, ULTI_ZONE_DPS, "#229954");
                    if (!e._leafSlowed) {
                        e._leafOrigSpeed = e.speed;
                        e.speed = e.speed * ULTI_SLOW_FACTOR;
                        e._leafSlowed = true;
                    }
                } else if (e._leafSlowed) {
                    e.speed = e._leafOrigSpeed;
                    e._leafSlowed = false;
                }
            });

            if (getDist(player, z) < z.radius && !player.isDead) {
                player.hp = Math.min(player.maxHp, player.hp + (ULTI_STANDING_HEAL_PER_SEC / 60) * ts);
                if (doTick) addFloatingNumber(player.x, player.y - 20, "+" + ULTI_STANDING_HEAL_PER_SEC, "#2ecc71");
            }

            if (z.life <= 0) {
                getActiveEnemies().forEach(e => {
                    if (e._leafSlowed) { e.speed = e._leafOrigSpeed; e._leafSlowed = false; }
                });
                leafZones.splice(i, 1);
            }
        }

        // ---- Yaprak mermileri ----
        for (let i = leafBullets.length - 1; i >= 0; i--) {
            const b = leafBullets[i];
            b.age = (b.age || 0) + ts;
            b.x += b.vx * ts; b.y += b.vy * ts;

            const hw = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - (WALL_THICKNESS + 5) ||
                b.y < WALL_THICKNESS + 5 || b.y > canvas.height - (WALL_THICKNESS + 5);
            const traveled = getDist({ x: b.sx, y: b.sy }, b);
            const oor = traveled > LEAF_RANGE;

            if (hw || oor) { leafBullets.splice(i, 1); continue; }

            let hitObstacle = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(b, o) < o.radius + LEAF_HIT_PAD) {
                    o.hp -= OBSTACLE_DAMAGE;
                    hitObstacle = true;
                    break;
                }
            }
            if (hitObstacle) { leafBullets.splice(i, 1); continue; }

            const inZone = playerInOwnZone();
            if (inZone) {
                for (const e of getActiveEnemies()) {
                    if (b.hitTargets.includes(e)) continue;
                    if (getDist(b, e) < e.radius + LEAF_HIT_PAD) {
                        b.hitTargets.push(e);
                        let totalDmg = b.dmg + ULTI_BONUS_DAMAGE;
                        e.hp -= totalDmg;
                        addFloatingNumber(e.x, e.y - 6, totalDmg, "#27ae60");
                        e.kbX = (e.kbX || 0) + Math.cos(b.angle) * KNOCKBACK_MAG;
                        e.kbY = (e.kbY || 0) + Math.sin(b.angle) * KNOCKBACK_MAG;
                        player.hp = Math.min(player.maxHp, player.hp + ULTI_HIT_HEAL);
                        addFloatingNumber(player.x, player.y, "+" + ULTI_HIT_HEAL, "#2ecc71");
                        leafBullets.splice(i, 1);
                        break;
                    }
                }
                continue;
            }

            let hit = false;
            for (const e of getActiveEnemies()) {
                if (getDist(b, e) < e.radius + LEAF_HIT_PAD) {
                    e.hp -= b.dmg;
                    addFloatingNumber(e.x, e.y, b.dmg, "#27ae60");
                    e.kbX = (e.kbX || 0) + Math.cos(b.angle) * KNOCKBACK_MAG;
                    e.kbY = (e.kbY || 0) + Math.sin(b.angle) * KNOCKBACK_MAG;
                    hit = true;
                    break;
                }
            }
            if (hit) { leafBullets.splice(i, 1); continue; }
        }
    }
})();