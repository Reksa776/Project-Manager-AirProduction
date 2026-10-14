# Air Production

Wedding and event operations dashboard built with Next.js, Drizzle ORM, and
Supabase PostgreSQL. The dashboard's existing admin login remains server-side;
database credentials must never use a `NEXT_PUBLIC_` variable.

## Supabase setup

1. Create a Supabase project and open **Project Settings → Database → Connect**.
2. Copy a PostgreSQL connection string (Session Pooler or Direct connection).
3. Fill `DATABASE_URL` in the ignored local `.env` file. Keep the TLS option
   (`sslmode=require`) Supabase provides.
4. Apply the PostgreSQL schema:

   ```bash
   npm run db:migrate
   ```

5. If moving existing MySQL data, put that connection in `MYSQL_SOURCE_URL` in
   `.env`, then run the guarded one-time transfer:

   ```bash
   npm run db:transfer
   ```

   The transfer reads only the allowlisted business tables, leaves legacy-only
   venue/expense tables behind, and refuses to overwrite existing target data.
   Seeded `Editor`/`Videographer` roles are matched by name. Apply migrations
   before transferring. Keep a database backup.

6. Add default crew roles if needed:

   ```bash
   npm run db:seed
   ```

The committed template is `.env.example`; `.env` is ignored by Git. Never paste
Supabase credentials into source files or `NEXT_PUBLIC_*` variables.

## Local development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run typecheck
npm run lint
npm run db:generate -- --name=describe_schema_change
npm run db:check
```

PostgreSQL migrations for Supabase live in `drizzle-supabase/`. Historical MySQL
migrations remain in `drizzle/` for the one-time transition and are not used by
the runtime.
