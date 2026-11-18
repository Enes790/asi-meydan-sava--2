/**
 * ============================================================================
 * MOD9.JS  —  YENİ KARAKTER: "ÇEKİM" (Kütleçekim Mimarı)
 * ----------------------------------------------------------------------------
 * Bu dosya ana oyuna HİÇ DOKUNMAZ. Ana script'ten SONRA yüklenir ve:
 *   - window.GAME_EXT.characters['cekim']  -> karakter istatistikleri
 *   - Player.prototype yamaları            -> ana saldırı / 2 aksesuar / ulti
 *   - window.GAME_EXT.hooks.onDraw         -> tüm görseller (zincirlenir)
 *   - window.GAME_EXT.hooks.onReset        -> restart temizliği (zincirlenir)
 *   - window.GAME_EXT.hooks.onEnemyKilled  -> ulti şarjı (zincirlenir)
 *   - kendi requestAnimationFrame döngüsü  -> mekanik güncellemeleri + mobil UI
 * üzerinden çalışır.
 *
 * ÖNEMLİ TEKNİK NOT:
 * Ana koddaki `player`, `bullets`, `botBullets`, `gameStarted`, `screenShake`,
 * `getActiveEnemies()`, `addFloatingNumber()`, `spawnParticles()`, `RANGE`,
 * `WALL_THICKNESS`, `aimData`, `ultAim`, `gadAim2`, `Player` vb. tanımlar
 * let/const/class olduğu için window ÜZERİNDE DEĞİLDİR; ama aynı global
 * sözcük kapsamını paylaştıklarından bu dosyadan ADLARIYLA (çıplak
 * tanımlayıcı) canlı olarak okunabilir/yazılabilir. (window.player diye
 * aramak ÇALIŞMAZ — eski sürümdeki hata buydu.)
 *
 * ----------------------------------------------------------------------------
 * KARAKTER KİMLİĞİ
 * Tema: Kozmik kütleçekim mimarı. Ne ressam, ne ninja, ne hayalet...
 * Çekim savaş alanını "kütle noktaları" ile büken bir alan kontrolcüsüdür.
 * DASH YOKTUR, İZ BIRAKMA YOKTUR, TELEPORT YOKTUR.
 *
 * 1) ANA SALDIRI — "GRAVİTON OKU + ÇİFT ÇÖKÜŞÜ" (benzersiz iki atımlık ritim):
 *    - Her atış düz giden bir graviton oku fırlatır (joystick'i ne kadar
 *      uzağa çekersen menzil o kadar uzun). Ok; düşmana (350), siperlere (200)
 *      çarpar ya da menzil sonunda durur ve her durumda durduğu yere bir
 *      "KÜTLE KUYUSU" kenetler. Kuyu 5 sn boyunca yakınındaki düşmanları
 *      içine doğru sürükler ve saniyede 90 hasar verir.
 *    - Sahada bir kuyu var İKEN ikinci kuyu kenetlendiği anda "ÇİFT ÇÖKÜŞÜ"
 *      tetiklenir: iki kuyu arasında enerji hattı parlar, kuyular ortada
 *      çarpışır ve ÇÖKÜŞ patlar: merkez çevresinde 1000, iki kuyu arasındaki
 *      HATTA yakalananlara +700 (toplam 1700) hasar + içe vakum.
 *      Yani nişan bir "çizgi tuzağı" kurma oyunudur — benzersiz.
 *
 * 2) AKSESUAR 1 (Q / YEŞİL BUTON) — "TERS POLARİTE":
 *    Oyuncudan ve sahadaki tüm kuyulardan 200px yarıçaplı itiş dalgası patlar:
 *    400 hasar + dev dışa savurma (duvara savrulan botlar ana koddaki
 *    "DUVAR STUN!" cezasını da yer), düşman mermilerini siler. CD 13 sn.
 *
 * 3) AKSESUAR 2 (E / MOR BUTON) — "SIFIR ÇEKİM ALANI":
 *    Hedefe yay çizen bir kapsül atılır; indiği yerde 5 sn'lik 140px yarıçaplı
 *    yerçekimsiz kubbe açılır. İçindeki botlar HAVADA DONAR: hareket edemez,
 *    ateş edemez, yuva slime salamaz; mermiler kubbede asılı kalır (süre
 *    bitince kaldıkları hızla devam ederler). Donmuş botlar hasar almaya devam
 *    eder -> Çöküş kombosu için mükemmel hedef kümesi. CD 18 sn.
 *
 * 4) ULTİ (R / GÜÇ BUTONU) — "KARA DELİK (OLAY UFKU)":
 *    Hedefe 6 saniyelik, 230px yarıçapında kara delik çağrılır: her şeyi
 *    merkezine çeker, yarım saniyede bir 160 hasar verir, düşman mermilerini
 *    yutar, verdiği hasar kadar oyuncuyu iyileştirir. Süre bitiminde
 *    SÜPERNOVA ile patlar: 1500 hasar + dışa savurma.
 *    Şarj: isabet/çöküş/öldürme olaylarından dolar (ana koddaki chargeUlti
 *    yalnızca yerleşik karakterleri tanıdığı için şarj bu modda yönetilir).
 * ============================================================================
 */

(function () {
    'use strict';

    // ==========================================================================
    // 0) KAYIT: karakter istatistikleri (ana kod setCharacter içinde okur)
    // ==========================================================================
    window.GAME_EXT = window.GAME_EXT || { characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {} };
    window.GAME_EXT.characters['cekim'] = { color: '#8e44ad', hp: 3400, speed: 3.3 };

    const CHAR = 'cekim';
    const C_BODY = '#8e44ad';   // mor
    const C_CORE = '#00f5d4';   // camgöbeği
    const C_GOLD = '#f1c40f';   // altın

    // --- Denge sabitleri ---
    const BOLT_SPEED   = 13;             // graviton oku hızı
    const BOLT_RANGE   = RANGE * 1.05;   // ana saldırı maks. menzili
    const BOLT_DMG     = 350;            // doğrudan isabet
    const WELL_LIFE    = 300;            // kuyu ömrü (kare) ~5sn
    const WELL_PULL_R  = 120;            // kuyu çekim yarıçapı
    const IMPLODE_CORE = 1000;           // çöküş merkez hasarı
    const IMPLODE_LINE = 700;            // çöküş hattı ek hasarı
    const IMPLODE_R    = 160;            // çöküş merkez yarıçapı
    const POL_R        = 200;            // ters polarite yarıçapı
    const POL_DMG      = 400;
    const ZG_RANGE     = RANGE * 0.85;   // sıfır çekim atış menzili
    const ZG_R         = 140;            // sıfır çekim kubbe yarıçapı
    const ZG_LIFE      = 300;            // ~5sn
    const BH_THROW     = RANGE * 1.15;   // kara delik atış menzili
    const BH_R         = 230;            // kara delik yarıçapı
    const BH_LIFE      = 360;            // ~6sn
    const NOVA_DMG     = 1500;

    // ==========================================================================
    // 1) MOD DURUMU
    // ==========================================================================
    const S = {
        bolts:   [],  // havadaki graviton okları
        wells:   [],  // serbest kütle kuyuları (en fazla 1)
        links:   [],  // çift çöküşü olayları {w1,w2,mid,phase,t}
        pods:    [],  // havadaki sıfır çekim kapsülleri
        bubbles: [],  // sıfır çekim kubbeleri
        hPods:   [],  // havadaki kara delik kapsülleri
        holes:   [],  // kara delikler
        waves:   []   // şok halkaları (görsel)
    };
    window.__MOD9 = { state: S, version: 2 }; // hata ayıklama sapı

    // ==========================================================================
    // 2) YARDIMCILAR (ana kodun canlı global'leri çıplak adla kullanılır)
    // ==========================================================================
    const D  = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const A  = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
    const enemies = () => getActiveEnemies();

    function segDist(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
        if (L2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * dx + (py - y1) * dy) / L2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    function shake(v) { screenShake = Math.max(screenShake, v); }

    function wave(x, y, r0, maxR, life, color, width) {
        if (S.waves.length > 40) S.waves.shift();
        S.waves.push({ x, y, r0, r: r0, maxR, life, maxLife: life, color, width });
    }

    // --- Ulti şarjı (ana chargeUlti cekim'i tanımadığı için burada) ---
    function chargeUlt(amount) {
        if (!gameStarted || player.charType !== CHAR || player.isDead || player.ultReady) return;
        player.ultCharge = Math.min(100, (player.ultCharge || 0) + amount);
        if (player.ultCharge >= 100) {
            player.ultReady = true;
            ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, 'KARA DELİK HAZIR!', C_GOLD);
        }
        if (ultFill) ultFill.style.width = player.ultCharge + '%';
    }

    // Nişan mesafesi oranı (0..1): dokunmatik joystick'te çekme miktarı,
    // farede imlecin oyuncuya uzaklığı esas alınır (spike ile aynı his).
    // NOT: joystick end() önce fire() çağırır SONRA aimData.x/y'yi sıfırlar,
    // bu yüzden active şartı aranmaz; vektör doluysa tazedir.
    let lastTouchInput = 0, lastMouseInput = 0;
    window.addEventListener('touchstart', () => { lastTouchInput = Date.now(); }, true);
    window.addEventListener('touchmove',  () => { lastTouchInput = Date.now(); }, true);
    window.addEventListener('mousemove',  () => { lastMouseInput = Date.now(); }, true);

    function aimPull() {
        const jm = Math.hypot(aimData.x, aimData.y);
        if (jm > 0.05) return Math.max(0.15, Math.min(1, jm));
        const dm = Math.hypot(lastMouseX - player.x, lastMouseY - player.y);
        return Math.max(0.3, Math.min(1, dm / BOLT_RANGE));
    }
    function aimPull2() {
        if (gadAim2.pull !== undefined && gadAim2.pull > 0.05 && lastTouchInput >= lastMouseInput) {
            return Math.max(0.2, Math.min(1, gadAim2.pull));
        }
        const dm = Math.hypot(lastMouseX - player.x, lastMouseY - player.y);
        return Math.max(0.3, Math.min(1, dm / ZG_RANGE));
    }
    function ultPull() {
        if (ultAim.pull !== undefined && ultAim.pull > 0.05 && lastTouchInput >= lastMouseInput) {
            return Math.min(1, ultAim.pull);
        }
        if (lastMouseInput > 0) {
            const dm = Math.hypot(lastMouseX - player.x, lastMouseY - player.y);
            return Math.max(0.3, Math.min(1, dm / BH_THROW));
        }
        return 1;
    }

    const inArena = (x, y, m) => ({
        x: clampPos(x, WALL_THICKNESS + m, canvas.width  - WALL_THICKNESS - m),
        y: clampPos(y, WALL_THICKNESS + m, canvas.height - WALL_THICKNESS - m)
    });

    // ==========================================================================
    // 3) KARAKTER KARTI (başlangıç ekranına mod tarafından eklenir)
    // ==========================================================================
    function injectCard() {
        const cont = document.querySelector('.char-select-container');
        if (!cont || document.getElementById('char-cekim')) return;

        // 5 kartın tek satırda düzgün durması için mod'a ait küçük stil
        // (ana dosyaya yazmaz, <style> olarak eklenir; dar ekranda sarar).
        if (!document.getElementById('mod9-card-style')) {
            const st = document.createElement('style');
            st.id = 'mod9-card-style';
            st.textContent = '.char-select-container .char-card{width:calc(20% - 8px);min-width:60px;max-width:110px}';
            (document.head || document.body).appendChild(st);
        }

        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-cekim';
        card.innerHTML =
            '<div class="char-color-preview" style="background:radial-gradient(circle at 35% 35%, #00f5d4, #8e44ad 55%, #3b0a5e);box-shadow:0 0 12px rgba(0,245,212,.65), inset -4px -4px 8px rgba(0,0,0,.5);"></div>' +
            '<span>Çekim</span>' +
            '<small>Hasar: Çift Çöküşü<br>Güç: Kara Delik</small>';

        card.addEventListener('click', () => {
            selectedCharacter = CHAR; // ana kodun let değişkeni (canlı atama)
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });

        cont.appendChild(card);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectCard);
    else injectCard();
    setTimeout(injectCard, 120); // DOM geç hazırlanırsa bir kez daha dene

    // ==========================================================================
    // 4) PLAYER YAMALARI (prototip üzerinden — örnek ana koddan önce yaratıldı
    //    ama metotlar çağrı anında prototipten çözüldüğü için yama çalışır)
    // ==========================================================================

    function resetState() {
        S.bolts.length = 0; S.wells.length = 0; S.links.length = 0;
        S.pods.length = 0;  S.bubbles.length = 0; S.hPods.length = 0;
        S.holes.length = 0; S.waves.length = 0;
        clearGzAll();
    }

    // bot/bot2 nesneleri restart'ta YENİDEN KULLANILDIĞI için donma
    // bayrakları kalıcı olabilir; her sıfırlamada temizlenir.
    function clearGzAll() {
        try { enemies().forEach(e => { e.__gz = false; e.__gzB = null; }); } catch (err) {}
        try {
            [bot, bot2].forEach(e => { if (e) { e.__gz = false; e.__gzB = null; } });
            botBullets.forEach(b => { if (b) { b.__gz = false; b.__gzB = null; } });
        } catch (err) {}
    }

    // --- ANA SALDIRI ---
    function fireBolt(p, a, pullOverride) {
        if (p.isDead || p.ammo < 1) return;
        const pull = (pullOverride !== undefined) ? Math.max(0.15, Math.min(1, pullOverride)) : aimPull();
        const maxD = Math.max(90, BOLT_RANGE * pull);
        const ang  = (a !== undefined) ? a : p.angle;
        S.bolts.push({
            x: p.x, y: p.y, sx: p.x, sy: p.y,
            vx: Math.cos(ang) * BOLT_SPEED, vy: Math.sin(ang) * BOLT_SPEED,
            d: 0, maxD: maxD, r: 11
        });
        p.consumeAmmo();
        spawnParticles(p.x + Math.cos(ang) * 24, p.y + Math.sin(ang) * 24, C_CORE, 'normal');
    }

    // --- Kuyu kenetleme + Çift Çöküşü tetiği ---
    function anchorWell(x, y) {
        const c = inArena(x, y, 30);
        const w = { x: c.x, y: c.y, r: 20, life: WELL_LIFE, maxLife: WELL_LIFE, spin: Math.random() * 6.28, tick: 0 };
        wave(w.x, w.y, 6, 90, 14, C_BODY, 4);
        spawnParticles(w.x, w.y, C_BODY, 'normal');

        if (S.wells.length > 0) {
            const w0 = S.wells.shift();
            S.links.push({
                w1: w0, w2: w,
                mid: { x: (w0.x + w.x) / 2, y: (w0.y + w.y) / 2 },
                ax: w0.x, ay: w0.y, bx: w.x, by: w.y,
                phase: 'charge', t: 0
            });
            addFloatingNumber((w0.x + w.x) / 2, (w0.y + w.y) / 2 - 28, 'ÇİFT ÇÖKÜŞÜ!', C_GOLD);
            shake(6);
        } else {
            S.wells.push(w);
        }
    }

    function implode(L) {
        const m = L.mid;
        shake(18);
        wave(m.x, m.y, 10, 215, 18, C_GOLD, 9);
        wave(m.x, m.y, 4, 120, 13, C_CORE, 5);
        spawnParticles(m.x, m.y, C_CORE, 'smoke');
        spawnParticles(m.x, m.y, C_BODY, 'normal');
        let hits = 0;
        enemies().forEach(e => {
            const dm = D(m, e);
            const ds = segDist(e.x, e.y, L.ax, L.ay, L.bx, L.by);
            let dmg = 0;
            if (dm < IMPLODE_R + e.radius * 0.4) dmg += IMPLODE_CORE;
            if (ds < 60 + e.radius * 0.4) dmg += IMPLODE_LINE;
            if (dmg > 0) {
                e.hp -= dmg;
                addFloatingNumber(e.x, e.y, String(dmg), C_GOLD);
                const an = A(e, m); // içe vakum
                e.kbX = Math.cos(an) * 40; e.kbY = Math.sin(an) * 40;
                hits++;
            }
        });
        obstacles.concat(cactusWalls).forEach(o => { if (D(m, o) < IMPLODE_R && o.hp !== undefined) o.hp -= 400; });
        if (hits > 0) chargeUlt(Math.min(36, hits * 12));
        addFloatingNumber(m.x, m.y - 34, 'ÇÖKÜŞ!', C_GOLD);
    }

    // --- AKSESUAR 1: TERS POLARİTE ---
    function repulse(p) {
        if (!p.gadgetReady || p.isDead) return;
        const origins = [{ x: p.x, y: p.y }].concat(S.wells);
        let hits = 0;
        origins.forEach(o => {
            wave(o.x, o.y, 12, POL_R, 16, C_CORE, 7);
            enemies().forEach(e => {
                if (D(o, e) < POL_R + e.radius * 0.4) {
                    e.hp -= POL_DMG;
                    addFloatingNumber(e.x, e.y, String(POL_DMG), C_CORE);
                    const an = A(o, e);
                    e.kbX = Math.cos(an) * 75; e.kbY = Math.sin(an) * 75;
                    hits++;
                }
            });
            for (let i = botBullets.length - 1; i >= 0; i--) {
                const b = botBullets[i];
                if (b && D(o, b) < POL_R) {
                    spawnParticles(b.x, b.y, C_CORE, 'normal');
                    botBullets.splice(i, 1);
                }
            }
            obstacles.concat(cactusWalls).forEach(ob => { if (D(o, ob) < POL_R && ob.hp !== undefined) ob.hp -= 150; });
        });
        shake(12);
        addFloatingNumber(p.x, p.y - 34, 'TERS POLARİTE!', C_CORE);
        spawnParticles(p.x, p.y, C_CORE, 'smoke');
        if (hits > 0) chargeUlt(Math.min(20, hits * 5));
        p.gadgetReady = false;
        p.gadgetCooldown = 780; // 13 sn
        gadgetBtn.classList.remove('active');
        gadgetBtn.classList.add('cooldown');
    }

    // --- AKSESUAR 2: SIFIR ÇEKİM ALANI ---
    function throwZeroG(p, a, pull) {
        if (!p.gadget2Ready || p.isDead) return;
        const pm  = (pull !== undefined) ? Math.max(0.2, Math.min(1, pull)) : aimPull2();
        const ang = (a !== undefined) ? a : p.angle;
        const td  = Math.max(60, ZG_RANGE * pm);
        const t   = inArena(p.x + Math.cos(ang) * td, p.y + Math.sin(ang) * td, 24);
        S.pods.push({ x: p.x, y: p.y, sx: p.x, sy: p.y, tx: t.x, ty: t.y, prog: 0, dur: 30 });
        addFloatingNumber(p.x, p.y - 34, 'SIFIR ÇEKİM!', C_CORE);
        p.gadget2Ready = false;
        p.gadget2Cooldown = 1080; // 18 sn
        gadgetBtn2.classList.add('cooldown');
    }

    function releaseBubble(B) {
        botBullets.forEach(b => {
            if (b.__gzB === B) { b.vx = b.__gzVX; b.vy = b.__gzVY; b.__gz = false; b.__gzB = null; }
        });
        enemies().forEach(e => { if (e.__gzB === B) { e.__gz = false; e.__gzB = null; } });
        wave(B.x, B.y, B.r * 0.7, B.r * 1.1, 12, C_CORE, 3);
    }

    // --- ULTİ: KARA DELİK ---
    function launchHole(p, a, pull) {
        if (!p.ultReady || p.isDead) return;
        const pm  = (pull !== undefined && pull > 0.05) ? Math.max(0.2, Math.min(1, pull)) : ultPull();
        const ang = (a !== undefined) ? a : p.angle;
        const td  = Math.max(70, BH_THROW * pm);
        const t   = inArena(p.x + Math.cos(ang) * td, p.y + Math.sin(ang) * td, 30);
        S.hPods.push({ x: p.x, y: p.y, sx: p.x, sy: p.y, tx: t.x, ty: t.y, prog: 0, dur: 34 });
        p.ultReady = false; p.ultCharge = 0;
        if (ultFill) ultFill.style.width = '0%';
        ultiBtn.classList.remove('ready');
        addFloatingNumber(p.x, p.y - 40, 'OLAY UFKU ÇAĞRILDI!', C_GOLD);
        shake(8);
    }

    function supernova(H) {
        shake(24);
        wave(H.x, H.y, 20, H.r * 1.25, 20, C_GOLD, 11);
        wave(H.x, H.y, 10, H.r * 0.7, 14, C_CORE, 6);
        spawnParticles(H.x, H.y, C_GOLD, 'smoke');
        spawnParticles(H.x, H.y, C_CORE, 'normal');
        enemies().forEach(e => {
            if (D(H, e) < H.r * 1.05) {
                e.hp -= NOVA_DMG;
                addFloatingNumber(e.x, e.y, String(NOVA_DMG), C_GOLD);
                const an = A(H, e);
                e.kbX = Math.cos(an) * 85; e.kbY = Math.sin(an) * 85;
            }
        });
        obstacles.concat(cactusWalls).forEach(o => { if (D(H, o) < H.r && o.hp !== undefined) o.hp -= 500; });
        addFloatingNumber(H.x, H.y - 36, 'SÜPERNOVA!', C_GOLD);
        chargeUlt(20);
    }

    // --- Prototip yamaları: diğer karakterler orijinal davranışa düşer ---
    function patchPlayer() {
        if (Player.__mod9Patched) return;
        Player.__mod9Patched = true;

        const oSet = Player.prototype.setCharacter;
        Player.prototype.setCharacter = function (type) {
            oSet.call(this, type);
            if (type === CHAR) {
                this.reloadSpeed = 0.018;
                this.ammo = this.maxAmmo;
                this.gadgetReady = true; this.gadget2Ready = true;
                this.gadgetActive = false;
                this.gadgetCooldown = 0; this.gadget2Cooldown = 0;
                gadgetBtn.classList.remove('cooldown', 'active');
                gadgetBtn2.classList.remove('cooldown');
                // Etiketler BURADA yazılır: ana startGame, span'leri
                // (gadget-timer / gadget-timer-2) setCharacter'dan SONRA
                // yakaladığı için soğutma sayaçları doğru çalışır.
                gadgetBtn.innerHTML  = 'TERS<br>POLARİTE<br><span id="gadget-timer"></span>';
                gadgetBtn2.innerHTML = 'SIFIR<br>ÇEKİM<br><span id="gadget-timer-2"></span>';
                resetState();
            }
        };

        const oFire = Player.prototype.fire;
        Player.prototype.fire = function (a, pullOverride) {
            if (this.charType === CHAR) { fireBolt(this, a, pullOverride); return; }
            oFire.call(this, a, pullOverride);
        };

        const oG1 = Player.prototype.activateGadget;
        Player.prototype.activateGadget = function (a, pull) {
            if (this.charType === CHAR) { repulse(this); return; }
            oG1.call(this, a, pull);
        };

        const oG2 = Player.prototype.activateGadget2;
        Player.prototype.activateGadget2 = function (a, pull) {
            if (this.charType === CHAR) { throwZeroG(this, a, pull); return; }
            oG2.call(this, a, pull);
        };

        const oUlt = Player.prototype.fireUlti;
        Player.prototype.fireUlti = function (a, pull) {
            if (this.charType === CHAR) { launchHole(this, a, pull); return; }
            oUlt.call(this, a, pull);
        };
    }
    patchPlayer(); // ana script zaten çalıştı -> Player hazır

    // ==========================================================================
    // 5) MEKANİK GÜNCELLEME (kendi rAF döngümüz; ana update'ten sonra koşar)
    // ==========================================================================
    function mechanics(ts) {
        if (!gameStarted) return;

        // bot/bot2 nesneleri kalıcıdır: ölürlerse donma bayrağını düşür
        [bot, bot2].forEach(e => {
            if (e && e.__gz && (e.isDead || e.hp <= 0)) { e.__gz = false; e.__gzB = null; }
        });

        // --- A) Graviton okları ---
        for (let i = S.bolts.length - 1; i >= 0; i--) {
            const b = S.bolts[i];
            b.x += b.vx * ts; b.y += b.vy * ts;
            b.d += Math.hypot(b.vx, b.vy) * ts;

            let stop = false, ax = b.x, ay = b.y;

            for (const e of enemies()) {
                if (D(b, e) < e.radius + b.r) {
                    e.hp -= BOLT_DMG;
                    addFloatingNumber(e.x, e.y, String(BOLT_DMG), C_CORE);
                    spawnParticles(e.x, e.y, C_BODY, 'normal');
                    chargeUlt(8);
                    ax = e.x; ay = e.y; stop = true; break;
                }
            }
            if (!stop) {
                const obs = obstacles.concat(cactusWalls);
                for (const o of obs) {
                    if (D(b, o) < o.radius + b.r) {
                        if (o.hp !== undefined) { o.hp -= 200; addFloatingNumber(o.x, o.y, '200', C_CORE); }
                        stop = true; break;
                    }
                }
            }
            if (!stop && (b.x < WALL_THICKNESS + b.r || b.x > canvas.width - WALL_THICKNESS - b.r ||
                          b.y < WALL_THICKNESS + b.r || b.y > canvas.height - WALL_THICKNESS - b.r)) {
                stop = true;
            }
            if (stop || b.d >= b.maxD) { S.bolts.splice(i, 1); anchorWell(ax, ay); }
        }

        // --- B) Serbest kuyular: sürükle + DoT ---
        for (let i = S.wells.length - 1; i >= 0; i--) {
            const w = S.wells[i];
            w.life -= ts; w.spin += 0.05 * ts;
            if (w.life <= 0) { wave(w.x, w.y, w.r, 64, 12, C_BODY, 3); S.wells.splice(i, 1); continue; }
            w.tick += ts;
            const doTick = w.tick >= 60;
            if (doTick) w.tick = 0;
            enemies().forEach(e => {
                const d = D(w, e);
                if (d < WELL_PULL_R) {
                    const an = A(e, w);
                    const f = (1 - d / WELL_PULL_R) * 1.6 + 0.35;
                    e.x += Math.cos(an) * f * ts;
                    e.y += Math.sin(an) * f * ts;
                    e.hp -= (90 / 60) * ts;
                    if (doTick) addFloatingNumber(e.x, e.y, '90', C_BODY);
                }
            });
        }

        // --- C) Çift Çöküşü olayları ---
        for (let i = S.links.length - 1; i >= 0; i--) {
            const L = S.links[i];
            L.t += ts;
            if (L.phase === 'charge') {
                if (L.t >= 18) { L.phase = 'slam'; L.t = 0; }
                continue;
            }
            const spd = (14 + Math.min(18, L.t * 1.2)) * ts;
            ['w1', 'w2'].forEach(k => {
                const w = L[k];
                const d = D(w, L.mid);
                if (d > spd) { const an = A(w, L.mid); w.x += Math.cos(an) * spd; w.y += Math.sin(an) * spd; }
                else { w.x = L.mid.x; w.y = L.mid.y; }
            });
            if (D(L.w1, L.mid) < 16 && D(L.w2, L.mid) < 16) { implode(L); S.links.splice(i, 1); }
        }

        // --- D) Sıfır çekim kapsülleri ---
        for (let i = S.pods.length - 1; i >= 0; i--) {
            const p = S.pods[i];
            p.prog += ts / p.dur;
            if (p.prog >= 1) {
                S.bubbles.push({ x: p.tx, y: p.ty, r: ZG_R, timer: ZG_LIFE, maxTimer: ZG_LIFE, tick: 0 });
                wave(p.tx, p.ty, 10, ZG_R, 16, C_CORE, 5);
                spawnParticles(p.tx, p.ty, C_CORE, 'smoke');
                addFloatingNumber(p.tx, p.ty - 24, 'SIFIR ÇEKİM ALANI!', C_CORE);
                S.pods.splice(i, 1);
            } else {
                p.x = p.sx + (p.tx - p.sx) * p.prog;
                p.y = p.sy + (p.ty - p.sy) * p.prog;
            }
        }

        // --- E) Sıfır çekim kubbeleri: dondurma ---
        for (let i = S.bubbles.length - 1; i >= 0; i--) {
            const B = S.bubbles[i];
            B.timer -= ts;
            if (B.timer <= 0) { releaseBubble(B); S.bubbles.splice(i, 1); continue; }
            B.tick += ts;
            const doTick = B.tick >= 30;
            if (doTick) B.tick = 0;

            enemies().forEach(e => {
                if (D(B, e) < B.r) {
                    // (yeniden) yakalama: farklı kubbe / ölüm-sonrası dönüş durumunda taze konum kaydet
                    if (e.__gzB !== B) { e.__gz = true; e.__gzX = e.x; e.__gzY = e.y; e.__gzB = B; }
                    e.x = e.__gzX; e.y = e.__gzY;      // konum kilidi
                    e.kbX = 0; e.kbY = 0;               // savurma yok
                    e.lastShot = Date.now() + 900;      // ateş edemez
                    if (e.isNest) e.lastSpawn = Date.now(); // yuva üretemez
                    if (doTick) { e.hp -= 60; addFloatingNumber(e.x, e.y, '60', C_CORE); }
                } else if (e.__gz && e.__gzB === B) {
                    e.__gz = false; e.__gzB = null;
                }
            });

            for (let j = botBullets.length - 1; j >= 0; j--) {
                const b = botBullets[j];
                if (!b) continue;
                if (D(B, b) < B.r) {
                    if (!b.__gz) { b.__gz = true; b.__gzVX = b.vx; b.__gzVY = b.vy; b.__gzB = B; }
                    b.vx = 0; b.vy = 0; // mermi havada asılı kalır
                }
            }
        }

        // --- F) Kara delik kapsülleri ---
        for (let i = S.hPods.length - 1; i >= 0; i--) {
            const p = S.hPods[i];
            p.prog += ts / p.dur;
            if (p.prog >= 1) {
                S.holes.push({ x: p.tx, y: p.ty, r: BH_R, timer: BH_LIFE, maxTimer: BH_LIFE, tick: 0 });
                shake(16);
                wave(p.tx, p.ty, 12, BH_R * 0.9, 18, C_BODY, 6);
                spawnParticles(p.tx, p.ty, C_BODY, 'smoke');
                addFloatingNumber(p.tx, p.ty - 26, 'KARA DELİK!', C_GOLD);
                S.hPods.splice(i, 1);
            } else {
                p.x = p.sx + (p.tx - p.sx) * p.prog;
                p.y = p.sy + (p.ty - p.sy) * p.prog;
            }
        }

        // --- G) Kara delik etkisi ---
        for (let i = S.holes.length - 1; i >= 0; i--) {
            const H = S.holes[i];
            H.timer -= ts; H.tick += ts;
            const doTick = H.tick >= 30;
            if (doTick) H.tick = 0;

            let healed = 0;
            enemies().forEach(e => {
                const d = D(H, e);
                if (d < H.r) {
                    const an = A(e, H);
                    const f = (1 - d / H.r) * 5.5 + 1.2;
                    e.x += Math.cos(an) * f * ts;
                    e.y += Math.sin(an) * f * ts;
                    if (doTick) { e.hp -= 160; addFloatingNumber(e.x, e.y, '160', C_BODY); healed += 30; }
                }
            });
            if (doTick && healed > 0 && player.charType === CHAR && !player.isDead) {
                const h = Math.min(150, healed);
                player.hp = Math.min(player.maxHp, player.hp + h);
                addFloatingNumber(player.x, player.y, '+' + h, C_CORE);
            }

            for (let j = botBullets.length - 1; j >= 0; j--) {
                const b = botBullets[j];
                if (b && D(H, b) < H.r * 0.92) {
                    if (Math.random() < 0.35) spawnParticles(b.x, b.y, C_BODY, 'normal');
                    botBullets.splice(j, 1);
                }
            }

            if (H.timer <= 0) { supernova(H); S.holes.splice(i, 1); }
        }

        // --- H) Şok halkaları ---
        for (let i = S.waves.length - 1; i >= 0; i--) {
            const w = S.waves[i];
            w.life -= ts;
            if (w.life <= 0) { S.waves.splice(i, 1); continue; }
            w.r = w.r0 + (w.maxR - w.r0) * (1 - w.life / w.maxLife);
        }
    }

    // ==========================================================================
    // 6) MOBİL UI GÜVENCESİ
    // Ana kod startGame içinde ulti/aksesuar butonlarını yalnızca yerleşik 4
    // karakter için gösteriyor ('cekim' else dalında gizlenir). Bu döngü her
    // karede butonları geri açar — dokunmatik kontroller böylece garantili.
    // ==========================================================================
    function enforceUI() {
        if (!gameStarted || player.charType !== CHAR) return;
        if (ultiBtn.style.display !== 'flex')    ultiBtn.style.display = 'flex';
        if (gadgetBtn.style.display !== 'flex')  gadgetBtn.style.display = 'flex';
        if (gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';
        if (ultFill) ultFill.style.width = (player.ultCharge || 0) + '%';
        if (player.ultReady) ultiBtn.classList.add('ready');
    }

    // ==========================================================================
    // 7) ÇİZİM (hooks.onDraw — ana draw() bittikten sonra her kare çağrılır)
    // ==========================================================================
    function drawAll(c) {
        if (!gameStarted) return;
        const now = Date.now();
        const isCekim = player.charType === CHAR;

        // --- Sıfır çekim kubbeleri ---
        S.bubbles.forEach(B => {
            c.save(); c.translate(B.x, B.y);
            const a = Math.min(1, B.timer / 40);
            c.globalAlpha = a;
            c.beginPath(); c.arc(0, 0, B.r, 0, Math.PI * 2);
            c.fillStyle = 'rgba(142,68,173,0.12)'; c.fill();
            c.setLineDash([14, 9]); c.lineDashOffset = -now / 40;
            c.strokeStyle = C_CORE; c.lineWidth = 3; c.stroke();
            c.setLineDash([6, 12]); c.lineDashOffset = now / 60;
            c.strokeStyle = 'rgba(190,120,255,0.8)'; c.lineWidth = 2;
            c.beginPath(); c.arc(0, 0, B.r * 0.72, 0, Math.PI * 2); c.stroke();
            c.setLineDash([]);
            // süre göstergesi
            c.beginPath();
            c.arc(0, 0, B.r + 7, -Math.PI / 2, -Math.PI / 2 + (B.timer / B.maxTimer) * Math.PI * 2);
            c.strokeStyle = 'rgba(241,196,15,0.7)'; c.lineWidth = 3; c.stroke();
            // içeride süzülen kıvılcımlar
            for (let k = 0; k < 6; k++) {
                const ang = now / 900 + k * Math.PI / 3;
                const rr = B.r * (0.3 + 0.14 * Math.sin(now / 500 + k * 2));
                c.beginPath(); c.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, 2.5, 0, Math.PI * 2);
                c.fillStyle = C_CORE; c.fill();
            }
            c.restore();
        });

        // --- Donmuş düşman halkaları ---
        if (S.bubbles.length) {
            enemies().forEach(e => {
                if (!e.__gz) return;
                c.save(); c.translate(e.x, e.y);
                c.rotate(now / 700);
                c.setLineDash([5, 5]);
                c.beginPath(); c.arc(0, 0, e.radius + 8, 0, Math.PI * 2);
                c.strokeStyle = 'rgba(0,245,212,0.9)'; c.lineWidth = 2.5; c.stroke();
                c.setLineDash([]);
                c.restore();
            });
        }

        // --- Kara delikler ---
        S.holes.forEach(H => {
            c.save(); c.translate(H.x, H.y);
            const g = c.createRadialGradient(0, 0, 8, 0, 0, H.r);
            g.addColorStop(0, 'rgba(0,0,0,0.96)');
            g.addColorStop(0.22, 'rgba(40,8,70,0.85)');
            g.addColorStop(0.55, 'rgba(142,68,173,0.35)');
            g.addColorStop(0.85, 'rgba(0,245,212,0.14)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            c.beginPath(); c.arc(0, 0, H.r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
            // akresyon diskleri
            c.rotate(now / 300);
            c.setLineDash([26, 18, 6, 14]);
            c.beginPath(); c.arc(0, 0, H.r * 0.5, 0, Math.PI * 2);
            c.strokeStyle = 'rgba(0,245,212,0.8)'; c.lineWidth = 4; c.stroke();
            c.rotate(-now / 140);
            c.setLineDash([10, 22]);
            c.beginPath(); c.arc(0, 0, H.r * 0.32, 0, Math.PI * 2);
            c.strokeStyle = 'rgba(241,196,15,0.75)'; c.lineWidth = 3; c.stroke();
            c.setLineDash([]);
            // olay ufku çekirdeği
            c.beginPath(); c.arc(0, 0, 30, 0, Math.PI * 2);
            c.strokeStyle = C_GOLD; c.lineWidth = 3; c.stroke();
            c.beginPath(); c.arc(0, 0, 23, 0, Math.PI * 2);
            c.fillStyle = '#04030a'; c.shadowColor = C_CORE; c.shadowBlur = 18; c.fill();
            c.shadowBlur = 0;
            // süre göstergesi
            c.beginPath();
            c.arc(0, 0, H.r * 0.82, -Math.PI / 2, -Math.PI / 2 + (H.timer / H.maxTimer) * Math.PI * 2);
            c.strokeStyle = 'rgba(241,196,15,0.45)'; c.lineWidth = 4; c.stroke();
            c.restore();
        });

        // --- Kütle kuyuları ---
        const drawWell = (w, alpha) => {
            c.save(); c.translate(w.x, w.y); c.globalAlpha = alpha;
            c.setLineDash([6, 7]); c.lineDashOffset = now / 60;
            c.beginPath(); c.arc(0, 0, WELL_PULL_R, 0, Math.PI * 2);
            c.strokeStyle = 'rgba(0,245,212,0.28)'; c.lineWidth = 1.5; c.stroke();
            c.setLineDash([]);
            // içe akan girdap kolları
            c.rotate(w.spin);
            for (let k = 0; k < 3; k++) {
                c.beginPath();
                c.arc(0, 0, w.r + 12, k * 2.094, k * 2.094 + 1.2);
                c.strokeStyle = 'rgba(0,245,212,0.65)'; c.lineWidth = 3; c.stroke();
            }
            c.beginPath(); c.arc(0, 0, w.r, 0, Math.PI * 2);
            c.fillStyle = C_BODY; c.fill();
            c.strokeStyle = C_CORE; c.lineWidth = 3; c.stroke();
            c.beginPath(); c.arc(0, 0, 8, 0, Math.PI * 2);
            c.fillStyle = '#120a1e'; c.shadowColor = C_CORE; c.shadowBlur = 10; c.fill();
            c.restore();
        };
        S.wells.forEach(w => drawWell(w, Math.min(1, w.life / 45)));

        // --- Çift Çöküşü: hat + çarpışan kuyular ---
        S.links.forEach(L => {
            c.save();
            const charging = L.phase === 'charge';
            const pulse = charging ? (0.45 + 0.55 * Math.abs(Math.sin(now / 60))) : 1;
            c.beginPath(); c.moveTo(L.w1.x, L.w1.y); c.lineTo(L.w2.x, L.w2.y);
            c.strokeStyle = `rgba(0,245,212,${0.85 * pulse})`;
            c.lineWidth = charging ? 3 + 3 * Math.abs(Math.sin(now / 50)) : 7;
            c.shadowColor = C_CORE; c.shadowBlur = 14; c.stroke();
            c.shadowBlur = 0;
            // orta nokta hedefi
            const mr = charging ? 14 + 8 * Math.abs(Math.sin(now / 90)) : 20 + L.t;
            c.beginPath(); c.arc(L.mid.x, L.mid.y, Math.min(46, mr), 0, Math.PI * 2);
            c.strokeStyle = C_GOLD; c.lineWidth = 3; c.stroke();
            c.beginPath(); c.arc(L.mid.x, L.mid.y, 4, 0, Math.PI * 2);
            c.fillStyle = C_GOLD; c.fill();
            c.restore();
            drawWell(L.w1, 1); drawWell(L.w2, 1);
        });

        // --- Havadaki graviton okları ---
        S.bolts.forEach(b => {
            c.save(); c.translate(b.x, b.y);
            c.beginPath(); c.arc(0, 0, b.r + 5, 0, Math.PI * 2);
            c.strokeStyle = 'rgba(0,245,212,0.5)'; c.lineWidth = 2; c.stroke();
            c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI * 2);
            c.fillStyle = C_BODY; c.shadowColor = C_CORE; c.shadowBlur = 12; c.fill();
            c.shadowBlur = 0;
            c.beginPath(); c.arc(0, 0, 4.5, 0, Math.PI * 2);
            c.fillStyle = C_CORE; c.fill();
            c.restore();
        });

        // --- Yay çizen kapsüller (sıfır çekim + kara delik) ---
        const drawPod = (p, core, ring) => {
            const h = Math.sin(p.prog * Math.PI);
            c.save();
            c.beginPath(); c.ellipse(p.x, p.y, 12, 5, 0, 0, Math.PI * 2);
            c.fillStyle = `rgba(0,0,0,${0.32 * (1 - h * 0.5)})`; c.fill();
            c.translate(p.x, p.y - h * 48);
            const sc = 1 + h * 0.5; c.scale(sc, sc);
            c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2);
            c.fillStyle = core; c.shadowColor = core; c.shadowBlur = 12; c.fill();
            c.shadowBlur = 0;
            c.strokeStyle = ring; c.lineWidth = 3; c.stroke();
            c.restore();
        };
        S.pods.forEach(p => drawPod(p, C_BODY, C_CORE));
        S.hPods.forEach(p => drawPod(p, '#2b0b49', C_GOLD));

        // --- Şok halkaları ---
        S.waves.forEach(w => {
            const a = Math.max(0, w.life / w.maxLife);
            c.save(); c.globalAlpha = a;
            c.beginPath(); c.arc(w.x, w.y, w.r, 0, Math.PI * 2);
            c.strokeStyle = w.color; c.lineWidth = w.width * a + 1; c.stroke();
            c.restore();
        });

        if (!isCekim || player.isDead) return;

        // --- Oyuncu yörünge halkası (kimlik görseli; iz bırakmaz) ---
        c.save(); c.translate(player.x, player.y);
        for (let k = 0; k < 3; k++) {
            const ang = now / 420 + k * (Math.PI * 2 / 3);
            c.beginPath();
            c.arc(Math.cos(ang) * 30, Math.sin(ang) * 30, 4, 0, Math.PI * 2);
            c.fillStyle = [C_CORE, C_BODY, C_GOLD][k]; c.fill();
        }
        c.beginPath(); c.arc(0, 0, 30, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(0,245,212,0.18)'; c.lineWidth = 1.5; c.stroke();
        c.restore();

        // --- ANA SALDIRI nişan önizlemesi (+ çöküş hattı önizlemesi) ---
        if (aimData.active && player.ammo >= 1) {
            const pull = aimPull();
            const td = Math.max(90, BOLT_RANGE * pull);
            const tx = player.x + Math.cos(aimData.angle) * td;
            const ty = player.y + Math.sin(aimData.angle) * td;
            c.save();
            c.setLineDash([6, 6]);
            c.beginPath(); c.moveTo(player.x, player.y); c.lineTo(tx, ty);
            c.strokeStyle = 'rgba(0,245,212,0.45)'; c.lineWidth = 2; c.stroke();
            c.setLineDash([]);
            c.beginPath(); c.arc(tx, ty, 22, 0, Math.PI * 2);
            c.fillStyle = 'rgba(142,68,173,0.25)'; c.fill();
            c.strokeStyle = C_CORE; c.lineWidth = 2; c.stroke();
            c.beginPath(); c.arc(tx, ty, 4, 0, Math.PI * 2);
            c.fillStyle = C_CORE; c.fill();
            // sahada kuyu varsa ÇÖKÜŞ önizlemesi: hat + orta nokta
            if (S.wells.length === 1) {
                const w0 = S.wells[0];
                const mx = (w0.x + tx) / 2, my = (w0.y + ty) / 2;
                c.setLineDash([4, 5]);
                c.beginPath(); c.moveTo(w0.x, w0.y); c.lineTo(tx, ty);
                c.strokeStyle = 'rgba(241,196,15,0.65)'; c.lineWidth = 3; c.stroke();
                c.setLineDash([]);
                const pr = 13 + 4 * Math.sin(now / 110);
                c.beginPath(); c.arc(mx, my, pr, 0, Math.PI * 2);
                c.fillStyle = 'rgba(241,196,15,0.25)'; c.fill();
                c.strokeStyle = C_GOLD; c.lineWidth = 2; c.stroke();
                c.fillStyle = 'rgba(241,196,15,0.95)';
                c.font = 'bold 11px Arial'; c.textAlign = 'center';
                c.fillText('ÇÖKÜŞ', mx, my - pr - 6);
            }
            c.restore();
        }

        // --- AKSESUAR 2 nişan önizlemesi ---
        if (gadAim2.active && player.gadget2Ready) {
            const pm = aimPull2();
            const td = Math.max(60, ZG_RANGE * pm);
            const tx = player.x + Math.cos(gadAim2.angle) * td;
            const ty = player.y + Math.sin(gadAim2.angle) * td;
            c.save();
            c.setLineDash([5, 5]);
            c.beginPath(); c.moveTo(player.x, player.y); c.lineTo(tx, ty);
            c.strokeStyle = 'rgba(0,245,212,0.5)'; c.lineWidth = 2; c.stroke();
            c.beginPath(); c.arc(tx, ty, ZG_R, 0, Math.PI * 2);
            c.fillStyle = 'rgba(0,245,212,0.08)'; c.fill();
            c.setLineDash([]);
            c.strokeStyle = 'rgba(0,245,212,0.65)'; c.lineWidth = 2; c.stroke();
            c.restore();
        }

        // --- ULTİ nişan önizlemesi ---
        if (ultAim.active && player.ultReady) {
            const pm = ultPull();
            const td = Math.max(70, BH_THROW * pm);
            const tx = player.x + Math.cos(ultAim.angle) * td;
            const ty = player.y + Math.sin(ultAim.angle) * td;
            c.save();
            c.setLineDash([8, 8]);
            c.beginPath(); c.moveTo(player.x, player.y); c.lineTo(tx, ty);
            c.strokeStyle = 'rgba(241,196,15,0.55)'; c.lineWidth = 3; c.stroke();
            c.beginPath(); c.arc(tx, ty, BH_R, 0, Math.PI * 2);
            c.fillStyle = 'rgba(74,20,140,0.16)'; c.fill();
            c.setLineDash([]);
            c.strokeStyle = 'rgba(241,196,15,0.8)'; c.lineWidth = 2.5; c.stroke();
            c.fillStyle = 'rgba(241,196,15,0.95)';
            c.font = 'bold 12px Arial'; c.textAlign = 'center';
            c.fillText('KARA DELİK', tx, ty - BH_R - 8);
            c.restore();
        }
    }

    // ==========================================================================
    // 8) HOOK ZİNCİRLERİ (başka modların hook'larını ezmeden)
    // ==========================================================================
    const prevOnDraw = window.GAME_EXT.hooks.onDraw;
    window.GAME_EXT.hooks.onDraw = function (c) {
        if (typeof prevOnDraw === 'function') { try { prevOnDraw(c); } catch (e) {} }
        try { drawAll(c); } catch (e) { if (window.console) console.error('mod9 draw:', e); }
    };

    const prevOnReset = window.GAME_EXT.hooks.onReset;
    window.GAME_EXT.hooks.onReset = function () {
        if (typeof prevOnReset === 'function') { try { prevOnReset(); } catch (e) {} }
        resetState();
    };

    const prevOnKill = window.GAME_EXT.hooks.onEnemyKilled;
    window.GAME_EXT.hooks.onEnemyKilled = function (enemy) {
        if (typeof prevOnKill === 'function') { try { prevOnKill(enemy); } catch (e) {} }
        if (player.charType === CHAR) chargeUlt(15);
    };

    // ==========================================================================
    // 9) MOD DÖNGÜSÜ
    // ==========================================================================
    let lastT = 0;
    function modLoop(t) {
        requestAnimationFrame(modLoop);
        if (!lastT) { lastT = t; return; }
        const ts = Math.min(3, (t - lastT) / 16.666);
        lastT = t;
        try {
            enforceUI();
            mechanics(ts);
        } catch (e) {
            if (window.console) console.error('mod9 loop:', e);
        }
    }
    requestAnimationFrame(modLoop);

    if (window.console) console.log('%c MOD9 hazır: ÇEKİM (Kütleçekim Mimarı) ', 'background:#8e44ad;color:#00f5d4;font-weight:bold;border-radius:4px');
})();
