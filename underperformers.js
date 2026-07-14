/* underperformers.js — متابعة أداء الطالبات
   تُنشأ التنبيهات تلقائياً من grades-entry.js لحظة حفظ درجة راسبة أو
   في أدنى فئة أداء. هذه الشاشة تعرضها بحسب نطاق كل دور:
   المعلمة (طالباتها فقط) — المعلمة الأولى (نطاق إشرافها) —
   رئيسة التحليل/القيادة/الإرشاد الأكاديمي (الكل). حالة المتابعة قابلة
   للتحديث مباشرة، وتصدير إكسل وPDF متاح دائماً. */
import { db, $, S, chunk, toast, printWithTitle, registerTab } from './core.js';

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
      <button class="btn gold" id="upBackfill">🔄 مزامنة كل الدرجات الموجودة</button>
    </div>
    <div class="result" id="upBackfillStatus" style="display:none"></div>
    <div class="board-wrap"><table class="board" id="upTable"></table></div>
  </div>
</div>
<div id="printAreaUP"></div>
<style>
  #upMain.wide{max-width:1400px}
  .up-status{padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  .up-office-action{width:100%;min-width:130px;padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  .up-reason{font-size:11px;padding:3px 10px;border-radius:99px;font-weight:700}
  .up-reason.fail{background:#fbe7e7;color:var(--err)}
  .up-reason.low_performance{background:#fff3cd;color:#8a6100}
  #printAreaUP{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaUP, #printAreaUP *{visibility:visible}
    #printAreaUP{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
    .up-head{text-align:center;margin-bottom:12px}
    .up-head h2{font-size:15px;color:#1d3d5c;font-weight:600;margin-bottom:6px}
    .up-tbl{width:100%;border-collapse:collapse;font-size:10.5px}
    .up-tbl th{background:#1d3d5c;color:#fff;padding:6px 5px;border:1px solid #1d3d5c}
    .up-tbl td{padding:5px;border:1px solid #ccc;text-align:center}
  }
</style>`);

let ROWS=[];

async function initUP(){
  if($('upRefresh').dataset.ready) return;
  $('upRefresh').dataset.ready='1';
  $('upRefresh').addEventListener('click',load);
  $('upXls').addEventListener('click',exportXls);
  $('upPdf').addEventListener('click',exportPdf);
  $('upBackfill').addEventListener('click',backfillAlerts);
  await load();
}

/* مزامنة رجعية: تفحص كل الدرجات المسجَّلة في النظام (حتى القديمة قبل
   وجود هذا التبويب) وتُنشئ التنبيهات الناقصة. آمنة للتكرار — upsert فقط. */
async function backfillAlerts(){
  if(!confirm('سيُعاد فحص كل الدرجات المسجَّلة في النظام لإنشاء أي تنبيهات ناقصة (خصوصاً درجات أُدخلت قبل تفعيل هذه الميزة). قد يستغرق دقيقة حسب حجم البيانات. متابعة؟')) return;
  const btn=$('upBackfill'); btn.disabled=true; btn.textContent='جارٍ المزامنة…';
  $('upBackfillStatus').style.display='block'; $('upBackfillStatus').className='result';
  $('upBackfillStatus').textContent='جارٍ فحص كل الدرجات…';
  try{
    const [{data:cats},{data:th},{data:subs}] = await Promise.all([
      db.from('grade_categories').select('*').order('sort_order'),
      db.from('grade_settings').select('*').eq('id',1).maybeSingle(),
      db.from('subjects').select('id,exam_total'),
    ]);
    const CATS=cats||[], THRESH=th||{pass_pct:50,mastery_pct:80};
    if(!CATS.length) throw new Error('لا فئات تصنيف معرَّفة — أضيفيها من الإعدادات أولاً');
    const lowestCat=CATS.reduce((min,c)=>c.min_pct<min.min_pct?c:min,CATS[0]);
    const subjTotal={}; for(const s of subs||[]) subjTotal[s.id]=s.exam_total;

    const {data:recs,error}=await db.from('grade_records').select('student_id,exam_id,score,exams(subject_id,exam_total)').not('score','is',null);
    if(error) throw error;

    const toFlag=[];
    for(const r of recs||[]){
      const total = r.exams?.exam_total ?? subjTotal[r.exams?.subject_id];
      if(!total) continue;
      const pct=r.score/total*100;
      const cat=CATS.find(c=>pct>=c.min_pct && pct<=c.max_pct);
      const isFail=pct<THRESH.pass_pct, isLow=cat && cat.id===lowestCat.id;
      if(isFail||isLow) toFlag.push({student_id:r.student_id, exam_id:r.exam_id, reason:isFail?'fail':'low_performance', score:r.score, pct});
    }
    let done=0;
    for(const c of chunk(toFlag,300)){
      const {error:e2}=await db.from('underperformer_alerts').upsert(c,{onConflict:'student_id,exam_id'});
      if(!e2) done+=c.length;
    }
    $('upBackfillStatus').textContent=`تمت المزامنة — ${done} تنبيهاً من أصل ${toFlag.length} حالة مطابقة (من ${(recs||[]).length} درجة مفحوصة)`;
    toast('تمت المزامنة بنجاح');
    load();
  }catch(err){ $('upBackfillStatus').className='result err'; $('upBackfillStatus').textContent='تعذرت المزامنة: '+(err.message||err); }
  finally{ btn.disabled=false; btn.textContent='🔄 مزامنة كل الدرجات الموجودة'; }
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
    .select('id,reason,score,pct,status,teacher_action,office_action,created_at,students(full_name,academic_number),exams(name,subject_id,section_id,subjects(code),sections(code))')
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
  tbl.innerHTML='<tr><th>الطالبة</th><th>الرقم الأكاديمي</th><th>الشعبة</th><th>المقرر</th><th>الاختبار</th><th>السبب</th><th>الدرجة</th><th>النسبة</th><th>إجراء المعلمة</th><th>إجراء المكتب</th><th>الحالة</th></tr>'+
    ROWS.map(r=>`<tr>
      <td>${r.students?.full_name||'—'}</td><td class="c">${r.students?.academic_number||'—'}</td>
      <td class="c">${r.exams?.sections?.code||'—'}</td><td class="c">${r.exams?.subjects?.code||'—'}</td><td class="c">${r.exams?.name||'—'}</td>
      <td class="c"><span class="up-reason ${r.reason}">${REASON_LABEL[r.reason]||r.reason}</span></td>
      <td class="c">${r.score??'—'}</td><td class="c">${r.pct!=null?(+r.pct).toFixed(1)+'٪':'—'}</td>
      <td>${r.teacher_action||'—'}</td>
      <td><input class="up-office-action" data-id="${r.id}" value="${(r.office_action||'').replace(/"/g,'&quot;')}"></td>
      <td><select class="up-status" data-id="${r.id}">
        ${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${r.status===k?'selected':''}>${v}</option>`).join('')}
      </select></td></tr>`).join('');
  tbl.querySelectorAll('.up-office-action').forEach(inp=>inp.addEventListener('change', async ()=>{
    const {error}=await db.from('underperformer_alerts').update({office_action:inp.value.trim()||null}).eq('id',inp.dataset.id);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    const row=ROWS.find(r=>r.id===inp.dataset.id); if(row) row.office_action=inp.value.trim();
    toast('تم حفظ إجراء المكتب');
  }));
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
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,11);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle('متابعة أداء الطالبات',12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['الطالبة','الرقم الأكاديمي','الشعبة','المقرر','الاختبار','السبب','الدرجة','النسبة','إجراء المعلمة','إجراء المكتب','الحالة']);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=upBorder; });
  ROWS.forEach((r,i)=>{
    const row=ws.addRow([r.students?.full_name||'', r.students?.academic_number||'', r.exams?.sections?.code||'',
      r.exams?.subjects?.code||'', r.exams?.name||'', REASON_LABEL[r.reason]||r.reason, r.score??'',
      r.pct!=null?(+r.pct).toFixed(1)+'٪':'', r.teacher_action||'', r.office_action||'', STATUS_LABEL[r.status]||r.status]);
    row.eachCell((c,colNo)=>{ c.border=upBorder; c.alignment={horizontal:colNo===1?'right':'center'}; c.font={size:10.5}; c.numFmt='@';
      if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
  });
  ws.columns=[{width:26},{width:16},{width:11},{width:11},{width:16},{width:14},{width:9},{width:9},{width:22},{width:22},{width:14}];
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
    <td>${REASON_LABEL[r.reason]||r.reason}</td><td>${r.score??''}</td><td>${r.pct!=null?(+r.pct).toFixed(1)+'٪':''}</td><td>${r.teacher_action||'—'}</td><td>${r.office_action||'—'}</td><td>${STATUS_LABEL[r.status]||r.status}</td></tr>`).join('');
  $('printAreaUP').innerHTML=`
    <div class="up-head"><h2>متابعة أداء الطالبات</h2></div>
    <table class="up-tbl"><tr><th>الطالبة</th><th>الرقم الأكاديمي</th><th>الشعبة</th><th>المقرر</th><th>الاختبار</th><th>السبب</th><th>الدرجة</th><th>النسبة</th><th>إجراء المعلمة</th><th>إجراء المكتب</th><th>الحالة</th></tr>${rows}</table>`;
  printWithTitle('متابعة_أداء_الطالبات');
}

registerTab({id:'upMain', label:'متابعة أداء الطالبات', group:'grades', groupLabel:'الدرجات',
  show:f=>f.isAdmin||f.isLead||f.isAnalysis||f.isAcademicGuidance||f.isSeniorTeacher, init:initUP});
