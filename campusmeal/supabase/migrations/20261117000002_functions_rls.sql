-- Helper functions, business rules, audit triggers and Row Level Security.

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so policies can read memberships safely)
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where user_id = auth.uid() and role = 'super_admin');
$$;

create or replace function public.has_role(inst uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and institution_id = inst and role = any(roles)
  );
$$;

-- Staff = anyone who works in the institution (not students).
create or replace function public.is_staff(inst uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(inst, array['institution_admin','chef','teacher']);
$$;

create or replace function public.is_member(inst uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(inst, array['institution_admin','chef','teacher','student']);
$$;

create or replace function public.my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from students where profile_id = auth.uid() limit 1;
$$;

-- Local "now" for an institution.
create or replace function public.inst_now(inst uuid) returns timestamp
language sql stable security definer set search_path = public as $$
  select (now() at time zone (select timezone from institutions where id = inst));
$$;

-- Cancellation deadline (institution-local timestamp) for a meal.
create or replace function public.meal_cancel_deadline(p_meal uuid) returns timestamp
language sql stable security definer set search_path = public as $$
  select (m.meal_date - s.cancel_days_before) + s.cancel_time
  from meals m join meal_schedules s on s.id = m.schedule_id
  where m.id = p_meal;
$$;

-- ---------------------------------------------------------------------------
-- Daily defaults: materialise meals for a date from the standing timetable.
-- Idempotent; existing rows (incl. cancelled/sponsored) are never overwritten.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_meals(inst uuid, p_date date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_member(inst) or public.is_super_admin()) then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  insert into meals (institution_id, schedule_id, meal_date)
  select s.institution_id, s.id, p_date
  from meal_schedules s
  where s.institution_id = inst and s.active and extract(dow from p_date)::int = any(s.weekdays)
  on conflict (schedule_id, meal_date) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Student-facing view of their own table (tablemates + supplier) without
-- granting students read access to the whole students table.
-- ---------------------------------------------------------------------------
create or replace function public.my_table(p_date date default current_date)
returns table (table_code text, hall_name text, capacity int, mate_name text, mate_roll int, mate_class text, is_me boolean, is_supplier boolean)
language sql stable security definer set search_path = public as $$
  with me as (select s.id, s.institution_id from students s where s.profile_id = auth.uid()),
  t as (
    select ta.table_id from table_assignments ta join me on me.id = ta.student_id where ta.end_date is null
  ),
  sup as (
    select sr.student_id from supplier_rotations sr join t on t.table_id = sr.table_id
    where p_date between sr.period_start and sr.period_end
  )
  select dt.code, h.name, coalesce(dt.capacity, i.default_table_capacity),
         st.full_name, st.roll_no, c.name, st.id = (select id from me),
         st.id in (select student_id from sup)
  from t
  join dining_tables dt on dt.id = t.table_id
  join dining_halls h on h.id = dt.hall_id
  join institutions i on i.id = dt.institution_id
  join table_assignments ta on ta.table_id = dt.id and ta.end_date is null
  join students st on st.id = ta.student_id
  left join classes c on c.id = st.class_id
  order by c.name, st.roll_no;
$$;

-- ---------------------------------------------------------------------------
-- Aggregate meal totals for analytics (SECURITY INVOKER: RLS applies).
-- Same rule as the app's calculator:
--   eligible = active students with an active seat in an applicable active hall
--   excluded = DISTINCT(student cancellations ∪ teacher-reported absences)
--   separate students = on an approved separate-food request and not excluded
--   separate_portions = sum of approved request portions (reported separately)
--   regular  = eligible - excluded - separate students
-- ---------------------------------------------------------------------------
create or replace function public.meal_totals(p_from date, p_to date, p_inst uuid default null)
returns table (institution_id uuid, meal_id uuid, meal_date date, meal_name text, meal_status text,
               eligible int, cancelled int, absent int, excluded int, separate_portions int, regular int)
language sql stable security invoker set search_path = public as $$
  with m as (
    select m.id, m.institution_id, m.meal_date, m.status, s.name, s.hall_ids
    from meals m join meal_schedules s on s.id = m.schedule_id
    where m.meal_date between p_from and p_to and (p_inst is null or m.institution_id = p_inst)
  ),
  elig as (
    select m.id meal_id, st.id student_id
    from m
    join students st on st.institution_id = m.institution_id and st.active
    join table_assignments ta on ta.student_id = st.id and ta.end_date is null
    join dining_tables dt on dt.id = ta.table_id and dt.active
    join dining_halls h on h.id = dt.hall_id and h.active
    where m.hall_ids is null or h.id = any(m.hall_ids)
  ),
  canc as (select e.meal_id, e.student_id from elig e join meal_cancellations c using (meal_id, student_id)),
  abs as (select e.meal_id, e.student_id from elig e join meal_attendance a using (meal_id, student_id)),
  excl as (select * from canc union select * from abs),
  sep as (
    select distinct e.meal_id, e.student_id
    from elig e
    join separate_food_request_students rs on rs.student_id = e.student_id
    join separate_food_requests r on r.id = rs.request_id and r.meal_id = e.meal_id and r.status = 'approved'
    where not exists (select 1 from excl x where x.meal_id = e.meal_id and x.student_id = e.student_id)
  )
  select m.institution_id, m.id, m.meal_date, m.name, m.status,
    (select count(*) from elig e where e.meal_id = m.id)::int,
    (select count(*) from canc x where x.meal_id = m.id)::int,
    (select count(*) from abs x where x.meal_id = m.id)::int,
    (select count(*) from excl x where x.meal_id = m.id)::int,
    case when m.status = 'cancelled' then 0 else coalesce((select sum(r.portions) from separate_food_requests r where r.meal_id = m.id and r.status = 'approved'), 0)::int end,
    case when m.status = 'cancelled' then 0 else
      ((select count(*) from elig e where e.meal_id = m.id)
       - (select count(*) from excl x where x.meal_id = m.id)
       - (select count(*) from sep x where x.meal_id = m.id))::int end
  from m order by m.meal_date, m.name;
$$;

-- ---------------------------------------------------------------------------
-- Business-rule triggers
-- ---------------------------------------------------------------------------
-- Cancellations: students only for themselves, before the deadline, on active meals.
create or replace function public.trg_cancellation_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text; v_inst uuid;
begin
  select status, institution_id into v_status, v_inst from meals where id = new.meal_id;
  if v_inst is distinct from new.institution_id then
    raise exception 'meal belongs to another institution';
  end if;
  if v_status = 'cancelled' then
    raise exception 'This meal has already been cancelled by the institution';
  end if;
  if new.source = 'student' then
    if new.student_id is distinct from public.my_student_id() then
      raise exception 'Students can only cancel their own meals' using errcode = '42501';
    end if;
    if public.inst_now(new.institution_id) >= public.meal_cancel_deadline(new.meal_id) then
      raise exception 'The cancellation deadline for this meal has passed. Ask your teacher for a late exception.';
    end if;
  elsif not public.has_role(new.institution_id, array['institution_admin','teacher']) then
    raise exception 'Only teachers or administrators can record late exceptions' using errcode = '42501';
  end if;
  new.created_by := auth.uid();
  new.cancelled_at := now();
  return new;
end $$;
create trigger cancellation_rules before insert on public.meal_cancellations
  for each row execute function public.trg_cancellation_rules();

-- Undoing a student cancellation is only allowed before the deadline.
create or replace function public.trg_cancellation_undo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.source = 'student' and not public.has_role(old.institution_id, array['institution_admin','teacher'])
     and public.inst_now(old.institution_id) >= public.meal_cancel_deadline(old.meal_id) then
    raise exception 'The deadline has passed; this cancellation can no longer be withdrawn';
  end if;
  return old;
end $$;
create trigger cancellation_undo before delete on public.meal_cancellations
  for each row execute function public.trg_cancellation_undo();

-- Generic consistency: child rows must match the institution of the referenced meal.
create or replace function public.trg_meal_institution_match() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from meals where id = new.meal_id and institution_id = new.institution_id) then
    raise exception 'meal does not belong to this institution';
  end if;
  return new;
end $$;
create trigger meal_inst_match before insert or update on public.meal_attendance for each row execute function public.trg_meal_institution_match();
create trigger meal_inst_match before insert or update on public.separate_food_requests for each row execute function public.trg_meal_institution_match();
create trigger meal_inst_match before insert or update on public.preparation_tasks for each row execute function public.trg_meal_institution_match();
create trigger meal_inst_match before insert or update on public.meal_deliveries for each row execute function public.trg_meal_institution_match();
create trigger meal_inst_match before insert or update on public.distribution_records for each row execute function public.trg_meal_institution_match();
create trigger meal_inst_match before insert or update on public.missing_meal_reports for each row execute function public.trg_meal_institution_match();

-- Teachers may only raise separate-food requests for their own classes.
create or replace function public.trg_sfr_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not public.has_role(new.institution_id, array['institution_admin'])
       and not exists (select 1 from classes where id = new.class_id and teacher_id = auth.uid()) then
      raise exception 'You can only submit requests for your own class' using errcode = '42501';
    end if;
    new.requested_by := auth.uid();
    new.status := 'pending';
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not public.has_role(new.institution_id, array['institution_admin']) then
      raise exception 'Only the institution administrator can review requests' using errcode = '42501';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end $$;
create trigger sfr_rules before insert or update on public.separate_food_requests
  for each row execute function public.trg_sfr_rules();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger touch before update on public.institutions for each row execute function public.touch_updated_at();
create trigger touch before update on public.meals for each row execute function public.touch_updated_at();
create trigger touch before update on public.preparation_tasks for each row execute function public.touch_updated_at();
create trigger touch before update on public.meal_deliveries for each row execute function public.touch_updated_at();
create trigger touch before update on public.kitchen_service_requests for each row execute function public.touch_updated_at();

-- Audit trail for key operational records.
create or replace function public.trg_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into audit_logs (institution_id, actor_id, action, entity, entity_id, details)
  values (
    case when tg_table_name = 'institutions' then (r->>'id')::uuid else (r->>'institution_id')::uuid end,
    auth.uid(), lower(tg_op), tg_table_name, r->>'id',
    case when tg_op = 'UPDATE' then jsonb_build_object('status', r->>'status') else null end
  );
  return null;
end $$;
create trigger audit after insert or update or delete on public.institutions for each row execute function public.trg_audit();
create trigger audit after insert or update or delete on public.meals for each row execute function public.trg_audit();
create trigger audit after insert or delete on public.meal_cancellations for each row execute function public.trg_audit();
create trigger audit after insert or update on public.separate_food_requests for each row execute function public.trg_audit();
create trigger audit after insert or update on public.kitchen_service_requests for each row execute function public.trg_audit();
create trigger audit after insert or update on public.preparation_tasks for each row execute function public.trg_audit();
create trigger audit after insert on public.announcements for each row execute function public.trg_audit();
create trigger audit after insert or update on public.dining_halls for each row execute function public.trg_audit();
create trigger audit after insert or update on public.meal_schedules for each row execute function public.trg_audit();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'institutions','profiles','memberships','classes','students','dining_halls','dining_tables',
    'table_assignments','supplier_rotations','supplier_substitutions','meal_schedules','meal_menus',
    'meals','meal_cancellations','meal_attendance','separate_food_requests','separate_food_request_students',
    'preparation_tasks','ingredient_items','ingredient_transactions','kitchen_service_requests',
    'meal_deliveries','distribution_records','missing_meal_reports','announcements',
    'institutional_messages','documents','audit_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- institutions
create policy inst_read on public.institutions for select using (public.is_member(id) or public.is_super_admin());
create policy inst_admin_update on public.institutions for update using (public.has_role(id, array['institution_admin'])) with check (public.has_role(id, array['institution_admin']));
create policy inst_super_all on public.institutions for all using (public.is_super_admin()) with check (public.is_super_admin());

-- profiles: self, colleagues in same institution, super admin
create or replace function public.staff_can_see_profile(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.user_id = p and m.institution_id is not null and public.is_staff(m.institution_id));
$$;
create policy profiles_read on public.profiles for select using (
  id = auth.uid() or public.is_super_admin() or public.staff_can_see_profile(id)
);
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- memberships
create policy memberships_read on public.memberships for select using (
  user_id = auth.uid() or public.is_super_admin()
  or (institution_id is not null and public.has_role(institution_id, array['institution_admin']))
);

-- Configuration tables: staff read, admin write.
do $$
declare t text;
begin
  foreach t in array array['classes','dining_halls','dining_tables','table_assignments','meal_schedules','ingredient_items']
  loop
    execute format('create policy %1$s_read on public.%1$I for select using (public.is_staff(institution_id) or public.is_super_admin())', t);
    execute format('create policy %1$s_admin_write on public.%1$I for all using (public.has_role(institution_id, array[''institution_admin''])) with check (public.has_role(institution_id, array[''institution_admin'']))', t);
  end loop;
end $$;
-- Students may read halls and schedules (needed for timetable / my table view).
create policy dining_halls_student_read on public.dining_halls for select using (public.has_role(institution_id, array['student']));
create policy meal_schedules_student_read on public.meal_schedules for select using (public.has_role(institution_id, array['student']));

-- students: staff read; admin write; a student reads only their own row.
create policy students_staff_read on public.students for select using (public.is_staff(institution_id) or public.is_super_admin());
create policy students_self_read on public.students for select using (profile_id = auth.uid());
create policy students_admin_write on public.students for all using (public.has_role(institution_id, array['institution_admin'])) with check (public.has_role(institution_id, array['institution_admin']));

-- Supplier rotation: teachers manage (not admins), staff read.
create policy supplier_rotations_read on public.supplier_rotations for select using (public.is_staff(institution_id));
create policy supplier_rotations_teacher_write on public.supplier_rotations for all using (public.has_role(institution_id, array['teacher'])) with check (public.has_role(institution_id, array['teacher']));
create policy supplier_subs_read on public.supplier_substitutions for select using (public.is_staff(institution_id));
create policy supplier_subs_teacher_write on public.supplier_substitutions for all using (public.has_role(institution_id, array['teacher'])) with check (public.has_role(institution_id, array['teacher']));

-- Menus & meals: every member reads; admin writes.
create policy meal_menus_read on public.meal_menus for select using (public.is_member(institution_id) or public.is_super_admin());
create policy meal_menus_admin_write on public.meal_menus for all using (public.has_role(institution_id, array['institution_admin'])) with check (public.has_role(institution_id, array['institution_admin']));
create policy meals_read on public.meals for select using (public.is_member(institution_id) or public.is_super_admin());
create policy meals_admin_write on public.meals for all using (public.has_role(institution_id, array['institution_admin'])) with check (public.has_role(institution_id, array['institution_admin']));

-- Cancellations: student sees/creates/removes own; teacher & admin manage; chef & super read.
create policy cancellations_read on public.meal_cancellations for select using (
  student_id = public.my_student_id() or public.is_staff(institution_id) or public.is_super_admin());
create policy cancellations_student_insert on public.meal_cancellations for insert with check (
  source = 'student' and student_id = public.my_student_id() and public.has_role(institution_id, array['student']));
create policy cancellations_student_delete on public.meal_cancellations for delete using (
  source = 'student' and student_id = public.my_student_id());
create policy cancellations_staff_write on public.meal_cancellations for all using (
  public.has_role(institution_id, array['institution_admin','teacher'])) with check (
  public.has_role(institution_id, array['institution_admin','teacher']));

-- Canteen absences: teachers & admins only write. Chef reads only.
create policy attendance_read on public.meal_attendance for select using (public.is_staff(institution_id) or public.is_super_admin());
create policy attendance_write on public.meal_attendance for all using (
  public.has_role(institution_id, array['institution_admin','teacher'])) with check (
  public.has_role(institution_id, array['institution_admin','teacher']));

-- Separate food: teachers create, admin reviews, chef reads approved.
create policy sfr_read on public.separate_food_requests for select using (
  public.has_role(institution_id, array['institution_admin','teacher']) or public.is_super_admin()
  or (status = 'approved' and public.has_role(institution_id, array['chef'])));
create policy sfr_insert on public.separate_food_requests for insert with check (
  public.has_role(institution_id, array['institution_admin','teacher']));
create policy sfr_admin_update on public.separate_food_requests for update using (
  public.has_role(institution_id, array['institution_admin'])) with check (public.has_role(institution_id, array['institution_admin']));
create policy sfrs_read on public.separate_food_request_students for select using (public.is_staff(institution_id));
create policy sfrs_insert on public.separate_food_request_students for insert with check (
  public.has_role(institution_id, array['institution_admin','teacher']));

-- Preparation: chef writes, staff read.
create policy prep_read on public.preparation_tasks for select using (public.is_staff(institution_id) or public.is_super_admin());
create policy prep_chef_write on public.preparation_tasks for all using (
  public.has_role(institution_id, array['chef'])) with check (public.has_role(institution_id, array['chef']));

-- Ingredients: chef writes; admin reads.
create policy ingredient_items_chef_insert on public.ingredient_items for insert with check (public.has_role(institution_id, array['chef']));
create policy ingredient_tx_read on public.ingredient_transactions for select using (public.has_role(institution_id, array['chef','institution_admin']));
create policy ingredient_tx_chef_insert on public.ingredient_transactions for insert with check (public.has_role(institution_id, array['chef']));

-- Kitchen service requests: chef creates & reads; admin reads & updates status.
create policy ksr_read on public.kitchen_service_requests for select using (public.has_role(institution_id, array['chef','institution_admin']));
create policy ksr_chef_insert on public.kitchen_service_requests for insert with check (public.has_role(institution_id, array['chef']) and status = 'open');
create policy ksr_admin_update on public.kitchen_service_requests for update using (
  public.has_role(institution_id, array['institution_admin'])) with check (public.has_role(institution_id, array['institution_admin']));

-- Deliveries: chef writes; staff read.
create policy deliveries_read on public.meal_deliveries for select using (public.is_staff(institution_id) or public.is_super_admin());
create policy deliveries_chef_write on public.meal_deliveries for all using (
  public.has_role(institution_id, array['chef'])) with check (public.has_role(institution_id, array['chef']));

-- Table distribution: teacher writes; staff read.
create policy distribution_read on public.distribution_records for select using (public.is_staff(institution_id) or public.is_super_admin());
create policy distribution_teacher_write on public.distribution_records for all using (
  public.has_role(institution_id, array['teacher'])) with check (public.has_role(institution_id, array['teacher']));

-- Missing meals: teacher reports; chef acknowledges/resolves; staff read.
create policy missing_read on public.missing_meal_reports for select using (public.is_staff(institution_id) or public.is_super_admin());
create policy missing_teacher_insert on public.missing_meal_reports for insert with check (public.has_role(institution_id, array['teacher']) and status = 'open');
create policy missing_chef_update on public.missing_meal_reports for update using (
  public.has_role(institution_id, array['chef','institution_admin'])) with check (public.has_role(institution_id, array['chef','institution_admin']));

-- Announcements: members read those addressed to their role; admin writes.
create policy announcements_read on public.announcements for select using (
  public.has_role(institution_id, array['institution_admin']) or public.is_super_admin()
  or (public.has_role(institution_id, array['student']) and 'student' = any(audience))
  or (public.has_role(institution_id, array['teacher']) and 'teacher' = any(audience))
  or (public.has_role(institution_id, array['chef']) and 'chef' = any(audience)));
create policy announcements_admin_write on public.announcements for all using (
  public.has_role(institution_id, array['institution_admin'])) with check (public.has_role(institution_id, array['institution_admin']));

-- Institution <-> university messages and documents.
create policy messages_read on public.institutional_messages for select using (
  public.has_role(institution_id, array['institution_admin']) or public.is_super_admin());
create policy messages_inst_insert on public.institutional_messages for insert with check (
  direction = 'to_university' and public.has_role(institution_id, array['institution_admin']));
create policy messages_super_insert on public.institutional_messages for insert with check (
  direction = 'to_institution' and public.is_super_admin());
create policy documents_read on public.documents for select using (
  public.has_role(institution_id, array['institution_admin']) or public.is_super_admin());
create policy documents_insert on public.documents for insert with check (
  public.has_role(institution_id, array['institution_admin']) or public.is_super_admin());

-- Audit logs: admins see their institution; super admin sees all. Inserts only via trigger.
create policy audit_read on public.audit_logs for select using (
  public.is_super_admin() or (institution_id is not null and public.has_role(institution_id, array['institution_admin'])));

-- ---------------------------------------------------------------------------
-- Storage: private bucket, files stored under <institution_id>/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy documents_bucket_read on storage.objects for select using (
  bucket_id = 'documents' and (public.is_super_admin()
    or public.has_role(((storage.foldername(name))[1])::uuid, array['institution_admin'])));
create policy documents_bucket_insert on storage.objects for insert with check (
  bucket_id = 'documents' and (public.is_super_admin()
    or public.has_role(((storage.foldername(name))[1])::uuid, array['institution_admin'])));

grant execute on function public.ensure_meals(uuid, date) to authenticated;
grant execute on function public.my_table(date) to authenticated;
grant execute on function public.meal_totals(date, date, uuid) to authenticated;
revoke execute on function public.ensure_meals(uuid, date) from anon;
revoke execute on function public.my_table(date) from anon;
