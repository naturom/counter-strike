/** Gameplay heights are measured at the player's feet, in world metres. */
export const FALL_DAMAGE={safeHeight:4,lethalHeight:15,maxDamage:100,exponent:1.35} as const;

/** Small drops are safe; longer falls grow progressively more punishing. */
export function fallDamage(height:number){
 if(!Number.isFinite(height)||height<=FALL_DAMAGE.safeHeight)return 0;
 const fraction=Math.min(1,(height-FALL_DAMAGE.safeHeight)/(FALL_DAMAGE.lethalHeight-FALL_DAMAGE.safeHeight));
 return Math.max(1,Math.round(FALL_DAMAGE.maxDamage*fraction**FALL_DAMAGE.exponent));
}
