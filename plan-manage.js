/* plan-manage.js — متابعة مشروعي (تحت مجموعة "الخطة الاستراتيجية")
   لمن لها صلاحية "مسؤولة مشروع" — تُقيَّد تلقائياً بمشروعها المحدد.
   البنية الصحيحة: مشروع ← مبادرة ← إجراءات (متعددة، كل واحد بتوقيته
   وحالته ومسؤوله الخاص). تُنشأ المبادرة أولاً، ثم تُضاف إجراءاتها —
   سطر واحد في مربع النص = إجراء واحد تحت نفس المبادرة. */
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
    <h3>المبادرة</h3>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <select id="pmInitPick" style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)"><option value="">اختاري مبادرة موجودة…</option></select>
      <span style="color:#8a93a0;font-size:13px">أو</span>
      <input type="text" id="pmNewInitName" placeholder="اسم مبادرة جديدة" style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      <button class="btn gold" id="pmNewInitBtn" style="width:auto;padding:9px 20px">إنشاء المبادرة</button>
    </div>
  </div>

  <div class="panel" id="pmActionsPanel" style="display:none">
    <h3>إضافة إجراء / إجراءات — <span id="pmCurInitName" style="color:var(--gold)">—</span></h3>
    <div class="sub">سطر واحد في مربع النص = إجراء واحد مستقل بتوقيته وحالته الخاصة.</div>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <textarea id="pmNewText" placeholder="نص الإجراء — سطر واحد = إجراء واحد" rows="2" style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;resize:vertical"></textarea>
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

  <div class="panel" id="pmMergePanel" style="display:none">
    <h3>دمج مبادرات مكرَّرة</h3>
    <div class="sub">لو عندك عدة "مبادرات" فعلياً كلها إجراءات تابعة لنفس المبادرة الحقيقية (مثل بيانات مستوردة قديمة)، اختاريها هنا وادمجيها في مبادرة واحدة — كل إجراءاتها تنتقل للمبادرة المستهدفة، وتُحذف البقية.</div>
    <div class="field"><label>المبادرة المستهدفة (يبقى اسمها، تنتقل لها كل الإجراءات)</label><select id="pmMergeTarget"></select></div>
    <div class="field"><label>المبادرات المطلوب دمجها فيها (اختاري أكثر من واحدة)</label>
      <select id="pmMergeSources" multiple size="6" style="width:100%;padding:8px;border:1.5px solid var(--line);border-radius:8px;font:inherit"></select>
    </div>
    <button class="btn ghost" id="pmMergeBtn" style="width:auto;padding:9px 20px;color:var(--err);border-color:var(--err)">دمج المحدَّد في المبادرة المستهدفة</button>
  </div>

  <div class="panel">
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <select id="pmFilterInit"><option value="">كل المبادرات</option></select>
      <select id="pmFilterMonth"><option value="">كل الأشهر</option>${MONTHS.map(m=>`<option value="${m.id}">${m.label}</option>`).join('')}</select>
      <select id="pmFilterStatus"><option value="">كل الحالات</option>${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
      <button class="btn ghost" id="pmToggleMerge" style="width:auto;padding:9px 20px;margin-inline-start:auto">دمج مبادرات مكرَّرة</button>
    </div>
    <div class="actions" style="margin-bottom:14px">
      <button class="btn ghost" id="pmPrintMonth">🖨️ طباعة الشهر المحدَّد</button>
      <button class="btn ghost" id="pmPrintAll">🖨️ طباعة كل الأشهر</button>
      <button class="btn ghost" id="pmXls">⬇ تصدير Excel</button>
    </div>
    <div id="pmGroups"></div>
  </div>
</div>
<div id="printAreaPM"></div>
<style>
  #planManage.wide{max-width:1500px}
  #planManage select{padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)}
  .pm-init-group{background:var(--white);border:1px solid var(--line);border-radius:11px;margin-bottom:12px;overflow:hidden}
  .pm-init-head{padding:10px 16px;background:var(--sand);font-weight:700;color:var(--navy);display:flex;justify-content:space-between;align-items:center}
  .pm-action-row{display:flex;gap:10px;align-items:center;padding:8px 16px;border-bottom:1px solid #f2f0ea;flex-wrap:wrap}
  .pm-action-row:last-child{border-bottom:none}
  .pm-action-text{flex:1;min-width:200px;font-size:13px;color:var(--ink)}
  .pm-action-edit-input{flex:1;min-width:200px;padding:6px 8px;border:1.5px solid var(--gold);border-radius:6px;font:inherit;font-size:13px}
  .pm-status{padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  .pm-small-btn{width:auto;padding:6px 12px;font-size:11px}
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

let MY_PROJECTS=[], CUR_PROJECT=null, INITIATIVES=[], CUR_INITIATIVE=null, ACTIONS=[], PICKED_RESP_STAFF_ID=null;

async function initManage(){
  if($('pmProjectPick').dataset.ready) return;
  $('pmProjectPick').dataset.ready='1';
  const {data:leads}=await db.from('staff_project_leads').select('project_id, plan_projects(id,name)').eq('staff_id',S.ME.id);
  MY_PROJECTS=(leads||[]).map(l=>l.plan_projects).filter(Boolean);
  if(!MY_PROJECTS.length){ $('pmProjectPick').innerHTML='<option value="">لا مشاريع مسنَدة لك بعد</option>'; return; }
  $('pmProjectPick').innerHTML=MY_PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  CUR_PROJECT=MY_PROJECTS[0];
  $('pmProjectPick').addEventListener('change',()=>{ CUR_PROJECT=MY_PROJECTS.find(p=>p.id===$('pmProjectPick').value); loadInitiatives(); });
  $('pmNewInitBtn').addEventListener('click',createInitiative);
  $('pmInitPick').addEventListener('change',onInitPick);
  bindRespSearch();
  $('pmAddBtn').addEventListener('click',addActions);
  $('pmFilterInit').addEventListener('change',renderGroups);
  $('pmFilterMonth').addEventListener('change',renderGroups);
  $('pmFilterStatus').addEventListener('change',renderGroups);
  $('pmToggleMerge').addEventListener('click',()=>{
    const box=$('pmMergePanel');
    box.style.display = box.style.display==='none' ? 'block' : 'none';
  });
  $('pmMergeBtn').addEventListener('click',mergeInitiatives);
  $('pmPrintMonth').addEventListener('click',()=>printPlan(false));
  $('pmPrintAll').addEventListener('click',()=>printPlan(true));
  $('pmXls').addEventListener('click',exportXls);
  await loadInitiatives();
}

function bindRespSearch(){
  const inp=$('pmNewResp'), box=$('pmRespSugg');
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
  if(!CUR_PROJECT) return;
  const {data,error}=await db.from('plan_initiatives').select('id,name').eq('project_id',CUR_PROJECT.id).order('created_at');
  if(error){ toast('تعذر التحميل: '+error.message); return; }
  INITIATIVES=data||[];
  $('pmInitPick').innerHTML='<option value="">اختاري مبادرة موجودة…</option>'+INITIATIVES.map(i=>`<option value="${i.id}">${i.name}</option>`).join('');
  $('pmFilterInit').innerHTML='<option value="">كل المبادرات</option>'+INITIATIVES.map(i=>`<option value="${i.id}">${i.name}</option>`).join('');
  $('pmMergeTarget').innerHTML=INITIATIVES.map(i=>`<option value="${i.id}">${i.name}</option>`).join('');
  $('pmMergeSources').innerHTML=INITIATIVES.map(i=>`<option value="${i.id}">${i.name}</option>`).join('');
  CUR_INITIATIVE=null; $('pmActionsPanel').style.display='none';
  await loadAllActions();
}

async function mergeInitiatives(){
  const targetId=$('pmMergeTarget').value;
  const sourceIds=[...$('pmMergeSources').selectedOptions].map(o=>o.value).filter(id=>id!==targetId);
  if(!targetId){ toast('اختاري المبادرة المستهدفة'); return; }
  if(!sourceIds.length){ toast('اختاري مبادرة واحدة على الأقل للدمج'); return; }
  const targetName=INITIATIVES.find(i=>i.id===targetId)?.name||'';
  if(!confirm(`دمج ${sourceIds.length} مبادرة في "${targetName}"؟ كل إجراءاتها تنتقل لها، وتُحذف المبادرات الفارغة بعد الدمج.`)) return;
  const btn=$('pmMergeBtn'); btn.disabled=true;
  try{
    const {error:moveErr}=await db.from('plan_actions').update({initiative_id:targetId}).in('initiative_id',sourceIds);
    if(moveErr) throw moveErr;
    const {error:delErr}=await db.from('plan_initiatives').delete().in('id',sourceIds);
    if(delErr) throw delErr;
    toast('تم الدمج بنجاح');
    await loadInitiatives();
    $('pmMergePanel').style.display='none';
  }catch(err){ toast('تعذر الدمج: '+(err.message||err)); }
  finally{ btn.disabled=false; }

async function createInitiative(){
  if(!CUR_PROJECT){ toast('لا مشروع محدَّد'); return; }
  const name=clean($('pmNewInitName').value);
  if(!name){ toast('اكتبي اسم المبادرة'); return; }
  const {data,error}=await db.from('plan_initiatives').insert({project_id:CUR_PROJECT.id, name, created_by:S.ME.id}).select('id,name').single();
  if(error){ toast('تعذر الإنشاء: '+error.message); return; }
  $('pmNewInitName').value='';
  toast('تم إنشاء المبادرة');
  await loadInitiatives();
  $('pmInitPick').value=data.id;
  onInitPick();
}

function onInitPick(){
  const id=$('pmInitPick').value;
  CUR_INITIATIVE = INITIATIVES.find(i=>i.id===id)||null;
  if(CUR_INITIATIVE){
    $('pmActionsPanel').style.display='block';
    $('pmCurInitName').textContent=CUR_INITIATIVE.name;
  }else{
    $('pmActionsPanel').style.display='none';
  }
}

async function loadAllActions(){
  if(!INITIATIVES.length){ ACTIONS=[]; renderGroups(); return; }
  const initIds=INITIATIVES.map(i=>i.id);
  const {data,error}=await db.from('plan_actions').select('*').in('initiative_id',initIds).order('created_at');
  if(error){ toast('تعذر التحميل: '+error.message); return; }
  ACTIONS=data||[];
  renderGroups();
}

async function addActions(){
  if(!CUR_INITIATIVE){ toast('اختاري أو أنشئي مبادرة أولاً'); return; }
  const raw=$('pmNewText').value;
  const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean);
  if(!lines.length){ toast('اكتبي نص الإجراء'); return; }
  const resp=clean($('pmNewResp').value)||null;
  const month=$('pmNewMonth').value;
  const rows=lines.map(text=>({
    initiative_id:CUR_INITIATIVE.id, text, responsible:resp, responsible_staff_id:PICKED_RESP_STAFF_ID, month, status:'not_started', created_by:S.ME.id
  }));
  const {error}=await db.from('plan_actions').insert(rows);
  if(error){ toast('تعذر الإضافة: '+error.message); return; }
  $('pmNewText').value=''; $('pmNewResp').value=''; PICKED_RESP_STAFF_ID=null;
  toast(lines.length>1?`تمت إضافة ${lines.length} إجراءات`:'تمت إضافة الإجراء');
  loadAllActions();
}

function getFilteredActions(){
  const inf=$('pmFilterInit').value, mf=$('pmFilterMonth').value, sf=$('pmFilterStatus').value;
  return ACTIONS.filter(a=>(!inf||a.initiative_id===inf) && (!mf||a.month===mf) && (!sf||a.status===sf));
}

function monthLabel(id){ return MONTHS.find(m=>m.id===id)?.label||id; }

function renderGroups(){
  const filtered=getFilteredActions();
  const initById={}; for(const i of INITIATIVES) initById[i.id]=i.name;
  const byInit={};
  for(const a of filtered){ (byInit[a.initiative_id] ??= []).push(a); }
  const groupIds=Object.keys(byInit);
  if(!groupIds.length){ $('pmGroups').innerHTML='<div class="empty-day">لا إجراءات ضمن هذا الفلتر</div>'; return; }
  $('pmGroups').innerHTML=groupIds.map(initId=>{
    const actions=byInit[initId];
    const done=actions.filter(a=>a.status==='done').length;
    return `<div class="pm-init-group">
      <div class="pm-init-head"><span>📌 ${initById[initId]||'—'}</span><span>${done}/${actions.length}</span></div>
      ${actions.map(a=>`<div class="pm-action-row" data-id="${a.id}">
        <span class="pm-action-text" data-role="text">${a.text}</span>
        <span style="font-size:12px;color:#8a93a0">${monthLabel(a.month)}${a.responsible?' — '+a.responsible:''}</span>
        <select class="pm-status" data-role="status">${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${a.status===k?'selected':''}>${v}</option>`).join('')}</select>
        <button class="btn ghost pm-small-btn" data-role="edit">✎ تعديل</button>
        <button class="btn ghost pm-small-btn" data-role="del" style="color:var(--err);border-color:var(--err)">✕ حذف</button>
      </div>`).join('')}
    </div>`;
  }).join('');

  $('pmGroups').querySelectorAll('.pm-action-row').forEach(row=>{
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
      toast('تم الحذف'); loadAllActions();
    });
    row.querySelector('[data-role="edit"]').addEventListener('click', ()=>{
      const textSpan=row.querySelector('[data-role="text"]');
      const input=document.createElement('textarea');
      input.className='pm-action-edit-input'; input.value=action.text; input.rows=2;
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
function printPlan(allMonths){
  const filtered = allMonths ? ACTIONS : ACTIONS.filter(a=>a.month===$('pmFilterMonth').value || !$('pmFilterMonth').value);
  if(!filtered.length){ toast('لا إجراءات لهذا المشروع بعد'); return; }
  const initById={}; for(const i of INITIATIVES) initById[i.id]=i.name;
  let body='';
  const list = allMonths ? MONTHS : ($('pmFilterMonth').value ? MONTHS.filter(m=>m.id===$('pmFilterMonth').value) : MONTHS);
  list.forEach(m=>{
    const inMonth=filtered.filter(a=>a.month===m.id);
    if(!inMonth.length) return;
    const done=inMonth.filter(a=>a.status==='done').length;
    body+=`<div class="pm-mhead">📅 ${m.label} (${done}/${inMonth.length} منجز)</div>
      <table class="pm-tbl"><tr><th>#</th><th>المبادرة</th><th>الإجراء</th><th>المنفذون</th><th>الحالة</th></tr>
      ${inMonth.map((a,n)=>`<tr class="${a.status}"><td>${n+1}</td><td>${initById[a.initiative_id]||'—'}</td><td>${a.text}</td><td>${a.responsible||'-'}</td><td>${STATUS_LABEL[a.status]}</td></tr>`).join('')}
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
  if(!ACTIONS.length){ toast('لا إجراءات لهذا المشروع بعد'); return; }
  const initById={}; for(const i of INITIATIVES) initById[i.id]=i.name;
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(CUR_PROJECT.name.substring(0,28),{views:[{rightToLeft:true}]});
  const NAVY='FF1A3A6B', WHITE='FFFFFFFF', DONE='FFD8F3DC', PROG='FFFFF3CD';
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,5);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'}; if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(CUR_PROJECT.name,14,true,NAVY,WHITE);
  addTitle(S.SETTINGS.school_name||'المدرسة',11,false,null,'FF444444');
  ws.addRow([]);
  MONTHS.forEach(m=>{
    const inits=ACTIONS.filter(a=>a.month===m.id);
    if(!inits.length) return;
    const done=inits.filter(a=>a.status==='done').length;
    const mrow=ws.addRow([`📅 ${m.label}`,'','','',`${done}/${inits.length} منجز`]);
    mrow.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1D4ED8'}}; c.alignment={horizontal:'center'}; });
    const hdr=ws.addRow(['#','المبادرة','الإجراء','المسؤول','الحالة']);
    hdr.eachCell(c=>{ c.font={bold:true}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD0E8D8'}}; c.alignment={horizontal:'center'}; });
    inits.forEach((a,n)=>{
      const bg = a.status==='done'?DONE : a.status==='in_progress'?PROG : 'FFFFFFFF';
      const row=ws.addRow([n+1, initById[a.initiative_id]||'—', a.text, a.responsible||'-', STATUS_LABEL[a.status]]);
      row.eachCell((c,colNo)=>{ c.alignment={horizontal:colNo===3?'right':'center'}; c.font={size:10}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}}; });
    });
    ws.addRow([]);
  });
  ws.columns=[{width:6},{width:26},{width:45},{width:26},{width:16}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`الخطة_${CUR_PROJECT.name}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

registerTab({id:'planManage', label:'متابعة مشروعي', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:f=>f.isProjectLead, init:initManage});
