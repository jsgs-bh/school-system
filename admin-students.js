/* admin-students.js — طالبات المدرسة (تحت مجموعة "الإعدادات")
   للأدمن: اختيار شعبة لعرض طالباتها، تعديل بيانات التواصل، ونقل طالبة
   يدوياً لشعبة أخرى (بنفس مستواها فقط) — بديل للترحيل الجماعي التلقائي. */
import { db, $, S, clean, toast, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="adminStudents" style="display:none">
  <div class="panel">
    <h3>طالبات المدرسة</h3>
    <select id="asSectionPick" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:200px"><option value="">اختاري الصف/الشعبة…</option></select>
  </div>
  <div class="panel" id="asListPanel" style="display:none">
    <div id="asList"></div>
  </div>
</div>
<style>
  #adminStudents.wide{max-width:1400px}
  .as-row{background:var(--white);border:1px solid var(--line);border-radius:11px;padding:12px 16px;margin-bottom:8px}
  .as-row-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
  .as-row-fields{display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);display:flex;gap:12px;flex-wrap:wrap;align-items:center}
  .as-row.open .as-row-fields{display:flex}
  .as-row-fields input, .as-row-fields select{padding:8px 10px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px}
</style>`);

let SECTIONS=[], CUR_STUDENTS=[];

function parseCode(code){
  const m=/^(\d)(\D+)(\d+)$/.exec(code||'');
  if(!m) return null;
  return {digit:+m[1], track:m[2], num:m[3], level:Math.ceil(+m[1]/2)};
}

async function initAdminStudents(){
  if($('asSectionPick').dataset.ready) return;
  $('asSectionPick').dataset.ready='1';
  const {data:secs}=await db.from('sections').select('id,code').eq('academic_year_id',S.YEAR.id).order('code');
  SECTIONS=secs||[];
  $('asSectionPick').innerHTML='<option value="">اختاري الصف/الشعبة…</option>'+SECTIONS.map(s=>`<option value="${s.id}">${s.code}</option>`).join('');
  $('asSectionPick').addEventListener('change',loadStudents);
}

async function loadStudents(){
  const sectionId=$('asSectionPick').value;
  if(!sectionId){ $('asListPanel').style.display='none'; return; }
  $('asListPanel').style.display='block';
  $('asList').innerHTML='<div class="empty-day">جارٍ التحميل…</div>';
  const {data,error}=await db.from('enrollments').select('id,students(id,full_name,academic_number,email,contact1,contact2)').eq('section_id',sectionId).is('to_date',null);
  if(error){ $('asList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  CUR_STUDENTS=(data||[]).map(e=>({enrollmentId:e.id, ...e.students})).filter(s=>s.id);
  if(!CUR_STUDENTS.length){ $('asList').innerHTML='<div class="empty-day">لا طالبات في هذي الشعبة.</div>'; return; }

  const curSection=SECTIONS.find(s=>s.id===sectionId);
  const curLevel=parseCode(curSection?.code)?.level;
  const sameLevelSections=SECTIONS.filter(s=>s.id!==sectionId && parseCode(s.code)?.level===curLevel);

  $('asList').innerHTML=CUR_STUDENTS.map(s=>`
    <div class="as-row" data-student="${s.id}" data-enrollment="${s.enrollmentId}">
      <div class="as-row-head">
        <span><b>${s.full_name}</b> <small style="color:#8a93a0">${s.academic_number}</small></span>
        <button class="btn ghost as-toggle" style="width:auto;padding:7px 16px;font-size:12px">✎ تعديل / نقل</button>
      </div>
      <div class="as-row-fields">
        <input type="text" class="as-email" placeholder="البريد الإلكتروني" value="${s.email||''}">
        <input type="text" class="as-c1" placeholder="تواصل ١" value="${s.contact1||''}">
        <input type="text" class="as-c2" placeholder="تواصل ٢" value="${s.contact2||''}">
        <button class="btn gold as-save" style="width:auto;padding:8px 16px;font-size:12px">حفظ البيانات</button>
        <select class="as-transfer" style="min-width:160px"><option value="">نقل إلى شعبة…</option>${sameLevelSections.map(sec=>`<option value="${sec.id}">${sec.code}</option>`).join('')}</select>
        <button class="btn ghost as-transfer-btn" style="width:auto;padding:8px 16px;font-size:12px;color:var(--err);border-color:var(--err)">نقل</button>
      </div>
    </div>`).join('');

  $('asList').querySelectorAll('.as-toggle').forEach(b=>b.addEventListener('click',()=>b.closest('.as-row').classList.toggle('open')));
  $('asList').querySelectorAll('.as-row').forEach(row=>{
    const studentId=row.dataset.student, enrollmentId=row.dataset.enrollment;
    row.querySelector('.as-save').addEventListener('click', async ()=>{
      const payload={
        email: clean(row.querySelector('.as-email').value)||null,
        contact1: clean(row.querySelector('.as-c1').value)||null,
        contact2: clean(row.querySelector('.as-c2').value)||null,
      };
      const {error}=await db.from('students').update(payload).eq('id',studentId);
      if(error){ toast('تعذر الحفظ: '+error.message); return; }
      toast('تم حفظ بيانات التواصل');
    });
    row.querySelector('.as-transfer-btn').addEventListener('click', async ()=>{
      const targetId=row.querySelector('.as-transfer').value;
      if(!targetId){ toast('اختاري الشعبة الهدف أولاً'); return; }
      const targetCode=SECTIONS.find(s=>s.id===targetId)?.code||'';
      if(!confirm(`نقل هذي الطالبة إلى شعبة "${targetCode}"؟`)) return;
      try{
        await db.from('enrollments').update({to_date:new Date().toISOString().slice(0,10)}).eq('id',enrollmentId);
        await db.from('enrollments').insert({section_id:targetId, student_id:studentId, from_date:new Date().toISOString().slice(0,10)});
        // تنظيف عضوية مجموعات التدريس القديمة — نفس الدرس من مشكلة الترحيل السابقة
        const {data:oldGroups}=await db.from('teaching_groups').select('id').eq('section_id',sectionId);
        const oldGroupIds=(oldGroups||[]).map(g=>g.id);
        if(oldGroupIds.length){
          await db.from('teaching_group_members').delete().eq('student_id',studentId).in('group_id',oldGroupIds);
        }
        toast('تم النقل بنجاح');
        loadStudents();
      }catch(err){ toast('تعذر النقل: '+(err.message||err)); }
    });
  });
}

registerTab({id:'adminStudents', label:'طالبات المدرسة', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initAdminStudents});
