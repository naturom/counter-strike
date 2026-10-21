export type Team = 'red' | 'blue';
export type Weapon = 'rifle' | 'pistol';
export type Vec3 = { x: number; y: number; z: number };
export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_RATE = 20;
export const ROUND_MS = 10 * 60 * 1000;
export const WIN_SCORE = 30;
export const HEIGHT = 1.8;
export const EYE = 1.6;
export const RADIUS = 0.34;
export const WEAPONS = {
  rifle: { damage: 25, interval: 100, magazine: 30, reload: 1800, label: 'AR-30' },
  pistol: { damage: 20, interval: 200, magazine: 12, reload: 1200, label: 'P-12' },
} as const;
export type Solid = { x: number; y: number; z: number; w: number; h: number; d: number; kind: 'wall' | 'crate' | 'roof' };
const block = (x: number, z: number, w: number, d: number, h = 5, kind: Solid['kind'] = 'wall', y = h / 2): Solid => ({ x, y, z, w, h, d, kind });
// Original "Relay" arena: offset courtyards around a central open route,
// a covered west passage and an eastern switchback. Metres, Y up.
export const SOLIDS: Solid[] = [
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
export const SPAWNS: Record<Team, Vec3[]> = {
  red: [{x:-25,y:0,z:19},{x:-20,y:0,z:19},{x:-26,y:0,z:14},{x:-21,y:0,z:22}],
  blue: [{x:25,y:0,z:-19},{x:20,y:0,z:-19},{x:26,y:0,z:-14},{x:21,y:0,z:-22}],
};
export interface Input { seq: number; forward: number; strafe: number; yaw: number; pitch: number; jump: boolean; sprint: boolean; fire: boolean; reload: boolean; weapon: Weapon; }
export const neutralInput = (): Input => ({seq:0,forward:0,strafe:0,yaw:0,pitch:0,jump:false,sprint:false,fire:false,reload:false,weapon:'rifle'});
export interface Motion extends Vec3 { vy: number; grounded: boolean; }
export interface Player extends Motion { id:string; name:string; team:Team; yaw:number; pitch:number; hp:number; kills:number; deaths:number; weapon:Weapon; ammo:Record<Weapon,number>; reloadUntil:number; respawnAt:number; protectedUntil:number; connected:boolean; ack:number; }
export interface Snapshot { matchId:string; round:number; time:number; endsAt:number; phase:'playing'|'finished'; winner:Team|'draw'|null; scores:Record<Team,number>; players:Player[]; }
export interface CombatEvent { type:'shot'|'kill'; id:number; shooter:string; target?:string; name?:string; victim?:string; team:Team; weapon:Weapon; from:Vec3; to:Vec3; }
export function validInput(value: unknown): value is Input {
  if (!value || typeof value !== 'object') return false;
  const i = value as Input;
  return Number.isSafeInteger(i.seq) && i.seq >= 0 && i.seq < 2 ** 31 &&
    Number.isFinite(i.forward) && Math.abs(i.forward) <= 1 && Number.isFinite(i.strafe) && Math.abs(i.strafe) <= 1 &&
    Number.isFinite(i.yaw) && Math.abs(i.yaw) <= Math.PI * 2 && Number.isFinite(i.pitch) && Math.abs(i.pitch) <= 1.5 &&
    ['jump','sprint','fire','reload'].every(k => typeof (i as any)[k] === 'boolean') && (i.weapon === 'rifle' || i.weapon === 'pistol');
}
export function direction(yaw:number,pitch:number):Vec3 { return {x:-Math.sin(yaw)*Math.cos(pitch), y:Math.sin(pitch), z:-Math.cos(yaw)*Math.cos(pitch)}; }
export function intersects(p:Vec3, b:Solid) { return p.x+RADIUS>b.x-b.w/2 && p.x-RADIUS<b.x+b.w/2 && p.z+RADIUS>b.z-b.d/2 && p.z-RADIUS<b.z+b.d/2 && p.y+HEIGHT>b.y-b.h/2+0.0001 && p.y<b.y+b.h/2-0.0001; }
// Shared deterministic, fixed-step kinematic solver; never accepts a client position or dt.
export function move(p:Motion, i:Input, solids:Solid[]=SOLIDS):Motion {
  const out={...p};
  const norm=Math.max(1,Math.hypot(i.forward,i.strafe));
  const speed=i.sprint ? 8 : 5.5;
  const dx=(-Math.sin(i.yaw)*i.forward+Math.cos(i.yaw)*i.strafe)/norm*speed*DT;
  const dz=(-Math.cos(i.yaw)*i.forward-Math.sin(i.yaw)*i.strafe)/norm*speed*DT;
  for (const [axis,delta] of [['x',dx],['z',dz]] as const) {
    out[axis]+=delta;
    for (const b of solids) if (intersects(out,b)) {
      const half=axis==='x'?b.w/2:b.d/2;
      if (delta>0) out[axis]=b[axis]-half-RADIUS;
      if (delta<0) out[axis]=b[axis]+half+RADIUS;
    }
  }
  if (i.jump && out.grounded) {out.vy=8.4;out.grounded=false;}
  out.vy-=24*DT;
  const dy=out.vy*DT; out.y+=dy;out.grounded=false;
  for(const b of solids) if(intersects(out,b)) {
    if(dy<0) {out.y=b.y+b.h/2;out.grounded=true;} else out.y=b.y-b.h/2-HEIGHT;
    out.vy=0;
  }
  if(out.y<=0) {out.y=0;out.vy=0;out.grounded=true;}
  return out;
}
export function rayBox(origin:Vec3, dir:Vec3, min:Vec3, max:Vec3): number | null {
  let lo=0,hi=150;
  for(const a of ['x','y','z'] as const) {
    if(Math.abs(dir[a])<1e-8) {if(origin[a]<min[a] || origin[a]>max[a]) return null;continue;}
    let t1=(min[a]-origin[a])/dir[a],t2=(max[a]-origin[a])/dir[a];
    if(t1>t2) [t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return null;
  }
  return lo;
}
export function wallDistance(origin:Vec3,dir:Vec3,solids:Solid[]=SOLIDS) {
  let nearest=150;
  for(const b of solids) {const t=rayBox(origin,dir,{x:b.x-b.w/2,y:b.y-b.h/2,z:b.z-b.d/2},{x:b.x+b.w/2,y:b.y+b.h/2,z:b.z+b.d/2}); if(t!==null)nearest=Math.min(nearest,t);}
  if(dir.y<0)nearest=Math.min(nearest,-origin.y/dir.y);
  return nearest;
}
