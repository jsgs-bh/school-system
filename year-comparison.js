/* year-comparison.js — مقارنة السنوات (تحت "الدرجات")
   تختارين سنتين أو أكثر (بغض النظر عن أي سنة نشطة حالياً) فتظهر
   مقارنة: الغياب، التأخير، الاستئذان، ونسب النجاح/الإتقان —
   لكل سنة على حدة، جنباً لجنب. */
import { db, $, S, toast, printWithTitle, registerTab } from './core.js';
import { collectRange } from './period.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="yearCompare" style="display:none">
  <div class="panel">
    <h3>مقارنة السنوات</h3>
    <div class="sub">اختاري سنتين أو أكثر للمقارنة — بغض النظر عن أي سنة مفعّلة حالياً.</div>
    <div id="ycYearList" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px"></div>
    <button class="btn gold" id="ycGo" style="width:auto;padding:10px 24px">قارني</button>
  </div>
  <div id="ycResults" style="display:none">
    <div class="result" id="ycStatus" style="display:none"></div>
    <div class="actions" style="margin-bottom:14px">
      <button class="btn ghost" id="ycXls">⬇ إكسل</button>
      <button class="btn ghost" id="ycPdf">⬇ PDF</button>
    </div>
    <div class="board-wrap"><table class="board" id="ycTable"></table></div>
  </div>
</div>
<div id="printAreaYC"></div>
<style>
  #yearCompare.wide{max-width:1100px}
  .yc-year-check{display:inline-flex;align-items:center;gap:8px;background:var(--white);border:1px solid var(--line);border-radius:9px;padding:9px 16px;cursor:pointer}
  #printAreaYC{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaYC, #printAreaYC *{visibility:visible}
    #printAreaYC{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
    .yc-head{text-align:center;margin-bottom:12px}
    .yc-head h2{font-size:15px;color:#1d3d5c;font-weight:600}
    .yc-tbl{width:100%;border-collapse:collapse;font-size:11px}
    .yc-tbl th,.yc-tbl td{border:1px solid #ccc;padding:6px;text-align:center}
    .yc-tbl th{background:#1d3d5c;color:#fff}
  }
</style>`);

let YEARS=[], RESULT_ROWS=[];

async function initYC(){
  if($('ycGo').dataset.ready) return;
  $('ycGo').dataset.ready='1';
  const {data,error}=await db.from('academic_years').select('*').order('start_date',{ascending:false});
  if(error){ $('ycYearList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  YEARS=data||[];
  $('ycYearList').innerHTML=YEARS.map(y=>`<label class="yc-year-check"><input type="checkbox" value="${y.id}"> ${y.name}${y.is_active?' (نشطة الآن)':''}</label>`).join('')
    || '<div class="empty-day">لا سنوات دراسية بعد.</div>';
  $('ycGo').addEventListener('click',runCompare);
  $('ycXls').addEventListener('click',exportXls);
  $('ycPdf').addEventListener('click',exportPdf);
}

async function runCompare(){
  const checked=[...$('ycYearList').querySelectorAll('input:checked')].map(i=>i.value);
  if(checked.length<2){ toast('اختاري سنتين على الأقل'); return; }
  const years=YEARS.filter(y=>checked.includes(y.id));
  $('ycResults').style.display='block';
  $('ycStatus').style.display='block'; $('ycStatus').className='result';

  const {data:th}=await db.from('grade_settings').select('*').eq('id',1).maybeSingle();
  const THRESH=th||{pass_pct:50,mastery_pct:80};
  const today=new Date().toISOString().slice(0,10);

  const rows=[];
  for(let i=0;i<years.length;i++){
    const y=years[i];
    $('ycStatus').textContent=`جارٍ الحساب — ${y.name}… (${i+1}/${years.length})`;
    let to=y.end_date>today?today:y.end_date;
    let schoolDays=0, absTotal=0;
    if(y.start_date<=to){
      const range=await collectRange(y.start_date,to);
      schoolDays=range.schoolDaysCount||0;
      absTotal=Object.values(range.perStudentAbsDays||{}).reduce((a,b)=>a+b,0);
    }
    const {count:lateCount}=await db.from('late_log').select('id',{count:'exact',head:true}).gte('date',y.start_date).lte('date',to);
    const {count:excuseCount}=await db.from('excuse_log').select('id',{count:'exact',head:true}).gte('date',y.start_date).lte('date',to);

    const {data:exams}=await db.from('exams').select('id,exam_total,subject_id,subjects(exam_total)').eq('academic_year_id',y.id);
    let pass=0, mastery=0, graded=0;
    if(exams?.length){
      const examIds=exams.map(e=>e.id);
      const totalById={}; for(const e of exams) totalById[e.id]=e.exam_total ?? e.subjects?.exam_total ?? 25;
      for(let c0=0;c0<examIds.length;c0+=200){
        const chunkIds=examIds.slice(c0,c0+200);
        const {data:recs}=await db.from('grade_records').select('exam_id,score').in('exam_id',chunkIds).not('score','is',null);
        for(const r of recs||[]){
          const total=totalById[r.exam_id]||25, pct=r.score/total*100;
          graded++; if(pct>=THRESH.pass_pct) pass++; if(pct>=THRESH.mastery_pct) mastery++;
        }
      }
    }

    rows.push({
      name:y.name, schoolDays, absTotal,
      lateCount:lateCount||0, excuseCount:excuseCount||0,
      graded, passPct: graded?(pass/graded*100):null, masteryPct: graded?(mastery/graded*100):null,
    });
  }
  RESULT_ROWS=rows;
  render();
  $('ycStatus').style.display='none';
}

function pctText(p){ return p==null?'—':p.toFixed(1)+'٪'; }

function render(){
  $('ycTable').innerHTML='<tr><th>المؤشر</th>'+RESULT_ROWS.map(r=>`<th>${r.name}</th>`).join('')+'</tr>'+
    `<tr><td class="sec">عدد أيام الدراسة المحسوبة</td>${RESULT_ROWS.map(r=>`<td class="c">${r.schoolDays}</td>`).join('')}</tr>`+
    `<tr><td class="sec">إجمالي حالات الغياب</td>${RESULT_ROWS.map(r=>`<td class="c">${r.absTotal}</td>`).join('')}</tr>`+
    `<tr><td class="sec">إجمالي حالات التأخير</td>${RESULT_ROWS.map(r=>`<td class="c">${r.lateCount}</td>`).join('')}</tr>`+
    `<tr><td class="sec">إجمالي حالات الاستئذان</td>${RESULT_ROWS.map(r=>`<td class="c">${r.excuseCount}</td>`).join('')}</tr>`+
    `<tr><td class="sec">عدد الدرجات المرصودة</td>${RESULT_ROWS.map(r=>`<td class="c">${r.graded}</td>`).join('')}</tr>`+
    `<tr><td class="sec">نسبة النجاح</td>${RESULT_ROWS.map(r=>`<td class="c">${pctText(r.passPct)}</td>`).join('')}</tr>`+
    `<tr><td class="sec">نسبة الإتقان</td>${RESULT_ROWS.map(r=>`<td class="c">${pctText(r.masteryPct)}</td>`).join('')}</tr>`;
}

/* ============ تصدير ============ */
const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const ycBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function exportXls(){
  if(!RESULT_ROWS.length){ toast('شغّلي المقارنة أولاً'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('مقارنة السنوات',{views:[{rightToLeft:true}]});
  const cols=1+RESULT_ROWS.length;
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,cols);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle('مقارنة السنوات الدراسية',12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['المؤشر',...RESULT_ROWS.map(r=>r.name)]);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=ycBorder; });
  const dataRows=[
    ['عدد أيام الدراسة المحسوبة',...RESULT_ROWS.map(r=>r.schoolDays)],
    ['إجمالي حالات الغياب',...RESULT_ROWS.map(r=>r.absTotal)],
    ['إجمالي حالات التأخير',...RESULT_ROWS.map(r=>r.lateCount)],
    ['إجمالي حالات الاستئذان',...RESULT_ROWS.map(r=>r.excuseCount)],
    ['عدد الدرجات المرصودة',...RESULT_ROWS.map(r=>r.graded)],
    ['نسبة النجاح',...RESULT_ROWS.map(r=>pctText(r.passPct))],
    ['نسبة الإتقان',...RESULT_ROWS.map(r=>pctText(r.masteryPct))],
  ];
  dataRows.forEach((vals,i)=>{
    const row=ws.addRow(vals);
    row.eachCell((c,colNo)=>{ c.border=ycBorder; c.alignment={horizontal:colNo===1?'right':'center'}; c.font={size:10.5};
      if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
  });
  ws.columns=[{width:26},...RESULT_ROWS.map(()=>({width:16}))];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='مقارنة_السنوات.xlsx'; a.click();
  URL.revokeObjectURL(url);
}
function exportPdf(){
  if(!RESULT_ROWS.length){ toast('شغّلي المقارنة أولاً'); return; }
  $('printAreaYC').innerHTML=`<div class="yc-head"><h2>${schoolName()} — مقارنة السنوات الدراسية</h2></div>
    <table class="yc-tbl">${$('ycTable').innerHTML}</table>`;
  printWithTitle('مقارنة_السنوات');
}

registerTab({id:'yearCompare', label:'مقارنة السنوات', group:'grades', groupLabel:'الدرجات',
  show:f=>f.isAdmin||f.isLead||f.isAnalysis, init:initYC});
