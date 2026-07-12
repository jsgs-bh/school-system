/* builder.js — منشئ التقارير (شبيه Power BI مبسّط):
   تختارين الفترة، مستوى التفصيل (سجل/طالبة/شعبة/يومي)، والأعمدة التي
   تريدينها فقط، تعاينين النتيجة، ثم تنزّلينها إكسل (الأولوية) أو PDF.
   يعيد استخدام collectRange من period.js لتفادي ازدواج منطق الاحتساب.
   الملف مكتفٍ بذاته: يضيف تبويبه وتنسيقاته وحاوية طباعته الخاصة. */
import { db, $, S, AR_DAYS, dstr, chunk, toast, printWithTitle, registerTab } from './core.js';
import { collectRange } from './period.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';

const LEVELS = {
  detail:  {label:'سجل تفصيلي — كل غياب على حدة', title:'سجل تفصيلي للغياب'},
  student: {label:'ملخص لكل طالبة',                title:'ملخص غياب الطالبات'},
  section: {label:'ملخص لكل شعبة',                  title:'ملخص غياب الشعب'},
  daily:   {label:'الغياب اليومي',                  title:'الغياب اليومي'},
};
const FIELDS = {
  detail:  [['date','التاريخ'],['day','اليوم'],['sec','الشعبة'],['acad','الرقم الأكاديمي'],['name','اسم الطالبة'],['c1','تواصل ١'],['c2','تواصل ٢']],
  student: [['acad','الرقم الأكاديمي'],['name','اسم الطالبة'],['sec','الشعبة الحالية'],['c1','تواصل ١'],['c2','تواصل ٢'],['count','عدد مرات الغياب'],['rate','نسبة الغياب من الفترة']],
  section: [['sec','الشعبة'],['enrolled','عدد المقيدات'],['absDays','إجمالي حالات الغياب'],['rate','نسبة الغياب']],
  daily:   [['date','التاريخ'],['day','اليوم'],['count','عدد الغياب الرسمي']],
};

/* ============ حقن الواجهة والتنسيقات ============ */
$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="builderMain" style="display:none">
  <div class="panel">
    <h3>منشئ التقارير</h3>
    <div class="sub">اختاري الفترة ومستوى التفصيل والأعمدة التي تحتاجينها فقط، عايني النتيجة، ثم نزّليها إكسل أو PDF.</div>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
      <label style="font-size:13px;color:var(--navy);font-weight:600">من <input type="date" id="bFrom"></label>
      <label style="font-size:13px;color:var(--navy);font-weight:600">إلى <input type="date" id="bTo"></label>
      <select id="bLevel" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)">
        ${Object.entries(LEVELS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
      </select>
    </div>
    <div id="bFields" style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;background:var(--sand);border-radius:11px;padding:14px"></div>
    <div class="actions">
      <button class="btn gold" id="bGo">توليد المعاينة</button>
      <button class="btn ghost" id="bXls">⬇ تنزيل إكسل</button>
      <button class="btn ghost" id="bPdf">⬇ تنزيل PDF</button>
    </div>
    <div class="result" id="bStatus" style="display:none;background:var(--sand);color:var(--ink);border:1px solid var(--line)"></div>
  </div>
  <div class="panel">
    <div id="bCount" style="font-size:13px;color:#6b7683;margin-bottom:10px"></div>
    <div class="board-wrap"><table class="board" id="bTable"></table></div>
  </div>
</div>
<div id="printAreaBuilder"></div>
<style>
  #builderMain.wide{max-width:1400px}
  #builderMain input[type=date]{padding:9px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)}
  #bFields label{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--navy);cursor:pointer}
  #printAreaBuilder{display:none}
  @media print{
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaBuilder, #printAreaBuilder *{visibility:visible}
    #printAreaBuilder{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm 16mm}
    .bd-head{text-align:center;margin-bottom:12px}
    .bd-head h2{font-size:14px;color:#1d3d5c;font-weight:600;margin-bottom:6px}
    .bd-head p{font-size:11.5px;color:#333}
    .bd-tbl{width:100%;border-collapse:collapse;font-size:10px}
    .bd-tbl th{background:#1d3d5c;color:#fff;padding:5px;border:1px solid #1d3d5c}
    .bd-tbl td{padding:4px;border:1px solid #ccc;text-align:right}
    .bd-footer{position:fixed;bottom:6mm;left:12mm;right:12mm;text-align:center;font-size:9.5px;color:#555;border-top:1px solid #ccc;padding-top:4px;font-family:'Amiri',serif}
  }
</style>`);

let ROWS=[], LEVEL='detail';

function initBuilder(){
  if($('bFrom').dataset.ready) return;
  $('bFrom').dataset.ready='1';
  const today=dstr(new Date());
  $('bFrom').value=today.slice(0,8)+'01';
  $('bTo').value=today;
  renderFieldPicker();
  $('bLevel').addEventListener('change',()=>{ LEVEL=$('bLevel').value; renderFieldPicker(); $('bTable').innerHTML=''; $('bCount').textContent=''; ROWS=[]; });
  $('bGo').addEventListener('click',generate);
  $('bXls').addEventListener('click',exportXls);
  $('bPdf').addEventListener('click',exportPdf);
}
function renderFieldPicker(){
  LEVEL=$('bLevel').value;
  $('bFields').innerHTML=FIELDS[LEVEL].map(([k,label])=>
    `<label><input type="checkbox" class="bf" value="${k}" checked> ${label}</label>`).join('');
}
function checkedFields(){
  return [...$('bFields').querySelectorAll('.bf:checked')].map(c=>c.value);
}
function fieldLabel(key){ return (FIELDS[LEVEL].find(f=>f[0]===key)||[])[1]||key; }

async function generate(){
  const from=$('bFrom').value, to=$('bTo').value;
  if(!from||!to){ toast('حددي بداية ونهاية الفترة'); return; }
  if(from>to){ toast('تاريخ البداية بعد تاريخ النهاية'); return; }
  const btn=$('bGo'); btn.disabled=true; btn.textContent='جارٍ التجميع…';
  $('bStatus').style.display='block'; $('bStatus').className='result'; $('bStatus').textContent='جارٍ تجميع البيانات…';
  try{
    const range=await collectRange(from,to);
    if(!range.schoolDaysCount){ toast('لا أيام دراسية صالحة في هذه الفترة'); ROWS=[]; renderTable(); return; }
    ROWS = LEVEL==='detail' ? await buildDetailRows(range)
         : LEVEL==='student' ? await buildStudentRows(range)
         : LEVEL==='section' ? await buildSectionRows(range)
         : buildDailyRows(range);
    renderTable();
    $('bStatus').style.display='none';
  }catch(err){ $('bStatus').className='result err'; $('bStatus').textContent='تعذر التوليد: '+(err.message||err); }
  finally{ btn.disabled=false; btn.textContent='توليد المعاينة'; }
}

async function fetchContacts(ids){
  const map={};
  for(const c of chunk([...ids],200)){
    const {data:st}=await db.from('students').select('id,contact1,contact2').in('id',c);
    for(const s of st||[]) map[s.id]={c1:s.contact1||'',c2:s.contact2||''};
  }
  return map;
}
function fmtPhone(v){ if(!v) return ''; const s=String(v); return s.includes('.')?s.split('.')[0]:s; }

async function buildDetailRows(range){
  const allSids=new Set(); for(const day of range.DAILY) for(const sid of Object.keys(day.bySid)) allSids.add(sid);
  const contacts=await fetchContacts(allSids);
  const rows=[];
  for(const day of range.DAILY){
    for(const [sid,sec] of Object.entries(day.bySid)){
      const st=range.STU_INFO[sid]||{}, c=contacts[sid]||{};
      rows.push({date:day.date, day:AR_DAYS[day.jsDay]||'', sec, acad:st.academic_number||'', name:st.full_name||'', c1:fmtPhone(c.c1), c2:fmtPhone(c.c2)});
    }
  }
  return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.sec.localeCompare(b.sec,'ar'));
}
async function buildStudentRows(range){
  const ids=Object.keys(range.perStudentAbsDays);
  const contacts=await fetchContacts(ids);
  const {data:enr}=await db.from('enrollments').select('student_id,sections(code)').is('to_date',null).in('student_id',ids);
  const secOf={}; for(const e of enr||[]) secOf[e.student_id]=e.sections?.code||'';
  return ids.map(sid=>{
    const st=range.STU_INFO[sid]||{}, c=contacts[sid]||{};
    const count=range.perStudentAbsDays[sid];
    return {acad:st.academic_number||'', name:st.full_name||'', sec:secOf[sid]||'', c1:fmtPhone(c.c1), c2:fmtPhone(c.c2),
      count, rate:(count/range.schoolDaysCount*100).toFixed(1)+'٪'};
  }).sort((a,b)=>b.count-a.count);
}
async function buildSectionRows(range){
  const {data:enr}=await db.from('enrollments').select('section_id,sections(code)').is('to_date',null);
  const enrolledCount={}; for(const e of enr||[]){ const c=e.sections?.code; if(c) enrolledCount[c]=(enrolledCount[c]||0)+1; }
  return Object.keys(range.perSectionAbsDays).map(sec=>{
    const absDays=range.perSectionAbsDays[sec], enrolled=enrolledCount[sec]||0;
    return {sec, enrolled, absDays, rate: enrolled?((absDays/(enrolled*range.schoolDaysCount)*100).toFixed(1)+'٪'):'—'};
  }).sort((a,b)=>b.absDays-a.absDays);
}
function buildDailyRows(range){
  return Object.entries(range.perDayAbsCount).sort(([a],[b])=>a.localeCompare(b))
    .map(([date,count])=>({date, day:AR_DAYS[new Date(date+'T12:00:00').getDay()]||'', count}));
}

function renderTable(){
  const fields=checkedFields();
  $('bCount').textContent = ROWS.length ? `${ROWS.length} صف — ${LEVELS[LEVEL].label}` : '';
  if(!ROWS.length || !fields.length){
    $('bTable').innerHTML = !fields.length ? '<tr><td style="padding:20px;text-align:center;color:#8a93a0">اختاري عموداً واحداً على الأقل</td></tr>'
      : '<tr><td style="padding:20px;text-align:center;color:#8a93a0">لا بيانات لهذه الفترة</td></tr>';
    return;
  }
  $('bTable').innerHTML =
    '<tr>'+fields.map(k=>`<th>${fieldLabel(k)}</th>`).join('')+'</tr>'+
    ROWS.map((r,i)=>'<tr>'+fields.map(k=>`<td class="${typeof r[k]==='number'||k==='acad'?'c':''}">${r[k]??''}</td>`).join('')+'</tr>').join('');
}

/* ============ تصدير إكسل (ExcelJS — منسّق فعلياً) ============ */
const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const border={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function exportXls(){
  const fields=checkedFields();
  if(!ROWS.length||!fields.length){ toast('ولّدي المعاينة أولاً واختاري أعمدة'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('التقرير',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,fields.length);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle(`${LEVELS[LEVEL].title} — من ${$('bFrom').value} إلى ${$('bTo').value}`,12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(fields.map(fieldLabel));
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=border; });
  ROWS.forEach((r,i)=>{
    const row=ws.addRow(fields.map(k=>r[k]??''));
    row.eachCell(c=>{ c.border=border; c.alignment={horizontal:'center'}; c.font={size:10.5};
      if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; c.numFmt='@'; });
  });
  ws.columns.forEach(c=>{ c.width=16; });
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:3}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`${LEVELS[LEVEL].title}_${$('bFrom').value}_${$('bTo').value}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

/* ============ تصدير PDF (طباعة المتصفح) ============ */
function exportPdf(){
  const fields=checkedFields();
  if(!ROWS.length||!fields.length){ toast('ولّدي المعاينة أولاً واختاري أعمدة'); return; }
  const rows=ROWS.map(r=>`<tr>${fields.map(k=>`<td>${r[k]??''}</td>`).join('')}</tr>`).join('');
  const footer=`<div class="bd-footer">${schoolName()} — طُبع بتاريخ ${dstr(new Date())}</div>`;
  $('printAreaBuilder').innerHTML = `
    <div class="bd-head"><h2>${LEVELS[LEVEL].title}</h2>
      <p>من ${$('bFrom').value} إلى ${$('bTo').value} — ${ROWS.length} صف</p></div>
    <table class="bd-tbl"><tr>${fields.map(k=>`<th>${fieldLabel(k)}</th>`).join('')}</tr>${rows}</table>${footer}`;
  printWithTitle(`${LEVELS[LEVEL].title}_${$('bFrom').value}_${$('bTo').value}`);
}

registerTab({id:'builderMain', label:'منشئ التقارير', group:'attendance', groupLabel:'متابعة الغياب',
  show:f=>f.isAdmin||f.isSocial||f.isReg||f.isLead||f.isAttendanceLead, onOpen:initBuilder});
