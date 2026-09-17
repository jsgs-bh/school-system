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
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <h3 style="margin:0">طالبات المدرسة</h3>
        <button class="btn gold" id="asAddBtn" style="width:auto;padding:9px 22px">➕ إضافة طالبة</button>
      </div>
      <select id="asSectionPick" style="margin-top:10px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:200px"><option value="">اختاري الصف/الشعبة…</option></select>
      <div id="asAddForm" style="display:none;background:var(--sand);border-radius:12px;padding:18px;margin-top:14px">
        <h4 style="margin-top:0">إضافة طالبة جديدة</h4>
        <div class="row" style="display:flex;gap:12px;flex-wrap:wrap">
          <div class="field" style="flex:1;min-width:200px"><label>اسم الطالبة</label><input type="text" id="asNewName"></div>
          <div class="field" style="flex:1;min-width:160px"><label>الرقم الشخصي</label><input type="text" id="asNewPersonal"></div>
        </div>
        <div class="row" style="display:flex;gap:12px;flex-wrap:wrap">
          <div class="field" style="flex:1;min-width:160px"><label>الرقم الأكاديمي</label><input type="text" id="asNewAcademic"></div>
          <div class="field" style="flex:1;min-width:160px"><label>الشعبة</label><select id="asNewSection"></select></div>
        </div>
        <div class="row" style="display:flex;gap:12px;flex-wrap:wrap">
          <div class="field" style="flex:1;min-width:200px"><label>البريد الإلكتروني (اختياري)</label><input type="text" id="asNewEmail"></div>
          <div class="field" style="flex:1;min-width:140px"><label>رقم تواصل ١ (اختياري)</label><input type="text" id="asNewC1"></div>
          <div class="field" style="flex:1;min-width:140px"><label>رقم تواصل ٢ (اختياري)</label><input type="text" id="asNewC2"></div>
        </div>
        <div class="viol-actions" style="margin-top:8px">
          <button class="btn gold" id="asNewSave" style="width:auto;padding:10px 24px">حفظ</button>
          <button class="btn ghost" id="asNewCancel" style="width:auto;padding:10px 20px">إلغاء</button>
        </div>
      </div>
    </div>
    <div class="panel" id="asListPanel" style="display:none">
      <div id="asList"></div>
    </div>
  </div>

  <div data-astab="roster" style="display:none">
    <div class="panel">
      <h3>قوائم الصفوف</h3>
      <div class="sub">كشف بأسماء طالبات أي شعبة، بالحقول اللي تختارينها — جاهز للطباعة أو تنزيل إكسل.</div>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <select id="rosterSectionPick" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:200px"><option value="">اختاري الصف/الشعبة…</option></select>
      </div>
      <div class="sub" style="margin-top:14px;margin-bottom:6px"><b>الحقول المطلوبة بالملف:</b></div>
      <div id="rosterFields" style="display:flex;gap:16px;flex-wrap:wrap">
        <label><input type="checkbox" class="rf" value="seq" checked> التسلسل</label>
        <label><input type="checkbox" class="rf" value="full_name" checked> اسم الطالبة</label>
        <label><input type="checkbox" class="rf" value="academic_number" checked> الرقم الأكاديمي</label>
        <label><input type="checkbox" class="rf" value="personal_number"> الرقم الشخصي</label>
        <label><input type="checkbox" class="rf" value="contact1"> رقم التواصل ١</label>
        <label><input type="checkbox" class="rf" value="contact2"> رقم التواصل ٢</label>
        <label><input type="checkbox" class="rf" value="email"> البريد الإلكتروني</label>
        <label><input type="checkbox" class="rf" value="notes"> خانة ملاحظات فاضية</label>
      </div>
      <div class="viol-actions" style="margin-top:14px">
        <button class="btn gold" id="rosterPrintBtn" style="width:auto;padding:10px 22px">🖨️ طباعة PDF</button>
        <button class="btn ghost" id="rosterXlsBtn" style="width:auto;padding:10px 22px">⬇ تنزيل إكسل</button>
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
  $('asNewSection').innerHTML='<option value="">اختاري الشعبة…</option>'+SECTIONS.map(s=>`<option value="${s.id}">${s.code}</option>`).join('');
  $('rosterPrintBtn').addEventListener('click',()=>exportRoster('print'));
  $('rosterXlsBtn').addEventListener('click',()=>exportRoster('xlsx'));
  $('asAddBtn').addEventListener('click',()=>{ $('asAddForm').style.display='block'; });
  $('asNewCancel').addEventListener('click',resetAddForm);
  $('asNewSave').addEventListener('click',saveNewStudent);
}

function resetAddForm(){
  $('asAddForm').style.display='none';
  $('asNewName').value=''; $('asNewPersonal').value=''; $('asNewAcademic').value='';
  $('asNewSection').value=''; $('asNewEmail').value=''; $('asNewC1').value=''; $('asNewC2').value='';
}

async function saveNewStudent(){
  const full_name=clean($('asNewName').value), personal_number=clean($('asNewPersonal').value);
  const academic_number=clean($('asNewAcademic').value), sectionId=$('asNewSection').value;
  if(!full_name||!personal_number||!academic_number||!sectionId){ toast('اكتبي الاسم والرقمين واختاري الشعبة على الأقل'); return; }
  const btn=$('asNewSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    const {data:stu,error}=await db.from('students').insert({
      full_name, personal_number, academic_number, status:'active',
      email: clean($('asNewEmail').value)||null,
      contact1: clean($('asNewC1').value)||null,
      contact2: clean($('asNewC2').value)||null,
    }).select('id').single();
    if(error) throw error;
    const {error:e2}=await db.from('enrollments').insert({student_id:stu.id, section_id:sectionId, from_date:new Date().toISOString().slice(0,10)});
    if(e2) throw e2;
    toast('تمت إضافة الطالبة');
    resetAddForm();
    if($('asSectionPick').value===sectionId) loadStudents();
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ'; }
}

const ROSTER_FIELD_LABEL={seq:'التسلسل', full_name:'اسم الطالبة', academic_number:'الرقم الأكاديمي',
  personal_number:'الرقم الشخصي', contact1:'رقم التواصل ١', contact2:'رقم التواصل ٢', email:'البريد الإلكتروني', notes:'ملاحظات'};

async function exportRoster(kind){
  const sectionId=$('rosterSectionPick').value;
  if(!sectionId){ toast('اختاري الصف/الشعبة أولاً'); return; }
  const code=$('rosterSectionPick').selectedOptions[0].textContent;
  const fields=[...document.querySelectorAll('#rosterFields .rf:checked')].map(c=>c.value);
  if(!fields.length){ toast('اختاري حقلاً واحداً على الأقل'); return; }
  const {data,error}=await db.from('enrollments').select('students(full_name,academic_number,personal_number,contact1,contact2,email)').eq('section_id',sectionId).is('to_date',null);
  if(error){ toast('تعذر التحميل: '+error.message); return; }
  const students=(data||[]).map(e=>e.students).filter(Boolean).sort((a,b)=>a.full_name.localeCompare(b.full_name,'ar'));
  if(!students.length){ toast('لا طالبات في هذي الشعبة'); return; }

  if(kind==='print'){
    const headers=fields.map(f=>ROSTER_FIELD_LABEL[f]).join('</th><th>');
    const rows=students.map((s,i)=>fields.map(f=>{
      if(f==='seq') return i+1;
      if(f==='notes') return '';
      return s[f]||'';
    }).join('</td><td>')).join('</tr><tr><td>');
    $('printAreaRoster').innerHTML=`
      ${printHeaderHtml(`كشف أسماء طالبات الصف ${code}`)}
      <table class="roster-print-tbl"><tr><th>${headers}</th></tr><tr><td>${rows}</td></tr></table>`;
    printWithTitle(`كشف_أسماء_${code}`,'printAreaRoster');
    return;
  }

  // إكسل
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(code,{views:[{rightToLeft:true}]});
  const hdr=ws.addRow(fields.map(f=>ROSTER_FIELD_LABEL[f]));
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:'FFFFFFFF'}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1D3D5C'}}; c.alignment={horizontal:'center'}; });
  students.forEach((s,i)=>{
    ws.addRow(fields.map(f=>{
      if(f==='seq') return i+1;
      if(f==='notes') return '';
      return s[f]||'';
    }));
  });
  ws.columns=fields.map(f=>({width: f==='full_name'?26:16}));
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`كشف_أسماء_${code}.xlsx`; a.click();
  URL.revokeObjectURL(url);
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
        <select class="as-leave" style="min-width:180px"><option value="">تركت المدرسة…</option><option value="transferred">انتقلت لمدرسة ثانية</option><option value="home_school">منازل</option></select>
        <button class="btn ghost as-leave-btn" style="width:auto;padding:8px 16px;font-size:12px;color:var(--err);border-color:var(--err)">تأكيد</button>
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
    row.querySelector('.as-leave-btn').addEventListener('click', async ()=>{
      const reason=row.querySelector('.as-leave').value;
      if(!reason){ toast('اختاري السبب أولاً'); return; }
      const label = reason==='home_school' ? 'منازل' : 'مدرسة ثانية';
      if(!confirm(`تأكيد: هذي الطالبة تركت المدرسة (${label})؟ يُقفل تسجيلها الحالي، وسجلها التاريخي (حضور، درجات، مخالفات...) يبقى محفوظاً كامل.`)) return;
      try{
        await db.from('enrollments').update({to_date:new Date().toISOString().slice(0,10)}).eq('id',enrollmentId);
        await db.from('students').update({status:reason}).eq('id',studentId);
        toast('تم تحديث حالة الطالبة');
        loadStudents();
      }catch(err){ toast('تعذر التحديث: '+(err.message||err)); }
    });
    row.querySelector('.as-transfer-btn').addEventListener('click', async ()=>{
      const targetId=row.querySelector('.as-transfer').value;
      if(!targetId){ toast('اختاري الشعبة الهدف أولاً'); return; }
      const targetCode=SECTIONS.find(s=>s.id===targetId)?.code||'';
      if(!confirm(`نقل هذي الطالبة إلى شعبة "${targetCode}"؟ درجاتها بالمقررات المشتركة (نفس اسم الاختبار) تنتقل معها تلقائياً — غيابها محفوظ أصلاً باسمها بغض النظر عن شعبتها.`)) return;
      try{
        await db.from('enrollments').update({to_date:new Date().toISOString().slice(0,10)}).eq('id',enrollmentId);
        await db.from('enrollments').insert({section_id:targetId, student_id:studentId, from_date:new Date().toISOString().slice(0,10)});

        // مجموعات التدريس القديمة (الشعبة القديمة) — نشيلها منها
        const {data:oldGroups}=await db.from('teaching_groups').select('id,subject_id').eq('section_id',sectionId);
        const oldGroupIds=(oldGroups||[]).map(g=>g.id);
        if(oldGroupIds.length){
          await db.from('teaching_group_members').delete().eq('student_id',studentId).in('group_id',oldGroupIds);
        }

        // مجموعات التدريس الجديدة (الشعبة الهدف) — لو موجودة (غير منقسمة) نضيفها لها،
        // ونستفيد من نفس القائمة لمعرفة أي مواد مشتركة بين الشعبتين لنقل الدرجات.
        const {data:newGroups}=await db.from('teaching_groups').select('id,subject_id,name').eq('section_id',targetId);
        const newGroupBySubject={};
        for(const g of newGroups||[]){
          if(g.name==='المجموعة الوحيدة') newGroupBySubject[g.subject_id]=g.id;
        }
        const undividedNewGroupIds=Object.values(newGroupBySubject);
        if(undividedNewGroupIds.length){
          const rows=undividedNewGroupIds.map(group_id=>({group_id, student_id}));
          await db.from('teaching_group_members').upsert(rows,{onConflict:'group_id,student_id',ignoreDuplicates:true});
        }

        // نقل الدرجات: لكل مادة مشتركة بين الشعبتين، ولكل اختبار بنفس
        // الاسم موجود بالشعبتين، ننسخ درجتها من اختبار الشعبة القديمة
        // لاختبار الشعبة الجديدة (لو ما عندها درجة هناك أصلاً).
        const oldSubjectIds=(oldGroups||[]).map(g=>g.subject_id);
        const sharedSubjectIds=oldSubjectIds.filter(id=>newGroupBySubject[id]);
        let movedGrades=0;
        if(sharedSubjectIds.length){
          const {data:oldExams}=await db.from('exams').select('id,name,subject_id').eq('section_id',sectionId).in('subject_id',sharedSubjectIds);
          const {data:newExams}=await db.from('exams').select('id,name,subject_id').eq('section_id',targetId).in('subject_id',sharedSubjectIds);
          for(const oe of oldExams||[]){
            const ne=(newExams||[]).find(e=>e.subject_id===oe.subject_id && e.name===oe.name);
            if(!ne) continue;
            const {data:oldScore}=await db.from('grade_records').select('score').eq('exam_id',oe.id).eq('student_id',studentId).maybeSingle();
            if(oldScore?.score==null) continue;
            const {data:already}=await db.from('grade_records').select('id').eq('exam_id',ne.id).eq('student_id',studentId).maybeSingle();
            if(already) continue; // عندها درجة بالشعبة الجديدة أصلاً — ما نلمسها
            await db.from('grade_records').insert({exam_id:ne.id, student_id:studentId, score:oldScore.score});
            movedGrades++;
          }
        }

        toast(`تم النقل بنجاح${movedGrades?` — انتقلت ${movedGrades} درجة معها`:''}`);
        loadStudents();
      }catch(err){ toast('تعذر النقل: '+(err.message||err)); }
    });
  });
}

/* لا registerTab هنا — هذي الشاشة صارت طفلاً ضمن تبويب "الطالبات"
   المُجمَّع (انظر settings-nav.js) بدل تبويب مستقل تحت "الإعدادات". */
export { initAdminStudents };
