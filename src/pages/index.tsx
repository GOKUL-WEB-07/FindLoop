import {useMemo,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {ArrowUpRight,Bell,BookCheck,Inbox,LibraryBig,MessageCircle,PackageSearch,Send} from 'lucide-react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {useCreateItem,useItems} from '../hooks/useItems';
import {useDashboardCounts} from '../hooks/useWorkspace';
import {Empty,ItemCard,LoadingCards,PageIntro,SearchBox} from '../components/ui';
import {CATEGORIES,CONDITIONS} from '../constants';
import type {Item} from '../types';
import {useAuth} from '../features/auth/AuthContext';
export {Profile} from './Profile';
export {AuthPage,ForgotPassword} from './auth';
export {Detail} from './detail';
export {EditListing} from './edit';

export function Home(){
  const {data=[],isLoading}=useItems(); const {data:counts,isLoading:countsLoading,error:countsError}=useDashboardCounts();
  const lost=data.filter(x=>x.kind!=='lend').slice(0,2); const lend=data.filter(x=>x.kind==='lend').slice(0,2);
  const metrics=[
    ['/app/notifications?tab=my-requests','Pending requests',counts?.pending??0,Send],
    ['/app/borrowing','Currently borrowed',counts?.borrowed??0,BookCheck],
    ['/app/notifications?tab=requests','Needs your review',counts?.incoming??0,Inbox],
    ['/app/notifications','Unread updates',counts?.unread??0,Bell],
  ] as const;
  return <>
    <section className="dashboard-welcome"><div className="dashboard-statement"><span className="live-dot">Campus exchange</span><h2>Everything shared.<br/>Nothing lost.</h2><p>Report belongings, borrow campus resources, and follow every handoff from one trusted place.</p></div><div className="dashboard-actions"><Link className="button light" to="/app/lost-found/new">Report an item</Link><Link className="button outline-light" to="/app/borrow">Explore lending</Link></div></section>
    <section className="dashboard-metrics">{metrics.map(([to,label,value,Icon])=><Link to={to} className="metric-card" key={to}><span><Icon size={18}/></span><small>{label}</small><b>{countsLoading?'—':value}</b></Link>)}</section>
    {countsError&&<p className="dashboard-warning">Dashboard totals could not be refreshed. Apply all Supabase migrations and reload.</p>}
    <section className="dashboard-shortcuts"><Link to="/app/lost-found/new/lost"><PackageSearch/>Report lost</Link><Link to="/app/lost-found/new/found"><PackageSearch/>Report found</Link><Link to="/app/borrow/new"><LibraryBig/>Lend an item</Link><Link to="/app/messages"><MessageCircle/>Messages</Link></section>
    <div className="dashboard-feed"><Section title="Recent lost & found" link="/app/lost-found" items={lost} loading={isLoading}/><Section title="Available to borrow" link="/app/borrow" items={lend} loading={isLoading}/></div>
  </>;
}

function Section({title,link,items,loading}:{title:string;link:string;items:Item[];loading:boolean}){return <section className="section"><div className="section-head"><h2>{title}</h2><Link to={link}>View all <ArrowUpRight size={15}/></Link></div>{loading?<LoadingCards/>:items.length?<div className="grid cards">{items.map(x=><ItemCard key={x.id} item={x}/>)}</div>:<Empty title="Nothing here yet" copy="Be the first to add a listing."/>}</section>}

export function Listings({kind}:{kind:'lost-found'|'lend'}){
  const {data=[],isLoading,error}=useItems(kind); const {user}=useAuth(); const [q,setQ]=useState(''); const [type,setType]=useState<'all'|'lost'|'found'>('all'); const [category,setCategory]=useState('');
  const items=useMemo(()=>data.filter(x=>(kind!=='lend'||x.owner_id!==user?.id)&&(type==='all'||x.kind===type)&&(!category||x.category===category)&&`${x.title} ${x.category} ${x.description} ${x.location} ${x.library_name??''} ${x.owner?.full_name??''} ${x.owner?.department??''}`.toLowerCase().includes(q.toLowerCase())),[data,kind,user?.id,type,category,q]);
  const title=kind==='lend'?'Discover lending':'Lost & found';
  return <><PageIntro title={title} description={kind==='lend'?'Search books, equipment, and collections offered by people and campus libraries.':'Search active reports and help belongings get back to the right person.'} action={{to:kind==='lend'?'/app/borrow/new':'/app/lost-found/new',label:kind==='lend'?'Add lending item':'Report an item'}}/><div className="filters"><SearchBox value={q} onChange={setQ}/>{kind==='lost-found'&&<div className="segmented">{(['all','lost','found'] as const).map(t=><button type="button" className={type===t?'active':''} onClick={()=>setType(t)} key={t}>{t}</button>)}</div>}<select aria-label="Category" value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></div>{isLoading?<LoadingCards/>:error?<Empty title="Could not load listings" copy="Check your connection and refresh the page."/>:items.length?<div className="grid cards">{items.map(x=><ItemCard key={x.id} item={x}/>)}</div>:<Empty title="No matching items" copy="Try a different search or create the first listing." action={{to:kind==='lend'?'/app/borrow/new':'/app/lost-found/new',label:'Create listing'}}/>}</>;
}

const listingSchema=z.object({title:z.string().min(3,'Use at least 3 characters'),category:z.string().min(1,'Choose a category'),description:z.string().min(10,'Tell the community a little more'),location:z.string().min(2,'Add a campus location'),date:z.string().min(1,'Choose a date'),library_name:z.string().max(100).optional(),condition:z.string().optional(),max_duration:z.coerce.number().min(1).max(30).optional()});
type ListingValues=z.infer<typeof listingSchema>;

export function NewListing({kind}:{kind:'lost'|'lend'}){
  const {type}=useParams(); const nav=useNavigate(); const create=useCreateItem(); const initial:Item['kind']=kind==='lend'?'lend':type==='found'?'found':'lost'; const [mode,setMode]=useState<Item['kind']>(initial); const [photo,setPhoto]=useState<File>(); const [preview,setPreview]=useState<string>();
  const {register,handleSubmit,formState:{errors}}=useForm<ListingValues>({resolver:zodResolver(listingSchema),defaultValues:{date:new Date().toISOString().slice(0,10),max_duration:7}});
  const selectPhoto=(file?:File)=>{if(preview)URL.revokeObjectURL(preview);setPhoto(file);setPreview(file?URL.createObjectURL(file):undefined)};
  const submit=(v:ListingValues)=>create.mutate({kind:mode,title:v.title,category:v.category,description:v.description,location:v.location,date:v.date,library_name:v.library_name,condition:v.condition,max_duration:v.max_duration,image:photo},{onSuccess:()=>nav(mode==='lend'?'/app/lending':'/app/lost-found')});
  return <div className="form-wrap"><Link className="back form-back" to={kind==='lend'?'/app/lending':'/app/lost-found'}>← Back</Link><PageIntro title={mode==='lend'?'Add a lending item':mode==='found'?'Report a found item':'Report a lost item'} description="Add accurate details and a clear photo so the right person can respond."/><form onSubmit={handleSubmit(submit)} className="form-card">{kind==='lost'&&<div className="mode-switch"><button type="button" onClick={()=>setMode('lost')} className={mode==='lost'?'active':''}>Lost item</button><button type="button" onClick={()=>setMode('found')} className={mode==='found'?'active':''}>Found item</button></div>}<Field label="Item name" error={errors.title?.message}><input {...register('title')} placeholder="e.g. Casio calculator"/></Field>{mode==='lend'&&<Field label="Library / collection"><input {...register('library_name')} placeholder="e.g. Central Library"/></Field>}<div className="two"><Field label="Category" error={errors.category?.message}><select {...register('category')}><option value="">Select a category</option>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></Field><Field label={mode==='lend'?'Pickup location':'Last seen / found at'} error={errors.location?.message}><input {...register('location')} placeholder="e.g. Central Library"/></Field></div><Field label="Description" error={errors.description?.message}><textarea {...register('description')} placeholder="Include colour, brand, markings, edition, or anything helpful." rows={4}/></Field><label className="photo-picker"><span>{preview?<img src={preview} alt="Selected item preview"/>:'Choose a photo'}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>selectPhoto(e.target.files?.[0])}/><small>Camera or gallery · JPG, PNG or WebP · up to 5 MB</small></label><div className="two"><Field label={mode==='lend'?'Available from':'Date'} error={errors.date?.message}><input type="date" {...register('date')}/></Field>{mode==='lend'&&<Field label="Condition"><select {...register('condition')}>{CONDITIONS.map(x=><option key={x}>{x}</option>)}</select></Field>}</div>{mode==='lend'&&<Field label="Maximum duration (days)" error={errors.max_duration?.message}><input type="number" {...register('max_duration')}/></Field>}{create.error&&<p className="form-error">{create.error.message}</p>}<button className="button submit" disabled={create.isPending}>{create.isPending?'Publishing…':'Publish listing'}</button></form></div>;
}
function Field({label,error,children}:{label:string;error?:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}{error&&<small className="field-error">{error}</small>}</label>}
