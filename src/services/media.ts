import {supabase} from '../lib/supabase';
const signedUrls=new Map<string,{url:string;expires:number}>();
export function clearMediaCache(){signedUrls.clear();}
export async function signedMediaUrl(bucket:string,pathOrUrl:string):Promise<string>{
 if(!supabase||!pathOrUrl)return pathOrUrl;
 const marker='/storage/v1/object/public/'+bucket+'/';
 const path=pathOrUrl.includes(marker)?decodeURIComponent(pathOrUrl.split(marker)[1]):pathOrUrl;
 if(path.startsWith('https://')||path.startsWith('http://'))return pathOrUrl;
 const {data:{session}}=await supabase.auth.getSession();
 const key=[session?.user.id,bucket,path].join(':');const cached=signedUrls.get(key);
 if(cached&&cached.expires>Date.now())return cached.url;
 const{data,error}=await supabase.storage.from(bucket).createSignedUrl(path,3600);
 if(error)throw new Error('Could not load this private file. Please refresh and try again.');
 if(signedUrls.size>=300)signedUrls.delete(signedUrls.keys().next().value!);
 signedUrls.set(key,{url:data.signedUrl,expires:Date.now()+3300000});return data.signedUrl;
}
export async function resolveListingMedia<T extends {image_urls?:string[];image_url?:string}>(item:T):Promise<T>{
 if(!item.image_urls?.length)return item;
 const image_urls=await Promise.all(item.image_urls.map(url=>signedMediaUrl('item-images',url)));
 return {...item,image_urls,image_url:image_urls[0]};
}
export async function resolveRequestMedia<T extends {student_id_card_url?:string|null;lending_items?:{image_urls?:string[]}|null}>(request:T):Promise<T>{
 const value=request.student_id_card_url;
 return {...request,lending_items:request.lending_items?await resolveListingMedia(request.lending_items):request.lending_items,
 student_id_card_url:value?await signedMediaUrl(value.includes('/item-images/')?'item-images':'student-id-cards',value):value};
}
