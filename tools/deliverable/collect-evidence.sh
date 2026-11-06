#!/usr/bin/env bash
# Runs the build and test commands on the checked-out commit and saves the raw output, plus
# GitHub data, to an evidence directory. Nothing here is edited by hand.
# Usage: tools/deliverable/collect-evidence.sh <evidence-dir>
# Needs: Docker database running (see README), .env present, Chrome installed, `gh` logged in.
set -uo pipefail
EV="${1:?usage: collect-evidence.sh <evidence-dir>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$EV"
cd "$ROOT"

git rev-parse HEAD > "$EV/commit.txt"
git rev-parse --abbrev-ref HEAD > "$EV/branch.txt"
{ date '+%Y-%m-%d %H:%M %Z'; echo "node $(node -v)"; echo "npm $(npm -v)"; sw_vers 2>/dev/null | tr '\n' ' '; echo; sysctl -n machdep.cpu.brand_string 2>/dev/null; docker ps --format '{{.Image}}' 2>/dev/null | grep -i postgres | head -1; } > "$EV/environment.txt"
git status --porcelain > "$EV/status-before.txt"

echo "== npm install (clean check)"; npm ls --depth=0 > "$EV/npm-ls.txt" 2>&1 || true
echo "== npm run build";     npm run build  > "$EV/build.txt" 2>&1; echo "exit $?" >> "$EV/build.txt"
echo "== npm test";          npm test       > "$EV/npm-test.txt" 2>&1; echo "exit $?" >> "$EV/npm-test.txt"
echo "== vitest json";       (cd server && npx vitest run --reporter=json --outputFile="$EV/vitest.json" > "$EV/vitest-stdout.txt" 2>&1)
echo "== npm audit";         npm audit > "$EV/audit.txt" 2>&1; echo "exit $?" >> "$EV/audit.txt"
echo "== npm run test:e2e";  npm run test:e2e > "$EV/e2e.txt" 2>&1; echo "exit $?" >> "$EV/e2e.txt"

echo "== git history"
git log --reverse --no-merges --date=iso-strict --format='%h%x09%ad%x09%an%x09%s' abf994c..HEAD > "$EV/history.tsv"
git log --reverse --merges --date=iso-strict --format='%h%x09%ad%x09%an%x09%s' abf994c..HEAD > "$EV/merges.tsv"
git shortlog -sn --no-merges abf994c..HEAD > "$EV/shortlog.txt"
git fetch -q origin 2>/dev/null; git rev-list --left-right --count origin/main...HEAD > "$EV/main-vs-head.txt" 2>/dev/null || true
git tag --list > "$EV/tags.txt"

echo "== GitHub"
gh pr list --state all --limit 50 --json number,title,state,author,headRefName,baseRefName,mergedAt,mergedBy,mergeCommit,url > "$EV/prs.json" 2>/dev/null || echo '[]' > "$EV/prs.json"
for n in $(python3 -c "import json;print(' '.join(str(p['number']) for p in json.load(open('$EV/prs.json'))))"); do
  gh pr view "$n" --json number,title,author,headRefName,baseRefName,mergedAt,mergedBy,mergeCommit,reviews,commits,closingIssuesReferences,url > "$EV/pr-$n.json" 2>/dev/null
done
gh issue list --state all --limit 50 --json number,title,state,closedAt,url > "$EV/issues.json" 2>/dev/null || echo '[]' > "$EV/issues.json"
git status --porcelain > "$EV/status-after.txt"
echo "evidence saved to $EV (commit $(cat "$EV/commit.txt" | cut -c1-7))"
