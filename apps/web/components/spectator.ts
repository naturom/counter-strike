import {eyeOf,type Player,type Snapshot} from '@sirocco/shared';

/** Spectating changes only the displayed player, never the local session ID. */
export class Spectator {
  targetId:string|null=null;
  candidates(state:Snapshot,viewerId:string){
    const viewer=state.players.find(p=>p.id===viewerId);
    return state.mode==='defusal'&&state.phase==='playing'&&viewer?.hp===0&&viewer.death
      ?state.players.filter(p=>p.id!==viewerId&&p.hp>0&&p.connected):[];
  }
  sync(state:Snapshot,viewerId:string){
    const players=this.candidates(state,viewerId);
    const target=players.find(p=>p.id===this.targetId)??players[0];
    this.targetId=target?.id??null;return target;
  }
  next(state:Snapshot,viewerId:string){
    const players=this.candidates(state,viewerId),index=players.findIndex(p=>p.id===this.targetId);
    this.targetId=players.length?players[(index+1)%players.length].id:null;
    return players.find(p=>p.id===this.targetId);
  }
  reset(){this.targetId=null;}
}

/** Use the same delayed snapshots as remote bodies, including crouched eye
 * height and the shortest turn across the -PI/+PI boundary. */
export function spectatorPose(previous:Player,next:Player,t:number){
  t=Math.max(0,Math.min(1,t));const lerp=(a:number,b:number)=>a+(b-a)*t;
  const turn=Math.atan2(Math.sin(next.yaw-previous.yaw),Math.cos(next.yaw-previous.yaw));
  return {x:lerp(previous.x,next.x),y:lerp(previous.y+eyeOf(previous),next.y+eyeOf(next)),z:lerp(previous.z,next.z),yaw:previous.yaw+turn*t,pitch:lerp(previous.pitch,next.pitch)};
}
