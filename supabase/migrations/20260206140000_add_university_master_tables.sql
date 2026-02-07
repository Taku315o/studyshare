-- Master tables for university/faculty/department filters
CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.faculties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, name)
);

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id UUID NOT NULL REFERENCES public.faculties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (faculty_id, name)
);

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "universities select all" ON public.universities;
CREATE POLICY "universities select all" ON public.universities
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "faculties select all" ON public.faculties;
CREATE POLICY "faculties select all" ON public.faculties
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "departments select all" ON public.departments;
CREATE POLICY "departments select all" ON public.departments
  FOR SELECT USING (true);

-- Bootstrap master tables from existing assignments
WITH uni AS (
  SELECT DISTINCT trim(university) AS name
  FROM public.assignments
  WHERE university IS NOT NULL AND trim(university) <> ''
)
INSERT INTO public.universities (name)
SELECT name FROM uni
ON CONFLICT (name) DO NOTHING;

WITH pairs AS (
  SELECT DISTINCT trim(university) AS university, trim(faculty) AS faculty
  FROM public.assignments
  WHERE university IS NOT NULL AND trim(university) <> ''
    AND faculty IS NOT NULL AND trim(faculty) <> ''
)
INSERT INTO public.faculties (university_id, name)
SELECT u.id, p.faculty
FROM pairs p
JOIN public.universities u ON u.name = p.university
ON CONFLICT (university_id, name) DO NOTHING;

WITH triples AS (
  SELECT DISTINCT
    trim(university) AS university,
    trim(faculty) AS faculty,
    trim(department) AS department
  FROM public.assignments
  WHERE university IS NOT NULL AND trim(university) <> ''
    AND faculty IS NOT NULL AND trim(faculty) <> ''
    AND department IS NOT NULL AND trim(department) <> ''
)
INSERT INTO public.departments (faculty_id, name)
SELECT f.id, t.department
FROM triples t
JOIN public.universities u ON u.name = t.university
JOIN public.faculties f ON f.university_id = u.id AND f.name = t.faculty
ON CONFLICT (faculty_id, name) DO NOTHING;

-- Filtered search function (text + dropdowns)
CREATE OR REPLACE FUNCTION public.search_assignments_filtered(
  search_query TEXT,
  university_filter TEXT,
  faculty_filter TEXT,
  department_filter TEXT
)
RETURNS SETOF public.assignments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.assignments
  WHERE
    (
      search_query IS NULL OR search_query = '' OR
      to_tsvector('simple', title || ' ' || description) @@ plainto_tsquery('simple', search_query)
      OR title ILIKE '%' || search_query || '%'
      OR description ILIKE '%' || search_query || '%'
    )
    AND (university_filter IS NULL OR university_filter = '' OR university = university_filter)
    AND (faculty_filter IS NULL OR faculty_filter = '' OR faculty = faculty_filter)
    AND (department_filter IS NULL OR department_filter = '' OR department = department_filter)
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_assignments_filtered(TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated, service_role;
