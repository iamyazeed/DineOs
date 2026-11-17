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
