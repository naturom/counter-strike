import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {heldShotOrigin} from '../apps/web/components/shot-origin';
import {MUZZLE_Z} from '../apps/web/components/weapon-models';

test('tracers project exactly onto every held muzzle across FOV, aspect and animated poses',()=>{
 for(const aspect of [1,16/9,21/9])for(const fov of [76,68])for(const weapon of Object.keys(MUZZLE_Z) as (keyof typeof MUZZLE_Z)[])for(const recoil of [0,.065]){
  const view=new THREE.PerspectiveCamera(65,aspect,.025,8),world=new THREE.PerspectiveCamera(fov,aspect,.06,350);
  world.position.set(31,4.2,-17);world.rotation.set(-.35,1.7,.02,'YXZ');
  const gun=new THREE.Group();gun.position.set(.22,-.23,-.74+recoil);gun.scale.setScalar(.75);gun.rotation.set(.03,0,-.015);
  const origin=heldShotOrigin(gun,weapon,view,world),screen=origin.clone().project(world),muzzle=gun.localToWorld(new THREE.Vector3(0,.035,MUZZLE_Z[weapon])).project(view);
  assert.ok(Math.hypot(screen.x-muzzle.x,screen.y-muzzle.y)<1e-10,`${weapon}: tracer detached from barrel`);
  assert.ok(screen.z>-1&&screen.z<1,'origin must stay in front of the near plane');
 }
});
