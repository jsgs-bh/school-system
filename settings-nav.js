/* settings-nav.js — يبني تجميعتين مطلوبتين تحت "الإعدادات":
   1) "السنوات الدراسية" (تحتها: السنوات الدراسية + الترحيل)
   2) "الطالبات" (تحتها: طالبات المدرسة [وفيها قوائم الصفوف] + فئات
      التصنيف + الحالات الخاصة + سجل المتخرجات)
   كل شاشة فرعية تبقى بملفها الأصلي بالضبط (نفس الـHTML ونفس دوال
   init الخاصة فيها) — هذا الملف بس يعيد تركيبها تحت تبويب واحد
   بنفس أسلوب التبويب الداخلي المستخدَم أصلاً بـ"اترك بصمة". يُحمَّل
   هذا الملف بعد كل الشاشات المصدر (آخر الاستيرادات بـ index.html)
   عشان عناصرها تكون موجودة بالـDOM وقت التركيب. */
import { $, S, registerTab } from './core.js';
import { initAY } from './academic-years.js';
import { initPromotion } from './promotion.js';
import { initAdminStudents } from './admin-students.js';
import { initCategories } from './grades-settings.js';
import { initSC } from './special-cases.js';
import { initGraduates } from './graduates.js';

/* يبني تبويباً مُجمِّعاً واحداً: تبنيّة فرعية خفيفة أعلى الشاشة، وتحتها
   الشاشات الفرعية (أُعيد تركيبها هنا من عناصرها الأصلية) تظهر وحدة
   بوحدة. children: [{id, label, show, init}] */
function buildHub(hubId, wide, children){
  const wrap=document.createElement('div');
  wrap.className='app-main'+(wide?' wide':'');
  wrap.id=hubId;
  wrap.style.display='none';
  const nav=document.createElement('div');
  nav.className='lm-subnav';
  nav.id=hubId+'Nav';
  wrap.appendChild(nav);
  $('appView').appendChild(wrap);
  for(const c of children){
    const el=$(c.id);
    if(el) wrap.appendChild(el);
  }
  return wrap;
}

function renderHubNav(hubId, children, activeId){
  const vis=children.filter(c=>!c.show||c.show(S.FLAGS));
  const nav=$(hubId+'Nav');
  nav.innerHTML=vis.map(c=>`<button class="lm-subnav-btn ${c.id===activeId?'active':''}" data-hc="${c.id}">${c.label}</button>`).join('');
  nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openHubChild(hubId,children,b.dataset.hc)));
}

async function openHubChild(hubId, children, childId){
  for(const c of children){
    const el=$(c.id); if(!el) continue;
    el.style.display = c.id===childId ? 'block' : 'none';
  }
  renderHubNav(hubId, children, childId);
  const child=children.find(c=>c.id===childId);
  if(child?.init) await child.init();
}

function firstVisible(children){
  return children.find(c=>!c.show||c.show(S.FLAGS));
}

/* ============ تبويب "السنوات الدراسية" ============ */
const YEARS_CHILDREN=[
  {id:'academicYears', label:'السنوات الدراسية', init:initAY},
  {id:'promotion', label:'الترحيل', init:initPromotion},
];
function buildYearsHub(){
  if($('settingsYears')) return;
  buildHub('settingsYears', false, YEARS_CHILDREN);
}
async function initYearsHub(){
  buildYearsHub();
  const first=firstVisible(YEARS_CHILDREN);
  if(first) await openHubChild('settingsYears', YEARS_CHILDREN, first.id);
}
registerTab({id:'settingsYears', label:'السنوات الدراسية', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initYearsHub});

/* ============ تبويب "الطالبات" ============ */
const STUDENTS_CHILDREN=[
  {id:'adminStudents', label:'طالبات المدرسة', show:f=>f.isAdmin, init:initAdminStudents},
  {id:'settingsCategories', label:'فئات التصنيف', show:f=>f.isAdmin, init:initCategories},
  {id:'specialCases', label:'الحالات الخاصة', show:f=>f.isAdmin, init:initSC},
  {id:'graduates', label:'سجل المتخرجات', show:f=>f.isAdmin||f.isReg, init:initGraduates},
];
function buildStudentsHub(){
  if($('settingsStudentsHub')) return;
  buildHub('settingsStudentsHub', true, STUDENTS_CHILDREN);
}
async function initStudentsHub(){
  buildStudentsHub();
  const first=firstVisible(STUDENTS_CHILDREN);
  if(first) await openHubChild('settingsStudentsHub', STUDENTS_CHILDREN, first.id);
}
registerTab({id:'settingsStudentsHub', label:'الطالبات', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin||f.isReg, init:initStudentsHub});
