import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {AVATARS,validAvatar,type Snapshot} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {createGameServer} from '../apps/server/src/http';
test('Iron Man is the only available avatar and persists through spawn and rematch',()=>{
 assert.deepEqual(AVATARS.map(a=>a.id),['ironman']);for(const removed of ['unknown','operator','spiderman','deadpool','captain-america','wonder-woman','batman','thor','groot','hulk','black-widow'])assert.equal(validAvatar(removed),false);
 for(const avatar of AVATARS){assert.ok(validAvatar(avatar.id));const sim=new Simulation(),p=sim.add('a','Hero',avatar.id);sim.spawn(p);assert.equal(p.avatar,avatar.id);sim.phase='finished';sim.rematch();assert.equal(sim.snapshot().players[0].avatar,avatar.id);}
 assert.equal(new Simulation().add('a','Legacy').avatar,'ironman');assert.equal(new Simulation().add('a','Legacy','groot').avatar,'ironman');
});
test('profile appearance is validated and shared with invited players over WebSockets',{timeout:10000},async()=>{
 const server=await createGameServer({secret:'avatar-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[];let invite='';
 async function join(avatar:string){const r=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'Hero',avatar,invite:invite||undefined})}),data=await r.json();if(r.status!==200)return {status:r.status};invite=data.invite;const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('votes',()=>{});room.onMessage('snapshot',()=>{});rooms.push(room);return {status:r.status,room};}
 try{
  assert.equal((await join('invalid')).status,400);const a=(await join('ironman')).room!,b=(await join('ironman')).room!;
  const s=await new Promise<Snapshot>(resolve=>b.onMessage('snapshot',(s:Snapshot)=>{if(s.players.length===2)resolve(s);}));assert.equal(s.players.find(p=>p.id===a.sessionId)?.avatar,'ironman');assert.equal(s.players.find(p=>p.id===b.sessionId)?.avatar,'ironman');
  assert.equal((await join('groot')).status,400);const unchanged=new Promise<Snapshot>(resolve=>a.onMessage('snapshot',resolve));a.send('appearance',{avatar:'batman'});assert.equal((await unchanged).players.find(p=>p.id===a.sessionId)?.avatar,'ironman');
 }finally{for(const room of rooms)await room.leave();await server.close();}
});
