import {resolveListingMedia} from './media';
import { supabase } from '../lib/supabase'; import type { Item } from '../types';
const demo:Item[]=[
 {id:'1',kind:'found',title:'Black scientific calculator',category:'Electronics',description:'Found near the central library entrance.',location:'Central Library',date:'2026-09-18',status:'active',owner_id:'a',owner:{id:'a',full_name:'Campus Finder',department:'Library Services',academic_year:'Staff',created_at:'2026-01-01T00:00:00Z'},created_at:'2026-09-18T09:00:00Z'},
 {id:'2',kind:'lost',title:'Blue water bottle',category:'Bottles',description:'Steel bottle with a small SRM sticker.',location:'Mechanical Block',date:'2026-09-17',status:'active',owner_id:'b',owner:{id:'b',full_name:'Student User',department:'Mechanical Engineering',academic_year:'2026',created_at:'2026-01-01T00:00:00Z'},created_at:'2026-09-17T11:00:00Z'},
 {id:'3',kind:'lend',title:'DSA reference book',category:'Books',description:'Introduction to Algorithms, 4th edition. Handle with care.',location:'Main Campus',date:'2026-09-16',status:'available',owner_id:'c',condition:'Good',max_duration:7,created_at:'2026-09-16T08:00:00Z'}
];
const mapItem=(x:any,kind?:Item['kind']):Item=>({ ...x,kind:kind==='lend'?'lend':x.listing_type,title:x.title||x.item_name,location:x.location||x.pickup_location,date:x.available_from||x.event_date||x.created_at,max_duration:x.max_borrow_days,image_url:x.image_urls?.[0] });
const ownerFields='owner:profiles!lost_found_items_owner_id_fkey(id,full_name,avatar_url,department,academic_year,created_at)';
export async function getItems(kind?:Item['kind']|'lost-found'):Promise<Item[]> {if(!supabase)return kind&&kind!=='lost-found'?demo.filter(x=>x.kind===kind):kind==='lost-found'?demo.filter(x=>x.kind!=='lend'):demo;if(!kind){const[lf,lend]=await Promise.all([supabase.from('lost_found_items').select(`*,${ownerFields}`).in('status',['active','potential_match']).order('created_at',{ascending:false}).limit(30),supabase.from('lending_items').select('*').eq('status','available').order('created_at',{ascending:false}).limit(30)]);if(lf.error)throw lf.error;if(lend.error)throw lend.error;return Promise.all([...(lf.data??[]).map(x=>mapItem(x)),...(lend.data??[]).map(x=>mapItem(x,'lend'))].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(resolveListingMedia));}const table=kind==='lend'?'lending_items':'lost_found_items';const selection=kind==='lend'?'*':`*,${ownerFields}`;const q=supabase.from(table).select(selection).order('created_at',{ascending:false}).limit(50);if(kind==='lend')q.eq('status','available');else if(kind==='lost-found')q.in('status',['active','potential_match']);else q.eq('listing_type',kind).in('status',['active','potential_match']);const{data,error}=await q;if(error)throw error;return Promise.all((data??[]).map(x=>resolveListingMedia(mapItem(x,kind==='lend'?'lend':undefined))));}
export async function getItem(id:string,kind:Item['kind']):Promise<Item|null>{if(!supabase)return demo.find(x=>x.id===id)??null;const table=kind==='lend'?'lending_items':'lost_found_items';const selection=kind==='lend'?'*,owner:profiles!lending_items_owner_id_fkey(id,full_name,avatar_url,department,academic_year,created_at),borrow_transactions(id,status,due_date,borrower_id,borrower:profiles!borrow_transactions_borrower_id_fkey(id,full_name,avatar_url,department,academic_year))':`*,${ownerFields}`;const{data,error}=await supabase.from(table).select(selection).eq('id',id).maybeSingle();if(error)throw error;if(!data&&kind==='lend'){const{data:request}=await supabase.from('borrow_requests').select('id,status').eq('item_id',id).in('status',['approved','completed']).limit(1).maybeSingle();if(request)throw new Error('Your request is approved, but the borrowed listing is blocked by an outdated database access policy. Apply 008_borrowing_access_repair.sql in Supabase.');}return data?resolveListingMedia(mapItem(data,kind==='lend'?'lend':undefined)):null;}
const lendingDateError=(message:string)=>/available_from/i.test(message)?new Error('Lending availability dates are not configured. Apply 010_lending_availability_date.sql in Supabase, then try again.'):null;
export async function createItem(item:Omit<Item,'id'|'created_at'|'owner_id'|'status'> & {image?:File}){
  if(!supabase)throw new Error('Supabase is not configured.');
  const user=(await supabase.auth.getUser()).data.user;
  if(!user)throw new Error('Please sign in first.');
  let imageUrls:string[]=[];
  let uploadedPath:string|undefined;
  if(item.image){
    if(!['image/jpeg','image/png','image/webp'].includes(item.image.type))throw new Error('Choose a JPG, PNG or WebP photo.');
    if(item.image.size>5*1024*1024)throw new Error('Images must be 5 MB or smaller.');
    const ext=item.image.name.split('.').pop()||'jpg';
    uploadedPath=`${user.id}/${crypto.randomUUID()}.${ext}`;
    const{error:uploadError}=await supabase.storage.from('item-images').upload(uploadedPath,item.image,{contentType:item.image.type,upsert:false});
    if(uploadError)throw new Error('Photo upload failed. Check the item-images storage setup and try again.');
    imageUrls=[supabase.storage.from('item-images').getPublicUrl(uploadedPath).data.publicUrl];
  }
  let error;
  if(item.kind==='lend'){
    const values={owner_id:user.id,title:item.title,category:item.category,description:item.description,pickup_location:item.location,library_name:item.library_name||null,available_from:item.date,condition:item.condition??'Good',max_borrow_days:item.max_duration??7,status:'available',image_urls:imageUrls};
    ({error}=await supabase.from('lending_items').insert(values));
    if(error)error=lendingDateError(error.message)??error;
    if(error&&/library_name/i.test(error.message))error=new Error('The lending collection field is not configured. Apply 003_lending_workflows.sql in Supabase.');
  }else{
    ({error}=await supabase.from('lost_found_items').insert({owner_id:user.id,item_name:item.title,listing_type:item.kind,category:item.category,description:item.description,location:item.location,event_date:item.date,status:'active',image_urls:imageUrls}));
  }
  if(error){
    if(uploadedPath)await supabase.storage.from('item-images').remove([uploadedPath]);
    throw error;
  }
}
export async function markFoundItemRecovered(input:string|{id:string;kind:'lost'|'found'}){if(!supabase)throw new Error('Supabase is not configured.');const id=typeof input==='string'?input:input.id;const kind=typeof input==='string'?'lost':input.kind;const{data,error}=await supabase.from('lost_found_items').update({status:kind==='found'?'returned':'recovered',updated_at:new Date().toISOString()}).eq('id',id).eq('listing_type',kind).eq('status','active').select('id').maybeSingle();if(error)throw error;if(!data)throw new Error('This listing is no longer active or you cannot change it.');}
export type ItemUpdate={id:string;kind:Item['kind'];title:string;category:string;description:string;location:string;date:string;condition?:string;max_duration?:number;library_name?:string;image?:File};
export async function updateItem(input:ItemUpdate){
  if(!supabase)throw new Error('Supabase is not configured.');
  const table=input.kind==='lend'?'lending_items':'lost_found_items';
  const{data:current,error:readError}=await supabase.from(table).select('image_urls').eq('id',input.id).single();
  if(readError)throw readError;
  let uploadedPath:string|undefined;
  let imageUrls=(current?.image_urls as string[]|undefined)??[];
  if(input.image){
    const extensions:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
    const extension=extensions[input.image.type];
    if(!extension)throw new Error('Choose a JPG, PNG or WebP photo.');
    if(!input.image.size||input.image.size>5*1024*1024)throw new Error('Images must be between 1 byte and 5 MB.');
    const{data:{user}}=await supabase.auth.getUser();
    if(!user)throw new Error('Please sign in again.');
    uploadedPath=`${user.id}/${input.id}/${crypto.randomUUID()}.${extension}`;
    const{error:uploadError}=await supabase.storage.from('item-images').upload(uploadedPath,input.image,{contentType:input.image.type,upsert:false});
    if(uploadError)throw new Error('Photo upload failed. Check the item-images storage policies and try again.');
    imageUrls=[supabase.storage.from('item-images').getPublicUrl(uploadedPath).data.publicUrl];
  }
  const common={updated_at:new Date().toISOString(),...(uploadedPath?{image_urls:imageUrls}:{})};
  const values=input.kind==='lend'?{...common,title:input.title.trim(),category:input.category,description:input.description.trim(),pickup_location:input.location.trim(),available_from:input.date,condition:input.condition||'Good',max_borrow_days:input.max_duration||7,library_name:input.library_name?.trim()||null}:{...common,item_name:input.title.trim(),category:input.category,description:input.description.trim(),location:input.location.trim(),event_date:input.date};
  const{data:updated,error}=await supabase.from(table).update(values).eq('id',input.id).select('id').maybeSingle();
  if(error||!updated){if(uploadedPath)await supabase.storage.from('item-images').remove([uploadedPath]);if(!error)throw new Error('This listing is no longer available or you cannot edit it.');throw input.kind==='lend'?lendingDateError(error.message)??error:error;}
  if(uploadedPath){
    const marker='/storage/v1/object/public/item-images/';
    const oldPaths=((current?.image_urls as string[]|undefined)??[]).map(url=>url.includes(marker)?decodeURIComponent(url.split(marker)[1]):'').filter(Boolean);
    if(oldPaths.length)await supabase.storage.from('item-images').remove(oldPaths);
  }
}
export async function deleteItem({id,kind}:{id:string;kind:Item['kind']}):Promise<{archived:boolean}>{if(!supabase)throw new Error('Supabase is not configured.');const table=kind==='lend'?'lending_items':'lost_found_items';const{data,error:readError}=await supabase.from(table).select('image_urls').eq('id',id).single();if(readError)throw readError;if(kind==='lend'){const{data:history,error:historyError}=await supabase.from('borrow_transactions').select('id').eq('item_id',id).limit(1);if(historyError)throw historyError;if(history?.length){const timestamp=new Date().toISOString();const{data:archived,error:archiveError}=await supabase.from('lending_items').update({status:'archived',archived_at:timestamp,updated_at:timestamp}).eq('id',id).select('id').maybeSingle();if(!archiveError&&!archived)throw new Error('You cannot remove this listing.');if(archiveError){if(/archived_at|schema cache/i.test(archiveError.message))throw new Error('Apply the latest Supabase migration before removing lending items with loan history.');throw archiveError;}return{archived:true};}}const{data:deleted,error}=await supabase.from(table).delete().eq('id',id).select('id').maybeSingle();if(error)throw error;if(!deleted)throw new Error('This listing was already removed or you cannot delete it.');const marker='/storage/v1/object/public/item-images/';const paths=((data?.image_urls as string[]|undefined)??[]).map(url=>url.includes(marker)?decodeURIComponent(url.split(marker)[1]):'').filter(Boolean);if(paths.length)await supabase.storage.from('item-images').remove(paths);return{archived:false};}
