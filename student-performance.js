/* student-performance.js — أداء الطالبات (استعراض متعدد المستويات)
   نفس العملية الواحدة على أربعة مستويات: طالبة واحدة، صف، مدرسة كاملة،
   أو مقرر — مع فلترة اختيارية بالمقرر والاختبار. نطاق الرؤية يتبع الدور:
   الأدمن/القيادة/رئيسة التحليل/الإرشاد الأكاديمي بلا قيد؛ المعلمة الأولى
   ضمن إشرافها؛ المعلمة على نطاقها فقط (ومستوى "مدرسة" مخفي عنها). */
import { db, $, S, clean, chunk, toast, printWithTitle, registerTab } from './core.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';
const EXAM_NAMES = ['اختبار تشخيصي','الاختبار الأول','الاختبار الثاني'];
const numKey = v => parseInt(String(v).replace(/[^\d]/g,''),10) || 0;

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="spMain" style="display:none">
  <div class="panel">
    <h3>تتبع الدرجات</h3>
    <div class="sub">اختاري المستوى، ثم حددي فلاتر المقرر والاختبار إن أردت.</div>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
      <select id="spScope" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)">
        <option value="student">طالبة واحدة</option>
        <option value="section">صف (شعبة)</option>
        <option value="subject">مقرر</option>
        <option value="school">المدرسة كاملة</option>
      </select>
      <div id="spPickerBox"></div>
    </div>
    <div class="sub">فلتر المقرر (اختياري)</div>
    <select id="spSubjectFilter" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);margin-bottom:12px;min-width:180px">
      <option value="">كل المقررات</option>
    </select>
    <div class="sub">فلتر الاختبار (اختياري)</div>
    <div id="spExamFilter" style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 14px"></div>
    <button class="btn gold" id="spGo" style="width:auto;padding:11px 26px">عرض النتائج</button>
  </div>

  <div id="spResults" style="display:none">
    <div class="stats" id="spStats"></div>
    <div class="panel">
      <div class="actions" style="margin-bottom:14px">
        <button class="btn ghost" id="spXls">⬇ إكسل</button>
        <button class="btn ghost" id="spPdf">⬇ PDF</button>
      </div>
      <div class="board-wrap"><table class="board" id="spTable"></table></div>
    </div>
  </div>
</div>
<div id="printAreaSP"></div>
<style>
  #spMain.wide{max-width:1400px}
  #spPickerBox input, #spPickerBox select{padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:220px}
  #spPickerBox{position:relative}
  .sp-exam-check{display:inline-flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--line);border-radius:9px;padding:8px 14px;cursor:pointer}
  .sp-cat-chip{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700}
  #printAreaSP{display:none}
  @media print{
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaSP, #printAreaSP *{visibility:visible}
    #printAreaSP{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
    .sp-head{text-align:center;margin-bottom:12px}
    .sp-head h2{font-size:15px;color:#1d3d5c;font-weight:600;margin-bottom:6px}
    .sp-tbl{width:100%;border-collapse:collapse;font-size:10px}
    .sp-tbl th{background:#1d3d5c;color:#fff;padding:5px;border:1px solid #1d3d5c}
    .sp-tbl td{padding:4px;border:1px solid #ccc;text-align:center}
  }
</style>`);

let CATS=[], THRESH={pass_pct:50,mastery_pct:80}, SCOPE_PAIRS=null; // null = بلا قيد
let PICKED_STUDENT=null, ROWS=[];

async function initSP(){
  if($('spGo').dataset.ready) return;
  $('spGo').dataset.ready='1';
  await loadCatsAndThresholds();
  await computeScopeRestriction();

  if(SCOPE_PAIRS){ // نطاق مقيّد (معلمة/معلمة أولى) — نخفي "المدرسة كاملة"
    $('spScope').querySelector('option[value="school"]').remove();
  }

  const {data:subs}=await db.from('subjects').select('id,code').order('code');
  const allowedSubjIds = SCOPE_PAIRS ? new Set([...SCOPE_PAIRS].map(p=>p.split('|')[0])) : null;
  const subjOptions=(subs||[]).filter(s=>!allowedSubjIds || allowedSubjIds.has(s.id));
  $('spSubjectFilter').innerHTML='<option value="">كل المقررات</option>'+subjOptions.map(s=>`<option value="${s.id}">${s.code}</option>`).join('');

  $('spExamFilter').innerHTML=EXAM_NAMES.map(n=>`<label class="sp-exam-check"><input type="checkbox" value="${n}"> ${n}</label>`).join('');

  $('spScope').addEventListener('change',renderPicker);
  renderPicker();

  $('spGo').addEventListener('click',runSearch);
  $('spXls').addEventListener('click',exportXls);
  $('spPdf').addEventListener('click',exportPdf);
}

async function loadCatsAndThresholds(){
  const [{data:cats},{data:th}]=await Promise.all([
    db.from('grade_categories').select('*').order('sort_order'),
    db.from('grade_settings').select('*').eq('id',1).maybeSingle(),
  ]);
  CATS=cats||[]; if(th) THRESH=th;
}
function categoryOf(pct){ return CATS.find(c=>pct>=c.min_pct && pct<=c.max_pct) || null; }

/* نطاق الرؤية: null لغير المقيَّدين، أو Set بصيغة "subjectId|sectionId" */
async function computeScopeRestriction(){
  if(S.FLAGS.isAdmin||S.FLAGS.isLead||S.FLAGS.isAnalysis||S.FLAGS.isAcademicGuidance){ SCOPE_PAIRS=null; return; }
  if(S.FLAGS.isSeniorTeacher){
    const deptId=S.ME.department_id;
    const {data:deptTeachers}=deptId?await db.from('staff').select('id').eq('department_id',deptId):{data:[]};
    const set=new Set((deptTeachers||[]).map(t=>t.id)); set.add(S.ME.id);
    const {data:links}=await db.from('supervision_links').select('teacher_staff_id,mode').eq('senior_staff_id',S.ME.id);
    for(const l of links||[]){ if(l.mode==='include') set.add(l.teacher_staff_id); else set.delete(l.teacher_staff_id); }
    const {data:ents}=await db.from('entry_teachers').select('staff_id,timetable_entries!inner(section_id,subject_id,academic_year_id)')
      .eq('timetable_entries.academic_year_id',S.YEAR.id);
    SCOPE_PAIRS=new Set();
    for(const e of ents||[]) if(set.has(e.staff_id)) SCOPE_PAIRS.add(`${e.timetable_entries.subject_id}|${e.timetable_entries.section_id}`);
    return;
  }
  // معلمة عادية
  const {data:ents}=await db.from('entry_teachers').select('timetable_entries!inner(section_id,subject_id,academic_year_id)')
    .eq('staff_id',S.ME.id).eq('timetable_entries.academic_year_id',S.YEAR.id);
  SCOPE_PAIRS=new Set();
  for(const e of ents||[]) SCOPE_PAIRS.add(`${e.timetable_entries.subject_id}|${e.timetable_entries.section_id}`);
}

function renderPicker(){
  const scope=$('spScope').value;
  PICKED_STUDENT=null;
  if(scope==='student'){
    $('spPickerBox').innerHTML=`<input type="text" id="spStudentSearch" placeholder="اسم الطالبة أو رقمها الأكاديمي…"><div class="sugg" id="spStudentSugg"></div>`;
    let deb=null;
    $('spStudentSearch').addEventListener('input',()=>{
      clearTimeout(deb);
      deb=setTimeout(async ()=>{
        const q=clean($('spStudentSearch').value);
        const box=$('spStudentSugg');
        if(q.length<2){ box.style.display='none'; return; }
        const {data:st}=await db.from('students').select('id,full_name,academic_number')
          .or(`full_name.ilike.%${q}%,academic_number.ilike.%${q}%`).limit(8);
        if(!(st||[]).length){ box.style.display='none'; return; }
        box.innerHTML=st.map((s,i)=>`<div data-i="${i}">${s.full_name}<small>${s.academic_number}</small></div>`).join('');
        box.style.display='block';
        box.querySelectorAll('div').forEach((el,i)=>el.addEventListener('click',()=>{
          PICKED_STUDENT=st[i]; $('spStudentSearch').value=st[i].full_name; box.style.display='none';
        }));
      },300);
    });
  }else if(scope==='section'){
    db.from('sections').select('id,code').eq('academic_year_id',S.YEAR.id).order('code').then(({data})=>{
      $('spPickerBox').innerHTML=`<select id="spSectionPick"><option value="">اختاري الشعبة…</option>${(data||[]).map(s=>`<option value="${s.id}">${s.code}</option>`).join('')}</select>`;
    });
  }else if(scope==='subject'){
    $('spPickerBox').innerHTML=`<select id="spSubjectPick">${$('spSubjectFilter').innerHTML.replace('كل المقررات','اختاري المقرر…')}</select>`;
  }else{
    $('spPickerBox').innerHTML='';
  }
}

async function runSearch(){
  const scope=$('spScope').value;
  const subjectFilter=$('spSubjectFilter').value;
  const examNames=[...$('spExamFilter').querySelectorAll('input:checked')].map(i=>i.value);

  let query=db.from('grade_records').select(`
    student_id, score,
    students(full_name,academic_number),
    exams!inner(id,name,exam_total,subject_id,section_id,subjects(code,exam_total),sections(code))
  `).not('score','is',null);

  if(scope==='student'){
    if(!PICKED_STUDENT){ toast('اختاري طالبة'); return; }
    query=query.eq('student_id',PICKED_STUDENT.id);
  }else if(scope==='section'){
    const secId=$('spSectionPick')?.value;
    if(!secId){ toast('اختاري الشعبة'); return; }
    query=query.eq('exams.section_id',secId);
  }else if(scope==='subject'){
    const subjId=$('spSubjectPick')?.value;
    if(!subjId){ toast('اختاري المقرر'); return; }
    query=query.eq('exams.subject_id',subjId);
  }
  if(subjectFilter && scope!=='subject') query=query.eq('exams.subject_id',subjectFilter);
  if(examNames.length) query=query.in('exams.name',examNames);

  const {data,error}=await query;
  if(error){ toast('تعذر التحميل: '+error.message); return; }

  let rows=(data||[]).filter(r=>r.score!=null).map(r=>{
    const ex=r.exams;
    const total=ex.exam_total ?? ex.subjects?.exam_total ?? 25; // احتياطي أخير لو تعذّر إيجاد الدرجة الكلية من أي مصدر
    const pct=r.score/total*100, cat=categoryOf(pct);
    return {student:r.students?.full_name||'—', acad:r.students?.academic_number||'—',
      sec:ex.sections?.code||'—', subj:ex.subjects?.code||'—', exam:ex.name,
      score:r.score, total, pct, cat, studentId:r.student_id, subjectId:ex.subject_id, sectionId:ex.section_id};
  });
  if(SCOPE_PAIRS) rows=rows.filter(r=>SCOPE_PAIRS.has(`${r.subjectId}|${r.sectionId}`));
  rows.sort((a,b)=>a.sec.localeCompare(b.sec,'ar')||numKey(a.acad)-numKey(b.acad)||a.subj.localeCompare(b.subj,'ar')||EXAM_NAMES.indexOf(a.exam)-EXAM_NAMES.indexOf(b.exam));
  ROWS=rows;
  render();
}

function pivotRows(){
  const groups={};
  for(const r of ROWS){
    const key=`${r.studentId}|${r.subjectId}`;
    groups[key] ??= {student:r.student, acad:r.acad, sec:r.sec, subj:r.subj, studentId:r.studentId, exams:{}};
    groups[key].exams[r.exam]=r;
  }
  return Object.values(groups).sort((a,b)=>a.sec.localeCompare(b.sec,'ar')||numKey(a.acad)-numKey(b.acad)||a.subj.localeCompare(b.subj,'ar'));
}
function presentExamNames(){
  return EXAM_NAMES.filter(n=>ROWS.some(r=>r.exam===n));
}
function examCellHtml(r){
  if(!r) return '<td class="c">—</td>';
  return `<td class="c" style="${r.cat?`background:${r.cat.color}33`:''}"><b>${r.score}/${r.total}</b><br><small>${r.pct.toFixed(1)}٪${r.cat?` — <span style="color:${r.cat.color}">${r.cat.name}</span>`:''}</small></td>`;
}

function render(){
  $('spResults').style.display='block';
  const uniqStudents=new Set(ROWS.map(r=>r.studentId)).size;
  const perCat={}; for(const c of CATS) perCat[c.id]=0;
  for(const r of ROWS) if(r.cat) perCat[r.cat.id]++;
  $('spStats').innerHTML=`
    <div class="stat"><b>${uniqStudents}</b><span>طالبة</span></div>
    <div class="stat"><b>${ROWS.length}</b><span>سجل درجة</span></div>
    ${CATS.map(c=>`<div class="stat"><b style="color:${c.color}">${perCat[c.id]}</b><span>${c.name}</span></div>`).join('')}`;
  if(!ROWS.length){ $('spTable').innerHTML='<tr><td style="padding:20px;text-align:center;color:#8a93a0">لا نتائج مطابقة</td></tr>'; return; }

  const groups=pivotRows(), exams=presentExamNames();
  $('spTable').innerHTML='<tr><th>الطالبة</th><th>الرقم الأكاديمي</th><th>الشعبة</th><th>المقرر</th>'+exams.map(n=>`<th>${n}</th>`).join('')+'</tr>'+
    groups.map(g=>`<tr>
      <td>${g.student}</td><td class="c">${g.acad}</td><td class="c">${g.sec}</td><td class="c">${g.subj}</td>
      ${exams.map(n=>examCellHtml(g.exams[n])).join('')}</tr>`).join('');
}

/* ============ تصدير ============ */
const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const spBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function exportXls(){
  if(!ROWS.length){ toast('لا بيانات للتصدير'); return; }
  const groups=pivotRows(), exams=presentExamNames();
  const cols=4+exams.length;
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('تتبع الدرجات',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,cols);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle('تتبع الدرجات',12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['الطالبة','الرقم الأكاديمي','الشعبة','المقرر',...exams]);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=spBorder; });
  groups.forEach((g,i)=>{
    const cells=exams.map(n=>{ const r=g.exams[n]; return r?`${r.score}/${r.total} (${r.pct.toFixed(1)}٪ ${r.cat?.name||''})`:''; });
    const row=ws.addRow([g.student,g.acad,g.sec,g.subj,...cells]);
    row.eachCell((c,colNo)=>{ c.border=spBorder; c.alignment={horizontal:colNo===1?'right':'center'}; c.font={size:10.5}; c.numFmt='@';
      const examIdx=colNo-5; // أعمدة الاختبارات تبدأ بعد الأعمدة الأربعة الأولى
      const r = examIdx>=0 ? g.exams[exams[examIdx]] : null;
      if(r?.cat) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+r.cat.color.replace('#','')}};
      else if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
  });
  ws.columns=[{width:26},{width:16},{width:11},{width:11},...exams.map(()=>({width:22}))];
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:3}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='تتبع_الدرجات.xlsx'; a.click();
  URL.revokeObjectURL(url);
}
function exportPdf(){
  if(!ROWS.length){ toast('لا بيانات للتصدير'); return; }
  const groups=pivotRows(), exams=presentExamNames();
  const rows=groups.map(g=>{
    const cells=exams.map(n=>{ const r=g.exams[n]; return `<td style="${r?.cat?`background:${r.cat.color}33`:''}">${r?`${r.score}/${r.total}<br>${r.pct.toFixed(1)}٪ ${r.cat?.name||''}`:'—'}</td>`; }).join('');
    return `<tr><td>${g.student}</td><td>${g.acad}</td><td>${g.sec}</td><td>${g.subj}</td>${cells}</tr>`;
  }).join('');
  $('printAreaSP').innerHTML=`
    <div class="sp-head"><h2>تتبع الدرجات</h2></div>
    <table class="sp-tbl"><tr><th>الطالبة</th><th>الرقم الأكاديمي</th><th>الشعبة</th><th>المقرر</th>${exams.map(n=>`<th>${n}</th>`).join('')}</tr>${rows}</table>`;
  printWithTitle('تتبع_الدرجات');
}

registerTab({id:'spMain', label:'تتبع الدرجات', group:'grades', groupLabel:'الدرجات',
  show:f=>f.isAdmin||f.isLead||f.isAnalysis||f.isAcademicGuidance||f.isSeniorTeacher, init:initSP});
