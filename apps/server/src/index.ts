import next from 'next';
import path from 'node:path';
import {createGameServer} from './http';
import {log} from './rooms';
async function main(){
  const dev=process.env.NODE_ENV!=='production';
  const app=next({dev,dir:path.resolve('apps/web'),hostname:'0.0.0.0',port:Number(process.env.PORT??3000)});
  await app.prepare();
  const server=await createGameServer({handler:app.getRequestHandler()});
  const port=await server.listen(Number(process.env.PORT??3000));
  log('server_ready',{port,mode:dev?'development':'production'});
  let closing=false;
  const shutdown=async()=>{if(closing)return;closing=true;log('shutdown');const timeout=setTimeout(()=>process.exit(1),8500);timeout.unref();await server.close();await app.close();process.exit(0);};
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
main().catch(error=>{console.error(JSON.stringify({severity:'ERROR',event:'startup_failed',message:error.message}));process.exit(1);});
