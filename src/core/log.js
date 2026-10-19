// One tagged logger. Nothing here leaves the device: there is no telemetry of any kind
// (CMP-015).

const TAG = '[torn-tracker-companion]';

let debug = false;

export function setDebug(on) {
  debug = on === true;
}

export function isDebug() {
  return debug;
}

/** Quiet unless the player turned debug on in the panel. */
export function log(...args) {
  if (debug) console.log(TAG, ...args);
}

export function warn(...args) {
  console.warn(TAG, ...args);
}

export function error(...args) {
  console.error(TAG, ...args);
}
