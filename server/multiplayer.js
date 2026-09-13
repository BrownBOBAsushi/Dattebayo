const json = (body, status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
const ids = ['fireball','hiding_in_ash','goryuka','goka_mekkyaku','emotion_waves','chidori','suijinheki','rasenshuriken','kazekiri'];
const code = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join('');
const roomFor = (db,token) => db.prepare('SELECT * FROM multiplayer_rooms WHERE host_token = ? OR guest_token = ?').bind(token,token).first();
function publicRoom(room,token,now) {
  const host = room.host_token === token;
  return {code:room.code,kind:room.kind,status:room.status,role:host?'host':'guest',serverNow:now,startsAt:room.starts_at,attacksToWin:5,
    players:[{name:room.host_name,ready:!!room.host_ready,score:room.host_score,online:now-room.host_seen<25000,progress:room.host_progress?JSON.parse(room.host_progress):null},{name:room.guest_name,ready:!!room.guest_ready,score:room.guest_score,online:room.guest_seen!==null&&now-room.guest_seen<25000,progress:room.guest_progress?JSON.parse(room.guest_progress):null}],
    sequence:JSON.parse(room.sequence)};
}
export async function multiplayer(request,db,env={}) {
  try {
    const url = new URL(request.url), now=Date.now();
    if(request.method!=='POST') return json({error:'Use POST'},405);
    if(request.headers.get('Origin') && request.headers.get('Origin')!==url.origin) return json({error:'Invalid origin'},403);
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
    if(!token || !/^[a-f0-9-]{36}$/i.test(token)) fail('Please reopen Multiplayer.',401);
    const raw=await request.text(); if(raw.length>(url.pathname.endsWith('/signal')?65536:1024)) fail('Request too large');
    let body; try {body=JSON.parse(raw || '{}');} catch {fail('Invalid request');}
    const action=url.pathname.split('/').at(-1);
    let room=await roomFor(db,token);
    if(room) {
      // Every transition is conditional so simultaneous callers cannot revive a room.
      await db.prepare("UPDATE multiplayer_rooms SET status = 'closed' WHERE code = ? AND status IN ('waiting','playing') AND ((status = 'playing' AND ? >= starts_at + 600000) OR ? - host_seen > 60000 OR (guest_token IS NOT NULL AND ? - guest_seen > 60000) OR (status = 'waiting' AND ? - created_at > 600000))").bind(room.code,now,now,now,now).run();
      room=await roomFor(db,token);
    }
    if(action==='leave') {
      if(room) await db.prepare("UPDATE multiplayer_rooms SET status='closed',host_signal=NULL,guest_signal=NULL WHERE code=? AND status IN ('waiting','playing')").bind(room.code).run();
      return json({left:true});
    }
    if(['create','join','match'].includes(action)) {
      if(room) return json({room:publicRoom(room,token,now)});
      const name=typeof body.name==='string'?body.name.trim().normalize('NFC'):'';
      if(!name || [...name].length>24 || /[\p{Cc}\p{Cf}<>]/u.test(name)) fail('Enter a ninja name with 1–24 characters.');
      if(action==='join' && !/^[A-Z2-9]{6}$/.test(body.code || '')) fail('Enter the six-character room code.');
      const sequence=Array.from({length:5},()=>ids[crypto.getRandomValues(new Uint32Array(1))[0]%ids.length]);
      for(let attempt=0;attempt<4&&!room;attempt++) {
        const statements=[];
        if(action!=='create') {
          const condition=action==='join'?'code = ?':"kind = 'random'";
          const params=action==='join'?[body.code]:[];
          statements.push(db.prepare(`UPDATE multiplayer_rooms SET guest_token=?, guest_name=?, guest_seen=? WHERE code=(SELECT code FROM multiplayer_rooms WHERE ${condition} AND status='waiting' AND guest_token IS NULL AND host_seen > ? AND created_at > ? ORDER BY created_at LIMIT 1) AND guest_token IS NULL AND NOT EXISTS (SELECT 1 FROM multiplayer_rooms WHERE host_token=? OR guest_token=?)`).bind(token,name,now,...params,now-25000,now-600000,token,token));
        }
        if(action!=='join') statements.push(db.prepare("INSERT OR IGNORE INTO multiplayer_rooms (code,kind,host_token,host_name,host_seen,created_at,sequence) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM multiplayer_rooms WHERE host_token=? OR guest_token=?)").bind(code(),action==='match'?'random':'private',token,name,now,now,JSON.stringify(sequence),token,token));
        await db.batch(statements);
        room=await roomFor(db,token);
        if(!room && action==='join') fail('Room is full, expired or unavailable. Check the code.',409);
      }
      if(!room) fail('Could not create a room. Try again.',503);
    }
    if(!room) fail('Room not found. Create or join a room.',404);
    const role=room.host_token===token?'host':'guest';
    if(action==='signal') {
      if(!room.guest_token || !['waiting','playing'].includes(room.status)) fail('Camera sharing is only available in an active two-player room.',409);
      if(body.description) {
        const signal=body.description;
        if(!(role==='host'?signal.type==='offer':['answer','restart'].includes(signal.type)) || typeof signal.sdp!=='string' || signal.sdp.length>50000 || (signal.type==='restart'?signal.sdp!=='':!signal.sdp.startsWith('v=0')) || typeof signal.id!=='string' || !/^[a-f0-9-]{36}$/i.test(signal.id)) fail('Invalid camera negotiation.');
        await db.prepare(`UPDATE multiplayer_rooms SET ${role}_signal=? WHERE code=? AND status IN ('waiting','playing')`).bind(JSON.stringify(signal),room.code).run();
      }
      room=await roomFor(db,token);
      const remote=role==='host'?room.guest_signal:room.host_signal;
      return json({description:remote?JSON.parse(remote):null});
    }
    if(action==='ice') {
      const iceServers=[{urls:'stun:stun.l.google.com:19302'}];
      if(env.TURN_URL && env.TURN_USERNAME && env.TURN_CREDENTIAL) iceServers.push({urls:env.TURN_URL,username:env.TURN_USERNAME,credential:env.TURN_CREDENTIAL});
      return json({iceServers});
    }
    if(body.weave && ['state','score'].includes(action)) {
      const {index,jutsuIndex,label}=body.weave;
      if(!Number.isInteger(index)||index<0||index>3||!Number.isInteger(jutsuIndex)||jutsuIndex<0||jutsuIndex>4||!(label===null||['rat','ox','tiger','hare','dragon','serpent','horse','ram','monkey','bird','dog','boar'].includes(label))) fail('Invalid hand-sign progress.');
      await db.prepare(`UPDATE multiplayer_rooms SET ${role}_progress=? WHERE code=? AND status='playing'`).bind(JSON.stringify({index,jutsuIndex,label,updatedAt:now}),room.code).run();
    }

    if(action==='ready' && room.status==='waiting') await db.prepare(`UPDATE multiplayer_rooms SET ${role}_ready=1 WHERE code=? AND status='waiting'`).bind(room.code).run();
    if(action==='score') {
      const count=body.count;
      if(!Number.isInteger(count)||count<1||count>5) fail('Invalid jutsu count.');
      await db.prepare(`UPDATE multiplayer_rooms SET ${role}_score=?, status=CASE WHEN ?=5 THEN 'finished' ELSE status END WHERE code=? AND status='playing' AND ? >= starts_at + ? AND ? < starts_at + 600000 AND ${role}_score=?`).bind(count,count,room.code,now,count*900,now,count-1).run();
    }
    if(room.status==='waiting'||room.status==='playing') {
      await db.prepare(`UPDATE multiplayer_rooms SET ${role}_seen=? WHERE code=?`).bind(now,room.code).run();
      await db.prepare("UPDATE multiplayer_rooms SET status='playing',starts_at=? WHERE code=? AND status='waiting' AND host_ready=1 AND guest_ready=1 AND guest_token IS NOT NULL AND host_seen>? AND guest_seen>?").bind(now+3000,room.code,now-25000,now-25000).run();
    }
    room=await roomFor(db,token);
    if(['finished','closed'].includes(room.status)) await db.prepare('UPDATE multiplayer_rooms SET host_signal=NULL,guest_signal=NULL WHERE code=?').bind(room.code).run();
    return json({room:publicRoom(room,token,now)});
  } catch(error) { if(!error.status) console.error('Multiplayer request failed',error); return json({error:error.status?error.message:'Multiplayer unavailable. Please retry.'},error.status||503); }
}
