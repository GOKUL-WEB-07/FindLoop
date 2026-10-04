import {DownloadPage} from '../pages/Download';
import {Navigate,Route,Routes} from 'react-router-dom';
import {ToastProvider} from '../components/feedback/ToastProvider';
import {Shell} from '../components/layout/Shell';
import {AuthProvider,useAuth} from '../features/auth/AuthContext';
import {ProtectedRoute} from '../features/auth/ProtectedRoute';
import {AuthPage,Detail,EditListing,ForgotPassword,Home,Listings,NewListing,Profile} from '../pages';
import {Borrowing,Lending,MessagesPage,MessageThread,NotificationsPage} from '../pages/workspace';

const Private=({children}:{children:React.ReactNode})=><ProtectedRoute><Shell>{children}</Shell></ProtectedRoute>;
function PublicOnly({children}:{children:React.ReactNode}){const{user,loading}=useAuth();if(loading)return <div className="page-center">Loading…</div>;return user?<Navigate to="/" replace/>:<>{children}</>}

export function App(){return <ToastProvider><AuthProvider><Routes>
  <Route path="/download" element={<DownloadPage/>}/>
  <Route path="/login" element={<PublicOnly><AuthPage mode="login"/></PublicOnly>}/>
  <Route path="/signup" element={<PublicOnly><AuthPage mode="signup"/></PublicOnly>}/>
  <Route path="/forgot-password" element={<PublicOnly><ForgotPassword/></PublicOnly>}/>
  <Route path="/" element={<Private><Home/></Private>}/>
  <Route path="/app" element={<Navigate to="/" replace/>}/>
  <Route path="/app/lost-found" element={<Private><Listings kind="lost-found"/></Private>}/>
  <Route path="/app/lost-found/new" element={<Private><NewListing kind="lost"/></Private>}/>
  <Route path="/app/lost-found/new/:type" element={<Private><NewListing kind="lost"/></Private>}/>
  <Route path="/app/lost-found/:id" element={<Private><Detail kind="lost"/></Private>}/>
  <Route path="/app/lost-found/:id/edit" element={<Private><EditListing kind="lost"/></Private>}/>
  <Route path="/app/borrow" element={<Private><Listings kind="lend"/></Private>}/>
  <Route path="/app/borrow/new" element={<Private><NewListing kind="lend"/></Private>}/>
  <Route path="/app/borrow/:id" element={<Private><Detail kind="lend"/></Private>}/>
  <Route path="/app/borrow/:id/edit" element={<Private><EditListing kind="lend"/></Private>}/>
  <Route path="/app/requests" element={<Navigate to="/app/notifications?tab=my-requests" replace/>}/>
  <Route path="/app/incoming" element={<Navigate to="/app/notifications" replace/>}/>
  <Route path="/app/borrowing" element={<Private><Borrowing/></Private>}/>
  <Route path="/app/lending" element={<Private><Lending/></Private>}/>
  <Route path="/app/lending/:id" element={<Private><Detail kind="lend"/></Private>}/>
  <Route path="/app/lending/:id/edit" element={<Private><EditListing kind="lend"/></Private>}/>
  <Route path="/app/messages" element={<Private><MessagesPage/></Private>}/>
  <Route path="/app/messages/:listingId/:peerId" element={<Private><MessageThread/></Private>}/>
  <Route path="/app/notifications" element={<Private><NotificationsPage/></Private>}/>
  <Route path="/app/activity" element={<Navigate to="/app/notifications?tab=my-requests" replace/>}/>
  <Route path="/app/profile" element={<Private><Profile/></Private>}/>
  <Route path="*" element={<Navigate to="/" replace/>}/>
</Routes></AuthProvider></ToastProvider>}
