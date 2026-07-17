/* audit-log.js — سجل العمليات (تحت "الإعدادات")
   من، ماذا، متى — يعرض جدول audit_log الموجود مسبقاً في النظام
   (actor_id, action, entity, details) والمُستخدَم فعلياً من عدة ملفات
   (admin.js، teacher.js، social.js، ministry.js، grades-entry.js). */
import { db, $, S, toast, printWithTitle, printHeaderHtml, printFooterHtml, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main wide" id="auditLog" style="display:none">
  <div class="panel">
    <h3>سجل العمليات</h3>
    <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <input type="text" id="alSearch" placeholder="ابحثي باسم المنتسبة أو نوع الإجراء…" style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font:inherit">
      <label style="font-size:13px;color:var(--navy)">من <input type="date" id="alFrom"></label>
      <label style="font-size:13px;color:var(--navy)">إلى <input type="date" id="alTo"></label>
      <button class="btn gold" id="alApply" style="width:auto;padding:9px 20px">تطبيق</button>
    </div>
  </div>
  <div class="panel">
    <div class="actions" style="margin-bottom:14px">
      <button class="btn ghost" id="alXls">⬇ إكسل</button>
      <button class="btn ghost" id="alPdf">⬇ PDF</button>
    </div>
    <div class="board-wrap"><table class="board" id="alTable"></table></div>
  </div>
</div>
<div id="printAreaAL"></div>
<style>
  #auditLog.wide{max-width:1400px}
  #printAreaAL{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaAL, #printAreaAL *{visibility:visible}
    #printAreaAL{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
    .al-tbl{width:100%;border-collapse:collapse;font-size:10.5px}
    .al-tbl th,.al-tbl td{border:1px solid #ccc;padding:6px;text-align:center}
    .al-tbl th{background:#1d3d5c;color:#fff}
  }
</style>`);

const ACTION_LABEL={import:'استيراد', grades:'رصد درجات', attendance:'رصد غياب', late:'تأخير', excuse:'استئذان', followup:'متابعة'};
let ROWS=[];

async function initAL(){
  if($('alApply').dataset.ready) return;
  $('alApply').dataset.ready='1';
  const today=new Date().toISOString().slice(0,10);
  $('alTo').value=today; $('alFrom').value=today.slice(0,8)+'01';
  $('alApply').addEventListener('click',load);
  $('alXls').addEventListener('click',exportXls);
  $('alPdf').addEventListener('click',exportPdf);
  await load();
}

function detailsText(details){
  if(!details) return '—';
  if(typeof details==='string') return details;
  try{ return Object.entries(details).map(([k,v])=>`${k}: ${v}`).join(' — '); }
  catch{ return JSON.stringify(details); }
}

async function load(){
  const from=$('alFrom').value, to=$('alTo').value, q=$('alSearch').value.trim();
  let query=db.from('audit_log').select('*').gte('created_at',from).lte('created_at',to+'T23:59:59').order('created_at',{ascending:false}).limit(1000);
  const {data,error}=await query;
  if(error){ $('alTable').innerHTML=`<tr><td style="padding:20px;text-align:center;color:#8a93a0">تعذر التحميل: ${error.message}</td></tr>`; return; }
  const rows=data||[];
  const actorIds=[...new Set(rows.map(r=>r.actor_id).filter(Boolean))];
  let nameById={};
  if(actorIds.length){
    const {data:staffRows}=await db.from('staff').select('id,full_name').in('id',actorIds);
    for(const s of staffRows||[]) nameById[s.id]=s.full_name;
  }
  for(const r of rows) r._staffName=nameById[r.actor_id]||null;
  ROWS=rows.filter(r=>{
    if(!q) return true;
    const ql=q.toLowerCase();
    return (r._staffName||'').toLowerCase().includes(ql) || (ACTION_LABEL[r.action]||r.action||'').toLowerCase().includes(ql) || (r.entity||'').toLowerCase().includes(ql);
  });
  render();
}

function render(){
  if(!ROWS.length){ $('alTable').innerHTML='<tr><td style="padding:30px;text-align:center;color:#8a93a0">لا سجلات ضمن هذي الفترة</td></tr>'; return; }
  $('alTable').innerHTML='<tr><th>التاريخ والوقت</th><th>من</th><th>ماذا (الإجراء)</th><th>الوحدة</th><th>تفاصيل</th></tr>'+
    ROWS.map(r=>`<tr><td class="c">${new Date(r.created_at).toLocaleString('ar')}</td><td class="c">${r._staffName||'—'}</td>
      <td class="c">${ACTION_LABEL[r.action]||r.action}</td><td class="c">${r.entity}</td><td>${detailsText(r.details)}</td></tr>`).join('');
}

const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const alBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function exportXls(){
  if(!ROWS.length){ toast('لا بيانات للتصدير'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('سجل العمليات',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,5);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(S.SETTINGS.school_name||'المدرسة',16,true,NAVY,WHITE);
  addTitle('سجل العمليات',12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['التاريخ والوقت','من','ماذا (الإجراء)','الوحدة','تفاصيل']);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=alBorder; });
  ROWS.forEach((r,i)=>{
    const row=ws.addRow([new Date(r.created_at).toLocaleString('ar'), r._staffName||'', ACTION_LABEL[r.action]||r.action, r.entity, detailsText(r.details)]);
    row.eachCell((c,colNo)=>{ c.border=alBorder; c.alignment={horizontal:colNo>=5?'right':'center'}; c.font={size:10};
      if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
  });
  ws.columns=[{width:20},{width:20},{width:16},{width:16},{width:40}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='سجل_العمليات.xlsx'; a.click();
  URL.revokeObjectURL(url);
}
function exportPdf(){
  if(!ROWS.length){ toast('لا بيانات للتصدير'); return; }
  const rows=ROWS.map(r=>`<tr><td>${new Date(r.created_at).toLocaleString('ar')}</td><td>${r._staffName||''}</td>
    <td>${ACTION_LABEL[r.action]||r.action}</td><td>${r.entity}</td><td>${detailsText(r.details)}</td></tr>`).join('');
  $('printAreaAL').innerHTML=`
    ${printHeaderHtml('سجل العمليات')}
    <table class="al-tbl"><tr><th>التاريخ والوقت</th><th>من</th><th>ماذا</th><th>الوحدة</th><th>تفاصيل</th></tr>${rows}</table>
    ${printFooterHtml('الدعم الفني', S.ME.full_name)}`;
  printWithTitle('سجل_العمليات','printAreaAL');
}

registerTab({id:'auditLog', label:'سجل العمليات', group:'settings', groupLabel:'الإعدادات',
  show:f=>f.isAdmin, init:initAL});
