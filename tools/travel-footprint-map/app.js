/* global d3, L */
(function () {
  "use strict";

  const COUNTRY_ZH = {
    TW: "台灣", JP: "日本", KR: "韓國", SG: "新加坡", VN: "越南", CN: "中國",
    TH: "泰國", IT: "義大利", BE: "比利時", GB: "英國", MY: "馬來西亞",
    DE: "德國", NL: "荷蘭", GU: "關島", HK: "香港", MO: "澳門", FR: "法國",
    US: "美國", AU: "澳洲",
  };

  const CITY_MAP = {
    TW: [[121.5, 25.0, "台北"], [120.2, 22.6, "高雄"], [120.7, 24.2, "台中"]],
    JP: [[139.7, 35.7, "東京"], [135.5, 34.7, "大阪"], [136.9, 35.2, "名古屋"], [130.4, 33.6, "福岡"]],
    KR: [[126.98, 37.57, "首爾"], [129.16, 35.18, "釜山"], [126.5, 33.5, "濟州"]],
    SG: [[103.85, 1.29, "新加坡"]],
    VN: [[105.85, 21.03, "河內"], [106.7, 10.8, "胡志明"]],
    CN: [[116.4, 39.9, "北京"], [121.5, 31.2, "上海"]],
    IT: [[12.5, 41.9, "羅馬"], [11.25, 43.77, "佛羅倫斯"]],
    GB: [[-0.12, 51.5, "倫敦"]],
    BE: [[4.35, 50.85, "布魯塞爾"]],
    DE: [[13.4, 52.52, "柏林"]],
    NL: [[4.9, 52.37, "阿姆斯特丹"]],
    TH: [[100.5, 13.75, "曼谷"]],
    MY: [[101.69, 3.14, "吉隆坡"]],
  };

  const THEMES = {
    "poster-white": {
      name: "海報·白陸藍海",
      poster: true,
      ui: { bg: "#3a4f5c", panel: "#2a3842", border: "#5a7280", accent: "#e8ecf0", text: "#f0f4f8", textDim: "#9cb0bc" },
      map: {
        bg: "#7A96A8",
        land: "#F7F5EF",
        landStroke: "#5A7282",
        landStrokeHi: "#4a6270",
        coastWidth: 1.35,
        marker: "#E04E4E",
        glow: "#E04E4E",
        edge: "#ffffff",
        label: "#1e293b",
        labelStroke: "#F7F5EF",
      },
      swatch: ["#7A96A8", "#F7F5EF", "#E04E4E"],
    },
    "poster-teal": {
      name: "海報·深藍綠陸",
      poster: true,
      ui: { bg: "#0f2847", panel: "#142d4d", border: "#1e4976", accent: "#5eead4", text: "#e0f2fe", textDim: "#7eb8c9" },
      map: {
        bg: "#1a3a5c",
        land: "#5ec4b7",
        landStroke: "#2d7a70",
        landStrokeHi: "#1f5c54",
        coastWidth: 1.4,
        marker: "#ef4444",
        glow: "#f87171",
        edge: "#fef9c3",
        label: "#0f2847",
        labelStroke: "#ccfbf1",
      },
      swatch: ["#1a3a5c", "#5ec4b7", "#ef4444"],
    },
    gold: {
      name: "曜金黑",
      ui: { bg: "#060608", panel: "#121010", border: "#3d3420", accent: "#d4b56a", text: "#e8dcc0", textDim: "#9a8b6a" },
      map: { bg: "#040406", land: "#222018", landStroke: "#b89850", landStrokeHi: "#e8cc78", marker: "#f0d080", glow: "#c9922e", edge: "#ffe9a8", label: "#e8dcc0", labelStroke: "#060608" },
      swatch: ["#060608", "#222018", "#d4b56a"],
    },
    ocean: {
      name: "深海藍",
      ui: { bg: "#040810", panel: "#0a1420", border: "#1a3550", accent: "#5eb8d9", text: "#d0e8f0", textDim: "#6a98b0" },
      map: { bg: "#020610", land: "#142838", landStroke: "#4a9ec4", landStrokeHi: "#7ec8e8", marker: "#7ed4f0", glow: "#2a88b0", edge: "#b8ecff", label: "#d8f0ff", labelStroke: "#040810" },
      swatch: ["#040810", "#142838", "#5eb8d9"],
    },
    parchment: {
      name: "羊皮紙",
      ui: { bg: "#1a1610", panel: "#221c14", border: "#4a4030", accent: "#c4a060", text: "#f0e4cc", textDim: "#a09070" },
      map: { bg: "#120f0a", land: "#2e2618", landStroke: "#a08048", landStrokeHi: "#d4b878", marker: "#e8c878", glow: "#a87830", edge: "#ffe8b0", label: "#f0e8d0", labelStroke: "#1a1610" },
      swatch: ["#1a1610", "#2e2618", "#c4a060"],
    },
    midnight: {
      name: "午夜藍",
      ui: { bg: "#080818", panel: "#0e0e22", border: "#282850", accent: "#8888e8", text: "#e0e0ff", textDim: "#7878a8" },
      map: { bg: "#050510", land: "#1a1a38", landStroke: "#6868c8", landStrokeHi: "#9898f0", marker: "#a8a8ff", glow: "#5858c0", edge: "#d0d0ff", label: "#e8e8ff", labelStroke: "#080818" },
      swatch: ["#080818", "#1a1a38", "#8888e8"],
    },
    aurora: {
      name: "極光綠",
      ui: { bg: "#060e0c", panel: "#0c1814", border: "#1a4038", accent: "#58c8a0", text: "#d8f0e8", textDim: "#68a088" },
      map: { bg: "#030a08", land: "#142820", landStroke: "#48a880", landStrokeHi: "#78d8b0", marker: "#90e8c0", glow: "#38a070", edge: "#c0ffe0", label: "#e0fff0", labelStroke: "#060e0c" },
      swatch: ["#060e0c", "#142820", "#58c8a0"],
    },
    rose: {
      name: "玫瑰暮",
      ui: { bg: "#100808", panel: "#180e0e", border: "#402828", accent: "#d88898", text: "#f0d8dc", textDim: "#a07078" },
      map: { bg: "#0a0406", land: "#281418", landStroke: "#b86878", landStrokeHi: "#e898a8", marker: "#f0a8b8", glow: "#c05868", edge: "#ffd0d8", label: "#ffe8ec", labelStroke: "#100808" },
      swatch: ["#100808", "#281418", "#d88898"],
    },
  };

  const PRESETS = {
    poster: {
      baseMap: "vector",
      projection: "robinson",
      theme: "poster-white",
      hint: "裝飾海報：白陸＋藍海高對比（像掛軸）；配色可在「質感配色」更換",
      toast: "已套用裝飾海報風格",
    },
    "street-voyager": {
      baseMap: "carto-voyager",
      projection: "mercator",
      hint: "街道 Voyager：彩色街道圖，適合認路與找地標",
      toast: "已套用 Carto Voyager 街道圖",
    },
    "street-osm": {
      baseMap: "osm",
      projection: "mercator",
      hint: "街道 OSM：OpenStreetMap 街道圖，細節清楚",
      toast: "已套用 OpenStreetMap 街道圖",
    },
    satellite: {
      baseMap: "esri-satellite",
      projection: "mercator",
      hint: "衛星空拍：Esri 衛星影像，鳥瞰地形與建物",
      toast: "已套用 Esri 衛星影像",
    },
  };

  const TILE_LAYERS = {
    "carto-dark": {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      opts: { attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 19 },
    },
    "carto-light": {
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      opts: { attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 19 },
    },
    "carto-voyager": {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      opts: { attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 19 },
    },
    osm: {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      opts: { attribution: "&copy; OpenStreetMap", maxZoom: 19 },
    },
    "esri-satellite": {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      opts: { attribution: "Tiles &copy; Esri", maxZoom: 18 },
    },
  };

  const els = {
    statusLine: document.getElementById("statusLine"),
    mapPanel: document.getElementById("mapPanel"),
    mapFrame: document.getElementById("mapFrame"),
    mapEmpty: document.getElementById("mapEmpty"),
    mapLoading: document.getElementById("mapLoading"),
    mapSvg: document.getElementById("mapSvg"),
    mapLeaflet: document.getElementById("mapLeaflet"),
    mapTooltip: document.getElementById("mapTooltip"),
    mapPopup: document.getElementById("mapPopup"),
    popupContent: document.getElementById("popupContent"),
    btnPopupClose: document.getElementById("btnPopupClose"),
    popupViewMode: document.getElementById("popupViewMode"),
    popupEditMode: document.getElementById("popupEditMode"),
    popupJournalDisplay: document.getElementById("popupJournalDisplay"),
    btnEditJournal: document.getElementById("btnEditJournal"),
    btnDeleteLocation: document.getElementById("btnDeleteLocation"),
    journalNameInput: document.getElementById("journalNameInput"),
    journalDateInput: document.getElementById("journalDateInput"),
    journalNoteInput: document.getElementById("journalNoteInput"),
    btnSaveJournal: document.getElementById("btnSaveJournal"),
    btnCancelJournal: document.getElementById("btnCancelJournal"),
    btnStartManualAdd: document.getElementById("btnStartManualAdd"),
    manualAddForm: document.getElementById("manualAddForm"),
    manualLocName: document.getElementById("manualLocName"),
    manualLocLat: document.getElementById("manualLocLat"),
    manualLocLon: document.getElementById("manualLocLon"),
    btnSubmitManualAdd: document.getElementById("btnSubmitManualAdd"),
    btnCancelManualAdd: document.getElementById("btnCancelManualAdd"),
    journalList: document.getElementById("journalList"),
    fileInput: document.getElementById("fileInput"),
    btnSample: document.getElementById("btnSample"),
    baseMapSelect: document.getElementById("baseMapSelect"),
    baseMapHint: document.getElementById("baseMapHint"),
    presetHint: document.getElementById("presetHint"),
    presetButtons: document.querySelectorAll(".preset-btn"),
    themeSelect: document.getElementById("themeSelect"),
    themeSwatch: document.getElementById("themeSwatch"),
    customThemePanel: document.getElementById("customThemePanel"),
    cpMapBg: document.getElementById("cpMapBg"),
    cpMapLand: document.getElementById("cpMapLand"),
    cpMapLandStroke: document.getElementById("cpMapLandStroke"),
    cpMapMarker: document.getElementById("cpMapMarker"),
    cpUiText: document.getElementById("cpUiText"),
    cpUiBorder: document.getElementById("cpUiBorder"),
    modeCluster: document.getElementById("modeCluster"),
    modeAll: document.getElementById("modeAll"),
    projRobinson: document.getElementById("projRobinson"),
    projMercator: document.getElementById("projMercator"),
    markerSize: document.getElementById("markerSize"),
    markerSizeVal: document.getElementById("markerSizeVal"),
    defaultMarkerSelect: document.getElementById("defaultMarkerSelect"),
    customTitleInput: document.getElementById("customTitleInput"),
    customSubtitleInput: document.getElementById("customSubtitleInput"),
    customSignatureInput: document.getElementById("customSignatureInput"),
    showCompass: document.getElementById("showCompass"),
    showAirplane: document.getElementById("showAirplane"),
    btnExportBackup: document.getElementById("btnExportBackup"),
    backupFileInput: document.getElementById("backupFileInput"),
    summaryStats: document.getElementById("summaryStats"),
    countryList: document.getElementById("countryList"),
    googleApiKey: document.getElementById("googleApiKey"),
    btnSaveGoogleKey: document.getElementById("btnSaveGoogleKey"),
    btnClearGoogleKey: document.getElementById("btnClearGoogleKey"),
    btnResetView: document.getElementById("btnResetView"),
    btnExport: document.getElementById("btnExport"),
    exportHint: document.getElementById("exportHint"),
    projGroup: document.getElementById("projGroup"),
    helpList: document.getElementById("helpList"),
    toast: document.getElementById("toast"),
    dropZoneMask: document.getElementById("dropZoneMask"),
    popupPhotoContainer: document.getElementById("popupPhotoContainer"),
    popupPhotoEditZone: document.getElementById("popupPhotoEditZone"),
    popupPhotoEditPreview: document.getElementById("popupPhotoEditPreview"),
    popupPhotoEditPlaceholder: document.getElementById("popupPhotoEditPlaceholder"),
    journalPhotoInput: document.getElementById("journalPhotoInput"),
    btnRemovePhoto: document.getElementById("btnRemovePhoto"),
    journalPhotoUrlInput: document.getElementById("journalPhotoUrlInput"),
    manualLocPhotoUrl: document.getElementById("manualLocPhotoUrl"),
    btnFastReadUrl: document.getElementById("btnFastReadUrl"),
  };

  const state = {
    points: [],
    manualPoints: [],
    markers: [],
    journal: {},
    mode: "cluster",
    projection: "robinson",
    baseMap: "vector",
    theme: "poster-white",
    customTheme: {
      mapBg: "#030304",
      mapLand: "#222018",
      mapLandStroke: "#b89850",
      mapMarker: "#f0d080",
      uiText: "#e8dcc0",
      uiBorder: "#2a2418"
    },
    markerScale: 1.2,
    defaultMarkerType: "glow",
    customMarkerTypes: {},
    activeMarkerId: null,
    customTitle: "",
    customSubtitle: "",
    customSignature: "",
    showCompass: true,
    showAirplane: true,
    landGeo: null,
    zoomK: 1,
    sourceName: "",
    googleApiKey: localStorage.getItem("travelFootprintGoogleKey") || "",
    activePreset: "poster",
  };

  const VIEW_PAD = 28;

  let svg, gRoot, gOcean, gMap, gMarkers, gLabels, gCompass, gDecoration, gTitleBlock, projection, path, zoom, width, height, resizeObserver;
  let leafletMap, leafletLayer, leafletMarkers = [];
  let mapMetrics = { w: 0, h: 0, bounds: null };
  let zoomRaf = 0;
  let pendingZoom = null;
  let skipZoomEnd = false;

  function theme() {
    if (state.theme === "custom") {
      const ct = state.customTheme;
      return {
        name: "自訂配色",
        poster: THEMES[state.activePreset]?.poster || false,
        ui: {
          bg: ct.mapBg,
          panel: ct.mapLand,
          border: ct.uiBorder,
          accent: ct.mapMarker,
          text: ct.uiText,
          textDim: ct.uiText + "b0"
        },
        map: {
          bg: ct.mapBg,
          land: ct.mapLand,
          landStroke: ct.mapLandStroke,
          landStrokeHi: ct.mapLandStroke,
          coastWidth: 1.35,
          marker: ct.mapMarker,
          glow: ct.mapMarker,
          edge: ct.mapMarker,
          label: ct.uiText,
          labelStroke: ct.mapLand
        },
        swatch: [ct.mapBg, ct.mapLand, ct.mapMarker]
      };
    }
    return THEMES[state.theme] || THEMES.gold;
  }
  function isVectorMode() { return state.baseMap === "vector"; }
  function isGoogleBase() { return state.baseMap.startsWith("google-"); }

  function toast(msg, type) {
    els.toast.textContent = msg;
    els.toast.className = "toast" + (type ? " " + type : "");
    els.toast.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { els.toast.classList.add("hidden"); }, 3200);
  }

  function setStatus(msg) { els.statusLine.textContent = msg; }

  function setLoading(on) {
    els.mapLoading.classList.toggle("hidden", !on);
    els.mapLoading.setAttribute("aria-hidden", on ? "false" : "true");
    if (on) {
      els.mapEmpty.classList.add("hidden");
      els.mapEmpty.setAttribute("aria-hidden", "true");
      els.mapSvg.classList.add("hidden");
      els.mapLeaflet.classList.add("hidden");
    }
  }

  function applyTheme() {
    const t = theme();
    
    // 同步自訂配色面板狀態
    if (state.theme === "custom" && els.customThemePanel) {
      els.customThemePanel.classList.remove("hidden");
      const ct = state.customTheme;
      if (els.cpMapBg) els.cpMapBg.value = ct.mapBg;
      if (els.cpMapLand) els.cpMapLand.value = ct.mapLand;
      if (els.cpMapLandStroke) els.cpMapLandStroke.value = ct.mapLandStroke;
      if (els.cpMapMarker) els.cpMapMarker.value = ct.mapMarker;
      if (els.cpUiText) els.cpUiText.value = ct.uiText;
      if (els.cpUiBorder) els.cpUiBorder.value = ct.uiBorder;
    } else if (els.customThemePanel) {
      els.customThemePanel.classList.add("hidden");
    }

    const r = document.documentElement;
    r.style.setProperty("--bg", t.ui.bg);
    r.style.setProperty("--panel", t.ui.panel);
    r.style.setProperty("--panel-border", t.ui.border);
    r.style.setProperty("--gold", t.ui.accent);
    r.style.setProperty("--gold-bright", t.map.marker);
    r.style.setProperty("--text", t.ui.text);
    r.style.setProperty("--text-dim", t.ui.textDim);
    r.style.setProperty("--map-outer-bg", t.map.bg);
    r.style.setProperty("--map-inner-bg", t.map.bg);
    r.style.setProperty("--map-frame-border", t.map.landStrokeHi || t.map.landStroke);
    els.themeSwatch.innerHTML = t.swatch.map(function (c) {
      return "<span style=\"background:" + c + "\"></span>";
    }).join("");
    if (isVectorMode() && svg) renderMap();
    if (!isVectorMode() && leafletMap) {
      renderLeafletMarkers();
      renderCompass();
      renderAirplane();
      renderTitleBlock();
    }
  }

  function haversineKm(lon1, lat1, lon2, lat2) {
    const r = 6371;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dphi = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function inferCountry(lon, lat, address) {
    const addr = address || "";
    const rules = [
      ["台灣", "TW"], ["臺", "TW"], ["日本", "JP"], ["Japan", "JP"],
      ["韓國", "KR"], ["韩国", "KR"], ["Korea", "KR"], ["新加坡", "SG"],
      ["Singapore", "SG"], ["越南", "VN"], ["Vietnam", "VN"], ["泰国", "TH"],
      ["Thailand", "TH"], ["中国", "CN"], ["China", "CN"], ["意大利", "IT"],
      ["Italy", "IT"], ["比利时", "BE"], ["Belgium", "BE"], ["英国", "GB"],
      ["United Kingdom", "GB"], ["德国", "DE"], ["Germany", "DE"],
      ["荷兰", "NL"], ["Netherlands", "NL"], ["马来西亚", "MY"], ["Malaysia", "MY"],
    ];
    for (const [kw, code] of rules) {
      if (addr.includes(kw)) return code;
    }
    if (lon >= 119 && lon <= 122.5 && lat >= 21.5 && lat <= 25.5) return "TW";
    if (lon >= 128 && lon <= 146 && lat >= 30 && lat <= 46) return "JP";
    if (lon >= 124 && lon <= 132 && lat >= 33 && lat <= 39) return "KR";
    if (lon >= 103 && lon <= 104.5 && lat >= 1 && lat <= 1.5) return "SG";
    return "??";
  }

  function pickLabel(names, country, lon, lat) {
    const cities = CITY_MAP[country];
    if (cities) {
      let best = null;
      let bestD = 1e9;
      for (const [clon, clat, city] of cities) {
        const d = haversineKm(lon, lat, clon, clat);
        if (d < bestD) { bestD = d; best = city; }
      }
      if (best && bestD < 120) return best;
    }
    if (names.length) {
      const sorted = names.slice().sort(function (a, b) { return a.length - b.length; });
      for (const n of sorted) {
        if (n.length >= 2 && n.length <= 12) return n.slice(0, 10);
      }
      return sorted[0].slice(0, 12);
    }
    return COUNTRY_ZH[country] || country;
  }

  function clusterCellDeg(country, count) {
    if (country === "JP" || country === "KR") return count > 40 ? 0.18 : 0.28;
    if (country === "TW") return 0.22;
    if (["SG", "VN", "CN", "TH", "MY"].includes(country)) return 0.35;
    if (["IT", "BE", "GB", "DE", "NL"].includes(country)) return 0.55;
    return 0.8;
  }

  function parseGeoJSON(data) {
    if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      throw new Error("這不是 Google 已儲存地點的 GeoJSON 格式");
    }
    const points = [];
    for (const feat of data.features) {
      const coords = feat.geometry && feat.geometry.coordinates;
      if (!coords || coords.length < 2) continue;
      const lon = coords[0];
      const lat = coords[1];
      if (Math.abs(lon) < 0.001 && Math.abs(lat) < 0.001) continue;
      const props = feat.properties || {};
      const loc = props.location || {};
      points.push({
        lon: lon, lat: lat,
        country: loc.country_code || inferCountry(lon, lat, loc.address || ""),
        name: loc.name || "", address: loc.address || "",
      });
    }
    if (!points.length) throw new Error("檔案裡沒有有效的地點座標");
    return points;
  }

  function clusterPoints(points) {
    const byCountry = {};
    for (const p of points) {
      if (!byCountry[p.country]) byCountry[p.country] = [];
      byCountry[p.country].push(p);
    }
    const clusters = [];
    for (const country of Object.keys(byCountry)) {
      const items = byCountry[country];
      const cell = clusterCellDeg(country, items.length);
      const buckets = {};
      for (const p of items) {
        const key = Math.round(p.lat / cell) * cell + "," + (Math.round(p.lon / cell) * cell);
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(p);
      }
      for (const group of Object.values(buckets)) {
        const lons = group.map(function (g) { return g.lon; });
        const lats = group.map(function (g) { return g.lat; });
        const names = group.map(function (g) { return g.name; }).filter(Boolean);
        const lon = lons.reduce(function (a, b) { return a + b; }, 0) / lons.length;
        const lat = lats.reduce(function (a, b) { return a + b; }, 0) / lats.length;
        clusters.push({
          lon: lon, lat: lat, count: group.length, country: country,
          label: pickLabel(names, country, lon, lat), names: names.slice(0, 5),
        });
      }
    }
    const merged = [];
    const used = new Array(clusters.length).fill(false);
    for (let i = 0; i < clusters.length; i++) {
      if (used[i]) continue;
      const group = [clusters[i]];
      used[i] = true;
      for (let j = i + 1; j < clusters.length; j++) {
        if (used[j] || clusters[i].country !== clusters[j].country) continue;
        if (haversineKm(clusters[i].lon, clusters[i].lat, clusters[j].lon, clusters[j].lat) < 25) {
          group.push(clusters[j]);
          used[j] = true;
        }
      }
      const lons = group.map(function (g) { return g.lon; });
      const lats = group.map(function (g) { return g.lat; });
      const count = group.reduce(function (s, g) { return s + g.count; }, 0);
      const labels = group.map(function (g) { return g.label; });
      const names = group.flatMap(function (g) { return g.names || []; });
      merged.push({
        lon: lons.reduce(function (a, b) { return a + b; }, 0) / lons.length,
        lat: lats.reduce(function (a, b) { return a + b; }, 0) / lats.length,
        count: count, country: group[0].country,
        label: labels.sort(function (a, b) { return b.length - a.length; })[0],
        names: names.slice(0, 5),
      });
    }
    return merged;
  }

  function buildMarkers(points) {
    let list = [];
    if (state.mode === "all") {
      const basePoints = points.map(function (p, idx) {
        return {
          id: "all_" + idx + "_" + p.lon.toFixed(4) + "_" + p.lat.toFixed(4),
          lon: p.lon, lat: p.lat, count: 1, country: p.country,
          label: p.name || COUNTRY_ZH[p.country] || p.country,
          names: p.name ? [p.name] : [],
          isManual: false
        };
      });
      const manuals = state.manualPoints.map(function (p, idx) {
        return {
          id: "manual_" + idx + "_" + p.lon.toFixed(4) + "_" + p.lat.toFixed(4),
          lon: p.lon, lat: p.lat, count: 1, country: p.country,
          label: p.name || COUNTRY_ZH[p.country] || p.country,
          names: p.name ? [p.name] : [],
          isManual: true
        };
      });
      list = basePoints.concat(manuals);
    } else {
      const clustered = clusterPoints(points).map(function (c, idx) {
        return {
          id: "cluster_" + idx + "_" + c.country + "_" + c.label,
          lon: c.lon, lat: c.lat, count: c.count, country: c.country,
          label: c.label, names: c.names,
          isManual: false
        };
      });
      const manuals = state.manualPoints.map(function (p, idx) {
        return {
          id: "manual_" + idx + "_" + p.lon.toFixed(4) + "_" + p.lat.toFixed(4),
          lon: p.lon, lat: p.lat, count: 1, country: p.country,
          label: p.name || COUNTRY_ZH[p.country] || p.country,
          names: p.name ? [p.name] : [],
          isManual: true
        };
      });
      list = clustered.concat(manuals);
    }
    
    list.forEach(function (m) {
      const j = state.journal[m.id];
      if (j && j.customName) {
        m.label = j.customName;
      }
    });
    
    return list;
  }

  function getProjection() {
    const extent = [[32, 32], [width - 32, height - 32]];
    const sphere = { type: "Sphere" };
    if (state.projection === "mercator") return d3.geoMercator().fitExtent(extent, sphere);
    if (typeof d3.geoRobinson === "function") return d3.geoRobinson().fitExtent(extent, sphere);
    return d3.geoNaturalEarth1().fitExtent(extent, sphere);
  }

  function markerBaseRadius(count) {
    let base;
    if (state.mode === "all") base = 4;
    else if (count >= 20) base = 12;
    else if (count >= 8) base = 9;
    else if (count >= 3) base = 7;
    else base = 5.5;
    return base * state.markerScale;
  }

  function markerGroupRadius(count, k) {
    return markerBaseRadius(count) * Math.pow(k, 0.55) / k;
  }

  function landStrokeWidth(k) {
    const m = theme().map;
    if (m.poster) return m.coastWidth || 1.35;
    return Math.max(0.45, 1.15 / k);
  }

  function isPosterTheme() {
    return !!(theme().poster);
  }

  function computeMapMetrics() {
    if (!path) return;
    const b = path.bounds({ type: "Sphere" });
    mapMetrics.bounds = b;
    mapMetrics.w = Math.max(1, b[1][0] - b[0][0]);
    mapMetrics.h = Math.max(1, b[1][1] - b[0][1]);
  }

  /** 限制平移，讓地圖邊界不跑出視窗（修正日本等偏側區域放大後被推出畫面） */
  function constrainTransform(t) {
    const k = t.k;
    const b = mapMetrics.bounds;
    if (!b || !width || !height) return t;
    let minTx = VIEW_PAD - k * b[0][0];
    let maxTx = (width - VIEW_PAD) - k * b[1][0];
    let minTy = VIEW_PAD - k * b[0][1];
    let maxTy = (height - VIEW_PAD) - k * b[1][1];
    let x = t.x;
    let y = t.y;
    if (minTx > maxTx) x = Math.max(maxTx, Math.min(minTx, t.x));
    else x = Math.max(minTx, Math.min(maxTx, t.x));
    if (minTy > maxTy) y = Math.max(maxTy, Math.min(minTy, t.y));
    else y = Math.max(minTy, Math.min(maxTy, t.y));
    return d3.zoomIdentity.translate(x, y).scale(k);
  }

  function syncZoomTransform(c) {
    if (!svg) return;
    const cur = d3.zoomTransform(svg.node());
    if (Math.abs(cur.x - c.x) > 0.01 || Math.abs(cur.y - c.y) > 0.01 || Math.abs(cur.k - c.k) > 0.0001) {
      skipZoomEnd = true;
      zoom.transform(svg, c);
    }
  }

  /** 以投影座標為中心放大；若超出邊界則自動略降倍率 */
  function centerOnProjectedPoint(px, py, desiredK) {
    desiredK = Math.max(1, Math.min(12, desiredK));
    let k = desiredK;
    const margin = 44;
    for (let i = 0; i < 28; i++) {
      const t = d3.zoomIdentity.translate(width / 2 - k * px, height / 2 - k * py).scale(k);
      const c = constrainTransform(t);
      const sx = c.k * px + c.x;
      const sy = c.k * py + c.y;
      if (sx >= margin && sx <= width - margin && sy >= margin && sy <= height - margin) return c;
      k *= 0.9;
      if (k < 1.02) return constrainTransform(d3.zoomIdentity);
    }
    return constrainTransform(d3.zoomIdentity);
  }

  function applyVectorTransform(t, updateLand) {
    hideMarkerPopup();
    const c = constrainTransform(t);
    state.zoomK = c.k;
    gRoot.attr("transform", c);
    updateMarkerZoom(c.k);
    if (updateLand) {
      updateLandStrokes(c.k);
      refreshLabels(c.k);
    }
    return c;
  }

  function scheduleZoomUpdate(t) {
    pendingZoom = t;
    if (zoomRaf) return;
    zoomRaf = requestAnimationFrame(function () {
      zoomRaf = 0;
      if (pendingZoom) {
        const c = applyVectorTransform(pendingZoom, false);
        syncZoomTransform(c);
      }
      pendingZoom = null;
    });
  }

  function syncZoomEnd(t) {
    const c = constrainTransform(t);
    applyVectorTransform(c, true);
    syncZoomTransform(c);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function tooltipHtml(d) {
    const country = COUNTRY_ZH[d.country] || d.country;
    let html = "<strong>" + escapeHtml(d.label) + "</strong>";
    html += country + " · " + d.count + " 處";
    if (d.names && d.names.length) {
      html += "<br>" + d.names.slice(0, 3).map(escapeHtml).join("、");
      if (d.count > 3) html += "…";
    }
    return html;
  }

  function showTooltip(event, d) {
    els.mapTooltip.innerHTML = tooltipHtml(d);
    els.mapTooltip.classList.remove("hidden");
    moveTooltip(event);
  }

  function moveTooltip(event) {
    els.mapTooltip.style.left = (event.clientX + 14) + "px";
    els.mapTooltip.style.top = (event.clientY + 14) + "px";
  }

  function hideTooltip() { els.mapTooltip.classList.add("hidden"); }

  function updateSummary() {
    const countries = {};
    for (const p of state.points) countries[p.country] = (countries[p.country] || 0) + 1;
    const countryKeys = Object.keys(countries).filter(function (c) { return c !== "??"; })
      .sort(function (a, b) { return countries[b] - countries[a]; });
    const nums = els.summaryStats.querySelectorAll(".stat-num");
    nums[0].textContent = state.points.length;
    nums[1].textContent = countryKeys.length;
    nums[2].textContent = state.markers.length;
    if (!countryKeys.length) {
      els.countryList.className = "country-list empty-hint";
      els.countryList.innerHTML = "載入資料後會列出各國足跡";
      return;
    }
    els.countryList.className = "country-list";
    els.countryList.innerHTML = countryKeys.map(function (code) {
      const name = COUNTRY_ZH[code] || code;
      return "<li data-country=\"" + code + "\"><span>" + name + "</span><span class=\"count\">" + countries[code] + " 處</span></li>";
    }).join("");
    els.countryList.querySelectorAll("li").forEach(function (li) {
      li.addEventListener("click", function () { zoomToCountry(li.dataset.country); });
    });
  }

  function countryBounds(code) {
    const pts = state.points.filter(function (p) { return p.country === code; });
    if (!pts.length) return null;
    const lons = pts.map(function (p) { return p.lon; });
    const lats = pts.map(function (p) { return p.lat; });
    return {
      cx: (Math.min.apply(null, lons) + Math.max.apply(null, lons)) / 2,
      cy: (Math.min.apply(null, lats) + Math.max.apply(null, lats)) / 2,
      minLon: Math.min.apply(null, lons), maxLon: Math.max.apply(null, lons),
      minLat: Math.min.apply(null, lats), maxLat: Math.max.apply(null, lats),
    };
  }

  function zoomToCountry(code) {
    const b = countryBounds(code);
    if (!b) return;
    if (isVectorMode() && svg && projection) {
      const p0 = projection([b.minLon, b.minLat]);
      const p1 = projection([b.maxLon, b.maxLat]);
      if (!p0 || !p1) return;
      const x0 = Math.min(p0[0], p1[0]);
      const x1 = Math.max(p0[0], p1[0]);
      const y0 = Math.min(p0[1], p1[1]);
      const y1 = Math.max(p0[1], p1[1]);
      const dx = Math.max(1, x1 - x0);
      const dy = Math.max(1, y1 - y0);
      const pad = code === "TW" || code === "SG" ? 0.72 : code === "JP" || code === "KR" ? 0.78 : 0.85;
      const k = Math.min(12, pad / Math.max(dx / width, dy / height));
      const x = (width - k * (x0 + x1)) / 2;
      const y = (height - k * (y0 + y1)) / 2;
      const target = constrainTransform(d3.zoomIdentity.translate(x, y).scale(k));
      svg.transition().duration(650).call(zoom.transform, target);
    } else if (leafletMap) {
      leafletMap.fitBounds([[b.minLat, b.minLon], [b.maxLat, b.maxLon]], { padding: [40, 40], maxZoom: 10 });
    }
  }

  function renderMarkers() {
    if (!gMarkers) return;
    const k = state.zoomK;
    const sel = gMarkers.selectAll("g.marker").data(state.markers, function (d) { return d.id; });
    sel.exit().remove();
    const enter = sel.enter().append("g").attr("class", "marker");
    
    enter.merge(sel).attr("transform", function (d) {
      const p = projection([d.lon, d.lat]);
      return p ? "translate(" + p[0] + "," + p[1] + ")" : "translate(0,0)";
    });
    updateMarkerZoom(k);
    refreshLabels(k);
  }

  let tempJournalRating = 0;
  let tempJournalPhoto = null;

  function showMarkerPopup(event, d, element) {
    state.activeMarkerId = d.id;
    
    els.popupViewMode.classList.remove("hidden");
    els.popupEditMode.classList.add("hidden");
    
    const country = COUNTRY_ZH[d.country] || d.country;
    const j = state.journal[d.id] || {};
    
    let html = "<strong>" + escapeHtml(d.label) + "</strong>";
    html += "<div class='popup-meta'>" + country + " · " + d.count + " 處足跡</div>";
    if (d.names && d.names.length && d.label !== d.names[0]) {
      html += "<div class='popup-places'>" + d.names.slice(0, 3).map(escapeHtml).join("、") + "</div>";
    }
    els.popupContent.innerHTML = html;

    // 拍立得照片渲染展示
    if (j.photo) {
      els.popupPhotoContainer.innerHTML = "<div class='polaroid-photo'><img src='" + j.photo + "' alt='旅行相片'></div>";
      els.popupPhotoContainer.classList.remove("hidden");
    } else {
      els.popupPhotoContainer.innerHTML = "";
      els.popupPhotoContainer.classList.add("hidden");
    }
    
    let journalHtml = "";
    if (j.date || j.rating || j.note) {
      journalHtml += "<div class='journal-date-row'>";
      if (j.date) journalHtml += "<span>📅 " + j.date + "</span>";
      if (j.rating) {
        journalHtml += "<span style='color:var(--gold); font-size: 0.85rem;'>";
        for (let i = 0; i < j.rating; i++) journalHtml += "★";
        journalHtml += "</span>";
      }
      journalHtml += "</div>";
      if (j.note) {
        journalHtml += "<div class='journal-note-content'>" + escapeHtml(j.note).replace(/\n/g, "<br>") + "</div>";
      }
    } else {
      journalHtml += "<div style='color:var(--text-dim); text-align:center; font-style:italic; font-size:0.75rem; padding: 4px 0;'>📝 還沒有寫下旅行手記，點擊編輯記錄回憶！</div>";
    }
    els.popupJournalDisplay.innerHTML = journalHtml;
    
    const currentType = state.customMarkerTypes[d.id] || state.defaultMarkerType;
    els.mapPopup.querySelectorAll(".popup-btn").forEach(function (btn) {
      const active = btn.dataset.type === currentType;
      btn.classList.toggle("active", active);
    });
    
    if (d.isManual) {
      els.btnDeleteLocation.classList.remove("hidden");
    } else {
      els.btnDeleteLocation.classList.add("hidden");
    }
    
    els.journalNameInput.value = j.customName || "";
    els.journalDateInput.value = j.date || "";
    els.journalNoteInput.value = j.note || "";
    
    tempJournalRating = j.rating || 0;
    tempJournalPhoto = j.photo || null;
    
    if (els.journalPhotoUrlInput) {
      if (tempJournalPhoto && (tempJournalPhoto.startsWith("http://") || tempJournalPhoto.startsWith("https://"))) {
        els.journalPhotoUrlInput.value = tempJournalPhoto;
      } else {
        els.journalPhotoUrlInput.value = "";
      }
    }
    
    updateStarRatingUI(tempJournalRating);
    updatePhotoEditUI(tempJournalPhoto);
    
    let x, y;
    if (isVectorMode() && svg && projection) {
      const p = projection([d.lon, d.lat]);
      const node = svg.node();
      if (p && node) {
        const cur = d3.zoomTransform(node);
        x = cur.k * p[0] + cur.x;
        y = cur.k * p[1] + cur.y;
      }
    } else if (leafletMap) {
      const latlng = L.latLng(d.lat, d.lon);
      const containerPoint = leafletMap.latLngToContainerPoint(latlng);
      x = containerPoint.x;
      y = containerPoint.y;
    }
    
    if (x !== undefined && y !== undefined) {
      els.mapPopup.style.left = x + "px";
      els.mapPopup.style.top = y + "px";
      els.mapPopup.classList.remove("hidden");
    }
  }

  function updatePhotoEditUI(photoBase64) {
    if (photoBase64) {
      els.popupPhotoEditPreview.innerHTML = "<img src='" + photoBase64 + "' alt='相片預覽'>";
      els.popupPhotoEditPreview.classList.remove("hidden");
      els.popupPhotoEditPlaceholder.classList.add("hidden");
      els.btnRemovePhoto.classList.remove("hidden");
    } else {
      els.popupPhotoEditPreview.innerHTML = "";
      els.popupPhotoEditPreview.classList.add("hidden");
      els.popupPhotoEditPlaceholder.classList.remove("hidden");
      els.btnRemovePhoto.classList.add("hidden");
    }
  }

  function updateStarRatingUI(rating) {
    els.popupEditMode.querySelectorAll(".star-btn").forEach(function (btn) {
      const star = parseInt(btn.dataset.star);
      btn.classList.toggle("active", star <= rating);
      btn.style.color = star <= rating ? "var(--gold)" : "#666";
    });
  }

  function hideMarkerPopup() {
    state.activeMarkerId = null;
    if (els.mapPopup) els.mapPopup.classList.add("hidden");
  }

  function updateJournalSidebar() {
    if (!els.journalList) return;
    
    const keys = Object.keys(state.journal).filter(function (key) {
      const j = state.journal[key];
      return j && (j.customName || j.date || j.rating || j.note);
    });
    
    if (!keys.length) {
      els.journalList.className = "country-list empty-hint";
      els.journalList.innerHTML = "載入或手動記錄後，會列出已填寫日記的足跡";
      return;
    }
    
    els.journalList.className = "country-list";
    els.journalList.innerHTML = keys.map(function (key) {
      const j = state.journal[key];
      let title = j.customName || "";
      if (!title) {
        if (key.startsWith("cluster_")) {
          title = key.split("_")[3] || "聚類足跡";
        } else if (key.startsWith("all_")) {
          const found = state.markers.find(function(m) { return m.id === key; });
          title = found ? found.label : "未知足跡";
        } else if (key.startsWith("manual_")) {
          const found = state.markers.find(function(m) { return m.id === key; });
          title = found ? found.label : "手動足跡";
        } else {
          title = "旅行足跡";
        }
      }
      
      const dateStr = j.date ? j.date : "";
      const ratingStr = j.rating ? "★".repeat(j.rating) : "";
      const desc = j.note ? j.note : "";
      
      return "<li class='journal-item' data-marker-id='" + key + "'>" +
             "<div class='journal-title-row'>" +
               "<span class='journal-title'>" + escapeHtml(title) + "</span>" +
               "<span class='journal-date'>" + dateStr + "</span>" +
             "</div>" +
             "<div class='journal-title-row' style='font-size:0.72rem; color:var(--gold); margin-top:2px; margin-bottom:2px;'>" +
               "<span>" + ratingStr + "</span>" +
             "</div>" +
             "<div class='journal-desc'>" + escapeHtml(desc) + "</div>" +
             "</li>";
    }).join("");
    
    els.journalList.querySelectorAll("li.journal-item").forEach(function (li) {
      li.addEventListener("click", function () {
        const markerId = li.dataset.markerId;
        const marker = state.markers.find(function (m) { return m.id === markerId; });
        if (!marker) return;
        
        if (isVectorMode() && svg && projection) {
          const p = projection([marker.lon, marker.lat]);
          if (p) {
            const target = centerOnProjectedPoint(p[0], p[1], 5);
            svg.transition().duration(750).call(zoom.transform, target)
              .on("end", function() {
                const event = { clientX: els.mapFrame.clientWidth / 2, clientY: els.mapFrame.clientHeight / 2 };
                showMarkerPopup(event, marker, null);
              });
          }
        } else if (leafletMap) {
          leafletMap.setView([marker.lat, marker.lon], 11, { animate: true, duration: 0.75 });
          leafletMap.once("moveend", function() {
            const event = { clientX: els.mapFrame.clientWidth / 2, clientY: els.mapFrame.clientHeight / 2 };
            showMarkerPopup(event, marker, null);
          });
        }
      });
    });
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem("travelFootprintPoints", JSON.stringify(state.points));
      localStorage.setItem("travelFootprintManualPoints", JSON.stringify(state.manualPoints));
      localStorage.setItem("travelFootprintCustomMarkers", JSON.stringify(state.customMarkerTypes));
      localStorage.setItem("travelFootprintJournal", JSON.stringify(state.journal));
      localStorage.setItem("travelFootprintCustomTheme", JSON.stringify(state.customTheme));
      localStorage.setItem("travelFootprintSettings", JSON.stringify({
        theme: state.theme,
        mode: state.mode,
        projection: state.projection,
        baseMap: state.baseMap,
        markerScale: state.markerScale,
        defaultMarkerType: state.defaultMarkerType,
        customTitle: state.customTitle,
        customSubtitle: state.customSubtitle,
        customSignature: state.customSignature,
        showCompass: state.showCompass,
        showAirplane: state.showAirplane,
        sourceName: state.sourceName
      }));
    } catch (e) {
      console.error("無法寫入 LocalStorage", e);
    }
  }

  async function loadFromLocalStorage() {
    try {
      const pointsStr = localStorage.getItem("travelFootprintPoints");
      const manualPointsStr = localStorage.getItem("travelFootprintManualPoints");
      
      const points = pointsStr ? JSON.parse(pointsStr) : [];
      const manualPoints = manualPointsStr ? JSON.parse(manualPointsStr) : [];
      
      if ((!points || !points.length) && (!manualPoints || !manualPoints.length)) {
        return false;
      }
      
      state.points = points;
      state.manualPoints = manualPoints;
      state.sourceName = "上次的足跡資料";
      
      const customMarkersStr = localStorage.getItem("travelFootprintCustomMarkers");
      if (customMarkersStr) {
        state.customMarkerTypes = JSON.parse(customMarkersStr);
      }

      const journalStr = localStorage.getItem("travelFootprintJournal");
      if (journalStr) {
        state.journal = JSON.parse(journalStr);
      }

      const customThemeStr = localStorage.getItem("travelFootprintCustomTheme");
      if (customThemeStr) {
        try {
          state.customTheme = JSON.parse(customThemeStr);
        } catch (e) {}
      }
      
      const settingsStr = localStorage.getItem("travelFootprintSettings");
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        state.theme = settings.theme || state.theme;
        state.mode = settings.mode || state.mode;
        state.projection = settings.projection || state.projection;
        state.baseMap = settings.baseMap || state.baseMap;
        state.markerScale = settings.markerScale !== undefined ? settings.markerScale : state.markerScale;
        state.defaultMarkerType = settings.defaultMarkerType || state.defaultMarkerType;
        state.customTitle = settings.customTitle || "";
        state.customSubtitle = settings.customSubtitle || "";
        state.customSignature = settings.customSignature || "";
        state.showCompass = settings.showCompass !== undefined ? settings.showCompass : true;
        state.showAirplane = settings.showAirplane !== undefined ? settings.showAirplane : true;
        state.sourceName = settings.sourceName || state.sourceName;
        
        els.themeSelect.value = state.theme;
        els.baseMapSelect.value = state.baseMap;
        els.markerSize.value = state.markerScale;
        els.markerSizeVal.textContent = state.markerScale.toFixed(2) + "×";
        els.defaultMarkerSelect.value = state.defaultMarkerType;
        
        els.customTitleInput.value = state.customTitle;
        els.customSubtitleInput.value = state.customSubtitle;
        els.customSignatureInput.value = state.customSignature;
        
        els.showCompass.checked = state.showCompass;
        els.showAirplane.checked = state.showAirplane;
        
        setSegmented(els.modeCluster.parentElement, state.mode === "cluster" ? els.modeCluster : els.modeAll);
        syncProjectionUi();
      }
      
      state.markers = buildMarkers(state.points);
      if (isVectorMode()) await loadLandGeo();
      
      els.mapEmpty.classList.add("hidden");
      els.mapEmpty.setAttribute("aria-hidden", "true");
      els.btnResetView.disabled = false;
      
      updateExportUi();
      updatePresetUi(detectPresetId());
      await renderActiveMap();
      updateSummary();
      updateJournalSidebar();
      setStatus(buildStatusLine());
      return true;
    } catch (err) {
      console.error("載入快取失敗", err);
      return false;
    }
  }

  function exportBackup() {
    if ((!state.points || !state.points.length) && (!state.manualPoints || !state.manualPoints.length)) {
      toast("沒有足跡資料可供備份", "error");
      return;
    }
    const backupData = {
      version: "v8.0",
      points: state.points,
      manualPoints: state.manualPoints,
      journal: state.journal,
      customMarkerTypes: state.customMarkerTypes,
      customTheme: state.customTheme,
      settings: {
        theme: state.theme,
        mode: state.mode,
        projection: state.projection,
        baseMap: state.baseMap,
        markerScale: state.markerScale,
        defaultMarkerType: state.defaultMarkerType,
        customTitle: state.customTitle,
        customSubtitle: state.customSubtitle,
        customSignature: state.customSignature,
        showCompass: state.showCompass,
        showAirplane: state.showAirplane,
        sourceName: state.sourceName
      }
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "旅遊足跡配置備份_" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    toast("備份已下載", "success");
  }

  function readBackupFile(file) {
    const reader = new FileReader();
    reader.onload = async function () {
      try {
        const backup = JSON.parse(reader.result);
        if ((!backup.points || !Array.isArray(backup.points)) && (!backup.manualPoints || !Array.isArray(backup.manualPoints))) {
          throw new Error("備份檔案缺少有效的足跡資料");
        }
        setLoading(true);
        state.points = backup.points || [];
        state.manualPoints = backup.manualPoints || [];
        state.journal = backup.journal || {};
        state.customMarkerTypes = backup.customMarkerTypes || {};
        state.customTheme = backup.customTheme || state.customTheme;
        
        const settings = backup.settings || {};
        state.theme = settings.theme || state.theme;
        state.mode = settings.mode || state.mode;
        state.projection = settings.projection || state.projection;
        state.baseMap = settings.baseMap || state.baseMap;
        state.markerScale = settings.markerScale !== undefined ? settings.markerScale : state.markerScale;
        state.defaultMarkerType = settings.defaultMarkerType || state.defaultMarkerType;
        state.customTitle = settings.customTitle || "";
        state.customSubtitle = settings.customSubtitle || "";
        state.customSignature = settings.customSignature || "";
        state.showCompass = settings.showCompass !== undefined ? settings.showCompass : true;
        state.showAirplane = settings.showAirplane !== undefined ? settings.showAirplane : true;
        state.sourceName = settings.sourceName || "匯入的備份";
        
        els.themeSelect.value = state.theme;
        els.baseMapSelect.value = state.baseMap;
        els.markerSize.value = state.markerScale;
        els.markerSizeVal.textContent = state.markerScale.toFixed(2) + "×";
        els.defaultMarkerSelect.value = state.defaultMarkerType;
        
        els.customTitleInput.value = state.customTitle;
        els.customSubtitleInput.value = state.customSubtitle;
        els.customSignatureInput.value = state.customSignature;
        
        els.showCompass.checked = state.showCompass;
        els.showAirplane.checked = state.showAirplane;
        
        setSegmented(els.modeCluster.parentElement, state.mode === "cluster" ? els.modeCluster : els.modeAll);
        syncProjectionUi();
        
        state.markers = buildMarkers(state.points);
        if (isVectorMode()) await loadLandGeo();
        
        els.mapEmpty.classList.add("hidden");
        els.mapEmpty.setAttribute("aria-hidden", "true");
        els.btnResetView.disabled = false;
        
        updateExportUi();
        updatePresetUi(detectPresetId());
        await renderActiveMap();
        updateSummary();
        updateJournalSidebar();
        setStatus(buildStatusLine());
        saveToLocalStorage();
        toast("備份已完美還原", "success");
      } catch (err) {
        toast("載入備份失敗：" + err.message, "error");
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = function () { toast("讀取備份檔案失敗", "error"); };
    reader.readAsText(file, "UTF-8");
  }

  function renderCompass() {
    if (!gCompass) return;
    gCompass.selectAll("*").remove();
    if (!state.showCompass) return;
    
    const t = theme().map;
    const ui = theme().ui;
    const cx = width - 85;
    const cy = height - 90;
    const cr = 28;
    
    gCompass.append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", cr)
      .attr("fill", "none")
      .attr("stroke", t.edge)
      .attr("stroke-width", 1.1)
      .attr("opacity", 0.75);
      
    gCompass.append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", cr - 5)
      .attr("fill", "none")
      .attr("stroke", t.edge)
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "1.5,1.5")
      .attr("opacity", 0.5);
      
    gCompass.append("line")
      .attr("x1", cx).attr("y1", cy - cr + 2)
      .attr("x2", cx).attr("y2", cy + cr - 2)
      .attr("stroke", t.edge).attr("stroke-width", 0.5).attr("opacity", 0.4);
    gCompass.append("line")
      .attr("x1", cx - cr + 2).attr("y1", cy)
      .attr("x2", cx + cr - 2).attr("y2", cy)
      .attr("stroke", t.edge).attr("stroke-width", 0.5).attr("opacity", 0.4);
      
    gCompass.append("path")
      .attr("d", "M " + cx + "," + cy + " L " + (cx - 3.5) + "," + cy + " L " + cx + "," + (cy - cr + 6) + " Z")
      .attr("fill", t.marker);
    gCompass.append("path")
      .attr("d", "M " + cx + "," + cy + " L " + (cx + 3.5) + "," + cy + " L " + cx + "," + (cy - cr + 6) + " Z")
      .attr("fill", t.marker).attr("opacity", 0.85);
      
    gCompass.append("path")
      .attr("d", "M " + cx + "," + cy + " L " + (cx - 3.5) + "," + cy + " L " + cx + "," + (cy + cr - 6) + " Z")
      .attr("fill", t.edge).attr("opacity", 0.6);
    gCompass.append("path")
      .attr("d", "M " + cx + "," + cy + " L " + (cx + 3.5) + "," + cy + " L " + cx + "," + (cy + cr - 6) + " Z")
      .attr("fill", t.edge).attr("opacity", 0.45);
      
    gCompass.append("text")
      .attr("x", cx)
      .attr("y", cy - cr - 4)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", ui.accent || t.marker)
      .attr("font-size", "9px")
      .attr("font-family", "Georgia, serif")
      .attr("font-weight", "bold")
      .text("N");
  }

  function renderAirplane() {
    if (!gDecoration) return;
    gDecoration.selectAll("*").remove();
    if (!state.showAirplane) return;
    
    const t = theme().map;
    const pathData = "M 50,130 Q 150,70 250,95";
    
    gDecoration.append("path")
      .attr("d", pathData)
      .attr("fill", "none")
      .attr("stroke", t.edge)
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", 0.4);
      
    gDecoration.append("g")
      .attr("transform", "translate(250,95) rotate(15) scale(1.15)")
      .append("path")
      .attr("d", "M 0,-10 L 1.5,-4 L 11,-1 L 11,1.5 L 1.5,1 L 1,7 L 4,9.5 L 4,11 L 0,10 L -4,11 L -4,9.5 L -1,7 L -1.5,1 L -11,1.5 L -11,-1 L -1.5,-4 Z")
      .attr("fill", t.edge)
      .attr("opacity", 0.7);
  }

  function renderTitleBlock() {
    if (!gTitleBlock) return;
    gTitleBlock.selectAll("*").remove();
    
    const t = theme().map;
    const ui = theme().ui;
    
    gTitleBlock.append("text")
      .attr("x", width / 2)
      .attr("y", height - 60)
      .attr("text-anchor", "middle")
      .attr("fill", ui.accent || t.marker)
      .attr("font-size", "13px")
      .attr("font-family", "'Times New Roman', Georgia, serif")
      .attr("letter-spacing", "4px")
      .attr("opacity", 0.85)
      .text(state.customSubtitle || "LET'S START THE JOURNEY");
      
    let mainTitleText = state.customTitle || "旅遊足跡  Travel Footprint";
    if (state.customSignature) {
      mainTitleText = state.customSignature + " · " + mainTitleText;
    }

    gTitleBlock.append("text")
      .attr("x", width / 2)
      .attr("y", height - 30)
      .attr("text-anchor", "middle")
      .attr("fill", t.label)
      .attr("font-size", "21px")
      .attr("font-family", "Microsoft JhengHei, sans-serif")
      .attr("font-weight", "light")
      .attr("letter-spacing", "2px")
      .text(mainTitleText);
  }

  function updateMarkerZoom(k) {
    if (!gMarkers) return;
    const t = theme().map;
    gMarkers.selectAll("g.marker").each(function (d) {
      const g = d3.select(this);
      const type = state.customMarkerTypes[d.id] || state.defaultMarkerType;
      const r = markerGroupRadius(d.count, k);
      
      const renderedType = g.attr("data-rendered-type");
      if (renderedType !== type) {
        g.selectAll("*").remove();
        g.attr("data-rendered-type", type);
        
        if (type === "glow") {
          g.append("circle").attr("class", "marker-glow");
          g.append("circle").attr("class", "marker-core")
            .on("mouseenter", showTooltip)
            .on("mousemove", moveTooltip)
            .on("mouseleave", hideTooltip)
            .on("click", function(event) {
              event.stopPropagation();
              showMarkerPopup(event, d, this);
            });
        } else if (type === "flag") {
          g.append("path").attr("class", "marker-flag-pole");
          g.append("path").attr("class", "marker-flag-body")
            .on("mouseenter", showTooltip)
            .on("mousemove", moveTooltip)
            .on("mouseleave", hideTooltip)
            .on("click", function(event) {
              event.stopPropagation();
              showMarkerPopup(event, d, this);
            });
        } else if (type === "pin") {
          g.append("circle").attr("class", "marker-glow");
          g.append("path").attr("class", "marker-pin-body");
          g.append("circle").attr("class", "marker-pin-hole")
            .on("mouseenter", showTooltip)
            .on("mousemove", moveTooltip)
            .on("mouseleave", hideTooltip)
            .on("click", function(event) {
              event.stopPropagation();
              showMarkerPopup(event, d, this);
            });
        }
      }
      
      if (type === "glow") {
        g.select(".marker-glow")
          .attr("r", r * (isPosterTheme() ? 1.6 : 2.4))
          .attr("fill", t.glow)
          .attr("opacity", isPosterTheme() ? 0.18 : 0.28);
        g.select(".marker-core")
          .attr("r", r)
          .attr("fill", t.marker)
          .attr("stroke", t.edge)
          .attr("stroke-width", Math.max(0.4, 1 / k))
          .style("cursor", "pointer");
      } else if (type === "flag") {
        const poleH = r * 2.2;
        const flagW = r * 1.3;
        g.select(".marker-flag-pole")
          .attr("d", "M 0,0 L 0," + (-poleH))
          .attr("stroke", t.edge)
          .attr("stroke-width", Math.max(1, r / 5))
          .attr("stroke-linecap", "round");
        g.select(".marker-flag-body")
          .attr("d", "M 0," + (-poleH) + " L " + flagW + "," + (-poleH + poleH*0.25) + " L 0," + (-poleH + poleH*0.5) + " Z")
          .attr("fill", t.marker)
          .attr("stroke", t.edge)
          .attr("stroke-width", Math.max(0.4, 1 / k))
          .style("cursor", "pointer");
      } else if (type === "pin") {
        const pinH = r * 2.8;
        const headR = r * 1.1;
        const centerY = -pinH + headR;
        g.select(".marker-glow")
          .attr("r", headR * 1.8)
          .attr("cx", 0)
          .attr("cy", centerY)
          .attr("fill", t.glow)
          .attr("opacity", 0.15);
        g.select(".marker-pin-body")
          .attr("d", "M 0,0 C " + (-r*0.7) + "," + (-r*0.7) + " " + (-r*1.1) + "," + (-r*1.5) + " " + (-r*1.1) + "," + centerY + 
                     " A " + headR + "," + headR + " 0 1,1 " + (r*1.1) + "," + centerY + 
                     " C " + (r*1.1) + "," + (-r*1.5) + " " + (r*0.7) + "," + (-r*0.7) + " 0,0 Z")
          .attr("fill", t.marker)
          .attr("stroke", t.edge)
          .attr("stroke-width", Math.max(0.4, 1 / k))
          .style("cursor", "pointer")
          .on("mouseenter", showTooltip)
          .on("mousemove", moveTooltip)
          .on("mouseleave", hideTooltip)
          .on("click", function(event) {
            event.stopPropagation();
            showMarkerPopup(event, d, this);
          });
        g.select(".marker-pin-hole")
          .attr("cx", 0)
          .attr("cy", centerY)
          .attr("r", r * 0.35)
          .attr("fill", t.edge)
          .style("cursor", "pointer");
      }
    });
  }

  function refreshLabels(k) {
    if (!gLabels) return;
    const t = theme().map;
    const showLabels = state.mode === "cluster" && k >= 1.15;
    const labelData = showLabels ? state.markers.filter(function (d) { return d.count >= 4; }).slice(0, 28) : [];
    const lsel = gLabels.selectAll("text").data(labelData, function (d) { return d.label + d.lon; });
    lsel.exit().remove();
    lsel.enter().append("text").merge(lsel)
      .attr("x", function (d) { const p = projection([d.lon, d.lat]); return p ? p[0] : 0; })
      .attr("y", function (d) { const p = projection([d.lon, d.lat]); return p ? p[1] - markerGroupRadius(d.count, k) - 5 : 0; })
      .attr("text-anchor", "middle").attr("fill", t.label)
      .attr("font-size", Math.max(8, 12 * Math.pow(k, 0.2)) / k)
      .attr("font-family", "Microsoft JhengHei, sans-serif")
      .attr("paint-order", "stroke").attr("stroke", t.labelStroke)
      .attr("stroke-width", 3.5 / k)
      .text(function (d) { return d.label; });
  }

  function updateLandStrokes(k) {
    if (!gMap) return;
    const t = theme().map;
    gMap.selectAll("path.land")
      .attr("stroke-width", landStrokeWidth(k))
      .attr("stroke", t.landStroke);
  }

  function renderMap() {
    if (!state.landGeo || !svg) return;
    projection = getProjection();
    path = d3.geoPath(projection);
    const t = theme().map;
    const k = state.zoomK;

    if (gOcean) {
      gOcean.selectAll("path.sphere").data([{ type: "Sphere" }]).join("path")
        .attr("class", "sphere")
        .attr("d", path)
        .attr("fill", t.bg)
        .attr("stroke", "none");
    }

    gMap.selectAll("path.land").data(state.landGeo.features).join("path")
      .attr("class", "land").attr("d", path)
      .attr("fill", t.land).attr("stroke", t.landStroke)
      .attr("stroke-width", landStrokeWidth(k))
      .attr("vector-effect", "non-scaling-stroke")
      .attr("stroke-linejoin", "round");

    renderMarkers();
    renderCompass();
    renderAirplane();
    renderTitleBlock();
    computeMapMetrics();
  }

  function initSvg() {
    width = els.mapFrame.clientWidth || 800;
    height = els.mapFrame.clientHeight || 500;
    svg = d3.select(els.mapSvg);
    svg.selectAll("*").remove();
    svg.attr("viewBox", "0 0 " + width + " " + height);
    gRoot = svg.append("g");
    gOcean = gRoot.append("g").attr("class", "ocean-layer");
    gMap = gRoot.append("g").attr("class", "map-layer");
    gMarkers = gRoot.append("g").attr("class", "marker-layer");
    gLabels = gRoot.append("g").attr("class", "label-layer");
    
    gCompass = svg.append("g").attr("class", "compass-layer");
    gDecoration = svg.append("g").attr("class", "decoration-layer");
    gTitleBlock = svg.append("g").attr("class", "title-block-layer");
    
    zoom = d3.zoom()
      .scaleExtent([1, 12])
      .on("zoom", function (event) {
        scheduleZoomUpdate(event.transform);
      })
      .on("end", function (event) {
        if (skipZoomEnd) { skipZoomEnd = false; return; }
        syncZoomEnd(event.transform);
      });
    svg.call(zoom).on("dblclick.zoom", null);
    
    svg.on("dblclick", function (event) {
      event.preventDefault();
      if (event.target.closest(".marker") || event.target.closest(".map-popup")) return;
      if (!projection) return;
      const coords = d3.pointer(event, gRoot.node());
      const lonlat = projection.invert(coords);
      if (lonlat) {
        const lon = lonlat[0];
        const lat = lonlat[1];
        if (Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
          openManualAddFormWithCoords(lat, lon);
        }
      }
    });
  }

  function resetVectorView() {
    if (!svg) return;
    skipZoomEnd = true;
    const id = d3.zoomIdentity;
    state.zoomK = 1;
    zoom.transform(svg, id);
    applyVectorTransform(id, true);
  }

  function loadGoogleScript(key) {
    return new Promise(function (resolve, reject) {
      if (window.google && window.google.maps) { resolve(); return; }
      const existing = document.getElementById("googleMapsScript");
      if (existing) {
        existing.addEventListener("load", function () { resolve(); });
        existing.addEventListener("error", function () { reject(new Error("Google 地圖腳本載入失敗")); });
        return;
      }
      const s = document.createElement("script");
      s.id = "googleMapsScript";
      s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key);
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Google 地圖腳本載入失敗，請檢查金鑰")); };
      document.head.appendChild(s);
    });
  }

  function googleMutantLayer(type) {
    if (!window.google || !window.google.maps) throw new Error("Google 地圖尚未載入");
    const mapTypeId = type === "satellite" ? google.maps.MapTypeId.SATELLITE : google.maps.MapTypeId.ROADMAP;
    return L.gridLayer.googleMutant({ type: mapTypeId, maxZoom: 21 });
  }

  async function ensureGoogleMutant() {
    if (L.gridLayer.googleMutant) return;
    await new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet.gridlayer.googlemutant@0.14.1/dist/Leaflet.GoogleMutant.js";
      s.onload = resolve;
      s.onerror = function () { reject(new Error("無法載入 Google 底圖外掛")); };
      document.head.appendChild(s);
    });
  }

  async function buildTileLayer() {
    if (isGoogleBase()) {
      if (!state.googleApiKey) throw new Error("請先在「Google 地圖 API 金鑰」貼上並儲存金鑰");
      await loadGoogleScript(state.googleApiKey);
      await ensureGoogleMutant();
      const type = state.baseMap === "google-satellite" ? "satellite" : "roadmap";
      return googleMutantLayer(type);
    }
    const cfg = TILE_LAYERS[state.baseMap];
    if (!cfg) throw new Error("不支援的底圖類型");
    return L.tileLayer(cfg.url, cfg.opts);
  }

  function createLeafletIcon(d, zoom) {
    const t = theme().map;
    const type = state.customMarkerTypes[d.id] || state.defaultMarkerType;
    const baseR = markerBaseRadius(d.count);
    const zFactor = Math.pow(1.12, Math.max(0, zoom - 2));
    const r = baseR * zFactor;
    
    let iconHtml = "";
    let iconSize = [0, 0];
    let iconAnchor = [0, 0];
    
    if (type === "glow") {
      const glowR = r * (isPosterTheme() ? 1.6 : 2.4);
      const w = glowR * 2 + 4;
      const h = w;
      iconSize = [w, h];
      iconAnchor = [w / 2, h / 2];
      iconHtml = "<svg width='" + w + "' height='" + h + "' viewBox='0 0 " + w + " " + h + "' style='display:block; overflow:visible;'>" +
                 "<circle cx='" + (w/2) + "' cy='" + (h/2) + "' r='" + glowR + "' fill='" + t.glow + "' opacity='" + (isPosterTheme() ? 0.18 : 0.28) + "' />" +
                 "<circle cx='" + (w/2) + "' cy='" + (h/2) + "' r='" + r + "' fill='" + t.marker + "' stroke='" + t.edge + "' stroke-width='1.2' />" +
                 "</svg>";
    } else if (type === "flag") {
      const poleH = r * 2.2;
      const flagW = r * 1.3;
      const w = flagW * 2 + 4;
      const h = poleH + 4;
      const cx = w / 2;
      const cy = h - 2;
      
      iconSize = [w, h];
      iconAnchor = [cx, cy];
      iconHtml = "<svg width='" + w + "' height='" + h + "' viewBox='0 0 " + w + " " + h + "' style='display:block; overflow:visible;'>" +
                 "<path d='M " + cx + "," + cy + " L " + cx + "," + (cy - poleH) + "' stroke='" + t.edge + "' stroke-width='" + Math.max(1, r / 5) + "' stroke-linecap='round' />" +
                 "<path d='M " + cx + "," + (cy - poleH) + " L " + (cx + flagW) + "," + (cy - poleH + poleH*0.25) + " L " + cx + "," + (cy - poleH + poleH*0.5) + " Z' fill='" + t.marker + "' stroke='" + t.edge + "' stroke-width='1' />" +
                 "</svg>";
    } else if (type === "pin") {
      const pinH = r * 2.8;
      const headR = r * 1.1;
      const glowR = headR * 1.8;
      const w = glowR * 2 + 4;
      const h = pinH + headR + 4;
      const cx = w / 2;
      const cy = h - headR - 2;
      const centerY = cy - pinH + headR;
      
      iconSize = [w, h];
      iconAnchor = [cx, cy];
      iconHtml = "<svg width='" + w + "' height='" + h + "' viewBox='0 0 " + w + " " + h + "' style='display:block; overflow:visible;'>" +
                 "<circle cx='" + cx + "' cy='" + centerY + "' r='" + glowR + "' fill='" + t.glow + "' opacity='0.15' />" +
                 "<path d='M " + cx + "," + cy + 
                           " C " + (cx - r*0.7) + "," + (cy - r*0.7) + " " + (cx - r*1.1) + "," + (cy - r*1.5) + " " + (cx - r*1.1) + "," + centerY + 
                           " A " + headR + "," + headR + " 0 1,1 " + (cx + r*1.1) + "," + centerY + 
                           " C " + (cx + r*1.1) + "," + (cy - r*1.5) + " " + (cx + r*0.7) + "," + (cy - r*0.7) + " " + cx + "," + cy + " Z' " +
                       "fill='" + t.marker + "' stroke='" + t.edge + "' stroke-width='1' />" +
                 "<circle cx='" + cx + "' cy='" + centerY + "' r='" + (r * 0.35) + "' fill='" + t.edge + "' />" +
                 "</svg>";
    }
    
    return L.divIcon({
      html: iconHtml,
      className: "custom-div-icon",
      iconSize: iconSize,
      iconAnchor: iconAnchor,
      popupAnchor: [0, -iconAnchor[1] * 0.85]
    });
  }

  function buildLeafletPopupHtml(d) {
    const country = COUNTRY_ZH[d.country] || d.country;
    const currentType = state.customMarkerTypes[d.id] || state.defaultMarkerType;
    
    let html = "<div class='popup-content'>";
    html += "<strong>" + escapeHtml(d.label) + "</strong>";
    html += "<div class='popup-meta'>" + country + " · " + d.count + " 處足跡</div>";
    if (d.names && d.names.length) {
      html += "<div class='popup-places'>" + d.names.map(escapeHtml).join("、") + "</div>";
    }
    html += "</div>";
    
    html += "<div class='popup-actions'>";
    html += "<span class='popup-action-label'>更換標記：</span>";
    html += "<div class='popup-btn-group'>";
    html += "<button class='popup-btn" + (currentType === "glow" ? " active" : "") + "' data-type='glow' title='光點'>🟢</button>";
    html += "<button class='popup-btn" + (currentType === "flag" ? " active" : "") + "' data-type='flag' title='旗子'>🚩</button>";
    html += "<button class='popup-btn" + (currentType === "pin" ? " active" : "") + "' data-type='pin' title='圖釘'>📌</button>";
    html += "</div>";
    html += "</div>";
    
    return html;
  }

  function renderLeafletMarkers() {
    if (!leafletMap) return;
    leafletMarkers.forEach(function (m) { leafletMap.removeLayer(m); });
    leafletMarkers = [];
    const z = leafletMap.getZoom();
    state.markers.forEach(function (d) {
      const icon = createLeafletIcon(d, z);
      const marker = L.marker([d.lat, d.lon], { icon: icon });
      marker.addTo(leafletMap);
      
      marker.on("click", function (event) {
        L.DomEvent.stopPropagation(event);
        showMarkerPopup(event, d, this);
      });
      
      leafletMarkers.push(marker);
    });
  }

  async function initLeaflet() {
    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
      leafletLayer = null;
      leafletMarkers = [];
    }
    els.mapLeaflet.classList.remove("hidden");
    els.mapLeaflet.setAttribute("aria-hidden", "false");
    leafletMap = L.map(els.mapLeaflet, {
      zoomControl: true,
      attributionControl: true,
      maxBounds: [[-58, -160], [72, 160]],
      maxBoundsViscosity: 0.85,
    }).setView([25, 121], 3);
    leafletLayer = await buildTileLayer();
    leafletLayer.addTo(leafletMap);
    leafletMap.on("zoomend", renderLeafletMarkers);
    leafletMap.on("movestart zoomstart dragstart click", function () {
      hideMarkerPopup();
    });
    leafletMap.on("contextmenu", function (e) {
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;
      openManualAddFormWithCoords(lat, lon);
    });
    renderLeafletMarkers();
    setTimeout(function () { leafletMap.invalidateSize(); }, 120);
  }

  function showVectorMap() {
    els.mapSvg.classList.remove("hidden");
    els.mapSvg.classList.add("vector-active");
    
    if (gOcean) gOcean.style("display", null);
    if (gMap) gMap.style("display", null);
    if (gMarkers) gMarkers.style("display", null);
    if (gLabels) gLabels.style("display", null);
    
    els.mapLeaflet.classList.add("hidden");
    els.mapLeaflet.setAttribute("aria-hidden", "true");
    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
      leafletLayer = null;
      leafletMarkers = [];
    }
  }

  function showTileMap() {
    els.mapSvg.classList.remove("hidden");
    els.mapSvg.classList.remove("vector-active");
    
    if (gOcean) gOcean.style("display", "none");
    if (gMap) gMap.style("display", "none");
    if (gMarkers) gMarkers.style("display", "none");
    if (gLabels) gLabels.style("display", "none");
    
    renderCompass();
    renderAirplane();
    renderTitleBlock();
  }

  function updateExportUi() {
    const vector = isVectorMode();
    const hasData = state.points.length > 0;
    els.btnExport.disabled = !hasData;
    if (!hasData) {
      els.btnExport.textContent = "匯出 PNG";
      if (els.exportHint) els.exportHint.textContent = "";
      return;
    }
    if (vector) {
      els.btnExport.textContent = "匯出 PNG";
      els.btnExport.title = "下載目前向量地圖";
      if (els.exportHint) els.exportHint.textContent = "裝飾海報模式可直接下載";
    } else {
      els.btnExport.textContent = "如何存圖？";
      els.btnExport.title = "圖磚底圖請用系統截圖";
      if (els.exportHint) els.exportHint.textContent = "圖磚模式：Win+Shift+S 截圖";
    }
  }

  function updateHelpUi() {
    if (!els.helpList) return;
    if (isVectorMode()) {
      els.helpList.innerHTML =
        "<li>滾輪：放大／縮小（以滑鼠位置為中心）</li>" +
        "<li>拖曳：移動地圖</li>" +
        (isPosterTheme()
          ? "<li>海報模式：陸海對比高，放大後海岸線不會變淡</li>"
          : "<li>放大後：海岸線會變細</li>") +
        "<li>點右側國家：跳到該區</li>";
    } else {
      els.helpList.innerHTML =
        "<li>滾輪或 +/-：放大／縮小</li>" +
        "<li>拖曳：移動地圖</li>" +
        "<li>點右側國家：跳到該區</li>" +
        "<li>存圖：Win+Shift+S 或瀏覽器截圖</li>";
    }
  }

  function updateProjectionControls() {
    const tile = !isVectorMode();
    els.projRobinson.disabled = tile;
    els.projMercator.disabled = tile;
    if (els.projGroup) els.projGroup.classList.toggle("hidden", tile);
    if (tile) {
      state.projection = "mercator";
      setSegmented(els.projRobinson.parentElement, els.projMercator);
      if (els.baseMapHint) els.baseMapHint.textContent = "網路圖磚可看清街道、衛星或 Google 地圖。";
    } else if (els.baseMapHint) {
      els.baseMapHint.textContent = "進階自訂用；一般請用上方「一鍵風格」即可。";
    }
    updateExportUi();
    updateHelpUi();
  }

  async function renderActiveMap() {
    updateProjectionControls();
    applyTheme();
    if (isVectorMode()) {
      if (!svg) initSvg();
      showVectorMap();
      renderMap();
      resetVectorView();
    } else {
      showTileMap();
      await initLeaflet();
    }
  }

  function resetView() {
    if (isVectorMode()) resetVectorView();
    else if (leafletMap) leafletMap.setView([25, 121], 3);
  }

  function openManualAddFormWithCoords(lat, lon) {
    els.manualAddForm.classList.remove("hidden");
    els.manualLocLat.value = lat.toFixed(4);
    els.manualLocLon.value = lon.toFixed(4);
    els.manualLocName.value = "";
    els.manualAddForm.scrollIntoView({ behavior: "smooth" });
    els.manualLocName.focus();
    toast("已在點擊處取得經緯度，請輸入地點名稱", "success");
  }

  function parseExifGps(arrayBuffer) {
    try {
      const dataView = new DataView(arrayBuffer);
      if (dataView.byteLength < 8) return null;
      if (dataView.getUint16(0, false) !== 0xFFD8) return null;
      let offset = 2;
      const length = dataView.byteLength;
      let app1Offset = null;
      while (offset < length - 1) {
        const marker = dataView.getUint16(offset, false);
        if (marker === 0xFFE1) {
          app1Offset = offset;
          break;
        }
        const sectionLength = dataView.getUint16(offset + 2, false);
        offset += 2 + sectionLength;
      }
      if (app1Offset === null) return null;
      let exifHeaderOffset = app1Offset + 4;
      if (dataView.getUint32(exifHeaderOffset, false) !== 0x45786966) return null;
      let tiffOffset = exifHeaderOffset + 6;
      const byteOrder = dataView.getUint16(tiffOffset, false);
      const isLittleEndian = byteOrder === 0x4949;
      if (byteOrder !== 0x4949 && byteOrder !== 0x4D4D) return null;
      if (dataView.getUint16(tiffOffset + 2, isLittleEndian) !== 0x002A) return null;
      let firstIfdOffset = dataView.getUint32(tiffOffset + 4, isLittleEndian);
      if (firstIfdOffset < 8) return null;
      let gpsIfdOffset = null;
      let dirOffset = tiffOffset + firstIfdOffset;
      if (dirOffset + 2 > length) return null;
      const numEntries = dataView.getUint16(dirOffset, isLittleEndian);
      dirOffset += 2;
      for (let i = 0; i < numEntries; i++) {
        const tag = dataView.getUint16(dirOffset, isLittleEndian);
        if (tag === 0x8825) {
          gpsIfdOffset = dataView.getUint32(dirOffset + 8, isLittleEndian);
          break;
        }
        dirOffset += 12;
      }
      if (gpsIfdOffset === null) return null;
      let gpsDirOffset = tiffOffset + gpsIfdOffset;
      if (gpsDirOffset + 2 > length) return null;
      const numGpsEntries = dataView.getUint16(gpsDirOffset, isLittleEndian);
      gpsDirOffset += 2;
      let latRef = null, lonRef = null;
      let latVal = null, lonVal = null;
      function readRational(valOffset) {
        const num = dataView.getUint32(tiffOffset + valOffset, isLittleEndian);
        const den = dataView.getUint32(tiffOffset + valOffset + 4, isLittleEndian);
        return den === 0 ? 0 : num / den;
      }
      for (let i = 0; i < numGpsEntries; i++) {
        const tag = dataView.getUint16(gpsDirOffset, isLittleEndian);
        if (tag === 1) {
          latRef = String.fromCharCode(dataView.getUint8(gpsDirOffset + 8));
        } else if (tag === 2) {
          const valOffset = dataView.getUint32(gpsDirOffset + 8, isLittleEndian);
          const d = readRational(valOffset);
          const m = readRational(valOffset + 8);
          const s = readRational(valOffset + 16);
          latVal = d + m/60 + s/3600;
        } else if (tag === 3) {
          lonRef = String.fromCharCode(dataView.getUint8(gpsDirOffset + 8));
        } else if (tag === 4) {
          const valOffset = dataView.getUint32(gpsDirOffset + 8, isLittleEndian);
          const d = readRational(valOffset);
          const m = readRational(valOffset + 8);
          const s = readRational(valOffset + 16);
          lonVal = d + m/60 + s/3600;
        }
        gpsDirOffset += 12;
      }
      if (latVal !== null && lonVal !== null) {
        if (latRef === 'S') latVal = -latVal;
        if (lonRef === 'W') lonVal = -lonVal;
        return { lat: latVal, lon: lonVal };
      }
      return null;
    } catch (e) {
      console.warn("EXIF GPS 解析失敗，已安全忽略並回退為無 GPS 模式:", e);
      return null;
    }
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          const canvas = document.createElement("canvas");
          let w = img.width;
          let h = img.height;
          const maxDim = 600;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round(h * maxDim / w);
              w = maxDim;
            } else {
              w = Math.round(w * maxDim / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL("image/jpeg", 0.75);
          resolve(base64);
        };
        img.onerror = function () {
          reject(new Error("照片檔案載入失敗"));
        };
        img.src = e.target.result;
      };
      reader.onerror = function () {
        reject(new Error("照片檔案讀取失敗"));
      };
      reader.readAsDataURL(file);
    });
  }

  async function loadLandGeo() {
    if (state.landGeo) return state.landGeo;
    let res = await fetch("assets/ne_110m_land.geojson");
    if (!res.ok) res = await fetch("assets/ne_50m_land.geojson");
    if (!res.ok) throw new Error("無法載入世界地圖底圖，請用「開啟.bat」啟動本工具");
    const data = await res.json();
    
    // 過濾掉南極洲 (最大緯度小於 -60 度的陸地特徵)
    if (data && Array.isArray(data.features)) {
      data.features = data.features.filter(function (f) {
        let maxLat = -90;
        const extract = function (coords) {
          if (typeof coords[0] === "number") {
            if (coords[1] > maxLat) maxLat = coords[1];
          } else {
            coords.forEach(extract);
          }
        };
        if (f.geometry && f.geometry.coordinates) {
          extract(f.geometry.coordinates);
        }
        return maxLat >= -60;
      });
    }
    
    state.landGeo = data;
    return state.landGeo;
  }

  async function applyData(data, sourceName) {
    setLoading(true);
    setStatus("正在處理 " + sourceName + "…");
    try {
      hideMarkerPopup();
      state.points = parseGeoJSON(data);
      state.markers = buildMarkers(state.points);
      state.sourceName = sourceName;
      if (isVectorMode()) await loadLandGeo();
      els.mapEmpty.classList.add("hidden");
      els.mapEmpty.setAttribute("aria-hidden", "true");
      els.btnResetView.disabled = false;
      updateExportUi();
      await renderActiveMap();
      updateSummary();
      updateJournalSidebar();
      saveToLocalStorage();
      setStatus(buildStatusLine());
      toast("地圖已更新", "success");
    } catch (err) {
      console.error("applyData error stack:", err.stack || err.message);
      setStatus("載入失敗：" + err.message);
      toast(err.message, "error");
      els.mapEmpty.classList.remove("hidden");
      els.mapEmpty.setAttribute("aria-hidden", "false");
      els.mapSvg.classList.add("hidden");
      els.mapLeaflet.classList.add("hidden");
    } finally {
      setLoading(false);
    }
  }

  function buildStatusLine() {
    const proj = isVectorMode() ? (state.projection === "robinson" ? "羅賓森" : "麥卡托") : "麥卡托圖磚";
    const mode = state.mode === "cluster" ? "重點城市" : "全部足跡";
    const base = els.baseMapSelect.options[els.baseMapSelect.selectedIndex].text.split("（")[0];
    return "已載入 " + state.sourceName + " · " + state.points.length + " 處 · " + base + " · " + proj + " · " + mode;
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try { applyData(JSON.parse(reader.result), file.name); }
      catch (err) { toast("無法讀取 JSON：" + err.message, "error"); }
    };
    reader.onerror = function () { toast("讀取檔案失敗", "error"); };
    reader.readAsText(file, "UTF-8");
  }

  function exportPng() {
    if (!isVectorMode()) {
      toast("圖磚底圖請用瀏覽器截圖；向量模式可匯出 PNG", "error");
      return;
    }
    if (!svg) return;
    els.btnExport.disabled = true;
    setStatus("正在匯出 PNG…");
    const t = theme().map;
    const clone = els.mapSvg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = t.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (b) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = "旅遊足跡_" + new Date().toISOString().slice(0, 10) + ".png";
        a.click();
        els.btnExport.disabled = false;
        setStatus("已匯出 PNG");
        toast("PNG 已下載", "success");
      }, "image/png");
    };
    img.onerror = function () {
      els.btnExport.disabled = false;
      toast("匯出失敗，請再試一次", "error");
    };
    img.src = url;
  }

  function setSegmented(group, activeBtn) {
    group.querySelectorAll(".segmented-btn").forEach(function (btn) {
      const on = btn === activeBtn;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncProjectionUi() {
    if (state.projection === "robinson") {
      setSegmented(els.projRobinson.parentElement, els.projRobinson);
    } else {
      setSegmented(els.projMercator.parentElement, els.projMercator);
    }
  }

  function detectPresetId() {
    if (state.baseMap === "vector" && state.projection === "robinson") return "poster";
    if (state.baseMap === "carto-voyager") return "street-voyager";
    if (state.baseMap === "osm") return "street-osm";
    if (state.baseMap === "esri-satellite") return "satellite";
    return null;
  }

  function updatePresetUi(presetId) {
    state.activePreset = presetId;
    els.presetButtons.forEach(function (btn) {
      const on = btn.dataset.preset === presetId;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (presetId && PRESETS[presetId]) {
      els.presetHint.textContent = PRESETS[presetId].hint;
    } else {
      els.presetHint.textContent = "目前為自訂組合；也可點上方一鍵風格快速套用";
    }
  }

  async function applyPreset(presetId) {
    const preset = PRESETS[presetId];
    if (!preset) return;
    state.baseMap = preset.baseMap;
    state.projection = preset.projection;
    if (preset.theme) {
      state.theme = preset.theme;
      els.themeSelect.value = preset.theme;
    }
    els.baseMapSelect.value = preset.baseMap;
    syncProjectionUi();
    updatePresetUi(presetId);
    applyTheme();
    if (state.points.length) {
      try {
        setLoading(true);
        await renderActiveMap();
        setStatus(buildStatusLine());
      } finally {
        setLoading(false);
      }
    }
    toast(preset.toast, "success");
  }

  function bindEvents() {
    els.fileInput.addEventListener("change", function () {
      const file = els.fileInput.files[0];
      if (file) readFile(file);
      els.fileInput.value = "";
    });

    if (els.btnSample) {
      els.btnSample.addEventListener("click", async function () {
        setLoading(true);
        try {
          const res = await fetch("data/saved-places.json");
          if (!res.ok) throw new Error("找不到內建範例資料");
          await applyData(await res.json(), "內建範例");
        } catch (err) {
          setLoading(false);
          toast(err.message, "error");
        }
      });
    }

    els.baseMapSelect.addEventListener("change", async function () {
      state.baseMap = els.baseMapSelect.value;
      updatePresetUi(detectPresetId());
      if (state.points.length) {
        try {
          setLoading(true);
          await renderActiveMap();
          setStatus(buildStatusLine());
          toast("底圖已切換", "success");
        } catch (err) {
          toast(err.message, "error");
          state.baseMap = "vector";
          els.baseMapSelect.value = "vector";
          await renderActiveMap();
        } finally {
          setLoading(false);
        }
      }
    });

    els.themeSelect.addEventListener("change", function () {
      state.theme = els.themeSelect.value;
      applyTheme();
      if (state.points.length) setStatus(buildStatusLine());
      toast("已套用「" + theme().name + "」配色", "success");
    });

    // 監聽自訂配色選擇器
    const cpIds = ["cpMapBg", "cpMapLand", "cpMapLandStroke", "cpMapMarker", "cpUiText", "cpUiBorder"];
    cpIds.forEach(function (id) {
      const el = els[id];
      if (el) {
        el.addEventListener("input", function () {
          const prop = id.slice(2);
          const stateProp = prop.charAt(0).toLowerCase() + prop.slice(1);
          state.customTheme[stateProp] = el.value;
          applyTheme();
          saveToLocalStorage();
        });
      }
    });

    els.modeCluster.addEventListener("click", function () {
      if (state.mode === "cluster") return;
      state.mode = "cluster";
      setSegmented(els.modeCluster.parentElement, els.modeCluster);
      if (state.points.length) {
        state.markers = buildMarkers(state.points);
        if (isVectorMode()) renderMap(); else renderLeafletMarkers();
        updateSummary();
      }
    });

    els.modeAll.addEventListener("click", function () {
      if (state.mode === "all") return;
      state.mode = "all";
      setSegmented(els.modeAll.parentElement, els.modeAll);
      if (state.points.length) {
        state.markers = buildMarkers(state.points);
        if (isVectorMode()) renderMap(); else renderLeafletMarkers();
        updateSummary();
      }
    });

    els.projRobinson.addEventListener("click", function () {
      if (!isVectorMode() || state.projection === "robinson") return;
      state.projection = "robinson";
      setSegmented(els.projRobinson.parentElement, els.projRobinson);
      updatePresetUi(detectPresetId());
      if (state.points.length) { renderMap(); setStatus(buildStatusLine()); }
    });

    els.projMercator.addEventListener("click", function () {
      if (!isVectorMode() || state.projection === "mercator") return;
      state.projection = "mercator";
      setSegmented(els.projMercator.parentElement, els.projMercator);
      updatePresetUi(detectPresetId());
      if (state.points.length) { renderMap(); setStatus(buildStatusLine()); }
    });

    els.markerSize.addEventListener("input", function () {
      state.markerScale = parseFloat(els.markerSize.value);
      els.markerSizeVal.textContent = state.markerScale.toFixed(2) + "×";
      if (state.points.length) {
        if (isVectorMode()) renderMarkers(); else renderLeafletMarkers();
      }
      saveToLocalStorage();
    });

    els.defaultMarkerSelect.addEventListener("change", function () {
      state.defaultMarkerType = els.defaultMarkerSelect.value;
      if (state.points.length) {
        if (isVectorMode()) renderMarkers(); else renderLeafletMarkers();
      }
      toast("已切換預設標記圖示", "success");
      saveToLocalStorage();
    });

    els.btnPopupClose.addEventListener("click", hideMarkerPopup);

    // 編輯相片點擊上傳
    els.popupPhotoEditZone.addEventListener("click", function () {
      els.journalPhotoInput.click();
    });

    els.journalPhotoInput.addEventListener("change", async function (e) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const base64 = await compressImage(file);
        tempJournalPhoto = base64;
        updatePhotoEditUI(tempJournalPhoto);
        toast("照片已成功上傳", "success");
      } catch (err) {
        toast("照片讀取失敗：" + err.message, "error");
      }
      els.journalPhotoInput.value = "";
    });

    // 編輯相片拖放上傳
    els.popupPhotoEditZone.addEventListener("dragover", function (e) {
      e.preventDefault();
      els.popupPhotoEditZone.style.borderColor = "var(--gold)";
      els.popupPhotoEditZone.style.background = "rgba(212, 181, 106, 0.1)";
    });

    els.popupPhotoEditZone.addEventListener("dragleave", function (e) {
      e.preventDefault();
      els.popupPhotoEditZone.style.borderColor = "var(--gold-dim)";
      els.popupPhotoEditZone.style.background = "rgba(0,0,0,0.18)";
    });

    els.popupPhotoEditZone.addEventListener("drop", async function (e) {
      e.preventDefault();
      els.popupPhotoEditZone.style.borderColor = "var(--gold-dim)";
      els.popupPhotoEditZone.style.background = "rgba(0,0,0,0.18)";
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast("請拖放圖片檔案 (JPEG/PNG)", "error");
        return;
      }
      try {
        const base64 = await compressImage(file);
        tempJournalPhoto = base64;
        updatePhotoEditUI(tempJournalPhoto);
        toast("相片已成功匯入", "success");
      } catch (err) {
        toast("相片載入失敗：" + err.message, "error");
      }
    });

    // 移除相片
    els.btnRemovePhoto.addEventListener("click", function (e) {
      e.stopPropagation(); // 阻止觸發 popupPhotoEditZone 的 click
      tempJournalPhoto = null;
      if (els.journalPhotoUrlInput) els.journalPhotoUrlInput.value = "";
      updatePhotoEditUI(null);
      toast("已清除照片", "success");
    });

    if (els.journalPhotoUrlInput) {
      els.journalPhotoUrlInput.addEventListener("input", function () {
        const url = els.journalPhotoUrlInput.value.trim();
        if (url) {
          tempJournalPhoto = url;
          updatePhotoEditUI(url);
        } else {
          tempJournalPhoto = null;
          updatePhotoEditUI(null);
        }
      });
    }

    // 1. 星星評等按鈕點擊
    els.popupEditMode.querySelectorAll(".star-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        tempJournalRating = parseInt(btn.dataset.star) || 0;
        updateStarRatingUI(tempJournalRating);
      });
    });

    // 2. 編輯手記按鈕
    els.btnEditJournal.addEventListener("click", function () {
      els.popupViewMode.classList.add("hidden");
      els.popupEditMode.classList.remove("hidden");
    });

    // 3. 取消編輯按鈕
    els.btnCancelJournal.addEventListener("click", function () {
      els.popupEditMode.classList.add("hidden");
      els.popupViewMode.classList.remove("hidden");
    });

    // 4. 儲存手記按鈕
    els.btnSaveJournal.addEventListener("click", function () {
      const id = state.activeMarkerId;
      if (!id) return;

      const customName = els.journalNameInput.value.trim();
      const date = els.journalDateInput.value;
      const note = els.journalNoteInput.value.trim();
      const rating = tempJournalRating;
      const photoUrl = els.journalPhotoUrlInput ? els.journalPhotoUrlInput.value.trim() : "";

      let finalPhoto = tempJournalPhoto;
      if (!finalPhoto && photoUrl) {
        finalPhoto = photoUrl;
      } else if (finalPhoto && (finalPhoto.startsWith("http://") || finalPhoto.startsWith("https://"))) {
        finalPhoto = photoUrl || null;
      }

      state.journal[id] = {
        customName: customName,
        date: date,
        note: note,
        rating: rating,
        photo: finalPhoto
      };

      // 重新加載並渲染
      state.markers = buildMarkers(state.points);
      if (isVectorMode()) {
        renderMarkers();
      } else {
        renderLeafletMarkers();
      }

      updateJournalSidebar();
      saveToLocalStorage();

      // 回到檢視模式並刷新檢視文字
      els.popupEditMode.classList.add("hidden");
      els.popupViewMode.classList.remove("hidden");

      const marker = state.markers.find(function (m) { return m.id === id; });
      if (marker) {
        const country = COUNTRY_ZH[marker.country] || marker.country;
        let html = "<strong>" + escapeHtml(marker.label) + "</strong>";
        html += "<div class='popup-meta'>" + country + " · " + marker.count + " 處足跡</div>";
        if (marker.names && marker.names.length && marker.label !== marker.names[0]) {
          html += "<div class='popup-places'>" + marker.names.slice(0, 3).map(escapeHtml).join("、") + "</div>";
        }
        els.popupContent.innerHTML = html;

        if (tempJournalPhoto) {
          els.popupPhotoContainer.innerHTML = "<div class='polaroid-photo'><img src='" + tempJournalPhoto + "' alt='旅行相片'></div>";
          els.popupPhotoContainer.classList.remove("hidden");
        } else {
          els.popupPhotoContainer.innerHTML = "";
          els.popupPhotoContainer.classList.add("hidden");
        }

        let journalHtml = "";
        if (date || rating || note) {
          journalHtml += "<div class='journal-date-row'>";
          if (date) journalHtml += "<span>📅 " + date + "</span>";
          if (rating) {
            journalHtml += "<span style='color:var(--gold); font-size: 0.85rem;'>";
            for (let i = 0; i < rating; i++) journalHtml += "★";
            journalHtml += "</span>";
          }
          journalHtml += "</div>";
          if (note) {
            journalHtml += "<div class='journal-note-content'>" + escapeHtml(note).replace(/\n/g, "<br>") + "</div>";
          }
        } else {
          journalHtml += "<div style='color:var(--text-dim); text-align:center; font-style:italic; font-size:0.75rem; padding: 4px 0;'>📝 還沒有寫下旅行手記，點擊編輯記錄回憶！</div>";
        }
        els.popupJournalDisplay.innerHTML = journalHtml;
      }

      toast("旅行手記已儲存", "success");
    });

    // 5. 刪除手動足跡點按鈕
    els.btnDeleteLocation.addEventListener("click", function () {
      const id = state.activeMarkerId;
      if (!id) return;

      if (id.startsWith("manual_")) {
        const parts = id.split("_");
        if (parts.length >= 4) {
          const idx = parseInt(parts[1]);
          const lon = parseFloat(parts[2]);
          const lat = parseFloat(parts[3]);

          state.manualPoints = state.manualPoints.filter(function (p, pIdx) {
            return !(pIdx === idx && Math.abs(p.lon - lon) < 0.001 && Math.abs(p.lat - lat) < 0.001);
          });
        }

        delete state.journal[id];
        delete state.customMarkerTypes[id];

        state.markers = buildMarkers(state.points);
        if (isVectorMode()) {
          renderMarkers();
        } else {
          renderLeafletMarkers();
        }

        updateJournalSidebar();
        updateSummary();
        saveToLocalStorage();
        hideMarkerPopup();
        toast("已刪除手動足跡點", "success");
      }
    });

    // 6. 點擊「手動新增足跡點」
    els.btnStartManualAdd.addEventListener("click", function () {
      els.manualAddForm.classList.toggle("hidden");
      if (!els.manualAddForm.classList.contains("hidden")) {
        els.manualLocName.focus();
      }
    });

    // 7. 取消手動新增
    els.btnCancelManualAdd.addEventListener("click", function () {
      els.manualAddForm.classList.add("hidden");
      els.manualLocName.value = "";
      els.manualLocLat.value = "";
      els.manualLocLon.value = "";
      if (els.manualLocPhotoUrl) els.manualLocPhotoUrl.value = "";
    });

    // 8. 確定手動新增
    els.btnSubmitManualAdd.addEventListener("click", function () {
      const name = els.manualLocName.value.trim();
      const lat = parseFloat(els.manualLocLat.value);
      const lon = parseFloat(els.manualLocLon.value);
      const photoUrl = els.manualLocPhotoUrl ? els.manualLocPhotoUrl.value.trim() : "";

      if (!name) {
        toast("請輸入地點名稱", "error");
        return;
      }
      if (isNaN(lat) || lat < -90 || lat > 90) {
        toast("請輸入有效的緯度 (-90 ~ 90)", "error");
        return;
      }
      if (isNaN(lon) || lon < -180 || lon > 180) {
        toast("請輸入有效的經度 (-180 ~ 180)", "error");
        return;
      }

      const newPoint = {
        lon: lon,
        lat: lat,
        country: inferCountry(lon, lat),
        name: name,
        address: "",
        isManual: true
      };

      state.manualPoints.push(newPoint);

      const idx = state.manualPoints.length - 1;
      const newId = "manual_" + idx + "_" + lon.toFixed(4) + "_" + lat.toFixed(4);
      state.journal[newId] = {
        customName: name,
        date: new Date().toISOString().slice(0, 10),
        note: photoUrl ? "📸 連結網路相片手動新增足跡。" : "",
        rating: 5,
        photo: photoUrl || null
      };

      state.markers = buildMarkers(state.points);

      if (isVectorMode()) {
        renderMarkers();
      } else {
        renderLeafletMarkers();
      }

      updateJournalSidebar();
      updateSummary();
      saveToLocalStorage();

      els.manualAddForm.classList.add("hidden");
      els.manualLocName.value = "";
      els.manualLocLat.value = "";
      els.manualLocLon.value = "";
      if (els.manualLocPhotoUrl) els.manualLocPhotoUrl.value = "";

      toast("成功新增足跡點！", "success");
    });

    // ⚡ 快讀定位按鈕
    if (els.btnFastReadUrl) {
      els.btnFastReadUrl.addEventListener("click", async function () {
        const url = els.manualLocPhotoUrl.value.trim();
        if (!url) {
          toast("請先輸入相片網址", "error");
          return;
        }

        setLoading(true);
        setStatus("正在從網址讀取相片二進位資料…");

        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error("取得相片失敗，請確認網址是否正確或支援 CORS 跨域");
          const buffer = await response.arrayBuffer();

          setStatus("正在提取相片 EXIF GPS 資訊…");
          const coords = parseExifGps(buffer);
          if (coords) {
            els.manualLocLat.value = coords.lat.toFixed(4);
            els.manualLocLon.value = coords.lon.toFixed(4);
            toast("⚡ 成功解析 EXIF GPS 定位！已為您填入經緯度", "success");
          } else {
            toast("此相片不含 EXIF GPS 定位，但依然可以連結做為手記相片", "warning");
          }
        } catch (err) {
          console.error("快讀網址相片失敗:", err);
          toast("解析失敗，可能因該圖片網站限制跨域(CORS)存取。若無 GPS 亦可直接在網頁上拖放或點擊地圖取點！", "error");
        } finally {
          setLoading(false);
          setStatus("準備好了");
        }
      });
    }

    document.addEventListener("click", function (event) {
      if (els.mapPopup && !els.mapPopup.contains(event.target)) {
        hideMarkerPopup();
      }
    });

    els.mapPopup.querySelectorAll(".popup-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = state.activeMarkerId;
        if (!id) return;
        const newType = btn.dataset.type;
        state.customMarkerTypes[id] = newType;
        
        els.mapPopup.querySelectorAll(".popup-btn").forEach(function (b) {
          b.classList.toggle("active", b.dataset.type === newType);
        });
        
        if (isVectorMode()) {
          renderMarkers();
        }
        saveToLocalStorage();
      });
    });

    // 監聽海報自訂文字
    els.customTitleInput.addEventListener("input", function () {
      state.customTitle = els.customTitleInput.value.trim();
      if (isVectorMode() && svg) {
        renderTitleBlock();
      } else if (!isVectorMode()) {
        renderTitleBlock();
      }
      saveToLocalStorage();
    });

    els.customSubtitleInput.addEventListener("input", function () {
      state.customSubtitle = els.customSubtitleInput.value.trim();
      if (isVectorMode() && svg) {
        renderTitleBlock();
      } else if (!isVectorMode()) {
        renderTitleBlock();
      }
      saveToLocalStorage();
    });

    els.customSignatureInput.addEventListener("input", function () {
      state.customSignature = els.customSignatureInput.value.trim();
      if (isVectorMode() && svg) {
        renderTitleBlock();
      } else if (!isVectorMode()) {
        renderTitleBlock();
      }
      saveToLocalStorage();
    });

    // 監聽羅盤與飛機開關
    els.showCompass.addEventListener("change", function () {
      state.showCompass = els.showCompass.checked;
      if (isVectorMode() && svg) {
        renderCompass();
      } else if (!isVectorMode()) {
        renderCompass();
      }
      saveToLocalStorage();
    });

    els.showAirplane.addEventListener("change", function () {
      state.showAirplane = els.showAirplane.checked;
      if (isVectorMode() && svg) {
        renderAirplane();
      } else if (!isVectorMode()) {
        renderAirplane();
      }
      saveToLocalStorage();
    });

    // 備份配置檔匯出入
    els.btnExportBackup.addEventListener("click", exportBackup);
    els.backupFileInput.addEventListener("change", function () {
      const file = els.backupFileInput.files[0];
      if (file) readBackupFile(file);
      els.backupFileInput.value = "";
    });

    // 統一為所有的 select 與 buttons 多綁定一個監聽器以自動存檔快取
    els.themeSelect.addEventListener("change", saveToLocalStorage);
    els.baseMapSelect.addEventListener("change", saveToLocalStorage);
    els.modeCluster.addEventListener("click", saveToLocalStorage);
    els.modeAll.addEventListener("click", saveToLocalStorage);
    els.projRobinson.addEventListener("click", saveToLocalStorage);
    els.projMercator.addEventListener("click", saveToLocalStorage);
    els.presetButtons.forEach(function (btn) {
      btn.addEventListener("click", saveToLocalStorage);
    });

    els.btnSaveGoogleKey.addEventListener("click", function () {
      const key = els.googleApiKey.value.trim();
      if (!key) { toast("請先貼上 API 金鑰", "error"); return; }
      state.googleApiKey = key;
      localStorage.setItem("travelFootprintGoogleKey", key);
      toast("Google 金鑰已儲存在本機", "success");
    });

    els.btnClearGoogleKey.addEventListener("click", function () {
      state.googleApiKey = "";
      els.googleApiKey.value = "";
      localStorage.removeItem("travelFootprintGoogleKey");
      toast("已清除 Google 金鑰", "success");
    });

    els.btnResetView.addEventListener("click", resetView);
    els.btnExport.addEventListener("click", exportPng);

    // 綁定右側欄分頁切換 (Tabs)
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    tabButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const targetId = btn.getAttribute("data-tab");
        tabButtons.forEach(function (b) {
          b.classList.toggle("active", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        tabContents.forEach(function (content) {
          content.classList.toggle("hidden", content.id !== targetId);
        });
      });
    });

    els.presetButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyPreset(btn.dataset.preset);
      });
    });

    // 監聽地圖全螢幕拖放照片
    const mapPanel = els.mapPanel;
    
    mapPanel.addEventListener("dragenter", function (e) {
      e.preventDefault();
      const files = e.dataTransfer.items;
      if (files && files.length > 0 && files[0].kind === "file") {
        els.dropZoneMask.classList.remove("hidden");
      }
    });

    mapPanel.addEventListener("dragover", function (e) {
      e.preventDefault();
    });

    els.dropZoneMask.addEventListener("dragleave", function (e) {
      e.preventDefault();
      els.dropZoneMask.classList.add("hidden");
    });

    mapPanel.addEventListener("drop", async function (e) {
      e.preventDefault();
      els.dropZoneMask.classList.add("hidden");
      
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const ext = file.name ? file.name.split(".").pop().toLowerCase() : "";
      const isImg = (file.type && file.type.startsWith("image/")) || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
      if (!isImg) {
        toast("請拖放 JPEG 或 PNG 照片檔案", "error");
        return;
      }
      
      setLoading(true);
      setStatus("正在提取相片 EXIF GPS 資訊…");
      
      try {
        const buffer = await file.arrayBuffer();
        let coords = parseExifGps(buffer);
        let hasGps = true;
        
        if (!coords) {
          hasGps = false;
          let dropLon = 121.5, dropLat = 25.0;
          if (isVectorMode() && svg && projection && typeof projection.invert === "function") {
            try {
              const svgRect = els.mapSvg.getBoundingClientRect();
              const mouseX = e.clientX - svgRect.left;
              const mouseY = e.clientY - svgRect.top;
              const node = svg.node();
              if (node) {
                const cur = d3.zoomTransform(node);
                const px = (mouseX - cur.x) / cur.k;
                const py = (mouseY - cur.y) / cur.k;
                const lonlat = projection.invert([px, py]);
                if (lonlat) {
                  dropLon = lonlat[0];
                  dropLat = lonlat[1];
                }
              }
            } catch (err) {
              console.warn("D3 座標反算失敗，採用地圖中心或預設點:", err);
            }
          } else if (leafletMap) {
            try {
              const latlng = leafletMap.mouseEventToLatLng(e);
              if (latlng) {
                dropLon = latlng.lng;
                dropLat = latlng.lat;
              }
            } catch (err) {
              console.warn("Leaflet 座標反算失敗，採用地圖中心點:", err);
              const center = leafletMap.getCenter();
              if (center) {
                dropLon = center.lng;
                dropLat = center.lat;
              }
            }
          }
          coords = { lat: dropLat, lon: dropLon };
        }
        
        const base64 = await compressImage(file);
        const name = file.name.split(".")[0] || "照片足跡點";
        const newPoint = {
          lon: coords.lon,
          lat: coords.lat,
          country: inferCountry(coords.lon, coords.lat),
          name: name,
          address: "",
          isManual: true
        };
        
        state.manualPoints.push(newPoint);
        
        const idx = state.manualPoints.length - 1;
        const newId = "manual_" + idx + "_" + coords.lon.toFixed(4) + "_" + coords.lat.toFixed(4);
        const photoDate = file.lastModified ? new Date(file.lastModified).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        
        state.journal[newId] = {
          customName: name,
          date: photoDate,
          note: hasGps ? "📸 照片拖放匯入，已自動提取 EXIF 相片 GPS 定位。" : "📸 照片拖放匯入。相片不含 GPS 定位，已自動定位於滑鼠拖放位置。",
          rating: 5,
          photo: base64
        };
        
        state.markers = buildMarkers(state.points);
        if (isVectorMode()) {
          renderMarkers();
        } else {
          renderLeafletMarkers();
        }
        
        updateJournalSidebar();
        updateSummary();
        saveToLocalStorage();
        
        const newMarker = state.markers.find(function(m) { return m.id === newId; });
        if (newMarker) {
          if (isVectorMode() && svg && projection) {
            const p = projection([newMarker.lon, newMarker.lat]);
            if (p) {
              const target = centerOnProjectedPoint(p[0], p[1], 5);
              svg.transition().duration(750).call(zoom.transform, target)
                .on("end", function () {
                  const event = { clientX: els.mapFrame.clientWidth / 2, clientY: els.mapFrame.clientHeight / 2 };
                  showMarkerPopup(event, newMarker, null);
                });
            }
          } else if (leafletMap) {
            leafletMap.setView([newMarker.lat, newMarker.lon], 11, { animate: true, duration: 0.75 });
            leafletMap.once("moveend", function () {
              const event = { clientX: els.mapFrame.clientWidth / 2, clientY: els.mapFrame.clientHeight / 2 };
              showMarkerPopup(event, newMarker, null);
            });
          }
        }
        
        if (hasGps) {
          toast("已提取 EXIF GPS 定位並新增足跡點！", "success");
        } else {
          toast("照片不含 GPS，已置於當前中心，請手動命名", "success");
        }
      } catch (err) {
        toast("照片處理失敗：" + err.message, "error");
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    let resizeTimer;
    resizeObserver = new ResizeObserver(function () {
      if (!state.points.length) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(async function () {
        if (isVectorMode()) {
          const w = els.mapFrame.clientWidth;
          const h = els.mapFrame.clientHeight;
          if (w === 0 || h === 0) return;
          
          const saved = svg ? constrainTransform(d3.zoomTransform(svg.node())) : d3.zoomIdentity;
          initSvg();
          renderMap();
          if (saved.k !== 1 || saved.x !== 0 || saved.y !== 0) svg.call(zoom.transform, saved);
        } else if (leafletMap) {
          leafletMap.invalidateSize();
        }
      }, 150);
    });
    resizeObserver.observe(els.mapPanel);
  }

  if (state.googleApiKey) els.googleApiKey.value = state.googleApiKey;
  applyTheme();
  updatePresetUi("poster");
  updateProjectionControls();
  bindEvents();
  
  // 優先加載 LocalStorage 緩存
  (async function () {
    const ok = await loadFromLocalStorage();
    if (!ok) {
      setLoading(true);
      try {
        if (isVectorMode()) await loadLandGeo();
        els.mapEmpty.classList.add("hidden");
        els.mapEmpty.setAttribute("aria-hidden", "true");
        await renderActiveMap();
        setStatus(buildStatusLine());
      } catch (err) {
        console.error("預設地圖載入失敗", err);
        setStatus("載入失敗：" + err.message);
      } finally {
        setLoading(false);
      }
    }
  })();
})();


