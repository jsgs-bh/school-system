/* underperformers.js — متابعة أداء الطالبات
   تُنشأ التنبيهات تلقائياً من grades-entry.js لحظة حفظ درجة راسبة أو
   في أدنى فئة أداء. هذه الشاشة تعرضها بحسب نطاق كل دور:
   المعلمة (طالباتها فقط) — المعلمة الأولى (نطاق إشرافها) —
   رئيسة التحليل/القيادة/الإرشاد الأكاديمي (الكل). حالة المتابعة قابلة
   للتحديث مباشرة، وتصدير إكسل وPDF متاح دائماً. */
import { db, $, S, toast, printWithTitle, registerTab } from './core.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';
const REASON_LABEL = {fail:'راسبة', low_performance:'أداء منخفض'};
const STATUS_LABEL = {pending:'قيد الانتظار', in_progress:'جاري المتابعة', done:'تم'};

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="upMain" style="display:none">
  <div class="stats">
    <div class="stat red"><b id="upTotal">—</b><span>إجمالي التنبيهات</span></div>
    <div class="stat"><b id="upPending">—</b><span>قيد الانتظار</span></div>
    <div class="stat"><b id="upProgress">—</b><span>جاري المتابعة</span></div>
    <div class="stat green"><b id="upDone">—</b><span>تم التعامل معها</span></div>
  </div>
  <div class="panel">
    <div class="actions" style="margin-bottom:14px">
      <button class="btn ghost" id="upXls">⬇ إكسل</button>
      <button class="btn ghost" id="upPdf">⬇ PDF</button>
      <button class="btn ghost" id="upRefresh">↻ تحديث</button>
    </div>
    <div class="board-wrap"><table class="board" id="upTable"></table></div>
  </div>
</div>
<div id="printAreaUP"></div>
<style>
  #upMain.wide{max-width:1400px}
  .up-status{padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  .up-reason{font-size:11px;padding:3px 10px;border-radius:99px;font-weight:700}
  .up-reason.fail{background:#fbe7e7;color:var(--err)}
  .up-reason.low_performance{background:#fff3cd;color:#8a6100}
  #printAreaUP{display:none}
  @media print{
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaUP, #printAreaUP *{visibility:visible}
    #printAreaUP{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm 16mm}
    .up-head{text-align:center;margin-bottom:12px}
    .up-head h2{font-size:15px;color:#1d3d5c;font-weight:600;margin-bottom:6px}
    .up-tbl{width:100%;border-collapse:collapse;font-size:10.5px}
    .up-tbl th{background:#1d3d5c;color:#fff;padding:6px 5px;border:1px solid #1d3d5c}
    .up-tbl td{padding:5px;border:1px solid #ccc;text-align:center}
    .up-footer{position:fixed;bottom:6mm;left:12mm;right:12mm;text-align:center;font-size:9.5px;color:#555;border-top:1px solid #ccc;padding-top:4px;font-family:'Amiri',serif}
  }
</style>`);

let ROWS=[];

async function initUP(){
  if($('upRefresh').dataset.ready) return;
  $('upRefresh').dataset.ready='1';
  $('upRefresh').addEventListener('click',load);
  $('upXls').addEventListener('click',exportXls);
  $('upPdf').addEventListener('click',exportPdf);
  await load();
}

async function getScopeFilter(){
  if(S.FLAGS.isAdmin||S.FLAGS.isLead||S.FLAGS.isAnalysis||S.FLAGS.isAcademicGuidance) return null; // بلا قيد
  if(S.FLAGS.isSeniorTeacher){
    const deptId=S.ME.department_id;
    const {data:deptTeachers}=deptId?await db.from('staff').select('id').eq('department_id',deptId):{data:[]};
    const set=new Set((deptTeachers||[]).map(t=>t.id)); set.add(S.ME.id);
    const {data:links}=await db.from('supervision_links').select('teacher_staff_id,mode').eq('senior_staff_id',S.ME.id);
    for(const l of links||[]){ if(l.mode==='include') set.add(l.teacher_staff_id); else set.delete(l.teacher_staff_id); }
    const {data:ents}=await db.from('entry_teachers').select('staff_id,timetable_entries!inner(section_id,subject_id,academic_year_id)')
      .eq('timetable_entries.academic_year_id',S.YEAR.id);
    const pairs=new Set();
    for(const e of ents||[]) if(set.has(e.staff_id)) pairs.add(`${e.timetable_entries.subject_id}|${e.timetable_entries.section_id}`);
    return pairs;
  }
  if(S.FLAGS.isTeacher){
    const {data:ents}=await db.from('entry_teachers').select('timetable_entries!inner(section_id,subject_id,academic_year_id)')
      .eq('staff_id',S.ME.id).eq('timetable_entries.academic_year_id',S.YEAR.id);
    const pairs=new Set();
    for(const e of ents||[]) pairs.add(`${e.timetable_entries.subject_id}|${e.timetable_entries.section_id}`);
    return pairs;
  }
  return new Set(); // دور غير مخوّل — لن يظهر التبويب أصلاً بسبب show()، لكن احتياطاً
}

async function load(){
  const tbl=$('upTable');
  tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">جارٍ التحميل…</td></tr>';
  const scope=await getScopeFilter();
  const {data:alerts,error}=await db.from('underperformer_alerts')
    .select('id,reason,score,pct,status,created_at,students(full_name,academic_number),exams(name,subject_id,section_id,subjects(code),sections(code))')
    .order('created_at',{ascending:false});
  if(error){ tbl.innerHTML=`<tr><td style="padding:30px;text-align:center;color:#8a93a0">تعذر التحميل: ${error.message}</td></tr>`; return; }
  ROWS=(alerts||[]).filter(a=>{
    if(!scope) return true;
    const ex=a.exams; if(!ex) return false;
    return scope.has(`${ex.subject_id}|${ex.section_id}`);
  });
  render();
}
function render(){
  $('upTotal').textContent=ROWS.length;
  $('upPending').textContent=ROWS.filter(r=>r.status==='pending').length;
  $('upProgress').textContent=ROWS.filter(r=>r.status==='in_progress').length;
  $('upDone').textContent=ROWS.filter(r=>r.status==='done').length;
  const tbl=$('upTable');
  if(!ROWS.length){ tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا تنبيهات حالياً 🎉</td></tr>'; return; }
  tbl.innerHTML='<tr><th>الطالبة</th><th>الرقم الأكاديمي</th><th>الشعبة</th><th>المقرر</th><th>الاختبار</th><th>السبب</th><th>الدرجة</th><th>النسبة</th><th>الحالة</th></tr>'+
    ROWS.map(r=>`<tr>
      <td>${r.students?.full_name||'—'}</td><td class="c">${r.students?.academic_number||'—'}</td>
      <td class="c">${r.exams?.sections?.code||'—'}</td><td class="c">${r.exams?.subjects?.code||'—'}</td><td class="c">${r.exams?.name||'—'}</td>
      <td class="c"><span class="up-reason ${r.reason}">${REASON_LABEL[r.reason]||r.reason}</span></td>
      <td class="c">${r.score??'—'}</td><td class="c">${r.pct!=null?(+r.pct).toFixed(1)+'٪':'—'}</td>
      <td><select class="up-status" data-id="${r.id}">
        ${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${r.status===k?'selected':''}>${v}</option>`).join('')}
      </select></td></tr>`).join('');
  tbl.querySelectorAll('.up-status').forEach(sel=>sel.addEventListener('change', async ()=>{
    const {error}=await db.from('underperformer_alerts').update({
      status:sel.value, handled_by:S.ME.id, handled_at:new Date().toISOString()
    }).eq('id',sel.dataset.id);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    const row=ROWS.find(r=>r.id===sel.dataset.id); if(row) row.status=sel.value;
    toast('تم تحديث الحالة');
    $('upPending').textContent=ROWS.filter(r=>r.status==='pending').length;
    $('upProgress').textContent=ROWS.filter(r=>r.status==='in_progress').length;
    $('upDone').textContent=ROWS.filter(r=>r.status==='done').length;
  }));
}

/* ============ تصدير ============ */
const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const upBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function exportXls(){
  if(!ROWS.length){ toast('لا بيانات للتصدير'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('متابعة الأداء',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,9);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle('متابعة أداء الطالبات',12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['الطالبة','الرقم الأكاديمي','الشعبة','المقرر','الاختبار','السبب','الدرجة','النسبة','الحالة']);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=upBorder; });
  ROWS.forEach((r,i)=>{
    const row=ws.addRow([r.students?.full_name||'', r.students?.academic_number||'', r.exams?.sections?.code||'',
      r.exams?.subjects?.code||'', r.exams?.name||'', REASON_LABEL[r.reason]||r.reason, r.score??'',
      r.pct!=null?(+r.pct).toFixed(1)+'٪':'', STATUS_LABEL[r.status]||r.status]);
    row.eachCell((c,colNo)=>{ c.border=upBorder; c.alignment={horizontal:colNo===1?'right':'center'}; c.font={size:10.5}; c.numFmt='@';
      if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
  });
  ws.columns=[{width:26},{width:16},{width:11},{width:11},{width:16},{width:14},{width:9},{width:9},{width:14}];
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:3}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='متابعة_أداء_الطالبات.xlsx'; a.click();
  URL.revokeObjectURL(url);
}
function exportPdf(){
  if(!ROWS.length){ toast('لا بيانات للتصدير'); return; }
  const rows=ROWS.map(r=>`<tr><td>${r.students?.full_name||''}</td><td>${r.students?.academic_number||''}</td>
    <td>${r.exams?.sections?.code||''}</td><td>${r.exams?.subjects?.code||''}</td><td>${r.exams?.name||''}</td>
    <td>${REASON_LABEL[r.reason]||r.reason}</td><td>${r.score??''}</td><td>${r.pct!=null?(+r.pct).toFixed(1)+'٪':''}</td><td>${STATUS_LABEL[r.status]||r.status}</td></tr>`).join('');
  const footer=`<div class="up-footer">${schoolName()} — طُبع بتاريخ ${new Date().toISOString().slice(0,10)}</div>`;
  $('printAreaUP').innerHTML=`
    <div class="up-head"><h2>متابعة أداء الطالبات</h2></div>
    <table class="up-tbl"><tr><th>الطالبة</th><th>الرقم الأكاديمي</th><th>الشعبة</th><th>المقرر</th><th>الاختبار</th><th>السبب</th><th>الدرجة</th><th>النسبة</th><th>الحالة</th></tr>${rows}</table>${footer}`;
  printWithTitle('متابعة_أداء_الطالبات');
}

registerTab({id:'upMain', label:'متابعة أداء الطالبات', group:'grades', groupLabel:'الدرجات',
  show:f=>f.isAdmin||f.isLead||f.isAnalysis||f.isAcademicGuidance||f.isSeniorTeacher||f.isTeacher, init:initUP});
