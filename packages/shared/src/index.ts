export type Team = 'red' | 'blue';
export type Weapon = 'rifle' | 'pistol' | 'smg' | 'marksman';
export type MapId = 'dunes' | 'relay';
export type Vec3 = { x: number; y: number; z: number };
export const TICK_RATE = 30, DT = 1 / TICK_RATE, SNAPSHOT_RATE = 20;
export const ROUND_MS = 10 * 60 * 1000, WIN_SCORE = 30;
export const HEIGHT = 1.8, EYE = 1.6, CROUCH_HEIGHT = 1.1, CROUCH_EYE = .95, RADIUS = .34;
export const WEAPONS = {
  rifle: { damage: 25, interval: 100, magazine: 30, reload: 1800, label: 'AR-30', automatic: true },
  pistol: { damage: 20, interval: 200, magazine: 12, reload: 1200, label: 'P-12', automatic: false },
  smg: { damage: 17, interval: 1000 / 900, magazine: 40, reload: 1500, label: 'V-40 SMG', automatic: true },
  marksman: { damage: 70, interval: 650, magazine: 8, reload: 2400, label: 'DMR-8', automatic: false },
} as const;
export const weaponLabel = (weapon: Weapon | 'grenade') => weapon === 'grenade' ? 'FRAG' : WEAPONS[weapon].label;
export type Solid = { x: number; y: number; z: number; w: number; h: number; d: number; kind: 'wall' | 'crate' | 'roof' };
const block = (x: number, z: number, w: number, d: number, h = 5, kind: Solid['kind'] = 'wall', y = h / 2): Solid => ({ x, y, z, w, h, d, kind });
// Original "Relay" arena: offset courtyards around a central open route,
// a covered west passage and an eastern switchback. Metres, Y up.
const RELAY_SOLIDS: Solid[] = [
  block(-30,0,1,49,7), block(30,0,1,49,7), block(0,-24,60,1,7), block(0,24,60,1,7),
  block(-17,-14,14,9,6), block(-17,9,14,9,5),
  block(16,-8,13,9,5.5), block(16,15,13,8,6),
  block(-7,-1,4,10,4), block(5,5,4,9,4.6),
  block(-25,-2,8,15,0.8,'roof',3.8), // walkable covered passage
  block(25,3,1,11,3), block(18,5,7,1,2.8),
  block(-2,-15,3,3,2,'crate'), block(7,-18,2.4,2.4,1.7,'crate'),
  block(0,14,3,3,2,'crate'), block(-13,19,2.2,2.2,1.7,'crate'),
  block(12,0,2.4,3,2,'crate'), block(-17,-2,2.2,2.2,2,'crate'),
];
const COMMON_SPAWNS: Record<Team, Vec3[]> = {
  red: [{x:-25,y:0,z:19},{x:-20,y:0,z:19},{x:-26,y:0,z:14},{x:-21,y:0,z:22}],
  blue: [{x:25,y:0,z:-19},{x:20,y:0,z:-19},{x:26,y:0,z:-14},{x:21,y:0,z:-22}],
};
const DUNES_SOLIDS: Solid[] = [
  block(-30,0,1,49,7),block(30,0,1,49,7),block(0,-24,60,1,7),block(0,24,60,1,7),
  // Western tunnel loop, two northern courtyards, central gates and a long eastern lane.
  block(-16,-14,11,9,6),block(-15,10,12,9,6.4),
  block(15,-9,12,11,6),block(14,13,10,12,5.6),
  block(-25,-2,8,15,.8,'roof',3.4),block(-20,-2,2,10,4.4),
  block(-4,0,5,1,3.5),block(4,0,5,1,3.5), // offset central gate; open centre
  block(23,6,1,5,3.4),block(21,8,5,1,3.4),
  block(-12,-1,4,4,1.3,'crate'),block(8,-18,3,3,1.6,'crate'),
  block(7,3,3,2,1.5,'crate'),block(-5,14,3,3,1.7,'crate'),
  block(-24,-18,2.5,2.5,1.4,'crate'),block(24,17,3,3,1.6,'crate'),
];
export interface Pickup extends Vec3 { id:string; weapon:Weapon; availableAt:number; }
export interface MapDefinition {id:MapId;name:string;subtitle:string;description:string;solids:Solid[];spawns:Record<Team,Vec3[]>;pickups:Pickup[];}
const supplies:Pickup[]=[
  {id:'west-smg',x:-25,y:0,z:16,weapon:'smg',availableAt:0},
  {id:'east-smg',x:25,y:0,z:-16,weapon:'smg',availableAt:0},
  {id:'mid-dmr',x:0,y:0,z:-10,weapon:'marksman',availableAt:0},
  {id:'court-dmr',x:0,y:0,z:12,weapon:'marksman',availableAt:0},
];
export const MAPS:Record<MapId,MapDefinition>={
  dunes:{id:'dunes',name:'Dunes',subtitle:'Dust II inspired',description:'Sunlit courtyards, a long eastern lane and a sheltered tunnel flank.',solids:DUNES_SOLIDS,spawns:COMMON_SPAWNS,pickups:supplies},
  relay:{id:'relay',name:'Relay',subtitle:'The original outpost',description:'Offset alleys and tight cover around a contested central route.',solids:RELAY_SOLIDS,spawns:COMMON_SPAWNS,pickups:supplies},
};
export const DEFAULT_MAP:MapId='dunes';
export const validMap = (value:unknown):value is MapId => value==='dunes'||value==='relay';
export const SOLIDS=MAPS[DEFAULT_MAP].solids, SPAWNS=COMMON_SPAWNS;
export interface Input {seq:number;forward:number;strafe:number;yaw:number;pitch:number;jump:boolean;sprint:boolean;fire:boolean;reload:boolean;weapon:Weapon;crouch:boolean;interact:boolean;grenade:boolean;}
export const neutralInput=():Input=>({seq:0,forward:0,strafe:0,yaw:0,pitch:0,jump:false,sprint:false,fire:false,reload:false,weapon:'rifle',crouch:false,interact:false,grenade:false});
export interface Motion extends Vec3 {vy:number;grounded:boolean;crouched?:boolean;}
export interface Player extends Motion {id:string;name:string;team:Team;yaw:number;pitch:number;hp:number;kills:number;deaths:number;weapon:Weapon;primary:Weapon;ammo:Record<Weapon,number>;grenades:number;crouched:boolean;reloadUntil:number;respawnAt:number;protectedUntil:number;connected:boolean;ack:number;}
export interface Grenade extends Vec3 {id:number;owner:string;team:Team;vx:number;vy:number;vz:number;explodeAt:number;}
export interface Snapshot {mapId:MapId;matchId:string;round:number;time:number;endsAt:number;phase:'playing'|'finished';winner:Team|'draw'|null;scores:Record<Team,number>;players:Player[];pickups:Pickup[];grenades:Grenade[];}
export interface CombatEvent {type:'shot'|'kill'|'damage'|'reload'|'pickup'|'grenade'|'explosion';id:number;shooter:string;target?:string;name?:string;victim?:string;team:Team;weapon:Weapon|'grenade';from:Vec3;to:Vec3;damage?:number;hp?:number;}
export function validInput(value:unknown):value is Input {
  if(!value||typeof value!=='object')return false;const i=value as Input;
  return Number.isSafeInteger(i.seq)&&i.seq>=0&&i.seq<2**31&&Number.isFinite(i.forward)&&Math.abs(i.forward)<=1&&Number.isFinite(i.strafe)&&Math.abs(i.strafe)<=1&&Number.isFinite(i.yaw)&&Math.abs(i.yaw)<=Math.PI*2&&Number.isFinite(i.pitch)&&Math.abs(i.pitch)<=1.5&&
    ['jump','sprint','fire','reload'].every(k=>typeof (i as any)[k]==='boolean')&&
    ['crouch','interact','grenade'].every(k=>(i as any)[k]===undefined||typeof (i as any)[k]==='boolean')&&Object.hasOwn(WEAPONS,i.weapon);
}
export const heightOf=(p:{crouched?:boolean})=>p.crouched?CROUCH_HEIGHT:HEIGHT;
export const eyeOf=(p:{crouched?:boolean})=>p.crouched?CROUCH_EYE:EYE;
export function direction(yaw:number,pitch:number):Vec3{return{x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};}
export function intersects(p:Vec3,b:Solid,height=HEIGHT){return p.x+RADIUS>b.x-b.w/2&&p.x-RADIUS<b.x+b.w/2&&p.z+RADIUS>b.z-b.d/2&&p.z-RADIUS<b.z+b.d/2&&p.y+height>b.y-b.h/2+.0001&&p.y<b.y+b.h/2-.0001;}
export function move(p:Motion,i:Input,solids:Solid[]=SOLIDS):Motion {
  const out={...p};out.crouched=!!i.crouch||!!p.crouched&&solids.some(b=>intersects(p,b,HEIGHT));const height=heightOf(out);
  const norm=Math.max(1,Math.hypot(i.forward,i.strafe)),speed=out.crouched?2.5:i.sprint?8:5.5;
  const dx=(-Math.sin(i.yaw)*i.forward+Math.cos(i.yaw)*i.strafe)/norm*speed*DT,dz=(-Math.cos(i.yaw)*i.forward-Math.sin(i.yaw)*i.strafe)/norm*speed*DT;
  for(const [axis,delta] of [['x',dx],['z',dz]] as const){out[axis]+=delta;for(const b of solids)if(intersects(out,b,height)){const half=axis==='x'?b.w/2:b.d/2;if(delta>0)out[axis]=b[axis]-half-RADIUS;if(delta<0)out[axis]=b[axis]+half+RADIUS;}}
  if(i.jump&&out.grounded&&!out.crouched){out.vy=8.4;out.grounded=false;}
  out.vy-=24*DT;const dy=out.vy*DT;out.y+=dy;out.grounded=false;
  for(const b of solids)if(intersects(out,b,height)){if(dy<0){out.y=b.y+b.h/2;out.grounded=true;}else out.y=b.y-b.h/2-height;out.vy=0;}
  if(out.y<=0){out.y=0;out.vy=0;out.grounded=true;}return out;
}
export function rayBox(origin:Vec3,dir:Vec3,min:Vec3,max:Vec3):number|null {
  let lo=0,hi=150;for(const a of ['x','y','z'] as const){if(Math.abs(dir[a])<1e-8){if(origin[a]<min[a]||origin[a]>max[a])return null;continue;}let t1=(min[a]-origin[a])/dir[a],t2=(max[a]-origin[a])/dir[a];if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return null;}return lo;
}
export function wallDistance(origin:Vec3,dir:Vec3,solids:Solid[]=SOLIDS){let nearest=150;for(const b of solids){const t=rayBox(origin,dir,{x:b.x-b.w/2,y:b.y-b.h/2,z:b.z-b.d/2},{x:b.x+b.w/2,y:b.y+b.h/2,z:b.z+b.d/2});if(t!==null)nearest=Math.min(nearest,t);}if(dir.y<0)nearest=Math.min(nearest,-origin.y/dir.y);return nearest;}
export function nearestPickup(p:Vec3,pickups:Pickup[],time:number,solids:Solid[]):Pickup|undefined {
  return pickups.filter(g=>g.availableAt<=time&&Math.hypot(g.x-p.x,g.z-p.z)<1.8&&Math.abs(g.y-p.y)<1).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)).find(g=>{const d={x:g.x-p.x,y:0,z:g.z-p.z},len=Math.hypot(d.x,d.z);return len<.01||wallDistance({x:p.x,y:p.y+.6,z:p.z},{x:d.x/len,y:0,z:d.z/len},solids)>=len-.05;});
}
