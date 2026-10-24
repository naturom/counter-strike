import {ScopeOverlay} from './ScopeOverlay';
import type {ScopeLevel} from './sniper-scope';
export function CombatAim({scopeLevel,hit,headshot}:{scopeLevel:ScopeLevel;hit:boolean;headshot:boolean}){
  return <>
    <ScopeOverlay level={scopeLevel} hit={hit} headshot={headshot}/>
    {!scopeLevel&&<div className={`crosshair ${hit?'hit':''} ${headshot?'headshot':''}`} aria-hidden="true"><i/><i/><i/><i/></div>}
    {headshot&&<div className="headshot-confirm" role="status">HEADSHOT</div>}
  </>;
}
