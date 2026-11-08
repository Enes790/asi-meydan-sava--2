// ============================================================================
// MOD: KÖY BASKINI (mod8.js) - Clash of Clans havasında köy yıkma
// ----------------------------------------------------------------------------
// Bu modda karakter yok. Alt çubuktan birlik seçip köyün DIŞINA dokunarak
// (basılı tutup sürükleyerek de) birlik bırakırsın. Birlikler köyü kendi
// kendine yıkar:
//   Slime   : yakın dövüşçü, ölünce ikiye bölünür (iki kez)
//   Mor Bot : uzaktan ateş eder, klasik tek gözlü görünüm
//   Yuva    : sabit durur, kısa sürede slime doğurup çöker
// Köy: 1 Belediye Binası, 2 Okçu Kulesi, 2 Top, 3 Depo, çevresinde duvar.
// Yıkım %50 = 1 yıldız, Belediye = 1 yıldız, %100 = 1 yıldız. Süre 3 dakika.
// Birlikler klasik moddaki botlarla aynı çizim fonksiyonuyla (drawEntity) çiziliyor.
// Denge ayarları aşağıdaki sabitlerde, tek yerden değiştirilir.
// ============================================================================

(function () {
    'use strict';
    console.log('[MOD YÜKLENDİ] koy_baskini');

    const MOD_ID = 'koy_baskini';

    // ---- Denge ayarları ----
    const RAID_TIME = 180;                                  // saniye
    const ARMY = { slime: 8, bot: 4, nest: 2 };             // elindeki birlik sayısı
    const SLIME = [                                         // 0: büyük, 1: orta, 2: küçük
        { r: 24, hp: 620, dmg: 90, spd: 1.55 },
        { r: 16, hp: 300, dmg: 60, spd: 1.8 },
        { r: 10, hp: 130, dmg: 36, spd: 2.1 }
    ];
    const SLIME_ATK = 48;                                   // kare (0.8 sn)
    const BOT = { r: 18, hp: 880, spd: 1.25, range: 135, dmg: 105, atk: 66 };
    const NEST = { r: 30, hp: 1500, spawnEvery: 140, spawns: 4 };
    const DEF = {
        archer: { range: 175, interval: 50, dmg: 62, speed: 9, kind: 'arrow', splash: 0 },
        cannon: { range: 150, interval: 105, dmg: 240, speed: 6.5, kind: 'ball', splash: 24 }
    };
    const BUILDING_HP = { hall: 5200, archer: 1500, cannon: 1800, depot: 1100, wall: 520 };
    const LOOT = { hall: 900, depot: 450, archer: 150, cannon: 150 };
    const DEPLOY_MARGIN = 42;                               // köyün çevresinde birlik bırakılamayan şerit

    const TROOP_INFO = {
        slime: { label: 'Slime' },
        bot: { label: 'Mor Bot' },
        nest: { label: 'Yuva' }
    };
    const ICONS = {
        slime: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#2ecc71" stroke="#1e8449" stroke-width="3"/><circle cx="27" cy="20" r="4" fill="rgba(0,0,0,.45)"/></svg>',
        bot: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#9b59b6" stroke="#6c3483" stroke-width="3"/><circle cx="27" cy="20" r="4" fill="rgba(0,0,0,.45)"/></svg>',
        nest: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#27ae60" stroke="#145a32" stroke-width="3"/><circle cx="20" cy="20" r="11" fill="#1e8449"/><circle cx="20" cy="20" r="5" fill="#145a32"/></svg>'
    };

    let raid = null;

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }

    // =======================================================================
    // ARAYÜZ (DOM) - stil, HUD, birlik çubuğu, sonuç ekranı, mod seçici
    // =======================================================================
    const style = document.createElement('style');
    style.textContent = `
        .raid-mode #left-joystick, .raid-mode #right-joystick, .raid-mode #gadget-btn,
        .raid-mode #gadget-btn-2, .raid-mode #ulti-btn, .raid-mode #game-over-screen { display:none !important; }
        #raid-hud, #raid-bar, #raid-hint { display:none; position:absolute; z-index:30; }
        .raid-mode #raid-hud { display:flex; }
        .raid-mode #raid-bar { display:flex; }
        .raid-mode #raid-hint.show { display:block; }
        #raid-hud { top:10px; left:50%; transform:translateX(-50%); align-items:center; gap:16px;
            background:rgba(15,25,35,.85); border:2px solid #f1c40f; border-radius:16px; padding:6px 18px;
            color:#fff; font-weight:700; pointer-events:none; box-shadow:0 4px 14px rgba(0,0,0,.5); }
        #raid-hud .rh-time { font-size:20px; min-width:46px; text-align:center; }
        #raid-hud .rh-mid { text-align:center; line-height:1; }
        #raid-hud .rh-stars span { font-size:22px; color:#4a5560; margin:0 1px; }
        #raid-hud .rh-stars span.on { color:#f1c40f; text-shadow:0 0 8px #f1c40f; }
        #raid-hud .rh-pct { font-size:15px; color:#ecf0f1; }
        #raid-hud .rh-loot { font-size:16px; color:#f1c40f; min-width:54px; text-align:right; }
        #raid-bar { bottom:14px; left:50%; transform:translateX(-50%); gap:10px; }
        .raid-troop { width:80px; padding:6px 4px 5px; background:rgba(15,25,35,.88); border:3px solid #34495e;
            border-radius:14px; text-align:center; color:#fff; font-size:11px; font-weight:700; position:relative;
            transition:all .15s; cursor:pointer; }
        .raid-troop svg { width:38px; height:38px; display:block; margin:0 auto 2px; }
        .raid-troop.sel { border-color:#2ecc71; box-shadow:0 0 14px rgba(46,204,113,.75); transform:translateY(-8px); }
        .raid-troop.empty { opacity:.3; }
        .raid-troop .rt-count { position:absolute; top:-9px; right:-7px; background:#e74c3c; border-radius:11px;
            padding:1px 7px; font-size:12px; border:2px solid #fff; }
        #raid-hint { bottom:122px; left:50%; transform:translateX(-50%); background:rgba(15,25,35,.85);
            color:#ecf0f1; padding:8px 16px; border-radius:12px; font-size:13px; font-weight:700;
            pointer-events:none; text-align:center; max-width:86%; }
        #raid-result { display:none; position:absolute; top:0; left:0; width:100%; height:100%;
            background:rgba(0,0,0,.7); z-index:40; flex-direction:column; align-items:center;
            justify-content:center; color:#fff; text-align:center; }
        .raid-mode #raid-result.show { display:flex; }
        #raid-result h1 { font-size:clamp(28px,8vw,44px); color:#f1c40f; margin:0 0 6px; text-shadow:0 4px 12px rgba(0,0,0,.6); }
        #raid-result .rr-stars span { font-size:clamp(44px,13vw,70px); color:#4a5560; margin:0 4px; }
        #raid-result .rr-stars span.on { color:#f1c40f; text-shadow:0 0 18px #f1c40f; }
        #raid-result .rr-stats { font-size:17px; margin:10px 0 18px; line-height:1.6; color:#ecf0f1; }
        #raid-result button { padding:13px 30px; margin:5px; font-size:17px; font-weight:700; color:#fff; border:none;
            border-radius:10px; cursor:pointer; background:#2ecc71; box-shadow:0 4px 0 #27ae60; }
        #raid-result button.alt { background:#e74c3c; box-shadow:0 4px 0 #c0392b; }
        #mode-picker { display:flex; gap:10px; margin:2px 0 14px; justify-content:center; flex-wrap:wrap; }
        .mode-pill { padding:10px 18px; border-radius:20px; background:rgba(0,0,0,.4); border:3px solid transparent;
            color:#fff; font-weight:700; cursor:pointer; font-size:14px; }
        .mode-pill.selected { border-color:#2ecc71; background:rgba(46,204,113,.15); }
    `;
    document.head.appendChild(style);

    function makeEl(tag, id, html) {
        const el = document.createElement(tag);
        if (id) el.id = id;
        if (html !== undefined) el.innerHTML = html;
        document.body.appendChild(el);
        return el;
    }
    const hudEl = makeEl('div', 'raid-hud',
        '<div class="rh-time" id="rh-time">3:00</div>' +
        '<div class="rh-mid"><div class="rh-stars" id="rh-stars"><span>★</span><span>★</span><span>★</span></div>' +
        '<div class="rh-pct" id="rh-pct">0%</div></div>' +
        '<div class="rh-loot" id="rh-loot">0</div>');
    const barEl = makeEl('div', 'raid-bar', '');
    const hintEl = makeEl('div', 'raid-hint', 'Alttan birlik seç, köyün dışına dokun (basılı tutup sürükleyebilirsin)');
    const resultEl = makeEl('div', 'raid-result',
        '<h1 id="rr-title"></h1><div class="rr-stars" id="rr-stars"><span>★</span><span>★</span><span>★</span></div>' +
        '<div class="rr-stats" id="rr-stats"></div>' +
        '<div><button id="rr-retry">Tekrar Dene</button><button class="alt" id="rr-menu">Ana Menü</button></div>');

    const timeEl = document.getElementById('rh-time');
    const pctEl = document.getElementById('rh-pct');
    const lootEl = document.getElementById('rh-loot');
    const starEls = document.getElementById('rh-stars').children;

    Object.keys(TROOP_INFO).forEach(type => {
        const b = document.createElement('div');
        b.className = 'raid-troop';
        b.dataset.t = type;
        b.innerHTML = ICONS[type] + '<span>' + TROOP_INFO[type].label + '</span><span class="rt-count">0</span>';
        b.addEventListener('pointerdown', e => {
            e.preventDefault(); e.stopPropagation();
            if (raid && !raid.over && raid.army[type] > 0) { raid.selected = type; updateBar(); }
        });
        barEl.appendChild(b);
    });

    document.getElementById('rr-retry').addEventListener('click', () => {
        resultEl.classList.remove('show');
        initRaid();
    });
    document.getElementById('rr-menu').addEventListener('click', () => {
        resultEl.classList.remove('show');
        document.getElementById('restart-btn').click(); // ana dosyanın yeniden başlat akışı
    });

    // Mod seçici (zorluk ekranına eklenir, mevcut kaydırmalı zorluk seçimine dokunmaz)
    (function buildModePicker() {
        const screen = document.getElementById('difficulty-screen');
        const startBtn = document.getElementById('difficulty-start-btn');
        if (!screen || !startBtn) return;
        let picker = document.getElementById('mode-picker');
        if (!picker) {
            picker = document.createElement('div');
            picker.id = 'mode-picker';
            screen.insertBefore(picker, startBtn);
        }
        function addPill(id, label, mode) {
            if (document.getElementById(id)) return;
            const pill = document.createElement('div');
            pill.className = 'mode-pill' + (window.GAME_MODE === mode ? ' selected' : '');
            pill.id = id;
            pill.textContent = label;
            pill.addEventListener('click', () => {
                window.GAME_MODE = mode;
                document.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('selected'));
                pill.classList.add('selected');
            });
            picker.appendChild(pill);
        }
        addPill('mode-arena', 'Arena', 'arena');
        addPill('mode-raid', 'Köy Baskını', MOD_ID);
    })();

    // =======================================================================
    // KÖY KURULUMU
    // =======================================================================
    function initRaid() {
        const W = canvas.width, H = canvas.height;
        const topUI = 76, botUI = 118;
        const availH = H - topUI - botUI;
        const k = clamp(Math.min(W * 0.72 / 280, availH * 0.55 / 230), 0.7, 1.5);
        const cx = W / 2, cy = topUI + availH / 2;

        raid = {
            W, H, k, cx, cy, topUI, botUI,
            hw: 130 * k, hh: 105 * k,
            walls: [], buildings: [], troops: [], projs: [], parts: [], nums: [],
            army: { slime: ARMY.slime, bot: ARMY.bot, nest: ARMY.nest },
            selected: 'slime', time: RAID_TIME, started: false, over: false, idle: 0,
            destroyed: 0, total: 8, hallDown: false, loot: 0, shake: 0,
            defMult: window.GAME_DIFFICULTY === 'easy' ? 0.7 : 1,
            bg: null, drag: false, lastDeploy: 0, lastPos: { x: 0, y: 0 }, hudCache: ''
        };

        const wr = 9 * k, step = 14;
        const addWall = (x, y) => raid.walls.push({ type: 'wall', x: cx + x * k, y: cy + y * k, r: wr,
            hp: BUILDING_HP.wall, maxHp: BUILDING_HP.wall, destroyed: false, hitFlash: 0 });
        for (let x = -130; x <= 122; x += step) { addWall(x, -105); addWall(x, 105); }
        addWall(130, -105); addWall(130, 105);
        for (let y = -105 + step; y <= 105 - step; y += step) { addWall(-130, y); addWall(130, y); }

        const addB = (type, x, y, r) => raid.buildings.push({
            type, x: cx + x * k, y: cy + y * k, r: r * k, hp: BUILDING_HP[type], maxHp: BUILDING_HP[type],
            destroyed: false, hitFlash: 0, aim: Math.random() * Math.PI * 2, reload: 30 + Math.random() * 30, recoil: 0
        });
        addB('hall', 0, 0, 38);
        addB('archer', -80, -55, 18); addB('archer', 80, 55, 18);
        addB('cannon', 80, -55, 18); addB('cannon', -80, 55, 18);
        addB('depot', 0, -72, 20); addB('depot', -100, 0, 20); addB('depot', 100, 0, 20);

        buildBackground();
        hintEl.classList.add('show');
        resultEl.classList.remove('show');
        updateBar();
        updateHUD(true);
    }

    function buildBackground() {
        const { W, H, cx, cy, hw, hh, k } = raid;
        const bg = document.createElement('canvas');
        bg.width = W; bg.height = H;
        const g = bg.getContext('2d');
        let seed = 1234567;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

        const grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#4f9a43'); grad.addColorStop(1, '#3b7d35');
        g.fillStyle = grad; g.fillRect(0, 0, W, H);

        for (let i = 0; i < W * H / 700; i++) {
            const x = rnd() * W, y = rnd() * H;
            g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)';
            g.beginPath(); g.arc(x, y, 1 + rnd() * 2.2, 0, Math.PI * 2); g.fill();
        }
        g.strokeStyle = 'rgba(30,90,30,0.55)'; g.lineWidth = 1.2;
        for (let i = 0; i < W * H / 3500; i++) {
            const x = rnd() * W, y = rnd() * H;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 5); g.moveTo(x, y); g.lineTo(x + 2, y - 6); g.stroke();
        }
        const flowerColors = ['#f1c40f', '#ecf0f1', '#e74c3c', '#fd79a8'];
        for (let i = 0; i < W * H / 12000; i++) {
            g.fillStyle = flowerColors[Math.floor(rnd() * flowerColors.length)];
            g.beginPath(); g.arc(rnd() * W, rnd() * H, 2.2, 0, Math.PI * 2); g.fill();
        }

        // Köyün altındaki toprak alan
        const pad = 26 * k;
        rr(g, cx - hw - pad, cy - hh - pad, (hw + pad) * 2, (hh + pad) * 2, 30 * k);
        const dirt = g.createRadialGradient(cx, cy, 20, cx, cy, hw + pad);
        dirt.addColorStop(0, '#c9a46a'); dirt.addColorStop(1, '#a98650');
        g.fillStyle = dirt; g.fill();
        g.strokeStyle = 'rgba(90,60,30,0.6)'; g.lineWidth = 3; g.stroke();
        for (let i = 0; i < 160; i++) {
            const x = cx + (rnd() - 0.5) * (hw + pad) * 2, y = cy + (rnd() - 0.5) * (hh + pad) * 2;
            g.fillStyle = 'rgba(70,45,20,0.12)';
            g.beginPath(); g.arc(x, y, 1 + rnd() * 3, 0, Math.PI * 2); g.fill();
        }

        // Kenarlarda çalılar / ağaçlar
        function bush(x, y, s) {
            g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x + 3, y + s * 0.8, s * 1.1, s * 0.5, 0, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#2a6b2a'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#378a37'; g.beginPath(); g.arc(x - s * 0.3, y - s * 0.3, s * 0.65, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(x - s * 0.4, y - s * 0.45, s * 0.28, 0, Math.PI * 2); g.fill();
        }
        for (let i = 0; i < 26; i++) {
            const side = Math.floor(rnd() * 4);
            let x = rnd() * W, y = rnd() * H;
            if (side === 0) y = rnd() * 36 + 4;
            else if (side === 1) y = H - rnd() * 30 - 4;
            else if (side === 2) x = rnd() * 22 + 2;
            else x = W - rnd() * 22 - 2;
            bush(x, y, 10 + rnd() * 12);
        }

        const vig = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.38)');
        g.fillStyle = vig; g.fillRect(0, 0, W, H);

        raid.bg = bg;
    }

    // =======================================================================
    // EFEKT YARDIMCILARI
    // =======================================================================
    function addParts(x, y, color, n, speed, life, size) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = (0.3 + Math.random()) * speed;
            raid.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: life * (0.6 + Math.random() * 0.6),
                maxLife: life, color, size: size * (0.6 + Math.random() * 0.8) });
        }
    }
    function addNum(x, y, txt, color) {
        if (raid.nums.length > 60) raid.nums.shift();
        raid.nums.push({ x: x + (Math.random() - 0.5) * 16, y, txt, color, life: 55 });
    }

    // =======================================================================
    // HASAR / YIKIM
    // =======================================================================
    function damageBuilding(b, dmg) {
        if (b.destroyed) return;
        b.hp -= dmg; b.hitFlash = 5;
        if (b.type !== 'wall') addNum(b.x, b.y - b.r, Math.round(dmg), '#f1c40f');
        else addParts(b.x, b.y, '#b2bec3', 2, 1.6, 14, 2);
        if (b.hp <= 0) destroyBuilding(b);
    }

    function destroyBuilding(b) {
        b.destroyed = true; b.hp = 0;
        if (b.type === 'wall') { addParts(b.x, b.y, '#95a5a6', 7, 2.4, 26, 3); return; }
        addParts(b.x, b.y, '#7f8c8d', 22, 2.6, 60, 6);
        addParts(b.x, b.y, '#e67e22', 14, 3.2, 28, 4);
        addParts(b.x, b.y, '#5d4037', 12, 2.2, 40, 5);
        raid.shake = b.type === 'hall' ? 16 : 7;
        raid.destroyed++;
        if (b.type === 'hall') raid.hallDown = true;
        const gain = LOOT[b.type] || 0;
        raid.loot += gain;
        addNum(b.x, b.y - b.r - 10, '+' + gain, '#f9ca24');
    }

    function damageTroop(t, dmg) {
        if (t.isDead) return;
        t.hp -= dmg;
        addNum(t.x, t.y - t.radius - 6, Math.round(dmg), '#ff7675');
        if (t.hp <= 0) killTroop(t);
    }

    function killTroop(t) {
        t.isDead = true;
        addParts(t.x, t.y, t.color, 10, 2.4, 30, 4);
        if (t.type === 'slime' && t.stage < 2) {
            for (let i = 0; i < 2; i++) {
                const a = Math.random() * Math.PI * 2;
                spawnTroop('slime', t.x + Math.cos(a) * 12, t.y + Math.sin(a) * 12, t.stage + 1);
            }
        }
    }

    // =======================================================================
    // BİRLİKLER
    // =======================================================================
    function spawnTroop(type, x, y, stage) {
        const kt = clamp(raid.k, 0.9, 1.25);
        const base = { type, x, y, isDead: false, kbX: 0, kbY: 0, atk: 0, target: null, blocked: null,
            angle: Math.atan2(raid.cy - y, raid.cx - x), stage: stage || 0 };
        let t;
        if (type === 'slime') {
            const s = SLIME[base.stage];
            t = Object.assign(base, { radius: s.r * kt, hp: s.hp, maxHp: s.hp, speed: s.spd, dmg: s.dmg, color: '#2ecc71' });
        } else if (type === 'bot') {
            t = Object.assign(base, { radius: BOT.r * kt, hp: BOT.hp, maxHp: BOT.hp, speed: BOT.spd, dmg: BOT.dmg, color: '#9b59b6' });
        } else {
            t = Object.assign(base, { radius: NEST.r * kt, hp: NEST.hp, maxHp: NEST.hp, speed: 0, dmg: 0,
                color: '#27ae60', isNest: true, timer: 0, spawned: 0 });
        }
        raid.troops.push(t);
        return t;
    }

    function nearestBuilding(t) {
        let best = null, bd = Infinity;
        raid.buildings.forEach(b => {
            if (b.destroyed) return;
            const d = dist(t, b);
            if (d < bd) { bd = d; best = b; }
        });
        return best;
    }

    function resolveWalls(t, dirx, diry) {
        for (const w of raid.walls) {
            if (w.destroyed) continue;
            const dx = t.x - w.x, dy = t.y - w.y;
            const minD = w.r + t.radius * 0.75;
            const d = Math.hypot(dx, dy);
            if (d < minD) {
                const push = (minD - d) / (d || 1);
                t.x += dx * push; t.y += dy * push;
                if (!t.blocked && ((w.x - t.x) * dirx + (w.y - t.y) * diry) > 0) t.blocked = w;
            }
        }
    }

    function updateNest(t, ts) {
        t.timer += ts;
        if (t.spawned < NEST.spawns && t.timer >= 40 + NEST.spawnEvery * t.spawned) {
            const a = Math.random() * Math.PI * 2;
            spawnTroop('slime', t.x + Math.cos(a) * t.radius, t.y + Math.sin(a) * t.radius, 1);
            addParts(t.x, t.y, '#2ecc71', 8, 2, 24, 3);
            t.spawned++;
        } else if (t.spawned >= NEST.spawns && t.timer >= 40 + NEST.spawnEvery * NEST.spawns + 60) {
            killTroop(t);
        }
    }

    function updateTroop(t, ts) {
        if (t.type === 'nest') { updateNest(t, ts); return; }
        if (t.blocked && t.blocked.destroyed) t.blocked = null;
        const tgt = t.blocked || nearestBuilding(t);
        t.target = tgt;
        if (!tgt) return;
        const dx = tgt.x - t.x, dy = tgt.y - t.y, d = Math.hypot(dx, dy) || 1;
        t.angle = Math.atan2(dy, dx);
        t.atk -= ts;
        const isBot = t.type === 'bot';
        const inRange = isBot ? (d - tgt.r <= BOT.range * raid.k) : (d <= t.radius + tgt.r + 3);
        if (!inRange) {
            const sp = t.speed * raid.k * ts;
            t.x += dx / d * sp; t.y += dy / d * sp;
            resolveWalls(t, dx / d, dy / d);
        } else if (t.atk <= 0) {
            if (isBot) {
                raid.projs.push({ kind: 'orb', from: 'troop', x: t.x, y: t.y, target: tgt, tx: tgt.x, ty: tgt.y,
                    speed: 8 * raid.k, dmg: BOT.dmg, splash: 0, angle: t.angle });
                t.atk = BOT.atk;
            } else {
                damageBuilding(tgt, t.dmg);
                addParts(tgt.x, tgt.y, '#2ecc71', 3, 1.6, 14, 2.5);
                t.atk = SLIME_ATK;
            }
        }
    }

    // =======================================================================
    // SAVUNMA (okçu kulesi, top)
    // =======================================================================
    function updateDefense(b, ts) {
        if (b.destroyed || (b.type !== 'archer' && b.type !== 'cannon')) return;
        const cfg = DEF[b.type];
        const range = cfg.range * raid.k;
        b.reload -= ts;
        if (b.recoil > 0) b.recoil -= ts;
        let best = null, bd = Infinity;
        raid.troops.forEach(t => {
            if (t.isDead) return;
            const d = dist(b, t);
            if (d - t.radius < range && d < bd) { bd = d; best = t; }
        });
        if (!best) return;
        b.aim = Math.atan2(best.y - b.y, best.x - b.x);
        if (b.reload <= 0) {
            b.reload = cfg.interval;
            if (b.type === 'cannon') { b.recoil = 8; addParts(b.x + Math.cos(b.aim) * b.r * 1.4, b.y + Math.sin(b.aim) * b.r * 1.4, '#bdc3c7', 5, 1.5, 18, 3); }
            raid.projs.push({ kind: cfg.kind, from: 'def', x: b.x, y: b.y, target: best, tx: best.x, ty: best.y,
                speed: cfg.speed * raid.k, dmg: cfg.dmg * raid.defMult, splash: cfg.splash * raid.k, angle: b.aim });
        }
    }

    function updateProjectiles(ts) {
        for (let i = raid.projs.length - 1; i >= 0; i--) {
            const p = raid.projs[i];
            if (p.target && !p.target.isDead && !p.target.destroyed) { p.tx = p.target.x; p.ty = p.target.y; }
            const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy) || 1;
            const sp = p.speed * ts;
            p.angle = Math.atan2(dy, dx);
            const hitR = p.target ? (p.target.radius || p.target.r || 0) * 0.5 : 0;
            if (d <= sp + hitR) {
                if (p.from === 'def') {
                    if (p.splash > 0) {
                        raid.troops.forEach(t => { if (!t.isDead && Math.hypot(t.x - p.tx, t.y - p.ty) < p.splash + t.radius) damageTroop(t, p.dmg); });
                        addParts(p.tx, p.ty, '#e67e22', 8, 2.2, 20, 4);
                        addParts(p.tx, p.ty, '#7f8c8d', 5, 1.4, 28, 5);
                    } else if (p.target && !p.target.isDead) {
                        damageTroop(p.target, p.dmg);
                    }
                } else if (p.target && !p.target.destroyed) {
                    damageBuilding(p.target, p.dmg);
                    addParts(p.tx, p.ty, '#9b59b6', 4, 1.8, 16, 3);
                }
                raid.projs.splice(i, 1);
            } else {
                p.x += dx / d * sp; p.y += dy / d * sp;
            }
        }
    }

    // =======================================================================
    // BİRLİK BIRAKMA
    // =======================================================================
    function canDeploy(x, y) {
        const { hw, hh, cx, cy, W, H, topUI, botUI } = raid;
        const m = DEPLOY_MARGIN * raid.k;
        if (x < 12 || x > W - 12 || y < topUI - 10 || y > H - botUI + 10) return false;
        return !(Math.abs(x - cx) < hw + m && Math.abs(y - cy) < hh + m);
    }

    function pickNextTroop() {
        for (const type of Object.keys(raid.army)) if (raid.army[type] > 0) { raid.selected = type; return; }
        raid.selected = null;
    }

    function tryDeploy(px, py, showMsg) {
        if (!raid || raid.over) return;
        if (!raid.selected || raid.army[raid.selected] <= 0) pickNextTroop();
        if (!raid.selected) return;
        if (!canDeploy(px, py)) { if (showMsg) addNum(px, py, 'Buraya konulamaz', '#ff7675'); return; }
        spawnTroop(raid.selected, px, py, 0);
        raid.army[raid.selected]--;
        raid.started = true;
        hintEl.classList.remove('show');
        addParts(px, py, '#ffffff', 8, 1.8, 18, 3);
        raid.parts.push({ x: px, y: py, vx: 0, vy: 0, life: 14, maxLife: 14, color: '#ffffff', size: 4, ring: true });
        if (raid.army[raid.selected] <= 0) pickNextTroop();
        updateBar();
    }

    function toCanvas(e) {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
    }
    canvas.addEventListener('pointerdown', e => {
        if (window.GAME_MODE !== MOD_ID || !raid || raid.over) return;
        e.preventDefault();
        const p = toCanvas(e);
        raid.drag = true; raid.lastPos = p; raid.lastDeploy = performance.now();
        tryDeploy(p.x, p.y, true);
    });
    canvas.addEventListener('pointermove', e => {
        if (window.GAME_MODE !== MOD_ID || !raid || !raid.drag || raid.over) return;
        const p = toCanvas(e);
        const now = performance.now();
        if (now - raid.lastDeploy > 140 && Math.hypot(p.x - raid.lastPos.x, p.y - raid.lastPos.y) > 18) {
            raid.lastDeploy = now; raid.lastPos = p;
            tryDeploy(p.x, p.y, false);
        }
    });
    window.addEventListener('pointerup', () => { if (raid) raid.drag = false; });
    window.addEventListener('pointercancel', () => { if (raid) raid.drag = false; });

    // =======================================================================
    // HUD / SONUÇ
    // =======================================================================
    function updateBar() {
        Array.from(barEl.children).forEach(el => {
            const type = el.dataset.t;
            const n = raid ? raid.army[type] : 0;
            el.querySelector('.rt-count').textContent = n;
            el.classList.toggle('empty', n <= 0);
            el.classList.toggle('sel', !!raid && raid.selected === type && n > 0);
        });
    }

    function currentStars() {
        const pct = raid.destroyed / raid.total;
        return [pct >= 0.5, raid.hallDown, raid.destroyed === raid.total];
    }

    function updateHUD(force) {
        const secs = Math.max(0, Math.ceil(raid.time));
        const stars = currentStars();
        const key = secs + '|' + raid.destroyed + '|' + raid.loot + '|' + stars.join('');
        if (!force && key === raid.hudCache) return;
        raid.hudCache = key;
        timeEl.textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
        pctEl.textContent = Math.round(raid.destroyed / raid.total * 100) + '%';
        lootEl.textContent = raid.loot;
        for (let i = 0; i < 3; i++) starEls[i].classList.toggle('on', stars[i]);
    }

    function endRaid(reason) {
        if (raid.over) return;
        raid.over = true;
        const stars = currentStars();
        const n = stars.filter(Boolean).length;
        const pct = Math.round(raid.destroyed / raid.total * 100);
        document.getElementById('rr-title').textContent = n === 3 ? 'ZAFER!' : (n > 0 ? 'KÖY HASAR GÖRDÜ' : 'YENİLGİ');
        const rrStars = document.getElementById('rr-stars').children;
        for (let i = 0; i < 3; i++) rrStars[i].classList.toggle('on', stars[i]);
        const why = reason === 'time' ? 'Süre doldu' : (reason === 'win' ? 'Köy yerle bir edildi' : 'Birliklerin tükendi');
        document.getElementById('rr-stats').innerHTML = why + '<br>Yıkım: %' + pct + ' &nbsp; Ganimet: ' + raid.loot;
        setTimeout(() => { if (raid && raid.over) resultEl.classList.add('show'); }, 900);
    }

    // =======================================================================
    // ANA GÜNCELLEME (mod onUpdate)
    // =======================================================================
    function raidUpdate(ts) {
        // Karakter yok: klasik botları, engelleri ve oyuncuyu devre dışı bırak
        bot.isActive = false; bot.isDead = true; bot2.isActive = false; bot2.isDead = true;
        slimeBots = []; stationaryBots = []; boomerangBots = []; fogBots = []; nests = [];
        spawnIndicators = []; obstacles = []; botBullets = []; bullets = [];
        slimeTimer = stationaryTimer = boomerangTimer = fogBotTimer = 0;
        lastObstacleTime = Date.now();
        player.isDead = true;
        document.body.classList.add('raid-mode');

        if (!raid || Math.abs(raid.W - canvas.width) > 20 || Math.abs(raid.H - canvas.height) > 20) initRaid();

        raid.shake = Math.max(0, raid.shake - ts * 0.8);
        for (let i = raid.parts.length - 1; i >= 0; i--) {
            const p = raid.parts[i];
            p.x += p.vx * ts; p.y += p.vy * ts; p.vx *= 0.96; p.vy *= 0.96; p.life -= ts;
            if (p.life <= 0) raid.parts.splice(i, 1);
        }
        for (let i = raid.nums.length - 1; i >= 0; i--) {
            const n = raid.nums[i];
            n.y -= 0.55 * ts; n.life -= ts;
            if (n.life <= 0) raid.nums.splice(i, 1);
        }
        raid.buildings.forEach(b => { if (b.hitFlash > 0) b.hitFlash -= ts; });
        raid.walls.forEach(w => { if (w.hitFlash > 0) w.hitFlash -= ts; });

        if (raid.over) return;

        if (raid.started) raid.time -= ts / 60;

        raid.buildings.forEach(b => updateDefense(b, ts));
        raid.troops.slice().forEach(t => { if (!t.isDead) updateTroop(t, ts); });
        updateProjectiles(ts);
        raid.troops = raid.troops.filter(t => !t.isDead);

        updateHUD(false);

        if (raid.destroyed === raid.total) { endRaid('win'); return; }
        if (raid.time <= 0) { raid.time = 0; updateHUD(true); endRaid('time'); return; }
        const left = raid.army.slime + raid.army.bot + raid.army.nest;
        if (raid.started && left === 0 && raid.troops.length === 0) {
            raid.idle += ts;
            if (raid.idle > 90) endRaid('lose');
        } else raid.idle = 0;
    }

    window.GAME_EXT.modes[MOD_ID] = {
        label: 'Köy Baskını',
        onStart() { raid = null; player.isDead = true; },
        onUpdate(ts) { raidUpdate(ts); }
    };

    // Ana dosya startGame'de onReset'i onStart'tan SONRA çağırıyor; bu yüzden burada
    // sadece temizlik yapıyoruz, kurulum ilk güncelleme karesinde tembel olarak yapılıyor.
    const prevOnReset = window.GAME_EXT.hooks.onReset;
    window.GAME_EXT.hooks.onReset = function () {
        if (typeof prevOnReset === 'function') prevOnReset.apply(this, arguments);
        raid = null;
        document.body.classList.remove('raid-mode');
        resultEl.classList.remove('show');
        hintEl.classList.remove('show');
    };

    // =======================================================================
    // ÇİZİM
    // =======================================================================
    function shadow(c, x, y, rx, ry) {
        c.fillStyle = 'rgba(0,0,0,0.28)';
        c.beginPath(); c.ellipse(x + 3, y + ry, rx, ry * 0.55, 0, 0, Math.PI * 2); c.fill();
    }
    function bar(c, x, y, w, pct, col) {
        c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
        c.fillStyle = col; c.fillRect(x - w / 2, y, w * clamp(pct, 0, 1), 4);
    }

    function drawHall(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.7, r * 1.2, r * 0.55);
        rr(c, x - r, y - r * 0.55, r * 2, r * 1.45, 6);
        c.fillStyle = f ? '#fff' : '#a07f5f'; c.fill();
        c.strokeStyle = '#5d4037'; c.lineWidth = 3; c.stroke();
        c.strokeStyle = 'rgba(60,40,25,0.35)'; c.lineWidth = 1;
        for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x - r, y - r * 0.55 + i * r * 0.36); c.lineTo(x + r, y - r * 0.55 + i * r * 0.36); c.stroke(); }
        c.beginPath(); c.moveTo(x - r * 1.12, y - r * 0.5); c.lineTo(x, y - r * 1.3); c.lineTo(x + r * 1.12, y - r * 0.5); c.closePath();
        c.fillStyle = f ? '#fff' : '#cf3a2b'; c.fill();
        c.strokeStyle = '#7b241c'; c.lineWidth = 2; c.stroke();
        c.beginPath(); c.moveTo(x, y - r * 1.3); c.lineTo(x + r * 1.12, y - r * 0.5); c.lineTo(x, y - r * 0.5); c.closePath();
        c.fillStyle = f ? '#fff' : '#a93226'; c.fill();
        rr(c, x - r * 0.2, y + r * 0.22, r * 0.4, r * 0.68, 4); c.fillStyle = '#4e342e'; c.fill();
        c.fillStyle = '#f9e79f';
        rr(c, x - r * 0.72, y - r * 0.15, r * 0.3, r * 0.3, 3); c.fill();
        rr(c, x + r * 0.42, y - r * 0.15, r * 0.3, r * 0.3, 3); c.fill();
        const wave = Math.sin(Date.now() / 220) * 4;
        c.strokeStyle = '#3e2723'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x, y - r * 1.3); c.lineTo(x, y - r * 1.75); c.stroke();
        c.beginPath(); c.moveTo(x, y - r * 1.75); c.lineTo(x + r * 0.55, y - r * 1.62 + wave * 0.4); c.lineTo(x, y - r * 1.48); c.closePath();
        c.fillStyle = '#f1c40f'; c.fill();
    }

    function drawArcher(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.6, r * 1.1, r * 0.6);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#8e9aa0'; c.fill();
        c.strokeStyle = '#566573'; c.lineWidth = 3; c.stroke();
        c.fillStyle = f ? '#fff' : '#7b8794';
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            c.beginPath(); c.arc(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, r * 0.17, 0, Math.PI * 2); c.fill();
        }
        c.beginPath(); c.arc(x, y, r * 0.68, 0, Math.PI * 2); c.fillStyle = '#a0714a'; c.fill();
        c.strokeStyle = '#6d4c41'; c.lineWidth = 2; c.stroke();
        c.beginPath(); c.arc(x, y, r * 0.3, 0, Math.PI * 2); c.fillStyle = '#f5cba7'; c.fill();
        c.beginPath(); c.arc(x, y - r * 0.08, r * 0.32, Math.PI, Math.PI * 2); c.fillStyle = '#27ae60'; c.fill();
        c.save(); c.translate(x, y); c.rotate(b.aim);
        c.strokeStyle = '#6d4c41'; c.lineWidth = 3;
        c.beginPath(); c.arc(r * 0.5, 0, r * 0.4, -1.15, 1.15); c.stroke();
        c.strokeStyle = '#ecf0f1'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(r * 0.5 + Math.cos(-1.15) * r * 0.4, Math.sin(-1.15) * r * 0.4);
        c.lineTo(r * 0.5 + Math.cos(1.15) * r * 0.4, Math.sin(1.15) * r * 0.4); c.stroke();
        c.restore();
    }

    function drawCannon(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.6, r * 1.1, r * 0.6);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#566573'; c.fill();
        c.strokeStyle = '#2c3e50'; c.lineWidth = 3; c.stroke();
        c.beginPath(); c.arc(x, y, r * 0.7, 0, Math.PI * 2); c.fillStyle = '#424949'; c.fill();
        c.save(); c.translate(x, y); c.rotate(b.aim);
        const back = b.recoil > 0 ? -b.recoil * 0.5 : 0;
        rr(c, -r * 0.2 + back, -r * 0.3, r * 1.45, r * 0.6, 4);
        c.fillStyle = f ? '#fff' : '#1c2833'; c.fill();
        c.strokeStyle = '#85929e'; c.lineWidth = 1.5; c.stroke();
        rr(c, r * 1.0 + back, -r * 0.36, r * 0.28, r * 0.72, 3); c.fillStyle = '#34495e'; c.fill();
        c.restore();
        c.beginPath(); c.arc(x, y, r * 0.22, 0, Math.PI * 2); c.fillStyle = '#d4ac0d'; c.fill();
    }

    function drawDepot(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.7, r * 1.15, r * 0.55);
        rr(c, x - r, y - r * 0.6, r * 2, r * 1.5, 5);
        c.fillStyle = f ? '#fff' : '#8d5a2b'; c.fill();
        c.strokeStyle = '#4e2f12'; c.lineWidth = 3; c.stroke();
        c.strokeStyle = 'rgba(40,20,5,0.45)'; c.lineWidth = 1.5;
        for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x - r, y - r * 0.6 + i * r * 0.37); c.lineTo(x + r, y - r * 0.6 + i * r * 0.37); c.stroke(); }
        rr(c, x - r * 1.05, y - r * 0.85, r * 2.1, r * 0.4, 4); c.fillStyle = f ? '#fff' : '#b07a3c'; c.fill();
        c.strokeStyle = '#4e2f12'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#f1c40f'; c.strokeStyle = '#b7950b'; c.lineWidth = 1;
        [[-0.45, -0.95], [-0.1, -1.05], [0.3, -0.95], [0.05, -0.8], [-0.3, -0.8]].forEach(p => {
            c.beginPath(); c.arc(x + p[0] * r, y + p[1] * r, r * 0.17, 0, Math.PI * 2); c.fill(); c.stroke();
        });
        rr(c, x - r * 0.14, y + r * 0.05, r * 0.28, r * 0.32, 3); c.fillStyle = '#f1c40f'; c.fill();
    }

    function drawWall(c, w) {
        const r = w.r, f = w.hitFlash > 0;
        rr(c, w.x - r, w.y - r, r * 2, r * 2, 3);
        c.fillStyle = f ? '#fff' : '#a5b0b4'; c.fill();
        c.strokeStyle = '#6b7780'; c.lineWidth = 1.5; c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(w.x - r + 2, w.y - r + 2, r * 2 - 4, r * 0.55);
    }

    function drawRubble(c, b) {
        c.fillStyle = 'rgba(55,40,30,0.85)';
        c.beginPath(); c.arc(b.x, b.y, b.r * 0.95, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(95,75,60,0.9)';
        for (let i = 0; i < 6; i++) {
            const a = i * 1.05 + b.x;
            c.beginPath(); c.arc(b.x + Math.cos(a) * b.r * 0.5, b.y + Math.sin(a) * b.r * 0.45, b.r * 0.22, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = 'rgba(230,126,34,' + (0.25 + Math.sin(Date.now() / 300 + b.x) * 0.15) + ')';
        c.beginPath(); c.arc(b.x, b.y, b.r * 0.3, 0, Math.PI * 2); c.fill();
    }

    function drawProjectile(c, p) {
        c.save(); c.translate(p.x, p.y); c.rotate(p.angle);
        if (p.kind === 'arrow') {
            c.strokeStyle = '#5d4037'; c.lineWidth = 2;
            c.beginPath(); c.moveTo(-9, 0); c.lineTo(7, 0); c.stroke();
            c.fillStyle = '#ecf0f1'; c.beginPath(); c.moveTo(10, 0); c.lineTo(5, -3); c.lineTo(5, 3); c.closePath(); c.fill();
            c.strokeStyle = '#c0392b'; c.beginPath(); c.moveTo(-9, 0); c.lineTo(-12, -3); c.moveTo(-9, 0); c.lineTo(-12, 3); c.stroke();
        } else if (p.kind === 'ball') {
            c.fillStyle = 'rgba(120,120,120,0.35)'; c.beginPath(); c.arc(-8, 0, 5, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#2c3e50'; c.beginPath(); c.arc(0, 0, 6, 0, Math.PI * 2); c.fill();
            c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(-2, -2, 2, 0, Math.PI * 2); c.fill();
        } else {
            c.fillStyle = 'rgba(155,89,182,0.35)'; c.beginPath(); c.arc(-5, 0, 6, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#9b59b6'; c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
        }
        c.restore();
    }

    function raidDraw(c) {
        const r = raid;
        c.save();
        if (r.shake > 0.5) c.translate((Math.random() - 0.5) * r.shake, (Math.random() - 0.5) * r.shake);
        c.drawImage(r.bg, 0, 0);

        // Birlik bırakılamayan bölge (birlik seçiliyken)
        if (!r.over && r.selected && r.army[r.selected] > 0) {
            const m = DEPLOY_MARGIN * r.k;
            rr(c, r.cx - r.hw - m, r.cy - r.hh - m, (r.hw + m) * 2, (r.hh + m) * 2, 22);
            c.fillStyle = 'rgba(231,76,60,0.13)'; c.fill();
            c.strokeStyle = 'rgba(231,76,60,0.55)'; c.lineWidth = 2; c.setLineDash([10, 8]); c.stroke(); c.setLineDash([]);
        }

        r.buildings.forEach(b => { if (b.destroyed) drawRubble(c, b); });
        r.walls.forEach(w => { if (!w.destroyed) drawWall(c, w); });

        const list = [];
        r.buildings.forEach(b => { if (!b.destroyed) list.push({ y: b.y, b }); });
        r.troops.forEach(t => { if (!t.isDead) list.push({ y: t.y, t }); });
        list.sort((a, b) => a.y - b.y);
        list.forEach(o => {
            if (o.b) {
                const b = o.b;
                if (b.type === 'hall') drawHall(c, b);
                else if (b.type === 'archer') drawArcher(c, b);
                else if (b.type === 'cannon') drawCannon(c, b);
                else drawDepot(c, b);
                if (b.hp < b.maxHp) bar(c, b.x, b.y - b.r - (b.type === 'hall' ? r.k * 36 : 12), b.r * 1.6, b.hp / b.maxHp, b.hp / b.maxHp > 0.4 ? '#2ecc71' : '#e74c3c');
            } else {
                drawEntity(o.t, false); // klasik moddaki bot çizimi (tek gözlü)
            }
        });

        r.projs.forEach(p => drawProjectile(c, p));

        r.parts.forEach(p => {
            c.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
            if (p.ring) {
                c.strokeStyle = p.color; c.lineWidth = 2;
                c.beginPath(); c.arc(p.x, p.y, 8 + (p.maxLife - p.life) * 1.6, 0, Math.PI * 2); c.stroke();
            } else {
                c.fillStyle = p.color;
                c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill();
            }
        });
        c.globalAlpha = 1;

        c.font = 'bold 15px Arial'; c.textAlign = 'center';
        r.nums.forEach(n => {
            c.globalAlpha = clamp(n.life / 30, 0, 1);
            c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 3; c.strokeText(n.txt, n.x, n.y);
            c.fillStyle = n.color; c.fillText(n.txt, n.x, n.y);
        });
        c.globalAlpha = 1;
        c.restore();
    }

    const prevOnDraw = window.GAME_EXT.hooks.onDraw;
    window.GAME_EXT.hooks.onDraw = function (c) {
        if (typeof prevOnDraw === 'function') prevOnDraw.apply(this, arguments);
        if (window.GAME_MODE !== MOD_ID || !raid) return;
        raidDraw(c);
    };

})();
