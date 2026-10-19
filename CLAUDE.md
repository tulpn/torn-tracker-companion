# {{SCRIPT_NAME}}

Torn userscript built from the `torn-script-template`. Follow the `torn-script` skill for conventions and the publish checklist.

## Facts for this project

- Script file: `{{SCRIPT_SLUG}}.user.js`, match: `{{MATCH}}`, prefix: `{{PREFIX}}`
- Forum thread: t={{THREAD_ID}} (fill after posting; also sets `@supportURL`)
- Greasy Fork: id {{GREASYFORK_ID}}, slug {{GREASYFORK_SLUG}} (fill after import)
- Embedded data: <!-- what build-data.ps1 fetches, or "none" -->

## Rules

- Commit as `tulpn <1031452+tulpn@users.noreply.github.com>` (repo-local config, set by setup.ps1). Never the global identity.
- Bump `@version` on every change once the script is on Greasy Fork.
- No runtime network requests, no API key, no innerHTML, no GM_* functions.
- `forum-post.html` is the live forum text; keep it in sync with README changes.
- Run `npm test` before every push.

## Decisions log

- <!-- date: decision and why -->
