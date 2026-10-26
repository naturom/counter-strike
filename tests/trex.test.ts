import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../apps/server/src/simulation';
import {TrexNavigation} from '../apps/server/src/trex-navigation';
import {HiddenInput} from '../apps/web/components/hidden-input';
import {trexSignal,trexDuration,type TrexSound} from '../apps/web/components/trex-audio';
import {TREX_RULES,rayTrex,MAPS,neutralInput,validInput,direction,intersects,type Trex,type Solid,type Player,type CombatEvent} from '@sirocco/shared';

function fixture(){const s=new Simulation([]),p=s.add('a','Summoner');Object.assign(p,{x:0,y:0,z:10,yaw:0,pitch:0,protectedUntil:0});return {s,p};}
function summon(s:Simulation,p:Player){s.input(p.id,{...neutralInput(),seq:p.ack+1,yaw:p.yaw,summon:true});s.step();return s.trexes.at(-1)!;}
test('the hidden gesture requires two deliberate presses and is absent from visible controls',()=>{
 const input=new HiddenInput(),key={code:'KeyK',repeat:false};assert.equal(input.key(key,100),false);assert.equal(input.key({...key,repeat:true},150),false);assert.equal(input.key(key,400),true);assert.equal(input.key(key,500),false);assert.equal(input.key(key,1000),false);assert.equal(input.key(key,1200),true);
 input.reset();assert.equal(input.key(key,1400),false);input.key({code:'KeyW',repeat:false},1500);assert.equal(input.key(key,1600),false);assert.equal(input.key({...key,ctrlKey:true},1650),false);assert.equal(input.key(key,1700),false);
 assert.equal(validInput({...neutralInput(),summon:true}),true);assert.equal(validInput({...neutralInput(),summon:'yes'}),false);
 const ui=readFileSync('apps/web/components/Game.tsx','utf8');assert.ok(!/KeyK|double.?K|summon|<kbd>K<\/kbd>/i.test(ui));
});
test('summons appear on navigable ground ahead, have ten times player HP, and never exceed three',()=>{
 const {s,p}=fixture();summon(s,p);const first=s.trexes[0];assert.equal(first.hp,1000);assert.equal(first.hp,p.hp*10);assert.ok(first.z<p.z);assert.equal(first.y,0);assert.equal(s.events.filter(e=>e.type==='trexRoar').length,1);
 for(let i=0;i<8;i++)summon(s,p);assert.equal(s.trexes.length,3);assert.equal(TREX_RULES.limit,3);
 const copy=s.snapshot();copy.trexes[0].hp=1;copy.trexes[0].x=999;assert.equal(first.hp,1000);assert.notEqual(first.x,999);
 const count=s.trexes.length;p.hp=0;summon(s,p);assert.equal(s.trexes.length,count);
});
test('street spawning works at the normal Dust III and Relay starting areas',()=>{
 for(const map of ['dunes','relay'] as const){const s=new Simulation(map),p=s.add('a','Summoner'),t=summon(s,p);assert.ok(t,`${map}: default forward summon needs a street position`);assert.ok(t.z<p.z);assert.equal(s.solids.some(b=>intersects({...t,y:t.y+.012},b,TREX_RULES.height,TREX_RULES.radius)),false);}
});
test('navigation routes around cover, cannot cross walls, and rejects covered spawn points',()=>{
 const wall:Solid={x:0,y:3,z:0,w:8,h:6,d:.4,kind:'wall'},nav=new TrexNavigation([wall],MAPS.relay),from={x:0,y:0,z:8},to={x:0,y:0,z:-8};assert.equal(nav.clear(from,to),false);const path=nav.path(from,to);assert.ok(path.length>4);assert.ok(path.some(p=>Math.abs(p.x)>4.6));for(let i=1;i<path.length;i++)assert.ok(nav.clear(path[i-1],path[i]));
 const roof:Solid={x:0,y:6,z:0,w:5,h:.3,d:5,kind:'roof'},covered=new TrexNavigation([roof],MAPS.relay);assert.equal(covered.outdoors({x:0,y:0,z:0}),false);assert.equal(covered.point(0,0)?.y,0);
});
test('creatures roam without players, hunt both teams and can kill their summoner without awarding points',()=>{
 const first=fixture(),t=summon(first.s,first.p),start={x:t.x,z:t.z};first.p.connected=false;for(let i=0;i<180;i++)first.s.step();assert.equal(t.state,'roam');assert.ok(Math.hypot(t.x-start.x,t.z-start.z)>1,'idle creatures must wander');
 for(const team of ['red','blue'] as const){const {s,p}=fixture(),other=s.add('b','Opponent');Object.assign(other,{x:20,y:0,z:20,protectedUntil:0});const trex=summon(s,p),victim=team==='red'?p:other;Object.assign(victim,{x:trex.x,y:0,z:trex.z+5,protectedUntil:0});if(team==='blue')p.x=20;
  const events:CombatEvent[]=[];for(let i=0;i<240&&victim.hp>0;i++){s.step();events.push(...s.events);}assert.equal(victim.hp,0,`${team}: dinosaur must hunt and kill this team`);assert.equal(victim.deaths,1);assert.equal(events.find(e=>e.type==='kill')?.cause,'trex');assert.equal(events.find(e=>e.type==='kill')?.name,'T-REX');assert.deepEqual(s.scores,{red:0,blue:0});assert.ok([...s.players.values()].every(p=>p.kills===0));
 }
});
test('bites respect cover, height and the existing spawn protection',()=>{
 const {s,p}=fixture(),t=summon(s,p);Object.assign(t,{x:0,z:0});Object.assign(p,{x:0,y:0,z:2,protectedUntil:1e9});assert.equal(s.wildlife.canBite(t,p),true);for(let i=0;i<100;i++)s.step();assert.equal(p.hp,100);
 s.solids=[{x:0,y:2,z:1,w:8,h:4,d:.3,kind:'wall'}];assert.equal(s.wildlife.canBite(t,p),false);s.solids=[];p.y=6;assert.equal(s.wildlife.canBite(t,p),false);
});
test('gunfire and knives can kill a creature; dinosaur headshots hurt without an instant 1000-HP kill',()=>{
 for(const team of ['red','blue'] as const){const {s,p}=fixture(),shooter=team==='red'?p:s.add('b','Other');Object.assign(shooter,{x:0,y:0,z:10,yaw:0,pitch:0,protectedUntil:0});const t=summon(s,p);Object.assign(t,{x:0,y:0,z:0,yaw:0});if(shooter!==p)p.x=10;s.fire(shooter);assert.ok(t.hp<1000&&t.hp>=950);assert.equal(s.impacts.length,0,'creature hits must not leave a wall mark behind the body');
  while(t.hp>0)s.fire(shooter);assert.equal(t.hp,0);assert.equal(t.state,'dead');assert.equal(shooter.kills,0);assert.deepEqual(s.scores,{red:0,blue:0});assert.equal(s.events.filter(e=>e.type==='trexDeath').length,1);
 }
 const {s,p}=fixture(),t=summon(s,p);Object.assign(t,{x:0,y:0,z:0,yaw:Math.PI});Object.assign(p,{x:0,y:0,z:8,pitch:Math.atan2(3.12-1.6,8-1.8),weapon:'marksman',ammo:{...p.ammo,marksman:8}});s.fire(p);assert.equal(t.hp,860);assert.equal(s.events.at(-1)?.hitZone,'head');
 p.weapon='knife';p.x=0;p.z=t.z+1.7;p.pitch=0;const hp=t.hp;s.fire(p);assert.ok(t.hp<hp);
});
test('nearest creature occludes players behind it, and walls block shots at creatures',()=>{
 const {s,p}=fixture(),b=s.add('b','Behind'),t=summon(s,p);Object.assign(t,{x:0,y:0,z:0});Object.assign(b,{x:0,y:0,z:-5,protectedUntil:0});s.fire(p);assert.equal(b.hp,100);assert.ok(t.hp<1000);
 t.hp=1000;s.solids=[{x:0,y:3,z:5,w:6,h:6,d:.3,kind:'wall'}];s.fire(p);assert.equal(t.hp,1000);assert.equal(s.impacts.length,1);
});
test('oriented hit volumes follow the head and body instead of a giant enclosing box',()=>{
 const t:Trex={id:'trex-1',x:0,y:0,z:0,yaw:0,hp:1000,state:'roam',targetId:null,attackAt:0,deadAt:0};assert.equal(rayTrex({x:0,y:3.12,z:-8},{x:0,y:0,z:1},t)?.zone,'head');assert.equal(rayTrex({x:2,y:3.12,z:-8},{x:0,y:0,z:1},t),null);t.yaw=Math.PI/2;assert.equal(rayTrex({x:-8,y:3.12,z:0},{x:1,y:0,z:0},t)?.zone,'head');
});
test('grenade blasts damage creatures and corpses/rematches release the entity limit',()=>{
 const {s,p}=fixture(),t=summon(s,p);Object.assign(t,{x:0,y:0,z:0});s.grenades=[{id:99,owner:p.id,team:p.team,x:0,y:1.5,z:0,vx:0,vy:0,vz:0,explodeAt:s.time}];s.step();assert.ok(t.hp<1000);
 s.damageTrex(t,2000,p,'rifle',p);assert.equal(t.hp,0);for(let i=0;i<190;i++)s.step();assert.ok(!s.trexes.some(d=>d.id===t.id));s.phase='finished';s.rematch();assert.equal(s.snapshot().trexes.length,0);
});
test('creature sounds are bounded, finite and fade cleanly',()=>{
 for(const kind of ['trex-roar','trex-step','trex-bite','trex-death'] as TrexSound[]){const signal=trexSignal(12000,kind);assert.equal(signal.length,Math.ceil(trexDuration(kind)*12000));assert.ok(signal.every(n=>Number.isFinite(n)&&Math.abs(n)<=.801));assert.equal(signal[0],0);assert.equal(signal.at(-1),0);assert.ok(signal.some(n=>Math.abs(n)>.1));}
});
