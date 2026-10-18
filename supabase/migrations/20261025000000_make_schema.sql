-- ELUM Make: designs (slides, posters, social posts) on the shared ELUM platform.
--
-- Needs the platform first (Write's migrations up to 20261024000000_profile_for_every_account.sql).
-- Accounts are Supabase Auth users with a public.profiles row; Make adds its own schema:
--   make.designs  a design: its pages and elements as JSON, saved with a version number
--   make.shares   who else can view or edit it
--   make-images   storage bucket for pictures placed in designs, one folder per design
-- The app calls only the public.make_* functions below. Tables are closed to the app roles.

create schema if not exists make;

-- ------------------------------------------------------------------ tables

create table make.designs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default 'Untitled design' check (char_length(btrim(title)) between 1 and 200),
  -- What it was made as; decides the page size offered first.
  kind text not null default 'presentation' check (kind in ('presentation', 'poster', 'social', 'custom')),
  width integer not null default 1920 check (width between 100 and 8000),
  height integer not null default 1080 check (height between 100 and 8000),
  -- { "pages": [ { "id", "background", "elements": [ ... ] } ] } (see src/editor/model.ts).
  content jsonb not null default '{"pages": []}' check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 5000000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
create index designs_owner_idx on make.designs (owner_id, updated_at desc);

create table make.shares (
  design_id uuid not null references make.designs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (design_id, user_id)
);
create index shares_user_idx on make.shares (user_id);

alter table make.designs enable row level security;
alter table make.shares enable row level security;
revoke all on all tables in schema make from public, anon, authenticated;

-- ---------------------------------------------------------------- helpers

create function make.require_me() returns uuid
language plpgsql stable as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'PT401', message = 'Your session has ended. Sign in again.';
  end if;
  return auth.uid();
end $$;

-- owner, editor, viewer, or null.
create function make.role_of(p_design uuid, p_user uuid) returns text
language sql stable security definer set search_path = make, public as $$
  select case
    when exists (select 1 from make.designs d where d.id = p_design and d.owner_id = p_user) then 'owner'
    else (select s.role from make.shares s where s.design_id = p_design and s.user_id = p_user)
  end
$$;

create function make.require_role(p_design uuid, p_need text) returns text
language plpgsql stable security definer set search_path = make, public as $$
declare
  v_role text := make.role_of(p_design, make.require_me());
begin
  if v_role is null then
    raise exception using errcode = 'PT404', message = 'This design does not exist, or it has not been shared with you.';
  end if;
  if p_need = 'owner' and v_role <> 'owner' then
    raise exception using errcode = 'PT403', message = 'Only the owner can do that.';
  end if;
  if p_need = 'editor' and v_role = 'viewer' then
    raise exception using errcode = 'PT403', message = 'You can view this design but not change it.';
  end if;
  return v_role;
end $$;

create function make.person(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'email', p.email, 'color', p.color)
  from public.profiles p where p.id = p_id
$$;

create function make.summary(d make.designs, p_role text) returns jsonb
language sql stable security definer set search_path = make, public as $$
  select jsonb_build_object(
    'id', d.id, 'title', d.title, 'kind', d.kind, 'width', d.width, 'height', d.height,
    'role', p_role, 'owner', make.person(d.owner_id), 'updatedAt', d.updated_at, 'createdAt', d.created_at,
    'pageCount', coalesce(jsonb_array_length(d.content -> 'pages'), 0),
    -- The first page, so the list can draw a thumbnail without a second request.
    'cover', d.content -> 'pages' -> 0)
$$;

-- The signed-in person's role on a design, for storage policies.
create function make.my_role(p_design uuid) returns text
language sql stable security definer set search_path = make, public as $$
  select make.role_of(p_design, auth.uid())
$$;

revoke all on function make.require_me(), make.role_of(uuid, uuid), make.require_role(uuid, text), make.my_role(uuid),
  make.person(uuid), make.summary(make.designs, text) from public;

-- ------------------------------------------------------------------- the API

-- Every design you own or that was shared with you, newest first.
create function public.make_list() returns jsonb
language plpgsql stable security definer set search_path = make, public as $$
declare
  v_me uuid := make.require_me();
begin
  return coalesce((
    select jsonb_agg(x.summary order by x.updated_at desc)
    from (
      select make.summary(d, 'owner') as summary, d.updated_at from make.designs d where d.owner_id = v_me
      union all
      select make.summary(d, s.role), d.updated_at from make.designs d join make.shares s on s.design_id = d.id where s.user_id = v_me
    ) x), '[]'::jsonb);
end $$;

create function public.make_create(p_title text default null, p_kind text default 'presentation',
                                   p_width integer default 1920, p_height integer default 1080,
                                   p_content jsonb default null) returns jsonb
language plpgsql security definer set search_path = make, public as $$
declare
  v_me uuid := make.require_me();
  v_design make.designs;
begin
  insert into make.designs (owner_id, title, kind, width, height, content, updated_by)
  values (v_me, coalesce(nullif(btrim(p_title), ''), 'Untitled design'), coalesce(p_kind, 'presentation'),
          coalesce(p_width, 1920), coalesce(p_height, 1080), coalesce(p_content, '{"pages": []}'::jsonb), v_me)
  returning * into v_design;
  return make.summary(v_design, 'owner');
end $$;

-- One design with everything needed to edit it: its content, version, your role and who it is shared with.
create function public.make_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = make, public as $$
declare
  v_role text := make.require_role(p_id, 'viewer');
  v_design make.designs;
begin
  select * into v_design from make.designs where id = p_id;
  return make.summary(v_design, v_role) || jsonb_build_object(
    'content', v_design.content, 'version', v_design.version,
    'updatedBy', make.person(v_design.updated_by));
end $$;

-- Saves new content when nobody else saved in between (p_version is the version you loaded).
-- Otherwise PT409 with the current version in the details, so the app can reload and merge.
create function public.make_save(p_id uuid, p_version integer, p_content jsonb, p_title text default null) returns jsonb
language plpgsql security definer set search_path = make, public as $$
declare
  v_me uuid := make.require_me();
  v_current integer;
begin
  perform make.require_role(p_id, 'editor');
  if coalesce(jsonb_typeof(p_content -> 'pages'), '') <> 'array' then
    raise exception using errcode = 'PT400', message = 'That design could not be read.';
  end if;
  select version into v_current from make.designs where id = p_id for update;
  if v_current <> p_version then
    raise exception using errcode = 'PT409', message = 'Someone else changed this design. Your view was updated.', detail = v_current::text;
  end if;
  update make.designs
     set content = p_content,
         title = coalesce(nullif(btrim(p_title), ''), title),
         version = version + 1, updated_at = now(), updated_by = v_me
   where id = p_id;
  return jsonb_build_object('version', v_current + 1, 'updatedAt', now());
end $$;

create function public.make_rename(p_id uuid, p_title text) returns void
language plpgsql security definer set search_path = make, public as $$
begin
  perform make.require_role(p_id, 'editor');
  if nullif(btrim(p_title), '') is null then
    raise exception using errcode = 'PT400', message = 'Give the design a name.';
  end if;
  update make.designs set title = left(btrim(p_title), 200), updated_at = now(), updated_by = auth.uid() where id = p_id;
end $$;

create function public.make_resize(p_id uuid, p_width integer, p_height integer) returns void
language plpgsql security definer set search_path = make, public as $$
begin
  perform make.require_role(p_id, 'editor');
  if p_width not between 100 and 8000 or p_height not between 100 and 8000 then
    raise exception using errcode = 'PT400', message = 'Pages can be 100 to 8000 pixels on each side.';
  end if;
  update make.designs set width = p_width, height = p_height, updated_at = now(), updated_by = auth.uid()
   where id = p_id;
end $$;

-- A copy you own, of any design you can view.
create function public.make_duplicate(p_id uuid) returns jsonb
language plpgsql security definer set search_path = make, public as $$
declare
  v_me uuid := make.require_me();
  v_design make.designs;
begin
  perform make.require_role(p_id, 'viewer');
  insert into make.designs (owner_id, title, kind, width, height, content, updated_by)
  select v_me, left('Copy of ' || title, 200), kind, width, height, content, v_me from make.designs where id = p_id
  returning * into v_design;
  return make.summary(v_design, 'owner');
end $$;

-- Owners delete; people it was shared with leave it.
create function public.make_delete(p_id uuid) returns void
language plpgsql security definer set search_path = make, public, storage as $$
declare
  v_role text := make.require_role(p_id, 'viewer');
begin
  if v_role = 'owner' then
    delete from storage.objects where bucket_id = 'make-images' and (storage.foldername(name))[1] = p_id::text;
    delete from make.designs where id = p_id;
  else
    delete from make.shares where design_id = p_id and user_id = auth.uid();
  end if;
end $$;

-- -------------------------------------------------------------------- sharing

create function public.make_shares(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = make, public as $$
begin
  perform make.require_role(p_id, 'viewer');
  return coalesce((
    select jsonb_agg(make.person(s.user_id) || jsonb_build_object('role', s.role) order by s.created_at)
    from make.shares s where s.design_id = p_id), '[]'::jsonb);
end $$;

-- Shares with an ELUM account by its email (sign-in or verified address). Owners and editors may share.
create function public.make_share(p_id uuid, p_email text, p_role text default 'editor') returns jsonb
language plpgsql security definer set search_path = make, public, elum as $$
declare
  v_me uuid := make.require_me();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
  v_owner uuid;
begin
  perform make.require_role(p_id, 'editor');
  if p_role not in ('viewer', 'editor') then
    raise exception using errcode = 'PT400', message = 'People can view or edit.';
  end if;
  select owner_id into v_owner from make.designs where id = p_id;
  select id into v_user from public.profiles where lower(email) = v_email;
  if v_user is null and to_regclass('elum.addresses') is not null then
    select account_id into v_user from elum.addresses where address = v_email and verified_at is not null;
  end if;
  if v_user is null then
    raise exception using errcode = 'PT404', message = 'There is no ELUM account with that address yet.';
  end if;
  if v_user = v_owner then
    raise exception using errcode = 'PT400', message = 'That is the owner of this design.';
  end if;
  insert into make.shares (design_id, user_id, role, added_by) values (p_id, v_user, p_role, v_me)
  on conflict (design_id, user_id) do update set role = excluded.role;
  return make.person(v_user) || jsonb_build_object('role', p_role);
end $$;

create function public.make_unshare(p_id uuid, p_user uuid) returns void
language plpgsql security definer set search_path = make, public as $$
begin
  if p_user is distinct from auth.uid() then
    perform make.require_role(p_id, 'editor');
  end if;
  if exists (select 1 from make.designs where id = p_id and owner_id = p_user) then
    raise exception using errcode = 'PT400', message = 'The owner cannot be removed.';
  end if;
  delete from make.shares where design_id = p_id and user_id = p_user;
end $$;

-- People you could share with: ELUM accounts whose name or email starts with what you typed.
create function public.make_find_people(p_query text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := make.require_me();
  v_q text := lower(btrim(coalesce(p_query, '')));
begin
  if char_length(v_q) < 2 then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(make.person(p.id))
    from (select id from public.profiles
           where id <> v_me and coalesce(status, 'active') = 'active'
             and (lower(email) like v_q || '%' or lower(name) like v_q || '%' or lower(name) like '% ' || v_q || '%')
           order by name limit 8) p), '[]'::jsonb);
end $$;

-- ----------------------------------------------------------- notifications

-- "Ola shared “Pitch deck” with you" in every ELUM app's bell, linking to the design.
insert into elum.event_types (type, service_id, notify, description) values
  ('make.design.shared', 'make', true, 'Someone was given access to a design. Payload: {designId, title, role, notification}.')
on conflict (type) do nothing;

create function make.on_share() returns trigger
language plpgsql security definer set search_path = make, public, elum as $$
declare
  v_title text;
  v_actor_name text;
begin
  select title into v_title from make.designs where id = new.design_id;
  select name into v_actor_name from public.profiles where id = new.added_by;
  perform elum.emit('make.design.shared', new.added_by, new.user_id,
    jsonb_build_object('designId', new.design_id, 'title', v_title, 'role', new.role,
      'notification', jsonb_build_object(
        'title', coalesce(v_actor_name, 'Someone') || ' shared “' || coalesce(v_title, 'a design') || '” with you',
        'body', 'You can ' || case new.role when 'viewer' then 'view' else 'edit' end || ' it in Make.',
        'link', '/m/' || new.design_id)),
    'make:design:' || new.design_id);
  return new;
end $$;

create trigger shares_notify
  after insert on make.shares
  for each row when (new.added_by is distinct from new.user_id)
  execute function make.on_share();

-- Make is open (beta), so accounts can join it (elum_join_service) and the app switcher shows it.
update elum.services set status = 'beta', url = coalesce(url, 'https://elummake.netlify.app')
 where id = 'make' and status = 'planned';

-- -------------------------------------------------------------- picture uploads

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('make-images', 'make-images', false, 15728640, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do nothing;

-- Files live at <design id>/<file>. Viewers read them; editors add and remove them.
create policy "make images: people who can view the design read them" on storage.objects
  for select to authenticated
  using (bucket_id = 'make-images' and make.my_role(((storage.foldername(name))[1])::uuid) is not null);
create policy "make images: editors add them" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'make-images' and make.my_role(((storage.foldername(name))[1])::uuid) in ('owner', 'editor'));
create policy "make images: editors remove them" on storage.objects
  for delete to authenticated
  using (bucket_id = 'make-images' and make.my_role(((storage.foldername(name))[1])::uuid) in ('owner', 'editor'));

grant usage on schema make to authenticated;
grant execute on function make.my_role(uuid) to authenticated;

-- ------------------------------------------------------------------ grants

revoke all on function public.make_list(), public.make_create(text, text, integer, integer, jsonb), public.make_get(uuid),
  public.make_save(uuid, integer, jsonb, text), public.make_rename(uuid, text), public.make_resize(uuid, integer, integer),
  public.make_duplicate(uuid), public.make_delete(uuid), public.make_shares(uuid), public.make_share(uuid, text, text),
  public.make_unshare(uuid, uuid), public.make_find_people(text) from public, anon;
grant execute on function public.make_list(), public.make_create(text, text, integer, integer, jsonb), public.make_get(uuid),
  public.make_save(uuid, integer, jsonb, text), public.make_rename(uuid, text), public.make_resize(uuid, integer, integer),
  public.make_duplicate(uuid), public.make_delete(uuid), public.make_shares(uuid), public.make_share(uuid, text, text),
  public.make_unshare(uuid, uuid), public.make_find_people(text) to authenticated;
