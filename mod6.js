// ========== mod10.js (TURUNCU BASKIN) - v9.1 (TAM KOD) ==========
// - Havan ve Çavuş dönüşümlü spawn olur (Maks 1 aktif).
// - ÇAVUŞ: 3400 HP, içi boş sarı aura. Aura açıkken kalkan basar (500), içindekileri iyileştirir ve saldırı hızlarını 2x yapar.
// - Aura kapalıyken Çavuş kendi ateş hızını 2x yapar.
// - Ranger: Öfke temalı görünüm, içi boş aura.
// - Havan: Yeni top animasyonu (namlu tepmesi, duman).
// - Yuva Slime'ları turuncuya boyandı.
// - Curlos çökme hatası giderildi (güvenlik kontrolleri).
// - Çavuş kalkanı artık oyuncu mermilerini de emiyor.

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

    // ---- Havan (Ağır Bot 1) ----
    const HAVAN_HP = 5000;
    const HAVAN_RADIUS = 26;
    const HAVAN_SHOOT_INTERVAL = 180; // 3 saniye
    const HAVAN_MERMI_HASAR = 400;
    const HAVAN_MERMI_AOE = 100;
    const HAVAN_SIPER_HASAR = 150;
    const HAVAN_MERMI_FLIGHT = 90;

    // ---- Çavuş (Ağır Bot 2) ----
    const CAVUS_HP = 3400;
    const CAVUS_RADIUS = 24;
    const CAVUS_SHOOT_INTERVAL = 120; // 2 saniye (Aura kapalıyken 1s olacak)
    const CAVUS_MERMI_HASAR = 200;
    const CAVUS_AURA_RADIUS = 140; // Ranger aurasından belirgin şekilde büyük
    const CAVUS_AURA_DURATION = 300; // 5 saniye (300 frame)
    const CAVUS_AURA_COOLDOWN = 300; // 5 saniye cooldown

    // ---- Ağır Bot Spawn Kontrolü ----
    const HEAVY_SPAWN_TIME = 1500; // 25 saniye
    const HEAVY_SPAWN_WARN = 240;  // 4 saniye

    // ---- Ranger ----
    const RANGER_HP = 1000;
    const RANGER_RADIUS = 18;
    const RANGER_SPEED = 2.2;
    const RANGER_RANGE = 120;
    const RANGER_BULLET_DMG = 100;
    const RANGER_BULLET_SPEED = PLAYER_BULLET_SPEED * 0.8;
    const RANGER_SHOT_INTERVAL = 24;
    const RANGER_SHOT_COUNT = 5;
    const RANGER_COOLDOWN = 120;
    const RANGER_SPAWN_INTERVAL = 2400; // 40 saniye
    const RANGER_SPAWN_WARN = 180;
    const RANGER_AURA_RADIUS = 60;
    const RANGER_AURA_HEAL = 200;
    const RANGER_AURA_HEAL_INTERVAL = 180;
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

    // Ağır Bot (Havan / Çavuş) Değişkenleri
    let heavyBot = null;
    let heavyBotType = 'havan'; // 'havan' veya 'cavus'
    let heavySpawnTimer = 0;
    let heavySpawnUyari = 0;
    let heavySpawnX = 0, heavySpawnY = 0;
    
    // Havan Değişkenleri
    let havanShootTimer = 0;
    let havanMermiler = [];
    let havanMuzzleFlash = 0;

    // Çavuş Değişkenleri
    let cavusShootTimer = 0;
    let cavusAuraTimer = 0;
    let cavusAuraCooldown = 0;
    let cavusAuraActive = false;
    let cavusPrevHp = 0; // Kalkan için hasar takibi

    // Ranger Değişkenleri
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

    function clearAllBuffs() {
        const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b);
        allBots.forEach(b => {
            if (b._rangerBuffed) {
                b.speed = b._rangerOrigSpeed;
                b._rangerBuffed = false;
            }
            if (b._cavusHasted) {
                b.shootInterval = b._cavusOrigInterval;
                b._cavusHasted = false;
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

    // AĞIR BOT SPAWN (HAVAN / ÇAVUŞ)
    function spawnHeavyUyari() {
        heavySpawnX = Math.random() * (canvas.width - 300) + 150;
        heavySpawnY = Math.random() * (canvas.height - 300) + 150;
        heavySpawnUyari = HEAVY_SPAWN_WARN;
    }

    function dogurHeavyBot() {
        if (heavyBotType === 'havan') {
            heavyBot = {
                x: heavySpawnX, y: heavySpawnY,
                radius: HAVAN_RADIUS,
                hp: HAVAN_HP, maxHp: HAVAN_HP,
                speed: 0, angle: 0, lastShot: 0,
                isDead: false, isActive: true,
                color: '#7f1d1d', kbX: 0, kbY: 0,
                type: 'havan'
            };
            havanShootTimer = 0;
            havanMuzzleFlash = 0;
            spawnParticles(heavyBot.x, heavyBot.y, '#7f1d1d', 'smoke');
            explosions.push({ x: heavyBot.x, y: heavyBot.y, radius: 10, maxRadius: 80, life: 15, maxLife: 15 });
        } else {
            heavyBot = {
                x: heavySpawnX, y: heavySpawnY,
                radius: CAVUS_RADIUS,
                hp: CAVUS_HP, maxHp: CAVUS_HP, shield: 0,
                speed: 0, angle: 0, lastShot: 0,
                shootInterval: CAVUS_SHOOT_INTERVAL,
                isDead: false, isActive: true,
                color: '#b8860b', kbX: 0, kbY: 0,
                type: 'cavus'
            };
            cavusShootTimer = 0;
            cavusAuraTimer = 0;
            cavusAuraCooldown = 0;
            cavusAuraActive = false;
            cavusPrevHp = CAVUS_HP;
            spawnParticles(heavyBot.x, heavyBot.y, '#b8860b', 'smoke');
            explosions.push({ x: heavyBot.x, y: heavyBot.y, radius: 10, maxRadius: 80, life: 15, maxLife: 15 });
        }
    }

    function havanAtes() {
        if (!heavyBot || heavyBot.isDead || player.isDead) return;
        havanMermiler.push({
            x: player.x, y: player.y,
            startX: heavyBot.x, startY: heavyBot.y,
            flightTimer: HAVAN_MERMI_FLIGHT,
            maxFlight: HAVAN_MERMI_FLIGHT,
            isDead: false
        });
        havanMuzzleFlash = 15; // Namlu alevi
        addFloatingNumber(heavyBot.x, heavyBot.y - 30, "HAVAN!", "#7f1d1d", false);
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

    // Hasar Alma Mantığı (Kalkan varsa önce o gider)
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
        
        // Çavuş Aurası Hasar Çarpanı
        const inCavusAura = heavyBot && heavyBot.type === 'cavus' && !heavyBot.isDead && cavusAuraActive && getDist(kami, heavyBot) < CAVUS_AURA_RADIUS;
        const dmgMult = inCavusAura ? 2 : 1;
        const finalPlayerDmg = KAMI_PLAYER_DMG * dmgMult;
        const finalWallDmg = (KAMI_WALL_DMG + wallBonus) * dmgMult;

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
                    rawDamageText(o.x, o.y, KAMI_WALL_AOE * dmgMult, "#e74c3c");
                }
            }
            if (!player.isDead && !player.jumpInvulnerable && getDist(kami, player) < KAMI_WALL_AOE_RADIUS + player.radius) {
                player.hp -= KAMI_WALL_AOE * dmgMult;
                rawDamageText(player.x, player.y, KAMI_WALL_AOE * dmgMult, "#e74c3c");
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

        const inCavusAura = heavyBot && heavyBot.type === 'cavus' && !heavyBot.isDead && cavusAuraActive && getDist(mini, heavyBot) < CAVUS_AURA_RADIUS;
        const dmgMult = inCavusAura ? 2 : 1;
        const finalPlayerDmg = MINI_PLAYER_DMG * dmgMult;

        if (!player.isDead && !player.jumpInvulnerable && getDist(mini, player) < MINI_PLAYER_RADIUS + player.radius) {
            player.hp -= finalPlayerDmg;
            rawDamageText(player.x, player.y, finalPlayerDmg, "#e74c3c");
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

        const inCavusAura = heavyBot && heavyBot.type === 'cavus' && !heavyBot.isDead && cavusAuraActive && getDist(mini, heavyBot) < CAVUS_AURA_RADIUS;
        const dmgMult = inCavusAura ? 2 : 1;
        const finalWallDmg = (MINI_WALL_DMG + wallBonus) * dmgMult;

        if (target) {
            target.hp -= finalWallDmg;
            rawDamageText(target.x, target.y, finalWallDmg, "#e74c3c");
        }
        for (const o of obstacles.concat(cactusWalls || [])) {
            if (o !== target && getDist(mini, o) < MINI_WALL_AOE_RADIUS + o.radius) {
                o.hp -= MINI_WALL_AOE * dmgMult;
                rawDamageText(o.x, o.y, MINI_WALL_AOE * dmgMult, "#e74c3c");
            }
        }
        if (!player.isDead && !player.jumpInvulnerable && getDist(mini, player) < MINI_WALL_AOE_RADIUS + player.radius) {
            player.hp -= MINI_WALL_AOE * dmgMult;
            rawDamageText(player.x, player.y, MINI_WALL_AOE * dmgMult, "#e74c3c");
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
            
            heavyBot = null; heavyBotType = 'havan'; heavySpawnTimer = 0; heavySpawnUyari = 0;
            havanShootTimer = 0; havanMermiler = []; havanMuzzleFlash = 0;
            cavusShootTimer = 0; cavusAuraTimer = 0; cavusAuraCooldown = 0; cavusAuraActive = false; cavusPrevHp = 0;
            
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

            // TURUNCU SLIME FIX: Base slime üretimini sarmala
            if (!window._origSpawnSlime) {
                window._origSpawnSlime = window.spawnSlimeBot;
                window.spawnSlimeBot = function(x, y, stage) {
                    window._origSpawnSlime(x, y, stage);
                    if (window.GAME_MODE === MOD_ID) {
                        const s = slimeBots[slimeBots.length - 1];
                        if (s) s.color = '#e67e22'; // Turuncu yap
                    }
                };
            }

            spawnPiyadeUyari();
        },

        onUpdate: function (ts) {
            slimeTimer = 0; stationaryTimer = 0;
            boomerangTimer = 0; fogBotTimer = 0;

            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true; bot2.hp = 0;
            bot2.x = -9999; bot2.y = -9999;

            obstacles.forEach(o => {
                if (!o._griSiper) { o.maxHp = SIPER_CAN; o.hp = SIPER_CAN; o._griSiper = true; }
            });

            // CURLOS ÇÖKME FIX
            const safePlayerX = Number.isFinite(player.x) ? player.x : 0;
            const safePlayerY = Number.isFinite(player.y) ? player.y : 0;

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
                        b.angle = Math.atan2(safePlayerY - b.y, safePlayerX - b.x);
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
                        b.angle = Math.atan2(safePlayerY - b.y, safePlayerX - b.x);
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

            // ========== AĞIR BOT (HAVAN / ÇAVUŞ) ==========
            if (!heavyBot) {
                if (heavySpawnUyari > 0) {
                    heavySpawnUyari -= ts;
                    if (heavySpawnUyari <= 0) dogurHeavyBot();
                } else {
                    heavySpawnTimer += ts;
                    if (heavySpawnTimer >= HEAVY_SPAWN_TIME) {
                        heavySpawnTimer = 0;
                        spawnHeavyUyari();
                    }
                }
            }

            if (heavyBot && !heavyBot.isDead) {
                // Oyuncu mermilerinden gelen hasarı kalkana yansıtma (Base kod mermileri)
                if (heavyBot.type === 'cavus' && heavyBot.shield > 0 && heavyBot.hp < cavusPrevHp) {
                    let dmg = cavusPrevHp - heavyBot.hp;
                    heavyBot.hp = cavusPrevHp; // Hasarı geri al
                    heavyBotHasarAl(heavyBot, dmg); // Kalkana yansıt
                }
                cavusPrevHp = heavyBot.hp;

                if (heavyBot.hp <= 0) {
                    heavyBot.isDead = true;
                    spawnParticles(heavyBot.x, heavyBot.y, heavyBot.color, 'smoke');
                    triggerBotKill(heavyBot.x, heavyBot);
                    heavyBot = null;
                    // DÖNGÜ: Havan ölürse Çavuş, Çavuş ölürse Havan gelir
                    heavyBotType = (heavyBotType === 'havan') ? 'cavus' : 'havan'; 
                } else {
                    if (heavyBot.type === 'havan') {
                        // HAVAN MANTIĞI
                        havanShootTimer += ts;
                        if (havanMuzzleFlash > 0) havanMuzzleFlash -= ts;
                        if (havanShootTimer >= HAVAN_SHOOT_INTERVAL) {
                            havanShootTimer = 0;
                            havanAtes();
                        }
                    } else {
                        // ÇAVUŞ MANTIĞI
                        cavusShootTimer += ts;
                        
                        // Aura Yönetimi
                        if (cavusAuraActive) {
                            cavusAuraTimer -= ts;
                            if (cavusAuraTimer <= 0) {
                                cavusAuraActive = false;
                                cavusAuraCooldown = CAVUS_AURA_COOLDOWN;
                                heavyBot.shield = 0; // Aura bitince kalkan gider
                            } else {
                                // Aura Aktifken İyileştirme (1 saniyede 1)
                                if (Math.floor(cavusAuraTimer) % 60 === 0) {
                                    heavyBot.hp = Math.min(heavyBot.maxHp, heavyBot.hp + 200); // Kendini iyileştir
                                    cavusPrevHp = heavyBot.hp; // Hasar takibini sıfırla
                                    rawDamageText(heavyBot.x, heavyBot.y - 20, "+200", "#2ecc71");
                                    
                                    const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b && !b.isDead);
                                    allBots.forEach(b => {
                                        if (getDist(b, heavyBot) < CAVUS_AURA_RADIUS) {
                                            b.hp = Math.min(b.maxHp, b.hp + 100);
                                            rawDamageText(b.x, b.y, "+100", "#2ecc71");
                                        }
                                    });
                                }
                            }
                        } else {
                            if (cavusAuraCooldown > 0) cavusAuraCooldown -= ts;
                            else {
                                cavusAuraActive = true;
                                cavusAuraTimer = CAVUS_AURA_DURATION;
                                heavyBot.shield = 500; // Aura açılınca kalkan bas
                                rawDamageText(heavyBot.x, heavyBot.y - 30, "KALKAN + AURA!", "#f1c40f");
                            }
                        }

                        // Çavuş Ateşi
                        // Aura AÇIKKEN yavaş (2s = 120), KAPALIYKEN hızlı (1s = 60)
                        const currentInterval = cavusAuraActive ? CAVUS_SHOOT_INTERVAL : (CAVUS_SHOOT_INTERVAL / 2);
                        
                        if (cavusShootTimer >= currentInterval && !player.isDead) {
                            cavusShootTimer = 0;
                            const ang = Math.atan2(safePlayerY - heavyBot.y, safePlayerX - heavyBot.x);
                            botBullets.push({
                                x: heavyBot.x, y: heavyBot.y, sx: heavyBot.x, sy: heavyBot.y,
                                vx: Math.cos(ang) * BOT_BULLET_SPEED,
                                vy: Math.sin(ang) * BOT_BULLET_SPEED,
                                dmgMod: 1, type: 'stationary_bot_bullet', owner: heavyBot
                            });
                        }

                        // Aura içindeki botların saldırı hızını 2x yapma (Base kodun ateş hızını değiştiriyoruz)
                        const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b && !b.isDead);
                        allBots.forEach(b => {
                            const inAura = getDist(b, heavyBot) < CAVUS_AURA_RADIUS;
                            if (cavusAuraActive && inAura) {
                                if (!b._cavusHasted) {
                                    b._cavusOrigInterval = b.shootInterval;
                                    b.shootInterval = b.shootInterval / 2;
                                    b._cavusHasted = true;
                                }
                            } else {
                                if (b._cavusHasted) {
                                    b.shootInterval = b._cavusOrigInterval;
                                    b._cavusHasted = false;
                                }
                            }
                        });
                    }
                }
            }

            // Havan Mermileri
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
                    k.angle = Math.atan2(safePlayerY - k.y, safePlayerX - k.x);
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
                    k.angle = Math.atan2(safePlayerY - k.y, safePlayerX - k.x);
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
                    ranger.isDead = true;
                    spawnParticles(ranger.x, ranger.y, ranger.color, 'smoke');
                    triggerBotKill(ranger.x, ranger);
                    clearAllBuffs();
                    ranger = null;
                } else {
                    const dP = getDist(ranger, player);

                    if (rangerShotState === 'idle' && !player.isDead && dP > RANGER_RANGE * 0.9) {
                        const angle = Math.atan2(safePlayerY - ranger.y, safePlayerX - ranger.x);
                        ranger.x += Math.cos(angle) * RANGER_SPEED * ts;
                        ranger.y += Math.sin(angle) * RANGER_SPEED * ts;
                        ranger.x = clampPos(ranger.x, RANGER_RADIUS + WALL_THICKNESS, canvas.width - RANGER_RADIUS - WALL_THICKNESS);
                        ranger.y = clampPos(ranger.y, RANGER_RADIUS + WALL_THICKNESS, canvas.height - RANGER_RADIUS - WALL_THICKNESS);
                    }

                    if (!player.isDead) {
                        ranger.angle = Math.atan2(safePlayerY - ranger.y, safePlayerX - ranger.x);
                    }

                    if (rangerShotState === 'idle') {
                        if (rangerCooldownTimer > 0) {
                            rangerCooldownTimer -= ts;
                        } else if (!player.isDead && !player.isInvisible && dP < RANGER_RANGE) {
                            rangerShotState = 'shooting';
                            rangerShotCount = 0;
                            rangerShotTimer = RANGER_SHOT_INTERVAL;
                        }
                    }

                    if (rangerShotState === 'shooting') {
                        rangerShotTimer += ts;
                        while (rangerShotTimer >= RANGER_SHOT_INTERVAL && rangerShotCount < RANGER_SHOT_COUNT) {
                            rangerShotTimer -= RANGER_SHOT_INTERVAL;
                            const angle = Math.atan2(safePlayerY - ranger.y, safePlayerX - ranger.x);
                            rangerBullets.push({
                                x: ranger.x, y: ranger.y,
                                vx: Math.cos(angle) * RANGER_BULLET_SPEED,
                                vy: Math.sin(angle) * RANGER_BULLET_SPEED,
                                hasar: RANGER_BULLET_DMG,
                                isDead: false
                            });
                            rangerShotCount++;
                        }
                        if (rangerShotCount >= RANGER_SHOT_COUNT) {
                            rangerShotState = 'idle';
                            rangerCooldownTimer = RANGER_COOLDOWN;
                        }
                    }

                    rangerAuraTimer += ts;
                    const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b && !b.isDead);
                    if (rangerAuraTimer >= RANGER_AURA_HEAL_INTERVAL) {
                        rangerAuraTimer = 0;
                        allBots.forEach(b => {
                            if (getDist(b, ranger) < RANGER_AURA_RADIUS) {
                                b.hp = Math.min(b.maxHp, b.hp + RANGER_AURA_HEAL);
                            }
                        });
                    }

                    let buffedCount = 0;
                    allBots.forEach(b => { if (b._rangerBuffed) buffedCount++; });
                    allBots.forEach(b => {
                        const inAura = getDist(b, ranger) < RANGER_AURA_RADIUS;
                        if (inAura && !b._rangerBuffed && buffedCount < RANGER_AURA_MAX_BOTS) {
                            b._rangerOrigSpeed = b.speed;
                            b.speed += RANGER_AURA_SPEED_BONUS;
                            b._rangerBuffed = true;
                            buffedCount++;
                        } else if (!inAura && b._rangerBuffed) {
                            b.speed = b._rangerOrigSpeed;
                            b._rangerBuffed = false;
                            buffedCount--;
                        }
                    });
                }
            } else {
                const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b && !b.isDead);
                allBots.forEach(b => {
                    if (b._rangerBuffed) {
                        b.speed = b._rangerOrigSpeed;
                        b._rangerBuffed = false;
                    }
                });
            }

            for (let i = rangerBullets.length - 1; i >= 0; i--) {
                const m = rangerBullets[i];
                if (m.isDead) { rangerBullets.splice(i, 1); continue; }
                m.x += m.vx * ts;
                m.y += m.vy * ts;
                if (m.x < WALL_THICKNESS || m.x > canvas.width - WALL_THICKNESS ||
                    m.y < WALL_THICKNESS || m.y > canvas.height - WALL_THICKNESS) {
                    m.isDead = true; continue;
                }
                let hitObs = false;
                for (const o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(m, o) < o.radius + 5) { o.hp -= 30; hitObs = true; break; }
                }
                if (hitObs) { m.isDead = true; continue; }
                if (!player.isDead && !player.jumpInvulnerable && getDist(m, player) < player.radius + 5) {
                    player.hp -= m.hasar;
                    rawDamageText(player.x, player.y, m.hasar, "#e74c3c");
                    player.lastHitTime = Date.now();
                    m.isDead = true;
                }
            }
        },

        onReset: function () {
            heavyBot = null; heavySpawnTimer = 0; heavySpawnUyari = 0; heavyBotType = 'havan';
            havanShootTimer = 0; havanMermiler = []; havanMuzzleFlash = 0;
            cavusShootTimer = 0; cavusAuraTimer = 0; cavusAuraCooldown = 0; cavusAuraActive = false; cavusPrevHp = 0;
            ranger = null; rangerSpawnTimer = 0; rangerSpawnUyari = 0;
            rangerShotState = 'idle'; rangerShotCount = 0; rangerShotTimer = 0;
            rangerCooldownTimer = 0; rangerAuraTimer = 0; rangerBullets = [];
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

    // ========== ÇİZİM ==========
    window.GAME_EXT.chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID || !gameStarted) return;

        // SİPERLER
        for (const o of obstacles) {
            ctx2.save();
            ctx2.translate(o.x, o.y);
            ctx2.fillStyle = '#808080';
            ctx2.beginPath(); ctx2.roundRect(-o.radius, -o.radius, o.radius * 2, o.radius * 2, 10); ctx2.fill();
            ctx2.strokeStyle = '#505050'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-15, -o.radius - 15, 30, 4);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-15, -o.radius - 15, 30 * (o.hp / o.maxHp), 4);
            ctx2.restore();
        }

        // AURALAR (İçi Boş Çemberler)
        if (ranger && !ranger.isDead) {
            ctx2.save();
            ctx2.beginPath(); ctx2.arc(ranger.x, ranger.y, RANGER_AURA_RADIUS, 0, Math.PI * 2);
            ctx2.strokeStyle = 'rgba(241, 196, 15, 0.6)'; ctx2.lineWidth = 3; ctx2.setLineDash([8, 8]); ctx2.stroke();
            ctx2.setLineDash([]); ctx2.restore();
        }
        if (heavyBot && heavyBot.type === 'cavus' && !heavyBot.isDead && cavusAuraActive) {
            ctx2.save();
            ctx2.beginPath(); ctx2.arc(heavyBot.x, heavyBot.y, CAVUS_AURA_RADIUS, 0, Math.PI * 2);
            ctx2.strokeStyle = 'rgba(255, 215, 0, 0.8)'; ctx2.lineWidth = 4; ctx2.stroke();
            ctx2.restore();
        }

        // SPAWN UYARILARI
        if (piyadeSpawnTimer > 0) {
            ctx2.save(); ctx2.translate(piyadeSpawnX, piyadeSpawnY);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath(); ctx2.arc(0, 0, PIYADE_RADIUS + 12, 0, Math.PI * 2);
            ctx2.strokeStyle = '#d35400'; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.restore();
        }
        if (turuncuSpawnUyari > 0 && !turuncuBot) {
            ctx2.save(); ctx2.translate(turuncuSpawnX, turuncuSpawnY);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath(); ctx2.arc(0, 0, TURUNCU_RADIUS + 14, 0, Math.PI * 2);
            ctx2.strokeStyle = '#e67e22'; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.restore();
        }
        if (heavySpawnUyari > 0 && !heavyBot) {
            ctx2.save(); ctx2.translate(heavySpawnX, heavySpawnY);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 100));
            const isH = (heavyBotType === 'havan');
            ctx2.beginPath(); ctx2.arc(0, 0, 30, 0, Math.PI * 2);
            ctx2.strokeStyle = isH ? '#7f1d1d' : '#b8860b'; ctx2.lineWidth = 4; ctx2.stroke();
            ctx2.fillStyle = isH ? '#7f1d1d' : '#b8860b'; ctx2.font = "bold 20px Arial"; ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(heavySpawnUyari / 60), 0, 7);
            ctx2.restore();
        }
        if (rangerSpawnUyari > 0 && !ranger) {
            ctx2.save(); ctx2.translate(rangerSpawnX, rangerSpawnY);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath(); ctx2.arc(0, 0, RANGER_RADIUS + 14, 0, Math.PI * 2);
            ctx2.strokeStyle = '#f1c40f'; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.restore();
        }
        kamiSpawnUyarilari.forEach(u => {
            ctx2.save(); ctx2.translate(u.x, u.y);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 100));
            ctx2.beginPath(); ctx2.moveTo(0, -22); ctx2.lineTo(-18, 12); ctx2.lineTo(18, 12); ctx2.closePath();
            ctx2.strokeStyle = '#e67e22'; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.restore();
        });

        // PİYADE
        if (piyade && !piyade.isDead) {
            const b = piyade;
            ctx2.save(); ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-20, -b.radius - 15, 40, 5);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-20, -b.radius - 15, 40 * (b.hp / b.maxHp), 5);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#d35400'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#5d4037'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.fillStyle = '#fff5e1'; ctx2.beginPath(); ctx2.arc(7, -5, 4, 0, Math.PI * 2); ctx2.arc(7, 5, 4, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = '#5d4037'; ctx2.beginPath(); ctx2.arc(8, -5, 2, 0, Math.PI * 2); ctx2.arc(8, 5, 2, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = '#a04000'; ctx2.beginPath(); ctx2.arc(0, -b.radius * 0.4, b.radius * 0.65, Math.PI, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#5d4037'; ctx2.lineWidth = 1.5; ctx2.stroke();
            ctx2.restore();
        }

        // TURUNCU BOT
        if (turuncuBot && !turuncuBot.isDead) {
            const b = turuncuBot;
            ctx2.save(); ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-20, -b.radius - 15, 40, 5);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-20, -b.radius - 15, 40 * (b.hp / b.maxHp), 5);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#e67e22'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.fillStyle = '#d35400'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.75, -Math.PI * 0.7, Math.PI * 0.7); ctx2.fill();
            ctx2.fillStyle = '#5d4037'; ctx2.fillRect(b.radius - 2, -3, 10, 6);
            ctx2.fillStyle = '#fff5e1'; ctx2.beginPath(); ctx2.arc(7, -5, 4, 0, Math.PI * 2); ctx2.arc(7, 5, 4, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = '#e67e22'; ctx2.beginPath(); ctx2.arc(8, -5, 2, 0, Math.PI * 2); ctx2.arc(8, 5, 2, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        }

        // AĞIR BOT (HAVAN / ÇAVUŞ)
        if (heavyBot && !heavyBot.isDead) {
            const b = heavyBot;
            ctx2.save(); ctx2.translate(b.x, b.y);
            
            if (b.type === 'havan') {
                // HAVAN (Clash Royale tarzı yuvarlak taş top)
                ctx2.fillStyle = '#7f1d1d'; ctx2.fillRect(-30, -b.radius - 18, 60, 6);
                ctx2.fillStyle = '#c0392b'; ctx2.fillRect(-30, -b.radius - 18, 60 * (b.hp / b.maxHp), 6);
                ctx2.fillStyle = 'rgba(0,0,0,0.3)'; ctx2.beginPath(); ctx2.ellipse(0, b.radius * 0.5, b.radius * 1.1, b.radius * 0.35, 0, 0, Math.PI * 2); ctx2.fill();
                ctx2.fillStyle = '#5d4037'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
                ctx2.strokeStyle = '#3e2723'; ctx2.lineWidth = 3; ctx2.stroke();
                ctx2.fillStyle = '#3e2723'; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const bx = Math.cos(a) * (b.radius - 4); const by = Math.sin(a) * (b.radius - 4); ctx2.beginPath(); ctx2.arc(bx, by, 4, 0, Math.PI * 2); ctx2.fill(); }
                ctx2.fillStyle = '#8d6e63'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius - 8, 0, Math.PI * 2); ctx2.fill();
                
                // Top Namlusu ve Animasyonu
                const recoil = (havanMuzzleFlash > 0) ? (havanMuzzleFlash / 15) * 6 : 0;
                ctx2.fillStyle = '#1a0a00'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 10, 0, Math.PI * 2); ctx2.fill();
                ctx2.strokeStyle = '#808080'; ctx2.lineWidth = 2; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 10, 0, Math.PI * 2); ctx2.stroke();
                ctx2.fillStyle = '#000'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 6, 0, Math.PI * 2); ctx2.fill();
                
                // Muzzle Flash
                if (havanMuzzleFlash > 0) {
                    ctx2.globalAlpha = havanMuzzleFlash / 15;
                    ctx2.fillStyle = '#ff5500'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 16, 0, Math.PI * 2); ctx2.fill();
                    ctx2.fillStyle = '#ffff00'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 8, 0, Math.PI * 2); ctx2.fill();
                    ctx2.globalAlpha = 1;
                }
            } else {
                // ÇAVUŞ
                ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-30, -b.radius - 18, 60, 6);
                ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-30, -b.radius - 18, 60 * (b.hp / b.maxHp), 6);
                
                // Kalkan
                if (b.shield > 0) {
                    ctx2.strokeStyle = '#00ffff'; ctx2.lineWidth = 4;
                    ctx2.globalAlpha = 0.8; ctx2.beginPath(); ctx2.arc(0, 0, b.radius + 6, 0, Math.PI * 2); ctx2.stroke();
                    ctx2.globalAlpha = 0.3; ctx2.fillStyle = '#00ffff'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius + 6, 0, Math.PI * 2); ctx2.fill();
                    ctx2.globalAlpha = 1;
                }
                
                ctx2.rotate(b.angle);
                ctx2.fillStyle = '#b8860b'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
                ctx2.strokeStyle = '#5d4037'; ctx2.lineWidth = 3; ctx2.stroke();
                // Şapka/Rütbe
                ctx2.fillStyle = '#2c3e50'; ctx2.beginPath(); ctx2.arc(0, -2, b.radius * 0.8, Math.PI, 0); ctx2.fill();
                ctx2.fillStyle = '#f1c40f'; ctx2.fillRect(-5, -b.radius * 0.8, 10, 5); // Yıldız/Rütbe
                // Gözler
                ctx2.fillStyle = '#ff0000'; ctx2.beginPath(); ctx2.arc(6, -4, 3, 0, Math.PI * 2); ctx2.arc(6, 4, 3, 0, Math.PI * 2); ctx2.fill();
            }
            ctx2.restore();
        }

        // RANGER (Öfke Temalı Subay)
        if (ranger && !ranger.isDead) {
            ctx2.save(); ctx2.translate(ranger.x, ranger.y);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-18, -ranger.radius - 12, 36, 4);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-18, -ranger.radius - 12, 36 * (ranger.hp / ranger.maxHp), 4);
            
            ctx2.fillStyle = '#7f1d1d'; // Koyu kırmızı öfke
            ctx2.beginPath(); ctx2.arc(0, 0, ranger.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#c0392b'; ctx2.lineWidth = 2; ctx2.stroke();
            
            // Öfkeli Gözler
            ctx2.fillStyle = '#ff5500';
            ctx2.beginPath(); ctx2.arc(6, -4, 3, 0, Math.PI * 2); ctx2.arc(6, 4, 3, 0, Math.PI * 2); ctx2.fill();
            // Omuz Zırhı
            ctx2.strokeStyle = '#bdc3c7'; ctx2.lineWidth = 3; ctx2.beginPath(); ctx2.arc(0, 0, ranger.radius - 2, -Math.PI/2, Math.PI/2); ctx2.stroke();

            if (rangerShotState === 'shooting') {
                ctx2.globalAlpha = 0.5 + Math.sin(Date.now() / 60) * 0.4;
                ctx2.beginPath(); ctx2.arc(0, 0, ranger.radius + 5, 0, Math.PI * 2);
                ctx2.strokeStyle = '#ff0000'; ctx2.lineWidth = 3; ctx2.stroke();
                ctx2.globalAlpha = 1;
            }
            ctx2.restore();
        }

        // HAVAN MERMİLERİ (Duman İzi)
        havanMermiler.forEach(m => {
            if (m.isDead) return;
            const prog = 1 - (m.flightTimer / m.maxFlight);
            ctx2.save();
            ctx2.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
            ctx2.beginPath(); ctx2.arc(m.x, m.y, HAVAN_MERMI_AOE, 0, Math.PI * 2);
            ctx2.strokeStyle = '#c0392b'; ctx2.lineWidth = 3; ctx2.setLineDash([8, 6]); ctx2.stroke(); ctx2.setLineDash([]);
            ctx2.globalAlpha = 0.15; ctx2.beginPath(); ctx2.arc(m.x, m.y, HAVAN_MERMI_AOE * prog, 0, Math.PI * 2);
            ctx2.fillStyle = '#c0392b'; ctx2.fill(); ctx2.restore();

            const currentX = m.startX + (m.x - m.startX) * prog;
            const currentY = m.startY + (m.y - m.startY) * prog;
            const arcHeight = Math.sin(prog * Math.PI) * 120;
            
            ctx2.save();
            // Mermi izi
            for(let i=1; i<=3; i++){
                let trailProg = Math.max(0, prog - i*0.05);
                let tx = m.startX + (m.x - m.startX) * trailProg;
                let ty = m.startY + (m.y - m.startY) * trailProg;
                let tArc = Math.sin(trailProg * Math.PI) * 120;
                ctx2.fillStyle = `rgba(100,100,100,${0.3/i})`;
                ctx2.beginPath(); ctx2.arc(tx, ty - tArc, 9 - i*2, 0, Math.PI*2); ctx2.fill();
            }
            
            ctx2.globalAlpha = 0.3; ctx2.beginPath(); ctx2.ellipse(m.x, m.y, 12 * prog, 5 * prog, 0, 0, Math.PI * 2); ctx2.fillStyle = '#000'; ctx2.fill(); ctx2.globalAlpha = 1;
            ctx2.beginPath(); ctx2.arc(currentX, currentY - arcHeight, 9, 0, Math.PI * 2);
            ctx2.fillStyle = '#7f1d1d'; ctx2.fill(); ctx2.strokeStyle = '#c0392b'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        });

        // Ranger Mermileri
        rangerBullets.forEach(m => {
            if (m.isDead) return;
            ctx2.save(); ctx2.translate(m.x, m.y);
            ctx2.beginPath(); ctx2.arc(0, 0, 4, 0, Math.PI * 2); ctx2.fillStyle = '#f1c40f'; ctx2.fill();
            ctx2.restore();
        });

        // Piyade Ölüm Mermileri
        piyadeDeathMermiler.forEach(m => {
            if (m.isDead) return;
            ctx2.save(); ctx2.translate(m.x, m.y);
            ctx2.beginPath(); ctx2.arc(0, 0, m.radius + 2, 0, Math.PI * 2); ctx2.fillStyle = 'rgba(211,84,0,0.3)'; ctx2.fill();
            ctx2.beginPath(); ctx2.arc(0, 0, m.radius, 0, Math.PI * 2); ctx2.fillStyle = '#d35400'; ctx2.fill();
            ctx2.restore();
        });

        // Kamikazeler
        kamikazeler.forEach(k => {
            if (k.isDead) return;
            const inAura = heavyBot && heavyBot.type === 'cavus' && cavusAuraActive && getDist(k, heavyBot) < CAVUS_AURA_RADIUS;
            ctx2.save(); ctx2.translate(k.x, k.y);
            ctx2.rotate(k.angle);
            ctx2.beginPath(); ctx2.moveTo(k.radius, 0); ctx2.lineTo(-k.radius, -k.radius * 0.8); ctx2.lineTo(-k.radius, k.radius * 0.8); ctx2.closePath();
            ctx2.fillStyle = '#e67e22'; ctx2.fill();
            ctx2.strokeStyle = inAura ? '#ff0000' : '#a04000'; ctx2.lineWidth = inAura ? 3 : 2; ctx2.stroke();
            ctx2.restore();
        });

        // Mini Kamikazeler
        miniKamikazeler.forEach(k => {
            if (k.isDead) return;
            const inAura = heavyBot && heavyBot.type === 'cavus' && cavusAuraActive && getDist(k, heavyBot) < CAVUS_AURA_RADIUS;
            ctx2.save(); ctx2.translate(k.x, k.y);
            ctx2.rotate(k.angle);
            ctx2.beginPath(); ctx2.moveTo(k.radius, 0); ctx2.lineTo(-k.radius, -k.radius * 0.8); ctx2.lineTo(-k.radius, k.radius * 0.8); ctx2.closePath();
            ctx2.fillStyle = '#f39c12'; ctx2.fill();
            ctx2.strokeStyle = inAura ? '#ff0000' : '#a04000'; ctx2.lineWidth = inAura ? 2.5 : 1.5; ctx2.stroke();
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

    window.GAME_EXT.modKartiEkle('turuncu', 'Turuncu Baskın', 'Piyade + Turuncu + Kamikaze + Havan/Çavuş + Ranger + Yuvalar');

    console.log('[MOD YÜKLENDİ] turuncu (v9.1)');
})();