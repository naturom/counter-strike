import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {heldShotOrigin,weaponMuzzlePosition} from '../apps/web/components/shot-origin';
import {MUZZLE_Z} from '../apps/web/components/weapon-models';
import {firstPersonHold} from '../apps/web/components/first-person-hold';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {animateHands} from '../apps/web/components/held-equipment';
import {AVATARS,type Weapon} from '@sirocco/shared';
import {Arena} from '../apps/web/components/arena';
import {SniperScope,BASE_FOV} from '../apps/web/components/sniper-scope';

test('tracers project exactly onto every held muzzle across FOV, aspect and animated poses',()=>{
 for(const aspect of [1,16/9,21/9])for(const fov of [76,68])for(const weapon of Object.keys(MUZZLE_Z) as (keyof typeof MUZZLE_Z)[])for(const recoil of [0,.065]){
  const view=new THREE.PerspectiveCamera(65,aspect,.025,8),world=new THREE.PerspectiveCamera(fov,aspect,.06,350);
  world.position.set(31,4.2,-17);world.rotation.set(-.35,1.7,.02,'YXZ');
  const hold=firstPersonHold(weapon),gun=new THREE.Group();gun.position.set(hold.position[0],hold.position[1],hold.position[2]+recoil);gun.scale.setScalar(.75);gun.rotation.set(hold.pitch+.03,hold.yaw,-.015);
  const origin=heldShotOrigin(gun,weapon,view,world),screen=origin.clone().project(world),muzzle=gun.localToWorld(new THREE.Vector3(0,.035,MUZZLE_Z[weapon])).project(view);
  assert.ok(Math.hypot(screen.x-muzzle.x,screen.y-muzzle.y)<1e-10,`${weapon}: tracer detached from barrel`);
  assert.ok(screen.z>-1&&screen.z<1,'origin must stay in front of the near plane');
  const inView=gun.localToWorld(new THREE.Vector3(0,.035,MUZZLE_Z[weapon])).applyMatrix4(view.matrixWorldInverse),inWorld=origin.clone().applyMatrix4(world.matrixWorldInverse);
  assert.ok(Math.abs(inWorld.z-inView.z)<1e-10,'camera conversion must preserve muzzle depth, not copy incompatible NDC depths');
 }
});

test('actual barrel sockets drive tracers for every avatar, weapon and animated hand offset',()=>{
 const before=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
 globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
 const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];
 try{
  for(const avatar of AVATARS)for(const weapon of Object.keys(MUZZLE_Z) as Weapon[]){
   const model=art.weapon(weapon,true,false,avatar.id),root=new THREE.Group(),view=new THREE.PerspectiveCamera(65,16/9,.025,8),world=new THREE.PerspectiveCamera(76,16/9,.06,350),hold=firstPersonHold(weapon);root.add(model);root.scale.setScalar(.75);root.position.fromArray(hold.position);root.rotation.set(hold.pitch,hold.yaw,0);world.position.set(12,5,-30);world.rotation.set(-.2,.8,.01,'YXZ');
   for(const reload of [0,.2,.48,.85]){
    animateHands(model,weapon,{reload,plant:0,throwProgress:0});const slide=model.getObjectByName('slide');if(slide)slide.position.z=reload*.04;
    const muzzle=model.getObjectByName('muzzle')!;assert.ok(muzzle,'each actual weapon must supply its bore-face socket');
    const rendered=muzzle.getWorldPosition(new THREE.Vector3()),origin=heldShotOrigin(model,weapon,view,world),screen=origin.clone().project(world),expected=rendered.clone().project(view);
    assert.ok(Math.hypot(screen.x-expected.x,screen.y-expected.y)<1e-9,`${avatar.id} ${weapon}: use the visible gun, including hand lift/reload/slide offsets`);
    assert.ok(Math.abs(origin.clone().applyMatrix4(world.matrixWorldInverse).z-rendered.clone().applyMatrix4(view.matrixWorldInverse).z)<1e-9);
    assert.ok(weaponMuzzlePosition(model,weapon).distanceTo(rendered)<1e-9,'world/reflected weapon reports must use the same actual muzzle');
    if(reload===0){
     const behind=muzzle.localToWorld(new THREE.Vector3(0,0,.10)).project(view),start=rendered.clone().project(view),axis=new THREE.Vector2(start.x-behind.x,start.y-behind.y).normalize(),aim=new THREE.Vector2(-start.x,-start.y).normalize();
     assert.ok(axis.dot(aim)>1-1e-8,`${avatar.id} ${weapon}: the barrel must point along the visible tracer toward the crosshair`);
    }
   }
   // A weapon switch must resolve the explicitly selected model, never an older
   // hidden gun's socket elsewhere under the common viewmodel root.
   const hidden=art.weapon('pistol',true,false,avatar.id);hidden.visible=false;root.add(hidden);const beforeSwitch=weaponMuzzlePosition(model,weapon);hidden.position.set(2,2,2);assert.ok(weaponMuzzlePosition(model,weapon).distanceTo(beforeSwitch)<1e-9);
   disposeGroup(root);
  }
 }finally{art.destroy();globalThis.document=before;THREE.TextureLoader.prototype.load=load;}
});

test('a scoped AWP shot anchors to its barrel as the weapon becomes visible again',()=>{
 const arena=Object.create(Arena.prototype) as Arena,camera=new THREE.PerspectiveCamera(12,16/9,.06,350),view=new THREE.PerspectiveCamera(65,16/9,.025,8),gun=new THREE.Group(),model=new THREE.Group(),muzzle=new THREE.Object3D(),scene=new THREE.Scene();
 muzzle.name='muzzle';muzzle.position.set(0,.035,-1.149);model.position.y=.06;model.add(muzzle);gun.add(model);gun.position.set(.32,-.25,-.72);gun.scale.setScalar(.75);gun.visible=false;
 const traces:{object:THREE.Line;localWeapon?:Weapon}[]=[];
 Object.assign(arena,{id:'local',gunKind:'marksman',flash:new THREE.Group(),gun,gunModels:new Map([['marksman',model]]),camera,viewCamera:view,scene,traces,scope:new SniperScope(),shownScope:1,callbacks:{scope:()=>{}},audio:{shot:()=>{}}});
 arena.combat({id:1,type:'shot',shooter:'local',team:'red',weapon:'marksman',from:{x:0,y:0,z:0},to:{x:0,y:0,z:-50}});
 assert.equal(camera.fov,BASE_FOV);assert.equal(traces[0].localWeapon,'marksman','the hidden scope view must not force a shot from the player eye');
 const origin=new THREE.Vector3().fromBufferAttribute(traces[0].object.geometry.attributes.position,0),screen=origin.project(camera),expected=muzzle.getWorldPosition(new THREE.Vector3()).project(view);
 assert.ok(Math.hypot(screen.x-expected.x,screen.y-expected.y)<1e-6);
 for(const trace of traces){trace.object.geometry.dispose();(trace.object.material as THREE.Material).dispose();}
});
