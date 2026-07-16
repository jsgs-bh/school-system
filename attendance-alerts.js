/* attendance-alerts.js — تنبيهات الغياب والتأخير
   مسؤولة الغياب تحدد عتبة (كم مرة غياب/تأخير تستوجب تنبيهاً). زر
   "تحديث" يفحص السنة الدراسية حتى اليوم ويُنشئ/يُحدّث تنبيهات لمن
   تجاوزت العتبة — يحدّث العدد فقط، ويحافظ على السبب/الإجراء/الحالة
   إن كانت موجودة مسبقاً. تقرير مطبوع لكل طالبة بتفاصيل الأيام. */
import { db, $, S, dstr, toast, printWithTitle, registerTab } from './core.js';
import { collectRange } from './period.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';
const STATUS_LABEL={pending:'قيد الانتظار', in_progress:'جاري المتابعة', done:'تم التعامل معها'};

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="attAlerts" style="display:none">
  <div class="panel">
    <h3>إعدادات التنبيه</h3>
    <div class="row" style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-end">
      <div class="field" style="max-width:200px"><label>عدد مرات الغياب المستوجبة لتنبيه</label><input type="number" id="aaAbsThresh" min="1"></div>
      <div class="field" style="max-width:200px"><label>عدد مرات التأخير المستوجبة لتنبيه</label><input type="number" id="aaLateThresh" min="1"></div>
      <button class="btn gold" id="aaSaveSettings" style="width:auto;padding:10px 22px">حفظ الإعدادات</button>
    </div>
  </div>

  <div class="stats">
    <div class="stat red"><b id="aaTotal">—</b><span>إجمالي التنبيهات</span></div>
    <div class="stat"><b id="aaPending">—</b><span>قيد الانتظار</span></div>
    <div class="stat"><b id="aaProgress">—</b><span>جاري المتابعة</span></div>
    <div class="stat green"><b id="aaDone">—</b><span>تم التعامل معها</span></div>
  </div>
  <div class="panel">
    <h3>استخراج حسب</h3>
    <div class="row" style="display:flex;gap:20px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="aaKindAbsence" checked> الغياب</label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="aaKindLate" checked> التأخير</label>
    </div>
  </div>
  <div class="panel">
    <div class="actions" style="margin-bottom:14px">
      <button class="btn gold" id="aaRefresh">↻ تحديث التنبيهات</button>
      <button class="btn ghost" id="aaXls">⬇ إكسل</button>
      <button class="btn ghost" id="aaPdf">⬇ PDF</button>
    </div>
    <div class="result" id="aaStatus" style="display:none"></div>
    <div class="board-wrap"><table class="board" id="aaTable"></table></div>
  </div>
</div>
<div id="printAreaAA"></div>
<style>
  #attAlerts.wide{max-width:1400px}
  .aa-reason{font-size:11px;padding:3px 10px;border-radius:99px;font-weight:700}
  .aa-reason.absence{background:#fbe7e7;color:var(--err)}
  .aa-reason.late{background:#fff3cd;color:#8a6100}
  .aa-input{width:100%;min-width:120px;padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  .aa-status{padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  #printAreaAA{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaAA, #printAreaAA *{visibility:visible}
    #printAreaAA{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
    .aa-head{text-align:center;margin-bottom:12px}
    .aa-head h2{font-size:15px;color:#1d3d5c;font-weight:600}
    .aa-tbl{width:100%;border-collapse:collapse;font-size:11px}
    .aa-tbl th,.aa-tbl td{border:1px solid #ccc;padding:6px;text-align:center}
    .aa-tbl th{background:#1d3d5c;color:#fff}
  }
</style>`);

let ROWS=[];

async function initAA(){
  if($('aaRefresh').dataset.ready) return;
  $('aaRefresh').dataset.ready='1';
  const {data:st}=await db.from('app_settings').select('*').eq('id',1).maybeSingle();
  $('aaAbsThresh').value=st?.absence_alert_threshold||4;
  $('aaLateThresh').value=st?.late_alert_threshold||4;
  $('aaSaveSettings').addEventListener('click',saveSettings);
  $('aaRefresh').addEventListener('click',refreshAlerts);
  $('aaXls').addEventListener('click',exportXls);
  $('aaPdf').addEventListener('click',exportPdf);
  $('aaKindAbsence').addEventListener('change',render);
  $('aaKindLate').addEventListener('change',render);
  await loadAlerts();
}

async function saveSettings(){
  const abs=+$('aaAbsThresh').value||4, late=+$('aaLateThresh').value||4;
  const {error}=await db.from('app_settings').upsert({id:1, absence_alert_threshold:abs, late_alert_threshold:late, updated_at:new Date().toISOString()});
  if(error){ toast('تعذر الحفظ: '+error.message); return; }
  toast('تم حفظ الإعدادات');
}

async function refreshAlerts(){
  const btn=$('aaRefresh'); btn.disabled=true; btn.textContent='جارٍ الفحص…';
  $('aaStatus').style.display='block'; $('aaStatus').className='result'; $('aaStatus').textContent='جارٍ فحص السنة الدراسية حتى اليوم…';
  try{
    if(!S.YEAR?.start_date){ toast('لا سنة دراسية نشطة بتواريخ محددة'); return; }
    const {data:st}=await db.from('app_settings').select('*').eq('id',1).maybeSingle();
    const absThreshold=st?.absence_alert_threshold||4, lateThreshold=st?.late_alert_threshold||4;
    const to = S.YEAR.end_date;

    const range=await collectRange(S.YEAR.start_date,to);
    const absQualified=Object.entries(range.perStudentAbsDays||{}).filter(([,c])=>c>=absThreshold);

    const {data:lateRows}=await db.from('late_log').select('student_id').gte('date',S.YEAR.start_date).lte('date',to);
    const lateCounts={}; for(const r of lateRows||[]) lateCounts[r.student_id]=(lateCounts[r.student_id]||0)+1;
    const lateQualified=Object.entries(lateCounts).filter(([,c])=>c>=lateThreshold);

    const {data:existing}=await db.from('attendance_alerts').select('student_id,kind,id');
    const existingMap={}; for(const e of existing||[]) existingMap[`${e.student_id}|${e.kind}`]=e.id;

    for(const [sid,count] of absQualified){
      const key=`${sid}|absence`;
      if(existingMap[key]) await db.from('attendance_alerts').update({count, updated_at:new Date().toISOString()}).eq('id',existingMap[key]);
      else await db.from('attendance_alerts').insert({student_id:sid, kind:'absence', count});
    }
    for(const [sid,count] of lateQualified){
      const key=`${sid}|late`;
      if(existingMap[key]) await db.from('attendance_alerts').update({count, updated_at:new Date().toISOString()}).eq('id',existingMap[key]);
      else await db.from('attendance_alerts').insert({student_id:sid, kind:'late', count});
    }
    toast(`تم التحديث — ${absQualified.length} تنبيه غياب، ${lateQualified.length} تنبيه تأخير`);
    await loadAlerts();
  }catch(err){ toast('تعذر التحديث: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='↻ تحديث التنبيهات'; $('aaStatus').style.display='none'; }
}

async function loadAlerts(){
  const {data,error}=await db.from('attendance_alerts').select('*, students(full_name,academic_number)').order('updated_at',{ascending:false});
  if(error){ $('aaTable').innerHTML=`<tr><td style="padding:20px;text-align:center;color:#8a93a0">تعذر التحميل: ${error.message}</td></tr>`; return; }
  ROWS=data||[];
  if(ROWS.length){
    const sids=[...new Set(ROWS.map(r=>r.student_id))];
    const {data:enr}=await db.from('enrollments').select('student_id, sections(code)').in('student_id',sids).is('to_date',null);
    const secBySid={}; for(const e of enr||[]) secBySid[e.student_id]=e.sections?.code||'—';
    for(const r of ROWS) r._sec=secBySid[r.student_id]||'—';
  }
  render();
}

function getFiltered(){
  const showAbs=$('aaKindAbsence').checked, showLate=$('aaKindLate').checked;
  return ROWS.filter(r=> (r.kind==='absence'&&showAbs) || (r.kind==='late'&&showLate) );
}

function render(){
  $('aaTotal').textContent=ROWS.length;
  $('aaPending').textContent=ROWS.filter(r=>r.status==='pending').length;
  $('aaProgress').textContent=ROWS.filter(r=>r.status==='in_progress').length;
  $('aaDone').textContent=ROWS.filter(r=>r.status==='done').length;
  const rows=getFiltered();
  if(!rows.length){ $('aaTable').innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا تنبيهات ضمن هذا الاختيار</td></tr>'; return; }
  $('aaTable').innerHTML='<tr><th>الطالبة</th><th>الرقم الأكاديمي</th><th>الشعبة</th><th>النوع</th><th>العدد</th><th>السبب</th><th>الإجراء</th><th>الحالة</th><th></th></tr>'+
    rows.map((r,i)=>`<tr data-i="${i}">
      <td>${r.students?.full_name||'—'}</td><td class="c">${r.students?.academic_number||'—'}</td>
      <td class="c">${r._sec||'—'}</td>
      <td class="c"><span class="aa-reason ${r.kind}">${r.kind==='absence'?'غياب':'تأخير'}</span></td>
      <td class="c">${r.count}</td>
      <td><input class="aa-input" data-f="reason" value="${(r.reason||'').replace(/"/g,'&quot;')}"></td>
      <td><input class="aa-input" data-f="action_taken" value="${(r.action_taken||'').replace(/"/g,'&quot;')}"></td>
      <td><select class="aa-status" data-f="status">${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${r.status===k?'selected':''}>${v}</option>`).join('')}</select></td>
      <td><button class="btn ghost" data-print="${i}" style="width:auto;padding:6px 12px;font-size:11px">🖨️ تقرير</button></td>
    </tr>`).join('');

  $('aaTable').querySelectorAll('input,select').forEach(el=>el.addEventListener('change', async ()=>{
    const tr=el.closest('tr'); const i=+tr.dataset.i; const r=rows[i];
    const payload={updated_at:new Date().toISOString()};
    payload[el.dataset.f]=el.value;
    if(el.dataset.f==='status'){ payload.handled_by=S.ME.id; payload.handled_at=new Date().toISOString(); }
    const {error}=await db.from('attendance_alerts').update(payload).eq('id',r.id);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    r[el.dataset.f]=el.value;
    toast('تم الحفظ');
    render();
  }));
  $('aaTable').querySelectorAll('button[data-print]').forEach(b=>b.addEventListener('click',()=>printStudent(rows[+b.dataset.print])));
}

async function printStudent(r){
  const to = S.YEAR.end_date;
  let rows='';
  if(r.kind==='absence'){
    const range=await collectRange(S.YEAR.start_date,to);
    const dates=range.DAILY.filter(d=>d.bySid[r.student_id]).map(d=>d.date);
    rows=dates.map(d=>`<tr><td>${d}</td><td>غياب (حصة أولى)</td></tr>`).join('');
  }else{
    const {data:lateRows}=await db.from('late_log').select('date,arrival_time,note').eq('student_id',r.student_id).gte('date',S.YEAR.start_date).lte('date',to).order('date');
    rows=(lateRows||[]).map(l=>`<tr><td>${l.date}</td><td>${l.arrival_time?.slice(0,5)||'—'} — ${l.note||'—'}</td></tr>`).join('');
  }
  $('printAreaAA').innerHTML=`
    <div class="aa-head"><h2>${schoolName()} — تقرير ${r.kind==='absence'?'غياب':'تأخير'} طالبة</h2>
      <p>${r.students?.full_name} — ${r.students?.academic_number}</p></div>
    <table class="aa-tbl"><tr><th>التاريخ</th><th>${r.kind==='absence'?'السبب':'وقت الحضور / ملاحظة'}</th></tr>${rows}</table>
    <div style="margin-top:16px;padding:10px;border:1px solid #ccc;border-radius:6px">
      <p><b>السبب العام:</b> ${r.reason||'—'}</p>
      <p><b>الإجراء المتبع:</b> ${r.action_taken||'—'}</p>
      <p><b>الحالة:</b> ${STATUS_LABEL[r.status]||r.status}</p>
    </div>`;
  printWithTitle(`تقرير_${r.kind==='absence'?'غياب':'تأخير'}_${r.students?.academic_number}`);
}

/* ============ تصدير ============ */
const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const aaBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function exportXls(){
  const filtered=getFiltered();
  if(!filtered.length){ toast('لا بيانات للتصدير'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('تنبيهات الغياب والتأخير',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,8);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle('تنبيهات الغياب والتأخير',12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['الطالبة','الرقم الأكاديمي','الشعبة','النوع','العدد','السبب','الإجراء','الحالة']);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=aaBorder; });
  filtered.forEach((r,i)=>{
    const row=ws.addRow([r.students?.full_name||'', r.students?.academic_number||'', r._sec||'',
      r.kind==='absence'?'غياب':'تأخير', r.count, r.reason||'', r.action_taken||'', STATUS_LABEL[r.status]||r.status]);
    row.eachCell((c,colNo)=>{ c.border=aaBorder; c.alignment={horizontal:colNo===1?'right':'center'}; c.font={size:10.5}; c.numFmt='@';
      if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
  });
  ws.columns=[{width:26},{width:16},{width:11},{width:10},{width:8},{width:24},{width:24},{width:16}];
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:3}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='تنبيهات_الغياب_والتأخير.xlsx'; a.click();
  URL.revokeObjectURL(url);
}
function exportPdf(){
  const filtered=getFiltered();
  if(!filtered.length){ toast('لا بيانات للتصدير'); return; }
  const rows=filtered.map(r=>`<tr><td>${r.students?.full_name||''}</td><td>${r.students?.academic_number||''}</td>
    <td>${r._sec||''}</td><td>${r.kind==='absence'?'غياب':'تأخير'}</td>
    <td>${r.count}</td><td>${r.reason||'—'}</td><td>${r.action_taken||'—'}</td><td>${STATUS_LABEL[r.status]||r.status}</td></tr>`).join('');
  $('printAreaAA').innerHTML=`<div class="aa-head"><h2>${schoolName()} — تنبيهات الغياب والتأخير</h2></div>
    <table class="aa-tbl"><tr><th>الطالبة</th><th>الرقم الأكاديمي</th><th>الشعبة</th><th>النوع</th><th>العدد</th><th>السبب</th><th>الإجراء</th><th>الحالة</th></tr>${rows}</table>`;
  printWithTitle('تنبيهات_الغياب_والتأخير');
}

registerTab({id:'attAlerts', label:'تنبيهات الغياب والتأخير', group:'attendance', groupLabel:'متابعة الغياب',
  show:f=>f.isAdmin||f.isSocial||f.isAttendanceLead, init:initAA});
