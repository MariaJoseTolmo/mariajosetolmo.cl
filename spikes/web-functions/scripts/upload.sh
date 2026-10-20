#!/usr/bin/env bash
# Uploads the built zip to the versioned code bucket and prints the VersionId.
# Usage: CODE_BUCKET=<bucket> bash scripts/upload.sh
# Requires AWS credentials in the environment. Nothing is hardcoded here.
set -euo pipefail
: "${CODE_BUCKET:?set CODE_BUCKET to the code bucket name}"
cd "$(dirname "$0")/.."
zip_file="$(printf "%s
" dist/app-*.zip | head -n 1)"
key="$(basename "$zip_file")"
version_id="$(aws s3api put-object --region us-east-1 --bucket "$CODE_BUCKET" --key "$key" \
  --body "$zip_file" --query VersionId --output text)"
echo "Deploy with: -c codeKey=$key -c codeVersion=$version_id"
