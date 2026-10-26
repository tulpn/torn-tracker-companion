---
title: Troubleshooting
summary: The Torn Tracker link doesn't show, a feature stays quiet, or your key is refused; what to check first.
section: Help
order: 510
type: how-to
audience: everyone
icon: wrench-screwdriver
tier: na
keywords: companion not working, torn userscript not showing, script key refused
---

> **Test release.** The companion is in public testing. Things may change before version 1.

## The Torn Tracker entry doesn't appear

- Check the script is switched on in your script manager or in Torn PDA.
- Reload the Torn page.
- On a phone or in PDA, open Torn's menu: the entry is in its **Areas** list.
- A few full-screen pages have no sidebar. Open another page, or go straight to
  `torn.com/index.php#/torn-tracker`.
- In PDA, check you added it [from its URL](install-pda.md#add-the-script-from-its-url).

## A feature stays quiet

- Open the settings, go to **Features** and check the feature is switched on.
- Most features need your [script key](website:script-key.md) in the **Keys** tab.
- A badge showing **?** isn't an error: torn-tracker.com has no data for that player yet.
- If a feature hits a problem, it switches itself off until you open the next page, and
  the rest carry on.

## Sharing has stopped

The **Sharing** tab says why. The usual reasons:

- the explanation of what's shared changed in an update: read it and press **Share the
  kinds I picked** again;
- your script key was refused: create a new one on torn-tracker.com and paste it in;
- the script is too old for a kind: let it update.

## Installed twice

If the companion is installed twice, say once from Greasy Fork and once from GitHub, or
added twice to Torn PDA's scripts, only the copy that starts first runs; the other does
nothing. To know which one you're running, remove one: the version
under **General** in the settings is the one that runs.

## Your key is refused

Script keys can be revoked on torn-tracker.com. Create a new one, paste it in the **Keys**
tab and press **Save**.

## Still stuck

Open an issue on the companion's GitHub page, saying what you expected, what happened, and whether it was in a browser or in Torn PDA.
