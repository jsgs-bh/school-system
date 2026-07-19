/* committees.js — اللجان (تحت مجموعة "الخطة الاستراتيجية")
   كل لجنة لها مشروع أم واحد إلزامي، وربط اختياري بمشاريع مستفيدة —
   "بيت واحد + ربط متعدد" كما في الوثيقة المعتمدة. صفحة اللجنة تجمع
   أعضاءها ومهامها ومحاضر اجتماعاتها في مكان واحد. */
import { db, $, S, clean, toast, bindDrop, printWithTitle, printHeaderHtml, printFooterHtml, registerTab } from './core.js';

const BUCKET='school-files';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="committeesMain" style="display:none">
  <div id="cmListView">
    <div class="panel">
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
      <h3>المهام والتكليفات</h3>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
        <input type="text" id="cmTaskText" placeholder="نص المهمة" style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
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
  </div>
</div>
<div id="printAreaCM"></div>
<style>
  #printAreaCM{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaCM, #printAreaCM *{visibility:visible}
    #printAreaCM{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
    .cm-print-tbl{width:100%;border-collapse:collapse;font-size:11px;margin-top:14px}
    .cm-print-tbl th,.cm-print-tbl td{border:1px solid #ccc;padding:8px;text-align:center}
    .cm-print-tbl th{background:#1d3d5c;color:#fff}
  }
</style>
<style>
  #committeesMain.wide{max-width:1400px}
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
  const {data:projects}=await db.from('plan_projects').select('id,name').eq('academic_year_id',S.YEAR.id).order('sort_order');
  PROJECTS=projects||[];
  $('cmNewHome').innerHTML='<option value="">اختاري المشروع الأم…</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
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
  $('cmMinuteAdd').addEventListener('click',addMinute);
  $('cmPrintAssignment').addEventListener('click',printAssignment);
  $('cmPrintInvite').addEventListener('click',printInvite);
  $('cmPrintAttendance').addEventListener('click',printAttendance);
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
    toast('تم إنشاء اللجنة');
    $('cmNewName').value=''; $('cmNewHome').value=''; SELECTED_BENEFICIARIES.clear();
    $('cmNewBeneficiaries').querySelectorAll('.cm-benef-chip').forEach(c=>c.classList.remove('on'));
    loadCommittees();
  }catch(err){ toast('تعذر الإنشاء: '+(err.message||err)); }
  finally{ btn.disabled=false; }
}

const TYPE_LABEL={teachers:'معلمات', students:'طالبات', mixed:'معلمات وطالبات'};
async function loadCommittees(){
  const {data,error}=await db.from('committees')
    .select('id,name,type,home_project_id, plan_projects(name), committee_beneficiary_projects(plan_projects(name))')
    .eq('academic_year_id',S.YEAR.id).order('created_at',{ascending:false});
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
  const {data:c}=await db.from('committees').select('id,name,type,home_project_id,head_staff_id, plan_projects(name)').eq('id',id).single();
  if(!c) return;
  CUR_COMMITTEE=c;
  $('cmListView').style.display='none'; $('cmDetailView').style.display='block';
  $('cmDetailName').textContent=c.name;
  $('cmDetailMeta').textContent=`المشروع الأم: ${c.plan_projects?.name||'—'} — نوع اللجنة: ${TYPE_LABEL[c.type]||c.type}`;
  await loadMembers(); await loadTasks(); await checkMinuteAccess(); await loadMinutes();
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

async function loadTasks(){
  const {data}=await db.from('committee_tasks').select('*').eq('committee_id',CUR_COMMITTEE.id).order('created_at');
  const tasks=data||[];
  const STATUS_LABEL={not_started:'لم يبدأ', in_progress:'جاري', done:'تم'};
  $('cmTasksList').innerHTML=tasks.length ? tasks.map(t=>`
    <div class="cm-row" style="cursor:default"><span>${t.text}${t.due_date?` <small style="color:#8a93a0">(${t.due_date})</small>`:''}</span>
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
  const due=$('cmTaskDue').value||null;
  await db.from('committee_tasks').insert({committee_id:CUR_COMMITTEE.id, text, due_date:due, assigned_to:null});
  $('cmTaskText').value=''; $('cmTaskDue').value='';
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
    </table>
    ${printFooterHtml('رئيسة اللجنة', S.ME.full_name)}`;
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

registerTab({id:'committeesMain', label:'اللجان', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:f=>f.isAdmin||f.isProjectLead||f.isSeniorTeacher||f.isLead, init:initCommittees});
