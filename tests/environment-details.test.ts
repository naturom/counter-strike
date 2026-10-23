import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DUST2,groundAt,dustPoint,wallDistance} from '@sirocco/shared';
import {doorFrame,buildDoor,wallSignMount,DUST_ROUTE_SIGNS} from '../apps/web/components/environment-details';
import {WorldArt} from '../apps/web/components/world';
test('rendered gate axes and plank silhouettes match each authoritative collision leaf',()=>{
 const art=Object.create(WorldArt.prototype) as WorldArt,wood=new THREE.MeshStandardMaterial(),iron=new THREE.MeshStandardMaterial();
 for(const door of DUST2.solids.filter(s=>s.style==='door')){
  const f=doorFrame(door),group=buildDoor(art,door,wood,iron);group.updateMatrixWorld(true);
  const corners=[[-f.width/2,-f.depth/2],[f.width/2,-f.depth/2],[f.width/2,f.depth/2],[-f.width/2,f.depth/2]].map(([x,z])=>new THREE.Vector3(x,0,z).applyMatrix4(group.matrixWorld));
  for(const [x,z] of door.polygon!)assert.ok(corners.some(c=>Math.hypot(c.x-x,c.z-z)<1e-6),door.label);
  const ray=new THREE.Raycaster();for(const side of [-1,1])for(const y of [-door.h*.42,0,door.h*.42]){
   const origin=group.localToWorld(new THREE.Vector3(f.width*.17,y,side*(f.depth/2+.3))),direction=new THREE.Vector3(0,0,-side).transformDirection(group.matrixWorld);ray.set(origin,direction);assert.ok(ray.intersectObject(group,true).length,`${door.label}: missing timber face`);
  }
  group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
 }
 wood.dispose();iron.dispose();
});
test('all gate leaf bottoms reach the supporting ground, including the falling B threshold',()=>{
 const floors=DUST2.solids.filter(s=>s.kind==='floor');
 for(const door of DUST2.solids.filter(s=>s.style==='door'))for(const [x,z] of door.polygon!){assert.ok(door.y-door.h/2<=groundAt({x,z},floors)+.025,`${door.label} floats above its approach`);}
 const lintel=DUST2.solids.find(s=>s.label==='B gate lintel')!;assert.ok(lintel.y-lintel.h/2>=5.4-1e-6);
});

test('every route plaque is supported across its width and stands clear of its wall',()=>{
 for(const sign of DUST_ROUTE_SIGNS){
  const mount=wallSignMount(DUST2.solids.filter(b=>b.label===sign.wall),dustPoint(sign.u,sign.v),1.8);
  const nx=Math.sin(mount.rotation),nz=Math.cos(mount.rotation);
  for(const offset of [-.9,0,.9])for(const dy of [-.45,.45]){
   const p={x:mount.x+nz*offset,y:sign.y+dy,z:mount.z-nx*offset};
   const distance=wallDistance(p,{x:-nx,y:0,z:-nz},[mount.wall]);
   assert.ok(Math.abs(distance-.045)<1e-5,`${sign.text} unsupported or embedded: ${distance}`);
  }
 }
});
