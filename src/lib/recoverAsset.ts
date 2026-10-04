// A page left open during deployment can reference a removed chunk.
// Reload at most once per minute, preserving the current route.
window.addEventListener('vite:preloadError',()=>{
  if(!navigator.onLine)return;
  try{
    const key='findloop-asset-reload';
    const last=Number(sessionStorage.getItem(key)||0);
    if(Date.now()-last<60_000)return;
    sessionStorage.setItem(key,String(Date.now()));
    const url=new URL(window.location.href);
    url.searchParams.set('app-update',String(Date.now()));
    window.location.replace(url.href);
  }catch{
    // Leave the original error visible if storage or navigation is unavailable.
  }
});
