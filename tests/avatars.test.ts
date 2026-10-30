import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {TEAMS,type Snapshot} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';
test('balanced teams always use Iron Man for A and Ultraman for B through spawn and rematch',()=>{
 const sim=new Simulation();for(let i=0;i<6;i++)sim.add(String(i),'Player '+i);
 const check=()=>{for(const p of sim.players.values())assert.equal(p.avatar,TEAMS[p.team].avatar);};check();
 assert.equal([...sim.players.values()].filter(p=>p.team==='red'&&p.avatar==='ironman').length,3);assert.equal([...sim.players.values()].filter(p=>p.team==='blue'&&p.avatar==='ultraman').length,3);
 for(const p of sim.players.values()){p.avatar='wonder-woman';sim.spawn(p);}check();
 sim.phase='finished';sim.rematch();check();
 sim.remove('0');sim.remove('2');const first=sim.add('replacement','New');assert.equal(first.team,'red');assert.equal(first.avatar,'ironman');const second=sim.add('replacement2','New2');assert.equal(second.team,'red');check();
 assert.equal(TEAMS.red.name,'Team A');assert.equal(TEAMS.blue.name,'Team B');
});
test('six invited clients receive fixed team appearances and cannot override them, including reconnects',{timeout:20000},async()=>{
 const server=await createGameServer({secret:'avatar-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[],states=new Map<string,Snapshot>();let invite='';
 const until=async(check:()=>boolean)=>{const start=Date.now();while(!check()){assert.ok(Date.now()-start<6000,'team snapshot arrived');await new Promise(r=>setTimeout(r,25));}};
 const attach=(room:Room)=>{room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('votes',()=>{});room.onMessage('snapshot',(s:Snapshot)=>states.set(room.sessionId,s));rooms.push(room);};
 const check=(s:Snapshot)=>{assert.equal(s.players.length,6);for(const p of s.players)assert.equal(p.avatar,TEAMS[p.team].avatar);};
 try{
  for(const avatar of ['ultraman','ironman','wonder-woman','invalid',undefined,{id:'ironman'}]){
   const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'Hero '+rooms.length,avatar,invite:invite||undefined})}),data=await response.json();assert.equal(response.status,200);invite=data.invite;attach(await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation));
  }
  await until(()=>rooms.every(r=>states.get(r.sessionId)?.players.length===6));for(const r of rooms)check(states.get(r.sessionId)!);
  const sim=activeRooms.get(rooms[0].roomId)!.sim,original=rooms[1],id=original.sessionId,token=original.reconnectionToken;
  for(const room of rooms)room.send('appearance',{avatar:sim.players.get(room.sessionId)!.team==='red'?'ultraman':'ironman'});
  const before=states.get(id)!.time;await until(()=>states.get(id)!.time>before+100);for(const r of rooms)check(states.get(r.sessionId)!);
  original.connection.close();await until(()=>sim.players.get(id)?.connected===false);const restored=await new Client(base.replace('http:','ws:')).reconnect(token);attach(restored);await until(()=>sim.players.get(id)?.connected===true);assert.equal(restored.sessionId,id);assert.equal(sim.players.get(id)!.avatar,'ultraman');
  for(const p of sim.players.values()){p.hp=0;p.respawnAt=sim.time;}
  await until(()=>[...sim.players.values()].every(p=>p.hp===100));check(sim.snapshot());
  sim.finish();sim.time=sim.nextRoundAt;await until(()=>rooms.filter(r=>r!==original).every(r=>states.get(r.sessionId)?.round===2));for(const r of rooms)if(r!==original)check(states.get(r.sessionId)!);
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.close();}
});
