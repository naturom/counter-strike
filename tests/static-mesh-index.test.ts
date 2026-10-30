import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DecalGeometry} from 'three/examples/jsm/geometries/DecalGeometry.js';
import {indexStaticMesh,nearbyTriangles} from '../apps/web/components/static-mesh-index';
import {surfaceDecalGeometry} from '../apps/web/components/surface-decals';

test('accelerated static rays preserve detailed hits, normals, UVs, transforms and distance limits',()=>{
 for(const indexed of [false,true])for(const side of [THREE.FrontSide,THREE.BackSide,THREE.DoubleSide]){
  const sphere=new THREE.SphereGeometry(2,32,20),geometry=indexed?sphere:sphere.toNonIndexed(),material=new THREE.MeshBasicMaterial({side}),mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(3,2,-8);mesh.rotation.set(.25,.63,-.12);mesh.scale.set(1.2,.8,1.4);mesh.updateMatrixWorld(true);
  const original=mesh.raycast;indexStaticMesh(mesh);
  for(let i=0;i<80;i++){
   const origin=new THREE.Vector3(3+Math.sin(i*2.3)*4,2+Math.cos(i*1.7)*3,i%2?-8:0),direction=new THREE.Vector3(Math.sin(i*.1)*.15,Math.cos(i*.3)*.1,-1).normalize(),ray=new THREE.Raycaster(origin,direction,i%3===0?3:0,i%4===0?5:30),expected:THREE.Intersection[]=[],actual:THREE.Intersection[]=[];
   original.call(mesh,ray,expected);mesh.raycast(ray,actual);expected.sort((a,b)=>a.distance-b.distance);actual.sort((a,b)=>a.distance-b.distance);assert.equal(actual.length,expected.length);
   for(let j=0;j<actual.length;j++){const a=actual[j],e=expected[j];assert.equal(a.object,mesh);assert.ok(a.point.distanceTo(e.point)<1e-6);assert.ok(Math.abs(a.distance-e.distance)<1e-6);assert.ok(a.face!.normal.distanceTo(e.face!.normal)<1e-6);assert.ok(a.uv!.distanceTo(e.uv!)<1e-6);assert.equal(a.faceIndex,e.faceIndex);}
  }
  geometry.dispose();if(!indexed)sphere.dispose();material.dispose();
 }
});

test('nearby decal queries prune distant triangles without changing curved-surface projection',()=>{
 const geometry=new THREE.SphereGeometry(2,80,48),mesh=new THREE.Mesh(geometry);mesh.position.set(3,2,-7);mesh.rotation.y=.34;mesh.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(3,2,0),new THREE.Vector3(0,0,-1)),hit=ray.intersectObject(mesh)[0],normal=hit.face!.normal.clone().transformDirection(mesh.matrixWorld),rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal)),size=new THREE.Vector3(.4,.4,.1);
 const candidates=nearbyTriangles(mesh,mesh.worldToLocal(hit.point.clone()),size.length()/2);assert.ok(candidates.length<(geometry.index!.count/3)*.05,'a local mark should not scan the whole batch');
 const full=new DecalGeometry(mesh,hit.point,rotation,size),cropped=surfaceDecalGeometry(mesh,hit.point,rotation,size);
 assert.equal(cropped.attributes.position.count,full.attributes.position.count);
 const bounds=(g:THREE.BufferGeometry)=>new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);assert.ok(bounds(full).min.distanceTo(bounds(cropped).min)<1e-6);assert.ok(bounds(full).max.distanceTo(bounds(cropped).max)<1e-6);
 full.dispose();cropped.dispose();geometry.dispose();(mesh.material as THREE.Material).dispose();
});
