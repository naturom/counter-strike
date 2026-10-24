import * as THREE from 'three';
import type {AvatarId,Equipment} from '@sirocco/shared';
import {WorldArt,disposeGroup} from './world';
/** One equipped model for gameplay, mirrors and profile previews. */
export function equipAvatarModel(art:WorldArt,model:THREE.Group,weapon:Equipment='rifle',avatar:AvatarId='ironman'){
 const previous=model.getObjectByName('equippedWeapon');if(previous)disposeGroup(previous);
 for(const name of ['unarmedLeftArm','unarmedRightArm']){const arm=model.getObjectByName(name);if(arm)arm.visible=false;}
 const held=art.weapon(weapon,false,true,avatar);held.name='equippedWeapon';held.scale.setScalar(.75);held.position.set(avatar==='ironman'?-.08:.25,1.14,avatar==='ironman'?-.46:-.22);model.add(held);model.userData.weapon=weapon;return held;
}
