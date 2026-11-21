/*
 * mod32.js — SERBEST HESAPLAŞMA | Meydan Savaşçıları
 * Ana oyun ve varsa diğer modlardan sonra yükle: <script src="mod32.js"></script>
 * Tek koşu, herkes herkese rakip. Tur, ganimet ve enerji küpü yok.
 * Ters Köşe’yi, klasik arenayı ve oyuncu karakterlerini değiştirmez.
 * Süreler, çekirdeğin nominal 60 FPS birimlerindedir.
 * İki giriş: Serbest Hesaplaşma (gazlı) ve Usta Hesaplaşma (gazsız, 4 güçlü bot, göller, ekstra siper).
 */
(function () {
    'use strict';
    const EXT = window.GAME_EXT,
        ID = 'serbest_hesaplasma';
    if (
        !EXT?.modes ||
        !EXT.hooks ||
        typeof player === 'undefined' ||
        typeof bot === 'undefined' ||
        typeof canvas === 'undefined' ||
        typeof window.startGame !== 'function' ||
        typeof window.updateBulletLogic !== 'function' ||
        typeof window.drawBullet !== 'function'
    ) {
        console.warn('[mod32] Meydan Savaşçıları ana betiğinden sonra yüklenmeli.');
        return;
    }
    if (EXT.modes[ID]) return;
    const H = EXT.hooks,
        previous = {
            draw: H.onDraw,
            reset: H.onReset,
            target: H.getBotTarget,
            enemies: H.getExtraEnemies,
            projectiles: window.updateBulletLogic
        };
    const TAU = Math.PI * 2,
        FPS = 60;
    const GAS_WAIT = 15 * FPS,
        GAS_MIN = 145,
        GAS_STEP = 30;
    const RETURN_WAIT = 7 * FPS,
        RETURN_WARNING = 1.2 * FPS,
        SPAWN_GUARD = 48;
    const ULT_GAP = 8 * FPS;
    const GOLD = '#ffd177',
        LIME = '#8afa81';
    const TYPES = {
        keskin: {
            name: 'Keskin',
            color: '#5ba9dc',
            hp: 2650,
            speed: 1.9,
            range: 417,
            ideal: 290,
            vision: 480,
            fire: 94,
            wind: 19,
            damage: 530,
            gadget: 'Kalkan',
            ulti: 'Üçlü Hat'
        },
        baskinci: {
            name: 'Baskıncı',
            color: '#e8a14d',
            hp: 2900,
            speed: 2.31,
            range: 218,
            ideal: 108,
            vision: 390,
            fire: 79,
            wind: 13,
            damage: 232,
            gadget: 'Turbo',
            ulti: 'Çifte Saçma'
        },
        muhafiz: {
            name: 'Muhafız',
            color: '#df727c',
            hp: 4050,
            speed: 2.02,
            range: 93,
            ideal: 71,
            vision: 365,
            fire: 79,
            wind: 16,
            damage: 750,
            gadget: 'Onarım',
            ulti: 'Yer Sarsıntısı'
        },
        bombaci: {
            name: 'Bombacı',
            color: '#5eb5a1',
            hp: 2750,
            speed: 2.04,
            range: 362,
            ideal: 221,
            vision: 430,
            fire: 108,
            wind: 13,
            damage: 610,
            gadget: 'Mayın',
            ulti: 'Üçlü Bomba'
        }
    };
    const $ = id => document.getElementById(id);
    const pt = (x, y) => ({ x, y });
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const bearing = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
    const off = (p, a, r) => pt(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    const clamp = (x, a, b) => (a > b ? (a + b) * 0.5 : Math.max(a, Math.min(b, x)));
    const radDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
    const alive = e => !!e && e.hp > 0 && !e.isDead;
    const easy = () => window.GAME_DIFFICULTY === 'easy';
    const rand = (a, b) => a + Math.random() * (b - a);
    let run = null,
        returnMode = 'arena',
        ustaMode = false;
    const LAKE_SLOW = 0.55;
    const lakeAt = p => !!run?.lakes?.some(l => (p.x - l.x) ** 2 + (p.y - l.y) ** 2 < l.r * l.r);
    const active = () => !!run && window.GAME_MODE === ID;
    const guard = e => e !== player && e.guardUntil > run.t;
    const onField = () => run.slots.map(s => s.body).filter(alive);
    const fighters = () => [player, ...onField()].filter(alive);
    // Yalnızca Mod Seç'e bir giriş; aşağıdaki küçük paneller yalnız modda görünür.
    const style = document.createElement('style');
    style.textContent = ` #difficulty-screen #m32-start,#difficulty-screen #m32-usta-start{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3px;width:min(76vw,300px);min-height:46px;flex:none;margin:8px auto 0;padding:6px 10px;border:1px solid #8bee847d;border-radius:10px;background:#203527;color:#fff;cursor:pointer;font:inherit;text-align:center;touch-action:manipulation}
        #m32-start strong,#m32-usta-start strong{color:#a6f5a0;font-size:14px}
        #m32-start small,#m32-usta-start small{color:#e3eee0;font-size:10px}
        #m32-start:focus-visible,#m32-usta-start:focus-visible{outline:2px solid #a6f5a0;outline-offset:2px}
        #gameCanvas.m32-world{position:fixed;inset:0 auto auto 0;width:var(--m32-w);height:var(--m32-h);max-width:none;max-height:none;transform:translate3d(var(--m32-x,0px),var(--m32-y,0px),0);transform-origin:top left;touch-action:none}
        body.m32-playing #controls-hint,body.m32-playing #arena-back,body.m32-playing #game-over-screen{display:none!important}
        #m32-hud[hidden],#m32-leave[hidden],#m32-result[hidden],#m32-map[hidden]{display:none!important}
        #m32-hud,#m32-leave,#m32-result{font-family:system-ui,sans-serif}
        #m32-hud{position:absolute;z-index:12;pointer-events:none;top:max(8px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(395px,calc(100% - 108px));padding:6px 9px;border:1px solid #a8ff974d;border-radius:8px;background:#18252de9;color:#fff}
        #m32-hud-header{display:flex;gap:6px;align-items:center;justify-content:space-between;color:#a6f5a0;font-size:10px;font-weight:850;letter-spacing:.07em;white-space:nowrap}
        #m32-hud-line{display:flex;gap:5px;flex-wrap:wrap;line-height:1.2;margin-top:3px;color:#edf6f0;font-size:11px;font-weight:750}
        #m32-hud-notice{display:block;line-height:1.15;margin-top:3px;color:#dce8c4;font-size:10px}
        #m32-hud[data-danger] #m32-hud-notice{color:#dfff9b;font-weight:800}
        #m32-map{position:absolute;z-index:12;pointer-events:none;top:max(8px,env(safe-area-inset-top));right:max(7px,env(safe-area-inset-right));width:92px;height:auto;border:1px solid #a8ff974d;border-radius:8px;background:#18252de9}
        @media(max-width:625px){#m32-map{width:70px;top:calc(max(8px,env(safe-area-inset-top)) + 61px)}
        }
        @media (max-height:500px) and (orientation:landscape){ #m32-map{width:75px}
        #difficulty-screen:has(> #m32-start){padding-block:8px}
        #difficulty-screen:has(> #m32-start)>h1{font-size:24px;margin:0 0 5px}
        #difficulty-screen:has(> #m32-start)>p{margin:0 0 5px}
        #difficulty-screen:has(> #m32-start)>.difficulty-track{max-height:38vh;padding-block:4vh}
        }
        #m32-leave{position:absolute;z-index:17;left:max(6px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));min-width:43px;min-height:42px;border:1px solid #b4d2bb75;border-radius:8px;background:#1a2a29;color:#fff;font-size:17px;font-weight:800;cursor:pointer;touch-action:manipulation}
        #m32-result{position:absolute;inset:0;z-index:25;display:grid;place-items:center;background:#0e191edc;color:#fff;padding:14px}
        #m32-result>div{width:min(100%,360px);padding:18px;border:1px solid #a6f5a066;border-radius:13px;background:#203030;text-align:center}
        #m32-result h2{color:#a6f5a0;margin:0 0 9px;font-size:23px}
        #m32-result p{color:#e3f1e4;margin:0 0 13px;font-size:14px;line-height:1.45}
        #m32-result button{min-height:42px;padding:6px 12px;margin:3px;border:1px solid #a8ff9766;border-radius:8px;background:#2f453c;color:#fff;font-weight:800;cursor:pointer;touch-action:manipulation}
        #m32-result #m32-again{background:#a6f5a0;color:#182518}
        `;
    document.head.appendChild(style);
    const difficulty = $('difficulty-screen'),
        start = $('difficulty-start-btn');
    if (difficulty) {
        const b = document.createElement('button');
        b.id = 'm32-start';
        b.type = 'button';
        b.innerHTML =
            '<strong>Serbest Hesaplaşma’yı Başlat</strong><small>Kesintisiz hayatta kalma · Herkes herkese karşı</small>';
        const anchor = $('m31-start') || start;
        if (anchor && difficulty.contains(anchor)) anchor.after(b);
        else difficulty.append(b);
        b.addEventListener('click', () => enter(false));
        const u = document.createElement('button');
        u.id = 'm32-usta-start';
        u.type = 'button';
        u.innerHTML =
            '<strong>Usta Hesaplaşma’yı Başlat</strong><small>Gazsız · 4 güçlü bot · Göller ve ekstra siperler</small>';
        b.after(u);
        u.addEventListener('click', () => enter(true));
    }
    const hud = document.createElement('aside');
    hud.id = 'm32-hud';
    hud.hidden = true;
    hud.innerHTML =
        '<div id="m32-hud-header"><span>HESAPLAŞMA</span><time id="m32-time"></time></div><div id="m32-hud-line"></div><small id="m32-hud-notice"></small>';
    const leave = document.createElement('button');
    leave.id = 'm32-leave';
    leave.type = 'button';
    leave.hidden = true;
    leave.textContent = '←';
    leave.title = 'Savaşçı seçimine dön';
    leave.setAttribute('aria-label', leave.title);
    const result = document.createElement('section');
    result.id = 'm32-result';
    result.hidden = true;
    result.setAttribute('role', 'dialog');
    result.setAttribute('aria-modal', 'true');
    result.setAttribute('aria-labelledby', 'm32-result-title');
    result.innerHTML =
        '<div><h2 id="m32-result-title">Elendin</h2><p id="m32-result-info"></p><button id="m32-again" type="button">Tekrar Oyna</button><button id="m32-characters" type="button">Savaşçılar</button></div>';
    document.body.append(hud, leave, result);
    const ui = { time: $('m32-time'), line: $('m32-hud-line'), notice: $('m32-hud-notice') };
    function back() {
        $('restart-btn')?.click();
    }
    leave.addEventListener('click', back);
    $('m32-characters').addEventListener('click', back);
    $('m32-again').addEventListener('click', () => {
        back();
        enter(ustaMode);
    });
    function enter(usta = false) {
        if (gameStarted && !player.isDead) return;
        ustaMode = !!usta;
        if (window.GAME_MODE !== ID) returnMode = window.GAME_MODE || 'arena';
        window.GAME_MODE = ID;
        if (typeof selectedDifficulty !== 'undefined') window.GAME_DIFFICULTY = selectedDifficulty;
        if (difficulty) difficulty.style.display = 'none';
        window.startGame();
    }
    const clock = t => {
        const s = Math.floor(t / FPS);
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    };
    function text(el, value) {
        if (el.textContent !== value) el.textContent = value;
    }
    function hudTick() {
        const s = run,
            danger = outside(player);
        if (s.usta) {
            text(ui.time, clock(s.t));
            text(ui.line, `Usta · Bot ${onField().length}/${s.slots.length} · Eleme ${s.kills}`);
            text(ui.notice, lakeAt(player) ? 'Gölde yavaşlıyorsun!' : 'Gaz yok · 4 güçlü bot · Hepsini ele.');
            hud.toggleAttribute('data-danger', lakeAt(player));
            return;
        }
        text(ui.time, clock(s.t));
        text(ui.line, `Eleme ${s.kills} · Bot ${onField().length}/${s.slots.length}`);
        text(
            ui.notice,
            s.t < GAS_WAIT
                ? `Gaz ${Math.ceil((GAS_WAIT - s.t) / FPS)} sn sonra daralır.`
                : danger
                  ? 'GAZ! Yeşil sınırın içine dön.'
                  : s.radius <= GAS_MIN
                    ? 'Son çember · Hayatta kal!'
                    : 'Çember daralıyor · Herkes rakip.'
        );
        hud.toggleAttribute('data-danger', danger && s.t >= GAS_WAIT);
    }
    // Yaşam döngüsü ve arena alanları. Normal oyun kendi kontrol/karakter kodunu kullanır.
    function startRun() {
        const w = Math.round(clamp(innerWidth + 270, 1420, 1800)),
            h = Math.round(clamp(innerHeight + 230, 1060, 1350));
        const center = pt(w * 0.5, h * 0.5),
            radius = Math.min(w, h) * (ustaMode ? 0.58 : 0.46);
        run = {
            usta: ustaMode,
            lakes: [],
            w,
            h,
            phase: 'start',
            t: 0,
            gasAt: GAS_WAIT + GAS_STEP,
            center,
            radius,
            startRadius: radius,
            slots: [],
            kills: 0,
            grass: [],
            mines: [],
            queued: [],
            rings: [],
            solids: [],
            mesh: null,
            meshKey: 0,
            mouse: null,
            view: { x: 0, y: 0, w: innerWidth, h: innerHeight },
            drag: pt(0, 0),
            miniAt: 0,
            ground: null,
            lead: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        };
        result.hidden = true;
    }
    function sizeWorld() {
        if (canvas.width !== run.w) canvas.width = run.w;
        if (canvas.height !== run.h) canvas.height = run.h;
    }
    function oldRoundRect(x, y, w, h, r) {
        r = Math.max(0, Math.min(typeof r === 'number' ? r : 0, w * 0.5, h * 0.5));
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
    }
    function suppressCoreSpawns() {
        bot.isActive = bot2.isActive = false;
        slimeTimer = stationaryTimer = boomerangTimer = fogBotTimer = 0;
        lastObstacleTime = Date.now();
    }
    function stockMap() {
        const s = run;
        const covers = [
            [0.5, 0.72, 44],
            [0.33, 0.57, 42],
            [0.67, 0.57, 42],
            [0.39, 0.39, 39],
            [0.62, 0.4, 38],
            [0.49, 0.27, 36],
            [0.26, 0.43, 39],
            [0.74, 0.44, 37],
            [0.36, 0.7, 36],
            [0.63, 0.7, 37],
            [0.435, 0.53, 27],
            [0.57, 0.53, 28],
            [0.46, 0.35, 26],
            [0.54, 0.64, 27]
        ];
        const grass = [
            [0.39, 0.58, 144, 84],
            [0.6, 0.51, 143, 90],
            [0.31, 0.35, 160, 90],
            [0.69, 0.34, 158, 88],
            [0.5, 0.41, 164, 74],
            [0.3, 0.77, 160, 77],
            [0.7, 0.76, 156, 82],
            [0.5, 0.2, 160, 88]
        ];
        if (s.usta) {
            covers.push(
                [0.18, 0.32, 38],
                [0.82, 0.3, 38],
                [0.17, 0.78, 40],
                [0.83, 0.78, 40],
                [0.5, 0.9, 36],
                [0.5, 0.08, 36]
            );
            s.lakes = [
                [0.15, 0.55, 78],
                [0.85, 0.55, 78],
                [0.5, 0.82, 72],
                [0.5, 0.46, 58]
            ].map(([x, y, r]) => ({ x: x * s.w, y: y * s.h, r }));
        }
        s.grass = grass.map(([x, y, w, h]) => ({ x: x * s.w - w / 2, y: y * s.h - h / 2, w, h }));
        obstacles = covers.map(([x, y, r]) => ({ x: x * s.w, y: y * s.h, radius: r, hp: 1450, maxHp: 1450 }));
        rebuildSolids();
    }
    function initField() {
        const s = run;
        canvas.classList.add('m32-world');
        document.body.classList.add('m32-playing');
        canvas.style.setProperty('--m32-w', s.w + 'px');
        canvas.style.setProperty('--m32-h', s.h + 'px');
        if (typeof ctx.roundRect !== 'function') {
            s.oldRoundRect = Object.getOwnPropertyDescriptor(ctx, 'roundRect');
            ctx.roundRect = oldRoundRect;
        }
        sizeWorld();
        clearControls();
        bullets = [];
        botBullets = [];
        floatingNumbers = [];
        particles = [];
        explosions = [];
        spawnIndicators = [];
        slimeBots = [];
        stationaryBots = [];
        boomerangBots = [];
        fogBots = [];
        nests = [];
        fogAreas = [];
        ghostZones = [];
        cactusWalls = [];
        spikeFields = [];
        samGloves = [];
        souls = [];
        specialSouls = [];
        screenShake = 0;
        botsKilled = 0;
        suppressCoreSpawns();
        stockMap();
        s.ground = terrain();
        const candidates = [
            pt(s.center.x, s.center.y + s.startRadius * 0.33),
            pt(s.center.x - 63, s.center.y + s.startRadius * 0.37),
            s.center
        ];
        const spawn = candidates.find(p => free(p, player.radius)) || findSpawn(true, player.radius) || s.center;
        player.x = spawn.x;
        player.y = spawn.y;
        player.angle = -Math.PI / 2;
        player.isDead = false;
        player.lastShotTime = 0;
        player.lastHitTime = Date.now();
        const order = s.usta
            ? ['keskin', 'baskinci', 'muhafiz', 'bombaci']
            : ['keskin', 'baskinci', 'muhafiz', 'bombaci', 'baskinci', 'bombaci', 'keskin', 'muhafiz'];
        for (let i = 0; i < order.length; i++) {
            const slot = { index: i, type: order[i], body: null, warning: null, due: 0, lives: 0 };
            s.slots.push(slot);
            spawnBody(
                slot,
                findSpawn(true, bot.radius) || off(s.center, (i * TAU) / order.length, s.startRadius * 0.68),
                true
            );
        }
        s.phase = 'play';
        hud.hidden = leave.hidden = map.hidden = false;
        follow(0, true);
        hudTick();
        mapTick();
    }
    function endRun(win = false) {
        const s = run;
        if (!s || s.phase === 'over') return;
        s.phase = 'over';
        player.isDead = true;
        player.ultiHazirlik = false;
        clearControls();
        bullets.length = botBullets.length = 0;
        hud.hidden = leave.hidden = map.hidden = true;
        text($('m32-result-title'), win ? 'Kazandın!' : 'Elendin');
        text(
            $('m32-result-info'),
            win ? `${clock(s.t)} sürede 4 güçlü botu da eledin` : `${clock(s.t)} hayatta kaldın · ${s.kills} eleme`
        );
        result.hidden = false;
        $('m32-again').focus({ preventScroll: true });
    }
    function resetRun() {
        if (!run) return;
        const s = run;
        clearControls();
        lastMouseX = s.mouse?.x ?? innerWidth / 2;
        lastMouseY = s.mouse?.y ?? innerHeight / 2;
        if (ctx.roundRect === oldRoundRect) {
            if (s.oldRoundRect) Object.defineProperty(ctx, 'roundRect', s.oldRoundRect);
            else delete ctx.roundRect;
        }
        run = null;
        canvas.classList.remove('m32-world');
        document.body.classList.remove('m32-playing');
        for (const key of ['--m32-w', '--m32-h', '--m32-x', '--m32-y']) canvas.style.removeProperty(key);
        resize();
        if (bot.isActive && !gameStarted) bot.x = canvas.width - 150;
        hud.hidden = leave.hidden = result.hidden = map.hidden = true;
        if (window.GAME_MODE === ID) window.GAME_MODE = returnMode;
        returnMode = 'arena';
    }
    // Geometri ve yol bulma: aynı 20 px taban gövdesi, siperlerin çevresinden rota.
    function impact(a, b, q, r) {
        const dx = b.x - a.x,
            dy = b.y - a.y,
            fx = a.x - q.x,
            fy = a.y - q.y;
        const c = fx * fx + fy * fy - r * r;
        if (c <= 0) return 0;
        const aa = dx * dx + dy * dy,
            bb = fx * dx + fy * dy;
        if (!aa || bb >= 0) return Infinity;
        const disc = bb * bb - aa * c;
        if (disc < 0) return Infinity;
        const t = (-bb - Math.sqrt(disc)) / aa;
        return t >= 0 && t <= 1 ? t : Infinity;
    }
    function clear(a, b, pad = 0, ignore = null) {
        for (const o of run.solids)
            if (o !== ignore && o.hp > 0 && impact(a, b, o, o.radius + pad) !== Infinity) return false;
        return true;
    }
    function inside(p, r = 0) {
        const m = WALL_THICKNESS + r;
        return p.x >= m && p.x <= run.w - m && p.y >= m && p.y <= run.h - m;
    }
    function bound(p, r = 0) {
        const m = WALL_THICKNESS + r;
        return pt(clamp(p.x, m, run.w - m), clamp(p.y, m, run.h - m));
    }
    function free(p, r) {
        return inside(p, r) && clear(p, p, r + 2);
    }
    function outside(p) {
        return !run.usta && dist(p, run.center) > run.radius;
    }
    function rebuildSolids() {
        const list = obstacles.concat(cactusWalls).filter(o => o.hp > 0);
        if (list.length === run.solids.length && list.every((o, i) => o === run.solids[i])) return;
        run.solids = list;
        run.mesh = null;
        run.meshKey++;
    }
    function makeMesh() {
        const r = bot.radius,
            m = WALL_THICKNESS + r + 5,
            w = run.w - 2 * m,
            h = run.h - 2 * m;
        const nx = Math.ceil(w / 53) + 1,
            ny = Math.ceil(h / 53) + 1,
            nodes = [];
        for (let y = 0; y < ny; y++)
            for (let x = 0; x < nx; x++) {
                const p = pt(m + (x * w) / (nx - 1), m + (y * h) / (ny - 1));
                nodes.push({ ...p, i: y * nx + x, open: free(p, r), edges: [] });
            }
        for (let y = 0; y < ny; y++)
            for (let x = 0; x < nx; x++) {
                const u = nodes[y * nx + x];
                if (!u.open) continue;
                for (const [dx, dy] of [
                    [1, 0],
                    [0, 1],
                    [1, 1],
                    [-1, 1]
                ]) {
                    if (x + dx < 0 || x + dx >= nx || y + dy >= ny) continue;
                    const v = nodes[(y + dy) * nx + x + dx];
                    if (!v.open || !clear(u, v, r + 2)) continue;
                    const d = dist(u, v);
                    u.edges.push({ to: v, d });
                    v.edges.push({ to: u, d });
                }
            }
        return nodes;
    }
    function nearestNode(nodes, p, r, trace) {
        let best = null,
            d2 = Infinity;
        for (const n of nodes)
            if (n.open) {
                const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2;
                if (d < d2 && (!trace || clear(p, n, r + 1))) {
                    d2 = d;
                    best = n;
                }
            }
        return best;
    }
    function getPath(e, desired) {
        const r = e.radius,
            goal = bound(desired, r + 2);
        if (free(goal, r) && clear(e, goal, r + 2)) return [goal];
        const nodes = run.mesh || (run.mesh = makeMesh());
        const a = nearestNode(nodes, e, r, true),
            b = nearestNode(nodes, goal, r, free(goal, r));
        if (!a || !b) return [];
        const distances = new Float64Array(nodes.length),
            seen = new Uint8Array(nodes.length),
            parents = new Int16Array(nodes.length);
        distances.fill(Infinity);
        distances[a.i] = 0;
        parents.fill(-1);
        const open = [{ node: a, f: dist(a, b) }];
        let last = a,
            best = dist(a, b);
        while (open.length) {
            let i = 0;
            for (let j = 1; j < open.length; j++) if (open[j].f < open[i].f) i = j;
            const { node } = open[i];
            open[i] = open[open.length - 1];
            open.pop();
            if (seen[node.i]) continue;
            seen[node.i] = 1;
            const remaining = dist(node, b);
            if (remaining < best) {
                best = remaining;
                last = node;
            }
            if (node === b) break;
            for (const edge of node.edges)
                if (!seen[edge.to.i]) {
                    const cost = distances[node.i] + edge.d;
                    if (cost >= distances[edge.to.i] - 1e-6) continue;
                    distances[edge.to.i] = cost;
                    parents[edge.to.i] = node.i;
                    open.push({ node: edge.to, f: cost + dist(edge.to, b) });
                }
        }
        const path = [];
        for (let i = last.i; i >= 0; i = parents[i]) path.unshift(nodes[i]);
        if (last === b && free(goal, r) && clear(b, goal, r + 2)) path.push(goal);
        return path;
    }
    const turn = (e, a, dt) => {
        e.angle += clamp(radDiff(e.angle, a), -0.165 * dt, 0.165 * dt);
    };
    function locomotion(e, dt, roster) {
        if (!Number.isFinite(e.x + e.y)) Object.assign(e, e.safe);
        if (Math.hypot(e.kbX || 0, e.kbY || 0) > 1.3) return;
        // Çekirdeğin geri itmesi siper sınırında biterse, bir piksel dışarı alıp yeniden rota kur.
        if (!free(e, e.radius))
            for (const o of run.solids) {
                if (o.hp <= 0 || dist(o, e) > o.radius + e.radius + 2) continue;
                const p = bound(
                    off(o, dist(o, e) > 0.25 ? bearing(o, e) : e.angle, o.radius + e.radius + 4),
                    e.radius + 2
                );
                if (free(p, e.radius)) {
                    Object.assign(e, p);
                    e.pathAt = 0;
                    break;
                }
            }
        if (run.t >= e.pathAt || e.meshKey !== run.meshKey || !e.pathGoal || dist(e.pathGoal, e.goal) > 60) {
            e.path = getPath(e, e.goal);
            e.pathAt = run.t + rand(22, 35);
            e.meshKey = run.meshKey;
            e.pathGoal = e.goal;
        }
        while (e.path.length && dist(e, e.path[0]) < 4) e.path.shift();
        while (e.path.length > 1 && clear(e, e.path[1], e.radius + 2)) e.path.shift();
        if (!e.path.length) return;
        const speed =
            e.speed *
            (e.turboUntil > run.t ? 1.37 : 1) *
            (e.wind?.kind === 'ulti' ? 0.58 : e.wind ? 0.8 : 1) *
            (lakeAt(e) ? LAKE_SLOW : 1);
        const a = bearing(e, e.path[0]),
            length = Math.min(dist(e, e.path[0]), speed * dt);
        const step = off(e, a, length);
        for (const other of roster)
            if (other !== e && alive(other)) {
                const d = dist(e, other),
                    m = e.radius + other.radius + 8;
                if (d < 0.01 || d >= m) continue;
                const push = Math.min(length * 0.85, (m - d) * 0.105);
                step.x += ((e.x - other.x) / d) * push;
                step.y += ((e.y - other.y) / d) * push;
            }
        const before = pt(e.x, e.y);
        for (const p of [bound(step, e.radius), pt(step.x, e.y), pt(e.x, step.y)])
            if (free(p, e.radius)) {
                e.x = p.x;
                e.y = p.y;
                e.safe = pt(e.x, e.y);
                break;
            }
        if (dist(before, e) < 0.12 && length > 0.22) {
            e.stuck += dt;
            if (e.stuck > 19) {
                e.thinkAt = e.pathAt = 0;
                e.side *= -1;
                e.stuck = 0;
            }
        } else e.stuck = 0;
    }
    // Her yuva aynı bot tipini, çember içinde ve uyarı süresinden sonra geri getirir.
    function findSpawn(initial, r) {
        const s = run,
            roster = fighters(),
            warnings = s.slots.map(x => x.warning).filter(Boolean);
        let best = null,
            bestScore = -Infinity;
        const startAngle = rand(0, TAU);
        for (let i = 0; i < 72; i++) {
            const f = i / 71;
            const frac = initial ? 0.57 + f * 0.33 : 0.33 + f * 0.58;
            const p = off(s.center, startAngle + i * 2.399963, Math.max(10, s.radius - 24) * frac);
            if (!free(p, r) || outside(p)) continue;
            let near = Infinity;
            for (const q of roster) near = Math.min(near, dist(q, p));
            for (const q of warnings) near = Math.min(near, dist(q, p));
            const fromPlayer = dist(p, player),
                safe = inside(p, r + 12);
            const score =
                Math.min(500, near) +
                (initial ? Math.min(fromPlayer, 300) * 0.16 : Math.min(fromPlayer, 250) * 0.1) +
                (safe ? 3 : 0);
            if (score > bestScore) {
                best = p;
                bestScore = score;
            }
        }
        return best;
    }
    function spawnBody(slot, p, initial = false) {
        const base = TYPES[slot.type],
            usta = !!run.usta,
            soft = easy() && !usta;
        const profile = usta
                ? { ...base, fire: Math.round(base.fire * 0.82), damage: Math.round(base.damage * 1.1) }
                : base,
            maxHp = Math.round(profile.hp * (usta ? 1.4 : soft ? 0.88 : 1));
        const e = {
            x: p.x,
            y: p.y,
            radius: bot.radius,
            color: profile.color,
            angle: bearing(p, run.center),
            speed: profile.speed * (usta ? 1.07 : soft ? 0.85 : 1),
            maxHp,
            life: maxHp,
            isActive: true,
            isDead: false,
            _m32: true,
            slot,
            type: slot.type,
            profile,
            charge: rand(8, 30),
            guardUntil: run.t + (initial ? 34 : SPAWN_GUARD),
            kbX: 0,
            kbY: 0,
            bombaBulasti: false,
            bombaSayaci: 0,
            ghostRingDebounce: 0,
            target: null,
            intel: null,
            goal: p,
            pathGoal: null,
            path: [],
            meshKey: -1,
            pathAt: 0,
            thinkAt: run.t + rand(0, 8),
            side: Math.random() < 0.5 ? -1 : 1,
            stuck: 0,
            safe: pt(p.x, p.y),
            task: 'dolaşıyor',
            roam: null,
            roamAt: 0,
            fireAt: run.t + rand(48, 111),
            wind: null,
            ultiAt: run.t + rand(250, 393),
            revealUntil: 0,
            lastImpact: 0,
            attacker: null,
            gadgetAt: run.t + rand(285, 580),
            shieldUntil: 0,
            turboUntil: 0,
            healAt: 0,
            killer: null,
            lastShot: Date.now(),
            shootInterval: Math.round((profile.fire * 1000) / FPS)
        };
        // Var olan oyuncu mermileri/alan yetenekleri `hp` azaltmaya devam eder.

        // Botların kendi vuruşlarında saldıran tarafı hurt() açıkça belirtir.
        Object.defineProperty(e, 'hp', {
            enumerable: true,
            get() {
                return this.life;
            },
            set(v) {
                if (!Number.isFinite(v)) return;
                if (active() && v < this.life) hurt(this, this.life - v, player, { silent: true });
                else this.life = v;
            }
        });
        slot.body = e;
        slot.warning = null;
        slot.lives++;
        return e;
    }
    function hurt(target, base, source, opts = {}) {
        if (!alive(target) || source === target || !(base > 0)) return false;
        if (!opts.gas && (target === player ? target.isDashing || target.jumpInvulnerable : guard(target)))
            return false;
        let value = base;
        if (source?._m32) value *= easy() ? 0.78 : 0.92;
        if (!opts.gas && target === player && target.charType === 'sam' && target.samRageActive) value *= 0.6;
        if (!opts.gas && target._m32 && target.shieldUntil > run.t) value *= 0.45;
        if (target === player) {
            player.hp -= value;
            player.lastHitTime = Date.now();
            if (!opts.gas && player.isInvisible) {
                player.isInvisible = false;
                player.invisTimer = 0;
            }
        } else {
            target.life -= value;
            if (!opts.gas && source) {
                target.lastImpact = run.t;
                target.attacker = source;
                if (value >= 170 && source !== target.target) target.thinkAt = Math.min(target.thinkAt, run.t + 6);
            }
            if (target.life <= 0) target.killer = source;
        }
        if (!opts.silent) addFloatingNumber(target.x, target.y, Math.round(value), '#e74c3c');
        if (opts.basic && source?._m32 && alive(source))
            source.charge = Math.min(100, source.charge + Math.min(value, base * 1.2) * 0.052);
        return true;
    }
    function settleDeaths() {
        const s = run;
        for (const slot of s.slots) {
            const e = slot.body;
            if (!e || e.hp > 0) continue;
            e.isDead = true;
            slot.body = null;
            slot.warning = null;
            slot.due = s.usta ? Infinity : s.t + RETURN_WAIT + slot.index * 5;
            spawnParticles(e.x, e.y, e.color);
            if (e.killer === player) {
                s.kills++;
                botsKilled = s.kills;
                if (typeof H.onEnemyKilled === 'function') H.onEnemyKilled(e);
            } else if (e.killer?._m32 && alive(e.killer)) {
                const other = e.killer;
                other.charge = Math.min(100, other.charge + 16);
            }
        }
        if (s.usta && s.phase === 'play' && s.slots.every(x => !x.body)) endRun(true);
    }
    function respawnTick() {
        for (const slot of run.slots)
            if (!slot.body && run.t >= slot.due - RETURN_WARNING) {
                const warn = slot.warning;
                if (!warn || !free(warn, bot.radius) || dist(warn, run.center) > run.radius - 9) {
                    slot.warning = findSpawn(false, bot.radius);
                    if (slot.warning) slot.due = Math.max(slot.due, run.t + RETURN_WARNING);
                    continue;
                }
                if (run.t < slot.due) continue;
                if (fighters().some(e => dist(e, warn) < e.radius + bot.radius + 7)) {
                    slot.warning = null;
                    slot.due = run.t + RETURN_WARNING;
                    continue;
                }
                spawnBody(slot, warn);
            }
    }
    function gasTick() {
        const s = run;
        if (s.usta) return;
        const progress = clamp((s.t - GAS_WAIT) / (127 * FPS), 0, 1);
        s.radius = s.startRadius - (s.startRadius - GAS_MIN) * progress;
        if (s.t < s.gasAt) return;
        s.gasAt = s.t + GAS_STEP;
        const damage = (easy() ? 133 : 170) + Math.min(120, Math.floor(progress * 120));
        for (const actor of fighters()) if (outside(actor)) hurt(actor, damage, null, { gas: true });
    }
    // FFA algısı: oyuncuya öncelik veya takım yok. Önce görülen rakipleri değerlendir.
    function grassAt(p) {
        return run.grass.find(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) || null;
    }
    function visible(e, target) {
        if (!alive(target) || e === target || guard(target)) return false;
        const d = dist(e, target);
        if (d > e.profile.vision || (d > 113 && Math.abs(radDiff(e.angle, bearing(e, target))) > 1.89)) return false;
        if (target === player && target.isInvisible && d > 65) return false;
        const inGrass = grassAt(target);
        const revealed = target === player ? Date.now() - player.lastShotTime < 620 : target.revealUntil > run.t;
        if (inGrass && !revealed && d > 95 && grassAt(e) !== inGrass) return false;
        return clear(e, target, 1);
    }
    function observed(e, target) {
        const old = e.intel,
            steps = old ? run.t - old.t : 0;
        const same = old?.who === target && steps > 0 && steps < 43;
        const ax = same ? clamp((target.x - old.x) / steps, -4.8, 4.8) : 0;
        const ay = same ? clamp((target.y - old.y) / steps, -4.8, 4.8) : 0;
        e.intel = {
            x: target.x,
            y: target.y,
            vx: same ? old.vx * 0.38 + ax * 0.62 : 0,
            vy: same ? old.vy * 0.38 + ay * 0.62 : 0,
            t: run.t,
            who: target
        };
    }
    function pickTarget(e, roster) {
        let target = null,
            best = Infinity;
        for (const other of roster) {
            if (!visible(e, other)) continue;
            const d = dist(e, other),
                weak = 1 - other.hp / other.maxHp;
            let score = d + (d > e.profile.range + 45 ? 24 : 0) - weak * 68;
            if (other === e.target) score -= 32;
            if (other === e.attacker && run.t - e.lastImpact < 120) score -= 49;
            if (!outside(e) && dist(other, run.center) > run.radius + 90) score += 45;
            if (score < best) {
                best = score;
                target = other;
            }
        }
        e.target = target;
        if (target) observed(e, target);
        return target;
    }
    function immediateDanger(e) {
        let best = null,
            closest = Infinity;
        for (const mine of run.mines)
            if (mine.owner !== e && run.t >= mine.arm && dist(e, mine) < mine.radius + 10) {
                const d = dist(e, mine);
                if (d < closest) {
                    closest = d;
                    best = mine;
                }
            }
        for (const b of botBullets)
            if (b._m32 && b.owner !== e && b.lob && b.duration - b.age < 28) {
                const d = dist(e, b.lob);
                if (d < b.blast + 16 && d < closest) {
                    closest = d;
                    best = b.lob;
                }
            }
        return best;
    }
    function inward(e) {
        const s = run,
            angle = bearing(s.center, e),
            r = Math.min(s.radius * 0.71, s.radius - 52);
        for (const d of [0, 0.36, -0.36, 0.72, -0.72, 1.13, -1.13]) {
            const p = off(s.center, angle + d, r);
            if (free(p, e.radius)) return p;
        }
        return s.center;
    }
    function fightSpot(e, t) {
        const distance = dist(t, e),
            angle = bearing(t, e),
            ideal = e.profile.ideal;
        // Uzun menzil mesafeyi korur, yakın tipler yan açıdan arayı kapatır.
        const strafe = distance > ideal + 125 ? 0.27 : 0.52;
        const r = distance > ideal + 130 ? Math.max(ideal, distance - 165) : ideal;
        const low = e.hp < e.maxHp * 0.34;
        let best = null,
            score = -Infinity;
        for (const step of [strafe, 1.1, -strafe, -1.06, 0.12]) {
            const p = bound(off(t, angle + step * e.side, r), e.radius + 2);
            if (!free(p, e.radius)) continue;
            const cover = clear(p, t, 5),
                walk = clear(e, p, e.radius + 2);
            const hasCover = run.solids.some(o => dist(o, p) - o.radius - e.radius < 43);
            let q = -(dist(e, p) * 0.16) - Math.abs(dist(p, t) - ideal) * 0.17 + (walk ? 26 : 0) + (step > 0 ? 14 : 0);
            q += cover ? (low ? 17 : 52) : low ? 21 : 0;
            if (hasCover) q += 12;
            if (outside(p)) q -= 100;
            if (q > score) {
                score = q;
                best = p;
            }
        }
        return best || (distance > ideal ? off(t, angle, ideal) : off(e, angle, 65));
    }
    function roamPoint(e) {
        const s = run;
        let p = null;
        for (let i = 0; i < 12; i++) {
            const candidate = off(s.center, rand(0, TAU), rand(0.2, 0.78) * s.radius);
            if (free(candidate, e.radius) && dist(candidate, e) > 78) {
                p = candidate;
                break;
            }
        }
        return p || s.center;
    }
    function think(e, roster) {
        const s = run,
            t = pickTarget(e, roster);
        e.thinkAt = s.t + rand(13, 20);
        if (dist(e, s.center) > s.radius - 11) {
            e.task = 'gazdan kaçıyor';
            e.goal = inward(e);
            return;
        }
        const hazard = immediateDanger(e);
        if (hazard) {
            const a = dist(e, hazard) > 1 ? bearing(hazard, e) : e.angle + 1.3;
            for (const turn of [0, 0.55, -0.55, 1.1, -1.1]) {
                const q = bound(off(e, a + turn, 115), e.radius + 1);
                if (free(q, e.radius) && !outside(q)) {
                    e.task = 'patlamadan kaçıyor';
                    e.goal = q;
                    e.pathAt = 0;
                    return;
                }
            }
        }
        if (t) {
            e.task = 'yan açı';
            e.goal = fightSpot(e, t);
            return;
        }
        if (e.intel && s.t - e.intel.t < 150 && alive(e.intel.who) && !outside(e.intel)) {
            const m = e.intel,
                d0 = dist(e, m);
            e.task = 'iz arıyor';
            e.goal = d0 > 92 ? m : bound(off(m, bearing(m, e) + 0.83 * e.side, 97), e.radius + 2);
            return;
        }
        if (!e.roam || s.t >= e.roamAt || dist(e, e.roam) < 26 || outside(e.roam)) {
            e.roam = roamPoint(e);
            e.roamAt = s.t + rand(105, 216);
            e.side *= -1;
        }
        e.task = 'dolaşıyor';
        e.goal = e.roam;
    }
    // Dört sınıf, dört farklı atış davranışı. Aksesuarlar koşula, ultiler gerçek isabet şarjına bağlı.
    function announce(e, name, ulti = false) {
        addFloatingNumber(e.x, e.y - e.radius - 13, name, ulti ? GOLD : '#b6f2ed');
    }
    function gadget(e, t) {
        const s = run;
        if (s.t < e.gadgetAt || guard(e)) return;
        const distance = t ? dist(e, t) : Infinity,
            ratio = e.hp / e.maxHp;
        let used = false;
        if (e.type === 'keskin' && t && ratio < 0.67 && distance < 350) {
            e.shieldUntil = s.t + 112;
            used = true;
        }
        if (e.type === 'baskinci' && t && distance >= 120 && distance < 300 && !e.wind) {
            e.turboUntil = s.t + 105;
            e.fireAt = Math.min(e.fireAt, s.t + 22);
            used = true;
        }
        if (e.type === 'muhafiz' && ratio < 0.55 && (t || s.t - e.lastImpact < 114)) {
            e.healAt = s.t + 31;
            used = true;
        }
        if (e.type === 'bombaci' && t && distance < 160 && s.mines.length < 12) {
            const p = off(e, bearing(e, t), 29);
            const q = free(p, 7) ? p : e;
            s.mines.push({ x: q.x, y: q.y, radius: 62, owner: e, arm: s.t + 44, expire: s.t + 6 * FPS });
            used = true;
        }
        if (used) {
            e.gadgetAt = s.t + rand(650, 920);
            announce(e, e.profile.gadget);
        }
    }
    function rangedLine(e, p) {
        return clear(e, p, 4);
    }
    function suitable(e, t, ultimate) {
        const d = dist(e, t);
        if (e.type === 'muhafiz') return d <= (ultimate ? 139 : e.profile.range + t.radius * 0.55) && clear(e, t, 2);
        if (e.type === 'baskinci' && ultimate && d > 184) return false;
        return d <= e.profile.range && (e.type === 'bombaci' || rangedLine(e, t));
    }
    function pushAway(target, center, strength) {
        const a = bearing(center, target),
            v = target === player ? run.drag : target.slide || (target.slide = pt(0, 0));
        v.x += Math.cos(a) * strength;
        v.y += Math.sin(a) * strength;
    }
    function applyPush(p, v, dt) {
        if (!v || Math.hypot(v.x, v.y) < 0.18) return false;
        const q = bound(pt(p.x + v.x * dt, p.y + v.y * dt), p.radius);
        if (free(q, p.radius)) {
            p.x = q.x;
            p.y = q.y;
        } else {
            v.x *= 0.32;
            v.y *= 0.32;
        }
        const damp = Math.pow(0.78, dt);
        v.x *= damp;
        v.y *= damp;
        return true;
    }
    function ringAt(p, r, c) {
        run.rings.push({ x: p.x, y: p.y, r, c, until: run.t + 22 });
    }
    function area(p, r, amount, owner, { basic = false, blocked = false, push = 0 } = {}) {
        for (const t of fighters())
            if (t !== owner && dist(t, p) < r + t.radius * 0.65 && (!blocked || clear(p, t, 2))) {
                if (hurt(t, amount, owner, { basic }) && push) pushAway(t, p, push);
            }
        for (const o of run.solids)
            if (o.hp > 0 && dist(o, p) < r + o.radius * 0.65) {
                o.hp -= amount * 0.25;
            }
        ringAt(p, r, owner?.color || GOLD);
    }
    function pew(owner, a, damage, range, basic, speed = 9) {
        const p = off(owner, a, owner.radius * 0.66);
        botBullets.push({
            _m32: true,
            type: 'm32Shot',
            x: p.x,
            y: p.y,
            sx: owner.x,
            sy: owner.y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            owner,
            damage,
            dmgMod: 1,
            remain: range,
            basic,
            rad: 6
        });
    }
    function fan(e, target, amount, range, basic, wide = 0.185) {
        const a = bearing(e, target) + rand(-1, 1) * (easy() && !run.usta ? 0.086 : run.usta ? 0.03 : 0.044);
        for (const offset of [-wide, 0, wide]) pew(e, a + offset, amount, range, basic, 9.8);
    }
    function toss(e, target, damage, r, duration, basic) {
        const p = bound(target, 15),
            a = bearing(e, p);
        botBullets.push({
            _m32: true,
            type: 'm32Lob',
            x: e.x,
            y: e.y,
            sx: e.x,
            sy: e.y,
            vx: Math.cos(a),
            vy: Math.sin(a),
            owner: e,
            damage,
            basic,
            dmgMod: 1,
            lob: p,
            blast: r,
            duration,
            age: 0
        });
    }
    function slash(e, target, damage, basic) {
        const a = bearing(e, target),
            r = e.profile.range;
        for (const t of fighters())
            if (
                t !== e &&
                dist(e, t) <= r + t.radius * 0.7 &&
                Math.abs(radDiff(a, bearing(e, t))) <= 0.67 &&
                clear(e, t, 1)
            ) {
                hurt(t, damage, e, { basic });
            }
        for (const o of run.solids)
            if (
                o.hp > 0 &&
                dist(e, o) <= r + o.radius &&
                Math.abs(radDiff(a, bearing(e, o))) <= 0.67 &&
                clear(e, o, 1, o)
            ) {
                o.hp -= damage * 0.24;
            }
        ringAt(off(e, a, r * 0.57), r * 0.46, e.color);
    }
    function fireBot(e, intent) {
        if (!alive(e) || guard(e)) return;
        const s = run,
            t = intent.point,
            a = bearing(e, t),
            ulti = intent.kind === 'ulti';
        const k = e.type,
            p = e.profile;
        if (!ulti && k !== 'bombaci' && k !== 'muhafiz' && !rangedLine(e, t)) return;
        e.revealUntil = s.t + 50;
        e.lastShot = Date.now();
        if (k === 'keskin') {
            if (ulti) for (const i of [-1, 0, 1]) pew(e, a + i * 0.135, 522, p.range + 18, false, 11.9);
            else pew(e, a + rand(-1, 1) * (easy() ? 0.092 : 0.055), p.damage, p.range, true, 11.0);
        } else if (k === 'baskinci') {
            if (ulti) {
                fan(e, t, 290, p.range + 28, false, 0.19);
                s.queued.push({ at: s.t + 22, owner: e, point: t });
            } else fan(e, t, p.damage, p.range, true);
        } else if (k === 'muhafiz') {
            if (ulti) area(e, 139, 1060, e, { blocked: true, push: 12 });
            else slash(e, t, p.damage, true);
        } else if (ulti) {
            for (const i of [-1, 0, 1]) toss(e, off(t, a + Math.PI / 2, i * 71), 660, 63, 32 + (i + 1) * 9, false);
        } else toss(e, t, p.damage, 62, clamp(26 + dist(e, t) * 0.038, 27, 45), true);
    }
    function combat(e, dt) {
        const s = run,
            p = e.profile,
            t = e.target;
        if (e.healAt && s.t >= e.healAt) {
            const amount = Math.min(e.maxHp - e.hp, 690);
            e.hp += amount;
            e.healAt = 0;
            if (amount > 0) addFloatingNumber(e.x, e.y, '+' + Math.round(amount), '#e74c3c');
        }
        if (guard(e)) return;
        const seen = visible(e, t);
        if (seen) gadget(e, t);
        else if (e.type === 'muhafiz') gadget(e, null);
        if (e.wind) {
            turn(e, bearing(e, e.wind.point), dt);
            if ((e.wind.left -= dt) > 0) return;
            const intent = e.wind;
            e.wind = null;
            e.fireAt = s.t + p.fire * (easy() ? 1.15 : 1) + rand(0, 15);
            fireBot(e, intent);
            return;
        }
        if (e.fireAt > s.t || dist(e, run.center) > run.radius + 48) return;
        if (seen) {
            const ulti = e.charge >= 100 && s.t >= e.ultiAt && suitable(e, t, true);
            if (!ulti && !suitable(e, t, false)) return;
            const memory = e.intel?.who === t ? e.intel : null;
            const lead = e.type === 'muhafiz' ? 4 : e.type === 'bombaci' ? 31 : clamp((dist(e, t) / 11) * 0.53, 4, 18);
            const a = pt(t.x + (memory?.vx || 0) * lead, t.y + (memory?.vy || 0) * lead);
            const aim = bound(e.type === 'bombaci' || e.type === 'muhafiz' || rangedLine(e, a) ? a : t, 9);
            e.wind = {
                left: ulti ? 29 : p.wind,
                total: ulti ? 29 : p.wind,
                kind: ulti ? 'ulti' : 'normal',
                point: aim
            };
            if (ulti) {
                e.charge = 0;
                e.ultiAt = s.t + ULT_GAP;
                announce(e, p.ulti, true);
            }
        } else if (
            e.type === 'bombaci' &&
            e.intel &&
            s.t - e.intel.t < 39 &&
            alive(e.intel.who) &&
            dist(e, e.intel) < p.range
        ) {
            e.wind = { left: p.wind, total: p.wind, kind: 'normal', point: pt(e.intel.x, e.intel.y) };
        }
    }
    function ticksOfBots(dt) {
        const roster = fighters();
        for (const e of roster)
            if (e !== player && alive(e)) {
                if (run.t >= e.thinkAt) think(e, roster);
                if (!applyPush(e, e.slide, dt)) locomotion(e, dt, roster);
                if (!e.wind) {
                    const v = visible(e, e.target) ? e.target : e.path[0];
                    if (v && dist(e, v) > 2) turn(e, bearing(e, v), dt);
                    else turn(e, e.angle + e.side * 0.065, dt);
                }
                combat(e, dt);
            }
    }
    function eventTick() {
        const s = run;
        for (let i = s.queued.length - 1; i >= 0; i--) {
            const q = s.queued[i];
            if (q.at > s.t) continue;
            s.queued.splice(i, 1);
            if (alive(q.owner) && rangedLine(q.owner, q.point))
                fan(q.owner, q.point, 290, q.owner.profile.range + 28, false, 0.18);
        }
        for (let i = s.mines.length - 1; i >= 0; i--) {
            const m = s.mines[i];
            if (m.expire <= s.t) {
                s.mines.splice(i, 1);
                continue;
            }
            if (m.arm > s.t) continue;
            if (fighters().some(t => t !== m.owner && !guard(t) && dist(t, m) < 31 + t.radius && clear(m, t, 2))) {
                area(m, m.radius, 600, m.owner, { blocked: true, push: 5 });
                s.mines.splice(i, 1);
            }
        }
        s.rings = s.rings.filter(r => r.until > s.t);
    }
    // Atışlar mevcut aksesuarların erişebilmesi için çekirdeğin listesinde görünür,

    // ama çarpışmaları burada çözülür: ilk temas geçerli, atış sahibine vurmaz.
    function projectileStep(b, dt) {
        // Ninja’nın zaman alanı, Hesaplaşma atışlarını da yavaşlatır.
        const inZone =
            player.charType === 'ninja' &&
            player.ninjaZoneActive &&
            Math.hypot(b.x - player.ninjaZoneX, b.y - player.ninjaZoneY) < player.ninjaZoneRadius;
        return inZone ? dt * 0.35 : dt;
    }
    function projectiles(dt) {
        // Sadece moda ait olanları tüket; mod dışındaki atışları değiştirme.
        const s = run,
            roster = fighters();
        for (let i = botBullets.length - 1; i >= 0; i--) {
            const b = botBullets[i];
            if (!b._m32) continue;
            const step = projectileStep(b, dt);
            if (b.lob) {
                b.age += step;
                const f = clamp(b.age / b.duration, 0, 1);
                b.x = b.sx + (b.lob.x - b.sx) * f;
                b.y = b.sy + (b.lob.y - b.sy) * f;
                if (f < 1) continue;
                area(b.lob, b.blast, b.damage, b.owner, { basic: b.basic });
                botBullets.splice(i, 1);
                continue;
            }
            const a = pt(b.x, b.y),
                q = pt(b.x + b.vx * step, b.y + b.vy * step);
            let hit = null,
                at = 1.00001;
            for (const o of s.solids)
                if (o.hp > 0) {
                    const d = impact(a, q, o, o.radius + b.rad);
                    if (d < at) {
                        hit = o;
                        at = d;
                    }
                }
            for (const target of roster)
                if (
                    target !== b.owner &&
                    alive(target) &&
                    (target === player ? !target.isDashing && !target.jumpInvulnerable : !guard(target))
                ) {
                    const d = impact(a, q, target, target.radius + b.rad);
                    if (d < at) {
                        hit = target;
                        at = d;
                    }
                }
            if (hit) {
                b.x = a.x + (q.x - a.x) * at;
                b.y = a.y + (q.y - a.y) * at;
                if (hit === player || hit._m32) hurt(hit, b.damage, b.owner, { basic: b.basic });
                else hit.hp -= b.damage * 0.29;
                botBullets.splice(i, 1);
                continue;
            }
            b.x = q.x;
            b.y = q.y;
            b.remain -= dist(a, q);
            if (b.remain <= 0 || !inside(b, -5)) botBullets.splice(i, 1);
        }
    }
    function renderOwnedBullet(b) {
        ctx.save();
        if (b.lob) {
            const f = clamp(b.age / b.duration, 0, 1),
                z = Math.sin(Math.PI * f) * 57;
            ctx.fillStyle = '#24192249';
            ctx.beginPath();
            ctx.ellipse(b.x, b.y + 5, 7 + z * 0.026, 4, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = b.owner.color;
            ctx.strokeStyle = '#291c26';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(b.x, b.y - z, 8, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#fff0a6';
            ctx.beginPath();
            ctx.arc(b.x - 2, b.y - z - 3, 2.5, 0, TAU);
            ctx.fill();
        } else {
            const len = Math.hypot(b.vx, b.vy) || 1;
            ctx.translate(b.x, b.y);
            ctx.rotate(Math.atan2(b.vy, b.vx));
            ctx.globalAlpha = 0.58;
            ctx.fillStyle = b.owner.color;
            ctx.fillRect(-len * 1.5, -2, len * 1.4, 4);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff2cf';
            ctx.strokeStyle = b.owner.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 0, 8, 4.7, 0, 0, TAU);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }
    // Kamera canvası takip ettirir; arayüz ve joystick'ler ekran konumunda kalır.
    function clearControls() {
        if (typeof clearArenaInputs === 'function') {
            clearArenaInputs();
            return;
        }
        for (const input of [moveData, aimData, ultAim, gadAim, gadAim2]) {
            input.active = input.isMouse = false;
            input.pull = 0;
            if ('keyboard' in input) input.keyboard = false;
            if ('touchId' in input) input.touchId = null;
            if ('x' in input) input.x = input.y = 0;
        }
        for (const id of ['left-knob', 'right-knob']) {
            const k = $(id);
            if (k) k.style.transform = '';
        }
        for (const key of Object.keys(keysPressed)) delete keysPressed[key];
    }
    function follow(dt, snap = false) {
        const s = run,
            v = s.view;
        v.w = innerWidth;
        v.h = innerHeight;
        let dx = 0,
            dy = 0;
        if (!snap && s.lead) {
            if (aimData.active && Math.hypot(aimData.x, aimData.y) > 0.16) {
                dx = Math.cos(aimData.angle) * 65;
                dy = Math.sin(aimData.angle) * 65;
            } else if (s.mouse) {
                dx = clamp((s.mouse.x + v.x - player.x) * 0.18, -49, 49);
                dy = clamp((s.mouse.y + v.y - player.y) * 0.18, -49, 49);
            }
        }
        const targetX = clamp(player.x + dx - v.w * 0.5, 0, Math.max(0, s.w - v.w));
        const targetY = clamp(player.y + dy - v.h * 0.46, 0, Math.max(0, s.h - v.h));
        const k = snap || !s.lead ? 1 : 1 - Math.exp(-dt / 7);
        v.x += (targetX - v.x) * k;
        v.y += (targetY - v.y) * k;
        canvas.style.setProperty('--m32-x', (v.w > s.w ? (v.w - s.w) / 2 : -v.x) + 'px');
        canvas.style.setProperty('--m32-y', (v.h > s.h ? (v.h - s.h) / 2 : -v.y) + 'px');
        correctMouse();
    }
    function worldFromScreen(x, y) {
        const v = run.view;
        return pt(x + v.x - Math.max(0, (v.w - run.w) / 2), y + v.y - Math.max(0, (v.h - run.h) / 2));
    }
    function correctMouse() {
        if (!run.mouse) {
            const q = off(player, player.angle, RANGE * 0.65);
            lastMouseX = q.x;
            lastMouseY = q.y;
            return;
        }
        const q = worldFromScreen(run.mouse.x, run.mouse.y),
            a = bearing(player, q),
            d = dist(player, q);
        lastMouseX = q.x;
        lastMouseY = q.y;
        for (const [data, scale] of [
            [ultAim, 1.1],
            [gadAim, 0.8],
            [gadAim2, 0.65]
        ])
            if (data.active && data.isMouse) {
                data.angle = a;
                data.pull = Math.min(1, d / (RANGE * scale));
            }
        if (!aimData.active && !player.isJumping && !player.isDashing) player.angle = a;
    }
    canvas.addEventListener('mousemove', e => {
        if (active() && run.phase === 'play') {
            run.mouse = pt(e.clientX, e.clientY);
            correctMouse();
        }
    });
    canvas.addEventListener(
        'click',
        e => {
            if (!active()) return;
            e.stopImmediatePropagation();
            if (run.phase !== 'play' || player.isDead || !gameStarted) return;
            const primed = player.charType === 'spike' && player.ultiHazirlik;
            if ((!primed && player.ammo < 1) || Date.now() - player.lastShotTime <= 200) return;
            const q = worldFromScreen(e.clientX, e.clientY);
            const pull = Math.min(1, dist(player, q) / (RANGE * (primed ? 0.9 : 1)));
            player.fire(bearing(player, q), pull, {
                input: 'canvas',
                ...q,
                touch: e.pointerType === 'touch' || !!e.sourceCapabilities?.firesTouchEvents
            });
        },
        true
    );
    window.addEventListener('resize', () => {
        if (active() && run.phase !== 'start') {
            sizeWorld();
            follow(0, true);
        }
    });
    window.addEventListener(
        'keydown',
        e => {
            if (active() && e.code === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                back();
            }
        },
        true
    );
    window.addEventListener('blur', () => {
        if (active()) clearControls();
    });
    window.addEventListener(
        'touchcancel',
        e => {
            if (!active() || typeof clearArenaInputs === 'function') return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                for (const [input, id] of [
                    [moveData, 'left-knob'],
                    [aimData, 'right-knob']
                ])
                    if (input.touchId === t.identifier) {
                        input.touchId = null;
                        input.active = input.isMouse = false;
                        input.x = input.y = 0;
                        const k = $(id);
                        if (k) k.style.transform = '';
                    }
                const control = t.target?.closest?.('#ulti-btn,#gadget-btn,#gadget-btn-2');
                const input =
                    control?.id === 'ulti-btn'
                        ? ultAim
                        : control?.id === 'gadget-btn'
                          ? gadAim
                          : control
                            ? gadAim2
                            : null;
                if (input && !input.isMouse) input.active = false;
            }
        },
        { passive: true }
    );
    // Sadece bu modun görünümü: taş zemin, gaz sınırı ve okunabilir saldırı uyarıları.
    const map = document.createElement('canvas');
    map.id = 'm32-map';
    map.width = 168;
    map.height = 130;
    map.hidden = true;
    map.setAttribute('aria-hidden', 'true');
    document.body.appendChild(map);
    const mapCtx = map.getContext('2d');
    function circle(g, p, r) {
        g.beginPath();
        g.arc(p.x, p.y, r, 0, TAU);
    }
    function round(g, x, y, w, h, r) {
        g.beginPath();
        (typeof g.roundRect === 'function' ? g.roundRect : oldRoundRect).call(g, x, y, w, h, r);
    }
    function terrain() {
        const s = run,
            layer = document.createElement('canvas');
        layer.width = s.w;
        layer.height = s.h;
        const g = layer.getContext('2d'),
            m = WALL_THICKNESS;
        const base = g.createRadialGradient(s.center.x, s.center.y, 50, s.center.x, s.center.y, s.startRadius * 1.5);
        base.addColorStop(0, '#253b39');
        base.addColorStop(0.72, '#243234');
        base.addColorStop(1, '#1b282b');
        g.fillStyle = base;
        g.fillRect(0, 0, s.w, s.h);
        let seed = 87361;
        const dice = () => {
            seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        const cell = 52;
        for (let y = m; y < s.h - m; y += cell)
            for (let x = m; x < s.w - m; x += cell) {
                g.fillStyle = `rgba(171,216,200,${0.011 + dice() * 0.031})`;
                g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
                if (dice() < 0.37) {
                    g.fillStyle = '#a4c7b025';
                    g.fillRect(x + 9 + dice() * 27, y + 8 + dice() * 32, 2.5 + dice() * 4, 2);
                }
            }
        g.strokeStyle = '#81a7a46e';
        g.lineWidth = 2;
        g.strokeRect(m + 1, m + 1, s.w - 2 * m - 2, s.h - 2 * m - 2);
        g.save();
        g.strokeStyle = '#aad6b130';
        g.lineWidth = 1;
        g.setLineDash([7, 15]);
        circle(g, s.center, 72);
        g.stroke();
        g.restore();
        for (const l of s.lakes) {
            const water = g.createRadialGradient(l.x, l.y, l.r * 0.15, l.x, l.y, l.r);
            water.addColorStop(0, '#2d7a96');
            water.addColorStop(1, '#1d5470');
            g.fillStyle = water;
            circle(g, l, l.r);
            g.fill();
            g.strokeStyle = '#8fd3e8aa';
            g.lineWidth = 3;
            g.stroke();
            g.strokeStyle = '#b8ecf94d';
            g.lineWidth = 1.5;
            for (const k of [0.38, 0.66]) {
                g.beginPath();
                g.arc(l.x, l.y, l.r * k, 0.35, 2.1);
                g.stroke();
                g.beginPath();
                g.arc(l.x, l.y, l.r * k, 3.5, 5.3);
                g.stroke();
            }
        }
        for (const patch of s.grass) {
            round(g, patch.x, patch.y, patch.w, patch.h, 16);
            g.fillStyle = '#25473e';
            g.fill();
            g.strokeStyle = '#42715a';
            g.lineWidth = 1.2;
            g.stroke();
            for (let i = 0; i < 83; i++) {
                const x = patch.x + 8 + dice() * (patch.w - 16),
                    y = patch.y + 12 + dice() * (patch.h - 18),
                    n = 3 + dice() * 9;
                g.strokeStyle = i % 4 === 0 ? '#77a87875' : i % 2 === 0 ? '#386750' : '#477c5b';
                g.lineWidth = 1.4;
                g.beginPath();
                g.moveTo(x - 4, y - n * 0.65);
                g.lineTo(x, y);
                g.lineTo(x + 1, y - n);
                g.moveTo(x, y);
                g.lineTo(x + 5, y - n * 0.57);
                g.stroke();
            }
        }
        return layer;
    }
    function rock(g, o) {
        const r = o.radius,
            x = o.x - r,
            y = o.y - r,
            w = 2 * r,
            h = w;
        round(g, x, y, w, h, 10);
        g.fillStyle = '#4d636d';
        g.fill();
        round(g, x + 3, y + 2, w - 6, h - 9, 9);
        g.fillStyle = '#728894';
        g.fill();
        g.strokeStyle = '#a5bac0';
        g.lineWidth = 1.15;
        g.stroke();
        g.strokeStyle = '#405962';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x + 7, y + h * 0.63);
        g.lineTo(x + w * 0.42, y + h * 0.55);
        g.lineTo(x + w * 0.65, y + h * 0.75);
        g.lineTo(x + w - 8, y + h * 0.73);
        g.stroke();
        g.fillStyle = '#18252b';
        g.fillRect(o.x - 16, y - 16, 32, 6);
        g.fillStyle = '#8facae';
        g.fillRect(o.x - 15, y - 15, 30 * clamp(o.hp / o.maxHp, 0, 1), 4);
    }
    function gasDraw(g) {
        const s = run;
        if (s.usta) return;
        g.save();
        g.fillStyle = s.t < GAS_WAIT ? '#78ab4d26' : '#79c34c44';
        g.beginPath();
        g.rect(0, 0, s.w, s.h);
        g.arc(s.center.x, s.center.y, s.radius, 0, TAU, true);
        g.fill('evenodd');
        g.strokeStyle = '#6fb96364';
        g.lineWidth = 12;
        circle(g, s.center, s.radius);
        g.stroke();
        g.strokeStyle = '#b4f079';
        g.lineWidth = 2;
        g.setLineDash([11, 7]);
        circle(g, s.center, s.radius);
        g.stroke();
        g.restore();
    }
    function caption(g, p, title, color, dy = 0) {
        g.font = '750 10px system-ui,sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 3;
        g.strokeStyle = '#142127';
        g.strokeText(title, p.x, p.y + dy);
        g.fillStyle = color;
        g.fillText(title, p.x, p.y + dy);
    }
    function warnings(g, e) {
        const wind = e.wind;
        if (wind) {
            const ult = wind.kind === 'ulti',
                color = ult ? '#ffd177' : e.color;
            g.globalAlpha = 0.62;
            g.lineWidth = ult ? 2.4 : 1.5;
            g.strokeStyle = color;
            g.setLineDash([6, 5]);
            const a = bearing(e, wind.point),
                p = off(e, a, e.radius + 4);
            if (e.type === 'bombaci') {
                for (const i of ult ? [-1, 0, 1] : [0]) {
                    const p = bound(off(wind.point, a + Math.PI / 2, i * 71), 15);
                    circle(g, p, ult ? 63 : 62);
                    g.stroke();
                }
            } else if (e.type === 'muhafiz') {
                if (ult) circle(g, e, 139);
                else {
                    g.beginPath();
                    g.moveTo(e.x, e.y);
                    g.arc(e.x, e.y, e.profile.range, a - 0.67, a + 0.67);
                    g.closePath();
                }
                g.stroke();
            } else {
                const fan = e.type === 'baskinci' ? [-0.185, 0, 0.185] : ult ? [-0.135, 0, 0.135] : [0];
                g.beginPath();
                for (const d of fan) {
                    const q = off(e, a + d, Math.min(e.profile.range, dist(e, wind.point) + 26));
                    g.moveTo(p.x, p.y);
                    g.lineTo(q.x, q.y);
                }
                g.stroke();
            }
            g.setLineDash([]);
            g.globalAlpha = 1;
            circle(g, e, e.radius + 4);
            g.strokeStyle = '#24343a';
            g.stroke();
            g.strokeStyle = color;
            g.beginPath();
            g.arc(e.x, e.y, e.radius + 4, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - wind.left / wind.total));
            g.stroke();
        }
        if (guard(e) || e.shieldUntil > run.t || e.turboUntil > run.t || e.healAt) {
            g.strokeStyle = guard(e)
                ? '#d6f3fc'
                : e.shieldUntil > run.t
                  ? '#8fe4ff'
                  : e.turboUntil > run.t
                    ? GOLD
                    : LIME;
            g.lineWidth = 2;
            circle(g, e, e.radius + 6);
            g.stroke();
        }
    }
    function drawMode(g) {
        const s = run;
        if (s.phase === 'start') return;
        const isVisible = (p, r = 0) =>
            p.x + r >= s.view.x &&
            p.y + r >= s.view.y &&
            p.x - r <= s.view.x + s.view.w &&
            p.y - r <= s.view.y + s.view.h;
        g.save();
        g.globalCompositeOperation = 'destination-over';
        g.drawImage(s.ground, 0, 0);
        g.globalCompositeOperation = 'source-over';
        for (const o of obstacles) if (o.hp > 0 && isVisible(o, o.radius + 16)) rock(g, o);
        gasDraw(g);
        if (s.phase === 'play') {
            if (!player.isJumping && !player.isInvisible) {
                g.strokeStyle = '#fff5c5ad';
                g.lineWidth = 1.5;
                circle(g, player, player.radius + 2);
                g.stroke();
            }
            for (const b of botBullets)
                if (b._m32 && b.lob && isVisible(b.lob, b.blast)) {
                    g.save();
                    g.globalAlpha = 0.4 + 0.39 * (b.age / b.duration);
                    g.strokeStyle = '#ffd177';
                    g.lineWidth = 2;
                    g.setLineDash([5, 6]);
                    circle(g, b.lob, b.blast);
                    g.stroke();
                    g.restore();
                }
            for (const m of s.mines)
                if (isVisible(m, m.radius)) {
                    g.strokeStyle = s.t < m.arm ? '#ffa84f91' : '#ffad61';
                    g.lineWidth = 1.3;
                    g.setLineDash([4, 5]);
                    circle(g, m, m.radius);
                    g.stroke();
                    g.setLineDash([]);
                    g.fillStyle = '#1b2229';
                    g.strokeStyle = m.owner.color;
                    circle(g, m, 8);
                    g.fill();
                    g.stroke();
                    g.fillStyle = '#ffad61';
                    circle(g, m, 2);
                    g.fill();
                }
            for (const r of s.rings)
                if (isVisible(r, r.r)) {
                    const f = 1 - (r.until - s.t) / 22;
                    g.globalAlpha = (1 - f) * 0.72;
                    g.lineWidth = 3;
                    g.strokeStyle = r.c;
                    circle(g, r, r.r * (0.35 + 0.65 * f));
                    g.stroke();
                    g.globalAlpha = 1;
                }
            for (const slot of s.slots)
                if (slot.warning && isVisible(slot.warning, 35)) {
                    const p = slot.warning,
                        c = TYPES[slot.type].color;
                    g.strokeStyle = c;
                    g.lineWidth = 2;
                    g.setLineDash([6, 4]);
                    circle(g, p, 30);
                    g.stroke();
                    g.setLineDash([]);
                    const a = 1 - clamp((slot.due - s.t) / RETURN_WARNING, 0, 1);
                    g.beginPath();
                    g.arc(p.x, p.y, 25, -Math.PI / 2, -Math.PI / 2 + TAU * a);
                    g.stroke();
                    caption(g, p, 'DÖNÜŞ', c, 0);
                }
            for (const e of onField())
                if (isVisible(e, 50)) {
                    warnings(g, e);
                    const ready = e.charge >= 100 || e.wind?.kind === 'ulti';
                    caption(g, e, `${e.profile.name}${ready ? ' ◆' : ''}`, ready ? GOLD : '#eef6ee', e.radius + 12);
                }
        }
        g.restore();
    }
    function mapTick() {
        if (!mapCtx || run.t < run.miniAt) return;
        const s = run,
            g = mapCtx,
            sx = (map.width - 10) / s.w,
            sy = (map.height - 10) / s.h;
        s.miniAt = s.t + 5;
        g.clearRect(0, 0, map.width, map.height);
        g.save();
        g.translate(5, 5);
        g.fillStyle = '#19292a';
        g.fillRect(0, 0, s.w * sx, s.h * sy);
        g.strokeStyle = '#7aa856';
        g.lineWidth = 2;
        if (s.usta) {
            g.fillStyle = '#3f7f9a';
            for (const l of s.lakes) {
                circle(g, pt(l.x * sx, l.y * sy), l.r * sx);
                g.fill();
            }
        } else {
            g.beginPath();
            g.ellipse(s.center.x * sx, s.center.y * sy, s.radius * sx, s.radius * sy, 0, 0, TAU);
            g.stroke();
        }
        g.strokeStyle = '#9fc2b95d';
        g.lineWidth = 1;
        g.strokeRect(s.view.x * sx, s.view.y * sy, Math.min(s.w, s.view.w) * sx, Math.min(s.h, s.view.h) * sy);
        for (const e of onField())
            if (dist(e, player) < 340 && clear(player, e)) {
                g.fillStyle = e.color;
                circle(g, pt(e.x * sx, e.y * sy), 3.2);
                g.fill();
            }
        g.fillStyle = '#fff5c5';
        circle(g, pt(player.x * sx, player.y * sy), 4.7);
        g.fill();
        g.restore();
    }
    function updateMode(delta) {
        if (!active()) return;
        if (run.phase === 'start') initField();
        sizeWorld();
        suppressCoreSpawns();
        if (run.phase === 'over') return;
        if (!alive(player)) {
            endRun();
            return;
        }
        const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 3);
        run.t += dt;
        rebuildSolids();
        gasTick();
        if (run.usta) {
            const lp = run.lastP;
            if (lp && alive(player) && lakeAt(player)) {
                const dx = player.x - lp.x,
                    dy = player.y - lp.y;
                if (Math.hypot(dx, dy) < 14) {
                    const q = pt(player.x - dx * (1 - LAKE_SLOW), player.y - dy * (1 - LAKE_SLOW));
                    if (free(q, player.radius)) {
                        player.x = q.x;
                        player.y = q.y;
                    }
                }
            }
            run.lastP = pt(player.x, player.y);
        }
        if (!alive(player)) {
            endRun();
            return;
        }
        eventTick();
        if (!alive(player)) {
            endRun();
            return;
        }
        applyPush(player, run.drag, dt);
        if (alive(player)) ticksOfBots(dt);
        settleDeaths();
        respawnTick();
        if (!alive(player)) endRun();
    }
    function finishFrame(dt) {
        if (run.phase !== 'play') return;
        settleDeaths();
        if (!alive(player)) {
            endRun();
            return;
        }
        follow(dt);
        hudTick();
        mapTick();
    }
    EXT.modes[ID] = {
        label: 'Serbest Hesaplaşma',
        onStart: startRun,
        onUpdate: updateMode,
        onDraw: drawMode,
        onReset: resetRun
    };
    H.getExtraEnemies = function () {
        return active() ? onField() : previous.enemies?.apply(this, arguments) || [];
    };
    H.getBotTarget = function (e) {
        // Normal bot döngüsü özel botların gözünü oyuncuya kilitlemesin.
        return active() && e._m32 ? off(e, e.angle, 90) : previous.target?.apply(this, arguments) || null;
    };
    H.onReset = function () {
        const out = previous.reset?.apply(this, arguments);
        // Çekirdek startGame içinde de onReset çağırır; arena ilk karede kurulur.
        if (run && (run.phase !== 'start' || !active())) resetRun();
        return out;
    };
    H.onDraw = function (g) {
        const out = previous.draw?.apply(this, arguments);
        if (active()) drawMode(g);
        return out;
    };
    const drawStockBullet = window.drawBullet;
    window.drawBullet = function (b) {
        return active() && b._m32 ? renderOwnedBullet(b) : drawStockBullet.apply(this, arguments);
    };
    window.updateBulletLogic = function (list, isBot, dt) {
        if (!active() || !isBot || list !== botBullets) return previous.projectiles.apply(this, arguments);
        if (run.phase !== 'play') return;
        rebuildSolids();
        projectiles(dt);
        // Diğer eklentilerin standart mermilerini varsa çekirdeğe bırak.
        if (list.some(b => !b._m32) && alive(player)) {
            const stock = list.filter(b => !b._m32);
            for (let i = list.length - 1; i >= 0; i--) if (!list[i]._m32) list.splice(i, 1);
            previous.projectiles.call(this, stock, true, dt);
            for (const b of stock) list.push(b);
        }
        finishFrame(dt);
    };
})();
