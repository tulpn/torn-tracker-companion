# Changelog

Everything worth knowing about each release. The newest is at the top. Versions follow
[semantic versioning](https://semver.org): the patch number changes for fixes, the minor
for new features, the major when something you rely on changes.

A release is made by tagging `vX.Y.Z`; the workflow publishes the built script and uses
the section below for its notes. `## Unreleased` collects what is coming next.

## Unreleased

### Added

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

### Notes

- Sharing can be switched on for foreign shop stock, loadouts, bazaar listings, auction
  listings, your own crime outcomes, your own gym progress and trains, and item market prices when torn-tracker.com asks for
  them. The Sharing tab says
  exactly what each one sends, and what torn-tracker.com keeps and publishes; the README
  has the same table. Everything starts off.
- This version asks for no Torn API key.

- There is no public release yet. Wave 1 — fair-fight badges, the war page, foreign stock
  and the price filler — will be v1.0.0.
