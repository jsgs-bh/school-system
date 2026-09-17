/* announcements.js — نظام الإعلانات/التنبيهات:
   الأدمن ينشئ إعلان (نص + رابط اختياري) ويحدد المستهدَفين (الجميع /
   قسم معيّن / أشخاص محددين / رئيسات المشاريع). كل مستهدَف تطلع له
   نافذة منبثقة أول مرة يدخل بعد إنشاء الإعلان، وبعدها يبقى بتبويب
   "الإعلانات" لين يغيّر حالته إلى "تم". */
import { db, $, S, clean, toast, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="annMain" style="display:none">
  <div class="panel" id="annAdminPanel" style="display:none">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h3 style="margin:0">إعلانات المدرسة</h3>
      <button class="btn gold" id="annAddBtn" style="width:auto;padding:9px 22px">➕ إعلان جديد</button>
    </div>
    <div id="annForm" style="display:none;background:var(--sand);border-radius:12px;padding:18px;margin-top:14px">
      <div class="field"><label>العنوان</label><input type="text" id="annTitle"></div>
      <div class="field"><label>النص</label><textarea id="annBody" rows="3" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:8px;font:inherit"></textarea></div>
      <div class="field"><label>رابط (اختياري — فورم أو أي رابط ثاني)</label><input type="text" id="annLink" placeholder="https://..."></div>
      <div class="field"><label>المستهدَفون</label>
        <select id="annTarget">
          <option value="all">الجميع</option>
          <option value="department">قسم محدد</option>
          <option value="staff">معلمات/أشخاص محددون</option>
          <option value="project_leads">رئيسات المشاريع</option>
        </select>
      </div>
      <div class="field" id="annDeptField" style="display:none"><label>القسم</label><select id="annDept"></select></div>
      <div class="field" id="annStaffField" style="display:none">
        <label>ابحثي واختاري (يمكنك إضافة أكثر من واحدة)</label>
        <input type="text" id="annStaffSearch" placeholder="اكتبي اسماً…" autocomplete="off">
        <div id="annStaffSugg"></div>
        <div id="annStaffChips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div>
      </div>
      <div class="viol-actions" style="margin-top:8px">
        <button class="btn gold" id="annSend" style="width:auto;padding:10px 24px">إرسال الإعلان</button>
        <button class="btn ghost" id="annCancel" style="width:auto;padding:10px 20px">إلغاء</button>
      </div>
    </div>
  </div>

  <div class="panel">
    <h3>الإعلانات</h3>
    <div id="annList"></div>
  </div>
</div>

<div id="annPopupOverlay" style="display:none;position:fixed;inset:0;background:rgba(20,30,45,.55);z-index:9000;align-items:center;justify-content:center">
  <div style="background:#fff;border-radius:16px;max-width:480px;width:92%;padding:26px 28px;box-shadow:0 20px 60px rgba(0,0,0,.3)">
    <h3 id="annPopTitle" style="margin-top:0;color:var(--navy)"></h3>
    <p id="annPopBody" style="white-space:pre-wrap;line-height:1.7"></p>
    <a id="annPopLink" href="#" target="_blank" style="display:none;color:var(--gold);font-weight:700"></a>
    <div style="margin-top:20px;text-align:left"><button class="btn gold" id="annPopClose" style="width:auto;padding:10px 26px">حسناً</button></div>
  </div>
</div>

<style>
  .ann-row{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:10px}
  .ann-row.unread{border-inline-start:4px solid var(--gold)}
  .ann-row h4{margin:0 0 6px}
  .ann-row .sub{margin:0 0 8px}
  .ann-row a{color:var(--gold);font-weight:700}
  #annStaffSugg{background:#fff;border:1px solid var(--line);border-radius:8px;max-height:200px;overflow-y:auto;margin-top:4px}
  #annStaffSugg:empty{display:none}
  #annStaffSugg .opt{padding:8px 12px;cursor:pointer;font-size:13px}
  #annStaffSugg .opt:hover{background:var(--sand)}
  .ann-chip{background:var(--sand);border-radius:99px;padding:5px 12px;font-size:12.5px;display:flex;align-items:center;gap:6px}
  .ann-chip button{background:none;border:none;color:var(--err);cursor:pointer;font-size:13px}
</style>`);

let STAFF_PICK=[];

async function initAnnouncements(){
  if($('annList').dataset.ready) return;
  $('annList').dataset.ready='1';

  if(S.FLAGS.isAdmin){
    $('annAdminPanel').style.display='block';
    const {data:depts}=await db.from('departments').select('id,name').order('name');
    $('annDept').innerHTML=(depts||[]).map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
    $('annAddBtn').addEventListener('click',()=>{ $('annForm').style.display='block'; });
    $('annCancel').addEventListener('click',resetForm);
    $('annTarget').addEventListener('change',()=>{
      $('annDeptField').style.display = $('annTarget').value==='department' ? 'block':'none';
      $('annStaffField').style.display = $('annTarget').value==='staff' ? 'block':'none';
    });
    $('annSend').addEventListener('click',sendAnnouncement);
    let staffTimer=null;
    $('annStaffSearch').addEventListener('input',()=>{
      clearTimeout(staffTimer);
      const q=clean($('annStaffSearch').value);
      if(q.length<2){ $('annStaffSugg').innerHTML=''; return; }
      staffTimer=setTimeout(async ()=>{
        const {data}=await db.from('staff').select('id,full_name').eq('is_active',true).ilike('full_name',`%${q}%`).limit(8);
        $('annStaffSugg').innerHTML=(data||[]).filter(s=>!STAFF_PICK.some(p=>p.id===s.id)).map(s=>
          `<div class="opt" data-id="${s.id}" data-name="${s.full_name}">${s.full_name}</div>`).join('');
        $('annStaffSugg').querySelectorAll('.opt').forEach(el=>el.addEventListener('click',()=>{
          STAFF_PICK.push({id:el.dataset.id,name:el.dataset.name});
          renderChips(); $('annStaffSearch').value=''; $('annStaffSugg').innerHTML='';
        }));
      },250);
    });
  }

  await checkPopup();
  await loadList();
}

function renderChips(){
  $('annStaffChips').innerHTML=STAFF_PICK.map(p=>`<span class="ann-chip">${p.name}<button data-id="${p.id}">✕</button></span>`).join('');
  $('annStaffChips').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
    STAFF_PICK=STAFF_PICK.filter(p=>p.id!==b.dataset.id); renderChips();
  }));
}
function resetForm(){
  $('annForm').style.display='none';
  $('annTitle').value=''; $('annBody').value=''; $('annLink').value='';
  $('annTarget').value='all'; $('annDeptField').style.display='none'; $('annStaffField').style.display='none';
  STAFF_PICK=[]; renderChips();
}

async function sendAnnouncement(){
  const title=clean($('annTitle').value);
  if(!title){ toast('اكتبي عنواناً على الأقل'); return; }
  const body=clean($('annBody').value)||null;
  const link=clean($('annLink').value)||null;
  const target=$('annTarget').value;
  const btn=$('annSend'); btn.disabled=true; btn.textContent='جارٍ الإرسال…';
  try{
    let staffIds=[];
    if(target==='all'){
      const {data}=await db.from('staff').select('id').eq('is_active',true);
      staffIds=(data||[]).map(s=>s.id);
    }else if(target==='department'){
      const deptId=$('annDept').value;
      const {data}=await db.from('staff').select('id').eq('is_active',true).eq('department_id',deptId);
      staffIds=(data||[]).map(s=>s.id);
    }else if(target==='staff'){
      staffIds=STAFF_PICK.map(p=>p.id);
    }else if(target==='project_leads'){
      const {data}=await db.from('staff_roles').select('staff_id').eq('role','project_lead');
      staffIds=[...new Set((data||[]).map(r=>r.staff_id))];
    }
    if(!staffIds.length){ toast('ما فيه مستهدَفون مطابقون'); btn.disabled=false; btn.textContent='إرسال الإعلان'; return; }

    const {data:ann,error}=await db.from('announcements').insert({
      title, body, link, target_type:target,
      target_department_id: target==='department' ? $('annDept').value : null,
      created_by:S.ME.id,
    }).select('id').single();
    if(error) throw error;
    const rows=staffIds.map(staff_id=>({announcement_id:ann.id, staff_id}));
    for(let i=0;i<rows.length;i+=400){
      const {error:e2}=await db.from('announcement_recipients').insert(rows.slice(i,i+400));
      if(e2) throw e2;
    }
    toast(`تم الإرسال — ${staffIds.length} مستهدَفة`);
    resetForm(); loadList();
  }catch(err){ toast('تعذر الإرسال: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='إرسال الإعلان'; }
}

let POPUP_QUEUE=[];
async function checkPopup(){
  const {data}=await db.from('announcement_recipients')
    .select('id,announcement_id,announcements(title,body,link)')
    .eq('staff_id',S.ME.id).is('popped_up_at',null);
  POPUP_QUEUE=data||[];
  showNextPopup();
}
function showNextPopup(){
  if(!POPUP_QUEUE.length){ $('annPopupOverlay').style.display='none'; return; }
  const item=POPUP_QUEUE[0];
  $('annPopTitle').textContent=item.announcements?.title||'إعلان جديد';
  $('annPopBody').textContent=item.announcements?.body||'';
  if(item.announcements?.link){
    $('annPopLink').style.display='inline'; $('annPopLink').href=item.announcements.link; $('annPopLink').textContent='فتح الرابط';
  }else{ $('annPopLink').style.display='none'; }
  $('annPopupOverlay').style.display='flex';
  $('annPopClose').onclick=async ()=>{
    await db.from('announcement_recipients').update({popped_up_at:new Date().toISOString()}).eq('id',item.id);
    POPUP_QUEUE.shift();
    const rec=ALL_ANN?.find(r=>r.id===item.id); if(rec) rec.popped_up_at=new Date().toISOString();
    renderList();
    showNextPopup();
  };
}

let ALL_ANN=[];
async function loadList(){
  const {data,error}=await db.from('announcement_recipients')
    .select('id,done_at,popped_up_at,announcements(title,body,link,created_at)')
    .eq('staff_id',S.ME.id);
  if(error){ $('annList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  ALL_ANN=(data||[]).sort((a,b)=>new Date(b.announcements?.created_at||0)-new Date(a.announcements?.created_at||0));
  renderList();
}
function renderList(){
  $('annList').innerHTML = ALL_ANN.length ? ALL_ANN.map(r=>`
    <div class="ann-row ${r.done_at?'':'unread'}">
      <h4>${r.announcements?.title||''}</h4>
      ${r.announcements?.body?`<div class="sub">${r.announcements.body}</div>`:''}
      ${r.announcements?.link?`<a href="${r.announcements.link}" target="_blank">فتح الرابط ↗</a>`:''}
      <div class="viol-actions" style="margin-top:10px">
        ${r.done_at ? '<span style="color:#3a7a3a;font-size:12.5px">✔️ تم</span>'
          : `<button class="btn gold" data-id="${r.id}" style="width:auto;padding:7px 18px;font-size:12.5px">تم</button>`}
      </div>
    </div>`).join('') : '<div class="empty-day">لا إعلانات حالياً.</div>';
  $('annList').querySelectorAll('button[data-id]').forEach(b=>b.addEventListener('click', async ()=>{
    const {error}=await db.from('announcement_recipients').update({done_at:new Date().toISOString()}).eq('id',b.dataset.id);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    const rec=ALL_ANN.find(r=>r.id===b.dataset.id); if(rec) rec.done_at=new Date().toISOString();
    renderList();
  }));
}

registerTab({id:'annMain', label:'الإعلانات', show:()=>true, init:initAnnouncements});
