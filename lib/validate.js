// Pure validation shared by the Pages Functions. No Workers/browser APIs here,
// so it can be unit-tested in Node (tests/unit/validate.test.js).
// Error values are i18n keys (see public/app/i18n.js).

// Keep in sync with CITIES in public/app/app.js.
export const CITIES = [
  'taipei', 'new_taipei', 'keelung', 'taoyuan', 'hsinchu', 'miaoli', 'taichung',
  'changhua', 'nantou', 'yunlin', 'chiayi', 'tainan', 'kaohsiung', 'pingtung',
  'yilan', 'hualien', 'taitung', 'penghu', 'kinmen', 'matsu', 'other',
];
export const LEVELS = ['any', 'beginner', 'intermediate', 'advanced'];

// Loose box around Taiwan incl. Penghu, Kinmen and Matsu.
export const TW_BOUNDS = { minLat: 21.8, maxLat: 26.5, minLng: 118.0, maxLng: 122.1 };

export const MAX_NAMES_PER_POST = 20;
export const MAX_SIGNUPS_PER_EVENT = 200;
const MAX_NAME_LEN = 40;
const DAY = 24 * 3600 * 1000;

function str(v) {
  // Trim and strip control characters (keep newlines for notes).
  return String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim();
}

export function validateEvent(input, now = Date.now()) {
  const errors = [];
  const v = {};
  input = input || {};

  v.title = str(input.title);
  if (!v.title || v.title.length > 80) errors.push('err_title');

  const date = str(input.date), start = str(input.start), end = str(input.end);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(start);
  v.starts_at = `${date}T${start}:00+08:00`;
  v.starts_ts = dateOk ? Date.parse(v.starts_at) : NaN;
  if (!dateOk || Number.isNaN(v.starts_ts)) {
    errors.push('err_date');
  } else if (v.starts_ts < now - 3600 * 1000 || v.starts_ts > now + 183 * DAY) {
    errors.push('err_date_range');
  }
  v.ends_at = null;
  if (end) {
    if (!/^\d{2}:\d{2}$/.test(end) || end <= start) errors.push('err_end');
    else v.ends_at = `${date}T${end}:00+08:00`;
  }

  v.place_name = str(input.place_name);
  if (!v.place_name || v.place_name.length > 100) errors.push('err_place');

  v.city = str(input.city);
  if (!CITIES.includes(v.city)) errors.push('err_city');

  v.lat = Number(input.lat);
  v.lng = Number(input.lng);
  const b = TW_BOUNDS;
  if (input.lat === '' || input.lat == null || input.lng === '' || input.lng == null ||
      !(v.lat >= b.minLat && v.lat <= b.maxLat && v.lng >= b.minLng && v.lng <= b.maxLng)) {
    errors.push('err_location');
  }

  v.level = str(input.level) || 'any';
  if (!LEVELS.includes(v.level)) errors.push('err_level');

  const max = input.max_players;
  v.max_players = null;
  if (max !== '' && max != null) {
    const n = Number(max);
    if (!Number.isInteger(n) || n < 2 || n > 100) errors.push('err_max');
    else v.max_players = n;
  }

  v.contact = str(input.contact);
  if (v.contact.length > 100) errors.push('err_contact');

  v.notes = str(input.notes);
  if (v.notes.length > 1000) errors.push('err_notes');

  return { errors, value: v };
}

// "Tung, Amy，小明、Ben\nAmy" -> ['Tung', 'Amy', '小明', 'Ben']
// Accepts a string or an array of strings. Dedupes case-insensitively.
export function parseNames(input, max = MAX_NAMES_PER_POST) {
  const raw = Array.isArray(input) ? input.join('\n') : String(input ?? '');
  const seen = new Set();
  const out = [];
  for (let part of raw.split(/[,，、;；\n]/)) {
    part = str(part).replace(/\s+/g, ' ').slice(0, MAX_NAME_LEN).trim();
    const key = part.toLowerCase();
    if (!part || seen.has(key)) continue;
    seen.add(key);
    out.push(part);
    if (out.length >= max) break;
  }
  return out;
}
