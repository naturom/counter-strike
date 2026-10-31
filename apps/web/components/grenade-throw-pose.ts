import {GRENADE_THROW,grenadeReleased} from '@sirocco/shared';
const smooth=(p:number,a:number,b:number)=>{const t=Math.max(0,Math.min(1,(p-a)/(b-a)));return t*t*(3-2*t);};
type Key=readonly [number,number,number,number,number,number,number];
const keys:Key[]=[
 [0,0,0,0,0,0,0],
 [.14,0,.025,.015,.08,0,0],
 [.34,0,.025,.015,.08,0,0],
 [.54,.10,.045,.13,-.72,.16,-.10],
 [.70,-.035,.11,-.18,.50,-.10,.10],
 [.84,-.07,-.02,-.24,.75,-.15,.08],
 [1,0,0,0,0,0,0],
];
export function grenadeThrowPose(progress:number){
 const p=Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0)),i=Math.max(1,keys.findIndex((key,i)=>i>0&&p<=key[0])),a=keys[i-1],b=keys[i],t=smooth(p,a[0],b[0]),values=a.slice(1).map((v,j)=>v+(b[j+1]-v)*t);
 return {position:values.slice(0,3),rotation:values.slice(3),pinReach:smooth(p,0,.14)*(1-smooth(p,.38,.52)),pinPull:smooth(p,GRENADE_THROW.pinPullStart,GRENADE_THROW.pinPullEnd),pinVisible:p<.38,held:!grenadeReleased(p),open:smooth(p,.66,.74)};
}
