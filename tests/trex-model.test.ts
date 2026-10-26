import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {buildTrex,poseTrex,TrexModels} from '../apps/web/components/trex-model';
import type {Solid,Trex} from '@sirocco/shared';
test('the creature retains animated jaw/limbs/tail, grounded feet and a finite collapsing body',()=>{
 const before=globalThis.document,ctx=new Proxy({},{get:()=>()=>{}});globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;
 const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];
 try{
  const model=buildTrex(art),t:Trex={id:'trex-1',x:0,y:0,z:0,hp:1000,yaw:0,state:'roam',targetId:null,attackAt:0,deadAt:0};for(const name of ['trex-jaw','trex-head','trex-neck','trex-left-leg','trex-right-leg','trex-tail-5'])assert.ok(model.getObjectByName(name));
  poseTrex(model,t,0,1/60);const bounds=new THREE.Box3().setFromObject(model,true);assert.ok(bounds.max.y>3.3&&bounds.max.y<3.8);assert.ok(bounds.min.y>-.05&&bounds.min.y<.10);assert.ok(bounds.max.z-bounds.min.z>6);
  let meshes=0;model.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;for(const a of ['position','normal'])assert.ok(Array.from(o.geometry.attributes[a].array).every(Number.isFinite));}});assert.ok(meshes<55,'rigid detail should batch into a bounded number of draws');
  for(let i=0;i<20;i++){model.position.x+=.05;poseTrex(model,t,i*16,1/60);}assert.ok(Math.abs(model.getObjectByName('trex-left-leg')!.rotation.x)>.01);
  t.state='attack';t.attackAt=1000;poseTrex(model,t,1300,1/60);assert.ok(Math.abs(model.getObjectByName('trex-jaw')!.rotation.x)>.4);
  t.hp=0;t.state='dead';t.deadAt=1500;poseTrex(model,t,3000,1/60);assert.ok(Math.abs(new THREE.Box3().setFromObject(model,true).min.y-.008)<.001,'a settled corpse must touch the ground, not merely stay above it');assert.ok(Math.abs(model.getObjectByName('trex-body')!.rotation.z-Math.PI/2)<1e-6);disposeGroup(model);
  const scene=new THREE.Scene(),models=new TrexModels(art,scene),camera=new THREE.PerspectiveCamera();models.update([{...t,hp:450,state:'hunt'}],3100,.016,camera,()=>{});assert.equal(scene.children.length,1);models.update([],3200,.016,camera,()=>{});assert.equal(scene.children.length,0);models.clear();
 }finally{art.destroy();globalThis.document=before;}
});

test('T-rex corpses settle against raised roads and slopes at every facing and stay fixed after interpolation',()=>{
 const before=globalThis.document,ctx=new Proxy({},{get:()=>()=>{}});globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;
 const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];
 try{
  for(const axis of [undefined,'x','z'] as const)for(const yaw of [0,.7,Math.PI/2,Math.PI]){
   const floor:Solid={x:0,y:1.5,z:0,w:30,h:3,d:30,kind:'floor',...(axis?{ramp:{axis,from:0,to:6}}:{})};
   const t:Trex={id:'trex-ground',x:0,y:3,z:0,hp:0,yaw,state:'dead',targetId:null,attackAt:0,deadAt:1000};
   const model=buildTrex(art);model.position.set(t.x,t.y,t.z);model.rotation.y=yaw;
   const normal=new THREE.Vector3(axis==='x'?-.2:0,1,axis==='z'?-.2:0).normalize(),v=new THREE.Vector3();
   for(const elapsed of [0,300,700,1200,2500]){
    poseTrex(model,t,1000+elapsed,1/60,[floor]);let clearance=Infinity;
    model.traverseVisible(part=>{if(!(part instanceof THREE.Mesh))return;const p=part.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(part.matrixWorld).sub(new THREE.Vector3(0,3,0));clearance=Math.min(clearance,v.dot(normal));}});
    assert.ok(Math.abs(clearance-.008)<.001,`${axis??'flat'}, yaw ${yaw}, ${elapsed}ms: body clearance ${clearance}`);
   }
   const body=model.getObjectByName('trex-body')!,at=body.position.clone(),rotation=body.quaternion.clone();poseTrex(model,t,4500,1/60,[floor]);assert.ok(at.equals(body.position)&&rotation.equals(body.quaternion),'settled corpses must not keep moving');disposeGroup(model);
  }
  const scene=new THREE.Scene(),models=new TrexModels(art,scene),camera=new THREE.PerspectiveCamera(),t:Trex={id:'trex-network',x:0,y:3,z:0,hp:1000,yaw:0,state:'roam',targetId:null,attackAt:0,deadAt:0};
  models.update([t],0,.016,camera,()=>{});Object.assign(t,{x:1,y:3.2,z:1,yaw:1,hp:0,state:'dead',deadAt:1000});
  models.update([t],2300,.016,camera,()=>{});const body=scene.children[0].getObjectByName('trex-body')!,at=body.getWorldPosition(new THREE.Vector3());models.update([t],2400,.016,camera,()=>{});
  assert.ok(at.equals(body.getWorldPosition(new THREE.Vector3())),'death must finish position/yaw interpolation before caching ground contact');models.clear();
 }finally{art.destroy();globalThis.document=before;}
});
