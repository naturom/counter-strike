import * as THREE from 'three';
import {MUZZLE_Z} from './weapon-models';

/** Resolve the selected weapon's real barrel, after all hand and action offsets. */
export function weaponMuzzlePosition(weaponModel:THREE.Object3D,weapon:keyof typeof MUZZLE_Z){
 const muzzle=weaponModel.getObjectByName('muzzle');
 if(muzzle)return muzzle.getWorldPosition(new THREE.Vector3());
 // Also support simple fixture/legacy weapon roots without a barrel socket.
 return weaponModel.localToWorld(new THREE.Vector3(0,.035,MUZZLE_Z[weapon]));
}
/** Match the narrower viewmodel FOV without changing the muzzle's real depth.
 * Copying NDC depth between cameras with different near/far planes moves a
 * one-metre muzzle several metres forward, causing clipped/backwards tracers. */
export function heldShotOrigin(weaponModel:THREE.Object3D,weapon:keyof typeof MUZZLE_Z,viewCamera:THREE.PerspectiveCamera,worldCamera:THREE.PerspectiveCamera){
 return heldPointOrigin(weaponMuzzlePosition(weaponModel,weapon),viewCamera,worldCamera);
}
/** Also used to hand an actually held grenade into the world at its release. */
export function heldPointOrigin(point:THREE.Vector3,viewCamera:THREE.PerspectiveCamera,worldCamera:THREE.PerspectiveCamera){
 viewCamera.updateWorldMatrix(true,false);worldCamera.updateWorldMatrix(true,false);
 const view=point.clone().applyMatrix4(viewCamera.matrixWorldInverse),screen=point.clone().project(viewCamera);
 screen.z=new THREE.Vector3(0,0,view.z).applyMatrix4(worldCamera.projectionMatrix).z;
 return screen.unproject(worldCamera);
}
