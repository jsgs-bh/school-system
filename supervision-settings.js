/* supervision-settings.js — إشراف المعلمة الأولى (تحت مجموعة "الإعدادات")
   الافتراضي: كل معلمات قسم المعلمة الأولى. هذه الشاشة تدير الاستثناءات فقط —
   إضافة معلمة من قسم آخر، أو استبعاد معلمة من قسمها. */
import { db, $, clean, toast, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="settingsSupervision" style="display:none">
  <div class="panel">
    <h3>إشراف المعلمة الأولى</h3>
    <div class="sub">الافتراضي دائماً: كل معلمات قسم المعلمة الأولى نفسه. هنا تُضاف استثناءات فقط — معلمة إضافية من قسم آخر، أو معلمة تُستبعد من قسمها.</div>
    <div class="search-row"><input type="text" id="supSearch" placeholder="ابحثي عن المعلمة الأولى بالاسم…"></div>
    <div class="sugg" id="supSugg"></div>
    <div class="picked" id="supPicked">
      <b id="supName">—</b> <small id="supDept"></small>
      <div id="supDefaultList" style="margin-top:10px"></div>
      <h3 style="margin-top:18px;font-size:14px">استثناءات</h3>
      <div id="supOverrides" style="margin:10px 0"></div>
      <div class="row" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input type="text" id="supAddSearch" placeholder="ابحثي عن معلمة لإضافتها كاستثناء…" style="flex:1;min-width:180px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
        <select id="supAddMode" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white)">
          <option value="include">تضمين (من قسم آخر)</option>
          <option value="exclude">استبعاد (من نفس القسم)</option>
        </select>
      </div>
      <div class="sugg" id="supAddSugg"></div>
    </div>
  </div>
</div>
<style>
  .sup-row{display:flex;justify-content:space-between;align-items:center;background:var(--white);border:1px solid var(--line);border-radius:9px;padding:9px 14px;margin-bottom:6px;font-size:13px}
  .sup-row .tag{font-size:11px;padding:2px 9px;border-radius:99px}
  .sup-row .tag.include{background:var(--ok-soft);color:var(--ok)}
  .sup-row .tag.exclude{background:#fbe7e7;color:var(--err)}
  .sup-row button{background:none;border:none;color:var(--err);cursor:pointer;font-size:14px}
</style>`);

let SUP_SENIOR=null;

function initSupervision(){
  if($('supSearch').dataset.ready) return;
  $('supSearch').dataset.ready='1';
  let deb=null;
  $('supSearch').addEventListener('input',()=>{
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const q=clean($('supSearch').value);
      const box=$('supSugg');
      if(q.length<2){ box.style.display='none'; return; }
      const {data:st}=await db.from('staff').select('id,full_name,departments(id,name)').ilike('full_name',`%${q}%`).limit(8);
      if(!(st||[]).length){ box.style.display='none'; return; }
      box.innerHTML=st.map((s,i)=>`<div data-i="${i}">${s.full_name}<small>${s.departments?.name||''}</small></div>`).join('');
      box.style.display='block';
      box.querySelectorAll('div').forEach((el,i)=>el.addEventListener('click',()=>pickSenior(st[i])));
    },300);
  });
  let deb2=null;
  $('supAddSearch').addEventListener('input',()=>{
    clearTimeout(deb2);
    deb2=setTimeout(async ()=>{
      const q=clean($('supAddSearch').value);
      const box=$('supAddSugg');
      if(q.length<2){ box.style.display='none'; return; }
      const {data:st}=await db.from('staff').select('id,full_name,departments(name)').ilike('full_name',`%${q}%`).limit(8);
      if(!(st||[]).length){ box.style.display='none'; return; }
      box.innerHTML=st.map((s,i)=>`<div data-i="${i}">${s.full_name}<small>${s.departments?.name||''}</small></div>`).join('');
      box.style.display='block';
      box.querySelectorAll('div').forEach((el,i)=>el.addEventListener('click',()=>addOverride(st[i])));
    },300);
  });
}

async function pickSenior(s){
  SUP_SENIOR=s;
  $('supName').textContent=s.full_name; $('supDept').textContent='قسمها: '+(s.departments?.name||'—');
  $('supPicked').style.display='block'; $('supSugg').style.display='none'; $('supSearch').value='';
  await refreshLists();
}
async function refreshLists(){
  const deptId=SUP_SENIOR.departments?.id;
  const {data:deptTeachers}=deptId
    ? await db.from('staff').select('id,full_name').eq('department_id',deptId).neq('id',SUP_SENIOR.id)
    : {data:[]};
  $('supDefaultList').innerHTML = `<div class="sub" style="margin-bottom:6px">الافتراضي من القسم (${(deptTeachers||[]).length}):</div>` +
    ((deptTeachers||[]).map(t=>`<span class="perm-badge" style="margin:2px">${t.full_name}</span>`).join('') || '<span style="color:#8a93a0;font-size:13px">لا معلمات أخريات في القسم.</span>');

  const {data:links}=await db.from('supervision_links').select('id,teacher_staff_id,mode,staff:teacher_staff_id(full_name)').eq('senior_staff_id',SUP_SENIOR.id);
  $('supOverrides').innerHTML=(links||[]).length
    ? links.map(l=>`<div class="sup-row"><span>${l.staff?.full_name||'—'} <span class="tag ${l.mode}">${l.mode==='include'?'مُضافة':'مُستبعدة'}</span></span><button data-id="${l.id}">✕ إزالة</button></div>`).join('')
    : '<div style="color:#8a93a0;font-size:13px">لا استثناءات — الإشراف يتبع القسم بالكامل.</div>';
  $('supOverrides').querySelectorAll('button').forEach(b=>b.addEventListener('click', async ()=>{
    await db.from('supervision_links').delete().eq('id',b.dataset.id);
    toast('تمت إزالة الاستثناء'); refreshLists();
  }));
}
async function addOverride(teacher){
  if(!SUP_SENIOR) return;
  if(teacher.id===SUP_SENIOR.id){ toast('لا يمكن إضافة المعلمة الأولى نفسها'); return; }
  const mode=$('supAddMode').value;
  const {error}=await db.from('supervision_links').insert({senior_staff_id:SUP_SENIOR.id, teacher_staff_id:teacher.id, mode});
  if(error){ toast(/duplicate|unique/i.test(error.message)?'يوجد استثناء لهذه المعلمة مسبقاً — احذفيه أولاً لتغييره':'تعذر الإضافة: '+error.message); return; }
  $('supAddSearch').value=''; $('supAddSugg').style.display='none';
  toast('تمت الإضافة'); refreshLists();
}

registerTab({id:'settingsSupervision', label:'إشراف المعلمة الأولى', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initSupervision});
