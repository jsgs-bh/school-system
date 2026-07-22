/* strategic-tree.js — الشجرة الاستراتيجية (تحت مجموعة "الخطة الاستراتيجية")
   عرض للمراجعة: مجال ← برنامج ← هدف استراتيجي ← معيار ← مؤشر ← هدف
   فرعي. مستخرجة من صورة الخريطة الاستراتيجية الرسمية — راجعيها هنا
   وقارنيها بالأصل قبل ما نربط المشاريع بالأهداف الفرعية. */
import { db, $, S, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="strategicTree" style="display:none">
  <div class="warnbox">هذي البيانات مستخرجة من قراءة صورة الخريطة الاستراتيجية — راجعيها وقارنيها بالأصل، وأخبرينا بأي تصحيح قبل ما نربط المشاريع بالأهداف الفرعية.</div>
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

async function initTree(){
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
