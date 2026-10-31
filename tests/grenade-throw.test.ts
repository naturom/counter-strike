import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DT,GRENADE_THROW,grenadeThrowProgress,grenadeReleased,neutralInput,direction,eyeOf,type Input} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {WorldArt,disposeGroup} from '../apps/web/components/world';
import {animateHands} from '../apps/web/components/held-equipment';
import {grenadeThrowPose} from '../apps/web/components/grenade-throw-pose';
import {animateGrenadeFlight,grenadeLeavesHand} from '../apps/web/components/grenade-flight';
function tick(sim:Simulation,n:number,patch:Partial<Input>={}){for(let i=0;i<n;i++){sim.input('a',{...neutralInput(),weapon:'grenade',seq:sim.players.get('a')!.ack+1,...patch});sim.step();}}
test('a click pulls the pin first, then releases one grenade along the current aim',()=>{
 const sim=new Simulation([]),p=sim.add('a','A');Object.assign(p,{x:0,y:0,z:0,protectedUntil:0});tick(sim,1,{fire:true});
 assert.equal(p.grenades,1);assert.equal(sim.grenades.length,0);assert.equal(sim.events[0].type,'grenadePrime');const start=p.grenadeThrow!.startedAt;
 tick(sim,20,{fire:true,yaw:Math.PI/2,pitch:.2});assert.ok(sim.time<start+GRENADE_THROW.releaseMs);assert.equal(sim.grenades.length,0);
 tick(sim,1,{fire:true,yaw:Math.PI/2,pitch:.2});assert.equal(sim.grenades.length,1);assert.equal(p.grenadeThrow?.released,true);assert.ok(grenadeThrowProgress(p.grenadeThrow,sim.time)>=.7);
 const g=sim.grenades[0],aim=direction(Math.PI/2,.2),event=sim.events.find(e=>e.type==='grenade')!;assert.ok(event);assert.ok(g.vx<0);assert.ok(Math.abs(g.vx-aim.x*17)<1e-8);assert.ok(Math.abs(g.vz-aim.z*17)<1e-8);assert.ok(event.from.y>p.y+eyeOf(p)-.2);assert.equal(g.explodeAt-sim.time,GRENADE_THROW.fuseMs);
 tick(sim,12,{fire:true});assert.equal(p.grenadeThrow,undefined);assert.equal(p.grenades,1);assert.equal(sim.grenades.length,1);tick(sim,1);tick(sim,1,{fire:true});assert.equal(p.grenades,0);assert.equal(sim.grenades.length,1,'second grenade also waits for the release');
});
test('preparing a grenade locks switching until release, but death and disconnect cancel the throw',()=>{
 for(const cancel of ['death','disconnect','spawn'] as const){const sim=new Simulation([]),p=sim.add('a','A');p.protectedUntil=0;tick(sim,1,{fire:true});tick(sim,2,{weapon:'rifle',fire:true});assert.equal(p.weapon,'grenade');assert.equal(p.ammo.rifle,30);if(cancel==='death')sim.damage(p,100,p,'grenade',p);else if(cancel==='disconnect')sim.disconnect(p.id);else sim.spawn(p);for(let i=0;i<40;i++)sim.step();assert.equal(p.grenadeThrow,undefined);assert.equal(sim.grenades.length,0,`${cancel} leaves no delayed projectile`);}
});
test('release position stays on the player side of a nearby wall and throw snapshots are independent',()=>{
 const sim=new Simulation([{x:0,y:1.6,z:-.35,w:4,h:4,d:.1,kind:'wall'}]),p=sim.add('a','A');Object.assign(p,{x:0,y:0,z:0});tick(sim,1,{fire:true});const snap=sim.snapshot();snap.players[0].grenadeThrow!.released=true;assert.equal(p.grenadeThrow!.released,false);tick(sim,21,{fire:true});const event=sim.events.find(e=>e.type==='grenade')!;assert.ok(event);assert.ok(event.from.z>-.3,'hand release cannot originate through a wall');
});
test('a pin pull cannot simultaneously start defusing a bomb',()=>{
 const sim=new Simulation('dunes','defusal'),p=sim.add('a','A'),bomb=sim.bombs.find(b=>b.team!==p.team)!;Object.assign(bomb,{status:'planted',carrierId:null,x:p.x,y:p.y,z:p.z,explodeAt:40000});tick(sim,1,{fire:true});tick(sim,5,{interact:true});assert.equal(bomb.action,null);tick(sim,30,{interact:true});assert.equal(p.grenadeThrow,undefined);assert.equal(sim.snapshot().bombs.find(b=>b.team!==p.team)?.action?.kind,'defuse');
});
test('rendering waits for the authoritative release, and the pin leaves before the grenade',()=>{
 const pending={startedAt:100,released:false};assert.ok(grenadeThrowProgress(pending,10000)<.7);assert.equal(grenadeReleased(grenadeThrowProgress(pending,10000)),false);assert.equal(grenadeThrowPose(.1).pinPull,0);assert.equal(grenadeThrowPose(.34).pinPull,1);assert.equal(grenadeThrowPose(.69).held,true);assert.equal(grenadeThrowPose(.7).held,false);assert.equal(grenadeThrowPose(.8).open,1);
 assert.equal(grenadeReleased(grenadeThrowProgress({...pending,released:true},799.999999)),true,'release acknowledgement takes precedence over clock rounding');
});
function fixture(run:(art:WorldArt)=>void){const previous=globalThis.document,load=THREE.TextureLoader.prototype.load,ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};const art=Object.create(WorldArt.prototype) as WorldArt;art.materials=[];art.textures=[];try{run(art);}finally{art.destroy();globalThis.document=previous;THREE.TextureLoader.prototype.load=load;}}
test('all hero hands pull the ring, keep the grenade until release, then open their fingers',()=>fixture(art=>{
 for(const avatar of ['ironman','ultraman','wonder-woman'] as const)for(const third of [false,true]){
  const held=art.weapon('grenade',!third,third,avatar),rig=held.userData.handRig,pin=held.getObjectByName('grenade-pin')!,rest=pin.position.clone();
  for(const phase of [.14,.24,.34]){animateHands(held,'grenade',{reload:0,plant:0,throwProgress:phase});held.updateWorldMatrix(true,true);assert.equal(rig.body.visible,true);const contact=rig.left.userData.ironArm.palm.localToWorld(new THREE.Vector3(.025,-.045,-.04).multiplyScalar(avatar==='wonder-woman'?.84:1));assert.ok(contact.distanceTo(pin.getWorldPosition(new THREE.Vector3()))<.025,`${avatar} ${third}: pin must be caught in the left fingers`);}
  assert.ok(pin.position.distanceTo(rest)>.17,'ring and shaft must actually be pulled away from the shell');
  animateHands(held,'grenade',{reload:0,plant:0,throwProgress:.699});assert.equal(rig.body.visible,true);animateHands(held,'grenade',{reload:0,plant:0,throwProgress:.7});held.updateWorldMatrix(true,true);assert.equal(rig.body.visible,false);assert.equal(pin.visible,false);const release=held.getObjectByName('grenade-release')!.getWorldPosition(new THREE.Vector3()),centre=rig.body.localToWorld(new THREE.Vector3(0,.015,0));assert.ok(release.distanceTo(centre)<1e-6,'flying grenade starts at the last held grenade centre');
  animateHands(held,'grenade',{reload:0,plant:0,throwProgress:.8});const palm=rig.right.userData.ironArm.palm,meshes=palm.userData.releaseMeshes??[palm.userData.releaseMesh];assert.ok(meshes.length>0&&meshes.every((mesh:THREE.Mesh)=>mesh.morphTargetInfluences![0]===1),'throwing fingers open after release');
  animateHands(held,'grenade',{reload:0,plant:0,throwProgress:0});assert.equal(rig.body.visible,true);assert.ok(pin.position.distanceTo(rest)<1e-8);assert.equal(pin.visible,true);disposeGroup(held);
 }
}));
test('a flying grenade begins at the hand, then joins its server trajectory without a map-origin jump',()=>{
 const mesh=new THREE.Group(),position={x:80,y:2,z:40},hand=new THREE.Vector3(79.7,1.6,40.2);animateGrenadeFlight(mesh,position,DT,1000,hand);assert.ok(mesh.position.distanceTo(hand)<1e-8);animateGrenadeFlight(mesh,{x:81,y:2.1,z:40},1,1200);assert.ok(mesh.position.distanceTo(new THREE.Vector3(81,2.1,40))<1e-8);const remote=new THREE.Group();animateGrenadeFlight(remote,position,DT,1000);assert.deepEqual(remote.position.toArray(),[80,2,40]);
});
test('joining late or throwing again never brings an older grenade back to the hand',()=>{
 const action={startedAt:100,released:true},g={id:1,owner:'a',team:'red' as const,x:0,y:1,z:0,vx:0,vy:0,vz:-17,explodeAt:800+GRENADE_THROW.fuseMs};assert.equal(grenadeLeavesHand(g,action,820),true);assert.equal(grenadeLeavesHand(g,undefined,820),false);assert.equal(grenadeLeavesHand(g,action,1000),false);assert.equal(grenadeLeavesHand(g,{startedAt:1100,released:true},1820),false);
});
