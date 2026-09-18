/* substitutes.js — تأمين حصص الاحتياط:
   الأدمن أو "مسؤولة الاحتياط" يختار تاريخاً ويحدد المعلمات الغائبات، فيظهر
   جدول كل معلمة غائبة بحصص ذلك اليوم (على غرار نموذج الورقة المعتمد)، مع
   ترشيح تلقائي مرتَّب لأنسب معلمة احتياط لكل حصة:
   استبعاد: غير المعلمات (إدارة/مكاتب غير تدريسية)، من هي في إجازة، الغائبات
   أنفسهن، من نصابها الأسبوعي ≥٢٠ حصة، من نصابها اليوم ≥٤ حصص، ومن عندها
   حصة أخرى (أصلية أو احتياط سابق) في نفس التوقيت — ثم الأولوية للأقل نصاباً
   أسبوعياً فالأقل نصاباً اليوم، مع فصل القائمة بخط بين المعلمات (أولاً)
   والمعلمة الأولى (بعدها). أي مرشَّحة اختيارها يجعل حصصها اليوم متتالية بلا
   فاصل تُعلَّم بتحذير أحمر (⚠) دون استبعادها. كل اختيار يُحفظ فوراً (upsert)،
   وسجل الاحتياط يحتسب لكل معلمة عدد الحصص والأيام التي أخذتها. */
import { db, $, S, dstr, clean, toast, logAction, getCurrentSemester, printWithTitle, printHeaderHtml, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="subsMain" style="display:none">
  <div class="lm-subnav" id="subsSubnav"></div>

  <div data-substab="daily" style="display:none">
    <div class="panel">
      <h3>تأمين حصص اليوم</h3>
      <div class="sub">اختاري التاريخ ثم أضيفي المعلمات الغائبات — يظهر جدول كل واحدة منهن بحصص ذلك اليوم، مع ترشيح تلقائي مرتَّب لمعلمة الاحتياط لكل حصة (معلمات أولاً ثم معلمة أولى). كل اختيار يُحفظ فوراً. <span style="color:#c0392b">⚠</span> بجانب اسم أي مرشَّحة يعني اختيارها يجعل عندها ٣ حصص متتالية فأكثر بلا فاصل اليوم — لا يمنعها، تنبيه فقط.</div>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="min-width:170px"><label>التاريخ</label><input type="date" id="subDate"></div>
        <div class="field" style="flex:1;min-width:240px;position:relative">
          <label>إضافة معلمة غائبة</label>
          <input type="text" id="subAbsentSearch" placeholder="اكتبي اسماً…" autocomplete="off">
          <div id="subAbsentSugg"></div>
        </div>
        <button class="btn ghost" id="subPrintDay" style="width:auto;padding:10px 22px">🖨 طباعة جدول اليوم</button>
      </div>
      <div id="subAbsentChips" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"></div>
    </div>
    <div id="subDayBody"></div>
  </div>

  <div data-substab="log" style="display:none">
    <div class="panel">
      <h3>سجل الاحتياط</h3>
      <div class="sub">كل ترشيحات الاحتياط المحفوظة — فلتري بفترة أو باسم معلمة الاحتياط.</div>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="min-width:150px"><label>من</label><input type="date" id="subLogFrom"></div>
        <div class="field" style="min-width:150px"><label>إلى</label><input type="date" id="subLogTo"></div>
        <div class="field" style="flex:1;min-width:200px"><label>معلمة الاحتياط</label><select id="subLogSub"><option value="">الكل</option></select></div>
        <button class="btn gold" id="subLogGo" style="width:auto;padding:10px 22px">عرض</button>
        <button class="btn ghost" id="subLogXls" style="width:auto;padding:10px 22px">⬇ إكسل</button>
        <button class="btn ghost" id="subLogPdf" style="width:auto;padding:10px 22px">⬇ PDF</button>
      </div>
    </div>
    <div class="panel">
      <h3>إجمالي الحصص لكل معلمة احتياط</h3>
      <div class="board-wrap"><table class="board" id="subSummaryTbl"></table></div>
    </div>
    <div class="panel">
      <h3>التفصيل</h3>
      <div class="board-wrap"><table class="board" id="subLogTbl"></table></div>
    </div>
  </div>

  <div id="printAreaSubs"></div>
</div>
<style>
  #subsMain.wide{max-width:1300px}
  #subAbsentSugg{position:absolute;top:100%;inset-inline-start:0;background:#fff;border:1px solid var(--line);border-radius:8px;margin-top:4px;max-height:220px;overflow-y:auto;width:100%;z-index:5}
  #subAbsentSugg:empty{display:none}
  #subAbsentSugg .opt{padding:8px 12px;cursor:pointer;font-size:13px}
  #subAbsentSugg .opt:hover{background:var(--sand)}
  .sub-chip{display:inline-flex;align-items:center;gap:7px;background:var(--gold-soft);border:1px solid #ecd9ab;color:var(--warn);border-radius:99px;padding:6px 14px;font-size:12.5px}
  .sub-chip button{background:none;border:none;color:var(--err);cursor:pointer;font-size:14px;line-height:1}
  .sub-teacher-panel{margin-top:14px}
  .sub-teacher-panel h4{margin:0 0 10px;color:var(--navy)}
  #subDayBody .sub-cell{min-width:120px;vertical-align:top;padding:8px 6px}
  #subDayBody .sub-cell b{display:block;font-size:12.5px;color:var(--navy)}
  #subDayBody .sub-cell small{display:block;color:#6b7683;margin-bottom:6px}
  #subDayBody select.sub-pick{width:100%;padding:5px;border:1px solid var(--line);border-radius:6px;font:inherit;font-size:11.5px}
  #subDayBody select.sub-pick.filled{border-color:#3a7a3a;background:#eef8ef}
  #mcToday .lesson{margin-bottom:8px}
  #printAreaSubs{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0.25in}
    body *{visibility:hidden}
    #printAreaSubs, #printAreaSubs *{visibility:visible}
    #printAreaSubs{display:block;position:absolute;inset-inline-start:0;top:0;width:100%}
    .subs-print-tbl{width:100%;border-collapse:collapse;font-size:10.5pt;margin-bottom:14px}
    .subs-print-tbl th{background:#1d3d5c;color:#fff;padding:5px;border:1px solid #1d3d5c}
    .subs-print-tbl td{padding:4px;border:1px solid #ccc;text-align:center}
  }
</style>`);

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="myCoverage" style="display:none">
  <div class="panel">
    <h3>حصص الاحتياط عليّ اليوم</h3>
    <div id="mcToday"></div>
  </div>
  <div class="panel">
    <h3>حصص احتياط سابقة</h3>
    <div class="board-wrap"><table class="board" id="mcHistTbl"></table></div>
  </div>
</div>`);

const SUBS_TABS=[
  {id:'daily', label:'تأمين حصص اليوم'},
  {id:'log', label:'سجل الاحتياط'},
];
const DAILY_LIMIT=4, WEEKLY_LIMIT=20;

let SUB_DATE=dstr(new Date());
let ABSENT=[];               // [{id,full_name}]
let CANDIDATES=[];           // [{id,full_name}]
let WEEKLY_COUNT={}, TODAY_COUNT={}, BUSY_BY_PERIOD={}; // period_no -> Set(staff_id)
let STAFF_BUSY_PERIODS={};   // staff_id -> Set(period_no) — حصصها اليوم (أصلية + احتياط مُسنَد سابقاً بنفس التاريخ)
let ASSIGN_BY_ENTRY={};      // entry_id -> {id, absent_staff_id, substitute_staff_id}

function switchSubsTab(tab){
  document.querySelectorAll('#subsMain > [data-substab]').forEach(el=>{ el.style.display = el.dataset.substab===tab?'block':'none'; });
  $('subsSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.classList.toggle('active', b.dataset.substab===tab));
  if(tab==='log') loadLog();
}

async function initSubs(){
  if($('subsSubnav').dataset.ready) return;
  $('subsSubnav').dataset.ready='1';
  $('subsSubnav').innerHTML=SUBS_TABS.map(t=>`<button class="lm-subnav-btn" data-substab="${t.id}">${t.label}</button>`).join('');
  $('subsSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.addEventListener('click',()=>switchSubsTab(b.dataset.substab)));
  switchSubsTab('daily');

  $('subDate').value=SUB_DATE;
  $('subDate').addEventListener('change',()=>{
    if(!$('subDate').value) return;
    SUB_DATE=$('subDate').value; ABSENT=[]; renderChips(); renderDay();
  });
  $('subPrintDay').addEventListener('click', printDaily);

  let deb=null;
  $('subAbsentSearch').addEventListener('input',()=>{
    clearTimeout(deb);
    const q=clean($('subAbsentSearch').value);
    if(q.length<2){ $('subAbsentSugg').innerHTML=''; return; }
    deb=setTimeout(async ()=>{
      const {data}=await db.from('staff').select('id,full_name,departments(name)')
        .in('title',['teacher','senior_teacher']).eq('is_active',true).ilike('full_name',`%${q}%`).limit(8);
      const already=new Set(ABSENT.map(a=>a.id));
      const opts=(data||[]).filter(s=>!already.has(s.id));
      $('subAbsentSugg').innerHTML=opts.map(s=>`<div class="opt" data-id="${s.id}" data-name="${s.full_name}">${s.full_name}<small style="display:block;color:#8a93a0">${s.departments?.name||''}</small></div>`).join('');
      $('subAbsentSugg').querySelectorAll('.opt').forEach(el=>el.addEventListener('click', ()=>{
        ABSENT.push({id:el.dataset.id, full_name:el.dataset.name});
        $('subAbsentSearch').value=''; $('subAbsentSugg').innerHTML='';
        renderChips(); renderDay();
      }));
    },250);
  });

  await renderDay();
}

function renderChips(){
  $('subAbsentChips').innerHTML = ABSENT.map(a=>`<span class="sub-chip">${a.full_name}<button data-id="${a.id}">✕</button></span>`).join('');
  $('subAbsentChips').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
    ABSENT=ABSENT.filter(a=>a.id!==b.dataset.id);
    renderChips(); renderDay();
  }));
}

/* day_of_week بقاعدة البيانات: ١=الأحد … ٥=الخميس (نفس تحويل board.js/my-schedule.js) */
function getDow(dateStr){ return new Date(dateStr+'T12:00:00').getDay()+1; }

/* ============ حوض المرشَّحات: معلمات فقط (مو إدارة ولا مكاتب)، بنصابها الأسبوعي واليومي وانشغالها بكل حصة ============ */
async function loadCandidatePool(dow){
  const {data:staff}=await db.from('staff').select('id,full_name,title,on_leave,departments(kind)')
    .in('title',['teacher','senior_teacher']).eq('is_active',true);
  /* الاحتياط حق المعلمات والمعلمة الأولى (لا الإدارة أو المكاتب)، وباستبعاد
     من هي في إجازة حالياً (تُدار من "إدارة المنتسبات"). استبعاد المكاتب غير
     التدريسية هنا عبر kind='office' بدل مطابقة الاسم — أسلم من فروق كتابة
     أسماء الأقسام (لاحظنا بعض التكرار). */
  CANDIDATES=(staff||[]).filter(s=>s.departments?.kind!=='office' && !s.on_leave);

  const ids=CANDIDATES.map(c=>c.id);
  WEEKLY_COUNT={}; TODAY_COUNT={}; BUSY_BY_PERIOD={}; STAFF_BUSY_PERIODS={};
  if(ids.length){
    const {data:rows}=await db.from('entry_teachers')
      .select('staff_id,timetable_entries!inner(day_of_week,period_no,academic_year_id,semester,is_current)')
      .in('staff_id',ids).eq('timetable_entries.academic_year_id',S.YEAR.id)
      .eq('timetable_entries.semester',getCurrentSemester()).eq('timetable_entries.is_current',true);
    for(const r of rows||[]){
      const e=r.timetable_entries; if(!e) continue;
      WEEKLY_COUNT[r.staff_id]=(WEEKLY_COUNT[r.staff_id]||0)+1;
      if(e.day_of_week===dow){
        TODAY_COUNT[r.staff_id]=(TODAY_COUNT[r.staff_id]||0)+1;
        (BUSY_BY_PERIOD[e.period_no] ??= new Set()).add(r.staff_id);
        (STAFF_BUSY_PERIODS[r.staff_id] ??= new Set()).add(e.period_no);
      }
    }
  }

  /* ترشيحات محفوظة مسبقاً لنفس التاريخ (لو أُعيد فتح الشاشة) — تُحتسب على نصاب اليوم وتحجز فترتها */
  ASSIGN_BY_ENTRY={};
  const {data:existing}=await db.from('substitute_assignments')
    .select('id,entry_id,absent_staff_id,substitute_staff_id,timetable_entries(period_no)')
    .eq('assignment_date',SUB_DATE);
  for(const a of existing||[]){
    ASSIGN_BY_ENTRY[a.entry_id]={id:a.id, absent_staff_id:a.absent_staff_id, substitute_staff_id:a.substitute_staff_id};
    TODAY_COUNT[a.substitute_staff_id]=(TODAY_COUNT[a.substitute_staff_id]||0)+1;
    const per=a.timetable_entries?.period_no;
    if(per){
      (BUSY_BY_PERIOD[per] ??= new Set()).add(a.substitute_staff_id);
      (STAFF_BUSY_PERIODS[a.substitute_staff_id] ??= new Set()).add(per);
    }
  }
}

/* ترتيب المرشَّحات لحصة معيّنة: المعلمات أولاً ثم المعلمة الأولى (فصل بخط بالقائمة)،
   وداخل كل فئة: الأقل نصاباً أسبوعياً فالأقل نصاباً اليوم فالاسم أبجدياً.
   currentSubId: المرشَّحة المختارة حالياً لهذه الحصة بالذات (لا تُستبعد بسبب انشغالها/حدّها — لأن هذه الحصة نفسها هي شغلها). */
function rankedOptions(periodNo, absentIdsSet, currentSubId){
  const busy=BUSY_BY_PERIOD[periodNo]||new Set();
  const list=CANDIDATES.filter(c=>{
    if(absentIdsSet.has(c.id)) return false;
    if(c.id!==currentSubId && busy.has(c.id)) return false;
    if((WEEKLY_COUNT[c.id]||0)>=WEEKLY_LIMIT) return false;
    if(c.id!==currentSubId && (TODAY_COUNT[c.id]||0)>=DAILY_LIMIT) return false;
    return true;
  });
  list.sort((a,b)=>
    (WEEKLY_COUNT[a.id]||0)-(WEEKLY_COUNT[b.id]||0) ||
    (TODAY_COUNT[a.id]||0)-(TODAY_COUNT[b.id]||0) ||
    a.full_name.localeCompare(b.full_name,'ar')
  );
  return list;
}

/* طول سلسلة الحصص المتتالية (بلا فاصل) لو أُسندت هذه الحصة لهذه المرشَّحة —
   نعدّ للخلف وللأمام من الحصة المطلوبة عبر حصصها المشغولة اليوم. */
function backToBackRunLength(staffId, periodNo){
  const busy=STAFF_BUSY_PERIODS[staffId];
  let run=1;
  if(busy){
    let p=periodNo-1; while(busy.has(p)){ run++; p--; }
    p=periodNo+1; while(busy.has(p)){ run++; p++; }
  }
  return run;
}
/* تحذير فقط لو الناتج ٣ حصص متتالية فأكثر — حصتان متتاليتان (بدون ثالثة)
   أمر عادي ولا تحتاج تظليلاً. */
function isBackToBack(staffId, periodNo){
  return backToBackRunLength(staffId, periodNo)>=3;
}

async function renderDay(){
  const body=$('subDayBody');
  if(!ABSENT.length){ body.innerHTML=''; return; }
  const dow=getDow(SUB_DATE);
  if(dow>5){ body.innerHTML='<div class="panel"><div class="empty-day">يوم عطلة — لا حصص.</div></div>'; return; }

  body.innerHTML='<div class="panel"><div class="empty-day">جارٍ التحميل…</div></div>';
  await loadCandidatePool(dow);

  const absentIds=ABSENT.map(a=>a.id);
  const {data:rows}=await db.from('entry_teachers')
    .select('staff_id,timetable_entries!inner(id,day_of_week,period_no,is_meeting,meeting_label,academic_year_id,is_current,sections(code),subjects(code))')
    .in('staff_id',absentIds).eq('timetable_entries.academic_year_id',S.YEAR.id)
    .eq('timetable_entries.day_of_week',dow).eq('timetable_entries.is_current',true);

  const byTeacher={};
  for(const r of rows||[]){
    const e=r.timetable_entries; if(!e) continue;
    (byTeacher[r.staff_id] ??= []).push(e);
  }
  const absentIdsSet=new Set(absentIds);

  body.innerHTML=ABSENT.map(a=>{
    const entries=(byTeacher[a.id]||[]).sort((x,y)=>x.period_no-y.period_no);
    if(!entries.length) return `<div class="panel sub-teacher-panel"><h4>تأمين جدول: ${a.full_name}</h4><div class="empty-day">لا حصص لها في هذا اليوم بحسب الجدول.</div></div>`;
    const cells=entries.map(e=>{
      const label = e.is_meeting ? (e.meeting_label||'اجتماع/دعم') : `${e.sections?.code||'—'} / ${e.subjects?.code||'—'}`;
      return `<td class="sub-cell" data-entry="${e.id}" data-period="${e.period_no}" data-absent="${a.id}">
        <b>حصة ${e.period_no}</b><small>${label}</small>
        <select class="sub-pick" data-entry="${e.id}" data-absent="${a.id}"></select>
      </td>`;
    }).join('');
    return `<div class="panel sub-teacher-panel">
      <h4>تأمين جدول: ${a.full_name}</h4>
      <div class="board-wrap"><table class="board"><tr>${cells}</tr></table></div>
    </div>`;
  }).join('');

  body.querySelectorAll('select.sub-pick').forEach(sel=>{
    const entryId=sel.dataset.entry, period=+sel.closest('.sub-cell').dataset.period, absentId=sel.dataset.absent;
    fillSelect(sel, period, absentIdsSet, entryId);
    sel.addEventListener('change', ()=>onPick(sel, period, absentIdsSet, entryId, absentId));
  });
}

function fillSelect(sel, period, absentIdsSet, entryId){
  const assigned=ASSIGN_BY_ENTRY[entryId];
  const currentSubId=assigned?.substitute_staff_id||null;
  const opts=rankedOptions(period, absentIdsSet, currentSubId);
  const optHtml=c=>{
    const warn=isBackToBack(c.id, period);
    const text=`${warn?'⚠ ':''}${c.full_name} (الأسبوع: ${WEEKLY_COUNT[c.id]||0} — اليوم: ${TODAY_COUNT[c.id]||0})`;
    return `<option value="${c.id}" ${c.id===currentSubId?'selected':''} ${warn?'style="color:#c0392b"':''}>${text}</option>`;
  };
  const teachers=opts.filter(c=>c.title==='teacher'), seniors=opts.filter(c=>c.title==='senior_teacher');
  sel.innerHTML='<option value="">— اختاري معلمة الاحتياط —</option>'+
    (teachers.length ? `<optgroup label="معلمات">${teachers.map(optHtml).join('')}</optgroup>` : '')+
    (seniors.length ? `<optgroup label="معلمة أولى">${seniors.map(optHtml).join('')}</optgroup>` : '');
  if(currentSubId && !opts.some(c=>c.id===currentSubId)){
    /* المُختارة سابقاً لم تعد ضمن المرشَّحات (وصلت حداً مثلاً) — تبقى ظاهرة كخيار محفوظ فقط */
    const cur=CANDIDATES.find(c=>c.id===currentSubId);
    if(cur) sel.insertAdjacentHTML('beforeend', `<option value="${cur.id}" selected>${cur.full_name} (مُختارة سابقاً)</option>`);
  }
  sel.classList.toggle('filled', !!currentSubId);
}

async function onPick(sel, period, absentIdsSet, entryId, absentId){
  const newSubId=sel.value;
  const prev=ASSIGN_BY_ENTRY[entryId];
  sel.disabled=true;
  try{
    if(!newSubId){
      if(prev){
        const {error}=await db.from('substitute_assignments').delete().eq('id',prev.id);
        if(error) throw error;
        TODAY_COUNT[prev.substitute_staff_id]=Math.max(0,(TODAY_COUNT[prev.substitute_staff_id]||1)-1);
        BUSY_BY_PERIOD[period]?.delete(prev.substitute_staff_id);
        STAFF_BUSY_PERIODS[prev.substitute_staff_id]?.delete(period);
        delete ASSIGN_BY_ENTRY[entryId];
        toast('تم إلغاء الترشيح');
      }
    }else{
      const {data,error}=await db.from('substitute_assignments')
        .upsert({assignment_date:SUB_DATE, entry_id:entryId, absent_staff_id:absentId, substitute_staff_id:newSubId, created_by:S.ME.id},
          {onConflict:'assignment_date,entry_id,absent_staff_id'}).select('id').single();
      if(error) throw error;
      if(prev && prev.substitute_staff_id!==newSubId){
        TODAY_COUNT[prev.substitute_staff_id]=Math.max(0,(TODAY_COUNT[prev.substitute_staff_id]||1)-1);
        BUSY_BY_PERIOD[period]?.delete(prev.substitute_staff_id);
        STAFF_BUSY_PERIODS[prev.substitute_staff_id]?.delete(period);
      }
      if(!prev || prev.substitute_staff_id!==newSubId){
        TODAY_COUNT[newSubId]=(TODAY_COUNT[newSubId]||0)+1;
        (BUSY_BY_PERIOD[period] ??= new Set()).add(newSubId);
        (STAFF_BUSY_PERIODS[newSubId] ??= new Set()).add(period);
      }
      ASSIGN_BY_ENTRY[entryId]={id:data.id, absent_staff_id:absentId, substitute_staff_id:newSubId};
      logAction('assign','substitute_assignments',{date:SUB_DATE, absent_staff_id:absentId, substitute_staff_id:newSubId, entry_id:entryId});
      toast('تم الحفظ');
    }
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{
    sel.disabled=false;
    sel.classList.toggle('filled', !!ASSIGN_BY_ENTRY[entryId]);
    /* إعادة رسم بقية الاختيارات غير المحسومة بعد — تغيّر نصاب اليوم قد يبعد/يقرّب مرشَّحات لها */
    document.querySelectorAll('#subDayBody select.sub-pick').forEach(other=>{
      if(other===sel || ASSIGN_BY_ENTRY[other.dataset.entry]) return;
      const oPeriod=+other.closest('.sub-cell').dataset.period;
      fillSelect(other, oPeriod, absentIdsSet, other.dataset.entry);
    });
  }
}

/* ============ سجل الاحتياط ============ */
async function loadLog(){
  if(!$('subLogSub').dataset.ready){
    $('subLogSub').dataset.ready='1';
    const {data}=await db.from('staff').select('id,full_name').in('title',['teacher','senior_teacher']).eq('is_active',true).order('full_name');
    $('subLogSub').innerHTML='<option value="">الكل</option>'+(data||[]).map(s=>`<option value="${s.id}">${s.full_name}</option>`).join('');
    $('subLogGo').addEventListener('click',runLog);
    $('subLogXls').addEventListener('click',exportLogXls);
    $('subLogPdf').addEventListener('click',printLog);
    const today=dstr(new Date());
    $('subLogFrom').value=today; $('subLogTo').value=today;
  }
  await runLog();
}

let LOG_ROWS=[];
async function runLog(){
  const from=$('subLogFrom').value, to=$('subLogTo').value, subId=$('subLogSub').value;
  let q=db.from('substitute_assignments')
    .select('assignment_date,absent:absent_staff_id(full_name),substitute:substitute_staff_id(full_name),timetable_entries(period_no,sections(code),subjects(code))')
    .order('assignment_date');
  if(from) q=q.gte('assignment_date',from);
  if(to) q=q.lte('assignment_date',to);
  if(subId) q=q.eq('substitute_staff_id',subId);
  const {data,error}=await q;
  if(error){ $('subLogTbl').innerHTML=`<tr><td>تعذر التحميل: ${error.message}</td></tr>`; return; }
  LOG_ROWS=(data||[]).map(r=>({
    date:r.assignment_date, absent:r.absent?.full_name||'—', sub:r.substitute?.full_name||'—',
    period:r.timetable_entries?.period_no||'—', sec:r.timetable_entries?.sections?.code||'—', subj:r.timetable_entries?.subjects?.code||'—',
  })).sort((a,b)=>a.date.localeCompare(b.date)||a.sub.localeCompare(b.sub,'ar'));

  $('subLogTbl').innerHTML = LOG_ROWS.length
    ? '<tr><th>التاريخ</th><th>معلمة الاحتياط</th><th>المعلمة الغائبة</th><th>الحصة</th><th>الشعبة</th><th>المقرر</th></tr>'+
      LOG_ROWS.map(r=>`<tr><td class="c">${r.date}</td><td>${r.sub}</td><td>${r.absent}</td><td class="c">${r.period}</td><td class="c">${r.sec}</td><td class="c">${r.subj}</td></tr>`).join('')
    : '<tr><td style="padding:16px;text-align:center;color:#8a93a0">لا سجلات ضمن هذه الفلترة.</td></tr>';

  const bySub={};
  for(const r of LOG_ROWS){ bySub[r.sub] ??= {count:0, dates:new Set()}; bySub[r.sub].count++; bySub[r.sub].dates.add(r.date); }
  const summary=Object.entries(bySub).sort(([a],[b])=>a.localeCompare(b,'ar'));
  $('subSummaryTbl').innerHTML = summary.length
    ? '<tr><th>معلمة الاحتياط</th><th>عدد الحصص</th><th>عدد الأيام</th></tr>'+
      summary.map(([name,v])=>`<tr><td>${name}</td><td class="c">${v.count}</td><td class="c">${v.dates.size}</td></tr>`).join('')
    : '<tr><td style="padding:16px;text-align:center;color:#8a93a0">لا بيانات.</td></tr>';
}

function exportLogXls(){
  if(!LOG_ROWS.length){ toast('لا بيانات للتصدير'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('سجل الاحتياط',{views:[{rightToLeft:true}]});
  const hdr=ws.addRow(['التاريخ','معلمة الاحتياط','المعلمة الغائبة','الحصة','الشعبة','المقرر']);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:'FFFFFFFF'}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1D3D5C'}}; c.alignment={horizontal:'center'}; });
  LOG_ROWS.forEach(r=>ws.addRow([r.date,r.sub,r.absent,r.period,r.sec,r.subj]).eachCell(c=>c.alignment={horizontal:'center'}));
  ws.columns=[{width:13},{width:20},{width:20},{width:9},{width:10},{width:10}];
  wb.xlsx.writeBuffer().then(buf=>{
    const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='سجل_الاحتياط.xlsx'; a.click(); URL.revokeObjectURL(url);
  });
}
function printLog(){
  if(!LOG_ROWS.length){ toast('لا بيانات للطباعة'); return; }
  $('printAreaSubs').innerHTML=`
    ${printHeaderHtml('سجل الاحتياط')}
    <table class="subs-print-tbl"><tr><th>التاريخ</th><th>معلمة الاحتياط</th><th>المعلمة الغائبة</th><th>الحصة</th><th>الشعبة</th><th>المقرر</th></tr>
    ${LOG_ROWS.map(r=>`<tr><td>${r.date}</td><td>${r.sub}</td><td>${r.absent}</td><td>${r.period}</td><td>${r.sec}</td><td>${r.subj}</td></tr>`).join('')}
    </table>`;
  printWithTitle('سجل_الاحتياط','printAreaSubs');
}

/* طباعة جدول احتياط يوم واحد (التاريخ المختار بتبويب "تأمين حصص اليوم")،
   مبوَّب بحسب كل معلمة غائبة — على غرار نموذج الورقة الأصلي. */
async function printDaily(){
  const {data,error}=await db.from('substitute_assignments')
    .select('absent:absent_staff_id(full_name),substitute:substitute_staff_id(full_name),timetable_entries(period_no,is_meeting,meeting_label,sections(code),subjects(code))')
    .eq('assignment_date',SUB_DATE);
  if(error){ toast('تعذر التحميل: '+error.message); return; }
  if(!data || !data.length){ toast('لا ترشيحات محفوظة لهذا التاريخ'); return; }

  const byAbsent={};
  for(const r of data){
    const name=r.absent?.full_name||'—';
    (byAbsent[name] ??= []).push(r);
  }
  const names=Object.keys(byAbsent).sort((a,b)=>a.localeCompare(b,'ar'));
  const body=names.map(name=>{
    const rows=byAbsent[name].sort((a,b)=>(a.timetable_entries?.period_no||0)-(b.timetable_entries?.period_no||0));
    return `<h4 style="margin:16px 0 6px;color:#1d3d5c">تأمين جدول: ${name}</h4>
      <table class="subs-print-tbl"><tr><th>الحصة</th><th>الشعبة/المقرر</th><th>معلمة الاحتياط</th></tr>
      ${rows.map(r=>{
        const e=r.timetable_entries;
        const label=e?.is_meeting ? (e.meeting_label||'اجتماع/دعم') : `${e?.sections?.code||'—'} / ${e?.subjects?.code||'—'}`;
        return `<tr><td>${e?.period_no||'—'}</td><td>${label}</td><td>${r.substitute?.full_name||'—'}</td></tr>`;
      }).join('')}
      </table>`;
  }).join('');
  $('printAreaSubs').innerHTML=printHeaderHtml(`جدول الاحتياط — ${SUB_DATE}`)+body;
  printWithTitle(`جدول_الاحتياط_${SUB_DATE}`,'printAreaSubs');
}

/* ============ للمعلمة نفسها: "حصص الاحتياط" تحت مجموعة "حصصي" ============ */
async function initMyCoverage(){
  if($('mcToday').dataset.ready) return;
  $('mcToday').dataset.ready='1';
  await loadMyCoverage();
}

async function loadMyCoverage(){
  $('mcToday').innerHTML='جارٍ التحميل…';
  $('mcHistTbl').innerHTML='';
  const {data,error}=await db.from('substitute_assignments')
    .select('assignment_date,absent:absent_staff_id(full_name),timetable_entries(period_no,is_meeting,meeting_label,sections(code),subjects(code))')
    .eq('substitute_staff_id',S.ME.id).order('assignment_date',{ascending:false});
  if(error){ $('mcToday').innerHTML=`تعذر التحميل: ${error.message}`; return; }

  const today=dstr(new Date());
  const rowOf=r=>{
    const e=r.timetable_entries;
    return {date:r.assignment_date, period:e?.period_no||'—',
      label: e?.is_meeting ? (e.meeting_label||'اجتماع/دعم') : `${e?.sections?.code||'—'} / ${e?.subjects?.code||'—'}`,
      absent:r.absent?.full_name||'—'};
  };
  const all=(data||[]).map(rowOf);
  const todays=all.filter(r=>r.date===today).sort((a,b)=>(+a.period||0)-(+b.period||0));
  const hist=all.filter(r=>r.date!==today);

  $('mcToday').innerHTML = todays.length
    ? todays.map(r=>`<div class="lesson"><b>حصة ${r.period}</b><span>${r.label}</span><small>عِوَضاً عن: ${r.absent}</small></div>`).join('')
    : '<div class="empty-day">ما عليكِ أي حصة احتياط اليوم.</div>';

  $('mcHistTbl').innerHTML = hist.length
    ? '<tr><th>التاريخ</th><th>الحصة</th><th>الشعبة/المقرر</th><th>عِوَضاً عن</th></tr>'+
      hist.map(r=>`<tr><td class="c">${r.date}</td><td class="c">${r.period}</td><td class="c">${r.label}</td><td>${r.absent}</td></tr>`).join('')
    : '<tr><td style="padding:16px;text-align:center;color:#8a93a0">لا حصص احتياط سابقة.</td></tr>';
}

registerTab({id:'subsMain', label:'الاحتياط', show:f=>f.isAdmin||f.isSubCoordinator, init:initSubs});
registerTab({id:'myCoverage', label:'حصص الاحتياط', group:'teacherArea', groupLabel:'حصصي',
  show:f=>f.isTeacher||f.isSeniorTeacher, init:initMyCoverage});
