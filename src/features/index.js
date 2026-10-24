// Every feature in this build, in the order the panel lists them.
//
// Wave 1 lands in WP-CMP-5 (foreign stock, attack loadouts) and
// WP-CMP-6 (fair-fight badges, the war page, the price filler). Each one is a folder
// under this one exporting a single descriptor, which registry.js validates at boot.

import foreignStock from './foreign-stock/index.js';
import bestBuy from './best-buy/index.js';
import attackLoadout from './attack-loadout/index.js';
import ffBadges from './ff-badges/index.js';
import priceFiller from './price-filler/index.js';
import shopHighlighter from './shop-highlighter/index.js';
import undersellWarning from './undersell-warning/index.js';
import warPage from './war-page/index.js';
import tradeValue from './trade-value/index.js';
import bazaarCapture from './bazaar-capture/index.js';
import ocHelper from './oc-helper/index.js';
import auctionCapture from './auction-capture/index.js';
import crimeHelper from './crime-helper/index.js';
import crimeOutcome from './crime-outcome/index.js';
import gymProgress from './gym-progress/index.js';
import marketSnapshot from './market-snapshot/index.js';
import loadoutView from './loadout-view/index.js';
import mugStrip from './mug-strip/index.js';
import applicantBadges from './applicant-badges/index.js';
import auctionValues from './auction-values/index.js';
import warBrief from './war-brief/index.js';
import raceTemplates from './race-templates/index.js';
import playerNotes from './player-notes/index.js';
import messageTemplates from './message-templates/index.js';
import stockAdvisor from './stock-advisor/index.js';
import travelPanel from './travel-panel/index.js';
import bustSafety from './bust-safety/index.js';
import meritHints from './merit-hints/index.js';

export default [
  ffBadges,
  warPage,
  foreignStock,
  bestBuy,
  attackLoadout,
  priceFiller,
  undersellWarning,
  shopHighlighter,
  tradeValue,
  bazaarCapture,
  auctionCapture,
  ocHelper,
  crimeHelper,
  crimeOutcome,
  gymProgress,
  marketSnapshot,
  loadoutView,
  mugStrip,
  auctionValues,
  applicantBadges,
  warBrief,
  raceTemplates,
  playerNotes,
  messageTemplates,
  stockAdvisor,
  travelPanel,
  bustSafety,
  meritHints,
];
