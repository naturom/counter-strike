import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../apps/server/src/simulation';
import {signer} from '../apps/server/src/invites';
import {BOMB_RULES,DT,MAPS,groundAt,intersects,dustPoint,neutralInput,plantSite,validInput,type Input,type Player} from '@sirocco/shared';
function fixture(){const s=new Simulation('dunes','defusal'),red=s.add('r','Red'),blue=s.add('b','Blue');s.step();return{s,red,blue};}
function send(s:Simulation,p:Player,over:Partial<Input>={}){s.input(p.id,{...neutralInput(),weapon:p.weapon,seq:p.ack+1,...over});}
function ticks(s:Simulation,n:number,inputs:[Player,Partial<Input>][]=[]){for(let i=0;i<n;i++){for(const [p,input] of inputs)send(s,p,input);s.step();}}
const plant={weapon:'bomb' as const,fire:true};
const siteA=dustPoint(820,190,3.8),siteB=dustPoint(195,220,2);
function planted(){const f=fixture();Object.assign(f.red,siteA);ticks(f.s,98,[[f.red,plant]]);assert.equal(f.s.bomb?.status,'planted');return f;}
test('one carrier per team; late joiners and attempts at the wrong site cannot plant',()=>{
 const {s,red,blue}=fixture();const other=s.add('r2','Second attacker');assert.equal(s.bomb?.carrierId,red.id);assert.equal(other.hp,0,'mid-round join waits for rematch');
 Object.assign(blue,siteA);ticks(s,110,[[blue,plant]]);assert.equal(blue.weapon,'bomb');assert.equal(s.bombs[1].status,'carried');assert.equal(s.bombs[1].action,null);assert.equal(s.bomb?.status,'carried');
 Object.assign(red,dustPoint(380,930,3.2));ticks(s,110,[[red,plant]]);assert.equal(s.bomb?.action,null);assert.equal(s.bomb?.status,'carried');assert.ok(validInput({...neutralInput(),weapon:'bomb'}));
});
for(const [name,point] of [['A',siteA],['B',siteB]] as const)test(`plant at ${name} requires a continuous 3.2 second hold`,()=>{
 const {s,red,blue}=fixture(),actor=name==='A'?red:blue,bomb=s.bombs.find(b=>b.team===actor.team)!;Object.assign(actor,point);assert.equal(plantSite(actor,'dunes',actor.team)?.id,name);
 ticks(s,96,[[actor,plant]]);assert.equal(bomb.status,'carried');ticks(s,2,[[actor,plant]]);assert.equal(bomb.status,'planted');assert.equal(bomb.siteId,name);assert.ok(Math.abs(bomb.explodeAt-s.time-BOMB_RULES.fuseMs)<DT*1000+1);assert.equal(actor.weapon,'rifle');
});
test('release, movement, weapon switching, airborne state and stale input cancel planting without saving progress',()=>{
 for(const cancel of [{fire:false},{forward:1},{weapon:'pistol' as const},{jump:true}]){
  const {s,red}=fixture();Object.assign(red,siteA);ticks(s,40,[[red,plant]]);assert.ok(s.bomb?.action);send(s,red,{...plant,...cancel});s.step();assert.equal(s.bomb?.action,null);
  Object.assign(red,siteA,{grounded:true,vy:0});ticks(s,60,[[red,plant]]);assert.equal(s.bomb?.status,'carried');
 }
 const {s,red}=fixture();Object.assign(red,siteA);ticks(s,40,[[red,plant]]);ticks(s,6);assert.equal(s.bomb?.action,null);
});
test('a complete plant overrides the round timer; explosion wins for attackers',()=>{
 const {s}=planted();s.endsAt=s.time+10;ticks(s,20);assert.equal(s.phase,'playing');s.time=s.bomb!.explodeAt-DT*1000;s.step();assert.equal(s.bomb?.status,'exploded');assert.equal(s.winner,'red');assert.match(s.outcome,/detonated/);
});
test('only a living nearby defender can defuse, with a continuous 10 second hold',()=>{
 const {s,red,blue}=planted();Object.assign(blue,siteA);ticks(s,100,[[red,{interact:true}]]);assert.equal(s.bomb?.action,null);
 ticks(s,150,[[blue,{interact:true}]]);assert.equal(s.snapshot().bomb?.action?.kind,'defuse');send(s,blue,{interact:false});s.step();assert.equal(s.bomb?.action,null);
 ticks(s,299,[[blue,{interact:true}]]);assert.equal(s.phase,'playing');ticks(s,2,[[blue,{interact:true}]]);assert.equal(s.bomb?.status,'defused');assert.equal(s.winner,null);assert.equal(s.phase,'playing');
});
test('defuse rejects distance and wall obstruction; movement and death reset progress',()=>{
 const {s,red,blue}=planted();Object.assign(blue,dustPoint(590,225));ticks(s,10,[[blue,{interact:true}]]);assert.equal(s.bomb?.action,null);
 Object.assign(blue,{...siteA,x:siteA.x+1});const wall={x:(blue.x+siteA.x)/2,y:4.8,z:siteA.z,w:.15,h:2,d:3,kind:'wall' as const};s.solids=[...s.solids,wall];ticks(s,10,[[blue,{interact:true}]]);assert.equal(s.bomb?.action,null);s.solids=s.solids.filter(b=>b!==wall);
 Object.assign(blue,siteA);ticks(s,20,[[blue,{interact:true}]]);send(s,blue,{interact:true,strafe:1});s.step();assert.equal(s.bomb?.action,null);
 Object.assign(blue,siteA,{protectedUntil:0});ticks(s,20,[[blue,{interact:true}]]);s.damage(blue,100,red,'rifle',red);s.step();assert.equal(s.bomb?.action,null);assert.equal(s.winner,'red');
});
test('killed or disconnected carriers drop C4 and only attackers can recover it',()=>{
 const s=new Simulation('dunes','defusal'),r=s.add('r','Red'),b=s.add('b','Blue'),r2=s.add('r2','Red2');s.step();Object.assign(r,siteA,{protectedUntil:0});Object.assign(r2,siteA);Object.assign(b,siteA);s.damage(r,100,b,'rifle',b);assert.equal(s.bomb?.status,'dropped');
 send(s,b,{interact:true});s.step();assert.equal(s.bomb?.carrierId,null);send(s,r2,{interact:true});s.step();assert.equal(s.bomb?.carrierId,r2.id);s.disconnect(r2.id);assert.equal(s.bomb?.status,'dropped');assert.equal(s.bomb?.carrierId,null);
});
test('defusal has no combat respawns; elimination wins for the survivor and a timeout is a draw',()=>{
 const s=new Simulation('dunes','defusal'),r=s.add('r','R'),b=s.add('b','B'),r2=s.add('r2','R2');s.step();r.protectedUntil=0;s.damage(r,100,b,'rifle',b);ticks(s,100);assert.equal(r.hp,0);assert.equal(s.phase,'playing');r2.protectedUntil=0;s.damage(r2,100,b,'rifle',b);s.step();assert.equal(s.winner,'blue');
 const f=fixture();f.s.time=f.s.endsAt;f.s.step();assert.equal(f.s.winner,'draw');
});
test('eliminating attackers after planting does not stop the fuse',()=>{
 const {s,red,blue}=planted();red.protectedUntil=0;s.damage(red,100,blue,'rifle',blue);s.step();assert.equal(s.phase,'playing');assert.equal(s.bomb?.status,'planted');
});
test('detonation beats a defuse at the same tick, rematch resets C4 and all progress',()=>{
 const {s,blue}=planted();Object.assign(blue,siteA);send(s,blue,{interact:true});s.step();s.bomb!.action!.completeAt=s.bomb!.explodeAt;s.time=s.bomb!.explodeAt-DT*1000;send(s,blue,{interact:true});s.step();assert.equal(s.winner,'red');
 s.rematch();assert.equal(s.phase,'playing');assert.equal(s.bomb?.status,'carried');assert.equal(s.bomb?.action,null);assert.equal(s.bomb?.explodeAt,0);assert.equal(s.outcome,'');assert.ok([...s.players.values()].every(p=>p.hp===100));
 const snap=s.snapshot();snap.bomb!.carrierId='forged';assert.notEqual(s.bomb?.carrierId,'forged');
});
test('game mode is signed, legacy invites stay deathmatch, and Relay cannot accept defusal',()=>{
 const signs=signer('bomb-mode-test-secret-with-at-least-32-bytes');const token=signs.create(100,'dunes','defusal');assert.equal(signs.verify(token,101).mode,'defusal');assert.equal(signs.verify(signs.create(100,'dunes'),101).mode,'deathmatch');assert.throws(()=>signs.verify(token.replace('defusal','deathmatch')+'x',101));assert.throws(()=>signs.verify(signs.create(100,'relay','defusal'),101));
});

test('both teams reject the other target and can only equip their own C4',()=>{
 const {s,red,blue}=fixture();Object.assign(red,siteB);Object.assign(blue,siteA);ticks(s,110,[[red,plant],[blue,plant]]);
 assert.deepEqual(s.bombs.map(b=>b.status),['carried','carried']);assert.ok(s.bombs.every(b=>!b.action));
 const third=s.add('r2','R2');s.roundLive=false;third.hp=100;Object.assign(third,siteA);ticks(s,100,[[third,plant]]);assert.notEqual(third.weapon,'bomb');assert.equal(s.bombs[0].carrierId,red.id);
});
test('blue can plant only at B and wins on its own detonation',()=>{
 const {s,blue}=fixture();Object.assign(blue,siteB);ticks(s,98,[[blue,plant]]);const bomb=s.bombs[1];assert.equal(bomb.siteId,'B');
 s.time=bomb.explodeAt-DT*1000;s.step();assert.equal(s.winner,'blue');assert.equal(s.scores.blue,1);
});
test('concurrent plants count down independently and the earliest detonation wins',()=>{
 const {s,red,blue}=fixture();Object.assign(red,siteA);Object.assign(blue,siteB);ticks(s,98,[[blue,plant]]);ticks(s,98,[[red,plant]]);
 assert.ok(s.bombs.every(b=>b.status==='planted'));assert.ok(s.bombs[1].explodeAt<s.bombs[0].explodeAt);
 s.time=s.bombs[0].explodeAt;s.step();assert.equal(s.winner,'blue','earlier fuse wins even if a delayed tick covers both');
});
test('exact simultaneous detonations draw independently of player insertion order',()=>{
 const {s,red,blue}=fixture();Object.assign(red,siteA);Object.assign(blue,siteB);ticks(s,98,[[red,plant],[blue,plant]]);assert.equal(s.bombs[0].explodeAt,s.bombs[1].explodeAt);
 s.time=s.bombs[0].explodeAt-DT*1000;s.step();assert.equal(s.winner,'draw');assert.ok(s.bombs.every(b=>b.status==='exploded'));
});
test('defusing an enemy charge does not discard your planted charge or award an early win',()=>{
 const {s,red,blue}=fixture();Object.assign(red,siteA);Object.assign(blue,siteB);ticks(s,98,[[red,plant],[blue,plant]]);
 Object.assign(blue,siteA);ticks(s,302,[[blue,{interact:true}]]);assert.equal(s.bombs[0].status,'defused');assert.equal(s.bombs[1].status,'planted');assert.equal(s.phase,'playing');
 s.time=s.bombs[1].explodeAt-DT*1000;s.step();assert.equal(s.winner,'blue');
});
test('each team recovers only its own dropped charge; rematch resets both carriers and snapshot copies',()=>{
 const s=new Simulation('dunes','defusal'),red=s.add('r','R'),blue=s.add('b','B'),red2=s.add('r2','R2'),blue2=s.add('b2','B2');s.step();
 Object.assign(red,siteA);Object.assign(blue,siteA);s.disconnect(red.id);s.disconnect(blue.id);Object.assign(red2,siteA);Object.assign(blue2,siteA);
 ticks(s,1,[[red2,{interact:true}],[blue2,{interact:true}]]);assert.equal(s.bombs[0].carrierId,red2.id);assert.equal(s.bombs[1].carrierId,blue2.id);
 const copy=s.snapshot();copy.bombs[1].carrierId='forged';assert.notEqual(s.bombs[1].carrierId,'forged');s.finish();s.rematch();assert.ok(s.bombs.every(b=>b.status==='carried'&&!b.action&&b.explodeAt===0));
});
test('both charges can be defused concurrently without mixing progress or owners',()=>{
 const {s,red,blue}=fixture();Object.assign(red,siteA);Object.assign(blue,siteB);ticks(s,98,[[red,plant],[blue,plant]]);
 Object.assign(red,siteB);Object.assign(blue,siteA);ticks(s,100,[[red,{interact:true}],[blue,{interact:true}]]);
 assert.equal(s.bombs[0].action?.playerId,blue.id);assert.equal(s.bombs[1].action?.playerId,red.id);
 ticks(s,202,[[red,{interact:true}],[blue,{interact:true}]]);assert.ok(s.bombs.every(b=>b.status==='defused'));assert.equal(s.winner,'draw');
});

test('B planting includes the exposed north side of the old painted marker',()=>{
 const {s,blue}=fixture();Object.assign(blue,dustPoint(205,137,2.65));
 assert.equal(plantSite(blue,'dunes','blue')?.id,'B');ticks(s,98,[[blue,plant]]);assert.equal(s.bombs[1].status,'planted');
});

test('blue can plant across the whole visible B marker with clear feet and correct floor height',()=>{
 const map=MAPS.dunes,marker=map.bombSites!.find(b=>b.id==='B')!.marker;
 for(const dx of [-.5,0,.5])for(const dz of [-.5,0,.5]){
  const {s,blue}=fixture(),point={x:marker.x+dx*(marker.size-.12),y:marker.y,z:marker.z+dz*(marker.size-.12)};
  assert.ok(!map.solids.some(b=>intersects(point,b)),`marker overlaps cover at ${dx},${dz}`);
  assert.ok(Math.abs(groundAt(point,map.solids)-point.y)<.001,'marker lies on its visible floor');
  assert.equal(plantSite(point,'dunes','blue')?.id,'B');assert.equal(plantSite(point,'dunes','red'),undefined);
  Object.assign(blue,point);ticks(s,98,[[blue,plant]]);assert.equal(s.bombs[1].status,'planted',`cannot plant at marker ${dx},${dz}`);
 }
});
test('the B platform and entry ramp permit planting while nearby non-site ground stays excluded',()=>{
 const map=MAPS.dunes;let checked=0;
 for(let u=139;u<252;u+=7)for(let v=121;v<211;v+=7){
  const p=dustPoint(u,v);p.y=groundAt(p,map.solids);
  if(p.y<2||p.y>2.65||map.solids.some(b=>intersects(p,b)))continue;
  assert.equal(plantSite(p,'dunes','blue')?.id,'B',`B platform point rejected at ${u},${v}`);checked++;
 }
 assert.ok(checked>100);
 for(const p of [dustPoint(275,250,1.35),dustPoint(200,300,2),dustPoint(217,164,4.1)])assert.equal(plantSite(p,'dunes','blue'),undefined);
});
