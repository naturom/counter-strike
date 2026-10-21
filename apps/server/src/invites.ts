import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export type Invite={v:1;id:string;exp:number};
export function signer(secret:string) {
  if(Buffer.byteLength(secret)<32)throw new Error('INVITE_SECRET must contain at least 32 bytes');
  const sign=(body:string)=>createHmac('sha256',secret).update(body).digest('base64url');
  return {
    create(now=Date.now()) {const payload:Invite={v:1,id:randomBytes(16).toString('hex'),exp:now+7*86400000};const body=Buffer.from(JSON.stringify(payload)).toString('base64url');return `${body}.${sign(body)}`;},
    verify(token:unknown,now=Date.now()):Invite {
      if(typeof token!=='string'||token.length>512)throw new Error('Invalid invitation');
      const [body,sig,extra]=token.split('.');if(!body||!sig||extra)throw new Error('Invalid invitation');
      const expected=Buffer.from(sign(body));const actual=Buffer.from(sig);
      if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw new Error('Invalid invitation');
      let data:Invite;try{data=JSON.parse(Buffer.from(body,'base64url').toString());}catch{throw new Error('Invalid invitation');}
      if(data.v!==1||! /^[a-f0-9]{32}$/.test(data.id)||!Number.isSafeInteger(data.exp)||data.exp<=now)throw new Error('Invitation expired. Create a new room.');
      return data;
    }
  };
}
