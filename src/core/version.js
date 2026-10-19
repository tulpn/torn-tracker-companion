// The build replaces __TTC_VERSION__ with package.json's version (tools/build.mjs), so
// the running script, the header's @version and the version uploads carry as
// script_version (CMP-014) are always the same string.
//
// Outside the bundle — unit tests importing a module directly — the identifier is simply
// undeclared, and `typeof` on an undeclared name is safe.

export const VERSION = typeof __TTC_VERSION__ === 'string' ? __TTC_VERSION__ : '0.0.0-dev';
