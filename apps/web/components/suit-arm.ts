import * as THREE from 'three';
import {createAnatomicalArm,bindAnatomicalArm,anatomicalShoulder,poseAnatomicalArm} from './anatomical-arm';
type Style='ultraman'|'wonder-woman'|'ironman';
/** The character's original skinned anatomy, rather than a swept circular tube. */
export function createSuitArm(skin:THREE.Material,accent:THREE.Material,style:Style='ultraman',left=false,joint:THREE.Material=skin,firstPerson=false){return createAnatomicalArm(skin,accent,style,left,joint,firstPerson);}
export function bindIronManShoulders(model:THREE.Group,held:THREE.Group){bindFittedShoulders(model,held,'shoulder-shell');}
export function bindUltramanShoulders(model:THREE.Group,held:THREE.Group){bindFittedShoulders(model,held,'ultraman-shoulder-bridge');}
export function bindWonderWomanShoulders(model:THREE.Group,held:THREE.Group){bindFittedShoulders(model,held,'wonder-woman-shoulder');}
function bindFittedShoulders(model:THREE.Group,held:THREE.Group,name:string){
 model.updateWorldMatrix(true,true);const sourceToHeld=held.matrixWorld.clone().invert().multiply(model.matrixWorld);
 for(const bridge of model.getObjectsByProperty('name',name) as THREE.Mesh[]){
  const arm=held.getObjectByName(bridge.userData.side<0?'leftArm':'rightArm')!,rig=arm.userData.ironArm,skin=rig.skin as THREE.Mesh,style=skin.userData.style as Style,shape=skin.userData.anatomicalArm;
  if(style==='wonder-woman')(skin.material as THREE.Material[])[0]=bridge.material as THREE.Material;
  bridge.visible=false;
  // Raising the weapon must bend the arm, rather than lifting the clavicle.
  bindAnatomicalArm(skin,sourceToHeld);rig.shoulder.copy(anatomicalShoulder(skin).applyMatrix4(sourceToHeld));
  rig.elbowTarget=skin.userData.anatomicalArm.elbow.clone().add(new THREE.Vector3(style==='ultraman'?0:bridge.userData.side*(style==='wonder-woman'?.025:.08),0,0)).applyMatrix4(sourceToHeld);
  const edge=shape.shoulderEdge as number[],normalMatrix=new THREE.Matrix3().getNormalMatrix(sourceToHeld),uv=skin.geometry.attributes.uv;
  skin.userData.shoulderSeam={indices:edge,points:edge.map(i=>new THREE.Vector3().fromArray(shape.position,i*3).applyMatrix4(sourceToHeld)),normals:edge.map(i=>new THREE.Vector3().fromArray(shape.normal,i*3).applyMatrix3(normalMatrix).normalize()),uv:edge.map(i=>new THREE.Vector2(uv.getX(i),uv.getY(i)))};
 }
}
export function updateSuitArm(mesh:THREE.Mesh,_clavicle:THREE.Vector3,shoulder:THREE.Vector3,elbow:THREE.Vector3,wrist:THREE.Vector3){
 poseAnatomicalArm(mesh,shoulder,elbow,wrist,mesh.parent!.userData.ironArm.palm.matrix);
}

/** Rebase the IK anchors after equipment bob/aim, keeping the torso seam stationary. */
export function refreshSuitArmAnchors(model:THREE.Group,held:THREE.Group){
 if(held.parent!==model)return;held.updateMatrix();const sourceToHeld=held.matrix.clone().invert();
 for(const name of ['leftArm','rightArm']){
  const rig=held.getObjectByName(name)?.userData.ironArm,skin=rig?.skin as THREE.Mesh|undefined;if(!skin)continue;
  const shape=skin.userData.anatomicalArm;
  bindAnatomicalArm(skin,sourceToHeld);
  rig.shoulder.copy(shape.shoulder).applyMatrix4(sourceToHeld);
  rig.elbowTarget??=new THREE.Vector3();rig.elbowTarget.copy(shape.elbow);if(skin.userData.style!=='ultraman')rig.elbowTarget.x+=(skin.userData.left?-1:1)*(skin.userData.style==='wonder-woman'?.025:.08);rig.elbowTarget.applyMatrix4(sourceToHeld);
  const seam=skin.userData.shoulderSeam;if(seam){const normalMatrix=new THREE.Matrix3().getNormalMatrix(sourceToHeld);shape.shoulderEdge.forEach((index:number,i:number)=>{seam.points[i].fromArray(shape.position,index*3).applyMatrix4(sourceToHeld);seam.normals[i].fromArray(shape.normal,index*3).applyMatrix3(normalMatrix).normalize();});}
 }
}
