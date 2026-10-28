// ========== mod10.js (TURUNCU BASKIN) - v14 FULL ==========
// Düzeltmeler:
// 1. Yuva 1 tane kalıyor, slime üretiyor (base her 10 kill'de yeni eklemez)
// 2. Slime'lar Curlos zıplatınca speed=0 ile durur (base kod otomatik)
// 3. Havan, Ranger, Çavuş, Falcer, Piyade, Turuncu Bot hepsi _curlosJumpActive kontrolü
// 4. Kamikaze + mini zaten düzeltilmişti
// 5. Buz modundan ilham alan gradient grafikler korunuyor

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
    const MINI_HP = 400; const MINI_RADIUS = 12; const MINI_SPEED = 1.3; const MINI_MAX = 3;
    const MINI_TRIGGER_DIST = 60; const MINI_PLAYER_DMG = 300; const MINI_PLAYER_RADIUS = 70;
    const MINI_KNOCKBACK = 20; const MINI_WALL_DMG = 500; const MINI_WALL_AOE = 300;
    const MINI_WALL_AOE_RADIUS = 80; const MINI_STUCK_FRAMES = 30;

    // ---- Havan ----
    const HAVAN_HP = 5000; const HAVAN_RADIUS = 26;
    const HAVAN_SHOOT_INTERVAL = 72;
    const HAVAN_MERMI_HASAR = 400; const HAVAN_MERMI_AOE = 100;
    const HAVAN_SIPER_HASAR = 150; const HAVAN_MERMI_FLIGHT = 90;

    // ---- Çavuş ----
    const CAVUS_HP = 6500; const CAVUS_RADIUS = 24; const CAVUS_SPEED = 0.7;
    const CAVUS_SHOOT_INTERVAL = 120; const CAVUS_MERMI_HASAR = 200;
    const CAVUS_AURA_RADIUS = 140; const CAVUS_AURA_DURATION = 300; const CAVUS_AURA_COOLDOWN = 300;
    const CAVUS_DMG_REDIRECT = 0.30; const CAVUS_STOP_DIST = 150;
    const CAVUS_HEAL_PER_TICK = 450; const CAVUS_HEAL_BOTS = 100;

    // ---- Öfke ----
    const RAGE_DURATION = 180; const RAGE_ATK_MULT = 2; const RAGE_SPEED_MULT = 3;

    // ---- Ağır Bot Spawn ----
    const HEAVY_SPAWN_TIME = 1500; const HEAVY_SPAWN_WARN = 240;

    // ---- Ranger ----
    const RANGER_HP = 1000; const RANGER_RADIUS = 18; const RANGER_SPEED = 1.5;
    const RANGER_RANGE = 200;
    const RANGER_LOBUT_FLIGHT = 60; const RANGER_LOBUT_AOE = 60;
    const RANGER_LOBUT_HASAR = 300; const RANGER_LOBUT_COOLDOWN = 150;
    const RANGER_RMINI_HP = 300; const RANGER_RMINI_SPEED = 2.0;
    const RANGER_RMINI_DMG = 100; const RANGER_RMINI_RADIUS = 8;
    const RANGER_SPAWN_INTERVAL = 2400; const RANGER_SPAWN_WARN = 180;
    const RANGER_AURA_RADIUS = 60; const RANGER_AURA_HEAL = 200;
    const RANGER_AURA_HEAL_INTERVAL = 180; const RANGER_AURA_SPEED_BONUS = 0.6;
    const RANGER_AURA_MAX_BOTS = 3; const RANGER_STOP_DIST = 180;

    // ---- Falcer ----
    const FALCER_HP = 3000; const FALCER_RADIUS = 20; const FALCER_SPEED = 1.2;
    const FALCER_DASH_RANGE = 100; const FALCER_DASH_SPEED = 20;
    const FALCER_DASH_DMG = 300; const FALCER_DASH_STUN = 18;
    const FALCER_SHOOT_INTERVAL = 120; const FALCER_BULLET_DMG = 150;
    const FALCER_RANGE = 150; const FALCER_ACTION_INTERVAL = 120;
    const FALCER_KILL_REQUIREMENT = 13; const FALCER_MAX = 2; const FALCER_SPAWN_WARN = 180;

    const SIPER_CAN = 2500;

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

    let falcerler = []; let falcerSpawnCount = 0; let falcerUyarilar = [];

    let rageActive = false; let rageTimer = 0;

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let pr; if (typeof prev === 'function') pr = prev.apply(this, args);
            const or = fn.apply(this, args);
            if (typeof pr === 'boolean' || typeof or === 'boolean') return !!pr || !!or;
            return or !== undefined ? or : pr;
        };
    }

    function safe(v, fb) { return Number.isFinite(v) ? v : (fb !== undefined ? fb : 0); }

    function rawDamageText(x, y, val, color) {
        floatingNumbers.push({
            x: x + (Math.random() - .5) * 20, y: y - 20, val: val,
            color: color || "#e74c3c", life: 60, opacity: 1
        });
    }

    function clearAllBuffs() {
        const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots, ...falcerler].filter(b => b);
        allBots.forEach(b => {
            if (b._rangerBuffed) { b.speed = b._rangerOrigSpeed; b._rangerBuffed = false; }
            if (b._rageActive) { b.speed = b._rageOrigSpeed; b.shootInterval = b._rageOrigInterval; b._rageActive = false; }
        });
    }

    // ===== SPAWN =====
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
            _stuckTimer: 0, _lastX: x, _lastY: y, _customDmg: MINI_PLAYER_DMG,
            _noScore: true
        });
        spawnParticles(x, y, '#f39c12', 'smoke');
    }

    function dogurRangerMini(x, y) {
        miniKamikazeler.push({
            x, y, radius: RANGER_RMINI_RADIUS, hp: RANGER_RMINI_HP, maxHp: RANGER_RMINI_HP,
            speed: RANGER_RMINI_SPEED, angle: 0, isDead: false, isActive: true,
            color: '#ff8c00', kbX: 0, kbY: 0, _stuckTimer: 0, _lastX: x, _lastY: y,
            _customDmg: RANGER_RMINI_DMG, _isRangerMini: true, _noScore: true
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

    function rangerLobutAt() {
        if (!ranger || ranger.isDead || player.isDead) return;
        rangerLobuts.push({
            startX: ranger.x, startY: ranger.y,
            targetX: player.x, targetY: player.y,
            flightTimer: RANGER_LOBUT_FLIGHT, maxFlight: RANGER_LOBUT_FLIGHT, isDead: false
        });
        rangerLobutCooldown = RANGER_LOBUT_COOLDOWN;
    }

    function spawnFalcerUyari() {
        const x = Math.random() * (canvas.width - 200) + 100;
        const y = Math.random() * (canvas.height - 200) + 100;
        falcerUyarilar.push({ x, y, timer: FALCER_SPAWN_WARN });
    }

    function dogurFalcer(x, y) {
        falcerler.push({
            x, y, radius: FALCER_RADIUS,
            hp: FALCER_HP, maxHp: FALCER_HP,
            speed: FALCER_SPEED, angle: 0,
            isDead: false, isActive: true,
            color: '#8e44ad', kbX: 0, kbY: 0,
            lastAction: Date.now(),
            dashState: 'idle', dashTimer: 0, dashVx: 0, dashVy: 0,
            stunTimer: 0, _noRage: true
        });
        spawnParticles(x, y, '#8e44ad', 'smoke');
    }

    function piyadeOlumMermiSac(px, py) {
        for (let i = 0; i < PIYADE_DEATH_MERMI_SAYISI; i++) {
            const a = (Math.PI / 4) + (i * Math.PI / 2);
            piyadeDeathMermiler.push({
                x: px, y: py, sx: px, sy: py,
                vx: Math.cos(a) * PIYADE_DEATH_MERMI_HIZ,
                vy: Math.sin(a) * PIYADE_DEATH_MERMI_HIZ,
                radius: PIYADE_DEATH_MERMI_RADIUS,
                hasar: PIYADE_DEATH_MERMI_HASAR, menzil: PIYADE_DEATH_MERMI_MENZIL, isDead: false
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
            if (!player.isDead && !player.jumpInvulnerable && !player.isInvisible && getDist(kami, player) < KAMI_PLAYER_RADIUS + player.radius) {
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
            if (!player.isDead && !player.jumpInvulnerable && !player.isInvisible && getDist(kami, player) < KAMI_WALL_AOE_RADIUS + player.radius) {
                player.hp -= KAMI_WALL_AOE * dmgMult;
                rawDamageText(player.x, player.y, KAMI_WALL_AOE * dmgMult, "#e74c3c");
                player.lastHitTime = Date.now();
            }
        }
        for (let i = 0; i < 15; i++) {
            const ang = Math.random() * Math.PI * 2; const sp = 3 + Math.random() * 5;
            particles.push({ x: kami.x, y: kami.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 25, maxLife: 25, color: Math.random() < 0.5 ? '#e67e22' : '#c0392b', size: 3 + Math.random() * 3, type: 'normal' });
        }
        kami.isDead = true;
        if (!kami._noScore) triggerBotKill(kami.x, kami);
    }

    function miniPatlat(mini) {
        explosions.push({ x: mini.x, y: mini.y, radius: 8, maxRadius: MINI_PLAYER_RADIUS, life: 12, maxLife: 12 });
        screenShake = 4;
        const inCavusAura = heavyBot && heavyBot.type === 'cavus' && !heavyBot.isDead && cavusAuraActive && getDist(mini, heavyBot) < CAVUS_AURA_RADIUS;
        let dmgMult = inCavusAura ? 2 : 1;
        if (mini._rageActive) dmgMult *= 2;
        const baseDmg = mini._customDmg || MINI_PLAYER_DMG;
        const finalPlayerDmg = baseDmg * dmgMult;
        if (!player.isDead && !player.jumpInvulnerable && !player.isInvisible && getDist(mini, player) < MINI_PLAYER_RADIUS + player.radius) {
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
        mini.isDead = true;
        if (!mini._noScore) triggerBotKill(mini.x, mini);
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
        if (!player.isDead && !player.jumpInvulnerable && !player.isInvisible && getDist(mini, player) < MINI_WALL_AOE_RADIUS + player.radius) {
            player.hp -= MINI_WALL_AOE * dmgMult;
            rawDamageText(player.x, player.y, MINI_WALL_AOE * dmgMult, "#e74c3c");
            player.lastHitTime = Date.now();
        }
        mini.isDead = true;
        if (!mini._noScore) triggerBotKill(mini.x, mini);
    }

    // ===== MODE =====
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
            falcerler = []; falcerSpawnCount = 0; falcerUyarilar = [];
            rageActive = false; rageTimer = 0;

            bot.isActive = false; bot.isDead = true; bot.x = -9999; bot.y = -9999;
            bot2.isActive = false; bot2.isDead = true; bot2.x = -9999; bot2.y = -9999;
            slimeBots = []; stationaryBots = []; boomerangBots = []; fogBots = [];
            spawnIndicators = [];

            // TEK YUVA: 1 tane ortada, slime üretir
            nests = [{
                x: canvas.width / 2, y: canvas.height / 2,
                radius: 40, color: '#e67e22', isNest: true, speed: 0,
                hp: 3000, maxHp: 3000, isDead: false, kbX: 0, kbY: 0,
                alerted: false, lastSpawn: Date.now(), spawnCount: 0,
                bombaBulasti: false, bombaSayaci: 0
            }];

            obstacles.forEach(o => { o.maxHp = SIPER_CAN; o.hp = SIPER_CAN; o._griSiper = true; });

            // Slime rengini turuncuya çevir (üretim devam eder)
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
            // YUVA LİMİT: Base her 10 kill'de yeni yuva ekliyor, biz 1'de tutalım
            // (Mevcut yuvaları silme, sadece base'in eklemesini engelle)
            lastNestKillCount = botsKilled;
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

            // ÇAVUŞ HASAR YÖNLENDİRME
            const redirectBots = [piyade, turuncuBot, ranger, ...slimeBots, ...falcerler].filter(b => b && !b.isDead);
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
            botPrevHp.forEach((v, k) => { if (!k || k.isDead || !redirectBots.includes(k)) botPrevHp.delete(k); });

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
                } else if (b._curlosJumpActive) {
                    // ← Curlos zıplatıyor: bekle
                    b._stuckTimer = 0;
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
                if (!player.isDead && !player.jumpInvulnerable && !player.isInvisible && getDist(m, player) < player.radius + m.radius) {
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
                else if (b._curlosJumpActive) {
                    // ← Curlos zıplatıyor: bekle
                } else {
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
                } else if (heavyBot._curlosJumpActive) {
                    // ← Curlos zıplatıyor: Havan/Çavuş durur
                } else {
                    if (heavyBot.type === 'havan') {
                        havanShootTimer += ts;
                        if (havanMuzzleFlash > 0) havanMuzzleFlash -= ts;
                        if (havanShootTimer >= HAVAN_SHOOT_INTERVAL) { havanShootTimer = 0; havanAtes(); }
                    } else {
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

                        if (cavusAuraActive) {
                            cavusAuraTimer -= ts; cavusAuraTick += ts;
                            if (cavusAuraTimer <= 0) {
                                cavusAuraActive = false; cavusAuraCooldown = CAVUS_AURA_COOLDOWN; heavyBot.shield = 0;
                            } else if (cavusAuraTick >= 60) {
                                cavusAuraTick = 0;
                                heavyBot.hp = Math.min(heavyBot.maxHp, heavyBot.hp + CAVUS_HEAL_PER_TICK);
                                rawDamageText(heavyBot.x, heavyBot.y - 20, "+" + CAVUS_HEAL_PER_TICK, "#2ecc71");
                                const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots, ...falcerler].filter(b => b && !b.isDead);
                                allBots.forEach(b => {
                                    if (getDist(b, heavyBot) < CAVUS_AURA_RADIUS) {
                                        b.hp = Math.min(b.maxHp, b.hp + CAVUS_HEAL_BOTS);
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
                    if (!player.isDead && !player.jumpInvulnerable && !player.isInvisible && getDist(m, player) < HAVAN_MERMI_AOE + player.radius) {
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
                if (k._curlosJumpActive) { k._stuckTimer = 0; continue; }

                const canSee = !player.isDead && !player.isInvisible && !player.jumpInvulnerable;
                const dP = getDist(k, player);
                if (canSee && dP < KAMI_TRIGGER_DIST) { kamikazePatlat(k, 'player', null); continue; }
                k._lastX = k.x; k._lastY = k.y;
                const shouldMove = !player.isInvisible && !player.isDead;
                if (shouldMove) {
                    k.angle = Math.atan2(safePlayerY - k.y, safePlayerX - k.x);
                    k.x += Math.cos(k.angle) * k.speed * ts;
                    k.y += Math.sin(k.angle) * k.speed * ts;
                }
                if (Math.abs(k.kbX) > 0.1 || Math.abs(k.kbY) > 0.1) { k.x += k.kbX * ts; k.y += k.kbY * ts; k.kbX *= 0.85; k.kbY *= 0.85; }
                k.x = clampPos(k.x, k.radius + WALL_THICKNESS, canvas.width - k.radius - WALL_THICKNESS);
                k.y = clampPos(k.y, k.radius + WALL_THICKNESS, canvas.height - k.radius - WALL_THICKNESS);
                resolveObstacleCollision(k);
                const moved = Math.hypot(k.x - k._lastX, k.y - k._lastY);
                if (shouldMove && moved < k.speed * ts * 0.4) k._stuckTimer += ts; else k._stuckTimer = 0;
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
                if (k._curlosJumpActive) { k._stuckTimer = 0; continue; }

                const canSee = !player.isDead && !player.isInvisible && !player.jumpInvulnerable;
                const dP = getDist(k, player);
                if (canSee && dP < MINI_TRIGGER_DIST) { miniPatlat(k); continue; }
                k._lastX = k.x; k._lastY = k.y;
                const shouldMove = !player.isInvisible && !player.isDead;
                if (shouldMove) {
                    k.angle = Math.atan2(safePlayerY - k.y, safePlayerX - k.x);
                    k.x += Math.cos(k.angle) * k.speed * ts;
                    k.y += Math.sin(k.angle) * k.speed * ts;
                }
                if (Math.abs(k.kbX) > 0.1 || Math.abs(k.kbY) > 0.1) { k.x += k.kbX * ts; k.y += k.kbY * ts; k.kbX *= 0.85; k.kbY *= 0.85; }
                k.x = clampPos(k.x, k.radius + WALL_THICKNESS, canvas.width - k.radius - WALL_THICKNESS);
                k.y = clampPos(k.y, k.radius + WALL_THICKNESS, canvas.height - k.radius - WALL_THICKNESS);
                resolveObstacleCollision(k);
                const moved = Math.hypot(k.x - k._lastX, k.y - k._lastY);
                if (shouldMove && moved < k.speed * ts * 0.4) k._stuckTimer += ts; else k._stuckTimer = 0;
                if (k._stuckTimer >= MINI_STUCK_FRAMES) {
                    let yakinDuvar = null, enYakin = Infinity;
                    for (const o of obstacles.concat(cactusWalls || [])) {
                        const d = getDist(k, o) - o.radius - k.radius;
                        if (d < 30 && d < enYakin) { enYakin = d; yakinDuvar = o; }
                    }
                    if (yakinDuvar) miniDuvarPatlat(k, yakinDuvar); else miniPatlat(k);
                }
            }

            // RANGER
            if (!ranger) {
                if (rangerSpawnUyari > 0) { rangerSpawnUyari -= ts; if (rangerSpawnUyari <= 0) dogurRanger(); }
                else { rangerSpawnTimer += ts; if (rangerSpawnTimer >= RANGER_SPAWN_INTERVAL) { rangerSpawnTimer = 0; spawnRangerUyari(); } }
            }
            if (ranger && !ranger.isDead) {
                if (ranger.hp <= 0) {
                    ranger.isDead = true; spawnParticles(ranger.x, ranger.y, ranger.color, 'smoke');
                    triggerBotKill(ranger.x, ranger); clearAllBuffs(); ranger = null;
                } else if (ranger._curlosJumpActive) {
                    // ← Curlos zıplatıyor: Ranger durur
                } else {
                    const dP = getDist(ranger, player);
                    if (!player.isDead) {
                        ranger.angle = Math.atan2(safePlayerY - ranger.y, safePlayerX - ranger.x);
                        if (dP > RANGER_STOP_DIST) {
                            ranger.x += Math.cos(ranger.angle) * RANGER_SPEED * ts;
                            ranger.y += Math.sin(ranger.angle) * RANGER_SPEED * ts;
                        } else if (dP < 100) {
                            ranger.x -= Math.cos(ranger.angle) * RANGER_SPEED * 0.5 * ts;
                            ranger.y -= Math.sin(ranger.angle) * RANGER_SPEED * 0.5 * ts;
                        } else {
                            const perpAng = ranger.angle + Math.PI / 2;
                            ranger.x += Math.cos(perpAng) * RANGER_SPEED * 0.4 * ts * (Math.random() < 0.5 ? 1 : -1);
                            ranger.y += Math.sin(perpAng) * RANGER_SPEED * 0.4 * ts * (Math.random() < 0.5 ? 1 : -1);
                        }
                        ranger.x = clampPos(ranger.x, RANGER_RADIUS + WALL_THICKNESS, canvas.width - RANGER_RADIUS - WALL_THICKNESS);
                        ranger.y = clampPos(ranger.y, RANGER_RADIUS + WALL_THICKNESS, canvas.height - RANGER_RADIUS - WALL_THICKNESS);
                        resolveObstacleCollision(ranger);
                    }
                    if (rangerLobutCooldown > 0) rangerLobutCooldown -= ts;
                    else if (!player.isDead && !player.isInvisible && dP < RANGER_RANGE) rangerLobutAt();

                    rangerAuraTimer += ts;
                    const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots, ...falcerler].filter(b => b && !b.isDead);
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
                const allBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots, ...falcerler].filter(b => b && !b.isDead);
                allBots.forEach(b => { if (b._rangerBuffed) { b.speed = b._rangerOrigSpeed; b._rangerBuffed = false; } });
            }

            for (let i = rangerLobuts.length - 1; i >= 0; i--) {
                const l = rangerLobuts[i];
                if (!l || l.isDead) { if (l) rangerLobuts.splice(i, 1); continue; }
                l.flightTimer -= ts;
                if (l.flightTimer <= 0) {
                    explosions.push({ x: l.targetX, y: l.targetY, radius: 5, maxRadius: RANGER_LOBUT_AOE, life: 15, maxLife: 15 });
                    screenShake = 6;
                    if (!player.isDead && !player.jumpInvulnerable && !player.isInvisible && getDist({ x: l.targetX, y: l.targetY }, player) < RANGER_LOBUT_AOE + player.radius) {
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

            // FALCER
            if (modKillCount > 0 && modKillCount % FALCER_KILL_REQUIREMENT === 0 && modKillCount !== falcerSpawnCount) {
                falcerSpawnCount = modKillCount;
                if (falcerler.length + falcerUyarilar.length < FALCER_MAX) spawnFalcerUyari();
            }
            for (let i = falcerUyarilar.length - 1; i >= 0; i--) {
                const u = falcerUyarilar[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    if (falcerler.length < FALCER_MAX) dogurFalcer(u.x, u.y);
                    falcerUyarilar.splice(i, 1);
                }
            }

            for (let i = falcerler.length - 1; i >= 0; i--) {
                const f = falcerler[i];
                if (f.isDead) { falcerler.splice(i, 1); continue; }
                if (f.hp <= 0) {
                    f.isDead = true;
                    spawnParticles(f.x, f.y, f.color, 'smoke');
                    triggerBotKill(f.x, f);
                    continue;
                }
                if (f._curlosJumpActive) {
                    // ← Curlos zıplatıyor: Falcer durur
                    continue;
                }
                if (f.dashState === 'dashing') {
                    f.dashTimer -= ts;
                    f.x += f.dashVx * ts;
                    f.y += f.dashVy * ts;
                    f.x = clampPos(f.x, f.radius + WALL_THICKNESS, canvas.width - f.radius - WALL_THICKNESS);
                    f.y = clampPos(f.y, f.radius + WALL_THICKNESS, canvas.height - f.radius - WALL_THICKNESS);
                    resolveObstacleCollision(f);
                    if (!player.isDead && !player.jumpInvulnerable && !player.isInvisible && getDist(f, player) < f.radius + player.radius + 5) {
                        player.hp -= FALCER_DASH_DMG;
                        rawDamageText(player.x, player.y, FALCER_DASH_DMG, "#8e44ad");
                        player.lastHitTime = Date.now();
                        player._falcerStun = FALCER_DASH_STUN;
                        screenShake = 8;
                    }
                    if (f.dashTimer <= 0) {
                        f.dashState = 'stunned';
                        f.stunTimer = FALCER_DASH_STUN;
                    }
                } else if (f.dashState === 'stunned') {
                    f.stunTimer -= ts;
                    if (f.stunTimer <= 0) {
                        f.dashState = 'idle';
                        f.lastAction = Date.now();
                    }
                } else {
                    const dP = getDist(f, player);
                    if (!player.isDead) {
                        f.angle = Math.atan2(safePlayerY - f.y, safePlayerX - f.x);
                        if (dP > FALCER_RANGE) {
                            f.x += Math.cos(f.angle) * f.speed * ts;
                            f.y += Math.sin(f.angle) * f.speed * ts;
                            f.x = clampPos(f.x, f.radius + WALL_THICKNESS, canvas.width - f.radius - WALL_THICKNESS);
                            f.y = clampPos(f.y, f.radius + WALL_THICKNESS, canvas.height - f.radius - WALL_THICKNESS);
                            resolveObstacleCollision(f);
                        }
                    }
                    if (Date.now() - f.lastAction > FALCER_ACTION_INTERVAL * 16.666) {
                        f.lastAction = Date.now();
                        if (Math.random() < 0.5 && dP < FALCER_DASH_RANGE + 50) {
                            f.dashState = 'dashing';
                            f.dashTimer = 8;
                            f.dashVx = Math.cos(f.angle) * FALCER_DASH_SPEED;
                            f.dashVy = Math.sin(f.angle) * FALCER_DASH_SPEED;
                        } else if (dP < FALCER_RANGE) {
                            botBullets.push({
                                x: f.x, y: f.y, sx: f.x, sy: f.y,
                                vx: Math.cos(f.angle) * BOT_BULLET_SPEED,
                                vy: Math.sin(f.angle) * BOT_BULLET_SPEED,
                                dmgMod: 1, type: 'stationary_bot_bullet', owner: f,
                                _customDmg: FALCER_BULLET_DMG
                            });
                        }
                    }
                }
                f.x = clampPos(f.x, f.radius + WALL_THICKNESS, canvas.width - f.radius - WALL_THICKNESS);
                f.y = clampPos(f.y, f.radius + WALL_THICKNESS, canvas.height - f.radius - WALL_THICKNESS);
            }

            if (player._falcerStun > 0) player._falcerStun -= ts;
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
            falcerler = []; falcerSpawnCount = 0; falcerUyarilar = [];
            rageActive = false; rageTimer = 0;
            clearAllBuffs();
            bot.isActive = true; bot.isDead = false; bot.hp = bot.maxHp;
            bot.x = canvas.width - 150; bot.y = 300; bot.kbX = bot.kbY = 0;
            bot2.isActive = false; bot2.isDead = true; bot2.hp = bot2.maxHp;
            bot2.respawnTimer = -9999;
            botsKilled = 0;
        }
    });

    window.GAME_EXT.chainHook('onEnemyKilled', function (enemy) {
        if (window.GAME_MODE !== MOD_ID) return;
        if (!enemy) return;
        if (enemy._noScore) return;
        if (enemy === piyade || enemy === turuncuBot || enemy === heavyBot || enemy === ranger || falcerler.includes(enemy)) {
            modKillCount++;
            if (modKillCount % KAMI_KILL_TRIGGER === 0 && kamikazeler.length < KAMI_MAX && kamiSpawnUyarilari.length === 0) {
                spawnKamikazeUyari();
            }
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
        liste.push(...falcerler.filter(f => !f.isDead));
        return liste;
    });

    // ===== ÇİZİM (Buz modundan ilham alan grafikler) =====
    window.GAME_EXT.chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID || !gameStarted) return;

        const now = Date.now();

        // SİPERLER
        for (const o of obstacles) {
            ctx2.save(); ctx2.translate(o.x, o.y);
            ctx2.fillStyle = 'rgba(0,0,0,0.35)';
            ctx2.beginPath(); ctx2.ellipse(0, o.radius * 0.3, o.radius * 0.95, o.radius * 0.4, 0, 0, Math.PI * 2); ctx2.fill();
            const siperGrad = ctx2.createRadialGradient(-o.radius * 0.3, -o.radius * 0.3, 0, 0, 0, o.radius * 1.5);
            siperGrad.addColorStop(0, '#a0a0a0');
            siperGrad.addColorStop(0.7, '#808080');
            siperGrad.addColorStop(1, '#606060');
            ctx2.fillStyle = siperGrad;
            ctx2.beginPath(); ctx2.roundRect(-o.radius, -o.radius, o.radius * 2, o.radius * 2, 10); ctx2.fill();
            ctx2.strokeStyle = '#404040'; ctx2.lineWidth = 2.5; ctx2.stroke();
            ctx2.strokeStyle = 'rgba(255,255,255,0.15)'; ctx2.lineWidth = 1.5;
            ctx2.beginPath(); ctx2.roundRect(-o.radius + 4, -o.radius + 4, (o.radius - 4) * 2, (o.radius - 4) * 2, 6); ctx2.stroke();
            ctx2.fillStyle = 'rgba(0,0,0,0.6)'; ctx2.fillRect(-15, -o.radius - 17, 30, 5);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-15, -o.radius - 17, 30 * (o.hp / o.maxHp), 5);
            ctx2.restore();
        }

        // YUVA (turuncu glow)
        nests.forEach(n => {
            if (n.isDead) return;
            ctx2.save(); ctx2.translate(n.x, n.y);
            const pulse = 1 + Math.sin(now / 300) * 0.08;
            const nGrad = ctx2.createRadialGradient(0, 0, 0, 0, 0, n.radius * 1.4);
            nGrad.addColorStop(0, 'rgba(230, 126, 34, 0.6)');
            nGrad.addColorStop(0.6, 'rgba(211, 84, 0, 0.4)');
            nGrad.addColorStop(1, 'rgba(211, 84, 0, 0)');
            ctx2.beginPath(); ctx2.arc(0, 0, n.radius * 1.4 * pulse, 0, Math.PI * 2);
            ctx2.fillStyle = nGrad; ctx2.fill();
            ctx2.fillStyle = '#d35400';
            ctx2.beginPath(); ctx2.arc(0, 0, n.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#e67e22'; ctx2.lineWidth = 3;
            ctx2.shadowColor = '#e67e22'; ctx2.shadowBlur = 12; ctx2.stroke(); ctx2.shadowBlur = 0;
            ctx2.fillStyle = '#f39c12';
            ctx2.beginPath(); ctx2.arc(0, 0, n.radius * 0.5, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = 'rgba(0,0,0,0.6)'; ctx2.fillRect(-25, -n.radius - 18, 50, 5);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-25, -n.radius - 18, 50 * (n.hp / n.maxHp), 5);
            ctx2.restore();
        });

        // RANGER AURASI
        if (ranger && !ranger.isDead) {
            const pulse = 1 + Math.sin(now / 300) * 0.05;
            ctx2.save();
            const rGrad = ctx2.createRadialGradient(ranger.x, ranger.y, 0, ranger.x, ranger.y, RANGER_AURA_RADIUS * pulse);
            rGrad.addColorStop(0, 'rgba(241, 196, 15, 0.08)');
            rGrad.addColorStop(0.7, 'rgba(241, 196, 15, 0.03)');
            rGrad.addColorStop(1, 'rgba(241, 196, 15, 0)');
            ctx2.beginPath(); ctx2.arc(ranger.x, ranger.y, RANGER_AURA_RADIUS * pulse, 0, Math.PI * 2);
            ctx2.fillStyle = rGrad; ctx2.fill();
            ctx2.beginPath(); ctx2.arc(ranger.x, ranger.y, RANGER_AURA_RADIUS * pulse, 0, Math.PI * 2);
            ctx2.strokeStyle = 'rgba(241, 196, 15, 0.7)'; ctx2.lineWidth = 2.5; ctx2.setLineDash([8, 8]); ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.restore();
        }

        // ÇAVUŞ AURASI
        if (heavyBot && heavyBot.type === 'cavus' && !heavyBot.isDead && cavusAuraActive) {
            const pulse = 1 + Math.sin(now / 200) * 0.04;
            ctx2.save();
            const cGrad = ctx2.createRadialGradient(heavyBot.x, heavyBot.y, 0, heavyBot.x, heavyBot.y, CAVUS_AURA_RADIUS * pulse);
            cGrad.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
            cGrad.addColorStop(0.6, 'rgba(255, 215, 0, 0.12)');
            cGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx2.beginPath(); ctx2.arc(heavyBot.x, heavyBot.y, CAVUS_AURA_RADIUS * pulse, 0, Math.PI * 2);
            ctx2.fillStyle = cGrad; ctx2.fill();
            ctx2.beginPath(); ctx2.arc(heavyBot.x, heavyBot.y, CAVUS_AURA_RADIUS * pulse, 0, Math.PI * 2);
            ctx2.strokeStyle = 'rgba(255, 215, 0, 0.95)'; ctx2.lineWidth = 4;
            ctx2.shadowColor = '#ffd700'; ctx2.shadowBlur = 15; ctx2.stroke();
            ctx2.shadowBlur = 0;
            const botsInAura = [piyade, turuncuBot, ranger, ...kamikazeler, ...miniKamikazeler, ...slimeBots, ...falcerler].filter(b => b && !b.isDead && getDist(b, heavyBot) < CAVUS_AURA_RADIUS);
            botsInAura.forEach(b => {
                ctx2.save();
                ctx2.globalAlpha = 0.35 + Math.sin(now / 120) * 0.1;
                const bGrad = ctx2.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 1.8);
                bGrad.addColorStop(0, 'rgba(255, 215, 0, 0.6)');
                bGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
                ctx2.beginPath(); ctx2.arc(b.x, b.y, b.radius * 1.8, 0, Math.PI * 2);
                ctx2.fillStyle = bGrad; ctx2.fill();
                ctx2.restore();
            });
            ctx2.restore();
        }

        // SPAWN SAYAÇLARI
        function drawSpawnWarn(x, y, radius, timer, color) {
            if (timer <= 0) return;
            const pulse = 1 + Math.sin(now / 150) * 0.1;
            ctx2.save(); ctx2.translate(x, y);
            ctx2.globalAlpha = 0.6 + Math.abs(Math.sin(now / 150)) * 0.4;
            ctx2.shadowColor = color; ctx2.shadowBlur = 20;
            ctx2.beginPath(); ctx2.arc(0, 0, (radius + 15) * pulse, 0, Math.PI * 2);
            ctx2.strokeStyle = color; ctx2.lineWidth = 5; ctx2.stroke();
            ctx2.shadowBlur = 0;
            ctx2.beginPath(); ctx2.arc(0, 0, (radius + 10) * pulse, 0, Math.PI * 2);
            ctx2.strokeStyle = color; ctx2.lineWidth = 2; ctx2.globalAlpha = 0.5; ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = color;
            ctx2.font = "bold 26px Arial"; ctx2.textAlign = "center";
            ctx2.strokeStyle = 'rgba(0,0,0,0.7)'; ctx2.lineWidth = 4;
            ctx2.strokeText(Math.ceil(timer / 60), 0, 9);
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
        falcerUyarilar.forEach(u => drawSpawnWarn(u.x, u.y, FALCER_RADIUS, u.timer, '#8e44ad'));

        // PİYADE
        if (piyade && !piyade.isDead) {
            const b = piyade;
            ctx2.save(); ctx2.translate(b.x, b.y);
            ctx2.fillStyle = 'rgba(0,0,0,0.35)';
            ctx2.beginPath(); ctx2.ellipse(0, b.radius * 0.4, b.radius * 0.9, b.radius * 0.35, 0, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = 'rgba(0,0,0,0.6)'; ctx2.fillRect(-20, -b.radius - 17, 40, 6);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-20, -b.radius - 17, 40 * (b.hp / b.maxHp), 6);
            ctx2.rotate(b.angle);
            const pGrad = ctx2.createRadialGradient(-b.radius * 0.3, -b.radius * 0.3, 0, 0, 0, b.radius);
            pGrad.addColorStop(0, '#e67e22');
            pGrad.addColorStop(1, '#a04000');
            ctx2.fillStyle = pGrad;
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#5d4037'; ctx2.lineWidth = 2.5; ctx2.stroke();
            ctx2.fillStyle = '#5d4037'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.65, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        }

        // TURUNCU BOT
        if (turuncuBot && !turuncuBot.isDead) {
            const b = turuncuBot;
            ctx2.save(); ctx2.translate(b.x, b.y);
            ctx2.fillStyle = 'rgba(0,0,0,0.35)';
            ctx2.beginPath(); ctx2.ellipse(0, b.radius * 0.4, b.radius * 0.9, b.radius * 0.35, 0, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = 'rgba(0,0,0,0.6)'; ctx2.fillRect(-20, -b.radius - 17, 40, 6);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-20, -b.radius - 17, 40 * (b.hp / b.maxHp), 6);
            ctx2.rotate(b.angle);
            const tGrad = ctx2.createRadialGradient(-b.radius * 0.3, -b.radius * 0.3, 0, 0, 0, b.radius);
            tGrad.addColorStop(0, '#f39c12');
            tGrad.addColorStop(1, '#b8860b');
            ctx2.fillStyle = tGrad;
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 2.5; ctx2.stroke();
            ctx2.fillStyle = '#a04000'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.7, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        }

        // AĞIR BOT
        if (heavyBot && !heavyBot.isDead) {
            const b = heavyBot;
            ctx2.save(); ctx2.translate(b.x, b.y);
            ctx2.fillStyle = 'rgba(0,0,0,0.4)';
            ctx2.beginPath(); ctx2.ellipse(0, b.radius * 0.4, b.radius * 1.05, b.radius * 0.4, 0, 0, Math.PI * 2); ctx2.fill();
            if (b.type === 'havan') {
                ctx2.fillStyle = 'rgba(0,0,0,0.6)'; ctx2.fillRect(-30, -b.radius - 20, 60, 6);
                ctx2.fillStyle = '#c0392b'; ctx2.fillRect(-30, -b.radius - 20, 60 * (b.hp / b.maxHp), 6);
                const hGrad = ctx2.createRadialGradient(-b.radius * 0.3, -b.radius * 0.3, 0, 0, 0, b.radius);
                hGrad.addColorStop(0, '#8d6e63');
                hGrad.addColorStop(0.7, '#5d4037');
                hGrad.addColorStop(1, '#3e2723');
                ctx2.fillStyle = hGrad;
                ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
                ctx2.strokeStyle = '#3e2723'; ctx2.lineWidth = 3; ctx2.stroke();
                ctx2.fillStyle = '#3e2723';
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2;
                    ctx2.beginPath(); ctx2.arc(Math.cos(a) * (b.radius - 4), Math.sin(a) * (b.radius - 4), 4, 0, Math.PI * 2); ctx2.fill();
                }
                ctx2.fillStyle = '#8d6e63'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius - 8, 0, Math.PI * 2); ctx2.fill();
                const recoil = (havanMuzzleFlash > 0) ? (havanMuzzleFlash / 15) * 6 : 0;
                ctx2.fillStyle = '#1a0a00'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 10, 0, Math.PI * 2); ctx2.fill();
                ctx2.strokeStyle = '#808080'; ctx2.lineWidth = 2; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 10, 0, Math.PI * 2); ctx2.stroke();
                ctx2.fillStyle = '#000'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 6, 0, Math.PI * 2); ctx2.fill();
                if (havanMuzzleFlash > 0) {
                    ctx2.globalAlpha = havanMuzzleFlash / 15;
                    ctx2.shadowColor = '#ff5500'; ctx2.shadowBlur = 20;
                    ctx2.fillStyle = '#ff5500'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 16, 0, Math.PI * 2); ctx2.fill();
                    ctx2.fillStyle = '#ffff00'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 8, 0, Math.PI * 2); ctx2.fill();
                    ctx2.shadowBlur = 0; ctx2.globalAlpha = 1;
                }
            } else {
                ctx2.fillStyle = 'rgba(0,0,0,0.6)'; ctx2.fillRect(-30, -b.radius - 20, 60, 6);
                ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-30, -b.radius - 20, 60 * (b.hp / b.maxHp), 6);
                if (b.shield > 0) {
                    ctx2.strokeStyle = '#00ffff'; ctx2.lineWidth = 4;
                    ctx2.shadowColor = '#00ffff'; ctx2.shadowBlur = 15;
                    ctx2.globalAlpha = 0.9; ctx2.beginPath(); ctx2.arc(0, 0, b.radius + 6, 0, Math.PI * 2); ctx2.stroke();
                    ctx2.globalAlpha = 0.3; ctx2.fillStyle = '#00ffff'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius + 6, 0, Math.PI * 2); ctx2.fill();
                    ctx2.shadowBlur = 0; ctx2.globalAlpha = 1;
                }
                ctx2.rotate(b.angle);
                const cGrad2 = ctx2.createRadialGradient(-b.radius * 0.3, -b.radius * 0.3, 0, 0, 0, b.radius);
                cGrad2.addColorStop(0, '#d4a017');
                cGrad2.addColorStop(1, '#8b6914');
                ctx2.fillStyle = cGrad2;
                ctx2.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2;
                    const px = Math.cos(a) * b.radius;
                    const py = Math.sin(a) * b.radius;
                    if (i === 0) ctx2.moveTo(px, py); else ctx2.lineTo(px, py);
                }
                ctx2.closePath(); ctx2.fill();
                ctx2.strokeStyle = '#5d4037'; ctx2.lineWidth = 3; ctx2.stroke();
                ctx2.fillStyle = '#2c3e50'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.75, 0, Math.PI * 2); ctx2.fill();
                ctx2.fillStyle = '#f1c40f'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.4, 0, Math.PI * 2); ctx2.fill();
            }
            ctx2.restore();
        }

        // RANGER
        if (ranger && !ranger.isDead) {
            ctx2.save(); ctx2.translate(ranger.x, ranger.y);
            ctx2.fillStyle = 'rgba(0,0,0,0.35)';
            ctx2.beginPath(); ctx2.ellipse(0, ranger.radius * 0.4, ranger.radius * 0.9, ranger.radius * 0.35, 0, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = 'rgba(0,0,0,0.6)'; ctx2.fillRect(-18, -ranger.radius - 15, 36, 5);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-18, -ranger.radius - 15, 36 * (ranger.hp / ranger.maxHp), 5);
            ctx2.rotate(ranger.angle);
            const rGrad2 = ctx2.createRadialGradient(-ranger.radius * 0.3, 0, 0, 0, 0, ranger.radius * 1.4);
            rGrad2.addColorStop(0, '#f39c12');
            rGrad2.addColorStop(1, '#a04000');
            ctx2.fillStyle = rGrad2;
            ctx2.beginPath(); ctx2.ellipse(0, 0, ranger.radius * 1.2, ranger.radius * 0.85, 0, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 2.5; ctx2.stroke();
            ctx2.fillStyle = '#d35400'; ctx2.beginPath(); ctx2.arc(0, 0, ranger.radius * 0.6, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        }

        // FALCER
        falcerler.forEach(f => {
            if (f.isDead) return;
            ctx2.save(); ctx2.translate(f.x, f.y);
            ctx2.fillStyle = 'rgba(0,0,0,0.4)';
            ctx2.beginPath(); ctx2.ellipse(0, f.radius * 0.4, f.radius * 0.9, f.radius * 0.35, 0, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = 'rgba(0,0,0,0.6)'; ctx2.fillRect(-20, -f.radius - 17, 40, 6);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-20, -f.radius - 17, 40 * (f.hp / f.maxHp), 6);
            if (f.dashState === 'dashing') {
                ctx2.shadowColor = '#8e44ad'; ctx2.shadowBlur = 20;
                ctx2.globalAlpha = 0.6;
                ctx2.beginPath(); ctx2.arc(0, 0, f.radius + 8, 0, Math.PI * 2);
                ctx2.strokeStyle = '#8e44ad'; ctx2.lineWidth = 4; ctx2.stroke();
                ctx2.shadowBlur = 0; ctx2.globalAlpha = 1;
            } else if (f.dashState === 'stunned') {
                const alpha = 0.6 + Math.sin(now / 100) * 0.3;
                ctx2.globalAlpha = alpha;
                ctx2.fillStyle = '#f1c40f'; ctx2.font = 'bold 20px Arial'; ctx2.textAlign = 'center';
                ctx2.fillText('★', 0, -f.radius - 22);
                ctx2.globalAlpha = 1;
            }
            ctx2.rotate(f.angle);
            const fGrad = ctx2.createRadialGradient(-f.radius * 0.3, -f.radius * 0.3, 0, 0, 0, f.radius);
            fGrad.addColorStop(0, '#a569bd');
            fGrad.addColorStop(1, '#5b2c6f');
            ctx2.fillStyle = fGrad;
            ctx2.beginPath(); ctx2.arc(0, 0, f.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#5b2c6f'; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.fillStyle = '#5b2c6f'; ctx2.beginPath(); ctx2.arc(0, 0, f.radius * 0.5, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        });

        // HAVAN MERMİLERİ
        havanMermiler.forEach(m => {
            if (m.isDead) return;
            const prog = 1 - (m.flightTimer / m.maxFlight);
            ctx2.save();
            ctx2.globalAlpha = 0.5 + Math.sin(now / 100) * 0.3;
            ctx2.beginPath(); ctx2.arc(m.x, m.y, HAVAN_MERMI_AOE, 0, Math.PI * 2);
            ctx2.strokeStyle = '#c0392b'; ctx2.lineWidth = 3; ctx2.setLineDash([8, 6]); ctx2.stroke(); ctx2.setLineDash([]);
            ctx2.globalAlpha = 0.15;
            ctx2.beginPath(); ctx2.arc(m.x, m.y, HAVAN_MERMI_AOE * prog, 0, Math.PI * 2);
            ctx2.fillStyle = '#c0392b'; ctx2.fill();
            ctx2.restore();
            const currentX = m.startX + (m.x - m.startX) * prog;
            const currentY = m.startY + (m.y - m.startY) * prog;
            const arcHeight = Math.sin(prog * Math.PI) * 120;
            ctx2.save();
            ctx2.globalAlpha = 0.3;
            ctx2.beginPath(); ctx2.ellipse(m.x, m.y, 12 * prog, 5 * prog, 0, 0, Math.PI * 2);
            ctx2.fillStyle = '#000'; ctx2.fill(); ctx2.globalAlpha = 1;
            const mGrad = ctx2.createRadialGradient(currentX - 3, currentY - arcHeight - 3, 0, currentX, currentY - arcHeight, 9);
            mGrad.addColorStop(0, '#a93226');
            mGrad.addColorStop(1, '#641e16');
            ctx2.beginPath(); ctx2.arc(currentX, currentY - arcHeight, 9, 0, Math.PI * 2);
            ctx2.fillStyle = mGrad; ctx2.fill();
            ctx2.strokeStyle = '#c0392b'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        });

        // RANGER LOBUTLARI
        rangerLobuts.forEach(l => {
            if (!l || l.isDead) return;
            const prog = 1 - (l.flightTimer / l.maxFlight);
            ctx2.save();
            ctx2.globalAlpha = 0.4 + Math.sin(now / 100) * 0.2;
            ctx2.beginPath(); ctx2.arc(l.targetX, l.targetY, RANGER_LOBUT_AOE, 0, Math.PI * 2);
            ctx2.strokeStyle = '#e67e22'; ctx2.lineWidth = 3; ctx2.setLineDash([6, 6]); ctx2.stroke();
            ctx2.setLineDash([]); ctx2.restore();
            const currentX = l.startX + (l.targetX - l.startX) * prog;
            const currentY = l.startY + (l.targetY - l.startY) * prog;
            const arcHeight = Math.sin(prog * Math.PI) * 100;
            ctx2.save();
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

        // KAMİKAZELER
        kamikazeler.forEach(k => {
            if (k.isDead) return;
            ctx2.save(); ctx2.translate(k.x, k.y);
            ctx2.fillStyle = 'rgba(0,0,0,0.35)';
            ctx2.beginPath(); ctx2.ellipse(0, k.radius * 0.4, k.radius * 0.8, k.radius * 0.3, 0, 0, Math.PI * 2); ctx2.fill();
            ctx2.rotate(k.angle);
            const kGrad = ctx2.createRadialGradient(-k.radius * 0.3, 0, 0, 0, 0, k.radius * 1.2);
            kGrad.addColorStop(0, '#f39c12');
            kGrad.addColorStop(1, '#c0392b');
            ctx2.fillStyle = kGrad;
            ctx2.beginPath(); ctx2.moveTo(k.radius, 0); ctx2.lineTo(-k.radius, -k.radius * 0.8); ctx2.lineTo(-k.radius, k.radius * 0.8); ctx2.closePath();
            ctx2.fill();
            ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
            ctx2.save();
            const alpha = 0.7 + Math.sin(now / 150) * 0.3;
            ctx2.globalAlpha = alpha;
            ctx2.fillStyle = '#fff5e1'; ctx2.font = 'bold 14px Arial'; ctx2.textAlign = 'center';
            ctx2.strokeStyle = 'rgba(0,0,0,0.7)'; ctx2.lineWidth = 2;
            ctx2.strokeText('!', k.x, k.y - k.radius - 8);
            ctx2.fillText('!', k.x, k.y - k.radius - 8);
            ctx2.restore();
        });

        // MİNİ KAMİKAZELER
        miniKamikazeler.forEach(k => {
            if (k.isDead) return;
            ctx2.save(); ctx2.translate(k.x, k.y); ctx2.rotate(k.angle);
            const mkGrad = ctx2.createRadialGradient(-k.radius * 0.3, 0, 0, 0, 0, k.radius * 1.2);
            mkGrad.addColorStop(0, k._isRangerMini ? '#ffb347' : '#f39c12');
            mkGrad.addColorStop(1, k._isRangerMini ? '#cc6600' : '#c0392b');
            ctx2.fillStyle = mkGrad;
            ctx2.beginPath(); ctx2.moveTo(k.radius, 0); ctx2.lineTo(-k.radius, -k.radius * 0.8); ctx2.lineTo(-k.radius, k.radius * 0.8); ctx2.closePath();
            ctx2.fill();
            ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 1.5; ctx2.stroke();
            ctx2.restore();
        });

        // ÖFKE BUHARI
        if (rageActive) {
            const rageBots = [piyade, turuncuBot, ...kamikazeler, ...miniKamikazeler, ...slimeBots].filter(b => b && !b.isDead && b._rageActive);
            rageBots.forEach(b => {
                ctx2.save();
                ctx2.globalAlpha = 0.4 + Math.sin(now / 100) * 0.15;
                const rGrad = ctx2.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 2.8);
                rGrad.addColorStop(0, 'rgba(255, 0, 0, 0.7)');
                rGrad.addColorStop(0.5, 'rgba(200, 0, 0, 0.35)');
                rGrad.addColorStop(1, 'rgba(150, 0, 0, 0)');
                ctx2.beginPath(); ctx2.arc(b.x, b.y, b.radius * 2.8, 0, Math.PI * 2);
                ctx2.fillStyle = rGrad; ctx2.fill();
                ctx2.restore();
            });
        }

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
        const n = document.getElementById('diff-normal');
        const e = document.getElementById('diff-easy');
        if (n) { n.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); n.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
        if (e) { e.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); e.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
    })();

    window.GAME_EXT.modKartiEkle('turuncu', 'Turuncu Baskın', 'Piyade + Turuncu + Kamikaze + Havan/Çavuş + Ranger + Falcer');
    console.log('[MOD YÜKLENDİ] turuncu (v14)');
})();