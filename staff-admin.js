/* staff-admin.js — تحكّم كامل بالمنتسبات (إضافة/تعديل/تعطيل) للأدمن،
   منفصل عن شاشة "المعلمات" (منح الصلاحيات) الموجودة أصلاً. */
import { db, $, S, clean, toast, titleNames } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="staffAdmin" style="display:none">
  <div class="panel">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h3 style="margin:0">إدارة المنتسبات</h3>
      <button class="btn gold" id="saAddBtn" style="width:auto;padding:9px 22px">➕ إضافة منتسبة</button>
    </div>
    <div class="sub">إضافة/تعديل/تعطيل بيانات المنتسبات. ⚠️ الحذف هنا "تعطيل" وليس مسحاً نهائياً — يُخفي المنتسبة من القوائم النشطة دون المساس بسجلاتها التاريخية (حضور، درجات، مخالفات...).</div>

    <div class="row" style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0">
      <input type="text" id="saSearch" placeholder="ابحثي بالاسم أو الرقم الشخصي…" style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      <label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="saShowInactive"> عرض المعطَّلات أيضاً</label>
    </div>

    <div id="saForm" style="display:none;background:var(--sand);border-radius:12px;padding:18px;margin-bottom:16px">
      <h4 id="saFormTitle" style="margin-top:0">إضافة منتسبة</h4>
      <input type="hidden" id="saEditId">
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:200px"><label>الاسم الكامل</label><input type="text" id="saName"></div>
        <div class="field" style="flex:1;min-width:160px"><label>الرقم الشخصي</label><input type="text" id="saPersonal"></div>
      </div>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:200px"><label>البريد الإلكتروني</label><input type="text" id="saEmail" placeholder="الرقمالشخصي@moe.bh"></div>
        <div class="field" style="flex:1;min-width:160px"><label>القسم</label><select id="saDept"><option value="">بدون قسم</option></select></div>
      </div>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:160px"><label>المسمى</label>
          <select id="saTitle">
            <option value="staff">منتسبة</option>
            <option value="teacher">معلمة</option>
            <option value="senior_teacher">معلمة أولى</option>
            <option value="leadership">قيادة عليا</option>
          </select>
        </div>
        <div class="field" style="flex:1;min-width:160px"><label>مسمى مخصَّص للعرض (اختياري)</label><input type="text" id="saDisplayTitle" placeholder="مثلاً: منسّقة"></div>
      </div>
      <div class="viol-actions" style="margin-top:8px">
        <button class="btn gold" id="saSave" style="width:auto;padding:10px 24px">حفظ</button>
        <button class="btn ghost" id="saCancel" style="width:auto;padding:10px 20px">إلغاء</button>
      </div>
      <div class="sub" id="saAccountNote" style="margin-top:10px"></div>
    </div>

    <div id="saList"></div>
  </div>
</div>
<style>
  #staffAdmin .st-row{background:#fff;border:1px solid var(--line);border-radius:11px;padding:12px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
  #staffAdmin .st-row.inactive{opacity:.55}
  #staffAdmin .st-row b{color:var(--navy)}
  #staffAdmin .st-row small{color:#6b7683;display:block;margin-top:2px}
</style>`);

let DEPARTMENTS=[], ALL_STAFF=[];

async function initStaffAdmin(){
  if($('saAddBtn').dataset.ready) return;
  $('saAddBtn').dataset.ready='1';

  const {data:depts}=await db.from('departments').select('id,name').order('name');
  DEPARTMENTS=depts||[];
  $('saDept').innerHTML='<option value="">بدون قسم</option>'+DEPARTMENTS.map(d=>`<option value="${d.id}">${d.name}</option>`).join('');

  $('saAddBtn').addEventListener('click',()=>openForm(null));
  $('saCancel').addEventListener('click',closeForm);
  $('saSave').addEventListener('click',saveStaff);
  $('saSearch').addEventListener('input',renderList);
  $('saShowInactive').addEventListener('change',renderList);
  $('saName').addEventListener('input',()=>{
    // اقتراح الإيميل تلقائياً من الرقم الشخصي، ما يغيّره لو كتبته يدوياً
  });
  $('saPersonal').addEventListener('input',()=>{
    if(!$('saEditId').value && !$('saEmail').dataset.touched){
      const p=clean($('saPersonal').value);
      $('saEmail').value = p ? `${p}@moe.bh` : '';
    }
  });
  $('saEmail').addEventListener('input',()=>{ $('saEmail').dataset.touched='1'; });

  await loadStaff();
}

async function loadStaff(){
  const {data,error}=await db.from('staff').select('id,full_name,personal_number,email,department_id,title,display_title,is_active,departments(name)').order('full_name');
  if(error){ $('saList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  ALL_STAFF=data||[];
  renderList();
}

function renderList(){
  const q=clean($('saSearch').value);
  const showInactive=$('saShowInactive').checked;
  let rows=ALL_STAFF;
  if(!showInactive) rows=rows.filter(s=>s.is_active);
  if(q) rows=rows.filter(s=>s.full_name.includes(q)||String(s.personal_number).includes(q));
  $('saList').innerHTML = rows.length ? rows.map(s=>`
    <div class="st-row ${s.is_active?'':'inactive'}">
      <div>
        <b>${s.full_name}</b>${s.is_active?'':' <small style="color:var(--err);display:inline">— معطَّلة</small>'}
        <small>${s.personal_number} — ${s.departments?.name||'بدون قسم'} — ${s.display_title||titleNames[s.title]||''}</small>
      </div>
      <div class="viol-actions" style="margin:0">
        <button class="btn ghost" data-edit="${s.id}" style="width:auto;padding:7px 16px;font-size:12.5px">✎ تعديل</button>
        <button class="btn ghost" data-toggle="${s.id}" data-active="${s.is_active}" style="width:auto;padding:7px 16px;font-size:12.5px;border-color:${s.is_active?'var(--err)':'var(--gold)'};color:${s.is_active?'var(--err)':'var(--gold)'}">
          ${s.is_active?'🚫 تعطيل':'✔️ إعادة تفعيل'}
        </button>
      </div>
    </div>`).join('') : '<div class="empty-day">لا نتائج.</div>';

  $('saList').querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openForm(ALL_STAFF.find(s=>s.id===b.dataset.edit))));
  $('saList').querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click', async ()=>{
    const active=b.dataset.active==='true';
    const msg = active ? 'تعطيل هذه المنتسبة؟ ستختفي من القوائم النشطة دون المساس بسجلاتها.' : 'إعادة تفعيل هذه المنتسبة؟';
    if(!confirm(msg)) return;
    const {error}=await db.from('staff').update({is_active:!active}).eq('id',b.dataset.toggle);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    toast(active?'تم التعطيل':'تم التفعيل'); loadStaff();
  }));
}

function openForm(staff){
  $('saForm').style.display='block';
  $('saFormTitle').textContent = staff ? 'تعديل بيانات منتسبة' : 'إضافة منتسبة';
  $('saEditId').value = staff?.id||'';
  $('saName').value = staff?.full_name||'';
  $('saPersonal').value = staff?.personal_number||'';
  $('saEmail').value = staff?.email||'';
  $('saEmail').dataset.touched = staff ? '1' : '';
  $('saDept').value = staff?.department_id||'';
  $('saTitle').value = staff?.title||'staff';
  $('saDisplayTitle').value = staff?.display_title||'';
  $('saAccountNote').innerHTML = staff
    ? ''
    : '⚠️ إضافة السطر هنا لا يُنشئ حساب دخول تلقائياً (يحتاج صلاحية خاصة لا تتوفر من المتصفح مباشرة). بعد الحفظ، يُرجى إرسال اسمها لإنشاء حساب دخول لها فوراً (بنفس النمط: البريد الإلكتروني وكلمة السر = الرقم الشخصي).';
  window.scrollTo({top:$('saForm').getBoundingClientRect().top+window.scrollY-80, behavior:'smooth'});
}
function closeForm(){ $('saForm').style.display='none'; }

async function saveStaff(){
  const id=$('saEditId').value;
  const name=clean($('saName').value), pers=clean($('saPersonal').value);
  if(!name||!pers){ toast('اكتبي الاسم والرقم الشخصي على الأقل'); return; }
  const payload={
    full_name:name, personal_number:pers,
    email: clean($('saEmail').value)||null,
    department_id: $('saDept').value||null,
    title: $('saTitle').value,
    display_title: clean($('saDisplayTitle').value)||null,
  };
  const btn=$('saSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    const {error}= id
      ? await db.from('staff').update(payload).eq('id',id)
      : await db.from('staff').insert({...payload, is_active:true});
    if(error) throw error;
    toast(id?'تم حفظ التعديلات':'تمت إضافة المنتسبة');
    closeForm(); loadStaff();
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ'; }
}

export { initStaffAdmin };
