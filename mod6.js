// ========== mod10.js (TURUNCU BASKIN) - v12 FINAL ==========
(function () {
    'use strict';

    const MOD_ID = 'turuncu';

    // ---- Piyade ----
    const PIYADE_HP = 3000; const PIYADE_RADIUS = 20; const PIYADE_SPEED = 1.36;
    const PIYADE_SHOOT_INTERVAL = 1600; const PIYADE_ENGAGE_DIST = 180; const PIYADE_RANGE = 300;
    const PIYADE_RESPAWN_WAIT = 180; const PIYADE_SPAWN_WARN = 180;
    const PIYADE_DEATH_MERMI_SAYISI = 4; const PIYADE_DEATH_MERMI_HASAR = 450;
    const PIYADE_DEATH_MERMI_MENZIL = 420; const PIYADE_DEATH_MERMI_HIZ = PLAYER_BULLET_SPEED * 0.7;
    const PIYADE_DEATH_MERMI_RADIUS = 10;

    // ---- Turuncu Bot ----
    const TURUNCU_HP = 2500; const TURUNCU_RADIUS = 22; const TURUNCU_SHOOT_INTERVAL = 750;
    const TURUNCU_SPAWN_FRAME = 1500; const TURUNCU_SPAWN_WARN = 180;

    // ---- Kamikaze ----
    const KAMI_HP = 1200; const KAMI_RADIUS = 16; const KAMI_SPEED = 1.3; const KAMI_MAX = 2;
    const KAMI_SPAWN_WARN = 150; const KAMI_TRIGGER_DIST = 70; const KAMI_PLAYER_DMG = 500;
    const KAMI_PLAYER_RADIUS = 90; const KAMI_KNOCKBACK = 30; const KAMI_WALL_DMG = 1000;
    const KAMI_WALL_AOE = 600; const KAMI_WALL_AOE_RADIUS = 100; const KAMI_STUCK_FRAMES = 30;
    const KAMI_KILL_TRIGGER = 6; const KAMI_TIMER_TRIGGER = 1500;

    // ---- Mini-Kamikaze ----
    const MINI_HP = 500; const MINI_RADIUS = 12; const MINI_SPEED = 1.3; const MINI_MAX = 3;
    const MINI_TRIGGER_DIST = 60; const MINI_PLAYER_DMG = 300; const MINI_PLAYER_RADIUS = 70;
    const MINI_KNOCKBACK = 20; const MINI_WALL_DMG = 500; const MINI_WALL_AOE = 300;
    const MINI_WALL_AOE_RADIUS = 80; const MINI_STUCK_FRAMES = 30;

    // ---- Havan ----
    const HAVAN_HP = 6000; const HAVAN_RADIUS = 26; const HAVAN_SHOOT_INTERVAL = 120;
    const HAVAN_MERMI_HASAR = 500; const HAVAN_MERMI_AOE = 100; const HAVAN_SIPER_HASAR = 220;
    const HAVAN_MERMI_FLIGHT = 90;

    // ---- Çavuş ----
    const CAVUS_HP = 6500; const CAVUS_RADIUS = 24; const CAVUS_SPEED = 0.7;
    const CAVUS_SHOOT_INTERVAL = 60; const CAVUS_MERMI_HASAR = 400;
    const CAVUS_AURA_RADIUS = 150; const CAVUS_AURA_DURATION = 390; const CAVUS_AURA_COOLDOWN = 300;
    const CAVUS_DMG_REDIRECT = 0.40; const CAVUS_STOP_DIST = 150;

    // ---- Öfke ----
    const RAGE_DURATION = 180;
    const RAGE_ATK_MULT = 2; const RAGE_SPEED_MULT = 2;

    // ---- Ağır Bot Spawn ----
    const HEAVY_SPAWN_TIME = 1500; const HEAVY_SPAWN_WARN = 240;

    // ---- Ranger (Lobutçu) ----
    const RANGER_HP = 1000; const RANGER_RADIUS = 18; const RANGER_SPEED = 2.5;
    const RANGER_RANGE = 200; // Lobut atma menzili
    const RANGER_LOBUT_FLIGHT = 60; // 1 saniye havada
    const RANGER_LOBUT_AOE = 60; // Düştüğü alan
    const RANGER_LOBUT_HASAR = 300;
    const RANGER_LOBUT_COOLDOWN = 150; // 2.5 saniye ateş aralığı
    const RANGER_RMINI_HP = 300; const RANGER_RMINI_SPEED = 2.0;
    const RANGER_RMINI_DMG = 100; const RANGER_RMINI_RADIUS = 8;
    const RANGER_SPAWN_INTERVAL = 2400; const RANGER_SPAWN_WARN = 180;
    const RANGER_AURA_RADIUS = 60; const RANGER_AURA_HEAL = 450;
    const RANGER_AURA_HEAL_INTERVAL = 160; const RANGER_AURA_SPEED_BONUS = 0.8;
    const RANGER_AURA_MAX_BOTS = 10;

    const SIPER_CAN = 3000;

    // ---- Durum ----
    let piyade = null; let piyadeSpawnTimer = 0; let piyadeRespawnTimer = 0;
    let piyadeSpawnX = 0, piyadeSpawnY = 0; let piyadeDeathMermiler = [];

    let turuncuBot = null; let turuncuSpawnFrame = 0; let turuncuSpawnUyari = 0;
    let turuncuSpawnX = 0, turuncuSpawnY = 0;

    let kamikazeler = []; let miniKamikazeler = []; let kamiSpawnUyarilari = [];
    let kamiTimerCount = 0; let modKillCount = 0;

    let heavyBot = null; let heavyBotType = 'havan'; let heavySpawnTimer = 0;
    let heavySpawnUyari = 0; let heavySpawnX = 0, heavySpawnY = 0;

    let havanShootTimer = 0; let havanMermiler = []; let havanMuzzleFlash = 0;

    let cavusShootTimer = 0; let cavusAuraTimer = 0; let cavusAuraCooldown = 0;
    let cavusAuraActive = false; let cavusAuraTick = 0;
    let botPrevHp = new Map();

    let ranger = null; let rangerSpawnTimer = 0; let rangerSpawnUyari = 0;
    let rangerSpawnX = 0, rangerSpawnY = 0;
    let rangerLobutCooldown = 0; let rangerAuraTimer = 0;
    let rangerLobuts = [];

    let rageActive = false; let rageTimer = 0;

    function rawDamageText(x, y, val, color) {
        floatingNumbers.push({
            x: x + (Math.random() - .5) * 20, y: y - 20, val: val,
            color: color || "#e74c3c", life: 60, opacity: 1
        });
    }

    function clearAllBuffs() {
        const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b);
        allBots.forEach(b => {
            if (b._rangerBuffed) { b.speed = b._rangerOrigSpeed; b._rangerBuffed = false; }
            if (b._rageActive) { b.speed = b._rageOrigSpeed; b.shootInterval = b._rageOrigInterval; b._rageActive = false; }
        });
    }

    // ===== SPAWN FONKSİYONLARI =====
    function spawnPiyadeUyari() {
        piyadeSpawnX = Math.random() * (canvas.width - 200) + 100;
        piyadeSpawnY = Math.random() * (canvas.height - 200) + 100;
        piyadeSpawnTimer = PIYADE_SPAWN_WARN;
    }

    function dogurPiyade() {
        piyade = {
            x: piyadeSpawnX, y: piyadeSpawnY, radius: PIYADE_RADIUS,
            hp: PIYADE_HP, maxHp: PIYADE_HP, speed: PIYADE_SPEED, angle: 0, lastShot: 0,
            shootInterval: PIYADE_SHOOT_INTERVAL, isDead: false, isActive: true,
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
            x: turuncuSpawnX, y: turuncuSpawnY, radius: TURUNCU_RADIUS,
            hp: TURUNCU_HP, maxHp: TURUNCU_HP, speed: 0, angle: 0, lastShot: 0,
            shootInterval: TURUNCU_SHOOT_INTERVAL, isDead: false, isActive: true,
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
            x, y, radius: KAMI_RADIUS, hp: KAMI_HP, maxHp: KAMI_HP, speed: KAMI_SPEED,
            angle: 0, isDead: false, isActive: true, color: '#e67e22', kbX: 0, kbY: 0,
            _stuckTimer: 0, _lastX: x, _lastY: y
        });
        spawnParticles(x, y, '#e67e22', 'smoke');
    }

    function dogurMiniKamikaze(x, y) {
        miniKamikazeler.push({
            x, y, radius: MINI_RADIUS, hp: MINI_HP, maxHp: MINI_HP, speed: MINI_SPEED,
            angle: 0, isDead: false, isActive: true, color: '#f39c12', kbX: 0, kbY: 0,
            _stuckTimer: 0, _lastX: x, _lastY: y, _customDmg: MINI_PLAYER_DMG
        });
        spawnParticles(x, y, '#f39c12', 'smoke');
    }

    function dogurRangerMini(x, y) {
        miniKamikazeler.push({
            x, y, radius: RANGER_RMINI_RADIUS, hp: RANGER_RMINI_HP, maxHp: RANGER_RMINI_HP,
            speed: RANGER_RMINI_SPEED, angle: 0, isDead: false, isActive: true,
            color: '#ff8c00', kbX: 0, kbY: 0, _stuckTimer: 0, _lastX: x, _lastY: y,
            _customDmg: RANGER_RMINI_DMG, _isRangerMini: true
        });
        spawnParticles(x, y, '#ff8c00', 'smoke');
    }

    function spawnHeavyUyari() {
        heavySpawnX = Math.random() * (canvas.width - 300) + 150;
        heavySpawnY = Math.random() * (canvas.height - 300) + 150;
        heavySpawnUyari = HEAVY_SPAWN_WARN;
    }

    function dogurHeavyBot() {
        if (heavyBotType === 'havan') {
            heavyBot = {
                x: heavySpawnX, y: heavySpawnY, radius: HAVAN_RADIUS,
                hp: HAVAN_HP, maxHp: HAVAN_HP, speed: 0, angle: 0, lastShot: 0,
                isDead: false, isActive: true, color: '#7f1d1d', kbX: 0, kbY: 0, type: 'havan'
            };
            havanShootTimer = 0; havanMuzzleFlash = 0;
            spawnParticles(heavyBot.x, heavyBot.y, '#7f1d1d', 'smoke');
            explosions.push({ x: heavyBot.x, y: heavyBot.y, radius: 10, maxRadius: 80, life: 15, maxLife: 15 });
        } else {
            heavyBot = {
                x: heavySpawnX, y: heavySpawnY, radius: CAVUS_RADIUS,
                hp: CAVUS_HP, maxHp: CAVUS_HP, shield: 0, speed: CAVUS_SPEED, angle: 0,
                lastShot: 0, shootInterval: CAVUS_SHOOT_INTERVAL, isDead: false, isActive: true,
                color: '#b8860b', kbX: 0, kbY: 0, type: 'cavus'
            };
            cavusShootTimer = 0; cavusAuraTimer = 0; cavusAuraCooldown = 0;
            cavusAuraActive = false; cavusAuraTick = 0;
            spawnParticles(heavyBot.x, heavyBot.y, '#b8860b', 'smoke');
            explosions.push({ x: heavyBot.x, y: heavyBot.y, radius: 10, maxRadius: 80, life: 15, maxLife: 15 });
        }
    }

    function havanAtes() {
        if (!heavyBot || heavyBot.isDead || player.isDead) return;
        havanMermiler.push({
            x: player.x, y: player.y, startX: heavyBot.x, startY: heavyBot.y,
            flightTimer: HAVAN_MERMI_FLIGHT, maxFlight: HAVAN_MERMI_FLIGHT, isDead: false
        });
        havanMuzzleFlash = 15;
    }

    function spawnRangerUyari() {
        rangerSpawnX = Math.random() * (canvas.width - 200) + 100;
        rangerSpawnY = Math.random() * (canvas.height - 200) + 100;
        rangerSpawnUyari = RANGER_SPAWN_WARN;
    }

    function dogurRanger() {
        ranger = {
            x: rangerSpawnX, y: rangerSpawnY, radius: RANGER_RADIUS,
            hp: RANGER_HP, maxHp: RANGER_HP, angle: 0, isDead: false, isActive: true,
            color: '#e67e22'
        };
        rangerLobutCooldown = 0; rangerAuraTimer = 0;
        spawnParticles(ranger.x, ranger.y, '#e67e22', 'smoke');
    }

    // ===== LOBUT FONKSİYONU =====
    function rangerLobutAt() {
        if (!ranger || ranger.isDead || player.isDead) return;
        rangerLobuts.push({
            startX: ranger.x, startY: ranger.y,
            targetX: player.x, targetY: player.y,
            flightTimer: RANGER_LOBUT_FLIGHT, maxFlight: RANGER_LOBUT_FLIGHT,
            isDead: false
        });
        rangerLobutCooldown = RANGER_LOBUT_COOLDOWN;
    }

    function piyadeOlumMermiSac(px, py) {
        for (let i = 0; i < PIYADE_DEATH_MERMI_SAYISI; i++) {
            const a = (Math.PI / 4) + (i * Math.PI / 2);
            piyadeDeathMermiler.push({
                x: px, y: py, sx: px, sy: py,
                vx: Math.cos(a) * PIYADE_DEATH_MERMI_HIZ,
                vy: Math.sin(a) * PIYADE_DEATH_MERMI_HIZ,
                radius: PIYADE_DEATH_MERMI_RADIUS, hasar: PIYADE_DEATH_MERMI_HASAR,
                menzil: PIYADE_DEATH_MERMI_MENZIL, isDead: false
            });
        }
    }

    function heavyBotHasarAl(b, dmg) {
        if (b.shield > 0) {
            let kalan = dmg - b.shield;
            b.shield -= dmg;
            if (b.shield < 0) b.shield = 0;
            if (kalan > 0) b.hp -= kalan;
        } else {
            b.hp -= dmg;
        }
    }

    function triggerRage() {
        const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b && !b.isDead);
        allBots.forEach(b => {
            if (!b._rageActive) {
                b._rageActive = true;
                b._rageOrigSpeed = b.speed;
                b._rageOrigInterval = b.shootInterval || 1600;
                b.speed = b._rageOrigSpeed * RAGE_SPEED_MULT;
                b.shootInterval = b._rageOrigInterval / RAGE_ATK_MULT;
            }
        });
        rageActive = true; rageTimer = RAGE_DURATION;
        screenShake = 15;
        rawDamageText(player.x, player.y - 40, "ÖFKE!", "#ff0000");
    }

    function kamikazePatlat(kami, targetType, target) {
        const explRadius = targetType === 'wall' ? KAMI_WALL_AOE_RADIUS : KAMI_PLAYER_RADIUS;
        explosions.push({ x: kami.x, y: kami.y, radius: 10, maxRadius: explRadius, life: 15, maxLife: 15 });
        screenShake = 8;

        const inCavusAura = heavyBot && heavyBot.type === 'cavus' && !heavyBot.isDead && cavusAuraActive && getDist(kami, heavyBot) < CAVUS_AURA_RADIUS;
        let dmgMult = inCavusAura ? 2 : 1;
        if (kami._rageActive) dmgMult *= 2;

        const finalPlayerDmg = KAMI_PLAYER_DMG * dmgMult;
        const finalWallDmg = KAMI_WALL_DMG * dmgMult;

        if (targetType === 'player') {
            if (!player.isDead && !player.jumpInvulnerable && getDist(kami, player) < KAMI_PLAYER_RADIUS + player.radius) {
                player.hp -= finalPlayerDmg;
                rawDamageText(player.x, player.y, finalPlayerDmg, "#e74c3c");
                player.lastHitTime = Date.now();
                const ang = getAngle(kami, player);
                player.x += Math.cos(ang) * KAMI_KNOCKBACK;
                player.y += Math.sin(ang) * KAMI_KNOCKBACK;
                player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
                player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
            }
        } else if (targetType === 'wall' && target) {
            target.hp -= finalWallDmg;
            rawDamageText(target.x, target.y, finalWallDmg, "#e74c3c");
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (o !== target && getDist(kami, o) < KAMI_WALL_AOE_RADIUS + o.radius) {
                    o.hp -= KAMI_WALL_AOE * dmgMult;
                }
            }
            if (!player.isDead && !player.jumpInvulnerable && getDist(kami, player) < KAMI_WALL_AOE_RADIUS + player.radius) {
                player.hp -= KAMI_WALL_AOE * dmgMult;
                rawDamageText(player.x, player.y, KAMI_WALL_AOE * dmgMult, "#e74c3c");
                player.lastHitTime = Date.now();
            }
        }
        for (let i = 0; i < 15; i++) {
            const ang = Math.random() * Math.PI * 2; const sp = 3 + Math.random() * 5;
            particles.push({ x: kami.x, y: kami.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 25, maxLife: 25, color: Math.random() < 0.5 ? '#e67e22' : '#c0392b', size: 3 + Math.random() * 3, type: 'normal' });
        }
        kami.isDead = true; triggerBotKill(kami.x, kami);
    }

    function miniPatlat(mini) {
        explosions.push({ x: mini.x, y: mini.y, radius: 8, maxRadius: MINI_PLAYER_RADIUS, life: 12, maxLife: 12 });
        screenShake = 4;
        const inCavusAura = heavyBot && heavyBot.type === 'cavus' && !heavyBot.isDead && cavusAuraActive && getDist(mini, heavyBot) < CAVUS_AURA_RADIUS;
        let dmgMult = inCavusAura ? 2 : 1;
        if (mini._rageActive) dmgMult *= 2;
        const baseDmg = mini._customDmg || MINI_PLAYER_DMG;
        const finalPlayerDmg = baseDmg * dmgMult;
        if (!player.isDead && !player.jumpInvulnerable && getDist(mini, player) < MINI_PLAYER_RADIUS + player.radius) {
            player.hp -= finalPlayerDmg;
            rawDamageText(player.x, player.y, finalPlayerDmg, "#e74c3c");
            player.lastHitTime = Date.now();
            const ang = getAngle(mini, player);
            player.x += Math.cos(ang) * MINI_KNOCKBACK;
            player.y += Math.sin(ang) * MINI_KNOCKBACK;
        }
        for (let i = 0; i < 8; i++) {
            const ang = Math.random() * Math.PI * 2; const sp = 2 + Math.random() * 3;
            particles.push({ x: mini.x, y: mini.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 20, maxLife: 20, color: Math.random() < 0.5 ? '#f39c12' : '#c0392b', size: 2 + Math.random() * 2, type: 'normal' });
        }
        mini.isDead = true; triggerBotKill(mini.x, mini);
    }

    function miniDuvarPatlat(mini, target) {
        explosions.push({ x: mini.x, y: mini.y, radius: 8, maxRadius: MINI_WALL_AOE_RADIUS, life: 12, maxLife: 12 });
        screenShake = 4;
        const inCavusAura = heavyBot && heavyBot.type === 'cavus' && !heavyBot.isDead && cavusAuraActive && getDist(mini, heavyBot) < CAVUS_AURA_RADIUS;
        let dmgMult = inCavusAura ? 2 : 1;
        if (mini._rageActive) dmgMult *= 2;
        const finalWallDmg = MINI_WALL_DMG * dmgMult;
        if (target) { target.hp -= finalWallDmg; rawDamageText(target.x, target.y, finalWallDmg, "#e74c3c"); }
        for (const o of obstacles.concat(cactusWalls || [])) {
            if (o !== target && getDist(mini, o) < MINI_WALL_AOE_RADIUS + o.radius) {
                o.hp -= MINI_WALL_AOE * dmgMult;
            }
        }
        if (!player.isDead && !player.jumpInvulnerable && getDist(mini, player) < MINI_WALL_AOE_RADIUS + player.radius) {
            player.hp -= MINI_WALL_AOE * dmgMult;
            rawDamageText(player.x, player.y, MINI_WALL_AOE * dmgMult, "#e74c3c");
            player.lastHitTime = Date.now();
        }
        mini.isDead = true; triggerBotKill(mini.x, mini);
    }

    window.GAME_EXT.registerMode(MOD_ID, {
        label: 'Turuncu Baskın',
        onStart: function () {
            piyade = null; piyadeSpawnTimer = 0; piyadeRespawnTimer = 0; piyadeDeathMermiler = [];
            turuncuBot = null; turuncuSpawnFrame = 0; turuncuSpawnUyari = 0;
            kamikazeler = []; miniKamikazeler = []; kamiSpawnUyarilari = [];
            kamiTimerCount = 0; modKillCount = 0;
            heavyBot = null; heavyBotType = 'havan'; heavySpawnTimer = 0; heavySpawnUyari = 0;
            havanShootTimer = 0; havanMermiler = []; havanMuzzleFlash = 0;
            cavusShootTimer = 0; cavusAuraTimer = 0; cavusAuraCooldown = 0;
            cavusAuraActive = false; cavusAuraTick = 0; botPrevHp.clear();
            ranger = null; rangerSpawnTimer = 0; rangerSpawnUyari = 0;
            rangerLobutCooldown = 0; rangerAuraTimer = 0; rangerLobuts = [];
            rageActive = false; rageTimer = 0;

            bot.isActive = false; bot.isDead = true; bot.x = -9999; bot.y = -9999;
            bot2.isActive = false; bot2.isDead = true; bot2.x = -9999; bot2.y = -9999;
            slimeBots = []; stationaryBots = []; boomerangBots = []; fogBots = [];
            nests = []; spawnIndicators = [];

            obstacles.forEach(o => { o.maxHp = SIPER_CAN; o.hp = SIPER_CAN; o._griSiper = true; });

            if (!window._origSpawnSlime) {
                window._origSpawnSlime = window.spawnSlimeBot;
                window.spawnSlimeBot = function (x, y, stage) {
                    window._origSpawnSlime(x, y, stage);
                    if (window.GAME_MODE === MOD_ID) {
                        const s = slimeBots[slimeBots.length - 1];
                        if (s) s.color = '#e67e22';
                    }
                };
            }
            spawnPiyadeUyari();
        },

        onUpdate: function (ts) {
            slimeTimer = 0; stationaryTimer = 0; boomerangTimer = 0; fogBotTimer = 0;
            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true; bot2.hp = 0; bot2.x = -9999; bot2.y = -9999;
            obstacles.forEach(o => { if (!o._griSiper) { o.maxHp = SIPER_CAN; o.hp = SIPER_CAN; o._griSiper = true; } });

            const safePlayerX = Number.isFinite(player.x) ? player.x : 0;
            const safePlayerY = Number.isFinite(player.y) ? player.y : 0;

            // ÖFKE
            if (rageActive) {
                rageTimer -= ts;
                if (rageTimer <= 0) {
                    rageActive = false;
                    const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b && !b.isDead);
                    allBots.forEach(b => {
                        if (b._rageActive) { b.speed = b._rageOrigSpeed; b.shootInterval = b._rageOrigInterval; b._rageActive = false; }
                    });
                }
            }

            // ÇAVUŞ HASAR YÖNLENDİRME (%30, sadece mermiyle vurulabilen botlar)
            const redirectBots = [piyade, turuncuBot, ranger, ...slimeBots].filter(b => b && !b.isDead);
            redirectBots.forEach(b => {
                if (botPrevHp.has(b)) {
                    const prev = botPrevHp.get(b);
                    if (b.hp < prev && heavyBot && heavyBot.type === 'cavus' && !heavyBot.isDead && cavusAuraActive && getDist(b, heavyBot) < CAVUS_AURA_RADIUS) {
                        let dmg = prev - b.hp;
                        let transfer = dmg * CAVUS_DMG_REDIRECT;
                        b.hp += transfer;
                        heavyBotHasarAl(heavyBot, transfer);
                    }
                }
                botPrevHp.set(b, b.hp);
            });
            botPrevHp.forEach((v, k) => {
                if (!k || k.isDead || !redirectBots.includes(k)) botPrevHp.delete(k);
            });

            // PİYADE
            if (!piyade) {
                if (piyadeSpawnTimer > 0) { piyadeSpawnTimer -= ts; if (piyadeSpawnTimer <= 0) dogurPiyade(); }
                else if (piyadeRespawnTimer > 0) { piyadeRespawnTimer -= ts; if (piyadeRespawnTimer <= 0) { piyadeRespawnTimer = 0; spawnPiyadeUyari(); } }
            }
            if (piyade && !piyade.isDead) {
                const b = piyade;
                if (b.hp <= 0) {
                    b.isDead = true; piyadeOlumMermiSac(b.x, b.y); spawnParticles(b.x, b.y, b.color, 'smoke');
                    triggerBotKill(b.x, b); piyade = null; piyadeRespawnTimer = PIYADE_RESPAWN_WAIT;
                } else {
                    const canSee = !player.isDead && !player.isInvisible; const dP = getDist(b, player);
                    if (canSee) {
                        b.angle = Math.atan2(safePlayerY - b.y, safePlayerX - b.x);
                        if (dP > PIYADE_ENGAGE_DIST) { b.x += Math.cos(b.angle) * b.speed * ts; b.y += Math.sin(b.angle) * b.speed * ts; }
                        if (dP < PIYADE_RANGE && Date.now() - b.lastShot > b.shootInterval) {
                            b.lastShot = Date.now();
                            botBullets.push({ x: b.x, y: b.y, sx: b.x, sy: b.y, vx: Math.cos(b.angle + (Math.random() - 0.5) * 0.15) * BOT_BULLET_SPEED, vy: Math.sin(b.angle + (Math.random() - 0.5) * 0.15) * BOT_BULLET_SPEED, dmgMod: 1, type: 'stationary_bot_bullet', owner: b });
                        }
                    }
                    if (Math.abs(b.kbX) > 0.1 || Math.abs(b.kbY) > 0.1) { b.x += b.kbX * ts; b.y += b.kbY * ts; b.kbX *= 0.85; b.kbY *= 0.85; }
                    b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                    b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                    resolveObstacleCollision(b);
                }
            }

            // PİYADE ÖLÜM MERMİLERİ
            for (let i = piyadeDeathMermiler.length - 1; i >= 0; i--) {
                const m = piyadeDeathMermiler[i];
                if (m.isDead) { piyadeDeathMermiler.splice(i, 1); continue; }
                m.x += m.vx * ts; m.y += m.vy * ts;
                const mesafe = Math.hypot(m.x - m.sx, m.y - m.sy);
                if (mesafe > m.menzil) { m.isDead = true; continue; }
                if (m.x < WALL_THICKNESS || m.x > canvas.width - WALL_THICKNESS || m.y < WALL_THICKNESS || m.y > canvas.height - WALL_THICKNESS) { m.isDead = true; continue; }
                let sipereCarpti = false;
                for (const o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(m, o) < o.radius + m.radius) { o.hp -= 100; sipereCarpti = true; break; }
                }
                if (sipereCarpti) { m.isDead = true; continue; }
                if (!player.isDead && !player.jumpInvulnerable && getDist(m, player) < player.radius + m.radius) {
                    player.hp -= m.hasar; rawDamageText(player.x, player.y, m.hasar, "#e74c3c");
                    player.lastHitTime = Date.now(); m.isDead = true;
                }
            }

            // TURUNCU BOT
            if (turuncuSpawnUyari > 0) { turuncuSpawnUyari -= ts; if (turuncuSpawnUyari <= 0) dogurTuruncuBot(); }
            else if (!turuncuBot) { turuncuSpawnFrame += ts; if (turuncuSpawnFrame >= TURUNCU_SPAWN_FRAME) { turuncuSpawnFrame = 0; spawnTuruncuUyari(); } }
            if (turuncuBot && !turuncuBot.isDead) {
                const b = turuncuBot;
                if (b.hp <= 0) { b.isDead = true; spawnParticles(b.x, b.y, b.color, 'smoke'); triggerBotKill(b.x, b); turuncuBot = null; }
                else {
                    const canSee = !player.isDead && !player.isInvisible;
                    if (canSee) {
                        b.angle = Math.atan2(safePlayerY - b.y, safePlayerX - b.x);
                        if (Date.now() - b.lastShot > TURUNCU_SHOOT_INTERVAL) {
                            b.lastShot = Date.now();
                            botBullets.push({ x: b.x, y: b.y, sx: b.x, sy: b.y, vx: Math.cos(b.angle + (Math.random() - 0.5) * 0.15) * BOT_BULLET_SPEED, vy: Math.sin(b.angle + (Math.random() - 0.5) * 0.15) * BOT_BULLET_SPEED, dmgMod: 1, type: 'stationary_bot_bullet', owner: b });
                        }
                    }
                    if (Math.abs(b.kbX) > 0.1 || Math.abs(b.kbY) > 0.1) { b.x += b.kbX * ts; b.y += b.kbY * ts; b.kbX *= 0.85; b.kbY *= 0.85; }
                    b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                    b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                    resolveObstacleCollision(b);
                }
            }

            // AĞIR BOT
            if (!heavyBot) {
                if (heavySpawnUyari > 0) { heavySpawnUyari -= ts; if (heavySpawnUyari <= 0) dogurHeavyBot(); }
                else { heavySpawnTimer += ts; if (heavySpawnTimer >= HEAVY_SPAWN_TIME) { heavySpawnTimer = 0; spawnHeavyUyari(); } }
            }
            if (heavyBot && !heavyBot.isDead) {
                if (heavyBot.hp <= 0) {
                    heavyBot.isDead = true;
                    spawnParticles(heavyBot.x, heavyBot.y, heavyBot.color, 'smoke');
                    triggerBotKill(heavyBot.x, heavyBot);
                    if (heavyBot.type === 'cavus') triggerRage();
                    heavyBot = null; heavyBotType = (heavyBotType === 'havan') ? 'cavus' : 'havan';
                } else {
                    if (heavyBot.type === 'havan') {
                        havanShootTimer += ts;
                        if (havanMuzzleFlash > 0) havanMuzzleFlash -= ts;
                        if (havanShootTimer >= HAVAN_SHOOT_INTERVAL) { havanShootTimer = 0; havanAtes(); }
                    } else {
                        // ÇAVUŞ HAREKET (150 birimde durur)
                        if (!player.isDead) {
                            heavyBot.angle = Math.atan2(safePlayerY - heavyBot.y, safePlayerX - heavyBot.x);
                            let currentSpeed = cavusAuraActive ? (CAVUS_SPEED * 2) : CAVUS_SPEED;
                            const dP = getDist(heavyBot, player);
                            if (dP > CAVUS_STOP_DIST) {
                                heavyBot.x += Math.cos(heavyBot.angle) * currentSpeed * ts;
                                heavyBot.y += Math.sin(heavyBot.angle) * currentSpeed * ts;
                                heavyBot.x = clampPos(heavyBot.x, heavyBot.radius + WALL_THICKNESS, canvas.width - heavyBot.radius - WALL_THICKNESS);
                                heavyBot.y = clampPos(heavyBot.y, heavyBot.radius + WALL_THICKNESS, canvas.height - heavyBot.radius - WALL_THICKNESS);
                                resolveObstacleCollision(heavyBot);
                            }
                        }
                        cavusShootTimer += ts;

                        // AURA
                        if (cavusAuraActive) {
                            cavusAuraTimer -= ts; cavusAuraTick += ts;
                            if (cavusAuraTimer <= 0) {
                                cavusAuraActive = false; cavusAuraCooldown = CAVUS_AURA_COOLDOWN; heavyBot.shield = 0;
                            } else if (cavusAuraTick >= 60) {
                                cavusAuraTick = 0;
                                heavyBot.hp = Math.min(heavyBot.maxHp, heavyBot.hp + 200);
                                rawDamageText(heavyBot.x, heavyBot.y - 20, "+200", "#2ecc71");
                                const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b && !b.isDead);
                                allBots.forEach(b => {
                                    if (getDist(b, heavyBot) < CAVUS_AURA_RADIUS) {
                                        b.hp = Math.min(b.maxHp, b.hp + 100);
                                        rawDamageText(b.x, b.y, "+100", "#2ecc71");
                                    }
                                });
                            }
                        } else {
                            if (cavusAuraCooldown > 0) cavusAuraCooldown -= ts;
                            else {
                                cavusAuraActive = true; cavusAuraTimer = CAVUS_AURA_DURATION;
                                heavyBot.shield = 500; cavusAuraTick = 0;
                                rawDamageText(heavyBot.x, heavyBot.y - 30, "KALKAN + AURA!", "#f1c40f");
                            }
                        }

                        const currentInterval = cavusAuraActive ? CAVUS_SHOOT_INTERVAL : (CAVUS_SHOOT_INTERVAL / 2);
                        if (cavusShootTimer >= currentInterval && !player.isDead) {
                            cavusShootTimer = 0;
                            botBullets.push({ x: heavyBot.x, y: heavyBot.y, sx: heavyBot.x, sy: heavyBot.y, vx: Math.cos(heavyBot.angle) * BOT_BULLET_SPEED, vy: Math.sin(heavyBot.angle) * BOT_BULLET_SPEED, dmgMod: 1, type: 'stationary_bot_bullet', owner: heavyBot });
                        }
                    }
                }
            }

            // HAVAN MERMİLERİ
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

            // KAMİKAZE
            for (let i = kamiSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = kamiSpawnUyarilari[i]; u.timer -= ts;
                if (u.timer <= 0) { dogurKamikaze(u.x, u.y); kamiSpawnUyarilari.splice(i, 1); }
            }
            kamiTimerCount += ts;
            if (kamiTimerCount >= KAMI_TIMER_TRIGGER) {
                kamiTimerCount = 0;
                if (kamikazeler.length === 0 && kamiSpawnUyarilari.length === 0 && miniKamikazeler.length === 0) spawnKamikazeUyari();
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
                    k.angle = Math.atan2(safePlayerY - k.y, safePlayerX - k.x);
                    k.x += Math.cos(k.angle) * k.speed * ts;
                    k.y += Math.sin(k.angle) * k.speed * ts;
                }
                if (Math.abs(k.kbX) > 0.1 || Math.abs(k.kbY) > 0.1) { k.x += k.kbX * ts; k.y += k.kbY * ts; k.kbX *= 0.85; k.kbY *= 0.85; }
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

            // MİNİ KAMİKAZE
            for (let i = miniKamikazeler.length - 1; i >= 0; i--) {
                const k = miniKamikazeler[i];
                if (k.isDead) { miniKamikazeler.splice(i, 1); continue; }
                if (k.hp <= 0) { miniPatlat(k); continue; }
                const canSee = !player.isDead && !player.isInvisible && !player.jumpInvulnerable;
                const dP = getDist(k, player);
                if (canSee && dP < MINI_TRIGGER_DIST) { miniPatlat(k); continue; }
                k._lastX = k.x; k._lastY = k.y;
                if (!player.isInvisible && !player.isDead) {
                    k.angle = Math.atan2(safePlayerY - k.y, safePlayerX - k.x);
                    k.x += Math.cos(k.angle) * k.speed * ts;
                    k.y += Math.sin(k.angle) * k.speed * ts;
                }
                if (Math.abs(k.kbX) > 0.1 || Math.abs(k.kbY) > 0.1) { k.x += k.kbX * ts; k.y += k.kbY * ts; k.kbX *= 0.85; k.kbY *= 0.85; }
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
                    if (yakinDuvar) miniDuvarPatlat(k, yakinDuvar); else miniPatlat(k);
                }
            }

            // RANGER (Lobutçu)
            if (!ranger) {
                if (rangerSpawnUyari > 0) { rangerSpawnUyari -= ts; if (rangerSpawnUyari <= 0) dogurRanger(); }
                else { rangerSpawnTimer += ts; if (rangerSpawnTimer >= RANGER_SPAWN_INTERVAL) { rangerSpawnTimer = 0; spawnRangerUyari(); } }
            }
            if (ranger && !ranger.isDead) {
                if (ranger.hp <= 0) {
                    ranger.isDead = true; spawnParticles(ranger.x, ranger.y, ranger.color, 'smoke');
                    triggerBotKill(ranger.x, ranger); clearAllBuffs(); ranger = null;
                } else {
                    const dP = getDist(ranger, player);
                    if (!player.isDead) ranger.angle = Math.atan2(safePlayerY - ranger.y, safePlayerX - ranger.x);

                    // Lobut ateşi (menzil içindeyse ve cooldown bittiyse)
                    if (rangerLobutCooldown > 0) rangerLobutCooldown -= ts;
                    else if (!player.isDead && !player.isInvisible && dP < RANGER_RANGE) {
                        rangerLobutAt();
                    }

                    // Ranger'ın kendi aurası
                    rangerAuraTimer += ts;
                    const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b && !b.isDead);
                    if (rangerAuraTimer >= RANGER_AURA_HEAL_INTERVAL) {
                        rangerAuraTimer = 0;
                        allBots.forEach(b => {
                            if (getDist(b, ranger) < RANGER_AURA_RADIUS) b.hp = Math.min(b.maxHp, b.hp + RANGER_AURA_HEAL);
                        });
                    }
                    let buffedCount = 0;
                    allBots.forEach(b => { if (b._rangerBuffed) buffedCount++; });
                    allBots.forEach(b => {
                        const inAura = getDist(b, ranger) < RANGER_AURA_RADIUS;
                        if (inAura && !b._rangerBuffed && buffedCount < RANGER_AURA_MAX_BOTS) {
                            b._rangerOrigSpeed = b.speed; b.speed += RANGER_AURA_SPEED_BONUS;
                            b._rangerBuffed = true; buffedCount++;
                        } else if (!inAura && b._rangerBuffed) {
                            b.speed = b._rangerOrigSpeed; b._rangerBuffed = false; buffedCount--;
                        }
                    });
                }
            } else {
                const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b && !b.isDead);
                allBots.forEach(b => { if (b._rangerBuffed) { b.speed = b._rangerOrigSpeed; b._rangerBuffed = false; } });
            }

            // RANGER LOBUTLARI
            for (let i = rangerLobuts.length - 1; i >= 0; i--) {
                const l = rangerLobuts[i];
                if (!l || l.isDead) { if (l) rangerLobuts.splice(i, 1); continue; }
                l.flightTimer -= ts;
                if (l.flightTimer <= 0) {
                    explosions.push({ x: l.targetX, y: l.targetY, radius: 5, maxRadius: RANGER_LOBUT_AOE, life: 15, maxLife: 15 });
                    screenShake = 6;
                    if (!player.isDead && !player.jumpInvulnerable && getDist({ x: l.targetX, y: l.targetY }, player) < RANGER_LOBUT_AOE + player.radius) {
                        player.hp -= RANGER_LOBUT_HASAR;
                        rawDamageText(player.x, player.y, RANGER_LOBUT_HASAR, "#e74c3c");
                        player.lastHitTime = Date.now();
                    }
                    for (const o of obstacles.concat(cactusWalls || [])) {
                        if (getDist({ x: l.targetX, y: l.targetY }, o) < RANGER_LOBUT_AOE + o.radius) o.hp -= 100;
                    }
                    dogurRangerMini(l.targetX, l.targetY);
                    l.isDead = true;
                }
            }
        },

        onReset: function () {
            piyade = null; piyadeSpawnTimer = 0; piyadeRespawnTimer = 0; piyadeDeathMermiler = [];
            turuncuBot = null; turuncuSpawnFrame = 0; turuncuSpawnUyari = 0;
            kamikazeler = []; miniKamikazeler = []; kamiSpawnUyarilari = [];
            kamiTimerCount = 0; modKillCount = 0;
            heavyBot = null; heavySpawnTimer = 0; heavySpawnUyari = 0; heavyBotType = 'havan';
            havanShootTimer = 0; havanMermiler = []; havanMuzzleFlash = 0;
            cavusShootTimer = 0; cavusAuraTimer = 0; cavusAuraCooldown = 0;
            cavusAuraActive = false; cavusAuraTick = 0; botPrevHp.clear();
            ranger = null; rangerSpawnTimer = 0; rangerSpawnUyari = 0;
            rangerLobutCooldown = 0; rangerAuraTimer = 0; rangerLobuts = [];
            rageActive = false; rageTimer = 0;
            clearAllBuffs();
            bot.isActive = true; bot.isDead = false; bot.hp = bot.maxHp;
            bot.x = canvas.width - 150; bot.y = 300; bot.kbX = bot.kbY = 0;
            bot2.isActive = false; bot2.isDead = true; bot2.hp = bot2.maxHp;
            bot2.respawnTimer = -9999;
            botsKilled = 0;
        }
    });

    window.GAME_EXT.chainHook('getExtraEnemies', function () {
        if (window.GAME_MODE !== MOD_ID) return undefined;
        const liste = [];
        if (piyade && !piyade.isDead) liste.push(piyade);
        if (turuncuBot && !turuncuBot.isDead) liste.push(turuncuBot);
        if (heavyBot && !heavyBot.isDead) liste.push(heavyBot);
        if (ranger && !ranger.isDead) liste.push(ranger);
        liste.push(...kamikazeler.filter(k => !k.isDead));
        liste.push(...miniKamikazeler.filter(k => !k.isDead));
        return liste;
    });

    window.GAME_EXT.chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID || !gameStarted) return;

        // SİPERLER
        for (const o of obstacles) {
            ctx2.save(); ctx2.translate(o.x, o.y);
            ctx2.fillStyle = '#808080'; ctx2.beginPath();
            ctx2.roundRect(-o.radius, -o.radius, o.radius * 2, o.radius * 2, 10); ctx2.fill();
            ctx2.strokeStyle = '#505050'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-15, -o.radius - 15, 30, 4);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-15, -o.radius - 15, 30 * (o.hp / o.maxHp), 4);
            ctx2.restore();
        }

        // RANGER AURASI (içi boş çember)
        if (ranger && !ranger.isDead) {
            ctx2.save();
            ctx2.beginPath(); ctx2.arc(ranger.x, ranger.y, RANGER_AURA_RADIUS, 0, Math.PI * 2);
            ctx2.strokeStyle = 'rgba(241, 196, 15, 0.6)'; ctx2.lineWidth = 3;
            ctx2.setLineDash([8, 8]); ctx2.stroke(); ctx2.setLineDash([]);
            ctx2.restore();
        }

        // ÇAVUŞ AURASI (İÇİ DOLU - Sarı ışık huzmesi)
        if (heavyBot && heavyBot.type === 'cavus' && !heavyBot.isDead && cavusAuraActive) {
            ctx2.save();
            const grad = ctx2.createRadialGradient(heavyBot.x, heavyBot.y, 0, heavyBot.x, heavyBot.y, CAVUS_AURA_RADIUS);
            grad.addColorStop(0, 'rgba(255, 215, 0, 0.25)');
            grad.addColorStop(0.6, 'rgba(255, 215, 0, 0.10)');
            grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx2.beginPath(); ctx2.arc(heavyBot.x, heavyBot.y, CAVUS_AURA_RADIUS, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();
            ctx2.beginPath(); ctx2.arc(heavyBot.x, heavyBot.y, CAVUS_AURA_RADIUS, 0, Math.PI * 2);
            ctx2.strokeStyle = 'rgba(255, 215, 0, 0.9)'; ctx2.lineWidth = 4; ctx2.stroke();
            ctx2.restore();

            // Aura içindeki botlarda SARI BUHAR (küçük öfke efekti)
            const botsInAura = [piyade, turuncuBot, ranger, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b && !b.isDead && getDist(b, heavyBot) < CAVUS_AURA_RADIUS);
            botsInAura.forEach(b => {
                ctx2.save();
                ctx2.globalAlpha = 0.35 + Math.sin(Date.now() / 120) * 0.1;
                const bGrad = ctx2.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 1.8);
                bGrad.addColorStop(0, 'rgba(255, 215, 0, 0.6)');
                bGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
                ctx2.beginPath(); ctx2.arc(b.x, b.y, b.radius * 1.8, 0, Math.PI * 2);
                ctx2.fillStyle = bGrad; ctx2.fill();
                ctx2.restore();
            });
        }

        // SPAWN UYARILARI (3-2-1 Sayaç)
        function drawSpawnWarn(x, y, radius, timer, color) {
            if (timer <= 0) return;
            ctx2.save(); ctx2.translate(x, y);
            ctx2.globalAlpha = 0.6 + Math.abs(Math.sin(Date.now() / 150)) * 0.4;
            ctx2.beginPath(); ctx2.arc(0, 0, radius + 15, 0, Math.PI * 2);
            ctx2.strokeStyle = color; ctx2.lineWidth = 5; ctx2.stroke();
            ctx2.fillStyle = color; ctx2.font = "bold 26px Arial"; ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(timer / 60), 0, 9);
            ctx2.restore();
        }

        if (piyadeSpawnTimer > 0) drawSpawnWarn(piyadeSpawnX, piyadeSpawnY, PIYADE_RADIUS, piyadeSpawnTimer, '#d35400');
        if (turuncuSpawnUyari > 0 && !turuncuBot) drawSpawnWarn(turuncuSpawnX, turuncuSpawnY, TURUNCU_RADIUS, turuncuSpawnUyari, '#e67e22');
        if (heavySpawnUyari > 0 && !heavyBot) {
            const isH = (heavyBotType === 'havan');
            drawSpawnWarn(heavySpawnX, heavySpawnY, 30, heavySpawnUyari, isH ? '#7f1d1d' : '#b8860b');
        }
        if (rangerSpawnUyari > 0 && !ranger) drawSpawnWarn(rangerSpawnX, rangerSpawnY, RANGER_RADIUS, rangerSpawnUyari, '#e67e22');
        kamiSpawnUyarilari.forEach(u => drawSpawnWarn(u.x, u.y, 18, u.timer, '#e67e22'));

        // PİYADE (Kuş bakışı: kask)
        if (piyade && !piyade.isDead) {
            const b = piyade;
            ctx2.save(); ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-20, -b.radius - 15, 40, 5);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-20, -b.radius - 15, 40 * (b.hp / b.maxHp), 5);
            ctx2.rotate(b.angle);
            // Gövde
            ctx2.fillStyle = '#d35400';
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#5d4037'; ctx2.lineWidth = 2; ctx2.stroke();
            // Kask (tam daire - üstten görünüm)
            ctx2.fillStyle = '#5d4037';
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.65, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = '#3e2723';
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.3, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        }

        // TURUNCU BOT (Kuş bakışı: kask)
        if (turuncuBot && !turuncuBot.isDead) {
            const b = turuncuBot;
            ctx2.save(); ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-20, -b.radius - 15, 40, 5);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-20, -b.radius - 15, 40 * (b.hp / b.maxHp), 5);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#e67e22';
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 2; ctx2.stroke();
            // Kask
            ctx2.fillStyle = '#a04000';
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.7, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = '#5d4037';
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.35, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        }

        // AĞIR BOT (HAVAN / ÇAVUŞ)
        if (heavyBot && !heavyBot.isDead) {
            const b = heavyBot;
            ctx2.save(); ctx2.translate(b.x, b.y);
            if (b.type === 'havan') {
                // HAVAN (kare + top)
                ctx2.fillStyle = '#7f1d1d'; ctx2.fillRect(-30, -b.radius - 18, 60, 6);
                ctx2.fillStyle = '#c0392b'; ctx2.fillRect(-30, -b.radius - 18, 60 * (b.hp / b.maxHp), 6);
                ctx2.fillStyle = '#5d4037';
                ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
                ctx2.strokeStyle = '#3e2723'; ctx2.lineWidth = 3; ctx2.stroke();
                // Taş bloklar
                ctx2.fillStyle = '#3e2723';
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2;
                    ctx2.beginPath(); ctx2.arc(Math.cos(a) * (b.radius - 4), Math.sin(a) * (b.radius - 4), 4, 0, Math.PI * 2); ctx2.fill();
                }
                ctx2.fillStyle = '#8d6e63';
                ctx2.beginPath(); ctx2.arc(0, 0, b.radius - 8, 0, Math.PI * 2); ctx2.fill();
                // Namlu
                const recoil = (havanMuzzleFlash > 0) ? (havanMuzzleFlash / 15) * 6 : 0;
                ctx2.fillStyle = '#1a0a00'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 10, 0, Math.PI * 2); ctx2.fill();
                ctx2.strokeStyle = '#808080'; ctx2.lineWidth = 2; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 10, 0, Math.PI * 2); ctx2.stroke();
                ctx2.fillStyle = '#000'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 6, 0, Math.PI * 2); ctx2.fill();
                if (havanMuzzleFlash > 0) {
                    ctx2.globalAlpha = havanMuzzleFlash / 15;
                    ctx2.fillStyle = '#ff5500'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 16, 0, Math.PI * 2); ctx2.fill();
                    ctx2.fillStyle = '#ffff00'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 8, 0, Math.PI * 2); ctx2.fill();
                    ctx2.globalAlpha = 1;
                }
            } else {
                // ÇAVUŞ (Altıgen + subay kasketi)
                ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-30, -b.radius - 18, 60, 6);
                ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-30, -b.radius - 18, 60 * (b.hp / b.maxHp), 6);
                if (b.shield > 0) {
                    ctx2.strokeStyle = '#00ffff'; ctx2.lineWidth = 4;
                    ctx2.globalAlpha = 0.8; ctx2.beginPath(); ctx2.arc(0, 0, b.radius + 6, 0, Math.PI * 2); ctx2.stroke();
                    ctx2.globalAlpha = 0.3; ctx2.fillStyle = '#00ffff'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius + 6, 0, Math.PI * 2); ctx2.fill();
                    ctx2.globalAlpha = 1;
                }
                ctx2.rotate(b.angle);
                // Altıgen gövde
                ctx2.fillStyle = '#b8860b';
                ctx2.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2;
                    const px = Math.cos(a) * b.radius;
                    const py = Math.sin(a) * b.radius;
                    if (i === 0) ctx2.moveTo(px, py); else ctx2.lineTo(px, py);
                }
                ctx2.closePath(); ctx2.fill();
                ctx2.strokeStyle = '#5d4037'; ctx2.lineWidth = 3; ctx2.stroke();
                // Subay kasketi (tam daire)
                ctx2.fillStyle = '#2c3e50';
                ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.75, 0, Math.PI * 2); ctx2.fill();
                ctx2.fillStyle = '#f1c40f';
                ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.4, 0, Math.PI * 2); ctx2.fill();
                // Kasket siperliği
                ctx2.fillStyle = '#1a252f';
                ctx2.fillRect(-4, b.radius * 0.5, 8, 5);
            }
            ctx2.restore();
        }

        // RANGER (Turuncu oval + bere)
        if (ranger && !ranger.isDead) {
            ctx2.save(); ctx2.translate(ranger.x, ranger.y);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-18, -ranger.radius - 12, 36, 4);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-18, -ranger.radius - 12, 36 * (ranger.hp / ranger.maxHp), 4);
            ctx2.rotate(ranger.angle);
            // Oval gövde
            ctx2.fillStyle = '#e67e22';
            ctx2.beginPath(); ctx2.ellipse(0, 0, ranger.radius * 1.2, ranger.radius * 0.85, 0, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 2; ctx2.stroke();
            // Bere (tam daire, farklı renk)
            ctx2.fillStyle = '#d35400';
            ctx2.beginPath(); ctx2.arc(0, 0, ranger.radius * 0.6, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = '#a04000';
            ctx2.beginPath(); ctx2.arc(0, 0, ranger.radius * 0.25, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        }

        // HAVAN MERMİLERİ
        havanMermiler.forEach(m => {
            if (m.isDead) return;
            const prog = 1 - (m.flightTimer / m.maxFlight);
            ctx2.save();
            ctx2.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
            ctx2.beginPath(); ctx2.arc(m.x, m.y, HAVAN_MERMI_AOE, 0, Math.PI * 2);
            ctx2.strokeStyle = '#c0392b'; ctx2.lineWidth = 3; ctx2.setLineDash([8, 6]); ctx2.stroke();
            ctx2.setLineDash([]); ctx2.globalAlpha = 0.15;
            ctx2.beginPath(); ctx2.arc(m.x, m.y, HAVAN_MERMI_AOE * prog, 0, Math.PI * 2);
            ctx2.fillStyle = '#c0392b'; ctx2.fill(); ctx2.restore();

            const currentX = m.startX + (m.x - m.startX) * prog;
            const currentY = m.startY + (m.y - m.startY) * prog;
            const arcHeight = Math.sin(prog * Math.PI) * 120;
            ctx2.save();
            ctx2.globalAlpha = 0.3;
            ctx2.beginPath(); ctx2.ellipse(m.x, m.y, 12 * prog, 5 * prog, 0, 0, Math.PI * 2);
            ctx2.fillStyle = '#000'; ctx2.fill(); ctx2.globalAlpha = 1;
            ctx2.beginPath(); ctx2.arc(currentX, currentY - arcHeight, 9, 0, Math.PI * 2);
            ctx2.fillStyle = '#7f1d1d'; ctx2.fill();
            ctx2.strokeStyle = '#c0392b'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        });

        // RANGER LOBUTLARI (Turuncu yay)
        rangerLobuts.forEach(l => {
            if (!l || l.isDead) return;
            const prog = 1 - (l.flightTimer / l.maxFlight);
            ctx2.save();
            // Yer uyarı çemberi
            ctx2.globalAlpha = 0.4 + Math.sin(Date.now() / 100) * 0.2;
            ctx2.beginPath(); ctx2.arc(l.targetX, l.targetY, RANGER_LOBUT_AOE, 0, Math.PI * 2);
            ctx2.strokeStyle = '#e67e22'; ctx2.lineWidth = 3; ctx2.setLineDash([6, 6]); ctx2.stroke();
            ctx2.setLineDash([]); ctx2.restore();

            const currentX = l.startX + (l.targetX - l.startX) * prog;
            const currentY = l.startY + (l.targetY - l.startY) * prog;
            const arcHeight = Math.sin(prog * Math.PI) * 100;
            ctx2.save();
            ctx2.globalAlpha = 0.3;
            ctx2.beginPath(); ctx2.ellipse(l.targetX, l.targetY, 10 * prog, 4 * prog, 0, 0, Math.PI * 2);
            ctx2.fillStyle = '#000'; ctx2.fill(); ctx2.globalAlpha = 1;
            // Lobut (turuncu küçük top)
            ctx2.beginPath(); ctx2.arc(currentX, currentY - arcHeight, 7, 0, Math.PI * 2);
            ctx2.fillStyle = '#e67e22'; ctx2.fill();
            ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        });

        // PİYADE ÖLÜM MERMİLERİ
        piyadeDeathMermiler.forEach(m => {
            if (m.isDead) return;
            ctx2.save(); ctx2.translate(m.x, m.y);
            ctx2.beginPath(); ctx2.arc(0, 0, m.radius + 2, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(211,84,0,0.3)'; ctx2.fill();
            ctx2.beginPath(); ctx2.arc(0, 0, m.radius, 0, Math.PI * 2);
            ctx2.fillStyle = '#d35400'; ctx2.fill(); ctx2.restore();
        });

        // KAMİKAZELER (üçgen)
        kamikazeler.forEach(k => {
            if (k.isDead) return;
            ctx2.save(); ctx2.translate(k.x, k.y); ctx2.rotate(k.angle);
            ctx2.beginPath(); ctx2.moveTo(k.radius, 0); ctx2.lineTo(-k.radius, -k.radius * 0.8); ctx2.lineTo(-k.radius, k.radius * 0.8); ctx2.closePath();
            ctx2.fillStyle = '#e67e22'; ctx2.fill();
            ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        });

        // MİNİ KAMİKAZELER (küçük üçgen)
        miniKamikazeler.forEach(k => {
            if (k.isDead) return;
            ctx2.save(); ctx2.translate(k.x, k.y); ctx2.rotate(k.angle);
            ctx2.beginPath(); ctx2.moveTo(k.radius, 0); ctx2.lineTo(-k.radius, -k.radius * 0.8); ctx2.lineTo(-k.radius, k.radius * 0.8); ctx2.closePath();
            ctx2.fillStyle = k._isRangerMini ? '#ff8c00' : '#f39c12'; ctx2.fill();
            ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 1.5; ctx2.stroke();
            ctx2.restore();
        });

        // ÖFKELENEN BOTLAR İÇİN KIRMIZI BUHAR
        const allBotsForRage = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b && !b.isDead && b._rageActive);
        allBotsForRage.forEach(b => {
            ctx2.save();
            ctx2.globalAlpha = 0.4 + Math.sin(Date.now() / 100) * 0.1;
            const grad = ctx2.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 2.5);
            grad.addColorStop(0, 'rgba(255, 0, 0, 0.6)');
            grad.addColorStop(0.5, 'rgba(200, 0, 0, 0.3)');
            grad.addColorStop(1, 'rgba(150, 0, 0, 0)');
            ctx2.beginPath(); ctx2.arc(b.x, b.y, b.radius * 2.5, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();
            ctx2.restore();
        });

        // SLIME KASKLARI
        slimeBots.forEach(s => {
            if (s.isDead) return;
            ctx2.save(); ctx2.translate(s.x, s.y);
            ctx2.fillStyle = '#7f8c8d';
            ctx2.beginPath(); ctx2.arc(0, 0, s.radius * 0.65, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = '#34495e';
            ctx2.beginPath(); ctx2.arc(0, 0, s.radius * 0.3, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        });
    });

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

    window.GAME_EXT.modKartiEkle('turuncu', 'Turuncu Baskın', 'Piyade + Turuncu + Kamikaze + Havan/Çavuş + Ranger');
    console.log('[MOD YÜKLENDİ] turuncu (v12 FINAL)');
})();