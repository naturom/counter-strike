import {isSidearm,type AvatarId,type Weapon} from '@sirocco/shared';
type Point=readonly [number,number,number];
export type GunGrip={support:Point;worldSupport:Point;reload:'box'|'top'|'belt';magazineContact:Point};
/** Palm contacts are authored against each actual gun, rather than treating a
 * bullpup top magazine or a belt box as a rifle's downward magazine. */
const grips:Record<Weapon,GunGrip>={
 rifle:{support:[-.025,-.09,-.34],worldSupport:[-.055,-.09,-.20],reload:'box',magazineContact:[-.065,-.02,.015]},
 pistol:{support:[-.069,-.156,.037],worldSupport:[-.069,-.156,.037],reload:'box',magazineContact:[-.054,-.018,.015]},
 smg:{support:[-.025,-.10,-.255],worldSupport:[-.045,-.10,-.18],reload:'box',magazineContact:[-.065,-.03,.015]},
 marksman:{support:[-.025,-.105,-.37],worldSupport:[-.055,-.09,-.20],reload:'box',magazineContact:[-.065,-.015,.015]},
 ak47:{support:[-.025,-.09,-.35],worldSupport:[-.055,-.09,-.21],reload:'box',magazineContact:[-.062,-.025,.035]},
 m4a1s:{support:[-.025,-.09,-.34],worldSupport:[-.055,-.09,-.20],reload:'box',magazineContact:[-.065,-.02,.015]},
 p90:{support:[-.025,-.135,-.23],worldSupport:[-.045,-.135,-.16],reload:'top',magazineContact:[-.070,.004,.11]},
 scar:{support:[-.025,-.10,-.35],worldSupport:[-.055,-.10,-.21],reload:'box',magazineContact:[-.065,-.015,.015]},
 m249:{support:[-.035,-.105,-.405],worldSupport:[-.065,-.105,-.22],reload:'belt',magazineContact:[-.15,.02,.055]},
 deagle:{support:[-.075,-.16,.045],worldSupport:[-.075,-.16,.045],reload:'box',magazineContact:[-.058,-.02,.015]},
};
export const gunGrip=(weapon:Weapon)=>grips[weapon];
export function worldGunHold(weapon:Weapon,avatar:AvatarId):Point{
 if(isSidearm(weapon))return [0,avatar==='ironman'?1.30:1.26,-.43];
 return avatar==='ironman'?[.21,1.32,-.30]:avatar==='wonder-woman'?[.18,1.26,-.28]:[.21,1.30,-.29];
}
