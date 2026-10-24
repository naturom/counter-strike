import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AVATARS,type Equipment} from '@sirocco/shared';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {animateHands} from '../apps/web/components/held-equipment';
import {CHARACTER_STYLE} from '../apps/web/components/character-style';
test('each character has matching hands on every weapon and all action poses stay finite',()=>{
 const previous=globalThis.document,load=THREE.TextureLoader.prototype.load;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
 const ctx=new Proxy({}, {get:()=>()=>{}});
 globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>ctx})} as unknown as Document;
 try{
  for(const avatar of AVATARS){const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];
   for(const weapon of ['rifle','pistol','smg','marksman','knife','grenade','bomb'] as Equipment[]){
    const held=art.weapon(weapon,true,false,avatar.id);assert.equal(held.userData.avatar,avatar.id);assert.ok(held.getObjectByName('rightArm'));assert.ok(held.getObjectByName('leftArm'));
    const colors=new Set<string>();held.getObjectByName('rightArm')!.traverse(o=>{if(o instanceof THREE.Mesh){const m=o.material as THREE.MeshStandardMaterial;if(m.color)colors.add('#'+m.color.getHexString());}});assert.ok(colors.has(CHARACTER_STYLE[avatar.id].hands),`${avatar.name}: mismatched hands with ${weapon}`);
    for(const progress of [0,.3,.65,1]){animateHands(held,weapon,{reload:progress,throwProgress:progress,plant:progress,slash:progress});held.updateMatrixWorld(true);held.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),`${avatar.name} ${weapon}: invalid animated transform`));}
    disposeGroup(held);
   }
   art.destroy();
  }
 }finally{globalThis.document=previous;THREE.TextureLoader.prototype.load=load;}
});
