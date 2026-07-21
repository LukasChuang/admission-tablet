(() => {
  "use strict";

  const DB_NAME = "last-admission-offline";
  const DB_VERSION = 1;
  const PATIENT_STORE = "patients";
  const SETTINGS_STORE = "settings";
  const DEFAULT_SETTINGS = {
    complaint: [
      "fever", "chills", "headache", "cough", "dyspnea", "chest pain",
      "abdominal pain", "nausea", "diarrhea", "constipation", "dysuria",
      "weight loss", "appetite loss"
    ],
    pe: [
      "altered consciousness", "neck stiffness", "crackles", "wheezing",
      "heart murmur", "abdominal tenderness", "rebound tenderness",
      "pitting edema", "skin rash", "focal neurological deficit"
    ],
    defaults: { complaint: {}, pe: {} }
  };

  const NE_SIGN = ["(-)", "(+)"];
  const NE_POWER = ["0", "1", "2", "3", "4", "4+", "5"];
  const NE_DTR = ["0", "trace", "+", "++", "+++", "clonus"];
  const NE_PUPIL = ["2mm", "2.5mm", "3mm", "3.5mm", "4mm", "5mm", "6mm"];

  const NE_PE_NORMAL = {
    heent: `1. HEENT: grossly normal
   Eyes: Conjunctivae: pink; Sclerae: anicteric
   Pupils and EOM: see below (NE part)
   Neck: supple; no jugular vein engorgement; no palpable lymph node; no goiter; no carotid bruit`,
    chest: `2. Chest: symmetric expansion; clear breath sounds; no crackle, rhonchus, stridor, or wheezing`,
    heart: `3. Heart: regular heart beats; no apparent heart murmur`,
    abdomen: `4. Abdomen: flat; normoactive bowel sounds; soft; no tenderness; no rebound tenderness
   liver/spleen: impalpable`,
    back: `5. Back: no knocking tenderness at costovertebral angles`,
    extremities: `6. Extremities: freely movable; no pitting edema; no cyanosis;
   Pulses: (R/L) radial ++/++; dorsalis pedis ++/++`,
    skin: `7. Skin: Abnormal pigmentation(-), skin rash(-), Petechiae(-), Purpura(-), Ecchymoses(-)`
  };

  const NE_SECTIONS = [
    { title: "一般 PE（正常/異常）", items: [
      { t: "seg", id: "heent", lab: "HEENT / Eyes / Neck", opts: ["正常", "異常"], nz: "正常" },
      { t: "seg", id: "chest", lab: "Chest", opts: ["正常", "異常"], nz: "正常" },
      { t: "seg", id: "heart", lab: "Heart", opts: ["正常", "異常"], nz: "正常" },
      { t: "seg", id: "abdomen", lab: "Abdomen", opts: ["正常", "異常"], nz: "正常" },
      { t: "seg", id: "back", lab: "Back（CVA knocking）", opts: ["正常", "異常"], nz: "正常" },
      { t: "seg", id: "extremities", lab: "Extremities / Pulses", opts: ["正常", "異常"], nz: "正常" },
      { t: "seg", id: "skin", lab: "Skin", opts: ["正常", "異常"], nz: "正常" }
    ] },
    { title: "Cranial Nerve（腦神經）", items: [
      { t: "seg", id: "cn2_va", lab: "CN II · Visual acuity", opts: ["intact", "impaired"], nz: "intact" },
      { t: "pcyc", id: "cn3_pupil", lab: "CN III · Pupil size (R/L)", opts: NE_PUPIL, nz: "3mm" },
      { t: "pseg", id: "cn3_lr", lab: "CN III · Light reflex (R/L)", opts: ["+", "-"], nz: "+" },
      { t: "seg", id: "cn3_diplopia", lab: "CN III · Binocular diplopia", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "cn5_corneal", lab: "CN V · Corneal reflex", opts: ["+/+", "abnormal"], nz: "+/+" },
      { t: "seg", id: "cn5_sens", lab: "CN V · Facial sensation", opts: ["intact", "abnormal"], nz: "intact" },
      { t: "seg", id: "cn7", lab: "CN VII · Facial palsy type", opts: ["No", "Central", "Peripheral"], nz: "No" },
      { t: "seg", id: "cn8_hear", lab: "CN VIII · Hearing", opts: ["fair", "impaired"], nz: "fair" },
      { t: "seg", id: "cn8_nyst", lab: "CN VIII · Nystagmus", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "cn910_uvula", lab: "CN IX,X · Uvula deviation", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "cn910_gag", lab: "CN IX,X · Gag reflex", opts: ["+/+", "abnormal"], nz: "+/+" },
      { t: "seg", id: "cn11", lab: "CN XI · SCM/Trapezius", opts: ["5/5", "weak"], nz: "5/5" },
      { t: "seg", id: "cn12", lab: "CN XII · Tongue deviation", opts: NE_SIGN, nz: "(-)" }
    ] },
    { title: "Motor · Inspection & Tone", items: [
      { t: "seg", id: "mi_wast", lab: "Muscle wasting", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "mi_fasc", lab: "Fasciculation", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "mi_cramp", lab: "Muscle cramps", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "mi_dyst", lab: "Dystonia", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "tone_spas", lab: "Spasticity", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "tone_rig", lab: "Rigidity", opts: NE_SIGN, nz: "(-)" }
    ] },
    { title: "Muscle Power（點一下換級・預設 5）", items: [
      { t: "pcyc", id: "mp_sh", lab: "Shoulder", opts: NE_POWER, nz: "5" },
      { t: "pcyc", id: "mp_elbF", lab: "Elbow flexion", opts: NE_POWER, nz: "5" },
      { t: "pcyc", id: "mp_elbE", lab: "Elbow extension", opts: NE_POWER, nz: "5" },
      { t: "pcyc", id: "mp_wrF", lab: "Wrist flexion", opts: NE_POWER, nz: "5" },
      { t: "pcyc", id: "mp_wrE", lab: "Wrist extension", opts: NE_POWER, nz: "5" },
      { t: "pcyc", id: "mp_grasp", lab: "Grasp", opts: NE_POWER, nz: "5" },
      { t: "pcyc", id: "mp_hip", lab: "Hip flexion", opts: NE_POWER, nz: "5" },
      { t: "pcyc", id: "mp_kneeF", lab: "Knee flexion", opts: NE_POWER, nz: "5" },
      { t: "pcyc", id: "mp_kneeE", lab: "Knee extension", opts: NE_POWER, nz: "5" },
      { t: "pcyc", id: "mp_ankD", lab: "Ankle dorsiflexion", opts: NE_POWER, nz: "5" },
      { t: "pcyc", id: "mp_ankP", lab: "Ankle plantarflexion", opts: NE_POWER, nz: "5" },
      { t: "pcyc", id: "mp_toe", lab: "Big toe", opts: NE_POWER, nz: "5" }
    ] },
    { title: "DTR（深部肌腱反射・點一下換級）", items: [
      { t: "pcyc", id: "dtr_biceps", lab: "Biceps", opts: NE_DTR, nz: "++" },
      { t: "pcyc", id: "dtr_triceps", lab: "Triceps", opts: NE_DTR, nz: "++" },
      { t: "pcyc", id: "dtr_brachio", lab: "Brachioradialis", opts: NE_DTR, nz: "+" },
      { t: "pcyc", id: "dtr_knee", lab: "Knee", opts: NE_DTR, nz: "++" },
      { t: "pcyc", id: "dtr_ankle", lab: "Ankle", opts: NE_DTR, nz: "trace" }
    ] },
    { title: "Reflexes & Soft Signs", items: [
      { t: "pseg", id: "pron", lab: "Pronator drift (R/L)", opts: NE_SIGN, nz: "(-)" },
      { t: "pseg", id: "babinski", lab: "Babinski (R/L)", opts: ["flexor", "extensor"], nz: "flexor" },
      { t: "pseg", id: "hoffmann", lab: "Hoffmann (R/L)", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "jaw", lab: "Jaw jerk", opts: NE_SIGN, nz: "(-)" }
    ] },
    { title: "Sensory", items: [
      { t: "seg", id: "s_pin", lab: "Pinprick", opts: ["intact", "abnormal"], nz: "intact" },
      { t: "seg", id: "s_light", lab: "Light touch", opts: ["intact", "abnormal"], nz: "intact" },
      { t: "seg", id: "s_temp", lab: "Temperature", opts: ["intact", "abnormal"], nz: "intact" },
      { t: "seg", id: "s_romberg", lab: "Romberg's test", opts: NE_SIGN, nz: "(-)" }
    ] },
    { title: "Cerebellum / Coordination", items: [
      { t: "seg", id: "c_fnf", lab: "Finger-nose-finger dysmetria", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "c_hks", lab: "Heel-knee-shin dysmetria", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "c_ram", lab: "RAM dysdiadochokinesia", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "c_trunc", lab: "Truncal titubation", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "c_tandem", lab: "Tandem gait", opts: ["normal", "fair", "unable"], nz: "normal" }
    ] },
    { title: "Extrapyramidal System", items: [
      { t: "seg", id: "e_mask", lab: "Mask face", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "e_arm", lab: "Decreased arm swing", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "e_tremR", lab: "Resting tremor", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "e_tremA", lab: "Action tremor", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "e_tremP", lab: "Postural tremor", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "e_rigid", lab: "Rigidity (cogwheel/truncal)", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "e_brady", lab: "Bradykinesia", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "e_post", lab: "Postural instability", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "e_gait", lab: "Gait abnormality", opts: ["正常", "異常"], nz: "正常" }
    ] },
    { title: "Autonomic Nervous System", items: [
      { t: "seg", id: "a_urine", lab: "Urinary incontinence", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "a_stool", lab: "Stool incontinence", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "a_dizzy", lab: "Postural dizziness", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "a_ortho", lab: "Orthostatic hypotension", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "a_palp", lab: "Palpitation", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "a_sweatH", lab: "Excessive sweating", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "a_sweatL", lab: "Less sweating", opts: NE_SIGN, nz: "(-)" },
      { t: "seg", id: "a_3bp", lab: "3-phase BP（列入空白表格待填）", opts: ["不列入", "列入"], nz: "不列入" }
    ] }
  ];

  let neState = {};

  const state = {
    db: null,
    patients: [],
    current: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    cloud: { clientId: "", folderName: "Admission Summary" },
    web: { url: "", token: "" },
    defaultDraft: { complaint: {}, pe: {} },
    dirty: false,
    pdfUrl: ""
  };

  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const googleAuth = { client: null, clientId: "", token: "", expiresAt: 0 };
  let gisLoadPromise = null;

  const $ = (id) => document.getElementById(id);
  const els = {
    patientList: $("patientList"),
    patientSearch: $("patientSearchInput"),
    bed: $("bedInput"),
    name: $("nameInput"),
    mrn: $("mrnInput"),
    complaintChecklist: $("complaintChecklist"),
    peChecklist: $("peChecklist"),
    complaintOther: $("complaintOther"),
    peOther: $("peOther"),
    admissionReason: $("admissionReasonInput"),
    lab: $("labInput"),
    recentStatus: $("recentStatusInput"),
    labSummary: $("labSummaryInput"),
    neApp: $("neApp"),
    nePreview: $("nePreview"),
    output: $("summaryOutput"),
    sourceText: $("sourceTextInput"),
    pdfInput: $("pdfInput"),
    pdfInfo: $("pdfInfo"),
    pdfPreview: $("pdfPreview"),
    removePdf: $("removePdfBtn"),
    complaintEditor: $("complaintItemsEditor"),
    peEditor: $("peItemsEditor"),
    complaintDefaults: $("complaintDefaultsEditor"),
    peDefaults: $("peDefaultsEditor"),
    cloudClientId: $("cloudClientIdInput"),
    cloudFolder: $("cloudFolderInput"),
    webUrl: $("webUrlInput"),
    webToken: $("webTokenInput"),
    uploadBtn: $("uploadBtn"),
    saveState: $("saveState"),
    toast: $("toast")
  };

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PATIENT_STORE)) {
          db.createObjectStore(PATIENT_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function dbRequest(storeName, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(storeName, mode);
      const request = action(tx.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  const getAllPatients = () => dbRequest(PATIENT_STORE, "readonly", (store) => store.getAll());
  const putPatient = (patient) => dbRequest(PATIENT_STORE, "readwrite", (store) => store.put(patient));
  const deletePatient = (id) => dbRequest(PATIENT_STORE, "readwrite", (store) => store.delete(id));
  const getSettings = () => dbRequest(SETTINGS_STORE, "readonly", (store) => store.get("clinical"));
  const putSettings = (settings) => dbRequest(
    SETTINGS_STORE, "readwrite", (store) => store.put({ key: "clinical", value: settings })
  );
  const getCloud = () => dbRequest(SETTINGS_STORE, "readonly", (store) => store.get("cloud"));
  const putCloud = (cloud) => dbRequest(
    SETTINGS_STORE, "readwrite", (store) => store.put({ key: "cloud", value: cloud })
  );
  const getWeb = () => dbRequest(SETTINGS_STORE, "readonly", (store) => store.get("web"));
  const putWeb = (web) => dbRequest(
    SETTINGS_STORE, "readwrite", (store) => store.put({ key: "web", value: web })
  );

  function newId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function blankPatient() {
    return {
      id: newId(),
      bed: "",
      name: "",
      mrn: "",
      selections: {
        complaint: { ...(state.settings.defaults.complaint || {}) },
        pe: { ...(state.settings.defaults.pe || {}) }
      },
      complaintOther: "",
      peOther: "",
      admissionReason: "",
      lab: "",
      labSummary: "",
      recentStatus: "",
      sourceText: "",
      summary: "",
      neuro: {},
      pdf: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function normalizedItems(value) {
    const seen = new Set();
    return String(value || "").split(/\n/).map((item) => item.trim().replace(/\s+/g, " ")).filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("visible"), 2600);
  }

  function markDirty() {
    state.dirty = true;
    els.saveState.textContent = "尚未儲存";
  }

  function patientFromForm() {
    return {
      ...state.current,
      bed: els.bed.value.trim(),
      name: els.name.value.trim(),
      mrn: els.mrn.value.trim(),
      complaintOther: els.complaintOther.value,
      peOther: els.peOther.value,
      admissionReason: els.admissionReason.value,
      lab: els.lab.value,
      labSummary: els.labSummary.value,
      recentStatus: els.recentStatus.value,
      sourceText: els.sourceText.value,
      summary: els.output.value,
      neuro: structuredClone(neState),
      updatedAt: Date.now()
    };
  }

  function releasePdfUrl() {
    if (state.pdfUrl) URL.revokeObjectURL(state.pdfUrl);
    state.pdfUrl = "";
  }

  function renderPdf() {
    releasePdfUrl();
    const pdf = state.current?.pdf;
    els.pdfInput.value = "";
    if (!pdf?.blob) {
      els.pdfInfo.textContent = "尚未加入 PDF";
      els.pdfPreview.hidden = true;
      els.pdfPreview.removeAttribute("src");
      els.removePdf.hidden = true;
      return;
    }
    state.pdfUrl = URL.createObjectURL(pdf.blob);
    els.pdfInfo.textContent = `${pdf.name} · ${formatBytes(pdf.blob.size)}`;
    els.pdfPreview.src = state.pdfUrl;
    els.pdfPreview.hidden = false;
    els.removePdf.hidden = false;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function loadPatient(patient) {
    state.current = structuredClone(patient);
    els.bed.value = patient.bed || "";
    els.name.value = patient.name || "";
    els.mrn.value = patient.mrn || "";
    els.complaintOther.value = patient.complaintOther || "";
    els.peOther.value = patient.peOther || "";
    els.admissionReason.value = patient.admissionReason || "";
    els.lab.value = patient.lab || "";
    els.labSummary.value = patient.labSummary || "";
    els.recentStatus.value = patient.recentStatus || "";
    els.sourceText.value = patient.sourceText || "";
    els.output.value = patient.summary || "";
    neState = (patient.neuro && typeof patient.neuro === "object") ? structuredClone(patient.neuro) : {};
    neBuildUI();
    neRender();
    state.current.selections ||= { complaint: {}, pe: {} };
    state.current.selections.complaint ||= {};
    state.current.selections.pe ||= {};
    renderChecklists();
    renderPdf();
    state.dirty = false;
    els.saveState.textContent = patient.updatedAt ? `已儲存 ${new Date(patient.updatedAt).toLocaleString()}` : "尚未儲存";
    renderPatientList();
  }

  function renderPatientList() {
    const query = els.patientSearch.value.trim().toLowerCase();
    const patients = state.patients
      .filter((patient) => [patient.bed, patient.name, patient.mrn].join(" ").toLowerCase().includes(query))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    els.patientList.replaceChildren();
    if (!patients.length) {
      const empty = document.createElement("div");
      empty.className = "empty-list";
      empty.textContent = query ? "找不到符合的病人" : "尚未建立病人";
      els.patientList.appendChild(empty);
      return;
    }
    patients.forEach((patient) => {
      const button = document.createElement("button");
      button.className = `patient-item${patient.id === state.current?.id ? " active" : ""}`;
      const title = document.createElement("strong");
      title.textContent = [patient.bed, patient.name].filter(Boolean).join(" · ") || "未命名病人";
      const meta = document.createElement("span");
      meta.textContent = `${patient.mrn || "無病歷號"} · ${new Date(patient.updatedAt).toLocaleDateString()}`;
      button.append(title, meta);
      button.addEventListener("click", () => switchPatient(patient));
      els.patientList.appendChild(button);
    });
  }

  async function switchPatient(patient) {
    if (state.dirty && !confirm("目前內容尚未儲存，確定要切換病人嗎？")) return;
    loadPatient(patient);
  }

  function renderChecklist(kind) {
    const container = kind === "complaint" ? els.complaintChecklist : els.peChecklist;
    const items = state.settings[kind] || [];
    const selections = state.current?.selections?.[kind] || {};
    container.replaceChildren();
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "check-row";
      const label = document.createElement("span");
      label.className = "check-label";
      label.textContent = item;
      row.appendChild(label);
      for (const value of ["yes", "no"]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `choice ${value}${selections[item] === value ? " selected" : ""}`;
        button.textContent = value === "yes" ? "Yes" : "No";
        button.setAttribute("aria-pressed", String(selections[item] === value));
        button.addEventListener("click", () => {
          if (state.current.selections[kind][item] === value) delete state.current.selections[kind][item];
          else state.current.selections[kind][item] = value;
          renderChecklist(kind);
          markDirty();
        });
        row.appendChild(button);
      }
      container.appendChild(row);
    });
  }

  function renderChecklists() {
    renderChecklist("complaint");
    renderChecklist("pe");
  }

  function renderSettings() {
    els.complaintEditor.value = state.settings.complaint.join("\n");
    els.peEditor.value = state.settings.pe.join("\n");
    state.defaultDraft = structuredClone(state.settings.defaults);
    renderDefaultEditor("complaint");
    renderDefaultEditor("pe");
  }

  function renderDefaultEditor(kind) {
    const editor = kind === "complaint" ? els.complaintEditor : els.peEditor;
    const container = kind === "complaint" ? els.complaintDefaults : els.peDefaults;
    const items = normalizedItems(editor.value);
    const retained = {};
    container.replaceChildren();
    items.forEach((item) => {
      if (["yes", "no"].includes(state.defaultDraft[kind]?.[item])) retained[item] = state.defaultDraft[kind][item];
      const row = document.createElement("div");
      row.className = "default-row";
      const label = document.createElement("span");
      label.textContent = item;
      row.appendChild(label);
      for (const option of [
        { value: "", label: "未選" },
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" }
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = option.label;
        button.className = (retained[item] || "") === option.value ? "selected" : "";
        button.addEventListener("click", () => {
          if (option.value) state.defaultDraft[kind][item] = option.value;
          else delete state.defaultDraft[kind][item];
          renderDefaultEditor(kind);
        });
        row.appendChild(button);
      }
      container.appendChild(row);
    });
    state.defaultDraft[kind] = retained;
  }

  function neEl(tag, cls, txt) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (txt != null) node.textContent = txt;
    return node;
  }

  function nePaintSeg(wrap, id, nz) {
    [...wrap.children].forEach((button) => {
      button.classList.remove("sel-normal", "sel-warn");
      if (button.dataset.v === neState[id]) button.classList.add(neState[id] === nz ? "sel-normal" : "sel-warn");
    });
  }

  function neSegControl(id, opts, nz) {
    if (!(id in neState)) neState[id] = nz;
    const wrap = neEl("div", "ne-opts");
    opts.forEach((option) => {
      const button = neEl("button", "ne-opt", option);
      button.type = "button";
      button.dataset.v = option;
      button.addEventListener("click", () => {
        neState[id] = option;
        nePaintSeg(wrap, id, nz);
        neRender();
        markDirty();
      });
      wrap.appendChild(button);
    });
    nePaintSeg(wrap, id, nz);
    return wrap;
  }

  function neCycControl(id, opts, nz) {
    if (!(id in neState)) neState[id] = nz;
    const wrap = neEl("div", "ne-cycwrap");
    const button = neEl("button", "ne-opt ne-cyc");
    button.type = "button";
    const update = () => {
      button.textContent = neState[id];
      button.classList.toggle("normal", neState[id] === nz);
      button.classList.toggle("warn", neState[id] !== nz);
    };
    button.addEventListener("click", () => {
      const index = opts.indexOf(neState[id]);
      neState[id] = opts[(index + 1) % opts.length];
      update();
      neRender();
      markDirty();
    });
    wrap.appendChild(button);
    update();
    return wrap;
  }

  function neBuildRow(item) {
    const row = neEl("div", "ne-row");
    const label = neEl("div", "ne-lab");
    label.innerHTML = `<b>${item.lab}</b>`;
    row.appendChild(label);
    if (item.t === "seg") {
      row.appendChild(neSegControl(item.id, item.opts, item.nz));
    } else if (item.t === "pseg" || item.t === "pcyc") {
      const pair = neEl("div", "ne-pair");
      ["R", "L"].forEach((side) => {
        const box = neEl("div", "ne-side");
        box.appendChild(neEl("div", "ne-sl", side));
        const control = item.t === "pseg"
          ? neSegControl(`${item.id}_${side}`, item.opts, item.nz)
          : neCycControl(`${item.id}_${side}`, item.opts, item.nz);
        box.appendChild(control);
        pair.appendChild(box);
      });
      row.appendChild(pair);
    }
    return row;
  }

  function neBuildUI() {
    els.neApp.replaceChildren();
    NE_SECTIONS.forEach((section) => {
      els.neApp.appendChild(neEl("h3", "ne-sec", section.title));
      const group = neEl("div", "ne-grp");
      section.items.forEach((item) => group.appendChild(neBuildRow(item)));
      els.neApp.appendChild(group);
    });
  }

  function neBuildNote() {
    const v = (id) => neState[id];
    const peLine = (id, key) => v(id) === "正常"
      ? NE_PE_NORMAL[key]
      : NE_PE_NORMAL[key].split("\n")[0].replace(/:.*/, ": *** ABNORMAL — 請於電腦補述");
    const L = [];
    L.push("身體診察(Physical Examination)");
    L.push(peLine("heent", "heent"));
    L.push(peLine("chest", "chest"));
    L.push(peLine("heart", "heart"));
    L.push(peLine("abdomen", "abdomen"));
    L.push(peLine("back", "back"));
    L.push(peLine("extremities", "extremities"));
    L.push(peLine("skin", "skin"));
    L.push("8. Neurological examinations");
    L.push("*Cranial nerve");
    L.push("CN I :   Not performed, anosmia(-), hyposmia(-), hyperosmia(-), olfactory agnosia(-)");
    L.push("CN II:   Visual acuity: " + v("cn2_va") + ", Visual fields: confrontation test: intact");
    L.push("CN III, IV, VI:");
    L.push("         Pupil: isocoric R/L: " + v("cn3_pupil_R") + "/" + v("cn3_pupil_L") + ", light reflex R/L: " + v("cn3_lr_R") + "/" + v("cn3_lr_L"));
    L.push("         EOM:");
    L.push("          0    0          0    0");
    L.push("      0 --+----+-- 0  0 --+----+-- 0");
    L.push("          0    0          0    0");
    L.push("         Primary gaze: at neutral positions without diplopia; Convergence: fair");
    L.push("         Binocular diplopia" + v("cn3_diplopia"));
    L.push("         Pursuit: smooth, Saccade: no dysmetria");
    L.push("CN V:    Corneal reflex(" + v("cn5_corneal") + ")");
    L.push("         Facial sensation: " + (v("cn5_sens") === "intact" ? "intact and symmetric to pinprick and light touch" : "*** abnormal — 請補述"));
    L.push("         Masseter R/L: full, Temporalis R/L: full");
    L.push("CN VII : " + v("cn7") + " type facial palsy");
    L.push("         Nasolabial fold shallowing(-)");
    L.push("CN VIII: Bilateral hearing ability: " + v("cn8_hear") + " by finger rubbing test");
    L.push("         Spontaneous nystagmus" + v("cn8_nyst") + "; positional nystagmus" + v("cn8_nyst"));
    L.push("CN IX,X: Uvula deviation" + v("cn910_uvula") + ", Gag reflex R/L(" + v("cn910_gag") + ")");
    L.push("CN XI:   SCM: weakness(-), atrophy(-), " + v("cn11"));
    L.push("         Trapezius: weakness(-), atrophy(-), " + v("cn11"));
    L.push("CN XII:  Tongue protruding: deviation" + v("cn12") + ", atrophy(-), fasciculation(-)");
    L.push("*Motor");
    L.push("Motor inspection: ");
    L.push("muscle wasting" + v("mi_wast") + ", fasciculation" + v("mi_fasc") + ", muscle cramps" + v("mi_cramp") + ", dystonia" + v("mi_dyst"));
    L.push("Muscle tone:");
    L.push("spasticity" + v("tone_spas") + ", rigidity" + v("tone_rig"));
    L.push("Muscle power:(R/L)");
    L.push("Upper limbs");
    L.push(" Right: shoulder " + v("mp_sh_R") + "   elbow flexion/extension " + v("mp_elbF_R") + "/" + v("mp_elbE_R") + "   wrist flexion/extension " + v("mp_wrF_R") + "/" + v("mp_wrE_R") + "   grasp " + v("mp_grasp_R"));
    L.push(" Left:  shoulder " + v("mp_sh_L") + "   elbow flexion/extension " + v("mp_elbF_L") + "/" + v("mp_elbE_L") + "   wrist flexion/extension " + v("mp_wrF_L") + "/" + v("mp_wrE_L") + "   grasp " + v("mp_grasp_L"));
    L.push("Lower limbs");
    L.push(" Right: hip flexion " + v("mp_hip_R") + " knee flexion/extension " + v("mp_kneeF_R") + "/" + v("mp_kneeE_R"));
    L.push(" ankle dorsiflextion/plantarflextion " + v("mp_ankD_R") + "/" + v("mp_ankP_R") + " big toe " + v("mp_toe_R"));
    L.push(" Left:  hip flexion " + v("mp_hip_L") + " knee flexion/extension " + v("mp_kneeF_L") + "/" + v("mp_kneeE_L"));
    L.push(" ankle dorsiflextion/plantarflextion " + v("mp_ankD_L") + "/" + v("mp_ankP_L") + " big toe " + v("mp_toe_L"));
    L.push("DTR");
    L.push("  Right: biceps: " + v("dtr_biceps_R") + ", triceps: " + v("dtr_triceps_R") + ", brachioradialis: " + v("dtr_brachio_R") + ", knee: " + v("dtr_knee_R") + ", ankle: " + v("dtr_ankle_R"));
    L.push("  Left:  biceps: " + v("dtr_biceps_L") + ", triceps: " + v("dtr_triceps_L") + ", brachioradialis: " + v("dtr_brachio_L") + ", knee: " + v("dtr_knee_L") + ", ankle: " + v("dtr_ankle_L"));
    L.push("Soft weakness sign: pronator drift test: R/L: " + v("pron_R") + "/" + v("pron_L"));
    L.push("Other reflexes: (R/L)");
    L.push("Barbinski: " + v("babinski_R") + "/" + v("babinski_L") + ", Hoffmann R/L: " + v("hoffmann_R") + "/" + v("hoffmann_L") + ", Jaw jerk: " + (v("jaw") === "(-)" ? "-" : "+"));
    L.push("Motor status:");
    L.push(" Brunnstrom's stage: ");
    L.push(" Spasticity(Modified Ashworth Scale):");
    L.push("*Sensory: ");
    L.push("Small fiber: no apparent hypesthesia or dysesthesia noted");
    L.push(" Pinprick: " + v("s_pin"));
    L.push(" Light touch: " + v("s_light"));
    L.push(" Temperature: " + v("s_temp"));
    L.push("Large fiber:");
    L.push(" Joint position test R/L: ");
    L.push(" Romberg's test" + v("s_romberg"));
    L.push("*Cerebellum/coordination:");
    L.push("1. Finger nose finger: dysmetria" + v("c_fnf"));
    L.push("2. Heel-knee-shin maneuver: dysmetria" + v("c_hks"));
    L.push("3. Rapid alternative movement: dysdiadochokinesia" + v("c_ram"));
    L.push("4. Truncal titubation" + v("c_trunc"));
    L.push("5. Tandem gait: " + v("c_tandem"));
    L.push("*Extrapyramidal system:");
    L.push("1. Mask face" + v("e_mask") + ", decreased arm swing" + v("e_arm"));
    L.push("2. Tremor: resting" + v("e_tremR") + ", action" + v("e_tremA") + ", posture" + v("e_tremP"));
    L.push("3. Rigidity" + v("e_rigid") + " : cogwheel" + v("e_rigid") + ", truncal" + v("e_rigid"));
    L.push("4. Bradykinesia" + v("e_brady"));
    L.push("5. Postural instability" + v("e_post"));
    const gait = v("e_gait") === "正常" ? "(-)" : "(+)";
    L.push("6. Gait: Initiation difficulty" + gait + ", freezing" + gait + ", shuffling" + gait + ", en bloc turning" + gait + ", Festination" + gait);
    L.push("*Autonomic nervous system:");
    L.push("1. Sphincters: urinary incontinence" + v("a_urine") + "; stool incontinence" + v("a_stool"));
    L.push("2. Postural dizziness" + v("a_dizzy") + ", orthostatic hypotension" + v("a_ortho") + ";  ");
    L.push("   palpitation" + v("a_palp") + "; excessive sweating" + v("a_sweatH") + ", less sweating" + v("a_sweatL"));
    if (v("a_3bp") === "列入") {
      L.push("3. 3 Phases BP:");
      L.push("   Lying: /()");
      L.push("   Sitting: 1min /(), 5min /()");
      L.push("   Standing: 1min /(), 5min /()");
    }
    return L.join("\n");
  }

  function neRender() {
    els.nePreview.textContent = neBuildNote();
  }

  function checklistText(kind) {
    const selections = state.current.selections[kind] || {};
    const positive = [];
    const negative = [];
    for (const item of state.settings[kind]) {
      if (selections[item] === "yes") positive.push(item);
      if (selections[item] === "no") negative.push(`no ${item}`);
    }
    const other = (kind === "complaint" ? els.complaintOther.value : els.peOther.value)
      .trim().replace(/\s+/g, " ").replace(/[.。]+$/, "");
    return [...positive, ...negative, ...(other ? [other] : [])].join(", ");
  }

  function translateAdmissionReason(value) {
    let text = String(value || "").trim().replace(/\s+/g, " ").replace(/[.。]+$/, "");
    if (!text) return "";
    const exact = new Map([
      ["接受化學治療", "admission for scheduled chemotherapy"],
      ["化學治療", "admission for scheduled chemotherapy"],
      ["接受放射治療", "admission for scheduled radiotherapy"],
      ["放射治療", "admission for scheduled radiotherapy"],
      ["接受免疫治療", "admission for scheduled immunotherapy"],
      ["免疫治療", "admission for scheduled immunotherapy"],
      ["接受標靶治療", "admission for scheduled targeted therapy"],
      ["標靶治療", "admission for scheduled targeted therapy"],
      ["接受手術", "admission for scheduled surgical treatment"],
      ["進行手術", "admission for scheduled surgical treatment"],
      ["發燒評估", "admission for evaluation of fever"],
      ["感染評估", "admission for evaluation of possible infection"],
      ["疼痛控制", "admission for pain control"],
      ["症狀控制", "admission for symptom control"],
      ["進一步檢查", "admission for further evaluation"],
      ["進一步評估", "admission for further evaluation"]
    ]);
    if (exact.has(text)) return exact.get(text);
    const replacements = [
      [/化學治療|化療/g, "chemotherapy"], [/放射治療|放療/g, "radiotherapy"],
      [/免疫治療/g, "immunotherapy"], [/標靶治療/g, "targeted therapy"],
      [/手術治療|接受手術|進行手術/g, "surgical treatment"],
      [/感染評估|評估感染/g, "evaluation of possible infection"],
      [/發燒評估|評估發燒/g, "evaluation of fever"], [/疼痛控制/g, "pain control"],
      [/症狀控制/g, "symptom control"], [/進一步檢查|進一步評估/g, "further evaluation"],
      [/治療/g, "treatment"], [/評估/g, "evaluation of"], [/疑似/g, "suspected "],
      [/復發/g, "recurrent "], [/住院/g, ""]
    ];
    replacements.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
    text = text.replace(/[，、；;]/g, ", ").replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
    if (!text) return String(value || "").trim();
    if (/[\u3400-\u9fff]/.test(text)) return `admission for ${text}`;
    return /^admission\b/i.test(text) ? text : `admission for ${text}`;
  }

  const labRules = [
    ["WBC", /\b(?:WBC|white blood cell)\b/i, 4, 10, true],
    ["Hb", /\b(?:Hb|Hgb|hemoglobin)\b/i, 12, 17],
    ["Plt", /\b(?:PLT|platelet)s?\b/i, 150, 400, true],
    ["ANC", /\bANC\b/i, 1.5, 8, true],
    ["Na", /\bNa\b/i, 135, 145], ["K", /(?:^|\s)K(?:\s|$)/i, 3.5, 5.1],
    ["UN", /\b(?:UN|BUN|urea nitrogen)\b/i, 7, 20],
    ["Cr", /\b(?:CRE|Cr|creatinine)\b/i, 0, 1.3],
    ["AST", /\bAST\b/i, 0, 40], ["ALT", /\bALT\b/i, 0, 40],
    ["T-bil", /\b(?:T[- ]?bil|total bilirubin)\b/i, 0, 1.2],
    ["D-bil", /\b(?:D[- ]?bil|direct bilirubin)\b/i, 0, .4],
    ["CRP", /\bCRP\b/i, 0, .5], ["CEA", /\bCEA\b/i, 0, 5],
    ["LDH", /\bLDH\b/i, 0, 250], ["Uric acid", /\b(?:uric acid|UA)\b/i, 2.5, 7.2]
  ];

  function parseAbnormalLabs(raw) {
    const findings = [];
    const seen = new Set();
    for (const line of String(raw || "").split(/[\n;]+/).map((item) => item.trim()).filter(Boolean)) {
      for (const [name, pattern, low, high, scaleK] of labRules) {
        if (!pattern.test(line)) continue;
        const match = line.match(/[-+]?\d+(?:\.\d+)?/);
        const value = match ? Number(match[0]) : null;
        const comparable = scaleK && value > 100 ? value / 1000 : value;
        const flagged = /(?:\b[HL]\b|↑|↓|\*|high|low|abnormal)/i.test(line);
        if (!flagged && (value === null || (comparable >= low && comparable <= high))) continue;
        const finding = value === null ? line : `${name} ${value}`;
        if (!seen.has(finding.toLowerCase())) {
          seen.add(finding.toLowerCase());
          findings.push(finding);
        }
      }
    }
    return findings.slice(0, 8).join(", ");
  }

  function buildSummary() {
    if (!els.labSummary.value.trim()) els.labSummary.value = parseAbnormalLabs(els.lab.value);
    const lines = [
      `[Symptoms] ${checklistText("complaint") || "not provided"}`,
      `[PE findings] ${checklistText("pe") || "not provided"}`,
      `[Admission reason] ${translateAdmissionReason(els.admissionReason.value) || "not provided"}`
    ];
    if (els.labSummary.value.trim()) lines.push(`[Lab findings] ${els.labSummary.value.trim()}`);
    if (els.recentStatus.value.trim()) lines.push(`[Recent status] ${els.recentStatus.value.trim()}`);
    if (els.sourceText.value.trim()) lines.push(`[Medical summary] ${els.sourceText.value.trim()}`);
    return lines.join("\n");
  }

  async function saveCurrent() {
    state.current = patientFromForm();
    await putPatient(state.current);
    const index = state.patients.findIndex((patient) => patient.id === state.current.id);
    if (index >= 0) state.patients[index] = structuredClone(state.current);
    else state.patients.push(structuredClone(state.current));
    state.dirty = false;
    els.saveState.textContent = `已儲存 ${new Date().toLocaleString()}`;
    renderPatientList();
    showToast("病人資料已儲存在此裝置");
  }

  async function createPatient() {
    if (state.dirty && !confirm("目前內容尚未儲存，確定要建立新病人嗎？")) return;
    loadPatient(blankPatient());
    showToast("已建立空白病人，完成後請按儲存");
  }

  async function saveSettings() {
    const complaint = normalizedItems(els.complaintEditor.value);
    const pe = normalizedItems(els.peEditor.value);
    const cleanDefaults = (kind, items) => Object.fromEntries(
      items.filter((item) => ["yes", "no"].includes(state.defaultDraft[kind]?.[item]))
        .map((item) => [item, state.defaultDraft[kind][item]])
    );
    state.settings = {
      complaint,
      pe,
      defaults: {
        complaint: cleanDefaults("complaint", complaint),
        pe: cleanDefaults("pe", pe)
      }
    };
    await putSettings(state.settings);
    for (const kind of ["complaint", "pe"]) {
      const allowed = new Set(state.settings[kind]);
      state.current.selections[kind] = Object.fromEntries(
        Object.entries(state.current.selections[kind] || {}).filter(([item]) => allowed.has(item))
      );
    }
    renderChecklists();
    renderSettings();
    markDirty();
    showToast("預設項目已儲存在此裝置");
  }

  async function exportBackup() {
    const patients = await getAllPatients();
    const serializable = [];
    for (const patient of patients) {
      const item = structuredClone(patient);
      if (item.pdf?.blob) {
        item.pdf.dataUrl = await blobToDataUrl(item.pdf.blob);
        delete item.pdf.blob;
      }
      serializable.push(item);
    }
    const payload = { version: 1, exportedAt: new Date().toISOString(), settings: state.settings, patients: serializable };
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `last-admission-backup-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("備份檔已下載；內含病人資料，請妥善保管");
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function dataUrlToBlob(dataUrl) {
    return fetch(dataUrl).then((response) => response.blob());
  }

  async function importBackup(file) {
    const data = JSON.parse(await file.text());
    if (data.version !== 1 || !Array.isArray(data.patients)) throw new Error("備份格式不正確");
    if (!confirm(`將匯入 ${data.patients.length} 位病人；同 ID 資料會被覆蓋。確定繼續嗎？`)) return;
    if (data.settings) {
      state.settings = data.settings;
      await putSettings(state.settings);
    }
    for (const source of data.patients) {
      const patient = structuredClone(source);
      if (patient.pdf?.dataUrl) {
        patient.pdf.blob = await dataUrlToBlob(patient.pdf.dataUrl);
        delete patient.pdf.dataUrl;
      }
      await putPatient(patient);
    }
    state.patients = await getAllPatients();
    renderSettings();
    renderPatientList();
    showToast("備份已匯入");
  }

  function renderCloud() {
    els.cloudClientId.value = state.cloud.clientId || "";
    els.cloudFolder.value = state.cloud.folderName || "Admission Summary";
  }

  async function saveCloudSettings() {
    state.cloud = {
      clientId: els.cloudClientId.value.trim(),
      folderName: els.cloudFolder.value.trim() || "Admission Summary"
    };
    await putCloud(state.cloud);
    showToast("雲端設定已儲存在此裝置");
  }

  function renderWeb() {
    els.webUrl.value = state.web.url || "";
    els.webToken.value = state.web.token || "";
  }

  async function saveWebSettings() {
    state.web = {
      url: els.webUrl.value.trim(),
      token: els.webToken.value.trim()
    };
    await putWeb(state.web);
    showToast("傳送到網頁設定已儲存在此裝置");
  }

  async function sendToWeb() {
    if (!state.web.url) {
      showToast("請先到「項目設定」填入接收網址");
      return;
    }
    if (!navigator.onLine) { showToast("目前離線，連線後才能傳送"); return; }
    const payload = {
      token: state.web.token || "",
      text: neBuildNote(),
      bed: els.bed.value.trim(),
      name: els.name.value.trim(),
      mrn: els.mrn.value.trim(),
      timestamp: new Date().toISOString()
    };
    const button = $("neSendBtn");
    const previousLabel = button.textContent;
    button.disabled = true;
    button.textContent = "傳送中…";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      await fetch(state.web.url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      showToast("已傳送到網頁（顯示頁重新整理即可看到）");
    } catch (error) {
      showToast(error.name === "AbortError" ? "傳送逾時，請檢查網路後再按一次" : `傳送失敗：${error.message}`);
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
      button.textContent = previousLabel;
    }
  }

  function loadGoogleIdentity() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (gisLoadPromise) return gisLoadPromise;
    gisLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gisLoadPromise = null;
        reject(new Error("無法載入 Google 登入元件（需連線）"));
      };
      document.head.appendChild(script);
    });
    return gisLoadPromise;
  }

  function requestAccessToken(clientId) {
    if (googleAuth.token && Date.now() < googleAuth.expiresAt - 60000) {
      return Promise.resolve(googleAuth.token);
    }
    return new Promise((resolve, reject) => {
      if (!googleAuth.client || googleAuth.clientId !== clientId) {
        googleAuth.clientId = clientId;
        googleAuth.client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: () => {}
        });
      }
      googleAuth.client.callback = (response) => {
        if (response.error) {
          reject(new Error(`Google 授權失敗：${response.error}`));
          return;
        }
        googleAuth.token = response.access_token;
        googleAuth.expiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000;
        resolve(response.access_token);
      };
      googleAuth.client.requestAccessToken();
    });
  }

  async function ensureDriveFolder(token, folderName) {
    const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`;
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`;
    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!listRes.ok) throw new Error(`查詢資料夾失敗（${listRes.status}）`);
    const listData = await listRes.json();
    if (listData.files?.length) return listData.files[0].id;
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: folderName, mimeType: "application/vnd.google-apps.folder" })
    });
    if (!createRes.ok) throw new Error(`建立資料夾失敗（${createRes.status}）`);
    return (await createRes.json()).id;
  }

  async function uploadTextToDrive(token, folderId, filename, text) {
    const boundary = `admission-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const metadata = { name: filename, parents: [folderId], mimeType: "text/plain" };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n` +
      `${text}\r\n--${boundary}--`;
    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
        body
      }
    );
    if (!res.ok) throw new Error(`上傳失敗（${res.status}）`);
    return res.json();
  }

  function buildUploadName() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const base = [els.bed.value, els.name.value, els.mrn.value]
      .map((part) => part.trim()).filter(Boolean).join("_")
      .replace(/[\\/:*?"<>|]+/g, "-") || "summary";
    return `${base}_${stamp}.txt`;
  }

  async function uploadToCloud() {
    if (!els.output.value.trim()) els.output.value = buildSummary();
    const text = els.output.value.trim();
    if (!text) { showToast("沒有可上傳的內容"); return; }
    if (!state.cloud.clientId) {
      showToast("請先到「項目設定」填入 Google Client ID");
      return;
    }
    if (!navigator.onLine) { showToast("目前離線，連線後才能上傳"); return; }
    const previousLabel = els.uploadBtn.textContent;
    els.uploadBtn.disabled = true;
    els.uploadBtn.textContent = "上傳中…";
    try {
      await loadGoogleIdentity();
      const token = await requestAccessToken(state.cloud.clientId);
      const folderId = await ensureDriveFolder(token, state.cloud.folderName || "Admission Summary");
      const result = await uploadTextToDrive(token, folderId, buildUploadName(), text);
      showToast(`已上傳到 Google Drive：${result.name}`);
    } catch (error) {
      googleAuth.token = "";
      googleAuth.expiresAt = 0;
      showToast(`上傳失敗：${error.message}`);
    } finally {
      els.uploadBtn.disabled = false;
      els.uploadBtn.textContent = previousLabel;
    }
  }

  function bindEvents() {
    document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === button.dataset.tab));
    }));
    $("newPatientBtn").addEventListener("click", createPatient);
    $("savePatientBtn").addEventListener("click", saveCurrent);
    $("saveSettingsBtn").addEventListener("click", saveSettings);
    $("saveCloudBtn").addEventListener("click", saveCloudSettings);
    $("saveWebBtn").addEventListener("click", saveWebSettings);
    $("neSendBtn").addEventListener("click", sendToWeb);
    els.uploadBtn.addEventListener("click", uploadToCloud);
    $("neResetBtn").addEventListener("click", () => {
      if (!confirm("將所有神經學檢查重設為正常預設？")) return;
      neState = {};
      neBuildUI();
      neRender();
      markDirty();
      showToast("已重設為全部正常");
    });
    $("neCopyBtn").addEventListener("click", async () => {
      await navigator.clipboard.writeText(neBuildNote());
      showToast("神經學檢查病歷已複製");
    });
    $("summarizeBtn").addEventListener("click", () => {
      els.output.value = buildSummary();
      markDirty();
      showToast("已依目前勾選完成統整");
    });
    $("copyBtn").addEventListener("click", async () => {
      if (!els.output.value.trim()) els.output.value = buildSummary();
      await navigator.clipboard.writeText(els.output.value);
      showToast("統整結果已複製");
    });
    $("clearBtn").addEventListener("click", () => {
      if (!confirm("清除目前病人的勾選與本次輸入內容？")) return;
      const identity = { bed: els.bed.value, name: els.name.value, mrn: els.mrn.value };
      const clean = blankPatient();
      clean.id = state.current.id;
      clean.createdAt = state.current.createdAt;
      Object.assign(clean, identity);
      loadPatient(clean);
      markDirty();
    });
    els.patientSearch.addEventListener("input", renderPatientList);
    els.complaintEditor.addEventListener("input", () => renderDefaultEditor("complaint"));
    els.peEditor.addEventListener("input", () => renderDefaultEditor("pe"));
    els.lab.addEventListener("blur", () => {
      if (!els.labSummary.value.trim()) els.labSummary.value = parseAbnormalLabs(els.lab.value);
    });
    els.pdfInput.addEventListener("change", () => {
      const file = els.pdfInput.files?.[0];
      if (!file) return;
      if (file.type && file.type !== "application/pdf") return showToast("請選擇 PDF 檔案");
      state.current.pdf = { name: file.name, blob: file, addedAt: Date.now() };
      renderPdf();
      markDirty();
    });
    els.removePdf.addEventListener("click", () => {
      state.current.pdf = null;
      renderPdf();
      markDirty();
    });
    $("exportBtn").addEventListener("click", exportBackup);
    $("importInput").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try { await importBackup(file); } catch (error) { showToast(`匯入失敗：${error.message}`); }
      event.target.value = "";
    });
    document.querySelectorAll("input, textarea").forEach((element) => {
      if ([els.patientSearch, els.pdfInput, els.complaintEditor, els.peEditor, els.cloudClientId, els.cloudFolder, els.webUrl, els.webToken, $("importInput")].includes(element)) return;
      element.addEventListener("input", markDirty);
    });
    window.addEventListener("beforeunload", (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  async function init() {
    state.db = await openDatabase();
    const savedSettings = await getSettings();
    if (savedSettings?.value) state.settings = savedSettings.value;
    const savedCloud = await getCloud();
    if (savedCloud?.value) state.cloud = { ...state.cloud, ...savedCloud.value };
    const savedWeb = await getWeb();
    if (savedWeb?.value) state.web = { ...state.web, ...savedWeb.value };
    state.patients = await getAllPatients();
    renderSettings();
    renderCloud();
    renderWeb();
    bindEvents();
    if (state.patients.length) {
      loadPatient([...state.patients].sort((a, b) => b.updatedAt - a.updatedAt)[0]);
    } else {
      loadPatient(blankPatient());
    }
    renderPatientList();
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  init().catch((error) => {
    console.error(error);
    showToast(`啟動失敗：${error.message}`);
  });
})();
