(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MechanicSetup=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const SETUP_VERSION=1;
 function needsSetup(settings){return !(Number(settings?.setupVersion)>=SETUP_VERSION);}
 function draftFromPreferences(preferences){
  const s=preferences?.settings||{};
  return {monthlyBudget:s.monthlyBudget==null?'':String(s.monthlyBudget),member:!!s.member,planMode:s.planMode==='wishlist'?'wishlist':'collection',zip:String(s.zip||''),storeName:String(s.storeName||'')};
 }
 function validateDraft(value){
  const draft=value&&typeof value==='object'?value:{};
  const raw=draft.monthlyBudget==null?'':String(draft.monthlyBudget).trim();
  const budget=raw===''?null:Number(raw),zip=String(draft.zip||'').trim();
  const errors={};
  if(budget!==null&&(!Number.isFinite(budget)||budget<0))errors.monthlyBudget='Enter a monthly budget of $0 or more, or leave it blank.';
  if(zip&&!/^\d{5}$/.test(zip))errors.zip='Enter a five-digit ZIP code, or leave it blank.';
  return {valid:Object.keys(errors).length===0,errors,settings:{monthlyBudget:budget,member:!!draft.member,planMode:draft.planMode==='wishlist'?'wishlist':'collection',zip,storeName:String(draft.storeName||'').trim().slice(0,120)}};
 }
 function settingsAfterSetup(settings,draft,{skip=false}={}){
  const current=settings&&typeof settings==='object'?settings:{};
  if(skip)return {...current,setupVersion:SETUP_VERSION};
  const result=validateDraft(draft);
  if(!result.valid)return null;
  return {...current,...result.settings,setupVersion:SETUP_VERSION};
 }
 function create(api){
  const doc=api.document||(typeof document!=='undefined'?document:null);
  let dialog=null,step=0;
  const $=id=>doc.getElementById(id);
  function readDraft(){return {monthlyBudget:$('setup-budget').value,member:$('setup-member').checked,planMode:$('setup-plan-mode').value,zip:$('setup-zip').value,storeName:$('setup-store').value};}
  function showError(errors){
   $('setup-error').textContent=Object.values(errors).join(' ');
   $('setup-budget').setAttribute('aria-invalid',String(!!errors.monthlyBudget));
   $('setup-zip').setAttribute('aria-invalid',String(!!errors.zip));
   if(errors.monthlyBudget)$('setup-budget').focus();else if(errors.zip)$('setup-zip').focus();
  }
  function renderStep(){
   dialog.querySelectorAll('[data-setup-panel]').forEach(el=>{el.hidden=Number(el.dataset.setupPanel)!==step;});
   dialog.querySelectorAll('[data-setup-marker]').forEach(el=>{const current=Number(el.dataset.setupMarker)===step;el.classList.toggle('setup-current',current);if(current)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
   $('setup-step-label').textContent=`Step ${step+1} of 3`;
   $('setup-back').hidden=step===0;
   $('setup-next').textContent=step===2?'Save and get started':'Continue';
   $('setup-error').textContent='';
   dialog.scrollTop=0;
  }
  function skip(){
   api.update(p=>{p.settings=settingsAfterSetup(p.settings,null,{skip:true});});
   dialog.close();
  }
  function advance(){
   const result=validateDraft(readDraft()),errors={};
   if((step===0||step===2)&&result.errors.monthlyBudget)errors.monthlyBudget=result.errors.monthlyBudget;
   if((step===1||step===2)&&result.errors.zip)errors.zip=result.errors.zip;
   if($('setup-budget').validity?.badInput&&(step===0||step===2))errors.monthlyBudget='Enter a monthly budget of $0 or more, or leave it blank.';
   if(Object.keys(errors).length){showError(errors);return;}
   if(step<2){step++;renderStep();(step===1?$('setup-plan-mode'):$('setup-open-tools')).focus();return;}
   const next=settingsAfterSetup(api.getPreferences()?.settings,readDraft());
   if(!next){showError(result.errors);return;}
   const openTools=$('setup-open-tools').checked;
   api.update(p=>{p.settings={...p.settings,...next};});
   dialog.close();
   if(openTools&&typeof api.openMyTools==='function')api.openMyTools();
  }
  function mount(){
   if(dialog)return;
   if(!doc)throw new Error('Setup requires a browser document.');
   dialog=doc.createElement('dialog');dialog.id='mechanic-setup-dialog';dialog.className='setup-dialog';dialog.setAttribute('aria-labelledby','setup-title');dialog.setAttribute('aria-describedby','setup-description');
   dialog.innerHTML=`<form id="setup-form" class="setup-form" novalidate>
    <div class="setup-heading"><div><span class="setup-eyebrow">Your garage, your pace</span><h2 id="setup-title">Make this your tool shop</h2></div><button type="button" id="setup-dismiss" class="setup-close" aria-label="Skip setup for now">×</button></div>
    <p id="setup-description">Tell us what you want to buy and what you already own. Your choices stay in this browser, and you can change them anytime.</p>
    <p id="setup-step-label" class="setup-step-label" aria-live="polite">Step 1 of 3</p>
    <ol class="setup-progress" aria-label="Setup steps"><li data-setup-marker="0">Budget</li><li data-setup-marker="1">Shopping</li><li data-setup-marker="2">My tools</li></ol>
    <section data-setup-panel="0" class="setup-panel"><h3>Buy at a pace that works for you</h3><p>The buying list can stay within your monthly budget. Record purchases as you go to keep the remaining amount up to date.</p>
     <label for="setup-budget">Monthly tool budget <span class="setup-optional">optional</span></label><div class="setup-money"><span aria-hidden="true">$</span><input id="setup-budget" name="monthlyBudget" type="number" inputmode="decimal" min="0" step="0.01" placeholder="No monthly limit" aria-describedby="setup-budget-hint"></div><small id="setup-budget-hint">Leave blank for no limit. $0 pauses buying suggestions.</small>
     <label class="setup-check"><input id="setup-member" type="checkbox"><span>I have an Inside Track Club membership<small>Include member offers in my buying suggestions. Public and member prices are always shown separately.</small></span></label>
    </section>
    <section data-setup-panel="1" class="setup-panel" hidden><h3>Choose how you want to shop</h3><label for="setup-plan-mode">What should the buying list help with?</label><select id="setup-plan-mode"><option value="collection">Build my collection — fill remaining tool needs</option><option value="wishlist">My wish list — only tools I have saved</option></select><p class="setup-help">You can switch between both modes anytime. Save a tool with its bookmark button to add it to your wish list.</p>
     <div class="setup-fields"><label for="setup-zip">ZIP code <span class="setup-optional">optional</span><input id="setup-zip" type="text" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{5}" maxlength="5" placeholder="e.g. 95051"></label><label for="setup-store">Preferred store <span class="setup-optional">optional</span><input id="setup-store" type="text" maxlength="120" placeholder="Store name or number"></label></div><small>Your store is a saved shopping reference. Check Harbor Freight for local stock and store-specific prices.</small>
    </section>
    <section data-setup-panel="2" class="setup-panel" hidden><h3>Start with the tools in your garage</h3><p>In My tools, search for what you own, add individual tools or sets, and choose sizes when needed. Tools you already cover can be hidden from deals.</p><p id="setup-owned-summary" class="setup-owned-summary"></p><label class="setup-check"><input id="setup-open-tools" type="checkbox" checked><span>Open My tools after setup<small>Add what I own now. I can come back and change it later.</small></span></label><p class="setup-help">Your existing tools, purchases, saved products, and notes will stay in place. No account is needed. Use Backup to keep a copy.</p></section>
    <p id="setup-error" class="setup-error" role="alert"></p><div class="setup-actions"><button type="button" id="setup-skip" class="setup-skip">Skip for now</button><div class="setup-navigation"><button type="button" id="setup-back" hidden>Back</button><button type="submit" id="setup-next" class="primary">Continue</button></div></div>
   </form>`;
   doc.body.appendChild(dialog);
   $('setup-form').addEventListener('submit',e=>{e.preventDefault();advance();});
   $('setup-back').addEventListener('click',()=>{if(step>0){step--;renderStep();(step===0?$('setup-budget'):$('setup-plan-mode')).focus();}});
   $('setup-skip').addEventListener('click',skip);$('setup-dismiss').addEventListener('click',skip);
   dialog.addEventListener('cancel',e=>{e.preventDefault();skip();});
  }
  function open(){
   mount();if(dialog.open)return;
   const preferences=api.getPreferences()||{},draft=draftFromPreferences(preferences);
   $('setup-budget').value=draft.monthlyBudget;$('setup-member').checked=draft.member;$('setup-plan-mode').value=draft.planMode;$('setup-zip').value=draft.zip;$('setup-store').value=draft.storeName;$('setup-open-tools').checked=true;
   const count=Array.isArray(preferences.inventory)?preferences.inventory.length:0,rules=(preferences.rules||[]).filter(r=>r.enabled!==false).length;
   $('setup-owned-summary').textContent=count||rules?`You already have ${count} saved tool${count===1?'':'s'}${rules?` and ${rules} tool-type preference${rules===1?'':'s'}`:''}. You can keep building on them.`:'No owned tools saved yet. Add tools from any brand, or mark a whole tool group as already covered.';
   step=0;renderStep();showError({});dialog.showModal();$('setup-budget').focus();
  }
  function maybePrompt(){if(needsSetup(api.getPreferences()?.settings)){open();return true;}return false;}
  function init(){mount();maybePrompt();return controller;}
  const controller={init,open,maybePrompt};return controller;
 }
 return {SETUP_VERSION,needsSetup,draftFromPreferences,validateDraft,settingsAfterSetup,create};
});
