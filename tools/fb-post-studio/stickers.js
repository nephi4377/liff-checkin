/**
 * 貼圖素材庫＋盡力轉透明 PNG（PDF 相容 .ai／PNG／SVG）
 * 本機 IndexedDB／localStorage；不需後端。
 */
(function (global) {
  'use strict';

  var CFG = global.FB_POST_STUDIO_CONFIG || {};
  var DB_KEY = CFG.STICKER_DB_KEY || 'tx_fb_post_studio_stickers_v1';
  var MAX = CFG.STICKER_MAX || 40;
  var IDB_NAME = 'tx_fb_post_studio_idb';
  var IDB_STORE = 'stickers';

  function uid() {
    return 'stk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function readFileAsArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('讀檔失敗')); };
      r.readAsArrayBuffer(file);
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('讀檔失敗')); };
      r.readAsDataURL(file);
    });
  }

  function isPdfMagic(buf) {
    if (!buf || buf.byteLength < 5) return false;
    var u8 = new Uint8Array(buf);
    return u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46; // %PDF
  }

  function canvasToPngDataUrl(canvas) {
    return canvas.toDataURL('image/png');
  }

  function loadImageFromUrl(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('無法載入圖片')); };
      img.src = url;
    });
  }

  /**
   * 簡易去近白底（僅當幾乎無透明通道時）— 務實 MVP，非完美抠圖
   */
  function tryKnockoutNearWhite(canvas, threshold) {
    threshold = threshold == null ? 245 : threshold;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    var data = ctx.getImageData(0, 0, w, h);
    var d = data.data;
    var transparent = 0;
    var i;
    for (i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 250) {
        transparent += 1;
        continue;
      }
      if (d[i] >= threshold && d[i + 1] >= threshold && d[i + 2] >= threshold) {
        d[i + 3] = 0;
      }
    }
    // 已有明顯透明就不強制改寫
    if (transparent > (w * h * 0.05)) return canvasToPngDataUrl(canvas);
    ctx.putImageData(data, 0, 0);
    return canvasToPngDataUrl(canvas);
  }

  function renderPdfFirstPage(arrayBuffer, maxEdge) {
    maxEdge = maxEdge || 1600;
    var pdfjs = global.pdfjsLib;
    if (!pdfjs) {
      return Promise.reject(new Error('未載入 PDF 引擎；請改用透明 PNG／SVG'));
    }
    return pdfjs.getDocument({ data: arrayBuffer }).promise.then(function (pdf) {
      return pdf.getPage(1);
    }).then(function (page) {
      var viewport = page.getViewport({ scale: 1 });
      var scale = Math.min(1, maxEdge / Math.max(viewport.width, viewport.height));
      var vp = page.getViewport({ scale: scale * 2 });
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(vp.width));
      canvas.height = Math.max(1, Math.round(vp.height));
      var ctx = canvas.getContext('2d');
      return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
        return tryKnockoutNearWhite(canvas, 248);
      });
    });
  }

  function convertRasterOrSvg(file) {
    return readFileAsDataUrl(file).then(function (url) {
      return loadImageFromUrl(url).then(function (img) {
        var maxEdge = 1600;
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var scale = Math.min(1, maxEdge / Math.max(w, h));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var name = (file.name || '').toLowerCase();
        if (name.endsWith('.png') || name.endsWith('.svg') || name.endsWith('.webp') ||
            (file.type || '').indexOf('svg') >= 0 || (file.type || '') === 'image/png') {
          return canvasToPngDataUrl(canvas);
        }
        // JPG：嘗試近白去背（常失敗，但給一條路）
        return tryKnockoutNearWhite(canvas, 242);
      });
    });
  }

  /**
   * @returns {Promise<{preview:string, mime:'image/png', note:string}>}
   */
  function convertToTransparentPng(file) {
    if (!file) return Promise.reject(new Error('未選擇檔案'));
    var name = (file.name || '').toLowerCase();
    var type = (file.type || '').toLowerCase();

    return readFileAsArrayBuffer(file).then(function (buf) {
      var looksPdf = isPdfMagic(buf) || type === 'application/pdf' || name.endsWith('.pdf');
      var looksAi = name.endsWith('.ai') || type === 'application/postscript' ||
        type === 'application/illustrator';

      if (looksAi || looksPdf) {
        if (!isPdfMagic(buf) && looksAi) {
          return Promise.reject(new Error(
            '此 .ai 不是 PDF 相容格式，瀏覽器無法解析。' +
            '請用 Illustrator／其他工具「匯出透明 PNG」→ 再上傳 PNG（不要再傳此 .ai）。'
          ));
        }
        return renderPdfFirstPage(buf).then(function (preview) {
          return {
            preview: preview,
            mime: 'image/png',
            note: looksAi
              ? '已依 PDF 相容 .ai 轉成透明 PNG（簡易；複雜路徑／特效可能不完整）'
              : '已自 PDF 首頁轉成透明 PNG（簡易）'
          };
        }).catch(function (e) {
          return Promise.reject(new Error(
            '無法解析此 .ai／PDF。請改用 Illustrator 匯出透明 PNG 後再上傳。' +
            (e && e.message ? '（' + e.message + '）' : '')
          ));
        });
      }

      return convertRasterOrSvg(file).then(function (preview) {
        return {
          preview: preview,
          mime: 'image/png',
          note: name.endsWith('.jpg') || name.endsWith('.jpeg')
            ? 'JPG 已盡力去近白底；若邊緣不乾淨請改用透明 PNG'
            : '已轉成 PNG'
        };
      });
    });
  }

  /* ---------- storage ---------- */

  function openIdb() {
    return new Promise(function (resolve, reject) {
      if (!global.indexedDB) {
        reject(new Error('no-idb'));
        return;
      }
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('idb open fail')); };
    });
  }

  function idbGetAll() {
    return openIdb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var store = tx.objectStore(IDB_STORE);
        var req = store.getAll();
        req.onsuccess = function () {
          var list = req.result || [];
          list.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
          resolve(list);
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function idbPut(item) {
    return openIdb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(item);
        tx.oncomplete = function () { resolve(item); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function idbDelete(id) {
    return openIdb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function lsLoad() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function lsSave(list) {
    localStorage.setItem(DB_KEY, JSON.stringify((list || []).slice(0, MAX)));
  }

  function listStickers() {
    return idbGetAll().catch(function () {
      return lsLoad();
    });
  }

  function saveSticker(entry) {
    return idbPut(entry).then(function () {
      return entry;
    }).catch(function () {
      var list = lsLoad();
      list.unshift(entry);
      lsSave(list);
      return entry;
    });
  }

  function removeSticker(id) {
    return idbDelete(id).catch(function () {
      lsSave(lsLoad().filter(function (x) { return x.id !== id; }));
    });
  }

  function addConvertedSticker(file, category) {
    return convertToTransparentPng(file).then(function (conv) {
      var entry = {
        id: uid(),
        ts: Date.now(),
        name: file.name || 'sticker.png',
        category: (category || '貼圖').trim() || '貼圖',
        preview: conv.preview,
        mime: conv.mime,
        note: conv.note || ''
      };
      return listStickers().then(function (list) {
        if (list.length >= MAX) {
          var oldest = list[list.length - 1];
          if (oldest && oldest.id) return removeSticker(oldest.id).then(function () { return entry; });
        }
        return entry;
      }).then(function (e) {
        return saveSticker(e);
      });
    });
  }

  global.FbPostStickers = {
    convertToTransparentPng: convertToTransparentPng,
    listStickers: listStickers,
    addConvertedSticker: addConvertedSticker,
    removeSticker: removeSticker,
    loadImageFromUrl: loadImageFromUrl
  };
})(window);
