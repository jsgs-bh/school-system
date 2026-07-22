/* plan-oversight.js — متابعة الخطة الشاملة (تحت مجموعة "الخطة الاستراتيجية")
   لرئيسة متابعة الخطة الاستراتيجية / الأدمن / القيادة العليا: كل
   إجراءات المدرسة (plan_actions)، فرز، نسب الإنجاز بالفصل والشهر
   والمشروع والقسم، وطباعة/تصدير الخطة كاملة. */
import { db, $, S, toast, printWithTitle, printHeaderHtml, printFooterHtml, registerTab } from './core.js';

const MONTHS=[
  {id:'sep',label:'سبتمبر',sem:1},{id:'oct',label:'أكتوبر',sem:1},{id:'nov',label:'نوفمبر',sem:1},{id:'dec',label:'ديسمبر',sem:1},{id:'jan',label:'يناير',sem:1},
  {id:'feb',label:'فبراير',sem:2},{id:'mar',label:'مارس',sem:2},{id:'apr',label:'أبريل',sem:2},{id:'may',label:'مايو',sem:2},{id:'jun',label:'يونيو',sem:2},
];
const STATUS_LABEL={not_started:'لم يبدأ', in_progress:'جاري التنفيذ', done:'تم التنفيذ'};

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="planOversight" style="display:none">
  <div class="stats" id="poKpis"></div>
  <div class="panel">
    <h3>نسبة الإنجاز حسب الفصل الدراسي</h3>
    <div class="stats" id="poSemesters"></div>
  </div>
  <div class="panel">
    <h3>نسبة الإنجاز الشهرية</h3>
    <div id="poMonthly"></div>
  </div>
  <div class="panel">
    <h3>نسبة إنجاز كل مشروع</h3>
    <div id="poProjects"></div>
  </div>
  <div class="panel">
    <h3>نسبة الإنجاز حسب القسم</h3>
    <div class="sub">تُحسب فقط من الإجراءات المرتبطة بمنتسبة محددة عبر حقل "المسؤول".</div>
    <div id="poDepartments"></div>
  </div>
  <div class="panel">
    <h3>قائمة الإجراءات — فرز وتصفية</h3>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <select id="poFilterProject"><option value="">كل المشاريع</option></select>
      <select id="poFilterMonth"><option value="">كل الأشهر</option>${MONTHS.map(m=>`<option value="${m.id}">${m.label}</option>`).join('')}</select>
      <select id="poFilterStatus"><option value="">كل الحالات</option>${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
    </div>
    <div class="actions" style="margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <select id="poPrintMonth"><option value="">كل الأشهر</option>${MONTHS.map(m=>`<option value="${m.id}">${m.label}</option>`).join('')}</select>
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--navy);cursor:pointer"><input type="checkbox" id="poBlankStatus"> عمود حالة فاضٍ (للتعبئة اليدوية)</label>
      <button class="btn ghost" id="poPrint">🖨️ طباعة</button>
      <button class="btn ghost" id="poXls">⬇ تصدير Excel (كل المشاريع)</button>
    </div>
    <div class="board-wrap"><table class="board" id="poTable"></table></div>
  </div>
</div>
<div id="printAreaPO"></div>
<style>
  #planOversight.wide{max-width:1600px}
  #planOversight select{padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)}
  #poTable select.po-status{padding:6px 8px;font-size:12px;background:#fbfaf7}
  .po-bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .po-bar-label{min-width:110px;font-size:12.5px;color:var(--navy);font-weight:600}
  .po-bar-track{flex:1;height:9px;background:#e9ecef;border-radius:5px;overflow:hidden}
  .po-bar-fill{height:100%;border-radius:5px}
  .po-bar-pct{min-width:70px;font-size:12px;font-weight:700;color:var(--navy);text-align:left}
  #printAreaPO{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaPO, #printAreaPO *{visibility:visible}
    #printAreaPO{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
    .po-tbl{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px}
    .po-tbl th{background:#1a3a6b;color:#fff;padding:5px}
    .po-tbl td{border:1px solid #dee2e6;padding:4px;text-align:right}
    .po-tbl tr.done td{background:#d8f3dc}
    .po-tbl tr.in_progress td{background:#fff3cd}
    .po-mhead{background:#f0faf5;border-right:3px solid #52b788;padding:4px 10px;font-weight:700;color:#2d6a4f;margin:8px 0 3px;font-size:11px}
    .po-phead{background:#1a3a6b;color:#fff;padding:6px 10px;font-weight:700;margin-top:14px}
  }
</style>`);

let ALL=[], PROJECTS=[];

async function initOversight(){
  if($('poFilterProject').dataset.ready) return;
  $('poFilterProject').dataset.ready='1';
  $('poFilterProject').addEventListener('change',renderTable);
  $('poFilterMonth').addEventListener('change',renderTable);
  $('poFilterStatus').addEventListener('change',renderTable);
  $('poPrint').addEventListener('click',printWhole);
  $('poXls').addEventListener('click',exportXls);
  await loadAll();
}

async function loadAll(){
  const {data:projects}=await db.from('plan_projects').select('id,name,sort_order').eq('academic_year_id',S.YEAR.id).order('sort_order');
  PROJECTS=projects||[];
  $('poFilterProject').innerHTML='<option value="">كل المشاريع</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  const projectIds=PROJECTS.map(p=>p.id);
  if(!projectIds.length){ ALL=[]; renderAll(); return; }

  const {data:initiatives}=await db.from('plan_initiatives').select('id,name,project_id').in('project_id',projectIds);
  const initIds=(initiatives||[]).map(i=>i.id);
  const initById={}; for(const i of initiatives||[]) initById[i.id]=i;
  const projById={}; for(const p of PROJECTS) projById[p.id]=p;

  const {data:actions} = initIds.length ? await db.from('plan_actions').select('*').in('initiative_id',initIds) : {data:[]};
  ALL=(actions||[]).map(a=>{
    const init=initById[a.initiative_id];
    const proj=init?projById[init.project_id]:null;
    return {...a, initName:init?.name||'—', project_id:init?.project_id, projectName:proj?.name||'—'};
  });

  const staffIds=[...new Set(ALL.map(a=>a.responsible_staff_id).filter(Boolean))];
  if(staffIds.length){
    const {data:staffRows}=await db.from('staff').select('id, departments(name)').in('id',staffIds);
    const deptByStaff={}; for(const s of staffRows||[]) deptByStaff[s.id]=s.departments?.name||null;
    for(const a of ALL) a.deptName = a.responsible_staff_id ? deptByStaff[a.responsible_staff_id] : null;
  }
  renderAll();
}

function renderAll(){
  renderKpis(); renderSemesters(); renderMonthly(); renderProjects(); renderDepartments(); renderTable();
}

function pct(arr){ return arr.length ? Math.round(arr.filter(a=>a.status==='done').length/arr.length*100) : 0; }
function barColor(p){ return p>=80?'#2f9e44':p>=50?'#f0b429':'#e63946'; }

function renderKpis(){
  const total=ALL.length, done=ALL.filter(a=>a.status==='done').length, inprog=ALL.filter(a=>a.status==='in_progress').length;
  $('poKpis').innerHTML=`
    <div class="stat"><b>${total}</b><span>إجمالي الإجراءات</span></div>
    <div class="stat green"><b>${done}</b><span>تم التنفيذ</span></div>
    <div class="stat"><b>${inprog}</b><span>جاري التنفيذ</span></div>
    <div class="stat red"><b>${total-done-inprog}</b><span>لم يبدأ</span></div>
    <div class="stat"><b>${pct(ALL)}٪</b><span>نسبة الإنجاز الكلية</span></div>
    <div class="stat"><b>${PROJECTS.length}</b><span>المشاريع</span></div>`;
}

function renderSemesters(){
  const sem1=ALL.filter(a=>MONTHS.find(m=>m.id===a.month)?.sem===1);
  const sem2=ALL.filter(a=>MONTHS.find(m=>m.id===a.month)?.sem===2);
  $('poSemesters').innerHTML=`
    <div class="stat"><b>${pct(sem1)}٪</b><span>الفصل الأول (${sem1.filter(a=>a.status==='done').length}/${sem1.length})</span></div>
    <div class="stat"><b>${pct(sem2)}٪</b><span>الفصل الثاني (${sem2.filter(a=>a.status==='done').length}/${sem2.length})</span></div>`;
}

function renderMonthly(){
  $('poMonthly').innerHTML=MONTHS.map(m=>{
    const inMonth=ALL.filter(a=>a.month===m.id);
    if(!inMonth.length) return '';
    const p=pct(inMonth);
    return `<div class="po-bar-row"><div class="po-bar-label">${m.label}</div>
      <div class="po-bar-track"><div class="po-bar-fill" style="width:${p}%;background:${barColor(p)}"></div></div>
      <div class="po-bar-pct">${p}٪ (${inMonth.filter(a=>a.status==='done').length}/${inMonth.length})</div></div>`;
  }).join('') || '<div class="empty-day">لا بيانات بعد.</div>';
}

function renderProjects(){
  $('poProjects').innerHTML=PROJECTS.map(p=>{
    const inits=ALL.filter(a=>a.project_id===p.id);
    if(!inits.length) return '';
    const pc=pct(inits);
    return `<div class="po-bar-row"><div class="po-bar-label" style="min-width:200px">${p.name}</div>
      <div class="po-bar-track"><div class="po-bar-fill" style="width:${pc}%;background:${barColor(pc)}"></div></div>
      <div class="po-bar-pct">${pc}٪ (${inits.filter(a=>a.status==='done').length}/${inits.length})</div></div>`;
  }).join('') || '<div class="empty-day">لا بيانات بعد.</div>';
}

function renderDepartments(){
  const linked=ALL.filter(a=>a.deptName);
  if(!linked.length){ $('poDepartments').innerHTML='<div class="empty-day">لا إجراءات مرتبطة بمنتسبة محددة بعد.</div>'; return; }
  const depts=[...new Set(linked.map(a=>a.deptName))];
  $('poDepartments').innerHTML=depts.map(d=>{
    const inits=linked.filter(a=>a.deptName===d);
    const p=pct(inits);
    return `<div class="po-bar-row"><div class="po-bar-label" style="min-width:160px">${d}</div>
      <div class="po-bar-track"><div class="po-bar-fill" style="width:${p}%;background:${barColor(p)}"></div></div>
      <div class="po-bar-pct">${p}٪ (${inits.filter(a=>a.status==='done').length}/${inits.length})</div></div>`;
  }).join('');
}

function getFiltered(){
  const pf=$('poFilterProject').value, mf=$('poFilterMonth').value, sf=$('poFilterStatus').value;
  return ALL.filter(a=>(!pf||a.project_id===pf) && (!mf||a.month===mf) && (!sf||a.status===sf));
}

function renderTable(){
  const rows=getFiltered();
  if(!rows.length){ $('poTable').innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا نتائج ضمن هذا الفلتر</td></tr>'; return; }
  const monthLabel=id=>MONTHS.find(m=>m.id===id)?.label||id;
  $('poTable').innerHTML='<tr><th>المشروع</th><th>المبادرة</th><th>الشهر</th><th>الإجراء</th><th>المسؤول</th><th>الحالة</th></tr>'+
    rows.map((r,i)=>`<tr data-i="${i}"><td class="c">${r.projectName}</td><td class="c">${r.initName}</td><td class="c">${monthLabel(r.month)}</td><td>${r.text}</td><td class="c">${r.responsible||'—'}</td>
      <td><select class="po-status" data-f="status">${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${r.status===k?'selected':''}>${v}</option>`).join('')}</select></td></tr>`).join('');
  $('poTable').querySelectorAll('select[data-f]').forEach(sel=>sel.addEventListener('change', async ()=>{
    const tr=sel.closest('tr'); const i=+tr.dataset.i; const r=rows[i];
    const {error}=await db.from('plan_actions').update({status:sel.value, updated_at:new Date().toISOString()}).eq('id',r.id);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    r.status=sel.value;
    const master=ALL.find(a=>a.id===r.id); if(master) master.status=sel.value;
    toast('تم الحفظ');
    renderKpis(); renderSemesters(); renderMonthly(); renderProjects();
  }));
}

/* ============ طباعة الخطة كاملة ============ */
function printWhole(){
  if(!ALL.length){ toast('لا بيانات للطباعة بعد'); return; }
  const monthFilter=$('poPrintMonth').value;
  const blank=$('poBlankStatus').checked;
  PROJECTS.forEach(()=>{});
  let body='';
  PROJECTS.forEach(p=>{
    const projActions=ALL.filter(a=>a.project_id===p.id && (!monthFilter||a.month===monthFilter));
    if(!projActions.length) return;
    body+=`<div class="po-phead">📁 ${p.name}${blank?'':` — ${pct(projActions)}٪ منجز`}</div>`;
    const monthsToUse = monthFilter ? MONTHS.filter(m=>m.id===monthFilter) : MONTHS;
    monthsToUse.forEach(m=>{
      const monthActions=projActions.filter(a=>a.month===m.id);
      if(!monthActions.length) return;
      body+=`<div class="po-mhead">📅 ${m.label}</div>
        <table class="po-tbl"><tr><th>#</th><th>المبادرة</th><th>الإجراء</th><th>المسؤول</th><th>الحالة</th></tr>
        ${monthActions.map((a,n)=>`<tr class="${blank?'':a.status}"><td>${n+1}</td><td>${a.initName}</td><td>${a.text}</td><td>${a.responsible||'-'}</td><td>${blank?'':STATUS_LABEL[a.status]}</td></tr>`).join('')}
        </table>`;
    });
  });
  const titleSuffix = monthFilter ? ` — ${MONTHS.find(m=>m.id===monthFilter)?.label}` : ' — كل المشاريع';
  $('printAreaPO').innerHTML=`
    ${printHeaderHtml(`الخطة التنفيذية الشاملة${titleSuffix}`)}
    ${body}
    ${printFooterHtml('رئيسة متابعة الخطة الاستراتيجية', S.ME.full_name)}`;
  printWithTitle('الخطة_الشاملة','printAreaPO');
}

/* ============ تصدير Excel ============ */
async function exportXls(){
  if(!ALL.length){ toast('لا بيانات للتصدير بعد'); return; }
  const wb=new ExcelJS.Workbook();
  const NAVY='FF1A3A6B', WHITE='FFFFFFFF', DONE='FFD8F3DC', PROG='FFFFF3CD';

  const sum=wb.addWorksheet('الملخص العام',{views:[{rightToLeft:true}]});
  const addTitle=(ws,text,size,bold,fill,color,cols)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,cols);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'}; if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(sum,'ملخص الخطة التنفيذية — '+(S.SETTINGS.school_name||'المدرسة'),13,true,NAVY,WHITE,6);
  sum.addRow([]);
  const shdr=sum.addRow(['المشروع','إجمالي الإجراءات','تم','جاري','لم يبدأ','نسبة الإنجاز']);
  shdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; });
  PROJECTS.forEach(p=>{
    const inits=ALL.filter(a=>a.project_id===p.id);
    const done=inits.filter(a=>a.status==='done').length, prog=inits.filter(a=>a.status==='in_progress').length;
    const row=sum.addRow([p.name, inits.length, done, prog, inits.length-done-prog, pct(inits)+'٪']);
    row.eachCell((c,colNo)=>{ c.alignment={horizontal:colNo===1?'right':'center'}; c.font={size:10.5}; });
  });
  sum.columns=[{width:35},{width:16},{width:10},{width:10},{width:10},{width:14}];

  PROJECTS.forEach(p=>{
    const inits=ALL.filter(a=>a.project_id===p.id);
    if(!inits.length) return;
    const ws=wb.addWorksheet(p.name.substring(0,28),{views:[{rightToLeft:true}]});
    addTitle(ws,p.name,13,true,NAVY,WHITE,5);
    ws.addRow([]);
    MONTHS.forEach(m=>{
      const monthActions=inits.filter(a=>a.month===m.id);
      if(!monthActions.length) return;
      const mrow=ws.addRow([`📅 ${m.label}`]); ws.mergeCells(mrow.number,1,mrow.number,5);
      mrow.getCell(1).font={bold:true,color:{argb:WHITE}}; mrow.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1D4ED8'}}; mrow.getCell(1).alignment={horizontal:'center'};
      const hdr=ws.addRow(['#','المبادرة','الإجراء','المسؤول','الحالة']);
      hdr.eachCell(c=>{ c.font={bold:true}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD0E8D8'}}; c.alignment={horizontal:'center'}; });
      monthActions.forEach((a,n)=>{
        const bg = a.status==='done'?DONE : a.status==='in_progress'?PROG : 'FFFFFFFF';
        const row=ws.addRow([n+1, a.initName, a.text, a.responsible||'-', STATUS_LABEL[a.status]]);
        row.eachCell((c,colNo)=>{ c.alignment={horizontal:colNo===3?'right':'center'}; c.font={size:10}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}}; });
      });
      ws.addRow([]);
    });
    ws.columns=[{width:6},{width:26},{width:45},{width:26},{width:16}];
  });

  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='الخطة_التنفيذية_الشاملة.xlsx'; a.click();
  URL.revokeObjectURL(url);
}

registerTab({id:'planOversight', label:'متابعة الخطة الشاملة', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:f=>f.isAdmin||f.isLead||f.isStrategicPlanLead, init:initOversight});
