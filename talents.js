/* talents.js — قسم الموهوبات: حصر مواهب الطالبات (تبقى مسجَّلة طول بقائها
   بالمدرسة، ما تُفرَّغ كل سنة)، تصفّح/فرز حسب الموهبة، وفعاليات مخصصة
   للموهوبات (لمسؤولة متابعة الموهوبات). */
import { db, $, S, clean, toast, printHeaderHtml, printWithTitle, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="talTeacher" style="display:none">
  <div class="lm-subnav" id="ttSubnav">
    <button class="lm-subnav-btn" data-tt="census">📋 حصر الموهوبات</button>
    <button class="lm-subnav-btn" data-tt="browse">🌟 الموهوبات</button>
  </div>

  <div data-tt="census">
    <div class="panel">
      <h3>حصر الموهوبات</h3>
      <div class="field" style="max-width:420px"><label>الصف / الشعبة</label>
        <select id="tcSecPick"><option value="">اختاري الصف…</option></select>
      </div>
      <div id="tcStuList"></div>
    </div>
  </div>

  <div data-tt="browse" style="display:none">
    <div class="panel" id="tbPanel"></div>
  </div>
</div>

<div class="app-main wide" id="talLead" style="display:none">
  <div class="lm-subnav" id="tlSubnav">
    <button class="lm-subnav-btn" data-tl="census">📋 إضافة موهوبات</button>
    <button class="lm-subnav-btn" data-tl="browse">🌟 الموهوبات</button>
    <button class="lm-subnav-btn" data-tl="events">🎉 فعاليات للموهوبات</button>
  </div>

  <div data-tl="census">
    <div class="panel">
      <h3>حصر الموهوبات</h3>
      <div class="field" style="max-width:420px"><label>الصف / الشعبة</label>
        <select id="lcSecPick"><option value="">اختاري الصف…</option></select>
      </div>
      <div id="lcStuList"></div>
    </div>
  </div>

  <div data-tl="browse" style="display:none">
    <div class="panel" id="lbPanel"></div>
  </div>

  <div data-tl="events" style="display:none">
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <h3 style="margin:0">فعاليات الموهوبات</h3>
        <button class="btn gold" id="teNewBtn" style="width:auto;padding:9px 20px">➕ إضافة فعالية</button>
      </div>
      <div id="teForm" style="display:none;margin-top:16px;padding-top:16px;border-top:1px dashed var(--line)">
        <div class="field"><label>عنوان الفعالية</label><input type="text" id="teTitle" placeholder="اسم الفعالية/المسابقة…"></div>
        <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
          <select id="teType"><option value="internal">داخلية</option><option value="external">خارجية</option></select>
          <input type="text" id="teOrg" placeholder="الجهة المنظمة (لو خارجية)" style="flex:1;min-width:200px">
          <input type="date" id="teDate">
          <input type="text" id="teResult" placeholder="النتيجة/المركز (اختياري)" style="flex:1;min-width:200px">
        </div>
        <div class="field" style="position:relative">
          <label>الطالبات المشاركات (موهوبات)</label>
          <input type="text" id="tePartSearch" placeholder="ابحثي عن اسم طالبة…" autocomplete="off">
          <div class="sugg" id="tePartSugg"></div>
        </div>
        <div id="tePicked" style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0"></div>
        <div class="field"><label>ملاحظات</label><textarea id="teNotes" rows="2"></textarea></div>
        <button class="btn gold" id="teSave" style="width:auto;padding:10px 24px">حفظ الفعالية</button>
      </div>
      <div id="teList" style="margin-top:16px"></div>
    </div>
  </div>
</div>

<div id="printAreaTal" style="display:none"></div>

<style>
  .lm-subnav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;border-bottom:2px solid var(--line);padding-bottom:10px}
  .lm-subnav-btn{background:#fff;border:1.5px solid var(--line);border-radius:9px;padding:9px 16px;font:inherit;font-size:13px;font-weight:600;color:var(--navy);cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .lm-subnav-btn.active{background:var(--gold);border-color:var(--gold);color:#fff}
  .tal-stu-row{background:#fff;border:1px solid var(--line);border-radius:11px;padding:12px 16px;margin-bottom:8px}
  .tal-stu-head{display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer}
  .tal-stu-tags{font-size:11.5px;color:var(--warn);margin-top:4px}
  .tal-cats{display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
  .tal-stu-row.open .tal-cats{display:block}
  .tal-cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
  .tal-cat-chk{display:flex;align-items:center;gap:8px;background:var(--sand);border-radius:8px;padding:8px 10px;font-size:12.5px}
  .tal-cat-chk input{flex-shrink:0}
  .tal-cat-chk input.needs-note:checked ~ input[type=text]{display:block}
  .tal-note-input{display:none;margin-top:4px;width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font:inherit;font-size:12px}
  .tal-note-input.show{display:block}
  .tal-badge{display:inline-block;background:var(--gold-soft);color:var(--warn);border-radius:99px;padding:3px 10px;font-size:11px;margin:2px 3px 0 0}
</style>`);

let TALENTS=[];
async function loadTalents(){
  if(TALENTS.length) return;
  const {data}=await db.from('talent_categories').select('*').order('sort_order');
  TALENTS=data||[];
}

/* ============ حصر الموهوبات (تُستخدم للمعلمة ولمسؤولة الموهوبات) ============ */
async function bindCensus(secSelId, listId){
  const {data:sections}=await db.from('sections').select('id,code').eq('academic_year_id',S.YEAR.id).order('code');
  $(secSelId).innerHTML='<option value="">اختاري الصف…</option>'+(sections||[]).map(s=>`<option value="${s.id}">${s.code}</option>`).join('');
  $(secSelId).addEventListener('change', async ()=>{
    const secId=$(secSelId).value;
    $(listId).innerHTML='';
    if(!secId) return;
    $(listId).innerHTML='<div class="empty-day">جارٍ التحميل…</div>';
    const {data:enr}=await db.from('enrollments').select('students(id,full_name,academic_number)').eq('section_id',secId).is('to_date',null);
    const stus=(enr||[]).map(e=>e.students).filter(Boolean).sort((a,b)=>String(a.academic_number).localeCompare(String(b.academic_number),'ar',{numeric:true}));
    if(!stus.length){ $(listId).innerHTML='<div class="empty-day">لا طالبات بهذي الشعبة.</div>'; return; }
    const {data:existing}=await db.from('student_talents').select('student_id,talent_category_id,note').in('student_id',stus.map(s=>s.id));
    const byStu={}; for(const e of existing||[]) (byStu[e.student_id] ??= []).push(e);
    $(listId).innerHTML=stus.map(s=>{
      const mine=byStu[s.id]||[];
      const mineIds=new Set(mine.map(m=>m.talent_category_id));
      return `<div class="tal-stu-row" data-stu="${s.id}">
        <div class="tal-stu-head">
          <span><b>${s.full_name}</b> <small class="viol-meta">(${s.academic_number})</small></span>
          <span class="viol-meta">▾ اضغطي لتسجيل/تعديل المواهب</span>
        </div>
        <div class="tal-stu-tags">${mine.map(m=>{ const c=TALENTS.find(t=>t.id===m.talent_category_id); return `<span class="tal-badge">${c?.name||''}${m.note?': '+m.note:''}</span>`; }).join('')||'لا مواهب مسجَّلة بعد'}</div>
        <div class="tal-cats">
          <div class="tal-cat-grid">
            ${TALENTS.map(t=>`
              <label class="tal-cat-chk">
                <input type="checkbox" data-cat="${t.id}" ${mineIds.has(t.id)?'checked':''}>
                ${t.name}
              </label>`).join('')}
          </div>
          <div id="notes-${s.id}"></div>
          <button class="btn gold" data-save-stu="${s.id}" style="width:auto;padding:8px 20px;margin-top:10px;font-size:12.5px">حفظ</button>
        </div>
      </div>`;
    }).join('');

    $(listId).querySelectorAll('.tal-stu-head').forEach(h=>h.addEventListener('click',()=>h.closest('.tal-stu-row').classList.toggle('open')));

    // حقول ملاحظة لكل موهبة تحتاج تفصيل (اللغات/أخرى)، تظهر جنب الفئة نفسها
    $(listId).querySelectorAll('.tal-stu-row').forEach(row=>{
      const sid=row.dataset.stu;
      const mine=byStu[sid]||[];
      TALENTS.filter(t=>t.needs_note).forEach(t=>{
        const chk=row.querySelector(`input[data-cat="${t.id}"]`);
        const existingNote=mine.find(m=>m.talent_category_id===t.id)?.note||'';
        const noteInput=document.createElement('input');
        noteInput.type='text'; noteInput.className='tal-note-input'+(chk.checked?' show':'');
        noteInput.placeholder=t.name==='اللغات'?'اذكري اللغة…':'وضّحي…';
        noteInput.value=existingNote; noteInput.dataset.noteFor=t.id;
        chk.closest('.tal-cat-chk').appendChild(noteInput);
        chk.addEventListener('change',()=>noteInput.classList.toggle('show',chk.checked));
      });
    });

    $(listId).querySelectorAll('[data-save-stu]').forEach(btn=>btn.addEventListener('click', async ()=>{
      const sid=btn.dataset.saveStu;
      const row=btn.closest('.tal-stu-row');
      const checked=[...row.querySelectorAll('input[type=checkbox]:checked')].map(c=>({
        talent_category_id:c.dataset.cat,
        note:row.querySelector(`.tal-note-input[data-note-for="${c.dataset.cat}"]`)?.value?.trim()||null
      }));
      btn.disabled=true; btn.textContent='جارٍ الحفظ…';
      try{
        await db.from('student_talents').delete().eq('student_id',sid);
        if(checked.length){
          const rows=checked.map(c=>({student_id:sid, talent_category_id:c.talent_category_id, note:c.note, recorded_by:S.ME.id}));
          const {error}=await db.from('student_talents').insert(rows);
          if(error) throw error;
        }
        toast('تم حفظ مواهب الطالبة');
        $(secSelId).dispatchEvent(new Event('change'));
      }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
      finally{ btn.disabled=false; btn.textContent='حفظ'; }
    }));
  });
}

/* ============ تصفّح/فرز الموهوبات ============ */
async function bindBrowse(panelId){
  const panel=$(panelId);
  if(panel.dataset.ready) return;
  panel.dataset.ready='1';
  const {data:sections}=await db.from('sections').select('id,code,level').eq('academic_year_id',S.YEAR.id).order('code');
  panel.innerHTML=`
    <h3>تصفّح الموهوبات</h3>
    <div class="row" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <select id="${panelId}-scope">
        <option value="section">حسب الصف</option>
        <option value="level">حسب المستوى</option>
        <option value="school">كل المدرسة</option>
      </select>
      <select id="${panelId}-sec"><option value="">اختاري الصف…</option>${(sections||[]).map(s=>`<option value="${s.id}">${s.code}</option>`).join('')}</select>
      <select id="${panelId}-level" style="display:none"><option value="1">الأول</option><option value="2">الثاني</option><option value="3">الثالث</option></select>
      <select id="${panelId}-tal"><option value="">كل المواهب</option>${TALENTS.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select>
      <button class="btn gold" id="${panelId}-go" style="width:auto;padding:9px 20px">فرز</button>
      <button class="btn ghost" id="${panelId}-print" style="width:auto;padding:9px 20px">🖨️ طباعة</button>
    </div>
    <div class="board-wrap"><table class="board" id="${panelId}-tbl"></table></div>`;
  const scopeSel=$(`${panelId}-scope`);
  scopeSel.addEventListener('change',()=>{
    $(`${panelId}-sec`).style.display=scopeSel.value==='section'?'inline-block':'none';
    $(`${panelId}-level`).style.display=scopeSel.value==='level'?'inline-block':'none';
  });
  let LAST_ROWS=[];
  $(`${panelId}-go`).addEventListener('click', async ()=>{
    const scope=scopeSel.value, talId=$(`${panelId}-tal`).value;
    let q=db.from('student_talents').select('note, talent_categories(name), students(full_name,academic_number, enrollments(section_id,to_date,sections(code,level)))');
    if(talId) q=q.eq('talent_category_id',talId);
    const {data,error}=await q;
    if(error){ $(`${panelId}-tbl`).innerHTML=`<tr><td>تعذر التحميل: ${error.message}</td></tr>`; return; }
    let rows=(data||[]).map(r=>{
      const curEnr=(r.students?.enrollments||[]).find(e=>!e.to_date);
      return {...r, _sec:curEnr?.sections, _enrSecId:curEnr?.section_id};
    });
    if(scope==='section'){
      const secId=$(`${panelId}-sec`).value;
      if(!secId){ toast('اختاري الصف'); return; }
      rows=rows.filter(r=>r._sec && r._enrSecId===secId);
    } else if(scope==='level'){
      const lvl=$(`${panelId}-level`).value;
      rows=rows.filter(r=>String(r._sec?.level)===lvl);
    }
    LAST_ROWS=rows;
    $(`${panelId}-tbl`).innerHTML = rows.length
      ? '<tr><th>الطالبة</th><th>الرقم الأكاديمي</th><th>الشعبة</th><th>الموهبة</th></tr>'+
        rows.map(r=>`<tr><td>${r.students?.full_name||'—'}</td><td class="c">${r.students?.academic_number||''}</td><td class="c">${r._sec?.code||''}</td><td>${r.talent_categories?.name||''}${r.note?': '+r.note:''}</td></tr>`).join('')
      : '<tr><td style="padding:16px;text-align:center;color:#8a93a0">لا نتائج</td></tr>';
    panel._lastRows=rows;
  });
  $(`${panelId}-print`).addEventListener('click',()=>{
    const rows=panel._lastRows||[];
    if(!rows.length){ toast('لا بيانات للطباعة'); return; }
    $('printAreaTal').innerHTML=`${printHeaderHtml('تقرير الموهوبات')}
      <table class="viol-print-tbl"><tr><th>الطالبة</th><th>الرقم الأكاديمي</th><th>الشعبة</th><th>الموهبة</th></tr>
      ${rows.map(r=>`<tr><td>${r.students?.full_name||'—'}</td><td>${r.students?.academic_number||''}</td><td>${r._sec?.code||''}</td><td>${r.talent_categories?.name||''}${r.note?': '+r.note:''}</td></tr>`).join('')}
      </table>`;
    printWithTitle('تقرير_الموهوبات','printAreaTal');
  });
  $(`${panelId}-go`).click();
}

/* ============ تبويب المعلمة ============ */
function switchTt(tab){
  document.querySelectorAll('#talTeacher > [data-tt]').forEach(el=>{ el.style.display=el.dataset.tt===tab?'block':'none'; });
  $('ttSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tt===tab));
  if(tab==='browse') bindBrowse('tbPanel');
}
async function initTalTeacher(){
  if($('ttSubnav').dataset.ready) return;
  $('ttSubnav').dataset.ready='1';
  await loadTalents();
  $('ttSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.addEventListener('click',()=>switchTt(b.dataset.tt)));
  switchTt('census');
  bindCensus('tcSecPick','tcStuList');
}
registerTab({id:'talTeacher', label:'الموهوبات', group:'talents', groupLabel:'الموهوبات',
  show:f=>f.isTeacher||f.isSeniorTeacher, init:initTalTeacher});

/* ============ تبويب مسؤولة متابعة الموهوبات ============ */
function switchTl(tab){
  document.querySelectorAll('#talLead > [data-tl]').forEach(el=>{ el.style.display=el.dataset.tl===tab?'block':'none'; });
  $('tlSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tl===tab));
  if(tab==='browse') bindBrowse('lbPanel');
  if(tab==='events') loadTalentEvents();
}
async function initTalLead(){
  if($('tlSubnav').dataset.ready) return;
  $('tlSubnav').dataset.ready='1';
  await loadTalents();
  $('tlSubnav').querySelectorAll('.lm-subnav-btn').forEach(b=>b.addEventListener('click',()=>switchTl(b.dataset.tl)));
  switchTl('census');
  bindCensus('lcSecPick','lcStuList');
  bindTalentEventForm();
}
registerTab({id:'talLead', label:'إدارة الموهوبات', group:'talents', groupLabel:'الموهوبات',
  show:f=>f.isAdmin||f.isLead||f.isTalentsLead, init:initTalLead});

/* ============ فعاليات الموهوبات ============ */
let TE_PICKED=[];
function bindTalentEventForm(){
  if($('teNewBtn').dataset.ready) return;
  $('teNewBtn').dataset.ready='1';
  $('teNewBtn').addEventListener('click',()=>{ $('teForm').style.display=$('teForm').style.display==='none'?'block':'none'; });

  let searchTimer=null;
  $('tePartSearch').addEventListener('input',()=>{
    clearTimeout(searchTimer);
    const q=clean($('tePartSearch').value);
    if(q.length<2){ $('tePartSugg').innerHTML=''; return; }
    searchTimer=setTimeout(async ()=>{
      const {data}=await db.from('students').select('id,full_name,academic_number').ilike('full_name',`%${q}%`).limit(8);
      $('tePartSugg').innerHTML=(data||[]).filter(s=>!TE_PICKED.some(p=>p.id===s.id)).map(s=>`<div class="opt" data-id="${s.id}" data-name="${s.full_name}">${s.full_name}<small>${s.academic_number}</small></div>`).join('');
      $('tePartSugg').querySelectorAll('.opt').forEach(el=>el.addEventListener('click',()=>{
        TE_PICKED.push({id:el.dataset.id, full_name:el.dataset.name});
        renderTePicked();
        $('tePartSearch').value=''; $('tePartSugg').innerHTML='';
      }));
    },250);
  });

  $('teSave').addEventListener('click', async ()=>{
    const title=clean($('teTitle').value);
    if(!title){ toast('اكتبي عنوان الفعالية'); return; }
    if(!TE_PICKED.length){ toast('أضيفي طالبة مشاركة على الأقل'); return; }
    const btn=$('teSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
    try{
      const {data:ev,error}=await db.from('talent_events').insert({
        academic_year_id:S.YEAR.id, title, type:$('teType').value,
        organizing_body:clean($('teOrg').value)||null, execution_date:$('teDate').value||null,
        result:clean($('teResult').value)||null, notes:clean($('teNotes').value)||null, created_by:S.ME.id
      }).select('id').single();
      if(error) throw error;
      const {error:pErr}=await db.from('talent_event_participants').insert(TE_PICKED.map(s=>({event_id:ev.id, student_id:s.id})));
      if(pErr) throw pErr;
      toast('تم حفظ الفعالية');
      $('teTitle').value=''; $('teOrg').value=''; $('teDate').value=''; $('teResult').value=''; $('teNotes').value='';
      TE_PICKED=[]; renderTePicked(); $('teForm').style.display='none';
      loadTalentEvents();
    }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
    finally{ btn.disabled=false; btn.textContent='حفظ الفعالية'; }
  });
}
function renderTePicked(){
  $('tePicked').innerHTML=TE_PICKED.map((s,i)=>`<span class="tal-badge">${s.full_name} <button type="button" data-rm="${i}" style="border:none;background:none;color:var(--err);cursor:pointer">✕</button></span>`).join('');
  $('tePicked').querySelectorAll('[data-rm]').forEach(b=>b.addEventListener('click',()=>{ TE_PICKED.splice(+b.dataset.rm,1); renderTePicked(); }));
}
async function loadTalentEvents(){
  const {data,error}=await db.from('talent_events').select('*, talent_event_participants(students(full_name))').eq('academic_year_id',S.YEAR.id).order('created_at',{ascending:false});
  if(error){ $('teList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  $('teList').innerHTML=(data||[]).length ? data.map(e=>`
    <div class="viol-card">
      <div class="viol-card-head"><b>${e.title}</b><span class="viol-meta">${e.type==='internal'?'داخلية':'خارجية'}${e.execution_date?' · '+e.execution_date:''}</span></div>
      ${e.organizing_body?`<div class="viol-meta">الجهة المنظمة: ${e.organizing_body}</div>`:''}
      <div class="viol-meta">المشاركات: ${(e.talent_event_participants||[]).map(p=>p.students?.full_name).join('، ')||'—'}</div>
      ${e.result?`<div class="viol-notes"><b>النتيجة:</b> ${e.result}</div>`:''}
      ${e.notes?`<div class="viol-notes">${e.notes}</div>`:''}
    </div>`).join('') : '<div class="empty-day">لا فعاليات مسجَّلة بعد.</div>';
}
