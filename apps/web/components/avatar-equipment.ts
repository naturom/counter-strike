import * as THREE from 'three';
import {bindIronManShoulders,bindUltramanShoulders,bindWonderWomanShoulders} from './suit-arm';
import {WONDER_WOMAN_ARM_LIFT} from './wonder-woman-proportions';
import {animateHands} from './held-equipment';
import type {AvatarId,Equipment} from '@sirocco/shared';
import {WorldArt,disposeGroup} from './world';
/** One equipped model for gameplay, mirrors and profile previews. */
export function equipAvatarModel(art:WorldArt,model:THREE.Group,weapon:Equipment='rifle',avatar:AvatarId='ironman'){
 const previous=model.getObjectByName('equippedWeapon');if(previous)disposeGroup(previous);
 for(const name of ['unarmedLeftArm','unarmedRightArm']){const arm=model.getObjectByName(name);if(arm)arm.visible=false;}
 if(avatar==='ultraman')for(const shoulder of model.getObjectsByProperty('name','ultraman-shoulder-bridge'))shoulder.visible=true;
 const held=art.weapon(weapon,false,true,avatar);held.name='equippedWeapon';held.scale.setScalar(.75);
 held.position.set(0,avatar==='wonder-woman'?1.26+WONDER_WOMAN_ARM_LIFT:avatar==='ironman'?1.30:1.26,avatar==='wonder-woman'?-.45:avatar==='ironman'?-.43:-.46);
 if(!['ironman','ultraman','wonder-woman'].includes(avatar))held.position.set(.25,1.14,-.22);
 held.userData.restPosition=held.position.clone();held.userData.restQuaternion=held.quaternion.clone();model.add(held);model.userData.weapon=weapon;
 if(avatar==='ironman'||avatar==='ultraman'||avatar==='wonder-woman'){
  if(avatar==='ironman')bindIronManShoulders(model,held);else if(avatar==='ultraman')bindUltramanShoulders(model,held);else bindWonderWomanShoulders(model,held);
  animateHands(held,weapon,{reload:0,throwProgress:0,plant:0,slash:1});
 }return held;
}
