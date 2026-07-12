/* core.js — الاتصال والجلسة والأدوات المشتركة (يستقر مبكراً ونادراً ما يتغير) */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const db = createClient('https://vvfxcoxnnuubycrpkwzj.supabase.co','sb_publishable_8JhfrwxXY9z3hYfi7E5tRg_eOFGxwv8');
export const $ = id => document.getElementById(id);

/* الحالة المشتركة بين الشاشات */
export const S = { ME:null, YEAR:null, PERIODS:[], FLAGS:{} };

export const roleNames = {admin:'الدعم الفني',leadership:'القيادة العليا',project_lead:'مسؤولة مشروع',
  committee_head:'رئيسة لجنة',plans_supervisor:'مسؤولة متابعة الخطط',analysis_supervisor:'مسؤولة تحليل الاختبارات'};
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

/* ============ سجل التبويبات — كل شاشة تسجّل نفسها ============ */
const TABS=[];
export function registerTab(t){ TABS.push(t); }
export function openTab(tid){
  for(const t of TABS){ const el=$(t.id); if(el) el.style.display = t.id===tid?'block':'none'; }
  document.querySelectorAll('#tabsNav button').forEach(b=>b.classList.toggle('on', b.dataset.t===tid));
  const t=TABS.find(x=>x.id===tid); if(t?.onOpen) t.onOpen();
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
    isReg:   /تسجيل/.test(dept),
    isTeacher: staff.title==='teacher'||staff.title==='senior_teacher',
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
  const visible = TABS.filter(t=>t.show(S.FLAGS));
  if(visible.length>1){
    $('tabsNav').style.display='flex';
    $('tabsNav').innerHTML = visible.map(t=>`<button data-t="${t.id}">${t.label}</button>`).join('');
    $('tabsNav').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.t)));
  }
  for(const t of visible) if(t.init) t.init();
  openTab(visible[0]?.id || 'teacherMain');
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
  $('loginBtn').addEventListener('click',login);
  $('password').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
  $('logoutBtn').addEventListener('click',async()=>{await db.auth.signOut();location.reload();});
  const { data:{ session } } = await db.auth.getSession();
  if(session) boot(session);
}
