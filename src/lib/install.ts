import {useSyncExternalStore} from 'react';

interface InstallPrompt extends Event {
  prompt():Promise<void>;
  userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
}
let prompt:InstallPrompt|null=null;
let installed=window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(listener=>listener());
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();prompt=event as InstallPrompt;emit();
});
window.addEventListener('appinstalled',()=>{installed=true;prompt=null;emit()});
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};
export function useInstall(){
  const state=useSyncExternalStore(subscribe,()=>installed?'installed':prompt?'ready':'manual');
  async function install(){
    const pending=prompt;
    if(!pending)return;
    prompt=null;emit();
    await pending.prompt();
    await pending.userChoice;
  }
  return {state,install};
}

if(import.meta.env.PROD&&'serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(error=>console.error('FindLoop service worker registration failed',error));
  });
}
