/* comp-hours.js — الساعات التعويضية:
   المعلمة: تضيف ساعة تعويضية (تاريخ، سبب، من قيادة أذنت، من-إلى)، وتتابع
   حصرها (المعتمد بس يُحتسب) ورصيدها المتبقي بعد الاستخدام. تقدر تحذف
   طلبها قبل الاعتماد.
   مسؤولة الساعات التعويضية: تعتمد الطلبات المعلَّقة أو ترفضها، وتسجّل
   استخدام المعلمة لساعاتها (يخصم من رصيدها)، وتقدر تحذف طلباً معلَّقاً. */
import { db, $, S, clean, toast, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="compHours" style="display:none">
  <div class="lm-subnav" id="chSubnav"></div>

  <div data-chtab="add" style="display:none">
    <div class="panel">
      <h3>إضافة ساعة تعويضية</h3>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:160px"><label>التاريخ</label><input type="date" id="chDate"></div>
        <div class="field" style="flex:1;min-width:220px"><label>من قيادة أذنت</label><select id="chApprover"></select></div>
      </div>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:140px"><label>الوقت من</label><input type="time" id="chFrom"></div>
        <div class="field" style="flex:1;min-width:140px"><label>الوقت إلى</label><input type="time" id="chTo"></div>
      </div>
      <div class="field"><label>السبب</label><textarea id="chReason" rows="2" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:8px;font:inherit"></textarea></div>
      <button class="btn gold" id="chAddSave" style="width:auto;padding:10px 26px;margin-top:6px">حفظ</button>
      <div class="sub" style="margin-top:10px">⚠️ تبقى الساعة المضافة قيد الاعتماد ولا تُحتسب ضمن رصيدك إلا بعد اعتمادها من مسؤولة الساعات التعويضية.</div>
    </div>
  </div>

  <div data-chtab="track" style="display:none">
    <div class="panel">
      <h3>طلباتي</h3>
      <div class="sub">كل طلباتك بحالتها — معتمدة / قيد الاعتماد / غير معتمدة. يمكنك حذف أي طلب قبل اعتماده.</div>
      <div class="board-wrap"><table class="board" id="chTrackTbl"></table></div>
      <div style="margin-top:10px;font-size:15px"><b>إجمالي المعتمد: <span id="chTotalApproved">0:00</span></b></div>
    </div>
    <div class="panel">
      <h3>الاستخدام والرصيد المتبقي</h3>
      <div class="board-wrap"><table class="board" id="chUsageTbl"></table></div>
      <div style="margin-top:10px;font-size:15px"><b>الرصيد المتبقي: <span id="chRemaining">0:00</span></b></div>
    </div>
  </div>

  <div data-chtab="approve" style="display:none">
    <div class="panel">
      <h3>اعتماد الساعات التعويضية</h3>
      <div class="sub">الطلبات المعلَّقة من كل المعلمات — حددي واعتمدي أو ارفضي، أو احذفي الطلب.</div>
      <div class="board-wrap"><table class="board" id="chApproveTbl"></table></div>
      <div class="viol-actions" style="margin-top:12px">
        <button class="btn gold" id="chApproveBtn" style="width:auto;padding:10px 26px">✔️ اعتماد المحدَّد</button>
        <button class="btn ghost" id="chRejectBtn" style="width:auto;padding:10px 26px;color:var(--err);border-color:var(--err)">✕ رفض المحدَّد</button>
      </div>
    </div>
  </div>

  <div data-chtab="use" style="display:none">
    <div class="panel">
      <h3>استخدام الساعات التعويضية</h3>
      <div class="row" style="display:flex;gap:12px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:220px">
          <label>المعلمة</label>
          <input type="text" id="chUseStaffSearch" placeholder="اكتبي اسماً…" autocomplete="off">
          <div id="chUseStaffSugg"></div>
        </div>
        <div class="field" style="flex:1;min-width:160px"><label>اليوم</label><input type="date" id="chUseDate"></div>
        <div class="field" style="min-width:90px"><label>ساعات</label><input type="number" id="chUseH" min="0" step="1" value="0"></div>
        <div class="field" style="min-width:90px"><label>دقائق</label><input type="number" id="chUseM" min="0" max="59" step="1" value="0"></div>
      </div>
      <div id="chUseBalance" class="sub" style="margin:10px 0"></div>
      <button class="btn gold" id="chUseSave" style="width:auto;padding:10px 26px">تسجيل الاستخدام</button>
    </div>
  </div>
</div>
<style>
  #compHours .field textarea{resize:vertical}
  #chUseStaffSugg{background:#fff;border:1px solid var(--line);border-radius:8px;margin-top:4px;max-height:220px;overflow-y:auto}
  #chUseStaffSugg:empty{display:none}
  #chUseStaffSugg .opt{padding:8px 12px;cursor:pointer;font-size:13px}
  #chUseStaffSugg .opt:hover{background:var(--sand)}
  .ch-status-pending{color:#a87c1f;font-weight:600}
  .ch-status-approved{color:#3a7a3a;font-weight:600}
  .ch-status-rejected{color:var(--err);font-weight:600}
</style>`);

const CH_TABS=[
  {id:'add', label:'إضافة', show:()=>S.FLAGS.isTeacher||S.FLAGS.isSeniorTeacher},
  {id:'track', label:'متابعة الساعات التعويضية', show:()=>S.FLAGS.isTeacher||S.FLAGS.isSeniorTeacher},
  {id:'approve', label:'اعتماد الساعات التعويضية', show:()=>S.FLAGS.isCompHoursLead},
  {id:'use', label:'استخدام الساعات التعويضية', show:()=>S.FLAGS.isCompHoursLead},
];
const CH_STATUS_LABEL={pending:'قيد الاعتماد', approved:'معتمدة', rejected:'غير معتمدة'};

function fmtMin(totalMin){
  totalMin=Math.round(+totalMin||0);
  const h=Math.floor(totalMin/60), m=totalMin%60;
  return `${h}:${String(m).padStart(2,'0')}`;
}
function leaderLabel(l){ return l ? `${l.display_title||'القيادة العليا'}: أ.${l.full_name}` : '—'; }

function switchChTab(tab){
  document.querySelectorAll('#compHours > [data-chtab]').forEach(el=>{ el.style.display = el.dataset.chtab===tab ? 'block':'none'; });
  $('chSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.classList.toggle('active', b.dataset.chtab===tab));
  if(tab==='track') loadTrack();
  if(tab==='approve') loadApprove();
}

let CH_STAFF_PICK=null;

async function initCompHours(){
  if($('chSubnav').dataset.ready) return;
  $('chSubnav').dataset.ready='1';

  const visible=CH_TABS.filter(t=>t.show());
  $('chSubnav').innerHTML=visible.map(t=>`<button class="lm-subnav-btn" data-chtab="${t.id}">${t.label}</button>`).join('');
  $('chSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.addEventListener('click',()=>switchChTab(b.dataset.chtab)));
  if(visible.length) switchChTab(visible[0].id);

  if(S.FLAGS.isTeacher||S.FLAGS.isSeniorTeacher){
    const {data:leaders}=await db.from('staff').select('id,full_name,display_title').eq('title','leadership').eq('is_active',true).order('full_name');
    $('chApprover').innerHTML='<option value="">اختاري…</option>'+(leaders||[]).map(l=>`<option value="${l.id}">${leaderLabel(l)}</option>`).join('');
    $('chAddSave').addEventListener('click',saveCompHour);
  }
  if(S.FLAGS.isCompHoursLead){
    $('chApproveBtn').addEventListener('click',()=>decideSelected('approved'));
    $('chRejectBtn').addEventListener('click',()=>decideSelected('rejected'));
    let t=null;
    $('chUseStaffSearch').addEventListener('input',()=>{
      clearTimeout(t);
      const q=clean($('chUseStaffSearch').value);
      CH_STAFF_PICK=null; $('chUseBalance').textContent='';
      if(q.length<2){ $('chUseStaffSugg').innerHTML=''; return; }
      t=setTimeout(async ()=>{
        const {data}=await db.from('staff').select('id,full_name').eq('is_active',true).ilike('full_name',`%${q}%`).limit(8);
        $('chUseStaffSugg').innerHTML=(data||[]).map(s=>`<div class="opt" data-id="${s.id}" data-name="${s.full_name}">${s.full_name}</div>`).join('');
        $('chUseStaffSugg').querySelectorAll('.opt').forEach(el=>el.addEventListener('click', async ()=>{
          CH_STAFF_PICK={id:el.dataset.id,name:el.dataset.name};
          $('chUseStaffSearch').value=el.dataset.name; $('chUseStaffSugg').innerHTML='';
          await showBalance();
        }));
      },250);
    });
    $('chUseSave').addEventListener('click',saveUsage);
  }
}

async function saveCompHour(){
  const date=$('chDate').value, from=$('chFrom').value, to=$('chTo').value, approver=$('chApprover').value;
  if(!date||!from||!to){ toast('اكتبي التاريخ والوقتين على الأقل'); return; }
  if(to<=from){ toast('يجب أن يكون وقت "إلى" بعد وقت "من"'); return; }
  const btn=$('chAddSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    const {error}=await db.from('comp_hours').insert({
      staff_id:S.ME.id, date, reason:clean($('chReason').value)||null,
      leadership_approver_id:approver||null, time_from:from, time_to:to,
    });
    if(error) throw error;
    toast('تمت الإضافة — بانتظار الاعتماد');
    $('chDate').value=''; $('chFrom').value=''; $('chTo').value=''; $('chApprover').value=''; $('chReason').value='';
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ'; }
}

async function loadTrack(){
  const {data,error}=await db.from('comp_hours').select('id,date,reason,minutes,status').eq('staff_id',S.ME.id).order('date',{ascending:false});
  if(error){ $('chTrackTbl').innerHTML=`<tr><td>تعذر التحميل: ${error.message}</td></tr>`; return; }
  const rows=data||[];
  const total=rows.filter(r=>r.status==='approved').reduce((s,r)=>s+(+r.minutes||0),0);
  $('chTrackTbl').innerHTML = rows.length
    ? '<tr><th>التاريخ</th><th>السبب</th><th>المدة</th><th>الحالة</th><th></th></tr>'+rows.map(r=>`
        <tr><td class="c">${r.date}</td><td>${r.reason||'—'}</td><td class="c">${fmtMin(r.minutes)}</td>
        <td class="c"><span class="ch-status-${r.status}">${CH_STATUS_LABEL[r.status]}</span></td>
        <td class="c">${r.status==='pending'?`<button class="btn ghost ch-del" data-id="${r.id}" style="width:auto;padding:5px 12px;font-size:11.5px;color:var(--err);border-color:var(--err)">حذف</button>`:''}</td></tr>`).join('')
    : '<tr><td style="padding:16px;text-align:center;color:#8a93a0">لم تُضيفي أي طلب بعد.</td></tr>';
  $('chTrackTbl').querySelectorAll('.ch-del').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('حذف هذا الطلب؟')) return;
    const {error}=await db.from('comp_hours').delete().eq('id',b.dataset.id);
    if(error){ toast('تعذر الحذف: '+error.message); return; }
    toast('تم الحذف'); loadTrack();
  }));
  $('chTotalApproved').textContent=fmtMin(total);

  const {data:usage}=await db.from('comp_hours_usage').select('date_used,minutes_used').eq('staff_id',S.ME.id).order('date_used',{ascending:false});
  const uRows=usage||[];
  const usedTotal=uRows.reduce((s,r)=>s+(+r.minutes_used||0),0);
  $('chUsageTbl').innerHTML = uRows.length
    ? '<tr><th>تاريخ الاستخدام</th><th>المدة</th></tr>'+uRows.map(r=>`<tr><td class="c">${r.date_used}</td><td class="c">${fmtMin(r.minutes_used)}</td></tr>`).join('')
    : '<tr><td style="padding:16px;text-align:center;color:#8a93a0">لم تستخدمي أي ساعة تعويضية بعد.</td></tr>';
  $('chRemaining').textContent=fmtMin(total-usedTotal);
}

async function loadApprove(){
  const {data,error}=await db.from('comp_hours').select('id,date,reason,time_from,time_to,minutes,teacher:staff_id(full_name),leadership_approver:leadership_approver_id(full_name,display_title)').eq('status','pending').order('date');
  if(error){ $('chApproveTbl').innerHTML=`<tr><td>تعذر التحميل: ${error.message}</td></tr>`; return; }
  const rows=data||[];
  $('chApproveTbl').innerHTML = rows.length
    ? '<tr><th></th><th>المعلمة</th><th>التاريخ</th><th>من — إلى</th><th>المدة</th><th>السبب</th><th>القيادة المأذون منها</th><th></th></tr>'+
      rows.map(r=>`<tr><td class="c"><input type="checkbox" class="ch-pick" value="${r.id}"></td><td>${r.teacher?.full_name||''}</td><td class="c">${r.date}</td><td class="c">${r.time_from}–${r.time_to}</td><td class="c">${fmtMin(r.minutes)}</td><td>${r.reason||'—'}</td><td>${leaderLabel(r.leadership_approver)}</td>
        <td class="c"><button class="btn ghost ch-adel" data-id="${r.id}" style="width:auto;padding:5px 12px;font-size:11.5px;color:var(--err);border-color:var(--err)">حذف</button></td></tr>`).join('')
    : '<tr><td style="padding:16px;text-align:center;color:#8a93a0">لا طلبات معلَّقة 🎉</td></tr>';
  $('chApproveTbl').querySelectorAll('.ch-adel').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('حذف هذا الطلب نهائياً؟')) return;
    const {error}=await db.from('comp_hours').delete().eq('id',b.dataset.id);
    if(error){ toast('تعذر الحذف: '+error.message); return; }
    toast('تم الحذف'); loadApprove();
  }));
}

async function decideSelected(status){
  const ids=[...document.querySelectorAll('.ch-pick:checked')].map(c=>c.value);
  if(!ids.length){ toast('حددي طلباً واحداً على الأقل'); return; }
  const verb = status==='approved' ? 'اعتماد' : 'رفض';
  if(!confirm(`تأكيد ${verb} ${ids.length} طلب؟`)) return;
  try{
    const {error}=await db.from('comp_hours').update({status, approved_by:S.ME.id, approved_at:new Date().toISOString()}).in('id',ids);
    if(error) throw error;
    toast(`تم ${verb} ${ids.length} طلب`);
    loadApprove();
  }catch(err){ toast(`تعذر ال${verb}: `+(err.message||err)); }
}

async function calcBalance(staffId){
  const {data:approved}=await db.from('comp_hours').select('minutes').eq('staff_id',staffId).eq('status','approved');
  const total=(approved||[]).reduce((s,r)=>s+(+r.minutes||0),0);
  const {data:usage}=await db.from('comp_hours_usage').select('minutes_used').eq('staff_id',staffId);
  const used=(usage||[]).reduce((s,r)=>s+(+r.minutes_used||0),0);
  return {total, used, remaining: total-used};
}
async function showBalance(){
  if(!CH_STAFF_PICK) return;
  const b=await calcBalance(CH_STAFF_PICK.id);
  $('chUseBalance').innerHTML=`رصيدها الحالي: <b>${fmtMin(b.remaining)}</b> (معتمد ${fmtMin(b.total)} − مستخدَم ${fmtMin(b.used)})`;
}

async function saveUsage(){
  if(!CH_STAFF_PICK){ toast('اختاري المعلمة أولاً'); return; }
  const date=$('chUseDate').value;
  const minutes=(+$('chUseH').value||0)*60 + (+$('chUseM').value||0);
  if(!date||minutes<=0){ toast('اكتبي اليوم والمدة (ساعات أو دقائق)'); return; }
  const b=await calcBalance(CH_STAFF_PICK.id);
  if(minutes>b.remaining){ if(!confirm(`رصيدها المتبقي ${fmtMin(b.remaining)} فقط — هل تأكدين تسجيل الاستخدام رغم ذلك؟`)) return; }
  const btn=$('chUseSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    const {error}=await db.from('comp_hours_usage').insert({staff_id:CH_STAFF_PICK.id, date_used:date, minutes_used:minutes, recorded_by:S.ME.id});
    if(error) throw error;
    toast('تم تسجيل الاستخدام');
    $('chUseDate').value=''; $('chUseH').value='0'; $('chUseM').value='0';
    await showBalance();
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='تسجيل الاستخدام'; }
}

registerTab({id:'compHours', label:'الساعات التعويضية',
  show:f=>f.isTeacher||f.isSeniorTeacher||f.isCompHoursLead, init:initCompHours});
