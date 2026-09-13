export const MAX_HP = 3;
export const JUTSU_DEADLINE_MS = 10000;

import { randomJutsu } from './survival-core.js';

const TERMINAL = new Set(['victory', 'defeat']);

export function createBattle({ jutsuIds = [], random = Math.random } = {}) {
  return {
    phase: 'waiting',
    outcome: null,
    generation: 0,
    playerHp: MAX_HP,
    cpuHp: MAX_HP,
    jutsuId: null,
    acceptedSigns: 0,
    deadlineAt: null,
    remainingMs: null,
    jutsuIds: [...jutsuIds],
    randomFn: random,
  };
}

function sameGeneration(state, generation) {
  return generation === state.generation;
}

function active(state) {
  return state.phase === 'active';
}

export function remainingTime(state, now) {
  if (state.phase === 'active' && state.deadlineAt !== null) return Math.max(0, state.deadlineAt - now);
  if (state.phase === 'paused') return Math.max(0, state.remainingMs ?? 0);
  return 0;
}

export function cameraReady(state, now, random = state.randomFn) {
  if (state.phase === 'active' || TERMINAL.has(state.phase)) return state;
  if (state.phase !== 'waiting' && state.phase !== 'paused') return state;
  const resumed = state.phase === 'paused';
  const jutsuId = state.jutsuId ?? randomJutsu(state.jutsuIds, null, random);
  const duration = resumed ? Math.max(0, state.remainingMs ?? 0) : JUTSU_DEADLINE_MS;
  return {
    ...state,
    phase: 'active',
    outcome: null,
    generation: state.generation + 1,
    jutsuId,
    acceptedSigns: 0,
    deadlineAt: now + duration,
    remainingMs: null,
  };
}

export function applyDamage(state, target) {
  if (TERMINAL.has(state.phase)) return state;
  if (target === 'player') return { ...state, playerHp: Math.max(0, state.playerHp - 1) };
  if (target === 'cpu') return { ...state, cpuHp: Math.max(0, state.cpuHp - 1) };
  return state;
}

function nextRound(state, now, target) {
  const damaged = applyDamage(state, target);
  const loser = target === 'cpu' ? damaged.cpuHp === 0 : damaged.playerHp === 0;
  const outcome = target === 'cpu' ? 'victory' : 'defeat';
  if (loser) {
    return {
      ...damaged,
      phase: outcome,
      outcome,
      generation: state.generation + 1,
      acceptedSigns: 0,
      deadlineAt: null,
      remainingMs: null,
    };
  }
  return {
    ...damaged,
    phase: 'active',
    outcome: null,
    generation: state.generation + 1,
    jutsuId: randomJutsu(state.jutsuIds, state.jutsuId, state.randomFn),
    acceptedSigns: 0,
    deadlineAt: now + JUTSU_DEADLINE_MS,
    remainingMs: null,
  };
}

export function resolveTimeout(state, { generation, now }) {
  if (!active(state) || !sameGeneration(state, generation) || state.deadlineAt === null || now < state.deadlineAt) return state;
  return nextRound(state, now, 'player');
}

export function confirmSign(state, { generation, now }) {
  if (!active(state) || !sameGeneration(state, generation)) return state;
  if (state.deadlineAt === null || now >= state.deadlineAt) return resolveTimeout(state, { generation, now });
  if (state.acceptedSigns >= 3) return state;
  if (state.acceptedSigns < 2) return { ...state, acceptedSigns: state.acceptedSigns + 1 };
  return nextRound(state, now, 'cpu');
}

export function pauseBattle(state, { generation, now }) {
  if (!active(state) || !sameGeneration(state, generation)) return state;
  return {
    ...state,
    phase: 'paused',
    acceptedSigns: 0,
    deadlineAt: null,
    remainingMs: remainingTime(state, now),
  };
}

export function replayBattle(state) {
  return {
    ...createBattle({ jutsuIds: state.jutsuIds, random: state.randomFn }),
    generation: state.generation + 1,
  };
}
