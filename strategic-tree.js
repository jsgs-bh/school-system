/* strategic-tree.js — الشجرة الاستراتيجية (تحت مجموعة "الخطة الاستراتيجية")
   عرض للمراجعة: مجال ← برنامج ← هدف استراتيجي ← معيار ← مؤشر ← هدف
   فرعي. مستخرجة من صورة الخريطة الاستراتيجية الرسمية — راجعيها هنا
   وقارنيها بالأصل قبل ما نربط المشاريع بالأهداف الفرعية. */
import { db, $, S, clean, toast, bindDrop, readSheet, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="strategicTree" style="display:none">
  <div class="warnbox">هذي البيانات مستخرجة من قراءة صورة الخريطة الاستراتيجية — راجعيها وقارنيها بالأصل، وأخبرينا بأي تصحيح قبل ما نربط المشاريع بالأهداف الفرعية.</div>

  <div class="panel" id="stiPanel" style="display:none">
    <h3>استيراد المبادرات الأساسية (الخطة الاستراتيجية)</h3>
    <div class="sub">ملف بعمودين: اسم المشروع (لازم يطابق اسم مشروع موجود بالضبط) + اسم المبادرة. كل مبادرة تُعلَّم تلقائياً "استراتيجية" — ما تظهر لرئيسة المشروع، تظهر بس لك وللقيادة العليا.</div>
    <div class="dropzone" id="stiDrop"><b id="stiFileLabel">اختاري ملف الإكسل</b><p>اضغطي لاختيار الملف أو اسحبيه هنا</p><input type="file" id="stiFile" hidden accept=".xlsx,.xls"></div>
    <button class="btn ghost" id="stiTpl" style="width:auto;padding:8px 16px;margin-top:8px">⬇️ تنزيل قالب فاضي</button>
    <div id="stiPreview" style="display:none;margin-top:14px">
      <div class="stats"><div class="stat"><b id="stiPv1">0</b><span>مبادرة صالحة</span></div><div class="stat"><b id="stiPv2">0</b><span>مشاريع غير موجودة</span></div></div>
      <div id="stiWarns"></div>
      <button class="btn gold" id="stiRun" style="width:auto;padding:10px 24px">تأكيد الاستيراد</button>
    </div>
    <div id="stiResult" class="result" style="display:none"></div>
  </div>

  <div id="stTree"></div>
</div>
<style>
  #strategicTree.wide{max-width:1300px}
  .st-domain{background:#1a3a6b;color:#fff;padding:12px 18px;border-radius:10px;font-weight:700;font-size:15px;margin:18px 0 10px}
  .st-program{background:#eef1f5;color:var(--navy);padding:8px 16px;border-radius:8px;font-weight:700;font-size:13px;margin-bottom:8px;display:inline-block}
  .st-goal{background:var(--sand);border-right:3px solid var(--gold);padding:8px 14px;border-radius:6px;font-weight:700;font-size:13px;margin:10px 0 6px}
  .st-standard{padding:6px 14px 6px 20px;font-weight:600;font-size:12.5px;color:var(--navy)}
  .st-indicator{padding:4px 14px 4px 34px;font-size:12px;color:#555}
  .st-subgoal{padding:3px 14px 3px 48px;font-size:12px;color:#333;position:relative}
  .st-subgoal::before{content:"–";position:absolute;right:38px}
</style>`);

const STI_HEAD=['اسم المشروع','اسم المبادرة'];
let STI=null;

async function initStrategicImport(){
  if(!(S.FLAGS.isAdmin||S.FLAGS.isStrategicPlanLead)) return;
  $('stiPanel').style.display='block';
  if($('stiDrop').dataset.ready) return;
  $('stiDrop').dataset.ready='1';

  $('stiTpl').addEventListener('click', async ()=>{
    const {data:projects}=await db.from('plan_projects').select('name').eq('academic_year_id',S.YEAR.id).order('sort_order');
    const ws=XLSX.utils.aoa_to_sheet([STI_HEAD, [projects?.[0]?.name||'بإتقاني أرتقي','مبادرة أساسية مثال']]);
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'المبادرات');
    XLSX.writeFile(wb,'قالب_المبادرات_الأساسية.xlsx');
  });

  bindDrop($('stiDrop'),$('stiFile'), async file=>{
    $('stiFileLabel').textContent=file.name;
    const rows=await readSheet(file);
    if(!rows.length){ toast('الملف فاضي'); return; }
    const head=rows[0].map(clean);
    const colProj=head.findIndex(h=>/مشروع/.test(h));
    const colInit=head.findIndex(h=>/مبادرة/.test(h));
    if(colProj<0||colInit<0){ toast('الملف لازم يحتوي عمودي "اسم المشروع" و"اسم المبادرة".'); return; }
    const {data:projects}=await db.from('plan_projects').select('id,name').eq('academic_year_id',S.YEAR.id);
    const projBy=Object.fromEntries((projects||[]).map(p=>[p.name.trim(),p]));
    const valid=[], missing=new Set();
    for(let i=1;i<rows.length;i++){
      const r=rows[i]; const projName=clean(r[colProj]); const initName=clean(r[colInit]);
      if(!projName&&!initName) continue;
      const proj=projBy[projName];
      if(!proj){ missing.add(projName); continue; }
      if(!initName) continue;
      valid.push({project_id:proj.id, name:initName});
    }
    STI={valid};
    $('stiPv1').textContent=valid.length; $('stiPv2').textContent=missing.size;
    $('stiWarns').innerHTML = missing.size ? `<div class="warnbox">مشاريع غير موجودة بالضبط: ${[...missing].map(m=>'«'+m+'»').join('، ')}</div>` : '';
    $('stiPreview').style.display='block';
  });

  $('stiRun').addEventListener('click', async ()=>{
    if(!STI?.valid?.length){ toast('لا مبادرات صالحة'); return; }
    const btn=$('stiRun'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
    try{
      const rows=STI.valid.map(v=>({project_id:v.project_id, name:v.name, is_strategic:true, created_by:S.ME.id}));
      const {error}=await db.from('plan_initiatives').insert(rows);
      if(error) throw error;
      $('stiResult').style.display='block';
      $('stiResult').innerHTML=`✅ تم استيراد ${rows.length} مبادرة أساسية بنجاح.`;
      toast('تم الحفظ');
    }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
    finally{ btn.disabled=false; btn.textContent='تأكيد الاستيراد'; }
  });
}

async function initTree(){
  await initStrategicImport();
  if($('stTree').dataset.ready) return;
  $('stTree').dataset.ready='1';
  const {data:domains}=await db.from('strategic_domains').select('id,name,sort_order').eq('academic_year_id',S.YEAR.id).order('sort_order');
  if(!domains?.length){ $('stTree').innerHTML='<div class="empty-day">لا توجد بيانات — نفّذي ملفات SQL الشجرة الاستراتيجية أولاً.</div>'; return; }

  let html='';
  for(const d of domains){
    html+=`<div class="st-domain">${d.name}</div>`;
    const {data:programs}=await db.from('strategic_programs').select('id,name').eq('domain_id',d.id).order('sort_order');
    for(const p of programs||[]){
      html+=`<div class="st-program">📋 ${p.name}</div>`;
      const {data:goals}=await db.from('strategic_goals').select('id,name').eq('program_id',p.id).order('sort_order');
      for(const g of goals||[]){
        html+=`<div class="st-goal">🎯 ${g.name}</div>`;
        const {data:standards}=await db.from('strategic_standards').select('id,name').eq('goal_id',g.id).order('sort_order');
        for(const st of standards||[]){
          html+=`<div class="st-standard">معيار: ${st.name}</div>`;
          const {data:indicators}=await db.from('strategic_indicators').select('id,name').eq('standard_id',st.id).order('sort_order');
          for(const ind of indicators||[]){
            html+=`<div class="st-indicator">مؤشر: ${ind.name}</div>`;
            const {data:subgoals}=await db.from('strategic_subgoals').select('id,name').eq('indicator_id',ind.id).order('sort_order');
            for(const sg of subgoals||[]){
              html+=`<div class="st-subgoal">${sg.name}</div>`;
            }
          }
        }
      }
    }
  }
  $('stTree').innerHTML=html;
}

registerTab({id:'strategicTree', label:'الشجرة الاستراتيجية', group:'plan', groupLabel:'الخطة الاستراتيجية',
  show:f=>f.isAdmin||f.isLead||f.isStrategicPlanLead, init:initTree});
