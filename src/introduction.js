const dialog = document.getElementById('intro-dialog');
const video = document.getElementById('intro-video');
let dismissed = false;
function sync() {
  const home = !location.hash || location.hash === '#home';
  if (home && !dismissed) {
    if (!dialog.open) dialog.showModal();
    video.muted = true;
    video.play().catch(() => {});
  } else { dialog.close(); video.pause(); }
}
document.getElementById('intro-go').addEventListener('click', () => { dismissed = true; sync(); });
dialog.addEventListener('cancel', () => { dismissed = true; video.pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); else sync(); });
window.addEventListener('hashchange', sync);
sync();
