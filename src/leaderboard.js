import { randomNinjaName } from './ninja-name.js';
const $ = id => document.getElementById(id);
let pendingRun = null;
let page = 0;
let loadRevision = 0;
async function api(path, body) {
  const response = await fetch(path, { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Please try again.');
  return data;
}
export async function startRankedRun() {
  try { return (await api('/api/runs', {})).id; } catch { return null; }
}
export function showRunResult(run, timedOut) {
  $('player-name').value ||= randomNinjaName();
  pendingRun = timedOut && run.rankedId ? { id: run.rankedId, signs: run.signs, jutsus: run.jutsus } : null;
  $('score-form').hidden = !pendingRun;
  $('score-save').disabled = false;
  $('score-status').textContent = !timedOut ? 'Finish the countdown to record a high score.' : !run.rankedId ? 'The leaderboard was unavailable when this run started. Try again for a ranked run.' : 'Your name and score will be visible to everyone.';
}
$('score-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!pendingRun) return;
  const run = pendingRun;
  $('score-save').disabled = true;
  $('score-status').textContent = 'Saving your score…';
  try {
    await api('/api/scores', { ...run, name: $('player-name').value });
    if (pendingRun !== run) return;
    pendingRun = null;
    $('score-form').hidden = true;
    $('score-status').textContent = 'Score saved to the shared leaderboard!';
  } catch (error) {
    if (pendingRun === run) $('score-status').textContent = error.message === 'Failed to fetch' ? 'Could not save. Check your connection and try again.' : error.message;
  } finally { if (pendingRun === run) $('score-save').disabled = false; }
});
async function loadBoard() {
  const revision = ++loadRevision;
  $('leaderboard-status').textContent = 'Loading scores…';
  $('leaderboard-rows').replaceChildren();
  $('board-prev').disabled = $('board-next').disabled = true;
  $('board-page').textContent = `Page ${page + 1}`;
  try {
    const data = await api(`/api/leaderboard?page=${page}`);
    if (revision !== loadRevision) return;
    $('leaderboard-status').textContent = data.scores.length ? '' : 'No scores yet. Be the first ninja on the board.';
    data.scores.forEach((score, i) => {
      const tr = document.createElement('tr');
      const seconds = Math.floor(score.survived_ms / 1000);
      for (const value of [page * 5 + i + 1, score.name, `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, score.jutsus]) {
        const td = document.createElement('td'); td.textContent = value; tr.append(td);
      }
      $('leaderboard-rows').append(tr);
    });
    $('board-prev').disabled = page === 0;
    $('board-next').disabled = !data.hasMore;
  } catch { if (revision === loadRevision) $('leaderboard-status').textContent = 'Scores unavailable. Tap Refresh to try again.'; }
}
document.querySelectorAll('[data-leaderboard]').forEach(button => button.addEventListener('click', () => { page = 0; $('leaderboard-dialog').showModal(); loadBoard(); }));
$('board-prev').addEventListener('click', () => { page = Math.max(0, page - 1); loadBoard(); });
$('board-next').addEventListener('click', () => { page++; loadBoard(); });
$('board-refresh').addEventListener('click', loadBoard);
$('invite-open').addEventListener('click', () => $('invite-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
