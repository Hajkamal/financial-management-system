-- User access management: auth events, admin notifications, password hints
-- This migration is intentionally NOT applied automatically.

create table if not exists public.auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  app_user_id text references public.app_users(id) on delete set null,
  event_type text not null check (event_type in (
    'login_success','login_failed','logout','password_reset_by_admin',
    'password_changed','session_revoked','account_locked'
  )),
  succeeded boolean not null default true,
  failure_reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists auth_events_user_created_idx
  on public.auth_events (user_id, created_at desc);
create index if not exists auth_events_type_created_idx
  on public.auth_events (event_type, created_at desc);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  related_auth_event_id uuid references public.auth_events(id) on delete set null,
  title text not null,
  body text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_recipient_created_idx
  on public.admin_notifications (recipient_user_id, created_at desc);

alter table public.app_users
  add column if not exists password_hint text;

alter table public.app_users
  enable row level security;

create policy "Users manage own password hint"
  on public.app_users for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create policy "Admins read password hints"
  on public.app_users for select
  using (
    exists (
      select 1 from public.app_users admin
      where admin.auth_user_id = auth.uid()
        and admin.role = 'super_admin'
        and admin.status = 'active'
    )
  );

create policy "Users read own auth events"
  on public.auth_events for select
  using (auth.uid() = user_id);

create policy "Admins read all auth events"
  on public.auth_events for select
  using (
    exists (
      select 1 from public.app_users admin
      where admin.auth_user_id = auth.uid()
        and admin.role = 'super_admin'
        and admin.status = 'active'
    )
  );

create policy "Authenticated users insert auth events"
  on public.auth_events for insert
  with check (auth.uid() = user_id);

create policy "Admins read all notifications"
  on public.admin_notifications for select
  using (auth.uid() = recipient_user_id);

create policy "Users update own notifications"
  on public.admin_notifications for update
  using (auth.uid() = recipient_user_id)
  with check (auth.uid() = recipient_user_id);

-- Security rule: never store recoverable passwords or password hints containing secrets.
-- Password reset must use Supabase Auth admin APIs and temporary credentials must be shown once.