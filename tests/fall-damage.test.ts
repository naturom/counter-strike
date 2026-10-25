import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../apps/server/src/simulation';
import {dustPoint,SCOUT_TOWER,FALL_DAMAGE,fallDamage,RESPAWN_MS,neutralInput,type CombatEvent,type Solid,type Player,type Input} from '@sirocco/shared';

function run(s:Simulation,p:Player,ticks=120,controls:Partial<Input>={}){const events:CombatEvent[]=[];let peak=p.y;for(let i=0;i<ticks;i++){s.input(p.id,{...neutralInput(),seq:p.ack+1,...controls});s.step();peak=Math.max(peak,p.y);events.push(...s.events);if(p.hp===0)break;}return {events,peak};}
function drop(height:number,solids:Solid[]=[],crouched=false){const s=new Simulation(solids),p=s.add('a','Jumper');Object.assign(p,{x:0,y:height,z:0,vy:0,grounded:false,crouched,protectedUntil:100000});return {s,p};}
function damage(events:CombatEvent[]){return events.filter(e=>e.type==='damage'&&e.cause==='fall');}
function towerPlayer(hp=100){const s=new Simulation('dunes'),p=s.add('a','Jumper');Object.assign(p,{...dustPoint(613,575,SCOUT_TOWER.deck),hp,protectedUntil:100000});return {s,p};}
function jumpOff(s:Simulation){const p=s.players.get('a')!,events:CombatEvent[]=[];let peak=p.y;for(let seq=1;seq<=100;seq++){s.input(p.id,{...neutralInput(),seq,jump:seq===1,forward:seq<24?1:0,yaw:-Math.PI/2});s.step();peak=Math.max(peak,p.y);events.push(...s.events);if(p.hp===0)break;}return {events,peak};}

test('fall damage rises smoothly beyond four metres and reaches 100 HP at fifteen metres',()=>{
 assert.equal(FALL_DAMAGE.safeHeight,4);assert.equal(FALL_DAMAGE.lethalHeight,15);
 for(const height of [-10,0,1.8,3,3.99,4])assert.equal(fallDamage(height),0);
 assert.equal(fallDamage(5),4);assert.equal(fallDamage(8),26);assert.equal(fallDamage(12),65);assert.equal(fallDamage(15),100);assert.equal(fallDamage(30),100);
 let previous=0;for(let h=4.01;h<30;h+=.05){const amount=fallDamage(h);assert.ok(Number.isInteger(amount)&&amount>=previous&&amount>=1&&amount<=100);previous=amount;}
 assert.equal(fallDamage(NaN),0);
});
test('drops anywhere deal height-based damage once on landing, including during spawn protection',()=>{
 for(const height of [2,3,3.9,4,4.1,5,8,12,16]){
  const {s,p}=drop(height),events:CombatEvent[]=[];
  while(!p.grounded&&p.hp>0){s.step();events.push(...s.events);if(!p.grounded)assert.equal(p.hp,100,'fall damage must wait until landing');}
  const amount=fallDamage(height);assert.equal(p.hp,100-amount);assert.equal(damage(events).length,amount?1:0);if(amount)assert.equal(damage(events)[0].damage,amount);
  assert.equal(p.kills,0);assert.deepEqual(s.scores,{red:0,blue:0});if(p.hp>0){run(s,p,25);assert.equal(p.hp,100-amount,'standing on the landing must not repeat the damage');}
 }
});
test('walking off an ordinary unlabelled box counts a fall on the Relay map',()=>{
 const box:Solid={x:0,y:5.9,z:0,w:2,h:.2,d:4,kind:'crate'},s=new Simulation([box]),p=s.add('a','Jumper');Object.assign(p,{x:0,y:6,z:0,grounded:true,protectedUntil:100000});
 const result=run(s,p,70,{strafe:1});assert.equal(s.mapId,'relay');assert.equal(p.y,0);assert.equal(p.hp,100-fallDamage(6));assert.equal(damage(result.events).length,1);
});
test('landing on a roof measures only the distance to that roof, then resets for a second drop to ground',()=>{
 const start:Solid={x:0,y:11.9,z:0,w:2,h:.2,d:4,kind:'roof'},roof:Solid={x:5,y:5.9,z:0,w:4,h:.2,d:4,kind:'roof'},s=new Simulation([start,roof]),p=s.add('a','Jumper');Object.assign(p,{x:0,y:12,z:0,grounded:true,protectedUntil:100000});
 const events:CombatEvent[]=[];for(let i=0;i<70;i++){const step=run(s,p,1,{strafe:1});events.push(...step.events);if(p.grounded&&p.y===6)break;}
 assert.equal(p.y,6);assert.equal(p.grounded,true);assert.equal(p.hp,100-fallDamage(6));assert.equal(damage(events).length,1);
 run(s,p,8);const second=run(s,p,90,{strafe:1});assert.equal(p.y,0);assert.equal(p.hp,100-2*fallDamage(6));assert.equal(damage(second.events).length,1);assert.equal(damage(second.events)[0].damage,fallDamage(6));
});
test('the same fall height hurts equally when crouched and standing',()=>{
 for(const crouched of [false,true]){const {s,p}=drop(8,[],crouched),result=run(s,p,60,{crouch:crouched});assert.equal(p.hp,100-fallDamage(8));assert.equal(damage(result.events).length,1);}
});
test('normal jumps, descending stairs and continuous slopes do not accumulate fall damage',()=>{
 const platform:Solid={x:0,y:7.9,z:0,w:20,h:.2,d:20,kind:'roof'},s=new Simulation([platform]),p=s.add('a','Jumper');Object.assign(p,{x:0,y:8,z:0,grounded:true});
 run(s,p,1,{jump:true});const result=run(s,p,50);assert.equal(p.y,8);assert.equal(p.hp,100);assert.equal(damage(result.events).length,0);
 const ramp:Solid={x:0,y:5,z:0,w:20,h:10,d:4,kind:'floor',ramp:{axis:'x',from:10,to:0}},r=new Simulation([ramp]),walker=r.add('b','Walker');Object.assign(walker,{x:-9.6,y:9.8,z:0,grounded:true});const descent=run(r,walker,125,{strafe:1});assert.equal(walker.y,0);assert.equal(walker.hp,100);assert.equal(damage(descent.events).length,0);
 const stairs:Solid[]=Array.from({length:30},(_,i)=>({x:i*.5,y:(6-i*.2)/2,z:0,w:.5,h:6-i*.2,d:4,kind:'floor'}));const t=new Simulation(stairs),stepper=t.add('c','Stepper');Object.assign(stepper,{x:0,y:6,z:0,grounded:true});const down=run(t,stepper,100,{strafe:1});assert.equal(stepper.y,0);assert.equal(stepper.hp,100);assert.equal(damage(down.events).length,0);
});
test('hitting a ceiling does not clear the fall height, and jumping from a ledge includes the apex',()=>{
 const ceiling:Solid={x:0,y:10.3,z:0,w:4,h:.2,d:4,kind:'roof'},first=drop(8,[ceiling]);first.p.vy=5;const blocked=run(first.s,first.p,90);assert.ok(blocked.peak>8&&blocked.peak<=8.40001);assert.equal(first.p.hp,100-fallDamage(blocked.peak));assert.equal(damage(blocked.events).length,1);
 const platform:Solid={x:0,y:5.9,z:0,w:2,h:.2,d:4,kind:'roof'},s=new Simulation([platform]),p=s.add('a','Jumper');Object.assign(p,{x:1.2,y:6,z:0,grounded:true});run(s,p,1,{jump:true,strafe:1});const result=run(s,p,70,{strafe:1});assert.ok(result.peak>7.5);assert.equal(p.hp,100-fallDamage(result.peak));assert.ok(fallDamage(result.peak)>fallDamage(6));
});
test('respawn, rematch and seat reuse clear a previous airborne fall',()=>{
 const {s,p}=drop(20);run(s,p,5);s.spawn(p);run(s,p,30);assert.equal(p.hp,100);
 Object.assign(p,{x:0,y:20,z:0,grounded:false});run(s,p,5);s.phase='finished';s.rematch();run(s,p,30);assert.equal(p.hp,100);
 Object.assign(p,{x:0,y:20,z:0,grounded:false});run(s,p,5);s.remove(p.id);const replacement=s.add(p.id,'Replacement');run(s,replacement,30);assert.equal(replacement.hp,100);
});
test('a fatal fall records a body, death and five-second respawn without awarding points',()=>{
 const {s,p}=drop(16),result=run(s,p);assert.equal(p.hp,0);assert.equal(p.deaths,1);assert.equal(p.kills,0);assert.deepEqual(s.scores,{red:0,blue:0});assert.equal(result.events.find(e=>e.type==='kill')?.cause,'fall');assert.equal(p.respawnAt-p.death!.at,RESPAWN_MS);
});
test('tower-to-roof falls use the same height curve as every other surface',()=>{
 const {s,p}=towerPlayer(),result=jumpOff(s),hits=damage(result.events);assert.equal(hits.length,1);assert.equal(hits[0].damage,fallDamage(result.peak-p.y));assert.equal(p.hp,100-hits[0].damage);assert.equal(p.kills,0);assert.deepEqual(s.scores,{red:0,blue:0});
});
test('a fatal height-based fall eliminates the player in C4 mode',()=>{
 const s=new Simulation('dunes','defusal'),p=s.add('a','Jumper');s.add('b','Opponent');Object.assign(p,{...dustPoint(613,575,SCOUT_TOWER.deck),hp:5,protectedUntil:0});jumpOff(s);assert.equal(p.hp,0);assert.equal(p.deaths,1);assert.equal(s.winner,'blue');assert.equal(s.phase,'finished');
});
for(const [side,u,v,yaw] of [['west',511.5,525,Math.PI/2],['east',622.5,525,-Math.PI/2],['north',567,459.5,0],['south',567,590.5,Math.PI]] as const){
 test(`the outer lip of the ${side} tower parapet uses the generic fall curve`,()=>{
  const {s,p}=towerPlayer();Object.assign(p,{...dustPoint(u,v,SCOUT_TOWER.deck+.78),grounded:true});const events:CombatEvent[]=[];let peak=p.y;
  for(let seq=1;seq<=90;seq++){s.input(p.id,{...neutralInput(),seq,forward:seq<=12?1:0,yaw});s.step();peak=Math.max(peak,p.y);events.push(...s.events);if(p.hp===0)break;}
  assert.equal(damage(events).length,1);assert.equal(damage(events)[0].damage,fallDamage(peak-p.y));assert.equal(p.hp,100-fallDamage(peak-p.y));
 });
}
