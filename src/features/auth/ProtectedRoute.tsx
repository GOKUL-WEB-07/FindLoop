import {Navigate,useLocation} from 'react-router-dom';import {useAuth} from './AuthContext';
export function ProtectedRoute({children}:{children:React.ReactNode}){const{user,loading}=useAuth();const loc=useLocation();if(loading)return <div className="page-center">Loading your campus space…</div>;return user?<>{children}</>:<Navigate to="/login" state={{from:loc.pathname}} replace/>}
