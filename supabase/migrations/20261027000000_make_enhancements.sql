-- ELUM Make Enhancements Migration
-- Adds: version history, comments, annotations, brand kits, templates, search, favorites

-- 1. Design versions table
CREATE TABLE IF NOT EXISTS design_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT,
  user_id UUID REFERENCES users(id),
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  preview TEXT,
  UNIQUE(design_id, version)
);

CREATE INDEX idx_design_versions_design ON design_versions(design_id);

-- 2. Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  body TEXT NOT NULL,
  parent_id UUID REFERENCES comments(id),
  position JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_design ON comments(design_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);

-- 3. Annotations table
CREATE TABLE IF NOT EXISTS annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  page_number INTEGER NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  body TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_annotations_design ON annotations(design_id);

-- 4. Brand kits table
CREATE TABLE IF NOT EXISTS brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  assets JSONB NOT NULL DEFAULT '{"colors": [], "fonts": []}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_brand_kits_user ON brand_kits(user_id);

-- 5. Design templates table
CREATE TABLE IF NOT EXISTS design_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'presentation',
  width INTEGER NOT NULL DEFAULT 1920,
  height INTEGER NOT NULL DEFAULT 1080,
  thumbnail TEXT,
  content JSONB,
  is_public BOOLEAN NOT NULL DEFAULT false,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_category ON design_templates(category);
CREATE INDEX idx_templates_user ON design_templates(user_id);

-- 6. Favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  design_id UUID REFERENCES designs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, design_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);

-- 7. Design tags (extension)
ALTER TABLE designs ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE designs ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- RPC: Get version history for a design
CREATE OR REPLACE FUNCTION get_design_versions(design_id_param UUID)
RETURNS TABLE (
  id UUID,
  version INTEGER,
  title TEXT,
  saved_by_id UUID,
  saved_by_name TEXT,
  saved_by_email TEXT,
  saved_by_color TEXT,
  saved_at TIMESTAMPTZ,
  preview TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dv.id,
    dv.version,
    dv.title,
    u.id,
    u.name,
    u.email,
    u.color,
    dv.saved_at,
    dv.preview
  FROM design_versions dv
  LEFT JOIN users u ON u.id = dv.user_id
  WHERE dv.design_id = design_id_param
  ORDER BY dv.version DESC;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get comments for a design
CREATE OR REPLACE FUNCTION get_design_comments(design_id_param UUID)
RETURNS TABLE (
  id UUID,
  body TEXT,
  position JSONB,
  resolved BOOLEAN,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  user_color TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  replies JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
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
    ) FILTER (WHERE rc.id IS NOT NULL) as replies
  FROM comments c
  LEFT JOIN users u ON u.id = c.user_id
  LEFT JOIN comments rc ON rc.parent_id = c.id
  LEFT JOIN users ru ON ru.id = rc.user_id
  WHERE c.design_id = design_id_param AND c.parent_id IS NULL
  GROUP BY c.id, c.body, c.position, c.resolved, u.id, u.name, u.email, u.color, c.created_at, c.updated_at
  ORDER BY c.created_at;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get annotations for a design
CREATE OR REPLACE FUNCTION get_design_annotations(design_id_param UUID)
RETURNS TABLE (
  id UUID,
  page_number INTEGER,
  x DOUBLE PRECISION,
  y DOUBLE PRECISION,
  body TEXT,
  resolved BOOLEAN,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  user_color TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
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
  FROM annotations a
  LEFT JOIN users u ON u.id = a.user_id
  WHERE a.design_id = design_id_param
  ORDER BY a.created_at;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get brand kits for a user
CREATE OR REPLACE FUNCTION get_user_brand_kits(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  assets JSONB,
  is_public BOOLEAN,
  updated_at TIMESTAMPTZ,
  owner_id UUID,
  owner_name TEXT,
  owner_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bk.id,
    bk.name,
    bk.description,
    bk.assets,
    bk.is_public,
    bk.updated_at,
    u.id,
    u.name,
    u.email
  FROM brand_kits bk
  LEFT JOIN users u ON u.id = bk.user_id
  WHERE bk.user_id = user_id_param OR bk.is_public
  ORDER BY bk.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get public templates
CREATE OR REPLACE FUNCTION get_public_templates(category_param TEXT DEFAULT '')
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  kind TEXT,
  width INTEGER,
  height INTEGER,
  thumbnail TEXT,
  updated_at TIMESTAMPTZ,
  owner_id UUID,
  owner_name TEXT,
  owner_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
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
  FROM design_templates dt
  LEFT JOIN users u ON u.id = dt.user_id
  WHERE dt.is_public AND (category_param = '' OR dt.category = category_param)
  ORDER BY dt.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- RPC: Search designs by tags
CREATE OR REPLACE FUNCTION search_designs_by_tags(tags_param TEXT[], kind_param TEXT DEFAULT '')
RETURNS TABLE (
  id UUID,
  title TEXT,
  kind TEXT,
  width INTEGER,
  height INTEGER,
  role TEXT,
  owner_id UUID,
  owner_name TEXT,
  owner_email TEXT,
  owner_color TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  page_count INTEGER,
  cover TEXT,
  tags TEXT[],
  view_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.kind,
    d.width,
    d.height,
    CASE 
      WHEN d.owner_id = current_setting('app.current_user_id', true) THEN 'owner'
      ELSE COALESCE((SELECT role FROM shares WHERE design_id = d.id AND user_id = current_setting('app.current_user_id', true))::text, null)
    END,
    u.id,
    u.name,
    u.email,
    u.color,
    d.created_at,
    d.updated_at,
    (SELECT array_length(d.content::jsonb->'pages', 1) FROM jsonb_array_elements(d.content::jsonb->'pages')),
    (d.content::jsonb->'pages'->0)::text,
    d.tags,
    d.view_count
  FROM designs d
  LEFT JOIN users u ON u.id = d.owner_id
  WHERE d.tags && tags_param AND (kind_param = '' OR d.kind = kind_param)
  ORDER BY d.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get favorites for a user
CREATE OR REPLACE FUNCTION get_user_favorites(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  design_id UUID,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.design_id,
    f.created_at
  FROM favorites f
  WHERE f.user_id = user_id_param
  ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- RPC: Toggle favorite
CREATE OR REPLACE FUNCTION toggle_favorite(user_id_param UUID, design_id_param UUID, favorited_param BOOLEAN)
RETURNS VOID AS $$
BEGIN
  IF favorited_param THEN
    INSERT INTO favorites (user_id, design_id) VALUES (user_id_param, design_id_param)
    ON CONFLICT (user_id, design_id) DO NOTHING;
  ELSE
    DELETE FROM favorites WHERE user_id = user_id_param AND design_id = design_id_param;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- RPC: Increment view count
CREATE OR REPLACE FUNCTION increment_view_count(design_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE designs SET view_count = COALESCE(view_count, 0) + 1 WHERE id = design_id_param;
END;
$$ LANGUAGE plpgsql;

-- RPC: Save design as template
CREATE OR REPLACE FUNCTION save_as_template(
  design_id_param UUID,
  title_param TEXT,
  description_param TEXT DEFAULT '',
  category_param TEXT DEFAULT '',
  user_id_param UUID
) RETURNS UUID AS $$
DECLARE
  new_template_id UUID;
  design_content JSONB;
BEGIN
  SELECT content INTO design_content FROM designs WHERE id = design_id_param;
  INSERT INTO design_templates (title, description, category, kind, width, height, content, user_id)
  VALUES (title_param, description_param, category_param, 
          (SELECT kind FROM designs WHERE id = design_id_param),
          (SELECT width FROM designs WHERE id = design_id_param),
          (SELECT height FROM designs WHERE id = design_id_param),
          design_content,
          user_id_param)
  RETURNING id INTO new_template_id;
  RETURN new_template_id;
END;
$$ LANGUAGE plpgsql;
