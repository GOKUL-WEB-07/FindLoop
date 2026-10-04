import {ArrowLeft,ImagePlus} from 'lucide-react';
import {useEffect,useState} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import {Empty,LoadingCards,PageIntro} from '../components/ui';
import {CATEGORIES,CONDITIONS} from '../constants';
import {useAuth} from '../features/auth/AuthContext';
import {useItem,useUpdateItem} from '../hooks/useItems';
import type {Item} from '../types';

export function EditListing({kind}:{kind:'lost'|'lend'}){
  const{id=''}=useParams();
  const nav=useNavigate();
  const{user}=useAuth();
  const{data:item,isLoading}=useItem(id,kind);
  const update=useUpdateItem();
  const[photo,setPhoto]=useState<File>();
  const[preview,setPreview]=useState('');
  const[photoError,setPhotoError]=useState('');
  const[form,setForm]=useState({title:'',category:'',description:'',location:'',date:'',condition:'Good',max_duration:7,library_name:''});

  useEffect(()=>{
    if(item)setForm({title:item.title,category:item.category,description:item.description,location:item.location,date:item.date.slice(0,10),condition:item.condition||'Good',max_duration:item.max_duration||7,library_name:item.library_name||''});
  },[item]);

  useEffect(()=>{
    if(!photo){setPreview(item?.image_url||'');return;}
    const url=URL.createObjectURL(photo);
    setPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[photo,item?.image_url]);

  if(isLoading)return <LoadingCards/>;
  if(!item||item.owner_id!==user?.id)return <Empty title="Listing unavailable" copy="Only the listing owner can edit this item." action={{to:kind==='lend'?'/app/lending':'/app/lost-found',label:'Back to listings'}}/>;

  function selectPhoto(file?:File){
    setPhotoError('');
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setPhotoError('Choose a JPG, PNG or WebP photo.');return;}
    if(!file.size||file.size>5*1024*1024){setPhotoError('Choose a photo up to 5 MB.');return;}
    setPhoto(file);
  }

  function submit(event:React.FormEvent){
    event.preventDefault();
    if(photoError)return;
    update.mutate({id:item!.id,kind:item!.kind as Item['kind'],...form,image:photo},{onSuccess:()=>nav(kind==='lend'?`/app/lending/${id}`:`/app/lost-found/${id}`)});
  }

  return <div className="form-wrap edit-listing-page">
    <button type="button" className="back edit-back" onClick={()=>nav(-1)}><ArrowLeft size={16}/> Back</button>
    <PageIntro title="Edit listing" description="Update the information shown to your campus community."/>
    <form className="form-card" onSubmit={submit}>
      <label className="field"><span>Item name</span><input required minLength={3} maxLength={120} value={form.title} onChange={event=>setForm({...form,title:event.target.value})}/></label>
      {kind==='lend'&&<label className="field"><span>Library / collection</span><input maxLength={100} value={form.library_name} onChange={event=>setForm({...form,library_name:event.target.value})}/></label>}
      <div className="two">
        <label className="field"><span>Category</span><select required value={form.category} onChange={event=>setForm({...form,category:event.target.value})}>{CATEGORIES.map(value=><option key={value}>{value}</option>)}</select></label>
        <label className="field"><span>{kind==='lend'?'Pickup location':'Last seen / found at'}</span><input required minLength={2} value={form.location} onChange={event=>setForm({...form,location:event.target.value})}/></label>
      </div>
      <label className="field"><span>Description</span><textarea required minLength={10} maxLength={2000} rows={5} value={form.description} onChange={event=>setForm({...form,description:event.target.value})}/></label>
      <label className="photo-picker edit-photo-picker">
        <span>{preview?<img src={preview} alt="Listing preview"/>:<span className="photo-placeholder"><ImagePlus size={24}/> Add listing photo</span>}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{selectPhoto(event.target.files?.[0]);event.target.value='';}}/>
        <small>{preview?'Choose another photo':'Camera or gallery'} · JPG, PNG or WebP · up to 5 MB</small>
      </label>
      {photoError&&<p className="form-error" role="alert">{photoError}</p>}
      {kind==='lend'?<>
        <div className="two">
          <label className="field"><span>Available from</span><input required type="date" value={form.date} onChange={event=>setForm({...form,date:event.target.value})}/></label>
          <label className="field"><span>Condition</span><select value={form.condition} onChange={event=>setForm({...form,condition:event.target.value})}>{CONDITIONS.map(value=><option key={value}>{value}</option>)}</select></label>
        </div>
        <label className="field"><span>Maximum duration</span><input type="number" min={1} max={30} value={form.max_duration} onChange={event=>setForm({...form,max_duration:Number(event.target.value)})}/></label>
      </>:<label className="field"><span>Date</span><input required type="date" value={form.date} onChange={event=>setForm({...form,date:event.target.value})}/></label>}
      {update.error&&<p className="form-error" role="alert">{update.error.message}</p>}
      <div className="form-actions"><button type="button" className="button secondary" onClick={()=>nav(-1)}>Cancel</button><button className="button" disabled={update.isPending||!!photoError}>{update.isPending?'Saving…':'Save changes'}</button></div>
    </form>
  </div>;
}
