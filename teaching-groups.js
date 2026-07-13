/* teaching-groups.js — مجموعات التدريس (تحت مجموعة "الإعدادات")
   الوحدة الحقيقية لمقررات المعلمات (لا الشعبة مباشرة) — تحل مشكلة
   المقررات المنقسمة بين معلمتين: كل معلمة تتعامل مع طالباتها فقط في
   الدرجات والتحليل والتغذية والتنبيهات، بينما الغياب يبقى موحداً للشعبة
   كاملة كما هو (لا علاقة له بهذه الشاشة). المقرر غير المنقسم يُنشأ له
   تلقائياً "مجموعة وحيدة" بلا أي إعداد يدوي أول ما تفتحه أي معلمة. */
import { db, $, S, clean, toast, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="teachingGroups" style="display:none">
  <div class="panel">
    <h3>مجموعات التدريس</h3>
    <div class="sub">المقرر غير المنقسم لا يحتاج أي إعداد هنا (مجموعة واحدة تلقائية). استخدمي هذي الشاشة فقط عندما يُدرّس مقرر لشعبة بأكثر من معلمة.</div>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <select id="tgSection" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:160px"></select>
      <select id="tgSubject" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);min-width:160px"></select>
      <button class="btn gold" id="tgGo" style="width:auto;padding:10px 24px">فتح</button>
    </div>
  </div>

  <div id="tgResults" style="display:none">
    <div class="panel">
      <h3>المجموعات الحالية</h3>
      <div id="tgGroupsList"></div>
      <button class="btn ghost" id="tgAddGroup" style="width:auto;padding:9px 20px;margin-top:12px">＋ إضافة مجموعة (تقسيم)</button>
    </div>
    <div class="panel">
      <h3>توزيع الطالبات</h3>
      <div class="sub">كل طالبة تنتمي لمجموعة واحدة فقط. الطالبات غير المخصَّصة بعد يظهرن أولاً.</div>
      <div id="tgMembersList"></div>
      <button class="btn gold" id="tgSave" style="width:auto;padding:11px 26px;margin-top:14px">حفظ التوزيع</button>
    </div>
  </div>
</div>
<style>
  .tg-group-row{display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--white);border:1px solid var(--line);border-radius:11px;padding:12px 16px;margin-bottom:8px;flex-wrap:wrap}
  .tg-group-row input[type=text]{padding:8px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-weight:700;color:var(--navy);min-width:160px}
  .tg-group-row .tg-teacher{flex:1;min-width:200px;position:relative}
  .tg-group-row .tg-teacher input{width:100%;padding:8px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit}
  .tg-group-row button.del{background:none;border:none;color:var(--err);cursor:pointer;font-size:14px}
  .tg-member-row{display:flex;justify-content:space-between;align-items:center;background:var(--white);border:1px solid var(--line);border-radius:9px;padding:9px 14px;margin-bottom:6px}
  .tg-member-row select{padding:6px 10px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:12.5px;background:#fbfaf7}
  .tg-member-row.unassigned{border-color:#e0b84a;background:#fff8ea}
</style>`);

let SECTIONS=[], SUBJECTS=[], GROUPS=[], MEMBERS_BY_STUDENT={}, ALL_STUDENTS=[], CUR_SEC=null, CUR_SUBJ=null;

async function initTG(){
  if($('tgGo').dataset.ready) return;
  $('tgGo').dataset.ready='1';
  const [{data:secs},{data:subs}] = await Promise.all([
    db.from('sections').select('id,code').eq('academic_year_id',S.YEAR.id).order('code'),
    db.from('subjects').select('id,code').order('code'),
  ]);
  SECTIONS=secs||[]; SUBJECTS=subs||[];
  $('tgSection').innerHTML='<option value="">اختاري الشعبة…</option>'+SECTIONS.map(s=>`<option value="${s.id}">${s.code}</option>`).join('');
  $('tgSubject').innerHTML='<option value="">اختاري المقرر…</option>'+SUBJECTS.map(s=>`<option value="${s.id}">${s.code}</option>`).join('');
  $('tgGo').addEventListener('click',loadGroups);
  $('tgAddGroup').addEventListener('click',addGroup);
  $('tgSave').addEventListener('click',saveAll);
}

async function loadGroups(){
  const secId=$('tgSection').value, subjId=$('tgSubject').value;
  if(!secId||!subjId){ toast('اختاري الشعبة والمقرر'); return; }
  CUR_SEC=SECTIONS.find(s=>s.id===secId); CUR_SUBJ=SUBJECTS.find(s=>s.id===subjId);

  const {data:enr}=await db.from('enrollments').select('students(id,full_name,academic_number)').eq('section_id',secId).is('to_date',null);
  ALL_STUDENTS=(enr||[]).map(e=>e.students).filter(Boolean).sort((a,b)=>a.full_name.localeCompare(b.full_name,'ar'));

  let {data:groups}=await db.from('teaching_groups').select('id,name,teaching_group_teachers(staff_id,staff(full_name)),teaching_group_members(student_id)')
    .eq('section_id',secId).eq('subject_id',subjId);

  if(!groups?.length){
    const {data:newGroup,error}=await db.from('teaching_groups').insert({section_id:secId, subject_id:subjId, name:'المجموعة الوحيدة', academic_year_id:S.YEAR.id}).select('id').single();
    if(error){ toast('تعذر الإنشاء: '+error.message); return; }
    if(ALL_STUDENTS.length){
      await db.from('teaching_group_members').insert(ALL_STUDENTS.map(s=>({group_id:newGroup.id, student_id:s.id})));
    }
    const {data:groups2}=await db.from('teaching_groups').select('id,name,teaching_group_teachers(staff_id,staff(full_name)),teaching_group_members(student_id)')
      .eq('section_id',secId).eq('subject_id',subjId);
    groups=groups2;
    toast('لا مجموعات سابقة — أُنشئت "المجموعة الوحيدة" تلقائياً بكل طالبات الشعبة');
  }

  GROUPS=(groups||[]).map(g=>({id:g.id, name:g.name,
    teachers:(g.teaching_group_teachers||[]).map(t=>({staff_id:t.staff_id, name:t.staff?.full_name||'—'})),
    memberIds:new Set((g.teaching_group_members||[]).map(m=>m.student_id))}));

  MEMBERS_BY_STUDENT={};
  for(const g of GROUPS) for(const sid of g.memberIds) MEMBERS_BY_STUDENT[sid]=g.id;

  renderGroups(); renderMembers();
  $('tgResults').style.display='block';
}

function renderGroups(){
  $('tgGroupsList').innerHTML=GROUPS.map((g,gi)=>`
    <div class="tg-group-row" data-gi="${gi}">
      <input type="text" class="tg-name" value="${g.name.replace(/"/g,'&quot;')}">
      <div class="tg-teacher">
        <input type="text" class="tg-teacher-search" placeholder="ابحثي عن المعلمة المسؤولة…" value="${g.teachers[0]?.name||''}" data-staff="${g.teachers[0]?.staff_id||''}">
        <div class="sugg" style="display:none"></div>
      </div>
      <span style="font-size:12px;color:#6b7683">${g.memberIds.size} طالبة</span>
      ${GROUPS.length>1?`<button class="del" data-gi="${gi}">✕ حذف المجموعة</button>`:''}
    </div>`).join('');

  $('tgGroupsList').querySelectorAll('.tg-name').forEach((inp,gi)=>inp.addEventListener('input',()=>{ GROUPS[gi].name=inp.value; }));
  $('tgGroupsList').querySelectorAll('.tg-teacher-search').forEach((inp,gi)=>{
    let deb=null;
    inp.addEventListener('input',()=>{
      clearTimeout(deb);
      deb=setTimeout(async ()=>{
        const q=clean(inp.value);
        const box=inp.nextElementSibling;
        if(q.length<2){ box.style.display='none'; return; }
        const {data:st}=await db.from('staff').select('id,full_name').ilike('full_name',`%${q}%`).limit(6);
        if(!(st||[]).length){ box.style.display='none'; return; }
        box.innerHTML=st.map((s,i)=>`<div data-i="${i}">${s.full_name}</div>`).join('');
        box.style.display='block';
        box.querySelectorAll('div').forEach((el,i)=>el.addEventListener('click',()=>{
          inp.value=st[i].full_name; inp.dataset.staff=st[i].id; box.style.display='none';
          GROUPS[gi].teachers=[{staff_id:st[i].id, name:st[i].full_name}];
        }));
      },250);
    });
  });
  $('tgGroupsList').querySelectorAll('button.del').forEach(b=>b.addEventListener('click',()=>{
    const gi=+b.dataset.gi;
    if(!confirm('حذف هذي المجموعة؟ طالباتها ستنتقل تلقائياً لأول مجموعة متبقية.')) return;
    const removed=GROUPS.splice(gi,1)[0];
    if(GROUPS.length) for(const sid of removed.memberIds) GROUPS[0].memberIds.add(sid);
    renderGroups(); renderMembers();
  }));
}

function addGroup(){
  const n=GROUPS.length+1;
  GROUPS.push({id:null, name:`المجموعة ${n===1?'الأولى':n===2?'الثانية':n}`, teachers:[], memberIds:new Set()});
  renderGroups(); renderMembers();
}

function renderMembers(){
  const rows=ALL_STUDENTS.map(s=>{
    const curGroupIdx=GROUPS.findIndex(g=>g.memberIds.has(s.id));
    return {s, curGroupIdx};
  }).sort((a,b)=> (a.curGroupIdx===-1?-1:0) - (b.curGroupIdx===-1?-1:0) || a.s.full_name.localeCompare(b.s.full_name,'ar'));

  $('tgMembersList').innerHTML = rows.map(({s,curGroupIdx})=>`
    <div class="tg-member-row ${curGroupIdx===-1?'unassigned':''}" data-sid="${s.id}">
      <span>${s.full_name} <small style="color:#8a93a0">${s.academic_number}</small></span>
      <select class="tg-assign" data-sid="${s.id}">
        ${curGroupIdx===-1?'<option value="">— اختاري —</option>':''}
        ${GROUPS.map((g,gi)=>`<option value="${gi}" ${gi===curGroupIdx?'selected':''}>${g.name}</option>`).join('')}
      </select>
    </div>`).join('') || '<div class="empty-day">لا طالبات في هذي الشعبة.</div>';

  $('tgMembersList').querySelectorAll('.tg-assign').forEach(sel=>sel.addEventListener('change',()=>{
    const sid=sel.dataset.sid;
    for(const g of GROUPS) g.memberIds.delete(sid);
    if(sel.value!=='') GROUPS[+sel.value].memberIds.add(sid);
    sel.closest('.tg-member-row').classList.toggle('unassigned', sel.value==='');
  }));
}

async function saveAll(){
  if(GROUPS.some(g=>!g.teachers.length)){
    if(!confirm('توجد مجموعة بلا معلمة محددة — تكملين الحفظ؟')) return;
  }
  const unassigned=ALL_STUDENTS.filter(s=>!GROUPS.some(g=>g.memberIds.has(s.id)));
  if(unassigned.length){ toast(`${unassigned.length} طالبة بلا مجموعة — وزّعيهن أولاً`); return; }

  const btn=$('tgSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    for(const g of GROUPS){
      let groupId=g.id;
      if(!groupId){
        const {data,error}=await db.from('teaching_groups').insert({section_id:CUR_SEC.id, subject_id:CUR_SUBJ.id, name:g.name, academic_year_id:S.YEAR.id}).select('id').single();
        if(error) throw error;
        groupId=data.id; g.id=groupId;
      }else{
        await db.from('teaching_groups').update({name:g.name}).eq('id',groupId);
      }
      await db.from('teaching_group_teachers').delete().eq('group_id',groupId);
      if(g.teachers.length){ const {error}=await db.from('teaching_group_teachers').insert(g.teachers.map(t=>({group_id:groupId, staff_id:t.staff_id}))); if(error) throw error; }
      await db.from('teaching_group_members').delete().eq('group_id',groupId);
      if(g.memberIds.size){ const {error}=await db.from('teaching_group_members').insert([...g.memberIds].map(sid=>({group_id:groupId, student_id:sid}))); if(error) throw error; }
    }
    const {data:existing}=await db.from('teaching_groups').select('id').eq('section_id',CUR_SEC.id).eq('subject_id',CUR_SUBJ.id);
    const keepIds=new Set(GROUPS.map(g=>g.id));
    const staleIds=(existing||[]).map(e=>e.id).filter(id=>!keepIds.has(id));
    if(staleIds.length) await db.from('teaching_groups').delete().in('id',staleIds);

    toast('تم حفظ توزيع المجموعات');
    loadGroups();
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ التوزيع'; }
}

registerTab({id:'teachingGroups', label:'مجموعات التدريس', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin||f.isSeniorTeacher, init:initTG});
