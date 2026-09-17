/* system-alerts.js — تنبيهات تلقائية تُفحص عند كل دخول (ما فيه خادم خلفي
   يشتغل بالساعة، فالفحص يصير كل مرة توصل فيها المستخدمة للموقع):
   ١) حصة انتهى وقتها ولسا ما رُصد غيابها.
   ٢) مسابقة شاركت فيها المعلمة ومرّ وقت تنفيذها بدون رفع المركز.
   ٣) إجراء بالخطة التدفقية له تاريخ محدَّد — تذكير قبله بـ٣ أيام، يوم
      تنفيذه، وبعده بـ٣ أيام لو لسا ما اكتمل.
   كل تنبيه يُنشأ كإعلان نظامي (بنفس آلية "الإعلانات") بمفتاح مميَّز
   يمنع تكراره، ويطلع كنافذة منبثقة فوراً ثم يبقى بتبويب "الإعلانات". */
import { db, S, registerBackgroundTask } from './core.js';
import { refreshPopupQueue } from './announcements.js';

const todayStr = () => new Date().toISOString().slice(0,10);

async function createSystemAlert(dedup_key, title, body){
  const {data:existing}=await db.from('announcements').select('id').eq('dedup_key',dedup_key).maybeSingle();
  if(existing) return false;
  const {data:ann,error}=await db.from('announcements').insert({
    title, body, target_type:'staff', dedup_key,
  }).select('id').single();
  if(error){
    if(error.code==='23505') return false; // تعارض تفرّد — إعلان بنفس المفتاح انسبق إنشاؤه بالتوازي
    console.error('createSystemAlert failed', error); return false;
  }
  const {error:e2}=await db.from('announcement_recipients').insert({announcement_id:ann.id, staff_id:S.ME.id});
  if(e2) console.error('createSystemAlert recipient failed', e2);
  return true;
}

/* ============ ١) حصص انتهى وقتها بدون رصد غياب ============ */
async function checkMissingAttendance(){
  if(!(S.FLAGS.isTeacher||S.FLAGS.isSeniorTeacher)) return;
  const now=new Date(), jsDay=now.getDay();
  if(jsDay>4) return; // عطلة نهاية أسبوع — لا حصص
  const dow=jsDay+1;
  const nowHM=now.toTimeString().slice(0,5);
  const {data:rows}=await db.from('entry_teachers')
    .select('timetable_entries!inner(id,period_no,day_of_week,is_current,academic_year_id,sections(code),subjects(code))')
    .eq('staff_id',S.ME.id).eq('timetable_entries.day_of_week',dow).eq('timetable_entries.is_meeting',false)
    .eq('timetable_entries.is_current',true).eq('timetable_entries.academic_year_id',S.YEAR.id);
  const entries=(rows||[]).map(r=>r.timetable_entries).filter(Boolean);
  if(!entries.length) return;

  const overdue=entries.filter(e=>{
    const p=S.PERIODS.find(x=>x.period_no===e.period_no);
    return p && nowHM>p.end_time.slice(0,5);
  });
  if(!overdue.length) return;

  const today=todayStr();
  const {data:sessions}=await db.from('attendance_sessions').select('entry_id').eq('date',today).in('entry_id',overdue.map(e=>e.id));
  const doneIds=new Set((sessions||[]).map(s=>s.entry_id));
  for(const e of overdue){
    if(doneIds.has(e.id)) continue;
    await createSystemAlert(
      `attendance:${e.id}:${today}`,
      'حصة لم يُرصد غيابها',
      `انتهى وقت حصة ${e.subjects?.code||''} — شعبة ${e.sections?.code||''} (الحصة ${e.period_no}) اليوم بدون رصد غياب. يُرجى رصدها من "حصصي" في أقرب وقت.`
    );
  }
}

/* ============ ٢) مسابقات بدون رفع نتيجة ============ */
async function checkPendingCompetitions(){
  if(!(S.FLAGS.isTeacher||S.FLAGS.isSeniorTeacher)) return;
  const {data:events}=await db.from('event_records')
    .select('id,title,execution_date').eq('staff_id',S.ME.id).not('announcement_id','is',null)
    .is('result',null).lt('execution_date',todayStr());
  for(const e of events||[]){
    await createSystemAlert(
      `competition:${e.id}`,
      'مسابقة بانتظار رفع النتيجة',
      `مرّ تاريخ تنفيذ مسابقة "${e.title}" (${e.execution_date}) ولسا ما رفعتِ المركز/النتيجة. يُرجى تحديثها من "فعاليات".`
    );
  }
}

/* ============ ٣) إجراءات الخطة التدفقية بتاريخ محدَّد ============ */
function addDays(dateStr, n){
  const d=new Date(dateStr+'T00:00:00'); d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}
async function checkPlanActionDates(){
  const today=todayStr();
  const before=addDays(today,3);   // إجراءات تاريخها بعد ٣ أيام من اليوم → تذكير "قبل"
  const after=addDays(today,-3);   // إجراءات تاريخها قبل ٣ أيام من اليوم → تذكير "بعد"
  const {data:actions}=await db.from('plan_actions')
    .select('id,text,due_date,status').eq('responsible_staff_id',S.ME.id).not('due_date','is',null)
    .in('due_date',[before,today,after]);
  for(const a of actions||[]){
    if(a.status==='done') continue;
    let phase, msg;
    if(a.due_date===before){ phase='before'; msg=`يقترب موعد تنفيذ إجراء "${a.text}" (بعد ٣ أيام — ${a.due_date}).`; }
    else if(a.due_date===today){ phase='on'; msg=`اليوم هو موعد تنفيذ إجراء "${a.text}".`; }
    else { phase='after'; msg=`مرّ ٣ أيام على موعد إجراء "${a.text}" (${a.due_date}) ولسا حالته غير مكتملة. يُرجى تحديثها.`; }
    await createSystemAlert(`plan_action:${a.id}:${phase}`, 'تذكير بإجراء من الخطة التدفقية', msg);
  }
}

async function runAllChecks(){
  if(!S.ME) return;
  await checkMissingAttendance();
  await checkPendingCompetitions();
  await checkPlanActionDates();
  await refreshPopupQueue();
}

registerBackgroundTask(runAllChecks);
