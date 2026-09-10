// ========== mod10.js (TURUNCU BASKIN) - DÜZELTİLMİŞ ==========
// - Turuncu bot: Klasik stationary tipi, sınırsız menzil, ciritçi gibi spawn.
// - Turuncu Slime: Orijinal slime mekaniğinin turuncu versiyonu.
//   * Büyük spawn olur, ölünce 2 orta, orta ölünce 2 küçük, küçük tamamen ölür.
//   * Görünüm: göz yok, iki iç içe turuncu daire, içteki öne kaymış.
//   * Her bölünmede/ölümde 4 mermi bırakır (temasla ölürse bırakmaz).
//   * Mermiler açılı, hafif eğim alır, menzilli, sipere 50 hasar.
// - Siperler gri, can 2.5 kat (2000).

(function () {
    'use strict';

    const MOD_ID = 'turuncu';

    // ---- Turuncu Bot ----
    const BOT_HP = 2500;
    const BOT_RADIUS = 22;
    const BOT_SHOOT_INTERVAL = 750;
    const BOT_RESPAWN_SURESI = 360;
    const BOT_SPAWN_WARN = 180;

    // ---- Turuncu Slime ----
    const SLIME_HP = 700;
    const SLIME_RADIUS = { 0: 30, 1: 20, 2: 12 };
    const SLIME_SPEED = 1.0;
    const SLIME_TEMAS_HASAR = 200;
    const SLIME_SPAWN_INTERVAL = 960;
    const SLIME_MAX = 6;
    const SLIME_SPAWN_WARN = 180;

    const SLIME_MERMI_SAYISI = 4;
    const SLIME_MERMI_HIZ = BOT_BULLET_SPEED * 0.5;
    const SLIME_MERMI_MENZIL = 350;
    const SLIME_MERMI_EGIM = 0.03;
    const SLIME_MERMI_SIPER_HASAR = 50;
    const SLIME_MERMI_HASAR = { 0: 100, 1: 50, 2: 30 };

    const SIPER_CAN = 2000;

    let turuncuBot = null;
    let respawnTimer = 0;
    let spawnUyariTimer = 0;
    let spawnX = 0;
    let spawnY = 0;

    let slimeBotlar = [];
    let slimeSpawnTimer = 0;
    let slimeSpawnUyarilari = [];
    let slimeMermileri = [];

    window.GAME_EXT.registerMode(MOD_ID, {
        label: 'Turuncu Baskın',
        onStart: function () {
            turuncuBot = null;
            respawnTimer = 0;
            spawnUyariTimer = 0;
            spawnX = 0; spawnY = 0;
            slimeBotlar = [];
            slimeSpawnTimer = 0;
            slimeSpawnUyarilari = [];
            slimeMermileri = [];

            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = []; stationaryBots = [];
            boomerangBots = []; fogBots = [];
            nests = []; spawnIndicators = [];

            obstacles.forEach(o => {
                o.maxHp = SIPER_CAN;
                o.hp = SIPER_CAN;
                o._griSiper = true;
            });

            botSpawnHazirla();
        },

        onUpdate: function (ts) {
            slimeTimer = 0; stationaryTimer = 0;
            boomerangTimer = 0; fogBotTimer = 0;
            spawnIndicators = [];

            obstacles.forEach(o => {
                if (!o._griSiper) {
                    o.maxHp = SIPER_CAN;
                    o.hp = SIPER_CAN;
                    o._griSiper = true;
                }
            });

            // ---- Turuncu bot spawn ----
            if (!turuncuBot || turuncuBot.isDead) {
                if (spawnUyariTimer > 0) {
                    spawnUyariTimer -= ts;
                    if (spawnUyariTimer <= 0) dogurTuruncuBot();
                } else if (respawnTimer > 0) {
                    respawnTimer -= ts;
                    if (respawnTimer <= 0) {
                        respawnTimer = 0;
                        botSpawnHazirla();
                    }
                }
            }

            // ---- Turuncu bot güncelle ----
            if (turuncuBot && !turuncuBot.isDead) {
                const b = turuncuBot;
                if (b.hp <= 0) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color, 'smoke');
                    triggerBotKill(b.x, b);
                    respawnTimer = BOT_RESPAWN_SURESI;
                } else {
                    const canSee = !player.isDead && !player.isInvisible;
                    if (canSee) {
                        b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                        if (Date.now() - b.lastShot > BOT_SHOOT_INTERVAL) {
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

            // ---- Slime spawn ----
            slimeSpawnTimer += ts;
            if (slimeSpawnTimer >= SLIME_SPAWN_INTERVAL && (slimeBotlar.length + slimeSpawnUyarilari.length) < SLIME_MAX) {
                slimeSpawnTimer = 0;
                const x = Math.random() * (canvas.width - 200) + 100;
                const y = Math.random() * (canvas.height - 200) + 100;
                slimeSpawnUyarilari.push({ x, y, timer: SLIME_SPAWN_WARN });
            }

            for (let i = slimeSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = slimeSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    slimeDogur(u.x, u.y, 0);
                    slimeSpawnUyarilari.splice(i, 1);
                }
            }

            // ---- Slime güncelle ----
            for (let i = slimeBotlar.length - 1; i >= 0; i--) {
                const s = slimeBotlar[i];
                if (s.isDead) { slimeBotlar.splice(i, 1); continue; }

                // Can kontrolü
                if (s.hp <= 0) {
                    s.isDead = true;
                    const temaslaOldu = s.temaslaOldu || false;

                    // Temasla ölmediyse mermi bırak
                    if (!temaslaOldu) {
                        slimeMermiBirak(s);
                    }

                    // Bölünme
                    if (s.stage === 0) {
                        slimeDogur(s.x + 15, s.y + 15, 1);
                        slimeDogur(s.x - 15, s.y - 15, 1);
                    } else if (s.stage === 1) {
                        slimeDogur(s.x + 15, s.y + 15, 2);
                        slimeDogur(s.x - 15, s.y - 15, 2);
                    }

                    triggerBotKill(s.x, s);
                    spawnParticles(s.x, s.y, s.color);
                    continue;
                }

                // Hareket (oyuncuya doğru)
                const canSee = !player.isDead && !player.isInvisible;
                if (canSee) {
                    s.angle = Math.atan2(player.y - s.y, player.x - s.x);
                    s.x += Math.cos(s.angle) * s.speed * ts;
                    s.y += Math.sin(s.angle) * s.speed * ts;
                }

                // Knockback
                if (Math.abs(s.kbX) > 0.1 || Math.abs(s.kbY) > 0.1) {
                    s.x += s.kbX * ts; s.y += s.kbY * ts;
                    s.kbX *= 0.85; s.kbY *= 0.85;
                }

                s.x = clampPos(s.x, s.radius + WALL_THICKNESS, canvas.width - s.radius - WALL_THICKNESS);
                s.y = clampPos(s.y, s.radius + WALL_THICKNESS, canvas.height - s.radius - WALL_THICKNESS);
                resolveObstacleCollision(s);

                // Temas hasarı
                if (!player.isDead && getDist(s, player) < s.radius + player.radius) {
                    player.hp -= SLIME_TEMAS_HASAR;
                    addFloatingNumber(player.x, player.y, SLIME_TEMAS_HASAR, "#e74c3c");
                    player.lastHitTime = Date.now();
                    s.hp = 0;
                    s.temaslaOldu = true;
                }
            }

            // ---- Slime mermileri ----
            for (let i = slimeMermileri.length - 1; i >= 0; i--) {
                const m = slimeMermileri[i];
                if (m.isDead) { slimeMermileri.splice(i, 1); continue; }

                // Hafif eğim
                if (!player.isDead) {
                    const hedefAci = Math.atan2(player.y - m.y, player.x - m.x);
                    const mevcutAci = Math.atan2(m.vy, m.vx);
                    let fark = hedefAci - mevcutAci;
                    while (fark > Math.PI) fark -= Math.PI * 2;
                    while (fark < -Math.PI) fark += Math.PI * 2;
                    const yeniAci = mevcutAci + Math.max(-SLIME_MERMI_EGIM, Math.min(SLIME_MERMI_EGIM, fark)) * ts;
                    const hiz = Math.hypot(m.vx, m.vy);
                    m.vx = Math.cos(yeniAci) * hiz;
                    m.vy = Math.sin(yeniAci) * hiz;
                }

                m.x += m.vx * ts;
                m.y += m.vy * ts;
                m.life -= ts;

                const mesafe = Math.hypot(m.x - m.sx, m.y - m.sy);
                if (m.life <= 0 || mesafe > SLIME_MERMI_MENZIL) {
                    m.isDead = true; continue;
                }
                if (m.x < WALL_THICKNESS || m.x > canvas.width - WALL_THICKNESS ||
                    m.y < WALL_THICKNESS || m.y > canvas.height - WALL_THICKNESS) {
                    m.isDead = true; continue;
                }

                // Sipere çarpma
                let sipereCarpti = false;
                for (const o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(m, o) < o.radius + m.radius) {
                        o.hp -= SLIME_MERMI_SIPER_HASAR;
                        addFloatingNumber(o.x, o.y, SLIME_MERMI_SIPER_HASAR, "#e67e22");
                        sipereCarpti = true;
                        break;
                    }
                }
                if (sipereCarpti) { m.isDead = true; continue; }

                // Oyuncuya çarpma
                if (!player.isDead && getDist(m, player) < player.radius + m.radius) {
                    player.hp -= m.hasar;
                    addFloatingNumber(player.x, player.y, m.hasar, "#e74c3c");
                    player.lastHitTime = Date.now();
                    m.isDead = true; continue;
                }
            }
        },

        onReset: function () {
            turuncuBot = null;
            respawnTimer = 0;
            spawnUyariTimer = 0;
            slimeBotlar = [];
            slimeSpawnTimer = 0;
            slimeSpawnUyarilari = [];
            slimeMermileri = [];
        }
    });

    function botSpawnHazirla() {
        spawnX = Math.random() * (canvas.width - 200) + 100;
        spawnY = Math.random() * (canvas.height - 200) + 100;
        spawnUyariTimer = BOT_SPAWN_WARN;
    }

    function dogurTuruncuBot() {
        turuncuBot = {
            x: spawnX, y: spawnY,
            radius: BOT_RADIUS,
            hp: BOT_HP, maxHp: BOT_HP,
            speed: 0, angle: 0, lastShot: 0,
            shootInterval: BOT_SHOOT_INTERVAL,
            isDead: false, isActive: true,
            color: '#e67e22',
            kbX: 0, kbY: 0
        };
        spawnParticles(turuncuBot.x, turuncuBot.y, '#e67e22', 'smoke');
    }

    function slimeDogur(x, y, stage) {
        const radius = SLIME_RADIUS[stage];
        slimeBotlar.push({
            x, y, radius,
            stage: stage,
            hp: SLIME_HP, maxHp: SLIME_HP,
            speed: SLIME_SPEED,
            angle: 0, isDead: false, isActive: true,
            color: '#e67e22',
            kbX: 0, kbY: 0,
            temaslaOldu: false
        });
    }

    function slimeMermiBirak(s) {
        const tabanAci = s.angle || 0;
        const yayilma = Math.PI / 3;
        const hasar = SLIME_MERMI_HASAR[s.stage] || 50;
        for (let i = 0; i < SLIME_MERMI_SAYISI; i++) {
            const a = tabanAci - yayilma / 2 + (yayilma / (SLIME_MERMI_SAYISI - 1)) * i;
            slimeMermileri.push({
                x: s.x, y: s.y,
                sx: s.x, sy: s.y,
                vx: Math.cos(a) * SLIME_MERMI_HIZ,
                vy: Math.sin(a) * SLIME_MERMI_HIZ,
                radius: 8,
                hasar: hasar,
                life: 8,
                isDead: false
            });
        }
        // YENİ: Yazı çıkmasın (addFloatingNumber kaldırıldı)
    }

    // ========== DÜŞMAN LİSTESİNE EKLE ==========
    window.GAME_EXT.chainHook('getExtraEnemies', function () {
        if (window.GAME_MODE !== MOD_ID) return [];
        const liste = [];
        if (turuncuBot && !turuncuBot.isDead) liste.push(turuncuBot);
        liste.push(...slimeBotlar.filter(s => !s.isDead));
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

        // Turuncu bot spawn uyarısı
        if (spawnUyariTimer > 0) {
            ctx2.save();
            ctx2.translate(spawnX, spawnY);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath();
            ctx2.arc(0, 0, BOT_RADIUS + 12, 0, Math.PI * 2);
            ctx2.strokeStyle = '#e67e22';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#e67e22';
            ctx2.font = "bold 14px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(spawnUyariTimer / 60), 0, 5);
            ctx2.restore();
        }

        // Slime spawn uyarısı
        slimeSpawnUyarilari.forEach(u => {
            ctx2.save();
            ctx2.translate(u.x, u.y);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath();
            ctx2.arc(0, 0, 25, 0, Math.PI * 2);
            ctx2.strokeStyle = '#e67e22';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#e67e22';
            ctx2.font = "bold 14px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(u.timer / 60), 0, 5);
            ctx2.restore();
        });

        // Turuncu bot
        if (turuncuBot && !turuncuBot.isDead) {
            const b = turuncuBot;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-b.radius, -b.radius - 12, b.radius * 2, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-b.radius, -b.radius - 12, b.radius * 2 * (b.hp / b.maxHp), 5);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#e67e22';
            ctx2.beginPath();
            ctx2.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.strokeStyle = '#a04000';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.fillStyle = '#d35400';
            ctx2.beginPath();
            ctx2.arc(0, 0, b.radius * 0.75, -Math.PI * 0.7, Math.PI * 0.7);
            ctx2.fill();
            ctx2.fillStyle = '#5d4037';
            ctx2.fillRect(b.radius - 2, -3, 10, 6);
            ctx2.shadowColor = '#f39c12';
            ctx2.shadowBlur = 6;
            ctx2.fillStyle = '#fff5e1';
            ctx2.beginPath();
            ctx2.arc(7, -5, 4, 0, Math.PI * 2);
            ctx2.arc(7, 5, 4, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.shadowBlur = 0;
            ctx2.fillStyle = '#e67e22';
            ctx2.beginPath();
            ctx2.arc(8, -5, 2, 0, Math.PI * 2);
            ctx2.arc(8, 5, 2, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.restore();
        }

        // Turuncu Slime'lar
        slimeBotlar.forEach(s => {
            if (s.isDead) return;
            ctx2.save();
            ctx2.translate(s.x, s.y);
            const barW = s.radius * 2;
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-barW / 2, -s.radius - 12, barW, 4);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-barW / 2, -s.radius - 12, barW * (s.hp / s.maxHp), 4);
            ctx2.rotate(s.angle);
            // Dış daire (gövde) - turuncu
            ctx2.fillStyle = '#e67e22';
            ctx2.beginPath();
            ctx2.arc(0, 0, s.radius, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.strokeStyle = '#a04000';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            // İç daire (öne kaymış, koyu turuncu)
            ctx2.fillStyle = '#a04000';
            ctx2.beginPath();
            ctx2.arc(s.radius * 0.4, 0, s.radius * 0.55, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.restore();
        });

        // Slime mermileri
        slimeMermileri.forEach(m => {
            if (m.isDead) return;
            ctx2.save();
            ctx2.translate(m.x, m.y);
            ctx2.beginPath();
            ctx2.arc(0, 0, m.radius + 3, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(230, 126, 34, 0.3)';
            ctx2.fill();
            ctx2.beginPath();
            ctx2.arc(0, 0, m.radius, 0, Math.PI * 2);
            ctx2.fillStyle = '#e67e22';
            ctx2.fill();
            ctx2.strokeStyle = '#a04000';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.restore();
        });
    });

    window.GAME_EXT.modKartiEkle('turuncu', 'Turuncu Baskın', 'Gri siperler, turuncu bot + turuncu slime');

    console.log('[MOD YÜKLENDİ] turuncu');
})();