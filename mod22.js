// ========== mod36.js — Bot Savaşı v6 (Serbest Yerleştirme) ==========
(function () {
    'use strict';

    const MOD_ID = 'botbattle';
    const TOTAL_VALUE = 15;
    const MAX_UNITS = 5;

    const STATS = {
        slime:   { name: 'Slime',   value: 5, hp: 1200, dmg: 150, speed: 1.6, radius: 16, color: '#2ecc71', isContact: true },
        mor:     { name: 'Mor',     value: 2, hp: 1200, dmg: 300, speed: 1.5, radius: 14, color: '#9b59b6', range: 280, interval: 1400 },
        tur:     { name: 'Turuncu', value: 2, hp: 1000, dmg: 350, speed: 0,   radius: 16, color: '#e67e22', range: 300, interval: 1200 },
        boom:    { name: 'Bumerang',value: 4, hp: 1200, dmg: 250, speed: 1.2, radius: 14, color: '#00ced1', range: 350, interval: 1600 },
        fog:     { name: 'Sis',     value: 3, hp: 1800, dmg: 200, speed: 0.8, radius: 18, color: '#7f8c8d', range: 260, interval: 1600 },
        armored: { name: 'Zırhlı',  value: 4, hp: 1600, dmg: 280, speed: 0.8, radius: 16, color: '#7c5c9a', range: 320, interval: 1800, shield: 600 },
        growing: { name: 'Büyüyen', value: 4, hp: 1200, dmg: 250, speed: 1.0, radius: 14, color: '#7a1f2b', range: 280, interval: 1400 },
        yuva:    { name: 'Yuva',    value: 5, hp: 800,  dmg: 0,   speed: 0,   radius: 20, color: '#27ae60', range: 0, interval: 999999, isSpawner: true },
        piyade:  { name: 'Piyade',  value: 3, hp: 1400, dmg: 400, speed: 1.8, radius: 15, color: '#d35400', range: 60, interval: 900 }
    };

    const TYPES = Object.keys(STATS);
    const ENEMY_ROUNDS = [
        { types: ['slime','slime','mor','tur'],                    hpMult: 1.0 },
        { types: ['mor','tur','boom','fog','piyade'],              hpMult: 1.15 },
        { types: ['tur','armored','growing','boom','piyade'],       hpMult: 1.3 },
        { types: ['armored','growing','fog','tur','boom','yuva'],  hpMult: 1.5 },
        { types: ['armored','armored','growing','growing','fog','yuva'],  hpMult: 1.75 }
    ];

    let allyTeam = [], enemyTeam = [];
    let allyBullets = [], enemyBullets = [];
    let allyKills = 0, enemyKills = 0;
    let roundIndex = 0, battleActive = false, introTimer = 0;

    // Setup state
    let setupOverlay = null;
    let selectedType = null;
    let placedPositions = [];
    let setupMode = false;

    if (!window._bbOrigSpawnObs) {
        window._bbOrigSpawnObs = window.spawnObstacle;
        window.spawnObstacle = function() {
            if (window.GAME_MODE === MOD_ID) return;
            return window._bbOrigSpawnObs.call(this);
        };
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
            _atkCD: 0, _spawnTimer: 0, _spawned: 0
        };
    }

    function hideAllButtons() {
        ['ulti-btn','gadget-btn','gadget-btn-2','left-joystick','right-joystick'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    function currentValue() {
        return placedPositions.reduce((s, p) => s + STATS[p.type].value, 0);
    }

    // ===== SETUP EKRANI =====
    function showSetup() {
        if (setupOverlay) setupOverlay.remove();
        placedPositions = [];
        selectedType = null;
        setupMode = true;

        setupOverlay = document.createElement('div');
        setupOverlay.id = 'botbattle-setup';
        setupOverlay.style.cssText = 'position:fixed;inset:0;background:linear-gradient(180deg, rgba(10,15,20,0.4) 0%, rgba(10,15,20,0.4) 40%, rgba(10,15,20,0.97) 55%, rgba(10,15,20,0.97) 100%);z-index:150;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:0;pointer-events:none;';

        // Üst bilgi
        const topInfo = document.createElement('div');
        topInfo.id = 'bb-top-info';
        topInfo.style.cssText = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);padding:10px 24px;border-radius:16px;color:#f1c40f;font-size:15px;font-weight:bold;text-align:center;pointer-events:none;border:2px solid rgba(241,196,15,0.3);';
        topInfo.innerHTML = `TUR ${roundIndex + 1} — <span style="color:#2ecc71;">${placedPositions.length}/${MAX_UNITS} birlik</span> • <span style="color:#f39c12;">${currentValue()}/${TOTAL_VALUE} değer</span>`;
        setupOverlay.appendChild(topInfo);

        // Alt panel
        const panel = document.createElement('div');
        panel.style.cssText = 'width:100%;background:rgba(10,15,20,0.98);border-top:3px solid #f1c40f;padding:12px 10px 20px;pointer-events:auto;display:flex;flex-direction:column;gap:8px;';

        // Seçili bilgi
        const hint = document.createElement('div');
        hint.id = 'bb-hint';
        hint.style.cssText = 'text-align:center;color:#aaa;font-size:13px;padding:4px;';
        hint.textContent = 'Alttan birlik seç, sonra sol tarafa dokun';
        panel.appendChild(hint);

        // Kart grid
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:5px;max-width:520px;width:100%;margin:0 auto;';

        TYPES.forEach(type => {
            const s = STATS[type];
            const card = document.createElement('div');
            card.dataset.type = type;
            card.style.cssText = `background:linear-gradient(135deg,#1e293b,#0f172a);border:2px solid ${s.color};border-radius:8px;padding:5px 3px;cursor:pointer;text-align:center;transition:all 0.15s;`;
            card.innerHTML = `<div style="color:#fff;font-weight:bold;font-size:10px;line-height:1.1;">${s.name}</div>
                <div style="color:#f39c12;font-size:9px;font-weight:bold;">${s.value}p</div>`;
            card.addEventListener('click', () => {
                if (currentValue() + s.value > TOTAL_VALUE) {
                    hint.textContent = '⚠ Değer limiti aşıldı!'; hint.style.color = '#e74c3c';
                    setTimeout(() => { hint.textContent = selectedType ? `${STATS[selectedType].name} seçili — sol tarafa dokun` : 'Alttan birlik seç, sonra sol tarafa dokun'; hint.style.color = '#aaa'; }, 900);
                    return;
                }
                if (placedPositions.length >= MAX_UNITS) {
                    hint.textContent = '⚠ Maks 5 birlik!'; hint.style.color = '#e74c3c';
                    setTimeout(() => { hint.textContent = 'Alttan birlik seç, sonra sol tarafa dokun'; hint.style.color = '#aaa'; }, 900);
                    return;
                }
                selectedType = type;
                document.querySelectorAll('#botbattle-setup [data-type]').forEach(c => {
                    c.style.transform = 'scale(1)';
                    c.style.boxShadow = 'none';
                });
                card.style.transform = 'scale(1.08)';
                card.style.boxShadow = `0 0 15px ${s.color}`;
                hint.textContent = `✓ ${s.name} seçili — sol tarafa dokun`;
                hint.style.color = s.color;
            });
            grid.appendChild(card);
        });
        panel.appendChild(grid);

        // SAVAŞ butonu
        const readyBtn = document.createElement('button');
        readyBtn.id = 'bb-ready';
        readyBtn.style.cssText = 'padding:12px 50px;font-size:16px;font-weight:bold;background:#2ecc71;color:#fff;border:none;border-radius:10px;cursor:pointer;margin-top:6px;align-self:center;opacity:0.4;';
        readyBtn.textContent = `SAVAŞ! (${placedPositions.length}/${MAX_UNITS})`;
        readyBtn.disabled = true;
        readyBtn.addEventListener('click', () => {
            if (placedPositions.length > 0) {
                setupMode = false;
                setupOverlay.remove(); setupOverlay = null;
                startRound();
            }
        });
        panel.appendChild(readyBtn);
        setupOverlay.appendChild(panel);

        document.body.appendChild(setupOverlay);

        // Canvas tıklama — bu sefer setup sırasında da aktif
        canvas.style.pointerEvents = 'auto';
        canvas.removeEventListener('touchstart', handlePlacementTouch);
        canvas.removeEventListener('click', handlePlacementClick);
        canvas.addEventListener('touchstart', handlePlacementTouch, { passive: false });
        canvas.addEventListener('click', handlePlacementClick);

        window._bbUpdateSetupUI = function() {
            const top = document.getElementById('bb-top-info');
            if (top) top.innerHTML = `TUR ${roundIndex + 1} — <span style="color:#2ecc71;">${placedPositions.length}/${MAX_UNITS} birlik</span> • <span style="color:#f39c12;">${currentValue()}/${TOTAL_VALUE} değer</span>`;
            const rb = document.getElementById('bb-ready');
            if (rb) {
                rb.textContent = `SAVAŞ! (${placedPositions.length}/${MAX_UNITS})`;
                rb.disabled = placedPositions.length === 0;
                rb.style.opacity = placedPositions.length === 0 ? '0.4' : '1';
            }
        };
    }

    function handlePlacementTouch(e) {
        if (!setupMode || !selectedType) return;
        e.preventDefault();
        const t = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const x = (t.clientX - rect.left) * (canvas.width / rect.width);
        const y = (t.clientY - rect.top) * (canvas.height / rect.height);
        placeAt(x, y);
    }

    function handlePlacementClick(e) {
        if (!setupMode || !selectedType) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        placeAt(x, y);
    }

    function placeAt(x, y) {
        const hint = document.getElementById('bb-hint');
        const maxX = canvas.width * 0.48;
        if (x > maxX) {
            if (hint) { hint.textContent = '⚠ Sadece SOL tarafa yerleştir!'; hint.style.color = '#e74c3c'; setTimeout(() => { hint.textContent = `✓ ${STATS[selectedType].name} seçili — sol tarafa dokun`; hint.style.color = STATS[selectedType].color; }, 900); }
            return;
        }
        if (placedPositions.length >= MAX_UNITS) {
            if (hint) { hint.textContent = '⚠ Maks 5 birlik!'; hint.style.color = '#e74c3c'; }
            return;
        }
        if (currentValue() + STATS[selectedType].value > TOTAL_VALUE) {
            if (hint) { hint.textContent = '⚠ Değer limiti aşıldı!'; hint.style.color = '#e74c3c'; }
            return;
        }
        if (x < WALL_THICKNESS + 25) x = WALL_THICKNESS + 25;
        if (y < WALL_THICKNESS + 25) y = WALL_THICKNESS + 25;
        if (y > canvas.height - WALL_THICKNESS - 25) y = canvas.height - WALL_THICKNESS - 25;

        placedPositions.push({ type: selectedType, x, y });
        window._bbUpdateSetupUI();
        if (hint) {
            hint.textContent = `✓ ${STATS[selectedType].name} yerleşti (${placedPositions.length}/${MAX_UNITS})`;
            hint.style.color = '#2ecc71';
        }
    }

    function startRound() {
        if (roundIndex >= ENEMY_ROUNDS.length) { victory(); return; }
        const r = ENEMY_ROUNDS[roundIndex];
        allyTeam = []; enemyTeam = []; allyBullets = []; enemyBullets = [];
        allyKills = 0; enemyKills = 0;

        placedPositions.forEach(p => {
            allyTeam.push(spawnBot(p.type, p.x, p.y, 'ally', 1.0));
        });

        const enemyX = canvas.width * 0.75;
        r.types.forEach((type, i) => {
            const y = canvas.height * (i + 1) / (r.types.length + 1);
            enemyTeam.push(spawnBot(type, enemyX + (Math.random()-0.5)*80, y, 'enemy', r.hpMult));
        });

        obstacles.length = 0;
        if (typeof cactusWalls !== 'undefined' && cactusWalls) cactusWalls.length = 0;

        battleActive = true;
        introTimer = 60;
        updateHUD();

        canvas.removeEventListener('touchstart', handlePlacementTouch);
        canvas.removeEventListener('click', handlePlacementClick);
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

            let target = null, minD = Infinity;
            targetTeam.forEach(e => {
                if (e.isDead) return;
                const d = getDist(bot, e);
                if (d < minD) { minD = d; target = e; }
            });
            if (!target) return;

            bot.angle = Math.atan2(target.y - bot.y, target.x - bot.x);
            const attackRange = bot.type === 'slime' ? bot.radius + target.radius + 3 : bot.range;

            if (bot.speed > 0 && minD > attackRange) {
                bot.x += Math.cos(bot.angle) * bot.speed * ts;
                bot.y += Math.sin(bot.angle) * bot.speed * ts;
            }

            if (bot.type === 'slime') {
                if (minD < bot.radius + target.radius + 3 && bot._atkCD <= 0) {
                    target.hp -= bot.damage;
                    addFloatingNumber(target.x, target.y, bot.damage, bot.color);
                    bot._atkCD = 30;
                }
                if (bot._atkCD > 0) bot._atkCD -= ts;
            }
            else if (bot.type === 'yuva') {
                bot._spawnTimer += ts;
                if (bot._spawnTimer >= 420 && bot._spawned < 4) {
                    bot._spawnTimer = 0;
                    bot._spawned++;
                    const ang = Math.random() * Math.PI * 2;
                    const child = spawnBot('slime',
                        clampPos(bot.x + Math.cos(ang)*40, WALL_THICKNESS+10, canvas.width-WALL_THICKNESS-10),
                        clampPos(bot.y + Math.sin(ang)*40, WALL_THICKNESS+10, canvas.height-WALL_THICKNESS-10),
                        bot.team, 1.0, 0);
                    if (bot.team === 'ally') allyTeam.push(child);
                    else enemyTeam.push(child);
                }
            }
            else if (minD < bot.range && Date.now() - bot.lastShot > bot.interval) {
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
                const lvl = kills >= 6 ? 2 : kills >= 2 ? 1 : 0;
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
            b.x += b.vx * ts; b.y += b.vy * ts;

            if (b._boom) {
                b._traveled = (b._traveled || 0) + Math.hypot(b.vx, b.vy) * ts;
                if (!b._returning && b._traveled > 250) { b._returning = true; b._hit = new Set(); }
                if (b._returning && b._owner && !b._owner.isDead) {
                    const ang = Math.atan2(b._owner.y - b.y, b._owner.x - b.x);
                    b.vx = Math.cos(ang) * BOT_BULLET_SPEED; b.vy = Math.sin(ang) * BOT_BULLET_SPEED;
                    if (getDist(b, b._owner) < 20) { bullets.splice(i, 1); continue; }
                } else if (b._returning && (!b._owner || b._owner.isDead)) { bullets.splice(i, 1); continue; }
            }

            if (b.x < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS ||
                b.y < WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) {
                if (!b._boom) bullets.splice(i, 1);
                else if (b._returning) { bullets.splice(i, 1); }
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
                        t._shield -= absorbed; dmg -= absorbed;
                    }
                    if (dmg > 0) {
                        t.hp -= dmg;
                        addFloatingNumber(t.x, t.y, dmg, b.team === 'ally' ? '#2ecc71' : '#e74c3c');
                    }
                    if (b._boom) { b._hit.add(t); }
                    else { hit = true; }
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
            roundIndex = 0; battleActive = false; introTimer = 0;
            allyTeam = []; enemyTeam = []; allyBullets = []; enemyBullets = [];
            placedPositions = []; selectedType = null; setupMode = false;
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
            if (setupMode) return;
            if (window.GAME_PAUSED) return;
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
                else { setTimeout(showSetup, 800); }
                updateHUD();
            } else if (aA === 0) {
                battleActive = false; setTimeout(defeat, 500);
            } else updateHUD();
        },
        onReset: function () {
            allyTeam = []; enemyTeam = []; allyBullets = []; enemyBullets = [];
            roundIndex = 0; battleActive = false; introTimer = 0;
            placedPositions = []; selectedType = null; setupMode = false;
            canvas.removeEventListener('touchstart', handlePlacementTouch);
            canvas.removeEventListener('click', handlePlacementClick);
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

        // Setup modunda sol yarı çizgisi + yerleşen birimler
        if (setupMode) {
            ctx.save();
            ctx.setLineDash([10, 10]);
            ctx.strokeStyle = 'rgba(241,196,15,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(canvas.width * 0.48, 0);
            ctx.lineTo(canvas.width * 0.48, canvas.height);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            placedPositions.forEach(p => {
                const s = STATS[p.type];
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath(); ctx.ellipse(0, s.radius * 0.4, s.radius * 0.9, s.radius * 0.35, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = s.color;
                ctx.beginPath(); ctx.arc(0, 0, s.radius, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#2ecc71';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.beginPath(); ctx.arc(s.radius - 4, 0, 5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
                ctx.restore();
            });
        }

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

    window.GAME_EXT.modKartiEkle('botbattle', 'Bot Savaşı', 'Serbest yerleştirme + gerçek davranışlar');
    console.log('[MOD YÜKLENDİ] botbattle v6');
})();