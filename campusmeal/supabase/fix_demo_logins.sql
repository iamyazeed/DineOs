-- Repairs demo logins on a database seeded with an older seed.sql.
-- Run once in the Supabase SQL editor. Safe to run again.
-- After this, every demo account signs in with password 123:
--   test@superadmin  test@instadmin  test@chef  test@teacher  KMOIA001 … KMOIA240

-- 1. Staff emails need a dotted domain for Supabase Auth (the app adds ".demo").
update auth.users set email = email || '.demo'
where email in ('test@superadmin', 'test@instadmin', 'test@chef', 'test@teacher');
update public.profiles set email = email || '.demo'
where email in ('test@superadmin', 'test@instadmin', 'test@chef', 'test@teacher');

-- 2. NULL token columns make GoTrue fail with "Database error querying schema".
update auth.users set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  encrypted_password = extensions.crypt('123', extensions.gen_salt('bf'))
where email like 'test@%.demo' or email like '%@students.dineos';

-- 3. Identities carry the current email.
update auth.identities i set identity_data = jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true)
from auth.users u
where i.user_id = u.id and i.provider = 'email' and (u.email like 'test@%.demo' or u.email like '%@students.dineos');
