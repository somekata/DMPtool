'use strict';

/**
 * Paper md Builder
 * - Predefined fields → localStorage autosave
 * - Import existing md (tool format) → restore form → update
 * - Import PubMed NBIB → prefill form (title/author/journal/date/doi/pmid)
 *   - Normalize multiline/whitespace in TI/JT/TA etc. to avoid "long spaces"
 * - Generate md → download → clear localStorage
 */

const LS_KEY = 'paper_md_builder_draft_v1';

const FIELDS = [
  'fileBase',
  'paperTitle',
  'paperShort',
  'authors',
  'firstAuthor',
  'lastAuthor',
  'correspondingAuthor',
  'journal',
  'pubDate',
  'volumeIssue',
  'so',
  'doiPmid',
  'project',
  'collab',
  'ngsRawPath',
  'ngsProcessedPath',
  'paperFolderPath',
  'figStatsPath',
  'notebookRef',
  'irb',
  'retention',
  'notes',
];

const el = (id) => document.getElementById(id);

// ---------- Text normalization (NEW) ----------
function normalizeInlineText(s) {
  // Replace any whitespace runs (including newlines) with single spaces
  return (s ?? '').toString().replace(/\s+/g, ' ').trim();
}

function normalizeVolIssuePages(s){
  const t = (s || '').replace(/\s+/g,'').trim();
  return t;
}

// ---------- UI helper ----------
function autoGrowTextarea(id){
  const t = document.getElementById(id);
  if(!t) return;

  // 初期高さ調整
  t.style.height = 'auto';
  t.style.height = t.scrollHeight + 'px';

  t.addEventListener('input', function(){
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
  });
}

// ---------- Core form ----------
function getFormData() {
  const data = {};
  for (const k of FIELDS) {
    const node = el(k);
    data[k] = (node?.value ?? '').toString().trim();
  }

  // 巻(号):ページの特殊正規化
  data.volumeIssue = normalizeVolIssuePages(data.volumeIssue);

  return data;
}

function setFormData(data) {
  for (const k of FIELDS) {
    if (!el(k)) continue;
    el(k).value = (data?.[k] ?? '').toString();
  }
}

function saveDraft() {
  const data = getFormData();
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function loadDraft() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    setFormData(data);
  } catch {
    // ignore broken draft
  }
}

function clearDraft() {
  localStorage.removeItem(LS_KEY);
}

function updateDownloadButtonVisibility() {
  const base = el('fileBase')?.value?.trim() ?? '';
  const area = el('downloadArea');
  if (!area) return;
  area.classList.toggle('hidden', base.length === 0);
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ---------- md build ----------
function buildMd(data) {
  const updated = todayISO();
  const yaml = [
    '---',
    'tool: paper-md-builder',
    'version: 1.001',
    `fileBase: "${escapeYaml(data.fileBase)}"`,
    `paperTitle: "${escapeYaml(data.paperTitle)}"`,
    `paperShort: "${escapeYaml(data.paperShort)}"`,
    `authors: "${escapeYaml(data.authors)}"`,
    `firstAuthor: "${escapeYaml(data.firstAuthor)}"`,
    `lastAuthor: "${escapeYaml(data.lastAuthor)}"`,
    `correspondingAuthor: "${escapeYaml(data.correspondingAuthor)}"`,
    `journal: "${escapeYaml(data.journal)}"`,
    `pubDate: "${escapeYaml(data.pubDate)}"`,
    `volumeIssue: "${escapeYaml(data.volumeIssue)}"`,
    `so: "${escapeYaml(data.so)}"`,
    `doiPmid: "${escapeYaml(data.doiPmid)}"`,
    `project: "${escapeYaml(data.project)}"`,
    `collab: "${escapeYaml(data.collab)}"`,
    `ngsRawPath: "${escapeYaml(data.ngsRawPath)}"`,
    `ngsProcessedPath: "${escapeYaml(data.ngsProcessedPath)}"`,
    `paperFolderPath: "${escapeYaml(data.paperFolderPath)}"`,
    `figStatsPath: "${escapeYaml(data.figStatsPath)}"`,
    'notebookRef: |',
    indentBlock(data.notebookRef || '', 2),
    `irb: "${escapeYaml(data.irb)}"`,
    `retention: "${escapeYaml(data.retention)}"`,
    'notes: |',
    indentBlock(data.notes || '', 2),
    '---',
  ].join('\n');

  const body = [
    `# ${data.paperTitle || data.fileBase || 'Paper record'}`,
    '',
    '## 基本情報',
    `- ファイル名: ${safeDash(data.fileBase)}`,
    `- 略称: ${safeDash(data.paperShort)}`,
    `- 著者: ${safeDash(data.authors)}`,
    `- 筆頭著者: ${safeDash(data.firstAuthor)}`,
    `- 最終著者: ${safeDash(data.lastAuthor)}`,
    `- 責任著者: ${safeDash(data.correspondingAuthor)}`,
    `- 雑誌名: ${safeDash(data.journal)}`,
    `- 公開日: ${safeDash(data.pubDate)}`,
    `- 巻(号):ページ: ${safeDash(data.volumeIssue)}`,
    `- ソース: ${safeDash(data.so)}`,
    `- DOI/PMID: ${safeDash(data.doiPmid)}`,
    `- 関連プロジェクト: ${safeDash(data.project)}`,
    `- 共同研究: ${safeDash(data.collab)}`,
    '',
    '## データ所在',
    `- 論文フォルダ: ${safeDash(data.paperFolderPath)}`,
    `- 図表・統計データ: ${safeDash(data.figStatsPath)}`,
    `- NGS Raw保存場所（参照）: ${safeDash(data.ngsRawPath)}`,
    `- NGS 解析後データ保存場所: ${safeDash(data.ngsProcessedPath)}`,

    '',
    '## 実験ノート',
    `- ノート番号/ページ: ${safeDash(data.notebookRef)}`,
    '',
    '## 倫理・保管',
    `- IRB/倫理: ${safeDash(data.irb)}`,
    `- 保管期限: ${safeDash(data.retention)}`,
    '',
    '## メモ',
    data.notes?.trim() ? data.notes.trim() : '-',
    '',
    `---`,
    `最終更新: ${updated}`,
  ].join('\n');

  return `${yaml}\n\n${body}\n`;
}

function safeDash(v) {
  const s = (v ?? '').toString().trim();
  return s.length ? s : '-';
}

function escapeYaml(v) {
  return (v ?? '').toString().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function indentBlock(text, spaces = 2) {
  const pad = ' '.repeat(spaces);
  const lines = (text ?? '').toString().split('\n');
  if (lines.length === 0) return `${pad}\n`;
  return lines.map((l) => `${pad}${l}`).join('\n');
}

function updatePreview() {
  const data = getFormData();
  const md = buildMd(data);
  const pv = el('preview');
  if (pv) pv.textContent = md;
}

function downloadMd() {
  const data = getFormData();
  const base = (data.fileBase ?? '').trim();
  if (!base) {
    alert('ファイル名（必須）を入力してください。');
    return;
  }

  const md = buildMd(data);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${base}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  clearDraft();
  setFormData({});
  updateDownloadButtonVisibility();
  updatePreview();

  alert('mdをダウンロードし、下書きを消去しました。');
}

// ---------- md import ----------
function parseYamlFrontMatter(mdText) {
  const m = mdText.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) return null;
  const yaml = m[1];

  const obj = {};
  const lines = yaml.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const notesMatch = line.match(/^notes:\s*\|\s*$/);
    if (notesMatch) {
      i++;
      const noteLines = [];
      while (
        i < lines.length &&
        (lines[i].startsWith('  ') || lines[i] === '')
      ) {
        noteLines.push(lines[i].startsWith('  ') ? lines[i].slice(2) : lines[i]);
        i++;
      }
      obj.notes = noteLines.join('\n').replace(/\n+$/, '');
      continue;
    }

    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)\s*$/);
    if (kv) {
      const key = kv[1];
      let val = kv[2] ?? '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      obj[key] = val;
    }
    i++;
  }

  return obj;
}

async function loadMdFile() {
  const file = el('mdFile')?.files?.[0];
  if (!file) {
    alert('mdファイルを選択してください。');
    return;
  }
  const text = await file.text();
  const fm = parseYamlFrontMatter(text);

  if (!fm || fm.tool !== 'paper-md-builder') {
    alert('このツール形式のmdではありません（YAMLフロントマターが一致しません）。');
    return;
  }

  const data = {
    fileBase: fm.fileBase ?? '',
    paperTitle: fm.paperTitle ?? '',
    paperShort: fm.paperShort ?? '',
    authors: fm.authors ?? '',
    firstAuthor: fm.firstAuthor ?? '',
    lastAuthor: fm.lastAuthor ?? '',
    correspondingAuthor: fm.correspondingAuthor ?? '',
    journal: fm.journal ?? '',
    pubDate: fm.pubDate ?? '',
    volumeIssue: fm.volumeIssue ?? '',
    so: fm.so ?? '',
    doiPmid: fm.doiPmid ?? '',
    project: fm.project ?? '',
    collab: fm.collab ?? '',
    ngsRawPath: fm.ngsRawPath ?? '',
    ngsProcessedPath: fm.ngsProcessedPath ?? '',
    paperFolderPath: fm.paperFolderPath ?? '',
    figStatsPath: fm.figStatsPath ?? '',
    notebookRef: fm.notebookRef ?? '',
    irb: fm.irb ?? '',
    retention: fm.retention ?? '',
    notes: fm.notes ?? '',
  };

  setFormData(data);
  saveDraft();
  updateDownloadButtonVisibility();
  updatePreview();

  alert('mdを読み込み、フォームに反映しました。');
}

// ---------- NBIB import ----------
let NBIB_RECORDS = []; // [{fields, label}]
let NBIB_INDEX = 0;

function setNbibStatus(type, text) {
  const pill = el('nbibStatus');
  if (!pill) return;
  pill.className = `pill ${type || ''}`.trim();
  pill.textContent = text;
}

function splitNBIB(text) {
  const t = (text ?? '').toString().replace(/\r\n/g, '\n').trim();
  if (!t) return [];
  const chunks = t.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (chunks.length === 1 && (t.match(/^PMID-/gm) || []).length > 1) {
    return t.split(/(?=^PMID-\s)/m).map((s) => s.trim()).filter(Boolean);
  }
  return chunks;
}

function parseNBIBRecord(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const map = {};
  let curTag = null;
  const tagRe = /^([A-Z0-9]{2,5})\s*-\s(.*)$/;

  for (const line of lines) {
    const m = line.match(tagRe);
    if (m) {
      curTag = m[1];
      const val = m[2] ?? '';
      if (!map[curTag]) map[curTag] = [];
      map[curTag].push(val);
    } else {
      if (curTag && map[curTag]?.length) {
        map[curTag][map[curTag].length - 1] += '\n' + line;
      }
    }
  }

  // Normalize inline text to avoid "long spaces" from line wraps
  const title = normalizeInlineText(firstNonEmpty(map.TI));
  const authors = (map.AU || []).map((s) => normalizeInlineText(s)).filter(Boolean);
  const authorsStr = authors.join(', ') ;
  const firstAuthor = normalizeInlineText(authors[0] || '');
  const lastAuthor = normalizeInlineText(authors[authors.length - 1] || '');
  const journal = normalizeInlineText(firstNonEmpty(map.TA) || firstNonEmpty(map.JT) || '');

  const dp = normalizeInlineText(firstNonEmpty(map.DP) || '');
  const pubDate = normalizeDP(dp);
  const volume = normalizeInlineText(firstNonEmpty(map.VI) || '');
  const issue = normalizeInlineText(firstNonEmpty(map.IP) || '');
  const pages = normalizeInlineText(firstNonEmpty(map.PG) || '');

  let volumeIssue = '';
  if (volume) {
    volumeIssue = volume;
    if (issue) volumeIssue += `(${issue})`;
    if (pages) volumeIssue += `:${pages}`;
  } else if (pages) {
    // 巻が無い特殊ケース
    volumeIssue = pages;
  }

  const so = normalizeInlineText(firstNonEmpty(map.SO) || '');

  const pmid = normalizeInlineText(firstNonEmpty(map.PMID) || '');
  const doi = normalizeInlineText(extractDOI(map));
  const doiPmid = normalizeInlineText(joinDoiPmid(pmid, doi));

  const fields = { title, authors: authorsStr, firstAuthor, lastAuthor, journal, pubDate, volumeIssue, so, pmid, doi, doiPmid };
  const label = buildNbibLabel(fields);
  return { fields, label };
}

function firstNonEmpty(arr) {
  if (!arr || !arr.length) return '';
  for (const v of arr) {
    const s = (v ?? '').toString().trim();
    if (s) return s;
  }
  return '';
}

function extractDOI(map) {
  const lids = (map.LID || []).concat(map.AID || []);
  for (const v of lids) {
    const s = (v ?? '').toString();
    const m = s.match(/(10\.\d{4,9}\/[^\s\]]+)/);
    if (m) return m[1];
  }
  return '';
}

function joinDoiPmid(pmid, doi) {
  const parts = [];
  const p = (pmid ?? '').toString().trim().replace(/\s+/g, '');
  if (p) parts.push(`pmid:${p}`);
  const d = (doi ?? '').toString().trim();
  if (d) parts.push(`doi:${d}`);
  return parts.join('; ');
}

function monthToMM(mon) {
  const key = (mon ?? '').toString().toLowerCase().slice(0, 3);
  const map = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };
  return map[key] || '';
}

function normalizeDP(dp) {
  const s = normalizeInlineText(dp);
  if (!s) return '';
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(s) ||
    /^\d{4}-\d{2}$/.test(s) ||
    /^\d{4}$/.test(s)
  )
    return s;

  const m = s.match(/^(\d{4})\s+([A-Za-z]{3,})\s*(\d{1,2})?/);
  if (m) {
    const yyyy = m[1];
    const mm = monthToMM(m[2]);
    const dd = m[3];
    if (!mm) return yyyy;
    if (dd)
      return `${yyyy}-${mm}-${String(parseInt(dd, 10)).padStart(2, '0')}`;
    return `${yyyy}-${mm}`;
  }

  const y = s.match(/(\d{4})/);
  return y ? y[1] : '';
}

function buildNbibLabel(f) {
  const t = normalizeInlineText(f.title || '');
  const shortT = t ? (t.length > 70 ? t.slice(0, 70) + '…' : t) : '(no title)';
  const id = f.pmid
    ? `PMID ${normalizeInlineText(f.pmid)}`
    : f.doi
    ? `DOI ${normalizeInlineText(f.doi)}`
    : 'no id';
  return `${shortT} — ${id}`;
}

function renderNbibSelect() {
  const sel = el('nbibRecordSelect');
  if (!sel) return;
  sel.innerHTML = '';
  NBIB_RECORDS.forEach((r, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = `#${idx + 1} ${r.label}`;
    sel.appendChild(opt);
  });
  sel.disabled = NBIB_RECORDS.length === 0;
  if (NBIB_RECORDS.length > 0) {
    NBIB_INDEX = 0;
    sel.value = '0';
  }
  const applyBtn = el('btnApplyNbib');
  if (applyBtn) applyBtn.disabled = NBIB_RECORDS.length === 0;
}

function renderNbibPreview(fields) {
  const set = (id, v) => {
    const node = el(id);
    if (node) node.textContent = v && v.trim() ? v : '-';
  };
  set('pvTitle', fields?.title || '');
  set('pvAuthor', fields?.firstAuthor || '');
  set('pvJournal', fields?.journal || '');
  set('pvDate', fields?.pubDate || '');
  set('pvIds', fields?.doiPmid || '');
}

async function loadNbibFile() {
  const file = el('nbibFile')?.files?.[0];
  if (!file) {
    alert('NBIBファイル（.nbib / .txt）を選択してください。');
    return;
  }

  setNbibStatus('warn', '解析中…');

  let text = '';
  try {
    text = await file.text();
  } catch {
    setNbibStatus('bad', '失敗');
    alert('ファイルを読み込めませんでした。');
    return;
  }

  const chunks = splitNBIB(text);
  NBIB_RECORDS = chunks.map(parseNBIBRecord).filter((r) => r?.fields);

  if (NBIB_RECORDS.length === 0) {
    setNbibStatus('bad', '失敗');
    alert('NBIB形式のレコードが見つかりませんでした（PMID-/TI  - などを含むか確認）。');
    return;
  }

  renderNbibSelect();
  renderNbibPreview(NBIB_RECORDS[0].fields);
  setNbibStatus('good', `解析OK（${NBIB_RECORDS.length}件）`);
}

function suggestFileBaseFromFields(fields) {
  const year = (fields.pubDate || '').slice(0, 4);
  const fa = (fields.firstAuthor || '')
    .split(/\s+/)[0]
    .replace(/[^\w\-]/g, '');
  const j = (fields.journal || '').replace(/[^\w\-]/g, '');
  if (year && fa && j) return `${year}_${fa}_${j}`.slice(0, 80);
  if (year && fa) return `${year}_${fa}`.slice(0, 80);
  return '';
}

function applyNbibToForm() {
  if (!NBIB_RECORDS.length) {
    alert('先にNBIBを解析してください。');
    return;
  }
  const fields = NBIB_RECORDS[NBIB_INDEX].fields;

  const cur = getFormData();

  // Fill bibliographic fields only (normalize again just in case)
  cur.paperTitle = normalizeInlineText(fields.title) || cur.paperTitle;
  cur.authors = normalizeInlineText(fields.authors) || cur.authors;
  cur.firstAuthor = normalizeInlineText(fields.firstAuthor) || cur.firstAuthor;
  cur.lastAuthor = normalizeInlineText(fields.lastAuthor) || cur.lastAuthor;
  cur.journal = normalizeInlineText(fields.journal) || cur.journal;
  cur.pubDate = normalizeInlineText(fields.pubDate) || cur.pubDate;
  cur.volumeIssue = normalizeInlineText(fields.volumeIssue) || cur.volumeIssue;
  cur.so = normalizeInlineText(fields.so) || cur.so;

  // doiPmid merge
  const incoming = normalizeInlineText(fields.doiPmid || '');
  if (incoming) {
    if (!cur.doiPmid) {
      cur.doiPmid = incoming;
    } else if (!cur.doiPmid.includes(incoming)) {
      cur.doiPmid = `${cur.doiPmid}; ${incoming}`.replace(/;\s*;/g, ';').trim();
      cur.doiPmid = normalizeInlineText(cur.doiPmid);
    }
  }

  // Suggest fileBase only if empty
  /*if (!cur.fileBase) {
    const sug = suggestFileBaseFromFields(fields);
    if (sug) cur.fileBase = sug;
  }
  自動取得のコードを削除
  */

  setFormData(cur);
  saveDraft();
  updateDownloadButtonVisibility();
  updatePreview();

  alert('NBIB情報をフォームに反映しました。');
}

function clearNbibUI() {
  NBIB_RECORDS = [];
  NBIB_INDEX = 0;

  const f = el('nbibFile');
  if (f) f.value = '';

  const sel = el('nbibRecordSelect');
  if (sel) {
    sel.innerHTML = '';
    sel.disabled = true;
  }

  const applyBtn = el('btnApplyNbib');
  if (applyBtn) applyBtn.disabled = true;

  renderNbibPreview(null);
  setNbibStatus('', '未解析');
}

// ---------- Autosave ----------
function wireAutosave() {
  const form = el('paperForm');
  if (!form) return;
  form.addEventListener('input', () => {
    saveDraft();
    updateDownloadButtonVisibility();
  });
}

// ---------- Init ----------
function init() {
  loadDraft();
  wireAutosave();
  updateDownloadButtonVisibility();
  updatePreview();

  autoGrowTextarea('paperTitle');

  el('btnPreview')?.addEventListener('click', updatePreview);
  el('btnDownload')?.addEventListener('click', downloadMd);
  el('btnClearDraft')?.addEventListener('click', () => {
    if (confirm('下書きを消去します（LocalStorage）。よろしいですか？')) {
      clearDraft();
      setFormData({});
      updateDownloadButtonVisibility();
      updatePreview();
    }
  });

  // md import
  el('btnLoadMd')?.addEventListener('click', loadMdFile);

  // nbib import
  el('btnLoadNbib')?.addEventListener('click', loadNbibFile);
  el('btnApplyNbib')?.addEventListener('click', applyNbibToForm);
  el('btnClearNbib')?.addEventListener('click', clearNbibUI);

  el('nbibRecordSelect')?.addEventListener('change', () => {
    NBIB_INDEX = parseInt(el('nbibRecordSelect')?.value ?? '0', 10) || 0;
    renderNbibPreview(NBIB_RECORDS[NBIB_INDEX]?.fields || null);
  });
}

document.addEventListener('DOMContentLoaded', init);