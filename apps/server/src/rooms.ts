import { Room, type Client, ServerError } from '@colyseus/core';
import { Simulation } from './simulation';
import { validInput } from '@sirocco/shared';
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
  private votes=new Set<string>();
  onCreate(options:{invite:string}) {
    const invitation=inviteSigner.verify(options.invite);this.inviteId=invitation.id;this.sim=new Simulation(invitation.mapId!);
    this.maxClients=8;
    this.seatReservationTimeout=20;
    this.setPatchRate(null);
    roomsByInvite.set(this.inviteId,this.roomId);activeRooms.set(this.roomId,this);
    this.setSimulationInterval(()=>{
      this.sim.step();
      for(const event of this.sim.events)this.broadcast('combat',event);
      // Close abandoned tabs after two minutes without meaningful control input.
      for(const client of this.clients)if(Date.now()-(this.idle.get(client.sessionId)??Date.now())>120000)client.leave(4000,'Inactive for two minutes');
    },1000/30);
    this.clock.setInterval(()=>{this.broadcast('snapshot',this.sim.snapshot());},50);
    this.onMessage('input',(client,value)=>{
      if(!this.allow(client.sessionId)||!validInput(value))return;
      this.sim.input(client.sessionId,value);
      const p=this.sim.players.get(client.sessionId);
      if(value.forward||value.strafe||value.fire||value.reload||value.jump||value.crouch||value.interact||p&&Math.abs(p.yaw-value.yaw)>0.01)this.idle.set(client.sessionId,Date.now());
    });
    this.onMessage('rematch',(client)=>{
      if(!this.allow(client.sessionId)||this.sim.phase!=='finished')return;
      this.votes.add(client.sessionId);this.idle.set(client.sessionId,Date.now());
      const connected=[...this.sim.players.values()].filter(p=>p.connected);
      if(this.votes.size>=Math.ceil(connected.length/2)){this.sim.rematch();this.votes.clear();}
      this.broadcast('votes',{count:this.votes.size,needed:Math.ceil(connected.length/2)});
    });
    log('room_created',{room:this.roomId,match:this.sim.matchId});
  }
  onAuth(_client:Client,options:{invite:string;nickname:string}) {
    if(inviteSigner.verify(options.invite).id!==this.inviteId)throw new ServerError(403,'Wrong invitation');
    if(typeof options.nickname!=='string'||!options.nickname.trim()||options.nickname.length>20)throw new ServerError(400,'Nickname must be 1–20 characters');
    return {name:options.nickname.trim().replace(/[\x00-\x1f\x7f]/g,'')||'Guest'};
  }
  onJoin(client:Client,_options:unknown,auth:{name:string}) {
    this.sim.add(client.sessionId,auth.name);this.idle.set(client.sessionId,Date.now());
    log('player_joined',{room:this.roomId,players:this.sim.players.size});
  }
  onDrop(client:Client) {
    const p=this.sim.players.get(client.sessionId);if(p)p.connected=false;
    this.sim.queues.set(client.sessionId,[]);this.votes.delete(client.sessionId);
    this.allowReconnection(client,20);
  }
  onReconnect(client:Client) {
    const p=this.sim.players.get(client.sessionId);if(p)p.connected=true;
    this.idle.set(client.sessionId,Date.now());log('player_reconnected',{room:this.roomId});
  }
  onLeave(client:Client) {
    this.sim.remove(client.sessionId);this.idle.delete(client.sessionId);this.budgets.delete(client.sessionId);this.votes.delete(client.sessionId);
  }
  onDispose(){if(roomsByInvite.get(this.inviteId)===this.roomId)roomsByInvite.delete(this.inviteId);activeRooms.delete(this.roomId);log('room_disposed',{room:this.roomId});}
  private allow(id:string){const now=Date.now();let b=this.budgets.get(id);if(!b||now-b.start>1000){b={start:now,count:0};this.budgets.set(id,b);}return ++b.count<=75;}
}
