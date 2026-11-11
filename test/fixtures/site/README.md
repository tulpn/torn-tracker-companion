# Site fixtures

torn-tracker.com's replies to the companion API, for tests that run the real site client.

| File | What it is | Provenance |
|---|---|---|
| `lists.json` | CAPI-037: the lists read, an add, and every refusal of `POST /api/feeds/lists/{uuid}/entries`, each as `{status, data}` | Shapes as tc-targets#360 sends them (`feeds/lists.py`, `feeds/api.py`, 2026-10-26); list names, uuids and the player id made up |
| `../dashboard.json` | CAPI-038: the own dashboard read, `GET /api/feeds/me/dashboard`, as one `data` body: alerts, war, chain watch, chain, OC, awards, education, gym, goals, achievements, guide, money and the cards' links (hq #465, #491) | **Synthetic**, shaped as the companion API spec describes the reply (§6.4b, 2026-11-02); faction names, players and numbers made up. It sits one folder up for the older tests |
