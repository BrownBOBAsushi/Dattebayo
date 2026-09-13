import { matchRoom, matchRequest } from './multiplayer.js';
let connection=null, channel=null, stream=null, loop=null, epoch=0, signalId=null, lastOffer=null, lastRestart=null, ignoredOffer=null, shared=false, reconnectTimer=null;
const $=id=>document.getElementById(id);
function fallback(show){$('opponent-fallback').hidden=!show;}
function status(message){$('opponent-camera-status').textContent=message;}
function gather(pc){return new Promise(resolve=>{
  if(pc.iceGatheringState==='complete')return resolve();
  const done=()=>{clearTimeout(timeout);pc.removeEventListener('icegatheringstatechange',change);resolve();};
  const change=()=>{if(pc.iceGatheringState==='complete')done();};
  const timeout=setTimeout(done,5000);pc.addEventListener('icegatheringstatechange',change);
});}
function wireChannel(next){
  channel=next;
  channel.onopen=()=>{channel.send(JSON.stringify({kind:'camera',shared}));};
  channel.onmessage=event=>{
    if(typeof event.data!=='string'||event.data.length>512)return;
    try{const data=JSON.parse(event.data);
      if(data.kind==='camera'&&!data.shared)status('Opponent chose not to share video.');
      if(data.kind==='weave')window.dispatchEvent(new CustomEvent('multiplayer:remote-weave',{detail:data.weave}));
    }catch{}
  };
}
async function makeConnection(current){
  const {iceServers}=await matchRequest('ice');if(current!==epoch)return null;
  connection?.close();
  const pc=new RTCPeerConnection({iceServers});connection=pc;
  if(shared&&stream?.getVideoTracks()[0])pc.addTrack(stream.getVideoTracks()[0],stream);
  else pc.addTransceiver('video',{direction:'recvonly'});
  pc.ontrack=event=>{
    if(current!==epoch||connection!==pc)return;
    $('opponent-camera').srcObject=event.streams[0]||new MediaStream([event.track]);
    $('opponent-camera').play().catch(()=>status('Tap the opponent video to play it.'));
    event.track.onunmute=()=>{if(connection===pc){fallback(false);status('Opponent camera live');}};
    event.track.onmute=()=>{if(connection===pc)fallback(true);};
    event.track.onended=()=>{if(connection===pc)fallback(true);};
    status(event.track.muted?'Waiting for opponent video…':'Opponent camera live');
  };
  pc.onconnectionstatechange=()=>{
    if(current!==epoch||connection!==pc)return;
    if(['failed','disconnected','closed'].includes(pc.connectionState))fallback(true);
    if(pc.connectionState==='failed')status('Video could not connect on this network. You can keep duelling.');
    if(pc.connectionState==='disconnected')status('Opponent video interrupted · reconnect if it does not return.');
    if(pc.connectionState==='connected'&&!$('opponent-camera').srcObject)status('Connected · opponent camera off');
  };
  if(matchRoom()?.role==='host')wireChannel(pc.createDataChannel('weaving'));
  else pc.ondatachannel=event=>wireChannel(event.channel);
  return pc;
}
export function stopPeerCamera(){
  epoch++;clearTimeout(loop);clearTimeout(reconnectTimer);connection?.close();connection=null;channel=null;stream=null;signalId=null;lastOffer=null;lastRestart=null;ignoredOffer=null;
  fallback(true);$('opponent-camera').srcObject=null;status('Waiting for opponent camera…');
}
export async function startPeerCamera(localStream){
  stopPeerCamera();stream=localStream;shared=$('mp-share-camera').checked;
  const current=epoch;status('Connecting to opponent…');
  try{
    const pc=await makeConnection(current);if(!pc)return;
    if(matchRoom()?.role==='host'){
      signalId=crypto.randomUUID();await pc.setLocalDescription(await pc.createOffer());await gather(pc);
      if(current!==epoch)return;
      await matchRequest('signal',{description:{type:'offer',sdp:pc.localDescription.sdp,id:signalId}});
    }
    if(matchRoom()?.role==='guest'){
      const prior=await matchRequest('signal',{description:{type:'restart',sdp:'',id:crypto.randomUUID()}});
      ignoredOffer=prior.description?.id||null;
    }
    async function tick(){
      if(current!==epoch)return;
      try{
        const result=await matchRequest('signal');if(current!==epoch)return;
        const remote=result.description;
        if(matchRoom()?.role==='host'&&remote?.type==='restart'&&remote.id!==lastRestart){
          lastRestart=remote.id;
          const target=await makeConnection(current);if(!target||current!==epoch)return;
          signalId=crypto.randomUUID();await target.setLocalDescription(await target.createOffer());await gather(target);
          if(current!==epoch)return;
          await matchRequest('signal',{description:{type:'offer',sdp:target.localDescription.sdp,id:signalId}});
        }else if(matchRoom()?.role==='guest'&&remote?.type==='offer'&&remote.id!==lastOffer&&remote.id!==ignoredOffer){
          const target=lastOffer?await makeConnection(current):connection;
          if(!target||current!==epoch)return;
          await target.setRemoteDescription({type:'offer',sdp:remote.sdp});
          await target.setLocalDescription(await target.createAnswer());await gather(target);
          if(current!==epoch)return;
          await matchRequest('signal',{description:{type:'answer',sdp:target.localDescription.sdp,id:remote.id}});
          lastOffer=remote.id;
        }else if(matchRoom()?.role==='host'&&remote?.type==='answer'&&remote.id===signalId&&!connection.remoteDescription){
          await connection.setRemoteDescription({type:'answer',sdp:remote.sdp});
        }
      }catch{if(current===epoch)status('Video connection unavailable. The duel can continue.');}
      if(current===epoch)loop=setTimeout(tick,connection?.connectionState==='connected'?5000:1200);
    }
    tick();
  }catch{if(current===epoch){status('Retrying video connection…');reconnectTimer=setTimeout(()=>{if(current===epoch&&stream)startPeerCamera(stream);},5000);}}
}
let lastSent=0;
window.addEventListener('multiplayer:weave',event=>{
  if(channel?.readyState!=='open'||performance.now()-lastSent<80)return;
  lastSent=performance.now();channel.send(JSON.stringify({kind:'weave',weave:event.detail}));
});
window.addEventListener('multiplayer:leave',stopPeerCamera);
window.addEventListener('pagehide',stopPeerCamera);
$('opponent-camera').addEventListener('click',()=>$('opponent-camera').play().catch(()=>{}));

document.getElementById('reconnect-video').addEventListener('click',()=>{if(stream)startPeerCamera(stream);else status('Start your camera first, then reconnect video.');});

$('opponent-camera').addEventListener('playing',()=>fallback(false));
$('opponent-camera').addEventListener('waiting',()=>fallback(true));
$('opponent-camera').addEventListener('error',()=>fallback(true));
