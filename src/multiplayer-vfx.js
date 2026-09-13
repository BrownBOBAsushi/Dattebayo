const CAST_MS = 1450;
const IMPACT_MS = 640;
const FADE_MS = 280;

const EFFECTS = {
  fireball: {
    classes: ['fireball-ready', 'fireball-cast', 'fireball-impact', 'fireball-fade', 'fireball-flicker', 'fireball-rising', 'fireball-reduced'],
    progress: '--fireball-progress',
  },
  lightning: {
    classes: ['lightning-ready', 'lightning-cast', 'lightning-impact', 'lightning-fade', 'lightning-flicker', 'lightning-rising', 'lightning-reduced'],
    progress: '--lightning-progress',
  },
};

const effectFor = element => element === true ? EFFECTS.fireball : EFFECTS[element];
const effectName = effect => Object.keys(EFFECTS).find(name => EFFECTS[name] === effect);

/**
 * Owns multiplayer impact visuals separately from practice input state.
 * The injected clock keeps the timing behavior deterministic in unit tests.
 */
export function createMultiplayerVfx(root, {
  reducedMotion = false,
  setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: cancelTimer = globalThis.clearTimeout,
} = {}) {
  if (!root?.classList) throw new TypeError('A class-list root is required.');
  let generation = 0;
  let pendingEffect = null;
  let activeVisual = null;
  const timers = new Set();

  const prefersReducedMotion = () => typeof reducedMotion === 'function' ? reducedMotion() : reducedMotion;
  const removeClasses = (...names) => root.classList.remove(...names);
  const allClasses = Object.values(EFFECTS).flatMap(effect => effect.classes);
  const clearTimers = () => {
    for (const timer of timers) cancelTimer(timer);
    timers.clear();
  };
  const later = (callback, delay) => {
    const timer = schedule(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  };
  const clearVisuals = () => {
    generation += 1;
    pendingEffect = null;
    activeVisual = null;
    clearTimers();
    removeClasses(...allClasses);
    for (const effect of Object.values(EFFECTS)) root.style?.removeProperty?.(effect.progress);
  };

  function prepare(active, progress = 0) {
    // A newly selected jutsu can be prepared while an earlier multiplayer
    // effect is still visible. Do not interrupt that effect or its timers.
    if (activeVisual) return;
    const effect = effectFor(active);
    if (!effect) {
      removeClasses(...allClasses.filter(name => name.endsWith('-ready') || name.endsWith('-rising')));
      return;
    }
    const name = effectName(effect);
    const visible = Number(progress) > 0;
    root.classList.toggle(`${name}-ready`, visible);
    root.classList.toggle(`${name}-rising`, visible && !prefersReducedMotion());
    root.style?.setProperty?.(effect.progress, String(Math.max(0, Math.min(1, Number(progress) || 0))));
  }

  function finishFade(current, record) {
    if (current !== generation || activeVisual !== record) return;
    const { name } = record;
    removeClasses(`${name}-fade`);
    record.fadeFinished = true;
    if (record.impactFinished) {
      removeClasses(`${name}-reduced`);
      activeVisual = null;
      if (pendingEffect === record) pendingEffect = null;
      return;
    }
    if (record.impactActive) {
      // The impact owns the record until its own timer completes. Keeping the
      // active visual here prevents the later impact callback losing ownership.
      return;
    }
    // The visible cast lifetime is complete, but keep the record for a late
    // score acknowledgement. A later impact can safely revive its styling.
    removeClasses(`${name}-cast`, `${name}-flicker`, `${name}-rising`, `${name}-reduced`);
    record.expired = true;
    activeVisual = null;
  }

  function finishCast(current, record) {
    if (current !== generation || activeVisual !== record) return;
    const { name, reduced } = record;
    record.castFinished = true;
    removeClasses(`${name}-cast`, `${name}-flicker`, `${name}-rising`);
    if (!reduced) removeClasses(`${name}-reduced`);
    root.classList.add(`${name}-fade`);
    later(() => finishFade(current, record), FADE_MS);
  }

  function finishImpact(current, record) {
    if (current !== generation || activeVisual !== record) return;
    const { name, reduced } = record;
    record.impactFinished = true;
    removeClasses(`${name}-impact`);
    if (!reduced) removeClasses(`${name}-fade`);
    if (record.castFinished && record.fadeFinished) {
      removeClasses(`${name}-reduced`);
      activeVisual = null;
      if (pendingEffect === record) pendingEffect = null;
    }
  }

  function cast(element) {
    clearVisuals();
    const effect = effectFor(element);
    if (!effect || element === true && effect !== EFFECTS.fireball) return false;
    const name = effectName(effect);
    const reduced = Boolean(prefersReducedMotion());
    const current = generation;
    const record = { name, reduced, castFinished: false, impactFinished: false, fadeFinished: false, expired: false };
    activeVisual = record;
    pendingEffect = record;
    root.classList.add(`${name}-cast`);
    if (reduced) root.classList.add(`${name}-reduced`);
    else root.classList.add(`${name}-flicker`);
    later(() => finishCast(current, record), CAST_MS);
    return true;
  }

  function impact() {
    if (!pendingEffect) return false;
    const record = pendingEffect;
    const { name } = record;
    pendingEffect = null;
    record.impactActive = true;
    if (record.expired) {
      activeVisual = record;
      record.castFinished = true;
      record.fadeFinished = true;
      if (record.reduced) root.classList.add(`${name}-reduced`);
    }
    removeClasses(`${name}-ready`, `${name}-rising`, `${name}-fade`);
    root.classList.add(`${name}-impact`);
    const current = generation;
    later(() => finishImpact(current, record), IMPACT_MS);
    return true;
  }

  return {
    prepare,
    cast,
    impact,
    cancel: clearVisuals,
    isPending: () => Boolean(pendingEffect),
  };
}
