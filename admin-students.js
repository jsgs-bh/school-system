/* admin-students.js — طالبات المدرسة (تحت مجموعة "الإعدادات" ← فئة "الطالبات")
   للأدمن: اختيار شعبة لعرض طالباتها، تعديل بيانات التواصل، ونقل طالبة
   يدوياً لشعبة أخرى (بنفس مستواها فقط) — بديل للترحيل الجماعي التلقائي.
   + خدمة ثانية: "قوائم الصفوف" — طباعة كشف أسماء طالبات أي صف. */
import { db, $, S, clean, toast, printHeaderHtml, printWithTitle } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="adminStudents" style="display:none">
  <div class="lm-subnav" id="asSubnav">
    <button class="lm-subnav-btn" data-astab="list">طالبات المدرسة</button>
    <button class="lm-subnav-btn" data-astab="roster">قوائم الصفوف</button>
  </div>

  <div data-astab="list">
    <div class="panel">
      <h3>طالبات المدرسة</h3>
      <select id="asSectionPick" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:200px"><option value="">اختاري الصف/الشعبة…</option></select>
    </div>
    <div class="panel" id="asListPanel" style="display:none">
      <div id="asList"></div>
    </div>
  </div>

  <div data-astab="roster" style="display:none">
    <div class="panel">
      <h3>قوائم الصفوف</h3>
      <div class="sub">كشف بأسماء طالبات أي شعبة، جاهز للطباعة — بالتسلسل والرقم الأكاديمي وخلية ملاحظات فاضية.</div>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <select id="rosterSectionPick" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:200px"><option value="">اختاري الصف/الشعبة…</option></select>
        <button class="btn gold" id="rosterPrintBtn" style="width:auto;padding:10px 22px">🖨️ طباعة كشف الأسماء</button>
      </div>
    </div>
  </div>

  <div id="printAreaRoster" style="display:none"></div>
</div>
<style>
  #adminStudents.wide{max-width:1400px}
  .as-row{background:var(--white);border:1px solid var(--line);border-radius:11px;padding:12px 16px;margin-bottom:8px}
  .as-row-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
  .as-row-fields{display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);display:flex;gap:12px;flex-wrap:wrap;align-items:center}
  .as-row.open .as-row-fields{display:flex}
  .as-row-fields input, .as-row-fields select{padding:8px 10px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px}
  .lm-subnav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;border-bottom:2px solid var(--line);padding-bottom:10px}
  .lm-subnav-btn{background:var(--sand);border:1.5px solid var(--line);border-radius:9px;padding:9px 16px;font:inherit;font-size:13px;font-weight:600;color:var(--navy);cursor:pointer}
  .lm-subnav-btn.active{background:var(--gold);border-color:var(--gold);color:#fff}
  #printAreaRoster{display:none}
  .roster-print-tbl{width:100%;border-collapse:collapse;font-size:12pt;margin-top:8px}
  .roster-print-tbl th{background:#eef1f5;border:1px solid #333;padding:8px}
  .roster-print-tbl td{border:1px solid #333;padding:9px 8px;text-align:center}
  @media print{
    body *{visibility:hidden}
    #printAreaRoster, #printAreaRoster *{visibility:visible}
    #printAreaRoster{display:block!important;position:absolute;inset-inline-start:0;top:0;width:100%}
  }
</style>`);

let SECTIONS=[], CUR_STUDENTS=[];

function parseCode(code){
  const m=/^(\d)(\D+)(\d+)$/.exec(code||'');
  if(!m) return null;
  return {digit:+m[1], track:m[2], num:m[3], level:Math.ceil(+m[1]/2)};
}

function switchAsTab(tab){
  document.querySelectorAll('#adminStudents [data-astab]').forEach(el=>{
    if(el.id==='asSubnav') return;
    el.style.display = el.dataset.astab===tab ? 'block' : 'none';
  });
  $('asSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.classList.toggle('active', b.dataset.astab===tab));
}

async function initAdminStudents(){
  if($('asSectionPick').dataset.ready) return;
  $('asSectionPick').dataset.ready='1';
  $('asSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.addEventListener('click',()=>switchAsTab(b.dataset.astab)));
  switchAsTab('list');
  const {data:secs}=await db.from('sections').select('id,code').eq('academic_year_id',S.YEAR.id).order('code');
  SECTIONS=secs||[];
  $('asSectionPick').innerHTML='<option value="">اختاري الصف/الشعبة…</option>'+SECTIONS.map(s=>`<option value="${s.id}">${s.code}</option>`).join('');
  $('asSectionPick').addEventListener('change',loadStudents);
  $('rosterSectionPick').innerHTML='<option value="">اختاري الصف/الشعبة…</option>'+SECTIONS.map(s=>`<option value="${s.id}">${s.code}</option>`).join('');
  $('rosterPrintBtn').addEventListener('click',printRoster);
}

async function printRoster(){
  const sectionId=$('rosterSectionPick').value;
  if(!sectionId){ toast('اختاري الصف/الشعبة أولاً'); return; }
  const code=$('rosterSectionPick').selectedOptions[0].textContent;
  const {data,error}=await db.from('enrollments').select('students(full_name,academic_number)').eq('section_id',sectionId).is('to_date',null);
  if(error){ toast('تعذر التحميل: '+error.message); return; }
  const students=(data||[]).map(e=>e.students).filter(Boolean).sort((a,b)=>a.full_name.localeCompare(b.full_name,'ar'));
  if(!students.length){ toast('لا طالبات في هذي الشعبة'); return; }
  $('printAreaRoster').innerHTML=`
    ${printHeaderHtml(`كشف أسماء طالبات الصف ${code}`)}
    <table class="roster-print-tbl">
      <tr><th style="width:8%">التسلسل</th><th style="width:22%">الرقم الأكاديمي</th><th>اسم الطالبة</th><th style="width:26%">ملاحظات</th></tr>
      ${students.map((s,i)=>`<tr><td>${i+1}</td><td>${s.academic_number}</td><td style="text-align:right;padding-right:14px">${s.full_name}</td><td></td></tr>`).join('')}
    </table>`;
  printWithTitle(`كشف_أسماء_${code}`,'printAreaRoster');
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

/* لا registerTab هنا — هذي الشاشة صارت طفلاً ضمن تبويب "الطالبات"
   المُجمَّع (انظر settings-nav.js) بدل تبويب مستقل تحت "الإعدادات". */
export { initAdminStudents };
