import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as dns from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';

async function load(path, deps = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  const exports = {};
  new Function('require', 'exports', outputText)(id => { if (!(id in deps)) throw Error(id); return deps[id]; }, exports);
  return exports;
}
const safe = await load('../lib/net/safe-fetch.ts', { 'server-only': {}, 'node:dns': dns, 'node:http': http, 'node:https': https, 'node:net': net });
const html = await load('../lib/text/html.ts');
const bible = await load('../lib/bible-api.ts');
const slides = await load('../lib/slides.ts', { pptxgenjs: { default: class {} } });

test('only public addresses pass, in every spelling', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::a00:1', '2002:7f00:1::', '[::1]', 'not-an-ip']) {
    assert.equal(safe.isPublicAddress(ip), false, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) assert.equal(safe.isPublicAddress(ip), true, ip);
});

test('URLs to internal targets are refused before any network activity', () => {
  for (const u of ['http://2130706433/', 'http://0x7f.1/', 'http://017700000001/', 'http://[::1]/', 'http://[::ffff:169.254.169.254]/',
    'http://localhost/', 'http://db.internal/', 'http://printer.local/', 'ftp://example.com/', 'file:///etc/passwd',
    'https://user:pw@example.com/', 'https://example.com:8080/', 'not a url']) {
    assert.throws(() => safe.vetPublicUrl(u), safe.UnsafeUrlError, u);
  }
  assert.equal(safe.vetPublicUrl(' https://example.com/notes ').href, 'https://example.com/notes');
});

test('a literal private address is refused even when the server is real', async () => {
  const server = http.createServer((_, res) => res.end('secret')).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  try {
    await assert.rejects(safe.fetchPublicText(`http://127.0.0.1:${server.address().port}/`), safe.UnsafeUrlError);
    await assert.rejects(safe.fetchPublicText('http://127.0.0.1/'), safe.UnsafeUrlError);
  } finally { server.close(); }
});

test('HTML to text leaves no markup behind and decodes once', () => {
  const out = html.htmlToText('<p>Hi&nbsp;<b>there</b></p><scr<script>alert(1)</script>ipt>x<style>p{}</style><!-- c --><img src=x onerror=alert(1)>');
  assert.ok(!/[<>]/.test(out), out);
  assert.ok(!out.includes('alert(1)') || !out.includes('<'), out);
  assert.equal(html.decodeEntities('&amp;lt;b&amp;gt; &#60; &#x3c; &copy; &bogus;'), '&lt;b&gt; < < © &bogus;');
  assert.equal(html.htmlToText('a &amp;lt; b'), 'a &lt; b');
  assert.equal(html.htmlToText('<p>one</p><p>two</p>', { keepLines: true }), 'one\n\ntwo');
  assert.equal(html.htmlToText('text <unterminated'), 'text');
  assert.equal(html.htmlToText('x'.repeat(50), { maxChars: 10 }).length, 10);
  assert.equal(html.stripHtmlComments('a<!-- hidden -->b<!-- open'), 'ab');
});

test('HTML handling and markdown patterns stay linear on hostile input', () => {
  const hostile = [
    '<script'.repeat(20000), '<style>'.repeat(20000), '<!--'.repeat(20000), '<a '.repeat(30000), '&amp;'.repeat(30000),
  ];
  for (const h of hostile) {
    const t = performance.now();
    html.htmlToText(h); html.stripHtmlComments(h);
    assert.ok(performance.now() - t < 500, `slow on ${h.slice(0, 12)}…`);
  }
  const spaces = 'a' + ' '.repeat(50000) + 'x';
  for (const fn of [() => bible.parseReference(spaces), () => slides.plain('[a](' + 'http:'.repeat(20000)), () => slides.outlineFromMarkdown('#' + ' '.repeat(50000) + 'x', 'T'), () => slides.outlineFromMarkdown('-' + ' '.repeat(50000), 'T')]) {
    const t = performance.now(); fn(); assert.ok(performance.now() - t < 500);
  }
});

test('scripture references still parse after the linear rewrite', () => {
  assert.deepEqual(bible.parseReference('John 3:16'), { bookId: 'JHN', chapter: 3, vStart: 16, vEnd: undefined });
  assert.deepEqual(bible.parseReference('1 Cor 13'), { bookId: '1CO', chapter: 13, vStart: undefined, vEnd: undefined });
  assert.deepEqual(bible.parseReference('Genesis 1:1-5'), { bookId: 'GEN', chapter: 1, vStart: 1, vEnd: 5 });
  assert.deepEqual(bible.parseReference('Psalm 23'), { bookId: 'PSA', chapter: 23, vStart: undefined, vEnd: undefined });
  assert.equal(bible.parseReference('love one another'), null);
});

test('slides keep headings, bullets and link labels', () => {
  assert.equal(slides.plain('see [the docs](https://x.y/z) now'), 'see the docs now');
  const deck = slides.outlineFromMarkdown('# Plan\n- first\n1. second\n##   Spaced  ', 'Title');
  assert.equal(deck[0].title, 'Plan');
  assert.deepEqual(deck[0].bullets, ['first', 'second']);
  assert.equal(deck[1].title, 'Spaced');
});

test('log values are one line, bounded and free of control characters', async () => {
  const log = await load('../lib/log-safe.ts');
  assert.equal(log.logValue('a\nFAKE: admin logged in\r\nb'), 'a FAKE: admin logged in b');
  assert.equal(log.logValue('%s%o\u0007'), '%s%o');
  assert.equal(log.logValue(new Error('boom\nline2')), 'boom line2');
  assert.equal(log.logValue({ a: 1 }), '{"a":1}');
  assert.equal(log.logValue('x'.repeat(400), 10), 'xxxxxxxxxx…');
});
