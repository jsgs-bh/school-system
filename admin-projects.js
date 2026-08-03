/* admin-projects.js — المشاريع (تحت مجموعة "الخطة الاستراتيجية")
   للأدمن: إنشاء مشاريع جديدة، وتعيين رئيسة لكل مشروع مباشرة (تمنحها
   دور "مسؤولة مشروع" تلقائياً وتربطها بالمشروع عبر staff_project_leads). */
import { db, $, S, clean, toast, printWithTitle, printHeaderHtml, printFooterHtml, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="adminProjects" style="display:none">
  <div id="apUnlinkedWarn" style="display:none"></div>
  <div class="panel" style="display:flex;justify-content:flex-end">
    <button class="btn ghost" id="apPrintReport" style="width:auto;padding:9px 20px">🖨️ طباعة قائمة المشاريع</button>
  </div>
  <div id="printAreaAP"></div>
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
  #printAreaAP{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0.22in}
    body *{visibility:hidden}
    #printAreaAP, #printAreaAP *{visibility:visible}
    #printAreaAP{display:block;position:absolute;inset-inline-start:0;top:0;width:100%}
    .ap-print-domain{background:#1a3a6b;color:#fff;padding:8px 14px;font-weight:700;margin-top:14px}
    .ap-print-ind{background:#f0faf5;border-right:3px solid #52b788;padding:5px 12px;font-weight:700;color:#2d6a4f;margin:8px 0 4px}
    .ap-print-tbl{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:8px}
    .ap-print-tbl th{background:#eef1f5;padding:5px}
    .ap-print-tbl td{border:1px solid #dee2e6;padding:5px;text-align:right}
  }
  #adminProjects.wide{max-width:1300px}
  .ap-warn-banner{background:var(--err-soft);border:1.5px solid var(--err);color:var(--err);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13.5px;font-weight:600}
  .ap-warn-banner ul{margin:6px 0 0;padding-inline-start:20px;font-weight:400}
  .ap-row{background:var(--white);border:1px solid var(--line);border-radius:11px;padding:14px 16px;margin-bottom:10px}
  .ap-row-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
  .ap-leads{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
  .ap-lead-chip{display:flex;align-items:center;gap:6px;background:var(--sand);border-radius:99px;padding:5px 12px;font-size:12.5px}
  .ap-lead-chip button{background:none;border:none;color:var(--err);cursor:pointer;font-size:12px}
  .ap-add-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;position:relative}
</style>`);

let PROJECTS=[], ALL_INDICATORS=[], PREV_PROJECTS=[];

async function initAdminProjects(){
  if($('apCreateBtn').dataset.ready) return;
  $('apCreateBtn').dataset.ready='1';
  $('apCreateBtn').addEventListener('click',createProject);
  $('apPrintReport').addEventListener('click',printReport);
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

  const {data:pLinks}=await db.from('plan_project_indicators').select('project_id,indicator_id').in('project_id',PROJECTS.map(p=>p.id));
  const linksByProject={};
  for(const l of pLinks||[]) (linksByProject[l.project_id] ??= new Set()).add(l.indicator_id);
  for(const p of PROJECTS) p.indicatorIds = linksByProject[p.id] || new Set();

  const unlinked=PROJECTS.filter(p=>!p.indicatorIds.size);
  if(unlinked.length){
    $('apUnlinkedWarn').style.display='block';
    $('apUnlinkedWarn').innerHTML=`<div class="ap-warn-banner">⚠️ يوجد ${unlinked.length} مشروع غير مربوط بأي مؤشر في الشجرة الاستراتيجية:
      <ul>${unlinked.map(p=>`<li>${p.name}</li>`).join('')}</ul></div>`;
  }else{
    $('apUnlinkedWarn').style.display='none'; $('apUnlinkedWarn').innerHTML='';
  }

  const {data:indicators}=await db.from('strategic_indicators').select('id,name, strategic_standards(name, strategic_goals(name, strategic_programs(name, strategic_domains(name))))').order('name');
  ALL_INDICATORS=indicators||[];

  const {data:otherYearProjects}=await db.from('plan_projects').select('id,name,chain_id,academic_years(name)').neq('academic_year_id',S.YEAR.id).order('name');
  PREV_PROJECTS=otherYearProjects||[];

  const {data:leads}=await db.from('staff_project_leads').select('id,staff_id,project_id, staff(full_name)').in('project_id',PROJECTS.map(p=>p.id));

  $('apList').innerHTML=PROJECTS.map(p=>{
    const projLeads=(leads||[]).filter(l=>l.project_id===p.id);
    return `<div class="ap-row" data-project="${p.id}" data-chain="${p.chain_id||''}">
      <div class="ap-row-head"><b class="ap-name-display">${p.name}</b><input type="text" class="ap-name-edit" value="${p.name}" style="display:none;font-weight:700;font-size:inherit;padding:4px 8px;border:1.5px solid var(--gold);border-radius:6px">
        <span style="display:flex;gap:8px">
          <button class="btn ghost ap-rename-btn" style="width:auto;padding:6px 14px;font-size:12px">✎ تعديل الاسم</button>
          <button class="btn ghost ap-chain-btn" style="width:auto;padding:6px 14px;font-size:12px">📈 سلسلة المشروع (عبر السنوات)</button>
          <button class="btn ghost ap-delete-btn" style="width:auto;padding:6px 14px;font-size:12px;color:var(--err);border-color:var(--err)">🗑 حذف</button>
        </span></div>
      <div class="ap-chain-panel" style="display:none;margin:8px 0;padding:10px;background:var(--sand);border-radius:8px"></div>
      <div class="ap-subgoal-row" style="margin-bottom:8px">
        <span style="font-size:12px;color:#8a93a0">المؤشرات (يمكن اختيار أكثر من واحد) — مجمَّعة حسب المجال:</span>
        <div class="ap-subgoal-chips" style="max-height:220px;overflow-y:auto;margin-top:6px;padding:8px;background:var(--sand);border-radius:8px">
          ${(()=>{
            const byDomain={};
            for(const ind of ALL_INDICATORS){
              const domainName = ind.strategic_standards?.strategic_goals?.strategic_programs?.strategic_domains?.name || 'غير مصنَّف';
              (byDomain[domainName] ??= []).push(ind);
            }
            return Object.entries(byDomain).map(([domainName,inds])=>`
              <div style="font-size:11.5px;font-weight:700;color:var(--navy);margin:8px 0 4px">${domainName}</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${inds.map(ind=>`<label style="display:flex;align-items:center;gap:5px;background:var(--white);border:1px solid var(--line);border-radius:99px;padding:4px 10px;font-size:11.5px;cursor:pointer">
                  <input type="checkbox" class="ap-subgoal-check" value="${ind.id}" ${p.indicatorIds.has(ind.id)?'checked':''}> [${ind.strategic_standards?.name||''}] ${ind.name}
                </label>`).join('')}
              </div>`).join('');
          })()}
        </div>
      </div>
      <div class="ap-link-row" style="display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-size:12px;color:#8a93a0;min-width:110px">ربط بمشروع سابق:</span>
        ${(()=>{
          const linkedPrev = p.chain_id ? PREV_PROJECTS.find(pp=>pp.chain_id===p.chain_id) : null;
          return linkedPrev
            ? `<span style="font-size:12.5px;color:var(--ok);font-weight:600">✓ مرتبط بـ "${linkedPrev.name}" (${linkedPrev.academic_years?.name||'—'})</span>`
            : `<span style="font-size:12.5px;color:var(--err)">✕ غير مرتبط بأي مشروع من سنة سابقة${PREV_PROJECTS.length?'':' — لا توجد مشاريع من سنوات سابقة بعد بقاعدة البيانات'}</span>`;
        })()}
        ${PREV_PROJECTS.length ? `<select class="ap-prev-pick" style="min-width:220px;font-size:12.5px">
          <option value="">اختاري مشروعاً من سنة سابقة للربط…</option>
          ${PREV_PROJECTS.map(pp=>`<option value="${pp.id}">${pp.name} (${pp.academic_years?.name||'—'})</option>`).join('')}
        </select>` : ''}
      </div>
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
    row.querySelector('.ap-rename-btn').addEventListener('click', async ()=>{
      const disp=row.querySelector('.ap-name-display'), inp=row.querySelector('.ap-name-edit'), btn=row.querySelector('.ap-rename-btn');
      if(inp.style.display==='none'){
        disp.style.display='none'; inp.style.display='inline-block'; inp.focus(); btn.textContent='✓ حفظ';
      }else{
        const newName=inp.value.trim();
        if(!newName){ toast('اكتبي اسم المشروع'); return; }
        const {error}=await db.from('plan_projects').update({name:newName}).eq('id',projectId);
        if(error){ toast('تعذر الحفظ: '+error.message); return; }
        toast('تم تعديل الاسم'); loadProjects();
      }
    });
    row.querySelector('.ap-delete-btn').addEventListener('click', async ()=>{
      const {data:inits}=await db.from('plan_initiatives').select('id').eq('project_id',projectId).limit(1);
      if(inits && inits.length){
        toast('لا يمكن حذف هذا المشروع — فيه مبادرات وإجراءات مسجَّلة عليه. احذفي مبادراته أولاً من "متابعة الخطة الشاملة"، أو انقليها لمشروع آخر.');
        return;
      }
      const {data:homedCommittees}=await db.from('committees').select('id').eq('home_project_id',projectId).limit(1);
      if(homedCommittees && homedCommittees.length){
        toast('لا يمكن حذف هذا المشروع — فيه لجنة (أو أكثر) بيتها الأم هذا المشروع. غيّري بيتها الأم أولاً.');
        return;
      }
      const projName=PROJECTS.find(p=>p.id===projectId)?.name||'';
      if(!confirm(`حذف مشروع "${projName}" نهائياً؟ هذا لا يمكن التراجع عنه.`)) return;
      await db.from('staff_project_leads').delete().eq('project_id',projectId);
      const {error}=await db.from('plan_projects').delete().eq('id',projectId);
      if(error){ toast('تعذر الحذف: '+error.message); return; }
      toast('تم حذف المشروع'); loadProjects();
    });
    row.querySelectorAll('.ap-subgoal-check').forEach(cb=>cb.addEventListener('change', async ()=>{
      if(cb.checked){
        const {error}=await db.from('plan_project_indicators').insert({project_id:projectId, indicator_id:cb.value});
        if(error){ toast('تعذر الربط: '+error.message); cb.checked=false; return; }
      }else{
        const {error}=await db.from('plan_project_indicators').delete().eq('project_id',projectId).eq('indicator_id',cb.value);
        if(error){ toast('تعذر إلغاء الربط: '+error.message); cb.checked=true; return; }
      }
      toast('تم الحفظ'); loadProjects();
    }));
    const prevPick=row.querySelector('.ap-prev-pick');
    if(prevPick){
      prevPick.addEventListener('change', async ()=>{
        if(!prevPick.value) return;
        const target=PREV_PROJECTS.find(pp=>pp.id===prevPick.value);
        if(!confirm(`ربط هذا المشروع بنفس سلسلة "${target.name}" (${target.academic_years?.name||'—'})؟`)){ prevPick.value=''; return; }
        const chainId = target.chain_id || crypto.randomUUID();
        if(!target.chain_id) await db.from('plan_projects').update({chain_id:chainId}).eq('id',target.id);
        await db.from('plan_projects').update({chain_id:chainId}).eq('id',projectId);
        toast('تم الربط اليدوي بنجاح'); loadProjects();
      });
    }
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

async function printReport(){
  const {data:domains}=await db.from('strategic_domains').select('id,name').eq('academic_year_id',S.YEAR.id).order('sort_order');
  if(!domains?.length){ toast('لا توجد شجرة استراتيجية مبنية بعد'); return; }

  const {data:pi}=await db.from('plan_project_indicators').select('project_id,indicator_id, plan_projects(name)');
  const {data:leads}=await db.from('staff_project_leads').select('project_id, staff(full_name)');
  const leadByProject={};
  for(const l of leads||[]) if(l.staff?.full_name) (leadByProject[l.project_id] ??= []).push(l.staff.full_name);
  const piFull={};
  for(const l of pi||[]) (piFull[l.indicator_id] ??= []).push({name:l.plan_projects?.name||'—', leads:(leadByProject[l.project_id]||[]).join('، ')||'—'});

  let body='';
  for(const dom of domains){
    const {data:programs}=await db.from('strategic_programs').select('id').eq('domain_id',dom.id);
    let domainHasContent=false, domainBody='';
    for(const prog of programs||[]){
      const {data:goals}=await db.from('strategic_goals').select('id').eq('program_id',prog.id);
      for(const goal of goals||[]){
        const {data:standards}=await db.from('strategic_standards').select('id').eq('goal_id',goal.id);
        for(const st of standards||[]){
          const {data:indicators}=await db.from('strategic_indicators').select('id,name').eq('standard_id',st.id);
          for(const ind of indicators||[]){
            const projs=piFull[ind.id];
            if(!projs?.length) continue;
            domainHasContent=true;
            domainBody+=`<div class="ap-print-ind">🔹 ${ind.name}</div>
              <table class="ap-print-tbl"><tr><th>المشروع</th><th>رئيسة المشروع</th></tr>
              ${projs.map(p=>`<tr><td>${p.name}</td><td>${p.leads}</td></tr>`).join('')}
              </table>`;
          }
        }
      }
    }
    if(domainHasContent) body+=`<div class="ap-print-domain">📁 ${dom.name}</div>${domainBody}`;
  }

  $('printAreaAP').innerHTML=`
    ${printHeaderHtml('قائمة المشاريع حسب المجال والمؤشر')}
    ${body || '<p style="text-align:center;color:#8a93a0">لا مشاريع مربوطة بأي مؤشر بعد</p>'}
    ${printFooterHtml('', S.ME?.full_name||'')}`;
  printWithTitle('المشاريع_حسب_المجال_والمؤشر','printAreaAP');
}

registerTab({id:'adminProjects', label:'متابعة المشاريع', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:f=>f.isAdmin, init:initAdminProjects});
