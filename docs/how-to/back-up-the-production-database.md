# Back Up the Production Database

Governing issue: [#3036](https://github.com/fderuiter/deruiter.dev/issues/3036).

Neon's free plan keeps six hours of point-in-time history and no snapshots
([restore runbook](restore-the-production-database.md)). An incident found the
next morning cannot be recovered from Neon alone. The `Neon Backup` workflow
(`.github/workflows/neon-backup.yml`) closes that gap with a weekly logical
backup.

## How it works

- **When:** every Sunday at 23:00 UTC, two hours before the weekly release
  train, so each release has a restore point taken before its migrations.
  It can also be run by hand from Actions → Neon Backup → Run workflow.
- **What:** `pg_dump --format=custom` of the `public` schema (all application
  tables and `_prisma_migrations`), using Postgres 17 to match Neon. The job
  fails if `pg_restore --list` finds no table data.
- **Where:** a workflow artifact kept for 90 days, at no cost on a public
  repository. It stays in GitHub Actions and adds no Vercel compute.
- **Protection:** the dump is encrypted with [age](https://age-encryption.org)
  to a public key before upload, and the plaintext is shredded on the runner.
  Artifacts of a public repository can be downloaded by any signed-in GitHub
  user, so only ciphertext ever leaves the runner. The private key stays with
  the owner and never touches GitHub.

## Set up (once)

For interactive, read-only guidance and GitHub metadata checks, run
`scripts/setup-operator-wizard.sh backup` from the repository. The guide does
not write credentials or dispatch a workflow; follow the steps below to do so.

1. Make a key pair on your own computer and keep the private key safe (a
   password manager works):

   ```bash
   age-keygen -o deruiter-backup-key.txt
   ```

   The file's `# public key:` line is the recipient.

2. Add the repository **variable** `BACKUP_AGE_RECIPIENT` with that `age1…`
   public key (Settings → Secrets and variables → Actions → Variables).

3. Create the read-only `backup_reader` role from SQL, as `neondb_owner` in
   the Neon SQL Editor, with a fresh random password
   (`openssl rand -base64 32`). Creating it from SQL rather than the console
   keeps it out of `neon_superuser`:

   ```sql
   CREATE ROLE backup_reader WITH LOGIN PASSWORD '<generated>';
   GRANT USAGE ON SCHEMA public TO backup_reader;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_reader;
   GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO backup_reader;
   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
     GRANT SELECT ON TABLES TO backup_reader;
   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
     GRANT SELECT ON SEQUENCES TO backup_reader;
   ```

4. Add the repository **secret** `NEON_BACKUP_DATABASE_URL`: the direct
   (unpooled) connection string, using the `PGHOST_UNPOOLED` host, with
   `backup_reader` and its password, plus `?sslmode=require`.

5. Run the workflow once by hand and check the job summary shows table data.

## Restore from a backup

1. Download the artifact from the run (Actions → Neon Backup → the run →
   Artifacts) and unzip it.
2. Decrypt it with the private key:

   ```bash
   age --decrypt --identity deruiter-backup-key.txt \
     --output neon.dump neon-<stamp>.dump.age
   ```

3. Restore into a **new Neon branch** first, never straight into
   production. Follow the inspect-first path in the
   [restore runbook](restore-the-production-database.md):

   ```bash
   pg_restore --no-owner --no-privileges --clean --if-exists \
     --dbname "<new branch direct connection string>" neon.dump
   ```

4. Verify the fingerprints from the restore runbook, then cut over as it
   describes.

## Rotate

- **Key:** make a new key pair, update `BACKUP_AGE_RECIPIENT`, and keep the
  old private key until every artifact encrypted to it has expired (90 days).
- **Password:** `ALTER ROLE backup_reader WITH PASSWORD '<new generated>';`,
  then update `NEON_BACKUP_DATABASE_URL`.
