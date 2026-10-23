import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../apps/server/src/simulation';
import {signer} from '../apps/server/src/invites';
import {BOMB_RULES,DT,dustPoint,neutralInput,plantSite,validInput,type Input,type Player} from '@sirocco/shared';
function fixture(){const s=new Simulation('dunes','defusal'),red=s.add('r','Red'),blue=s.add('b','Blue');s.step();return{s,red,blue};}
function send(s:Simulation,p:Player,over:Partial<Input>={}){s.input(p.id,{...neutralInput(),weapon:p.weapon,seq:p.ack+1,...over});}
function ticks(s:Simulation,n:number,inputs:[Player,Partial<Input>][]=[]){for(let i=0;i<n;i++){for(const [p,input] of inputs)send(s,p,input);s.step();}}
const plant={weapon:'bomb' as const,fire:true};
const siteA=dustPoint(820,190,3.8),siteB=dustPoint(195,220,2);
function planted(){const f=fixture();Object.assign(f.red,siteA);ticks(f.s,98,[[f.red,plant]]);assert.equal(f.s.bomb?.status,'planted');return f;}
test('C4 is assigned only to one attacker; defenders and remote clients cannot select or plant it',()=>{
 const {s,red,blue}=fixture();const other=s.add('r2','Second attacker');assert.equal(s.bomb?.carrierId,red.id);assert.equal(other.hp,0,'mid-round join waits for rematch');
 Object.assign(blue,siteA);ticks(s,110,[[blue,plant]]);assert.notEqual(blue.weapon,'bomb');assert.equal(s.bomb?.status,'carried');
 Object.assign(red,dustPoint(380,930,3.2));ticks(s,110,[[red,plant]]);assert.equal(s.bomb?.action,null);assert.equal(s.bomb?.status,'carried');assert.ok(validInput({...neutralInput(),weapon:'bomb'}));
});
for(const [name,point] of [['A',siteA],['B',siteB]] as const)test(`plant at ${name} requires a continuous 3.2 second hold`,()=>{
 const {s,red}=fixture();Object.assign(red,point);assert.equal(plantSite(red,'dunes')?.id,name);
 ticks(s,96,[[red,plant]]);assert.equal(s.bomb?.status,'carried');ticks(s,2,[[red,plant]]);assert.equal(s.bomb?.status,'planted');assert.equal(s.bomb?.siteId,name);assert.ok(Math.abs(s.bomb!.explodeAt-s.time-BOMB_RULES.fuseMs)<DT*1000+1);assert.equal(red.weapon,'rifle');
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
 ticks(s,299,[[blue,{interact:true}]]);assert.equal(s.phase,'playing');ticks(s,2,[[blue,{interact:true}]]);assert.equal(s.bomb?.status,'defused');assert.equal(s.winner,'blue');
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
test('defusal has no combat respawns; elimination before a plant and timeout favor defenders',()=>{
 const s=new Simulation('dunes','defusal'),r=s.add('r','R'),b=s.add('b','B'),r2=s.add('r2','R2');s.step();r.protectedUntil=0;s.damage(r,100,b,'rifle',b);ticks(s,100);assert.equal(r.hp,0);assert.equal(s.phase,'playing');r2.protectedUntil=0;s.damage(r2,100,b,'rifle',b);s.step();assert.equal(s.winner,'blue');
 const f=fixture();f.s.time=f.s.endsAt;f.s.step();assert.equal(f.s.winner,'blue');
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
