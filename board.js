/* board.js — متابعة الرصد (شعبة × حصة) + الغياب الرسمي اليومي المحسوب
   إضافة جديدة: الضغط على عدد الغياب في أي خلية يعرض أسماء الغائبات،
   وزر "طباعة تفاصيل اليوم" يبني تقريراً مطبوعاً بكل الحصص — لكل حصة
   جدول بكل الغائبات في كل الشعب (اسم، رقم أكاديمي، شعبة) — لاستخدام
   مكتب التسجيل عند إعادة رصد كل حصة يدوياً إن احتاج. */
import { db, $, S, AR_DAYS, dstr, chunk, toast, printWithTitle, registerTab } from './core.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';

/* ============ حقن عناصر إضافية داخل تبويب متابعة الرصد الموجود ============ */
if(!$('boardDetailPanel')){
  $('boardTable').closest('.board-wrap').insertAdjacentHTML('afterend', `
    <div class="panel" id="boardDetailPanel" style="display:none">
      <h3 id="boardDetailTitle">تفاصيل الغياب</h3>
      <div id="boardDetailList"></div>
    </div>
    <button class="btn ghost" id="boardXlsDay" style="width:auto;padding:11px 26px;margin-top:14px">⬇ إكسل — تفاصيل اليوم (كل الحصص)</button>
    <button class="btn ghost" id="boardPrintDay" style="width:auto;padding:11px 26px;margin-top:14px">⬇ PDF — تفاصيل اليوم (كل الحصص)</button>
    <div id="printAreaBoard"></div>
  `);
}
if(!document.getElementById('boardExtraStyle')){
  const st=document.createElement('style'); st.id='boardExtraStyle';
  st.textContent=`
    .cell-ok small.clickable{cursor:pointer;text-decoration:underline;text-decoration-style:dotted}
    .cell-ok small.clickable:hover{color:var(--navy)}
    .detail-row{display:flex;justify-content:space-between;align-items:center;background:var(--sand);border-radius:9px;padding:9px 13px;margin-bottom:6px;font-size:13px}
    #printAreaBoard{display:none}
    @media print{
      body *{visibility:hidden}
      #printAreaBoard, #printAreaBoard *{visibility:visible}
      #printAreaBoard{display:block;position:absolute;inset-inline-start:0;top:0;width:100%}
      .pb-page{page-break-after:always;padding:6px}
      .pb-page:last-child{page-break-after:auto}
      .pb-head{text-align:center;margin-bottom:12px}
      .pb-head h2{font-size:14px;color:#1d3d5c;font-weight:600;margin-bottom:6px}
      .pb-head p{font-size:11.5px;color:#333}
      .pb-tbl{width:100%;border-collapse:collapse;font-size:10.5px}
      .pb-tbl th{background:#1d3d5c;color:#fff;padding:5px;border:1px solid #1d3d5c}
      .pb-tbl td{padding:4px;border:1px solid #ccc;text-align:right}
      .pb-tbl td.c{text-align:center}
      .pb-footer{position:fixed;bottom:6px;left:0;right:0;text-align:center;font-size:9.5px;color:#555;border-top:1px solid #ccc;padding-top:4px;font-family:'Amiri',serif}
    }`;
  document.head.appendChild(st);
}

let BOARD_DATE=new Date();
let ABS_BY_SESS={}, STU_NAMES={}, SEC_CODE_OF_SESS={}, PERIOD_OF_SESS={};

function initBoardPick(){
  const bp=$('boardPick');
  if(bp.dataset.ready) return;
  bp.dataset.ready='1';
  bp.value=dstr(BOARD_DATE); bp.max=dstr(new Date());
  bp.addEventListener('change',()=>{ if(bp.value){ BOARD_DATE=new Date(bp.value+'T12:00:00'); loadBoard(); } });
  $('boardXlsDay').addEventListener('click',exportDayXls);
  $('boardPrintDay').addEventListener('click',printDay);
}

async function loadBoard(){
  initBoardPick();
  $('boardDetailPanel').style.display='none';
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
  /* الطالبات اللواتي لهن تأخير أو استئذان في هذا اليوم — يُستبعدن من الغياب الرسمي (لا من غياب الحصص نفسها) */
  const covered=new Set([...(late||[]),...(exc||[])].map(r=>r.student_id));

  const sessBy={}; for(const s of sess||[]) sessBy[s.entry_id]=s;
  const p1Sess=new Set((ents||[]).filter(e=>e.period_no===1&&sessBy[e.id]).map(e=>sessBy[e.id].id));
  const sessIds=(sess||[]).map(s=>s.id);

  ABS_BY_SESS={}; SEC_CODE_OF_SESS={}; PERIOD_OF_SESS={};
  const entInfo={}; for(const e of ents||[]) entInfo[e.id]={code:e.sections?.code||'؟', period:e.period_no};
  for(const s of sess||[]){ const ei=entInfo[s.entry_id]||{}; SEC_CODE_OF_SESS[s.id]=ei.code; PERIOD_OF_SESS[s.id]=ei.period; }

  let officialAbs=0;
  const allAbsSids=new Set();
  for(const c of chunk(sessIds,200)){
    const {data:recs}=await db.from('attendance_records').select('session_id,student_id,status').in('session_id',c);
    for(const r of recs||[]){
      if(r.status!=='absent') continue;
      (ABS_BY_SESS[r.session_id] ??= []).push(r.student_id);
      allAbsSids.add(r.student_id);
      if(p1Sess.has(r.session_id) && !covered.has(r.student_id)) officialAbs++;
    }
  }
  STU_NAMES={};
  for(const c of chunk([...allAbsSids],200)){
    const {data:st}=await db.from('students').select('id,full_name,academic_number').in('id',c);
    for(const s of st||[]) STU_NAMES[s.id]=s;
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
  const totalByPeriod={1:0,2:0,3:0,4:0,5:0,6:0,7:0};
  let html='<tr><th>الشعبة</th>'+[1,2,3,4,5,6,7].map(p=>`<th>ح${p}</th>`).join('')+'</tr>';
  for(const code of codes){
    const row=secMap[code];
    html+=`<tr><td class="sec">${code}</td>`;
    for(let p=1;p<=7;p++){
      const cell=row.periods[p];
      if(!cell){ html+='<td><span class="cell-dash">—</span></td>'; continue; }
      if(cell.session){
        const who=cell.session.staff?.full_name||cell.session.recorded_name||'✓';
        const abs=ABS_BY_SESS[cell.session.id]||[];
        totalByPeriod[p]+=abs.length;
        const countHtml = abs.length
          ? `<small class="clickable" data-sess="${cell.session.id}">غياب: ${abs.length}</small>`
          : `<small>غياب: 0</small>`;
        html+=`<td><div class="cell-ok">✓ ${who.split(' ').slice(0,2).join(' ')}${countHtml}</div></td>`;
        if(p===1) p1Enr+=enrolled[row.section_id]||0;
      }else{
        html+=`<td><div class="cell-no">لم يُرصد<small>${cell.expected.split(' ').slice(0,3).join(' ')}</small></div></td>`;
        if(p===1) p1Missing++;
      }
    }
    html+='</tr>';
  }
  html+='<tr><td class="sec">الإجمالي</td>'+[1,2,3,4,5,6,7].map(p=>
    `<td class="c"><b>${totalByPeriod[p]||'—'}</b></td>`).join('')+'</tr>';
  tbl.innerHTML=html;
  tbl.querySelectorAll('small.clickable').forEach(el=>{
    el.addEventListener('click',()=>showDetail(el.dataset.sess));
  });

  const present=Math.max(0,p1Enr-officialAbs);
  $('bPresent').textContent=p1Enr?present:'—';
  $('bAbsent').textContent=p1Enr?officialAbs:'—';
  $('bCovered').textContent=covered.size;
  $('bRate').textContent=p1Enr?((present/p1Enr*100).toFixed(1)+'%'):'—';
  $('bMissing').textContent=p1Missing;
}

function showDetail(sessId){
  const ids=ABS_BY_SESS[sessId]||[];
  const code=SEC_CODE_OF_SESS[sessId]||'—', per=PERIOD_OF_SESS[sessId]||'—';
  $('boardDetailTitle').textContent=`غائبات الشعبة ${code} — الحصة ${per} (${ids.length})`;
  $('boardDetailList').innerHTML = ids.length
    ? ids.map(id=>{ const s=STU_NAMES[id]||{}; return `<div class="detail-row"><span>${s.full_name||'—'}</span><small>${s.academic_number||''}</small></div>`; }).join('')
    : '<div class="empty-day">لا غائبات.</div>';
  $('boardDetailPanel').style.display='block';
  $('boardDetailPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
}

/* ============ تصدير تفاصيل اليوم (يشترك بينه PDF وإكسل) ============ */
function collectDayPeriods(){
  const perPeriod={};
  for(const [sessId,ids] of Object.entries(ABS_BY_SESS)){
    if(!ids.length) continue;
    const per=PERIOD_OF_SESS[sessId], code=SEC_CODE_OF_SESS[sessId];
    (perPeriod[per] ??= []).push(...ids.map(id=>({...(STU_NAMES[id]||{}), sec:code})));
  }
  for(const p of Object.keys(perPeriod)){
    perPeriod[p].sort((a,b)=>(a.sec||'').localeCompare(b.sec||'','ar')||(a.full_name||'').localeCompare(b.full_name||'','ar'));
  }
  return perPeriod;
}

const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const xlsBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function exportDayXls(){
  const perPeriod=collectDayPeriods();
  const periods=Object.keys(perPeriod).map(Number).sort((a,b)=>a-b);
  if(!periods.length){ toast('لا غياب مسجل في هذا اليوم'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('تفاصيل اليوم',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,4);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle(`تفاصيل الغياب — ${AR_DAYS[BOARD_DATE.getDay()]||''} ${dstr(BOARD_DATE)}`,12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['الحصة','الشعبة','الرقم الأكاديمي','اسم الطالبة']);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=xlsBorder; });
  let i=0;
  for(const p of periods){
    for(const s of perPeriod[p]){
      const row=ws.addRow([p, s.sec||'', s.academic_number||'', s.full_name||'']);
      row.eachCell(c=>{ c.border=xlsBorder; c.alignment={horizontal:'center'}; c.font={size:10.5}; c.numFmt='@';
        if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
      i++;
    }
  }
  ws.columns=[{width:10},{width:12},{width:16},{width:28}];
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:3}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`تفاصيل_الغياب_${dstr(BOARD_DATE)}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

/* ============ طباعة تفاصيل اليوم — صفحة لكل حصة، بكل غائباتها في كل الشعب ============ */
function printDay(){
  const perPeriod=collectDayPeriods();
  const footer=`<div class="pb-footer">${schoolName()} — طُبع بتاريخ ${dstr(new Date())}</div>`;
  const periods=Object.keys(perPeriod).map(Number).sort((a,b)=>a-b);
  if(!periods.length){
    $('printAreaBoard').innerHTML=`<div class="pb-page"><div class="pb-head"><h2>لا غياب مسجل في هذا اليوم 🎉</h2></div></div>${footer}`;
    printWithTitle(`تفاصيل_الغياب_${dstr(BOARD_DATE)}`); return;
  }
  const pages=periods.map(p=>{
    const rows=perPeriod[p].sort((a,b)=>(a.sec||'').localeCompare(b.sec||'','ar')||(a.full_name||'').localeCompare(b.full_name||'','ar'))
      .map((s,i)=>`<tr><td class="c">${i+1}</td><td class="c">${s.academic_number||''}</td><td>${s.full_name||''}</td><td class="c">${s.sec||''}</td></tr>`).join('');
    return `<div class="pb-page">
      <div class="pb-head"><h2>غائبات الحصة ${p} — ${AR_DAYS[BOARD_DATE.getDay()]||''} ${dstr(BOARD_DATE)}</h2>
        <p>العدد: ${perPeriod[p].length}</p></div>
      <table class="pb-tbl"><tr><th>#</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>الشعبة</th></tr>${rows}</table>
    </div>`;
  }).join('');
  $('printAreaBoard').innerHTML=pages+footer;
  printWithTitle(`تفاصيل_الغياب_${dstr(BOARD_DATE)}`);
}

registerTab({id:'boardMain', label:'متابعة الرصد', group:'attendance', groupLabel:'متابعة الغياب',
  show:f=>f.isAdmin||f.isLead||f.isSocial||f.isReg||f.isAttendanceLead, onOpen:loadBoard});
