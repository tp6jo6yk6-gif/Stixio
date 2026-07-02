#!/usr/bin/env bash
set -euo pipefail

REPOSITORY="${1:-tp6jo6yk6-gif/Stixio}"
BRANCH="${2:-main}"
PAYLOAD="${3:-.github/branch-protection-main.json}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required." >&2
  exit 1
fi

if [[ ! -f "$PAYLOAD" ]]; then
  echo "Branch protection payload not found: $PAYLOAD" >&2
  exit 1
fi

gh auth status >/dev/null

echo "Applying branch protection to ${REPOSITORY}:${BRANCH}"
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "repos/${REPOSITORY}/branches/${BRANCH}/protection" \
  --input "$PAYLOAD"

echo "Verifying branch protection"
gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "repos/${REPOSITORY}/branches/${BRANCH}/protection" \
  --jq '{required_status_checks, enforce_admins, required_pull_request_reviews, required_linear_history, allow_force_pushes, allow_deletions, required_conversation_resolution}'
