/* dept-meetings.js — حصص الاجتماع/الدعم الموحَّدة لكل معلمات قسم واحد
   (زي "اجتماع القسم" أو "دعم تعلم رقمي" أو "تطوير") — تُدرَج مباشرة
   بجدول كل معلمات القسم المختار، بدون ما ترتبط بأي شعبة طالبات. */
import { db, $, S, clean, toast, AR_DAYS, getCurrentSemester, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="deptMeetings" style="display:none">
  <div class="panel">
    <h3>إضافة حصة اجتماع/دعم لقسم كامل</h3>
    <div class="sub">تُدرج تلقائياً بجدول كل معلمات القسم المختار (النشطات) بنفس اليوم والحصة والتسمية — بدون ربط بأي شعبة.</div>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px">
      <div class="field" style="flex:1;min-width:180px"><label>القسم</label><select id="dmDept"></select></div>
      <div class="field" style="flex:1;min-width:140px"><label>اليوم</label><select id="dmDay"></select></div>
      <div class="field" style="flex:1;min-width:140px"><label>الحصة</label><select id="dmPeriod"></select></div>
      <div class="field" style="flex:1;min-width:200px"><label>التسمية</label><input type="text" id="dmLabel" placeholder="مثلاً: اجتماع القسم / دعم تعلم رقمي / تطوير"></div>
    </div>
    <button class="btn gold" id="dmAdd" style="width:auto;padding:10px 26px;margin-top:8px">➕ إضافة للقسم كامل</button>
  </div>
  <div class="panel">
    <h3>حصص الاجتماع/الدعم الحالية</h3>
    <div id="dmList"></div>
  </div>
</div>
<style>
  .dm-row{background:#fff;border:1px solid var(--line);border-radius:11px;padding:12px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
</style>`);

async function initDeptMeetings(){
  if($('dmDept').dataset.ready) return;
  $('dmDept').dataset.ready='1';

  const {data:depts}=await db.from('departments').select('id,name').order('name');
  $('dmDept').innerHTML=(depts||[]).map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
  $('dmDay').innerHTML=AR_DAYS.map((d,i)=>`<option value="${i+1}">${d}</option>`).join('');
  $('dmPeriod').innerHTML=(S.PERIODS||[]).map(p=>`<option value="${p.period_no}">الحصة ${p.period_no} (${p.start_time.slice(0,5)}–${p.end_time.slice(0,5)})</option>`).join('');

  $('dmAdd').addEventListener('click',addDeptMeeting);
  await loadList();
}

async function addDeptMeeting(){
  const deptId=$('dmDept').value, day=+$('dmDay').value, period=+$('dmPeriod').value;
  const label=clean($('dmLabel').value);
  if(!label){ toast('اكتبي تسمية الحصة'); return; }
  const {data:dept}=await db.from('departments').select('name').eq('id',deptId).single();
  const btn=$('dmAdd'); btn.disabled=true; btn.textContent='جارٍ الإضافة…';
  try{
    const {data:teachers,error:e0}=await db.from('staff').select('id,full_name').eq('department_id',deptId).eq('is_active',true);
    if(e0) throw e0;
    if(!teachers?.length){ toast('لا منتسبات نشطات بهذا القسم'); btn.disabled=false; btn.textContent='➕ إضافة للقسم كامل'; return; }

    let {data:existing}=await db.from('timetable_entries').select('id')
      .eq('academic_year_id',S.YEAR.id).eq('is_meeting',true).eq('meeting_label',label)
      .eq('day_of_week',day).eq('period_no',period).maybeSingle();
    let entryId=existing?.id;
    if(!entryId){
      const {data:ent,error:e1}=await db.from('timetable_entries').insert({
        academic_year_id:S.YEAR.id, semester:getCurrentSemester(), day_of_week:day, period_no:period,
        is_meeting:true, meeting_label:label, section_id:null,
      }).select('id').single();
      if(e1) throw e1;
      entryId=ent.id;
    }

    const {data:linked}=await db.from('entry_teachers').select('staff_id').eq('entry_id',entryId);
    const linkedIds=new Set((linked||[]).map(l=>l.staff_id));
    const newLinks=teachers.filter(t=>!linkedIds.has(t.id)).map(t=>({entry_id:entryId, staff_id:t.id, is_attendance_taker:false}));
    if(newLinks.length){
      const {error:e2}=await db.from('entry_teachers').insert(newLinks);
      if(e2) throw e2;
    }
    toast(`تمت الإضافة لـ${teachers.length} معلمة بقسم ${dept?.name||''}`);
    $('dmLabel').value='';
    loadList();
  }catch(err){ toast('تعذر الإضافة: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='➕ إضافة للقسم كامل'; }
}

async function loadList(){
  const {data,error}=await db.from('timetable_entries')
    .select('id,meeting_label,day_of_week,period_no,entry_teachers(staff_id,staff(full_name,departments(name)))')
    .eq('academic_year_id',S.YEAR.id).eq('is_meeting',true).order('day_of_week').order('period_no');
  if(error){ $('dmList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  const rows=data||[];
  $('dmList').innerHTML = rows.length ? rows.map(r=>{
    const teacherNames=(r.entry_teachers||[]).map(e=>e.staff?.full_name).filter(Boolean);
    const deptName=r.entry_teachers?.[0]?.staff?.departments?.name||'—';
    return `<div class="dm-row">
      <div>
        <b>${r.meeting_label}</b> — ${AR_DAYS[r.day_of_week-1]||''}، الحصة ${r.period_no}
        <small style="display:block;color:#8a93a0;margin-top:2px">${deptName} — ${teacherNames.length} معلمة${teacherNames.length?': '+teacherNames.join('، '):''}</small>
      </div>
      <button class="btn ghost dm-del" data-id="${r.id}" style="width:auto;padding:7px 16px;font-size:12.5px;color:var(--err);border-color:var(--err)">🗑️ حذف</button>
    </div>`;
  }).join('') : '<div class="empty-day">لا حصص اجتماع/دعم مضافة بعد.</div>';

  $('dmList').querySelectorAll('.dm-del').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('حذف هذه الحصة من جدول كل المعلمات المرتبطات بها؟')) return;
    await db.from('entry_teachers').delete().eq('entry_id',b.dataset.id);
    const {error}=await db.from('timetable_entries').delete().eq('id',b.dataset.id);
    if(error){ toast('تعذر الحذف: '+error.message); return; }
    toast('تم الحذف'); loadList();
  }));
}

registerTab({id:'deptMeetings', label:'حصص الاجتماع والدعم', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initDeptMeetings});
