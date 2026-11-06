# Changelog

Everything worth knowing about each release. The newest is at the top. Versions follow
[semantic versioning](https://semver.org): the patch number changes for fixes, the minor
for new features, the major when something you rely on changes.

A release is published when its version reaches `main`; the workflow tags it, publishes the
built script and uses the section below for its notes. `## Unreleased` collects what is coming next.

## Unreleased

### Changed

- The sharing lines now say exactly what the code sends: a gym train includes the energy and
  the number of trains when Torn's answer gives them; jail bands aren't kept or published,
  because the site doesn't accept them yet; and an auction listing goes again as soon as its
  bid changes, otherwise at most every ten minutes. The wording changed, so if you share,
  read the new lines and agree again (hq #649).
- The README and the guide now say that Applicant badges sends the applicants' ids to
  torn-tracker.com, that features showing the site's data look up the ids they need, and
  that settings save as you change them, with no Save button. The guide has a section for
  jail difficulty bands (hq #649).

## 0.9.15 — 2026-11-06

### Changed

- The script wears the torn-tracker raven: it is the icon in your script manager, and it heads the sidebar block in place of the old “TT” badge. The icon is carried inside the script, so nothing is fetched for it (hq #639).
- On the war page, a traveller's destination is a two-letter code (`→ UK`, `in KY`) that fits the status cell on one line; the full name is in its hover text (hq #557).

## 0.9.14 — 2026-11-05

### Added

- The sidebar block has a **Routine** line: how many of today's routine lines are still undone, with the list on tap, each opening its Torn page. It reads the site's routine (hq #599); until the site serves it, the line stays hidden. With Casino off, no casino line ever shows.

### Changed

- The fair-fight badge shows the full figure, the same one FFScouter shows (5.91 or 12.4, no longer cut off at 3.00), and its colour says how hard the fight is: easy, moderate (green), difficult (amber) or may be impossible (red). The hover text says that Torn pays respect for at most 3.00× (hq #592).

### Fixed

- War page with another script's line under each row (such as a stats estimate): the hospital timer and the Dibs button no longer drop out of their row onto the line below. At every window width the timer now stands in for Torn's word in the status cell (the word is in its tooltip), and Dibs is a small icon before the banner, both on one line (hq #535).
- Sidebar block after a crime or any page load: it no longer shows "no data" on every row when its first read fails or has to wait. It shows the last answer it had, from up to 90 minutes before, with an "As of 6m ago" line once that answer is two minutes old, until the next read replaces it. It asks the site no more often than before (hq #606).
- Gym: the energy still to your next gym is one line in Torn's welcome box at the top of the page, under Torn's own lines ("Next gym (name): 84 %, about 2,896 E to go (estimate)"), no longer a narrow pill under the next gym's tile that wrapped a word at a time over the grid (hq #610).

## 0.9.13 — 2026-11-05

### Fixed

- War page in a narrow desktop window: the hospital timer no longer lands on Torn's own
  status text. It stays on one line, and where the cell has room for only one thing it
  stands in for Torn's word, which moves to its tooltip. The Dibs button no longer covers
  the member's banner: it becomes a small icon before it, its label in the tooltip
  (hq #535).

- Gym progress: a train is shared from the gym's own answer to it, with the gain its
  message names, the energy spent and the number of trains, so it no longer needs the
  page's gym info first. The gym in progress is read from that answer too when the page's
  buttons don't read, and the page's gym ids now read with Torn's hashed class names. The
  debug log names which part of the gym button didn't read, and Torn's class names in it
  (hq #576).

## 0.9.12 — 2026-11-04

### Changed

- Gym progress: with debug on, the log says why nothing was captured (no gym buttons found,
  none in progress, or a gym in progress that didn't read) and why a train wasn't shared,
  and names the fields of the gym's train answer (names only, never values) (hq #576).

## 0.9.11 — 2026-11-04

### Changed

- Sidebar: a ranked war that is set but hasn't started counts down to its start, then says
  "starting". A crime that hasn't started reads **expired** once it passes its expiry, and
  counts down to it when it has no ready time yet (hq #541).

### Fixed

- Dashboard: the war card keeps showing a war that is set but not started when the site
  calls it `matched` instead of `scheduled` (hq #541, tc-targets #582).

## 0.9.10 — 2026-11-04

### Changed

- Sidebar block: **War** opens your faction's ranked war and **OC** your faction's crimes,
  in the same tab. The war's end, the OC's ready time, the chain's timeout and your dibs
  count down every second, and say **ending**, **ready**, **timed out** or **expired** at
  zero until the next read.

### Fixed

- War page: one timer per opponent. Where another script (Torn War Stuff Enhanced) already
  shows a countdown or destination in the status cell, the companion no longer draws its
  own on top. Waits of an hour or more show hours (`2:11:34`, not `131:34`).
- War page: the fair-fight badge and the Dibs button stay on one short line in the member
  cell instead of wrapping into tall pills over the name.
- The undersell warning sits on its own line under the price field and the Fill button,
  instead of squeezing the field (hq #557).
- No fair-fight badge on rows where FF Scouter's script already shows its estimate
  (hq #557).
- The war page's loadout label and the player-note badges in member lists are short, one
  line in Torn's row: **Heavy +1**, or the note's tag. Hover or tap for the rest (hq #557).
- The Dibs button is a finger's size on touch screens: 32 px high, at least 44 px wide
  (hq #557).

## 0.9.9 — 2026-11-02

### Changed

- Settings save as soon as you change them; there is no Save button any more. A short
  "Saved." note shows at the top for three seconds.
- On a narrow screen or in Torn PDA, the settings sections are a menu at the top instead of
  a row of tabs that ran off the screen.
- The sharing wording changed (version 9): if you share data, the Sharing tab asks you to
  agree again before anything more is sent.

### Fixed

- The companion now sees Torn's own page requests again under Tampermonkey and other script
  managers, so the observations you switched on in Sharing are captured and uploaded. Before,
  it watched its own sandbox instead of the page, and nothing was sent.
- With **Debug** on, the console now shows each page response the companion read and how many
  features used it. On the gym page it also says when no gym in progress was found.
- The OC helper's role weight and success figures are small badges beside the slot,
  on one line, instead of large labels that broke the crime card's row. Hover or tap one
  to read what it means.
- The sidebar's **Watch** row shows only when you hold a chain watch slot or your faction has
  a watch open to sign up for, instead of always saying "Sign up to watch".
- The **Fill** button on the bazaar and item market sell forms is small again: it says just
  **Fill**, sits on one line with the price field, and is in the companion's green instead of
  black. Hover over it for the price it will fill.

## 0.9.8 — 2026-11-02

### Added

- Settings → General → **Sidebar block**: choose where the Torn Tracker block sits in
  Torn's sidebar: at the top above Areas, after Areas, after Lists or at the bottom. The
  choice is kept on this device; a page without that place shows the block at the next one
  down.
- When your account has no faction linked on torn-tracker.com, the sidebar block says so
  and links to the faction page, instead of leaving chain, war and dibs blank.

### Changed

- The sidebar block now sits at the top of Torn's sidebar by default. An existing install
  moves there once; the settings page says so under General, and **After Lists** puts it
  back where it was.

- Fair-fight badges: a player with no estimate shows **–** instead of **?**. A **?** now
  means only a rough idea of their stats. Hovering over a badge says whose estimate it is
  (FFScouter's are credited to them) and how old it is.

## 0.9.7 — 2026-11-02

### Fixed

- The settings page no longer shows a stray "null" under General.
- The search bar is easy to find: it's the first thing under the settings page's title,
  full width on a phone, with a **✕** to clear it.
- The sidebar block on Torn's Home page: with debug on, the console now says where the
  block went or why it isn't shown, and which items torn-tracker.com sent back empty.

### Changed

- The settings page's title bar shows only the title, the version and whether a script key
  is saved. Your featured achievements no longer show there, and their switch is gone; the
  achievement toast switch stays under General.
- The dashboard preview starts with what needs you now: ranked war, chain and organized
  crime come first. The top card, the bars and the battle-stats chart are gone.
- Each dashboard card's **More on torn-tracker.com** opens that card's own page; a card
  with no page of its own has no link. The full dashboard is one link, at the top.
- The dashboard preview has three new cards: **Alerts**, **Chain watch** (who is on watch
  now and next, your own next watch, and the slots with no Lead) and **Nearest awards**.
- The dashboard's **Ranked war** card says when a war starts and lists your dibs while it
  runs; **Education** shows your current course, its branch and your next pick.

## 0.9.6 — 2026-11-02

### Added

- A preview of your torn-tracker.com dashboard inside Torn, at
  `index.php#/torn-tracker/dashboard`: your bars, money, gym, goals, achievements, guide,
  education, chain, war and organized crime, with charts of your money and battle stats.
  It is off until you tick **Dashboard (preview)** under General, and it asks
  torn-tracker.com once each time you open it.
- Trade value can price a trade at a buy list on torn-tracker.com: your own (the other
  side's items, what you buy) or a trader's public list (your own items, what you sell).
  Choose it under **Trade value** in the settings. An item the list doesn't buy shows as
  "not on the list", never $0, and the receipt links to the list.

### Changed

- Add to list: each list in the menu has an **Open** link to that list's own page on
  torn-tracker.com, instead of only the general lists page.
- The lists menu under **Add to list** looks like the settings panel, in light and dark:
  one row per list with a tick box, 44 px tall on a phone, faction lists tagged **Faction**,
  and **Manage lists** as a button at the bottom. Unticking a list takes the player off it.

### Fixed

- On a profile, a loadout the player asked to hide now shows "Loadout hidden at the
  player's request" instead of no card at all.
- A player nobody has reported a loadout for isn't asked about on every visit to their
  profile; the companion asks again after 30 minutes.
- A shared observation whose kind isn't text is refused with a message instead of stopping
  the upload check.
- Every feature that waits for the page to settle (badges, helpers, templates, the war
  page, the shop and market helpers, bazaar sharing) now looks at the page within a second
  or two even while something else on it keeps changing (a clock, a chat, another script).
  Before, they waited for the page to go quiet, and on a busy page they never showed or
  shared anything.

## 0.9.5 — 2026-11-02

### Fixed

- Our buttons on a player's profile (Add to list, Messages, Add note) sit together in one
  row below the name, drawn like Torn's own buttons in light and dark, and 44 px tall on a
  phone. They were scattered around the title and lost their look to Torn's title styles.
- Message templates never filled in `{level}` on a player's profile. Torn shows the level in
  the Level box beside the picture, not in the Basic Information table; it is read from
  there now.
- The sidebar block's quick links (Dashboard, Chains, Travel planner) never showed. The site
  writes its links on www.torn-tracker.com, and since 0.9.2 the script only accepted the
  bare host. Links on either spelling of the host are kept again, in the sidebar, the
  guide, the achievements page link, the trust link and applicant cards. The guide's answer
  is kept for its 15 minutes again instead of being asked for on every check.
- 0.9.4 showed no sidebar block and read nothing when The Contract was installed too. 0.9.4
  took our marker off The Contract's copy of the Torn Tracker entry, The Contract put it
  back, and the two kept at it; the script waited for the page to go quiet before placing
  the block, and it never did. The script no longer changes another script's copy (our mark
  on it stays hidden), and a page that keeps changing is looked at within a second anyway.
- The same wait could keep bust safety, gym progress and auction capture from ever reading
  their page, and so from sending anything, on a page with a ticking clock or a busy chat.
  They now read it within a few seconds however busy the page is.

## 0.9.4 — 2026-11-01

### Fixed

- The Contract's link in Torn's Areas list still showed the Torn Tracker "TT" icon. It
  copies the Torn Tracker entry, and that entry no longer had Torn's icon to copy. The
  entry now keeps Torn's icon (hidden only on the Torn Tracker entry itself), and the
  "TT" mark shows only on the real entry, so a copy looks like Torn's own link.
- On profile pages the script asked torn-tracker.com for the mug badge over and over while
  the site didn't have that read yet. A read the site can't answer now rests: 10 minutes
  when the site doesn't have it, as long as the site asks after "too many requests", and
  a minute after any other failure.
- Item market prices could go unshared on a busy market page: the script waited for the
  page to stop changing, and with other scripts redrawing it that never happened. It now
  looks within a second of the first change. With debug on it also says when nothing is
  shared because the kind is off under Sharing, the tab is hidden, or there's no script key.

## 0.9.3 — 2026-11-01

### Fixed

- Another script's link in Torn's Areas list (seen with The Contract) could end up with
  the Torn Tracker "TT" icon. The Torn Tracker entry is now only ever copied from Torn's own
  links, never changes another script's row, and takes its icon back out of any copy
  another script makes of it.
- Nothing was shared after ticking kinds under Sharing and pressing Save: agreement was a
  separate "Share the kinds I picked" button, easy to miss below the switches. The first
  Save with a kind ticked now counts as your agreement to the wording on that screen; the
  button stays only for when that wording changes in an update.
- The Torn Tracker block in the sidebar went empty when you moved to another Torn page,
  until you pressed Save again. It now keeps its rows across pages, asks torn-tracker.com
  at most once a minute, and keeps showing the last rows when the site says "wait".

### Added

- Sharing shows a queue line: how many reports are waiting, when the last upload went and
  what torn-tracker.com answered.
- With "Log what the script does to the browser console" on (General), every report says
  in one line why it was or wasn't shared, what each upload sent and what came back, and
  what torn-tracker.com asked for. Off, nothing new is printed.

## 0.9.2 — 2026-11-01

### Fixed

- 0.9.0 and 0.9.1 could not reach torn-tracker.com from a browser: the site moved to
  `torn-tracker.com` without the `www.`, and the script manager refused to follow the
  redirect to a site the script hadn't named. The script now talks to `torn-tracker.com`
  directly. Installing or updating asks to allow `torn-tracker.com` too; `www.torn-tracker.com`
  stays listed, as the same site. Torn PDA is unchanged.

## 0.9.1 — 2026-11-01

### Fixed

- Site calls now go through the script manager; the previous build could not reach
  torn-tracker.com from a browser. Installing or updating asks to allow web requests to
  `api.torn.com` and `www.torn-tracker.com`, the two sites the script has always talked
  to. Torn PDA is unchanged.

## 0.9.0 — 2026-11-01

### Added

- **One off switch for toasts.** Pause all, or companion toasts off, in your notification
  settings on torn-tracker.com now also stops the companion's achievement toast and the
  chain watch slot notice; General says why while it's off. The toast's own switch in the companion stays.
- **Chain watch: watch mode.** A large chain timer over the Torn page you're on, so a
  watcher in another window can't miss it: green above 1:00, orange to 0:30, red
  flashing "HIT NOW" below, grey for no chain, and grey stripes for "No data" when no
  timer has come for 90 seconds. It reads Torn's chain bar when the page shows it, and
  otherwise asks torn-tracker.com for the faction's chain with the script key, at most
  every 30 seconds while on and visible. It never hits or clicks for you, and clicks go
  through it to the page. Size, place, colours, a preview and an optional beep are under
  Settings → Chain watch, kept on this device only. The flash is fixed at once every 2
  seconds.
- **Chain watch: the rota.** Under Settings → Chain watch, your faction's next 24 hours of
  30-minute watch slots (Lead, Backup 1, Backup 2), read from torn-tracker.com only when
  you ask. Sign up for a stretch, take a free role, or drop your own slot; a clash saves
  nothing and says what's still free. Your faction sees your name, slot and role; sign-ups
  are deleted 7 days after the slot ends. When your slot starts with watch mode off, a
  notice offers to turn it on. The sidebar gains a Watch line with your slot now or next
  and a watch mode switch.
- **Shop price guard** (wave 1). On the Item Market, a listing priced below what a shop
  in Torn pays for the item gets a coloured outline, a dot and its profit beside the
  price, like "+12.5k", with the details on hover. Green, yellow, red and blue go by
  profit per item or by margin; set the minimums, the listing total, and hiding the rest
  in the settings. The sidebar block counts those listings in a new "Below shop price"
  line. On your own sell forms (the Item Market's add-listing form and the bazaar's add
  and manage pages), a price below a shop's shows a warning as you type, naming the shop
  and what you'd lose; it never stops you listing. The price filler no longer fills below
  a shop's price, and says so when it stopped there. The prices come once a day from
  torn-tracker.com's public item catalogue, asked with no key, or from the table built
  into the script. Based on Torn Item Market - Shop Sell Price Highlighter by ares313377
  (GPLv3). Needs no script key.
- The script is built from modules under `src/` by esbuild, into one readable file plus
  the small `.meta.js` that update checks fetch.
- A lint that fails the build on anything Torn's scripting rules forbid, and a runtime
  guard the tests boot every page under.
- The settings panel has four tabs: Features (a switch per feature, with its options),
  Sharing, Keys and Credits. Edits are kept until you press Save, even when you move
  between tabs.
- A field for your torn-tracker.com script key. It is kept only on this device and is
  never written to the console, even with logging on.
- The upload queue. Whatever you choose to share waits on your device and goes to
  torn-tracker.com in small batches, at most once every 15 seconds and when you leave a
  page. It never holds more than 200 and drops anything older than 10 minutes. If the
  site asks it to slow down, refuses your key or needs a newer script, it stops and the
  Sharing tab tells you why.
- Every observation is checked against the site's rules for its kind before it is
  queued, so one bad entry can never spoil a batch.
- **Foreign shop stock** (wave 1). When you land abroad, the stock and price of every
  item in the shop, empty shelves included, can be shared with torn-tracker.com for its
  restock predictions. It reads what the shop page already loaded, at most once per
  country every 30 seconds and only while you are looking at the tab. It never buys
  anything. Like every kind of sharing, it is off until you switch it on.
- **Attack loadouts** (wave 1). On the attack page, once Torn shows the defender's
  weapons and armour, they can be shared with torn-tracker.com: each item, a weapon's
  damage and accuracy, and its bonuses as Torn names them. One report per fight, read
  from what the page already loaded; the script never clicks. Off until you switch it on.
- Nothing is ever shared from Torn's company or faction application pages, whatever is
  switched on.
- **Fair-fight badges** (wave 1). Beside each player on profiles, faction member lists,
  the ranked-war page and the attack page, a badge shows torn-tracker.com's fair-fight
  estimate, coloured on the scale FF Scouter players know: blue is easy, red is hard,
  and "?" means no estimate yet. All the players on a page are looked up together, and
  each answer is kept for an hour. Needs your script key.
- **Price filler** (wave 1). On the bazaar's add and manage pages and the item market's
  sell form, each item gets a "Fill" button showing the price it will put in: the
  torn-tracker.com market value minus your undercut (set it in the panel; $1 by
  default). One press fills that row's price and how many you own. You still press
  Torn's own button: the script never submits anything. Needs your script key.
- **War page: sorting and dibs** (wave 1). Above the opponents in a ranked war, sort them
  by status (hittable first), who is out soonest, level or fair-fight estimate, or put
  Torn's order back.
  Beside each opponent, a dibs button shows who in your faction has called them, with a
  countdown. Pressing it claims the target on torn-tracker.com, and pressing your own
  dibs releases them. It does nothing in the game. Dibs refresh every 15 seconds while
  the page is on screen. Beside each opponent's status, a countdown shows when they leave
  hospital or jail, and travellers show where they are flying, from torn-tracker.com's
  war room. "Out soonest" sorts by who can be hit next. Needs your script key.
- **Best buy abroad** (wave 1). On a foreign shop, the item that makes you the most money
  for what you can still carry and afford is outlined, with how many to buy and the
  profit at torn-tracker.com's market value. It updates as you buy. It only shows: you
  type the amount and press Buy. Needs your script key.
- **Trade value** (wave 2). On a trade, under the other trader's side, their money and
  items are totalled at torn-tracker.com's market value, with a Copy button for a receipt
  to paste in the chat. An item without a price is counted and named, never guessed. It
  only shows: the script never accepts or changes a trade. Needs your script key.
- **Bazaar listings** (wave 2). On another player's bazaar, the items, quantities and
  prices the page loads for you can be shared with torn-tracker.com, which publishes each
  player's latest listings and a price index. Torn's API has no player's listings. Off
  until you switch it on; never your own bazaar.
- **Organized crimes** (wave 2). On your faction's crimes tab, each role shows how much it
  counts towards the crime's success, and each crime your faction is recruiting or
  planning shows torn-tracker.com's success estimate. The role weights come from
  tornprobability.com through torn-tracker.com, and are credited on the page; the script
  never calls them itself. The estimate needs your faction's key with faction API access
  on torn-tracker.com. Needs your script key.
- **Auction listings** (wave 2). The listings the auction house shows you can be shared
  with torn-tracker.com, which publishes price history per item and bonus. Torn's API has
  only completed sales. Never the high bidder. Off until you switch it on.
- **Crimes: morale, value per nerve and burglary targets** (wave 2). On Crimes 2.0, the
  header shows your crime morale, which Torn doesn't display; each crime option shows its
  value per nerve from torn-tracker.com, once at least 20 players have reported it; and
  each burglary target shows how long it has left before it disappears.
- A player can see who reported their own loadout, and the loadout sharing line now says
  so; you are asked to agree again before sharing continues.
- **Your crime outcomes** (wave 2). When you commit a crime, how it went and what you got
  can be shared with torn-tracker.com, which keeps your own for your view and publishes only
  totals per crime with at least 20 reporters. Off until you switch it on.
- **Gym progress** (wave 2). On the gym page, the gym you are working towards shows about
  how much energy is left to unlock the next one, an estimate from torn-tracker.com. It
  works from your gym progress and trains, which you can share for your own view only:
  never shown to anyone else, never published. Off until you switch them on.
- **Item market prices** (wave 2). When torn-tracker.com needs fresh prices for an item
  you open on the item market, the listings' prices and quantities can be shared, never
  the sellers. Off until you switch it on.
- **Loadouts where you need them.** On any player's profile, a card shows their latest
  loadout from torn-tracker.com's open data, with when and by how many players it was seen,
  never by whom. For Pro factions in a ranked war, the war page shows each opponent's
  danger flags (heavy hitter, armoured, temp ready) and the loadout's age, and the attack
  page shows the flags of the opponent you're attacking. A Core faction sees a note.
- **Your mugs of a player** (wave 2). On a profile or the attack page, a line says how often
  you've mugged that player, when last and for how much, from your own records on
  torn-tracker.com. Needs your script key.
- **Auction value badges** (wave 2). On the auction house, each listing shows
  torn-tracker.com's value estimate ("about $27.4m, 12 sales"), "not enough sales", or a
  deal tag. Seeing them needs no sharing. Needs your script key.
- **Applicant badges** (wave 3). On your company's or faction's application list, each
  applicant who shared a job-board card shows their merits, job points and fit, linking
  to the card. Only for the verified director or recruiter. Needs your script key.
- **Pre-war strip** (wave 2). Before a ranked war starts, the opponent's faction page
  shows a one-line comparison of both sides and a link to the full brief on
  torn-tracker.com, with its headline for Pro factions. Needs your script key.
- **Racing templates** (wave 3). On the custom race form, save your settings as named
  templates and fill the form from one with a press. Kept only on this device; Forget me
  deletes them. It never starts a race.
- **Stock signals** (wave 3). On the stock market, a label beside a stock says when its
  price is far below or far above its 30-day average. A simple signal, never advice to buy
  or sell. Needs your script key.
- **A clearer way into the settings.** The floating ⚙ button is gone. Open the settings
  from the new **Torn Tracker** link in Torn's sidebar (right under TornTools Settings if
  you have TornTools) or the green **TT** icon by your avatar; a slim tab on the screen's
  edge appears only on pages with neither. The settings are now a full page with a menu:
  General, Features (grouped by area, each with a Learn more link), Sharing, Keys, Data,
  Credits and Help, with search, Torn's light and dark themes, and a layout for phones.
  Your settings carry over unchanged.
- **Your best runs on the travel agency** (wave 1). Before you fly, the travel agency shows
  your top three runs from the torn-tracker.com planner: where, what to buy, profit per
  hour, landing time and how sure, with a link to the planner. Needs your script key.
- **Bust safety** (wave 3). On the jail page, a coloured rule-of-thumb score beside each
  prisoner: level x (hours left + 3), the score TornTools uses, labelled as not Torn's
  odds. It never busts or bails for you. Prisoners' level and time-left bands can be
  shared, never who they are; off until you switch it on.
- **One look for everything** (hq #224). Every badge, strip and button the companion adds
  to Torn's pages now shares one style: soft rounded pills whose colour says good,
  neutral, caution or bad, cards with a light shadow, Torn's dark theme followed
  everywhere, and buttons sized for thumbs on touch screens. The settings page has a
  cleaner header, toggle switches, a one-line intro under each section, readable names
  in drop-downs, and a single "add your script key" banner in place of a warning on
  every feature.
- **Settings as a page inside Torn, opened from the sidebar only** (hq #231, CMP-107). The
  icon by your avatar is gone: it broke Torn's header menu. So is the edge tab. The one
  way in is the **Torn Tracker** entry in Torn's Areas list (right under TornTools
  Settings if you have it, and in the slide-out menu on a phone or in PDA), drawn as a
  copy of Torn's own entries. It opens `index.php#/torn-tracker`: the settings take the
  place of Torn's home page in the main column while Torn's header, sidebar and chat stay,
  and Back, Close or any link brings the home page back untouched. Sections have their
  own addresses (`#/torn-tracker/sharing`). Saving keeps you on the page. Your settings
  carry over unchanged.
- **The Torn Tracker sidebar block** (hq #231, CMP-108). Under Lists in Torn's sidebar:
  your chain with its timeout counting down, the ranked war's score and end, the war
  terms, your med-out partner, your dibs, your OC ("needs you"), your guide progress and
  quick links; best travel run, NPC loot, gym and stock watches can be switched on. Each
  line has its own switch under the new **Sidebar** section, and the block a master
  switch. While it's open and the tab is visible it asks torn-tracker.com once a minute
  for the lines you chose, with your script key; until the site serves that read, lines
  say "no data". Core.

- **Fixed on Torn's real sidebar** (checked against the owner's capture). The Torn Tracker
  entry is now a copy of one of Torn's area links, not of the Areas heading. The sidebar
  block sits after the last Lists entry instead of between the Lists heading and its
  entries. And the block no longer re-draws itself every fraction of a second, which had
  kept the page busy and held back other features' badges.
- **Merit hints** (wave 3, CMP-301, hq #228). On the merits tab, when you have free merits:
  a note names every merit they can raise and what it costs, and each merit below its
  maximum shows its next level's cost. Pressing a name only scrolls to it; the script
  never upgrades. It reads only the tab and sends nothing. Core, no key needed.
- **torn-tracker.com's colours** (hq #273, WP-UI-8). Every label, panel, button, the
  sidebar block and the settings page now use the same colours, corners and type as
  torn-tracker.com, so the companion and the site look like one product. Labels on Torn's
  pages still follow Torn's light or dark theme. The settings page is dark to start with;
  **General → Look** makes it light or has it follow Torn.
- **Tours** (hq #237, WP-UX-4). The first time you open the settings page, a short tour
  points out what's where; **?** at the top shows it again, and **Help → Tours** lists every
  tour, including one of the ranked-war page (sorting, fair-fight estimates, dibs, timers,
  loadout flags). Next, Back and Skip work with the arrow keys, Esc and a swipe; on a phone
  each step is a sheet at the bottom of the screen. A tour never starts by itself during an
  attack or while you're typing, and "Forget me" clears which tours you've seen.
- **Achievements** (hq #241, WP-UX-8). When torn-tracker.com says you earned an
  achievement, a small toast shows on the Torn page you're on, with a link to share it on
  the site. Your featured achievements show at the top of the settings page. Both have a
  switch under **General**. With your script key, the companion asks for new ones when you
  open a Torn page, at most every five minutes and never during an attack.
- Switching a feature on now starts its page's tour at that feature, the next time you
  open the page.
- **Your next guide step** (hq #155, GDE-007). If you started the torn-tracker guide, every
  section of the settings page starts with your next step and a button straight to where
  it's done. If you haven't, one line offers it, until you dismiss the guide on the site.
  With your script key it asks torn-tracker.com at most every 15 minutes, when you open a
  Torn page; switch it off under **General → Guide**.
- **Player notes** (wave 3). On any player's profile, **Add note** keeps a private note
  and a coloured tag (Friend, Ally, Watch, Enemy or Note). It shows again beside that
  player on their profile, in faction member lists, on the ranked-war page and on the
  attack page. Kept only on this device; nothing is sent and no one is looked up.
- **Export and import** under Settings → Data: your player notes, racing templates and
  message templates as text, to keep a copy or move them to another device.
- **Message templates** (wave 3). On any player's profile, **Messages** opens your
  templates filled in for that player: their name, ID, faction and level from the
  profile, and your own name, links and buying price from the settings. A placeholder
  the page doesn't show stays as written and is marked, never guessed. **Copy message**
  puts it on the clipboard; you paste it and send it yourself. **Write message** opens
  Torn's new-message page for that player with the subject and message already filled
  in. On that page, a template picker and **Insert** add a template below what you've
  written. Either way you check it and press Send yourself. Seven starter templates
  (trade offer, buying, recruitment, faction welcome, war call-up, armory return, job
  offer) to edit or delete. Kept only on this device; nothing is sent.
- **Bounty board** (wave 3). On Torn's bounty board, a fair-fight badge beside every
  target (one batched read), a filter bar for minimum reward, highest fair fight, level
  range and anonymous bounties that hides rows at once and says how many it shows, and
  hospital timers within 10 minutes (set your own) outlined. Reads the page only; never
  attacks or claims anything.
- **Wallet reminder** (wave 3). On the Item Market's add-listing form and your bazaar's
  add and manage pages, when the cash in your sidebar is $1,000,000 or more (set your
  own), a line above the form reminds you to bank it before you list: sellers are
  sometimes mugged just after a sale. Reads the page only and sends nothing.
- **After-sale mug badge** (wave 3). On a player's profile and the attack page, a badge
  when torn-tracker.com lists them for mugging sellers shortly after a sale (three or more
  sellers from two factions in 30 days), with the counts on hover and a link to the
  seller-safety page. Never shows who reported it. Sends the player's id with your script
  key; shows nothing until torn-tracker.com serves the list.
- **Add to list** (wave 3). On a player's profile, a split button beside the name adds
  them to the torn-tracker.com target list you last used ("Add to Chain targets"); its
  arrow opens your lists and the faction lists you may edit, ticked where they already
  are, and "Manage lists". A click adds them, or takes them off a ticked list, and the
  button then says "On 2 lists". One click is one call to torn-tracker.com and never a
  game action. Sends the player's id, and for a change the list, with your script key,
  which needs the lists scope; without it the button says "Add your script key".
- When torn-tracker.com no longer serves an account, the settings page says so in one
  neutral notice, with where to ask if it's a mistake, and the script stops using the
  script key for reads and sharing. Features that work on this device alone carry on.

### Fixed

- Checked against torn-tracker.com's real replies. Only a key the site refuses now
  pauses your reads and sharing; "you're not the director" or "Pro only" answers just
  that one read. The sidebar shows "every gym unlocked" at the last gym, and a dibs
  target without a name yet by its id. The travel panel no longer names the first
  country twice on a multi-stop run, the OC helper keeps its weights when the site has no
  name for one role, and the pre-war strip's link to the full brief shows again.
- The attack page works the same whichever address Torn opens it under
  (`page.php?sid=attack` or `loader.php?sid=attack`): fair-fight badges, the loadout view,
  the mug line and, if you share them, attack loadouts now run on both.
- Installed twice (from Greasy Fork and from GitHub, or added twice to Torn PDA), the
  companion now runs once: the second copy starts nothing, so there's one entry, one
  settings page, and no read asked twice.

### Notes

- Sharing can be switched on for foreign shop stock, loadouts, bazaar listings, auction
  listings, jail difficulty bands, your own crime outcomes, your own gym progress and
  trains, and item market prices when torn-tracker.com asks for them. The Sharing tab
  says exactly what each one sends, and what torn-tracker.com keeps and publishes; the
  README has the same table. Everything starts off.
- Every request to torn-tracker.com now says the script's version and whether it runs in
  Torn PDA or a desktop browser (two query parameters, hq #233), so the guide's
  second-device step can tick itself. Nothing else about your device is sent.
- This version asks for no Torn API key.

- This is a public test release (0.x): things may change before 1.0.0, and some
  selectors are still being checked against Torn's live pages. Report what breaks in the
  companion's thread on the Torn forum.
