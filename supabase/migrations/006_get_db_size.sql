CREATE OR REPLACE FUNCTION get_db_size()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', COALESCE(
      (SELECT SUM((metadata->>'size')::bigint) FROM storage.objects),
      0
    )
  );
$$;
