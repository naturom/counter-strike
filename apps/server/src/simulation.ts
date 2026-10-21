import {randomUUID} from 'node:crypto';
import {DT,RADIUS,ROUND_MS,WIN_SCORE,MAPS,DEFAULT_MAP,WEAPONS,direction,move,neutralInput,rayBox,wallDistance,heightOf,eyeOf,nearestPickup,type Input,type Player,type Snapshot,type CombatEvent,type Solid,type Team,type MapId,type Pickup,type Grenade,type Weapon,type Vec3} from '@sirocco/shared';
const freshAmmo=()=>({rifle:30,pistol:12,smg:0,marksman:0});
export class Simulation {
  players=new Map<string,Player>();
  queues=new Map<string,Input[]>();
  private lastSeq=new Map<string,number>();
  private nextShot=new Map<string,number>();
  private trigger=new Map<string,boolean>();
  private actions=new Map<string,{interact:boolean;grenade:boolean;throwAt:number}>();
  private eventId=0;
  events:CombatEvent[]=[];
  scores={red:0,blue:0};
  time=0;endsAt=ROUND_MS;phase:Snapshot['phase']='playing';winner:Snapshot['winner']=null;
  round=1;readonly matchId=randomUUID();
  readonly mapId:MapId;
  solids:Solid[];pickups:Pickup[];grenades:Grenade[]=[];
  constructor(mapOrSolids:MapId|Solid[]=DEFAULT_MAP){this.mapId=typeof mapOrSolids==='string'?mapOrSolids:DEFAULT_MAP;this.solids=typeof mapOrSolids==='string'?MAPS[mapOrSolids].solids:mapOrSolids;this.pickups=MAPS[this.mapId].pickups.map(p=>({...p}));}
  add(id:string,name:string):Player {
    if(this.players.size>=8)throw new Error('Room full (8/8).');
    const red=[...this.players.values()].filter(p=>p.team==='red').length,blue=this.players.size-red;
    const team:Team=red<=blue?'red':'blue';
    const p:Player={id,name,team,x:0,y:0,z:0,vy:0,grounded:true,crouched:false,yaw:team==='red'?0:Math.PI,pitch:0,hp:100,kills:0,deaths:0,weapon:'rifle',primary:'rifle',ammo:freshAmmo(),grenades:2,reloadUntil:0,respawnAt:0,protectedUntil:0,connected:true,ack:0};
    this.players.set(id,p);this.queues.set(id,[]);this.spawn(p);return p;
  }
  remove(id:string){this.players.delete(id);this.queues.delete(id);this.lastSeq.delete(id);this.nextShot.delete(id);this.trigger.delete(id);this.actions.delete(id);}
  input(id:string,i:Input){const prev=this.lastSeq.get(id)??0;if(i.seq<=prev||i.seq-prev>120)return;this.lastSeq.set(id,i.seq);const q=this.queues.get(id);if(!q)return;if(q.length>=8)q.shift();q.push(i);}
  spawn(p:Player){
    const others=[...this.players.values()].filter(o=>o.id!==p.id&&o.hp>0);
    const spots=MAPS[this.mapId].spawns[p.team].map(s=>({s,safety:Math.min(...others.map(o=>Math.hypot(o.x-s.x,o.z-s.z)),100)}));spots.sort((a,b)=>b.safety-a.safety);
    Object.assign(p,spots[0].s,{hp:100,vy:0,grounded:true,crouched:false,ammo:freshAmmo(),weapon:'rifle',primary:'rifle',grenades:2,reloadUntil:0,respawnAt:0,protectedUntil:this.time+1500,yaw:p.team==='red'?0:Math.PI,pitch:0});
    this.queues.set(p.id,[]);this.trigger.delete(p.id);this.actions.set(p.id,{interact:false,grenade:false,throwAt:0});this.nextShot.set(p.id,this.time+100);
  }
  step(){
    this.time+=DT*1000;this.events=[];if(this.phase==='finished')return;
    if(this.time>=this.endsAt){this.finish();return;}
    for(const p of this.players.values()){
      if(this.winner!==null)break;
      if(p.hp<=0){if(this.time>=p.respawnAt)this.spawn(p);continue;}
      if(p.reloadUntil&&this.time>=p.reloadUntil){p.ammo[p.weapon]=WEAPONS[p.weapon].magazine;p.reloadUntil=0;}
      const i=this.queues.get(p.id)?.shift();
      const controls=i&&p.connected?i:{...neutralInput(),yaw:p.yaw,pitch:p.pitch,weapon:p.weapon,crouch:p.crouched};
      Object.assign(p,move(p,controls,this.solids));
      if(!i||!p.connected)continue;
      p.ack=i.seq;p.yaw=i.yaw;p.pitch=i.pitch;
      if(i.weapon!==p.weapon&&(i.weapon===p.primary||i.weapon==='pistol')){p.weapon=i.weapon;p.reloadUntil=0;this.nextShot.set(p.id,Math.max(this.nextShot.get(p.id)??0,this.time+200));}
      const action=this.actions.get(p.id)!;
      if(i.interact&&!action.interact)this.pickup(p);
      if(i.grenade&&!action.grenade&&this.time>=action.throwAt&&p.grenades>0){this.throwGrenade(p);action.throwAt=this.time+600;}
      action.interact=!!i.interact;action.grenade=!!i.grenade;
      const w=WEAPONS[p.weapon];
      if(i.reload&&!p.reloadUntil&&p.ammo[p.weapon]<w.magazine){p.reloadUntil=this.time+w.reload;this.emit('reload',p,p.weapon,this.eye(p),this.eye(p));}
      const was=this.trigger.get(p.id)??false;
      if(i.fire&&(!i.sprint||p.crouched)&&!p.reloadUntil&&p.ammo[p.weapon]>0&&(w.automatic||!was)&&this.time+.01>=(this.nextShot.get(p.id)??0))this.fire(p);
      this.trigger.set(p.id,i.fire);
    }
    if(this.phase==='playing')this.stepGrenades();
  }
  private eye(p:Player):Vec3{return{x:p.x,y:p.y+eyeOf(p),z:p.z};}
  private emit(type:CombatEvent['type'],p:{id:string;team:Team},weapon:Weapon|'grenade',from:Vec3,to:Vec3,extra:Partial<CombatEvent>={}){this.events.push({type,id:++this.eventId,shooter:p.id,team:p.team,weapon,from:{...from},to:{...to},...extra});}
  pickup(p:Player){
    const pickup=nearestPickup(p,this.pickups,this.time,this.solids);if(!pickup)return;
    if(p.primary!=='rifle')p.ammo[p.primary]=0;
    p.primary=pickup.weapon;p.weapon=pickup.weapon;p.ammo[p.weapon]=WEAPONS[p.weapon].magazine;p.reloadUntil=0;
    pickup.availableAt=this.time+20000;this.nextShot.set(p.id,this.time+300);
    this.emit('pickup',p,p.weapon,p,p,{target:p.id});
  }
  fire(p:Player){
    const w=WEAPONS[p.weapon];p.ammo[p.weapon]--;this.nextShot.set(p.id,this.time+w.interval);p.protectedUntil=0;
    const from=this.eye(p),dir=direction(p.yaw,p.pitch);let distance=wallDistance(from,dir,this.solids),target:Player|undefined;
    for(const other of this.players.values()){
      if(other.id===p.id||other.hp<=0)continue;
      const t=rayBox(from,dir,{x:other.x-RADIUS,y:other.y,z:other.z-RADIUS},{x:other.x+RADIUS,y:other.y+heightOf(other),z:other.z+RADIUS});
      if(t!==null&&t<distance){distance=t;target=other;}
    }
    const to={x:from.x+dir.x*distance,y:from.y+dir.y*distance,z:from.z+dir.z*distance};
    const hit=target&&target.team!==p.team&&target.protectedUntil<=this.time?target:undefined;
    this.emit('shot',p,p.weapon,from,to,{target:hit?.id});if(hit)this.damage(hit,w.damage,p,p.weapon,from);
  }
  damage(victim:Player,amount:number,attacker:{id:string;team:Team},weapon:Weapon|'grenade',from:Vec3){
    if(this.phase!=='playing'||victim.hp<=0||victim.protectedUntil>this.time||victim.team===attacker.team&&victim.id!==attacker.id)return;
    const dealt=Math.min(victim.hp,Math.max(0,Math.round(amount)));if(!dealt)return;victim.hp-=dealt;
    this.emit('damage',attacker,weapon,from,this.eye(victim),{target:victim.id,damage:dealt,hp:victim.hp});
    if(!victim.hp){
      victim.deaths++;victim.respawnAt=this.time+3000;victim.reloadUntil=0;
      const killer=this.players.get(attacker.id);if(victim.team!==attacker.team){if(killer)killer.kills++;this.scores[attacker.team]++;}
      this.emit('kill',attacker,weapon,from,victim,{target:victim.id,name:killer?.name??'Departed player',victim:victim.name});
      if(this.scores[attacker.team]>=WIN_SCORE)this.finish();
    }
  }
  throwGrenade(p:Player){
    p.grenades--;p.protectedUntil=0;const from=this.eye(p),d=direction(p.yaw,p.pitch);
    const g:Grenade={id:++this.eventId,owner:p.id,team:p.team,...from,vx:d.x*17,vy:d.y*17+4.5,vz:d.z*17,explodeAt:this.time+2200};
    this.grenades.push(g);this.emit('grenade',p,'grenade',from,from);
  }
  private stepGrenades(){
    for(const g of this.grenades){
      // Two fixed substeps bound travel below the thinnest gameplay wall width.
      for(let step=0;step<2;step++){
        g.vy-=16*DT/2;
        for(const [axis,v] of [['x','vx'],['y','vy'],['z','vz']] as const){
          const delta=g[v]*DT/2;g[axis]+=delta;
          for(const b of this.solids){const r=.12;if(g.x+r>b.x-b.w/2&&g.x-r<b.x+b.w/2&&g.y+r>b.y-b.h/2&&g.y-r<b.y+b.h/2&&g.z+r>b.z-b.d/2&&g.z-r<b.z+b.d/2){const half=(axis==='x'?b.w:axis==='y'?b.h:b.d)/2;g[axis]=b[axis]+(delta>0?-half-r:half+r);g[v]*=-.48;}}
        }
        if(g.y<.12){g.y=.12;g.vy=Math.abs(g.vy)*.42;g.vx*=.8;g.vz*=.8;if(g.vy<.4)g.vy=0;}
      }
      if(this.time>=g.explodeAt){
        const source={id:g.owner,team:g.team};this.emit('explosion',source,'grenade',g,g);
        for(const p of this.players.values()){
          const centre={x:p.x,y:p.y+heightOf(p)/2,z:p.z};const dx=centre.x-g.x,dy=centre.y-g.y,dz=centre.z-g.z,d=Math.hypot(dx,dy,dz);
          if(d<8&&(d<.01||wallDistance(g,{x:dx/d,y:dy/d,z:dz/d},this.solids)>=d-.05))this.damage(p,Math.min(110,130*(1-d/8)),source,'grenade',g);
        }
      }
    }
    this.grenades=this.grenades.filter(g=>this.time<g.explodeAt);
  }
  finish(){this.phase='finished';this.winner=this.scores.red===this.scores.blue?'draw':this.scores.red>this.scores.blue?'red':'blue';}
  rematch(){if(this.phase!=='finished')return;this.round++;this.scores={red:0,blue:0};this.phase='playing';this.winner=null;this.endsAt=this.time+ROUND_MS;this.grenades=[];this.pickups=MAPS[this.mapId].pickups.map(p=>({...p}));for(const p of this.players.values()){p.kills=0;p.deaths=0;this.spawn(p);}}
  snapshot():Snapshot{return{mapId:this.mapId,matchId:this.matchId,round:this.round,time:this.time,endsAt:this.endsAt,phase:this.phase,winner:this.winner,scores:{...this.scores},players:[...this.players.values()].map(p=>({...p,ammo:{...p.ammo}})),pickups:this.pickups.map(p=>({...p})),grenades:this.grenades.map(g=>({...g}))};}
}
