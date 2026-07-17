/* graduates.js — سجل المتخرجات (تحت "الإعدادات")
   قائمة بحث للطالبات المتخرجات — بياناتهن لا تُحذف أبداً (لا يوجد أي
   حذف تلقائي بالنظام)، فتبقى متاحة للرجوع إليها في أي وقت. */
import { db, $, clean, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="graduates" style="display:none">
  <div class="panel">
    <h3>سجل المتخرجات</h3>
    <div class="sub">بياناتهن محفوظة دائماً — لا يوجد حذف تلقائي لأي طالبة بالنظام، بغض النظر عن المدة.</div>
    <div class="search-row"><input type="text" id="grSearch" placeholder="ابحثي بالاسم أو الرقم الأكاديمي…"></div>
    <div id="grList" style="margin-top:14px"></div>
  </div>
</div>
<style>
  .gr-row{display:flex;justify-content:space-between;align-items:center;background:var(--white);border:1px solid var(--line);border-radius:11px;padding:12px 16px;margin-bottom:8px}
  .gr-badge{font-size:11px;padding:3px 10px;border-radius:99px;background:#eef1f5;color:var(--navy);font-weight:700}
</style>`);

async function initGraduates(){
  if($('grSearch').dataset.ready) return;
  $('grSearch').dataset.ready='1';
  let deb=null;
  $('grSearch').addEventListener('input',()=>{ clearTimeout(deb); deb=setTimeout(load,300); });
  load();
}

async function load(){
  const q=clean($('grSearch').value);
  let query=db.from('students').select('id,full_name,academic_number, enrollments(sections(code,academic_years(name)))').eq('status','graduated').order('full_name');
  if(q) query=query.or(`full_name.ilike.%${q}%,academic_number.ilike.%${q}%`);
  const {data,error}=await query.limit(200);
  if(error){ $('grList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!data?.length){ $('grList').innerHTML='<div class="empty-day">لا نتائج.</div>'; return; }
  $('grList').innerHTML=data.map(s=>{
    const last=(s.enrollments||[])[s.enrollments.length-1];
    const lastSec=last?.sections?.code, lastYear=last?.sections?.academic_years?.name;
    return `<div class="gr-row"><span>${s.full_name} <small style="color:#8a93a0">${s.academic_number}${lastSec?` — آخر شعبة: ${lastSec}${lastYear?` (${lastYear})`:''}`:''}</small></span>
      <span class="gr-badge">متخرجة</span></div>`;
  }).join('');
}

registerTab({id:'graduates', label:'سجل المتخرجات', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin||f.isReg, init:initGraduates});
