/* department-final-reports.js — التقارير الختامية للأنشطة (تحت مجموعة "فعاليات")
   للمعلمة الأولى: تقريران ختاميان لكل فصل (داخلية/خارجية) مطابقان
   تماماً لقالب المدرسة المعتمد. بعض الإحصاءات (الموهوبات/المتميزات)
   ما نتتبعها بالنظام حالياً، فتُدخَل يدوياً قبل الطباعة. */
import { db, $, S, getCurrentSemester, getLogoUrl, printWithTitle, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="deptFinalReports" style="display:none">
  <div class="panel">
    <h3>التقرير الختامي للأنشطة اللاصفية (القسم)</h3>
    <div class="sub">البنود المحسوبة تلقائياً من سجلات الفعاليات، والبنود المتبقية (الموهوبات/المتميزات) تُدخَل يدوياً لأنها غير متتبَّعة بالنظام بعد.</div>
    <select id="dfrType" style="padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit;background:var(--white);margin-bottom:14px">
      <option value="internal">التقرير الختامي للأنشطة الداخلية</option>
      <option value="external">التقرير الختامي للأنشطة الخارجية</option>
    </select>
    <div id="dfrAutoStats" class="board-wrap"><table class="board" id="dfrAutoTable"></table></div>

    <div id="dfrManualInternal" style="margin-top:16px">
      <div class="field"><label>عدد الطالبات الموهوبات في القسم</label><input type="number" id="dfrGiftedCount" min="0"></div>
      <div class="field"><label>نسبة الطالبات المقدَّم لهن الدعم من إجمالي المتميزات</label><input type="text" id="dfrGiftedSupportPct" placeholder="مثال: 75%"></div>
      <div class="field"><label>عدد الأنشطة/المسابقات المقدَّمة للطالبات الموهوبات</label><input type="number" id="dfrGiftedActivities" min="0"></div>
      <div class="field"><label>عدد الطالبات الموهوبات المشاركات</label><input type="number" id="dfrGiftedParticipants" min="0"></div>
      <div class="field"><label>نسبة الموهوبات اللاتي حصلن الدعم</label><input type="text" id="dfrGiftedSupportedPct" placeholder="مثال: 60%"></div>
    </div>
    <div id="dfrManualExternal" style="display:none;margin-top:16px">
      <div class="field"><label>مراكز الفوز — محلية</label><input type="number" id="dfrWinsLocal" min="0"></div>
      <div class="field"><label>مراكز الفوز — دولية</label><input type="number" id="dfrWinsIntl" min="0"></div>
    </div>

    <button class="btn gold" id="dfrPrintBtn" style="width:auto;padding:10px 24px;margin-top:16px">🖨️ طباعة التقرير الختامي</button>
  </div>
</div>
<div id="printAreaDFR"></div>
<style>
  #printAreaDFR{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0.22in}
    body *{visibility:hidden}
    #printAreaDFR, #printAreaDFR *{visibility:visible}
    #printAreaDFR{display:block;position:absolute;inset-inline-start:0;top:0;width:100%}
    .dfr-head{text-align:center;margin-bottom:14px}
    .dfr-head img{height:0.95in;width:7.74in;object-fit:contain;margin-bottom:8px}
    .dfr-head h2{font-size:14px;color:#1d3d5c;margin:4px 0}
    .dfr-meta{font-size:12px;margin-bottom:10px}
    .dfr-tbl{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px}
    .dfr-tbl th{background:#eef1f5;border:1px solid #999;padding:6px}
    .dfr-tbl td{border:1px solid #999;padding:6px;text-align:center}
    .dfr-foot{display:flex;justify-content:space-around;margin-top:24px;font-size:11px;font-weight:700;text-align:center}
  }
</style>`);

async function initDeptFinalReports(){
  if($('dfrPrintBtn').dataset.ready) return;
  $('dfrPrintBtn').dataset.ready='1';
  $('dfrType').addEventListener('change',()=>{
    const isInternal=$('dfrType').value==='internal';
    $('dfrManualInternal').style.display=isInternal?'block':'none';
    $('dfrManualExternal').style.display=isInternal?'none':'block';
    loadAutoStats();
  });
  $('dfrPrintBtn').addEventListener('click',printReport);
  await loadAutoStats();
}

let AUTO_STATS=null;
async function loadAutoStats(){
  const type=$('dfrType').value;
  if(!S.ME.department_id){ $('dfrAutoTable').innerHTML='<tr><td>حسابك غير مرتبط بقسم</td></tr>'; return; }
  const {data:events}=await db.from('event_records').select('id, result').eq('academic_year_id',S.YEAR.id).eq('type',type).eq('department_id',S.ME.department_id).eq('semester',getCurrentSemester());
  const eventIds=(events||[]).map(e=>e.id);
  const {data:parts}=eventIds.length ? await db.from('event_participants').select('event_id,student_id').in('event_id',eventIds) : {data:[]};
  const uniqueParticipants=new Set((parts||[]).map(p=>p.student_id));

  if(type==='internal'){
    AUTO_STATS={ activityCount:(events||[]).length, participantCount:uniqueParticipants.size };
    $('dfrAutoTable').innerHTML=`<tr><th>البند</th><th>العدد (تلقائي)</th></tr>
      <tr><td>عدد الأنشطة والمسابقات المنفذة في المدرسة</td><td>${AUTO_STATS.activityCount}</td></tr>
      <tr><td>عدد الطالبات المشاركات في الأنشطة الداخلية</td><td>${AUTO_STATS.participantCount}</td></tr>`;
  }else{
    const withResult=(events||[]).filter(e=>e.result && e.result.trim());
    AUTO_STATS={ activityCount:(events||[]).length, participantCount:uniqueParticipants.size, winCount:withResult.length };
    $('dfrAutoTable').innerHTML=`<tr><th>البند</th><th>العدد (تلقائي)</th></tr>
      <tr><td>عدد الأنشطة والمسابقات الخارجية المشارك فيها الطالبات</td><td>${AUTO_STATS.activityCount}</td></tr>
      <tr><td>عدد الطالبات المشاركات في الأنشطة الخارجية</td><td>${AUTO_STATS.participantCount}</td></tr>
      <tr><td>عدد الفعاليات اللي فيها نتيجة/مركز مسجَّل</td><td>${AUTO_STATS.winCount}</td></tr>`;
  }
}

function printReport(){
  if(!AUTO_STATS){ return; }
  const type=$('dfrType').value;
  const semLabel=getCurrentSemester()===1?'الأول':'الثاني';
  const yearLabel=S.YEAR?.name||'';
  const deptName=S.ME.departments?.name||'';
  const logo=getLogoUrl();

  let tbl='';
  if(type==='internal'){
    tbl=`<table class="dfr-tbl"><tr><th>ت</th><th>إحصائية القسم</th><th>العدد</th></tr>
      <tr><td>1</td><td>عدد الأنشطة المنفذة في المدرسة / عدد المسابقات المنفذة في المدرسة</td><td>${AUTO_STATS.activityCount}</td></tr>
      <tr><td>2</td><td>نسبة مشاركة الطالبات في الأنشطة والمسابقات الداخلية</td><td>—</td></tr>
      <tr><td>3</td><td>عدد الطالبات المشاركات في الأنشطة الداخلية</td><td>${AUTO_STATS.participantCount}</td></tr>
      <tr><td>4</td><td>عدد الطالبات الموهوبات في القسم</td><td>${$('dfrGiftedCount').value||'—'}</td></tr>
      <tr><td>5</td><td>نسبة الطالبات المقدَّم لهن الدعم من العدد الكلي للطالبات المتميزات في القسم</td><td>${$('dfrGiftedSupportPct').value||'—'}</td></tr>
      <tr><td>6</td><td>عدد الأنشطة والمسابقات المقدَّمة للطالبات الموهوبات</td><td>${$('dfrGiftedActivities').value||'—'}</td></tr>
      <tr><td>7</td><td>عدد الطالبات الموهوبات المشاركات في الأنشطة والمسابقات</td><td>${$('dfrGiftedParticipants').value||'—'}</td></tr>
      <tr><td>8</td><td>نسبة الطالبات الموهوبات اللاتي حصلن الدعم من قبل القسم</td><td>${$('dfrGiftedSupportedPct').value||'—'}</td></tr>
      </table>`;
  }else{
    tbl=`<table class="dfr-tbl"><tr><th>ت</th><th>إحصائية القسم</th><th>العدد/النسبة</th></tr>
      <tr><td>1</td><td>عدد الأنشطة الخارجية المشارك فيها الطالبات مع القسم (محاضرة، ورشة، ملتقى، زيارة...)</td><td>${AUTO_STATS.activityCount}</td></tr>
      <tr><td>2</td><td>عدد المسابقات الخارجية المشارك فيها الطالبات مع القسم (محلية، إقليمية، دولية)</td><td>${AUTO_STATS.activityCount}</td></tr>
      <tr><td>3</td><td>عدد الطالبات المشاركات في الأنشطة الخارجية</td><td>${AUTO_STATS.participantCount}</td></tr>
      <tr><td>6</td><td>عدد مراكز الفوز في القسم — محلية</td><td>${$('dfrWinsLocal').value||'—'}</td></tr>
      <tr><td>6</td><td>عدد مراكز الفوز في القسم — دولية</td><td>${$('dfrWinsIntl').value||'—'}</td></tr>
      </table>`;
  }

  const title = type==='internal' ? 'التقرير الختامي للأنشطة اللاصفية الداخلية للقسم' : 'التقرير الختامي للأنشطة اللاصفية الخارجية للقسم';

  $('printAreaDFR').innerHTML=`
    <div class="dfr-head">${logo?`<img src="${logo}">`:''}<h2>${title} ${deptName}</h2><h2>خلال الفصل الدراسي ${semLabel} من العام ${yearLabel}م</h2></div>
    <div class="dfr-meta">منسّقة الأنشطة في القسم الأستاذة: ${S.ME.full_name}</div>
    ${tbl}
    <div class="dfr-foot">
      <span>إعداد<br>${S.SETTINGS.activities_coordinator_name||'—'}<br>رئيسة مشروع اترك بصمة</span>
      <span>منسّقة الأنشطة الطلابية والموهبة<br>المديرة المساعدة<br>${S.SETTINGS.deputy1_name||'—'}</span>
      <span>مديرة المدرسة<br>${S.SETTINGS.principal_name||'—'}</span>
    </div>`;
  printWithTitle(type==='internal'?'التقرير_الختامي_الداخلي':'التقرير_الختامي_الخارجي','printAreaDFR');
}

registerTab({id:'deptFinalReports', label:'التقارير الختامية', group:'events', groupLabel:'فعاليات',
  show:f=>f.isSeniorTeacher||f.isAdmin, init:initDeptFinalReports});
