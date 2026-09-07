/* my-schedule.js — جدولي (تحت مجموعة "حصصي")
   كل معلمة ترى جدولها الدراسي الأسبوعي تلقائياً — بلا اختيار، بلا بحث.
   الضغط على حصة اليوم الحالي يوديها مباشرة لرصد غيابها. */
import { db, $, S, AR_DAYS, dstr, toast, openTab, registerTab } from './core.js';
import { jumpToEntryToday } from './teacher.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="mySchedule" style="display:none">
  <div class="panel">
    <h3>جدولي الدراسي</h3>
    <div class="sub">اضغطي على حصة يوم اليوم (المظلَّلة) للانتقال مباشرة لرصد غيابها. حصص الاجتماع (رمادية) فيها زر تأكيد بسيط بدل رصد غياب.</div>
  </div>
  <div class="board-wrap"><table class="board" id="msTable"></table></div>
</div>
<style>
  #mySchedule.wide{max-width:1200px}
  #msTable td.empty{color:#c3c9d0}
  #msTable td.cell b{display:block;font-size:12.5px;color:var(--navy)}
  #msTable td.cell small{color:#6b7683}
  #msTable td.cell.today-cell{cursor:pointer;background:var(--gold-soft);border:1.5px solid var(--gold)}
  #msTable td.cell.today-cell:hover{background:var(--gold)}
  #msTable td.cell.today-cell:hover b, #msTable td.cell.today-cell:hover small{color:#fff}
  #msTable td.cell.meeting-cell{background:#eef1f5;border:1.5px dashed #aab4c0}
  #msTable td.cell.meeting-cell b{color:#5a6472}
  .ms-confirm-btn{margin-top:4px;font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid var(--gold);background:#fff;color:var(--navy);cursor:pointer}
  .ms-confirm-btn:hover{background:var(--gold-soft)}
  .ms-confirmed{display:block;margin-top:4px;font-size:11px;color:#2e7d4f;font-weight:600}
</style>`);

async function initMySchedule(){
  if($('msTable').dataset.ready) return;
  $('msTable').dataset.ready='1';
  await loadMySchedule();
}

async function loadMySchedule(){
  $('msTable').innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">جارٍ التحميل…</td></tr>';
  const {data:rows,error}=await db.from('entry_teachers')
    .select('timetable_entries!inner(id,day_of_week,period_no,academic_year_id,is_meeting,meeting_label,sections(code),subjects(code))')
    .eq('staff_id',S.ME.id).eq('timetable_entries.academic_year_id',S.YEAR.id);
  if(error){ $('msTable').innerHTML=`<tr><td style="padding:30px;text-align:center;color:#8a93a0">تعذر التحميل: ${error.message}</td></tr>`; return; }

  const grid={};
  const meetingEntryIds=[];
  for(const r of rows||[]){
    const e=r.timetable_entries; if(!e) continue;
    grid[e.day_of_week] ??= {};
    grid[e.day_of_week][e.period_no] = e.is_meeting
      ? {isMeeting:true, label:e.meeting_label, entryId:e.id}
      : {sec:e.sections?.code||'—', subj:e.subjects?.code||'—', entryId:e.id};
    if(e.is_meeting) meetingEntryIds.push(e.id);
  }
  if(!Object.keys(grid).length){ $('msTable').innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا جدول مسجَّل لك بعد.</td></tr>'; return; }

  const today=dstr(new Date());
  let confirmedIds=new Set();
  if(meetingEntryIds.length){
    const {data:sess}=await db.from('attendance_sessions').select('entry_id').in('entry_id',meetingEntryIds).eq('date',today);
    confirmedIds=new Set((sess||[]).map(s=>s.entry_id));
  }

  const PERIODS = S.PERIODS?.length ? S.PERIODS : [1,2,3,4,5,6,7];
  const periodNos=[...new Set([...PERIODS.map((p,i)=>i+1), ...Object.values(grid).flatMap(d=>Object.keys(d).map(Number))])].sort((a,b)=>a-b);
  const todayIdx = new Date().getDay(); // 0=الأحد … 4=الخميس (نفس ترتيب هذا الجدول)

  let html='<tr><th>الحصة</th>'+AR_DAYS.map(d=>`<th>${d}</th>`).join('')+'</tr>';
  for(const p of periodNos){
    html+=`<tr><td class="sec">${p}</td>`;
    for(let day=0; day<5; day++){
      /* day_of_week بقاعدة البيانات مرقّم من ١ (الأحد) إلى ٥ (الخميس)،
         بينما عمود الجدول هنا مفهرس من صفر — لازم +1 وإلا كل الأعمدة
         تنزاح يوماً كاملاً (حصص الأحد تظهر تحت الاثنين... وهكذا). */
      const dow=day+1;
      const cell=grid[dow]?.[p];
      const isToday = cell && !cell.isMeeting && day===todayIdx;
      if(cell?.isMeeting){
        const isTodayMeeting = day===todayIdx;
        const confirmed = confirmedIds.has(cell.entryId);
        html += `<td class="cell meeting-cell"><b>اجتماع</b><small>${cell.label}</small>${
          isTodayMeeting
            ? (confirmed ? `<span class="ms-confirmed">✓ تم التأكيد</span>` : `<button class="ms-confirm-btn" data-confirm="${cell.entryId}">تأكيد الحضور</button>`)
            : ''
        }</td>`;
      } else {
        html += cell
          ? `<td class="cell ${isToday?'today-cell':''}" ${isToday?`data-entry="${cell.entryId}"`:''}><b>${cell.sec}</b><small>${cell.subj}</small></td>`
          : `<td class="empty">—</td>`;
      }
    }
    html+='</tr>';
  }
  $('msTable').innerHTML=html;
  $('msTable').querySelectorAll('.today-cell').forEach(td=>{
    td.addEventListener('click', async ()=>{
      openTab('teacherMain');
      await jumpToEntryToday(td.dataset.entry);
    });
  });
  $('msTable').querySelectorAll('.ms-confirm-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      btn.disabled=true; btn.textContent='جارٍ الحفظ…';
      const {error}=await db.from('attendance_sessions').upsert({
        entry_id:btn.dataset.confirm, date:today, recorded_by:S.ME.id, recorded_name:S.ME.full_name,
        covers_next:false, via_link:false, updated_at:new Date().toISOString()
      },{onConflict:'entry_id,date'});
      if(error){ toast('تعذر الحفظ: '+error.message); btn.disabled=false; btn.textContent='تأكيد الحضور'; return; }
      toast('تم توثيق حضور الاجتماع');
      loadMySchedule();
    });
  });
}

registerTab({id:'mySchedule', label:'جدولي', group:'teacherArea', groupLabel:'حصصي',
  show:f=>f.isTeacher||f.isSeniorTeacher, init:initMySchedule});
