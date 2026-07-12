/* grades-settings.js — إعدادات وحدة الدرجات (تحت مجموعة "الإعدادات" الموجودة):
   ١) درجة الاختبار الكلية لكل مقرر  ٢) فئات التصنيف وألوانها  ٣) عتبتا النجاح والإتقان
   هذه الأساس الذي تعتمد عليه شاشتا "رصد الدرجات" و"تحليل الاختبارات" القادمتان.
   الملف مكتفٍ بذاته: يضيف تبويبيه وتنسيقاته بنفسه. */
import { db, $, S, toast, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="settingsSubjects" style="display:none">
  <div class="panel">
    <h3>درجة الاختبار الكلية لكل مقرر</h3>
    <div class="sub">المقررات مستخلصة تلقائياً من الجدول الدراسي عند استيراده. الافتراضي ٢٥ لأي مقرر جديد — عدّلي ما يختلف فقط.</div>
    <div id="subjList"></div>
    <button class="btn gold" id="subjSave" style="width:auto;padding:11px 26px;margin-top:10px">حفظ الدرجات</button>
  </div>
  <div class="panel">
    <h3>عتبتا النجاح والإتقان</h3>
    <div class="sub">نسبة % من درجة الاختبار الكلية لكل مقرر — قاعدة واحدة موحدة تسري على كل المقررات.</div>
    <div style="display:flex;gap:20px;flex-wrap:wrap">
      <div class="field" style="max-width:160px"><label>النجاح (%)</label><input type="number" id="passPct" min="0" max="100" step="0.5"></div>
      <div class="field" style="max-width:160px"><label>الإتقان (%)</label><input type="number" id="masteryPct" min="0" max="100" step="0.5"></div>
    </div>
    <button class="btn gold" id="threshSave" style="width:auto;padding:11px 26px;margin-top:6px">حفظ العتبتين</button>
  </div>
</div>

<div class="app-main" id="settingsCategories" style="display:none">
  <div class="panel">
    <h3>فئات التصنيف</h3>
    <div class="sub">تُستخدم لتلوين درجات الطالبات تلقائياً في شاشة التحليل وملف الإكسل المصدَّر. الحدود بالنسبة المئوية من درجة الاختبار الكلية، ويجب ألا تتداخل.</div>
    <div id="catList"></div>
    <div class="actions" style="margin-top:12px">
      <button class="btn ghost" id="catAdd" style="width:auto;padding:10px 22px">＋ إضافة فئة</button>
      <button class="btn gold" id="catSave" style="width:auto;padding:10px 22px">حفظ الفئات</button>
    </div>
  </div>
</div>
<style>
  .subj-row{display:flex;align-items:center;gap:14px;background:var(--white);border:1px solid var(--line);border-radius:11px;padding:10px 14px;margin-bottom:8px}
  .subj-row b{flex:1}
  .subj-row input{width:90px;padding:8px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:#fbfaf7}
  .cat-row{display:flex;align-items:center;gap:10px;background:var(--white);border:1px solid var(--line);border-radius:11px;padding:10px 14px;margin-bottom:8px}
  .cat-row input[type=text]{flex:1;min-width:100px;padding:8px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:#fbfaf7}
  .cat-row input[type=number]{width:80px;padding:8px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:#fbfaf7}
  .cat-row input[type=color]{width:44px;height:38px;border:1.5px solid var(--line);border-radius:8px;padding:2px;cursor:pointer}
  .cat-row .del{background:none;border:none;color:var(--err);font-size:16px;cursor:pointer;padding:4px 8px}
  .cat-row .pct-lbl{font-size:12px;color:#8a93a0}
</style>`);

/* ============ درجة الاختبار لكل مقرر ============ */
async function initSubjects(){
  if($('subjList').dataset.ready) return;
  $('subjList').dataset.ready='1';
  await loadSubjects();
  await loadThresholds();
  $('subjSave').addEventListener('click',saveSubjects);
  $('threshSave').addEventListener('click',saveThresholds);
}
async function loadSubjects(){
  const {data:subs}=await db.from('subjects').select('id,code,exam_total').order('code');
  $('subjList').innerHTML=(subs||[]).map(s=>`
    <div class="subj-row" data-id="${s.id}">
      <b>${s.code}</b>
      <label style="font-size:12px;color:#8a93a0">درجة الاختبار</label>
      <input type="number" min="1" step="0.5" value="${s.exam_total}">
    </div>`).join('') || '<div class="empty-day">لا مقررات بعد — استوردي الجدول الدراسي أولاً.</div>';
}
async function saveSubjects(){
  const rows=[...$('subjList').querySelectorAll('.subj-row')];
  if(!rows.length) return;
  const btn=$('subjSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    for(const r of rows){
      const val=+r.querySelector('input').value;
      if(!val||val<=0) continue;
      const {error}=await db.from('subjects').update({exam_total:val}).eq('id',r.dataset.id);
      if(error) throw error;
    }
    toast('تم حفظ درجات الاختبار');
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ الدرجات'; }
}

/* ============ عتبتا النجاح والإتقان ============ */
async function loadThresholds(){
  const {data}=await db.from('grade_settings').select('*').eq('id',1).maybeSingle();
  $('passPct').value=data?.pass_pct ?? 50;
  $('masteryPct').value=data?.mastery_pct ?? 80;
}
async function saveThresholds(){
  const pass=+$('passPct').value, mastery=+$('masteryPct').value;
  if(!pass||!mastery||pass<=0||mastery<=0){ toast('أدخلي قيمتين صحيحتين'); return; }
  if(mastery<=pass){ toast('نسبة الإتقان يجب أن تكون أعلى من نسبة النجاح'); return; }
  const {error}=await db.from('grade_settings').upsert({id:1,pass_pct:pass,mastery_pct:mastery});
  if(error){ toast('تعذر الحفظ: '+error.message); return; }
  toast('تم حفظ العتبتين');
}

/* ============ فئات التصنيف ============ */
async function initCategories(){
  if($('catList').dataset.ready) return;
  $('catList').dataset.ready='1';
  await loadCategories();
  $('catAdd').addEventListener('click',()=>addCatRow());
  $('catSave').addEventListener('click',saveCategories);
}
async function loadCategories(){
  const {data:cats}=await db.from('grade_categories').select('*').order('sort_order');
  $('catList').innerHTML='';
  for(const c of cats||[]) addCatRow(c);
  if(!(cats||[]).length) addCatRow();
}
function addCatRow(c){
  const row=document.createElement('div');
  row.className='cat-row';
  if(c?.id) row.dataset.id=c.id;
  row.innerHTML=`
    <input type="color" value="${c?.color||'#5DADE2'}">
    <input type="text" placeholder="اسم الفئة" value="${c?.name||''}">
    <span class="pct-lbl">من</span><input type="number" min="0" max="100" step="0.5" value="${c?.min_pct??''}" placeholder="0">
    <span class="pct-lbl">إلى</span><input type="number" min="0" max="100" step="0.5" value="${c?.max_pct??''}" placeholder="100">
    <span class="pct-lbl">٪</span>
    <button class="del" title="حذف">✕</button>`;
  row.querySelector('.del').addEventListener('click', async ()=>{
    if(row.dataset.id){
      if(!confirm('حذف هذه الفئة؟')) return;
      await db.from('grade_categories').delete().eq('id',row.dataset.id);
    }
    row.remove();
  });
  $('catList').appendChild(row);
}
async function saveCategories(){
  const rows=[...$('catList').querySelectorAll('.cat-row')];
  const btn=$('catSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    let order=1;
    for(const row of rows){
      const inputs=row.querySelectorAll('input');
      const color=inputs[0].value, name=inputs[1].value.trim(), min=+inputs[2].value, max=+inputs[3].value;
      if(!name){ order++; continue; }
      if(max<min){ toast(`الفئة "${name}": الحد الأعلى أقل من الأدنى`); continue; }
      const payload={name,color,min_pct:min,max_pct:max,sort_order:order};
      if(row.dataset.id){
        const {error}=await db.from('grade_categories').update(payload).eq('id',row.dataset.id);
        if(error) throw error;
      }else{
        const {data,error}=await db.from('grade_categories').insert(payload).select('id').single();
        if(error) throw error;
        row.dataset.id=data.id;
      }
      order++;
    }
    toast('تم حفظ الفئات');
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ الفئات'; }
}

registerTab({id:'settingsSubjects', label:'المقررات والدرجات', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initSubjects});
registerTab({id:'settingsCategories', label:'فئات التصنيف', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initCategories});
