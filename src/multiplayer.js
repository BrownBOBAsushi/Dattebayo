const $=id=>document.getElementById(id);
let token;
try {token=sessionStorage.getItem('ninja-match-token');} catch {}
if(!token) token=crypto.randomUUID();
function persist(){try{sessionStorage.setItem('ninja-match-token',token);}catch{}}
persist();
let room=null, pendingAttack=null, busy=false, timer=null, clockOffset=0;
export const matchRoom=()=>room;
export const matchScore=()=>room?.players[room.role==='host'?0:1].score||0;
export const matchCanPlay=()=>room?.status==='playing' && Date.now()+clockOffset>=room.startsAt && pendingAttack===null;
export const matchJutsu=()=>room?.sequence[Math.min(matchScore(),4)];
async function request(action,body={}) {
  const requestToken=token;
  const response=await fetch(`/api/multiplayer/${action}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  const result=await response.json();
  if(requestToken!==token) throw new Error('Room changed.');
  if(!response.ok) throw new Error(result.error||'Connection interrupted. Please retry.');
  return result;
}
function apply(next) {
  room=next;clockOffset=next.serverNow-Date.now();
  if(pendingAttack!==null && (matchScore()>=pendingAttack || room.status!=='playing')) pendingAttack=null;
  const mine=room.role==='host'?0:1, opponent=1-mine;
  $('mp-room-code').textContent=room.code;
  $('mp-room-kind').textContent=room.kind==='random'?'Random matchmaking':'Private room';
  $('mp-players').replaceChildren(...room.players.map((player,i)=>{
    const row=document.createElement('p');
    row.textContent=player.name?`${player.name}${i===mine?' (you)':''} · ${player.ready?'Ready':'Preparing'}${player.online?'':' · Reconnecting…'}`:'Waiting for another ninja…';return row;
  }));
  $('mp-ready').disabled=!room.players[opponent].name || !room.players[opponent].online || room.status!=='waiting';
  $('mp-ready').textContent='Ready · enable camera';
  $('mp-entry').hidden=true;$('mp-waiting').hidden=false;
  $('mp-you-name').textContent=room.players[mine].name;
  $('mp-them-name').textContent=room.players[opponent].name||'Opponent';
  $('mp-you-health').value=5-room.players[opponent].score;
  $('mp-them-health').value=5-room.players[mine].score;
  $('mp-you-hp').textContent=`${5-room.players[opponent].score}/5 HP`;
  $('mp-them-hp').textContent=`${5-room.players[mine].score}/5 HP`;
  if(room.status==='finished'||room.status==='closed') {
    $('mp-finish').hidden=false;
    $('mp-finish-title').textContent=room.status==='closed'?'Match ended':matchScore()===5?'Victory!':'Defeat';
    $('mp-finish-detail').textContent=room.status==='closed'?'A player left, disconnected, or the room expired.':`${room.players[mine].score} attacks landed · ${room.players[opponent].score} received`;
    clearTimeout(timer);
  }
  window.dispatchEvent(new CustomEvent('multiplayer:update'));
}
async function poll() {
  if(!room || ['finished','closed'].includes(room.status)) return;
  if(busy){timer=setTimeout(poll,1000);return;}
  busy=true;
  try {const result=await request(pendingAttack===null?'state':'score',pendingAttack===null?{}:{count:pendingAttack});apply(result.room);$('mp-status').textContent='';}
  catch(error){$('mp-status').textContent=error.message;$('mp-battle-status').textContent='Reconnecting…';}
  finally{busy=false;if(room && !['finished','closed'].includes(room.status)) timer=setTimeout(poll,1000);}
}
export async function readyMatch(){const result=await request('ready');apply(result.room);}
export function reportAttack(){
  if(pendingAttack===null)pendingAttack=matchScore()+1;
  if(!busy){clearTimeout(timer);poll();}
}
export function matchMessage(){
  if(!room)return 'No active room';
  if(room.status==='waiting')return 'Waiting for both cameras to be ready…';
  if(room.status!=='playing')return 'Match ended';
  const countdown=Math.ceil((room.startsAt-Date.now()-clockOffset)/1000);
  return countdown>0?`Get ready · ${countdown}`:pendingAttack!==null?'Confirming attack…':'First to 5 attacks wins';
}
async function enter(action){
  if(busy)return;busy=true;$('mp-status').textContent=action==='match'?'Finding an opponent…':'Opening room…';
  document.querySelectorAll('[data-mp-enter]').forEach(b=>b.disabled=true);
  try{const result=await request(action,{name:$('mp-name').value,code:$('mp-code').value.trim().toUpperCase()});apply(result.room);$('mp-status').textContent='';clearTimeout(timer);timer=setTimeout(poll,1000);}
  catch(error){$('mp-status').textContent=error.message;}
  finally{busy=false;document.querySelectorAll('[data-mp-enter]').forEach(b=>b.disabled=false);}
}
async function leave(){
  clearTimeout(timer);
  try{if(room)await request('leave');}catch{}
  room=null;pendingAttack=null;token=crypto.randomUUID();persist();
  $('mp-entry').hidden=false;$('mp-waiting').hidden=true;$('mp-finish').hidden=true;
  $('mp-status').textContent='';location.hash='#multiplayer';
}
$('mp-ready').addEventListener('click',()=>{location.hash='#battle';});
$('mp-leave').addEventListener('click',leave);
$('mp-again').addEventListener('click',leave);
$('mp-exit').addEventListener('click',async()=>{await leave();location.hash='#home';});
$('mp-battle-exit').addEventListener('click',leave);
$('mp-copy').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(`${location.origin}/#multiplayer?room=${room.code}`);$('mp-status').textContent='Room link copied.';}catch{$('mp-status').textContent=`Share room code ${room.code}`;}
});
document.querySelectorAll('[data-mp-enter]').forEach(b=>b.addEventListener('click',()=>enter(b.dataset.mpEnter)));
function route(){
  const lobby=location.hash.startsWith('#multiplayer');
  $('multiplayer').hidden=!lobby;
  if(lobby){$('home').hidden=true;const code=location.hash.split('room=')[1];if(code)$('mp-code').value=code.slice(0,6).toUpperCase();}
  if(!lobby&&location.hash!=='#battle'&&room&&!['finished','closed'].includes(room.status)){
    request('leave').catch(()=>{});clearTimeout(timer);room=null;token=crypto.randomUUID();persist();$('mp-entry').hidden=false;$('mp-waiting').hidden=true;
  }
}
window.addEventListener('hashchange',route);
route();
// Restore a room after a reload without using the room code as a player credential.
if(location.hash.startsWith('#multiplayer')||location.hash==='#battle') request('state').then(result=>{apply(result.room);timer=setTimeout(poll,1000);if(location.hash==='#battle')location.hash='#multiplayer';}).catch(()=>{if(location.hash==='#battle')location.hash='#multiplayer';});
