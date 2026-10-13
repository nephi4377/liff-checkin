/**
 * Smoke: 主控台 IframeView 在會計 route 切換時必須能重掛
 */
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '../../..');
var iframeView = fs.readFileSync(path.join(root, 'spa/IframeView.js'), 'utf8');
var appJs = fs.readFileSync(path.join(root, 'spa/app.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(iframeView.indexOf("frameSrc.value = 'about:blank'") >= 0 || iframeView.indexOf('about:blank') >= 0,
  'blank intermediary');
assert(iframeView.indexOf('watch') >= 0, 'watches props.src');
assert(appJs.indexOf(':key=') >= 0 && appJs.indexOf('IframeView') >= 0, 'IframeView has :key');
assert(appJs.indexOf("route=quick_review.html") >= 0, 'quick-review route still wired');

console.log('test-spa-iframe-remount: ok');
