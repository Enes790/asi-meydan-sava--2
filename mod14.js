// ========== mod14.js — 25 Dalga Arena (Base Botlar + Full Kartlar) ==========
(function () {
    'use strict';

    const MOD_ID = 'wave';
    const TUR_LEN = 6;
    const SPAWN_GRACE = 90;
    const SPAWN_GRACE_BOSS = 120;

    let waveIndex = 0;
    let waveActive = false;
    let _baseMaxHp = 0;
    let _lastEpicWave = -10;
    let _hayatUsedThisWave = false;
    let _lastPlayerHp = 0;
    let _reflectCounter = 0;
    let _waveDamageMult = 1;
    let _meteorTimer = 0;
    let _meteors = [];
    let _elektroTimer = 0;
    let _elektroFlashes = [];
    let _turret = null;
    let _friendlyBots = [];
    let _friendlyBullets = [];

    // Slime sayıları 1/3'e düşürüldü (her slime = 7 kill)
    const WAVES = [
        { e:[{t:'slime',c:1}], d:4 },
        { e:[{t:'mor',c:1}], d:3 },
        { e:[{t:'boom',c:5}], d:5 },
        { e:[{t:'slime',c:1},{t:'tur',c:4}] },
        { e:[{t:'fog',c:1},{t:'boom',c:4}] },
        { e:[{t:'mor',c:2},{t:'slime',c:1}], boss:true },
        { e:[{t:'slime',c:2}], d:4 },
        { e:[{t:'mor',c:2},{t:'tur',c:2}] },
        { e:[{t:'boom',c:6},{t:'slime',c:1}] },
        { e:[{t:'tur',c:5},{t:'nest',c:1}] },
        { e:[{t:'fog',c:1},{t:'boom',c:5}] },
        { e:[{t:'mor',c:2},{t:'slime',c:2}], boss:true },
        { e:[{t:'slime',c:2},{t:'boom',c:2}] },
        { e:[{t:'mor',c:2},{t:'tur',c:3}] },
        { e:[{t:'boom',c:7},{t:'fog',c:1}] },
        { e:[{t:'tur',c:6},{t:'nest',c:2}] },
        { e:[{t:'fog',c:2},{t:'boom',c:4}] },
        { e:[{t:'mor',c:2},{t:'slime',c:2}], boss:true },
        { e:[{t:'slime',c:3},{t:'boom',c:3}] },
        { e:[{t:'mor',c:2},{t:'tur',c:4}] },
        { e:[{t:'boom',c:8},{t:'fog',c:2}] },
        { e:[{t:'tur',c:8},{t:'nest',c:3}] },
        { e:[{t:'fog',c:3},{t:'boom',c:5}] },
        { e:[{t:'mor',c:2},{t:'slime',c:2}], boss:true },
        { e:[{t:'mor',c:2},{t:'fog',c:2},{t:'nest',c:2},{t:'slime',c:3},{t:'tur',c:4},{t:'boom',c:4}], boss:true, final:true }
    ];

    const CARDS = {
        maxhp:    { name:'Maks HP',           rarity:'common', max:4, desc:'+%25 max HP / seviye' },
        hiz:      { name:'Hız',               rarity:'common', max:4, desc:'+%5 hız + +%5 cephane' },
        regen:    { name:'Regen',             rarity:'common', max:4, desc:'+30/60/100/150 HP/sn pasif' },
        hasar:    { name:'Ek Hasar',          rarity:'common', max:4, desc:'+%10 hasar / seviye' },
        cancalma: { name:'Can Çalma',         rarity:'rare',   max:4, desc:'Ana saldırı hasarının %X i can' },
        yansima:  { name:'Yansıma',           rarity:'rare',   max:4, desc:'Her N. vuruşta yansıma + heal' },
        dostbot:  { name:'Dost Bot',          rarity:'rare',   max:4, desc:'Yardımcı botlar + güç' },
        meteor:   { name:'Meteor',            rarity:'rare',   max:4, desc:'Periyodik AOE göktaşı' },
        elektro:  { name:'Elektro Aura',      rarity:'epic',   max:4, desc:'Yakın düşmanlara şok' },
        kule:     { name:'Kule',              rarity:'epic',   max:4, desc:'Otomatik ateş eden kule' },
        hayat:    { name:'Hayat Sigortası',   rarity:'epic',   max:4, desc:'Can≤500 iken kurtarma' }
    };

    const STATE = {};
    Object.keys(CARDS).forEach(k => STATE[k] = 0);

    const safe = (v, f) => Number.isFinite(v) ? v : (f || 0);

    function spawnPos(dir) {
        const m = WALL_THICKNESS + 60;
        const sides = ['top','bottom','left','right'];
        if (dir === 'random' || !dir) dir = sides[(Math.random()*4)|0];
        if (dir==='top')    return { x: canvas.width/2 + (Math.random()-0.5)*canvas.width*0.7, y: m };
        if (dir==='bottom') return { x: canvas.width/2 + (Math.random()-0.5)*canvas.width*0.7, y: canvas.height - m };
        if (dir==='left')   return { x: m, y: canvas.height/2 + (Math.random()-0.5)*canvas.height*0.7 };
        if (dir==='right')  return { x: canvas.width - m, y: canvas.height/2 + (Math.random()-0.5)*canvas.height*0.7 };
        return spawnPos('random');
    }

    // ===== BASE BOTLAR (custom YOK) =====
    function spawnSlime(x, y) {
        spawnSlimeBot(x, y, 0);   // stage 0 = büyük, bölünür
        return slimeBots[slimeBots.length-1];
    }
    function spawnTur(x, y) {
        const b={x,y,radius:25,color:'#e67e22',speed:0,hp:1500,maxHp:1500,isDead:false,angle:0,lastShot:0,shootInterval:750,kbX:0,kbY:0,alerted:false,bombaBulasti:false,bombaSayaci:0,ghostRingDebounce:0};
        stationaryBots.push(b); return b;
    }
    function spawnBoom(x, y) {
        const b={x,y,radius:20,color:'#00ced1',speed:0.5,hp:1600,maxHp:1600,isDead:false,angle:0,lastShot:0,shootInterval:1500,kbX:0,kbY:0,alerted:false,bombaBulasti:false,bombaSayaci:0,ghostRingDebounce:0};
        boomerangBots.push(b); return b;
    }
    function spawnFog(x, y) {
        const b={x,y,radius:35,color:'#7f8c8d',isFog:true,speed:1.0,hp:5000,maxHp:5000,isDead:false,angle:0,kbX:0,kbY:0,alerted:false,bombaBulasti:false,bombaSayaci:0,ghostRingDebounce:0};
        fogBots.push(b); return b;
    }
    // Mor bot = base bot / bot2 slotları
    let _morSlotUsed = 0;
    function spawnMor(x, y) {
        const slot = _morSlotUsed === 0 ? bot : bot2;
        _morSlotUsed++;
        slot.isActive = true; slot.isDead = false;
        slot.x = x; slot.y = y;
        slot.hp = slot.maxHp = 3000;
        slot.kbX = slot.kbY = 0;
        slot.lastShot = 0;
        slot._morActive = true;
        return slot;
    }
    // Nest = base nests
    function spawnNest(x, y) {
        const n = {x, y, radius:40, color:'#27ae60', isNest:true, speed:0, hp:3000, maxHp:3000,
                   isDead:false, kbX:0, kbY:0, alerted:false, lastSpawn:Date.now(),
                   spawnCount:0, bombaBulasti:false, bombaSayaci:0, _isWaveNest:true};
        nests.push(n); return n;
    }

    function spawnWave(idx) {
        const w = WAVES[idx];
        if (!w) return;
        _morSlotUsed = 0;
        const dirs = ['top','bottom','left','right'];
        let dIdx = 0;
        const turIdx = Math.floor(idx / 3);
        const hpBonus = turIdx * 25;

        w.e.forEach(group => {
            for (let i = 0; i < group.c; i++) {
                const dir = w.d ? dirs[dIdx % w.d] : 'random';
                dIdx++;
                const p = spawnPos(dir);
                let e;
                if (group.t === 'slime')  e = spawnSlime(p.x, p.y);
                else if (group.t === 'mor')  e = spawnMor(p.x, p.y);
                else if (group.t === 'tur')  e = spawnTur(p.x, p.y);
                else if (group.t === 'boom') e = spawnBoom(p.x, p.y);
                else if (group.t === 'fog')  e = spawnFog(p.x, p.y);
                else if (group.t === 'nest') e = spawnNest(p.x, p.y);
                if (e) {
                    e.maxHp += hpBonus;
                    e.hp = e.maxHp;
                    e._grace = w.boss ? SPAWN_GRACE_BOSS : SPAWN_GRACE;
                    e._baseSpeed = e.speed || 0;
                    e.speed = 0;
                }
            }
        });

        waveActive = true;
        _hayatUsedThisWave = false;

        // Kule
        if (STATE.kule > 0) {
            const mh = 2000 + (STATE.kule-1)*600;
            _turret = { x: player.x, y: player.y, radius: 22, hp: mh, maxHp: mh, angle: 0, lastShot: 0, _isTurret: true };
        } else { _turret = null; }

        // Dost botlar
        _friendlyBots = [];
        if (STATE.dostbot > 0) {
            const types = ['piyade','ranger','havan'];
            const count = Math.min(STATE.dostbot, 3);
            const mult = STATE.dostbot >= 4 ? 1.5 : 1;
            for (let i = 0; i < count; i++) {
                _friendlyBots.push({
                    x: player.x + (Math.random()-0.5)*100, y: player.y + 60,
                    radius: 15, angle: 0, lastShot: 0, type: types[i], color: '#3498db',
                    hp: 800 * mult, maxHp: 800 * mult, damage: 100 * mult, _isFriendly: true
                });
            }
        }

        _meteorTimer = 0;
        _elektroTimer = 0;
        updateHUD();
    }

    function getPool() {
        const pool = [];
        Object.keys(CARDS).forEach(k => {
            const c = CARDS[k], lv = STATE[k];
            if (lv >= c.max) return;
            let w = c.rarity === 'common' ? 100 : c.rarity === 'rare' ? 87 : 50;
            w += lv * 30;
            if (c.rarity === 'epic' && (waveIndex - _lastEpicWave) >= 4) w += 100;
            if (waveIndex === 0 && c.rarity !== 'common') return;
            pool.push({ k, w });
        });
        return pool;
    }

    function pick3() {
        const pool = getPool();
        const picks = [];
        for (let i = 0; i < 3; i++) {
            if (pool.length === 0) break;
            const total = pool.reduce((s, p) => s + p.w, 0);
            let r = Math.random() * total, idx = 0;
            for (let j = 0; j < pool.length; j++) { r -= pool[j].w; if (r <= 0) { idx = j; break; } }
            picks.push(pool[idx].k);
            pool.splice(idx, 1);
        }
        return picks;
    }

    function showUpgrade() {
        window.GAME_PAUSED = true;
        const picks = pick3();
        if (picks.length === 0) { nextWave(); return; }
        const overlay = document.createElement('div');
        overlay.id = 'wave-upgrade';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:100;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:20px;';
        const title = document.createElement('h2');
        title.textContent = waveIndex === 0 ? 'BAŞLANGIÇ' : `DALGA ${waveIndex} BİTTİ`;
        title.style.cssText = 'color:#f1c40f;font-size:26px;margin-bottom:24px;';
        overlay.appendChild(title);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;max-width:800px;';
        picks.forEach(k => {
            const c = CARDS[k];
            const nxt = STATE[k] + 1;
            const col = c.rarity === 'epic' ? '#a78bfa' : c.rarity === 'rare' ? '#60a5fa' : '#94a3b8';
            const card = document.createElement('div');
            card.style.cssText = `background:linear-gradient(135deg,#1e293b,#0f172a);border:3px solid ${col};border-radius:14px;padding:18px;width:210px;cursor:pointer;text-align:center;transition:transform .15s;`;
            card.innerHTML = `<div style="color:${col};font-size:11px;text-transform:uppercase;margin-bottom:6px;">${c.rarity}</div>
                <div style="color:#fff;font-size:19px;font-weight:bold;margin-bottom:6px;">${c.name}</div>
                <div style="color:#94a3b8;font-size:13px;margin-bottom:10px;">Lv ${nxt}/${c.max}</div>
                <div style="color:#f1c40f;font-size:13px;line-height:1.4;">${c.desc}</div>`;
            card.addEventListener('mouseover', () => card.style.transform = 'scale(1.05)');
            card.addEventListener('mouseout',  () => card.style.transform = 'scale(1)');
            card.addEventListener('click', () => pickCard(k));
            row.appendChild(card);
        });
        overlay.appendChild(row);
        document.body.appendChild(overlay);
    }

    function pickCard(k) {
        STATE[k]++;
        if (CARDS[k].rarity === 'epic') _lastEpicWave = waveIndex;
        applyCard(k, STATE[k]);
        const ov = document.getElementById('wave-upgrade');
        if (ov) ov.remove();
        window.GAME_PAUSED = false;
        nextWave();
    }

    function applyCard(k, lv) {
        if (k === 'maxhp') {
            if (!_baseMaxHp) _baseMaxHp = player.maxHp;
            const target = _baseMaxHp * (1 + lv * 0.25);
            const diff = target - player.maxHp;
            player.maxHp = target;
            player.hp += diff;
        } else if (k === 'hiz') {
            const pct = lv * 0.05;
            player.speed = (player.originalSpeed || player.speed) * (1 + pct);
            player.reloadSpeed = 0.015 * (1 + pct);
        } else if (k === 'hasar') {
            _waveDamageMult = 1 + lv * 0.10;
        }
    }

    function nextWave() {
        waveIndex++;
        // Tur sonu %50 heal
        if (waveIndex > 0 && waveIndex % 6 === 0 && !player.isDead) {
            const heal = player.maxHp * 0.5;
            player.hp = Math.min(player.maxHp, player.hp + heal);
            addFloatingNumber(player.x, player.y - 40, '+' + Math.floor(heal), '#2ecc71');
        }
        if (waveIndex >= WAVES.length) { victory(); return; }
        _friendlyBots = [];
        setTimeout(() => spawnWave(waveIndex), 300);
    }

    function victory() {
        window.GAME_PAUSED = true;
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:200;display:flex;flex-direction:column;justify-content:center;align-items:center;';
        ov.innerHTML = '<h1 style="color:#f1c40f;font-size:52px;">ZAFER!</h1><p style="color:#fff;font-size:20px;margin:20px 0 30px;">25 dalga tamamlandı!</p><button onclick="location.reload()" style="padding:15px 40px;font-size:18px;background:#2ecc71;color:#fff;border:none;border-radius:10px;cursor:pointer;">Yeniden Başla</button>';
        document.body.appendChild(ov);
    }

    function updateHUD() {
        let h = document.getElementById('wave-hud');
        if (!h) {
            h = document.createElement('div');
            h.id = 'wave-hud';
            h.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);padding:8px 20px;border-radius:20px;color:#f1c40f;font-weight:bold;font-size:15px;z-index:50;pointer-events:none;display:none;';
            document.body.appendChild(h);
        }
        h.style.display = 'block';
        const tur = Math.floor(waveIndex / TUR_LEN) + 1;
        h.textContent = `TUR ${tur} • DALGA ${waveIndex + 1} / ${WAVES.length}`;
    }

    // ===== KART MANTIĞI =====
    function applyPlayerDamage(dmg) {
        if (STATE.yansima > 0) {
            _reflectCounter++;
            const thresholds = [5, 4, 3, 3];
            const heals =     [0, 0.10, 0.15, 0.25];
            const lv = STATE.yansima;
            const need = thresholds[lv-1];
            if (_reflectCounter >= need) {
                _reflectCounter = 0;
                const reflect = dmg * 0.50;
                getActiveEnemies().forEach(e => {
                    if (!e.isDead && getDist(e, player) < 300) {
                        e.hp -= reflect;
                        addFloatingNumber(e.x, e.y, Math.floor(reflect), '#60a5fa');
                    }
                });
                const heal = reflect * (heals[lv-1] || 0);
                if (heal > 0) {
                    player.hp = Math.min(player.maxHp, player.hp + heal);
                    addFloatingNumber(player.x, player.y, '+' + Math.floor(heal), '#2ecc71');
                }
            }
        }
        if (STATE.hayat > 0 && !_hayatUsedThisWave && player.hp <= 500 && !player.isDead) {
            _hayatUsedThisWave = true;
            const lv = STATE.hayat;
            const push = 150 + (lv-1) * 50;
            const hdmg = 200 + (lv-1) * 200;
            player.hp = Math.min(player.maxHp, player.hp + 1000);
            player.jumpInvulnerable = true;
            player._waveHayatUntil = Date.now() + 2000;
            screenShake = 20;
            getActiveEnemies().forEach(e => {
                if (getDist(e, player) < 150) {
                    const ang = getAngle(player, e);
                    e.x += Math.cos(ang) * push;
                    e.y += Math.sin(ang) * push;
                    e.x = clampPos(e.x, e.radius + WALL_THICKNESS, canvas.width - e.radius - WALL_THICKNESS);
                    e.y = clampPos(e.y, e.radius + WALL_THICKNESS, canvas.height - e.radius - WALL_THICKNESS);
                    e.hp -= hdmg;
                    e._stunTimer = Math.max(e._stunTimer || 0, 60);
                    addFloatingNumber(e.x, e.y, hdmg, '#f1c40f');
                }
            });
            addFloatingNumber(player.x, player.y - 40, 'KURTARILDI!', '#00e5ff');
        }
    }

    function applyEnemyDamage(dmg) {
        if (STATE.cancalma > 0) {
            const pcts = [0.05, 0.15, 0.30, 0.50];
            const heal = dmg * pcts[STATE.cancalma - 1];
            player.hp = Math.min(player.maxHp, player.hp + heal);
            if (heal >= 1) addFloatingNumber(player.x, player.y - 20, '+' + Math.floor(heal), '#2ecc71');
        }
    }

    function updateMeteor(ts) {
        const intervals = [900, 840, 780, 720];
        _meteorTimer += ts;
        if (_meteorTimer >= intervals[STATE.meteor-1]) {
            _meteorTimer = 0;
            const enemies = getActiveEnemies();
            if (enemies.length === 0) return;
            let best = null, bestScore = -1;
            enemies.forEach(e => {
                let s = 0;
                enemies.forEach(e2 => { if (e2 !== e && getDist(e, e2) < 150) s++; });
                if (s > bestScore) { bestScore = s; best = e; }
            });
            if (!best) best = enemies[0];
            const dmg = [500, 750, 1000, 1250][STATE.meteor-1];
            _meteors.push({ x: best.x, y: best.y, startY: best.y - 400, t: 0, dur: 60, dmg: dmg });
        }
        for (let i = _meteors.length-1; i >= 0; i--) {
            const m = _meteors[i];
            m.t += ts;
            if (m.t >= m.dur) {
                getActiveEnemies().forEach(e => {
                    if (getDist(m, e) < 100 + e.radius) {
                        e.hp -= m.dmg;
                        addFloatingNumber(e.x, e.y, m.dmg, '#ff8c42');
                    }
                });
                explosions.push({ x: m.x, y: m.y, radius: 10, maxRadius: 120, life: 15, maxLife: 15 });
                screenShake = 8;
                _meteors.splice(i, 1);
            }
        }
    }

    function updateElektro(ts) {
        _elektroTimer += ts;
        if (_elektroTimer >= 180) {
            _elektroTimer = 0;
            const ranges = [130, 180, 230, 280];
            const dpss   = [50, 150, 250, 350];
            const stuns  = [30, 60, 90, 90];
            const r = ranges[STATE.elektro-1];
            const dps = dpss[STATE.elektro-1];
            const stun = stuns[STATE.elektro-1];
            const enemies = getActiveEnemies().filter(e => getDist(e, player) < r);
            enemies.slice(0, 3).forEach(e => {
                e._stunTimer = Math.max(e._stunTimer || 0, stun);
                e._elektroDot = Math.max(e._elektroDot || 0, 60);
                e._elektroDps = dps;
                addFloatingNumber(e.x, e.y, 'ŞOK!', '#00e5ff');
            });
            if (enemies.length > 0) _elektroFlashes.push({ x: player.x, y: player.y, r: r, life: 20, maxLife: 20 });
        }
        for (let i = _elektroFlashes.length-1; i >= 0; i--) {
            _elektroFlashes[i].life -= ts;
            if (_elektroFlashes[i].life <= 0) _elektroFlashes.splice(i, 1);
        }
        getActiveEnemies().forEach(e => {
            if (e._elektroDot > 0) {
                e._elektroDot -= ts;
                e.hp -= (e._elektroDps || 50) / 60 * ts;
            }
        });
    }

    function updateTurret(ts) {
        if (!_turret) return;
        if (_turret.hp <= 0) { _turret = null; return; }
        const enemies = getActiveEnemies().filter(e => getDist(_turret, e) < 280 + (STATE.kule-1)*40);
        if (enemies.length > 0) {
            _turret.lastShot += ts;
            if (_turret.lastShot >= 60) {
                _turret.lastShot = 0;
                const target = enemies[0];
                _turret.angle = Math.atan2(target.y - _turret.y, target.x - _turret.x);
                const dmg = 120 + (STATE.kule-1)*36;
                target.hp -= dmg;
                addFloatingNumber(target.x, target.y, dmg, '#94a3b8');
                _turret.hp -= 50;
            }
        }
    }

    function updateFriendlyBots(ts) {
        _friendlyBots.forEach(b => {
            if (b.hp <= 0) return;
            const enemies = getActiveEnemies().filter(e => !e.isDead && e._grace <= 0);
            if (enemies.length === 0) return;
            let nearest = null, minD = Infinity;
            enemies.forEach(e => { const d = getDist(b, e); if (d < minD) { minD = d; nearest = e; } });
            if (!nearest) return;
            b.angle = Math.atan2(nearest.y - b.y, nearest.x - b.x);
            if (minD > 200) { b.x += Math.cos(b.angle) * 1.5 * ts; b.y += Math.sin(b.angle) * 1.5 * ts; }
            b.lastShot += ts;
            if (b.lastShot >= 60 && minD < 300) {
                b.lastShot = 0;
                _friendlyBullets.push({ x: b.x, y: b.y, vx: Math.cos(b.angle)*8, vy: Math.sin(b.angle)*8, damage: b.damage, life: 60 });
            }
        });
        for (let i = _friendlyBots.length-1; i >= 0; i--) if (_friendlyBots[i].hp <= 0) _friendlyBots.splice(i, 1);
        for (let i = _friendlyBullets.length-1; i >= 0; i--) {
            const b = _friendlyBullets[i];
            b.x += b.vx * ts; b.y += b.vy * ts;
            b.life -= ts;
            if (b.life <= 0) { _friendlyBullets.splice(i,1); continue; }
            let hit = false;
            for (const e of getActiveEnemies()) {
                if (e.isDead || e._grace > 0) continue;
                if (getDist(b, e) < e.radius + 6) {
                    e.hp -= b.damage;
                    addFloatingNumber(e.x, e.y, b.damage, '#3498db');
                    hit = true; break;
                }
            }
            if (hit) _friendlyBullets.splice(i,1);
        }
    }

    function updateStun(ts) {
        getActiveEnemies().forEach(e => {
            if (e._stunTimer > 0) {
                if (e._stunSavedSpeed === undefined) {
                    e._stunSavedSpeed = e.speed;
                    e._stunSavedInterval = e.shootInterval;
                }
                e.speed = 0;
                if (e.shootInterval) e.shootInterval = 999999;
                e._stunTimer -= ts;
                if (e._stunTimer <= 0) {
                    e.speed = e._stunSavedSpeed || e.baseSpeed || 1;
                    if (e._stunSavedInterval) e.shootInterval = e._stunSavedInterval;
                    delete e._stunSavedSpeed; delete e._stunSavedInterval;
                }
            }
        });
    }

    // ===== MODE =====
    window.GAME_EXT.registerMode(MOD_ID, {
        label: '25 Dalga Arena',
        onStart: function () {
            waveIndex = 0; waveActive = false;
            _baseMaxHp = 0; _lastEpicWave = -10;
            _hayatUsedThisWave = false; _lastPlayerHp = 0;
            _reflectCounter = 0; _waveDamageMult = 1;
            _meteorTimer = 0; _meteors = [];
            _elektroTimer = 0; _elektroFlashes = [];
            _turret = null; _friendlyBots = []; _friendlyBullets = [];
            _morSlotUsed = 0;
            Object.keys(STATE).forEach(k => STATE[k] = 0);
            window.GAME_PAUSED = false;

            // Base botları KAPAT
            bot.isActive = false; bot.isDead = true; bot.x = -9999; bot.y = -9999;
            bot2.isActive = false; bot2.isDead = true; bot2.x = -9999; bot2.y = -9999;
            slimeBots = []; stationaryBots = []; boomerangBots = []; fogBots = [];
            nests = []; spawnIndicators = [];
            window.GAME_MODE_DISABLED_BOT_TYPES = ['slime','stationary','boomerang','fog'];

            updateHUD();
            setTimeout(() => showUpgrade(), 200);
        },

        onUpdate: function (ts) {
            if (window.GAME_MODE !== MOD_ID || window.GAME_PAUSED) return;

            slimeTimer = 0; stationaryTimer = 0; boomerangTimer = 0; fogBotTimer = 0;
            spawnIndicators = [];
            lastNestKillCount = botsKilled;
            botsKilled = 0;   // base bot2 otomatik aktivasyonu engelle
            if (nests.length > 1) nests.length = 1;

            // Regen
            if (STATE.regen > 0 && !player.isDead) {
                const regenVals = [30, 60, 100, 150];
                player.hp = Math.min(player.maxHp, player.hp + (regenVals[STATE.regen-1] / 60) * ts);
                player._regenFloat = (player._regenFloat || 0) + ts;
                if (player._regenFloat >= 60) {
                    player._regenFloat = 0;
                    addFloatingNumber(player.x, player.y - 20, '+' + regenVals[STATE.regen-1], '#2ecc71');
                }
            }

            // Hayat invuln
            if (player._waveHayatUntil) {
                if (Date.now() < player._waveHayatUntil) player.jumpInvulnerable = true;
                else { if (!player.isJumping) player.jumpInvulnerable = false; player._waveHayatUntil = 0; }
            }

            // Yansıma için player hasar takibi
            if (_lastPlayerHp > 0 && player.hp < _lastPlayerHp && !player.isDead) {
                applyPlayerDamage(_lastPlayerHp - player.hp);
            }
            _lastPlayerHp = player.hp;

            updateStun(ts);
            if (STATE.meteor > 0) updateMeteor(ts);
            if (STATE.elektro > 0) updateElektro(ts);
            if (STATE.kule > 0) updateTurret(ts);
            if (STATE.dostbot > 0) updateFriendlyBots(ts);

            // Base bot/bot2 AI (mor bot olarak kullanılıyor)
            [bot, bot2].forEach(b => {
                if (!b.isActive || b.isDead) return;
                if (b.hp <= 0) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color);
                    triggerBotKill(b.x, b);
                    b.isActive = false;
                    return;
                }
                if (b._grace > 0) { b._grace -= ts; return; }
                if (b._stunTimer > 0) return;
                const canSee = !player.isDead && !player.isInvisible;
                if (canSee) {
                    const dP = getDist(b, player);
                    b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                    if (dP > 180) { b.x += Math.cos(b.angle) * b.speed * ts; b.y += Math.sin(b.angle) * b.speed * ts; }
                    if (dP < 300 && Date.now() - b.lastShot > b.shootInterval) {
                        b.lastShot = Date.now();
                        botBullets.push({ x:b.x, y:b.y, sx:b.x, sy:b.y,
                            vx: Math.cos(b.angle + (Math.random()-0.5)*0.3) * BOT_BULLET_SPEED,
                            vy: Math.sin(b.angle + (Math.random()-0.5)*0.3) * BOT_BULLET_SPEED,
                            _waveMorBullet: true, owner: b });
                    }
                }
                if (Math.abs(b.kbX) > 0.1 || Math.abs(b.kbY) > 0.1) { b.x += b.kbX*ts; b.y += b.kbY*ts; b.kbX *= 0.85; b.kbY *= 0.85; }
                b.x = clampPos(b.x, b.radius+WALL_THICKNESS, canvas.width-b.radius-WALL_THICKNESS);
                b.y = clampPos(b.y, b.radius+WALL_THICKNESS, canvas.height-b.radius-WALL_THICKNESS);
            });

            // Yuvalar (base nests)
            nests.forEach(n => {
                if (n.isDead) return;
                if (n.hp <= 0) { n.isDead = true; spawnParticles(n.x, n.y, n.color || '#27ae60'); triggerBotKill(n.x, n); return; }
                if (Date.now() - n.lastSpawn > 7000) {
                    n.lastSpawn = Date.now();
                    n.spawnCount++;
                    n.hp -= 200;
                    spawnSlime(n.x + (Math.random()-0.5)*50, n.y + (Math.random()-0.5)*50);
                    if (n.spawnCount >= 4) n.hp = 0;
                }
            });
            for (let i = nests.length-1; i >= 0; i--) if (nests[i].isDead) nests.splice(i, 1);

            // Grace sonrası hız geri
            const allEnemies = [bot, bot2, ...slimeBots, ...stationaryBots, ...boomerangBots, ...fogBots, ...nests];
            allEnemies.forEach(e => {
                if (e._grace > 0) e._grace -= ts;
                if (e._grace <= 0 && e.speed === 0 && e._baseSpeed) e.speed = e._baseSpeed;
            });

            // Dalga bitiş — tüm düşmanlar öldü mü?
            if (waveActive) {
                const enemiesLeft =
                    (bot.isActive && !bot.isDead ? 1 : 0) +
                    (bot2.isActive && !bot2.isDead ? 1 : 0) +
                    slimeBots.filter(s => !s.isDead && s.hp > 0).length +
                    stationaryBots.filter(s => !s.isDead && s.hp > 0).length +
                    boomerangBots.filter(s => !s.isDead && s.hp > 0).length +
                    fogBots.filter(s => !s.isDead && s.hp > 0).length +
                    nests.filter(n => !n.isDead && n.hp > 0).length;
                if (enemiesLeft === 0) {
                    waveActive = false;
                    if (!player.isDead) setTimeout(() => showUpgrade(), 400);
                }
            }
        },

        onReset: function () {
            waveIndex = 0; waveActive = false;
            _baseMaxHp = 0; _lastEpicWave = -10;
            _hayatUsedThisWave = false; _lastPlayerHp = 0;
            _reflectCounter = 0; _waveDamageMult = 1;
            _meteorTimer = 0; _meteors = [];
            _elektroTimer = 0; _elektroFlashes = [];
            _turret = null; _friendlyBots = []; _friendlyBullets = [];
            _morSlotUsed = 0;
            Object.keys(STATE).forEach(k => STATE[k] = 0);
            window.GAME_PAUSED = false;
            const ov = document.getElementById('wave-upgrade');
            if (ov) ov.remove();
            const hud = document.getElementById('wave-hud');
            if (hud) hud.style.display = 'none';
        }
    });

    // ===== HOOKS =====
    window.GAME_EXT.chainHook('getExtraTargets', function () {
        if (window.GAME_MODE !== MOD_ID) return undefined;
        const list = [];
        if (_turret && _turret.hp > 0) list.push(_turret);
        _friendlyBots.forEach(b => { if (b.hp > 0) list.push(b); });
        return list;
    });

    const _origUpdate = window.update;
    window.update = function (ts) {
        if (window.GAME_PAUSED) return;
        _origUpdate(ts);
    };

    const _origUBL = window.updateBulletLogic;
    window.updateBulletLogic = function (list, isBot, ts) {
        if (isBot && window.GAME_MODE === MOD_ID) {
            for (let i = list.length - 1; i >= 0; i--) {
                const b = list[i];
                if (b._waveMorBullet) {
                    b.x += b.vx * ts; b.y += b.vy * ts;
                    if (b.x < WALL_THICKNESS || b.x > canvas.width-WALL_THICKNESS ||
                        b.y < WALL_THICKNESS || b.y > canvas.height-WALL_THICKNESS ||
                        getDist(b, {x:b.sx, y:b.sy}) > 300) { list.splice(i,1); continue; }
                    let hit = false;
                    for (const o of obstacles) if (getDist(b,o) < o.radius+5) { o.hp -= 100; hit = true; break; }
                    if (hit) { list.splice(i,1); continue; }
                    if (!player.isDead && getDist(b,player) < player.radius+12) {
                        player.hp -= 200;
                        addFloatingNumber(player.x, player.y, 200, '#9b59b6');
                        player.lastHitTime = Date.now();
                        list.splice(i,1); continue;
                    }
                }
            }
        }
        const enemySnap = new Map();
        if (!isBot && window.GAME_MODE === MOD_ID) getActiveEnemies().forEach(e => enemySnap.set(e, e.hp));
        _origUBL(list, isBot, ts);
        if (!isBot && window.GAME_MODE === MOD_ID) {
            const hasBase = list.some(b => {
                const t = b.type;
                return !t || t==='main' || t==='sprout_bullet' || t==='hayalet_bullet'
                    || t==='ninja_bullet' || t==='sam_punch_light' || t==='sam_punch_heavy';
            });
            enemySnap.forEach((prevHp, e) => {
                if (e.hp < prevHp) {
                    let dmg = prevHp - e.hp;
                    if (_waveDamageMult > 1) {
                        const extra = dmg * (_waveDamageMult - 1);
                        e.hp -= extra;
                        dmg += extra;
                        if (extra >= 1) addFloatingNumber(e.x + 15, e.y - 25, '+' + Math.floor(extra), '#f1c40f');
                    }
                    if (hasBase && STATE.cancalma > 0) applyEnemyDamage(dmg);
                }
            });
        }
    };

    // ===== ÇİZİM =====
    window.GAME_EXT.chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID || !gameStarted) return;

        // Turret
        if (_turret && _turret.hp > 0) {
            ctx2.save(); ctx2.translate(_turret.x, _turret.y);
            ctx2.fillStyle = '#94a3b8';
            ctx2.beginPath(); ctx2.arc(0, 0, _turret.radius, 0, Math.PI*2); ctx2.fill();
            ctx2.strokeStyle = '#475569'; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.rotate(_turret.angle);
            ctx2.fillStyle = '#64748b'; ctx2.fillRect(_turret.radius-4, -5, 18, 10);
            ctx2.restore();
            ctx2.fillStyle='#444'; ctx2.fillRect(_turret.x-22, _turret.y-_turret.radius-12, 44, 5);
            ctx2.fillStyle='#94a3b8'; ctx2.fillRect(_turret.x-22, _turret.y-_turret.radius-12, 44*(_turret.hp/_turret.maxHp), 5);
        }

        // Dost botlar
        _friendlyBots.forEach(b => {
            if (b.hp <= 0) return;
            ctx2.save(); ctx2.translate(b.x, b.y); ctx2.rotate(b.angle);
            ctx2.fillStyle = '#3498db';
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI*2); ctx2.fill();
            ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
            ctx2.fillStyle='#444'; ctx2.fillRect(b.x-15, b.y-b.radius-12, 30, 4);
            ctx2.fillStyle='#3498db'; ctx2.fillRect(b.x-15, b.y-b.radius-12, 30*(b.hp/b.maxHp), 4);
        });
        _friendlyBullets.forEach(b => {
            ctx2.save();
            ctx2.beginPath(); ctx2.arc(b.x, b.y, 4, 0, Math.PI*2);
            ctx2.fillStyle = '#60a5fa'; ctx2.fill();
            ctx2.restore();
        });

        // Meteorlar
        _meteors.forEach(m => {
            const prog = m.t / m.dur;
            const curY = m.startY + (m.y - m.startY) * prog;
            ctx2.save(); ctx2.globalAlpha = 0.4;
            ctx2.beginPath(); ctx2.arc(m.x, m.y, 100, 0, Math.PI*2);
            ctx2.strokeStyle = '#ff8c42'; ctx2.lineWidth = 3; ctx2.setLineDash([8,6]); ctx2.stroke();
            ctx2.setLineDash([]); ctx2.restore();
            ctx2.save();
            ctx2.beginPath(); ctx2.arc(m.x, curY, 14, 0, Math.PI*2);
            ctx2.fillStyle = '#a93226'; ctx2.fill();
            ctx2.strokeStyle = '#f39c12'; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.restore();
        });

        // Elektro aura kalıcı halka
        if (STATE.elektro > 0) {
            const ranges = [130, 180, 230, 280];
            const r = ranges[STATE.elektro-1];
            const now = Date.now();
            ctx2.save();
            ctx2.globalAlpha = 0.25 + Math.sin(now/400)*0.1;
            ctx2.beginPath(); ctx2.arc(player.x, player.y, r, 0, Math.PI*2);
            ctx2.strokeStyle = '#00e5ff'; ctx2.lineWidth = 2;
            ctx2.setLineDash([10, 8]); ctx2.lineDashOffset = -now/40;
            ctx2.stroke(); ctx2.setLineDash([]);
            ctx2.restore();
        }
        _elektroFlashes.forEach(f => {
            const alpha = f.life / f.maxLife;
            ctx2.save(); ctx2.globalAlpha = alpha;
            ctx2.beginPath(); ctx2.arc(f.x, f.y, f.r, 0, Math.PI*2);
            ctx2.strokeStyle = '#00e5ff'; ctx2.lineWidth = 4; ctx2.stroke();
            ctx2.restore();
        });
    });

    // Grace soluklaştırma
    if (!window._waveOrigDrawEntity) {
        window._waveOrigDrawEntity = window.drawEntity;
        window.drawEntity = function (e, isP) {
            if (!e || window.GAME_MODE !== MOD_ID) return window._waveOrigDrawEntity.call(this, e, isP);
            if (isP) return window._waveOrigDrawEntity.call(this, e, isP);
            if (e._grace > 0) {
                const prev = ctx.globalAlpha;
                ctx.globalAlpha = Math.max(0.4, 1 - e._grace/90);
                window._waveOrigDrawEntity.call(this, e, isP);
                ctx.globalAlpha = prev;
                ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff';
                ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
                ctx.fillText('!', e.x, e.y - e.radius - 22);
                ctx.restore();
                return;
            }
            return window._waveOrigDrawEntity.call(this, e, isP);
        };
    }

    window.GAME_EXT.modKartiEkle('wave', '25 Dalga Arena', 'Klasik botlarla 25 dalga roguelite');
    console.log('[MOD YÜKLENDİ] wave (25 Dalga Arena - BASE BOTS)');
})();