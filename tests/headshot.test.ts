import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../apps/server/src/simulation';
import {AVATARS,WEAPONS,rayPlayer,eyeOf,neutralInput,type Weapon} from '@sirocco/shared';
function duel(){const s=new Simulation([]),a=s.add('a','Alpha'),b=s.add('b','Bravo');Object.assign(a,{x:0,y:0,z:3,yaw:0,pitch:0,protectedUntil:0});Object.assign(b,{x:0,y:0,z:-3,protectedUntil:0});return {s,a,b};}
function aim(a:{y:number;pitch:number;crouched:boolean},height:number){a.pitch=Math.atan2(height-a.y-eyeOf(a),6);}
for(const weapon of Object.keys(WEAPONS) as Weapon[]){
 test(`${weapon}: one headshot kills at full health and publishes headshot metadata`,()=>{
  const {s,a,b}=duel();a.weapon=weapon;a.ammo[weapon]=5;s.fire(a);
  assert.equal(b.hp,0);assert.equal(a.kills,1);assert.equal(b.deaths,1);assert.equal(s.scores.red,1);assert.equal(a.ammo[weapon],4);
  for(const type of ['shot','damage','kill']){const e=s.events.find(e=>e.type===type);assert.equal(e?.target,b.id);assert.equal(e?.hitZone,'head');}
  assert.equal(s.events.find(e=>e.type==='damage')?.damage,100);
 });
 test(`${weapon}: torso damage is unchanged`,()=>{const {s,a,b}=duel();a.weapon=weapon;a.ammo[weapon]=5;aim(a,1.1);s.fire(a);assert.equal(b.hp,100-WEAPONS[weapon].damage);assert.equal(s.events.find(e=>e.type==='damage')?.hitZone,'body');assert.equal(a.kills,0);});
}
test('all appearances use the same head hit zone',()=>{for(const {id:avatar} of AVATARS){const {s,a,b}=duel();b.avatar=avatar as typeof b.avatar;s.fire(a);assert.equal(b.hp,0,avatar);}});
test('head hitbox follows crouching and elevation, with crouched shooters supported',()=>{
 for(const crouched of [false,true])for(const y of [0,2]){const {s,a,b}=duel();Object.assign(b,{crouched,y});a.crouched=true;aim(a,y+1.72*(crouched?1.1/1.8:1));s.fire(a);assert.equal(b.hp,0);assert.equal(s.events.find(e=>e.type==='kill')?.hitZone,'head');}
 const {s,a,b}=duel();b.crouched=true;s.fire(a);assert.equal(b.hp,100,'standing eye level passes over a crouched player');
});
test('empty space beside and above the head is a miss',()=>{for(const offset of [{x:.23,y:1.65},{x:0,y:1.9},{x:.13,y:1.76}]){const p={x:0,y:0,z:0,crouched:false,vy:0,grounded:true};assert.equal(rayPlayer({x:offset.x,y:offset.y,z:3},{x:0,y:0,z:-1},p),null);}});
test('a ray that strikes torso first is a body hit even if it later crosses the head',()=>{const hit=rayPlayer({x:0,y:1.2,z:.4},{x:0,y:.8,z:-.6},{x:0,y:0,z:0,vy:0,grounded:true});assert.equal(hit?.zone,'body');});
test('walls, friendly players and protected players stop headshots',()=>{
 for(const blocker of ['wall','friend','protected'] as const){const {s,a,b}=duel();if(blocker==='wall')s.solids=[{x:0,y:1.6,z:0,w:2,h:.5,d:.3,kind:'wall'}];else{const c=s.add('c','Blocker');Object.assign(c,{x:0,y:0,z:0,protectedUntil:blocker==='protected'?1000:0,team:blocker==='friend'?a.team:b.team});}s.fire(a);assert.equal(b.hp,100);assert.equal(a.kills,0);assert.equal(s.events.some(e=>e.type==='damage'),false);}
});
test('nearest enemy takes the headshot; full-health enemy behind survives',()=>{const {s,a,b}=duel(),c=s.add('c','Behind');Object.assign(c,{x:0,y:0,z:-6,team:b.team,protectedUntil:0});s.fire(a);assert.equal(b.hp,0);assert.equal(c.hp,100);});
test('knife strikes at head height and explosion damage do not become headshots',()=>{const {s,a,b}=duel();b.z=1.5;a.weapon='knife';s.fire(a);assert.equal(b.hp,60);assert.equal(s.events.find(e=>e.type==='damage')?.hitZone,undefined);s.damage(b,20,a,'grenade',a);assert.equal(b.hp,40);assert.equal(s.events.at(-1)?.hitZone,undefined);});
test('normal input cadence cannot award duplicate kills for a dead headshot target',()=>{const {s,a,b}=duel();for(let seq=1;seq<=15;seq++){s.input(a.id,{...neutralInput(),seq,fire:true});s.step();}assert.equal(b.hp,0);assert.equal(a.kills,1);assert.equal(b.deaths,1);assert.equal(s.scores.red,1);});
