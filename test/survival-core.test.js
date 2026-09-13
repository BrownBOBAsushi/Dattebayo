import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurvival, remainingTime, rewardWeave, randomJutsu } from '../src/survival-core.js';
test('countdown uses elapsed time and each accepted sign earns exactly two seconds', () => {
  const run = createSurvival(1000);
  assert.equal(remainingTime(run, 1000), 30000);
  assert.equal(remainingTime(run, 6000), 25000);
  for (let i = 0; i < 3; i++) assert.equal(rewardWeave(run, 6000), true);
  assert.equal(remainingTime(run, 6000), 31000);
  assert.equal(run.signs, 3);
});
test('expired or ended runs cannot be revived by late inference', () => {
  const run = createSurvival(0);
  assert.equal(rewardWeave(run, 30000), false);
  assert.equal(remainingTime(run, 40000), 0);
  run.ended = true;
  assert.equal(rewardWeave(run, 1), false);
  assert.equal(run.signs, 0);
});
test('random next jutsu excludes current choice and can choose every other entry', () => {
  const ids = ['a','b','c'];
  assert.equal(randomJutsu(ids, 'a', () => 0), 'b');
  assert.equal(randomJutsu(ids, 'a', () => .99), 'c');
  assert.equal(randomJutsu(['a'], 'a'), 'a');
});
