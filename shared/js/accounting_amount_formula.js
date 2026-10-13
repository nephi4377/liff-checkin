/**
 * 金額欄「=算式」：僅允許數字與 + - * / ( )；結果取整數。
 * 送出前請用 parseAmount／resolve；後端仍收整數金額。
 */
var AccountingAmountFormula = (function () {
  var PREVIEW_CLASS = 'amt-formula-preview';

  function rawString(val) {
    return String(val == null ? '' : val).trim();
  }

  function isFormula(val) {
    return rawString(val).charAt(0) === '=';
  }

  function stripThousands(s) {
    return String(s || '').replace(/[,，\s]/g, '');
  }

  /**
   * 安全解析算式（無 eval／Function）。
   * @returns {{ ok: boolean, value?: number, error?: string }}
   */
  function evalFormula(raw) {
    var s = rawString(raw);
    if (!s) return { ok: false, error: 'empty' };
    if (s.charAt(0) !== '=') {
      return { ok: false, error: 'not_formula' };
    }
    var expr = stripThousands(s.slice(1));
    if (!expr) return { ok: false, error: 'empty_formula' };
    // 全形運算子 → 半形
    expr = expr
      .replace(/＋/g, '+')
      .replace(/－/g, '-')
      .replace(/×|＊/g, '*')
      .replace(/÷|／/g, '/')
      .replace(/（/g, '(')
      .replace(/）/g, ')');
    if (!/^[\d.+\-*/()]+$/.test(expr)) {
      return { ok: false, error: 'bad_chars' };
    }
    var tokens = tokenize_(expr);
    if (!tokens) return { ok: false, error: 'tokenize' };
    var pos = 0;
    function peek() {
      return tokens[pos] || null;
    }
    function take() {
      return tokens[pos++] || null;
    }
    function parseExpr() {
      var left = parseTerm();
      if (left == null) return null;
      while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
        var op = take().v;
        var right = parseTerm();
        if (right == null) return null;
        left = op === '+' ? left + right : left - right;
      }
      return left;
    }
    function parseTerm() {
      var left = parseUnary();
      if (left == null) return null;
      while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
        var op = take().v;
        var right = parseUnary();
        if (right == null) return null;
        if (op === '/') {
          if (right === 0) return null;
          left = left / right;
        } else {
          left = left * right;
        }
      }
      return left;
    }
    function parseUnary() {
      if (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
        var op = take().v;
        var v = parseUnary();
        if (v == null) return null;
        return op === '-' ? -v : v;
      }
      return parsePrimary();
    }
    function parsePrimary() {
      var tok = peek();
      if (!tok) return null;
      if (tok.t === 'num') {
        take();
        return tok.v;
      }
      if (tok.t === 'op' && tok.v === '(') {
        take();
        var inner = parseExpr();
        if (inner == null) return null;
        var close = take();
        if (!close || close.t !== 'op' || close.v !== ')') return null;
        return inner;
      }
      return null;
    }
    var result = parseExpr();
    if (result == null || !isFinite(result) || pos !== tokens.length) {
      return { ok: false, error: 'parse' };
    }
    return { ok: true, value: Math.round(result) };
  }

  function tokenize_(expr) {
    var tokens = [];
    var i = 0;
    while (i < expr.length) {
      var c = expr.charAt(i);
      if (c === '.' || (c >= '0' && c <= '9')) {
        var start = i;
        var seenDot = false;
        while (i < expr.length) {
          var d = expr.charAt(i);
          if (d === '.') {
            if (seenDot) return null;
            seenDot = true;
            i++;
            continue;
          }
          if (d >= '0' && d <= '9') {
            i++;
            continue;
          }
          break;
        }
        var numStr = expr.slice(start, i);
        if (numStr === '.' || numStr === '') return null;
        var n = parseFloat(numStr);
        if (!isFinite(n)) return null;
        tokens.push({ t: 'num', v: n });
        continue;
      }
      if ('+-*/()'.indexOf(c) >= 0) {
        tokens.push({ t: 'op', v: c });
        i++;
        continue;
      }
      return null;
    }
    return tokens;
  }

  /** 一般數字或 =算式 → 整數；失敗回 NaN */
  function parseAmount(val) {
    var s = rawString(val);
    if (!s) return NaN;
    if (isFormula(s)) {
      var r = evalFormula(s);
      return r.ok ? r.value : NaN;
    }
    var n = parseInt(stripThousands(s), 10);
    return isNaN(n) ? NaN : n;
  }

  function formatMoney(n) {
    if (!isFinite(n)) return '';
    return '$' + Number(n).toLocaleString('zh-TW');
  }

  function previewText(val) {
    var s = rawString(val);
    if (!isFormula(s)) return '';
    var r = evalFormula(s);
    if (!r.ok) return '算式有誤';
    return '結果 ' + formatMoney(r.value);
  }

  function ensurePreviewEl_(inputEl) {
    if (!inputEl || !inputEl.parentNode) return null;
    var next = inputEl.nextElementSibling;
    if (next && next.classList && next.classList.contains(PREVIEW_CLASS)) return next;
    var el = document.createElement('p');
    el.className = PREVIEW_CLASS;
    el.setAttribute('aria-live', 'polite');
    inputEl.parentNode.insertBefore(el, inputEl.nextSibling);
    return el;
  }

  function refreshPreview(inputEl) {
    if (!inputEl) return;
    var preview = ensurePreviewEl_(inputEl);
    if (!preview) return;
    var text = previewText(inputEl.value);
    preview.textContent = text;
    preview.classList.toggle('is-error', text === '算式有誤');
    preview.classList.toggle('is-empty', !text);
  }

  /**
   * 綁定單一金額欄：輸入時更新預覽。
   * @param {HTMLInputElement} inputEl
   * @param {{ onResolved?: function(number|NaN): void }} [opts]
   */
  function bindInput(inputEl, opts) {
    if (!inputEl || inputEl._amtFormulaBound) return inputEl;
    opts = opts || {};
    inputEl._amtFormulaBound = true;
    if (inputEl.getAttribute('type') === 'number') {
      inputEl.setAttribute('type', 'text');
      inputEl.setAttribute('inputmode', 'decimal');
    }
    if (!inputEl.getAttribute('placeholder')) {
      inputEl.setAttribute('placeholder', '數字或 =1000+50');
    }
    function bump() {
      refreshPreview(inputEl);
      if (typeof opts.onResolved === 'function') {
        opts.onResolved(parseAmount(inputEl.value));
      }
    }
    inputEl.addEventListener('input', bump);
    inputEl.addEventListener('change', bump);
    refreshPreview(inputEl);
    return inputEl;
  }

  /** 在容器內找 selector（預設 .inp-amt, .alloc-amt, [data-amount-formula]）並綁定 */
  function enhanceContainer(root, selector, opts) {
    if (!root) return 0;
    var sel = selector || '.inp-amt, .alloc-amt, [data-amount-formula]';
    var nodes = root.querySelectorAll(sel);
    var n = 0;
    for (var i = 0; i < nodes.length; i++) {
      bindInput(nodes[i], opts);
      n++;
    }
    return n;
  }

  return {
    isFormula: isFormula,
    evalFormula: evalFormula,
    parseAmount: parseAmount,
    previewText: previewText,
    formatMoney: formatMoney,
    refreshPreview: refreshPreview,
    bindInput: bindInput,
    enhanceContainer: enhanceContainer,
    PREVIEW_CLASS: PREVIEW_CLASS
  };
})();
