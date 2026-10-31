import * as THREE from 'three';
import {GRENADE_THROW,type Grenade,type GrenadeThrow,type Vec3} from '@sirocco/shared';
export function grenadeLeavesHand(grenade:Grenade,action:GrenadeThrow|undefined,time:number){
 const releasedAt=grenade.explodeAt-GRENADE_THROW.fuseMs;
 return !!action?.released&&time>=releasedAt&&time-releasedAt<150&&Math.abs(releasedAt-action.startedAt-GRENADE_THROW.releaseMs)<40;
}
/** A brief render-only handoff joins the viewmodel FOV to the authoritative
 * world trajectory. New grenades never interpolate from the map origin. */
export function animateGrenadeFlight(mesh:THREE.Object3D,position:Vec3,dt:number,now:number,hand?:THREE.Vector3){
 const target=new THREE.Vector3(position.x,position.y,position.z);
 if(!mesh.userData.grenadeFlight){mesh.userData.grenadeFlight={at:now,offset:hand?.clone().sub(target)};mesh.position.copy(hand??target);}
 else{
  const {at,offset}=mesh.userData.grenadeFlight as {at:number;offset?:THREE.Vector3};
  if(offset)target.addScaledVector(offset,1-THREE.MathUtils.smoothstep(now-at,0,150));
  mesh.position.lerp(target,Math.min(1,dt*25));
 }
 mesh.rotation.z+=dt*7;
}
