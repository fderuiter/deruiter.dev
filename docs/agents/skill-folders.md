# Skill Folders

How skills are organized, which agent tools discover which directory, and how project engineering skills are bridged into Claude Code.

## Directory Roles and Tool Ownership

This repository maintains two distinct skill directories:

| Directory | Primary Purpose | Tools Reading This Folder |
| :--- | :--- | :--- |
| **`.agents/skills/`** | The canonical, shared catalog of tracked engineering skills (Matt Pocock skills suite, licensed under MIT). Contains 34 reusable engineering and design workflows. | **Antigravity (Google DeepMind)**, Jules, and agent runtimes following open workspace standards. Antigravity discovers this directory by walking up from the workspace directory to the repository root. |
| **`.claude/skills/`** | Claude Code skills directory. Houses repository-specific operational skills (`humanizer`, `run-portfolio`, `steward`) alongside symbolic links to select project engineering skills. | **Claude Code (Anthropic)**. Claude Code scans `.claude/skills/` and `~/.claude/skills/` exclusively; it does not inspect `.agents/skills/`. |

## Bridged Skills

To make core engineering practices available during Claude Code sessions without duplicating skill definitions or introducing drift, five skills are linked from `.claude/skills/` to `.agents/skills/`:

| Skill | Link Target | Workflow Purpose |
| :--- | :--- | :--- |
| **`triage`** | `../../.agents/skills/triage` | Move issues and external PRs through a state machine of triage roles, categorize, verify, and write agent-ready briefs. |
| **`tdd`** | `../../.agents/skills/tdd` | Test-driven development workflow following the Red-Green-Refactor cycle. |
| **`diagnosing-bugs`** | `../../.agents/skills/diagnosing-bugs` | Structured diagnosis loop for complex bugs and performance regressions before attempting a fix. |
| **`resolving-merge-conflicts`** | `../../.agents/skills/resolving-merge-conflicts` | Step-by-step resolution of git merge and rebase conflicts preserving feature synthesis. |
| **`to-tickets`** | `../../.agents/skills/to-tickets` | Decompose specifications or design plans into tracer-bullet tickets with explicit blocking edges. |

These links allow Claude Code to discover each skill upon session startup, exposing them both for autonomous model invocation and as interactive slash commands (such as `/tdd` or `/triage`).

## Repository Operational Skills in `.claude/skills/`

The remaining directories in `.claude/skills/` are repository-specific tools authored specifically for Claude Code:

- **`humanizer`**: Prose and writing style reviewer eliminating AI writing tells and enforcing portfolio voice.
- **`run-portfolio`**: Local development server manager, arcade playtester, and UI diagnostic tool.
- **`steward`**: Architecture, hygiene, and repository invariant steward.

## Symlink Mechanics and Fresh Clone Setup

All bridges in `.claude/skills/` are tracked as Git symbolic links (`mode 120000`) using relative paths (`../../.agents/skills/<name>`).

### Linux and macOS

Native POSIX filesystems support Git symbolic links by default (`core.symlinks = true`). A standard clone resolves all five links immediately:

```bash
git clone https://github.com/fderuiter/deruiter.dev.git
```

Verify link resolution with:

```bash
ls -la .claude/skills
```

### Windows Workstations

Git for Windows defaults to `core.symlinks = false`. When false, Git checks out symbolic links as small plain text files containing the target path string, which causes directory traversal tools to fail with `ENOTDIR`.

To resolve Git symlinks natively on Windows:

1. Enable **Developer Mode** in Windows Settings:
   - Go to **Settings** > **System** (or **Privacy & Security**) > **For developers**.
   - Set **Developer Mode** to **On**.
2. Clone with symlink support enabled:
   ```bash
   git clone -c core.symlinks=true https://github.com/fderuiter/deruiter.dev.git
   ```
   Or enable symlinks globally once:
   ```bash
   git config --global core.symlinks true
   ```
3. If the repository was already cloned with `core.symlinks = false`, convert text placeholders to active symbolic links:
   ```bash
   git config core.symlinks true
   git checkout HEAD -- .claude/skills/
   ```

> [!NOTE]
> NTFS Junctions (`mklink /J`) are local NTFS reparse points that Git treats as physical directories rather than links. Never commit NTFS junctions to Git staging, as Git will traverse them and stage duplicate copies of skill files.
