#!/usr/bin/env bash
# Records files a scheduled workflow regenerated on a pull request (#2992).
#
# Usage: scripts/open-bot-pr.sh <branch-prefix> <title> <body-file> <issue-title> <path>...
#   <branch-prefix>  e.g. chore/standards-watch-; the branch is the prefix
#                    plus the first 10 hex digits of the sha256 of the files
#   <title>          the commit and pull request title
#   <body-file>      the pull request body, in Markdown
#   <issue-title>    the issue commented on or opened when Actions may not
#                    open pull requests
#   <path>...        the regenerated files
#
# Does nothing when the files are unchanged, or when a branch already
# records the same content. Closes older open pull requests from the same
# prefix. A workflow's GITHUB_TOKEN cannot start other workflows from a pull
# request it opens, so this dispatches CI on the branch; Merge Gate then
# reports on its commit. Needs GH_TOKEN with contents, pull-requests, issues
# and actions write. Used by standards-watch.yml and cdisc-library-sync.yml.

set -euo pipefail

if [ "$#" -lt 5 ]; then
  sed -n '4,11p' "$0" >&2
  exit 2
fi

prefix="$1"
title="$2"
body="$3"
issue_title="$4"
shift 4

if [ -z "$(git status --porcelain -- "$@")" ]; then
  echo "Nothing has changed."
  exit 0
fi

hash="$(cat "$@" | sha256sum | cut -c1-10)"
branch="$prefix$hash"
if git ls-remote --exit-code --heads origin "$branch" >/dev/null; then
  echo "$branch already records this change."
  exit 0
fi

{
  echo
  echo "Opened by the scheduled \`$GITHUB_WORKFLOW\` workflow (#2992). CI was dispatched on this branch, because GitHub does not run pull_request workflows for a pull request a workflow opens."
} >> "$body"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git switch -c "$branch"
git add -- "$@"
git commit -m "$title"
git push origin "$branch"

for old in $(gh pr list --state open --json number,headRefName \
  --jq ".[] | select(.headRefName | startswith(\"$prefix\")) | .number"); do
  gh pr close "$old" --delete-branch \
    --comment "Superseded by $branch."
done

if gh pr create --base main --head "$branch" --title "$title" --body-file "$body"; then
  gh workflow run ci.yml --ref "$branch"
else
  echo "::warning::Could not open a pull request; recording the change on an issue instead."
  echo >> "$body"
  echo "The change is committed on branch \`$branch\`; open a pull request from it to record it." >> "$body"
  issue=$(gh issue list --state open --search "in:title \"$issue_title\"" \
    --json number --jq '.[0].number // empty')
  if [ -n "$issue" ]; then
    gh issue comment "$issue" --body-file "$body"
  else
    gh issue create --title "$issue_title" --body-file "$body"
  fi
fi
