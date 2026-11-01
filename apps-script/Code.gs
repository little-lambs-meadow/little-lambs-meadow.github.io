// 小羊樂園 雲端資料庫（Google Apps Script）
// 每一筆資料（課程、孩子、點數…）存成「records」工作表的一列，app 每 3 秒同步一次。
// 打開試算表時，會自動整理出好讀的「孩子點數」「點數明細」「課程」「上課紀錄」「會議記錄」分頁。

var SHEET = 'records';

function doGet() { return out({ ok: true, app: 'little-lambs-meadow' }); }
function doPost(e) {
  var p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, err: 'bad' }); }
  var props = PropertiesService.getScriptProperties();
  var pw = props.getProperty('PASSWORD');
  if (p.op === 'init') {
    if (pw) return out({ ok: false, err: 'already' });
    if (!p.newpw || String(p.newpw).length < 4) return out({ ok: false, err: 'short' });
    props.setProperty('PASSWORD', String(p.newpw));
    return out({ ok: true });
  }
  if (!pw) return out({ ok: false, err: 'noinit' });
  if (p.pw !== pw) return out({ ok: false, err: 'pw' });
  if (p.op === 'setpw') {
    if (!p.newpw || String(p.newpw).length < 4) return out({ ok: false, err: 'short' });
    props.setProperty('PASSWORD', String(p.newpw));
    return out({ ok: true });
  }
  if (p.op === 'sync') return out(sync(p));
  return out({ ok: false, err: 'op' });
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(SHEET);
  if (!s) { s = ss.insertSheet(SHEET); s.appendRow(['key', 'json', 'ver', 'by', 'time']); s.setFrozenRows(1); }
  return s;
}
function curVer() {
  var c = CacheService.getScriptCache().get('VER');
  if (c !== null) return Number(c);
  return Number(PropertiesService.getScriptProperties().getProperty('VER') || 0);
}

function sync(p) {
  var since = Number(p.since || 0);
  var recs = p.recs || [];
  if (recs.length) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var s = sheet();
      var ver = Number(PropertiesService.getScriptProperties().getProperty('VER') || 0) + 1;
      var last = s.getLastRow();
      var keys = last > 1 ? s.getRange(2, 1, last - 1, 1).getValues() : [];
      var row = {};
      for (var i = 0; i < keys.length; i++) row[keys[i][0]] = i + 2;
      var now = new Date(), appendRows = [];
      for (var j = 0; j < recs.length; j++) {
        var r = recs[j], vals = [r.k, r.j === null ? '' : r.j, ver, p.by || '', now];
        if (row[r.k]) s.getRange(row[r.k], 1, 1, 5).setValues([vals]);
        else { appendRows.push(vals); row[r.k] = -1; }
      }
      if (appendRows.length) s.getRange(s.getLastRow() + 1, 1, appendRows.length, 5).setValues(appendRows);
      PropertiesService.getScriptProperties().setProperty('VER', String(ver));
      CacheService.getScriptCache().put('VER', String(ver), 21600);
    } finally { lock.releaseLock(); }
  }
  var cv = curVer();
  if (since >= cv) return { ok: true, ver: cv, recs: [] };
  var s2 = sheet(), n = s2.getLastRow();
  var data = n > 1 ? s2.getRange(2, 1, n - 1, 3).getValues() : [];
  var res = [];
  for (var k = 0; k < data.length; k++) {
    var v = Number(data[k][2]);
    if (v > since) {
      if (data[k][1] === '' && since === 0) continue;
      res.push({ k: data[k][0], j: data[k][1] === '' ? null : String(data[k][1]) });
    }
  }
  return { ok: true, ver: cv, recs: res };
}

// ---------- 好讀的報表（打開試算表時自動更新，也可以從選單手動更新） ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🐑 小羊樂園').addItem('更新報表', 'buildReports').addToUi();
  try { buildReports(); } catch (e) {}
}
function buildReports() {
  var s = sheet(), n = s.getLastRow();
  var data = n > 1 ? s.getRange(2, 1, n - 1, 2).getValues() : [];
  var C = {};
  data.forEach(function (r) {
    if (r[1] === '') return;
    var col = String(r[0]).split('/')[0];
    try { (C[col] = C[col] || []).push(JSON.parse(r[1])); } catch (e) {}
  });
  var kids = C.kids || [], ledger = C.ledger || [], attend = C.attend || [];
  var name = {}; kids.forEach(function (k) { name[k.id] = k.name; });
  var tot = {}, cnt = {};
  ledger.forEach(function (x) { tot[x.kidId] = (tot[x.kidId] || 0) + Number(x.pts || 0); });
  attend.forEach(function (a) { cnt[a.k] = (cnt[a.k] || 0) + 1; });
  write('孩子點數', ['稱呼', '累計點數', '報到次數', '狀態'],
    kids.map(function (k) { return [k.name, tot[k.id] || 0, cnt[k.id] || 0, k.active === false ? '已隱藏' : '']; })
      .sort(function (a, b) { return b[1] - a[1]; }));
  write('點數明細', ['日期', '孩子', '項目', '點數', '記錄者'],
    ledger.map(function (x) { return [x.date, name[x.kidId] || '（已刪除）', x.reason, x.pts, x.by]; })
      .sort(function (a, b) { return a[0] < b[0] ? 1 : -1; }));
  write('課程', ['季', '第幾課', '日期', '課名', '經文', '中文金句', '英文金句', '影片'],
    (C.lessons || []).map(function (l) { return [l.season, l.no, l.date, l.title, l.scripture, l.verseZh, l.verseEn, l.video]; }));
  var lt = {}; (C.lessons || []).forEach(function (l) { lt[l.id] = l.title; });
  write('上課紀錄', ['日期', '課程', '上課老師', '出席人數', '整體狀況', '交接'],
    (C.sessions || []).map(function (x) { return [x.date, lt[x.lessonId] || '', (x.teachers || []).join('、'), (x.attendance || []).length, x.overall, x.handover]; })
      .sort(function (a, b) { return a[0] < b[0] ? 1 : -1; }));
  var mt = {}, ag = {};
  (C.meetings || []).forEach(function (m) { mt[m.id] = m; (m.agenda || []).forEach(function (a) { ag[a.id] = a.title; }); });
  write('會議記錄', ['日期', '會議', '議程', '類型', '內容', '負責人', '期限', '輸入者'],
    (C.mentries || []).filter(function (e) { return mt[e.mid]; })
      .map(function (e) { var m = mt[e.mid]; return [m.date, m.title, ag[e.aid] || '', e.type, e.text, e.owner || '', e.due || '', e.by]; })
      .sort(function (a, b) { return a[0] < b[0] ? 1 : -1; }));
}
function write(title, head, rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(title) || ss.insertSheet(title);
  s.clearContents();
  s.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#fde8df');
  if (rows.length) s.getRange(2, 1, rows.length, head.length).setValues(rows);
  s.setFrozenRows(1);
}
