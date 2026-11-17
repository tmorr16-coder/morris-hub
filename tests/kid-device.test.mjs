import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as crypto from 'node:crypto';
import ts from 'typescript';

async function load(path, deps = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  const exports = {};
  new Function('require', 'exports', outputText)(id => { if (!(id in deps)) throw Error(id); return deps[id]; }, exports);
  return exports;
}

const CHILD = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const sha = v => createHash('sha256').update(v).digest('hex');
const TOKEN = 'x'.repeat(43);

// A fake world: who is signed in, what cookie the browser holds, what rows exist.
function world({ user = null, guardianOf = [], cookie = null, device = null }) {
  const tables = {
    child_devices: device ? [{ token_hash: sha(TOKEN), ...device }] : [],
    family_members: [{ id: CHILD, user_id: 'parent-1', display_name: 'Jaxon Morris', birth_year: 2020, role: 'child' }, { id: OTHER, user_id: 'parent-1', display_name: 'Maya', birth_year: 2010, role: 'child' }],
  };
  const query = (table) => { const filters = []; const q = { select: () => q, eq: (k, v) => { filters.push([k, v]); return q; }, maybeSingle: async () => ({ data: (tables[table] ?? []).find(r => filters.every(([k, v]) => r[k] === v)) ?? null }) }; return q; };
  return {
    'server-only': {},
    'node:crypto': crypto,
    'next/headers': { cookies: async () => ({ get: n => (n === 'kid_device' && cookie ? { value: cookie } : undefined), set: () => {} }) },
    '@/lib/supabase/server': { createServiceClient: () => ({ schema: () => ({ from: query }) }) },
    '@/lib/supabase/auth-utils': { getCurrentUserId: async () => user },
    './children': { childForGuardian: async (_db, id, uid) => (uid && guardianOf.includes(id) ? { id, user_id: uid, display_name: 'Jaxon', birth_year: 2020 } : null) },
  };
}
const soon = () => new Date(Date.now() + 3_600_000).toISOString();
const past = () => new Date(Date.now() - 1000).toISOString();

test('PINs are four digits, hashed with a salt, and checked in constant time', async () => {
  const m = await load('../app/children/_lib/kid-device.ts', world({}));
  for (const p of ['123', '12345', 'abcd', '12a4', '', null, 1234]) assert.equal(m.validPin(p), false, String(p));
  assert.equal(m.validPin('0472'), true);
  const a = m.hashPin('0472'), b = m.hashPin('0472');
  assert.notEqual(a, b, 'salted');
  assert.ok(!a.includes('0472'));
  assert.equal(m.verifyPin('0472', a), true);
  assert.equal(m.verifyPin('0473', a), false);
  assert.equal(m.verifyPin('0472', 'garbage'), false);
  for (const p of ['1111', '0000', '1234', '4321', '9876']) assert.equal(m.weakPin(p), true, p);
  assert.equal(m.weakPin('0472'), false);
});

test('wrong guesses rest the keypad for longer each time', async () => {
  const m = await load('../app/children/_lib/kid-device.ts', world({}));
  assert.deepEqual([1, 4, 5, 7, 8, 11, 12, 30].map(m.lockoutSeconds), [0, 0, 60, 60, 900, 900, 3600, 3600]);
});

test('setup codes are 8 unambiguous characters and normalise from what a parent types', async () => {
  const m = await load('../app/children/_lib/kid-device.ts', world({}));
  const code = m.newPairCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(m.normalisePairCode(code.toLowerCase().replace('-', ' ')), code);
  for (const bad of ['ABCD-234', 'ABCD-23450', 'ABCD-0OIL', '']) assert.equal(m.normalisePairCode(bad), null, bad);
  assert.equal(m.newDeviceToken().length >= 43, true);
});

test('a parent may act on the screen; nobody else without an unlocked iPad', async () => {
  let m = await load('../app/children/_lib/kid-device.ts', world({ user: 'parent-1', guardianOf: [CHILD] }));
  assert.equal((await m.childScreenAccess(CHILD)).via, 'parent');
  m = await load('../app/children/_lib/kid-device.ts', world({ user: 'stranger' }));
  assert.equal(await m.childScreenAccess(CHILD), null);
  m = await load('../app/children/_lib/kid-device.ts', world({}));
  assert.equal(await m.childScreenAccess(CHILD), null);
  assert.equal(await m.childScreenAccess('not-a-uuid'), null);
});

test("an unlocked iPad reaches only its own child's screen, and never when locked or removed", async () => {
  const unlocked = { id: 'dev-1', child_id: CHILD, label: 'iPad', unlocked_until: soon(), locked_until: null, failed_attempts: 0, revoked_at: null };
  let m = await load('../app/children/_lib/kid-device.ts', world({ cookie: TOKEN, device: unlocked }));
  const a = await m.childScreenAccess(CHILD);
  assert.equal(a.via, 'kid');
  assert.equal(a.rateKey, 'device:dev-1');
  assert.equal(a.actorUserId, 'parent-1');
  assert.equal(await m.childScreenAccess(OTHER), null, 'paired to Jaxon, not Maya');

  m = await load('../app/children/_lib/kid-device.ts', world({ cookie: TOKEN, device: { ...unlocked, unlocked_until: past() } }));
  assert.equal(await m.childScreenAccess(CHILD), null, 'locked');
  m = await load('../app/children/_lib/kid-device.ts', world({ cookie: TOKEN, device: { ...unlocked, revoked_at: past() } }));
  assert.equal(await m.childScreenAccess(CHILD), null, 'removed');
  m = await load('../app/children/_lib/kid-device.ts', world({ cookie: 'y'.repeat(43), device: unlocked }));
  assert.equal(await m.childScreenAccess(CHILD), null, 'someone else\'s cookie');
  m = await load('../app/children/_lib/kid-device.ts', world({ cookie: TOKEN, device: { ...unlocked, locked_until: soon(), unlocked_until: null, failed_attempts: 6 } }));
  const d = await m.currentKidDevice();
  assert.equal(d.unlocked, false);
  assert.ok(d.lockedSeconds > 3000);
});
