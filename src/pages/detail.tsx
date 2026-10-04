import {Calendar,Clock3,ImagePlus,MapPin,MessageCircle,Package,UserRound} from 'lucide-react';
import {useEffect,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {ConfirmDialog,useToast} from '../components/feedback/ToastProvider';
import {Empty,LoadingCards} from '../components/ui';
import {useAuth} from '../features/auth/AuthContext';
import {useBorrowRequest} from '../hooks/useInteractions';
import {useDeleteItem,useItem,useMarkRecovered} from '../hooks/useItems';
import {useReturnActions} from '../hooks/useWorkspace';

function StudentIdPicker({file,onChange}:{file?:File;onChange:(file?:File)=>void}){
  const[preview,setPreview]=useState('');
  useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
  return <label className="photo-picker student-id-picker"><span>{preview?<img src={preview} alt="Student ID preview"/>:<span className="photo-placeholder"><ImagePlus size={24}/> Student ID card</span>}</span><input required type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>onChange(event.target.files?.[0])}/><small>Drop the image here or tap to browse · visible only to the owner</small></label>;
}

export function Detail({kind}:{kind:'lost'|'lend'}){
  const{id=''}=useParams();const nav=useNavigate();const{user}=useAuth();const{notify}=useToast();
  const{data:item,isLoading,error:itemError}=useItem(id,kind);const[requestOpen,setRequestOpen]=useState(false);const[confirmOpen,setConfirmOpen]=useState(false);const[deleteOpen,setDeleteOpen]=useState(false);const[loanAction,setLoanAction]=useState<'available'|'archive'>();
  const[borrow,setBorrow]=useState({startDate:'',returnDate:'',name:user?.user_metadata.full_name||'',email:user?.email||'',message:'',idCard:undefined as File|undefined});
  const request=useBorrowRequest();const recovered=useMarkRecovered();const remove=useDeleteItem();const returns=useReturnActions();
  if(isLoading)return <LoadingCards/>;
  if(itemError)return <Empty title="Cannot open this listing" copy={itemError.message} action={{to:kind==='lend'?'/app/notifications?tab=my-requests':'/app/lost-found',label:'Go back'}}/>;
  if(!item)return <Empty title="Listing not found" copy="It may have been recovered, removed, or the link is incorrect." action={{to:kind==='lend'?'/app/borrow':'/app/lost-found',label:'Back to listings'}}/>;
  const mine=user?.id===item.owner_id;const closed=['recovered','returned','closed'].includes(item.status);const activeLoan=item.borrow_transactions?.find(transaction=>!['returned','cancelled'].includes(transaction.status));const returnRequested=activeLoan?.status==='return_requested';const ownerName=item.owner?.full_name||'Campus member';

  function submitRequest(event:React.FormEvent){event.preventDefault();request.mutate({itemId:item!.id,startDate:borrow.startDate,returnDate:borrow.returnDate,studentName:borrow.name,studentEmail:borrow.email,message:borrow.message,idCard:borrow.idCard},{onSuccess:()=>nav('/app/notifications?tab=my-requests')})}
  function completeListing(){if(item?.kind!=='lost'&&item?.kind!=='found')return;recovered.mutate({id:item.id,kind:item.kind},{onSuccess:()=>{setConfirmOpen(false);notify({title:item.kind==='found'?'Item returned':'Item recovered',message:'The listing was removed from active Lost & Found results.'});nav('/app/lost-found')}})}
  function deleteListing(){remove.mutate({id:item!.id,kind:item!.kind},{onSuccess:result=>{setDeleteOpen(false);notify({title:result.archived?'Listing removed':'Listing deleted',message:result.archived?'It is hidden from listings while its loan history is retained.':'The item and its active listing were removed.'});nav(kind==='lend'?'/app/lending':'/app/lost-found')}})}
  function completeLoan(){if(!activeLoan||!loanAction)return;returns.ownerComplete.mutate({transactionId:activeLoan.id,archive:loanAction==='archive'},{onSuccess:()=>{notify({title:loanAction==='archive'?'Loan completed and listing removed':'Item available again',message:'The borrower has been notified.'});setLoanAction(undefined);if(loanAction==='archive')nav('/app/lending')}})}

  return <div className="detail">
    <Link className="back" to={kind==='lend'&&mine?'/app/lending':kind==='lend'?'/app/borrow':'/app/lost-found'}>← Back to listings</Link>
    <div className="detail-grid">
      <div className="detail-art">{item.image_url?<img src={item.image_url} alt={item.title}/>:item.category.slice(0,1)}<span>{item.status.replace('_',' ')}</span></div>
      <article><span className="tag">{item.category}</span><h2>{item.title}</h2><p className="detail-status">{item.status.replace('_',' ')}</p><p>{item.description}</p>
        {((kind==='lost')||(kind==='lend'&&!mine))&&<section className="detail-owner"><span className="owner-avatar large">{item.owner?.avatar_url?<img src={item.owner.avatar_url} alt=""/>:ownerName[0]?.toUpperCase()}</span><div><small>{kind==='lend'?'Lending owner':item.kind==='found'?'Finder':'Listing owner'}</small><strong>{ownerName}</strong><p>{[item.owner?.department,item.owner?.academic_year].filter(Boolean).join(' · ')||'Campus member'}</p></div></section>}
        {kind==='lend'&&mine&&activeLoan&&<section className="borrower-card"><span className="owner-avatar large">{activeLoan.borrower?.avatar_url?<img src={activeLoan.borrower.avatar_url} alt=""/>:<UserRound/>}</span><div><small>{returnRequested?'Return requested by':'Currently borrowed by'}</small><strong>{activeLoan.borrower?.full_name||'Campus member'}</strong><p>{returnRequested?'Confirm only after you receive the item.':[activeLoan.borrower?.department,activeLoan.borrower?.academic_year].filter(Boolean).join(' · ')||'Campus member'}</p><p><Clock3 size={14}/> Due {new Date(activeLoan.due_date).toLocaleDateString()}</p></div></section>}
        <dl><div><dt><MapPin size={16}/> Location</dt><dd>{item.location}</dd></div><div><dt><Calendar size={16}/> {kind==='lend'?'Available from':'Date'}</dt><dd>{new Date(item.date).toLocaleDateString()}</dd></div>{item.max_duration&&<div><dt><Package size={16}/> Duration</dt><dd>Up to {item.max_duration} days</dd></div>}</dl>
        {mine?<div className="owner-actions"><Link className="button secondary" to={kind==='lend'?`/app/lending/${item.id}/edit`:`/app/lost-found/${item.id}/edit`}>Edit listing</Link>{kind==='lost'&&!closed&&<button className="button" disabled={recovered.isPending} onClick={()=>setConfirmOpen(true)}>{item.kind==='found'?'Mark as returned':'Mark as recovered'}</button>}{kind==='lost'&&<button className="text-button danger" onClick={()=>setDeleteOpen(true)}>Delete listing</button>}{kind==='lend'&&(returnRequested?<><button className="button" onClick={()=>setLoanAction('available')}>Confirm return · Make available</button><button className="button secondary danger" onClick={()=>setLoanAction('archive')}>Confirm return · Remove</button></>:activeLoan?<p className="muted">Waiting for the borrower to request a return.</p>:<button className="text-button danger" onClick={()=>setDeleteOpen(true)}>Remove listing</button>)}</div>:kind==='lost'?<Link className="button" to={`/app/messages/${item.id}/${item.owner_id}`}><MessageCircle size={17}/> Message {item.kind==='found'?'finder':'owner'}</Link>:item.status==='available'?<button className="button" onClick={()=>setRequestOpen(value=>!value)}>{requestOpen?'Close request form':'Request to borrow'}</button>:<p className="muted">This item is currently unavailable.</p>}
        {(recovered.error||remove.error||returns.ownerComplete.error)&&<p className="form-error">{(recovered.error||remove.error||returns.ownerComplete.error)?.message}</p>}
      </article>
    </div>
    {requestOpen&&<form className="form-card interaction-form" onSubmit={submitRequest}>
      <h2>Borrow request</h2><p>Share your details so the owner can verify your request.</p>
      <div className="two"><label className="field"><span>Start date</span><input required type="date" value={borrow.startDate} onChange={event=>setBorrow({...borrow,startDate:event.target.value})}/></label><label className="field"><span>Return date</span><input required type="date" value={borrow.returnDate} onChange={event=>setBorrow({...borrow,returnDate:event.target.value})}/></label></div>
      <div className="two"><label className="field"><span>Your name</span><input required value={borrow.name} onChange={event=>setBorrow({...borrow,name:event.target.value})}/></label><label className="field"><span>College email</span><input required type="email" value={borrow.email} onChange={event=>setBorrow({...borrow,email:event.target.value})}/></label></div>
      <label className="field"><span>Reason or note</span><textarea required rows={3} value={borrow.message} onChange={event=>setBorrow({...borrow,message:event.target.value})}/></label>
      <StudentIdPicker file={borrow.idCard} onChange={idCard=>setBorrow({...borrow,idCard})}/>
      {request.error&&<p className="form-error">{request.error.message}</p>}<button className="button submit" disabled={request.isPending}>{request.isPending?'Sending…':'Send request'}</button>
    </form>}
    <ConfirmDialog open={confirmOpen} title={item.kind==='found'?'Confirm item return':'Confirm item recovery'} message="This removes the listing from active Lost & Found results for every user." confirmLabel={item.kind==='found'?'Mark returned':'Mark recovered'} busy={recovered.isPending} onCancel={()=>setConfirmOpen(false)} onConfirm={completeListing}/>
    <ConfirmDialog open={deleteOpen} title={kind==='lend'?'Remove this listing?':'Delete this listing?'} message={kind==='lend'?'This removes it from active lending while preserving required borrowing history.':'This permanently removes the listing. This action cannot be undone.'} confirmLabel={kind==='lend'?'Remove listing':'Delete listing'} busy={remove.isPending} onCancel={()=>setDeleteOpen(false)} onConfirm={deleteListing}/>
    <ConfirmDialog open={!!loanAction} title={loanAction==='archive'?'Confirm return and remove listing?':'Confirm return and make available?'} message={loanAction==='archive'?'Only confirm after you physically receive the item. The loan will close and the listing will be removed.':'Only confirm after you physically receive the item. The loan will close and other users can request it again.'} confirmLabel={loanAction==='archive'?'Confirm and remove':'Confirm and make available'} busy={returns.ownerComplete.isPending} onCancel={()=>setLoanAction(undefined)} onConfirm={completeLoan}/>
  </div>;
}
