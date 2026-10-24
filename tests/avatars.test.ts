import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {AVATARS,validAvatar,type Snapshot} from '@sirocco/shared';
import {Simulation} from '../apps/server/src/simulation';
import {createGameServer} from '../apps/server/src/http';
test('all ten requested appearances are unique and persist through spawn and rematch',()=>{
 assert.equal(AVATARS.length,10);assert.equal(new Set(AVATARS.map(a=>a.id)).size,10);assert.equal(AVATARS.filter(a=>a.name==='Captain America').length,1);assert.equal(validAvatar('unknown'),false);
 for(const avatar of AVATARS){assert.ok(validAvatar(avatar.id));const sim=new Simulation(),p=sim.add('a','Hero',avatar.id);sim.spawn(p);assert.equal(p.avatar,avatar.id);sim.phase='finished';sim.rematch();assert.equal(sim.snapshot().players[0].avatar,avatar.id);}
 assert.equal(new Simulation().add('a','Legacy').avatar,'operator');
});
test('profile appearance is validated and shared with invited players over WebSockets',{timeout:10000},async()=>{
 const server=await createGameServer({secret:'avatar-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[];let invite='';
 async function join(avatar:string){const r=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'Hero',avatar,invite:invite||undefined})}),data=await r.json();if(r.status!==200)return {status:r.status};invite=data.invite;const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('votes',()=>{});room.onMessage('snapshot',()=>{});rooms.push(room);return {status:r.status,room};}
 try{
  assert.equal((await join('invalid')).status,400);const a=(await join('ironman')).room!,b=(await join('groot')).room!;
  const s=await new Promise<Snapshot>(resolve=>b.onMessage('snapshot',(s:Snapshot)=>{if(s.players.length===2)resolve(s);}));assert.equal(s.players.find(p=>p.id===a.sessionId)?.avatar,'ironman');assert.equal(s.players.find(p=>p.id===b.sessionId)?.avatar,'groot');
  const changed=new Promise<Snapshot>(resolve=>a.onMessage('snapshot',(s:Snapshot)=>{if(s.players.find(p=>p.id===a.sessionId)?.avatar==='batman')resolve(s);}));a.send('appearance',{avatar:'batman'});await changed;
 }finally{for(const room of rooms)await room.leave();await server.close();}
});
