/* complaints.js — الشكاوى والمقترحات
   أي منتسبة تقدّم شكوى/مقترح موجَّهاً لجهة محددة (مكتب الخدمات، المديرة،
   أو إحدى المساعدتين بالاسم من الإعدادات). الجهة المعنية تتابعها: تكتب
   الإجراء، تحدّث الحالة، وتتصدَّر القائمة أو إحصائية شهرية أي وقت. */
import { db, $, S, clean, toast, bindDrop, printWithTitle, printHeaderHtml, printFooterHtml, registerTab } from './core.js';

const BUCKET='school-files';
const STATUS_LABEL={new:'جديدة', in_progress:'يجرى المتابعة', done:'تمت المتابعة'};
const TYPE_LABEL={complaint:'شكوى', suggestion:'مقترح'};

function recipientOptions(){
  return [
    {v:'services', label:'مكتب الخدمات'},
    {v:'principal', label:`المديرة${S.SETTINGS.principal_name?' — '+S.SETTINGS.principal_name:''}`},
    {v:'deputy1', label:`المديرة المساعدة ١${S.SETTINGS.deputy1_name?' — '+S.SETTINGS.deputy1_name:''}`},
    {v:'deputy2', label:`المديرة المساعدة ٢${S.SETTINGS.deputy2_name?' — '+S.SETTINGS.deputy2_name:''}`},
  ];
}
function recipientLabel(v){ return recipientOptions().find(o=>o.v===v)?.label || v; }

/* ============ تقديم شكوى / مقترح (الجميع) ============ */
$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="complaintsSubmit" style="display:none">
  <div class="panel">
    <h3>تقديم شكوى أو مقترح</h3>
    <div class="row" style="display:flex;gap:20px;margin-bottom:14px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="radio" name="csType" value="complaint" checked> شكوى</label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="radio" name="csType" value="suggestion"> مقترح</label>
    </div>
    <div class="field"><label>موجّهة إلى</label><select id="csRecipient"></select></div>
    <div class="field"><label>العنوان</label><input type="text" id="csTitle" placeholder="عنوان مختصر"></div>
    <div class="field"><label>الوصف</label><textarea id="csDesc" rows="5" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:8px;font:inherit"></textarea></div>
    <div class="dropzone" id="csDrop"><b id="csFileLabel">مرفق (اختياري) — ملف أو صورة</b><p>اضغطي لاختيار الملف</p>
      <input type="file" id="csFile" hidden></div>
    <button class="btn gold" id="csSend" style="width:auto;padding:11px 26px;margin-top:14px">إرسال</button>
  </div>
  <div class="panel">
    <h3>شكاواي ومقترحاتي السابقة</h3>
    <div id="csMyList"></div>
  </div>
</div>
<style>
  .cs-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;background:var(--white);border:1px solid var(--line);border-radius:11px;padding:12px 16px;margin-bottom:8px;flex-wrap:wrap}
  .cs-badge{font-size:11px;padding:3px 10px;border-radius:99px;font-weight:700}
  .cs-badge.new{background:#fff3cd;color:#8a6100}
  .cs-badge.in_progress{background:#dbeafe;color:#1d4ed8}
  .cs-badge.done{background:#d7ecd9;color:#166534}
  .cs-type{font-size:11px;padding:3px 10px;border-radius:99px;background:#eef1f5;color:var(--navy);font-weight:700}
</style>`);

let MY_FILE=null;

async function initSubmit(){
  if($('csSend').dataset.ready) return;
  $('csSend').dataset.ready='1';
  $('csRecipient').innerHTML=recipientOptions().map(o=>`<option value="${o.v}">${o.label}</option>`).join('');
  bindDrop($('csDrop'),$('csFile'),f=>{ MY_FILE=f; $('csFileLabel').textContent=`مرفق: ${f.name}`; });
  $('csSend').addEventListener('click',submitComplaint);
  loadMyComplaints();
}

async function submitComplaint(){
  const title=clean($('csTitle').value);
  if(!title){ toast('اكتبي عنواناً'); return; }
  const type=document.querySelector('input[name="csType"]:checked').value;
  const recipient=$('csRecipient').value;
  const desc=clean($('csDesc').value);
  const btn=$('csSend'); btn.disabled=true; btn.textContent='جارٍ الإرسال…';
  try{
    let attachment_path=null, attachment_name=null;
    if(MY_FILE){
      const ext=(/\.([a-zA-Z0-9]+)$/.exec(MY_FILE.name)?.[1]||'dat').toLowerCase();
      const path=`complaints/${Date.now()}.${ext}`;
      const {error:upErr}=await db.storage.from(BUCKET).upload(path,MY_FILE);
      if(upErr) throw upErr;
      attachment_path=path; attachment_name=MY_FILE.name;
    }
    const {error}=await db.from('complaints').insert({
      type, submitted_by:S.ME.id, recipient_type:recipient, title, description:desc||null,
      attachment_path, attachment_name
    });
    if(error) throw error;
    toast('تم الإرسال');
    $('csTitle').value=''; $('csDesc').value=''; MY_FILE=null; $('csFileLabel').textContent='مرفق (اختياري) — ملف أو صورة';
    loadMyComplaints();
  }catch(err){ toast('تعذر الإرسال: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='إرسال'; }
}

async function loadMyComplaints(){
  const {data,error}=await db.from('complaints').select('*').eq('submitted_by',S.ME.id).order('created_at',{ascending:false});
  if(error){ $('csMyList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!data?.length){ $('csMyList').innerHTML='<div class="empty-day">لا شكاوى أو مقترحات سابقة.</div>'; return; }
  $('csMyList').innerHTML=data.map(c=>`
    <div class="cs-row">
      <span><b>${c.title}</b><br><small style="color:#8a93a0">${new Date(c.created_at).toLocaleDateString('ar')} — موجّهة إلى: ${recipientLabel(c.recipient_type)}</small>
        ${c.office_action?`<br><small>الإجراء: ${c.office_action}</small>`:''}</span>
      <span><span class="cs-type">${TYPE_LABEL[c.type]}</span> <span class="cs-badge ${c.status}">${STATUS_LABEL[c.status]}</span></span>
    </div>`).join('');
}

registerTab({id:'complaintsSubmit', label:'تقديم شكوى/مقترح', group:'complaints', groupLabel:'الشكاوى والمقترحات',
  show:()=>true, init:initSubmit});

/* ============ متابعة الشكاوى (الجهة المعنية) ============ */
$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="complaintsFollow" style="display:none">
  <div class="stats">
    <div class="stat"><b id="cfTotal">—</b><span>إجمالي الشكاوى/المقترحات المقدَّمة</span></div>
    <div class="stat"><b id="cfMonthTotal">—</b><span>هذا الشهر</span></div>
    <div class="stat"><b id="cfMonthDone">—</b><span>حُلّت هذا الشهر</span></div>
    <div class="stat red"><b id="cfNew">—</b><span>جديدة</span></div>
    <div class="stat green"><b id="cfDone">—</b><span>تمت المتابعة (الكل)</span></div>
    <div class="stat green"><b id="cfDonePct">—</b><span>نسبة الإنجاز</span></div>
  </div>
  <div class="panel">
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <select id="cfTypeFilter"><option value="">كل الأنواع</option><option value="complaint">شكوى</option><option value="suggestion">مقترح</option></select>
      <select id="cfRecipientFilter"><option value="">كل الجهات</option></select>
      <select id="cfStatusFilter"><option value="">كل الحالات</option><option value="new">جديدة</option><option value="in_progress">يجرى المتابعة</option><option value="done">تمت المتابعة</option></select>
      <label style="font-size:13px;color:var(--navy)">من <input type="date" id="cfFrom"></label>
      <label style="font-size:13px;color:var(--navy)">إلى <input type="date" id="cfTo"></label>
      <button class="btn gold" id="cfApply" style="width:auto;padding:9px 20px">تطبيق</button>
    </div>
  </div>
  <div class="panel">
    <div class="actions" style="margin-bottom:14px">
      <button class="btn ghost" id="cfXls">⬇ إكسل</button>
      <button class="btn ghost" id="cfPdf">⬇ PDF</button>
    </div>
    <div class="board-wrap"><table class="board" id="cfTable"></table></div>
  </div>
</div>
<div id="printAreaCF"></div>
<style>
  #complaintsFollow.wide{max-width:1500px}
  #complaintsFollow select, #complaintsFollow input[type=date]{padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)}
  #cfTable textarea{width:100%;min-width:150px;padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7;resize:vertical}
  #cfTable input[type=date]{padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px}
  #cfTable select.cf-status{padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  #printAreaCF, #printAreaCS{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaCF, #printAreaCF *, #printAreaCS, #printAreaCS *{visibility:visible}
    #printAreaCF, #printAreaCS{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
    .cf-tbl{width:100%;border-collapse:collapse;font-size:10.5px}
    .cf-tbl th,.cf-tbl td{border:1px solid #ccc;padding:6px;text-align:center}
    .cf-tbl th{background:#1d3d5c;color:#fff}
  }
</style>`);

let ALL_ROWS=[], FILTERED=[];

async function initFollow(){
  if($('cfApply').dataset.ready) return;
  $('cfApply').dataset.ready='1';
  $('cfRecipientFilter').innerHTML='<option value="">كل الجهات</option>'+recipientOptions().map(o=>`<option value="${o.v}">${o.label}</option>`).join('');
  $('cfApply').addEventListener('click',applyFilters);
  $('cfXls').addEventListener('click',exportXls);
  $('cfPdf').addEventListener('click',exportPdf);
  await loadAll();
}

async function loadAll(){
  const {data,error}=await db.from('complaints').select('*, staff:submitted_by(full_name)').order('created_at',{ascending:false});
  if(error){ $('cfTable').innerHTML=`<tr><td style="padding:20px;text-align:center;color:#8a93a0">تعذر التحميل: ${error.message}</td></tr>`; return; }
  ALL_ROWS=data||[];
  computeStats();
  applyFilters();
}

function computeStats(){
  const now=new Date(); const ym=now.toISOString().slice(0,7);
  const thisMonth=ALL_ROWS.filter(c=>c.created_at.slice(0,7)===ym);
  $('cfTotal').textContent=ALL_ROWS.length;
  $('cfMonthTotal').textContent=thisMonth.length;
  $('cfMonthDone').textContent=thisMonth.filter(c=>c.status==='done').length;
  $('cfNew').textContent=ALL_ROWS.filter(c=>c.status==='new').length;
  const doneCount=ALL_ROWS.filter(c=>c.status==='done').length;
  $('cfDone').textContent=doneCount;
  $('cfDonePct').textContent = ALL_ROWS.length ? Math.round(doneCount/ALL_ROWS.length*100)+'٪' : '—';
}

function applyFilters(){
  const type=$('cfTypeFilter').value, recipient=$('cfRecipientFilter').value, status=$('cfStatusFilter').value;
  const from=$('cfFrom').value, to=$('cfTo').value;
  FILTERED=ALL_ROWS.filter(c=>{
    if(type && c.type!==type) return false;
    if(recipient && c.recipient_type!==recipient) return false;
    if(status && c.status!==status) return false;
    const d=c.created_at.slice(0,10);
    if(from && d<from) return false;
    if(to && d>to) return false;
    return true;
  });
  render();
}

function render(){
  if(!FILTERED.length){ $('cfTable').innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا نتائج ضمن هذا الفلتر</td></tr>'; return; }
  $('cfTable').innerHTML='<tr><th>اسم المعلمة</th><th>تاريخ التقديم</th><th>الجهة</th><th>النوع</th><th>عنوان</th><th>وصف</th><th>مرفق</th><th>إجراء المكتب</th><th>تاريخ المتابعة</th><th>الحالة</th></tr>'+
    FILTERED.map((c,i)=>{
      const url = c.attachment_path ? db.storage.from(BUCKET).getPublicUrl(c.attachment_path).data.publicUrl : null;
      return `<tr data-i="${i}">
        <td>${c.staff?.full_name||'—'}</td>
        <td class="c">${new Date(c.created_at).toLocaleDateString('ar')}</td>
        <td class="c">${recipientLabel(c.recipient_type)}</td>
        <td class="c">${TYPE_LABEL[c.type]}</td>
        <td>${c.title}</td>
        <td style="max-width:220px">${c.description||'—'}</td>
        <td class="c">${url?`<a href="${url}" target="_blank">⬇ ${c.attachment_name||'ملف'}</a>`:'—'}</td>
        <td><textarea rows="2" data-f="office_action">${c.office_action||''}</textarea></td>
        <td><input type="date" data-f="action_date" value="${c.action_date||''}"></td>
        <td><select class="cf-status" data-f="status">${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${c.status===k?'selected':''}>${v}</option>`).join('')}</select></td>
      </tr>`;
    }).join('');
  $('cfTable').querySelectorAll('[data-f]').forEach(el=>el.addEventListener('change', async ()=>{
    const tr=el.closest('tr'); const i=+tr.dataset.i; const c=FILTERED[i];
    const payload={updated_at:new Date().toISOString()}; payload[el.dataset.f]=el.value||null;
    const {error}=await db.from('complaints').update(payload).eq('id',c.id);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    c[el.dataset.f]=el.value||null;
    toast('تم الحفظ');
    if(el.dataset.f==='status') computeStats();
  }));
}

/* ============ تصدير ============ */
const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const cfBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function exportXls(){
  if(!FILTERED.length){ toast('لا بيانات للتصدير'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('الشكاوى والمقترحات',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,8);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(S.SETTINGS.school_name||'المدرسة',16,true,NAVY,WHITE);
  addTitle('الشكاوى والمقترحات',12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['اسم المعلمة','تاريخ التقديم','الجهة','النوع','عنوان','وصف','إجراء المكتب','الحالة']);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=cfBorder; });
  FILTERED.forEach((c,i)=>{
    const row=ws.addRow([c.staff?.full_name||'', new Date(c.created_at).toLocaleDateString('ar'), recipientLabel(c.recipient_type),
      TYPE_LABEL[c.type], c.title, c.description||'', c.office_action||'', STATUS_LABEL[c.status]]);
    row.eachCell((cell,colNo)=>{ cell.border=cfBorder; cell.alignment={horizontal:colNo===1||colNo===5||colNo===6?'right':'center'}; cell.font={size:10.5};
      if(i%2===1) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
  });
  ws.columns=[{width:22},{width:14},{width:20},{width:10},{width:26},{width:34},{width:30},{width:14}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='الشكاوى_والمقترحات.xlsx'; a.click();
  URL.revokeObjectURL(url);
}
function exportPdf(){
  if(!FILTERED.length){ toast('لا بيانات للتصدير'); return; }
  const rows=FILTERED.map(c=>`<tr><td>${c.staff?.full_name||''}</td><td>${new Date(c.created_at).toLocaleDateString('ar')}</td>
    <td>${recipientLabel(c.recipient_type)}</td><td>${TYPE_LABEL[c.type]}</td><td>${c.title}</td><td>${c.description||'—'}</td>
    <td>${c.office_action||'—'}</td><td>${STATUS_LABEL[c.status]}</td></tr>`).join('');
  $('printAreaCF').innerHTML=`
    ${printHeaderHtml('الشكاوى والمقترحات')}
    <table class="cf-tbl"><tr><th>اسم المعلمة</th><th>تاريخ التقديم</th><th>الجهة</th><th>النوع</th><th>عنوان</th><th>وصف</th><th>إجراء المكتب</th><th>الحالة</th></tr>${rows}</table>
    ${printFooterHtml('مكتب الخدمات', S.ME.full_name)}`;
  printWithTitle('الشكاوى_والمقترحات');
}

/* ============ إحصائيات الشكاوى والمقترحات ============ */
$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="complaintsStats" style="display:none">
  <div class="panel">
    <h3>إحصائيات الشكاوى والمقترحات</h3>
    <div class="row" style="display:flex;gap:20px;margin-bottom:14px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="radio" name="csStatMode" value="month" checked> شهر محدد</label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="radio" name="csStatMode" value="range"> فترة مخصصة</label>
    </div>
    <div class="row" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
      <input type="month" id="csStatMonth">
      <label style="font-size:13px;color:var(--navy);display:none" id="csStatFromLbl">من <input type="date" id="csStatFrom"></label>
      <label style="font-size:13px;color:var(--navy);display:none" id="csStatToLbl">إلى <input type="date" id="csStatTo"></label>
      <button class="btn gold" id="csStatGo" style="width:auto;padding:9px 22px">عرض</button>
      <button class="btn ghost" id="csStatXls" style="width:auto;padding:9px 22px">⬇ إكسل</button>
      <button class="btn ghost" id="csStatPdf" style="width:auto;padding:9px 22px">⬇ PDF</button>
    </div>
  </div>

  <div class="panel">
    <h3>الشكاوى</h3>
    <div class="stats">
      <div class="stat"><b id="csStatCTotal">—</b><span>العدد الكلي</span></div>
      <div class="stat green"><b id="csStatCDone">—</b><span>تم الحل (عدد)</span></div>
      <div class="stat green"><b id="csStatCDonePct">—</b><span>تم الحل (نسبة)</span></div>
      <div class="stat red"><b id="csStatCOpen">—</b><span>لم يُحل (عدد)</span></div>
      <div class="stat red"><b id="csStatCOpenPct">—</b><span>لم يُحل (نسبة)</span></div>
    </div>
  </div>
  <div class="panel">
    <h3>المقترحات</h3>
    <div class="stats">
      <div class="stat"><b id="csStatSTotal">—</b><span>العدد الكلي</span></div>
      <div class="stat green"><b id="csStatSDone">—</b><span>تم الحل (عدد)</span></div>
      <div class="stat green"><b id="csStatSDonePct">—</b><span>تم الحل (نسبة)</span></div>
      <div class="stat red"><b id="csStatSOpen">—</b><span>لم يُحل (عدد)</span></div>
      <div class="stat red"><b id="csStatSOpenPct">—</b><span>لم يُحل (نسبة)</span></div>
    </div>
  </div>

  <div class="panel">
    <h3>تفصيل شهري</h3>
    <div class="board-wrap"><table class="board" id="csStatTable"></table></div>
  </div>
</div>
<div id="printAreaCS"></div>`);

async function initStats(){
  if($('csStatGo').dataset.ready) return;
  $('csStatGo').dataset.ready='1';
  const now=new Date();
  $('csStatMonth').value=now.toISOString().slice(0,7);
  $('csStatFrom').value=now.toISOString().slice(0,8)+'01';
  $('csStatTo').value=now.toISOString().slice(0,10);
  document.querySelectorAll('input[name="csStatMode"]').forEach(r=>r.addEventListener('change',toggleStatMode));
  $('csStatGo').addEventListener('click',runStats);
  $('csStatXls').addEventListener('click',exportStatsXls);
  $('csStatPdf').addEventListener('click',exportStatsPdf);
  runStats();
}
function toggleStatMode(){
  const mode=document.querySelector('input[name="csStatMode"]:checked').value;
  $('csStatMonth').style.display = mode==='month' ? 'inline-block' : 'none';
  $('csStatFromLbl').style.display = mode==='range' ? 'flex' : 'none';
  $('csStatToLbl').style.display = mode==='range' ? 'flex' : 'none';
}
function statRange(){
  const mode=document.querySelector('input[name="csStatMode"]:checked').value;
  if(mode==='month'){
    const [y,m]=$('csStatMonth').value.split('-').map(Number);
    const from=`${y}-${String(m).padStart(2,'0')}-01`;
    const to=new Date(y,m,0).toISOString().slice(0,10);
    return {from,to};
  }
  return {from:$('csStatFrom').value, to:$('csStatTo').value};
}
let STAT_RANGE=null, STAT_COMPLAINTS=null, STAT_SUGGESTIONS=null, STAT_MONTHLY=[];

async function runStats(){
  const {from,to}=statRange();
  STAT_RANGE={from,to};
  const {data,error}=await db.from('complaints').select('type,status,created_at').gte('created_at',from).lte('created_at',to+'T23:59:59');
  if(error){ toast('تعذر التحميل: '+error.message); return; }
  const rows=data||[];
  const summarize=(arr)=>{
    const total=arr.length, done=arr.filter(c=>c.status==='done').length, open=total-done;
    return {total, done, open, donePct: total?Math.round(done/total*100):0, openPct: total?Math.round(open/total*100):0};
  };
  const complaints=summarize(rows.filter(r=>r.type==='complaint'));
  const suggestions=summarize(rows.filter(r=>r.type==='suggestion'));
  STAT_COMPLAINTS=complaints; STAT_SUGGESTIONS=suggestions;
  $('csStatCTotal').textContent=complaints.total; $('csStatCDone').textContent=complaints.done; $('csStatCDonePct').textContent=complaints.donePct+'٪';
  $('csStatCOpen').textContent=complaints.open; $('csStatCOpenPct').textContent=complaints.openPct+'٪';
  $('csStatSTotal').textContent=suggestions.total; $('csStatSDone').textContent=suggestions.done; $('csStatSDonePct').textContent=suggestions.donePct+'٪';
  $('csStatSOpen').textContent=suggestions.open; $('csStatSOpenPct').textContent=suggestions.openPct+'٪';

  // تفصيل شهري: صف لكل شهر ضمن الفترة المختارة
  const months=[];
  let cur=new Date(from+'T12:00:00'); const end=new Date(to+'T12:00:00');
  while(cur<=end){ months.push(cur.toISOString().slice(0,7)); cur=new Date(cur.getFullYear(),cur.getMonth()+1,1); }
  STAT_MONTHLY=months.map(ym=>{
    const inMonth=rows.filter(r=>r.created_at.slice(0,7)===ym);
    const c=summarize(inMonth.filter(r=>r.type==='complaint'));
    const s=summarize(inMonth.filter(r=>r.type==='suggestion'));
    return {ym,c,s};
  });
  const rowsHtml=STAT_MONTHLY.map(({ym,c,s})=>
    `<tr><td class="sec">${ym}</td>
      <td class="c">${c.total}</td><td class="c">${c.done} (${c.donePct}٪)</td><td class="c">${c.open} (${c.openPct}٪)</td>
      <td class="c">${s.total}</td><td class="c">${s.done} (${s.donePct}٪)</td><td class="c">${s.open} (${s.openPct}٪)</td></tr>`).join('');
  $('csStatTable').innerHTML='<tr><th rowspan="2">الشهر</th><th colspan="3">الشكاوى</th><th colspan="3">المقترحات</th></tr>'+
    '<tr><th>مرفوعة</th><th>محلولة</th><th>غير محلولة</th><th>مرفوعة</th><th>محلولة</th><th>غير محلولة</th></tr>'+
    (rowsHtml || '<tr><td colspan="7" style="text-align:center;color:#8a93a0;padding:20px">لا بيانات ضمن هذي الفترة</td></tr>');
}

const NAVY_S='FF1D3D5C', WHITE_S='FFFFFFFF', LINE_S='FFDCD5C8';
const csBorder={top:{style:'thin',color:{argb:LINE_S}},left:{style:'thin',color:{argb:LINE_S}},right:{style:'thin',color:{argb:LINE_S}},bottom:{style:'thin',color:{argb:LINE_S}}};
async function exportStatsXls(){
  if(!STAT_COMPLAINTS){ toast('اعرضي الإحصائية أولاً'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('إحصائيات الشكاوى والمقترحات',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,7);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(S.SETTINGS.school_name||'المدرسة',16,true,NAVY_S,WHITE_S);
  addTitle(`إحصائيات الشكاوى والمقترحات — من ${STAT_RANGE.from} إلى ${STAT_RANGE.to}`,12,true,null,'FF22303C');
  ws.addRow([]);
  const sumHdr=ws.addRow(['','العدد الكلي','محلولة (عدد)','محلولة (نسبة)','غير محلولة (عدد)','غير محلولة (نسبة)','']);
  sumHdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE_S}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY_S}}; c.alignment={horizontal:'center'}; c.border=csBorder; });
  [['الشكاوى',STAT_COMPLAINTS],['المقترحات',STAT_SUGGESTIONS]].forEach(([label,s])=>{
    const row=ws.addRow([label,s.total,s.done,s.donePct+'٪',s.open,s.openPct+'٪','']);
    row.eachCell(c=>{ c.border=csBorder; c.alignment={horizontal:'center'}; c.font={size:10.5}; });
  });
  ws.addRow([]);
  const mHdr1=ws.addRow(['الشهر','الشكاوى','','','المقترحات','','']);
  ws.mergeCells(mHdr1.number,2,mHdr1.number,4); ws.mergeCells(mHdr1.number,5,mHdr1.number,7);
  const mHdr2=ws.addRow(['','مرفوعة','محلولة','غير محلولة','مرفوعة','محلولة','غير محلولة']);
  [mHdr1,mHdr2].forEach(hdr=>hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE_S}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY_S}}; c.alignment={horizontal:'center'}; c.border=csBorder; }));
  STAT_MONTHLY.forEach(({ym,c,s},i)=>{
    const row=ws.addRow([ym, c.total, `${c.done} (${c.donePct}٪)`, `${c.open} (${c.openPct}٪)`, s.total, `${s.done} (${s.donePct}٪)`, `${s.open} (${s.openPct}٪)`]);
    row.eachCell(cell=>{ cell.border=csBorder; cell.alignment={horizontal:'center'}; cell.font={size:10};
      if(i%2===1) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
  });
  ws.columns=[{width:12},{width:14},{width:16},{width:16},{width:14},{width:16},{width:16}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='إحصائيات_الشكاوى_والمقترحات.xlsx'; a.click();
  URL.revokeObjectURL(url);
}
function exportStatsPdf(){
  if(!STAT_COMPLAINTS){ toast('اعرضي الإحصائية أولاً'); return; }
  const monthlyRows=STAT_MONTHLY.map(({ym,c,s})=>`<tr><td>${ym}</td>
    <td>${c.total}</td><td>${c.done} (${c.donePct}٪)</td><td>${c.open} (${c.openPct}٪)</td>
    <td>${s.total}</td><td>${s.done} (${s.donePct}٪)</td><td>${s.open} (${s.openPct}٪)</td></tr>`).join('');
  $('printAreaCS').innerHTML=`
    ${printHeaderHtml(`إحصائيات الشكاوى والمقترحات — من ${STAT_RANGE.from} إلى ${STAT_RANGE.to}`)}
    <table class="cf-tbl"><tr><th></th><th>العدد الكلي</th><th>محلولة</th><th>غير محلولة</th></tr>
      <tr><td>الشكاوى</td><td>${STAT_COMPLAINTS.total}</td><td>${STAT_COMPLAINTS.done} (${STAT_COMPLAINTS.donePct}٪)</td><td>${STAT_COMPLAINTS.open} (${STAT_COMPLAINTS.openPct}٪)</td></tr>
      <tr><td>المقترحات</td><td>${STAT_SUGGESTIONS.total}</td><td>${STAT_SUGGESTIONS.done} (${STAT_SUGGESTIONS.donePct}٪)</td><td>${STAT_SUGGESTIONS.open} (${STAT_SUGGESTIONS.openPct}٪)</td></tr>
    </table>
    <table class="cf-tbl" style="margin-top:14px"><tr><th>الشهر</th><th colspan="3">الشكاوى</th><th colspan="3">المقترحات</th></tr>
      <tr><th></th><th>مرفوعة</th><th>محلولة</th><th>غير محلولة</th><th>مرفوعة</th><th>محلولة</th><th>غير محلولة</th></tr>${monthlyRows}</table>
    ${printFooterHtml('مكتب الخدمات', S.ME.full_name)}`;
  printWithTitle('إحصائيات_الشكاوى_والمقترحات');
}

registerTab({id:'complaintsStats', label:'إحصائيات', group:'complaints', groupLabel:'الشكاوى والمقترحات',
  show:f=>f.isAdmin||f.isLead||f.isServices||f.isComplaintsLead, init:initStats});

registerTab({id:'complaintsFollow', label:'متابعة الشكاوى', group:'complaints', groupLabel:'الشكاوى والمقترحات',
  show:f=>f.isAdmin||f.isLead||f.isServices||f.isComplaintsLead, init:initFollow});
