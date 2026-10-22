import {DUST2} from './dust2';
export {DUST2,dustPoint,DUST_SCALE} from './dust2';
export type Team = 'red' | 'blue';
export type Weapon = 'rifle' | 'pistol' | 'smg' | 'marksman';
export type Equipment = Weapon | 'knife' | 'grenade';
export const KNIFE = {damage:40,range:1.8,interval:500} as const;
export const isGun = (weapon:Equipment):weapon is Weapon => weapon!=='knife'&&weapon!=='grenade';
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
export const weaponLabel = (weapon: Equipment) => weapon === 'knife' ? 'KNIFE' : weapon === 'grenade' ? 'FRAG' : WEAPONS[weapon].label;
export type Solid = { x: number; y: number; z: number; w: number; h: number; d: number; kind: 'wall' | 'crate' | 'roof' | 'floor'; polygon?: [number,number][]; ramp?: {axis:'x'|'z';from:number;to:number}; style?: 'plaster'|'kasbah'|'stone'|'road'|'tile'|'door'|'metal'; label?:string };
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
export interface Pickup extends Vec3 { id:string; weapon:Weapon; availableAt:number; }
export interface MapDefinition {id:MapId;name:string;subtitle:string;description:string;solids:Solid[];spawns:Record<Team,Vec3[]>;pickups:Pickup[];bounds?:{minX:number;maxX:number;minZ:number;maxZ:number};landmarks?:{name:string;x:number;z:number}[];}
const supplies:Pickup[]=[
  {id:'west-smg',x:-25,y:0,z:16,weapon:'smg',availableAt:0},
  {id:'east-smg',x:25,y:0,z:-16,weapon:'smg',availableAt:0},
  {id:'mid-dmr',x:0,y:0,z:-10,weapon:'marksman',availableAt:0},
  {id:'court-dmr',x:0,y:0,z:12,weapon:'marksman',availableAt:0},
];
export const MAPS:Record<MapId,MapDefinition>={
  dunes:DUST2,
  relay:{id:'relay',name:'Relay',subtitle:'The original outpost',description:'Offset alleys and tight cover around a contested central route.',solids:RELAY_SOLIDS,spawns:COMMON_SPAWNS,pickups:supplies},
};
export const DEFAULT_MAP:MapId='dunes';
export const validMap = (value:unknown):value is MapId => value==='dunes'||value==='relay';
export const SOLIDS=MAPS[DEFAULT_MAP].solids, SPAWNS=MAPS[DEFAULT_MAP].spawns;
export interface Input {seq:number;forward:number;strafe:number;yaw:number;pitch:number;jump:boolean;sprint:boolean;fire:boolean;reload:boolean;weapon:Equipment;crouch:boolean;interact:boolean;}
export const neutralInput=():Input=>({seq:0,forward:0,strafe:0,yaw:0,pitch:0,jump:false,sprint:false,fire:false,reload:false,weapon:'rifle',crouch:false,interact:false});
export interface Motion extends Vec3 {vy:number;grounded:boolean;crouched?:boolean;}
export interface Player extends Motion {id:string;name:string;team:Team;yaw:number;pitch:number;hp:number;kills:number;deaths:number;weapon:Equipment;primary:Weapon;ammo:Record<Weapon,number>;grenades:number;crouched:boolean;reloadUntil:number;respawnAt:number;protectedUntil:number;connected:boolean;ack:number;}
export interface Grenade extends Vec3 {id:number;owner:string;team:Team;vx:number;vy:number;vz:number;explodeAt:number;}
export interface Snapshot {mapId:MapId;matchId:string;round:number;time:number;endsAt:number;phase:'playing'|'finished';winner:Team|'draw'|null;scores:Record<Team,number>;players:Player[];pickups:Pickup[];grenades:Grenade[];}
export interface CombatEvent {type:'shot'|'melee'|'kill'|'damage'|'reload'|'pickup'|'grenade'|'explosion';id:number;shooter:string;target?:string;name?:string;victim?:string;team:Team;weapon:Equipment;from:Vec3;to:Vec3;damage?:number;hp?:number;}
export function validInput(value:unknown):value is Input {
  if(!value||typeof value!=='object')return false;const i=value as Input;
  return Number.isSafeInteger(i.seq)&&i.seq>=0&&i.seq<2**31&&Number.isFinite(i.forward)&&Math.abs(i.forward)<=1&&Number.isFinite(i.strafe)&&Math.abs(i.strafe)<=1&&Number.isFinite(i.yaw)&&Math.abs(i.yaw)<=Math.PI*2&&Number.isFinite(i.pitch)&&Math.abs(i.pitch)<=1.5&&
    ['jump','sprint','fire','reload'].every(k=>typeof (i as any)[k]==='boolean')&&
    ['crouch','interact'].every(k=>(i as any)[k]===undefined||typeof (i as any)[k]==='boolean')&&(i.weapon==='knife'||i.weapon==='grenade'||Object.hasOwn(WEAPONS,i.weapon));
}
export const heightOf=(p:{crouched?:boolean})=>p.crouched?CROUCH_HEIGHT:HEIGHT;
export const eyeOf=(p:{crouched?:boolean})=>p.crouched?CROUCH_EYE:EYE;
export function direction(yaw:number,pitch:number):Vec3{return{x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};}
/** Circle/footprint test supports the hand-authored concave building outlines. */
export function footprint(p:{x:number;z:number},b:Solid,r=RADIUS):boolean {
  if(p.x+r<=b.x-b.w/2||p.x-r>=b.x+b.w/2||p.z+r<=b.z-b.d/2||p.z-r>=b.z+b.d/2)return false;
  if(!b.polygon)return true;
  let inside=false;const pts=b.polygon;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const [ax,az]=pts[j],[bx,bz]=pts[i];
    if((az>p.z)!==(bz>p.z)&&p.x<(bx-ax)*(p.z-az)/(bz-az)+ax)inside=!inside;
    const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((p.x-ax)*dx+(p.z-az)*dz)/(dx*dx+dz*dz)));
    if(r>0&&(p.x-ax-t*dx)**2+(p.z-az-t*dz)**2<r*r)return true;
  }
  return inside;
}
export function solidTop(b:Solid,p:{x:number;z:number}){
  if(!b.ramp)return b.y+b.h/2;
  const size=b.ramp.axis==='x'?b.w:b.d;
  const t=Math.max(0,Math.min(1,(p[b.ramp.axis]-b[b.ramp.axis]+size/2)/size));
  return b.ramp.from+(b.ramp.to-b.ramp.from)*t;
}
export function intersects(p:Vec3,b:Solid,height=HEIGHT,radius=RADIUS){return footprint(p,b,radius)&&p.y+height>b.y-b.h/2+.0001&&p.y<solidTop(b,p)-.0001;}
export function groundAt(p:{x:number;z:number},solids:Solid[]=SOLIDS,ceiling=Infinity){
  let y=0;for(const b of solids)if(b.kind==='floor'&&footprint(p,b,.001)){const h=solidTop(b,p);if(h<=ceiling)y=Math.max(y,h);}return y;
}
export function move(p:Motion,i:Input,solids:Solid[]=SOLIDS):Motion {
  const out={...p};out.crouched=!!i.crouch||!!p.crouched&&solids.some(b=>intersects(p,b,HEIGHT));const height=heightOf(out);
  const norm=Math.max(1,Math.hypot(i.forward,i.strafe)),speed=out.crouched?2.5:i.sprint?8:5.5;
  const dx=(-Math.sin(i.yaw)*i.forward+Math.cos(i.yaw)*i.strafe)/norm*speed*DT,dz=(-Math.cos(i.yaw)*i.forward-Math.sin(i.yaw)*i.strafe)/norm*speed*DT;
  const blocked=(point:Vec3)=>solids.some(b=>intersects(point,b,height));
  for(const [axis,delta] of [['x',dx],['z',dz]] as const){
    if(!delta)continue;const before=out[axis],oldY=out.y;out[axis]+=delta;
    // Step climbing is bounded and requires full head clearance. Both prediction
    // and server use the same surface function, including continuous ramps.
    if(p.grounded&&!i.jump){let step=out.y;for(const b of solids)if(footprint(out,b)&&solidTop(b,out)<=oldY+.36)step=Math.max(step,solidTop(b,out));out.y=step;}
    if(blocked(out)){
      out.y=oldY;let lo=0,hi=1;
      for(let n=0;n<10;n++){const t=(lo+hi)/2;out[axis]=before+delta*t;if(blocked(out))hi=t;else lo=t;}
      out[axis]=before+delta*lo;
    }
  }
  if(i.jump&&out.grounded&&!out.crouched){out.vy=8.4;out.grounded=false;}
  const oldY=out.y;out.vy-=24*DT;const dy=out.vy*DT;out.y+=dy;out.grounded=false;
  // Resolve all intersecting surfaces together, independent of declaration order.
  let landing=0,ceiling=Infinity;
  for(const b of solids)if(footprint(out,b)){
    const top=solidTop(b,out),bottom=b.y-b.h/2;
    if(dy<=0&&top<=oldY+.001&&top>=out.y-.001)landing=Math.max(landing,top);
    if(dy>0&&bottom>=oldY+height-.001&&bottom<=out.y+height)ceiling=Math.min(ceiling,bottom-height);
  }
  if(out.y<=landing){out.y=landing;out.vy=0;out.grounded=true;}
  if(out.y>ceiling){out.y=ceiling;out.vy=0;}
  // Keep feet on descending ramps without oscillating between grounded/airborne.
  if(p.grounded&&!i.jump&&out.vy<=0){const floor=groundAt(out,solids,oldY+.001);if(out.y-floor>=0&&out.y-floor<.36){out.y=floor;out.vy=0;out.grounded=true;}}
  return out;
}
export function rayBox(origin:Vec3,dir:Vec3,min:Vec3,max:Vec3):number|null {
  let lo=0,hi=150;for(const a of ['x','y','z'] as const){if(Math.abs(dir[a])<1e-8){if(origin[a]<min[a]||origin[a]>max[a])return null;continue;}let t1=(min[a]-origin[a])/dir[a],t2=(max[a]-origin[a])/dir[a];if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return null;}return lo;
}
/** Exact ray intersections for extruded polygons and ramp top planes. */
export function raySolid(origin:Vec3,dir:Vec3,b:Solid):number|null {
  const min={x:b.x-b.w/2,y:b.y-b.h/2,z:b.z-b.d/2},max={x:b.x+b.w/2,y:b.y+b.h/2,z:b.z+b.d/2};
  const broad=rayBox(origin,dir,min,max);if(broad===null)return null;if(!b.polygon&&!b.ramp)return broad;
  const candidates:number[]=[broad];
  if(Math.abs(dir.y)>1e-8){candidates.push((min.y-origin.y)/dir.y);if(!b.ramp)candidates.push((max.y-origin.y)/dir.y);}
  if(b.ramp){const axis=b.ramp.axis,size=axis==='x'?b.w:b.d,slope=(b.ramp.to-b.ramp.from)/size;
    const denom=dir.y-slope*dir[axis];if(Math.abs(denom)>1e-8)candidates.push((b.ramp.from+slope*(origin[axis]-min[axis])-origin.y)/denom);
  }
  const points=b.polygon??[[min.x,min.z],[max.x,min.z],[max.x,max.z],[min.x,max.z]];
  for(let i=0;i<points.length;i++){const a=points[i],c=points[(i+1)%points.length],ex=c[0]-a[0],ez=c[1]-a[1],cross=dir.x*ez-dir.z*ex;if(Math.abs(cross)<1e-8)continue;
    const ax=a[0]-origin.x,az=a[1]-origin.z,t=(ax*ez-az*ex)/cross,u=(ax*dir.z-az*dir.x)/cross;if(u>=0&&u<=1)candidates.push(t);
  }
  candidates.sort((a,c)=>a-c);
  for(const t of candidates)if(t>=0&&t<=150){const q={x:origin.x+dir.x*(t+1e-5),y:origin.y+dir.y*(t+1e-5),z:origin.z+dir.z*(t+1e-5)};if(footprint(q,b,.00001)&&q.y>=min.y-.0001&&q.y<=solidTop(b,q)+.0001)return t;}
  return null;
}
export function wallDistance(origin:Vec3,dir:Vec3,solids:Solid[]=SOLIDS){let nearest=150;for(const b of solids){const t=raySolid(origin,dir,b);if(t!==null)nearest=Math.min(nearest,t);}if(dir.y<0)nearest=Math.min(nearest,-origin.y/dir.y);return nearest;}
export function nearestPickup(p:Vec3,pickups:Pickup[],time:number,solids:Solid[]):Pickup|undefined {
  return pickups.filter(g=>g.availableAt<=time&&Math.hypot(g.x-p.x,g.z-p.z)<1.8&&Math.abs(g.y-p.y)<1).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)).find(g=>{const d={x:g.x-p.x,y:0,z:g.z-p.z},len=Math.hypot(d.x,d.z);return len<.01||wallDistance({x:p.x,y:p.y+.6,z:p.z},{x:d.x/len,y:0,z:d.z/len},solids)>=len-.05;});
}
