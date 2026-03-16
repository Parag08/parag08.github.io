---
name: git_commit
description: Provides standardized instructions for staging, committing, and pushing code to Git for this repository.
---

# Git Commit Skill

This skill provides a standardized workflow for committing changes to the project repository. It ensures consistent commit messages and prevents accidental omission of files.

## Usage

### 1. Stage Changes
Always review changes before staging.
- Stage specific files: `git add path/to/file`
- Stage all changes: `git add .`

### 2. Craft a Commit Message
Use clear, descriptive commit messages.
- Format: `[Action] [Component]: [Short Description]`
- Example: `feat(ui): add mobile responsiveness to hero section`
- Example: `fix(assets): remove unused large profile image`

### 3. Commit
Run the commit command:
`git commit -m "your commit message"`

### 4. Push (Draft)
Verify if pushing is required or if changes should remain local for now.
`git push origin branch-name`

## Best Practices
- **Atomic Commits**: Group related changes together in a single commit.
- **Review Diffs**: Use `git diff --staged` to verify what will be committed.
- **No Binaries**: Ensure large binary files or sensitive data are NOT staged.

## Example Workflow
1. `git add index.html style.css script.js`
2. `git commit -m "feat(mobile): implement hamburger menu and responsive layout"`
3. `git push origin main`
