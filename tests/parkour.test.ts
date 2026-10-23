import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,RADIUS,move,neutralInput,intersects,solidTop,footprint,wallDistance,type Motion,type Solid} from '@sirocco/shared';
const solids=MAPS.dunes.solids;
const prop=(name:string)=>{const result=solids.find(b=>b.label===name);assert.ok(result,name);return result;};
function hop(start:Motion,target:Solid){
 let p={...start},landed=false;
 for(let i=0;i<80;i++){
  const distance=Math.hypot(target.x-p.x,target.z-p.z),yaw=Math.atan2(-(target.x-p.x),-(target.z-p.z));
  p=move(p,{...neutralInput(),jump:i===0,forward:distance>.12?1:0,yaw},solids);
  assert.ok(!solids.some(b=>intersects(p,b)),`jump embeds player near ${target.label}: ${JSON.stringify(p)}`);
  if(p.grounded&&Math.abs(p.y-solidTop(target,p))<.01&&footprint(p,target,0)){landed=true;if(distance<.15)break;}
 }
 assert.ok(landed,`cannot land on ${target.label} from ${JSON.stringify(start)}; ended at ${JSON.stringify(p)}`);return p;
}
function southOf(b:Solid):Motion{return{x:b.x,y:b.y-b.h/2,z:b.z+b.d/2+RADIUS+.12,vy:0,grounded:true};}
test('normal jump reaches low boxes that previously exceeded the jump apex',()=>{
 for(const name of ['Xbox','B default','B back cover','A default','A short cover','T spawn cover']){const box=prop(name);hop(southOf(box),box);}
});
test('car hoods and cabins can be reached without hitting a full-height invisible box',()=>{
 for(const name of ['B car','Long car','CT truck']){
  const body=prop(name),cabin=prop(`${name} cabin`),base=body.y-body.h/2;
  // Approach along the vehicle's long axis to land on the exposed hood first.
  const sideways=body.w>body.d;
  const start:Motion={x:body.x+(sideways?-body.w/2-RADIUS-.12:0),y:base,z:body.z+(sideways?0:-body.d/2-RADIUS-.12),vy:0,grounded:true};
  const hood={...body,x:body.x+(sideways?-body.w*.36:0),z:body.z+(sideways?0:-body.d*.36)};
  const p=hop(start,hood);hop(p,cabin);
  const ray={x:body.x+(sideways?-body.w*.4:0),y:base+body.vehicle!.height+2,z:body.z+(sideways?0:-body.d*.4)};
  assert.ok(Math.abs(ray.y-wallDistance(ray,{x:0,y:-1,z:0},solids)-(base+body.h))<.01,'visible hood has a matching lower collision top');
 }
});
test('existing boost steps lead to taller boxes and the B window boost',()=>{
 const low=prop('CT boost low');let p=hop(southOf(low),low);p=hop(p,prop('CT boost middle'));hop(p,prop('CT boost high'));
 const step=prop('B window step'),start={x:step.x+step.w/2+RADIUS+.12,y:0,z:step.z,vy:0,grounded:true};hop(hop(start,step),prop('B window boost'));
 const containerStep=prop('Blue container step');hop(hop(southOf(containerStep),containerStep),prop('Blue container'));
});
test('tall site stacks are reachable from nearby cover instead of a super jump',()=>{
 const bCar=prop('B car cabin');hop({x:bCar.x,y:bCar.y+bCar.h/2,z:bCar.z-bCar.d/2+RADIUS+.03,vy:0,grounded:true},prop('B big box'));
 const bDefault=prop('B default');hop({x:bDefault.x+bDefault.w/2-RADIUS-.02,y:bDefault.y+bDefault.h/2,z:bDefault.z-bDefault.d/2+RADIUS+.02,vy:0,grounded:true},prop('B double stack'));
 const aDefault=prop('A default');hop({x:aDefault.x-aDefault.w/2+RADIUS+.02,y:aDefault.y+aDefault.h/2,z:aDefault.z-aDefault.d/2+RADIUS+.02,vy:0,grounded:true},prop('A double stack'));
});
test('jump remains bounded and cannot climb a tall wall directly',()=>{
 let p:Motion={x:0,y:0,z:0,vy:0,grounded:true},peak=0;
 for(let i=0;i<50;i++){p=move(p,{...neutralInput(),jump:i===0},[]);peak=Math.max(peak,p.y);}assert.ok(peak>1.6&&peak<1.8);assert.equal(p.y,0);
 const wall:Solid={x:0,y:2,z:-2,w:8,h:4,d:1,kind:'wall'};p={x:0,y:0,z:0,vy:0,grounded:true};
 for(let i=0;i<50;i++)p=move(p,{...neutralInput(),jump:i===0,forward:1},[wall]);assert.ok(p.z>wall.z+wall.d/2,'cannot jump through a tall wall');
});
