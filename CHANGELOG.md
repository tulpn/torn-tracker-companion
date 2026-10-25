# Changelog

Everything worth knowing about each release. The newest is at the top. Versions follow
[semantic versioning](https://semver.org): the patch number changes for fixes, the minor
for new features, the major when something you rely on changes.

A release is made by tagging `vX.Y.Z`; the workflow publishes the built script and uses
the section below for its notes. `## Unreleased` collects what is coming next.

## Unreleased

### Added

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

### Notes

- Sharing can be switched on for foreign shop stock, loadouts, bazaar listings, auction
  listings, your own crime outcomes, your own gym progress and trains, and item market prices when torn-tracker.com asks for
  them. The Sharing tab says
  exactly what each one sends, and what torn-tracker.com keeps and publishes; the README
  has the same table. Everything starts off.
- Every request to torn-tracker.com now says the script's version and whether it runs in
  Torn PDA or a desktop browser (two query parameters, hq #233), so the guide's
  second-device step can tick itself. Nothing else about your device is sent.
- This version asks for no Torn API key.

- There is no public release yet. Wave 1 — fair-fight badges, the war page, foreign stock
  and the price filler — will be v1.0.0.
