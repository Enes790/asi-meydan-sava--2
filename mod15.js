// ========== mod30.js (KISKAÇ) - v4 SİNEMATİK ==========
(function () {
    'use strict';

    const CHAR_ID = 'kiskac';
    const C_MAIN = '#d35400';
    const C_DARK = '#2c3e50';
    const C_ACCENT = '#e67e22';
    const C_LIGHT = '#f5b041';
    const C_WHITE = '#ffffff';
    const C_HEAL = '#2ecc71';
    
    const CHAR_HP = 2600;
    const CHAR_SPEED = 3.8;
    
    // ===== ANA SALDIRI =====
    const BULLET_DMG = 300;
    const BULLET_BONUS_DMG = 450;
    const BULLET_HEAL = 100;
    const BULLET_SPEED = PLAYER_BULLET_SPEED * 0.95;
    const BULLET_RANGE = 195;
    const BULLET_OFFSET = 12;
    const RELOAD_SPEED = 0.015;
    const SIPER_HASAR = 60;

    // ===== KANCA =====
    const HOOK_SPEED = 25;
    const HOOK_RANGE = 180;
    const HOOK_BOT_DMG = 350;
    const HOOK_SIPER_DMG = 1000;
    const HOOK_PULL_SPEED = 25;
    const HOOK_CD = 540; // 9s

    // ===== KUM FIRTINASI =====
    const STORM_DMG = 300;
    const STORM_PUSH = 10;
    const STORM_RADIUS = 60;
    const STORM_SPEED = PLAYER_BULLET_SPEED * 0.8;
    const STORM_DURATION = 300;
    const STORM_TICK = 18;
    const STORM_CD = 660;
    const STORM_FLIGHT_TIME = 30;
    const STORM_PLACE_MAX = 220;
    const STORM_PLACE_MIN = 60;

    // ===== ULTİ (SİNEMATİK ZIPLAMA) =====
    const ULTI_RADIUS = 100;
    const ULTI_JUMP_TIME = 25;      // 0.4s
    const ULTI_PULL_TIME = 6;       // 0.1s (ani çekim)
    const ULTI_DMG = 600;
    const ULTI_MAX_BOTS = 5;
    const ULTI_PLACE_MAX = 260;
    const ULTI_PLACE_MIN = 60;
    const ULTI_KNOCKBACK = 45;      // Fırlatma mesafesi

    window.GAME_EXT.characters[CHAR_ID] = { color: C_MAIN, hp: CHAR_HP, speed: CHAR_SPEED };

    let kiskacBullets = [];
    let hook = null;
    let hookPull = null;
    let stormFlight = null;
    let storm = null;
    let ultiState = null; // { phase, timer, startX, startY, targetX, targetY, affectedBots }
    let poisonReady = true;
    let poisonCD = 0;
    let stormReady = true;
    let stormCD = 0;
    let kiskacFX = [];
    let kiskacTexts = [];
    let screenFlash = 0;
    
    let ultiDrag = { active: false, startX: 0, startY: 0, angle: 0, pull: 0, touchId: null, isMouse: false };
    let stormDrag = { active: false, startX: 0, startY: 0, angle: 0, pull: 0, touchId: null, isMouse: false };

    // ===== ÇİZİM SARMALAYICI (ZIPLARKEN BASE ÇİZİMİNİ ENGELLE) =====
    if (!window._kiskacOrigDrawEntity) {
        window._kiskacOrigDrawEntity = window.drawEntity;
        window.drawEntity = function (e, isP) {
            if (!e) return;
            // Zıplarken player'ı base'in çizmesini engelle
            if (isP && player.charType === CHAR_ID && ultiState && ultiState.phase === 'jumping') {
                return;
            }
            // NaN Koruması
            if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) return;
            return window._kiskacOrigDrawEntity(e, isP);
        };
    }

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let pr; if (typeof prev === 'function') pr = prev.apply(this, args);
            const or = fn.apply(this, args);
            if (typeof pr === 'boolean' || typeof or === 'boolean') return !!pr || !!or;
            return or !== undefined ? or : pr;
        };
    }

    function safe(v, fb) { return Number.isFinite(v) ? v : (fb !== undefined ? fb : 0); }
    function addText(x, y, v, l, col) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        kiskacTexts.push({ x, y, val: v, life: 55, maxLife: 55, isLabel: !!l, color: col || C_LIGHT });
    }
    function burst(x, y, n, c, speed = 4) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = (1 + Math.random() * speed);
            kiskacFX.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 1.5 + Math.random() * 2, life: 20 + Math.random() * 20, maxLife: 40, color: c, gravity: 0.05 });
        }
    }

    // KART
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + C_MAIN + ';"></div>' +
            '<span>Kıskaç</span>' +
            '<small>Hasar: 2×300 (kıskaç 750)<br>Güç: Kanca + Fırtına<br>Ulti: Çekim Zıplaması</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function clearAll() {
        kiskacBullets = []; hook = null; hookPull = null;
        stormFlight = null; storm = null; ultiState = null;
        kiskacFX = []; kiskacTexts = []; screenFlash = 0;
        poisonReady = true; poisonCD = 0; stormReady = true; stormCD = 0;
        if (player) { player.jumpInvulnerable = false; player._kiskacAimHide = false; }
    }

    const origSet = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        origSet.call(this, type);
        if (type === CHAR_ID) {
            clearAll();
            this.reloadSpeed = RELOAD_SPEED;
            if (gadgetBtn) { gadgetBtn.style.display = 'flex'; gadgetBtn.innerHTML = 'KANCA<br><span id="gadget-timer"></span>'; gadgetBtn.classList.remove('cooldown'); }
            if (gadgetBtn2) { gadgetBtn2.style.display = 'flex'; gadgetBtn2.innerHTML = 'FIRTINA<br><span id="gadget-timer-2"></span>'; gadgetBtn2.classList.remove('cooldown'); }
            if (ultiBtn) { ultiBtn.style.display = 'flex'; ultiBtn.style.background = 'radial-gradient(circle, ' + C_MAIN + ', ' + C_DARK + ')'; }
            if (typeof gadgetTimerText !== 'undefined') gadgetTimerText = document.getElementById('gadget-timer');
            if (typeof gadgetTimerText2 !== 'undefined') gadgetTimerText2 = document.getElementById('gadget-timer-2');
        } else {
            clearAll();
            if (ultiBtn) ultiBtn.style.background = '';
            if (this.reloadSpeed === RELOAD_SPEED) this.reloadSpeed = 0.015;
        }
    };

    // ANA SALDIRI
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== CHAR_ID) return origFire.call(this, a, pull);
        if (this.ammo < 1 || this.isDead || (ultiState && ultiState.phase !== 'idle')) return;
        if (!Number.isFinite(a)) a = this.angle || 0;

        const perpAngle = a + Math.PI / 2;
        const cosP = Math.cos(perpAngle), sinP = Math.sin(perpAngle);

        [-BULLET_OFFSET / 2, BULLET_OFFSET / 2].forEach(off => {
            const sx = this.x + cosP * off;
            const sy = this.y + sinP * off;
            kiskacBullets.push({
                x: sx, y: sy, sx, sy,
                vx: Math.cos(a) * BULLET_SPEED,
                vy: Math.sin(a) * BULLET_SPEED,
                angle: a, isDead: false, trail: [], clawOpen: 1, hitTargets: new Set()
            });
        });
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // AKS 1: KANCA (Düzeltildi: Siper yıkma + Çekilme)
    const origGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget.call(this, a, pull);
        if (!poisonReady || this.isDead || (ultiState && ultiState.phase !== 'idle') || hook) return;
        const ang = safe(a, this.angle || 0);
        if (!Number.isFinite(ang)) return;
        hook = {
            x: this.x, y: this.y, sx: this.x, sy: this.y,
            vx: Math.cos(ang) * HOOK_SPEED, vy: Math.sin(ang) * HOOK_SPEED, isDead: false
        };
        poisonReady = false; poisonCD = HOOK_CD;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(HOOK_CD / 60) + "s";
        burst(this.x, this.y, 6, C_ACCENT);
    };

    // AKS 2: KUM FIRTINASI (Drag)
    const origGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget2.call(this, a, pull);
        if (!stormReady || this.isDead || (ultiState && ultiState.phase !== 'idle') || stormFlight || storm) return;
        const ang = safe(a, this.angle || 0);
        if (!Number.isFinite(ang)) return;
        
        let pullMag = pull !== undefined ? Math.min(1, Math.max(0, pull)) : 1;
        let dist = STORM_PLACE_MIN + (STORM_PLACE_MAX - STORM_PLACE_MIN) * pullMag;
        
        const tx = clampPos(this.x + Math.cos(ang) * dist, WALL_THICKNESS + 30, canvas.width - WALL_THICKNESS - 30);
        const ty = clampPos(this.y + Math.sin(ang) * dist, WALL_THICKNESS + 30, canvas.height - WALL_THICKNESS - 30);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

        stormFlight = {
            x: this.x, y: this.y, startX: this.x, startY: this.y,
            targetX: tx, targetY: ty, progress: 0, duration: STORM_FLIGHT_TIME
        };
        stormReady = false; stormCD = STORM_CD;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(STORM_CD / 60) + "s";
    };

    // ULTİ (Zıplama + Çekim)
    const origUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return origUlti.call(this, a, pull);
        if (!Number.isFinite(a)) a = this.angle || 0;
        if (!Number.isFinite(pull)) pull = 1;
        if (!this.ultReady || this.isDead || (ultiState && ultiState.phase !== 'idle')) return;

        const pullMag = pull > 0.05 ? pull : 1;
        const dist = ULTI_PLACE_MIN + (ULTI_PLACE_MAX - ULTI_PLACE_MIN) * pullMag;
        const tx = clampPos(this.x + Math.cos(a) * dist, WALL_THICKNESS + 40, canvas.width - WALL_THICKNESS - 40);
        const ty = clampPos(this.y + Math.sin(a) * dist, WALL_THICKNESS + 40, canvas.height - WALL_THICKNESS - 40);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

        // Zıplama başlat
        ultiState = {
            phase: 'jumping',
            timer: ULTI_JUMP_TIME,
            startX: this.x,
            startY: this.y,
            targetX: tx,
            targetY: ty,
            affectedBots: []
        };
        this.jumpInvulnerable = true; // Dokunulmazlık

        addText(this.x, this.y - 40, "ÇEKİM!", true, C_MAIN);
        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    chainHook('onChargeUlti', function (amount) {
        if (player.charType !== CHAR_ID) return;
        if (!gameStarted || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount);
        if (player.ultCharge >= 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
        }
        if (ultFill) ultFill.style.width = player.ultCharge + "%";
    });

    chainHook('onReset', function () { clearAll(); });
    
    chainHook('onPreDraw', function (ctx2) {
        if (player.charType === CHAR_ID && aimData.active && !player.isDead) {
            player._kiskacHideAim = true; aimData.active = false;
        }
    });
    chainHook('onPostDraw', function (ctx2) {
        if (player._kiskacHideAim) { aimData.active = true; player._kiskacHideAim = false; }
    });

    // Drag Kontrolleri
    function uS(cx, cy) {
        if (player.charType !== CHAR_ID) return;
        if (!player.ultReady || player.isDead || (ultiState && ultiState.phase !== 'idle')) return;
        const r = ultiBtn.getBoundingClientRect();
        ultiDrag.active = true; ultiDrag.startX = r.left + r.width / 2; ultiDrag.startY = r.top + r.height / 2;
        ultiDrag.angle = player.angle; ultiDrag.pull = 0;
    }
    function uM(cx, cy) {
        if (!ultiDrag.active) return;
        ultiDrag.angle = Math.atan2(cy - ultiDrag.startY, cx - ultiDrag.startX);
        ultiDrag.pull = Math.min(1, Math.hypot(cx - ultiDrag.startX, cy - ultiDrag.startY) / 160);
    }
    function uE() { if (!ultiDrag.active) return; ultiDrag.active = false; player.fireUlti(ultiDrag.angle, ultiDrag.pull); }

    ultiBtn.addEventListener('touchstart', e => { if (player.charType !== CHAR_ID) return; e.preventDefault(); e.stopImmediatePropagation(); const t = e.changedTouches[0]; ultiDrag.touchId = t.identifier; uS(t.clientX, t.clientY); }, { capture: true, passive: false });
    window.addEventListener('touchmove', e => { if (!ultiDrag.active || player.charType !== CHAR_ID) return; for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === ultiDrag.touchId) uM(e.changedTouches[i].clientX, e.changedTouches[i].clientY); }, { passive: false });
    window.addEventListener('touchend', e => { if (!ultiDrag.active) return; for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === ultiDrag.touchId) uE(); });
    ultiBtn.addEventListener('mousedown', e => { if (player.charType !== CHAR_ID) return; e.preventDefault(); e.stopImmediatePropagation(); ultiDrag.isMouse = true; uS(e.clientX, e.clientY); }, { capture: true });
    window.addEventListener('mousemove', e => { if (ultiDrag.active && ultiDrag.isMouse) uM(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (ultiDrag.active && ultiDrag.isMouse) { ultiDrag.isMouse = false; uE(); } });

    // Fırtına Drag
    function sS(cx, cy) {
        if (player.charType !== CHAR_ID) return;
        if (!stormReady || player.isDead || (ultiState && ultiState.phase !== 'idle') || storm) return;
        const r = gadgetBtn2.getBoundingClientRect();
        stormDrag.active = true; stormDrag.startX = r.left + r.width / 2; stormDrag.startY = r.top + r.height / 2;
        stormDrag.angle = player.angle; stormDrag.pull = 0;
    }
    function sM(cx, cy) {
        if (!stormDrag.active) return;
        stormDrag.angle = Math.atan2(cy - stormDrag.startY, cx - stormDrag.startX);
        stormDrag.pull = Math.min(1, Math.hypot(cx - stormDrag.startX, cy - stormDrag.startY) / 120);
    }
    function sE() { if (!stormDrag.active) return; stormDrag.active = false; player.activateGadget2(stormDrag.angle, stormDrag.pull); }

    gadgetBtn2.addEventListener('touchstart', e => { if (player.charType !== CHAR_ID) return; e.preventDefault(); e.stopImmediatePropagation(); const t = e.changedTouches[0]; stormDrag.touchId = t.identifier; sS(t.clientX, t.clientY); }, { capture: true, passive: false });
    window.addEventListener('touchmove', e => { if (!stormDrag.active || player.charType !== CHAR_ID) return; for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === stormDrag.touchId) sM(e.changedTouches[i].clientX, e.changedTouches[i].clientY); }, { passive: false });
    window.addEventListener('touchend', e => { if (!stormDrag.active) return; for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === stormDrag.touchId) sE(); });
    gadgetBtn2.addEventListener('mousedown', e => { if (player.charType !== CHAR_ID) return; e.preventDefault(); e.stopImmediatePropagation(); stormDrag.isMouse = true; sS(e.clientX, e.clientY); }, { capture: true });
    window.addEventListener('mousemove', e => { if (stormDrag.active && stormDrag.isMouse) sM(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (stormDrag.active && stormDrag.isMouse) { stormDrag.isMouse = false; sE(); } });

    let lastT = 0;
    function loop(t) {
        if (!lastT) lastT = t;
        const ts = Math.min(3, (t - lastT) / 16.666);
        lastT = t;
        if (gameStarted) { try { update(ts); } catch (e) { console.error('[KISKAC]', e); } }
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    function update(ts) {
        // NaN Güvenlik Kalkanı
        if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) {
            player.x = canvas.width / 2; player.y = canvas.height / 2;
        }

        if (player.charType === CHAR_ID) {
            if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
            if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
            if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';
        }

        if (poisonCD > 0) { poisonCD -= ts; if (poisonCD <= 0) { poisonCD = 0; poisonReady = true; if (gadgetBtn) gadgetBtn.classList.remove('cooldown'); if (gadgetTimerText) gadgetTimerText.innerText = ""; } }
        if (stormCD > 0) { stormCD -= ts; if (stormCD <= 0) { stormCD = 0; stormReady = true; if (gadgetBtn2) gadgetBtn2.classList.remove('cooldown'); if (gadgetTimerText2) gadgetTimerText2.innerText = ""; } }

        // ===== ULTİ SİNEMATİK AKIŞI =====
        if (ultiState) {
            if (ultiState.phase === 'jumping') {
                ultiState.timer -= ts;
                const prog = 1 - (ultiState.timer / ULTI_JUMP_TIME);
                // Yay çizerek zıplama
                player.x = ultiState.startX + (ultiState.targetX - ultiState.startX) * prog;
                player.y = ultiState.startY + (ultiState.targetY - ultiState.startY) * prog;
                
                if (ultiState.timer <= 0) {
                    // Varış ve Çekme Aşaması
                    ultiState.phase = 'pulling';
                    ultiState.timer = ULTI_PULL_TIME;
                    screenShake = 10;
                    screenFlash = 5;
                    burst(player.x, player.y, 25, C_WHITE, 8);
                    
                    // Çekilecek botları seç
                    const inRange = [];
                    getActiveEnemies().forEach(e => {
                        if (getDist(player, e) < ULTI_RADIUS + e.radius) inRange.push(e);
                    });
                    ultiState.affectedBots = inRange.slice(0, ULTI_MAX_BOTS);
                    
                    ultiState.affectedBots.forEach(e => {
                        if (e._origSpeed === undefined) e._origSpeed = e.speed;
                        e.speed = 0; // Sersemletme (Çekim sırasında)
                    });
                }
            } else if (ultiState.phase === 'pulling') {
                ultiState.timer -= ts;
                const prog = 1 - (ultiState.timer / ULTI_PULL_TIME);
                
                ultiState.affectedBots.forEach((e, idx) => {
                    if (!e || e.isDead) return;
                    // Botları anında merkeze çek (prog 0'dan 1'e hızla gider)
                    const angleOffset = (idx / ULTI_MAX_BOTS) * Math.PI * 2;
                    const targetX = player.x + Math.cos(angleOffset) * 5; // Hafif ofset (üst üste binmesinler)
                    const targetY = player.y + Math.sin(angleOffset) * 5;
                    
                    e.x = e.x + (targetX - e.x) * (prog > 0.8 ? 1 : prog * 1.5);
                    e.y = e.y + (targetY - e.y) * (prog > 0.8 ? 1 : prog * 1.5);
                });

                if (ultiState.timer <= 0) {
                    // Patlama Aşaması
                    ultiState.phase = 'exploding';
                    screenShake = 15;
                    screenFlash = 10;
                    
                    // Çift katmanlı patlama halkası
                    kiskacFX.push({ x: player.x, y: player.y, vx: 0, vy: 0, size: 10, life: 20, maxLife: 20, color: C_WHITE, isRing: true, ringRadius: 0, maxRing: ULTI_RADIUS * 1.5, ringSpeed: 10 });
                    kiskacFX.push({ x: player.x, y: player.y, vx: 0, vy: 0, size: 10, life: 30, maxLife: 30, color: C_MAIN, isRing: true, ringRadius: 0, maxRing: ULTI_RADIUS * 2, ringSpeed: 5 });
                    
                    // Hasar ve Fırlatma
                    ultiState.affectedBots.forEach(e => {
                        if (!e || e.isDead) return;
                        e.hp -= ULTI_DMG;
                        addFloatingNumber(e.x, e.y, ULTI_DMG, C_WHITE);
                        
                        // 45 birim dışa fırlatma
                        const ang = Math.atan2(e.y - player.y, e.x - player.x);
                        e.kbX = Math.cos(ang) * ULTI_KNOCKBACK;
                        e.kbY = Math.sin(ang) * ULTI_KNOCKBACK;
                        
                        if (e._origSpeed !== undefined) e.speed = e._origSpeed;
                        delete e._origSpeed;
                    });
                    
                    // Etrafa yayılan parçacıklar
                    burst(player.x, player.y, 40, C_ACCENT, 12);
                    burst(player.x, player.y, 20, C_LIGHT, 8);
                }
            } else if (ultiState.phase === 'exploding') {
                // Patlama sonrası kısa bir bekleme (efektlerin oturması için)
                ultiState.timer -= ts;
                if (ultiState.timer <= 0) {
                    player.jumpInvulnerable = false;
                    ultiState = null;
                }
            }
        } else {
            player.jumpInvulnerable = false;
        }

        // ===== KUM FIRTINASI =====
        if (stormFlight) {
            stormFlight.progress += ts / stormFlight.duration;
            if (stormFlight.progress >= 1) {
                storm = {
                    x: stormFlight.targetX, y: stormFlight.targetY,
                    radius: STORM_RADIUS, timer: STORM_DURATION,
                    tickTimer: 0, angle: 0
                };
                stormFlight = null;
                burst(storm.x, storm.y, 15, C_ACCENT);
            }
        }

        if (storm) {
            storm.timer -= ts;
            storm.angle += 0.2 * ts;
            
            // Sadece Kıskaç'ın mermilerini takip et
            if (kiskacBullets.length > 0) {
                const target = kiskacBullets[0];
                const ang = Math.atan2(target.y - storm.y, target.x - storm.x);
                if (getDist(storm, target) > 20) {
                    storm.x += Math.cos(ang) * STORM_SPEED * ts;
                    storm.y += Math.sin(ang) * STORM_SPEED * ts;
                }
            }
            
            storm.x = clampPos(storm.x, WALL_THICKNESS + 10, canvas.width - WALL_THICKNESS - 10);
            storm.y = clampPos(storm.y, WALL_THICKNESS + 10, canvas.height - WALL_THICKNESS - 10);

            storm.tickTimer += ts;
            if (storm.tickTimer >= STORM_TICK) {
                storm.tickTimer = 0;
                getActiveEnemies().forEach(e => {
                    if (getDist(storm, e) < STORM_RADIUS + e.radius) {
                        const ang = Math.atan2(e.y - storm.y, e.x - storm.x);
                        e.x += Math.cos(ang) * STORM_PUSH;
                        e.y += Math.sin(ang) * STORM_PUSH;
                        e.x = clampPos(e.x, e.radius + WALL_THICKNESS, canvas.width - e.radius - WALL_THICKNESS);
                        e.y = clampPos(e.y, e.radius + WALL_THICKNESS, canvas.height - e.radius - WALL_THICKNESS);
                        e.hp -= STORM_DMG;
                        addFloatingNumber(e.x, e.y, STORM_DMG, C_ACCENT);
                        burst(e.x, e.y, 4, C_LIGHT);
                    }
                });
            }
            if (storm.timer <= 0) storm = null;
        }

        // ===== KANCA =====
        if (hook && !hook.isDead) {
            hook.x += hook.vx * ts; hook.y += hook.vy * ts;
            const traveled = getDist({ x: hook.sx, y: hook.sy }, hook);
            
            if (traveled > HOOK_RANGE) { hook = null; }
            else {
                let hitSipe = false;
                // Siper kontrolü
                for (const o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(hook, o) < o.radius + 8) {
                        o.hp = 0; // Siperi anında yok et
                        // Çevredeki botlara 1000 AoE hasar
                        getActiveEnemies().forEach(e => {
                            if (getDist(o, e) < o.radius + 60) {
                                e.hp -= HOOK_SIPER_DMG;
                                addFloatingNumber(e.x, e.y, HOOK_SIPER_DMG, C_MAIN);
                                burst(e.x, e.y, 8, C_ACCENT);
                            }
                        });
                        burst(o.x, o.y, 20, C_MAIN, 8);
                        screenShake = 10;
                        
                        // Oyuncuyu sipere çek
                        const ang = Math.atan2(o.y - player.y, o.x - player.x);
                        const dist = getDist(player, o) - o.radius - player.radius - 10;
                        hookPull = { targetX: player.x + Math.cos(ang) * dist, targetY: player.y + Math.sin(ang) * dist };
                        hitSipe = true; break;
                    }
                }
                
                if (hitSipe) hook = null;
                else {
                    // Bot kontrolü
                    for (const e of getActiveEnemies()) {
                        if (e.isDead) continue;
                        if (getDist(hook, e) < e.radius + 8) {
                            e.hp -= HOOK_BOT_DMG;
                            addFloatingNumber(e.x, e.y, HOOK_BOT_DMG, C_MAIN);
                            burst(hook.x, hook.y, 8, C_ACCENT);
                            hook = null; break;
                        }
                    }
                }
            }
            if (hook && (hook.x < WALL_THICKNESS || hook.x > canvas.width - WALL_THICKNESS || hook.y < WALL_THICKNESS || hook.y > canvas.height - WALL_THICKNESS)) hook = null;
        }

        if (hookPull && !player.isDead) {
            const d = Math.hypot(hookPull.targetX - player.x, hookPull.targetY - player.y);
            if (d < HOOK_PULL_SPEED * ts + 5) {
                player.x = hookPull.targetX; player.y = hookPull.targetY;
                hookPull = null; burst(player.x, player.y, 8, C_ACCENT);
            } else {
                const ang = Math.atan2(hookPull.targetY - player.y, hookPull.targetX - player.x);
                player.x += Math.cos(ang) * HOOK_PULL_SPEED * ts;
                player.y += Math.sin(ang) * HOOK_PULL_SPEED * ts;
            }
        }

        // ===== ANA MERMİLER =====
        const hitLog = [];
        for (let i = kiskacBullets.length - 1; i >= 0; i--) {
            const b = kiskacBullets[i];
            if (b.isDead) { kiskacBullets.splice(i, 1); continue; }

            b.x += b.vx * ts; b.y += b.vy * ts;
            b.trail.push({ x: b.x, y: b.y, life: 15 });
            if (b.trail.length > 12) b.trail.shift();
            b.clawOpen = Math.max(0.3, 1 - (getDist({ x: b.sx, y: b.sy }, b) / BULLET_RANGE) * 0.5);

            const traveled = getDist({ x: b.sx, y: b.sy }, b);
            let stopped = false;

            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(b, o) < o.radius + 5) {
                    o.hp -= SIPER_HASAR;
                    addFloatingNumber(o.x, o.y, SIPER_HASAR, C_MAIN);
                    stopped = true; break;
                }
            }

            if (stopped || traveled > BULLET_RANGE || b.x < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS || b.y < WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) {
                kiskacBullets.splice(i, 1); continue;
            }

            let hit = null;
            for (const e of getActiveEnemies()) {
                if (e.isDead) continue;
                if (getDist(b, e) < e.radius + 8) { hit = e; break; }
            }

            if (hit) {
                let log = hitLog.find(h => h.bot === hit);
                const isDuplicate = !!log;
                const dmg = isDuplicate ? BULLET_BONUS_DMG : BULLET_DMG;

                if (!log) { log = { bot: hit, damage: 0, heal: 0, isPincer: false }; hitLog.push(log); }
                log.damage += dmg;
                log.heal += BULLET_HEAL;
                if (isDuplicate) log.isPincer = true;

                hit.hp -= dmg;
                player.hp = Math.min(player.maxHp, player.hp + BULLET_HEAL);
                burst(b.x, b.y, 5, C_ACCENT);
                kiskacBullets.splice(i, 1);
            }
        }

        hitLog.forEach(h => {
            if (h.bot.isDead) return;
            const label = h.isPincer ? "KISKAÇ! " : "";
            addText(h.bot.x, h.bot.y - 10, label + Math.round(h.damage), false, C_MAIN);
            if (h.heal > 0) addText(player.x, player.y - 20, "+" + h.heal, false, C_HEAL);
        });

        // FX Güncelleme
        for (let i = kiskacFX.length - 1; i >= 0; i--) {
            const p = kiskacFX[i];
            if (p.isRing) {
                p.ringRadius += p.ringSpeed * ts;
                p.life -= ts;
                if (p.life <= 0) kiskacFX.splice(i, 1);
            } else {
                p.x += p.vx * ts; p.y += p.vy * ts;
                p.vy += p.gravity * ts; p.vx *= 0.95; p.vy *= 0.95; p.life -= ts;
                if (p.life <= 0) kiskacFX.splice(i, 1);
            }
        }
        for (let i = kiskacTexts.length - 1; i >= 0; i--) {
            const t = kiskacTexts[i];
            t.y -= 0.7 * ts; t.life -= ts;
            if (t.life <= 0) kiskacTexts.splice(i, 1);
        }
        if (screenFlash > 0) screenFlash -= ts;
    }

    // ÇİZİM
    chainHook('onDraw', function (ctx2) {
        // ULTİ Zıplama Çizimi (Base player'ı engelledik, kendimiz çiziyoruz)
        if (ultiState && ultiState.phase === 'jumping') {
            const prog = 1 - (ultiState.timer / ULTI_JUMP_TIME);
            const jumpH = Math.sin(prog * Math.PI) * 60; // Yay yüksekliği
            
            // Gölge
            ctx2.save();
            ctx2.globalAlpha = 0.4;
            ctx2.beginPath();
            ctx2.ellipse(player.x, player.y, player.radius, player.radius * 0.4, 0, 0, Math.PI * 2);
            ctx2.fillStyle = '#000'; ctx2.fill();
            ctx2.restore();

            // Oyuncu (Havada)
            ctx2.save();
            ctx2.translate(player.x, player.y - jumpH);
            ctx2.rotate(player.angle || 0);
            // Turuncu Enerji Kalkanı
            ctx2.beginPath(); ctx2.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
            ctx2.strokeStyle = C_MAIN; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.fillStyle = C_DARK;
            ctx2.beginPath(); ctx2.arc(0, 0, player.radius, 0, Math.PI * 2); ctx2.fill();
            // Gövde detayı
            ctx2.fillStyle = C_MAIN;
            ctx2.beginPath(); ctx2.moveTo(0, -player.radius); ctx2.lineTo(player.radius, 0); ctx2.lineTo(0, player.radius); ctx2.lineTo(-player.radius, 0); ctx2.closePath(); ctx2.fill();
            ctx2.restore();
        }

        // ULTİ Çekim ve Patlama Alanı
        if (ultiState && ultiState.phase !== 'jumping') {
            const prog = ultiState.phase === 'pulling' ? 1 - (ultiState.timer / ULTI_PULL_TIME) : 1;
            
            ctx2.save();
            ctx2.translate(player.x, player.y);
            // Çekim Alanı
            ctx2.globalAlpha = 0.3 + Math.sin(Date.now() / 100) * 0.1;
            ctx2.beginPath(); ctx2.arc(0, 0, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.strokeStyle = C_MAIN; ctx2.lineWidth = 4; ctx2.setLineDash([10, 5]); ctx2.stroke(); ctx2.setLineDash([]);
            
            // Çekim çizgileri (içe doğru)
            if (ultiState.phase === 'pulling') {
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2 + Date.now() / 200;
                    ctx2.beginPath();
                    ctx2.moveTo(Math.cos(a) * ULTI_RADIUS, Math.sin(a) * ULTI_RADIUS);
                    ctx2.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
                    ctx2.strokeStyle = C_WHITE; ctx2.lineWidth = 2; ctx2.globalAlpha = 0.5 * prog; ctx2.stroke();
                }
            }
            ctx2.restore();
        }

        // Kum Fırtınası
        if (storm) {
            ctx2.save(); ctx2.translate(storm.x, storm.y); ctx2.rotate(storm.angle);
            ctx2.globalAlpha = 0.6; ctx2.beginPath(); ctx2.arc(0, 0, STORM_RADIUS, 0, Math.PI * 2);
            ctx2.strokeStyle = C_ACCENT; ctx2.lineWidth = 3; ctx2.setLineDash([8, 6]); ctx2.stroke(); ctx2.setLineDash([]);
            for (let k = 0; k < 5; k++) {
                const a = (k / 5) * Math.PI * 2 + storm.angle * 3;
                ctx2.beginPath(); ctx2.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
                ctx2.lineTo(Math.cos(a) * (STORM_RADIUS - 5), Math.sin(a) * (STORM_RADIUS - 5));
                ctx2.strokeStyle = 'rgba(230,126,34,0.5)'; ctx2.lineWidth = 2; ctx2.stroke();
            }
            ctx2.restore();
        }

        if (stormFlight) {
            const prog = stormFlight.progress;
            const cx = stormFlight.startX + (stormFlight.targetX - stormFlight.startX) * prog;
            const cy = stormFlight.startY + (stormFlight.targetY - stormFlight.startY) * prog;
            const arc = Math.sin(prog * Math.PI) * 80;
            ctx2.save();
            ctx2.globalAlpha = 0.5; ctx2.beginPath(); ctx2.arc(stormFlight.targetX, stormFlight.targetY, STORM_RADIUS, 0, Math.PI * 2);
            ctx2.strokeStyle = C_ACCENT; ctx2.lineWidth = 2; ctx2.setLineDash([4,4]); ctx2.stroke(); ctx2.setLineDash([]);
            ctx2.globalAlpha = 1; ctx2.beginPath(); ctx2.arc(cx, cy - arc, 8, 0, Math.PI * 2);
            ctx2.fillStyle = C_ACCENT; ctx2.fill(); ctx2.strokeStyle = C_WHITE; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        }

        if (hook && !hook.isDead) {
            ctx2.save();
            ctx2.strokeStyle = 'rgba(211,84,0,0.6)'; ctx2.lineWidth = 2; ctx2.setLineDash([4, 4]);
            ctx2.beginPath(); ctx2.moveTo(player.x, player.y); ctx2.lineTo(hook.x, hook.y); ctx2.stroke(); ctx2.setLineDash([]);
            ctx2.translate(hook.x, hook.y); ctx2.rotate(Math.atan2(hook.vy, hook.vx));
            ctx2.beginPath(); ctx2.moveTo(8, 0); ctx2.lineTo(-4, -6); ctx2.lineTo(-4, 0); ctx2.lineTo(-4, 6); ctx2.closePath();
            ctx2.fillStyle = C_MAIN; ctx2.fill(); ctx2.strokeStyle = C_WHITE; ctx2.lineWidth = 1.5; ctx2.stroke();
            ctx2.restore();
        }

        kiskacBullets.forEach(b => {
            b.trail.forEach(pt => {
                ctx2.save(); ctx2.globalAlpha = (pt.life / 15) * 0.4;
                ctx2.beginPath(); ctx2.arc(pt.x, pt.y, 3, 0, Math.PI * 2); ctx2.fillStyle = C_ACCENT; ctx2.fill(); ctx2.restore();
            });
            ctx2.save(); ctx2.translate(b.x, b.y); ctx2.rotate(b.angle);
            const clawOffset = 5 * b.clawOpen;
            ctx2.fillStyle = C_MAIN; ctx2.strokeStyle = C_WHITE; ctx2.lineWidth = 1.5;
            ctx2.beginPath(); ctx2.moveTo(0, -clawOffset); ctx2.quadraticCurveTo(8, -clawOffset - 4, 12, -clawOffset); ctx2.quadraticCurveTo(8, -clawOffset + 2, 0, -clawOffset); ctx2.fill(); ctx2.stroke();
            ctx2.beginPath(); ctx2.moveTo(0, clawOffset); ctx2.quadraticCurveTo(8, clawOffset + 4, 12, clawOffset); ctx2.quadraticCurveTo(8, clawOffset - 2, 0, clawOffset); ctx2.fill(); ctx2.stroke();
            ctx2.restore();
        });

        kiskacFX.forEach(p => {
            if (p.isRing) {
                ctx2.save(); ctx2.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.8;
                ctx2.beginPath(); ctx2.arc(p.x, p.y, p.ringRadius, 0, Math.PI * 2);
                ctx2.strokeStyle = p.color; ctx2.lineWidth = 4; ctx2.stroke(); ctx2.restore();
            } else {
                ctx2.save(); ctx2.globalAlpha = Math.min(1, p.life / 15);
                ctx2.beginPath(); ctx2.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx2.fillStyle = p.color; ctx2.fill(); ctx2.restore();
            }
        });

        kiskacTexts.forEach(t => {
            ctx2.save(); ctx2.globalAlpha = Math.min(1, t.life / 20);
            ctx2.font = t.isLabel ? 'bold 16px Arial' : 'bold 13px Arial'; ctx2.textAlign = 'center';
            ctx2.fillStyle = t.color || C_LIGHT; ctx2.strokeStyle = 'rgba(20,10,5,0.9)'; ctx2.lineWidth = 3;
            ctx2.strokeText(t.val, t.x, t.y); ctx2.fillText(t.val, t.x, t.y); ctx2.restore();
        });

        // Nişan Çizgisi
        if (player.charType === CHAR_ID && player._kiskacHideAim && !player.isDead && player.ammo >= 1) {
            const ang = aimData.angle;
            ctx2.save(); ctx2.translate(player.x, player.y); ctx2.rotate(ang);
            ctx2.fillStyle = 'rgba(255, 255, 255, 0.08)'; ctx2.fillRect(0, -8, BULLET_RANGE, 16);
            ctx2.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx2.lineWidth = 1.5; ctx2.strokeRect(0, -8, BULLET_RANGE, 16);
            ctx2.beginPath(); ctx2.arc(BULLET_RANGE, 0, 5, 0, Math.PI * 2);
            ctx2.fillStyle = C_MAIN; ctx2.fill(); ctx2.strokeStyle = C_WHITE; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        }

        // Ekran Flaşı (Patlama)
        if (screenFlash > 0) {
            ctx2.save();
            ctx2.globalAlpha = screenFlash / 10 * 0.6;
            ctx2.fillStyle = C_WHITE;
            ctx2.fillRect(0, 0, canvas.width, canvas.height);
            ctx2.restore();
        }

        // Ulti Drag (Sadece zıplarken değil)
        if (player.charType === CHAR_ID && ultiDrag.active && player.ultReady && !player.isDead && !ultiState) {
            const pullMag = ultiDrag.pull < 0.05 ? 1 : ultiDrag.pull;
            const dist = ULTI_PLACE_MIN + (ULTI_PLACE_MAX - ULTI_PLACE_MIN) * pullMag;
            const tx = clampPos(player.x + Math.cos(ultiDrag.angle) * dist, WALL_THICKNESS + 40, canvas.width - WALL_THICKNESS - 40);
            const ty = clampPos(player.y + Math.sin(ultiDrag.angle) * dist, WALL_THICKNESS + 40, canvas.height - WALL_THICKNESS - 40);
            ctx2.save(); ctx2.beginPath(); ctx2.moveTo(player.x, player.y); ctx2.lineTo(tx, ty);
            ctx2.strokeStyle = 'rgba(211,84,0,0.6)'; ctx2.lineWidth = 3; ctx2.setLineDash([8, 6]); ctx2.stroke(); ctx2.setLineDash([]);
            ctx2.beginPath(); ctx2.arc(tx, ty, ULTI_RADIUS, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(211,84,0,0.15)'; ctx2.fill();
            ctx2.strokeStyle = C_MAIN; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.restore();
        }
    });

    (function () {
        const n = document.getElementById('diff-normal');
        const e = document.getElementById('diff-easy');
        if (n) { n.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); n.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
        if (e) { e.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); e.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
    })();

    console.log('[MOD YÜKLENDİ] kiskac (v4 Sinematik)');
})();