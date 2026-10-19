import type {Metadata,Viewport} from "next";
import {PwaProvider} from "./components/pwa";
import "./globals.css";
export const metadata:Metadata={title:"Hodor Estates · Clienți & vizionări",description:"Clienți, bugete, preferințe și vizionări. Agenda ta imobiliară, într-un singur loc.",manifest:"/manifest.webmanifest",robots:{index:false,follow:false},icons:{icon:"/favicon.svg",apple:[{url:"/icons/apple-touch-icon.png",sizes:"180x180",type:"image/png"}]},appleWebApp:{capable:true,title:"Hodor Estates",statusBarStyle:"default"}};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#7046aa"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ro"><body><PwaProvider>{children}</PwaProvider></body></html>;}
