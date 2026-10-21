import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Counter Strike — Own the dust.',description:'An original browser multiplayer desert FPS. Create a room, invite your squad, choose Dunes or Relay, and fight with your squad.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
