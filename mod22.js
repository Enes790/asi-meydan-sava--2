// ========== mod36.js — Bot Savaşı v5 (CoC Tarzı) ==========
// - Kapasite: 50 (sınırsız birlik, sadece değer sınırı)
// - Sayı seçimi (+/-)
// - Her tur setup (sayılar korunur, değiştirilebilir)
// - Yeni bot: AKINCI (dash + sersemletme)
// - Düşman tiplerinden bumerang ve turuncu çıkarıldı
(function () {
    'use strict';

    const MOD_ID = 'botbattle';
    const TOTAL_VALUE = 50;

    const STATS = {
        slime:   { name:'Slime',   value:5, hp:1200, dmg:150, speed:1.6, radius:16, color:'#2ecc71', isContact:true },
        mor:     { name:'Mor',     value:2, hp:1200, dmg:300, speed:1.5, radius:14, color:'#9b59b6', range:280, interval:1400 },
        tur:     { name:'Turuncu', value:2, hp:1000, dmg:350, speed:0,   radius:16, color:'#e67e22', range:300, interval:1200 },
        boom:    { name:'Bumerang',value:4, hp:1200, dmg:250, speed:1.2, radius:14, color:'#00ced1', range:350, interval:1600 },
        fog:     { name:'Sis',     value:3, hp:1800, dmg:200, speed:0.8, radius:18, color:'#7f8c8d', range:260, interval:1600 },
        armored: { name:'Zırhlı',  value:4, hp:1600, dmg:280, speed:0.8, radius:16, color:'#7c5c9a', range:320, interval:1800, shield:600 },
        growing: { name:'Büyüyen', value:4, hp:1200, dmg:250, speed:1.0, radius:14, color:'#7a1f2b', range:280, interval:1400 },
        dasher:  { name:'Akıncı',  value:3, hp:1300, dmg:400, speed:0.8, radius:14, color:'#e74c3c', isDasher:true }
    };

    const TYPES = Object.keys(STATS);

    const ENEMY_ROUNDS = [
        { types:['slime','slime','mor','dasher'],               hpMult:1.0 },
        { types:['mor','dasher','fog','slime'],                 hpMult:1.15 },
        { types:['dasher','armored','growing','mor'],           hpMult:1.3 },
        { types:['armored','growing','fog','dasher','mor'],     hpMult:1.5 },
        { types:['armored','armored','growing','growing','fog','dasher'], hpMult:1.75 }
    ];

    let allyTeam = [], enemyTeam = [];
    let allyBullets = [], enemyBullets = [];
    let allyKills = 0, enemyKills = 0;
    let roundIndex = 0, battleActive = false, introTimer = 0;
    let setupOverlay = null, readyPressed = false;

    // Kapasite sistemi — sayılar
    let armyCounts = {};
    TYPES.forEach(t => armyCounts[t] = 0);

    // Siper spawn engelle
    if (!window._bbOrigSpawnObs) {
        window._bbOrigSpawnObs = window.spawnObstacle;
        window.spawnObstacle = function() {
            if (window.GAME_MODE === MOD_ID) return;
            return window._bbOrigSpawnObs.call(this);
        };
    }

    function totalValue() {
        let v = 0;
        for (const t in armyCounts) v += armyCounts[t] * STATS[t].value;
        return v;
    }
    function totalUnits() {
        let n = 0;
        for (const t in armyCounts) n += armyCounts[t];
        return n;
    }

    function spawnBot(type, x, y, team, hpMult, stage) {
        const s = STATS[type];
        let hp = Math.floor(s.hp * hpMult);
        let radius = s.radius;
        let dmg = s.dmg;
        if (type === 'slime' && stage !== undefined) {
            const r = [16,12,8], h = [1.0,0.5,0.25], d = [1.0,0.7,0.5];
            radius = r[stage]; hp = Math.floor(s.hp*hpMult*h[stage]); dmg = Math.floor(s.dmg*d[stage]);
        }
        return {
            type, team, x, y, hp, maxHp: hp, damage: dmg,
            speed: s.speed, radius, color: s.color,
            range: s.range || 0, interval: s.interval || 0,
            lastShot: 0, isDead: false, angle: 0,
            _stage: type === 'slime' ? (stage || 0) : -1,
            _shield: s.shield || 0, _maxShield: s.shield || 0,
            _healTimer: 0, _growLevel: 0,
            _baseRadius: radius, _baseDmg: dmg, _baseHp: hp,
            _atkCD: 0, _stunTimer: 0,
            _dashState: 'idle', _dashTimer: 0, _dashVX: 0, _dashVY: 0
        };
    }

    function hideAllButtons() {
        ['ulti-btn','gadget-btn','gadget-btn-2','left-joystick','right-joystick'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    function showSetup() {
        if (setupOverlay) setupOverlay.remove();
        setupOverlay = document.createElement('div');
        setupOverlay.id = 'botbattle-setup';
        setupOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,20,0.97);z-index:150;display:flex;flex-direction:column;align-items:center;padding:14px;overflow-y:auto;gap:10px;';

        const title = document.createElement('h1');
        title.textContent = `TUR ${roundIndex + 1} — ORDUNU KUR`;
        title.style.cssText = 'color:#f1c40f;font-size:22px;margin:0;text-align:center;';
        setupOverlay.appendChild(title);

        const info = document.createElement('div');
        info.id = 'bb-info';
        info.style.cssText = 'color:#fff;font-size:15px;margin:0;text-align:center;padding:8px 18px;background:rgba(255,255,255,0.08);border-radius:10px;font-weight:bold;';
        setupOverlay.appendChild(info);

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:8px;width:100%;max-width:520px;';

        TYPES.forEach(type => {
            const s = STATS[type];
            const card = document.createElement('div');
            card.style.cssText = `background:linear-gradient(135deg,#1e293b,#0f172a);border:3px solid ${s.color};border-radius:12px;padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;`;

            const nameEl = document.createElement('div');
            nameEl.textContent = s.name;
            nameEl.style.cssText = `color:${s.color};font-weight:bold;font-size:14px;`;
            card.appendChild(nameEl);

            const statEl = document.createElement('div');
            statEl.textContent = `${s.hp}hp • ${s.dmg}dmg • ${s.value}p`;
            statEl.style.cssText = 'color:#aaa;font-size:10px;text-align:center;';
            card.appendChild(statEl);

            const ctrlRow = document.createElement('div');
            ctrlRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:4px;';

            const minusBtn = document.createElement('button');
            minusBtn.textContent = '−';
            minusBtn.style.cssText = 'width:34px;height:34px;border-radius:50%;background:#c0392b;color:#fff;border:2px solid #fff;font-size:20px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;';
            minusBtn.addEventListener('click', () => {
                if (armyCounts[type] > 0) {
                    armyCounts[type]--;
                    renderInfo();
                }
            });

            const countEl = document.createElement('div');
            countEl.id = 'bb-count-' + type;
            countEl.textContent = armyCounts[type];
            countEl.style.cssText = 'color:#fff;font-weight:bold;font-size:20px;min-width:36px;text-align:center;';

            const plusBtn = document.createElement('button');
            plusBtn.textContent = '+';
            plusBtn.style.cssText = 'width:34px;height:34px;border-radius:50%;background:#27ae60;color:#fff;border:2px solid #fff;font-size:20px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;';
            plusBtn.addEventListener('click', () => {
                if (totalValue() + s.value > TOTAL_VALUE) {
                    info.textContent = '⚠ Kapasite dolu!';
                    info.style.color = '#e74c3c';
                    setTimeout(renderInfo, 800);
                    return;
                }
                armyCounts[type]++;
                renderInfo();
            });

            ctrlRow.appendChild(minusBtn);
            ctrlRow.appendChild(countEl);
            ctrlRow.appendChild(plusBtn);
            card.appendChild(ctrlRow);
            grid.appendChild(card);
        });
        setupOverlay.appendChild(grid);

        const readyBtn = document.createElement('button');
        readyBtn.id = 'bb-ready';
        readyBtn.style.cssText = 'padding:14px 60px;font-size:18px;font-weight:bold;background:#2ecc71;color:#fff;border:none;border-radius:10px;cursor:pointer;margin-top:8px;';
        readyBtn.addEventListener('click', () => {
            if (totalUnits() > 0) {
                readyPressed = true;
                setupOverlay.remove(); setupOverlay = null;
                startRound();
            }
        });
        setupOverlay.appendChild(readyBtn);

        function renderInfo() {
            const v = totalValue();
            const n = totalUnits();
            info.textContent = `Kapasite: ${v} / ${TOTAL_VALUE}  •  Birlik: ${n}`;
            info.style.color = v > TOTAL_VALUE * 0.9 ? '#f1c40f' : '#fff';
            TYPES.forEach(t => {
                const el = document.getElementById('bb-count-' + t);
                if (el) el.textContent = armyCounts[t];
            });
            readyBtn.textContent = `SAVAŞ! (${n} birlik)`;
            readyBtn.disabled = n === 0;
            readyBtn.style.opacity = n === 0 ? '0.4' : '1';
        }
        renderInfo();
        document.body.appendChild(setupOverlay);
    }

    function startRound() {
        if (roundIndex >= ENEMY_ROUNDS.length) { victory(); return; }
        const r = ENEMY_ROUNDS[roundIndex];
        allyTeam = []; enemyTeam = []; allyBullets = []; enemyBullets = [];
        allyKills = 0; enemyKills = 0;

        const allyX = canvas.width * 0.22;
        const enemyX = canvas.width * 0.78;

        // Ally takım — sayıya göre
        let idx = 0;
        const totalAlly = totalUnits();
        TYPES.forEach(type => {
            for (let k = 0; k < armyCounts[type]; k++) {
                const y = canvas.height * (idx + 1) / (totalAlly + 1);
                allyTeam.push(spawnBot(type, allyX + (Math.random()-0.5)*60, y, 'ally', 1.0));
                idx++;
            }
        });

        // Enemy takım
        r.types.forEach((type, i) => {
            const y = canvas.height * (i + 1) / (r.types.length + 1);
            enemyTeam.push(spawnBot(type, enemyX + (Math.random()-0.5)*60, y, 'enemy', r.hpMult));
        });

        obstacles.length = 0;
        if (typeof cactusWalls !== 'undefined' && cactusWalls) cactusWalls.length = 0;

        battleActive = true;
        introTimer = 60;
        updateHUD();
    }

    function killBot(bot, team) {
        bot.isDead = true;
        if (!(bot.type === 'slime' && bot._stage > 0)) {
            if (team === 'ally') enemyKills++;
            else allyKills++;
        }
        if (bot.type === 'slime' && bot._stage < 2) {
            for (let k = 0; k < 2; k++) {
                const ang = Math.random() * Math.PI * 2;
                const child = spawnBot('slime',
                    clampPos(bot.x + Math.cos(ang)*30, WALL_THICKNESS+10, canvas.width-WALL_THICKNESS-10),
                    clampPos(bot.y + Math.sin(ang)*30, WALL_THICKNESS+10, canvas.height-WALL_THICKNESS-10),
                    bot.team, 1.0, bot._stage + 1);
                if (bot.team === 'ally') allyTeam.push(child);
                else enemyTeam.push(child);
            }
        }
    }

    function updateTeamAI(team, targetTeam, bulletArr, ts) {
        team.forEach(bot => {
            if (bot.isDead) return;
            if (bot.hp <= 0) { killBot(bot, bot.team); return; }
            if (introTimer > 0) return;

            // Stun
            if (bot._stunTimer > 0) {
                bot._stunTimer -= ts;
                return;
            }

            let target = null, minD = Infinity;
            targetTeam.forEach(e => {
                if (e.isDead) return;
                const d = getDist(bot, e);
                if (d < minD) { minD = d; target = e; }
            });
            if (!target) return;

            bot.angle = Math.atan2(target.y - bot.y, target.x - bot.x);

            // ===== AKINCI (DASHER) ÖZEL =====
            if (bot.type === 'dasher') {
                if (bot._dashState === 'idle') {
                    if (minD < 200 && minD > 60) {
                        bot._dashState = 'charging';
                        bot._dashTimer = 15;
                    } else if (minD > 60) {
                        bot.x += Math.cos(bot.angle) * bot.speed * ts;
                        bot.y += Math.sin(bot.angle) * bot.speed * ts;
                    }
                } else if (bot._dashState === 'charging') {
                    bot._dashTimer -= ts;
                    if (bot._dashTimer <= 0) {
                        bot._dashState = 'dashing';
                        bot._dashTimer = 20;
                        bot._dashVX = Math.cos(bot.angle) * 8;
                        bot._dashVY = Math.sin(bot.angle) * 8;
                    }
                } else if (bot._dashState === 'dashing') {
                    bot.x += bot._dashVX * ts;
                    bot.y += bot._dashVY * ts;
                    bot._dashTimer -= ts;

                    for (const t of targetTeam) {
                        if (t.isDead) continue;
                        if (getDist(bot, t) < bot.radius + t.radius + 10) {
                            let dmg = bot.damage;
                            if (t._shield > 0) {
                                const a = Math.min(t._shield, dmg);
                                t._shield -= a; dmg -= a;
                            }
                            if (dmg > 0) {
                                t.hp -= dmg;
                                addFloatingNumber(t.x, t.y, dmg, bot.color);
                            }
                            t._stunTimer = Math.max(t._stunTimer || 0, 40);
                            bot._dashState = 'recover';
                            bot._dashTimer = 90;
                            break;
                        }
                    }
                    if (bot._dashTimer <= 0 && bot._dashState === 'dashing') {
                        bot._dashState = 'recover';
                        bot._dashTimer = 90;
                    }
                } else if (bot._dashState === 'recover') {
                    bot._dashTimer -= ts;
                    if (bot._dashTimer <= 0) bot._dashState = 'idle';
                }

                bot.x = clampPos(bot.x, bot.radius + WALL_THICKNESS, canvas.width - bot.radius - WALL_THICKNESS);
                bot.y = clampPos(bot.y, bot.radius + WALL_THICKNESS, canvas.height - bot.radius - WALL_THICKNESS);
                return;
            }

            const attackRange = bot.type === 'slime' ? bot.radius + target.radius + 3 : bot.range;

            if (bot.speed > 0 && minD > attackRange) {
                bot.x += Math.cos(bot.angle) * bot.speed * ts;
                bot.y += Math.sin(bot.angle) * bot.speed * ts;
            }

            if (bot.type === 'slime') {
                if (minD < bot.radius + target.radius + 3 && bot._atkCD <= 0) {
                    let dmg = bot.damage;
                    if (target._shield > 0) {
                        const a = Math.min(target._shield, dmg);
                        target._shield -= a; dmg -= a;
                    }
                    if (dmg > 0) {
                        target.hp -= dmg;
                        addFloatingNumber(target.x, target.y, dmg, bot.color);
                    }
                    bot._atkCD = 30;
                }
                if (bot._atkCD > 0) bot._atkCD -= ts;
            } else if (minD < bot.range && Date.now() - bot.lastShot > bot.interval) {
                bot.lastShot = Date.now();
                if (bot.type === 'boom') {
                    bulletArr.push({
                        x: bot.x, y: bot.y, sx: bot.x, sy: bot.y,
                        vx: Math.cos(bot.angle) * BOT_BULLET_SPEED,
                        vy: Math.sin(bot.angle) * BOT_BULLET_SPEED,
                        team: bot.team, damage: bot.damage,
                        _boom: true, _owner: bot, _hit: new Set(),
                        _traveled: 0, _returning: false
                    });
                } else {
                    bulletArr.push({
                        x: bot.x, y: bot.y,
                        vx: Math.cos(bot.angle) * BOT_BULLET_SPEED,
                        vy: Math.sin(bot.angle) * BOT_BULLET_SPEED,
                        team: bot.team, damage: bot.damage
                    });
                }
            }

            if (bot.type === 'armored') {
                if (bot._shield < bot._maxShield) bot._shield = Math.min(bot._maxShield, bot._shield + 30 * ts);
                bot._healTimer = (bot._healTimer || 0) + ts;
                if (bot._healTimer >= 60) { bot._healTimer = 0; bot.hp = Math.min(bot.maxHp, bot.hp + 200); }
            }

            if (bot.type === 'growing') {
                const kills = bot.team === 'ally' ? allyKills : enemyKills;
                const lvl = kills >= 6 ? 2 : kills >= 3 ? 1 : 0;
                if (lvl !== bot._growLevel) {
                    bot._growLevel = lvl;
                    const mult = 1 + lvl * 0.3;
                    bot.maxHp = Math.floor(bot._baseHp * mult);
                    bot.hp = Math.min(bot.maxHp, bot.hp + Math.floor(bot._baseHp * 0.3));
                    bot.damage = Math.floor(bot._baseDmg * mult);
                    bot.radius = Math.floor(bot._baseRadius * (1 + lvl * 0.2));
                }
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

            if (b._boom) {
                b._traveled = (b._traveled || 0) + Math.hypot(b.vx, b.vy) * ts;
                if (!b._returning && b._traveled > 250) {
                    b._returning = true;
                    b._hit = new Set();
                }
                if (b._returning && b._owner && !b._owner.isDead) {
                    const ang = Math.atan2(b._owner.y - b.y, b._owner.x - b.x);
                    b.vx = Math.cos(ang) * BOT_BULLET_SPEED;
                    b.vy = Math.sin(ang) * BOT_BULLET_SPEED;
                    if (getDist(b, b._owner) < 20) { bullets.splice(i, 1); continue; }
                } else if (b._returning && (!b._owner || b._owner.isDead)) {
                    bullets.splice(i, 1); continue;
                }
            }

            if (b.x < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS ||
                b.y < WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) {
                if (!b._boom || b._returning) bullets.splice(i, 1);
                continue;
            }

            let hit = false;
            for (const t of targetTeam) {
                if (t.isDead) continue;
                if (b._hit && b._hit.has(t)) continue;
                if (getDist(b, t) < t.radius + 8) {
                    let dmg = b.damage;
                    if (t._shield > 0) {
                        const absorbed = Math.min(t._shield, dmg);
                        t._shield -= absorbed;
                        dmg -= absorbed;
                    }
                    if (dmg > 0) {
                        t.hp -= dmg;
                        addFloatingNumber(t.x, t.y, dmg, b.team === 'ally' ? '#2ecc71' : '#e74c3c');
                    }
                    if (b._boom) b._hit.add(t);
                    else hit = true;
                    break;
                }
            }
            if (hit) bullets.splice(i, 1);
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
        let h = document.getElementById('bb-hud');
        if (!h) {
            h = document.createElement('div');
            h.id = 'bb-hud';
            h.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);padding:8px 20px;border-radius:20px;color:#f1c40f;font-weight:bold;font-size:15px;z-index:50;pointer-events:none;text-align:center;';
            document.body.appendChild(h);
        }
        h.style.display = 'block';
        const aA = allyTeam.filter(b => !b.isDead).length;
        const eA = enemyTeam.filter(b => !b.isDead).length;
        h.innerHTML = `TUR ${roundIndex+1}/${ENEMY_ROUNDS.length}<br><span style="font-size:12px;color:#2ecc71;">Sen: ${aA}</span> <span style="font-size:12px;color:#aaa;">vs</span> <span style="font-size:12px;color:#e74c3c;">Düşman: ${eA}</span>`;
    }

    window.GAME_EXT.registerMode(MOD_ID, {
        label: 'Bot Savaşı',
        onStart: function () {
            roundIndex = 0; battleActive = false; introTimer = 0; readyPressed = false;
            allyTeam = []; enemyTeam = []; allyBullets = []; enemyBullets = [];
            TYPES.forEach(t => armyCounts[t] = 0);
            hideAllButtons();
            player.x = canvas.width/2; player.y = canvas.height/2;
            player.hp = player.maxHp = 999999;
            player.isInvisible = true; player.jumpInvulnerable = true;
            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = []; stationaryBots = []; boomerangBots = []; fogBots = [];
            nests = []; spawnIndicators = []; obstacles.length = 0;
            const hud = document.getElementById('bb-hud'); if (hud) hud.style.display = 'none';
            showSetup();
        },
        onUpdate: function (ts) {
            if (window.GAME_MODE !== MOD_ID) return;
            player.hp = player.maxHp;
            player.isInvisible = true; player.jumpInvulnerable = true;
            hideAllButtons();
            slimeTimer = 0; stationaryTimer = 0; boomerangTimer = 0; fogBotTimer = 0;
            spawnIndicators = [];
            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            obstacles.length = 0;
            if (!readyPressed || window.GAME_PAUSED) return;
            if (introTimer > 0) { introTimer -= ts; return; }
            if (!battleActive) return;

            updateTeamAI(allyTeam, enemyTeam, allyBullets, ts);
            updateTeamAI(enemyTeam, allyTeam, enemyBullets, ts);
            updateBullets(allyBullets, enemyTeam, ts);
            updateBullets(enemyBullets, allyTeam, ts);

            const aA = allyTeam.filter(b => !b.isDead).length;
            const eA = enemyTeam.filter(b => !b.isDead).length;

            if (eA === 0) {
                battleActive = false; roundIndex++;
                if (roundIndex >= ENEMY_ROUNDS.length) setTimeout(victory, 500);
                else { readyPressed = false; setTimeout(showSetup, 800); }
                updateHUD();
            } else if (aA === 0) {
                battleActive = false; setTimeout(defeat, 500);
            } else updateHUD();
        },
        onReset: function () {
            allyTeam = []; enemyTeam = []; allyBullets = []; enemyBullets = [];
            roundIndex = 0; battleActive = false; introTimer = 0; readyPressed = false;
            TYPES.forEach(t => armyCounts[t] = 0);
            const h = document.getElementById('bb-hud'); if (h) h.style.display = 'none';
            if (setupOverlay) { setupOverlay.remove(); setupOverlay = null; }
        }
    });

    const blockPlayer = fn => function (...args) {
        if (window.GAME_MODE === MOD_ID) return;
        return fn.apply(this, args);
    };
    Player.prototype.fire = blockPlayer(Player.prototype.fire);
    Player.prototype.fireUlti = blockPlayer(Player.prototype.fireUlti);
    Player.prototype.activateGadget = blockPlayer(Player.prototype.activateGadget);
    Player.prototype.activateGadget2 = blockPlayer(Player.prototype.activateGadget2);

    if (!window._bbOrigDraw) {
        window._bbOrigDraw = window.drawEntity;
        window.drawEntity = function (e, isP) {
            if (!e) return;
            if (isP && window.GAME_MODE === MOD_ID) return;
            return window._bbOrigDraw.call(this, e, isP);
        };
    }

    window.GAME_EXT.chainHook('onDraw', function (ctx) {
        if (window.GAME_MODE !== MOD_ID || !gameStarted) return;
        [...allyTeam, ...enemyTeam].forEach(bot => {
            if (bot.isDead) return;
            ctx.save(); ctx.translate(bot.x, bot.y);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(0, bot.radius*0.4, bot.radius*0.9, bot.radius*0.35, 0, 0, Math.PI*2); ctx.fill();
            if (bot._shield > 0) {
                ctx.save();
                ctx.beginPath(); ctx.arc(0, 0, bot.radius + 6, 0, Math.PI*2);
                ctx.strokeStyle = `rgba(96,165,250,${0.3 + 0.5*bot._shield/bot._maxShield})`;
                ctx.lineWidth = 3; ctx.stroke();
                ctx.restore();
            }
            if (bot._stunTimer > 0) {
                ctx.save();
                ctx.globalAlpha = 0.5 + Math.sin(Date.now()/100)*0.3;
                ctx.beginPath(); ctx.arc(0, 0, bot.radius + 4, 0, Math.PI*2);
                ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2; ctx.stroke();
                ctx.restore();
            }
            if (bot.type === 'dasher' && bot._dashState === 'charging') {
                ctx.save();
                ctx.globalAlpha = 0.5;
                ctx.beginPath(); ctx.arc(0, 0, bot.radius + 10, 0, Math.PI*2);
                ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2; ctx.setLineDash([4,4]); ctx.stroke();
                ctx.restore();
            }
            ctx.rotate(bot.angle);
            ctx.fillStyle = bot.color;
            ctx.beginPath(); ctx.arc(0, 0, bot.radius, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = bot.team === 'ally' ? '#2ecc71' : '#e74c3c'; ctx.lineWidth = 2.5; ctx.stroke();
            ctx.beginPath(); ctx.arc(bot.radius-4, 0, Math.min(5, bot.radius*0.4), 0, Math.PI*2);
            ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.fillStyle = '#444'; ctx.fillRect(bot.x-15, bot.y-bot.radius-10, 30, 4);
            ctx.fillStyle = bot.team === 'ally' ? '#2ecc71' : '#e74c3c';
            ctx.fillRect(bot.x-15, bot.y-bot.radius-10, 30*Math.max(0, bot.hp/bot.maxHp), 4);
            ctx.restore();
        });
        allyBullets.forEach(b => {
            ctx.save();
            ctx.fillStyle = b._boom ? '#00ced1' : '#2ecc71';
            ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
        });
        enemyBullets.forEach(b => {
            ctx.save();
            ctx.fillStyle = b._boom ? '#00ced1' : '#e74c3c';
            ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
        });
        if (introTimer > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, (60-introTimer)/30);
            ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 48px Arial'; ctx.textAlign = 'center';
            ctx.fillText('TUR ' + (roundIndex+1), canvas.width/2, canvas.height/2);
            ctx.font = 'bold 24px Arial'; ctx.fillStyle = '#fff';
            ctx.fillText('HAZIR OL!', canvas.width/2, canvas.height/2+40);
            ctx.restore();
        }
    });

    window.GAME_EXT.modKartiEkle('botbattle', 'Bot Savaşı', 'CoC tarzı ordu kur — kapasite 50');
    console.log('[MOD YÜKLENDİ] botbattle v5');
})();