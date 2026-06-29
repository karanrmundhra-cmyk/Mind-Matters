# Make GitHub the canonical repository

GitHub is the **single source of truth** for this codebase going forward (version history,
backup, work-from-any-device, easy Vercel deploy, clean collaboration).

> I couldn't complete the push autonomously: it needs **your** authenticated GitHub account,
> and I don't create accounts or handle your credentials. The steps below are a one-time,
> ~2-minute setup on your Mac. Everything is ready to go.

## One-time setup + release checkpoint (run in Terminal, on your Mac)

```bash
cd "/Users/x/Claude/Projects/Mind Matters"

# 0. Clear stale git locks left by the sandbox mount (harmless to delete)
rm -f .git/HEAD.lock .git/index.lock .git/refs/heads/master.lock .git/refs/heads/main.lock 2>/dev/null

# 1. Delete the one orphaned dead file the sandbox couldn't remove
rm -f src/components/ui/ComingSoon.tsx

# 2. Make `main` the primary branch
git branch -m master main

# 3. Commit all verified milestone changes
git add -A
git commit -m "v0.1.0-keyless-foundation: complete MVP feature set, keyless + verified (98 tests, tsc 0, eslint 0)"

# 4. Tag the milestone (annotated) — this is your stable rollback point
git tag -a v0.1.0-keyless-foundation -m "First stable milestone: keyless MVP foundation"

# 5. Verify the working tree is clean
git status            # expect: "nothing to commit, working tree clean"

# 6. Connect the existing GitHub repo and push WITH the tag
git remote add origin https://github.com/karanrmundhra-cmyk/Mind-Matters.git
git push -u origin main
git push origin v0.1.0-keyless-foundation
```

### If step 6's push is rejected ("updates were rejected" / non-fast-forward)
That means the GitHub repo was created **with** an initial README/.gitignore. Reconcile once:
```bash
git pull --rebase origin main --allow-unrelated-histories
git push -u origin main
git push origin v0.1.0-keyless-foundation
```
(If you're certain the repo is empty and just want ours to win: `git push -u origin main --force`.)

### Authentication
When `git push` prompts, authenticate with a **GitHub Personal Access Token** as the password
(Settings → Developer settings → Tokens), or run `gh auth login` first if you have the GitHub CLI.
Don't paste tokens to me — enter them directly in your terminal.

### …or without the GitHub CLI

```bash
# Create an empty PRIVATE repo named "mind-matters" at https://github.com/new
# (do NOT initialise it with a README), then:
git remote add origin https://github.com/<your-username>/mind-matters.git
git push -u origin main
```

## 3. Verify the push succeeded

```bash
git remote -v                       # shows origin → your repo
git log --oneline -1                # 260f25b … (plus a docs commit if you committed these files)
git status                          # "Your branch is up to date with 'origin/main'"
```

Then open `https://github.com/<your-username>/mind-matters` and confirm:
- commit history is present,
- the folder structure matches (`src/`, `prisma/`, `public/`, docs at root),
- the docs render (`README.md`, `VERIFICATION.md`, `CHANGELOG.md`, `DECISIONS.md`).

## 4. From then on
- I continue building against this GitHub-backed repo.
- Each verified feature → commit (and you/CI push).
- When ready to deploy: connect the GitHub repo to **Vercel** (one click) for live preview + phone access.

---
**Note:** I left new/updated docs (this file, README "Repository" section) as uncommitted working-tree
changes because the sandbox can't write git refs on the mounted folder. Your `git add -A && git commit`
(or the `gh repo create … --push` above, which commits nothing extra) will pick them up — just run:

```bash
git add -A && git commit -m "Docs: make GitHub canonical + push guide"
```
before (or after) the push.
