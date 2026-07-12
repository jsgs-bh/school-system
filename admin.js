/* admin.js — شاشة الأدمن: الإحصاءات واستيراد الطالبات والمنتسبات والجدول */
import { db, $, S, normDigits, clean, normName, chunk, toast, bindDrop, readSheet, mkProg, showWarns, registerTab } from './core.js';

async function refreshStats(){
  $('stYear').textContent = S.YEAR?S.YEAR.name:'—';
  const count = async q => (await q).count ?? 0;
  $('stStudents').textContent = await count(db.from('students').select('id',{count:'exact',head:true}).eq('status','active'));
  $('stSections').textContent = S.YEAR? await count(db.from('sections').select('id',{count:'exact',head:true}).eq('academic_year_id',S.YEAR.id)) : 0;
  $('stStaff').textContent = await count(db.from('staff').select('id',{count:'exact',head:true}).eq('is_active',true));
  $('stEntries').textContent = S.YEAR? await count(db.from('timetable_entries').select('id',{count:'exact',head:true}).eq('academic_year_id',S.YEAR.id)) : 0;
}

/* ============ استيراد الطالبات ============ */
const levelNum = v => /ثالث/.test(v)?3:/ثاني/.test(v)?2:/أول|اول/.test(v)?1:null;
function parseSection(code){
  const c = normDigits(code).replace(/\s/g,'');
  const m = c.match(/^(\d)(.+?)(\d+)$/);
  if(!m) return null;
  const lead=+m[1]; if(lead<1||lead>6) return null;
  return { code:c, track:m[2], semester: lead%2===1?1:2, levelFromCode: Math.ceil(lead/2) };
}
let STU=null;
bindDrop($('stuDrop'),$('stuFile'), async file=>{
  $('stuResult').className='result';
  const rows=await readSheet(file);
  if(rows.length<2){ alert('الملف فارغ.'); return; }
  const H=rows[0].map(clean);
  const find=(...k)=>H.findIndex(h=>k.every(x=>h.includes(x)));
  const col={ acad:Math.max(find('اكاديمي'),find('أكاديمي')), name:find('اسم'), pers:find('شخصي'),
    sec:find('الصف'), lvl:find('المستوى'), mail:Math.max(find('بريد'),H.findIndex(h=>/mail/i.test(h))),
    c1:Math.max(find('تواصل','1'),find('تواصل','١')), c2:Math.max(find('تواصل','2'),find('تواصل','٢')) };
  const warns=[];
  if(col.acad<0||col.name<0||col.sec<0){ alert('الملف لا يحتوي الأعمدة الأساسية.'); return; }
  if(col.pers<0) warns.push('عمود «الرقم الشخصي» غير موجود.');
  if(col.mail<0) warns.push('عمود «البريد الإلكتروني» غير موجود.');
  const students=[],sections=new Map(); let manazel=0,skipped=0;
  for(let i=1;i<rows.length;i++){
    const r=rows[i], secRaw=clean(r[col.sec]);
    if(!clean(r[col.acad])&&!clean(r[col.name])) continue;
    if(/منازل/.test(secRaw)){ manazel++; continue; }
    const sec=parseSection(secRaw), acad=normDigits(r[col.acad]), name=clean(r[col.name]);
    if(!sec||!acad||!name){ skipped++; warns.push(`سطر ${i+1}: بيانات ناقصة أو رمز صف غير مفهوم (${secRaw||'فارغ'}).`); continue; }
    const level = col.lvl>=0?(levelNum(clean(r[col.lvl]))??sec.levelFromCode):sec.levelFromCode;
    if(!sections.has(sec.code)) sections.set(sec.code,{code:sec.code,track:sec.track,semester:sec.semester,level});
    students.push({ academic_number:acad, full_name:name,
      personal_number: col.pers>=0&&normDigits(r[col.pers])?normDigits(r[col.pers]):null,
      email: col.mail>=0?clean(r[col.mail])||null:null,
      contact1: col.c1>=0?normDigits(r[col.c1])||null:null,
      contact2: col.c2>=0?normDigits(r[col.c2])||null:null,
      _section:sec.code });
  }
  const seen=new Set();
  for(const s of students){ if(seen.has(s.academic_number)) warns.push(`رقم أكاديمي مكرر: ${s.academic_number}`); seen.add(s.academic_number); }
  STU={students,sections:[...sections.values()]};
  $('stuPv1').textContent=students.length; $('stuPv2').textContent=sections.size;
  $('stuPv3').textContent=manazel; $('stuPv4').textContent=skipped;
  showWarns('stuWarns',warns); $('stuPreview').style.display='block';
});
$('stuCancel').addEventListener('click',()=>{STU=null;$('stuPreview').style.display='none';});
$('stuRun').addEventListener('click', async ()=>{
  if(!STU||!S.YEAR) return;
  $('stuRun').disabled=true; $('stuPreview').style.display='none';
  const R=$('stuResult'), prog=mkProg('stuProg');
  try{
    prog(10,'حفظ الطالبات…');
    const stuRows=STU.students.map(({_section,...s})=>s);
    for(const c of chunk(stuRows,500)){ const{error}=await db.from('students').upsert(c,{onConflict:'academic_number'}); if(error) throw error; }
    prog(35,'إنشاء الشعب…');
    const secRows=STU.sections.map(s=>({academic_year_id:S.YEAR.id,semester:s.semester,code:s.code,level:s.level,track:s.track}));
    { const{error}=await db.from('sections').upsert(secRows,{onConflict:'academic_year_id,semester,code'}); if(error) throw error; }
    prog(55,'مطابقة السجلات…');
    const {data:allStu,error:e1}=await db.from('students').select('id,academic_number'); if(e1) throw e1;
    const {data:allSec,error:e2}=await db.from('sections').select('id,code').eq('academic_year_id',S.YEAR.id); if(e2) throw e2;
    const stuId=Object.fromEntries(allStu.map(s=>[s.academic_number,s.id]));
    const secId=Object.fromEntries(allSec.map(s=>[s.code,s.id]));
    prog(70,'قيد الطالبات…');
    const {data:open,error:e3}=await db.from('enrollments').select('id,student_id,section_id').is('to_date',null); if(e3) throw e3;
    const openBy=Object.fromEntries((open||[]).map(e=>[e.student_id,e]));
    const inserts=[],closes=[];
    for(const s of STU.students){
      const sid=stuId[s.academic_number], scId=secId[s._section];
      if(!sid||!scId) continue;
      const cur=openBy[sid];
      if(cur&&cur.section_id===scId) continue;
      if(cur) closes.push(cur.id);
      inserts.push({student_id:sid,section_id:scId});
    }
    for(const c of chunk(closes,300)){ const{error}=await db.from('enrollments').update({to_date:new Date().toISOString().slice(0,10)}).in('id',c); if(error) throw error; }
    for(const c of chunk(inserts,500)){ const{error}=await db.from('enrollments').insert(c); if(error) throw error; }
    prog(95,'توثيق…');
    await db.from('audit_log').insert({actor_id:S.ME.id,action:'import',entity:'students',
      details:{students:stuRows.length,sections:secRows.length,new_enrollments:inserts.length,moved:closes.length}});
    prog(100,'اكتمل');
    R.className='result ok';
    R.innerHTML=`✅ اكتمل الاستيراد:<br>• ${stuRows.length} طالبة<br>• ${secRows.length} شعبة<br>• ${inserts.length} قيد جديد${closes.length?`<br>• ${closes.length} نقل بين شعب`:''}`;
    refreshStats();
  }catch(err){ R.className='result err'; R.textContent='❌ توقف الاستيراد: '+(err.message||err); }
  finally{ $('stuRun').disabled=false; setTimeout(()=>{$('stuProg').style.display='none';},1500); }
});

/* ============ استيراد المنتسبات ============ */
function normDept(name){
  const n=clean(name);
  if(/اشراف|إشراف/.test(n)&&/اجتماعي/.test(n)) return 'الإرشاد الاجتماعي';
  return n;
}
const deptKind = n => /مكتب|إرشاد|ارشاد|تسجيل|تمكين|إداري|اداري/.test(n)?'office':'academic';
let STF=null;
bindDrop($('stfDrop'),$('stfFile'), async file=>{
  $('stfResult').className='result';
  const rows=await readSheet(file);
  if(rows.length<2){ alert('الملف فارغ.'); return; }
  const H=rows[0].map(clean);
  const find=(...k)=>H.findIndex(h=>k.every(x=>h.includes(x)));
  const col={ name:find('اسم'), pers:find('شخصي'),
    mail:Math.max(find('بريد'),H.findIndex(h=>/mail/i.test(h))), dept:find('قسم'), title:find('مسمى') };
  const warns=[];
  if(col.name<0||col.pers<0){ alert('الملف لا يحتوي عمودي الاسم والرقم الشخصي.'); return; }
  const staffRows=[],depts=new Map(); let skipped=0,seniors=0;
  const seen=new Set();
  for(let i=1;i<rows.length;i++){
    const r=rows[i], name=clean(r[col.name]), pers=normDigits(r[col.pers]);
    if(!name&&!pers) continue;
    if(!name||!pers){ skipped++; warns.push(`سطر ${i+1}: الاسم أو الرقم الشخصي ناقص.`); continue; }
    if(seen.has(pers)){ warns.push(`رقم شخصي مكرر: ${pers} — أُخذ الأول.`); continue; }
    seen.add(pers);
    const dept = col.dept>=0?normDept(r[col.dept]):'';
    if(dept&&!depts.has(dept)) depts.set(dept,{name:dept,kind:deptKind(dept)});
    const tRaw = col.title>=0?clean(r[col.title]):'';
    const title = /أولى|اولى/.test(tRaw)?'senior_teacher':/معلم/.test(tRaw)?'teacher':'staff';
    if(title==='senior_teacher') seniors++;
    staffRows.push({ personal_number:pers, full_name:name,
      email: col.mail>=0?clean(r[col.mail])||null:null, _dept:dept||null, title });
  }
  STF={staffRows,depts:[...depts.values()]};
  $('stfPv1').textContent=staffRows.length; $('stfPv2').textContent=depts.size;
  $('stfPv3').textContent=seniors; $('stfPv4').textContent=skipped;
  showWarns('stfWarns',warns); $('stfPreview').style.display='block';
});
$('stfCancel').addEventListener('click',()=>{STF=null;$('stfPreview').style.display='none';});
$('stfRun').addEventListener('click', async ()=>{
  if(!STF) return;
  $('stfRun').disabled=true; $('stfPreview').style.display='none';
  const R=$('stfResult'), prog=mkProg('stfProg');
  try{
    prog(15,'إنشاء الأقسام…');
    if(STF.depts.length){ const{error}=await db.from('departments').upsert(STF.depts,{onConflict:'name'}); if(error) throw error; }
    const {data:allDep,error:eD}=await db.from('departments').select('id,name'); if(eD) throw eD;
    const depId=Object.fromEntries(allDep.map(d=>[d.name,d.id]));
    prog(50,'حفظ المنتسبات…');
    const rows=STF.staffRows.map(({_dept,...s})=>({...s, department_id:_dept?depId[_dept]??null:null}));
    for(const c of chunk(rows,300)){ const{error}=await db.from('staff').upsert(c,{onConflict:'personal_number'}); if(error) throw error; }
    prog(90,'توثيق…');
    await db.from('audit_log').insert({actor_id:S.ME.id,action:'import',entity:'staff',
      details:{staff:rows.length,departments:STF.depts.length}});
    prog(100,'اكتمل');
    R.className='result ok';
    R.innerHTML=`✅ اكتمل الاستيراد:<br>• ${rows.length} منتسبة<br>• ${STF.depts.length} قسم`;
    refreshStats();
  }catch(err){ R.className='result err'; R.textContent='❌ توقف الاستيراد: '+(err.message||err); }
  finally{ $('stfRun').disabled=false; setTimeout(()=>{$('stfProg').style.display='none';},1500); }
});

/* ============ استيراد الجدول الدراسي ============ */
const TT_HEAD=['الشعبة','اليوم','الحصة','رمز المقرر','المعلمة (الاسم أو الرقم الشخصي)','معلمة ثانية (اختياري)','القاعة (اختياري)'];
$('ttTpl').addEventListener('click',()=>{
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([TT_HEAD,
    ['1وحد1','الأحد',1,'عرب102','نرجس عادل','',''],
    ['1وحد1','الأحد',2,'تقن108','بشرى المطيع','امينة محمد موسى','مختبر 505']]);
  ws['!cols']=TT_HEAD.map(()=>({wch:24}));
  XLSX.utils.book_append_sheet(wb,ws,'الجدول');
  XLSX.writeFile(wb,'قالب_الجدول_الدراسي.xlsx');
});
const dayNum = v=>{
  const s=clean(v); const d=+normDigits(s);
  if(d>=1&&d<=5) return d;
  if(/أحد|احد/.test(s))return 1; if(/اثنين|إثنين/.test(s))return 2;
  if(/ثلاثاء/.test(s))return 3; if(/أربعاء|اربعاء/.test(s))return 4; if(/خميس/.test(s))return 5;
  return null;
};
let TT=null;
bindDrop($('ttDrop'),$('ttFile'), async file=>{
  $('ttResult').className='result';
  const rows=await readSheet(file);
  if(rows.length<2){ alert('الملف فارغ.'); return; }
  const H=rows[0].map(clean);
  const find=(...k)=>H.findIndex(h=>k.every(x=>h.includes(x)));
  const col={ sec:Math.max(find('شعبة'),find('الصف')), day:find('اليوم'), per:find('حصة'), subj:find('مقرر'),
    t1:H.findIndex(h=>h.includes('معلمة')&&!h.includes('ثانية')),
    t2:H.findIndex(h=>h.includes('ثانية')), room:find('قاعة') };
  if(col.sec<0||col.day<0||col.per<0||col.subj<0||col.t1<0){ alert('الملف لا يطابق القالب — نزلي القالب واستخدميه.'); return; }
  const warns=[],slots=new Map(),subjects=new Set(),secs=new Set(); let skipped=0;
  for(let i=1;i<rows.length;i++){
    const r=rows[i];
    const secCode=normDigits(r[col.sec]).replace(/\s/g,'');
    if(!secCode&&!clean(r[col.subj])) continue;
    const day=dayNum(r[col.day]); const per=+normDigits(r[col.per]);
    const subj=normDigits(r[col.subj]).replace(/\s/g,'');
    const t1=clean(r[col.t1]); const t2=col.t2>=0?clean(r[col.t2]):'';
    if(!secCode||!day||!per||per<1||per>7||!subj||!t1){ skipped++; warns.push(`سطر ${i+1}: بيانات ناقصة أو غير مفهومة.`); continue; }
    const key=`${secCode}|${day}|${per}`;
    if(slots.has(key)){
      const s=slots.get(key);
      if(s.subj===subj){ if(t1&&!s.teachers.includes(t1)) s.teachers.push(t1); if(t2&&!s.teachers.includes(t2)) s.teachers.push(t2); }
      else warns.push(`سطر ${i+1}: تعارض في ${secCode} — أُخذ الأول.`);
      continue;
    }
    const teachers=[t1]; if(t2) teachers.push(t2);
    slots.set(key,{secCode,day,per,subj,teachers,room:col.room>=0?clean(r[col.room])||null:null});
    subjects.add(subj); secs.add(secCode);
  }
  TT={slots:[...slots.values()]};
  $('ttPv1').textContent=slots.size; $('ttPv2').textContent=secs.size;
  $('ttPv3').textContent=subjects.size; $('ttPv4').textContent=skipped;
  showWarns('ttWarns',warns); $('ttPreview').style.display='block';
});
$('ttCancel').addEventListener('click',()=>{TT=null;$('ttPreview').style.display='none';});
$('ttRun').addEventListener('click', async ()=>{
  if(!TT||!S.YEAR) return;
  $('ttRun').disabled=true; $('ttPreview').style.display='none';
  const R=$('ttResult'), prog=mkProg('ttProg');
  try{
    let deleted=0;
    if($('ttReplace').checked){
      prog(5,'حذف الحصص السابقة غير المرصودة…');
      const {data:oldEnts,error:eO}=await db.from('timetable_entries').select('id').eq('academic_year_id',S.YEAR.id); if(eO) throw eO;
      const oldIds=(oldEnts||[]).map(e=>e.id);
      const recorded=new Set();
      for(const c of chunk(oldIds,200)){
        const {data:ss}=await db.from('attendance_sessions').select('entry_id').in('entry_id',c);
        for(const s of ss||[]) recorded.add(s.entry_id);
      }
      const delIds=oldIds.filter(id=>!recorded.has(id));
      for(const c of chunk(delIds,200)){
        const {error}=await db.from('timetable_entries').delete().in('id',c); if(error) throw error;
      }
      deleted=delIds.length;
    }
    prog(12,'جلب الشعب والمنتسبات…');
    const {data:allSec,error:e1}=await db.from('sections').select('id,code,semester').eq('academic_year_id',S.YEAR.id); if(e1) throw e1;
    const secBy=Object.fromEntries(allSec.map(s=>[s.code,s]));
    const {data:allStf,error:e2}=await db.from('staff').select('id,full_name,personal_number'); if(e2) throw e2;
    const stfByPers=Object.fromEntries(allStf.map(s=>[s.personal_number,s.id]));
    const stfByName={}; for(const s of allStf) stfByName[normName(s.full_name)]=s.id;
    const findTeacher = t => stfByPers[normDigits(t)] ?? stfByName[normName(t)] ?? null;
    prog(25,'إنشاء المقررات…');
    const subjCodes=[...new Set(TT.slots.map(s=>s.subj))].map(code=>({code}));
    for(const c of chunk(subjCodes,300)){ const{error}=await db.from('subjects').upsert(c,{onConflict:'code'}); if(error) throw error; }
    const {data:allSubj,error:e3}=await db.from('subjects').select('id,code'); if(e3) throw e3;
    const subjId=Object.fromEntries(allSubj.map(s=>[s.code,s.id]));
    prog(45,'بناء الحصص…');
    const warns=[],entries=[],teacherPlan=[];
    for(const s of TT.slots){
      const sec=secBy[s.secCode];
      if(!sec){ warns.push(`شعبة غير موجودة بالنظام: ${s.secCode}`); continue; }
      entries.push({ academic_year_id:S.YEAR.id, semester:sec.semester, section_id:sec.id,
        subject_id:subjId[s.subj]??null, day_of_week:s.day, period_no:s.per, room:s.room });
      teacherPlan.push({key:`${sec.id}|${s.day}|${s.per}`, teachers:s.teachers});
    }
    for(const c of chunk(entries,300)){ const{error}=await db.from('timetable_entries').upsert(c,{onConflict:'section_id,day_of_week,period_no'}); if(error) throw error; }
    prog(65,'ربط المعلمات…');
    const {data:allEnt,error:e4}=await db.from('timetable_entries')
      .select('id,section_id,day_of_week,period_no').eq('academic_year_id',S.YEAR.id); if(e4) throw e4;
    const entId={}; for(const e of allEnt) entId[`${e.section_id}|${e.day_of_week}|${e.period_no}`]=e.id;
    const ids=teacherPlan.map(p=>entId[p.key]).filter(Boolean);
    for(const c of chunk(ids,200)){ const{error}=await db.from('entry_teachers').delete().in('entry_id',c); if(error) throw error; }
    const links=[]; const unknownNames=new Set();
    for(const p of teacherPlan){
      const eid=entId[p.key]; if(!eid) continue;
      p.teachers.forEach((t,i)=>{
        const sid=findTeacher(t);
        if(!sid){ unknownNames.add(t); return; }
        links.push({entry_id:eid, staff_id:sid, is_attendance_taker:i===0});
      });
    }
    const unknownT=unknownNames.size;
    for(const c of chunk(links,400)){ const{error}=await db.from('entry_teachers').insert(c); if(error) throw error; }
    prog(90,'توثيق…');
    await db.from('audit_log').insert({actor_id:S.ME.id,action:'import',entity:'timetable',
      details:{entries:entries.length,links:links.length,unknown_teachers:unknownT,deleted_old:deleted}});
    prog(100,'اكتمل');
    R.className='result ok';
    R.innerHTML=`✅ اكتمل استيراد الجدول:<br>• ${entries.length} حصة<br>• ${links.length} ربط معلمة${deleted?`<br>• حُذفت ${deleted} حصة قديمة غير مرصودة`:''}${unknownT?`<br><br>⚠️ أسماء لم تُربط (${unknownT}) — صححيها كما وردت في المنتسبات أو استخدمي الرقم الشخصي ثم أعيدي الرفع:<br>${[...unknownNames].map(n=>'• «'+n+'»').join('<br>')}`:''}`;
    showWarns('ttWarns',warns); if(warns.length) $('ttWarns').style.display='block';
    refreshStats();
  }catch(err){ R.className='result err'; R.textContent='❌ توقف الاستيراد: '+(err.message||err); }
  finally{ $('ttRun').disabled=false; setTimeout(()=>{$('ttProg').style.display='none';},1500); }
});

registerTab({id:'adminMain', label:'الاستيراد', show:f=>f.isAdmin, init:refreshStats});
