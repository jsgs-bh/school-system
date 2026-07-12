/* ministry.js — قائمة الوزارة اليومية
   المصدر: الغياب الرسمي المحسوب (غائبات الحصة الأولى ناقص التأخير/الاستئذان).
   الشاشة تعرض القائمة، والإرشاد الاجتماعي يعبئ أعمدة المتابعة الأربعة،
   وزرّا تصدير إكسل: استمارة بيانات المتغيبات + استمارة الأسماء والأعداد.
   الملف مكتفٍ بذاته: يضيف تبويبه وتنسيقاته بنفسه — لا تعديل على app.css. */
import { db, $, S, AR_DAYS, dstr, chunk, toast, registerTab } from './core.js';

/* قيم القوائم — مبدئية قابلة للكتابة الحرة، وسنستبدلها بقوائم الوزارة الرسمية عند وصولها */
const OPT = {
  status:   ['غياب بعذر','غياب بدون عذر','منقطعة'],
  action:   ['الاتصال بمتولي الأمر','إرسال رسالة نصية','استدعاء متولي الأمر','تحويل للإرشاد الاجتماعي'],
  response: ['تم الرد','لم يتم الرد','تعهد بالحضور','لا استجابة'],
};

/* ============ حقن الواجهة والتنسيقات ============ */
$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="ministryMain" style="display:none">
  <div class="datebar">
    <div class="today-lbl" id="minTitle">قائمة الوزارة</div>
    <input type="date" id="minPick">
  </div>
  <div class="stats">
    <div class="stat red"><b id="mAbs">—</b><span>غائبة رسمياً</span></div>
    <div class="stat green"><b id="mDone">—</b><span>تمت متابعتها</span></div>
    <div class="stat"><b id="mCovered">—</b><span>تأخير / استئذان</span></div>
  </div>
  <div class="warnbox" id="minWarn" style="display:none"></div>
  <div class="panel">
    <div class="actions" style="margin-bottom:14px">
      <button class="btn gold" id="minSave">حفظ المتابعة</button>
      <button class="btn ghost" id="minXls1">⬇ استمارة بيانات المتغيبات</button>
      <button class="btn ghost" id="minXls2">⬇ استمارة الأسماء والأعداد</button>
    </div>
    <div class="board-wrap"><table class="board min-tbl" id="minTable"></table></div>
  </div>
</div>
<datalist id="dlStatus">${OPT.status.map(v=>`<option value="${v}">`).join('')}</datalist>
<datalist id="dlAction">${OPT.action.map(v=>`<option value="${v}">`).join('')}</datalist>
<datalist id="dlResponse">${OPT.response.map(v=>`<option value="${v}">`).join('')}</datalist>
<style>
  .min-tbl{min-width:980px}
  .min-tbl td{text-align:right}
  .min-tbl td.c{text-align:center}
  .min-tbl input{width:100%;min-width:120px;padding:7px 9px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:12px;background:#fbfaf7}
  .min-tbl input:focus{outline:none;border-color:var(--navy);background:var(--white)}
  .min-tbl tr.saved input{background:var(--ok-soft)}
</style>`);

let MIN_DATE=new Date(), ROWS=[];

function initPick(){
  const p=$('minPick');
  if(p.dataset.ready) return;
  p.dataset.ready='1';
  p.value=dstr(MIN_DATE); p.max=dstr(new Date());
  p.addEventListener('change',()=>{ if(p.value){ MIN_DATE=new Date(p.value+'T12:00:00'); loadMinistry(); } });
  $('minSave').addEventListener('click',saveFollowup);
  $('minXls1').addEventListener('click',()=>exportXls(1));
  $('minXls2').addEventListener('click',()=>exportXls(2));
}

async function loadMinistry(){
  initPick();
  const d=MIN_DATE, jsDay=d.getDay();
  $('minTitle').textContent='قائمة الوزارة — '+(jsDay<=4?AR_DAYS[jsDay]+' ':'')+dstr(d);
  const tbl=$('minTable'); $('minWarn').style.display='none'; ROWS=[];
  if(jsDay>4){ tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">يوم عطلة.</td></tr>';
    $('mAbs').textContent=$('mDone').textContent=$('mCovered').textContent='—'; return; }
  tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">جارٍ التحميل…</td></tr>';
  const dow=jsDay+1;

  /* حصص الحصة الأولى ورصدها */
  const {data:ents}=await db.from('timetable_entries')
    .select('id,section_id,sections(code)')
    .eq('academic_year_id',S.YEAR.id).eq('day_of_week',dow).eq('period_no',1);
  const entIds=(ents||[]).map(e=>e.id);
  const secOfEntry={}; for(const e of ents||[]) secOfEntry[e.id]=e.sections?.code||'—';
  let sess=[];
  for(const c of chunk(entIds,200)){
    const {data:ss}=await db.from('attendance_sessions').select('id,entry_id').in('entry_id',c).eq('date',dstr(d));
    sess.push(...(ss||[]));
  }
  const secOfSess={}; for(const s of sess) secOfSess[s.id]=secOfEntry[s.entry_id];

  /* الشعب التي لم تُرصد حصتها الأولى بعد — القائمة غير مكتملة بدونها */
  const recordedEnt=new Set(sess.map(s=>s.entry_id));
  const missing=(ents||[]).filter(e=>!recordedEnt.has(e.id)).map(e=>secOfEntry[e.id]).sort((a,b)=>a.localeCompare(b,'ar'));
  if(missing.length){
    $('minWarn').style.display='block';
    $('minWarn').innerHTML=`⚠️ القائمة غير مكتملة — شعب لم تُرصد حصتها الأولى بعد (${missing.length}): ${missing.join('، ')}`;
  }

  /* الغياب الرسمي = غائبات ح١ ناقص التأخير/الاستئذان */
  const [{data:late},{data:exc}] = await Promise.all([
    db.from('late_log').select('student_id').eq('date',dstr(d)),
    db.from('excuse_log').select('student_id').eq('date',dstr(d)),
  ]);
  const covered=new Set([...(late||[]),...(exc||[])].map(r=>r.student_id));
  const sessIds=sess.map(s=>s.id);
  const bySid={};
  for(const c of chunk(sessIds,200)){
    const {data:recs}=await db.from('attendance_records').select('session_id,student_id,status').in('session_id',c);
    for(const r of recs||[])
      if(r.status==='absent'&&!covered.has(r.student_id)) bySid[r.student_id]=secOfSess[r.session_id];
  }
  const ids=Object.keys(bySid);
  $('mCovered').textContent=covered.size;
  if(!ids.length){
    tbl.innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا غياب رسمياً في هذا اليوم 🎉</td></tr>';
    $('mAbs').textContent=0; $('mDone').textContent=0; return;
  }

  /* بيانات الطالبات والمتابعة المحفوظة */
  let stu=[],fups=[];
  for(const c of chunk(ids,200)){
    const {data:st}=await db.from('students').select('id,full_name,academic_number,contact1,contact2').in('id',c);
    stu.push(...(st||[]));
    const {data:fu}=await db.from('absence_followup').select('*').eq('date',dstr(d)).in('student_id',c);
    fups.push(...(fu||[]));
  }
  const fuBy={}; for(const f of fups) fuBy[f.student_id]=f;
  ROWS=stu.map(s=>({...s, sec:bySid[s.id]||'—', fu:fuBy[s.id]||{}}))
    .sort((a,b)=>a.sec.localeCompare(b.sec,'ar')||a.full_name.localeCompare(b.full_name,'ar'));

  $('mAbs').textContent=ROWS.length;
  $('mDone').textContent=ROWS.filter(r=>r.fu.absence_status||r.fu.action_taken).length;

  tbl.innerHTML='<tr><th>#</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>الصف</th><th>تواصل ١</th><th>تواصل ٢</th>'+
    '<th>حالة الغياب</th><th>الإجراء المتخذ</th><th>حالة الاستجابة</th><th>سبب الغياب</th></tr>'+
    ROWS.map((r,i)=>`<tr data-id="${r.id}" class="${r.fu.absence_status||r.fu.action_taken?'saved':''}">
      <td class="c">${i+1}</td><td class="c">${r.academic_number}</td><td><b>${r.full_name}</b></td>
      <td class="c">${r.sec}</td><td class="c" dir="ltr">${r.contact1||'—'}</td><td class="c" dir="ltr">${r.contact2||'—'}</td>
      <td><input list="dlStatus"   data-f="absence_status"  value="${r.fu.absence_status||''}"></td>
      <td><input list="dlAction"   data-f="action_taken"    value="${r.fu.action_taken||''}"></td>
      <td><input list="dlResponse" data-f="response_status" value="${r.fu.response_status||''}"></td>
      <td><input                   data-f="reason"          value="${r.fu.reason||''}"></td>
    </tr>`).join('');
}

async function saveFollowup(){
  const btn=$('minSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    const ups=[];
    $('minTable').querySelectorAll('tr[data-id]').forEach(tr=>{
      const row={student_id:tr.dataset.id, date:dstr(MIN_DATE), recorded_by:S.ME.id, updated_at:new Date().toISOString()};
      let any=false;
      tr.querySelectorAll('input').forEach(inp=>{ const v=inp.value.trim(); row[inp.dataset.f]=v||null; if(v) any=true; });
      if(any) ups.push(row);
    });
    for(const c of chunk(ups,200)){
      const {error}=await db.from('absence_followup').upsert(c,{onConflict:'student_id,date'}); if(error) throw error;
    }
    await db.from('audit_log').insert({actor_id:S.ME.id,action:'followup',entity:'absence_followup',
      details:{date:dstr(MIN_DATE),rows:ups.length}});
    toast(`تم حفظ متابعة ${ups.length} طالبة`);
    loadMinistry();
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ المتابعة'; }
}

function exportXls(kind){
  if(!ROWS.length){ toast('لا غائبات في هذا اليوم'); return; }
  const day=AR_DAYS[MIN_DATE.getDay()]||'', date=dstr(MIN_DATE);
  const wb=XLSX.utils.book_new();
  let aoa,name,widths;
  if(kind===1){
    /* استمارة بيانات الطلبة المتغيبين */
    aoa=[ ['مدرسة جدحفص الثانوية للبنات'], ['استمارة بيانات الطلبة المتغيبين'],
      [`اليوم: ${day}`,'','',`التاريخ: ${date}`], [],
      ['#','الرقم الأكاديمي','اسم الطالبة','الصف','رقم تواصل ١','رقم تواصل ٢','حالة الغياب','الإجراء المتخذ','حالة الاستجابة','سبب الغياب'],
      ...ROWS.map((r,i)=>[i+1,r.academic_number,r.full_name,r.sec,r.contact1||'',r.contact2||'',
        r.fu.absence_status||'',r.fu.action_taken||'',r.fu.response_status||'',r.fu.reason||'']) ];
    name=`استمارة_المتغيبات_${date}`; widths=[5,14,30,9,14,14,16,22,16,22];
  }else{
    /* استمارة الأسماء والأعداد */
    const perSec={}; for(const r of ROWS) perSec[r.sec]=(perSec[r.sec]||0)+1;
    aoa=[ ['مدرسة جدحفص الثانوية للبنات'], ['أسماء الطالبات المتغيبات وأعدادهن'],
      [`اليوم: ${day}`,'',`التاريخ: ${date}`], [],
      ['#','الرقم الأكاديمي','اسم الطالبة','الصف'],
      ...ROWS.map((r,i)=>[i+1,r.academic_number,r.full_name,r.sec]),
      [], ['العدد الكلي',ROWS.length], [],
      ['الصف','العدد'], ...Object.keys(perSec).sort((a,b)=>a.localeCompare(b,'ar')).map(s=>[s,perSec[s]]) ];
    name=`أعداد_المتغيبات_${date}`; widths=[12,14,30,9];
  }
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=widths.map(w=>({wch:w}));
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:widths.length-1}},{s:{r:1,c:0},e:{r:1,c:widths.length-1}}];
  if(!wb.Workbook) wb.Workbook={}; wb.Workbook.Views=[{RTL:true}];
  XLSX.utils.book_append_sheet(wb,ws,'القائمة');
  XLSX.writeFile(wb,name+'.xlsx');
}

registerTab({id:'ministryMain', label:'قائمة الوزارة',
  show:f=>f.isAdmin||f.isSocial||f.isReg||f.isLead, onOpen:loadMinistry});
