/* admin-projects.js — المشاريع (تحت مجموعة "الخطة الاستراتيجية")
   للأدمن: إنشاء مشاريع جديدة، وتعيين رئيسة لكل مشروع مباشرة (تمنحها
   دور "مسؤولة مشروع" تلقائياً وتربطها بالمشروع عبر staff_project_leads). */
import { db, $, S, clean, toast, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="adminProjects" style="display:none">
  <div class="panel">
    <h3>إنشاء مشروع جديد</h3>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <input type="text" id="apNewName" placeholder="اسم المشروع" style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      <button class="btn gold" id="apCreateBtn" style="width:auto;padding:9px 20px">إنشاء</button>
    </div>
  </div>
  <div class="panel">
    <h3>المشاريع الحالية ورئيساتها</h3>
    <div id="apList"></div>
  </div>
</div>
<style>
  #adminProjects.wide{max-width:1300px}
  .ap-row{background:var(--white);border:1px solid var(--line);border-radius:11px;padding:14px 16px;margin-bottom:10px}
  .ap-row-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
  .ap-leads{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
  .ap-lead-chip{display:flex;align-items:center;gap:6px;background:var(--sand);border-radius:99px;padding:5px 12px;font-size:12.5px}
  .ap-lead-chip button{background:none;border:none;color:var(--err);cursor:pointer;font-size:12px}
  .ap-add-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;position:relative}
</style>`);

let PROJECTS=[];

async function initAdminProjects(){
  if($('apCreateBtn').dataset.ready) return;
  $('apCreateBtn').dataset.ready='1';
  $('apCreateBtn').addEventListener('click',createProject);
  await loadProjects();
}

async function createProject(){
  const name=clean($('apNewName').value);
  if(!name){ toast('اكتبي اسم المشروع'); return; }
  // سلسلة المشروع: لو فيه مشروع بنفس الاسم تماماً بسنة سابقة، نربطه تلقائياً بنفس سلسلته
  const {data:existing}=await db.from('plan_projects').select('chain_id').eq('name',name).not('chain_id','is',null).limit(1).maybeSingle();
  const chainId = existing?.chain_id || crypto.randomUUID();
  const {error}=await db.from('plan_projects').insert({academic_year_id:S.YEAR.id, name, sort_order:PROJECTS.length, chain_id:chainId});
  if(error){ toast('تعذر الإنشاء: '+error.message); return; }
  $('apNewName').value=''; toast(existing?'تم الإنشاء والربط بسلسلة المشروع من سنة سابقة':'تم إنشاء المشروع'); loadProjects();
}

async function loadProjects(){
  const {data,error}=await db.from('plan_projects').select('id,name,chain_id').eq('academic_year_id',S.YEAR.id).order('sort_order');
  if(error){ $('apList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  PROJECTS=data||[];
  if(!PROJECTS.length){ $('apList').innerHTML='<div class="empty-day">لا مشاريع بعد.</div>'; return; }

  const {data:leads}=await db.from('staff_project_leads').select('id,staff_id,project_id, staff(full_name)').in('project_id',PROJECTS.map(p=>p.id));

  $('apList').innerHTML=PROJECTS.map(p=>{
    const projLeads=(leads||[]).filter(l=>l.project_id===p.id);
    return `<div class="ap-row" data-project="${p.id}" data-chain="${p.chain_id||''}">
      <div class="ap-row-head"><b>${p.name}</b><button class="btn ghost ap-chain-btn" style="width:auto;padding:6px 14px;font-size:12px">📈 سلسلة المشروع (عبر السنوات)</button></div>
      <div class="ap-chain-panel" style="display:none;margin:8px 0;padding:10px;background:var(--sand);border-radius:8px"></div>
      <div class="ap-leads">
        ${projLeads.length ? projLeads.map(l=>`<span class="ap-lead-chip">${l.staff?.full_name||'—'}<button data-lead-id="${l.id}">✕</button></span>`).join('') : '<span style="color:#8a93a0;font-size:12.5px">لا رئيسة معيَّنة بعد</span>'}
      </div>
      <div class="ap-add-row">
        <input type="text" class="ap-search" placeholder="ابحثي عن منتسبة لتعيينها رئيسة…" style="flex:1;min-width:220px;padding:8px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
        <div class="sugg ap-sugg" style="display:none"></div>
      </div>
    </div>`;
  }).join('');

  $('apList').querySelectorAll('.ap-row').forEach(row=>{
    const projectId=row.dataset.project;
    row.querySelector('.ap-chain-btn').addEventListener('click', ()=>toggleChainPanel(row));
    row.querySelectorAll('button[data-lead-id]').forEach(b=>b.addEventListener('click', async ()=>{
      if(!confirm('إزالة هذي الرئيسة عن المشروع؟')) return;
      await db.from('staff_project_leads').delete().eq('id',b.dataset.leadId);
      toast('تمت الإزالة'); loadProjects();
    }));
    const inp=row.querySelector('.ap-search'), box=row.querySelector('.ap-sugg');
    let deb=null;
    inp.addEventListener('input',()=>{
      clearTimeout(deb);
      deb=setTimeout(async ()=>{
        const q=clean(inp.value);
        if(q.length<2){ box.style.display='none'; return; }
        const {data:st}=await db.from('staff').select('id,full_name').ilike('full_name',`%${q}%`).limit(6);
        if(!(st||[]).length){ box.style.display='none'; return; }
        box.innerHTML=st.map((s,i)=>`<div data-i="${i}">${s.full_name}</div>`).join('');
        box.style.display='block';
        box.querySelectorAll('div').forEach((el,i)=>el.addEventListener('click',()=>assignLead(projectId,st[i],inp,box)));
      },250);
    });
  });
}

async function assignLead(projectId,staffMember,inp,box){
  box.style.display='none'; inp.value='';
  const projectName=PROJECTS.find(p=>p.id===projectId)?.name||'';
  try{
    const {data:existingRole}=await db.from('staff_roles').select('id').eq('staff_id',staffMember.id).eq('role','project_lead').maybeSingle();
    if(!existingRole){
      await db.from('staff_roles').insert({staff_id:staffMember.id, role:'project_lead', scope:projectName});
    }
    const {error}=await db.from('staff_project_leads').insert({staff_id:staffMember.id, project_id:projectId});
    if(error){ toast(/duplicate|unique/i.test(error.message)?'هذي المنتسبة مُعيَّنة على هذا المشروع مسبقاً':'تعذر التعيين: '+error.message); return; }
    toast('تم التعيين'); loadProjects();
  }catch(err){ toast('تعذر التعيين: '+(err.message||err)); }
}

async function toggleChainPanel(row){
  const panel=row.querySelector('.ap-chain-panel');
  if(panel.style.display==='block'){ panel.style.display='none'; return; }
  panel.style.display='block';
  const chainId=row.dataset.chain;
  if(!chainId){ panel.innerHTML='<div style="font-size:12.5px;color:#8a93a0">هذا المشروع غير مربوط بسلسلة (أنشئ قبل تفعيل هذي الميزة).</div>'; return; }
  panel.innerHTML='<div style="font-size:12.5px;color:#8a93a0">جارٍ التحميل…</div>';
  const {data:chainProjects}=await db.from('plan_projects').select('id,name,academic_years(name)').eq('chain_id',chainId).order('created_at');
  if(!chainProjects || chainProjects.length<2){ panel.innerHTML='<div style="font-size:12.5px;color:#8a93a0">لا توجد سنوات سابقة مرتبطة بهذا المشروع بعد.</div>'; return; }

  const rows=[];
  for(const p of chainProjects){
    const {data:inits}=await db.from('plan_initiatives').select('id').eq('project_id',p.id);
    const initIds=(inits||[]).map(i=>i.id);
    const {data:acts}= initIds.length ? await db.from('plan_actions').select('status').in('initiative_id',initIds) : {data:[]};
    const total=(acts||[]).length, done=(acts||[]).filter(a=>a.status==='done').length;
    rows.push({year:p.academic_years?.name||'—', total, done, pct: total?Math.round(done/total*100):0});
  }
  panel.innerHTML=rows.map(r=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line);font-size:13px">
    <span><b>${r.year}</b></span><span>${r.done}/${r.total} إجراء — ${r.pct}٪ إنجاز</span></div>`).join('');
}

registerTab({id:'adminProjects', label:'المشاريع', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:f=>f.isAdmin, init:initAdminProjects});
