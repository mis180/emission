-- Run this in Supabase Dashboard -> SQL Editor

-- 1. Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    full_name   TEXT,
    company     TEXT,
    role        TEXT DEFAULT 'engineer',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    last_login  TIMESTAMPTZ,
    preferences JSONB DEFAULT '{}'::JSONB
);

-- 2. Projects
CREATE TABLE public.projects (
    id              TEXT PRIMARY KEY,  -- using text to match your "proj_123" format
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name            TEXT NOT NULL DEFAULT 'Новый проект',
    company         TEXT DEFAULT '',
    license         TEXT DEFAULT '',
    date_created    DATE DEFAULT CURRENT_DATE,
    date_modified   TIMESTAMPTZ DEFAULT NOW(),
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    schema_version  INT DEFAULT 2,
    status          TEXT DEFAULT 'draft',
    geo_meteo       JSONB DEFAULT '{}'::JSONB -- keeping this as JSONB to avoid over-complicating right now
);

-- 3. Facilities
CREATE TABLE public.facilities (
    id              TEXT PRIMARY KEY,  -- using text to match your "fac_123" format
    project_id      TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name            TEXT NOT NULL DEFAULT 'Новый объект',
    type            TEXT DEFAULT 'other',
    address         TEXT DEFAULT '',
    description     TEXT DEFAULT '',
    phase           TEXT DEFAULT 'operation',
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    boundary        JSONB,
    sanitary_zone   JSONB,
    sort_order      INT DEFAULT 0
);

-- 4. Emission Sources
CREATE TABLE public.sources (
    id              TEXT PRIMARY KEY, -- standardising as text
    facility_id     TEXT NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    name            TEXT,
    source_number   TEXT,
    methodic_id     TEXT,
    methodic_name   TEXT,
    source_type     TEXT,
    calc_method     TEXT,
    category        TEXT DEFAULT 'operation',
    formula_code    TEXT,
    inputs          JSONB DEFAULT '{}'::JSONB,
    results         JSONB DEFAULT '{}'::JSONB,
    composition     JSONB DEFAULT '[]'::JSONB,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    elevation       DOUBLE PRECISION,
    m_value         DOUBLE PRECISION,  -- Annual emissions (t/yr)
    g_value         DOUBLE PRECISION,  -- Max emissions (g/s)
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Calculation History (audit trail)
CREATE TABLE public.calculations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       TEXT NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
    calculated_at   TIMESTAMPTZ DEFAULT NOW(),
    input_snapshot  JSONB NOT NULL,
    result_snapshot JSONB NOT NULL,
    engine_version  TEXT DEFAULT '1.0.0'
);

-- Row-Level Security (users see ONLY their own data)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own projects" ON public.projects
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users see own facilities" ON public.facilities
    FOR ALL USING (
        project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
    );

CREATE POLICY "Users see own sources" ON public.sources
    FOR ALL USING (
        facility_id IN (
            SELECT f.id FROM public.facilities f
            JOIN public.projects p ON f.project_id = p.id
            WHERE p.user_id = auth.uid()
        )
    );

-- Create profile automatically when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
