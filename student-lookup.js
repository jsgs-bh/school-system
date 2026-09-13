/* student-lookup.js — شاشتان لعرض بيانات تواصل الطالبات:
   ١) "طالباتي" (تحت حصصي) — لأي معلمة، قائمة طالبات شعبها الحالية.
   ٢) "طالبات" (لمكتب الإشراف/الإرشاد الاجتماعي) — بحث برقم أكاديمي/شخصي. */
import { db, $, S, clean, toast, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="myStudents" style="display:none">
  <div class="panel">
    <h3>طالباتي</h3>
    <div class="sub">كل طالبات الشعب اللي تدرّسينها حالياً، ببيانات تواصلهن.</div>
    <div id="msStuTbl-wrap" class="board-wrap"><table class="board" id="msStuTbl"></table></div>
  </div>
</div>

<div class="app-main" id="socStudents" style="display:none">
  <div class="panel">
    <h3>بيانات طالبة</h3>
    <div class="sub">اكتبي الرقم الأكاديمي أو الرقم الشخصي للطالبة.</div>
    <div class="row" style="display:flex;gap:10px;margin-top:10px">
      <input type="text" id="ssSearchInput" placeholder="الرقم الأكاديمي أو الرقم الشخصي…" style="flex:1;padding:10px 14px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      <button class="btn gold" id="ssSearchBtn" style="width:auto;padding:10px 24px">بحث</button>
    </div>
    <div id="ssResult" style="margin-top:18px"></div>
  </div>
</div>
<style>
  .ss-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px 20px}
  .ss-row{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}
  .ss-row:last-child{border-bottom:none}
  .ss-row b{min-width:150px;color:var(--navy)}
</style>`);

/* ============ طالباتي ============ */
async function initMyStudents(){
  if($('msStuTbl').dataset.ready) return;
  $('msStuTbl').dataset.ready='1';
  $('msStuTbl').innerHTML='<tr><td style="padding:20px;text-align:center;color:#8a93a0">جارٍ التحميل…</td></tr>';
  const {data:rows,error}=await db.from('entry_teachers')
    .select('timetable_entries!inner(section_id,is_current,sections(code))')
    .eq('staff_id',S.ME.id).eq('timetable_entries.academic_year_id',S.YEAR.id)
    .eq('timetable_entries.is_current',true).eq('timetable_entries.is_meeting',false);
  if(error){ $('msStuTbl').innerHTML=`<tr><td>تعذر التحميل: ${error.message}</td></tr>`; return; }
  const secIds=[...new Set((rows||[]).map(r=>r.timetable_entries?.section_id).filter(Boolean))];
  if(!secIds.length){ $('msStuTbl').innerHTML='<tr><td style="padding:20px;text-align:center;color:#8a93a0">ما عندك شعب مسندة حالياً.</td></tr>'; return; }
  const {data:enr,error:e2}=await db.from('enrollments').select('students(full_name,academic_number,email,contact1,contact2), sections(code)').in('section_id',secIds).is('to_date',null);
  if(e2){ $('msStuTbl').innerHTML=`<tr><td>تعذر التحميل: ${e2.message}</td></tr>`; return; }
  const list=(enr||[]).map(e=>({...e.students, section_code:e.sections?.code})).sort((a,b)=>(a.section_code||'').localeCompare(b.section_code||'','ar')||String(a.academic_number).localeCompare(String(b.academic_number),'ar',{numeric:true}));
  $('msStuTbl').innerHTML = list.length
    ? '<tr><th>الاسم</th><th>الرقم الأكاديمي</th><th>الشعبة</th><th>البريد الإلكتروني</th><th>رقم التواصل 1</th><th>رقم التواصل 2</th></tr>'+
      list.map(s=>`<tr><td>${s.full_name||''}</td><td class="c">${s.academic_number||''}</td><td class="c">${s.section_code||''}</td><td>${s.email||''}</td><td class="c">${s.contact1||''}</td><td class="c">${s.contact2||''}</td></tr>`).join('')
    : '<tr><td style="padding:20px;text-align:center;color:#8a93a0">لا طالبات.</td></tr>';
}
registerTab({id:'myStudents', label:'طالباتي', group:'teacherArea', groupLabel:'حصصي',
  show:f=>f.isTeacher||f.isSeniorTeacher, init:initMyStudents});

/* ============ بحث الإشراف/الإرشاد الاجتماعي ============ */
function initSocStudents(){
  if($('ssSearchBtn').dataset.ready) return;
  $('ssSearchBtn').dataset.ready='1';
  const run=async ()=>{
    const q=clean($('ssSearchInput').value);
    if(!q){ toast('اكتبي رقماً للبحث'); return; }
    $('ssResult').innerHTML='<div class="empty-day">جارٍ البحث…</div>';
    const {data,error}=await db.from('students').select('full_name,academic_number,personal_number,email,contact1,contact2,enrollments(section_id,to_date,sections(code))')
      .or(`academic_number.eq.${q},personal_number.eq.${q}`).limit(5);
    if(error){ $('ssResult').innerHTML=`<div class="empty-day">تعذر البحث: ${error.message}</div>`; return; }
    if(!data?.length){ $('ssResult').innerHTML='<div class="empty-day">ما فيه طالبة بهذا الرقم.</div>'; return; }
    $('ssResult').innerHTML=data.map(s=>{
      const sec=(s.enrollments||[]).find(e=>!e.to_date)?.sections?.code||'—';
      return `<div class="ss-card">
        <div class="ss-row"><b>الاسم</b><span>${s.full_name}</span></div>
        <div class="ss-row"><b>الصف</b><span>${sec}</span></div>
        <div class="ss-row"><b>الرقم الأكاديمي</b><span>${s.academic_number}</span></div>
        <div class="ss-row"><b>البريد الإلكتروني</b><span>${s.email||'—'}</span></div>
        <div class="ss-row"><b>رقم التواصل 1</b><span>${s.contact1||'—'}</span></div>
        <div class="ss-row"><b>رقم التواصل 2</b><span>${s.contact2||'—'}</span></div>
      </div>`;
    }).join('<div style="height:12px"></div>');
  };
  $('ssSearchBtn').addEventListener('click',run);
  $('ssSearchInput').addEventListener('keydown',e=>{ if(e.key==='Enter') run(); });
}
registerTab({id:'socStudents', label:'طالبات', show:f=>f.isAdmin||f.isLead||f.isSocial, init:initSocStudents});
