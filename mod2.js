// ========== mod4.js (TAŞÇI) - FİNAL DENGE ==========
// - Menzil %10 azaltıldı: 140 -> 126
// - Taş hızı hafif düşürüldü: 0.65x -> 0.6x
// - Parça açısı artırıldı: 60° -> 75°
// - Ulti vurduğu her düşman başına ultiyi %10 doldurur
// - Ultiye özel efekt eklendi (iç içe 2 genişleyen daire + hafif parçacık)
// - Taş Zırh: son 3 saniyede hasar alınmadıysa aksesuar boşa gitmez, beklemede kalır
// - Taş Zırh basılınca küçük animasyon (taş halkası)
// - Patlayan Taş parçaları menzil sonunda veya engele çarpınca patlar

(function () {
    'use strict';

    const CHAR_ID = 'tasci';
    const CHAR_COLOR = '#8b5e3c';
    const CHAR_HP = 3400;
    const CHAR_SPEED = 3.6;

    const TAS_MENZIL = 126;              // %10 azaltıldı
    const TAS_HASAR = 1650;
    const TAS_HIZ = PLAYER_BULLET_SPEED * 0.6; // hafif nerf
    const TAS_SEKME_HAKKI = 10;
    const ENGELE_HASAR = 50;
    const PARCA_HASAR = 350;
    const PARCA_SAYISI = 9;
    const PARCA_HIZ = PLAYER_BULLET_SPEED * 0.55;
    const PARCA_MENZIL = 90;
    const PARCA_MAX_ACI = Math.PI * 0.416; // 75 derece

    const ULTI_YARICAP = 108;
    const ULTI_TABAN_HASAR = 700;
    const ULTI_KNOCKBACK = 25;
    const ULTI_CAN = 350;
    const ULTI_DOLUM_LIMIT = 90;
    const ULTI_HIT_DOLUM = 10; // vurduğu düşman başına %10 dolum

    // Aksesuar 1: Patlayan Taş
    const PATLAYAN_AKSESUAR_COOLDOWN = 1020;
    const PATLAYAN_ALAN_HASAR = 300;
    const PATLAYAN_ALAN_YARICAP = 80;

    // Aksesuar 2: Taş Zırh (Geçmiş Hasar İyileştirme)
    const ZIRH_COOLDOWN = 1200;

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let tasciKayalar = [];
    let tasciParcalar = [];
    let oncekiHp = CHAR_HP;

    // ---- Karakter kartı ----
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Taşçı</span>' +
            '<small>Hasar: 1650<br>Ulti: Sismik Dalga<br>Aksesuar: Patlayan Taş, Taş Zırh</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    // ---- Hook yardımcısı ----
    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') {
                return !!prevResult || !!ownResult;
            }
            return ownResult;
        };
    }

    // ---- setCharacter override ----
    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            if (gadgetBtn) {
                gadgetBtn.style.display = 'flex';
                gadgetBtn.innerHTML = 'PATLAYAN<br>TAŞ<br><span id="gadget-timer"></span>';
                gadgetBtn.classList.remove('cooldown');
            }
            if (gadgetBtn2) {
                gadgetBtn2.style.display = 'flex';
                gadgetBtn2.innerHTML = 'TAŞ<br>ZIRH<br><span id="gadget-timer-2"></span>';
                gadgetBtn2.classList.remove('cooldown');
            }
            this.tasciPatlayanHazir = false;
            this.tasciHasarKayitlari = [];
            this.tasciZirhAnimasyon = 0;
            oncekiHp = this.hp;
            tasciKayalar = [];
            tasciParcalar = [];
            this.ultReady = false;
            this.ultCharge = 0;
            if (ultFill) ultFill.style.width = "0%";
            if (ultiBtn) ultiBtn.classList.remove('ready');
        }
    };

    // ---- Fire override ----
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        if (this.ammo < 1 || this.isDead) return;

        const patlayan = this.tasciPatlayanHazir;

        tasciKayalar.push({
            x: this.x, y: this.y,
            sx: this.x, sy: this.y,
            vx: Math.cos(a) * TAS_HIZ,
            vy: Math.sin(a) * TAS_HIZ,
            sekmeHakki: TAS_SEKME_HAKKI,
            hasar: TAS_HASAR,
            isDead: false,
            rotasyon: Math.random() * Math.PI * 2,
            patlayan: patlayan,
            hitTargets: []
        });

        if (patlayan) {
            this.tasciPatlayanHazir = false;
            addFloatingNumber(this.x, this.y - 30, "PATLAYAN TAŞ!", CHAR_COLOR);
        }

        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ---- Aksesuar 1: Patlayan Taş ----
    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;

        this.tasciPatlayanHazir = true;
        this.gadgetReady = false;
        this.gadgetCooldown = PATLAYAN_AKSESUAR_COOLDOWN;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(PATLAYAN_AKSESUAR_COOLDOWN / 60) + "s";
        addFloatingNumber(this.x, this.y - 30, "AKSESUAR HAZIR!", CHAR_COLOR);
    };

    // ---- Aksesuar 2: Taş Zırh (Geçmiş Hasar İyileştirme, boşa gitmez) ----
    const originalActivateGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;

        const simdi = Date.now();
        const toplamHasar = (this.tasciHasarKayitlari || [])
            .filter(k => simdi - k.zaman < 3000)
            .reduce((toplam, k) => toplam + k.miktar, 0);

        if (toplamHasar > 0) {
            this.hp = Math.min(this.maxHp, this.hp + toplamHasar);
            addFloatingNumber(this.x, this.y - 30, "+" + toplamHasar, "#2ecc71");
            this.tasciHasarKayitlari = [];
            this.gadget2Ready = false;
            this.gadget2Cooldown = ZIRH_COOLDOWN;
            if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
            if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(ZIRH_COOLDOWN / 60) + "s";
            // Animasyon başlat
            this.tasciZirhAnimasyon = 30; // 0.5 saniye
            addFloatingNumber(this.x, this.y - 40, "TAŞ ZIRH!", CHAR_COLOR);
        } else {
            // Hasar alınmadıysa aksesuar boşa gitmesin, beklemede kalsın
            addFloatingNumber(this.x, this.y - 30, "HASAR ALINMADI", "#e74c3c");
            // Cooldown yok, gadget2Ready true kalır
        }
    };

    // ---- FireUlti override: Sismik Dalga ----
    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a);
        if (!this.ultReady || this.isDead) return;

        let itilenDusmanSayisi = 0;
        getActiveEnemies().forEach(e => {
            if (getDist(this, e) <= ULTI_YARICAP) {
                e.hp -= ULTI_TABAN_HASAR;
                addFloatingNumber(e.x, e.y, ULTI_TABAN_HASAR, CHAR_COLOR);
                const ang = getAngle(this, e);
                e.kbX = Math.cos(ang) * ULTI_KNOCKBACK;
                e.kbY = Math.sin(ang) * ULTI_KNOCKBACK;
                itilenDusmanSayisi++;
            }
        });

        // Can kazanma
        if (itilenDusmanSayisi > 0) {
            const toplamCan = itilenDusmanSayisi * ULTI_CAN;
            player.hp = Math.min(player.maxHp, player.hp + toplamCan);
            addFloatingNumber(player.x, player.y - 30, "+" + toplamCan, "#2ecc71");
        }

        // Ulti dolumu: vurduğu her düşman başına %10 doldur
        if (itilenDusmanSayisi > 0) {
            const dolum = itilenDusmanSayisi * ULTI_HIT_DOLUM;
            player.ultCharge = Math.min(100, player.ultCharge + dolum);
            if (player.ultCharge >= ULTI_DOLUM_LIMIT && !player.ultReady) {
                player.ultReady = true;
                if (ultiBtn) ultiBtn.classList.add('ready');
                addFloatingNumber(player.x, player.y - 50, "GÜÇ HAZIR!", "#f1c40f");
            }
            if (ultFill) ultFill.style.width = player.ultCharge + "%";
        }

        // Ultiye özel efekt: iç içe 2 genişleyen daire + hafif parçacık
        explosions.push({x: this.x, y: this.y, radius: 10, maxRadius: ULTI_YARICAP, life: 15, maxLife: 15});
        explosions.push({x: this.x, y: this.y, radius: 5, maxRadius: ULTI_YARICAP * 0.7, life: 20, maxLife: 20});
        for (let k = 0; k < 8; k++) {
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.random() * ULTI_YARICAP;
            spawnParticles(this.x + Math.cos(ang) * dist, this.y + Math.sin(ang) * dist, CHAR_COLOR, 'normal');
        }
        screenShake = 8;
        addFloatingNumber(this.x, this.y - 40, "SİSMİK DALGA!", CHAR_COLOR);

        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    // ---- chargeUlti: chainHook ile güvenli sarmalama ----
    chainHook('onChargeUlti', function (amount) {
        if (player.charType !== CHAR_ID) return;
        if (!gameStarted || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount);
        if (player.ultCharge >= ULTI_DOLUM_LIMIT) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, "GÜÇ HAZIR!", "#f1c40f");
        }
        if (ultFill) ultFill.style.width = player.ultCharge + "%";
    });

    // ---- Reset hook ----
    chainHook('onReset', function () {
        tasciKayalar = [];
        tasciParcalar = [];
        oncekiHp = player.maxHp;
    });

    // =====================================================
    // Hook tabanlı çizimler
    // =====================================================

    // ---- onPreDraw: Nişan çizgisini bastırmak için aimData.active'ı geçici olarak false yap ----
    chainHook('onPreDraw', function (ctx2) {
        if (player.charType === CHAR_ID && aimData.active && !player.isDead) {
            player._tasciAimGeriGetir = true;
            aimData.active = false;
        }
    });

    // ---- onAimDraw: Taşçı nişan çizgisi ve ulti alanı ----
    chainHook('onAimDraw', function (ctx2) {
        // Taşçı nişan çizgisi (sadece nişan alırken görünür)
        if (player.charType === CHAR_ID && player._tasciAimGeriGetir && player.ammo >= 1 && !player.isDead) {
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.rotate(aimData.angle);
            ctx2.fillStyle = 'rgba(139, 94, 60, 0.15)';
            ctx2.fillRect(0, -5, TAS_MENZIL, 10);
            ctx2.strokeStyle = 'rgba(139, 94, 60, 0.8)';
            ctx2.lineWidth = 2;
            ctx2.setLineDash([8, 6]);
            ctx2.strokeRect(0, -5, TAS_MENZIL, 10);
            ctx2.setLineDash([]);
            ctx2.beginPath();
            ctx2.arc(TAS_MENZIL, 0, 8, 0, Math.PI * 2);
            ctx2.fillStyle = '#8b5e3c';
            ctx2.fill();
            ctx2.strokeStyle = '#3e2710';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.beginPath();
            ctx2.arc(TAS_MENZIL, 0, 3, 0, Math.PI * 2);
            ctx2.fillStyle = '#d4a574';
            ctx2.fill();
            ctx2.restore();
        }

        // Ulti etki alanı göstergesi
        if (player.charType === CHAR_ID && ultAim.active && player.ultReady && !player.isDead) {
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.beginPath();
            ctx2.arc(0, 0, ULTI_YARICAP, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(139, 94, 60, 0.15)';
            ctx2.fill();
            ctx2.strokeStyle = 'rgba(139, 94, 60, 0.6)';
            ctx2.lineWidth = 2;
            ctx2.setLineDash([10, 5]);
            ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.restore();
        }
    });

    // ---- onPostDraw: aimData.active'ı geri getir ----
    chainHook('onPostDraw', function (ctx2) {
        if (player._tasciAimGeriGetir) {
            aimData.active = true;
            player._tasciAimGeriGetir = false;
        }
    });

    // ---- Draw hook (taş mermileri, parçalar, zırh animasyonu) ----
    chainHook('onDraw', function (ctx2) {
        // Taş Zırh animasyonu (taş halkası)
        if (player.charType === CHAR_ID && player.tasciZirhAnimasyon > 0) {
            const p = player;
            const alpha = Math.min(1, p.tasciZirhAnimasyon / 30);
            ctx2.save();
            ctx2.translate(p.x, p.y);
            ctx2.rotate(Date.now() / 300);
            for (let i = 0; i < 6; i++) {
                const ang = (i / 6) * Math.PI * 2;
                const r = 24;
                ctx2.beginPath();
                ctx2.arc(Math.cos(ang) * r, Math.sin(ang) * r, 4, 0, Math.PI * 2);
                ctx2.fillStyle = CHAR_COLOR;
                ctx2.globalAlpha = alpha * 0.7;
                ctx2.fill();
            }
            ctx2.restore();
        }

        tasciKayalar.forEach(b => {
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.rotate(b.rotasyon + Date.now() / 200);
            ctx2.beginPath();
            ctx2.moveTo(12, 0);
            ctx2.lineTo(6, -9);
            ctx2.lineTo(-10, -6);
            ctx2.lineTo(-9, 5);
            ctx2.lineTo(2, 11);
            ctx2.closePath();
            ctx2.fillStyle = b.patlayan ? '#a0522d' : '#8b5e3c';
            ctx2.fill();
            ctx2.strokeStyle = '#3e2710';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.beginPath();
            ctx2.moveTo(-2, -4);
            ctx2.lineTo(5, 1);
            ctx2.lineTo(-3, 5);
            ctx2.strokeStyle = '#5d3a1a';
            ctx2.lineWidth = 1;
            ctx2.stroke();
            ctx2.restore();
        });

        tasciParcalar.forEach(p => {
            ctx2.save();
            ctx2.translate(p.x, p.y);
            ctx2.rotate(p.rotasyon + Date.now() / 150);
            ctx2.beginPath();
            ctx2.moveTo(5, 0);
            ctx2.lineTo(1, -4);
            ctx2.lineTo(-4, 0);
            ctx2.lineTo(1, 4);
            ctx2.closePath();
            ctx2.fillStyle = p.patlayan ? '#a0522d' : '#8b5e3c';
            ctx2.fill();
            ctx2.strokeStyle = '#3e2710';
            ctx2.lineWidth = 1;
            ctx2.stroke();
            ctx2.restore();
        });
    });

    // ---- Bağımsız güncelleme döngüsü ----
    let lastTime = 0;
    function tasciLoop(t) {
        if (!lastTime) lastTime = t;
        const ts = Math.min(3, (t - lastTime) / 16.666);
        lastTime = t;
        if (gameStarted) tasciUpdate(ts);
        requestAnimationFrame(tasciLoop);
    }
    requestAnimationFrame(tasciLoop);

    // ---- Parça oluşturma (parçacık azaltıldı) ----
    function tasciParcala(tas) {
        const anaAci = Math.atan2(tas.vy, tas.vx);
        const acilar = [];
        acilar.push(0);
        const adim = (PARCA_MAX_ACI * 2) / (PARCA_SAYISI - 1);
        for (let i = 1; i < PARCA_SAYISI; i++) {
            const sapma = -PARCA_MAX_ACI + (i - 1) * adim;
            acilar.push(sapma);
        }
        acilar.forEach(sapma => {
            const aci = anaAci + sapma;
            tasciParcalar.push({
                x: tas.x, y: tas.y,
                sx: tas.x, sy: tas.y,
                vx: Math.cos(aci) * PARCA_HIZ,
                vy: Math.sin(aci) * PARCA_HIZ,
                hasar: PARCA_HASAR,
                isDead: false,
                rotasyon: Math.random() * Math.PI * 2,
                patlayan: tas.patlayan,
                hitTargets: []
            });
        });
        for (let k = 0; k < 2; k++) {
            spawnParticles(tas.x, tas.y, '#8b5e3c', 'normal');
        }
    }

    // ---- Patlama fonksiyonu ----
    function patlat(x, y) {
        explosions.push({x: x, y: y, radius: 10, maxRadius: 80, life: 15, maxLife: 15});
        getActiveEnemies().forEach(e => {
            if (getDist({x, y}, e) <= PATLAYAN_ALAN_YARICAP + e.radius) {
                e.hp -= PATLAYAN_ALAN_HASAR;
                addFloatingNumber(e.x, e.y, PATLAYAN_ALAN_HASAR, "#e67e22");
            }
        });
    }

    // ---- Güncelleme ----
    function tasciUpdate(ts) {
        if (player.charType === CHAR_ID) {
            if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
            if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
            if (gadgetBtn2 && gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';

            // Taş Zırh animasyon süresi
            if (player.tasciZirhAnimasyon > 0) {
                player.tasciZirhAnimasyon -= ts;
                if (player.tasciZirhAnimasyon < 0) player.tasciZirhAnimasyon = 0;
            }
        }

        // Hasar kayıtları
        const hpFarki = oncekiHp - player.hp;
        if (hpFarki > 0) {
            player.tasciHasarKayitlari.push({zaman: Date.now(), miktar: hpFarki});
            const simdi = Date.now();
            player.tasciHasarKayitlari = player.tasciHasarKayitlari.filter(k => simdi - k.zaman < 3000);
        }
        oncekiHp = player.hp;

        // Toplu parça hasar yazıları
        getActiveEnemies().forEach(e => {
            if (e._tasciBekleyenHasar > 0 && Date.now() - e._tasciSonHasarZamani > 50) {
                addFloatingNumber(e.x, e.y, e._tasciBekleyenHasar, "#8b5e3c");
                e._tasciBekleyenHasar = 0;
            }
        });

        // Taşlar
        for (let i = tasciKayalar.length - 1; i >= 0; i--) {
            const t = tasciKayalar[i];
            if (t.isDead) { tasciKayalar.splice(i, 1); continue; }

            t.x += t.vx * ts;
            t.y += t.vy * ts;

            const hwX = t.x < WALL_THICKNESS + 8 || t.x > canvas.width - WALL_THICKNESS - 8;
            const hwY = t.y < WALL_THICKNESS + 8 || t.y > canvas.height - WALL_THICKNESS - 8;

            let hitObs = null;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(t, o) < o.radius + 11) { hitObs = o; break; }
            }

            if ((hwX || hwY || hitObs) && t.sekmeHakki > 0) {
                if (hwX) { t.vx *= -1; t.x = t.x < canvas.width / 2 ? WALL_THICKNESS + 9 : canvas.width - WALL_THICKNESS - 9; }
                if (hwY) { t.vy *= -1; t.y = t.y < canvas.height / 2 ? WALL_THICKNESS + 9 : canvas.height - WALL_THICKNESS - 9; }
                if (hitObs) {
                    if (hitObs.hp !== undefined) hitObs.hp -= ENGELE_HASAR;
                    const dx = t.x - hitObs.x;
                    const dy = t.y - hitObs.y;
                    const d = Math.max(1, Math.hypot(dx, dy));
                    const nx = dx / d;
                    const ny = dy / d;
                    const dot = t.vx * nx + t.vy * ny;
                    t.vx -= 2 * dot * nx;
                    t.vy -= 2 * dot * ny;
                    t.x += nx * 5;
                    t.y += ny * 5;
                }
                t.sekmeHakki--;
                t.sx = t.x; t.sy = t.y;
                spawnParticles(t.x, t.y, '#8b5e3c', 'normal');
            }
            else if ((hwX || hwY || hitObs)) {
                t.isDead = true;
                continue;
            }

            const mesafe = getDist(t, { x: t.sx, y: t.sy });
            if (mesafe >= TAS_MENZIL) {
                tasciParcala(t);
                t.isDead = true;
                continue;
            }

            let vurdu = false;
            getActiveEnemies().forEach(e => {
                if (t.isDead || vurdu) return;
                if (t.hitTargets && t.hitTargets.includes(e)) return;
                if (getDist(t, e) < e.radius + 11) {
                    e.hp -= t.hasar;
                    addFloatingNumber(e.x, e.y, t.hasar, CHAR_COLOR);
                    if (t.patlayan) {
                        patlat(t.x, t.y);
                    }
                    vurdu = true;
                    t.isDead = true;
                }
            });
        }

        // Parçalar
        for (let i = tasciParcalar.length - 1; i >= 0; i--) {
            const p = tasciParcalar[i];
            if (p.isDead) { tasciParcalar.splice(i, 1); continue; }

            p.x += p.vx * ts;
            p.y += p.vy * ts;

            const hwX = p.x < WALL_THICKNESS + 3 || p.x > canvas.width - WALL_THICKNESS - 3;
            const hwY = p.y < WALL_THICKNESS + 3 || p.y > canvas.height - WALL_THICKNESS - 3;
            let hitObs = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(p, o) < o.radius + 4) { hitObs = true; break; }
            }
            const mesafe = getDist(p, { x: p.sx, y: p.sy });
            if (hwX || hwY || hitObs || mesafe > PARCA_MENZIL) {
                // YENİ: Patlayan Taş parçaları menzil sonunda veya engele çarpınca patlar
                if (p.patlayan) {
                    patlat(p.x, p.y);
                }
                p.isDead = true;
                continue;
            }

            let vurdu = false;
            getActiveEnemies().forEach(e => {
                if (p.isDead || vurdu) return;
                if (p.hitTargets && p.hitTargets.includes(e)) return;
                if (getDist(p, e) < e.radius + 8) {
                    e.hp -= p.hasar;
                    e._tasciBekleyenHasar = (e._tasciBekleyenHasar || 0) + p.hasar;
                    e._tasciSonHasarZamani = Date.now();
                    if (p.patlayan) {
                        patlat(p.x, p.y);
                    }
                    vurdu = true;
                    p.isDead = true;
                }
            });
        }
    }
})();