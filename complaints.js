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
    <div class="stat"><b id="cfMonthTotal">—</b><span>هذا الشهر</span></div>
    <div class="stat"><b id="cfMonthDone">—</b><span>حُلّت هذا الشهر</span></div>
    <div class="stat red"><b id="cfNew">—</b><span>جديدة</span></div>
    <div class="stat green"><b id="cfDone">—</b><span>تمت المتابعة (الكل)</span></div>
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
  #printAreaCF{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaCF, #printAreaCF *{visibility:visible}
    #printAreaCF{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
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
  $('cfMonthTotal').textContent=thisMonth.length;
  $('cfMonthDone').textContent=thisMonth.filter(c=>c.status==='done').length;
  $('cfNew').textContent=ALL_ROWS.filter(c=>c.status==='new').length;
  $('cfDone').textContent=ALL_ROWS.filter(c=>c.status==='done').length;
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

registerTab({id:'complaintsFollow', label:'متابعة الشكاوى', group:'complaints', groupLabel:'الشكاوى والمقترحات',
  show:f=>f.isAdmin||f.isLead||f.isServices||f.isComplaintsLead, init:initFollow});
