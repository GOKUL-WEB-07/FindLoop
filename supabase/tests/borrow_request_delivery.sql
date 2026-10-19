begin;
create temp table borrow_flow_results(check_name text,passed boolean) on commit drop;
do $test$
declare
  original_role text:=current_user;
  lender uuid:=gen_random_uuid(); borrower uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  item uuid; request uuid; future_item uuid; future_request uuid;
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    raise exception 'Notifications are missing from Realtime publication';
  end if;
  insert into auth.users(id,email,raw_user_meta_data) values
    (lender,lender::text||'@backend-audit.invalid','{"full_name":"Flow lender"}'),
    (borrower,borrower::text||'@backend-audit.invalid','{"full_name":"Flow borrower"}'),
    (outsider,outsider::text||'@backend-audit.invalid','{"full_name":"Flow outsider"}');
  perform set_config('request.jwt.claim.sub',lender::text,true);
  perform set_config('role','authenticated',true);
  insert into public.lending_items(owner_id,title,category,description,pickup_location,max_borrow_days,available_from)
    values(lender,'Flow test item','Books','Rollback-only workflow test','Library',7,current_date) returning id into item;
  insert into public.lending_items(owner_id,title,category,description,pickup_location,max_borrow_days,available_from)
    values(lender,'Future flow item','Books','Rollback-only future loan test','Library',7,current_date) returning id into future_item;
  perform set_config('request.jwt.claim.sub',borrower::text,true);
  insert into public.borrow_requests(item_id,borrower_id,start_date,return_date,student_name,student_email,message)
    values(item,borrower,current_date,current_date+2,'Flow borrower','flow@invalid','Please lend this item') returning id into request;
  insert into public.borrow_requests(item_id,borrower_id,start_date,return_date,student_name,student_email,message)
    values(future_item,borrower,current_date+1,current_date+3,'Flow borrower','flow@invalid','Future borrowing') returning id into future_request;
  if exists(select 1 from public.notifications where entity_id=request and type='borrow_request') then raise exception 'Borrower can read lender private notification';end if;
  perform set_config('request.jwt.claim.sub',lender::text,true);
  if not exists(select 1 from public.notifications where recipient_id=lender and entity_id=request and type='borrow_request') then raise exception 'Request notification not delivered to lender';end if;
  -- Same ownership and inner-join predicate used by getIncomingRequests.
  if (select count(*) from public.borrow_requests r join public.lending_items i on i.id=r.item_id where i.owner_id=auth.uid() and r.status='pending' and r.id in(request,future_request))<>2 then raise exception 'Requests missing from lender incoming query';end if;
  perform public.approve_borrow_request(request);
  perform public.approve_borrow_request(future_request);
  if exists(select 1 from public.borrow_requests where id in(request,future_request) and status='pending') then raise exception 'Approved requests still pending';end if;
  perform set_config('request.jwt.claim.sub',borrower::text,true);
  -- Same statuses, borrower filter, and item relationship as getMyBorrowing.
  if (select count(*) from public.borrow_transactions t join public.lending_items i on i.id=t.item_id where t.borrower_id=auth.uid() and t.status in('scheduled','active','return_requested') and t.request_id in(request,future_request))<>2 then raise exception 'Approved items missing from borrower Borrowed query';end if;
  if not exists(select 1 from public.borrow_transactions where request_id=request and status='active' and due_date=current_date+2) then raise exception 'Current approval missing active loan';end if;
  if not exists(select 1 from public.borrow_transactions where request_id=future_request and status='scheduled' and due_date=current_date+3) then raise exception 'Future approval missing scheduled loan';end if;
  if (select count(*) from public.notifications where recipient_id=borrower and type='borrow_approved' and entity_id in(item,future_item))<>2 then raise exception 'Borrower approval notifications missing';end if;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  if exists(select 1 from public.borrow_transactions where request_id in(request,future_request)) or exists(select 1 from public.borrow_requests where id in(request,future_request)) then raise exception 'Outsider can read private workflow';end if;
  perform set_config('role',original_role,true);
  insert into borrow_flow_results values
    ('notification publication enabled',true),('lender receives request notification',true),
    ('lender incoming query sees request and note',true),('approval removes pending requests',true),
    ('current approval appears in Borrowed with item and due date',true),
    ('future approval appears in Borrowed as scheduled',true),
    ('borrower receives approval notification',true),('cross-user privacy enforced',true);
end;
$test$;
select * from borrow_flow_results;
rollback;
