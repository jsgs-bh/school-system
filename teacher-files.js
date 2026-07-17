/* teacher-files.js — تبويب "ملفات" (المعلمة والمعلمة الأولى)
   تحميل نسخة معبَّأة تلقائياً من القالب المعتمد (كشف الدرجات بأسماء
   طالبات مجموعتها، كشف الغياب بأسماء طالبات شعبتها)، قائمة الحالات
   الخاصة لكل شعبة، ومكتبة الملفات العامة التي يرفعها الأدمن. */
import { db, $, S, dstr, toast, registerTab } from './core.js';
import { collectRange } from './period.js';

const BUCKET='school-files';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="teacherFiles" style="display:none">
  <div class="panel">
    <h3>كشف الدرجات</h3>
    <div class="sub">نسخة من القالب المعتمد معبَّأة بأسماء وأرقام طالبات مجموعتك.</div>
    <div id="tfGradesList"></div>
  </div>
  <div class="panel">
    <h3>كشف الغياب</h3>
    <div class="sub">نسخة من القالب المعتمد معبَّأة بأسماء وأرقام طالبات شعبتك كاملة.</div>
    <div id="tfAttList"></div>
  </div>
  <div class="panel">
    <h3>الحالات الخاصة</h3>
    <div class="sub">قائمة بأسماء الطالبات الموسومات "حالة خاصة" في كل شعبة تدرّسينها.</div>
    <div id="tfSpecialList"></div>
  </div>
  <div class="panel">
    <h3>ملفات عامة</h3>
    <div class="sub">ملفات يرفعها الدعم الفني للجميع (نماذج، تعاميم، إلخ).</div>
    <div id="tfSharedList"></div>
  </div>
</div>
<style>
  .tf-row{display:flex;justify-content:space-between;align-items:center;background:var(--white);border:1px solid var(--line);border-radius:11px;padding:12px 16px;margin-bottom:8px}
  .tf-row b{color:var(--navy)}
</style>`);

async function initTF(){
  if($('tfGradesList').dataset.ready) return;
  $('tfGradesList').dataset.ready='1';
  await Promise.all([renderGradesList(), renderAttendanceList(), renderSpecialList(), renderSharedList()]);
}

async function renderGradesList(){
  const {data:groups}=await db.from('teaching_groups')
    .select('id,section_id,subject_id,sections(code),subjects(code)').eq('teacher_id',S.ME.id);
  if(!groups?.length){ $('tfGradesList').innerHTML='<div class="empty-day">لا مقررات مرتبطة باسمك بعد.</div>'; return; }
  $('tfGradesList').innerHTML=groups.map((g,i)=>`
    <div class="tf-row"><span><b>${g.sections?.code||'—'} — ${g.subjects?.code||'—'}</b></span>
      <button class="btn gold" data-i="${i}" style="width:auto;padding:9px 20px">⬇ تحميل</button></div>`).join('');
  $('tfGradesList').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click', async ()=>{
    const g=groups[i];
    const {data:members}=await db.from('teaching_group_members').select('students(full_name,academic_number)').eq('group_id',g.id);
    const students=(members||[]).map(m=>m.students).filter(Boolean);
    await downloadFilledTemplate('grades', students, `كشف_الدرجات_${g.sections?.code}_${g.subjects?.code}`, b, g.subject_id);
  }));
}

async function renderAttendanceList(){
  const {data:rows}=await db.from('entry_teachers')
    .select('timetable_entries!inner(section_id,academic_year_id,sections(code))')
    .eq('staff_id',S.ME.id).eq('timetable_entries.academic_year_id',S.YEAR.id);
  const seen=new Map();
  for(const r of rows||[]){ const e=r.timetable_entries; if(e?.section_id) seen.set(e.section_id, e.sections?.code||'—'); }
  const sections=[...seen.entries()].map(([id,code])=>({id,code})).sort((a,b)=>a.code.localeCompare(b.code,'ar'));
  if(!sections.length){ $('tfAttList').innerHTML='<div class="empty-day">لا شعب مرتبطة باسمك بعد.</div>'; return; }
  $('tfAttList').innerHTML=sections.map((s,i)=>`
    <div class="tf-row"><span><b>${s.code}</b></span>
      <span style="display:flex;gap:8px">
        <button class="btn ghost" data-cum="${i}" style="width:auto;padding:9px 16px;font-size:12px">⬇ كشف غياب تراكمي (حتى الآن)</button>
        <button class="btn gold" data-i="${i}" style="width:auto;padding:9px 20px">⬇ تحميل</button>
      </span></div>`).join('');
  $('tfAttList').querySelectorAll('button[data-cum]').forEach((b,i)=>b.addEventListener('click',()=>downloadCumulativeAbsence(sections[i],b)));
  $('tfAttList').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click', async ()=>{
    const s=sections[i];
    const {data:enr}=await db.from('enrollments').select('students(full_name,academic_number)').eq('section_id',s.id).is('to_date',null);
    const students=(enr||[]).map(e=>e.students).filter(Boolean);
    await downloadFilledTemplate('attendance', students, `كشف_الغياب_${s.code}`, b);
  }));
}

async function renderSpecialList(){
  const {data:rows}=await db.from('entry_teachers')
    .select('timetable_entries!inner(section_id,academic_year_id,sections(code))')
    .eq('staff_id',S.ME.id).eq('timetable_entries.academic_year_id',S.YEAR.id);
  const seen=new Map();
  for(const r of rows||[]){ const e=r.timetable_entries; if(e?.section_id) seen.set(e.section_id, e.sections?.code||'—'); }
  const sections=[...seen.entries()].map(([id,code])=>({id,code})).sort((a,b)=>a.code.localeCompare(b.code,'ar'));
  if(!sections.length){ $('tfSpecialList').innerHTML='<div class="empty-day">لا شعب مرتبطة باسمك بعد.</div>'; return; }
  $('tfSpecialList').innerHTML=sections.map((s,i)=>`
    <div class="tf-row"><span><b>${s.code}</b></span>
      <button class="btn ghost" data-i="${i}" style="width:auto;padding:9px 20px">⬇ قائمة الحالات الخاصة</button></div>`).join('');
  $('tfSpecialList').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click', async ()=>{
    const s=sections[i];
    const {data:enr}=await db.from('enrollments').select('students(full_name,academic_number,special_case)').eq('section_id',s.id).is('to_date',null);
    const students=(enr||[]).map(e=>e.students).filter(st=>st?.special_case);
    if(!students.length){ toast('لا حالات خاصة في هذي الشعبة'); return; }
    exportSpecialList(s.code, students);
  }));
}

async function renderSharedList(){
  const {data,error}=await db.from('shared_files').select('*').order('created_at',{ascending:false});
  if(error||!data?.length){ $('tfSharedList').innerHTML='<div class="empty-day">لا ملفات عامة بعد.</div>'; return; }
  $('tfSharedList').innerHTML=data.map(f=>{
    const {data:urlData}=db.storage.from(BUCKET).getPublicUrl(f.file_path);
    return `<div class="tf-row"><span><b>${f.title}</b> <small style="color:#8a93a0">${f.file_name}</small></span>
      <a class="btn ghost" href="${urlData.publicUrl}" target="_blank" style="width:auto;padding:9px 20px;text-decoration:none;display:inline-block">⬇ تحميل</a></div>`;
  }).join('');
}

/* ============ ملء القالب المعتمد ونزوله ============ */
async function downloadCumulativeAbsence(section, btn){
  if(!S.YEAR?.start_date){ toast('لا سنة دراسية نشطة بتواريخ محددة'); return; }
  btn.disabled=true; const old=btn.textContent; btn.textContent='جارٍ التحضير…';
  try{
    const {data:enr}=await db.from('enrollments').select('students(id,full_name,academic_number)').eq('section_id',section.id).is('to_date',null);
    const students=(enr||[]).map(e=>e.students).filter(Boolean);
    if(!students.length){ toast('لا طالبات في هذي الشعبة'); return; }
    const today=dstr(new Date());
    const range=await collectRange(S.YEAR.start_date, today);
    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet('كشف الغياب التراكمي',{views:[{rightToLeft:true}]});
    const NAVY='FF1D3D5C', WHITE='FFFFFFFF';
    const addTitle=(text,size,bold,fill,color)=>{
      const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,5);
      const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
      cell.alignment={horizontal:'center',vertical:'middle'}; if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
      row.height=size>=16?26:20;
    };
    addTitle(S.SETTINGS.school_name||'المدرسة',16,true,NAVY,WHITE);
    addTitle(`كشف الغياب التراكمي — الشعبة ${section.code} — حتى ${today}`,12,true,null,'FF22303C');
    ws.addRow([]);
    const hdr=ws.addRow(['#','الرقم الأكاديمي','اسم الطالبة','أيام الغياب','مجموع الغياب']);
    hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; });
    const sorted=[...students].sort((a,b)=>String(a.academic_number).localeCompare(String(b.academic_number),'en',{numeric:true}));
    sorted.forEach((s,i)=>{
      const dates=range.DAILY.filter(d=>d.bySid[s.id]).map(d=>d.date);
      const row=ws.addRow([i+1, s.academic_number, s.full_name, dates.join('، ')||'—', dates.length]);
      row.eachCell((c,colNo)=>{ c.alignment={horizontal:colNo===3||colNo===4?'right':'center'}; c.font={size:10.5}; if(colNo===2) c.numFmt='@';
        if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
    });
    ws.columns=[{width:6},{width:16},{width:26},{width:50},{width:12}];
    const buf=await wb.xlsx.writeBuffer();
    const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`كشف_غياب_تراكمي_${section.code}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  }catch(err){ toast('تعذر التحضير: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent=old; }
}

async function downloadFilledTemplate(kind, students, filename, btn, subjectId){
  if(!students.length){ toast('لا طالبات في هذي المجموعة/الشعبة'); return; }
  btn.disabled=true; const old=btn.textContent; btn.textContent='جارٍ التحضير…';
  try{
    let tmpl=null;
    if(subjectId){
      const {data}=await db.from('file_templates').select('*').eq('kind',kind).eq('subject_id',subjectId).maybeSingle();
      tmpl=data;
    }
    if(!tmpl){
      const {data}=await db.from('file_templates').select('*').eq('kind',kind).is('subject_id',null).maybeSingle();
      tmpl=data;
    }
    if(!tmpl){ toast('لا قالب معتمد بعد — اطلبي من الدعم الفني رفعه من الإعدادات'); return; }
    const {data:blob,error}=await db.storage.from(BUCKET).download(tmpl.file_path);
    if(error){ toast('تعذر تحميل القالب: '+error.message); return; }
    const buf=await blob.arrayBuffer();
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws=tmpl.sheet_name ? wb.getWorksheet(tmpl.sheet_name) : wb.worksheets[0];
    if(!ws){ toast('تعذر إيجاد الورقة المطلوبة داخل القالب — راجعي إعدادات القالب مع الدعم الفني'); return; }
    const sorted=[...students].sort((a,b)=>String(a.academic_number).localeCompare(String(b.academic_number),'en',{numeric:true}));
    let row=tmpl.start_row;
    for(const s of sorted){
      const acadCell=ws.getCell(`${tmpl.academic_col}${row}`);
      acadCell.value=s.academic_number; acadCell.numFmt='@';
      ws.getCell(`${tmpl.name_col}${row}`).value=s.full_name;
      row++;
    }
    const outBuf=await wb.xlsx.writeBuffer();
    const outBlob=new Blob([outBuf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(outBlob);
    const a=document.createElement('a'); a.href=url; a.download=`${filename}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  }catch(err){ toast('تعذر التحضير: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent=old; }
}

/* ============ قائمة الحالات الخاصة (توليد مباشر بلا قالب) ============ */
async function exportSpecialList(sectionCode, students){
  const schoolName = S.SETTINGS.school_name || 'المدرسة';
  const sorted=students.sort((a,b)=>String(a.academic_number).localeCompare(String(b.academic_number),'en',{numeric:true}));
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('الحالات الخاصة',{views:[{rightToLeft:true}]});
  const row1=ws.addRow([schoolName]); ws.mergeCells(1,1,1,3);
  row1.getCell(1).font={bold:true,size:14}; row1.getCell(1).alignment={horizontal:'center'};
  const row2=ws.addRow([`الحالات الخاصة — الشعبة ${sectionCode}`]); ws.mergeCells(2,1,2,3);
  row2.getCell(1).font={bold:true,size:12}; row2.getCell(1).alignment={horizontal:'center'};
  ws.addRow([]);
  const hdr=ws.addRow(['#','الرقم الأكاديمي','اسم الطالبة']);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:'FFFFFFFF'}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1D3D5C'}}; c.alignment={horizontal:'center'}; });
  sorted.forEach((s,i)=>{ ws.addRow([i+1,s.academic_number,s.full_name]).eachCell((c,colNo)=>{ c.alignment={horizontal:colNo===3?'right':'center'}; if(colNo===2) c.numFmt='@'; }); });
  ws.columns=[{width:6},{width:16},{width:30}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`الحالات_الخاصة_${sectionCode}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

registerTab({id:'teacherFiles', label:'ملفات', group:'teacherArea', groupLabel:'حصصي',
  show:f=>f.isTeacher, init:initTF});
