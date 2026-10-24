import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../apps/server/src/simulation';
import {dustPoint,SCOUT_TOWER,neutralInput,type CombatEvent} from '@sirocco/shared';
function towerPlayer(hp=100){const s=new Simulation('dunes'),p=s.add('a','Jumper');Object.assign(p,{...dustPoint(613,575,SCOUT_TOWER.deck),hp,protectedUntil:100000});return {s,p};}
function jumpOff(s:Simulation){const events:CombatEvent[]=[];for(let seq=1;seq<=100;seq++){s.input('a',{...neutralInput(),seq,jump:seq===1,forward:seq<24?1:0,yaw:-Math.PI/2});s.step();events.push(...s.events);if(s.players.get('a')!.hp===0)break;}return events;}
test('jumping from the tower deals exactly 50 health once on landing, including on a lower roof',()=>{const {s,p}=towerPlayer();const events=jumpOff(s),damage=events.filter(e=>e.type==='damage');assert.equal(p.hp,50);assert.equal(damage.length,1);assert.equal(damage[0].damage,50);assert.equal(damage[0].cause,'fall');assert.equal(damage[0].target,p.id);assert.ok(p.y<SCOUT_TOWER.deck-3);assert.equal(p.kills,0);assert.equal(s.scores.red,0);});
test('fatal tower fall records a death without awarding a kill or score',()=>{const {s,p}=towerPlayer(40);const events=jumpOff(s);assert.equal(p.hp,0);assert.equal(p.deaths,1);assert.equal(p.kills,0);assert.equal(s.scores.red,0);assert.equal(events.find(e=>e.type==='kill')?.cause,'fall');assert.equal(events.find(e=>e.type==='damage')?.damage,40);});
test('jumping and landing on the same lookout does not cost health',()=>{const {s,p}=towerPlayer();Object.assign(p,dustPoint(567,577,SCOUT_TOWER.deck));for(let seq=1;seq<45;seq++){s.input(p.id,{...neutralInput(),seq,jump:seq===1});s.step();}assert.equal(p.hp,100);assert.equal(p.y,SCOUT_TOWER.deck);});
test('ordinary drops elsewhere do not cause tower damage',()=>{const {s,p}=towerPlayer();Object.assign(p,dustPoint(400,700,SCOUT_TOWER.deck));for(let i=0;i<100;i++)s.step();assert.equal(p.hp,100);});

test('a fatal tower fall eliminates the player in C4 mode',()=>{const s=new Simulation('dunes','defusal'),p=s.add('a','Jumper');s.add('b','Opponent');Object.assign(p,{...dustPoint(613,575,SCOUT_TOWER.deck),hp:40,protectedUntil:0});jumpOff(s);assert.equal(p.hp,0);assert.equal(p.deaths,1);assert.equal(s.winner,'blue');assert.equal(s.phase,'finished');});

for(const [side,u,v,yaw] of [['west',511.5,525,Math.PI/2],['east',622.5,525,-Math.PI/2],['north',567,459.5,0],['south',567,590.5,Math.PI]] as const){
 test(`dropping from the outer lip of the ${side} tower parapet costs 50 health`,()=>{
  const {s,p}=towerPlayer();Object.assign(p,{...dustPoint(u,v,SCOUT_TOWER.deck+.78),grounded:true});const damage:CombatEvent[]=[];
  for(let seq=1;seq<=90;seq++){s.input(p.id,{...neutralInput(),seq,forward:seq<=12?1:0,yaw});s.step();damage.push(...s.events.filter(e=>e.type==='damage'));}
  assert.equal(p.hp,50);assert.equal(damage.length,1);assert.equal(damage[0].cause,'fall');
 });
}
