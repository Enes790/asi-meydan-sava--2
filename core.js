// ========== core.js (MERKEZİ KAYIT VE OLAY SİSTEMİ) ==========
// Modüller ana oyunu ezmeden çalışır.
// Bu sürüm korku modundan arındırılmıştır.
// Mevcut tüm modlarla uyumludur.

(function () {
    'use strict';

    // GAME_EXT objesini garanti altına al
    window.GAME_EXT = window.GAME_EXT || { modes: {}, characters: {}, hooks: {} };
    window.GAME_EXT.hooks = window.GAME_EXT.hooks || {};

    // ========== MOD KAYIT ==========
    window.GAME_EXT.registerMode = function (id, modObj) {
        if (!modObj || typeof modObj !== 'object') {
            console.warn('registerMode: Geçersiz mod objesi:', id);
            return;
        }
        if (window.GAME_EXT.modes[id]) {
            console.warn('registerMode: "' + id + '" zaten kayıtlı, üzerine yazılıyor.');
        }
        window.GAME_EXT.modes[id] = modObj;
    };

    // ========== KARAKTER KAYIT ==========
    window.GAME_EXT.registerCharacter = function (id, stats) {
        if (!stats || typeof stats !== 'object') {
            console.warn('registerCharacter: Geçersiz karakter özellikleri:', id);
            return;
        }
        if (window.GAME_EXT.characters[id]) {
            console.warn('registerCharacter: "' + id + '" zaten kayıtlı, üzerine yazılıyor.');
        }
        window.GAME_EXT.characters[id] = stats;
    };

    // ========== OLAY YAYINLAMA ==========
    window.GAME_EXT.emit = function (eventName, data) {
        const handlers = window.GAME_EXT._eventHandlers && window.GAME_EXT._eventHandlers[eventName];
        if (handlers) {
            for (const handler of handlers) {
                try { handler(data); }
                catch (e) { console.error('Olay işleyici hatası (' + eventName + '):', e); }
            }
        }
    };

    // ========== OLAY DİNLEME ==========
    window.GAME_EXT.on = function (eventName, callback) {
        if (!window.GAME_EXT._eventHandlers) window.GAME_EXT._eventHandlers = {};
        if (!window.GAME_EXT._eventHandlers[eventName]) window.GAME_EXT._eventHandlers[eventName] = [];
        window.GAME_EXT._eventHandlers[eventName].push(callback);
        return function () {
            const arr = window.GAME_EXT._eventHandlers[eventName];
            if (arr) {
                const idx = arr.indexOf(callback);
                if (idx > -1) arr.splice(idx, 1);
            }
        };
    };

    // ========== ZİNCİRLEME HOOK YARDIMCISI ==========
    window.GAME_EXT.chainHook = function (hookName, fn) {
        if (!window.GAME_EXT.hooks) window.GAME_EXT.hooks = {};
        const prev = window.GAME_EXT.hooks[hookName];
        window.GAME_EXT.hooks[hookName] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') {
                return !!prevResult || !!ownResult;
            }
            return ownResult !== undefined ? ownResult : prevResult;
        };
    };

    // ========== MOD KARTI EKLEME ==========
    window.GAME_EXT.modKartiEkle = function (id, baslik, aciklama) {
        const track = document.getElementById('difficulty-track');
        if (!track) {
            console.warn('modKartiEkle: difficulty-track bulunamadı. Mod:', id);
            return;
        }
        if (document.getElementById('diff-' + id)) return;
        const card = document.createElement('div');
        card.className = 'diff-card';
        card.id = 'diff-' + id;
        card.style.flex = '0 0 auto';
        card.style.width = 'min(76vw,300px)';
        card.style.margin = '5px auto';
        card.style.padding = '15px 10px';
        card.innerHTML = '<span>' + baslik + '</span><small>' + aciklama + '</small>';
        track.appendChild(card);
        const secFn = () => {
            document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            window.GAME_MODE = id;
        };
        card.addEventListener('click', secFn);
        card.addEventListener('touchstart', secFn, { passive: true });
        console.log('[MOD KARTI] ' + id + ' eklendi.');
    };

    // ========== ÇİZİM SARMALAYICI ==========
    function wrapDrawFunction() {
        if (typeof window.draw !== 'function') {
            console.warn('core.js: window.draw bulunamadı.');
            return;
        }
        const originalDraw = window.draw;
        window.draw = function () {
            if (typeof window.GAME_EXT.hooks.onPreDraw === 'function') window.GAME_EXT.hooks.onPreDraw(ctx);
            originalDraw();
            if (typeof window.GAME_EXT.hooks.onAimDraw === 'function') window.GAME_EXT.hooks.onAimDraw(ctx);
            if (typeof window.GAME_EXT.hooks.onDraw === 'function') window.GAME_EXT.hooks.onDraw(ctx);
            if (typeof window.GAME_EXT.hooks.onPostDraw === 'function') window.GAME_EXT.hooks.onPostDraw(ctx);
        };
        console.log('core.js: window.draw sarmalayıcısı kuruldu.');
    }

    // ========== GÜNCELLEME SARMALAYICI ==========
    function wrapUpdateFunction() {
        if (typeof window.update !== 'function') {
            console.warn('core.js: window.update bulunamadı.');
            return;
        }
        const originalUpdate = window.update;
        window.update = function (ts) {
            originalUpdate(ts);
            if (typeof window.GAME_EXT.hooks.onUpdate === 'function') {
                window.GAME_EXT.hooks.onUpdate(ts);
            }
        };
        console.log('core.js: window.update sarmalayıcısı kuruldu.');
    }

    // ========== ULTİ DOLDURMA SARMALAYICI ==========
    function wrapChargeUltiFunction() {
        if (typeof window.chargeUlti !== 'function') {
            console.warn('core.js: window.chargeUlti bulunamadı.');
            return;
        }
        const originalChargeUlti = window.chargeUlti;
        window.chargeUlti = function (amount) {
            originalChargeUlti(amount);
            if (typeof window.GAME_EXT.hooks.onChargeUlti === 'function') {
                window.GAME_EXT.hooks.onChargeUlti(amount);
            }
        };
        console.log('core.js: window.chargeUlti sarmalayıcısı kuruldu.');
    }

    // ========== Varsayılan Hook'lar ==========
    const varsayilanHooklar = [
        'onPreDraw', 'onAimDraw', 'onDraw', 'onPostDraw',
        'onUpdate', 'onChargeUlti', 'onReset',
        'getExtraEnemies', 'getBotTarget', 'getEngageDistance',
        'getExtraTargets', 'onEnemyKilled', 'onObstacleTick',
        'onBotSpawnTick', 'checkGameOver'
    ];
    varsayilanHooklar.forEach(h => {
        window.GAME_EXT.hooks[h] = window.GAME_EXT.hooks[h] || function () {};
    });

    wrapDrawFunction();
    wrapUpdateFunction();
    wrapChargeUltiFunction();

    console.log('core.js yüklendi: Merkezi kayıt ve olay sistemi hazır.');
})();