// ============================================================================
// mod8.js — KÖY BASKINI (v12)
// v11 (Şahin, Baloncu, KENERK, Havan, Büyücü, Bomba, X-Yay, Cehennem...) korunur.
// v12 YENİLİKLERİ:
//  - Köy düzeni GENİŞ: yatay telefonda yatay, dikey telefonda otomatik dikey döner.
//    Alt çubuk yüksekliği ölçülür, köy her ekrana sığar (sıkışıklık çözüldü).
//  - Küçük ALTIN DEPOSU ve İKSİR DEPOSU, ordu kampları, kışla, laboratuvar, büyü
//    fabrikası, klan kalesi: saldırı yapmayan (non-defense) çok sayıda bina.
//  - HAVA SAVUNMASI: sadece baloncuya ateş eder.
//  - Gizli TUZAKLAR: gizli bomba ve yay tuzağı (binalardan sayılmaz, SHOW_TRAPS ile görülür).
//  - BÜYÜLER (alttaki çubuktan seç, haritaya dokun): Yıldırım, Öfke, Şifa.
//  - İşçi kulübeleri ve ağaçlar (yıkılamaz süs, hedef alınmaz).
//  - Hasar döngülerindeki liste değiştirme hataları giderildi; Cehennem şarjı sıfırlanır.
// ============================================================================
(function () {
    'use strict';
    console.log('[MOD YÜKLENDİ] koy_baskini v12');

    const MOD_ID = 'koy_baskini';
    const RAID_TIME = 180;
    const RETARGET_FRAMES = 12;
    const SHOW_TRAPS = false;                    // true yaparsan tuzaklar silik görünür

    const ARMY = { slime: 8, bot: 4, nest: 2, bomber: 4, tank: 2, sahin: 3, balon: 2, kenerk: 1 };
    const SPELL_COUNT = { lightning: 2, rage: 2, heal: 2 };
    const SPELLS = {
        lightning: { radius: 34, dmg: 240, strikes: 3, interval: 10 },
        rage: { radius: 80, life: 360, speedMul: 1.4, dmgMul: 1.5 },
        heal: { radius: 80, life: 300, hps: 260 }
    };
    const VILLAGE_SCALE = 0.95;
    const TROOP_SCALE = 0.75;

    const SLIME = [
        { r: 18, hp: 620, dmg: 90, spd: 1.35 },
        { r: 12, hp: 300, dmg: 60, spd: 1.55 },
        { r: 7,  hp: 130, dmg: 36, spd: 1.85 }
    ];
    const SLIME_ATK = 48;
    const BOT = { r: 14, hp: 880, spd: 1.1, range: 90, dmg: 105, atk: 66 };
    const NEST = { r: 22, hp: 1500, spawnEvery: 160, spawns: 4 };
    const BOMBER = { r: 8, hp: 170, spd: 2.35, wallDmg: 900, bldDmg: 380, radius: 34 };
    const TANK = { r: 28, hp: 2400, spd: 0.85, dmg: 95, atk: 60 };
    const BALON = { r: 11, hp: 400, spd: 0.9, aoeRadius: 55, aoeDmg: 500 };
    const SAHIN = {
        r: 10, hp: 650, spd: 1.0,
        burstCount: 4, burstRange: 180, burstDmg: 180, burstAtk: 80,
        fallbackRange: 55, fallbackDmg: 105, fallbackAtk: 55
    };
    const KENERK = {
        r: 22, hp: 3800, spd: 0.9, range: 100, dmg: 167, atk: 55,
        passiveRegen: 5,
        heroHeal: 500,
        devArrowDmg: 250, devArrowMaxBld: 3,
        slimeCount: 4, slimeDelay: 120, slimeInterval: 60
    };
    const TRAP = { trigger: 14, bombR: 42, bombDmg: 220, springMaxHp: 1200, springDmg: 350 };

    const DEF = {
        archer: { range: 165, interval: 50, dmg: 62, speed: 9, kind: 'arrow', splash: 0 },
        cannon: { range: 120, interval: 105, dmg: 240, speed: 6.5, kind: 'ball', splash: 24 },
        tesla:  { range: 80, interval: 85, dmg: 115, kind: 'pulse', splash: 0 },
        havan:  { range: 200, interval: 285, dmg: 200, speed: 7, kind: 'ball', splash: 40 },
        buyucu: { range: 135, interval: 70, dmg: 90, speed: 8, kind: 'orb', splash: 50 },
        bomba:  { range: 70, interval: 90, dmg: 180, speed: 7, kind: 'ball', splash: 40, groundOnly: false },
        xyay:   { range: 190, interval: 70, dmg: 130, speed: 12, kind: 'arrow', splash: 0, groundOnly: true },
        hava:   { range: 150, interval: 60, dmg: 110, speed: 10, kind: 'missile', splash: 0, airOnly: true },
        cehennem: { range: 160, kind: 'beam', splash: 0, isInferno: true }
    };
    const BUILDING_HP = {
        hall: 5200, archer: 1500, cannon: 1800, depot: 1100, tesla: 1400, wall: 520,
        havan: 1600, buyucu: 1300, collector: 500, altin: 550,
        bomba: 900, xyay: 2200, cehennem: 1800,
        hava: 1300, goldstore: 1500, elixstore: 1500, camp: 800, barracks: 900, lab: 900, spellfac: 900, castle: 2000
    };
    const LOOT = {
        hall: 900, depot: 450, archer: 150, cannon: 150, tesla: 200,
        havan: 250, buyucu: 180, collector: 350, altin: 400,
        bomba: 200, xyay: 280, cehennem: 320,
        hava: 200, goldstore: 450, elixstore: 450, camp: 120, barracks: 150, lab: 200, spellfac: 200, castle: 400
    };
    const DEPLOY_MARGIN = 30;
    const DMG_COLOR = { physical: '#f1c40f', splash: '#e67e22', heal: '#2ecc71', crit: '#ff7675' };

    const TROOP_INFO = {
        slime: { label: 'Slime' }, bot: { label: 'Mor Bot' }, nest: { label: 'Yuva' },
        bomber: { label: 'Bombacı' }, tank: { label: 'Dev Bot' }, sahin: { label: 'Şahin' },
        balon: { label: 'Baloncu' }, kenerk: { label: 'KENERK' },
        lightning: { label: 'Yıldırım', spell: true },
        rage: { label: 'Öfke', spell: true },
        heal: { label: 'Şifa', spell: true }
    };
    const ICONS = {
        slime: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#2ecc71" stroke="#1e8449" stroke-width="3"/><circle cx="27" cy="20" r="4" fill="rgba(0,0,0,.45)"/></svg>',
        bot: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#9b59b6" stroke="#6c3483" stroke-width="3"/><circle cx="27" cy="20" r="4" fill="rgba(0,0,0,.45)"/></svg>',
        nest: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#27ae60" stroke="#145a32" stroke-width="3"/><circle cx="20" cy="20" r="11" fill="#1e8449"/><circle cx="20" cy="20" r="5" fill="#145a32"/></svg>',
        bomber: '<svg viewBox="0 0 40 40"><circle cx="20" cy="22" r="13" fill="#e67e22" stroke="#a04000" stroke-width="3"/><path d="M24 11 Q28 5 33 7" stroke="#f1c40f" stroke-width="3" fill="none"/><circle cx="26" cy="22" r="3.5" fill="rgba(0,0,0,.45)"/></svg>',
        tank: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#d35400" stroke="#873600" stroke-width="4"/><circle cx="20" cy="20" r="11" fill="none" stroke="#873600" stroke-width="2"/><circle cx="28" cy="20" r="4.5" fill="rgba(0,0,0,.45)"/></svg>',
        sahin: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#3498db" stroke="#21618c" stroke-width="3"/><path d="M10 20 L30 20 M26 13 L30 20 L26 27" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        balon: '<svg viewBox="0 0 40 40"><ellipse cx="20" cy="15" rx="14" ry="12" fill="#e74c3c" stroke="#7b241c" stroke-width="3"/><path d="M14 26 L26 26 L23 32 L17 32 Z" fill="#7b241c"/><circle cx="20" cy="32" r="3" fill="#f1c40f"/></svg>',
        kenerk: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#f39c12" stroke="#7e5109" stroke-width="3"/><path d="M12 12 L20 8 L28 12 L26 20 L20 24 L14 20 Z" fill="#f1c40f" stroke="#7e5109" stroke-width="1.5"/><circle cx="20" cy="16" r="2.5" fill="#fff"/></svg>',
        lightning: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#6c5ce7" stroke="#4834d4" stroke-width="3"/><path d="M23 6 L11 22 L19 22 L16 34 L29 17 L21 17 Z" fill="#f1c40f" stroke="#b7950b" stroke-width="1.5"/></svg>',
        rage: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#c0392b" stroke="#7b241c" stroke-width="3"/><path d="M20 6 Q27 15 24 21 Q28 20 28 26 Q28 33 20 34 Q12 33 12 26 Q12 20 17 17 Q16 12 20 6 Z" fill="#f39c12" stroke="#f1c40f" stroke-width="1.5"/></svg>',
        heal: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#27ae60" stroke="#145a32" stroke-width="3"/><path d="M17 9 H23 V17 H31 V23 H23 V31 H17 V23 H9 V17 H17 Z" fill="#fff"/></svg>'
    };

    let raid = null;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
    function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }

    // ===== ARAYÜZ =====
    const style = document.createElement('style');
    style.textContent = `
        .raid-mode #left-joystick, .raid-mode #right-joystick, .raid-mode #gadget-btn,
        .raid-mode #gadget-btn-2, .raid-mode #ulti-btn, .raid-mode #game-over-screen { display:none !important; }
        #raid-hud, #raid-bar, #raid-hint { display:none; position:absolute; z-index:30; }
        .raid-mode #raid-hud { display:flex; }
        .raid-mode #raid-bar { display:flex; flex-wrap:wrap; justify-content:center; max-width:96vw; }
        .raid-mode #raid-hint.show { display:block; }
        #raid-hud { top:10px; left:50%; transform:translateX(-50%); align-items:center; gap:16px;
            background:rgba(15,25,35,.85); border:2px solid #f1c40f; border-radius:16px; padding:6px 18px;
            color:#fff; font-weight:700; pointer-events:none; box-shadow:0 4px 14px rgba(0,0,0,.5); }
        #raid-hud .rh-time { font-size:20px; min-width:46px; text-align:center; }
        #raid-hud .rh-mid { text-align:center; line-height:1; }
        #raid-hud .rh-stars span { font-size:22px; color:#4a5560; margin:0 1px; transition:color .3s, text-shadow .3s; }
        #raid-hud .rh-stars span.on { color:#f1c40f; text-shadow:0 0 10px #f1c40f; }
        #raid-hud .rh-pct { font-size:15px; color:#ecf0f1; }
        #raid-hud .rh-loot { font-size:16px; color:#f1c40f; min-width:54px; text-align:right; }
        #raid-bar { bottom:14px; left:50%; transform:translateX(-50%); gap:5px; }
        .raid-troop { width:56px; padding:4px 2px 3px; background:rgba(15,25,35,.88); border:3px solid #34495e;
            border-radius:12px; text-align:center; color:#fff; font-size:9px; font-weight:700; position:relative;
            transition:all .15s; cursor:pointer; user-select:none; -webkit-user-select:none; touch-action:none; }
        .raid-troop svg { width:26px; height:26px; display:block; margin:0 auto 2px; }
        .raid-troop.spell:not(.sel) { border-color:#9b59b6; }
        .raid-troop.sel { border-color:#2ecc71; box-shadow:0 0 14px rgba(46,204,113,.75); transform:translateY(-8px); }
        .raid-troop.empty { opacity:.3; }
        .raid-troop.hero { border-color:#f1c40f; box-shadow:0 0 10px rgba(241,196,15,.5); }
        .raid-troop.hero.empty { opacity:.3; box-shadow:none; }
        .raid-troop .rt-count { position:absolute; top:-8px; right:-6px; background:#e74c3c; border-radius:11px;
            padding:0 5px; font-size:10px; border:2px solid #fff; }
        #raid-hint { bottom:112px; left:50%; transform:translateX(-50%); background:rgba(15,25,35,.85);
            color:#ecf0f1; padding:8px 16px; border-radius:12px; font-size:13px; font-weight:700;
            pointer-events:none; text-align:center; max-width:86%; }
        #raid-result { display:none; position:absolute; top:0; left:0; width:100%; height:100%;
            background:rgba(0,0,0,.7); z-index:40; flex-direction:column; align-items:center;
            justify-content:center; color:#fff; text-align:center; }
        .raid-mode #raid-result.show { display:flex; }
        #raid-result h1 { font-size:clamp(28px,8vw,44px); color:#f1c40f; margin:0 0 6px; text-shadow:0 4px 12px rgba(0,0,0,.6); }
        #raid-result .rr-stars span { font-size:clamp(44px,13vw,70px); color:#4a5560; margin:0 4px; }
        #raid-result .rr-stars span.on { color:#f1c40f; text-shadow:0 0 18px #f1c40f; animation:starPop .5s ease-out; }
        @keyframes starPop { 0% { transform:scale(0); } 70% { transform:scale(1.25); } 100% { transform:scale(1); } }
        #raid-result .rr-stats { font-size:17px; margin:10px 0 18px; line-height:1.6; color:#ecf0f1; }
        #raid-result button { padding:13px 30px; margin:5px; font-size:17px; font-weight:700; color:#fff; border:none;
            border-radius:10px; cursor:pointer; background:#2ecc71; box-shadow:0 4px 0 #27ae60; }
        #raid-result button.alt { background:#e74c3c; box-shadow:0 4px 0 #c0392b; }
        #mode-picker { display:flex; gap:10px; margin:2px 0 14px; justify-content:center; flex-wrap:wrap; }
        .mode-pill { padding:10px 18px; border-radius:20px; background:rgba(0,0,0,.4); border:3px solid transparent;
            color:#fff; font-weight:700; cursor:pointer; font-size:14px; }
        .mode-pill.selected { border-color:#2ecc71; background:rgba(46,204,113,.15); }
        #raid-hero-btn { display:none; position:absolute; top:80px; right:12px; width:70px; height:70px;
            border-radius:50%; background:radial-gradient(circle, #f39c12, #7e5109);
            border:3px solid #fff; color:#fff; font-weight:900; font-size:11px;
            flex-direction:column; align-items:center; justify-content:center;
            cursor:pointer; z-index:35; box-shadow:0 0 18px rgba(243,156,18,.7);
            text-align:center; line-height:1.1; user-select:none; -webkit-user-select:none; touch-action:none; }
        .raid-mode #raid-hero-btn.show { display:flex; }
        #raid-hero-btn .hero-cd { font-size:14px; opacity:.9; font-weight:900; }
        #raid-hero-btn.used { filter:grayscale(1); opacity:.35; pointer-events:none; box-shadow:none; }
        #raid-hero-btn.ready { animation:heroPulse 1.2s ease-in-out infinite; }
        @keyframes heroPulse { 0%,100% { box-shadow:0 0 18px rgba(243,156,18,.7); } 50% { box-shadow:0 0 28px rgba(243,156,18,1); } }
    `;
    document.head.appendChild(style);

    function makeEl(tag, id, html) {
        const el = document.createElement(tag);
        if (id) el.id = id;
        if (html !== undefined) el.innerHTML = html;
        document.body.appendChild(el);
        return el;
    }
    makeEl('div', 'raid-hud',
        '<div class="rh-time" id="rh-time">3:00</div>' +
        '<div class="rh-mid"><div class="rh-stars" id="rh-stars"><span>★</span><span>★</span><span>★</span></div>' +
        '<div class="rh-pct" id="rh-pct">0%</div></div>' +
        '<div class="rh-loot" id="rh-loot">0</div>');
    const barEl = makeEl('div', 'raid-bar', '');
    const hintEl = makeEl('div', 'raid-hint', 'Alttan birlik veya büyü seç, dokun');
    const resultEl = makeEl('div', 'raid-result',
        '<h1 id="rr-title"></h1><div class="rr-stars" id="rr-stars"><span>★</span><span>★</span><span>★</span></div>' +
        '<div class="rr-stats" id="rr-stats"></div>' +
        '<div><button id="rr-retry">Tekrar Dene</button><button class="alt" id="rr-menu">Ana Menü</button></div>');
    const heroBtn = makeEl('div', 'raid-hero-btn', 'KENERK<br>ÖZEL<br><span class="hero-cd"></span>');

    const timeEl = document.getElementById('rh-time');
    const pctEl = document.getElementById('rh-pct');
    const lootEl = document.getElementById('rh-loot');
    const starEls = document.getElementById('rh-stars').children;
    const heroCdEl = heroBtn.querySelector('.hero-cd');

    Object.keys(TROOP_INFO).forEach(type => {
        const b = document.createElement('div');
        b.className = 'raid-troop' + (type === 'kenerk' ? ' hero' : '') + (TROOP_INFO[type].spell ? ' spell' : '');
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
        document.getElementById('restart-btn').click();
    });

    let heroBtnLock = 0;
    heroBtn.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        const now = performance.now();
        if (now - heroBtnLock < 250) return;
        heroBtnLock = now;
        triggerHeroAbility();
    });

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

    // ===== KÖY KURULUMU =====
    function initRaid() {
        const W = canvas.width, H = canvas.height;
        const portrait = H > W;
        const topUI = 70;
        const barH = barEl.offsetHeight || 64;           // alt çubuk satır sayısına göre ölçülür
        const botUI = barH + 28;
        hintEl.style.bottom = (botUI + 8) + 'px';
        const availH = H - topUI - botUI;
        const HALF_LONG = 340, HALF_SHORT = 125;         // köyün tasarım yarı boyutları (uzun / kısa kenar)
        const kW = portrait ? (W * 0.94) / (2 * HALF_SHORT) : (W * 0.94) / (2 * HALF_LONG);
        const kH = portrait ? (availH * 0.94) / (2 * HALF_LONG) : (availH * 0.94) / (2 * HALF_SHORT);
        const k = clamp(Math.min(kW, kH), 0.3, 1.6) * VILLAGE_SCALE;
        const cx = W / 2, cy = topUI + availH / 2;
        const P = (x, y) => portrait ? { x: cx + y * k, y: cy + x * k } : { x: cx + x * k, y: cy + y * k };

        raid = {
            W, H, k, cx, cy, topUI, botUI, portrait,
            hw: (portrait ? HALF_SHORT : HALF_LONG) * k, hh: (portrait ? HALF_LONG : HALF_SHORT) * k,
            walls: [], buildings: [], defList: [], decor: [], traps: [], zones: [], bolts: [], spellFx: [],
            troops: [], projs: [], parts: [], nums: [],
            army: Object.assign({}, ARMY, SPELL_COUNT),
            selected: 'slime', time: RAID_TIME, started: false, over: false, idle: 0,
            destroyed: 0, total: 0, hallDown: false, loot: 0, shake: 0,
            defMult: window.GAME_DIFFICULTY === 'easy' ? 0.7 : 1,
            bg: null, drag: false, lastDeploy: 0, lastPos: { x: 0, y: 0 }, hudCache: '',
            hero: null, heroUsed: false, heroSlimeQueue: [], frameCount: 0
        };

        // Duvarlar (tasarım: 500 x 220)
        const wr = 8 * k, step = 10, WX = 250, WY = 110;
        const addWall = (x, y) => {
            const p = P(x, y);
            raid.walls.push({ type: 'wall', x: p.x, y: p.y, r: wr, hp: BUILDING_HP.wall, maxHp: BUILDING_HP.wall, destroyed: false, hitFlash: 0 });
        };
        for (let x = -WX; x <= WX - step; x += step) { addWall(x, -WY); addWall(x, WY); }
        addWall(WX, -WY); addWall(WX, WY);
        for (let y = -WY + step; y <= WY - step; y += step) { addWall(-WX, y); addWall(WX, y); }

        const addB = (type, x, y, r) => {
            const p = P(x, y);
            raid.buildings.push({
                type, x: p.x, y: p.y, r: r * k,
                hp: BUILDING_HP[type], maxHp: BUILDING_HP[type],
                destroyed: false, hitFlash: 0,
                aim: Math.random() * Math.PI * 2, reload: 30 + Math.random() * 30, recoil: 0,
                infernoCharge: 0, infernoTarget: null
            });
        };

        // Merkez
        addB('hall', 0, 0, 26);
        // Küçük depolar (hall çevresi)
        addB('goldstore', -50, -28, 11); addB('goldstore', 50, 28, 11);
        addB('elixstore', 50, -28, 11); addB('elixstore', -50, 28, 11);
        // Savunmalar
        addB('archer', -72, -62, 13); addB('archer', 72, 62, 13);
        addB('cannon', 72, -62, 13); addB('cannon', -72, 62, 13);
        addB('tesla', 0, 70, 11); addB('tesla', 0, -70, 11);
        addB('havan', -135, 0, 14); addB('havan', 135, 0, 14); addB('havan', 135, -70, 14);
        addB('buyucu', -135, -70, 13); addB('buyucu', 135, 70, 13);
        addB('hava', -100, 35, 12); addB('hava', 100, -35, 12);
        addB('xyay', -200, 0, 13); addB('xyay', 200, 0, 13);
        addB('bomba', -200, -70, 10); addB('bomba', 200, 70, 10);
        addB('cehennem', -200, 70, 11); addB('cehennem', 200, -70, 11);
        // Saldırı yapmayan (non-defense) binalar
        addB('barracks', -170, -35, 13); addB('lab', -170, 35, 13);
        addB('spellfac', 170, -35, 13); addB('castle', 170, 35, 16);
        addB('camp', -135, 70, 15); addB('camp', -100, -40, 15);
        addB('camp', 100, 40, 15); addB('camp', 200, -35, 15);
        addB('depot', -170, -75, 12); addB('depot', 170, 75, 12);
        // Duvar dışı kaynaklar
        [-60, 0, 60].forEach(y => { addB('collector', -285, y, 10); addB('collector', 285, y, 10); });
        [-30, 30].forEach(y => { addB('altin', -320, y, 10); addB('altin', 320, y, 10); });

        raid.defList = raid.buildings.filter(b => DEF[b.type]);
        raid.total = raid.buildings.length;

        // Süsler (yıkılamaz, hedef alınmaz)
        const addD = (type, x, y, r) => { const p = P(x, y); raid.decor.push({ type, x: p.x, y: p.y, r: r * k }); };
        addD('hut', -30, -92, 7); addD('hut', 30, 92, 7); addD('hut', -205, 35, 7);
        addD('hut', 232, 0, 7); addD('hut', -232, 0, 7);
        [[-275, -95], [275, 95], [-275, 95], [275, -95], [-300, -85], [300, 85]].forEach(t => addD('tree', t[0], t[1], 11));

        // Gizli tuzaklar (binalardan sayılmaz)
        const addT = (type, x, y) => { const p = P(x, y); raid.traps.push({ type, x: p.x, y: p.y }); };
        addT('bomb', -232, -40); addT('bomb', 232, 40); addT('bomb', -100, 0); addT('bomb', 100, 0);
        addT('spring', -300, 15); addT('spring', 300, -15); addT('spring', -100, -70);

        raid.hero = null;
        raid.heroUsed = false;
        raid.heroSlimeQueue = [];
        heroBtn.classList.remove('show', 'used', 'ready');
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

        const pad = 18 * k;
        rr(g, cx - hw - pad, cy - hh - pad, (hw + pad) * 2, (hh + pad) * 2, 30 * k);
        const dirt = g.createRadialGradient(cx, cy, 20, cx, cy, Math.max(hw, hh) + pad);
        dirt.addColorStop(0, '#c9a46a'); dirt.addColorStop(1, '#a98650');
        g.fillStyle = dirt; g.fill();
        g.strokeStyle = 'rgba(90,60,30,0.6)'; g.lineWidth = 3; g.stroke();
        for (let i = 0; i < 220; i++) {
            const x = cx + (rnd() - 0.5) * (hw + pad) * 2, y = cy + (rnd() - 0.5) * (hh + pad) * 2;
            g.fillStyle = 'rgba(70,45,20,0.12)';
            g.beginPath(); g.arc(x, y, 1 + rnd() * 3, 0, Math.PI * 2); g.fill();
        }

        function bush(x, y, s) {
            g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x + 3, y + s * 0.8, s * 1.1, s * 0.5, 0, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#2a6b2a'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#378a37'; g.beginPath(); g.arc(x - s * 0.3, y - s * 0.3, s * 0.65, 0, Math.PI * 2); g.fill();
        }
        for (let i = 0; i < 30; i++) {
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

    // ===== EFEKTLER =====
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
    function addRing(x, y, color, maxR, life) {
        raid.parts.push({ x, y, vx: 0, vy: 0, life, maxLife: life, color, size: 3, ring: true, ringMax: maxR });
    }

    // ===== HASAR =====
    function damageBuilding(b, dmg) {
        if (b.destroyed) return;
        b.hp -= dmg; b.hitFlash = 5;
        if (b.type !== 'wall') addNum(b.x, b.y - b.r, Math.round(dmg), DMG_COLOR.physical);
        else addParts(b.x, b.y, '#b2bec3', 2, 1.6, 14, 2);
        if (b.hp <= 0) destroyBuilding(b);
    }

    function destroyBuilding(b) {
        b.destroyed = true; b.hp = 0;
        if (b.type === 'wall') { addParts(b.x, b.y, '#95a5a6', 7, 2.4, 26, 3); return; }

        // Bomba Kulesi ölünce patlar — 200 hasar
        if (b.type === 'bomba') {
            const R = 60 * raid.k;
            for (const t of raid.troops.slice()) {
                if (!t.isDead && Math.hypot(t.x - b.x, t.y - b.y) < R + t.radius) damageTroop(t, 200);
            }
            addRing(b.x, b.y, '#e74c3c', R, 22);
            addParts(b.x, b.y, '#e74c3c', 18, 3.5, 28, 5);
            addParts(b.x, b.y, '#f1c40f', 10, 2.5, 22, 4);
            raid.shake = Math.max(raid.shake, 10);
        }

        addParts(b.x, b.y, '#7f8c8d', 22, 2.6, 60, 6);
        addParts(b.x, b.y, '#e67e22', 14, 3.2, 28, 4);
        raid.shake = Math.max(raid.shake, b.type === 'hall' ? 16 : 7);
        raid.destroyed++;
        if (b.type === 'hall') raid.hallDown = true;
        if (DEF[b.type]) {
            const i = raid.defList.indexOf(b);
            if (i > -1) raid.defList.splice(i, 1);
        }
        const gain = LOOT[b.type] || 0;
        raid.loot += gain;
        addNum(b.x, b.y - b.r - 10, '+' + gain, '#f9ca24');
    }

    function damageTroop(t, dmg) {
        if (t.isDead) return;
        t.hp -= dmg;
        addNum(t.x, t.y - t.radius - 6, Math.round(dmg), DMG_COLOR.crit);
        if (t.hp <= 0) killTroop(t);
    }

    function killTroop(t) {
        if (t.isDead) return;
        t.isDead = true;
        addParts(t.x, t.y, t.color, 10, 2.4, 30, 4);
        if (t.type === 'slime' && t.stage < 2) {
            const newStage = t.stage + 1;
            for (let i = 0; i < 2; i++) {
                const a = Math.random() * Math.PI * 2;
                spawnTroop('slime', t.x + Math.cos(a) * 12, t.y + Math.sin(a) * 12, newStage);
            }
            addRing(t.x, t.y, '#2ecc71', 22 * raid.k, 14);
        }
        const idx = raid.troops.indexOf(t);
        if (idx > -1) raid.troops.splice(idx, 1);
        if (t.type === 'kenerk' && raid.hero === t) {
            raid.hero = null;
            heroBtn.classList.remove('show', 'used', 'ready');
        }
    }

    // ===== BİRLİKLER =====
    function spawnTroop(type, x, y, stage) {
        const kt = TROOP_SCALE * clamp(raid.k / VILLAGE_SCALE, 0.7, 1.25);
        const base = { type, x, y, isDead: false, kbX: 0, kbY: 0, atk: 0, target: null, blocked: null,
            angle: Math.atan2(raid.cy - y, raid.cx - x), stage: stage || 0, atkInt: SLIME_ATK, _retarget: 0, rageT: 0 };
        let t;
        if (type === 'slime') {
            const s = SLIME[base.stage];
            t = Object.assign(base, { radius: s.r * kt, hp: s.hp, maxHp: s.hp, speed: s.spd, dmg: s.dmg, color: '#2ecc71' });
        } else if (type === 'bot') {
            t = Object.assign(base, { radius: BOT.r * kt, hp: BOT.hp, maxHp: BOT.hp, speed: BOT.spd, dmg: BOT.dmg, color: '#9b59b6' });
        } else if (type === 'bomber') {
            t = Object.assign(base, { radius: BOMBER.r * kt, hp: BOMBER.hp, maxHp: BOMBER.hp, speed: BOMBER.spd, dmg: 0, color: '#e67e22' });
        } else if (type === 'tank') {
            t = Object.assign(base, { radius: TANK.r * kt, hp: TANK.hp, maxHp: TANK.hp, speed: TANK.spd, dmg: TANK.dmg, color: '#d35400', atkInt: TANK.atk });
        } else if (type === 'sahin') {
            t = Object.assign(base, {
                radius: SAHIN.r * kt, hp: SAHIN.hp, maxHp: SAHIN.hp,
                speed: SAHIN.spd, dmg: SAHIN.burstDmg, color: '#3498db',
                atkInt: SAHIN.burstAtk, burstLeft: SAHIN.burstCount
            });
        } else if (type === 'balon') {
            t = Object.assign(base, { radius: BALON.r * kt, hp: BALON.hp, maxHp: BALON.hp, speed: BALON.spd, dmg: BALON.aoeDmg, color: '#e74c3c' });
        } else if (type === 'kenerk') {
            t = Object.assign(base, {
                radius: KENERK.r * kt, hp: KENERK.hp, maxHp: KENERK.hp,
                speed: KENERK.spd, dmg: KENERK.dmg, color: '#f39c12',
                atkInt: KENERK.atk, isHero: true
            });
            raid.hero = t;
            heroBtn.classList.add('show');
            if (raid.heroUsed) heroBtn.classList.add('used');
            else heroBtn.classList.add('ready');
        } else {
            t = Object.assign(base, { radius: NEST.r * kt, hp: NEST.hp, maxHp: NEST.hp, speed: 0, dmg: 0,
                color: '#27ae60', isNest: true, timer: 0, spawned: 0 });
        }
        raid.troops.push(t);
        return t;
    }

    function nearestBuilding(t) {
        let best = null, bd = Infinity;
        for (const b of raid.buildings) {
            if (b.destroyed) continue;
            const d = dist2(t, b);
            if (d < bd) { bd = d; best = b; }
        }
        return best;
    }
    function nearestDefense(t) {
        let best = null, bd = Infinity;
        for (const b of raid.defList) {
            if (b.destroyed) continue;
            const d = dist2(t, b);
            if (d < bd) { bd = d; best = b; }
        }
        return best;
    }
    function nearestWall(t) {
        let best = null, bd = Infinity;
        for (const w of raid.walls) {
            if (w.destroyed) continue;
            const d = dist2(t, w);
            if (d < bd) { bd = d; best = w; }
        }
        return best;
    }

    function kenerkPickTarget(t) {
        const range = KENERK.range * raid.k;
        let bestDef = null, dDefMin = Infinity;
        for (const b of raid.defList) {
            if (b.destroyed) continue;
            const d = Math.hypot(t.x - b.x, t.y - b.y);
            if (d - b.r <= range && d < dDefMin) { dDefMin = d; bestDef = b; }
        }
        if (bestDef) return bestDef;
        let bestBld = null, dBldMin = Infinity;
        for (const b of raid.buildings) {
            if (b.destroyed) continue;
            const d = Math.hypot(t.x - b.x, t.y - b.y);
            if (d - b.r <= range && d < dBldMin) { dBldMin = d; bestBld = b; }
        }
        if (bestBld) return bestBld;
        return nearestDefense(t) || nearestBuilding(t);
    }

    function resolveWalls(t, dirx, diry) {
        // Balon VE Şahin duvarları geçer
        if (t.type === 'balon' || t.type === 'sahin') return;
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

    function bomberExplode(t) {
        const R = BOMBER.radius * raid.k;
        for (const w of raid.walls) {
            if (!w.destroyed && Math.hypot(w.x - t.x, w.y - t.y) < R + w.r) damageBuilding(w, BOMBER.wallDmg);
        }
        for (const b of raid.buildings) {
            if (!b.destroyed && Math.hypot(b.x - t.x, b.y - t.y) < R + b.r) damageBuilding(b, BOMBER.bldDmg);
        }
        addParts(t.x, t.y, '#e67e22', 14, 3, 26, 4);
        addRing(t.x, t.y, '#e67e22', R, 16);
        raid.shake = Math.max(raid.shake, 6);
        t.isDead = true;
        const idx = raid.troops.indexOf(t);
        if (idx > -1) raid.troops.splice(idx, 1);
    }

    function balonExplode(t) {
        const R = BALON.aoeRadius * raid.k;
        for (const b of raid.buildings) {
            if (!b.destroyed && Math.hypot(b.x - t.x, b.y - t.y) < R + b.r) damageBuilding(b, BALON.aoeDmg);
        }
        addParts(t.x, t.y, '#e74c3c', 18, 3.5, 30, 5);
        addParts(t.x, t.y, '#f1c40f', 10, 2.5, 24, 4);
        addRing(t.x, t.y, '#e74c3c', R, 18);
        raid.shake = Math.max(raid.shake, 8);
        t.isDead = true;
        const idx = raid.troops.indexOf(t);
        if (idx > -1) raid.troops.splice(idx, 1);
    }

    function updateTroop(t, ts) {
        if (t.type === 'nest') { updateNest(t, ts); return; }

        // Öfke büyüsü etkisi
        const rage = t.rageT > 0;
        if (rage) t.rageT -= ts;
        const sMul = rage ? SPELLS.rage.speedMul : 1;
        const dMul = rage ? SPELLS.rage.dmgMul : 1;

        if (t.type === 'kenerk' && t.hp < t.maxHp) {
            t.hp = Math.min(t.maxHp, t.hp + KENERK.passiveRegen / 60 * ts);
            if (Math.random() < 0.08) addParts(t.x, t.y, '#2ecc71', 1, 0.5, 10, 1.5);
        }

        if (t.blocked && t.blocked.destroyed) t.blocked = null;

        t._retarget -= ts;
        let tgt;
        const needsRetarget = t._retarget <= 0 || !t.target || t.target.destroyed ||
            (t.target.isDead) || (t.blocked && t.target !== t.blocked);
        if (needsRetarget) {
            t._retarget = RETARGET_FRAMES;
            if (t.type === 'bomber') tgt = nearestWall(t) || nearestBuilding(t);
            else if (t.blocked) tgt = t.blocked;
            else if (t.type === 'kenerk') tgt = kenerkPickTarget(t);
            else if (t.type === 'tank' || t.type === 'balon')
                tgt = nearestDefense(t) || nearestBuilding(t);
            else tgt = nearestBuilding(t);
            t.target = tgt;
        } else {
            tgt = t.target;
        }

        if (!tgt || tgt.destroyed) return;
        const dx = tgt.x - t.x, dy = tgt.y - t.y, d = Math.hypot(dx, dy) || 1;
        t.angle = Math.atan2(dy, dx);
        t.atk -= ts * sMul;

        let troopRange = null;
        if (t.type === 'bot') troopRange = BOT.range * raid.k;
        else if (t.type === 'kenerk') troopRange = KENERK.range * raid.k;
        else if (t.type === 'sahin') troopRange = (t.burstLeft > 0 ? SAHIN.burstRange : SAHIN.fallbackRange) * raid.k;

        const isBalon = t.type === 'balon';
        const inRange = isBalon ? (d <= t.radius + tgt.r + 5)
                       : troopRange !== null ? (d - tgt.r <= troopRange)
                       : (d <= t.radius + tgt.r + 3);

        if (!inRange) {
            const sp = t.speed * raid.k * ts * sMul;
            t.x += dx / d * sp; t.y += dy / d * sp;
            resolveWalls(t, dx / d, dy / d);
        } else if (t.atk <= 0) {
            if (t.type === 'bot' || t.type === 'kenerk' || t.type === 'sahin') {
                let dmg;
                if (t.type === 'bot') dmg = BOT.dmg;
                else if (t.type === 'kenerk') dmg = KENERK.dmg;
                else dmg = t.burstLeft > 0 ? SAHIN.burstDmg : SAHIN.fallbackDmg;

                raid.projs.push({ kind: 'orb', from: 'troop', x: t.x, y: t.y, target: tgt, tx: tgt.x, ty: tgt.y,
                    speed: 8 * raid.k, dmg: dmg * dMul, splash: 0, angle: t.angle });

                if (t.type === 'sahin') {
                    if (t.burstLeft > 0) {
                        t.burstLeft--;
                        t.atk = SAHIN.burstAtk;
                        if (t.burstLeft === 0) {
                            addParts(t.x, t.y, '#3498db', 8, 2, 20, 3);
                            addRing(t.x, t.y, '#3498db', 30 * raid.k, 16);
                        }
                    } else {
                        t.atk = SAHIN.fallbackAtk;
                    }
                } else {
                    t.atk = t.type === 'bot' ? BOT.atk : KENERK.atk;
                }
            } else if (isBalon) {
                balonExplode(t);
            } else if (t.type === 'bomber') {
                bomberExplode(t);
            } else {
                damageBuilding(tgt, t.dmg * dMul);
                addParts(tgt.x, tgt.y, t.color, 3, 1.6, 14, 2.5);
                t.atk = t.atkInt;
            }
        }
    }

    // ===== KAHRAMAN ÖZEL YETENEĞİ — 1 KULLANIM =====
    function triggerHeroAbility() {
        if (!raid || raid.over) return;
        if (!raid.hero || raid.hero.isDead) return;
        if (raid.heroUsed) return;

        const h = raid.hero;
        raid.heroUsed = true;
        heroBtn.classList.remove('ready');
        heroBtn.classList.add('used');

        h.hp = Math.min(h.maxHp, h.hp + KENERK.heroHeal);
        addNum(h.x, h.y - h.radius - 15, '+' + KENERK.heroHeal, DMG_COLOR.heal);
        addRing(h.x, h.y, '#2ecc71', 40 * raid.k, 18);

        const nearDef = nearestDefense(h);
        const angle = nearDef ? Math.atan2(nearDef.y - h.y, nearDef.x - h.x) : h.angle;

        raid.projs.push({
            kind: 'hero_arrow', from: 'troop',
            x: h.x, y: h.y,
            tx: h.x + Math.cos(angle) * 800, ty: h.y + Math.sin(angle) * 800,
            speed: 16 * raid.k, dmg: KENERK.devArrowDmg, splash: 0, angle: angle,
            heroArrow: true, hitBlds: new Set(), hitCount: 0,
            maxBldHits: KENERK.devArrowMaxBld, _trail: 0
        });

        addParts(h.x, h.y, '#f39c12', 20, 3, 30, 5);
        addRing(h.x, h.y, '#f39c12', 60 * raid.k, 20);
        raid.shake = Math.max(raid.shake, 10);

        raid.heroSlimeQueue = [];
        let totalDelay = KENERK.slimeDelay;
        for (let i = 0; i < KENERK.slimeCount; i++) {
            raid.heroSlimeQueue.push({ timer: totalDelay, hx: h.x, hy: h.y });
            totalDelay += KENERK.slimeInterval;
        }
    }

    // ===== BÜYÜLER =====
    function castSpell(type, x, y) {
        if (!raid || raid.over || raid.army[type] <= 0) return;
        if (x < 8 || x > raid.W - 8 || y < raid.topUI - 10 || y > raid.H - raid.botUI + 10) { addNum(x, y, '✕', '#ff7675'); return; }
        const S = SPELLS[type];
        raid.army[type]--;
        raid.started = true;
        hintEl.classList.remove('show');
        if (type === 'lightning') {
            raid.spellFx.push({ x, y, left: S.strikes, wait: 0 });
            addRing(x, y, '#f1c40f', S.radius * raid.k, 14);
        } else {
            raid.zones.push({ type, x, y, r: S.radius * raid.k, life: S.life, maxLife: S.life });
            addRing(x, y, type === 'rage' ? '#e74c3c' : '#2ecc71', S.radius * raid.k, 18);
        }
        if (raid.army[type] <= 0) pickNextTroop();
        updateBar();
    }

    function updateSpells(ts) {
        const L = SPELLS.lightning;
        for (let i = raid.spellFx.length - 1; i >= 0; i--) {
            const f = raid.spellFx[i];
            f.wait -= ts;
            if (f.wait <= 0) {
                f.left--; f.wait = L.interval;
                raid.bolts.push({ x: f.x, y: f.y, life: 12, maxLife: 12 });
                const R = L.radius * raid.k;
                for (const b of raid.buildings.slice()) {
                    if (!b.destroyed && Math.hypot(b.x - f.x, b.y - f.y) < R + b.r) damageBuilding(b, L.dmg);
                }
                addParts(f.x, f.y, '#f1c40f', 8, 2.6, 18, 3);
                raid.shake = Math.max(raid.shake, 5);
                if (f.left <= 0) raid.spellFx.splice(i, 1);
            }
        }
        for (let i = raid.zones.length - 1; i >= 0; i--) {
            const z = raid.zones[i];
            z.life -= ts;
            if (z.life <= 0) { raid.zones.splice(i, 1); continue; }
            for (const t of raid.troops) {
                if (t.isDead || Math.hypot(t.x - z.x, t.y - z.y) > z.r + t.radius) continue;
                if (z.type === 'rage') { t.rageT = 8; if (Math.random() < 0.04) addParts(t.x, t.y, '#e74c3c', 1, 0.8, 14, 2); }
                else {
                    t.hp = Math.min(t.maxHp, t.hp + SPELLS.heal.hps / 60 * ts);
                    if (Math.random() < 0.05) addParts(t.x, t.y, '#2ecc71', 1, 0.8, 16, 2);
                }
            }
        }
        for (let i = raid.bolts.length - 1; i >= 0; i--) {
            raid.bolts[i].life -= ts;
            if (raid.bolts[i].life <= 0) raid.bolts.splice(i, 1);
        }
    }

    // ===== TUZAKLAR =====
    function updateTraps() {
        for (let i = raid.traps.length - 1; i >= 0; i--) {
            const tr = raid.traps[i];
            let trigger = null;
            for (const t of raid.troops) {
                if (t.isDead || t.type === 'balon' || t.type === 'nest') continue;
                if (Math.hypot(t.x - tr.x, t.y - tr.y) < TRAP.trigger * raid.k + t.radius) { trigger = t; break; }
            }
            if (!trigger) continue;
            raid.traps.splice(i, 1);
            if (tr.type === 'bomb') {
                const R = TRAP.bombR * raid.k;
                for (const u of raid.troops.slice()) {
                    if (!u.isDead && u.type !== 'balon' && Math.hypot(u.x - tr.x, u.y - tr.y) < R + u.radius) damageTroop(u, TRAP.bombDmg);
                }
                addRing(tr.x, tr.y, '#e67e22', R, 18);
                addParts(tr.x, tr.y, '#e67e22', 12, 3, 24, 4);
                raid.shake = Math.max(raid.shake, 6);
            } else {
                if (!trigger.isHero && trigger.hp <= TRAP.springMaxHp) { addNum(trigger.x, trigger.y - 14, 'FIRLADI!', '#f1c40f'); killTroop(trigger); }
                else damageTroop(trigger, TRAP.springDmg);
                addRing(tr.x, tr.y, '#bdc3c7', 26 * raid.k, 14);
                addParts(tr.x, tr.y, '#bdc3c7', 8, 2.4, 20, 3);
            }
        }
    }

    // ===== SAVUNMA =====
    function updateDefense(b, ts) {
        if (b.destroyed || !DEF[b.type]) return;
        const cfg = DEF[b.type];
        const range = cfg.range * raid.k;
        b.reload -= ts;
        if (b.recoil > 0) b.recoil -= ts;
        let best = null, bd = Infinity;
        for (const t of raid.troops) {
            if (t.isDead) continue;
            if (cfg.groundOnly && t.type === 'balon') continue;
            if (cfg.airOnly && t.type !== 'balon') continue;
            const d = dist(b, t);
            if (d - t.radius < range && d < bd) { bd = d; best = t; }
        }
        if (!best) {
            if (cfg.isInferno) { b.infernoTarget = null; b.infernoCharge = 0; }
            return;
        }

        if (b.type === 'tesla') {
            if (b.reload <= 0) {
                b.reload = cfg.interval;
                for (const t of raid.troops.slice()) {
                    if (!t.isDead && dist(b, t) - t.radius < range) damageTroop(t, cfg.dmg * raid.defMult);
                }
                addRing(b.x, b.y, '#f1c40f', range, 16);
                addParts(b.x, b.y, '#f1c40f', 6, 2.2, 16, 2.5);
            }
            return;
        }

        // Cehennem Kulesi — ramp ×1.75 yavaş
        if (cfg.isInferno) {
            if (b.infernoTarget !== best) {
                b.infernoTarget = best;
                b.infernoCharge = 0;
            }
            b.infernoCharge += ts;
            b.aim = Math.atan2(best.y - b.y, best.x - b.x);

            let dps;
            if (b.infernoCharge < 105)       dps = 35;
            else if (b.infernoCharge < 210)  dps = 90;
            else if (b.infernoCharge < 315)  dps = 200;
            else                             dps = 450;

            const dmg = (dps / 60) * ts * raid.defMult;
            best.hp -= dmg;

            if (Math.floor(b.infernoCharge) % 20 < ts) {
                addNum(best.x, best.y - best.radius - 6, Math.round(dps), '#e74c3c');
            }
            if (Math.random() < 0.5) {
                addParts(best.x, best.y, '#e74c3c', 1, 1.5, 12, 2);
            }
            if (best.hp <= 0) killTroop(best);
            return;
        }

        b.aim = Math.atan2(best.y - b.y, best.x - b.x);
        if (b.reload <= 0) {
            b.reload = cfg.interval;
            if (b.type === 'cannon' || b.type === 'havan' || b.type === 'bomba') {
                b.recoil = 8;
                addParts(b.x + Math.cos(b.aim) * b.r * 1.4, b.y + Math.sin(b.aim) * b.r * 1.4, '#bdc3c7', 5, 1.5, 18, 3);
            }
            if (b.type === 'xyay') {
                addParts(b.x + Math.cos(b.aim) * b.r * 1.2, b.y + Math.sin(b.aim) * b.r * 1.2, '#e67e22', 4, 2, 14, 2.5);
            }
            raid.projs.push({ kind: cfg.kind, from: 'def', x: b.x, y: b.y, target: best, tx: best.x, ty: best.y,
                speed: cfg.speed * raid.k, dmg: cfg.dmg * raid.defMult, splash: cfg.splash * raid.k, angle: b.aim });
        }
    }

    function updateProjectiles(ts) {
        for (let i = raid.projs.length - 1; i >= 0; i--) {
            const p = raid.projs[i];

            if (p.heroArrow) {
                p.x += Math.cos(p.angle) * p.speed * ts;
                p.y += Math.sin(p.angle) * p.speed * ts;
                p._trail += ts;
                if (p._trail >= 2) {
                    p._trail = 0;
                    raid.parts.push({ x: p.x - Math.cos(p.angle) * 15, y: p.y - Math.sin(p.angle) * 15,
                        vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
                        life: 18, maxLife: 18, color: '#f39c12', size: 3 });
                }
                if (p.x < -40 || p.x > canvas.width + 40 || p.y < -40 || p.y > canvas.height + 40) {
                    raid.projs.splice(i, 1); continue;
                }
                let hit = false;
                for (const b of raid.defList.slice()) {
                    if (b.destroyed || p.hitBlds.has(b)) continue;
                    if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + 15 * raid.k) {
                        p.hitBlds.add(b);
                        damageBuilding(b, p.dmg);
                        addParts(b.x, b.y, '#f39c12', 10, 2.5, 24, 4);
                        p.hitCount++;
                        if (p.hitCount >= p.maxBldHits) { hit = true; break; }
                    }
                }
                if (hit) { raid.projs.splice(i, 1); continue; }
                continue;
            }

            if (p.target && !p.target.isDead && !p.target.destroyed) { p.tx = p.target.x; p.ty = p.target.y; }
            const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy) || 1;
            const sp = p.speed * ts;
            p.angle = Math.atan2(dy, dx);
            const hitR = p.target ? (p.target.radius || p.target.r || 0) * 0.5 : 0;
            if (d <= sp + hitR) {
                if (p.from === 'def') {
                    if (p.splash > 0) {
                        for (const t of raid.troops.slice()) {
                            if (!t.isDead && Math.hypot(t.x - p.tx, t.y - p.ty) < p.splash + t.radius) damageTroop(t, p.dmg);
                        }
                        addParts(p.tx, p.ty, '#e67e22', 8, 2.2, 20, 4);
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

    // ===== YERLEŞTİRME =====
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
        if (SPELLS[raid.selected]) { castSpell(raid.selected, px, py); return; }       // büyü: haritanın her yerine
        if (!canDeploy(px, py)) { if (showMsg) addNum(px, py, '✕', '#ff7675'); return; }
        spawnTroop(raid.selected, px, py, 0);
        raid.army[raid.selected]--;
        raid.started = true;
        hintEl.classList.remove('show');
        addParts(px, py, '#ffffff', 8, 1.8, 18, 3);
        raid.parts.push({ x: px, y: py, vx: 0, vy: 0, life: 14, maxLife: 14, color: '#ffffff', size: 4, ring: true, ringMax: 22 });
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
        if (raid.selected && SPELLS[raid.selected]) return;                             // büyü sürüklenerek atılmaz
        const p = toCanvas(e);
        const now = performance.now();
        if (now - raid.lastDeploy > 140 && Math.hypot(p.x - raid.lastPos.x, p.y - raid.lastPos.y) > 18) {
            raid.lastDeploy = now; raid.lastPos = p;
            tryDeploy(p.x, p.y, false);
        }
    });
    window.addEventListener('pointerup', () => { if (raid) raid.drag = false; });
    window.addEventListener('pointercancel', () => { if (raid) raid.drag = false; });

    // ===== HUD =====
    function updateBar() {
        if (!raid) return;
        Array.from(barEl.children).forEach(el => {
            const type = el.dataset.t;
            const n = raid.army[type] || 0;
            el.querySelector('.rt-count').textContent = n;
            el.classList.toggle('empty', n <= 0);
            el.classList.toggle('sel', raid.selected === type && n > 0);
        });
    }

    function currentStars() {
        const pct = raid.destroyed / raid.total;
        return [pct >= 0.5, raid.hallDown, raid.destroyed === raid.total];
    }

    function updateHUD(force) {
        const secs = Math.max(0, Math.ceil(raid.time));
        const stars = currentStars();
        const key = secs + '|' + raid.destroyed + '|' + raid.loot + '|' + stars.join('') + '|' + (raid.heroUsed ? 1 : 0);
        if (!force && key === raid.hudCache) return;
        raid.hudCache = key;
        timeEl.textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
        pctEl.textContent = Math.round(raid.destroyed / raid.total * 100) + '%';
        lootEl.textContent = raid.loot;
        for (let i = 0; i < 3; i++) starEls[i].classList.toggle('on', stars[i]);
        if (raid.heroUsed) {
            heroCdEl.textContent = '✓';
            heroBtn.classList.remove('ready');
            heroBtn.classList.add('used');
        } else if (raid.hero && !raid.hero.isDead) {
            heroCdEl.textContent = '';
            heroBtn.classList.add('ready');
            heroBtn.classList.remove('used');
        } else {
            heroCdEl.textContent = '';
            heroBtn.classList.remove('ready');
        }
    }

    function endRaid(reason) {
        if (raid.over) return;
        raid.over = true;
        heroBtn.classList.remove('show', 'used', 'ready');
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

    // ===== ANA GÜNCELLEME =====
    function raidUpdate(ts) {
        try {
            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots.length = 0;
            stationaryBots.length = 0;
            boomerangBots.length = 0;
            fogBots.length = 0;
            nests.length = 0;
            spawnIndicators.length = 0;
            obstacles.length = 0;
            botBullets.length = 0;
            bullets.length = 0;
            slimeTimer = stationaryTimer = boomerangTimer = fogBotTimer = 0;
            lastObstacleTime = Date.now();
            if (!player.isDead) player.isDead = true;
        } catch (e) { /* sessizce geç */ }

        document.body.classList.add('raid-mode');

        if (!raid || Math.abs(raid.W - canvas.width) > 20 || Math.abs(raid.H - canvas.height) > 20) initRaid();

        raid.frameCount++;

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
        for (const b of raid.buildings) { if (b.hitFlash > 0) b.hitFlash -= ts; }
        for (const w of raid.walls) { if (w.hitFlash > 0) w.hitFlash -= ts; }

        for (let i = raid.heroSlimeQueue.length - 1; i >= 0; i--) {
            const s = raid.heroSlimeQueue[i];
            s.timer -= ts;
            if (s.timer <= 0) {
                spawnTroop('slime', s.hx + (Math.random() - 0.5) * 40, s.hy + (Math.random() - 0.5) * 40, 2);
                addParts(s.hx, s.hy, '#2ecc71', 6, 2, 20, 3);
                raid.heroSlimeQueue.splice(i, 1);
            }
        }

        if (raid.over) return;
        if (raid.started) raid.time -= ts / 60;

        updateSpells(ts);
        for (const b of raid.defList.slice()) updateDefense(b, ts);
        for (const t of raid.troops.slice()) if (!t.isDead) updateTroop(t, ts);
        updateTraps();
        updateProjectiles(ts);

        updateHUD(false);

        if (raid.destroyed === raid.total) { endRaid('win'); return; }
        if (raid.time <= 0) { raid.time = 0; updateHUD(true); endRaid('time'); return; }
        let left = 0;
        for (const k in raid.army) if (!SPELLS[k]) left += raid.army[k];
        if (raid.started && left === 0 && raid.troops.length === 0) {
            raid.idle += ts;
            if (raid.idle > 90) endRaid('lose');
        } else raid.idle = 0;
    }

    window.GAME_EXT.modes[MOD_ID] = {
        label: 'Köy Baskını',
        onStart() {
            raid = null;
            try { if (!player.isDead) player.isDead = true; } catch (e) {}
            heroBtn.classList.remove('show', 'used', 'ready');
        },
        onUpdate(ts) { raidUpdate(ts); }
    };

    const prevOnReset = window.GAME_EXT.hooks.onReset;
    window.GAME_EXT.hooks.onReset = function () {
        if (typeof prevOnReset === 'function') prevOnReset.apply(this, arguments);
        raid = null;
        document.body.classList.remove('raid-mode');
        resultEl.classList.remove('show');
        hintEl.classList.remove('show');
        heroBtn.classList.remove('show', 'used', 'ready');
    };

    // ===== ÇİZİM =====
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
        c.beginPath(); c.moveTo(x - r * 1.12, y - r * 0.5); c.lineTo(x, y - r * 1.3); c.lineTo(x + r * 1.12, y - r * 0.5); c.closePath();
        c.fillStyle = f ? '#fff' : '#cf3a2b'; c.fill();
        c.strokeStyle = '#7b241c'; c.lineWidth = 2; c.stroke();
        rr(c, x - r * 0.2, y + r * 0.22, r * 0.4, r * 0.68, 4); c.fillStyle = '#4e342e'; c.fill();
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
        c.beginPath(); c.arc(x, y, r * 0.3, 0, Math.PI * 2); c.fillStyle = '#f5cba7'; c.fill();
        c.beginPath(); c.arc(x, y - r * 0.08, r * 0.32, Math.PI, Math.PI * 2); c.fillStyle = '#27ae60'; c.fill();
        c.save(); c.translate(x, y); c.rotate(b.aim);
        c.strokeStyle = '#6d4c41'; c.lineWidth = 3;
        c.beginPath(); c.arc(r * 0.5, 0, r * 0.4, -1.15, 1.15); c.stroke();
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

    function drawTesla(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.6, r * 1.1, r * 0.6);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#34495e'; c.fill();
        c.strokeStyle = '#f1c40f'; c.lineWidth = 3; c.stroke();
        c.beginPath(); c.arc(x, y, r * 0.64, 0, Math.PI * 2); c.fillStyle = '#2c3e50'; c.fill();
        c.beginPath();
        c.moveTo(x + r * 0.14, y - r * 0.55); c.lineTo(x - r * 0.3, y + r * 0.08); c.lineTo(x - r * 0.02, y + r * 0.08);
        c.lineTo(x - r * 0.14, y + r * 0.55); c.lineTo(x + r * 0.3, y - r * 0.1); c.lineTo(x + r * 0.02, y - r * 0.1);
        c.closePath(); c.fillStyle = '#f1c40f'; c.fill();
        const ch = clamp(1 - b.reload / DEF.tesla.interval, 0, 1);
        c.beginPath(); c.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ch);
        c.strokeStyle = 'rgba(241,196,15,0.9)'; c.lineWidth = 2; c.stroke();
    }

    function drawHavan(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.6, r * 1.1, r * 0.6);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#5d4037'; c.fill();
        c.strokeStyle = '#3e2723'; c.lineWidth = 3; c.stroke();
        c.beginPath(); c.arc(x, y, r * 0.72, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#2c3e50'; c.fill();
        c.save(); c.translate(x, y); c.rotate(b.aim + Math.PI / 6);
        const back = b.recoil > 0 ? -b.recoil * 0.6 : 0;
        rr(c, -r * 0.25 + back, -r * 0.22, r * 1.15, r * 0.44, 4);
        c.fillStyle = f ? '#fff' : '#3e2723'; c.fill();
        c.strokeStyle = '#1a1a1a'; c.lineWidth = 2; c.stroke();
        c.beginPath(); c.arc(r * 0.9 + back, 0, r * 0.22, 0, Math.PI * 2);
        c.fillStyle = '#000'; c.fill();
        c.restore();
    }

    function drawBuyucu(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.6, r * 1.1, r * 0.6);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#6c5ce7'; c.fill();
        c.strokeStyle = '#4834d4'; c.lineWidth = 3; c.stroke();
        c.beginPath(); c.arc(x, y, r * 0.68, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#2c3e50'; c.fill();
        const pulse = 0.75 + Math.sin(Date.now() / 250 + x * 0.01) * 0.25;
        c.save();
        c.shadowColor = '#a29bfe'; c.shadowBlur = 12 * pulse;
        c.beginPath(); c.arc(x, y, r * 0.38 * pulse, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#a29bfe'; c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
        c.restore();
    }

    function drawBomba(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.6, r * 1.1, r * 0.6);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#4a2c1a'; c.fill();
        c.strokeStyle = '#2c1810'; c.lineWidth = 3; c.stroke();
        c.beginPath(); c.arc(x, y - r * 0.15, r * 0.72, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#1a1a1a'; c.fill();
        c.strokeStyle = '#000'; c.lineWidth = 2; c.stroke();
        c.beginPath(); c.arc(x - r * 0.25, y - r * 0.4, r * 0.2, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,255,255,0.3)'; c.fill();
        c.strokeStyle = '#8b7355'; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x, y - r * 0.85);
        c.quadraticCurveTo(x + r * 0.3, y - r * 1.1, x + r * 0.45, y - r * 1.0);
        c.stroke();
        const sparkle = Math.abs(Math.sin(Date.now() / 120));
        c.fillStyle = `rgba(255, ${Math.floor(150 + sparkle * 100)}, 0, ${0.6 + sparkle * 0.4})`;
        c.beginPath(); c.arc(x + r * 0.45, y - r * 1.0, 2 + sparkle * 2, 0, Math.PI * 2); c.fill();
    }

    function drawXyay(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.6, r * 1.1, r * 0.6);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#5d4037'; c.fill();
        c.strokeStyle = '#2c1810'; c.lineWidth = 3; c.stroke();
        c.beginPath(); c.arc(x, y, r * 0.75, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#424949'; c.fill();
        c.strokeStyle = '#1a1a1a'; c.lineWidth = 1.5; c.stroke();
        c.save(); c.translate(x, y); c.rotate(b.aim);
        const bowLen = r * 1.3;
        c.strokeStyle = f ? '#fff' : '#d4ac0d'; c.lineWidth = 3.5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, 0); c.lineTo(bowLen * 0.55, -bowLen * 0.5); c.stroke();
        c.beginPath(); c.moveTo(0, 0); c.lineTo(bowLen * 0.55, bowLen * 0.5); c.stroke();
        c.strokeStyle = f ? '#fff' : '#ecf0f1'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(bowLen * 0.55, -bowLen * 0.5); c.lineTo(bowLen * 0.55, bowLen * 0.5); c.stroke();
        const ch = clamp(1 - b.reload / DEF.xyay.interval, 0, 1);
        c.strokeStyle = `rgba(231, 76, 60, ${0.3 + ch * 0.7})`;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(bowLen * 0.55, -bowLen * 0.5);
        c.lineTo(bowLen * 0.2 + ch * bowLen * 0.35, 0);
        c.lineTo(bowLen * 0.55, bowLen * 0.5);
        c.stroke();
        c.beginPath(); c.arc(0, 0, r * 0.18, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#e67e22'; c.fill();
        c.restore();
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.font = `bold ${Math.floor(r * 0.5)}px Arial`;
        c.textAlign = 'center';
        c.fillText('⬇', x, y + r * 1.5);
    }

    function drawHava(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.6, r * 1.1, r * 0.6);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#7f8c8d'; c.fill();
        c.strokeStyle = '#34495e'; c.lineWidth = 3; c.stroke();
        c.beginPath(); c.arc(x, y, r * 0.62, 0, Math.PI * 2); c.fillStyle = '#2c3e50'; c.fill();
        c.save(); c.translate(x, y); c.rotate(b.aim);
        c.fillStyle = f ? '#fff' : '#ecf0f1';
        [-0.38, 0, 0.38].forEach(o => { rr(c, r * 0.05, r * o - r * 0.1, r * 0.95, r * 0.2, 2); c.fill(); });
        c.fillStyle = '#e74c3c';
        [-0.38, 0, 0.38].forEach(o => { c.beginPath(); c.arc(r * 1.0, r * o, r * 0.11, 0, Math.PI * 2); c.fill(); });
        c.restore();
    }

    function drawInferno(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        const chargeRatio = Math.min(1, b.infernoCharge / 315);
        shadow(c, x, y + r * 0.6, r * 1.1, r * 0.6);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#3a2a1a'; c.fill();
        c.strokeStyle = '#1a0f08'; c.lineWidth = 3; c.stroke();
        const fireR = r * (0.45 + chargeRatio * 0.35);
        const pulse = Math.sin(Date.now() / 100) * 0.15;
        c.save();
        c.shadowColor = '#ff4500';
        c.shadowBlur = 8 + chargeRatio * 20;
        c.beginPath(); c.arc(x, y - r * 0.1, fireR * (1 + pulse), 0, Math.PI * 2);
        c.fillStyle = `rgba(255, ${Math.floor(80 - chargeRatio * 80)}, 0, ${0.75 + chargeRatio * 0.25})`;
        c.fill();
        if (chargeRatio > 0.25) {
            c.beginPath(); c.arc(x, y - r * 0.1, fireR * 0.5 * chargeRatio, 0, Math.PI * 2);
            c.fillStyle = '#fff'; c.fill();
        }
        c.restore();
        c.save(); c.translate(x, y); c.rotate(b.aim);
        c.fillStyle = f ? '#fff' : '#3a2a1a';
        c.beginPath();
        c.moveTo(r * 0.65, -r * 0.35);
        c.lineTo(r * 1.25, -r * 0.18);
        c.lineTo(r * 1.25, r * 0.18);
        c.lineTo(r * 0.65, r * 0.35);
        c.closePath(); c.fill();
        c.strokeStyle = '#1a0f08'; c.lineWidth = 2; c.stroke();
        c.restore();
    }

    function drawCollector(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.5, r * 1.05, r * 0.45);
        rr(c, x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8, r * 0.35);
        c.fillStyle = f ? '#fff' : '#8d6e63'; c.fill();
        c.strokeStyle = '#4e342e'; c.lineWidth = 2.5; c.stroke();
        c.beginPath(); c.arc(x, y - r * 0.25, r * 0.6, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : 'rgba(155, 89, 182, 0.85)'; c.fill();
        c.strokeStyle = '#8e44ad'; c.lineWidth = 1.5; c.stroke();
        c.fillStyle = '#f9ca24';
        c.font = 'bold ' + Math.floor(r * 0.7) + 'px Arial';
        c.textAlign = 'center';
        c.fillText('+', x + r * 0.7, y - r * 0.7);
    }

    function drawAltin(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.5, r * 1.05, r * 0.45);
        rr(c, x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8, r * 0.35);
        c.fillStyle = f ? '#fff' : '#6e4a1e'; c.fill();
        c.strokeStyle = '#3a2408'; c.lineWidth = 2.5; c.stroke();
        c.beginPath(); c.arc(x, y - r * 0.25, r * 0.6, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : 'rgba(241, 196, 15, 0.95)'; c.fill();
        c.strokeStyle = '#b7950b'; c.lineWidth = 1.5; c.stroke();
        c.beginPath(); c.arc(x, y - r * 0.25, r * 0.22, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#fff8b8'; c.fill();
        const sparkle = Math.abs(Math.sin(Date.now() / 400 + x * 0.01));
        c.globalAlpha = sparkle * 0.8;
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(x - r * 0.3, y - r * 0.5, 1.5, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(x + r * 0.4, y - r * 0.1, 1.5, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        c.fillStyle = '#f9ca24';
        c.font = 'bold ' + Math.floor(r * 0.7) + 'px Arial';
        c.textAlign = 'center';
        c.fillText('+', x + r * 0.7, y - r * 0.7);
    }

    function drawDepot(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.7, r * 1.15, r * 0.55);
        rr(c, x - r, y - r * 0.6, r * 2, r * 1.5, 5);
        c.fillStyle = f ? '#fff' : '#8d5a2b'; c.fill();
        c.strokeStyle = '#4e2f12'; c.lineWidth = 3; c.stroke();
        rr(c, x - r * 1.05, y - r * 0.85, r * 2.1, r * 0.4, 4); c.fillStyle = f ? '#fff' : '#b07a3c'; c.fill();
        c.fillStyle = '#f1c40f';
        [[-0.45, -0.95], [-0.1, -1.05], [0.3, -0.95]].forEach(p => {
            c.beginPath(); c.arc(x + p[0] * r, y + p[1] * r, r * 0.17, 0, Math.PI * 2); c.fill();
        });
    }

    // --- Yeni non-defense binalar ---
    function drawGoldStore(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.6, r * 1.1, r * 0.5);
        rr(c, x - r, y - r * 0.55, r * 2, r * 1.35, 4);
        c.fillStyle = f ? '#fff' : '#8d5a2b'; c.fill(); c.strokeStyle = '#4e2f12'; c.lineWidth = 2.5; c.stroke();
        rr(c, x - r * 1.05, y - r * 0.95, r * 2.1, r * 0.55, 4);
        c.fillStyle = f ? '#fff' : '#f1c40f'; c.fill(); c.strokeStyle = '#b7950b'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#fff8b8'; c.beginPath(); c.arc(x, y - r * 0.68, r * 0.14, 0, Math.PI * 2); c.fill();
        rr(c, x - r * 0.14, y + r * 0.05, r * 0.28, r * 0.35, 2); c.fillStyle = '#f1c40f'; c.fill();
    }
    function drawElixStore(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.6, r * 1.1, r * 0.5);
        c.beginPath(); c.ellipse(x, y + r * 0.55, r * 0.92, r * 0.36, 0, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#6c3483'; c.fill();
        rr(c, x - r * 0.92, y - r * 0.65, r * 1.84, r * 1.2, 3);
        c.fillStyle = f ? '#fff' : '#8e44ad'; c.fill(); c.strokeStyle = '#4a235a'; c.lineWidth = 2.5; c.stroke();
        c.beginPath(); c.ellipse(x, y - r * 0.65, r * 0.92, r * 0.36, 0, 0, Math.PI * 2);
        c.fillStyle = f ? '#fff' : '#c39bd3'; c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(x - r * 0.6, y - r * 0.4, r * 0.22, r * 0.8);
    }
    function drawCamp(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.6, r * 1.1, r * 0.5);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = f ? '#fff' : '#7d6608'; c.fill();
        c.strokeStyle = '#4d3c05'; c.lineWidth = 2.5; c.stroke();
        [[-0.45, 0.15], [0.45, 0.15], [0, -0.35]].forEach((p, i) => {
            const tx = x + p[0] * r, ty = y + p[1] * r;
            c.beginPath(); c.moveTo(tx, ty - r * 0.5); c.lineTo(tx - r * 0.38, ty + r * 0.3); c.lineTo(tx + r * 0.38, ty + r * 0.3); c.closePath();
            c.fillStyle = f ? '#fff' : (i === 2 ? '#c0392b' : '#e67e22'); c.fill(); c.strokeStyle = '#4d3c05'; c.lineWidth = 1.5; c.stroke();
        });
        c.fillStyle = 'rgba(255,140,0,' + (0.6 + Math.abs(Math.sin(Date.now() / 150 + x)) * 0.4) + ')';
        c.beginPath(); c.arc(x, y + r * 0.55, r * 0.14, 0, Math.PI * 2); c.fill();
    }
    function drawBarracks(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.7, r * 1.15, r * 0.5);
        rr(c, x - r, y - r * 0.5, r * 2, r * 1.4, 4); c.fillStyle = f ? '#fff' : '#95a5a6'; c.fill();
        c.strokeStyle = '#566573'; c.lineWidth = 2.5; c.stroke();
        c.beginPath(); c.moveTo(x - r * 1.1, y - r * 0.45); c.lineTo(x, y - r * 1.15); c.lineTo(x + r * 1.1, y - r * 0.45); c.closePath();
        c.fillStyle = f ? '#fff' : '#c0392b'; c.fill(); c.strokeStyle = '#7b241c'; c.stroke();
        c.strokeStyle = '#ecf0f1'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x - r * 0.4, y - r * 0.1); c.lineTo(x + r * 0.4, y + r * 0.6); c.moveTo(x + r * 0.4, y - r * 0.1); c.lineTo(x - r * 0.4, y + r * 0.6); c.stroke();
    }
    function drawLab(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.7, r * 1.15, r * 0.5);
        rr(c, x - r, y - r * 0.5, r * 2, r * 1.4, 4); c.fillStyle = f ? '#fff' : '#5d6d7e'; c.fill();
        c.strokeStyle = '#2c3e50'; c.lineWidth = 2.5; c.stroke();
        rr(c, x - r * 1.05, y - r * 0.85, r * 2.1, r * 0.4, 3); c.fillStyle = f ? '#fff' : '#2980b9'; c.fill();
        c.beginPath(); c.moveTo(x - r * 0.12, y - r * 0.2); c.lineTo(x - r * 0.12, y + r * 0.1); c.lineTo(x - r * 0.45, y + r * 0.7);
        c.lineTo(x + r * 0.45, y + r * 0.7); c.lineTo(x + r * 0.12, y + r * 0.1); c.lineTo(x + r * 0.12, y - r * 0.2); c.closePath();
        c.fillStyle = f ? '#fff' : '#2ecc71'; c.fill(); c.strokeStyle = '#ecf0f1'; c.lineWidth = 1.5; c.stroke();
    }
    function drawSpellFac(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.7, r * 1.15, r * 0.5);
        rr(c, x - r, y - r * 0.5, r * 2, r * 1.4, 4); c.fillStyle = f ? '#fff' : '#6c3483'; c.fill();
        c.strokeStyle = '#4a235a'; c.lineWidth = 2.5; c.stroke();
        c.beginPath(); c.moveTo(x - r * 1.1, y - r * 0.45); c.lineTo(x, y - r * 1.2); c.lineTo(x + r * 1.1, y - r * 0.45); c.closePath();
        c.fillStyle = f ? '#fff' : '#8e44ad'; c.fill(); c.stroke();
        c.fillStyle = '#f1c40f'; c.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 === 0 ? r * 0.45 : r * 0.2;
            const px = x + Math.cos(a) * rad, py = y + r * 0.2 + Math.sin(a) * rad;
            if (i) c.lineTo(px, py); else c.moveTo(px, py);
        }
        c.closePath(); c.fill();
    }
    function drawCastle(c, b) {
        const r = b.r, x = b.x, y = b.y, f = b.hitFlash > 0;
        shadow(c, x, y + r * 0.7, r * 1.2, r * 0.5);
        rr(c, x - r * 0.8, y - r * 0.5, r * 1.6, r * 1.4, 3); c.fillStyle = f ? '#fff' : '#aab7b8'; c.fill();
        c.strokeStyle = '#566573'; c.lineWidth = 2.5; c.stroke();
        [[-0.85, -0.3], [0.85, -0.3], [-0.85, 0.7], [0.85, 0.7]].forEach(p => {
            c.beginPath(); c.arc(x + p[0] * r, y + p[1] * r, r * 0.34, 0, Math.PI * 2);
            c.fillStyle = f ? '#fff' : '#7f8c8d'; c.fill(); c.stroke();
        });
        rr(c, x - r * 0.2, y + r * 0.2, r * 0.4, r * 0.7, 3); c.fillStyle = '#4e342e'; c.fill();
        const wave = Math.sin(Date.now() / 250) * 3;
        c.strokeStyle = '#3e2723'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x, y - r * 0.5); c.lineTo(x, y - r * 1.2); c.stroke();
        c.beginPath(); c.moveTo(x, y - r * 1.2); c.lineTo(x + r * 0.5, y - r * 1.05 + wave * 0.4); c.lineTo(x, y - r * 0.9); c.closePath();
        c.fillStyle = '#3498db'; c.fill();
    }

    function drawDecor(c, d) {
        if (d.type === 'hut') {
            const r = d.r, x = d.x, y = d.y;
            shadow(c, x, y + r * 0.6, r * 1.1, r * 0.5);
            rr(c, x - r * 0.9, y - r * 0.3, r * 1.8, r * 1.2, 2); c.fillStyle = '#a0714a'; c.fill();
            c.beginPath(); c.moveTo(x - r * 1.15, y - r * 0.25); c.lineTo(x, y - r * 1.15); c.lineTo(x + r * 1.15, y - r * 0.25); c.closePath();
            c.fillStyle = '#6d4c41'; c.fill();
        } else {
            const r = d.r, x = d.x, y = d.y;
            shadow(c, x, y + r * 0.7, r * 1.1, r * 0.5);
            c.fillStyle = '#5d4037'; c.fillRect(x - r * 0.15, y, r * 0.3, r * 0.8);
            c.fillStyle = '#1e8449'; c.beginPath(); c.arc(x, y - r * 0.15, r * 0.85, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#27ae60'; c.beginPath(); c.arc(x - r * 0.25, y - r * 0.4, r * 0.5, 0, Math.PI * 2); c.fill();
        }
    }

    function drawWall(c, w) {
        const r = w.r, f = w.hitFlash > 0;
        rr(c, w.x - r, w.y - r, r * 2, r * 2, 3);
        c.fillStyle = f ? '#fff' : '#a5b0b4'; c.fill();
        c.strokeStyle = '#6b7780'; c.lineWidth = 1.5; c.stroke();
    }

    function drawRubble(c, b) {
        c.fillStyle = 'rgba(55,40,30,0.85)';
        c.beginPath(); c.arc(b.x, b.y, b.r * 0.95, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(95,75,60,0.9)';
        for (let i = 0; i < 6; i++) {
            const a = i * 1.05 + b.x;
            c.beginPath(); c.arc(b.x + Math.cos(a) * b.r * 0.5, b.y + Math.sin(a) * b.r * 0.5, b.r * 0.22, 0, Math.PI * 2); c.fill();
        }
    }

    function drawTroop(c, t) {
        const rage = t.rageT > 0;
        if (rage) {
            c.save(); c.globalAlpha = 0.45;
            c.beginPath(); c.arc(t.x, t.y, t.radius + 4, 0, Math.PI * 2);
            c.strokeStyle = '#e74c3c'; c.lineWidth = 2.5; c.stroke(); c.restore();
        }
        if (t.type === 'kenerk') {
            c.save();
            c.globalAlpha = 0.15 + Math.sin(Date.now() / 400) * 0.05;
            c.beginPath(); c.arc(t.x, t.y, t.radius * 1.8, 0, Math.PI * 2);
            c.fillStyle = '#f39c12'; c.fill();
            c.globalAlpha = 1;
            c.fillStyle = 'rgba(0,0,0,0.35)';
            c.beginPath(); c.ellipse(t.x, t.y + t.radius * 0.4, t.radius * 0.95, t.radius * 0.35, 0, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            c.fillStyle = '#f39c12'; c.fill();
            c.strokeStyle = '#7e5109'; c.lineWidth = 3.5; c.stroke();
            c.beginPath(); c.arc(t.x, t.y, t.radius * 0.6, 0, Math.PI * 2);
            c.fillStyle = 'rgba(126,81,9,0.5)'; c.fill();
            c.save(); c.translate(t.x, t.y); c.rotate(t.angle);
            c.beginPath();
            c.moveTo(t.radius * 0.9, 0);
            c.lineTo(t.radius * 0.3, -t.radius * 0.4);
            c.lineTo(t.radius * 0.3, t.radius * 0.4);
            c.closePath();
            c.fillStyle = '#fff'; c.fill();
            c.restore();
            c.fillStyle = '#f1c40f';
            c.beginPath();
            c.moveTo(t.x - t.radius * 0.5, t.y - t.radius * 1.05);
            c.lineTo(t.x - t.radius * 0.25, t.y - t.radius * 1.35);
            c.lineTo(t.x, t.y - t.radius * 1.1);
            c.lineTo(t.x + t.radius * 0.25, t.y - t.radius * 1.35);
            c.lineTo(t.x + t.radius * 0.5, t.y - t.radius * 1.05);
            c.closePath();
            c.fill();
            c.strokeStyle = '#7e5109'; c.lineWidth = 1.5; c.stroke();
            c.restore();
            c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(t.x - 22, t.y - t.radius - 22, 44, 5);
            c.fillStyle = '#e74c3c'; c.fillRect(t.x - 22, t.y - t.radius - 22, 44 * clamp(t.hp / t.maxHp, 0, 1), 5);
            c.strokeStyle = '#f1c40f'; c.lineWidth = 1;
            c.strokeRect(t.x - 22, t.y - t.radius - 22, 44, 5);
            return;
        }

        if (t.type === 'sahin') {
            const isBurst = t.burstLeft > 0;
            c.save();
            c.translate(t.x, t.y);
            c.fillStyle = 'rgba(0,0,0,0.3)';
            c.beginPath(); c.ellipse(0, t.radius * 0.4, t.radius * 0.9, t.radius * 0.35, 0, 0, Math.PI * 2); c.fill();
            if (isBurst) {
                c.beginPath(); c.arc(0, 0, t.radius + 3, 0, Math.PI * 2);
                c.strokeStyle = 'rgba(52, 152, 219, 0.7)'; c.lineWidth = 2; c.stroke();
            }
            c.rotate(t.angle);
            c.fillStyle = isBurst ? '#3498db' : '#5d6d7e';
            c.beginPath(); c.arc(0, 0, t.radius, 0, Math.PI * 2); c.fill();
            c.strokeStyle = isBurst ? '#21618c' : '#2c3e50'; c.lineWidth = 2; c.stroke();
            c.beginPath();
            c.moveTo(t.radius * 0.7, 0);
            c.lineTo(-t.radius * 0.3, -t.radius * 0.4);
            c.lineTo(-t.radius * 0.1, 0);
            c.lineTo(-t.radius * 0.3, t.radius * 0.4);
            c.closePath();
            c.fillStyle = '#fff'; c.fill();
            c.restore();
            c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(t.x - 12, t.y - t.radius - 8, 24, 3);
            c.fillStyle = isBurst ? '#3498db' : '#2ecc71';
            c.fillRect(t.x - 12, t.y - t.radius - 8, 24 * clamp(t.hp / t.maxHp, 0, 1), 3);
            return;
        }

        if (t.type === 'balon') {
            c.save();
            c.fillStyle = 'rgba(0,0,0,0.3)';
            c.beginPath(); c.ellipse(t.x, t.y + t.radius * 0.6, t.radius * 0.9, t.radius * 0.35, 0, 0, Math.PI * 2); c.fill();
            const h = 30;
            const bob = Math.sin(Date.now() / 400 + t.x * 0.01) * 3;
            c.translate(t.x, t.y - h + bob);
            c.beginPath(); c.ellipse(0, 0, t.radius * 1.1, t.radius * 0.95, 0, 0, Math.PI * 2);
            c.fillStyle = t.color; c.fill();
            c.strokeStyle = '#7b241c'; c.lineWidth = 2.5; c.stroke();
            c.beginPath();
            c.moveTo(-t.radius * 0.4, t.radius * 0.75);
            c.lineTo(t.radius * 0.4, t.radius * 0.75);
            c.lineTo(t.radius * 0.3, t.radius * 1.2);
            c.lineTo(-t.radius * 0.3, t.radius * 1.2);
            c.closePath();
            c.fillStyle = '#7b241c'; c.fill();
            c.restore();
            c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(t.x - 12, t.y - t.radius - h - 10, 24, 3);
            c.fillStyle = '#2ecc71'; c.fillRect(t.x - 12, t.y - t.radius - h - 10, 24 * clamp(t.hp / t.maxHp, 0, 1), 3);
            return;
        }

        c.save();
        c.translate(t.x, t.y);
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.beginPath(); c.ellipse(0, t.radius * 0.4, t.radius * 0.9, t.radius * 0.35, 0, 0, Math.PI * 2); c.fill();
        c.rotate(t.angle);
        c.fillStyle = t.color;
        c.beginPath(); c.arc(0, 0, t.radius, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2; c.stroke();
        c.beginPath(); c.arc(t.radius - 4, 0, 5, 0, Math.PI * 2);
        c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
        c.restore();
        c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(t.x - 12, t.y - t.radius - 8, 24, 3);
        c.fillStyle = '#2ecc71'; c.fillRect(t.x - 12, t.y - t.radius - 8, 24 * clamp(t.hp / t.maxHp, 0, 1), 3);
    }

    function drawProjectile(c, p) {
        c.save(); c.translate(p.x, p.y); c.rotate(p.angle);
        if (p.heroArrow) {
            c.globalAlpha = 0.4;
            c.strokeStyle = '#f39c12';
            c.lineWidth = 10;
            c.beginPath(); c.moveTo(-30, 0); c.lineTo(0, 0); c.stroke();
            c.globalAlpha = 1;
            c.fillStyle = '#f39c12';
            c.beginPath();
            c.moveTo(25, 0); c.lineTo(5, -8); c.lineTo(-15, 0); c.lineTo(5, 8);
            c.closePath(); c.fill();
            c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
            c.fillStyle = '#f1c40f';
            c.beginPath(); c.arc(-10, 0, 4, 0, Math.PI * 2); c.fill();
        } else if (p.kind === 'arrow') {
            c.strokeStyle = '#5d4037'; c.lineWidth = 2;
            c.beginPath(); c.moveTo(-9, 0); c.lineTo(7, 0); c.stroke();
            c.fillStyle = '#ecf0f1'; c.beginPath(); c.moveTo(10, 0); c.lineTo(5, -3); c.lineTo(5, 3); c.closePath(); c.fill();
        } else if (p.kind === 'ball') {
            c.fillStyle = '#2c3e50'; c.beginPath(); c.arc(0, 0, 6, 0, Math.PI * 2); c.fill();
        } else if (p.kind === 'missile') {
            c.fillStyle = 'rgba(236,240,241,0.5)'; c.beginPath(); c.arc(-7, 0, 4, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#ecf0f1'; rr(c, -5, -2.5, 11, 5, 2); c.fill();
            c.fillStyle = '#e74c3c'; c.beginPath(); c.moveTo(10, 0); c.lineTo(5, -3); c.lineTo(5, 3); c.closePath(); c.fill();
        } else {
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

        if (!r.over && r.selected && r.army[r.selected] > 0 && !SPELLS[r.selected]) {
            const m = DEPLOY_MARGIN * r.k;
            rr(c, r.cx - r.hw - m, r.cy - r.hh - m, (r.hw + m) * 2, (r.hh + m) * 2, 22);
            c.fillStyle = 'rgba(231,76,60,0.13)'; c.fill();
            c.strokeStyle = 'rgba(231,76,60,0.55)'; c.lineWidth = 2; c.setLineDash([10, 8]); c.stroke(); c.setLineDash([]);
        }

        // gizli tuzaklar (isteğe bağlı silik gösterim)
        if (SHOW_TRAPS) {
            for (const tr of r.traps) {
                c.globalAlpha = 0.35; c.fillStyle = tr.type === 'bomb' ? '#e67e22' : '#bdc3c7';
                c.beginPath(); c.arc(tr.x, tr.y, 4 * r.k + 2, 0, Math.PI * 2); c.fill();
            }
            c.globalAlpha = 1;
        }

        for (const b of r.buildings) if (b.destroyed) drawRubble(c, b);
        for (const w of r.walls) if (!w.destroyed) drawWall(c, w);

        // büyü alanları
        for (const z of r.zones) {
            const pulse = 0.14 + Math.sin(Date.now() / 160) * 0.05;
            c.save();
            c.globalAlpha = clamp(z.life / 30, 0, 1);
            c.beginPath(); c.arc(z.x, z.y, z.r, 0, Math.PI * 2);
            c.fillStyle = z.type === 'rage' ? 'rgba(231,76,60,' + pulse + ')' : 'rgba(46,204,113,' + pulse + ')'; c.fill();
            c.strokeStyle = z.type === 'rage' ? 'rgba(231,76,60,0.8)' : 'rgba(46,204,113,0.8)';
            c.lineWidth = 2; c.setLineDash([8, 8]); c.stroke(); c.restore();
        }

        // Cehennem beam — binaların üstünde, mermilerin altında
        for (const b of r.buildings) {
            if (b.destroyed || b.type !== 'cehennem') continue;
            if (!b.infernoTarget || b.infernoTarget.isDead) continue;
            const t = b.infernoTarget;
            const chargeRatio = Math.min(1, b.infernoCharge / 315);
            const beamW = 2 + chargeRatio * 6;
            c.save();
            c.globalAlpha = 0.35 + chargeRatio * 0.25;
            c.strokeStyle = '#ff4500';
            c.lineWidth = beamW + 5;
            c.lineCap = 'round';
            c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(t.x, t.y); c.stroke();
            c.globalAlpha = 0.9;
            c.strokeStyle = chargeRatio > 0.5 ? '#fff' : '#ffaa00';
            c.lineWidth = beamW;
            c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(t.x, t.y); c.stroke();
            c.restore();
        }

        const list = [];
        for (const d of r.decor) list.push({ y: d.y, d });
        for (const b of r.buildings) if (!b.destroyed) list.push({ y: b.y, b });
        for (const t of r.troops) if (!t.isDead) list.push({ y: t.y, t });
        list.sort((a, b) => a.y - b.y);
        for (const o of list) {
            if (o.d) { drawDecor(c, o.d); continue; }
            if (o.b) {
                const b = o.b;
                if (b.type === 'hall') drawHall(c, b);
                else if (b.type === 'archer') drawArcher(c, b);
                else if (b.type === 'cannon') drawCannon(c, b);
                else if (b.type === 'tesla') drawTesla(c, b);
                else if (b.type === 'havan') drawHavan(c, b);
                else if (b.type === 'buyucu') drawBuyucu(c, b);
                else if (b.type === 'collector') drawCollector(c, b);
                else if (b.type === 'altin') drawAltin(c, b);
                else if (b.type === 'cehennem') drawInferno(c, b);
                else if (b.type === 'bomba') drawBomba(c, b);
                else if (b.type === 'xyay') drawXyay(c, b);
                else if (b.type === 'hava') drawHava(c, b);
                else if (b.type === 'goldstore') drawGoldStore(c, b);
                else if (b.type === 'elixstore') drawElixStore(c, b);
                else if (b.type === 'camp') drawCamp(c, b);
                else if (b.type === 'barracks') drawBarracks(c, b);
                else if (b.type === 'lab') drawLab(c, b);
                else if (b.type === 'spellfac') drawSpellFac(c, b);
                else if (b.type === 'castle') drawCastle(c, b);
                else drawDepot(c, b);
                if (b.hp < b.maxHp) bar(c, b.x, b.y - b.r - (b.type === 'hall' ? r.k * 36 : 12), b.r * 1.6, b.hp / b.maxHp, b.hp / b.maxHp > 0.4 ? '#2ecc71' : '#e74c3c');
            } else {
                drawTroop(c, o.t);
            }
        }

        for (const p of r.projs) drawProjectile(c, p);

        // yıldırım çakmaları
        for (const bo of r.bolts) {
            const a = clamp(bo.life / bo.maxLife, 0, 1);
            c.save(); c.globalAlpha = a;
            c.strokeStyle = '#fff8b8'; c.lineWidth = 3; c.shadowColor = '#f1c40f'; c.shadowBlur = 14;
            c.beginPath();
            let sx = bo.x + (Math.random() - 0.5) * 30, sy = bo.y - 260;
            c.moveTo(sx, sy);
            for (let s = 1; s <= 7; s++) {
                const tt = s / 7;
                c.lineTo(sx + (bo.x - sx) * tt + (s < 7 ? (Math.random() - 0.5) * 26 : 0), sy + (bo.y - sy) * tt);
            }
            c.stroke();
            c.beginPath(); c.arc(bo.x, bo.y, (SPELLS.lightning.radius * r.k) * (1 - a * 0.4), 0, Math.PI * 2);
            c.fillStyle = 'rgba(255,248,184,0.35)'; c.fill();
            c.restore();
        }

        for (const p of r.parts) {
            c.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
            if (p.ring) {
                c.strokeStyle = p.color; c.lineWidth = 2;
                const rad = p.ringMax ? p.ringMax * (1 - p.life / p.maxLife) : 8 + (p.maxLife - p.life) * 1.6;
                c.beginPath(); c.arc(p.x, p.y, Math.max(1, rad), 0, Math.PI * 2); c.stroke();
            } else {
                c.fillStyle = p.color;
                c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill();
            }
        }
        c.globalAlpha = 1;

        c.font = 'bold 15px Arial'; c.textAlign = 'center';
        for (const n of r.nums) {
            c.globalAlpha = clamp(n.life / 30, 0, 1);
            c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 3; c.strokeText(n.txt, n.x, n.y);
            c.fillStyle = n.color; c.fillText(n.txt, n.x, n.y);
        }
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
