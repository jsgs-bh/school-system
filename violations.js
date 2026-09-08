/* violations.js — منظومة المخالفات السلوكية، بحسب استمارة "متابعة المخالفات
   السلوكية" المعتمدة (٤ فئات، كل فئة فيها أنواع محددة + "أخرى").
   ثلاث شاشات:
   1) المعلمة: تسجيل مخالفة + عرض مخالفاتها.
   2) مسؤولة المخالفات (الإشراف الإداري): مخالفات جديدة، إحصائيات،
      تنبيهات (٣+ مخالفات لنفس الطالبة، وفئة رابعة تُحوَّل تلقائياً)،
      المخالفات المحوّلة.
   3) مكتب الإرشاد الاجتماعي: مخالفات للمتابعة، إحصائيات، أرشيف. */
import { db, $, S, clean, toast, printHeaderHtml, printWithTitle, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="violTeacher" style="display:none">
  <div class="lm-subnav" id="vtSubnav">
    <button class="lm-subnav-btn" data-vt="add">➕ تسجيل مخالفة</button>
    <button class="lm-subnav-btn" data-vt="mine">📋 مخالفاتي</button>
  </div>

  <div data-vt="add">
    <div class="panel">
      <h3>تسجيل مخالفة سلوكية</h3>
      <div class="field" style="position:relative;max-width:420px">
        <label>اسم الطالبة</label>
        <input type="text" id="vAddStuSearch" placeholder="ابحثي عن اسم طالبة…" autocomplete="off">
        <div class="sugg" id="vAddStuSugg"></div>
      </div>
      <div id="vAddStuPicked" class="viol-picked" style="display:none"></div>
      <div class="field"><label>الفئة</label>
        <div class="viol-cats" id="vAddCats"></div>
      </div>
      <div class="field" id="vAddTypeWrap" style="display:none"><label>نوع المخالفة</label>
        <select id="vAddType"></select>
      </div>
      <div class="field"><label>الوصف / تفاصيل إضافية</label>
        <textarea id="vAddNotes" rows="3" placeholder="اكتبي وصف الموقف بالتفصيل…"></textarea>
      </div>
      <button class="btn gold" id="vAddSave" style="width:auto;padding:10px 24px">حفظ المخالفة</button>
    </div>
  </div>

  <div data-vt="mine" style="display:none">
    <div class="panel"><h3>مخالفاتي المسجَّلة</h3><div id="vMineList"></div></div>
  </div>
</div>

<div class="app-main wide" id="violAdmin" style="display:none">
  <div class="lm-subnav" id="vaSubnav">
    <button class="lm-subnav-btn" data-va="new">🆕 مخالفات جديدة</button>
    <button class="lm-subnav-btn" data-va="stats">📊 إحصائيات</button>
    <button class="lm-subnav-btn" data-va="alerts">🚨 تنبيهات</button>
    <button class="lm-subnav-btn" data-va="escalated">↗️ المخالفات المحوَّلة</button>
  </div>

  <div data-va="new">
    <div class="panel"><h3>مخالفات جديدة (بانتظار الإجراء)</h3><div id="vaNewList"></div></div>
  </div>

  <div data-va="stats" style="display:none">
    <div class="panel" id="vaStatsPanel"></div>
  </div>

  <div data-va="alerts" style="display:none">
    <div class="panel">
      <h3>طالبات لديهن ٣ مخالفات فأكثر</h3>
      <div id="vaRepeatList"></div>
    </div>
    <div class="panel">
      <h3>مخالفات الفئة الرابعة (محوَّلة تلقائياً لمكتب الإرشاد)</h3>
      <div id="vaTier4List"></div>
    </div>
  </div>

  <div data-va="escalated" style="display:none">
    <div class="panel"><h3>المخالفات المحوَّلة لمكتب الإرشاد الاجتماعي</h3><div id="vaEscList"></div></div>
  </div>

  <div id="vaStudentModal" class="viol-modal" style="display:none">
    <div class="viol-modal-box">
      <button class="viol-modal-close" id="vaModalClose">✕</button>
      <div id="vaModalBody"></div>
    </div>
  </div>
</div>

<div class="app-main wide" id="violGuidance" style="display:none">
  <div class="lm-subnav" id="vgSubnav">
    <button class="lm-subnav-btn" data-vg="pending">📥 مخالفات للمتابعة</button>
    <button class="lm-subnav-btn" data-vg="stats">📊 إحصائيات</button>
    <button class="lm-subnav-btn" data-vg="archive">🗂️ أرشيف المخالفات</button>
  </div>

  <div data-vg="pending">
    <div class="panel"><h3>مخالفات محوَّلة بانتظار المتابعة</h3><div id="vgPendingList"></div></div>
  </div>

  <div data-vg="stats" style="display:none">
    <div class="panel" id="vgStatsPanel"></div>
  </div>

  <div data-vg="archive" style="display:none">
    <div class="panel"><h3>أرشيف المخالفات المتابَعة</h3><div id="vgArchiveList"></div></div>
  </div>
</div>

<div id="printAreaViol" style="display:none"></div>

<style>
  .lm-subnav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;border-bottom:2px solid var(--line);padding-bottom:10px}
  .lm-subnav-btn{background:var(--sand);border:1.5px solid var(--line);border-radius:9px;padding:9px 16px;font:inherit;font-size:13px;font-weight:600;color:var(--navy);cursor:pointer}
  .lm-subnav-btn.active{background:var(--gold);border-color:var(--gold);color:#fff}
  .viol-picked{background:var(--sand);border-radius:9px;padding:10px 14px;margin:6px 0 14px;font-size:13.5px;display:flex;justify-content:space-between;align-items:center}
  .viol-picked button{background:none;border:none;color:var(--err);cursor:pointer;font-size:13px}
  .viol-cats{display:flex;gap:8px;flex-wrap:wrap}
  .viol-cat-btn{border:2px solid var(--line);border-radius:10px;padding:10px 16px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;background:#fff}
  .viol-cat-btn.on{border-color:var(--navy);box-shadow:0 0 0 2px var(--navy) inset}
  .viol-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:10px}
  .viol-card-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px}
  .viol-tag{display:inline-block;border-radius:99px;padding:3px 12px;font-size:11.5px;font-weight:700;color:#3a2e00}
  .viol-meta{font-size:12px;color:#6b7683}
  .viol-notes{font-size:13px;color:#333;margin:8px 0;background:var(--sand);border-radius:8px;padding:8px 12px}
  .viol-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
  .viol-actions textarea{width:100%;min-height:60px;border:1.5px solid var(--line);border-radius:8px;padding:8px;font:inherit;font-size:13px;margin-bottom:6px}
  .viol-modal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999;display:flex;align-items:center;justify-content:center}
  .viol-modal-box{background:#fff;border-radius:14px;padding:22px;max-width:640px;width:92%;max-height:85vh;overflow:auto;position:relative}
  .viol-modal-close{position:absolute;top:12px;left:12px;background:none;border:none;font-size:18px;cursor:pointer;color:#8a93a0}
  .viol-repeat-row{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-bottom:8px;cursor:pointer}
  .viol-repeat-row:hover{border-color:var(--gold);background:var(--gold-soft)}
  .viol-print-tbl{width:100%;border-collapse:collapse;font-size:10.5pt;margin-top:8px}
  .viol-print-tbl th{background:#eef1f5;border:1px solid #333;padding:6px}
  .viol-print-tbl td{border:1px solid #333;padding:6px;text-align:center}
  @media print{
    body *{visibility:hidden}
    #printAreaViol, #printAreaViol *{visibility:visible}
    #printAreaViol{display:block!important;position:absolute;inset-inline-start:0;top:0;width:100%}
  }
</style>`);

const TIER_COLORS={1:'#c8e6cf',2:'#ffe6a8',3:'#ffc79e',4:'#f3aaa8'};
let CATEGORIES=[], TYPES=[], PICKED_STU=null;

async function loadCatsTypes(){
  if(CATEGORIES.length) return;
  const [{data:cats},{data:types}]=await Promise.all([
    db.from('violation_categories').select('*').order('tier'),
    db.from('violation_types').select('*').order('sort_order'),
  ]);
  CATEGORIES=cats||[]; TYPES=types||[];
}

function tierBadge(cat){
  return `<span class="viol-tag" style="background:${TIER_COLORS[cat?.tier]||'#eee'}">${cat?.name||'—'}</span>`;
}

/* ============ شاشة المعلمة ============ */
function switchVt(tab){
  document.querySelectorAll('#violTeacher [data-vt]').forEach(el=>{ if(el.id!=='vtSubnav') el.style.display=el.dataset.vt===tab?'block':'none'; });
  $('vtSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.classList.toggle('active',b.dataset.vt===tab));
  if(tab==='mine') loadMineViolations();
}

async function initViolTeacher(){
  if($('vtSubnav').dataset.ready) return;
  $('vtSubnav').dataset.ready='1';
  await loadCatsTypes();
  $('vtSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.addEventListener('click',()=>switchVt(b.dataset.vt)));
  switchVt('add');

  $('vAddCats').innerHTML=CATEGORIES.map(c=>`<button type="button" class="viol-cat-btn" data-cat="${c.id}" style="border-color:${TIER_COLORS[c.tier]}">${c.name}</button>`).join('');
  $('vAddCats').querySelectorAll('.viol-cat-btn').forEach(b=>b.addEventListener('click',()=>{
    $('vAddCats').querySelectorAll('.viol-cat-btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    const catId=b.dataset.cat;
    const opts=TYPES.filter(t=>t.category_id===catId);
    $('vAddType').innerHTML=opts.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
    $('vAddTypeWrap').style.display='block';
  }));

  let searchTimer=null;
  $('vAddStuSearch').addEventListener('input',()=>{
    clearTimeout(searchTimer);
    const q=clean($('vAddStuSearch').value);
    if(q.length<2){ $('vAddStuSugg').innerHTML=''; return; }
    searchTimer=setTimeout(async ()=>{
      const {data}=await db.from('students').select('id,full_name,academic_number,enrollments!inner(section_id,to_date,sections(code))')
        .ilike('full_name',`%${q}%`).is('enrollments.to_date',null).limit(8);
      $('vAddStuSugg').innerHTML=(data||[]).map(s=>`<div class="opt" data-id="${s.id}" data-name="${s.full_name}" data-acad="${s.academic_number}" data-secid="${s.enrollments?.[0]?.section_id||''}" data-sec="${s.enrollments?.[0]?.sections?.code||''}">${s.full_name}<small>${s.academic_number} — ${s.enrollments?.[0]?.sections?.code||''}</small></div>`).join('');
      $('vAddStuSugg').querySelectorAll('.opt').forEach(el=>el.addEventListener('click',()=>{
        PICKED_STU={id:el.dataset.id,full_name:el.dataset.name,academic_number:el.dataset.acad,section_id:el.dataset.secid||null,section_code:el.dataset.sec};
        $('vAddStuPicked').style.display='flex';
        $('vAddStuPicked').innerHTML=`${PICKED_STU.full_name} (${PICKED_STU.academic_number} — ${PICKED_STU.section_code}) <button type="button" id="vAddStuClear">✕</button>`;
        $('vAddStuClear').addEventListener('click',()=>{ PICKED_STU=null; $('vAddStuPicked').style.display='none'; });
        $('vAddStuSearch').value=''; $('vAddStuSugg').innerHTML='';
      }));
    },250);
  });

  $('vAddSave').addEventListener('click', async ()=>{
    if(!PICKED_STU){ toast('اختاري الطالبة'); return; }
    const catBtn=$('vAddCats').querySelector('.viol-cat-btn.on');
    if(!catBtn){ toast('اختاري الفئة'); return; }
    const cat=CATEGORIES.find(c=>c.id===catBtn.dataset.cat);
    const typeId=$('vAddType').value||null;
    const notes=clean($('vAddNotes').value);
    const btn=$('vAddSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
    try{
      const isTier4=cat.tier===4;
      const {error}=await db.from('violations').insert({
        academic_year_id:S.YEAR.id, student_id:PICKED_STU.id, section_id:PICKED_STU.section_id, category_id:cat.id, type_id:typeId,
        reported_by:S.ME.id, notes:notes||null, date:new Date().toISOString().slice(0,10),
        status:isTier4?'escalated':'new', escalated_at:isTier4?new Date().toISOString():null, escalated_by:isTier4?S.ME.id:null
      });
      if(error) throw error;
      toast(isTier4?'تم الحفظ — مخالفة فئة رابعة تُحوَّل مباشرة لمكتب الإرشاد':'تم حفظ المخالفة');
      PICKED_STU=null; $('vAddStuPicked').style.display='none';
      $('vAddNotes').value=''; catBtn.classList.remove('on'); $('vAddTypeWrap').style.display='none';
    }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
    finally{ btn.disabled=false; btn.textContent='حفظ المخالفة'; }
  });
}

async function loadMineViolations(){
  const {data,error}=await db.from('violations').select('*, students(full_name,academic_number), violation_categories(name,tier), violation_types(name)')
    .eq('reported_by',S.ME.id).order('created_at',{ascending:false});
  if(error){ $('vMineList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!(data||[]).length){ $('vMineList').innerHTML='<div class="empty-day">ما سجّلتِ أي مخالفة بعد.</div>'; return; }
  $('vMineList').innerHTML=data.map(v=>violCard(v,false)).join('');
}

const STATUS_LABEL={new:'جديدة',admin_action:'تحت الإجراء',archived:'مؤرشَفة',escalated:'محوَّلة للإرشاد',guidance_action:'تحت متابعة الإرشاد',closed:'مغلقة'};

function violCard(v, showActions){
  return `<div class="viol-card">
    <div class="viol-card-head">
      <div><b>${v.students?.full_name||'—'}</b> <span class="viol-meta">(${v.students?.academic_number||''})</span></div>
      ${tierBadge(v.violation_categories)}
    </div>
    <div class="viol-meta">${v.violation_types?.name||''} · ${v.date} · الحالة: ${STATUS_LABEL[v.status]||v.status}</div>
    ${v.notes?`<div class="viol-notes">${v.notes}</div>`:''}
    ${v.admin_action_text?`<div class="viol-notes"><b>إجراء الإشراف الإداري:</b> ${v.admin_action_text}</div>`:''}
    ${v.guidance_action_text?`<div class="viol-notes"><b>إجراء الإرشاد الاجتماعي:</b> ${v.guidance_action_text}</div>`:''}
  </div>`;
}

registerTab({id:'violTeacher', label:'المخالفات', group:'violations', groupLabel:'المخالفات',
  show:f=>f.isTeacher||f.isSeniorTeacher, init:initViolTeacher});

/* ============ شاشة مسؤولة المخالفات ============ */
function switchVa(tab){
  document.querySelectorAll('#violAdmin [data-va]').forEach(el=>{ if(el.id!=='vaSubnav') el.style.display=el.dataset.va===tab?'block':'none'; });
  $('vaSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.classList.toggle('active',b.dataset.va===tab));
  if(tab==='new') loadNewViolations();
  if(tab==='stats') initStatsPanel('vaStatsPanel');
  if(tab==='alerts') loadAlerts();
  if(tab==='escalated') loadEscalatedList();
}

async function initViolAdmin(){
  if($('vaSubnav').dataset.ready) return;
  $('vaSubnav').dataset.ready='1';
  await loadCatsTypes();
  $('vaSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.addEventListener('click',()=>switchVa(b.dataset.va)));
  $('vaModalClose').addEventListener('click',()=>$('vaStudentModal').style.display='none');
  switchVa('new');
}

async function loadNewViolations(){
  const {data,error}=await db.from('violations').select('*, students(full_name,academic_number), sections(code), violation_categories(name,tier), violation_types(name), staff:reported_by(full_name)')
    .eq('status','new').order('created_at',{ascending:false});
  if(error){ $('vaNewList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!(data||[]).length){ $('vaNewList').innerHTML='<div class="empty-day">لا مخالفات جديدة بانتظار الإجراء 🎉</div>'; return; }
  $('vaNewList').innerHTML=data.map(v=>`
    <div class="viol-card">
      <div class="viol-card-head">
        <div><b>${v.students?.full_name||'—'}</b> <span class="viol-meta">(${v.students?.academic_number||''} — ${v.sections?.code||''})</span></div>
        ${tierBadge(v.violation_categories)}
      </div>
      <div class="viol-meta">${v.violation_types?.name||''} · ${v.date} · رصدتها: ${v.staff?.full_name||''}</div>
      ${v.notes?`<div class="viol-notes">${v.notes}</div>`:''}
      <div class="viol-actions">
        <textarea placeholder="الإجراء المتخذ…" data-note="${v.id}"></textarea>
        <button class="btn gold" data-save="${v.id}" style="width:auto;padding:8px 18px;font-size:12.5px">حفظ الإجراء</button>
        <button class="btn ghost" data-archive="${v.id}" style="width:auto;padding:8px 18px;font-size:12.5px">أرشفة (تجاوز)</button>
      </div>
    </div>`).join('');
  $('vaNewList').querySelectorAll('[data-save]').forEach(b=>b.addEventListener('click', async ()=>{
    const id=b.dataset.save; const text=clean($('vaNewList').querySelector(`textarea[data-note="${id}"]`).value);
    if(!text){ toast('اكتبي الإجراء المتخذ'); return; }
    const {error}=await db.from('violations').update({status:'admin_action', admin_action_text:text, admin_action_by:S.ME.id, admin_action_at:new Date().toISOString(), closed_at:new Date().toISOString()}).eq('id',id);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    toast('تم حفظ الإجراء'); loadNewViolations();
  }));
  $('vaNewList').querySelectorAll('[data-archive]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('أرشفة هذي المخالفة (تجاوز بدون إجراء)؟')) return;
    const {error}=await db.from('violations').update({status:'archived'}).eq('id',b.dataset.archive);
    if(error){ toast('تعذر: '+error.message); return; }
    toast('تم الأرشفة'); loadNewViolations();
  }));
}

async function loadAlerts(){
  const {data,error}=await db.from('violations').select('student_id, students(full_name,academic_number), sections(code)')
    .not('status','in','(archived)');
  if(error){ $('vaRepeatList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  const byStu={};
  for(const v of data||[]){ const k=v.student_id; (byStu[k] ??= {count:0, s:v.students}).count++; }
  const repeats=Object.entries(byStu).filter(([,v])=>v.count>=3).sort((a,b)=>b[1].count-a[1].count);
  $('vaRepeatList').innerHTML=repeats.length
    ? repeats.map(([sid,v])=>`<div class="viol-repeat-row" data-stu="${sid}"><span>${v.s?.full_name} <small class="viol-meta">(${v.s?.academic_number} — ${v.s?.sections?.code||''})</small></span><b>${v.count} مخالفات</b></div>`).join('')
    : '<div class="empty-day">لا طالبات وصلن ٣ مخالفات فأكثر حالياً.</div>';
  $('vaRepeatList').querySelectorAll('.viol-repeat-row').forEach(el=>el.addEventListener('click',()=>openStudentModal(el.dataset.stu)));

  const {data:t4}=await db.from('violations').select('*, students(full_name,academic_number), sections(code), violation_types(name), staff:reported_by(full_name)')
    .eq('status','escalated').order('escalated_at',{ascending:false});
  const onlyAutoT4=(t4||[]).filter(v=>!v.admin_action_text); // اللي انحولت تلقائياً (مو عن طريق التكرار)
  $('vaTier4List').innerHTML=onlyAutoT4.length
    ? onlyAutoT4.map(v=>`<div class="viol-card"><div class="viol-card-head"><b>${v.students?.full_name}</b><span class="viol-meta">${v.students?.academic_number} — ${v.sections?.code||''}</span></div><div class="viol-meta">${v.violation_types?.name||''} · ${v.date} · رصدتها: ${v.staff?.full_name||''}</div>${v.notes?`<div class="viol-notes">${v.notes}</div>`:''}<div class="viol-meta">↗️ محوَّلة مباشرة لمكتب الإرشاد الاجتماعي — لا يوجد إجراء إشرافي مطلوب هنا.</div></div>`).join('')
    : '<div class="empty-day">لا مخالفات فئة رابعة حالياً.</div>';
}

async function openStudentModal(studentId){
  const {data,error}=await db.from('violations').select('*, violation_categories(name,tier), violation_types(name), staff:reported_by(full_name)')
    .eq('student_id',studentId).not('status','in','(archived)').order('date',{ascending:false});
  if(error){ toast('تعذر التحميل: '+error.message); return; }
  const {data:stu}=await db.from('students').select('full_name,academic_number,enrollments!inner(section_id,to_date,sections(code))').eq('id',studentId).is('enrollments.to_date',null).single();
  const stuSec=stu.enrollments?.[0]?.sections?.code||'';
  $('vaModalBody').innerHTML=`
    <h3>${stu.full_name} <small class="viol-meta">(${stu.academic_number} — ${stuSec})</small></h3>
    ${(data||[]).map(v=>`<div class="viol-card"><div class="viol-card-head">${tierBadge(v.violation_categories)}<span class="viol-meta">${v.date}</span></div><div class="viol-meta">${v.violation_types?.name||''} · رصدتها: ${v.staff?.full_name||''}</div>${v.notes?`<div class="viol-notes">${v.notes}</div>`:''}</div>`).join('')}
    <div class="field"><label>إجراءات الإشراف الإداري</label><textarea id="vaModalAction" rows="3" placeholder="اكتبي الإجراء المتخذ مع الطالبة…"></textarea></div>
    <button class="btn gold" id="vaModalEscalate" style="width:auto;padding:10px 22px">تحويل الطالبة إلى مكتب الإرشاد الاجتماعي</button>
  `;
  $('vaModalEscalate').addEventListener('click', async ()=>{
    const text=clean($('vaModalAction').value);
    if(!text){ toast('اكتبي إجراءات الإشراف الإداري أولاً'); return; }
    const ids=(data||[]).map(v=>v.id);
    const {error:eErr}=await db.from('violations').update({
      status:'escalated', admin_action_text:text, admin_action_by:S.ME.id, admin_action_at:new Date().toISOString(),
      escalated_at:new Date().toISOString(), escalated_by:S.ME.id
    }).in('id',ids);
    if(eErr){ toast('تعذر التحويل: '+eErr.message); return; }
    toast('تم تحويل الطالبة لمكتب الإرشاد الاجتماعي');
    $('vaStudentModal').style.display='none';
    loadAlerts();
  });
  $('vaStudentModal').style.display='flex';
}

async function loadEscalatedList(){
  const {data,error}=await db.from('violations').select('*, students(full_name,academic_number), sections(code), violation_categories(name,tier), violation_types(name)')
    .in('status',['escalated','guidance_action','closed']).order('escalated_at',{ascending:false});
  if(error){ $('vaEscList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  $('vaEscList').innerHTML=(data||[]).length ? data.map(v=>`
    <div class="viol-card">
      <div class="viol-card-head"><b>${v.students?.full_name}</b>${tierBadge(v.violation_categories)}</div>
      <div class="viol-meta">${v.violation_types?.name||''} · ${v.date} · الحالة: ${STATUS_LABEL[v.status]}</div>
      ${v.admin_action_text?`<div class="viol-notes"><b>إجراء الإشراف الإداري:</b> ${v.admin_action_text}</div>`:''}
      ${v.guidance_action_text?`<div class="viol-notes"><b>إجراء الإرشاد الاجتماعي:</b> ${v.guidance_action_text}</div>`:''}
    </div>`).join('') : '<div class="empty-day">لا مخالفات محوَّلة حالياً.</div>';
}

registerTab({id:'violAdmin', label:'إدارة المخالفات', group:'violations', groupLabel:'المخالفات',
  show:f=>f.isAdmin||f.isLead||f.isViolationsLead, init:initViolAdmin});

/* ============ شاشة مكتب الإرشاد الاجتماعي ============ */
function switchVg(tab){
  document.querySelectorAll('#violGuidance [data-vg]').forEach(el=>{ if(el.id!=='vgSubnav') el.style.display=el.dataset.vg===tab?'block':'none'; });
  $('vgSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.classList.toggle('active',b.dataset.vg===tab));
  if(tab==='pending') loadGuidancePending();
  if(tab==='stats') initStatsPanel('vgStatsPanel');
  if(tab==='archive') loadGuidanceArchive();
}

async function initViolGuidance(){
  if($('vgSubnav').dataset.ready) return;
  $('vgSubnav').dataset.ready='1';
  await loadCatsTypes();
  $('vgSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.addEventListener('click',()=>switchVg(b.dataset.vg)));
  switchVg('pending');
}

async function loadGuidancePending(){
  const {data,error}=await db.from('violations').select('*, students(full_name,academic_number), sections(code), violation_categories(name,tier), violation_types(name)')
    .eq('status','escalated').order('escalated_at',{ascending:true});
  if(error){ $('vgPendingList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!(data||[]).length){ $('vgPendingList').innerHTML='<div class="empty-day">لا مخالفات بانتظار المتابعة 🎉</div>'; return; }
  $('vgPendingList').innerHTML=data.map(v=>`
    <div class="viol-card">
      <div class="viol-card-head"><b>${v.students?.full_name}</b>${tierBadge(v.violation_categories)}</div>
      <div class="viol-meta">${v.violation_types?.name||''} · ${v.date} — ${v.sections?.code||''}</div>
      ${v.notes?`<div class="viol-notes">${v.notes}</div>`:''}
      ${v.admin_action_text?`<div class="viol-notes"><b>إجراء الإشراف الإداري:</b> ${v.admin_action_text}</div>`:''}
      <div class="viol-actions">
        <textarea placeholder="الإجراءات المتبعة وما تم اتخاذه…" data-gnote="${v.id}"></textarea>
        <button class="btn gold" data-close="${v.id}" style="width:auto;padding:8px 18px;font-size:12.5px">إغلاق المتابعة</button>
      </div>
    </div>`).join('');
  $('vgPendingList').querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click', async ()=>{
    const id=b.dataset.close; const text=clean($('vgPendingList').querySelector(`textarea[data-gnote="${id}"]`).value);
    if(!text){ toast('اكتبي الإجراءات المتبعة'); return; }
    const {error}=await db.from('violations').update({status:'closed', guidance_action_text:text, guidance_action_by:S.ME.id, guidance_action_at:new Date().toISOString(), closed_at:new Date().toISOString()}).eq('id',id);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    toast('تم إغلاق المتابعة'); loadGuidancePending();
  }));
}

async function loadGuidanceArchive(){
  const {data,error}=await db.from('violations').select('*, students(full_name,academic_number), sections(code), violation_categories(name,tier), violation_types(name)')
    .eq('status','closed').not('guidance_action_text','is',null).order('closed_at',{ascending:false});
  if(error){ $('vgArchiveList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  $('vgArchiveList').innerHTML=(data||[]).length ? data.map(v=>`
    <div class="viol-card">
      <div class="viol-card-head"><b>${v.students?.full_name}</b>${tierBadge(v.violation_categories)}</div>
      <div class="viol-meta">${v.violation_types?.name||''} · ${v.date}</div>
      <div class="viol-notes"><b>إجراء الإرشاد الاجتماعي:</b> ${v.guidance_action_text}</div>
    </div>`).join('') : '<div class="empty-day">لا مخالفات مؤرشَفة بعد.</div>';
}

registerTab({id:'violGuidance', label:'متابعة المخالفات', group:'violations', groupLabel:'المخالفات',
  show:f=>f.isAdmin||f.isLead||f.isSocial, init:initViolGuidance});

/* ============ الإحصائيات (مشتركة بين مسؤولة المخالفات ومكتب الإرشاد) ============ */
async function initStatsPanel(panelId){
  const panel=$(panelId);
  if(panel.dataset.ready) return;
  panel.dataset.ready='1';
  const {data:sections}=await db.from('sections').select('id,code,level').eq('academic_year_id',S.YEAR.id).order('code');
  panel.innerHTML=`
    <h3>إحصائيات المخالفات</h3>
    <div class="row" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <input type="text" id="${panelId}-stu" placeholder="اسم طالبة…" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      <select id="${panelId}-sec"><option value="">كل الشعب</option>${(sections||[]).map(s=>`<option value="${s.id}">${s.code}</option>`).join('')}</select>
      <select id="${panelId}-level"><option value="">كل المستويات</option><option value="1">الأول</option><option value="2">الثاني</option><option value="3">الثالث</option></select>
      <select id="${panelId}-cat"><option value="">كل الفئات</option>${CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select>
      <select id="${panelId}-type"><option value="">كل الأنواع</option>${TYPES.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select>
      <input type="month" id="${panelId}-month">
      <input type="date" id="${panelId}-from" title="من تاريخ">
      <input type="date" id="${panelId}-to" title="إلى تاريخ">
      <button class="btn gold" id="${panelId}-go" style="width:auto;padding:9px 20px">فرز</button>
      <button class="btn ghost" id="${panelId}-print" style="width:auto;padding:9px 20px">🖨️ PDF</button>
      <button class="btn ghost" id="${panelId}-xls" style="width:auto;padding:9px 20px">⬇️ Excel</button>
    </div>
    <div class="board-wrap"><table class="board" id="${panelId}-tbl"></table></div>`;
  const run=()=>runStats(panelId);
  $(`${panelId}-go`).addEventListener('click',run);
  $(`${panelId}-print`).addEventListener('click',()=>printStats(panelId));
  $(`${panelId}-xls`).addEventListener('click',()=>exportStats(panelId));
  run();
}

let STATS_ROWS={};
async function runStats(panelId){
  let q=db.from('violations').select('*, students(full_name,academic_number), sections(code,level), violation_categories(name,tier), violation_types(name)').neq('status','archived');
  const stu=clean($(`${panelId}-stu`).value);
  const sec=$(`${panelId}-sec`).value;
  const level=$(`${panelId}-level`).value;
  const cat=$(`${panelId}-cat`).value;
  const type=$(`${panelId}-type`).value;
  const month=$(`${panelId}-month`).value;
  const from=$(`${panelId}-from`).value;
  const to=$(`${panelId}-to`).value;
  if(sec) q=q.eq('section_id',sec);
  if(cat) q=q.eq('category_id',cat);
  if(type) q=q.eq('type_id',type);
  if(from) q=q.gte('date',from);
  if(to) q=q.lte('date',to);
  if(month){ const [y,m]=month.split('-'); const start=`${y}-${m}-01`; const end=new Date(+y,+m,0).toISOString().slice(0,10); q=q.gte('date',start).lte('date',end); }
  const {data,error}=await q.order('date',{ascending:false});
  if(error){ $(`${panelId}-tbl`).innerHTML=`<tr><td>تعذر التحميل: ${error.message}</td></tr>`; return; }
  let rows=data||[];
  if(stu) rows=rows.filter(r=>r.students?.full_name?.includes(stu));
  if(level) rows=rows.filter(r=>String(r.sections?.level)===level);
  STATS_ROWS[panelId]=rows;
  $(`${panelId}-tbl`).innerHTML = rows.length
    ? '<tr><th>الطالبة</th><th>الشعبة</th><th>الفئة</th><th>النوع</th><th>التاريخ</th><th>الحالة</th></tr>'+
      rows.map(v=>`<tr><td>${v.students?.full_name||'—'}</td><td class="c">${v.sections?.code||'—'}</td><td class="c">${v.violation_categories?.name||''}</td><td>${v.violation_types?.name||''}</td><td class="c">${v.date}</td><td class="c">${STATUS_LABEL[v.status]||v.status}</td></tr>`).join('')
    : '<tr><td style="padding:16px;text-align:center;color:#8a93a0">لا نتائج</td></tr>';
}

function printStats(panelId){
  const rows=STATS_ROWS[panelId]||[];
  if(!rows.length){ toast('لا بيانات للطباعة'); return; }
  $('printAreaViol').innerHTML=`${printHeaderHtml('تقرير المخالفات السلوكية')}
    <table class="viol-print-tbl">
      <tr><th>الطالبة</th><th>الشعبة</th><th>الفئة</th><th>النوع</th><th>التاريخ</th><th>الحالة</th></tr>
      ${rows.map(v=>`<tr><td>${v.students?.full_name||'—'}</td><td>${v.sections?.code||'—'}</td><td>${v.violation_categories?.name||''}</td><td>${v.violation_types?.name||''}</td><td>${v.date}</td><td>${STATUS_LABEL[v.status]||v.status}</td></tr>`).join('')}
    </table>`;
  printWithTitle('تقرير_المخالفات','printAreaViol');
}

async function exportStats(panelId){
  const rows=STATS_ROWS[panelId]||[];
  if(!rows.length){ toast('لا بيانات للتصدير'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('المخالفات',{views:[{rightToLeft:true}]});
  ws.addRow(['الطالبة','الرقم الأكاديمي','الشعبة','الفئة','النوع','التاريخ','الحالة']).eachCell(c=>{ c.font={bold:true}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD0E8D8'}}; });
  rows.forEach(v=>ws.addRow([v.students?.full_name||'—', v.students?.academic_number||'', v.sections?.code||'', v.violation_categories?.name||'', v.violation_types?.name||'', v.date, STATUS_LABEL[v.status]||v.status]));
  ws.columns.forEach(c=>c.width=20);
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='تقرير_المخالفات.xlsx'; a.click();
  URL.revokeObjectURL(url);
}
