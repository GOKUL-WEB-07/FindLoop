import {supabase} from '../lib/supabase'; import type {Notice} from '../types';
export async function getNotifications():Promise<Notice[]>{if(!supabase)return [];const{error:reminderError}=await supabase.rpc('create_due_reminders');if(reminderError)throw reminderError;const{data,error}=await supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(100);if(error)throw error;return data??[];}
export async function markNotificationRead(id:string){if(!supabase)return;const{error}=await supabase.from('notifications').update({read:true}).eq('id',id);if(error)throw error;}
export async function markAllNotificationsRead(){if(!supabase)return;const{error}=await supabase.from('notifications').update({read:true}).eq('read',false);if(error)throw error;}
