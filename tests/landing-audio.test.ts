import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DT,move,neutralInput,type Motion} from '@sirocco/shared';
import {LandingTracker} from '../apps/web/components/combat-audio';
const ground=():Motion=>({x:0,y:0,z:0,vy:0,grounded:true});
function jump(rate:number){const tracker=new LandingTracker(),impacts:{strength:number}[]=[];let p=ground(),next=1000/rate;tracker.update(p,0);for(let frame=1;frame<=60;frame++){p=move(p,{...neutralInput(),jump:frame===1},[]);const time=frame*DT*1000;if(time+.001>=next){const impact=tracker.update(p,time);if(impact)impacts.push(impact);next+=1000/rate;}}return impacts;}
test('a stationary real jump creates exactly one landing at local and remote update rates',()=>{
 for(const rate of [10,20,30]){const impacts=jump(rate);assert.equal(impacts.length,1,`${rate} Hz jump`);assert.ok(impacts[0].strength>.5);}
});
test('higher falls have stronger impacts; landing can be detected without horizontal movement',()=>{
 function fall(height:number){const tracker=new LandingTracker();let p={...ground(),y:height,grounded:false};tracker.update(p,0);for(let frame=1;frame<100;frame++){p=move(p,neutralInput(),[]);const impact=tracker.update(p,frame*DT*1000);if(impact)return impact.strength;}throw new Error('Missing landing');}
 assert.ok(fall(4)>fall(.4));assert.ok(fall(20)<=1);
});
test('spawn, death, resets, stale snapshots, teleports and tiny ground snaps make no landing sound',()=>{
 const tracker=new LandingTracker();assert.equal(tracker.update(ground(),0),undefined);
 for(let i=1;i<20;i++)assert.equal(tracker.update(ground(),i*50),undefined);
 tracker.reset();tracker.update(ground(),0);tracker.update({...ground(),y:.04,vy:-1,grounded:false},50);tracker.update({...ground(),y:.02,vy:-1,grounded:false},100);assert.equal(tracker.update(ground(),150),undefined);
 tracker.reset();tracker.update({...ground(),y:2,grounded:false,vy:-3},0);tracker.update({...ground(),y:1.7,grounded:false,vy:-5},100);assert.equal(tracker.update({...ground(),x:10},150),undefined);
 tracker.reset();tracker.update({...ground(),y:2,grounded:false,vy:-3},0);tracker.update({...ground(),y:1.7,grounded:false,vy:-5},100);assert.equal(tracker.update(ground(),150,false),undefined);assert.equal(tracker.update(ground(),200),undefined);
 tracker.reset();tracker.update({...ground(),y:2,grounded:false,vy:-3},0);tracker.update({...ground(),y:1.7,grounded:false,vy:-5},100);assert.equal(tracker.update(ground(),1000),undefined);
});
