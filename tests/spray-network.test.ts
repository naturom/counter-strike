import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';
import {dustPoint,neutralInput,type Snapshot} from '@sirocco/shared';
test('spray input is shared with another player and a late joiner over WebSockets',{timeout:10000},async()=>{
 const server=await createGameServer({secret:'spray-test-secret-at-least-thirty-two-bytes'}),port=await server.listen(),base=`http://127.0.0.1:${port}`,rooms:Room[]=[];let invite='';
 async function join(name:string){const r=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:name,invite:invite||undefined})}),data=await r.json();assert.equal(r.status,200);invite=data.invite;const room=await new Client(base.replace('http:','ws:')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;room.onMessage('combat',()=>{});room.onMessage('votes',()=>{});rooms.push(room);return room;}
 async function seen(room:Room){return new Promise<Snapshot>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Spray snapshot missing')),3000);room.onMessage('snapshot',(s:Snapshot)=>{if(s.sprays.length){clearTimeout(timeout);resolve(s);}});});}
 try{
  const a=await join('Artist'),b=await join('Viewer'),sim=activeRooms.get(a.roomId)!.sim,p=sim.players.get(a.sessionId)!;a.onMessage('snapshot',()=>{});
  Object.assign(p,{...dustPoint(870,350,2.1),yaw:Math.PI/2,pitch:0});let spraySound=false;b.onMessage('combat',(e:any)=>{if(e.type==='spray')spraySound=true;});const viewer=seen(b);a.send('input',{...neutralInput(),seq:1,yaw:Math.PI/2,spray:true});const first=await viewer;assert.equal(first.sprays[0].owner,a.sessionId);assert.equal(spraySound,true,'nearby players receive spray sound event');
  const c=await join('Late viewer'),late=await seen(c);assert.deepEqual(late.sprays,first.sprays);
 }finally{for(const room of rooms)await room.leave();await server.close();}
});
