-- CampusMeal DEMONSTRATION DATA (sample only — not real operational metrics).
-- Creates one demo institution (is_demo = true) with 2 halls, 21 tables,
-- 5 classes x 40 students, staff accounts, a timetable and ~3 weeks of sample activity.
-- Demo password for every account: CampusMeal#2026

do $$
declare
  v_inst uuid := '11111111-1111-1111-1111-111111111111';
  v_pw text := crypt('CampusMeal#2026', gen_salt('bf'));
  u record;
  v_today date := (now() at time zone 'Australia/Sydney')::date;
  v_hall_a uuid; v_hall_b uuid;
  v_class uuid; v_classes uuid[] := '{}';
  v_teachers uuid[] := array[
    'a0000000-0000-0000-0000-000000000011','a0000000-0000-0000-0000-000000000012',
    'a0000000-0000-0000-0000-000000000013','a0000000-0000-0000-0000-000000000014',
    'a0000000-0000-0000-0000-000000000015']::uuid[];
  v_class_names text[] := array['CS Year 1','CS Year 2','Commerce Year 1','Commerce Year 2','Science Year 1'];
  first_names text[] := array['Aarav','Mia','Liam','Zara','Noah','Isla','Arjun','Chloe','Ethan','Priya','Lucas','Amelia','Kai','Sofia','Rohan','Grace','Leo','Ananya','Oliver','Hana'];
  last_names text[] := array['Nguyen','Smith','Patel','Brown','Wilson','Singh','Taylor','Chen','Kumar','Martin','Lee','Walker','Khan','White','Das','Hall','Young','Rao','King','Wright'];
  i int; j int; t record; s record; cap int; filled int; v_table uuid;
  v_sched_b uuid; v_sched_l uuid; v_sched_d uuid;
  m record; v_req uuid;
begin
  -- Accounts ---------------------------------------------------------------
  for u in select * from (values
    ('a0000000-0000-0000-0000-000000000001'::uuid,'super@campusmeal.demo','Dr. Helen Park (University Admin)'),
    ('a0000000-0000-0000-0000-000000000002'::uuid,'admin@campusmeal.demo','Marcus Bell (Institution Admin)'),
    ('a0000000-0000-0000-0000-000000000003'::uuid,'chef@campusmeal.demo','Chef Rosa Alvarez'),
    ('a0000000-0000-0000-0000-000000000011'::uuid,'teacher1@campusmeal.demo','Ms. Anita Varma'),
    ('a0000000-0000-0000-0000-000000000012'::uuid,'teacher2@campusmeal.demo','Mr. James O''Neill'),
    ('a0000000-0000-0000-0000-000000000013'::uuid,'teacher3@campusmeal.demo','Ms. Fatima Noor'),
    ('a0000000-0000-0000-0000-000000000014'::uuid,'teacher4@campusmeal.demo','Mr. Daniel Cho'),
    ('a0000000-0000-0000-0000-000000000015'::uuid,'teacher5@campusmeal.demo','Ms. Laura Brooks'),
    ('a0000000-0000-0000-0000-000000000021'::uuid,'student1@campusmeal.demo','Aarav Nguyen'),
    ('a0000000-0000-0000-0000-000000000022'::uuid,'student2@campusmeal.demo','Mia Smith'),
    ('a0000000-0000-0000-0000-000000000023'::uuid,'student3@campusmeal.demo','Liam Patel')
  ) as x(id, email, name)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, v_pw, now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.name), now(), now(), '', '', '', '')
    on conflict (id) do nothing;
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now())
    on conflict do nothing;
    insert into public.profiles (id, full_name, email) values (u.id, u.name, u.email)
    on conflict (id) do update set full_name = excluded.full_name;
  end loop;

  -- Institution -------------------------------------------------------------
  insert into institutions (id, name, code, timezone, is_demo)
  values (v_inst, 'Riverside College (Demo)', 'DEMO', 'Australia/Sydney', true);

  insert into memberships (user_id, institution_id, role) values
    ('a0000000-0000-0000-0000-000000000001', null, 'super_admin'),
    ('a0000000-0000-0000-0000-000000000002', v_inst, 'institution_admin'),
    ('a0000000-0000-0000-0000-000000000003', v_inst, 'chef');
  foreach v_class in array v_teachers loop
    insert into memberships (user_id, institution_id, role) values (v_class, v_inst, 'teacher');
  end loop;

  -- A second, tiny institution to demonstrate tenant isolation & comparisons.
  insert into institutions (id, name, code, timezone, is_demo)
  values ('22222222-2222-2222-2222-222222222222', 'Hillview Campus (Demo)', 'HILL', 'Australia/Sydney', true);

  -- Classes & students ----------------------------------------------------------
  for i in 1..5 loop
    insert into classes (institution_id, name, teacher_id) values (v_inst, v_class_names[i], v_teachers[i]) returning id into v_class;
    v_classes := v_classes || v_class;
    for j in 1..40 loop
      insert into students (institution_id, class_id, roll_no, full_name, dietary_notes)
      values (v_inst, v_class, j,
        first_names[1 + ((i * 7 + j) % 20)] || ' ' || last_names[1 + ((i * 3 + j * 11) % 20)],
        case when (i * 40 + j) % 23 = 0 then 'Vegetarian' when (i * 40 + j) % 31 = 0 then 'Nut allergy' end);
    end loop;
  end loop;
  update students set profile_id = 'a0000000-0000-0000-0000-000000000021', full_name = 'Aarav Nguyen' where class_id = v_classes[1] and roll_no = 1;
  update students set profile_id = 'a0000000-0000-0000-0000-000000000022', full_name = 'Mia Smith' where class_id = v_classes[1] and roll_no = 2;
  update students set profile_id = 'a0000000-0000-0000-0000-000000000023', full_name = 'Liam Patel' where class_id = v_classes[2] and roll_no = 1;
  insert into memberships (user_id, institution_id, role) values
    ('a0000000-0000-0000-0000-000000000021', v_inst, 'student'),
    ('a0000000-0000-0000-0000-000000000022', v_inst, 'student'),
    ('a0000000-0000-0000-0000-000000000023', v_inst, 'student');

  -- Halls & tables (default capacity 10, a few custom) ----------------------------
  insert into dining_halls (institution_id, name, code, sort_order) values (v_inst, 'North Dining Hall', 'A', 1) returning id into v_hall_a;
  insert into dining_halls (institution_id, name, code, sort_order) values (v_inst, 'South Dining Hall', 'B', 2) returning id into v_hall_b;
  for i in 1..11 loop
    insert into dining_tables (institution_id, hall_id, code, capacity)
    values (v_inst, v_hall_a, 'A' || lpad(i::text, 2, '0'), case i when 3 then 8 when 7 then 12 end);
  end loop;
  for i in 1..10 loop
    insert into dining_tables (institution_id, hall_id, code, capacity)
    values (v_inst, v_hall_b, 'B' || lpad(i::text, 2, '0'), case i when 5 then 9 end);
  end loop;

  -- Fixed seat assignments: fill tables in order by class/roll.
  filled := 0; v_table := null; cap := 0;
  for s in select st.id from students st join classes c on c.id = st.class_id where st.institution_id = v_inst order by c.name, st.roll_no loop
    if v_table is null or filled >= cap then
      select dt.id, coalesce(dt.capacity, 10) as c into t from dining_tables dt
       where dt.institution_id = v_inst
         and not exists (select 1 from table_assignments ta where ta.table_id = dt.id)
       order by dt.code limit 1;
      v_table := t.id; cap := t.c; filled := 0;
    end if;
    insert into table_assignments (institution_id, table_id, student_id, start_date) values (v_inst, v_table, s.id, v_today - 60);
    filled := filled + 1;
  end loop;

  -- Supplier rotation: last month & current month (history).
  insert into supplier_rotations (institution_id, table_id, student_id, period_start, period_end, assigned_by)
  select v_inst, dt.id,
    (select ta.student_id from table_assignments ta join students st on st.id = ta.student_id where ta.table_id = dt.id order by st.full_name offset 1 limit 1),
    v_today - 45, v_today - 16, v_teachers[1]
  from dining_tables dt where dt.institution_id = v_inst;
  insert into supplier_rotations (institution_id, table_id, student_id, period_start, period_end, assigned_by)
  select v_inst, dt.id,
    (select ta.student_id from table_assignments ta join students st on st.id = ta.student_id where ta.table_id = dt.id order by st.full_name limit 1),
    v_today - 15, v_today + 14, v_teachers[1]
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
    and st.profile_id is null;
  insert into meal_attendance (institution_id, meal_id, student_id, reason, reported_by)
  select v_inst, m2.id, st.id, 'Reported absent by class teacher (sample)', c.teacher_id
  from meals m2 join students st on st.institution_id = v_inst join classes c on c.id = st.class_id
  where m2.institution_id = v_inst and m2.meal_date <= v_today
    and abs(hashtext(st.id::text || m2.id::text || 'a')) % 100 < 4
    and st.profile_id is null
  on conflict (meal_id, student_id) do nothing;

  -- Separate food: one approved for today's lunch, one pending for dinner.
  select * into m from meals where schedule_id = v_sched_l and meal_date = v_today;
  insert into separate_food_requests (institution_id, class_id, meal_id, portions, requirement, dietary_info, reason, status, requested_by, reviewed_by, reviewed_at, review_note)
  values (v_inst, v_classes[1], m.id, 3, 'Plain rice with steamed vegetables, no spice', 'Low-spice; one gluten-free', 'Recovering from illness (sample)', 'approved', v_teachers[1], 'a0000000-0000-0000-0000-000000000002', now(), 'Approved')
  returning id into v_req;
  insert into separate_food_request_students (request_id, student_id, institution_id)
  select v_req, st.id, v_inst from students st where st.class_id = v_classes[1] and st.roll_no in (11, 12, 13);
  select * into m from meals where schedule_id = v_sched_d and meal_date = v_today;
  insert into separate_food_requests (institution_id, class_id, meal_id, portions, requirement, dietary_info, reason, status, requested_by)
  values (v_inst, v_classes[3], m.id, 2, 'Jain meal (no onion/garlic)', 'Jain', 'Religious observance (sample)', 'pending', v_teachers[3])
  returning id into v_req;
  insert into separate_food_request_students (request_id, student_id, institution_id)
  select v_req, st.id, v_inst from students st where st.class_id = v_classes[3] and st.roll_no in (5, 6);

  -- Kitchen progress for past meals (completed) and today.
  insert into preparation_tasks (institution_id, meal_id, status, progress, updated_by)
  select v_inst, m2.id, 'completed', 100, 'a0000000-0000-0000-0000-000000000003'
  from meals m2 where m2.institution_id = v_inst and m2.meal_date < v_today;
  insert into preparation_tasks (institution_id, meal_id, status, progress, updated_by)
  select v_inst, m2.id, 'completed', 100, 'a0000000-0000-0000-0000-000000000003' from meals m2 where m2.schedule_id = v_sched_b and m2.meal_date = v_today;
  insert into preparation_tasks (institution_id, meal_id, status, progress, updated_by)
  select v_inst, m2.id, 'in_progress', 45, 'a0000000-0000-0000-0000-000000000003' from meals m2 where m2.schedule_id = v_sched_l and m2.meal_date = v_today;

  insert into meal_deliveries (institution_id, meal_id, hall_id, delivery_status, kitchen_distribution_status, updated_by)
  select v_inst, m2.id, h.id, 'delivered', 'completed', 'a0000000-0000-0000-0000-000000000003'
  from meals m2, dining_halls h
  where m2.institution_id = v_inst and h.institution_id = v_inst
    and (m2.meal_date < v_today or (m2.schedule_id = v_sched_b and m2.meal_date = v_today));

  insert into distribution_records (institution_id, meal_id, table_id, collected_at, collected_by, completed_at, completed_by)
  select v_inst, m2.id, dt.id, now(), v_teachers[1], now(), v_teachers[1]
  from meals m2, dining_tables dt
  where m2.institution_id = v_inst and dt.institution_id = v_inst
    and (m2.meal_date < v_today or (m2.schedule_id = v_sched_b and m2.meal_date = v_today));

  select * into m from meals where schedule_id = v_sched_b and meal_date = v_today;
  insert into missing_meal_reports (institution_id, meal_id, table_id, portions_missing, note, reported_by)
  select v_inst, m.id, dt.id, 1, 'One portion short at collection (sample)', v_teachers[2]
  from dining_tables dt where dt.institution_id = v_inst and dt.code = 'B04';

  set local session_replication_role = origin;

  -- Kitchen supporting data.
  insert into ingredient_items (institution_id, name, unit) values
    (v_inst, 'Rice', 'kg'), (v_inst, 'Lentils (dal)', 'kg'), (v_inst, 'Vegetables (mixed)', 'kg'),
    (v_inst, 'Cooking oil', 'L'), (v_inst, 'Milk', 'L'), (v_inst, 'Flour (atta)', 'kg');
  insert into ingredient_transactions (institution_id, item_id, kind, quantity, note, created_by)
  select v_inst, id, 'usage', 18, 'Breakfast & lunch prep (sample)', 'a0000000-0000-0000-0000-000000000003' from ingredient_items where institution_id = v_inst and name = 'Rice';
  insert into ingredient_transactions (institution_id, item_id, kind, quantity, note, created_by)
  select v_inst, id, 'shortage', 10, 'Need 10 L more before dinner (sample)', 'a0000000-0000-0000-0000-000000000003' from ingredient_items where institution_id = v_inst and name = 'Cooking oil';

  insert into kitchen_service_requests (institution_id, category, title, details, priority, status, created_by) values
    (v_inst, 'exhaust', 'Exhaust fan #2 vibrating loudly', 'Started this morning near the tandoor (sample).', 'normal', 'open', 'a0000000-0000-0000-0000-000000000003'),
    (v_inst, 'gas', 'Gas cylinder refill for Dinner', 'Two cylinders remaining (sample).', 'urgent', 'approved', 'a0000000-0000-0000-0000-000000000003');

  insert into announcements (institution_id, title, body, kind, audience, created_by) values
    (v_inst, 'Welcome to CampusMeal', 'Cancel meals you will skip before 8 PM the previous day so the kitchen can plan accurately. (sample)', 'general', '{student,teacher,chef}', 'a0000000-0000-0000-0000-000000000002'),
    (v_inst, 'Sponsored lunch earlier this week', 'Lunch was sponsored by the Alumni Association; the regular lunch was not prepared. (sample)', 'sponsored', '{student,teacher,chef}', 'a0000000-0000-0000-0000-000000000002');

  insert into institutional_messages (institution_id, direction, subject, body, sender_id) values
    (v_inst, 'to_university', 'Monthly canteen report', 'Please find the monthly meal summary attached once uploaded. (sample)', 'a0000000-0000-0000-0000-000000000002'),
    (v_inst, 'to_institution', 'Re: Monthly canteen report', 'Thank you — received. (sample)', 'a0000000-0000-0000-0000-000000000001');
end $$;
