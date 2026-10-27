# Use Least-Privilege Database Roles

Governing issue: [#3036](https://github.com/fderuiter/deruiter.dev/issues/3036).

The production Neon database has three roles, one per job:

| Role | Used by | Can do | Variable |
| --- | --- | --- | --- |
| `neondb_owner` | Prisma migrations during the Vercel build | Everything, including schema changes | `DATABASE_URL_UNPOOLED` (and `DATABASE_URL` as fallback) |
| `app_runtime` | The running site (`lib/db.ts`) | Read and write rows; never change the schema | `APP_DATABASE_URL` (Production only) |
| `backup_reader` | The weekly encrypted backup | Read rows | `NEON_BACKUP_DATABASE_URL` (GitHub Actions secret) |

`resolveRuntimeDatabaseUrl()` in `lib/db.ts` prefers `APP_DATABASE_URL` and
falls back to `DATABASE_URL`, so a deployment without the runtime role keeps
working exactly as before.

## Set up

1. As `neondb_owner` (Neon console → SQL Editor), create both roles from SQL
   with fresh random passwords (`openssl rand -base64 32`):

   ```sql
   CREATE ROLE app_runtime WITH LOGIN PASSWORD '<generated>';
   CREATE ROLE backup_reader WITH LOGIN PASSWORD '<generated>';
   ```

   Do not create them on the console's Roles page or through the Neon API.
   Neon makes those roles members of `neon_superuser`, which defeats the
   point. Roles created from SQL are not members.

2. Run [`infra/neon/least-privilege-roles.sql`](../../infra/neon/least-privilege-roles.sql)
   as `neondb_owner`. It grants the rights above and sets default privileges,
   so tables that later migrations create inherit the same grants.

3. Check the result:

   ```sql
   SELECT r.rolname,
          pg_has_role(r.rolname, 'neon_superuser', 'MEMBER') AS superuser_member,
          has_table_privilege(r.rolname, '"CaseStudy"', 'INSERT') AS can_insert,
          has_schema_privilege(r.rolname, 'public', 'CREATE') AS can_create
   FROM pg_roles r
   WHERE r.rolname IN ('app_runtime', 'backup_reader');
   ```

   Expect `superuser_member` false for both, `can_insert` true only for
   `app_runtime`, and `can_create` false for both.

4. Add `APP_DATABASE_URL` in Vercel → Settings → Environment Variables,
   **Production only**, type Sensitive. Use the pooled host from
   `DATABASE_URL` with `app_runtime` and its password. The next production
   deployment picks it up.

## Roll back

Delete `APP_DATABASE_URL` in Vercel and deploy. The site falls back to
`DATABASE_URL`. The roles can stay; they hold no data.

## Rotate a password

```sql
ALTER ROLE app_runtime WITH PASSWORD '<new generated>';
```

Then update `APP_DATABASE_URL` and deploy. Rotate `backup_reader` the same
way and update the `NEON_BACKUP_DATABASE_URL` Actions secret.
