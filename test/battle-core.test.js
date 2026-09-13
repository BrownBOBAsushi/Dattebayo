import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HP,
  JUTSU_DEADLINE_MS,
  createBattle,
  cameraReady,
  confirmSign,
  resolveTimeout,
  pauseBattle,
  replayBattle,
  remainingTime,
} from '../src/battle-core.js';

const ids = ['fireball', 'chidori', 'wind'];
const ready = (now = 1000) => cameraReady(createBattle({ jutsuIds: ids, random: () => 0 }), now, () => 0);

function completeJutsu(state, now = 1000) {
  let next = state;
  for (let index = 0; index < 3; index += 1) {
    next = confirmSign(next, { generation: next.generation, now });
  }
  return next;
}

test('three confirmed signs deal exactly one CPU HP and start a fresh jutsu deadline', () => {
  const state = ready();
  const next = completeJutsu(state, 1500);
  assert.equal(state.cpuHp, MAX_HP);
  assert.equal(next.cpuHp, MAX_HP - 1);
  assert.equal(next.playerHp, MAX_HP);
  assert.equal(next.phase, 'active');
  assert.equal(next.acceptedSigns, 0);
  assert.equal(next.deadlineAt, 1500 + JUTSU_DEADLINE_MS);
  assert.notEqual(next.generation, state.generation);
});

test('deadline is an exclusive success boundary and expiry deals one player HP', () => {
  const state = ready();
  assert.equal(remainingTime(state, state.deadlineAt), 0);
  const atBoundary = confirmSign(state, { generation: state.generation, now: state.deadlineAt });
  assert.equal(atBoundary.playerHp, MAX_HP - 1);
  assert.equal(atBoundary.cpuHp, MAX_HP);
  assert.equal(atBoundary.acceptedSigns, 0);
  assert.equal(resolveTimeout(state, { generation: state.generation, now: state.deadlineAt }).playerHp, MAX_HP - 1);
});

test('duplicate and stale round events cannot deal extra damage', () => {
  const state = ready();
  const completed = completeJutsu(state, 1200);
  assert.equal(completed.cpuHp, 2);
  assert.equal(confirmSign(completed, { generation: state.generation, now: 1300 }).cpuHp, 2);
  assert.equal(resolveTimeout(completed, { generation: state.generation, now: 15000 }).cpuHp, 2);
  assert.equal(resolveTimeout(completed, { generation: completed.generation, now: 3000 }).cpuHp, 2);
});

test('terminal battle ignores later signs and timeout events', () => {
  let state = ready();
  for (let hit = 0; hit < 3; hit += 1) state = completeJutsu(state, 1000 + hit * 200);
  assert.equal(state.cpuHp, 0);
  assert.equal(state.phase, 'victory');
  assert.equal(confirmSign(state, { generation: state.generation, now: 99999 }), state);
  assert.equal(resolveTimeout(state, { generation: state.generation, now: 99999 }), state);
});

test('replay restores both fighters and advances generation', () => {
  let state = ready();
  state = completeJutsu(state, 1500);
  state = replayBattle(state);
  assert.equal(state.phase, 'waiting');
  assert.equal(state.playerHp, MAX_HP);
  assert.equal(state.cpuHp, MAX_HP);
  assert.equal(state.acceptedSigns, 0);
  assert.ok(state.generation > 1);
});

test('camera interruption pauses clock and partial signs, retry resumes with remaining time', () => {
  const state = ready(1000);
  const partial = confirmSign(state, { generation: state.generation, now: 2000 });
  const paused = pauseBattle(partial, { generation: partial.generation, now: 4000 });
  assert.equal(paused.phase, 'paused');
  assert.equal(paused.playerHp, MAX_HP);
  assert.equal(paused.acceptedSigns, 0);
  assert.equal(remainingTime(paused, 9000), paused.remainingMs);
  const resumed = cameraReady(paused, 9000);
  assert.equal(resumed.phase, 'active');
  assert.equal(resumed.deadlineAt, 9000 + paused.remainingMs);
  assert.notEqual(resumed.generation, paused.generation);
});
