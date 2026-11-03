// ========== mod14.js — 35 Dalga Arena (v7 FINAL) ==========
// - 35 dalga, TUR_LEN 7, 5 tam tur
// - Büyüyen Bot (1500/2400/3200 HP, 4/9 büyüme)
// - Zırhlı Bot (1 göz, sadece renk farkı)
// - Buff Bot kaldırıldı
// - Wave 25-35 karışık (filler / orta / tehdit)
// - 10 yuvalık özel dalga
// - Bot hasar +5/dalga, HP +50/dalga
// - Ulti şarj fix (yeşil heal ulti doldurmuyor)
(function () {
    'use strict';

    const MOD_ID = 'wave';
    const TUR_LEN = 7;
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
    let _morSlotUsed = 0;
    let _initialPickDone = false;
    let _waveBotDmgBonus = 0;
    let _donenPet = { angle: 0, x: 0, y: 0, lastShot: 0, aimAngle: 0 };
    let _donenPetBullets = [];
    let _cephanePet = { angle: 0, x: 0, y: 0, lastHeal: 0, flash: 0 };
    let _obstacleSnapshot = new Map();
    let _armoredBots = [];
    let _growingBots = [];

    // ===== ULTİ ŞARJ FIX =====
    if (window.addFloatingNumber && !window.addFloatingNumber._waveWrapped) {
        const _origFloat = window.addFloatingNumber;
        window.addFloatingNumber = function (x, y, v, c, charge) {
            if (window.GAME_MODE === 'wave' && c === '#2ecc71') {
                floatingNumbers.push({
                    x: x + (Math.random() - 0.5) * 40,
                    y: y - 20,
                    val: v, color: c, life: 60, opacity: 1
                });
                return;
            }
            return _origFloat.call(this, x, y, v, c, charge);
        };
        window.addFloatingNumber._waveWrapped = true;
    }

    // ===== 35 DALGA =====
    const WAVES = [
        // TUR 1 (1-7)
        { e:[{t:'slime',c:1}], d:4 },
        { e:[{t:'slime',c:2}], d:3 },
        { e:[{t:'slime',c:3},{t:'tur',c:1}] },
        { e:[{t:'tur',c:1},{t:'slime',c:2}] },
        { e:[{t:'tur',c:2},{t:'slime',c:2}] },
        { e:[{t:'mor',c:2},{t:'slime',c:1}] },
        { e:[{t:'slime',c:3},{t:'tur',c:2}], boss:true },
        // TUR 2 (8-14)
        { e:[{t:'slime',c:4},{t:'nest',c:1},{t:'boom',c:2}] },
        { e:[{t:'mor',c:2},{t:'boom',c:2}] },
        { e:[{t:'fog',c:1},{t:'slime',c:2}] },
        { e:[{t:'tur',c:3},{t:'mor',c:2}] },
        { e:[{t:'fog',c:2},{t:'mor',c:2},{t:'slime',c:1}] },
        { e:[{t:'boom',c:3},{t:'tur',c:2},{t:'slime',c:1}] },
        { e:[{t:'fog',c:2},{t:'tur',c:3}], boss:true },
        // TUR 3 (15-21)
        { e:[{t:'armored',c:1},{t:'slime',c:2}] },
        { e:[{t:'armored',c:1},{t:'tur',c:2},{t:'slime',c:1}] },
        { e:[{t:'armored',c:1},{t:'boom',c:2},{t:'fog',c:1}] },
        { e:[{t:'armored',c:2},{t:'slime',c:3}] },
        { e:[{t:'armored',c:2},{t:'mor',c:2},{t:'fog',c:1}] },
        { e:[{t:'armored',c:2},{t:'tur',c:3}] },
        { e:[{t:'mor',c:7}], boss:true },
        // TUR 4 (22-28)
        { e:[{t:'growing',c:1},{t:'slime',c:3}] },
        { e:[{t:'growing',c:1},{t:'armored',c:1},{t:'mor',c:2}] },
        { e:[{t:'growing',c:1},{t:'fog',c:2},{t:'boom',c:2}] },
        { e:[{t:'boom',c:4},{t:'tur',c:2}] },
        { e:[{t:'slime',c:4},{t:'mor',c:2},{t:'growing',c:1}] },
        { e:[{t:'armored',c:3},{t:'growing',c:1},{t:'slime',c:2}] },
        { e:[{t:'armored',c:4},{t:'fog',c:1},{t:'boom',c:2}], boss:true },
        // TUR 5 (29-35)
        { e:[{t:'boom',c:4},{t:'tur',c:2}] },
        { e:[{t:'slime',c:5},{t:'mor',c:2},{t:'growing',c:2}] },
        { e:[{t:'armored',c:3},{t:'fog',c:2},{t:'growing',c:1}] },
        { e:[{t:'nest',c:10}], d:10, special:'yuva' },
        { e:[{t:'slime',c:6},{t:'mor',c:2},{t:'growing',c:2}] },
        { e:[{t:'armored',c:4},{t:'fog',c:2},{t:'growing',c:1}] },
        { e:[{t:'armored',c:4},{t:'fog',c:1},{t:'growing',c:1},{t:'tur',c:1},{t:'boom',c:1},{t:'slime',c:1}], boss:true, final:true }
    ];

    const CARDS = {
        maxhp:       { name:'Maks HP',          rarity:'common', max:4, desc:'+%35 max HP / seviye' },
        hiz:         { name:'Hız',              rarity:'common', max:4, desc:'+%8 hız + +%8 cephane' },
        regen:       { name:'Regen',            rarity:'common', max:4, desc:'+50/100/180/300 HP/sn' },
        temas:       { name:'Temas Hasarı',     rarity:'rare',   max:4, desc:'Değdiğin düşmana 600/900/1400/2000 (3sn cd) + itme' },
        donen_pet:   { name:'Dönen Pet',        rarity:'rare',   max:4, desc:'Etrafında dönen pet, bot+siper 100-250 DPS' },
        yansima:     { name:'Yansıma',          rarity:'rare',   max:4, desc:'Her N. vuruşta %60 yansıma + heal' },
        dostbot:     { name:'Dost Bot',         rarity:'rare',   max:4, desc:'Yardımcı botlar' },
        meteor:      { name:'Meteor',           rarity:'rare',   max:4, desc:'Periyodik AOE göktaşı' },
        siper_aoe:   { name:'Siper Patlatma',   rarity:'rare',   max:4, desc:'Siper kırılınca AOE 400/700/1100/1600' },
        cephane_pet: { name:'Cephane Peti',     rarity:'epic',   max:4, desc:'Ateşlemede +175/215/260/300 can (0.75sn cd)' },
        elektro:     { name:'Elektro Aura',     rarity:'epic',   max:4, desc:'Yakın düşmanlara şok + pasif' },
        kule:        { name:'Kule',             rarity:'epic',   max:4, desc:'Otomatik ateş eden kule' },
        hayat:       { name:'Hayat Sigortası',  rarity:'epic',   max:4, desc:'Can≤500 iken kurtarma (1/dalga)' }
    };

    const STATE = {};
    Object.keys(CARDS).forEach(k => STATE[k] = 0);
    window._waveSTATE = STATE;

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

    // ===== SPAWN FONKSİYONLARI =====
    function spawnSlime(x, y) { spawnSlimeBot(x, y, 0); return slimeBots[slimeBots.length-1]; }
    function spawnTur(x, y) { const b={x,y,radius:25,color:'#e67e22',speed:0,hp:1500,maxHp:1500,isDead:false,angle:0,lastShot:0,shootInterval:750,kbX:0,kbY:0,alerted:false,bombaBulasti:false,bombaSayaci:0,ghostRingDebounce:0}; stationaryBots.push(b); return b; }
    function spawnBoom(x, y) { const b={x,y,radius:20,color:'#00ced1',speed:0.5,hp:1600,maxHp:1600,isDead:false,angle:0,lastShot:0,shootInterval:1500,kbX:0,kbY:0,alerted:false,bombaBulasti:false,bombaSayaci:0,ghostRingDebounce:0}; boomerangBots.push(b); return b; }
    function spawnFog(x, y) { const b={x,y,radius:35,color:'#7f8c8d',isFog:true,speed:1.0,hp:5000,maxHp:5000,isDead:false,angle:0,kbX:0,kbY:0,alerted:false,bombaBulasti:false,bombaSayaci:0,ghostRingDebounce:0}; fogBots.push(b); return b; }
    function spawnMor(x, y) {
        const slot = _morSlotUsed === 0 ? bot : bot2;
        _morSlotUsed++;
        slot.isActive = true; slot.isDead = false;
        slot.x = x; slot.y = y;
        slot.hp = slot.maxHp = 3000;
        slot.kbX = slot.kbY = 0;
        slot.lastShot = 0;
        slot.respawnTimer = 0;
        slot._morActive = true;
        return slot;
    }
    function spawnNest(x, y) {
        const n = {x, y, radius:40, color:'#27ae60', isNest:true, speed:0, hp:3000, maxHp:3000,
                   isDead:false, kbX:0, kbY:0, alerted:false, lastSpawn:Date.now(),
                   spawnCount:0, bombaBulasti:false, bombaSayaci:0, _isWaveNest:true};
        nests.push(n); return n;
    }
    function spawnArmored(x, y) {
        const b = {
            x, y, radius: 26, color: '#7c5c9a', speed: 0.8,
            hp: 5000, maxHp: 5000, shield: 1500, maxShield: 1500,
            angle: 0, lastShot: 0, shootInterval: 1800,
            isDead: false, kbX: 0, kbY: 0,
            _isArmored: true, _lastDamageTime: 0,
            _healTimer: 0
        };
        _armoredBots.push(b);
        return b;
    }
    function spawnGrowing(x, y) {
        const b = {
            x, y, radius: 15, color: '#7a1f2b', speed: 1.0,
            hp: 1500, maxHp: 1500,
            angle: 0, lastShot: 0, shootInterval: 1400,
            isDead: false, kbX: 0, kbY: 0,
            _isGrowing: true, _growthCount: 0, _stage: 0
        };
        _growingBots.push(b);
        return b;
    }

    function spawnWave(idx) {
        if (window.GAME_MODE !== MOD_ID) return;
        const w = WAVES[idx];
        if (!w) return;
        _morSlotUsed = 0;
        _armoredBots = [];
        _growingBots = [];
        const dirs = ['top','bottom','left','right'];
        let dIdx = 0;
        const hpBonus = idx * 50;
        const dmgBonus = idx * 5;
        _waveBotDmgBonus = dmgBonus;
        window._waveBotDmgBonus = dmgBonus;

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
                else if (group.t === 'armored') e = spawnArmored(p.x, p.y);
                else if (group.t === 'growing') e = spawnGrowing(p.x, p.y);
                if (e) {
                    e.maxHp += hpBonus;
                    e.hp = e.maxHp;
                    if (e._isArmored) { e.maxShield = 1500 + idx * 20; e.shield = e.maxShield; }
                    e._grace = w.boss ? SPAWN_GRACE_BOSS : SPAWN_GRACE;
                    e._baseSpeed = e.speed || 0;
                    e.speed = 0;
                }
            }
        });

        waveActive = true;
        _hayatUsedThisWave = false;

        if (STATE.kule > 0) {
            const mh = 2000 + (STATE.kule-1)*600;
            _turret = { x: player.x, y: player.y, radius: 22, hp: mh, maxHp: mh, angle: 0, lastShot: 0, _isTurret: true };
        } else { _turret = null; }

        _friendlyBots = [];
        if (STATE.dostbot > 0) {
            const types = ['piyade','ranger','havan'];
            const count = Math.min(STATE.dostbot, 3);
            const mult = STATE.dostbot >= 4 ? 1.5 : 1;
            for (let i = 0; i < count; i++) {
                _friendlyBots.push({
                    x: player.x + (Math.random()-0.5)*100, y: player.y + 60,
                    radius: 15, angle: 0, lastShot: 0, type: types[i], color: '#3498db',
                    hp: 800 * mult, maxHp: 800 * mult, damage: 150 * mult, _isFriendly: true
                });
            }
        }

        _meteorTimer = 0;
        _elektroTimer = 0;
        _donenPet.lastShot = 0;
        _donenPetBullets = [];
        _cephanePet.lastHeal = 0;
        _cephanePet.flash = 0;
        _obstacleSnapshot.clear();
        obstacles.concat(cactusWalls || []).forEach(o => {
            _obstacleSnapshot.set(o, { x: o.x, y: o.y, hp: o.hp });
        });

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
        if (picks.length === 0) {
            if (!_initialPickDone) { _initialPickDone = true; spawnWave(0); }
            else nextWave();
            return;
        }
        const overlay = document.createElement('div');
        overlay.id = 'wave-upgrade';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:100;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:20px;';
        const title = document.createElement('h2');
        title.textContent = waveIndex === 0 && !_initialPickDone ? 'BAŞLANGIÇ' : `DALGA ${waveIndex} BİTTİ`;
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
        if (!_initialPickDone) {
            _initialPickDone = true;
            spawnWave(0);
        } else {
            nextWave();
        }
    }

    function applyCard(k, lv) {
        if (k === 'maxhp') {
            if (!_baseMaxHp) _baseMaxHp = player.maxHp;
            const target = _baseMaxHp * (1 + lv * 0.35);
            const diff = target - player.maxHp;
            player.maxHp = target;
            player.hp += diff;
        } else if (k === 'hiz') {
            const pct = lv * 0.08;
            player.speed = (player.originalSpeed || player.speed) * (1 + pct);
            player.reloadSpeed = 0.015 * (1 + pct);
        }
    }

    function nextWave() {
        waveIndex++;
        if (waveIndex > 0 && waveIndex % 7 === 0 && !player.isDead) {
            const heal = player.maxHp * 0.5;
            player.hp = Math.min(player.maxHp, player.hp + heal);
            addFloatingNumber(player.x, player.y - 40, '+' + Math.floor(heal), '#2ecc71');
        }
        if (waveIndex >= WAVES.length) { victory(); return; }
        _friendlyBots = [];
        _turret = null;
        setTimeout(() => spawnWave(waveIndex), 300);
    }

    function victory() {
        window.GAME_PAUSED = true;
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:200;display:flex;flex-direction:column;justify-content:center;align-items:center;';
        ov.innerHTML = '<h1 style="color:#f1c40f;font-size:52px;">ZAFER!</h1><p style="color:#fff;font-size:20px;margin:20px 0 30px;">35 dalga tamamlandı!</p><button onclick="location.reload()" style="padding:15px 40px;font-size:18px;background:#2ecc71;color:#fff;border:none;border-radius:10px;cursor:pointer;">Yeniden Başla</button>';
        document.body.appendChild(ov);
    }

    function updateHUD() {
        let h = document.getElementById('wave-hud');
        if (!h) {
            h = document.createElement('div');
            h.id = 'wave-hud';
            h.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);padding:8px 20px;border-radius:20px;color:#f1c40f;font-weight:bold;font-size:15px;z-index:50;pointer-events:none;display:none;text-align:center;';
            document.body.appendChild(h);
        }
        h.style.display = 'block';
        const tur = Math.floor(waveIndex / TUR_LEN) + 1;
        let txt = `TUR ${tur} • DALGA ${waveIndex + 1} / ${WAVES.length}`;
        if (_waveBotDmgBonus > 0) {
            txt += `<br><span style="font-size:12px;color:#f39c12;">Düşman hasarı +${_waveBotDmgBonus}</span>`;
        }
        h.innerHTML = txt;
    }    // ===== KART MANTIKLARI =====
    function applyPlayerDamage(dmg) {
        if (STATE.yansima > 0) {
            _reflectCounter++;
            const thresholds = [5, 4, 3, 3];
            const heals =     [0, 0.10, 0.15, 0.25];
            const lv = STATE.yansima;
            const need = thresholds[lv-1];
            if (_reflectCounter >= need) {
                _reflectCounter = 0;
                const reflect = dmg * 0.60;
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
            player.hp = Math.min(player.maxHp, player.hp + 1500);
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
            const dmg = [700, 1200, 1800, 2500][STATE.meteor-1];
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
        const ranges = [100, 125, 150, 180];
        const dpss   = [40, 90, 160, 250];
        const stuns  = [30, 60, 90, 90];
        const shockDps = [80, 180, 300, 450];
        const r = ranges[STATE.elektro-1];
        const dps = dpss[STATE.elektro-1];
        const stun = stuns[STATE.elektro-1];
        const sDps = shockDps[STATE.elektro-1];

        if (_elektroTimer >= 240) {
            _elektroTimer = 0;
            const shockR = r * 1.2;
            const enemies = getActiveEnemies().filter(e => getDist(e, player) < shockR);
            enemies.slice(0, 3).forEach(e => {
                e._stunTimer = Math.max(e._stunTimer || 0, stun);
                e._elektroDot = Math.max(e._elektroDot || 0, 60);
                e._elektroDps = sDps;
                addFloatingNumber(e.x, e.y, 'ŞOK!', '#00e5ff');
            });
            if (enemies.length > 0) _elektroFlashes.push({ x: player.x, y: player.y, r: shockR, life: 12, maxLife: 12 });
        }
        let passiveTotal = 0;
        getActiveEnemies().forEach(e => {
            if (!e.isDead && getDist(e, player) < r) {
                const d = dps / 60 * ts;
                e.hp -= d;
                passiveTotal += d;
            }
        });
        player._elektroFloat = (player._elektroFloat || 0) + ts;
        if (player._elektroFloat >= 120 && passiveTotal > 0) {
            player._elektroFloat = 0;
            addFloatingNumber(player.x, player.y - 30, '+' + Math.floor(passiveTotal), '#00e5ff');
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
                const dmg = 180 + (STATE.kule-1)*60;
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

    function updateTemas(ts) {
        if (player.isDead) return;
        const dmg = [600, 900, 1400, 2000][STATE.temas-1];
        getActiveEnemies().forEach(e => {
            if (e.isDead) return;
            if (slimeBots.includes(e)) return;
            if (e._temasCD > 0) { e._temasCD -= ts; return; }
            if (getDist(player, e) < player.radius + e.radius + 4) {
                e.hp -= dmg;
                e._temasCD = 180;
                const ang = getAngle(player, e);
                e.x += Math.cos(ang) * 10;
                e.y += Math.sin(ang) * 10;
                e.x = clampPos(e.x, e.radius + WALL_THICKNESS, canvas.width - e.radius - WALL_THICKNESS);
                e.y = clampPos(e.y, e.radius + WALL_THICKNESS, canvas.height - e.radius - WALL_THICKNESS);
                addFloatingNumber(e.x, e.y, dmg, '#f1c40f');
                screenShake = Math.max(screenShake, 3);
            }
        });
    }

    function updateDonenPet(ts) {
        _donenPet.angle += 0.08 * ts;
        const petR = 55;
        _donenPet.x = player.x + Math.cos(_donenPet.angle) * petR;
        _donenPet.y = player.y + Math.sin(_donenPet.angle) * petR;
        _donenPet.lastShot += ts;
        const dmg = [100, 150, 200, 250][STATE.donen_pet-1];
        if (_donenPet.lastShot >= 45) {
            _donenPet.lastShot = 0;
            const enemies = getActiveEnemies().filter(e => !e.isDead);
            let target = null, minD = Infinity;
            enemies.forEach(e => { const d = getDist(_donenPet, e); if (d < minD) { minD = d; target = e; } });
            if (target) {
                const ang = Math.atan2(target.y - _donenPet.y, target.x - _donenPet.x);
                _donenPet.aimAngle = ang;
                _donenPetBullets.push({
                    x: _donenPet.x, y: _donenPet.y,
                    vx: Math.cos(ang) * 8, vy: Math.sin(ang) * 8,
                    life: 60, damage: dmg
                });
            }
        }
        for (let i = _donenPetBullets.length-1; i >= 0; i--) {
            const b = _donenPetBullets[i];
            b.x += b.vx * ts; b.y += b.vy * ts;
            b.life -= ts;
            if (b.life <= 0) { _donenPetBullets.splice(i,1); continue; }
            let hit = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(b, o) < o.radius + 3) {
                    o.hp -= b.damage * 0.5;
                    hit = true; break;
                }
            }
            if (!hit) {
                for (const e of getActiveEnemies()) {
                    if (e.isDead || e._grace > 0) continue;
                    if (getDist(b, e) < e.radius + 4) {
                        e.hp -= b.damage;
                        addFloatingNumber(e.x, e.y, b.damage, '#a78bfa');
                        hit = true; break;
                    }
                }
            }
            if (hit) _donenPetBullets.splice(i,1);
        }
    }

    function updateCephanePet(ts) {
        _cephanePet.angle += 0.08 * ts;
        const petR = 55;
        _cephanePet.x = player.x + Math.cos(_cephanePet.angle + Math.PI) * petR;
        _cephanePet.y = player.y + Math.sin(_cephanePet.angle + Math.PI) * petR;
        if (_cephanePet.flash > 0) _cephanePet.flash -= ts;
    }

    function updateSiperAOE() {
        const dmg = [400, 700, 1100, 1600][STATE.siper_aoe-1];
        const radius = 55 + STATE.siper_aoe * 8;
        _obstacleSnapshot.forEach((snap, o) => {
            const alive = obstacles.includes(o) || (cactusWalls && cactusWalls.includes(o));
            if (!alive) {
                getActiveEnemies().forEach(e => {
                    if (e.isDead) return;
                    if (getDist(snap, e) < radius + e.radius) {
                        e.hp -= dmg;
                        addFloatingNumber(e.x, e.y, dmg, '#f39c12');
                    }
                });
                explosions.push({ x: snap.x, y: snap.y, radius: 10, maxRadius: radius, life: 15, maxLife: 15 });
                screenShake = Math.max(screenShake, 5);
                _obstacleSnapshot.delete(o);
            } else {
                snap.x = o.x; snap.y = o.y; snap.hp = o.hp;
            }
        });
        obstacles.concat(cactusWalls || []).forEach(o => {
            if (!_obstacleSnapshot.has(o)) {
                _obstacleSnapshot.set(o, { x: o.x, y: o.y, hp: o.hp });
            }
        });
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
                if (e._stunTimer <= 0 && !e._frozen) {
                    e.speed = e._stunSavedSpeed || e.baseSpeed || 1;
                    if (e._stunSavedInterval) e.shootInterval = e._stunSavedInterval;
                    delete e._stunSavedSpeed; delete e._stunSavedInterval;
                }
            }
        });
    }

    function updateArmoredBots(ts) {
        _armoredBots.forEach(b => {
            if (b.isDead) return;
            if (b.hp <= 0) {
                b.isDead = true;
                spawnParticles(b.x, b.y, b.color, 'smoke');
                triggerBotKill(b.x, b);
                return;
            }
            if (b._grace > 0) { b._grace -= ts; return; }
            if (b._stunTimer > 0 || b._frozen) return;

            if (b.shield < b.maxShield && Date.now() - b._lastDamageTime > 12000) {
                b.shield = b.maxShield;
            }

            b._healTimer += ts;
            if (b._healTimer >= 180) {
                b._healTimer = 0;
                if (b.hp < b.maxHp) {
                    b.hp = Math.min(b.maxHp, b.hp + 200);
                    b._healPulse = 12;
                }
            }
            if (b._healPulse > 0) b._healPulse -= ts;

            const canSee = !player.isDead && !player.isInvisible;
            if (canSee) {
                const dP = getDist(b, player);
                b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                if (dP > 180) { b.x += Math.cos(b.angle) * b.speed * ts; b.y += Math.sin(b.angle) * b.speed * ts; }
                if (dP < 320 && Date.now() - b.lastShot > b.shootInterval) {
                    b.lastShot = Date.now();
                    botBullets.push({
                        x: b.x, y: b.y, sx: b.x, sy: b.y,
                        vx: Math.cos(b.angle) * BOT_BULLET_SPEED,
                        vy: Math.sin(b.angle) * BOT_BULLET_SPEED,
                        _waveArmoredBullet: true, owner: b
                    });
                }
            }
            if (Math.abs(b.kbX) > 0.1 || Math.abs(b.kbY) > 0.1) {
                b.x += b.kbX*ts; b.y += b.kbY*ts; b.kbX *= 0.85; b.kbY *= 0.85;
            }
            b.x = clampPos(b.x, b.radius+WALL_THICKNESS, canvas.width-b.radius-WALL_THICKNESS);
            b.y = clampPos(b.y, b.radius+WALL_THICKNESS, canvas.height-b.radius-WALL_THICKNESS);
        });
    }

    function updateGrowingBots(ts) {
        _growingBots.forEach(b => {
            if (b.isDead) return;
            if (b.hp <= 0) {
                b.isDead = true;
                spawnParticles(b.x, b.y, b.color, 'smoke');
                triggerBotKill(b.x, b);
                return;
            }
            if (b._grace > 0) { b._grace -= ts; return; }
            if (b._stunTimer > 0 || b._frozen) return;

            // İlk spawn'da büyüme sayacını wave'e göre ayarla
            if (!b._initialized) {
                b._initialized = true;
                b._growthCount = Math.max(0, waveIndex - 24) + b._growthCount;
            }

            // Aşama güncelle
            const newStage = b._growthCount >= 9 ? 2 : (b._growthCount >= 4 ? 1 : 0);
            if (newStage !== b._stage) {
                b._stage = newStage;
                if (newStage === 1) { b.radius = 22; b.maxHp = 2400; b.hp = Math.min(2400, b.hp + 400); }
                if (newStage === 2) { b.radius = 30; b.maxHp = 3200; b.hp = Math.min(3200, b.hp + 400); }
                b._upgradeFlash = 12;
            }
            if (b._upgradeFlash > 0) b._upgradeFlash -= ts;

            const canSee = !player.isDead && !player.isInvisible;
            if (canSee) {
                const dP = getDist(b, player);
                b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                if (dP > 180) { b.x += Math.cos(b.angle) * b.speed * ts; b.y += Math.sin(b.angle) * b.speed * ts; }
                if (dP < 300 && Date.now() - b.lastShot > b.shootInterval) {
                    b.lastShot = Date.now();
                    const missileCount = b._stage === 0 ? 1 : 3;
                    const missileDmg = b._stage === 2 ? 400 : 250;
                    for (let i = 0; i < missileCount; i++) {
                        const spread = missileCount === 1 ? 0 : (i - 1) * 0.2;
                        botBullets.push({
                            x: b.x, y: b.y, sx: b.x, sy: b.y,
                            vx: Math.cos(b.angle + spread) * BOT_BULLET_SPEED,
                            vy: Math.sin(b.angle + spread) * BOT_BULLET_SPEED,
                            _waveGrowingBullet: true, _growingDmg: missileDmg, owner: b
                        });
                    }
                }
            }
            if (Math.abs(b.kbX) > 0.1 || Math.abs(b.kbY) > 0.1) {
                b.x += b.kbX*ts; b.y += b.kbY*ts; b.kbX *= 0.85; b.kbY *= 0.85;
            }
            b.x = clampPos(b.x, b.radius+WALL_THICKNESS, canvas.width-b.radius-WALL_THICKNESS);
            b.y = clampPos(b.y, b.radius+WALL_THICKNESS, canvas.height-b.radius-WALL_THICKNESS);
        });
    }

    // ===== MODE =====
    window.GAME_EXT.registerMode(MOD_ID, {
        label: '35 Dalga Arena',
        onStart: function () {
            waveIndex = 0; waveActive = false;
            _baseMaxHp = 0; _lastEpicWave = -10;
            _hayatUsedThisWave = false; _lastPlayerHp = 0;
            _reflectCounter = 0; _waveDamageMult = 1; _waveBotDmgBonus = 0;
            _meteorTimer = 0; _meteors = [];
            _elektroTimer = 0; _elektroFlashes = [];
            _turret = null; _friendlyBots = []; _friendlyBullets = [];
            _morSlotUsed = 0; _initialPickDone = false;
            _donenPet = { angle: 0, x: 0, y: 0, lastShot: 0, aimAngle: 0 };
            _donenPetBullets = [];
            _cephanePet = { angle: 0, x: 0, y: 0, lastHeal: 0, flash: 0 };
            _armoredBots = []; _growingBots = [];
            _obstacleSnapshot.clear();
            Object.keys(STATE).forEach(k => STATE[k] = 0);
            window.GAME_PAUSED = false;
            window._waveDamageMult = 1;
            window._waveBotDmgBonus = 0;

            bot.isActive = false; bot.isDead = true; bot.x = -9999; bot.y = -9999;
            bot2.isActive = false; bot2.isDead = true; bot2.x = -9999; bot2.y = -9999;
            slimeBots = []; stationaryBots = []; boomerangBots = []; fogBots = [];
            nests = []; spawnIndicators = [];
            window.GAME_MODE_DISABLED_BOT_TYPES = ['slime','stationary','boomerang','fog'];

            updateHUD();
            window.GAME_PAUSED = true;
            setTimeout(() => showUpgrade(), 200);
        },

        onUpdate: function (ts) {
            if (window.GAME_MODE !== MOD_ID || window.GAME_PAUSED) return;

            slimeTimer = 0; stationaryTimer = 0; boomerangTimer = 0; fogBotTimer = 0;
            spawnIndicators = [];
            lastNestKillCount = botsKilled;
            botsKilled = 0;
            if (nests.length > 1) nests.length = 1;

            if (STATE.regen > 0 && !player.isDead) {
                const regenVals = [50, 100, 180, 300];
                player.hp = Math.min(player.maxHp, player.hp + (regenVals[STATE.regen-1] / 60) * ts);
                player._regenFloat = (player._regenFloat || 0) + ts;
                if (player._regenFloat >= 60) {
                    player._regenFloat = 0;
                    addFloatingNumber(player.x, player.y - 20, '+' + regenVals[STATE.regen-1], '#2ecc71');
                }
            }

            if (player._waveHayatUntil) {
                if (Date.now() < player._waveHayatUntil) player.jumpInvulnerable = true;
                else { if (!player.isJumping) player.jumpInvulnerable = false; player._waveHayatUntil = 0; }
            }

            if (_lastPlayerHp > 0 && player.hp < _lastPlayerHp && !player.isDead) {
                applyPlayerDamage(_lastPlayerHp - player.hp);
            }
            _lastPlayerHp = player.hp;

            updateStun(ts);
            if (STATE.meteor > 0) updateMeteor(ts);
            if (STATE.elektro > 0) updateElektro(ts);
            if (STATE.kule > 0) updateTurret(ts);
            if (STATE.dostbot > 0) updateFriendlyBots(ts);
            if (STATE.temas > 0) updateTemas(ts);
            if (STATE.donen_pet > 0) updateDonenPet(ts);
            if (STATE.cephane_pet > 0) updateCephanePet(ts);
            if (STATE.siper_aoe > 0) updateSiperAOE();
            updateArmoredBots(ts);
            updateGrowingBots(ts);

            getActiveEnemies().forEach(e => {
                if (e._healPulse > 0) e._healPulse -= ts;
            });

            [bot, bot2].forEach(b => {
                if (!b.isActive) return;
                if (b.isDead || b.hp <= 0) {
                    if (!b._waveDeathHandled) {
                        b.isDead = true;
                        b.isActive = false;
                        b._waveDeathHandled = true;
                        spawnParticles(b.x, b.y, b.color);
                        triggerBotKill(b.x, b);
                    }
                    return;
                }
                b._waveDeathHandled = false;
                if (b._grace > 0) { b._grace -= ts; return; }
                if (b._stunTimer > 0 || b._frozen) return;
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

            const allEnemies = [bot, bot2, ...slimeBots, ...stationaryBots, ...boomerangBots, ...fogBots, ...nests, ..._armoredBots, ..._growingBots];
            allEnemies.forEach(e => {
                if (e._grace > 0) e._grace -= ts;
                if (e._grace <= 0 && e.speed === 0 && e._baseSpeed && !e._frozen && !(e._stunTimer > 0)) e.speed = e._baseSpeed;
            });

            for (let i = _armoredBots.length-1; i >= 0; i--) if (_armoredBots[i].isDead) _armoredBots.splice(i, 1);
            for (let i = _growingBots.length-1; i >= 0; i--) if (_growingBots[i].isDead) _growingBots.splice(i, 1);

            if (waveActive) {
                const enemiesLeft =
                    (bot.isActive && !bot.isDead ? 1 : 0) +
                    (bot2.isActive && !bot2.isDead ? 1 : 0) +
                    slimeBots.filter(s => !s.isDead && s.hp > 0).length +
                    stationaryBots.filter(s => !s.isDead && s.hp > 0).length +
                    boomerangBots.filter(s => !s.isDead && s.hp > 0).length +
                    fogBots.filter(s => !s.isDead && s.hp > 0).length +
                    nests.filter(n => !n.isDead && n.hp > 0).length +
                    _armoredBots.filter(b => !b.isDead && b.hp > 0).length +
                    _growingBots.filter(b => !b.isDead && b.hp > 0).length;
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
            _reflectCounter = 0; _waveDamageMult = 1; _waveBotDmgBonus = 0;
            _meteorTimer = 0; _meteors = [];
            _elektroTimer = 0; _elektroFlashes = [];
            _turret = null; _friendlyBots = []; _friendlyBullets = [];
            _morSlotUsed = 0; _initialPickDone = false;
            _donenPet = { angle: 0, x: 0, y: 0, lastShot: 0, aimAngle: 0 };
            _donenPetBullets = [];
            _cephanePet = { angle: 0, x: 0, y: 0, lastHeal: 0, flash: 0 };
            _armoredBots = []; _growingBots = [];
            _obstacleSnapshot.clear();
            Object.keys(STATE).forEach(k => STATE[k] = 0);
            window.GAME_PAUSED = false;
            window._waveDamageMult = 1;
            window._waveBotDmgBonus = 0;
            const ov = document.getElementById('wave-upgrade');
            if (ov) ov.remove();
            const hud = document.getElementById('wave-hud');
            if (hud) hud.style.display = 'none';
        }
    });

    // ===== HOOKS =====
    window.GAME_EXT.chainHook('getExtraEnemies', function () {
        if (window.GAME_MODE !== MOD_ID) return undefined;
        return _armoredBots.filter(b => !b.isDead).concat(_growingBots.filter(b => !b.isDead));
    });

    window.GAME_EXT.chainHook('getExtraTargets', function () {
        if (window.GAME_MODE !== MOD_ID) return undefined;
        const list = [];
        if (_turret && _turret.hp > 0) list.push(_turret);
        _friendlyBots.forEach(b => { if (b.hp > 0) list.push(b); });
        return list;
    });

    // Büyüme sayacı — her düşman ölümünde büyüyen botlar beslenir
    window.GAME_EXT.chainHook('onEnemyKilled', function (enemy) {
        if (window.GAME_MODE !== MOD_ID) return;
        if (!enemy || enemy._isGrowing) return;
        _growingBots.forEach(b => { if (!b.isDead) b._growthCount++; });
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
                if (b._waveMorBullet || b._waveArmoredBullet || b._waveGrowingBullet) {
                    b.x += b.vx * ts; b.y += b.vy * ts;
                    const isArmoredBullet = b._waveArmoredBullet;
                    const isGrowingBullet = b._waveGrowingBullet;
                    const range = isArmoredBullet ? 320 : 300;
                    if (b.x < WALL_THICKNESS || b.x > canvas.width-WALL_THICKNESS ||
                        b.y < WALL_THICKNESS || b.y > canvas.height-WALL_THICKNESS ||
                        getDist(b, {x:b.sx, y:b.sy}) > range) { list.splice(i,1); continue; }
                    let hit = false;
                    for (const o of obstacles) if (getDist(b,o) < o.radius+5) { o.hp -= 100; hit = true; break; }
                    if (hit) { list.splice(i,1); continue; }
                    if (!player.isDead && getDist(b,player) < player.radius+12) {
                        let dmg = 200;
                        let col = '#9b59b6';
                        if (isArmoredBullet) { dmg = 500; col = '#7c5c9a'; }
                        else if (isGrowingBullet) { dmg = b._growingDmg || 250; col = '#7a1f2b'; }
                        player.hp -= dmg;
                        addFloatingNumber(player.x, player.y, dmg, col);
                        player.lastHitTime = Date.now();
                        list.splice(i,1); continue;
                    }
                }
            }
        }

        const enemySnap = new Map();
        if (!isBot && window.GAME_MODE === MOD_ID) getActiveEnemies().forEach(e => enemySnap.set(e, e.hp));
        const playerHpBefore = player.hp;

        _origUBL(list, isBot, ts);

        if (isBot && window.GAME_MODE === MOD_ID && _waveBotDmgBonus > 0) {
            const taken = playerHpBefore - player.hp;
            if (taken > 0) player.hp -= _waveBotDmgBonus;
        }

        if (!isBot && window.GAME_MODE === MOD_ID) {
            enemySnap.forEach((prevHp, e) => {
                if (e.hp < prevHp) {
                    const dmgDealt = prevHp - e.hp;
                    // Ek hasar
                    if (_waveDamageMult > 1) {
                        const extra = dmgDealt * (_waveDamageMult - 1);
                        e.hp -= extra;
                        if (extra >= 1) addFloatingNumber(e.x + 15, e.y - 25, '+' + Math.floor(extra), '#f1c40f');
                    }
                    // Kalkan absorbe (FIX: sadece gerçek hasar kadar)
                    if (e._isArmored && e.shield > 0) {
                        const absorbed = Math.min(e.shield, dmgDealt, 100);
                        e.shield -= absorbed;
                        e.hp = Math.min(e.maxHp, e.hp + absorbed);
                        e._lastDamageTime = Date.now();
                    } else if (e._isArmored) {
                        e._lastDamageTime = Date.now();
                    }
                }
            });
        }
    };

    const _origConsumeAmmo = Player.prototype.consumeAmmo;
    Player.prototype.consumeAmmo = function () {
        _origConsumeAmmo.call(this);
        if (window.GAME_MODE === 'wave' && window._waveSTATE && window._waveSTATE.cephane_pet > 0) {
            const now = Date.now();
            if (!this._cephanePetLast || now - this._cephanePetLast >= 750) {
                this._cephanePetLast = now;
                const heals = [175, 215, 260, 300];
                const heal = heals[window._waveSTATE.cephane_pet - 1];
                this.hp = Math.min(this.maxHp, this.hp + heal);
                addFloatingNumber(this.x, this.y - 30, '+' + heal, '#2ecc71');
                _cephanePet.flash = 12;
            }
        }
    };

    // ===== ÇİZİM =====
    window.GAME_EXT.chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID || !gameStarted) return;

        // Zırhlı botlar
        _armoredBots.forEach(b => {
            if (b.isDead) return;
            const alpha = b._grace > 0 ? Math.max(0.4, 1 - b._grace/90) : 1;
            ctx2.save();
            ctx2.globalAlpha = alpha;
            ctx2.translate(b.x, b.y);
            if (b.shield > 0) {
                ctx2.beginPath();
                ctx2.arc(0, 0, b.radius + 8, 0, Math.PI*2);
                ctx2.strokeStyle = `rgba(255,255,255,${0.4 + 0.4 * (b.shield/b.maxShield)})`;
                ctx2.lineWidth = 3;
                ctx2.stroke();
            }
            if (b._healPulse > 0) {
                ctx2.save();
                ctx2.globalAlpha = (b._healPulse / 12) * 0.4;
                ctx2.beginPath(); ctx2.arc(0, 0, b.radius + 4, 0, Math.PI*2);
                ctx2.fillStyle = '#2ecc71'; ctx2.fill();
                ctx2.restore();
            }
            ctx2.rotate(b.angle);
            ctx2.fillStyle = b.color;
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI*2); ctx2.fill();
            ctx2.beginPath();
            ctx2.arc(b.radius - 4, 0, 5, 0, Math.PI*2);
            ctx2.fillStyle = 'rgba(0,0,0,.4)';
            ctx2.fill();
            ctx2.restore();
            ctx2.fillStyle = '#444'; ctx2.fillRect(b.x - 22, b.y - b.radius - 15, 44, 5);
            ctx2.fillStyle = '#dc2626'; ctx2.fillRect(b.x - 22, b.y - b.radius - 15, 44 * Math.min(1, b.hp/b.maxHp), 5);
            if (b.shield > 0) {
                ctx2.fillStyle = '#1e293b'; ctx2.fillRect(b.x - 22, b.y - b.radius - 20, 44, 3);
                ctx2.fillStyle = '#93c5fd'; ctx2.fillRect(b.x - 22, b.y - b.radius - 20, 44 * (b.shield / b.maxShield), 3);
            }
            if (b._grace > 0) {
                ctx2.save(); ctx2.fillStyle = '#fff';
                ctx2.font = 'bold 14px Arial'; ctx2.textAlign = 'center';
                ctx2.fillText('!', b.x, b.y - b.radius - 32);
                ctx2.restore();
            }
        });

        // Büyüyen botlar
        _growingBots.forEach(b => {
            if (b.isDead) return;
            const alpha = b._grace > 0 ? Math.max(0.4, 1 - b._grace/90) : 1;
            ctx2.save();
            ctx2.globalAlpha = alpha;
            ctx2.translate(b.x, b.y);
            if (b._upgradeFlash > 0) {
                ctx2.save();
                ctx2.globalAlpha = (b._upgradeFlash / 12) * 0.7;
                ctx2.beginPath(); ctx2.arc(0, 0, b.radius + 10, 0, Math.PI*2);
                ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 3; ctx2.stroke();
                ctx2.restore();
            }
            ctx2.rotate(b.angle);
            ctx2.fillStyle = b.color;
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI*2); ctx2.fill();
            ctx2.beginPath();
            ctx2.arc(b.radius - 4, 0, 5, 0, Math.PI*2);
            ctx2.fillStyle = 'rgba(0,0,0,.4)';
            ctx2.fill();
            ctx2.restore();
            ctx2.fillStyle = '#444'; ctx2.fillRect(b.x - 20, b.y - b.radius - 15, 40, 5);
            ctx2.fillStyle = '#dc2626'; ctx2.fillRect(b.x - 20, b.y - b.radius - 15, 40 * Math.min(1, b.hp/b.maxHp), 5);
            if (b._grace > 0) {
                ctx2.save(); ctx2.fillStyle = '#fff';
                ctx2.font = 'bold 14px Arial'; ctx2.textAlign = 'center';
                ctx2.fillText('!', b.x, b.y - b.radius - 22);
                ctx2.restore();
            }
        });

        // Heal pulse
        getActiveEnemies().forEach(e => {
            if (e._healPulse > 0 && e.radius) {
                ctx2.save();
                ctx2.globalAlpha = (e._healPulse / 20) * 0.4;
                ctx2.beginPath(); ctx2.arc(e.x, e.y, e.radius + 6, 0, Math.PI*2);
                ctx2.fillStyle = '#e8a0c4'; ctx2.fill();
                ctx2.restore();
            }
        });

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

        _friendlyBots.forEach(b => {
            if (b.hp <= 0) return;
            ctx2.save(); ctx2.translate(b.x, b.y); ctx2.rotate(b.angle);
            ctx2.fillStyle = '#3498db';
            ctx2.beginPath(); ctx2.arc(0, 0, b.radius, 0, Math.PI*2); ctx2.fill();
            ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        });
        _friendlyBullets.forEach(b => {
            ctx2.save();
            ctx2.beginPath(); ctx2.arc(b.x, b.y, 4, 0, Math.PI*2);
            ctx2.fillStyle = '#60a5fa'; ctx2.fill();
            ctx2.restore();
        });

        if (STATE.donen_pet > 0 && !player.isDead) {
            ctx2.save();
            ctx2.globalAlpha = 0.3;
            ctx2.beginPath(); ctx2.arc(_donenPet.x - Math.cos(_donenPet.angle)*8, _donenPet.y - Math.sin(_donenPet.angle)*8, 6, 0, Math.PI*2);
            ctx2.fillStyle = '#a78bfa'; ctx2.fill();
            ctx2.restore();
            ctx2.save();
            ctx2.translate(_donenPet.x, _donenPet.y);
            const petGrad = ctx2.createRadialGradient(0, 0, 0, 0, 0, 10);
            petGrad.addColorStop(0, '#a78bfa');
            petGrad.addColorStop(1, '#7c3aed');
            ctx2.fillStyle = petGrad;
            ctx2.beginPath(); ctx2.arc(0, 0, 10, 0, Math.PI*2); ctx2.fill();
            ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 2; ctx2.stroke();
            const aim = _donenPet.aimAngle || _donenPet.angle;
            ctx2.beginPath(); ctx2.arc(Math.cos(aim)*4, Math.sin(aim)*4, 2, 0, Math.PI*2);
            ctx2.fillStyle = '#fff'; ctx2.fill();
            ctx2.restore();
        }
        _donenPetBullets.forEach(b => {
            ctx2.save();
            ctx2.globalAlpha = 0.4;
            ctx2.beginPath(); ctx2.arc(b.x - b.vx*2, b.y - b.vy*2, 3, 0, Math.PI*2);
            ctx2.fillStyle = '#a78bfa'; ctx2.fill();
            ctx2.restore();
            ctx2.save();
            ctx2.beginPath(); ctx2.arc(b.x, b.y, 4, 0, Math.PI*2);
            ctx2.fillStyle = '#a78bfa'; ctx2.fill();
            ctx2.restore();
        });

        if (STATE.cephane_pet > 0 && !player.isDead) {
            ctx2.save();
            ctx2.globalAlpha = 0.3;
            ctx2.beginPath(); ctx2.arc(_cephanePet.x - Math.cos(_cephanePet.angle+Math.PI)*8, _cephanePet.y - Math.sin(_cephanePet.angle+Math.PI)*8, 6, 0, Math.PI*2);
            ctx2.fillStyle = '#2ecc71'; ctx2.fill();
            ctx2.restore();
            ctx2.save();
            ctx2.translate(_cephanePet.x, _cephanePet.y);
            const cpGrad = ctx2.createRadialGradient(0, 0, 0, 0, 0, 10);
            cpGrad.addColorStop(0, '#2ecc71');
            cpGrad.addColorStop(1, '#1e8449');
            ctx2.fillStyle = cpGrad;
            ctx2.beginPath(); ctx2.arc(0, 0, 10, 0, Math.PI*2); ctx2.fill();
            ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 2; ctx2.stroke();
            const caim = _cephanePet.angle + Math.PI;
            ctx2.beginPath(); ctx2.arc(Math.cos(caim)*4, Math.sin(caim)*4, 2, 0, Math.PI*2);
            ctx2.fillStyle = '#fff'; ctx2.fill();
            if (_cephanePet.flash > 0) {
                ctx2.globalAlpha = _cephanePet.flash / 12;
                ctx2.beginPath(); ctx2.arc(0, 0, 16, 0, Math.PI*2);
                ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 2; ctx2.stroke();
            }
            ctx2.restore();
        }

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

        if (STATE.elektro > 0) {
            const ranges = [100, 125, 150, 180];
            const r = ranges[STATE.elektro-1];
            const now = Date.now();
            ctx2.save();
            ctx2.globalAlpha = 0.3 + Math.sin(now/400)*0.1;
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

    if (!window._waveOrigDrawEntity) {
        window._waveOrigDrawEntity = window.drawEntity;
        window.drawEntity = function (e, isP) {
            if (!e || window.GAME_MODE !== MOD_ID) return window._waveOrigDrawEntity.call(this, e, isP);
            if (isP) return window._waveOrigDrawEntity.call(this, e, isP);
            if (e._isArmored || e._isGrowing) return;
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

    window.GAME_EXT.modKartiEkle('wave', '35 Dalga Arena', 'Klasik botlarla 35 dalga roguelite');
    console.log('[MOD YÜKLENDİ] wave (v7 FINAL - 35 dalga)');
})();