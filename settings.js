/* settings.js — تبويب «الإعدادات» (للدعم الفني/الأدمن فقط):
   البيانات الأساسية (اسم المدرسة، أوقات الحصص) + الصلاحيات (منح/سحب الأدوار).
   الملف مكتفٍ بذاته: يضيف تبويباته وتنسيقاته بنفسه. */
import { db, $, S, clean, normDigits, toast, roleNames, applySettingsToDom, registerTab } from './core.js';

/* ============ حقن الواجهة ============ */
$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="settingsData" style="display:none">
  <div class="panel">
    <h3>اسم المدرسة</h3>
    <div class="sub">يظهر في شاشة الدخول، الترويسة، الاستمارات، والتقارير المصدَّرة.</div>
    <div class="field"><input id="setSchoolName" type="text" style="max-width:420px"></div>
    <button class="btn gold" id="setSaveName" style="width:auto;padding:11px 26px">حفظ الاسم</button>
  </div>
  <div class="panel">
    <h3>عدد الحصص وأوقاتها</h3>
    <div class="sub">اختاري العدد المعتمد للحصص اليومية (٥ / ٦ / ٧) ثم حدّدي وقت كل حصة — تُستخدم لتمييز «الحصة الآن» في شاشة المعلمة، ولا تمنع الرصد خارج وقتها (الرصد مفتوح دائماً).</div>
    <div class="field" style="max-width:160px">
      <label>عدد الحصص</label>
      <select id="setPeriodCount"><option value="5">٥</option><option value="6">٦</option><option value="7">٧</option></select>
    </div>
    <div id="setPeriods"></div>
    <button class="btn gold" id="setSavePeriods" style="width:auto;padding:11px 26px;margin-top:6px">حفظ</button>
  </div>
</div>

<div class="app-main" id="settingsPerms" style="display:none">
  <div class="panel">
    <h3>منح الصلاحيات</h3>
    <div class="sub">ابحثي عن منتسبة لعرض صلاحياتها الحالية وإضافة أو سحب دور. الدور «مسؤولة متابعة الغياب» يفتح لأي شخص تبويب «متابعة الغياب» كاملاً بغض النظر عن قسمها. لأدوار «رئيسة لجنة» و«مسؤولة مشروع» أضيفي اسم اللجنة/المشروع — حل مؤقت نصي إلى أن تُبنى وحدة اللجان والمشاريع نفسها.</div>
    <div class="search-row"><input type="text" id="permSearch" placeholder="اسم المنتسبة أو رقمها الشخصي…"></div>
    <div class="sugg" id="permSugg"></div>
    <div class="picked" id="permPicked">
      <b id="permName">—</b> <small id="permDept"></small>
      <div id="permRoles" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"></div>
      <div class="row" style="margin-top:12px">
        <select id="permAdd"></select>
        <input type="text" id="permScope" placeholder="اسم اللجنة أو المشروع…" style="display:none;flex:1;min-width:160px">
        <button class="btn gold" id="permAddBtn">إضافة الدور</button>
      </div>
    </div>
  </div>
</div>
<style>
  .perm-badge{display:inline-flex;align-items:center;gap:7px;background:var(--gold-soft);border:1px solid #ecd9ab;color:var(--warn);border-radius:99px;padding:6px 14px;font-size:12.5px}
  .perm-badge button{background:none;border:none;color:var(--err);cursor:pointer;font-size:14px;line-height:1}
  .period-row{display:flex;align-items:center;gap:12px;background:var(--white);border:1px solid var(--line);border-radius:11px;padding:10px 14px;margin-bottom:8px}
  .period-row b{width:70px;color:var(--navy)}
  .period-row input{padding:8px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:#fbfaf7}
</style>`);

/* ============ البيانات الأساسية ============ */
function initData(){
  const el=$('setSchoolName');
  if(!el.dataset.ready){
    el.dataset.ready='1';
    el.value = S.SETTINGS.school_name||'';
    $('setSaveName').addEventListener('click', async ()=>{
      const name=clean(el.value);
      if(!name){ toast('اكتبي اسم المدرسة'); return; }
      const {error}=await db.from('app_settings').upsert({id:1, school_name:name, updated_at:new Date().toISOString()});
      if(error){ toast('تعذر الحفظ: '+error.message); return; }
      S.SETTINGS.school_name=name; applySettingsToDom();
      toast('تم حفظ اسم المدرسة');
    });
  }
  loadPeriods();
}
let PATTERN_ID=null, PERIOD_VALUES={};
async function loadPeriods(){
  const {data:pat}=await db.from('timetable_patterns').select('id').eq('is_active',true).maybeSingle();
  PATTERN_ID=pat?.id||null;
  if(!PATTERN_ID){ $('setPeriods').innerHTML='<div class="empty-day">لا يوجد نمط جدول نشط.</div>'; return; }
  const {data:pp}=await db.from('pattern_periods').select('*').eq('pattern_id',PATTERN_ID).order('period_no');
  PERIOD_VALUES={};
  for(const p of pp||[]) PERIOD_VALUES[p.period_no]={start:p.start_time?.slice(0,5)||'', end:p.end_time?.slice(0,5)||''};
  const count=(pp||[]).length;
  $('setPeriodCount').value = [5,6,7].includes(count) ? count : 7;
  renderPeriodRows(+$('setPeriodCount').value);
  if(!$('setPeriodCount').dataset.ready){
    $('setPeriodCount').dataset.ready='1';
    $('setPeriodCount').addEventListener('change', ()=>{
      /* نحفظ قيم الصفوف المعروضة حالياً قبل إعادة الرسم بعدد مختلف */
      [...$('setPeriods').querySelectorAll('.period-row')].forEach(r=>{
        PERIOD_VALUES[+r.dataset.p]={start:r.querySelector('.pf-start').value, end:r.querySelector('.pf-end').value};
      });
      renderPeriodRows(+$('setPeriodCount').value);
    });
  }
}
function renderPeriodRows(count){
  $('setPeriods').innerHTML=Array.from({length:count},(_,i)=>i+1).map(n=>{
    const v=PERIOD_VALUES[n]||{start:'',end:''};
    return `<div class="period-row" data-p="${n}">
      <b>حصة ${n}</b>
      <input type="time" class="pf-start" value="${v.start}">
      —
      <input type="time" class="pf-end" value="${v.end}">
    </div>`;
  }).join('');
}
$('setSavePeriods').addEventListener('click', async ()=>{
  if(!PATTERN_ID){ toast('لا يوجد نمط جدول نشط'); return; }
  const desired=+$('setPeriodCount').value;
  const rows=[...$('setPeriods').querySelectorAll('.period-row')].map(r=>({
    period_no:+r.dataset.p, start_time:r.querySelector('.pf-start').value, end_time:r.querySelector('.pf-end').value,
  }));
  if(rows.some(r=>!r.start_time||!r.end_time)){ toast('حدّدي وقت كل حصة قبل الحفظ'); return; }
  const btn=$('setSavePeriods'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    for(const r of rows){
      const {data:upd, error:eU}=await db.from('pattern_periods')
        .update({start_time:r.start_time, end_time:r.end_time})
        .eq('pattern_id',PATTERN_ID).eq('period_no',r.period_no).select('period_no');
      if(eU) throw eU;
      if(!upd||!upd.length){
        const {error:eI}=await db.from('pattern_periods')
          .insert({pattern_id:PATTERN_ID, period_no:r.period_no, start_time:r.start_time, end_time:r.end_time});
        if(eI) throw eI;
      }
    }
    /* حذف أي حصص زائدة عن العدد المعتمد الآن (لو قلّل العدد) */
    const {error:eDel}=await db.from('pattern_periods').delete()
      .eq('pattern_id',PATTERN_ID).gt('period_no',desired);
    if(eDel) throw eDel;
    toast(`تم حفظ ${desired} حصص — التغيير يظهر عند إعادة تحميل الصفحة`);
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ'; }
});

/* ============ الصلاحيات ============ */
const SCOPE_ROLES = new Set(['committee_head','project_lead']);
let PERM_STAFF=null;
function initPerms(){
  if($('permSearch').dataset.ready) return;
  $('permSearch').dataset.ready='1';
  $('permAdd').innerHTML=Object.entries(roleNames).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
  toggleScope();
  $('permAdd').addEventListener('change',toggleScope);
  let deb=null;
  $('permSearch').addEventListener('input',()=>{
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const q=clean($('permSearch').value);
      const box=$('permSugg');
      if(q.length<2){ box.style.display='none'; return; }
      const {data:st}=await db.from('staff').select('id,full_name,personal_number,departments(name)')
        .or(`full_name.ilike.%${q}%,personal_number.ilike.%${q}%`).limit(8);
      if(!(st||[]).length){ box.style.display='none'; return; }
      box.innerHTML=(st||[]).map(s=>`<div data-id="${s.id}">${s.full_name}<small>${s.departments?.name||''}</small></div>`).join('');
      box.style.display='block';
      box.querySelectorAll('div').forEach((el,i)=>el.addEventListener('click',()=>pickStaff(st[i])));
    },300);
  });
  $('permAddBtn').addEventListener('click', async ()=>{
    if(!PERM_STAFF) return;
    const role=$('permAdd').value;
    const scope = SCOPE_ROLES.has(role) ? clean($('permScope').value) : null;
    if(SCOPE_ROLES.has(role) && !scope){ toast('اكتبي اسم اللجنة أو المشروع'); return; }
    const {error}=await db.from('staff_roles').insert({staff_id:PERM_STAFF.id, role, scope});
    if(error){ toast(/duplicate|unique/i.test(error.message)?'الدور موجود مسبقاً لهذه المنتسبة':'تعذر الإضافة: '+error.message); return; }
    $('permScope').value='';
    toast('تمت إضافة الدور'); refreshRoles();
  });
}
function toggleScope(){
  $('permScope').style.display = SCOPE_ROLES.has($('permAdd').value) ? 'block' : 'none';
}
async function pickStaff(s){
  PERM_STAFF=s;
  $('permName').textContent=s.full_name; $('permDept').textContent=s.departments?.name||'';
  $('permPicked').style.display='block'; $('permSugg').style.display='none'; $('permSearch').value='';
  refreshRoles();
}
async function refreshRoles(){
  const {data:roles}=await db.from('staff_roles').select('id,role,scope').eq('staff_id',PERM_STAFF.id);
  $('permRoles').innerHTML=(roles||[]).length
    ? roles.map(r=>`<span class="perm-badge">${roleNames[r.role]||r.role}${r.scope?' — '+r.scope:''}<button data-id="${r.id}">✕</button></span>`).join('')
    : '<span style="color:#8a93a0;font-size:13px">لا صلاحيات إضافية — منتسبة بمسمّاها الوظيفي فقط.</span>';
  $('permRoles').querySelectorAll('button').forEach(b=>b.addEventListener('click', async ()=>{
    await db.from('staff_roles').delete().eq('id',b.dataset.id);
    toast('تم سحب الدور'); refreshRoles();
  }));
}

registerTab({id:'settingsData', label:'البيانات الأساسية', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initData});
registerTab({id:'settingsPerms', label:'الصلاحيات', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initPerms});
