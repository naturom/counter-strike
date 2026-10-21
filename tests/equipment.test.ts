import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../apps/server/src/simulation';
import {neutralInput,validInput,type Input} from '@sirocco/shared';
function tick(s:Simulation,n:number,patch:Partial<Input>={}){for(let j=0;j<n;j++){s.input('a',{...neutralInput(),seq:s.players.get('a')!.ack+1,...patch});s.step();}}
function duel(){const s=new Simulation([]),a=s.add('a','A'),b=s.add('b','B');Object.assign(a,{x:0,z:0,protectedUntil:0});Object.assign(b,{x:0,z:-1.4,protectedUntil:0});return {s,a,b};}
test('knife hits only in melee range, uses no ammo, respects cooldown and requires a new click',()=>{
  const {s,a,b}=duel();tick(s,4,{weapon:'knife'});const ammo={...a.ammo};tick(s,1,{weapon:'knife',fire:true});assert.equal(b.hp,60);assert.equal(s.events.find(e=>e.type==='melee')?.target,b.id);assert.deepEqual(a.ammo,ammo);
  tick(s,30,{weapon:'knife',fire:true});assert.equal(b.hp,60);tick(s,1,{weapon:'knife'});tick(s,1,{weapon:'knife',fire:true});assert.equal(b.hp,20);
  tick(s,1,{weapon:'knife'});tick(s,1,{weapon:'knife',fire:true});assert.equal(b.hp,20,'cooldown blocks rapid clicking');
  b.z=-3;tick(s,16,{weapon:'knife'});tick(s,1,{weapon:'knife',fire:true});assert.equal(b.hp,20,'no long-range melee hits');
  b.z=-1.4;tick(s,16,{weapon:'knife'});tick(s,1,{weapon:'knife',fire:true});assert.equal(b.hp,0);assert.equal(a.kills,1);assert.equal(s.events.find(e=>e.type==='kill')?.weapon,'knife');
});
test('knife respects walls, friendly fire and spawn protection',()=>{
  const {s,b}=duel();s.solids=[{x:0,y:1,z:-.7,w:3,h:3,d:.2,kind:'wall'}];tick(s,4,{weapon:'knife'});tick(s,1,{weapon:'knife',fire:true});assert.equal(b.hp,100);
  s.solids=[];b.protectedUntil=s.time+10000;tick(s,16,{weapon:'knife'});tick(s,1,{weapon:'knife',fire:true});assert.equal(b.hp,100);
  b.protectedUntil=0;b.team='red';tick(s,16,{weapon:'knife'});tick(s,1,{weapon:'knife',fire:true});assert.equal(b.hp,100);
});
test('grenade selection is harmless; mouse click throws once, switching while held cannot throw, empty slots are safe',()=>{
  const {s,a}=duel();tick(s,30,{weapon:'grenade',reload:true});assert.equal(a.grenades,2);assert.equal(a.reloadUntil,0);assert.equal(s.grenades.length,0);
  tick(s,1,{weapon:'grenade',fire:true});assert.equal(a.grenades,1);tick(s,30,{weapon:'grenade',fire:true});assert.equal(a.grenades,1);
  tick(s,1,{weapon:'knife',fire:true});tick(s,1,{weapon:'grenade',fire:true});assert.equal(a.grenades,1);
  tick(s,1,{weapon:'grenade'});tick(s,1,{weapon:'grenade',fire:true});assert.equal(a.grenades,0);
  tick(s,20,{weapon:'grenade'});tick(s,1,{weapon:'grenade',fire:true});assert.equal(a.grenades,0);assert.equal(s.grenades.length,2);
  tick(s,1,{weapon:'pistol'});assert.equal(a.weapon,'pistol');assert.equal(a.ammo.pistol,12);
});
test('knife and grenade inputs validate; switching cancels reload without granting unowned weapons',()=>{
  const {s,a}=duel();assert.ok(validInput({...neutralInput(),weapon:'knife'}));assert.ok(validInput({...neutralInput(),weapon:'grenade'}));assert.equal(validInput({...neutralInput(),weapon:'rocket'}),false);
  a.ammo.rifle=1;tick(s,1,{reload:true});assert.ok(a.reloadUntil);tick(s,1,{weapon:'knife',reload:true});assert.equal(a.reloadUntil,0);tick(s,60,{weapon:'knife'});assert.equal(a.ammo.rifle,1);tick(s,1,{weapon:'marksman'});assert.equal(a.weapon,'knife');
  tick(s,1,{weapon:'rifle'});assert.equal(a.weapon,'rifle');
});
