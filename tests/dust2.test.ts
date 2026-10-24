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
  'B exit pocket':[[190,390],[190,350],[220,350],[220,280],[210,230],[110,250],[118,305],[118,385],[118,460],[205,460]],
  'tunnel approach side':[[270,540],[220,540],[205,650]],
  'west Mid edge':[[425,570],[465,570],[465,640]],
  'T island rear':[[465,750],[465,850],[575,850],[625,850],[625,930]],
  'Long shop pavement':[[800,620],[800,540],[880,510]],
  'Pit rear and stairs':[[900,760],[900,600],[900,545],[900,510],[880,430]],
  'Long bevel corner':[[932.5,322.5],[900,310],[880,285]],
  'Catwalk recess':[[590,380],[590,410],[640,410],[645,315]],
  'Long door side':[[689,560],[695,560],[695,545],[745,530]],
  'Short north landing':[[645,120],[645,197],[680,178],[735,180]],
};
for(const [name,points] of Object.entries(escapes))test(`Dust II escape: ${name}`,()=>{walk(points);walk([...points].reverse());});

test('B exterior walls are supported down to the ground without a crawlable void',()=>{
  for(const [u,v] of [[259,150],[259,200],[259,222],[259,290],[200,100]]){
    const low=dustPoint(u,v);assert.ok(map.solids.some(b=>intersects(low,b,1.1)),`unsupported B wall at ${u},${v}`);
  }
  // The intended elevated window and doors remain open.
  const outside=dustPoint(310,200,4);
  assert.ok(wallDistance(outside,{x:-1,y:0,z:0},map.solids)>6,'B window aperture must remain open');
});
test('B door leaves sit on a continuous ramp through the entire angled doorway',()=>{
  for(const v of [226,230,250,270,274])for(const u of [265,280,300]){
    const p=dustPoint(u,v),expected=(319-u)/65*2;
    assert.ok(Math.abs(groundAt(p,map.solids)-expected)<1e-5,`door approach drops into a trench at ${u},${v}`);
  }
});

test('Long chamber doorway sides are sealed while the northern entrance remains open',()=>{
 for(const [u,v] of [[678,558],[678,565],[740,561],[740,573]]){
  const p=dustPoint(u,v,2.1);assert.ok(map.solids.some(b=>intersects(p,b)),`open chamber side at ${u},${v}`);
 }
 walk([[695,605],[695,560],[695,540],[745,530]]);
});

test('Mid gate east return joins the adjacent building without a side opening',()=>{
 for(const u of [505,512,520,530])assert.ok(map.solids.some(b=>intersects(dustPoint(u,358,0),b)),`gap beside Mid door at ${u}`);
 walk([[485,390],[465,345],[470,300]]);
});

test('enclosed tunnel stairs descend on real treads and remain walkable in both directions',()=>{
 const treads=map.solids.filter(b=>b.label?.startsWith('Tunnel stair tread'));
 assert.equal(treads.length,16);assert.ok(treads.every(b=>!b.ramp));
 for(let i=1;i<treads.length;i++)assert.ok(Math.abs(treads[i].y+treads[i].h/2-treads[i-1].y-treads[i-1].h/2-2.9/16)<1e-5);
 for(const points of [[[275,495],[310,495],[310,410],[400,410],[445,410]],[[445,410],[400,410],[310,410],[310,495],[275,495]]] as [number,number][][])walk(points);
 for(const [u,v,y] of [[284,455,4],[310,470,6.7],[430,391,1],[430,433,1]])assert.ok(map.solids.some(b=>intersects(dustPoint(u,v,y),b)),`enclosure gap at ${u},${v}`);
 assert.ok(wallDistance(dustPoint(400,411,1.6),{x:1,y:0,z:0},map.solids)>4,'exit doorway must remain open');
});

test('B car-side shortcut is sealed across its width while the main tunnel stays open',()=>{
 const seal=map.solids.find(b=>b.label==='B south passage seal')!;
 for(const u of [170,185,205,225,245,256])assert.ok(intersects(dustPoint(u,417,3.2),seal),`gap in B seal at ${u}`);
 const start=dustPoint(205,450,4.8);assert.ok(wallDistance(start,{x:0,y:0,z:-1},[seal])<4,'seal must stop shots as well as players');
 walk([[205,460],[118,460],[118,385],[118,305],[110,250],[185,220]]);
});
