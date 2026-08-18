-- Non-superuser role the app connects as (DATABASE_URL). The docker
-- POSTGRES_USER ("expense") is a superuser and therefore BYPASSES row-level
-- security — it is reserved for migrations and seeding (DIRECT_DATABASE_URL).
CREATE ROLE expense_app LOGIN PASSWORD 'expense_app';
GRANT USAGE ON SCHEMA public TO expense_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO expense_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO expense_app;
-- Tables created by future migrations (run as "expense") inherit these:
ALTER DEFAULT PRIVILEGES FOR ROLE expense IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO expense_app;
ALTER DEFAULT PRIVILEGES FOR ROLE expense IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO expense_app;
