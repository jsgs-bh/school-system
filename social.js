/* social.js — التأخير والاستئذان
   المنطق الجديد: التسجيل يُكتب في سجله الدائم فقط.
   رصد المعلمات لا يُلمس أبداً — والحالة الرسمية اليومية تُحسب لحظة العرض
   (في متابعة الرصد وقوائم الوزارة والتقارير) بدمج المصدرين. */
import { db, $, S, clean, dstr, toast, printWithTitle, registerTab } from './core.js';

const schoolName = () => S.SETTINGS.school_name || 'المدرسة';

$('appView').insertAdjacentHTML('beforeend', `
<div id="printAreaSocial"></div>
<style>
  #printAreaSocial{display:none}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    @page{margin:0}
    body *{visibility:hidden}
    #printAreaSocial, #printAreaSocial *{visibility:visible}
    #printAreaSocial{display:block;position:absolute;inset-inline-start:0;top:0;width:100%;padding:14mm 12mm}
    .soc-head{text-align:center;margin-bottom:12px}
    .soc-head h2{font-size:15px;color:#1d3d5c;font-weight:600;margin-bottom:6px}
    .soc-tbl{width:100%;border-collapse:collapse;font-size:11px}
    .soc-tbl th{background:#1d3d5c;color:#fff;padding:6px 5px;border:1px solid #1d3d5c}
    .soc-tbl td{padding:5px;border:1px solid #ccc;text-align:center}
  }
</style>`);

let SOC_DATE=new Date(), SOC_STU=null;

function initSocPick(){
  const sp=$('socPick');
  if(sp.dataset.ready) return;
  sp.dataset.ready='1';
  sp.value=dstr(SOC_DATE); sp.max=dstr(new Date());
  sp.addEventListener('change',()=>{ if(sp.value){ SOC_DATE=new Date(sp.value+'T12:00:00'); loadSocLists(); } });
  $('socTime').value=new Date().toTimeString().slice(0,5);
  let deb=null;
  $('socSearch').addEventListener('input',()=>{
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const q=clean($('socSearch').value);
      const box=$('socSugg');
      if(q.length<2){ box.style.display='none'; return; }
      const {data:st}=await db.from('students')
        .select('id,full_name,academic_number').eq('status','active')
        .or(`full_name.ilike.%${q}%,academic_number.ilike.%${q}%`).limit(8);
      if(!(st||[]).length){ box.style.display='none'; return; }
      box.innerHTML=(st||[]).map(s=>`<div data-id="${s.id}" data-n="${s.full_name}" data-a="${s.academic_number}">${s.full_name}<small>${s.academic_number}</small></div>`).join('');
      box.style.display='block';
      box.querySelectorAll('div').forEach(el=>el.addEventListener('click',()=>{
        SOC_STU={id:el.dataset.id, name:el.dataset.n, acad:el.dataset.a};
        $('socName').textContent=SOC_STU.name; $('socInfo').textContent=SOC_STU.acad;
        $('socPicked').style.display='block'; box.style.display='none';
        $('socSearch').value=''; $('socTime').value=new Date().toTimeString().slice(0,5);
      }));
    },300);
  });
  $('socSave').addEventListener('click',saveSoc);
  $('socXls').addEventListener('click',exportXls);
  $('socPdf').addEventListener('click',exportPdf);
}

async function saveSoc(){
  if(!SOC_STU){ toast('اختاري الطالبة أولاً'); return; }
  const type=$('socType').value, time=$('socTime').value, reason=clean($('socReason').value);
  if(!time){ toast('حددي الوقت'); return; }
  const btn=$('socSave'); btn.disabled=true;
  try{
    if(type==='late'){
      const {error}=await db.from('late_log').upsert(
        {student_id:SOC_STU.id, date:dstr(SOC_DATE), arrival_time:time, recorded_by:S.ME.id, note:reason||null},
        {onConflict:'student_id,date'});
      if(error) throw error;
    }else{
      const {error}=await db.from('excuse_log').upsert(
        {student_id:SOC_STU.id, date:dstr(SOC_DATE), exit_time:time, reason:reason||null, recorded_by:S.ME.id},
        {onConflict:'student_id,date'});
      if(error) throw error;
    }
    /* لا نعدّل attendance_records — رصد المعلمات حقيقة تاريخية،
       والحالة اليومية الرسمية تُحسب تلقائياً عند العرض. */
    await db.from('audit_log').insert({actor_id:S.ME.id, action:type, entity:type==='late'?'late_log':'excuse_log',
      details:{student:SOC_STU.name, date:dstr(SOC_DATE), time}});
    toast(type==='late'
      ? 'سُجل التأخير — ستُحتسب حاضرة في الغياب الرسمي اليومي تلقائياً'
      : 'سُجل الاستئذان — ستُحتسب حاضرة في الغياب الرسمي اليومي تلقائياً');
    SOC_STU=null; $('socPicked').style.display='none'; $('socReason').value='';
    loadSocLists();
  }catch(err){ toast('تعذر التسجيل: '+(err.message||err)); }
  finally{ btn.disabled=false; }
}

let CUR_ROWS=[];
async function loadSocial(){ initSocPick(); loadSocLists(); }
async function loadSocLists(){
  const box=$('socList');
  box.innerHTML='<div class="empty-day">جارٍ التحميل…</div>';
  const [{data:late},{data:exc}] = await Promise.all([
    db.from('late_log').select('id,arrival_time,note,students(full_name,academic_number)').eq('date',dstr(SOC_DATE)).order('arrival_time'),
    db.from('excuse_log').select('id,exit_time,reason,students(full_name,academic_number)').eq('date',dstr(SOC_DATE)).order('exit_time'),
  ]);
  const rows=[
    ...(late||[]).map(l=>({t:'late',id:l.id,time:l.arrival_time?.slice(0,5),name:l.students?.full_name,acad:l.students?.academic_number,extra:l.note})),
    ...(exc||[]).map(l=>({t:'excuse',id:l.id,time:l.exit_time?.slice(0,5),name:l.students?.full_name,acad:l.students?.academic_number,extra:l.reason})),
  ];
  CUR_ROWS=rows;
  if(!rows.length){ box.innerHTML='<div class="empty-day">لا سجلات في هذا اليوم.</div>'; return; }
  box.innerHTML=rows.map(r=>`
    <div class="logrow">
      <span style="font-size:16px">${r.t==='late'?'⏰':'🚪'}</span>
      <span><b>${r.name||'—'}</b> <small>${r.acad||''}</small><br>
      <small>${r.t==='late'?'وصلت':'خرجت'} الساعة ${r.time||''}${r.extra?' · '+r.extra:''}</small></span>
      <button class="del" data-t="${r.t}" data-id="${r.id}" title="حذف">✕</button>
    </div>`).join('');
  box.querySelectorAll('.del').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('حذف هذا السجل؟ ستعود الطالبة تُحتسب غائبة في القوائم الرسمية تلقائياً.')) return;
    await db.from(b.dataset.t==='late'?'late_log':'excuse_log').delete().eq('id',b.dataset.id);
    loadSocLists();
  }));
}

/* ============ تصدير ============ */
const NAVY='FF1D3D5C', WHITE='FFFFFFFF', LINE='FFDCD5C8';
const socBorder={top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}}};
async function exportXls(){
  if(!CUR_ROWS.length){ toast('لا سجلات لهذا اليوم'); return; }
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('التأخير والاستئذان',{views:[{rightToLeft:true}]});
  const addTitle=(text,size,bold,fill,color)=>{
    const row=ws.addRow([text]); ws.mergeCells(row.number,1,row.number,5);
    const cell=row.getCell(1); cell.font={name:'Arial',size,bold,color:{argb:color}};
    cell.alignment={horizontal:'center',vertical:'middle'};
    if(fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
    row.height=size>=16?26:20;
  };
  addTitle(schoolName(),16,true,NAVY,WHITE);
  addTitle(`التأخير والاستئذان — ${dstr(SOC_DATE)}`,12,true,null,'FF22303C');
  ws.addRow([]);
  const hdr=ws.addRow(['النوع','اسم الطالبة','الرقم الأكاديمي','الوقت','السبب/ملاحظة']);
  hdr.eachCell(c=>{ c.font={bold:true,color:{argb:WHITE}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; c.alignment={horizontal:'center'}; c.border=socBorder; });
  CUR_ROWS.forEach((r,i)=>{
    const row=ws.addRow([r.t==='late'?'تأخير':'استئذان', r.name||'', r.acad||'', r.time||'', r.extra||'']);
    row.eachCell((c,colNo)=>{ c.border=socBorder; c.alignment={horizontal:colNo===2?'right':'center'}; c.font={size:10.5}; c.numFmt='@';
      if(i%2===1) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F2EC'}}; });
  });
  ws.columns=[{width:12},{width:28},{width:16},{width:10},{width:24}];
  ws.views=[{rightToLeft:true,state:'frozen',ySplit:3}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`التأخير_والاستئذان_${dstr(SOC_DATE)}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}
function exportPdf(){
  if(!CUR_ROWS.length){ toast('لا سجلات لهذا اليوم'); return; }
  const rows=CUR_ROWS.map(r=>`<tr><td>${r.t==='late'?'تأخير':'استئذان'}</td><td style="text-align:right">${r.name||''}</td><td>${r.acad||''}</td><td>${r.time||''}</td><td>${r.extra||'—'}</td></tr>`).join('');
  $('printAreaSocial').innerHTML=`
    <div class="soc-head"><h2>التأخير والاستئذان — ${dstr(SOC_DATE)}</h2></div>
    <table class="soc-tbl"><tr><th>النوع</th><th>اسم الطالبة</th><th>الرقم الأكاديمي</th><th>الوقت</th><th>السبب/ملاحظة</th></tr>${rows}</table>`;
  printWithTitle(`التأخير_والاستئذان_${dstr(SOC_DATE)}`);
}

registerTab({id:'socialMain', label:'التأخير والاستئذان', group:'attendance', groupLabel:'متابعة الغياب',
  show:f=>f.isAdmin||f.isSocial||f.isAttendanceLead, onOpen:loadSocial});
