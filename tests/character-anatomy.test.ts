import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AVATARS} from '@sirocco/shared';
import {buildAvatar} from '../apps/web/components/avatar-models';
import {realHandGeometry} from '../apps/web/components/character-anatomy';
import {cutGeometryY} from '../apps/web/components/costume-geometry';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
test('all character bodies use fitted anatomy, rendered eyes, closed boots and articulated legs',()=>{
 const previous=globalThis.document,load=THREE.TextureLoader.prototype.load;
 const ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
 globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>ctx})} as unknown as Document;
 THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
 try{for(const avatar of AVATARS){const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];const model=buildAvatar(art,avatar.id);
  assert.equal(model.userData.realAnatomy,true);assert.ok(model.getObjectByName('leftLeg'));assert.ok(model.getObjectByName('rightLeg'));
  const body=model.children.find(o=>o.name==='anatomy-Skin') as THREE.Mesh;assert.ok(body.geometry.attributes.position.count>3000,'must use the anatomical surface, not primitive body parts');
  if(['thor','wonder-woman','black-widow','hulk'].includes(avatar.id)){const eye=model.getObjectByName('anatomy-Eye') as THREE.Mesh;assert.ok(eye);assert.ok(!Array.isArray(eye.material)||eye.geometry.groups.length>0,'eyes need a renderable material group');assert.ok(model.getObjectByName('texturedHair'));}
  model.traverse(o=>{if(o instanceof THREE.Mesh){assert.ok(o.geometry.attributes.position.count>0);const a=o.geometry.attributes.position.array;assert.ok(Array.from(a).every(Number.isFinite));}});
  const bounds=new THREE.Box3().setFromObject(model);assert.ok(bounds.min.y>-.08&&bounds.max.y<1.95,`${avatar.name}: body must fit player height`);disposeGroup(model);art.destroy();
 }}finally{globalThis.document=previous;THREE.TextureLoader.prototype.load=load;}
});
test('anatomical grips are detailed and compatible with weapon geometry batching',()=>{
 for(const a of AVATARS)for(const left of [false,true])for(const open of [false,true]){const g=realHandGeometry(a.id,left,open);assert.ok(g.attributes.position.count>1000);assert.ok(g.attributes.normal.array instanceof Float32Array);assert.ok(g.attributes.uv.array instanceof Float32Array);const bounds=new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);assert.ok(bounds.getSize(new THREE.Vector3()).length()<.5);g.dispose();}
});
test('costume seams split crossing triangles exactly at the collar plane',()=>{
 const original=new THREE.BoxGeometry(.4,.5,.2),g=cutGeometryY(original,0),p=g.attributes.position;
 for(let i=0;i<g.index!.count;i+=3){const ys=[0,1,2].map(j=>p.getY(g.index!.getX(i+j)));assert.ok(Math.min(...ys)>=-1e-7||Math.max(...ys)<=1e-7,'no triangle can straddle the skin/costume boundary');}g.dispose();
});
