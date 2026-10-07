import {supabase} from './lib/supabase';
import './lib/install';
import './lib/recoverAsset';
import {StrictMode} from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter,HashRouter} from 'react-router-dom'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query'; import {App} from './app/App'; import './styles.css'; import './styles-premium.css';
const Router=import.meta.env.BASE_URL==='/'?BrowserRouter:HashRouter;
async function renderApp(){
 const recovering=new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery';
 try{if(supabase){const{data}=await supabase.auth.getSession();if(recovering&&data.session){const base=import.meta.env.BASE_URL;window.history.replaceState(null,'',base==='/'?'/reset-password':base+'#/reset-password');}}}catch(error){console.error('Could not initialize the session',error);}
 createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:1,staleTime:30_000}}})}><Router><App/></Router></QueryClientProvider></StrictMode>);

}
void renderApp();
