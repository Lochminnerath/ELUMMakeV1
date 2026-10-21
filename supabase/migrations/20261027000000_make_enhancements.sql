-- ELUM Make Enhancements Migration
-- Creates tables and RPC functions in the `make` schema for:
-- version history, comments, annotations, brand kits, templates, search, favorites

create schema if not exists make;

-- ------------------------------------------------------------------ tables

-- 1. Design versions (for version history and restore)
create table make.design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references make.designs (id) on delete cascade,
  version integer not null,
  title text,
  user_id uuid references public.profiles (id),
  saved_at timestamptz not null default now(),
  preview text,
  unique (design_id, version)
);
create index design_versions_design_idx on make.design_versions (design_id);

-- 2. Comments (threaded comments on designs)
create table make.comments (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references make.designs (id) on delete cascade,
  user_id uuid references public.profiles (id),
  body text not null,
  parent_id uuid references make.comments (id),
  position jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_design_idx on make.comments (design_id);
create index comments_parent_idx on make.comments (parent_id);

-- 3. Annotations (position-based design annotations)
create table make.annotations (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references make.designs (id) on delete cascade,
  user_id uuid references public.profiles (id),
  page_number integer not null,
  x double precision not null,
  y double precision not null,
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index annotations_design_idx on make.annotations (design_id);

-- 4. Brand kits (colors, fonts, logos)
create table make.brand_kits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  assets jsonb not null default '{"colors": [], "fonts": []}'::jsonb,
  is_public boolean not null default false,
  user_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brand_kits_user_idx on make.brand_kits (user_id);

-- 5. Design templates (reusable templates)
create table make.design_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default '',
  kind text not null default 'presentation',
  width integer not null default 1920,
  height integer not null default 1080,
  thumbnail text,
  content jsonb,
  is_public boolean not null default false,
  user_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index templates_category_idx on make.design_templates (category);
create index templates_user_idx on make.design_templates (user_id);

-- 6. Favorites (user's favorite designs)
create table make.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  design_id uuid not null references make.designs (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, design_id)
);
create index favorites_user_idx on make.favorites (user_id);

-- 7. Extensions to designs table (tags and view count)
alter table make.designs add column if not exists tags text[] default '{}';
alter table make.designs add column if not exists view_count integer default 0;

-- ------------------------------------------------------------------ RPC functions

-- 1. Get version history for a design
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

-- 2. Get comments for a design (with replies)
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

-- 3. Get annotations for a design
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

-- 4. Get brand kits for a user (or public ones)
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

-- 5. Get public templates (optionally filtered by category)
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

-- 6. Search designs by tags
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

-- 7. Get favorites for a user
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

-- 8. Toggle favorite
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

-- 9. Increment view count
create or replace function make.increment_view_count(p_design_id uuid)
returns void
language plpgsql security definer set search_path = make, public
as $$
begin
  update make.designs set view_count = coalesce(view_count, 0) + 1 where id = p_design_id;
end;
$$;

-- 10. Save design as template
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
