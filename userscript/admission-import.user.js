// ==UserScript==
// @name         入院後評估 · 自動匯入 PE（from 平板 app）
// @namespace    lukas.admission
// @version      1.0
// @description  定時從 Google Apps Script 抓平板 app 傳來的最新 PE 病歷，自動填入「入院後評估」欄位（col3）
// @match        file:///*/admission.html
// @match        file:///*admission.html
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ===== 設定：把這行改成你部署 Apps Script 後拿到的 /exec 網址 ===== */
  const ENDPOINT = 'https://script.google.com/macros/s/貼上你的部署ID/exec';

  const MODE = 'replace';   // 'replace' = 覆蓋欄位內容；'append' = 附加在後面
  const POLL_MS = 4000;     // 每幾毫秒抓一次
  const APPLIED_KEY = 'admission-import-last'; // 記住已匯入過的那一筆，避免重複匯入
  /* ================================================================ */

  const target = document.getElementById('col3');
  if (!target) return; // 不是那個頁面就不動作

  // 右下角狀態小徽章
  const chip = document.createElement('div');
  chip.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;background:#2c5f8a;color:#fff;' +
    'font:12px/1.4 -apple-system,"Noto Sans TC",sans-serif;padding:7px 12px;border-radius:16px;' +
    'box-shadow:0 2px 8px rgba(0,0,0,.25);opacity:.9;cursor:pointer;user-select:none;';
  chip.textContent = '⏳ PE 匯入待命';
  chip.title = '點一下立即抓取最新一筆';
  chip.addEventListener('click', () => poll(true));
  document.body.appendChild(chip);

  function setChip(text, color) {
    chip.textContent = text;
    if (color) chip.style.background = color;
  }

  function fill(record) {
    const incoming = String(record.text || '');
    if (!incoming) return;
    if (MODE === 'append' && target.value.trim()) {
      target.value = target.value.replace(/\s*$/, '') + '\n\n' + incoming;
    } else {
      target.value = incoming;
    }
    // 觸發頁面原本的 input 監聽（會更新字數並自動儲存）
    target.dispatchEvent(new Event('input', { bubbles: true }));
    const who = [record.bed, record.name, record.mrn].filter(Boolean).join(' · ') || '(無識別)';
    setChip('✅ 已匯入 ' + who + '　' + new Date().toLocaleTimeString(), '#4e8d7c');
  }

  function poll(manual) {
    if (!ENDPOINT || ENDPOINT.indexOf('貼上你的部署ID') !== -1) {
      setChip('⚠️ 尚未設定 ENDPOINT 網址', '#b0764f');
      return;
    }
    GM_xmlhttpRequest({
      method: 'GET',
      url: ENDPOINT + (ENDPOINT.indexOf('?') === -1 ? '?' : '&') + 'format=json',
      onload: (res) => {
        let r;
        try { r = JSON.parse(res.responseText); } catch (e) { setChip('⚠️ 回應解析失敗', '#b0764f'); return; }
        if (!r || !r.receivedAt) { if (manual) setChip('（雲端尚無資料）', '#2c5f8a'); return; }
        const applied = localStorage.getItem(APPLIED_KEY);
        if (r.receivedAt === applied && !manual) return; // 這筆已匯入過
        if (r.receivedAt === applied && manual) { setChip('（已是最新，無新資料）', '#2c5f8a'); return; }
        localStorage.setItem(APPLIED_KEY, r.receivedAt);
        fill(r);
      },
      onerror: () => setChip('⚠️ 連線失敗（檢查網路/網址）', '#b0764f'),
      ontimeout: () => setChip('⚠️ 連線逾時', '#b0764f'),
      timeout: 12000
    });
  }

  setInterval(() => poll(false), POLL_MS);
  poll(false);
})();
