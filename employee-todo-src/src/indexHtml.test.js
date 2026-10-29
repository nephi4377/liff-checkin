import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../index.html'),
  'utf8',
);

describe('index.html perf hints', () => {
  it('preconnects to GAS hosts and defers LIFF sdk', () => {
    expect(indexHtml).toContain('rel="preconnect" href="https://script.google.com"');
    expect(indexHtml).toContain(
      'rel="preconnect" href="https://script.googleusercontent.com"',
    );
    expect(indexHtml).toContain('<script defer src="https://static.line-scdn.net/liff/edge/2/sdk.js">');
  });
});
