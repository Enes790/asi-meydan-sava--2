// wilcher.js — "Wilcher" karakteri (yakın dövüş). Ana oyun dosyasına dokunmaz.
// Kurulum: HTML'de EN SON mod dosyasından (mod1.js) sonra şunu ekle:
//   <script src="wilcher.js"></script>
//
// SALDIRI : Yakın mesafe yay vuruşu (hafif ileri atılır), yaydaki herkese hasar verir.
// GÜÇ     : KADER BAĞI (pasif, yerden bir şey toplamaz)
//   - Yay vuruşunda en iyi hizalanan düşman "bağlı hedef" olur.
//   - Bağ menzilindeyken Wilcher'ın aldığı hasarın %40'ı bağlı düşmana geçer.
//   - Aktarılan hasar birikir. Bağlı düşman ölünce bağ kopar ve biriken hasar
//     kadar çevreye patlar -> düşmanları bağlı hedefin yanına toplamak taktik kazandırır.
//   - Menzil dışında ~3 sn kalırsan bağ patlamadan kopar.
(function () {
  'use strict';

  if (typeof player === 'undefined' || typeof getActiveEnemies !== 'function') {
    console.warn('[wilcher] Ana oyun bulunamadı, mod yüklenmedi.');
    return;
  }

  const ID = 'wilcher';
  const COLOR = '#1abc9c';
  const LINK_COLOR = '#48e0c8';

  // Yakın dövüş yayı
  const SLASH_RANGE = 105, SLASH_HALF = 0.95, SLASH_DAMAGE = 650, LUNGE = 22;
  // Kader Bağı
  const LINK_RANGE = 330;   // bağın çalıştığı mesafe
  const REDIRECT = 0.4;     // alınan hasarın bağlı düşmana aktarılan oranı
  const STRAIN_LIMIT = 180; // menzil dışında bu kadar kare (~3 sn) kalırsa bağ kopar
  const STORE_CAP = 2400;   // biriken hasar sınırı
  const BURST_BASE = 350, BURST_MAX = 2200, BURST_RADIUS = 170;

  const EXT = (window.GAME_EXT = window.GAME_EXT || { characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {} });
  EXT.characters = EXT.characters || {};
  EXT.hooks = EXT.hooks || {};
  EXT.characters[ID] = { color: COLOR, hp: 4200, speed: 3.6 };

  // Başka mod dosyalarının hook'larını ezmemek için zincirle
  function chain(name, fn) {
    const prev = EXT.hooks[name];
    EXT.hooks[name] = function () {
      let r;
      if (typeof prev === 'function') r = prev.apply(this, arguments);
      fn.apply(this, arguments);
      return r;
    };
  }

  let link = null;   // { target, stored, strain, warned, lastX, lastY }
  let lastHp = null;
  const slashes = [];

  const angDiff = (x, y) => Math.abs(Math.atan2(Math.sin(x - y), Math.cos(x - y)));

  // ---------- Saldırı ----------
  function slash(p, a) {
    p.consumeAmmo();
    p.x = clampPos(p.x + Math.cos(a) * LUNGE, p.radius + WALL_THICKNESS, canvas.width - p.radius - WALL_THICKNESS);
    p.y = clampPos(p.y + Math.sin(a) * LUNGE, p.radius + WALL_THICKNESS, canvas.height - p.radius - WALL_THICKNESS);
    slashes.push({ x: p.x, y: p.y, a: a, life: 10, maxLife: 10 });

    let best = null, bestDiff = Infinity;
    getActiveEnemies().forEach(e => {
      if (getDist(p, e) > SLASH_RANGE + e.radius) return;
      const diff = angDiff(getAngle(p, e), a);
      if (diff > SLASH_HALF) return;
      e.hp -= SLASH_DAMAGE;
      addFloatingNumber(e.x, e.y, SLASH_DAMAGE, '#ffffff');
      spawnParticles(e.x, e.y, LINK_COLOR, 'normal');
      if (diff < bestDiff) { bestDiff = diff; best = e; }
    });
    if (best) {
      screenShake = Math.max(screenShake, 4);
      if (!link) {
        link = { target: best, stored: 0, strain: 0, warned: false, lastX: best.x, lastY: best.y };
        addFloatingNumber(best.x, best.y - 30, 'KADER BAĞI', LINK_COLOR);
      }
    }
  }

  // ---------- Bağ kopması patlaması ----------
  function burst(l, enemies) {
    const dmg = Math.min(BURST_MAX, BURST_BASE + l.stored);
    explosions.push({ x: l.lastX, y: l.lastY, radius: 0, maxRadius: BURST_RADIUS, life: 15, maxLife: 15 });
    spawnParticles(l.lastX, l.lastY, LINK_COLOR, 'normal');
    screenShake = Math.max(screenShake, 10);
    addFloatingNumber(l.lastX, l.lastY - 30, 'BAĞ KOPMASI!', LINK_COLOR);
    enemies.forEach(e => {
      if (e === l.target) return;
      if (getDist({ x: l.lastX, y: l.lastY }, e) < BURST_RADIUS + e.radius) {
        e.hp -= dmg;
        addFloatingNumber(e.x, e.y, Math.floor(dmg), LINK_COLOR);
      }
    });
  }

  // ---------- Her kare ----------
  function tick(ts) {
    for (let i = slashes.length - 1; i >= 0; i--) {
      slashes[i].life -= ts;
      if (slashes[i].life <= 0) slashes.splice(i, 1);
    }
    if (player.charType !== ID) { link = null; lastHp = null; return; }
    if (player.isDead) { link = null; lastHp = player.hp; return; }

    const enemies = getActiveEnemies();

    // Hasar aktarımı: bu karede kaybedilen can varsa bir kısmı bağlı düşmana geçer
    if (link && lastHp !== null) {
      const lost = lastHp - player.hp;
      if (lost > 0 && enemies.includes(link.target) && getDist(player, link.target) <= LINK_RANGE) {
        const moved = Math.floor(lost * REDIRECT);
        if (moved > 0) {
          player.hp = Math.min(player.maxHp, player.hp + moved);
          link.target.hp -= moved;
          link.stored = Math.min(STORE_CAP, link.stored + moved);
          addFloatingNumber(link.target.x, link.target.y, moved, LINK_COLOR);
          spawnParticles(link.target.x, link.target.y, LINK_COLOR, 'normal');
        }
      }
    }

    if (link) {
      const t = link.target;
      const alive = enemies.includes(t) && t.hp > 0;
      if (alive) {
        link.lastX = t.x; link.lastY = t.y;
        if (getDist(player, t) > LINK_RANGE) {
          link.strain += ts;
          if (!link.warned) { link.warned = true; addFloatingNumber(player.x, player.y - 30, 'BAĞ GERİLDİ!', '#e74c3c'); }
          if (link.strain >= STRAIN_LIMIT) { addFloatingNumber(player.x, player.y - 30, 'BAĞ KOPTU', '#e74c3c'); link = null; }
        } else {
          link.strain = Math.max(0, link.strain - ts * 2);
          if (link.strain === 0) link.warned = false;
        }
      } else {
        burst(link, enemies);
        link = null;
      }
    }
    lastHp = player.hp;
  }

  // ---------- Çizim ----------
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

    if (link && player.charType === ID && !player.isDead) {
      const t = link.target;
      const strained = getDist(player, t) > LINK_RANGE;
      c.save();
      c.strokeStyle = strained ? 'rgba(231,76,60,0.85)' : 'rgba(72,224,200,0.85)';
      c.lineWidth = 3 + Math.min(4, link.stored / 500);
      c.setLineDash([8, 6]);
      c.lineDashOffset = -Date.now() / 40;
      c.beginPath(); c.moveTo(player.x, player.y); c.lineTo(t.x, t.y); c.stroke();
      c.setLineDash([]);
      c.beginPath(); c.arc(t.x, t.y, t.radius + 8 + Math.sin(Date.now() / 150) * 3, 0, Math.PI * 2); c.stroke();
      // Patlama yarıçapı önizlemesi: düşmanları bu çemberin içine toplamak taktik avantaj
      c.globalAlpha = 0.28;
      c.beginPath(); c.arc(t.x, t.y, BURST_RADIUS, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
      // Biriken hasar çubuğu
      c.fillStyle = '#333'; c.fillRect(t.x - 20, t.y + t.radius + 12, 40, 4);
      c.fillStyle = LINK_COLOR; c.fillRect(t.x - 20, t.y + t.radius + 12, 40 * (link.stored / STORE_CAP), 4);
      c.restore();
    }
  }

  // Ana oyunun çizdiği 300 birimlik "mermi" nişan dikdörtgenini bu karakterde gizleyip
  // gerçek yay menzilini çizer.
  function drawAim() {
    if (!aimData.active || player.isDead || player.ammo < 1) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(aimData.angle);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, SLASH_RANGE + LUNGE, -SLASH_HALF, SLASH_HALF); ctx.closePath();
    ctx.fillStyle = 'rgba(72,224,200,0.16)'; ctx.fill();
    ctx.strokeStyle = 'rgba(72,224,200,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  // ---------- Player yöntemlerini sar ----------
  const proto = Object.getPrototypeOf(player);
  const origFire = proto.fire;
  const origSetCharacter = proto.setCharacter;

  proto.fire = function (a, pull) {
    if (this.charType !== ID) return origFire.call(this, a, pull);
    if (this.isDead || this.ammo < 1) return;
    slash(this, a);
  };
  proto.setCharacter = function (type) {
    origSetCharacter.call(this, type);
    this.reloadSpeed = type === ID ? 0.024 : 0.015; // yakın dövüş: daha hızlı şarj
  };

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

  // ---------- Karakter seçim kartı ----------
  const container = document.querySelector('.char-select-container');
  if (container && !document.getElementById('char-' + ID)) {
    const card = document.createElement('div');
    card.className = 'char-card';
    card.id = 'char-' + ID;
    card.innerHTML = '<div class="char-color-preview" style="background:' + COLOR + ';"></div><span>Wilcher</span><small>Hasar: 650 (yakın yay)<br>Güç: Kader Bağı</small>';
    card.addEventListener('click', () => {
      selectedCharacter = ID;
      document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
      card.classList.add('selected');
    });
    container.appendChild(card);
  }

  chain('onBotSpawnTick', tick);
  chain('onDraw', drawEffects);
  chain('onReset', function () { link = null; lastHp = null; slashes.length = 0; });
})();
