/* ministry.js — قائمة الوزارة اليومية
   المصدر: الغياب الرسمي المحسوب (غائبات الحصة الأولى ناقص التأخير/الاستئذان).
   الشاشة تعرض القائمة، والإرشاد الاجتماعي يعبئ أعمدة المتابعة الأربعة،
   وتصدير إكسل منسّق فعلياً (ExcelJS: ترويسة، حدود، تلوين) + تنزيل PDF (طباعة المتصفح).
   الملف مكتفٍ بذاته: يضيف تبويبه وتنسيقاته بنفسه — لا تعديل على app.css. */
import { db, $, S, AR_DAYS, dstr, chunk, toast, printWithTitle, registerTab } from './core.js';

/* قيم القوائم — مبدئية قابلة للكتابة الحرة، وستُستبدل بقوائم الوزارة الرسمية عند وصولها */
const OPT = {
  status:   ['غياب بعذر','غياب بدون عذر','منقطعة'],
  action:   ['الاتصال بمتولي الأمر','إرسال رسالة نصية','استدعاء متولي الأمر','تحويل للإرشاد الاجتماعي'],
  response: ['تم الرد','لم يتم الرد','تعهد بالحضور','لا استجابة'],
};
const schoolName = () => S.SETTINGS.school_name || 'المدرسة';

/* ============ حقن الواجهة والتنسيقات ============ */
$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="ministryMain" style="display:none">
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
      <button class="btn ghost" id="minXls1">⬇ إكسل — بيانات المتغيبات</button>
      <button class="btn ghost" id="minXls2">⬇ إكسل — الأسماء والأعداد</button>
      <button class="btn ghost" id="minPdf1">⬇ PDF — بيانات المتغيبات</button>
      <button class="btn ghost" id="minPdf2">⬇ PDF — الأسماء والأعداد</button>
    </div>
    <div class="board-wrap"><table class="board min-tbl" id="minTable"></table></div>
  </div>
</div>
<datalist id="dlStatus">${OPT.status.map(v=>`<option value="${v}">`).join('')}</datalist>
<datalist id="dlAction">${OPT.action.map(v=>`<option value="${v}">`).join('')}</datalist>
<datalist id="dlResponse">${OPT.response.map(v=>`<option value="${v}">`).join('')}</datalist>
<div id="printArea"></div>
<style>
  #ministryMain.wide{max-width:1400px}
  .min-tbl{width:100%;table-layout:fixed}
  .min-tbl th{font-size:11.5px;padding:9px 6px}
  .min-tbl td{text-align:right;padding:5px}
  .min-tbl td.c{text-align:center}
  .min-tbl input{width:100%;min-width:0;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:11.5px;background:#fbfaf7}
  .min-tbl input:focus{outline:none;border-color:var(--navy);background:var(--white)}
  .min-tbl tr.saved input{background:var(--ok-soft)}
  #printArea{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0}
    body *{visibility:hidden}
    #printArea, #printArea *{visibility:visible}
    #printArea{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
    .p-head{text-align:center;margin-bottom:14px}
    .p-head h2{font-size:15px;color:#1d3d5c;font-weight:600;margin-bottom:8px}
    .p-head p{font-size:12px;color:#333}
    .p-tbl{width:100%;border-collapse:collapse;font-size:11px}
    .p-tbl th{background:#1d3d5c;color:#fff;padding:6px 5px;border:1px solid #1d3d5c}
    .p-tbl td{padding:5px;border:1px solid #ccc;text-align:right}
    .p-tbl td.c{text-align:center}
  }
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
  $('minPdf1').addEventListener('click',()=>exportPdf(1));
  $('minPdf2').addEventListener('click',()=>exportPdf(2));
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

  tbl.innerHTML='<tr><th style="width:32px">#</th><th style="width:78px">أكاديمي</th><th>اسم الطالبة</th><th style="width:60px">الصف</th>'+
    '<th style="width:90px">تواصل ١</th><th style="width:90px">تواصل ٢</th>'+
    '<th>حالة الغياب</th><th>الإجراء المتخذ</th><th>حالة الاستجابة</th><th>سبب الغياب</th></tr>'+
    ROWS.map((r,i)=>`<tr data-id="${r.id}" class="${r.fu.absence_status||r.fu.action_taken?'saved':''}">
      <td class="c">${i+1}</td><td class="c">${r.academic_number}</td><td><b>${r.full_name}</b></td>
      <td class="c">${r.sec}</td><td class="c" dir="ltr">${fmtPhone(r.contact1)}</td><td class="c" dir="ltr">${fmtPhone(r.contact2)}</td>
      <td><input list="dlStatus"   data-f="absence_status"  value="${r.fu.absence_status||''}"></td>
      <td><input list="dlAction"   data-f="action_taken"    value="${r.fu.action_taken||''}"></td>
      <td><input list="dlResponse" data-f="response_status" value="${r.fu.response_status||''}"></td>
      <td><input                   data-f="reason"          value="${r.fu.reason||''}"></td>
    </tr>`).join('');
}

/* يحمي العرض من أي رقم وصل بصيغة عشرية (بيانات قديمة قبل تصحيح نوع العمود) */
function fmtPhone(v){
  if(v===null||v===undefined||v==='') return '—';
  const s=String(v);
  return s.includes('.') ? s.split('.')[0] : s;
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

/* ============ تصدير إكسل منسّق فعلياً (ExcelJS) ============ */
const NAVY='FF1D3D5C', GOLD='FFB98A2F', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const thin = {style:'thin', color:{argb:LINE}};
const border = {top:thin,left:thin,right:thin,bottom:thin};

async function exportXls(kind){
  if(!ROWS.length){ toast('لا غائبات في هذا اليوم'); return; }
  const day=AR_DAYS[MIN_DATE.getDay()]||'', date=dstr(MIN_DATE);
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('القائمة', {views:[{rightToLeft:true}]});

  const addTitleRow=(text,size,bold,fillColor,fontColor,cols)=>{
    const row=ws.addRow([text]);
    ws.mergeCells(row.number,1,row.number,cols);
    const cell=row.getCell(1);
    cell.font={name:'Arial',size,bold,color:{argb:fontColor}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fillColor) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fillColor}};
    row.height=size>=16?26:20;
  };

  let cols, headers, dataRows, fileBase;
  if(kind===1){
    cols=10; fileBase=`استمارة_المتغيبات_${date}`;
    headers=['#','الرقم الأكاديمي','اسم الطالبة','الصف','تواصل ١','تواصل ٢','حالة الغياب','الإجراء المتخذ','حالة الاستجابة','سبب الغياب'];
    dataRows=ROWS.map((r,i)=>[i+1,r.academic_number,r.full_name,r.sec,fmtPhone(r.contact1),fmtPhone(r.contact2),
      r.fu.absence_status||'',r.fu.action_taken||'',r.fu.response_status||'',r.fu.reason||'']);
  }else{
    cols=4; fileBase=`أعداد_المتغيبات_${date}`;
    headers=['#','الرقم الأكاديمي','اسم الطالبة','الصف'];
    dataRows=ROWS.map((r,i)=>[i+1,r.academic_number,r.full_name,r.sec]);
  }

  addTitleRow(schoolName(),16,true,NAVY,WHITE,cols);
  addTitleRow(kind===1?'استمارة بيانات الطلبة المتغيبين':'أسماء الطالبات المتغيبات وأعدادهن',13,true,GOLD,NAVY,cols);
  addTitleRow(`اليوم: ${day}   —   التاريخ: ${date}`,11,false,null,'FF22303C',cols);
  ws.addRow([]);

  const hdrRow=ws.addRow(headers);
  hdrRow.eachCell(c=>{
    c.font={name:'Arial',size:11,bold:true,color:{argb:WHITE}};
    c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}};
    c.alignment={horizontal:'center',vertical:'middle'};
    c.border=border;
  });
  hdrRow.height=22;

  dataRows.forEach((r,i)=>{
    const row=ws.addRow(r);
    row.eachCell((c,colNo)=>{
      c.border=border;
      c.alignment={horizontal: colNo===3?'right':'center', vertical:'middle'};
      c.font={name:'Arial',size:10.5};
      if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}};
      /* أرقام التواصل والأرقام الأكاديمية نصوص دائماً — تمنع تحوّلها العشري في إكسل */
      if(kind===1 && (colNo===5||colNo===6)) c.numFmt='@';
      if(colNo===2) c.numFmt='@';
    });
  });

  if(kind===2){
    ws.addRow([]);
    const totalRow=ws.addRow(['العدد الكلي', ROWS.length]);
    totalRow.getCell(1).font={bold:true}; totalRow.getCell(2).font={bold:true};
    ws.addRow([]);
    const perSec={}; for(const r of ROWS) perSec[r.sec]=(perSec[r.sec]||0)+1;
    const subHdr=ws.addRow(['الصف','العدد']);
    subHdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.border=border; c.alignment={horizontal:'center'}; });
    for(const s of Object.keys(perSec).sort((a,b)=>a.localeCompare(b,'ar'))){
      const r=ws.addRow([s,perSec[s]]); r.eachCell(c=>{c.border=border; c.alignment={horizontal:'center'};});
    }
  }

  const widths = kind===1 ? [5,14,28,9,13,13,17,22,16,20] : [5,14,28,9];
  ws.columns.forEach((c,i)=>{ c.width=widths[i]||14; });
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:4}];

  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=fileBase+'.xlsx'; a.click();
  URL.revokeObjectURL(url);
}

/* ============ تنزيل PDF (طباعة المتصفح — تدعم العربية والاتجاه تلقائياً) ============ */
function exportPdf(kind){
  if(!ROWS.length){ toast('لا غائبات في هذا اليوم'); return; }
  const day=AR_DAYS[MIN_DATE.getDay()]||'', date=dstr(MIN_DATE);
  if(kind===1){
    const rowsHtml=ROWS.map((r,i)=>`<tr>
      <td class="c">${i+1}</td><td class="c">${r.academic_number}</td><td>${r.full_name}</td><td class="c">${r.sec}</td>
      <td class="c" dir="ltr">${fmtPhone(r.contact1)}</td><td class="c" dir="ltr">${fmtPhone(r.contact2)}</td>
      <td>${r.fu.absence_status||''}</td><td>${r.fu.action_taken||''}</td><td>${r.fu.response_status||''}</td><td>${r.fu.reason||''}</td>
    </tr>`).join('');
    $('printArea').innerHTML = `
      <div class="p-head"><h2>استمارة بيانات الطلبة المتغيبين</h2>
        <p>اليوم: ${day} — التاريخ: ${date} — إجمالي الغائبات: ${ROWS.length}</p></div>
      <table class="p-tbl">
        <tr><th>#</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>الصف</th><th>تواصل ١</th><th>تواصل ٢</th>
          <th>حالة الغياب</th><th>الإجراء المتخذ</th><th>حالة الاستجابة</th><th>سبب الغياب</th></tr>
        ${rowsHtml}
      </table>`;
    printWithTitle(`استمارة_المتغيبات_${date}`);
  }else{
    const perSec={}; for(const r of ROWS) perSec[r.sec]=(perSec[r.sec]||0)+1;
    const rowsHtml=ROWS.map((r,i)=>`<tr><td class="c">${i+1}</td><td class="c">${r.academic_number}</td><td>${r.full_name}</td><td class="c">${r.sec}</td></tr>`).join('');
    const secHtml=Object.keys(perSec).sort((a,b)=>a.localeCompare(b,'ar')).map(s=>`<tr><td>${s}</td><td class="c">${perSec[s]}</td></tr>`).join('');
    $('printArea').innerHTML = `
      <div class="p-head"><h2>أسماء الطالبات المتغيبات وأعدادهن</h2>
        <p>اليوم: ${day} — التاريخ: ${date} — العدد الكلي: ${ROWS.length}</p></div>
      <table class="p-tbl"><tr><th>#</th><th>الرقم الأكاديمي</th><th>اسم الطالبة</th><th>الصف</th></tr>${rowsHtml}</table>
      <div class="p-head" style="margin-top:18px"><h2>العدد حسب الصف</h2></div>
      <table class="p-tbl" style="width:280px"><tr><th>الصف</th><th>العدد</th></tr>${secHtml}</table>`;
    printWithTitle(`أسماء_وأعداد_المتغيبات_${date}`);
  }
}

registerTab({id:'ministryMain', label:'قائمة الغياب', group:'attendance', groupLabel:'متابعة الغياب',
  show:f=>f.isAdmin||f.isSocial||f.isReg||f.isLead||f.isAttendanceLead, onOpen:loadMinistry});
