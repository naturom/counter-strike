import type {ImpactMark,Snapshot,Spray} from './index';

export type SnapshotUpdate=Omit<Snapshot,'impacts'|'sprays'>&Partial<Pick<Snapshot,'impacts'|'sprays'>>;
export interface SurfaceUpdate{reset?:boolean;impacts:ImpactMark[];sprays:Spray[];removedImpacts:number[];removedSprays:number[];}
/** Per-connection cursor: immutable paint/impact data only travels when changed. */
export class SurfaceCursor{
 private impacts=new Set<number>();private sprays=new Set<number>();
 next(state:Pick<Snapshot,'impacts'|'sprays'>,reset=false):SurfaceUpdate|undefined{
  const impacts=new Set(state.impacts.map(m=>m.id)),sprays=new Set(state.sprays.map(s=>s.id));
  const update:SurfaceUpdate={...(reset?{reset:true}:{}),impacts:state.impacts.filter(m=>reset||!this.impacts.has(m.id)),sprays:state.sprays.filter(s=>reset||!this.sprays.has(s.id)),removedImpacts:reset?[]:[...this.impacts].filter(id=>!impacts.has(id)),removedSprays:reset?[]:[...this.sprays].filter(id=>!sprays.has(id))};
  this.impacts=impacts;this.sprays=sprays;
  return reset||update.impacts.length||update.sprays.length||update.removedImpacts.length||update.removedSprays.length?update:undefined;
 }
}
/** Merge deltas before their accompanying movement snapshot. Full snapshots
 * remain supported for older servers and negotiation/reconnection. */
export class SurfaceCache{
 private impacts=new Map<number,ImpactMark>();private sprays=new Map<number,Spray>();
 apply(update:SurfaceUpdate){
  if(update.reset){this.impacts.clear();this.sprays.clear();}
  for(const id of update.removedImpacts)this.impacts.delete(id);for(const id of update.removedSprays)this.sprays.delete(id);
  for(const mark of update.impacts)this.impacts.set(mark.id,mark);for(const spray of update.sprays)this.sprays.set(spray.id,spray);
 }
 merge(state:SnapshotUpdate):Snapshot{
  if(state.impacts)this.impacts=new Map(state.impacts.map(m=>[m.id,m]));if(state.sprays)this.sprays=new Map(state.sprays.map(s=>[s.id,s]));
  return {...state,impacts:[...this.impacts.values()],sprays:[...this.sprays.values()]};
 }
}
