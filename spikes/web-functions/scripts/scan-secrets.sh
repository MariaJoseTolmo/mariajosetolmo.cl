#!/usr/bin/env bash
# Throwaway spike tooling. Scans the whole repo for account data before any commit.
# Exit code 0 = clean, 1 = findings or tooling problem.
# Usage: bash spikes/web-functions/scripts/scan-secrets.sh   (run from the repo root)
#
# Patterns are written so their own source text does not match them
# (a character class such as the one used for the ARN prefix keeps the pattern from matching its own text), so this script and the
# README can live inside the scanned tree without false positives.
set -u

status=0

echo "== 1/4 gitleaks (generic secrets) =="
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --no-git --source . || status=1
else
  echo "gitleaks is not installed: skipping this step (install only with the owner's approval)."
fi

echo "== 2/4 rg: account data in file contents =="
# 12-digit account IDs, ARNs, access key IDs, real CloudFront hostnames and real
# Web Function endpoint hostnames. A bare 'cloudfront.net' / 'on.aws' is NOT scanned
# because the openspec docs mention '*.cloudfront.net' legitimately.
if rg -n --no-ignore --hidden -g '!.git' \
  -e '\b[0-9]{12}\b' \
  -e 'arn:aws[:][a-z0-9-]*:[a-z0-9-]*:[0-9]{12}' \
  -e 'AKIA[0-9A-Z]{16}' \
  -e '\b[a-z0-9]{10,}\.cloudfront\.net\b' \
  -e '\b[a-z0-9-]+\.[a-z0-9-]+\.lambda-web\.[a-z0-9-]+\.on\.aws\b' \
  .; then
  status=1
else
  echo "no matches"
fi

echo "== 3/4 fd: env files and zips on disk (outside .git and node_modules) =="
found=$(fd -H -I -t f -g '.env*' -E .git -E node_modules . ; fd -H -I -t f -e zip -E .git -E node_modules .)
if [ -n "$found" ]; then
  echo "$found"
  echo "(these must be ignored by .gitignore and never staged)"
fi

echo "== 4/4 git: untracked or staged files that should be ignored =="
if git rev-parse --git-dir >/dev/null 2>&1; then
  if git status --porcelain --untracked-files=all | rg -n -e '(^|/)\.env' -e 'cdk\.out/' -e 'cdk\.context\.json' -e '\.zip$' -e 'node_modules/'; then
    status=1
  else
    echo "none"
  fi
else
  echo "not a git repository: skipping"
fi

if [ "$status" -eq 0 ]; then echo "RESULT: clean"; else echo "RESULT: FINDINGS"; fi
exit "$status"
