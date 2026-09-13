// The Single Player arena is intentionally procedural greybox art. These
// primitives are adapted from the pinned upstream prototype and kept small so
// the existing dependency-free browser app can own the render loop.
export function renderBattleHp(element, hp) {
  if (!element) return;
  element.replaceChildren(...[0, 1, 2].map(index => {
    const segment = document.createElement('i');
    segment.className = index >= hp ? 'lost' : '';
    segment.setAttribute('aria-hidden', 'true');
    return segment;
  }));
  element.setAttribute('aria-label', `${hp} of 3 health remaining`);
}

export function createBattlePresentation(canvas) {
  const ctx = canvas.getContext('2d');
  let frameHandle;
  let effect = null;

  function drawBackground(w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#202b4c'); sky.addColorStop(.58, '#56637d');
    sky.addColorStop(.59, '#263e55'); sky.addColorStop(1, '#142335');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = .25; ctx.fillStyle = '#b8c0bd'; ctx.fillRect(0, 120, w, 92); ctx.fillStyle = '#68738a';
    ctx.save(); ctx.globalAlpha = .12; ctx.fillStyle = '#d4d8d4'; ctx.beginPath();
    ctx.moveTo(-40, 210); ctx.lineTo(110, 126); ctx.lineTo(240, 210); ctx.lineTo(360, 116); ctx.lineTo(520, 210); ctx.lineTo(660, 126); ctx.lineTo(840, 210); ctx.lineTo(1010, 130); ctx.lineTo(1010, 235); ctx.lineTo(-40, 235); ctx.fill(); ctx.restore();
    ctx.globalAlpha = 1;
    for (const [left, peak, right] of [[90, 170, 250], [300, 382, 454], [510, 590, 666], [720, 810, 900]]) {
      ctx.beginPath(); ctx.moveTo(left, 212); ctx.lineTo(peak, 66); ctx.lineTo(right, 212); ctx.fill();
    }
    ctx.globalAlpha = .4; ctx.fillStyle = '#d5e0db'; ctx.fillRect(470, 28, 28, 190); ctx.fillRect(498, 52, 10, 167);
    ctx.globalAlpha = 1;
    const water = ctx.createLinearGradient(0, 235, 0, h); water.addColorStop(0, '#254c61'); water.addColorStop(1, '#0d2136');
    ctx.fillStyle = water; ctx.fillRect(0, 235, w, h - 235);
    ctx.strokeStyle = '#6fa0a1'; ctx.globalAlpha = .42;
    for (let y = 262; y < h; y += 36) for (let x = -30; x < w + 30; x += 110) {
      ctx.beginPath(); ctx.ellipse(x, y, 34, 4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawFighter(x, y, body, light, accent, name, facingRight) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#09142188'; ctx.beginPath(); ctx.ellipse(0, 212, 88, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = body; ctx.fillRect(-32, 105, 64, 105); ctx.fillStyle = light; ctx.fillRect(-25, 88, 50, 60);
    ctx.fillStyle = '#f0c09f'; ctx.fillRect(-21, 52, 42, 42); ctx.fillStyle = accent; ctx.fillRect(-28, 43, 56, 14); ctx.fillRect(-36, 60, 13, 10);
    ctx.fillStyle = body; ctx.fillRect(-53, 120, 20, 84); ctx.fillRect(33, 120, 20, 84); ctx.fillStyle = accent; ctx.fillRect(-44, 199, 31, 12); ctx.fillRect(14, 199, 31, 12);
    ctx.fillStyle = '#141825'; ctx.fillRect(facingRight ? 8 : -13, 66, 5, 5); ctx.fillStyle = '#ffe09d'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText(name, 0, -4); ctx.restore();
  }

  function drawReflection(x, baseline, body, accent) {
    ctx.save(); ctx.translate(x, baseline); ctx.scale(1, -.34); ctx.globalAlpha = .12; ctx.fillStyle = body; ctx.fillRect(-32, -210, 64, 105); ctx.fillStyle = accent; ctx.fillRect(-28, -212, 56, 14); ctx.fillRect(-25, -94, 50, 42); ctx.restore();
  }

  function drawImpact(elapsed) {
    const progress = Math.max(0, Math.min(1, elapsed / 180)); if (progress <= 0) return;
    ctx.save(); ctx.globalAlpha = 1 - progress; ctx.strokeStyle = '#b9eff0'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.ellipse(480, 449, 30 + progress * 42, 5 + progress * 4, 0, 0, Math.PI * 2); ctx.stroke();
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3; const inner = 480 + Math.cos(angle) * 22; const outer = 480 + Math.cos(angle) * (38 + progress * 22);
      const iy = 449 + Math.sin(angle) * 6; const oy = 449 + Math.sin(angle) * (12 + progress * 6); ctx.beginPath(); ctx.moveTo(inner, iy); ctx.lineTo(outer, oy); ctx.stroke();
    }
    ctx.restore();
  }

  function drawOrb(x, y, color, glow, clock, animate) {
    ctx.save(); ctx.globalAlpha = .75; ctx.shadowBlur = 25; ctx.shadowColor = glow; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 28 + (animate ? Math.sin(clock / 80) * 3 : 0), 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function drawFrame(now) {
    const w = canvas.width; const h = canvas.height; const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    ctx.save(); drawBackground(w, h); drawFighter(245, 238, '#76839c', '#b8c4d3', '#8067bb', 'SASUKE', true); drawFighter(715, 238, '#d8783b', '#f2b35e', '#1b2032', 'NARUTO', false);
    drawReflection(245, 449, '#76839c', '#8067bb'); drawReflection(715, 449, '#d8783b', '#1b2032');
    ctx.fillStyle = '#fff0bc'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillText('PLAYER', 245, 93); ctx.fillText('CPU', 715, 93);
    if (effect) {
      const elapsed = now - effect.at; if (elapsed > 900) effect = null;
      else { const color = effect.element === 'fireball' ? '#f39b45' : '#80d8ff'; const glow = effect.element === 'fireball' ? '#ffd9a1' : '#d5fbff'; drawOrb(effect.side === 'player' ? 470 : 490, 265, color, glow, now, !reduced); if (!reduced) drawImpact(elapsed - 180); }
    }
    ctx.restore();
  }

  function drawArena(now) {
    drawFrame(now);
    frameHandle = requestAnimationFrame(drawArena);
  }

  return {
    start() { if (frameHandle === undefined) frameHandle = requestAnimationFrame(drawArena); },
    stop() { if (frameHandle !== undefined) cancelAnimationFrame(frameHandle); frameHandle = undefined; },
    renderStill(now = performance.now()) { drawFrame(now); },
    showEffect(element = 'lightning', side = 'player', at = performance.now()) { effect = { element, side, at }; },
    clear() { effect = null; },
  };
}
