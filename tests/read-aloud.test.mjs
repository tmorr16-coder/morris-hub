import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/read-aloud-player.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { ReadAloudPlayer, splitSpeech } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const tick = () => new Promise((resolve) => setImmediate(resolve));
class AudioStub {
  src = ""; playbackRate = 1; onended = null; onerror = null;
  played = []; paused = false;
  play() { this.played.push(this.src); this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ""; }
}
function setup(request, speech) {
  const audio = new AudioStub();
  const states = [];
  const player = new ReadAloudPlayer(audio, (s) => states.push(s), request, speech, (text) => ({ text }));
  return { audio, player, states };
}
const response = () => ({ ok: true, blob: async () => new Blob(["audio"], { type: "audio/mpeg" }) });
const clip = () => Promise.resolve(response());

test("long scripture is split within limits and reconstructed without changing wording", () => {
  const scripture = ("The Lord is my shepherd; I shall not want.\nHe leadeth me.  ").repeat(80);
  const parts = splitSpeech(scripture);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 600));
  assert.equal(parts.join(""), scripture);
  assert.deepEqual(splitSpeech("x".repeat(1201)).map((p) => p.length), [600, 600, 1]);
  assert.ok(splitSpeech("x".repeat(600) + " y").every((p) => p.length <= 600));
});

test("stop during a pending request aborts and cannot start late audio or completion", async () => {
  let resolve, signal, ended = 0;
  const { player, audio, states } = setup((_url, options) => {
    signal = options.signal;
    return new Promise((r) => { resolve = r; });
  });
  player.speak([{ text: "John chapter 3.", index: 0 }], "buddy", undefined, () => ended++);
  player.stop();
  resolve(new Response(new Blob(["late"])));
  await tick();
  assert.equal(signal.aborted, true);
  assert.equal(audio.played.filter((u) => u.startsWith("blob:")).length, 0);
  assert.equal(states.at(-1).speaking, false);
  assert.equal(ended, 0);
});

test("pause while loading waits for explicit resume; prefetch preserves verse order and exact text", async () => {
  const requests = [], seen = [];
  let resolve, ended = 0;
  const { player, audio } = setup((_url, opts) => {
    requests.push(JSON.parse(opts.body));
    return requests.length === 1 ? new Promise((r) => { resolve = r; }) : clip();
  });
  player.speak([{ text: "First verse.", index: 4 }, { text: "Second verse.", index: 5 }], "af_heart", (i) => seen.push(i), () => ended++);
  player.pause(); resolve(response());
  await tick();
  assert.equal(audio.played.filter((u) => u.startsWith("blob:")).length, 0);
  assert.deepEqual(requests.map((r) => r.text), ["First verse.", "Second verse."]);
  player.resume();
  assert.equal(audio.played.filter((u) => u.startsWith("blob:")).length, 1);
  audio.onended(); await tick();
  assert.deepEqual(seen, [4, 5]);
  audio.onended();
  assert.equal(ended, 1);
});

test("a replaced playback ignores the old audio completion callback", async () => {
  const { player, audio } = setup(clip);
  let oldEnd = 0, newEnd = 0;
  player.speak([{ text: "Old", index: 0 }], "buddy", undefined, () => oldEnd++);
  await tick(); const oldCallback = audio.onended;
  player.speak([{ text: "New", index: 0 }], "buddy", undefined, () => newEnd++);
  await tick(); oldCallback();
  assert.equal(oldEnd, 0); assert.equal(newEnd, 0);
  audio.onended(); assert.equal(newEnd, 1);
});

test("speed is applied to both current and subsequent clips", async () => {
  const { player, audio } = setup(clip);
  player.setRate(1.25);
  player.speak([{ text: "One", index: 0 }, { text: "Two", index: 1 }], "buddy");
  await tick(); assert.equal(audio.playbackRate, 1.25);
  player.setRate(1.5); assert.equal(audio.playbackRate, 1.5);
  audio.onended(); await tick(); assert.equal(audio.playbackRate, 1.5);
  player.dispose();
});

test("provider failure gives a recoverable error when no device voice is available", async () => {
  const { player, states } = setup(() => Promise.resolve(new Response("", { status: 502 })));
  let ended = false;
  player.speak([{ text: "Read me", index: 0 }], "buddy", undefined, () => { ended = true; });
  await tick();
  assert.match(states.at(-1).error, /unavailable/);
  assert.equal(states.at(-1).speaking, false); assert.equal(ended, false);
});

test("a cloud outage reads exact remaining verses with the device voice and exposes the fallback", async () => {
  const spoken = [];
  const speech = { speak: (u) => spoken.push(u), getVoices: () => [], cancel() {}, pause() {}, resume() {} };
  const { player, states } = setup(() => Promise.resolve(new Response("", { status: 503 })), speech);
  let ended = 0;
  player.speak([{ text: "First scripture verse", index: 0 }, { text: "Second scripture verse", index: 1 }], "buddy", undefined, () => ended++);
  await tick();
  assert.match(states.at(-1).notice, /device voice/);
  assert.equal(spoken.at(-1).text, "First scripture verse");
  spoken.at(-1).onend();
  assert.equal(spoken.at(-1).text, "Second scripture verse");
  spoken.at(-1).onend(); assert.equal(ended, 1);
});

test("disposing aborts prefetch and invalidates pending completion", async () => {
  const signals = [];
  const { player, audio } = setup((_url, opts) => { signals.push(opts.signal); return clip(); });
  let ended = 0;
  player.speak([{ text: "One", index: 0 }, { text: "Two", index: 1 }], "buddy", undefined, () => ended++);
  await tick(); const oldEnd = audio.onended;
  player.dispose(); oldEnd();
  assert.ok(signals.every((s) => s.aborted)); assert.equal(ended, 0);
});
