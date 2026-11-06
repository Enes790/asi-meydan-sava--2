// ========== mod36.js — Bot Savaşı (Auto-Battler) ==========
// Oyuncu yok, sadece 5v5 botlar otomatik savaşıyor. 5 tur.
(function () {
    'use strict';

    const MOD_ID = 'botbattle';

    const STATS = {
        slime:   { hp: 1200, dmg: 200, speed: 1.6, radius: 14, color: '#2ecc71', range: 200, interval: 1200 },
        mor:     { hp: 1400, dmg: 300, speed: 1.5, radius: 16, color: '#9b59b6', range: 280, interval: 1400 },
        tur:     { hp: 1200, dmg: 350, speed: 0,   radius: 18, color: '#e67e22', range: 300, interval: 1200 },
        boom:    { hp: 1300, dmg: 250, speed: 1.2, radius: 15, color: '#00ced1', range: 350, interval: 1600 },
        fog:     { hp: 2000, dmg: 200, speed: 0.8, radius: 20, color: '#7f8c8d', range: 260, interval: 1600 },
        armored: { hp: 2200, dmg: 280, speed: 0.8, radius: 18, color: '#7c5c9a', range: 320, interval: 1800 },
        growing: { hp: 1400, dmg: 260, speed: 1.0, radius: 15, color: '#7a1f2b', range: 280, interval: 1400 }
    };

    const ROUNDS = [
        { ally: ['slime', 'slime', 'mor', 'tur', 'boom'],    enemy: ['slime', 'mor', 'mor', 'tur', 'boom'],    hpMult: 1.0 },
        { ally: ['mor', 'tur', 'boom', 'fog', 'slime'],      enemy: ['mor', 'tur', 'boom', 'fog', 'mor'],      hpMult: 1.15 },
        { ally: ['tur', 'armored', 'growing', 'boom', 'mor'],enemy: ['tur', 'armored', 'growing', 'boom', 'mor'],hpMult: 1.3 },
        { ally: ['armored', 'growing', 'fog', 'tur', 'boom'],enemy: ['armored', 'growing', 'fog', 'tur', 'boom'],hpMult: 1.5 },
        { ally: ['armored', 'armored', 'growing', 'growing', 'fog'], enemy: ['armored', 'armored', 'growing', 'growing', 'fog'], hpMult: 1.75 }
    ];

    let allyTeam = [];
    let enemyTeam = [];
    let allyBullets = [];
    let enemyBullets = [];
    let roundIndex = 0;
    let battleActive = false;
    let introTimer = 0;

    function spawnBot(type, x, y, team, hpMult) {
        const s = STATS[type];
        const hp = Math.floor(s.hp * hpMult);
        return {
            type, team, x, y, hp, maxHp: hp,
            damage: s.dmg, speed: s.speed, radius: s.radius,
            color: s.color, range: s.range, interval: s.interval,
            lastShot: 0, isDead: false, angle: 0
        };
    }

    function startRound() {
        if (roundIndex >= ROUNDS.length) { victory(); return; }
        const r = ROUNDS[roundIndex];
        allyTeam = [];
        enemyTeam = [];
        allyBullets = [];
        enemyBullets = [];

        const allyX = canvas.width * 0.22;
        const enemyX = canvas.width * 0.78;

        r.ally.forEach((type, i) => {
            const y = canvas.height * (i + 1) / (r.ally.length + 1);
            allyTeam.push(spawnBot(type, allyX + (Math.random() - 0.5) * 60, y, 'ally', 1.0));
        });
        r.enemy.forEach((type, i) => {
            const y = canvas.height * (i + 1) / (r.enemy.length + 1);
            enemyTeam.push(spawnBot(type, enemyX + (Math.random() - 0.5) * 60, y, 'enemy', r.hpMult));
        });

        battleActive = true;
        introTimer = 60;
        updateHUD();
    }

    function updateTeamAI(team, targetTeam, bulletArray, ts) {
        team.forEach(bot => {
            if (bot.isDead || bot.hp <= 0) { bot.isDead = true; return; }
            if (introTimer > 0) return;

            let target = null, minD = Infinity;
            targetTeam.forEach(e => {
                if (e.isDead) return;
                const d = getDist(bot, e);
                if (d < minD) { minD = d; target = e; }
            });
            if (!target) return;

            bot.angle = Math.atan2(target.y - bot.y, target.x - bot.x);

            if (bot.speed > 0 && minD > bot.radius + target.radius + 20) {
                bot.x += Math.cos(bot.angle) * bot.speed * ts;
                bot.y += Math.sin(bot.angle) * bot.speed * ts;
            }

            if (minD < bot.range && Date.now() - bot.lastShot > bot.interval) {
                bot.lastShot = Date.now();
                bulletArray.push({
                    x: bot.x, y: bot.y,
                    vx: Math.cos(bot.angle) * BOT_BULLET_SPEED,
                    vy: Math.sin(bot.angle) * BOT_BULLET_SPEED,
                    team: bot.team, damage: bot.damage
                });
            }

            bot.x = clampPos(bot.x, bot.radius + WALL_THICKNESS, canvas.width - bot.radius - WALL_THICKNESS);
            bot.y = clampPos(bot.y, bot.radius + WALL_THICKNESS, canvas.height - bot.radius - WALL_THICKNESS);
        });
    }

    function updateBullets(bullets, targetTeam, ts) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += b.vx * ts;
            b.y += b.vy * ts;

            if (b.x < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS ||
                b.y < WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) {
                bullets.splice(i, 1); continue;
            }

            let hitObs = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(b, o) < o.radius + 5) { hitObs = true; break; }
            }
            if (hitObs) { bullets.splice(i, 1); continue; }

            for (const t of targetTeam) {
                if (t.isDead) continue;
                if (getDist(b, t) < t.radius + 8) {
                    t.hp -= b.damage;
                    addFloatingNumber(t.x, t.y, b.damage, b.team === 'ally' ? '#2ecc71' : '#e74c3c');
                    bullets.splice(i, 1);
                    break;
                }
            }
        }
    }

    function victory() {
        window.GAME_PAUSED = true;
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:200;display:flex;flex-direction:column;justify-content:center;align-items:center;';
        ov.innerHTML = '<h1 style="color:#f1c40f;font-size:52px;">ZAFER!</h1><p style="color:#fff;font-size:20px;margin:20px 0 30px;">Tüm turlar kazanıldı!</p><button onclick="location.reload()" style="padding:15px 40px;font-size:18px;background:#2ecc71;color:#fff;border:none;border-radius:10px;cursor:pointer;">Yeniden Başla</button>';
        document.body.appendChild(ov);
    }

    function defeat() {
        window.GAME_PAUSED = true;
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:200;display:flex;flex-direction:column;justify-content:center;align-items:center;';
        ov.innerHTML = '<h1 style="color:#e74c3c;font-size:52px;">YENİLGİ</h1><p style="color:#fff;font-size:20px;margin:20px 0 30px;">Ordun yok edildi!</p><button onclick="location.reload()" style="padding:15px 40px;font-size:18px;background:#e74c3c;color:#fff;border:none;border-radius:10px;cursor:pointer;">Yeniden Başla</button>';
        document.body.appendChild(ov);
    }

    function updateHUD() {
        let h = document.getElementById('botbattle-hud');
        if (!h) {
            h = document.createElement('div');
            h.id = 'botbattle-hud';
            h.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);padding:8px 20px;border-radius:20px;color:#f1c40f;font-weight:bold;font-size:15px;z-index:50;pointer-events:none;display:none;text-align:center;';
            document.body.appendChild(h);
        }
        h.style.display = 'block';
        const allyAlive = allyTeam.filter(b => !b.isDead).length;
        const enemyAlive = enemyTeam.filter(b => !b.isDead).length;
        h.innerHTML = `TUR ${roundIndex + 1} / ${ROUNDS.length}<br><span style="font-size:12px;color:#2ecc71;">Sen: ${allyAlive}</span> <span style="font-size:12px;color:#aaa;">vs</span> <span style="font-size:12px;color:#e74c3c;">Düşman: ${enemyAlive}</span>`;
    }

    window.GAME_EXT.registerMode(MOD_ID, {
        label: 'Bot Savaşı',
        onStart: function () {
            roundIndex = 0;
            battleActive = false;
            introTimer = 0;
            allyTeam = [];
            enemyTeam = [];
            allyBullets = [];
            enemyBullets = [];

            const lj = document.getElementById('left-joystick');
            const rj = document.getElementById('right-joystick');
            if (lj) lj.style.display = 'none';
            if (rj) rj.style.display = 'none';
            if (gadgetBtn) gadgetBtn.style.display = 'none';
            if (gadgetBtn2) gadgetBtn2.style.display = 'none';
            if (ultiBtn) ultiBtn.style.display = 'none';

            player.x = canvas.width / 2;
            player.y = canvas.height / 2;
            player.hp = player.maxHp = 999999;
            player.isInvisible = true;
            player.jumpInvulnerable = true;

            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = []; stationaryBots = []; boomerangBots = []; fogBots = [];
            nests = []; spawnIndicators = [];

            startRound();
        },
        onUpdate: function (ts) {
            if (window.GAME_MODE !== MOD_ID || window.GAME_PAUSED) return;

            player.hp = player.maxHp;
            player.isInvisible = true;
            player.jumpInvulnerable = true;

            slimeTimer = 0; stationaryTimer = 0; boomerangTimer = 0; fogBotTimer = 0;
            spawnIndicators = [];

            if (introTimer > 0) {
                introTimer -= ts;
                return;
            }
            if (!battleActive) return;

            updateTeamAI(allyTeam, enemyTeam, allyBullets, ts);
            updateTeamAI(enemyTeam, allyTeam, enemyBullets, ts);
            updateBullets(allyBullets, enemyTeam, ts);
            updateBullets(enemyBullets, allyTeam, ts);

            const allyAlive = allyTeam.filter(b => !b.isDead).length;
            const enemyAlive = enemyTeam.filter(b => !b.isDead).length;

            if (enemyAlive === 0) {
                battleActive = false;
                roundIndex++;
                if (roundIndex >= ROUNDS.length) setTimeout(victory, 500);
                else setTimeout(startRound, 1000);
                updateHUD();
            } else if (allyAlive === 0) {
                battleActive = false;
                setTimeout(defeat, 500);
            } else {
                updateHUD();
            }
        },
        onReset: function () {
            allyTeam = []; enemyTeam = [];
            allyBullets = []; enemyBullets = [];
            roundIndex = 0; battleActive = false; introTimer = 0;
            const h = document.getElementById('botbattle-hud');
            if (h) h.style.display = 'none';
        }
    });

    // Player metot override'ları
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (window.GAME_MODE === MOD_ID) return;
        return origFire.call(this, a, pull);
    };

    const origFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (window.GAME_MODE === MOD_ID) return;
        return origFireUlti.call(this, a, pull);
    };

    const origGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (window.GAME_MODE === MOD_ID) return;
        return origGadget.call(this, a, pull);
    };

    const origGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (window.GAME_MODE === MOD_ID) return;
        return origGadget2.call(this, a, pull);
    };

    // Player gizle
    if (!window._botbattleOrigDraw) {
        window._botbattleOrigDraw = window.drawEntity;
        window.drawEntity = function (e, isP) {
            if (!e) return;
            if (isP && window.GAME_MODE === MOD_ID) return;
            return window._botbattleOrigDraw.call(this, e, isP);
        };
    }

    window.GAME_EXT.chainHook('onDraw', function (ctx) {
        if (window.GAME_MODE !== MOD_ID || !gameStarted) return;

        [...allyTeam, ...enemyTeam].forEach(bot => {
            if (bot.isDead) return;
            ctx.save();
            ctx.translate(bot.x, bot.y);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(0, bot.radius * 0.4, bot.radius * 0.9, bot.radius * 0.35, 0, 0, Math.PI * 2); ctx.fill();
            ctx.rotate(bot.angle);
            ctx.fillStyle = bot.color;
            ctx.beginPath(); ctx.arc(0, 0, bot.radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = bot.team === 'ally' ? '#2ecc71' : '#e74c3c';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.beginPath(); ctx.arc(bot.radius - 4, 0, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.fillStyle = '#444';
            ctx.fillRect(bot.x - 15, bot.y - bot.radius - 10, 30, 4);
            ctx.fillStyle = bot.team === 'ally' ? '#2ecc71' : '#e74c3c';
            ctx.fillRect(bot.x - 15, bot.y - bot.radius - 10, 30 * Math.max(0, bot.hp / bot.maxHp), 4);
            ctx.restore();
        });

        allyBullets.forEach(b => {
            ctx.save();
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
            ctx.restore();
        });
        enemyBullets.forEach(b => {
            ctx.save();
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
            ctx.restore();
        });

        if (introTimer > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, (60 - introTimer) / 30);
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('TUR ' + (roundIndex + 1), canvas.width / 2, canvas.height / 2);
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#fff';
            ctx.fillText('HAZIR OL!', canvas.width / 2, canvas.height / 2 + 40);
            ctx.restore();
        }
    });

    window.GAME_EXT.modKartiEkle('botbattle', 'Bot Savaşı', 'Otomatik savaş — sadece izle');
    console.log('[MOD YÜKLENDİ] botbattle');
})();