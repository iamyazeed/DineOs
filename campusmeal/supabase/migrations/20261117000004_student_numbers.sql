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
