/**
 * Every HTML loader of accounting_api.js must use ?v=112
 * node modules/accounting/tools/test-accounting-api-cache-bust-all.js
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var root = path.join(__dirname, '../../..');
var re = /accounting_api\.js\?v=([^"'\s>]+)/g;

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (ent.name === 'node_modules' || ent.name === '.git') return;
    var p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.html')) out.push(p);
  });
}

var htmlFiles = [];
walk(root, htmlFiles);
var offenders = [];

htmlFiles.forEach(function (file) {
  var rel = path.relative(root, file);
  if (rel.indexOf('LOG/') === 0) return;
  var text = fs.readFileSync(file, 'utf8');
  var m;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    if (m[1] !== '112') offenders.push(rel + ' → v=' + m[1]);
  }
});

if (offenders.length) {
  console.error('accounting_api.js cache bust not v=112:\n' + offenders.join('\n'));
  process.exit(1);
}

console.log('test-accounting-api-cache-bust-all: OK (' + htmlFiles.length + ' html scanned, all v=112)');
