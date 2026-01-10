# Contributing to Pawboard

Thank you for your interest in contributing to Pawboard! This guide explains our development workflow and how to submit changes.

## Development Workflow

### Environment Overview

| Environment | Database | Realtime | When Used |
|-------------|----------|----------|-----------|
| **Local** | Docker (your machine) | Docker | Day-to-day development |
| **Preview** | pawboard-dev (shared) | pawboard-dev | PR testing on Vercel |
| **Production** | pawboard (prod) | pawboard | Live site |

### Branch Strategy

```
main (production)
  |
  +-- feature/your-feature (PR branch)
```

- `main` is the production branch
- Create feature branches for all changes
- PRs are required for merging to main

## Making Changes

### 1. Set Up Local Environment

Follow the [Local Development Guide](/docs/LOCAL_DEVELOPMENT.md) to set up your environment.

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 3. Make Your Changes

- Follow the coding conventions in [AGENTS.md](/AGENTS.md)
- Test locally with `bun dev`
- If changing the database schema, see [Schema Changes](#schema-changes) below

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat: add new feature description"
```

Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

### 5. Push and Create PR

```bash
git push -u origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Schema Changes

Database schema changes require special attention because they affect shared environments.

### Local Development

1. Edit `db/schema.ts`
2. Generate a migration:
   ```bash
   bun db:generate:local
   ```
3. Review the generated SQL file in `drizzle/`
4. Apply the migration:
   ```bash
   bun db:migrate:local
   ```
5. Test thoroughly

### In Your PR

When your PR includes schema changes:

1. **Include both files:** Commit `db/schema.ts` AND the new migration file in `drizzle/`
2. **For team members:** After PR approval, a maintainer will trigger the migration to the dev environment
3. **For external contributors:** Schema changes require extra review. A maintainer will manually apply migrations after thorough review

> **Security Note:** Migrations are NOT automatically applied to prevent malicious PRs from modifying the shared dev database. A team member must approve and trigger the migration.

### Schema Change Checklist

- [ ] Migration file generated and included in commit
- [ ] Migration SQL reviewed for correctness
- [ ] Migration is idempotent (see safety patterns below)
- [ ] Schema changes are backward compatible (or migration plan documented)
- [ ] No data loss in existing tables
- [ ] Indexes added for frequently queried columns
- [ ] Foreign key constraints are appropriate
- [ ] Default values set where needed

### Migration Safety Patterns

Migrations should be **idempotent** - safe to run multiple times without errors. This is critical because:
- Migrations may run against databases in different states
- Failed partial migrations should be retryable
- Preview environments share a database across PRs

#### Required Patterns

**For CREATE TABLE statements:**
```sql
CREATE TABLE IF NOT EXISTS "table_name" (
  -- columns
);
```

**For ADD COLUMN statements:**
```sql
ALTER TABLE "table_name" ADD COLUMN IF NOT EXISTS "column_name" type;
```

**For DROP TABLE statements:**
```sql
DROP TABLE IF EXISTS "table_name";
```

**For DROP COLUMN statements:**
```sql
ALTER TABLE "table_name" DROP COLUMN IF EXISTS "column_name";
```

**For constraints (foreign keys, unique, etc.):**
```sql
DO $$ BEGIN
  ALTER TABLE "table_name" ADD CONSTRAINT "constraint_name" 
    FOREIGN KEY ("column") REFERENCES "other_table"("id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

**For indexes:**
```sql
CREATE INDEX IF NOT EXISTS "index_name" ON "table_name" ("column");
```

#### Drizzle Kit Behavior

Drizzle Kit generates safe migrations by default for most operations. However, always review generated SQL to verify:

1. `CREATE TABLE` has `IF NOT EXISTS`
2. `ADD COLUMN` has `IF NOT EXISTS`  
3. Constraints use the `DO $$ BEGIN ... EXCEPTION` pattern
4. Drop operations have `IF EXISTS`

If a generated migration is missing these patterns, manually edit the SQL file before committing.

### Rolling Back Migrations

Drizzle Kit does **not** have built-in rollback functionality. The `drizzle-kit drop` command only removes migration files locally - it does not undo changes in the database.

To fully rollback a migration, you must manually:

#### Step 1: Undo the Schema Changes in the Database

Run SQL to reverse the migration. For example, if you added a column:

```sql
ALTER TABLE "cards" DROP COLUMN IF EXISTS "hidden";
```

#### Step 2: Remove the Migration Record

Drizzle tracks applied migrations in `drizzle.__drizzle_migrations`. You must delete the record:

```sql
-- First, find the migration hash
SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC;

-- Then delete the record (replace with actual hash)
DELETE FROM drizzle.__drizzle_migrations WHERE hash = 'your_migration_hash_here';
```

#### Step 3: Remove the Migration File

Delete the migration file from `drizzle/` folder, or run:

```bash
bunx drizzle-kit drop
```

#### Step 4: Revert schema.ts

Remove or undo the changes in `db/schema.ts` to match the database state.

#### Rollback Checklist

| Step | Action |
|------|--------|
| 1 | Run SQL to undo schema changes (DROP COLUMN, DROP TABLE, etc.) |
| 2 | Delete record from `drizzle.__drizzle_migrations` |
| 3 | Delete migration file from `drizzle/` |
| 4 | Revert changes in `db/schema.ts` |

> **Tip:** When creating migrations, document the rollback SQL in your PR description for easy reference later.

## Pull Request Process

### For Team Members

1. Create PR from your feature branch
2. Wait for CI checks to pass
3. Request review from a team member
4. After approval:
   - If schema changes: Maintainer triggers schema sync via workflow dispatch
   - Vercel preview deployment uses updated dev database
5. Test in preview environment
6. Merge to main

### For External Contributors

1. Fork the repository
2. Create your feature branch
3. Make changes following our guidelines
4. Submit PR with clear description
5. Wait for review
6. Address any feedback
7. A maintainer will merge after approval

### PR Requirements

- [ ] Clear description of changes
- [ ] Tests pass locally
- [ ] No linting errors (`bun check`)
- [ ] Documentation updated if needed
- [ ] Screenshots for UI changes

## Testing Your Changes

### Local Testing

```bash
# Run the dev server
bun dev

# Check for linting issues
bun check

# Format code
bun format
```

### Preview Environment

After your PR is created:

1. Vercel automatically creates a preview deployment
2. The preview uses the shared dev Supabase project
3. Test your changes at the preview URL
4. Realtime features work in preview (shared with other PRs)

> **Note:** Since all preview deployments share the same dev database, avoid creating test data that might conflict with others. Use unique session IDs.

## Code Review Guidelines

### For Authors

- Keep PRs focused and small when possible
- Respond to feedback promptly
- Update your branch with main if needed:
  ```bash
  git fetch origin
  git rebase origin/main
  ```

### For Reviewers

- Be constructive and specific
- Approve once concerns are addressed
- For schema changes, verify backward compatibility

## Getting Help

- Check existing [issues](https://github.com/your-org/pawboard/issues)
- Ask questions in PR comments
- Reach out to maintainers

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
