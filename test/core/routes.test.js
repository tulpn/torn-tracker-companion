import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { matchRoute, matchesAny } from '../../src/core/routes.js';

const at = (href) => {
  const url = new URL(href, 'https://www.torn.com');
  return { pathname: url.pathname, search: url.search, hash: url.hash };
};

describe('CMP-005 route keys match the page the player is on', () => {
  test('* matches everything', () => {
    assert.equal(matchRoute('*', at('/')), true);
    assert.equal(matchRoute('*', at('/factions.php#/war/rank')), true);
  });

  test('a page key matches that page whatever the query or hash', () => {
    assert.equal(matchRoute('factions.php', at('/factions.php')), true);
    assert.equal(matchRoute('factions.php', at('/factions.php?step=profile')), true);
    assert.equal(matchRoute('factions.php', at('/factions.php#/war/rank')), true);
    assert.equal(matchRoute('factions.php', at('/profiles.php')), false);
  });

  test('a hash key matches a hash that starts with it', () => {
    assert.equal(matchRoute('factions.php#/war/', at('/factions.php#/war/rank')), true);
    assert.equal(matchRoute('factions.php#/war/', at('/factions.php#/war/')), true);
    assert.equal(matchRoute('factions.php#/war/', at('/factions.php#/members')), false);
    assert.equal(matchRoute('factions.php#/war/', at('/factions.php')), false);
  });

  test('a query key matches only when every named parameter agrees', () => {
    assert.equal(matchRoute('loader.php?sid=attack', at('/loader.php?sid=attack&user2ID=1')), true);
    assert.equal(matchRoute('loader.php?sid=attack', at('/loader.php?sid=crimes')), false);
    assert.equal(matchRoute('loader.php?sid=attack', at('/loader.php')), false);
  });

  test('a bare hash key matches on any page', () => {
    assert.equal(matchRoute('#/war/', at('/factions.php#/war/rank')), true);
    assert.equal(matchRoute('#/war/', at('/index.php#/war/rank')), true);
    assert.equal(matchRoute('#/war/', at('/index.php#/other')), false);
  });

  test('a leading slash in the key makes no difference', () => {
    assert.equal(matchRoute('/factions.php', at('/factions.php')), true);
  });

  test('nothing matches an empty or non-string key', () => {
    assert.equal(matchRoute('', at('/')), false);
    assert.equal(matchRoute(null, at('/')), false);
    assert.equal(matchesAny(undefined, at('/')), false);
  });

  test('matchesAny takes the first route that fits', () => {
    const routes = ['profiles.php', 'factions.php#/war/'];
    assert.equal(matchesAny(routes, at('/factions.php#/war/rank')), true);
    assert.equal(matchesAny(routes, at('/item.php')), false);
  });
});
