/* plan-department.js — الخطة التشغيلية (تحت مجموعة "الخطة الاستراتيجية")
   للمعلمة الأولى: مبادرات في أي مشروع، وكل مبادرة لها إجراءات متعددة
   بتوقيتها وحالتها الخاصة، مُوسَمة تلقائياً بقسمها. */
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
    <h3>المبادرة</h3>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <select id="pdProjectPick" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:180px"></select>
      <select id="pdInitPick" style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)"><option value="">اختاري مبادرة من هذا المشروع…</option></select>
      <span style="color:#8a93a0;font-size:13px">أو</span>
      <input type="text" id="pdNewInitName" placeholder="اسم مبادرة جديدة" style="min-width:180px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      <button class="btn gold" id="pdNewInitBtn" style="width:auto;padding:9px 20px">إنشاء</button>
    </div>
  </div>

  <div class="panel" id="pdActionsPanel" style="display:none">
    <h3>إضافة إجراء / إجراءات — <span id="pdCurInitName" style="color:var(--gold)">—</span></h3>
    <div class="sub">سطر واحد في مربع النص = إجراء واحد مستقل بتوقيته وحالته الخاصة.</div>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <textarea id="pdNewText" placeholder="نص الإجراء — سطر واحد = إجراء واحد" rows="2" style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;resize:vertical"></textarea>
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

  <div class="panel" id="pdMergePanel" style="display:none">
    <h3>دمج مبادرات مكرَّرة (ضمن المشروع المختار أعلاه)</h3>
    <div class="sub">لو عندك عدة "مبادرات" فعلياً كلها إجراءات تابعة لنفس المبادرة الحقيقية، اختاريها هنا وادمجيها في واحدة.</div>
    <div class="field"><label>المبادرة المستهدفة</label><select id="pdMergeTarget"></select></div>
    <div class="field"><label>المبادرات المطلوب دمجها فيها</label>
      <select id="pdMergeSources" multiple size="6" style="width:100%;padding:8px;border:1.5px solid var(--line);border-radius:8px;font:inherit"></select>
    </div>
    <button class="btn ghost" id="pdMergeBtn" style="width:auto;padding:9px 20px;color:var(--err);border-color:var(--err)">دمج المحدَّد في المبادرة المستهدفة</button>
  </div>

  <div class="panel">
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <select id="pdFilterProject"><option value="">كل المشاريع</option></select>
      <select id="pdFilterMonth"><option value="">كل الأشهر</option>${MONTHS.map(m=>`<option value="${m.id}">${m.label}</option>`).join('')}</select>
      <select id="pdFilterStatus"><option value="">كل الحالات</option>${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
      <button class="btn ghost" id="pdToggleMerge" style="width:auto;padding:9px 20px;margin-inline-start:auto">دمج مبادرات مكرَّرة</button>
    </div>
    <div class="actions" style="margin-bottom:14px">
      <button class="btn ghost" id="pdPrintByProject">🖨️ طباعة خطة القسم حسب المشاريع</button>
      <button class="btn ghost" id="pdPrintFlow">🖨️ طباعة الخطة التدفقية للقسم</button>
    </div>
    <div id="pdGroups"></div>
  </div>
</div>
<div id="printAreaPD"></div>
<style>
  #planDept.wide{max-width:1500px}
  #planDept select{padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)}
  .pd-init-group{background:var(--white);border:1px solid var(--line);border-radius:11px;margin-bottom:12px;overflow:hidden}
  .pd-init-head{padding:10px 16px;background:var(--sand);font-weight:700;color:var(--navy);display:flex;justify-content:space-between;align-items:center}
  .pd-action-row{display:flex;gap:10px;align-items:center;padding:8px 16px;border-bottom:1px solid #f2f0ea;flex-wrap:wrap}
  .pd-action-row:last-child{border-bottom:none}
  .pd-action-text{flex:1;min-width:200px;font-size:13px;color:var(--ink)}
  .pd-action-edit-input{flex:1;min-width:200px;padding:6px 8px;border:1.5px solid var(--gold);border-radius:6px;font:inherit;font-size:13px}
  .pd-status{padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  .pd-small-btn{width:auto;padding:6px 12px;font-size:11px}
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

let PROJECTS=[], INITIATIVES=[], CUR_INITIATIVE=null, ACTIONS=[], PICKED_RESP_STAFF_ID=null;

async function initDept(){
  if($('pdAddBtn').dataset.ready) return;
  $('pdAddBtn').dataset.ready='1';
  $('pdDeptName').textContent = S.ME.departments?.name || '—';
  const {data:projects}=await db.from('plan_projects').select('id,name').eq('academic_year_id',S.YEAR.id).order('sort_order');
  PROJECTS=projects||[];
  $('pdProjectPick').innerHTML='<option value="">اختاري المشروع…</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  $('pdFilterProject').innerHTML='<option value="">كل المشاريع</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  $('pdProjectPick').addEventListener('change',loadInitiativesForProject);
  $('pdNewInitBtn').addEventListener('click',createInitiative);
  $('pdInitPick').addEventListener('change',onInitPick);
  bindRespSearch();
  $('pdAddBtn').addEventListener('click',addActions);
  $('pdFilterProject').addEventListener('change',renderGroups);
  $('pdFilterMonth').addEventListener('change',renderGroups);
  $('pdFilterStatus').addEventListener('change',renderGroups);
  $('pdToggleMerge').addEventListener('click',()=>{
    const box=$('pdMergePanel');
    box.style.display = box.style.display==='none' ? 'block' : 'none';
  });
  $('pdMergeBtn').addEventListener('click',mergeInitiatives);
  $('pdPrintByProject').addEventListener('click',printByProject);
  $('pdPrintFlow').addEventListener('click',printFlow);
  await loadAllDeptActions();
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

async function loadInitiativesForProject(){
  const projectId=$('pdProjectPick').value;
  $('pdActionsPanel').style.display='none'; CUR_INITIATIVE=null;
  if(!projectId){ $('pdInitPick').innerHTML='<option value="">اختاري مشروعاً أولاً…</option>'; return; }
  const {data}=await db.from('plan_initiatives').select('id,name').eq('project_id',projectId).order('created_at');
  INITIATIVES=data||[];
  $('pdInitPick').innerHTML='<option value="">اختاري مبادرة من هذا المشروع…</option>'+INITIATIVES.map(i=>`<option value="${i.id}">${i.name}</option>`).join('');
  $('pdMergeTarget').innerHTML=INITIATIVES.map(i=>`<option value="${i.id}">${i.name}</option>`).join('');
  $('pdMergeSources').innerHTML=INITIATIVES.map(i=>`<option value="${i.id}">${i.name}</option>`).join('');
}

async function mergeInitiatives(){
  const targetId=$('pdMergeTarget').value;
  const sourceIds=[...$('pdMergeSources').selectedOptions].map(o=>o.value).filter(id=>id!==targetId);
  if(!targetId){ toast('اختاري المبادرة المستهدفة'); return; }
  if(!sourceIds.length){ toast('اختاري مبادرة واحدة على الأقل للدمج'); return; }
  const targetName=INITIATIVES.find(i=>i.id===targetId)?.name||'';
  if(!confirm(`دمج ${sourceIds.length} مبادرة في "${targetName}"؟ كل إجراءاتها تنتقل لها، وتُحذف المبادرات الفارغة.`)) return;
  const btn=$('pdMergeBtn'); btn.disabled=true;
  try{
    const {error:moveErr}=await db.from('plan_actions').update({initiative_id:targetId}).in('initiative_id',sourceIds);
    if(moveErr) throw moveErr;
    const {error:delErr}=await db.from('plan_initiatives').delete().in('id',sourceIds);
    if(delErr) throw delErr;
    toast('تم الدمج بنجاح');
    await loadInitiativesForProject();
    await loadAllDeptActions();
    $('pdMergePanel').style.display='none';
  }catch(err){ toast('تعذر الدمج: '+(err.message||err)); }
  finally{ btn.disabled=false; }

async function createInitiative(){
  const projectId=$('pdProjectPick').value;
  if(!projectId){ toast('اختاري المشروع أولاً'); return; }
  const name=clean($('pdNewInitName').value);
  if(!name){ toast('اكتبي اسم المبادرة'); return; }
  const {data,error}=await db.from('plan_initiatives').insert({project_id:projectId, name, created_by:S.ME.id}).select('id,name').single();
  if(error){ toast('تعذر الإنشاء: '+error.message); return; }
  $('pdNewInitName').value='';
  toast('تم إنشاء المبادرة');
  await loadInitiativesForProject();
  $('pdInitPick').value=data.id;
  onInitPick();
}

function onInitPick(){
  const id=$('pdInitPick').value;
  CUR_INITIATIVE = INITIATIVES.find(i=>i.id===id)||null;
  if(CUR_INITIATIVE){
    $('pdActionsPanel').style.display='block';
    $('pdCurInitName').textContent=CUR_INITIATIVE.name;
  }else{
    $('pdActionsPanel').style.display='none';
  }
}

async function loadAllDeptActions(){
  if(!S.ME.department_id){ $('pdGroups').innerHTML='<div class="empty-day">حسابك غير مرتبط بقسم — راجعي الدعم الفني</div>'; return; }
  const {data,error}=await db.from('plan_actions').select('*, plan_initiatives(name, project_id, plan_projects(name))').eq('department_id',S.ME.department_id).order('created_at');
  if(error){ toast('تعذر التحميل: '+error.message); return; }
  ACTIONS=(data||[]).map(a=>({...a, initName:a.plan_initiatives?.name||'—', projectName:a.plan_initiatives?.plan_projects?.name||'—', project_id:a.plan_initiatives?.project_id}));
  renderGroups();
}

async function addActions(){
  if(!CUR_INITIATIVE){ toast('اختاري أو أنشئي مبادرة أولاً'); return; }
  if(!S.ME.department_id){ toast('حسابك غير مرتبط بقسم'); return; }
  const raw=$('pdNewText').value;
  const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean);
  if(!lines.length){ toast('اكتبي نص الإجراء'); return; }
  const resp=clean($('pdNewResp').value)||null;
  const month=$('pdNewMonth').value;
  const rows=lines.map(text=>({
    initiative_id:CUR_INITIATIVE.id, text, responsible:resp, responsible_staff_id:PICKED_RESP_STAFF_ID,
    department_id:S.ME.department_id, month, status:'not_started', created_by:S.ME.id
  }));
  const {error}=await db.from('plan_actions').insert(rows);
  if(error){ toast('تعذر الإضافة: '+error.message); return; }
  $('pdFilterProject').value=$('pdProjectPick').value; $('pdFilterMonth').value=''; $('pdFilterStatus').value='';
  $('pdNewText').value=''; $('pdNewResp').value=''; PICKED_RESP_STAFF_ID=null;
  toast(lines.length>1?`تمت إضافة ${lines.length} إجراءات`:'تمت الإضافة');
  loadAllDeptActions();
}

function monthLabel(id){ return MONTHS.find(m=>m.id===id)?.label||id; }

function getFiltered(){
  const pf=$('pdFilterProject').value, mf=$('pdFilterMonth').value, sf=$('pdFilterStatus').value;
  return ACTIONS.filter(a=>(!pf||a.project_id===pf) && (!mf||a.month===mf) && (!sf||a.status===sf));
}

function renderGroups(){
  const filtered=getFiltered();
  if(!filtered.length){ $('pdGroups').innerHTML='<div class="empty-day">لا إجراءات ضمن هذا الفلتر</div>'; return; }
  const byInit={};
  for(const a of filtered){ (byInit[a.initiative_id] ??= {name:a.initName, project:a.projectName, items:[]}).items.push(a); }
  $('pdGroups').innerHTML=Object.entries(byInit).map(([initId,g])=>{
    const done=g.items.filter(a=>a.status==='done').length;
    return `<div class="pd-init-group">
      <div class="pd-init-head"><span>📌 ${g.name} <small style="font-weight:400;color:#8a93a0">(${g.project})</small></span><span>${done}/${g.items.length}</span></div>
      ${g.items.map(a=>`<div class="pd-action-row" data-id="${a.id}">
        <span class="pd-action-text" data-role="text">${a.text}</span>
        <span style="font-size:12px;color:#8a93a0">${monthLabel(a.month)}${a.responsible?' — '+a.responsible:''}</span>
        <select class="pd-status" data-role="status">${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${a.status===k?'selected':''}>${v}</option>`).join('')}</select>
        <button class="btn ghost pd-small-btn" data-role="edit">✎ تعديل</button>
        <button class="btn ghost pd-small-btn" data-role="del" style="color:var(--err);border-color:var(--err)">✕ حذف</button>
      </div>`).join('')}
    </div>`;
  }).join('');

  $('pdGroups').querySelectorAll('.pd-action-row').forEach(row=>{
    const id=row.dataset.id;
    const action=ACTIONS.find(a=>a.id===id);
    row.querySelector('[data-role="status"]').addEventListener('change', async (e)=>{
      const {error}=await db.from('plan_actions').update({status:e.target.value, updated_at:new Date().toISOString()}).eq('id',id);
      if(error){ toast('تعذر الحفظ: '+error.message); return; }
      action.status=e.target.value; toast('تم الحفظ');
    });
    row.querySelector('[data-role="del"]').addEventListener('click', async ()=>{
      if(!confirm('حذف هذا الإجراء؟')) return;
      await db.from('plan_actions').delete().eq('id',id);
      toast('تم الحذف'); loadAllDeptActions();
    });
    row.querySelector('[data-role="edit"]').addEventListener('click', ()=>{
      const textSpan=row.querySelector('[data-role="text"]');
      const input=document.createElement('textarea');
      input.className='pd-action-edit-input'; input.value=action.text; input.rows=2;
      textSpan.replaceWith(input); input.focus();
      const save=async ()=>{
        const newText=input.value.trim();
        if(newText && newText!==action.text){
          const {error}=await db.from('plan_actions').update({text:newText, updated_at:new Date().toISOString()}).eq('id',id);
          if(error){ toast('تعذر الحفظ: '+error.message); return; }
          action.text=newText; toast('تم الحفظ');
        }
        renderGroups();
      };
      input.addEventListener('blur',save);
      input.addEventListener('keydown',e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); input.blur(); } });
    });
  });
}

/* ============ الطباعة ============ */
function printByProject(){
  if(!ACTIONS.length){ toast('لا إجراءات بعد'); return; }
  const byProject={};
  for(const a of ACTIONS) (byProject[a.project_id] ??= {name:a.projectName, items:[]}).items.push(a);
  let body='';
  Object.values(byProject).forEach(g=>{
    body+=`<div class="pd-head2">📁 ${g.name}</div>
      <table class="pd-tbl"><tr><th>#</th><th>المبادرة</th><th>الإجراء</th><th>المسؤولة</th><th>الحالة</th></tr>
      ${g.items.map((a,n)=>`<tr class="${a.status}"><td>${n+1}</td><td>${a.initName}</td><td>${a.text}</td><td>${a.responsible||'-'}</td><td>${STATUS_LABEL[a.status]}</td></tr>`).join('')}
      </table>`;
  });
  $('printAreaPD').innerHTML=`
    ${printHeaderHtml(`الخطة التشغيلية — قسم ${S.ME.departments?.name||''} (حسب المشاريع)`)}
    ${body}
    ${printFooterHtml('المعلمة الأولى', S.ME.full_name)}`;
  printWithTitle(`الخطة_التشغيلية_${S.ME.departments?.name||''}`,'printAreaPD');
}

function printFlow(){
  if(!ACTIONS.length){ toast('لا إجراءات بعد'); return; }
  let body='';
  MONTHS.forEach(m=>{
    const inMonth=ACTIONS.filter(a=>a.month===m.id);
    if(!inMonth.length) return;
    body+=`<div class="pd-mhead">📅 ${m.label}</div>
      <table class="pd-tbl"><tr><th>#</th><th>المشروع</th><th>المبادرة</th><th>الإجراء</th><th>المسؤولة</th><th>الحالة</th></tr>
      ${inMonth.map((a,n)=>`<tr class="${a.status}"><td>${n+1}</td><td>${a.projectName}</td><td>${a.initName}</td><td>${a.text}</td><td>${a.responsible||'-'}</td><td>${STATUS_LABEL[a.status]}</td></tr>`).join('')}
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
