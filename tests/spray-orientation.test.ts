import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {direction} from '@sirocco/shared';
import {sprayRotation} from '../apps/web/components/sprays';
test('floor artwork faces the spraying player at every heading, including near vertical aim',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2,.7,-2.2])for(const pitch of [-.3,-.9,-1.5]){
  const rotation=sprayRotation(new THREE.Vector3(0,1,0),direction(yaw,pitch));
  const up=new THREE.Vector3(0,1,0).applyEuler(rotation),right=new THREE.Vector3(1,0,0).applyEuler(rotation);
  assert.ok(up.dot(new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)))>1-1e-8,'artwork must point forward in the spraying player view');
  assert.ok(right.dot(new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)))>1-1e-8,'artwork must not be mirrored');
 }
});
test('spray orientation stays on walls and sloped panels and is stable for all viewers',()=>{
 for(const normal of [new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0),new THREE.Vector3(.2,1,.3).normalize()]){
  const aim=direction(.4,-.8),rotation=sprayRotation(normal,aim),up=new THREE.Vector3(0,1,0).applyEuler(rotation),out=new THREE.Vector3(0,0,1).applyEuler(rotation);
  assert.ok(Math.abs(up.dot(normal))<1e-8);assert.ok(out.dot(normal)>1-1e-8);
  assert.deepEqual(rotation.toArray(),sprayRotation(normal,JSON.parse(JSON.stringify(aim))).toArray());
 }
 for(const normal of [new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0)])assert.ok(sprayRotation(normal,{x:0,y:-1,z:0}).toArray().slice(0,3).every(Number.isFinite));
});
