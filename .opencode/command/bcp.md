---
description: Branch, Commit (atomic), and PR workflow
agent: build
---

You are tasked with executing the full BCP (Branch, Commit, PR) workflow. This command will:
1. Create a new git branch
2. Analyze and commit changes in atomic, feature-focused chunks
3. Create a pull request using the GitHub CLI

## Branch Name

$ARGUMENTS

If no branch name is provided, infer an appropriate branch name based on the changes.

## Workflow Instructions

### Step 1: Analyze Current Changes

Run the following commands in parallel to understand what needs to be committed:
- `git status` - See all untracked and modified files
- `git diff` - See unstaged changes
- `git log --oneline -5` - See recent commits for context

### Step 2: Create Branch

1. Create a new branch with the name provided in $ARGUMENTS, or if not provided, generate a meaningful branch name based on the changes (format: `type/short-description`, e.g., `feat/add-realtime-cursors`, `fix/card-deletion-bug`)
2. Use `git checkout -b <branch-name>`

### Step 3: Atomic Commits

Analyze all the changes and group them into **atomic, logically independent commits**. Each commit should:
- Represent a single, complete feature or fix
- Be independently understandable
- Follow the project's commit convention from AGENTS.md: `type(scope): description`
- Have a clear, descriptive message

**Commit types from AGENTS.md:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, no logic change)
- `refactor` - Code refactoring (no feature or fix)
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `revert` - Reverting changes

For each atomic commit:
1. Stage only the relevant files for that specific feature/fix
2. Create a commit with a descriptive message
3. Ensure the commit follows the format: `type(scope): description`

**Examples of good atomic commits:**
- `feat(cards): add drag and drop functionality`
- `style(cards): format code with biome`
- `fix(realtime): prevent duplicate cursor events`
- `refactor(hooks): extract realtime logic to custom hook`

### Step 4: Create Pull Request

1. Push the branch to remote: `git push -u origin <branch-name>`
2. Analyze ALL commits on the branch (from when it diverged from main) using: `git log main..HEAD` and `git diff main...HEAD`
3. Create a PR using `gh pr create` with:
   - A clear, descriptive title summarizing the entire PR
   - A body that includes:
     - Summary of changes (2-4 bullet points covering all commits)
     - Any relevant context or notes
   - Use a HEREDOC for the body to ensure proper formatting

**Example PR creation:**
```bash
gh pr create --title "feat: Add realtime collaboration features" --body "$(cat <<'EOF'
## Summary
- Add drag and drop functionality for cards
- Implement realtime cursor tracking
- Fix duplicate cursor event bug
- Refactor realtime logic into custom hooks
EOF
)"
```

4. Return the PR URL to the user

## Important Notes

- **DO NOT** push to remote until you've completed all atomic commits
- **DO NOT** create a single monolithic commit - break changes into logical, atomic pieces
- **DO NOT** use the TodoWrite tool - execute the workflow directly
- **DO** follow the commit message conventions from AGENTS.md strictly
- **DO** ensure each commit is independently meaningful
- **DO** analyze the full scope of changes before deciding how to split them
- If there are uncommitted changes from previous work, include them in the appropriate atomic commits
- The PR summary should cover ALL commits, not just the most recent one

## Edge Cases

- If already on a non-main branch, ask the user if they want to commit to the current branch or create a new one
- If there are no changes to commit, report this to the user
- If `gh` CLI is not authenticated, provide instructions to the user
