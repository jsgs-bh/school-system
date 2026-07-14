/* early-attendance-report.js — متابعة الحضور المبكر
   معدل التأخر الصباحي الشهري والفصلي لكل طالبات المدرسة، محسوب تلقائياً
   من late_log على نفس أشهر الفصلين الفعلية (collectRange's schoolDaysCount
   للمقام، وعدّ سجلات late_log لكل طالبة شهرياً للبسط). */
import { db, $, S, dstr, toast, printWithTitle, registerTab } from './core.js';
import { collectRange } from './period.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';
const AR_MONTH=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const GREEN_MAX=5; // ≤5% أخضر، >5% أحمر (عكس الحضور: الأقل أفضل)

function monthsInSemester(fromStr,toStr){
  if(!fromStr||!toStr) return [];
  const months=[];
  const semStart=new Date(fromStr+'T12:00:00'), semEnd=new Date(toStr+'T12:00:00');
  let cur=new Date(semStart.getFullYear(),semStart.getMonth(),1);
  while(cur<=semEnd){
    const y=cur.getFullYear(), m=cur.getMonth();
    const monthStart=new Date(y,m,1), monthEnd=new Date(y,m+1,0);
    const from = monthStart<semStart ? fromStr : dstr(monthStart);
    const to = monthEnd>semEnd ? toStr : dstr(monthEnd);
    months.push({label:AR_MONTH[m], from, to});
    cur=new Date(y,m+1,1);
  }
  return months;
}

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="earlyAttReport" style="display:none">
  <div class="datebar">
    <div class="today-lbl">متابعة الحضور المبكر — معدل التأخر الصباحي الشهري</div>
    <button class="btn ghost" id="earRefresh">↻ تحديث</button>
  </div>
  <div class="actions" style="margin-bottom:14px">
    <button class="btn ghost" id="earXls">⬇ إكسل</button>
    <button class="btn ghost" id="earPdf">⬇ PDF</button>
  </div>
  <div class="result" id="earStatus" style="display:none"></div>
  <div class="board-wrap"><table class="board" id="earTable"></table></div>
</div>
<div id="printAreaEAR"></div>
<style>
  #earlyAttReport.wide{max-width:1700px}
  #earTable{font-size:11.5px}
  #earTable td.pct.green{background:#d7ecd9;font-weight:700}
  #earTable td.pct.red{background:#fbdada;font-weight:700}
  #printAreaEAR{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0;size:landscape}
    body *{visibility:hidden}
    #printAreaEAR, #printAreaEAR *{visibility:visible}
    #printAreaEAR{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:10mm}
    .ear-head{text-align:center;margin-bottom:10px}
    .ear-head h2{font-size:14px;color:#1d3d5c;font-weight:600}
    .ear-tbl{width:100%;border-collapse:collapse;font-size:8.5px}
    .ear-tbl th,.ear-tbl td{border:1px solid #ccc;padding:3px;text-align:center}
    .ear-tbl th{background:#1d3d5c;color:#fff}
    .ear-tbl td.pct.green{background:#d7ecd9;font-weight:700}
    .ear-tbl td.pct.red{background:#fbdada;font-weight:700}
  }
</style>`);

let SEM1_MONTHS=[], SEM2_MONTHS=[], REPORT_ROWS=[];

async function initEAR(){
  if($('earRefresh').dataset.ready) return;
  $('earRefresh').dataset.ready='1';
  $('earRefresh').addEventListener('click',runReport);
  $('earXls').addEventListener('click',exportXls);
  $('earPdf').addEventListener('click',exportPdf);
  await runReport();
}

async function runReport(){
  $('earStatus').style.display='block'; $('earStatus').className='result';
  $('earTable').innerHTML='';
  if(!S.YEAR?.start_date||!S.YEAR?.end_date){ $('earStatus').className='result err'; $('earStatus').textContent='لا توجد سنة دراسية نشطة بتواريخ محددة.'; return; }
  const today=dstr(new Date());
  SEM1_MONTHS=monthsInSemester(S.YEAR.start_date, S.YEAR.sem1_end||S.YEAR.end_date);
  SEM2_MONTHS=monthsInSemester(S.YEAR.sem2_start||S.YEAR.start_date, S.YEAR.end_date);
  const allMonths=[...SEM1_MONTHS,...SEM2_MONTHS];

  const monthData=[];
  for(let i=0;i<allMonths.length;i++){
    const m=allMonths[i];
    $('earStatus').textContent=`جارٍ الحساب — ${m.label}… (${i+1}/${allMonths.length})`;
    let {from,to}=m;
    if(from>today){ monthData.push({schoolDays:0, lateByStudent:{}}); continue; }
    if(to>today) to=today;
    const range=await collectRange(from,to);
    const {data:lateRows}=await db.from('late_log').select('student_id').gte('date',from).lte('date',to);
    const lateByStudent={}; for(const r of lateRows||[]) lateByStudent[r.student_id]=(lateByStudent[r.student_id]||0)+1;
    monthData.push({schoolDays:range.schoolDaysCount, lateByStudent});
  }

  const {data:enr,error}=await db.from('enrollments')
    .select('student_id, students(id,full_name,academic_number,contact1), sections(code)').is('to_date',null);
  if(error){ $('earStatus').className='result err'; $('earStatus').textContent='تعذر التحميل: '+error.message; return; }

  const rows=(enr||[]).filter(e=>e.students).map(e=>{
    const sid=e.students.id;
    const monthly=monthData.map(md=>{
      const late=md.lateByStudent[sid]||0, total=md.schoolDays||0;
      return {late, total, pct: total? (late/total*100) : null};
    });
    const sem1=monthly.slice(0,SEM1_MONTHS.length), sem2=monthly.slice(SEM1_MONTHS.length);
    const sum=arr=>({late:arr.reduce((a,b)=>a+b.late,0), total:arr.reduce((a,b)=>a+b.total,0)});
    const s1=sum(sem1), s2=sum(sem2);
    return {
      acad:e.students.academic_number, name:e.students.full_name, sec:e.sections?.code||'—', contact:e.students.contact1||'—',
      monthly, sem1Totals:s1, sem2Totals:s2,
      sem1Pct: s1.total? (s1.late/s1.total*100) : null,
      sem2Pct: s2.total? (s2.late/s2.total*100) : null,
    };
  }).sort((a,b)=>a.sec.localeCompare(b.sec,'ar')||a.name.localeCompare(b.name,'ar'));

  REPORT_ROWS=rows;
  render();
  $('earStatus').style.display='none';
}

function pctClass(p){ return p==null?'':(p<=GREEN_MAX?'pct green':'pct red'); }
function pctText(p){ return p==null?'—':p.toFixed(0)+'%'; }

function render(){
  const sem1Heads=SEM1_MONTHS.map(m=>`<th>${m.label}</th>`).join('')+'<th>مجموع التأخر</th><th>مجموع التمدرس</th><th>معدل التأخر</th>';
  const sem2Heads=SEM2_MONTHS.map(m=>`<th>${m.label}</th>`).join('')+'<th>مجموع التأخر</th><th>مجموع التمدرس</th><th>معدل التأخر</th>';
  let html='<tr><th rowspan="2">الرقم الأكاديمي</th><th rowspan="2">اسم الطالبة</th><th rowspan="2">الصف</th><th rowspan="2">رقم التواصل</th>'+
    `<th colspan="${SEM1_MONTHS.length+3}">الفصل الدراسي الأول</th><th colspan="${SEM2_MONTHS.length+3}">الفصل الدراسي الثاني</th></tr>`+
    `<tr>${sem1Heads}${sem2Heads}</tr>`;
  html+=REPORT_ROWS.map(r=>{
    const sem1Cells=r.monthly.slice(0,SEM1_MONTHS.length).map(m=>`<td class="c">${m.total?m.late:'—'}</td>`).join('');
    const sem2Cells=r.monthly.slice(SEM1_MONTHS.length).map(m=>`<td class="c">${m.total?m.late:'—'}</td>`).join('');
    return `<tr><td class="c">${r.acad}</td><td>${r.name}</td><td class="c">${r.sec}</td><td class="c">${r.contact}</td>
      ${sem1Cells}<td class="c">${r.sem1Totals.late}</td><td class="c">${r.sem1Totals.total}</td><td class="c ${pctClass(r.sem1Pct)}">${pctText(r.sem1Pct)}</td>
      ${sem2Cells}<td class="c">${r.sem2Totals.late}</td><td class="c">${r.sem2Totals.total}</td><td class="c ${pctClass(r.sem2Pct)}">${pctText(r.sem2Pct)}</td></tr>`;
  }).join('');
  $('earTable').innerHTML=html;
}

/* ============ تصدير ============ */
const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8', GREENFILL='FFD7ECD9', REDFILL='FFFBDADA';
const earBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function exportXls(){
  if(!REPORT_ROWS.length){ toast('لا بيانات بعد'); return; }
  const s1n=SEM1_MONTHS.length, s2n=SEM2_MONTHS.length;
  const cols=4+(s1n+3)+(s2n+3);
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('متابعة الحضور المبكر',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,cols);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle('معدل التأخر الصباحي لجميع طالبات المدرسة',12,true,null,'FF22303C');
  ws.addRow([]);
  const mLabels1=SEM1_MONTHS.map(m=>m.label), mLabels2=SEM2_MONTHS.map(m=>m.label);
  const sem1Start=5, sem1End=4+s1n+3, sem2Start=sem1End+1, sem2End=cols;
  const hdr1Vals=new Array(cols).fill('');
  hdr1Vals[0]='الرقم الأكاديمي'; hdr1Vals[1]='اسم الطالبة'; hdr1Vals[2]='الصف'; hdr1Vals[3]='رقم التواصل';
  hdr1Vals[sem1Start-1]='الفصل الدراسي الأول'; hdr1Vals[sem2Start-1]='الفصل الدراسي الثاني';
  const hdr1=ws.addRow(hdr1Vals);
  ws.mergeCells(hdr1.number,sem1Start,hdr1.number,sem1End); ws.mergeCells(hdr1.number,sem2Start,hdr1.number,sem2End);
  const hdr2=ws.addRow(['','','','',...mLabels1,'مجموع التأخر','مجموع التمدرس','معدل التأخر',...mLabels2,'مجموع التأخر','مجموع التمدرس','معدل التأخر']);
  [hdr1,hdr2].forEach(hdr=>hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=earBorder; }));
  ws.mergeCells(3,1,4,1); ws.mergeCells(3,2,4,2); ws.mergeCells(3,3,4,3); ws.mergeCells(3,4,4,4);

  const pct1Col=sem1End-1, pct2Col=sem2End-1;
  REPORT_ROWS.forEach((r,i)=>{
    const sem1=r.monthly.slice(0,s1n).map(m=>m.total?m.late:'');
    const sem2=r.monthly.slice(s1n).map(m=>m.total?m.late:'');
    const row=ws.addRow([r.acad,r.name,r.sec,r.contact,...sem1,r.sem1Totals.late,r.sem1Totals.total,pctText(r.sem1Pct),...sem2,r.sem2Totals.late,r.sem2Totals.total,pctText(r.sem2Pct)]);
    row.eachCell((c,colNo)=>{ c.border=earBorder; c.alignment={horizontal:colNo===2?'right':'center'}; c.font={size:9.5}; c.numFmt='@';
      if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}};
    });
    const p1cell=row.getCell(pct1Col), p2cell=row.getCell(pct2Col);
    if(r.sem1Pct!=null) p1cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:r.sem1Pct<=GREEN_MAX?GREENFILL:REDFILL}};
    if(r.sem2Pct!=null) p2cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:r.sem2Pct<=GREEN_MAX?GREENFILL:REDFILL}};
  });
  ws.columns=[{width:14},{width:26},{width:10},{width:13},
    ...SEM1_MONTHS.map(()=>({width:8})),{width:10},{width:10},{width:11},
    ...SEM2_MONTHS.map(()=>({width:8})),{width:10},{width:10},{width:11}];
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:4}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='متابعة_الحضور_المبكر.xlsx'; a.click();
  URL.revokeObjectURL(url);
}
function exportPdf(){
  if(!REPORT_ROWS.length){ toast('لا بيانات بعد'); return; }
  $('printAreaEAR').innerHTML=`<div class="ear-head"><h2>${schoolName()} — معدل التأخر الصباحي لجميع طالبات المدرسة</h2></div>
    <table class="ear-tbl">${$('earTable').innerHTML}</table>`;
  printWithTitle('متابعة_الحضور_المبكر');
}

registerTab({id:'earlyAttReport', label:'متابعة الحضور المبكر', group:'attendance', groupLabel:'متابعة الغياب',
  show:f=>f.isAdmin||f.isSocial||f.isAttendanceLead, init:initEAR});
