import type {Notice} from '../types';

export function notificationTarget(notice:Pick<Notice,'type'|'entity_id'|'entity_type'>):string|undefined {
  if(notice.type==='borrow_request')return '/app/incoming';
  if(notice.type==='borrow_approved')return '/app/borrowing';
  if(notice.type==='borrow_rejected')return '/app/notifications?tab=my-requests';
  if(notice.type==='return_requested')return notice.entity_id?`/app/lending/${notice.entity_id}`:'/app/lending';
  if(notice.type==='due_reminder'||notice.type==='return_confirmed')return '/app/borrowing';
  if(notice.type==='new_message')return '/app/messages';
}
