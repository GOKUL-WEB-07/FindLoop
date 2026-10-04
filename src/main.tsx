import './lib/install';
import {StrictMode} from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter,HashRouter} from 'react-router-dom'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query'; import {App} from './app/App'; import './styles.css'; import './styles-premium.css';
const Router=import.meta.env.BASE_URL==='/'?BrowserRouter:HashRouter;
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:1,staleTime:30_000}}})}><Router><App/></Router></QueryClientProvider></StrictMode>);
