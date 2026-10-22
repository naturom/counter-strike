import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,DUST_SCALE,dustPoint,move,neutralInput,intersects,wallDistance,groundAt,type Motion,type Solid} from '@sirocco/shared';
const map=MAPS.dunes;
const routes:Record<string,[number,number][]>={
  'T spawn to A through Long':[[380,930],[510,930],[625,900],[625,700],[710,705],[724,650],[710,605],[695,580],[695,545],[745,530],[880,510],[880,430],[880,285],[880,210],[880,140],[815,140]],
  'T spawn to B through upper tunnels':[[280,930],[185,905],[120,905],[120,800],[120,690],[205,650],[205,550],[205,460],[118,460],[118,385],[118,305],[110,250],[185,220]],
  'Upper tunnels to Mid to CT':[[205,460],[274,460],[275,495],[310,495],[310,410],[400,410],[445,410],[445,445],[485,445],[485,390],[465,345],[470,300],[485,240],[590,225]],
  'Top Mid to A through Catwalk':[[465,580],[521,580],[521,420],[640,410],[645,315],[645,240],[645,197],[680,178],[735,180],[815,190]],
  'CT Mid to B through doors':[[590,225],[475,240],[320,250],[275,250],[240,250],[210,230]],
  'Lower tunnels back up the stairs':[[400,410],[310,410],[310,495],[275,495],[205,460]],
};
function walk(points:[number,number][]){
  const start=dustPoint(...points[0]);let p:Motion={...start,y:groundAt(start,map.solids),grounded:true,vy:0};
  for(const [u,v] of points.slice(1)){
    const target=dustPoint(u,v);let steps=0;
    while(Math.hypot(target.x-p.x,target.z-p.z)>.2&&steps++<700){const yaw=Math.atan2(-(target.x-p.x),-(target.z-p.z));p=move(p,{...neutralInput(),forward:1,yaw},map.solids);}
    assert.ok(steps<700,`route blocked toward ${u},${v}: at radar ${p.x/DUST_SCALE+512},${p.z/DUST_SCALE+512}, height ${p.y}`);
    assert.ok(!map.solids.some(b=>intersects(p,b)),`embedded at ${u},${v}: ${JSON.stringify(p)} ${map.solids.filter(b=>intersects(p,b)).map(b=>b.label)}`);
  }
  return p;
}
for(const [name,points] of Object.entries(routes))test(`Dust II route: ${name} and return`,()=>{walk(points);walk([...points].reverse());});
test('Dust II spawn/supply elevations match the floor and all are clear',()=>{
  for(const p of [...map.spawns.red,...map.spawns.blue,...map.pickups]){assert.ok(!map.solids.some(b=>intersects(p,b)),JSON.stringify(p));assert.ok(Math.abs(p.y-groundAt(p,map.solids,p.y+.01))<.02,JSON.stringify(p));}
});
test('A Short bridge permits a CT beneath it and a player above it',()=>{
  const low=dustPoint(645,225,0),high={...low,y:3.8};
  assert.ok(!map.solids.some(b=>intersects(low,b)));assert.ok(!map.solids.some(b=>intersects(high,b)));
  assert.ok(Math.abs(wallDistance({...low,y:1.6},{x:0,y:1,z:0},map.solids)-1.75)<.01);
  assert.ok(Math.abs(wallDistance({...high,y:5.4},{x:0,y:-1,z:0},map.solids)-1.6)<.01);
});
test('sloping floor supports walking uphill/downhill, landing and bullet occlusion',()=>{
  const ramp:Solid={x:0,y:1,z:0,w:4,h:2,d:10,kind:'floor',ramp:{axis:'z',from:0,to:2}};
  let p:Motion={x:0,y:0,z:-5,grounded:true,vy:0};for(let i=0;i<54;i++)p=move(p,{...neutralInput(),forward:-1},[ramp]);assert.ok(p.y>1.9);assert.ok(p.grounded);
  for(let i=0;i<54;i++)p=move(p,{...neutralInput(),forward:1},[ramp]);assert.ok(p.y<.1);
  assert.ok(Math.abs(wallDistance({x:0,y:3,z:0},{x:0,y:-1,z:0},[ramp])-2)<.001);
});
test('polygon building collisions preserve open space in concave footprints',()=>{
  const b:Solid={x:2,y:2,z:2,w:4,h:4,d:4,kind:'wall',polygon:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]]};
  assert.equal(intersects({x:2,y:0,z:2},b),false);assert.equal(intersects({x:.5,y:0,z:2},b),true);
  assert.ok(Math.abs(wallDistance({x:2,y:1,z:2},{x:-1,y:0,z:0},[b])-1)<.001);
});

// These start inside former drop pockets, rather than following only the main lanes.
const escapes:Record<string,[number,number][]>={
  'B exit pocket':[[190,390],[190,430],[205,460]],
  'tunnel approach side':[[270,540],[220,540],[205,650]],
  'west Mid edge':[[425,570],[465,570],[465,640]],
  'T island rear':[[465,750],[465,850],[575,850],[625,850],[625,930]],
  'Long shop pavement':[[800,620],[800,540],[880,510]],
  'Pit rear and stairs':[[900,760],[900,600],[900,545],[900,510],[880,430]],
  'Long bevel corner':[[932.5,322.5],[900,310],[880,285]],
  'Catwalk recess':[[590,380],[590,410],[640,410],[645,315]],
  'Long door side':[[677.5,560],[695,560],[695,545],[745,530]],
  'Short north landing':[[645,120],[645,197],[680,178],[735,180]],
};
for(const [name,points] of Object.entries(escapes))test(`Dust II escape: ${name}`,()=>{walk(points);walk([...points].reverse());});
