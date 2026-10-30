import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {impactTarget,IMPACT_RULES,KNIFE,type Solid,type ImpactMark} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {impactGeometry,ImpactMarks} from '../apps/web/components/impact-marks';

const wall:Solid={x:0,y:2,z:-2,w:8,h:4,d:.3,kind:'wall'};
test('impact rays resolve nearest cover, floors, ceilings, ramps and material types',()=>{
 const origin={x:0,y:1.6,z:0},dir={x:0,y:0,z:-1};
 const hit=impactTarget(origin,dir,[wall])!;assert.deepEqual(hit.normal,{x:0,y:0,z:1});assert.equal(hit.surface,'stone');assert.ok(Math.abs(hit.position.z+1.85)<1e-7);
 const crate:Solid={x:0,y:.8,z:-1,w:1,h:1.6,d:.3,kind:'crate'};
 assert.equal(impactTarget(origin,dir,[wall,crate])!.surface,'wood');assert.ok(impactTarget(origin,dir,[wall,crate])!.position.z>-.9);
 assert.equal(impactTarget(origin,dir,[{...crate,vehicle:{part:'body',height:1.5,truck:false}}])!.surface,'metal');
 assert.equal(impactTarget(origin,dir,[{...wall,style:'door'}])!.surface,'wood');
 const roof:Solid={...wall,y:3,z:0,h:.3,kind:'roof'};assert.equal(impactTarget(origin,{x:0,y:1,z:0},[roof])!.normal.y,-1);
 assert.equal(impactTarget(origin,{x:0,y:-1,z:0},[])!.surface,'sand');
 const floor:Solid={x:0,y:0,z:0,w:10,h:.1,d:10,kind:'floor',style:'road'};assert.equal(impactTarget(origin,{x:0,y:-1,z:0},[floor])!.surface,'asphalt');
 const ramp:Solid={...floor,y:.5,h:1,ramp:{axis:'z',from:0,to:1}};const slope=impactTarget(origin,{x:0,y:-1,z:0},[ramp])!;assert.ok(slope.normal.z<0&&slope.normal.y>.99);assert.ok(Math.abs(Math.hypot(...Object.values(slope.normal))-1)<1e-8);
 assert.equal(impactTarget(origin,dir,[wall],KNIFE.range),undefined);assert.equal(impactTarget(origin,{x:0,y:1,z:0},[]),undefined);
});
test('authoritative bullet and knife marks are shared, bounded, copied, expired and cleared on rematch',()=>{
 const sim=new Simulation([wall]),p=sim.add('a','A');Object.assign(p,{x:0,y:0,z:0,yaw:0,pitch:0});sim.fire(p);
 assert.equal(sim.impacts.length,1);assert.equal(sim.events.at(-1)!.impact!.id,sim.impacts[0].id);
 const copy=sim.snapshot();copy.impacts[0].ray.origin.x=90;copy.impacts[0].position.z=90;assert.equal(sim.impacts[0].ray.origin.x,0);assert.ok(sim.impacts[0].position.z<0);
 p.weapon='knife';p.z=-.3;sim.fire(p);assert.equal(sim.impacts.at(-1)!.weapon,'knife');
 for(let i=0;i<IMPACT_RULES.limit+8;i++)sim.fire(p);assert.equal(sim.impacts.length,IMPACT_RULES.limit);assert.ok(sim.impacts[0].id>2);
 sim.time=IMPACT_RULES.knifeLifetimeMs+1;sim.step();assert.equal(sim.impacts.length,0);sim.fire(p);assert.equal(sim.impacts.length,1);sim.phase='finished';sim.rematch();assert.equal(sim.snapshot().impacts.length,0);
});
test('every gun leaves a five-second mark while knife marks keep their longer lifetime',()=>{
 const sim=new Simulation([wall]),p=sim.add('a','A');Object.assign(p,{x:0,y:0,z:0,yaw:0,pitch:0});
 for(const weapon of ['rifle','pistol','smg','marksman'] as const){p.weapon=p.primary=weapon;p.ammo[weapon]=10;sim.fire(p);const mark=sim.impacts.at(-1)!;assert.equal(mark.weapon,weapon);assert.equal(mark.expiresAt-mark.at,5000);}
 p.weapon='knife';p.z=-.3;sim.fire(p);assert.equal(sim.impacts.at(-1)!.expiresAt,IMPACT_RULES.knifeLifetimeMs);
 sim.time=4900;sim.step();assert.equal(sim.impacts.length,5,'marks remain visible before five seconds');
 sim.time=5000;sim.step();assert.deepEqual(sim.snapshot().impacts.map(m=>m.weapon),['knife'],'expired bullets are removed from the shared state');
});
test('players including friendly and protected targets block marks on the wall behind them',()=>{
 for(const protectedTarget of [false,true]){
  const sim=new Simulation([{...wall,z:-4}]),a=sim.add('a','A'),b=sim.add('b','B');Object.assign(a,{x:0,y:0,z:0,yaw:0,pitch:0});Object.assign(b,{x:0,y:0,z:-2,team:protectedTarget?'blue':'red',protectedUntil:protectedTarget?10000:0});
  sim.fire(a);assert.equal(sim.impacts.length,0);assert.equal(b.hp,100);
 }
});
test('projected impact geometry follows transformed walls, floors and curved objects',()=>{
 const geometries=[new THREE.BoxGeometry(4,3,.3),new THREE.PlaneGeometry(4,4),new THREE.SphereGeometry(1,24,16)];
 for(const geometry of geometries){
  const mesh=new THREE.Mesh(geometry);mesh.position.set(3,2,-5);mesh.rotation.y=.23;mesh.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(3,2,0),new THREE.Vector3(0,0,-1)),hit=ray.intersectObject(mesh)[0]!;assert.ok(hit);
  const normal=hit.face!.normal.clone().transformDirection(mesh.matrixWorld),rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal));
  const decal=impactGeometry(mesh,hit.point,rotation,new THREE.Vector3(.12,.12,.06));assert.ok(decal.attributes.position.count>0);
  const bounds=new THREE.Box3().setFromBufferAttribute(decal.attributes.position as THREE.BufferAttribute);assert.ok(bounds.getCenter(new THREE.Vector3()).distanceTo(hit.point)<.03);assert.ok(bounds.getSize(new THREE.Vector3()).length()<.21);decal.dispose();geometry.dispose();
 }
});
test('event marks survive older snapshots, render in batches, and dispose on expiration',()=>{
 const before=globalThis.document,gradient={addColorStop:()=>{}},context=new Proxy({createRadialGradient:()=>gradient},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
 globalThis.document={createElement:()=>({getContext:()=>context})} as unknown as Document;
 const scene=new THREE.Scene(),marks=new ImpactMarks(scene),map=new THREE.Group(),wallMesh=new THREE.Mesh(new THREE.BoxGeometry(8,4,.3));wallMesh.position.set(0,2,-2);map.add(wallMesh);
 const mark:ImpactMark={...impactTarget({x:0,y:1.6,z:0},{x:0,y:0,z:-1},[wall])!,id:1,at:100,weapon:'rifle',expiresAt:120100};
 try{
  marks.add(mark);marks.sync([],50);marks.update(map,100);assert.equal(scene.children.length,1,'older snapshots must not delete a newly arrived impact event');
  marks.add({...mark,id:2});marks.update(map,101);assert.equal(scene.children.length,1,'same-material marks should share a draw call');
  marks.sync([],120);marks.update(map,120);assert.equal(scene.children.length,0);
  marks.sync([mark],130);marks.update(map,130);assert.equal(scene.children.length,1);marks.update(map,mark.expiresAt);assert.equal(scene.children.length,0);
 }finally{marks.destroy();wallMesh.geometry.dispose();(wallMesh.material as THREE.Material).dispose();globalThis.document=before;}
});
