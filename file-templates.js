/* file-templates.js — القوالب المعتمدة ومكتبة الملفات (تحت "الإعدادات")
   الأدمن يرفع قالب كشف الدرجات وقالب كشف الغياب مرة واحدة، ويحدد أين
   تُكتب بيانات الطالبات داخل القالب نفسه (عمود ورقم صف البداية) —
   فيصير كل معلمة تقدر تحمّل نسخة معبَّأة بأسماء طالباتها من تبويب
   "ملفات". يشمل أيضاً مكتبة ملفات عامة يرفعها الأدمن أي وقت. */
import { db, $, S, toast, bindDrop, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="fileTemplates" style="display:none">
  <div class="panel">
    <h3>قالب كشف الدرجات المعتمد</h3>
    <div class="sub">تُملأ نسخة منه تلقائياً بأسماء وأرقام طالبات كل معلمة عند التحميل من تبويب "ملفات".</div>
    <div class="dropzone" id="gtDrop"><b>ارفعي القالب (إكسل)</b><p id="gtCurrent">لا قالب مرفوع بعد</p>
      <input type="file" id="gtFile" accept=".xlsx,.xls" hidden></div>
    <div class="row" style="display:flex;gap:14px;flex-wrap:wrap;margin:14px 0">
      <div class="field" style="max-width:140px"><label>عمود الرقم الأكاديمي</label><input type="text" id="gtAcadCol" placeholder="B" maxlength="2"></div>
      <div class="field" style="max-width:140px"><label>عمود الاسم</label><input type="text" id="gtNameCol" placeholder="C" maxlength="2"></div>
      <div class="field" style="max-width:160px"><label>صف بداية البيانات</label><input type="number" id="gtStartRow" min="1" placeholder="6"></div>
      <div class="field" style="max-width:200px"><label>اسم الورقة (اختياري)</label><input type="text" id="gtSheetName" placeholder="افتراضياً أول ورقة"></div>
    </div>
    <button class="btn gold" id="gtSave" style="width:auto;padding:10px 24px">حفظ إعدادات القالب</button>
  </div>

  <div class="panel">
    <h3>قوالب خاصة بمقررات محددة</h3>
    <div class="sub">اختياري — لو مقرر أو أكثر (مثل الحاسوب أو الرياضة) له قالب مختلف عن القالب العام أعلاه، ارفعيه هنا واختاري كل المقررات اللي تستخدم نفس هذا القالب. غير هذي المقررات يستخدمن القالب العام تلقائياً.</div>
    <div class="field"><label>المقررات اللي تستخدم هذا القالب</label>
      <div id="gtSubjectChecks" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px"></div>
    </div>
    <div class="dropzone" id="gtSubDrop"><b id="gtSubFileLabel">ارفعي قالب هذي المقررات (إكسل)</b><p>اضغطي لاختيار الملف أو اسحبيه هنا — يُحفظ فقط بعد ما تضغطين الزر تحت</p>
      <input type="file" id="gtSubFile" accept=".xlsx,.xls" hidden></div>
    <div class="row" style="display:flex;gap:14px;flex-wrap:wrap;margin:14px 0">
      <div class="field" style="max-width:140px"><label>عمود الرقم الأكاديمي</label><input type="text" id="gtSubAcadCol" placeholder="B" maxlength="2" value="B"></div>
      <div class="field" style="max-width:140px"><label>عمود الاسم</label><input type="text" id="gtSubNameCol" placeholder="C" maxlength="2" value="C"></div>
      <div class="field" style="max-width:160px"><label>صف بداية البيانات</label><input type="number" id="gtSubStartRow" min="1" placeholder="6" value="6"></div>
      <div class="field" style="max-width:200px"><label>اسم الورقة (اختياري)</label><input type="text" id="gtSubSheetName" placeholder="افتراضياً أول ورقة"></div>
    </div>
    <button class="btn gold" id="gtSubSave" style="width:auto;padding:10px 24px">حفظ إعدادات قالب هذي المقررات</button>
    <button class="btn ghost" id="gtSubClear" style="width:auto;padding:10px 20px;display:none">➕ قالب جديد (إلغاء التعديل الحالي)</button>
    <div id="gtSubList" style="margin-top:18px"></div>
  </div>

  <div class="panel">
    <h3>قالب كشف الغياب المعتمد</h3>
    <div class="sub">نفس الفكرة — نسخة معبَّأة بأسماء طالبات كل شعبة تُتاح للمعلمة من تبويب "ملفات".</div>
    <div class="dropzone" id="atDrop"><b>ارفعي القالب (إكسل)</b><p id="atCurrent">لا قالب مرفوع بعد</p>
      <input type="file" id="atFile" accept=".xlsx,.xls" hidden></div>
    <div class="row" style="display:flex;gap:14px;flex-wrap:wrap;margin:14px 0">
      <div class="field" style="max-width:140px"><label>عمود الرقم الأكاديمي</label><input type="text" id="atAcadCol" placeholder="B" maxlength="2"></div>
      <div class="field" style="max-width:140px"><label>عمود الاسم</label><input type="text" id="atNameCol" placeholder="C" maxlength="2"></div>
      <div class="field" style="max-width:160px"><label>صف بداية البيانات</label><input type="number" id="atStartRow" min="1" placeholder="6"></div>
      <div class="field" style="max-width:200px"><label>اسم الورقة (اختياري)</label><input type="text" id="atSheetName" placeholder="افتراضياً أول ورقة"></div>
    </div>
    <button class="btn gold" id="atSave" style="width:auto;padding:10px 24px">حفظ إعدادات القالب</button>
  </div>

  <div class="panel">
    <h3>مكتبة الملفات العامة</h3>
    <div class="sub">أي ملف ترفعينه هنا يظهر فوراً لكل المعلمات من تبويب "ملفات" — للاستخدام العام (نماذج، تعاميم، إلخ).</div>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px">
      <input type="text" id="sfTitle" placeholder="عنوان الملف…" style="flex:1;min-width:200px;padding:10px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
    </div>
    <div class="dropzone" id="sfDrop"><b>اضغطي لاختيار الملف أو أفلتيه هنا</b><p>أي نوع ملف</p>
      <input type="file" id="sfFile" hidden></div>
    <div id="sfList" style="margin-top:16px"></div>
  </div>
</div>
<style>
  .sf-row{display:flex;justify-content:space-between;align-items:center;background:var(--white);border:1px solid var(--line);border-radius:9px;padding:10px 14px;margin-bottom:6px}
  .sf-row button{background:none;border:none;color:var(--err);cursor:pointer;font-size:13px}
</style>`);

const BUCKET='school-files';

async function initFT(){
  if($('gtSave').dataset.ready) return;
  $('gtSave').dataset.ready='1';
  await loadTemplate('grades');
  await loadTemplate('attendance');
  bindDrop($('gtDrop'),$('gtFile'), f=>stageTemplate('grades',f));
  bindDrop($('atDrop'),$('atFile'), f=>stageTemplate('attendance',f));
  $('gtSave').addEventListener('click',()=>saveTemplateConfig('grades'));
  $('atSave').addEventListener('click',()=>saveTemplateConfig('attendance'));
  bindDrop($('sfDrop'),$('sfFile'), uploadSharedFile);
  loadSharedFiles();

  const {data:subs}=await db.from('subjects').select('id,code').order('code');
  SUBJECTS=subs||[];
  $('gtSubjectChecks').innerHTML=SUBJECTS.map(s=>`
    <label style="display:flex;align-items:center;gap:6px;background:var(--sand);border-radius:8px;padding:7px 12px;font-size:12.5px;cursor:pointer">
      <input type="checkbox" value="${s.id}" class="gt-subj-chk"> ${s.code}
    </label>`).join('');
  bindDrop($('gtSubDrop'),$('gtSubFile'), stageSubjectTemplate);
  $('gtSubSave').addEventListener('click',saveSubjectTemplateConfig);
  $('gtSubClear').addEventListener('click',resetSubjectForm);
  loadSubjectTemplatesList();
}

let SUBJECTS=[];
let PENDING_FILE={grades:null, attendance:null}; // ملفات القالب العام (مرحلة قبل الحفظ)
let PENDING_SUB_FILE=null; // ملف قالب المقررات (مرحلة قبل الحفظ)
let EDITING_TEMPLATE_ID=null; // لو نعدّل قالب مقررات محفوظ أصلاً

function resetSubjectForm(){
  EDITING_TEMPLATE_ID=null; PENDING_SUB_FILE=null;
  $('gtSubjectChecks').querySelectorAll('.gt-subj-chk').forEach(c=>c.checked=false);
  $('gtSubFileLabel').textContent='ارفعي قالب هذي المقررات (إكسل)';
  $('gtSubAcadCol').value='B'; $('gtSubNameCol').value='C'; $('gtSubStartRow').value=6; $('gtSubSheetName').value='';
  $('gtSubClear').style.display='none';
}

function stageSubjectTemplate(file){
  PENDING_SUB_FILE=file;
  $('gtSubFileLabel').textContent=`الملف المختار: ${file.name} (يُحفظ بعد ما تضغطين الزر تحت)`;
}

async function saveSubjectTemplateConfig(){
  const subjectIds=[...$('gtSubjectChecks').querySelectorAll('.gt-subj-chk:checked')].map(c=>c.value);
  if(!subjectIds.length){ toast('اختاري مقرر واحد على الأقل'); return; }
  if(!PENDING_SUB_FILE && !EDITING_TEMPLATE_ID){ toast('ارفعي ملف القالب أولاً'); return; }
  const btn=$('gtSubSave'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    let filePath=null, fileName=null;
    if(PENDING_SUB_FILE){
      filePath=`templates/grades-${Date.now()}.${safeExt(PENDING_SUB_FILE.name)}`;
      const {error:upErr}=await db.storage.from(BUCKET).upload(filePath,PENDING_SUB_FILE,{upsert:true});
      if(upErr) throw upErr;
      fileName=PENDING_SUB_FILE.name;
    } else {
      // تعديل إعدادات بدون تغيير الملف — نجيب الملف الحالي من أول مقرر بنفس مجموعة التعديل
      const {data:cur}=await db.from('file_templates').select('file_path,file_name').eq('id',EDITING_TEMPLATE_ID).single();
      filePath=cur.file_path; fileName=cur.file_name;
    }
    const cfg={
      kind:'grades', file_path:filePath, file_name:fileName,
      academic_col: $('gtSubAcadCol').value.trim().toUpperCase()||'B',
      name_col: $('gtSubNameCol').value.trim().toUpperCase()||'C',
      start_row: +$('gtSubStartRow').value||6,
      sheet_name: $('gtSubSheetName').value.trim()||null,
      updated_by: S.ME.id, updated_at:new Date().toISOString(),
    };
    // لو كنا نعدّل مجموعة قديمة وتغيّرت المقررات المختارة، نحذف صفوف المقررات
    // القديمة اللي ما عادت مختارة، ونحدّث/نضيف الباقي.
    if(EDITING_TEMPLATE_ID){
      const {data:oldRows}=await db.from('file_templates').select('id,subject_id').eq('kind','grades').eq('file_path',filePath);
      const oldSubjectIds=(oldRows||[]).map(r=>r.subject_id);
      const toRemove=oldSubjectIds.filter(id=>!subjectIds.includes(id));
      if(toRemove.length) await db.from('file_templates').delete().eq('kind','grades').in('subject_id',toRemove);
    }
    const rows=subjectIds.map(sid=>({...cfg, subject_id:sid}));
    const {error}=await db.from('file_templates').upsert(rows,{onConflict:'kind,subject_id'});
    if(error) throw error;
    toast('تم حفظ قالب المقررات المختارة');
    resetSubjectForm();
    loadSubjectTemplatesList();
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ إعدادات قالب هذي المقررات'; }
}

async function loadSubjectTemplatesList(){
  const {data,error}=await db.from('file_templates').select('*, subjects(code)').eq('kind','grades').not('subject_id','is',null).order('updated_at',{ascending:false});
  if(error){ $('gtSubList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!data?.length){ $('gtSubList').innerHTML='<div class="empty-day">لا قوالب خاصة بمقررات بعد.</div>'; return; }
  // تجميع حسب نفس الملف (نفس file_path = نفس القالب المشترك بين مقررات)
  const groups={};
  for(const t of data) (groups[t.file_path] ??= {rows:[], ...t}).rows.push(t);
  $('gtSubList').innerHTML=Object.values(groups).map(g=>`
    <div class="sf-row" style="align-items:flex-start;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px">
        <span><b>${g.rows.map(r=>r.subjects?.code).join('، ')}</b> <small style="color:#8a93a0">${g.file_name}</small></span>
        <span>
          <button data-edit="${g.rows[0].id}" style="color:var(--navy)">✎ تعديل</button>
          <button data-del="${g.file_path}">✕ حذف</button>
        </span>
      </div>
      <small style="color:#8a93a0">عمود الرقم الأكاديمي: ${g.academic_col} · عمود الاسم: ${g.name_col} · صف البداية: ${g.start_row}${g.sheet_name?' · الورقة: '+g.sheet_name:''}</small>
    </div>`).join('');
  $('gtSubList').querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('حذف قالب هذي المقررات؟ ترجع كلها تستخدم القالب العام تلقائياً.')) return;
    await db.from('file_templates').delete().eq('kind','grades').eq('file_path',b.dataset.del);
    resetSubjectForm();
    loadSubjectTemplatesList();
  }));
  $('gtSubList').querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', async ()=>{
    const {data:row}=await db.from('file_templates').select('*').eq('id',b.dataset.edit).single();
    const {data:sameFile}=await db.from('file_templates').select('subject_id').eq('kind','grades').eq('file_path',row.file_path);
    EDITING_TEMPLATE_ID=row.id; PENDING_SUB_FILE=null;
    const selectedIds=new Set((sameFile||[]).map(r=>r.subject_id));
    $('gtSubjectChecks').querySelectorAll('.gt-subj-chk').forEach(c=>c.checked=selectedIds.has(c.value));
    $('gtSubFileLabel').textContent=`الملف الحالي: ${row.file_name} (ارفعي ملف جديد لتغييره، أو خليه واحفظي التعديلات بس)`;
    $('gtSubAcadCol').value=row.academic_col; $('gtSubNameCol').value=row.name_col;
    $('gtSubStartRow').value=row.start_row; $('gtSubSheetName').value=row.sheet_name||'';
    $('gtSubClear').style.display='inline-block';
    window.scrollTo({top:$('gtSubDrop').getBoundingClientRect().top+window.scrollY-100, behavior:'smooth'});
  }));
}

const PFX = kind => kind==='grades' ? 'gt' : 'at';

async function loadTemplate(kind){
  const p=PFX(kind);
  const {data}=await db.from('file_templates').select('*').eq('kind',kind).is('subject_id',null).maybeSingle();
  $(`${p}Current`).textContent = data ? `القالب الحالي: ${data.file_name}` : 'لا قالب مرفوع بعد';
  $(`${p}AcadCol`).value=data?.academic_col||'B';
  $(`${p}NameCol`).value=data?.name_col||'C';
  $(`${p}StartRow`).value=data?.start_row||6;
  $(`${p}SheetName`).value=data?.sheet_name||'';
}

function safeExt(filename){
  const m=/\.([a-zA-Z0-9]+)$/.exec(filename);
  return m ? m[1].toLowerCase() : 'xlsx';
}

async function stageTemplate(kind,file){
  PENDING_FILE[kind]=file;
  $(`${PFX(kind)}Current`).textContent=`الملف المختار: ${file.name} (يُحفظ بعد ما تضغطين "حفظ إعدادات القالب")`;
}

async function saveTemplateConfig(kind){
  const p=PFX(kind);
  const btn=$(`${p}Save`); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
  try{
    const {data:existing}=await db.from('file_templates').select('id,file_path,file_name').eq('kind',kind).is('subject_id',null).maybeSingle();
    let filePath=existing?.file_path||null, fileName=existing?.file_name||null;
    if(PENDING_FILE[kind]){
      const file=PENDING_FILE[kind];
      filePath=`templates/${kind}-${Date.now()}.${safeExt(file.name)}`;
      const {error:upErr}=await db.storage.from(BUCKET).upload(filePath,file,{upsert:true});
      if(upErr) throw upErr;
      fileName=file.name;
    }
    if(!filePath){ toast('ارفعي ملف القالب أولاً'); return; }
    const payload={
      kind, subject_id:null, file_path:filePath, file_name:fileName,
      academic_col: $(`${p}AcadCol`).value.trim().toUpperCase()||'B',
      name_col: $(`${p}NameCol`).value.trim().toUpperCase()||'C',
      start_row: +$(`${p}StartRow`).value||6,
      sheet_name: $(`${p}SheetName`).value.trim()||null,
      updated_by: S.ME.id, updated_at:new Date().toISOString(),
    };
    const {error}= existing
      ? await db.from('file_templates').update(payload).eq('id',existing.id)
      : await db.from('file_templates').insert(payload);
    if(error) throw error;
    toast('تم حفظ إعدادات القالب');
    PENDING_FILE[kind]=null;
    loadTemplate(kind);
  }catch(err){ toast('تعذر الحفظ: '+(err.message||err)); }
  finally{ btn.disabled=false; btn.textContent='حفظ إعدادات القالب'; }
}

async function uploadSharedFile(file){
  const title=$('sfTitle').value.trim()||file.name;
  const path=`shared/${Date.now()}.${safeExt(file.name)}`;
  const {error:upErr}=await db.storage.from(BUCKET).upload(path,file);
  if(upErr){ toast('تعذر رفع الملف: '+upErr.message); return; }
  const {error}=await db.from('shared_files').insert({title, file_path:path, file_name:file.name, uploaded_by:S.ME.id});
  if(error){ toast('تعذر الحفظ: '+error.message); return; }
  $('sfTitle').value='';
  toast('تم رفع الملف');
  loadSharedFiles();
}

async function loadSharedFiles(){
  const {data,error}=await db.from('shared_files').select('*').order('created_at',{ascending:false});
  if(error){ $('sfList').innerHTML=`<div class="empty-day">تعذر التحميل: ${error.message}</div>`; return; }
  if(!data?.length){ $('sfList').innerHTML='<div class="empty-day">لا ملفات مرفوعة بعد.</div>'; return; }
  $('sfList').innerHTML=data.map(f=>`
    <div class="sf-row"><span><b>${f.title}</b> <small style="color:#8a93a0">${f.file_name}</small></span>
      <button data-id="${f.id}">✕ حذف</button></div>`).join('');
  $('sfList').querySelectorAll('button').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('حذف هذا الملف؟')) return;
    await db.from('shared_files').delete().eq('id',b.dataset.id);
    loadSharedFiles();
  }));
}

registerTab({id:'fileTemplates', label:'القوالب والملفات', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initFT});
