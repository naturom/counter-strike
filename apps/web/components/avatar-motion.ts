import * as THREE from 'three';
import {poseWonderWomanSkirt} from './wonder-woman-skirt';
import type {Equipment} from '@sirocco/shared';
import {animateHands,type HeldPose} from './held-equipment';
import {poseAvatarBody} from './avatar-body-pose';
import {StanceMotion} from './stance-motion';

type MotionState={position:THREE.Vector3;phase:number;weight:number;stance:StanceMotion};
const motions=new WeakMap<THREE.Group,MotionState>();
export function resetAvatarMotion(model:THREE.Group){motions.delete(model);}
/** Animate the actual world body before any camera (including a mirror) renders it. */
export function animateAvatarMotion(model:THREE.Group,kind:Equipment,pose:HeldPose,dt:number,grounded:boolean,pitch=0,movement:{crouched?:boolean;vy?:number}={}){
 let motion=motions.get(model);if(!motion){motion={position:model.position.clone(),phase:0,weight:0,stance:new StanceMotion()};motions.set(model,motion);}
 const distance=Math.hypot(model.position.x-motion.position.x,model.position.z-motion.position.z),continuous=distance<1&&dt>0;
 motion.position.copy(model.position);
 const speed=continuous?distance/Math.max(dt,1/240):0,target=grounded?THREE.MathUtils.clamp(speed/4,0,1):0;
 motion.weight=THREE.MathUtils.lerp(motion.weight,target,1-Math.exp(-dt*20));
 if(grounded&&continuous)motion.phase+=distance*2.8;
 const stance=motion.stance.update(dt,grounded,!!movement.crouched,movement.vy??0),{lean}=poseAvatarBody(model,stance,motion.phase,motion.weight);
 poseWonderWomanSkirt(model);
 const held=model.getObjectByName('equippedWeapon') as THREE.Group|undefined;if(!held)return;
 const rest=held.userData.restPosition as THREE.Vector3,rotation=held.userData.restQuaternion as THREE.Quaternion;
 if(rest&&rotation){
  const sway=pose.reduceMotion?0:motion.weight,offset=held.userData.motionOffset??=new THREE.Vector3(),turn=held.userData.motionRotation??=new THREE.Quaternion();
  offset.set(0,.16*stance.crouch+.025*stance.landing+Math.sin(motion.phase*2)*.005*sway,-.015*stance.crouch);
  turn.setFromEuler(new THREE.Euler(THREE.MathUtils.clamp(pitch,-.8,.8)*.55-lean,0,Math.sin(motion.phase)*.010*sway));
 }
 animateHands(held,kind,pose);
 // Reflector renders from onBeforeRender, so no stale arm matrices reach its camera.
 model.updateWorldMatrix(true,true);
}
