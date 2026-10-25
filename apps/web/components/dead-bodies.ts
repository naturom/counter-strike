import * as THREE from 'three';
import {footprint,solidTop,wallDistance,type Player,type Solid} from '@sirocco/shared';
import {poseAvatarBody} from './avatar-body-pose';
import {poseWonderWomanSkirt} from './wonder-woman-skirt';
import {animateHands} from './held-equipment';

const indices=new WeakMap<THREE.BufferGeometry,number[]>();
/** Ignore hidden equipment and unused vertices in imported mesh buffers. */
export function visibleMinimumY(model:THREE.Object3D){
 let min=Infinity;const v=new THREE.Vector3();model.updateWorldMatrix(true,true);
 model.traverseVisible(o=>{if(!(o instanceof THREE.Mesh))return;const geometry:THREE.BufferGeometry=o.geometry,p=geometry.attributes.position;if(!p)return;
  let ids=indices.get(geometry);if(!ids){ids=geometry.index?[...new Set(Array.from(geometry.index.array))]:Array.from({length:p.count},(_,i)=>i);indices.set(geometry,ids);}
  for(const i of ids){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);min=Math.min(min,v.y);}
 });return Number.isFinite(min)?min:0;
}
type BodyState={at:number;direction:THREE.Vector3;floor:number;settled:boolean;center:THREE.Vector3;cameraStart?:THREE.Vector3;cameraRotation?:THREE.Quaternion};
export class DeadBodies {
 private states=new Map<string,BodyState>();
 clear(){this.states.clear();}
 remove(id:string){return this.states.delete(id);}
 has(id:string){return this.states.has(id);}
 pose(model:THREE.Group,p:Player,time:number,solids:Solid[]){
  if(!p.death)return;let state=this.states.get(p.id);
  if(!state||state.at!==p.death.at){
   const away=new THREE.Vector3(p.x-p.death.from.x,0,p.z-p.death.from.z);if(away.lengthSq()<.001)away.set(Math.sin(p.yaw),0,Math.cos(p.yaw));away.normalize();
   let direction=away.clone(),best=-Infinity;
   for(let i=0;i<8;i++){const candidate=away.clone().applyAxisAngle(new THREE.Vector3(0,1,0),i*Math.PI/4),clearance=wallDistance({x:p.x,y:p.y+.35,z:p.z},candidate,solids),score=Math.min(clearance,2.1)+candidate.dot(away)*.25;if(score>best){best=score;direction=candidate;}}
   // Stay on the actual floor/platform beneath the player's feet. Airborne
   // deaths continue falling under gravity instead of freezing in the sky.
   let floor=0;for(const solid of solids)if(footprint(p,solid,0)){const top=solidTop(solid,p);if(top<=p.y+.08)floor=Math.max(floor,top);}
   state={at:p.death.at,direction,floor,settled:false,center:new THREE.Vector3()};this.states.set(p.id,state);
  }
  if(state.settled)return state;
  const elapsed=Math.max(0,(time-state.at)/1000),progress=THREE.MathUtils.clamp(elapsed/.85,0,1),fall=progress*progress*(3-2*progress);
  const crouch=THREE.MathUtils.lerp(p.death.crouched?1:0,.36,THREE.MathUtils.smoothstep(elapsed,0,.22))*(1-.9*THREE.MathUtils.smoothstep(elapsed,.3,.85));
  model.position.set(0,0,0);model.quaternion.identity();
  poseAvatarBody(model,{crouch,air:0,landing:0,vy:0,grounded:true},0,0);poseWonderWomanSkirt(model);
  const held=model.getObjectByName('equippedWeapon') as THREE.Group|undefined;
  if(held){held.userData.motionOffset?.set(0,0,0);held.userData.motionRotation?.identity();animateHands(held,p.weapon,{reload:0,plant:0,throwProgress:0,slash:1,death:THREE.MathUtils.smoothstep(progress,0,.65)});}
  const axis=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),state.direction).normalize();
  model.quaternion.setFromAxisAngle(axis,fall*Math.PI/2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw));
  const min=visibleMinimumY(model),freeY=p.y+p.death.vy*elapsed-9*elapsed*elapsed;
  model.position.set(p.x,Math.max(state.floor-min+.012,freeY),p.z);
  state.center.copy(model.position).addScaledVector(state.direction,.65*fall).y=Math.max(state.floor+.28,model.position.y+.65*(1-fall));
  state.settled=progress>=1&&freeY<=state.floor-min+.012;
  model.updateWorldMatrix(true,true);return state;
 }
 camera(camera:THREE.PerspectiveCamera,p:Player,time:number,solids:Solid[]){
  const state=this.states.get(p.id);if(!state||!p.death)return;
  if(!state.cameraStart){state.cameraStart=camera.position.clone();state.cameraRotation=camera.quaternion.clone();}
  const focus=state.center,offset=state.direction.clone().multiplyScalar(-2.25).add(new THREE.Vector3(0,1.65,0)),distance=offset.length(),direction=offset.normalize();
  const clear=Math.max(.18,Math.min(distance,wallDistance(focus,direction,solids)-.18)),target=focus.clone().addScaledVector(direction,clear),blend=THREE.MathUtils.smoothstep((time-state.at)/1000,0,.7);
  camera.position.copy(state.cameraStart).lerp(target,blend);camera.lookAt(focus);const rotation=camera.quaternion.clone();camera.quaternion.copy(state.cameraRotation!).slerp(rotation,blend);
 }
}
