#!/usr/bin/env bash
# 本機模擬 CI：LayoutPlanner 單元 + e2e（與 .github/workflows/layout-planner-tests.yml 相同步驟）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/modules/InteriorDesigned"
npm ci
npm run test:unit
npx playwright install chromium
npm run test:e2e
