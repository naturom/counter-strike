import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KNIFE} from '@sirocco/shared';
import {KNIFE_SWING_MS,knifeSwing} from '../apps/web/components/knife-swing';
test('both knife attacks recover before the next legal attack and finish exactly at the ready pose',()=>{
 assert.ok(KNIFE_SWING_MS<KNIFE.interval);
 for(const reverse of [false,true])for(const p of [0,1,2,Infinity,NaN]){
  const pose=knifeSwing(p,reverse);assert.ok(Object.values(pose).every(n=>Number.isFinite(n)&&Math.abs(n)<1e-8));
 }
});
test('knife sweeps remain continuous and bounded, with distinct opposing contact poses',()=>{
 for(const reverse of [false,true]){
  let previous=knifeSwing(0,reverse);
  for(let frame=1;frame<=1000;frame++){
   const pose=knifeSwing(frame/1000,reverse);
   for(const key of Object.keys(pose) as (keyof typeof pose)[]){assert.ok(Number.isFinite(pose[key]));assert.ok(Math.abs(pose[key]-previous[key])<.025,`${key} snapped at ${frame}`);assert.ok(Math.abs(pose[key])<1.1);}
   previous=pose;
  }
 }
 const fore=knifeSwing(.36),back=knifeSwing(.36,true);assert.ok(fore.x<0&&back.x>0);assert.ok(fore.roll>0&&back.roll<0);
});
