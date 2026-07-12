/* grades-analysis.js — تحليل الاختبارات
   يظهر للأدمن/القيادة/مسؤولة التحليل (على كل المقررات) وللمعلمة الأولى
   (على معلمات قسمها + استثناءات الإشراف من الإعدادات فقط).
   ثلاث شاشات: متابعة الرصد (شعبة×اختبار) ← تحليل تفصيلي (تصنيف+ملاحظات+إجراءات)
   ومقارنة بين اختبارين أو أكثر لنفس الشعبة. تصدير إكسل وPDF لكل شاشة،
   وتصدير مجمّع لمقرر كامل أو لكل المقررات. */
import { db, $, S, chunk, toast, printWithTitle, registerTab } from './core.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';
const EXAM_NAMES = ['اختبار تشخيصي','الاختبار الأول','الاختبار الثاني'];
const numKey = v => parseInt(String(v).replace(/[^\d]/g,''),10) || 0;

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="gaMain" style="display:none">
  <div id="gaListView">
    <div class="datebar">
      <div class="today-lbl">تحليل الاختبارات — متابعة الرصد</div>
      <select id="gaSubject" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:200px"></select>
    </div>
    <div class="actions" style="margin-bottom:14px">
      <button class="btn ghost" id="gaXlsSubject">⬇ إكسل — هذا المقرر (كل الشعب)</button>
      <button class="btn ghost" id="gaPdfSubject">⬇ PDF — هذا المقرر (كل الشعب)</button>
      <button class="btn ghost" id="gaXlsAll">⬇ إكسل — كل المقررات</button>
      <button class="btn ghost" id="gaPdfAll">⬇ PDF — كل المقررات</button>
    </div>
    <div class="result" id="gaBulkStatus" style="display:none"></div>
    <div class="board-wrap"><table class="board" id="gaTable"></table></div>
  </div>

  <div id="gaDetailView" style="display:none">
    <button class="back" id="gaBack">→ رجوع</button>
    <div class="g-head" style="margin:10px 0 14px">
      <div class="ttl"><b id="gaDetailTitle">—</b><span id="gaDetailSub">—</span></div>
      <button class="btn ghost" id="gaCompareGo" style="width:auto;padding:9px 18px">🔍 مقارنة مع اختبار آخر</button>
    </div>
    <div class="stats" id="gaStats"></div>
    <div class="panel">
      <h3>توزيع الفئات</h3>
      <div class="board-wrap"><table class="board" id="gaCatTable"></table></div>
    </div>
    <div class="panel">
      <h3>ملاحظة عامة على هذا الاختبار</h3>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap">
        <input type="text" id="gaGenNote" placeholder="ملاحظة عامة…" style="flex:2;min-width:200px;padding:10px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
        <input type="text" id="gaGenAction" placeholder="إجراء…" style="flex:1;min-width:160px;padding:10px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      </div>
    </div>
    <div class="panel">
      <div class="actions" style="margin-bottom:14px">
        <button class="btn gold" id="gaSaveNotes">حفظ الملاحظات والإجراءات</button>
        <button class="btn ghost" id="gaXls">⬇ إكسل — كشف الدرجات والتصنيف</button>
        <button class="btn ghost" id="gaPdf">⬇ PDF — كشف الدرجات والتصنيف</button>
      </div>
      <div class="board-wrap"><table class="board" id="gaStudentTable"></table></div>
    </div>
  </div>

  <div id="gaCompareView" style="display:none">
    <button class="back" id="gaCompareBack">→ رجوع</button>
    <div class="g-head" style="margin:10px 0 14px"><div class="ttl"><b id="gaCompareTitle">—</b><span id="gaCompareSub">—</span></div></div>
    <div id="gaCompareExamPick" style="margin-bottom:16px"></div>
    <div id="gaCompareResults" style="display:none">
      <div class="board-wrap"><table class="board" id="gaCompareStatsTable"></table></div>
      <div class="panel">
        <div class="actions" style="margin-bottom:14px">
          <button class="btn ghost" id="gaCompareXls">⬇ إكسل — المقارنة</button>
          <button class="btn ghost" id="gaComparePdf">⬇ PDF — المقارنة</button>
        </div>
        <div class="board-wrap"><table class="board" id="gaCompareTable"></table></div>
      </div>
    </div>
  </div>
</div>
<div id="printAreaGA"></div>
<style>
  #gaMain.wide{max-width:1400px}
  .ga-cell{display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:6px 4px;border-radius:8px}
  .ga-cell:hover{background:var(--sand)}
  .ga-cell.empty{cursor:default;color:#b7bec6}
  .ga-cell.empty:hover{background:none}
  .ga-cell b{font-size:13px}
  .ga-cell small{font-size:10.5px;color:#6b7683}
  .ga-swatch{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:middle;margin-inline-end:6px}
  .ga-note-input{width:100%;min-width:110px;padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  .ga-cmp-check{display:inline-flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--line);border-radius:9px;padding:9px 16px;margin-inline-end:8px;cursor:pointer}
  #printAreaGA{display:none}
  @media print{
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaGA, #printAreaGA *{visibility:visible}
    #printAreaGA{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm 16mm}
    .ga-page{page-break-after:always;padding:6px}
    .ga-page:last-child{page-break-after:auto}
    .ga-head{text-align:center;margin-bottom:12px}
    .ga-head h2{font-size:15px;color:#1d3d5c;font-weight:600;margin-bottom:6px}
    .ga-head p{font-size:12px;color:#333}
    .ga-tbl{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px}
    .ga-tbl th{background:#1d3d5c;color:#fff;padding:6px 5px;border:1px solid #1d3d5c}
    .ga-tbl td{padding:5px;border:1px solid #ccc;text-align:center}
    .ga-footer{position:fixed;bottom:6mm;left:12mm;right:12mm;text-align:center;font-size:9.5px;color:#555;border-top:1px solid #ccc;padding-top:4px;font-family:'Amiri',serif}
  }
</style>`);

let SUBJECTS=[], CUR_SUBJECT=null, CATS=[], THRESH={pass_pct:50,mastery_pct:80};
let CUR_DETAIL=null, SUPERVISED=null; // SUPERVISED: null=بلا قيد (أدمن/قيادة/تحليل)، أو Set لمعلمة أولى

async function initAnalysis(){
  if($('gaSubject').dataset.ready) return;
  $('gaSubject').dataset.ready='1';
  $('gaBack').addEventListener('click',()=>{ $('gaDetailView').style.display='none'; $('gaListView').style.display='block'; });
  $('gaXls').addEventListener('click',exportXls);
  $('gaPdf').addEventListener('click',exportPdf);
  $('gaSaveNotes').addEventListener('click',saveNotes);
  $('gaXlsSubject').addEventListener('click',()=>bulkExport('subject','xlsx'));
  $('gaPdfSubject').addEventListener('click',()=>bulkExport('subject','pdf'));
  $('gaXlsAll').addEventListener('click',()=>bulkExport('all','xlsx'));
  $('gaPdfAll').addEventListener('click',()=>bulkExport('all','pdf'));
  $('gaCompareGo').addEventListener('click',openCompare);
  $('gaCompareBack').addEventListener('click',()=>{ $('gaCompareView').style.display='none'; $('gaDetailView').style.display='block'; });
  $('gaCompareXls').addEventListener('click',exportCompareXls);
  $('gaComparePdf').addEventListener('click',exportComparePdf);

  await loadCatsAndThresholds();
  if(S.FLAGS.isSeniorTeacher && !(S.FLAGS.isAdmin||S.FLAGS.isLead||S.FLAGS.isAnalysis)){
    SUPERVISED=await getSupervisedTeacherIds();
  }else SUPERVISED=null;

  const {data:subs}=await db.from('subjects').select('id,code,exam_total').order('code');
  SUBJECTS=subs||[];
  $('gaSubject').innerHTML=SUBJECTS.map(s=>`<option value="${s.id}">${s.code}</option>`).join('');
  $('gaSubject').addEventListener('change',()=>{ CUR_SUBJECT=SUBJECTS.find(s=>s.id===$('gaSubject').value); loadGrid(); });
  if(SUBJECTS.length){ CUR_SUBJECT=SUBJECTS[0]; loadGrid(); }
}
async function loadCatsAndThresholds(){
  const [{data:cats},{data:th}] = await Promise.all([
    db.from('grade_categories').select('*').order('sort_order'),
    db.from('grade_settings').select('*').eq('id',1).maybeSingle(),
  ]);
  CATS=cats||[];
  if(th) THRESH=th;
}
function categoryOf(pct){
  return CATS.find(c=>pct>=c.min_pct && pct<=c.max_pct) || null;
}

/* ============ نطاق إشراف المعلمة الأولى: قسمها + استثناءات ============ */
async function getSupervisedTeacherIds(){
  const deptId=S.ME.department_id;
  const {data:deptTeachers} = deptId ? await db.from('staff').select('id').eq('department_id',deptId) : {data:[]};
  const set=new Set((deptTeachers||[]).map(t=>t.id));
  set.add(S.ME.id);
  const {data:links}=await db.from('supervision_links').select('teacher_staff_id,mode').eq('senior_staff_id',S.ME.id);
  for(const l of links||[]){ if(l.mode==='include') set.add(l.teacher_staff_id); else set.delete(l.teacher_staff_id); }
  return set;
}

/* ============ شاشة المتابعة: شعبة × اختبار ============ */
async function fetchSectionsForSubject(subjectId){
  const {data:rows,error}=await db.from('entry_teachers')
    .select('staff_id, staff(full_name), timetable_entries!inner(section_id,subject_id,academic_year_id,sections(code))')
    .eq('timetable_entries.subject_id',subjectId).eq('timetable_entries.academic_year_id',S.YEAR.id);
  if(error) return {error};
  const secMap={};
  for(const r of rows||[]){
    const e=r.timetable_entries; if(!e?.section_id) continue;
    if(SUPERVISED && !SUPERVISED.has(r.staff_id)) continue;
    const code=e.sections?.code||'؟';
    secMap[code] ??= {section_id:e.section_id, teachers:new Set()};
    if(r.staff?.full_name) secMap[code].teachers.add(r.staff.full_name);
  }
  return {secMap};
}
async function loadGrid(){
  const tbl=$('gaTable');
  tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">جارٍ التحميل…</td></tr>';
  if(!CUR_SUBJECT){ tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا مقررات بعد.</td></tr>'; return; }
  const {secMap,error}=await fetchSectionsForSubject(CUR_SUBJECT.id);
  if(error){ tbl.innerHTML=`<tr><td style="padding:30px;text-align:center;color:#8a93a0">تعذر التحميل: ${error.message}</td></tr>`; return; }
  const codes=Object.keys(secMap).sort((a,b)=>a.localeCompare(b,'ar'));
  if(!codes.length){ tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا شعب ضمن نطاقك لهذا المقرر.</td></tr>'; return; }

  const {data:exams}=await db.from('exams').select('id,name,section_id').eq('subject_id',CUR_SUBJECT.id);
  const {data:enr}=await db.from('enrollments').select('section_id').is('to_date',null);
  const enrolledCount={}; for(const e of enr||[]) enrolledCount[e.section_id]=(enrolledCount[e.section_id]||0)+1;

  const examBySecName={};
  for(const ex of exams||[]) examBySecName[`${ex.section_id}|${ex.name}`]=ex;
  const examIds=(exams||[]).map(e=>e.id);
  const countBy={};
  for(const c of chunk(examIds,200)){
    const {data:recs}=await db.from('grade_records').select('exam_id').in('exam_id',c).not('score','is',null);
    for(const r of recs||[]) countBy[r.exam_id]=(countBy[r.exam_id]||0)+1;
  }

  let html='<tr><th>الشعبة</th><th>المعلمة</th>'+EXAM_NAMES.map(n=>`<th>${n}</th>`).join('')+'</tr>';
  for(const code of codes){
    const sec=secMap[code];
    html+=`<tr><td class="sec">${code}</td><td style="font-size:12px">${[...sec.teachers].join(' / ')||'—'}</td>`;
    for(const name of EXAM_NAMES){
      const ex=examBySecName[`${sec.section_id}|${name}`];
      if(!ex){ html+='<td><div class="ga-cell empty">لم يُنشأ</div></td>'; continue; }
      const done=countBy[ex.id]||0, total=enrolledCount[sec.section_id]||0;
      html+=`<td><div class="ga-cell" data-exam="${ex.id}" data-sec="${code}" data-secid="${sec.section_id}" data-name="${name}">
        <b>${done}/${total}</b><small>${done>=total&&total>0?'مكتمل ✓':'رصد جزئي'}</small></div></td>`;
    }
    html+='</tr>';
  }
  tbl.innerHTML=html;
  tbl.querySelectorAll('.ga-cell[data-exam]').forEach(el=>el.addEventListener('click',()=>openDetail(el.dataset)));
}

/* ============ شاشة التحليل التفصيلي ============ */
async function buildDetail(secId,secCode,examId,examName){
  const {data:enr}=await db.from('enrollments').select('students(id,full_name,academic_number)').eq('section_id',secId).is('to_date',null);
  const students=(enr||[]).map(e=>e.students).filter(Boolean);
  const {data:recs}=await db.from('grade_records').select('student_id,score').eq('exam_id',examId);
  const scoreBy={}; for(const r of recs||[]) if(r.score!=null) scoreBy[r.student_id]=r.score;
  const {data:notes}=await db.from('grade_notes').select('*').eq('exam_id',examId);
  const generalNote=(notes||[]).find(n=>!n.student_id)||null;
  const noteBy={}; for(const n of notes||[]) if(n.student_id) noteBy[n.student_id]=n;

  const total=CUR_SUBJECT.exam_total;
  const rows=students.map(s=>{
    const score=scoreBy[s.id];
    const pct = score!=null ? (score/total*100) : null;
    const cat = pct!=null ? categoryOf(pct) : null;
    const n=noteBy[s.id];
    return {...s, score, pct, cat, note:n?.note||'', action:n?.action_taken||''};
  }).sort((a,b)=>numKey(a.academic_number)-numKey(b.academic_number));

  const graded=rows.filter(r=>r.score!=null);
  const passCount=graded.filter(r=>r.pct>=THRESH.pass_pct).length;
  const masteryCount=graded.filter(r=>r.pct>=THRESH.mastery_pct).length;
  const failCount=graded.length-passCount;
  return {secId,secCode,examId,examName,students,rows,graded,passCount,masteryCount,failCount,generalNote};
}

async function openDetail(d){
  $('gaListView').style.display='none'; $('gaDetailView').style.display='block';
  $('gaDetailTitle').textContent=`${d.sec} — ${CUR_SUBJECT.code} — ${d.name}`;
  $('gaDetailSub').textContent=`الدرجة الكلية: ${CUR_SUBJECT.exam_total}`;
  $('gaStats').innerHTML=''; $('gaCatTable').innerHTML='';
  $('gaStudentTable').innerHTML='<tr><td style="padding:20px;text-align:center;color:#8a93a0">جارٍ التحميل…</td></tr>';
  $('gaGenNote').value=''; $('gaGenAction').value='';

  const det=await buildDetail(d.secid,d.sec,d.exam,d.name);
  renderDetail(det);
  CUR_DETAIL=det;
}
function renderDetail(det){
  $('gaStats').innerHTML=`
    <div class="stat"><b>${det.students.length}</b><span>إجمالي الطالبات</span></div>
    <div class="stat"><b>${det.graded.length}</b><span>تم رصدهن</span></div>
    <div class="stat green"><b>${det.graded.length?((det.passCount/det.graded.length*100).toFixed(1)+'٪'):'—'}</b><span>نسبة النجاح</span></div>
    <div class="stat"><b>${det.graded.length?((det.masteryCount/det.graded.length*100).toFixed(1)+'٪'):'—'}</b><span>نسبة الإتقان</span></div>
    <div class="stat red"><b>${det.graded.length?((det.failCount/det.graded.length*100).toFixed(1)+'٪'):'—'}</b><span>نسبة الرسوب</span></div>`;

  const perCat={}; for(const c of CATS) perCat[c.id]={cat:c,count:0};
  for(const r of det.graded) if(r.cat) perCat[r.cat.id].count++;
  $('gaCatTable').innerHTML='<tr><th>الفئة</th><th>الحد</th><th>العدد</th></tr>'+
    CATS.map(c=>`<tr><td><span class="ga-swatch" style="background:${c.color}"></span>${c.name}</td><td class="c">${c.min_pct}–${c.max_pct}٪</td><td class="c">${perCat[c.id].count}</td></tr>`).join('');

  $('gaGenNote').value=det.generalNote?.note||'';
  $('gaGenAction').value=det.generalNote?.action_taken||'';

  $('gaStudentTable').innerHTML='<tr><th>#</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>الدرجة</th><th>النسبة</th><th>الفئة</th><th>ملاحظة</th><th>إجراء</th></tr>'+
    det.rows.map((r,i)=>`<tr style="${r.cat?`background:${r.cat.color}22`:''}">
      <td class="c">${i+1}</td><td class="c">${r.academic_number}</td><td>${r.full_name}</td>
      <td class="c">${r.score??'—'}</td><td class="c">${r.pct!=null?r.pct.toFixed(1)+'٪':'—'}</td>
      <td class="c">${r.cat?`<span class="ga-swatch" style="background:${r.cat.color}"></span>${r.cat.name}`:'—'}</td>
      <td><input class="ga-note-input" data-sid="${r.id}" data-f="note" value="${r.note.replace(/"/g,'&quot;')}"></td>
      <td><input class="ga-note-input" data-sid="${r.id}" data-f="action" value="${r.action.replace(/"/g,'&quot;')}"></td></tr>`).join('');
}

async function saveNotes(){
  if(!CUR_DETAIL) return;
  const btn=$('gaSaveNotes'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    const genNote=$('gaGenNote').value.trim(), genAction=$('gaGenAction').value.trim();
    if(genNote||genAction){
      const payload={exam_id:CUR_DETAIL.examId, student_id:null, note:genNote||null, action_taken:genAction||null,
        created_by:S.ME.id, updated_at:new Date().toISOString()};
      if(CUR_DETAIL.generalNote){
        await db.from('grade_notes').update(payload).eq('id',CUR_DETAIL.generalNote.id);
      }else{
        const {data}=await db.from('grade_notes').insert(payload).select('id').single();
        CUR_DETAIL.generalNote={id:data.id,...payload};
      }
    }
    const byId={}; document.querySelectorAll('#gaStudentTable input[data-sid]').forEach(inp=>{
      byId[inp.dataset.sid] ??= {}; byId[inp.dataset.sid][inp.dataset.f]=inp.value.trim();
    });
    let saved=0;
    for(const [sid,vals] of Object.entries(byId)){
      if(!vals.note && !vals.action) continue;
      const {error}=await db.from('grade_notes').upsert({
        exam_id:CUR_DETAIL.examId, student_id:sid, note:vals.note||null, action_taken:vals.action||null,
        created_by:S.ME.id, updated_at:new Date().toISOString()
      },{onConflict:'exam_id,student_id'});
      if(!error) saved++;
    }
    toast('تم حفظ الملاحظات والإجراءات');
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ الملاحظات والإجراءات'; }
}

/* ============ تصدير إكسل/PDF لاختبار واحد ============ */
const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const gaBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
function addGaSheet(wb,d,subjectCode,examTotal){
  const ws=wb.addWorksheet(`${d.secCode}-${d.examName}`.slice(0,31),{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,6);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle(`${d.secCode} — ${subjectCode} — ${d.examName} — من ${examTotal}`,12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['#','الرقم الأكاديمي','اسم الطالبة','الدرجة','النسبة','الفئة']);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=gaBorder; });
  d.rows.forEach((r,i)=>{
    const row=ws.addRow([i+1, r.academic_number, r.full_name, r.score??'', r.pct!=null?r.pct.toFixed(1)+'٪':'', r.cat?.name||'']);
    row.eachCell((c,colNo)=>{
      c.border=gaBorder; c.alignment={horizontal: colNo===3?'right':'center'}; c.font={size:10.5}; c.numFmt='@';
      if(colNo===4 && r.cat) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+r.cat.color.replace('#','')}};
    });
  });
  ws.addRow([]);
  const sHdr=ws.addRow(['الإجمالي','المرصودات','نسبة النجاح','نسبة الإتقان','نسبة الرسوب']);
  sHdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=gaBorder; });
  const sRow=ws.addRow([d.rows.length, d.graded.length,
    d.graded.length?((d.passCount/d.graded.length*100).toFixed(1)+'٪'):'—',
    d.graded.length?((d.masteryCount/d.graded.length*100).toFixed(1)+'٪'):'—',
    d.graded.length?((d.failCount/d.graded.length*100).toFixed(1)+'٪'):'—']);
  sRow.eachCell(c=>{ c.border=gaBorder; c.alignment={horizontal:'center'}; });
  ws.columns=[{width:6},{width:16},{width:28},{width:10},{width:10},{width:18}];
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:4}];
}
async function exportXls(){
  if(!CUR_DETAIL){ toast('افتحي تحليل اختبار أولاً'); return; }
  const wb=new ExcelJS.Workbook();
  addGaSheet(wb,CUR_DETAIL,CUR_SUBJECT.code,CUR_SUBJECT.exam_total);
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url;
  a.download=`كشف_الدرجات_${CUR_DETAIL.secCode}_${CUR_SUBJECT.code}_${CUR_DETAIL.examName}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}
function gaPageHtml(d,subjectCode,examTotal){
  const rows=d.rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r.academic_number}</td><td style="text-align:right">${r.full_name}</td>
    <td>${r.score??'—'}</td><td>${r.pct!=null?r.pct.toFixed(1)+'٪':'—'}</td><td>${r.cat?.name||'—'}</td></tr>`).join('');
  return `<div class="ga-page">
    <div class="ga-head"><h2>كشف الدرجات والتصنيف — ${d.secCode} — ${subjectCode} — ${d.examName}</h2>
      <p>الدرجة الكلية: ${examTotal} — نجاح: ${d.graded.length?((d.passCount/d.graded.length*100).toFixed(1)+'٪'):'—'} — إتقان: ${d.graded.length?((d.masteryCount/d.graded.length*100).toFixed(1)+'٪'):'—'} — رسوب: ${d.graded.length?((d.failCount/d.graded.length*100).toFixed(1)+'٪'):'—'}</p></div>
    <table class="ga-tbl"><tr><th>#</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>الدرجة</th><th>النسبة</th><th>الفئة</th></tr>${rows}</table>
  </div>`;
}
function exportPdf(){
  if(!CUR_DETAIL){ toast('افتحي تحليل اختبار أولاً'); return; }
  const footer=`<div class="ga-footer">${schoolName()} — طُبع بتاريخ ${new Date().toISOString().slice(0,10)}</div>`;
  $('printAreaGA').innerHTML=gaPageHtml(CUR_DETAIL,CUR_SUBJECT.code,CUR_SUBJECT.exam_total)+footer;
  printWithTitle(`كشف_الدرجات_${CUR_DETAIL.secCode}_${CUR_SUBJECT.code}_${CUR_DETAIL.examName}`);
}

/* ============ تصدير مجمّع: مقرر كامل أو كل المقررات ============ */
async function collectSubjectDetails(subject){
  const {secMap}=await fetchSectionsForSubject(subject.id);
  const details=[];
  for(const code of Object.keys(secMap||{}).sort((a,b)=>a.localeCompare(b,'ar'))){
    const sec=secMap[code];
    const {data:exams}=await db.from('exams').select('id,name').eq('subject_id',subject.id).eq('section_id',sec.section_id);
    for(const name of EXAM_NAMES){
      const ex=(exams||[]).find(e=>e.name===name);
      if(!ex) continue;
      const {data:recs}=await db.from('grade_records').select('id').eq('exam_id',ex.id).not('score','is',null);
      if(!(recs||[]).length) continue; // تجاهل الاختبارات غير المرصودة إطلاقاً
      const det=await buildDetail(sec.section_id,code,ex.id,name);
      details.push(det);
    }
  }
  return details;
}
async function bulkExport(scope,kind){
  const btn=scope==='subject' ? (kind==='xlsx'?$('gaXlsSubject'):$('gaPdfSubject')) : (kind==='xlsx'?$('gaXlsAll'):$('gaPdfAll'));
  $('gaBulkStatus').style.display='block'; $('gaBulkStatus').className='result';
  $('gaBulkStatus').textContent='جارٍ التجميع… قد يستغرق وقتاً حسب عدد الشعب.';
  btn.disabled=true;
  try{
    let allDetails=[];
    if(scope==='subject'){
      if(!CUR_SUBJECT){ toast('اختاري مقرراً'); return; }
      allDetails=(await collectSubjectDetails(CUR_SUBJECT)).map(d=>({...d, subjectCode:CUR_SUBJECT.code, examTotal:CUR_SUBJECT.exam_total}));
    }else{
      for(const subj of SUBJECTS){
        const ds=await collectSubjectDetails(subj);
        allDetails.push(...ds.map(d=>({...d, subjectCode:subj.code, examTotal:subj.exam_total})));
      }
    }
    if(!allDetails.length){ toast('لا اختبارات مرصودة في هذا النطاق'); return; }
    if(kind==='xlsx'){
      const wb=new ExcelJS.Workbook();
      for(const d of allDetails) addGaSheet(wb,d,d.subjectCode,d.examTotal);
      const buf=await wb.xlsx.writeBuffer();
      const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url;
      a.download=(scope==='subject'?`كشوف_${CUR_SUBJECT.code}`:'كشوف_كل_المقررات')+'.xlsx'; a.click();
      URL.revokeObjectURL(url);
    }else{
      const footer=`<div class="ga-footer">${schoolName()} — طُبع بتاريخ ${new Date().toISOString().slice(0,10)}</div>`;
      $('printAreaGA').innerHTML=allDetails.map(d=>gaPageHtml(d,d.subjectCode,d.examTotal)).join('')+footer;
      printWithTitle(scope==='subject'?`كشوف_${CUR_SUBJECT.code}`:'كشوف_كل_المقررات');
    }
  }catch(err){ toast('تعذر التصدير: '+(err.message||err)); }
  finally{ btn.disabled=false; $('gaBulkStatus').style.display='none'; }
}

/* ============ مقارنة بين اختبارين أو أكثر ============ */
let CMP_RESULT=null;
async function openCompare(){
  if(!CUR_DETAIL) return;
  $('gaDetailView').style.display='none'; $('gaCompareView').style.display='block';
  $('gaCompareTitle').textContent=`${CUR_DETAIL.secCode} — ${CUR_SUBJECT.code}`;
  $('gaCompareSub').textContent='اختاري اختبارين أو أكثر للمقارنة';
  $('gaCompareResults').style.display='none';
  const {data:exams}=await db.from('exams').select('id,name').eq('subject_id',CUR_SUBJECT.id).eq('section_id',CUR_DETAIL.secId);
  const ordered=EXAM_NAMES.map(n=>(exams||[]).find(e=>e.name===n)).filter(Boolean);
  if(ordered.length<2){ $('gaCompareExamPick').innerHTML='<div class="empty-day">تحتاجين اختبارين على الأقل لهذه الشعبة للمقارنة.</div>'; return; }
  $('gaCompareExamPick').innerHTML=ordered.map(e=>`
    <label class="ga-cmp-check"><input type="checkbox" value="${e.id}" data-name="${e.name}" ${e.id===CUR_DETAIL.examId?'checked':''}> ${e.name}</label>`).join('')+
    `<button class="btn gold" id="gaCompareRun" style="width:auto;padding:10px 22px;margin-inline-start:10px">قارني</button>`;
  $('gaCompareRun').addEventListener('click',runCompare);
}
async function runCompare(){
  const checked=[...$('gaCompareExamPick').querySelectorAll('input:checked')];
  if(checked.length<2){ toast('اختاري اختبارين على الأقل'); return; }
  const exams=checked.map(c=>({id:c.value,name:c.dataset.name}));
  const {data:enr}=await db.from('enrollments').select('students(id,full_name,academic_number)').eq('section_id',CUR_DETAIL.secId).is('to_date',null);
  const students=(enr||[]).map(e=>e.students).filter(Boolean).sort((a,b)=>numKey(a.academic_number)-numKey(b.academic_number));
  const total=CUR_SUBJECT.exam_total;
  const scoresByExam={};
  for(const ex of exams){
    const {data:recs}=await db.from('grade_records').select('student_id,score').eq('exam_id',ex.id);
    scoresByExam[ex.id]={}; for(const r of recs||[]) if(r.score!=null) scoresByExam[ex.id][r.student_id]=r.score;
  }
  const rows=students.map(s=>{
    const scores=exams.map(ex=>scoresByExam[ex.id][s.id] ?? null);
    return {...s, scores};
  });
  const examStats=exams.map(ex=>{
    const vals=Object.values(scoresByExam[ex.id]);
    const pcts=vals.map(v=>v/total*100);
    const pass=pcts.filter(p=>p>=THRESH.pass_pct).length, mastery=pcts.filter(p=>p>=THRESH.mastery_pct).length;
    return {name:ex.name, graded:vals.length,
      passPct: vals.length?(pass/vals.length*100):null, masteryPct: vals.length?(mastery/vals.length*100):null,
      avg: vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length):null};
  });

  $('gaCompareStatsTable').innerHTML='<tr><th>الاختبار</th><th>عدد المرصودات</th><th>متوسط الدرجة</th><th>نسبة النجاح</th><th>نسبة الإتقان</th></tr>'+
    examStats.map(s=>`<tr><td class="sec">${s.name}</td><td class="c">${s.graded}</td><td class="c">${s.avg!=null?s.avg.toFixed(1):'—'}</td>
      <td class="c">${s.passPct!=null?s.passPct.toFixed(1)+'٪':'—'}</td><td class="c">${s.masteryPct!=null?s.masteryPct.toFixed(1)+'٪':'—'}</td></tr>`).join('');

  $('gaCompareTable').innerHTML='<tr><th>#</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th>'+exams.map(e=>`<th>${e.name}</th>`).join('')+'<th>الفرق (آخر-أول)</th></tr>'+
    rows.map((r,i)=>{
      const first=r.scores.find(v=>v!=null), last=[...r.scores].reverse().find(v=>v!=null);
      const diff = first!=null&&last!=null ? (last-first) : null;
      const diffTxt = diff==null?'—':(diff>0?`+${diff}`:diff);
      const diffColor = diff==null?'':(diff>0?'color:var(--ok)':diff<0?'color:var(--err)':'');
      return `<tr><td class="c">${i+1}</td><td class="c">${r.academic_number}</td><td>${r.full_name}</td>`+
        r.scores.map(v=>`<td class="c">${v??'—'}</td>`).join('')+
        `<td class="c" style="${diffColor};font-weight:700">${diffTxt}</td></tr>`;
    }).join('');

  $('gaCompareResults').style.display='block';
  CMP_RESULT={secCode:CUR_DETAIL.secCode, subjectCode:CUR_SUBJECT.code, exams, rows, examStats};
}
async function exportCompareXls(){
  if(!CMP_RESULT){ toast('شغّلي المقارنة أولاً'); return; }
  const c=CMP_RESULT;
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('المقارنة',{views:[{rightToLeft:true}]});
  const cols=3+c.exams.length+1;
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,cols);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle(`مقارنة الاختبارات — ${c.secCode} — ${c.subjectCode}`,12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['#','الرقم الأكاديمي','اسم الطالبة',...c.exams.map(e=>e.name),'الفرق']);
  hdr.eachCell(cell=>{ cell.font={bold:true,color:{argb:WHITE}}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; cell.alignment={horizontal:'center'}; cell.border=gaBorder; });
  c.rows.forEach((r,i)=>{
    const first=r.scores.find(v=>v!=null), last=[...r.scores].reverse().find(v=>v!=null);
    const diff = first!=null&&last!=null ? (last-first) : '';
    const row=ws.addRow([i+1, r.academic_number, r.full_name, ...r.scores.map(v=>v??''), diff]);
    row.eachCell((cell,colNo)=>{ cell.border=gaBorder; cell.alignment={horizontal:colNo===3?'right':'center'}; cell.font={size:10.5}; cell.numFmt='@'; });
  });
  ws.columns=[{width:6},{width:16},{width:28},...c.exams.map(()=>({width:12})),{width:10}];
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:4}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`مقارنة_${c.secCode}_${c.subjectCode}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}
function exportComparePdf(){
  if(!CMP_RESULT){ toast('شغّلي المقارنة أولاً'); return; }
  const c=CMP_RESULT;
  const rows=c.rows.map((r,i)=>{
    const first=r.scores.find(v=>v!=null), last=[...r.scores].reverse().find(v=>v!=null);
    const diff = first!=null&&last!=null ? (last-first) : '—';
    return `<tr><td>${i+1}</td><td>${r.academic_number}</td><td style="text-align:right">${r.full_name}</td>${r.scores.map(v=>`<td>${v??'—'}</td>`).join('')}<td>${diff}</td></tr>`;
  }).join('');
  const footer=`<div class="ga-footer">${schoolName()} — طُبع بتاريخ ${new Date().toISOString().slice(0,10)}</div>`;
  $('printAreaGA').innerHTML=`
    <div class="ga-page">
      <div class="ga-head"><h2>مقارنة الاختبارات — ${c.secCode} — ${c.subjectCode}</h2></div>
      <table class="ga-tbl"><tr><th>الاختبار</th><th>عدد المرصودات</th><th>متوسط الدرجة</th><th>نسبة النجاح</th><th>نسبة الإتقان</th></tr>
        ${c.examStats.map(s=>`<tr><td>${s.name}</td><td>${s.graded}</td><td>${s.avg!=null?s.avg.toFixed(1):'—'}</td><td>${s.passPct!=null?s.passPct.toFixed(1)+'٪':'—'}</td><td>${s.masteryPct!=null?s.masteryPct.toFixed(1)+'٪':'—'}</td></tr>`).join('')}
      </table>
      <table class="ga-tbl"><tr><th>#</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th>${c.exams.map(e=>`<th>${e.name}</th>`).join('')}<th>الفرق</th></tr>${rows}</table>
    </div>${footer}`;
  printWithTitle(`مقارنة_${c.secCode}_${c.subjectCode}`);
}

registerTab({id:'gaMain', label:'تحليل الاختبارات', group:'grades', groupLabel:'الدرجات',
  show:f=>f.isAdmin||f.isLead||f.isAnalysis||f.isSeniorTeacher, init:initAnalysis});
