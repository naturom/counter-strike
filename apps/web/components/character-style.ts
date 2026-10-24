import type {AvatarId} from '@sirocco/shared';
export type CharacterStyle={primary:string;secondary:string;trim:string;hands:string;metal:number;surface:'armor'|'weave'|'leather'|'skin'|'bark'};
export const CHARACTER_STYLE:Record<AvatarId,CharacterStyle>={
 ironman:{primary:'#a51e25',secondary:'#c6a15a',trim:'#23282b',hands:'#991f1c',metal:.8,surface:'armor'},
 spiderman:{primary:'#9d2534',secondary:'#193b61',trim:'#151c25',hands:'#ad2937',metal:.05,surface:'weave'},
 deadpool:{primary:'#7d242c',secondary:'#202329',trim:'#493e32',hands:'#822731',metal:.05,surface:'leather'},
 'captain-america':{primary:'#263d57',secondary:'#9dabb0',trim:'#82332e',hands:'#5d392e',metal:.3,surface:'leather'},
 'wonder-woman':{primary:'#882d29',secondary:'#ad8d51',trim:'#283750',hands:'#bb8c70',metal:.65,surface:'skin'},
 batman:{primary:'#272e32',secondary:'#12191e',trim:'#716343',hands:'#20272b',metal:.35,surface:'armor'},
 thor:{primary:'#3c4853',secondary:'#919b9f',trim:'#752c34',hands:'#c1987d',metal:.7,surface:'skin'},
 groot:{primary:'#675039',secondary:'#9a7c53',trim:'#313f2b',hands:'#766044',metal:0,surface:'bark'},
 hulk:{primary:'#53743c',secondary:'#7b9455',trim:'#4b3a4e',hands:'#5e8042',metal:0,surface:'skin'},
 'black-widow':{primary:'#1b242b',secondary:'#3b4951',trim:'#623724',hands:'#25292c',metal:.1,surface:'leather'},
 operator:{primary:'#53634d',secondary:'#939580',trim:'#303b35',hands:'#8d8169',metal:.02,surface:'weave'},
};
