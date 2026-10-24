export const AVATARS=[
 {id:'ironman',name:'Iron Man',detail:'Red & gold armor',color:'#bd3b2f'},
] as const;
// Legacy asset identifiers remain internal to the renderer; only Iron Man is selectable.
export type AvatarId='ironman'|'spiderman'|'deadpool'|'captain-america'|'wonder-woman'|'batman'|'thor'|'groot'|'hulk'|'black-widow'|'operator';
export const validAvatar=(id:unknown):id is AvatarId=>id==='ironman';
