// ========== mod34.js (SÜRÜ) — Çağırıcı (v2 düzeltilmiş) ==========
(function () {
    'use strict';

    const CHAR_ID = 'suru';
    const C_MAIN = '#8e44ad';
    const C_LIGHT = '#a569bd';
    const C_DARK = '#4a235a';
    const C_SHADOW = '#2c1a3d';
    const C_TOWER = '#5d6d7e';
    const C_BOMB = '#c0392b';
    const C_ELITE = '#f1c40f';
    const C_BOND = '#9b59b6';
    const C_WHITE = '#ffffff';

    const CHAR_HP = 3000;
    const CHAR_SPEED = 3.4;
    const MAIN_DMG = 250;

    const BAR_MAX = 1000;
    const BOND_PCT = 0.4;
    const ELITE_KILLS = 3;
    const MAX_MINIONS = 9;

    const AKS1_CD = 900;
    const AKS1_HEAL = 300;
    const AKS2_CD = 1080;
    const AKS2_DURATION = 300;
    const AKS2_BAR_MULT = 3;

    const ULTI_DURATION = 480;
    const ULTI_SPEED_BUFF = 1.5;

    const M1_HP = 600, M1_SPD = 2.0, M1_DMG = 200, M1_RAD = 12;
    const M2_HP = 400, M2_SPD = 0, M2_DMG = 250, M2_RAD = 14, M2_RANGE = 180, M2_INT = 60;
    const M3_HP = 300, M3_SPD = 1.5, M3_DMG = 400, M3_RAD = 10, M3_AOE = 60;

    window.GAME_EXT.characters[CHAR_ID] = { color: C_MAIN, hp: CHAR_HP, speed: CHAR_SPEED };

    let suruBullets = [];
    let minions = [];
    let suruBar = 0;
    let suruFX = [];
    let screenFlash = 0;
    let aks1CD = 0, aks1Ready = true;
    let aks2CD = 0, aks2Ready = true;
    let aks2Active = 0;
    let ultiBuffActive = 0;

    if (!window._suruOrigDrawEntity) {
        window._suruOrigDrawEntity = window.drawEntity;
        window.drawEntity = function (e, isP) {
            if (!e) return;
            if (isP && player && player.charType === CHAR_ID) return;
            if (e._isMinion) return;
            return window._suruOrigDrawEntity.call(this, e, isP);
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

    function burst(x, y, n, c, speed) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const sp = speed || 4;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = 1 + Math.random() * sp;
            suruFX.push({
                x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                size: 1.5 + Math.random() * 2,
                life: 20 + Math.random() * 20, maxLife: 40,
                color: c, gravity: 0.05
            });
        }
    }

    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + C_MAIN + ';"></div>' +
            '<span>Sürü</span>' +
            '<small>Minyon Çağırıcı<br>Bağ + Büyüme<br>Ulti: Sürü Öfkesi</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    function clearAll() {
        suruBullets = [];
        minions = [];
        suruBar = 0;
        suruFX = [];
        screenFlash = 0;
        aks1CD = 0; aks1Ready = true;
        aks2CD = 0; aks2Ready = true;
        aks2Active = 0;
        ultiBuffActive = 0;
    }

    const origSet = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        origSet.call(this, type);
        if (type === CHAR_ID) {
            clearAll();
            this.hp = this.maxHp = CHAR_HP;
            this.speed = this.originalSpeed = CHAR_SPEED;
            if (gadgetBtn) {
                gadgetBtn.style.display = 'flex';
                gadgetBtn.innerHTML = 'BAĞ<br>KOPMASI<br><span id="gadget-timer"></span>';
                gadgetBtn.classList.remove('cooldown');
            }
            if (gadgetBtn2) {
                gadgetBtn2.style.display = 'flex';
                gadgetBtn2.innerHTML = 'SÜRÜ<br>ÇAĞRISI<br><span id="gadget-timer-2"></span>';
                gadgetBtn2.classList.remove('cooldown');
            }
            if (ultiBtn) {
                ultiBtn.style.display = 'flex';
                ultiBtn.style.background = 'radial-gradient(circle, #a569bd, #4a235a)';
            }
            if (typeof gadgetTimerText !== 'undefined') gadgetTimerText = document.getElementById('gadget-timer');
            if (typeof gadgetTimerText2 !== 'undefined') gadgetTimerText2 = document.getElementById('gadget-timer-2');
        } else {
            clearAll();
            if (ultiBtn) ultiBtn.style.background = '';
        }
    };

    function spawnMinion(type, x, y) {
        if (minions.length >= MAX_MINIONS) return null;
        const base = {
            x, y, _isMinion: true, isDead: false,
            type: type, kills: 0, isElite: false,
            lastShot: 0, angle: 0, _atkCD: 0
        };
        if (type === 'shadow') {
            Object.assign(base, { hp: M1_HP, maxHp: M1_HP, speed: M1_SPD, radius: M1_RAD, damage: M1_DMG });
        } else if (type === 'tower') {
            Object.assign(base, { hp: M2_HP, maxHp: M2_HP, speed: 0, radius: M2_RAD, damage: M2_DMG });
        } else {
            Object.assign(base, { hp: M3_HP, maxHp: M3_HP, speed: M3_SPD, radius: M3_RAD, damage: M3_DMG });
        }
        minions.push(base);
        burst(x, y, 8, C_MAIN);
        return base;
    }

    function getMinionType() {
        const pct = suruBar / BAR_MAX;
        if (pct >= 1) return 'bomb';
        if (pct >= 0.66) return 'tower';
        return 'shadow';
    }

    // ===== ANA SALDIRI =====
    const origFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pull) {
        if (this.charType !== CHAR_ID) return origFire.call(this, a, pull);
        if (this.ammo < 1 || this.isDead) return;
        if (!Number.isFinite(a)) a = this.angle || 0;

        // Bar dolu + limit müsait → minyon çağır
        if (suruBar >= BAR_MAX && minions.length < MAX_MINIONS) {
            const type = getMinionType();
            spawnMinion(type, this.x + (Math.random() - 0.5) * 30, this.y + 40);
            suruBar = 0;
            addFloatingNumber(this.x, this.y - 40, type === 'shadow' ? 'GÖLGE!' : type === 'tower' ? 'KULE!' : 'BOMBA!', C_MAIN);
        }

        suruBullets.push({
            x: this.x, y: this.y, sx: this.x, sy: this.y,
            vx: Math.cos(a) * PLAYER_BULLET_SPEED,
            vy: Math.sin(a) * PLAYER_BULLET_SPEED,
            angle: a, life: 0, maxLife: 55, isDead: false
        });
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ===== AKSESUAR 1 — BAĞ KOPMASI =====
    const origGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget.call(this, a, pull);
        if (!aks1Ready || this.isDead) return;

        minions.forEach((m, idx) => {
            const ang = (idx / Math.max(1, minions.length)) * Math.PI * 2;
            const r = 60;
            m.x = this.x + Math.cos(ang) * r;
            m.y = this.y + Math.sin(ang) * r;
            m.hp = Math.min(m.maxHp, m.hp + AKS1_HEAL);
            burst(m.x, m.y, 6, C_BOND);
        });

        aks1Ready = false;
        aks1CD = AKS1_CD;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(AKS1_CD / 60) + "s";
        addFloatingNumber(this.x, this.y - 40, 'BAĞ KOPMASI!', C_BOND);
        burst(this.x, this.y, 15, C_BOND);
    };

    // ===== AKSESUAR 2 — SÜRÜ ÇAĞRISI (3x bar) =====
    const origGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return origGadget2.call(this, a, pull);
        if (!aks2Ready || this.isDead) return;
        aks2Active = AKS2_DURATION;
        aks2Ready = false;
        aks2CD = AKS2_CD;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(AKS2_CD / 60) + "s";
        addFloatingNumber(this.x, this.y - 40, 'SÜRÜ ÇAĞRISI!', C_LIGHT);
        burst(this.x, this.y, 15, C_LIGHT);
    };

    // ===== ULTI — SÜRÜ ÖFKESİ =====
    const origUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return origUlti.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;

        ultiBuffActive = ULTI_DURATION;

        // Tüm minyonlar Elite olur (kalıcı) + hız buff (8s)
        minions.forEach(m => {
            if (!m.isElite) {
                m.isElite = true;
                m.maxHp = m.maxHp * 2;
                m.hp = m.maxHp;
                m.damage = m.damage * 2;
                burst(m.x, m.y, 10, C_ELITE);
            }
        });

        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = '0%';
        if (ultiBtn) ultiBtn.classList.remove('ready');
        addFloatingNumber(this.x, this.y - 50, 'SÜRÜ ÖFKESİ!', C_ELITE);
        screenFlash = 10;
    };

    chainHook('onReset', function () { clearAll(); });

    // ===== UPDATE =====
    chainHook('onUpdate', function (ts) {
        if (player.charType !== CHAR_ID) return;
        if (!gameStarted) return;

        if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
        if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
        if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';

        if (aks2Active > 0) {
            aks2Active -= ts;
            if (aks2Active <= 0) aks2Active = 0;
        }

        if (aks1CD > 0) {
            aks1CD -= ts;
            if (aks1CD <= 0) {
                aks1CD = 0; aks1Ready = true;
                if (gadgetBtn) gadgetBtn.classList.remove('cooldown');
                if (gadgetTimerText) gadgetTimerText.innerText = '';
            }
        }
        if (aks2CD > 0) {
            aks2CD -= ts;
            if (aks2CD <= 0) {
                aks2CD = 0; aks2Ready = true;
                if (gadgetBtn2) gadgetBtn2.classList.remove('cooldown');
                if (gadgetTimerText2) gadgetTimerText2.innerText = '';
            }
        }
        if (ultiBuffActive > 0) {
            ultiBuffActive -= ts;
            if (ultiBuffActive <= 0) ultiBuffActive = 0;
        }

        // Minyonlar
        for (let i = minions.length - 1; i >= 0; i--) {
            const m = minions[i];
            if (m.isDead || m.hp <= 0) {
                minions.splice(i, 1);
                burst(m.x, m.y, 8, C_DARK);
                continue;
            }

            let target = null, minD = Infinity;
            getActiveEnemies().forEach(e => {
                if (e.isDead) return;
                const d = getDist(m, e);
                if (d < minD) { minD = d; target = e; }
            });
            if (!target) continue;
            m.angle = Math.atan2(target.y - m.y, target.x - m.x);

            const speedMult = ultiBuffActive > 0 ? ULTI_SPEED_BUFF : 1;

            if (m.type === 'shadow') {
                if (minD > m.radius + target.radius) {
                    m.x += Math.cos(m.angle) * m.speed * speedMult * ts;
                    m.y += Math.sin(m.angle) * m.speed * speedMult * ts;
                } else {
                    if (m._atkCD <= 0) {
                        const wasAlive = target.hp > 0;
                        target.hp -= m.damage;
                        addFloatingNumber(target.x, target.y, m.damage, C_SHADOW);
                        if (wasAlive && target.hp <= 0) m.kills++;
                        m._atkCD = 30;
                    }
                }
            } else if (m.type === 'tower') {
                m.lastShot += ts;
                if (minD < M2_RANGE && m.lastShot >= M2_INT) {
                    m.lastShot = 0;
                    const ang = Math.atan2(target.y - m.y, target.x - m.x);
                    suruBullets.push({
                        x: m.x, y: m.y, sx: m.x, sy: m.y,
                        vx: Math.cos(ang) * PLAYER_BULLET_SPEED * 0.9,
                        vy: Math.sin(ang) * PLAYER_BULLET_SPEED * 0.9,
                        angle: ang, life: 0, maxLife: 40,
                        isDead: false, isMinionBullet: true, minionDmg: m.damage, owner: m
                    });
                }
            } else if (m.type === 'bomb' && !m._exploded) {
                if (minD > m.radius + target.radius + 5) {
                    m.x += Math.cos(m.angle) * m.speed * speedMult * ts;
                    m.y += Math.sin(m.angle) * m.speed * speedMult * ts;
                } else {
                    m._exploded = true;
                    getActiveEnemies().forEach(e => {
                        if (e.isDead) return;
                        if (getDist(m, e) < M3_AOE + e.radius) {
                            e.hp -= m.damage;
                            addFloatingNumber(e.x, e.y, m.damage, C_BOMB);
                        }
                    });
                    suruFX.push({ type: 'explosion', x: m.x, y: m.y, radius: 0, maxRadius: M3_AOE, life: 15, maxLife: 15 });
                    m.hp = 0;
                }
            }

            if (m._atkCD > 0) m._atkCD -= ts;

            if (!m.isElite && m.kills >= ELITE_KILLS) {
                m.isElite = true;
                m.maxHp = m.maxHp * 2;
                m.hp = m.maxHp;
                m.damage = m.damage * 2;
                burst(m.x, m.y, 10, C_ELITE);
                addFloatingNumber(m.x, m.y - 20, 'ELİTE!', C_ELITE);
            }
        }

        for (let i = suruFX.length - 1; i >= 0; i--) {
            const p = suruFX[i];
            if (p.type === 'explosion') {
                p.radius = p.maxRadius * (1 - p.life / p.maxLife);
            } else {
                p.x += p.vx * ts; p.y += p.vy * ts;
                p.vy += p.gravity * ts;
                p.vx *= 0.95; p.vy *= 0.95;
            }
            p.life -= ts;
            if (p.life <= 0) suruFX.splice(i, 1);
        }
        if (screenFlash > 0) screenFlash -= ts;

        if (ultiBtn) {
            if (ultiBuffActive > 0) ultiBtn.style.boxShadow = '0 0 25px #f1c40f';
            else ultiBtn.style.boxShadow = '';
        }
    });

    // ===== GET EXTRA TARGETS — Minyonlar düşman mermilerine hedef =====
    window.GAME_EXT.chainHook('getExtraTargets', function () {
        if (!player || player.charType !== CHAR_ID) return undefined;
        return minions.filter(m => !m.isDead && m.hp > 0);
    });

    // ===== MERMİ ÇARPIŞMA + BAĞ =====
    const _origUBL = window.updateBulletLogic;
    window.updateBulletLogic = function (list, isBot, ts) {
        // Minyonlar özel wave mermilerinden hasar almalı (getExtraTargets'a eklenmeden önce kontrol)
        if (isBot && player.charType === CHAR_ID) {
            for (let i = list.length - 1; i >= 0; i--) {
                const b = list[i];
                if (!b._waveMorBullet && !b._waveArmoredBullet && !b._waveGrowingBullet) continue;
                for (const m of minions) {
                    if (m.isDead || m.hp <= 0) continue;
                    if (getDist(b, m) < m.radius + 8) {
                        const dmg = b._waveArmoredBullet ? 500 : (b._waveGrowingBullet ? (b._growingDmg || 250) : 200);
                        m.hp -= dmg;
                        floatingNumbers.push({
                            x: m.x, y: m.y - 10,
                            val: dmg, color: '#e74c3c', life: 40, opacity: 1
                        });
                        list.splice(i, 1);
                        break;
                    }
                }
            }
        }

        // Bağ özelliği — oyuncu hasar alınca minyonlara aktar
        if (isBot && player.charType === CHAR_ID && !player.isDead) {
            const hpBefore = player.hp;
            _origUBL(list, isBot, ts);
            const taken = hpBefore - player.hp;
            if (taken > 0 && minions.length > 0) {
                let closest = null, minD = Infinity;
                minions.forEach(m => {
                    if (m.isDead || m.hp <= 0) return;
                    const d = getDist(m, player);
                    if (d < minD) { minD = d; closest = m; }
                });
                if (closest) {
                    const transfer = Math.min(taken * BOND_PCT, closest.hp);
                    player.hp += transfer;
                    closest.hp -= transfer;
                    floatingNumbers.push({
                        x: player.x + (Math.random() - 0.5) * 20,
                        y: player.y - 25,
                        val: '+' + Math.floor(transfer),
                        color: C_BOND, life: 40, opacity: 1
                    });
                }
            }
            return;
        }

        if (!isBot && player.charType === CHAR_ID) {
            for (let i = suruBullets.length - 1; i >= 0; i--) {
                const b = suruBullets[i];
                if (b.isDead) { suruBullets.splice(i, 1); continue; }
                b.x += b.vx * ts; b.y += b.vy * ts;
                b.life += ts;
                if (b.life > b.maxLife) { suruBullets.splice(i, 1); continue; }
                if (b.x < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS ||
                    b.y < WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS) {
                    suruBullets.splice(i, 1); continue;
                }

                let hit = null;
                for (const e of getActiveEnemies()) {
                    if (e.isDead) continue;
                    if (getDist(b, e) < e.radius + 6) { hit = e; break; }
                }
                if (hit) {
                    const dmg = b.isMinionBullet ? b.minionDmg : MAIN_DMG;
                    const wasAlive = hit.hp > 0;
                    const before = hit.hp;
                    hit.hp -= dmg;
                    const actualDmg = Math.min(dmg, before);
                    addFloatingNumber(hit.x, hit.y, dmg, b.isMinionBullet ? C_TOWER : C_LIGHT);
                    if (!b.isMinionBullet) {
                        // Aksesuar 2 aktifken 3x bar
                        const barGain = aks2Active > 0 ? actualDmg * AKS2_BAR_MULT : actualDmg;
                        suruBar = Math.min(BAR_MAX, suruBar + barGain);
                    } else {
                        if (b.owner && wasAlive && hit.hp <= 0) b.owner.kills++;
                    }
                    suruBullets.splice(i, 1);
                }
            }
        }

        return _origUBL(list, isBot, ts);
    };

    // ===== ÇİZİM =====
    chainHook('onDraw', function (ctx2) {
        if (player.charType !== CHAR_ID || !gameStarted) return;

        // Minyonlar
        minions.forEach(m => {
            if (m.isDead) return;
            ctx2.save();
            ctx2.translate(m.x, m.y);
            if (m.isElite) {
                ctx2.globalAlpha = 0.5 + Math.sin(Date.now() / 150) * 0.2;
                ctx2.beginPath(); ctx2.arc(0, 0, m.radius + 6, 0, Math.PI * 2);
                ctx2.strokeStyle = C_ELITE; ctx2.lineWidth = 2.5; ctx2.stroke();
                ctx2.globalAlpha = 1;
            }
            // Gölge
            ctx2.fillStyle = 'rgba(0,0,0,0.3)';
            ctx2.beginPath(); ctx2.ellipse(0, m.radius * 0.4, m.radius * 0.9, m.radius * 0.35, 0, 0, Math.PI * 2); ctx2.fill();
            // Gövde
            ctx2.rotate(m.angle);
            ctx2.fillStyle = m.type === 'shadow' ? C_SHADOW : m.type === 'tower' ? C_TOWER : C_BOMB;
            ctx2.beginPath(); ctx2.arc(0, 0, m.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = m.isElite ? C_ELITE : C_DARK; ctx2.lineWidth = 2; ctx2.stroke();
            // TEK GÖZ — klasik kural (radius - 4, göz yarıçapı 5)
            ctx2.beginPath(); ctx2.arc(m.radius - 4, 0, 5, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(0,0,0,.4)'; ctx2.fill();
            ctx2.restore();

            // HP bar
            ctx2.save();
            ctx2.fillStyle = '#444'; ctx2.fillRect(m.x - 12, m.y - m.radius - 10, 24, 3);
            ctx2.fillStyle = m.isElite ? C_ELITE : '#2ecc71';
            ctx2.fillRect(m.x - 12, m.y - m.radius - 10, 24 * Math.max(0, m.hp / m.maxHp), 3);
            ctx2.restore();
        });

        // Karakter
        if (!player.isDead) {
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.fillStyle = 'rgba(0,0,0,0.35)';
            ctx2.beginPath(); ctx2.ellipse(0, player.radius * 0.4, player.radius * 0.9, player.radius * 0.35, 0, 0, Math.PI * 2); ctx2.fill();
            if (ultiBuffActive > 0) {
                ctx2.save();
                ctx2.globalAlpha = 0.3 + Math.sin(Date.now() / 150) * 0.15;
                ctx2.beginPath(); ctx2.arc(0, 0, player.radius + 12, 0, Math.PI * 2);
                ctx2.fillStyle = C_ELITE; ctx2.fill();
                ctx2.restore();
            }
            ctx2.rotate(player.angle);
            ctx2.fillStyle = C_MAIN;
            ctx2.beginPath(); ctx2.arc(0, 0, player.radius, 0, Math.PI * 2); ctx2.fill();
            ctx2.strokeStyle = C_DARK; ctx2.lineWidth = 2.5; ctx2.stroke();
            ctx2.beginPath(); ctx2.arc(player.radius - 4, 0, 5, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(0,0,0,.4)'; ctx2.fill();
            ctx2.restore();

            // HP bar
            ctx2.save();
            ctx2.fillStyle = '#444';
            ctx2.fillRect(player.x - 22, player.y - player.radius - 15, 44, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(player.x - 22, player.y - player.radius - 15, Math.max(0, player.hp) / player.maxHp * 44, 5);
            ctx2.restore();

            // Bar
            const barPct = suruBar / BAR_MAX;
            const barColor = barPct >= 1 ? C_ELITE : barPct >= 0.66 ? C_TOWER : C_SHADOW;
            ctx2.save();
            ctx2.fillStyle = '#222';
            ctx2.fillRect(player.x - 22, player.y - player.radius - 24, 44, 6);
            ctx2.fillStyle = barColor;
            ctx2.fillRect(player.x - 22, player.y - player.radius - 24, 44 * barPct, 6);
            if (barPct >= 1) {
                ctx2.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
                ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 1.5;
                ctx2.strokeRect(player.x - 22, player.y - player.radius - 24, 44, 6);
                ctx2.globalAlpha = 1;
            }
            // Limit göstergesi
            ctx2.fillStyle = minions.length >= MAX_MINIONS ? '#e74c3c' : '#aaa';
            ctx2.font = 'bold 9px Arial'; ctx2.textAlign = 'center';
            ctx2.fillText(minions.length + '/' + MAX_MINIONS, player.x, player.y - player.radius - 28);
            ctx2.restore();
        }

        // Mermiler
        suruBullets.forEach(b => {
            ctx2.save();
            ctx2.translate(b.x, b.y); ctx2.rotate(b.angle);
            if (b.isMinionBullet) {
                ctx2.beginPath(); ctx2.arc(0, 0, 5, 0, Math.PI * 2);
                ctx2.fillStyle = C_TOWER; ctx2.fill();
                ctx2.strokeStyle = C_WHITE; ctx2.lineWidth = 1; ctx2.stroke();
            } else {
                ctx2.beginPath();
                ctx2.moveTo(8, 0); ctx2.lineTo(-6, -4); ctx2.lineTo(-6, 4); ctx2.closePath();
                ctx2.fillStyle = C_MAIN; ctx2.fill();
                ctx2.strokeStyle = C_LIGHT; ctx2.lineWidth = 1; ctx2.stroke();
            }
            ctx2.restore();
        });

        // FX
        suruFX.forEach(fx => {
            ctx2.save();
            const a = fx.life / fx.maxLife;
            if (fx.type === 'explosion') {
                ctx2.globalAlpha = a * 0.6;
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
                ctx2.fillStyle = C_BOMB; ctx2.fill();
                ctx2.globalAlpha = a * 0.8;
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
                ctx2.strokeStyle = C_WHITE; ctx2.lineWidth = 2; ctx2.stroke();
            } else {
                ctx2.globalAlpha = Math.min(1, fx.life / 15);
                ctx2.beginPath(); ctx2.arc(fx.x, fx.y, fx.size, 0, Math.PI * 2);
                ctx2.fillStyle = fx.color; ctx2.fill();
            }
            ctx2.restore();
        });

        // Aim
        if (aimData.active && !player.isDead && player.ammo >= 1) {
            const ang = aimData.angle;
            const range = 200;
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.rotate(ang);
            ctx2.fillStyle = 'rgba(255,255,255,0.08)';
            ctx2.fillRect(0, -8, range, 16);
            ctx2.strokeStyle = C_LIGHT;
            ctx2.globalAlpha = 0.6;
            ctx2.lineWidth = 1.5;
            ctx2.strokeRect(0, -8, range, 16);
            ctx2.globalAlpha = 1;
            ctx2.restore();
        }

        if (screenFlash > 0) {
            ctx2.save();
            ctx2.globalAlpha = screenFlash / 10 * 0.4;
            ctx2.fillStyle = C_ELITE;
            ctx2.fillRect(0, 0, canvas.width, canvas.height);
            ctx2.restore();
        }
    });

    console.log('[MOD YÜKLENDİ] suru (v2 - düzeltilmiş)');
})();