/* period.js — تقارير الفترة الزمنية
   أداتان مستقلتان تماماً عن بعضهما:
   ١) تقرير سريع: طالبات غِبن N مرة خلال فترة — بلا انتظار أي تقرير آخر.
   ٢) تقرير فترة شامل: ملخص (أكثر/أقل الصفوف، تجاوز ٢٥٪) + صفحة PDF لكل يوم.
   كلاهما يستخدمان نفس منطق الاحتساب (collectRange) لكن يُشغَّلان بشكل مستقل.
   الملف مكتفٍ بذاته: يضيف تبويبه وتنسيقاته وحاوية طباعته الخاصة. */
import { db, $, S, AR_DAYS, dstr, chunk, toast, registerTab } from './core.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';
const HIGH_THRESHOLD = 25; // % — عتبة «تجاوز الغياب» في التقرير الشامل

/* ============ حقن الواجهة والتنسيقات ============ */
$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="periodMain" style="display:none">

  <div class="panel">
    <h3>تقرير سريع — عدد مرات الغياب</h3>
    <div class="sub">حددي فترة وعدد مرات، وتظهر لك الطالبات مباشرة — أداة مستقلة لا تحتاج إنشاء أي تقرير آخر أولاً.</div>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <label style="font-size:13px;color:var(--navy);font-weight:600">من <input type="date" id="cntFrom"></label>
      <label style="font-size:13px;color:var(--navy);font-weight:600">إلى <input type="date" id="cntTo"></label>
      <label style="font-size:13px;color:var(--navy);font-weight:600">عدد المرات <input type="number" id="cntThreshold" min="1" value="4" style="width:70px;padding:9px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit"></label>
      <select id="cntOp" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)">
        <option value="gte">فأكثر</option>
        <option value="eq">بالضبط</option>
      </select>
      <button class="btn gold" id="cntGo" style="width:auto;padding:11px 26px">عرض القائمة</button>
      <button class="btn ghost" id="cntPdf" style="width:auto;padding:11px 26px">⬇ PDF</button>
    </div>
    <div class="result" id="cntStatus" style="display:none;background:var(--sand);color:var(--ink);border:1px solid var(--line)"></div>
    <div class="board-wrap"><table class="board" id="pCountTable"></table></div>
  </div>

  <div class="panel">
    <h3>تقرير فترة شامل</h3>
    <div class="sub">اختاري بداية ونهاية الفترة (مثلاً شهر كامل) ليُبنى تقرير شامل: ملخص للفترة + صفحة لكل يوم دراسي، جاهز للطباعة أو تنزيل PDF.</div>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <label style="font-size:13px;color:var(--navy);font-weight:600">من <input type="date" id="perFrom"></label>
      <label style="font-size:13px;color:var(--navy);font-weight:600">إلى <input type="date" id="perTo"></label>
      <button class="btn gold" id="perGo" style="width:auto;padding:11px 26px">إنشاء التقرير</button>
    </div>
    <div class="result" id="perStatus" style="display:none;background:var(--sand);color:var(--ink);border:1px solid var(--line)"></div>
  </div>

  <div id="perResults" style="display:none">
    <div class="stats">
      <div class="stat"><b id="pDays">—</b><span>يوم دراسي مُحتسب</span></div>
      <div class="stat red"><b id="pTotalAbs">—</b><span>إجمالي أيام الغياب</span></div>
      <div class="stat"><b id="pAvg">—</b><span>متوسط الغياب اليومي</span></div>
      <div class="stat red"><b id="pHigh">—</b><span>طالبة تجاوزت ${HIGH_THRESHOLD}٪</span></div>
    </div>
    <div class="warnbox" id="perExcluded" style="display:none"></div>

    <div class="panel">
      <h3>أكثر الصفوف غياباً</h3>
      <div class="sub">"إجمالي حالات الغياب" هو مجموع غياب كل طالبات الشعبة عبر كل أيام الفترة مجتمعة (وليس عدد أيام) — لذا رقمه طبيعي أن يتجاوز عدد الأيام الدراسية المحتسبة أعلاه.</div>
      <div class="board-wrap"><table class="board" id="pTopTable"></table></div>
    </div>
    <div class="panel">
      <h3>أقل الصفوف غياباً</h3>
      <div class="board-wrap"><table class="board" id="pBottomTable"></table></div>
    </div>
    <div class="panel">
      <h3>طالبات تجاوز غيابهن ${HIGH_THRESHOLD}٪ من أيام الفترة</h3>
      <div class="sub">نسبة الاحتساب مبنية على عدد المقيدات الحالي بكل شعبة، وقد تختلف قليلاً إن حدث نقل بين الشعب خلال الفترة.</div>
      <div class="board-wrap"><table class="board" id="pHighTable"></table></div>
    </div>
    <div class="panel">
      <h3>الغياب اليومي خلال الفترة</h3>
      <div class="board-wrap"><table class="board" id="pDailyTable"></table></div>
    </div>

    <button class="btn ghost" id="perPdf" style="width:auto;padding:11px 26px">⬇ تنزيل PDF كامل الفترة (ملخص + صفحة لكل يوم)</button>
  </div>
</div>
<div id="printAreaPeriod"></div>
<style>
  #periodMain.wide{max-width:1400px}
  #periodMain input[type=date]{padding:9px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)}
  #printAreaPeriod{display:none}
  @media print{
    body *{visibility:hidden}
    #printAreaPeriod, #printAreaPeriod *{visibility:visible}
    #printAreaPeriod{display:block;position:absolute;inset-inline-start:0;top:0;width:100%}
    .pr-page{page-break-after:always;padding:6px}
    .pr-page:last-child{page-break-after:auto}
    .pr-head{text-align:center;margin-bottom:12px}
    .pr-head h1{font-family:'Amiri',serif;font-size:19px;color:#1d3d5c;margin-bottom:4px}
    .pr-head h2{font-size:14px;color:#1d3d5c;font-weight:600;margin-bottom:6px}
    .pr-head p{font-size:11.5px;color:#333}
    .pr-tbl{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:14px}
    .pr-tbl th{background:#1d3d5c;color:#fff;padding:5px;border:1px solid #1d3d5c}
    .pr-tbl td{padding:4px;border:1px solid #ccc;text-align:right}
    .pr-tbl td.c{text-align:center}
    .pr-sub{font-size:12.5px;color:#1d3d5c;font-weight:700;margin:10px 0 6px}
  }
</style>`);

async function mapLimit(items, limit, fn){
  const ret=new Array(items.length); let i=0;
  async function worker(){ while(i<items.length){ const idx=i++; ret[idx]=await fn(items[idx]); } }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return ret;
}

async function processDay(d){
  const jsDay=d.getDay();
  if(jsDay>4) return null; // جمعة/سبت — ليست يوم دراسة أصلاً، تُستبعد بصمت
  const dow=jsDay+1, date=dstr(d);
  const {data:ents}=await db.from('timetable_entries')
    .select('id,section_id,sections(code)')
    .eq('academic_year_id',S.YEAR.id).eq('day_of_week',dow).eq('period_no',1);
  const entIds=(ents||[]).map(e=>e.id);
  if(!entIds.length) return {date, excluded:true, reason:'لا حصص أولى مجدولة لهذا اليوم'};
  const secOfEntry={}; for(const e of ents) secOfEntry[e.id]=e.sections?.code||'—';
  const {data:sess}=await db.from('attendance_sessions').select('id,entry_id').in('entry_id',entIds).eq('date',date);
  if(!sess||!sess.length) return {date, excluded:true, reason:'لا رصد مسجل — يُحتمل عطلة'};
  const secOfSess={}; for(const s of sess) secOfSess[s.id]=secOfEntry[s.entry_id];
  const [{data:late},{data:exc}] = await Promise.all([
    db.from('late_log').select('student_id').eq('date',date),
    db.from('excuse_log').select('student_id').eq('date',date),
  ]);
  const covered=new Set([...(late||[]),...(exc||[])].map(r=>r.student_id));
  const sessIds=sess.map(s=>s.id);
  const bySid={};
  for(const c of chunk(sessIds,200)){
    const {data:recs}=await db.from('attendance_records').select('session_id,student_id,status').in('session_id',c);
    for(const r of recs||[])
      if(r.status==='absent' && !covered.has(r.student_id)) bySid[r.student_id]=secOfSess[r.session_id];
  }
  return {date, jsDay, excluded:false, bySid};
}

/* يجمع بيانات فترة من/إلى — يُستخدم من الأداتين المستقلتين كلٌ بمدخلاتها الخاصة */
export async function collectRange(from,to){
  const days=[];
  for(let d=new Date(from+'T12:00:00'); dstr(d)<=to; d.setDate(d.getDate()+1)) days.push(new Date(d));
  const results=(await mapLimit(days,4,processDay)).filter(Boolean);
  const DAILY=results.filter(r=>!r.excluded);
  const EXCLUDED=results.filter(r=>r.excluded);
  const perStudentAbsDays={}, perSectionAbsDays={}, perDayAbsCount={};
  const allSids=new Set();
  for(const day of DAILY){
    perDayAbsCount[day.date]=Object.keys(day.bySid).length;
    for(const [sid,sec] of Object.entries(day.bySid)){
      perStudentAbsDays[sid]=(perStudentAbsDays[sid]||0)+1;
      perSectionAbsDays[sec]=(perSectionAbsDays[sec]||0)+1;
      allSids.add(sid);
    }
  }
  const STU_INFO={};
  for(const c of chunk([...allSids],200)){
    const {data:st}=await db.from('students').select('id,full_name,academic_number').in('id',c);
    for(const s of st||[]) STU_INFO[s.id]=s;
  }
  return {DAILY,EXCLUDED,perStudentAbsDays,perSectionAbsDays,perDayAbsCount,STU_INFO,schoolDaysCount:DAILY.length};
}

/* ============ الأداة ١ — تقرير سريع بعدد مرات الغياب (مستقلة تماماً) ============ */
let CNT_RANGE=null, CURRENT_COUNT=[];
function initCount(){
  if($('cntFrom').dataset.ready) return;
  $('cntFrom').dataset.ready='1';
  const today=dstr(new Date());
  $('cntFrom').value=today.slice(0,8)+'01';
  $('cntTo').value=today;
  $('cntGo').addEventListener('click',runCountReport);
  $('cntPdf').addEventListener('click',exportCountPdf);
}
async function runCountReport(){
  const from=$('cntFrom').value, to=$('cntTo').value;
  if(!from||!to){ toast('حددي بداية ونهاية الفترة'); return; }
  if(from>to){ toast('تاريخ البداية بعد تاريخ النهاية'); return; }
  const btn=$('cntGo'); btn.disabled=true; btn.textContent='جارٍ التجميع…';
  $('cntStatus').style.display='block'; $('cntStatus').className='result';
  $('cntStatus').textContent='جارٍ تجميع بيانات الفترة…';
  try{
    CNT_RANGE=await collectRange(from,to);
    if(!CNT_RANGE.schoolDaysCount){ toast('لا أيام دراسية صالحة في هذه الفترة'); $('pCountTable').innerHTML=''; return; }
    renderCountReport();
    $('cntStatus').style.display='none';
  }catch(err){ $('cntStatus').className='result err'; $('cntStatus').textContent='تعذر التحميل: '+(err.message||err); }
  finally{ btn.disabled=false; btn.textContent='عرض القائمة'; }
}
function renderCountReport(){
  if(!CNT_RANGE) return;
  const n=Math.max(1,+$('cntThreshold').value||1), op=$('cntOp').value;
  CURRENT_COUNT=Object.keys(CNT_RANGE.perStudentAbsDays)
    .map(sid=>({sid, ...CNT_RANGE.STU_INFO[sid], absDays:CNT_RANGE.perStudentAbsDays[sid]}))
    .filter(s=>s.full_name && (op==='eq' ? s.absDays===n : s.absDays>=n))
    .sort((a,b)=>b.absDays-a.absDays);
  const opLabel=op==='eq'?'بالضبط':'فأكثر';
  $('pCountTable').innerHTML = CURRENT_COUNT.length
    ? `<tr><th>#</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>عدد أيام الغياب</th></tr>`+
      CURRENT_COUNT.map((s,i)=>`<tr><td class="c">${i+1}</td><td class="c">${s.academic_number}</td><td>${s.full_name}</td><td class="c">${s.absDays}</td></tr>`).join('')
    : `<tr><td style="padding:20px;text-align:center;color:#8a93a0">لا طالبات غِبن ${n} مرة ${opLabel} خلال هذه الفترة 🎉</td></tr>`;
}
function exportCountPdf(){
  if(!CNT_RANGE){ toast('اعرضي القائمة أولاً'); return; }
  if(!CURRENT_COUNT.length){ toast('لا طالبات في هذه القائمة'); return; }
  const n=$('cntThreshold').value, opLabel=$('cntOp').value==='eq'?'بالضبط':'فأكثر';
  const rows=CURRENT_COUNT.map((s,i)=>`<tr><td class="c">${i+1}</td><td class="c">${s.academic_number}</td><td>${s.full_name}</td><td class="c">${s.absDays}</td></tr>`).join('');
  $('printAreaPeriod').innerHTML = `
    <div class="pr-page">
      <div class="pr-head"><h1>${schoolName()}</h1><h2>طالبات غِبن ${n} مرة ${opLabel}</h2>
        <p>من ${$('cntFrom').value} إلى ${$('cntTo').value} — العدد: ${CURRENT_COUNT.length}</p></div>
      <table class="pr-tbl"><tr><th>#</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>عدد أيام الغياب</th></tr>${rows}</table>
    </div>`;
  window.print();
}

/* ============ الأداة ٢ — تقرير فترة شامل ============ */
let RANGE=null, SUMMARY=null;
function initFull(){
  if($('perFrom').dataset.ready) return;
  $('perFrom').dataset.ready='1';
  const today=dstr(new Date());
  $('perFrom').value=today.slice(0,8)+'01';
  $('perTo').value=today;
  $('perGo').addEventListener('click',generateReport);
  $('perPdf').addEventListener('click',exportPdf);
}
async function generateReport(){
  const from=$('perFrom').value, to=$('perTo').value;
  if(!from||!to){ toast('حددي بداية ونهاية الفترة'); return; }
  if(from>to){ toast('تاريخ البداية بعد تاريخ النهاية'); return; }
  const btn=$('perGo'); btn.disabled=true; btn.textContent='جارٍ التجميع…';
  $('perStatus').style.display='block'; $('perStatus').className='result';
  $('perStatus').textContent='جارٍ تجميع بيانات الفترة — قد يستغرق دقيقة لفترة طويلة…';
  $('perResults').style.display='none';
  try{
    RANGE=await collectRange(from,to);
    if(!RANGE.schoolDaysCount){ toast('لا أيام دراسية صالحة في هذه الفترة'); return; }
    const {schoolDaysCount,perStudentAbsDays,perSectionAbsDays,perDayAbsCount}=RANGE;

    const {data:enr}=await db.from('enrollments').select('section_id,sections(code)').is('to_date',null);
    const enrolledCount={}; for(const e of enr||[]){ const c=e.sections?.code; if(c) enrolledCount[c]=(enrolledCount[c]||0)+1; }

    const sectionRates=Object.keys(perSectionAbsDays).map(code=>({
      code, absDays:perSectionAbsDays[code],
      rate: enrolledCount[code] ? (perSectionAbsDays[code]/(enrolledCount[code]*schoolDaysCount)*100) : null,
    })).filter(s=>s.rate!==null);
    const topSections=[...sectionRates].sort((a,b)=>b.rate-a.rate).slice(0,3);
    const bottomSections=[...sectionRates].sort((a,b)=>a.rate-b.rate).slice(0,3);

    const highStudents=Object.keys(perStudentAbsDays)
      .map(sid=>({sid, ...RANGE.STU_INFO[sid], absDays:perStudentAbsDays[sid], rate:perStudentAbsDays[sid]/schoolDaysCount*100}))
      .filter(s=>s.rate>=HIGH_THRESHOLD && s.full_name)
      .sort((a,b)=>b.rate-a.rate);

    const totalAbs=Object.values(perDayAbsCount).reduce((a,b)=>a+b,0);
    SUMMARY={from,to,schoolDaysCount,perDayAbsCount,topSections,bottomSections,highStudents,totalAbs};
    renderSummary();
    $('perResults').style.display='block';
    $('perStatus').style.display='none';
  }catch(err){ $('perStatus').className='result err'; $('perStatus').textContent='تعذر إنشاء التقرير: '+(err.message||err); }
  finally{ btn.disabled=false; btn.textContent='إنشاء التقرير'; }
}
function renderSummary(){
  const s=SUMMARY;
  $('pDays').textContent=s.schoolDaysCount;
  $('pTotalAbs').textContent=s.totalAbs;
  $('pAvg').textContent=(s.totalAbs/s.schoolDaysCount).toFixed(1);
  $('pHigh').textContent=s.highStudents.length;

  if(RANGE.EXCLUDED.length){
    $('perExcluded').style.display='block';
    $('perExcluded').innerHTML=`⚠️ أيام استُبعدت من الاحتساب (${RANGE.EXCLUDED.length}) لعدم وجود رصد — تحققي أنها عطلات فعلاً:<br>`+
      RANGE.EXCLUDED.map(e=>`• ${e.date} — ${e.reason}`).join('<br>');
  }else{ $('perExcluded').style.display='none'; }

  const secRow=r=>`<tr><td class="sec">${r.code}</td><td class="c">${r.absDays}</td><td class="c">${r.rate.toFixed(1)}٪</td></tr>`;
  $('pTopTable').innerHTML='<tr><th>الشعبة</th><th>إجمالي حالات الغياب</th><th>نسبة الغياب</th></tr>'+(s.topSections.map(secRow).join('')||'<tr><td colspan="3">لا بيانات</td></tr>');
  $('pBottomTable').innerHTML='<tr><th>الشعبة</th><th>إجمالي حالات الغياب</th><th>نسبة الغياب</th></tr>'+(s.bottomSections.map(secRow).join('')||'<tr><td colspan="3">لا بيانات</td></tr>');

  $('pHighTable').innerHTML = s.highStudents.length
    ? '<tr><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>أيام الغياب</th><th>النسبة</th></tr>'+
      s.highStudents.map(h=>`<tr><td class="c">${h.academic_number}</td><td>${h.full_name}</td><td class="c">${h.absDays}</td><td class="c">${h.rate.toFixed(1)}٪</td></tr>`).join('')
    : '<tr><td style="padding:20px;text-align:center;color:#8a93a0">لا طالبات تجاوزن العتبة 🎉</td></tr>';

  const dayRows=Object.entries(s.perDayAbsCount).sort(([a],[b])=>a.localeCompare(b))
    .map(([date,c])=>`<tr><td class="sec">${date}</td><td class="c">${c}</td></tr>`).join('');
  $('pDailyTable').innerHTML='<tr><th>التاريخ</th><th>عدد الغياب الرسمي</th></tr>'+dayRows;
}
function exportPdf(){
  if(!SUMMARY){ toast('أنشئي التقرير أولاً'); return; }
  const s=SUMMARY;
  const secRowP=r=>`<tr><td>${r.code}</td><td class="c">${r.absDays}</td><td class="c">${r.rate.toFixed(1)}٪</td></tr>`;
  const summaryPage=`
    <div class="pr-page">
      <div class="pr-head"><h1>${schoolName()}</h1><h2>تقرير غياب الفترة — ملخص</h2>
        <p>من ${s.from} إلى ${s.to} — ${s.schoolDaysCount} يوم دراسي محتسب — إجمالي أيام الغياب: ${s.totalAbs} — المتوسط اليومي: ${(s.totalAbs/s.schoolDaysCount).toFixed(1)}</p></div>
      <div class="pr-sub">الغياب اليومي</div>
      <table class="pr-tbl"><tr><th>التاريخ</th><th>عدد الغياب الرسمي</th></tr>
        ${Object.entries(s.perDayAbsCount).sort(([a],[b])=>a.localeCompare(b)).map(([d,c])=>`<tr><td class="c">${d}</td><td class="c">${c}</td></tr>`).join('')}
      </table>
      <div class="pr-sub">أكثر الصفوف غياباً</div>
      <table class="pr-tbl"><tr><th>الشعبة</th><th>إجمالي حالات الغياب</th><th>نسبة الغياب</th></tr>${s.topSections.map(secRowP).join('')}</table>
      <div class="pr-sub">أقل الصفوف غياباً</div>
      <table class="pr-tbl"><tr><th>الشعبة</th><th>إجمالي حالات الغياب</th><th>نسبة الغياب</th></tr>${s.bottomSections.map(secRowP).join('')}</table>
      <div class="pr-sub">طالبات تجاوز غيابهن ${HIGH_THRESHOLD}٪ من أيام الفترة</div>
      <table class="pr-tbl"><tr><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>أيام الغياب</th><th>النسبة</th></tr>
        ${s.highStudents.map(h=>`<tr><td class="c">${h.academic_number}</td><td>${h.full_name}</td><td class="c">${h.absDays}</td><td class="c">${h.rate.toFixed(1)}٪</td></tr>`).join('')||'<tr><td colspan="4" class="c">لا طالبات تجاوزن العتبة</td></tr>'}
      </table>
    </div>`;
  const dayPages=RANGE.DAILY.map(day=>{
    const rows=Object.entries(day.bySid).map(([sid,sec],i)=>{
      const st=RANGE.STU_INFO[sid]||{};
      return `<tr><td class="c">${i+1}</td><td class="c">${st.academic_number||''}</td><td>${st.full_name||''}</td><td class="c">${sec}</td></tr>`;
    }).join('');
    return `<div class="pr-page">
      <div class="pr-head"><h1>${schoolName()}</h1><h2>الغائبات رسمياً — ${AR_DAYS[day.jsDay]||''} ${day.date}</h2>
        <p>العدد: ${Object.keys(day.bySid).length}</p></div>
      <table class="pr-tbl"><tr><th>#</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>الصف</th></tr>${rows||'<tr><td colspan="4" class="c">لا غياب رسمياً</td></tr>'}</table>
    </div>`;
  }).join('');
  $('printAreaPeriod').innerHTML = summaryPage + dayPages;
  window.print();
}

registerTab({id:'periodMain', label:'تقرير فترة', group:'attendance', groupLabel:'متابعة الغياب',
  show:f=>f.isAdmin||f.isSocial||f.isReg||f.isLead||f.isAttendanceLead, onOpen:()=>{ initCount(); initFull(); }});
