import type {Vec3,HitZone} from './index';

export const TREX_RULES={hp:1000,limit:3,radius:.65,height:3.7,walkSpeed:2.1,huntSpeed:4.8,sight:48,biteRange:3.1,biteDamage:65,biteInterval:1300,windup:360,corpseMs:6000} as const;
export interface Trex extends Vec3 {id:string;hp:number;yaw:number;state:'roam'|'hunt'|'attack'|'dead';targetId:string|null;attackAt:number;deadAt:number;}
// The same oriented volumes follow the rendered torso, neck, head and tail.
export const TREX_HIT_VOLUMES=[
 {center:[0,2.15,.1],radii:[.72,.84,1.15],zone:'body'},
 {center:[0,2.85,-.9],radii:[.50,.65,.65],zone:'body'},
 {center:[0,3.12,-1.8],radii:[.43,.43,.85],zone:'head'},
 {center:[-.5,.95,.5],radii:[.32,.95,.53],zone:'body'},
 {center:[.5,.95,.5],radii:[.32,.95,.53],zone:'body'},
 {center:[0,1.85,1.5],radii:[.36,.35,.95],zone:'body'},
 {center:[0,1.55,2.7],radii:[.19,.20,.80],zone:'body'},
] as const;
export function rayTrex(origin:Vec3,direction:Vec3,trex:Trex):{distance:number;zone:HitZone}|null{
 const c=Math.cos(trex.yaw),s=Math.sin(trex.yaw),dx=origin.x-trex.x,dz=origin.z-trex.z,o=[c*dx-s*dz,origin.y-trex.y,s*dx+c*dz],d=[c*direction.x-s*direction.z,direction.y,s*direction.x+c*direction.z];let best:{distance:number;zone:HitZone}|null=null;
 for(const volume of TREX_HIT_VOLUMES){let a=0,b=0,k=-1;for(let i=0;i<3;i++){const p=(o[i]-volume.center[i])/volume.radii[i],v=d[i]/volume.radii[i];a+=v*v;b+=2*p*v;k+=p*p;}const disc=b*b-4*a*k;if(a<=0||disc<0)continue;const near=(-b-Math.sqrt(disc))/(2*a),far=(-b+Math.sqrt(disc))/(2*a);if(far<0)continue;const distance=Math.max(0,near);if(!best||distance<best.distance)best={distance,zone:volume.zone};}
 return best;
}
