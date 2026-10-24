// ========== mod10.js (TURUNCU BASKIN) - v3 ==========
// - Eski bot (sonsuz menzilli, hızlı ateş) korunur
// - YENİ BOT: 3400 HP, 3s ateş, mermi menzil sonu/duvar/sipere çarpınca 4 parçaya bölünür
// - Yeni bot 7 saniyede 1 spawn olur (koyu kırmızı altıgen uyarı)
// - Slime ölünce tek mermi atar, boyutla orantılı hasar/menzil
// - Slime mermisi TAKİP ETMEZ — ölüm anındaki bakış yönüne düz gider
// - Slime mermisi 4'lü yerine 4'lü (9° aralıkla çapraz yayılım)

(function () {
    'use strict';

    const MOD_ID = 'turuncu';

    // ---- Eski Turuncu Bot (sonsuz menzil) ----
    const BOT_HP = 2500;
    const BOT_RADIUS = 22;
    const BOT_SHOOT_INTERVAL = 750;
    const BOT_RESPAWN_SURESI = 360;
    const BOT_SPAWN_WARN = 180;

    // ---- Yeni Ağır Bot ----
    const AGIR_HP = 3400;
    const AGIR_RADIUS = 28;
    const AGIR_SHOOT_INTERVAL = 3000;   // 3 saniye
    const AGIR_RESPAWN_SURESI = 420;    // 7 saniye
    const AGIR_SPAWN_WARN = 240;
    const AGIR_ANA_MERMI_HIZ = BOT_BULLET_SPEED * 0.7;
    const AGIR_ANA_MERMI_HASAR = 350;
    const AGIR_ANA_MERMI_MENZIL = 350;
    const AGIR_PARCA_SAYISI = 4;
    const AGIR_PARCA_ARALIK = 9 * Math.PI / 180;   // 9 derece
    const AGIR_PARCA_HASAR = 80;
    const AGIR_PARCA_HIZ = BOT_BULLET_SPEED * 0.55;
    const AGIR_PARCA_MENZIL = 180;

    // ---- Slime ----
    const SLIME_HP = 700;
    const SLIME_RADIUS = { 0: 30, 1: 20, 2: 12 };
    const SLIME_SPEED = 1.0;
    const SLIME_TEMAS_HASAR = 200;
    const SLIME_SPAWN_INTERVAL = 960;
    const SLIME_MAX = 6;
    const SLIME_SPAWN_WARN = 180;

    // Boyutla orantılı slime mermisi
    const SLIME_MERMI = {
        0: { hasar: 300, menzil: 200, hiz: BOT_BULLET_SPEED * 0.55, radius: 10, color: '#a04000' },
        1: { hasar: 200, menzil: 140, hiz: BOT_BULLET_SPEED * 0.45, radius: 7, color: '#d35400' },
        2: { hasar: 100, menzil: 90,  hiz: BOT_BULLET_SPEED * 0.35, radius: 5, color: '#e67e22' }
    };

    const SIPER_CAN = 2000;

    let turuncuBot = null;
    let respawnTimer = 0;
    let spawnUyariTimer = 0;
    let spawnX = 0;
    let spawnY = 0;

    let agirBot = null;
    let agirRespawnTimer = 0;
    let agirSpawnUyariTimer = 0;
    let agirSpawnX = 0;
    let agirSpawnY = 0;

    let slimeBotlar = [];
    let slimeSpawnTimer = 0;
    let slimeSpawnUyarilari = [];
    let agirMermiler = [];      // Ağır bot mermileri (ana + parça)
    let slimeMermileri = [];

    function rawDamageText(x, y, val, color) {
        floatingNumbers.push({
            x: x + (Math.random() - .5) * 20,
            y: y - 20,
            val: val, color: color || "#e74c3c",
            life: 60, opacity: 1
        });
    }

    window.GAME_EXT.registerMode(MOD_ID, {
        label: 'Turuncu Baskın',
        onStart: function () {
            turuncuBot = null; respawnTimer = 0; spawnUyariTimer = 0; spawnX = 0; spawnY = 0;
            agirBot = null; agirRespawnTimer = 0; agirSpawnUyariTimer = 0; agirSpawnX = 0; agirSpawnY = 0;
            slimeBotlar = []; slimeSpawnTimer = 0; slimeSpawnUyarilari = [];
            agirMermiler = []; slimeMermileri = [];

            bot.isActive = false; bot.isDead = true; bot.x = -9999; bot.y = -9999;
            bot2.isActive = false; bot2.isDead = true; bot2.x = -9999; bot2.y = -9999;
            slimeBots = []; stationaryBots = []; boomerangBots = []; fogBots = [];
            nests = []; spawnIndicators = [];

            obstacles.forEach(o => {
                o.maxHp = SIPER_CAN; o.hp = SIPER_CAN; o._griSiper = true;
            });

            botSpawnHazirla();
            agirBotSpawnHazirla();
        },

        onUpdate: function (ts) {
            slimeTimer = 0; stationaryTimer = 0; boomerangTimer = 0; fogBotTimer = 0;
            spawnIndicators = [];

            // Arena botlarını her frame temizle
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

            // ---- Eski bot spawn ----
            if (!turuncuBot || turuncuBot.isDead) {
                if (spawnUyariTimer > 0) {
                    spawnUyariTimer -= ts;
                    if (spawnUyariTimer <= 0) dogurTuruncuBot();
                } else if (respawnTimer > 0) {
                    respawnTimer -= ts;
                    if (respawnTimer <= 0) { respawnTimer = 0; botSpawnHazirla(); }
                }
            }

            // ---- Yeni ağır bot spawn ----
            if (!agirBot || agirBot.isDead) {
                if (agirSpawnUyariTimer > 0) {
                    agirSpawnUyariTimer -= ts;
                    if (agirSpawnUyariTimer <= 0) dogurAgirBot();
                } else if (agirRespawnTimer > 0) {
                    agirRespawnTimer -= ts;
                    if (agirRespawnTimer <= 0) { agirRespawnTimer = 0; agirBotSpawnHazirla(); }
                }
            }

            // ---- Eski bot güncelle ----
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

            // ---- Yeni ağır bot güncelle ----
            if (agirBot && !agirBot.isDead) {
                const b = agirBot;
                if (b.hp <= 0) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color, 'smoke');
                    triggerBotKill(b.x, b);
                    agirRespawnTimer = AGIR_RESPAWN_SURESI;
                } else {
                    const canSee = !player.isDead && !player.isInvisible;
                    if (canSee) {
                        b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                        if (Date.now() - b.lastShot > AGIR_SHOOT_INTERVAL) {
                            b.lastShot = Date.now();
                            agirMermiler.push({
                                x: b.x, y: b.y, sx: b.x, sy: b.y,
                                vx: Math.cos(b.angle) * AGIR_ANA_MERMI_HIZ,
                                vy: Math.sin(b.angle) * AGIR_ANA_MERMI_HIZ,
                                angle: b.angle,
                                radius: 12,
                                hasar: AGIR_ANA_MERMI_HASAR,
                                menzil: AGIR_ANA_MERMI_MENZIL,
                                isAna: true,
                                isDead: false
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
                if (u.timer <= 0) { slimeDogur(u.x, u.y, 0); slimeSpawnUyarilari.splice(i, 1); }
            }

            // ---- Slime güncelle ----
            for (let i = slimeBotlar.length - 1; i >= 0; i--) {
                const s = slimeBotlar[i];
                if (s.isDead) { slimeBotlar.splice(i, 1); continue; }
                if (s.hp <= 0) {
                    s.isDead = true;
                    const temaslaOldu = s.temaslaOldu || false;
                    if (!temaslaOldu) slimeMermiBirak(s);
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

                const canSee = !player.isDead && !player.isInvisible;
                if (canSee) {
                    s.angle = Math.atan2(player.y - s.y, player.x - s.x);
                    s.x += Math.cos(s.angle) * s.speed * ts;
                    s.y += Math.sin(s.angle) * s.speed * ts;
                }
                if (Math.abs(s.kbX) > 0.1 || Math.abs(s.kbY) > 0.1) {
                    s.x += s.kbX * ts; s.y += s.kbY * ts;
                    s.kbX *= 0.85; s.kbY *= 0.85;
                }
                s.x = clampPos(s.x, s.radius + WALL_THICKNESS, canvas.width - s.radius - WALL_THICKNESS);
                s.y = clampPos(s.y, s.radius + WALL_THICKNESS, canvas.height - s.radius - WALL_THICKNESS);
                resolveObstacleCollision(s);

                if (!player.isDead && !player.isInvisible && getDist(s, player) < s.radius + player.radius) {
                    player.hp -= SLIME_TEMAS_HASAR;
                    addFloatingNumber(player.x, player.y, SLIME_TEMAS_HASAR, "#e74c3c");
                    player.lastHitTime = Date.now();
                    s.hp = 0; s.temaslaOldu = true;
                }
            }

            // ---- Ağır bot mermileri ----
            for (let i = agirMermiler.length - 1; i >= 0; i--) {
                const m = agirMermiler[i];
                if (m.isDead) { agirMermiler.splice(i, 1); continue; }

                m.x += m.vx * ts;
                m.y += m.vy * ts;

                const mesafe = Math.hypot(m.x - m.sx, m.y - m.sy);

                // Ekran dışı
                if (m.x < WALL_THICKNESS || m.x > canvas.width - WALL_THICKNESS ||
                    m.y < WALL_THICKNESS || m.y > canvas.height - WALL_THICKNESS) {
                    if (m.isAna) { bolunAgirMermi(m); }
                    m.isDead = true; continue;
                }

                // Siper çarpışması
                let sipereCarpti = false;
                for (const o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(m, o) < o.radius + m.radius) {
                        o.hp -= (m.isAna ? 100 : 30);
                        sipereCarpti = true;
                        break;
                    }
                }
                if (sipereCarpti) {
                    if (m.isAna) { bolunAgirMermi(m); }
                    m.isDead = true; continue;
                }

                // Oyuncuya çarpma
                if (!player.isDead && getDist(m, player) < player.radius + m.radius) {
                    player.hp -= m.hasar;
                    rawDamageText(player.x, player.y, m.hasar, "#e74c3c");
                    player.lastHitTime = Date.now();
                    if (m.isAna) { bolunAgirMermi(m); }
                    m.isDead = true; continue;
                }

                // Menzil
                if (mesafe > m.menzil) {
                    if (m.isAna) { bolunAgirMermi(m); }
                    m.isDead = true; continue;
                }
            }

            // ---- Slime mermileri (düz, takipsiz) ----
            for (let i = slimeMermileri.length - 1; i >= 0; i--) {
                const m = slimeMermileri[i];
                if (m.isDead) { slimeMermileri.splice(i, 1); continue; }

                m.x += m.vx * ts;
                m.y += m.vy * ts;

                const mesafe = Math.hypot(m.x - m.sx, m.y - m.sy);
                if (mesafe > m.menzil) { m.isDead = true; continue; }

                if (m.x < WALL_THICKNESS || m.x > canvas.width - WALL_THICKNESS ||
                    m.y < WALL_THICKNESS || m.y > canvas.height - WALL_THICKNESS) {
                    m.isDead = true; continue;
                }

                let sipereCarpti = false;
                for (const o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(m, o) < o.radius + m.radius) {
                        o.hp -= 30;
                        rawDamageText(o.x, o.y, 30, "#e74c3c");
                        sipereCarpti = true;
                        break;
                    }
                }
                if (sipereCarpti) { m.isDead = true; continue; }

                if (!player.isDead && getDist(m, player) < player.radius + m.radius) {
                    player.hp -= m.hasar;
                    rawDamageText(player.x, player.y, m.hasar, "#e74c3c");
                    player.lastHitTime = Date.now();
                    m.isDead = true; continue;
                }
            }
        },

        onReset: function () {
            turuncuBot = null; respawnTimer = 0; spawnUyariTimer = 0;
            agirBot = null; agirRespawnTimer = 0; agirSpawnUyariTimer = 0;
            slimeBotlar = []; slimeSpawnTimer = 0; slimeSpawnUyarilari = [];
            agirMermiler = []; slimeMermileri = [];

            bot.isActive = true; bot.isDead = false; bot.hp = bot.maxHp;
            bot.x = canvas.width - 150; bot.y = 300; bot.kbX = bot.kbY = 0;
            bot2.isActive = false; bot2.isDead = true; bot2.hp = bot2.maxHp;
            bot2.respawnTimer = -9999;
            botsKilled = 0;
        }
    });

    function botSpawnHazirla() {
        spawnX = Math.random() * (canvas.width - 200) + 100;
        spawnY = Math.random() * (canvas.height - 200) + 100;
        spawnUyariTimer = BOT_SPAWN_WARN;
    }

    function agirBotSpawnHazirla() {
        agirSpawnX = Math.random() * (canvas.width - 200) + 100;
        agirSpawnY = Math.random() * (canvas.height - 200) + 100;
        agirSpawnUyariTimer = AGIR_SPAWN_WARN;
    }

    function dogurTuruncuBot() {
        turuncuBot = {
            x: spawnX, y: spawnY, radius: BOT_RADIUS,
            hp: BOT_HP, maxHp: BOT_HP,
            speed: 0, angle: 0, lastShot: 0, shootInterval: BOT_SHOOT_INTERVAL,
            isDead: false, isActive: true, color: '#e67e22', kbX: 0, kbY: 0
        };
        spawnParticles(turuncuBot.x, turuncuBot.y, '#e67e22', 'smoke');
    }

    function dogurAgirBot() {
        agirBot = {
            x: agirSpawnX, y: agirSpawnY, radius: AGIR_RADIUS,
            hp: AGIR_HP, maxHp: AGIR_HP,
            speed: 0, angle: 0, lastShot: 0, shootInterval: AGIR_SHOOT_INTERVAL,
            isDead: false, isActive: true, color: '#d35400', kbX: 0, kbY: 0
        };
        spawnParticles(agirBot.x, agirBot.y, '#d35400', 'smoke');
        // Spawn flash
        explosions.push({ x: agirBot.x, y: agirBot.y, radius: 10, maxRadius: 60, life: 15, maxLife: 15 });
    }

    function bolunAgirMermi(m) {
        // 4 parça, 9° aralıkla çapraz (toplam 27° yay, ortada ana mermi yönü)
        const centerOffset = (AGIR_PARCA_SAYISI - 1) / 2; // 1.5
        for (let i = 0; i < AGIR_PARCA_SAYISI; i++) {
            const offset = (i - centerOffset) * AGIR_PARCA_ARALIK;
            const a = m.angle + offset;
            agirMermiler.push({
                x: m.x, y: m.y, sx: m.x, sy: m.y,
                vx: Math.cos(a) * AGIR_PARCA_HIZ,
                vy: Math.sin(a) * AGIR_PARCA_HIZ,
                angle: a,
                radius: 6,
                hasar: AGIR_PARCA_HASAR,
                menzil: AGIR_PARCA_MENZIL,
                isAna: false,
                isDead: false
            });
        }
        // Bölünme efekti
        explosions.push({ x: m.x, y: m.y, radius: 5, maxRadius: 40, life: 10, maxLife: 10 });
    }

    function slimeDogur(x, y, stage) {
        const radius = SLIME_RADIUS[stage];
        slimeBotlar.push({
            x, y, radius, stage: stage,
            hp: SLIME_HP, maxHp: SLIME_HP,
            speed: SLIME_SPEED,
            angle: 0, isDead: false, isActive: true,
            color: '#e67e22', kbX: 0, kbY: 0, temaslaOldu: false
        });
    }

    function slimeMermiBirak(s) {
        // Tek mermi, boyutla orantılı, TAKİP ETMEZ (o anki bakış yönüne düz gider)
        const cfg = SLIME_MERMI[s.stage] || SLIME_MERMI[2];
        const a = s.angle || 0;
        slimeMermileri.push({
            x: s.x, y: s.y, sx: s.x, sy: s.y,
            vx: Math.cos(a) * cfg.hiz,
            vy: Math.sin(a) * cfg.hiz,
            radius: cfg.radius,
            hasar: cfg.hasar,
            menzil: cfg.menzil,
            color: cfg.color,
            isDead: false
        });
    }

    // ========== DÜŞMAN LİSTESİ ==========
    window.GAME_EXT.chainHook('getExtraEnemies', function () {
        if (window.GAME_MODE !== MOD_ID) return undefined;
        const liste = [];
        if (turuncuBot && !turuncuBot.isDead) liste.push(turuncuBot);
        if (agirBot && !agirBot.isDead) liste.push(agirBot);
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

        // Eski bot spawn uyarısı
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

        // Ağır bot spawn uyarısı — koyu kırmızı ALTIGEN
        if (agirSpawnUyariTimer > 0) {
            ctx2.save();
            ctx2.translate(agirSpawnX, agirSpawnY);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 100));
            ctx2.beginPath();
            const r = AGIR_RADIUS + 18;
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
                const px = Math.cos(a) * r;
                const py = Math.sin(a) * r;
                if (i === 0) ctx2.moveTo(px, py);
                else ctx2.lineTo(px, py);
            }
            ctx2.closePath();
            ctx2.strokeStyle = '#c0392b';
            ctx2.lineWidth = 4;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#c0392b';
            ctx2.font = "bold 20px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(agirSpawnUyariTimer / 60), 0, 7);
            // İç dolgu uyarı
            ctx2.globalAlpha = 0.25;
            ctx2.fillStyle = '#c0392b';
            ctx2.fill();
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

        // Eski bot
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

        // Yeni ağır bot — koyu turuncu altıgen + kalkan ikonu
        if (agirBot && !agirBot.isDead) {
            const b = agirBot;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            // HP barı (üstte ekstra)
            ctx2.fillStyle = '#7f1d1d';
            ctx2.fillRect(-30, -b.radius - 18, 60, 6);
            ctx2.fillStyle = '#c0392b';
            ctx2.fillRect(-30, -b.radius - 18, 60 * (b.hp / b.maxHp), 6);

            ctx2.rotate(b.angle);
            // Altıgen gövde
            ctx2.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const px = Math.cos(a) * b.radius;
                const py = Math.sin(a) * b.radius;
                if (i === 0) ctx2.moveTo(px, py);
                else ctx2.lineTo(px, py);
            }
            ctx2.closePath();
            ctx2.fillStyle = '#d35400';
            ctx2.fill();
            ctx2.strokeStyle = '#1a0a00';
            ctx2.lineWidth = 3;
            ctx2.stroke();

            // İç altıgen (kalkan plakası)
            ctx2.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const px = Math.cos(a) * (b.radius - 6);
                const py = Math.sin(a) * (b.radius - 6);
                if (i === 0) ctx2.moveTo(px, py);
                else ctx2.lineTo(px, py);
            }
            ctx2.closePath();
            ctx2.fillStyle = '#a04000';
            ctx2.fill();

            // Kalkan ikonu (ortada)
            ctx2.fillStyle = '#fff5e1';
            ctx2.beginPath();
            ctx2.moveTo(0, -8);
            ctx2.lineTo(-7, -4);
            ctx2.lineTo(-7, 4);
            ctx2.lineTo(0, 9);
            ctx2.lineTo(7, 4);
            ctx2.lineTo(7, -4);
            ctx2.closePath();
            ctx2.fill();
            ctx2.strokeStyle = '#5d4037';
            ctx2.lineWidth = 1.5;
            ctx2.stroke();
            ctx2.restore();
        }

        // Slime'lar
        slimeBotlar.forEach(s => {
            if (s.isDead) return;
            ctx2.save();
            ctx2.translate(s.x, s.y);
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-20, -s.radius - 15, 40, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-20, -s.radius - 15, 40 * (s.hp / s.maxHp), 5);
            ctx2.rotate(s.angle);
            ctx2.fillStyle = '#e67e22';
            ctx2.beginPath(); ctx2.arc(0, 0, s.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.fillStyle = '#a04000';
            ctx2.beginPath(); ctx2.arc(s.radius * 0.4, 0, s.radius * 0.55, 0, Math.PI * 2); ctx2.fill();
            ctx2.restore();
        });

        // Ağır bot mermileri
        agirMermiler.forEach(m => {
            if (m.isDead) return;
            ctx2.save();
            ctx2.translate(m.x, m.y);
            if (m.isAna) {
                ctx2.beginPath(); ctx2.arc(0, 0, m.radius + 4, 0, Math.PI * 2);
                ctx2.fillStyle = 'rgba(160, 64, 0, 0.3)'; ctx2.fill();
                ctx2.beginPath(); ctx2.arc(0, 0, m.radius, 0, Math.PI * 2);
                ctx2.fillStyle = '#a04000'; ctx2.fill();
                ctx2.strokeStyle = '#5d4037'; ctx2.lineWidth = 2; ctx2.stroke();
            } else {
                ctx2.beginPath(); ctx2.arc(0, 0, m.radius, 0, Math.PI * 2);
                ctx2.fillStyle = '#e67e22'; ctx2.fill();
                ctx2.strokeStyle = '#a04000'; ctx2.lineWidth = 1.5; ctx2.stroke();
            }
            ctx2.restore();
        });

        // Slime mermileri
        slimeMermileri.forEach(m => {
            if (m.isDead) return;
            ctx2.save();
            ctx2.translate(m.x, m.y);
            ctx2.beginPath(); ctx2.arc(0, 0, m.radius + 3, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(230, 126, 34, 0.25)'; ctx2.fill();
            ctx2.beginPath(); ctx2.arc(0, 0, m.radius, 0, Math.PI * 2);
            ctx2.fillStyle = m.color || '#e67e22'; ctx2.fill();
            ctx2.strokeStyle = '#5d4037'; ctx2.lineWidth = 1.5; ctx2.stroke();
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

    window.GAME_EXT.modKartiEkle('turuncu', 'Turuncu Baskın', 'Ağır bot + hafif bot + slime mermileri');

    console.log('[MOD YÜKLENDİ] turuncu (v3)');
})();