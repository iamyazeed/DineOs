-- DineOS DEMONSTRATION DATA (sample only — not real operational metrics).
-- One demo institution, KMO Islamic Academy (code KMOIA), with 12 classes of
-- 20 students. Each class has its own letter (S1 = A, S2 = B … P2 = L) and its
-- students sit at that letter's tables: A1, A2, B1, B2 …
--
-- Demo logins (password 123 for every account):
--   test@superadmin  test@instadmin  test@chef  test@teacher
--   students: KMOIA001 … KMOIA240
do $$
declare
  v_inst uuid := '11111111-1111-1111-1111-111111111111';
  v_pw text := crypt('123', gen_salt('bf'));
  v_super uuid := 'a0000000-0000-0000-0000-000000000001';
  v_admin uuid := 'a0000000-0000-0000-0000-000000000002';
  v_chef uuid := 'a0000000-0000-0000-0000-000000000003';
  v_teacher uuid := 'a0000000-0000-0000-0000-000000000011';
  u record;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_hall_a uuid; v_hall_b uuid; v_hall uuid;
  v_class uuid; v_classes uuid[] := '{}';
  v_class_names text[] := array['S1','S2','S3','S4','S5','SS1','SS2','D1','D2','D3','P1','P2'];
  v_letters text[] := array['A','B','C','D','E','F','G','H','I','J','K','L'];
  v_per_class int := 20;
  v_per_table int := 10;
  names text[] := array[
    'Abu','Malik','Nizam','Yusuf','Ibrahim','Ismail','Ishaq','Yaqub','Musa','Haroon',
    'Dawood','Sulaiman','Zakariya','Yahya','Isa','Idris','Nuh','Hud','Salih','Shuaib',
    'Ilyas','Ayyub','Younus','Luqman','Umar','Usman','Ali','Hamza','Abbas','Bilal',
    'Khalid','Saad','Zaid','Anas','Muadh','Talha','Zubair','Ubaid','Huzaifa','Salman',
    'Ammar','Jafar','Hasan','Husain','Shafi','Rashid','Hamid','Mahmood','Ahmad','Faris',
    'Imran','Irfan','Junaid','Kabir','Latif','Majid','Nasir','Qasim','Rafeeq','Sabir',
    'Tariq','Waseem','Yasir','Zahid','Adil','Basheer','Fazil','Ghazali','Haris','Ihsan',
    'Jabir','Kamil','Labeeb','Munir','Nabeel','Owais','Rayyan','Sami','Thahir','Uwais',
    'Wafi','Yazeed','Zubin','Afsal','Aslam','Fahad','Hashim','Ikram','Javed','Karim',
    'Mubarak','Naseem','Rahim','Shakir','Siddiq','Tameem','Ubaidullah','Waleed','Yameen','Zaki',
    'Aqil','Bashir','Dilshad','Faisal','Habib','Iqbal','Jameel','Kaleem','Mujeeb','Nawaz',
    'Rizwan','Sadiq','Shameem','Thoufeeq','Unais','Wajid','Yaseen','Zameer','Anwar','Fuad'];
  i int; j int; k int; n int := 0; t record; s record;
  v_sched_b uuid; v_sched_l uuid; v_sched_d uuid;
  m record; v_req uuid; v_uid uuid; v_login text;
begin
  -- Staff accounts --------------------------------------------------------------
  for u in select * from (values
    (v_super,   'test@superadmin.demo', 'Super Admin'),
    (v_admin,   'test@instadmin.demo',  'Institution Admin'),
    (v_chef,    'test@chef.demo',       'Chef'),
    (v_teacher, 'test@teacher.demo',    'Teacher')
  ) as x(id, email, name)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, v_pw, now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.name), now(), now(), '', '', '', '', '', '', '', '')
    on conflict (id) do nothing;
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now())
    on conflict do nothing;
    insert into public.profiles (id, full_name, email) values (u.id, u.name, u.email)
    on conflict (id) do update set full_name = excluded.full_name;
  end loop;

  -- Institution -------------------------------------------------------------------
  insert into institutions (id, name, code, timezone, is_demo)
  values (v_inst, 'KMO Islamic Academy', 'KMOIA', 'Asia/Kolkata', true);

  insert into memberships (user_id, institution_id, role) values
    (v_super, null, 'super_admin'),
    (v_admin, v_inst, 'institution_admin'),
    (v_chef, v_inst, 'chef'),
    (v_teacher, v_inst, 'teacher');

  -- A second, empty institution to show tenant isolation.
  insert into institutions (id, name, code, timezone, is_demo)
  values ('22222222-2222-2222-2222-222222222222', 'KMO Arts College (Demo)', 'KMOAC', 'Asia/Kolkata', true);

  -- Halls: S and SS classes eat in the Main Hall, D and P classes in the Annex.
  insert into dining_halls (institution_id, name, code, sort_order) values (v_inst, 'Main Hall', 'MAIN', 1) returning id into v_hall_a;
  insert into dining_halls (institution_id, name, code, sort_order) values (v_inst, 'Annex Hall', 'ANNEX', 2) returning id into v_hall_b;

  -- Classes, tables, students, logins and seats ----------------------------------------
  for i in 1..array_length(v_class_names, 1) loop
    insert into classes (institution_id, name, teacher_id) values (v_inst, v_class_names[i], v_teacher) returning id into v_class;
    v_classes := v_classes || v_class;
    v_hall := case when v_class_names[i] like 'S%' then v_hall_a else v_hall_b end;
    for k in 1..ceil(v_per_class::numeric / v_per_table)::int loop
      insert into dining_tables (institution_id, hall_id, code, capacity) values (v_inst, v_hall, v_letters[i] || k, v_per_table);
    end loop;
    for j in 1..v_per_class loop
      n := n + 1;
      v_login := 'KMOIA' || lpad(n::text, 3, '0');
      v_uid := ('a1000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token)
      values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', lower(v_login) || '@students.dineos', v_pw, now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', names[1 + (n - 1) % array_length(names, 1)] || ' - ' || lpad(n::text, 3, '0')), now(), now(), '', '', '', '', '', '', '', '')
      on conflict (id) do nothing;
      insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', lower(v_login) || '@students.dineos', 'email_verified', true), 'email', now(), now(), now())
      on conflict do nothing;
      insert into public.profiles (id, full_name, email)
      values (v_uid, names[1 + (n - 1) % array_length(names, 1)] || ' - ' || lpad(n::text, 3, '0'), lower(v_login) || '@students.dineos')
      on conflict (id) do update set full_name = excluded.full_name;
      insert into memberships (user_id, institution_id, role) values (v_uid, v_inst, 'student');

      insert into students (institution_id, class_id, profile_id, roll_no, admission_no, full_name, dietary_notes)
      values (v_inst, v_class, v_uid, j, n,
        names[1 + (n - 1) % array_length(names, 1)] || ' - ' || lpad(n::text, 3, '0'),
        case when n % 23 = 0 then 'Vegetarian' when n % 31 = 0 then 'Nut allergy' end)
      returning id into v_req;
      insert into table_assignments (institution_id, table_id, student_id, start_date)
      select v_inst, dt.id, v_req, v_today - 60 from dining_tables dt
      where dt.institution_id = v_inst and dt.code = v_letters[i] || (1 + (j - 1) / v_per_table);
    end loop;
  end loop;

  -- Supplier rotation: last month & current month (history).
  insert into supplier_rotations (institution_id, table_id, student_id, period_start, period_end, assigned_by)
  select v_inst, dt.id,
    (select ta.student_id from table_assignments ta join students st on st.id = ta.student_id where ta.table_id = dt.id order by st.full_name offset 1 limit 1),
    v_today - 45, v_today - 16, v_teacher
  from dining_tables dt where dt.institution_id = v_inst;
  insert into supplier_rotations (institution_id, table_id, student_id, period_start, period_end, assigned_by)
  select v_inst, dt.id,
    (select ta.student_id from table_assignments ta join students st on st.id = ta.student_id where ta.table_id = dt.id order by st.full_name limit 1),
    v_today - 15, v_today + 14, v_teacher
  from dining_tables dt where dt.institution_id = v_inst;

  -- Timetable & weekly menu --------------------------------------------------------
  insert into meal_schedules (institution_id, name, serve_time, sort_order) values (v_inst, 'Breakfast', '07:30', 1) returning id into v_sched_b;
  insert into meal_schedules (institution_id, name, serve_time, sort_order) values (v_inst, 'Lunch', '12:30', 2) returning id into v_sched_l;
  insert into meal_schedules (institution_id, name, serve_time, sort_order) values (v_inst, 'Dinner', '19:00', 3) returning id into v_sched_d;
  insert into meal_menus (institution_id, schedule_id, weekday, items)
  select v_inst, v_sched_b, d, (array['Idli, sambar, fruit','Oats porridge, banana, milk','Poha, boiled egg, tea','Toast, scrambled eggs, juice','Upma, chutney, fruit','Pancakes, yoghurt, berries','Paratha, curd, tea'])[d + 1] from generate_series(0, 6) d;
  insert into meal_menus (institution_id, schedule_id, weekday, items)
  select v_inst, v_sched_l, d, (array['Vegetable biryani, raita, salad','Rice, dal, mixed veg curry, papad','Chicken curry, rice, salad','Pasta primavera, garlic bread','Rajma chawal, salad','Fried rice, chilli paneer','Roti, paneer butter masala, rice'])[d + 1] from generate_series(0, 6) d;
  insert into meal_menus (institution_id, schedule_id, weekday, items)
  select v_inst, v_sched_d, d, (array['Roti, dal makhani, salad','Lemon rice, sambar, curd','Chapati, chana masala, rice','Noodle soup, spring rolls','Roti, aloo gobi, dal','Khichdi, kadhi, pickle','Pulao, mixed raita, dessert'])[d + 1] from generate_series(0, 6) d;

  -- Daily meal instances: two weeks back, one week ahead.
  insert into meals (institution_id, schedule_id, meal_date)
  select v_inst, s2.id, d::date from meal_schedules s2, generate_series(v_today - 13, v_today + 6, interval '1 day') d
  where s2.institution_id = v_inst;
  -- A sponsored afternoon meal earlier this week (original preserved, status changed).
  update meals set status = 'sponsored', status_reason = 'Lunch sponsored by Alumni Association (sample)'
  where schedule_id = v_sched_l and meal_date = v_today - 3;

  -- Sample activity (bypass role triggers that need a signed-in user) -------------
  set local session_replication_role = replica;

  -- Historical + today's cancellations (~8%) and teacher-reported absences (~4%).
  insert into meal_cancellations (institution_id, meal_id, student_id, source, cancelled_at)
  select v_inst, m2.id, st.id, 'student', now() - interval '1 day'
  from meals m2 join students st on st.institution_id = v_inst
  where m2.institution_id = v_inst and m2.meal_date <= v_today + 1
    and abs(hashtext(m2.id::text || st.id::text)) % 100 < 8
    and st.admission_no <> 1;
  insert into meal_attendance (institution_id, meal_id, student_id, reason, reported_by)
  select v_inst, m2.id, st.id, 'Reported absent by class teacher (sample)', c.teacher_id
  from meals m2 join students st on st.institution_id = v_inst join classes c on c.id = st.class_id
  where m2.institution_id = v_inst and m2.meal_date <= v_today
    and abs(hashtext(st.id::text || m2.id::text || 'a')) % 100 < 4
    and st.admission_no <> 1
  on conflict (meal_id, student_id) do nothing;

  -- Separate food: one approved for today's lunch, one pending for dinner.
  select * into m from meals where schedule_id = v_sched_l and meal_date = v_today;
  insert into separate_food_requests (institution_id, class_id, meal_id, portions, requirement, dietary_info, reason, status, requested_by, reviewed_by, reviewed_at, review_note)
  values (v_inst, v_classes[1], m.id, 3, 'Plain rice with steamed vegetables, no spice', 'Low-spice; one gluten-free', 'Recovering from illness (sample)', 'approved', v_teacher, v_admin, now(), 'Approved')
  returning id into v_req;
  insert into separate_food_request_students (request_id, student_id, institution_id)
  select v_req, st.id, v_inst from students st where st.class_id = v_classes[1] and st.roll_no in (11, 12, 13);
  select * into m from meals where schedule_id = v_sched_d and meal_date = v_today;
  insert into separate_food_requests (institution_id, class_id, meal_id, portions, requirement, dietary_info, reason, status, requested_by)
  values (v_inst, v_classes[3], m.id, 2, 'Mild food, no chilli', 'Low-spice', 'Upset stomach (sample)', 'pending', v_teacher)
  returning id into v_req;
  insert into separate_food_request_students (request_id, student_id, institution_id)
  select v_req, st.id, v_inst from students st where st.class_id = v_classes[3] and st.roll_no in (5, 6);

  -- Kitchen progress for past meals (completed) and today.
  insert into preparation_tasks (institution_id, meal_id, status, progress, updated_by)
  select v_inst, m2.id, 'completed', 100, v_chef
  from meals m2 where m2.institution_id = v_inst and m2.meal_date < v_today;
  insert into preparation_tasks (institution_id, meal_id, status, progress, updated_by)
  select v_inst, m2.id, 'completed', 100, v_chef from meals m2 where m2.schedule_id = v_sched_b and m2.meal_date = v_today;
  insert into preparation_tasks (institution_id, meal_id, status, progress, updated_by)
  select v_inst, m2.id, 'in_progress', 45, v_chef from meals m2 where m2.schedule_id = v_sched_l and m2.meal_date = v_today;

  insert into meal_deliveries (institution_id, meal_id, hall_id, delivery_status, kitchen_distribution_status, updated_by)
  select v_inst, m2.id, h.id, 'delivered', 'completed', v_chef
  from meals m2, dining_halls h
  where m2.institution_id = v_inst and h.institution_id = v_inst
    and (m2.meal_date < v_today or (m2.schedule_id = v_sched_b and m2.meal_date = v_today));

  insert into distribution_records (institution_id, meal_id, table_id, collected_at, collected_by, completed_at, completed_by)
  select v_inst, m2.id, dt.id, now(), v_teacher, now(), v_teacher
  from meals m2, dining_tables dt
  where m2.institution_id = v_inst and dt.institution_id = v_inst
    and (m2.meal_date < v_today or (m2.schedule_id = v_sched_b and m2.meal_date = v_today));

  select * into m from meals where schedule_id = v_sched_b and meal_date = v_today;
  insert into missing_meal_reports (institution_id, meal_id, table_id, portions_missing, note, reported_by)
  select v_inst, m.id, dt.id, 1, 'One portion short at collection (sample)', v_teacher
  from dining_tables dt where dt.institution_id = v_inst and dt.code = 'B1';

  set local session_replication_role = origin;

  -- Kitchen supporting data.
  insert into ingredient_items (institution_id, name, unit) values
    (v_inst, 'Rice', 'kg'), (v_inst, 'Lentils (dal)', 'kg'), (v_inst, 'Vegetables (mixed)', 'kg'),
    (v_inst, 'Cooking oil', 'L'), (v_inst, 'Milk', 'L'), (v_inst, 'Flour (atta)', 'kg');
  insert into ingredient_transactions (institution_id, item_id, kind, quantity, note, created_by)
  select v_inst, id, 'usage', 18, 'Breakfast & lunch prep (sample)', v_chef from ingredient_items where institution_id = v_inst and name = 'Rice';
  insert into ingredient_transactions (institution_id, item_id, kind, quantity, note, created_by)
  select v_inst, id, 'shortage', 10, 'Need 10 L more before dinner (sample)', v_chef from ingredient_items where institution_id = v_inst and name = 'Cooking oil';

  insert into kitchen_service_requests (institution_id, category, title, details, priority, status, created_by) values
    (v_inst, 'exhaust', 'Exhaust fan #2 vibrating loudly', 'Started this morning near the tandoor (sample).', 'normal', 'open', v_chef),
    (v_inst, 'gas', 'Gas cylinder refill for Dinner', 'Two cylinders remaining (sample).', 'urgent', 'approved', v_chef);

  insert into announcements (institution_id, title, body, kind, audience, created_by) values
    (v_inst, 'Welcome to DineOS', 'Cancel meals you will skip before 8 PM the previous day so the kitchen can plan accurately. (sample)', 'general', '{student,teacher,chef}', v_admin),
    (v_inst, 'Sponsored lunch earlier this week', 'Lunch was sponsored by the Alumni Association; the regular lunch was not prepared. (sample)', 'sponsored', '{student,teacher,chef}', v_admin);

  insert into institutional_messages (institution_id, direction, subject, body, sender_id) values
    (v_inst, 'to_university', 'Monthly canteen report', 'Please find the monthly meal summary attached once uploaded. (sample)', v_admin),
    (v_inst, 'to_institution', 'Re: Monthly canteen report', 'Thank you — received. (sample)', v_super);
end $$;
