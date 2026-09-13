import { createSurvival, remainingTime, rewardWeave, randomJutsu } from './survival-core.js';
import { GameAudio } from './game-audio.js';
import './home-music.js';
import { buildTensor, classifyScores } from './probe-core.js';
import { newPractice, detectSign } from './practice-core.js';
import { cameraReady, confirmSign, createBattle, pauseBattle, replayBattle, resolveTimeout, remainingTime as battleRemaining } from './battle-core.js';
import { createBattlePresentation, renderBattleHp } from './battle-presentation.js';
const $ = id => document.getElementById(id);
const catalogResponse = await fetch('./data/jutsus.json');
if (!catalogResponse.ok) throw new Error('Could not load the jutsu catalog.');
const catalog = await catalogResponse.json();
const JUTSU = Object.fromEntries(catalog.jutsus.map(jutsu => [jutsu.id, {
  name: jutsu.name, signs: jutsu.handSigns, voice: jutsu.completionSoundtrack,
  speaker: jutsu.completionSoundtrack ? 'Completion audio ready' : 'Completion audio pending',
  type: jutsu.type, style: jutsu.style, element: jutsu.type === 'fire' ? 'fireball' : jutsu.type,
}]));
const ASSETS = 'https://raw.githubusercontent.com/bunkerapps/Jutsu-Hero/10c5a914f9f14b4427d988d253048bf0fae8eb52/public/assets/';
const FILES = { rat:'Ne.jpg', ox:'Ushi.jpg', tiger:'Tora.jpg', hare:'U.jpg', dragon:'Tatsu.jpg', serpent:'Mi.jpg', horse:'Uma.jpg', ram:'Hitsuji.jpg', monkey:'Saru.jpg', bird:'Tori.jpg', dog:'Inu.jpg', boar:'I.jpg' };
const NAMES = { sasuke:'Sasuke Uchiha', naruto:'Naruto Uzumaki' };
let character = 'sasuke';
let state = newPractice();
let running = false;
let stream = null;
let modelPromise = null;
let detector, session, ort;
let generation = 0;
let animationTimer;
let frameHandle;
let lastVideoTime = -1;
let total = 0;
let busy = false;
let cameraWanted = false;
let selectionRevision = 0;
let mode = 'practice';
let survival = null;
let clockHandle;
let battleState = createBattle({ jutsuIds: Object.keys(JUTSU) });
let battleClockHandle;
let battleCalloutTimer;
let terminalFeedbackTimer;
const presentation = createBattlePresentation($('single-arena'), () => battleState);
function chooseRandomJutsu() {
  $('jutsu').value = randomJutsu(Object.keys(JUTSU), $('jutsu').value);
  $('survival-jutsu').textContent = `${selected().style} · ${selected().name}`;
  renderSigns();
}
function paintClock() {
  if (!survival || survival.ended) return;
  const remaining = remainingTime(survival, performance.now());
  $('survival-timer').textContent = `${(remaining / 1000).toFixed(1)}s`;
  $('survival-timer').classList.toggle('urgent', remaining <= 5000);
  if (!remaining) endSurvival('Time’s up!');
}
function beginSurvival() {
  survival = createSurvival(performance.now());
  total = 0;
  $('completed-count').textContent = '0 jutsu performed';
  $('survival-result').hidden = true;
  clearInterval(clockHandle);
  clockHandle = setInterval(paintClock, 50);
  paintClock();
}
function endSurvival(reason) {
  if (!survival || survival.ended) return;
  survival.ended = true;
  clearInterval(clockHandle);
  stopCamera();
  $('survival-result-title').textContent = reason;
  $('survival-score').textContent = `${survival.jutsus} jutsu completed · ${survival.signs} signs woven`;
  $('survival-result').hidden = false;
  $('survival-retry').focus();
}

const sound = new GameAudio(updateSoundUi);
function updateSoundUi() {
  $('sound-toggle').textContent = sound.muted ? 'Sound off' : sound.ready ? 'Sound on' : 'Enable sound';
  $('sound-toggle').setAttribute('aria-pressed', String(!sound.muted && sound.ready));
}
function unlockSound(event) {
  if (event?.target?.closest?.('#sound-toggle')) return;
  try { sound.unlock(); sound.load(selected().voice); } catch { $('sound-status').textContent = 'Audio unavailable in this browser.'; }
}
document.addEventListener('pointerdown', unlockSound, { capture: true });
document.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') unlockSound(event); }, { capture: true });
$('sound-toggle').addEventListener('click', () => {
  try {
    if (!sound.context || (!sound.muted && !sound.ready)) sound.unlock(); else sound.toggle();
    sound.load(selected().voice);
  } catch { $('sound-status').textContent = 'Audio unavailable in this browser.'; }
});

function showError(text = '') { $('error').textContent = text; $('error').hidden = !text; }
function selected() { return JUTSU[$('jutsu').value]; }
function updateBattleUi() {
  renderBattleHp($('player-hp'), battleState.playerHp);
  renderBattleHp($('cpu-hp'), battleState.cpuHp);
  const remaining = ['active', 'paused'].includes(battleState.phase) ? battleRemaining(battleState, performance.now()) : 10000;
  $('single-timer').textContent = `${(remaining / 1000).toFixed(1)}s`;
  $('single-timer').classList.toggle('urgent', battleState.phase === 'active' && remaining <= 3000);
  $('single-jutsu').textContent = battleState.jutsuId ? `${JUTSU[battleState.jutsuId].style} · ${JUTSU[battleState.jutsuId].name}` : 'Preparing your first jutsu…';
  $('single-status').textContent = battleState.phase === 'paused' ? 'Camera paused. Retry camera to resume.' : battleState.phase === 'active' ? `Hold ${selected().signs[battleState.acceptedSigns]} until the seal fills.` : 'Allow camera access to begin.';
}
function showBattleCallout(text) {
  clearTimeout(battleCalloutTimer);
  const callout = $('single-callout'); callout.textContent = text; callout.classList.remove('show'); void callout.offsetWidth; callout.classList.add('show');
  battleCalloutTimer = setTimeout(() => callout.classList.remove('show'), 900);
}
function syncSingleJutsu() {
  if (mode !== 'single' || !battleState.jutsuId) return;
  $('jutsu').value = battleState.jutsuId; renderSigns(); updateBattleUi();
}
function stopBattleClock() { clearInterval(battleClockHandle); battleClockHandle = undefined; }
function showSingleResult() {
  if (mode !== 'single' || !['victory', 'defeat'].includes(battleState.phase)) return;
  const victory = battleState.phase === 'victory';
  $('single-result-title').textContent = victory ? 'Victory' : 'Defeat';
  $('single-result-copy').textContent = victory ? 'Naruto has fallen. Three successful jutsu landed.' : 'The deadline caught Sasuke three times. Try a new run.';
  $('single-result').hidden = false; $('single-replay').focus(); updateBattleUi();
}
function cancelTerminalFeedback({ restoreResult = true } = {}) {
  clearTimeout(terminalFeedbackTimer); terminalFeedbackTimer = undefined;
  presentation.stop(); presentation.clear();
  if (restoreResult) showSingleResult();
}
function finishSingleOutcome({ element, side, at, text }) {
  stopBattleClock(); running = false;
  const terminalGeneration = battleState.generation;
  stopCamera({ preserveBattleFeedback: true });
  cancelTerminalFeedback({ restoreResult: false });
  presentation.showEffect(element, side, at); presentation.renderStill(at); presentation.start(); showBattleCallout(text);
  terminalFeedbackTimer = setTimeout(() => {
    terminalFeedbackTimer = undefined;
    if (mode !== 'single' || battleState.generation !== terminalGeneration || !['victory', 'defeat'].includes(battleState.phase)) return;
    presentation.stop(); presentation.clear();
    clearTimeout(battleCalloutTimer); $('single-callout').classList.remove('show');
    showSingleResult();
  }, 650);
}
function paintBattleClock() {
  if (mode !== 'single' || battleState.phase !== 'active') return;
  const now = performance.now(); const left = battleRemaining(battleState, now);
  $('single-timer').textContent = `${(left / 1000).toFixed(1)}s`; $('single-timer').classList.toggle('urgent', left <= 3000);
  if (!left) {
    const currentJutsu = selected(); const next = resolveTimeout(battleState, { generation: battleState.generation, now });
    if (next === battleState) return; battleState = next; resolveSingleTimeout(currentJutsu, now);
  }
}
function completeSingleJutsu(currentJutsu, now, target) {
  if (target !== 'cpu') return;
  sound.complete(currentJutsu.voice).catch(() => {}); state = newPractice();
  if (battleState.phase === 'victory') { finishSingleOutcome({ element: currentJutsu.element, side: 'player', at: now, text: `${currentJutsu.name} · Naruto -1 HP` }); return; }
  presentation.showEffect(currentJutsu.element, 'player', now);
  resetPractice({ preserveAudio: true }); syncSingleJutsu(); showBattleCallout(`${currentJutsu.name} · Naruto -1 HP`);
}
function resolveSingleTimeout(currentJutsu, now) {
  state = newPractice();
  if (battleState.phase === 'defeat') { finishSingleOutcome({ element: currentJutsu.element, side: 'cpu', at: now, text: `${currentJutsu.name} expired · Sasuke -1 HP` }); return; }
  presentation.showEffect(currentJutsu.element, 'cpu', now);
  resetPractice({ preserveAudio: true }); syncSingleJutsu(); showBattleCallout(`${currentJutsu.name} expired · Sasuke -1 HP`);
}
function pauseSinglePlayer() {
  if (mode !== 'single' || battleState.phase !== 'active') return;
  battleState = pauseBattle(battleState, { generation: battleState.generation, now: performance.now() }); stopBattleClock(); state = newPractice(); updateBattleUi();
}
function renderSigns() {
  $('jutsu-name').textContent = selected().name;
  $('signs').replaceChildren(...selected().signs.map((sign, i) => {
    const li = document.createElement('li');
    li.className = 'sign-card';
    li.innerHTML = `<div class="sign-image"><img src="${ASSETS}art/seals/${FILES[sign]}" alt="${sign} hand sign"></div><div class="sign-meta"><small>0${i+1}</small><strong>${sign}</strong><span class="sign-state">Waiting</span></div><div class="sign-progress"><span></span></div>`;
    li.querySelector('img').addEventListener('error', () => showError('A hand-sign image could not load. Check your connection and reload the page.'));
    return li;
  }));
  updateSigns();
}
function updateSigns() {
  [...$('signs').children].forEach((card,i) => {
    const done = i < state.index;
    const active = i === state.index && !state.completed;
    card.classList.toggle('active',active);
    card.classList.toggle('done',done);
    if (active) card.setAttribute('aria-current','step'); else card.removeAttribute('aria-current');
    card.querySelector('.sign-state').textContent = done ? '✓ Complete' : active ? 'Your next sign' : 'Up next';
    card.querySelector('.sign-progress span').style.width = `${done ? 100 : active ? (state.hold.progress || 0)*100 : 0}%`;
  });
  $('sequence-count').textContent = `${state.index} / 3 complete`;
}
function resetPractice({ preserveAudio = false } = {}) {
  selectionRevision++;
  if (!preserveAudio) sound.cancel();
  running = Boolean(stream) && (mode !== 'survival' || Boolean(survival && !survival.ended)) && (mode !== 'single' || battleState.phase === 'active');
  state = newPractice();
  clearTimeout(animationTimer);
  $('arena').classList.remove('casting','fireball','earth','water','clone','lightning','wind');
  $('sound-status').textContent = selected().voice ? `${selected().speaker} callout · 3-sign training` : `${selected().speaker} · 3-sign training`;
  sound.load(selected().voice);
  $('action-label').textContent = 'Ready to train.';
  $('action-hint').textContent = 'Complete all three signs to release your jutsu.';
  $('instruction').textContent = stream ? `Hold ${selected().signs[0]} until the card fills, then follow the next sign.` : 'Waiting for your camera…';
  updateSigns();
  if (mode === 'single') updateBattleUi();
}
function setCharacter(name) {
  character = name;
  $('sprite').src = `./assets/${name}.png`;
  $('sprite').alt = `${NAMES[name]} in a ready stance`;
  $('character-name').textContent = NAMES[name].toUpperCase();
  document.querySelectorAll('[data-character]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.character === name)));
  if (mode !== 'survival' && mode !== 'single') resetPractice();
}
async function castJutsu() {
  const revision = selectionRevision;
  const started = performance.now();
  running = false;
  total++;
  $('completed-count').textContent = `${total} jutsu performed`;
  $('instruction').textContent = `${selected().name} released! All three signs complete.`;
  $('action-label').textContent = `${selected().name}!`;
  $('action-hint').textContent = `${NAMES[character]} releases the jutsu.`;
  $('arena').classList.add('casting');
  $('arena').classList.add(selected().element);
  if (mode === 'survival') {
    survival.jutsus++;
    const completedJutsu = selected();
    sound.complete(completedJutsu.voice).catch(() => {});
    chooseRandomJutsu();
    resetPractice({ preserveAudio: true });
    $('arena').classList.add('casting', completedJutsu.element);
    $('action-label').textContent = `${completedJutsu.name}!`;
    animationTimer = setTimeout(() => $('arena').classList.remove('casting'), 1700);
    return;
  }
  const outcome = await sound.complete(selected().voice);
  if (revision !== selectionRevision) return;
  if (outcome.missing) $('sound-status').textContent = selected().voice ? 'Callout unavailable. Try again.' : selected().speaker;
  if (outcome.blocked) $('sound-status').textContent = 'Tap Enable sound to hear jutsu.';
  animationTimer = setTimeout(resetPractice, Math.max(0, 1800 - (performance.now() - started)));
}
function acceptPrediction(label, score, now, revision = selectionRevision) {
  if (!running || revision !== selectionRevision) return;
  if (mode === 'single' && battleState.phase !== 'active') return;
  if (mode === 'survival' && (!survival || survival.ended || remainingTime(survival, performance.now()) === 0)) { endSurvival('Time’s up!'); return; }
  const oldIndex = state.index;
  state = detectSign(state,{label,score,now},selected().signs);
  updateSigns();
  let singleDamage = null;
  if (state.index !== oldIndex) {
    if (mode === 'survival') {
      if (!rewardWeave(survival, performance.now())) { endSurvival('Time’s up!'); return; }
      paintClock();
    }
    if (mode === 'survival' && state.completed) sound.cancel();
    if (mode === 'single') {
      const previousBattle = battleState;
      battleState = confirmSign(previousBattle, { generation: previousBattle.generation, now: performance.now() });
      if (battleState.cpuHp < previousBattle.cpuHp) singleDamage = 'cpu';
      else if (battleState.playerHp < previousBattle.playerHp) singleDamage = 'player';
      updateBattleUi();
    }
    if (mode === 'single' && state.completed) {
      clearTimeout(battleCalloutTimer);
      $('single-callout').classList.remove('show');
      sound.cancel();
    }
    sound.weave();
  }
  if (mode === 'single' && singleDamage === 'player') resolveSingleTimeout(selected(), performance.now());
  else if (state.completed) mode === 'single' ? completeSingleJutsu(selected(), performance.now(), singleDamage) : castJutsu();
  else if (state.index !== oldIndex) $('instruction').textContent = `Good. Now hold ${selected().signs[state.index]}.`;
}
async function loadModels() {
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    $('camera-message').textContent = 'Loading hand recognition. The first load may take a moment…';
    const [vision, onnx] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/+esm'),
      import('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/+esm'),
    ]);
    ort = onnx;
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/';
    ort.env.wasm.numThreads = 1;
    const files = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm');
    const options = { baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numHands:2 };
    let nextDetector;
    try { nextDetector = await vision.HandLandmarker.createFromOptions(files,options); }
    catch { options.baseOptions.delegate = 'CPU'; nextDetector = await vision.HandLandmarker.createFromOptions(files,options); }
    try {
      const response = await fetch(`${ASSETS}seal_classifier.onnx`);
      if (!response.ok) throw new Error('The recognition model is unavailable.');
      session = await ort.InferenceSession.create(await response.arrayBuffer(),{executionProviders:['wasm']});
      detector = nextDetector;
    } catch(error) { nextDetector.close(); throw error; }
  })().catch(error => { modelPromise = null; throw error; });
  return modelPromise;
}
async function startCamera() {
  if (busy || stream || !cameraWanted || document.hidden || (mode === 'single' && ['victory', 'defeat'].includes(battleState.phase))) return;
  busy = true;
  const current = ++generation;
  $('enable-camera').disabled = true;
  $('enable-camera').textContent = 'Preparing camera…';
  $('camera-status').textContent = 'Loading…';
  showError();
  let acquired;
  try {
    await loadModels();
    if (current !== generation) return;
    $('camera-message').textContent = 'Allow camera access to start practicing.';
    acquired = await navigator.mediaDevices.getUserMedia({ video:{facingMode:'user'},audio:false });
    if (current !== generation) { acquired.getTracks().forEach(t => t.stop()); return; }
    stream = acquired;
    $('camera').srcObject = stream;
    await $('camera').play();
    if (current !== generation) return;
    lastVideoTime = -1;
    $('camera-placeholder').hidden = true;
    $('live-overlay').hidden = false;
    $('camera-status').textContent = 'Camera live';
    $('camera-message').textContent = 'Keep both hands in frame. Camera processing stays in your browser.';
    if (mode === 'survival' && !survival) beginSurvival();
    if (mode === 'single') {
      battleState = cameraReady(battleState, performance.now());
      presentation.start();
      if (battleState.phase === 'active') {
        stopBattleClock();
        battleClockHandle = setInterval(paintBattleClock, 50);
      }
      syncSingleJutsu();
    }
    resetPractice();
    acquired.getVideoTracks()[0].addEventListener('ended', () => { if(stream === acquired) stopCamera(); });
    frameHandle = requestAnimationFrame(() => processFrame(current));
  } catch(error) {
    acquired?.getTracks().forEach(t => t.stop());
    if (current === generation) {
      stopCamera();
      showError(error.name === 'NotAllowedError' ? 'Camera access was blocked. Allow camera access in your browser, then try again.' : `Could not start recognition: ${error.message}`);
      $('camera-message').textContent = 'Check your camera and connection, then try again.';
    }
  } finally {
    busy = false;
    $('enable-camera').disabled = false;
    $('enable-camera').textContent = 'Retry camera';
    // Re-entering practice during an older pending camera request must still start.
    if (cameraWanted && current !== generation) startCamera();
  }
}
function stopCamera({ preserveBattleFeedback = false } = {}) {
  if (mode === 'survival' && survival && !survival.ended) { endSurvival('Run ended'); return; }
  if (mode === 'single' && !preserveBattleFeedback) cancelTerminalFeedback();
  pauseSinglePlayer();
  if (mode === 'single' && !preserveBattleFeedback) { presentation.stop(); presentation.clear(); }
  if (!preserveBattleFeedback) { clearTimeout(battleCalloutTimer); $('single-callout').classList.remove('show'); }
  cameraWanted = false;
  generation++;
  cancelAnimationFrame(frameHandle);
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  $('camera').srcObject = null;
  $('camera-placeholder').hidden = false;
  $('live-overlay').hidden = true;
  $('camera-status').textContent = 'Camera off';
  $('prediction').textContent = 'Show a hand sign';
  $('camera-message').textContent = 'Camera processing stays in your browser. Nothing is recorded or uploaded.';
  resetPractice();
}
async function processFrame(current) {
  if (!stream || current !== generation) return;
  try {
    const video = $('camera');
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const now = performance.now();
      const revision = selectionRevision;
      const results = detector.detectForVideo(video,now);
      const hands = (results.landmarks || []).map((landmarks,i) => ({landmarks,handedness:results.handednesses?.[i]?.[0]?.categoryName || ''}));
      let prediction = null;
      if (hands.length) {
        const tensor = new ort.Tensor('float32',Float32Array.from(buildTensor(hands)),[1,84]);
        const output = await session.run({[session.inputNames[0]]:tensor});
        prediction = classifyScores(output[session.outputNames[0]].data);
      }
      if (current !== generation || !stream) return;
      $('prediction').textContent = prediction ? `Detected: ${prediction.label}` : hands.length ? 'Adjust your hand sign' : 'Bring both hands into view';
      acceptPrediction(prediction?.label || null,prediction?.score || 0,now,revision);
    }
  } catch(error) {
    if (current === generation) { stopCamera(); showError(`Recognition stopped: ${error.message}. Try enabling your camera again.`); }
    return;
  }
  if (current === generation && stream) frameHandle = requestAnimationFrame(() => processFrame(current));
}
function route() {
  stopCamera();
  clearInterval(clockHandle);
  survival = null;
  const playing = ['#practice', '#survival', '#single-player'].includes(location.hash);
  mode = location.hash === '#survival' ? 'survival' : location.hash === '#single-player' ? 'single' : 'practice';
  if (mode === 'single') {
    battleState = createBattle({ jutsuIds: Object.keys(JUTSU) });
    stopBattleClock();
  }
  $('home').hidden = playing;
  $('practice').hidden = !playing;
  $('practice').classList.toggle('single-mode', mode === 'single');
  $('single-battle').hidden = mode !== 'single';
  const soundToggle = $('sound-toggle');
  if (mode === 'single') $('single-sound-slot').append(soundToggle);
  else document.querySelector('.arena-toolbar').append(soundToggle);
  $('practice').setAttribute('aria-label', mode === 'survival' ? 'Survival Mode' : mode === 'single' ? 'Single Player' : 'Practice Mode');
  $('camera-placeholder').querySelector('strong').textContent = mode === 'survival' ? 'Survival Mode' : mode === 'single' ? 'Single Player' : 'Practice Mode';
  $('survival-result').hidden = true;
  $('single-result').hidden = true;
  $('survival-timer').hidden = mode !== 'survival';
  $('survival-timer').textContent = '30.0s';
  $('survival-jutsu').hidden = mode !== 'survival';
  $('jutsu').closest('label').hidden = mode === 'survival' || mode === 'single';
  $('jutsu').disabled = mode === 'survival' || mode === 'single';
  updateBattleUi();
  if (mode === 'single') presentation.renderStill();
  if (mode === 'survival') chooseRandomJutsu();
  if (playing) { cameraWanted = true; startCamera(); }
  window.scrollTo(0,0);
}
$('survival-retry').addEventListener('click', () => {
  survival = null;
  $('survival-result').hidden = true;
  $('survival-timer').textContent = '30.0s';
  chooseRandomJutsu();
  cameraWanted = true;
  startCamera();
});
$('single-replay').addEventListener('click', () => {
  cancelTerminalFeedback({ restoreResult: false });
  battleState = replayBattle(battleState);
  $('single-result').hidden = true;
  state = newPractice();
  cameraWanted = true;
  startCamera();
});
$('enable-camera').addEventListener('click',() => { if (mode === 'single' && ['victory', 'defeat'].includes(battleState.phase)) return; cameraWanted = true; startCamera(); });
$('stop-camera').addEventListener('click',stopCamera);
$('jutsu').addEventListener('change',() => { if (mode !== 'survival') { resetPractice(); renderSigns(); } });
document.querySelectorAll('[data-character]').forEach(b => b.addEventListener('click',() => setCharacter(b.dataset.character)));
window.addEventListener('hashchange',route);
window.addEventListener('pagehide',stopCamera);
document.addEventListener('visibilitychange',() => { if(document.hidden) stopCamera(); });
$('sprite').addEventListener('error',() => showError('The character image could not load. Reload the page to try again.'));
$('jutsu').replaceChildren(...Object.entries(JUTSU).map(([id, jutsu]) => new Option(`${jutsu.style || jutsu.type} · ${jutsu.name}`, id)));
setCharacter(character);
renderSigns();
route();
