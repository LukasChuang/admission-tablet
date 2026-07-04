// ==UserScript==
// @name         入院後評估 · 匯入最新 PE（from 平板 app）
// @namespace    lukas.admission
// @version      1.1
// @description  在 admission.html 右下角提供一顆按鈕，按一下就從 Google Apps Script 抓平板 app 傳來的最新 PE 病歷，填入「入院後評估」欄位（col3）。按需匯入、閒置零請求。
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
  /* ================================================================ */

  const target = document.getElementById('col3');
  if (!target) return; // 不是那個頁面就不動作

  // 右下角按鈕
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:99999;background:#b0764f;color:#fff;' +
    'font:13px/1.4 -apple-system,"Noto Sans TC",sans-serif;font-weight:600;padding:10px 16px;border:none;' +
    'border-radius:20px;box-shadow:0 2px 10px rgba(0,0,0,.28);cursor:pointer;';
  btn.textContent = '⬇️ 匯入最新 PE';
  btn.addEventListener('click', pull);
  document.body.appendChild(btn);

  let resetTimer;
  function flash(text, color) {
    btn.textContent = text;
    if (color) btn.style.background = color;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { btn.textContent = '⬇️ 匯入最新 PE'; btn.style.background = '#b0764f'; }, 2500);
  }

  function fill(record) {
    const incoming = String(record.text || '');
    if (!incoming) { flash('（雲端尚無資料）', '#2c5f8a'); return; }
    if (MODE === 'append' && target.value.trim()) {
      target.value = target.value.replace(/\s*$/, '') + '\n\n' + incoming;
    } else {
      target.value = incoming;
    }
    // 觸發頁面原本的 input 監聽（會更新字數並自動儲存）
    target.dispatchEvent(new Event('input', { bubbles: true }));
    const who = [record.bed, record.name, record.mrn].filter(Boolean).join(' · ') || '(無識別)';
    flash('✅ 已匯入 ' + who, '#4e8d7c');
  }

  function pull() {
    if (!ENDPOINT || ENDPOINT.indexOf('貼上你的部署ID') !== -1) {
      flash('⚠️ 尚未設定 ENDPOINT 網址', '#c0392b');
      return;
    }
    btn.textContent = '抓取中…';
    GM_xmlhttpRequest({
      method: 'GET',
      url: ENDPOINT + (ENDPOINT.indexOf('?') === -1 ? '?' : '&') + 'format=json',
      onload: (res) => {
        let r;
        try { r = JSON.parse(res.responseText); } catch (e) { flash('⚠️ 回應解析失敗', '#c0392b'); return; }
        if (!r || !r.receivedAt) { flash('（雲端尚無資料）', '#2c5f8a'); return; }
        fill(r);
      },
      onerror: () => flash('⚠️ 連線失敗（檢查網路/網址）', '#c0392b'),
      ontimeout: () => flash('⚠️ 連線逾時', '#c0392b'),
      timeout: 12000
    });
  }
})();
