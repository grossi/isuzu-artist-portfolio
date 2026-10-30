#!/usr/bin/env bash
# Uploads build/ to S3 with Cache-Control headers, then invalidates CloudFront.
#
# Usage: scripts/push-s3.sh [--dryrun] [--full]
#   --dryrun  Show what would be uploaded; skip the CloudFront invalidation.
#   --full    Re-upload every file (cp --recursive) instead of syncing. 'sync'
#             skips a file whose size matches and whose S3 copy is newer, so it
#             would keep that object's old metadata. A fresh 'yarn build' is
#             always newer, but --full guarantees every object gets the current
#             headers (e.g. the first deploy after changing them).
#
# Never add --delete: some objects (e.g. isuzubook.jpg) exist only in S3.
# Written for bash 3.2 (macOS): never expand an empty array under 'set -u'.
set -euo pipefail

BUCKET="s3://isuzu.work"
DISTRIBUTION_ID="E3FT8MC74I1LTP"

dryrun=""
upload="sync"
for arg in "$@"; do
  case "$arg" in
    --dryrun) dryrun="--dryrun" ;;
    --full) upload="cp --recursive" ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

cd "$(dirname "$0")/.."

# push <cache-control> <filters...>
push() {
  local cache_control="$1"
  shift
  echo "== Cache-Control: $cache_control"
  # shellcheck disable=SC2086 # $upload and $dryrun must word-split (or vanish when empty).
  aws s3 $upload build/ "$BUCKET" --acl public-read --cache-control "$cache_control" $dryrun "$@" --exclude "*.DS_Store"
}

include_images=()
exclude_images=()
for ext in jpg jpeg png webp gif svg ico; do
  include_images+=(--include "*.$ext")
  exclude_images+=(--exclude "*.$ext")
done

# Hashed bundles first and HTML last, so index.html never points at missing files.
push "public,max-age=31536000,immutable" --exclude "*" --include "static/*"
push "public,max-age=604800" --exclude "*" "${include_images[@]}" --exclude "static/*"
# Everything else (index.html, manifest.json, robots.txt, markdown, ...) is revalidated on every load.
push "no-cache" "${exclude_images[@]}" --exclude "static/*"

if [ -n "$dryrun" ]; then
  echo "(dryrun) aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths \"/*\""
  exit 0
fi

invalidation_id=$(aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" --query Invalidation.Id --output text)
echo "CloudFront invalidation $invalidation_id created. It usually completes within a few minutes; to wait for it:"
echo "  aws cloudfront wait invalidation-completed --distribution-id $DISTRIBUTION_ID --id $invalidation_id"
