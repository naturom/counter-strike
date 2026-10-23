import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {DUST2} from '@sirocco/shared';
import {WorldArt} from '../apps/web/components/world';
import {buildVehicle} from '../apps/web/components/vehicle-model';

test('all vehicle panels survive the scenery material batching pass',()=>{
 const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];
 for(const solid of DUST2.solids.filter(b=>b.vehicle?.part==='body')){
  const g=buildVehicle(art,solid);g.updateMatrixWorld(true);const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  g.traverse(o=>{if(o instanceof THREE.Mesh){const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld),list=batches.get(o.material)??[];list.push(geo);batches.set(o.material,list);}});
  for(const [material,geometries] of batches){const merged=mergeGeometries(geometries);assert.ok(merged,`${solid.label}: missing panels after batching`);assert.ok(merged.attributes.position.count>0);merged.dispose();geometries.forEach(g=>g.dispose());}
  const bounds=new THREE.Box3().setFromObject(g);assert.ok(Math.abs(bounds.min.y-(solid.y-solid.h/2))<.03,`${solid.label}: wheels must reach the road`);
  g.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
 }
 art.materials.forEach(m=>m.dispose());
});
