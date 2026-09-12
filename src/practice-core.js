import { advanceHold } from './probe-core.js';

// Short practice combinations, not the full canonical seal sequences.
export const JUTSU = {
  chidori: { name: 'Chidori', signs: ['ox', 'hare', 'monkey'], voice: './assets/audio/sasuke-chidori.mp3', speaker: 'Sasuke', element: 'lightning' },
  fireball: { name: 'Katon: Gōkakyū no Jutsu', signs: ['serpent', 'ram', 'tiger'], voice: './assets/audio/sasuke-fireball.mp3', speaker: 'Sasuke', element: 'fireball' },
  earthwall: { name: 'Doton: Doryūheki', signs: ['tiger', 'hare', 'dog'], voice: './assets/audio/kakashi-doryuheki.wav', speaker: 'Kakashi', element: 'earth' },
  waterdragon: { name: 'Suiton: Suiryūdan no Jutsu', signs: ['ox', 'monkey', 'bird'], voice: null, speaker: 'Kisame callout pending', element: 'water' },
  shadowclone: { name: 'Kage Bunshin no Jutsu', signs: ['ram', 'serpent', 'tiger'], voice: './assets/audio/naruto-shadow-clone.mp3', speaker: 'Naruto', element: 'clone' },
};
export const newPractice = () => ({ index: 0, completed: false, hold: {}, lastAt: null });
export function detectSign(state, { label, score, now }, signs) {
  if (state.completed) return state;
  // A stalled camera/inference stream cannot count as a continuous hold.
  const previous = state.lastAt !== null && now - state.lastAt > 500 ? {} : state.hold;
  const hold = advanceHold(previous, { label, score, now, target: signs[state.index], durationMs: 450 });
  if (!hold.completed) return { ...state, hold, lastAt: now };
  const index = state.index + 1;
  return { index, completed: index === signs.length, hold: {}, lastAt: now };
}
