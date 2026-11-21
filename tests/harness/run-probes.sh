#!/usr/bin/env bash
# Probe every playground page through the extension harness.
# Usage: bash tests/harness/run-probes.sh  (from D:/_code/react-path-inspector)
set -u
SESSION="rpi-ea401c00a541"
BASE="http://localhost:3000"
OUT_DIR="tests/harness/out"
mkdir -p "$OUT_DIR"

# name|url|selector (selector is plain CSS, base64-encoded per run)
CASES=(
  'home|/|a[href="/signup"]'
  'signup-combobox|/signup|input[placeholder="Search countries…"]'
  'signup-textarea|/signup|textarea'
  'dashboard-sidebar|/dashboard|nav[aria-label="Dashboard"] a'
  'settings-segmented|/dashboard/settings|[data-slot="segmented-control"]'
  'billing-combobox|/dashboard/billing|input[placeholder="Search coupons…"]'
  'products-list|/products|a[href="/products/merino-tee"]'
  'product-detail|/products/merino-tee|button[type="submit"]'
  'blog-post|/blog/engineering/reading-react-fibers|article p'
  'about-accordion|/about|main section button'
  'pricing-radio|/pricing|label'
  'streaming-note|/streaming|main > p code'
  'props-lab-rating|/props-lab|main section div output'
  'popups-dialog-trigger|/popups|main section button'
  'gallery-tabs|/gallery|main section button'
  'legacy-input|/legacy|input[placeholder="Something to remember…"]'
  'errors-bomb|/errors|main section p'
  'messages-textarea|/messages|textarea[placeholder="Write the reply…"]'
  'booking-select|/booking|main [role="tablist"] button'
  'contact-textarea|/contact|textarea[placeholder="At least ten characters…"]'
)

for case in "${CASES[@]}"; do
  name="${case%%|*}"
  rest="${case#*|}"
  url="${rest%%|*}"
  sel="${rest#*|}"
  sel_enc=$(python -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$sel")

  echo "=== $name $url ($sel)"
  agent-browser --session "$SESSION" open "$BASE$url" > /dev/null 2>&1

  # wait until the selector exists (dev server compiles routes lazily)
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    found=$(agent-browser --session "$SESSION" eval "!!document.querySelector(decodeURIComponent('$sel_enc'))" 2>/dev/null)
    if [ "$found" = "true" ]; then break; fi
    sleep 2
  done
  if [ "$found" != "true" ]; then
    echo "{\"error\": \"selector never appeared: $sel\"}" > "$OUT_DIR/$name.json"
    continue
  fi

  sleep 1.5 # settle hydration
  agent-browser --session "$SESSION" eval "window.__RPICONFIG = { selector: decodeURIComponent('$sel_enc') }; 'ok'" > /dev/null 2>&1
  cat tests/harness/page-probe.js | agent-browser --session "$SESSION" eval --stdin > "$OUT_DIR/$name.json" 2>&1
  echo "    -> $OUT_DIR/$name.json"
done

echo "ALL PROBES DONE"
