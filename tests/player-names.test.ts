import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PlayerNames} from '../apps/web/components/player-names';
import {Simulation} from '../apps/server/src/simulation';
test('callsigns use team colours, remain attached, respect cover, and release their textures',()=>{
 const before=globalThis.document,text:string[]=[];const ctx={fillStyle:'',textAlign:'',textBaseline:'',font:'',fillRect(){},measureText(value:string){return {width:value.length*18};},fillText(value:string){text.push(value);}};
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})} as unknown as Document;
 try{
  const sim=new Simulation([]),a=sim.add('a','Alex'),b=sim.add('b','Sam'),scene=new THREE.Scene(),names=new PlayerNames(scene),camera=new THREE.PerspectiveCamera(),models=new Map<string,THREE.Group>();camera.position.set(0,1.6,0);
  for(const p of [a,b]){const model=new THREE.Group();model.position.set(0,0,p===a?0:-6);models.set(p.id,model);}
  names.update([a,b],models,a.id,camera,[],.1,0);assert.deepEqual(text,['A · Alex','B · Sam']);
  const own=scene.getObjectByName('callsign-a') as THREE.Sprite,enemy=scene.getObjectByName('callsign-b') as THREE.Sprite;assert.ok(own.layers.isEnabled(1)&&!own.layers.isEnabled(0));assert.ok(enemy.layers.isEnabled(0));assert.equal(enemy.visible,true);assert.equal(enemy.material.depthTest,true);assert.equal(enemy.material.depthWrite,false);
  const texture=enemy.material.map;let disposed=0;texture!.addEventListener('dispose',()=>disposed++);models.get(b.id)!.position.x=1;b.crouched=true;names.update([a,b],models,a.id,camera,[],.1,120);assert.equal(enemy.position.x,1);assert.ok(enemy.position.y<1.7&&enemy.position.y>1.48);assert.equal(enemy.material.map,texture,'movement must reuse the name texture');
  names.update([a,b],models,a.id,camera,[{x:0,y:1.5,z:-3,w:4,h:3,d:.4,kind:'wall'}],.1,240);assert.equal(enemy.visible,false,'a name must not reveal an enemy behind a wall');
  names.update([a,b],models,a.id,camera,[],.1,360);assert.equal(enemy.visible,true);b.hp=0;names.update([a,b],models,a.id,camera,[],.1,480);assert.equal(enemy.visible,false);b.hp=100;b.connected=false;names.update([a,b],models,a.id,camera,[],.1,600);assert.equal(enemy.visible,false);
  b.connected=true;models.get(b.id)!.position.z=-50;names.update([a,b],models,a.id,camera,[],.1,720);assert.equal(enemy.visible,false,'distant callsigns should not clutter the map');
  names.update([a],models,a.id,camera,[],.1,840);assert.equal(disposed,1);assert.equal(scene.children.length,1);names.clear();assert.equal(scene.children.length,0);
 }finally{globalThis.document=before;}
});
