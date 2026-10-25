// ========== mod30.js (KUKLACI) - KONTROLCÜ ==========
(function () {
    'use strict';

    const CHAR_ID = 'kuklaci';
    const C_BODY = '#0f2a3f';
    const C_KUKLA = '#c0d0e0';
    const C_ACCENT = '#5e2a8a';
    const C_FREEZE = '#a0d8ef';
    const CHAR_HP = 2600;
    const CHAR_SPEED = 3.6;

    const ATK_DMG = 400;
    const ATK_AOE = 250;
    const ATK_AOE_R = 80;
    const ATK_FREEZE = 24;
    const ATK_MAX = 3;
    const ATK_SPEED = PLAYER_BULLET_SPEED * 0.95;
    const ATK_RANGE = 300;
    const RELOAD = 0.012;

    const KUKLA_HP = 1700;
    const KUKLA_R = 18;
    const KUKLA_RANGE = 400;
    const KUKLA_THROW_T = 42;
    const KUKLA_HEAL = 200;

    const VUCUT_DMG = 500;
    const VUCUT_INT = 90;
    const VUCUT_RANGE = 300;

    const MARK_LIFE = 120;
    const MARK_CD = 900;
    const MARK_AMMO = 0.5;

    const DASH_LEG = 180;
    const DASH_SPD = 14;
    const DASH_CD = 1200;
    const DASH_AOE_R = 100;
    const DASH_DMG = 250;
    const DASH_FREEZE = 48;

    window.GAME_EXT.characters[CHAR_ID] = { color: C_KUKLA, hp: CHAR_HP, speed: CHAR_SPEED };

    let kukla = null;
    let kuklaThrow = null;
    let vucut = null;
    let vucutTimer = 0;
    let mark = null;
    let markTimer = 0;
    let dashActive = false;
    let dashVx = 0, dashVy = 0, dashRem = 0;
    let kuklaBullets = [];
    let vucutBullets = [];
    let frozenBots = new Map();
    let kuklaFX = [];
    let kuklaTexts = [];
    let isUlting = false;
    let ultiAim = { active: false, startX: 0, startY: 0, angle: 0, pull: 0, touchId: null, isMouse: false };

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
        kuklaTexts.push({ x, y, val: v, life: 55, maxLife: 55, isLabel: !!l });
    }
    function burst(x, y, n, c) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
            kuklaFX.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 1.5 + Math.random() * 2, life: 15 + Math.random() * 15, maxLife: 30, color: c, gravity: 0.05 });
        }
    }

    function applyFreeze(bot, frames) {
        if (!bot || bot.isDead) return;
        if (bot._origSpeed === undefined) bot._origSpeed = bot.speed;
        if (bot._origShoot === undefined) bot._origShoot = bot.shootInterval;
        frozenBots.set(bot, Math.max(frozenBots.get(bot) || 0, frames));
        bot.speed = 0;
        bot.shootInterval = 999999;
    }

    // Kart
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML = '<div class="char-color-preview" style="background:' + C_KUKLA + ';"></div>' +
            '<span>Kuklacı</span><small>Hasar: 400+250 AoE<br>Güç: İşaret + Dash<br>Ulti: Kukla</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function clearAll() {
        kukla = null; kuklaThrow = null; vucut = null; vucutTimer = 0;
        mark = null; markTimer = 0;
        dashActive = false; dashVx = 0; dashVy = 0; dashRem = 0;
        kuklaBullets = []; vucutBullets = [];
        frozenBots.forEach((t, b) => {
            if (b && !b.isDead) {
                if (b._origSpeed !== undefined) b.speed = b._origSpeed;
                if (b._origShoot !== undefined) b.shootInterval = b._origShoot;
            }
        });
        frozenBots.clear();
        kuklaFX = []; kuklaTexts = []; isUlting = false;
        if (player) { player.isJumping = false; player.jumpInvulnerable = false; }
    }

    const origSet = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        origSet.call(this, type);
        if (type === CHAR_ID) {
            clearAll();
            this.reloadSpeed = RELOAD;
            if (gadgetBtn) { gadgetBtn.style.display = 'flex'; gadgetBtn.innerHTML = 'İŞARET<br><span id="gadget-timer"></span>'; gadgetBtn.classList.remove('cooldown'); }
            if (gadgetBtn2) { gadgetBtn2.style.display = 'flex'; gadgetBtn2.innerHTML = 'DASH<br><span id="gadget-timer-2"></span>'; gadgetBtn2.classList.remove('cooldown'); }
            if (ultiBtn) { ultiBtn.style.display = 'flex'; ultiBtn.style.background = 'radial-gradient(circle, ' + C_KUKLA + ', ' + C_BODY + ')'; }
            if (typeof gadgetTimerText !== 'undefined') gadgetTimerText = document.getElementById('gadget-timer');
            if (typeof gadgetTimerText2 !== 'undefined') gadgetTimerText2 = document.getElementById('gadget-timer-2');
        } else {
            clearAll();
            if (ultiBtn) ultiBtn.style.background = '';
            if (this.reloadSpeed === RELOAD) this.reloadSpeed = 0.015;
        }
    };

    // ===== FIRE =====
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== CHAR_ID) return origFire.call(this, a, pull);
        if (this.isDead || dashActive) return;
        if (this.ammo < 1) return;
        if (!Number.isFinite(a)) a = this.angle || 0;
        const source = (isUlting && kukla) ? kukla : this;
        kuklaBullets.push({
            x: source.x, y: source.y, sx: source.x, sy: source.y,
            vx: Math.cos(a) * ATK_SPEED, vy: Math.sin(a) * ATK_SPEED,
            angle: a, hitTargets: new Set(), isDead: false
        });
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ===== AKS 1: İŞARET =====
    const origGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead || isUlting || dashActive) return;
        if (mark && markTimer > 0) {
            // Işınlan
            burst(this.x, this.y, 10, C_ACCENT);
            this.x = mark.x; this.y = mark.y;
            burst(this.x, this.y, 10, C_KUKLA);
            this.ammo = Math.min(this.maxAmmo, this.ammo + this.maxAmmo * MARK_AMMO);
            mark = null; markTimer = 0;
            this.gadgetReady = false;
            this.gadgetCooldown = MARK_CD;
            if (gadgetBtn) gadgetBtn.classList.add('cooldown');
            if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(MARK_CD / 60) + "s";
        } else {
            mark = { x: this.x, y: this.y };
            markTimer = MARK_LIFE;
            addText(this.x, this.y - 30, "İŞARET!", true);
        }
    };

    // ===== AKS 2: DASH =====
    const origGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead || isUlting || dashActive) return;
        const ang = safe(a, this.angle || 0);
        dashActive = true;
        dashVx = Math.cos(ang) * DASH_SPD;
        dashVy = Math.sin(ang) * DASH_SPD;
        dashRem = DASH_LEG;
        this.gadget2Ready = false;
        this.gadget2Cooldown = DASH_CD;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(DASH_CD / 60) + "s";
        burst(this.x, this.y, 12, C_ACCENT);
        screenShake = 5;
    };

    // ===== ULTİ =====
    const origUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return origUlti.call(this, a, pull);
        // Kukla aktifse geri dön
        if (isUlting) {
            if (kukla) burst(kukla.x, kukla.y, 15, C_KUKLA);
            if (vucut) { this.x = vucut.x; this.y = vucut.y; }
            kukla = null; kuklaThrow = null; vucut = null;
            isUlting = false;
            this.ultReady = true; this.ultCharge = 100;
            if (ultFill) ultFill.style.width = "100%";
            if (ultiBtn) ultiBtn.classList.add('ready');
            return;
        }
        if (!Number.isFinite(a)) a = this.angle || 0;
        if (!Number.isFinite(pull)) pull = 1;
        if (!this.ultReady || this.isDead || dashActive) return;

        const pullMag = pull > 0.05 ? pull : 1;
        const dist = Math.min(KUKLA_RANGE, KUKLA_RANGE * pullMag);
        const tx = clampPos(this.x + Math.cos(a) * dist, WALL_THICKNESS + 30, canvas.width - WALL_THICKNESS - 30);
        const ty = clampPos(this.y + Math.sin(a) * dist, WALL_THICKNESS + 30, canvas.height - WALL_THICKNESS - 30);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

        vucut = { x: this.x, y: this.y };
        kuklaThrow = { startX: this.x, startY: this.y, targetX: tx, targetY: ty, progress: 0, duration: KUKLA_THROW_T };
        isUlting = true;

        this.ultReady = true; this.ultCharge = 100;
        if (ultFill) ultFill.style.width = "100%";
        if (ultiBtn) ultiBtn.classList.add('ready');
        addText(this.x, this.y - 40, "KUKLA!", true);
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

    // Ulti drag
    function uS(cx, cy) {
        if (player.charType !== CHAR_ID) return;
        if (isUlting) { player.fireUlti(); return; }
        if (!player.ultReady || player.isDead) return;
        const r = ultiBtn.getBoundingClientRect();
        ultiAim.active = true;
        ultiAim.startX = r.left + r.width / 2;
        ultiAim.startY = r.top + r.height / 2;
        ultiAim.angle = player.angle;
        ultiAim.pull = 0;
    }
    function uM(cx, cy) {
        if (!ultiAim.active) return;
        ultiAim.angle = Math.atan2(cy - ultiAim.startY, cx - ultiAim.startX);
        ultiAim.pull = Math.min(1, Math.hypot(cx - ultiAim.startX, cy - ultiAim.startY) / 160);
    }
    function uE() {
        if (!ultiAim.active) return;
        ultiAim.active = false;
        player.fireUlti(ultiAim.angle, ultiAim.pull);
    }
    ultiBtn.addEventListener('touchstart', e => { if (player.charType !== CHAR_ID) return; e.preventDefault(); e.stopImmediatePropagation(); const t = e.changedTouches[0]; ultiAim.touchId = t.identifier; uS(t.clientX, t.clientY); }, { capture: true, passive: false });
    window.addEventListener('touchmove', e => { if (!ultiAim.active || player.charType !== CHAR_ID) return; for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === ultiAim.touchId) uM(e.changedTouches[i].clientX, e.changedTouches[i].clientY); }, { passive: false });
    window.addEventListener('touchend', e => { if (!ultiAim.active) return; for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === ultiAim.touchId) uE(); });
    ultiBtn.addEventListener('mousedown', e => { if (player.charType !== CHAR_ID) return; e.preventDefault(); e.stopImmediatePropagation(); ultiAim.isMouse = true; uS(e.clientX, e.clientY); }, { capture: true });
    window.addEventListener('mousemove', e => { if (ultiAim.active && ultiAim.isMouse) uM(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (ultiAim.active && ultiAim.isMouse) { ultiAim.isMouse = false; uE(); } });

    // LOOP
    let lastT = 0;
    function loop(t) {
        if (!lastT) lastT = t;
        const ts = Math.min(3, (t - lastT) / 16.666);
        lastT = t;
        if (gameStarted) { try { update(ts); } catch (e) { console.error('[KUKLACI]', e); } }
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    function update(ts) {
        if (player.charType === CHAR_ID) {
            if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
            if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
            if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';
        }

        // Frozen
        frozenBots.forEach((t, b) => {
            const nt = t - ts;
            if (nt <= 0 || !b || b.isDead) {
                frozenBots.delete(b);
                if (b && !b.isDead) {
                    if (b._origSpeed !== undefined) b.speed = b._origSpeed;
                    if (b._origShoot !== undefined) b.shootInterval = b._origShoot;
                }
            } else {
                frozenBots.set(b, nt);
                b.speed = 0;
                b.shootInterval = 999999;
            }
        });

        // Mark
        if (markTimer > 0) { markTimer -= ts; if (markTimer <= 0) mark = null; }

        // Kukla fırlatma
        if (kuklaThrow) {
            kuklaThrow.progress += ts / kuklaThrow.duration;
            if (kuklaThrow.progress >= 1) {
                kukla = {
                    x: kuklaThrow.targetX, y: kuklaThrow.targetY,
                    hp: KUKLA_HP, maxHp: KUKLA_HP,
                    radius: KUKLA_R, angle: player.angle || 0, isDead: false
                };
                player.x = kukla.x; player.y = kukla.y;
                kuklaThrow = null;
                burst(kukla.x, kukla.y, 15, C_KUKLA);
                addText(kukla.x, kukla.y - 40, "KUKLA AKTİF!", true);
            }
        }

        // Kukla kontrol
        if (isUlting && kukla) {
            kukla.x = player.x;
            kukla.y = player.y;
            kukla.angle = player.angle || 0;

            // Kukla ölüm
            if (kukla.hp <= 0) {
                player.hp = Math.max(player.hp * 0.5, 100);
                burst(kukla.x, kukla.y, 20, C_ACCENT);
                if (vucut) { player.x = vucut.x; player.y = vucut.y; }
                kukla = null; vucut = null; isUlting = false;
            } else {
                // Vücut otomatik ateş
                vucutTimer += ts;
                if (vucutTimer >= VUCUT_INT) {
                    vucutTimer = 0;
                    if (vucut) {
                        let nearest = null, nd = Infinity;
                        getActiveEnemies().forEach(e => { const d = getDist(vucut, e); if (d < nd) { nd = d; nearest = e; } });
                        if (nearest && nd < VUCUT_RANGE) {
                            const a = Math.atan2(nearest.y - vucut.y, nearest.x - vucut.x);
                            vucutBullets.push({ x: vucut.x, y: vucut.y, sx: vucut.x, sy: vucut.y, vx: Math.cos(a) * ATK_SPEED, vy: Math.sin(a) * ATK_SPEED, isDead: false });
                        }
                    }
                }
                // Kukla hasar (botlar tarafından)
                // base kod player'a hasar veriyor, biz bunu kukla.hp'ye yansıtacağız
                if (player.hp < player.maxHp) {
                    const dmg = player.maxHp - player.hp;
                    kukla.hp -= dmg;
                    player.hp = player.maxHp;
                }
            }
        }

        // Vücut mermileri
        for (let i = vucutBullets.length - 1; i >= 0; i--) {
            const b = vucutBullets[i];
            b.x += b.vx * ts; b.y += b.vy * ts;
            if (getDist({ x: b.sx, y: b.sy }, b) > VUCUT_RANGE) { vucutBullets.splice(i, 1); continue; }
            let hit = false;
            for (const e of getActiveEnemies()) {
                if (getDist(b, e) < e.radius + 10) {
                    e.hp -= VUCUT_DMG;
                    addFloatingNumber(e.x, e.y, VUCUT_DMG, C_BODY);
                    hit = true; break;
                }
            }
            if (hit) vucutBullets.splice(i, 1);
        }

        // Dash
        if (dashActive && !player.isDead) {
            const dx = dashVx * ts, dy = dashVy * ts;
            player.x += dx; player.y += dy;
            dashRem -= Math.hypot(dx, dy);
            player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
            player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
            if (dashRem <= 0) {
                dashActive = false;
                getActiveEnemies().forEach(e => {
                    if (getDist(player, e) < DASH_AOE_R + e.radius) {
                        e.hp -= DASH_DMG;
                        addFloatingNumber(e.x, e.y, DASH_DMG, C_ACCENT);
                        applyFreeze(e, DASH_FREEZE);
                    }
                });
                screenShake = 8;
                burst(player.x, player.y, 15, C_FREEZE);
            }
        }

        // Kukla mermileri
        for (let i = kuklaBullets.length - 1; i >= 0; i--) {
            const b = kuklaBullets[i];
            if (b.isDead) { kuklaBullets.splice(i, 1); continue; }
            b.x += b.vx * ts; b.y += b.vy * ts;
            if (getDist({ x: b.sx, y: b.sy }, b) > ATK_RANGE) { kuklaBullets.splice(i, 1); continue; }
            if (b.x < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS || b.y < WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) {
                kuklaBullets.splice(i, 1); continue;
            }
            let hit = null;
            for (const e of getActiveEnemies()) {
                if (b.hitTargets.has(e)) continue;
                if (getDist(b, e) < e.radius + 10) { hit = e; break; }
            }
            if (hit) {
                b.hitTargets.add(hit);
                hit.hp -= ATK_DMG;
                addFloatingNumber(hit.x, hit.y, ATK_DMG, C_KUKLA);
                applyFreeze(hit, ATK_FREEZE);
                // AoE
                let cnt = 1;
                getActiveEnemies().forEach(e => {
                    if (e !== hit && cnt < ATK_MAX && getDist(b, e) < ATK_AOE_R + e.radius) {
                        e.hp -= ATK_AOE;
                        addFloatingNumber(e.x, e.y, ATK_AOE, C_ACCENT);
                        applyFreeze(e, ATK_FREEZE);
                        cnt++;
                    }
                });
                // Heal
                if (isUlting && kukla) {
                    kukla.hp = Math.min(kukla.maxHp, kukla.hp + KUKLA_HEAL);
                    addFloatingNumber(kukla.x, kukla.y - 10, "+" + KUKLA_HEAL, "#2ecc71");
                }
                kuklaBullets.splice(i, 1);
            }
        }

        // FX
        for (let i = kuklaFX.length - 1; i >= 0; i--) {
            const p = kuklaFX[i];
            p.x += p.vx * ts; p.y += p.vy * ts;
            p.vy += p.gravity * ts;
            p.vx *= 0.95; p.vy *= 0.95;
            p.life -= ts;
            if (p.life <= 0) kuklaFX.splice(i, 1);
        }
        for (let i = kuklaTexts.length - 1; i >= 0; i--) {
            const t = kuklaTexts[i];
            t.y -= 0.7 * ts; t.life -= ts;
            if (t.life <= 0) kuklaTexts.splice(i, 1);
        }
    }

    // DRAW
    chainHook('onDraw', function (ctx2) {
        // Vücut (ultide)
        if (isUlting && vucut) {
            ctx2.save();
            ctx2.globalAlpha = 0.5;
            ctx2.translate(vucut.x, vucut.y);
            ctx2.beginPath(); ctx2.arc(0, 0, 18, 0, Math.PI * 2);
            ctx2.fillStyle = C_BODY; ctx2.fill();
            ctx2.strokeStyle = C_ACCENT; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.globalAlpha = 0.9;
            ctx2.fillStyle = C_ACCENT; ctx2.font = 'bold 10px Arial'; ctx2.textAlign = 'center';
            ctx2.fillText('VÜCUT', 0, -25);
            ctx2.restore();
        }

        // Kukla fırlatma
        if (kuklaThrow) {
            const prog = kuklaThrow.progress;
            const cx = kuklaThrow.startX + (kuklaThrow.targetX - kuklaThrow.startX) * prog;
            const cy = kuklaThrow.startY + (kuklaThrow.targetY - kuklaThrow.startY) * prog;
            const arc = Math.sin(prog * Math.PI) * 100;
            ctx2.save();
            ctx2.globalAlpha = 0.5;
            ctx2.beginPath(); ctx2.arc(kuklaThrow.targetX, kuklaThrow.targetY, KUKLA_R, 0, Math.PI * 2);
            ctx2.strokeStyle = C_KUKLA; ctx2.lineWidth = 3; ctx2.setLineDash([6, 4]); ctx2.stroke();
            ctx2.setLineDash([]); ctx2.globalAlpha = 1;
            ctx2.beginPath(); ctx2.arc(cx, cy - arc, 14, 0, Math.PI * 2);
            ctx2.fillStyle = C_KUKLA; ctx2.fill();
            ctx2.strokeStyle = C_ACCENT; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        }

        // Mark
        if (mark && markTimer > 0) {
            ctx2.save();
            ctx2.translate(mark.x, mark.y);
            ctx2.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
            ctx2.beginPath(); ctx2.arc(0, 0, 20, 0, Math.PI * 2);
            ctx2.strokeStyle = C_ACCENT; ctx2.lineWidth = 3; ctx2.setLineDash([5, 5]); ctx2.stroke();
            ctx2.setLineDash([]); ctx2.globalAlpha = 0.8;
            ctx2.beginPath(); ctx2.arc(0, 0, 6, 0, Math.PI * 2);
            ctx2.fillStyle = C_KUKLA; ctx2.fill();
            ctx2.restore();
        }

        // Kukla
        if (isUlting && kukla) {
            ctx2.save();
            ctx2.translate(kukla.x, kukla.y);
            ctx2.fillStyle = '#e74c3c'; ctx2.fillRect(-20, -kukla.radius - 15, 40, 4);
            ctx2.fillStyle = '#2ecc71'; ctx2.fillRect(-20, -kukla.radius - 15, 40 * (kukla.hp / kukla.maxHp), 4);
            ctx2.rotate(kukla.angle);
            ctx2.beginPath(); ctx2.arc(0, 0, kukla.radius, 0, Math.PI * 2);
            ctx2.fillStyle = C_KUKLA; ctx2.fill();
            ctx2.strokeStyle = C_ACCENT; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        }

        // Kukla mermileri
        kuklaBullets.forEach(b => {
            if (b.isDead) return;
            ctx2.save(); ctx2.translate(b.x, b.y);
            const grad = ctx2.createRadialGradient(0, 0, 0, 0, 0, 12);
            grad.addColorStop(0, '#fff'); grad.addColorStop(0.4, C_KUKLA); grad.addColorStop(1, 'rgba(192,208,224,0)');
            ctx2.beginPath(); ctx2.arc(0, 0, 12, 0, Math.PI * 2); ctx2.fillStyle = grad; ctx2.fill();
            ctx2.rotate(b.angle);
            ctx2.beginPath(); ctx2.moveTo(8, 0); ctx2.lineTo(-6, -4); ctx2.lineTo(-6, 4); ctx2.closePath();
            ctx2.fillStyle = C_KUKLA; ctx2.fill();
            ctx2.restore();
        });

        // Vücut mermileri
        vucutBullets.forEach(b => {
            ctx2.save(); ctx2.translate(b.x, b.y);
            ctx2.beginPath(); ctx2.arc(0, 0, 5, 0, Math.PI * 2);
            ctx2.fillStyle = C_BODY; ctx2.fill();
            ctx2.strokeStyle = C_ACCENT; ctx2.lineWidth = 1; ctx2.stroke();
            ctx2.restore();
        });

        // FX
        kuklaFX.forEach(p => {
            ctx2.save(); ctx2.globalAlpha = Math.min(1, p.life / 15);
            ctx2.beginPath(); ctx2.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx2.fillStyle = p.color; ctx2.fill();
            ctx2.restore();
        });

        // Texts
        kuklaTexts.forEach(t => {
            ctx2.save(); ctx2.globalAlpha = Math.min(1, t.life / 20);
            ctx2.font = t.isLabel ? 'bold 15px Arial' : 'bold 12px Arial';
            ctx2.textAlign = 'center'; ctx2.fillStyle = C_KUKLA; ctx2.strokeStyle = 'rgba(10,20,30,0.9)'; ctx2.lineWidth = 3;
            ctx2.strokeText(t.val, t.x, t.y); ctx2.fillText(t.val, t.x, t.y);
            ctx2.restore();
        });

        // Ulti drag
        if (player.charType === CHAR_ID && ultiAim.active && player.ultReady && !player.isDead && !isUlting) {
            const pullMag = ultiAim.pull < 0.05 ? 1 : ultiAim.pull;
            const dist = Math.min(KUKLA_RANGE, KUKLA_RANGE * pullMag);
            const tx = clampPos(player.x + Math.cos(ultiAim.angle) * dist, WALL_THICKNESS + 30, canvas.width - WALL_THICKNESS - 30);
            const ty = clampPos(player.y + Math.sin(ultiAim.angle) * dist, WALL_THICKNESS + 30, canvas.height - WALL_THICKNESS - 30);
            ctx2.save();
            ctx2.beginPath(); ctx2.moveTo(player.x, player.y); ctx2.lineTo(tx, ty);
            ctx2.strokeStyle = 'rgba(192,208,224,0.6)'; ctx2.lineWidth = 3; ctx2.setLineDash([8, 6]); ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.beginPath(); ctx2.arc(tx, ty, 20, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(192,208,224,0.15)'; ctx2.fill();
            ctx2.strokeStyle = C_KUKLA; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.restore();
        }
    });

    // Arena
    (function () {
        const n = document.getElementById('diff-normal');
        const e = document.getElementById('diff-easy');
        if (n) { n.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); n.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
        if (e) { e.addEventListener('click', () => { window.GAME_MODE = 'arena'; }); e.addEventListener('touchstart', () => { window.GAME_MODE = 'arena'; }, { passive: true }); }
    })();

    console.log('[MOD YÜKLENDİ] kuklaci');
})();