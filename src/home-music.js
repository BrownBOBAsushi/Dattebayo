// Use the supplied YouTube track in its visible official player.
const home = document.getElementById('home');
const panel = document.getElementById('music-panel');
const button = document.getElementById('music-toggle');
let wanted = false;
export function stopMusic() {
  wanted = false;
  panel.replaceChildren(); panel.hidden = true;
  home.classList.remove('with-music');
  button.textContent = '♫ Homepage music';
  button.setAttribute('aria-expanded', 'false');
}
button.addEventListener('click', () => {
  if (wanted) { stopMusic(); return; }
  wanted = true;
  const frame = document.createElement('iframe');
  frame.src = 'https://www.youtube.com/embed/qAGvQDoL5s4?autoplay=1&loop=1&playlist=qAGvQDoL5s4&playsinline=1';
  frame.title = 'Naruto — Afternoon of Konoha';
  frame.allow = 'autoplay; encrypted-media; picture-in-picture';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  const link = document.createElement('a');
  link.href = 'https://www.youtube.com/watch?v=qAGvQDoL5s4';
  link.target = '_blank'; link.rel = 'noopener';
  link.textContent = 'Afternoon of Konoha · Open on YouTube ↗';
  panel.replaceChildren(frame, link); panel.hidden = false;
  home.classList.add('with-music');
  button.textContent = '♫ Stop music'; button.setAttribute('aria-expanded', 'true');
});
window.addEventListener('hashchange', () => { if (location.hash === '#practice') stopMusic(); });
window.addEventListener('pagehide', stopMusic);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); });
