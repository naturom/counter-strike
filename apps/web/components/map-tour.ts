import {dustPoint,SCOUT_TOWER,type MapId} from '@sirocco/shared';
export const MAP_TOUR=[
  {name:'MID · SCOUT TOWER',description:'Enter from Catwalk and climb the enclosed stairs to a lookout above the rooftops.',eye:dustPoint(563,563,SCOUT_TOWER.deck+1.6),target:dustPoint(480,300,7)},
  {name:'A · CT COURTYARD',description:'Team B defends Site A just beside its starting area, with approaches from Mid and CT.',eye:dustPoint(590,264,2.1),target:dustPoint(548,248,.35)},
  {name:'LONG · BLUE',description:'Double doors open into the street, with Blue to one side and Pit beyond.',eye:dustPoint(866,520,3.8),target:dustPoint(710,554,4)},
  {name:'MID · DOUBLE DOORS',description:'The central sightline connects Top Mid to the CT side.',eye:dustPoint(473,510,2.8),target:dustPoint(464,300,1.9)},
  {name:'B · T TERRACE',description:'Team A defends Site B on its home terrace, close to all four starting positions.',eye:dustPoint(405,943,5.3),target:dustPoint(355,905,3.5)},
  {name:'UPPER TUNNELS',description:'A covered flank, a sunlit roof opening and stairs down to Lower Tunnels.',eye:dustPoint(200,465,4.8),target:dustPoint(118,380,4.8)},
  {name:'SHORT · CATWALK',description:'Climb from Mid to the raised hotel platform above the CT approach.',eye:dustPoint(645,280,5.4),target:dustPoint(786,168,5.6)},
  {name:'CT · DEFEND A',description:'The lower CT route passes Site A, then beneath Short toward Long.',eye:dustPoint(590,230,1.6),target:dustPoint(548,248,.8)},
  {name:'T · SPAWN',description:'The terrace splits toward tunnels, Top Mid and the Long entrance.',eye:dustPoint(320,932,4.8),target:dustPoint(610,879,5.1)},
];
export const DEPOT_TOUR=[
 {name:'DEPOT · OVERVIEW',description:'A 40 × 35 metre loading yard with two warehouses, three routes and one low catwalk.',eye:{x:27,y:27,z:30},target:{x:0,y:0,z:0}},
 {name:'YARD · CONTAINERS',description:'Cargo containers and low pallet cover split the central yard into short, connected fights.',eye:{x:-4.7,y:1.65,z:10},target:{x:2,y:1.3,z:-5}},
 {name:'WEST · DEFEND B',description:'Team A starts inside Goods In, close to Site B. Two loading doors and the stairs lead out.',eye:{x:-17,y:1.6,z:10},target:{x:-8,y:1.45,z:6}},
 {name:'CATWALK · MID',description:'Stairs from either warehouse reach this 2.8 metre bridge. Walk underneath or fight over the yard.',eye:{x:-1,y:4.4,z:0},target:{x:2,y:.9,z:8}},
 {name:'NORTH · SERVICE LANE',description:'A fast flank along the back of the loading bays, with no direct line into the opposite spawn.',eye:{x:-17,y:1.6,z:-14.5},target:{x:10,y:1.4,z:-14.5}},
 {name:'EAST · DEFEND A',description:'Team B defends Dispatch and Site A. Attack through the yard, bridge or service doors.',eye:{x:8,y:1.6,z:-10},target:{x:14,y:1.2,z:-6}},
];
export const tourForMap=(map:MapId)=>map==='relay'?DEPOT_TOUR:MAP_TOUR;
