export const AVATARS=[
 {id:'ironman',name:'Iron Man',detail:'Red & gold armor',color:'#bd3b2f'},
 {id:'ultraman',name:'Ultraman',detail:'Classic silver & red suit',color:'#c4cbd0'},
 {id:'wonder-woman',name:'Wonder Woman',detail:'Amazon warrior · red, navy & gold',color:'#b78e4f'},
] as const;
// Legacy asset identifiers remain internal to the renderer; only the catalog entries are selectable.
export type AvatarId='ultraman'|'ironman'|'spiderman'|'deadpool'|'captain-america'|'wonder-woman'|'batman'|'thor'|'groot'|'hulk'|'black-widow'|'operator';
export const validAvatar=(id:unknown):id is AvatarId=>id==='ironman'||id==='ultraman'||id==='wonder-woman';
