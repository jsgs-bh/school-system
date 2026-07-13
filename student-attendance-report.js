/* student-attendance-report.js — غياب الطالبات
   معدل الحضور الفصلي والشهري لكل طالبات المدرسة، محسوب تلقائياً شهراً
   بشهر لكلا الفصلين، بنفس منطق "الغياب الرسمي اليومي" المعتمد في بقية
   النظام (period.js's collectRange) — بلا أي إدخال يدوي. */
import { db, $, S, dstr, toast, printWithTitle, registerTab } from './core.js';
import { collectRange } from './period.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';
const MONTHS = [
  {label:'سبتمبر',month:9,yo:0}, {label:'أكتوبر',month:10,yo:0}, {label:'نوفمبر',month:11,yo:0}, {label:'ديسمبر',month:12,yo:0}, {label:'يناير',month:1,yo:1},
  {label:'فبراير',month:2,yo:1}, {label:'مارس',month:3,yo:1}, {label:'أبريل',month:4,yo:1}, {label:'مايو',month:5,yo:1}, {label:'يونيو',month:6,yo:1},
];
const GREEN=90, RED=80; // ≥90 أخضر، <80 أحمر (كما في القالب)

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="studentAttReport" style="display:none">
  <div class="datebar">
    <div class="today-lbl">غياب الطالبات — معدل الحضور الفصلي والشهري</div>
    <button class="btn ghost" id="sarRefresh">↻ تحديث</button>
  </div>
  <div class="actions" style="margin-bottom:14px">
    <button class="btn ghost" id="sarXls">⬇ إكسل</button>
    <button class="btn ghost" id="sarPdf">⬇ PDF</button>
  </div>
  <div class="result" id="sarStatus" style="display:none"></div>
  <div class="board-wrap"><table class="board" id="sarTable"></table></div>
</div>
<div id="printAreaSAR"></div>
<style>
  #studentAttReport.wide{max-width:1700px}
  #sarTable{font-size:11.5px}
  #sarTable td.pct.green{background:#d7ecd9;font-weight:700}
  #sarTable td.pct.red{background:#fbdada;font-weight:700}
  #printAreaSAR{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0;size:landscape}
    body *{visibility:hidden}
    #printAreaSAR, #printAreaSAR *{visibility:visible}
    #printAreaSAR{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:10mm}
    .sar-head{text-align:center;margin-bottom:10px}
    .sar-head h2{font-size:14px;color:#1d3d5c;font-weight:600}
    .sar-tbl{width:100%;border-collapse:collapse;font-size:8.5px}
    .sar-tbl th,.sar-tbl td{border:1px solid #ccc;padding:3px;text-align:center}
    .sar-tbl th{background:#1d3d5c;color:#fff}
    .sar-tbl td.pct.green{background:#d7ecd9;font-weight:700}
    .sar-tbl td.pct.red{background:#fbdada;font-weight:700}
  }
</style>`);

let REPORT_ROWS=[];

function getStartYear(){
  for(const v of Object.values(S.YEAR||{})){
    if(typeof v==='string'){ const m=v.match(/(20\d{2})/); if(m) return +m[1]; }
  }
  const now=new Date(), mo=now.getMonth()+1;
  return mo>=9 ? now.getFullYear() : now.getFullYear()-1;
}
function monthRange(year,month){
  return { from: dstr(new Date(year,month-1,1)), to: dstr(new Date(year,month,0)) };
}

async function initSAR(){
  if($('sarRefresh').dataset.ready) return;
  $('sarRefresh').dataset.ready='1';
  $('sarRefresh').addEventListener('click',runReport);
  $('sarXls').addEventListener('click',exportXls);
  $('sarPdf').addEventListener('click',exportPdf);
  await runReport();
}

async function runReport(){
  const tbl=$('sarTable');
  $('sarStatus').style.display='block'; $('sarStatus').className='result';
  tbl.innerHTML='';
  const startYear=getStartYear(), today=dstr(new Date());

  const monthData=[];
  for(let i=0;i<MONTHS.length;i++){
    const m=MONTHS[i];
    $('sarStatus').textContent=`جارٍ الحساب — ${m.label}… (${i+1}/10)`;
    const year=startYear+m.yo;
    let {from,to}=monthRange(year,m.month);
    if(from>today){ monthData.push({m,schoolDaysCount:0,perStudentAbsDays:{}}); continue; }
    if(to>today) to=today;
    const range=await collectRange(from,to);
    monthData.push({m, schoolDaysCount:range.schoolDaysCount, perStudentAbsDays:range.perStudentAbsDays});
  }

  const {data:enr,error}=await db.from('enrollments')
    .select('student_id, students(id,full_name,academic_number,contact1), sections(code)').is('to_date',null);
  if(error){ $('sarStatus').className='result err'; $('sarStatus').textContent='تعذر التحميل: '+error.message; return; }

  const rows=(enr||[]).filter(e=>e.students).map(e=>{
    const sid=e.students.id;
    const monthly=monthData.map(md=>{
      const abs=md.perStudentAbsDays[sid]||0, total=md.schoolDaysCount||0;
      return {abs, total, present: total-abs};
    });
    const sem1=monthly.slice(0,5), sem2=monthly.slice(5,10);
    const sum=arr=>({abs:arr.reduce((a,b)=>a+b.abs,0), total:arr.reduce((a,b)=>a+b.total,0), present:arr.reduce((a,b)=>a+b.present,0)});
    const s1=sum(sem1), s2=sum(sem2);
    return {
      acad:e.students.academic_number, name:e.students.full_name, sec:e.sections?.code||'—', contact:e.students.contact1||'—',
      monthly, sem1Totals:s1, sem2Totals:s2,
      sem1Pct: s1.total? (s1.present/s1.total*100) : null,
      sem2Pct: s2.total? (s2.present/s2.total*100) : null,
    };
  }).sort((a,b)=>a.sec.localeCompare(b.sec,'ar')||a.name.localeCompare(b.name,'ar'));

  REPORT_ROWS=rows;
  render();
  $('sarStatus').style.display='none';
}

function pctClass(p){ return p==null?'':(p>=GREEN?'pct green':p<RED?'pct red':'pct'); }
function pctText(p){ return p==null?'—':p.toFixed(0)+'%'; }

function render(){
  const sem1Heads=MONTHS.slice(0,5).map(m=>`<th>${m.label}</th>`).join('')+'<th>مجموع غياب</th><th>مجموع حضور</th><th>نسبة الحضور</th>';
  const sem2Heads=MONTHS.slice(5,10).map(m=>`<th>${m.label}</th>`).join('')+'<th>مجموع غياب</th><th>مجموع حضور</th><th>نسبة الحضور</th>';
  let html='<tr><th rowspan="2">الرقم الأكاديمي</th><th rowspan="2">اسم الطالبة</th><th rowspan="2">الصف</th><th rowspan="2">رقم التواصل</th>'+
    `<th colspan="8">الفصل الدراسي الأول</th><th colspan="8">الفصل الدراسي الثاني</th></tr>`+
    `<tr>${sem1Heads}${sem2Heads}</tr>`;
  html+=REPORT_ROWS.map(r=>{
    const sem1Cells=r.monthly.slice(0,5).map(m=>`<td class="c">${m.total?m.abs:'—'}</td>`).join('');
    const sem2Cells=r.monthly.slice(5,10).map(m=>`<td class="c">${m.total?m.abs:'—'}</td>`).join('');
    return `<tr><td class="c">${r.acad}</td><td>${r.name}</td><td class="c">${r.sec}</td><td class="c">${r.contact}</td>
      ${sem1Cells}<td class="c">${r.sem1Totals.abs}</td><td class="c">${r.sem1Totals.present}</td><td class="c ${pctClass(r.sem1Pct)}">${pctText(r.sem1Pct)}</td>
      ${sem2Cells}<td class="c">${r.sem2Totals.abs}</td><td class="c">${r.sem2Totals.present}</td><td class="c ${pctClass(r.sem2Pct)}">${pctText(r.sem2Pct)}</td></tr>`;
  }).join('');
  $('sarTable').innerHTML=html;
}

/* ============ تصدير ============ */
const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8', GREENFILL='FFD7ECD9', REDFILL='FFFBDADA';
const sarBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function exportXls(){
  if(!REPORT_ROWS.length){ toast('لا بيانات بعد'); return; }
  const cols=4+8+8;
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('غياب الطالبات',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,cols);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle('معدل الحضور الفصلي والشهري لجميع طالبات المدرسة',12,true,null,'FF22303C');
  ws.addRow([]);
  const mLabels1=MONTHS.slice(0,5).map(m=>m.label), mLabels2=MONTHS.slice(5,10).map(m=>m.label);
  const hdr1=ws.addRow(['الرقم الأكاديمي','اسم الطالبة','الصف','رقم التواصل','الفصل الدراسي الأول','','','','','','','','الفصل الدراسي الثاني','','','','','','','']);
  ws.mergeCells(hdr1.number,5,hdr1.number,12); ws.mergeCells(hdr1.number,13,hdr1.number,20);
  const hdr2=ws.addRow(['','','','',...mLabels1,'مجموع غياب','مجموع حضور','نسبة الحضور',...mLabels2,'مجموع غياب','مجموع حضور','نسبة الحضور']);
  [hdr1,hdr2].forEach(hdr=>hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=sarBorder; }));
  ws.mergeCells(3,1,4,1); ws.mergeCells(3,2,4,2); ws.mergeCells(3,3,4,3); ws.mergeCells(3,4,4,4);

  REPORT_ROWS.forEach((r,i)=>{
    const sem1=r.monthly.slice(0,5).map(m=>m.total?m.abs:'');
    const sem2=r.monthly.slice(5,10).map(m=>m.total?m.abs:'');
    const row=ws.addRow([r.acad,r.name,r.sec,r.contact,...sem1,r.sem1Totals.abs,r.sem1Totals.present,pctText(r.sem1Pct),...sem2,r.sem2Totals.abs,r.sem2Totals.present,pctText(r.sem2Pct)]);
    row.eachCell((c,colNo)=>{ c.border=sarBorder; c.alignment={horizontal:colNo===2?'right':'center'}; c.font={size:9.5}; c.numFmt='@';
      if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}};
    });
    const p1cell=row.getCell(12), p2cell=row.getCell(20);
    if(r.sem1Pct!=null) p1cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:r.sem1Pct>=GREEN?GREENFILL:r.sem1Pct<RED?REDFILL:'FFFFFFFF'}};
    if(r.sem2Pct!=null) p2cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:r.sem2Pct>=GREEN?GREENFILL:r.sem2Pct<RED?REDFILL:'FFFFFFFF'}};
  });
  ws.columns=[{width:14},{width:26},{width:10},{width:13},
    ...MONTHS.slice(0,5).map(()=>({width:8})),{width:10},{width:10},{width:11},
    ...MONTHS.slice(5,10).map(()=>({width:8})),{width:10},{width:10},{width:11}];
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:4}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='غياب_الطالبات.xlsx'; a.click();
  URL.revokeObjectURL(url);
}
function exportPdf(){
  if(!REPORT_ROWS.length){ toast('لا بيانات بعد'); return; }
  $('printAreaSAR').innerHTML=`<div class="sar-head"><h2>${schoolName()} — معدل الحضور الفصلي والشهري لجميع طالبات المدرسة</h2></div>
    <table class="sar-tbl">${$('sarTable').innerHTML}</table>`;
  printWithTitle('غياب_الطالبات');
}

registerTab({id:'studentAttReport', label:'غياب الطالبات', group:'attendance', groupLabel:'متابعة الغياب',
  show:f=>f.isAdmin||f.isSocial||f.isAttendanceLead, init:initSAR});
