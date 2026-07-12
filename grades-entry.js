/* grades-entry.js — رصد الدرجات (المعلمة)
   شاشة فرعية تحت "حصصي" بجانب رصد الغياب. تعرض مقررات المعلمة (شعبة×مقرر)،
   تفتح/تنشئ اختباراً، ثم تتيح إدخال الدرجات بطريقتين معاً من البداية:
   شبكة تفاعلية تدعم لصق عمود كامل من إكسل، أو رفع ملف إكسل جاهز. */
import { db, $, S, toast, chunk, bindDrop, readSheet, printWithTitle, registerTab } from './core.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';
const EXAM_NAMES = ['اختبار تشخيصي','الاختبار الأول','الاختبار الثاني'];
const numKey = v => parseInt(String(v).replace(/[^\d]/g,''),10) || 0;

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="gradesEntry" style="display:none">
  <div id="gSubjectsView">
    <div class="today-lbl" style="margin-bottom:12px">مقرراتي</div>
    <button class="btn ghost" id="gExtractGo" style="width:auto;padding:9px 18px;margin-bottom:14px">🔍 استخراج حسب الفئة</button>
    <button class="btn ghost" id="gAlertsGo" style="width:auto;padding:9px 18px;margin-bottom:14px;margin-inline-start:10px">⚠️ متابعة أداء طالباتي</button>
    <div id="gSubjList"></div>
  </div>

  <div id="gExamsView" style="display:none">
    <button class="back" id="gExamsBack">→ رجوع</button>
    <div class="today-lbl" id="gExamsTitle" style="margin:10px 0 12px">—</div>
    <div id="gExamList" style="margin-bottom:16px"></div>
    <div class="panel">
      <h3>اختبار جديد</h3>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <select id="gNewExamName" style="flex:1;min-width:180px;padding:10px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)">
          <option value="">اختاري الاختبار…</option>
          <option value="اختبار تشخيصي">اختبار تشخيصي</option>
          <option value="الاختبار الأول">الاختبار الأول</option>
          <option value="الاختبار الثاني">الاختبار الثاني</option>
        </select>
        <input type="number" id="gNewExamTotal" placeholder="الدرجة الكلية للتشخيصي" min="1" step="0.5" style="display:none;width:170px;padding:10px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
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
      <div class="hint">الطريقة الموصى بها: نزّلي القالب بأسماء طالباتك جاهزة، عبّي الدرجات في إكسل، ثم ارفعيه هنا.</div>
      <div class="actions" style="margin:10px 0">
        <button class="btn gold" id="gTemplateXls" style="width:auto;padding:10px 22px">⬇ تنزيل قالب الدرجات (بأسماء الطالبات)</button>
      </div>
      <div class="dropzone" id="gDrop"><b>ارفعي الملف بعد تعبئته</b><p>xlsx / xls — نفس القالب المنزَّل</p>
        <input type="file" id="gFile" accept=".xlsx,.xls" hidden></div>
      <div class="hint" style="margin-top:10px">أو أدخلي الدرجات مباشرة في الشبكة أدناه، وتقدرين لصق عمود كامل منسوخ من إكسل داخل أي خانة.</div>
    </div>
    <div class="g-grid" id="gGrid"></div>
    <div class="warnbox" id="gMissingBox" style="display:none"></div>
    <button class="btn gold" id="gSave" style="margin-top:16px">حفظ الدرجات</button>
  </div>

  <div id="gCompView" style="display:none">
    <button class="back" id="gCompBack">→ رجوع</button>
    <div class="panel">
      <h3>استمارة تحليل كفايات الاختبار</h3>
      <table class="comp-hdr">
        <tr><td>القسم الأكاديمي:</td><td id="cQD">—</td><td>معلم الشعبة:</td><td id="cQT">—</td></tr>
        <tr><td>الشعبة:</td><td id="cQS">—</td><td>الاختبار:</td><td id="cQE">—</td></tr>
        <tr><td>عدد طالبات الشعبة:</td><td id="cQN">—</td>
          <td>عدد فقرات الأسئلة:</td><td><input type="number" id="cQItems" min="1" style="width:80px;padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit"></td></tr>
      </table>
    </div>
    <div class="warnbox" id="cTemplateBanner" style="display:none"></div>
    <div id="cCompList"></div>
    <button class="btn ghost" id="cAddComp" style="width:auto;padding:10px 22px;margin:6px 0 18px">＋ إضافة كفاية جديدة</button>
    <div class="field" style="margin-bottom:14px">
      <label style="display:flex;align-items:center;gap:8px;font-weight:400;cursor:pointer">
        <input type="checkbox" id="cUnify" style="width:auto">
        استخدام هذه الاستمارة كنموذج موحّد لهذا المقرر — تُعرض تلقائياً كنسخة جاهزة لبقية معلمات المقرر عند فتح استمارة فارغة لنفس الاختبار
      </label>
    </div>
    <div class="actions">
      <button class="btn gold" id="cSave">حفظ الاستمارة</button>
      <button class="btn ghost" id="cPrint">⬇ طباعة / تنزيل PDF</button>
    </div>
  </div>

  <div id="gExtractView" style="display:none">
    <button class="back" id="gExtractBack">→ رجوع</button>
    <div class="panel">
      <h3>استخراج حسب الفئة</h3>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
        <select id="eSubject" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:160px"></select>
        <select id="eCategory" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:140px"></select>
      </div>
      <div class="sub">الشعب</div>
      <div id="eSections" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>
      <div class="sub">الاختبار (يمكن اختيار أكثر من واحد — تظهر كل قائمة على حدة)</div>
      <div id="eExams" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"></div>
      <button class="btn gold" id="eGo" style="width:auto;padding:10px 24px">استخراج</button>
    </div>
    <div id="eResults"></div>
    <div class="actions" id="eExportBar" style="display:none">
      <button class="btn ghost" id="eXls">⬇ إكسل</button>
      <button class="btn ghost" id="ePdf">⬇ PDF</button>
    </div>
  </div>

  <div id="gAlertsView" style="display:none">
    <button class="back" id="gAlertsBack">→ رجوع</button>
    <div class="stats" id="gAlertsStats"></div>
    <div class="panel">
      <div class="actions" style="margin-bottom:14px">
        <button class="btn ghost" id="gAlertsXls">⬇ إكسل</button>
        <button class="btn ghost" id="gAlertsPdf">⬇ PDF</button>
        <button class="btn ghost" id="gAlertsRefresh">↻ تحديث</button>
      </div>
      <div class="board-wrap"><table class="board" id="gAlertsTable"></table></div>
    </div>
  </div>
</div>
<div id="printAreaComp"></div>
<div id="printAreaExtract"></div>
<div id="printAreaAlerts"></div>
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
  .comp-hdr{width:100%;border-collapse:collapse;font-size:13px}
  .comp-hdr td{padding:8px 10px;border:1px solid var(--line)}
  .comp-hdr td:nth-child(odd){background:var(--sand);font-weight:700;color:var(--navy);width:170px}
  .comp-card{background:var(--white);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:14px}
  .comp-card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}
  .comp-card-head input{flex:1;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-weight:700;color:var(--navy)}
  .comp-badge{font-size:12px;padding:5px 12px;border-radius:99px;font-weight:700;white-space:nowrap}
  .comp-badge.ok{background:var(--ok-soft);color:var(--ok)}
  .comp-badge.no{background:#fbe7e7;color:var(--err)}
  .comp-items{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
  .comp-item{display:flex;align-items:center;gap:6px;background:var(--sand);border-radius:8px;padding:6px 10px}
  .comp-item input{width:52px;padding:5px 6px;border:1.5px solid var(--line);border-radius:6px;font:inherit;text-align:center}
  .comp-item small{color:#6b7683;font-size:11px}
  .comp-item button{background:none;border:none;color:var(--err);cursor:pointer}
  .comp-foot{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
  .ga-status{padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  .ga-reason{font-size:11px;padding:3px 10px;border-radius:99px;font-weight:700}
  .ga-reason.fail{background:#fbe7e7;color:var(--err)}
  .ga-reason.low_performance{background:#fff3cd;color:#8a6100}
  #printAreaComp,#printAreaExtract,#printAreaAlerts{display:none}
  @media print{
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaComp, #printAreaComp *, #printAreaExtract, #printAreaExtract *, #printAreaAlerts, #printAreaAlerts *{visibility:visible}
    #printAreaComp,#printAreaExtract,#printAreaAlerts{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
    .cp-head{text-align:center;margin-bottom:10px}
    .cp-head h2{font-size:15px;color:#1d3d5c;font-weight:600;margin-bottom:6px}
    .cp-hdr{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px}
    .cp-hdr td{padding:6px 8px;border:1px solid #ccc}
    .cp-hdr td:nth-child(odd){background:#f5f2ec;font-weight:700;width:150px}
    .cp-tbl{width:100%;border-collapse:collapse;font-size:10.5px}
    .cp-tbl th{background:#1d3d5c;color:#fff;padding:6px 5px;border:1px solid #1d3d5c}
    .cp-tbl td{padding:5px;border:1px solid #ccc;text-align:center}
    .ga-page{page-break-after:always}
    .ga-page:last-child{page-break-after:auto}
  }
</style>`);

let MY_PAIRS=[], CUR_PAIR=null, CUR_EXAM=null, CUR_EXAM_TOTAL=25, STUDENTS=[], EXISTING={};
let COMP_COMPS=[], COMP_ENROLLED=0, MASTERY_PCT=80;

async function loadMasteryPct(){
  const {data}=await db.from('grade_settings').select('mastery_pct').eq('id',1).maybeSingle();
  if(data?.mastery_pct) MASTERY_PCT=data.mastery_pct;
}

async function initGradesEntry(){
  if($('gSubjList').dataset.ready) return;
  $('gSubjList').dataset.ready='1';
  $('gExamsBack').addEventListener('click',()=>{ show('gSubjectsView'); });
  $('gGridBack').addEventListener('click',()=>{ show('gExamsView'); loadExams(); });
  $('gCompBack').addEventListener('click',()=>{ show('gExamsView'); loadExams(); });
  $('gNewExamGo').addEventListener('click',createExam);
  $('gNewExamName').addEventListener('change',()=>{
    $('gNewExamTotal').style.display = $('gNewExamName').value==='اختبار تشخيصي' ? 'block' : 'none';
  });
  $('gSave').addEventListener('click',saveGrades);
  $('gTemplateXls').addEventListener('click',downloadTemplate);
  $('cAddComp').addEventListener('click',()=>addCompCard());
  $('cSave').addEventListener('click',saveCompetencies);
  $('cPrint').addEventListener('click',printCompetencies);
  $('gExtractGo').addEventListener('click',openExtract);
  $('gExtractBack').addEventListener('click',()=>show('gSubjectsView'));
  $('eGo').addEventListener('click',runExtract);
  $('eXls').addEventListener('click',exportExtractXls);
  $('ePdf').addEventListener('click',exportExtractPdf);
  $('gAlertsGo').addEventListener('click',openAlerts);
  $('gAlertsBack').addEventListener('click',()=>show('gSubjectsView'));
  $('gAlertsRefresh').addEventListener('click',loadAlerts);
  $('gAlertsXls').addEventListener('click',exportAlertsXls);
  $('gAlertsPdf').addEventListener('click',exportAlertsPdf);
  bindDrop($('gDrop'),$('gFile'), handleUpload);
  await loadMasteryPct();
  await loadCatsAndThresholds();
  await loadMySubjects();
}
function show(id){
  ['gSubjectsView','gExamsView','gGridView','gCompView','gExtractView','gAlertsView'].forEach(v=>{ $(v).style.display = v===id?'block':'none'; });
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
  $('gNewExamName').value=''; $('gNewExamDate').value=''; $('gNewExamTotal').value=''; $('gNewExamTotal').style.display='none';
  const {data:exams,error}=await db.from('exams').select('*')
    .eq('section_id',CUR_PAIR.section_id).eq('subject_id',CUR_PAIR.subject_id).order('created_at');
  if(error){ $('gExamList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  $('gExamList').innerHTML=(exams||[]).length
    ? exams.map(e=>`<div class="g-exam" data-id="${e.id}" data-name="${e.name}" data-total="${e.exam_total??''}">
        <div><b>${e.name}</b><small>${e.exam_date||''}${e.exam_total?' · من '+e.exam_total:''}</small></div>
        <button class="btn ghost g-comp-link" data-id="${e.id}" data-name="${e.name}" style="width:auto;padding:8px 16px;font-size:12.5px">📋 استمارة تحليل الكفايات</button>
      </div>`).join('')
    : '<div class="empty-day">لا اختبارات بعد — أنشئي واحداً أدناه.</div>';
  $('gExamList').querySelectorAll('.g-exam').forEach(el=>el.addEventListener('click',(e)=>{
    if(e.target.closest('.g-comp-link')) return;
    openExam({id:el.dataset.id,name:el.dataset.name,exam_total:el.dataset.total?+el.dataset.total:null});
  }));
  $('gExamList').querySelectorAll('.g-comp-link').forEach(el=>el.addEventListener('click',(e)=>{
    e.stopPropagation(); openCompetency({id:el.dataset.id,name:el.dataset.name});
  }));
}
async function createExam(){
  const name=$('gNewExamName').value;
  if(!name){ toast('اختاري الاختبار'); return; }
  let examTotal=null;
  if(name==='اختبار تشخيصي'){
    examTotal=+$('gNewExamTotal').value;
    if(!examTotal||examTotal<=0){ toast('أدخلي الدرجة الكلية للاختبار التشخيصي'); return; }
  }
  const btn=$('gNewExamGo'); btn.disabled=true;
  try{
    const {data,error}=await db.from('exams').insert({
      academic_year_id:S.YEAR.id, section_id:CUR_PAIR.section_id, subject_id:CUR_PAIR.subject_id,
      name, exam_date:$('gNewExamDate').value||null, exam_total:examTotal, created_by:S.ME.id
    }).select('id,name,exam_total').single();
    if(error) throw error;
    openExam(data);
  }catch(err){ toast(/duplicate|unique/i.test(err.message)?'يوجد اختبار بهذا الاسم مسبقاً':'تعذر الإنشاء: '+err.message); }
  finally{ btn.disabled=false; }
}

async function openExam(exam){
  CUR_EXAM=exam; CUR_EXAM_TOTAL=exam.exam_total ?? CUR_PAIR.exam_total; show('gGridView');
  $('gGridTitle').textContent=`${CUR_PAIR.section_code} — ${CUR_PAIR.subject_code} — ${exam.name}`;
  $('gGridSub').textContent=`الدرجة الكلية: ${CUR_EXAM_TOTAL}`;
  $('gGrid').innerHTML='<div class="empty-day">جارٍ تحميل الطالبات…</div>';
  const {data:enr,error}=await db.from('enrollments')
    .select('students(id,full_name,academic_number)').eq('section_id',CUR_PAIR.section_id).is('to_date',null);
  if(error){ $('gGrid').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  STUDENTS=(enr||[]).map(e=>e.students).filter(Boolean)
    .sort((a,b)=>numKey(a.academic_number)-numKey(b.academic_number));
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
      <div><input type="number" min="0" max="${CUR_EXAM_TOTAL}" step="0.5" data-sid="${s.id}"
        class="${EXISTING[s.id]!=null?'g-filled':''}" value="${EXISTING[s.id]??''}"></div>`).join('');
  const inputs=[...$('gGrid').querySelectorAll('input')];
  inputs.forEach((inp,idx)=>{
    inp.addEventListener('input',()=>{ inp.classList.toggle('g-filled', inp.value!==''); updateCount(); updateMissing(); });
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
      updateCount(); updateMissing();
    });
  });
  updateCount(); updateMissing();
}
function updateCount(){
  const inputs=[...$('gGrid').querySelectorAll('input')];
  $('gDoneCount').textContent=inputs.filter(i=>i.value!=='').length;
  $('gTotalCount').textContent=inputs.length;
}
function updateMissing(){
  const inputs=[...$('gGrid').querySelectorAll('input')];
  const missing=inputs.filter(i=>i.value==='').map(i=>{
    const s=STUDENTS.find(st=>st.id===i.dataset.sid);
    return s ? `${s.full_name} (${s.academic_number})` : null;
  }).filter(Boolean);
  const box=$('gMissingBox');
  if(!missing.length){ box.style.display='none'; return; }
  box.style.display='block';
  box.innerHTML=`⚠️ لم تُرصد درجاتهن بعد — ${CUR_PAIR.section_code} — ${CUR_PAIR.subject_code} — ${CUR_EXAM.name} (${missing.length}):<br>`+
    missing.join('، ');
}

/* ============ تنزيل قالب الدرجات (بأسماء الطالبات، بترتيب الرقم الأكاديمي) ============ */
const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const gBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function downloadTemplate(){
  if(!STUDENTS.length){ toast('لا طالبات في هذه الشعبة'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('الدرجات',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,4);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle(`${CUR_PAIR.section_code} — ${CUR_PAIR.subject_code} — ${CUR_EXAM.name} — من ${CUR_EXAM_TOTAL}`,12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['#','الرقم الأكاديمي','اسم الطالبة','الدرجة']);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=gBorder; });
  STUDENTS.forEach((s,i)=>{
    const row=ws.addRow([i+1, s.academic_number, s.full_name, EXISTING[s.id]??'']);
    row.eachCell((c,colNo)=>{ c.border=gBorder; c.alignment={horizontal: colNo===3?'right':'center'}; c.font={size:10.5};
      if(colNo===2) c.numFmt='@';
      if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
  });
  ws.columns=[{width:6},{width:16},{width:30},{width:12}];
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:4}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url;
  a.download=`قالب_الدرجات_${CUR_PAIR.section_code}_${CUR_PAIR.subject_code}_${CUR_EXAM.name}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

function findHeaderCols(rows){
  for(let i=0;i<Math.min(rows.length,8);i++){
    const r=rows[i].map(v=>String(v??'').trim());
    const acadIdx=r.findIndex(v=>v.includes('أكاديمي'));
    const gradeIdx=r.findIndex(v=>v.includes('درجة'));
    if(acadIdx>=0 && gradeIdx>=0) return {headerRow:i, acadIdx, gradeIdx};
  }
  return null;
}
async function handleUpload(file){
  const rows=await readSheet(file);
  if(rows.length<1){ toast('الملف فارغ'); return; }
  const bySid={}; for(const s of STUDENTS) bySid[String(s.academic_number)]=s.id;
  const inputs=[...$('gGrid').querySelectorAll('input')];
  const bySidInput={}; for(const inp of inputs) bySidInput[inp.dataset.sid]=inp;
  const hdr=findHeaderCols(rows);
  let acadCol=0, gradeCol=1, start=0;
  if(hdr){ acadCol=hdr.acadIdx; gradeCol=hdr.gradeIdx; start=hdr.headerRow+1; }
  else{ start = /[أ-ي]/.test(String(rows[0][0]??'')) || isNaN(+rows[0][1]) ? 1 : 0; } // ملف بسيط بعمودين بلا ترويسة معروفة
  let matched=0, skipped=0;
  for(let i=start;i<rows.length;i++){
    const r=rows[i];
    const acad=String(r[acadCol]??'').trim(), score=r[gradeCol];
    if(!acad || score===''||score===undefined||score===null) continue;
    const sid=bySid[acad];
    if(!sid){ skipped++; continue; }
    const inp=bySidInput[sid];
    if(inp){ inp.value=score; inp.classList.add('g-filled'); matched++; }
  }
  updateCount(); updateMissing();
  toast(`تم تعبئة ${matched} درجة${skipped?` — تجاهلت ${skipped} رقماً أكاديمياً غير موجود بالشعبة`:''}`);
}

let CATS=[], THRESH={pass_pct:50,mastery_pct:80};
async function loadCatsAndThresholds(){
  const [{data:cats},{data:th}]=await Promise.all([
    db.from('grade_categories').select('*').order('sort_order'),
    db.from('grade_settings').select('*').eq('id',1).maybeSingle(),
  ]);
  CATS=cats||[]; if(th) THRESH=th;
}
function categoryOf(pct){ return CATS.find(c=>pct>=c.min_pct && pct<=c.max_pct) || null; }

async function syncUnderperformerAlerts(scoreRows){
  if(!CATS.length) await loadCatsAndThresholds();
  if(!CATS.length){ toast('تعذّر تحميل فئات التصنيف — لن تُنشأ تنبيهات المقصّرات لهذا الحفظ'); return; }
  const lowestCat=CATS.reduce((min,c)=>c.min_pct<min.min_pct?c:min, CATS[0]);
  const total=CUR_EXAM_TOTAL;
  const toFlag=[], toClear=[];
  for(const r of scoreRows){
    const pct=r.score/total*100;
    const cat=categoryOf(pct);
    const isFail=pct<THRESH.pass_pct, isLow=cat && lowestCat && cat.id===lowestCat.id;
    if(isFail||isLow){
      toFlag.push({student_id:r.student_id, exam_id:r.exam_id, reason:isFail?'fail':'low_performance', score:r.score, pct});
    }else{
      toClear.push(r.student_id);
    }
  }
  if(toFlag.length){
    const {error}=await db.from('underperformer_alerts').upsert(toFlag,{onConflict:'student_id,exam_id'});
    if(error) toast('تنبيه: تعذر تسجيل بعض حالات المقصّرات — '+error.message);
  }
  if(toClear.length){
    const {error}=await db.from('underperformer_alerts').delete().eq('exam_id',CUR_EXAM.id).in('student_id',toClear);
    if(error) console.error(error);
  }
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
    await syncUnderperformerAlerts(rows);
    await db.from('audit_log').insert({actor_id:S.ME.id, action:'grades', entity:'grade_records',
      details:{section:CUR_PAIR.section_code, subject:CUR_PAIR.subject_code, exam:CUR_EXAM.name, count:rows.length}});
    toast(`تم حفظ ${rows.length} درجة`);
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ الدرجات'; }
}

/* ============ استمارة تحليل الكفايات ============ */
async function openCompetency(exam){
  CUR_EXAM=exam; show('gCompView');
  $('cQD').textContent=S.ME.departments?.name||'—';
  $('cQT').textContent=S.ME.full_name;
  $('cQS').textContent=CUR_PAIR.section_code;
  $('cQE').textContent=exam.name;
  $('cQN').textContent='…'; $('cQItems').value=''; $('cUnify').checked=false;
  $('cCompList').innerHTML='<div class="empty-day">جارٍ التحميل…</div>';
  $('cTemplateBanner').style.display='none';

  const {data:enr}=await db.from('enrollments').select('students(id)').eq('section_id',CUR_PAIR.section_id).is('to_date',null);
  COMP_ENROLLED=(enr||[]).length;
  $('cQN').textContent=COMP_ENROLLED;

  const {data:examRow}=await db.from('exams').select('question_items_count').eq('id',exam.id).maybeSingle();
  $('cQItems').value=examRow?.question_items_count ?? '';

  const {data:comps}=await db.from('exam_competencies')
    .select('id,name,sort_order,competency_items(id,item_no,mastered_count)')
    .eq('exam_id',exam.id).order('sort_order');
  COMP_COMPS=(comps||[]).map(c=>({id:c.id, name:c.name,
    items:(c.competency_items||[]).slice().sort((a,b)=>a.item_no-b.item_no)}));

  if(!COMP_COMPS.length){
    COMP_COMPS=[{name:'',items:[{item_no:1,mastered_count:0}]}];
    const {data:tmpl}=await db.from('competency_templates')
      .select('id,name,sort_order,competency_template_items(item_no)')
      .eq('subject_id',CUR_PAIR.subject_id).eq('exam_name',exam.name).order('sort_order');
    if(tmpl?.length){
      $('cTemplateBanner').style.display='block';
      $('cTemplateBanner').innerHTML=`📋 يوجد نموذج موحّد محفوظ لهذا المقرر والاختبار (${tmpl.length} كفاية) — <button class="btn ghost" id="cUseTemplate" style="width:auto;padding:6px 16px;font-size:12.5px">استخدامه كنقطة بداية</button>`;
      $('cUseTemplate').addEventListener('click',()=>{
        COMP_COMPS=tmpl.map(t=>({name:t.name,
          items:(t.competency_template_items||[]).map(i=>({item_no:i.item_no,mastered_count:0})).sort((a,b)=>a.item_no-b.item_no)}));
        $('cTemplateBanner').style.display='none';
        renderComps();
        toast('انسخ النموذج — أدخلي أعداد المتقنات لشعبتك');
      });
    }
  }
  renderComps();
}
function compStatus(c){
  if(!c.items.length || !COMP_ENROLLED) return {pct:null,status:false};
  const sum=c.items.reduce((a,b)=>a+(+b.mastered_count||0),0);
  const max=c.items.length*COMP_ENROLLED;
  const pct=max?(sum/max*100):null;
  return {pct, status: pct!=null && pct>=MASTERY_PCT};
}
function compCardHtml(c,ci){
  const {pct,status}=compStatus(c);
  return `<div class="comp-card" data-ci="${ci}">
    <div class="comp-card-head">
      <input type="text" placeholder="اسم الكفاية…" value="${(c.name||'').replace(/"/g,'&quot;')}" data-role="name">
      <span class="comp-badge ${pct!=null&&status?'ok':'no'}">${pct==null?'—':pct.toFixed(1)+'٪ '+(status?'أتقن':'لم يتقن')}</span>
      <button class="btn ghost" data-role="delcomp" style="width:auto;padding:7px 14px;font-size:12px">✕ حذف الكفاية</button>
    </div>
    <div class="comp-items">
      ${c.items.map((it,ii)=>`<div class="comp-item" data-ii="${ii}">
        <small>فقرة</small><input type="number" min="1" value="${it.item_no}" data-role="itemno">
        <small>متقنات (من ${COMP_ENROLLED})</small><input type="number" min="0" max="${COMP_ENROLLED}" value="${it.mastered_count}" data-role="mastered">
        <button data-role="delitem">✕</button>
      </div>`).join('')}
    </div>
    <div class="comp-foot"><button class="btn ghost" data-role="additem" style="width:auto;padding:7px 14px;font-size:12px">＋ فقرة</button></div>
  </div>`;
}
function renderComps(){
  $('cCompList').innerHTML=COMP_COMPS.map((c,ci)=>compCardHtml(c,ci)).join('');
  attachCompHandlers();
}
function attachCompHandlers(){
  $('cCompList').querySelectorAll('.comp-card').forEach(card=>{
    const ci=+card.dataset.ci;
    card.querySelector('[data-role="name"]').addEventListener('input',e=>{ COMP_COMPS[ci].name=e.target.value; });
    card.querySelector('[data-role="delcomp"]').addEventListener('click',()=>{ COMP_COMPS.splice(ci,1); renderComps(); });
    card.querySelector('[data-role="additem"]').addEventListener('click',()=>{
      const nextNo=Math.max(0,...COMP_COMPS[ci].items.map(i=>i.item_no))+1;
      COMP_COMPS[ci].items.push({item_no:nextNo,mastered_count:0}); renderComps();
    });
    card.querySelectorAll('.comp-item').forEach(itemEl=>{
      const ii=+itemEl.dataset.ii;
      itemEl.querySelector('[data-role="itemno"]').addEventListener('input',e=>{ COMP_COMPS[ci].items[ii].item_no=+e.target.value||0; updateBadge(card,ci); });
      itemEl.querySelector('[data-role="mastered"]').addEventListener('input',e=>{ COMP_COMPS[ci].items[ii].mastered_count=+e.target.value||0; updateBadge(card,ci); });
      itemEl.querySelector('[data-role="delitem"]').addEventListener('click',()=>{ COMP_COMPS[ci].items.splice(ii,1); renderComps(); });
    });
  });
}
function updateBadge(card,ci){
  const {pct,status}=compStatus(COMP_COMPS[ci]);
  const badge=card.querySelector('.comp-badge');
  badge.className='comp-badge '+(pct!=null&&status?'ok':'no');
  badge.textContent=pct==null?'—':pct.toFixed(1)+'٪ '+(status?'أتقن':'لم يتقن');
}
function addCompCard(){ COMP_COMPS.push({name:'',items:[{item_no:1,mastered_count:0}]}); renderComps(); }

async function saveCompetencies(){
  const btn=$('cSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    const itemsCount=+$('cQItems').value||null;
    await db.from('exams').update({question_items_count:itemsCount}).eq('id',CUR_EXAM.id);
    await db.from('exam_competencies').delete().eq('exam_id',CUR_EXAM.id); // يحذف تلقائياً الفقرات المرتبطة (cascade)
    const valid=COMP_COMPS.filter(c=>c.name.trim() && c.items.length);
    for(let i=0;i<valid.length;i++){
      const c=valid[i];
      const {data,error}=await db.from('exam_competencies').insert({exam_id:CUR_EXAM.id, name:c.name.trim(), sort_order:i}).select('id').single();
      if(error) throw error;
      const itemRows=c.items.map(it=>({competency_id:data.id, item_no:it.item_no, mastered_count:+it.mastered_count||0}));
      if(itemRows.length){ const {error:e2}=await db.from('competency_items').insert(itemRows); if(e2) throw e2; }
    }
    if($('cUnify').checked){
      const {data:oldTmpl}=await db.from('competency_templates').select('id').eq('subject_id',CUR_PAIR.subject_id).eq('exam_name',CUR_EXAM.name);
      if(oldTmpl?.length) await db.from('competency_templates').delete().in('id',oldTmpl.map(t=>t.id)); // يحذف الفقرات تلقائياً (cascade)
      for(let i=0;i<valid.length;i++){
        const c=valid[i];
        const {data:t,error:e1}=await db.from('competency_templates').insert({
          subject_id:CUR_PAIR.subject_id, exam_name:CUR_EXAM.name, name:c.name.trim(), sort_order:i, created_by:S.ME.id
        }).select('id').single();
        if(e1) throw e1;
        const tItems=c.items.map(it=>({template_id:t.id, item_no:it.item_no}));
        if(tItems.length){ const {error:e2}=await db.from('competency_template_items').insert(tItems); if(e2) throw e2; }
      }
      toast('تم حفظ الاستمارة، ونُشرت كنموذج موحّد للمقرر');
    }else{
      toast('تم حفظ استمارة تحليل الكفايات');
    }
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ الاستمارة'; }
}

function printCompetencies(){
  const valid=COMP_COMPS.filter(c=>c.name.trim());
  if(!valid.length){ toast('لا كفايات للطباعة'); return; }
  const sections=valid.map(c=>{
    const {pct,status}=compStatus(c);
    const itemRows=c.items.map(it=>`<tr><td>${it.item_no}</td><td>${it.mastered_count}</td></tr>`).join('');
    return `<table class="cp-tbl" style="margin-bottom:14px">
      <tr><th colspan="2">${c.name}</th></tr>
      <tr><th>الفقرة</th><th>عدد المتقنات</th></tr>
      ${itemRows}
      <tr><td>نسبة الإنجاز</td><td>${pct==null?'—':pct.toFixed(1)+'٪'}</td></tr>
      <tr><td>الحالة</td><td>${pct==null?'—':(status?'أتقن':'لم يتقن')}</td></tr>
    </table>`;
  }).join('');
  $('printAreaComp').innerHTML=`
    <div class="cp-head"><h2>استمارة تحليل كفايات الاختبار</h2></div>
    <table class="cp-hdr">
      <tr><td>القسم الأكاديمي</td><td>${$('cQD').textContent}</td><td>معلم الشعبة</td><td>${$('cQT').textContent}</td></tr>
      <tr><td>الشعبة</td><td>${$('cQS').textContent}</td><td>الاختبار</td><td>${$('cQE').textContent}</td></tr>
      <tr><td>عدد طالبات الشعبة</td><td>${$('cQN').textContent}</td><td>عدد فقرات الأسئلة</td><td>${$('cQItems').value||'—'}</td></tr>
    </table>
    ${sections}`;
  printWithTitle(`تحليل_كفايات_${CUR_PAIR.section_code}_${CUR_PAIR.subject_code}_${CUR_EXAM.name}`);
}

/* ============ استخراج حسب الفئة ============ */
async function openExtract(){
  show('gExtractView');
  const subjCodes=[...new Set(MY_PAIRS.map(p=>p.subject_code))].sort((a,b)=>a.localeCompare(b,'ar'));
  $('eSubject').innerHTML=subjCodes.map(c=>`<option value="${c}">${c}</option>`).join('');
  $('eCategory').innerHTML=CATS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  $('eSubject').onchange=renderExtractSections;
  renderExtractSections();
  $('eResults').innerHTML=''; $('eExportBar').style.display='none';
}
function renderExtractSections(){
  const subj=$('eSubject').value;
  const pairs=MY_PAIRS.filter(p=>p.subject_code===subj);
  $('eSections').innerHTML=pairs.map(p=>`<label class="ga-cmp-check" style="display:inline-flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--line);border-radius:9px;padding:8px 14px;cursor:pointer">
    <input type="checkbox" value="${p.section_id}" checked> ${p.section_code}</label>`).join('');
  $('eExams').innerHTML=EXAM_NAMES.map(n=>`<label class="ga-cmp-check" style="display:inline-flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--line);border-radius:9px;padding:8px 14px;cursor:pointer">
    <input type="checkbox" value="${n}"> ${n}</label>`).join('');
}
let EXTRACT_RESULT=null;
async function runExtract(){
  const subj=$('eSubject').value;
  const secIds=[...$('eSections').querySelectorAll('input:checked')].map(i=>i.value);
  const examNames=[...$('eExams').querySelectorAll('input:checked')].map(i=>i.value);
  const catId=$('eCategory').value;
  if(!secIds.length||!examNames.length){ toast('اختاري شعبة واحدة وامتحاناً واحداً على الأقل'); return; }
  const cat=CATS.find(c=>c.id===catId);
  const pairs=MY_PAIRS.filter(p=>p.subject_code===subj && secIds.includes(p.section_id));

  const perExam={};
  for(const name of examNames){
    perExam[name]=[];
    for(const p of pairs){
      const {data:ex}=await db.from('exams').select('id,exam_total').eq('section_id',p.section_id).eq('subject_id',p.subject_id).eq('name',name).maybeSingle();
      if(!ex) continue;
      const examTotal=ex.exam_total ?? p.exam_total;
      const {data:enr}=await db.from('enrollments').select('students(id,full_name,academic_number)').eq('section_id',p.section_id).is('to_date',null);
      const {data:recs}=await db.from('grade_records').select('student_id,score').eq('exam_id',ex.id);
      const scoreBy={}; for(const r of recs||[]) if(r.score!=null) scoreBy[r.student_id]=r.score;
      for(const e of enr||[]){
        const s=e.students; if(!s) continue;
        const score=scoreBy[s.id]; if(score==null) continue;
        const pct=score/examTotal*100;
        if(pct>=cat.min_pct && pct<=cat.max_pct) perExam[name].push({...s, sec:p.section_code, score, pct});
      }
    }
    perExam[name].sort((a,b)=>a.sec.localeCompare(b.sec,'ar')||numKey(a.academic_number)-numKey(b.academic_number));
  }
  $('eResults').innerHTML=examNames.map(name=>{
    const list=perExam[name];
    return `<div class="panel"><h3>${name} — ${cat.name} (${list.length})</h3>
      <div class="board-wrap"><table class="board"><tr><th>#</th><th>الشعبة</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>الدرجة</th><th>النسبة</th></tr>
        ${list.length? list.map((s,i)=>`<tr><td class="c">${i+1}</td><td class="c">${s.sec}</td><td class="c">${s.academic_number}</td><td>${s.full_name}</td><td class="c">${s.score}</td><td class="c">${s.pct.toFixed(1)}٪</td></tr>`).join('')
          : '<tr><td colspan="6" style="padding:16px;text-align:center;color:#8a93a0">لا طالبات في هذه الفئة</td></tr>'}
      </table></div></div>`;
  }).join('');
  EXTRACT_RESULT={subj,cat,examNames,perExam};
  $('eExportBar').style.display='flex';
}
async function exportExtractXls(){
  if(!EXTRACT_RESULT){ toast('استخرجي النتائج أولاً'); return; }
  const {subj,cat,examNames,perExam}=EXTRACT_RESULT;
  const wb=new ExcelJS.Workbook();
  for(const name of examNames){
    const ws=wb.addWorksheet(name.slice(0,31),{views:[{rightToLeft:true}]});
    const addTitle=(text,size,bold,fill,color)=>{
      const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,6);
      const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
      cell.alignment={horizontal:'center',vertical:'middle'};
      if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
      row.height=size>=16?26:20;
    };
    addTitle(schoolName(),16,true,NAVY,WHITE);
    addTitle(`${subj} — ${cat.name} — ${name}`,12,true,null,'FF22303C');
    ws.addRow([]);
    const hdr=ws.addRow(['#','الشعبة','الرقم الأكاديمي','اسم الطالبة','الدرجة','النسبة']);
    hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=gBorder; });
    perExam[name].forEach((s,i)=>{
      const row=ws.addRow([i+1,s.sec,s.academic_number,s.full_name,s.score,s.pct.toFixed(1)+'٪']);
      row.eachCell((c,colNo)=>{ c.border=gBorder; c.alignment={horizontal:colNo===4?'right':'center'}; c.font={size:10.5}; c.numFmt='@'; });
    });
    ws.columns=[{width:6},{width:11},{width:16},{width:28},{width:10},{width:10}];
  }
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`استخراج_${subj}_${cat.name}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}
function exportExtractPdf(){
  if(!EXTRACT_RESULT){ toast('استخرجي النتائج أولاً'); return; }
  const {subj,cat,examNames,perExam}=EXTRACT_RESULT;
  const pages=examNames.map(name=>`<div class="ga-page">
    <div class="cp-head"><h2>${subj} — ${cat.name} — ${name}</h2></div>
    <table class="cp-tbl"><tr><th>#</th><th>الشعبة</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>الدرجة</th><th>النسبة</th></tr>
      ${perExam[name].map((s,i)=>`<tr><td>${i+1}</td><td>${s.sec}</td><td>${s.academic_number}</td><td style="text-align:right">${s.full_name}</td><td>${s.score}</td><td>${s.pct.toFixed(1)}٪</td></tr>`).join('')}
    </table></div>`).join('');
  $('printAreaExtract').innerHTML=pages;
  printWithTitle(`استخراج_${subj}_${cat.name}`);
}

/* ============ متابعة أداء طالباتي (نطاق المعلمة نفسها فقط) ============ */
const REASON_LABEL={fail:'راسبة', low_performance:'أداء منخفض'};
const STATUS_LABEL={pending:'قيد الانتظار', in_progress:'جاري المتابعة', done:'تم'};
let ALERT_ROWS=[];
function openAlerts(){ show('gAlertsView'); loadAlerts(); }
async function loadAlerts(){
  $('gAlertsTable').innerHTML='<tr><td style="padding:20px;text-align:center;color:#8a93a0">جارٍ التحميل…</td></tr>';
  const pairs=new Set(MY_PAIRS.map(p=>`${p.subject_id}|${p.section_id}`));
  const {data:alerts,error}=await db.from('underperformer_alerts')
    .select('id,reason,score,pct,status,students(full_name,academic_number),exams(name,subject_id,section_id,subjects(code),sections(code))')
    .order('created_at',{ascending:false});
  if(error){ $('gAlertsTable').innerHTML=`<tr><td style="padding:20px;text-align:center;color:#8a93a0">تعذر التحميل: ${error.message}</td></tr>`; return; }
  ALERT_ROWS=(alerts||[]).filter(a=>a.exams && pairs.has(`${a.exams.subject_id}|${a.exams.section_id}`));
  renderAlerts();
}
function renderAlerts(){
  $('gAlertsStats').innerHTML=`
    <div class="stat red"><b>${ALERT_ROWS.length}</b><span>إجمالي التنبيهات</span></div>
    <div class="stat"><b>${ALERT_ROWS.filter(r=>r.status==='pending').length}</b><span>قيد الانتظار</span></div>
    <div class="stat"><b>${ALERT_ROWS.filter(r=>r.status==='in_progress').length}</b><span>جاري المتابعة</span></div>
    <div class="stat green"><b>${ALERT_ROWS.filter(r=>r.status==='done').length}</b><span>تم</span></div>`;
  if(!ALERT_ROWS.length){ $('gAlertsTable').innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا تنبيهات حالياً 🎉</td></tr>'; return; }
  $('gAlertsTable').innerHTML='<tr><th>الطالبة</th><th>الرقم الأكاديمي</th><th>الشعبة</th><th>المقرر</th><th>الاختبار</th><th>السبب</th><th>الدرجة</th><th>النسبة</th><th>الحالة</th></tr>'+
    ALERT_ROWS.map(r=>`<tr>
      <td>${r.students?.full_name||'—'}</td><td class="c">${r.students?.academic_number||'—'}</td>
      <td class="c">${r.exams?.sections?.code||'—'}</td><td class="c">${r.exams?.subjects?.code||'—'}</td><td class="c">${r.exams?.name||'—'}</td>
      <td class="c"><span class="ga-reason ${r.reason}">${REASON_LABEL[r.reason]||r.reason}</span></td>
      <td class="c">${r.score??'—'}</td><td class="c">${r.pct!=null?(+r.pct).toFixed(1)+'٪':'—'}</td>
      <td><select class="ga-status" data-id="${r.id}">${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${r.status===k?'selected':''}>${v}</option>`).join('')}</select></td></tr>`).join('');
  $('gAlertsTable').querySelectorAll('.ga-status').forEach(sel=>sel.addEventListener('change', async ()=>{
    const {error}=await db.from('underperformer_alerts').update({status:sel.value, handled_by:S.ME.id, handled_at:new Date().toISOString()}).eq('id',sel.dataset.id);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    const row=ALERT_ROWS.find(r=>r.id===sel.dataset.id); if(row) row.status=sel.value;
    toast('تم تحديث الحالة'); renderAlerts();
  }));
}
async function exportAlertsXls(){
  if(!ALERT_ROWS.length){ toast('لا بيانات للتصدير'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('متابعة الأداء',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,9);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,'FF1D3D5C','FFFFFFFF');
  addTitle('متابعة أداء طالباتي',12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['الطالبة','الرقم الأكاديمي','الشعبة','المقرر','الاختبار','السبب','الدرجة','النسبة','الحالة']);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:'FFFFFFFF'}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1D3D5C'}}; c.alignment={horizontal:'center'}; c.border=gBorder; });
  ALERT_ROWS.forEach((r,i)=>{
    const row=ws.addRow([r.students?.full_name||'', r.students?.academic_number||'', r.exams?.sections?.code||'',
      r.exams?.subjects?.code||'', r.exams?.name||'', REASON_LABEL[r.reason]||r.reason, r.score??'',
      r.pct!=null?(+r.pct).toFixed(1)+'٪':'', STATUS_LABEL[r.status]||r.status]);
    row.eachCell((c,colNo)=>{ c.border=gBorder; c.alignment={horizontal:colNo===1?'right':'center'}; c.font={size:10.5}; c.numFmt='@';
      if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
  });
  ws.columns=[{width:26},{width:16},{width:11},{width:11},{width:16},{width:14},{width:9},{width:9},{width:14}];
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:3}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='متابعة_أداء_طالباتي.xlsx'; a.click();
  URL.revokeObjectURL(url);
}
function exportAlertsPdf(){
  if(!ALERT_ROWS.length){ toast('لا بيانات للتصدير'); return; }
  const rows=ALERT_ROWS.map(r=>`<tr><td>${r.students?.full_name||''}</td><td>${r.students?.academic_number||''}</td>
    <td>${r.exams?.sections?.code||''}</td><td>${r.exams?.subjects?.code||''}</td><td>${r.exams?.name||''}</td>
    <td>${REASON_LABEL[r.reason]||r.reason}</td><td>${r.score??''}</td><td>${r.pct!=null?(+r.pct).toFixed(1)+'٪':''}</td><td>${STATUS_LABEL[r.status]||r.status}</td></tr>`).join('');
  $('printAreaAlerts').innerHTML=`
    <div class="cp-head"><h2>متابعة أداء طالباتي</h2></div>
    <table class="cp-tbl"><tr><th>الطالبة</th><th>الرقم الأكاديمي</th><th>الشعبة</th><th>المقرر</th><th>الاختبار</th><th>السبب</th><th>الدرجة</th><th>النسبة</th><th>الحالة</th></tr>${rows}</table>`;
  printWithTitle('متابعة_أداء_طالباتي');
}

registerTab({id:'gradesEntry', label:'رصد الدرجات', group:'teacherArea', groupLabel:'حصصي',
  show:f=>f.isTeacher, init:initGradesEntry});
