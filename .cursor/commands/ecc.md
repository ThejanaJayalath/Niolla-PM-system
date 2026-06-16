---
description: Bootstrap or refresh Everything Claude Code (ECC) — auto-install when missing, status/load when installed.
---

# /ecc

Main entry point for **Everything Claude Code** on this machine.

**Default behavior:** detect install state first, then act — **never ask "should I install?"** when ECC is missing; install automatically unless the user passed `dry-run`.

## Machine config

| Setting | Value |
|---------|-------|
| ECC source | `D:\Everything Claude Code\everything-claude-code` |
| ECC clone URL | `https://github.com/affaan-m/everything-claude-code` |
| Default target | `cursor` |
| Default profile | `developer` (apps) · `core` (lighter) · `minimal` (no hooks) |
| Install root | `<project-root>\.cursor` |
| Install state | `<project-root>\.cursor\ecc-install-state.json` |

## Step 0 — Detect install state (always run first)

From the **current project root**, check:

```powershell
$root = "<project-root>"
$statePath = Join-Path $root ".cursor\ecc-install-state.json"
$installed = (Test-Path $statePath) -and (Test-Path (Join-Path $root ".cursor\hooks.json"))
```

**Installed** = `ecc-install-state.json` exists **and** `hooks.json` exists.

If installed, read `ecc-install-state.json` (profile, modules, `installedAt`, `source.repoVersion`, `source.repoCommit`).

Compare against ECC source when available:

```powershell
cd "D:\Everything Claude Code\everything-claude-code"
git rev-parse HEAD
```

## Branch A — NOT installed → auto-install

Run immediately (no confirmation) unless user said `dry-run`.

### A1. Ensure ECC source exists

```powershell
$eccRoot = "D:\Everything Claude Code\everything-claude-code"
if (-not (Test-Path $eccRoot)) {
  New-Item -ItemType Directory -Path "D:\Everything Claude Code" -Force | Out-Null
  git clone --depth 1 https://github.com/affaan-m/everything-claude-code.git $eccRoot
}
```

### A2. Read bootstrap guide

If `ECC-START.md` exists in the project root, follow it. Otherwise continue below.

### A3. Detect stack

Inspect project root:

- `package.json` / lockfiles → JavaScript/TypeScript (check `frontend/`, `backend/` for monorepos)
- `pyproject.toml`, `requirements.txt` → Python
- `go.mod` → Go
- `Cargo.toml` → Rust
- Existing partial `.cursor/` → brownfield; merge, never blind-delete user files

Read `PROJECT-BRIEF.md` if present.

### A4. Resolve profile from user input

| User says | Profile |
|-----------|---------|
| `/ecc` or `/ecc developer` | `developer` (default) |
| `/ecc minimal` | `minimal` |
| `/ecc core` | `core` |
| `/ecc dry-run` | any (plan only, no apply) |

### A5. Install

Dry-run (only when user said `dry-run`):

```powershell
cd "<project-root>"
& "D:\Everything Claude Code\everything-claude-code\install.ps1" --target cursor --profile <profile> --dry-run
```

Apply (default when not installed):

```powershell
cd "<project-root>"
& "D:\Everything Claude Code\everything-claude-code\install.ps1" --target cursor --profile <profile>
```

Preserve existing project-specific rules/skills on merge conflicts — never delete user files without approval.

### A6. Verify and report

Confirm under `.cursor/`:

- `hooks.json`, `hooks/`, `rules/`, `commands/`, `skills/`, `ecc-install-state.json`

Tell the user to **reload Cursor** (Ctrl+Shift+P → `Developer: Reload Window`) so hooks activate.

Then offer next steps: `/project-init`, `/ecc-guide`, `/harness-audit`, `/security-scan`.

---

## Branch B — ALREADY installed → load and operate

Load install state from `ecc-install-state.json` and honor the configured profile/modules.

### B1. Status report (default `/ecc` with no other intent)

Show a concise table:

- Install root, profile, modules (selected + skipped)
- `installedAt`, installed file count
- Installed ECC version/commit vs current source commit (stale if different)
- Detected project stack
- Verification of `hooks.json`, `hooks/`, `rules/`, `commands/`, `skills/`

If source commit is newer than installed → note that `/ecc refresh` will update managed files.

### B2. Subcommand routing

| User says | Action |
|-----------|--------|
| `/ecc` | Status report (B1) + next-steps menu |
| `/ecc status` | Same as `/ecc` |
| `/ecc refresh` | Re-apply installed profile (or `developer` if missing from state): `install.ps1 --target cursor --profile <profile>` — no dry-run |
| `/ecc developer` / `core` / `minimal` | If profile differs from state → apply new profile; if same → status only |
| `/ecc dry-run` | Dry-run for current or requested profile |
| `/ecc guide` | Delegate to `/ecc-guide` |

### B3. After refresh or profile change

Re-read `ecc-install-state.json`, verify artifacts, report what changed, remind reload if hooks were updated.

---

## Usage

```text
/ecc                  → auto-install if missing; status if installed
/ecc status           → status only (installed projects)
/ecc developer        → install or switch to developer profile
/ecc core             → install or switch to core profile
/ecc minimal          → install or switch to minimal profile
/ecc refresh          → update managed ECC files from source
/ecc dry-run          → plan only, no writes
/ecc guide            → delegate to /ecc-guide
```

## Safety rules

1. **Missing ECC → auto-install** unless user explicitly passed `dry-run`.
2. **Installed ECC → never reinstall from scratch** on plain `/ecc`; load state and report (or refresh when asked).
3. Never combine `--profile` with legacy language arguments in one install command.
4. Do not run `--profile full` unless the user explicitly asks.
5. Brownfield `.cursor/` with substantial custom content: on **profile change** or **refresh**, preserve user-owned files; report conflicts instead of deleting.
6. Report exactly what changed after any apply.
