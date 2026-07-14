/* academic-years.js — السنوات الدراسية (تحت "الإعدادات")
   إنشاء سنوات دراسية وتفعيل واحدة منها بضغطة — بدل SQL يدوي. تبديل
   التفعيل لا يمسح أي بيانات إطلاقاً؛ كل الجداول (شعب، طالبات، درجات،
   غياب) تبقى محفوظة تماماً بغض النظر عن أي سنة نشطة حالياً — التفعيل
   مجرد إشارة تحدد أي سنة تعمل عليها الشاشات الآن. */
import { db, $, S, toast, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="academicYears" style="display:none">
  <div class="warnbox">تبديل السنة النشطة لا يحذف أي شيء — كل البيانات تراكمية وتبقى محفوظة دائماً لكل سنة على حدة.</div>

  <div class="panel">
    <h3>السنوات الحالية</h3>
    <div id="ayList"></div>
  </div>

  <div class="panel">
    <h3>إضافة سنة دراسية جديدة</h3>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap">
      <div class="field" style="max-width:160px"><label>الاسم</label><input type="text" id="ayName" placeholder="2027-2028"></div>
      <div class="field" style="max-width:170px"><label>بداية السنة</label><input type="date" id="ayStart"></div>
      <div class="field" style="max-width:170px"><label>نهاية الفصل الأول</label><input type="date" id="aySem1End"></div>
      <div class="field" style="max-width:170px"><label>بداية الفصل الثاني</label><input type="date" id="aySem2Start"></div>
      <div class="field" style="max-width:170px"><label>نهاية السنة</label><input type="date" id="ayEnd"></div>
    </div>
    <button class="btn gold" id="ayAdd" style="width:auto;padding:10px 24px;margin-top:10px">＋ إضافة السنة</button>
  </div>
</div>
<style>
  .ay-row{display:flex;justify-content:space-between;align-items:center;background:var(--white);border:1px solid var(--line);border-radius:11px;padding:12px 16px;margin-bottom:8px;flex-wrap:wrap;gap:10px}
  .ay-row.active{border-color:var(--gold);background:var(--gold-soft)}
  .ay-row small{color:#6b7683;display:block;margin-top:2px}
  .ay-badge{font-size:11px;padding:3px 10px;border-radius:99px;background:var(--ok-soft);color:var(--ok);font-weight:700}
</style>`);

async function initAY(){
  if($('ayAdd').dataset.ready) return;
  $('ayAdd').dataset.ready='1';
  $('ayAdd').addEventListener('click',addYear);
  loadYears();
}

async function loadYears(){
  const {data,error}=await db.from('academic_years').select('*').order('start_date',{ascending:false});
  if(error){ $('ayList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!data?.length){ $('ayList').innerHTML='<div class="empty-day">لا سنوات بعد.</div>'; return; }
  $('ayList').innerHTML=data.map(y=>`
    <div class="ay-row ${y.is_active?'active':''}">
      <span><b>${y.name}</b><small>${y.start_date} → ${y.end_date} (فصل أول حتى ${y.sem1_end||'—'}، فصل ثاني من ${y.sem2_start||'—'})</small></span>
      ${y.is_active ? '<span class="ay-badge">نشطة الآن</span>' : `<button class="btn gold" data-id="${y.id}" style="width:auto;padding:8px 18px">تفعيل</button>`}
    </div>`).join('');
  $('ayList').querySelectorAll('button[data-id]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('تفعيل هذي السنة؟ الشاشات كلها ستعمل عليها بدلاً من السنة الحالية (لا حذف لأي بيانات).')) return;
    await db.from('academic_years').update({is_active:false}).neq('id','00000000-0000-0000-0000-000000000000');
    const {error}=await db.from('academic_years').update({is_active:true}).eq('id',b.dataset.id);
    if(error){ toast('تعذر التفعيل: '+error.message); return; }
    toast('تم التفعيل — أعيدي تحميل الصفحة (Refresh) ليطبَّق في كل الشاشات');
    loadYears();
  }));
}

async function addYear(){
  const name=$('ayName').value.trim(), start=$('ayStart').value, sem1=$('aySem1End').value, sem2=$('aySem2Start').value, end=$('ayEnd').value;
  if(!name||!start||!end){ toast('عبّي الاسم وبداية ونهاية السنة على الأقل'); return; }
  const btn=$('ayAdd'); btn.disabled=true;
  try{
    const {error}=await db.from('academic_years').insert({name, start_date:start, sem1_end:sem1||null, sem2_start:sem2||null, end_date:end, is_active:false});
    if(error) throw error;
    toast('تمت الإضافة — فعّليها من القائمة أعلاه وقت ما تصير جاهزة');
    $('ayName').value=''; $('ayStart').value=''; $('aySem1End').value=''; $('aySem2Start').value=''; $('ayEnd').value='';
    loadYears();
  }catch(err){ toast('تعذرت الإضافة: '+(err.message||err)); }
  finally{ btn.disabled=false; }
}

registerTab({id:'academicYears', label:'السنوات الدراسية', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initAY});
