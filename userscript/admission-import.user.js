// ==UserScript==
// @name         入院後評估 · 匯入最新 PE（依病人分流）
// @namespace    lukas.admission
// @version      2.0
// @description  按一下就從 Google Apps Script 抓所有病人的最新 PE，依病人身分（姓名/床號/病歷號）比對左側病人清單，各自填入該病人的「入院後評估」欄位。按需匯入、閒置零請求。
// @match        file:///*/admission.html
// @match        file:///*admission.html
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ===== 設定：把這行改成你部署 Apps Script 後拿到的 /exec 網址 ===== */
  const ENDPOINT = 'https://script.google.com/macros/s/貼上你的部署ID/exec';
  /* ================================================================ */

  const STORAGE_KEY = 'admission-patients';

  // 只在多病人版頁面動作
  const listEl = document.getElementById('patientList');
  if (!listEl) return;

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
  function flash(text, color, holdMs) {
    btn.textContent = text;
    if (color) btn.style.background = color;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { btn.textContent = '⬇️ 匯入最新 PE'; btn.style.background = '#b0764f'; }, holdMs || 3200);
  }

  function norm(value) {
    return String(value || '').replace(/[\s\-–—_.·]/g, '').toLowerCase();
  }

  // 病人清單名稱（姓名或床號）與記錄比對：任一識別（病歷號/姓名/床號）相等或互相包含（至少 2 字）
  function recordMatchesPatient(record, patientName) {
    const pn = norm(patientName);
    if (pn.length < 2) return false;
    return [record.mrn, record.name, record.bed].some((value) => {
      const v = norm(value);
      if (v.length < 2) return false;
      return v === pn || v.includes(pn) || pn.includes(v);
    });
  }

  function applyRecords(records) {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { flash('（頁面尚無病人清單）', '#2c5f8a'); return; }
    let state;
    try { state = JSON.parse(raw); } catch (e) { flash('⚠️ 病人資料解析失敗', '#c0392b'); return; }
    if (!Array.isArray(state.patients) || !state.patients.length) {
      flash('（請先在左側新增病人）', '#2c5f8a');
      return;
    }

    // 先讓頁面把目前編輯內容存進 localStorage，避免互相覆蓋
    const W = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    try { if (typeof W.flushSave === 'function') W.flushSave(); } catch (e) {}
    try { state = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) {}

    // 每位病人取「最新且匹配」的一筆
    const matchedNames = [];
    const unmatched = [];
    const usedPatients = new Set();
    const sorted = records.slice().sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
    for (const record of sorted) {
      if (!record.text) continue;
      const patient = state.patients.find((p) => !usedPatients.has(p.id) && recordMatchesPatient(record, p.name));
      if (patient) {
        patient.col3 = record.text;
        usedPatients.add(patient.id);
        matchedNames.push(patient.name);
      } else {
        unmatched.push([record.bed, record.name, record.mrn].filter(Boolean).join('/') || '(無識別)');
      }
    }

    if (!matchedNames.length) {
      flash(unmatched.length ? '⚠️ 無對應病人：' + unmatched.join('、') : '（雲端尚無資料）', '#c0392b', 5000);
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    // 讓頁面重新讀取並重繪；頁面函式不存在時退回重新整理
    try {
      if (typeof W.load === 'function' && typeof W.render === 'function') {
        W.load();
        W.render();
      } else {
        location.reload();
        return;
      }
    } catch (e) { location.reload(); return; }

    let message = '✅ 已匯入 ' + matchedNames.length + ' 位：' + matchedNames.join('、');
    if (unmatched.length) message += '｜無對應：' + unmatched.join('、');
    flash(message, '#4e8d7c', 5000);
  }

  function pull() {
    if (!ENDPOINT || ENDPOINT.indexOf('貼上你的部署ID') !== -1) {
      flash('⚠️ 尚未設定 ENDPOINT 網址', '#c0392b');
      return;
    }
    btn.textContent = '抓取中…';
    GM_xmlhttpRequest({
      method: 'GET',
      url: ENDPOINT + (ENDPOINT.indexOf('?') === -1 ? '?' : '&') + 'format=json&all=1',
      onload: (res) => {
        let data;
        try { data = JSON.parse(res.responseText); } catch (e) { flash('⚠️ 回應解析失敗', '#c0392b'); return; }
        const records = Array.isArray(data.records) ? data.records : (data.receivedAt ? [data] : []);
        if (!records.length) { flash('（雲端尚無資料）', '#2c5f8a'); return; }
        applyRecords(records);
      },
      onerror: () => flash('⚠️ 連線失敗（檢查網路/網址）', '#c0392b'),
      ontimeout: () => flash('⚠️ 連線逾時', '#c0392b'),
      timeout: 12000
    });
  }
})();
