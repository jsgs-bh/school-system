/* plan-view.js — الخطة التدفقية (عرض عام، تحت مجموعة "الخطة الاستراتيجية")
   مطابق بصرياً لموقع الخطة التدفقية القديم. يعرض الإجراءات (plan_actions)
   مجمَّعة حسب المبادرة داخل كل مشروع. عرض فقط — التعديل من "متابعة
   مشروعي" أو "متابعة الخطة الشاملة" أو "الخطة التشغيلية". */
import { db, $, S, registerTab } from './core.js';

const MONTHS=[
  {id:'sep',label:'سبتمبر'},{id:'oct',label:'أكتوبر'},{id:'nov',label:'نوفمبر'},{id:'dec',label:'ديسمبر'},{id:'jan',label:'يناير'},
  {id:'feb',label:'فبراير'},{id:'mar',label:'مارس'},{id:'apr',label:'أبريل'},{id:'may',label:'مايو'},{id:'jun',label:'يونيو'},
];

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="planView" style="display:none;background:#f0f4f8;padding:1.25rem;border-radius:12px">
  <div id="pvDeptNote"></div>
  <div class="pv-statsbar" id="pvStats"></div>
  <div class="pv-toprow">
    <select id="pvProjectFilter"><option value="">كل المشاريع</option></select>
  </div>
  <div class="pv-month-tabs" id="pvMonthTabs"></div>
  <div class="pv-mgrid" id="pvGrid"></div>
</div>
<style>
  :root{--pv-primary:#1a3a6b;--pv-pl:#1d4ed8;--pv-pa:#3b82f6;--pv-acc:#0ea5e9;--pv-border:#bfdbfe;--pv-muted:#6c757d}
  #planView.wide{max-width:1400px}
  .pv-statsbar{background:#fff;padding:.6rem 1.25rem;display:flex;gap:1.25rem;border-radius:12px;border:1px solid var(--pv-border);flex-wrap:wrap;align-items:center;margin-bottom:1rem}
  .pv-stat{text-align:center;min-width:70px}
  .pv-stat b{display:block;font-size:1.3rem;font-weight:700;color:var(--pv-pl);line-height:1}
  .pv-stat span{font-size:.68rem;color:var(--pv-muted);margin-top:2px;display:block}
  .pv-toprow{display:flex;justify-content:flex-end;margin-bottom:.75rem}
  .pv-toprow select{padding:.5rem .9rem;border-radius:8px;border:1px solid var(--pv-border);background:#fff;color:var(--pv-primary);font:inherit;font-weight:600;font-size:.85rem}
  .pv-month-tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:.5rem;margin-bottom:1rem;padding:.75rem;background:#fff;border-radius:12px;border:1px solid var(--pv-border)}
  @media (max-width:820px){.pv-month-tabs{grid-template-columns:repeat(2,1fr)}}
  .pv-mtab{padding:.6rem .4rem;border-radius:12px;border:1.5px solid var(--pv-border);background:#f0f9ff;color:var(--pv-pl);font-size:.85rem;font-weight:500;cursor:pointer;text-align:center;font-family:inherit}
  .pv-mtab:hover{background:#dbeafe;border-color:var(--pv-pa)}
  .pv-mtab.active{background:var(--pv-pl);color:#fff;border-color:var(--pv-pl)}
  .pv-mtab .cnt{font-size:.7rem;font-weight:700;margin-inline-start:4px}
  .pv-mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:.9rem}
  .pv-card{background:#fff;border-radius:12px;border:1px solid var(--pv-border);overflow:hidden}
  .pv-card-head{padding:.65rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:.5rem}
  .pv-card-head .pv-name{font-weight:600;font-size:.9rem;color:var(--pv-primary)}
  .pv-badge{border-radius:20px;padding:.15rem .55rem;font-size:.72rem;font-weight:700;color:#fff;background:var(--pv-pl)}
  .pv-badge.full{background:#198754}
  .pv-progress{height:4px;background:#e9ecef}
  .pv-progress-fill{height:100%;background:var(--pv-pa)}
  .pv-card-body{padding:.5rem .9rem .9rem}
  .pv-initname{font-size:.72rem;font-weight:700;color:var(--pv-acc);margin:.4rem 0 .15rem;border-bottom:1px solid #f0f0f0;padding-bottom:.2rem}
  .pv-init{display:flex;align-items:flex-start;gap:.45rem;padding:.3rem 0;border-bottom:1px solid #fafafa}
  .pv-init:last-child{border-bottom:none}
  .pv-dot{width:18px;height:18px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;margin-top:1px}
  .pv-dot.not_started{background:#f8f9fa;border:1px solid var(--pv-border)}
  .pv-dot.in_progress{background:#fff3cd;border:1px solid #f0b429;color:#8a6100;font-weight:700}
  .pv-dot.done{background:#d8f3dc;color:#2d6a4f;font-weight:700}
  .pv-text{font-size:.78rem;color:#2d3748;line-height:1.45;flex:1}
  .pv-resp{font-size:.68rem;color:var(--pv-muted);margin-top:2px}
</style>`);

let ALL_ACTIONS=[], ACTIVE_MONTH='sep';

async function initPlanView(){
  if($('pvMonthTabs').dataset.ready) return;
  $('pvMonthTabs').dataset.ready='1';
  const canSeeAll = S.FLAGS.isAdmin || S.FLAGS.isLead || S.FLAGS.isStrategicPlanLead;
  if(!canSeeAll){
    $('pvDeptNote').innerHTML=`<div class="sub" style="margin-bottom:10px">مقتصرة على قسمك: ${S.ME.departments?.name||'—'}</div>`;
  }
  $('pvProjectFilter').addEventListener('change',()=>{ renderMonthTabs(); renderMonth(ACTIVE_MONTH); });
  await loadAll();
}

async function loadAll(){
  const {data:projects}=await db.from('plan_projects').select('id,name,sort_order').eq('academic_year_id',S.YEAR.id).order('sort_order');
  const projectIds=(projects||[]).map(p=>p.id);
  $('pvProjectFilter').innerHTML='<option value="">كل المشاريع</option>'+(projects||[]).map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  if(!projectIds.length){ ALL_ACTIONS=[]; renderStats(); renderMonthTabs(); renderMonth(ACTIVE_MONTH); return; }

  const {data:initiatives}=await db.from('plan_initiatives').select('id,name,project_id').in('project_id',projectIds);
  const initIds=(initiatives||[]).map(i=>i.id);
  const initById={}; for(const i of initiatives||[]) initById[i.id]=i;
  const projById={}; for(const p of projects||[]) projById[p.id]=p;

  let query = initIds.length ? db.from('plan_actions').select('*').in('initiative_id',initIds) : null;
  const canSeeAll = S.FLAGS.isAdmin || S.FLAGS.isLead || S.FLAGS.isStrategicPlanLead;
  if(query && !canSeeAll) query = query.eq('department_id', S.ME.department_id||'00000000-0000-0000-0000-000000000000');
  const {data:actions} = query ? await query : {data:[]};

  ALL_ACTIONS=(actions||[]).map(a=>{
    const init=initById[a.initiative_id];
    const proj=init?projById[init.project_id]:null;
    return {...a, initName:init?.name||'—', project_id:init?.project_id, projectName:proj?.name||'—'};
  });
  renderStats();
  renderMonthTabs();
  renderMonth(ACTIVE_MONTH);
}

function renderStats(){
  const total=ALL_ACTIONS.length, done=ALL_ACTIONS.filter(a=>a.status==='done').length;
  const pct=total?Math.round(done/total*100):0;
  const projCount=new Set(ALL_ACTIONS.map(a=>a.project_id)).size;
  $('pvStats').innerHTML=`
    <div class="pv-stat"><b>${total}</b><span>إجمالي الإجراءات</span></div>
    <div class="pv-stat"><b>${done}</b><span>تم التنفيذ</span></div>
    <div class="pv-stat"><b>${pct}%</b><span>نسبة الإنجاز</span></div>
    <div class="pv-stat"><b>${projCount}</b><span>المشاريع</span></div>`;
}

function scopedActions(){
  const pf=$('pvProjectFilter').value;
  return pf ? ALL_ACTIONS.filter(a=>a.project_id===pf) : ALL_ACTIONS;
}

function renderMonthTabs(){
  const source=scopedActions();
  $('pvMonthTabs').innerHTML=MONTHS.map(m=>{
    const inMonth=source.filter(a=>a.month===m.id);
    const done=inMonth.filter(a=>a.status==='done').length;
    return `<button class="pv-mtab ${m.id===ACTIVE_MONTH?'active':''}" data-m="${m.id}">${m.label}${inMonth.length?`<span class="cnt">${done}/${inMonth.length}</span>`:''}</button>`;
  }).join('');
  $('pvMonthTabs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ ACTIVE_MONTH=b.dataset.m; renderMonthTabs(); renderMonth(ACTIVE_MONTH); }));
}

function renderMonth(monthId){
  const actions=scopedActions().filter(a=>a.month===monthId);
  if(!actions.length){ $('pvGrid').innerHTML='<div style="grid-column:1/-1;text-align:center;padding:2.5rem;color:var(--pv-muted);background:#fff;border-radius:12px;border:1px solid var(--pv-border)">لا إجراءات لهذا الشهر.</div>'; return; }
  const byProject={};
  for(const a of actions){ (byProject[a.project_id] ??= {name:a.projectName, byInit:{}}); (byProject[a.project_id].byInit[a.initiative_id] ??= {name:a.initName, items:[]}).items.push(a); }
  $('pvGrid').innerHTML=Object.values(byProject).map(g=>{
    const allItems=Object.values(g.byInit).flatMap(i=>i.items);
    const done=allItems.filter(a=>a.status==='done').length;
    const full=done===allItems.length;
    const pct=allItems.length?Math.round(done/allItems.length*100):0;
    return `<div class="pv-card">
      <div class="pv-card-head"><span class="pv-name">📁 ${g.name}</span><span class="pv-badge ${full?'full':''}">${done}/${allItems.length}</span></div>
      <div class="pv-progress"><div class="pv-progress-fill" style="width:${pct}%"></div></div>
      <div class="pv-card-body">
      ${Object.values(g.byInit).map(gi=>`
        <div class="pv-initname">📌 ${gi.name}</div>
        ${gi.items.map(a=>`<div class="pv-init"><span class="pv-dot ${a.status}">${a.status==='done'?'✓':''}</span>
          <div><div class="pv-text">${a.text}</div>${a.responsible?`<div class="pv-resp">👤 ${a.responsible}</div>`:''}</div></div>`).join('')}
      `).join('')}
      </div>
    </div>`;
  }).join('');
}

registerTab({id:'planView', label:'الخطة التدفقية', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:()=>true, init:initPlanView});
