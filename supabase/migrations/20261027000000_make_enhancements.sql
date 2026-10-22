-- ELUM Make Enhancements Migration
-- Creates tables and RPC functions in the `make` schema for:
-- Base operations (list, create, get, save, share, etc.) + Enhanced features
-- (version history, comments, annotations, brand kits, templates, search, favorites)

create schema if not exists make;

-- ------------------------------------------------------------------ Base RPC Functions

-- 1. List designs visible to the current user
create or replace function make.make_list()
returns jsonb
language plpgsql security definer set search_path = make, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'kind', d.kind,
      'width', d.width,
      'height', d.height,
      'role', case when d.owner_id = v_user_id then 'owner' else s.role end,
      'owner', jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'email', p.email,
        'color', p.color
      ),
      'createdAt', d.created_at,
      'updatedAt', d.updated_at,
      'pageCount', jsonb_array_length(d.content->'pages'),
      'cover', (d.content->'pages'->0)::text
    )
  ), '[]'::jsonb) into v_result
  from make.designs d
  left join make.shares s on s.design_id = d.id and s.user_id = v_user_id
  left join public.profiles p on p.id = d.owner_id
  where d.owner_id = v_user_id or s.user_id = v_user_id
  order by d.updated_at desc;
  return v_result;
end;
$$;

-- 2. Create a design
create or replace function make.make_create(
  p_title text,
  p_kind text default 'presentation',
  p_width integer default 1920,
  p_height integer default 1080,
  p_content jsonb default '{"pages": []}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = make, public
as $$
declare
  v_new_design make.designs%rowtype;
  v_result jsonb;
begin
  insert into make.designs (owner_id, title, kind, width, height, content)
  values (auth.uid(), p_title, p_kind, p_width, p_height, p_content)
  returning * into v_new_design;
  
  select jsonb_build_object(
    'id', v_new_design.id,
    'title', v_new_design.title,
    'kind', v_new_design.kind,
    'width', v_new_design.width,
    'height', v_new_design.height,
    'role', 'owner',
    'owner', jsonb_build_object(
      'id', v_new_design.owner_id,
      'name', (select name from public.profiles where id = v_new_design.owner_id),
      'email', (select email from public.profiles where id = v_new_design.owner_id),
      'color', (select color from public.profiles where id = v_new_design.owner_id)
    ),
    'createdAt', v_new_design.created_at,
    'updatedAt', v_new_design.updated_at,
    'pageCount', jsonb_array_length(v_new_design.content->'pages'),
    'cover', (v_new_design.content->'pages'->0)::text
  ) into v_result;
  return v_result;
end;
$$;

-- 3. Get a design (with role)
create or replace function make.make_get(p_id uuid) returns jsonb
language plpgsql security definer set search_path = make, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_design make.designs%rowtype;
  v_share make.shares%rowtype;
  v_result jsonb;
begin
  select * into v_design from make.designs where id = p_id;
  if not found then
    raise exception 'PT404' using errcode = 'PT404', message = 'Design not found';
  end if;
  
  select * into v_share from make.shares where design_id = p_id and user_id = v_user_id;
  
  select jsonb_build_object(
    'id', v_design.id,
    'title', v_design.title,
    'kind', v_design.kind,
    'width', v_design.width,
    'height', v_design.height,
    'role', case when v_design.owner_id = v_user_id then 'owner' else coalesce(v_share.role, 'viewer') end,
    'owner', jsonb_build_object(
      'id', v_design.owner_id,
      'name', (select name from public.profiles where id = v_design.owner_id),
      'email', (select email from public.profiles where id = v_design.owner_id),
      'color', (select color from public.profiles where id = v_design.owner_id)
    ),
    'createdAt', v_design.created_at,
    'updatedAt', v_design.updated_at,
    'version', v_design.version,
    'content', v_design.content,
    'updatedBy', jsonb_build_object(
      'id', v_design.updated_by,
      'name', (select name from public.profiles where id = v_design.updated_by)
    ) filter (v_design.updated_by is not null),
    'pageCount', jsonb_array_length(v_design.content->'pages'),
    'cover', (v_design.content->'pages'->0)::text
  ) into v_result;
  
  return v_result;
end;
$$;

-- 4. Save a design
create or replace function make.make_save(
  p_id uuid,
  p_version integer,
  p_content jsonb,
  p_title text default null
) returns jsonb
language plpgsql security definer set search_path = make, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_design make.designs%rowtype;
  v_role text;
  v_result jsonb;
begin
  select * into v_design from make.designs where id = p_id;
  if not found then
    raise exception 'PT404' using errcode = 'PT404', message = 'Design not found';
  end if;
  
  if v_design.owner_id = v_user_id then
    v_role := 'owner';
  else
    select role into v_role from make.shares where design_id = p_id and user_id = v_user_id;
  end if;
  
  if v_role is null or v_role = 'viewer' then
    raise exception 'PT403' using errcode = 'PT403', message = 'Viewer cannot save';
  end if;
  
  if v_design.version != p_version then
    raise exception 'PT409' using errcode = 'PT409', message = 'Stale save';
  end if;
  
  update make.designs
  set content = p_content,
      title = coalesce(p_title, title),
      version = version + 1,
      updated_at = now(),
      updated_by = v_user_id
  where id = p_id;
  
  select jsonb_build_object(
    'version', version,
    'updatedAt', updated_at
  ) into v_result
  from make.designs where id = p_id;
  
  return v_result;
end;
$$;

-- 5. Share a design
create or replace function make.make_share(
  p_id uuid,
  p_email text,
  p_role text default 'viewer'
) returns jsonb
language plpgsql security definer set search_path = make, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_design make.designs%rowtype;
  v_owner public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_result jsonb;
begin
  select * into v_design from make.designs where id = p_id;
  if not found then
    raise exception 'PT404' using errcode = 'PT404', message = 'Design not found';
  end if;
  
  select * into v_owner from public.profiles where id = v_design.owner_id;
  if v_owner.id != v_user_id then
    -- Check if user has editor role
    select role into v_role from make.shares where design_id = p_id and user_id = v_user_id;
    if v_role is null or v_role != 'editor' then
      raise exception 'PT403' using errcode = 'PT403', message = 'Cannot share';
    end if;
  end if;
  
  if p_role not in ('viewer', 'editor') then
    raise exception 'PT400' using errcode = 'PT400', message = 'Invalid role';
  end if;
  
  select * into v_target from public.profiles 
  where lower(email) = lower(p_email);
  if not found then
    raise exception 'PT404' using errcode = 'PT404', message = 'User not found';
  end if;
  
  if v_target.id = v_design.owner_id then
    raise exception 'PT400' using errcode = 'PT400', message = 'Cannot share with owner';
  end if;
  
  insert into make.shares (design_id, user_id, role)
  values (p_id, v_target.id, p_role)
  on conflict (design_id, user_id) do update set role = p_role;
  
  -- Create notification
  insert into elum.notifications (account_id, type, link, created_at)
  values (v_target.id, 'make.design.shared', '/m/' || p_id, now());
  
  select jsonb_build_object(
    'id', v_target.id,
    'name', v_target.name,
    'email', v_target.email,
    'color', v_target.color,
    'role', p_role
  ) into v_result;
  
  return v_result;
end;
$$;

-- 6. List shares for a design
create or replace function make.make_shares(p_id uuid) returns jsonb
language plpgsql security definer set search_path = make, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_design make.designs%rowtype;
  v_result jsonb;
begin
  select * into v_design from make.designs where id = p_id;
  if not found then
    raise exception 'PT404' using errcode = 'PT404', message = 'Design not found';
  end if;
  
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.user_id,
      'name', p.name,
      'email', p.email,
      'color', p.color,
      'role', s.role
    )
  ), '[]'::jsonb) into v_result
  from make.shares s
  join public.profiles p on p.id = s.user_id
  where s.design_id = p_id and (v_design.owner_id = v_user_id or s.user_id = v_user_id);
  
  return v_result;
end;
$$;

-- 7. Find people to share with
create or replace function make.make_find_people(p_query text) returns jsonb
language plpgsql security definer set search_path = make, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if char_length(trim(p_query)) < 2 then
    return '[]'::jsonb;
  end if;
  
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'email', p.email,
      'color', p.color
    )
  ), '[]'::jsonb) into v_result
  from public.profiles p
  where p.id != v_user_id and (
    lower(p.name) like lower('%' || trim(p_query) || '%') or
    lower(p.email) like lower('%' || trim(p_query) || '%')
  )
  limit 8;
  
  return v_result;
end;
$$;

-- 8. Duplicate a design
create or replace function make.make_duplicate(p_id uuid) returns jsonb
language plpgsql security definer set search_path = make, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_original make.designs%rowtype;
  v_new_design make.designs%rowtype;
  v_result jsonb;
begin
  select * into v_original from make.designs where id = p_id;
  if not found then
    raise exception 'PT404' using errcode = 'PT404', message = 'Design not found';
  end if;
  
  -- Check access
  if v_original.owner_id != v_user_id then
    select role into v_role from make.shares where design_id = p_id and user_id = v_user_id;
    if v_role is null then
      raise exception 'PT404' using errcode = 'PT404', message = 'Design not found';
    end if;
  end if;
  
  insert into make.designs (owner_id, title, kind, width, height, content)
  values (v_user_id, 'Copy of ' || v_original.title, v_original.kind, v_original.width, v_original.height, v_original.content)
  returning * into v_new_design;
  
  select jsonb_build_object(
    'id', v_new_design.id,
    'title', v_new_design.title,
    'kind', v_new_design.kind,
    'width', v_new_design.width,
    'height', v_new_design.height,
    'role', 'owner',
    'owner', jsonb_build_object(
      'id', v_new_design.owner_id,
      'name', (select name from public.profiles where id = v_new_design.owner_id),
      'email', (select email from public.profiles where id = v_new_design.owner_id),
      'color', (select color from public.profiles where id = v_new_design.owner_id)
    ),
    'createdAt', v_new_design.created_at,
    'updatedAt', v_new_design.updated_at,
    'pageCount', jsonb_array_length(v_new_design.content->'pages'),
    'cover', (v_new_design.content->'pages'->0)::text
  ) into v_result;
  
  return v_result;
end;
$$;

-- 9. Rename a design
create or replace function make.make_rename(p_id uuid, p_title text) returns void
language plpgsql security definer set search_path = make, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_design make.designs%rowtype;
  v_role text;
begin
  select * into v_design from make.designs where id = p_id;
  if not found then
    raise exception 'PT404' using errcode = 'PT404', message = 'Design not found';
  end if;
  
  if v_design.owner_id = v_user_id then
    v_role := 'owner';
  else
    select role into v_role from make.shares where design_id = p_id and user_id = v_user_id;
  end if;
  
  if v_role is null or v_role = 'viewer' then
    raise exception 'PT403' using errcode = 'PT403', message = 'Cannot rename';
  end if;
  
  if char_length(trim(p_title)) = 0 then
    raise exception 'PT400' using errcode = 'PT400', message = 'Name cannot be empty';
  end if;
  
  update make.designs
  set title = trim(p_title),
      updated_at = now(),
      updated_by = v_user_id
  where id = p_id;
end;
$$;

-- 10. Resize a design
create or replace function make.make_resize(p_id uuid, p_width integer, p_height integer) returns void
language plpgsql security definer set search_path = make, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_design make.designs%rowtype;
  v_role text;
begin
  select * into v_design from make.designs where id = p_id;
  if not found then
    raise exception 'PT404' using errcode = 'PT404', message = 'Design not found';
  end if;
  
  if v_design.owner_id = v_user_id then
    v_role := 'owner';
  else
    select role into v_role from make.shares where design_id = p_id and user_id = v_user_id;
  end if;
  
  if v_role is null or v_role = 'viewer' then
    raise exception 'PT403' using errcode = 'PT403', message = 'Cannot resize';
  end if;
  
  if p_width < 100 or p_width > 8000 or p_height < 100 or p_height > 8000 then
    raise exception 'PT400' using errcode = 'PT400', message = 'Sensible sizes only';
  end if;
  
  update make.designs
  set width = p_width,
      height = p_height,
      updated_at = now(),
      updated_by = v_user_id
  where id = p_id;
end;
$$;

-- 11. Unshare a design
create or replace function make.make_unshare(p_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = make, public
as $$
declare
  v_current_user uuid := auth.uid();
  v_design make.designs%rowtype;
begin
  select * into v_design from make.designs where id = p_id;
  if not found then
    raise exception 'PT404' using errcode = 'PT404', message = 'Design not found';
  end if;
  
  if v_design.owner_id = p_user_id then
    raise exception 'PT400' using errcode = 'PT400', message = 'Cannot remove owner';
  end if;
  
  delete from make.shares where design_id = p_id and user_id = p_user_id;
end;
$$;

-- 12. Delete a design (owner deletes; shared users leave)
create or replace function make.make_delete(p_id uuid) returns void
language plpgsql security definer set search_path = make, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_design make.designs%rowtype;
  v_role text;
begin
  select * into v_design from make.designs where id = p_id;
  if not found then
    raise exception 'PT404' using errcode = 'PT404', message = 'Design not found';
  end if;
  
  if v_design.owner_id = v_user_id then
    -- Owner deletes the design
    delete from make.designs where id = p_id;
  else
    -- Shared user leaves
    delete from make.shares where design_id = p_id and user_id = v_user_id;
  end if;
end;
$$;

-- ------------------------------------------------------------------ Enhanced RPC Functions

-- 13. Get version history for a design
create or replace function make.get_design_versions(p_design_id uuid)
returns table (
  id uuid,
  version integer,
  title text,
  saved_by_id uuid,
  saved_by_name text,
  saved_by_email text,
  saved_by_color text,
  saved_at timestamptz,
  preview text
)
language plpgsql security definer set search_path = make, public
as $$
begin
  return query
  select
    dv.id,
    dv.version,
    dv.title,
    u.id,
    u.name,
    u.email,
    u.color,
    dv.saved_at,
    dv.preview
  from make.design_versions dv
  left join public.profiles u on u.id = dv.user_id
  where dv.design_id = p_design_id
  order by dv.version desc;
end;
$$;

-- 14. Get comments for a design (with replies)
create or replace function make.get_design_comments(p_design_id uuid)
returns table (
  id uuid,
  body text,
  position jsonb,
  resolved boolean,
  user_id uuid,
  user_name text,
  user_email text,
  user_color text,
  created_at timestamptz,
  updated_at timestamptz,
  replies jsonb
)
language plpgsql security definer set search_path = make, public
as $$
begin
  return query
  select
    c.id,
    c.body,
    c.position,
    c.resolved,
    u.id,
    u.name,
    u.email,
    u.color,
    c.created_at,
    c.updated_at,
    jsonb_agg(
      jsonb_build_object(
        'id', rc.id,
        'body', rc.body,
        'user_name', ru.name,
        'created_at', rc.created_at
      )
    ) filter (where rc.id is not null) as replies
  from make.comments c
  left join public.profiles u on u.id = c.user_id
  left join make.comments rc on rc.parent_id = c.id
  left join public.profiles ru on ru.id = rc.user_id
  where c.design_id = p_design_id and c.parent_id is null
  group by c.id, c.body, c.position, c.resolved, u.id, u.name, u.email, u.color, c.created_at, c.updated_at
  order by c.created_at;
end;
$$;

-- 15. Get annotations for a design
create or replace function make.get_design_annotations(p_design_id uuid)
returns table (
  id uuid,
  page_number integer,
  x double precision,
  y double precision,
  body text,
  resolved boolean,
  user_id uuid,
  user_name text,
  user_email text,
  user_color text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql security definer set search_path = make, public
as $$
begin
  return query
  select
    a.id,
    a.page_number,
    a.x,
    a.y,
    a.body,
    a.resolved,
    u.id,
    u.name,
    u.email,
    u.color,
    a.created_at,
    a.updated_at
  from make.annotations a
  left join public.profiles u on u.id = a.user_id
  where a.design_id = p_design_id
  order by a.created_at;
end;
$$;

-- 16. Get brand kits for a user (or public ones)
create or replace function make.get_user_brand_kits(p_user_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  assets jsonb,
  is_public boolean,
  updated_at timestamptz,
  owner_id uuid,
  owner_name text,
  owner_email text
)
language plpgsql security definer set search_path = make, public
as $$
begin
  return query
  select
    bk.id,
    bk.name,
    bk.description,
    bk.assets,
    bk.is_public,
    bk.updated_at,
    u.id,
    u.name,
    u.email
  from make.brand_kits bk
  left join public.profiles u on u.id = bk.user_id
  where bk.user_id = p_user_id or bk.is_public
  order by bk.updated_at desc;
end;
$$;

-- 17. Get public templates (optionally filtered by category)
create or replace function make.get_public_templates(p_category text default '')
returns table (
  id uuid,
  title text,
  description text,
  category text,
  kind text,
  width integer,
  height integer,
  thumbnail text,
  updated_at timestamptz,
  owner_id uuid,
  owner_name text,
  owner_email text
)
language plpgsql security definer set search_path = make, public
as $$
begin
  return query
  select
    dt.id,
    dt.title,
    dt.description,
    dt.category,
    dt.kind,
    dt.width,
    dt.height,
    dt.thumbnail,
    dt.updated_at,
    u.id,
    u.name,
    u.email
  from make.design_templates dt
  left join public.profiles u on u.id = dt.user_id
  where dt.is_public and (p_category = '' or dt.category = p_category)
  order by dt.updated_at desc;
end;
$$;

-- 18. Search designs by tags
create or replace function make.search_designs_by_tags(p_tags text[], p_kind text default '')
returns table (
  id uuid,
  title text,
  kind text,
  width integer,
  height integer,
  role text,
  owner_id uuid,
  owner_name text,
  owner_email text,
  owner_color text,
  created_at timestamptz,
  updated_at timestamptz,
  page_count integer,
  cover text,
  tags text[],
  view_count integer
)
language plpgsql security definer set search_path = make, public
as $$
begin
  return query
  select
    d.id,
    d.title,
    d.kind,
    d.width,
    d.height,
    case
      when d.owner_id = current_setting('app.current_user_id', true) then 'owner'
      else coalesce((select role from make.shares where design_id = d.id and user_id = current_setting('app.current_user_id', true))::text, null)
    end,
    u.id,
    u.name,
    u.email,
    u.color,
    d.created_at,
    d.updated_at,
    (select array_length(d.content::jsonb->'pages', 1) from jsonb_array_elements(d.content::jsonb->'pages')),
    (d.content::jsonb->'pages'->0)::text,
    d.tags,
    d.view_count
  from make.designs d
  left join public.profiles u on u.id = d.owner_id
  where d.tags && p_tags and (p_kind = '' or d.kind = p_kind)
  order by d.updated_at desc;
end;
$$;

-- 19. Get favorites for a user
create or replace function make.get_user_favorites(p_user_id uuid)
returns table (
  id uuid,
  design_id uuid,
  created_at timestamptz
)
language plpgsql security definer set search_path = make, public
as $$
begin
  return query
  select
    f.id,
    f.design_id,
    f.created_at
  from make.favorites f
  where f.user_id = p_user_id
  order by f.created_at desc;
end;
$$;

-- 20. Toggle favorite
create or replace function make.toggle_favorite(p_user_id uuid, p_design_id uuid, p_favorited boolean)
returns void
language plpgsql security definer set search_path = make, public
as $$
begin
  if p_favorited then
    insert into make.favorites (user_id, design_id) values (p_user_id, p_design_id)
    on conflict (user_id, design_id) do nothing;
  else
    delete from make.favorites where user_id = p_user_id and design_id = p_design_id;
  end if;
end;
$$;

-- 21. Increment view count
create or replace function make.increment_view_count(p_design_id uuid)
returns void
language plpgsql security definer set search_path = make, public
as $$
begin
  update make.designs set view_count = coalesce(view_count, 0) + 1 where id = p_design_id;
end;
$$;

-- 22. Save design as template
create or replace function make.save_as_template(
  p_design_id uuid,
  p_title text,
  p_description text default '',
  p_category text default '',
  p_user_id uuid
) returns uuid
language plpgsql security definer set search_path = make, public
as $$
declare
  v_new_template_id uuid;
  v_design_content jsonb;
begin
  select content into v_design_content from make.designs where id = p_design_id;
  insert into make.design_templates (title, description, category, kind, width, height, content, user_id)
  values (p_title, p_description, p_category,
          (select kind from make.designs where id = p_design_id),
          (select width from make.designs where id = p_design_id),
          (select height from make.designs where id = p_design_id),
          v_design_content,
          p_user_id)
  returning id into v_new_template_id;
  return v_new_template_id;
end;
$$;
