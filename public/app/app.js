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
