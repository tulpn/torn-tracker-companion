---
title: Add to list
seo_title: Add Torn players to your target lists from their profile
summary: A button on a player's profile that adds them to one of your torn-tracker.com target lists, or takes them off.
section: Guides
group: features
order: 225
type: how-to
audience: everyone
icon: queue-list
tier: core
keywords: torn target list, torn chain targets, add target torn, torn faction target list, torn profile button
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** free for everyone. Needs your script key, made with **Lists** ticked.

## What you see

On a player's profile, beside their name, a button with an arrow:

> Add to Chain targets ▾

- **The button** adds the player to the list you last added someone to. The first time,
  when there is no such list yet, it opens your lists instead.
- **The arrow** opens your lists: your own first, then the faction lists you may edit,
  tagged **Faction**. Each list has a tick box, ticked when the player is already on it.
  Tick a list to add them; untick it to take them off. **Open** beside a list opens that
  list's own page on torn-tracker.com in a new tab, under the name you see here.
  **Manage lists** at the bottom opens all your lists there.

After a change the button says where the player is now, like "On 2 lists". If a list was
deleted, or a faction list became read-only for you, it says "That list isn't yours to
change" and leaves it out of the menu. On a faction list, only whoever added a player, or
the list's owner, can take them off again.

If torn-tracker.com can't be reached when the profile opens, the button stays away for
that visit; open the profile again later. If the site is only busy, the button says
**Lists didn't load. Retry**.

One click is one change on torn-tracker.com. It never attacks, and it does nothing in Torn
itself.

## Setting it up

The button needs your script key, and the key must be made with **Lists** ticked. Without it, the
button says **Add your script key** and opens the [settings](settings-panel.md) at Keys.
Make a key with **Lists** ticked on torn-tracker.com and save it there.

Switch it off in the settings: **Add to list**, under **War and attacks**. Switched off,
it asks nothing.

> **What it reads and sends.** It reads only the id of the player whose profile you
> opened. When the profile opens, it sends that id to torn-tracker.com with your script
> key, to see which of your lists the player is on; the answer is kept for 5 minutes. When
> you click, it sends the id and the list you chose, and whether to add or remove them.
> Nothing else about the profile, or about you, is read or sent.
