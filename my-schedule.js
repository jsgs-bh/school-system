/* my-schedule.js — جدولي (تحت مجموعة "حصصي")
   كل معلمة ترى جدولها الدراسي الأسبوعي تلقائياً — بلا اختيار، بلا بحث. */
import { db, $, S, AR_DAYS, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="mySchedule" style="display:none">
  <div class="panel">
    <h3>جدولي الدراسي</h3>
  </div>
  <div class="board-wrap"><table class="board" id="msTable"></table></div>
</div>
<style>
  #mySchedule.wide{max-width:1200px}
  #msTable td.empty{color:#c3c9d0}
  #msTable td.cell b{display:block;font-size:12.5px;color:var(--navy)}
  #msTable td.cell small{color:#6b7683}
</style>`);

async function initMySchedule(){
  if($('msTable').dataset.ready) return;
  $('msTable').dataset.ready='1';
  await loadMySchedule();
}

async function loadMySchedule(){
  $('msTable').innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">جارٍ التحميل…</td></tr>';
  const {data:rows,error}=await db.from('entry_teachers')
    .select('timetable_entries!inner(day_of_week,period_no,academic_year_id,sections(code),subjects(code))')
    .eq('staff_id',S.ME.id).eq('timetable_entries.academic_year_id',S.YEAR.id);
  if(error){ $('msTable').innerHTML=`<tr><td style="padding:30px;text-align:center;color:#8a93a0">تعذر التحميل: ${error.message}</td></tr>`; return; }

  const grid={};
  for(const r of rows||[]){
    const e=r.timetable_entries; if(!e) continue;
    grid[e.day_of_week] ??= {};
    grid[e.day_of_week][e.period_no] = {sec:e.sections?.code||'—', subj:e.subjects?.code||'—'};
  }
  if(!Object.keys(grid).length){ $('msTable').innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا جدول مسجَّل لك بعد.</td></tr>'; return; }

  const PERIODS = S.PERIODS?.length ? S.PERIODS : [1,2,3,4,5,6,7];
  const periodNos=[...new Set([...PERIODS.map((p,i)=>i+1), ...Object.values(grid).flatMap(d=>Object.keys(d).map(Number))])].sort((a,b)=>a-b);

  let html='<tr><th>الحصة</th>'+AR_DAYS.map(d=>`<th>${d}</th>`).join('')+'</tr>';
  for(const p of periodNos){
    html+=`<tr><td class="sec">${p}</td>`;
    for(let day=0; day<5; day++){
      const cell=grid[day]?.[p];
      html += cell
        ? `<td class="cell"><b>${cell.sec}</b><small>${cell.subj}</small></td>`
        : `<td class="empty">—</td>`;
    }
    html+='</tr>';
  }
  $('msTable').innerHTML=html;
}

registerTab({id:'mySchedule', label:'جدولي', group:'teacherArea', groupLabel:'حصصي',
  show:f=>f.isTeacher||f.isSeniorTeacher, init:initMySchedule});
