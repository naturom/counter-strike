export type Stance={crouch:number;air:number;landing:number;vy:number;grounded:boolean};
/** The same stance transitions drive the reflected body and first-person hands. */
export class StanceMotion{
 private initialized=false;private grounded=true;private velocity=0;
 readonly value:Stance={crouch:0,air:0,landing:0,vy:0,grounded:true};
 update(dt:number,grounded:boolean,crouched=false,vy=0){
  dt=Math.max(0,Math.min(dt,.1));const state=this.value;
  if(!this.initialized){state.crouch=Number(crouched);state.air=Number(!grounded);this.initialized=true;}
  if(grounded&&!this.grounded&&this.velocity<-.8)state.landing=Math.min(1,Math.abs(this.velocity)/9.4);
  const approach=(value:number,target:number,rate:number)=>Math.abs(value-target)<.0001?target:value+(target-value)*(1-Math.exp(-dt*rate));
  state.crouch=approach(state.crouch,Number(crouched),16);state.air=approach(state.air,Number(!grounded),grounded?26:18);
  state.landing=approach(state.landing,0,13);state.vy=vy;state.grounded=grounded;this.grounded=grounded;this.velocity=vy;return state;
 }
}
export function firstPersonStance(stance:Stance,reduceMotion=false){
 const motion=reduceMotion?0:1;
 return {y:-.023*stance.crouch+motion*(Math.max(-.032,Math.min(.032,-stance.vy*.003))-.035*stance.landing),z:.025*stance.crouch+.018*stance.air*motion,pitch:.022*stance.crouch+motion*(.025*stance.air+.045*stance.landing)};
}
