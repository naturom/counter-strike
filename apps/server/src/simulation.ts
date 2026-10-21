import {randomUUID} from 'node:crypto';
import {DT, EYE, HEIGHT, RADIUS, ROUND_MS, WIN_SCORE, SPAWNS, SOLIDS, WEAPONS, direction, move, neutralInput, rayBox, wallDistance, type Input, type Player, type Snapshot, type CombatEvent, type Solid, type Team} from '@sirocco/shared';
export class Simulation {
  players=new Map<string,Player>();
  queues=new Map<string,Input[]>();
  private lastSeq=new Map<string,number>();
  private nextShot=new Map<string,number>();
  private trigger=new Map<string,boolean>();
  private eventId=0;
  events:CombatEvent[]=[];
  scores={red:0,blue:0};
  time=0; endsAt=ROUND_MS; phase:Snapshot['phase']='playing'; winner:Snapshot['winner']=null;
  round=1; readonly matchId=randomUUID();
  constructor(public solids:Solid[]=SOLIDS) {}
  add(id:string,name:string):Player {
    if(this.players.size>=8)throw new Error('Room full (8/8).');
    const red=[...this.players.values()].filter(p=>p.team==='red').length;
    const blue=this.players.size-red;
    const team:Team=red<=blue?'red':'blue';
    const p:Player={id,name,team,x:0,y:0,z:0,vy:0,grounded:true,yaw:team==='red'?0:Math.PI,pitch:0,hp:100,kills:0,deaths:0,weapon:'rifle',ammo:{rifle:30,pistol:12},reloadUntil:0,respawnAt:0,protectedUntil:0,connected:true,ack:0};
    this.players.set(id,p);this.queues.set(id,[]);this.spawn(p);return p;
  }
  remove(id:string) {this.players.delete(id);this.queues.delete(id);this.lastSeq.delete(id);this.nextShot.delete(id);this.trigger.delete(id);}
  input(id:string,i:Input) {
    const prev=this.lastSeq.get(id)??0;
    if(i.seq<=prev || i.seq-prev>120)return;
    this.lastSeq.set(id,i.seq);
    const q=this.queues.get(id);if(!q)return;
    if(q.length>=8)q.shift();q.push(i);
  }
  spawn(p:Player) {
    // Prefer spawn furthest from living opponents; spread teammates to avoid stacking.
    const others=[...this.players.values()].filter(o=>o.id!==p.id&&o.hp>0);
    const spots=SPAWNS[p.team].map(s=>({s,safety:Math.min(...others.map(o=>Math.hypot(o.x-s.x,o.z-s.z)),100)}));
    spots.sort((a,b)=>b.safety-a.safety);
    Object.assign(p,spots[0].s,{hp:100,vy:0,grounded:true,ammo:{rifle:30,pistol:12},weapon:'rifle',reloadUntil:0,respawnAt:0,protectedUntil:this.time+1500,yaw:p.team==='red'?0:Math.PI,pitch:0});
    this.queues.set(p.id,[]);this.trigger.delete(p.id);this.nextShot.set(p.id,this.time+100);
  }
  step() {
    this.time+=DT*1000;this.events=[];
    if(this.phase==='finished')return;
    if(this.time>=this.endsAt) {this.finish();return;}
    for(const p of this.players.values()) {
      if(this.winner!==null)break;
      if(p.hp<=0) {if(this.time>=p.respawnAt)this.spawn(p);continue;}
      if(p.reloadUntil && this.time>=p.reloadUntil){p.ammo[p.weapon]=WEAPONS[p.weapon].magazine;p.reloadUntil=0;}
      const i=this.queues.get(p.id)?.shift();
      const controls=i && p.connected?i:{...neutralInput(),yaw:p.yaw,pitch:p.pitch,weapon:p.weapon};
      Object.assign(p,move(p,controls,this.solids));
      if(!i || !p.connected){this.trigger.set(p.id,false);continue;}
      p.ack=i.seq;p.yaw=i.yaw;p.pitch=i.pitch;
      if(i.weapon!==p.weapon){p.weapon=i.weapon;p.reloadUntil=0;this.nextShot.set(p.id,Math.max(this.nextShot.get(p.id)??0,this.time+200));}
      const w=WEAPONS[p.weapon];
      if(i.reload&&!p.reloadUntil&&p.ammo[p.weapon]<w.magazine)p.reloadUntil=this.time+w.reload;
      const was=this.trigger.get(p.id)??false;
      if(i.fire && !i.sprint && !p.reloadUntil && p.ammo[p.weapon]>0 && (p.weapon==='rifle'||!was) && this.time+0.01>=(this.nextShot.get(p.id)??0))this.fire(p);
      this.trigger.set(p.id,i.fire);
    }
  }
  fire(p:Player) {
    const w=WEAPONS[p.weapon];p.ammo[p.weapon]--;this.nextShot.set(p.id,this.time+w.interval);p.protectedUntil=0;
    const from={x:p.x,y:p.y+EYE,z:p.z},dir=direction(p.yaw,p.pitch);
    let distance=wallDistance(from,dir,this.solids),target:Player|undefined;
    for(const other of this.players.values()) {
      if(other.id===p.id||other.hp<=0)continue;
      const t=rayBox(from,dir,{x:other.x-RADIUS,y:other.y,z:other.z-RADIUS},{x:other.x+RADIUS,y:other.y+HEIGHT,z:other.z+RADIUS});
      if(t!==null&&t<distance){distance=t;target=other;}
    }
    const to={x:from.x+dir.x*distance,y:from.y+dir.y*distance,z:from.z+dir.z*distance};
    const hit=target && target.team!==p.team && target.protectedUntil<=this.time ? target : undefined;
    this.events.push({type:'shot',id:++this.eventId,shooter:p.id,target:hit?.id,team:p.team,weapon:p.weapon,from,to});
    if(hit){hit.hp=Math.max(0,hit.hp-w.damage);if(!hit.hp){hit.deaths++;hit.respawnAt=this.time+3000;hit.reloadUntil=0;p.kills++;this.scores[p.team]++;
      this.events.push({type:'kill',id:++this.eventId,shooter:p.id,target:hit.id,name:p.name,victim:hit.name,team:p.team,weapon:p.weapon,from,to});
      if(this.scores[p.team]>=WIN_SCORE)this.finish();
    }}
  }
  finish(){this.phase='finished';this.winner=this.scores.red===this.scores.blue?'draw':this.scores.red>this.scores.blue?'red':'blue';}
  rematch(){if(this.phase!=='finished')return;this.round++;this.scores={red:0,blue:0};this.phase='playing';this.winner=null;this.endsAt=this.time+ROUND_MS;for(const p of this.players.values()){p.kills=0;p.deaths=0;this.spawn(p);}}
  snapshot():Snapshot{return {matchId:this.matchId,round:this.round,time:this.time,endsAt:this.endsAt,phase:this.phase,winner:this.winner,scores:{...this.scores},players:[...this.players.values()].map(p=>({...p,ammo:{...p.ammo}}))};}
}
