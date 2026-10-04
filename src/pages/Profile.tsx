import {Camera} from 'lucide-react';
import {useEffect,useState} from 'react';
import {LoadingCards,PageIntro} from '../components/ui';
import {useAuth} from '../features/auth/AuthContext';
import {useProfile,useUpdateProfile} from '../hooks/useProfile';
import {useDashboardCounts} from '../hooks/useWorkspace';

export function Profile(){
  const{user}=useAuth();
  const{data:profile,isLoading}=useProfile();
  const{data:counts}=useDashboardCounts();
  const update=useUpdateProfile();
  const[editing,setEditing]=useState(false);
  const[avatar,setAvatar]=useState<File>();
  const[avatarPreview,setAvatarPreview]=useState('');
  const[avatarError,setAvatarError]=useState('');
  const[f,setF]=useState({full_name:'',department:'',academic_year:'',bio:''});

  useEffect(()=>setF({full_name:profile?.full_name||user?.user_metadata.full_name||'',department:profile?.department||'',academic_year:profile?.academic_year||'',bio:profile?.bio||''}),[profile,user]);
  useEffect(()=>{if(!avatar){setAvatarPreview(profile?.avatar_url||'');return;}const url=URL.createObjectURL(avatar);setAvatarPreview(url);return()=>URL.revokeObjectURL(url)},[avatar,profile?.avatar_url]);
  if(isLoading)return <LoadingCards/>;

  function chooseAvatar(file?:File){
    setAvatarError('');
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setAvatarError('Choose a JPG, PNG or WebP photo.');return;}
    if(!file.size||file.size>3*1024*1024){setAvatarError('Choose a profile photo up to 3 MB.');return;}
    setAvatar(file);
  }

  function save(event:React.FormEvent){event.preventDefault();if(avatarError)return;update.mutate({...f,avatar},{onSuccess:()=>{setEditing(false);setAvatar(undefined)}})}
  const initial=(f.full_name||user?.email||'U')[0].toUpperCase();
  return <>
    <PageIntro title="Your profile" description="Manage the details visible to your campus community."/>
    <section className="profile-card">
      <div className="profile-avatar">{avatarPreview?<img src={avatarPreview} alt={`${f.full_name||'User'} profile`}/>:initial}</div>
      <div><h2>{f.full_name||'Campus member'}</h2><p>{user?.email}</p><p className="muted">{f.department||'Add your department'} {f.academic_year&&`· ${f.academic_year}`}</p></div>
      <button className="button secondary" onClick={()=>setEditing(value=>!value)}>{editing?'Cancel':'Edit profile'}</button>
    </section>
    {editing&&<form className="form-card profile-form" onSubmit={save}>
      <label className="avatar-picker"><span className="profile-avatar preview">{avatarPreview?<img src={avatarPreview} alt="Profile preview"/>:initial}</span><span><b><Camera size={16}/> Choose profile photo</b><small>JPG, PNG or WebP · up to 3 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{chooseAvatar(event.target.files?.[0]);event.target.value=''}}/></label>
      {avatarError&&<p className="form-error" role="alert">{avatarError}</p>}
      <label className="field"><span>Full name</span><input required value={f.full_name} onChange={event=>setF({...f,full_name:event.target.value})}/></label>
      <div className="two"><label className="field"><span>Department</span><input value={f.department} placeholder="e.g. Computer Science" onChange={event=>setF({...f,department:event.target.value})}/></label><label className="field"><span>Year / batch</span><input value={f.academic_year} placeholder="e.g. 2026" onChange={event=>setF({...f,academic_year:event.target.value})}/></label></div>
      <label className="field"><span>Short bio</span><textarea maxLength={280} rows={3} value={f.bio} placeholder="A little about you…" onChange={event=>setF({...f,bio:event.target.value})}/></label>
      {update.error&&<p className="form-error" role="alert">{update.error.message}</p>}
      <button className="button submit" disabled={update.isPending||!!avatarError}>{update.isPending?'Saving…':'Save profile'}</button>
    </form>}
    <div className="stats"><div><b>{counts?.listings??0}</b><span>Listings</span></div><div><b>{counts?.borrowed??0}</b><span>Borrowed</span></div><div><b>{counts?.lent??0}</b><span>Lent</span></div></div>
  </>;
}
