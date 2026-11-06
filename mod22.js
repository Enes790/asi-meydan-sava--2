// ========== mod36.js — Bot Savaşı v5 (Yerleştirme + Yuva + Piyade) ==========
(function () {
    'use strict';

    const MOD_ID = 'botbattle';
    const TOTAL_VALUE = 15;
    const MAX_SLOTS = 5;

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
    let setupOverlay = null, readyPressed = false;
    let slots = [null,null,null,null,null];

    // Yerleştirme
    let placementMode = false;
    let placementQueue = [];
    let placedPositions = [];
    let ghostX = 0, ghostY = 0;
    let placementOverlay = null;

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
        return slots.reduce((s, t) => s + (t ? STATS[t].value : 0), 0);
    }

    function showSetup() {
        if (setupOverlay) setupOverlay.remove();
        setupOverlay = document.createElement('div');
        setupOverlay.id = 'botbattle-setup';
        setupOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,20,0.97);z-index:150;display:flex;flex-direction:column;align-items:center;padding:16px;overflow-y:auto;gap:10px;';

        const title = document.createElement('h1');
        title.textContent = `TUR ${roundIndex + 1} — ORDUNU KUR`;
        title.style.cssText = 'color:#f1c40f;font-size:22px;margin:0;text-align:center;';
        setupOverlay.appendChild(title);

        const info = document.createElement('p');
        info.id = 'bb-info';
        info.style.cssText = 'color:#aaa;font-size:13px;margin:0;text-align:center;';
        setupOverlay.appendChild(info);

        const slotsRow = document.createElement('div');
        slotsRow.style.cssText = 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap;';
        setupOverlay.appendChild(slotsRow);

        function renderSlots() {
            slotsRow.innerHTML = '';
            slots.forEach((type, i) => {
                const s = type ? STATS[type] : null;
                const slot = document.createElement('div');
                slot.style.cssText = `width:58px;height:58px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;
                    background:${s ? s.color+'22' : 'rgba(255,255,255,0.05)'};
                    border:2px ${s ? 'solid' : 'dashed'} ${s ? s.color : '#555'};`;
                if (s) {
                    slot.innerHTML = `<div style="font-size:10px;color:#fff;font-weight:bold;text-align:center;line-height:1.1;">${s.name}</div><div style="font-size:9px;color:#f39c12;">${s.value}p</div>`;
                } else {
                    slot.innerHTML = `<div style="color:#555;font-size:18px;">+</div>`;
                }
                slot.addEventListener('click', () => {
                    if (slots[i]) { slots[i] = null; renderSlots(); updateInfo(); }
                });
                slotsRow.appendChild(slot);
            });
        }

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:100%;max-width:520px;';

        TYPES.forEach(type => {
            const s = STATS[type];
            const card = document.createElement('div');
            card.style.cssText = `background:linear-gradient(135deg,#1e293b,#0f172a);border:3px solid ${s.color};border-radius:10px;padding:6px 4px;cursor:pointer;text-align:center;`;
            card.innerHTML = `<div style="color:#fff;font-weight:bold;font-size:12px;">${s.name}</div>
                <div style="color:#f39c12;font-size:10px;font-weight:bold;">${s.value}p</div>
                <div style="color:${s.color};font-size:9px;">${s.hp}hp / ${s.dmg}dmg</div>`;
            card.addEventListener('click', () => {
                const emptyIdx = slots.findIndex(x => x === null);
                if (emptyIdx === -1) return;
                if (currentValue() + s.value > TOTAL_VALUE) {
                    info.textContent = '⚠ Değer limiti aşıldı!'; info.style.color = '#e74c3c';
                    setTimeout(updateInfo, 900);
                    return;
                }
                slots[emptyIdx] = type;
                renderSlots(); updateInfo();
            });
            grid.appendChild(card);
        });
        setupOverlay.appendChild(grid);

        const readyBtn = document.createElement('button');
        readyBtn.id = 'bb-ready';
        readyBtn.style.cssText = 'padding:14px 50px;font-size:18px;font-weight:bold;background:#2ecc71;color:#fff;border:none;border-radius:10px;cursor:pointer;margin-top:6px;';
        readyBtn.addEventListener('click', () => {
            if (slots.filter(s => s !== null).length > 0) {
                setupOverlay.remove(); setupOverlay = null;
                startPlacement();
            }
        });
        setupOverlay.appendChild(readyBtn);

        function updateInfo() {
            const v = currentValue(), n = slots.filter(s => s !== null).length;
            info.textContent = `Değer: ${v}/${TOTAL_VALUE} • Slot: ${n}/${MAX_SLOTS}`;
            info.style.color = '#aaa';
            readyBtn.textContent = `YERLEŞTİR (${n} birlik)`;
            readyBtn.disabled = n === 0;
            readyBtn.style.opacity = n === 0 ? '0.4' : '1';
        }
        renderSlots(); updateInfo();
        document.body.appendChild(setupOverlay);
    }

    // ===== YERLEŞTİRME AŞAMASI =====
    function startPlacement() {
        placementMode = true;
        placementQueue = slots.filter(s => s !== null);
        placedPositions = [];
        if (placementQueue.length === 0) { startRound(); return; }

        if (placementOverlay) placementOverlay.remove();
        placementOverlay = document.createElement('div');
        placementOverlay.id = 'bb-placement';
        placementOverlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:100;display:flex;flex-direction:column;justify-content:space-between;';
        
        // Üst bilgi
        const info = document.createElement('div');
        info.id = 'bb-place-info';
        info.style.cssText = 'background:rgba(0,0,0,0.85);padding:12px;text-align:center;color:#f1c40f;font-size:16px;font-weight:bold;pointer-events:none;';
        info.textContent = `BOT 1/${placementQueue.length}: ${STATS[placementQueue[0]].name} — Sol tarafa dokun`;
        placementOverlay.appendChild(info);

        // Alt bilgi
        const bottom = document.createElement('div');
        bottom.style.cssText = 'background:rgba(0,0,0,0.85);padding:10px;text-align:center;color:#aaa;font-size:13px;pointer-events:none;';
        bottom.textContent = 'Birliklerini sol tarafa yerleştir. Dokununca yerleşir.';
        placementOverlay.appendChild(bottom);

        document.body.appendChild(placementOverlay);

        // Canvas tıklama
        canvas.style.pointerEvents = 'auto';
        canvas.addEventListener('touchstart', handlePlacementTouch, { passive: false });
        canvas.addEventListener('click', handlePlacementClick);
    }

    function handlePlacementTouch(e) {
        if (!placementMode) return;
        e.preventDefault();
        const t = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const x = (t.clientX - rect.left) * (canvas.width / rect.width);
        const y = (t.clientY - rect.top) * (canvas.height / rect.height);
        placeAt(x, y);
    }

    function handlePlacementClick(e) {
        if (!placementMode) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        placeAt(x, y);
    }

    function placeAt(x, y) {
        if (!placementMode || placementQueue.length === 0) return;
        // Sol taraf sınırı (oyuncu bölgesi)
        const maxX = canvas.width * 0.5;
        if (x > maxX) {
            const info = document.getElementById('bb-place-info');
            if (info) { info.textContent = '⚠ Sadece SOL tarafa yerleştir!'; setTimeout(() => updatePlacementInfo(), 900); }
            return;
        }
        if (x < WALL_THICKNESS + 30) x = WALL_THICKNESS + 30;
        if (y < WALL_THICKNESS + 30) y = WALL_THICKNESS + 30;
        if (y > canvas.height - WALL_THICKNESS - 30) y = canvas.height - WALL_THICKNESS - 30;

        placedPositions.push({ type: placementQueue[0], x, y });
        placementQueue.shift();

        if (placementQueue.length === 0) {
            endPlacement();
        } else {
            updatePlacementInfo();
        }
    }

    function updatePlacementInfo() {
        const info = document.getElementById('bb-place-info');
        if (info && placementQueue.length > 0) {
            const current = placementQueue[0];
            info.textContent = `BOT ${placedPositions.length + 1}/${placedPositions.length + placementQueue.length}: ${STATS[current].name} — Sol tarafa dokun`;
            info.style.color = '#f1c40f';
        }
    }

    function endPlacement() {
        placementMode = false;
        canvas.removeEventListener('touchstart', handlePlacementTouch);
        canvas.removeEventListener('click', handlePlacementClick);
        if (placementOverlay) { placementOverlay.remove(); placementOverlay = null; }
        startRound();
    }

    function startRound() {
        if (roundIndex >= ENEMY_ROUNDS.length) { victory(); return; }
        const r = ENEMY_ROUNDS[roundIndex];
        allyTeam = []; enemyTeam = []; allyBullets = []; enemyBullets = [];
        allyKills = 0; enemyKills = 0;

        // Ally: yerleştirilen pozisyonlar
        placedPositions.forEach(p => {
            allyTeam.push(spawnBot(p.type, p.x, p.y, 'ally', 1.0));
        });

        // Enemy: sağ tarafa dağıt
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
    }

    function killBot(bot, team) {
        bot.isDead = true;
        if (!(bot.type === 'slime' && bot._stage > 0)) {
            if (team === 'ally') enemyKills++;
            else allyKills++;
        }
        // Slime bölünme
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

            // Slime temas
            if (bot.type === 'slime') {
                if (minD < bot.radius + target.radius + 3 && bot._atkCD <= 0) {
                    target.hp -= bot.damage;
                    addFloatingNumber(target.x, target.y, bot.damage, bot.color);
                    bot._atkCD = 30;
                }
                if (bot._atkCD > 0) bot._atkCD -= ts;
            }
            // Yuva: slime üret
            else if (bot.type === 'yuva') {
                bot._spawnTimer += ts;
                if (bot._spawnTimer >= 420 && bot._spawned < 4) {  // 7sn
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
            // Normal mermi
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

            // Zırhlı
            if (bot.type === 'armored') {
                if (bot._shield < bot._maxShield) bot._shield = Math.min(bot._maxShield, bot._shield + 30 * ts);
                bot._healTimer = (bot._healTimer || 0) + ts;
                if (bot._healTimer >= 60) { bot._healTimer = 0; bot.hp = Math.min(bot.maxHp, bot.hp + 200); }
            }

            // Büyüyen: 2 kill = orta, 6 kill = büyük
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
                        t._shield -= absorbed;
                        dmg -= absorbed;
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
            roundIndex = 0; battleActive = false; introTimer = 0; readyPressed = false;
            allyTeam = []; enemyTeam = []; allyBullets = []; enemyBullets = [];
            slots = [null,null,null,null,null];
            placementMode = false; placementQueue = []; placedPositions = [];
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
            if (placementMode) return;
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
                else { readyPressed = false; placementQueue = []; placedPositions = []; setTimeout(showSetup, 800); }
                updateHUD();
            } else if (aA === 0) {
                battleActive = false; setTimeout(defeat, 500);
            } else updateHUD();
        },
        onReset: function () {
            allyTeam = []; enemyTeam = []; allyBullets = []; enemyBullets = [];
            roundIndex = 0; battleActive = false; introTimer = 0; readyPressed = false;
            slots = [null,null,null,null,null];
            placementMode = false; placementQueue = []; placedPositions = [];
            canvas.removeEventListener('touchstart', handlePlacementTouch);
            canvas.removeEventListener('click', handlePlacementClick);
            const h = document.getElementById('bb-hud'); if (h) h.style.display = 'none';
            if (setupOverlay) { setupOverlay.remove(); setupOverlay = null; }
            if (placementOverlay) { placementOverlay.remove(); placementOverlay = null; }
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

        // Yerleştirme önizlemesi
        if (placementMode && placementQueue.length > 0) {
            const s = STATS[placementQueue[0]];
            ctx.save();
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(canvas.width * 0.25, canvas.height * 0.15, s.radius * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1;
            // Sol yarı çizgisi
            ctx.setLineDash([10, 10]);
            ctx.strokeStyle = 'rgba(241,196,15,0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(canvas.width * 0.5, 0);
            ctx.lineTo(canvas.width * 0.5, canvas.height);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // Yerleştirilen birlikler (savaş öncesi de görünsün)
        placedPositions.forEach(p => {
            const s = STATS[p.type];
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.globalAlpha = placementMode ? 0.7 : 1;
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(0, s.radius * 0.4, s.radius * 0.9, s.radius * 0.35, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = s.color;
            ctx.beginPath(); ctx.arc(0, 0, s.radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#2ecc71';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.beginPath(); ctx.arc(s.radius - 4, 0, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
            ctx.restore();
        });

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

    window.GAME_EXT.modKartiEkle('botbattle', 'Bot Savaşı', 'Değer + yerleştirme + gerçek davranışlar');
    console.log('[MOD YÜKLENDİ] botbattle v5');
})();