#!/usr/bin/env bash
# Read-only health check for verify-should-i-watch-for-netflix. Run from anywhere in the repo.
# Exit 0 = ready to drive. Prints one line per check; never prints credential values.
cd "$(git rev-parse --show-toplevel)" || exit 2
fail=0
ok()  { echo "ok    $1"; }
bad() { echo "FAIL  $1"; fail=1; }

[ "$(node -p "require('./package.json').name")" = "should-i-watch-for-netflix" ] && ok "repo is should-i-watch-for-netflix" || bad "not the should-i-watch-for-netflix repo"
[ -d node_modules ] && ok "node_modules present" || bad "run npm install"
if [ -f dist/manifest.json ]; then
  stale=$(find src manifest.json public -newer dist/manifest.json -type f | head -1)
  [ -z "$stale" ] && ok "dist/ is newer than src/ ($(node -p "require('./dist/manifest.json').name"))" || bad "dist/ is stale (newer: $stale), run npm run build"
else
  bad "dist/ missing, run npm run build"
fi
PW="$(npm root -g)/@playwright/cli/node_modules/playwright-core"
{ [ -d node_modules/playwright-core ] || [ -d "$PW" ]; } && ok "playwright-core resolvable" || bad "no playwright-core (npm i -g @playwright/cli)"
CH=$(ls -d "$HOME"/Library/Caches/ms-playwright/chromium-*/chrome-mac-*/"Google Chrome for Testing.app" "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | tail -1)
{ [ -n "$VERIFY_CHROMIUM" ] || [ -n "$CH" ]; } && ok "Chromium found (${VERIFY_CHROMIUM:-$CH})" || bad "no Playwright Chromium (npx playwright install chromium) or set VERIFY_CHROMIUM"
command -v ffprobe >/dev/null && ok "ffprobe present (clip duration check)" || bad "ffprobe missing (brew install ffmpeg)"
[ -n "$EV" ] && [ -d "$EV" ] && ok "EV evidence dir set" || bad "EV not set or not created"
case "$EV" in "$PWD"/*) git check-ignore -q "$EV/probe" && ok "EV is git-ignored" || bad "EV is inside the repo and not ignored";; esac
for v in VERIFY_SHOULD_I_WATCH_FOR_NETFLIX_TMDB_KEY VERIFY_PROFILE_DIR; do
  [ -n "${!v}" ] && echo "set   $v (only the Netflix feature needs it)" || echo "unset $v (only the Netflix feature needs it)"
done
exit $fail
