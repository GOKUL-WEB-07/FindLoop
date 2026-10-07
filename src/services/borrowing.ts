import {supabase} from '../lib/supabase';
export {getIncomingRequests} from './workspace';
export type BorrowInput={itemId:string;startDate:string;returnDate:string;message:string;studentName:string;studentEmail:string;idCard?:File};
async function uploadIdCard(file:File,userId:string){
 if(!file.size||file.size>5*1024*1024)throw new Error('ID card image must be between 1 byte and 5 MB.');
 const extensions:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 if(!extensions[file.type])throw new Error('Choose a JPG, PNG or WebP student ID card.');
 const path=userId+'/'+crypto.randomUUID()+'.'+extensions[file.type];
 const{error}=await supabase!.storage.from('student-id-cards').upload(path,file,{contentType:file.type});
 if(error)throw new Error('ID card upload failed. Please try again.');
 return path;
}
export async function requestBorrow(input:BorrowInput){
 if(!supabase)throw new Error('Supabase is not configured.');
 const{data:{user},error:authError}=await supabase.auth.getUser();if(authError)throw authError;if(!user)throw new Error('Please sign in again.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(input.returnDate)||input.returnDate<=input.startDate)throw new Error('Choose valid dates with a return date after the start date.');
 if(!input.studentName.trim()||!input.studentEmail.trim())throw new Error('Enter your student name and email.');
 if(input.message.trim().length>1000)throw new Error('Your note must be 1,000 characters or fewer.');
 const{data:item,error:itemError}=await supabase.from('lending_items').select('owner_id,status,available_from,max_borrow_days').eq('id',input.itemId).single();if(itemError)throw itemError;
 if(item.owner_id===user.id)throw new Error('You cannot borrow your own item.');if(item.status!=='available')throw new Error('This item is not available.');
 const duration=(Date.parse(input.returnDate)-Date.parse(input.startDate))/86400000;
 const today=new Date();const localToday=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
 if(input.startDate<localToday||input.startDate<item.available_from)throw new Error('Choose a start date on or after the item is available.');
 if(!Number.isFinite(duration)||duration>item.max_borrow_days)throw new Error('This item can be borrowed for up to '+item.max_borrow_days+' days.');
 const idCardPath=input.idCard?await uploadIdCard(input.idCard,user.id):null;
 const{error}=await supabase.from('borrow_requests').insert({item_id:input.itemId,borrower_id:user.id,start_date:input.startDate,return_date:input.returnDate,message:input.message.trim(),student_name:input.studentName.trim(),student_email:input.studentEmail.trim().toLowerCase(),student_id_card_url:idCardPath});
 if(error){if(idCardPath)await supabase.storage.from('student-id-cards').remove([idCardPath]);if(error.code==='23505')throw new Error('You already have a pending request for this item.');throw error;}
}
export async function approveRequest(requestId:string){if(!supabase)throw new Error('Supabase is not configured.');const{error}=await supabase.rpc('approve_borrow_request',{p_request_id:requestId});if(error)throw error;}
export async function rejectRequest(requestId:string){if(!supabase)throw new Error('Supabase is not configured.');const{error}=await supabase.rpc('reject_borrow_request',{p_request_id:requestId});if(error)throw error;}
