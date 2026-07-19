/* plan-department.js — الخطة التشغيلية (تحت مجموعة "الخطة الاستراتيجية")
   للمعلمة الأولى: تضيف/تعدّل إجراءات ومبادرات خاصة بقسمها فقط (تُوسَم
   تلقائياً بقسمها عبر department_id)، عبر أي مشروع تختاره من القائمة.
   منفصلة تماماً عن "متابعة مشروعي" و"اللجان" — كل واحد بتبويبه. */
import { db, $, S, clean, toast, printWithTitle, printHeaderHtml, printFooterHtml, registerTab } from './core.js';

const MONTHS=[
  {id:'sep',label:'سبتمبر'},{id:'oct',label:'أكتوبر'},{id:'nov',label:'نوفمبر'},{id:'dec',label:'ديسمبر'},{id:'jan',label:'يناير'},
  {id:'feb',label:'فبراير'},{id:'mar',label:'مارس'},{id:'apr',label:'أبريل'},{id:'may',label:'مايو'},{id:'jun',label:'يونيو'},
];
const STATUS_LABEL={not_started:'لم يبدأ', in_progress:'جاري التنفيذ', done:'تم التنفيذ'};

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="planDept" style="display:none">
  <div class="panel">
    <h3>الخطة التشغيلية — <span id="pdDeptName">—</span></h3>
    <div class="sub">كل إجراء تضيفينه هنا يُوسَم تلقائياً بقسمك، بغض النظر عن أي مشروع تختارينه له.</div>
  </div>
  <div class="panel">
    <h3>إضافة إجراء / مبادرة</h3>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <select id="pdProjectPick" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:180px"></select>
      <textarea id="pdNewText" placeholder="نص الإجراء" rows="2" style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;resize:vertical"></textarea>
      <div style="position:relative;min-width:180px">
        <input type="text" id="pdNewResp" placeholder="المسؤولة (ابحثي)" autocomplete="off" style="width:100%;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
        <div class="sugg" id="pdRespSugg"></div>
      </div>
      <select id="pdNewMonth" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)">
        ${MONTHS.map(m=>`<option value="${m.id}">${m.label}</option>`).join('')}
      </select>
      <button class="btn gold" id="pdAddBtn" style="width:auto;padding:9px 20px">إضافة</button>
    </div>
  </div>
  <div class="panel">
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <select id="pdFilterProject"><option value="">كل المشاريع</option></select>
      <select id="pdFilterMonth"><option value="">كل الأشهر</option>${MONTHS.map(m=>`<option value="${m.id}">${m.label}</option>`).join('')}</select>
      <select id="pdFilterStatus"><option value="">كل الحالات</option>${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
    </div>
    <div class="actions" style="margin-bottom:14px">
      <button class="btn ghost" id="pdPrintByProject">🖨️ طباعة خطة القسم حسب المشاريع</button>
      <button class="btn ghost" id="pdPrintFlow">🖨️ طباعة الخطة التدفقية للقسم</button>
    </div>
    <div class="board-wrap"><table class="board" id="pdTable"></table></div>
  </div>
</div>
<div id="printAreaPD"></div>
<style>
  #planDept.wide{max-width:1500px}
  #planDept select{padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)}
  #pdTable select.pd-status{padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  #printAreaPD{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaPD, #printAreaPD *{visibility:visible}
    #printAreaPD{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
    .pd-tbl{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:14px}
    .pd-tbl th{background:#1a3a6b;color:#fff;padding:6px 5px}
    .pd-tbl td{border:1px solid #dee2e6;padding:5px;text-align:right}
    .pd-tbl tr.done td{background:#d8f3dc}
    .pd-tbl tr.in_progress td{background:#fff3cd}
    .pd-head2{background:#1a3a6b;color:#fff;padding:6px 10px;font-weight:700;margin-top:14px}
    .pd-mhead{background:#f0faf5;border-right:3px solid #52b788;padding:4px 10px;font-weight:700;color:#2d6a4f;margin:8px 0 3px;font-size:11px}
  }
</style>`);

let PROJECTS=[], ROWS=[], PICKED_RESP_STAFF_ID=null;

async function initDept(){
  if($('pdAddBtn').dataset.ready) return;
  $('pdAddBtn').dataset.ready='1';
  $('pdDeptName').textContent = S.ME.departments?.name || '—';
  const {data:projects}=await db.from('plan_projects').select('id,name').eq('academic_year_id',S.YEAR.id).order('sort_order');
  PROJECTS=projects||[];
  $('pdProjectPick').innerHTML='<option value="">اختاري المشروع…</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  $('pdFilterProject').innerHTML='<option value="">كل المشاريع</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  bindRespSearch();
  $('pdAddBtn').addEventListener('click',addInitiative);
  $('pdFilterProject').addEventListener('change',render);
  $('pdFilterMonth').addEventListener('change',render);
  $('pdFilterStatus').addEventListener('change',render);
  $('pdPrintByProject').addEventListener('click',printByProject);
  $('pdPrintFlow').addEventListener('click',printFlow);
  await loadInitiatives();
}

function bindRespSearch(){
  const inp=$('pdNewResp'), box=$('pdRespSugg');
  let deb=null;
  inp.addEventListener('input',()=>{
    PICKED_RESP_STAFF_ID=null;
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

async function loadInitiatives(){
  if(!S.ME.department_id){ $('pdTable').innerHTML='<tr><td style="padding:20px;text-align:center;color:#8a93a0">حسابك غير مرتبط بقسم — راجعي الدعم الفني</td></tr>'; return; }
  const {data,error}=await db.from('plan_initiatives').select('*, plan_projects(name)').eq('department_id',S.ME.department_id).order('created_at');
  if(error){ toast('تعذر التحميل: '+error.message); return; }
  ROWS=(data||[]).map(r=>({...r, projectName:r.plan_projects?.name||'—'}));
  render();
}

async function addInitiative(){
  const projectId=$('pdProjectPick').value;
  if(!projectId){ toast('اختاري المشروع'); return; }
  if(!S.ME.department_id){ toast('حسابك غير مرتبط بقسم'); return; }
  const text=clean($('pdNewText').value);
  if(!text){ toast('اكتبي نص الإجراء'); return; }
  const resp=clean($('pdNewResp').value)||null;
  const month=$('pdNewMonth').value;
  const {error}=await db.from('plan_initiatives').insert({
    project_id:projectId, text, responsible:resp, responsible_staff_id:PICKED_RESP_STAFF_ID,
    department_id:S.ME.department_id, month, status:'not_started', created_by:S.ME.id
  });
  if(error){ toast('تعذر الإضافة: '+error.message); return; }
  $('pdNewText').value=''; $('pdNewResp').value=''; $('pdProjectPick').value=''; PICKED_RESP_STAFF_ID=null;
  toast('تمت الإضافة'); loadInitiatives();
}

function getFiltered(){
  const pf=$('pdFilterProject').value, mf=$('pdFilterMonth').value, sf=$('pdFilterStatus').value;
  return ROWS.filter(r=>(!pf||r.project_id===pf) && (!mf||r.month===mf) && (!sf||r.status===sf));
}

function render(){
  const rows=getFiltered();
  if(!rows.length){ $('pdTable').innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا إجراءات ضمن هذا الفلتر</td></tr>'; return; }
  const monthLabel=id=>MONTHS.find(m=>m.id===id)?.label||id;
  $('pdTable').innerHTML='<tr><th>المشروع</th><th>الشهر</th><th>الإجراء</th><th>المسؤولة</th><th>الحالة</th><th></th></tr>'+
    rows.map((r,i)=>`<tr data-i="${i}">
      <td class="c">${r.projectName}</td>
      <td class="c">${monthLabel(r.month)}</td>
      <td>${r.text}</td>
      <td class="c">${r.responsible||'—'}</td>
      <td><select class="pd-status" data-f="status">${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${r.status===k?'selected':''}>${v}</option>`).join('')}</select></td>
      <td><button class="btn ghost" data-del="${i}" style="width:auto;padding:6px 12px;font-size:11px;color:var(--err);border-color:var(--err)">✕ حذف</button></td>
    </tr>`).join('');
  $('pdTable').querySelectorAll('select[data-f]').forEach(sel=>sel.addEventListener('change', async ()=>{
    const tr=sel.closest('tr'); const i=+tr.dataset.i; const r=rows[i];
    const {error}=await db.from('plan_initiatives').update({status:sel.value, updated_at:new Date().toISOString()}).eq('id',r.id);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    r.status=sel.value; toast('تم الحفظ');
  }));
  $('pdTable').querySelectorAll('button[data-del]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('حذف هذا الإجراء؟')) return;
    const r=rows[+b.dataset.del];
    await db.from('plan_initiatives').delete().eq('id',r.id);
    toast('تم الحذف'); loadInitiatives();
  }));
}

/* ============ الطباعة ============ */
function printByProject(){
  if(!ROWS.length){ toast('لا إجراءات بعد'); return; }
  const byProject={};
  for(const r of ROWS) (byProject[r.project_id] ??= {name:r.projectName, items:[]}).items.push(r);
  let body='';
  Object.values(byProject).forEach(g=>{
    body+=`<div class="pd-head2">📁 ${g.name}</div>
      <table class="pd-tbl"><tr><th>#</th><th>الشهر</th><th>الإجراء</th><th>المسؤولة</th><th>الحالة</th></tr>
      ${g.items.map((r,n)=>`<tr class="${r.status}"><td>${n+1}</td><td>${MONTHS.find(m=>m.id===r.month)?.label||r.month}</td><td>${r.text}</td><td>${r.responsible||'-'}</td><td>${STATUS_LABEL[r.status]}</td></tr>`).join('')}
      </table>`;
  });
  $('printAreaPD').innerHTML=`
    ${printHeaderHtml(`الخطة التشغيلية — قسم ${S.ME.departments?.name||''} (حسب المشاريع)`)}
    ${body}
    ${printFooterHtml('المعلمة الأولى', S.ME.full_name)}`;
  printWithTitle(`الخطة_التشغيلية_${S.ME.departments?.name||''}`,'printAreaPD');
}

function printFlow(){
  if(!ROWS.length){ toast('لا إجراءات بعد'); return; }
  let body='';
  MONTHS.forEach(m=>{
    const inMonth=ROWS.filter(r=>r.month===m.id);
    if(!inMonth.length) return;
    body+=`<div class="pd-mhead">📅 ${m.label}</div>
      <table class="pd-tbl"><tr><th>#</th><th>المشروع</th><th>الإجراء</th><th>المسؤولة</th><th>الحالة</th></tr>
      ${inMonth.map((r,n)=>`<tr class="${r.status}"><td>${n+1}</td><td>${r.projectName}</td><td>${r.text}</td><td>${r.responsible||'-'}</td><td>${STATUS_LABEL[r.status]}</td></tr>`).join('')}
      </table>`;
  });
  $('printAreaPD').innerHTML=`
    ${printHeaderHtml(`الخطة التدفقية — قسم ${S.ME.departments?.name||''}`)}
    ${body}
    ${printFooterHtml('المعلمة الأولى', S.ME.full_name)}`;
  printWithTitle(`الخطة_التدفقية_${S.ME.departments?.name||''}`,'printAreaPD');
}

registerTab({id:'planDept', label:'الخطة التشغيلية', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:f=>f.isSeniorTeacher||f.isAdmin, init:initDept});
