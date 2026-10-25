import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AVATARS,RESPAWN_MS,neutralInput,type Solid} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {buildAvatar} from '../apps/web/components/avatar-models';
import {equipAvatarModel} from '../apps/web/components/avatar-equipment';
import {DeadBodies,visibleMinimumY} from '../apps/web/components/dead-bodies';
import {animateAvatarMotion,resetAvatarMotion} from '../apps/web/components/avatar-motion';

test('death keeps an authoritative fall record for exactly five seconds, then clears it on respawn',()=>{
 const sim=new Simulation([]),a=sim.add('a','A'),b=sim.add('b','B');Object.assign(b,{protectedUntil:0,crouched:true,vy:-3});sim.damage(b,100,a,'rifle',a);
 assert.equal(b.hp,0);assert.equal(b.respawnAt-sim.time,5000);assert.equal(RESPAWN_MS,5000);assert.equal(b.death!.crouched,true);assert.equal(b.death!.vy,-3);
 const deathAt=sim.time,position={x:b.x,y:b.y,z:b.z};sim.snapshot().players.find(p=>p.id===b.id)!.death!.from.x=999;assert.notEqual(b.death!.from.x,999);
 for(let i=0;i<149;i++){sim.input(b.id,{...neutralInput(),seq:i+1,forward:1,jump:true,fire:true,reload:true});sim.step();assert.equal(b.hp,0);assert.deepEqual({x:b.x,y:b.y,z:b.z},position);}
 while(sim.time<deathAt+5000)sim.step();assert.equal(b.hp,100);assert.equal(b.death,undefined);assert.equal(b.respawnAt,0);
});
function fixture(run:(art:WorldArt)=>void){
 const documentBefore=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
 globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
 const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];
 try{run(art);}finally{art.destroy();globalThis.document=documentBefore;THREE.TextureLoader.prototype.load=load;}
}
test('all appearances collapse to the floor with attached limbs, remain still and revive upright',()=>fixture(art=>{
 for(const appearance of AVATARS){
  const sim=new Simulation([]),p=sim.add('a','A',appearance.id),attacker=sim.add('b','B');Object.assign(p,{x:0,y:0,z:0,yaw:0,protectedUntil:0});Object.assign(attacker,{x:0,z:3});sim.damage(p,100,attacker,'rifle',attacker);
  const model=buildAvatar(art,p.avatar);equipAvatarModel(art,model,'rifle',p.avatar);model.visible=true;const deaths=new DeadBodies();
  deaths.pose(model,p,sim.time,[]);assert.ok(model.up.clone().applyQuaternion(model.quaternion).y>.99);
  for(let i=1;i<=6;i++)deaths.pose(model,p,sim.time+i*160,[]);
  const bounds=new THREE.Box3().setFromObject(model,true);assert.ok(Math.abs(model.up.clone().applyQuaternion(model.quaternion).y)<.001);assert.ok(visibleMinimumY(model)>.005,'a corpse must not penetrate the floor');assert.ok(bounds.max.y<.9,`${appearance.id}: the body should lie low on the ground: ${bounds.max.y}`);
  const held=model.getObjectByName('equippedWeapon') as THREE.Group;assert.equal(held.userData.handRig.body.visible,false);assert.equal(held.visible,true,'hiding equipment must not hide its attached arms');
  const at=model.position.clone(),rotation=model.quaternion.clone();deaths.pose(model,p,sim.time+4500,[]);assert.ok(at.equals(model.position)&&rotation.equals(model.quaternion),'settled corpses must remain still throughout the cooldown');
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,1.6,0);deaths.camera(camera,p,sim.time+1500,[]);assert.ok(camera.position.distanceTo(new THREE.Vector3(0,1.6,0))>1,'death camera should pull out so the player can see their body');
  deaths.remove(p.id);resetAvatarMotion(model);model.position.set(0,0,0);model.rotation.set(0,0,0);animateAvatarMotion(model,'rifle',{reload:0,plant:0,throwProgress:0,slash:1},1/60,true);assert.equal(held.userData.handRig.body.visible,true);assert.ok(new THREE.Box3().setFromObject(model,true).max.y>1.6);
  disposeGroup(model);
 }
}));
test('airborne deaths fall onto supporting platforms and late round joiners do not create a corpse',()=>fixture(art=>{
 const sim=new Simulation([]),p=sim.add('a','A'),b=sim.add('b','B'),deaths=new DeadBodies(),model=buildAvatar(art,p.avatar);equipAvatarModel(art,model,'knife',p.avatar);
 assert.equal(deaths.pose(model,{...p,hp:0},sim.time,[]),undefined);
 Object.assign(p,{x:0,y:8,z:0,vy:2,grounded:false,protectedUntil:0,weapon:'knife'});sim.damage(p,100,b,'rifle',b);
 const floor:Solid={x:0,y:1.5,z:0,w:10,h:1,d:10,kind:'floor',style:'stone'};
 deaths.pose(model,p,sim.time+400,[floor]);assert.ok(model.position.y>6,'a midair death must fall progressively rather than teleport to the ground');
 deaths.pose(model,p,sim.time+2000,[floor]);const min=visibleMinimumY(model);assert.ok(min>=2&&min<2.1,`corpse must rest on the raised floor: ${min}`);disposeGroup(model);
}));
