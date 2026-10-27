/**
 * Smoke: 主控台 IframeView 在會計 route 切換時必須能重掛；避免首次空白
 */
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '../../..');
var iframeView = fs.readFileSync(path.join(root, 'spa/IframeView.js'), 'utf8');
var appJs = fs.readFileSync(path.join(root, 'spa/app.js'), 'utf8');
var shell = fs.readFileSync(path.join(root, 'shared/js/accounting_shell.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
}

assert(iframeView.indexOf("frameSrc.value = 'about:blank'") >= 0 || iframeView.indexOf('about:blank') >= 0,
  'blank intermediary');
assert(iframeView.indexOf('watch') >= 0, 'watches props.src');
assert(iframeView.indexOf('armSafety') >= 0 || iframeView.indexOf('8000') >= 0,
  'load safety timeout');
assert(iframeView.indexOf("class=\"{ 'hidden': isLoading }\"") < 0 &&
  iframeView.indexOf(":class=\"{ 'hidden': isLoading }\"") < 0,
  'iframe not CSS-hidden while loading (overlay only)');
assert(iframeView.indexOf('requestAnimationFrame') >= 0, 'double-rAF remount');

assert(appJs.indexOf(':key=') >= 0 && appJs.indexOf('IframeView') >= 0, 'IframeView has :key');
assert(appJs.indexOf("route=quick_review.html") >= 0, 'quick-review route still wired');
assert(appJs.indexOf('準備會計模組') >= 0, 'shows spinner while accounting iframe not ready');
assert(/modules\/accounting\/[\s\S]*return !!currentUser\.value/.test(appJs) ||
  /accounting\/'\) < 0\) return true;\s*return !!currentUser\.value/.test(appJs),
  'accounting waits for currentUser (not employees-only)');
assert(appJs.indexOf('allEmployees.value.length > 0') < 0 ||
  !/iframeMountReady[\s\S]*allEmployees\.value\.length > 0/.test(appJs),
  'iframeMountReady no longer mounts on employees-only');

assert(shell.indexOf('requestAnimationFrame') >= 0, 'shell blank-remount uses rAF');

console.log('\ntest-spa-iframe-remount: ok');
