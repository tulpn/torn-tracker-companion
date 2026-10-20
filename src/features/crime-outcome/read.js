// Turns the page's own crime attempt response into a `crime_outcome` (CMP-205, CAPI-010 as
// pinned in hq #124). Pure. The page's own ids go as they are; the site maps them to the
// API's crimes and takes the nerve from there. Nothing is guessed.

/** The result as the page words it -> the closed outcome; anything else -> null. */
const OUTCOMES = Object.freeze({
  success: 'success',
  failure: 'failure',
  'critical failure': 'critical_failure',
  critical_failure: 'critical_failure',
});

export const MAX_ITEMS = 20;

const positive = (v) => (Number.isInteger(v) && v > 0 ? v : null);

/** `step=attempt` with its ids, from the address or, failing that, the request's form. */
export function attemptOf(url, form) {
  let params;
  try {
    params = new URL(String(url), 'https://www.torn.com').searchParams;
  } catch {
    return null;
  }
  const get = (key) => params.get(key) ?? form?.get?.(key) ?? null;
  if (get('step') !== 'attempt') return null;
  const type_id = positive(Number(get('typeID')));
  const page_crime_id = positive(Number(get('crimeID')));
  return type_id && page_crime_id ? { type_id, page_crime_id } : null;
}

/** The outcome, money and items of one attempt; null when it is not a finished attempt. */
export function outcomeOf(data) {
  const outcome = data?.DB?.outcome;
  if (!outcome || typeof outcome !== 'object' || data.error) return null;
  const result = OUTCOMES[String(outcome.result || '').toLowerCase()];
  if (!result) return null;
  let money = 0;
  const items = [];
  for (const reward of Array.isArray(outcome.rewards) ? outcome.rewards : []) {
    if (reward?.type === 'money' && Number.isInteger(reward.value) && reward.value >= 0) money += reward.value;
    if (reward?.type === 'items' && Array.isArray(reward.value)) {
      for (const item of reward.value) {
        const item_id = positive(item?.id);
        const amount = positive(item?.amount);
        if (item_id && amount && items.length < MAX_ITEMS) items.push({ item_id, amount });
      }
    }
  }
  return { outcome: result, money_gained: money, items };
}
