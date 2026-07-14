/* section-attendance-report.js — غياب الصفوف
   نسبة الحضور الشهرية لكل شعبة (كل الشعب)، مع صف "مجموع المدرسة" أولاً،
   وفي النهاية صفوف تجميعية لكل مستوى دراسي (أول/ثاني/ثالث) شهراً بشهر —
   بنفس منطق collectRange ونفس تواريخ الفصلين الفعلية. */
import { db, $, S, dstr, toast, printWithTitle, registerTab } from './core.js';
import { collectRange } from './period.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';
const AR_MONTH=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const GREEN=90, RED=80;
const LEVEL_LABEL={1:'المستوى الأول',2:'المستوى الثاني',3:'المستوى الثالث'};

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
<div class="app-main wide" id="sectionAttReport" style="display:none">
  <div class="datebar">
    <div class="today-lbl">غياب الصفوف — معدل الحضور الشهري لكل شعبة</div>
    <button class="btn ghost" id="secarRefresh">↻ تحديث</button>
  </div>
  <div class="actions" style="margin-bottom:14px">
    <button class="btn ghost" id="secarXls">⬇ إكسل</button>
    <button class="btn ghost" id="secarPdf">⬇ PDF</button>
  </div>
  <div class="result" id="secarStatus" style="display:none"></div>
  <div class="board-wrap"><table class="board" id="secarTable"></table></div>
</div>
<div id="printAreaSECAR"></div>
<style>
  #sectionAttReport.wide{max-width:1700px}
  #secarTable{font-size:11.5px}
  #secarTable tr.school-total td{font-weight:700;background:var(--sand)}
  #secarTable tr.level-total td{font-weight:700;background:#eef1f5}
  #secarTable td.pct.green{background:#d7ecd9;font-weight:700}
  #secarTable td.pct.red{background:#fbdada;font-weight:700}
  #printAreaSECAR{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0;size:portrait}
    body *{visibility:hidden}
    #printAreaSECAR, #printAreaSECAR *{visibility:visible}
    #printAreaSECAR{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:10mm}
    .secar-head{text-align:center;margin-bottom:10px}
    .secar-head h2{font-size:14px;color:#1d3d5c;font-weight:600}
    .secar-tbl{width:100%;border-collapse:collapse;font-size:9px}
    .secar-tbl th,.secar-tbl td{border:1px solid #ccc;padding:3px;text-align:center}
    .secar-tbl th{background:#1d3d5c;color:#fff}
    .secar-tbl tr.school-total td,.secar-tbl tr.level-total td{font-weight:700;background:#eef1f5}
    .secar-tbl td.pct.green{background:#d7ecd9;font-weight:700}
    .secar-tbl td.pct.red{background:#fbdada;font-weight:700}
  }
</style>`);

let ALL_MONTHS=[], ROWS=[];

async function initSECAR(){
  if($('secarRefresh').dataset.ready) return;
  $('secarRefresh').dataset.ready='1';
  $('secarRefresh').addEventListener('click',runReport);
  $('secarXls').addEventListener('click',exportXls);
  $('secarPdf').addEventListener('click',exportPdf);
  await runReport();
}

async function runReport(){
  $('secarStatus').style.display='block'; $('secarStatus').className='result';
  $('secarTable').innerHTML='';
  if(!S.YEAR?.start_date||!S.YEAR?.end_date){ $('secarStatus').className='result err'; $('secarStatus').textContent='لا توجد سنة دراسية نشطة بتواريخ محددة.'; return; }
  const today=dstr(new Date());
  const sem1=monthsInSemester(S.YEAR.start_date, S.YEAR.sem1_end||S.YEAR.end_date);
  const sem2=monthsInSemester(S.YEAR.sem2_start||S.YEAR.start_date, S.YEAR.end_date);
  ALL_MONTHS=[...sem1,...sem2];

  const {data:sections,error}=await db.from('sections').select('id,code,level').eq('academic_year_id',S.YEAR.id).order('code');
  if(error){ $('secarStatus').className='result err'; $('secarStatus').textContent='تعذر التحميل: '+error.message; return; }

  const {data:enr}=await db.from('enrollments').select('section_id').is('to_date',null);
  const enrolledBySec={}; for(const e of enr||[]) enrolledBySec[e.section_id]=(enrolledBySec[e.section_id]||0)+1;

  const monthData=[];
  for(let i=0;i<ALL_MONTHS.length;i++){
    const m=ALL_MONTHS[i];
    $('secarStatus').textContent=`جارٍ الحساب — ${m.label}… (${i+1}/${ALL_MONTHS.length})`;
    let {from,to}=m;
    if(from>today){ monthData.push({schoolDays:0, absBySecCode:{}}); continue; }
    if(to>today) to=today;
    const range=await collectRange(from,to);
    monthData.push({schoolDays:range.schoolDaysCount, absBySecCode:range.perSectionAbsDays});
  }

  function pctFor(schoolDays,absDays,enrolled){
    if(!schoolDays||!enrolled) return null;
    const denom=schoolDays*enrolled;
    return denom? ((denom-absDays)/denom*100) : null;
  }

  const schoolRow={label:'مجموع المدرسة', cls:'school-total', monthly:monthData.map(md=>{
    const totalEnrolled=Object.values(enrolledBySec).reduce((a,b)=>a+b,0);
    const totalAbs=Object.values(md.absBySecCode).reduce((a,b)=>a+b,0);
    return pctFor(md.schoolDays,totalAbs,totalEnrolled);
  })};

  const secRows=(sections||[]).map(s=>({
    label:s.code, cls:'', level:s.level,
    monthly: monthData.map(md=> pctFor(md.schoolDays, md.absBySecCode[s.code]||0, enrolledBySec[s.id]||0))
  }));

  const levels=[1,2,3];
  const levelRows=levels.map(lv=>{
    const secsInLevel=(sections||[]).filter(s=>s.level===lv);
    if(!secsInLevel.length) return null;
    const monthly=monthData.map(md=>{
      const enrolled=secsInLevel.reduce((a,s)=>a+(enrolledBySec[s.id]||0),0);
      const abs=secsInLevel.reduce((a,s)=>a+(md.absBySecCode[s.code]||0),0);
      return pctFor(md.schoolDays,abs,enrolled);
    });
    return {label:LEVEL_LABEL[lv], cls:'level-total', monthly};
  }).filter(Boolean);

  ROWS=[schoolRow,...secRows,...levelRows];
  render();
  $('secarStatus').style.display='none';
}

function pctClass(p){ return p==null?'':(p>=GREEN?'pct green':p<RED?'pct red':'pct'); }
function pctText(p){ return p==null?'—':p.toFixed(1)+'٪'; }

function render(){
  $('secarTable').innerHTML='<tr><th>الصف</th>'+ALL_MONTHS.map(m=>`<th>${m.label}</th>`).join('')+'</tr>'+
    ROWS.map(r=>`<tr class="${r.cls}"><td class="sec">${r.label}</td>${r.monthly.map(p=>`<td class="c ${pctClass(p)}">${pctText(p)}</td>`).join('')}</tr>`).join('');
}

const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8', GREENFILL='FFD7ECD9', REDFILL='FFFBDADA', SANDFILL='FFEEF1F5';
const secarBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function exportXls(){
  if(!ROWS.length){ toast('لا بيانات بعد'); return; }
  const cols=1+ALL_MONTHS.length;
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('غياب الصفوف',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,cols);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle('معدل حضور الطالبات الشهري والفصلي لجميع الصفوف',12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['الصف',...ALL_MONTHS.map(m=>m.label)]);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=secarBorder; });
  ROWS.forEach(r=>{
    const row=ws.addRow([r.label,...r.monthly.map(p=>pctText(p))]);
    row.eachCell((c,colNo)=>{
      c.border=secarBorder; c.alignment={horizontal:'center'}; c.font={size:10, bold: r.cls?true:false};
      if(colNo>1){
        const p=r.monthly[colNo-2];
        if(p!=null) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:p>=GREEN?GREENFILL:p<RED?REDFILL:'FFFFFFFF'}};
      } else if(r.cls){ c.fill={type:'pattern',pattern:'solid',fgColor:{argb:SANDFILL}}; }
    });
  });
  ws.columns=[{width:16},...ALL_MONTHS.map(()=>({width:10}))];
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:4}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='غياب_الصفوف.xlsx'; a.click();
  URL.revokeObjectURL(url);
}
function exportPdf(){
  if(!ROWS.length){ toast('لا بيانات بعد'); return; }
  $('printAreaSECAR').innerHTML=`<div class="secar-head"><h2>${schoolName()} — معدل حضور الطالبات الشهري لجميع الصفوف</h2></div>
    <table class="secar-tbl">${$('secarTable').innerHTML}</table>`;
  printWithTitle('غياب_الصفوف');
}

registerTab({id:'sectionAttReport', label:'غياب الصفوف', group:'attendance', groupLabel:'متابعة الغياب',
  show:f=>f.isAdmin||f.isSocial||f.isAttendanceLead, init:initSECAR});
