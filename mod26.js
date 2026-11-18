/* =====================================================================
   mod10.js — İKİ ÖZGÜN KARAKTER: UYKUCU & RÜYAGEZER
   Ana koda dokunmaz. window.GAME_EXT kayıt noktalarını, Player prototype
   sarmalamasını ve hook zincirini kullanır (önceki modların hook'ları korunur).
   ===================================================================== */
(function () {
  'use strict';

  const EXT = window.GAME_EXT;
  const H = EXT.hooks;
  const UYKU = 'uykucu';
  const RUYA = 'ruyagezer';

  // ---------- 1) KARAKTER KAYITLARI ----------
  EXT.characters[UYKU] = { color: '#5f4bb7', hp: 3400, speed: 3.0 };
  EXT.characters[RUYA] = { color: '#16a085', hp: 3000, speed: 3.5 };

  // ---------- 2) DURUM ----------
  let fx = [], rings = [], sleepZones = [], meteors = [];
  let clone = null, shieldTimer = 0, uiReady = false;
  let sleepTimers = new WeakMap(), baseSpeed = new WeakMap(), slowedSet = new WeakSet();

  const isMine = () => player.charType === UYKU || player.charType === RUYA;
  const isUyku = () => player.charType === UYKU;
  const isRuya = () => player.charType === RUYA;
  const hasClone = () => !!clone && clone.life > 0 && clone.hp > 0;

  const aimPoint = (ang, dist, m) => ({
    x: clampPos(player.x + Math.cos(ang) * dist, WALL_THICKNESS + m, canvas.width - WALL_THICKNESS - m),
    y: clampPos(player.y + Math.sin(ang) * dist, WALL_THICKNESS + m, canvas.height - WALL_THICKNESS - m)
  });

  // ---------- 3) EFEKT YARDIMCILARI ----------
  function fxPush(o) {
    o.maxLife = o.life;
    o.vx = o.vx || 0;
    o.vy = o.vy || 0;
    o.size = o.size || 4;
    o.color = o.color || '#fff';
    o.type = o.type || 'dot';
    o.rot = o.rot || 0;
    fx.push(o);
  }

  function fxBurst(x, y, color, n, type) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      fxPush({
        type: type || 'dot', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 25 + Math.random() * 15,
        size: 2 + Math.random() * 3,
        color, rot: Math.random() * 3
      });
    }
  }

  function ringPush(x, y, R, color, life) {
    rings.push({ x, y, R, color, life, maxLife: life });
  }

  function addCharge(n) {
    if (!isMine() || player.ultReady || player.isDead) return;
    player.ultCharge = Math.min(100, player.ultCharge + n);
    if (player.ultCharge >= 100) {
      player.ultCharge = 100;
      player.ultReady = true;
      ultiBtn.classList.add('ready');
      addFloatingNumber(player.x, player.y - 40, "GÜÇ HAZIR!", "#f1c40f");
    }
    ultFill.style.width = player.ultCharge + '%';
  }

  function gadgetCD(p, frames) {
    p.gadgetReady = false;
    p.gadgetCooldown = frames;
    gadgetBtn.classList.remove('active');
    gadgetBtn.classList.add('cooldown');
  }

  function gadget2CD(p, frames) {
    p.gadget2Ready = false;
    p.gadget2Cooldown = frames;
    gadgetBtn2.classList.add('cooldown');
  }

  function drawStar(x, y, r, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 === 0 ? r : r * 0.42, an = i * Math.PI / 4;
      if (i === 0) ctx.moveTo(Math.cos(an) * rr, Math.sin(an) * rr);
      else ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawZ(x, y, size, alpha, color) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = color;
    ctx.font = 'bold ' + Math.round(size) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Z', x, y);
    ctx.restore();
  }

  // ---------- 4) UYKUCU YETENEKLERİ ----------
  // Q - Uyku Perdesi
  function uykuQ(a, pull) {
    if (!this.gadgetReady || this.isDead) return;
    const ang = a !== undefined ? a : this.angle;
    const pm = pull !== undefined ? clampPos(pull, 0, 1) : 1;
    const tgt = aimPoint(ang, Math.max(50, RANGE * 0.75 * pm), 110);
    sleepZones.push({ x: tgt.x, y: tgt.y, r: 115, life: 360, maxLife: 360 });
    ringPush(tgt.x, tgt.y, 115, '#8e7cf0', 30);
    for (let i = 0; i < 10; i++) {
      fxPush({
        type: 'z',
        x: tgt.x + (Math.random() - .5) * 150,
        y: tgt.y + (Math.random() - .5) * 150,
        vx: 0, vy: -0.6, life: 70,
        size: 14 + Math.random() * 8,
        color: '#c7b8ff'
      });
    }
    addFloatingNumber(tgt.x, tgt.y - 30, "UYKU PERDESİ!", "#8e7cf0");
    gadgetCD(this, 900);
    addCharge(15);
  }

  // E - Yastık Kalkanı
  function uykuE() {
    if (!this.gadget2Ready || this.isDead) return;
    shieldTimer = 150;
    // ana kod: bu bayrakta bot mermileri ve slime'lar oyuncuyu etkilemez
    this.jumpInvulnerable = true;
    const heal = Math.min(this.maxHp - this.hp, 250);
    if (heal > 0) {
      this.hp += heal;
      addFloatingNumber(this.x, this.y, "+" + Math.floor(heal), "#2ecc71");
    }
    ringPush(this.x, this.y, 90, '#dfe6ff', 25);
    for (let i = 0; i < 6; i++) {
      const an = i / 6 * Math.PI * 2;
      fxPush({
        type: 'z',
        x: this.x + Math.cos(an) * 25,
        y: this.y + Math.sin(an) * 25,
        vx: Math.cos(an) * 0.4, vy: -0.7,
        life: 55, size: 12, color: '#dfe6ff'
      });
    }
    addFloatingNumber(this.x, this.y - 35, "YASTIK KALKANI!", "#dfe6ff");
    gadget2CD(this, 1200);
    addCharge(15);
  }

  // R - Derin Uyku (güç)
  function uykuR() {
    if (!this.ultReady || this.isDead) return;
    const me = this, R = 300;
    let n = 0;
    getActiveEnemies().forEach(e => {
      if (getDist(e, me) < R + e.radius) {
        sleepTimers.set(e, 270);
        n++;
      }
    });
    ringPush(me.x, me.y, R, '#a29bfe', 40);
    ringPush(me.x, me.y, R * 0.55, '#dfe6e9', 26);
    for (let i = 0; i < 14; i++) {
      const an = (i / 14) * Math.PI * 2;
      fxPush({
        type: 'z',
        x: me.x + Math.cos(an) * 30,
        y: me.y + Math.sin(an) * 30,
        vx: Math.cos(an) * 0.6, vy: -0.8,
        life: 60, size: 16 + Math.random() * 6,
        color: '#c7b8ff'
      });
    }
    addFloatingNumber(me.x, me.y - 40, n > 0 ? "DERİN UYKU! (" + n + ")" : "DERİN UYKU!", "#a29bfe");
    this.ultReady = false;
    this.ultCharge = 0;
    ultFill.style.width = '0%';
    ultiBtn.classList.remove('ready');
  }

  // ---------- 5) RÜYAGEZER YETENEKLERİ ----------
  // Q - Rüya Atılımı (ana kodun dash altyapısını kullanır)
  function ruyaQ(a) {
    if (!this.gadgetReady || this.isDead || this.isDashing) return;
    const ang = a !== undefined ? a : this.angle;
    this.isDashing = true;
    this.dashTimer = 18;
    this.dashAngle = ang;
    this.dashHitTargets = [];
    fxBurst(this.x, this.y, '#7ef9ff', 14, 'star');
    addFloatingNumber(this.x, this.y - 30, "RÜYA ATILIMI!", "#7ef9ff");
    gadgetCD(this, 600);
    addCharge(10);
  }

  // E - Hayal Aynası (botların hedef aldığı kopya)
  function ruyaE(a) {
    if (!this.gadget2Ready || this.isDead) return;
    const ang = a !== undefined ? a : this.angle;
    const tgt = aimPoint(ang, 100, 40);
    clone = { x: tgt.x, y: tgt.y, radius: 20, hp: 1200, maxHp: 1200, life: 300, maxLife: 300, angle: ang };
    ringPush(tgt.x, tgt.y, 100, '#1abc9c', 30);
    fxBurst(tgt.x, tgt.y, '#7ef9ff', 12, 'star');
    addFloatingNumber(this.x, this.y - 35, "HAYAL AYNASI!", "#1abc9c");
    gadget2CD(this, 1500);
    addCharge(15);
  }

  // R - Yıldız Yağmuru (güç)
  function ruyaR(a, pull) {
    if (!this.ultReady || this.isDead) return;
    const ang = a !== undefined ? a : this.angle;
    const dist = pull === undefined ? RANGE * 0.7 : Math.max(90, RANGE * 0.9 * clampPos(pull, 0, 1));
    const tgt = aimPoint(ang, dist, 90);
    for (let i = 0; i < 7; i++) {
      const T = 50 + i * 14;
      meteors.push({
        x: tgt.x + (Math.random() - .5) * 220,
        y: tgt.y + (Math.random() - .5) * 220,
        t: T, T
      });
    }
    ringPush(tgt.x, tgt.y, 120, '#7ef9ff', 30);
    addFloatingNumber(this.x, this.y - 40, "YILDIZ YAĞMURU!", "#7ef9ff");
    this.ultReady = false;
    this.ultCharge = 0;
    ultFill.style.width = '0%';
    ultiBtn.classList.remove('ready');
  }

  function meteorImpact(m) {
    getActiveEnemies().forEach(e => {
      if (getDist(e, m) < 70 + e.radius) {
        e.hp -= 450;
        addFloatingNumber(e.x, e.y, 450, '#7ef9ff');
        const an = getAngle(m, e);
        e.kbX = Math.cos(an) * 10;
        e.kbY = Math.sin(an) * 10;
      }
    });
    obstacles.forEach(o => {
      if (getDist(o, m) < 70 + o.radius) o.hp -= 300;
    });
    ringPush(m.x, m.y, 70, '#fdfd96', 24);
    fxBurst(m.x, m.y, '#7ef9ff', 14);
    fxBurst(m.x, m.y, '#fdfd96', 6, 'star');
    screenShake = Math.max(screenShake, 5);
  }

  function cloneBlast() {
    const c = clone;
    getActiveEnemies().forEach(e => {
      if (getDist(c, e) < 130) {
        e.hp -= 400;
        addFloatingNumber(e.x, e.y, 400, '#1abc9c');
      }
    });
    ringPush(c.x, c.y, 130, '#1abc9c', 30);
    fxBurst(c.x, c.y, '#1abc9c', 16);
    clone = null;
  }

  // ---------- 6) PLAYER PROTOTYPE SARMALAMASI ----------
  const PP = Player.prototype;
  const origG1 = PP.activateGadget, origG2 = PP.activateGadget2, origUlt = PP.fireUlti;

  PP.activateGadget = function (a, pull) {
    if (this.charType === UYKU) return uykuQ.call(this, a, pull);
    if (this.charType === RUYA) return ruyaQ.call(this, a, pull);
    return origG1.call(this, a, pull);
  };

  PP.activateGadget2 = function (a, pull) {
    if (this.charType === UYKU) return uykuE.call(this, a, pull);
    if (this.charType === RUYA) return ruyaE.call(this, a, pull);
    return origG2.call(this, a, pull);
  };

  PP.fireUlti = function (a, pull) {
    if (this.charType === UYKU) return uykuR.call(this, a, pull);
    if (this.charType === RUYA) return ruyaR.call(this, a, pull);
    return origUlt.call(this, a, pull);
  };

  // ---------- 7) BUTON ARAYÜZÜ (oyun başlayınca bir kez kurulur) ----------
  function setupDreamUI() {
    const L = isUyku()
      ? ['UYKU<br>PERDESİ', 'YASTIK<br>KALKANI', 'DERİN<br>UYKU']
      : ['RÜYA<br>ATILIMI', 'HAYAL<br>AYNASI', 'YILDIZ<br>YAĞMURU'];
    ultiBtn.style.display = 'flex';
    gadgetBtn.style.display = 'flex';
    gadgetBtn2.style.display = 'flex';
    gadgetBtn.innerHTML = L[0] + '<br><span id="gadget-timer"></span>';
    gadgetBtn2.innerHTML = L[1] + '<br><span id="gadget-timer-2"></span>';
    gadgetTimerText = document.getElementById('gadget-timer');
    gadgetTimerText2 = document.getElementById('gadget-timer-2');
    gadgetBtn.classList.remove('active');
    gadgetBtn.classList.toggle('cooldown', !player.gadgetReady);
    gadgetBtn2.classList.toggle('cooldown', !player.gadget2Ready);
    ultiBtn.classList.toggle('ready', !!player.ultReady);
    ultFill.style.width = player.ultCharge + '%';
    uiReady = true;
  }

  // ---------- 8) ÇİZİM: KARAKTER GÖRÜNÜMÜ ----------
  function drawUltHalo(p) {
    if (!p.ultReady) return;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 12 + pulse * 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(241,196,15,${0.4 + pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawUykuPlayer() {
    const p = player, r = p.radius, x = p.x, y = p.y, t = Date.now();
    ctx.save();
    ctx.globalAlpha = p.isInvisible ? 0.4 : 1;

    // Uyku haresi: yumuşak mor nabız halkası
    const pulse = 0.5 + 0.5 * Math.sin(t / 450);
    ctx.beginPath();
    ctx.arc(x, y, r + 7 + pulse * 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(162,155,254,${0.25 + pulse * 0.3})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Gece şapkası (dünya yönünde, sallanarak)
    const sway = Math.sin(t / 350) * 3;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.9, y - r * 0.25);
    ctx.quadraticCurveTo(x - r * 0.5, y - r * 1.5, x + r * 0.2 + sway, y - r * 1.95);
    ctx.quadraticCurveTo(x + r * 0.65, y - r * 1.4, x + r * 0.9, y - r * 0.25);
    ctx.closePath();
    ctx.fillStyle = '#fd79a8';
    ctx.fill();
    ctx.strokeStyle = '#e84393';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + r * 0.2 + sway, y - r * 1.95, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Kapalı uyku gözleri (bakış yönüne göre)
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.angle || 0);
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(r * 0.5, s * r * 0.3, r * 0.17, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();

    drawUltHalo(p);
    ctx.restore();
  }

  function drawRuyaPlayer() {
    const p = player, r = p.radius, x = p.x, y = p.y, t = Date.now();
    ctx.save();
    ctx.globalAlpha = p.isInvisible ? 0.4 : 1;

    // Teal aura
    const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
    g.addColorStop(0, 'rgba(26,188,156,0.35)');
    g.addColorStop(1, 'rgba(26,188,156,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Yörüngede dönen üç yıldız
    for (let i = 0; i < 3; i++) {
      const an = t / 700 + i * Math.PI * 2 / 3;
      drawStar(
        x + Math.cos(an) * (r + 16),
        y + Math.sin(an) * (r + 16) * 0.55,
        4 + (i % 2) * 1.5,
        '#fff3b0',
        t / 300 + i
      );
    }

    // Hilal (başın sağ üstünde, hafif süzülerek)
    const cx = x + r * 0.95, cy = y - r * 1.55 + Math.sin(t / 500) * 2, R = 9;
    ctx.beginPath();
    ctx.moveTo(cx, cy - R);
    ctx.quadraticCurveTo(cx + R * 1.6, cy, cx, cy + R);
    ctx.quadraticCurveTo(cx + R * 0.2, cy, cx, cy - R);
    ctx.closePath();
    ctx.fillStyle = '#fff3b0';
    ctx.shadowColor = '#fff3b0';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Parlak gözler
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.angle || 0);
    ctx.fillStyle = '#e0fff9';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(r * 0.5, s * r * 0.3, r * 0.17, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    drawUltHalo(p);
    ctx.restore();
  }

  // ---------- 9) GÜNCELLEME (her karede, ana update içinden) ----------
  function applyEnemyStatus(ts) {
    getActiveEnemies().forEach(e => {
      if (!baseSpeed.has(e)) baseSpeed.set(e, e.speed || 0);
      const base = baseSpeed.get(e);
      let mult = 1;
      const st = sleepTimers.get(e) || 0;
      if (st > 0) {
        sleepTimers.set(e, st - ts);
        mult = 0;
        // ateş zamanlayıcısını sürekli sıfırla -> ateş edemez
        e.lastShot = Date.now();
      } else {
        for (const z of sleepZones) {
          if (getDist(e, z) < z.r + e.radius) {
            mult = 0.4;
            e.hp -= 0.5 * ts; // ~30 dps
            break;
          }
        }
      }
      if (mult !== 1) {
        e.speed = base * mult;
        slowedSet.add(e);
      } else if (slowedSet.has(e)) {
        e.speed = base;
        slowedSet.delete(e);
      }
    });
  }

  function dreamUpdate(ts) {
    const mine = isMine();
    if (mine && !uiReady) setupDreamUI();
    // pasif şarj: ~60 sn
    if (mine && !player.isDead) addCharge(ts * 100 / 3600);

    // Yastık kalkanı süresi
    if (shieldTimer > 0) {
      shieldTimer -= ts;
      if (shieldTimer <= 0) {
        shieldTimer = 0;
        player.jumpInvulnerable = false;
      }
    }

    // Uyku perdeleri
    for (let i = sleepZones.length - 1; i >= 0; i--) {
      sleepZones[i].life -= ts;
      if (sleepZones[i].life <= 0) sleepZones.splice(i, 1);
    }

    // Meteorlar
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.t -= ts;
      if (m.t <= 0) {
        meteorImpact(m);
        meteors.splice(i, 1);
      }
    }

    // Hayal aynası
    if (clone) {
      clone.life -= ts;
      if (clone.hp <= 0) {
        cloneBlast();
      } else if (clone.life <= 0) {
        fxBurst(clone.x, clone.y, '#1abc9c', 10);
        clone = null;
      } else {
        let best = null, bd = 1e9;
        getActiveEnemies().forEach(e => {
          const d = getDist(clone, e);
          if (d < bd) { bd = d; best = e; }
        });
        if (best) clone.angle = getAngle(clone, best);
      }
    }

    applyEnemyStatus(ts);

    // Ortam efektleri
    if (!player.isDead) {
      if (isUyku() && Math.random() < 0.02 * ts) {
        fxPush({
          type: 'z', x: player.x + 10, y: player.y - 28,
          vx: 0.35, vy: -0.6, life: 70,
          size: 13 + Math.random() * 5, color: '#c7b8ff'
        });
      }
      if (isRuya() && Math.random() < 0.05 * ts) {
        fxPush({
          type: 'star',
          x: player.x + (Math.random() - .5) * 30,
          y: player.y - 30,
          vx: (Math.random() - .5) * 0.3, vy: -0.5,
          life: 60, size: 3 + Math.random() * 2, color: '#fff3b0'
        });
      }
      if (isRuya() && player.isDashing) {
        fxPush({
          type: 'star', x: player.x, y: player.y,
          vx: (Math.random() - .5), vy: (Math.random() - .5),
          life: 30, size: 5, color: '#7ef9ff'
        });
      }
    }

    sleepZones.forEach(z => {
      if (Math.random() < 0.05 * ts) {
        fxPush({
          type: 'z',
          x: z.x + (Math.random() - .5) * z.r,
          y: z.y + (Math.random() - .5) * z.r,
          vx: 0, vy: -0.5, life: 60,
          size: 12 + Math.random() * 6, color: '#a29bfe'
        });
      }
    });

    // Halka ve parçacık güncellemesi
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].life -= ts;
      if (rings[i].life <= 0) rings.splice(i, 1);
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i];
      p.x += p.vx * ts;
      p.y += p.vy * ts;
      p.life -= ts;
      if (p.life <= 0) fx.splice(i, 1);
    }
    if (fx.length > 260) fx.splice(0, fx.length - 260);
  }

  // ---------- 10) ÇİZİM (her karede, ana draw sonunda) ----------
  function dreamDraw() {
    // Uyku perdeleri
    sleepZones.forEach(z => {
      const k = Math.min(1, z.life / 40);
      ctx.save();
      ctx.globalAlpha = k;
      const g = ctx.createRadialGradient(z.x, z.y, z.r * 0.1, z.x, z.y, z.r);
      g.addColorStop(0, 'rgba(142,124,240,0.45)');
      g.addColorStop(1, 'rgba(30,27,75,0.08)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.setLineDash([12, 10]);
      ctx.lineDashOffset = -Date.now() / 40;
      ctx.strokeStyle = '#a29bfe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // Meteorlar (gölge + düşen yıldız)
    meteors.forEach(m => {
      const k = Math.max(0, m.t / m.T);
      ctx.save();
      ctx.globalAlpha = 0.3 + (1 - k) * 0.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 20 + k * 60, 0, Math.PI * 2);
      ctx.strokeStyle = '#7ef9ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.restore();

      const hy = m.y - k * 260;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = '#7ef9ff';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(m.x, hy, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#fdfd96';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(m.x, hy);
      ctx.lineTo(m.x + 6, hy - 26);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(253,253,150,0.6)';
      ctx.stroke();
      ctx.restore();
    });

    // Hayal aynası
    if (hasClone()) {
      const c = clone;
      const al = Math.min(1, c.life / 40) * (0.5 + 0.2 * Math.sin(Date.now() / 120));
      ctx.save();
      ctx.globalAlpha = al;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius + 6 + Math.sin(Date.now() / 200) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#7ef9ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(26,188,156,0.7)';
      ctx.fill();
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle || 0);
      ctx.fillStyle = '#e0fff9';
      ctx.beginPath();
      ctx.arc(c.radius * 0.5, -c.radius * 0.28, c.radius * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c.radius * 0.5, c.radius * 0.28, c.radius * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#444';
      ctx.fillRect(c.x - 20, c.y - c.radius - 12, 40, 4);
      ctx.fillStyle = '#7ef9ff';
      ctx.fillRect(c.x - 20, c.y - c.radius - 12, 40 * Math.max(0, c.hp / c.maxHp), 4);
      ctx.restore();
    }

    // Derin Uyku'da uyuyan düşmanların üzerinde Z harfleri
    getActiveEnemies().forEach(e => {
      if ((sleepTimers.get(e) || 0) <= 0) return;
      const t = Date.now() / 25;
      for (let k = 0; k < 2; k++) {
        const ph = (t + k * 30) % 40;
        drawZ(e.x + 10 + k * 8, e.y - e.radius - 14 - ph, 14 - k * 3, 1 - ph / 40, '#c7b8ff');
      }
    });

    // Karakter görünümü
    if (!player.isDead && isMine()) {
      if (isUyku()) drawUykuPlayer();
      else drawRuyaPlayer();
    }

    // Yastık kalkanı balonları
    if (shieldTimer > 0 && !player.isDead) {
      const t = Date.now() / 400;
      const blink = (shieldTimer < 40 && Math.floor(shieldTimer / 4) % 2 === 0) ? 0.35 : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      for (let i = 0; i < 7; i++) {
        const an = t + i * Math.PI * 2 / 7;
        ctx.beginPath();
        ctx.arc(
          player.x + Math.cos(an) * (player.radius + 12),
          player.y + Math.sin(an) * (player.radius + 12),
          8, 0, Math.PI * 2
        );
        ctx.fillStyle = 'rgba(235,240,255,0.7)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200,215,255,0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Nişan önizlemeleri
    if (!player.isDead && isMine()) {
      if (gadAim.active && player.gadgetReady) {
        const pm = gadAim.pull !== undefined ? gadAim.pull : 1;
        ctx.save();
        if (isUyku()) {
          const tgt = aimPoint(gadAim.angle, Math.max(50, RANGE * 0.75 * pm), 110);
          ctx.beginPath();
          ctx.arc(tgt.x, tgt.y, 115, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(142,124,240,0.18)';
          ctx.fill();
          ctx.setLineDash([8, 8]);
          ctx.strokeStyle = 'rgba(162,155,254,0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(126,249,255,0.7)';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.setLineDash([10, 8]);
          ctx.beginPath();
          ctx.moveTo(player.x, player.y);
          ctx.lineTo(player.x + Math.cos(gadAim.angle) * 160, player.y + Math.sin(gadAim.angle) * 160);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (gadAim2.active && player.gadget2Ready) {
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        if (isUyku()) {
          ctx.beginPath();
          ctx.arc(player.x, player.y, player.radius + 18, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(223,230,255,0.8)';
          ctx.stroke();
        } else {
          const tgt = aimPoint(gadAim2.angle, 100, 40);
          ctx.beginPath();
          ctx.arc(tgt.x, tgt.y, 20, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(26,188,156,0.9)';
          ctx.stroke();
        }
        ctx.restore();
      }

      if (ultAim.active && player.ultReady) {
        ctx.save();
        ctx.setLineDash([10, 10]);
        ctx.lineWidth = 2;
        if (isUyku()) {
          ctx.beginPath();
          ctx.arc(player.x, player.y, 300, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(162,155,254,0.7)';
          ctx.stroke();
        } else {
          const tgt = aimPoint(ultAim.angle, RANGE * 0.7, 90);
          ctx.beginPath();
          ctx.arc(tgt.x, tgt.y, 90, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(126,249,255,0.8)';
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Halkalar
    rings.forEach(r => {
      const k = 1 - r.life / r.maxLife;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.R * (0.25 + 0.75 * k), 0, Math.PI * 2);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2 + 3 * (1 - k);
      ctx.stroke();
      ctx.restore();
    });

    // Parçacıklar
    fx.forEach(p => {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.type === 'z') {
        drawZ(p.x, p.y, p.size, a, p.color);
      } else if (p.type === 'star') {
        drawStar(p.x, p.y, p.size * (0.5 + a * 0.5), p.color, p.rot + (p.maxLife - p.life) * 0.08);
      } else {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
  }

  // ---------- 11) HOOK ZİNCİRİ (önceki modların hook'larını bozmaz) ----------
  const prevTarget = H.getBotTarget, prevEngage = H.getEngageDistance, prevExtra = H.getExtraTargets;
  const prevKilled = H.onEnemyKilled, prevBot = H.onBotSpawnTick, prevDraw = H.onDraw, prevReset = H.onReset;

  // Botlar, aktif bir hayal aynası varsa onu hedefler
  H.getBotTarget = function (bot) {
    const t = prevTarget ? prevTarget(bot) : null;
    if (t) return t;
    return hasClone() ? clone : null;
  };

  H.getEngageDistance = function (bot) {
    const custom = prevTarget ? prevTarget(bot) : null;
    if (!custom && hasClone()) return getDist(clone, bot);
    return prevEngage ? prevEngage(bot) : getDist(player, bot);
  };

  // Bot mermileri aynaya da çarpabilsin
  H.getExtraTargets = function () {
    const base = prevExtra ? (prevExtra() || []) : [];
    return hasClone() ? base.concat([clone]) : base;
  };

  H.onEnemyKilled = function (enemy) {
    if (prevKilled) prevKilled(enemy);
    addCharge(25);
  };

  H.onBotSpawnTick = function (ts) {
    if (prevBot) prevBot(ts);
    dreamUpdate(ts);
  };

  H.onDraw = function (c) {
    if (prevDraw) prevDraw(c);
    dreamDraw();
  };

  H.onReset = function () {
    if (prevReset) prevReset();
    if (shieldTimer > 0) player.jumpInvulnerable = false;
    clone = null;
    fx = [];
    rings = [];
    sleepZones = [];
    meteors = [];
    shieldTimer = 0;
    uiReady = false;
    sleepTimers = new WeakMap();
    baseSpeed = new WeakMap();
    slowedSet = new WeakSet();
  };

  // ---------- 12) KARAKTER KARTLARI (HTML'e dokunmadan ekleniyor) ----------
  const container = document.querySelector('.char-select-container');
  if (container) {
    container.insertAdjacentHTML('beforeend',
      `<div class="char-card" id="char-${UYKU}">` +
        `<div class="char-color-preview" style="background:radial-gradient(circle at 35% 35%,#b2a8ff,#4b3f9e);"></div>` +
        `<span>Uykucu</span><small>Yetenek: Uyku Perdesi / Yastık Kalkanı<br>Güç: Derin Uyku</small>` +
      `</div>` +
      `<div class="char-card" id="char-${RUYA}">` +
        `<div class="char-color-preview" style="background:radial-gradient(circle at 35% 35%,#a0fff0,#0e7d6b);"></div>` +
        `<span>Rüyagezer</span><small>Yetenek: Rüya Atılımı / Hayal Aynası<br>Güç: Yıldız Yağmuru</small>` +
      `</div>`);

    [UYKU, RUYA].forEach(id => {
      document.getElementById('char-' + id).addEventListener('click', () => {
        selectedCharacter = id;
        document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
        document.getElementById('char-' + id).classList.add('selected');
      });
    });
  }
})();
