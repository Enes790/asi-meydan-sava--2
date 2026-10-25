// ========== mod30.js (KISKAÇ) - TEK HEDEF UZMANI ==========
(function () {
    'use strict';

    const CHAR_ID = 'kiskac';
    const C_MAIN = '#d35400';
    const C_DARK = '#2c3e50';
    const C_ACCENT = '#e67e22';
    const C_LIGHT = '#f5b041';
    const C_WHITE = '#ffffff';
    const CHAR_HP = 2600;
    const CHAR_SPEED = 3.8;

    // ANA SALDIRI
    const BULLET_COUNT = 2;
    const BULLET_DMG = 300;
    const BULLET_BONUS_DMG = 450;   // İki mermi aynı bota çarparsa
    const BULLET_SPEED = PLAYER_BULLET_SPEED * 0.9;
    const BULLET_RANGE = 300;
    const BULLET_OFFSET = 15;
    const BONUS_WINDOW = 100;        // ms — bu süre içinde vurulan bota bonus
    const RELOAD_SPEED = 0.012;

    // AKS 1: GENİŞ KISKAÇ
    const QUAD_COUNT = 4;
    const QUAD_DMG = 200;
    const QUAD_OFFSET = 20;
    const QUAD_CD = 1200;

    // AKS 2: KANCA
    const HOOK_SPEED = 22;
    const HOOK_RANGE = 180;
    const HOOK_BOT_DMG = 150;
    const HOOK_WALL_DMG = 250;
    const HOOK_PULL_SPEED = 20;
    const HOOK_CD = 900;

    // ULTİ: KISKAÇ TUZAĞI
    const ULTI_RANGE = 300;
    const ULTI_KILIT_TIME = 90;      // 1.5s
    const ULTI_TICK = 18;            // her 0.3s
    const ULTI_TICK_DMG = 200;
    const ULTI_FINAL_DMG = 400;

    window.GAME_EXT.characters[CHAR_ID] = { color: C_MAIN, hp: CHAR_HP, speed: CHAR_SPEED };

    let kiskacBullets = [];
    let hook = null;
    let hookPull = null;
    let ultiTarget = null;
    let ultiTimer = 0;
    let ultiTickTimer = 0;
    let quadrupleReady = false;
    let kiskacTexts = [];
    let kiskacFX = [];
    let ultiDrag = { active: false, startX: 0, startY: 0, angle: 0, pull: 0, touchId: null, isMouse: false };

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

    function addText(x, y, v, l) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        kiskacTexts.push({ x, y, val: v, life: 55, maxLife: 55, isLabel: !!l });
    }

    function burst(x, y, n, c) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
            kiskacFX.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 1.5 + Math.random() * 2, life: 15 + Math.random() * 15, maxLife: 30, color: c, gravity: 0.05 });
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
            '<small>Hasar: 2×300 (kıskaç 750)<br>Güç: Kanca + Geniş Kıskaç<br>Ulti: Tek Hedef Kilit</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function clearAll() {
        kiskacBullets = [];
        hook = null;
        hookPull = null;
        ultiTarget = null;
        ultiTimer = 0;
        ultiTickTimer = 0;
        quadrupleReady = false;
        kiskacTexts = [];
        kiskacFX = [];
        if (player) {
            getActiveEnemies().forEach(b => {
                if (b._kiskacBonusUntil) b._kiskacBonusUntil = 0;
            });
        }
    }

    const origSet = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        origSet.call(this, type);
        if (type === CHAR_ID) {
            clearAll();
            this.reloadSpeed = RELOAD_SPEED;
            if (gadgetBtn) { gadgetBtn.style.display = 'flex'; gadgetBtn.innerHTML = 'GENİŞ<br>KISKAÇ<br><span id="gadget-timer"></span>'; gadgetBtn.classList.remove('cooldown'); }
            if (gadgetBtn2) { gadgetBtn2.style.display = 'flex'; gadgetBtn2.innerHTML = 'KANCA<br><span id="gadget-timer-2"></span>'; gadgetBtn2.classList.remove('cooldown'); }
            if (ultiBtn) { ultiBtn.style.display = 'flex'; ultiBtn.style.background = 'radial-gradient(circle, ' + C_MAIN + ', ' + C_DARK + ')'; }
            if (typeof gadgetTimerText !== 'undefined') gadgetTimerText = document.getElementById('gadget-timer');
            if (typeof gadgetTimerText2 !== 'undefined') gadgetTimerText2 = document.getElementById('gadget-timer-2');
        } else {
            clearAll();
            if (ultiBtn) ultiBtn.style.background = '';
            if (this.reloadSpeed === RELOAD_SPEED) this.reloadSpeed = 0.015;
        }
    };

    // ===== ANA SALDIRI =====
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== CHAR_ID) return origFire.call(this, a, pull);
        if (this.ammo < 1 || this.isDead || ultiTarget) return;
        if (!Number.isFinite(a)) a = this.angle || 0;

        const perpAngle = a + Math.PI / 2;
        const cosP = Math.cos(perpAngle), sinP = Math.sin(perpAngle);
        const count = quadrupleReady ? QUAD_COUNT : BULLET_COUNT;
        const dmg = quadrupleReady ? QUAD_DMG : BULLET_DMG;
        const offset = quadrupleReady ? QUAD_OFFSET : BULLET_OFFSET;
        const now = Date.now();

        // Kaç tane mermi: 2x2 düzen için satır/sütun hesapla
        let positions = [];
        if (quadrupleReady) {
            // 2x2 düzen
            positions = [
                { x: -offset, y: -offset }, { x: offset, y: -offset },
                { x: -offset, y: offset }, { x: offset, y: offset }
            ];
        } else {
            positions = [{ x: -offset / 2, y: 0 }, { x: offset / 2, y: 0 }];
        }

        positions.forEach(pos => {
            const sx = this.x + cosP * pos.x + Math.cos(a) * pos.y;
            const sy = this.y + sinP * pos.x + Math.sin(a) * pos.y;
            kiskacBullets.push({
                x: sx, y: sy, sx, sy,
                vx: Math.cos(a) * BULLET_SPEED,
                vy: Math.sin(a) * BULLET_SPEED,
                dmg, isDead: false, isQuad: quadrupleReady,
                hitTargets: new Set(),
                spawnTime: now
            });
        });

        if (quadrupleReady) quadrupleReady = false;
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ===== AKS 1: GENİŞ KISKAÇ =====
    const origGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead || ultiTarget) return;
        quadrupleReady = true;
        this.gadgetReady = false;
        this.gadgetCooldown = QUAD_CD;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(QUAD_CD / 60) + "s";
        addText(this.x, this.y - 30, "GENİŞ KISKAÇ!", true);
        burst(this.x, this.y, 8, C_ACCENT);
    };

    // ===== AKS 2: KANCA =====
    const origGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead || ultiTarget || hook) return;
        const ang = safe(a, this.angle || 0);
        if (!Number.isFinite(ang)) return;
        hook = {
            x: this.x, y: this.y,
            sx: this.x, sy: this.y,
            vx: Math.cos(ang) * HOOK_SPEED,
            vy: Math.sin(ang) * HOOK_SPEED,
            isDead: false
        };
        this.gadget2Ready = false;
        this.gadget2Cooldown = HOOK_CD;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(HOOK_CD / 60) + "s";
        burst(this.x, this.y, 6, C_ACCENT);
    };

    // ===== ULTİ =====
    const origUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return origUlti.call(this, a, pull);
        if (!Number.isFinite(a)) a = this.angle || 0;
        if (!Number.isFinite(pull)) pull = 1;
        if (!this.ultReady || this.isDead || ultiTarget) return;

        // En yakın botu seç (drag yönüne göre)
        let target = null, bestScore = Infinity;
        getActiveEnemies().forEach(e => {
            if (e.isDead || e._curlosJumpActive) return;
            const d = getDist(this, e);
            if (d > ULTI_RANGE + e.radius) return;
            const ang = Math.atan2(e.y - this.y, e.x - this.x);
            let angDiff = Math.abs(ang - a);
            if (angDiff > Math.PI) angDiff = Math.PI * 2 - angDiff;
            // Mesafe + açı farkı skoru (yakın ve önündekiler öncelikli)
            const score = d + angDiff * 100;
            if (score < bestScore) { bestScore = score; target = e; }
        });

        if (!target) {
            addText(this.x, this.y - 30, "HEDEF YOK!", true);
            return;
        }

        ultiTarget = target;
        ultiTimer = ULTI_KILIT_TIME;
        ultiTickTimer = 0;
        // Kilitle
        if (target._origSpeed === undefined) target._origSpeed = target.speed;
        if (target._origShoot === undefined) target._origShoot = target.shootInterval;
        target.speed = 0;
        target.shootInterval = 999999;
        addText(target.x, target.y - 30, "KISKAÇ!", true);
        burst(target.x, target.y, 15, C_MAIN);
        screenShake = 6;

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
            player._kiskacHideAim = true;
            aimData.active = false;
        }
    });

    chainHook('onPostDraw', function (ctx2) {
        if (player._kiskacHideAim) {
            aimData.active = true;
            player._kiskacHideAim = false;
        }
    });

    // ===== LOOP =====
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
        // NaN KORUMASI
        if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) {
            player.x = canvas.width / 2;
            player.y = canvas.height / 2;
        }

        if (player.charType === CHAR_ID) {
            if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
            if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
            if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';
        }

        // KANCA HAREKET
        if (hook && !hook.isDead) {
            hook.x += hook.vx * ts;
            hook.y += hook.vy * ts;
            const traveled = getDist({ x: hook.sx, y: hook.sy }, hook);
            if (traveled > HOOK_RANGE) { hook.isDead = true; hook = null; }
            else {
                // Duvara çarp
                let hitWall = false;
                for (const o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(hook, o) < o.radius + 8) {
                        o.hp -= HOOK_WALL_DMG;
                        addFloatingNumber(o.x, o.y, HOOK_WALL_DMG, C_MAIN);
                        burst(hook.x, hook.y, 8, C_ACCENT);
                        // Oyuncu duvara doğru çekilir
                        const ang = Math.atan2(o.y - player.y, o.x - player.x);
                        hookPull = {
                            targetX: player.x + Math.cos(ang) * Math.max(0, getDist(player, o) - o.radius - player.radius - 10),
                            targetY: player.y + Math.sin(ang) * Math.max(0, getDist(player, o) - o.radius - player.radius - 10)
                        };
                        hitWall = true;
                        break;
                    }
                }
                if (hitWall) { hook = null; }
                else {
                    // Bota çarp
                    for (const e of getActiveEnemies()) {
                        if (e.isDead) continue;
                        if (getDist(hook, e) < e.radius + 8) {
                            e.hp -= HOOK_BOT_DMG;
                            addFloatingNumber(e.x, e.y, HOOK_BOT_DMG, C_MAIN);
                            burst(hook.x, hook.y, 8, C_ACCENT);
                            hook = null;
                            break;
                        }
                    }
                }
            }
            // Ekran dışı
            if (hook && (hook.x < WALL_THICKNESS || hook.x > canvas.width - WALL_THICKNESS || hook.y < WALL_THICKNESS || hook.y > canvas.height - WALL_THICKNESS)) {
                hook = null;
            }
        }

        // KANCA ÇEKİLME (oyuncu)
        if (hookPull && !player.isDead) {
            const d = Math.hypot(hookPull.targetX - player.x, hookPull.targetY - player.y);
            if (d < HOOK_PULL_SPEED * ts + 5) {
                player.x = hookPull.targetX;
                player.y = hookPull.targetY;
                hookPull = null;
                burst(player.x, player.y, 8, C_ACCENT);
            } else {
                const ang = Math.atan2(hookPull.targetY - player.y, hookPull.targetX - player.x);
                player.x += Math.cos(ang) * HOOK_PULL_SPEED * ts;
                player.y += Math.sin(ang) * HOOK_PULL_SPEED * ts;
                if (Math.random() < 0.3) {
                    kiskacFX.push({ x: player.x, y: player.y, vx: 0, vy: 0, size: 3, life: 10, maxLife: 10, color: C_ACCENT, gravity: 0 });
                }
            }
        }

        // ULTİ KİLİT
        if (ultiTarget) {
            if (ultiTarget.isDead) {
                if (ultiTarget._origSpeed !== undefined) ultiTarget.speed = ultiTarget._origSpeed;
                if (ultiTarget._origShoot !== undefined) ultiTarget.shootInterval = ultiTarget._origShoot;
                ultiTarget = null;
                ultiTimer = 0;
                ultiTickTimer = 0;
            } else {
                // Hedefe kilitli tut
                ultiTarget.speed = 0;
                ultiTarget.shootInterval = 999999;
                ultiTimer -= ts;
                ultiTickTimer += ts;
                if (ultiTickTimer >= ULTI_TICK) {
                    ultiTickTimer = 0;
                    ultiTarget.hp -= ULTI_TICK_DMG;
                    addFloatingNumber(ultiTarget.x, ultiTarget.y, ULTI_TICK_DMG, C_MAIN);
                    burst(ultiTarget.x, ultiTarget.y, 4, C_ACCENT);
                }
                if (ultiTimer <= 0) {
                    // Final patlama
                    ultiTarget.hp -= ULTI_FINAL_DMG;
                    addFloatingNumber(ultiTarget.x, ultiTarget.y, ULTI_FINAL_DMG, C_LIGHT);
                    burst(ultiTarget.x, ultiTarget.y, 20, C_MAIN);
                    screenShake = 10;
                    if (ultiTarget._origSpeed !== undefined) ultiTarget.speed = ultiTarget._origSpeed;
                    if (ultiTarget._origShoot !== undefined) ultiTarget.shootInterval = ultiTarget._origShoot;
                    ultiTarget = null;
                }
            }
        }

        // MERMİLER
        for (let i = kiskacBullets.length - 1; i >= 0; i--) {
            const b = kiskacBullets[i];
            if (b.isDead) { kiskacBullets.splice(i, 1); continue; }
            b.x += b.vx * ts;
            b.y += b.vy * ts;
            if (getDist({ x: b.sx, y: b.sy }, b) > BULLET_RANGE) { kiskacBullets.splice(i, 1); continue; }
            if (b.x < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS || b.y < WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) {
                kiskacBullets.splice(i, 1); continue;
            }
            let hit = null;
            for (const e of getActiveEnemies()) {
                if (b.hitTargets.has(e)) continue;
                if (e.isDead) continue;
                if (getDist(b, e) < e.radius + 8) { hit = e; break; }
            }
            if (hit) {
                b.hitTargets.add(hit);
                const now = Date.now();
                // Kıskaç bonusu: son 100ms içinde aynı bot vurulduysa bonus
                let dmg = b.dmg;
                if (hit._kiskacBonusUntil && now < hit._kiskacBonusUntil) {
                    dmg = quadrupleReady ? BULLET_BONUS_DMG * 0.7 : BULLET_BONUS_DMG;
                    addText(hit.x, hit.y - 20, "KISKAÇ!", true);
                }
                hit.hp -= dmg;
                addFloatingNumber(hit.x, hit.y, Math.round(dmg), C_MAIN);
                burst(hit.x, hit.y, 4, C_ACCENT);
                // Bu botu sonraki mermi için işaretle
                hit._kiskacBonusUntil = now + BONUS_WINDOW;
                kiskacBullets.splice(i, 1);
            }
        }

        // FX
        for (let i = kiskacFX.length - 1; i >= 0; i--) {
            const p = kiskacFX[i];
            p.x += p.vx * ts; p.y += p.vy * ts;
            p.vy += p.gravity * ts;
            p.vx *= 0.95; p.vy *= 0.95;
            p.life -= ts;
            if (p.life <= 0) kiskacFX.splice(i, 1);
        }
        for (let i = kiskacTexts.length - 1; i >= 0; i--) {
            const t = kiskacTexts[i];
            t.y -= 0.7 * ts; t.life -= ts;
            if (t.life <= 0) kiskacTexts.splice(i, 1);
        }
    }

    // ===== ÇİZİM =====
    chainHook('onDraw', function (ctx2) {
        // Ulti kilit — kıskaç pençeleri
        if (ultiTarget && !ultiTarget.isDead) {
            const t = ultiTarget;
            const pulse = 1 + Math.sin(Date.now() / 100) * 0.1;
            ctx2.save();
            ctx2.translate(t.x, t.y);
            ctx2.globalAlpha = 0.7;
            // Sol pençe
            ctx2.strokeStyle = C_MAIN; ctx2.lineWidth = 4;
            ctx2.beginPath();
            ctx2.arc(0, 0, (t.radius + 12) * pulse, Math.PI * 0.7, Math.PI * 1.3);
            ctx2.stroke();
            // Sağ pençe
            ctx2.beginPath();
            ctx2.arc(0, 0, (t.radius + 12) * pulse, Math.PI * 1.7, Math.PI * 0.3);
            ctx2.stroke();
            // İç halka
            ctx2.globalAlpha = 0.4;
            ctx2.strokeStyle = C_LIGHT;
            ctx2.lineWidth = 2;
            ctx2.setLineDash([4, 4]);
            ctx2.beginPath();
            ctx2.arc(0, 0, (t.radius + 20) * pulse, 0, Math.PI * 2);
            ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.restore();
        }

        // Kanca
        if (hook && !hook.isDead) {
            ctx2.save();
            // Zincir çizgisi
            ctx2.strokeStyle = 'rgba(211,84,0,0.6)';
            ctx2.lineWidth = 2;
            ctx2.setLineDash([4, 4]);
            ctx2.beginPath();
            ctx2.moveTo(player.x, player.y);
            ctx2.lineTo(hook.x, hook.y);
            ctx2.stroke();
            ctx2.setLineDash([]);
            // Kanca ucu
            ctx2.translate(hook.x, hook.y);
            ctx2.rotate(Math.atan2(hook.vy, hook.vx));
            ctx2.beginPath();
            ctx2.moveTo(8, 0);
            ctx2.lineTo(-4, -6);
            ctx2.lineTo(-4, 0);
            ctx2.lineTo(-4, 6);
            ctx2.closePath();
            ctx2.fillStyle = C_MAIN;
            ctx2.fill();
            ctx2.strokeStyle = C_WHITE;
            ctx2.lineWidth = 1.5;
            ctx2.stroke();
            ctx2.restore();
        }

        // Mermiler
        kiskacBullets.forEach(b => {
            if (b.isDead) return;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            const grad = ctx2.createRadialGradient(0, 0, 0, 0, 0, 10);
            grad.addColorStop(0, C_WHITE);
            grad.addColorStop(0.4, b.isQuad ? C_ACCENT : C_MAIN);
            grad.addColorStop(1, 'rgba(211,84,0,0)');
            ctx2.beginPath(); ctx2.arc(0, 0, 10, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();
            ctx2.rotate(Math.atan2(b.vy, b.vx));
            ctx2.beginPath();
            ctx2.moveTo(7, 0); ctx2.lineTo(-5, -3); ctx2.lineTo(-5, 3);
            ctx2.closePath();
            ctx2.fillStyle = b.isQuad ? C_ACCENT : C_MAIN;
            ctx2.fill();
            ctx2.restore();
        });

        // FX
        kiskacFX.forEach(p => {
            ctx2.save();
            ctx2.globalAlpha = Math.min(1, p.life / 15);
            ctx2.beginPath();
            ctx2.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx2.fillStyle = p.color;
            ctx2.fill();
            ctx2.restore();
        });

        // Texts
        kiskacTexts.forEach(t => {
            ctx2.save();
            ctx2.globalAlpha = Math.min(1, t.life / 20);
            ctx2.font = t.isLabel ? 'bold 15px Arial' : 'bold 12px Arial';
            ctx2.textAlign = 'center';
            ctx2.fillStyle = C_LIGHT;
            ctx2.strokeStyle = 'rgba(20,10,5,0.9)';
            ctx2.lineWidth = 3;
            ctx2.strokeText(t.val, t.x, t.y);
            ctx2.fillText(t.val, t.x, t.y);
            ctx2.restore();
        });

        // Aim çizgisi
        if (player.charType === CHAR_ID && player._kiskacHideAim && !player.isDead && player.ammo >= 1) {
            const ang = aimData.angle;
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.rotate(ang);
            const offset = quadrupleReady ? QUAD_OFFSET : BULLET_OFFSET;
            const lineCount = quadrupleReady ? 2 : 2;
            // Paralel çizgiler
            const perpOffsets = quadrupleReady ? [-offset, offset] : [-offset / 2, offset / 2];
            perpOffsets.forEach(off => {
                ctx2.beginPath();
                ctx2.moveTo(0, off);
                ctx2.lineTo(BULLET_RANGE, off);
                ctx2.strokeStyle = quadrupleReady ? 'rgba(230,126,34,0.5)' : 'rgba(211,84,0,0.5)';
                ctx2.lineWidth = quadrupleReady ? 3 : 2;
                ctx2.stroke();
            });
            // Uç nokta
            ctx2.beginPath();
            ctx2.arc(BULLET_RANGE, 0, 5, 0, Math.PI * 2);
            ctx2.fillStyle = C_MAIN;
            ctx2.fill();
            ctx2.restore();
        }
    });

    // ARENA DÖNÜŞÜ
    (function () {
        const n = document.getElementById('diff-normal');
        const e = document.getElementById('diff-easy');
        if (n) { n.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); n.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
        if (e) { e.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); e.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
    })();

    console.log('[MOD YÜKLENDİ] kiskac');
})();