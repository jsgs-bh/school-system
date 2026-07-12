/* social.js — التأخير والاستئذان
   المنطق الجديد: التسجيل يُكتب في سجله الدائم فقط.
   رصد المعلمات لا يُلمس أبداً — والحالة الرسمية اليومية تُحسب لحظة العرض
   (في متابعة الرصد وقوائم الوزارة والتقارير) بدمج المصدرين. */
import { db, $, S, clean, dstr, toast, registerTab } from './core.js';

let SOC_DATE=new Date(), SOC_STU=null;

function initSocPick(){
  const sp=$('socPick');
  if(sp.dataset.ready) return;
  sp.dataset.ready='1';
  sp.value=dstr(SOC_DATE); sp.max=dstr(new Date());
  sp.addEventListener('change',()=>{ if(sp.value){ SOC_DATE=new Date(sp.value+'T12:00:00'); loadSocLists(); } });
  $('socTime').value=new Date().toTimeString().slice(0,5);
  let deb=null;
  $('socSearch').addEventListener('input',()=>{
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const q=clean($('socSearch').value);
      const box=$('socSugg');
      if(q.length<2){ box.style.display='none'; return; }
      const {data:st}=await db.from('students')
        .select('id,full_name,academic_number').eq('status','active')
        .or(`full_name.ilike.%${q}%,academic_number.ilike.%${q}%`).limit(8);
      if(!(st||[]).length){ box.style.display='none'; return; }
      box.innerHTML=(st||[]).map(s=>`<div data-id="${s.id}" data-n="${s.full_name}" data-a="${s.academic_number}">${s.full_name}<small>${s.academic_number}</small></div>`).join('');
      box.style.display='block';
      box.querySelectorAll('div').forEach(el=>el.addEventListener('click',()=>{
        SOC_STU={id:el.dataset.id, name:el.dataset.n, acad:el.dataset.a};
        $('socName').textContent=SOC_STU.name; $('socInfo').textContent=SOC_STU.acad;
        $('socPicked').style.display='block'; box.style.display='none';
        $('socSearch').value=''; $('socTime').value=new Date().toTimeString().slice(0,5);
      }));
    },300);
  });
  $('socSave').addEventListener('click',saveSoc);
}

async function saveSoc(){
  if(!SOC_STU){ toast('اختاري الطالبة أولاً'); return; }
  const type=$('socType').value, time=$('socTime').value, reason=clean($('socReason').value);
  if(!time){ toast('حددي الوقت'); return; }
  const btn=$('socSave'); btn.disabled=true;
  try{
    if(type==='late'){
      const {error}=await db.from('late_log').upsert(
        {student_id:SOC_STU.id, date:dstr(SOC_DATE), arrival_time:time, recorded_by:S.ME.id, note:reason||null},
        {onConflict:'student_id,date'});
      if(error) throw error;
    }else{
      const {error}=await db.from('excuse_log').upsert(
        {student_id:SOC_STU.id, date:dstr(SOC_DATE), exit_time:time, reason:reason||null, recorded_by:S.ME.id},
        {onConflict:'student_id,date'});
      if(error) throw error;
    }
    /* لا نعدّل attendance_records — رصد المعلمات حقيقة تاريخية،
       والحالة اليومية الرسمية تُحسب تلقائياً عند العرض. */
    await db.from('audit_log').insert({actor_id:S.ME.id, action:type, entity:type==='late'?'late_log':'excuse_log',
      details:{student:SOC_STU.name, date:dstr(SOC_DATE), time}});
    toast(type==='late'
      ? 'سُجل التأخير — ستُحتسب حاضرة في الغياب الرسمي اليومي تلقائياً'
      : 'سُجل الاستئذان — ستُحتسب حاضرة في الغياب الرسمي اليومي تلقائياً');
    SOC_STU=null; $('socPicked').style.display='none'; $('socReason').value='';
    loadSocLists();
  }catch(err){ toast('تعذر التسجيل: '+(err.message||err)); }
  finally{ btn.disabled=false; }
}

async function loadSocial(){ initSocPick(); loadSocLists(); }
async function loadSocLists(){
  const box=$('socList');
  box.innerHTML='<div class="empty-day">جارٍ التحميل…</div>';
  const [{data:late},{data:exc}] = await Promise.all([
    db.from('late_log').select('id,arrival_time,note,students(full_name,academic_number)').eq('date',dstr(SOC_DATE)).order('arrival_time'),
    db.from('excuse_log').select('id,exit_time,reason,students(full_name,academic_number)').eq('date',dstr(SOC_DATE)).order('exit_time'),
  ]);
  const rows=[
    ...(late||[]).map(l=>({t:'late',id:l.id,time:l.arrival_time?.slice(0,5),name:l.students?.full_name,acad:l.students?.academic_number,extra:l.note})),
    ...(exc||[]).map(l=>({t:'excuse',id:l.id,time:l.exit_time?.slice(0,5),name:l.students?.full_name,acad:l.students?.academic_number,extra:l.reason})),
  ];
  if(!rows.length){ box.innerHTML='<div class="empty-day">لا سجلات في هذا اليوم.</div>'; return; }
  box.innerHTML=rows.map(r=>`
    <div class="logrow">
      <span style="font-size:16px">${r.t==='late'?'⏰':'🚪'}</span>
      <span><b>${r.name||'—'}</b> <small>${r.acad||''}</small><br>
      <small>${r.t==='late'?'وصلت':'خرجت'} الساعة ${r.time||''}${r.extra?' · '+r.extra:''}</small></span>
      <button class="del" data-t="${r.t}" data-id="${r.id}" title="حذف">✕</button>
    </div>`).join('');
  box.querySelectorAll('.del').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('حذف هذا السجل؟ ستعود الطالبة تُحتسب غائبة في القوائم الرسمية تلقائياً.')) return;
    await db.from(b.dataset.t==='late'?'late_log':'excuse_log').delete().eq('id',b.dataset.id);
    loadSocLists();
  }));
}

registerTab({id:'socialMain', label:'التأخير والاستئذان',
  show:f=>f.isAdmin||f.isSocial, onOpen:loadSocial});
