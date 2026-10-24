import {randomUUID} from 'node:crypto';
import {DT,RADIUS,SCOUT_TOWER,type AvatarId,sprayTarget,type Spray,BOMB_RULES,plantSite,canReachBomb,footprint,solidTop,intersects,ROUND_MS,WIN_SCORE,MAPS,DEFAULT_MAP,WEAPONS,KNIFE,isGun,direction,move,neutralInput,rayBox,rayPlayer,type HitZone,wallDistance,heightOf,eyeOf,nearestPickup,type Input,type Player,type Snapshot,type CombatEvent,type Solid,type Team,type MapId,type Pickup,type Grenade,type Equipment,type Vec3,type GameMode,type BombState} from '@sirocco/shared';
const freshAmmo=()=>({rifle:30,pistol:12,smg:0,marksman:0});
export class Simulation {
  players=new Map<string,Player>();
  queues=new Map<string,Input[]>();
  private lastSeq=new Map<string,number>();
  private nextShot=new Map<string,number>();
  private trigger=new Map<string,boolean>();
  private actions=new Map<string,{interact:boolean;throwAt:number}>();
  private towerFalls=new Map<string,{height:number}>();
  private eventId=0;
  events:CombatEvent[]=[];
  sprays:Spray[]=[];
  scores={red:0,blue:0};
  time=0;endsAt=ROUND_MS;phase:Snapshot['phase']='playing';winner:Snapshot['winner']=null;
  bombs:BombState[]=[];get bomb(){return this.bombs[0]??null;}outcome='';roundLive=false;
  private bombIntents=new Map<string,{input:Input;at:number}>();
  round=1;readonly matchId=randomUUID();
  readonly mapId:MapId;
  solids:Solid[];pickups:Pickup[];grenades:Grenade[]=[];
  constructor(mapOrSolids:MapId|Solid[]=DEFAULT_MAP,readonly mode:GameMode='deathmatch'){this.mapId=typeof mapOrSolids==='string'?mapOrSolids:'relay';this.solids=typeof mapOrSolids==='string'?MAPS[mapOrSolids].solids:mapOrSolids;this.pickups=MAPS[this.mapId].pickups.map(p=>({...p}));if(mode==='defusal'){if(this.mapId!=='dunes')throw new Error('Bomb Defusal requires Dust III');this.endsAt=0;this.resetBomb();}}
  add(id:string,name:string,avatar:AvatarId='operator'):Player {
    if(this.players.size>=8)throw new Error('Room full (8/8).');
    const red=[...this.players.values()].filter(p=>p.team==='red').length,blue=this.players.size-red;
    const team:Team=red<=blue?'red':'blue';
    const p:Player={id,name,team,avatar,x:0,y:0,z:0,vy:0,grounded:true,crouched:false,yaw:team==='red'?0:Math.PI,pitch:0,hp:100,kills:0,deaths:0,weapon:'rifle',primary:'rifle',ammo:freshAmmo(),grenades:2,reloadUntil:0,respawnAt:0,protectedUntil:0,connected:true,ack:0};
    this.players.set(id,p);this.queues.set(id,[]);this.spawn(p);if(this.mode==='defusal'){if(this.roundLive){p.hp=0;p.respawnAt=0;}else{const bomb=this.bombs.find(b=>b.team===team);if(bomb?.status==='dropped'&&!bomb.carrierId){bomb.status='carried';bomb.carrierId=id;}}}return p;
  }
  remove(id:string){this.towerFalls.delete(id);this.dropBomb(id);this.bombIntents.delete(id);this.players.delete(id);this.queues.delete(id);this.lastSeq.delete(id);this.nextShot.delete(id);this.trigger.delete(id);this.actions.delete(id);}
  input(id:string,i:Input){const prev=this.lastSeq.get(id)??0;if(i.seq<=prev||i.seq-prev>120)return;this.lastSeq.set(id,i.seq);const q=this.queues.get(id);if(!q)return;if(q.length>=8)q.shift();q.push(i);}
  spawn(p:Player){
    this.towerFalls.delete(p.id);
    const others=[...this.players.values()].filter(o=>o.id!==p.id&&o.hp>0);
    const spots=MAPS[this.mapId].spawns[p.team].map(s=>({s,safety:Math.min(...others.map(o=>Math.hypot(o.x-s.x,o.z-s.z)),100)}));spots.sort((a,b)=>b.safety-a.safety);
    Object.assign(p,spots[0].s,{hp:100,vy:0,grounded:true,crouched:false,ammo:freshAmmo(),weapon:'rifle',primary:'rifle',grenades:2,reloadUntil:0,respawnAt:0,protectedUntil:this.time+1500,yaw:p.team==='red'?0:Math.PI,pitch:0});
    this.queues.set(p.id,[]);this.trigger.delete(p.id);this.actions.set(p.id,{interact:false,throwAt:0});this.nextShot.set(p.id,this.time+100);
  }
  step(){
    this.time+=DT*1000;this.events=[];this.sprays=this.sprays.filter(s=>s.expiresAt>this.time);if(this.phase==='finished')return;
    if(this.mode==='defusal'&&!this.roundLive&&['red','blue'].every(team=>[...this.players.values()].some(p=>p.team===team&&p.connected&&p.hp>0)))this.roundLive=true;
    if(this.mode==='deathmatch'&&this.time>=this.endsAt){this.finish();return;}
    for(const p of this.players.values()){
      if(this.winner!==null)break;
      if(p.hp<=0){if((this.mode==='deathmatch'||!this.roundLive)&&this.time>=p.respawnAt)this.spawn(p);continue;}
      if(isGun(p.weapon)&&p.reloadUntil&&this.time>=p.reloadUntil){p.ammo[p.weapon]=WEAPONS[p.weapon].magazine;p.reloadUntil=0;}
      const i=this.queues.get(p.id)?.shift();
      const controls=i&&p.connected?i:{...neutralInput(),yaw:p.yaw,pitch:p.pitch,weapon:p.weapon,crouch:p.crouched};
      const wasGrounded=p.grounded,fromY=p.y;
      // Track departure from the elevated tower, including jumping over a parapet.
      if(wasGrounded){
        this.towerFalls.delete(p.id);
        // Match movement's foot radius: players can stand with their centre beyond
        // a parapet's edge while their feet still overlap its supporting surface.
        const onTower=this.mapId==='dunes'&&fromY>=SCOUT_TOWER.deck-.05&&this.solids.some(b=>b.label?.startsWith('Scout tower')&&footprint(p,b)&&Math.abs(solidTop(b,p)-fromY)<.05);
        if(onTower)this.towerFalls.set(p.id,{height:fromY});
      }
      Object.assign(p,move(p,controls,this.solids));
      const fall=this.towerFalls.get(p.id);
      if(fall){
        if(p.grounded){this.towerFalls.delete(p.id);if(fall.height-p.y>=3)this.damage(p,50,p,p.weapon,p,undefined,'fall');}
        else fall.height=Math.max(fall.height,p.y);
      }
      if(p.hp<=0)continue;
      if(!i||!p.connected)continue;
      this.bombIntents.set(p.id,{input:i,at:this.time});
      p.ack=i.seq;p.yaw=i.yaw;p.pitch=i.pitch;
      if(i.spray){
        const target=sprayTarget(this.eye(p),direction(p.yaw,p.pitch),this.solids);
        if(target){this.sprays.push({id:++this.eventId,owner:p.id,...target,expiresAt:this.time+120000});this.sprays=this.sprays.slice(-24);this.emit('spray',p,p.weapon,this.eye(p),target.position);}
      }
      const ownBomb=this.bombs.find(b=>b.team===p.team),enemyBomb=this.bombs.find(b=>b.team!==p.team);
      if(i.weapon!==p.weapon&&(i.weapon===p.primary||i.weapon==='pistol'||i.weapon==='knife'||i.weapon==='grenade'||i.weapon==='bomb'&&ownBomb?.carrierId===p.id&&ownBomb.status==='carried')){p.weapon=i.weapon;p.reloadUntil=0;this.nextShot.set(p.id,Math.max(this.nextShot.get(p.id)??0,this.time+(isGun(p.weapon)?200:0)));}
      const action=this.actions.get(p.id)!;
      if(i.interact&&!action.interact){if(ownBomb?.status==='dropped'&&canReachBomb(p,ownBomb,this.solids)){ownBomb.status='carried';ownBomb.carrierId=p.id;this.emit('pickup',p,'bomb',p,p);}else if(!(enemyBomb?.status==='planted'&&canReachBomb(p,enemyBomb,this.solids)))this.pickup(p);}
      action.interact=!!i.interact;
      const was=this.trigger.get(p.id)??false;
      if(p.weapon==='bomb'||i.weapon==='bomb'||enemyBomb?.status==='planted'&&i.interact&&canReachBomb(p,enemyBomb,this.solids)){p.reloadUntil=0;this.trigger.set(p.id,i.fire);continue;}
      if(p.weapon==='grenade'){
        if(i.fire&&!was&&this.time>=action.throwAt&&p.grenades>0){this.throwGrenade(p);action.throwAt=this.time+600;}
      }else if(p.weapon==='knife'){
        if(i.fire&&!was&&this.time+.01>=(this.nextShot.get(p.id)??0))this.fire(p);
      }else{
        const w=WEAPONS[p.weapon];
        if(i.reload&&!p.reloadUntil&&p.ammo[p.weapon]<w.magazine){p.reloadUntil=this.time+w.reload;this.emit('reload',p,p.weapon,this.eye(p),this.eye(p));}
        if(i.fire&&(!i.sprint||p.crouched)&&!p.reloadUntil&&p.ammo[p.weapon]>0&&(w.automatic||!was)&&this.time+.01>=(this.nextShot.get(p.id)??0))this.fire(p);
      }
      this.trigger.set(p.id,i.fire);
    }
    if(this.phase==='playing')this.stepGrenades();
    if(this.phase==='playing'&&this.bombs.length)this.stepBomb();
  }
  private eye(p:Player):Vec3{return{x:p.x,y:p.y+eyeOf(p),z:p.z};}
  private emit(type:CombatEvent['type'],p:{id:string;team:Team},weapon:Equipment,from:Vec3,to:Vec3,extra:Partial<CombatEvent>={}){this.events.push({type,id:++this.eventId,shooter:p.id,team:p.team,weapon,from:{...from},to:{...to},...extra});}
  pickup(p:Player){
    const pickup=nearestPickup(p,this.pickups,this.time,this.solids);if(!pickup)return;
    if(p.primary!=='rifle')p.ammo[p.primary]=0;
    p.primary=pickup.weapon;p.weapon=pickup.weapon;p.ammo[p.weapon]=WEAPONS[p.weapon].magazine;p.reloadUntil=0;
    pickup.availableAt=this.time+20000;this.nextShot.set(p.id,this.time+300);
    this.emit('pickup',p,p.weapon,p,p,{target:p.id});
  }
  fire(p:Player){
    if(p.weapon==='grenade'||p.weapon==='bomb')return;const w=p.weapon==='knife'?KNIFE:WEAPONS[p.weapon];if(isGun(p.weapon))p.ammo[p.weapon]--;this.nextShot.set(p.id,this.time+w.interval);p.protectedUntil=0;
    const from=this.eye(p),dir=direction(p.yaw,p.pitch);let distance=Math.min(p.weapon==='knife'?KNIFE.range:150,wallDistance(from,dir,this.solids)),target:Player|undefined,hitZone:HitZone|undefined;
    for(const other of this.players.values()){
      if(other.id===p.id||other.hp<=0)continue;
      const result=p.weapon==='knife'?null:rayPlayer(from,dir,other);
      const t=p.weapon==='knife'?rayBox(from,dir,{x:other.x-RADIUS,y:other.y,z:other.z-RADIUS},{x:other.x+RADIUS,y:other.y+heightOf(other),z:other.z+RADIUS}):result?.distance??null;
      if(t!==null&&t<distance){distance=t;target=other;hitZone=result?.zone;}
    }
    const to={x:from.x+dir.x*distance,y:from.y+dir.y*distance,z:from.z+dir.z*distance};
    const hit=target&&target.team!==p.team&&target.protectedUntil<=this.time?target:undefined;
    this.emit(p.weapon==='knife'?'melee':'shot',p,p.weapon,from,to,{target:hit?.id,hitZone:hit?hitZone:undefined});if(hit)this.damage(hit,hitZone==='head'?hit.hp:w.damage,p,p.weapon,from,hitZone);
  }
  damage(victim:Player,amount:number,attacker:{id:string;team:Team},weapon:Equipment,from:Vec3,hitZone?:HitZone,cause?:CombatEvent['cause']){
    if(this.phase!=='playing'||victim.hp<=0||victim.protectedUntil>this.time&&cause!=='fall'||victim.team===attacker.team&&victim.id!==attacker.id)return;
    const dealt=Math.min(victim.hp,Math.max(0,Math.round(amount)));if(!dealt)return;victim.hp-=dealt;
    this.emit('damage',attacker,weapon,from,this.eye(victim),{target:victim.id,damage:dealt,hp:victim.hp,hitZone,cause});
    if(!victim.hp){
      this.dropBomb(victim.id);victim.deaths++;victim.respawnAt=this.time+3000;victim.reloadUntil=0;
      const killer=this.players.get(attacker.id);if(victim.team!==attacker.team){if(killer)killer.kills++;if(this.mode==='deathmatch')this.scores[attacker.team]++;}
      this.emit('kill',attacker,weapon,from,victim,{target:victim.id,name:killer?.name??'Departed player',victim:victim.name,hitZone,cause});
      if(this.mode==='deathmatch'&&this.scores[attacker.team]>=WIN_SCORE)this.finish();
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
          const delta=g[v]*DT/2,before=g[axis];g[axis]+=delta;
          const blocked=()=>this.solids.some(b=>intersects({x:g.x,y:g.y-.12,z:g.z},b,.24,.12));
          if(blocked()){let lo=0,hi=1;for(let n=0;n<9;n++){const t=(lo+hi)/2;g[axis]=before+delta*t;if(blocked())hi=t;else lo=t;}g[axis]=before+delta*lo;g[v]*=-.48;}
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
  disconnect(id:string){const p=this.players.get(id);if(p)p.connected=false;this.dropBomb(id);this.bombIntents.delete(id);}
  private resetBomb(){
    this.bombs=(['red','blue'] as Team[]).map(team=>{
      const carrier=[...this.players.values()].find(p=>p.team===team&&p.connected&&p.hp>0);
      return {...MAPS[this.mapId].spawns[team][0],team,status:carrier?'carried':'dropped',carrierId:carrier?.id??null,siteId:null,explodeAt:0,action:null};
    });
  }
  private dropBomb(id:string){
    const bomb=this.bombs.find(b=>b.status==='carried'&&b.carrierId===id);if(!bomb)return;
    const p=this.players.get(id);if(p){let y=0;for(const b of this.solids)if(footprint(p,b,0)&&solidTop(b,p)<=p.y+.01)y=Math.max(y,solidTop(b,p));Object.assign(bomb,{x:p.x,y,z:p.z});if(p.weapon==='bomb')p.weapon=p.primary;}
    bomb.status='dropped';bomb.carrierId=null;bomb.action=null;
  }
  private finishBomb(winner:Team|'draw',outcome:string){this.phase='finished';this.winner=winner;this.outcome=outcome;if(winner!=='draw')this.scores[winner]=1;for(const bomb of this.bombs)bomb.action=null;}
  private stepBomb(){
    // Resolve every fuse before actions, independent of team/player order. An
    // exact simultaneous detonation is a draw; a fuse wins a defuse-time tie.
    const due=this.bombs.filter(b=>b.status==='planted'&&this.time+.001>=b.explodeAt).sort((a,b)=>a.explodeAt-b.explodeAt);
    if(due.length){
      const first=due.filter(b=>Math.abs(b.explodeAt-due[0].explodeAt)<.001);
      for(const bomb of first){bomb.status='exploded';this.emit('explosion',{id:`C4-${bomb.team}`,team:bomb.team},'bomb',bomb,bomb);
        for(const p of this.players.values())if(p.hp>0&&Math.hypot(p.x-bomb.x,p.y-bomb.y,p.z-bomb.z)<18){const hp=Math.max(0,p.hp-Math.round(500*(1-Math.hypot(p.x-bomb.x,p.y-bomb.y,p.z-bomb.z)/18)));this.emit('damage',{id:`C4-${bomb.team}`,team:bomb.team},'bomb',bomb,p,{target:p.id,damage:p.hp-hp,hp});if(hp===0)p.deaths++;p.hp=hp;}
      }
      this.finishBomb(first.length>1?'draw':first[0].team,first.length>1?'Both sites detonated simultaneously':`${first[0].team.toUpperCase()} C4 detonated at ${first[0].siteId}`);return;
    }
    for(const bomb of this.bombs){
      const carrier=bomb.carrierId?this.players.get(bomb.carrierId):undefined;
      if(bomb.status==='carried'&&(!carrier||!carrier.connected||carrier.hp<=0))this.dropBomb(bomb.carrierId!);
      if(bomb.status==='carried'&&carrier)Object.assign(bomb,{x:carrier.x,y:carrier.y,z:carrier.z});
      const candidates=[...this.players.values()].filter(p=>{
        const intent=this.bombIntents.get(p.id);if(!intent||this.time-intent.at>150||!p.connected||p.hp<=0||!p.grounded)return false;
        const i=intent.input;if(i.forward||i.strafe||i.jump||i.reload)return false;
        if(bomb.status==='carried')return p.team===bomb.team&&bomb.carrierId===p.id&&p.weapon==='bomb'&&i.weapon==='bomb'&&i.fire&&!!plantSite(p,this.mapId,p.team);
        return bomb.status==='planted'&&p.team!==bomb.team&&i.interact&&!i.fire&&canReachBomb(p,bomb,this.solids);
      });
      const actor=candidates.find(p=>p.id===bomb.action?.playerId)??candidates[0];
      if(!actor)bomb.action=null;
      else{
        const kind=bomb.status==='carried'?'plant':'defuse';
        if(bomb.action?.playerId!==actor.id||bomb.action.kind!==kind){bomb.action={kind,playerId:actor.id,startedAt:this.time,completeAt:this.time+(kind==='plant'?BOMB_RULES.plantMs:BOMB_RULES.defuseMs)};this.emit('bombAction',actor,'bomb',actor,actor);}
        if(this.time+.001>=bomb.action.completeAt){
          if(kind==='plant'){const site=plantSite(actor,this.mapId,actor.team)!;Object.assign(bomb,{status:'planted',carrierId:null,siteId:site.id,x:actor.x,y:actor.y,z:actor.z,explodeAt:this.time+BOMB_RULES.fuseMs,action:null});actor.weapon=actor.primary;this.emit('bombPlant',actor,'bomb',bomb,bomb);}
          else{bomb.status='defused';bomb.action=null;this.emit('bombDefuse',actor,'bomb',bomb,bomb);}
        }
      }
    }
    if(this.bombs.every(b=>b.status==='defused')){this.finishBomb('draw','Both C4 charges defused');return;}
    if(this.roundLive){
      const alive=(team:Team)=>[...this.players.values()].some(p=>p.team===team&&p.hp>0&&p.connected);
      const red=alive('red'),blue=alive('blue');
      if(!red&&!blue&&!this.bombs.some(b=>b.status==='planted'))this.finishBomb('draw','Both teams eliminated');
      else if(!red&&blue&&!this.bombs.some(b=>b.team==='red'&&b.status==='planted'))this.finishBomb('blue','RED eliminated');
      else if(!blue&&red&&!this.bombs.some(b=>b.team==='blue'&&b.status==='planted'))this.finishBomb('red','BLUE eliminated');
    }
  }
  finish(){this.phase='finished';this.winner=this.scores.red===this.scores.blue?'draw':this.scores.red>this.scores.blue?'red':'blue';}
  rematch(){if(this.phase!=='finished')return;this.round++;this.sprays=[];this.scores={red:0,blue:0};this.phase='playing';this.winner=null;this.endsAt=this.mode==='defusal'?0:this.time+ROUND_MS;this.roundLive=false;this.outcome='';this.bombIntents.clear();this.grenades=[];this.pickups=MAPS[this.mapId].pickups.map(p=>({...p}));for(const p of this.players.values()){p.kills=0;p.deaths=0;this.spawn(p);}if(this.mode==='defusal')this.resetBomb();}
  snapshot():Snapshot{return{sprays:this.sprays.map(s=>({...s,position:{...s.position},normal:{...s.normal},ray:s.ray?{origin:{...s.ray.origin},direction:{...s.ray.direction}}:undefined})),mode:this.mode,roundLive:this.roundLive,outcome:this.outcome,bomb:this.bomb?{...this.bomb,action:this.bomb.action?{...this.bomb.action}:null}:null,bombs:this.bombs.map(b=>({...b,action:b.action?{...b.action}:null})),mapId:this.mapId,matchId:this.matchId,round:this.round,time:this.time,endsAt:this.endsAt,phase:this.phase,winner:this.winner,scores:{...this.scores},players:[...this.players.values()].map(p=>({...p,ammo:{...p.ammo}})),pickups:this.pickups.map(p=>({...p})),grenades:this.grenades.map(g=>({...g}))};}
}
