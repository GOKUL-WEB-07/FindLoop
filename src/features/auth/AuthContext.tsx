import {createContext,useContext,useEffect,useRef,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {useQueryClient} from '@tanstack/react-query';
import {supabase} from '../../lib/supabase';
import {clearMediaCache} from '../../services/media';
type Auth={user:User|null;loading:boolean;signOut:()=>Promise<void>};
const C=createContext<Auth>({user:null,loading:true,signOut:async()=>{}});export const useAuth=()=>useContext(C);
export function AuthProvider({children}:{children:React.ReactNode}){
 const[user,setUser]=useState<User|null>(null);const[loading,setLoading]=useState(true);const queryClient=useQueryClient();const account=useRef<string|null>(null);
 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  let active=true;let authChanged=false;
  const update=(next:User|null)=>{if(!active)return;if(account.current!==next?.id){queryClient.clear();clearMediaCache();account.current=next?.id??null;}setUser(next);setLoading(false);};
  const{data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{authChanged=true;update(session?.user??null);if(event==='PASSWORD_RECOVERY'){const base=import.meta.env.BASE_URL;window.location.replace(base==='/'?'/reset-password':base+'#/reset-password');}});
  void supabase.auth.getUser().then(({data,error})=>{if(!authChanged)update(error?null:data.user);}).catch(()=>{if(!authChanged)update(null);});
  return()=>{active=false;subscription.unsubscribe();};
 },[queryClient]);
 return <C.Provider value={{user,loading,signOut:async()=>{if(!supabase)return;const{error}=await supabase.auth.signOut();if(error)throw error;}}}>{children}</C.Provider>;
}
