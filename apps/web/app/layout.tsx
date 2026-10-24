import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Super Strike — Own the dust.',description:'An original browser multiplayer desert FPS. Create a room, invite your squad, choose Dust III or Relay, and fight with your squad.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
