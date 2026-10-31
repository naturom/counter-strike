import * as THREE from 'three';

/** Minimum elliptical radius along the part of a bone that passes chest height.
 * Testing only the elbow misses forearms cutting diagonally through the body. */
export function boneClearsTorso(a:THREE.Vector3,b:THREE.Vector3,skipStart=0,width=.20,depth=.175){
 const dy=b.y-a.y;let lo=skipStart,hi=1;
 if(Math.abs(dy)<1e-8){if(a.y<=.94||a.y>=1.40)return true;}
 else{const t0=(.94-a.y)/dy,t1=(1.40-a.y)/dy;lo=Math.max(skipStart,Math.min(t0,t1));hi=Math.min(1,Math.max(t0,t1));if(lo>=hi)return true;}
 const x=a.x/width,z=a.z/depth,dx=(b.x-a.x)/width,dz=(b.z-a.z)/depth;
 const t=THREE.MathUtils.clamp(-(x*dx+z*dz)/Math.max(1e-9,dx*dx+dz*dz),lo,hi);
 return (x+dx*t)**2+(z+dz*t)**2>=1.03;
}

/** Choose the closest natural elbow on the two-bone IK circle that also keeps
 * the hand in line with the forearm. Position-only IK can bend a wrist backwards
 * even though its shoulder, elbow and wrist anchors all meet perfectly. */
export function wristAwareElbow(shoulder:THREE.Vector3,wrist:THREE.Vector3,preferred:THREE.Vector3,handAxis:THREE.Vector3,upper:number,lower:number,maxBend=THREE.MathUtils.degToRad(35),accept?:(point:THREE.Vector3)=>boolean){
 const axis=wrist.clone().sub(shoulder),distance=axis.length();if(distance<1e-6)return preferred.clone();axis.divideScalar(distance);
 const reach=THREE.MathUtils.clamp(distance,Math.abs(upper-lower)+.0001,upper+lower-.0001),along=(upper*upper-lower*lower+reach*reach)/(2*reach),radius=Math.sqrt(Math.max(0,upper*upper-along*along));
 const bend=preferred.clone().sub(shoulder).addScaledVector(axis,-preferred.clone().sub(shoulder).dot(axis));
 if(bend.lengthSq()<1e-8)bend.set(0,-1,0).addScaledVector(axis,axis.y);if(bend.lengthSq()<1e-8)bend.set(1,0,0).addScaledVector(axis,-axis.x);bend.normalize();
 const restBend=bend.clone(),ideal=handAxis.clone().addScaledVector(axis,-handAxis.dot(axis)),amplitude=radius/lower*ideal.length(),axial=(along-reach)/lower*handAxis.dot(axis);
 if(amplitude>1e-6){
  ideal.normalize();const allowed=Math.acos(THREE.MathUtils.clamp((Math.cos(maxBend)-axial)/amplitude,-1,1)),delta=Math.atan2(axis.dot(new THREE.Vector3().crossVectors(bend,ideal)),bend.dot(ideal));
  bend.applyAxisAngle(axis,Math.sign(delta)*Math.max(0,Math.abs(delta)-allowed));
 }
 const center=shoulder.clone().addScaledVector(axis,along),result=center.clone().addScaledVector(bend,radius);if(!accept||accept(result))return result;
 // Preserve the wrist benefit without solving it by putting an elbow inside
 // the chest or above the shoulder. Refine a feasible arc continuously.
 const point=(angle:number)=>center.clone().addScaledVector(restBend.clone().applyAxisAngle(axis,angle),radius);
 const score=(angle:number)=>{const at=point(angle);if(!accept(at))return Infinity;const excess=Math.max(0,handAxis.angleTo(at.clone().sub(wrist).normalize())-maxBend);return at.distanceToSquared(preferred)+excess*excess*6;};
 let angle=0,best=score(0),step=Math.PI/32;for(let i=-32;i<32;i++){const candidate=i*step,value=score(candidate);if(value<best){best=value;angle=candidate;}}
 for(let i=0;i<14;i++){step*=.5;const a=score(angle-step),b=score(angle+step);if(a<best&&a<=b){angle-=step;best=a;}else if(b<best){angle+=step;best=b;}}
 return Number.isFinite(best)?point(angle):preferred.clone();
}

/** The viewmodel's camera anchor is off screen, not a second set of stretched
 * bones. Keep the real limb lengths and an attainable hand/forearm direction. */
export function viewArmShoulder(preferred:THREE.Vector3,wrist:THREE.Vector3,handAxis:THREE.Vector3,length:number){
 const offset=preferred.clone().sub(wrist),distance=Math.min(offset.length(),length*.86),angle=offset.angleTo(handAxis),limit=THREE.MathUtils.degToRad(60);
 offset.normalize();if(angle>limit)offset.applyQuaternion(new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(offset,handAxis),(angle-limit)/angle));
 return wrist.clone().addScaledVector(offset,distance);
}

/** Solve the viewmodel support arm back from its fixed gun contact. The elbow
 * stays below the hand in camera space, including the gun's reload roll.
 * The camera-side shoulder exits below the viewport instead of drawing a
 * detached upper arm across the screen. World shoulder anchors are unaffected. */
export function viewSupportArm(preferred:THREE.Vector3,wrist:THREE.Vector3,handAxis:THREE.Vector3,up:THREE.Vector3,left:THREE.Vector3,upper:number,lower:number,hingeBend?:number){
 const incline=(direction:THREE.Vector3,height:number)=>{
  const vertical=direction.dot(up),horizontal=direction.clone().addScaledVector(up,-vertical);
  if(horizontal.lengthSq()<1e-8)horizontal.set(-1,0,0).addScaledVector(up,up.x);
  return horizontal.normalize().multiplyScalar(Math.sqrt(1-height*height)).addScaledVector(up,height);
 };
 const forearm=handAxis.clone().addScaledVector(left,.25).normalize();if(forearm.dot(up)>-.45)forearm.copy(incline(forearm,-.45));
 const elbow=wrist.clone().addScaledVector(forearm,lower),bicep=preferred.clone().sub(elbow).normalize();if(bicep.dot(up)>-.4)bicep.copy(incline(bicep,-.4));
 if(hingeBend!==undefined){
  // Keep the top-magazine reach bent on one side of the elbow plane. Passing
  // through a straight arm flips that plane and corkscrews the skin.
  const bend=up.clone().negate().addScaledVector(left,.12);bend.addScaledVector(forearm,-bend.dot(forearm)).normalize();
  bicep.copy(forearm).multiplyScalar(Math.cos(hingeBend)).addScaledVector(bend,Math.sin(hingeBend));
 }
 return {elbow,shoulder:elbow.clone().addScaledVector(bicep,upper)};
}
