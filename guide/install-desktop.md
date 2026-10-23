---
title: Install on desktop
seo_title: Install the Torn Tracker Companion in Tampermonkey
summary: Install the companion in Tampermonkey or Violentmonkey from its release link, so it keeps itself up to date.
section: Get started
order: 20
type: tutorial
audience: everyone
icon: computer-desktop
tier: core
guide_step: 4
duration: 2 minutes
keywords: install torn userscript, tampermonkey torn, violentmonkey torn
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** free for everyone.

## Install a script manager

Install [Tampermonkey](https://www.tampermonkey.net) or
[Violentmonkey](https://violentmonkey.github.io) in your browser. Either works.

## Install the companion

1. Open the [latest release](https://github.com/tulpn/torn-tracker-companion/releases/latest).
2. Click **torn-tracker-companion.user.js**. Your script manager opens an install page.
3. Check that it lists two hosts it may talk to, `www.torn-tracker.com` and
   `api.torn.com`, and press **Install**.

## Check it works

Open any page on torn.com. A **Torn Tracker** entry appears in the sidebar's **Areas**
list (right under **TornTools Settings** if you have TornTools). It opens the companion's
[settings](settings-panel.md) as a page inside Torn. Under **Lists** you'll also find the
[Torn Tracker block](sidebar.md) with your chain, war and dibs.

## Add your script key

In the settings, under **Keys**, paste your [script key](website:script-key.md) and press
**Save**. Without it, the features that show torn-tracker.com's data stay quiet; the
helpers that only read the page still work.

## Updates

Your script manager checks the release link and updates the script by itself. See
[Updates and test releases](updates-and-test-releases.md).
