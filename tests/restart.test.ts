import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fork,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {Client} from '@colyseus/sdk';
import type {Snapshot} from '@sirocco/shared';
async function boot(){const process=fork('tests/fixtures/host.ts',{execArgv:['--import','tsx'],env:{...globalThis.process.env,INVITE_SECRET:'restart-fixture-secret-with-at-least-32-bytes'},stdio:['ignore','ignore','inherit','ipc']});const [{port}]=await once(process,'message') as [{port:number}];return {process,base:`http://127.0.0.1:${port}`};}
async function stop(p:ChildProcess){const done=once(p,'exit');p.kill('SIGTERM');await done;}
test('a signed invitation recreates a zero-score match with the chosen team characters after a real process restart',{timeout:15000},async()=>{
  let first=await boot();let second:Awaited<ReturnType<typeof boot>>|undefined;
  async function join(base:string,invite?:string){const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'Restart-check',invite,teamAvatars:invite?undefined:{red:'wonder-woman',blue:'ironman'}})});assert.equal(response.status,200);const data=await response.json() as any;const room=await new Client(base.replace('http','ws')).consumeSeatReservation(data.reservation);room.reconnection.enabled=false;const state=await new Promise<Snapshot>(resolve=>room.onMessage('snapshot',resolve));return {room,state,invite:data.invite};}
  try{const a=await join(first.base);await stop(first.process);second=await boot();const b=await join(second.base,a.invite);assert.notEqual(a.state.matchId,b.state.matchId);assert.deepEqual(b.state.teamAvatars,{red:'wonder-woman',blue:'ironman'});assert.equal(b.state.players[0].avatar,'wonder-woman');assert.deepEqual(b.state.scores,{red:0,blue:0});assert.equal(b.state.players.length,1);await b.room.leave();}
  finally{if(first.process.exitCode===null)await stop(first.process);if(second&&second.process.exitCode===null)await stop(second.process);}
});
