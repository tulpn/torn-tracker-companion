---
title: The settings page
summary: Open the companion's settings from the Torn Tracker entry in Torn's sidebar; they open as a page inside Torn, with every setting on it.
section: Guides
group: settings
order: 110
type: reference
audience: everyone
icon: adjustments-horizontal
tier: core
keywords: companion settings, torn tracker settings, torn userscript settings page
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** free for everyone.

## Open the settings

Press **Torn Tracker** in Torn's sidebar, in the **Areas** list. With TornTools installed,
it sits right under **TornTools Settings**; otherwise it's the last entry in Areas. On a
phone or in Torn PDA, open Torn's menu first: the entry is in the same place there.

The settings open as a page inside Torn, at `torn.com/index.php#/torn-tracker`, where
Torn's home page would be. Torn's header, sidebar and chat stay where they are. Nothing is
loaded from anywhere to show them. You can bookmark the address, or open a section
straight away, for example `index.php#/torn-tracker/sharing`.

To leave, press **Close** or the **✕**, use your browser's **Back**, or follow any link.
Torn's home page comes back as it was.

A few full-screen Torn pages have no sidebar, so there's no entry there: open the settings
from any other page, or from the address above.

## Find a setting

Type in **Search settings** at the top to find any switch or option, in any section.
Changes are kept until you press **Save**, so you can move between sections freely; leaving
without saving throws them away. After **Save** you stay on the page, and it says
**Saved.** The page opens on the section you used last.

## The sections

- **General:** the version, a link to check for an update, the page's **Look**, the
  switches for [achievements](achievements.md), and console logging for troubleshooting.
  Your featured achievements show at the top of the page.
- **Features:** every feature, grouped by area (war, travel, market, crimes, gym, jobs),
  each with its switch, one line on what it does, its options, and a **Learn more** link to
  its page here. A feature that's off doesn't run at all. **Reset settings to defaults** is
  at the bottom.
- **Sidebar:** the [Torn Tracker sidebar block](sidebar.md): switch it off, or choose
  which lines it shows.
- **Sharing:** a switch for each kind of data the companion can share, every one off to
  start with. See [Choose what to share](what-is-shared.md). It also shows what's waiting
  to be sent and, if sharing has stopped, why.
- **Keys:** your torn-tracker.com [script key](website:script-key.md). It isn't a Torn API
  key, it's kept only on this device, and it's never written to the console.
- **Data:** what the companion keeps on this device, **Export** and **Import** for your
  [player notes](player-notes.md) and racing templates, and [Forget me](forget-me.md).
- **Credits:** every script the companion took an idea from, with its licence and a link.
- **Help:** the tours, this guide, troubleshooting, and where to report a problem.

## Your next guide step

If you started the torn-tracker guide on the website, every section of the settings page
starts with your next step: what it gets you, and a button straight to where it's done,
plus a link to the whole guide. If you haven't started it, one line offers it; once you
dismiss the guide on the website, that line is gone. Steps still tick only on the website,
from what you actually do. Switch the strip off under **General → Guide**.

> **What it reads and sends.** When you open a Torn page, at most once every 15 minutes,
> the companion asks torn-tracker.com for your next step, with your script key. It sends
> nothing else, never asks from the attack page or a background tab, and with the strip
> switched off it doesn't ask at all. The answer is kept on this device for 15 minutes,
> with the other cached answers.

## Tours

The first time you open the settings page, a short tour points out what's where. It takes
under a minute: **Next** (or the right arrow, or a swipe to the left on a phone) goes on,
**Back** goes back, and **Skip tour** (or Esc) ends it. It won't start by itself again
until the tour itself changes, and then it shows only what's new.

- Press **?** at the top of the settings page to see it again.
- **Help → Tours** lists every tour and whether you've done it. A tour of another page,
  such as the ranked-war page, starts when you next open that page (within ten minutes).
- When you switch a feature on and save, its page's tour starts at that feature the next
  time you open the page (within ten minutes), unless you've seen that step already.

Tours never start on their own while you're attacking or typing in a field. A step about
a feature you've switched off is left out. Which tours you've seen is kept on this
device and goes with [Forget me](forget-me.md).

The page is dark to start with, in torn-tracker.com's colours. Under **General → Look**
you can make it light, or **Same as Torn** to follow Torn's own light or dark theme. What
the companion adds to Torn's pages (labels, panels, the sidebar block) always follows
Torn's theme, so it matches the page around it. When it's narrower than 600 px (on a phone
or in PDA), its menu moves to the top and scrolls sideways; every button is big enough
for a thumb.
