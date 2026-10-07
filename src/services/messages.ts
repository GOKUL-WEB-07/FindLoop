import {resolveListingMedia} from './media';
import {supabase} from '../lib/supabase';
import type {Conversation,Message} from '../types';
const mediaUrls=new Map<string,{url:string;expires:number}>();

async function currentUserId(){if(!supabase)throw new Error('Supabase is not configured.');const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Please sign in again.');return user.id;}

export async function getMessages(listingId:string,peerId?:string):Promise<Message[]>{
  if(!supabase)return [];
  const me=await currentUserId();
  let query=supabase.from('messages').select('*').eq('listing_id',listingId).order('created_at');
  if(peerId)query=query.or(`and(sender_id.eq.${me},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${me})`);
  const{data,error}=await query;if(error)throw error;
  return Promise.all((data??[]).map(async(message:Message)=>{
    if(!message.attachment_path)return message;
    const key=`${me}:${message.attachment_path}`;const cached=mediaUrls.get(key);
    if(cached&&cached.expires>Date.now())return {...message,attachment_url:cached.url};
    const{data:signed}=await supabase!.storage.from('message-attachments').createSignedUrl(message.attachment_path,3600);
    if(signed){if(mediaUrls.size>=200)mediaUrls.delete(mediaUrls.keys().next().value!);mediaUrls.set(key,{url:signed.signedUrl,expires:Date.now()+3300000});}
    return {...message,attachment_url:signed?.signedUrl};
  }));
}

export type MessageAttachment={file:File;type:'photo'|'voice'};
export async function sendMessage(listingId:string,recipientId:string,body:string,attachment?:MessageAttachment){
  if(!supabase)throw new Error('Supabase is not configured.');const senderId=await currentUserId();const clean=body.trim();
  if(!clean&&!attachment)throw new Error('Write a message or add an attachment.');if(clean.length>1500)throw new Error('Messages must be 1,500 characters or fewer.');if(senderId===recipientId)throw new Error('Choose a conversation before replying.');
  let path:string|undefined;
  if(attachment){
    const mime=attachment.file.type.split(';')[0];
    const allowed=attachment.type==='photo'?['image/jpeg','image/png','image/webp']:['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav','audio/x-m4a','audio/aac'];
    if(!allowed.includes(mime))throw new Error('This attachment format is not supported.');
    if(!attachment.file.size||attachment.file.size>10*1024*1024)throw new Error('Attachments must be between 1 byte and 10 MB.');
    path=`${senderId}/${recipientId}/${listingId}/${crypto.randomUUID()}`;
    const{error}=await supabase.storage.from('message-attachments').upload(path,attachment.file,{contentType:mime});
    if(error){if(/bucket.*not found|nosuchbucket/i.test(error.message))throw new Error('Message media is not configured. Apply 007_fix_media_and_archiving.sql in Supabase.');if(/row-level|policy|unauthorized/i.test(error.message))throw new Error('You do not have permission to upload this attachment. Apply the latest storage policies.');throw new Error('Attachment upload failed. Please try again.');}
  }
  const{error}=await supabase.from('messages').insert({listing_id:listingId,sender_id:senderId,recipient_id:recipientId,body:clean||(attachment?.type==='photo'?'Photo':'Voice note'),...(path?{attachment_path:path,attachment_type:attachment!.type}:{})});
  if(error){if(path)await supabase.storage.from('message-attachments').remove([path]);if(/attachment_path|attachment_type|schema cache/i.test(error.message))throw new Error('Message media is not configured. Apply 007_fix_media_and_archiving.sql in Supabase.');throw new Error(error.message||'Message could not be sent. Please try again.');}
}

export async function getConversations():Promise<Conversation[]>{
  if(!supabase)return [];const me=await currentUserId();const{data:messages,error}=await supabase.from('messages').select('*').order('created_at',{ascending:false}).limit(300);if(error)throw error;
  const grouped=new Map<string,{listingId:string;peerId:string;last:Message;unread:number}>();
  for(const message of messages??[]){const peerId=message.sender_id===me?message.recipient_id:message.sender_id;const key=`${message.listing_id}:${peerId}`;const existing=grouped.get(key);if(!existing)grouped.set(key,{listingId:message.listing_id,peerId,last:message,unread:0});if(message.recipient_id===me&&!message.read_at)grouped.get(key)!.unread++;}
  const groups=[...grouped.values()];if(!groups.length)return [];
  const profileIds=[...new Set(groups.map(g=>g.peerId))];const listingIds=[...new Set(groups.map(g=>g.listingId))];
  const[profiles,listings]=await Promise.all([supabase.from('profiles').select('id,full_name').in('id',profileIds),supabase.from('lost_found_items').select('id,item_name,image_urls').in('id',listingIds)]);
  if(profiles.error)throw profiles.error;if(listings.error)throw listings.error;const listingMedia=await Promise.all((listings.data??[]).map(resolveListingMedia));
  return groups.map(g=>({listingId:g.listingId,peerId:g.peerId,peerName:profiles.data?.find(p=>p.id===g.peerId)?.full_name||'Campus member',listingTitle:listingMedia.find(i=>i.id===g.listingId)?.item_name||'Item conversation',listingImage:listingMedia.find(i=>i.id===g.listingId)?.image_urls?.[0],lastMessage:g.last.body,lastMessageAt:g.last.created_at,unread:g.unread}));
}

export async function markConversationRead(listingId:string,peerId:string){if(!supabase)return;const me=await currentUserId();const{error}=await supabase.from('messages').update({read_at:new Date().toISOString()}).eq('listing_id',listingId).eq('sender_id',peerId).eq('recipient_id',me).is('read_at',null);if(error)throw error;}
