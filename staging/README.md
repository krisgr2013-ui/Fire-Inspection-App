# Gold Standard V29.6 QA staging

This directory is a **placeholder**, not the current app. The current V29.6 QA package must be added here before any deployment. The manual workflow intentionally checks for `staging/index.html` and fails if it is missing.

QA Supabase project: `zhhgbwxjyhypxzqqbcqu`. Billing and email are disabled in the QA build. Never upload service-role keys or other privileged credentials. Do not replace or publish the older React/Vite app as V29.6.

Deployment target: separate Cloudflare Worker `gold-standard-qa`; **never** `gold-standard` (production). Before running the workflow, verify the exact release files, Cloudflare account ID, restricted token, and a non-production URL. Keep the pull request in draft until the files are reviewed and live browser tests pass.
