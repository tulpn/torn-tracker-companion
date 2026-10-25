---
title: Message templates
summary: Keep the messages you send often, and fill one in for a player from their profile, ready to check and send.
section: Guides
group: features
order: 316
type: how-to
audience: everyone
icon: document-text
tier: core
keywords: torn message templates, torn mail templates, torn recruitment message, torn trade message, torn buy list message
---

> **Test release.** The companion is in public testing. Things may change before version 1.

**Core:** free for everyone. No key needed.

## Send a message from a template

1. Open the player's profile.
2. Beside their name, press **Messages**.
3. Pick a template. The preview shows it filled in for that player.
4. Press **Write message**. Torn's new-message page opens for that player, with the
   subject and the message filled in. Read it over, then press **Send** yourself.

Or press **Copy message** and paste it into a Torn message or chat.

The companion never sends anything for you, and it works one player at a time.

## Add a template to a message you're writing

On Torn's new-message page, above the form, pick a template and press **Insert**. It goes
below what you've already written, and fills in the subject if that's still empty. The
player's name, faction and level aren't on that page, so those placeholders stay as
written, and the companion names them for you to fill in.

## Placeholders

Write these in a template and they're filled in for you:

| Placeholder | What goes in | Comes from |
|---|---|---|
| `{name}` | the player's name | their profile |
| `{id}` | the player's ID | their profile |
| `{faction}` | the player's faction | their profile |
| `{level}` | the player's level | their profile |
| `{my_name}` | your name | the settings |
| `{my_buylist}` | your buy list link | the settings |
| `{my_calc}` | your price calculator link | the settings |
| `{pct}` | your buying price, % of market value | the settings |

Set your own values in the [settings](settings-panel.md): **Message templates**, under
**Everything else**.

If the profile doesn't show something (a player with no faction, say), or you haven't
set one of yours, the placeholder stays as written, like `{faction}`, and the preview
marks it in yellow. Fill it in yourself before you send. The companion never guesses.

## Write your own

- **New template:** give it a name, a subject and the message, then **Save template**.
- **Edit:** change the template you've picked. **Delete** removes it.

You start with seven: a trade offer, buying at your price, a recruitment invitation, a
faction welcome, a war call-up, an armory return reminder and a job offer. Change or
delete any of them. You can keep up to 20.

## Keep a copy, or move them to another device

In the [settings](settings-panel.md), under **Data**, **Export** puts your templates in a
box as text, along with your [player notes](player-notes.md) and racing templates. On the
other device, paste it into the same box and press **Import**.

> **What it reads and sends.** The profile you have open, for the player's name, ID,
> faction and level, and the new-message page you have open, to write into its subject
> and message. Between the two pages, the filled-in message waits in this browser tab
> for ten minutes at most, and is removed once used. Your templates and your own values are kept only on this device, in
> the companion's settings. Nothing is sent anywhere. **Forget me** deletes them, along
> with everything else the script keeps.
