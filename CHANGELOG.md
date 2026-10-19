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

### Notes

- There is no public release yet. Wave 1 — fair-fight badges, the war page, foreign stock
  and the price filler — will be v1.0.0.
