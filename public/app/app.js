// Shared helpers for all pages. Plain globals, no modules — load after i18n.js.

// Keep in sync with lib/validate.js.
var CITIES = [
  'taipei', 'new_taipei', 'keelung', 'taoyuan', 'hsinchu', 'miaoli', 'taichung',
  'changhua', 'nantou', 'yunlin', 'chiayi', 'tainan', 'kaohsiung', 'pingtung',
  'yilan', 'hualien', 'taitung', 'penghu', 'kinmen', 'matsu', 'other'
];
var LEVELS = ['any', 'beginner', 'intermediate', 'advanced'];
var GEAR = ['net', 'balls', 'chalk', 'lines', 'cones'];  // keep in sync with lib/validate.js
var TW_CENTER = [23.7, 121.0];

// Community LINE group/OpenChat invite link. Leave empty to hide the LINE button.
var LINE_URL = 'http://line.me/R/ti/g/U4WJff_XbM';

// ---------- DOM / text ----------

function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function param(name) { return new URLSearchParams(location.search).get(name); }

function cityName(c) { return t('city_' + c); }
function levelName(l) { return t('lvl_' + l); }
function gearName(g) { return t('gear_' + g); }

// "Sat 10/12 14:00–16:00" / "10/12（週六） 14:00–16:00", always Taipei time.
function fmtWhen(ev) {
  var d = new Date(ev.starts_at);
  var day = d.toLocaleDateString(LANG === 'zh' ? 'zh-TW' : 'en-US',
    { timeZone: 'Asia/Taipei', weekday: 'short', month: 'numeric', day: 'numeric' });
  var s = day + ' ' + ev.starts_at.slice(11, 16);
  if (ev.ends_at) s += '–' + ev.ends_at.slice(11, 16);
  return s;
}

// Today's date in Taipei as YYYY-MM-DD (for <input type=date min>).
function taipeiToday() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function playersText(count, max) { return max ? count + ' / ' + max : String(count); }

// A pickup is confirmed once someone brings a net, someone brings balls and,
// if min_players is set, at least that many have joined. Cancelled overrides everything.
// ev needs: count, min_players, has_net, has_balls, cancelled_at.
function pickupStatus(ev) {
  var st = {
    cancelled: !!ev.cancelled_at,
    needPlayers: ev.min_players ? Math.max(0, ev.min_players - ev.count) : 0,
    needNet: !ev.has_net,
    needBalls: !ev.has_balls
  };
  st.confirmed = !st.cancelled && !st.needPlayers && !st.needNet && !st.needBalls;
  return st;
}

// "On ✔" / "Confirmed: it's on!" or "2 more players needed · needs a net"
function statusText(st, short) {
  if (st.cancelled) return t('cancelled');
  if (st.confirmed) return t(short ? 'st_on_short' : 'st_on');
  var parts = [];
  if (st.needPlayers) parts.push(st.needPlayers === 1 ? t('need_1') : t('need_n').replace('{n}', st.needPlayers));
  if (st.needNet) parts.push(t('need_net'));
  if (st.needBalls) parts.push(t('need_balls'));
  return parts.join(' · ');
}

// "🔁 Every Saturday" / "🔁 每星期六"
function weeklyLabel(ev) {
  var day = new Date(ev.starts_at).toLocaleDateString(LANG === 'zh' ? 'zh-TW' : 'en-US',
    { timeZone: 'Asia/Taipei', weekday: 'long' });
  return '🔁 ' + t('every').replace('{day}', day);
}

// Keep only the next date of each weekly series; adds `more` = number of later dates hidden.
// rows must be sorted by start time.
function collapseSeries(rows) {
  var first = {};
  return rows.filter(function (ev) {
    if (!ev.series_id) return true;
    if (first[ev.series_id]) { first[ev.series_id].more++; return false; }
    first[ev.series_id] = ev;
    ev.more = 0;
    return true;
  });
}

function moreText(n) { return n === 1 ? t('more_1') : t('more_n').replace('{n}', n); }

function errText(err) {
  return ((err && err.errors) || ['error']).map(t).join(' ');
}

function showMsg(el, html, kind) {
  el.innerHTML = '<div class="' + (kind || 'msg') + '">' + html + '</div>';
}

// ---------- storage (best effort; tokens also live in links) ----------

function storeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function storeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function storeDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

// ---------- API ----------

function api(path, opts) {
  opts = opts || {};
  var headers = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
  // Lets the server skip notifying this device about its own changes.
  var pushSub = storeGet('push-sub');
  if (pushSub) headers['x-push-sub'] = pushSub;
  return fetch(path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  }).then(function (res) {
    return res.json().catch(function () { return null; }).then(function (data) {
      if (!res.ok) {
        var err = new Error('HTTP ' + res.status);
        err.status = res.status;
        err.errors = (data && data.errors) || ['error'];
        throw err;
      }
      return data;
    });
  });
}

function copyText(input, btn) {
  input.select();
  var done = function () {
    var old = btn.textContent;
    btn.textContent = t('copied');
    setTimeout(function () { btn.textContent = old; }, 1500);
  };
  if (navigator.clipboard) navigator.clipboard.writeText(input.value).then(done, function () { document.execCommand('copy'); done(); });
  else { document.execCommand('copy'); done(); }
}

// ---------- map ----------

function makeMap(id, center, zoom) {
  var map = L.map(id).setView(center || TW_CENTER, zoom || 7);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  return map;
}

function dot(latlng) {
  return L.circleMarker(latlng, { radius: 9, color: '#000', weight: 2, fillColor: '#ffd800', fillOpacity: 1 });
}

// ---------- PWA / push notifications ----------

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () {});

// Opening the app (or switching back to it) clears its notifications from the phone's tray;
// otherwise they stay until tapped.
function clearNotifications() {
  if (!('serviceWorker' in navigator) || document.visibilityState !== 'visible') return;
  navigator.serviceWorker.getRegistration().then(function (reg) {
    if (reg && reg.getNotifications) {
      return reg.getNotifications().then(function (list) { list.forEach(function (n) { n.close(); }); });
    }
  }).catch(function () {});
}
clearNotifications();
document.addEventListener('visibilitychange', clearNotifications);

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function inLineApp() { return /\bLine\//i.test(navigator.userAgent); }

// LINE opens links in its own browser, which can't do push; this param makes LINE open the system browser.
function externalUrl() {
  return location.href + (location.search ? '&' : '?') + 'openExternalBrowser=1';
}

// 'ok' | 'line' | 'ios_install' | 'unsupported' | 'denied'
function pushState() {
  if (inLineApp()) return 'line';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIOS() && !isStandalone() ? 'ios_install' : 'unsupported';
  }
  return Notification.permission === 'denied' ? 'denied' : 'ok';
}

function b64urlBytes(s) {
  var bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, function (c) { return c.charCodeAt(0); });
}

// opts: {follow: {event_id} | {city}, kinds: ['updates'] | ['signups'] | ['new'],
//        key: localStorage key remembering it's on (optional), label: i18n key (renderPush)}
function enablePush(opts) {
  // requestPermission must be the first thing after the tap (iOS requires a user gesture).
  return Notification.requestPermission().then(function (perm) {
    if (perm !== 'granted') { var e = new Error('denied'); e.errors = ['err_push_denied']; throw e; }
    return Promise.all([navigator.serviceWorker.ready, api('/api/push/key')]);
  }).then(function (r) {
    return r[0].pushManager.getSubscription().then(function (sub) {
      return sub || r[0].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlBytes(r[1].key) });
    });
  }).then(function (sub) {
    return api('/api/push/subscribe', { method: 'POST',
      body: Object.assign({ subscription: sub.toJSON(), lang: LANG, kinds: opts.kinds }, opts.follow) });
  }).then(function (res) {
    storeSet('push-sub', res.sub_id);
    if (opts.key) storeSet(opts.key, '1');
  });
}

function disablePush(opts) {
  return navigator.serviceWorker.ready
    .then(function (reg) { return reg.pushManager.getSubscription(); })
    .then(function (sub) {
      if (sub) return api('/api/push/unsubscribe', { method: 'POST',
        body: Object.assign({ endpoint: sub.endpoint, kinds: opts.kinds }, opts.follow) });
    })
    .then(function () { if (opts.key) storeDel(opts.key); });
}

// If push can't work here (LINE, iPhone browser, …), explain what to do in msgEl and return true.
function pushBlocked(msgEl) {
  var state = pushState();
  if (state === 'ok') return false;
  msgEl.innerHTML = '<div class="msg">' + esc(t('push_' + state)) +
    (state === 'line' ? ' <a href="' + esc(externalUrl()) + '">' + esc(t('push_open_browser')) + '</a>' : '') + '</div>';
  return true;
}

// A 🔔 on/off button. When push can't work here (LINE, iPhone browser, …) a tap explains what to do.
function renderPush(el, opts) {
  var on = !!storeGet(opts.key);
  el.innerHTML = '<button type="button">' + esc(t(on ? 'push_off' : opts.label)) + '</button>' +
    (on ? ' <span class="small st-on">' + esc(t('push_on')) + '</span>' : '') + '<div class="pushmsg"></div>';
  var btn = el.querySelector('button');
  var msg = el.querySelector('.pushmsg');
  btn.onclick = function () {
    if (!on && pushBlocked(msg)) return;
    btn.disabled = true;
    (on ? disablePush(opts) : enablePush(opts))
      .then(function () { renderPush(el, opts); })
      .catch(function (err) { btn.disabled = false; showMsg(msg, esc(errText(err)), 'err'); });
  };
}

// ---------- page chrome ----------

function renderChrome() {
  var page = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') || '/';
  var nav = [['/', 'nav_events'], ['/map', 'nav_map'], ['/new', 'nav_new']].map(function (n) {
    return page === n[0] ? '<b>' + esc(t(n[1])) + '</b>' : '<a href="' + n[0] + '">' + esc(t(n[1])) + '</a>';
  }).join(' | ');
  var lang = LANG === 'zh'
    ? '<a href="#" onclick="setLang(\'en\');return false">EN</a> | <b>中文</b>'
    : '<b>EN</b> | <a href="#" onclick="setLang(\'zh\');return false">中文</a>';

  $('hdr').innerHTML =
    '<div class="masthead">' +
      '<div><a class="logo" href="/"><span class="net"></span>' + esc(t('site_title')) + '</a>' +
      '<div class="tagline">' + esc(t('tagline')) + '</div></div>' +
      '<div class="side"><div class="lang">' + lang + '</div>' +
        (LINE_URL
          ? '<a class="line" href="' + esc(LINE_URL) + '" target="_blank" rel="noopener" title="' + esc(t('line_join')) + '">' +
              '<span class="line-icon" aria-hidden="true">LINE</span>' + esc(t('line_join')) + '</a>'
          : '') +
      '</div>' +
    '</div>' +
    '<div class="nav">[ ' + nav + ' ]</div>';
  $('ftr').innerHTML = '<hr>' + esc(t('footer')) +
    ' &middot; <a href="https://www.openstreetmap.org/copyright">Map data &copy; OpenStreetMap</a>';
  applyI18n();
}
