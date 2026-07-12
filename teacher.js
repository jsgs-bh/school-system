/* teacher.js — شاشة المعلمة: حصص اليوم والرصد */
import { db, $, S, AR_DAYS, PERIOD_NAMES, dstr, toast, chunk, registerTab } from './core.js';

let CUR_DATE = new Date(), MY_LESSONS=[];

function currentPeriodNo(){
  if(dstr(CUR_DATE)!==dstr(new Date())) return null;
  const now = new Date().toTimeString().slice(0,5);
  for(const p of S.PERIODS) if(now>=p.start_time.slice(0,5) && now<p.end_time.slice(0,5)) return p.period_no;
  return null;
}

function initTeacher(){
  const dp=$('dayPick');
  dp.value=dstr(CUR_DATE); dp.max=dstr(new Date());
  dp.addEventListener('change',()=>{ if(dp.value){ CUR_DATE=new Date(dp.value+'T12:00:00'); loadDay(); } });
  $('otherBtn').addEventListener('click',async ()=>{
    const box=$('otherBox');
    box.style.display = box.style.display==='block'?'none':'block';
    if(box.style.display==='block' && $('otherSec').options.length<=1){
      const {data:secs}=await db.from('sections').select('id,code').eq('academic_year_id',S.YEAR.id).order('code');
      for(const s of secs||[]) $('otherSec').insertAdjacentHTML('beforeend',`<option value="${s.id}">${s.code}</option>`);
    }
  });
  $('otherSec').addEventListener('change', async ()=>{
    const sel=$('otherPer'); sel.innerHTML='<option value="">الحصة…</option>';
    const dow=CUR_DATE.getDay()+1;
    const {data:ents}=await db.from('timetable_entries')
      .select('id,period_no,subjects(code)').eq('section_id',$('otherSec').value).eq('day_of_week',dow).order('period_no');
    for(const e of ents||[]) sel.insertAdjacentHTML('beforeend',`<option value="${e.id}">الحصة ${PERIOD_NAMES[e.period_no]} — ${e.subjects?.code||''}</option>`);
    if(!(ents||[]).length) sel.insertAdjacentHTML('beforeend','<option value="">لا حصص لهذه الشعبة في هذا اليوم</option>');
  });
  $('otherGo').addEventListener('click',()=>{
    const eid=$('otherPer').value;
    if(!eid){ toast('اختاري الشعبة والحصة'); return; }
    openRoster({entry_id:eid, section_code:$('otherSec').selectedOptions[0].textContent,
      subj:'', period_no:null, label:$('otherPer').selectedOptions[0].textContent, isMine:false});
  });
  $('rosterBack').addEventListener('click',()=>{ $('rosterView').style.display='none'; $('dayView').style.display='block'; loadDay(); });
  loadDay();
}

async function loadDay(){
  const list=$('lessonList');
  const d=CUR_DATE, jsDay=d.getDay();
  const isToday = dstr(d)===dstr(new Date());
  $('dayTitle').textContent = (isToday?'حصص اليوم — ':'') + (jsDay<=4?AR_DAYS[jsDay]:'') + ' ' + dstr(d);
  if(jsDay>4){ list.innerHTML='<div class="empty-day">يوم عطلة — لا حصص.</div>'; return; }
  const dow=jsDay+1;
  list.innerHTML='<div class="empty-day">جارٍ التحميل…</div>';
  const {data:rows,error}=await db.from('entry_teachers')
    .select('is_attendance_taker, timetable_entries!inner(id,period_no,room,section_id,day_of_week,academic_year_id,sections(code),subjects(code))')
    .eq('staff_id',S.ME.id).eq('timetable_entries.day_of_week',dow).eq('timetable_entries.academic_year_id',S.YEAR.id);
  if(error){ list.innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  MY_LESSONS=(rows||[]).map(r=>({
    entry_id:r.timetable_entries.id, period_no:r.timetable_entries.period_no,
    section_id:r.timetable_entries.section_id, section_code:r.timetable_entries.sections?.code||'—',
    subj:r.timetable_entries.subjects?.code||'', room:r.timetable_entries.room||'',
    taker:r.is_attendance_taker
  })).sort((a,b)=>a.period_no-b.period_no);
  if(!MY_LESSONS.length){ list.innerHTML='<div class="empty-day">لا حصص لك في هذا اليوم بحسب الجدول.</div>'; return; }
  const ids=MY_LESSONS.map(l=>l.entry_id);
  const {data:sess}=await db.from('attendance_sessions')
    .select('entry_id,recorded_by,recorded_name,staff(full_name)').in('entry_id',ids).eq('date',dstr(d));
  const sBy={}; for(const s of sess||[]) sBy[s.entry_id]=s;
  const nowP=currentPeriodNo();
  list.innerHTML=MY_LESSONS.map(l=>{
    const s=sBy[l.entry_id];
    const p=S.PERIODS.find(x=>x.period_no===l.period_no);
    const time=p?`${p.start_time.slice(0,5)} – ${p.end_time.slice(0,5)}`:'';
    const who=s? (s.staff?.full_name||s.recorded_name||'') : '';
    return `<div class="lesson ${l.period_no===nowP?'now':''}" data-eid="${l.entry_id}">
      <div class="pno"><b>${l.period_no}</b><span>حصة</span></div>
      <div class="info"><b>${l.section_code} — ${l.subj}${l.period_no===nowP?'<span class="now-chip">الآن</span>':''}</b>
      <span>${time}${l.room?' · '+l.room:''}${who&&s.recorded_by!==S.ME.id?' · رصدتها: '+who:''}</span></div>
      <div class="st ${s?'done':'pending'}">${s?'مرصودة ✓':'لم تُرصد'}</div>
    </div>`;
  }).join('');
  list.querySelectorAll('.lesson').forEach(el=>{
    el.addEventListener('click',()=>{
      const l=MY_LESSONS.find(x=>x.entry_id===el.dataset.eid);
      openRoster({...l, label:'الحصة '+PERIOD_NAMES[l.period_no], isMine:true});
    });
  });
}

let ROSTER={entry:null,students:[],absent:new Set(),nextEntry:null};
async function openRoster(lesson){
  $('dayView').style.display='none'; $('rosterView').style.display='block';
  $('rosterTitle').textContent=`${lesson.section_code} ${lesson.subj?'— '+lesson.subj:''}`;
  $('rosterSub').textContent=`${lesson.label} · ${AR_DAYS[CUR_DATE.getDay()]||''} ${dstr(CUR_DATE)}`;
  $('stuGrid').innerHTML='<div style="grid-column:1/-1;text-align:center;color:#8a93a0;padding:20px">جارٍ تحميل الطالبات…</div>';
  $('coversBox').style.display='none'; $('recordedBy').style.display='none';
  ROSTER={entry:lesson,students:[],absent:new Set(),nextEntry:null};
  const {data:ent}=await db.from('timetable_entries')
    .select('id,period_no,section_id,sections(code),subjects(code)').eq('id',lesson.entry_id).single();
  ROSTER.entry={...lesson, period_no:ent.period_no, section_id:ent.section_id,
    section_code:ent.sections?.code||lesson.section_code, subj:ent.subjects?.code||lesson.subj};
  $('rosterTitle').textContent=`${ROSTER.entry.section_code} — ${ROSTER.entry.subj}`;
  if(lesson.isMine){
    const nxt=MY_LESSONS.find(x=>x.section_id===ent.section_id && x.period_no===ent.period_no+1);
    if(nxt){ ROSTER.nextEntry=nxt;
      $('coversLbl').textContent=`الرصد يشمل الحصة ${PERIOD_NAMES[nxt.period_no]} أيضاً (نفس الشعبة)`;
      $('coversBox').style.display='flex'; $('coversChk').checked=false; }
  }
  const {data:enr,error}=await db.from('enrollments')
    .select('students(id,full_name,academic_number,special_case)')
    .eq('section_id',ent.section_id).is('to_date',null);
  if(error){ $('stuGrid').innerHTML=`<div style="grid-column:1/-1;color:var(--err)">تعذر التحميل: ${error.message}</div>`; return; }
  ROSTER.students=(enr||[]).map(e=>e.students).filter(Boolean)
    .sort((a,b)=>a.full_name.localeCompare(b.full_name,'ar'));
  const {data:sess}=await db.from('attendance_sessions')
    .select('id,recorded_by,recorded_name,staff(full_name)')
    .eq('entry_id',lesson.entry_id).eq('date',dstr(CUR_DATE)).maybeSingle();
  if(sess){
    const {data:recs}=await db.from('attendance_records').select('student_id,status').eq('session_id',sess.id);
    for(const r of recs||[]) if(r.status==='absent') ROSTER.absent.add(r.student_id);
    const who=sess.staff?.full_name||sess.recorded_name;
    if(who && sess.recorded_by!==S.ME.id){
      $('recordedBy').textContent=`رُصدت سابقاً بواسطة: ${who} — أي تعديل تحفظينه سيُوثق باسمك.`;
      $('recordedBy').style.display='block';
    }
  }
  renderStudents();
}
function renderStudents(){
  const g=$('stuGrid');
  g.innerHTML=ROSTER.students.map(s=>`
    <div class="stu ${ROSTER.absent.has(s.id)?'absent':''} ${s.special_case?'special':''}" data-id="${s.id}">
      ${s.full_name}<small>${s.academic_number}</small></div>`).join('');
  g.querySelectorAll('.stu').forEach(el=>{
    el.addEventListener('click',()=>{
      const id=el.dataset.id;
      ROSTER.absent.has(id)?ROSTER.absent.delete(id):ROSTER.absent.add(id);
      el.classList.toggle('absent'); updateCount();
    });
  });
  updateCount();
}
function updateCount(){ $('absCount').textContent=ROSTER.absent.size; $('totCount').textContent=ROSTER.students.length; }
$('allAbsent').addEventListener('click',()=>{ ROSTER.students.forEach(s=>ROSTER.absent.add(s.id)); renderStudents(); });
$('allPresent').addEventListener('click',()=>{ ROSTER.absent.clear(); renderStudents(); });

async function saveSession(entryId, coversNext){
  const {data:sess,error}=await db.from('attendance_sessions')
    .upsert({entry_id:entryId, date:dstr(CUR_DATE), recorded_by:S.ME.id, covers_next:coversNext,
             via_link:false, updated_at:new Date().toISOString()},{onConflict:'entry_id,date'})
    .select('id').single();
  if(error) throw error;
  const {error:eDel}=await db.from('attendance_records').delete().eq('session_id',sess.id);
  if(eDel) throw eDel;
  const recs=[...ROSTER.absent].map(sid=>({session_id:sess.id, student_id:sid, status:'absent'}));
  for(const c of chunk(recs,300)){ const{error:eIns}=await db.from('attendance_records').insert(c); if(eIns) throw eIns; }
}
$('saveAtt').addEventListener('click', async ()=>{
  const btn=$('saveAtt'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    const covers=$('coversChk').checked && ROSTER.nextEntry;
    await saveSession(ROSTER.entry.entry_id, !!covers);
    if(covers) await saveSession(ROSTER.nextEntry.entry_id, false);
    await db.from('audit_log').insert({actor_id:S.ME.id, action:'attendance', entity:'attendance_sessions',
      details:{section:ROSTER.entry.section_code, period:ROSTER.entry.period_no, date:dstr(CUR_DATE),
               absent:ROSTER.absent.size, covers_next:!!covers}});
    toast(`تم حفظ الرصد — ${ROSTER.absent.size} غائبة${covers?' (لحصتين)':''}`);
    $('rosterView').style.display='none'; $('dayView').style.display='block'; loadDay();
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ الرصد'; }
});

registerTab({id:'teacherMain', label:'رصد الغياب', group:'teacherArea', groupLabel:'حصصي',
  show:f=>f.isTeacher, init:initTeacher});
