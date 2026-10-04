export type ItemKind = 'lost' | 'found' | 'lend';
export type ItemStatus = 'active' | 'available' | 'requested' | 'borrowed' | 'claimed' | 'recovered' | 'closed' | 'return_pending' | 'unavailable' | 'archived';
export interface Profile { id:string; full_name:string; department?:string; academic_year?:string; bio?:string; avatar_url?:string; created_at:string }
export interface Item { id:string; kind:ItemKind; title:string; category:string; description:string; location:string; date:string; status:ItemStatus; image_url?:string; owner_id:string; owner?:Profile; condition?:string; max_duration?:number; library_id?:string; library_name?:string; created_at:string; borrow_transactions?:Array<{id:string;status:string;due_date:string;borrower_id:string;borrower?:Profile}> }
export interface BorrowRequest { id:string; item_id:string; borrower_id:string; start_date:string; return_date:string; message:string; status:'pending'|'approved'|'rejected'|'cancelled'|'completed'; item?:Item; created_at:string }
export interface Notice { id:string; title:string; message:string; read:boolean; created_at:string; type:string }
export interface Message { id:string; listing_id:string; sender_id:string; recipient_id:string; body:string; read_at?:string|null; created_at:string; attachment_path?:string|null; attachment_type?:'photo'|'voice'|null; attachment_url?:string }
export interface Conversation { listingId:string; peerId:string; peerName:string; listingTitle:string; listingImage?:string; lastMessage:string; lastMessageAt:string; unread:number }
