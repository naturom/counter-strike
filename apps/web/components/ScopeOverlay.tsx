import {SCOPE_POWER,type ScopeLevel} from './sniper-scope';
export function ScopeOverlay({level,hit=false,headshot=false}:{level:ScopeLevel;hit?:boolean;headshot?:boolean}){
  if(!level)return null;
  return <div className={`scope-overlay ${hit?'confirmed-hit':''} ${headshot?'confirmed-headshot':''}`} role="img" aria-label={`Sniper scope, ${SCOPE_POWER[level]} times zoom`}>
    <div className="scope-lens"><svg viewBox="0 0 1000 1000" aria-hidden="true"><path className="scope-lines" d="M0 500H1000M500 0V1000"/>{[-3,-2,-1,1,2,3].map(n=><path className="scope-ticks" key={n} d={`M${500+n*65} 492v16M492 ${500+n*65}h16`}/>)}<circle className="scope-dot" cx="500" cy="500" r="2"/></svg><span className="scope-power">{SCOPE_POWER[level]}×</span></div>
  </div>;
}
