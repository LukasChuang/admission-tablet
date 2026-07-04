/**
 * Google Apps Script — 神經學檢查／PE 接收 + 顯示頁（只保留最新一筆）
 *
 * === 部署步驟 ===
 * 1. 開 https://script.google.com/ →「新專案」
 * 2. 把這整個檔案的內容貼進 Code.gs（覆蓋原本的 myFunction）
 * 3. 若要驗證，把下面 TOKEN 改成一組密碼，並在 app 的「傳送到網頁設定」填相同值；
 *    留空字串 '' 表示不驗證（任何知道網址的人都能寫入）。
 * 4. 右上「部署」→「新增部署作業」→ 齒輪選「網頁應用程式」
 *      - 說明：隨意
 *      - 執行身分：我自己
 *      - 誰可以存取：所有人
 * 5. 按「部署」，授權後會得到一個結尾是 /exec 的網址。
 *      - 這個網址「用瀏覽器打開」= 顯示頁（每 5 秒自動更新，顯示最新一筆）
 *      - 這個網址「貼到 app 的接收網址欄」= app 按「傳送到網頁」就會送到這裡
 * 6. 之後若修改本程式，要重新「部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選新版本 → 部署」，
 *    網址才會套用新程式（網址本身不變）。
 */

const TOKEN = ''; // 例如 'mysecret123'；留空表示不驗證

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
    PropertiesService.getScriptProperties().setProperty('latest', JSON.stringify(record));
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message);
  }
}

function doGet(e) {
  const raw = PropertiesService.getScriptProperties().getProperty('latest');
  const r = raw ? JSON.parse(raw) : null;

  // 給篡改猴腳本用：?format=json 回傳最新一筆的 JSON
  if (e && e.parameter && e.parameter.format === 'json') {
    return ContentService
      .createTextOutput(JSON.stringify(r || {}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const head = r ? (esc([r.bed, r.name, r.mrn].filter(Boolean).join('　·　')) + '　（' + esc(r.timestamp) + '）') : '尚未收到任何資料';
  const body = r ? esc(r.text) : '（等待 app 傳送…）';
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
