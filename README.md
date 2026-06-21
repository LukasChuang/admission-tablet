# Last Admission Summary Offline

這是獨立於 Mac/Python 版本的離線平板 PWA。

- 不使用 AI 或任何外部 API。
- 病人資料、設定與 PDF 都只儲存在瀏覽器 IndexedDB。
- Symptoms／PE 支援 Yes、No 與再次點擊取消選取。
- 項目及預設選取可自行編輯並永久儲存。
- 可產生條列統整結果、規則式轉換常見入院原因、擷取常用異常 Lab。
- 支援 JSON 備份與還原；備份檔含病人資料，必須妥善保管。

## 本機預覽

在專案根目錄執行：

```sh
python3 -m http.server 8790 --directory medical_record/last_admission_tablet
```

再開啟 <http://127.0.0.1:8790/>。

## 安裝到平板

PWA 第一次安裝仍需透過 HTTPS 網址載入一次。可部署這個資料夾到純靜態 HTTPS
網站；程式碼不包含後端，使用過程不會把病人資料傳回網站。第一次開啟完成後，
使用 Safari「加入主畫面」或 Chrome「安裝應用程式」，之後即可離線使用。
