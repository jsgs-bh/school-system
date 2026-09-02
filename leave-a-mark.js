/* leave-a-mark.js — فعاليات (تبويب مستقل، مو تحت الخطة الاستراتيجية)
   كل معلمة: تضيف فعالية + تشوف تقاريرها هي. المعلمة الأولى/رئيسة
   مشروع اترك بصمة/الأدمن: حصر شامل قابل للفرز والطباعة والتصدير. */
import { db, $, S, clean, normName, toast, getCurrentSemester, getLogoUrl, printWithTitle, registerTab, bindDrop } from './core.js';

const MONTH_LABELS={sep:'سبتمبر',oct:'أكتوبر',nov:'نوفمبر',dec:'ديسمبر',jan:'يناير',feb:'فبراير',mar:'مارس',apr:'أبريل',may:'مايو',jun:'يونيو'};
const MONTH_FROM_DATE=(dateStr)=>{
  if(!dateStr) return null;
  const m=+dateStr.slice(5,7);
  const map={9:'sep',10:'oct',11:'nov',12:'dec',1:'jan',2:'feb',3:'mar',4:'apr',5:'may',6:'jun'};
  return map[m]||null;
};

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="leaveMark" style="display:none">
  <div id="lmAnnounceModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center">
    <div style="background:var(--white);border-radius:14px;padding:24px;max-width:420px;width:90%;text-align:center">
      <h3 style="margin-top:0">📢 إعلان جديد</h3>
      <div id="lmAnnounceModalBody" style="margin:14px 0;font-size:14px"></div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn gold" id="lmAnnounceModalParticipate" style="width:auto;padding:9px 24px">✍️ سجّلي مشاركتك</button>
        <button class="btn ghost" id="lmAnnounceModalClose" style="width:auto;padding:9px 24px">لاحقاً</button>
      </div>
    </div>
  </div>

  <div class="lm-subnav" id="lmSubnav">
    <button class="lm-subnav-btn" data-lmtab="add">➕ إضافة تقرير فعالية</button>
    <button class="lm-subnav-btn" data-lmtab="mine">📋 متابعة الفعاليات</button>
    <button class="lm-subnav-btn" data-lmtab="open">🏆 مسابقات معلنة</button>
    <button class="lm-subnav-btn" data-lmtab="announce" id="lmAnnounceNavBtn" style="display:none">📢 الإعلانات</button>
    <button class="lm-subnav-btn" data-lmtab="tally" id="lmTallyNavBtn" style="display:none">📊 حصر الفعاليات</button>
  </div>

  <div class="panel" id="lmAnnouncePanel" data-lmtab="announce" style="display:none">
    <h3>إعلانات المسابقات (رئيسة المشروع)</h3>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <input type="text" id="lmAnnounceTitle" placeholder="اسم المسابقة" style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      <button class="btn gold" id="lmAnnounceCreateBtn" style="width:auto;padding:9px 20px">نشر إعلان</button>
    </div>
    <textarea id="lmAnnounceDesc" placeholder="تفاصيل/رابط المسابقة (اختياري)" rows="2" style="width:100%;margin-top:10px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;resize:vertical"></textarea>
    <div id="lmAnnouncementsList" style="margin-top:16px"></div>
  </div>

  <div class="panel" data-lmtab="open" style="display:none">
    <h3>مسابقات معلنة — سجّلي مشاركتك</h3>
    <div id="lmOpenCompetitions"></div>
  </div>
  <div class="panel" data-lmtab="add" style="display:none">
    <h3>إضافة تقرير فعالية / مسابقة</h3>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <select id="lmType" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)">
        <option value="internal">فعالية داخلية</option>
        <option value="external">فعالية/مسابقة خارجية</option>
      </select>
      <input type="text" id="lmTitle" placeholder="اسم الفعالية/البرنامج" style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      <input type="date" id="lmDate" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
    </div>

    <div id="lmInternalFields" class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:12px">
      <select id="lmTargetCat" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)">
        <option value="الطالبات">الطالبات</option><option value="المعلمات">المعلمات</option><option value="الطالبات والمعلمات">الطالبات والمعلمات</option>
      </select>
      <label style="display:flex;align-items:center;gap:5px;font-size:13px"><input type="checkbox" id="lmSlot1"> قبل الطابور</label>
      <label style="display:flex;align-items:center;gap:5px;font-size:13px"><input type="checkbox" id="lmSlot2"> الفسحة الأولى</label>
      <label style="display:flex;align-items:center;gap:5px;font-size:13px"><input type="checkbox" id="lmSlot3"> الفسحة الثانية</label>
      <label style="display:flex;align-items:center;gap:5px;font-size:13px"><input type="checkbox" id="lmSlot4"> بعد الدوام الرسمي</label>
    </div>

    <div id="lmExternalFields" class="row" style="display:none;gap:12px;flex-wrap:wrap;align-items:center;margin-top:12px">
      <input type="text" id="lmOrgBody" placeholder="الجهة المنظمة" style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      <input type="text" id="lmResult" placeholder="النتيجة/المركز (اتركيه فاضياً لحد الإعلان)" style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
    </div>

    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:12px">
      <div style="position:relative;flex:1;min-width:220px">
        <input type="text" id="lmTeacherSearch" placeholder="المعلمة المنفذة (افتراضياً أنتِ — ابحثي لتغييرها)" autocomplete="off" style="width:100%;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
        <div class="sugg" id="lmTeacherSugg"></div>
      </div>
    </div>
    <div style="margin-top:12px">
      <div class="sub">مشرفات إضافيات (اختياري)</div>
      <div style="position:relative"><input type="text" id="lmExtraSupSearch" placeholder="ابحثي عن معلمة لإضافتها كمشرفة إضافية…" autocomplete="off" style="width:100%;max-width:400px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit"></div>
      <div class="sugg" id="lmExtraSupSugg"></div>
      <div id="lmExtraSupList" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
    </div>

    <div style="margin-top:14px">
      <div class="sub">أسماء الطالبات المشاركات</div>
      <div class="search-row" style="position:relative"><input type="text" id="lmStudentSearch" placeholder="ابحثي عن اسم طالبة لإضافتها…"></div>
      <div class="sugg" id="lmStudentSugg"></div>
      <div id="lmPickedStudents" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
    </div>

    <div style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)">
      <div class="sub">إرفاق دليل (اختياري) — لو رفعتِ ملف يندرج تلقائياً في مستودع الأدلة</div>
      <div class="dropzone" id="lmEvDrop"><b id="lmEvFileLabel">اختاري ملف (صورة/شهادة/مستند)</b><p>اضغطي لاختيار الملف أو اسحبيه هنا</p><input type="file" id="lmEvFile" hidden></div>
      <select id="lmEvProjectPick" style="margin-top:8px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);display:none">
      </select>
    </div>

    <button class="btn gold" id="lmSaveBtn" style="width:auto;padding:10px 24px;margin-top:14px">حفظ الفعالية</button>
  </div>

  <div class="panel" data-lmtab="mine" style="display:none">
    <h3>متابعة الفعاليات</h3>
    <div class="sub">الفعاليات اللي أضفتِها أو أنتِ معلمتها المنفذة/مشرفة إضافية عليها.</div>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <select id="lmMyType"><option value="internal">داخلية</option><option value="external">خارجية</option></select>
    </div>
    <div id="lmMyList"></div>
  </div>

  <div class="panel" id="lmTallyPanel" data-lmtab="tally" style="display:none">
    <h3>حصر الفعاليات والمسابقات (شامل)</h3>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <select id="lmReportType"><option value="internal">داخلية</option><option value="external">خارجية</option></select>
      <select id="lmFilterMonth"><option value="">كل الأشهر</option>${Object.entries(MONTH_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
      <select id="lmFilterDept" style="display:none"><option value="">كل الأقسام</option></select>
      <button class="btn ghost" id="lmPrintBtn">🖨️ طباعة PDF</button>
      <button class="btn ghost" id="lmXlsBtn">⬇ تصدير Excel</button>
    </div>
    <div class="board-wrap"><table class="board" id="lmTable"></table></div>
  </div>
</div>
<div id="printAreaLM"></div>
<style>
  .lm-subnav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;border-bottom:2px solid var(--line);padding-bottom:10px}
  .lm-subnav-btn{background:var(--sand);border:1.5px solid var(--line);border-radius:9px;padding:9px 16px;font:inherit;font-size:13px;font-weight:600;color:var(--navy);cursor:pointer}
  .lm-subnav-btn.active{background:var(--gold);border-color:var(--gold);color:#fff}
</style>
<style>
  #leaveMark.wide{max-width:1500px}
  .lm-chip{display:flex;align-items:center;gap:6px;background:var(--sand);border-radius:99px;padding:5px 12px;font-size:12.5px}
  .lm-chip button{background:none;border:none;color:var(--err);cursor:pointer;font-size:12px}
  #printAreaLM{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0.22in; size:landscape}
    body *{visibility:hidden}
    #printAreaLM, #printAreaLM *{visibility:visible}
    #printAreaLM{display:block;position:absolute;inset-inline-start:0;top:0;width:100%}
    .lm-print-head{text-align:center;margin-bottom:10px}
    .lm-print-head img{height:0.7in;object-fit:contain}
    .lm-print-head h2{font-size:14px;color:#1d3d5c;margin:4px 0}
    .lm-print-meta{display:flex;justify-content:space-between;border:1px solid #333;padding:5px 10px;font-size:11px;font-weight:700;margin-bottom:8px}
    .lm-print-tbl{width:100%;border-collapse:collapse;font-size:9.5px}
    .lm-print-tbl th{background:#eef1f5;border:1px solid #999;padding:4px}
    .lm-print-tbl td{border:1px solid #999;padding:4px;text-align:center;vertical-align:middle}
    .lm-print-foot{display:flex;justify-content:space-around;margin-top:20px;font-size:10.5px;font-weight:700}
  }
</style>`);

let PICKED_STUDENTS=[], EXTRA_SUPS=[], LM_PROJECT_ID=null, IS_LM_LEAD=false, PICKED_TEACHER=null, EV_FILE=null;

function bindLmSubnav(){
  $('lmSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.addEventListener('click',()=>switchLmTab(b.dataset.lmtab)));
}
function switchLmTab(tab){
  document.querySelectorAll('#leaveMark [data-lmtab]').forEach(el=>{
    el.style.display = el.dataset.lmtab===tab ? 'block' : 'none';
  });
  $('lmSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.classList.toggle('active', b.dataset.lmtab===tab));
}

async function initLeaveMark(){
  if($('lmSaveBtn').dataset.ready) return;
  $('lmSaveBtn').dataset.ready='1';

  // مطابقة مرنة لاسم المشروع (تجنّباً لمشاكل الاسم المطابق تماماً)
  const {data:projects}=await db.from('plan_projects').select('id,name').eq('academic_year_id',S.YEAR.id);
  const lmProject=(projects||[]).find(p=>normName(p.name)===normName('اترك بصمة')) || (projects||[]).find(p=>normName(p.name).includes(normName('اترك بصمة')));
  LM_PROJECT_ID=lmProject?.id||null;
  if(!LM_PROJECT_ID) toast('تنبيه: ما لقيت مشروع "اترك بصمة" بالسنة الحالية — راجعي اسمه في تبويب المشاريع');

  if(LM_PROJECT_ID){
    const {data:leadRow}=await db.from('staff_project_leads').select('id').eq('staff_id',S.ME.id).eq('project_id',LM_PROJECT_ID).maybeSingle();
    IS_LM_LEAD=!!leadRow;
  }
  const canManageTally = S.FLAGS.isAdmin || S.FLAGS.isLead || S.FLAGS.isStrategicPlanLead || S.FLAGS.isSeniorTeacher || IS_LM_LEAD;
  if(canManageTally) $('lmTallyNavBtn').style.display='inline-block';

  bindLmSubnav();
  switchLmTab('add');

  PICKED_TEACHER={id:S.ME.id, full_name:S.ME.full_name};
  $('lmTeacherSearch').value=S.ME.full_name;

  $('lmType').addEventListener('change',()=>{
    const isInternal=$('lmType').value==='internal';
    $('lmInternalFields').style.display=isInternal?'flex':'none';
    $('lmExternalFields').style.display=isInternal?'none':'flex';
  });

  bindTeacherSearch($('lmTeacherSearch'),$('lmTeacherSugg'), s=>{ PICKED_TEACHER=s; });
  bindTeacherSearch($('lmExtraSupSearch'),$('lmExtraSupSugg'), s=>{
    if(!EXTRA_SUPS.some(e=>e.id===s.id)){ EXTRA_SUPS.push(s); renderExtraSups(); }
    $('lmExtraSupSearch').value='';
  });

  let deb=null;
  $('lmStudentSearch').addEventListener('input',()=>{
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const q=clean($('lmStudentSearch').value); const box=$('lmStudentSugg');
      if(q.length<2){ box.style.display='none'; return; }
      const {data:st}=await db.from('students').select('id,full_name,academic_number, enrollments(sections(code))').ilike('full_name',`%${q}%`).limit(8);
      const filtered=(st||[]).filter(s=>!PICKED_STUDENTS.some(p=>p.id===s.id));
      if(!filtered.length){ box.style.display='none'; return; }
      box.innerHTML=filtered.map((s,i)=>`<div data-i="${i}">${s.full_name} <small>${s.academic_number}</small></div>`).join('');
      box.style.display='block';
      box.querySelectorAll('div').forEach((el,i)=>el.addEventListener('click',()=>{
        PICKED_STUDENTS.push(filtered[i]); renderPickedStudents();
        $('lmStudentSearch').value=''; box.style.display='none';
      }));
    },250);
  });

  $('lmSaveBtn').addEventListener('click',saveEvent);
  $('lmMyType').addEventListener('change',loadMyEvents);
  if(LM_PROJECT_ID){
    const {data:allProjects}=await db.from('plan_projects').select('id,name').eq('academic_year_id',S.YEAR.id).order('sort_order');
    $('lmEvProjectPick').innerHTML=(allProjects||[]).map(p=>`<option value="${p.id}" ${p.id===LM_PROJECT_ID?'selected':''}>${p.name}</option>`).join('');
  }
  bindDrop($('lmEvDrop'),$('lmEvFile'), f=>{
    EV_FILE=f; $('lmEvFileLabel').textContent=f.name; $('lmEvProjectPick').style.display='block';
  });
  if(canManageTally){
    $('lmReportType').addEventListener('change',loadTally);
    $('lmFilterMonth').addEventListener('change',loadTally);
    $('lmPrintBtn').addEventListener('click',printTally);
    $('lmXlsBtn').addEventListener('click',exportTallyXls);
    if(S.FLAGS.isAdmin||S.FLAGS.isLead||S.FLAGS.isStrategicPlanLead||IS_LM_LEAD){
      const {data:depts}=await db.from('departments').select('id,name').order('name');
      $('lmFilterDept').innerHTML='<option value="">كل الأقسام</option>'+(depts||[]).map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
      $('lmFilterDept').style.display='inline-block';
      $('lmFilterDept').addEventListener('change',loadTally);
    }
    await loadTally();
  }

  if(IS_LM_LEAD){
    $('lmAnnounceNavBtn').style.display='inline-block';
    $('lmAnnounceCreateBtn').addEventListener('click',createAnnouncement);
    await loadAnnouncementsForLead();
  }
  $('lmAnnounceModalClose').addEventListener('click', async ()=>{
    $('lmAnnounceModal').style.display='none';
    if(PENDING_POPUP_ID) await db.from('announcement_dismissals').insert({announcement_id:PENDING_POPUP_ID, staff_id:S.ME.id});
  });
  $('lmAnnounceModalParticipate').addEventListener('click', ()=>{
    $('lmAnnounceModal').style.display='none';
    switchLmTab('add');
    $('lmType').value='external'; $('lmType').dispatchEvent(new Event('change'));
    $('lmTitle').value=PENDING_POPUP_TITLE||'';
    PENDING_ANNOUNCEMENT_ID=PENDING_POPUP_ID;
    setTimeout(()=>$('lmTitle').scrollIntoView({behavior:'smooth', block:'center'}),50);
    toast('عبّي بيانات مشاركتك بالأسفل واحفظي');
  });

  await loadOpenCompetitions();
  await checkPopup();
  await loadMyEvents();
}

let PENDING_POPUP_ID=null;
let PENDING_POPUP_TITLE=null;
async function checkPopup(){
  if(!LM_PROJECT_ID) return;
  const {data:anns}=await db.from('competition_announcements').select('id,title,description').eq('academic_year_id',S.YEAR.id).order('created_at',{ascending:false}).limit(5);
  if(!anns?.length) return;
  const {data:dismissed}=await db.from('announcement_dismissals').select('announcement_id').eq('staff_id',S.ME.id);
  const dismissedIds=new Set((dismissed||[]).map(d=>d.announcement_id));
  const {data:mine}=await db.from('event_records').select('announcement_id').eq('staff_id',S.ME.id).in('announcement_id',anns.map(a=>a.id));
  const participatedIds=new Set((mine||[]).map(m=>m.announcement_id));
  const unseen=anns.find(a=>!dismissedIds.has(a.id) && !participatedIds.has(a.id));
  if(!unseen) return;
  PENDING_POPUP_ID=unseen.id; PENDING_POPUP_TITLE=unseen.title;
  $('lmAnnounceModalBody').innerHTML=`<b>${unseen.title}</b>${unseen.description?`<p style="color:#8a93a0;font-size:13px">${unseen.description}</p>`:''}`;
  $('lmAnnounceModal').style.display='flex';
}

async function createAnnouncement(){
  const title=clean($('lmAnnounceTitle').value);
  if(!title){ toast('اكتبي اسم المسابقة'); return; }
  const description=clean($('lmAnnounceDesc').value)||null;
  const {error}=await db.from('competition_announcements').insert({academic_year_id:S.YEAR.id, project_id:LM_PROJECT_ID, title, description, created_by:S.ME.id});
  if(error){ toast('تعذر النشر: '+error.message); return; }
  toast('تم نشر الإعلان'); $('lmAnnounceTitle').value=''; $('lmAnnounceDesc').value='';
  loadAnnouncementsForLead(); loadOpenCompetitions();
}

async function loadAnnouncementsForLead(){
  const {data:anns}=await db.from('competition_announcements').select('id,title,description').eq('academic_year_id',S.YEAR.id).order('created_at',{ascending:false});
  if(!anns?.length){ $('lmAnnouncementsList').innerHTML='<div class="empty-day">لا إعلانات بعد.</div>'; return; }
  const {data:parts}=await db.from('event_records').select('id,title,announcement_id, staff:staff_id(full_name), result').in('announcement_id',anns.map(a=>a.id));
  $('lmAnnouncementsList').innerHTML=anns.map(a=>{
    const mine=(parts||[]).filter(p=>p.announcement_id===a.id);
    return `<div class="cm-row" style="cursor:default;display:block">
      <b>${a.title}</b> <small style="color:#8a93a0">(${mine.length} مشاركة)</small>
      ${mine.length?`<div style="margin-top:8px">${mine.map(p=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f2f0ea;font-size:12.5px">
        <span>${p.staff?.full_name||'—'}</span><span>${p.result||'بانتظار النتيجة'}</span></div>`).join('')}</div>`:''}
    </div>`;
  }).join('');
}

async function loadOpenCompetitions(){
  if(!LM_PROJECT_ID){ $('lmOpenCompetitions').innerHTML='<div class="empty-day">لا مسابقات معلنة بعد.</div>'; return; }
  const {data:anns}=await db.from('competition_announcements').select('id,title,description').eq('academic_year_id',S.YEAR.id).order('created_at',{ascending:false});
  if(!anns?.length){ $('lmOpenCompetitions').innerHTML='<div class="empty-day">لا مسابقات معلنة بعد.</div>'; return; }
  const {data:mine}=await db.from('event_records').select('id,announcement_id').eq('staff_id',S.ME.id).in('announcement_id',anns.map(a=>a.id));
  const participatedIds=new Set((mine||[]).map(m=>m.announcement_id));
  $('lmOpenCompetitions').innerHTML=anns.map(a=>`
    <div class="cm-row" style="cursor:default">
      <span><b>${a.title}</b>${a.description?` <small style="color:#8a93a0">${a.description}</small>`:''}</span>
      ${participatedIds.has(a.id)
        ? `<span class="cm-tag">✓ سجَّلتِ مشاركتك</span>`
        : `<button class="btn gold lm-participate-btn" data-id="${a.id}" data-title="${a.title.replace(/"/g,'&quot;')}" style="width:auto;padding:7px 16px;font-size:12.5px">سجّلي مشاركتك</button>`}
    </div>`).join('');
  $('lmOpenCompetitions').querySelectorAll('.lm-participate-btn').forEach(b=>b.addEventListener('click',()=>{
    $('lmType').value='external'; $('lmType').dispatchEvent(new Event('change'));
    $('lmTitle').value=b.dataset.title;
    PENDING_ANNOUNCEMENT_ID=b.dataset.id;
    $('lmTitle').scrollIntoView({behavior:'smooth', block:'center'});
    toast('عبّي بيانات مشاركتك بالأسفل واحفظي');
  }));
}
let PENDING_ANNOUNCEMENT_ID=null;

function bindTeacherSearch(input,box,onPick){
  let deb=null;
  input.addEventListener('input',()=>{
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const q=clean(input.value);
      if(q.length<2){ box.style.display='none'; return; }
      const {data:st}=await db.from('staff').select('id,full_name').ilike('full_name',`%${q}%`).limit(6);
      if(!(st||[]).length){ box.style.display='none'; return; }
      box.innerHTML=st.map((s,i)=>`<div data-i="${i}">${s.full_name}</div>`).join('');
      box.style.display='block';
      box.querySelectorAll('div').forEach((el,i)=>el.addEventListener('click',()=>{
        input.value=st[i].full_name; box.style.display='none'; onPick(st[i]);
      }));
    },250);
  });
}

function renderExtraSups(){
  $('lmExtraSupList').innerHTML=EXTRA_SUPS.map((s,i)=>`<span class="lm-chip">${s.full_name}<button data-i="${i}">✕</button></span>`).join('');
  $('lmExtraSupList').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ EXTRA_SUPS.splice(+b.dataset.i,1); renderExtraSups(); }));
}

function renderPickedStudents(){
  $('lmPickedStudents').innerHTML=PICKED_STUDENTS.map((s,i)=>`<span class="lm-chip">${s.full_name} (${s.enrollments?.[0]?.sections?.code||'—'})<button data-i="${i}">✕</button></span>`).join('');
  $('lmPickedStudents').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
    PICKED_STUDENTS.splice(+b.dataset.i,1); renderPickedStudents();
  }));
}

async function saveEvent(){
  const type=$('lmType').value;
  const title=clean($('lmTitle').value);
  const date=$('lmDate').value;
  if(!title){ toast('اكتبي اسم الفعالية'); return; }
  if(!date){ toast('حددي تاريخ التنفيذ'); return; }
  if(!PICKED_TEACHER){ toast('حددي المعلمة المنفذة'); return; }

  const {data:teacherRow}=await db.from('staff').select('department_id').eq('id',PICKED_TEACHER.id).maybeSingle();

  const payload={
    academic_year_id:S.YEAR.id, semester:getCurrentSemester(), month:MONTH_FROM_DATE(date),
    project_id:LM_PROJECT_ID, type, title, execution_date:date,
    department_id:teacherRow?.department_id||S.ME.department_id, staff_id:PICKED_TEACHER.id,
    extra_supervisors:EXTRA_SUPS.map(s=>s.full_name).join('، ')||null,
    announcement_id:PENDING_ANNOUNCEMENT_ID||null,
    created_by:S.ME.id
  };
  if(type==='internal'){
    payload.target_category=$('lmTargetCat').value;
    payload.slot_before_assembly=$('lmSlot1').checked;
    payload.slot_break1=$('lmSlot2').checked;
    payload.slot_break2=$('lmSlot3').checked;
    payload.slot_after_hours=$('lmSlot4').checked;
  }else{
    payload.organizing_body=clean($('lmOrgBody').value)||null;
    payload.result=clean($('lmResult').value)||null;
  }

  const btn=$('lmSaveBtn'); btn.disabled=true;
  try{
    const {data:ev,error}=await db.from('event_records').insert(payload).select('id').single();
    if(error) throw error;
    if(PICKED_STUDENTS.length){
      await db.from('event_participants').insert(PICKED_STUDENTS.map(s=>({event_id:ev.id, student_id:s.id})));
    }
    if(EV_FILE){
      try{
        const ext=(/\.([a-zA-Z0-9]+)$/.exec(EV_FILE.name)?.[1]||'dat').toLowerCase();
        const path=`evidence/${S.YEAR.id}/${Date.now()}.${ext}`;
        const {error:upErr}=await db.storage.from('school-files').upload(path,EV_FILE);
        if(upErr) throw upErr;
        const evProjectId=$('lmEvProjectPick').value||LM_PROJECT_ID;
        await db.from('evidence_files').insert({
          file_path:path, file_name:EV_FILE.name, title,
          academic_year_id:S.YEAR.id, semester:getCurrentSemester(),
          staff_id:PICKED_TEACHER.id, department_id:payload.department_id,
          project_id:evProjectId||null, uploaded_by:S.ME.id
        });
        toast('تم حفظ الفعالية وإدراجها كدليل');
      }catch(evErr){ toast('تم حفظ الفعالية، لكن تعذر رفع الدليل: '+(evErr.message||evErr)); }
    } else {
      toast('تم حفظ الفعالية');
    }
    $('lmTitle').value=''; $('lmDate').value=''; $('lmOrgBody').value=''; $('lmResult').value='';
    $('lmSlot1').checked=$('lmSlot2').checked=$('lmSlot3').checked=$('lmSlot4').checked=false;
    PICKED_STUDENTS=[]; renderPickedStudents(); EXTRA_SUPS=[]; renderExtraSups();
    EV_FILE=null; $('lmEvFileLabel').textContent='اختاري ملف (صورة/شهادة/مستند)'; $('lmEvProjectPick').style.display='none';
    PICKED_TEACHER={id:S.ME.id, full_name:S.ME.full_name}; $('lmTeacherSearch').value=S.ME.full_name;
    if(PENDING_ANNOUNCEMENT_ID){ PENDING_ANNOUNCEMENT_ID=null; loadOpenCompetitions(); if(IS_LM_LEAD) loadAnnouncementsForLead(); }
    loadMyEvents();
    if($('lmTallyNavBtn').style.display==='inline-block') loadTally();
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; }
}

async function fetchParticipantNames(eventIds){
  if(!eventIds.length) return {};
  const {data:parts}=await db.from('event_participants').select('event_id, students(full_name, enrollments(sections(code)))').in('event_id',eventIds);
  const map={};
  for(const p of parts||[]) (map[p.event_id] ??= []).push(`${p.students?.full_name||'—'} ${p.students?.enrollments?.[0]?.sections?.code||''}`);
  return map;
}

async function loadMyEvents(){
  const type=$('lmMyType').value;
  const {data:events,error}=await db.from('event_records').select('*').eq('academic_year_id',S.YEAR.id).eq('type',type)
    .or(`staff_id.eq.${S.ME.id},created_by.eq.${S.ME.id}`).order('execution_date',{ascending:false});
  if(error){ $('lmMyList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!events?.length){ $('lmMyList').innerHTML='<div class="empty-day">لا فعاليات بعد.</div>'; return; }
  const partsMap=await fetchParticipantNames(events.map(e=>e.id));
  $('lmMyList').innerHTML=events.map(e=>`
    <div class="cm-row" style="cursor:default;flex-wrap:wrap"><span><b>${e.title}</b> <small style="color:#8a93a0">${e.execution_date||''}</small><br>
    <small>${(partsMap[e.id]||[]).join('، ')||'لا طالبات مسجَّلات'}</small></span>
    ${type==='external'?`<span style="display:flex;align-items:center;gap:6px">
      <input type="text" class="lm-result-input" data-id="${e.id}" placeholder="النتيجة/المركز" value="${e.result||''}" style="padding:6px 10px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12.5px;width:140px">
      <button class="btn ghost lm-result-save" data-id="${e.id}" style="width:auto;padding:6px 12px;font-size:11px">حفظ</button>
    </span>`:''}
    </div>`).join('');
  $('lmMyList').querySelectorAll('.lm-result-save').forEach(b=>b.addEventListener('click', async ()=>{
    const inp=$('lmMyList').querySelector(`.lm-result-input[data-id="${b.dataset.id}"]`);
    const {error}=await db.from('event_records').update({result:clean(inp.value)||null}).eq('id',b.dataset.id);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    toast('تم حفظ النتيجة');
  }));
}

let TALLY_ROWS=[];
async function loadTally(){
  const type=$('lmReportType').value;
  const monthFilter=$('lmFilterMonth').value;
  const deptFilter=$('lmFilterDept')?.value;

  let query=db.from('event_records').select('*, staff:staff_id(full_name), departments(name)').eq('academic_year_id',S.YEAR.id).eq('type',type).order('execution_date');
  if(monthFilter) query=query.eq('month',monthFilter);
  if(deptFilter) query=query.eq('department_id',deptFilter);
  if(!(S.FLAGS.isAdmin||S.FLAGS.isLead||S.FLAGS.isStrategicPlanLead||IS_LM_LEAD) && S.FLAGS.isSeniorTeacher && S.ME.department_id){
    query=query.eq('department_id',S.ME.department_id);
  }

  const {data:events,error}=await query;
  if(error){ $('lmTable').innerHTML=`<tr><td style="padding:20px;text-align:center;color:#8a93a0">تعذر التحميل: ${error.message}</td></tr>`; return; }
  const partsMap=await fetchParticipantNames((events||[]).map(e=>e.id));
  TALLY_ROWS=(events||[]).map(e=>({...e, participantNames:partsMap[e.id]||[]}));
  renderTallyTable(type);
}

function renderTallyTable(type){
  if(!TALLY_ROWS.length){ $('lmTable').innerHTML='<tr><td style="padding:20px;text-align:center;color:#8a93a0">لا فعاليات ضمن هذا الفلتر</td></tr>'; return; }
  if(type==='internal'){
    $('lmTable').innerHTML='<tr><th>#</th><th>الفعالية</th><th>الفئة المستهدفة</th><th>التاريخ</th><th>عدد المشاركات</th><th>الطالبات/الصف</th><th>المعلمة المشرفة</th></tr>'+
      TALLY_ROWS.map((r,i)=>`<tr><td class="c">${i+1}</td><td>${r.title}</td><td class="c">${r.target_category||'—'}</td><td class="c">${r.execution_date||'—'}</td><td class="c">${r.participantNames.length}</td><td>${r.participantNames.join('، ')||'—'}</td><td class="c">${r.staff?.full_name||'—'}${r.extra_supervisors?', '+r.extra_supervisors:''}</td></tr>`).join('');
  }else{
    $('lmTable').innerHTML='<tr><th>#</th><th>البرنامج/الفعالية</th><th>الجهة المنظمة</th><th>عدد المشاركات</th><th>الطالبات/الصف</th><th>المعلمة المشرفة</th><th>النتيجة</th></tr>'+
      TALLY_ROWS.map((r,i)=>`<tr><td class="c">${i+1}</td><td>${r.title}</td><td class="c">${r.organizing_body||'—'}</td><td class="c">${r.participantNames.length}</td><td>${r.participantNames.join('، ')||'—'}</td><td class="c">${r.staff?.full_name||'—'}${r.extra_supervisors?', '+r.extra_supervisors:''}</td><td class="c">${r.result||'—'}</td></tr>`).join('');
  }
}

function tallyMeta(){
  const type=$('lmReportType').value;
  const monthFilter=$('lmFilterMonth').value;
  const deptFilter=$('lmFilterDept')?.value;
  const deptName = deptFilter ? $('lmFilterDept').selectedOptions[0].textContent : (TALLY_ROWS[0]?.departments?.name||'—');
  const semLabel = getCurrentSemester()===1?'الأول':'الثاني';
  const title = type==='internal'
    ? 'حصر الفعاليات والمسابقات الداخلية المنفذة من الأقسام الأكاديمية والإدارية'
    : 'حصر الفعاليات والمسابقات المشاركة بها خارج المدرسة';
  return {type, monthFilter, deptName, semLabel, title};
}

function printTally(){
  if(!TALLY_ROWS.length){ toast('لا بيانات للطباعة'); return; }
  const {type, monthFilter, deptName, semLabel, title}=tallyMeta();
  const yearLabel=S.YEAR?.name||'';
  const logo=getLogoUrl();

  let rowsHtml='';
  if(type==='internal'){
    rowsHtml=`<table class="lm-print-tbl"><tr><th>م</th><th>الفعالية</th><th>الفئة المستهدفة</th><th>قبل الطابور</th><th>الفسحة الأولى</th><th>الفسحة الثانية</th><th>بعد الدوام الرسمي</th><th>عدد المشاركات</th><th>أسماء الطالبات/الصف</th><th>اسم المعلمة المشرفة</th><th>النتيجة</th></tr>
      ${TALLY_ROWS.map((r,i)=>`<tr><td>${i+1}</td><td>${r.title}</td><td>${r.target_category||''}</td>
        <td>${r.slot_before_assembly?r.execution_date:''}</td><td>${r.slot_break1?r.execution_date:''}</td><td>${r.slot_break2?r.execution_date:''}</td><td>${r.slot_after_hours?r.execution_date:''}</td>
        <td>${r.participantNames.length||''}</td><td style="text-align:right">${r.participantNames.join('<br>')||''}</td><td>${r.staff?.full_name||''}</td><td></td></tr>`).join('')}
      </table>`;
  }else{
    rowsHtml=`<table class="lm-print-tbl"><tr><th>ت</th><th>اسم البرنامج/الفعالية</th><th>الجهة المنظمة</th><th>عدد المشاركات</th><th>أسماء الطالبات/الصف</th><th>المعلمة المشرفة</th><th>النتيجة</th></tr>
      ${TALLY_ROWS.map((r,i)=>`<tr><td>${i+1}</td><td>${r.title}</td><td>${r.organizing_body||''}</td><td>${r.participantNames.length||''}</td><td style="text-align:right">${r.participantNames.join('<br>')||''}</td><td>${r.staff?.full_name||''}</td><td>${r.result||''}</td></tr>`).join('')}
      </table>`;
  }

  $('printAreaLM').innerHTML=`
    <div class="lm-print-head">${logo?`<img src="${logo}">`:''}<h2>${title}</h2><h2>للفصل ${semLabel} من العام الدراسي ${yearLabel}م</h2></div>
    <div class="lm-print-meta"><span>شهر: ${monthFilter?MONTH_LABELS[monthFilter]:'الكل'}</span><span>القسم الأكاديمي: ${deptName}</span></div>
    ${rowsHtml}
    <div class="lm-print-foot">
      <span>توثيق: ${S.ME.full_name}</span>
      <span>منسّقة الأنشطة: ${S.SETTINGS.activities_coordinator_name||'—'}</span>
      <span>المديرة المساعدة: ${S.SETTINGS.deputy1_name||'—'}</span>
      <span>مديرة المدرسة: ${S.SETTINGS.principal_name||'—'}</span>
    </div>`;
  printWithTitle(type==='internal'?'حصر_الفعاليات_الداخلية':'حصر_الفعاليات_الخارجية','printAreaLM');
}

async function exportTallyXls(){
  if(!TALLY_ROWS.length){ toast('لا بيانات للتصدير'); return; }
  const {type, monthFilter, deptName, semLabel, title}=tallyMeta();
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('الحصر',{views:[{rightToLeft:true}]});
  const NAVY='FF1A3A6B', WHITE='FFFFFFFF';
  const cols = type==='internal'
    ? ['#','الفعالية','الفئة المستهدفة','التاريخ','عدد المشاركات','الطالبات/الصف','المعلمة المشرفة']
    : ['#','البرنامج/الفعالية','الجهة المنظمة','عدد المشاركات','الطالبات/الصف','المعلمة المشرفة','النتيجة'];
  const titleRow=ws.addRow([title]); ws.mergeCells(titleRow.number,1,titleRow.number,cols.length);
  titleRow.getCell(1).font={bold:true,size:13,color:{argb:WHITE}}; titleRow.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; titleRow.getCell(1).alignment={horizontal:'center'};
  const metaRow=ws.addRow([`الفصل ${semLabel} — شهر: ${monthFilter?MONTH_LABELS[monthFilter]:'الكل'} — القسم: ${deptName}`]);
  ws.mergeCells(metaRow.number,1,metaRow.number,cols.length); metaRow.getCell(1).alignment={horizontal:'center'};
  ws.addRow([]);
  const hdr=ws.addRow(cols);
  hdr.eachCell(c=>{ c.font={bold:true}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD0E8D8'}}; c.alignment={horizontal:'center'}; });
  TALLY_ROWS.forEach((r,i)=>{
    const row = type==='internal'
      ? [i+1, r.title, r.target_category||'', r.execution_date||'', r.participantNames.length, r.participantNames.join('، '), r.staff?.full_name||'']
      : [i+1, r.title, r.organizing_body||'', r.participantNames.length, r.participantNames.join('، '), r.staff?.full_name||'', r.result||''];
    ws.addRow(row).eachCell(c=>{ c.alignment={horizontal:'center',wrapText:true}; c.font={size:10}; });
  });
  ws.columns=cols.map(()=>({width:22}));
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`${type==='internal'?'حصر_الفعاليات_الداخلية':'حصر_الفعاليات_الخارجية'}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

// نفس الشاشة تظهر بمكانين مختلفين حسب الدور: الأدمن/رئيسة المشروع
// يشوفونها كتبويب "اترك بصمة" تحت "الخطة الاستراتيجية"، وباقي المعلمات
// يشوفونها كتبويب "فعاليات" مستقل — نفس الحاوية، نفس المحتوى بالضبط.
registerTab({id:'leaveMark', label:'اترك بصمة', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:f=>f.isLeaveMarkLead, init:initLeaveMark});
registerTab({id:'leaveMark', label:'إضافة تقرير - متابعة الفعاليات', group:'events', groupLabel:'فعاليات',
  show:f=>!f.isLeaveMarkLead, init:initLeaveMark});
