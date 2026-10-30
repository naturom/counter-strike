import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,BOMB_TARGET,dustPoint,groundAt,intersects,move,neutralInput,plantSite,type Motion,type Team} from '@sirocco/shared';

test('both sites are close to every defender spawn and much further from opposing starts',()=>{
 const map=MAPS.dunes;
 for(const defender of ['red','blue'] as Team[]){const attacker=defender==='red'?'blue':'red',site=map.bombSites!.find(s=>s.id===BOMB_TARGET[attacker])!;
  for(const spawn of map.spawns[defender])assert.ok(Math.hypot(spawn.x-site.marker.x,spawn.z-site.marker.z)<10,`${defender} starts too far from its defended site`);
  for(const spawn of map.spawns[attacker])assert.ok(Math.hypot(spawn.x-site.marker.x,spawn.z-site.marker.z)>60,'an attacker must cross the map to reach the enemy site');
  const landmark=map.landmarks!.find(l=>l.name===site.id)!;assert.equal(landmark.x,site.marker.x);assert.equal(landmark.z,site.marker.z);
 }
});
test('defenders can walk to their site in less than 13 metres without jumping, falling or entering walls',()=>{
 const map=MAPS.dunes;
 for(const team of ['red','blue'] as Team[]){const enemy=team==='red'?'blue':'red',site=map.bombSites!.find(s=>s.id===BOMB_TARGET[enemy])!;
  for(const spawn of map.spawns[team]){
   let p:Motion={...spawn,vy:0,grounded:true},travel=0;const route=team==='blue'&&spawn.z<dustPoint(0,213).z?[dustPoint(590,230),site.marker]:[site.marker];
   for(const target of route){let steps=0;while(Math.hypot(target.x-p.x,target.z-p.z)>.18&&steps++<120){const before=p,yaw=Math.atan2(-(target.x-p.x),-(target.z-p.z));p=move(p,{...neutralInput(),forward:1,yaw},map.solids);travel+=Math.hypot(p.x-before.x,p.z-before.z);assert.equal(p.grounded,true);assert.ok(Math.abs(p.y-spawn.y)<.01);assert.ok(!map.solids.some(s=>intersects(p,s)));}assert.ok(steps<120,'defender route is blocked');}
   assert.ok(travel<13,`defender detour is too long: ${travel}`);assert.equal(plantSite(p,'dunes',enemy)?.id,site.id);assert.equal(plantSite(p,'dunes',team),undefined);
  }
 }
});
test('every painted corner is clear and supported at its actual planting height',()=>{
 const map=MAPS.dunes;
 for(const site of map.bombSites!)for(const dx of [-.5,-.375,-.25,-.125,0,.125,.25,.375,.5])for(const dz of [-.5,-.375,-.25,-.125,0,.125,.25,.375,.5]){
  const p={x:site.marker.x+site.marker.size*dx,y:site.marker.y,z:site.marker.z+site.marker.size*dz};assert.ok(!map.solids.some(s=>intersects(p,s)));assert.ok(Math.abs(groundAt(p,map.solids,p.y+.1)-p.y)<.001);assert.equal(plantSite(p,'dunes')?.id,site.id);
 }
});
