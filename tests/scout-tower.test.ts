import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DUST2,dustPoint,scoutTowerRoute,SCOUT_TOWER,move,neutralInput,intersects,wallDistance,type Motion} from '@sirocco/shared';
test('scout tower can be entered from Catwalk, climbed without jumping, and descended',()=>{
 const route=scoutTowerRoute().map(p=>dustPoint(p.u,p.v,p.y));let p:Motion={...route[0],vy:0,grounded:true};
 for(const target of [...route.slice(1),...route.slice().reverse().slice(1)]){
  for(let step=0;step<400&&Math.hypot(target.x-p.x,target.z-p.z)>.13;step++)p=move(p,{...neutralInput(),forward:1,yaw:Math.atan2(p.x-target.x,p.z-target.z)},DUST2.solids);
  assert.ok(Math.hypot(target.x-p.x,target.z-p.z)<.15,`blocked approaching ${JSON.stringify(target)} from ${JSON.stringify(p)}`);
  assert.ok(Math.abs(p.y-target.y)<.24,`wrong stair elevation ${p.y} vs ${target.y}`);
  assert.equal(DUST2.solids.some(b=>intersects(p,b)),false,'standing head clearance');
 }
});
test('lookout accommodates several standing players above the playable buildings',()=>{
 assert.equal(SCOUT_TOWER.levels*2,8,'lookout is reached after eight flights');assert.ok(SCOUT_TOWER.deck>14);
 for(const u of [542,554,566,578,590]){const p={...dustPoint(u,563,SCOUT_TOWER.deck),vy:0,grounded:true};assert.equal(DUST2.solids.some(b=>intersects(p,b)),false);const landed=move(p,neutralInput(),DUST2.solids);assert.equal(landed.y,SCOUT_TOWER.deck);}
 const eye=dustPoint(567,562,SCOUT_TOWER.deck+1.6);for(const dir of [{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}])assert.ok(wallDistance(eye,dir,DUST2.solids)>25,'clear scouting sightline over parapets');
});

test('players can walk a complete circuit on all four lookout sides',()=>{
 const points=[[525,577],[525,473],[609,473],[609,577],[525,577]];
 let p:Motion={...dustPoint(525,577,SCOUT_TOWER.deck),vy:0,grounded:true};
 for(const [u,v] of points.slice(1)){
  const target=dustPoint(u,v,SCOUT_TOWER.deck);
  for(let step=0;step<200&&Math.hypot(target.x-p.x,target.z-p.z)>.13;step++)p=move(p,{...neutralInput(),forward:1,yaw:Math.atan2(p.x-target.x,p.z-target.z)},DUST2.solids);
  assert.ok(Math.hypot(target.x-p.x,target.z-p.z)<.15,`blocked on lookout at ${u},${v}`);assert.equal(p.y,SCOUT_TOWER.deck);
 }
 for(const b of DUST2.solids.filter(b=>b.label?.startsWith('Scout tower lookout parapet')))assert.ok(b.h<=.8,'outer parapets must not block the view');
});
test('stair landing guards close both ends of the centre well at every turn',()=>{
 for(let level=0;level<SCOUT_TOWER.levels;level++){
  const low=SCOUT_TOWER.base+level*SCOUT_TOWER.rise;
  assert.ok(wallDistance(dustPoint(567,510,low+1.68+.5),{x:0,y:0,z:-1},DUST2.solids)<.6,'north landing guard joins both flights');
  assert.ok(wallDistance(dustPoint(567,542,low+3.36+.5),{x:0,y:0,z:1},DUST2.solids)<.6,'south landing guard joins both flights');
 }
});

test('tower shaft walls terminate beneath the lookout slab without coplanar floor strips',()=>{
 const labels=['west wall north','west wall south','entry lintel','north wall','east wall','south wall'];
 for(const label of labels){const b=DUST2.solids.find(b=>b.label===`Scout tower ${label}`)!;assert.ok(b.y+b.h/2<=SCOUT_TOWER.deck-.219);} 
});
