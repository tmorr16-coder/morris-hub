import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as crypto from "node:crypto";
import ts from "typescript";

const routeSource = await readFile(new URL("../app/api/tts/route.ts", import.meta.url), "utf8");
const voiceSource = await readFile(new URL("../lib/buddy-voice.ts", import.meta.url), "utf8");
function compile(source, dependencies, extra = {}) {
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  const exports = {};
  new Function("require", "exports", ...Object.keys(extra), outputText)((id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`);
    return dependencies[id];
  }, exports, ...Object.values(extra));
  return exports;
}
function route({ signedIn = true, cache = null, unavailable = false, providerFails = false, cacheFails = false } = {}) {
  const spoken = [];
  let uploads = 0;
  const storage = {
    getBucket: async () => ({ data: {} }), createBucket: async () => ({}),
    from: () => ({
      download: async () => { if (cacheFails) throw new Error("offline"); return { data: cache }; },
      upload: async () => { uploads++; return {}; },
    }),
  };
  const exports = compile(routeSource, {
    "node:crypto": crypto,
    "@/lib/supabase/server": {
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: "reader-1" } : null } }) } }),
      createServiceClient: () => ({ storage }),
    },
    "@/lib/buddy-voice": {
      defaultCloudVoice: () => unavailable ? null : "af_heart",
      isAvailableVoice: (id) => id === "af_heart",
      voiceById: (id) => id ? { id, provider: "kokoro" } : null,
      modelFor: () => "kokoro:model", extensionFor: () => "mp3", contentTypeFor: () => "audio/mpeg",
      synthesise: async (...args) => { spoken.push(args); if (providerFails) throw new Error("private provider details"); return { audio: new Uint8Array([1, 2, 3]), contentType: "audio/mpeg" }; },
    },
  });
  return { post: exports.POST, spoken, uploads: () => uploads };
}
const request = (body) => new Request("https://bible.morrisai.family/api/tts", { method: "POST", body: JSON.stringify(body) });

test("narration requires authentication before generating or returning audio", async () => {
  const api = route({ signedIn: false });
  const res = await api.post(request({ text: "Read this" }));
  assert.equal(res.status, 401); assert.equal(api.spoken.length, 0);
});

test("empty or oversized input is rejected rather than silently truncating scripture", async () => {
  const api = route();
  for (const body of [null, {}, { text: " " }, { text: "x".repeat(601) }]) assert.equal((await api.post(request(body))).status, 400);
  assert.equal(api.spoken.length, 0);
});

test("the shared Buddy voice receives exactly the scripture text in narration mode", async () => {
  const api = route(); const text = "The Lord is my shepherd; I shall not want.\nHe restoreth my soul.";
  const res = await api.post(request({ text, voice: "buddy" }));
  assert.equal(res.status, 200);
  assert.deepEqual(api.spoken, [[text, "af_heart", 1, "narration"]]);
  assert.equal(res.headers.get("content-type"), "audio/mpeg");
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.equal(api.uploads(), 1);
});

test("a cached clip avoids a paid synthesis call", async () => {
  const api = route({ cache: new Blob(["cached"]) });
  const res = await api.post(request({ text: "Read me" }));
  assert.equal(await res.text(), "cached"); assert.equal(api.spoken.length, 0);
});

test("a storage outage still permits narration; provider failures do not expose diagnostics", async () => {
  const api = route({ cacheFails: true });
  assert.equal((await api.post(request({ text: "Read me" }))).status, 200);
  const failed = route({ providerFails: true });
  const res = await failed.post(request({ text: "Read me" }));
  assert.equal(res.status, 502); assert.doesNotMatch(await res.text(), /private provider details/);
});

test("the synthesis engine preserves scripture hyphens and line breaks while retaining Buddy's spelling behavior", async () => {
  const inputs = [];
  const voices = compile(voiceSource, { "@/lib/system-events": { recordFailure: async () => {}, clearFailures: async () => {} } }, {
    process: { env: { DEEPINFRA_API_KEY: "test-only" } },
    fetch: async (_url, opts) => { inputs.push(JSON.parse(opts.body).input); return new Response(new Uint8Array([1, 2])); },
  });
  const text = "B-E-A-R.\nRead the words exactly.";
  await voices.synthesise(text, "af_heart", 1, "narration");
  assert.equal(inputs[0], text);
  await voices.synthesise(text, "af_heart");
  assert.match(inputs[1], /B, E, A, R/);
});
