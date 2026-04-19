-- ============================================================
-- MargDarshak — Complete Database Schema (safe to re-run)
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. USERS
create table if not exists users (
  id          uuid default gen_random_uuid() primary key,
  clerk_id    text unique not null,
  email       text,
  full_name   text,
  avatar_url  text,
  phone       text,
  last_lat    double precision,
  last_lng    double precision,
  last_city   text,
  created_at  timestamptz default now()
);
create index if not exists idx_users_clerk_id on users (clerk_id);

-- Add location columns if table already exists (safe to re-run)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='users' and column_name='last_lat') then
    alter table users add column last_lat double precision;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='users' and column_name='last_lng') then
    alter table users add column last_lng double precision;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='users' and column_name='last_city') then
    alter table users add column last_city text;
  end if;
end $$;

-- 2. TRIPS
create table if not exists trips (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references users(id) on delete cascade not null,
  intent      text,
  origin      text,
  destination text,
  created_at  timestamptz default now()
);
create index if not exists idx_trips_user_id on trips (user_id);

-- 3. AI HISTORY
create table if not exists ai_history (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references users(id) on delete cascade not null,
  prompt      text,
  response    text,
  detected_mode text,
  estimated_cost numeric(10,2),
  travel_hour smallint check (travel_hour between 0 and 23),
  created_at  timestamptz default now()
);
create index if not exists idx_ai_history_user_id on ai_history (user_id);

-- Add personalization columns if table already exists (safe to re-run)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='ai_history' and column_name='detected_mode') then
    alter table ai_history add column detected_mode text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='ai_history' and column_name='estimated_cost') then
    alter table ai_history add column estimated_cost numeric(10,2);
  end if;
  if not exists (select 1 from information_schema.columns where table_name='ai_history' and column_name='travel_hour') then
    alter table ai_history add column travel_hour smallint check (travel_hour between 0 and 23);
  end if;
end $$;

-- 4. INTENTS
create table if not exists intents (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references users(id) on delete cascade not null,
  query       text not null,
  created_at  timestamptz default now()
);
create index if not exists idx_intents_user_id on intents (user_id);

-- 5. ENVIRONMENT LOGS
create table if not exists environment_logs (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references users(id) on delete cascade not null,
  temp              double precision,
  weather           text,
  weather_code      integer,
  aqi               integer,
  aqi_label         text,
  humidity          double precision,
  wind_speed        double precision,
  rain_probability  integer,
  pm25              double precision,
  created_at        timestamptz default now()
);
create index if not exists idx_env_logs_user_id on environment_logs (user_id);

-- 6. SAVED TRIPS
create table if not exists saved_trips (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references users(id) on delete cascade not null,
  source          text not null,
  destination     text not null,
  preferred_mode  text,
  estimated_cost  numeric(10,2),
  travel_hour     smallint check (travel_hour between 0 and 23),
  created_at      timestamptz default now()
);
create index if not exists idx_saved_trips_user_id on saved_trips (user_id);

-- Add personalization columns if table already exists (safe to re-run)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='saved_trips' and column_name='estimated_cost') then
    alter table saved_trips add column estimated_cost numeric(10,2);
  end if;
  if not exists (select 1 from information_schema.columns where table_name='saved_trips' and column_name='travel_hour') then
    alter table saved_trips add column travel_hour smallint check (travel_hour between 0 and 23);
  end if;
end $$;

-- 7. USER PREFERENCES
create table if not exists user_preferences (
  user_id          uuid references users(id) on delete cascade primary key,
  preferred_modes  jsonb not null default '{}'::jsonb,
  avg_budget       numeric(10,2),
  safety_priority  numeric(4,3) not null default 0.5 check (safety_priority >= 0 and safety_priority <= 1),
  eco_priority     numeric(4,3) not null default 0.5 check (eco_priority >= 0 and eco_priority <= 1),
  last_updated     timestamptz default now()
);
create index if not exists idx_user_preferences_user_id on user_preferences (user_id);

-- 8. SOS LOGS
create table if not exists sos_logs (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references users(id) on delete cascade not null,
  lat         double precision,
  lng         double precision,
  area        text,
  created_at  timestamptz default now()
);
create index if not exists idx_sos_logs_user_id on sos_logs (user_id);

-- ============================================================
-- RLS (drop + recreate to be safe on re-runs)
-- ============================================================

alter table users enable row level security;
alter table trips enable row level security;
alter table ai_history enable row level security;
alter table intents enable row level security;
alter table environment_logs enable row level security;
alter table saved_trips enable row level security;
alter table user_preferences enable row level security;
alter table sos_logs enable row level security;

-- Users
drop policy if exists "Users can read own data" on users;
drop policy if exists "Users can insert own data" on users;
drop policy if exists "Users can update own data" on users;
create policy "Users can read own data" on users for select using (true);
create policy "Users can insert own data" on users for insert with check (true);
create policy "Users can update own data" on users for update using (true);

-- Trips
drop policy if exists "Users can read own trips" on trips;
drop policy if exists "Users can insert own trips" on trips;
drop policy if exists "Users can delete own trips" on trips;
create policy "Users can read own trips" on trips for select using (user_id in (select id from users));
create policy "Users can insert own trips" on trips for insert with check (user_id in (select id from users));
create policy "Users can delete own trips" on trips for delete using (user_id in (select id from users));

-- AI History
drop policy if exists "Users can read own ai_history" on ai_history;
drop policy if exists "Users can insert own ai_history" on ai_history;
create policy "Users can read own ai_history" on ai_history for select using (user_id in (select id from users));
create policy "Users can insert own ai_history" on ai_history for insert with check (user_id in (select id from users));

-- Intents
drop policy if exists "Users can read own intents" on intents;
drop policy if exists "Users can insert own intents" on intents;
drop policy if exists "Users can delete own intents" on intents;
create policy "Users can read own intents" on intents for select using (user_id in (select id from users));
create policy "Users can insert own intents" on intents for insert with check (user_id in (select id from users));
create policy "Users can delete own intents" on intents for delete using (user_id in (select id from users));

-- Environment Logs
drop policy if exists "Users can read own env_logs" on environment_logs;
drop policy if exists "Users can insert own env_logs" on environment_logs;
create policy "Users can read own env_logs" on environment_logs for select using (user_id in (select id from users));
create policy "Users can insert own env_logs" on environment_logs for insert with check (user_id in (select id from users));

-- Saved Trips
drop policy if exists "Users can read own saved_trips" on saved_trips;
drop policy if exists "Users can insert own saved_trips" on saved_trips;
drop policy if exists "Users can delete own saved_trips" on saved_trips;
create policy "Users can read own saved_trips" on saved_trips for select using (user_id in (select id from users));
create policy "Users can insert own saved_trips" on saved_trips for insert with check (user_id in (select id from users));
create policy "Users can delete own saved_trips" on saved_trips for delete using (user_id in (select id from users));

-- User Preferences
drop policy if exists "Users can read own preferences" on user_preferences;
drop policy if exists "Users can insert own preferences" on user_preferences;
drop policy if exists "Users can update own preferences" on user_preferences;
create policy "Users can read own preferences" on user_preferences for select using (user_id in (select id from users));
create policy "Users can insert own preferences" on user_preferences for insert with check (user_id in (select id from users));
create policy "Users can update own preferences" on user_preferences for update using (user_id in (select id from users));

-- SOS Logs
drop policy if exists "Users can read own sos_logs" on sos_logs;
drop policy if exists "Users can insert own sos_logs" on sos_logs;
create policy "Users can read own sos_logs" on sos_logs for select using (user_id in (select id from users));
create policy "Users can insert own sos_logs" on sos_logs for insert with check (user_id in (select id from users));
