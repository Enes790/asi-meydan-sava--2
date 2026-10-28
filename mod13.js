// ========== mod32.js (AĞIR SIKLETLER) - HARDCORE MOD ==========
// 4 ağır bot: Havan, Teker Tıraşı, Çavuş, Buz Boğası
// Sıra: Havan(10s) → Tıraşı(25s) → Çavuş(45s) → Boğa(80s)
// Her türden maksimum 1 tane, ölünce kendi süresiyle respawn
// Siperlerden buz slime çıkar, Çavuş ile 3 ciritçi gelir

(function () {
    'use strict';

    const MOD_ID = 'agirsikletler';

    // ===== HAVAN =====
    const HAVAN_HP = 5000, HAVAN_RADIUS = 26;
    const HAVAN_SHOOT_INTERVAL = 180;
    const HAVAN_MERMI_HASAR = 400, HAVAN_MERMI_AOE = 100;
    const HAVAN_SIPER_HASAR = 150, HAVAN_MERMI_FLIGHT = 90;

    // ===== TIRASI =====
    const TIRASI_HP = 1300, TIRASI_RADIUS = 18, TIRASI_SPEED = 0.5;
    const TIRASI_MENZIL = 140, TIRASI_HASAR = 150;
    const TIRASI_INSAA_SURESI = 280;

    // ===== HEYKEL =====
    const HEYKEL_HP = 9500, HEYKEL_RADIUS = 30, HEYKEL_SPEED = 0.6;
    const HEYKEL_SALDIRI_HASAR = 30, HEYKEL_SALDIRI_ARALIK = 90;
    const HEYKEL_PASIF_CAN_KAYBI = 200, HEYKEL_PASIF_KAYIP_ARALIK = 180;

    // ===== ÇAVUŞ =====
    const CAVUS_HP = 6500, CAVUS_RADIUS = 24, CAVUS_SPEED = 0.7;
    const CAVUS_SHOOT_INTERVAL = 120;
    const CAVUS_AURA_RADIUS = 140;
    const CAVUS_AURA_DURATION = 300, CAVUS_AURA_COOLDOWN = 300;
    const CAVUS_HEAL_PER_TICK = 450, CAVUS_HEAL_BOTS = 100;
    const CAVUS_DMG_REDIRECT = 0.30, CAVUS_STOP_DIST = 150;

    // ===== CİRİTÇİ =====
    const CIRITCI_HP = 2000, CIRITCI_RADIUS = 18, CIRITCI_SPEED = 0.8;
    const CIRITCI_SHOOT_RANGE = 220, CIRITCI_SHOOT_INTERVAL = 1200;
    const CIRITCI_DAMAGE = 450;
    const CIRITCI_MERMI_HIZ = BOT_BULLET_SPEED * 1.16;

    // ===== BOĞA =====
    const BOGA_HP = 10000, BOGA_NORMAL_HIZ = 0.5, BOGA_KOSMA_HIZ = 10.8;
    const BOGA_BEKLEME_SURE = 80, BOGA_SARJ_SURE = 80, BOGA_OFKE_SURE = 90;
    const BOGA_TEMAS_HASAR = 700, BOGA_SERSEMLE_SURE = 60;
    const BOGA_RADIUS = 28, BOGA_ITME_MESAFE = 25;

    // ===== BUZ BOTU =====
    const BUZ_BOT_HP = 4000, BUZ_BOT_RADIUS = 22, BUZ_BOT_SPEED = 0.9;
    const BUZ_BOT_TEMAS_HASAR = 450, BUZ_BOT_ITME_MESAFE = 40;
    const BUZ_BOT_PATLAMA_YARICAP = 68, BUZ_BOT_PATLAMA_HASAR = 150;
    const BUZ_BOT_SALDIRI_ARALIK = 1800;

    // ===== SPAWN TIMERS =====
    const HAVAN_INITIAL = 600;       // 10s
    const TIRASI_INITIAL = 1500;     // 25s
    const CAVUS_INITIAL = 2700;      // 45s
    const BOGA_INITIAL = 4800;       // 80s

    const HAVAN_RESPAWN = 600;       // 10s after death
    const TIRASI_RESPAWN = 900;      // 15s
    const CAVUS_RESPAWN = 1200;      // 20s
    const BOGA_RESPAWN = 2100;       // 35s

    const SPAWN_WARN = 180;

    // ===== STATE =====
    let havanBot = null, havanSpawnTimer = HAVAN_INITIAL, havanShootTimer = 0, havanMuzzleFlash = 0;
    let havanMermiler = [];

    let tirasiBot = null, tirasiSpawnTimer = TIRASI_INITIAL;
    let heykeller = [];

    let cavusBot = null, cavusSpawnTimer = CAVUS_INITIAL, cavusShootTimer = 0;
    let cavusAuraTimer = 0, cavusAuraCooldown = 0, cavusAuraActive = false, cavusAuraTick = 0;
    let ciritciBotlari = [];

    let bogaBot = null, bogaSpawnTimer = BOGA_INITIAL;
    let buzBotlari = [];

    let spawnUyarilar = [];
    let obstacleSnapshot = new Map();
    let botPrevHp = new Map();
    let rageActive = false, rageTimer = 0;

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

    function findSpawnPos() {
        for (let attempt = 0; attempt < 10; attempt++) {
            const x = Math.random() * (canvas.width - 300) + 150;
            const y = Math.random() * (canvas.height - 300) + 150;
            if (getDist({ x, y }, player) > 250) return { x, y };
        }
        return { x: canvas.width / 2, y: canvas.height / 2 };
    }

    // ===== SPAWN =====
    function startSpawnWarning(type) {
        const pos = findSpawnPos();
        spawnUyarilar.push({ x: pos.x, y: pos.y, timer: SPAWN_WARN, type });
    }

    function spawnHavan(x, y) {
        havanBot = {
            x, y, radius: HAVAN_RADIUS,
            hp: HAVAN_HP, maxHp: HAVAN_HP,
            angle: 0, isDead: false,
            color: '#7f1d1d', type: 'havan'
        };
        havanShootTimer = 0; havanMuzzleFlash = 0;
        spawnParticles(x, y, '#7f1d1d', 'smoke');
        explosions.push({ x, y, radius: 10, maxRadius: 80, life: 15, maxLife: 15 });
    }

    function spawnTirasi(x, y) {
        tirasiBot = {
            x, y, radius: TIRASI_RADIUS,
            hp: TIRASI_HP, maxHp: TIRASI_HP,
            speed: TIRASI_SPEED, angle: 0,
            isDead: false, color: '#8e44ad',
            insaatSure: -1, ilkInsa: true, lastShot: 0,
            type: 'tirasi'
        };
        spawnParticles(x, y, '#8e44ad', 'smoke');
    }

    function spawnCavus(x, y) {
        cavusBot = {
            x, y, radius: CAVUS_RADIUS,
            hp: CAVUS_HP, maxHp: CAVUS_HP, shield: 0,
            speed: CAVUS_SPEED, angle: 0,
            isDead: false, color: '#b8860b',
            lastShot: 0, type: 'cavus'
        };
        cavusShootTimer = 0; cavusAuraTimer = 0;
        cavusAuraCooldown = 0; cavusAuraActive = false; cavusAuraTick = 0;
        spawnParticles(x, y, '#b8860b', 'smoke');
        explosions.push({ x, y, radius: 10, maxRadius: 80, life: 15, maxLife: 15 });

        // 3 ciritçi de spawn et
        for (let i = 0; i < 3; i++) {
            const ang = (i / 3) * Math.PI * 2;
            const cx = x + Math.cos(ang) * 60;
            const cy = y + Math.sin(ang) * 60;
            ciritciBotlari.push({
                x: cx, y: cy, radius: CIRITCI_RADIUS,
                hp: CIRITCI_HP, maxHp: CIRITCI_HP,
                speed: CIRITCI_SPEED, angle: 0,
                isDead: false, color: '#5dade2',
                lastShot: 0, type: 'ciritci'
            });
            spawnParticles(cx, cy, '#5dade2', 'smoke');
        }
    }

    function spawnBoga(x, y) {
        bogaBot = {
            x, y, radius: BOGA_RADIUS,
            hp: BOGA_HP, maxHp: BOGA_HP,
            speed: BOGA_NORMAL_HIZ, angle: 0,
            isDead: false, color: '#5dade2',
            durum: 'takip', beklemeSure: BOGA_BEKLEME_SURE,
            sarjSure: 0, ofkeSure: 0, ofkeAci: 0,
            sonVurusZamani: 0, sersemleSure: 0,
            type: 'boga'
        };
        spawnParticles(x, y, '#5dade2', 'smoke');
        explosions.push({ x, y, radius: 10, maxRadius: 100, life: 15, maxLife: 15 });
    }

    function spawnHeykel(x, y) {
        heykeller.push({
            x, y, radius: HEYKEL_RADIUS,
            hp: HEYKEL_HP, maxHp: HEYKEL_HP,
            speed: HEYKEL_SPEED, angle: 0,
            isDead: false, color: '#85c1e9',
            pasifKayipTimer: 0, lastShot: 0,
            type: 'heykel'
        });
        spawnParticles(x, y, '#85c1e9', 'smoke');
    }

    function spawnBuzBotu(x, y) {
        buzBotlari.push({
            x, y, radius: BUZ_BOT_RADIUS,
            hp: BUZ_BOT_HP, maxHp: BUZ_BOT_HP,
            speed: BUZ_BOT_SPEED, angle: 0,
            isDead: false, color: '#2e86c1',
            vurusAnimasyon: 0, lastAttack: 0,
            type: 'buzbotu'
        });
        spawnParticles(x, y, '#2e86c1', 'smoke');
    }

    function spawnBuzSlime(x, y) {
        slimeBots.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 20,
            radius: 12, hp: 300, maxHp: 300,
            speed: 2.0, angle: Math.random() * Math.PI * 2,
            isDead: false, color: '#aed6f1',
            kbX: 0, kbY: 0, stage: 2,
            bombaBulasti: false, bombaSayaci: 0,
            ghostRingDebounce: 0, evolveTimer: 0
        });
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
        const allBots = [...slimeBots, ...buzBotlari, ...ciritciBotlari].filter(b => b && !b.isDead);
        allBots.forEach(b => {
            if (!b._rageActive) {
                b._rageActive = true;
                b._rageOrigSpeed = b.speed;
                b.speed = b._rageOrigSpeed * 3;
            }
        });
        rageActive = true; rageTimer = 180;
        screenShake = 15;
        rawDamageText(player.x, player.y - 40, "ÖFKE!", "#ff0000");
    }

    // ===== MODE =====
    window.GAME_EXT.registerMode(MOD_ID, {
        label: 'Ağır Sıkletler',
        onStart: function () {
            havanBot = null; havanSpawnTimer = HAVAN_INITIAL; havanShootTimer = 0; havanMuzzleFlash = 0; havanMermiler = [];
            tirasiBot = null; tirasiSpawnTimer = TIRASI_INITIAL; heykeller = [];
            cavusBot = null; cavusSpawnTimer = CAVUS_INITIAL; cavusShootTimer = 0;
            cavusAuraTimer = 0; cavusAuraCooldown = 0; cavusAuraActive = false; cavusAuraTick = 0;
            ciritciBotlari = [];
            bogaBot = null; bogaSpawnTimer = BOGA_INITIAL; buzBotlari = [];
            spawnUyarilar = []; obstacleSnapshot.clear(); botPrevHp.clear();
            rageActive = false; rageTimer = 0;

            bot.isActive = false; bot.isDead = true; bot.x = -9999; bot.y = -9999;
            bot2.isActive = false; bot2.isDead = true; bot2.x = -9999; bot2.y = -9999;
            slimeBots = []; stationaryBots = []; boomerangBots = []; fogBots = [];
            spawnIndicators = [];

            // 1 slime yuvası başlangıçta
            nests = [{
                x: canvas.width / 2, y: canvas.height / 2,
                radius: 40, color: '#27ae60', isNest: true, speed: 0,
                hp: 3000, maxHp: 3000, isDead: false, kbX: 0, kbY: 0,
                alerted: false, lastSpawn: Date.now(), spawnCount: 0,
                bombaBulasti: false, bombaSayaci: 0
            }];

            // Buz slime için spawnSlimeBot rengini değiştir
            if (!window._origSpawnSlime) {
                window._origSpawnSlime = window.spawnSlimeBot;
                window.spawnSlimeBot = function (x, y, stage) {
                    window._origSpawnSlime(x, y, stage);
                    if (window.GAME_MODE === MOD_ID) {
                        const s = slimeBots[slimeBots.length - 1];
                        if (s) s.color = '#aed6f1';
                    }
                };
            }
        },

        onUpdate: function (ts) {
            // Base timer'ları sıfırla
            slimeTimer = 0; stationaryTimer = 0; boomerangTimer = 0; fogBotTimer = 0;
            spawnIndicators = [];
            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true; bot2.hp = 0; bot2.x = -9999; bot2.y = -9999;

            // Nest limitini 1 tut (base her 10 kill'de 1 ekliyor)
            lastNestKillCount = botsKilled;

            const safePlayerX = Number.isFinite(player.x) ? player.x : 0;
            const safePlayerY = Number.isFinite(player.y) ? player.y : 0;

            // ===== ÖFKE TIMER =====
            if (rageActive) {
                rageTimer -= ts;
                if (rageTimer <= 0) {
                    rageActive = false;
                    [...slimeBots, ...buzBotlari, ...ciritciBotlari].forEach(b => {
                        if (b._rageActive) { b.speed = b._rageOrigSpeed; b._rageActive = false; }
                    });
                }
            }

            // ===== SİPER YIKIMI → SLIME =====
            const currentAll = new Set(obstacles.concat(cactusWalls || []));
            const toDelete = [];
            obstacleSnapshot.forEach((info, obs) => {
                if (!currentAll.has(obs)) {
                    spawnBuzSlime(info.x, info.y);
                    spawnBuzSlime(info.x, info.y);
                    toDelete.push(obs);
                }
            });
            toDelete.forEach(obs => obstacleSnapshot.delete(obs));
            currentAll.forEach(obs => obstacleSnapshot.set(obs, { x: obs.x, y: obs.y }));

            // ===== ÇAVUŞ HASAR YÖNLENDİRME =====
            const redirectBots = [...slimeBots, ...buzBotlari, ...ciritciBotlari].filter(b => b && !b.isDead);
            redirectBots.forEach(b => {
                if (botPrevHp.has(b)) {
                    const prev = botPrevHp.get(b);
                    if (b.hp < prev && cavusBot && !cavusBot.isDead && cavusAuraActive && getDist(b, cavusBot) < CAVUS_AURA_RADIUS) {
                        let dmg = prev - b.hp;
                        let transfer = dmg * CAVUS_DMG_REDIRECT;
                        b.hp += transfer;
                        heavyBotHasarAl(cavusBot, transfer);
                    }
                }
                botPrevHp.set(b, b.hp);
            });
            botPrevHp.forEach((v, k) => { if (!k || k.isDead || !redirectBots.includes(k)) botPrevHp.delete(k); });

            // ===== SPAWN UYARILARI =====
            for (let i = spawnUyarilar.length - 1; i >= 0; i--) {
                const u = spawnUyarilar[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    if (u.type === 'havan' && !havanBot) spawnHavan(u.x, u.y);
                    else if (u.type === 'tirasi' && !tirasiBot) spawnTirasi(u.x, u.y);
                    else if (u.type === 'cavus' && !cavusBot) spawnCavus(u.x, u.y);
                    else if (u.type === 'boga' && !bogaBot) spawnBoga(u.x, u.y);
                    spawnUyarilar.splice(i, 1);
                }
            }

            // ===== HAVAN SPAWN =====
            if (!havanBot && havanSpawnTimer > 0) {
                havanSpawnTimer -= ts;
                if (havanSpawnTimer <= 0) { startSpawnWarning('havan'); havanSpawnTimer = 999999; }
            }
            if (!havanBot && havanSpawnTimer === 999999) { /* waiting for warning to complete */ }
            if (havanBot && havanBot.hp <= 0) {
                havanBot.isDead = true; spawnParticles(havanBot.x, havanBot.y, havanBot.color, 'smoke');
                triggerBotKill(havanBot.x, havanBot);
                havanBot = null; havanSpawnTimer = HAVAN_RESPAWN;
            }

            // ===== TIRASI SPAWN =====
            if (!tirasiBot && tirasiSpawnTimer > 0) {
                tirasiSpawnTimer -= ts;
                if (tirasiSpawnTimer <= 0) { startSpawnWarning('tirasi'); tirasiSpawnTimer = 999999; }
            }
            if (tirasiBot && tirasiBot.hp <= 0) {
                tirasiBot.isDead = true; spawnParticles(tirasiBot.x, tirasiBot.y, tirasiBot.color, 'smoke');
                triggerBotKill(tirasiBot.x, tirasiBot);
                tirasiBot = null; tirasiSpawnTimer = TIRASI_RESPAWN;
            }

            // ===== ÇAVUŞ SPAWN =====
            if (!cavusBot && cavusSpawnTimer > 0) {
                cavusSpawnTimer -= ts;
                if (cavusSpawnTimer <= 0) { startSpawnWarning('cavus'); cavusSpawnTimer = 999999; }
            }
            if (cavusBot && cavusBot.hp <= 0) {
                cavusBot.isDead = true; spawnParticles(cavusBot.x, cavusBot.y, cavusBot.color, 'smoke');
                triggerBotKill(cavusBot.x, cavusBot);
                triggerRage();
                cavusBot = null; cavusSpawnTimer = CAVUS_RESPAWN;
            }

            // ===== BOĞA SPAWN =====
            if (!bogaBot && bogaSpawnTimer > 0) {
                bogaSpawnTimer -= ts;
                if (bogaSpawnTimer <= 0) { startSpawnWarning('boga'); bogaSpawnTimer = 999999; }
            }
            if (bogaBot && bogaBot.hp <= 0) {
                bogaBot.isDead = true; spawnParticles(bogaBot.x, bogaBot.y, '#5dade2', 'smoke');
                triggerBotKill(bogaBot.x, bogaBot);
                spawnBuzBotu(bogaBot.x, bogaBot.y);
                addFloatingNumber(bogaBot.x, bogaBot.y - 30, "BUZ BOTU!", "#2e86c1");
                bogaBot = null; bogaSpawnTimer = BOGA_RESPAWN;
            }

            // ===== HAVAN UPDATE =====
            if (havanBot && !havanBot.isDead) {
                havanShootTimer += ts;
                if (havanMuzzleFlash > 0) havanMuzzleFlash -= ts;
                if (havanShootTimer >= HAVAN_SHOOT_INTERVAL && !player.isDead) {
                    havanShootTimer = 0;
                    havanMermiler.push({
                        x: player.x, y: player.y,
                        startX: havanBot.x, startY: havanBot.y,
                        flightTimer: HAVAN_MERMI_FLIGHT, maxFlight: HAVAN_MERMI_FLIGHT,
                        isDead: false
                    });
                    havanMuzzleFlash = 15;
                }
            }

            // Havan mermileri
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
                    for (const o of obstacles) if (getDist(m, o) < HAVAN_MERMI_AOE + o.radius) o.hp -= HAVAN_SIPER_HASAR;
                    m.isDead = true;
                }
            }

            // ===== TIRASI UPDATE =====
            if (tirasiBot && !tirasiBot.isDead) {
                const canSee = !player.isDead && !player.isInvisible;
                if (tirasiBot.insaatSure === -1 && heykeller.length === 0 && canSee) {
                    tirasiBot.insaatSure = TIRASI_INSAA_SURESI;
                    tirasiBot.ilkInsa = false;
                }
                if (tirasiBot.insaatSure > 0) {
                    tirasiBot.insaatSure -= ts;
                    if (Math.random() < 0.2) spawnParticles(tirasiBot.x + (Math.random() - 0.5) * 15, tirasiBot.y + (Math.random() - 0.5) * 15, '#aed6f1', 'smoke');
                    if (tirasiBot.insaatSure <= 0) {
                        spawnHeykel(tirasiBot.x, tirasiBot.y);
                        addFloatingNumber(tirasiBot.x, tirasiBot.y - 40, "HEYKEL!", "#85c1e9");
                        tirasiBot.insaatSure = -1;
                    }
                } else {
                    if (canSee) {
                        tirasiBot.angle = Math.atan2(safePlayerY - tirasiBot.y, safePlayerX - tirasiBot.x);
                        if (getDist(tirasiBot, player) < TIRASI_MENZIL + player.radius) {
                            if (Date.now() - tirasiBot.lastShot > 1500) {
                                tirasiBot.lastShot = Date.now();
                                botBullets.push({
                                    x: tirasiBot.x, y: tirasiBot.y, sx: tirasiBot.x, sy: tirasiBot.y,
                                    vx: Math.cos(tirasiBot.angle) * BOT_BULLET_SPEED * 0.8,
                                    vy: Math.sin(tirasiBot.angle) * BOT_BULLET_SPEED * 0.8,
                                    dmgMod: 0, type: 'stationary_bot_bullet', owner: tirasiBot,
                                    _customDmg: TIRASI_HASAR
                                });
                            }
                        }
                    }
                }
                tirasiBot.x = clampPos(tirasiBot.x, tirasiBot.radius + WALL_THICKNESS, canvas.width - tirasiBot.radius - WALL_THICKNESS);
                tirasiBot.y = clampPos(tirasiBot.y, tirasiBot.radius + WALL_THICKNESS, canvas.height - tirasiBot.radius - WALL_THICKNESS);
            }

            // ===== HEYKEL UPDATE =====
            for (let i = heykeller.length - 1; i >= 0; i--) {
                const h = heykeller[i];
                if (h.hp <= 0) {
                    h.isDead = true;
                    spawnParticles(h.x, h.y, '#85c1e9', 'smoke');
                    triggerBotKill(h.x, h);
                    heykeller.splice(i, 1);
                    continue;
                }
                h.pasifKayipTimer += ts;
                if (h.pasifKayipTimer >= HEYKEL_PASIF_KAYIP_ARALIK) {
                    h.pasifKayipTimer = 0;
                    h.hp -= HEYKEL_PASIF_CAN_KAYBI;
                    addFloatingNumber(h.x, h.y, HEYKEL_PASIF_CAN_KAYBI, "#85c1e9");
                }
                const canSee = !player.isDead && !player.isInvisible;
                if (canSee) {
                    h.angle = Math.atan2(safePlayerY - h.y, safePlayerX - h.x);
                    const dP = getDist(h, player);
                    if (dP > h.radius + player.radius + 5) {
                        h.x += Math.cos(h.angle) * h.speed * ts;
                        h.y += Math.sin(h.angle) * h.speed * ts;
                    } else if (Date.now() - h.lastShot > HEYKEL_SALDIRI_ARALIK && !player.jumpInvulnerable) {
                        h.lastShot = Date.now();
                        player.hp -= HEYKEL_SALDIRI_HASAR;
                        rawDamageText(player.x, player.y, HEYKEL_SALDIRI_HASAR, "#85c1e9");
                        player.lastHitTime = Date.now();
                    }
                }
                h.x = clampPos(h.x, h.radius + WALL_THICKNESS, canvas.width - h.radius - WALL_THICKNESS);
                h.y = clampPos(h.y, h.radius + WALL_THICKNESS, canvas.height - h.radius - WALL_THICKNESS);
                resolveObstacleCollision(h);
            }

            // ===== ÇAVUŞ UPDATE =====
            if (cavusBot && !cavusBot.isDead) {
                if (!player.isDead) {
                    cavusBot.angle = Math.atan2(safePlayerY - cavusBot.y, safePlayerX - cavusBot.x);
                    let currentSpeed = cavusAuraActive ? (CAVUS_SPEED * 2) : CAVUS_SPEED;
                    const dP = getDist(cavusBot, player);
                    if (dP > CAVUS_STOP_DIST) {
                        cavusBot.x += Math.cos(cavusBot.angle) * currentSpeed * ts;
                        cavusBot.y += Math.sin(cavusBot.angle) * currentSpeed * ts;
                        cavusBot.x = clampPos(cavusBot.x, cavusBot.radius + WALL_THICKNESS, canvas.width - cavusBot.radius - WALL_THICKNESS);
                        cavusBot.y = clampPos(cavusBot.y, cavusBot.radius + WALL_THICKNESS, canvas.height - cavusBot.radius - WALL_THICKNESS);
                        resolveObstacleCollision(cavusBot);
                    }
                }
                cavusShootTimer += ts;

                if (cavusAuraActive) {
                    cavusAuraTimer -= ts; cavusAuraTick += ts;
                    if (cavusAuraTimer <= 0) {
                        cavusAuraActive = false; cavusAuraCooldown = CAVUS_AURA_COOLDOWN; cavusBot.shield = 0;
                    } else if (cavusAuraTick >= 60) {
                        cavusAuraTick = 0;
                        cavusBot.hp = Math.min(cavusBot.maxHp, cavusBot.hp + CAVUS_HEAL_PER_TICK);
                        rawDamageText(cavusBot.x, cavusBot.y - 20, "+" + CAVUS_HEAL_PER_TICK, "#2ecc71");
                        [...slimeBots, ...buzBotlari, ...ciritciBotlari].forEach(b => {
                            if (b && !b.isDead && getDist(b, cavusBot) < CAVUS_AURA_RADIUS) {
                                b.hp = Math.min(b.maxHp, b.hp + CAVUS_HEAL_BOTS);
                            }
                        });
                    }
                } else {
                    if (cavusAuraCooldown > 0) cavusAuraCooldown -= ts;
                    else {
                        cavusAuraActive = true; cavusAuraTimer = CAVUS_AURA_DURATION;
                        cavusBot.shield = 500; cavusAuraTick = 0;
                        rawDamageText(cavusBot.x, cavusBot.y - 30, "KALKAN + AURA!", "#f1c40f");
                    }
                }

                const currentInterval = cavusAuraActive ? CAVUS_SHOOT_INTERVAL : (CAVUS_SHOOT_INTERVAL / 2);
                if (cavusShootTimer >= currentInterval && !player.isDead) {
                    cavusShootTimer = 0;
                    botBullets.push({
                        x: cavusBot.x, y: cavusBot.y, sx: cavusBot.x, sy: cavusBot.y,
                        vx: Math.cos(cavusBot.angle) * BOT_BULLET_SPEED,
                        vy: Math.sin(cavusBot.angle) * BOT_BULLET_SPEED,
                        dmgMod: 1, type: 'stationary_bot_bullet', owner: cavusBot
                    });
                }
            }

            // ===== CİRİTÇİ UPDATE =====
            for (let i = ciritciBotlari.length - 1; i >= 0; i--) {
                const c = ciritciBotlari[i];
                if (c.hp <= 0) {
                    c.isDead = true; spawnParticles(c.x, c.y, c.color, 'smoke');
                    triggerBotKill(c.x, c);
                    ciritciBotlari.splice(i, 1);
                    continue;
                }
                const canSee = !player.isDead && !player.isInvisible;
                if (canSee) {
                    c.angle = Math.atan2(safePlayerY - c.y, safePlayerX - c.x);
                    const dP = getDist(c, player);
                    if (dP > CIRITCI_SHOOT_RANGE) {
                        c.x += Math.cos(c.angle) * c.speed * ts;
                        c.y += Math.sin(c.angle) * c.speed * ts;
                    } else if (dP < 150) {
                        c.x -= Math.cos(c.angle) * c.speed * ts;
                        c.y -= Math.sin(c.angle) * c.speed * ts;
                    }
                    if (dP < CIRITCI_SHOOT_RANGE && Date.now() - c.lastShot > CIRITCI_SHOOT_INTERVAL) {
                        c.lastShot = Date.now();
                        botBullets.push({
                            x: c.x, y: c.y, sx: c.x, sy: c.y,
                            vx: Math.cos(c.angle) * CIRITCI_MERMI_HIZ,
                            vy: Math.sin(c.angle) * CIRITCI_MERMI_HIZ,
                            dmgMod: 0, type: 'stationary_bot_bullet', owner: c,
                            _customDmg: CIRITCI_DAMAGE
                        });
                    }
                }
                c.x = clampPos(c.x, c.radius + WALL_THICKNESS, canvas.width - c.radius - WALL_THICKNESS);
                c.y = clampPos(c.y, c.radius + WALL_THICKNESS, canvas.height - c.radius - WALL_THICKNESS);
                resolveObstacleCollision(c);
            }

            // ===== BOĞA UPDATE =====
            if (bogaBot && !bogaBot.isDead) {
                const canSee = !player.isDead && !player.isInvisible;
                if (bogaBot.durum === 'takip') {
                    if (canSee) {
                        bogaBot.angle = Math.atan2(safePlayerY - bogaBot.y, safePlayerX - bogaBot.x);
                        const dP = getDist(bogaBot, player);
                        if (dP > 60) {
                            bogaBot.x += Math.cos(bogaBot.angle) * bogaBot.speed * ts;
                            bogaBot.y += Math.sin(bogaBot.angle) * bogaBot.speed * ts;
                        }
                    }
                    bogaBot.beklemeSure -= ts;
                    if (bogaBot.beklemeSure <= 0) {
                        bogaBot.durum = 'sarj';
                        bogaBot.sarjSure = BOGA_SARJ_SURE;
                    }
                } else if (bogaBot.durum === 'sarj') {
                    bogaBot.sarjSure -= ts;
                    if (canSee) bogaBot.angle = Math.atan2(safePlayerY - bogaBot.y, safePlayerX - bogaBot.x);
                    if (Math.random() < 0.3) spawnParticles(bogaBot.x + (Math.random() - 0.5) * 20, bogaBot.y + (Math.random() - 0.5) * 20, '#5dade2', 'smoke');
                    if (bogaBot.sarjSure <= 0) {
                        bogaBot.durum = 'ofke';
                        bogaBot.ofkeSure = BOGA_OFKE_SURE;
                        bogaBot.ofkeAci = canSee ? Math.atan2(safePlayerY - bogaBot.y, safePlayerX - bogaBot.x) : bogaBot.angle;
                    }
                } else if (bogaBot.durum === 'ofke') {
                    bogaBot.ofkeSure -= ts;
                    bogaBot.x += Math.cos(bogaBot.ofkeAci) * BOGA_KOSMA_HIZ * ts;
                    bogaBot.y += Math.sin(bogaBot.ofkeAci) * BOGA_KOSMA_HIZ * ts;
                    bogaBot.angle = bogaBot.ofkeAci;

                    // Siper yık
                    for (let j = obstacles.length - 1; j >= 0; j--) {
                        const o = obstacles[j];
                        if (getDist(bogaBot, o) < bogaBot.radius + o.radius) {
                            o.hp = 0;
                            addFloatingNumber(o.x, o.y, "SİPER YIKILDI!", "#e74c3c");
                        }
                    }

                    if (bogaBot.x < WALL_THICKNESS + bogaBot.radius || bogaBot.x > canvas.width - WALL_THICKNESS - bogaBot.radius ||
                        bogaBot.y < WALL_THICKNESS + bogaBot.radius || bogaBot.y > canvas.height - WALL_THICKNESS - bogaBot.radius) {
                        bogaBot.x = clampPos(bogaBot.x, bogaBot.radius + WALL_THICKNESS, canvas.width - bogaBot.radius - WALL_THICKNESS);
                        bogaBot.y = clampPos(bogaBot.y, bogaBot.radius + WALL_THICKNESS, canvas.height - bogaBot.radius - WALL_THICKNESS);
                        bogaBot.durum = 'sersemleme';
                        bogaBot.sersemleSure = BOGA_SERSEMLE_SURE;
                        bogaBot.speed = BOGA_NORMAL_HIZ;
                    }

                    if (!player.isDead && !player.jumpInvulnerable && getDist(bogaBot, player) < bogaBot.radius + player.radius) {
                        const simdi = Date.now();
                        if (simdi - bogaBot.sonVurusZamani >= 3000) {
                            bogaBot.sonVurusZamani = simdi;
                            player.hp -= BOGA_TEMAS_HASAR;
                            rawDamageText(player.x, player.y, BOGA_TEMAS_HASAR, "#e74c3c");
                            player.lastHitTime = Date.now();
                        }
                        const itmeAci = getAngle(bogaBot, player);
                        player.x += Math.cos(itmeAci) * BOGA_ITME_MESAFE;
                        player.y += Math.sin(itmeAci) * BOGA_ITME_MESAFE;
                        player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
                        player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
                    }

                    if (bogaBot.ofkeSure <= 0) {
                        bogaBot.durum = 'sersemleme';
                        bogaBot.sersemleSure = Math.floor(BOGA_SERSEMLE_SURE / 2);
                        bogaBot.speed = BOGA_NORMAL_HIZ;
                    }
                } else if (bogaBot.durum === 'sersemleme') {
                    bogaBot.sersemleSure -= ts;
                    if (bogaBot.sersemleSure <= 0) {
                        bogaBot.durum = 'takip';
                        bogaBot.beklemeSure = BOGA_BEKLEME_SURE;
                    }
                }
                bogaBot.x = clampPos(bogaBot.x, bogaBot.radius + WALL_THICKNESS, canvas.width - bogaBot.radius - WALL_THICKNESS);
                bogaBot.y = clampPos(bogaBot.y, bogaBot.radius + WALL_THICKNESS, canvas.height - bogaBot.radius - WALL_THICKNESS);
                resolveObstacleCollision(bogaBot);
            }

            // ===== BUZ BOTU UPDATE =====
            for (let i = buzBotlari.length - 1; i >= 0; i--) {
                const b = buzBotlari[i];
                if (b.hp <= 0) {
                    b.isDead = true;
                    if (!player.isDead && getDist(b, player) < BUZ_BOT_PATLAMA_YARICAP + player.radius) {
                        player.hp -= BUZ_BOT_PATLAMA_HASAR;
                        rawDamageText(player.x, player.y, BUZ_BOT_PATLAMA_HASAR, "#e74c3c");
                        player.lastHitTime = Date.now();
                    }
                    spawnParticles(b.x, b.y, '#aed6f1', 'normal');
                    triggerBotKill(b.x, b);
                    buzBotlari.splice(i, 1);
                    continue;
                }
                if (b.vurusAnimasyon > 0) b.vurusAnimasyon -= ts;
                const canSee = !player.isDead && !player.isInvisible;
                if (canSee) {
                    b.angle = Math.atan2(safePlayerY - b.y, safePlayerX - b.x);
                    const dP = getDist(b, player);
                    if (dP > b.radius + player.radius + 5) {
                        b.x += Math.cos(b.angle) * b.speed * ts;
                        b.y += Math.sin(b.angle) * b.speed * ts;
                    } else {
                        const simdi = Date.now();
                        if (simdi - b.lastAttack >= BUZ_BOT_SALDIRI_ARALIK && !player.jumpInvulnerable) {
                            b.lastAttack = simdi;
                            player.hp -= BUZ_BOT_TEMAS_HASAR;
                            rawDamageText(player.x, player.y, BUZ_BOT_TEMAS_HASAR, "#e74c3c");
                            player.lastHitTime = Date.now();
                            const itmeAci = getAngle(b, player);
                            player.x += Math.cos(itmeAci) * BUZ_BOT_ITME_MESAFE;
                            player.y += Math.sin(itmeAci) * BUZ_BOT_ITME_MESAFE;
                            player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
                            player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
                            b.vurusAnimasyon = 12;
                        }
                    }
                }
                b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                resolveObstacleCollision(b);
            }
        },

        onReset: function () {
            havanBot = null; tirasiBot = null; cavusBot = null; bogaBot = null;
            heykeller = []; ciritciBotlari = []; buzBotlari = []; havanMermiler = [];
            havanSpawnTimer = HAVAN_INITIAL; tirasiSpawnTimer = TIRASI_INITIAL;
            cavusSpawnTimer = CAVUS_INITIAL; bogaSpawnTimer = BOGA_INITIAL;
            cavusAuraActive = false; cavusAuraTick = 0; cavusAuraTimer = 0;
            spawnUyarilar = []; obstacleSnapshot.clear(); botPrevHp.clear();
            rageActive = false; rageTimer = 0;
            bot.isActive = true; bot.isDead = false; bot.hp = bot.maxHp;
            bot.x = canvas.width - 150; bot.y = 300; bot.kbX = bot.kbY = 0;
            bot2.isActive = false; bot2.isDead = true; bot2.hp = bot2.maxHp;
            bot2.respawnTimer = -9999;
            botsKilled = 0;
        }
    });

    // ===== HOOKS =====
    window.GAME_EXT.chainHook('getExtraEnemies', function () {
        if (window.GAME_MODE !== MOD_ID) return undefined;
        const liste = [];
        if (havanBot && !havanBot.isDead) liste.push(havanBot);
        if (tirasiBot && !tirasiBot.isDead) liste.push(tirasiBot);
        heykeller.forEach(h => { if (!h.isDead) liste.push(h); });
        if (cavusBot && !cavusBot.isDead) liste.push(cavusBot);
        ciritciBotlari.forEach(c => { if (!c.isDead) liste.push(c); });
        if (bogaBot && !bogaBot.isDead) liste.push(bogaBot);
        buzBotlari.forEach(b => { if (!b.isDead) liste.push(b); });
        return liste;
    });

    window.GAME_EXT.chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID || !gameStarted) return;

        // Spawn uyarıları
        spawnUyarilar.forEach(u => {
            ctx2.save(); ctx2.translate(u.x, u.y);
            ctx2.globalAlpha = 0.6 + Math.abs(Math.sin(Date.now() / 150)) * 0.4;
            const colMap = { havan: '#7f1d1d', tirasi: '#8e44ad', cavus: '#b8860b', boga: '#5dade2' };
            ctx2.beginPath(); ctx2.arc(0, 0, 35, 0, Math.PI * 2);
            ctx2.strokeStyle = colMap[u.type] || '#fff'; ctx2.lineWidth = 5; ctx2.stroke();
            ctx2.fillStyle = colMap[u.type] || '#fff';
            ctx2.font = "bold 26px Arial"; ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(u.timer / 60), 0, 9);
            ctx2.restore();
        });

        // Çavuş aurasi
        if (cavusBot && !cavusBot.isDead && cavusAuraActive) {
            ctx2.save();
            const grad = ctx2.createRadialGradient(cavusBot.x, cavusBot.y, 0, cavusBot.x, cavusBot.y, CAVUS_AURA_RADIUS);
            grad.addColorStop(0, 'rgba(255, 215, 0, 0.25)');
            grad.addColorStop(0.6, 'rgba(255, 215, 0, 0.10)');
            grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx2.beginPath(); ctx2.arc(cavusBot.x, cavusBot.y, CAVUS_AURA_RADIUS, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();
            ctx2.beginPath(); ctx2.arc(cavusBot.x, cavusBot.y, CAVUS_AURA_RADIUS, 0, Math.PI * 2);
            ctx2.strokeStyle = 'rgba(255, 215, 0, 0.9)'; ctx2.lineWidth = 4; ctx2.stroke();
            ctx2.restore();
        }

        // HAVAN
        if (havanBot && !havanBot.isDead) {
            const b = havanBot;
            ctx2.save(); ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#7f1d1d'; ctx2.fillRect(-30, -b.radius - 18, 60, 6);
            ctx2.fillStyle = '#c0392b'; ctx2.fillRect(-30, -b.radius - 18, 60 * (b.hp / b.maxHp), 6);
            ctx2.fillStyle = '#5d4037'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#3e2723'; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.fillStyle = '#8d6e63'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius - 8, 0, Math.PI * 2); ctx2.fill();
            const recoil = (havanMuzzleFlash > 0) ? (havanMuzzleFlash / 15) * 6 : 0;
            ctx2.fillStyle = '#1a0a00'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 10, 0, Math.PI * 2); ctx2.fill();
            if (havanMuzzleFlash > 0) {
                ctx2.globalAlpha = havanMuzzleFlash / 15;
                ctx2.fillStyle = '#ff5500'; ctx2.beginPath(); ctx2.arc(0, -4 + recoil, 16, 0, Math.PI * 2); ctx2.fill();
                ctx2.globalAlpha = 1;
            }
            ctx2.restore();
        }

        // TIRASI
        if (tirasiBot && !tirasiBot.isDead) {
            const b = tirasiBot;
            ctx2.save(); ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-18, -b.radius - 15, 36, 5);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-18, -b.radius - 15, 36 * (b.hp / b.maxHp), 5);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#8e44ad'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.fillStyle = '#85c1e9'; ctx2.fillRect(18, -4, 4, 8);
            ctx2.restore();
            if (b.insaatSure > 0) {
                ctx2.save(); ctx2.translate(b.x, b.y);
                const ilerleme = 1 - (b.insaatSure / TIRASI_INSAA_SURESI);
                ctx2.fillStyle = 'rgba(0,0,0,0.5)'; ctx2.fillRect(-20, -b.radius - 30, 40, 6);
                ctx2.fillStyle = '#85c1e9'; ctx2.fillRect(-20, -b.radius - 30, 40 * ilerleme, 6);
                ctx2.restore();
            }
        }

        // HEYKELLER
        heykeller.forEach(h => {
            if (h.isDead) return;
            ctx2.save(); ctx2.translate(h.x, h.y);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-30, -h.radius - 15, 60, 5);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-30, -h.radius - 15, 60 * (h.hp / h.maxHp), 5);
            ctx2.rotate(h.angle);
            ctx2.fillStyle = '#85c1e9';
            ctx2.beginPath();
            ctx2.moveTo(h.radius, 0); ctx2.lineTo(h.radius * 0.4, -h.radius);
            ctx2.lineTo(-h.radius * 0.8, -h.radius * 0.7); ctx2.lineTo(-h.radius * 0.8, h.radius * 0.7);
            ctx2.lineTo(h.radius * 0.4, h.radius); ctx2.closePath(); ctx2.fill();
            ctx2.strokeStyle = '#5dade2'; ctx2.lineWidth = 4; ctx2.stroke();
            const hasarOrani = 1 - (h.hp / h.maxHp);
            if (hasarOrani > 0.3) {
                ctx2.strokeStyle = `rgba(255,255,255,${Math.min(0.8, hasarOrani)})`;
                ctx2.lineWidth = 2;
                ctx2.beginPath(); ctx2.moveTo(5, 0); ctx2.lineTo(15, 10); ctx2.stroke();
            }
            ctx2.restore();
        });

        // ÇAVUŞ
        if (cavusBot && !cavusBot.isDead) {
            const b = cavusBot;
            ctx2.save(); ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-30, -b.radius - 18, 60, 6);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-30, -b.radius - 18, 60 * (b.hp / b.maxHp), 6);
            if (b.shield > 0) {
                ctx2.strokeStyle = '#00ffff'; ctx2.lineWidth = 4;
                ctx2.globalAlpha = 0.8; ctx2.beginPath(); ctx2.arc(0, 0, b.radius + 6, 0, Math.PI * 2); ctx2.stroke();
                ctx2.globalAlpha = 0.3; ctx2.fillStyle = '#00ffff'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius + 6, 0, Math.PI * 2); ctx2.fill();
                ctx2.globalAlpha = 1;
            }
            ctx2.rotate(b.angle);
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
            ctx2.fillStyle = '#2c3e50'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.75, 0, Math.PI * 2); ctx2.fill();
            ctx2.fillStyle = '#f1c40f'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius * 0.4, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        }

        // CİRİTÇİLER
        ciritciBotlari.forEach(c => {
            if (c.isDead) return;
            ctx2.save(); ctx2.translate(c.x, c.y);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-20, -c.radius - 15, 40, 5);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-20, -c.radius - 15, 40 * (c.hp / c.maxHp), 5);
            ctx2.rotate(c.angle);
            ctx2.fillStyle = '#5dade2'; ctx2.beginPath(); ctx2.arc(0, 0, c.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#2e86c1'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.fillStyle = '#fff'; ctx2.fillRect(12, -2.5, 22, 5);
            ctx2.restore();
        });

        // BOĞA
        if (bogaBot && !bogaBot.isDead) {
            const b = bogaBot;
            ctx2.save(); ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-25, -b.radius - 15, 50, 5);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-25, -b.radius - 15, 50 * (b.hp / b.maxHp), 5);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#5dade2'; ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#2e86c1'; ctx2.lineWidth = 3; ctx2.stroke();
            // Boynuzlar
            ctx2.fillStyle = '#85c1e9';
            ctx2.beginPath(); ctx2.moveTo(8, -14); ctx2.quadraticCurveTo(15, -25, 20, -28); ctx2.lineTo(16, -14); ctx2.closePath(); ctx2.fill();
            ctx2.beginPath(); ctx2.moveTo(8, 14); ctx2.quadraticCurveTo(15, 25, 20, 28); ctx2.lineTo(16, 14); ctx2.closePath(); ctx2.fill();
            if (b.durum === 'sarj') {
                ctx2.rotate(-b.angle);
                const ilerleme = 1 - (b.sarjSure / BOGA_SARJ_SURE);
                ctx2.strokeStyle = `rgba(255, 107, 53, ${0.5 + ilerleme * 0.5})`;
                ctx2.lineWidth = 3;
                ctx2.beginPath(); ctx2.arc(0, 0, b.radius + 8, -Math.PI / 2, -Math.PI / 2 + ilerleme * Math.PI * 2);
                ctx2.stroke();
            }
            if (b.durum === 'sersemleme') {
                ctx2.rotate(-b.angle);
                for (let k = 0; k < 3; k++) {
                    const yildizAci = Date.now() / 150 + (k * Math.PI * 2) / 3;
                    const yd = 22 + Math.sin(Date.now() / 100 + k) * 4;
                    ctx2.fillStyle = '#f1c40f'; ctx2.font = "bold 12px Arial"; ctx2.textAlign = "center";
                    ctx2.fillText("★", Math.cos(yildizAci) * yd, Math.sin(yildizAci) * yd - 15);
                }
            }
            ctx2.restore();
        }

        // BUZ BOTLARI
        buzBotlari.forEach(b => {
            if (b.isDead) return;
            ctx2.save(); ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-25, -b.radius - 15, 50, 5);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-25, -b.radius - 15, 50 * (b.hp / b.maxHp), 5);
            if (b.vurusAnimasyon > 0) {
                const animOrani = b.vurusAnimasyon / 12;
                ctx2.strokeStyle = `rgba(174, 214, 241, ${animOrani})`;
                ctx2.lineWidth = 3;
                for (let k = 0; k < 4; k++) {
                    const ang = Math.random() * Math.PI * 2;
                    const dist = b.radius + animOrani * 15;
                    ctx2.beginPath();
                    ctx2.moveTo(Math.cos(ang) * b.radius * 0.5, Math.sin(ang) * b.radius * 0.5);
                    ctx2.lineTo(Math.cos(ang) * dist, Math.sin(ang) * dist);
                    ctx2.stroke();
                }
            }
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#2e86c1';
            ctx2.beginPath();
            ctx2.moveTo(b.radius, 0); ctx2.lineTo(b.radius * 0.4, -b.radius);
            ctx2.lineTo(-b.radius * 0.8, -b.radius * 0.7); ctx2.lineTo(-b.radius * 0.8, b.radius * 0.7);
            ctx2.lineTo(b.radius * 0.4, b.radius); ctx2.closePath(); ctx2.fill();
            ctx2.strokeStyle = '#1a5276'; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.restore();
        });

        // HAVAN MERMİLERİ
        havanMermiler.forEach(m => {
            if (m.isDead) return;
            const prog = 1 - (m.flightTimer / m.maxFlight);
            ctx2.save();
            ctx2.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
            ctx2.beginPath(); ctx2.arc(m.x, m.y, HAVAN_MERMI_AOE, 0, Math.PI * 2);
            ctx2.strokeStyle = '#c0392b'; ctx2.lineWidth = 3; ctx2.setLineDash([8, 6]); ctx2.stroke(); ctx2.setLineDash([]);
            ctx2.restore();
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

        // Öfke buharı
        if (rageActive) {
            const rageBots = [...slimeBots, ...buzBotlari, ...ciritciBotlari].filter(b => b && !b.isDead && b._rageActive);
            rageBots.forEach(b => {
                ctx2.save();
                ctx2.globalAlpha = 0.4 + Math.sin(Date.now() / 100) * 0.1;
                const grad = ctx2.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 2.5);
                grad.addColorStop(0, 'rgba(255, 0, 0, 0.6)');
                grad.addColorStop(1, 'rgba(150, 0, 0, 0)');
                ctx2.beginPath(); ctx2.arc(b.x, b.y, b.radius * 2.5, 0, Math.PI * 2);
                ctx2.fillStyle = grad; ctx2.fill();
                ctx2.restore();
            });
        }

        // Slime kaskları
        slimeBots.forEach(s => {
            if (s.isDead) return;
            ctx2.save(); ctx2.translate(s.x, s.y);
            ctx2.fillStyle = '#7f8c8d';
            ctx2.beginPath(); ctx2.arc(0, 0, s.radius * 0.65, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        });
    });

    // Arena dönüşü
    (function () {
        const n = document.getElementById('diff-normal');
        const e = document.getElementById('diff-easy');
        if (n) { n.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); n.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
        if (e) { e.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); e.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
    })();

    window.GAME_EXT.modKartiEkle('agirsikletler', 'Ağır Sıkletler', 'Hardcore: Havan + Tıraşı/Heykel + Çavuş + Boğa');
    console.log('[MOD YÜKLENDİ] agirsikletler');
})();