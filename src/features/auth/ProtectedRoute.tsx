import {BrandSplash} from '../../components/BrandLogo';
import {Navigate,useLocation} from 'react-router-dom';import {useAuth} from './AuthContext';
export function ProtectedRoute({children}:{children:React.ReactNode}){const{user,loading}=useAuth();const loc=useLocation();if(loading)return <BrandSplash/>;return user?<>{children}</>:<Navigate to="/login" state={{from:loc.pathname+loc.search}} replace/>}
