// UI strings. Every key needs an `en` entry; `zh` falls back to `en` if missing.
// Server error codes (err_*) come from lib/validate.js and functions/.
var I18N = {
  en: {
    site_title: 'Roundnet Taiwan Pickups',
    tagline: 'Find a game. Bring friends. No login.',
    nav_events: 'Pickups', nav_map: 'Map', nav_new: '+ Add pickup',
    footer: 'Made for the Taiwan roundnet community.',
    loading: 'Loading...', error: 'Something went wrong. Please try again.',

    upcoming: 'Upcoming pickups', all_cities: 'All cities',
    col_when: 'When', col_what: 'Pickup', col_where: 'Where', col_city: 'City', col_players: 'Players',
    none: 'No upcoming pickups yet. Why not add one?',

    map_title: 'Where people play', map_help: 'Upcoming pickups. Click a dot for details.',

    new_title: 'Add a pickup', edit_title: 'Edit pickup',
    f_title: 'Title', ph_title: 'e.g. Sunday pickup at Daan Park',
    f_date: 'Date', f_start: 'Start time', f_end: 'End time (optional)',
    f_place: 'Place name', ph_place: 'e.g. Daan Forest Park, near the amphitheater',
    f_city: 'City', choose: '-- choose --',
    f_pin: 'Location: click the map to drop a pin', f_mylocation: 'Go to my location',
    pin_set: 'Pin set ✓', pin_missing: 'No pin yet',
    f_level: 'Level', f_max: 'Max players (optional)',
    f_contact: 'Contact (LINE ID, IG, etc.)', f_notes: 'Notes',
    ph_notes: 'Bring water. We have 2 sets. Beginners welcome!',
    btn_create: 'Create pickup', btn_save: 'Save changes', btn_cancel: 'Cancel',
    btn_delete: 'Delete pickup', btn_edit: 'Edit pickup', btn_add: 'Add', btn_copy: 'Copy',

    lvl_any: 'All levels', lvl_beginner: 'Beginner', lvl_intermediate: 'Intermediate', lvl_advanced: 'Advanced',

    d_when: 'When', d_where: 'Where', d_level: 'Level', d_contact: 'Contact', d_notes: 'Notes',
    open_maps: 'Open in Google Maps',
    going: 'Going', waitlist: 'Waitlist', nobody: 'Nobody yet. Be the first!',
    join_title: 'Join this pickup',
    join_help: 'Type your name. Bringing friends? Add their names too, separated by commas.',
    ph_names: 'e.g. Tung, Amy, Ben',
    added: 'Added!', skipped: 'Already on the list:',
    remove: 'remove', confirm_remove: 'Remove this name?',
    share: 'Share this pickup', copied: 'Copied!',
    organizer: 'Organizer tools',
    created_msg: 'Pickup created! Save this secret link. It is the only way to edit or delete your pickup from another device:',
    edit_link: 'Your secret edit link (don\'t share it):',
    confirm_delete: 'Delete this pickup? This cannot be undone.',
    deleted: 'Pickup deleted.', back: '« Back to pickups',

    err_title: 'Title is required (max 80 characters).',
    err_date: 'Please choose a valid date and start time.',
    err_date_range: 'The date must be in the future and within 6 months.',
    err_end: 'End time must be after the start time.',
    err_place: 'Place name is required (max 100 characters).',
    err_city: 'Please choose a city.',
    err_location: 'Please click the map to mark the location (in Taiwan).',
    err_level: 'Please choose a level.',
    err_max: 'Max players must be a number from 2 to 100.',
    err_contact: 'Contact is too long (max 100 characters).',
    err_notes: 'Notes are too long (max 1000 characters).',
    err_names: 'Please enter at least one name.',
    err_too_many: 'This pickup\'s list is full.',
    err_not_found: 'Pickup not found. It may have been deleted.',
    err_forbidden: 'You don\'t have permission to do that.',
    err_bad_request: 'Bad request.',

    city_taipei: 'Taipei', city_new_taipei: 'New Taipei', city_keelung: 'Keelung', city_taoyuan: 'Taoyuan',
    city_hsinchu: 'Hsinchu', city_miaoli: 'Miaoli', city_taichung: 'Taichung', city_changhua: 'Changhua',
    city_nantou: 'Nantou', city_yunlin: 'Yunlin', city_chiayi: 'Chiayi', city_tainan: 'Tainan',
    city_kaohsiung: 'Kaohsiung', city_pingtung: 'Pingtung', city_yilan: 'Yilan', city_hualien: 'Hualien',
    city_taitung: 'Taitung', city_penghu: 'Penghu', city_kinmen: 'Kinmen', city_matsu: 'Matsu',
    city_other: 'Other'
  },
  zh: {
    site_title: '台灣 Roundnet 揪團',
    tagline: '找場地、揪朋友，免登入。',
    nav_events: '揪團列表', nav_map: '地圖', nav_new: '+ 新增揪團',
    footer: '為台灣 Roundnet 社群打造。',
    loading: '載入中…', error: '發生錯誤，請再試一次。',

    upcoming: '即將到來的揪團', all_cities: '所有縣市',
    col_when: '時間', col_what: '活動', col_where: '地點', col_city: '縣市', col_players: '人數',
    none: '目前還沒有揪團，來開一團吧！',

    map_title: '大家在哪裡打', map_help: '即將到來的揪團，點選圓點查看詳情。',

    new_title: '新增揪團', edit_title: '編輯揪團',
    f_title: '標題', ph_title: '例：週日大安森林公園揪團',
    f_date: '日期', f_start: '開始時間', f_end: '結束時間（選填）',
    f_place: '地點名稱', ph_place: '例：大安森林公園露天音樂台旁',
    f_city: '縣市', choose: '-- 請選擇 --',
    f_pin: '地點：在地圖上點一下放置標記', f_mylocation: '移到我的位置',
    pin_set: '已標記 ✓', pin_missing: '尚未標記',
    f_level: '程度', f_max: '人數上限（選填）',
    f_contact: '聯絡方式（LINE ID、IG 等）', f_notes: '備註',
    ph_notes: '記得帶水。我們有兩組網子。歡迎新手！',
    btn_create: '建立揪團', btn_save: '儲存變更', btn_cancel: '取消',
    btn_delete: '刪除揪團', btn_edit: '編輯揪團', btn_add: '加入', btn_copy: '複製',

    lvl_any: '不限程度', lvl_beginner: '新手', lvl_intermediate: '中階', lvl_advanced: '進階',

    d_when: '時間', d_where: '地點', d_level: '程度', d_contact: '聯絡', d_notes: '備註',
    open_maps: '在 Google 地圖開啟',
    going: '參加名單', waitlist: '候補', nobody: '還沒有人報名，搶頭香！',
    join_title: '報名參加',
    join_help: '輸入你的名字。有帶朋友嗎？用逗號分隔，一起加入。',
    ph_names: '例：小明, 小華, Amy',
    added: '已加入！', skipped: '已在名單中：',
    remove: '移除', confirm_remove: '確定要移除這個名字嗎？',
    share: '分享這個揪團', copied: '已複製！',
    organizer: '主辦人工具',
    created_msg: '揪團已建立！請保存這個秘密連結，這是從其他裝置編輯或刪除活動的唯一方式：',
    edit_link: '你的秘密編輯連結（請勿分享）：',
    confirm_delete: '確定要刪除這個揪團嗎？此動作無法復原。',
    deleted: '揪團已刪除。', back: '« 回到揪團列表',

    err_title: '請填寫標題（最多 80 字）。',
    err_date: '請選擇有效的日期與開始時間。',
    err_date_range: '日期必須在未來 6 個月內。',
    err_end: '結束時間必須晚於開始時間。',
    err_place: '請填寫地點名稱（最多 100 字）。',
    err_city: '請選擇縣市。',
    err_location: '請在地圖上標記地點（台灣境內）。',
    err_level: '請選擇程度。',
    err_max: '人數上限需為 2 到 100 的數字。',
    err_contact: '聯絡方式太長（最多 100 字）。',
    err_notes: '備註太長（最多 1000 字）。',
    err_names: '請輸入至少一個名字。',
    err_too_many: '這個揪團的名單已滿。',
    err_not_found: '找不到這個揪團，可能已被刪除。',
    err_forbidden: '你沒有權限執行這個動作。',
    err_bad_request: '請求格式錯誤。',

    city_taipei: '台北市', city_new_taipei: '新北市', city_keelung: '基隆市', city_taoyuan: '桃園市',
    city_hsinchu: '新竹', city_miaoli: '苗栗縣', city_taichung: '台中市', city_changhua: '彰化縣',
    city_nantou: '南投縣', city_yunlin: '雲林縣', city_chiayi: '嘉義', city_tainan: '台南市',
    city_kaohsiung: '高雄市', city_pingtung: '屏東縣', city_yilan: '宜蘭縣', city_hualien: '花蓮縣',
    city_taitung: '台東縣', city_penghu: '澎湖縣', city_kinmen: '金門縣', city_matsu: '連江縣（馬祖）',
    city_other: '其他'
  }
};

var LANG = (function () {
  try {
    var saved = localStorage.getItem('lang');
    if (saved === 'en' || saved === 'zh') return saved;
  } catch (e) {}
  return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
})();

function t(key) {
  return (I18N[LANG] && I18N[LANG][key]) || I18N.en[key] || key;
}

function setLang(lang) {
  try { localStorage.setItem('lang', lang); } catch (e) {}
  location.reload();
}

// Fill elements marked with data-i18n (text) and data-i18n-ph (placeholder).
function applyI18n(root) {
  root = root || document;
  document.documentElement.lang = LANG === 'zh' ? 'zh-Hant-TW' : 'en';
  root.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
  root.querySelectorAll('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
}
