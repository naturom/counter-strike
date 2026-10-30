import type {Equipment} from '@sirocco/shared';

type Hold={position:readonly [number,number,number];pitch:number;yaw:number};
const standard:Hold={position:[.22,-.23,-.74],pitch:0,yaw:0};
const holds:Partial<Record<Equipment,Hold>>={
 rifle:{position:[.31,-.25,-.70],pitch:0,yaw:0},
 smg:{position:[.29,-.25,-.67],pitch:0,yaw:0},
 marksman:{position:[.32,-.25,-.72],pitch:0,yaw:0},
 pistol:{position:[.23,-.23,-.67],pitch:0,yaw:0},
 ak47:{position:[.31,-.25,-.70],pitch:0,yaw:0},
 m4a1s:{position:[.31,-.25,-.70],pitch:0,yaw:0},
 p90:{position:[.29,-.25,-.67],pitch:0,yaw:0},
 scar:{position:[.31,-.25,-.70],pitch:0,yaw:0},
 m249:{position:[.33,-.27,-.72],pitch:0,yaw:0},
 deagle:{position:[.25,-.23,-.68],pitch:0,yaw:0},
};
/** Frame the full-size gun beside the camera while keeping its bore aligned
 * with the crosshair's vanishing point. Cosmetic yaw would aim the barrel away
 * from the tracer even when the tracer starts at the correct muzzle socket. */
export function firstPersonHold(kind:Equipment):Hold{return holds[kind]??standard;}
