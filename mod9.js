// ========== mod30.js (KOR) - ATEŞ USTASI v3 ==========
(function () {
    'use strict';

    const CHAR_ID = 'kor';
    const C_FIRE = '#e67e22';
    const C_EMBER = '#c0392b';
    const C_FLAME = '#f39c12';
    const C_WHITE = '#fff5e6';
    const CHAR_HP = 2600;
    const CHAR_SPEED = 3.4;

    // Ana saldırı
    const BULLET_DAMAGE = 600;
    const BULLET_MULT = 1.2;
    const BULLET_PIERCE = 3;
    const BULLET_RANGE = 280;
    const BULLET_SPEED = PLAYER_BULLET_SPEED * 0.85;
    const RELOAD_SPEED = 0.012; // 0.006'nın 2 katı

    // Normal patlama (dışa iter)
    const EXPL_RADIUS = 43;
    const EXPL_DAMAGE = 400;
    const EXPL_PUSH = 20;

    // Büyük patlama (Aks 1, içe çeker)
    const BIG_RADIUS = 90;
    const BIG_DAMAGE = 500;
    const BIG_PULL = 50;
    const BIG_SLOW_FACTOR = 0.7;
    const BIG_SLOW_DURATION = 60;
    const KOZ_COOLDOWN = 900;

    // Yanan alan
    const BURN_RADIUS = 60;
    const BURN_DURATION = 180;
    const BURN_DPS_BOT = 100;
    const BURN_DPS_PLAYER = 50;

    // Alev Saçılımı (Aks 2)
    const SACILIM_RADIUS = 150;
    const SACILIM_DAMAGE = 300;
    const SACILIM_HEAL_BASE = 200;
    const SACILIM_HEAL_PER = 100;
    const SACILIM_COOLDOWN = 1200;

    // Ulti
    const ULTI_RADIUS = 150;
    const ULTI_DAMAGE = 600;
    const ULTI_STUN_MS = 2000;
    const ULTI_BURN_DURATION = 180;
    const ULTI_BURN_DPS = 100;

    window.GAME_EXT.characters[CHAR_ID] = { color: C_FIRE, hp: CHAR_HP, speed: CHAR_SPEED };

    let korBullets = [];
    let korExplosions = [];
    let korBurningFields = [];
    let korParticles = [];
    let korTexts = [];
    let korStuns = new Map();
    let korSlows = [];
    let korKozReady = false;
    let korUltiFlash = 0;

    // Saçılım animasyon fazları
    let korSacilimFlashes = [];
    let korSacilimRings = [];
    let korSacilimEmbers = []; // içe emiş parçacıkları

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') return !!prevResult || !!ownResult;
            return ownResult !== undefined ? ownResult : prevResult;
        };
    }

    function applySlow(target, factor, duration) {
        if (!target || target.isDead) return;
        if (!target._korOrigSpeed) target._korOrigSpeed = target.speed;
        const existing = korSlows.find(s => s.target === target);
        if (existing) {
            if (factor < existing.factor) existing.factor = factor;
            if (duration > existing.timer) existing.timer = duration;
        } else {
            korSlows.push({ target, origSpeed: target._korOrigSpeed, factor, timer: duration });
        }
    }

    function applyStun(target, durationMs) {
        if (!target || target.isDead) return;
        const existing = korStuns.get(target);
        if (existing) {
            existing.until = Math.max(existing.until, Date.now() + durationMs);
            return;
        }
        // Orijinal değerleri kaydet
        const origSpeed = target.speed;
        const origInterval = target.shootInterval;
        korStuns.set(target, {
            until: Date.now() + durationMs,
            origSpeed: origSpeed,
            origInterval: origInterval
        });
        target.speed = 0;
        target.shootInterval = 999999;
    }

    function korText(x, y, val, isLabel) {
        korTexts.push({ x, y, val, life: 60, maxLife: 60, isLabel: !!isLabel });
    }

    function spawnFireParticle(x, y, type) {
        const n = type === 'explosion' ? 12 : 4;
        for (let i = 0; i < n; i++) {
            const ang = Math.random() * Math.PI * 2;
            const sp = 2 + Math.random() * 5;
            korParticles.push({
                x, y,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp - (Math.random() < 0.5 ? 1 : 0),
                color: Math.random() < 0.5 ? C_FLAME : C_FIRE,
                size: 2 + Math.random() * 3,
                life: 22 + Math.random() * 20,
                maxLife: 42,
                gravity: 0.06
            });
        }
    }

    // ===== Karakter kartı =====
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + C_FIRE + ';"></div>' +
            '<span>Kor</span>' +
            '<small>Hasar: 600+%20 delici<br>Güç: Büyük Patlama + Saçılım<br>Ulti: Ateş Patlaması</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function clearKorState() {
        korBullets = []; korExplosions = []; korBurningFields = [];
        korParticles = []; korTexts = []; korFlashes();
        korKozReady = false; korUltiFlash = 0;
        korSacilimFlashes = []; korSacilimRings = []; korSacilimEmbers = [];
        // Stun temizliği — botları normale döndür
        korStuns.forEach((v, bot) => {
            if (bot) {
                if (!bot.isDead) bot.speed = v.origSpeed;
                bot.shootInterval = v.origInterval;
                delete bot._korStunUntil;
            }
        });
        korStuns.clear();
        korSlows.forEach(s => { if (s.target && !s.target.isDead) s.target.speed = s.origSpeed; });
        korSlows = [];
    }
    function korFlashes() { /* placeholder — flash ayrı */ }

    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            clearKorState();
            this.reloadSpeed = RELOAD_SPEED;
            if (gadgetBtn) {
                gadgetBtn.style.display = 'flex';
                gadgetBtn.innerHTML = 'BÜYÜK<br>PATLAMA<br><span id="gadget-timer"></span>';
                gadgetBtn.classList.remove('cooldown');
            }
            if (gadgetBtn2) {
                gadgetBtn2.style.display = 'flex';
                gadgetBtn2.innerHTML = 'ALEV<br>SAÇILIMI<br><span id="gadget-timer-2"></span>';
                gadgetBtn2.classList.remove('cooldown');
            }
            if (ultiBtn) {
                ultiBtn.style.display = 'flex';
                ultiBtn.style.background = 'radial-gradient(circle, ' + C_FIRE + ', ' + C_EMBER + ')';
            }
            gadgetTimerText = document.getElementById('gadget-timer');
            gadgetTimerText2 = document.getElementById('gadget-timer-2');
        } else {
            clearKorState();
            if (ultiBtn) ultiBtn.style.background = '';
            if (this.reloadSpeed === RELOAD_SPEED) this.reloadSpeed = 0.015;
        }
    };

    // ===== Ana saldırı =====
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        if (this.ammo < 1 || this.isDead) return;

        korBullets.push({
            x: this.x, y: this.y, sx: this.x, sy: this.y,
            vx: Math.cos(a) * BULLET_SPEED,
            vy: Math.sin(a) * BULLET_SPEED,
            angle: a,
            pierceCount: 0,
            isBig: korKozReady,
            hitTargets: new Set()
        });
        if (korKozReady) {
            korKozReady = false;
            korText(this.x, this.y - 40, "BÜYÜK PATLAMA!", true);
        }
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ===== Aks 1 — Büyük Patlama =====
    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        korKozReady = true;
        this.gadgetReady = false;
        this.gadgetCooldown = KOZ_COOLDOWN;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(KOZ_COOLDOWN / 60) + "s";
        korText(this.x, this.y - 30, "HAZIR!", true);
    };

    // ===== Aks 2 — Alev Saçılımı (4 fazlı) =====
    const originalActivateGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;

        let hitCount = 0;
        getActiveEnemies().forEach(e => {
            if (getDist(this, e) <= SACILIM_RADIUS + e.radius) {
                e.hp -= SACILIM_DAMAGE;
                addFloatingNumber(e.x, e.y, SACILIM_DAMAGE, C_FIRE);
                hitCount++;
                spawnFireParticle(e.x, e.y, 'normal');
            }
        });
        const healAmount = SACILIM_HEAL_BASE + hitCount * SACILIM_HEAL_PER;
        this.hp = Math.min(this.maxHp, this.hp + healAmount);

        // === FAZ 1: Merkez flash (0-3 frame) ===
        korSacilimFlashes.push({ x: this.x, y: this.y, size: 40, life: 3, maxLife: 3 });

        // === FAZ 2: Dışa doğru 2 katman halka ===
        korSacilimRings.push({
            x: this.x, y: this.y,
            innerRadius: 10, outerRadius: SACILIM_RADIUS,
            innerLife: 10, outerLife: 20,
            innerMaxLife: 10, outerMaxLife: 20
        });

        // === FAZ 3: İçe doğru emiş parçacıkları ===
        for (let i = 0; i < 10; i++) {
            const ang = (i / 10) * Math.PI * 2 + Math.random() * 0.2;
            const startR = SACILIM_RADIUS * (0.7 + Math.random() * 0.3);
            korSacilimEmbers.push({
                x: this.x + Math.cos(ang) * startR,
                y: this.y + Math.sin(ang) * startR,
                targetX: this.x, targetY: this.y,
                angle: ang,
                progress: 0,
                speed: 0.03 + Math.random() * 0.02,
                spiral: (Math.random() - 0.5) * 2,
                size: 3 + Math.random() * 2,
                life: 30 + Math.random() * 10,
                maxLife: 40
            });
        }

        // === FAZ 4: Heal yazısı (altın sarısı, yavaş süzülür) ===
        korTexts.push({
            x: this.x, y: this.y - 40,
            val: "+" + healAmount,
            life: 100, maxLife: 100,
            isHeal: true
        });
        if (hitCount > 0) {
            korTexts.push({
                x: this.x, y: this.y - 60,
                val: hitCount + " BOT",
                life: 80, maxLife: 80,
                isSmall: true
            });
        }

        this.gadget2Ready = false;
        this.gadget2Cooldown = SACILIM_COOLDOWN;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(SACILIM_COOLDOWN / 60) + "s";
    };

    // ===== Ulti — kendi etrafında patlama + 2s stun =====
    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;

        korUltiFlash = 12;

        getActiveEnemies().forEach(e => {
            if (getDist(this, e) <= ULTI_RADIUS + e.radius) {
                e.hp -= ULTI_DAMAGE;
                addFloatingNumber(e.x, e.y, ULTI_DAMAGE, C_FLAME);
                if (!e.isDead) applyStun(e, ULTI_STUN_MS);
            }
        });

        korBurningFields.push({
            x: this.x, y: this.y,
            radius: ULTI_RADIUS,
            timer: ULTI_BURN_DURATION,
            dps: ULTI_BURN_DPS,
            tickTimer: 0
        });

        korExplosions.push({
            x: this.x, y: this.y,
            radius: ULTI_RADIUS,
            isUlti: true,
            life: 25, maxLife: 25
        });

        for (let i = 0; i < 24; i++) {
            const ang = (i / 24) * Math.PI * 2;
            const sp = 4 + Math.random() * 4;
            korParticles.push({
                x: this.x, y: this.y,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp,
                color: Math.random() < 0.5 ? C_FLAME : C_FIRE,
                size: 3 + Math.random() * 3,
                life: 30 + Math.random() * 20,
                maxLife: 50,
                gravity: 0.08
            });
        }
        screenShake = 14;
        korText(this.x, this.y - 50, "ATEŞ PATLAMASI!", true);

        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    // ===== Ulti dolumu (%50 yavaş) =====
    chainHook('onChargeUlti', function (amount) {
        if (player.charType !== CHAR_ID) return;
        if (!gameStarted || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount * 0.5);
        if (player.ultCharge >= 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
            korText(player.x, player.y - 40, "GÜÇ HAZIR!", true);
        }
        if (ultFill) ultFill.style.width = player.ultCharge + "%";
    });

    chainHook('onReset', function () { clearKorState(); });

    // ===== Raf loop =====
    let lastT = 0;
    function korLoop(t) {
        if (!lastT) lastT = t;
        const ts = Math.min(3, (t - lastT) / 16.666);
        lastT = t;
        if (gameStarted) {
            try { korUpdate(ts); } catch (err) { console.error('[KOR]', err); }
        }
        requestAnimationFrame(korLoop);
    }
    requestAnimationFrame(korLoop);

    function explodeBullet(b) {
        const radius = b.isBig ? BIG_RADIUS : EXPL_RADIUS;
        const damage = b.isBig ? BIG_DAMAGE : EXPL_DAMAGE;

        korExplosions.push({
            x: b.x, y: b.y,
            radius: radius,
            isBig: b.isBig,
            life: 15, maxLife: 15
        });

        getActiveEnemies().forEach(e => {
            if (getDist(b, e) < radius + e.radius) {
                e.hp -= damage;
                addFloatingNumber(e.x, e.y, damage, C_FIRE);
                const ang = getAngle(e, b);
                if (b.isBig) {
                    // Aksesuar patlaması: İÇE çeker
                    e.x += Math.cos(ang) * BIG_PULL;
                    e.y += Math.sin(ang) * BIG_PULL;
                    applySlow(e, BIG_SLOW_FACTOR, BIG_SLOW_DURATION);
                } else {
                    // Normal patlama: DIŞA iter
                    e.x -= Math.cos(ang) * EXPL_PUSH;
                    e.y -= Math.sin(ang) * EXPL_PUSH;
                }
                e.x = clampPos(e.x, e.radius + WALL_THICKNESS, canvas.width - e.radius - WALL_THICKNESS);
                e.y = clampPos(e.y, e.radius + WALL_THICKNESS, canvas.height - e.radius - WALL_THICKNESS);
            }
        });

        korBurningFields.push({
            x: b.x, y: b.y,
            radius: BURN_RADIUS,
            timer: BURN_DURATION,
            dps: BURN_DPS_BOT,
            tickTimer: 0
        });

        spawnFireParticle(b.x, b.y, 'explosion');
        screenShake = b.isBig ? 10 : 4;
    }

    function korUpdate(ts) {
        if (player.charType === CHAR_ID) {
            if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
            if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
            if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';
        }
        // Stun temizliği — süre bittiğinde orijinal değerlere dön
        korStuns.forEach((v, bot) => {
            if (!bot || bot.isDead || Date.now() >= v.until) {
                if (bot) {
                    if (!bot.isDead) bot.speed = v.origSpeed;
                    bot.shootInterval = v.origInterval;
                }
                korStuns.delete(bot);
            }
        });
        // Yavaşlatma
        for (let i = korSlows.length - 1; i >= 0; i--) {
            const s = korSlows[i];
            if (!s.target || s.target.isDead) { korSlows.splice(i, 1); continue; }
            s.target.speed = s.origSpeed * s.factor;
            s.timer -= ts;
            if (s.timer <= 0) {
                if (!s.target.isDead) s.target.speed = s.origSpeed;
                korSlows.splice(i, 1);
            }
        }
        // Mermiler
        for (let i = korBullets.length - 1; i >= 0; i--) {
            const b = korBullets[i];
            b.x += b.vx * ts; b.y += b.vy * ts;
            const hw = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - WALL_THICKNESS - 5 ||
                       b.y < WALL_THICKNESS + 5 || b.y > canvas.height - WALL_THICKNESS - 5;
            let hitObs = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(b, o) < o.radius + 8) { o.hp -= 50; hitObs = true; break; }
            }
            if (hw || hitObs) { explodeBullet(b); korBullets.splice(i, 1); continue; }
            if (getDist({ x: b.sx, y: b.sy }, b) > BULLET_RANGE) {
                korBullets.splice(i, 1);
                continue;
            }
            let removed = false;
            for (const e of getActiveEnemies()) {
                if (b.hitTargets.has(e)) continue;
                if (getDist(b, e) < e.radius + 12) {
                    b.hitTargets.add(e);
                    const dmg = Math.round(BULLET_DAMAGE * Math.pow(BULLET_MULT, b.pierceCount));
                    e.hp -= dmg;
                    addFloatingNumber(e.x, e.y, dmg, C_FIRE);
                    spawnFireParticle(e.x, e.y, 'normal');
                    b.pierceCount++;
                    if (b.pierceCount >= BULLET_PIERCE) {
                        explodeBullet(b);
                        korBullets.splice(i, 1);
                        removed = true;
                        break;
                    }
                }
            }
            if (removed) continue;
        }
        // Yanan alanlar
        for (let i = korBurningFields.length - 1; i >= 0; i--) {
            const bf = korBurningFields[i];
            bf.timer -= ts;
            bf.tickTimer = (bf.tickTimer || 0) + ts;
            const doTick = bf.tickTimer >= 60;
            if (doTick) bf.tickTimer = 0;
            getActiveEnemies().forEach(e => {
                if (getDist(bf, e) < bf.radius + e.radius) {
                    e.hp -= (bf.dps / 60) * ts;
                    if (doTick) addFloatingNumber(e.x, e.y, bf.dps, C_FIRE);
                }
            });
            if (!player.isDead && getDist(bf, player) < bf.radius + player.radius) {
                player.hp -= (BURN_DPS_PLAYER / 60) * ts;
                if (doTick) addFloatingNumber(player.x, player.y, BURN_DPS_PLAYER, C_EMBER);
            }
            if (Math.random() < 0.2) {
                const ang = Math.random() * Math.PI * 2;
                const r = Math.random() * bf.radius;
                korParticles.push({
                    x: bf.x + Math.cos(ang) * r, y: bf.y + Math.sin(ang) * r,
                    vx: (Math.random() - 0.5) * 0.4, vy: -0.8 - Math.random(),
                    color: Math.random() < 0.5 ? C_FLAME : C_FIRE,
                    size: 1.5 + Math.random() * 1.5,
                    life: 25 + Math.random() * 15, maxLife: 40,
                    gravity: -0.02
                });
            }
            if (bf.timer <= 0) korBurningFields.splice(i, 1);
        }
        // Patlamalar (görsel)
        for (let i = korExplosions.length - 1; i >= 0; i--) {
            korExplosions[i].life -= ts;
            if (korExplosions[i].life <= 0) korExplosions.splice(i, 1);
        }
        // Saçılım fazları
        for (let i = korSacilimFlashes.length - 1; i >= 0; i--) {
            korSacilimFlashes[i].life -= ts;
            if (korSacilimFlashes[i].life <= 0) korSacilimFlashes.splice(i, 1);
        }
        for (let i = korSacilimRings.length - 1; i >= 0; i--) {
            const r = korSacilimRings[i];
            r.innerLife -= ts;
            r.outerLife -= ts;
            if (r.innerLife <= 0 && r.outerLife <= 0) korSacilimRings.splice(i, 1);
        }
        for (let i = korSacilimEmbers.length - 1; i >= 0; i--) {
            const em = korSacilimEmbers[i];
            em.progress += em.speed * ts;
            const r = (1 - em.progress) * Math.hypot(em.x - em.targetX, em.y - em.targetY);
            // Spiral ile içe ak
            const spiralAngle = em.angle + em.progress * Math.PI * em.spiral;
            em.x = em.targetX + Math.cos(spiralAngle) * r;
            em.y = em.targetY + Math.sin(spiralAngle) * r;
            em.life -= ts;
            if (em.progress >= 1 || em.life <= 0) korSacilimEmbers.splice(i, 1);
        }
        // Partiküller
        for (let i = korParticles.length - 1; i >= 0; i--) {
            const p = korParticles[i];
            p.x += p.vx * ts; p.y += p.vy * ts;
            p.vy += p.gravity * ts;
            p.vx *= 0.95; p.vy *= 0.95;
            p.life -= ts;
            if (p.life <= 0) korParticles.splice(i, 1);
        }
        // Yazılar
        for (let i = korTexts.length - 1; i >= 0; i--) {
            const t = korTexts[i];
            t.y -= (t.isHeal ? 0.4 : 0.7) * ts;
            t.life -= ts;
            if (t.life <= 0) korTexts.splice(i, 1);
        }
        if (korUltiFlash > 0) korUltiFlash -= ts;
    }

    // ===== Öngören nişan çizgisi — 3 düşman delme yolunu göster =====
    function drawPredictiveAimLine(ctx2) {
        if (player.charType !== CHAR_ID || player.isDead || player.ammo < 1) return;
        if (!aimData.active) return;

        const ang = aimData.angle;
        const startX = player.x, startY = player.y;
        const endX = startX + Math.cos(ang) * BULLET_RANGE;
        const endY = startY + Math.sin(ang) * BULLET_RANGE;

        // Ana çizgi (ateş hattı)
        ctx2.save();
        ctx2.globalAlpha = 0.55;
        const grad = ctx2.createLinearGradient(startX, startY, endX, endY);
        grad.addColorStop(0, 'rgba(243,156,18,0.9)');
        grad.addColorStop(0.5, 'rgba(230,126,34,0.6)');
        grad.addColorStop(1, 'rgba(192,57,43,0.15)');
        ctx2.strokeStyle = grad;
        ctx2.lineWidth = 3;
        ctx2.beginPath();
        ctx2.moveTo(startX, startY);
        ctx2.lineTo(endX, endY);
        ctx2.stroke();

        // Menzil sonu işareti
        ctx2.globalAlpha = 0.7;
        ctx2.beginPath();
        ctx2.arc(endX, endY, 6, 0, Math.PI * 2);
        ctx2.strokeStyle = 'rgba(230,126,34,0.9)';
        ctx2.lineWidth = 2;
        ctx2.stroke();

        // Çizgi üzerindeki düşmanları vurgula (potansiyel delme hedefleri)
        const onLineEnemies = [];
        getActiveEnemies().forEach(e => {
            const distToLine = pointToLineDistance(e, startX, startY, endX, endY);
            const distAlong = Math.hypot(e.x - startX, e.y - startY);
            const distProjection = (e.x - startX) * Math.cos(ang) + (e.y - startY) * Math.sin(ang);
            if (distToLine < e.radius + 12 && distProjection > 0 && distProjection < BULLET_RANGE) {
                onLineEnemies.push({ e, distAlong });
            }
        });
        onLineEnemies.sort((a, b) => a.distAlong - b.distAlong);

        // İlk 3 düşmanı vurgula
        onLineEnemies.slice(0, 3).forEach((item, idx) => {
            const e = item.e;
            ctx2.save();
            ctx2.globalAlpha = 0.6 + Math.sin(Date.now() / 200 + idx) * 0.2;
            ctx2.beginPath();
            ctx2.arc(e.x, e.y, e.radius + 6, 0, Math.PI * 2);
            ctx2.strokeStyle = idx < 3 ? C_FLAME : C_EMBER;
            ctx2.lineWidth = 2.5;
            ctx2.setLineDash([5, 4]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            // Numaralandırma
            ctx2.globalAlpha = 0.9;
            ctx2.font = 'bold 12px Arial';
            ctx2.textAlign = 'center';
            ctx2.fillStyle = C_WHITE;
            ctx2.strokeStyle = 'rgba(40,20,10,0.9)';
            ctx2.lineWidth = 2;
            const label = (idx + 1) + '×';
            ctx2.strokeText(label, e.x, e.y - e.radius - 12);
            ctx2.fillText(label, e.x, e.y - e.radius - 12);
            ctx2.restore();
        });

        ctx2.restore();
    }

    function pointToLineDistance(px, py, x1, y1, x2, y2) {
        const dx = px - x1, dy = py - y1;
        const lx = x2 - x1, ly = y2 - y1;
        const len2 = lx * lx + ly * ly;
        if (len2 === 0) return Math.hypot(dx, dy);
        let t = (dx * lx + dy * ly) / len2;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * lx, projY = y1 + t * ly;
        return Math.hypot(px - projX, py - projY);
    }

    // ===== Çizim =====
    chainHook('onDraw', function (ctx2) {
        // Öngören nişan çizgisi (en altta, görselin arkasında)
        drawPredictiveAimLine(ctx2);

        // Yanan alanlar
        korBurningFields.forEach(bf => {
            const alpha = Math.min(0.4, bf.timer / 60 * 0.4);
            ctx2.save();
            const grad = ctx2.createRadialGradient(bf.x, bf.y, 0, bf.x, bf.y, bf.radius);
            grad.addColorStop(0, `rgba(230,126,34,${alpha * 1.3})`);
            grad.addColorStop(0.6, `rgba(192,57,43,${alpha * 0.8})`);
            grad.addColorStop(1, 'rgba(192,57,43,0)');
            ctx2.beginPath(); ctx2.arc(bf.x, bf.y, bf.radius, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();
            ctx2.beginPath(); ctx2.arc(bf.x, bf.y, bf.radius, 0, Math.PI * 2);
            ctx2.strokeStyle = `rgba(243,156,18,${alpha * 2})`;
            ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        });

        // Patlamalar
        korExplosions.forEach(ex => {
            const prog = 1 - (ex.life / ex.maxLife);
            const alpha = 1 - prog;
            const r = ex.radius * (0.4 + prog * 0.6);
            ctx2.save();
            if (ex.isUlti) {
                ctx2.beginPath(); ctx2.arc(ex.x, ex.y, r, 0, Math.PI * 2);
                ctx2.fillStyle = `rgba(243,156,18,${alpha * 0.4})`; ctx2.fill();
                ctx2.beginPath(); ctx2.arc(ex.x, ex.y, r, 0, Math.PI * 2);
                ctx2.strokeStyle = `rgba(255,255,255,${alpha * 0.9})`;
                ctx2.lineWidth = 5; ctx2.stroke();
                ctx2.beginPath(); ctx2.arc(ex.x, ex.y, r * 1.15, 0, Math.PI * 2);
                ctx2.strokeStyle = `rgba(230,126,34,${alpha * 0.7})`;
                ctx2.lineWidth = 3; ctx2.stroke();
            } else if (ex.isBig) {
                // Büyük patlama — içe çekim çizgileri
                ctx2.beginPath(); ctx2.arc(ex.x, ex.y, r, 0, Math.PI * 2);
                ctx2.fillStyle = `rgba(255,245,230,${alpha * 0.35})`; ctx2.fill();
                ctx2.beginPath(); ctx2.arc(ex.x, ex.y, r, 0, Math.PI * 2);
                ctx2.strokeStyle = `rgba(255,245,230,${alpha})`;
                ctx2.lineWidth = 5; ctx2.stroke();
                // İçe çekim çizgileri
                ctx2.strokeStyle = `rgba(243,156,18,${alpha * 0.7})`;
                ctx2.lineWidth = 2;
                for (let k = 0; k < 8; k++) {
                    const a2 = (k / 8) * Math.PI * 2 + Date.now() / 300;
                    ctx2.beginPath();
                    ctx2.moveTo(ex.x + Math.cos(a2) * r * 0.8, ex.y + Math.sin(a2) * r * 0.8);
                    ctx2.lineTo(ex.x + Math.cos(a2) * r * 0.4, ex.y + Math.sin(a2) * r * 0.4);
                    ctx2.stroke();
                }
            } else {
                ctx2.beginPath(); ctx2.arc(ex.x, ex.y, r, 0, Math.PI * 2);
                ctx2.fillStyle = `rgba(243,156,18,${alpha * 0.5})`; ctx2.fill();
                ctx2.beginPath(); ctx2.arc(ex.x, ex.y, r, 0, Math.PI * 2);
                ctx2.strokeStyle = `rgba(230,126,34,${alpha * 0.9})`;
                ctx2.lineWidth = 3; ctx2.stroke();
                // Dışa itme çizgileri (küçük oklar)
                ctx2.strokeStyle = `rgba(230,126,34,${alpha * 0.5})`;
                ctx2.lineWidth = 1.5;
                for (let k = 0; k < 6; k++) {
                    const a2 = (k / 6) * Math.PI * 2;
                    ctx2.beginPath();
                    ctx2.moveTo(ex.x + Math.cos(a2) * r * 0.9, ex.y + Math.sin(a2) * r * 0.9);
                    ctx2.lineTo(ex.x + Math.cos(a2) * r * 1.1, ex.y + Math.sin(a2) * r * 1.1);
                    ctx2.stroke();
                }
            }
            ctx2.restore();
        });

        // Saçılım — Faz 1: Flash
        korSacilimFlashes.forEach(f => {
            const prog = 1 - (f.life / f.maxLife);
            const size = f.size * (0.5 + prog * 0.5);
            ctx2.save();
            const grad = ctx2.createRadialGradient(f.x, f.y, 0, f.x, f.y, size);
            grad.addColorStop(0, `rgba(255,255,255,${(1 - prog) * 0.9})`);
            grad.addColorStop(0.5, `rgba(243,156,18,${(1 - prog) * 0.6})`);
            grad.addColorStop(1, 'rgba(230,126,34,0)');
            ctx2.beginPath(); ctx2.arc(f.x, f.y, size, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();
            ctx2.restore();
        });

        // Saçılım — Faz 2: Dışa doğru halkalar
        korSacilimRings.forEach(r => {
            const innerProg = 1 - (r.innerLife / r.innerMaxLife);
            const outerProg = 1 - (r.outerLife / r.outerMaxLife);
            ctx2.save();
            if (r.innerLife > 0) {
                const ir = r.innerRadius + (r.outerRadius * 0.6) * innerProg;
                ctx2.beginPath(); ctx2.arc(r.x, r.y, ir, 0, Math.PI * 2);
                ctx2.strokeStyle = `rgba(243,156,18,${(1 - innerProg) * 0.9})`;
                ctx2.lineWidth = 4; ctx2.stroke();
            }
            if (r.outerLife > 0) {
                const or = r.innerRadius + r.outerRadius * outerProg;
                ctx2.beginPath(); ctx2.arc(r.x, r.y, or, 0, Math.PI * 2);
                ctx2.strokeStyle = `rgba(192,57,43,${(1 - outerProg) * 0.8})`;
                ctx2.lineWidth = 3; ctx2.stroke();
            }
            ctx2.restore();
        });

        // Saçılım — Faz 3: İçe emiş parçacıkları
        korSacilimEmbers.forEach(em => {
            const alpha = Math.min(1, em.life / 15);
            ctx2.save();
            ctx2.globalAlpha = alpha;
            const grad = ctx2.createRadialGradient(em.x, em.y, 0, em.x, em.y, em.size * 2);
            grad.addColorStop(0, C_WHITE);
            grad.addColorStop(0.5, C_FLAME);
            grad.addColorStop(1, 'rgba(192,57,43,0)');
            ctx2.beginPath(); ctx2.arc(em.x, em.y, em.size * 2, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();
            ctx2.beginPath(); ctx2.arc(em.x, em.y, em.size, 0, Math.PI * 2);
            ctx2.fillStyle = C_FLAME; ctx2.fill();
            ctx2.restore();
        });

        // Mermiler (büyütülmüş)
        korBullets.forEach(b => {
            ctx2.save();
            ctx2.translate(b.x, b.y); ctx2.rotate(b.angle);
            const grad = ctx2.createLinearGradient(-30, 0, 14, 0);
            grad.addColorStop(0, 'rgba(230,126,34,0)');
            grad.addColorStop(1, b.isBig ? 'rgba(255,255,255,0.98)' : 'rgba(243,156,18,0.95)');
            // Gövde — büyütülmüş
            ctx2.beginPath();
            ctx2.moveTo(-28, -5); ctx2.lineTo(10, -8); ctx2.lineTo(16, 0); ctx2.lineTo(10, 8); ctx2.lineTo(-28, 5);
            ctx2.closePath();
            ctx2.fillStyle = grad; ctx2.fill();
            // Dış aura
            ctx2.beginPath();
            ctx2.arc(0, 0, b.isBig ? 12 : 8, 0, Math.PI * 2);
            const glowGrad = ctx2.createRadialGradient(0, 0, 0, 0, 0, b.isBig ? 12 : 8);
            glowGrad.addColorStop(0, b.isBig ? 'rgba(255,255,255,1)' : 'rgba(243,156,18,0.9)');
            glowGrad.addColorStop(1, 'rgba(230,126,34,0)');
            ctx2.fillStyle = glowGrad;
            ctx2.fill();
            ctx2.restore();
        });

        // Partiküller
        korParticles.forEach(p => {
            const alpha = Math.min(1, p.life / 20);
            ctx2.save(); ctx2.globalAlpha = alpha;
            ctx2.beginPath(); ctx2.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx2.fillStyle = p.color; ctx2.fill();
            ctx2.restore();
        });

        // Stun göstergesi
        korStuns.forEach((v, bot) => {
            if (!bot || bot.isDead) return;
            const remain = v.until - Date.now();
            if (remain <= 0) return;
            ctx2.save();
            const alpha = 0.6 + Math.sin(Date.now() / 80) * 0.3;
            ctx2.globalAlpha = alpha;
            ctx2.font = 'bold 22px Arial';
            ctx2.textAlign = 'center';
            ctx2.fillStyle = C_FLAME;
            ctx2.strokeStyle = 'rgba(40,20,10,0.9)';
            ctx2.lineWidth = 3;
            ctx2.strokeText('✦', bot.x, bot.y - bot.radius - 20);
            ctx2.fillText('✦', bot.x, bot.y - bot.radius - 20);
            ctx2.restore();
            ctx2.save();
            ctx2.beginPath();
            ctx2.arc(bot.x, bot.y, bot.radius + 6, 0, Math.PI * 2);
            ctx2.strokeStyle = `rgba(243,156,18,${alpha * 0.8})`;
            ctx2.lineWidth = 3; ctx2.setLineDash([6, 6]); ctx2.stroke();
            ctx2.setLineDash([]); ctx2.restore();
        });

        // Flash
        if (korUltiFlash > 0) {
            ctx2.save();
            ctx2.globalAlpha = korUltiFlash / 12 * 0.4;
            ctx2.fillStyle = '#fff';
            ctx2.fillRect(0, 0, canvas.width, canvas.height);
            ctx2.restore();
        }

        // Yazılar
        korTexts.forEach(t => {
            const alpha = Math.min(1, t.life / 20);
            ctx2.save(); ctx2.globalAlpha = alpha;
            if (t.isHeal) {
                // Heal yazısı — altın sarısı, parlak
                ctx2.font = 'bold 24px Arial';
                ctx2.textAlign = 'center';
                ctx2.shadowColor = C_FLAME;
                ctx2.shadowBlur = 15;
                ctx2.fillStyle = '#f1c40f';
                ctx2.strokeStyle = 'rgba(80,40,0,0.9)';
                ctx2.lineWidth = 3;
                ctx2.strokeText(t.val, t.x, t.y);
                ctx2.fillText(t.val, t.x, t.y);
            } else if (t.isSmall) {
                ctx2.font = 'bold 12px Arial';
                ctx2.textAlign = 'center';
                ctx2.fillStyle = C_WHITE;
                ctx2.strokeStyle = 'rgba(40,20,10,0.9)';
                ctx2.lineWidth = 2;
                ctx2.strokeText(t.val, t.x, t.y);
                ctx2.fillText(t.val, t.x, t.y);
            } else {
                ctx2.font = t.isLabel ? 'bold 15px Arial' : 'bold 13px Arial';
                ctx2.textAlign = 'center';
                ctx2.fillStyle = C_FLAME;
                ctx2.strokeStyle = 'rgba(40,20,10,0.9)';
                ctx2.lineWidth = 3;
                ctx2.strokeText(t.val, t.x, t.y);
                ctx2.fillText(t.val, t.x, t.y);
            }
            ctx2.restore();
        });
    });
})();