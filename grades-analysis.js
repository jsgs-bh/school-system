/* grades-analysis.js — تحليل الاختبارات (للأدمن، القيادة، مسؤولة تحليل الاختبارات)
   شاشة أولى: متابعة الرصد — لكل مقرر، شعبة × اختبار (تشخيصي/الأول/الثاني)،
   من رصدت ومن لا. الضغط على خلية مرصودة يفتح شاشة التحليل التفصيلي:
   تصنيف كل طالبة بلونها، ونسب النجاح والإتقان والرسوب، مع تصدير إكسل وPDF.
   الملف مكتفٍ بذاته: يضيف تبويبه وتنسيقاته وحاوية طباعته الخاصة. */
import { db, $, S, chunk, toast, printWithTitle, registerTab } from './core.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';
const EXAM_NAMES = ['اختبار تشخيصي','الاختبار الأول','الاختبار الثاني'];

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="gaMain" style="display:none">
  <div id="gaListView">
    <div class="datebar">
      <div class="today-lbl">تحليل الاختبارات — متابعة الرصد</div>
      <select id="gaSubject" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:200px"></select>
    </div>
    <div class="board-wrap"><table class="board" id="gaTable"></table></div>
  </div>

  <div id="gaDetailView" style="display:none">
    <button class="back" id="gaBack">→ رجوع</button>
    <div class="g-head" style="margin:10px 0 14px">
      <div class="ttl"><b id="gaDetailTitle">—</b><span id="gaDetailSub">—</span></div>
    </div>
    <div class="stats" id="gaStats"></div>
    <div class="panel">
      <h3>توزيع الفئات</h3>
      <div class="board-wrap"><table class="board" id="gaCatTable"></table></div>
    </div>
    <div class="panel">
      <div class="actions" style="margin-bottom:14px">
        <button class="btn ghost" id="gaXls">⬇ إكسل — كشف الدرجات والتصنيف</button>
        <button class="btn ghost" id="gaPdf">⬇ PDF — كشف الدرجات والتصنيف</button>
      </div>
      <div class="board-wrap"><table class="board" id="gaStudentTable"></table></div>
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
  #printAreaGA{display:none}
  @media print{
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaGA, #printAreaGA *{visibility:visible}
    #printAreaGA{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm 16mm}
    .ga-head{text-align:center;margin-bottom:12px}
    .ga-head h2{font-size:15px;color:#1d3d5c;font-weight:600;margin-bottom:6px}
    .ga-head p{font-size:12px;color:#333}
    .ga-tbl{width:100%;border-collapse:collapse;font-size:11px}
    .ga-tbl th{background:#1d3d5c;color:#fff;padding:6px 5px;border:1px solid #1d3d5c}
    .ga-tbl td{padding:5px;border:1px solid #ccc;text-align:center}
    .ga-footer{position:fixed;bottom:6mm;left:12mm;right:12mm;text-align:center;font-size:9.5px;color:#555;border-top:1px solid #ccc;padding-top:4px;font-family:'Amiri',serif}
  }
</style>`);

let SUBJECTS=[], CUR_SUBJECT=null, CATS=[], THRESH={pass_pct:50,mastery_pct:80};
let CUR_DETAIL=null; // {section,subject,exam,students}

async function initAnalysis(){
  if($('gaSubject').dataset.ready) return;
  $('gaSubject').dataset.ready='1';
  $('gaBack').addEventListener('click',()=>{ $('gaDetailView').style.display='none'; $('gaListView').style.display='block'; });
  $('gaXls').addEventListener('click',exportXls);
  $('gaPdf').addEventListener('click',exportPdf);
  await loadCatsAndThresholds();
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

/* ============ شاشة المتابعة: شعبة × اختبار ============ */
async function loadGrid(){
  const tbl=$('gaTable');
  tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">جارٍ التحميل…</td></tr>';
  if(!CUR_SUBJECT){ tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا مقررات بعد.</td></tr>'; return; }
  const {data:rows,error}=await db.from('entry_teachers')
    .select('staff(full_name), timetable_entries!inner(section_id,subject_id,academic_year_id,sections(code))')
    .eq('timetable_entries.subject_id',CUR_SUBJECT.id).eq('timetable_entries.academic_year_id',S.YEAR.id);
  if(error){ tbl.innerHTML=`<tr><td style="padding:30px;text-align:center;color:#8a93a0">تعذر التحميل: ${error.message}</td></tr>`; return; }
  const secMap={};
  for(const r of rows||[]){
    const e=r.timetable_entries; if(!e?.section_id) continue;
    const code=e.sections?.code||'؟';
    secMap[code] ??= {section_id:e.section_id, teachers:new Set()};
    if(r.staff?.full_name) secMap[code].teachers.add(r.staff.full_name);
  }
  const codes=Object.keys(secMap).sort((a,b)=>a.localeCompare(b,'ar'));
  if(!codes.length){ tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا شعب مرتبطة بهذا المقرر في الجدول.</td></tr>'; return; }

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
async function openDetail(d){
  $('gaListView').style.display='none'; $('gaDetailView').style.display='block';
  $('gaDetailTitle').textContent=`${d.sec} — ${CUR_SUBJECT.code} — ${d.name}`;
  $('gaDetailSub').textContent=`الدرجة الكلية: ${CUR_SUBJECT.exam_total}`;
  $('gaStats').innerHTML='';
  $('gaCatTable').innerHTML='';
  $('gaStudentTable').innerHTML='<tr><td style="padding:20px;text-align:center;color:#8a93a0">جارٍ التحميل…</td></tr>';

  const {data:enr}=await db.from('enrollments').select('students(id,full_name,academic_number)').eq('section_id',d.secid).is('to_date',null);
  const students=(enr||[]).map(e=>e.students).filter(Boolean);
  const {data:recs}=await db.from('grade_records').select('student_id,score').eq('exam_id',d.exam);
  const scoreBy={}; for(const r of recs||[]) if(r.score!=null) scoreBy[r.student_id]=r.score;

  const total=CUR_SUBJECT.exam_total;
  const rows=students.map(s=>{
    const score=scoreBy[s.id];
    const pct = score!=null ? (score/total*100) : null;
    const cat = pct!=null ? categoryOf(pct) : null;
    return {...s, score, pct, cat};
  }).sort((a,b)=>numKey(a.academic_number)-numKey(b.academic_number));

  const graded=rows.filter(r=>r.score!=null);
  const passCount=graded.filter(r=>r.pct>=THRESH.pass_pct).length;
  const masteryCount=graded.filter(r=>r.pct>=THRESH.mastery_pct).length;
  const failCount=graded.length-passCount;

  $('gaStats').innerHTML=`
    <div class="stat"><b>${students.length}</b><span>إجمالي الطالبات</span></div>
    <div class="stat"><b>${graded.length}</b><span>تم رصدهن</span></div>
    <div class="stat green"><b>${graded.length?((passCount/graded.length*100).toFixed(1)+'٪'):'—'}</b><span>نسبة النجاح</span></div>
    <div class="stat"><b>${graded.length?((masteryCount/graded.length*100).toFixed(1)+'٪'):'—'}</b><span>نسبة الإتقان</span></div>
    <div class="stat red"><b>${graded.length?((failCount/graded.length*100).toFixed(1)+'٪'):'—'}</b><span>نسبة الرسوب</span></div>`;

  const perCat={}; for(const c of CATS) perCat[c.id]={cat:c,count:0};
  for(const r of graded) if(r.cat) perCat[r.cat.id].count++;
  $('gaCatTable').innerHTML='<tr><th>الفئة</th><th>الحد</th><th>العدد</th></tr>'+
    CATS.map(c=>`<tr><td><span class="ga-swatch" style="background:${c.color}"></span>${c.name}</td><td class="c">${c.min_pct}–${c.max_pct}٪</td><td class="c">${perCat[c.id].count}</td></tr>`).join('');

  $('gaStudentTable').innerHTML='<tr><th>#</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>الدرجة</th><th>النسبة</th><th>الفئة</th></tr>'+
    rows.map((r,i)=>`<tr style="${r.cat?`background:${r.cat.color}22`:''}">
      <td class="c">${i+1}</td><td class="c">${r.academic_number}</td><td>${r.full_name}</td>
      <td class="c">${r.score??'—'}</td><td class="c">${r.pct!=null?r.pct.toFixed(1)+'٪':'—'}</td>
      <td class="c">${r.cat?`<span class="ga-swatch" style="background:${r.cat.color}"></span>${r.cat.name}`:'—'}</td></tr>`).join('');

  CUR_DETAIL={secCode:d.sec, secId:d.secid, examName:d.name, rows, graded, passCount, masteryCount, failCount};
}
function numKey(v){ return parseInt(String(v).replace(/[^\d]/g,''),10) || 0; }

/* ============ تصدير إكسل ============ */
const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const gaBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function exportXls(){
  if(!CUR_DETAIL){ toast('افتحي تحليل اختبار أولاً'); return; }
  const d=CUR_DETAIL;
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('كشف الدرجات',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,6);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle(`${d.secCode} — ${CUR_SUBJECT.code} — ${d.examName} — من ${CUR_SUBJECT.exam_total}`,12,true,null,'FF22303C');
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
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url;
  a.download=`كشف_الدرجات_${d.secCode}_${CUR_SUBJECT.code}_${d.examName}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

/* ============ تصدير PDF ============ */
function exportPdf(){
  if(!CUR_DETAIL){ toast('افتحي تحليل اختبار أولاً'); return; }
  const d=CUR_DETAIL;
  const rows=d.rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r.academic_number}</td><td style="text-align:right">${r.full_name}</td>
    <td>${r.score??'—'}</td><td>${r.pct!=null?r.pct.toFixed(1)+'٪':'—'}</td><td>${r.cat?.name||'—'}</td></tr>`).join('');
  const footer=`<div class="ga-footer">${schoolName()} — طُبع بتاريخ ${new Date().toISOString().slice(0,10)}</div>`;
  $('printAreaGA').innerHTML=`
    <div class="ga-head"><h2>كشف الدرجات والتصنيف — ${d.secCode} — ${CUR_SUBJECT.code} — ${d.examName}</h2>
      <p>الدرجة الكلية: ${CUR_SUBJECT.exam_total} — نجاح: ${d.graded.length?((d.passCount/d.graded.length*100).toFixed(1)+'٪'):'—'} — إتقان: ${d.graded.length?((d.masteryCount/d.graded.length*100).toFixed(1)+'٪'):'—'} — رسوب: ${d.graded.length?((d.failCount/d.graded.length*100).toFixed(1)+'٪'):'—'}</p></div>
    <table class="ga-tbl"><tr><th>#</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>الدرجة</th><th>النسبة</th><th>الفئة</th></tr>${rows}</table>${footer}`;
  printWithTitle(`كشف_الدرجات_${d.secCode}_${CUR_SUBJECT.code}_${d.examName}`);
}

registerTab({id:'gaMain', label:'تحليل الاختبارات', group:'grades', groupLabel:'الدرجات',
  show:f=>f.isAdmin||f.isLead||f.isAnalysis, init:initAnalysis});
