-- ELUM Make: version history, comments and pins, brand kits, your own templates, tags, views and
-- favourites. Needs 20261025000000_make_schema.sql first.
--
-- Same rules as the rest of Make: the app calls only the public.make_* functions below, every one
-- checks who you are (auth.uid()) and your role on the design, and the tables stay closed.

-- ------------------------------------------------------------------ tables

-- Earlier versions of a design. Autosave runs often, so a snapshot is kept at most every
-- 2 minutes, and only the newest 50 per design.
create table make.versions (
  design_id uuid not null references make.designs (id) on delete cascade,
  version integer not null,
  title text not null,
  content jsonb not null,
  saved_by uuid references public.profiles (id) on delete set null,
  saved_at timestamptz not null default now(),
  primary key (design_id, version)
);

-- Comments on a design. With a page and a point they are pins on the canvas.
create table make.comments (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references make.designs (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references make.comments (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  page integer check (page >= 0),
  x real,
  y real,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_design_idx on make.comments (design_id, created_at);

-- Your colours, fonts and logo, ready to use in any design.
create table make.brand_kits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text check (char_length(description) <= 500),
  colors jsonb not null default '[]' check (jsonb_typeof(colors) = 'array'),
  fonts jsonb not null default '[]' check (jsonb_typeof(fonts) = 'array'),
  logo text check (char_length(logo) <= 1000),
  updated_at timestamptz not null default now()
);
create index brand_kits_owner_idx on make.brand_kits (owner_id);

-- Designs you saved as a starting point for new ones.
create table make.templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 500),
  category text not null default 'mine' check (char_length(category) between 1 and 40),
  kind text not null,
  width integer not null,
  height integer not null,
  content jsonb not null,
  updated_at timestamptz not null default now()
);
create index templates_owner_idx on make.templates (owner_id, updated_at desc);

create table make.favorites (
  account_id uuid not null references public.profiles (id) on delete cascade,
  design_id uuid not null references make.designs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, design_id)
);

alter table make.designs
  add column tags text[] not null default '{}' check (cardinality(tags) <= 20),
  add column views integer not null default 0;
create index designs_tags_idx on make.designs using gin (tags);

alter table make.versions enable row level security;
alter table make.comments enable row level security;
alter table make.brand_kits enable row level security;
alter table make.templates enable row level security;
alter table make.favorites enable row level security;
revoke all on all tables in schema make from public, anon, authenticated;

-- ------------------------------------------------------------- history

create function make.keep_version() returns trigger
language plpgsql security definer set search_path = make, public as $$
begin
  if new.content is distinct from old.content and not exists (
    select 1 from make.versions v where v.design_id = old.id and v.saved_at > now() - interval '2 minutes'
  ) then
    insert into make.versions (design_id, version, title, content, saved_by)
    values (old.id, old.version, old.title, old.content, old.updated_by)
    on conflict do nothing;
    delete from make.versions v where v.design_id = old.id and v.version not in (
      select version from make.versions where design_id = old.id order by version desc limit 50);
  end if;
  return new;
end $$;

create trigger designs_keep_version before update of content on make.designs
for each row execute function make.keep_version();

create function public.make_versions(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = make, public as $$
begin
  perform make.require_role(p_id, 'viewer');
  return coalesce((
    select jsonb_agg(jsonb_build_object('version', v.version, 'title', v.title, 'savedBy', make.person(v.saved_by),
      'savedAt', v.saved_at, 'preview', v.content -> 'pages' -> 0) order by v.version desc)
    from make.versions v where v.design_id = p_id), '[]');
end $$;

-- Puts an earlier version back. The current one is kept in the history first, so this can be undone.
create function public.make_restore_version(p_id uuid, p_version integer) returns jsonb
language plpgsql security definer set search_path = make, public as $$
declare
  v_me uuid := make.require_me();
  v_old make.versions;
  v_new integer;
begin
  perform make.require_role(p_id, 'editor');
  select * into v_old from make.versions where design_id = p_id and version = p_version;
  if v_old.design_id is null then
    raise exception using errcode = 'PT404', message = 'That version is no longer kept.';
  end if;
  insert into make.versions (design_id, version, title, content, saved_by)
  select id, version, title, content, updated_by from make.designs where id = p_id
  on conflict do nothing;
  update make.designs set content = v_old.content, title = v_old.title, version = version + 1,
    updated_at = now(), updated_by = v_me
  where id = p_id returning version into v_new;
  return jsonb_build_object('version', v_new, 'updatedAt', now());
end $$;

-- ------------------------------------------------------------ comments

create function make.comment_json(c make.comments) returns jsonb
language plpgsql stable security definer set search_path = make, public as $$
begin
  return jsonb_build_object('id', c.id, 'body', c.body, 'resolved', c.resolved, 'user', make.person(c.author_id),
    'createdAt', c.created_at, 'updatedAt', c.updated_at,
    'position', case when c.page is null then null else jsonb_build_object('page', c.page, 'x', c.x, 'y', c.y) end,
    'replies', coalesce((select jsonb_agg(make.comment_json(r) order by r.created_at)
                         from make.comments r where r.parent_id = c.id), '[]'));
end $$;

-- Everyone who can see a design can read and add comments; viewers too.
create function public.make_comments(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = make, public as $$
begin
  perform make.require_role(p_id, 'viewer');
  return coalesce((select jsonb_agg(make.comment_json(c) order by c.created_at)
                   from make.comments c where c.design_id = p_id and c.parent_id is null), '[]');
end $$;

create function public.make_add_comment(p_id uuid, p_body text, p_parent uuid default null,
                                        p_page integer default null, p_x real default null, p_y real default null) returns jsonb
language plpgsql security definer set search_path = make, public as $$
declare
  v_me uuid := make.require_me();
  v_row make.comments;
begin
  perform make.require_role(p_id, 'viewer');
  if p_parent is not null and not exists (select 1 from make.comments where id = p_parent and design_id = p_id) then
    raise exception using errcode = 'PT404', message = 'That comment is no longer there.';
  end if;
  begin
    insert into make.comments (design_id, author_id, parent_id, body, page, x, y)
    values (p_id, v_me, p_parent, btrim(p_body), p_page, p_x, p_y) returning * into v_row;
  exception when check_violation then
    raise exception using errcode = 'PT400', message = 'Write a comment of up to 4000 characters.';
  end;
  return make.comment_json(v_row);
end $$;

-- The author, or anyone who can edit the design, can resolve a comment.
create function public.make_resolve_comment(p_comment uuid, p_resolved boolean) returns void
language plpgsql security definer set search_path = make, public as $$
declare
  v_me uuid := make.require_me();
  v_row make.comments;
begin
  select * into v_row from make.comments where id = p_comment;
  if v_row.id is null then
    raise exception using errcode = 'PT404', message = 'That comment is no longer there.';
  end if;
  if v_row.author_id <> v_me then
    perform make.require_role(v_row.design_id, 'editor');
  else
    perform make.require_role(v_row.design_id, 'viewer');
  end if;
  update make.comments set resolved = coalesce(p_resolved, true), updated_at = now() where id = p_comment;
end $$;

-- ---------------------------------------------------------- brand kits

create function make.kit_json(k make.brand_kits) returns jsonb
language sql stable security definer set search_path = make, public as $$
  select jsonb_build_object('id', k.id, 'name', k.name, 'description', k.description,
    'assets', jsonb_strip_nulls(jsonb_build_object('colors', k.colors, 'fonts', k.fonts, 'logo', k.logo)),
    'isPublic', false, 'updatedAt', k.updated_at, 'owner', make.person(k.owner_id))
$$;

create function public.make_brand_kits() returns jsonb
language sql stable security definer set search_path = make, public as $$
  select coalesce(jsonb_agg(make.kit_json(k) order by k.updated_at desc), '[]')
  from make.brand_kits k where k.owner_id = make.require_me()
$$;

create function public.make_brand_kit(p_kit uuid) returns jsonb
language plpgsql stable security definer set search_path = make, public as $$
declare
  v_row make.brand_kits;
begin
  select * into v_row from make.brand_kits where id = p_kit and owner_id = make.require_me();
  if v_row.id is null then
    raise exception using errcode = 'PT404', message = 'That brand kit is not in your account.';
  end if;
  return make.kit_json(v_row);
end $$;

-- New when p_kit is null; otherwise updates your own kit. At most 20 kits.
create function public.make_save_brand_kit(p_kit uuid, p_name text, p_description text default null,
                                           p_colors jsonb default '[]', p_fonts jsonb default '[]',
                                           p_logo text default null) returns jsonb
language plpgsql security definer set search_path = make, public as $$
declare
  v_me uuid := make.require_me();
  v_row make.brand_kits;
begin
  begin
    if p_kit is null then
      if (select count(*) from make.brand_kits where owner_id = v_me) >= 20 then
        raise exception using errcode = 'PT409', message = 'You have 20 brand kits already. Delete one first.';
      end if;
      insert into make.brand_kits (owner_id, name, description, colors, fonts, logo)
      values (v_me, btrim(p_name), p_description, coalesce(p_colors, '[]'), coalesce(p_fonts, '[]'), p_logo)
      returning * into v_row;
    else
      update make.brand_kits set name = btrim(p_name), description = p_description, colors = coalesce(p_colors, '[]'),
        fonts = coalesce(p_fonts, '[]'), logo = p_logo, updated_at = now()
      where id = p_kit and owner_id = v_me returning * into v_row;
      if v_row.id is null then
        raise exception using errcode = 'PT404', message = 'That brand kit is not in your account.';
      end if;
    end if;
  exception when check_violation then
    raise exception using errcode = 'PT400', message = 'Give the brand kit a name, and keep the description short.';
  end;
  return make.kit_json(v_row);
end $$;

-- ----------------------------------------------------------- templates

create function make.template_json(t make.templates) returns jsonb
language sql stable security definer set search_path = make, public as $$
  select jsonb_build_object('id', t.id, 'title', t.title, 'description', t.description, 'category', t.category,
    'kind', t.kind, 'width', t.width, 'height', t.height, 'thumbnail', null, 'isPublic', false,
    'updatedAt', t.updated_at, 'owner', make.person(t.owner_id), 'cover', t.content -> 'pages' -> 0)
$$;

-- Your own saved templates (Make's built-in ones live in the app).
create function public.make_templates(p_category text default null) returns jsonb
language sql stable security definer set search_path = make, public as $$
  select coalesce(jsonb_agg(make.template_json(t) order by t.updated_at desc), '[]')
  from make.templates t
  where t.owner_id = make.require_me() and (nullif(p_category, '') is null or t.category = p_category)
$$;

create function public.make_save_as_template(p_id uuid, p_title text, p_description text default null,
                                             p_category text default null) returns jsonb
language plpgsql security definer set search_path = make, public as $$
declare
  v_me uuid := make.require_me();
  v_row make.templates;
begin
  perform make.require_role(p_id, 'viewer');
  if (select count(*) from make.templates where owner_id = v_me) >= 100 then
    raise exception using errcode = 'PT409', message = 'You have 100 templates already. Delete one first.';
  end if;
  begin
    insert into make.templates (owner_id, title, description, category, kind, width, height, content)
    select v_me, btrim(p_title), p_description, coalesce(nullif(btrim(p_category), ''), 'mine'), d.kind, d.width, d.height, d.content
    from make.designs d where d.id = p_id returning * into v_row;
  exception when check_violation then
    raise exception using errcode = 'PT400', message = 'Give the template a name.';
  end;
  return make.template_json(v_row);
end $$;

-- A new design of your own, from one of your templates.
create function public.make_create_from_template(p_template uuid) returns jsonb
language plpgsql security definer set search_path = make, public as $$
declare
  v_t make.templates;
begin
  select * into v_t from make.templates where id = p_template and owner_id = make.require_me();
  if v_t.id is null then
    raise exception using errcode = 'PT404', message = 'That template is not in your account.';
  end if;
  return public.make_create(v_t.title, v_t.kind, v_t.width, v_t.height, v_t.content);
end $$;

-- ------------------------------------------------- tags, views, favourites

create function public.make_set_tags(p_id uuid, p_tags text[]) returns void
language plpgsql security definer set search_path = make, public as $$
begin
  perform make.require_role(p_id, 'editor');
  update make.designs set tags = (
    select coalesce(array_agg(distinct lower(btrim(t))), '{}') from unnest(p_tags) t
    where char_length(btrim(t)) between 1 and 40)
  where id = p_id;
exception when check_violation then
  raise exception using errcode = 'PT400', message = 'A design can have up to 20 tags.';
end $$;

-- Designs you can see with any of these tags.
create function public.make_tag_search(p_tags text[], p_kind text default null) returns jsonb
language plpgsql stable security definer set search_path = make, public as $$
declare
  v_me uuid := make.require_me();
  v_tags text[] := (select coalesce(array_agg(lower(btrim(t))), '{}') from unnest(p_tags) t);
begin
  return coalesce((
    select jsonb_agg(make.summary(d, make.role_of(d.id, v_me)) || jsonb_build_object('tags', d.tags) order by d.updated_at desc)
    from make.designs d
    where d.tags && v_tags and (nullif(p_kind, '') is null or d.kind = p_kind)
      and (d.owner_id = v_me or exists (select 1 from make.shares s where s.design_id = d.id and s.user_id = v_me))), '[]');
end $$;

create function public.make_view(p_id uuid) returns void
language plpgsql security definer set search_path = make, public as $$
begin
  perform make.require_role(p_id, 'viewer');
  update make.designs set views = views + 1 where id = p_id;
end $$;

create function public.make_favorites() returns jsonb
language sql stable security definer set search_path = make, public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', f.design_id, 'designId', f.design_id, 'createdAt', f.created_at)
                            order by f.created_at desc), '[]')
  from make.favorites f where f.account_id = make.require_me()
    and make.role_of(f.design_id, f.account_id) is not null
$$;

create function public.make_favorite(p_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = make, public as $$
declare
  v_me uuid := make.require_me();
begin
  perform make.require_role(p_id, 'viewer');
  if p_on then
    insert into make.favorites (account_id, design_id) values (v_me, p_id) on conflict do nothing;
  else
    delete from make.favorites where account_id = v_me and design_id = p_id;
  end if;
end $$;

-- ---------------------------------------------------------------- grants

revoke all on function make.keep_version(), make.comment_json(make.comments), make.kit_json(make.brand_kits),
  make.template_json(make.templates) from public;
revoke all on function public.make_versions(uuid), public.make_restore_version(uuid, integer), public.make_comments(uuid),
  public.make_add_comment(uuid, text, uuid, integer, real, real), public.make_resolve_comment(uuid, boolean),
  public.make_brand_kits(), public.make_brand_kit(uuid), public.make_save_brand_kit(uuid, text, text, jsonb, jsonb, text),
  public.make_templates(text), public.make_save_as_template(uuid, text, text, text), public.make_create_from_template(uuid),
  public.make_set_tags(uuid, text[]), public.make_tag_search(text[], text), public.make_view(uuid),
  public.make_favorites(), public.make_favorite(uuid, boolean) from public, anon;
grant execute on function public.make_versions(uuid), public.make_restore_version(uuid, integer), public.make_comments(uuid),
  public.make_add_comment(uuid, text, uuid, integer, real, real), public.make_resolve_comment(uuid, boolean),
  public.make_brand_kits(), public.make_brand_kit(uuid), public.make_save_brand_kit(uuid, text, text, jsonb, jsonb, text),
  public.make_templates(text), public.make_save_as_template(uuid, text, text, text), public.make_create_from_template(uuid),
  public.make_set_tags(uuid, text[]), public.make_tag_search(text[], text), public.make_view(uuid),
  public.make_favorites(), public.make_favorite(uuid, boolean) to authenticated;
