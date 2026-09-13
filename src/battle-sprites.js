// Shared renderer for multiplayer and the upcoming single-player battle.
// It owns only animation; recognition, audio, and attack acknowledgements never wait on it.
export class BattleSprites {
  constructor(stage) {
    this.stage=stage;this.frame=null;this.stopped=true;
    this.fighters=['sasuke','naruto'].map(name=>({name,element:stage.querySelector(`[data-fighter="${name}"]`),pending:0,started:null}));
  }
  start(){if(!this.stopped)return;this.stopped=false;this.tick(performance.now());}
  attack(name){const fighter=this.fighters.find(f=>f.name===name);if(fighter)fighter.pending++;this.start();}
  remainingMs(){const now=performance.now();return Math.max(0,...this.fighters.map(f=>f.pending*840+(f.started===null?0:Math.max(0,840-(now-f.started)))));}
  stop(){this.stopped=true;cancelAnimationFrame(this.frame);for(const f of this.fighters){f.pending=0;f.started=null;f.element.style.transform='';}}
  tick(now){
    if(this.stopped)return;
    for(const f of this.fighters){
      if(f.started===null&&f.pending){f.pending--;f.started=now;}
      let index=Math.floor(now/650)%2,move=0;
      if(f.started!==null){
        const elapsed=now-f.started;
        index=Math.min(5,Math.floor(elapsed/120));
        move=Math.max(0,Math.min(1,(elapsed-240)/360));
        if(elapsed>840){f.started=null;index=0;move=0;}
      }
      f.element.style.backgroundPosition=`${(index%3)*50}% ${Math.floor(index/3)*100}%`;
      const distance=Math.max(0,this.stage.clientWidth*.45-f.element.clientWidth*.8);
      f.element.style.transform=`translateX(${distance*move*(f.name==='sasuke'?1:-1)}px)`;
    }
    this.frame=requestAnimationFrame(time=>this.tick(time));
  }
}
