/* remedial-plan.js — استمارة التغذية الراجعة (خطة علاجية سريعة)
   لرئيسة التحليل والمعلمة الأولى (ضمن نطاق إشرافها). تختارين مقرراً
   واختباراً، فتظهر مصفوفة: فئة × شعبة (الأعداد محسوبة تلقائياً من
   الدرجات دائماً)، بالإضافة لصفي الناجحات والمتقنات، مع عمودي
   "الإجراء" و"متابعة التنفيذ" لكل فئة — تُحفظ وتُصدَّر إكسل/PDF. */
import { db, $, S, chunk, toast, printWithTitle, registerTab } from './core.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';
const EXAM_NAMES = ['اختبار تشخيصي','الاختبار الأول','الاختبار الثاني'];
const STATUS_LABEL = {pending:'لم يُنفذ', in_progress:'جاري التنفيذ', done:'نُفذ'};

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="rpMain" style="display:none">
  <div class="panel">
    <h3>استمارة التغذية الراجعة</h3>
    <div class="sub">خطة علاجية سريعة لدعم فئات الطالبات، مبنية على تصنيف اختبار معيّن، بأعداد تُحسب تلقائياً لكل شعبة.</div>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <select id="rpSubject" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:180px"></select>
      <select id="rpExam" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:160px">
        ${EXAM_NAMES.map(n=>`<option value="${n}">${n}</option>`).join('')}
      </select>
      <button class="btn gold" id="rpGo" style="width:auto;padding:10px 24px">تحميل</button>
    </div>
    <div class="field">
      <label>الهدف الخاص</label>
      <input type="text" id="rpGoal" placeholder="مثال: رفع الأداء العام لجميع فئات الطالبات خلال الفصل الدراسي الأول">
    </div>
  </div>

  <div id="rpResults" style="display:none">
    <div class="warnbox" id="rpWarn" style="display:none"></div>
    <div class="result" id="rpReadOnlyNotice" style="display:none;background:var(--sand);color:var(--ink);border:1px solid var(--line)">👁️ وضع استعراض فقط — الكتابة والحفظ متاحان للمعلمة الأولى ومعلمات المقرر.</div>
    <div class="panel">
      <div class="actions" style="margin-bottom:14px">
        <button class="btn gold" id="rpSave">حفظ الخطة</button>
        <button class="btn ghost" id="rpXls">⬇ إكسل</button>
        <button class="btn ghost" id="rpPdf">⬇ PDF</button>
      </div>
      <div class="board-wrap"><table class="board rp-tbl" id="rpTable"></table></div>
    </div>
  </div>
</div>
<div id="printAreaRP"></div>
<style>
  #rpMain.wide{max-width:1500px}
  .rp-tbl input[type=text]{width:100%;min-width:140px;padding:7px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  .rp-tbl select{padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12px;background:#fbfaf7}
  .rp-tbl td.cnt{text-align:center;font-weight:700}
  #printAreaRP{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaRP, #printAreaRP *{visibility:visible}
    #printAreaRP{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:12mm 10mm}
    .rp-head{text-align:center;margin-bottom:10px}
    .rp-head h2{font-size:14px;color:#1d3d5c;font-weight:600;margin-bottom:5px}
    .rp-head p{font-size:11px;color:#333}
    .rp-print-tbl{width:100%;border-collapse:collapse;font-size:9px}
    .rp-print-tbl th{background:#1d3d5c;color:#fff;padding:4px;border:1px solid #1d3d5c}
    .rp-print-tbl td{padding:4px;border:1px solid #ccc;text-align:center}
  }
</style>`);

let CATS=[], SUPERVISED=null, SECTIONS=[], PLAN=null, ACTIONS={}, CAN_EDIT=false;

async function initRP(){
  if($('rpGo').dataset.ready) return;
  $('rpGo').dataset.ready='1';
  const {data:cats}=await db.from('grade_categories').select('*').order('sort_order');
  CATS=cats||[];

  CAN_EDIT = S.FLAGS.isSeniorTeacher; // فقط المعلمة الأولى تكتب هنا — الأدمن/القيادة/رئيسة التحليل استعراض فقط
  $('rpGoal').disabled = !CAN_EDIT;
  $('rpSave').style.display = CAN_EDIT ? 'inline-flex' : 'none';

  if(CAN_EDIT){
    SUPERVISED=await getSupervisedTeacherIds();
  }else SUPERVISED=null;

  const {data:subs}=await db.from('subjects').select('id,code,exam_total').order('code');
  let subjOptions=subs||[];
  if(SUPERVISED){
    const {data:ents}=await db.from('entry_teachers').select('staff_id,timetable_entries!inner(subject_id,academic_year_id)').eq('timetable_entries.academic_year_id',S.YEAR.id);
    const allowed=new Set((ents||[]).filter(e=>SUPERVISED.has(e.staff_id)).map(e=>e.timetable_entries.subject_id));
    subjOptions=subjOptions.filter(s=>allowed.has(s.id));
  }
  $('rpSubject').innerHTML=subjOptions.map(s=>`<option value="${s.id}">${s.code}</option>`).join('');
  $('rpGo').addEventListener('click',loadPlan);
  $('rpSave').addEventListener('click',savePlan);
  $('rpXls').addEventListener('click',exportXls);
  $('rpPdf').addEventListener('click',exportPdf);
}

async function getSupervisedTeacherIds(){
  const deptId=S.ME.department_id;
  const {data:deptTeachers}=deptId?await db.from('staff').select('id').eq('department_id',deptId):{data:[]};
  const set=new Set((deptTeachers||[]).map(t=>t.id)); set.add(S.ME.id);
  const {data:links}=await db.from('supervision_links').select('teacher_staff_id,mode').eq('senior_staff_id',S.ME.id);
  for(const l of links||[]){ if(l.mode==='include') set.add(l.teacher_staff_id); else set.delete(l.teacher_staff_id); }
  return set;
}

async function loadPlan(){
  const subjId=$('rpSubject').value, examName=$('rpExam').value;
  if(!subjId){ toast('اختاري مقرراً'); return; }
  const subject=(await db.from('subjects').select('id,code,exam_total').eq('id',subjId).single()).data;

  const {data:rows,error}=await db.from('entry_teachers')
    .select('staff_id,timetable_entries!inner(section_id,subject_id,academic_year_id,sections(code))')
    .eq('timetable_entries.subject_id',subjId).eq('timetable_entries.academic_year_id',S.YEAR.id);
  if(error){ toast('تعذر التحميل: '+error.message); return; }
  const secMap={};
  for(const r of rows||[]){
    if(SUPERVISED && !SUPERVISED.has(r.staff_id)) continue;
    const e=r.timetable_entries; const code=e.sections?.code||'؟';
    secMap[code]=e.section_id;
  }
  SECTIONS=Object.keys(secMap).sort((a,b)=>a.localeCompare(b,'ar')).map(code=>({code,id:secMap[code]}));
  if(!SECTIONS.length){ toast('لا شعب ضمن نطاقك لهذا المقرر'); return; }

  const missing=[];
  const countsBySec={}; // {secCode: {catId:count, pass:count, mastery:count}}
  const {data:th}=await db.from('grade_settings').select('*').eq('id',1).maybeSingle();
  const THRESH=th||{pass_pct:50,mastery_pct:80};

  for(const sec of SECTIONS){
    const {data:ex}=await db.from('exams').select('id,exam_total').eq('subject_id',subjId).eq('section_id',sec.id).eq('name',examName).maybeSingle();
    if(!ex){ missing.push(sec.code); countsBySec[sec.code]={}; continue; }
    const total=ex.exam_total ?? subject.exam_total;
    const {data:recs}=await db.from('grade_records').select('score').eq('exam_id',ex.id).not('score','is',null);
    const counts={pass:0,mastery:0}; for(const c of CATS) counts[c.id]=0;
    for(const r of recs||[]){
      const pct=r.score/total*100;
      const cat=CATS.find(c=>pct>=c.min_pct && pct<=c.max_pct);
      if(cat) counts[cat.id]++;
      if(pct>=THRESH.pass_pct) counts.pass++;
      if(pct>=THRESH.mastery_pct) counts.mastery++;
    }
    countsBySec[sec.code]=counts;
  }

  $('rpWarn').style.display = missing.length ? 'block' : 'none';
  if(missing.length) $('rpWarn').innerHTML=`⚠️ لا يوجد اختبار "${examName}" مرصود بعد للشعب: ${missing.join('، ')} — أعمدتها ستظهر فارغة.`;

  const {data:plan}=await db.from('remedial_plans').select('*').eq('subject_id',subjId).eq('exam_name',examName).maybeSingle();
  PLAN=plan||null;
  $('rpGoal').value=plan?.goal||'';
  ACTIONS={};
  if(plan){
    const {data:acts}=await db.from('remedial_plan_actions').select('*').eq('plan_id',plan.id);
    for(const a of acts||[]) ACTIONS[a.row_key]=a;
  }

  renderTable(subject, examName, countsBySec);
  $('rpResults').style.display='block';
  $('rpReadOnlyNotice').style.display = CAN_EDIT ? 'none' : 'block';
}

function rowDef(){
  return [...CATS.map(c=>({key:'cat:'+c.id, label:c.name, color:c.color})), {key:'pass',label:'الناجحات'}, {key:'mastery',label:'المتقنات'}];
}
function renderTable(subject, examName, countsBySec){
  const rows=rowDef();
  let html='<tr><th>الفئة</th>'+SECTIONS.map(s=>`<th>${s.code}</th>`).join('')+'<th style="min-width:180px">الإجراء</th><th>متابعة التنفيذ</th></tr>';
  for(const r of rows){
    const a=ACTIONS[r.key]||{};
    html+=`<tr data-row="${r.key}"><td class="sec" style="${r.color?`border-inline-start:4px solid ${r.color}`:''}">${r.label}</td>`;
    for(const s of SECTIONS){
      const c=countsBySec[s.code]||{};
      const val = r.key.startsWith('cat:') ? (c[r.key.slice(4)]??0) : (c[r.key]??0);
      html+=`<td class="cnt">${val}</td>`;
    }
    html+= CAN_EDIT
      ? `<td><input type="text" data-row="${r.key}" data-f="action" value="${(a.action_text||'').replace(/"/g,'&quot;')}"></td>
         <td><select data-row="${r.key}" data-f="status">
           ${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${a.status===k?'selected':''}>${v}</option>`).join('')}
         </select></td></tr>`
      : `<td style="text-align:right">${a.action_text||'—'}</td><td>${STATUS_LABEL[a.status]||STATUS_LABEL.pending}</td></tr>`;
  }
  $('rpTable').innerHTML=html;
}

async function savePlan(){
  const subjId=$('rpSubject').value, examName=$('rpExam').value, goal=$('rpGoal').value.trim();
  const btn=$('rpSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    let planId=PLAN?.id;
    if(planId){
      await db.from('remedial_plans').update({goal:goal||null, updated_at:new Date().toISOString()}).eq('id',planId);
    }else{
      const {data,error}=await db.from('remedial_plans').insert({subject_id:subjId, exam_name:examName, goal:goal||null, created_by:S.ME.id}).select('id').single();
      if(error) throw error;
      planId=data.id; PLAN={id:planId};
    }
    const inputs=[...$('rpTable').querySelectorAll('input[data-row],select[data-row]')];
    const byRow={}; for(const inp of inputs){ byRow[inp.dataset.row] ??= {}; byRow[inp.dataset.row][inp.dataset.f]=inp.value; }
    for(const [rowKey,vals] of Object.entries(byRow)){
      const {error}=await db.from('remedial_plan_actions').upsert({
        plan_id:planId, row_key:rowKey, action_text:vals.action?.trim()||null, status:vals.status||'pending'
      },{onConflict:'plan_id,row_key'});
      if(error) throw error;
    }
    toast('تم حفظ الخطة');
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ الخطة'; }
}

/* ============ تصدير ============ */
const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const rpBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
function currentRowsData(){
  const rows=rowDef();
  return rows.map(r=>{
    const tr=$('rpTable').querySelector(`tr[data-row="${r.key}"]`);
    const counts=SECTIONS.map((s,i)=>tr?.children[i+1]?.textContent||'0');
    const actionEl=tr?.querySelector('[data-f="action"]');
    const statusEl=tr?.querySelector('[data-f="status"]');
    const action = actionEl ? actionEl.value : (tr?.children[SECTIONS.length+1]?.textContent||'');
    const status = statusEl ? statusEl.value : (Object.keys(STATUS_LABEL).find(k=>STATUS_LABEL[k]===tr?.children[SECTIONS.length+2]?.textContent) || 'pending');
    return {...r, counts, action: action==='—'?'':action, status};
  });
}
async function exportXls(){
  if(!SECTIONS.length){ toast('حمّلي البيانات أولاً'); return; }
  const subjCode=$('rpSubject').selectedOptions[0]?.textContent||'', examName=$('rpExam').value, goal=$('rpGoal').value.trim();
  const rows=currentRowsData();
  const cols=1+SECTIONS.length+2;
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('التغذية الراجعة',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,cols);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle(`استمارة التغذية الراجعة — ${subjCode} — ${examName}`,12,true,null,'FF22303C');
  if(goal) addTitle(`الهدف الخاص: ${goal}`,10,false,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['الفئة',...SECTIONS.map(s=>s.code),'الإجراء','متابعة التنفيذ']);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=rpBorder; });
  rows.forEach((r,i)=>{
    const row=ws.addRow([r.label,...r.counts,r.action,STATUS_LABEL[r.status]||r.status]);
    row.eachCell((c,colNo)=>{ c.border=rpBorder; c.alignment={horizontal:colNo===1?'right':'center'}; c.font={size:10.5};
      if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
  });
  ws.columns=[{width:16},...SECTIONS.map(()=>({width:10})),{width:30},{width:14}];
  ws.views=[{rightToLeft:true,state:'frozen',ySplit: goal?5:4}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`التغذية_الراجعة_${subjCode}_${examName}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}
function exportPdf(){
  if(!SECTIONS.length){ toast('حمّلي البيانات أولاً'); return; }
  const subjCode=$('rpSubject').selectedOptions[0]?.textContent||'', examName=$('rpExam').value, goal=$('rpGoal').value.trim();
  const rows=currentRowsData();
  const trs=rows.map(r=>`<tr><td>${r.label}</td>${r.counts.map(c=>`<td>${c}</td>`).join('')}<td>${r.action||'—'}</td><td>${STATUS_LABEL[r.status]||r.status}</td></tr>`).join('');
  $('printAreaRP').innerHTML=`
    <div class="rp-head"><h2>استمارة التغذية الراجعة — ${subjCode} — ${examName}</h2>${goal?`<p>الهدف الخاص: ${goal}</p>`:''}</div>
    <table class="rp-print-tbl"><tr><th>الفئة</th>${SECTIONS.map(s=>`<th>${s.code}</th>`).join('')}<th>الإجراء</th><th>متابعة التنفيذ</th></tr>${trs}</table>`;
  printWithTitle(`التغذية_الراجعة_${subjCode}_${examName}`);
}

registerTab({id:'rpMain', label:'استمارة التغذية الراجعة', group:'grades', groupLabel:'الدرجات',
  show:f=>f.isAdmin||f.isLead||f.isAnalysis||f.isSeniorTeacher, init:initRP});
