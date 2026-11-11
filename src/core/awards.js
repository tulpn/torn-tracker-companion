// The award countdown's wording (hq #785, ENG-063), shared by the strip on Torn's awards
// page and the awards card of the dashboard inside Torn.

const DAY_MS = 86_400_000;

/** "today", "tomorrow", a weekday within the week, else "on 21 Nov", in the player's local time. */
export function dayText(etaDays, now = Date.now()) {
  if (etaDays === 0) return 'today';
  if (etaDays === 1) return 'tomorrow';
  const day = new Date(now + etaDays * DAY_MS);
  if (etaDays <= 6) return day.toLocaleDateString('en-GB', { weekday: 'long' });
  return `on ${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

const amountText = (n) => n.toLocaleString('en-US');

/**
 * What the strip says, from the dashboard's checked `awards` card: the next crossings at
 * the player's pace when the site sends them, else the award nearest completion.
 * @returns {{lines: Array<{lead: string, name: string, tail: string, url: string|null}>}|null}
 */
export function countdown(card, now = Date.now()) {
  if (!card) return null;
  if (card.next?.length) {
    const lines = card.next.map((a, i) => {
      const unit = a.unit ? ` ${a.unit}` : '';
      const lead = `${amountText(a.remaining)}${unit} to ${i === 0 ? 'your next award' : 'the one after'}, `;
      const tail = a.etaDays == null ? '.' : `. At your pace: ${dayText(a.etaDays, now)}.`;
      return { lead, name: a.name, tail, url: a.url };
    });
    return { lines };
  }
  const a = card.nearest?.[0];
  if (!a) return null;
  const detail = a.detail ?? `${Math.floor(a.pct)}% done`;
  return { lines: [{ lead: 'Closest to earning: ', name: a.name, tail: `, ${detail}.`, url: a.url }] };
}

/**
 * The countdown as nodes, one line each, the award's name linking to our page in a new tab.
 * `make(tag, attrs, ...children)` builds an element: the dashboard's `h`, or `el` on Torn's page.
 */
export function countdownNodes(card, now, make, tag = 'p') {
  return (countdown(card, now)?.lines ?? []).map((l) => make(tag, {}, l.lead,
    l.url ? make('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.name) : make('strong', {}, l.name),
    l.tail));
}
