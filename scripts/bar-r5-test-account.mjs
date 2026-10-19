/** Existing isolated A only. No account creation, password change or financial write. */
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { barTestKeys, BAR_TEST_PROJECT, BAR_TEST_URL } from './lib/bar-test-supabase.mjs';
const action = process.argv[2];
assert(['enable', 'disable'].includes(action));
assert.equal(BAR_TEST_PROJECT, 'wlndjknwbceaqrqcwbqw');
const client = createClient(BAR_TEST_URL, barTestKeys().secret, { auth: { persistSession: false, autoRefreshToken: false } });
const id = '03926eba-b2f9-4183-a30d-a35d63d7ea07';
const before = await client.auth.admin.getUserById(id);
assert.equal(before.error, null);
assert(before.data.user.email.endsWith('.invalid'), 'EXISTING_FICTIONAL_IDENTITY_ONLY');
const metadata = { ...before.data.user.app_metadata };
if (action === 'enable') metadata.bar_google_test = 'closure-20261019';
// Auth Admin merges app_metadata; omission does not revoke an existing key.
else metadata.bar_google_test = null;
const result = await client.auth.admin.updateUserById(id, { app_metadata: metadata, ban_duration: action === 'enable' ? 'none' : '876000h' });
assert.equal(result.error, null);
const check = await client.auth.admin.getUserById(id);
assert.equal(check.error, null);
assert.equal(check.data.user.app_metadata.bar_google_test === 'closure-20261019', action === 'enable');
if (action === 'disable') assert(Date.parse(check.data.user.banned_until) > Date.now());
console.log(`ISOLATED_A_${action.toUpperCase()}_VERIFIED; no account created; no financial write`);
