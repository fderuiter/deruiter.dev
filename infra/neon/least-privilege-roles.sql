-- Least-privilege roles for the production Neon database (#3036).
--
-- Create the two login roles from SQL first, as neondb_owner, each with a fresh
-- random password (openssl rand -base64 32):
--   CREATE ROLE app_runtime WITH LOGIN PASSWORD '<generated>';
--   CREATE ROLE backup_reader WITH LOGIN PASSWORD '<generated>';
--   app_runtime    the running site (APP_DATABASE_URL)
--   backup_reader  the weekly encrypted pg_dump (NEON_BACKUP_DATABASE_URL)
-- Do not create them in the Neon console or API: Neon makes those roles members
-- of neon_superuser, which would undo every limit below. Roles created from SQL
-- are not members. Then run this file once as neondb_owner. It is idempotent.
--
-- Migrations keep running as neondb_owner, and ALTER DEFAULT PRIVILEGES makes
-- every table and sequence that owner creates later inherit the same grants,
-- so a new migration never needs a grant of its own.

GRANT USAGE ON SCHEMA public TO app_runtime, backup_reader;

-- app_runtime: rows only, never schema.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO app_runtime;

-- backup_reader: read only.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_reader;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO backup_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO backup_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO backup_reader;
