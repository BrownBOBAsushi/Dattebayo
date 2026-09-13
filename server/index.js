const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function database(env) {
  if (!env.DB) throw new Error('Leaderboard database is unavailable');
  return env.DB;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      const db = database(env);
      if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
        const page = Math.min(999, Math.max(0, Number(url.searchParams.get('page')) || 0)) | 0;
        const { results } = await db.prepare('SELECT name, survived_ms, jutsus FROM survival_runs WHERE completed_at IS NOT NULL ORDER BY survived_ms DESC, jutsus DESC, completed_at ASC, id ASC LIMIT 6 OFFSET ?').bind(page * 5).all();
        return json({ scores: results.slice(0, 5), hasMore: results.length > 5, page });
      }
      if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
      if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({ error: 'Invalid origin' }, 403);
      if (url.pathname === '/api/runs') {
        const id = crypto.randomUUID();
        await db.prepare('INSERT INTO survival_runs (id, started_at) VALUES (?, ?)').bind(id, Date.now()).run();
        return json({ id }, 201);
      }
      if (url.pathname === '/api/scores') {
        const raw = await request.text();
        if (raw.length > 1024) return json({ error: 'Submission too large' }, 400);
        let body;
        try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid submission' }, 400); }
        const name = typeof body.name === 'string' ? body.name.trim().normalize('NFC') : '';
        if (!name || [...name].length > 24 || /[\p{Cc}\p{Cf}<>]/u.test(name)) return json({ error: 'Use a name with 1–24 letters, numbers or symbols.' }, 400);
        if (typeof body.id !== 'string' || body.id.length !== 36 || !Number.isInteger(body.signs) || body.signs < 0 || body.signs > 43200 || !Number.isInteger(body.jutsus) || body.jutsus !== Math.floor(body.signs / 3)) return json({ error: 'Invalid run results' }, 400);
        const run = await db.prepare('SELECT started_at, completed_at FROM survival_runs WHERE id = ?').bind(body.id).first();
        if (!run) return json({ error: 'Run not found. Please start a new run.' }, 404);
        if (run.completed_at !== null) return json({ saved: true });
        const survived = 30000 + body.jutsus * 2000;
        const elapsed = Date.now() - run.started_at;
        if (elapsed + 1500 < survived || elapsed > 172800000) return json({ error: 'Run timing could not be verified. Please start a new run.' }, 400);
        await db.prepare('UPDATE survival_runs SET name = ?, survived_ms = ?, jutsus = ?, signs = ?, completed_at = ? WHERE id = ? AND completed_at IS NULL').bind(name, survived, body.jutsus, body.signs, Date.now(), body.id).run();
        return json({ saved: true });
      }
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('Leaderboard request failed', error);
      return json({ error: 'Leaderboard unavailable. Please try again.' }, 503);
    }
  },
};
