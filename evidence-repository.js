/* evidence-repository.js — مستودع الأدلة (تحت مجموعة "الخطة الاستراتيجية")
   كل دليل يُسجَّل تلقائياً باسم رافعته وقسمها. عند اختيار مشروع، تظهر
   فقط مبادرات/لجان قسمها هي (لا كل مبادرات المدرسة). المعلمة الأولى
   تشوف كل أدلة قسمها؛ المعلمة تشوف أدلتها هي + أدلة مشاريعها. */
import { db, $, S, clean, toast, bindDrop, registerTab } from './core.js';

const BUCKET='school-files';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="evidenceRepo" style="display:none">
  <div class="panel">
    <h3>رفع دليل جديد</h3>
    <div class="sub">يُسجَّل الدليل تلقائياً باسمك وقسمك.</div>
    <div class="dropzone" id="evDrop"><b id="evFileLabel">اختاري الملف</b><p>اضغطي لاختيار الملف أو اسحبيه هنا (صورة، PDF، أو أي مستند)</p><input type="file" id="evFile" hidden></div>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">
      <input type="text" id="evTitle" placeholder="عنوان/وصف الدليل" style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      <select id="evSemester" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)">
        <option value="1">الفصل الأول</option><option value="2">الفصل الثاني</option>
      </select>
    </div>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">
      <select id="evProjectPick" style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)"><option value="">المشروع (اختياري)…</option></select>
      <select id="evInitPick" style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)"><option value="">المبادرة من قسمك (اختياري)…</option></select>
      <select id="evCommitteePick" style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)"><option value="">اللجنة من قسمك (اختياري)…</option></select>
    </div>
    <button class="btn gold" id="evUploadBtn" style="width:auto;padding:10px 24px;margin-top:12px">رفع الدليل</button>
  </div>

  <div class="panel">
    <h3>تصفح الأدلة</h3>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <select id="evFilterProject"><option value="">كل المشاريع</option></select>
      <select id="evFilterSemester"><option value="">كل الفصول</option><option value="1">الفصل الأول</option><option value="2">الفصل الثاني</option></select>
      <select id="evFilterDept" style="display:none"><option value="">كل الأقسام</option></select>
      <div style="position:relative;min-width:200px" id="evFilterStaffBox">
        <input type="text" id="evFilterStaffSearch" placeholder="فلترة بمعلمة (اكتبي اسمها)…" autocomplete="off" style="width:100%;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
        <div class="sugg" id="evFilterStaffSugg"></div>
      </div>
    </div>
    <div id="evList"></div>
  </div>
</div>
<style>
  #evidenceRepo.wide{max-width:1300px}
  .ev-row{display:flex;justify-content:space-between;align-items:center;background:var(--white);border:1px solid var(--line);border-radius:11px;padding:12px 16px;margin-bottom:8px;flex-wrap:wrap;gap:10px}
  .ev-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
  .ev-tag{font-size:11px;padding:3px 10px;border-radius:99px;background:var(--sand);color:var(--navy);font-weight:600}
</style>`);

let EV_FILE=null, PROJECTS=[], FILTER_STAFF_ID=null;

async function initEvidenceRepo(){
  if($('evUploadBtn').dataset.ready) return;
  $('evUploadBtn').dataset.ready='1';

  const {data:projects}=await db.from('plan_projects').select('id,name').eq('academic_year_id',S.YEAR.id).order('sort_order');
  PROJECTS=projects||[];
  $('evProjectPick').innerHTML='<option value="">المشروع (اختياري)…</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  $('evFilterProject').innerHTML='<option value="">كل المشاريع</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');

  // رئيسة القسم فقط تشوف فلتر "بالقسم" (لعرض كل الأقسام)، لغرض المراجعة الإدارية الأوسع لو احتاجت
  if(S.FLAGS.isAdmin||S.FLAGS.isLead||S.FLAGS.isStrategicPlanLead){
    const {data:depts}=await db.from('departments').select('id,name').order('name');
    $('evFilterDept').innerHTML='<option value="">كل الأقسام</option>'+(depts||[]).map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
    $('evFilterDept').style.display='inline-block';
    $('evFilterDept').addEventListener('change',loadEvidence);
  }

  bindDrop($('evDrop'),$('evFile'), f=>{ EV_FILE=f; $('evFileLabel').textContent=`الملف: ${f.name}`; });
  $('evProjectPick').addEventListener('change',loadDeptScopedOptions);
  $('evUploadBtn').addEventListener('click',uploadEvidence);
  $('evFilterProject').addEventListener('change',loadEvidence);
  $('evFilterSemester').addEventListener('change',loadEvidence);

  let deb=null;
  $('evFilterStaffSearch').addEventListener('input',()=>{
    FILTER_STAFF_ID=null;
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const q=clean($('evFilterStaffSearch').value); const box=$('evFilterStaffSugg');
      if(q.length<2){ box.style.display='none'; if(!q) loadEvidence(); return; }
      const {data:st}=await db.from('staff').select('id,full_name').ilike('full_name',`%${q}%`).limit(6);
      if(!(st||[]).length){ box.style.display='none'; return; }
      box.innerHTML=st.map((s,i)=>`<div data-i="${i}">${s.full_name}</div>`).join('');
      box.style.display='block';
      box.querySelectorAll('div').forEach((el,i)=>el.addEventListener('click',()=>{
        $('evFilterStaffSearch').value=st[i].full_name; FILTER_STAFF_ID=st[i].id; box.style.display='none'; loadEvidence();
      }));
    },250);
  });

  await loadEvidence();
}

async function loadDeptScopedOptions(){
  const projectId=$('evProjectPick').value;
  $('evInitPick').innerHTML='<option value="">المبادرة من قسمك (اختياري)…</option>';
  $('evCommitteePick').innerHTML='<option value="">اللجنة من قسمك (اختياري)…</option>';
  if(!projectId || !S.ME.department_id) return;

  // مبادرات هذا المشروع التابعة لقسمها فقط
  const {data:inits}=await db.from('plan_initiatives').select('id,name').eq('project_id',projectId).eq('department_id',S.ME.department_id);
  $('evInitPick').innerHTML='<option value="">المبادرة من قسمك (اختياري)…</option>'+(inits||[]).map(i=>`<option value="${i.id}">${i.name}</option>`).join('');

  // لجان هذا المشروع اللي فيها عضوة من نفس قسمها
  const {data:staffInDept}=await db.from('staff').select('id').eq('department_id',S.ME.department_id);
  const deptStaffIds=(staffInDept||[]).map(s=>s.id);
  const {data:committeesOfProject}=await db.from('committees').select('id,name').eq('home_project_id',projectId).eq('academic_year_id',S.YEAR.id);
  const relevantCommittees=[];
  for(const c of committeesOfProject||[]){
    const {data:members}=await db.from('committee_members').select('staff_id').eq('committee_id',c.id).in('staff_id',deptStaffIds.length?deptStaffIds:['00000000-0000-0000-0000-000000000000']);
    if(members?.length) relevantCommittees.push(c);
  }
  $('evCommitteePick').innerHTML='<option value="">اللجنة من قسمك (اختياري)…</option>'+relevantCommittees.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
}

async function uploadEvidence(){
  if(!EV_FILE){ toast('اختاري ملفاً أولاً'); return; }
  if(!S.ME.department_id){ toast('حسابك غير مرتبط بقسم — راجعي الدعم الفني'); return; }
  const title=clean($('evTitle').value);
  const btn=$('evUploadBtn'); btn.disabled=true; btn.textContent='جارٍ الرفع…';
  try{
    const ext=(/\.([a-zA-Z0-9]+)$/.exec(EV_FILE.name)?.[1]||'dat').toLowerCase();
    const path=`evidence/${S.YEAR.id}/${Date.now()}.${ext}`;
    const {error:upErr}=await db.storage.from(BUCKET).upload(path,EV_FILE);
    if(upErr) throw upErr;
    const {error}=await db.from('evidence_files').insert({
      file_path:path, file_name:EV_FILE.name, title:title||null,
      academic_year_id:S.YEAR.id, semester:+$('evSemester').value,
      staff_id:S.ME.id, department_id:S.ME.department_id,
      project_id:$('evProjectPick').value||null,
      initiative_id:$('evInitPick').value||null, committee_id:$('evCommitteePick').value||null,
      uploaded_by:S.ME.id
    });
    if(error) throw error;
    toast('تم رفع الدليل بنجاح');
    EV_FILE=null; $('evFileLabel').textContent='اختاري الملف'; $('evTitle').value='';
    $('evProjectPick').value=''; $('evInitPick').innerHTML='<option value="">المبادرة من قسمك (اختياري)…</option>'; $('evCommitteePick').innerHTML='<option value="">اللجنة من قسمك (اختياري)…</option>';
    loadEvidence();
  }catch(err){ toast('تعذر الرفع: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='رفع الدليل'; }
}

async function getMyProjectIds(){
  // مشاريع لجانها التي هي عضوة فيها — لعرض "أدلة مشاريعي" للمعلمة العادية
  const {data:memberships}=await db.from('committee_members').select('committee_id').eq('staff_id',S.ME.id);
  const committeeIds=(memberships||[]).map(m=>m.committee_id);
  if(!committeeIds.length) return [];
  const {data:committees}=await db.from('committees').select('home_project_id').in('id',committeeIds);
  return [...new Set((committees||[]).map(c=>c.home_project_id).filter(Boolean))];
}

async function loadEvidence(){
  const projFilter=$('evFilterProject').value, semFilter=$('evFilterSemester').value;
  const deptFilter=$('evFilterDept')?.value;
  let query=db.from('evidence_files').select('*, staff:staff_id(full_name), departments(name), plan_projects(name), plan_initiatives(name), committees(name)').eq('academic_year_id',S.YEAR.id).order('created_at',{ascending:false});
  if(projFilter) query=query.eq('project_id',projFilter);
  if(semFilter) query=query.eq('semester',+semFilter);
  if(deptFilter) query=query.eq('department_id',deptFilter);
  if(FILTER_STAFF_ID) query=query.eq('staff_id',FILTER_STAFF_ID);

  const canSeeAll = S.FLAGS.isAdmin || S.FLAGS.isLead || S.FLAGS.isStrategicPlanLead;
  if(!canSeeAll && S.FLAGS.isSeniorTeacher && S.ME.department_id){
    query=query.eq('department_id',S.ME.department_id);
  }else if(!canSeeAll){
    const myProjectIds=await getMyProjectIds();
    const orParts=[`uploaded_by.eq.${S.ME.id}`];
    if(myProjectIds.length) orParts.push(`project_id.in.(${myProjectIds.join(',')})`);
    query=query.or(orParts.join(','));
  }

  const {data,error}=await query;
  if(error){ $('evList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!data?.length){ $('evList').innerHTML='<div class="empty-day">لا أدلة بعد.</div>'; return; }

  $('evList').innerHTML=data.map(e=>{
    const url=db.storage.from(BUCKET).getPublicUrl(e.file_path).data.publicUrl;
    const tags=[];
    if(e.semester) tags.push(`الفصل ${e.semester===1?'الأول':'الثاني'}`);
    if(e.plan_projects?.name) tags.push(e.plan_projects.name);
    if(e.plan_initiatives?.name) tags.push(e.plan_initiatives.name);
    if(e.committees?.name) tags.push(e.committees.name);
    if(e.staff?.full_name) tags.push(e.staff.full_name);
    if(e.departments?.name) tags.push(e.departments.name);
    return `<div class="ev-row">
      <div><b>${e.title||e.file_name}</b><div class="ev-tags">${tags.map(t=>`<span class="ev-tag">${t}</span>`).join('')}</div></div>
      <a href="${url}" target="_blank" class="btn ghost" style="width:auto;padding:8px 18px">⬇ تنزيل</a>
    </div>`;
  }).join('');
}

registerTab({id:'evidenceRepo', label:'مستودع الأدلة', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:()=>true, init:initEvidenceRepo});
