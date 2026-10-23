import * as THREE from 'three';
import {MUZZLE_Z} from './weapon-models';

/** Match the muzzle rendered with the narrower viewmodel FOV to the world camera. */
export function heldShotOrigin(gun:THREE.Object3D,weapon:keyof typeof MUZZLE_Z,viewCamera:THREE.PerspectiveCamera,worldCamera:THREE.PerspectiveCamera){
 gun.updateWorldMatrix(true,false);viewCamera.updateMatrixWorld();worldCamera.updateMatrixWorld();
 const muzzle=gun.localToWorld(new THREE.Vector3(0,.035,MUZZLE_Z[weapon]));
 return muzzle.project(viewCamera).unproject(worldCamera);
}
