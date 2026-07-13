/* special-cases.js — الحالات الخاصة (تحت مجموعة "الإعدادات")
   وسم الطالبة كـ"حالة خاصة" — يدوياً بالبحث، أو دفعة واحدة برفع ملف
   إكسل بأرقامهن الأكاديمية. تُستثنى تلقائياً من سلم الفئات الرقمي في كل
   كشوف الدرجات والتحليلات، وتظهر بلونها المخصص بدلاً من ذلك. */
import { db, $, S, clean, toast, bindDrop, readSheet, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="specialCases" style="display:none">
  <div class="panel">
    <h3>لون الحالات الخاصة</h3>
    <div class="sub">يظهر بدلاً من الفئة الرقمية في كل كشوف الدرجات والتحليلات لأي طالبة موسومة.</div>
    <div class="field" style="max-width:200px">
      <input type="color" id="scColor" style="width:70px;height:44px;padding:2px;cursor:pointer">
    </div>
    <button class="btn gold" id="scColorSave" style="width:auto;padding:10px 22px">حفظ اللون</button>
  </div>

  <div class="panel">
    <h3>وسم يدوي</h3>
    <div class="search-row"><input type="text" id="scSearch" placeholder="اسم الطالبة أو رقمها الأكاديمي…"></div>
    <div class="sugg" id="scSugg"></div>
    <div id="scResults" style="margin-top:12px"></div>
  </div>

  <div class="panel">
    <h3>رفع دفعة (إكسل)</h3>
    <div class="sub">ملف بعمود واحد فقط: الرقم الأكاديمي. أي رقم موجود بالنظام يُوسَم "حالة خاصة" تلقائياً.</div>
    <div class="dropzone" id="scDrop"><b>اضغطي لاختيار الملف أو أفلتيه هنا</b><p>xlsx / xls — عمود الرقم الأكاديمي فقط</p>
      <input type="file" id="scFile" accept=".xlsx,.xls" hidden></div>
    <div class="result" id="scUploadResult" style="display:none"></div>
  </div>

  <div class="panel">
    <h3>عدد الحالات الخاصة لكل شعبة</h3>
    <button class="btn ghost" id="scCountRefresh" style="width:auto;padding:9px 18px;margin-bottom:14px">↻ تحديث العدد</button>
    <div class="board-wrap"><table class="board" id="scCountTable"></table></div>
  </div>
</div>
<style>
  .sc-row{display:flex;justify-content:space-between;align-items:center;background:var(--white);border:1px solid var(--line);border-radius:11px;padding:12px 16px}
  .sc-row small{color:#6b7683;display:block;margin-top:2px}
</style>`);

async function initSC(){
  if($('scSearch').dataset.ready) return;
  $('scSearch').dataset.ready='1';
  $('scColor').value=S.SETTINGS.special_case_color||'#9CA3AF';
  $('scColorSave').addEventListener('click',saveColor);

  let deb=null;
  $('scSearch').addEventListener('input',()=>{
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const q=clean($('scSearch').value);
      const box=$('scSugg');
      if(q.length<2){ box.style.display='none'; return; }
      const {data:st}=await db.from('students').select('id,full_name,academic_number,special_case')
        .or(`full_name.ilike.%${q}%,academic_number.ilike.%${q}%`).limit(8);
      if(!(st||[]).length){ box.style.display='none'; return; }
      box.innerHTML=st.map((s,i)=>`<div data-i="${i}">${s.full_name}<small>${s.academic_number}${s.special_case?' — حالة خاصة حالياً':''}</small></div>`).join('');
      box.style.display='block';
      box.querySelectorAll('div').forEach((el,i)=>el.addEventListener('click',()=>showStudent(st[i])));
    },300);
  });

  bindDrop($('scDrop'),$('scFile'),handleUpload);
  $('scCountRefresh').addEventListener('click',loadCounts);
  loadCounts();
}

function showStudent(s){
  $('scSugg').style.display='none'; $('scSearch').value='';
  $('scResults').innerHTML=`
    <div class="sc-row">
      <span><b>${s.full_name}</b><small>${s.academic_number}</small></span>
      <button class="btn ${s.special_case?'ghost':'gold'}" id="scToggle" style="width:auto;padding:9px 20px">
        ${s.special_case?'إلغاء الوسم':'وسم كحالة خاصة'}
      </button>
    </div>`;
  $('scToggle').addEventListener('click', async ()=>{
    const {error}=await db.from('students').update({special_case:!s.special_case}).eq('id',s.id);
    if(error){ toast('تعذر الحفظ: '+error.message); return; }
    toast(s.special_case?'تم إلغاء الوسم':'تم الوسم كحالة خاصة');
    s.special_case=!s.special_case;
    showStudent(s);
    loadCounts();
  });
}

async function saveColor(){
  const color=$('scColor').value;
  const {error}=await db.from('app_settings').upsert({id:1, special_case_color:color, updated_at:new Date().toISOString()});
  if(error){ toast('تعذر الحفظ: '+error.message); return; }
  S.SETTINGS.special_case_color=color;
  toast('تم حفظ اللون');
}

async function handleUpload(file){
  const rows=await readSheet(file);
  if(!rows.length){ toast('الملف فارغ'); return; }
  const nums=rows.map(r=>String(r[0]??'').trim()).filter(v=>v && !/[أ-ي]/.test(v)); // تجاهل صف الترويسة النصي إن وجد
  if(!nums.length){ toast('لم أجد أي أرقام أكاديمية في الملف'); return; }
  $('scUploadResult').style.display='block'; $('scUploadResult').className='result';
  $('scUploadResult').textContent=`جارٍ الوسم — ${nums.length} رقماً…`;
  try{
    let matched=0;
    for(const num of nums){
      const {data,error}=await db.from('students').update({special_case:true}).eq('academic_number',num).select('id');
      if(!error && data?.length) matched++;
    }
    $('scUploadResult').className='result ok';
    $('scUploadResult').textContent=`✅ تم وسم ${matched} طالبة من أصل ${nums.length} رقماً في الملف${matched<nums.length?` (${nums.length-matched} رقماً غير موجود بالنظام)`:''}`;
    loadCounts();
  }catch(err){ $('scUploadResult').className='result err'; $('scUploadResult').textContent='تعذر: '+(err.message||err); }
}

async function loadCounts(){
  const tbl=$('scCountTable');
  tbl.innerHTML='<tr><td style="padding:20px;text-align:center;color:#8a93a0">جارٍ التحميل…</td></tr>';
  const {data:rows,error}=await db.from('enrollments')
    .select('sections(code), students!inner(special_case)').is('to_date',null).eq('students.special_case',true);
  if(error){ tbl.innerHTML=`<tr><td style="padding:20px;text-align:center;color:#8a93a0">تعذر التحميل: ${error.message}</td></tr>`; return; }
  const perSec={}; for(const r of rows||[]){ const c=r.sections?.code||'؟'; perSec[c]=(perSec[c]||0)+1; }
  const codes=Object.keys(perSec).sort((a,b)=>a.localeCompare(b,'ar'));
  if(!codes.length){ tbl.innerHTML='<tr><td style="padding:20px;text-align:center;color:#8a93a0">لا حالات خاصة موسومة حالياً</td></tr>'; return; }
  tbl.innerHTML='<tr><th>الشعبة</th><th>عدد الحالات الخاصة</th></tr>'+
    codes.map(c=>`<tr><td class="sec">${c}</td><td class="c">${perSec[c]}</td></tr>`).join('');
}

registerTab({id:'specialCases', label:'الحالات الخاصة', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initSC});
