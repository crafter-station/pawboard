#!/usr/bin/env bun
/**
 * Migration Safety Checker
 *
 * Validates that SQL migration files follow idempotent patterns:
 * - CREATE TABLE IF NOT EXISTS
 * - ADD COLUMN IF NOT EXISTS
 * - DROP TABLE IF EXISTS
 * - DROP COLUMN IF EXISTS
 * - CREATE INDEX IF NOT EXISTS
 * - Constraints wrapped in DO $$ BEGIN ... EXCEPTION blocks
 *
 * Usage:
 *   bun scripts/check-migrations.ts                    # Check all migrations
 *   bun scripts/check-migrations.ts drizzle/0005.sql   # Check specific file
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

interface Issue {
  file: string;
  line: number;
  message: string;
  severity: "error" | "warning";
}

const PATTERNS = {
  // Unsafe patterns that should be flagged
  unsafeCreateTable: /^CREATE TABLE(?!\s+IF\s+NOT\s+EXISTS)\s+"?\w/im,
  unsafeDropTable: /^DROP TABLE(?!\s+IF\s+EXISTS)\s+"?\w/im,
  unsafeCreateIndex: /^CREATE INDEX(?!\s+IF\s+NOT\s+EXISTS)\s+"?\w/im,
  unsafeDropIndex: /^DROP INDEX(?!\s+IF\s+EXISTS)\s+"?\w/im,

  // ADD COLUMN without IF NOT EXISTS
  unsafeAddColumn:
    /ALTER TABLE\s+"?\w+"?\s+ADD COLUMN(?!\s+IF\s+NOT\s+EXISTS)\s+"?\w/im,

  // DROP COLUMN without IF EXISTS
  unsafeDropColumn:
    /ALTER TABLE\s+"?\w+"?\s+DROP COLUMN(?!\s+IF\s+EXISTS)\s+"?\w/im,

  // ADD CONSTRAINT without exception handling (simple check)
  addConstraint: /ADD CONSTRAINT\s+"?\w+/i,

  // Exception handling pattern for constraints
  constraintExceptionBlock:
    /DO\s+\$\$\s+BEGIN[\s\S]*?EXCEPTION[\s\S]*?END\s+\$\$/i,
};

async function checkMigrationFile(filePath: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const fileName = filePath.split("/").pop() || filePath;

  // Check each line for unsafe patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments and statement breakpoints
    if (line.trim().startsWith("--") || line.includes("statement-breakpoint")) {
      continue;
    }

    if (PATTERNS.unsafeCreateTable.test(line)) {
      issues.push({
        file: fileName,
        line: lineNum,
        message: "CREATE TABLE should use IF NOT EXISTS",
        severity: "error",
      });
    }

    if (PATTERNS.unsafeDropTable.test(line)) {
      issues.push({
        file: fileName,
        line: lineNum,
        message: "DROP TABLE should use IF EXISTS",
        severity: "error",
      });
    }

    if (PATTERNS.unsafeCreateIndex.test(line)) {
      issues.push({
        file: fileName,
        line: lineNum,
        message: "CREATE INDEX should use IF NOT EXISTS",
        severity: "error",
      });
    }

    if (PATTERNS.unsafeDropIndex.test(line)) {
      issues.push({
        file: fileName,
        line: lineNum,
        message: "DROP INDEX should use IF EXISTS",
        severity: "error",
      });
    }

    if (PATTERNS.unsafeAddColumn.test(line)) {
      issues.push({
        file: fileName,
        line: lineNum,
        message: "ADD COLUMN should use IF NOT EXISTS",
        severity: "error",
      });
    }

    if (PATTERNS.unsafeDropColumn.test(line)) {
      issues.push({
        file: fileName,
        line: lineNum,
        message: "DROP COLUMN should use IF EXISTS",
        severity: "error",
      });
    }
  }

  // Check for ADD CONSTRAINT without exception handling
  if (PATTERNS.addConstraint.test(content)) {
    if (!PATTERNS.constraintExceptionBlock.test(content)) {
      issues.push({
        file: fileName,
        line: 0,
        message:
          "ADD CONSTRAINT should be wrapped in DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;",
        severity: "error",
      });
    }
  }

  return issues;
}

async function main() {
  const args = process.argv.slice(2);
  let files: string[] = [];

  if (args.length > 0) {
    // Check specific files
    files = args;
  } else {
    // Check all migrations in drizzle/
    const drizzleDir = join(process.cwd(), "drizzle");
    try {
      const entries = await readdir(drizzleDir);
      files = entries
        .filter((f) => f.endsWith(".sql"))
        .map((f) => join(drizzleDir, f));
    } catch {
      console.error("Error: Could not read drizzle/ directory");
      process.exit(1);
    }
  }

  if (files.length === 0) {
    console.log("No migration files to check.");
    process.exit(0);
  }

  console.log(`Checking ${files.length} migration file(s)...\n`);

  let allIssues: Issue[] = [];

  for (const file of files) {
    try {
      const issues = await checkMigrationFile(file);
      allIssues = allIssues.concat(issues);
    } catch (err) {
      console.error(`Error reading ${file}:`, err);
    }
  }

  if (allIssues.length === 0) {
    console.log("All migrations follow safety patterns.");
    process.exit(0);
  }

  console.log("Migration safety issues found:\n");

  for (const issue of allIssues) {
    const location = issue.line > 0 ? `:${issue.line}` : "";
    const icon = issue.severity === "error" ? "x" : "!";
    console.log(`  [${icon}] ${issue.file}${location}`);
    console.log(`      ${issue.message}\n`);
  }

  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;

  console.log(`Found ${errorCount} error(s), ${warningCount} warning(s)`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main();
