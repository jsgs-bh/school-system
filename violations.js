/* violations.js — منظومة المخالفات السلوكية، بحسب استمارة "متابعة المخالفات
   السلوكية" المعتمدة (٤ فئات). تدفق الحالة:
   جديدة (new) ← اعتماد (approved) أو أرشفة (archived، قابلة للاسترجاع)
   الفئة ٣/٤ أو ٣+ مخالفات لنفس الطالبة ← محوَّلة (escalated) لمكتب الإرشاد
   ← مغلقة (closed) بعد متابعة الإرشاد.
   ثلاث شاشات: المعلمة، مسؤولة المخالفات/الأدمن، مكتب الإرشاد الاجتماعي. */
import { db, $, S, clean, toast, printHeaderHtml, printWithTitle, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="violTeacher" style="display:none">
  <div class="lm-subnav" id="vtSubnav">
    <button class="lm-subnav-btn" data-vt="add">➕ إضافة مخالفة</button>
    <button class="lm-subnav-btn" data-vt="mine">📋 المخالفات المرصودة</button>
  </div>

  <div data-vt="add">
    <div class="panel">
      <h3>تسجيل مخالفة سلوكية</h3>
      <div class="field" style="max-width:420px">
        <label>الصف / الشعبة</label>
        <select id="vAddSecPick"><option value="">اختاري الصف…</option></select>
      </div>
      <div class="field" style="max-width:420px">
        <label>اسم الطالبة</label>
        <select id="vAddStuPick" disabled><option value="">اختاري الصف أولاً…</option></select>
      </div>
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
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <h3 style="margin:0">المخالفات المرصودة (اللي سجّلتيها)</h3>
        <button class="btn ghost" id="vMinePrint" style="width:auto;padding:8px 18px;font-size:12.5px">🖨️ طباعة تقرير PDF</button>
      </div>
      <div id="vMineList"></div>
    </div>
  </div>
</div>

<div class="app-main wide" id="violAdmin" style="display:none">
  <div class="lm-subnav" id="vaSubnav">
    <button class="lm-subnav-btn" data-va="new">🆕 مخالفات جديدة</button>
    <button class="lm-subnav-btn" data-va="stats">📊 متابعة المخالفات</button>
    <button class="lm-subnav-btn" data-va="alerts">🚨 تنبيهات</button>
    <button class="lm-subnav-btn" data-va="escalated">↗️ المخالفات المحوَّلة</button>
    <button class="lm-subnav-btn" data-va="archive">🗂️ الأرشيف</button>
  </div>

  <div data-va="new">
    <div class="panel"><h3>مخالفات جديدة (بانتظار الاعتماد)</h3><div id="vaNewList"></div></div>
  </div>

  <div data-va="stats" style="display:none">
    <div class="panel" id="vaStatsPanel"></div>
  </div>

  <div data-va="alerts" style="display:none">
    <div class="panel">
      <h3>تنبيهات</h3>
      <div class="sub">طالبات لديهن ٣ مخالفات فأكثر، أو مخالفة من الفئة الثالثة/الرابعة (تظهر بالأحمر — محوَّلة تلقائياً لمكتب الإرشاد والقيادة العليا).</div>
      <div id="vaRepeatList"></div>
    </div>
  </div>

  <div data-va="escalated" style="display:none">
    <div class="panel"><h3>المخالفات المحوَّلة لمكتب الإرشاد الاجتماعي</h3><div id="vaEscList"></div></div>
  </div>

  <div data-va="archive" style="display:none">
    <div class="panel"><h3>الأرشيف</h3><div id="vaArchiveList"></div></div>
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
  .lm-subnav-btn{background:#fff;border:1.5px solid var(--line);border-radius:9px;padding:9px 16px;font:inherit;font-size:13px;font-weight:600;color:var(--navy);cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .lm-subnav-btn.active{background:var(--gold);border-color:var(--gold);color:#fff}
  .viol-cats{display:flex;gap:8px;flex-wrap:wrap}
  .viol-cat-btn{border:2px solid var(--line);border-radius:10px;padding:10px 16px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;background:#fff}
  .viol-cat-btn.on{border-color:var(--navy);box-shadow:0 0 0 2px var(--navy) inset}
  .viol-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:10px}
  .viol-card.viol-danger{background:#fff3f2;border-color:#e57373}
  .viol-card-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px}
  .viol-tag{display:inline-block;border-radius:99px;padding:3px 12px;font-size:11.5px;font-weight:700;color:#3a2e00}
  .viol-meta{font-size:12px;color:#6b7683}
  .viol-notes{font-size:13px;color:#333;margin:8px 0;background:var(--sand);border-radius:8px;padding:8px 12px}
  .viol-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
  .viol-actions textarea{width:100%;min-height:60px;border:1.5px solid var(--line);border-radius:8px;padding:8px;font:inherit;font-size:13px;margin-bottom:6px}
  .viol-modal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999;display:flex;align-items:center;justify-content:center}
  .viol-modal-box{background:#fff;border-radius:14px;padding:22px;max-width:640px;width:92%;max-height:85vh;overflow:auto;position:relative}
  .viol-modal-close{position:absolute;top:12px;left:12px;background:none;border:none;font-size:18px;cursor:pointer;color:#8a93a0}
  .viol-repeat-row{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-bottom:8px}
  .viol-repeat-row.danger{background:#fff3f2;border-color:#e57373}
  .viol-repeat-row .viol-name{cursor:pointer;flex:1}
  .viol-repeat-row .viol-name:hover{text-decoration:underline}
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
const STATUS_LABEL={new:'جديدة',approved:'معتمدة',admin_action:'تحت الإجراء',archived:'مؤرشَفة',escalated:'محوَّلة للإرشاد',guidance_action:'تحت متابعة الإرشاد',closed:'مغلقة'};
let CATEGORIES=[], TYPES=[];

async function loadCatsTypes(){
  if(CATEGORIES.length) return;
  const [{data:cats},{data:types}]=await Promise.all([
    db.from('violation_categories').select('*').order('tier'),
    db.from('violation_types').select('*').order('sort_order'),
  ]);
  CATEGORIES=cats||[]; TYPES=types||[];
}
function tierBadge(cat){ return `<span class="viol-tag" style="background:${TIER_COLORS[cat?.tier]||'#eee'}">${cat?.name||'—'}</span>`; }

/* ============ شاشة المعلمة ============ */
function switchVt(tab){
  document.querySelectorAll('#violTeacher > [data-vt]').forEach(el=>{ el.style.display=el.dataset.vt===tab?'block':'none'; });
  $('vtSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.classList.toggle('active',b.dataset.vt===tab));
  if(tab==='mine') loadMineViolations();
}

async function initViolTeacher(){
  if($('vtSubnav').dataset.ready) return;
  $('vtSubnav').dataset.ready='1';
  await loadCatsTypes();
  $('vtSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.addEventListener('click',()=>switchVt(b.dataset.vt)));
  switchVt('add');
  bindMinePrint();

  $('vAddCats').innerHTML=CATEGORIES.map(c=>`<button type="button" class="viol-cat-btn" data-cat="${c.id}" style="border-color:${TIER_COLORS[c.tier]}">${c.name}</button>`).join('');
  $('vAddCats').querySelectorAll('.viol-cat-btn').forEach(b=>b.addEventListener('click',()=>{
    $('vAddCats').querySelectorAll('.viol-cat-btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    const opts=TYPES.filter(t=>t.category_id===b.dataset.cat);
    $('vAddType').innerHTML=opts.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
    $('vAddTypeWrap').style.display='block';
  }));

  const {data:sections}=await db.from('sections').select('id,code').eq('academic_year_id',S.YEAR.id).order('code');
  $('vAddSecPick').innerHTML='<option value="">اختاري الصف…</option>'+(sections||[]).map(s=>`<option value="${s.id}">${s.code}</option>`).join('');
  $('vAddSecPick').addEventListener('change', async ()=>{
    const secId=$('vAddSecPick').value;
    $('vAddStuPick').innerHTML='<option value="">جارٍ التحميل…</option>'; $('vAddStuPick').disabled=true;
    if(!secId){ $('vAddStuPick').innerHTML='<option value="">اختاري الصف أولاً…</option>'; return; }
    const {data}=await db.from('enrollments').select('students(id,full_name,academic_number)').eq('section_id',secId).is('to_date',null);
    const stus=(data||[]).map(e=>e.students).filter(Boolean).sort((a,b)=>a.full_name.localeCompare(b.full_name,'ar'));
    $('vAddStuPick').innerHTML='<option value="">اختاري الطالبة…</option>'+stus.map(s=>`<option value="${s.id}">${s.full_name} (${s.academic_number})</option>`).join('');
    $('vAddStuPick').disabled=false;
  });

  $('vAddSave').addEventListener('click', async ()=>{
    const secId=$('vAddSecPick').value;
    if(!secId||!$('vAddStuPick').value){ toast('اختاري الصف ثم الطالبة'); return; }
    const catBtn=$('vAddCats').querySelector('.viol-cat-btn.on');
    if(!catBtn){ toast('اختاري الفئة'); return; }
    const cat=CATEGORIES.find(c=>c.id===catBtn.dataset.cat);
    const typeId=$('vAddType').value||null;
    const notes=clean($('vAddNotes').value);
    const btn=$('vAddSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
    try{
      /* الفئتان الثالثة والرابعة تُحوَّل تلقائياً ومباشرة لمكتب الإرشاد
         الاجتماعي، وتظهر بالتنبيهات بالأحمر، بدون ما تمر على "مخالفات
         جديدة" — القيادة العليا تشوفها بعد ضمن نفس شاشة التنبيهات. */
      const isHighTier=cat.tier>=3;
      const {data:saved,error}=await db.from('violations').insert({
        academic_year_id:S.YEAR.id, student_id:$('vAddStuPick').value, section_id:secId, category_id:cat.id, type_id:typeId,
        reported_by:S.ME.id, notes:notes||null, date:new Date().toISOString().slice(0,10),
        status:isHighTier?'escalated':'new', escalated_at:isHighTier?new Date().toISOString():null, escalated_by:isHighTier?S.ME.id:null
      }).select('code').single();
      if(error) throw error;
      toast(`${isHighTier?'تم الحفظ — مخالفة من فئة عالية تُحوَّل مباشرة لمكتب الإرشاد':'تم حفظ المخالفة'} — رمزها: #${saved.code}`);
      $('vAddSecPick').value=''; $('vAddStuPick').innerHTML='<option value="">اختاري الصف أولاً…</option>'; $('vAddStuPick').disabled=true;
      $('vAddNotes').value=''; catBtn.classList.remove('on'); $('vAddTypeWrap').style.display='none';
    }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
    finally{ btn.disabled=false; btn.textContent='حفظ المخالفة'; }
  });
}

let MINE_ROWS=[];
async function loadMineViolations(){
  const {data,error}=await db.from('violations').select('*, students(full_name,academic_number), sections(code), violation_categories(name,tier), violation_types(name)').eq('academic_year_id',S.YEAR.id)
    .eq('reported_by',S.ME.id).order('created_at',{ascending:false});
  if(error){ $('vMineList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  MINE_ROWS=data||[];
  if(!MINE_ROWS.length){ $('vMineList').innerHTML='<div class="empty-day">ما سجّلتِ أي مخالفة بعد.</div>'; return; }
  $('vMineList').innerHTML=MINE_ROWS.map(v=>violCard(v)).join('');
}

function bindMinePrint(){
  if($('vMinePrint').dataset.ready) return;
  $('vMinePrint').dataset.ready='1';
  $('vMinePrint').addEventListener('click',()=>{
    if(!MINE_ROWS.length){ toast('لا مخالفات للطباعة'); return; }
    $('printAreaViol').innerHTML=`${printHeaderHtml('تقرير المخالفات المرصودة')}
      <table class="viol-print-tbl"><tr><th>الرمز</th><th>الطالبة</th><th>الشعبة</th><th>الفئة</th><th>النوع</th><th>التاريخ</th><th>الحالة</th></tr>
      ${MINE_ROWS.map(v=>`<tr><td>#${v.code}</td><td>${v.students?.full_name||'—'}</td><td>${v.sections?.code||'—'}</td><td>${v.violation_categories?.name||''}</td><td>${v.violation_types?.name||''}</td><td>${v.date}</td><td>${STATUS_LABEL[v.status]||v.status}</td></tr>`).join('')}
      </table>`;
    printWithTitle('تقرير_مخالفاتي','printAreaViol');
  });
}

function violCard(v){
  return `<div class="viol-card ${v.violation_categories?.tier>=3?'viol-danger':''}">
    <div class="viol-card-head">
      <div><b>${v.students?.full_name||'—'}</b> <span class="viol-meta">(${v.students?.academic_number||''}) — رمز #${v.code}</span></div>
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
  document.querySelectorAll('#violAdmin > [data-va]').forEach(el=>{ el.style.display=el.dataset.va===tab?'block':'none'; });
  $('vaSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.classList.toggle('active',b.dataset.va===tab));
  if(tab==='new') loadNewViolations();
  if(tab==='stats') initStatsPanel('vaStatsPanel');
  if(tab==='alerts') loadAlerts();
  if(tab==='escalated') loadEscalatedList();
  if(tab==='archive') loadArchiveList();
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
  const {data,error}=await db.from('violations').select('*, students(full_name,academic_number), sections(code), violation_categories(name,tier), violation_types(name), staff:reported_by(full_name)').eq('academic_year_id',S.YEAR.id)
    .eq('status','new').order('created_at',{ascending:false});
  if(error){ $('vaNewList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!(data||[]).length){ $('vaNewList').innerHTML='<div class="empty-day">لا مخالفات جديدة بانتظار الاعتماد 🎉</div>'; return; }
  $('vaNewList').innerHTML=data.map(v=>`
    <div class="viol-card">
      <div class="viol-card-head">
        <div><b>${v.students?.full_name||'—'}</b> <span class="viol-meta">(${v.students?.academic_number||''} — ${v.sections?.code||''}) — رمز #${v.code}</span></div>
        ${tierBadge(v.violation_categories)}
      </div>
      <div class="viol-meta">${v.violation_types?.name||''} · ${v.date} · رصدتها: ${v.staff?.full_name||''}</div>
      ${v.notes?`<div class="viol-notes">${v.notes}</div>`:''}
      <div class="viol-actions">
        <button class="btn gold" data-approve="${v.id}" style="width:auto;padding:8px 18px;font-size:12.5px">✔️ اعتماد</button>
        <button class="btn ghost" data-archive="${v.id}" style="width:auto;padding:8px 18px;font-size:12.5px">🗂️ أرشفة</button>
      </div>
    </div>`).join('');
  $('vaNewList').querySelectorAll('[data-approve]').forEach(b=>b.addEventListener('click', async ()=>{
    const {error}=await db.from('violations').update({status:'approved', admin_action_by:S.ME.id, admin_action_at:new Date().toISOString()}).eq('id',b.dataset.approve);
    if(error){ toast('تعذر: '+error.message); return; }
    toast('تم اعتماد المخالفة'); loadNewViolations();
  }));
  $('vaNewList').querySelectorAll('[data-archive]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('أرشفة هذي المخالفة؟')) return;
    const {error}=await db.from('violations').update({status:'archived'}).eq('id',b.dataset.archive);
    if(error){ toast('تعذر: '+error.message); return; }
    toast('تم الأرشفة'); loadNewViolations();
  }));
}

async function loadArchiveList(){
  const {data,error}=await db.from('violations').select('*, students(full_name,academic_number), sections(code), violation_categories(name,tier), violation_types(name), staff:reported_by(full_name)').eq('academic_year_id',S.YEAR.id)
    .eq('status','archived').order('created_at',{ascending:false});
  if(error){ $('vaArchiveList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!(data||[]).length){ $('vaArchiveList').innerHTML='<div class="empty-day">الأرشيف فاضي حالياً.</div>'; return; }
  $('vaArchiveList').innerHTML=data.map(v=>`
    <div class="viol-card">
      <div class="viol-card-head">
        <div><b>${v.students?.full_name||'—'}</b> <span class="viol-meta">(${v.students?.academic_number||''} — ${v.sections?.code||''}) — رمز #${v.code}</span></div>
        ${tierBadge(v.violation_categories)}
      </div>
      <div class="viol-meta">${v.violation_types?.name||''} · ${v.date} · رصدتها: ${v.staff?.full_name||''}</div>
      ${v.notes?`<div class="viol-notes">${v.notes}</div>`:''}
      <div class="viol-actions">
        <button class="btn gold" data-restore="${v.id}" style="width:auto;padding:8px 18px;font-size:12.5px">↩️ استرجاع لمخالفات جديدة</button>
      </div>
    </div>`).join('');
  $('vaArchiveList').querySelectorAll('[data-restore]').forEach(b=>b.addEventListener('click', async ()=>{
    const {error}=await db.from('violations').update({status:'new'}).eq('id',b.dataset.restore);
    if(error){ toast('تعذر: '+error.message); return; }
    toast('تم الاسترجاع — راجعيها بتبويب "مخالفات جديدة"'); loadArchiveList();
  }));
}

async function loadAlerts(){
  const {data,error}=await db.from('violations').select('student_id, created_at, escalated_at, students(full_name,academic_number), sections(code), violation_categories(tier)').eq('academic_year_id',S.YEAR.id)
    .neq('status','archived');
  if(error){ $('vaRepeatList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  const byStu={};
  for(const v of data||[]){
    const k=v.student_id;
    (byStu[k] ??= {rows:[], s:v.students, sec:v.sections}).rows.push(v);
  }
  const alerts=[];
  for(const [sid,v] of Object.entries(byStu)){
    /* بعد أي تحويل سابق للطالبة، نبدأ عدّ المخالفات من جديد — المخالفات
       اللي قبل آخر تحويل تبقى بسجلها التاريخي بس ما تُحتسب مرة ثانية
       لتنبيه "٣ مخالفات فأكثر" الحالي. */
    const lastEscalation=v.rows.reduce((max,r)=>r.escalated_at&&(!max||r.escalated_at>max)?r.escalated_at:max,null);
    const fresh=lastEscalation ? v.rows.filter(r=>r.created_at>lastEscalation) : v.rows;
    const count=fresh.length;
    const highTier=fresh.some(r=>(r.violation_categories?.tier||0)>=3);
    if(count>=3||highTier) alerts.push([sid,{count,highTier,s:v.s,sec:v.sec}]);
  }
  alerts.sort((a,b)=>(b[1].highTier-a[1].highTier)||(b[1].count-a[1].count));
  $('vaRepeatList').innerHTML=alerts.length
    ? alerts.map(([sid,v])=>`
      <div class="viol-repeat-row ${v.highTier?'danger':''}">
        <span class="viol-name" data-stu="${sid}">${v.s?.full_name} <small class="viol-meta">(${v.s?.academic_number} — ${v.sec?.code||''}) — ${v.count} مخالفات${v.highTier?' — فئة عالية':''}</small></span>
        ${v.highTier ? '<small class="viol-meta">↗️ محوَّلة تلقائياً</small>' : `<button class="btn gold" data-transfer="${sid}" style="width:auto;padding:7px 16px;font-size:12px">تحويل لمكتب الإرشاد</button>`}
      </div>`).join('')
    : '<div class="empty-day">لا تنبيهات حالياً.</div>';
  $('vaRepeatList').querySelectorAll('.viol-name, [data-transfer]').forEach(el=>el.addEventListener('click',()=>openStudentModal(el.dataset.stu||el.dataset.transfer)));
}

async function openStudentModal(studentId){
  const {data,error}=await db.from('violations').select('*, violation_categories(name,tier), violation_types(name), staff:reported_by(full_name)').eq('academic_year_id',S.YEAR.id)
    .eq('student_id',studentId).neq('status','archived').order('date',{ascending:false});
  if(error){ toast('تعذر التحميل: '+error.message); return; }
  const {data:stu}=await db.from('students').select('full_name,academic_number,enrollments!inner(section_id,to_date,sections(code))').eq('id',studentId).is('enrollments.to_date',null).single();
  const stuSec=stu.enrollments?.[0]?.sections?.code||'';
  const existingAction=(data||[]).find(v=>v.admin_action_text)?.admin_action_text||'';
  $('vaModalBody').innerHTML=`
    <h3>${stu.full_name} <small class="viol-meta">(${stu.academic_number} — ${stuSec})</small></h3>
    ${(data||[]).map(v=>`<div class="viol-card ${v.violation_categories?.tier>=3?'viol-danger':''}"><div class="viol-card-head">${tierBadge(v.violation_categories)}<span class="viol-meta">${v.date} — رمز #${v.code}</span></div><div class="viol-meta">${v.violation_types?.name||''} · رصدتها: ${v.staff?.full_name||''}</div>${v.notes?`<div class="viol-notes">${v.notes}</div>`:''}</div>`).join('')}
    <div class="field"><label>إجراءات الإشراف الإداري</label><textarea id="vaModalAction" rows="3" placeholder="اكتبي الإجراء المتخذ مع الطالبة…">${existingAction}</textarea></div>
    <div class="viol-actions">
      <button class="btn ghost" id="vaModalPrint" style="width:auto;padding:10px 20px">🖨️ طباعة التقرير</button>
      <button class="btn gold" id="vaModalEscalate" style="width:auto;padding:10px 22px">تحويل الطالبة إلى مكتب الإرشاد الاجتماعي</button>
    </div>
  `;
  $('vaModalPrint').addEventListener('click',()=>{
    $('printAreaViol').innerHTML=`${printHeaderHtml(`تقرير مخالفات الطالبة: ${stu.full_name}`)}
      <p>الرقم الأكاديمي: ${stu.academic_number} — الشعبة: ${stuSec}</p>
      <table class="viol-print-tbl"><tr><th>الرمز</th><th>الفئة</th><th>النوع</th><th>التاريخ</th><th>رصدتها</th></tr>
      ${(data||[]).map(v=>`<tr><td>#${v.code}</td><td>${v.violation_categories?.name||''}</td><td>${v.violation_types?.name||''}</td><td>${v.date}</td><td>${v.staff?.full_name||''}</td></tr>`).join('')}
      </table>
      ${$('vaModalAction').value?`<p><b>إجراءات الإشراف الإداري:</b> ${clean($('vaModalAction').value)}</p>`:''}`;
    printWithTitle(`تقرير_مخالفات_${stu.full_name}`,'printAreaViol');
  });
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
  const {data,error}=await db.from('violations').select('*, students(full_name,academic_number), sections(code), violation_categories(name,tier), violation_types(name)').eq('academic_year_id',S.YEAR.id)
    .in('status',['escalated','guidance_action','closed']).order('escalated_at',{ascending:false});
  if(error){ $('vaEscList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  $('vaEscList').innerHTML=(data||[]).length ? data.map(v=>`
    <div class="viol-card">
      <div class="viol-card-head"><b>${v.students?.full_name}</b><span class="viol-meta">رمز #${v.code}</span>${tierBadge(v.violation_categories)}</div>
      <div class="viol-meta">${v.violation_types?.name||''} · ${v.date} · الحالة: ${STATUS_LABEL[v.status]}</div>
      ${v.admin_action_text?`<div class="viol-notes"><b>إجراء الإشراف الإداري:</b> ${v.admin_action_text}</div>`:''}
      ${v.guidance_action_text?`<div class="viol-notes"><b>إجراء الإرشاد الاجتماعي:</b> ${v.guidance_action_text}</div>`:''}
    </div>`).join('') : '<div class="empty-day">لا مخالفات محوَّلة حالياً.</div>';
}

registerTab({id:'violAdmin', label:'إدارة المخالفات', group:'violations', groupLabel:'المخالفات',
  show:f=>f.isAdmin||f.isLead||f.isViolationsLead, init:initViolAdmin});

/* ============ شاشة مكتب الإرشاد الاجتماعي ============ */
function switchVg(tab){
  document.querySelectorAll('#violGuidance > [data-vg]').forEach(el=>{ el.style.display=el.dataset.vg===tab?'block':'none'; });
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
  const {data,error}=await db.from('violations').select('*, students(full_name,academic_number), sections(code), violation_categories(name,tier), violation_types(name)').eq('academic_year_id',S.YEAR.id)
    .eq('status','escalated').order('escalated_at',{ascending:true});
  if(error){ $('vgPendingList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!(data||[]).length){ $('vgPendingList').innerHTML='<div class="empty-day">لا مخالفات بانتظار المتابعة 🎉</div>'; return; }
  $('vgPendingList').innerHTML=data.map(v=>`
    <div class="viol-card ${v.violation_categories?.tier>=3?'viol-danger':''}">
      <div class="viol-card-head"><b>${v.students?.full_name}</b><span class="viol-meta">رمز #${v.code}</span>${tierBadge(v.violation_categories)}</div>
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
  const {data,error}=await db.from('violations').select('*, students(full_name,academic_number), sections(code), violation_categories(name,tier), violation_types(name)').eq('academic_year_id',S.YEAR.id)
    .eq('status','closed').not('guidance_action_text','is',null).order('closed_at',{ascending:false});
  if(error){ $('vgArchiveList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  $('vgArchiveList').innerHTML=(data||[]).length ? data.map(v=>`
    <div class="viol-card">
      <div class="viol-card-head"><b>${v.students?.full_name}</b><span class="viol-meta">رمز #${v.code}</span>${tierBadge(v.violation_categories)}</div>
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
    <h3>تقرير مفصّل</h3>
    <div class="row" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
      <select id="${panelId}-rtype">
        <option value="student">تقرير طالبة</option>
        <option value="section">تقرير صف</option>
        <option value="level">تقرير مستوى</option>
        <option value="school">تقرير المدرسة</option>
      </select>
      <select id="${panelId}-rsec" style="display:none"><option value="">اختاري الصف…</option>${(sections||[]).map(s=>`<option value="${s.id}">${s.code}</option>`).join('')}</select>
      <select id="${panelId}-rlevel" style="display:none"><option value="1">الأول</option><option value="2">الثاني</option><option value="3">الثالث</option></select>
      <div style="position:relative;display:none" id="${panelId}-rstuWrap">
        <input type="text" id="${panelId}-rstu" placeholder="ابحثي عن اسم طالبة…" autocomplete="off" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;min-width:220px">
        <div class="sugg" id="${panelId}-rstuSugg"></div>
      </div>
      <span class="viol-meta">من</span><input type="date" id="${panelId}-rfrom">
      <span class="viol-meta">إلى</span><input type="date" id="${panelId}-rto">
      <button class="btn gold" id="${panelId}-rgo" style="width:auto;padding:9px 20px">توليد التقرير</button>
      <button class="btn ghost" id="${panelId}-rprint" style="width:auto;padding:9px 20px;display:none">🖨️ طباعة</button>
    </div>
    <div id="${panelId}-report"></div>

    <h3 style="margin-top:26px">فرز سريع</h3>
    <div class="row" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <input type="text" id="${panelId}-stu" placeholder="اسم طالبة…" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      <select id="${panelId}-sec"><option value="">كل الشعب</option>${(sections||[]).map(s=>`<option value="${s.id}">${s.code}</option>`).join('')}</select>
      <select id="${panelId}-level"><option value="">كل المستويات</option><option value="1">الأول</option><option value="2">الثاني</option><option value="3">الثالث</option></select>
      <select id="${panelId}-cat"><option value="">كل الفئات</option>${CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select>
      <select id="${panelId}-type"><option value="">كل الأنواع</option>${TYPES.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select>
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
  bindReportUI(panelId);
}

/* ============ محرّك التقرير المفصّل (طالبة / صف / مستوى / المدرسة) ============ */
let REPORT_STU_PICK={};
function bindReportUI(panelId){
  const rtype=$(`${panelId}-rtype`);
  const showFor=()=>{
    const t=rtype.value;
    $(`${panelId}-rsec`).style.display = t==='section' ? 'inline-block' : 'none';
    $(`${panelId}-rlevel`).style.display = t==='level' ? 'inline-block' : 'none';
    $(`${panelId}-rstuWrap`).style.display = t==='student' ? 'inline-block' : 'none';
  };
  rtype.addEventListener('change',showFor); showFor();

  let searchTimer=null;
  $(`${panelId}-rstu`).addEventListener('input',()=>{
    clearTimeout(searchTimer);
    const q=clean($(`${panelId}-rstu`).value);
    REPORT_STU_PICK[panelId]=null;
    if(q.length<2){ $(`${panelId}-rstuSugg`).innerHTML=''; return; }
    searchTimer=setTimeout(async ()=>{
      const {data}=await db.from('students').select('id,full_name,academic_number,enrollments!inner(section_id,to_date,sections(code))')
        .ilike('full_name',`%${q}%`).is('enrollments.to_date',null).limit(8);
      $(`${panelId}-rstuSugg`).innerHTML=(data||[]).map(s=>`<div class="opt" data-id="${s.id}" data-name="${s.full_name}" data-acad="${s.academic_number}" data-sec="${s.enrollments?.[0]?.sections?.code||''}">${s.full_name}<small>${s.academic_number} — ${s.enrollments?.[0]?.sections?.code||''}</small></div>`).join('');
      $(`${panelId}-rstuSugg`).querySelectorAll('.opt').forEach(el=>el.addEventListener('click',()=>{
        REPORT_STU_PICK[panelId]={id:el.dataset.id,full_name:el.dataset.name,academic_number:el.dataset.acad,section_code:el.dataset.sec};
        $(`${panelId}-rstu`).value=el.dataset.name; $(`${panelId}-rstuSugg`).innerHTML='';
      }));
    },250);
  });

  $(`${panelId}-rgo`).addEventListener('click',()=>generateReport(panelId));
  $(`${panelId}-rprint`).addEventListener('click',()=>printReport(panelId));
}

function monthKey(d){ return d.slice(0,7); } // YYYY-MM
function monthLabel(k){
  const [y,m]=k.split('-');
  const names=['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return `${names[+m]} ${y}`;
}
function simpleBarChart(pairs){ // [[label,count],...]
  if(!pairs.length) return '';
  const max=Math.max(...pairs.map(p=>p[1]),1);
  return `<div style="display:flex;align-items:flex-end;gap:10px;height:160px;padding:10px 4px;border-bottom:1.5px solid var(--line);overflow-x:auto">
    ${pairs.map(([label,val])=>`
      <div style="display:flex;flex-direction:column;align-items:center;min-width:52px">
        <div style="font-size:11px;color:var(--navy);font-weight:700;margin-bottom:4px">${val}</div>
        <div style="width:30px;height:${Math.max(6,Math.round(val/max*120))}px;background:var(--gold);border-radius:5px 5px 0 0"></div>
        <div style="font-size:10.5px;color:#6b7683;margin-top:6px;text-align:center;max-width:60px;white-space:normal">${label}</div>
      </div>`).join('')}
  </div>`;
}

let REPORT_LAST={};
async function generateReport(panelId){
  const type=$(`${panelId}-rtype`).value;
  const from=$(`${panelId}-rfrom`).value, to=$(`${panelId}-rto`).value;
  let q=db.from('violations').select('*, students(full_name,academic_number), sections(code,level), violation_categories(name,tier), violation_types(name)')
    .eq('academic_year_id',S.YEAR.id).neq('status','archived');
  if(from) q=q.gte('date',from);
  if(to) q=q.lte('date',to);

  let title='', rows=[], headerHtml='';
  if(type==='student'){
    const stu=REPORT_STU_PICK[panelId];
    if(!stu){ toast('اختاري طالبة من نتائج البحث أولاً'); return; }
    const {data,error}=await q.eq('student_id',stu.id).order('date',{ascending:false});
    if(error){ toast('تعذر التحميل: '+error.message); return; }
    rows=data||[];
    title=`تقرير الطالبة: ${stu.full_name}`;
    headerHtml=`<p style="font-size:14px"><b>${stu.full_name}</b> — الرقم الأكاديمي: ${stu.academic_number} — الشعبة: ${stu.section_code}</p>`;
  } else if(type==='section'){
    const secId=$(`${panelId}-rsec`).value;
    if(!secId){ toast('اختاري الصف'); return; }
    const secCode=$(`${panelId}-rsec`).selectedOptions[0].textContent;
    const {data,error}=await q.eq('section_id',secId).order('date',{ascending:false});
    if(error){ toast('تعذر التحميل: '+error.message); return; }
    rows=data||[];
    title=`تقرير الصف: ${secCode}`;
    headerHtml=`<p style="font-size:14px"><b>الشعبة: ${secCode}</b> — عدد الطالبات المخالِفات: ${new Set(rows.map(r=>r.student_id)).size}</p>`;
  } else if(type==='level'){
    const level=$(`${panelId}-rlevel`).value;
    const {data,error}=await q.order('date',{ascending:false});
    if(error){ toast('تعذر التحميل: '+error.message); return; }
    rows=(data||[]).filter(r=>String(r.sections?.level)===level);
    title=`تقرير المستوى ${['','الأول','الثاني','الثالث'][+level]}`;
    headerHtml=`<p style="font-size:14px"><b>${title}</b> — عدد الطالبات المخالِفات: ${new Set(rows.map(r=>r.student_id)).size}</p>`;
  } else {
    const {data,error}=await q.order('date',{ascending:false});
    if(error){ toast('تعذر التحميل: '+error.message); return; }
    rows=data||[];
    title='تقرير المدرسة الشامل';
    headerHtml=`<p style="font-size:14px"><b>كل المدرسة</b> — عدد الطالبات المخالِفات: ${new Set(rows.map(r=>r.student_id)).size}</p>`;
  }

  if(!rows.length){
    $(`${panelId}-report`).innerHTML='<div class="empty-day">لا مخالفات ضمن هذا النطاق/الفترة.</div>';
    $(`${panelId}-rprint`).style.display='none';
    return;
  }

  // إحصائية الفئات
  const catCounts={};
  for(const r of rows) catCounts[r.violation_categories?.name||'—']=(catCounts[r.violation_categories?.name||'—']||0)+1;
  const catTable=`<table class="board"><tr><th>الفئة</th><th>العدد</th></tr>${Object.entries(catCounts).map(([n,c])=>`<tr><td>${n}</td><td class="c">${c}</td></tr>`).join('')}</table>`;

  // إحصائية شهرية (لو أكثر من شهر وحد)
  const monthCounts={};
  for(const r of rows) monthCounts[monthKey(r.date)]=(monthCounts[monthKey(r.date)]||0)+1;
  const months=Object.keys(monthCounts).sort();
  const monthHtml = months.length>1
    ? `<h4>توزيع المخالفات شهرياً</h4>
       <table class="board"><tr>${months.map(m=>`<th>${monthLabel(m)}</th>`).join('')}</tr><tr>${months.map(m=>`<td class="c">${monthCounts[m]}</td>`).join('')}</tr></table>
       ${simpleBarChart(months.map(m=>[monthLabel(m),monthCounts[m]]))}`
    : '';

  // مقارنة الشعب (لمستوى/مدرسة بس)
  let sectionChartHtml='';
  if(type==='level'||type==='school'){
    const secCounts={};
    for(const r of rows) secCounts[r.sections?.code||'—']=(secCounts[r.sections?.code||'—']||0)+1;
    const pairs=Object.entries(secCounts).sort((a,b)=>b[1]-a[1]);
    sectionChartHtml=`<h4>عدد المخالفات لكل شعبة</h4>${simpleBarChart(pairs)}`;
  }

  // وصف نصي تلقائي
  const topCat=Object.entries(catCounts).sort((a,b)=>b[1]-a[1])[0];
  const topMonth=months.length ? Object.entries(monthCounts).sort((a,b)=>b[1]-a[1])[0] : null;
  let desc=`سُجّلت ${rows.length} مخالفة ضمن هذا النطاق`;
  if(from||to) desc+=` خلال الفترة ${from||'—'} إلى ${to||'—'}`;
  desc+=`. الفئة الأكثر تكراراً: ${topCat[0]} (${topCat[1]} مخالفة)`;
  if(topMonth) desc+=`، وأعلى شهر كان ${monthLabel(topMonth[0])} بعدد ${topMonth[1]} مخالفة`;
  desc+='.';

  const listHtml=`<table class="board"><tr><th>الرمز</th><th>الطالبة</th><th>الشعبة</th><th>الفئة</th><th>النوع</th><th>التاريخ</th></tr>
    ${rows.map(r=>`<tr><td class="c">#${r.code}</td><td>${r.students?.full_name||'—'}</td><td class="c">${r.sections?.code||'—'}</td><td class="c">${r.violation_categories?.name||''}</td><td>${r.violation_types?.name||''}</td><td class="c">${r.date}</td></tr>`).join('')}
  </table>`;

  const html=`
    ${headerHtml}
    <div class="viol-notes">${desc}</div>
    <h4>عدد المخالفات لكل فئة</h4>
    ${catTable}
    ${sectionChartHtml}
    ${monthHtml}
    <h4>قائمة المخالفات${type!=='student'?' (' + rows.length + ')':''}</h4>
    ${listHtml}`;
  $(`${panelId}-report`).innerHTML=html;
  $(`${panelId}-rprint`).style.display='inline-block';
  REPORT_LAST[panelId]={title, html};
}

function printReport(panelId){
  const r=REPORT_LAST[panelId];
  if(!r){ toast('ولّدي تقرير أولاً'); return; }
  $('printAreaViol').innerHTML=`${printHeaderHtml(r.title)}<div style="font-size:12pt">${r.html.replace(/class="board"/g,'class="viol-print-tbl"')}</div>`;
  printWithTitle(r.title.replace(/\s+/g,'_'),'printAreaViol');
}

let STATS_ROWS={};
async function runStats(panelId){
  let q=db.from('violations').select('*, students(full_name,academic_number), sections(code,level), violation_categories(name,tier), violation_types(name)').eq('academic_year_id',S.YEAR.id).neq('status','archived');
  const stu=clean($(`${panelId}-stu`).value);
  const sec=$(`${panelId}-sec`).value;
  const level=$(`${panelId}-level`).value;
  const cat=$(`${panelId}-cat`).value;
  const type=$(`${panelId}-type`).value;
  if(sec) q=q.eq('section_id',sec);
  if(cat) q=q.eq('category_id',cat);
  if(type) q=q.eq('type_id',type);
  const {data,error}=await q.order('date',{ascending:false});
  if(error){ $(`${panelId}-tbl`).innerHTML=`<tr><td>تعذر التحميل: ${error.message}</td></tr>`; return; }
  let rows=data||[];
  if(stu) rows=rows.filter(r=>r.students?.full_name?.includes(stu));
  if(level) rows=rows.filter(r=>String(r.sections?.level)===level);
  STATS_ROWS[panelId]=rows;
  $(`${panelId}-tbl`).innerHTML = rows.length
    ? '<tr><th>الرمز</th><th>الطالبة</th><th>الشعبة</th><th>الفئة</th><th>النوع</th><th>التاريخ</th><th>الحالة</th></tr>'+
      rows.map(v=>`<tr><td class="c">#${v.code}</td><td>${v.students?.full_name||'—'}</td><td class="c">${v.sections?.code||'—'}</td><td class="c">${v.violation_categories?.name||''}</td><td>${v.violation_types?.name||''}</td><td class="c">${v.date}</td><td class="c">${STATUS_LABEL[v.status]||v.status}</td></tr>`).join('')
    : '<tr><td style="padding:16px;text-align:center;color:#8a93a0">لا نتائج</td></tr>';
}

function printStats(panelId){
  const rows=STATS_ROWS[panelId]||[];
  if(!rows.length){ toast('لا بيانات للطباعة'); return; }
  $('printAreaViol').innerHTML=`${printHeaderHtml('تقرير المخالفات السلوكية')}
    <table class="viol-print-tbl">
      <tr><th>الرمز</th><th>الطالبة</th><th>الشعبة</th><th>الفئة</th><th>النوع</th><th>التاريخ</th><th>الحالة</th></tr>
      ${rows.map(v=>`<tr><td>#${v.code}</td><td>${v.students?.full_name||'—'}</td><td>${v.sections?.code||'—'}</td><td>${v.violation_categories?.name||''}</td><td>${v.violation_types?.name||''}</td><td>${v.date}</td><td>${STATUS_LABEL[v.status]||v.status}</td></tr>`).join('')}
    </table>`;
  printWithTitle('تقرير_المخالفات','printAreaViol');
}

async function exportStats(panelId){
  const rows=STATS_ROWS[panelId]||[];
  if(!rows.length){ toast('لا بيانات للتصدير'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('المخالفات',{views:[{rightToLeft:true}]});
  ws.addRow(['الرمز','الطالبة','الرقم الأكاديمي','الشعبة','الفئة','النوع','التاريخ','الحالة']).eachCell(c=>{ c.font={bold:true}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD0E8D8'}}; });
  rows.forEach(v=>ws.addRow([v.code, v.students?.full_name||'—', v.students?.academic_number||'', v.sections?.code||'', v.violation_categories?.name||'', v.violation_types?.name||'', v.date, STATUS_LABEL[v.status]||v.status]));
  ws.columns.forEach(c=>c.width=20);
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='تقرير_المخالفات.xlsx'; a.click();
  URL.revokeObjectURL(url);
}
