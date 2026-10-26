# Site fixtures

torn-tracker.com's replies to the companion API, for tests that run the real site client.

| File | What it is | Provenance |
|---|---|---|
| `lists.json` | CAPI-037: the lists read, an add, and every refusal of `POST /api/feeds/lists/{uuid}/entries`, each as `{status, data}` | Shapes as tc-targets#360 sends them (`feeds/lists.py`, `feeds/api.py`, 2026-10-26); list names, uuids and the player id made up |
