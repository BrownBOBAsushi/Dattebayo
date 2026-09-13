const CAST_MS = 1450;
const IMPACT_MS = 640;
const FADE_MS = 280;
const FIREBALL_CLASSES = [
  'fireball-ready',
  'fireball-cast',
  'fireball-impact',
  'fireball-fade',
  'fireball-flicker',
  'fireball-rising',
  'fireball-reduced',
];

const isFireball = element => element === 'fireball';

/**
 * Owns multiplayer Fireball visuals separately from practice input state.
 * The injected clock keeps the timing behavior deterministic in unit tests.
 */
export function createMultiplayerVfx(root, {
  reducedMotion = false,
  setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: cancelTimer = globalThis.clearTimeout,
} = {}) {
  if (!root?.classList) throw new TypeError('A class-list root is required.');
  let generation = 0;
  let pendingFireball = false;
  const timers = new Set();

  const prefersReducedMotion = () => typeof reducedMotion === 'function' ? reducedMotion() : reducedMotion;
  const removeClasses = (...names) => root.classList.remove(...names);
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
    pendingFireball = false;
    clearTimers();
    removeClasses(...FIREBALL_CLASSES);
    root.style?.removeProperty?.('--fireball-progress');
  };

  function prepare(active, progress = 0) {
    if (!isFireball(active) && active !== true) {
      removeClasses('fireball-ready', 'fireball-rising');
      return;
    }
    const visible = Number(progress) > 0 && !pendingFireball;
    root.classList.toggle('fireball-ready', visible);
    root.classList.toggle('fireball-rising', visible && !prefersReducedMotion());
    root.style?.setProperty?.('--fireball-progress', String(Math.max(0, Math.min(1, Number(progress) || 0))));
  }

  function finishFade(current) {
    if (current !== generation) return;
    removeClasses('fireball-fade');
  }

  function finishCast(current) {
    if (current !== generation) return;
    removeClasses('fireball-cast', 'fireball-flicker', 'fireball-rising', 'fireball-reduced');
    root.classList.add('fireball-fade');
    later(() => finishFade(current), FADE_MS);
  }

  function finishImpact(current) {
    if (current !== generation) return;
    removeClasses('fireball-impact');
  }

  function cast(element) {
    clearVisuals();
    if (!isFireball(element)) return false;
    const current = generation;
    pendingFireball = true;
    root.classList.add('fireball-cast');
    if (prefersReducedMotion()) root.classList.add('fireball-reduced');
    else root.classList.add('fireball-flicker');
    later(() => finishCast(current), prefersReducedMotion() ? IMPACT_MS : CAST_MS);
    return true;
  }

  function impact() {
    if (!pendingFireball) return false;
    pendingFireball = false;
    const current = generation;
    removeClasses('fireball-ready', 'fireball-rising', 'fireball-fade');
    root.classList.add('fireball-impact');
    later(() => finishImpact(current), IMPACT_MS);
    return true;
  }

  return {
    prepare,
    cast,
    impact,
    cancel: clearVisuals,
    isPending: () => pendingFireball,
  };
}
