/**
 * 官網商店訂單 API 契約（Slice 1 骨架）
 * 規則：訂單編號必有；LINE 下單／需付款／LINE 付款；
 * 付完不自動改狀態；員工 Hub「標記已付款」；未付 7 天刪單。
 */
(function (global) {
  'use strict';

  var UNPAID_EXPIRE_DAYS = 7;

  var MOCK_ORDERS = [
    {
      order_number: 'TXS-10001',
      woo_id: 10001,
      status: 'awaiting_quote',
      status_label: '待報價（未成立）',
      woo_status: 'pending',
      stage: 'awaiting_quote',
      established: false,
      quoted: false,
      product_total: 3500,
      shipping_fee: null,
      payable_total: null,
      total: 3500,
      currency: 'TWD',
      created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      line_user_id: 'U_MOCK_CUSTOMER',
      items_summary: 'K&B 旋轉鏡架組（摩卡色）×1',
      items: [{
        name: 'K&B 旋轉鏡架組（摩卡色）',
        quantity: 1,
        price: 3500,
        total: 3500,
        sku: 'KB-MIRROR-MOCHA',
        image_url: 'https://tanxin.space/wp-content/uploads/2026/10/kb-d3030-300x300.jpg'
      }],
      customer_name: '王小明',
      customer_phone: '0912-345-678',
      customer_email: 'ming@example.com',
      billing_address: '王小明、台南市東區長榮路一段 100 號',
      shipping_name: '王小明',
      shipping_phone: '0912-345-678',
      shipping_company: '',
      shipping_address: '王小明、台南市東區長榮路一段 100 號 3 樓、701',
      shipping_address_1: '長榮路一段 100 號 3 樓',
      shipping_address_2: '',
      shipping_city: '東區',
      shipping_state: '台南市',
      shipping_postcode: '701',
      shipping_country: 'TW',
      customer_note: '假日可收件',
      paid_at: null,
      marked_paid_by: null
    },
    {
      order_number: 'TXS-10003',
      woo_id: 10003,
      status: 'awaiting_transfer',
      status_label: '待匯款（未成立）',
      woo_status: 'on-hold',
      stage: 'awaiting_transfer',
      established: false,
      quoted: true,
      product_total: 5200,
      shipping_fee: 300,
      payable_total: 5500,
      total: 5500,
      currency: 'TWD',
      created_at: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
      line_user_id: 'U_MOCK_CUSTOMER',
      items_summary: '展示櫃層板組 ×1',
      items: [{
        name: '展示櫃層板組',
        quantity: 1,
        price: 5200,
        total: 5200,
        sku: 'SHELF-01',
        image_url: 'https://tanxin.space/wp-content/uploads/2026/10/hy-set-467-300x300.jpg'
      }],
      customer_name: '林雅婷',
      customer_phone: '0988-111-222',
      customer_email: 'ya@example.com',
      billing_address: '林雅婷、高雄市左營區博愛二路 50 號',
      shipping_name: '林雅婷',
      shipping_phone: '0988-111-222',
      shipping_company: '添心工作室',
      shipping_address: '林雅婷、添心工作室、高雄市左營區博愛二路 50 號、813',
      shipping_address_1: '博愛二路 50 號',
      shipping_address_2: '',
      shipping_city: '左營區',
      shipping_state: '高雄市',
      shipping_postcode: '813',
      shipping_country: 'TW',
      customer_note: '',
      paid_at: null,
      marked_paid_by: null
    },
    {
      order_number: 'TXS-10002',
      woo_id: 10002,
      status: 'paid',
      status_label: '已成立（已付款）',
      woo_status: 'processing',
      stage: 'established',
      established: true,
      quoted: true,
      product_total: 12000,
      shipping_fee: 800,
      payable_total: 12800,
      total: 12800,
      currency: 'TWD',
      created_at: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
      line_user_id: 'U_MOCK_CUSTOMER',
      items_summary: '示範家具 ×1',
      items: [{
        name: '示範家具',
        quantity: 1,
        price: 12000,
        total: 12000,
        sku: 'DEMO-FURN',
        image_url: 'https://tanxin.space/wp-content/uploads/2026/10/kb-d3030-300x300.jpg'
      }],
      customer_name: '陳大文',
      customer_phone: '0922-000-111',
      customer_email: 'chen@example.com',
      billing_address: '陳大文、台北市大安區復興南路一段 1 號',
      shipping_name: '陳大文',
      shipping_phone: '0922-000-111',
      shipping_company: '',
      shipping_address: '陳大文、台北市大安區復興南路一段 1 號、106',
      shipping_address_1: '復興南路一段 1 號',
      shipping_address_2: '',
      shipping_city: '大安區',
      shipping_state: '台北市',
      shipping_postcode: '106',
      shipping_country: 'TW',
      customer_note: '請先電話聯絡',
      paid_at: new Date(Date.now() - 1 * 86400 * 1000).toISOString(),
      marked_paid_by: 'staff_mock'
    }
  ];

  function cfg() {
    return (global.CONFIG && global.CONFIG) || {};
  }

  function webAppUrl() {
    return cfg().SHOP_GAS_WEB_APP_URL || '';
  }

  function useMock() {
    var q = (typeof location !== 'undefined' && location.search) || '';
    // 預覽兩段狀態：?shop_mock=1 強制示意
    if (/(?:\?|&)shop_mock=1(?:&|$)/.test(q)) return true;
    if (!webAppUrl()) return true;
    return false;
  }

  function expireInfo(order) {
    if (!order || order.status === 'paid' || order.status === 'cancelled') {
      return { expires: false, message: '', ms_left: null };
    }
    var created = Date.parse(order.created_at || '') || Date.now();
    var deadline = created + UNPAID_EXPIRE_DAYS * 86400 * 1000;
    var left = deadline - Date.now();
    return {
      expires: true,
      deadline_iso: new Date(deadline).toISOString(),
      ms_left: left,
      message:
        left > 0
          ? '超過 ' + UNPAID_EXPIRE_DAYS + ' 天未付款（且後台未標記已付款），訂單將到期並刪除。'
          : '已超過 ' + UNPAID_EXPIRE_DAYS + ' 天未付款，此單應已到期刪除。'
    };
  }

  function canMarkPaid(order) {
    if (!order || order.established || order.status === 'paid') return false;
    return order.stage === 'awaiting_transfer' || order.status === 'awaiting_transfer' || order.quoted;
  }

  /** 標記已付款＝確認收款後訂單成立 */
  function staffPrimaryAction(order) {
    if (canMarkPaid(order)) {
      return { action: 'mark_paid', label: '確認收款／訂單成立', enabled: true };
    }
    if (order && (order.established || order.status === 'paid')) {
      return { action: null, label: '已成立', enabled: false };
    }
    return { action: 'quote', label: '待報價', enabled: false };
  }

  function mockOk(data) {
    return Promise.resolve({ success: true, mock: true, data: data });
  }

  function postAction(body) {
    var url = webAppUrl();
    if (!url) {
      return Promise.reject(new Error('尚未設定 SHOP_GAS_WEB_APP_URL'));
    }
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json();
    });
  }

  var ShopApi = {
    UNPAID_EXPIRE_DAYS: UNPAID_EXPIRE_DAYS,
    expireInfo: expireInfo,
    canMarkPaid: canMarkPaid,
    staffPrimaryAction: staffPrimaryAction,

    listOrdersStaff: function (auth) {
      if (useMock()) return mockOk({ orders: MOCK_ORDERS.slice() });
      return postAction({
        action: 'shop_orders_list',
        liff_id_token: (auth && auth.liff_id_token) || '',
        user_id: (auth && auth.user_id) || ''
      });
    },

    listMyOrders: function (auth) {
      if (useMock()) {
        return mockOk({
          orders: MOCK_ORDERS.filter(function (o) {
            return o.line_user_id === 'U_MOCK_CUSTOMER';
          })
        });
      }
      return postAction({
        action: 'shop_orders_mine',
        liff_id_token: (auth && auth.liff_id_token) || ''
      });
    },

    getOrder: function (auth, orderNumber) {
      if (useMock()) {
        var hit = MOCK_ORDERS.filter(function (o) {
          return o.order_number === orderNumber;
        })[0];
        if (!hit) return Promise.resolve({ success: false, message: '找不到訂單' });
        return mockOk({ order: hit, expire: expireInfo(hit) });
      }
      return postAction({
        action: 'shop_orders_get',
        order_number: orderNumber,
        liff_id_token: (auth && auth.liff_id_token) || '',
        user_id: (auth && auth.user_id) || ''
      });
    },

    createOrder: function (auth, payload) {
      if (useMock()) {
        var n = 'TXS-' + String(10000 + Math.floor(Math.random() * 90000));
        var order = {
          order_number: n,
          woo_id: null,
          status: 'pending_payment',
          status_label: '待付款',
          total: (payload && payload.total) || 0,
          currency: 'TWD',
          created_at: new Date().toISOString(),
          line_user_id: (auth && auth.line_user_id) || 'U_MOCK_CUSTOMER',
          items_summary: (payload && payload.items_summary) || '（示意品項）',
          paid_at: null,
          marked_paid_by: null,
          notify_pay_queued: true
        };
        MOCK_ORDERS.unshift(order);
        return mockOk({
          order: order,
          expire: expireInfo(order),
          line_notify: '需付款通知（示意：下單後應推播 LINE）'
        });
      }
      return postAction({
        action: 'shop_orders_create',
        liff_id_token: (auth && auth.liff_id_token) || '',
        items: (payload && payload.items) || [],
        total: (payload && payload.total) || 0
      });
    },

    /** 員工報價並寄匯款說明（報價前不寄帳戶） */
    quoteAndNotifyTransfer: function (auth, orderNumber, quote) {
      quote = quote || {};
      if (useMock()) {
        var hit = MOCK_ORDERS.filter(function (o) {
          return o.order_number === orderNumber;
        })[0];
        if (!hit) return Promise.resolve({ success: false, message: '找不到訂單' });
        var ship = Number(quote.shipping_fee);
        if (isNaN(ship) || ship < 0) {
          return Promise.resolve({ success: false, message: '運費無效' });
        }
        var product = hit.product_total != null ? hit.product_total : hit.total;
        hit.shipping_fee = ship;
        hit.payable_total = product + ship;
        hit.total = hit.payable_total;
        hit.quoted = true;
        hit.stage = 'awaiting_transfer';
        hit.status = 'awaiting_transfer';
        hit.status_label = '待匯款（未成立）';
        hit.established = false;
        return mockOk({
          order: hit,
          message: '已報價並寄匯款說明（示意；訂單尚未成立）',
          line_notify: 'Notify #2 匯款說明（示意）'
        });
      }
      return postAction({
        action: 'shop_orders_quote_and_notify_transfer',
        order_number: orderNumber,
        shipping_fee: quote.shipping_fee,
        payable_total: quote.payable_total,
        liff_id_token: (auth && auth.liff_id_token) || ''
      });
    },

    /** 確認收款 → 訂單成立（標記已付款） */
    markPaid: function (auth, orderNumber) {
      if (useMock()) {
        var hit = MOCK_ORDERS.filter(function (o) {
          return o.order_number === orderNumber;
        })[0];
        if (!hit) return Promise.resolve({ success: false, message: '找不到訂單' });
        if (hit.stage !== 'awaiting_transfer' && hit.status !== 'awaiting_transfer' && !hit.quoted) {
          return Promise.resolve({ success: false, message: '請先報價並寄匯款說明' });
        }
        hit.status = 'paid';
        hit.status_label = '已成立（已付款）';
        hit.stage = 'established';
        hit.established = true;
        hit.paid_at = new Date().toISOString();
        hit.marked_paid_by = (auth && auth.staff_name) || 'staff';
        return mockOk({ order: hit, message: '訂單已成立' });
      }
      return postAction({
        action: 'shop_orders_mark_paid',
        order_number: orderNumber,
        liff_id_token: (auth && auth.liff_id_token) || ''
      });
    },

    cancelOrder: function (auth, orderNumber, role) {
      if (useMock()) {
        var hit = MOCK_ORDERS.filter(function (o) {
          return o.order_number === orderNumber;
        })[0];
        if (!hit) return Promise.resolve({ success: false, message: '找不到訂單' });
        if (hit.status === 'paid' && role === 'customer') {
          return Promise.resolve({
            success: false,
            message: '已付款訂單請透過 LINE 告知客服處理取消／退款'
          });
        }
        hit.status = 'cancelled';
        hit.status_label = '已取消';
        return mockOk({ order: hit });
      }
      return postAction({
        action: 'shop_orders_cancel',
        order_number: orderNumber,
        role: role || 'customer',
        liff_id_token: (auth && auth.liff_id_token) || ''
      });
    },

    resendPayNotify: function (auth, orderNumber) {
      if (useMock()) {
        return mockOk({
          order_number: orderNumber,
          line_notify: '已重送需付款通知（示意）'
        });
      }
      return postAction({
        action: 'shop_orders_notify_pay',
        order_number: orderNumber,
        liff_id_token: (auth && auth.liff_id_token) || ''
      });
    },

    /**
     * 縮圖 → data URL（GAS UrlFetch；LINE WebView 不直接載跨網域 img）
     * mock：前端自抓 photon（CORS *）轉 blob／data URL
     */
    resolveThumbs: function (auth, urls) {
      var list = (urls || []).filter(function (u) {
        return !!u && /^https?:\/\//i.test(String(u));
      });
      var uniq = [];
      var seen = {};
      list.forEach(function (u) {
        var key = String(u);
        if (seen[key]) return;
        seen[key] = true;
        uniq.push(key);
      });
      if (!uniq.length) return Promise.resolve({ success: true, data: { thumbs: {} } });

      function photonUrl(url) {
        url = String(url || '').trim();
        var m = url.match(/^https?:\/\/i\d+\.wp\.com\/([^/?#]+)(\/wp-content\/uploads\/[^?#]+)/i);
        if (m) {
          return 'https://i0.wp.com/' + m[1] + m[2] + '?w=112&h=112&crop=1&ssl=1';
        }
        var m2 = url.match(/^https?:\/\/([^/]+)(\/wp-content\/uploads\/[^?#]+)/i);
        if (m2) {
          return 'https://i0.wp.com/' + m2[1] + m2[2] + '?w=112&h=112&crop=1&ssl=1';
        }
        return url;
      }

      function blobToDataUrl(blob) {
        return new Promise(function (resolve, reject) {
          var fr = new FileReader();
          fr.onload = function () {
            resolve(String(fr.result || ''));
          };
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
      }

      function clientFetchOne(url) {
        var target = photonUrl(url);
        return fetch(target, { mode: 'cors', credentials: 'omit' })
          .then(function (r) {
            if (!r.ok) throw new Error('thumb http ' + r.status);
            return r.blob();
          })
          .then(blobToDataUrl)
          .then(function (dataUrl) {
            return dataUrl && dataUrl.indexOf('data:image/') === 0 ? dataUrl : '';
          })
          .catch(function () {
            return '';
          });
      }

      if (useMock()) {
        return Promise.all(
          uniq.map(function (u) {
            return clientFetchOne(u).then(function (d) {
              return [u, d];
            });
          })
        ).then(function (pairs) {
          var thumbs = {};
          pairs.forEach(function (p) {
            if (p[1]) thumbs[p[0]] = p[1];
          });
          return { success: true, mock: true, data: { thumbs: thumbs } };
        });
      }

      return postAction({
        action: 'shop_orders_thumbs',
        urls: uniq.slice(0, 24),
        liff_id_token: (auth && auth.liff_id_token) || '',
        user_id: (auth && auth.user_id) || ''
      }).then(function (res) {
        if (res && res.success && res.data && res.data.thumbs) return res;
        // GAS 失敗時仍試 photon（桌機／非 LINE）
        return Promise.all(
          uniq.map(function (u) {
            return clientFetchOne(u).then(function (d) {
              return [u, d];
            });
          })
        ).then(function (pairs) {
          var thumbs = {};
          pairs.forEach(function (p) {
            if (p[1]) thumbs[p[0]] = p[1];
          });
          return {
            success: true,
            data: { thumbs: thumbs },
            message: (res && res.message) || 'thumb fallback client'
          };
        });
      });
    }
  };

  global.ShopApi = ShopApi;
})(typeof window !== 'undefined' ? window : globalThis);
