// ========== mod10.js (TURUNCU BASKIN) - v5 ==========
// - Piyade: HP 3000, 300 menzil, hareket eder, ölünce 4 mermi çapraz saçar
// - Turuncu Bot: HP 2500, sınırsız menzil, sabit, her 1500 frame (25s) spawn
// - Kamikaze: HP 1200, hızlı, 70 birimde patlar (500+knockback), havadaki oyuncuya vurmaz
//   Duvara sıkışırsa 0.5s bekler, duvara patlar (1000 duvar + 200 AoE)
//   Her 6. düşman ölümünde 1, max 2 aktif

(function () {
    'use strict';

    const MOD_ID = 'turuncu';

    // ---- Piyade (300 menzil, hareket) ----
    const PIYADE_HP = 3000;
    const PIYADE_RADIUS = 20;
    const PIYADE_SPEED = 1.36;
    const PIYADE_SHOOT_INTERVAL = 1600;
    const PIYADE_ENGAGE_DIST = 180;
    const PIYADE_RANGE = 300;
    const PIYADE_RESPAWN_WAIT = 180;   // 3s bekleme
    const PIYADE_SPAWN_WARN = 180;     // 3s uyarı
    const PIYADE_DEATH_MERMI_SAYISI = 4;
    const PIYADE_DEATH_MERMI_HASAR = 150;
    const PIYADE_DEATH_MERMI_MENZIL = 120;
    const PIYADE_DEATH_MERMI_HIZ = PLAYER_BULLET_SPEED * 0.7;
    const PIYADE_DEATH_MERMI_RADIUS = 6;

    // ---- Turuncu Bot (sınırsız menzil, sabit) ----
    const TURUNCU_HP = 2500;
    const TURUNCU_RADIUS = 22;
    const TURUNCU_SHOOT_INTERVAL = 750;
    const TURUNCU_SPAWN_FRAME = 1500;  // 25s
    const TURUNCU_SPAWN_WARN = 180;    // 3s uyarı

    // ---- Kamikaze ----
    const KAMI_HP = 1200;
    const KAMI_RADIUS = 16;
    const KAMI_SPEED = 1.3;
    const KAMI_MAX = 2;
    const KAMI_SPAWN_WARN = 150;       // 2.5s
    const KAMI_TRIGGER_DIST = 70;
    const KAMI_PLAYER_DMG = 500;
    const KAMI_PLAYER_RADIUS = 90;
    const KAMI_KNOCKBACK = 30;
    const KAMI_WALL_DMG = 1000;
    const KAMI_WALL_AOE = 200;
    const KAMI_WALL_AOE_RADIUS = 100;
    const KAMI_STUCK_FRAMES = 30;
    const KAMI_KILL_TRIGGER = 6;       // Her 6. ölümde

    const SIPER_CAN = 2000;

    // ---- Durum ----
    let piyade = null;
    let piyadeSpawnTimer = 0;
    let piyadeRespawnTimer = 0;
    let piyadeSpawnX = 0, piyadeSpawnY = 0;
    let piyadeDeathMermiler = [];

    let turuncuBot = null;
    let turuncuSpawnFrame = 0;
    let turuncuSpawnUyari = 0;
    let turuncuSpawnX = 0, turuncuSpawnY = 0;

    let kamikazeler = [];
    let kamiSpawnUyarilari = [];
    let modKillCount = 0;

    function rawDamageText(x, y, val, color) {
        floatingNumbers.push({
            x: x + (Math.random() - .5) * 20,
            y: y - 20,
            val: val, color: color || "#e74c3c",
            life: 60, opacity: 1
        });
    }

    function spawnPiyadeUyari() {
        piyadeSpawnX = Math.random() * (canvas.width - 200) + 100;
        piyadeSpawnY = Math.random() * (canvas.height - 200) + 100;
        piyadeSpawnTimer = PIYADE_SPAWN_WARN;
    }

    function dogurPiyade() {
        piyade = {
            x: piyadeSpawnX, y: piyadeSpawnY,
            radius: PIYADE_RADIUS,
            hp: PIYADE_HP, maxHp: PIYADE_HP,
            speed: PIYADE_SPEED, angle: 0, lastShot: 0,
            shootInterval: PIYADE_SHOOT_INTERVAL,
            isDead: false, isActive: true,
            color: '#d35400',
            kbX: 0, kbY: 0
        };
        spawnParticles(piyade.x, piyade.y, '#d35400', 'smoke');
    }

    function dogurTuruncuBot() {
        turuncuSpawnX = Math.random() * (canvas.width - 200) + 100;
        turuncuSpawnY = Math.random() * (canvas.height - 200) + 100;
        turuncuBot = {
            x: turuncuSpawnX, y: turuncuSpawnY,
            radius: TURUNCU_RADIUS,
            hp: TURUNCU_HP, maxHp: TURUNCU_HP,
            speed: 0, angle: 0, lastShot: 0,
            shootInterval: TURUNCU_SHOOT_INTERVAL,
            isDead: false, isActive: true,
            color: '#e67e22',
            kbX: 0, kbY: 0
        };
        spawnParticles(turuncuBot.x, turuncuBot.y, '#e67e22', 'smoke');
        explosions.push({ x: turuncuBot.x, y: turuncuBot.y, radius: 10, maxRadius: 60, life: 15, maxLife: 15 });
    }

    function spawnKamikazeUyari() {
        const x = Math.random() * (canvas.width - 200) + 100;
        const y = Math.random() * (canvas.height - 200) + 100;
        kamiSpawnUyarilari.push({ x, y, timer: KAMI_SPAWN_WARN });
    }

    function dogurKamikaze(x, y) {
        kamikazeler.push({
            x, y,
            radius: KAMI_RADIUS,
            hp: KAMI_HP, maxHp: KAMI_HP,
            speed: KAMI_SPEED,
            angle: 0,
            isDead: false, isActive: true,
            color: '#e67e22',
            kbX: 0, kbY: 0,
            _stuckTimer: 0,
            _lastX: x, _lastY: y
        });
        spawnParticles(x, y, '#e67e22', 'smoke');
    }

    function piyadeOlumMermiSac(px, py) {
        for (let i = 0; i < PIYADE_DEATH_MERMI_SAYISI; i++) {
            const a = (Math.PI / 4) + (i * Math.PI / 2); // 45°, 135°, 225°, 315°
            piyadeDeathMermiler.push({
                x: px, y: py, sx: px, sy: py,
                vx: Math.cos(a) * PIYADE_DEATH_MERMI_HIZ,
                vy: Math.sin(a) * PIYADE_DEATH_MERMI_HIZ,
                radius: PIYADE_DEATH_MERMI_RADIUS,
                hasar: PIYADE_DEATH_MERMI_HASAR,
                menzil: PIYADE_DEATH_MERMI_MENZIL,
                isDead: false
            });
        }
    }

    function kamikazePatlat(kami, targetType, target) {
        const explRadius = targetType === 'wall' ? KAMI_WALL_AOE_RADIUS : KAMI_PLAYER_RADIUS;
        explosions.push({
            x: kami.x, y: kami.y,
            radius: 10, maxRadius: explRadius,
            life: 15, maxLife: 15
        });
        screenShake = 8;

        if (targetType === 'player') {
            if (!player.isDead && !player.jumpInvulnerable && getDist(kami, player) < KAMI_PLAYER_RADIUS + player.radius) {
                player.hp -= KAMI_PLAYER_DMG;
                rawDamageText(player.x, player.y, KAMI_PLAYER_DMG, "#e74c3c");
                player.lastHitTime = Date.now();
                const ang = getAngle(kami, player);
                player.x += Math.cos(ang) * KAMI_KNOCKBACK;
                player.y += Math.sin(ang) * KAMI_KNOCKBACK;
                player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
                player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
            }
        } else if (targetType === 'wall' && target) {
            target.hp -= KAMI_WALL_DMG;
            rawDamageText(target.x, target.y, KAMI_WALL_DMG, "#e74c3c");
            if (!player.isDead && !player.jumpInvulnerable && getDist(kami, player) < KAMI_WALL_AOE_RADIUS + player.radius) {
                player.hp -= KAMI_WALL_AOE;
                rawDamageText(player.x, player.y, KAMI_WALL_AOE, "#e74c3c");
                player.lastHitTime = Date.now();
            }
        }

        for (let i = 0; i < 15; i++) {
            const ang = Math.random() * Math.PI * 2;
            const sp = 3 + Math.random() * 5;
            particles.push({
                x: kami.x, y: kami.y,
                vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                life: 25, maxLife: 25,
                color: Math.random() < 0.5 ? '#e67e22' : '#c0392b',
                size: 3 + Math.random() * 3,
                type: 'normal'
            });
        }

        kami.isDead = true;
        triggerBotKill(kami.x, kami);
    }

    window.GAME_EXT.registerMode(MOD_ID, {
        label: 'Turuncu Baskın',
        onStart: function () {
            piyade = null; piyadeSpawnTimer = 0; piyadeRespawnTimer = 0;
            piyadeDeathMermiler = [];
            turuncuBot = null; turuncuSpawnFrame = 0; turuncuSpawnUyari = 0;
            kamikazeler = []; kamiSpawnUyarilari = [];
            modKillCount = 0;

            bot.isActive = false; bot.isDead = true; bot.x = -9999; bot.y = -9999;
            bot2.isActive = false; bot2.isDead = true; bot2.x = -9999; bot2.y = -9999;
            slimeBots = []; stationaryBots = []; boomerangBots = []; fogBots = [];
            nests = []; spawnIndicators = [];

            obstacles.forEach(o => {
                o.maxHp = SIPER_CAN; o.hp = SIPER_CAN; o._griSiper = true;
            });

            spawnPiyadeUyari();
        },

        onUpdate: function (ts) {
            slimeTimer = 0; stationaryTimer = 0;
            boomerangTimer = 0; fogBotTimer = 0;
            spawnIndicators = [];

            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true; bot2.hp = 0;
            bot2.x = -9999; bot2.y = -9999;
            if (nests.length > 0) {
                nests.forEach(n => { n.hp = 0; n.isDead = true; });
                nests.length = 0;
            }

            obstacles.forEach(o => {
                if (!o._griSiper) { o.maxHp = SIPER_CAN; o.hp = SIPER_CAN; o._griSiper = true; }
            });

            // ========== PİYADE ==========
            if (!piyade) {
                if (piyadeSpawnTimer > 0) {
                    piyadeSpawnTimer -= ts;
                    if (piyadeSpawnTimer <= 0) dogurPiyade();
                } else if (piyadeRespawnTimer > 0) {
                    piyadeRespawnTimer -= ts;
                    if (piyadeRespawnTimer <= 0) { piyadeRespawnTimer = 0; spawnPiyadeUyari(); }
                }
            }

            if (piyade && !piyade.isDead) {
                const b = piyade;
                if (b.hp <= 0) {
                    b.isDead = true;
                    piyadeOlumMermiSac(b.x, b.y);
                    spawnParticles(b.x, b.y, b.color, 'smoke');
                    triggerBotKill(b.x, b);
                    piyade = null;
                    piyadeRespawnTimer = PIYADE_RESPAWN_WAIT;
                } else {
                    const canSee = !player.isDead && !player.isInvisible;
                    const dP = getDist(b, player);
                    if (canSee) {
                        b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                        if (dP > PIYADE_ENGAGE_DIST) {
                            b.x += Math.cos(b.angle) * b.speed * ts;
                            b.y += Math.sin(b.angle) * b.speed * ts;
                        }
                        if (dP < PIYADE_RANGE && Date.now() - b.lastShot > b.shootInterval) {
                            b.lastShot = Date.now();
                            botBullets.push({
                                x: b.x, y: b.y, sx: b.x, sy: b.y,
                                vx: Math.cos(b.angle + (Math.random() - 0.5) * 0.15) * BOT_BULLET_SPEED,
                                vy: Math.sin(b.angle + (Math.random() - 0.5) * 0.15) * BOT_BULLET_SPEED,
                                dmgMod: 1, type: 'stationary_bot_bullet', owner: b
                            });
                        }
                    }
                    if (Math.abs(b.kbX) > 0.1 || Math.abs(b.kbY) > 0.1) {
                        b.x += b.kbX * ts; b.y += b.kbY * ts;
                        b.kbX *= 0.85; b.kbY *= 0.85;
                    }
                    b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                    b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                    resolveObstacleCollision(b);
                    b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                    b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                }
            }

            // Piyade ölüm mermileri
            for (let i = piyadeDeathMermiler.length - 1; i >= 0; i--) {
                const m = piyadeDeathMermiler[i];
                if (m.isDead) { piyadeDeathMermiler.splice(i, 1); continue; }
                m.x += m.vx * ts; m.y += m.vy * ts;
                const mesafe = Math.hypot(m.x - m.sx, m.y - m.sy);
                if (mesafe > m.menzil) { m.isDead = true; continue; }
                if (m.x < WALL_THICKNESS || m.x > canvas.width - WALL_THICKNESS ||
                    m.y < WALL_THICKNESS || m.y > canvas.height - WALL_THICKNESS) { m.isDead = true; continue; }
                let sipereCarpti = false;
                for (const o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(m, o) < o.radius + m.radius) { o.hp -= 50; sipereCarpti = true; break; }
                }
                if (sipereCarpti) { m.isDead = true; continue; }
                if (!player.isDead && !player.jumpInvulnerable && getDist(m, player) < player.radius + m.radius) {
                    player.hp -= m.hasar;
                    rawDamageText(player.x, player.y, m.hasar, "#e74c3c");
                    player.lastHitTime = Date.now();
                    m.isDead = true;
                }
            }

            // ========== TURUNCU BOT ==========
            if (turuncuSpawnUyari > 0) {
                turuncuSpawnUyari -= ts;
                if (turuncuSpawnUyari <= 0) dogurTuruncuBot();
            } else if (!turuncuBot) {
                turuncuSpawnFrame += ts;
                if (turuncuSpawnFrame >= TURUNCU_SPAWN_FRAME) {
                    turuncuSpawnFrame = 0;
                    turuncuSpawnUyari = TURUNCU_SPAWN_WARN;
                }
            }

            if (turuncuBot && !turuncuBot.isDead) {
                const b = turuncuBot;
                if (b.hp <= 0) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color, 'smoke');
                    triggerBotKill(b.x, b);
                    turuncuBot = null;
                } else {
                    const canSee = !player.isDead && !player.isInvisible;
                    if (canSee) {
                        b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                        if (Date.now() - b.lastShot > TURUNCU_SHOOT_INTERVAL) {
                            b.lastShot = Date.now();
                            botBullets.push({
                                x: b.x, y: b.y, sx: b.x, sy: b.y,
                                vx: Math.cos(b.angle + (Math.random() - 0.5) * 0.15) * BOT_BULLET_SPEED,
                                vy: Math.sin(b.angle + (Math.random() - 0.5) * 0.15) * BOT_BULLET_SPEED,
                                dmgMod: 1, type: 'stationary_bot_bullet', owner: b
                            });
                        }
                    }
                    if (Math.abs(b.kbX) > 0.1 || Math.abs(b.kbY) > 0.1) {
                        b.x += b.kbX * ts; b.y += b.kbY * ts;
                        b.kbX *= 0.85; b.kbY *= 0.85;
                    }
                    b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                    b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                    resolveObstacleCollision(b);
                }
            }

            // ========== KAMİKAZE ==========
            for (let i = kamiSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = kamiSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) { dogurKamikaze(u.x, u.y); kamiSpawnUyarilari.splice(i, 1); }
            }

            for (let i = kamikazeler.length - 1; i >= 0; i--) {
                const k = kamikazeler[i];
                if (k.isDead) { kamikazeler.splice(i, 1); continue; }
                if (k.hp <= 0) { kamikazePatlat(k, 'player', null); continue; }

                const canSee = !player.isDead && !player.isInvisible && !player.jumpInvulnerable;
                const dP = getDist(k, player);

                if (canSee && dP < KAMI_TRIGGER_DIST) {
                    kamikazePatlat(k, 'player', null);
                    continue;
                }

                k._lastX = k.x; k._lastY = k.y;
                if (canSee || (!player.isInvisible && !player.isDead)) {
                    k.angle = Math.atan2(player.y - k.y, player.x - k.x);
                    k.x += Math.cos(k.angle) * k.speed * ts;
                    k.y += Math.sin(k.angle) * k.speed * ts;
                }
                if (Math.abs(k.kbX) > 0.1 || Math.abs(k.kbY) > 0.1) {
                    k.x += k.kbX * ts; k.y += k.kbY * ts;
                    k.kbX *= 0.85; k.kbY *= 0.85;
                }
                k.x = clampPos(k.x, k.radius + WALL_THICKNESS, canvas.width - k.radius - WALL_THICKNESS);
                k.y = clampPos(k.y, k.radius + WALL_THICKNESS, canvas.height - k.radius - WALL_THICKNESS);
                resolveObstacleCollision(k);
                k.x = clampPos(k.x, k.radius + WALL_THICKNESS, canvas.width - k.radius - WALL_THICKNESS);
                k.y = clampPos(k.y, k.radius + WALL_THICKNESS, canvas.height - k.radius - WALL_THICKNESS);

                const moved = Math.hypot(k.x - k._lastX, k.y - k._lastY);
                const expectedMove = k.speed * ts;
                if (moved < expectedMove * 0.4) k._stuckTimer += ts;
                else k._stuckTimer = 0;

                if (k._stuckTimer >= KAMI_STUCK_FRAMES) {
                    let yakinDuvar = null, enYakin = Infinity;
                    for (const o of obstacles.concat(cactusWalls || [])) {
                        const d = getDist(k, o) - o.radius - k.radius;
                        if (d < 30 && d < enYakin) { enYakin = d; yakinDuvar = o; }
                    }
                    kamikazePatlat(k, yakinDuvar ? 'wall' : 'player', yakinDuvar);
                }
            }
        },

        onReset: function () {
            piyade = null; piyadeSpawnTimer = 0; piyadeRespawnTimer = 0;
            piyadeDeathMermiler = [];
            turuncuBot = null; turuncuSpawnFrame = 0; turuncuSpawnUyari = 0;
            kamikazeler = []; kamiSpawnUyarilari = [];
            modKillCount = 0;

            bot.isActive = true; bot.isDead = false; bot.hp = bot.maxHp;
            bot.x = canvas.width - 150; bot.y = 300; bot.kbX = bot.kbY = 0;
            bot2.isActive = false; bot2.isDead = true; bot2.hp = bot2.maxHp;
            bot2.respawnTimer = -9999;
            botsKilled = 0;
        }
    });

    // Her 6. düşman ölümünde kamikaze (piyade + turuncu sayılır, kamikaze sayılmaz)
    window.GAME_EXT.chainHook('onEnemyKilled', function (enemy) {
        if (window.GAME_MODE !== MOD_ID) return;
        if (!enemy) return;
        if (enemy === piyade || enemy === turuncuBot) {
            modKillCount++;
            if (modKillCount % KAMI_KILL_TRIGGER === 0 && kamikazeler.length < KAMI_MAX && kamiSpawnUyarilari.length === 0) {
                spawnKamikazeUyari();
            }
        }
    });

    // ========== DÜŞMAN LİSTESİ ==========
    window.GAME_EXT.chainHook('getExtraEnemies', function () {
        if (window.GAME_MODE !== MOD_ID) return undefined;
        const liste = [];
        if (piyade && !piyade.isDead) liste.push(piyade);
        if (turuncuBot && !turuncuBot.isDead) liste.push(turuncuBot);
        liste.push(...kamikazeler.filter(k => !k.isDead));
        return liste;
    });

    // ========== ÇİZİM ==========
    window.GAME_EXT.chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID || !gameStarted) return;

        // Siperler gri
        for (const o of obstacles) {
            ctx2.save();
            ctx2.translate(o.x, o.y);
            ctx2.fillStyle = '#808080';
            ctx2.beginPath();
            ctx2.roundRect(-o.radius, -o.radius, o.radius * 2, o.radius * 2, 10);
            ctx2.fill();
            ctx2.strokeStyle = '#505050';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-15, -o.radius - 15, 30, 4);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-15, -o.radius - 15, 30 * (o.hp / o.maxHp), 4);
            ctx2.restore();
        }

        // Piyade spawn uyarısı
        if (piyadeSpawnTimer > 0) {
            ctx2.save();
            ctx2.translate(piyadeSpawnX, piyadeSpawnY);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath();
            ctx2.arc(0, 0, PIYADE_RADIUS + 12, 0, Math.PI * 2);
            ctx2.strokeStyle = '#d35400';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#d35400';
            ctx2.font = "bold 14px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(piyadeSpawnTimer / 60), 0, 5);
            ctx2.restore();
        }

        // Turuncu bot spawn uyarısı (kare)
        if (turuncuSpawnUyari > 0 && !turuncuBot) {
            const tx = turuncuSpawnX;
            const ty = turuncuSpawnY;
            ctx2.save();
            ctx2.translate(tx || 0, ty || 0);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath();
            ctx2.arc(0, 0, TURUNCU_RADIUS + 14, 0, Math.PI * 2);
            ctx2.strokeStyle = '#e67e22';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#e67e22';
            ctx2.font = "bold 16px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(turuncuSpawnUyari / 60), 0, 6);
            ctx2.restore();
        }

        // Kamikaze spawn uyarısı (üçgen)
        kamiSpawnUyarilari.forEach(u => {
            ctx2.save();
            ctx2.translate(u.x, u.y);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 100));
            ctx2.beginPath();
            ctx2.moveTo(0, -22);
            ctx2.lineTo(-18, 12);
            ctx2.lineTo(18, 12);
            ctx2.closePath();
            ctx2.strokeStyle = '#e67e22';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#e67e22';
            ctx2.font = "bold 18px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText('!', 0, 5);
            ctx2.restore();
        });

        // Piyade (miğferli, turuncu)
        if (piyade && !piyade.isDead) {
            const b = piyade;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-20, -b.radius - 15, 40, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-20, -b.radius - 15, 40 * (b.hp / b.maxHp), 5);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#d35400';
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#5d4037'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.fillStyle = '#fff5e1';
            ctx2.beginPath(); ctx2.arc(7, -5, 4, 0, Math.PI * 2); ctx2.arc(7, 5, 4, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = '#5d4037';
            ctx2.beginPath(); ctx2.arc(8, -5, 2, 0, Math.PI * 2); ctx2.arc(8, 5, 2, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = '#a04000';
            ctx2.beginPath(); ctx2.arc(0, -b.radius * 0.4, b.radius * 0.65, Math.PI, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#5d4037'; ctx2.lineWidth = 1.5; ctx2.stroke();
            ctx2.restore();
        }

        // Turuncu bot (sabit, gözlü)
        if (turuncuBot && !turuncuBot.isDead) {
            const b = turuncuBot;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-20, -b.radius - 15, 40, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-20, -b.radius - 15, 40 * (b.hp / b.maxHp), 5);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#e67e22';
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.fillStyle = '#d35400';
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.75, -Math.PI * 0.7, Math.PI * 0.7); ctx2.fill();
            ctx2.fillStyle = '#5d4037';
            ctx2.fillRect(b.radius - 2, -3, 10, 6);
            ctx2.fillStyle = '#fff5e1';
            ctx2.beginPath(); ctx2.arc(7, -5, 4, 0, Math.PI * 2); ctx2.arc(7, 5, 4, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = '#e67e22';
            ctx2.beginPath(); ctx2.arc(8, -5, 2, 0, Math.PI * 2); ctx2.arc(8, 5, 2, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        }

        // Piyade ölüm mermileri (turuncu kısa)
        piyadeDeathMermiler.forEach(m => {
            if (m.isDead) return;
            ctx2.save();
            ctx2.translate(m.x, m.y);
            ctx2.beginPath(); ctx2.arc(0, 0, m.radius + 2, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(211,84,0,0.25)'; ctx2.fill();
            ctx2.beginPath(); ctx2.arc(0, 0, m.radius, 0, Math.PI * 2);
            ctx2.fillStyle = '#d35400'; ctx2.fill();
            ctx2.strokeStyle = '#5d4037'; ctx2.lineWidth = 1.5; ctx2.stroke();
            ctx2.restore();
        });

        // Kamikazeler
        kamikazeler.forEach(k => {
            if (k.isDead) return;
            const canSee = !player.isDead && !player.isInvisible;
            if (canSee && getDist(k, player) < KAMI_TRIGGER_DIST + 40) {
                ctx2.save();
                ctx2.globalAlpha = 0.4 + Math.sin(Date.now() / 80) * 0.3;
                ctx2.beginPath();
                ctx2.arc(k.x, k.y, k.radius + 8 + Math.sin(Date.now() / 100) * 3, 0, Math.PI * 2);
                ctx2.strokeStyle = '#e67e22';
                ctx2.lineWidth = 2;
                ctx2.stroke();
                ctx2.restore();
            }
            ctx2.save();
            ctx2.translate(k.x, k.y);
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-15, -k.radius - 12, 30, 4);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-15, -k.radius - 12, 30 * (k.hp / k.maxHp), 4);
            ctx2.rotate(k.angle);
            ctx2.beginPath();
            ctx2.moveTo(k.radius, 0);
            ctx2.lineTo(-k.radius, -k.radius * 0.8);
            ctx2.lineTo(-k.radius, k.radius * 0.8);
            ctx2.closePath();
            ctx2.fillStyle = '#e67e22'; ctx2.fill();
            ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
            ctx2.save();
            ctx2.globalAlpha = 0.9;
            ctx2.fillStyle = '#fff5e1';
            ctx2.font = 'bold 14px Arial';
            ctx2.textAlign = 'center';
            ctx2.fillText('!', k.x, k.y + 5);
            ctx2.restore();
        });
    });

    // Arena dönüşü
    (function () {
        const diffNormal = document.getElementById('diff-normal');
        const diffEasy = document.getElementById('diff-easy');
        if (diffNormal) {
            diffNormal.addEventListener('click', () => { window.GAME_MODE = 'arena'; });
            diffNormal.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true });
        }
        if (diffEasy) {
            diffEasy.addEventListener('click', () => { window.GAME_MODE = 'arena'; });
            diffEasy.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true });
        }
    })();

    window.GAME_EXT.modKartiEkle('turuncu', 'Turuncu Baskın', 'Piyade + Turuncu Bot + Kamikaze');

    console.log('[MOD YÜKLENDİ] turuncu (v5)');
})();