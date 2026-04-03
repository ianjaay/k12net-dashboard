#!/bin/bash

# Merge dev → main via Pull Request

REPO="ianjaay/k12net-dashboard"
CURRENT_BRANCH=$(git branch --show-current)

# Ensure we're on dev
if [ "$CURRENT_BRANCH" != "dev" ]; then
  echo "⚠ You are on '$CURRENT_BRANCH', not 'dev'. Switch to dev first."
  exit 1
fi

# Show commits that will be merged
echo ""
echo "Commits in dev not yet in main:"
echo "────────────────────────────────"
git log origin/main..HEAD --oneline
echo "────────────────────────────────"
echo ""

# Confirm
read -p "Create a Pull Request to merge dev → main? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# Push dev first
echo "Pushing dev..."
git push origin dev

# Check if a PR already exists
EXISTING_PR=$(gh pr list --repo "$REPO" --head dev --base main --json number --jq '.[0].number' 2>/dev/null)

if [ -n "$EXISTING_PR" ]; then
  echo ""
  echo "A PR already exists: https://github.com/$REPO/pull/$EXISTING_PR"
  read -p "Open it in the browser? (y/n): " OPEN
  if [[ "$OPEN" == "y" || "$OPEN" == "Y" ]]; then
    gh pr view "$EXISTING_PR" --repo "$REPO" --web
  fi
else
  # Create the PR
  PR_URL=$(gh pr create \
    --repo "$REPO" \
    --base main \
    --head dev \
    --title "Merge dev into main" \
    --body "$(cat <<'EOF'
## Summary
Merging latest updates from `dev` into `main`.

## Checklist
- [ ] Changes tested locally
- [ ] Ready for production
EOF
)")
  echo ""
  echo "PR created: $PR_URL"
  read -p "Open it in the browser? (y/n): " OPEN
  if [[ "$OPEN" == "y" || "$OPEN" == "Y" ]]; then
    gh pr view --web --repo "$REPO"
  fi
fi
