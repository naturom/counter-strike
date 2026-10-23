import type {Equipment} from '@sirocco/shared';
export type ScopeLevel=0|1|2;
export const BASE_FOV=76;
export const SCOPE_POWER=[1,3,8] as const;
export const scopeFov=(level:ScopeLevel)=>2*Math.atan(Math.tan(BASE_FOV*Math.PI/360)/SCOPE_POWER[level])*180/Math.PI;
export type ScopeContext={weapon:Equipment;alive:boolean;locked:boolean;reloading:boolean;sprinting:boolean;playing:boolean};
export class SniperScope {
  level:ScopeLevel=0;
  private allowed(c:ScopeContext){return c.weapon==='marksman'&&c.alive&&c.locked&&!c.reloading&&!c.sprinting&&c.playing;}
  cycle(c:ScopeContext){this.level=this.allowed(c)?((this.level+1)%3) as ScopeLevel:0;return this.level;}
  sync(c:ScopeContext){if(!this.allowed(c))this.reset();return this.level;}
  reset(){this.level=0;}
}
