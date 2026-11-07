// Browser smoke test with real HTMLAudioElement playback and a mocked voice provider.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import ts from "typescript";

const source = await readFile(new URL("../lib/read-aloud-player.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
// A short, silent PCM recording exercises actual audio loading/ending without speakers.
const wav = Buffer.alloc(44 + 3200);
wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(3200, 40);
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
try {
  const page = await browser.newPage();
  const requests = [];
  let delay = false;
  await page.route("https://voice.example/**", async (route) => {
    if (route.request().url().endsWith("/api/tts")) {
      requests.push(route.request().postDataJSON());
      if (delay) await new Promise((r) => setTimeout(r, 150));
      await route.fulfill({ contentType: "audio/wav", body: wav }).catch(() => {});
    } else await route.fulfill({ contentType: "text/html", body: '<button id="play">Listen</button><button id="stop">Stop</button>' });
  });
  await page.goto("https://voice.example/");
  await page.addScriptTag({ content: `window.exports = {}; ${outputText}` });
  await page.evaluate(() => {
    window.events = [];
    window.player = new window.exports.ReadAloudPlayer(new Audio(), (s) => window.events.push(s));
    document.querySelector("#play").onclick = () => window.player.speak([{ text: "First verse.", index: 0 }, { text: "Second verse.", index: 1 }], "buddy", (i) => window.events.push({ verse: i }), () => window.events.push({ ended: true }));
    document.querySelector("#stop").onclick = () => window.player.stop();
  });
  await page.click("#play");
  await page.waitForFunction(() => window.events.some((e) => e.ended), null, { timeout: 10000 }).catch(async (error) => {
    console.error(JSON.stringify({ requests, events: await page.evaluate(() => window.events) }));
    throw error;
  });
  assert.deepEqual(requests.map((r) => r.text), ["First verse.", "Second verse."]);
  assert.deepEqual(await page.evaluate(() => window.events.filter((e) => "verse" in e).map((e) => e.verse)), [0, 1]);
  delay = true;
  await page.evaluate(() => { window.events = []; });
  await page.click("#play");
  await page.click("#stop");
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.events.some((e) => e.ended)), false);
  assert.equal(await page.evaluate(() => window.events.at(-1).speaking), false);
  console.log("PASS: Chromium plays queued verses and Stop cancels delayed narration.");
} finally { await browser.close(); }
