import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {DT,ROUND_MS,NEXT_GAME_COUNTDOWN_MS,BOMB_RESULT_DELAY_MS,type Snapshot} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';

test('results last five seconds, then automatically reset the same room exactly once',()=>{
 const sim=new Simulation([]),a=sim.add('a','A');sim.add('b','B');a.kills=4;a.grenades=0;sim.scores.red=30;sim.finish();const deadline=sim.nextRoundAt,id=sim.matchId;
 assert.equal(deadline-sim.time,NEXT_GAME_COUNTDOWN_MS);assert.equal(sim.snapshot().nextRoundAt,deadline);sim.finish();assert.equal(sim.nextRoundAt,deadline,'repeated finish calls cannot prolong the countdown');
 sim.time=deadline-DT*1000-1;sim.step();assert.equal(sim.phase,'finished');assert.equal(sim.round,1);
 sim.time=deadline-DT*1000;sim.step();assert.equal(sim.phase,'playing');assert.equal(sim.round,2);assert.equal(sim.nextRoundAt,0);assert.equal(sim.winner,null);assert.equal(sim.matchId,id);assert.deepEqual(sim.scores,{red:0,blue:0});assert.equal(a.kills,0);assert.equal(a.grenades,2);assert.equal(a.hp,100);assert.equal(sim.endsAt,sim.time+ROUND_MS);
 for(let i=0;i<30;i++)sim.step();assert.equal(sim.round,2);
});
test('C4 detonation keeps its viewing delay before the five-second countdown and includes late joiners',()=>{
 const sim=new Simulation('dunes','defusal');sim.add('a','A');sim.add('b','B');sim.step();Object.assign(sim.bombs[0],{status:'planted',carrierId:null,siteId:'A',x:0,y:0,z:0,explodeAt:sim.time});sim.step();
 assert.equal(sim.phase,'finished');const deadline=sim.nextRoundAt;assert.ok(Math.abs(deadline-sim.time-NEXT_GAME_COUNTDOWN_MS-BOMB_RESULT_DELAY_MS)<1e-6);const late=sim.add('c','Late');assert.equal(late.hp,0);
 sim.time=deadline-DT*1000;sim.step();assert.equal(sim.phase,'playing');assert.equal(sim.round,2);assert.equal(sim.endsAt,0);assert.equal(sim.nextRoundAt,0);assert.equal(late.hp,100);assert.ok(sim.bombs.every(b=>b.status==='carried'&&b.action===null));
});
test('elimination results in bomb mode use the short countdown without a detonation delay',()=>{
 const sim=new Simulation('dunes','defusal');sim.add('a','A');const b=sim.add('b','B');sim.step();b.hp=0;sim.step();assert.equal(sim.phase,'finished');assert.equal(sim.winner,'red');assert.ok(Math.abs(sim.nextRoundAt-sim.time-NEXT_GAME_COUNTDOWN_MS)<1e-6);
});
test('all connected and newly joined clients share the automatic countdown; old votes cannot skip it',{timeout:15000},async()=>{
 const server=await createGameServer({secret:'countdown-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>();let invite='';
 const until=async(check:()=>boolean)=>{const start=Date.now();while(!check()){assert.ok(Date.now()-start<5000,'countdown state arrived');await new Promise(r=>setTimeout(r,20));}};
 const join=async()=>{const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'Player '+rooms.length,invite:invite||undefined})}),data=await response.json();invite=data.invite;const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('snapshot',(s:Snapshot)=>states.set(room.sessionId,s));rooms.push(room);return room;};
 try{
  const first=await join();await join();const sim=activeRooms.get(first.roomId)!.sim;sim.scores.red=30;sim.finish();const deadline=sim.nextRoundAt;await until(()=>rooms.every(r=>states.get(r.sessionId)?.phase==='finished'));
  for(const room of rooms)room.send('rematch');await join();await until(()=>rooms.every(r=>states.get(r.sessionId)?.nextRoundAt===deadline));assert.equal(sim.phase,'finished');assert.equal(sim.round,1);
  sim.time=deadline-1100;await until(()=>rooms.every(r=>{const s=states.get(r.sessionId);return !!s&&Math.ceil((s.nextRoundAt-s.time)/1000)===1;}));
  sim.time=deadline;await until(()=>rooms.every(r=>states.get(r.sessionId)?.round===2));for(const room of rooms){const s=states.get(room.sessionId)!;assert.equal(s.phase,'playing');assert.equal(s.nextRoundAt,0);assert.deepEqual(s.scores,{red:0,blue:0});assert.ok(s.players.every(p=>p.hp===100));}
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
