// ========== mod7.js (BUZUL ÇAĞI) - TAM SÜRÜM, YENİ MİMARİ ==========
// registerMode ve chainHook kullanır, global fonksiyonları ezmez.
// Spike ulti düzeltmesi ayrı spike_fix.js'te olmalıdır.

(function () {
    'use strict';

    const MOD_ID = 'buzul';

    // ========== Buz Slime ==========
    const SLIME_HP =300;
    const SLIME_SPEED = 2.0;
    const SLIME_RADIUS = 12;
    const SLIME_DAMAGE = 100;

    // ========== Orta Buz Slime ==========
    const ORTA_SLIME_HP = 600;
    const ORTA_SLIME_SPEED = 1.8;
    const ORTA_SLIME_RADIUS = 18;
    const ORTA_SLIME_DAMAGE = 100;
    const ORTA_SLIME_MENZIL = 220;
    const ORTA_SLIME_ATIS_INTERVAL = 1500;
    const ORTA_SLIME_MAX_MERMI = 3;

    // ========== Büyük Buz Slime ==========
    const BUYUK_SLIME_HP = 900;
    const BUYUK_SLIME_SPEED = 1.8;
    const BUYUK_SLIME_RADIUS = 25;
    const BUYUK_SLIME_DAMAGE = 500;

    // ========== Buz Botu ==========
    const BUZ_BOT_HP = 4000;
    const BUZ_BOT_SPEED = 0.9;
    const BUZ_BOT_RADIUS = 22;
    const BUZ_BOT_TEMAS_HASAR = 450;
    const BUZ_BOT_ITME_MESAFE = 40;
    const BUZ_BOT_PATLAMA_YARICAP = 68;
    const BUZ_BOT_PATLAMA_HASAR = 150;
    const BUZ_BOT_SPAWN_INTERVAL = 900;
    const BUZ_BOT_SPAWN_WARN = 180;
    const BUZ_BOT_SALDIRI_ARALIK = 1800;
    const BUZ_BOT_VURUS_ANIM = 12;

    // ========== Buz Ciritçisi ==========
    const CIRITCI_HP = 2000;
    const CIRITCI_SPEED = 0.8;
    const CIRITCI_RADIUS = 18;
    const CIRITCI_SHOOT_RANGE = 220;
    const CIRITCI_SHOOT_INTERVAL = 1200;
    const CIRITCI_DAMAGE = 450;
    const CIRITCI_RESPAWN_TIME = 300;
    const CIRITCI_SPAWN_WARN = 90;
    const CIRITCI_MERMI_HIZ = BOT_BULLET_SPEED * 1.16;

    // ========== Heykel Tıraşı ==========
    const HEYKEL_TIRASI_HP = 1300;
    const HEYKEL_TIRASI_SPEED = 0.5;
    const HEYKEL_TIRASI_RADIUS = 18;
    const HEYKEL_TIRASI_MENZIL = 140;
    const HEYKEL_TIRASI_HASAR = 150;
    const HEYKEL_TIRASI_SPAWN_INTERVAL = 1400;
    const HEYKEL_TIRASI_SPAWN_WARN = 90;
    const HEYKEL_INSAA_SURESI = 280;
    const HEYKEL_ILK_INSAA_SURESI = 220;

    // ========== Heykel ==========
    const HEYKEL_HP = 9500;
    const HEYKEL_SPEED = 0.6;
    const HEYKEL_RADIUS = 30;
    const HEYKEL_SALDIRI_HASAR = 30;
    const HEYKEL_ITME_MESAFE = 25;
    const HEYKEL_SALDIRI_MENZIL = 25;
    const HEYKEL_SALDIRI_ARALIK = 90;
    const HEYKEL_PASIF_CAN_KAYBI = 200;
    const HEYKEL_PASIF_KAYIP_ARALIK = 180;
    const HEYKEL_IYILESTIRME = 100;

    // ========== Buz Boğası ==========
    const BOGA_HP = 10000;
    const BOGA_NORMAL_HIZ = 0.5;
    const BOGA_KOSMA_HIZ = 10.8;
    const BOGA_BEKLEME_SURE = 80;
    const BOGA_SARJ_SURE = 80;
    const BOGA_OFKE_SURE = 90;
    const BOGA_TEMAS_HASAR = 700;
    const BOGA_ITME_MESAFE = 25;
    const BOGA_SERSEMLE_SURE = 60;
    const BOGA_SPAWN_INTERVAL = 2300;
    const BOGA_SPAWN_WARN = 480;

    // ========== Değişkenler ==========
    let buzSlimeLari = [];
    let ortaBuzSlimeLari = [];
    let buyukBuzSlimeLari = [];
    let buzBotlari = [];
    let ciritciBotlari = [];
    let heykelTirasiBotlari = [];
    let heykeller = [];
    let buzBogalari = [];
    let buzBotSpawnTimer = 0;
    let buzBotSpawnUyarilari = [];
    let ciritciRespawnTimer = -1;
    let ciritciSpawnUyarilari = [];
    let heykelTirasiSpawnTimer = 0;
    let heykelTirasiSpawnUyarilari = [];
    let bogaSpawnTimer = 0;
    let bogaSpawnUyarilari = [];
    let sonTemasZamani = {};

    // ========== MOD KAYDI ==========
    window.GAME_EXT.registerMode(MOD_ID, {
        label: 'Buzul Çağı',
        onStart: function () {
            buzSlimeLari = [];
            ortaBuzSlimeLari = [];
            buyukBuzSlimeLari = [];
            buzBotlari = [];
            ciritciBotlari = [];
            heykelTirasiBotlari = [];
            heykeller = [];
            buzBogalari = [];
            buzBotSpawnTimer = 0;
            buzBotSpawnUyarilari = [];
            ciritciRespawnTimer = -1;
            ciritciSpawnUyarilari = [];
            heykelTirasiSpawnTimer = 0;
            heykelTirasiSpawnUyarilari = [];
            bogaSpawnTimer = 0;
            bogaSpawnUyarilari = [];
            sonTemasZamani = {};

            bot.isActive = false;
            bot.isDead = true;
            bot2.isActive = false;
            bot2.isDead = true;
            slimeBots = [];
            stationaryBots = [];
            boomerangBots = [];
            fogBots = [];
            nests = [];
            spawnIndicators = [];

            const cx = canvas.width - 150;
            const cy = canvas.height / 2;
            ciritciSpawnUyarilari.push({ x: cx, y: cy, timer: CIRITCI_SPAWN_WARN });
        },

        onUpdate: function (ts) {
            slimeTimer = 0;
            stationaryTimer = 0;
            boomerangTimer = 0;
            fogBotTimer = 0;
            spawnIndicators = [];

            // ---- Yuvalar orta buz slime üretir ----
            for (let i = nests.length - 1; i >= 0; i--) {
                const n = nests[i];
                if (n.hp <= 0) {
                    n.isDead = true;
                    spawnParticles(n.x, n.y, n.color || '#27ae60');
                    triggerBotKill(n.x, n);
                    nests.splice(i, 1);
                    continue;
                }
                if (Date.now() - n.lastSpawn > 7000) {
                    n.lastSpawn = Date.now();
                    n.spawnCount++;
                    n.hp -= 200;
                    ortaBuzSlimeLari.push({
                        x: n.x,
                        y: n.y,
                        radius: ORTA_SLIME_RADIUS,
                        hp: ORTA_SLIME_HP,
                        maxHp: ORTA_SLIME_HP,
                        speed: ORTA_SLIME_SPEED,
                        baseSpeed: ORTA_SLIME_SPEED,
                        angle: Math.random() * Math.PI * 2,
                        lastShot: 0,
                        atilanMermi: 0,
                        isDead: false,
                        isActive: true,
                        color: '#aed6f1',
                        kbX: 0,
                        kbY: 0,
                        oSp: ORTA_SLIME_SPEED,
                        oR: ORTA_SLIME_RADIUS,
                        buzulBotu: true
                    });
                    addFloatingNumber(n.x, n.y - 20, "ORTA BUZ SLIME!", "#aed6f1");
                    if (n.spawnCount >= 4) n.hp = 0;
                }
            }

            // ---- Siperlerden küçük buz slime çıkarma ----
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const o = obstacles[i];
                if (o.hp <= 0) {
                    for (let k = 0; k < 2; k++) {
                        const offsetX = (Math.random() - 0.5) * 30;
                        const offsetY = (Math.random() - 0.5) * 30;
                        buzSlimeLari.push({
                            x: o.x + offsetX,
                            y: o.y + offsetY,
                            radius: SLIME_RADIUS,
                            hp: SLIME_HP,
                            maxHp: SLIME_HP,
                            speed: SLIME_SPEED,
                            baseSpeed: SLIME_SPEED,
                            angle: Math.random() * Math.PI * 2,
                            isDead: false,
                            isActive: true,
                            color: '#aed6f1',
                            kbX: 0,
                            kbY: 0,
                            oSp: SLIME_SPEED,
                            oR: SLIME_RADIUS
                        });
                    }
                    spawnParticles(o.x, o.y, '#5dade2', 'normal');
                }
            }

            // ---- Ciritçi spawn uyarıları ----
            for (let i = ciritciSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = ciritciSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    ciritciBotlari.push({
                        x: u.x,
                        y: u.y,
                        radius: CIRITCI_RADIUS,
                        hp: CIRITCI_HP,
                        maxHp: CIRITCI_HP,
                        speed: CIRITCI_SPEED,
                        baseSpeed: CIRITCI_SPEED,
                        angle: 0,
                        lastShot: 0,
                        isDead: false,
                        isActive: true,
                        color: '#5dade2',
                        kbX: 0,
                        kbY: 0,
                        oSp: CIRITCI_SPEED,
                        oR: CIRITCI_RADIUS,
                        buzulBotu: true
                    });
                    ciritciSpawnUyarilari.splice(i, 1);
                }
            }

            // ---- Ciritçi respawn ----
            if (ciritciRespawnTimer >= 0) {
                ciritciRespawnTimer -= ts;
                if (ciritciRespawnTimer <= 0) {
                    ciritciRespawnTimer = -1;
                    const x = Math.random() > 0.5 ? canvas.width - 120 : 120;
                    const y = Math.random() * (canvas.height - 240) + 120;
                    ciritciSpawnUyarilari.push({ x, y, timer: CIRITCI_SPAWN_WARN });
                }
            }

            // ---- Buz Botu spawn ----
            buzBotSpawnTimer += ts;
            if (buzBotSpawnTimer >= BUZ_BOT_SPAWN_INTERVAL) {
                buzBotSpawnTimer = 0;
                if (buzBotlari.length < 2) {
                    const x = Math.random() * (canvas.width - 200) + 100;
                    const y = Math.random() * (canvas.height - 200) + 100;
                    buzBotSpawnUyarilari.push({ x, y, timer: BUZ_BOT_SPAWN_WARN });
                }
            }

            for (let i = buzBotSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = buzBotSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    const yeniBot = {
                        x: u.x,
                        y: u.y,
                        radius: BUZ_BOT_RADIUS,
                        hp: BUZ_BOT_HP,
                        maxHp: BUZ_BOT_HP,
                        speed: BUZ_BOT_SPEED,
                        baseSpeed: BUZ_BOT_SPEED,
                        angle: 0,
                        isDead: false,
                        isActive: true,
                        color: '#2e86c1',
                        kbX: 0,
                        kbY: 0,
                        oSp: BUZ_BOT_SPEED,
                        oR: BUZ_BOT_RADIUS,
                        vurusAnimasyon: 0,
                        buzulBotu: true
                    };
                    buzBotlari.push(yeniBot);
                    sonTemasZamani[yeniBot] = 0;
                    buzBotSpawnUyarilari.splice(i, 1);
                }
            }

            // ---- Heykel Tıraşı spawn (Buz Boğası yoksa) ----
            heykelTirasiSpawnTimer += ts;
            if (heykelTirasiSpawnTimer >= HEYKEL_TIRASI_SPAWN_INTERVAL) {
                heykelTirasiSpawnTimer = 0;
                if (heykelTirasiBotlari.length < 1 && buzBogalari.length < 1) {
                    const x = Math.random() * (canvas.width - 200) + 100;
                    const y = Math.random() * (canvas.height - 200) + 100;
                    heykelTirasiSpawnUyarilari.push({ x, y, timer: HEYKEL_TIRASI_SPAWN_WARN });
                }
            }

            for (let i = heykelTirasiSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = heykelTirasiSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    heykelTirasiBotlari.push({
                        x: u.x,
                        y: u.y,
                        radius: HEYKEL_TIRASI_RADIUS,
                        hp: HEYKEL_TIRASI_HP,
                        maxHp: HEYKEL_TIRASI_HP,
                        speed: HEYKEL_TIRASI_SPEED,
                        baseSpeed: HEYKEL_TIRASI_SPEED,
                        angle: 0,
                        lastShot: 0,
                        insaatSure: -1,
                        ilkInsa: true,
                        isDead: false,
                        isActive: true,
                        color: '#8e44ad',
                        kbX: 0,
                        kbY: 0,
                        oSp: HEYKEL_TIRASI_SPEED,
                        oR: HEYKEL_TIRASI_RADIUS,
                        buzulBotu: true
                    });
                    heykelTirasiSpawnUyarilari.splice(i, 1);
                }
            }

            // ---- Buz Boğası spawn (Heykel Tıraşı yoksa) ----
            bogaSpawnTimer += ts;
            if (bogaSpawnTimer >= BOGA_SPAWN_INTERVAL) {
                bogaSpawnTimer = 0;
                if (buzBogalari.length < 1 && heykelTirasiBotlari.length < 1) {
                    const x = Math.random() * (canvas.width - 200) + 100;
                    const y = Math.random() * (canvas.height - 200) + 100;
                    bogaSpawnUyarilari.push({ x, y, timer: BOGA_SPAWN_WARN });
                }
            }

            for (let i = bogaSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = bogaSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    buzBogalari.push({
                        x: u.x,
                        y: u.y,
                        radius: 28,
                        hp: BOGA_HP,
                        maxHp: BOGA_HP,
                        speed: BOGA_NORMAL_HIZ,
                        angle: 0,
                        durum: 'takip',
                        beklemeSure: BOGA_BEKLEME_SURE,
                        sarjSure: 0,
                        ofkeSure: 0,
                        ofkeAci: 0,
                        sonVurusZamani: 0,
                        sersemleSure: 0,
                        isDead: false,
                        isActive: true,
                        color: '#5dade2',
                        kbX: 0,
                        kbY: 0,
                        oSp: BOGA_NORMAL_HIZ,
                        oR: 28,
                        buzulBotu: true
                    });
                    bogaSpawnUyarilari.splice(i, 1);
                }
            }

            // ---- Buz Boğası güncelleme ----
            for (let i = buzBogalari.length - 1; i >= 0; i--) {
                const b = buzBogalari[i];

                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, '#5dade2', 'smoke');
                    buzBotlari.push({
                        x: b.x,
                        y: b.y,
                        radius: BUZ_BOT_RADIUS,
                        hp: BUZ_BOT_HP,
                        maxHp: BUZ_BOT_HP,
                        speed: BUZ_BOT_SPEED,
                        baseSpeed: BUZ_BOT_SPEED,
                        angle: 0,
                        isDead: false,
                        isActive: true,
                        color: '#2e86c1',
                        kbX: 0,
                        kbY: 0,
                        oSp: BUZ_BOT_SPEED,
                        oR: BUZ_BOT_RADIUS,
                        vurusAnimasyon: 0,
                        buzulBotu: true
                    });
                    sonTemasZamani[buzBotlari[buzBotlari.length - 1]] = 0;
                    addFloatingNumber(b.x, b.y - 30, "BUZ BOTU ÇIKTI!", "#2e86c1");
                    triggerBotKill(b.x, b);
                }
                if (b.isDead) { buzBogalari.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;

                if (b.durum === 'takip') {
                    if (canSeePlayer) {
                        b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                        const d = getDist(b, player);
                        if (d > 60) {
                            b.x += Math.cos(b.angle) * b.speed * ts;
                            b.y += Math.sin(b.angle) * b.speed * ts;
                        }
                    }
                    b.beklemeSure -= ts;
                    if (b.beklemeSure <= 0) {
                        b.durum = 'sarj';
                        b.sarjSure = BOGA_SARJ_SURE;
                    }
                } else if (b.durum === 'sarj') {
                    b.sarjSure -= ts;
                    if (canSeePlayer) {
                        b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                    }
                    b.x += Math.cos(b.angle) * 0.3 * ts;
                    b.y += Math.sin(b.angle) * 0.3 * ts;
                    if (Math.random() < 0.3) {
                        spawnParticles(b.x + (Math.random() - 0.5) * 20, b.y + (Math.random() - 0.5) * 20, '#5dade2', 'smoke');
                    }
                    if (b.sarjSure <= 0) {
                        b.durum = 'ofke';
                        b.ofkeSure = BOGA_OFKE_SURE;
                        b.ofkeAci = canSeePlayer ? Math.atan2(player.y - b.y, player.x - b.x) : b.angle;
                    }
                } else if (b.durum === 'ofke') {
                    b.ofkeSure -= ts;
                    b.x += Math.cos(b.ofkeAci) * BOGA_KOSMA_HIZ * ts;
                    b.y += Math.sin(b.ofkeAci) * BOGA_KOSMA_HIZ * ts;
                    b.angle = b.ofkeAci;

                    for (let j = obstacles.length - 1; j >= 0; j--) {
                        const o = obstacles[j];
                        if (getDist(b, o) < b.radius + o.radius) {
                            o.hp = 0;
                            for (let k = 0; k < 2; k++) {
                                buzSlimeLari.push({
                                    x: o.x + (Math.random() - 0.5) * 30,
                                    y: o.y + (Math.random() - 0.5) * 30,
                                    radius: SLIME_RADIUS,
                                    hp: SLIME_HP,
                                    maxHp: SLIME_HP,
                                    speed: SLIME_SPEED,
                                    baseSpeed: SLIME_SPEED,
                                    angle: Math.random() * Math.PI * 2,
                                    isDead: false,
                                    isActive: true,
                                    color: '#aed6f1',
                                    kbX: 0,
                                    kbY: 0,
                                    oSp: SLIME_SPEED,
                                    oR: SLIME_RADIUS
                                });
                            }
                            spawnParticles(o.x, o.y, '#5dade2', 'normal');
                            addFloatingNumber(o.x, o.y, "SİPER YIKILDI!", "#e74c3c");
                        }
                    }
                    for (let j = cactusWalls.length - 1; j >= 0; j--) {
                        const cw = cactusWalls[j];
                        if (getDist(b, cw) < b.radius + cw.radius) {
                            cw.hp = 0;
                            for (let k = 0; k < 2; k++) {
                                buzSlimeLari.push({
                                    x: cw.x + (Math.random() - 0.5) * 30,
                                    y: cw.y + (Math.random() - 0.5) * 30,
                                    radius: SLIME_RADIUS,
                                    hp: SLIME_HP,
                                    maxHp: SLIME_HP,
                                    speed: SLIME_SPEED,
                                    baseSpeed: SLIME_SPEED,
                                    angle: Math.random() * Math.PI * 2,
                                    isDead: false,
                                    isActive: true,
                                    color: '#aed6f1',
                                    kbX: 0,
                                    kbY: 0,
                                    oSp: SLIME_SPEED,
                                    oR: SLIME_RADIUS
                                });
                            }
                            spawnParticles(cw.x, cw.y, '#2ecc71', 'normal');
                            addFloatingNumber(cw.x, cw.y, "DİKEN DUVARI YIKILDI!", "#2ecc71");
                        }
                    }

                    if (b.x < WALL_THICKNESS + b.radius || b.x > canvas.width - WALL_THICKNESS - b.radius) {
                        b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                        b.durum = 'sersemleme';
                        b.sersemleSure = BOGA_SERSEMLE_SURE;
                        b.speed = BOGA_NORMAL_HIZ;
                    }
                    if (b.y < WALL_THICKNESS + b.radius || b.y > canvas.height - WALL_THICKNESS - b.radius) {
                        b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                        b.durum = 'sersemleme';
                        b.sersemleSure = BOGA_SERSEMLE_SURE;
                        b.speed = BOGA_NORMAL_HIZ;
                    }

                    if (!player.isDead && getDist(b, player) < b.radius + player.radius) {
                        const simdi = Date.now();
                        if (simdi - b.sonVurusZamani >= 3000) {
                            b.sonVurusZamani = simdi;
                            player.hp -= BOGA_TEMAS_HASAR;
                            addFloatingNumber(player.x, player.y, BOGA_TEMAS_HASAR, "#e74c3c");
                            player.lastHitTime = Date.now();
                        }
                        const itmeAci = getAngle(b, player);
                        player.x += Math.cos(itmeAci) * BOGA_ITME_MESAFE;
                        player.y += Math.sin(itmeAci) * BOGA_ITME_MESAFE;
                        player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
                        player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
                    }

                    if (b.ofkeSure <= 0) {
                        b.durum = 'sersemleme';
                        b.sersemleSure = Math.floor(BOGA_SERSEMLE_SURE / 2);
                        b.speed = BOGA_NORMAL_HIZ;
                    }
                } else if (b.durum === 'sersemleme') {
                    b.sersemleSure -= ts;
                    if (b.sersemleSure <= 0) {
                        b.durum = 'takip';
                        b.beklemeSure = BOGA_BEKLEME_SURE;
                    }
                }

                b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                resolveObstacleCollision(b);
            }

            // ---- Heykel Tıraşı güncelleme ----
            for (let i = heykelTirasiBotlari.length - 1; i >= 0; i--) {
                const h = heykelTirasiBotlari[i];
                if (h.hp <= 0 && !h.isDead) {
                    h.isDead = true;
                    spawnParticles(h.x, h.y, '#8e44ad', 'smoke');
                    triggerBotKill(h.x, h);
                }
                if (h.isDead) { heykelTirasiBotlari.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (h.insaatSure === -1 && heykeller.length === 0 && canSeePlayer) {
                    h.insaatSure = h.ilkInsa ? HEYKEL_ILK_INSAA_SURESI : HEYKEL_INSAA_SURESI;
                    h.ilkInsa = false;
                    h.insaatX = h.x;
                    h.insaatY = h.y;
                }
                if (h.insaatSure > 0) {
                    h.insaatSure -= ts;
                    if (Math.random() < 0.2) spawnParticles(h.x + (Math.random() - 0.5) * 15, h.y + (Math.random() - 0.5) * 15, '#aed6f1', 'smoke');
                    if (h.insaatSure <= 0) {
                        heykeller.push({
                            x: h.x,
                            y: h.y,
                            radius: HEYKEL_RADIUS,
                            hp: HEYKEL_HP,
                            maxHp: HEYKEL_HP,
                            speed: HEYKEL_SPEED,
                            angle: 0,
                            isDead: false,
                            isActive: true,
                            color: '#85c1e9',
                            kbX: 0,
                            kbY: 0,
                            oSp: HEYKEL_SPEED,
                            oR: HEYKEL_RADIUS,
                            pasifKayipTimer: 0,
                            saldiriAnim: 0,
                            lastShot: 0,
                            buzulBotu: true
                        });
                        h.insaatSure = -1;
                    }
                } else {
                    if (heykeller.length > 0) {
                        const heykel = heykeller[0];
                        const d = getDist(h, heykel);
                        if (d > 50) {
                            const ang = getAngle(h, heykel);
                            h.x += Math.cos(ang) * h.speed * ts;
                            h.y += Math.sin(ang) * h.speed * ts;
                        } else {
                            heykel.hp = Math.min(heykel.maxHp, heykel.hp + HEYKEL_IYILESTIRME * ts / 60);
                        }
                    } else {
                        if (canSeePlayer) {
                            const ang = getAngle(player, h);
                            h.x += Math.cos(ang) * h.speed * ts;
                            h.y += Math.sin(ang) * h.speed * ts;
                        }
                    }
                    if (canSeePlayer && getDist(h, player) < HEYKEL_TIRASI_MENZIL + player.radius) {
                        if (Date.now() - h.lastShot > 1500) {
                            h.lastShot = Date.now();
                            botBullets.push({
                                x: h.x,
                                y: h.y,
                                sx: h.x,
                                sy: h.y,
                                vx: Math.cos(h.angle) * BOT_BULLET_SPEED * 0.8,
                                vy: Math.sin(h.angle) * BOT_BULLET_SPEED * 0.8,
                                dmgMod: 0,
                                type: 'heykel_tirasi_mermi',
                                owner: h
                            });
                        }
                    }
                }
                if (Math.abs(h.kbX) > 0.1 || Math.abs(h.kbY) > 0.1) {
                    h.x += h.kbX * ts;
                    h.y += h.kbY * ts;
                    h.kbX *= 0.85;
                    h.kbY *= 0.85;
                }
                h.x = clampPos(h.x, h.radius + WALL_THICKNESS, canvas.width - h.radius - WALL_THICKNESS);
                h.y = clampPos(h.y, h.radius + WALL_THICKNESS, canvas.height - h.radius - WALL_THICKNESS);
                resolveObstacleCollision(h);
            }

            // ---- Heykel güncelleme ----
            for (let i = heykeller.length - 1; i >= 0; i--) {
                const hey = heykeller[i];
                if (hey.hp <= 0 && !hey.isDead) {
                    hey.isDead = true;
                    spawnParticles(hey.x, hey.y, '#85c1e9', 'smoke');
                    buyukBuzSlimeLari.push({
                        x: hey.x,
                        y: hey.y,
                        radius: BUYUK_SLIME_RADIUS,
                        hp: BUYUK_SLIME_HP,
                        maxHp: BUYUK_SLIME_HP,
                        speed: BUYUK_SLIME_SPEED,
                        baseSpeed: BUYUK_SLIME_SPEED,
                        angle: Math.random() * Math.PI * 2,
                        isDead: false,
                        isActive: true,
                        color: '#aed6f1',
                        kbX: 0,
                        kbY: 0,
                        oSp: BUYUK_SLIME_SPEED,
                        oR: BUYUK_SLIME_RADIUS,
                        buzulBotu: true
                    });
                    triggerBotKill(hey.x, hey);
                }
                if (hey.isDead) { heykeller.splice(i, 1); continue; }

                hey.pasifKayipTimer += ts;
                if (hey.pasifKayipTimer >= HEYKEL_PASIF_KAYIP_ARALIK) {
                    hey.pasifKayipTimer = 0;
                    hey.hp -= HEYKEL_PASIF_CAN_KAYBI;
                    addFloatingNumber(hey.x, hey.y, HEYKEL_PASIF_CAN_KAYBI, "#85c1e9");
                }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    hey.angle = Math.atan2(player.y - hey.y, player.x - hey.x);
                    const d = getDist(hey, player);
                    if (d > HEYKEL_SALDIRI_MENZIL + hey.radius) {
                        hey.x += Math.cos(hey.angle) * hey.speed * ts;
                        hey.y += Math.sin(hey.angle) * hey.speed * ts;
                    }
                    if (d < HEYKEL_SALDIRI_MENZIL + hey.radius + player.radius) {
                        if (Date.now() - hey.lastShot > HEYKEL_SALDIRI_ARALIK) {
                            hey.lastShot = Date.now();
                            player.hp -= HEYKEL_SALDIRI_HASAR;
                            addFloatingNumber(player.x, player.y, HEYKEL_SALDIRI_HASAR, "#85c1e9");
                            player.lastHitTime = Date.now();
                            const itmeAci = getAngle(hey, player);
                            player.x += Math.cos(itmeAci) * HEYKEL_ITME_MESAFE;
                            player.y += Math.sin(itmeAci) * HEYKEL_ITME_MESAFE;
                            player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
                            player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
                        }
                    }
                }
                if (Math.abs(hey.kbX) > 0.1 || Math.abs(hey.kbY) > 0.1) {
                    hey.x += hey.kbX * ts;
                    hey.y += hey.kbY * ts;
                    hey.kbX *= 0.85;
                    hey.kbY *= 0.85;
                }
                hey.x = clampPos(hey.x, hey.radius + WALL_THICKNESS, canvas.width - hey.radius - WALL_THICKNESS);
                hey.y = clampPos(hey.y, hey.radius + WALL_THICKNESS, canvas.height - hey.radius - WALL_THICKNESS);
                resolveObstacleCollision(hey);
            }

            // ---- Büyük Buz Slime güncelleme ----
            for (let i = buyukBuzSlimeLari.length - 1; i >= 0; i--) {
                const b = buyukBuzSlimeLari[i];
                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color);
                    for (let k = 0; k < 2; k++) {
                        buzSlimeLari.push({
                            x: b.x + (Math.random() - 0.5) * 20,
                            y: b.y + (Math.random() - 0.5) * 20,
                            radius: SLIME_RADIUS,
                            hp: SLIME_HP,
                            maxHp: SLIME_HP,
                            speed: SLIME_SPEED,
                            baseSpeed: SLIME_SPEED,
                            angle: Math.random() * Math.PI * 2,
                            isDead: false,
                            isActive: true,
                            color: '#aed6f1',
                            kbX: 0,
                            kbY: 0,
                            oSp: SLIME_SPEED,
                            oR: SLIME_RADIUS
                        });
                    }
                    triggerBotKill(b.x, b);
                }
                if (b.isDead) { buyukBuzSlimeLari.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                    b.x += Math.cos(b.angle) * b.speed * ts;
                    b.y += Math.sin(b.angle) * b.speed * ts;
                }
                b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                resolveObstacleCollision(b);

                if (!player.isDead && !player.jumpInvulnerable && getDist(b, player) < b.radius + player.radius) {
                    player.hp -= BUYUK_SLIME_DAMAGE;
                    addFloatingNumber(player.x, player.y, BUYUK_SLIME_DAMAGE, "#e74c3c");
                    player.lastHitTime = Date.now();
                    b.hp = 0;
                }
            }

            // ---- Orta Buz Slime güncelleme ----
            for (let i = ortaBuzSlimeLari.length - 1; i >= 0; i--) {
                const b = ortaBuzSlimeLari[i];
                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color);
                    for (let k = 0; k < 2; k++) {
                        buzSlimeLari.push({
                            x: b.x + (Math.random() - 0.5) * 20,
                            y: b.y + (Math.random() - 0.5) * 20,
                            radius: SLIME_RADIUS,
                            hp: SLIME_HP,
                            maxHp: SLIME_HP,
                            speed: SLIME_SPEED,
                            baseSpeed: SLIME_SPEED,
                            angle: Math.random() * Math.PI * 2,
                            isDead: false,
                            isActive: true,
                            color: '#aed6f1',
                            kbX: 0,
                            kbY: 0,
                            oSp: SLIME_SPEED,
                            oR: SLIME_RADIUS
                        });
                    }
                    triggerBotKill(b.x, b);
                }
                if (b.isDead) { ortaBuzSlimeLari.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    const d = getDist(b, player);
                    b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                    if (b.atilanMermi < ORTA_SLIME_MAX_MERMI) {
                        if (d < ORTA_SLIME_MENZIL && Date.now() - b.lastShot > ORTA_SLIME_ATIS_INTERVAL) {
                            b.lastShot = Date.now();
                            b.atilanMermi++;
                            botBullets.push({
                                x: b.x,
                                y: b.y,
                                sx: b.x,
                                sy: b.y,
                                vx: Math.cos(b.angle) * BOT_BULLET_SPEED * 0.9,
                                vy: Math.sin(b.angle) * BOT_BULLET_SPEED * 0.9,
                                dmgMod: 0,
                                type: 'orta_slime_kartopu',
                                owner: b
                            });
                        }
                        if (d > 300) { b.x += Math.cos(b.angle) * b.speed * ts; b.y += Math.sin(b.angle) * b.speed * ts; }
                        else if (d < 150) { b.x -= Math.cos(b.angle) * b.speed * ts; b.y -= Math.sin(b.angle) * b.speed * ts; }
                    } else {
                        if (d > b.radius + player.radius + 5) { b.x += Math.cos(b.angle) * b.speed * ts; b.y += Math.sin(b.angle) * b.speed * ts; }
                        else {
                            if (!player.jumpInvulnerable) {
                                player.hp -= ORTA_SLIME_DAMAGE;
                                addFloatingNumber(player.x, player.y, ORTA_SLIME_DAMAGE, "#e74c3c");
                                player.lastHitTime = Date.now();
                                b.hp = 0;
                            }
                        }
                    }
                }
                if (Math.abs(b.kbX) > 0.1 || Math.abs(b.kbY) > 0.1) {
                    b.x += b.kbX * ts;
                    b.y += b.kbY * ts;
                    b.kbX *= 0.85;
                    b.kbY *= 0.85;
                }
                b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                resolveObstacleCollision(b);
            }

            // ---- Küçük Buz Slime güncelleme ----
            for (let i = buzSlimeLari.length - 1; i >= 0; i--) {
                const b = buzSlimeLari[i];
                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color);
                }
                if (b.isDead) { buzSlimeLari.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                    b.x += Math.cos(b.angle) * b.speed * ts;
                    b.y += Math.sin(b.angle) * b.speed * ts;
                }
                b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                resolveObstacleCollision(b);

                if (!player.isDead && !player.jumpInvulnerable && getDist(b, player) < b.radius + player.radius) {
                    player.hp -= SLIME_DAMAGE;
                    addFloatingNumber(player.x, player.y, SLIME_DAMAGE, "#e74c3c");
                    player.lastHitTime = Date.now();
                    b.hp = 0;
                }
            }

            // ---- Buz Ciritçisi güncelleme ----
            for (let i = ciritciBotlari.length - 1; i >= 0; i--) {
                const c = ciritciBotlari[i];
                if (c.hp <= 0 && !c.isDead) {
                    c.isDead = true;
                    spawnParticles(c.x, c.y, c.color);
                    triggerBotKill(c.x, c);
                    ciritciRespawnTimer = CIRITCI_RESPAWN_TIME;
                }
                if (c.isDead) { ciritciBotlari.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    c.angle = Math.atan2(player.y - c.y, player.x - c.x);
                    const d = getDist(c, player);
                    if (d > CIRITCI_SHOOT_RANGE) { c.x += Math.cos(c.angle) * c.speed * ts; c.y += Math.sin(c.angle) * c.speed * ts; }
                    else if (d < 150) { c.x -= Math.cos(c.angle) * c.speed * ts; c.y -= Math.sin(c.angle) * c.speed * ts; }
                    if (d < CIRITCI_SHOOT_RANGE && Date.now() - c.lastShot > CIRITCI_SHOOT_INTERVAL) {
                        c.lastShot = Date.now();
                        botBullets.push({
                            x: c.x,
                            y: c.y,
                            sx: c.x,
                            sy: c.y,
                            vx: Math.cos(c.angle) * CIRITCI_MERMI_HIZ,
                            vy: Math.sin(c.angle) * CIRITCI_MERMI_HIZ,
                            dmgMod: 1,
                            type: 'ciritci_mizrak',
                            owner: c
                        });
                    }
                }
                if (Math.abs(c.kbX) > 0.1 || Math.abs(c.kbY) > 0.1) {
                    c.x += c.kbX * ts;
                    c.y += c.kbY * ts;
                    c.kbX *= 0.85;
                    c.kbY *= 0.85;
                }
                c.x = clampPos(c.x, c.radius + WALL_THICKNESS, canvas.width - c.radius - WALL_THICKNESS);
                c.y = clampPos(c.y, c.radius + WALL_THICKNESS, canvas.height - c.radius - WALL_THICKNESS);
                resolveObstacleCollision(c);
            }

            // ---- Buz Botu güncelleme ----
            for (let i = buzBotlari.length - 1; i >= 0; i--) {
                const b = buzBotlari[i];
                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    if (!player.isDead && getDist(b, player) < BUZ_BOT_PATLAMA_YARICAP + player.radius) {
                        player.hp -= BUZ_BOT_PATLAMA_HASAR;
                        addFloatingNumber(player.x, player.y, BUZ_BOT_PATLAMA_HASAR, "#e74c3c");
                        player.lastHitTime = Date.now();
                    }
                    for (let k = 0; k < 6; k++) {
                        const ang = Math.random() * Math.PI * 2;
                        const dist = Math.random() * 20;
                        spawnParticles(b.x + Math.cos(ang) * dist, b.y + Math.sin(ang) * dist, '#aed6f1', 'normal');
                    }
                    triggerBotKill(b.x, b);
                }
                if (b.isDead) { buzBotlari.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                    const d = getDist(b, player);
                    if (d > b.radius + player.radius + 5) { b.x += Math.cos(b.angle) * b.speed * ts; b.y += Math.sin(b.angle) * b.speed * ts; }
                    else {
                        const simdi = Date.now();
                        if (simdi - sonTemasZamani[b] >= BUZ_BOT_SALDIRI_ARALIK) {
                            sonTemasZamani[b] = simdi;
                            player.hp -= BUZ_BOT_TEMAS_HASAR;
                            addFloatingNumber(player.x, player.y, BUZ_BOT_TEMAS_HASAR, "#e74c3c");
                            player.lastHitTime = Date.now();
                            const itmeAci = getAngle(b, player);
                            player.x += Math.cos(itmeAci) * BUZ_BOT_ITME_MESAFE;
                            player.y += Math.sin(itmeAci) * BUZ_BOT_ITME_MESAFE;
                            player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
                            player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
                            b.vurusAnimasyon = BUZ_BOT_VURUS_ANIM;
                        }
                    }
                }
                if (b.vurusAnimasyon > 0) b.vurusAnimasyon -= ts;
                if (Math.abs(b.kbX) > 0.1 || Math.abs(b.kbY) > 0.1) {
                    b.x += b.kbX * ts;
                    b.y += b.kbY * ts;
                    b.kbX *= 0.85;
                    b.kbY *= 0.85;
                }
                b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                resolveObstacleCollision(b);
            }
        },

        onReset: function () {
            buzSlimeLari = [];
            ortaBuzSlimeLari = [];
            buyukBuzSlimeLari = [];
            buzBotlari = [];
            ciritciBotlari = [];
            heykelTirasiBotlari = [];
            heykeller = [];
            buzBogalari = [];
            buzBotSpawnTimer = 0;
            buzBotSpawnUyarilari = [];
            ciritciRespawnTimer = -1;
            ciritciSpawnUyarilari = [];
            heykelTirasiSpawnTimer = 0;
            heykelTirasiSpawnUyarilari = [];
            bogaSpawnTimer = 0;
            bogaSpawnUyarilari = [];
            sonTemasZamani = {};
        }
    });

    // ========== BOTLARI LİSTEYE EKLE ==========
    window.GAME_EXT.chainHook('getExtraEnemies', function () {
        if (window.GAME_MODE !== MOD_ID) return undefined;
        return buzSlimeLari.concat(ortaBuzSlimeLari).concat(buyukBuzSlimeLari)
            .concat(buzBotlari).concat(ciritciBotlari).concat(heykelTirasiBotlari)
            .concat(heykeller).concat(buzBogalari).filter(b => !b.isDead);
    });

    // ========== MERMİ ÇARPIŞMA ==========
    const originalUpdateBulletLogic = window.updateBulletLogic;
    window.updateBulletLogic = function (list, isBot, ts) {
        if (isBot && window.GAME_MODE === MOD_ID) {
            for (let i = list.length - 1; i >= 0; i--) {
                const b = list[i];
                if (b.type === 'heykel_tirasi_mermi') {
                    b.x += b.vx * ts;
                    b.y += b.vy * ts;
                    const hwX = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - WALL_THICKNESS - 5;
                    const hwY = b.y < WALL_THICKNESS + 5 || b.y > canvas.height - WALL_THICKNESS - 5;
                    let hitObs = false;
                    for (const o of obstacles.concat(cactusWalls || [])) {
                        if (getDist(b, o) < o.radius + 5) {
                            o.hp -= 400;
                            addFloatingNumber(o.x, o.y, 400, "#8e44ad");
                            hitObs = true;
                            break;
                        }
                    }
                    if (hwX || hwY || hitObs || getDist(b, {x:b.sx, y:b.sy}) > HEYKEL_TIRASI_MENZIL * 2) {
                        list.splice(i, 1);
                        continue;
                    }
                    if (!player.isDead && getDist(b, player) < player.radius + 12) {
                        player.hp -= HEYKEL_TIRASI_HASAR;
                        addFloatingNumber(player.x, player.y, HEYKEL_TIRASI_HASAR, "#8e44ad");
                        player.lastHitTime = Date.now();
                        list.splice(i, 1);
                        continue;
                    }
                }
                if (b.type === 'orta_slime_kartopu') {
                    b.x += b.vx * ts;
                    b.y += b.vy * ts;
                    const hwX = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - WALL_THICKNESS - 5;
                    const hwY = b.y < WALL_THICKNESS + 5 || b.y > canvas.height - WALL_THICKNESS - 5;
                    let hitObs = false;
                    for (const o of obstacles.concat(cactusWalls || [])) {
                        if (getDist(b, o) < o.radius + 5) {
                            hitObs = true;
                            break;
                        }
                    }
                    if (hwX || hwY || hitObs || getDist(b, {x:b.sx, y:b.sy}) > ORTA_SLIME_MENZIL) {
                        list.splice(i, 1);
                        continue;
                    }
                    if (!player.isDead && getDist(b, player) < player.radius + 12) {
                        player.hp -= ORTA_SLIME_DAMAGE;
                        addFloatingNumber(player.x, player.y, ORTA_SLIME_DAMAGE, "#aed6f1");
                        player.lastHitTime = Date.now();
                        list.splice(i, 1);
                        continue;
                    }
                }
            }
        }
        originalUpdateBulletLogic(list, isBot, ts);
    };

    // ========== ÇİZİM ==========
    window.GAME_EXT.chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID || !gameStarted) return;

        // Engelleri buz rengine boya
        for (const o of obstacles) {
            ctx2.save();
            ctx2.translate(o.x, o.y);
            ctx2.fillStyle = '#5dade2';
            ctx2.beginPath();
            ctx2.roundRect(-o.radius, -o.radius, o.radius * 2, o.radius * 2, 10);
            ctx2.fill();
            ctx2.strokeStyle = '#2e86c1';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-15, -o.radius - 15, 30 * (o.hp / o.maxHp), 4);
            ctx2.restore();
        }

        // Spawn uyarıları
        buzBotSpawnUyarilari.forEach(u => {
            ctx2.save();
            ctx2.translate(u.x, u.y);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath();
            ctx2.arc(0, 0, BUZ_BOT_RADIUS + 15, 0, Math.PI * 2);
            ctx2.strokeStyle = '#2e86c1';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#2e86c1';
            ctx2.font = "bold 16px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(u.timer / 60), 0, 6);
            ctx2.restore();
        });

        ciritciSpawnUyarilari.forEach(u => {
            ctx2.save();
            ctx2.translate(u.x, u.y);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath();
            ctx2.arc(0, 0, CIRITCI_RADIUS + 12, 0, Math.PI * 2);
            ctx2.strokeStyle = '#5dade2';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#5dade2';
            ctx2.font = "bold 14px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(u.timer / 60), 0, 5);
            ctx2.restore();
        });

        heykelTirasiSpawnUyarilari.forEach(u => {
            ctx2.save();
            ctx2.translate(u.x, u.y);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath();
            ctx2.arc(0, 0, HEYKEL_TIRASI_RADIUS + 12, 0, Math.PI * 2);
            ctx2.strokeStyle = '#8e44ad';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#8e44ad';
            ctx2.font = "bold 14px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(u.timer / 60), 0, 5);
            ctx2.restore();
        });

        bogaSpawnUyarilari.forEach(u => {
            ctx2.save();
            ctx2.translate(u.x, u.y);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath();
            ctx2.arc(0, 0, 28 + 12, 0, Math.PI * 2);
            ctx2.strokeStyle = '#5dade2';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#5dade2';
            ctx2.font = "bold 14px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(u.timer / 60), 0, 5);
            ctx2.restore();
        });

        // Büyük Buz Slime
        buyukBuzSlimeLari.forEach(b => {
            if (b.isDead) return;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-20, -b.radius - 10, 40, 4);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-20, -b.radius - 10, 40 * (b.hp / b.maxHp), 4);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#aed6f1';
            ctx2.beginPath();
            ctx2.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.strokeStyle = '#5dade2';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.fillStyle = '#2e86c1';
            ctx2.beginPath();
            ctx2.arc(6, -5, 3, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.beginPath();
            ctx2.arc(6, 5, 3, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.restore();
        });

        // Orta Buz Slime
        ortaBuzSlimeLari.forEach(b => {
            if (b.isDead) return;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-15, -b.radius - 10, 30, 4);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-15, -b.radius - 10, 30 * (b.hp / b.maxHp), 4);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#aed6f1';
            ctx2.beginPath();
            ctx2.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.strokeStyle = '#5dade2';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.fillStyle = '#2e86c1';
            ctx2.beginPath();
            ctx2.arc(5, -4, 2.5, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.beginPath();
            ctx2.arc(5, 4, 2.5, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.restore();
        });

        // Küçük Buz Slime
        buzSlimeLari.forEach(b => {
            if (b.isDead) return;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-10, -b.radius - 10, 20, 3);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-10, -b.radius - 10, 20 * (b.hp / b.maxHp), 3);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#aed6f1';
            ctx2.beginPath();
            ctx2.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.strokeStyle = '#5dade2';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.fillStyle = '#2e86c1';
            ctx2.beginPath();
            ctx2.arc(4, -3, 2, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.beginPath();
            ctx2.arc(4, 3, 2, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.restore();
        });

        // Buz Botu
        buzBotlari.forEach(b => {
            if (b.isDead) return;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-25, -b.radius - 15, 50, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-25, -b.radius - 15, 50 * (b.hp / b.maxHp), 5);
            if (b.vurusAnimasyon > 0) {
                const animOrani = b.vurusAnimasyon / BUZ_BOT_VURUS_ANIM;
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
            const animScale = b.vurusAnimasyon > 0 ? 1.1 : 1;
            ctx2.scale(animScale, animScale);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#2e86c1';
            ctx2.beginPath();
            ctx2.moveTo(b.radius, 0);
            ctx2.lineTo(b.radius * 0.4, -b.radius);
            ctx2.lineTo(-b.radius * 0.8, -b.radius * 0.7);
            ctx2.lineTo(-b.radius * 0.8, b.radius * 0.7);
            ctx2.lineTo(b.radius * 0.4, b.radius);
            ctx2.closePath();
            ctx2.fill();
            ctx2.strokeStyle = '#1a5276';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.fillStyle = 'rgba(255,255,255,0.3)';
            ctx2.beginPath();
            ctx2.arc(0, 0, b.radius * 0.35, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.fillStyle = '#fff';
            ctx2.beginPath();
            ctx2.arc(8, -5, 3, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.beginPath();
            ctx2.arc(8, 5, 3, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.restore();
        });

        // Buz Ciritçisi
        ciritciBotlari.forEach(c => {
            if (c.isDead) return;
            ctx2.save();
            ctx2.translate(c.x, c.y);
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-20, -c.radius - 15, 40, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-20, -c.radius - 15, 40 * (c.hp / c.maxHp), 5);
            ctx2.rotate(c.angle);
            ctx2.fillStyle = '#5dade2';
            ctx2.beginPath();
            ctx2.arc(0, 0, c.radius, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.strokeStyle = '#2e86c1';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            const gradyan = ctx2.createLinearGradient(12, 0, 34, 0);
            gradyan.addColorStop(0, '#aed6f1');
            gradyan.addColorStop(1, '#eaf2f8');
            ctx2.fillStyle = gradyan;
            ctx2.fillRect(12, -2.5, 22, 5);
            ctx2.fillStyle = '#ffffff';
            ctx2.beginPath();
            ctx2.moveTo(36, 0);
            ctx2.lineTo(28, -7);
            ctx2.lineTo(28, 7);
            ctx2.closePath();
            ctx2.fill();
            ctx2.strokeStyle = '#5dade2';
            ctx2.lineWidth = 1.5;
            ctx2.stroke();
            ctx2.fillStyle = '#1a5276';
            ctx2.beginPath();
            ctx2.arc(6, -5, 2.5, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.beginPath();
            ctx2.arc(6, 5, 2.5, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.restore();
        });

        // Heykel Tıraşı
        heykelTirasiBotlari.forEach(h => {
            if (h.isDead) return;
            ctx2.save();
            ctx2.translate(h.x, h.y);
            const yurumeOffset = Math.sin(Date.now() / 150) * 2;
            ctx2.translate(0, yurumeOffset);
            ctx2.fillStyle = 'rgba(0,0,0,0.3)';
            ctx2.beginPath();
            ctx2.ellipse(0, h.radius * 0.6, h.radius * 0.8, h.radius * 0.3, 0, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-18, -h.radius - 15, 36, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-18, -h.radius - 15, 36 * (h.hp / h.maxHp), 5);
            ctx2.rotate(h.angle);
            ctx2.fillStyle = '#8e44ad';
            ctx2.beginPath();
            ctx2.arc(0, 0, h.radius, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.strokeStyle = '#fff';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.fillStyle = '#aed6f1';
            ctx2.fillRect(10, -2, 8, 3);
            ctx2.fillStyle = '#85c1e9';
            ctx2.fillRect(18, -4, 4, 8);
            ctx2.fillStyle = '#fff';
            ctx2.shadowColor = '#fff';
            ctx2.shadowBlur = 3;
            ctx2.beginPath();
            ctx2.arc(8, -5, 3, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.beginPath();
            ctx2.arc(8, 5, 3, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.shadowBlur = 0;
            ctx2.restore();
            if (h.insaatSure > 0) {
                ctx2.save();
                ctx2.translate(h.x, h.y);
                ctx2.globalAlpha = 0.7;
                const ilerleme = 1 - (h.insaatSure / (h.ilkInsa ? HEYKEL_ILK_INSAA_SURESI : HEYKEL_INSAA_SURESI));
                ctx2.fillStyle = 'rgba(0,0,0,0.5)';
                ctx2.fillRect(-20, -h.radius - 30, 40, 6);
                ctx2.fillStyle = '#85c1e9';
                ctx2.fillRect(-20, -h.radius - 30, 40 * ilerleme, 6);
                ctx2.restore();
            }
        });

        // Heykel
        heykeller.forEach(hey => {
            if (hey.isDead) return;
            ctx2.save();
            ctx2.translate(hey.x, hey.y);
            const yurumeOffset = Math.sin(Date.now() / 200) * 3;
            ctx2.translate(0, yurumeOffset);
            ctx2.fillStyle = 'rgba(0,0,0,0.3)';
            ctx2.beginPath();
            ctx2.ellipse(0, hey.radius * 0.7, hey.radius * 0.9, hey.radius * 0.35, 0, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-30, -hey.radius - 15, 60, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-30, -hey.radius - 15, 60 * (hey.hp / hey.maxHp), 5);
            ctx2.rotate(hey.angle);
            ctx2.fillStyle = '#85c1e9';
            ctx2.beginPath();
            ctx2.moveTo(hey.radius, 0);
            ctx2.lineTo(hey.radius * 0.4, -hey.radius);
            ctx2.lineTo(-hey.radius * 0.8, -hey.radius * 0.7);
            ctx2.lineTo(-hey.radius * 0.8, hey.radius * 0.7);
            ctx2.lineTo(hey.radius * 0.4, hey.radius);
            ctx2.closePath();
            ctx2.fill();
            ctx2.strokeStyle = '#5dade2';
            ctx2.lineWidth = 4;
            ctx2.stroke();
            ctx2.fillStyle = 'rgba(255,255,255,0.2)';
            ctx2.beginPath();
            ctx2.arc(0, 0, hey.radius * 0.4, 0, Math.PI * 2);
            ctx2.fill();
            const hasarOrani = 1 - (hey.hp / hey.maxHp);
            if (hasarOrani > 0.3) {
                ctx2.strokeStyle = `rgba(255,255,255,${Math.min(0.8, hasarOrani)})`;
                ctx2.lineWidth = 2;
                ctx2.beginPath();
                ctx2.moveTo(5, 0);
                ctx2.lineTo(15, 10);
                ctx2.lineTo(10, 20);
                ctx2.stroke();
            }
            if (hasarOrani > 0.6) {
                ctx2.beginPath();
                ctx2.moveTo(-8, 5);
                ctx2.lineTo(-15, 15);
                ctx2.stroke();
            }
            ctx2.fillStyle = '#fff';
            ctx2.shadowColor = '#fff';
            ctx2.shadowBlur = 5;
            ctx2.beginPath();
            ctx2.arc(10, -6, 4, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.beginPath();
            ctx2.arc(10, 6, 4, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.shadowBlur = 0;
            ctx2.fillStyle = '#1a5276';
            ctx2.beginPath();
            ctx2.arc(11, -6, 2, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.beginPath();
            ctx2.arc(11, 6, 2, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.restore();
        });

        // Buz Boğası
        buzBogalari.forEach(b => {
            if (b.isDead) return;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            const yurumeOffset = Math.sin(Date.now() / 150) * 2;
            ctx2.translate(0, yurumeOffset);
            ctx2.fillStyle = 'rgba(0,0,0,0.3)';
            ctx2.beginPath();
            ctx2.ellipse(0, b.radius * 0.6, b.radius * 0.9, b.radius * 0.35, 0, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-25, -b.radius - 15, 50, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-25, -b.radius - 15, 50 * (b.hp / b.maxHp), 5);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#5dade2';
            ctx2.beginPath();
            ctx2.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.strokeStyle = '#2e86c1';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.fillStyle = 'rgba(255,255,255,0.4)';
            ctx2.beginPath();
            ctx2.moveTo(5, 8);
            ctx2.lineTo(12, 3);
            ctx2.lineTo(8, -5);
            ctx2.closePath();
            ctx2.fill();
            ctx2.fillStyle = '#85c1e9';
            ctx2.beginPath();
            ctx2.moveTo(8, -14);
            ctx2.quadraticCurveTo(15, -25, 20, -28);
            ctx2.lineTo(16, -14);
            ctx2.closePath();
            ctx2.fill();
            ctx2.beginPath();
            ctx2.moveTo(8, 14);
            ctx2.quadraticCurveTo(15, 25, 20, 28);
            ctx2.lineTo(16, 14);
            ctx2.closePath();
            ctx2.fill();
            ctx2.fillStyle = '#fff';
            ctx2.shadowColor = '#fff';
            ctx2.shadowBlur = 4;
            ctx2.beginPath();
            ctx2.arc(10, -6, 4, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.beginPath();
            ctx2.arc(10, 6, 4, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.shadowBlur = 0;
            ctx2.fillStyle = '#1a5276';
            ctx2.beginPath();
            ctx2.arc(11, -6, 2, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.beginPath();
            ctx2.arc(11, 6, 2, 0, Math.PI * 2);
            ctx2.fill();
            if (b.durum === 'sarj') {
                ctx2.rotate(-b.angle);
                const ilerleme = 1 - (b.sarjSure / BOGA_SARJ_SURE);
                ctx2.strokeStyle = `rgba(255, 107, 53, ${0.5 + ilerleme * 0.5})`;
                ctx2.lineWidth = 3;
                ctx2.beginPath();
                ctx2.arc(0, 0, b.radius + 8, -Math.PI / 2, -Math.PI / 2 + ilerleme * Math.PI * 2);
                ctx2.stroke();
                ctx2.rotate(b.angle);
            }
            if (b.durum === 'sersemleme') {
                ctx2.rotate(-b.angle);
                const animAci = Date.now() / 150;
                for (let k = 0; k < 3; k++) {
                    const yildizAci = animAci + (k * Math.PI * 2) / 3;
                    const yildizDist = 22 + Math.sin(Date.now() / 100 + k) * 4;
                    const yildizX = Math.cos(yildizAci) * yildizDist;
                    const yildizY = Math.sin(yildizAci) * yildizDist - 15;
                    ctx2.fillStyle = '#f1c40f';
                    ctx2.font = "bold 12px Arial";
                    ctx2.textAlign = "center";
                    ctx2.fillText("★", yildizX, yildizY);
                }
                ctx2.rotate(b.angle);
            }
            if (b.durum === 'ofke') {
                ctx2.rotate(-b.angle);
                ctx2.strokeStyle = 'rgba(174, 214, 241, 0.8)';
                ctx2.lineWidth = 3;
                for (let k = 0; k < 4; k++) {
                    const izUzunluk = 25 + k * 10;
                    ctx2.beginPath();
                    ctx2.moveTo(-b.radius - 5, (k - 1.5) * 6);
                    ctx2.lineTo(-b.radius - izUzunluk, (k - 1.5) * 6);
                    ctx2.stroke();
                }
                ctx2.rotate(b.angle);
            }
            ctx2.restore();
        });
    });

    // ========== RESET OLAYI ==========
    window.GAME_EXT.on('onReset', function () {
        buzSlimeLari = [];
        ortaBuzSlimeLari = [];
        buyukBuzSlimeLari = [];
        buzBotlari = [];
        ciritciBotlari = [];
        heykelTirasiBotlari = [];
        heykeller = [];
        buzBogalari = [];
        buzBotSpawnTimer = 0;
        buzBotSpawnUyarilari = [];
        ciritciRespawnTimer = -1;
        ciritciSpawnUyarilari = [];
        heykelTirasiSpawnTimer = 0;
        heykelTirasiSpawnUyarilari = [];
        bogaSpawnTimer = 0;
        bogaSpawnUyarilari = [];
        sonTemasZamani = {};
    });

    // ========== MOD SEÇİM KARTI ==========
    const track = document.getElementById('difficulty-track');
    if (track) {
        track.style.touchAction = 'pan-y';
        track.style.webkitOverflowScrolling = 'touch';
        track.style.overflowY = 'scroll';
        track.style.maxHeight = '70vh';
        track.style.scrollSnapType = 'none';
    }

    if (track && !document.getElementById('diff-buzul')) {
        const card = document.createElement('div');
        card.className = 'diff-card';
        card.id = 'diff-buzul';
        card.style.flex = '0 0 auto';
        card.style.width = 'min(76vw,300px)';
        card.style.margin = '5px auto';
        card.style.padding = '15px 10px';
        card.innerHTML =
            '<span>Buzul Çağı</span>' +
            '<small>Buz Botu + Ciritçi + Heykel Tıraşı + Buz Boğası</small>';
        track.appendChild(card);

        card.addEventListener('click', () => {
            document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            window.GAME_MODE = MOD_ID;
        });
        card.addEventListener('touchstart', (e) => {
            document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            window.GAME_MODE = MOD_ID;
        }, { passive: true });
    }

    // ========== OK BUTONLARI ==========
    const difficultyScreen = document.getElementById('difficulty-screen');
    if (difficultyScreen && !document.getElementById('mod-up-btn')) {
        const upBtn = document.createElement('button');
        upBtn.id = 'mod-up-btn';
        upBtn.textContent = '▲';
        upBtn.style.cssText = `
            position: absolute;
            right: 8px;
            top: 20%;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            color: #fff;
            border: 2px solid rgba(255,255,255,0.5);
            font-size: 20px;
            cursor: pointer;
            z-index: 70;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            touch-action: manipulation;
        `;

        const downBtn = document.createElement('button');
        downBtn.id = 'mod-down-btn';
        downBtn.textContent = '▼';
        downBtn.style.cssText = upBtn.style.cssText;
        downBtn.style.top = 'auto';
        downBtn.style.bottom = '20%';

        function getSelectedIndex() {
            const cards = document.querySelectorAll('.diff-card');
            for (let i = 0; i < cards.length; i++) {
                if (cards[i].classList.contains('selected')) return i;
            }
            return 0;
        }

        function selectCardByIndex(index) {
            const cards = document.querySelectorAll('.diff-card');
            if (cards.length === 0) return;
            if (index < 0) index = 0;
            if (index >= cards.length) index = cards.length - 1;
            cards.forEach(c => c.classList.remove('selected'));
            cards[index].classList.add('selected');
            cards[index].scrollIntoView({ behavior: 'smooth', block: 'center' });

            const cardId = cards[index].id;
            if (cardId === 'diff-normal') window.GAME_MODE = 'arena';
            else if (cardId === 'diff-easy') { /* kolay klasik */ }
            else if (cardId === 'diff-buzul') window.GAME_MODE = 'buzul';
        }

        function moveSelection(direction) {
            const current = getSelectedIndex();
            const newIndex = direction === 'up' ? current - 1 : current + 1;
            selectCardByIndex(newIndex);
        }

        upBtn.addEventListener('click', (e) => { e.preventDefault(); moveSelection('up'); });
        downBtn.addEventListener('click', (e) => { e.preventDefault(); moveSelection('down'); });
        upBtn.addEventListener('touchstart', (e) => { e.preventDefault(); moveSelection('up'); }, { passive: false });
        downBtn.addEventListener('touchstart', (e) => { e.preventDefault(); moveSelection('down'); }, { passive: false });

        difficultyScreen.appendChild(upBtn);
        difficultyScreen.appendChild(downBtn);
    }

})();