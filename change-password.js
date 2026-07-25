/* change-password.js — تغيير كلمة السر (لكل منتسبة) */
import { db, $, S, toast, registerTab } from './core.js';

$('appView').insertAdjacentHTML('beforeend', `
<div class="app-main" id="changePassword" style="display:none">
  <div class="panel">
    <h3>تغيير كلمة السر</h3>
    <div class="field"><label>كلمة السر الجديدة</label><input type="password" id="cpNew1" autocomplete="new-password"></div>
    <div class="field"><label>تأكيد كلمة السر الجديدة</label><input type="password" id="cpNew2" autocomplete="new-password"></div>
    <div class="result" id="cpStatus" style="display:none"></div>
    <button class="btn gold" id="cpSaveBtn" style="width:auto;padding:11px 26px">حفظ كلمة السر الجديدة</button>
  </div>
</div>`);

async function initChangePassword(){
  if($('cpSaveBtn').dataset.ready) return;
  $('cpSaveBtn').dataset.ready='1';
  $('cpSaveBtn').addEventListener('click', async ()=>{
    const p1=$('cpNew1').value, p2=$('cpNew2').value;
    const status=$('cpStatus'); status.style.display='block';
    if(!p1 || p1.length<6){ status.className='result err'; status.textContent='كلمة السر يجب أن تكون 6 أحرف على الأقل'; return; }
    if(p1!==p2){ status.className='result err'; status.textContent='كلمتا السر غير متطابقتين'; return; }
    const btn=$('cpSaveBtn'); btn.disabled=true; btn.textContent='جارٍ الحفظ…';
    try{
      const {error}=await db.auth.updateUser({password:p1});
      if(error) throw error;
      status.className='result ok'; status.textContent='✅ تم تغيير كلمة السر بنجاح';
      $('cpNew1').value=''; $('cpNew2').value='';
      toast('تم تغيير كلمة السر');
    }catch(err){
      status.className='result err'; status.textContent='تعذر التغيير: '+(err.message||err);
    }finally{ btn.disabled=false; btn.textContent='حفظ كلمة السر الجديدة'; }
  });
}

registerTab({id:'changePassword', label:'تغيير كلمة السر', group:'settings', groupLabel:'الإعدادات',
  show:()=>true, init:initChangePassword});
