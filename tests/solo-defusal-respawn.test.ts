import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,NEXT_GAME_COUNTDOWN_MS,RESPAWN_MS,neutralInput,validInput,type Equipment} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';

test('solo deaths use the results countdown and fully reset the next game, including weapon selection',()=>{
 for(const weapon of ['knife','pistol','smg','marksman','grenade','bomb'] as Equipment[]){
  const sim=new Simulation('dunes','defusal'),p=sim.add('solo','Solo');Object.assign(p,MAPS.dunes.bombSites!.find(s=>s.id==='A')!.marker,{protectedUntil:0,primary:'smg',weapon,grenades:0,reloadUntil:sim.time+10000,crouched:true});p.ammo.rifle=0;
  const life=p.spawnId;let seq=0;sim.input(p.id,{...neutralInput(),seq:++seq,spawnId:life,weapon,fire:true});sim.damage(p,100,p,'grenade',p);sim.step();
  assert.equal(p.hp,0);assert.equal(sim.phase,'finished');assert.equal(sim.round,1);assert.equal(sim.nextRoundAt-sim.time,NEXT_GAME_COUNTDOWN_MS);assert.equal(sim.bomb!.carrierId,null);
  for(let i=0;i<160;i++)sim.input(p.id,{...neutralInput(),seq:++seq,spawnId:life,weapon,fire:true,reload:true,jump:true});
  const deadline=sim.nextRoundAt;sim.time=deadline-100;sim.step();assert.equal(p.hp,0);sim.time=deadline;sim.step();
  assert.equal(p.hp,100);assert.equal(p.death,undefined);assert.equal(p.deaths,0);assert.equal(p.kills,0);assert.equal(sim.round,2);assert.equal(p.spawnId,life+1);assert.equal(sim.phase,'playing');assert.equal(sim.nextRoundAt,0);assert.deepEqual(sim.scores,{red:0,blue:0});assert.equal(p.weapon,'rifle');assert.equal(p.primary,'rifle');assert.equal(p.ammo.rifle,30);assert.equal(p.ammo.pistol,12);assert.equal(p.grenades,2);assert.equal(p.reloadUntil,0);assert.equal(p.crouched,false);assert.equal(sim.bomb!.status,'carried');assert.equal(sim.bomb!.carrierId,p.id);
  const spawn={x:p.x,y:p.y,z:p.z};
  // In-flight commands from before death must not undo the completed reset.
  sim.input(p.id,{...neutralInput(),seq:++seq,spawnId:life,weapon,fire:true,jump:true,forward:1});sim.step();assert.equal(p.weapon,'rifle');assert.deepEqual({x:p.x,y:p.y,z:p.z},spawn);assert.equal(p.ammo.rifle,30);assert.equal(p.grenades,2);assert.equal(sim.grenades.length,0);
  sim.input(p.id,{...neutralInput(),seq:++seq,spawnId:p.spawnId,weapon:'pistol'});sim.step();assert.equal(p.weapon,'pistol','new-life controls still work after a long countdown');
 }
});
test('a solo death with planted C4 still starts a fresh game instead of leaving the old charge behind',()=>{
 const sim=new Simulation('dunes','defusal'),p=sim.add('solo','Solo');Object.assign(sim.bomb!,{status:'planted',carrierId:null,siteId:'A',explodeAt:40000});p.protectedUntil=0;sim.damage(p,100,p,'grenade',p);sim.step();assert.equal(sim.phase,'finished');assert.equal(sim.nextRoundAt-sim.time,NEXT_GAME_COUNTDOWN_MS);sim.time=sim.nextRoundAt;sim.step();assert.equal(sim.round,2);assert.equal(p.hp,100);assert.equal(sim.bomb!.status,'carried');assert.equal(sim.bomb!.carrierId,p.id);assert.equal(sim.bomb!.explodeAt,0);assert.equal(sim.bomb!.siteId,null);
});
test('solo reset also applies after the only opponent disconnects',()=>{
 const sim=new Simulation('dunes','defusal'),p=sim.add('a','A'),b=sim.add('b','B');sim.step();assert.equal(sim.roundLive,true);sim.disconnect(b.id);p.protectedUntil=0;sim.damage(p,100,p,'grenade',p);sim.step();assert.equal(sim.phase,'finished');sim.time=sim.nextRoundAt;sim.step();assert.equal(sim.round,2);assert.equal(p.hp,100);assert.equal(sim.bomb!.carrierId,p.id);
});
test('active multiplayer bomb rounds keep dead players out until the actual next game',()=>{
 const sim=new Simulation('dunes','defusal'),a=sim.add('a','A');sim.add('b','B');sim.add('mate','Teammate');sim.step();assert.equal(sim.roundLive,true);a.protectedUntil=0;sim.damage(a,100,a,'grenade',a);sim.time+=RESPAWN_MS+100;sim.step();assert.equal(a.hp,0);assert.equal(sim.phase,'playing');assert.equal(sim.bomb!.status,'dropped');sim.finish();sim.time=sim.nextRoundAt;sim.step();assert.equal(sim.round,2);assert.equal(a.hp,100);assert.equal(sim.bomb!.carrierId,a.id);
});
test('deathmatch respawns also reject stale previous-life selections',()=>{
 const sim=new Simulation([]),p=sim.add('solo','Solo'),life=p.spawnId;p.protectedUntil=0;sim.damage(p,100,p,'grenade',p);sim.time=p.respawnAt;sim.step();assert.equal(sim.round,1);assert.equal(p.hp,100);assert.equal(p.spawnId,life+1);sim.input(p.id,{...neutralInput(),seq:1,spawnId:life,weapon:'knife'});sim.step();assert.equal(p.weapon,'rifle');
});
test('spawn identities validate strictly while legacy controls remain accepted',()=>{
 assert.equal(validInput(neutralInput()),true);assert.equal(validInput({...neutralInput(),spawnId:1}),true);for(const spawnId of [0,-1,1.5,NaN,Infinity,'1',Number.MAX_SAFE_INTEGER+1])assert.equal(validInput({...neutralInput(),spawnId}),false);
});
