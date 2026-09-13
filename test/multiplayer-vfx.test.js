import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMultiplayerVfx } from '../src/multiplayer-vfx.js';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const practiceSource = readFileSync(new URL('../src/practice.js', import.meta.url), 'utf8');

function fakeRoot() {
  const classes = new Set();
  return {
    classes,
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      toggle: (name, force) => force ? classes.add(name) : classes.delete(name),
      contains: name => classes.has(name),
    },
  };
}

function fakeClock() {
  let nextId = 0;
  const tasks = new Map();
  const callbacks = [];
  return {
    setTimeout(callback, delay) {
      const id = ++nextId;
      tasks.set(id, { callback, delay });
      callbacks.push(callback);
      return id;
    },
    callbacks,
    clearTimeout(id) { tasks.delete(id); },
    runAll() {
      for (const [id, task] of [...tasks]) {
        tasks.delete(id);
        task.callback();
      }
    },
    pending() { return tasks.size; },
  };
}

test('a fireball cast survives input reset and impacts once on its score acknowledgement', () => {
  const root = fakeRoot();
  const clock = fakeClock();
  const vfx = createMultiplayerVfx(root, { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  vfx.cast('fireball');
  assert.equal(root.classList.contains('fireball-cast'), true);
  assert.equal(vfx.impact(), true);
  assert.equal(vfx.impact(), false);
  assert.equal(root.classList.contains('fireball-impact'), true);
  assert.ok(clock.pending() > 0);
});

test('a new cast cannot be cleared by a stale timer from the previous cast', () => {
  const root = fakeRoot();
  const clock = fakeClock();
  const vfx = createMultiplayerVfx(root, { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  vfx.cast('fireball');
  const staleTimer = clock.callbacks[0];
  vfx.cast('fireball');
  staleTimer();
  assert.equal(root.classList.contains('fireball-cast'), true);
  clock.runAll();
  assert.equal(root.classList.contains('fireball-cast'), false);
  assert.equal(vfx.impact(), true);
});

test('cancel clears pending visuals and reduced motion skips flicker and motion classes', () => {
  const root = fakeRoot();
  const clock = fakeClock();
  const vfx = createMultiplayerVfx(root, {
    reducedMotion: true,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  });

  vfx.prepare(true, 0.5);
  assert.equal(root.classList.contains('fireball-ready'), true);
  vfx.cast('fireball');
  assert.equal(root.classList.contains('fireball-reduced'), true);
  assert.equal(root.classList.contains('fireball-flicker'), false);
  assert.equal(root.classList.contains('fireball-rising'), false);
  vfx.cancel();
  assert.equal(root.classes.size, 0);
  assert.equal(vfx.impact(), false);
});

test('non-fire jutsus do not activate the fireball presentation', () => {
  const root = fakeRoot();
  const vfx = createMultiplayerVfx(root);

  assert.equal(vfx.cast('chidori'), false);
  vfx.prepare(false, 0.9);
  assert.equal(root.classes.size, 0);
  assert.equal(vfx.impact(), false);
});

test('simultaneous target effects remain independent', () => {
  const clock = fakeClock();
  const you = fakeRoot(), opponent = fakeRoot();
  const options = { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout };
  const incoming = createMultiplayerVfx(you, options);
  const outgoing = createMultiplayerVfx(opponent, options);
  incoming.cast('fireball');
  assert.equal(opponent.classes.size, 0);
  outgoing.cast('fireball');
  incoming.cancel();
  assert.equal(you.classes.size, 0);
  assert.equal(opponent.classList.contains('fireball-cast'), true);
  outgoing.cancel();
});
