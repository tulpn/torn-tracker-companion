<!--
The "Additional info" text for the Greasy Fork listing (Markdown). Paste it by hand on
Greasy Fork when the listing is imported; the code itself syncs from the release asset
(RELEASING.md). Keep it in step with the README and src/core/disclosure.js: every claim
must match what the code reads and sends (hq #649, #687).
-->

# Torn Tracker Companion

torn-tracker.com and the community's best tools, on the Torn pages you already use. Every
feature has its own switch. It wears torn-tracker.com's raven and violet look, in Torn's
dark and light modes.

**Public test (0.x).** Things may change before version 1.0, and some features wait on
torn-tracker.com or on Torn's page layout.

## After installing

Open **Torn Tracker** in Torn's sidebar (under Areas; in the slide-out menu on a phone or in
Torn PDA). The settings open as a page inside Torn, with a short tour the first time.

In **Torn PDA**, add the script from its URL (UserScripts > Add), not by pasting the text,
so PDA can update it:
`https://github.com/tulpn/torn-tracker-companion/releases/latest/download/torn-tracker-companion.user.js`

## What you see

- **Fair-fight badges** beside players on profiles, faction pages (the war page too), the
  attack page and the bounty board, from torn-tracker.com's estimates.
- **War page**: sort the opponents and see your faction's dibs; a pre-war strip on the
  opponent's faction page.
- **Travel**: foreign shop stock, the best buy abroad, and your best runs on the travel agency.
- **Trading**: a shop price guard on the Item Market and your own sell forms, a price filler
  that never fills below a shop, trade value, auction value badges, and a reminder to bank
  your cash before you list.
- **Crimes**: morale, value per nerve and burglary targets; weights and success chances for
  organized crimes; bust safety on the jail page.
- **Attacks**: loadouts on profiles and the attack page, how often you mugged a player, and a
  badge on players torn-tracker.com lists for mugging sellers just after a sale.
- **Target lists**: **Add to list** on a player's profile puts them on your torn-tracker.com
  list in one press.
- **Chain watch**: a large chain timer over whatever Torn page you're on, coloured by how
  soon the chain needs a hit. It never hits for you. Sign up for your faction's watch rota in
  the settings.
- **Bounty board**: filter by reward, fair fight and level, and see which hospital timers are
  nearly up.
- **Jobs**: applicant badges show an applicant's shared job-board card on your company or
  faction applications.
- **Everyday**: gym progress, merit hints, stock signals, racing templates, private player
  notes and message templates.
- **Your sidebar**: a Torn Tracker block under Lists with your chain, chain watch slot, war,
  dibs, med-out partner and OC.
- **Dashboard (preview)**: your torn-tracker.com dashboard as a page inside Torn.

Every block that shows Torn or torn-tracker.com data says how old it is ("Updated 3m ago"),
and says so when it may be out of date.

The guide has a page for every feature: <https://torn-tracker.com/guide/companion/>

## What it reads and sends

- It reads **only the Torn pages you open yourself**: the page, and the replies Torn sends
  that page (it watches them, never changes or repeats them). It never loads torn.com pages
  in the background.
- **One click is at most one game action.** It fills in fields for you but never submits
  them, and it never buys, sells, attacks or claims anything.
- It talks only to **torn-tracker.com**, with your torn-tracker.com script key (which is not
  a Torn API key). Features that need the site ask it only for the ids on the page they need,
  for example the players listed for fair-fight badges. Once a day the shop price guard reads
  torn-tracker.com's public item catalogue, with no key at all.
- **Sharing starts off.** Under Sharing you can choose to send what Torn showed you, kind by
  kind: foreign stock, auction listings, item market prices, bazaar listings, loadouts, jail
  difficulty bands (the site doesn't keep these yet), and your own crime outcomes, gym
  progress and gym trains. Each switch says what it sends and what torn-tracker.com keeps
  and publishes; nothing goes until you agree. The site never publishes who sent anything,
  except that a player can see who reported their own loadout.
- **Company and faction application pages** share nothing, whatever is switched on. There,
  Applicant badges sends torn-tracker.com only the applicants' player ids and which list it is.
- **Some buttons send what you ask, only when you press them.** Add to list adds or removes
  that player on your own lists. A chain watch sign-up sends your slot and role, which your
  faction can see; it is deleted 7 days after the slot ends.
- Every request to torn-tracker.com says the script's version and whether it runs in Torn PDA
  or a desktop browser. Nothing else about your device.

## API Terms of Service

| Data Storage | Data Sharing | Purpose of Use | Key Storage & Sharing | Key Access Level |
|---|---|---|---|---|
| On your device: settings, notes and templates. On torn-tracker.com: only the kinds you switch on under Sharing, kept as the README's table says, plus the list entries and chain watch sign-ups you make yourself. | Only torn-tracker.com, and only the kinds you switch on. The site publishes combined data, never who sent it (except that a player can see who reported their own loadout). Your chain watch sign-ups are shown to your faction. | Bringing torn-tracker.com's estimates and community data onto the Torn pages you use. | This version asks for no Torn API key. Your torn-tracker.com script key stays on your device and goes only to torn-tracker.com. | None required. |

"Forget me" under Settings > Data clears everything on this device; uninstalling the script
does too.

## Source and licence

The code is open on GitHub under GPLv3: <https://github.com/tulpn/torn-tracker-companion>,
with a test suite and a lint that fails the build on anything Torn's scripting rules forbid.
Some features build on other open scripts, credited by name under Settings > Credits and in
the README.

Bugs and ideas: reply in the Torn forum thread, or open an issue on GitHub.
