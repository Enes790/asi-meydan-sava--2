// ========== mod10.js (TURUNCU BASKIN) - v7 ==========
// - Piyade, Turuncu, Kamikaze, Mini-Kamikaze, Havan (3s ateş, 400 hasar, 100 radius)
// - RANGER: 1000 HP, 15s spawn (max 1), 5 mermi × 100 hasar, 0.4s aralık, 2s cooldown
//   Aura: heal 200/3s, +0.6 hız, max 3 bot, aura içindeki kamikazeler +200 duvar hasarı
// - Yuva aktif: her 10 kill'de bir yuva spawn, slime üretir
// - Siper canı 2500

(function () {
    'use strict';

    const MOD_ID = 'turuncu';

    // ---- Piyade ----
    const PIYADE_HP = 3000;
    const PIYADE_RADIUS = 20;
    const PIYADE_SPEED = 1.36;
    const PIYADE_SHOOT_INTERVAL = 1600;
    const PIYADE_ENGAGE_DIST = 180;
    const PIYADE_RANGE = 300;
    const PIYADE_RESPAWN_WAIT = 180;
    const PIYADE_SPAWN_WARN = 180;
    const PIYADE_DEATH_MERMI_SAYISI = 4;
    const PIYADE_DEATH_MERMI_HASAR = 450;
    const PIYADE_DEATH_MERMI_MENZIL = 420;
    const PIYADE_DEATH_MERMI_HIZ = PLAYER_BULLET_SPEED * 0.7;
    const PIYADE_DEATH_MERMI_RADIUS = 10;

    // ---- Turuncu Bot (sınırsız menzil) ----
    const TURUNCU_HP = 2500;
    const TURUNCU_RADIUS = 22;
    const TURUNCU_SHOOT_INTERVAL = 750;
    const TURUNCU_SPAWN_FRAME = 1500;
    const TURUNCU_SPAWN_WARN = 180;

    // ---- Kamikaze ----
    const KAMI_HP = 1200;
    const KAMI_RADIUS = 16;
    const KAMI_SPEED = 1.3;
    const KAMI_MAX = 2;
    const KAMI_SPAWN_WARN = 150;
    const KAMI_TRIGGER_DIST = 70;
    const KAMI_PLAYER_DMG = 500;
    const KAMI_PLAYER_RADIUS = 90;
    const KAMI_KNOCKBACK = 30;
    const KAMI_WALL_DMG = 1000;
    const KAMI_WALL_AOE = 600;
    const KAMI_WALL_AOE_RADIUS = 100;
    const KAMI_STUCK_FRAMES = 30;
    const KAMI_KILL_TRIGGER = 6;
    const KAMI_TIMER_TRIGGER = 1500;

    // ---- Mini-Kamikaze ----
    const MINI_HP = 400;
    const MINI_RADIUS = 12;
    const MINI_SPEED = 1.3;
    const MINI_MAX = 2;
    const MINI_TRIGGER_DIST = 60;
    const MINI_PLAYER_DMG = 300;
    const MINI_PLAYER_RADIUS = 70;
    const MINI_KNOCKBACK = 20;
    const MINI_WALL_DMG = 500;
    const MINI_WALL_AOE = 300;
    const MINI_WALL_AOE_RADIUS = 80;
    const MINI_STUCK_FRAMES = 30;

    // ---- Havan ----
    const HAVAN_HP = 5000;
    const HAVAN_RADIUS = 26;
    const HAVAN_SPAWN_TIME = 1500;
    const HAVAN_SPAWN_WARN = 240;
    const HAVAN_SHOOT_INTERVAL = 180; // 3 saniye
    const HAVAN_MERMI_HASAR = 400;
    const HAVAN_MERMI_AOE = 100;
    const HAVAN_SIPER_HASAR = 150;
    const HAVAN_MERMI_FLIGHT = 90;

    // ---- Ranger ----
    const RANGER_HP = 1000;
    const RANGER_RADIUS = 18;
    const RANGER_SPEED = 1.0;
    const RANGER_RANGE = 250;
    const RANGER_BULLET_DMG = 100;
    const RANGER_BULLET_SPEED = PLAYER_BULLET_SPEED * 0.8;
    const RANGER_SHOT_INTERVAL = 24;   // 0.4s
    const RANGER_SHOT_COUNT = 5;
    const RANGER_COOLDOWN = 120;       // 2s
    const RANGER_SPAWN_INTERVAL = 900; // 15s
    const RANGER_SPAWN_WARN = 180;     // 3s
    const RANGER_AURA_RADIUS = 150;
    const RANGER_AURA_HEAL = 200;
    const RANGER_AURA_HEAL_INTERVAL = 180; // 3s
    const RANGER_AURA_SPEED_BONUS = 0.6;
    const RANGER_AURA_MAX_BOTS = 3;
    const RANGER_KAMI_AURA_BONUS = 200;

    const SIPER_CAN = 2500;

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
    let miniKamikazeler = [];
    let kamiSpawnUyarilari = [];
    let kamiTimerCount = 0;
    let modKillCount = 0;

    let havanBot = null;
    let havanSpawnTimer = 0;
    let havanSpawnUyari = 0;
    let havanSpawnX = 0, havanSpawnY = 0;
    let havanShootTimer = 0;
    let havanMermiler = [];

    let ranger = null;
    let rangerSpawnTimer = 0;
    let rangerSpawnUyari = 0;
    let rangerSpawnX = 0, rangerSpawnY = 0;
    let rangerShotState = 'idle';
    let rangerShotCount = 0;
    let rangerShotTimer = 0;
    let rangerCooldownTimer = 0;
    let rangerAuraTimer = 0;
    let rangerBullets = [];

    function rawDamageText(x, y, val, color) {
        floatingNumbers.push({
            x: x + (Math.random() - .5) * 20,
            y: y - 20,
            val: val, color: color || "#e74c3c",
            life: 60, opacity: 1
        });
    }

    function clearRangerBuffs() {
        const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b);
        allBots.forEach(b => {
            if (b._rangerBuffed) {
                b.speed = b._rangerOrigSpeed;
                b._rangerBuffed = false;
            }
        });
    }

    // ---- Spawn fonksiyonları ----
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
            color: '#d35400', kbX: 0, kbY: 0
        };
        spawnParticles(piyade.x, piyade.y, '#d35400', 'smoke');
    }

    function spawnTuruncuUyari() {
        turuncuSpawnX = Math.random() * (canvas.width - 200) + 100;
        turuncuSpawnY = Math.random() * (canvas.height - 200) + 100;
        turuncuSpawnUyari = TURUNCU_SPAWN_WARN;
    }

    function dogurTuruncuBot() {
        turuncuBot = {
            x: turuncuSpawnX, y: turuncuSpawnY,
            radius: TURUNCU_RADIUS,
            hp: TURUNCU_HP, maxHp: TURUNCU_HP,
            speed: 0, angle: 0, lastShot: 0,
            shootInterval: TURUNCU_SHOOT_INTERVAL,
            isDead: false, isActive: true,
            color: '#e67e22', kbX: 0, kbY: 0
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
            x, y, radius: KAMI_RADIUS,
            hp: KAMI_HP, maxHp: KAMI_HP, speed: KAMI_SPEED,
            angle: 0, isDead: false, isActive: true,
            color: '#e67e22', kbX: 0, kbY: 0,
            _stuckTimer: 0, _lastX: x, _lastY: y
        });
        spawnParticles(x, y, '#e67e22', 'smoke');
    }

    function dogurMiniKamikaze(x, y) {
        miniKamikazeler.push({
            x, y, radius: MINI_RADIUS,
            hp: MINI_HP, maxHp: MINI_HP, speed: MINI_SPEED,
            angle: 0, isDead: false, isActive: true,
            color: '#f39c12', kbX: 0, kbY: 0,
            _stuckTimer: 0, _lastX: x, _lastY: y
        });
        spawnParticles(x, y, '#f39c12', 'smoke');
    }

    function spawnHavanUyari() {
        havanSpawnX = Math.random() * (canvas.width - 300) + 150;
        havanSpawnY = Math.random() * (canvas.height - 300) + 150;
        havanSpawnUyari = HAVAN_SPAWN_WARN;
    }

    function dogurHavan() {
        havanBot = {
            x: havanSpawnX, y: havanSpawnY,
            radius: HAVAN_RADIUS,
            hp: HAVAN_HP, maxHp: HAVAN_HP,
            speed: 0, angle: 0, lastShot: 0,
            isDead: false, isActive: true,
            color: '#7f1d1d', kbX: 0, kbY: 0
        };
        havanShootTimer = 0;
        spawnParticles(havanBot.x, havanBot.y, '#7f1d1d', 'smoke');
        explosions.push({ x: havanBot.x, y: havanBot.y, radius: 10, maxRadius: 80, life: 15, maxLife: 15 });
    }

    function havanAtes() {
        if (!havanBot || havanBot.isDead || player.isDead) return;
        havanMermiler.push({
            x: player.x, y: player.y,
            startX: havanBot.x, startY: havanBot.y,
            flightTimer: HAVAN_MERMI_FLIGHT,
            maxFlight: HAVAN_MERMI_FLIGHT,
            isDead: false
        });
        addFloatingNumber(havanBot.x, havanBot.y - 30, "HAVAN!", "#7f1d1d", false);
    }

    function spawnRangerUyari() {
        rangerSpawnX = Math.random() * (canvas.width - 200) + 100;
        rangerSpawnY = Math.random() * (canvas.height - 200) + 100;
        rangerSpawnUyari = RANGER_SPAWN_WARN;
    }

    function dogurRanger() {
        ranger = {
            x: rangerSpawnX, y: rangerSpawnY,
            radius: RANGER_RADIUS,
            hp: RANGER_HP, maxHp: RANGER_HP,
            angle: 0, isDead: false, isActive: true,
            color: '#f1c40f'
        };
        rangerShotState = 'idle';
        rangerShotCount = 0;
        rangerShotTimer = 0;
        rangerCooldownTimer = 0;
        rangerAuraTimer = 0;
        spawnParticles(ranger.x, ranger.y, '#f1c40f', 'smoke');
    }

    function piyadeOlumMermiSac(px, py) {
        for (let i = 0; i < PIYADE_DEATH_MERMI_SAYISI; i++) {
            const a = (Math.PI / 4) + (i * Math.PI / 2);
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

        const inRangerAura = ranger && !ranger.isDead && getDist(kami, ranger) < RANGER_AURA_RADIUS;
        const wallBonus = inRangerAura ? RANGER_KAMI_AURA_BONUS : 0;

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
            target.hp -= (KAMI_WALL_DMG + wallBonus);
            rawDamageText(target.x, target.y, KAMI_WALL_DMG + wallBonus, "#e74c3c");
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (o !== target && getDist(kami, o) < KAMI_WALL_AOE_RADIUS + o.radius) {
                    o.hp -= KAMI_WALL_AOE;
                    rawDamageText(o.x, o.y, KAMI_WALL_AOE, "#e74c3c");
                }
            }
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
                size: 3 + Math.random() * 3, type: 'normal'
            });
        }

        kami.isDead = true;
        triggerBotKill(kami.x, kami);
    }

    function miniPatlat(mini) {
        explosions.push({
            x: mini.x, y: mini.y,
            radius: 8, maxRadius: MINI_PLAYER_RADIUS,
            life: 12, maxLife: 12
        });
        screenShake = 4;
        if (!player.isDead && !player.jumpInvulnerable && getDist(mini, player) < MINI_PLAYER_RADIUS + player.radius) {
            player.hp -= MINI_PLAYER_DMG;
            rawDamageText(player.x, player.y, MINI_PLAYER_DMG, "#e74c3c");
            player.lastHitTime = Date.now();
            const ang = getAngle(mini, player);
            player.x += Math.cos(ang) * MINI_KNOCKBACK;
            player.y += Math.sin(ang) * MINI_KNOCKBACK;
        }
        for (let i = 0; i < 8; i++) {
            const ang = Math.random() * Math.PI * 2;
            const sp = 2 + Math.random() * 3;
            particles.push({
                x: mini.x, y: mini.y,
                vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                life: 20, maxLife: 20,
                color: Math.random() < 0.5 ? '#f39c12' : '#c0392b',
                size: 2 + Math.random() * 2, type: 'normal'
            });
        }
        mini.isDead = true;
        triggerBotKill(mini.x, mini);
    }

    function miniDuvarPatlat(mini, target) {
        explosions.push({
            x: mini.x, y: mini.y,
            radius: 8, maxRadius: MINI_WALL_AOE_RADIUS,
            life: 12, maxLife: 12
        });
        screenShake = 4;

        const inRangerAura = ranger && !ranger.isDead && getDist(mini, ranger) < RANGER_AURA_RADIUS;
        const wallBonus = inRangerAura ? RANGER_KAMI_AURA_BONUS : 0;

        if (target) {
            target.hp -= (MINI_WALL_DMG + wallBonus);
            rawDamageText(target.x, target.y, MINI_WALL_DMG + wallBonus, "#e74c3c");
        }
        for (const o of obstacles.concat(cactusWalls || [])) {
            if (o !== target && getDist(mini, o) < MINI_WALL_AOE_RADIUS + o.radius) {
                o.hp -= MINI_WALL_AOE;
                rawDamageText(o.x, o.y, MINI_WALL_AOE, "#e74c3c");
            }
        }
        if (!player.isDead && !player.jumpInvulnerable && getDist(mini, player) < MINI_WALL_AOE_RADIUS + player.radius) {
            player.hp -= MINI_WALL_AOE;
            rawDamageText(player.x, player.y, MINI_WALL_AOE, "#e74c3c");
            player.lastHitTime = Date.now();
        }
        mini.isDead = true;
        triggerBotKill(mini.x, mini);
    }

    window.GAME_EXT.registerMode(MOD_ID, {
        label: 'Turuncu Baskın',
        onStart: function () {
            piyade = null; piyadeSpawnTimer = 0; piyadeRespawnTimer = 0;
            piyadeDeathMermiler = [];
            turuncuBot = null; turuncuSpawnFrame = 0; turuncuSpawnUyari = 0;
            kamikazeler = []; miniKamikazeler = []; kamiSpawnUyarilari = [];
            kamiTimerCount = 0; modKillCount = 0;
            havanBot = null; havanSpawnTimer = 0; havanSpawnUyari = 0; havanShootTimer = 0;
            havanMermiler = [];
            ranger = null; rangerSpawnTimer = 0; rangerSpawnUyari = 0;
            rangerShotState = 'idle'; rangerShotCount = 0; rangerShotTimer = 0;
            rangerCooldownTimer = 0; rangerAuraTimer = 0; rangerBullets = [];

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
            // NOT: spawnIndicators ve nests TEMİZLENMEZ — yuva spawn çalışsın

            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true; bot2.hp = 0;
            bot2.x = -9999; bot2.y = -9999;

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
                }
            }

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
                    if (getDist(m, o) < o.radius + m.radius) { o.hp -= 100; sipereCarpti = true; break; }
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
                    spawnTuruncuUyari();
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

            // ========== HAVAN ==========
            if (!havanBot && havanSpawnUyari === 0 && havanSpawnTimer < HAVAN_SPAWN_TIME) {
                havanSpawnTimer += ts;
                if (havanSpawnTimer >= HAVAN_SPAWN_TIME) spawnHavanUyari();
            }
            if (havanSpawnUyari > 0) {
                havanSpawnUyari -= ts;
                if (havanSpawnUyari <= 0) dogurHavan();
            }
            if (havanBot && !havanBot.isDead) {
                if (havanBot.hp <= 0) {
                    havanBot.isDead = true;
                    spawnParticles(havanBot.x, havanBot.y, havanBot.color, 'smoke');
                    triggerBotKill(havanBot.x, havanBot);
                    havanBot = null;
                } else {
                    havanShootTimer += ts;
                    if (havanShootTimer >= HAVAN_SHOOT_INTERVAL) {
                        havanShootTimer = 0;
                        havanAtes();
                    }
                }
            }

            for (let i = havanMermiler.length - 1; i >= 0; i--) {
                const m = havanMermiler[i];
                if (m.isDead) { havanMermiler.splice(i, 1); continue; }
                m.flightTimer -= ts;
                if (m.flightTimer <= 0) {
                    explosions.push({ x: m.x, y: m.y, radius: 5, maxRadius: HAVAN_MERMI_AOE, life: 15, maxLife: 15 });
                    screenShake = 10;
                    if (!player.isDead && !player.jumpInvulnerable && getDist(m, player) < HAVAN_MERMI_AOE + player.radius) {
                        player.hp -= HAVAN_MERMI_HASAR;
                        rawDamageText(player.x, player.y, HAVAN_MERMI_HASAR, "#e74c3c");
                        player.lastHitTime = Date.now();
                    }
                    for (const o of obstacles.concat(cactusWalls || [])) {
                        if (getDist(m, o) < HAVAN_MERMI_AOE + o.radius) o.hp -= HAVAN_SIPER_HASAR;
                    }
                    if (miniKamikazeler.length < MINI_MAX) dogurMiniKamikaze(m.x, m.y);
                    m.isDead = true;
                }
            }

            // ========== KAMİKAZE ==========
            for (let i = kamiSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = kamiSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) { dogurKamikaze(u.x, u.y); kamiSpawnUyarilari.splice(i, 1); }
            }

            kamiTimerCount += ts;
            if (kamiTimerCount >= KAMI_TIMER_TRIGGER) {
                kamiTimerCount = 0;
                if (kamikazeler.length === 0 && kamiSpawnUyarilari.length === 0 && miniKamikazeler.length === 0) {
                    spawnKamikazeUyari();
                }
            }

            for (let i = kamikazeler.length - 1; i >= 0; i--) {
                const k = kamikazeler[i];
                if (k.isDead) { kamikazeler.splice(i, 1); continue; }
                if (k.hp <= 0) { kamikazePatlat(k, 'player', null); continue; }
                const canSee = !player.isDead && !player.isInvisible && !player.jumpInvulnerable;
                const dP = getDist(k, player);
                if (canSee && dP < KAMI_TRIGGER_DIST) { kamikazePatlat(k, 'player', null); continue; }
                k._lastX = k.x; k._lastY = k.y;
                if (!player.isInvisible && !player.isDead) {
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
                const moved = Math.hypot(k.x - k._lastX, k.y - k._lastY);
                if (moved < k.speed * ts * 0.4) k._stuckTimer += ts; else k._stuckTimer = 0;
                if (k._stuckTimer >= KAMI_STUCK_FRAMES) {
                    let yakinDuvar = null, enYakin = Infinity;
                    for (const o of obstacles.concat(cactusWalls || [])) {
                        const d = getDist(k, o) - o.radius - k.radius;
                        if (d < 30 && d < enYakin) { enYakin = d; yakinDuvar = o; }
                    }
                    kamikazePatlat(k, yakinDuvar ? 'wall' : 'player', yakinDuvar);
                }
            }

            // ========== MİNİ KAMİKAZE ==========
            for (let i = miniKamikazeler.length - 1; i >= 0; i--) {
                const k = miniKamikazeler[i];
                if (k.isDead) { miniKamikazeler.splice(i, 1); continue; }
                if (k.hp <= 0) { miniPatlat(k); continue; }
                const canSee = !player.isDead && !player.isInvisible && !player.jumpInvulnerable;
                const dP = getDist(k, player);
                if (canSee && dP < MINI_TRIGGER_DIST) { miniPatlat(k); continue; }
                k._lastX = k.x; k._lastY = k.y;
                if (!player.isInvisible && !player.isDead) {
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
                const moved = Math.hypot(k.x - k._lastX, k.y - k._lastY);
                if (moved < k.speed * ts * 0.4) k._stuckTimer += ts; else k._stuckTimer = 0;
                if (k._stuckTimer >= MINI_STUCK_FRAMES) {
                    let yakinDuvar = null, enYakin = Infinity;
                    for (const o of obstacles.concat(cactusWalls || [])) {
                        const d = getDist(k, o) - o.radius - k.radius;
                        if (d < 30 && d < enYakin) { enYakin = d; yakinDuvar = o; }
                    }
                    if (yakinDuvar) miniDuvarPatlat(k, yakinDuvar);
                    else miniPatlat(k);
                }
            }

            // ========== RANGER ==========
            if (!ranger) {
                if (rangerSpawnUyari > 0) {
                    rangerSpawnUyari -= ts;
                    if (rangerSpawnUyari <= 0) dogurRanger();
                } else {
                    rangerSpawnTimer += ts;
                    if (rangerSpawnTimer >= RANGER_SPAWN_INTERVAL) {
                        rangerSpawnTimer = 0;
                        spawnRangerUyari();
                    }
                }
            }

            if (ranger && !ranger.isDead) {
                if (ranger.hp <= 0) {
                    ranger.isDead =