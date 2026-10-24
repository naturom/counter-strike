import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,wallDistance,type MapId} from '@sirocco/shared';
import {spawnMirrorMounts} from '../apps/web/components/spawn-mirrors';
test('both teams have large wall-supported mirrors near spawn on each map',()=>{
 for(const mapId of ['dunes','relay'] as MapId[]){
  const map=MAPS[mapId],mounts=spawnMirrorMounts(mapId);assert.equal(mounts.length,2);
  for(const m of mounts){
   assert.ok(m.width>=4.8&&m.height>=2.3);
   const nx=Math.sin(m.rotation),nz=Math.cos(m.rotation);
   for(const x of [-m.width/2,0,m.width/2])for(const y of [-m.height/2,m.height/2]){
    const at={x:m.x+nz*x,y:m.y+y,z:m.z-nx*x},distance=wallDistance(at,{x:-nx,y:0,z:-nz},map.solids.filter(b=>b.kind==='wall'));
    assert.ok(distance>.025&&distance<.15,`${mapId} ${m.team} mirror must stand clear of a supporting wall: ${distance}`);
   }
   assert.ok(map.spawns[m.team].some(s=>Math.hypot(s.x-m.x,s.z-m.z)<10),`${mapId} ${m.team}: mirror too far from spawn`);
  }
 }
});
