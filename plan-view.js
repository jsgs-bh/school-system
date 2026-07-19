/* plan-view.js — الخطة التدفقية (عرض عام، تحت مجموعة "الخطة الاستراتيجية")
   مطابق لصفحة "الرئيسية" في موقع الخطة القديم: تبويبات أشهر، وكل شهر
   يعرض مبادراته مجمَّعة حسب المشروع، بحالتها (لم يبدأ/جاري/تم). عرض
   فقط — التعديل من "متابعة مشروعي" أو "متابعة الخطة الشاملة". */
import { db, $, S, registerTab } from './core.js';

const MONTHS=[
  {id:'sep',label:'سبتمبر'},{id:'oct',label:'أكتوبر'},{id:'nov',label:'نوفمبر'},{id:'dec',label:'ديسمبر'},{id:'jan',label:'يناير'},
  {id:'feb',label:'فبراير'},{id:'mar',label:'مارس'},{id:'apr',label:'أبريل'},{id:'may',label:'مايو'},{id:'jun',label:'يونيو'},
];

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="planView" style="display:none">
  <div class="panel">
    <h3>الخطة التدفقية</h3>
    <div class="stats" id="pvStats"></div>
  </div>
  <div id="pvMonthTabs" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px"></div>
  <div id="pvGrid"></div>
</div>
<style>
  #planView.wide{max-width:1400px}
  .pv-mtab{padding:9px 16px;border-radius:10px;border:1.5px solid var(--line);background:var(--white);color:var(--navy);font-size:13px;font-weight:600;cursor:pointer}
  .pv-mtab.active{background:var(--navy);color:#fff;border-color:var(--navy)}
  .pv-mtab .cnt{font-size:11px;opacity:.8;margin-inline-start:4px}
  .pv-card{background:var(--white);border:1px solid var(--line);border-radius:12px;margin-bottom:14px;overflow:hidden}
  .pv-card-head{padding:12px 16px;background:var(--sand);display:flex;justify-content:space-between;align-items:center;font-weight:700;color:var(--navy)}
  .pv-init{display:flex;gap:10px;align-items:flex-start;padding:8px 16px;border-bottom:1px solid #f2f0ea}
  .pv-init:last-child{border-bottom:none}
  .pv-dot{width:10px;height:10px;border-radius:50%;margin-top:5px;flex-shrink:0}
  .pv-dot.not_started{background:#e2e5e9}
  .pv-dot.in_progress{background:#f0b429}
  .pv-dot.done{background:#2f9e44}
  .pv-text.done{text-decoration:line-through;color:#8a93a0}
  .pv-resp{font-size:11.5px;color:#8a93a0;margin-top:2px}
</style>`);

let ALL_INITIATIVES=[], ACTIVE_MONTH='sep';

async function initPlanView(){
  if($('pvMonthTabs').dataset.ready) return;
  $('pvMonthTabs').dataset.ready='1';
  await loadAll();
}

async function loadAll(){
  const {data:projects}=await db.from('plan_projects').select('id,name,sort_order').eq('academic_year_id',S.YEAR.id).order('sort_order');
  const projectIds=(projects||[]).map(p=>p.id);
  const {data:initiatives}=projectIds.length
    ? await db.from('plan_initiatives').select('*').in('project_id',projectIds)
    : {data:[]};
  const projById={}; for(const p of projects||[]) projById[p.id]=p;
  ALL_INITIATIVES=(initiatives||[]).map(i=>({...i, projectName:projById[i.project_id]?.name||'—'}));
  renderStats();
  renderMonthTabs();
  renderMonth(ACTIVE_MONTH);
}

function renderStats(){
  const total=ALL_INITIATIVES.length, done=ALL_INITIATIVES.filter(i=>i.status==='done').length;
  const pct=total?Math.round(done/total*100):0;
  $('pvStats').innerHTML=`
    <div class="stat"><b>${total}</b><span>إجمالي الإجراءات</span></div>
    <div class="stat green"><b>${done}</b><span>تم التنفيذ</span></div>
    <div class="stat"><b>${pct}٪</b><span>نسبة الإنجاز</span></div>`;
}

function renderMonthTabs(){
  $('pvMonthTabs').innerHTML=MONTHS.map(m=>{
    const inMonth=ALL_INITIATIVES.filter(i=>i.month===m.id);
    const done=inMonth.filter(i=>i.status==='done').length;
    return `<button class="pv-mtab ${m.id===ACTIVE_MONTH?'active':''}" data-m="${m.id}">${m.label}${inMonth.length?`<span class="cnt">${done}/${inMonth.length}</span>`:''}</button>`;
  }).join('');
  $('pvMonthTabs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ ACTIVE_MONTH=b.dataset.m; renderMonthTabs(); renderMonth(ACTIVE_MONTH); }));
}

function renderMonth(monthId){
  const inits=ALL_INITIATIVES.filter(i=>i.month===monthId);
  if(!inits.length){ $('pvGrid').innerHTML='<div class="empty-day">لا إجراءات لهذا الشهر.</div>'; return; }
  const byProject={};
  for(const i of inits){ (byProject[i.project_id] ??= {name:i.projectName, items:[]}).items.push(i); }
  $('pvGrid').innerHTML=Object.values(byProject).map(g=>{
    const done=g.items.filter(i=>i.status==='done').length;
    return `<div class="pv-card">
      <div class="pv-card-head"><span>📁 ${g.name}</span><span>${done}/${g.items.length}</span></div>
      ${g.items.map(i=>`<div class="pv-init"><span class="pv-dot ${i.status}"></span>
        <div><div class="pv-text ${i.status==='done'?'done':''}">${i.text}</div>${i.responsible?`<div class="pv-resp">👤 ${i.responsible}</div>`:''}</div></div>`).join('')}
    </div>`;
  }).join('');
}

registerTab({id:'planView', label:'الخطة التدفقية', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:f=>f.isAdmin||f.isLead||f.isStrategicPlanLead||!f.isSeniorTeacher, init:initPlanView});
