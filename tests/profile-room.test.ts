import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {createGameServer} from '../apps/server/src/http';
import {activeRooms} from '../apps/server/src/rooms';
import type {Snapshot} from '@sirocco/shared';

test('room creation provides a reusable invitation before either player submits a profile',async()=>{
  const server=await createGameServer({secret:'profile-test-secret-at-least-thirty-two-bytes'});
  const port=await server.listen(),base=`http://127.0.0.1:${port}`;
  const clients:Room[]=[];
  const post=(body:unknown)=>fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try{
    const response=await post({action:'create',mapId:'dunes',mode:'defusal'});
    assert.equal(response.status,200);
    const created=await response.json() as any;
    assert.ok(created.invite);assert.ok(created.roomId);assert.equal(created.reservation,undefined);
    assert.equal(activeRooms.get(created.roomId)?.sim.players.size,0);
    const matchId=activeRooms.get(created.roomId)!.sim.matchId;
    // The usual unused seat expiry must not dispose a room while profiles are being entered.
    await new Promise(resolve=>setTimeout(resolve,1200));
    assert.ok(activeRooms.has(created.roomId));
    assert.equal((await post({invite:created.invite,nickname:''})).status,400);
    for(const nickname of ['Invited first','Creator second']){
      const joined=await post({invite:created.invite,nickname});assert.equal(joined.status,200);
      const data=await joined.json() as any;assert.equal(data.invite,created.invite);assert.equal(data.fresh,false);
      const room=await new Client(base.replace('http','ws')).consumeSeatReservation(data.reservation);
      room.reconnection.enabled=false;clients.push(room);
      assert.equal(room.roomId,created.roomId);
      const snapshot=await new Promise<Snapshot>(resolve=>room.onMessage('snapshot',resolve));
      assert.equal(snapshot.matchId,matchId);assert.equal(snapshot.mapId,'dunes');assert.equal(snapshot.mode,'defusal');
      assert.ok(snapshot.players.some(p=>p.name===nickname));
    }
    assert.equal(activeRooms.get(created.roomId)!.sim.players.size,2);
    assert.equal(activeRooms.get(created.roomId)!.autoDispose,true);
  }finally{for(const room of clients)await room.leave();await server.close();}
});
