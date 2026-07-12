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
    <h3>أوقات الحصص</h3>
    <div class="sub">تُستخدم لتمييز «الحصة الآن» في شاشة المعلمة، ولا تمنع الرصد خارج وقتها (الرصد مفتوح دائماً).</div>
    <div id="setPeriods"></div>
    <button class="btn gold" id="setSavePeriods" style="width:auto;padding:11px 26px;margin-top:6px">حفظ الأوقات</button>
  </div>
</div>

<div class="app-main" id="settingsPerms" style="display:none">
  <div class="panel">
    <h3>منح الصلاحيات</h3>
    <div class="sub">ابحثي عن منتسبة لعرض صلاحياتها الحالية وإضافة أو سحب دور. الدور «مسؤولة متابعة الغياب» يفتح لأي شخص تبويب «متابعة الغياب» كاملاً بغض النظر عن قسمها.</div>
    <div class="search-row"><input type="text" id="permSearch" placeholder="اسم المنتسبة أو رقمها الشخصي…"></div>
    <div class="sugg" id="permSugg"></div>
    <div class="picked" id="permPicked">
      <b id="permName">—</b> <small id="permDept"></small>
      <div id="permRoles" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"></div>
      <div class="row" style="margin-top:12px">
        <select id="permAdd"></select>
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
let PATTERN_ID=null;
async function loadPeriods(){
  const {data:pat}=await db.from('timetable_patterns').select('id').eq('is_active',true).maybeSingle();
  PATTERN_ID=pat?.id||null;
  if(!PATTERN_ID){ $('setPeriods').innerHTML='<div class="empty-day">لا يوجد نمط جدول نشط.</div>'; return; }
  const {data:pp}=await db.from('pattern_periods').select('*').eq('pattern_id',PATTERN_ID).order('period_no');
  $('setPeriods').innerHTML=(pp||[]).map(p=>`
    <div class="period-row" data-p="${p.period_no}">
      <b>حصة ${p.period_no}</b>
      <input type="time" class="pf-start" value="${p.start_time?.slice(0,5)||''}">
      —
      <input type="time" class="pf-end" value="${p.end_time?.slice(0,5)||''}">
    </div>`).join('');
}
$('setSavePeriods').addEventListener('click', async ()=>{
  if(!PATTERN_ID){ toast('لا يوجد نمط جدول نشط'); return; }
  const btn=$('setSavePeriods'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    const rows=[...$('setPeriods').querySelectorAll('.period-row')].map(r=>({
      pattern_id:PATTERN_ID, period_no:+r.dataset.p,
      start_time:r.querySelector('.pf-start').value, end_time:r.querySelector('.pf-end').value,
    }));
    for(const r of rows){
      if(!r.start_time||!r.end_time) continue;
      const {error}=await db.from('pattern_periods').update({start_time:r.start_time, end_time:r.end_time})
        .eq('pattern_id',r.pattern_id).eq('period_no',r.period_no);
      if(error) throw error;
    }
    toast('تم حفظ أوقات الحصص — التغيير يظهر عند إعادة تحميل الصفحة');
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ الأوقات'; }
});

/* ============ الصلاحيات ============ */
let PERM_STAFF=null;
function initPerms(){
  if($('permSearch').dataset.ready) return;
  $('permSearch').dataset.ready='1';
  $('permAdd').innerHTML=Object.entries(roleNames).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
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
    const {error}=await db.from('staff_roles').insert({staff_id:PERM_STAFF.id, role});
    if(error){ toast(/duplicate|unique/i.test(error.message)?'الدور موجود مسبقاً لهذه المنتسبة':'تعذر الإضافة: '+error.message); return; }
    toast('تمت إضافة الدور'); refreshRoles();
  });
}
async function pickStaff(s){
  PERM_STAFF=s;
  $('permName').textContent=s.full_name; $('permDept').textContent=s.departments?.name||'';
  $('permPicked').style.display='block'; $('permSugg').style.display='none'; $('permSearch').value='';
  refreshRoles();
}
async function refreshRoles(){
  const {data:roles}=await db.from('staff_roles').select('id,role').eq('staff_id',PERM_STAFF.id);
  $('permRoles').innerHTML=(roles||[]).length
    ? roles.map(r=>`<span class="perm-badge">${roleNames[r.role]||r.role}<button data-id="${r.id}">✕</button></span>`).join('')
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
