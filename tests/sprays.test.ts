import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../apps/server/src/simulation';
import {neutralInput,sprayTarget,validInput,type Solid} from '@sirocco/shared';
const wall:Solid={x:0,y:2,z:-2,w:8,h:4,d:.3,kind:'wall'};
const floor:Solid={x:0,y:-.15,z:0,w:20,h:.3,d:20,kind:'floor'};
test('spray rays hit walls, floors and slopes with outward unit normals',()=>{
 const hit=sprayTarget({x:0,y:1.6,z:0},{x:0,y:0,z:-1},[wall,floor])!;assert.ok(hit);assert.ok(Math.abs(hit.position.z+1.85)<1e-8);assert.deepEqual(hit.normal,{x:0,y:0,z:1});
 const ground=sprayTarget({x:0,y:1.6,z:0},{x:0,y:-1,z:0},[floor])!;assert.ok(Math.abs(ground.position.y)<1e-8);assert.equal(ground.normal.y,1);
 const ramp:Solid={...floor,y:.5,h:1,d:8,ramp:{axis:'z',from:0,to:1}};
 const slope=sprayTarget({x:0,y:2,z:0},{x:0,y:-1,z:0},[ramp])!;assert.ok(slope.normal.y>.99);assert.ok(slope.normal.z<0);
});
test('sprays cannot reach distant walls, ceilings or a wall behind cover',()=>{
 assert.equal(sprayTarget({x:0,y:1,z:4},{x:0,y:0,z:-1},[wall]),undefined);
 assert.equal(sprayTarget({x:0,y:1,z:0},{x:0,y:1,z:0},[{...wall,y:3,z:0,kind:'roof',h:.2}]),undefined);
 const cover=sprayTarget({x:0,y:1,z:0},{x:0,y:0,z:-1},[wall,{...wall,z:-1,kind:'crate'}])!;assert.ok(cover.position.z>-.9,'spray must hit the box instead of the wall behind it');
 assert.equal(validInput({...neutralInput(),spray:'yes'}),false);assert.equal(validInput({...neutralInput(),spray:true}),true);
});
test('room sprays have no cooldown, persist for new viewers, expires and resets',()=>{
 const sim=new Simulation([wall,floor]),p=sim.add('a','Artist');Object.assign(p,{x:0,y:0,z:0,yaw:0,pitch:0});
 const spray=()=>{sim.input(p.id,{...neutralInput(),seq:p.ack+1,spray:true});sim.step();};
 spray();assert.equal(sim.sprays.length,1);spray();assert.equal(sim.sprays.length,2);assert.equal(sim.events.filter(e=>e.type==='spray').length,1);
 const snapshot=sim.snapshot();assert.equal(snapshot.sprays[0].owner,p.id);snapshot.sprays[0].position.x=999;assert.equal(sim.sprays[0].position.x,0);
 spray();assert.equal(sim.sprays.length,3);
 sim.time+=120001;sim.step();assert.equal(sim.sprays.length,0);
 spray();assert.equal(sim.sprays.length,1);sim.phase='finished';sim.rematch();assert.equal(sim.sprays.length,0);
});

test('spray rays accept box and car sides and tops and preserve the validated aim ray',()=>{
 for(const vehicle of [undefined,{part:'body' as const,height:1.5,truck:false},{part:'cabin' as const,height:1.5,truck:false}]){
  const crate:Solid={x:0,y:.75,z:-2,w:2,h:1.5,d:2,kind:'crate',vehicle};
  const side=sprayTarget({x:0,y:.6,z:0},{x:0,y:0,z:-1},[crate])!;assert.ok(side);assert.equal(side.position.z,-1);assert.equal(side.normal.z,1);assert.deepEqual(side.ray.origin,{x:0,y:.6,z:0});
  const top=sprayTarget({x:0,y:2.5,z:-2},{x:0,y:-1,z:0},[crate])!;assert.equal(top.position.y,1.5);assert.equal(top.normal.y,1);
 }
});
