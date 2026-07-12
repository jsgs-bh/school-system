/* grades-entry.js — رصد الدرجات (المعلمة)
   شاشة فرعية تحت "حصصي" بجانب رصد الغياب. تعرض مقررات المعلمة (شعبة×مقرر)،
   تفتح/تنشئ اختباراً، ثم تتيح إدخال الدرجات بطريقتين معاً من البداية:
   شبكة تفاعلية تدعم لصق عمود كامل من إكسل، أو رفع ملف إكسل جاهز. */
import { db, $, S, toast, chunk, bindDrop, readSheet, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="gradesEntry" style="display:none">
  <div id="gSubjectsView">
    <div class="today-lbl" style="margin-bottom:12px">مقرراتي</div>
    <div id="gSubjList"></div>
  </div>

  <div id="gExamsView" style="display:none">
    <button class="back" id="gExamsBack">→ رجوع</button>
    <div class="today-lbl" id="gExamsTitle" style="margin:10px 0 12px">—</div>
    <div id="gExamList" style="margin-bottom:16px"></div>
    <div class="panel">
      <h3>اختبار جديد</h3>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <input type="text" id="gNewExamName" placeholder="اسم الاختبار (مثال: الاختبار الأول)" style="flex:1;min-width:180px;padding:10px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
        <input type="date" id="gNewExamDate">
        <button class="btn gold" id="gNewExamGo" style="width:auto;padding:10px 22px">إنشاء وفتح</button>
      </div>
    </div>
  </div>

  <div id="gGridView" style="display:none">
    <button class="back" id="gGridBack">→ رجوع</button>
    <div class="g-head">
      <div class="ttl"><b id="gGridTitle">—</b><span id="gGridSub">—</span></div>
      <div class="g-counter">مرصودة: <b id="gDoneCount">0</b> من <span id="gTotalCount">0</span></div>
    </div>
    <div class="g-tools">
      <div class="hint">الصقي عموداً كاملاً من إكسل داخل أي خانة (تُملأ الصفوف تباعاً)، أو اكتبي الدرجات يدوياً.</div>
      <div class="dropzone" id="gDrop" style="margin-top:10px"><b>أو ارفعي ملف إكسل: الرقم الأكاديمي + الدرجة</b><p>xlsx / xls — بلا ترويسة معقدة، عمودان فقط</p>
        <input type="file" id="gFile" accept=".xlsx,.xls" hidden></div>
    </div>
    <div class="g-grid" id="gGrid"></div>
    <button class="btn gold" id="gSave" style="margin-top:16px">حفظ الدرجات</button>
  </div>
</div>
<style>
  #gSubjList{display:flex;flex-direction:column;gap:10px}
  .g-subj{display:flex;align-items:center;justify-content:space-between;background:var(--white);border:1px solid var(--line);border-radius:12px;padding:14px 18px;cursor:pointer;transition:.15s}
  .g-subj:hover{border-color:var(--gold);background:var(--gold-soft)}
  .g-subj b{color:var(--navy);font-size:14.5px}
  .g-subj small{color:#6b7683;display:block;margin-top:2px}
  .g-exam{display:flex;align-items:center;justify-content:space-between;background:var(--white);border:1px solid var(--line);border-radius:11px;padding:12px 16px;margin-bottom:8px;cursor:pointer}
  .g-exam:hover{border-color:var(--gold)}
  .g-exam b{color:var(--navy)}
  .g-exam small{color:#6b7683}
  .g-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin:10px 0 14px}
  .g-head .ttl b{display:block;font-size:15px;color:var(--navy)}
  .g-head .ttl span{font-size:12.5px;color:#6b7683}
  .g-counter{font-size:13px;color:var(--navy);background:var(--sand);padding:8px 14px;border-radius:99px}
  .g-tools{margin-bottom:14px}
  .g-grid{display:grid;grid-template-columns:36px 1fr 90px 90px;gap:6px;align-items:center}
  .g-grid .gh{font-size:12px;color:#8a93a0;font-weight:700;padding-bottom:6px;border-bottom:1px solid var(--line)}
  .g-grid .gc{padding:6px 4px;font-size:13px;color:var(--ink)}
  .g-grid input{width:100%;padding:8px 9px;border:1.5px solid var(--line);border-radius:8px;font:inherit;text-align:center;background:#fbfaf7}
  .g-grid input:focus{outline:none;border-color:var(--navy);background:var(--white)}
  .g-grid input.g-filled{background:var(--ok-soft)}
</style>`);

let MY_PAIRS=[], CUR_PAIR=null, CUR_EXAM=null, STUDENTS=[], EXISTING={};

async function initGradesEntry(){
  if($('gSubjList').dataset.ready) return;
  $('gSubjList').dataset.ready='1';
  $('gExamsBack').addEventListener('click',()=>{ show('gSubjectsView'); });
  $('gGridBack').addEventListener('click',()=>{ show('gExamsView'); loadExams(); });
  $('gNewExamGo').addEventListener('click',createExam);
  $('gSave').addEventListener('click',saveGrades);
  bindDrop($('gDrop'),$('gFile'), handleUpload);
  await loadMySubjects();
}
function show(id){
  ['gSubjectsView','gExamsView','gGridView'].forEach(v=>{ $(v).style.display = v===id?'block':'none'; });
}

async function loadMySubjects(){
  $('gSubjList').innerHTML='<div class="empty-day">جارٍ التحميل…</div>';
  const {data:rows,error}=await db.from('entry_teachers')
    .select('timetable_entries!inner(section_id,subject_id,academic_year_id,sections(code),subjects(code,exam_total))')
    .eq('staff_id',S.ME.id).eq('timetable_entries.academic_year_id',S.YEAR.id);
  if(error){ $('gSubjList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  const seen=new Map();
  for(const r of rows||[]){
    const e=r.timetable_entries; if(!e?.subject_id||!e?.section_id) continue;
    const key=`${e.section_id}|${e.subject_id}`;
    if(!seen.has(key)) seen.set(key,{section_id:e.section_id,subject_id:e.subject_id,
      section_code:e.sections?.code||'—',subject_code:e.subjects?.code||'—',exam_total:e.subjects?.exam_total||25});
  }
  MY_PAIRS=[...seen.values()].sort((a,b)=>a.section_code.localeCompare(b.section_code,'ar')||a.subject_code.localeCompare(b.subject_code,'ar'));
  if(!MY_PAIRS.length){ $('gSubjList').innerHTML='<div class="empty-day">لا مقررات مرتبطة باسمك في الجدول الدراسي.</div>'; return; }
  $('gSubjList').innerHTML=MY_PAIRS.map((p,i)=>`
    <div class="g-subj" data-i="${i}"><div><b>${p.section_code} — ${p.subject_code}</b><small>درجة الاختبار: ${p.exam_total}</small></div><span>›</span></div>`).join('');
  $('gSubjList').querySelectorAll('.g-subj').forEach(el=>el.addEventListener('click',()=>{
    CUR_PAIR=MY_PAIRS[+el.dataset.i]; show('gExamsView'); loadExams();
  }));
}

async function loadExams(){
  $('gExamsTitle').textContent=`${CUR_PAIR.section_code} — ${CUR_PAIR.subject_code}`;
  $('gExamList').innerHTML='<div class="empty-day">جارٍ التحميل…</div>';
  $('gNewExamName').value=''; $('gNewExamDate').value='';
  const {data:exams,error}=await db.from('exams').select('*')
    .eq('section_id',CUR_PAIR.section_id).eq('subject_id',CUR_PAIR.subject_id).order('created_at');
  if(error){ $('gExamList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  $('gExamList').innerHTML=(exams||[]).length
    ? exams.map(e=>`<div class="g-exam" data-id="${e.id}" data-name="${e.name}"><b>${e.name}</b><small>${e.exam_date||''}</small></div>`).join('')
    : '<div class="empty-day">لا اختبارات بعد — أنشئي واحداً أدناه.</div>';
  $('gExamList').querySelectorAll('.g-exam').forEach(el=>el.addEventListener('click',()=>openExam({id:el.dataset.id,name:el.dataset.name})));
}
async function createExam(){
  const name=$('gNewExamName').value.trim();
  if(!name){ toast('اكتبي اسم الاختبار'); return; }
  const btn=$('gNewExamGo'); btn.disabled=true;
  try{
    const {data,error}=await db.from('exams').insert({
      academic_year_id:S.YEAR.id, section_id:CUR_PAIR.section_id, subject_id:CUR_PAIR.subject_id,
      name, exam_date:$('gNewExamDate').value||null, created_by:S.ME.id
    }).select('id,name').single();
    if(error) throw error;
    openExam(data);
  }catch(err){ toast(/duplicate|unique/i.test(err.message)?'يوجد اختبار بهذا الاسم مسبقاً':'تعذر الإنشاء: '+err.message); }
  finally{ btn.disabled=false; }
}

async function openExam(exam){
  CUR_EXAM=exam; show('gGridView');
  $('gGridTitle').textContent=`${CUR_PAIR.section_code} — ${CUR_PAIR.subject_code} — ${exam.name}`;
  $('gGridSub').textContent=`الدرجة الكلية: ${CUR_PAIR.exam_total}`;
  $('gGrid').innerHTML='<div class="empty-day">جارٍ تحميل الطالبات…</div>';
  const {data:enr,error}=await db.from('enrollments')
    .select('students(id,full_name,academic_number)').eq('section_id',CUR_PAIR.section_id).is('to_date',null);
  if(error){ $('gGrid').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  STUDENTS=(enr||[]).map(e=>e.students).filter(Boolean).sort((a,b)=>a.full_name.localeCompare(b.full_name,'ar'));
  const {data:recs}=await db.from('grade_records').select('student_id,score').eq('exam_id',exam.id);
  EXISTING={}; for(const r of recs||[]) EXISTING[r.student_id]=r.score;
  renderGrid();
}
function renderGrid(){
  $('gGrid').innerHTML =
    '<div class="gh">#</div><div class="gh">اسم الطالبة</div><div class="gh">الأكاديمي</div><div class="gh">الدرجة</div>' +
    STUDENTS.map((s,i)=>`
      <div class="gc">${i+1}</div>
      <div class="gc">${s.full_name}</div>
      <div class="gc">${s.academic_number}</div>
      <div><input type="number" min="0" max="${CUR_PAIR.exam_total}" step="0.5" data-sid="${s.id}"
        class="${EXISTING[s.id]!=null?'g-filled':''}" value="${EXISTING[s.id]??''}"></div>`).join('');
  const inputs=[...$('gGrid').querySelectorAll('input')];
  inputs.forEach((inp,idx)=>{
    inp.addEventListener('input',()=>{ inp.classList.toggle('g-filled', inp.value!==''); updateCount(); });
    inp.addEventListener('paste',e=>{
      const text=(e.clipboardData||window.clipboardData).getData('text');
      if(!text.includes('\n') && !text.includes('\t')) return; // قيمة واحدة، خليها تلصق عادي
      e.preventDefault();
      const lines=text.split(/\r?\n/).filter(l=>l.trim()!=='');
      lines.forEach((line,i)=>{
        const val=line.split(/\t/)[0].trim();
        const target=inputs[idx+i];
        if(target && val!==''){ target.value=val; target.classList.add('g-filled'); }
      });
      updateCount();
    });
  });
  updateCount();
}
function updateCount(){
  const inputs=[...$('gGrid').querySelectorAll('input')];
  $('gDoneCount').textContent=inputs.filter(i=>i.value!=='').length;
  $('gTotalCount').textContent=inputs.length;
}

async function handleUpload(file){
  const rows=await readSheet(file);
  if(rows.length<1){ toast('الملف فارغ'); return; }
  const bySid={}; for(const s of STUDENTS) bySid[String(s.academic_number)]=s.id;
  const inputs=[...$('gGrid').querySelectorAll('input')];
  const bySidInput={}; for(const inp of inputs) bySidInput[inp.dataset.sid]=inp;
  let matched=0, skipped=0;
  const start = /[أ-ي]/.test(String(rows[0][0]??'')) || isNaN(+rows[0][1]) ? 1 : 0; // تجاهل صف الترويسة إن وجد
  for(let i=start;i<rows.length;i++){
    const r=rows[i];
    const acad=String(r[0]??'').trim(), score=r[1];
    if(!acad || score===''||score===undefined||score===null) continue;
    const sid=bySid[acad];
    if(!sid){ skipped++; continue; }
    const inp=bySidInput[sid];
    if(inp){ inp.value=score; inp.classList.add('g-filled'); matched++; }
  }
  updateCount();
  toast(`تم تعبئة ${matched} درجة${skipped?` — تجاهلت ${skipped} رقماً أكاديمياً غير موجود بالشعبة`:''}`);
}

async function saveGrades(){
  const inputs=[...$('gGrid').querySelectorAll('input')].filter(i=>i.value!=='');
  if(!inputs.length){ toast('لا درجات مدخلة'); return; }
  const btn=$('gSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    const rows=inputs.map(inp=>({exam_id:CUR_EXAM.id, student_id:inp.dataset.sid, score:+inp.value,
      recorded_by:S.ME.id, updated_at:new Date().toISOString()}));
    for(const c of chunk(rows,300)){
      const {error}=await db.from('grade_records').upsert(c,{onConflict:'exam_id,student_id'});
      if(error) throw error;
    }
    await db.from('audit_log').insert({actor_id:S.ME.id, action:'grades', entity:'grade_records',
      details:{section:CUR_PAIR.section_code, subject:CUR_PAIR.subject_code, exam:CUR_EXAM.name, count:rows.length}});
    toast(`تم حفظ ${rows.length} درجة`);
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ الدرجات'; }
}

registerTab({id:'gradesEntry', label:'رصد الدرجات', group:'teacherArea', groupLabel:'حصصي',
  show:f=>f.isTeacher, init:initGradesEntry});
