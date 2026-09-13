export const START_MS = 30000;
export const JUTSU_BONUS_MS = 2000;
export const createSurvival = now => ({ deadline: now + START_MS, signs: 0, jutsus: 0, ended: false });
export const remainingTime = (run, now) => Math.max(0, run.deadline - now);
export function recordSurvivalSign(run, now) {
  if (run.ended || remainingTime(run, now) === 0) return false;
  run.signs++;
  if (run.signs % 3 === 0) {
    run.jutsus++;
    run.deadline += JUTSU_BONUS_MS;
  }
  return true;
}
export function randomJutsu(ids, previous, random = Math.random) {
  const candidates = ids.filter(id => id !== previous);
  const pool = candidates.length ? candidates : ids;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
