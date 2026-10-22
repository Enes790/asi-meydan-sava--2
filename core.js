// ========== core.js (MERKEZİ KAYIT VE OLAY SİSTEMİ) ==========
(function () {
    'use strict';

    window.GAME_EXT = window.GAME_EXT || { modes: {}, characters: {}, hooks: {} };
    window.GAME_EXT.hooks = window.GAME_EXT.hooks || {};

    window.GAME_EXT.registerMode = function (id, modObj) {
        if (!modObj || typeof modObj !== 'object') { console.warn('registerMode:', id); return; }
        if (window.GAME_EXT.modes[id]) console.warn('registerMode: "' + id + '" zaten kayıtlı.');
        window.GAME_EXT.modes[id] = modObj;
    };
    window.GAME_EXT.registerCharacter = function (id, stats) {
        if (!stats || typeof stats !== 'object') { console.warn('registerCharacter:', id); return; }
        if (window.GAME_EXT.characters[id]) console.warn('registerCharacter: "' + id + '" zaten kayıtlı.');
        window.GAME_EXT.characters[id] = stats;
    };
    window.GAME_EXT.emit = function (eventName, data) {
        const handlers = window.GAME_EXT._eventHandlers && window.GAME_EXT._eventHandlers[eventName];
        if (handlers) for (const h of handlers) { try { h(data); } catch (e) { console.error(eventName, e); } }
    };
    window.GAME_EXT.on = function (eventName, callback) {
        if (!window.GAME_EXT._eventHandlers) window.GAME_EXT._eventHandlers = {};
        if (!window.GAME_EXT._eventHandlers[eventName]) window.GAME_EXT._eventHandlers[eventName] = [];
        window.GAME_EXT._eventHandlers[eventName].push(callback);
        return function () {
            const arr = window.GAME_EXT._eventHandlers[eventName];
            if (arr) { const i = arr.indexOf(callback); if (i > -1) arr.splice(i, 1); }
        };
    };
    window.GAME_EXT.chainHook = function (hookName, fn) {
        if (!window.GAME_EXT.hooks) window.GAME_EXT.hooks = {};
        const prev = window.GAME_EXT.hooks[hookName];
        window.GAME_EXT.hooks[hookName] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') return !!prevResult || !!ownResult;
            return ownResult !== undefined ? ownResult : prevResult;
        };
    };
    window.GAME_EXT.modKartiEkle = function (id, baslik, aciklama) {
        const track = document.getElementById('difficulty-track');
        if (!track) { console.warn('modKartiEkle:', id); return; }
        if (document.getElementById('diff-' + id)) return;
        const card = document.createElement('div');
        card.className = 'diff-card';
        card.id = 'diff-' + id;
        card.style.cssText = 'flex:0 0 auto;width:min(76vw,300px);margin:5px auto;padding:15px 10px;';
        card.innerHTML = '<span>' + baslik + '</span><small>' + aciklama + '</small>';
        track.appendChild(card);
        const secFn = (e) => {
            if (e) e.preventDefault();
            document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            window.GAME_MODE = id;
        };
        card.addEventListener('click', secFn);
        card.addEventListener('touchstart', secFn, { passive: false });
    };

    function wrapDrawFunction() {
        if (typeof window.draw !== 'function') { console.warn('core.js: window.draw bulunamadı.'); return; }
        const originalDraw = window.draw;
        window.draw = function () {
            if (typeof window.GAME_EXT.hooks.onPreDraw === 'function') window.GAME_EXT.hooks.onPreDraw(ctx);
            originalDraw();
            if (typeof window.GAME_EXT.hooks.onAimDraw === 'function') window.GAME_EXT.hooks.onAimDraw(ctx);
            if (typeof window.GAME_EXT.hooks.onDraw === 'function') window.GAME_EXT.hooks.onDraw(ctx);
            if (typeof window.GAME_EXT.hooks.onPostDraw === 'function') window.GAME_EXT.hooks.onPostDraw(ctx);
        };
    }
    function wrapUpdateFunction() {
        if (typeof window.update !== 'function') { console.warn('core.js: window.update bulunamadı.'); return; }
        const originalUpdate = window.update;
        window.update = function (ts) {
            originalUpdate(ts);
            if (typeof window.GAME_EXT.hooks.onUpdate === 'function') window.GAME_EXT.hooks.onUpdate(ts);
        };
    }
    function wrapChargeUltiFunction() {
        if (typeof window.chargeUlti !== 'function') { console.warn('core.js: window.chargeUlti bulunamadı.'); return; }
        const originalChargeUlti = window.chargeUlti;
        window.chargeUlti = function (amount) {
            originalChargeUlti(amount);
            if (typeof window.GAME_EXT.hooks.onChargeUlti === 'function') window.GAME_EXT.hooks.onChargeUlti(amount);
        };
    }

    // ==== KRİTİK DÜZELTME ====
    // Getter hook'ları (getBotTarget, getEngageDistance, getExtraEnemies,
    // getExtraTargets, checkGameOver) BURADA TANIMLANMAMALI. Base kodda
    // "typeof === 'function'" guard'ı ile kontrol ediliyor; boş fonksiyon
    // tanımlarsak guard'ı atlatır, undefined döner ve base mantığı bozulur
    // (özellikle getEngageDistance → botlar hiç hareket etmez/ateş etmez).
    const varsayilanHooklar = [
        'onPreDraw', 'onAimDraw', 'onDraw', 'onPostDraw',
        'onUpdate', 'onChargeUlti', 'onReset',
        'onEnemyKilled', 'onObstacleTick', 'onBotSpawnTick'
    ];
    varsayilanHooklar.forEach(h => {
        window.GAME_EXT.hooks[h] = window.GAME_EXT.hooks[h] || function () {};
    });

    wrapDrawFunction();
    wrapUpdateFunction();
    wrapChargeUltiFunction();

    console.log('core.js yüklendi.');
})();