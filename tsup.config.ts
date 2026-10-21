import {defineConfig} from 'tsup';
export default defineConfig({entry:['apps/server/src/index.ts'],format:['cjs'],outExtension:()=>({js:'.cjs'}),platform:'node',target:'node22',outDir:'apps/server/dist',splitting:false,clean:true,noExternal:['@sirocco/shared'],external:['next','@colyseus/core','@colyseus/ws-transport']});
