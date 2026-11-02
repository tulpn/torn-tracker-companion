---
title: Your dashboard inside Torn
summary: A preview of your torn-tracker.com dashboard on Torn's own page, with charts of your money and battle stats. Off until you switch it on.
section: Guides
group: features
order: 206
type: how-to
audience: everyone
icon: chart-bar
tier: core
keywords: torn tracker dashboard, torn dashboard in game, torn tracker companion dashboard, torn stats chart
---

> **Test release.** The companion is in public testing. Things may change before version 1.
> The dashboard is a preview inside that, switched off by default.

**Core:** free for everyone. Needs your [script key](website:script-key.md).

## Switch it on

1. Open the [settings](settings-panel.md) and go to **General**.
2. Tick **Dashboard (preview)**.
3. Press **Save**.

A **Dashboard** link shows at the top of the settings page. It opens the dashboard in
Torn's main column, at `torn.com/index.php#/torn-tracker/dashboard`.

## What you see

The top card says who you are, your level and faction, your rank on torn-tracker.com and
at most two next steps. Below it, one card for each thing torn-tracker.com knows about you:

- **Bars:** energy, nerve, happy and life as last read, with any cooldowns. They don't
  count up on this page; Torn's own sidebar does that.
- **Money, last 7 days:** income and costs per day, as a chart.
- **Next gym:** how far you are to the next gym. It's an estimate, not Torn's figure.
- **Savings goals**, **Next achievements**, **Getting started** and **Education**.
- **Chain**, **Ranked war** and **Organized crime**, the same as the sidebar block shows.
- **Battle stats:** your stats over time, as a chart.

A card with nothing to show is left out. Every chart has **Show the numbers** under it,
with the same values as a table. Each card ends with **More on torn-tracker.com**, which
opens the full page there in a new tab.

> **What it reads and sends.** Each time you open the dashboard, the companion asks
> torn-tracker.com once, with your script key, for your dashboard, and keeps the answer
> for a minute. It sends nothing else and asks nothing while the page is closed. It reads
> nothing from Torn's pages for this.

## If it says something else

- **Needs your script key:** add it under **Keys** in the settings.
- **Refused the script key:** check it under **Keys**; it may have been revoked.
- **Asked to wait:** torn-tracker.com limits how often the dashboard is read. Try again
  in a minute.
