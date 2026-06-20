# Supabase Migrations

This project uses Supabase CLI migrations (numeric versioned filenames). Current migrations:

- 202601260001_initial_schema.sql
- 202601260002_add_custom_statuses.sql
- 202601260003_update_won_status_color.sql

## Common commands

- Link to project (one-time):
  ```bash
  supabase link --project-ref <project-ref>
  ```
- Create a new migration (fills `supabase/migrations/`):
  ```bash
  supabase migration new <description>
  ```
  Then put your SQL in the generated file.
- Apply pending migrations to remote:
  ```bash
  supabase db push
  ```
- Check status:
  ```bash
  supabase migration list
  ```

## When migrations were already applied manually

If a migration was run outside the CLI but the file exists locally, mark it as applied so `db push` does not replay it:

```bash
supabase migration repair <version> --status applied --yes
```

Example:

```bash
supabase migration repair 202601260001 202601260002 --status applied --yes
```

## Notes

- Brokers are linked directly to Supabase Auth users (`brokers.id = auth.users.id`).
- Demo users should be created in Supabase Auth Dashboard, then broker records are automatically synced via triggers or explicit inserts.
- The "Won" status color change to amber was applied via 202601260003_update_won_status_color.sql.
- Keep all migration files in source control; do not delete historical migrations.
