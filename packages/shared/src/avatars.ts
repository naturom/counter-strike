export const AVATARS=[
 {id:'ironman',name:'Iron Man',detail:'Red & gold armor',color:'#bd3b2f'},
 {id:'spiderman',name:'Spider-Man',detail:'Webbed combat suit',color:'#bd3545'},
 {id:'deadpool',name:'Deadpool',detail:'Crimson tactical suit',color:'#a83037'},
 {id:'captain-america',name:'Captain America',detail:'Armored star-spangled suit',color:'#355d93'},
 {id:'wonder-woman',name:'Wonder Woman',detail:'Amazonian battle armor',color:'#aa7540'},
 {id:'batman',name:'Batman',detail:'Dark armored cowl',color:'#52616b'},
 {id:'thor',name:'Thor',detail:'Asgardian armor & cape',color:'#8a4050'},
 {id:'groot',name:'Groot',detail:'Living bark & branches',color:'#8e704a'},
 {id:'hulk',name:'Hulk',detail:'Green skin & heavy build',color:'#65904e'},
 {id:'black-widow',name:'Black Widow',detail:'Black tactical suit',color:'#52636a'},
] as const;
export type AvatarId=typeof AVATARS[number]['id']|'operator';
export const validAvatar=(id:unknown):id is AvatarId=>id==='operator'||AVATARS.some(a=>a.id===id);
