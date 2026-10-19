import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

// Exercise the production services against a controlled Supabase boundary.
async function loadService(name, client, imports={}) {
  let source=await readFile(new URL(`../src/${name}.ts`,import.meta.url),'utf8');
  source=source.replace(/import \{\s*supabase\s*\} from ['"]\.\.\/lib\/supabase['"];?/,'const supabase=globalThis.__auditClient;');
  for(const [specifier,url] of Object.entries(imports))source=source.replaceAll(`'${specifier}'`,JSON.stringify(url));
  globalThis.__auditClient=client;
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code+'\n// '+Math.random()).toString('base64')}`);
}

test('missing private images do not hide listings or requests, and no raw ID path leaks',async()=>{
  const calls=[];
  const media=await loadService('services/media',{
    auth:{getSession:async()=>({data:{session:{user:{id:'lender'}}}})},
    storage:{from:bucket=>({createSignedUrl:async path=>{calls.push([bucket,path]);return path.includes('missing')?{error:{message:'Not found'}}:{data:{signedUrl:`https://signed.invalid/${path}`}};}})},
  });
  const item=await media.resolveListingMedia({title:'Book',image_urls:['missing.jpg','book.jpg']});
  assert.equal(item.title,'Book');assert.deepEqual(item.image_urls,['https://signed.invalid/book.jpg']);
  const request=await media.resolveRequestMedia({id:'request',student_id_card_url:'user/missing-id.jpg',lending_items:{image_urls:['missing.jpg']}});
  assert.equal(request.id,'request');assert.equal(request.student_id_card_url,null);assert.deepEqual(request.lending_items.image_urls,[]);
  await media.signedMediaUrl('item-images','book.jpg');
  assert.equal(calls.filter(([,path])=>path==='book.jpg').length,1);
  media.clearMediaCache();await media.signedMediaUrl('item-images','book.jpg');
  assert.equal(calls.filter(([,path])=>path==='book.jpg').length,2);
});

test('calendar days stay local and due-today remains current',async()=>{
  const dates=await loadService('lib/dates',null);
  const day=dates.calendarDate('2026-10-18');
  assert.equal(day.getHours(),0);assert.equal(dates.localDate(day),'2026-10-18');
  assert.equal('2026-10-18'<dates.localDate(day),false);
  assert.equal('2026-10-17'<dates.localDate(day),true);
});

test('profile update cleans failed uploads and accepts a saved profile when metadata sync fails',async()=>{
  let saved=null;let removed=[];let failMetadata=false;
  const client={auth:{getUser:async()=>({data:{user:{id:'owner'}}}),updateUser:async()=>({error:failMetadata?new Error('Network failed'):null})},
    storage:{from:()=>({upload:async()=>({error:null}),getPublicUrl:()=>({data:{publicUrl:'https://avatar.invalid/new.jpg'}}),remove:async paths=>{removed.push(...paths);return {error:null};}})},
    from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{avatar_url:null},error:null})})}),update:()=>({eq:()=>({select:()=>({maybeSingle:async()=>({data:saved,error:null})})})})})};
  const profile=await loadService('services/profile',client);
  const input={full_name:'Updated',avatar:new File(['photo'],'photo.jpg',{type:'image/jpeg'})};
  await assert.rejects(profile.updateProfile(input),/could not be saved/);assert.equal(removed.length,1);
  saved={id:'owner'};failMetadata=true;await profile.updateProfile({full_name:'Updated'});
});

test('lost/found recovery accepts potential matches and still rejects zero-row edits',async()=>{
  const filters=[];let saved={id:'item'};
  const query={eq:(...v)=>{filters.push(v);return query;},in:(...v)=>{filters.push(v);return query;},select:()=>query,maybeSingle:async()=>({data:saved,error:null})};
  const passthrough='data:text/javascript,export const resolveListingMedia=async x=>x;';
  const items=await loadService('services/items',{from:()=>({update:()=>query})},{'./media':passthrough});
  await items.markFoundItemRecovered({id:'item',kind:'found'});
  assert.ok(filters.some(([field,values])=>field==='status'&&values.includes('potential_match')));
  saved=null;await assert.rejects(items.markFoundItemRecovered({id:'item',kind:'found'}),/no longer active/);
});

test('borrow alerts open lender review and approval alerts open Borrowed',async()=>{
  const {notificationTarget}=await loadService('lib/notificationTarget',null);
  assert.equal(notificationTarget({type:'borrow_request'}),'/app/incoming');
  assert.equal(notificationTarget({type:'borrow_approved'}),'/app/borrowing');
  assert.equal(notificationTarget({type:'borrow_rejected'}),'/app/notifications?tab=my-requests');
});

test('approved loan service includes current, scheduled, and awaiting-return loans for the borrower',async()=>{
  const calls=[];
  const row={id:'loan',borrower_id:'borrower',status:'scheduled',lending_items:{title:'Approved book',image_urls:[]}};
  const query={select:()=>query,eq:(...v)=>{calls.push(['eq',...v]);return query;},in:(...v)=>{calls.push(['in',...v]);return query;},order:async()=>({data:[row],error:null})};
  const passthrough='data:text/javascript,export const resolveListingMedia=async x=>x;export const resolveRequestMedia=async x=>x;';
  const workspace=await loadService('services/workspace',{auth:{getUser:async()=>({data:{user:{id:'borrower'}}})},from:table=>{calls.push(['from',table]);return query;}},{'./media':passthrough});
  const loans=await workspace.getMyBorrowing();
  assert.equal(loans[0].lending_items.title,'Approved book');
  assert.deepEqual(calls.find(([op])=>op==='eq'),['eq','borrower_id','borrower']);
  assert.deepEqual(calls.find(([op])=>op==='in'),['in','status',['scheduled','active','return_requested']]);
});

test('borrow submission confirms the saved request and approval calls the transactional workflow',async()=>{
  let inserted;let approved;
  const now=new Date();const start=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  const endDate=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  const end=[endDate.getFullYear(),String(endDate.getMonth()+1).padStart(2,'0'),String(endDate.getDate()).padStart(2,'0')].join('-');
  const client={auth:{getUser:async()=>({data:{user:{id:'borrower'}}})},
    from:table=>table==='lending_items'?{select:()=>({eq:()=>({single:async()=>({data:{owner_id:'lender',status:'available',available_from:start,max_borrow_days:7},error:null})})})}:{insert:values=>{inserted=values;return {select:()=>({single:async()=>({data:{id:'request',item_id:values.item_id,status:'pending'},error:null})})};}},
    rpc:async(name,args)=>{approved=[name,args];return {error:null};}};
  const borrowing=await loadService('services/borrowing',client,{'./workspace':'data:text/javascript,export const getIncomingRequests=async()=>[];'});
  const result=await borrowing.requestBorrow({itemId:'item',startDate:start,returnDate:end,studentName:' Student ',studentEmail:' Student@Campus.invalid ',message:' Please lend '});
  assert.equal(result.id,'request');assert.equal(result.status,'pending');
  assert.equal(inserted.borrower_id,'borrower');assert.equal(inserted.student_name,'Student');assert.equal(inserted.message,'Please lend');
  await borrowing.approveRequest(result.id);
  assert.deepEqual(approved,['approve_borrow_request',{p_request_id:'request'}]);
});
