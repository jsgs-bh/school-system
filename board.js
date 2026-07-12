/* board.js — متابعة الرصد (شعبة × حصة) + الغياب الرسمي اليومي المحسوب */
import { db, $, S, AR_DAYS, dstr, chunk, registerTab } from './core.js';

let BOARD_DATE=new Date();
function initBoardPick(){
  const bp=$('boardPick');
  if(bp.dataset.ready) return;
  bp.dataset.ready='1';
  bp.value=dstr(BOARD_DATE); bp.max=dstr(new Date());
  bp.addEventListener('change',()=>{ if(bp.value){ BOARD_DATE=new Date(bp.value+'T12:00:00'); loadBoard(); } });
}

async function loadBoard(){
  initBoardPick();
  const d=BOARD_DATE, jsDay=d.getDay();
  $('boardTitle').textContent='متابعة الرصد — '+(jsDay<=4?AR_DAYS[jsDay]+' ':'')+dstr(d);
  const tbl=$('boardTable');
  if(jsDay>4){ tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">يوم عطلة.</td></tr>';
    $('bPresent').textContent=$('bAbsent').textContent=$('bRate').textContent=$('bMissing').textContent=$('bCovered').textContent='—'; return; }
  tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">جارٍ التحميل…</td></tr>';
  const dow=jsDay+1;
  const [{data:ents},{data:sess},{data:enr},{data:late},{data:exc}] = await Promise.all([
    db.from('timetable_entries')
      .select('id,period_no,section_id,sections(code),entry_teachers(is_attendance_taker,staff(full_name))')
      .eq('academic_year_id',S.YEAR.id).eq('day_of_week',dow),
    db.from('attendance_sessions').select('id,entry_id,recorded_by,recorded_name,staff(full_name)').eq('date',dstr(d)),
    db.from('enrollments').select('section_id').is('to_date',null),
    db.from('late_log').select('student_id').eq('date',dstr(d)),
    db.from('excuse_log').select('student_id').eq('date',dstr(d)),
  ]);
  /* الطالبات اللواتي لهن تأخير أو استئذان في هذا اليوم — يُستبعدن من الغياب الرسمي */
  const covered=new Set([...(late||[]),...(exc||[])].map(r=>r.student_id));

  const sessBy={}; for(const s of sess||[]) sessBy[s.entry_id]=s;
  const p1Sess=new Set((ents||[]).filter(e=>e.period_no===1&&sessBy[e.id]).map(e=>sessBy[e.id].id));
  const sessIds=(sess||[]).map(s=>s.id);
  const absBySess={};            /* غياب كل حصة كما رصدته المعلمة (حقيقة تاريخية لا تُمس) */
  let officialAbs=0;             /* الغياب الرسمي اليومي: غائبات الحصة ١ ناقص التأخير/الاستئذان */
  for(const c of chunk(sessIds,200)){
    const {data:recs}=await db.from('attendance_records').select('session_id,student_id,status').in('session_id',c);
    for(const r of recs||[]){
      if(r.status!=='absent') continue;
      absBySess[r.session_id]=(absBySess[r.session_id]||0)+1;
      if(p1Sess.has(r.session_id) && !covered.has(r.student_id)) officialAbs++;
    }
  }
  const enrolled={}; for(const e of enr||[]) enrolled[e.section_id]=(enrolled[e.section_id]||0)+1;
  const secMap={};
  for(const e of ents||[]){
    const code=e.sections?.code||'؟';
    secMap[code] ??= {section_id:e.section_id, periods:{}};
    const takers=(e.entry_teachers||[]).filter(t=>t.is_attendance_taker).map(t=>t.staff?.full_name).filter(Boolean);
    const all=(e.entry_teachers||[]).map(t=>t.staff?.full_name).filter(Boolean);
    secMap[code].periods[e.period_no]={expected:(takers.length?takers:all).join(' / ')||'—', session:sessBy[e.id]};
  }
  const codes=Object.keys(secMap).sort((a,b)=>a.localeCompare(b,'ar'));
  if(!codes.length){ tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا حصص في هذا اليوم بحسب الجدول.</td></tr>'; return; }
  let p1Enr=0,p1Missing=0;
  let html='<tr><th>الشعبة</th>'+[1,2,3,4,5,6,7].map(p=>`<th>ح${p}</th>`).join('')+'</tr>';
  for(const code of codes){
    const row=secMap[code];
    html+=`<tr><td class="sec">${code}</td>`;
    for(let p=1;p<=7;p++){
      const cell=row.periods[p];
      if(!cell){ html+='<td><span class="cell-dash">—</span></td>'; continue; }
      if(cell.session){
        const who=cell.session.staff?.full_name||cell.session.recorded_name||'✓';
        const abs=absBySess[cell.session.id]||0;
        html+=`<td><div class="cell-ok">✓ ${who.split(' ').slice(0,2).join(' ')}<small>غياب: ${abs}</small></div></td>`;
        if(p===1) p1Enr+=enrolled[row.section_id]||0;
      }else{
        html+=`<td><div class="cell-no">لم يُرصد<small>${cell.expected.split(' ').slice(0,3).join(' ')}</small></div></td>`;
        if(p===1) p1Missing++;
      }
    }
    html+='</tr>';
  }
  tbl.innerHTML=html;
  const present=Math.max(0,p1Enr-officialAbs);
  $('bPresent').textContent=p1Enr?present:'—';
  $('bAbsent').textContent=p1Enr?officialAbs:'—';
  $('bCovered').textContent=covered.size;
  $('bRate').textContent=p1Enr?((present/p1Enr*100).toFixed(1)+'%'):'—';
  $('bMissing').textContent=p1Missing;
}

registerTab({id:'boardMain', label:'متابعة الرصد',
  show:f=>f.isAdmin||f.isLead||f.isSocial||f.isReg, onOpen:loadBoard});
