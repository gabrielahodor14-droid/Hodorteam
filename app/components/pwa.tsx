"use client";

import {createContext,useContext,useEffect,useSyncExternalStore,type ReactNode} from "react";
import {WifiOff} from "lucide-react";

const Context=createContext({online:true});
function onlineSnapshot(){return navigator.onLine;}
function onlineSubscribe(callback:()=>void){
  window.addEventListener("online",callback);
  window.addEventListener("offline",callback);
  return()=>{
    window.removeEventListener("online",callback);
    window.removeEventListener("offline",callback);
  };
}

export function PwaProvider({children}:{children:ReactNode}){
  const online=useSyncExternalStore(onlineSubscribe,onlineSnapshot,()=>true);
  useEffect(()=>{
    if("serviceWorker" in navigator&&window.isSecureContext){
      void navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).catch(()=>{});
    }
  },[]);
  return <Context.Provider value={{online}}>
    {!online&&<div className="offline-banner" role="status"><WifiOff size={16}/><span>Fără internet. Reconectează-te pentru a salva.</span></div>}
    {children}
  </Context.Provider>;
}

export function usePwa(){return useContext(Context);}
