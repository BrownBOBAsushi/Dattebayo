import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import worker from '../server/index.js';
function setup() {
  const sql = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) sql.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'));
  const env = { DB: { prepare(query) {
    const statement = sql.prepare(query); let args = [];
    return { bind(...values) { args = values; return this; }, async first() { return statement.get(...args) || null; }, async all() { return { results: statement.all(...args) }; }, async run() { return statement.run(...args); } };
  } }, ASSETS: { fetch: () => new Response('asset') } };
  const call = (path, body) => worker.fetch(new Request(`https://game.test${path}`, body === undefined ? {} : { method: 'POST', headers: { Origin: 'https://game.test' }, body: JSON.stringify(body) }), env);
  return { sql, call };
}
test('shared results persist, sort and save idempotently; timing and names are validated', async () => {
  const { sql, call } = setup();
  const { id } = await (await call('/api/runs', {})).json();
  const score = { id, name: 'Kakashi', signs: 3, jutsus: 1 };
  assert.equal((await call('/api/scores', score)).status, 400);
  sql.prepare('UPDATE survival_runs SET started_at = ? WHERE id = ?').run(Date.now() - 36000, id);
  assert.equal((await call('/api/scores', { ...score, name: '<script>' })).status, 400);
  assert.equal((await call('/api/scores', { ...score, jutsus: 2 })).status, 400);
  assert.equal((await call('/api/scores', score)).status, 200);
  assert.equal((await call('/api/scores', { ...score, name: 'Changed' })).status, 200);
  const board = await (await call('/api/leaderboard')).json();
  assert.deepEqual(board.scores, [{ name: 'Kakashi', survived_ms: 36000, jutsus: 1 }]);
  assert.equal((await call('/')).status, 200);
  sql.close();
});
test('leaderboard pages are bounded and ranking is descending', async () => {
  const { sql, call } = setup();
  for (let i=0;i<7;i++) sql.prepare('INSERT INTO survival_runs VALUES (?, ?, ?, ?, ?, ?, ?)').run(String(i),0,'Ninja '+i,30000+i*2000,Math.floor(i/3),i,100);
  const first = await (await call('/api/leaderboard')).json();
  assert.equal(first.scores.length,5); assert.equal(first.scores[0].name,'Ninja 6'); assert.equal(first.hasMore,true);
  const second = await (await call('/api/leaderboard?page=1')).json();
  assert.equal(second.scores.length,2); assert.equal(second.hasMore,false);
  sql.close();
});
