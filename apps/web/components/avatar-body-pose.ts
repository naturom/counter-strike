import * as THREE from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Stance} from './stance-motion';

const down=new THREE.Vector3(0,-1,0),restKnee=new THREE.Vector3(0,-.43,0),restAnkle=new THREE.Vector3(0,-.81,0);
type Surface={mesh:THREE.Mesh;position:Float32Array;normal:Float32Array;toLeg:THREE.Matrix4;fromLeg:THREE.Matrix4;normalToLeg:THREE.Matrix3;normalFromLeg:THREE.Matrix3;pin:Float32Array};
type Leg={root:THREE.Group;rest:THREE.Vector3;surfaces:Surface[];signature:string};
type Rig={torso:THREE.Group;legs:Leg[]};
const rigs=new WeakMap<THREE.Group,Rig>();

/** Keep full-size anatomy and equipment together while the pelvis and legs move. */
export function avatarTorso(model:THREE.Group){return model.getObjectByName('avatarTorso') as THREE.Group|undefined;}
function boundary(leg:THREE.Group){
 const mesh=leg.getObjectByName('anatomy-Skin') as THREE.Mesh,p=mesh.geometry.attributes.position,index=mesh.geometry.index!,canonical=new Map<string,number>(),ids:number[]=[],edges=new Map<string,{a:number;b:number;count:number}>();
 for(let i=0;i<p.count;i++){const key=`${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`;if(!canonical.has(key))canonical.set(key,i);ids.push(canonical.get(key)!);}
 for(let i=0;i<index.count;i+=3)for(let k=0;k<3;k++){const a=ids[index.getX(i+k)],b=ids[index.getX(i+(k+1)%3)],key=a<b?`${a},${b}`:`${b},${a}`,edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a,b,count:1});}
 return [...new Set([...edges.values()].filter(e=>e.count===1).flatMap(e=>[e.a,e.b]))].map(i=>new THREE.Vector3().fromBufferAttribute(p,i)).filter(p=>p.y+leg.position.y>.65);
}
function setup(model:THREE.Group){
 let rig=rigs.get(model);if(rig)return rig;
 const torso=new THREE.Group();torso.name='avatarTorso';
 for(const child of [...model.children])if(!['leftLeg','rightLeg'].includes(child.name))torso.add(child);
 model.add(torso);
 const legs=['leftLeg','rightLeg'].map(name=>{
  const root=model.getObjectByName(name) as THREE.Group,surfaces:Surface[]=[];
  // The imported limb index references only part of its source vertex pool.
  // Remove unused torso/face vertices before posing or computing leg bounds.
  root.traverse(o=>{if(o instanceof THREE.Mesh){const raw=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),compact=mergeVertices(raw,1e-5);raw.dispose();o.geometry.dispose();o.geometry=compact;}});
  const edge=boundary(root);
  root.traverse(o=>{if(o instanceof THREE.Mesh){
   o.updateMatrix();const toLeg=o.matrix.clone(),fromLeg=toLeg.clone().invert(),p=o.geometry.attributes.position,pin=new Float32Array(p.count);
   for(let i=0;i<p.count;i++){const at=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(toLeg);if(at.y+root.position.y>.74&&edge.length)pin[i]=1-THREE.MathUtils.smoothstep(Math.sqrt(Math.min(...edge.map(e=>e.distanceToSquared(at)))),0,.10);}
   surfaces.push({mesh:o,position:Float32Array.from(p.array),normal:Float32Array.from(o.geometry.attributes.normal.array),toLeg,fromLeg,normalToLeg:new THREE.Matrix3().getNormalMatrix(toLeg),normalFromLeg:new THREE.Matrix3().getNormalMatrix(fromLeg),pin});
  }});
  return {root,rest:root.position.clone(),surfaces,signature:''};
 });
 rig={torso,legs};rigs.set(model,rig);return rig;
}

/** Bend the actual thigh, shin and foot surfaces without scaling the body or
 * separating knees. Foot rotation cancels the leg bend on planted steps. */
export function poseAvatarBody(model:THREE.Group,stance:Stance,phase:number,weight:number){
 const rig=setup(model),{crouch,air,landing}=stance,walk=weight*(1-air)*(1-crouch*.7),drop=.66*crouch+.07*air+.09*landing+.025*walk,back=.18*crouch+.035*air;
 const lean=-.32*crouch-.05*air-.06*landing-.025*walk;
 rig.torso.rotation.set(lean,0,0);rig.torso.position.set(0,.91-drop,back).sub(new THREE.Vector3(0,.91,0).applyEuler(rig.torso.rotation));rig.torso.updateMatrix();
 for(let side=0;side<2;side++){
  const leg=rig.legs[side],sign=side===0?-1:1,stride=Math.sin(phase+side*Math.PI),lift=Math.max(0,stride)*(.065-.04*crouch)*walk+(stance.grounded?0:air*(.16+(stance.vy>0?.045:0))),hip=leg.rest.clone().add(new THREE.Vector3(0,-drop,back)),ankle=new THREE.Vector3(leg.rest.x+sign*.055*crouch,.10+lift,-stride*.19*walk+air*(side===0?.06:.13));
  const axis=ankle.clone().sub(hip),distance=axis.length(),reach=Math.max(.0501,Math.min(distance,.81));axis.normalize();
  const along=(.43**2-.38**2+reach**2)/(2*reach),pole=new THREE.Vector3(sign*.15*crouch,0,-1);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const knee=hip.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,.43**2-along**2)));
  // A fully extended stride may exceed the anatomical reach by a few mm.
  const shinDirection=ankle.clone().sub(knee).normalize();ankle.copy(knee).addScaledVector(shinDirection,.38);
  leg.root.position.copy(hip);leg.root.quaternion.setFromUnitVectors(down,knee.clone().sub(hip).normalize());leg.root.updateMatrix();
  const inverseHip=leg.root.quaternion.clone().invert(),shin=new THREE.Quaternion().setFromUnitVectors(down,ankle.clone().sub(knee).normalize()).premultiply(inverseHip),foot=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-sign*.08*crouch).premultiply(inverseHip),ankleTurn=foot.clone().multiply(shin.clone().invert()),posedAnkle=restAnkle.clone().sub(restKnee).applyQuaternion(shin).add(restKnee),torsoToLeg=leg.root.matrix.clone().invert().multiply(rig.torso.matrix),pinNormal=new THREE.Matrix3().getNormalMatrix(torsoToLeg);
  const signature=[drop,back,lean,...leg.root.quaternion.toArray(),...shin.toArray(),...foot.toArray()].map(x=>x.toFixed(6)).join(',');if(signature===leg.signature)continue;leg.signature=signature;
  for(const surface of leg.surfaces){
   const p=surface.mesh.geometry.attributes.position,n=surface.mesh.geometry.attributes.normal,turn=new THREE.Quaternion(),ankleRotation=new THREE.Quaternion(),at=new THREE.Vector3(),normal=new THREE.Vector3(),rest=new THREE.Vector3();
   for(let i=0;i<p.count;i++){
    rest.fromArray(surface.position,i*3).applyMatrix4(surface.toLeg);normal.fromArray(surface.normal,i*3).applyMatrix3(surface.normalToLeg).normalize();
    const kneeWeight=1-THREE.MathUtils.smoothstep(rest.y,-.49,-.37),footWeight=1-THREE.MathUtils.smoothstep(rest.y,-.845,-.765);
    turn.identity().slerp(shin,kneeWeight);ankleRotation.identity().slerp(ankleTurn,footWeight);
    at.copy(rest).sub(restKnee).applyQuaternion(turn).add(restKnee).sub(posedAnkle).applyQuaternion(ankleRotation).add(posedAnkle);normal.applyQuaternion(turn).applyQuaternion(ankleRotation);
    if(surface.pin[i]){const target=rest.clone().add(leg.rest).applyMatrix4(torsoToLeg),targetNormal=new THREE.Vector3().fromArray(surface.normal,i*3).applyMatrix3(surface.normalToLeg).applyMatrix3(pinNormal).normalize();at.lerp(target,surface.pin[i]);normal.lerp(targetNormal,surface.pin[i]).normalize();}
    at.applyMatrix4(surface.fromLeg);normal.applyMatrix3(surface.normalFromLeg).normalize();p.setXYZ(i,at.x,at.y,at.z);n.setXYZ(i,normal.x,normal.y,normal.z);
   }
   p.needsUpdate=n.needsUpdate=true;surface.mesh.geometry.computeBoundingBox();surface.mesh.geometry.computeBoundingSphere();
  }
 }
 model.userData.stance={...stance};return {lean};
}
