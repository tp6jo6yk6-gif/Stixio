#!/usr/bin/env bash
set -euo pipefail

awk '
  /python3 - <<.PY./ { capture=1; next }
  /^          PY$/ { capture=0 }
  capture { sub(/^          /, ""); print }
' .github/workflows/apply-native-workspaces.yml > /tmp/native-workspace-migration.py

python3 /tmp/native-workspace-migration.py
node --check src/ui/stixio-workshop-app-v2.js
npm ci
npm test
npm run build
