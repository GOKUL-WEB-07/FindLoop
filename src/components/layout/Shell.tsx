import {Download,Bell,BookCheck,BookOpen,House,LibraryBig,LogOut,MessageCircle,Moon,PackagePlus,PanelLeftClose,PanelLeftOpen,Search,Sun,UserRound} from 'lucide-react';
import {useEffect,useState} from 'react';
import {Link,NavLink,useLocation,useNavigate} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../../features/auth/AuthContext';
import {useProfile} from '../../hooks/useProfile';
import {useDashboardCounts,useNotifications} from '../../hooks/useWorkspace';
import {supabase} from '../../lib/supabase';
import {useToast} from '../feedback/ToastProvider';

const links=[
  ['/', 'Overview', House], ['/app/lost-found', 'Lost & Found', Search], ['/app/borrow', 'Discover', BookOpen],
  ['/app/borrowing', 'Borrowed', BookCheck], ['/app/lending', 'My Lending', LibraryBig],
  ['/app/messages', 'Messages', MessageCircle], ['/app/profile', 'Profile', UserRound],
] as const;

export function Shell({children}:{children:React.ReactNode}){
  const{user,signOut}=useAuth();
  const nav=useNavigate();
  const location=useLocation();
  const{data:notices=[]}=useNotifications();
  const{data:counts}=useDashboardCounts();
  const{data:profile}=useProfile();
  const unread=notices.filter(notice=>!notice.read).length;
  const notificationCount=unread+(counts?.incoming??0);
  const{notify}=useToast();
  const queryClient=useQueryClient();
  const[dark,setDark]=useState(()=>localStorage.getItem('campus-theme')==='dark');
  const[collapsed,setCollapsed]=useState(()=>localStorage.getItem('campus-sidebar')==='closed');

  const sectionIsActive=(to:string)=>{
    const path=location.pathname;
    if(to==='/')return path==='/';
    if(to==='/app/lost-found')return path.startsWith('/app/lost-found');
    if(to==='/app/borrow')return path==='/app/borrow'||(/^\/app\/borrow\/[^/]+$/.test(path)&&path!=='/app/borrow/new');
    if(to==='/app/borrowing')return path.startsWith('/app/borrowing');
    if(to==='/app/lending')return path.startsWith('/app/lending')||path==='/app/borrow/new'||/^\/app\/borrow\/[^/]+\/edit$/.test(path);
    return path===to||path.startsWith(`${to}/`);
  };

  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('campus-theme',dark?'dark':'light')},[dark]);
  useEffect(()=>{localStorage.setItem('campus-sidebar',collapsed?'closed':'open')},[collapsed]);
  useEffect(()=>{
    const targetFor=(event:DragEvent)=>(event.target as HTMLElement|null)?.closest<HTMLElement>('.photo-picker,.avatar-picker,.message-compose-area');
    const dragOver=(event:DragEvent)=>{const target=targetFor(event);if(!target)return;event.preventDefault();target.classList.add('drag-active')};
    const dragLeave=(event:DragEvent)=>{const target=targetFor(event);if(target&&!target.contains(event.relatedTarget as Node|null))target.classList.remove('drag-active')};
    const drop=(event:DragEvent)=>{const target=targetFor(event);if(!target)return;event.preventDefault();target.classList.remove('drag-active');const file=event.dataTransfer?.files?.[0];const input=target.querySelector<HTMLInputElement>('input[type="file"]');if(!file||!input)return;const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))};
    document.addEventListener('dragover',dragOver);document.addEventListener('dragleave',dragLeave);document.addEventListener('drop',drop);
    return()=>{document.removeEventListener('dragover',dragOver);document.removeEventListener('dragleave',dragLeave);document.removeEventListener('drop',drop)};
  },[]);
  useEffect(()=>{const client=supabase;if(!client||!user)return;const channel=client.channel(`notifications-${user.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`recipient_id=eq.${user.id}`},payload=>{const notice=payload.new as {title:string;message:string};notify({title:notice.title,message:notice.message});for(const key of ['notifications','items','my-requests','my-borrowing','my-lending','owner-requests','dashboard-counts'])void queryClient.invalidateQueries({queryKey:[key]})}).subscribe();return()=>{void client.removeChannel(channel)}},[user,notify,queryClient]);

  const displayName=profile?.full_name||user?.user_metadata.full_name||'Campus member';
  const focusedRoute=/\/new(?:\/|$)|\/edit(?:\/|$)|^\/app\/messages\/[^/]+\/[^/]+$/.test(location.pathname);
  return <div className={`app-shell ${collapsed?'sidebar-collapsed':''} ${focusedRoute?'focus-route':''}`}>
    <aside>
      <div className="sidebar-head"><Link className="brand" to="/"><span>FL</span><b>FindLoop</b></Link><button className="collapse-button" aria-label={collapsed?'Open menu':'Close menu'} title={collapsed?'Open menu':'Close menu'} onClick={()=>setCollapsed(value=>!value)}>{collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button></div>
      <p className="nav-label">Workspace</p>
      <nav>{links.map(([to,label,Icon])=><NavLink key={to} to={to} className={sectionIsActive(to)?'active':''}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-footer"><button className="theme-toggle" onClick={()=>setDark(value=>!value)}>{dark?<Sun size={17}/>:<Moon size={17}/>}<span>{dark?'Light mode':'Dark mode'}</span></button><button className="signout" onClick={async()=>{await signOut();nav('/login')}}><LogOut size={18}/><span>Sign out</span></button></div>
    </aside>
    <main>
      <header><div><p className="eyebrow">Your campus</p><h1>{`Good ${greeting()}, ${displayName.split(' ')[0]}`}</h1></div><div className="header-actions"><Link className="icon-button" to="/download" aria-label="Install FindLoop" title="Install FindLoop"><Download size={20}/></Link><button className="desktop-theme" aria-label="Toggle theme" onClick={()=>setDark(value=>!value)}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button><Link aria-label={`${notificationCount} notifications and requests`} className="icon-button" to="/app/notifications"><Bell size={20}/>{notificationCount>0&&<i/>}</Link><Link className="user-chip" to="/app/profile"><span className="avatar">{profile?.avatar_url?<img src={profile.avatar_url} alt=""/>:displayName[0].toUpperCase()}</span><span><b>{displayName}</b><small>{user?.email}</small></span></Link></div></header>
      {children}
    </main>
    <nav className="mobile-nav"><NavLink to="/" end><House size={20}/><span>Home</span></NavLink><NavLink to="/app/borrow" end><BookOpen size={20}/><span>Discover</span></NavLink><Link to="/app/lost-found/new" className="add" aria-label="Add listing"><PackagePlus size={23}/></Link><NavLink to="/app/messages"><MessageCircle size={20}/><span>Messages</span></NavLink><NavLink to="/app/profile"><UserRound size={20}/><span>Profile</span></NavLink></nav>
  </div>;
}

function greeting(){const hour=new Date().getHours();return hour<12?'morning':hour<17?'afternoon':'evening'}
