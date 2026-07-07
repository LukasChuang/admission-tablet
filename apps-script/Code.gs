/**
 * Google Apps Script — 神經學檢查／PE 接收 + 顯示頁
 * 每位病人（依 病歷號 > 姓名 > 床號 識別）各保留最新一筆。
 *
 * === 部署步驟 ===
 * 1. 開 https://script.google.com/ →「新專案」
 * 2. 把這整個檔案的內容貼進 Code.gs（覆蓋原本的 myFunction）
 * 3. 若要驗證，把下面 TOKEN 改成一組密碼，並在 app 的「傳送到網頁設定」填相同值；
 *    留空字串 '' 表示不驗證（任何知道網址的人都能寫入）。
 * 4. 右上「部署」→「新增部署作業」→ 齒輪選「網頁應用程式」
 *      - 執行身分：我自己；誰可以存取：所有人
 * 5. 按「部署」，授權後會得到一個結尾是 /exec 的網址。
 *      - 用瀏覽器打開 = 顯示頁（顯示最新一筆）
 *      - 加上 ?format=json = 最新一筆 JSON；?format=json&all=1 = 全部病人的 JSON
 * 6. 之後若修改本程式，要「部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選新版本 → 部署」，
 *    網址不變但才會套用新程式。
 */

const TOKEN = ''; // 例如 'mysecret123'；留空表示不驗證
const RECORD_PREFIX = 'rec:';
const MAX_RECORDS = 30;           // 最多保留幾位病人
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 超過 7 天的自動清掉

function normId(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function identityKey(record) {
  return normId(record.mrn) || normId(record.name) || normId(record.bed) || 'unknown';
}

function allRecords(props) {
  const all = props.getProperties();
  const records = [];
  for (const key in all) {
    if (key.indexOf(RECORD_PREFIX) !== 0) continue;
    try { records.push(JSON.parse(all[key])); } catch (e) { props.deleteProperty(key); }
  }
  records.sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
  return records;
}

function pruneRecords(props) {
  const records = allRecords(props);
  const now = Date.now();
  records.forEach(function (r, index) {
    const age = now - new Date(r.receivedAt).getTime();
    if (index >= MAX_RECORDS || age > MAX_AGE_MS) {
      props.deleteProperty(RECORD_PREFIX + identityKey(r));
    }
  });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (TOKEN && data.token !== TOKEN) {
      return ContentService.createTextOutput('unauthorized');
    }
    const record = {
      text: data.text || '',
      bed: data.bed || '',
      name: data.name || '',
      mrn: data.mrn || '',
      timestamp: data.timestamp || new Date().toISOString(),
      receivedAt: new Date().toISOString()
    };
    const props = PropertiesService.getScriptProperties();
    props.setProperty('latest', JSON.stringify(record));
    props.setProperty(RECORD_PREFIX + identityKey(record), JSON.stringify(record));
    pruneRecords(props);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message);
  }
}

function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const rawLatest = props.getProperty('latest');
  const latest = rawLatest ? JSON.parse(rawLatest) : null;

  if (e && e.parameter && e.parameter.format === 'json') {
    if (e.parameter.all === '1') {
      return ContentService
        .createTextOutput(JSON.stringify({ records: allRecords(props) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService
      .createTextOutput(JSON.stringify(latest || {}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const head = latest ? (esc([latest.bed, latest.name, latest.mrn].filter(Boolean).join('　·　')) + '　（' + esc(latest.timestamp) + '）') : '尚未收到任何資料';
  const body = latest ? esc(latest.text) : '（等待 app 傳送…）';
  const html =
    '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta http-equiv="refresh" content="5">' +
    '<title>最新病歷</title><style>' +
    'body{margin:0;background:#0f1216;color:#e6e9ee;font-family:-apple-system,"Noto Sans TC",sans-serif;padding:16px;}' +
    'h1{font-size:15px;color:#2fbd6b;margin:0 0 10px;font-weight:700;}' +
    'pre{white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.5;margin:0;}' +
    '</style></head><body>' +
    '<h1>' + head + '</h1><pre>' + body + '</pre></body></html>';
  return HtmlService.createHtmlOutput(html);
}
