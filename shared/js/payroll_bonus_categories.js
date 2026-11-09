/**
 * BONUS-CATS：與後端 CheckinSystem/Logic_BonusCategories.js 對齊的前端清單
 * 僅代碼／標籤；金額由畫面輸入（勿寫入真實薪資）。
 */
(function (root) {
  var CATS = [
    { code: 'position', label: '職務加給' },
    { code: 'license', label: '證照加給' },
    { code: 'performance', label: '業績' },
    { code: 'close', label: '結案' },
    { code: 'quarterly', label: '季獎' },
    { code: 'video', label: '影片獎金' },
    { code: 'other', label: '其他獎金' }
  ];

  function list(serverList) {
    if (serverList && serverList.length) {
      return serverList.map(function (r) {
        return { code: String(r.code || ''), label: String(r.label || r.code || '') };
      }).filter(function (r) { return r.code; });
    }
    return CATS.slice();
  }

  function labelOf(code, serverList) {
    var key = String(code || '').trim();
    var rows = list(serverList);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].code === key) return rows[i].label;
    }
    return '';
  }

  function optionsHtml(selected, serverList) {
    var sel = String(selected || '');
    var html = '<option value="">選擇類別</option>';
    list(serverList).forEach(function (r) {
      html += '<option value="' + r.code + '"' + (sel === r.code ? ' selected' : '') + '>' + r.label + '</option>';
    });
    return html;
  }

  root.PayrollBonusCategories = {
    list: list,
    labelOf: labelOf,
    optionsHtml: optionsHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);
