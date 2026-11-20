/*
 * mod31.js — TERS KÖŞE | Meydan Savaşçıları
 * Ana oyun betiğinden sonra, klasik bir script olarak yükle:
 *     <script src="mod31.js"></script>
 * Yalnızca Mod Seç ekranına bir düğme ekler. Karakterleri ve klasik arenayı değiştirmez.
 * Ölçüler oyun pikselleri, süreler çekirdeğin nominal 60 FPS birimleridir.
 */
(function () {
    'use strict';
    const ext = window.GAME_EXT;
    const ID = 'ters_kose';
    if (!ext?.modes || !ext.hooks || typeof player === 'undefined' ||
        typeof bot === 'undefined' || typeof canvas === 'undefined' ||
        typeof window.startGame !== 'function') {
        console.warn('[mod31] Ana oyun betiği mod31.js dosyasından önce yüklenmeli.');
        return;
    }
    if (ext.modes[ID]) return;

    const ROUND_COUNT = 3;
    const ROUND_LIMIT = 65 * 60;
    const REPORT_DELAY = 18;
    const INTEL_TTL = 4.5 * 60;
    const SEAL_R = 18, EXIT_R = 36;
    const TAU = Math.PI * 2;
    const GOLD = '#f1c40f', GREEN = '#45e5a0';
    const hooks = ext.hooks;
    const prev = {
        reset:hooks.onReset, draw:hooks.onDraw, extra:hooks.getExtraEnemies,
        target:hooks.getBotTarget
    };
    const $ = id => document.getElementById(id);
    const len = (a,b) => Math.hypot(b.x-a.x,b.y-a.y);
    const bearing = (a,b) => Math.atan2(b.y-a.y,b.x-a.x);
    const clamp = (n,lo,hi) => hi < lo ? (hi+lo)/2 : Math.min(hi,Math.max(lo,n));
    const along = (p,a,d) => ({x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d});
    const angleDiff = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));
    const eye = (e,a,dt) => { e.angle += clamp(angleDiff(e.angle,a),-.16*dt,.16*dt); };
    const good = e => e && e.hp > 0 && !e.isDead;
    const quiet = () => window.GAME_DIFFICULTY === 'easy';
    const gateName = i => i === 0 ? 'sol çıkış' : 'sağ çıkış';
    const point = (x,y) => ({x,y});
    let game = null, returnMode = 'arena';
    const inMode = () => !!game && window.GAME_MODE === ID;

    // --- Mod menüsü ve mod içi küçük görev göstergesi --------------------
    const style = document.createElement('style');
    style.textContent = `
        #difficulty-screen #m31-start{display:flex;align-items:center;justify-content:center;gap:5px;flex-direction:column;width:min(76vw,300px);min-height:48px;flex:none;margin:9px auto 0;padding:7px 12px;border:1px solid #f1c40f9c;border-radius:10px;background:#302c1e;color:#fff;cursor:pointer;touch-action:manipulation;font-family:inherit;text-align:center}
        #m31-start strong{color:#ffe67a;font-size:14px}#m31-start small{font-size:10px;color:#edeadb}#m31-start:focus-visible{outline:2px solid #ffe67a;outline-offset:3px}
        #gameCanvas.m31-world{position:fixed;inset:0 auto auto 0;width:var(--m31-world-w);height:var(--m31-world-h);max-width:none;max-height:none;transform:translate3d(var(--m31-camera-x,0px),var(--m31-camera-y,0px),0);transform-origin:top left;touch-action:none}
        body.m31-playing #controls-hint,body.m31-playing #game-over-screen,body.m31-playing #arena-back{display:none!important}
        #m31-hud,#m31-result,#m31-leave{font-family:system-ui,sans-serif}
        #m31-hud[hidden],#m31-result[hidden],#m31-leave[hidden]{display:none!important}
        #m31-hud{position:absolute;z-index:12;top:max(8px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(390px,calc(100% - 110px));border:1px solid #ffe58059;border-radius:9px;background:#16212ce8;color:#fff;padding:7px 9px;pointer-events:none}
        #m31-clock-row{display:flex;justify-content:space-between;gap:5px;color:#ffe580;font-weight:800;font-size:11px;letter-spacing:.04em}
        #m31-instruction{margin:3px 0 0;font-size:13px;line-height:1.16;font-weight:750}#m31-tip{display:block;margin-top:3px;color:#c3d3de;font-size:10px;line-height:1.16}
        #m31-leave{position:absolute;z-index:17;left:max(6px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));min-width:43px;min-height:42px;border:1px solid #a8c0d878;border-radius:8px;background:#182630;color:#fff;font-weight:850;font-size:17px;cursor:pointer;touch-action:manipulation}
        #m31-result{position:absolute;z-index:25;inset:0;display:grid;place-items:center;background:#0e1723d9;color:#fff;padding:16px}
        #m31-result>div{width:min(100%,350px);border:1px solid #f1c40f86;border-radius:13px;background:#1c2a38;padding:18px;text-align:center}
        #m31-result h2{margin:0 0 7px;color:#ffe580;font-size:23px}#m31-result p{font-size:14px;margin:0 0 15px;color:#e0e9ef}
        #m31-result button{min-height:42px;padding:6px 12px;margin:3px;border:1px solid #ffe58066;border-radius:8px;background:#26384a;color:#fff;font-weight:750;cursor:pointer;touch-action:manipulation}
        #m31-result #m31-replay{background:#f1c40f;color:#21221b}
    `;
    document.head.appendChild(style);
    const diffScreen = $('difficulty-screen');
    const join = $('difficulty-start-btn');
    if (diffScreen) {
        const option = document.createElement('button');
        option.type = 'button'; option.id = 'm31-start';
        option.innerHTML = '<strong>Ters Köşe’yi Başlat</strong><small>Mührü al. Üç turda iki çıkıştan birini seç.</small>';
        if (join && diffScreen.contains(join)) join.after(option);
        else diffScreen.appendChild(option);
        option.addEventListener('click', enter);
    }
    const hud = document.createElement('aside');
    hud.id = 'm31-hud'; hud.hidden = true;
    hud.innerHTML = '<div id="m31-clock-row"><span id="m31-round"></span><time id="m31-clock"></time></div><p id="m31-instruction"></p><small id="m31-tip"></small>';
    const leave = document.createElement('button');
    leave.type = 'button'; leave.id = 'm31-leave'; leave.hidden = true;
    leave.textContent = '←'; leave.title = 'Savaşçı seçimine dön'; leave.setAttribute('aria-label',leave.title);
    const result = document.createElement('section');
    result.id = 'm31-result'; result.hidden = true;
    result.setAttribute('role','dialog'); result.setAttribute('aria-modal','true'); result.setAttribute('aria-labelledby','m31-result-title');
    result.innerHTML = '<div><h2 id="m31-result-title"></h2><p id="m31-result-text"></p><button type="button" id="m31-replay">Tekrar Oyna</button><button type="button" id="m31-roster">Savaşçılar</button></div>';
    document.body.append(hud,leave,result);
    const ui = {round:$('m31-round'),clock:$('m31-clock'),line:$('m31-instruction'),tip:$('m31-tip')};
    function enter() {
        if (gameStarted && !player.isDead) return;
        if (window.GAME_MODE !== ID) returnMode = window.GAME_MODE || 'arena';
        else if (!game) returnMode = 'arena';
        window.GAME_MODE = ID;
        if (typeof selectedDifficulty !== 'undefined') window.GAME_DIFFICULTY = selectedDifficulty;
        if (diffScreen) diffScreen.style.display = 'none';
        window.startGame();
    }
    function goBack() { $('restart-btn')?.click(); }
    leave.addEventListener('click',goBack);
    $('m31-roster').addEventListener('click',goBack);
    $('m31-replay').addEventListener('click',() => { goBack(); enter(); });
    function text(node,value) { if (node.textContent !== value) node.textContent = value; }
    function updateHud() {
        const s = game;
        if (!s || s.phase === 'done') return;
        const seconds = Math.max(0,Math.ceil(s.remaining/60));
        text(ui.round,`TERS KÖŞE · ${s.round}/${ROUND_COUNT}`);
        text(ui.clock,Math.floor(seconds/60) + ':' + String(seconds%60).padStart(2,'0'));
        text(ui.line,s.phase === 'break' ? 'Mühür teslim edildi.' : s.carrying ? 'Mühür sende. Sol ya da sağ çıkışa ulaş.' : 'Ortadaki mührün yanına git.');
        const learned = s.preferred === null ? '' : gateName(s.preferred);
        const next = s.memory === null ? '' : gateName(s.memory);
        text(ui.tip,s.phase === 'break' ? (next ? `Botlar ${next} rotasını biliyor. Bunu kullan.` : 'Botlar çıkış rotanı göremedi.') :
            learned ? `Botlar önceki turdan ${learned} rotasını biliyor.` : 'Sarı: mühür · Yeşil: açık çıkış');
    }

    // --- Oturum ve sabit dünya; yalnızca bu modda -------------------------
    function startSession() {
        const width = Math.round(clamp(window.innerWidth+235,1160,1820));
        const height = Math.round(clamp(window.innerHeight+200,860,1320));
        game = {
            width,height,round:0,cleared:0,phase:'new',remaining:ROUND_LIMIT,breakTime:0,
            seal:point(width*.50,height*.49), exits:[point(width*.11,height*.22),point(width*.89,height*.22)],
            spawn:point(width*.50,height*.87), carrying:false,memory:null,preferred:null,
            knownAt:[-Infinity,-Infinity], agents:[],radio:[],nav:null,solids:[],time:0,
            view:{x:0,y:0,w:window.innerWidth,h:window.innerHeight}, mouse:null,
            lookMotion:!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        };
        result.hidden = true;
    }
    function ensureWorld() {
        const s = game;
        if (canvas.width !== s.width) canvas.width = s.width;
        if (canvas.height !== s.height) canvas.height = s.height;
    }
    // Eski WebKit'te çekirdeğin siper çizimi için yalnızca mod süresince.
    function legacyRoundRect(x,y,w,h,r) {
        const rr=Math.max(0,Math.min(typeof r==='number'?r:0,w*.5,h*.5));
        this.moveTo(x+rr,y);
        this.arcTo(x+w,y,x+w,y+h,rr);
        this.arcTo(x+w,y+h,x,y+h,rr);
        this.arcTo(x,y+h,x,y,rr);
        this.arcTo(x,y,x+w,y,rr);
        this.closePath();
    }
    function mountWorld() {
        if (typeof ctx.roundRect !== 'function') {
            game.savedRoundRect = Object.getOwnPropertyDescriptor(ctx,'roundRect') || null;
            ctx.roundRect=legacyRoundRect;
        }
        canvas.classList.add('m31-world');
        canvas.style.setProperty('--m31-world-w',game.width+'px');
        canvas.style.setProperty('--m31-world-h',game.height+'px');
        document.body.classList.add('m31-playing');
        ensureWorld(); hud.hidden = leave.hidden = false;
    }
    function resetSession() {
        if (!game) return;
        if (game.mouse) {
            lastMouseX = game.mouse.x;
            lastMouseY = game.mouse.y;
        }
        if (ctx.roundRect===legacyRoundRect) {
            if (game.savedRoundRect) Object.defineProperty(ctx,'roundRect',game.savedRoundRect);
            else delete ctx.roundRect;
        }
        game = null;
        for (const name of ['--m31-world-w','--m31-world-h','--m31-camera-x','--m31-camera-y']) canvas.style.removeProperty(name);
        document.body.classList.remove('m31-playing');
        canvas.classList.remove('m31-world');
        resize();
        hud.hidden = result.hidden = leave.hidden = true;
        if (window.GAME_MODE === ID) window.GAME_MODE = returnMode;
        returnMode = 'arena';
    }
    function quietLegacyArena() {
        // Çekirdek, oyuncunun yeteneklerini ve mermi çarpışmalarını işletmeye devam eder.
        // Varsayılan bot doğurma sayaçları Moda girildiğinde ilerletilmez.
        bot.isActive = bot2.isActive = false;
        slimeTimer = stationaryTimer = boomerangTimer = fogBotTimer = 0;
        lastObstacleTime = Date.now();
    }
    function buildCover() {
        // Koridorlar aynı kalır ki bir turun gözlemi sonraki turda işe yarasın.
        const plans = [
            [.50,.70,52], [.31,.66,46], [.69,.66,46], [.43,.40,47], [.57,.40,47],
            [.24,.44,45], [.76,.44,45], [.35,.25,42], [.65,.25,42], [.50,.21,45]
        ];
        return plans.map(([x,y,r])=>({x:x*game.width,y:y*game.height,radius:r,hp:1150,maxHp:1150,_m31cover:true}));
    }
    function refreshPlayer() {
        // Yeni tur normal karakter seçimiyle aynı sıfırlamayı yapar; dolan ulti silinmez.
        const chargeBefore = player.ultCharge;
        player.setCharacter(player.charType);
        if (player.charType !== 'sam') {
            player.ultCharge = clamp(chargeBefore || 0,0,100);
            player.ultReady = player.ultCharge >= 100;
        }
        ultFill.style.width = `${player.ultCharge}%`;
        ultiBtn.classList.toggle('ready',player.ultReady);
        gadgetBtn.classList.remove('active','cooldown');
        gadgetBtn2.classList.remove('active','cooldown');
        for (const name of ['gadget-timer','gadget-timer-2']) {const timer=$(name); if (timer) timer.textContent='';}
        // Başka karakter modlarına da normal sıfırlama bildirimi gider.
        if (typeof prev.reset === 'function') prev.reset.call(hooks);
        gadgetTimerText = $('gadget-timer'); gadgetTimerText2 = $('gadget-timer-2');
    }
    function createAgent(role,pos,side) {
        const hp = bot.maxHp || 3000;
        const patrol = role === 'gözlemci' ? [
            point(game.width*.36,game.height*.52), point(game.width*.49,game.height*.55),
            point(game.width*.64,game.height*.52), point(game.width*.49,game.height*.42)
        ] : [sidePost(side),point(game.width*(side ? .72 : .28),game.height*.34),
            point(game.width*(side ? .80 : .20),game.height*.27)];
        return {
            // Orijinal bot çizilir: çekirdeğin drawEntity işlevi, bir göz, aynı yarıçap.
            ...pos,radius:bot.radius,color:bot.color,angle:Math.PI/2,
            hp,maxHp:hp,speed:quiet()?1.47:1.82,isActive:true,isDead:false,
            kbX:0,kbY:0,bombaBulasti:false,bombaSayaci:0,ghostRingDebounce:0,
            _m31:true, role, task:'devriye', side, patrol, patrolIndex:0,
            personal:null, shared:null, seeFor:0, watching:false, seen:false,
            nextReport:0, rethink:0, nextRoute:0, plan:null, path:[], pathVersion:-1,
            spin:1, cooldown:42+(role==='kesici'?24:0),wind:null,
            lastHp:hp, coverTime:0, coverGoal:null, stuck:0, near:null,
            guard:sidePost(side), lastSafe:point(pos.x,pos.y)
        };
    }
    function sidePost(index) {
        return point(game.width*(index ? .79 : .21),game.height*.29);
    }
    function newRound() {
        const s = game;
        s.round++;
        if (s.round !== 1) refreshPlayer();
        mountWorld();
        if (typeof clearArenaInputs === 'function') clearArenaInputs();
        else {
            // Joystick açısı korunabilir; önceki basılı tuş/dokunma yeni tura geçmez.
            for (const input of [moveData,aimData,ultAim,gadAim,gadAim2]) {
                input.active = input.isMouse = false;
                if ('touchId' in input) input.touchId = null;
            }
            for (const id of ['left-knob','right-knob']) { const k=$(id); if(k) k.style.transform=''; }
            if (typeof keysPressed !== 'undefined') for (const key of Object.keys(keysPressed)) delete keysPressed[key];
        }
        player.x=s.spawn.x; player.y=s.spawn.y; player.angle=-Math.PI/2; player.isDead=false;
        player.lastHitTime=Date.now(); player.lastShotTime=0;
        bullets=[]; botBullets=[]; floatingNumbers=[]; particles=[]; explosions=[];
        samGloves=[]; spikeFields=[]; souls=[]; specialSouls=[]; ghostZones=[]; cactusWalls=[];
        slimeBots=[]; stationaryBots=[]; fogBots=[]; boomerangBots=[]; nests=[]; fogAreas=[]; spawnIndicators=[];
        obstacles = buildCover();
        screenShake=0;
        quietLegacyArena();
        s.phase='play'; s.preferred=s.memory; s.remaining=ROUND_LIMIT; s.carrying=false;
        s.knownAt=[-Infinity,-Infinity]; s.radio=[]; s.nav=null; s.solids=[];
        const side = s.preferred === null ? 1 : s.preferred;
        const patrolStart = side === 0 ? .61 : .39;
        s.agents = [
            createAgent('gözlemci',point(s.width*patrolStart,s.height*.47),1-side),
            createAgent('kesici',s.preferred===null ? point(s.width*.67,s.height*.37) : sidePost(side),side)
        ];
        updateSolids();
        viewStep(0,true);
        updateHud();
    }
    function finish(won,why) {
        const s=game;
        if (s.phase==='done') return;
        s.phase='done'; s.radio=[]; s.agents=[]; player.isDead=true;
        bullets.length=0; botBullets.length=0;
        hud.hidden=leave.hidden=true;
        text($('m31-result-title'),won?'Ters Köşe!':why);
        text($('m31-result-text'),won?'Üç mührü de çıkardın.':'Teslim edilen mühür: '+s.cleared+' / '+ROUND_COUNT);
        result.hidden=false;
    }
    function deliver(index) {
        const s=game;
        if (s.time-s.knownAt[index] <= 240) s.memory=index;
        s.cleared++;
        if (s.cleared===ROUND_COUNT) return finish(true);
        s.phase='break'; s.breakTime=105; s.agents=[]; s.radio=[];
        botBullets.length=0; bullets.length=0;
        updateHud();
    }

    // --- Görüş, çarpışma ve engellerin çevresinden yol bulma ---------------
    function updateSolids() {
        const s=game;
        const list=obstacles.concat(cactusWalls).filter(o=>o.hp>0);
        if (s.nav && s.solids.length===list.length && list.every((o,i)=>o===s.solids[i])) return;
        s.solids=list; s.nav=makeNav((s.nav?.version || 0)+1,bot.radius);
    }
    function intersects(a,b,o,radius) {
        const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
        const t=den ? clamp(((o.x-a.x)*dx+(o.y-a.y)*dy)/den,0,1) : 0;
        const x=a.x+dx*t-o.x,y=a.y+dy*t-o.y;
        return x*x+y*y < radius*radius;
    }
    function clear(a,b,pad=0) {
        for (const o of game.solids) if (intersects(a,b,o,o.radius+pad)) return false;
        return true;
    }
    function bound(p,r) {
        const m=WALL_THICKNESS+r+2;
        return point(clamp(p.x,m,game.width-m),clamp(p.y,m,game.height-m));
    }
    function free(p,r) {
        const m=WALL_THICKNESS+r;
        return p.x>=m && p.x<=game.width-m && p.y>=m && p.y<=game.height-m && clear(p,p,r+2);
    }
    function makeNav(version,r) {
        const m=WALL_THICKNESS+r+4, w=game.width-2*m, h=game.height-2*m;
        const cols=Math.ceil(w/48)+1, rows=Math.ceil(h/48)+1, nodes=[];
        for (let j=0;j<rows;j++) for (let i=0;i<cols;i++) {
            const p=point(m+i*w/(cols-1),m+j*h/(rows-1));
            nodes.push({...p,id:j*cols+i,open:free(p,r),edges:[]});
        }
        // Komşu merkezleri ve kenarları kontrol et; çapraz köşeden siper içinden geçme yok.
        for (let j=0;j<rows;j++) for (let i=0;i<cols;i++) {
            const n=nodes[j*cols+i]; if (!n.open) continue;
            for (const [x,y] of [[1,0],[0,1],[1,1],[-1,1]]) {
                if (i+x<0 || i+x>=cols || j+y>=rows) continue;
                const v=nodes[(j+y)*cols+i+x];
                if (!v.open || !clear(n,v,r+2)) continue;
                const cost=len(n,v); n.edges.push({v,cost}); v.edges.push({v:n,cost});
            }
        }
        return {nodes,version};
    }
    function nearestNode(p,r,checkSegment) {
        let best=null,score=Infinity;
        for (const n of game.nav.nodes) {
            if (!n.open) continue;
            const dx=n.x-p.x,dy=n.y-p.y, d=dx*dx+dy*dy;
            if (d>=score || (checkSegment && !clear(p,n,r+1))) continue;
            best=n;score=d;
        }
        return best;
    }
    function route(e,desired) {
        const r=e.radius, dest=bound(desired,r);
        if (free(dest,r) && clear(e,dest,r+2)) return [dest];
        const source=nearestNode(e,r,true), target=nearestNode(dest,r,free(dest,r));
        if (!source || !target) return [];
        const size=game.nav.nodes.length, cost=new Float32Array(size), closed=new Uint8Array(size), parent=new Int16Array(size);
        cost.fill(Infinity); cost[source.id]=0; parent.fill(-1);
        const open=[{n:source,f:len(source,target)}];
        let reached=false, fallback=source, bestDistance=len(source,target);
        while (open.length) {
            let index=0;
            for (let i=1;i<open.length;i++) if (open[i].f<open[index].f) index=i;
            const cur=open[index].n; open[index]=open[open.length-1]; open.pop();
            if (closed[cur.id]) continue;
            closed[cur.id]=1;
            if (cur===target) { reached=true;break; }
            const progress=len(cur,target);
            if (progress<bestDistance) {bestDistance=progress;fallback=cur;}
            for (const edge of cur.edges) {
                if (closed[edge.v.id]) continue;
                const g=cost[cur.id]+edge.cost;
                if (g+0.0001>=cost[edge.v.id]) continue;
                cost[edge.v.id]=g; parent[edge.v.id]=cur.id;
                open.push({n:edge.v,f:g+len(edge.v,target)});
            }
        }
        const chain=[];
        for (let i=(reached?target:fallback).id;i>=0;i=parent[i]) chain.unshift(game.nav.nodes[i]);
        if (reached && free(dest,r) && clear(target,dest,r+2)) chain.push(dest);
        return chain;
    }
    function moveAgent(e,dt) {
        const s=game;
        if (Math.hypot(e.kbX||0,e.kbY||0)>1) return;
        if (e.pathVersion!==s.nav.version || e.nextRoute<=s.time) {
            e.path=route(e,e.plan||e);
            e.pathVersion=s.nav.version; e.nextRoute=s.time+29;
        }
        while (e.path.length && len(e,e.path[0])<5) e.path.shift();
        // Yolun görünür bir sonraki köşesine çapraz kestir; titreşim olmasın.
        while (e.path.length>1 && clear(e,e.path[1],e.radius+2)) e.path.shift();
        const next=e.path[0];
        if (!next) return;
        const a=bearing(e,next), speed=e.speed*(e.task==='aranıyor' ? .86 : e.wind ? .53 : 1);
        const l=Math.min(dt*speed,len(e,next));
        let goal=along(e,a,l);
        for (const ally of s.agents) {
            if (ally===e || !good(ally)) continue;
            const d=len(e,ally), ideal=e.radius+ally.radius+15;
            if (d>=ideal || d<.01) continue;
            const avoid=Math.min(l*.80,(ideal-d)*.10);
            goal.x+=(e.x-ally.x)/d*avoid;goal.y+=(e.y-ally.y)/d*avoid;
        }
        goal=bound(goal,e.radius);
        const old=point(e.x,e.y);
        const moves=[goal,point(goal.x,e.y),point(e.x,goal.y)];
        for (const step of moves) {
            if (!free(step,e.radius)) continue;
            e.x=step.x;e.y=step.y; e.lastSafe=point(e.x,e.y); break;
        }
        if (len(old,e)<.10 && l>.25) {
            e.stuck+=dt;
            if (e.stuck>17) {e.nextRoute=0;e.rethink=0;e.spin*=-1;e.stuck=0;}
        } else e.stuck=0;
    }

    // --- Takım zekâsı: kamera ve oyuncu inputu burada kullanılmaz -----------
    function canSee(e) {
        const p=player,d=len(e,p);
        if (d>(quiet()?315:365) || (p.isInvisible && d>62)) return false;
        if (d>85 && Math.abs(angleDiff(e.angle,bearing(e,p)))>1.72) return false;
        return clear(e,p,1);
    }
    function observe(e,dt) {
        const s=game;
        e.watching=canSee(e);
        e.seeFor=e.watching?e.seeFor+dt:0;
        e.seen=e.seeFor>=(quiet()?20:14);
        if (!e.seen) return;
        const p=player, old=e.personal;
        const t=old?s.time-old.t:Infinity;
        const coherent=t>0 && t<17;
        const vx=coherent?old.vx*.58+clamp((p.x-old.x)/t,-4.8,4.8)*.42:0;
        const vy=coherent?old.vy*.58+clamp((p.y-old.y)/t,-4.8,4.8)*.42:0;
        e.personal={x:p.x,y:p.y,t:s.time,vx,vy,holding:s.carrying};
        if (s.carrying) s.exits.forEach((exit,i)=>{if (len(exit,p)<142) s.knownAt[i]=s.time;});
        if (s.time>=e.nextReport) {
            for (const to of s.agents) if (to!==e && good(to) && len(to,e)<670) {
                s.radio.push({to,from:e,at:s.time+REPORT_DELAY,data:e.personal});
            }
            e.nextReport=s.time+42;
        }
    }
    function deliverReports() {
        const s=game;
        for (let i=s.radio.length-1;i>=0;i--) {
            const r=s.radio[i];
            if (s.time<r.at) continue;
            if (good(r.to) && (!r.to.shared || r.data.t>r.to.shared.t)) {
                r.to.shared=r.data; r.to.rethink=0;
            }
            s.radio.splice(i,1);
        }
    }
    function latest(e) {
        const m=(!e.shared || (e.personal && e.personal.t>=e.shared.t))?e.personal:e.shared;
        return m && game.time-m.t<=INTEL_TTL ? m : null;
    }
    function guessGate(intel,e) {
        const s=game, soon=intel.x+intel.vx*27-s.width*.5;
        if (Math.abs(soon)>s.width*.085) return soon>0?1:0;
        return s.preferred ?? e.side;
    }
    function hidingPoint(e,from) {
        let best=null,score=Infinity;
        for (const o of game.solids) {
            if (len(e,o)>230) continue;
            const a=bearing(from,o);
            for (const turn of [0,.45,-.45]) {
                const p=along(o,a+turn,o.radius+e.radius+13);
                if (!free(p,e.radius) || clear(from,p,1)) continue;
                const d=len(e,p)+(clear(e,p,e.radius+2)?0:38);
                if (d<score) {best=p;score=d;}
            }
        }
        return best;
    }
    function fightPoint(e,m,ally) {
        const a=bearing(m,e), d=len(m,e);
        const ideal=d<130?211:quiet()?185:207;
        const choices=[.57,1.02,1.46,-.61,-1.14];
        let pick=null,score=-Infinity;
        for (const shift of choices) {
            const p=bound(along(m,a+shift*e.spin,ideal),e.radius);
            if (!free(p,e.radius)) continue;
            let value = (clear(p,m,5)?76:0)+(clear(e,p,e.radius+2)?34:0) - .21*len(e,p) - .22*Math.abs(len(p,m)-ideal);
            if (shift>0) value+=14;
            if (ally) value+=Math.min(len(p,ally),170)*.17;
            const nearCover=game.solids.some(o=>len(o,p)-o.radius-e.radius<53);
            if (nearCover) value+=18;
            if (value>score) {score=value;pick=p;}
        }
        return pick || along(e,a,e.radius*1.3);
    }
    function think(e) {
        const s=game, memory=latest(e), ally=s.agents.find(x=>x!==e && good(x));
        const age=memory?s.time-memory.t:Infinity;
        if (e.hp<e.lastHp && good(e) && memory) {
            const safe = hidingPoint(e,memory);
            if (safe) {e.coverGoal=safe;e.coverTime=clamp(len(e,safe)/e.speed+21,41,100);e.wind=null;}
        }
        e.lastHp=e.hp;
        if (e.coverTime>0 && e.coverGoal) {
            e.task='siper'; e.plan=e.coverGoal;
        } else if (memory && e.role==='kesici' && memory.holding && ally && age<201 && (!e.seen || len(e,memory)>145)) {
            const gate=guessGate(memory,e);
            e.guard=sidePost(gate);e.task='kesiyor';
            e.plan=len(e,e.guard)<32?point(e.guard.x,e.guard.y+Math.sin(s.time/36)*18):e.guard;
        } else if (memory && e.seen) {
            e.task='yan açı'; e.plan=fightPoint(e,memory,ally);
        } else if (memory) {
            e.task='aranıyor';
            const distance=len(e,memory);
            const sweep=Math.floor(age/41)%3;
            const a=(Math.hypot(memory.vx,memory.vy)>.12?Math.atan2(memory.vy,memory.vx):bearing(e,memory));
            e.plan=distance>93 && age<104?memory:along(memory,a+[0,1.11,-1.11][sweep],65+23*sweep);
        } else {
            e.task='devriye';
            if (len(e,e.patrol[e.patrolIndex])<23) e.patrolIndex=(e.patrolIndex+1)%e.patrol.length;
            e.plan=e.patrol[e.patrolIndex];
        }
        e.nextRoute=0;
        e.rethink=s.time+(e.task==='yan açı'?33:27);
    }
    function shotIsClear(e,target) {
        if (len(e,target)>RANGE || !clear(e,target,5)) return false;
        for (const ally of game.agents) if (ally!==e && good(ally) && intersects(e,target,ally,ally.radius+5)) return false;
        return true;
    }
    function combat(e,dt) {
        const m=e.personal;
        e.cooldown=Math.max(0,e.cooldown-dt);
        if ((!e.seen || !m || e.coverTime>0 || !shotIsClear(e,m)) && e.wind) {
            e.wind=null; e.cooldown=Math.max(e.cooldown,24); return;
        }
        if (e.wind) {
            eye(e,bearing(e,e.wind.target),dt);
            if ((e.wind.time-=dt)>0) return;
            const target=e.wind.target;
            e.wind=null;e.cooldown=quiet()?127:102;
            if (!shotIsClear(e,target)) return;
            const a=bearing(e,target)+(Math.random()-.5)*(quiet() ? .174 : .102);
            botBullets.push({x:e.x,y:e.y,sx:e.x,sy:e.y,vx:Math.cos(a)*BOT_BULLET_SPEED,
                vy:Math.sin(a)*BOT_BULLET_SPEED,owner:e,dmgMod:1,type:'m31'});
            return;
        }
        if (!e.seen || !m || e.coverTime>0 || e.cooldown>0 || !shotIsClear(e,m)) return;
        // Oyuncunun tuşuna değil, gözlemlenmiş hareketine bakar. Atış noktası ön uyarıda kilitlenir.
        const lead=clamp(len(e,m)/BOT_BULLET_SPEED*.47,0,19);
        const predicted=point(m.x+m.vx*lead,m.y+m.vy*lead);
        e.wind={target:shotIsClear(e,predicted)?predicted:point(m.x,m.y),time:quiet()?26:20};
    }
    function tickBots(dt) {
        const s=game;
        for (const e of s.agents) if (!good(e) && !e.isDead) {
            e.isDead=true; botsKilled++;
            spawnParticles(e.x,e.y,e.color);
            if (typeof hooks.onEnemyKilled==='function') hooks.onEnemyKilled(e);
        }
        s.agents=s.agents.filter(good);
        deliverReports();
        for (const e of s.agents) {
            if (!Number.isFinite(e.x+e.y)) Object.assign(e,e.lastSafe);
            observe(e,dt);
        }
        for (const e of s.agents) {
            e.coverTime=Math.max(0,e.coverTime-dt);
            if (s.time>=e.rethink || e.hp<e.lastHp) think(e);
            moveAgent(e,dt);
            const waypoint=e.path[0]||e.plan;
            const m=e.personal;
            if (!e.wind && e.seen && m) eye(e,bearing(e,m),dt);
            else if (!e.wind && waypoint && len(e,waypoint)>4) eye(e,bearing(e,waypoint),dt);
            else if (!e.wind && !e.seen) eye(e,e.angle+.06*e.spin,dt);
            combat(e,dt);
        }
    }

    // --- Kamera: ana canvası kaydır, joystick'ler ekranda sabit kalsın. ----
    function viewStep(dt,snap) {
        const s=game,v=s.view,p=player;
        v.w=window.innerWidth; v.h=window.innerHeight;
        let ox=0,oy=0;
        if (!snap && s.lookMotion) {
            let ang=null, strength=0;
            if (aimData.active && Math.hypot(aimData.x,aimData.y)>.17) {
                ang=aimData.angle;strength=1;
            } else if (s.mouse) {
                const x=s.mouse.x+v.x-p.x,y=s.mouse.y+v.y-p.y;
                ang=Math.atan2(y,x);strength=clamp(Math.hypot(x,y)/230,0,.8);
            }
            if (ang!==null) { ox=Math.cos(ang)*55*strength;oy=Math.sin(ang)*55*strength; }
        }
        const targetX=clamp(p.x+ox-v.w*.50,0,s.width-v.w);
        const targetY=clamp(p.y+oy-v.h*.47,0,s.height-v.h);
        const k=snap?1:1-Math.exp(-dt/8);
        v.x+=(targetX-v.x)*k;v.y+=(targetY-v.y)*k;
        canvas.style.setProperty('--m31-camera-x',(-v.x)+'px');
        canvas.style.setProperty('--m31-camera-y',(-v.y)+'px');
        syncMouse();
    }
    function syncMouse() {
        if (!game?.mouse) return;
        const p=player;
        lastMouseX=game.mouse.x+game.view.x;lastMouseY=game.mouse.y+game.view.y;
        const x=lastMouseX-p.x,y=lastMouseY-p.y;
        const a=Math.atan2(y,x), d=Math.hypot(x,y);
        if (!aimData.active) p.angle=a;
        if (ultAim.active && ultAim.isMouse) {ultAim.angle=a;ultAim.pull=Math.min(1,d/(RANGE*1.1));}
        if (gadAim.active && gadAim.isMouse) {gadAim.angle=a;gadAim.pull=Math.min(1,d/(RANGE*.8));}
        if (gadAim2.active && gadAim2.isMouse) {gadAim2.angle=a;gadAim2.pull=Math.min(1,d/(RANGE*.65));}
    }
    canvas.addEventListener('mousemove',e=>{
        if (!inMode()) return;
        game.mouse=point(e.clientX,e.clientY);syncMouse();
    });
    canvas.addEventListener('pointerleave',()=>{if (inMode()) game.mouse=null;});
    canvas.addEventListener('click',e=>{
        if (!inMode()) return;
        // Çekirdeğin tıklama hesabı ekrandan başlar; bu modda dünya konumuna çevir.
        e.stopImmediatePropagation();
        if (game.phase!=='play' || player.isDead || !gameStarted) return;
        const x=e.clientX+game.view.x,y=e.clientY+game.view.y;
        const primed=player.charType==='spike' && player.ultiHazirlik;
        if ((!primed && player.ammo<1) || Date.now()-player.lastShotTime<=200) return;
        const p=player, a=Math.atan2(y-p.y,x-p.x), pull=Math.min(1,Math.hypot(x-p.x,y-p.y)/(RANGE*(primed ? .9 : 1)));
        p.fire(a,pull,{input:'canvas',x,y,touch:e.pointerType==='touch'||!!e.sourceCapabilities?.firesTouchEvents});
    },true);
    window.addEventListener('resize',()=>{if (inMode() && game.phase!=='new') {ensureWorld();viewStep(0,true);}});

    // --- Görev çizimleri; orijinal bot siluetinin üstüne bir şey çizilmez. --
    function circle(g,p,r) {g.beginPath();g.arc(p.x,p.y,r,0,TAU);}
    function label(g,value,p,dy) {
        g.font='bold 11px system-ui,sans-serif';g.textAlign='center';
        g.lineWidth=3;g.strokeStyle='#17232e';g.strokeText(value,p.x,p.y+dy);g.fillText(value,p.x,p.y+dy);
    }
    function drawMarker(g,p,r,color,caption,enabled) {
        g.save();g.fillStyle=color;g.strokeStyle=color;g.lineWidth=2;
        circle(g,p,r);g.globalAlpha=enabled ? .16 : .07;g.fill();
        g.globalAlpha=enabled?1:.45;if (!enabled) g.setLineDash([6,5]);g.stroke();g.setLineDash([]);
        label(g,caption,p,-r-9);
        g.restore();
    }
    function edgeGuide(g,goal,color,caption) {
        const v=game.view;
        if (goal.x>=v.x+26 && goal.x<=v.x+v.w-26 && goal.y>=v.y+92 && goal.y<=v.y+v.h-75) return;
        const c=point(v.x+v.w*.5,v.y+v.h*.5), dx=goal.x-c.x,dy=goal.y-c.y;
        if (Math.abs(dx)+Math.abs(dy)<8) return;
        const xMax=Math.max(28,v.w*.5-37);
        const yMax=Math.max(28,v.h*.5-(dy<0?83:91));
        const t=Math.min(xMax/Math.max(1,Math.abs(dx)),yMax/Math.max(1,Math.abs(dy)),1);
        const p=point(c.x+dx*t,c.y+dy*t);
        g.save();g.translate(p.x,p.y);g.rotate(Math.atan2(dy,dx));g.fillStyle=color;
        g.beginPath();g.moveTo(10,0);g.lineTo(-7,-7);g.lineTo(-4,0);g.lineTo(-7,7);g.closePath();g.fill();g.restore();
        g.save();g.fillStyle=color;label(g,caption,p,dy<0?21:-13);g.restore();
    }
    function drawMode(g) {
        const s=game;
        if (!s || s.phase==='new' || s.phase==='done') return;
        g.save();
        s.exits.forEach((p,i)=>drawMarker(g,p,EXIT_R,s.carrying?GREEN:'#a9b9c9',i===0?'SOL ÇIKIŞ':'SAĞ ÇIKIŞ',s.carrying));
        if (!s.carrying) {
            drawMarker(g,s.seal,SEAL_R,GOLD,'MÜHÜR',true);
            g.save();g.translate(s.seal.x,s.seal.y);g.rotate(Math.PI/4);g.fillStyle=GOLD;g.fillRect(-6,-6,12,12);g.restore();
            edgeGuide(g,s.seal,GOLD,'MÜHÜR');
        } else if (s.phase==='play') {
            const p=point(player.x,player.y+player.radius+10);
            g.save();g.translate(p.x,p.y);g.rotate(Math.PI/4);g.fillStyle=GOLD;g.fillRect(-4,-4,8,8);g.restore();
            s.exits.forEach((e,i)=>edgeGuide(g,e,GREEN,i===0?'SOL':'SAĞ'));
        }
        for (const e of s.agents) if (e.wind && good(e)) {
            const a=bearing(e,e.wind.target),p=along(e,a,e.radius+5),q=along(e,a,e.radius+52);
            g.save();g.strokeStyle='#ffcc96';g.lineWidth=2;g.globalAlpha=.72;g.setLineDash([4,4]);
            g.beginPath();g.moveTo(p.x,p.y);g.lineTo(q.x,q.y);g.stroke();g.restore();
        }
        g.restore();
    }
    function updateMode(delta) {
        if (!game) return;
        const s=game, dt=clamp(Number.isFinite(delta)?delta:0,0,3);
        if (s.phase==='new') newRound();
        ensureWorld(); quietLegacyArena();
        if (s.phase==='done') return;
        if (player.hp<=0 || player.isDead) return finish(false,'Yakalandın');
        s.time+=dt;
        if (s.phase==='break') {
            if ((s.breakTime-=dt)<=0) newRound();
            viewStep(dt,false);return;
        }
        if ((s.remaining-=dt)<=0) return finish(false,'Süre doldu');
        updateSolids();
        if (!s.carrying && len(player,s.seal)<=player.radius+SEAL_R) s.carrying=true;
        tickBots(dt);
        if (s.carrying) {
            const exit=s.exits.findIndex(e=>len(player,e)<=EXIT_R);
            if (exit!==-1) deliver(exit);
        }
        viewStep(dt,false); updateHud();
    }

    ext.modes[ID]={label:'Ters Köşe',onStart:startSession,onUpdate:updateMode,onDraw:drawMode,onReset:resetSession};
    ext.botTypes=ext.botTypes||{};
    ext.botTypes[ID]={label:'Tek gözlü taktik bot',radius:bot.radius,color:bot.color};
    hooks.onDraw=function(g) {
        const out=typeof prev.draw==='function'?prev.draw.apply(this,arguments):undefined;
        if (inMode()) drawMode(g);
        return out;
    };
    hooks.getExtraEnemies=function() {
        return inMode()?game.agents.filter(good):typeof prev.extra==='function'?prev.extra.apply(this,arguments):[];
    };
    hooks.getBotTarget=function(e) {
        // Çekirdeğin göz yönünü oyuncunun duvar arkasındaki konumuna çevirmesini engelle.
        if (inMode() && e._m31) return along(e,e.angle,90);
        return typeof prev.target==='function'?prev.target.apply(this,arguments):null;
    };
    hooks.onReset=function() {
        const out=typeof prev.reset==='function'?prev.reset.apply(this,arguments):undefined;
        // startGame onStart'tan sonra da onReset çağırır. İlk turu güncelleme başlatır.
        if (game && game.phase!=='new') resetSession();
        return out;
    };
})();
