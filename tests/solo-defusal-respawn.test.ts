import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,RESPAWN_MS,neutralInput} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';

test('solo self-kills respawn in the same round with the dropped C4 returned at the new spawn',()=>{
 for(const cause of ['grenade','fall'] as const){
  const sim=new Simulation('dunes','defusal'),p=sim.add('solo','Solo');const bomb=sim.bomb!;assert.equal(bomb.carrierId,p.id);
  for(let death=1;death<=3;death++){
   const away=MAPS.dunes.bombSites!.find(s=>s.id==='A')!.marker;Object.assign(p,away,{protectedUntil:0});p.weapon='bomb';sim.damage(p,100,p,cause==='grenade'?'grenade':'bomb',p,undefined,cause==='fall'?'fall':undefined);
   assert.equal(p.hp,0);assert.equal(p.deaths,death);assert.equal(bomb.status,'dropped');assert.equal(bomb.carrierId,null);assert.equal(bomb.x,away.x);
   const round=sim.round,deadline=p.respawnAt;sim.time=deadline-100;sim.step();assert.equal(p.hp,0);sim.time=deadline;sim.step();
   assert.equal(p.hp,100);assert.equal(p.death,undefined);assert.equal(sim.round,round);assert.equal(sim.roundLive,false);assert.equal(sim.phase,'playing');assert.equal(sim.nextRoundAt,0);assert.equal(p.weapon,'rifle');assert.equal(p.ammo.rifle,30);assert.equal(p.grenades,2);
   assert.equal(bomb.status,'carried');assert.equal(bomb.carrierId,p.id);assert.deepEqual({x:bomb.x,y:bomb.y,z:bomb.z},{x:p.x,y:p.y,z:p.z});assert.equal(sim.bombs.filter(b=>b.carrierId===p.id).length,1);
   sim.input(p.id,{...neutralInput(),seq:death,weapon:'bomb'});sim.step();assert.equal(p.weapon,'bomb','returned C4 can be equipped normally');
  }
 }
});
test('practice respawning never duplicates a planted C4 or takes one from a living teammate',()=>{
 const sim=new Simulation('dunes','defusal'),p=sim.add('solo','Solo'),bomb=sim.bomb!;sim.time=2000;
 Object.assign(bomb,{status:'planted',carrierId:null,siteId:'A',explodeAt:sim.time+40000,...MAPS.dunes.bombSites!.find(s=>s.id==='A')!.marker});sim.damage(p,100,p,'grenade',p);const fuse=bomb.explodeAt;sim.time=p.respawnAt;sim.step();assert.equal(p.hp,100);assert.equal(bomb.status,'planted');assert.equal(bomb.carrierId,null);assert.equal(bomb.explodeAt,fuse);
 const second=new Simulation('dunes','defusal'),a=second.add('a','A'),b=second.add('b','B'),mate=second.add('mate','Teammate');second.disconnect(b.id);second.time=2000;second.damage(a,100,a,'grenade',a);Object.assign(second.bomb!,{status:'carried',carrierId:mate.id});second.time=a.respawnAt;second.step();assert.equal(a.hp,100);assert.equal(second.bomb!.carrierId,mate.id);
});
test('active bomb rounds keep dead players and C4 on the ground until the actual next game',()=>{
 const sim=new Simulation('dunes','defusal'),a=sim.add('a','A');sim.add('b','B');sim.add('mate','Teammate');sim.step();assert.equal(sim.roundLive,true);a.protectedUntil=0;sim.damage(a,100,a,'grenade',a);sim.time+=RESPAWN_MS+100;sim.step();assert.equal(a.hp,0);assert.equal(sim.phase,'playing');assert.equal(sim.bomb!.status,'dropped');assert.equal(sim.bomb!.carrierId,null);
 sim.finish();sim.time=sim.nextRoundAt;sim.step();assert.equal(sim.round,2);assert.equal(a.hp,100);assert.equal(sim.bomb!.status,'carried');assert.equal(sim.bomb!.carrierId,a.id);
});
