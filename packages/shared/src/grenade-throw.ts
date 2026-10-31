/** One server-timed sequence for the holder, mirrors, spectators and projectile. */
export const GRENADE_THROW={durationMs:1000,releaseMs:700,pinPullStart:.14,pinPullEnd:.34,fuseMs:2200} as const;
export type GrenadeThrow={startedAt:number;released:boolean};
export function grenadeThrowProgress(action:GrenadeThrow|undefined,time:number){
 if(!action)return 0;
 const progress=Math.max(0,Math.min(1,(time-action.startedAt)/GRENADE_THROW.durationMs)),release=GRENADE_THROW.releaseMs/GRENADE_THROW.durationMs;
 return action.released?Math.max(release,progress):Math.min(release-.000001,progress);
}
export const grenadeReleased=(progress:number)=>progress>=GRENADE_THROW.releaseMs/GRENADE_THROW.durationMs;
