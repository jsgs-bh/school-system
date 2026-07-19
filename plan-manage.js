/* plan-manage.js — متابعة مشروعي (تحت مجموعة "الخطة الاستراتيجية")
   لمن لها صلاحية "مسؤولة مشروع" — تُقيَّد تلقائياً بمشروعها المحدد عبر
   staff_project_leads. تضيف/تعدّل مبادرات وإجراءات، تحدّث الحالة
   الثلاثية، وتطبع/تصدّر بنفس قالب موقع الخطة القديم. */
import { db, $, S, clean, toast, printWithTitle, printHeaderHtml, printFooterHtml, registerTab } from './core.js';

const MONTHS=[
  {id:'sep',label:'سبتمبر'},{id:'oct',label:'أكتوبر'},{id:'nov',label:'نوفمبر'},{id:'dec',label:'ديسمبر'},{id:'jan',label:'يناير'},
  {id:'feb',label:'فبراير'},{id:'mar',label:'مارس'},{id:'apr',label:'أبريل'},{id:'may',label:'مايو'},{id:'jun',label:'يونيو'},
];
const STATUS_LABEL={not_started:'لم يبدأ', in_progress:'جاري التنفيذ', done:'تم التنفيذ'};

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="planManage" style="display:none">
  <div class="panel">
    <h3>متابعة مشروعي</h3>
    <select id="pmProjectPick" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:220px"></select>
  </div>
  <div class="panel">
    <h3>إضافة إجراء جديد</h3>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <textarea id="pmNewText" placeholder="نص الإجراء" rows="2" style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;resize:vertical"></textarea>
      <div style="position:relative;min-width:180px">
        <input type="text" id="pmNewResp" placeholder="المسؤول (ابحثي عن منتسبة)" autocomplete="off" style="width:100%;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
        <div class="sugg" id="pmRespSugg"></div>
      </div>
      <select id="pmNewMonth" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)">
        ${MONTHS.map(m=>`<option value="${m.id}">${m.label}</option>`).join('')}
      </select>
      <button class="btn gold" id="pmAddBtn" style="width:auto;padding:9px 20px">إضافة</button>
    </div>
  </div>
  <div class="panel">
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <select id="pmFilterMonth"><option value="">كل الأشهر</option>${MONTHS.map(m=>`<option value="${m.id}">${m.label}</option>`).join('')}</select>
      <select id="pmFilterStatus"><option value="">كل الحالات</option>${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
    </div>
    <div class="actions" style="margin-bottom:14px">
      <button class="btn ghost" id="pmPrintMonth">🖨️ طباعة الشهر المحدَّد</button>
      <button class="btn ghost" id="pmPrintAll">🖨️ طباعة كل الأشهر</button>
      <button class="btn ghost" id="pmXls">⬇ تصدير Excel</button>
    </div>
    <div class="board-wrap"><table class="board" id="pmTable"></table></div>
  </div>
</div>
<div id="printAreaPM"></div>
<style>
  #planManage.wide{max-width:1500px}
  #planManage select{padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)}
  #pmTable select.pm-status{padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  #printAreaPM{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaPM, #printAreaPM *{visibility:visible}
    #printAreaPM{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
    .pm-tbl{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:14px}
    .pm-tbl th{background:#1a3a6b;color:#fff;padding:6px 5px}
    .pm-tbl td{border:1px solid #dee2e6;padding:5px;text-align:right}
    .pm-tbl tr.done td{background:#d8f3dc}
    .pm-tbl tr.in_progress td{background:#fff3cd}
    .pm-mhead{background:#f0faf5;border-right:3px solid #52b788;padding:5px 10px;font-weight:700;color:#2d6a4f;margin:10px 0 4px}
  }
</style>`);

let MY_PROJECTS=[], CUR_PROJECT=null, ROWS=[];

async function initManage(){
  if($('pmProjectPick').dataset.ready) return;
  $('pmProjectPick').dataset.ready='1';
  const {data:leads}=await db.from('staff_project_leads').select('project_id, plan_projects(id,name)').eq('staff_id',S.ME.id);
  MY_PROJECTS=(leads||[]).map(l=>l.plan_projects).filter(Boolean);
  if(!MY_PROJECTS.length){ $('pmProjectPick').innerHTML='<option value="">لا مشاريع مسنَدة لك بعد</option>'; return; }
  $('pmProjectPick').innerHTML=MY_PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  CUR_PROJECT=MY_PROJECTS[0];
  $('pmProjectPick').addEventListener('change',()=>{ CUR_PROJECT=MY_PROJECTS.find(p=>p.id===$('pmProjectPick').value); loadInitiatives(); });
  $('pmAddBtn').addEventListener('click',addInitiative);
  bindRespSearch();
  $('pmFilterMonth').addEventListener('change',render);
  $('pmFilterStatus').addEventListener('change',render);
  $('pmPrintMonth').addEventListener('click',()=>printPlan(false));
  $('pmPrintAll').addEventListener('click',()=>printPlan(true));
  $('pmXls').addEventListener('click',exportXls);
  await loadInitiatives();
}

async function loadInitiatives(){
  if(!CUR_PROJECT) return;
  const {data,error}=await db.from('plan_initiatives').select('*').eq('project_id',CUR_PROJECT.id).order('created_at');
  if(error){ toast('تعذر التحميل: '+error.message); return; }
  ROWS=data||[];
  render();
}

let PICKED_RESP_STAFF_ID=null;
function bindRespSearch(){
  const inp=$('pmNewResp'), box=$('pmRespSugg');
  let deb=null;
  inp.addEventListener('input',()=>{
    PICKED_RESP_STAFF_ID=null; // أي تعديل يدوي يلغي الربط السابق حتى تُختار منتسبة من جديد
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const q=inp.value.trim();
      if(q.length<2){ box.style.display='none'; return; }
      const {data:st}=await db.from('staff').select('id,full_name').ilike('full_name',`%${q}%`).limit(6);
      if(!(st||[]).length){ box.style.display='none'; return; }
      box.innerHTML=st.map((s,i)=>`<div data-i="${i}">${s.full_name}</div>`).join('');
      box.style.display='block';
      box.querySelectorAll('div').forEach((el,i)=>el.addEventListener('click',()=>{
        inp.value=st[i].full_name; PICKED_RESP_STAFF_ID=st[i].id; box.style.display='none';
      }));
    },250);
  });
}

async function addInitiative(){
  if(!CUR_PROJECT){ toast('لا مشروع محدَّد'); return; }
  const text=clean($('pmNewText').value);
  if(!text){ toast('اكتبي نص الإجراء'); return; }
  const resp=clean($('pmNewResp').value)||null;
  const month=$('pmNewMonth').value;
  const {error}=await db.from('plan_initiatives').insert({
    project_id:CUR_PROJECT.id, text, responsible:resp, responsible_staff_id:PICKED_RESP_STAFF_ID, month, status:'not_started', created_by:S.ME.id
  });
  if(error){ toast('تعذر الإضافة: '+error.message); return; }
  $('pmNewText').value=''; $('pmNewResp').value=''; PICKED_RESP_STAFF_ID=null;
  toast('تمت إضافة الإجراء');
  loadInitiatives();
}

function getFiltered(){
  const mf=$('pmFilterMonth').value, sf=$('pmFilterStatus').value;
  return ROWS.filter(r=>(!mf||r.month===mf) && (!sf||r.status===sf));
}

function render(){
  const rows=getFiltered();
  if(!rows.length){ $('pmTable').innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا إجراءات ضمن هذا الفلتر</td></tr>'; return; }
  const monthLabel=id=>MONTHS.find(m=>m.id===id)?.label||id;
  $('pmTable').innerHTML='<tr><th>الشهر</th><th>الإجراء</th><th>المسؤول</th><th>الحالة</th><th></th></tr>'+
    rows.map((r,i)=>`<tr data-i="${i}">
      <td class="c">${monthLabel(r.month)}</td>
      <td>${r.text}</td>
      <td class="c">${r.responsible||'—'}</td>
      <td><select class="pm-status" data-f="status">${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${r.status===k?'selected':''}>${v}</option>`).join('')}</select></td>
      <td><button class="btn ghost" data-del="${i}" style="width:auto;padding:6px 12px;font-size:11px;color:var(--err);border-color:var(--err)">✕ حذف</button></td>
    </tr>`).join('');
  $('pmTable').querySelectorAll('select[data-f]').forEach(sel=>sel.addEventListener('change', async ()=>{
    const tr=sel.closest('tr'); const i=+tr.dataset.i; const r=rows[i];
    const {error}=await db.from('plan_initiatives').update({status:sel.value, updated_at:new Date().toISOString()}).eq('id',r.id);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    r.status=sel.value; toast('تم الحفظ');
  }));
  $('pmTable').querySelectorAll('button[data-del]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('حذف هذا الإجراء؟')) return;
    const r=rows[+b.dataset.del];
    await db.from('plan_initiatives').delete().eq('id',r.id);
    toast('تم الحذف'); loadInitiatives();
  }));
}

/* ============ الطباعة (مطابقة لقالب موقع الخطة القديم) ============ */
function printPlan(allMonths){
  if(!CUR_PROJECT || !ROWS.length){ toast('لا إجراءات لهذا المشروع بعد'); return; }
  const monthsToShow = allMonths ? MONTHS : MONTHS.filter(m=>m.id===$('pmFilterMonth').value || (!$('pmFilterMonth').value));
  let body='';
  const list = allMonths ? MONTHS : (($('pmFilterMonth').value ? MONTHS.filter(m=>m.id===$('pmFilterMonth').value) : MONTHS));
  list.forEach(m=>{
    const inits=ROWS.filter(r=>r.month===m.id);
    if(!inits.length) return;
    const done=inits.filter(r=>r.status==='done').length;
    body+=`<div class="pm-mhead">📅 ${m.label} (${done}/${inits.length} منجز)</div>
      <table class="pm-tbl"><tr><th>#</th><th>الإجراء</th><th>المنفذون</th><th>الحالة</th></tr>
      ${inits.map((r,n)=>`<tr class="${r.status}"><td>${n+1}</td><td>${r.text}</td><td>${r.responsible||'-'}</td><td>${STATUS_LABEL[r.status]}</td></tr>`).join('')}
      </table>`;
  });
  $('printAreaPM').innerHTML=`
    ${printHeaderHtml(`الخطة التنفيذية — ${CUR_PROJECT.name}`)}
    ${body}
    ${printFooterHtml('رئيسة المشروع', S.ME.full_name)}`;
  printWithTitle(`الخطة_${CUR_PROJECT.name}`,'printAreaPM');
}

/* ============ تصدير Excel ============ */
async function exportXls(){
  if(!CUR_PROJECT || !ROWS.length){ toast('لا إجراءات لهذا المشروع بعد'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(CUR_PROJECT.name.substring(0,28),{views:[{rightToLeft:true}]});
  const NAVY='FF1A3A6B', WHITE='FFFFFFFF', DONE='FFD8F3DC', PROG='FFFFF3CD';
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,4);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'}; if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(CUR_PROJECT.name,14,true,NAVY,WHITE);
  addTitle(S.SETTINGS.school_name||'المدرسة',11,false,null,'FF444444');
  ws.addRow([]);
  MONTHS.forEach(m=>{
    const inits=ROWS.filter(r=>r.month===m.id);
    if(!inits.length) return;
    const done=inits.filter(r=>r.status==='done').length;
    const mrow=ws.addRow([`📅 ${m.label}`,'','',`${done}/${inits.length} منجز`]);
    mrow.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1D4ED8'}}; c.alignment={horizontal:'center'}; });
    const hdr=ws.addRow(['#','الإجراء','المسؤول','الحالة']);
    hdr.eachCell(c=>{ c.font={bold:true}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD0E8D8'}}; c.alignment={horizontal:'center'}; });
    inits.forEach((r,n)=>{
      const bg = r.status==='done'?DONE : r.status==='in_progress'?PROG : 'FFFFFFFF';
      const row=ws.addRow([n+1, r.text, r.responsible||'-', STATUS_LABEL[r.status]]);
      row.eachCell((c,colNo)=>{ c.alignment={horizontal:colNo===2?'right':'center'}; c.font={size:10}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}}; });
    });
    ws.addRow([]);
  });
  ws.columns=[{width:6},{width:55},{width:30},{width:16}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`الخطة_${CUR_PROJECT.name}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

registerTab({id:'planManage', label:'متابعة مشروعي', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:f=>f.isProjectLead, init:initManage});
