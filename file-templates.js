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
  bindDrop($('gtDrop'),$('gtFile'), f=>uploadTemplate('grades',f));
  bindDrop($('atDrop'),$('atFile'), f=>uploadTemplate('attendance',f));
  $('gtSave').addEventListener('click',()=>saveTemplateConfig('grades'));
  $('atSave').addEventListener('click',()=>saveTemplateConfig('attendance'));
  bindDrop($('sfDrop'),$('sfFile'), uploadSharedFile);
  loadSharedFiles();
}

const PFX = kind => kind==='grades' ? 'gt' : 'at';

async function loadTemplate(kind){
  const p=PFX(kind);
  const {data}=await db.from('file_templates').select('*').eq('kind',kind).maybeSingle();
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

async function uploadTemplate(kind,file){
  const path=`templates/${kind}-${Date.now()}.${safeExt(file.name)}`;
  const {error:upErr}=await db.storage.from(BUCKET).upload(path,file,{upsert:true});
  if(upErr){ toast('تعذر رفع الملف: '+upErr.message); return; }
  const {error}=await db.from('file_templates').upsert({
    kind, file_path:path, file_name:file.name, updated_by:S.ME.id, updated_at:new Date().toISOString()
  },{onConflict:'kind'});
  if(error){ toast('تعذر الحفظ: '+error.message); return; }
  toast('تم رفع القالب — حدّدي إعدادات المواقع واحفظيها');
  loadTemplate(kind);
}

async function saveTemplateConfig(kind){
  const p=PFX(kind);
  const payload={
    kind,
    academic_col: $(`${p}AcadCol`).value.trim().toUpperCase()||'B',
    name_col: $(`${p}NameCol`).value.trim().toUpperCase()||'C',
    start_row: +$(`${p}StartRow`).value||6,
    sheet_name: $(`${p}SheetName`).value.trim()||null,
    updated_by: S.ME.id, updated_at:new Date().toISOString(),
  };
  const {data:existing}=await db.from('file_templates').select('id').eq('kind',kind).maybeSingle();
  if(!existing){ toast('ارفعي ملف القالب أولاً'); return; }
  const {error}=await db.from('file_templates').update(payload).eq('kind',kind);
  if(error){ toast('تعذر الحفظ: '+error.message); return; }
  toast('تم حفظ إعدادات القالب');
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
