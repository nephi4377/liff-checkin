/** 主控台內嵌使用說明 — 共用腳本 */
(function () {
  function normalizeRoute(route) {
    var r = (route || '').trim();
    if (!r) return '#/help';
    if (!r.startsWith('#')) r = '#' + r;
    return r;
  }

  function hubNav(route) {
    var hash = normalizeRoute(route);
    var inIframe = window.parent && window.parent !== window;
    if (inIframe) {
      try {
        window.parent.location.hash = hash.replace(/^#/, '');
      } catch (e) {
        window.location.href = window.location.origin + '/' + hash;
      }
    } else {
      window.location.href = window.location.origin + '/' + hash;
    }
  }

  function bindHubLink(a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var target = a.getAttribute('data-hub-route') || a.getAttribute('href') || '#/help';
      hubNav(target);
    });
  }

  document.querySelectorAll('a[data-hub-route]').forEach(bindHubLink);

  document.querySelectorAll('a[href^="#/"]').forEach(function (a) {
    if (a.hasAttribute('data-hub-route')) return;
    bindHubLink(a);
  });

  document.querySelectorAll('.help-back a').forEach(bindHubLink);

  document.querySelectorAll('.help-footer a[href^="#/"]').forEach(function (a) {
    if (a.hasAttribute('data-hub-route')) return;
    bindHubLink(a);
  });

  document.querySelectorAll('.help-img-ph[data-img]').forEach(function (fig) {
    var src = fig.getAttribute('data-img');
    var img = new Image();
    img.onload = function () {
      fig.innerHTML = '';
      img.alt = fig.getAttribute('data-alt') || '';
      fig.appendChild(img);
    };
    img.onerror = function () {
      var section = fig.closest('.help-flow-section');
      if (section && section.querySelector('.help-flow')) {
        fig.remove();
        return;
      }
      var ph = fig.querySelector('.help-img-placeholder');
      if (ph && ph.textContent.indexOf('載入流程圖') >= 0) {
        fig.remove();
      }
    };
    img.src = src;
  });
})();
