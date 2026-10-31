import { Room, type Client, ServerError } from '@colyseus/core';
import { Simulation } from './simulation';
import {validInput,TEAMS,SurfaceCursor} from '@sirocco/shared';
import type { signer } from './invites';
export const roomsByInvite=new Map<string,string>();
export const activeRooms=new Map<string,ArenaRoom>();
export let inviteSigner:ReturnType<typeof signer>;
export function configureRooms(s:ReturnType<typeof signer>){inviteSigner=s;}
export function log(event:string,fields:Record<string,unknown>={}){console.log(JSON.stringify({severity:'INFO',event,...fields}));}
export class ArenaRoom extends Room {
  sim=new Simulation();
  inviteId='';
  private budgets=new Map<string,{start:number;count:number}>();
  private idle=new Map<string,number>();
  private surfaceClients=new Map<string,SurfaceCursor>();
  private profileExpiry?:{clear():void};
  onCreate(options:{invite:string;awaitProfile?:boolean}) {
    const invitation=inviteSigner.verify(options.invite);this.inviteId=invitation.id;this.sim=new Simulation(invitation.mapId!,invitation.mode);
    // A newly created room has no player until someone submits their profile.
    if(options.awaitProfile){this.autoDispose=false;this.profileExpiry=this.clock.setTimeout(()=>{void this.disconnect();},10*60*1000);}
    this.maxClients=8;
    this.seatReservationTimeout=20;
    this.setPatchRate(null);
    roomsByInvite.set(this.inviteId,this.roomId);activeRooms.set(this.roomId,this);
    this.setSimulationInterval(()=>{
      this.sim.step();
      for(const event of this.sim.events)this.broadcast('combat',event);
      // Close abandoned tabs after two minutes without meaningful control input.
      for(const client of this.clients){const player=this.sim.players.get(client.sessionId),watching=this.sim.mode==='defusal'&&this.sim.phase==='playing'&&player?.hp===0;
        if(watching)this.idle.set(client.sessionId,Date.now());
        else if(Date.now()-(this.idle.get(client.sessionId)??Date.now())>120000)client.leave(4000,'Inactive for two minutes');}
    },1000/30);
    this.clock.setInterval(()=>{
      const state=this.sim.snapshot(),{impacts,sprays,...motion}=state;
      for(const client of this.clients){const cursor=this.surfaceClients.get(client.sessionId);
        if(!cursor){client.send('snapshot',state);continue;}
        const update=cursor.next({impacts,sprays});if(update)client.send('surfaceUpdates',update);
        client.send('snapshot',motion);
      }
    },50);
    // Explicit negotiation keeps already-open/older clients on full snapshots.
    this.onMessage('surfaceUpdates',(client,version)=>{
      if(!this.allow(client.sessionId)||version!==1)return;
      const cursor=new SurfaceCursor();this.surfaceClients.set(client.sessionId,cursor);
      client.send('surfaceUpdates',cursor.next(this.sim.snapshot(),true));
    });
    this.onMessage('input',(client,value)=>{
      if(!this.allow(client.sessionId)||!validInput(value))return;
      this.sim.input(client.sessionId,value);
      const p=this.sim.players.get(client.sessionId);
      if(value.forward||value.strafe||value.fire||value.reload||value.jump||value.crouch||value.interact||value.spray||value.summon||p&&Math.abs(p.yaw-value.yaw)>0.01)this.idle.set(client.sessionId,Date.now());
    });
    // Older clients can still send a saved preference; team identity always wins.
    this.onMessage('appearance',(client)=>{if(!this.allow(client.sessionId))return;const player=this.sim.players.get(client.sessionId);if(player)player.avatar=TEAMS[player.team].avatar;});
    // Cached clients may still show the old vote button; it cannot skip the countdown.
    this.onMessage('rematch',()=>{});
    log('room_created',{room:this.roomId,match:this.sim.matchId});
  }
  onAuth(_client:Client,options:{invite:string;nickname:string}) {
    if(inviteSigner.verify(options.invite).id!==this.inviteId)throw new ServerError(403,'Wrong invitation');
    if(typeof options.nickname!=='string'||!options.nickname.trim()||options.nickname.length>20)throw new ServerError(400,'Nickname must be 1–20 characters');
    return {name:options.nickname.trim().replace(/[\x00-\x1f\x7f]/g,'')||'Guest'};
  }
  onJoin(client:Client,_options:unknown,auth:{name:string}) {
    this.profileExpiry?.clear();this.profileExpiry=undefined;this.autoDispose=true;
    this.sim.add(client.sessionId,auth.name);this.idle.set(client.sessionId,Date.now());
    log('player_joined',{room:this.roomId,players:this.sim.players.size});
  }
  onDrop(client:Client) {
    this.surfaceClients.delete(client.sessionId);
    const p=this.sim.players.get(client.sessionId);if(p)this.sim.disconnect(p.id);
    this.sim.queues.set(client.sessionId,[]);
    this.allowReconnection(client,20);
  }
  onReconnect(client:Client) {
    const p=this.sim.players.get(client.sessionId);if(p){p.connected=true;p.avatar=TEAMS[p.team].avatar;}
    this.idle.set(client.sessionId,Date.now());log('player_reconnected',{room:this.roomId});
  }
  onLeave(client:Client) {
    this.surfaceClients.delete(client.sessionId);
    this.sim.remove(client.sessionId);this.idle.delete(client.sessionId);this.budgets.delete(client.sessionId);
  }
  onDispose(){if(roomsByInvite.get(this.inviteId)===this.roomId)roomsByInvite.delete(this.inviteId);activeRooms.delete(this.roomId);log('room_disposed',{room:this.roomId});}
  private allow(id:string){const now=Date.now();let b=this.budgets.get(id);if(!b||now-b.start>1000){b={start:now,count:0};this.budgets.set(id,b);}return ++b.count<=75;}
}
