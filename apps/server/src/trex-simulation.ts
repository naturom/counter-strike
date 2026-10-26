import {DT,TREX_RULES,heightOf,wallDistance,type MapDefinition,type Solid,type Player,type Vec3,type Trex} from '@sirocco/shared';
import {TrexNavigation} from './trex-navigation';
type Brain={route:Vec3[];repathAt:number;attackReady:number;struck:boolean;roarAt:number;roam:number};
export class TrexSimulation {
 creatures:Trex[]=[];private brains=new Map<string,Brain>();private serial=0;private navigation?:TrexNavigation;
 constructor(private map:MapDefinition,private solids:()=>Solid[]){}
 private nav(){const solids=this.solids();if(this.navigation?.solids!==solids)this.navigation=new TrexNavigation(solids,this.map);return this.navigation!;}
 clear(){this.creatures=[];this.brains.clear();}
 summon(player:Player,time:number,players:Player[]){if(player.hp<=0||!player.connected||this.creatures.length>=TREX_RULES.limit)return;
  const point=this.nav().spawn(player,player.yaw,[...this.creatures,...players.filter(p=>p.hp>0)]);if(!point)return;
  const trex:Trex={id:`trex-${++this.serial}`,...point,hp:TREX_RULES.hp,yaw:player.yaw+Math.PI,state:'roam',targetId:null,attackAt:0,deadAt:0};this.creatures.push(trex);this.brains.set(trex.id,{route:[],repathAt:0,attackReady:time+800,struck:false,roarAt:time+9000,roam:0});return trex;
 }
 step(time:number,players:Player[],bite:(victim:Player,trex:Trex)=>void,roar:(trex:Trex)=>void){
  this.creatures=this.creatures.filter(t=>{if(t.hp>0||time-t.deadAt<TREX_RULES.corpseMs)return true;this.brains.delete(t.id);return false;});
  if(!this.creatures.some(t=>t.hp>0))return;const nav=this.nav();
  for(const trex of this.creatures){if(trex.hp<=0)continue;const brain=this.brains.get(trex.id)!;
   const candidates=players.filter(p=>p.hp>0&&p.connected&&Math.abs(p.y-trex.y)<4.5&&Math.hypot(p.x-trex.x,p.z-trex.z)<TREX_RULES.sight).sort((a,b)=>Math.hypot(a.x-trex.x,a.z-trex.z)-Math.hypot(b.x-trex.x,b.z-trex.z));
   const target=candidates[0];if(trex.targetId!==target?.id){brain.repathAt=0;trex.targetId=target?.id??null;}
   if(trex.state==='attack'&&time<trex.attackAt+720){if(!brain.struck&&time>=trex.attackAt+TREX_RULES.windup){brain.struck=true;const victim=players.find(p=>p.id===trex.targetId);if(victim&&this.canBite(trex,victim))bite(victim,trex);}continue;}
   trex.state=target?'hunt':'roam';
   if(target){const dx=target.x-trex.x,dz=target.z-trex.z,wanted=Math.atan2(-dx,-dz);if(this.canBite(trex,target)){trex.yaw=this.turn(trex.yaw,wanted,DT*4);if(time>=brain.attackReady&&Math.abs(Math.atan2(Math.sin(wanted-trex.yaw),Math.cos(wanted-trex.yaw)))<.8){trex.state='attack';trex.attackAt=time;brain.attackReady=time+TREX_RULES.biteInterval;brain.struck=false;roar(trex);}continue;}}
   if(time>=brain.repathAt){brain.repathAt=time+(target?1000:3500);
    if(target)brain.route=nav.path(trex,target);
    if(!brain.route.length){const angle=(++brain.roam*2.399+Number(trex.id.slice(5))*.7),distance=7+brain.roam%7,goal=nav.point(trex.x+Math.sin(angle)*distance,trex.z+Math.cos(angle)*distance);if(goal)brain.route=nav.path(trex,goal);}
   }
   if(time>=brain.roarAt&&target){brain.roarAt=time+10000;roar(trex);}
   while(brain.route.length&&Math.hypot(brain.route[0].x-trex.x,brain.route[0].z-trex.z)<.3)brain.route.shift();const next=brain.route[0];if(!next)continue;
   const dx=next.x-trex.x,dz=next.z-trex.z,distance=Math.hypot(dx,dz),wanted=Math.atan2(-dx,-dz);trex.yaw=this.turn(trex.yaw,wanted,DT*3);
   const angle=Math.atan2(Math.sin(wanted-trex.yaw),Math.cos(wanted-trex.yaw)),speed=(target?TREX_RULES.huntSpeed:TREX_RULES.walkSpeed)*Math.max(0,Math.cos(angle)),step=Math.min(distance,speed*DT),point=nav.point(trex.x+dx/distance*step,trex.z+dz/distance*step);
   if(point&&Math.abs(point.y-trex.y)<.65&&!this.creatures.some(other=>other!==trex&&other.hp>0&&Math.hypot(other.x-point.x,other.z-point.z)<TREX_RULES.radius*2+.1))Object.assign(trex,point);else{brain.route=[];brain.repathAt=time+300;}
  }
 }
 canBite(trex:Trex,p:Player){if(p.hp<=0||!p.connected||Math.hypot(p.x-trex.x,p.z-trex.z)>TREX_RULES.biteRange||Math.abs(p.y-trex.y)>2.8)return false;
  const origin={x:trex.x,y:trex.y+1.4,z:trex.z},d={x:p.x-origin.x,y:p.y+heightOf(p)/2-origin.y,z:p.z-origin.z},length=Math.hypot(d.x,d.y,d.z);return length<.01||wallDistance(origin,{x:d.x/length,y:d.y/length,z:d.z/length},this.solids())>=length-.05;
 }
 private turn(current:number,target:number,max:number){const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));return current+Math.max(-max,Math.min(max,delta));}
}
