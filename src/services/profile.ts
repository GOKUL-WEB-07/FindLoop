import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
export type ProfileInput={full_name:string;department?:string;academic_year?:string;bio?:string;avatar?:File};
export async function getProfile():Promise<Profile|null>{if(!supabase)return null;const {data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data,error}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();if(error)throw error;return data;}
export async function updateProfile(input:ProfileInput){
  if(!supabase)throw new Error('Supabase is not configured.');
  const{data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Please sign in again.');
  const{data:current}=await supabase.from('profiles').select('avatar_url').eq('id',user.id).maybeSingle();
  let avatarUrl=current?.avatar_url as string|undefined;
  let uploadedPath:string|undefined;
  if(input.avatar){
    const extensions:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
    const extension=extensions[input.avatar.type];
    if(!extension)throw new Error('Choose a JPG, PNG or WebP profile photo.');
    if(!input.avatar.size||input.avatar.size>3*1024*1024)throw new Error('Profile photos must be 3 MB or smaller.');
    uploadedPath=`${user.id}/${crypto.randomUUID()}.${extension}`;
    const{error:uploadError}=await supabase.storage.from('avatars').upload(uploadedPath,input.avatar,{contentType:input.avatar.type});
    if(uploadError)throw new Error('Profile photo upload failed. Apply the latest Supabase migration first.');
    avatarUrl=supabase.storage.from('avatars').getPublicUrl(uploadedPath).data.publicUrl;
  }
  const{avatar,...fields}=input;
  const{error}=await supabase.from('profiles').update({...fields,avatar_url:avatarUrl||null,updated_at:new Date().toISOString()}).eq('id',user.id);
  if(error){if(uploadedPath)await supabase.storage.from('avatars').remove([uploadedPath]);throw error;}
  const authResult=await supabase.auth.updateUser({data:{full_name:input.full_name,avatar_url:avatarUrl||null}});
  if(authResult.error)throw authResult.error;
  if(uploadedPath&&current?.avatar_url){const marker='/storage/v1/object/public/avatars/';const oldPath=current.avatar_url.includes(marker)?decodeURIComponent(current.avatar_url.split(marker)[1]):'';if(oldPath)await supabase.storage.from('avatars').remove([oldPath]);}
}
