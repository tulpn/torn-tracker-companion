# torn-script-template

Starter for Torn.com userscripts published by ares313377 / tulpn. Pairs with the `torn-script` Claude skill, which holds the conventions and the publish checklist.

## New project

1. Create a repo from this template (GitHub "Use this template"), clone it.
2. Run the setup once:

   ```powershell
   .\setup.ps1 -Name "Torn Item Market - Shop Sell Price Highlighter" `
               -Slug torn-item-market-highlighter `
               -Description "Highlights Item Market listings cheaper than the shop sell price." `
               -Match "https://www.torn.com/page.php?sid=ItemMarket*" `
               -Prefix tmsh -PageName "the Item Market"
   ```

   It fills the `{{PLACEHOLDERS}}`, renames `script.user.js`, sets the repo-local git identity and deletes itself. `THREAD_ID`, `GREASYFORK_ID` and `GREASYFORK_SLUG` stay as placeholders until the thread and the Greasy Fork page exist.
3. `npm install && npm test`, then commit `package-lock.json` so CI installs deterministically with `npm ci`.
4. Write the page logic in the marked section of the script, tests in `test/`, then fill README.md, forum-post.html and CLAUDE.md.
5. Screenshots into `pics/` (`browser.png`, `torn-pda.jpg`, `menu-preview.png`), then `.\tools\resize-pics.ps1`.
6. Delete this file.

## What is in here

| Path | Purpose |
| --- | --- |
| `script.user.js` | Userscript skeleton: header, settings panel, PDA/localStorage shim, DOM builder, scan loop |
| `test/` | jsdom + node:test harness with PDA storage fake |
| `build-data.ps1` | Fetch static Torn API data once and embed it between markers |
| `tools/resize-pics.ps1` | Forum-sized screenshot copies |
| `README.md`, `forum-post.html`, `CLAUDE.md` | Documents with placeholders |
| `LICENSE` | Torn Scripts No-Modification License |
| `.github/workflows/test.yml` | CI: `npm test` on push and PR |
