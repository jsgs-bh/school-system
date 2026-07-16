/* core.js — الاتصال والجلسة والأدوات المشتركة (يستقر مبكراً ونادراً ما يتغير) */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const db = createClient('https://vvfxcoxnnuubycrpkwzj.supabase.co','sb_publishable_8JhfrwxXY9z3hYfi7E5tRg_eOFGxwv8');
export const $ = id => document.getElementById(id);

/* الحالة المشتركة بين الشاشات */
export const S = { ME:null, YEAR:null, PERIODS:[], FLAGS:{}, SETTINGS:{school_name:'المدرسة'} };

export const roleNames = {admin:'الدعم الفني',leadership:'القيادة العليا',project_lead:'مسؤولة مشروع',
  committee_head:'رئيسة لجنة',plans_supervisor:'مسؤولة متابعة الخطط',analysis_supervisor:'مسؤولة تحليل الاختبارات',
  attendance_lead:'مسؤولة متابعة الغياب', complaints_lead:'مسؤولة متابعة الشكاوى'};
export const titleNames = {teacher:'معلمة',senior_teacher:'معلمة أولى',leadership:'قيادة عليا',staff:'منتسبة'};
export const AR_DAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
export const PERIOD_NAMES = ['','الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة'];

/* أدوات عامة */
export const normDigits = s => String(s??'').replace(/[٠-٩]/g, d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
export const clean = s => String(s??'').replace(/\s+/g,' ').trim();
export const normName = s => clean(s).replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');
export const chunk = (a,n)=>Array.from({length:Math.ceil(a.length/n)},(_,i)=>a.slice(i*n,(i+1)*n));
export const dstr = d => d.toISOString().slice(0,10);
export function toast(t){ $('toastMsg').textContent=t; $('toast').classList.add('show'); setTimeout(()=>$('toast').classList.remove('show'),2400); }
/* طباعة PDF باسم ملف مقترح = اسم التقرير + التاريخ (متصفحات Chrome تقترح اسم الملف من عنوان الصفحة) */
export function printWithTitle(filenameBase){
  // إصلاح تراكب التقارير: كل ملف له حاوية طباعة خاصة، وأي محتوى قديم متبقٍ
  // في حاوية أخرى كان يظهر معها لأن قواعد @media print مستقلة لكل حاوية.
  // نفرّغ كل حاوية غير الحاوية المستخدَمة الآن (المعروفة بأنها غير فارغة).
  const containers=[...document.querySelectorAll('[id^="printArea"]')];
  const active=containers.find(el=>el.innerHTML.trim()!=='');
  containers.forEach(el=>{ if(el!==active) el.innerHTML=''; });

  const prev=document.title;
  document.title=filenameBase;
  const restore=()=>{ document.title=prev; window.removeEventListener('afterprint',restore); };
  window.addEventListener('afterprint',restore);
  window.print();
  setTimeout(restore,4000); // شبكة أمان لو لم يُطلق afterprint (بعض المتصفحات)
}
export function bindDrop(zone,input,onFile){
  zone.addEventListener('click',()=>input.click());
  input.addEventListener('change',()=>{ if(input.files[0]) onFile(input.files[0]); input.value=''; });
  zone.addEventListener('dragover',e=>{e.preventDefault();zone.style.borderColor='var(--gold)';});
  zone.addEventListener('dragleave',()=>zone.style.borderColor='');
  zone.addEventListener('drop',e=>{e.preventDefault();zone.style.borderColor=''; if(e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);});
}
export async function readSheet(file){
  const wb = XLSX.read(await file.arrayBuffer());
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
}
export const mkProg = p => (v,t)=>{ $(p).style.display='block'; $(p.replace('Prog','Bar')).style.width=v+'%'; $(p.replace('Prog','Step')).textContent=t; };
export function showWarns(id,warns){
  const w=$(id); w.style.display=warns.length?'block':'none';
  w.innerHTML = warns.slice(0,40).map(x=>'• '+x).join('<br>') + (warns.length>40?`<br>… و${warns.length-40} تنبيهاً آخر`:'');
}

/* ============ سجل التبويبات — تبويبات مستقلة + مجموعات فرعية ============ */
const TOP=[];        // تبويبات مستقلة (لا تنتمي لمجموعة)
const GROUPS={};     // groupId -> {label, tabs:[]}

export function registerTab(t){
  if(t.group){
    GROUPS[t.group] ??= {label:t.groupLabel||t.group, tabs:[]};
    GROUPS[t.group].tabs.push(t);
  }else{
    TOP.push(t);
  }
}
const allTabs = () => [...TOP, ...Object.values(GROUPS).flatMap(g=>g.tabs)];
function groupOf(tid){
  for(const [gid,g] of Object.entries(GROUPS)) if(g.tabs.some(t=>t.id===tid)) return gid;
  return null;
}
function renderSubNav(gid, activeId){
  const box=$('subTabsNav'); if(!box) return;
  if(!gid){ box.style.display='none'; box.innerHTML=''; return; }
  const vis=GROUPS[gid].tabs.filter(t=>t.show(S.FLAGS));
  box.style.display='flex';
  box.innerHTML=vis.map(t=>`<button data-t="${t.id}" class="${t.id===activeId?'on':''}">${t.label}</button>`).join('');
  box.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.t)));
}
export function openTab(tid){
  for(const t of allTabs()){ const el=$(t.id); if(el) el.style.display = t.id===tid?'block':'none'; }
  const gid=groupOf(tid);
  document.querySelectorAll('#tabsNav button[data-t]').forEach(b=>b.classList.toggle('on', b.dataset.t===tid));
  document.querySelectorAll('#tabsNav button[data-g]').forEach(b=>b.classList.toggle('on', b.dataset.g===gid));
  renderSubNav(gid, tid);
  const t=allTabs().find(x=>x.id===tid); if(t?.onOpen) t.onOpen();
}


/* ============ إعدادات النظام (اسم المدرسة وغيرها) ============ */
export async function loadSettings(){
  const { data } = await db.from('app_settings').select('*').eq('id',1).maybeSingle();
  if(data) S.SETTINGS = data;
  applySettingsToDom();
}
export function applySettingsToDom(){
  const name = S.SETTINGS.school_name || 'المدرسة';
  document.title = 'نظام ' + name;
  const login=$('schoolNameLogin'); if(login) login.textContent = name;
  const foot=$('footerSchoolName'); if(foot) foot.textContent = name;
}
/* رابط شعار المدرسة (لو مرفوع) — يُستخدم كهيدر في التقارير المصدَّرة. */
export function getLogoUrl(){
  if(!S.SETTINGS.logo_path) return null;
  const {data}=db.storage.from('school-files').getPublicUrl(S.SETTINGS.logo_path);
  return data?.publicUrl||null;
}
/* هيدر موحّد لكل التقارير المطبوعة (الشعار + العنوان). */
export function printHeaderHtml(title){
  const logo=getLogoUrl();
  return `<div class="shared-print-head">${logo?`<img src="${logo}">`:''}<h2>${title}</h2></div>`;
}
/* تذييل موحّد: يمين = المعلمة أو المكتب، يسار = مديرة المدرسة — ثابت أسفل كل صفحة. */
export function printFooterHtml(rightLabel,rightName,leftLabel,leftName){
  return `<div class="shared-print-footer">
    <div><b>${rightLabel}</b>${rightName||''}</div>
    <div><b>${leftLabel||'مديرة المدرسة'}</b>${leftName||S.SETTINGS.principal_name||'—'}</div>
  </div>`;
}

/* ============ الجلسة ============ */
async function boot(session){
  let { data: staff } = await db.from('staff').select('*, departments(name)').eq('auth_user_id', session.user.id).maybeSingle();
  if(!staff) ({ data: staff } = await db.from('staff').select('*, departments(name)').ilike('email', session.user.email).maybeSingle());
  if(!staff){
    await db.auth.signOut();
    const m=$('loginMsg'); m.className='msg err';
    m.textContent='حسابك غير مسجل في قائمة المنتسبات. تواصلي مع الدعم الفني.'; return;
  }
  const { data: roles } = await db.from('staff_roles').select('role').eq('staff_id', staff.id);
  S.ME = staff;
  const dept = staff.departments?.name||'';
  S.FLAGS = {
    isAdmin: (roles||[]).some(r=>r.role==='admin'),
    isLead:  (roles||[]).some(r=>r.role==='leadership') || staff.title==='leadership',
    isSocial:/اجتماعي/.test(dept),
    isServices:/خدمات/.test(dept),
    isAcademicGuidance:/رشاد/.test(dept) && /كاديمي/.test(dept),
    isReg:   /تسجيل/.test(dept),
    isTeacher: staff.title==='teacher'||staff.title==='senior_teacher',
    isAttendanceLead: (roles||[]).some(r=>r.role==='attendance_lead'),
    isComplaintsLead: (roles||[]).some(r=>r.role==='complaints_lead'),
    isAnalysis: (roles||[]).some(r=>r.role==='analysis_supervisor'),
    isSeniorTeacher: staff.title==='senior_teacher',
  };
  $('userName').textContent = staff.full_name;
  $('userRole').textContent = (roles||[]).map(r=>roleNames[r.role]).join(' · ') || titleNames[staff.title] || 'منتسبة';
  $('loginView').style.display='none';
  $('appView').style.display='flex';
  const { data: yr } = await db.from('academic_years').select('*').eq('is_active',true).maybeSingle();
  S.YEAR = yr;
  const { data: pat } = await db.from('timetable_patterns').select('id').eq('is_active',true).maybeSingle();
  if(pat){
    const { data: pp } = await db.from('pattern_periods').select('*').eq('pattern_id',pat.id).order('period_no');
    S.PERIODS = pp||[];
  }
  const topVisible = TOP.filter(t=>t.show(S.FLAGS));
  const groupItems = Object.entries(GROUPS)
    .map(([gid,g])=>({gid, label:g.label, tabs:g.tabs.filter(t=>t.show(S.FLAGS))}))
    .filter(g=>g.tabs.length);
  const navCount = topVisible.length + groupItems.length;
  if(navCount>1){
    $('tabsNav').style.display='flex';
    $('tabsNav').innerHTML =
      topVisible.map(t=>`<button data-t="${t.id}">${t.label}</button>`).join('') +
      groupItems.map(g=>`<button data-g="${g.gid}">${g.label}</button>`).join('');
    $('tabsNav').querySelectorAll('button[data-t]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.t)));
    $('tabsNav').querySelectorAll('button[data-g]').forEach(b=>b.addEventListener('click',()=>{
      const g=groupItems.find(x=>x.gid===b.dataset.g);
      if(g?.tabs.length) openTab(g.tabs[0].id);
    }));
  }
  for(const t of topVisible) if(t.init) t.init();
  for(const g of groupItems) for(const t of g.tabs) if(t.init) t.init();
  const firstId = topVisible[0]?.id || groupItems[0]?.tabs[0]?.id || 'teacherMain';
  openTab(firstId);
}
async function login(){
  const btn=$('loginBtn'), m=$('loginMsg');
  m.className='msg'; btn.disabled=true; btn.textContent='جارٍ الدخول…';
  const { data, error } = await db.auth.signInWithPassword({ email:$('email').value.trim(), password:$('password').value });
  btn.disabled=false; btn.textContent='تسجيل الدخول';
  if(error){ m.className='msg err';
    m.textContent=/credentials/i.test(error.message)?'البريد أو كلمة المرور غير صحيحة.':'تعذر الدخول: '+error.message; return; }
  boot(data.session);
}
export async function start(){
  await loadSettings();
  $('loginBtn').addEventListener('click',login);
  $('password').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
  $('logoutBtn').addEventListener('click',async()=>{await db.auth.signOut();location.reload();});
  const { data:{ session } } = await db.auth.getSession();
  if(session) boot(session);
}
