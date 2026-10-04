import './lib/install';
import {StrictMode} from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query'; import {App} from './app/App'; import './styles.css'; import './styles-premium.css';
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:1,staleTime:30_000}}})}><BrowserRouter><App/></BrowserRouter></QueryClientProvider></StrictMode>);
