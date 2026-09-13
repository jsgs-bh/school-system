/* data-reset.js — أداتان إداريتان: (١) مسح بيانات وحدة معيّنة، (٢) تنزيل
   نسخة احتياطية كاملة (Excel، جدول لكل جدول بقاعدة البيانات) — تُحفظ
   بمكان خارج الموقع (قوقل درايف مثلاً) لو صارت أي مشكلة بجت-هب أو
   Supabase. */
import { db, $, S, toast, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="dataReset" style="display:none">
  <div class="panel">
    <h3>نسخة احتياطية</h3>
    <div class="sub">تنزيل نسخة كاملة من كل بيانات النظام بملف إكسل واحد (جدول بيانات لكل قسم). احفظيه بمكان خارج الموقع (قوقل درايف مثلاً) بشكل دوري — لو صارت أي مشكلة بجت-هب أو بقاعدة البيانات تقدرين ترجعين لأي نقطة حفظتيها.</div>
    <button class="btn gold" id="bkGo" style="width:auto;padding:11px 26px;margin-top:10px">⬇️ تنزيل نسخة احتياطية كاملة</button>
    <div id="bkProgress" style="display:none;margin-top:12px">
      <div style="background:var(--sand);border-radius:8px;height:8px;overflow:hidden"><div id="bkBar" style="background:var(--gold);height:100%;width:0%;transition:width .2s"></div></div>
      <div class="sub" id="bkStep" style="margin-top:6px"></div>
    </div>
  </div>

  <div class="panel">
    <h3>إعادة تعيين البيانات</h3>
    <div class="sub">مسح نهائي لبيانات وحدة معيّنة — يُستخدم لتصفير بيانات تجريبية قبل بدء التفعيل الفعلي. هذا الإجراء لا يترجع. (ننصح بتنزيل نسخة احتياطية فوق أولاً.)</div>
    <div id="drList" style="margin-top:16px"></div>
  </div>
</div>
<style>
  .dr-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
  .dr-card b{display:block;color:var(--navy);font-size:14.5px;margin-bottom:3px}
  .dr-card span{font-size:12.5px;color:#6b7683}
</style>`);

/* كل جداول قاعدة البيانات — جدول إكسل واحد لكل واحد منها. */
const BACKUP_TABLES=['academic_years','absence_followup','announcement_dismissals','app_settings',
  'attendance_alerts','attendance_records','attendance_sessions','audit_log',
  'committee_beneficiary_projects','committee_members','committee_minutes','committee_tasks','committees',
  'compensatory_hours_requests','compensatory_hours_usage',
  'competency_items','competency_template_items','competency_templates','competition_announcements','complaints',
  'departments','enrollments','entry_teachers','event_participants','event_records','evidence_files',
  'exam_competencies','exams','excuse_log','file_templates','grade_categories','grade_notes','grade_records',
  'grade_settings','group_students','indicator_historical_values','late_log','pattern_periods',
  'plan_actions','plan_initiatives','plan_project_indicators','plan_project_subgoals','plan_projects',
  'remedial_plan_actions','remedial_plans','sections','settings','shared_files','staff','staff_project_leads',
  'staff_roles','strategic_domains','strategic_goals','strategic_indicators','strategic_programs',
  'strategic_standards','strategic_subgoals','student_talents','students','subjects','supervision_links',
  'talent_categories','talent_event_participants','talent_events','teaching_group_members',
  'teaching_group_teachers','teaching_groups','timetable_entries','timetable_patterns','underperformer_alerts',
  'violation_categories','violation_types','violations'];

async function fetchAllRows(table){
  let all=[], from=0, page=1000;
  while(true){
    const {data,error}=await db.from(table).select('*').range(from,from+page-1);
    if(error) throw new Error(`${table}: ${error.message}`);
    all=all.concat(data||[]);
    if(!data||data.length<page) break;
    from+=page;
  }
  return all;
}

function bindBackupBtn(){
  if($('bkGo').dataset.ready) return;
  $('bkGo').dataset.ready='1';
  $('bkGo').addEventListener('click', async ()=>{
    const btn=$('bkGo'); btn.disabled=true;
    $('bkProgress').style.display='block';
    try{
      const wb=new ExcelJS.Workbook();
      for(let i=0;i<BACKUP_TABLES.length;i++){
        const t=BACKUP_TABLES[i];
        $('bkStep').textContent=`جارٍ تصدير: ${t} (${i+1}/${BACKUP_TABLES.length})`;
        $('bkBar').style.width=Math.round((i/BACKUP_TABLES.length)*100)+'%';
        let rows=[];
        try{ rows=await fetchAllRows(t); }catch(e){ rows=[]; }
        const ws=wb.addWorksheet(t.slice(0,31),{views:[{rightToLeft:true}]});
        if(rows.length){
          const cols=Object.keys(rows[0]);
          ws.addRow(cols).eachCell(c=>{ c.font={bold:true}; });
          rows.forEach(r=>ws.addRow(cols.map(c=>{
            const v=r[c];
            return (v!==null && typeof v==='object') ? JSON.stringify(v) : v;
          })));
        } else {
          ws.addRow(['لا بيانات']);
        }
      }
      $('bkStep').textContent='جارٍ إنشاء الملف…'; $('bkBar').style.width='100%';
      const buf=await wb.xlsx.writeBuffer();
      const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      const stamp=new Date().toISOString().slice(0,10);
      a.href=url; a.download=`نسخة_احتياطية_${stamp}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast('تم تنزيل النسخة الاحتياطية — ارفعيها لقوقل درايف الآن');
    }catch(err){ toast('تعذر إنشاء النسخة: '+(err.message||err)); }
    finally{ btn.disabled=false; $('bkProgress').style.display='none'; }
  });
}

/* عشان نضيف وحدة جديدة تُمسح لاحقاً، ضيفي عنصر هنا بس — ما يحتاج بناء
   شاشة جديدة كل مرة. */
const RESET_MODULES=[
  {
    key:'violations',
    title:'المخالفات السلوكية',
    desc:'يمسح كل المخالفات المسجَّلة لكل الطالبات. ما يمسح فئات وأنواع المخالفات نفسها (تبقى بالإعدادات).',
    run: async ()=>{ const {error}=await db.from('violations').delete().not('id','is',null); if(error) throw error; }
  },
];

async function initDataReset(){
  bindBackupBtn();
  if($('drList').dataset.ready) return;
  $('drList').dataset.ready='1';
  $('drList').innerHTML=RESET_MODULES.map(m=>`
    <div class="dr-card">
      <div><b>${m.title}</b><span>${m.desc}</span></div>
      <button class="btn ghost" data-reset="${m.key}" style="width:auto;padding:10px 20px;border-color:var(--err);color:var(--err)">🗑️ مسح البيانات</button>
    </div>`).join('');
  $('drList').querySelectorAll('[data-reset]').forEach(btn=>btn.addEventListener('click', async ()=>{
    const mod=RESET_MODULES.find(m=>m.key===btn.dataset.reset);
    if(!confirm(`متأكدة تبين تمسحين "${mod.title}" نهائياً؟ هذا الإجراء ما يترجع.`)) return;
    const typed=prompt('اكتبي كلمة "مسح" بالضبط للتأكيد:');
    if(typed!=='مسح'){ toast('ما تطابقت الكلمة — أُلغي المسح.'); return; }
    btn.disabled=true; btn.textContent='جارٍ المسح…';
    try{
      await mod.run();
      toast(`تم مسح "${mod.title}" بالكامل.`);
    }catch(err){ toast('تعذر المسح: '+(err.message||err)); }
    finally{ btn.disabled=false; btn.textContent='🗑️ مسح البيانات'; }
  }));
}

registerTab({id:'dataReset', label:'إعادة تعيين البيانات', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initDataReset});
