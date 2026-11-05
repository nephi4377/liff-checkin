/**
 * 官網商店訂單 API 契約（Slice 1 骨架）
 * 規則：訂單編號必有；LINE 下單／需付款／LINE 付款；
 * 付完不自動改狀態；員工 Hub「標記已付款」；未付 3 天刪單。
 */
(function (global) {
  'use strict';

  var UNPAID_EXPIRE_DAYS = 3;

  var MOCK_ORDERS = [
    {
      order_number: 'TXS-10001',
      woo_id: 10001,
      status: 'pending_payment',
      status_label: '待付款',
      total: 3500,
      currency: 'TWD',
      created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      line_user_id: 'U_MOCK_CUSTOMER',
      items_summary: 'K&B 旋轉鏡架組（摩卡色）×1',
      paid_at: null,
      marked_paid_by: null
    },
    {
      order_number: 'TXS-10002',
      woo_id: 10002,
      status: 'paid',
      status_label: '已付款',
      total: 12800,
      currency: 'TWD',
      created_at: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
      line_user_id: 'U_MOCK_CUSTOMER',
      items_summary: '示範家具 ×1',
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
    if (/(?:\?|&)shop_mock=0(?:&|$)/.test(q) && webAppUrl()) return false;
    // Slice 1：未接 GAS URL 或未強制關 mock → 一律 mock（含標記已付款示意）
    return true;
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
    return !!(order && order.status === 'pending_payment');
  }

  /** 履約類狀態：MVP 首版僅「標記已付款」；付完亦不自動變更 */
  function staffPrimaryAction(order) {
    if (canMarkPaid(order)) {
      return { action: 'mark_paid', label: '標記已付款', enabled: true };
    }
    return { action: null, label: '已付款', enabled: false };
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
        liff_id_token: (auth && auth.liff_id_token) || ''
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
        liff_id_token: (auth && auth.liff_id_token) || ''
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

    /** 員工唯一付款狀態入口：標記已付款（非金流自動） */
    markPaid: function (auth, orderNumber) {
      if (useMock()) {
        var hit = MOCK_ORDERS.filter(function (o) {
          return o.order_number === orderNumber;
        })[0];
        if (!hit) return Promise.resolve({ success: false, message: '找不到訂單' });
        if (hit.status !== 'pending_payment') {
          return Promise.resolve({ success: false, message: '此單不是待付款，無法標記已付款' });
        }
        hit.status = 'paid';
        hit.status_label = '已付款';
        hit.paid_at = new Date().toISOString();
        hit.marked_paid_by = (auth && auth.staff_name) || 'staff';
        return mockOk({ order: hit });
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
    }
  };

  global.ShopApi = ShopApi;
})(typeof window !== 'undefined' ? window : globalThis);
