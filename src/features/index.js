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
import warPage from './war-page/index.js';
import tradeValue from './trade-value/index.js';
import bazaarCapture from './bazaar-capture/index.js';
import ocHelper from './oc-helper/index.js';
import auctionCapture from './auction-capture/index.js';
import crimeHelper from './crime-helper/index.js';
import crimeOutcome from './crime-outcome/index.js';
import gymProgress from './gym-progress/index.js';
import marketSnapshot from './market-snapshot/index.js';

export default [ffBadges, warPage, foreignStock, bestBuy, attackLoadout, priceFiller, tradeValue, bazaarCapture, auctionCapture, ocHelper, crimeHelper, crimeOutcome, gymProgress, marketSnapshot];
