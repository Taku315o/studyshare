CREATE OR REPLACE FUNCTION search_assignments(search_query TEXT) -- ここで引数を受け取れるように設定
RETURNS SETOF assignments
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM assignments
  WHERE 
    title ILIKE '%' || search_query || '%' OR 
    description ILIKE '%' || search_query || '%'
  ORDER BY created_at DESC;
END;
$$;