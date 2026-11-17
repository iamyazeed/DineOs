-- CampusMeal core schema
-- Multi-tenant: every institution-owned row carries institution_id.
-- Configuration (halls, tables, assignments, timetable, menus) is set once and
-- reused; daily `meals` rows are generated from `meal_schedules` on demand.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Institutions & people
-- ---------------------------------------------------------------------------
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  code text not null unique check (code ~ '^[A-Z0-9-]{2,16}$'),
  timezone text not null default 'UTC',
  default_table_capacity int not null default 10 check (default_table_capacity between 1 and 100),
  default_cancel_days_before int not null default 1 check (default_cancel_days_before between 0 and 7),
  default_cancel_time time not null default '20:00',
  supplier_rotation_days int not null default 30 check (supplier_rotation_days between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now()
);

-- One row per (user, role, institution). Super admins have institution_id null.
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete cascade,
  role text not null check (role in ('super_admin','institution_admin','chef','teacher','student')),
  created_at timestamptz not null default now(),
  check ((role = 'super_admin') = (institution_id is null))
);
create unique index memberships_unique on public.memberships (user_id, role, coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index memberships_inst on public.memberships (institution_id);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  teacher_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (institution_id, name)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  profile_id uuid unique references public.profiles(id) on delete set null,
  roll_no int not null check (roll_no > 0),
  full_name text not null check (length(trim(full_name)) > 0),
  dietary_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (class_id, roll_no)
);
create index students_inst on public.students (institution_id);

-- ---------------------------------------------------------------------------
-- Campus configuration (configured once, reused daily)
-- ---------------------------------------------------------------------------
create table public.dining_halls (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  code text not null check (code ~ '^[A-Z0-9]{1,6}$'),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (institution_id, code)
);

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  hall_id uuid not null references public.dining_halls(id) on delete cascade,
  code text not null check (length(trim(code)) > 0),
  capacity int check (capacity is null or capacity between 1 and 100), -- null => institution default
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (institution_id, code)
);
create index dining_tables_hall on public.dining_tables (hall_id);

-- Fixed seat assignments with history (ended rows keep end_date).
create table public.table_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  table_id uuid not null references public.dining_tables(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create unique index table_assignments_one_active on public.table_assignments (student_id) where end_date is null;
create index table_assignments_table on public.table_assignments (table_id) where end_date is null;

-- Monthly supplier rotation per table (history preserved).
create table public.supplier_rotations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  table_id uuid not null references public.dining_tables(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (table_id, period_start)
);

-- Substitute for an absent supplier on a given meal; original rotation untouched.
create table public.supplier_substitutions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  rotation_id uuid not null references public.supplier_rotations(id) on delete cascade,
  meal_id uuid not null, -- fk added after meals table
  substitute_student_id uuid not null references public.students(id) on delete cascade,
  reason text,
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (rotation_id, meal_id)
);

-- ---------------------------------------------------------------------------
-- Meal timetable & daily meals
-- ---------------------------------------------------------------------------
create table public.meal_schedules (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  serve_time time not null,
  weekdays int[] not null default '{1,2,3,4,5,6,0}', -- 0=Sun..6=Sat
  hall_ids uuid[],                                  -- null => all active halls
  cancel_days_before int not null default 1 check (cancel_days_before between 0 and 7),
  cancel_time time not null default '20:00',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (institution_id, name)
);

-- Standing weekly menu per schedule & weekday.
create table public.meal_menus (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  schedule_id uuid not null references public.meal_schedules(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  items text not null default '',
  updated_at timestamptz not null default now(),
  unique (schedule_id, weekday)
);

-- Daily meal instance. Never deleted: cancellations/sponsorships change status.
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  schedule_id uuid not null references public.meal_schedules(id) on delete restrict,
  meal_date date not null,
  status text not null default 'scheduled' check (status in ('scheduled','modified','sponsored','cancelled')),
  menu_override text,
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, meal_date)
);
create index meals_inst_date on public.meals (institution_id, meal_date);

alter table public.supplier_substitutions
  add constraint supplier_substitutions_meal_fk foreign key (meal_id) references public.meals(id) on delete cascade;

-- Student cancellation (one per student per meal).
create table public.meal_cancellations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  meal_id uuid not null references public.meals(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  source text not null default 'student' check (source in ('student','exception')),
  note text,
  created_by uuid references public.profiles(id),
  cancelled_at timestamptz not null default now(),
  unique (meal_id, student_id)
);

-- Teacher-reported canteen absences (distinct from campus attendance).
create table public.meal_attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  meal_id uuid not null references public.meals(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'absent' check (status in ('absent')),
  reason text,
  reported_by uuid references public.profiles(id),
  reported_at timestamptz not null default now(),
  unique (meal_id, student_id)
);

create table public.separate_food_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  meal_id uuid not null references public.meals(id) on delete cascade,
  portions int not null check (portions between 1 and 500),
  requirement text not null check (length(trim(requirement)) > 0),
  dietary_info text,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index sfr_meal on public.separate_food_requests (meal_id);

create table public.separate_food_request_students (
  request_id uuid not null references public.separate_food_requests(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  primary key (request_id, student_id)
);

-- ---------------------------------------------------------------------------
-- Kitchen
-- ---------------------------------------------------------------------------
-- No row => Not Started / on time.
create table public.preparation_tasks (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  meal_id uuid not null unique references public.meals(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed','delayed')),
  progress int not null default 0 check (progress between 0 and 100),
  delay_minutes int check (delay_minutes is null or delay_minutes between 1 and 600),
  delay_reason text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  check (status <> 'delayed' or delay_reason is not null)
);

create table public.ingredient_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  unit text not null default 'kg',
  unique (institution_id, name)
);

create table public.ingredient_transactions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  item_id uuid not null references public.ingredient_items(id) on delete cascade,
  meal_id uuid references public.meals(id) on delete set null,
  kind text not null check (kind in ('usage','shortage')),
  quantity numeric(10,2) not null check (quantity > 0),
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.kitchen_service_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  category text not null check (category in ('electrical','gas','exhaust','equipment','ingredients','support','other')),
  title text not null check (length(trim(title)) > 0),
  details text,
  priority text not null default 'normal' check (priority in ('low','normal','urgent')),
  status text not null default 'open' check (status in ('open','approved','rejected','in_progress','resolved')),
  admin_note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Delivery & distribution
-- ---------------------------------------------------------------------------
-- Kitchen side, per hall.
create table public.meal_deliveries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  meal_id uuid not null references public.meals(id) on delete cascade,
  hall_id uuid not null references public.dining_halls(id) on delete cascade,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','dispatched','delivered')),
  kitchen_distribution_status text not null default 'pending' check (kitchen_distribution_status in ('pending','serving','completed')),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (meal_id, hall_id)
);

-- Teacher side, per table.
create table public.distribution_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  meal_id uuid not null references public.meals(id) on delete cascade,
  table_id uuid not null references public.dining_tables(id) on delete cascade,
  collected_at timestamptz,
  collected_by uuid references public.profiles(id),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  unique (meal_id, table_id),
  check (completed_at is null or collected_at is not null)
);

create table public.missing_meal_reports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  meal_id uuid not null references public.meals(id) on delete cascade,
  table_id uuid references public.dining_tables(id) on delete set null,
  portions_missing int not null default 1 check (portions_missing between 0 and 100),
  note text not null check (length(trim(note)) > 0),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  reported_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Communication & governance
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  kind text not null default 'general' check (kind in ('general','emergency','sponsored','cancellation','menu_change')),
  audience text[] not null default '{student,teacher,chef}',
  meal_id uuid references public.meals(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index announcements_inst on public.announcements (institution_id, created_at desc);

create table public.institutional_messages (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  direction text not null check (direction in ('to_university','to_institution')),
  subject text,
  body text not null check (length(trim(body)) > 0),
  sender_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  message_id uuid references public.institutional_messages(id) on delete set null,
  storage_path text not null unique,
  file_name text not null,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  institution_id uuid references public.institutions(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_inst on public.audit_logs (institution_id, created_at desc);
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
-- Create a profile for every new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Flag demonstration tenants so the UI can label their data as sample data.
alter table public.institutions add column is_demo boolean not null default false;

-- ===== 20261117000004_student_numbers.sql =====
-- Per-institution student numbers. A student's login ID is the institution
-- code followed by this number padded to 3 digits, e.g. KMOIA001.
alter table public.students add column admission_no int check (admission_no is null or admission_no > 0);
create unique index students_admission_no on public.students (institution_id, admission_no);

create or replace function public.assign_admission_no() returns trigger
language plpgsql as $$
begin
  if new.admission_no is null then
    perform pg_advisory_xact_lock(hashtext('admission_no:' || new.institution_id::text));
    select coalesce(max(admission_no), 0) + 1 into new.admission_no
      from public.students where institution_id = new.institution_id;
  end if;
  return new;
end $$;

create trigger students_admission_no before insert on public.students
  for each row execute function public.assign_admission_no();

-- Backfill any existing rows in a stable order.
with numbered as (
  select id, row_number() over (partition by institution_id order by created_at, roll_no, id) as n
  from public.students where admission_no is null
)
update public.students s set admission_no = numbered.n from numbered where numbered.id = s.id;
