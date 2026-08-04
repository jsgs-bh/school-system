/* committees.js — اللجان (تحت مجموعة "الخطة الاستراتيجية")
   كل لجنة لها مشروع أم واحد إلزامي، وربط اختياري بمشاريع مستفيدة —
   "بيت واحد + ربط متعدد" كما في الوثيقة المعتمدة. صفحة اللجنة تجمع
   أعضاءها ومهامها ومحاضر اجتماعاتها في مكان واحد. */
import { db, $, S, clean, toast, bindDrop, printWithTitle, printHeaderHtml, printFooterHtml, registerTab } from './core.js';

const BUCKET='school-files';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="committeesMain" style="display:none">
  <div id="cmListView">
    <div class="panel" id="cmCreatePanel" style="display:none">
      <h3>إنشاء لجنة جديدة</h3>
      <div class="field"><label>اسم اللجنة</label><input type="text" id="cmNewName"></div>
      <div class="field"><label>نوع اللجنة</label><select id="cmNewType">
        <option value="teachers">معلمات فقط</option>
        <option value="students">طالبات فقط</option>
        <option value="mixed">معلمات وطالبات</option>
      </select></div>
      <div class="field"><label>المشروع الأم (إلزامي)</label><select id="cmNewHome"></select></div>
      <div class="field"><label>مشاريع مستفيدة (اختياري)</label>
        <div id="cmNewBeneficiaries" style="display:flex;flex-wrap:wrap;gap:8px;padding:10px;background:var(--sand);border-radius:8px"></div>
      </div>
      <button class="btn gold" id="cmCreateBtn" style="width:auto;padding:10px 24px">إنشاء اللجنة</button>
    </div>
    <div class="panel">
      <h3>اللجان الحالية</h3>
      <div id="cmList"></div>
    </div>
  </div>

  <div id="cmDetailView" style="display:none">
    <div class="panel">
      <button class="btn ghost" id="cmBack" style="width:auto;padding:8px 18px;margin-bottom:10px">→ رجوع لكل اللجان</button>
      <h3 id="cmDetailName">—</h3>
      <div class="sub" id="cmDetailMeta"></div>
    </div>
    <div class="panel">
      <h3>الأعضاء</h3>
      <div class="search-row"><input type="text" id="cmMemberSearch" placeholder="ابحثي عن منتسبة أو طالبة لإضافتها…"></div>
      <div class="sugg" id="cmMemberSugg"></div>
      <div id="cmMembersList" style="margin-top:12px"></div>
      <button class="btn ghost" id="cmPrintAssignment" style="width:auto;padding:9px 20px;margin-top:10px;display:none">🖨️ طباعة قرار التكليف (المعلمات)</button>
    </div>
    <div class="panel">
      <h3>إجراءات اللجنة (تظهر تلقائياً في الخطة التدفقية للمشروع)</h3>
      <div class="sub">سطر واحد في مربع النص = إجراء واحد مستقل بتوقيته وحالته الخاصة.</div>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
        <textarea id="cmActionText" placeholder="نص الإجراء — سطر واحد = إجراء واحد" rows="2" style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;resize:vertical"></textarea>
        <div style="position:relative;min-width:180px">
          <input type="text" id="cmActionResp" placeholder="المسؤولة (ابحثي)" autocomplete="off" style="width:100%;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
          <div class="sugg" id="cmActionRespSugg"></div>
        </div>
        <select id="cmActionMonth" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)">
          <option value="sep">سبتمبر</option><option value="oct">أكتوبر</option><option value="nov">نوفمبر</option><option value="dec">ديسمبر</option><option value="jan">يناير</option>
          <option value="feb">فبراير</option><option value="mar">مارس</option><option value="apr">أبريل</option><option value="may">مايو</option><option value="jun">يونيو</option>
        </select>
        <button class="btn gold" id="cmActionAdd" style="width:auto;padding:9px 20px">إضافة</button>
      </div>
      <div id="cmActionsList"></div>
    </div>
    <div class="panel">
      <h3>المهام والتكليفات</h3>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
        <input type="text" id="cmTaskText" placeholder="نص المهمة" style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
        <select id="cmTaskDept" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)"><option value="">القسم المعنيّ…</option></select>
        <input type="date" id="cmTaskDue" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
        <button class="btn gold" id="cmTaskAdd" style="width:auto;padding:9px 20px">إضافة</button>
      </div>
      <div id="cmTasksList"></div>
    </div>
    <div class="panel">
      <h3>محاضر الاجتماعات</h3>
      <div id="cmMinuteFormBox">
        <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px">
          <input type="date" id="cmMinuteDate" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
          <input type="text" id="cmMinuteSummary" placeholder="ملخص الاجتماع" style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
        </div>
        <div class="dropzone" id="cmMinuteDrop"><b id="cmMinuteFileLabel">مرفق المحضر (اختياري)</b><p>اضغطي لاختيار الملف</p>
          <input type="file" id="cmMinuteFile" hidden></div>
        <div class="actions" style="margin-top:10px">
          <button class="btn gold" id="cmMinuteAdd" style="width:auto;padding:9px 20px">حفظ المحضر</button>
          <button class="btn ghost" id="cmPrintInvite" style="width:auto;padding:9px 20px">🖨️ طباعة دعوة اجتماع</button>
          <button class="btn ghost" id="cmPrintAttendance" style="width:auto;padding:9px 20px">🖨️ طباعة استمارة حضور</button>
        </div>
      </div>
      <div id="cmMinuteNoAccess" style="display:none" class="empty-day">محاضر الاجتماعات تُنشأ فقط من رئيسة اللجنة أو أحد أعضائها.</div>
      <div id="cmMinutesList" style="margin-top:14px"></div>
    </div>
    <div class="panel">
      <h3>التقرير الختامي للجنة</h3>
      <div class="sub" id="cmFinalStats"></div>
      <div class="field"><label>قياس الأثر</label><textarea id="cmImpactText" rows="3" placeholder="وصف الأثر الفعلي لعمل اللجنة على الطالبات..."></textarea></div>
      <div class="field"><label>المهارات التي تم تطويرها</label><textarea id="cmSkillsText" rows="3" placeholder="المهارات المكتسبة من خلال أنشطة اللجنة..."></textarea></div>
      <button class="btn gold" id="cmFinalPrintBtn" style="width:auto;padding:9px 20px">🖨️ طباعة التقرير الختامي</button>
    </div>
  </div>
</div>
<div id="printAreaCM"></div>
<div id="printAreaCMFinal"></div>
<style>
  #printAreaCMFinal{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0.22in}
    body *{visibility:hidden}
    #printAreaCMFinal, #printAreaCMFinal *{visibility:visible}
    #printAreaCMFinal{display:block;position:absolute;inset-inline-start:0;top:0;width:100%}
  }
</style>
<style>
  #printAreaCM{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0.22in}
    body *{visibility:hidden}
    #printAreaCM, #printAreaCM *{visibility:visible}
    #printAreaCM{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:0}
    .cm-print-tbl{width:100%;border-collapse:collapse;font-size:11px;margin-top:14px}
    .cm-print-tbl th,.cm-print-tbl td{border:1px solid #ccc;padding:8px;text-align:center}
    .cm-print-tbl th{background:#1d3d5c;color:#fff}
  }
</style>
<style>
  #committeesMain.wide{max-width:1400px}
  .cm-action-row{display:flex;gap:10px;align-items:center;padding:8px 16px;border-bottom:1px solid #f2f0ea;flex-wrap:wrap;background:var(--white);border-radius:8px;margin-bottom:6px}
  .cm-action-text{flex:1;min-width:200px;font-size:13px}
  .cm-action-edit-input{flex:1;min-width:200px;padding:6px 8px;border:1.5px solid var(--gold);border-radius:6px;font:inherit;font-size:13px}
  .cm-status{padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  .cm-row{display:flex;justify-content:space-between;align-items:center;background:var(--white);border:1px solid var(--line);border-radius:11px;padding:12px 16px;margin-bottom:8px;cursor:pointer}
  .cm-row:hover{border-color:var(--gold)}
  .cm-tag{font-size:11px;padding:3px 10px;border-radius:99px;background:#eef1f5;color:var(--navy);font-weight:700}
  .cm-benef-chip{display:flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--line);border-radius:99px;padding:6px 12px;cursor:pointer;font-size:12.5px}
  .cm-benef-chip.on{background:var(--navy);color:#fff;border-color:var(--navy)}
  .cm-status{padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
</style>`);

let PROJECTS=[], SELECTED_BENEFICIARIES=new Set(), CUR_COMMITTEE=null, CUR_MINUTE_FILE=null;

async function initCommittees(){
  if($('cmCreateBtn').dataset.ready) return;
  $('cmCreateBtn').dataset.ready='1';
  const CAN_CREATE = S.FLAGS.isAdmin || S.FLAGS.isStrategicPlanLead;
  $('cmCreatePanel').style.display = CAN_CREATE ? 'block' : 'none';
  const {data:projects}=await db.from('plan_projects').select('id,name').eq('academic_year_id',S.YEAR.id).order('sort_order');
  PROJECTS=projects||[];
  $('cmNewHome').innerHTML='<option value="">اختاري المشروع الأم…</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  const {data:depts}=await db.from('departments').select('id,name').order('name');
  $('cmTaskDept').innerHTML='<option value="">القسم المعنيّ…</option>'+(depts||[]).map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
  $('cmNewBeneficiaries').innerHTML=PROJECTS.map(p=>`<div class="cm-benef-chip" data-id="${p.id}">${p.name}</div>`).join('');
  $('cmNewBeneficiaries').querySelectorAll('.cm-benef-chip').forEach(chip=>chip.addEventListener('click',()=>{
    const id=chip.dataset.id;
    if(SELECTED_BENEFICIARIES.has(id)){ SELECTED_BENEFICIARIES.delete(id); chip.classList.remove('on'); }
    else{ SELECTED_BENEFICIARIES.add(id); chip.classList.add('on'); }
  }));
  $('cmCreateBtn').addEventListener('click',createCommittee);
  $('cmBack').addEventListener('click',()=>{ $('cmDetailView').style.display='none'; $('cmListView').style.display='block'; loadCommittees(); });
  bindDrop($('cmMinuteDrop'),$('cmMinuteFile'), f=>{ CUR_MINUTE_FILE=f; $('cmMinuteFileLabel').textContent=`مرفق: ${f.name}`; });
  $('cmTaskAdd').addEventListener('click',addTask);
  $('cmActionAdd').addEventListener('click',addCommitteeAction);
  bindActionRespSearch();
  $('cmMinuteAdd').addEventListener('click',addMinute);
  $('cmPrintAssignment').addEventListener('click',printAssignment);
  $('cmPrintInvite').addEventListener('click',printInvite);
  $('cmPrintAttendance').addEventListener('click',printAttendance);
  $('cmFinalPrintBtn').addEventListener('click',printFinalReport);
  let deb=null;
  $('cmMemberSearch').addEventListener('input',()=>{
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const q=clean($('cmMemberSearch').value); const box=$('cmMemberSugg');
      if(q.length<2){ box.style.display='none'; return; }
      const results=[];
      if(CUR_COMMITTEE.type==='teachers'||CUR_COMMITTEE.type==='mixed'){
        const {data:st}=await db.from('staff').select('id,full_name').ilike('full_name',`%${q}%`).limit(6);
        for(const s of st||[]) results.push({kind:'staff', id:s.id, name:s.full_name});
      }
      if(CUR_COMMITTEE.type==='students'||CUR_COMMITTEE.type==='mixed'){
        const {data:stu}=await db.from('students').select('id,full_name,academic_number').ilike('full_name',`%${q}%`).limit(6);
        for(const s of stu||[]) results.push({kind:'student', id:s.id, name:`${s.full_name} (${s.academic_number})`});
      }
      if(!results.length){ box.style.display='none'; return; }
      box.innerHTML=results.map((r,i)=>`<div data-i="${i}">${r.name}${r.kind==='student'?' <small>(طالبة)</small>':''}</div>`).join('');
      box.style.display='block';
      box.querySelectorAll('div').forEach((el,i)=>el.addEventListener('click',()=>addMember(results[i])));
    },250);
  });
  await loadCommittees();
}

async function createCommittee(){
  const name=clean($('cmNewName').value);
  const homeProjectId=$('cmNewHome').value;
  const type=$('cmNewType').value;
  if(!name){ toast('اكتبي اسم اللجنة'); return; }
  if(!homeProjectId){ toast('اختاري المشروع الأم — إلزامي لكل لجنة'); return; }
  const btn=$('cmCreateBtn'); btn.disabled=true;
  try{
    const {data:committee,error}=await db.from('committees').insert({
      academic_year_id:S.YEAR.id, name, type, home_project_id:homeProjectId, head_staff_id:S.ME.id
    }).select('id').single();
    if(error) throw error;
    if(SELECTED_BENEFICIARIES.size){
      await db.from('committee_beneficiary_projects').insert([...SELECTED_BENEFICIARIES].map(pid=>({committee_id:committee.id, project_id:pid})));
    }
    // اللجنة تُمثَّل كمبادرة ضمن خطة مشروعها الأم، ولها إجراء أول (تشكيلها)
    const now=new Date(); const jsMonth=now.getMonth(); // 0=يناير
    const monthMap={8:'sep',9:'oct',10:'nov',11:'dec',0:'jan',1:'feb',2:'mar',3:'apr',4:'may',5:'jun'};
    const curMonth = monthMap[jsMonth] || 'sep';
    const {data:initiative,error:initErr}=await db.from('plan_initiatives').insert({
      project_id:homeProjectId, name:`لجنة: ${name}`, created_by:S.ME.id
    }).select('id').single();
    if(!initErr && initiative){
      await db.from('plan_actions').insert({
        initiative_id:initiative.id, text:`تشكيل ومتابعة لجنة: ${name}`, responsible:S.ME.full_name,
        responsible_staff_id:S.ME.id, month:curMonth, status:'not_started', created_by:S.ME.id
      });
      await db.from('committees').update({initiative_id:initiative.id}).eq('id',committee.id);
    }
    toast('تم إنشاء اللجنة وربطها كمبادرة في خطة المشروع');
    $('cmNewName').value=''; $('cmNewHome').value=''; SELECTED_BENEFICIARIES.clear();
    $('cmNewBeneficiaries').querySelectorAll('.cm-benef-chip').forEach(c=>c.classList.remove('on'));
    loadCommittees();
  }catch(err){ toast('تعذر الإنشاء: '+(err.message||err)); }
  finally{ btn.disabled=false; }
}

const TYPE_LABEL={teachers:'معلمات', students:'طالبات', mixed:'معلمات وطالبات'};
async function loadCommittees(){
  const canSeeAll = S.FLAGS.isAdmin || S.FLAGS.isStrategicPlanLead || S.FLAGS.isLead;
  let allowedIds=null;
  if(!canSeeAll && S.FLAGS.isSeniorTeacher && S.ME.department_id){
    // المعلمة الأولى: كل لجان قسمها (اللي فيها عضوة واحدة على الأقل من قسمها) + لجانها هي
    const {data:deptStaff}=await db.from('staff').select('id').eq('department_id',S.ME.department_id);
    const deptStaffIds=(deptStaff||[]).map(s=>s.id);
    const {data:deptMemberships}=deptStaffIds.length
      ? await db.from('committee_members').select('committee_id').in('staff_id',deptStaffIds)
      : {data:[]};
    allowedIds=[...new Set([...(deptMemberships||[]).map(m=>m.committee_id), ...S.MY_COMMITTEE_IDS])];
  }else if(!canSeeAll){
    allowedIds=S.MY_COMMITTEE_IDS;
  }
  let query = db.from('committees')
    .select('id,name,type,home_project_id, plan_projects(name), committee_beneficiary_projects(plan_projects(name))')
    .eq('academic_year_id',S.YEAR.id).order('created_at',{ascending:false});
  if(allowedIds!==null) query = query.in('id', allowedIds.length ? allowedIds : ['00000000-0000-0000-0000-000000000000']);
  const {data,error}=await query;
  if(error){ $('cmList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!data?.length){ $('cmList').innerHTML='<div class="empty-day">لا لجان بعد.</div>'; return; }
  $('cmList').innerHTML=data.map(c=>{
    const benef=(c.committee_beneficiary_projects||[]).map(b=>b.plan_projects?.name).filter(Boolean);
    return `<div class="cm-row" data-id="${c.id}">
      <span><b>${c.name}</b> <span class="cm-tag">${TYPE_LABEL[c.type]||c.type}</span><br><small style="color:#8a93a0">البيت: ${c.plan_projects?.name||'—'}${benef.length?` — مستفيدة أيضاً: ${benef.join('، ')}`:''}</small></span>
      <span class="cm-tag">فتح ›</span></div>`;
  }).join('');
  $('cmList').querySelectorAll('.cm-row').forEach(el=>el.addEventListener('click',()=>openCommittee(el.dataset.id)));
}

async function openCommittee(id){
  const {data:c}=await db.from('committees').select('id,name,type,home_project_id,head_staff_id,initiative_id,impact_text,skills_text, plan_projects(name)').eq('id',id).single();
  if(!c) return;
  CUR_COMMITTEE=c;
  $('cmListView').style.display='none'; $('cmDetailView').style.display='block';
  $('cmDetailName').textContent=c.name;
  $('cmDetailMeta').textContent=`المشروع الأم: ${c.plan_projects?.name||'—'} — نوع اللجنة: ${TYPE_LABEL[c.type]||c.type}`;
  $('cmImpactText').value=c.impact_text||''; $('cmSkillsText').value=c.skills_text||'';
  await loadMembers(); await loadCommitteeActions(); await loadTasks(); await checkMinuteAccess(); await loadMinutes(); await loadFinalStats();
}

async function loadFinalStats(){
  if(!CUR_COMMITTEE.initiative_id){ $('cmFinalStats').textContent=''; return; }
  const {data:actions}=await db.from('plan_actions').select('id,status').eq('initiative_id',CUR_COMMITTEE.initiative_id);
  const total=(actions||[]).length, done=(actions||[]).filter(a=>a.status==='done').length;
  $('cmFinalStats').textContent=`عدد الفعاليات/المسابقات المسجَّلة لهذي اللجنة: ${total} — منجَز: ${done}`;
}

async function checkMinuteAccess(){
  const isHead = CUR_COMMITTEE.head_staff_id === S.ME.id;
  let isMember = false;
  if(!isHead){
    const {data}=await db.from('committee_members').select('id').eq('committee_id',CUR_COMMITTEE.id).eq('staff_id',S.ME.id).maybeSingle();
    isMember = !!data;
  }
  const canManage = isHead || isMember;
  $('cmMinuteFormBox').style.display = canManage ? 'block' : 'none';
  $('cmMinuteNoAccess').style.display = canManage ? 'none' : 'block';
}

async function loadMembers(){
  const {data}=await db.from('committee_members').select('id,staff_id,student_id,is_head, staff(full_name), students(full_name,academic_number)').eq('committee_id',CUR_COMMITTEE.id);
  const members=data||[];
  $('cmMembersList').innerHTML=members.length ? members.map(m=>{
    const label = m.staff ? m.staff.full_name : (m.students ? `${m.students.full_name} (${m.students.academic_number}) — طالبة` : '—');
    return `<div class="cm-row" style="cursor:default"><span>${label}${m.is_head?' <span class="cm-tag">رئيسة</span>':''}</span>
      <button class="btn ghost" data-id="${m.id}" style="width:auto;padding:6px 14px;font-size:12px;color:var(--err);border-color:var(--err)">✕ إزالة</button></div>`;
  }).join('') : '<div class="empty-day">لا أعضاء بعد.</div>';
  $('cmMembersList').querySelectorAll('button').forEach(b=>b.addEventListener('click', async ()=>{
    await db.from('committee_members').delete().eq('id',b.dataset.id);
    loadMembers();
  }));
  const hasTeachers = members.some(m=>m.staff_id);
  $('cmPrintAssignment').style.display = hasTeachers ? 'inline-block' : 'none';
}
async function addMember(item){
  $('cmMemberSugg').style.display='none'; $('cmMemberSearch').value='';
  const payload = item.kind==='staff'
    ? {committee_id:CUR_COMMITTEE.id, staff_id:item.id}
    : {committee_id:CUR_COMMITTEE.id, student_id:item.id};
  const {error}=await db.from('committee_members').insert(payload);
  if(error){ toast(/duplicate|unique/i.test(error.message)?'العضوة مضافة مسبقاً':'تعذرت الإضافة'); return; }
  toast('تمت الإضافة'); loadMembers();
}

const CM_MONTH_LABELS={sep:'سبتمبر',oct:'أكتوبر',nov:'نوفمبر',dec:'ديسمبر',jan:'يناير',feb:'فبراير',mar:'مارس',apr:'أبريل',may:'مايو',jun:'يونيو'};
const CM_STATUS_LABEL={not_started:'لم يبدأ', in_progress:'جاري التنفيذ', done:'تم التنفيذ'};
let CM_PICKED_RESP_STAFF_ID=null;

function bindActionRespSearch(){
  const inp=$('cmActionResp'), box=$('cmActionRespSugg');
  let deb=null;
  inp.addEventListener('input',()=>{
    CM_PICKED_RESP_STAFF_ID=null;
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const q=inp.value.trim();
      if(q.length<2){ box.style.display='none'; return; }
      const {data:st}=await db.from('staff').select('id,full_name').ilike('full_name',`%${q}%`).limit(6);
      if(!(st||[]).length){ box.style.display='none'; return; }
      box.innerHTML=st.map((s,i)=>`<div data-i="${i}">${s.full_name}</div>`).join('');
      box.style.display='block';
      box.querySelectorAll('div').forEach((el,i)=>el.addEventListener('click',()=>{
        inp.value=st[i].full_name; CM_PICKED_RESP_STAFF_ID=st[i].id; box.style.display='none';
      }));
    },250);
  });
}

async function loadCommitteeActions(){
  if(!CUR_COMMITTEE.initiative_id){ $('cmActionsList').innerHTML='<div class="empty-day">هذي اللجنة غير مربوطة بمبادرة (حالة استثنائية) — راجعي الدعم الفني.</div>'; return; }
  const {data,error}=await db.from('plan_actions').select('*').eq('initiative_id',CUR_COMMITTEE.initiative_id).order('created_at');
  if(error){ $('cmActionsList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  const actions=data||[];
  if(!actions.length){ $('cmActionsList').innerHTML='<div class="empty-day">لا إجراءات بعد.</div>'; return; }
  $('cmActionsList').innerHTML=actions.map(a=>`<div class="cm-action-row" data-id="${a.id}">
    <span class="cm-action-text" data-role="text">${a.text}</span>
    <span style="font-size:12px;color:#8a93a0" data-role="meta">${CM_MONTH_LABELS[a.month]||a.month}${a.responsible?' — '+a.responsible:''}</span>
    <select class="cm-status" data-role="status">${Object.entries(CM_STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${a.status===k?'selected':''}>${v}</option>`).join('')}</select>
    <button class="btn ghost cm-small-btn" data-role="edit" style="width:auto;padding:6px 12px;font-size:11px">✎ تعديل</button>
    <button class="btn ghost cm-small-btn" data-role="del" style="width:auto;padding:6px 12px;font-size:11px;color:var(--err);border-color:var(--err)">✕ حذف</button>
  </div>`).join('');

  $('cmActionsList').querySelectorAll('.cm-action-row').forEach(row=>{
    const id=row.dataset.id, action=actions.find(a=>a.id===id);
    row.querySelector('[data-role="status"]').addEventListener('change', async (e)=>{
      const {error}=await db.from('plan_actions').update({status:e.target.value, updated_at:new Date().toISOString()}).eq('id',id);
      if(error){ toast('تعذر الحفظ: '+error.message); return; }
      toast('تم الحفظ');
    });
    row.querySelector('[data-role="del"]').addEventListener('click', async ()=>{
      if(!confirm('حذف هذا الإجراء؟')) return;
      await db.from('plan_actions').delete().eq('id',id);
      toast('تم الحذف'); loadCommitteeActions();
    });
    row.querySelector('[data-role="edit"]').addEventListener('click', ()=>{
      const textSpan=row.querySelector('[data-role="text"]'), metaSpan=row.querySelector('[data-role="meta"]');
      const textInput=document.createElement('textarea'); textInput.className='cm-action-edit-input'; textInput.value=action.text; textInput.rows=2;
      const monthSel=document.createElement('select'); monthSel.className='cm-status';
      monthSel.innerHTML=Object.entries(CM_MONTH_LABELS).map(([k,v])=>`<option value="${k}" ${k===action.month?'selected':''}>${v}</option>`).join('');
      const respInput=document.createElement('input'); respInput.type='text'; respInput.className='cm-action-edit-input';
      respInput.placeholder='المسؤولة'; respInput.value=action.responsible||''; respInput.style.minWidth='140px';
      const saveBtn=document.createElement('button'); saveBtn.className='btn gold cm-small-btn'; saveBtn.style.cssText='width:auto;padding:6px 12px;font-size:11px'; saveBtn.textContent='✓ حفظ';
      textSpan.replaceWith(textInput); metaSpan.replaceWith(monthSel);
      row.querySelector('[data-role="edit"]').replaceWith(saveBtn);
      textInput.after(respInput);
      textInput.focus();
      saveBtn.addEventListener('click', async ()=>{
        const newText=textInput.value.trim();
        if(!newText){ toast('نص الإجراء لا يمكن أن يكون فاضياً'); return; }
        const {error}=await db.from('plan_actions').update({text:newText, month:monthSel.value, responsible:respInput.value.trim()||null, updated_at:new Date().toISOString()}).eq('id',id);
        if(error){ toast('تعذر الحفظ: '+error.message); return; }
        toast('تم الحفظ'); loadCommitteeActions();
      });
    });
  });
}

async function addCommitteeAction(){
  if(!CUR_COMMITTEE.initiative_id){ toast('هذي اللجنة غير مربوطة بمبادرة'); return; }
  const raw=$('cmActionText').value;
  const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean);
  if(!lines.length){ toast('اكتبي نص الإجراء'); return; }
  const resp=clean($('cmActionResp').value)||null;
  const month=$('cmActionMonth').value;
  const rows=lines.map(text=>({
    initiative_id:CUR_COMMITTEE.initiative_id, text, responsible:resp, responsible_staff_id:CM_PICKED_RESP_STAFF_ID, month, status:'not_started', created_by:S.ME.id
  }));
  const {error}=await db.from('plan_actions').insert(rows);
  if(error){ toast('تعذر الإضافة: '+error.message); return; }
  $('cmActionText').value=''; $('cmActionResp').value=''; CM_PICKED_RESP_STAFF_ID=null;
  toast(lines.length>1?`تمت إضافة ${lines.length} إجراءات`:'تمت الإضافة');
  loadCommitteeActions();
}

async function loadTasks(){
  const {data}=await db.from('committee_tasks').select('*, departments(name)').eq('committee_id',CUR_COMMITTEE.id).order('created_at');
  const tasks=data||[];
  const STATUS_LABEL={not_started:'لم يبدأ', in_progress:'جاري', done:'تم'};
  $('cmTasksList').innerHTML=tasks.length ? tasks.map(t=>`
    <div class="cm-row" style="cursor:default"><span>${t.text} <span class="cm-tag">${t.departments?.name||'—'}</span>${t.due_date?` <small style="color:#8a93a0">(${t.due_date})</small>`:''}</span>
      <select class="cm-status" data-id="${t.id}">${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${t.status===k?'selected':''}>${v}</option>`).join('')}</select></div>`).join('')
    : '<div class="empty-day">لا مهام بعد.</div>';
  $('cmTasksList').querySelectorAll('select').forEach(sel=>sel.addEventListener('change', async ()=>{
    await db.from('committee_tasks').update({status:sel.value}).eq('id',sel.dataset.id);
    toast('تم الحفظ');
  }));
}
async function addTask(){
  const text=clean($('cmTaskText').value);
  if(!text){ toast('اكتبي نص المهمة'); return; }
  const departmentId=$('cmTaskDept').value;
  if(!departmentId){ toast('حددي القسم المعنيّ بهذي المهمة'); return; }
  const due=$('cmTaskDue').value||null;
  await db.from('committee_tasks').insert({committee_id:CUR_COMMITTEE.id, text, department_id:departmentId, due_date:due, assigned_to:null});
  $('cmTaskText').value=''; $('cmTaskDue').value=''; $('cmTaskDept').value='';
  toast('تمت الإضافة'); loadTasks();
}

async function loadMinutes(){
  const {data}=await db.from('committee_minutes').select('*').eq('committee_id',CUR_COMMITTEE.id).order('meeting_date',{ascending:false});
  const minutes=data||[];
  $('cmMinutesList').innerHTML=minutes.length ? minutes.map(m=>{
    const url = m.attachment_path ? db.storage.from(BUCKET).getPublicUrl(m.attachment_path).data.publicUrl : null;
    return `<div class="cm-row" style="cursor:default"><span><b>${m.meeting_date}</b> — ${m.summary||'—'}</span>
      ${url?`<a href="${url}" target="_blank" class="cm-tag">⬇ المرفق</a>`:''}</div>`;
  }).join('') : '<div class="empty-day">لا محاضر بعد.</div>';
}
async function addMinute(){
  const date=$('cmMinuteDate').value;
  if(!date){ toast('حددي تاريخ الاجتماع'); return; }
  const summary=clean($('cmMinuteSummary').value)||null;
  let attachment_path=null, attachment_name=null;
  if(CUR_MINUTE_FILE){
    const ext=(/\.([a-zA-Z0-9]+)$/.exec(CUR_MINUTE_FILE.name)?.[1]||'dat').toLowerCase();
    const path=`committees/${CUR_COMMITTEE.id}/${Date.now()}.${ext}`;
    const {error:upErr}=await db.storage.from(BUCKET).upload(path,CUR_MINUTE_FILE);
    if(upErr){ toast('تعذر رفع المرفق: '+upErr.message); return; }
    attachment_path=path; attachment_name=CUR_MINUTE_FILE.name;
  }
  const {error}=await db.from('committee_minutes').insert({committee_id:CUR_COMMITTEE.id, meeting_date:date, summary, attachment_path, attachment_name, created_by:S.ME.id});
  if(error){ toast('تعذر الحفظ: '+error.message); return; }
  $('cmMinuteDate').value=''; $('cmMinuteSummary').value=''; CUR_MINUTE_FILE=null; $('cmMinuteFileLabel').textContent='مرفق المحضر (اختياري)';
  toast('تم الحفظ'); loadMinutes();
}

/* ============ الطباعة: تكليف / دعوة اجتماع / استمارة حضور ============ */
async function getTeacherMembers(){
  const {data}=await db.from('committee_members').select('staff(full_name)').eq('committee_id',CUR_COMMITTEE.id).not('staff_id','is',null);
  return (data||[]).map(m=>m.staff?.full_name).filter(Boolean);
}
async function printAssignment(){
  const names=await getTeacherMembers();
  if(!names.length){ toast('لا معلمات في هذي اللجنة'); return; }
  $('printAreaCM').innerHTML=`
    ${printHeaderHtml('قرار تكليف')}
    <p style="line-height:2;margin-top:14px">بناءً على مصلحة العمل، يُعتمد تكليف المعلمات الآتية أسماؤهن للعمل ضمن لجنة "<b>${CUR_COMMITTEE.name}</b>" التابعة لمشروع "<b>${CUR_COMMITTEE.plan_projects?.name||''}</b>" للعام الدراسي ${S.YEAR?.name||''}.</p>
    <table class="cm-print-tbl"><tr><th>#</th><th>الاسم</th><th>التوقيع</th></tr>
      ${names.map((n,i)=>`<tr><td>${i+1}</td><td>${n}</td><td></td></tr>`).join('')}
    </table>`;
  printWithTitle(`تكليف_${CUR_COMMITTEE.name}`,'printAreaCM');
}

async function printInvite(){
  const date=$('cmMinuteDate').value || '—';
  $('printAreaCM').innerHTML=`
    ${printHeaderHtml('دعوة اجتماع')}
    <p style="line-height:2;margin-top:14px">تدعو لجنة "<b>${CUR_COMMITTEE.name}</b>" أعضاءها لحضور اجتماع بتاريخ <b>${date}</b>، وذلك لمناقشة سير العمل ومتابعة المهام والإجراءات الخاصة باللجنة.</p>
    <p style="margin-top:20px">${$('cmMinuteSummary').value ? 'الموضوع: '+$('cmMinuteSummary').value : ''}</p>
    ${printFooterHtml('رئيسة اللجنة', S.ME.full_name)}`;
  printWithTitle(`دعوة_اجتماع_${CUR_COMMITTEE.name}`,'printAreaCM');
}

async function printAttendance(){
  const {data:members}=await db.from('committee_members').select('staff(full_name), students(full_name,academic_number)').eq('committee_id',CUR_COMMITTEE.id);
  const names=(members||[]).map(m=>m.staff?.full_name || (m.students?`${m.students.full_name} (${m.students.academic_number})`:null)).filter(Boolean);
  const date=$('cmMinuteDate').value || '—';
  $('printAreaCM').innerHTML=`
    ${printHeaderHtml('استمارة حضور اجتماع')}
    <p style="margin-top:10px">لجنة: <b>${CUR_COMMITTEE.name}</b> — تاريخ الاجتماع: <b>${date}</b></p>
    <table class="cm-print-tbl"><tr><th>#</th><th>الاسم</th><th>الحضور</th><th>التوقيع</th></tr>
      ${names.map((n,i)=>`<tr><td>${i+1}</td><td>${n}</td><td></td><td></td></tr>`).join('')}
    </table>
    ${printFooterHtml('رئيسة اللجنة', S.ME.full_name)}`;
  printWithTitle(`استمارة_حضور_${CUR_COMMITTEE.name}`,'printAreaCM');
}

async function printFinalReport(){
  const impact=clean($('cmImpactText').value), skills=clean($('cmSkillsText').value);
  await db.from('committees').update({impact_text:impact||null, skills_text:skills||null}).eq('id',CUR_COMMITTEE.id);
  let actionsHtml='';
  if(CUR_COMMITTEE.initiative_id){
    const {data:actions}=await db.from('plan_actions').select('text,status,execution_date:month').eq('initiative_id',CUR_COMMITTEE.initiative_id);
    const STATUS_LABEL={not_started:'لم يبدأ', in_progress:'جاري', done:'تم'};
    actionsHtml=`<table class="cm-print-tbl"><tr><th>#</th><th>الفعالية/الإجراء</th><th>الحالة</th></tr>
      ${(actions||[]).map((a,i)=>`<tr><td>${i+1}</td><td>${a.text}</td><td>${STATUS_LABEL[a.status]}</td></tr>`).join('')}
      </table>`;
  }
  $('printAreaCMFinal').innerHTML=`
    ${printHeaderHtml(`التقرير الختامي — ${CUR_COMMITTEE.name}`)}
    <p style="margin-top:10px"><b>قياس الأثر:</b> ${impact||'—'}</p>
    <p><b>المهارات التي تم تطويرها:</b> ${skills||'—'}</p>
    <h4 style="margin-top:16px">الفعاليات والمسابقات المسجَّلة</h4>
    ${actionsHtml||'<p>لا فعاليات مسجَّلة بعد.</p>'}
    ${printFooterHtml('رئيسة اللجنة', S.ME.full_name)}`;
  printWithTitle(`التقرير_الختامي_${CUR_COMMITTEE.name}`,'printAreaCMFinal');
}

registerTab({id:'committeesMain', label:'اللجان والمبادرات', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:f=>f.isAdmin||f.isStrategicPlanLead||f.isLead||f.isSeniorTeacher||f.isCommitteeMember, init:initCommittees});
