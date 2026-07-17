/* promotion.js — الترحيل بين الفصول والسنوات (تحت "الإعدادات")
   يعتمد على ترميز الشعب المعتمد: الرقم الأول = المستوى×الفصل
   (الأول: 1 ثم 2 / الثاني: 3 ثم 4 / الثالث: 5 ثم 6)، يليه التخصص، ثم
   رقم الشعبة. مثال: 1وحد3 (مستوى1 فصل1) ↔ 2وحد3 (مستوى1 فصل2).
   - ترحيل الفصل: نسخ توزيع الطالبات من شعب الفصل الأول لمثيلاتها في
     الفصل الثاني (نفس السنة)، مع إبقاء المجال مفتوحاً للتعديل اليدوي.
   - ترحيل المستوى الثاني إلى الثالث: لسنة هدف يحددها الأدمن (عادة
     السنة القادمة)، بزر واحد.
   - تخريج المستوى الثالث: تحويل حالة طالبات المستوى الثالث الحاليات
     إلى «متخرجة» وإغلاق قيدهن.
   المستوى الأول إلى الثاني بين السنوات لا يُؤتمت — يحتاج ملف توزيع
   جديد (استيراد عادي) حسب الوثيقة المعتمدة. */
import { db, $, S, dstr, toast, logAction, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="promotion" style="display:none">
  <div class="warnbox">كل عملية ترحيل هنا لا تحذف أي بيانات — تُنشئ سجلات تسجيل جديدة وتُغلق القديمة بتاريخ، فالتاريخ الكامل يبقى محفوظاً.</div>

  <div class="panel">
    <h3>ترحيل الفصل (داخل نفس السنة)</h3>
    <div class="sub">ينسخ توزيع الطالبات الحالي من شعب الفصل الأول إلى مثيلاتها بالفصل الثاني (تُنشأ تلقائياً لو غير موجودة). بعدها تقدرين تعدّلين الحالات القليلة يدوياً من "نقل طالبة بين الشعب".</div>
    <div class="result" id="pmSemStatus" style="display:none"></div>
    <button class="btn gold" id="pmSemGo" style="width:auto;padding:11px 26px">ترحيل الفصل الأول → الثاني</button>
  </div>

  <div class="panel">
    <h3>ترحيل المستوى الثاني إلى الثالث</h3>
    <div class="sub">لسنة هدف تختارينها (عادة السنة الدراسية القادمة) — ينشئ شعب المستوى الثالث المطابقة تلقائياً (نفس التخصص ورقم الشعبة) ويسجّل الطالبات فيها.</div>
    <select id="pmYearPick" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:200px;margin-bottom:12px"></select>
    <div class="result" id="pmYearStatus" style="display:none"></div>
    <button class="btn gold" id="pmYearGo" style="width:auto;padding:11px 26px">ترحيل المستوى الثاني → الثالث</button>
  </div>

  <div class="panel">
    <h3>تخريج المستوى الثالث</h3>
    <div class="sub">يحوّل حالة كل طالبات المستوى الثالث الحاليات إلى "متخرجة" ويُغلق قيدهن — نهاية مسارهن الدراسي بالمدرسة.</div>
    <div class="result" id="pmGradStatus" style="display:none"></div>
    <button class="btn ghost" id="pmGradGo" style="width:auto;padding:11px 26px;border-color:var(--err);color:var(--err)">تخريج طالبات المستوى الثالث</button>
  </div>
</div>`);

function parseCode(code){
  const m=/^(\d)(\D+)(\d+)$/.exec(code||'');
  if(!m) return null;
  return {digit:+m[1], track:m[2], num:m[3]};
}
const siblingDigit=d=> d%2===1 ? d+1 : d-1;

async function initPromotion(){
  if($('pmSemGo').dataset.ready) return;
  $('pmSemGo').dataset.ready='1';
  $('pmSemGo').addEventListener('click',runSemesterPromotion);
  $('pmYearGo').addEventListener('click',runYearPromotion);
  $('pmGradGo').addEventListener('click',runGraduation);

  const {data:years}=await db.from('academic_years').select('id,name').order('start_date',{ascending:false});
  const others=(years||[]).filter(y=>y.id!==S.YEAR?.id);
  $('pmYearPick').innerHTML=others.map(y=>`<option value="${y.id}">${y.name}</option>`).join('') || '<option value="">لا سنوات أخرى بعد</option>';
}

/* ============ ترحيل الفصل (نفس السنة) ============ */
async function runSemesterPromotion(){
  if(!S.YEAR){ toast('لا سنة دراسية نشطة'); return; }
  if(!confirm('ترحيل كل شعب الفصل الأول إلى الفصل الثاني الآن؟')) return;
  const btn=$('pmSemGo'); btn.disabled=true; btn.textContent='جارٍ الترحيل…';
  $('pmSemStatus').style.display='block'; $('pmSemStatus').className='result';
  try{
    const {data:sections}=await db.from('sections').select('id,code,level,track,semester').eq('academic_year_id',S.YEAR.id);
    const bySemesterOdd=(sections||[]).filter(s=>{ const p=parseCode(s.code); return p && p.digit%2===1; });
    let createdSections=0, movedStudents=0, skipped=0;
    for(const sec of bySemesterOdd){
      const p=parseCode(sec.code);
      const targetDigit=siblingDigit(p.digit);
      const targetCode=`${targetDigit}${p.track}${p.num}`;
      let target=(sections||[]).find(s=>s.code===targetCode);
      if(!target){
        const {data:newSec,error}=await db.from('sections').insert({
          academic_year_id:S.YEAR.id, code:targetCode, level:sec.level, track:sec.track, semester:2
        }).select('id,code').single();
        if(error){ skipped++; continue; }
        target=newSec; createdSections++;
      }
      const {data:enr}=await db.from('enrollments').select('id,student_id').eq('section_id',sec.id).is('to_date',null);
      for(const e of enr||[]){
        const {data:already}=await db.from('enrollments').select('id').eq('section_id',target.id).eq('student_id',e.student_id).is('to_date',null).maybeSingle();
        if(already) continue;
        await db.from('enrollments').insert({section_id:target.id, student_id:e.student_id, from_date:dstr(new Date())});
        await db.from('enrollments').update({to_date:dstr(new Date())}).eq('id',e.id);
        movedStudents++;
      }
    }
    await logAction('promotion','sections',{type:'semester', createdSections, movedStudents, year:S.YEAR.name});
    $('pmSemStatus').className='result ok';
    $('pmSemStatus').textContent=`✅ تم — ${createdSections} شعبة جديدة، ${movedStudents} طالبة انتقلت${skipped?`، تعذّر إنشاء ${skipped} شعبة`:''}.`;
  }catch(err){ $('pmSemStatus').className='result err'; $('pmSemStatus').textContent='تعذر الترحيل: '+(err.message||err); }
  finally{ btn.disabled=false; btn.textContent='ترحيل الفصل الأول → الثاني'; }
}

/* ============ ترحيل المستوى الثاني إلى الثالث ============ */
async function runYearPromotion(){
  const targetYearId=$('pmYearPick').value;
  if(!targetYearId){ toast('اختاري سنة هدف'); return; }
  if(!S.YEAR){ toast('لا سنة دراسية نشطة'); return; }
  const targetYearName=$('pmYearPick').selectedOptions[0]?.textContent||'';
  if(!confirm(`ترحيل كل طالبات المستوى الثاني الحاليات إلى المستوى الثالث في سنة "${targetYearName}"؟`)) return;
  const btn=$('pmYearGo'); btn.disabled=true; btn.textContent='جارٍ الترحيل…';
  $('pmYearStatus').style.display='block'; $('pmYearStatus').className='result';
  try{
    const {data:sections}=await db.from('sections').select('id,code,level,track').eq('academic_year_id',S.YEAR.id);
    const level2=(sections||[]).filter(s=>{ const p=parseCode(s.code); return p && (p.digit===3||p.digit===4); });
    const {data:targetSections}=await db.from('sections').select('id,code').eq('academic_year_id',targetYearId);
    let createdSections=0, movedStudents=0;
    for(const sec of level2){
      const p=parseCode(sec.code);
      const targetDigit=p.digit+2; // 3→5 ، 4→6
      const targetCode=`${targetDigit}${p.track}${p.num}`;
      let target=(targetSections||[]).find(s=>s.code===targetCode);
      if(!target){
        const {data:newSec,error}=await db.from('sections').insert({
          academic_year_id:targetYearId, code:targetCode, level:3, track:sec.track, semester: targetDigit%2===1?1:2
        }).select('id,code').single();
        if(error) continue;
        target=newSec; targetSections.push(newSec); createdSections++;
      }
      const {data:enr}=await db.from('enrollments').select('id,student_id').eq('section_id',sec.id).is('to_date',null);
      for(const e of enr||[]){
        await db.from('enrollments').insert({section_id:target.id, student_id:e.student_id, from_date:dstr(new Date())});
        await db.from('enrollments').update({to_date:dstr(new Date())}).eq('id',e.id);
        movedStudents++;
      }
    }
    await logAction('promotion','sections',{type:'year_level2_to_3', createdSections, movedStudents, from:S.YEAR.name, to:targetYearName});
    $('pmYearStatus').className='result ok';
    $('pmYearStatus').textContent=`✅ تم — ${createdSections} شعبة جديدة في "${targetYearName}"، ${movedStudents} طالبة انتقلت للمستوى الثالث.`;
  }catch(err){ $('pmYearStatus').className='result err'; $('pmYearStatus').textContent='تعذر الترحيل: '+(err.message||err); }
  finally{ btn.disabled=false; btn.textContent='ترحيل المستوى الثاني → الثالث'; }
}

/* ============ تخريج المستوى الثالث ============ */
async function runGraduation(){
  if(!S.YEAR){ toast('لا سنة دراسية نشطة'); return; }
  if(!confirm('تخريج كل طالبات المستوى الثالث الحاليات؟ هذا الإجراء يُغلق قيدهن ويحوّل حالتهن إلى "متخرجة".')) return;
  const btn=$('pmGradGo'); btn.disabled=true; btn.textContent='جارٍ التخريج…';
  $('pmGradStatus').style.display='block'; $('pmGradStatus').className='result';
  try{
    const {data:sections}=await db.from('sections').select('id,code').eq('academic_year_id',S.YEAR.id);
    const level3=(sections||[]).filter(s=>{ const p=parseCode(s.code); return p && (p.digit===5||p.digit===6); });
    let graduated=0;
    for(const sec of level3){
      const {data:enr}=await db.from('enrollments').select('id,student_id').eq('section_id',sec.id).is('to_date',null);
      for(const e of enr||[]){
        await db.from('students').update({status:'graduated'}).eq('id',e.student_id);
        await db.from('enrollments').update({to_date:dstr(new Date())}).eq('id',e.id);
        graduated++;
      }
    }
    await logAction('graduation','students',{count:graduated, year:S.YEAR.name});
    $('pmGradStatus').className='result ok';
    $('pmGradStatus').textContent=`✅ تم تخريج ${graduated} طالبة.`;
  }catch(err){ $('pmGradStatus').className='result err'; $('pmGradStatus').textContent='تعذر التخريج: '+(err.message||err); }
  finally{ btn.disabled=false; btn.textContent='تخريج طالبات المستوى الثالث'; }
}

registerTab({id:'promotion', label:'الترحيل', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initPromotion});
