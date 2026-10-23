// A complete slash fits inside the existing 500 ms authoritative attack interval.
export const KNIFE_SWING_MS=440;
export type KnifeSwing={x:number;y:number;z:number;pitch:number;yaw:number;roll:number;guard:number};
type Key=[number,number,number,number,number,number,number];
const slash:Key[]=[
  [0,0,0,0,0,0,0],
  [.15,.065,.045,.035,-.10,-.22,-.18],
  [.36,-.13,.015,-.115,.10,.52,.72],
  [.56,-.24,-.085,-.035,.30,.80,1.02],
  [.77,-.095,-.055,.012,.10,.30,.40],
  [1,0,0,0,0,0,0]
];
const backhand:Key[]=[
  [0,0,0,0,0,0,0],
  [.15,-.055,-.025,.035,.12,.18,.22],
  [.36,.075,.035,-.105,-.18,-.38,-.48],
  [.56,.13,.01,-.025,-.22,-.52,-.65],
  [.77,.055,-.02,.015,-.08,-.18,-.20],
  [1,0,0,0,0,0,0]
];
export function knifeSwing(progress:number,reverse=false):KnifeSwing{
  const p=Number.isFinite(progress)?Math.min(1,Math.max(0,progress)):1,keys=reverse?backhand:slash;
  const index=keys.findIndex((key,i)=>i>0&&p<=key[0]),b=keys[Math.max(1,index)],a=keys[Math.max(0,index-1)];
  const t=(p-a[0])/(b[0]-a[0]),ease=t*t*(3-2*t),values=a.slice(1).map((value,i)=>value+(b[i+1]-value)*ease);
  return {x:values[0],y:values[1],z:values[2],pitch:values[3],yaw:values[4],roll:values[5],guard:Math.sin(p*Math.PI)};
}
