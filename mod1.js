// ========== mod9.js (KÜL) - AURALI CAN EMİCİ ==========
// - Kısa menzilli iki mermi atar (600 + 300 delici).
// - Aura: 94 birim yarıçap, hasar vermez, içindeki her düşman başına
//   saniyede 200 can kazandırır. Çok hafif görünür, göz yormaz.
// - Aura her can aldığında hafifçe parlar (animasyonlu).
// - Ulti: anında 200 can verir, 1.5 saniye hasar almaz,
//   sonra aura patlar, 1000 hasar verir (savurma YOK).
// - Ulti sırasında karakterin etrafında koruma kalkanı belirir.
// - Ulti patlaması vurduğu her düşman başına %15 ulti doldurur.
// - Aksesuar 1: Aura Sömürüsü (3 sn, aura büyür + can kazanımı 2x)
// - Aksesuar 2: Kül Fırtınası (5 sn, aura hasar verir + can kazanımı azalır)
// - İki aksesuar aynı anda kullanılamaz.

(function () {
    'use strict';

    const CHAR_ID = 'kul';
    const CHAR_COLOR = '#4a4a4a';
    const CHAR_ACCENT = '#d35400';
    const CHAR_HP = 3300;
    const CHAR_SPEED = 3.8;

    // Saldırı
    const SALDIRI_MENZILI = 95;
    const ILK_MERMI_HASAR = 600;
    const IKINCI_MERMI_HASAR = 300;
    const IKINCI_MERMI_DELME = 2;
    const MERMI_ARALIK_MS = 100;
    const MERMI_HIZ = PLAYER_BULLET_SPEED * 0.8;

    // Aura
    const AURA_YARICAP = 94;
    const AURA_CAN_KAZANIM = 200;

    // Ulti
    const ULTI_ANINDA_CAN = 200;
    const ULTI_GECIKME = 90; // 1.5 saniye
    const ULTI_PATLAMA_HASAR = 1000;
    const ULTI_PATLAMA_YARICAP = 70;
    const ULTI_DOKUNULMAZLIK = 90; // 1.5 saniye (gecikmeyle aynı)

    // Aksesuar 1: Aura Sömürüsü
    const SOMURU_SURESI = 180;
    const SOMURU_CAN_KATSAYISI = 2;
    const SOMURU_HIZ_AZALTMA = 0.7;

    // Aksesuar 2: Kül Fırtınası
    const FIRTINA_SURESI = 300;
    const FIRTINA_HASAR = 200;
    const FIRTINA_CAN_KAZANIM = 100;

    window.GAME_EXT.characters[CHAR_ID] = {
        color: CHAR_COLOR,
        hp: CHAR_HP,
        speed: CHAR_SPEED
    };

    let kulMermileri = [];

    function chainHook(name, fn) {
        const prev = window.GAME_EXT && window.GAME_EXT.hooks ? window.GAME_EXT.hooks[name] : undefined;
        window.GAME_EXT = window.GAME_EXT || { hooks: {} };
        window.GAME_EXT.hooks = window.GAME_EXT.hooks || {};
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') {
                prevResult = prev.apply(this, args);
            }
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') {
                return !!prevResult || !!ownResult;
            }
            return ownResult !== undefined ? ownResult : prevResult;
        };
    }

    // ========== KARAKTER KARTI ==========
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Kül</span>' +
            '<small>Hasar: 600+300<br>Aura: Can emme<br>Güç: Aura Patlaması</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    // ========== setCharacter OVERRIDE ==========
    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            this.kulUltiZamanlayici = 0;
            this.kulUltiAktif = false;
            this.kulAuraPulse = 0;
            this.kulHasarAlmazlik = 0;
            this.kulAuraSiphon = false;
            this.kulAuraFirtina = false;
            this.kulAuraSiphonSure = 0;
            this.kulAuraFirtinaSure = 0;
            this.originalSpeed = CHAR_SPEED;
            this.speed = CHAR_SPEED;
            kulMermileri = [];

            if (gadgetBtn) {
                gadgetBtn.style.display = 'flex';
                gadgetBtn.innerHTML = 'AURA<br>SÖMÜR<br><span id="gadget-timer"></span>';
            }
            if (gadgetBtn2) {
                gadgetBtn2.style.display = 'flex';
                gadgetBtn2.innerHTML = 'KÜL<br>FIRTINASI<br><span id="gadget-timer-2"></span>';
            }
            if (ultiBtn) ultiBtn.style.display = 'flex';

            this.ultCharge = 0;
            this.ultReady = false;
            if (ultFill) ultFill.style.width = "0%";
            if (ultiBtn) ultiBtn.classList.remove('ready');
        }
    };

    // ========== FIRE OVERRIDE ==========
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        if (this.ammo < 1 || this.isDead) return;

        const fx = this.x, fy = this.y;
        const sp = MERMI_HIZ;

        kulMermileri.push({
            x: fx, y: fy,
            sx: fx, sy: fy,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            hasar: ILK_MERMI_HASAR,
            delmeHakki: 0,
            isDead: false,
            angle: a,
            age: 0,
            hitTargets: []
        });

        setTimeout(() => {
            if (!gameStarted || this.isDead) return;
            kulMermileri.push({
                x: fx, y: fy,
                sx: fx, sy: fy,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                hasar: IKINCI_MERMI_HASAR,
                delmeHakki: IKINCI_MERMI_DELME,
                isDead: false,
                angle: a,
                age: 0,
                hitTargets: []
            });
        }, MERMI_ARALIK_MS);

        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ========== FIREULTI OVERRIDE ==========
    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a);
        if (!this.ultReady || this.isDead) return;

        this.hp = Math.min(this.maxHp, this.hp + ULTI_ANINDA_CAN);
        addFloatingNumber(this.x, this.y - 30, "+" + ULTI_ANINDA_CAN, "#2ecc71");
        this.kulAuraPulse = 1.0;

        // 1.5 saniye hasar almazlık
        this.kulHasarAlmazlik = ULTI_DOKUNULMAZLIK;
        this.jumpInvulnerable = true;

        this.kulUltiZamanlayici = ULTI_GECIKME;
        this.kulUltiAktif = true;

        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    // ========== AKSESUAR 1: AURA SÖMÜRÜSÜ ==========
    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        if (this.kulAuraFirtina) {
            addFloatingNumber(this.x, this.y - 30, "KÜL FIRTINASI AKTİF!", "#e74c3c");
            return;
        }

        this.kulAuraSiphon = true;
        this.kulAuraSiphonSure = SOMURU_SURESI;
        addFloatingNumber(this.x, this.y - 30, "AURA SÖMÜRÜSÜ!", CHAR_ACCENT);

        this.gadgetReady = false;
        this.gadgetCooldown = SOMURU_SURESI + 120;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(this.gadgetCooldown / 60) + "s";
    };

    // ========== AKSESUAR 2: KÜL FIRTINASI ==========
    const originalActivateGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;
        if (this.kulAuraSiphon) {
            addFloatingNumber(this.x, this.y - 30, "AURA SÖMÜRÜSÜ AKTİF!", "#e74c3c");
            return;
        }

        this.kulAuraFirtina = true;
        this.kulAuraFirtinaSure = FIRTINA_SURESI;
        addFloatingNumber(this.x, this.y - 30, "KÜL FIRTINASI!", CHAR_ACCENT);

        this.gadget2Ready = false;
        this.gadget2Cooldown = FIRTINA_SURESI + 120;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(this.gadget2Cooldown / 60) + "s";
    };

    // ========== ULTİ DOLDURMA ==========
    chainHook('onChargeUlti', function (amount) {
        if (!gameStarted || player.charType !== CHAR_ID || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount);
        if (player.ultCharge >= 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, "GÜÇ HAZIR!", "#f1c40f");
        }
        if (ultFill) ultFill.style.width = player.ultCharge + "%";
    });

    // ========== UPDATE ==========
    chainHook('onUpdate', function (ts) {
        if (!gameStarted || player.charType !== CHAR_ID) return;

        // Buton görünürlüğü — her kare garantile
        if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
        if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
        if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';

        // Aksesuar süreleri
        if (player.kulAuraSiphon) {
            player.kulAuraSiphonSure -= ts;
            if (player.kulAuraSiphonSure <= 0) {
                player.kulAuraSiphon = false;
                player.kulAuraSiphonSure = 0;
            }
        }
        if (player.kulAuraFirtina) {
            player.kulAuraFirtinaSure -= ts;
            if (player.kulAuraFirtinaSure <= 0) {
                player.kulAuraFirtina = false;
                player.kulAuraFirtinaSure = 0;
            }
        }

        // Aura can kazanımı / hasar
        let toplamCan = 0;
        const auraYaricap = player.kulAuraSiphon ? AURA_YARICAP * 2 : AURA_YARICAP;

        if (player.kulAuraFirtina) {
            // Fırtına modu: hasar ver + az can kazan
            getActiveEnemies().forEach(e => {
                if (getDist(player, e) <= auraYaricap + e.radius) {
                    e.hp -= (FIRTINA_HASAR / 60) * ts;
                    toplamCan += (FIRTINA_CAN_KAZANIM / 60) * ts;
                    if (!e._kulFirtinaYazisi || Date.now() - e._kulFirtinaYazisi > 1000) {
                        addFloatingNumber(e.x, e.y, Math.floor(FIRTINA_HASAR), CHAR_ACCENT);
                        e._kulFirtinaYazisi = Date.now();
                    }
                }
            });
        } else {
            // Normal veya sömürü modu: sadece can kazan
            const canKazanimi = player.kulAuraSiphon
                ? AURA_CAN_KAZANIM * SOMURU_CAN_KATSAYISI
                : AURA_CAN_KAZANIM;
            getActiveEnemies().forEach(e => {
                if (getDist(player, e) <= auraYaricap + e.radius) {
                    toplamCan += (canKazanimi / 60) * ts;
                }
            });
        }

        if (toplamCan > 0) {
            player.hp = Math.min(player.maxHp, player.hp + toplamCan);
            player.kulAuraPulse = Math.min(1.0, (player.kulAuraPulse || 0) + 0.08);
            if (!player._kulCanYazisiZaman || Date.now() - player._kulCanYazisiZaman > 1000) {
                addFloatingNumber(player.x, player.y - 20, "+" + Math.floor(toplamCan * 60), "#2ecc71");
                player._kulCanYazisiZaman = Date.now();
            }
        } else {
            if (player.kulAuraPulse > 0) {
                player.kulAuraPulse = Math.max(0, player.kulAuraPulse - 0.02);
            }
        }

        // Sömürü hız azaltma
        if (player.kulAuraSiphon) {
            player.speed = player.originalSpeed * SOMURU_HIZ_AZALTMA;
        } else {
            player.speed = player.originalSpeed;
        }

        // Hasar almazlık
        if (player.kulHasarAlmazlik > 0) {
            player.kulHasarAlmazlik -= ts;
            if (player.kulHasarAlmazlik <= 0) {
                player.kulHasarAlmazlik = 0;
                player.jumpInvulnerable = false;
            }
        }

        // Ulti gecikmesi
        if (player.kulUltiAktif) {
            player.kulUltiZamanlayici -= ts;
            if (player.kulUltiZamanlayici <= 0) {
                player.kulUltiAktif = false;
                patlatAura();
            }
        }

        // Mermi güncelleme
        for (let i = kulMermileri.length - 1; i >= 0; i--) {
            const m = kulMermileri[i];
            if (m.isDead) { kulMermileri.splice(i, 1); continue; }
            m.age += ts;
            m.x += m.vx * ts;
            m.y += m.vy * ts;
            if (getDist({x: m.sx, y: m.sy}, m) > SALDIRI_MENZILI) { m.isDead = true; continue; }
            if (m.x < WALL_THICKNESS + 5 || m.x > canvas.width - WALL_THICKNESS - 5 ||
                m.y < WALL_THICKNESS + 5 || m.y > canvas.height - WALL_THICKNESS - 5) { m.isDead = true; continue; }
            let hitObs = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(m, o) < o.radius + 6) { hitObs = true; break; }
            }
            if (hitObs) { m.isDead = true; continue; }
            for (const e of getActiveEnemies()) {
                if (m.isDead) break;
                if (m.hitTargets.includes(e)) continue;
                if (getDist(m, e) < e.radius + 6) {
                    e.hp -= m.hasar;
                    addFloatingNumber(e.x, e.y, m.hasar, CHAR_ACCENT);
                    m.hitTargets.push(e);
                    if (m.delmeHakki > 0) { m.delmeHakki--; }
                    else { m.isDead = true; }
                }
            }
        }
    });

    // ========== RESET ==========
    chainHook('onReset', function () {
        kulMermileri = [];
        if (player) {
            player.kulUltiAktif = false;
            player.kulUltiZamanlayici = 0;
            player.kulAuraPulse = 0;
            player.kulHasarAlmazlik = 0;
            player.jumpInvulnerable = false;
            player.kulAuraSiphon = false;
            player.kulAuraFirtina = false;
            player.kulAuraSiphonSure = 0;
            player.kulAuraFirtinaSure = 0;
        }
    });

    // ========== DRAW ==========
    chainHook('onDraw', function (ctx2) {
        if (!gameStarted || player.charType !== CHAR_ID) return;

        const auraYaricap = player.kulAuraSiphon ? AURA_YARICAP * 2 : AURA_YARICAP;
        const pulse = player.kulAuraPulse || 0;
        const auraAlpha = player.kulAuraFirtina
            ? 0.15 + pulse * 0.1
            : 0.08 + pulse * 0.08;
        const grad = ctx2.createRadialGradient(
            player.x, player.y, auraYaricap * 0.1,
            player.x, player.y, auraYaricap
        );
        grad.addColorStop(0, `rgba(211, 84, 0, ${auraAlpha})`);
        grad.addColorStop(0.6, `rgba(211, 84, 0, ${auraAlpha * 0.5})`);
        grad.addColorStop(1, 'rgba(211, 84, 0, 0)');
        ctx2.save();
        ctx2.beginPath();
        ctx2.arc(player.x, player.y, auraYaricap, 0, Math.PI * 2);
        ctx2.fillStyle = grad;
        ctx2.fill();
        ctx2.restore();

        // Ulti koruma kalkanı (1.5 saniye boyunca)
        if (player.kulUltiAktif) {
            const kalan = player.kulUltiZamanlayici / 60;
            const kalkanR = 28 + Math.sin(Date.now() / 80) * 3;
            ctx2.save();
            ctx2.translate(player.x, player.y);
            // Dönen altın kalkan
            ctx2.beginPath();
            ctx2.arc(0, 0, kalkanR, 0, Math.PI * 2);
            ctx2.strokeStyle = `rgba(241, 196, 15, ${0.6 + 0.4 * Math.sin(Date.now() / 120)})`;
            ctx2.lineWidth = 3;
            ctx2.setLineDash([8, 4]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            // İç ışıma
            ctx2.beginPath();
            ctx2.arc(0, 0, kalkanR * 0.7, 0, Math.PI * 2);
            ctx2.fillStyle = `rgba(241, 196, 15, ${0.2 + 0.1 * Math.sin(Date.now() / 100)})`;
            ctx2.fill();
            // Geri sayım
            ctx2.fillStyle = '#f1c40f';
            ctx2.font = "bold 13px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(kalan.toFixed(1), 0, -kalkanR - 8);
            ctx2.restore();
        }

        // Mermiler
        kulMermileri.forEach(m => {
            ctx2.save();
            ctx2.translate(m.x, m.y);
            ctx2.rotate(m.angle);
            ctx2.fillStyle = m.delmeHakki > 0 ? '#e67e22' : '#a04000';
            ctx2.beginPath();
            ctx2.moveTo(-10, -6);
            ctx2.lineTo(5, -6);
            ctx2.quadraticCurveTo(13, 0, 5, 6);
            ctx2.lineTo(-10, 6);
            ctx2.closePath();
            ctx2.fill();
            ctx2.fillStyle = 'rgba(255,255,255,0.4)';
            ctx2.fillRect(-5, -3, 6, 3);
            ctx2.restore();
        });
    });

    // ========== NİŞAN ÇİZGİSİ ==========
    chainHook('onPreDraw', function (ctx2) {
        if (player.charType === CHAR_ID && aimData.active && !player.isDead) {
            player._kulAimGeriGetir = true;
            aimData.active = false;
        }
    });

    chainHook('onAimDraw', function (ctx2) {
        if (player.charType === CHAR_ID && player._kulAimGeriGetir && player.ammo >= 1 && !player.isDead) {
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.rotate(aimData.angle);
            ctx2.fillStyle = 'rgba(211, 84, 0, 0.15)';
            ctx2.fillRect(0, -10, SALDIRI_MENZILI, 20);
            ctx2.strokeStyle = 'rgba(211, 84, 0, 0.5)';
            ctx2.lineWidth = 1;
            ctx2.strokeRect(0, -10, SALDIRI_MENZILI, 20);
            ctx2.restore();
        }
    });

    chainHook('onPostDraw', function (ctx2) {
        if (player._kulAimGeriGetir) {
            aimData.active = true;
            player._kulAimGeriGetir = false;
        }
    });

    // ========== PATLAMA ==========
    function patlatAura() {
        const p = player;

        explosions.push({x: p.x, y: p.y, radius: 10, maxRadius: ULTI_PATLAMA_YARICAP, life: 12, maxLife: 12});
        for (let k = 0; k < 6; k++) {
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.random() * ULTI_PATLAMA_YARICAP * 0.7;
            spawnParticles(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, CHAR_ACCENT, 'normal');
        }
        screenShake = 5;
        addFloatingNumber(p.x, p.y - 30, "KÜL PATLAMASI!", CHAR_ACCENT);

        let vurulanSayi = 0;
        getActiveEnemies().forEach(e => {
            const d = getDist(p, e);
            if (d <= ULTI_PATLAMA_YARICAP + e.radius) {
                e.hp -= ULTI_PATLAMA_HASAR;
                addFloatingNumber(e.x, e.y, ULTI_PATLAMA_HASAR, "#e74c3c");
                vurulanSayi++;
            }
        });

        if (vurulanSayi > 0) {
            const dolum = vurulanSayi * 15;
            player.ultCharge = Math.min(100, player.ultCharge + dolum);
            if (player.ultCharge >= 100 && !player.ultReady) {
                player.ultReady = true;
                if (ultiBtn) ultiBtn.classList.add('ready');
                addFloatingNumber(player.x, player.y - 50, "GÜÇ HAZIR!", "#f1c40f");
            }
            if (ultFill) ultFill.style.width = player.ultCharge + "%";
        }
    }

    console.log('[MOD YÜKLENDİ]', CHAR_ID);
})();