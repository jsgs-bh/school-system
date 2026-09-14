/* student-lookup.js — شاشتان لعرض بيانات تواصل الطالبات:
   ١) "طالباتي" (تحت حصصي) — لأي معلمة، قائمة طالبات شعبها الحالية.
   ٢) "طالبات" (لمكتب الإشراف/الإرشاد الاجتماعي) — بحث برقم أكاديمي/شخصي. */
import { db, $, S, clean, toast, registerTab } from './core.js';
console.log('%c✅ student-lookup.js تحمّل بنجاح', 'background:#0a0;color:#fff;font-size:16px;padding:6px');

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
    <div class="sub" id="ssDebugSub">اكتبي اسم الطالبة أو رقمها الأكاديمي أو الشخصي. <b style="color:#c00">[تشخيص: لسا الشاشة ما جهزت]</b></div>
    <div class="row" style="display:flex;gap:10px;margin-top:10px;position:relative">
      <input type="text" id="ssSearchInput" placeholder="اسم الطالبة أو رقمها…" autocomplete="off" style="flex:1;padding:10px 14px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      <div class="sugg" id="ssSugg"></div>
    </div>
    <div id="ssResult" style="margin-top:18px"></div>
  </div>
</div>
<style>
  .ss-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px 20px}
  .ss-row{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}
  .ss-row:last-child{border-bottom:none}
  .ss-row b{min-width:150px;color:var(--navy)}
  #socStudents .sugg, #myStudents .sugg{
    position:absolute; top:100%; right:0; left:0; z-index:50; margin-top:4px;
    background:#fff; border:1.5px solid var(--line); border-radius:10px;
    box-shadow:0 6px 18px rgba(0,0,0,.12); max-height:280px; overflow-y:auto;
  }
  #socStudents .sugg:empty, #myStudents .sugg:empty{ display:none; }
  #socStudents .sugg .opt, #myStudents .sugg .opt{
    padding:10px 14px; cursor:pointer; border-bottom:1px solid var(--line); font-size:13.5px;
  }
  #socStudents .sugg .opt:last-child, #myStudents .sugg .opt:last-child{ border-bottom:none; }
  #socStudents .sugg .opt:hover, #myStudents .sugg .opt:hover{ background:var(--sand); }
  #socStudents .sugg .opt small{ display:block; color:#8a93a0; font-size:11.5px; margin-top:2px; }
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
function showStudentCard(s){
  const sec=(s.enrollments||[]).find(e=>!e.to_date)?.sections?.code||'—';
  $('ssResult').innerHTML=`<div class="ss-card">
    <div class="ss-row"><b>الاسم</b><span>${s.full_name}</span></div>
    <div class="ss-row"><b>الصف</b><span>${sec}</span></div>
    <div class="ss-row"><b>الرقم الأكاديمي</b><span>${s.academic_number}</span></div>
    <div class="ss-row"><b>البريد الإلكتروني</b><span>${s.email||'—'}</span></div>
    <div class="ss-row"><b>رقم التواصل 1</b><span>${s.contact1||'—'}</span></div>
    <div class="ss-row"><b>رقم التواصل 2</b><span>${s.contact2||'—'}</span></div>
  </div>`;
}

let SS_RESULTS=[];
function initSocStudents(){
  if($('ssSearchInput').dataset.ready) return;
  $('ssSearchInput').dataset.ready='1';
  $('ssDebugSub').innerHTML='اكتبي اسم الطالبة أو رقمها الأكاديمي أو الشخصي. <b style="color:#080">[تشخيص: الشاشة جاهزة ✅]</b>';
  let searchTimer=null;
  $('ssSearchInput').addEventListener('input',()=>{
    $('ssDebugSub').innerHTML='اكتبي اسم الطالبة أو رقمها الأكاديمي أو الشخصي. <b style="color:#08c">[تشخيص: استلمت كتابتك ✅ — جارٍ البحث...]</b>';
    clearTimeout(searchTimer);
    const q=clean($('ssSearchInput').value);
    if(q.length<2){ $('ssSugg').innerHTML=''; return; }
    searchTimer=setTimeout(async ()=>{
      const timeoutMs=8000;
      const queryPromise=db.from('students')
        .select('id,full_name,academic_number,personal_number,email,contact1,contact2,enrollments(section_id,to_date,sections(code))')
        .or(`full_name.ilike.%${q}%,academic_number.eq.${q},personal_number.eq.${q}`).limit(8);
      let data,error;
      try{
        const res=await Promise.race([
          queryPromise,
          new Promise((_,rej)=>setTimeout(()=>rej(new Error('انتهت مهلة الاتصال (8 ثواني) — يمكن برنامج حماية بجهازك (زي Kaspersky) يعطّل الاتصال. جربي جهاز/شبكة ثانية.')),timeoutMs))
        ]);
        data=res.data; error=res.error;
      }catch(timeoutErr){
        $('ssSugg').innerHTML=`<div class="opt" style="color:var(--err)">${timeoutErr.message}</div>`;
        return;
      }
      if(error){ $('ssSugg').innerHTML=`<div class="opt" style="color:var(--err)">تعذر البحث: ${error.message}</div>`; return; }
      SS_RESULTS=data||[];
      $('ssSugg').innerHTML = SS_RESULTS.length ? SS_RESULTS.map(s=>{
        const sec=(s.enrollments||[]).find(e=>!e.to_date)?.sections?.code||'';
        return `<div class="opt" data-id="${s.id}">${s.full_name}<small>${s.academic_number} — ${sec}</small></div>`;
      }).join('') : `<div class="opt" style="color:#8a93a0">لا نتائج لـ"${q}"</div>`;
      $('ssSugg').querySelectorAll('.opt').forEach(el=>el.addEventListener('click',()=>{
        const stu=SS_RESULTS.find(s=>s.id===el.dataset.id);
        if(stu) showStudentCard(stu);
        $('ssSearchInput').value=stu?.full_name||''; $('ssSugg').innerHTML='';
      }));
    },250);
  });
}
registerTab({id:'socStudents', label:'طالبات', show:f=>f.isSocial||f.isAcademicGuidance, init:initSocStudents});
