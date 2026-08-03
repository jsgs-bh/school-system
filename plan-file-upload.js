/* plan-file-upload.js — رفع ملف الخطة (تبويب مستقل تحت "الخطة الاستراتيجية")
   ملف إكسل بأربعة/خمسة أعمدة: المشروع — المبادرة — الإجراء — الشهر —
   المسؤول (اختياري). يُنشئ المشاريع والمبادرات تلقائياً ويربطها بالسنة
   النشطة، ويربط المشروع تلقائياً بسلسلته لو فيه بنفس الاسم بسنة سابقة. */
import { db, $, S, toast, bindDrop, readSheet, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="planFileUpload" style="display:none">
  <div class="panel">
    <h3>رفع ملف الخطة (بداية العام الدراسي أو الفصل)</h3>
    <div class="sub">ملف إكسل بأربعة أعمدة بهذا الترتيب: <b>المشروع</b> — <b>المبادرة</b> — <b>الإجراء</b> — <b>الشهر</b> (بالعربي: سبتمبر..يونيو) — <b>المسؤول</b> (اختياري). كل سطر = إجراء واحد. المشاريع والمبادرات تُنشأ تلقائياً لو ما كانت موجودة، وتُربط بالسنة الدراسية النشطة، والمشاريع تنضم تلقائياً لسلسلتها لو فيه مشروع بنفس الاسم بسنة سابقة.</div>
    <div class="dropzone" id="pfuDrop"><b id="pfuFileLabel">اسحبي ملف الإكسل هنا أو اضغطي للاختيار</b><p>xlsx أو xls</p>
      <input type="file" id="pfuFile" accept=".xlsx,.xls" hidden></div>
    <button class="btn gold" id="pfuImportBtn" style="width:auto;padding:9px 20px;margin-top:10px" disabled>استيراد الملف</button>
    <div id="pfuStatus" style="display:none;margin-top:12px"></div>
  </div>
</div>`);

const AR_MONTH_MAP={
  'سبتمبر':'sep','أكتوبر':'oct','اكتوبر':'oct','نوفمبر':'nov','ديسمبر':'dec','يناير':'jan',
  'فبراير':'feb','مارس':'mar','أبريل':'apr','ابريل':'apr','مايو':'may','يونيو':'jun',
};

let planFile=null;

async function initPlanFileUpload(){
  if($('pfuImportBtn').dataset.ready) return;
  $('pfuImportBtn').dataset.ready='1';
  bindDrop($('pfuDrop'),$('pfuFile'), f=>{ planFile=f; $('pfuFileLabel').textContent=`الملف: ${f.name}`; $('pfuImportBtn').disabled=false; });
  $('pfuImportBtn').addEventListener('click', ()=>importPlanFile(planFile));
}

async function importPlanFile(file){
  if(!file){ toast('اختاري ملفاً أولاً'); return; }
  const status=$('pfuStatus'); status.style.display='block'; status.className='result';
  status.textContent='جارٍ قراءة الملف…';
  const btn=$('pfuImportBtn'); btn.disabled=true;
  try{
    const rows=await readSheet(file);
    const dataRows=rows.slice(1).filter(r=>r.some(c=>String(c||'').trim()));
    if(!dataRows.length){ status.className='result err'; status.textContent='الملف فاضٍ أو بلا بيانات.'; return; }

    const warns=[];
    const parsed=[];
    dataRows.forEach((r,i)=>{
      const [projName,initName,actionText,monthRaw,resp]=r.map(c=>String(c||'').trim());
      if(!projName||!initName||!actionText){ warns.push(`سطر ${i+2}: ناقص (مشروع/مبادرة/إجراء)`); return; }
      const month=AR_MONTH_MAP[monthRaw];
      if(!month){ warns.push(`سطر ${i+2}: اسم شهر غير معروف "${monthRaw}"`); return; }
      parsed.push({projName,initName,actionText,month,resp:resp||null});
    });
    if(!parsed.length){ status.className='result err'; status.textContent='لا صفوف صالحة للاستيراد. راجعي التنبيهات: '+warns.join(' | '); return; }

    status.textContent='جارٍ إنشاء المشاريع…';
    const projectIdByName={};
    for(const pName of [...new Set(parsed.map(p=>p.projName))]){
      const {data:existingThisYear}=await db.from('plan_projects').select('id').eq('academic_year_id',S.YEAR.id).eq('name',pName).maybeSingle();
      if(existingThisYear){ projectIdByName[pName]=existingThisYear.id; continue; }
      const {data:existingPrev}=await db.from('plan_projects').select('chain_id').eq('name',pName).not('chain_id','is',null).limit(1).maybeSingle();
      const chainId=existingPrev?.chain_id || crypto.randomUUID();
      const {data:created,error}=await db.from('plan_projects').insert({academic_year_id:S.YEAR.id, name:pName, sort_order:999, chain_id:chainId}).select('id').single();
      if(error){ warns.push(`تعذر إنشاء مشروع "${pName}": ${error.message}`); continue; }
      projectIdByName[pName]=created.id;
    }

    status.textContent='جارٍ إنشاء المبادرات…';
    const initIdByKey={};
    const uniqueInitPairs=[...new Set(parsed.map(p=>`${p.projName}|||${p.initName}`))].map(k=>k.split('|||'));
    for(const [projName,initName] of uniqueInitPairs){
      const projectId=projectIdByName[projName];
      if(!projectId) continue;
      const {data:existing}=await db.from('plan_initiatives').select('id').eq('project_id',projectId).eq('name',initName).maybeSingle();
      if(existing){ initIdByKey[`${projName}|||${initName}`]=existing.id; continue; }
      const {data:created,error}=await db.from('plan_initiatives').insert({project_id:projectId, name:initName, created_by:S.ME.id}).select('id').single();
      if(error){ warns.push(`تعذر إنشاء مبادرة "${initName}": ${error.message}`); continue; }
      initIdByKey[`${projName}|||${initName}`]=created.id;
    }

    status.textContent='جارٍ إضافة الإجراءات…';
    const actionRows=parsed.map(p=>{
      const initId=initIdByKey[`${p.projName}|||${p.initName}`];
      if(!initId) return null;
      return {initiative_id:initId, text:p.actionText, responsible:p.resp, month:p.month, status:'not_started', created_by:S.ME.id};
    }).filter(Boolean);
    if(actionRows.length){
      const {error}=await db.from('plan_actions').insert(actionRows);
      if(error){ warns.push('تعذر حفظ بعض الإجراءات: '+error.message); }
    }

    status.className = warns.length ? 'result' : 'result ok';
    status.innerHTML = `✅ تم استيراد ${actionRows.length} إجراء ضمن ${Object.keys(projectIdByName).length} مشروع للسنة ${S.YEAR.name}.`
      + (warns.length ? `<br>⚠️ ${warns.length} تنبيه:<br>`+warns.slice(0,20).join('<br>') : '');
    toast('تم الاستيراد');
  }catch(err){
    status.className='result err'; status.textContent='خطأ غير متوقع: '+(err.message||err);
  }finally{ btn.disabled=false; }
}

registerTab({id:'planFileUpload', label:'رفع ملف الخطة', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:f=>f.isAdmin, init:initPlanFileUpload});
