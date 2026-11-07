// ============================================================================
// KARAKTER: WILCHER (wilcher.js)
// ----------------------------------------------------------------------------
// Tema: kader bağı. Yakın dövüş, yerden bir şey toplamaz.
//
// NORMAL ATIŞ - Yay: hafif ileri atılıp önündeki yaydaki herkese 650 hasar vurur.
// PASİF - Kader Bağı: yay vuruşunda en iyi hizalanan düşman "bağlı hedef" olur.
//   Bağ menzilindeyken (330) aldığın hasarın %40'ı bağlı düşmana geçer ve sana
//   iyileşme olarak döner. Aktarılan hasar birikir; bağlı düşman ölünce bağ
//   koparak biriken hasar kadar çevreye patlar. Menzil dışında ~3 sn kalırsan
//   bağ patlamadan kopar.
// YETENEK 1 - Bağ Aktar: nişan yönündeki (koniyle) en yakın düşmana bağı kaydırır,
//   biriken hasar yeni hedefe taşınır. Hedef yoksa bekleme süresi harcanmaz.
// YETENEK 2 - Kader Sıçraması: bağlı düşmana (yoksa nişan yönüne) atılır, kısa süre
//   dokunulmaz olur, inişte çevreye hasar verir. Bağsız inişte yakındaki düşman bağlanır.
// ULTİ - Kader Hükmü: 8 sn boyunca aynı anda 3 düşmana bağlanabilir. Konideki en
//   yakın 3 düşman anında bağlanır, yay vuruşları da yeni bağ kurar. 2+ bağda hasar
//   aktarımı %60'a çıkar ve bağlılar arasında bölünür. Biri ölünce patlama diğer
//   bağlıları da vurur (kümelenmiş düşmanlarda zincirleme).
//
// Ulti şarjı sadece yay isabetlerinden dolar (aktarım/patlama sayıları şarj etmez).
// ============================================================================
(function () {
  'use strict';

  if (typeof player === 'undefined' || typeof getActiveEnemies !== 'function') {
    console.warn('[wilcher] Ana oyun bulunamadı, mod yüklenmedi.');
    return;
  }
  console.log('[MOD YÜKLENDİ] wilcher');

  const ID = 'wilcher';
  const COLOR = '#1abc9c';
  const LINK_COLOR = '#48e0c8';
  const CHAR_HP = 4200;
  const CHAR_SPEED = 3.6;

  // Normal atış: yay
  const SLASH_RANGE = 105, SLASH_HALF = 0.95, SLASH_DAMAGE = 650, LUNGE = 22;
  // Kader Bağı
  const LINK_RANGE = 330;
  const REDIRECT_ONE = 0.4, REDIRECT_MULTI = 0.6;
  const STRAIN_LIMIT = 180;   // menzil dışında ~3 sn
  const STORE_CAP = 2400;
  const BURST_BASE = 350, BURST_MAX = 2200, BURST_RADIUS = 170;
  // Yetenek 1: Bağ Aktar
  const TRANSFER_RANGE = 420, TRANSFER_HALF = 0.55, TRANSFER_COOLDOWN = 480; // 8 sn
  // Yetenek 2: Kader Sıçraması
  const DASH_COOLDOWN = 720;  // 12 sn
  const DASH_MAX = 420, DASH_FREE = 260, DASH_DURATION = 24, DASH_DAMAGE = 450, DASH_KNOCKBACK = 10;
  // Ulti: Kader Hükmü
  const HUKUM_TIME = 480;     // 8 sn
  const HUKUM_RANGE = 380, HUKUM_HALF = 1.1, HUKUM_MAX_LINKS = 3;

  const EXT = (window.GAME_EXT = window.GAME_EXT || { characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {} });
  EXT.characters = EXT.characters || {};
  EXT.hooks = EXT.hooks || {};
  EXT.characters[ID] = { color: COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

  function chain(name, fn) {
    const prev = EXT.hooks[name];
    EXT.hooks[name] = function () {
      let r;
      if (typeof prev === 'function') r = prev.apply(this, arguments);
      fn.apply(this, arguments);
      return r;
    };
  }

  // ---- Durum ----
  let links = [];          // { target, stored, strain, warned, lastX, lastY }
  let lastHp = null;
  let humTimer = 0;        // Kader Hükmü kalan süre (kare)
  let jumpPending = false; // Kader Sıçraması sonrası iniş kontrolü
  let noCharge = false;    // aktarım/patlama sayıları ulti şarjı doldurmasın
  const slashes = [];

  const angDiff = (x, y) => Math.abs(Math.atan2(Math.sin(x - y), Math.cos(x - y)));
  const maxLinks = () => (humTimer > 0 ? HUKUM_MAX_LINKS : 1);
  const isLinked = (e) => links.some(l => l.target === e);

  function floatNC(x, y, v, c) {
    noCharge = true;
    addFloatingNumber(x, y, v, c);
    noCharge = false;
  }

  function addLink(e) {
    if (isLinked(e) || links.length >= maxLinks()) return false;
    links.push({ target: e, stored: 0, strain: 0, warned: false, lastX: e.x, lastY: e.y });
    floatNC(e.x, e.y - 30, 'KADER BAĞI', LINK_COLOR);
    return true;
  }

  // ---- Karakter kartı ----
  const container = document.querySelector('.char-select-container');
  if (container && !document.getElementById('char-' + ID)) {
    const card = document.createElement('div');
    card.className = 'char-card';
    card.id = 'char-' + ID;
    card.innerHTML =
      '<div class="char-color-preview" style="background:' + COLOR + ';"></div>' +
      '<span>Wilcher</span>' +
      '<small>Hasar: 650 (yakın yay)<br>Güç: Kader Hükmü</small>';
    container.appendChild(card);
    card.addEventListener('click', () => {
      selectedCharacter = ID;
      document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
      card.classList.add('selected');
    });
  }

  // ---- Saldırı ----
  function slash(p, a) {
    p.consumeAmmo();
    p.x = clampPos(p.x + Math.cos(a) * LUNGE, p.radius + WALL_THICKNESS, canvas.width - p.radius - WALL_THICKNESS);
    p.y = clampPos(p.y + Math.sin(a) * LUNGE, p.radius + WALL_THICKNESS, canvas.height - p.radius - WALL_THICKNESS);
    slashes.push({ x: p.x, y: p.y, a: a, life: 10, maxLife: 10 });

    const hits = [];
    getActiveEnemies().forEach(e => {
      if (getDist(p, e) > SLASH_RANGE + e.radius) return;
      const diff = angDiff(getAngle(p, e), a);
      if (diff > SLASH_HALF) return;
      e.hp -= SLASH_DAMAGE;
      addFloatingNumber(e.x, e.y, SLASH_DAMAGE, '#ffffff'); // isabet ulti şarjı doldurur
      spawnParticles(e.x, e.y, LINK_COLOR, 'normal');
      hits.push({ e, diff });
    });
    if (hits.length) {
      screenShake = Math.max(screenShake, 4);
      hits.sort((x, y) => x.diff - y.diff);
      if (humTimer > 0) {
        for (const h of hits) {
          if (isLinked(h.e)) continue;
          if (!addLink(h.e)) break;
        }
      } else if (!links.length) {
        addLink(hits[0].e);
      }
    }
  }

  // ---- Bağ kopması patlaması ----
  function burst(l, enemies) {
    const dmg = Math.min(BURST_MAX, BURST_BASE + l.stored);
    explosions.push({ x: l.lastX, y: l.lastY, radius: 0, maxRadius: BURST_RADIUS, life: 15, maxLife: 15 });
    spawnParticles(l.lastX, l.lastY, LINK_COLOR, 'normal');
    screenShake = Math.max(screenShake, 10);
    floatNC(l.lastX, l.lastY - 30, 'BAĞ KOPMASI!', LINK_COLOR);
    enemies.forEach(e => {
      if (e === l.target) return;
      if (getDist({ x: l.lastX, y: l.lastY }, e) < BURST_RADIUS + e.radius) {
        e.hp -= dmg;
        floatNC(e.x, e.y, Math.floor(dmg), LINK_COLOR);
      }
    });
  }

  // ---- Yetenek 1: Bağ Aktar ----
  function pickTransferTarget(angle) {
    let best = null, bestDiff = Infinity;
    getActiveEnemies().forEach(e => {
      if (isLinked(e) || getDist(player, e) > TRANSFER_RANGE) return;
      const diff = angDiff(getAngle(player, e), angle);
      if (diff > TRANSFER_HALF) return;
      if (diff < bestDiff) { bestDiff = diff; best = e; }
    });
    return best;
  }

  function transferLink(cand) {
    if (!links.length) { addLink(cand); return; }
    // Birden fazla bağ varsa en uzaktaki (en çok gerilen) bağı aktar
    let far = links[0], fd = -1;
    links.forEach(l => { const d = getDist(player, l.target); if (d > fd) { fd = d; far = l; } });
    far.target = cand;
    far.strain = 0; far.warned = false;
    far.lastX = cand.x; far.lastY = cand.y;
    floatNC(cand.x, cand.y - 30, 'BAĞ AKTARILDI', LINK_COLOR);
    spawnParticles(cand.x, cand.y, LINK_COLOR, 'normal');
  }

  // ---- Yetenek 2: Kader Sıçraması ----
  function dashPlan(angle, pull) {
    const lim = (v, lo, hi) => clampPos(v, lo, hi);
    const minX = WALL_THICKNESS + player.radius + 5, maxX = canvas.width - WALL_THICKNESS - player.radius - 5;
    const minY = WALL_THICKNESS + player.radius + 5, maxY = canvas.height - WALL_THICKNESS - player.radius - 5;
    const enemies = getActiveEnemies();
    const linked = links.map(l => l.target).filter(t => enemies.includes(t) && t.hp > 0);
    if (linked.length) {
      let best = null, bd = Infinity;
      linked.forEach(t => { const d = angDiff(getAngle(player, t), angle); if (d < bd) { bd = d; best = t; } });
      const dist = Math.max(0, Math.min(DASH_MAX, getDist(player, best) - (best.radius + player.radius + 4)));
      const ang = getAngle(player, best);
      return { x: lim(player.x + Math.cos(ang) * dist, minX, maxX), y: lim(player.y + Math.sin(ang) * dist, minY, maxY), target: best };
    }
    const p = (pull === undefined || pull < 0.05) ? 1 : Math.min(1, pull);
    const dist = Math.max(60, DASH_FREE * p);
    return { x: lim(player.x + Math.cos(angle) * dist, minX, maxX), y: lim(player.y + Math.sin(angle) * dist, minY, maxY), target: null };
  }

  // ---- Ulti: Kader Hükmü ----
  function hukumPool(angle) {
    const arr = getActiveEnemies()
      .filter(e => !isLinked(e) && getDist(player, e) <= HUKUM_RANGE)
      .map(e => ({ e, d: getDist(player, e), diff: angDiff(getAngle(player, e), angle) }));
    const cone = arr.filter(x => x.diff <= HUKUM_HALF).sort((a, b) => a.d - b.d);
    return (cone.length ? cone : arr.sort((a, b) => a.d - b.d)).map(x => x.e);
  }

  // ---- Player override'ları ----
  const proto = Object.getPrototypeOf(player);

  const origSetCharacter = proto.setCharacter;
  proto.setCharacter = function (type) {
    origSetCharacter.call(this, type);
    this.reloadSpeed = type === ID ? 0.024 : 0.015; // yakın dövüş: daha hızlı şarj
    if (type === ID) {
      links = []; lastHp = null; humTimer = 0; jumpPending = false; slashes.length = 0;
      gadgetBtn.innerHTML = 'BAĞ<br>AKTAR<br><span id="gadget-timer"></span>';
      gadgetBtn2.innerHTML = 'KADER<br>SIÇRAMA<br><span id="gadget-timer-2"></span>';
      gadgetBtn.classList.remove('cooldown', 'active');
      gadgetBtn2.classList.remove('cooldown');
    }
  };

  const origFire = proto.fire;
  proto.fire = function (a, pull) {
    if (this.charType !== ID) return origFire.call(this, a, pull);
    if (this.isDead || this.ammo < 1) return;
    slash(this, a);
  };

  const origGadget = proto.activateGadget;
  proto.activateGadget = function (a, pull) {
    if (this.charType !== ID) return origGadget.call(this, a, pull);
    if (!this.gadgetReady || this.isDead) return;
    const angle = a !== undefined ? a : this.angle;
    const cand = pickTransferTarget(angle);
    if (!cand) { addFloatingNumber(this.x, this.y - 30, 'HEDEF YOK', '#e74c3c'); return; }
    transferLink(cand);
    this.gadgetReady = false;
    this.gadgetCooldown = TRANSFER_COOLDOWN;
    gadgetBtn.classList.remove('active');
    gadgetBtn.classList.add('cooldown');
  };

  const origGadget2 = proto.activateGadget2;
  proto.activateGadget2 = function (a, pull) {
    if (this.charType !== ID) return origGadget2.call(this, a, pull);
    if (!this.gadget2Ready || this.isDead || this.isJumping) return;
    const angle = a !== undefined ? a : this.angle;
    const plan = dashPlan(angle, pull);
    // Ana dosyadaki sıçrama sistemini kullanır (dokunulmazlık + iniş hasarı orada)
    this.isJumping = true; this.jumpInvulnerable = true;
    this.jumpStartX = this.x; this.jumpStartY = this.y;
    this.jumpTargetX = plan.x; this.jumpTargetY = plan.y;
    this.jumpProgress = 0; this.jumpDuration = DASH_DURATION;
    this.jumpDamage = DASH_DAMAGE; this.jumpKnockback = DASH_KNOCKBACK; this.jumpLabel = 'KADER SIÇRAMASI!';
    spawnParticles(this.x, this.y, LINK_COLOR, 'smoke');
    jumpPending = true;
    this.gadget2Ready = false;
    this.gadget2Cooldown = DASH_COOLDOWN;
    gadgetBtn2.classList.add('cooldown');
  };

  const origUlti = proto.fireUlti;
  proto.fireUlti = function (a, pull) {
    if (this.charType !== ID) return origUlti.call(this, a, pull);
    if (!this.ultReady || this.isDead) return;
    const angle = a !== undefined ? a : this.angle;
    const pool = hukumPool(angle);
    if (!pool.length && !links.length) { addFloatingNumber(this.x, this.y - 30, 'HEDEF YOK', '#e74c3c'); return; }
    humTimer = HUKUM_TIME;
    for (const e of pool) { if (!addLink(e)) break; }
    addFloatingNumber(this.x, this.y - 40, 'KADER HÜKMÜ!', LINK_COLOR);
    spawnParticles(this.x, this.y, LINK_COLOR, 'smoke');
    screenShake = Math.max(screenShake, 8);
    this.ultReady = false;
    this.ultCharge = 0;
    if (ultFill) ultFill.style.width = '0%';
    if (ultiBtn) ultiBtn.classList.remove('ready');
  };

  // Ulti şarjı: ana dosya bu karakteri tanımıyor (mod5.js ile aynı yöntem)
  const origChargeUlti = window.chargeUlti;
  window.chargeUlti = function (amount) {
    if (player.charType !== ID) return typeof origChargeUlti === 'function' ? origChargeUlti(amount) : undefined;
    if (!gameStarted || player.ultReady || noCharge) return;
    player.ultCharge = Math.min(100, player.ultCharge + amount);
    if (player.ultCharge === 100) {
      player.ultReady = true;
      if (ultiBtn) ultiBtn.classList.add('ready');
      addFloatingNumber(player.x, player.y - 40, 'GÜÇ HAZIR!', '#f1c40f');
    }
    if (ultFill) ultFill.style.width = player.ultCharge + '%';
  };

  // Ana dosyanın çizdiği 300 birimlik mermi nişanı yerine gerçek yay menzilini çiz
  const origDraw = window.draw;
  if (typeof origDraw === 'function') {
    window.draw = function () {
      const wil = gameStarted && player.charType === ID;
      const wasActive = aimData.active;
      if (wil) aimData.active = false;
      try {
        return origDraw.apply(this, arguments);
      } finally {
        if (wil) { aimData.active = wasActive; drawAim(); }
      }
    };
  }

  // ---- Her kare ----
  function showButtons() {
    // Ana dosya bu karakteri listede bulamayıp düğmeleri gizliyor, her karede geri açıyoruz
    if (ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
    if (gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
    if (gadgetBtn2.style.display !== 'flex') gadgetBtn2.style.display = 'flex';
  }

  function tick(ts) {
    for (let i = slashes.length - 1; i >= 0; i--) {
      slashes[i].life -= ts;
      if (slashes[i].life <= 0) slashes.splice(i, 1);
    }
    if (player.charType !== ID) { links = []; lastHp = null; humTimer = 0; jumpPending = false; return; }
    showButtons();
    if (player.isDead) { links = []; lastHp = player.hp; jumpPending = false; return; }

    const enemies = getActiveEnemies();

    // Hüküm süresi
    if (humTimer > 0) {
      humTimer -= ts;
      if (humTimer <= 0) {
        humTimer = 0;
        if (links.length > 1) {
          links.length = 1;
          addFloatingNumber(player.x, player.y - 30, 'HÜKÜM BİTTİ', LINK_COLOR);
        }
      }
    }

    // Hasar aktarımı
    if (links.length && lastHp !== null) {
      const lost = lastHp - player.hp;
      if (lost > 0) {
        const inRange = links.filter(l => enemies.includes(l.target) && l.target.hp > 0 && getDist(player, l.target) <= LINK_RANGE);
        if (inRange.length) {
          const total = Math.floor(lost * (inRange.length > 1 ? REDIRECT_MULTI : REDIRECT_ONE));
          const share = Math.floor(total / inRange.length);
          if (share > 0) {
            player.hp = Math.min(player.maxHp, player.hp + share * inRange.length);
            inRange.forEach(l => {
              l.target.hp -= share;
              l.stored = Math.min(STORE_CAP, l.stored + share);
              floatNC(l.target.x, l.target.y, share, LINK_COLOR);
              spawnParticles(l.target.x, l.target.y, LINK_COLOR, 'normal');
            });
          }
        }
      }
    }

    // Bağ bakımı: ölüm -> patlama, menzil dışı -> kopma
    for (let i = links.length - 1; i >= 0; i--) {
      const l = links[i], t = l.target;
      const alive = enemies.includes(t) && t.hp > 0;
      if (alive) {
        l.lastX = t.x; l.lastY = t.y;
        if (getDist(player, t) > LINK_RANGE) {
          l.strain += ts;
          if (!l.warned) { l.warned = true; addFloatingNumber(player.x, player.y - 30, 'BAĞ GERİLDİ!', '#e74c3c'); }
          if (l.strain >= STRAIN_LIMIT) {
            addFloatingNumber(player.x, player.y - 30, 'BAĞ KOPTU', '#e74c3c');
            links.splice(i, 1);
          }
        } else {
          l.strain = Math.max(0, l.strain - ts * 2);
          if (l.strain === 0) l.warned = false;
        }
      } else {
        links.splice(i, 1);
        burst(l, enemies);
      }
    }

    // Kader Sıçraması inişi: bağ yoksa yakındaki düşmanı bağla
    if (jumpPending && !player.isJumping) {
      jumpPending = false;
      if (!links.length) {
        let near = null, nd = 130;
        enemies.forEach(e => { const d = getDist(player, e); if (d < nd) { nd = d; near = e; } });
        if (near) addLink(near);
      }
    }

    lastHp = player.hp;
  }

  // ---- Çizim ----
  function drawLink(c, l) {
    const t = l.target;
    const strained = getDist(player, t) > LINK_RANGE;
    c.save();
    c.strokeStyle = strained ? 'rgba(231,76,60,0.85)' : 'rgba(72,224,200,0.85)';
    c.lineWidth = 3 + Math.min(4, l.stored / 500);
    c.setLineDash([8, 6]);
    c.lineDashOffset = -Date.now() / 40;
    c.beginPath(); c.moveTo(player.x, player.y); c.lineTo(t.x, t.y); c.stroke();
    c.setLineDash([]);
    c.beginPath(); c.arc(t.x, t.y, t.radius + 8 + Math.sin(Date.now() / 150) * 3, 0, Math.PI * 2); c.stroke();
    // Patlama yarıçapı önizlemesi: düşmanları bu çemberin içine toplamak taktik avantaj
    c.globalAlpha = 0.28;
    c.beginPath(); c.arc(t.x, t.y, BURST_RADIUS, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = '#333'; c.fillRect(t.x - 20, t.y + t.radius + 12, 40, 4);
    c.fillStyle = LINK_COLOR; c.fillRect(t.x - 20, t.y + t.radius + 12, 40 * (l.stored / STORE_CAP), 4);
    c.restore();
  }

  function sector(c, angle, radius, half, fill, stroke) {
    c.save();
    c.translate(player.x, player.y);
    c.rotate(angle);
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, radius, -half, half); c.closePath();
    c.fillStyle = fill; c.fill();
    c.strokeStyle = stroke; c.lineWidth = 2; c.stroke();
    c.restore();
  }

  function ring(c, e, color) {
    c.save();
    c.beginPath(); c.arc(e.x, e.y, e.radius + 10, 0, Math.PI * 2);
    c.strokeStyle = color; c.lineWidth = 3; c.stroke();
    c.restore();
  }

  function drawEffects(c) {
    slashes.forEach(s => {
      const t = s.life / s.maxLife;
      c.save();
      c.translate(s.x, s.y);
      c.rotate(s.a);
      c.globalAlpha = t;
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, SLASH_RANGE, -SLASH_HALF, SLASH_HALF); c.closePath();
      c.fillStyle = 'rgba(72,224,200,0.25)'; c.fill();
      c.beginPath(); c.arc(0, 0, SLASH_RANGE, -SLASH_HALF, SLASH_HALF);
      c.strokeStyle = '#d8fff8'; c.lineWidth = 8; c.lineCap = 'round'; c.stroke();
      c.restore();
    });

    if (player.charType !== ID || player.isDead) return;

    links.forEach(l => drawLink(c, l));

    if (humTimer > 0) {
      c.save();
      c.strokeStyle = LINK_COLOR; c.lineWidth = 3;
      c.globalAlpha = 0.6 + Math.sin(Date.now() / 120) * 0.25;
      c.beginPath();
      c.arc(player.x, player.y, player.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (humTimer / HUKUM_TIME));
      c.stroke();
      c.restore();
    }

    // Nişan önizlemeleri
    if (gadAim.active && player.gadgetReady) {
      sector(c, gadAim.angle, TRANSFER_RANGE, TRANSFER_HALF, 'rgba(72,224,200,0.12)', 'rgba(72,224,200,0.5)');
      const cand = pickTransferTarget(gadAim.angle);
      if (cand) ring(c, cand, LINK_COLOR);
    }
    if (gadAim2.active && player.gadget2Ready) {
      const plan = dashPlan(gadAim2.angle, gadAim2.pull);
      c.save();
      c.beginPath(); c.moveTo(player.x, player.y); c.lineTo(plan.x, plan.y);
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.setLineDash([5, 5]); c.stroke();
      c.setLineDash([]);
      c.globalAlpha = 0.25;
      c.beginPath(); c.arc(plan.x, plan.y, 100, 0, Math.PI * 2); c.fillStyle = LINK_COLOR; c.fill();
      c.restore();
      if (plan.target) ring(c, plan.target, LINK_COLOR);
    }
    if (ultAim.active && player.ultReady) {
      sector(c, ultAim.angle, HUKUM_RANGE, HUKUM_HALF, 'rgba(241,196,15,0.10)', 'rgba(241,196,15,0.55)');
      hukumPool(ultAim.angle).slice(0, HUKUM_MAX_LINKS - links.length).forEach(e => ring(c, e, '#f1c40f'));
    }
  }

  // Ana oyunun çizdiği mermi nişanı yerine gerçek yay menzili
  function drawAim() {
    if (!aimData.active || player.isDead || player.ammo < 1) return;
    sector(ctx, aimData.angle, SLASH_RANGE + LUNGE, SLASH_HALF, 'rgba(72,224,200,0.16)', 'rgba(72,224,200,0.55)');
  }

  chain('onBotSpawnTick', tick);
  chain('onDraw', drawEffects);
  chain('onReset', function () { links = []; lastHp = null; humTimer = 0; jumpPending = false; slashes.length = 0; });
})();
