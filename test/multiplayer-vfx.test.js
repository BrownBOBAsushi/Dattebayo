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
  let now = 0;
  const tasks = new Map();
  const callbacks = [];
  return {
    setTimeout(callback, delay) {
      const id = ++nextId;
      tasks.set(id, { callback, at: now + delay });
      callbacks.push(callback);
      return id;
    },
    callbacks,
    clearTimeout(id) { tasks.delete(id); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        const [id, task] = next;
        tasks.delete(id);
        now = task.at;
        task.callback();
      }
      now = end;
    },
    runAll() {
      while (tasks.size) this.advance(Math.max(0, Math.min(...[...tasks.values()].map(task => task.at)) - now));
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

test('a lightning cast impacts once and keeps its cast visuals until the cast timer finishes', () => {
  const root = fakeRoot();
  const clock = fakeClock();
  const vfx = createMultiplayerVfx(root, { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  vfx.cast('lightning');
  assert.equal(root.classList.contains('lightning-cast'), true);
  assert.equal(root.classList.contains('lightning-flicker'), true);
  assert.equal(vfx.impact(), true);
  assert.equal(vfx.impact(), false);
  assert.equal(root.classList.contains('lightning-cast'), true);
  assert.equal(root.classList.contains('lightning-impact'), true);
  clock.runAll();
  assert.equal(root.classList.contains('lightning-cast'), false);
});

test('fireball and lightning stale timers cannot clear the next effect', () => {
  const root = fakeRoot();
  const clock = fakeClock();
  const vfx = createMultiplayerVfx(root, { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  vfx.cast('fireball');
  const staleFireballTimer = clock.callbacks[0];
  vfx.cast('lightning');
  staleFireballTimer();
  assert.equal(root.classList.contains('lightning-cast'), true);
  assert.equal(root.classList.contains('fireball-cast'), false);

  const staleLightningTimer = clock.callbacks.at(-1);
  vfx.cast('fireball');
  staleLightningTimer();
  assert.equal(root.classList.contains('fireball-cast'), true);
  assert.equal(root.classList.contains('lightning-cast'), false);
});

test('prepare does not mutate a visible cast and unsupported water stays inert', () => {
  const root = fakeRoot();
  const clock = fakeClock();
  const vfx = createMultiplayerVfx(root, { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  vfx.cast('lightning');
  vfx.prepare('fireball', 0.9);
  assert.equal(root.classList.contains('lightning-cast'), true);
  assert.equal(root.classList.contains('fireball-ready'), false);

  vfx.cancel();
  assert.equal(vfx.cast('water'), false);
  vfx.prepare('water', 1);
  assert.equal(root.classes.size, 0);
});

test('reduced-motion lightning stays on one subdued frame through a late acknowledgement', () => {
  const root = fakeRoot();
  const clock = fakeClock();
  const vfx = createMultiplayerVfx(root, {
    reducedMotion: true,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  });

  vfx.cast('lightning');
  assert.equal(root.classList.contains('lightning-reduced'), true);
  assert.equal(root.classList.contains('lightning-flicker'), false);
  clock.runAll();
  assert.equal(root.classes.size, 0);
  assert.equal(vfx.impact(), true);
  assert.equal(root.classList.contains('lightning-reduced'), true);
  assert.equal(root.classList.contains('lightning-impact'), true);
  clock.runAll();
  assert.equal(root.classes.size, 0);
});

test('reduced-motion early acknowledgements finish both cast and impact lifetimes for fireball and lightning', () => {
  for (const element of ['fireball', 'lightning']) {
    const root = fakeRoot();
    const clock = fakeClock();
    const vfx = createMultiplayerVfx(root, {
      reducedMotion: true,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    });

    vfx.cast(element);
    clock.advance(1000);
    assert.equal(vfx.impact(), true);
    assert.equal(root.classList.contains(`${element}-impact`), true);
    clock.advance(2000);
    assert.equal(root.classes.size, 0);
    assert.equal(clock.pending(), 0);
    vfx.prepare(element, 0.5);
    assert.equal(root.classList.contains(`${element}-ready`), true);
  }
});

test('reduced-motion no-ack expiry clears visuals but preserves a late impact record', () => {
  for (const element of ['fireball', 'lightning']) {
    const root = fakeRoot();
    const clock = fakeClock();
    const vfx = createMultiplayerVfx(root, {
      reducedMotion: true,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    });

    vfx.cast(element);
    clock.advance(2500);
    assert.equal(root.classes.size, 0);
    assert.equal(clock.pending(), 0);
    vfx.prepare(element, 0.5);
    assert.equal(root.classList.contains(`${element}-ready`), true);
    assert.equal(vfx.impact(), true);
    assert.equal(root.classList.contains(`${element}-reduced`), true);
    assert.equal(root.classList.contains(`${element}-impact`), true);
    clock.advance(640);
    assert.equal(root.classes.size, 0);
    assert.equal(clock.pending(), 0);
    assert.equal(vfx.impact(), false);
  }
});

test('chronological acknowledgements around cast and fade boundaries never strand impact classes', () => {
  for (const element of ['fireball', 'lightning']) {
    for (const reducedMotion of [false, true]) {
      for (const ackAt of [1090, 1091, 1300, 1449, 1450, 1500, 1700, 1730]) {
        const root = fakeRoot();
        const clock = fakeClock();
        const vfx = createMultiplayerVfx(root, {
          reducedMotion,
          setTimeout: clock.setTimeout,
          clearTimeout: clock.clearTimeout,
        });
        vfx.cast(element);
        clock.setTimeout(() => vfx.impact(), ackAt);
        clock.advance(800);
        assert.equal(root.classList.contains(`${element}-cast`), true, `${element} cast at ${ackAt}ms`);
        clock.advance(5000);
        assert.equal(root.classes.size, 0, `${element} classes at ${ackAt}ms`);
        assert.equal(clock.pending(), 0, `${element} timers at ${ackAt}ms`);
        assert.equal(vfx.isPending(), false, `${element} pending state at ${ackAt}ms`);
      }
    }
  }
});

test('the Fireball layer is an accessible arena child and the controller owns that arena root', () => {
  assert.match(indexSource, /<div id="arena" class="arena">[\s\S]*<div id="fireball-vfx" class="fireball-vfx" aria-hidden="true">/);
  assert.ok(indexSource.indexOf('id="fireball-vfx"') < indexSource.indexOf('class="sprite-space"'));
  assert.match(indexSource, /<img class="fireball-frame fireball-frame-a" src="\.\/assets\/effects\/fireball-frame\.png" alt="">/);
  assert.match(indexSource, /<img class="fireball-frame fireball-frame-b" src="\.\/assets\/effects\/fireball-frame-02\.png" alt="">/);
  assert.match(indexSource, /<div id="lightning-vfx" class="lightning-vfx" aria-hidden="true">/);
  assert.match(indexSource, /<img class="lightning-frame lightning-frame-a" src="\.\/assets\/effects\/lightning-frame\.png" alt="">/);
  assert.match(indexSource, /<img class="lightning-frame lightning-frame-b" src="\.\/assets\/effects\/lightning-frame-02\.png" alt="">/);
  assert.match(indexSource, /rel="preload" as="image" href="\.\/assets\/effects\/lightning-frame\.png"/);
  assert.match(indexSource, /rel="preload" as="image" href="\.\/assets\/effects\/lightning-frame-02\.png"/);
  assert.match(practiceSource, /\.fireball-frame, \.lightning-frame/);
  assert.match(practiceSource, /cast\.element === 'lightning'/);
  assert.match(practiceSource, /createMultiplayerVfx\(\$\('arena'\)/);
});
