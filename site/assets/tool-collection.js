/* Searchable collection management. Tool-type coverage is always a deliberate choice. */
(() => {
'use strict';
function create(api) {
 const {$,DATA,IMAGES,esc,money,getPreferences:prefs,update,markOwned,openSizes,uid,toast}=api;
 const taxonomy=window.ToolTaxonomy;
 const types=new Map(taxonomy.TYPES.map(t=>[t.id,t]));
 const groups=new Map(taxonomy.GROUPS.map(g=>[g.id,g]));
 const rows=DATA.filter(r=>r._included);
 const classifications=new Map(rows.map(r=>[r['Item Number'],taxonomy.classify(r)]));
 const counts=new Map();rows.forEach(r=>{const t=classifications.get(r['Item Number']).type;counts.set(t,(counts.get(t)||0)+1);});
 let mode='types',query='',group='',selectedType='',limit=24;
 const words=v=>String(v??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9/#.]+/g,' ').trim();
 const matches=(value,q=query)=>words(q).split(/\s+/).filter(Boolean).every(w=>words(value).includes(w));
 const typeText=t=>[t.label,groups.get(t.group)?.label,t.keywords||'',t.family].join(' ');
 const optionGroups=(filter='')=>taxonomy.GROUPS.map(g=>{const list=taxonomy.TYPES.filter(t=>t.group===g.id&&matches(typeText(t),filter));return list.length?`<optgroup label="${esc(g.label)}">${list.map(t=>`<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('')}</optgroup>`:'';}).join('');
 function details(entry) {
  const type=types.get(entry.toolType);
  const caps=(entry.capabilities||[]).map(c=>{
   const parts=[c.system==='metric'?'Metric':c.system==='sae'?'SAE':c.system, c.drive&&c.drive!=='unknown'&&c.drive!=='not-applicable'?c.drive+' in. drive':'', c.depth&&c.depth!=='not-applicable'?c.depth:'',c.impact===true?'impact-rated':'',c.profile&&c.profile!=='hex'?c.profile:'',c.style,c.sizes?.join(', ')];
   return parts.filter(x=>x&&x!=='unknown'&&x!=='fixed').join(' · ');
  });
  return [entry.sku?'SKU '+entry.sku:'',...caps,!entry.sku&&type?'Covers '+type.label:'',entry.paidPrice!=null?'Paid '+money(entry.paidPrice):''].filter(Boolean).join(' · ')||'Saved in your collection';
 }
 function init() {
  $('inventory-panel').innerHTML=`<div class="panel-heading"><div><div class="eyebrow">YOUR GARAGE</div><h2>My tools</h2><p>Tell us what you have. Find a specific product, enter exact set sizes, or switch off a tool type you have covered.</p></div><div class="collection-heading-actions"><button class="btn" data-open-setup>Run setup</button><button class="btn primary" id="collection-add">Add a tool from any brand</button></div></div>
   <div class="collection-search-row"><label class="search-box"><span aria-hidden="true">⌕</span><span class="sr-only">Search my tools and tool types</span><input id="collection-search" type="search" placeholder="Search sockets, brake tools, air ratchets, brands or SKU…" autocomplete="off"></label><label class="collection-area">Tool area<select id="collection-group"><option value="">Every tool area</option>${taxonomy.GROUPS.map(g=>`<option value="${esc(g.id)}">${esc(g.label)}</option>`).join('')}</select></label></div>
   <nav class="collection-tabs" aria-label="Manage my tools"><button data-collection-view="types" aria-pressed="true" class="active">Tool types</button><button data-collection-view="products" aria-pressed="false">Find a catalog product</button><button data-collection-view="owned" aria-pressed="false">My collection <span id="collection-owned-count"></span></button></nav>
   <div class="collection-result-line"><p id="collection-result-count" role="status"></p><button id="collection-clear" class="text-btn" hidden>Clear search & filters</button></div><div id="collection-selected-type" hidden></div><div id="collection-results"></div>
   <details class="collection-broad"><summary>Whole-family preferences</summary><p>Use these only when you want to hide every tool in an entire family. The tool-type choices above let you be more specific.</p><div id="family-rules" class="family-grid"></div></details>`;
  const dialog=document.createElement('dialog');dialog.id='collection-tool-dialog';dialog.className='planner-dialog';dialog.setAttribute('aria-labelledby','collection-add-title');dialog.innerHTML=`<div class="dialog-top"><h2 id="collection-add-title">Add a tool from any brand</h2><button class="icon-btn" type="button" data-collection-close aria-label="Close add tool">×</button></div><form id="collection-tool-form" class="planner-form"><label>Search tool types<input id="collection-type-search" type="search" placeholder="Try impact, brake, puller or pliers"></label><label>Tool type<select id="collection-manual-type" required>${optionGroups()}</select></label><label>Name / brand (optional)<input id="collection-manual-label" maxlength="200" placeholder="For example: my air impact wrench"></label><p class="save-hint">This option covers the selected tool type, including other brands and models. It does not record a purchase or use your budget.</p><button id="collection-exact-sizes" class="btn" type="button" hidden>Enter the exact sizes I own instead</button><label class="check-setting"><input id="collection-confirm-type" type="checkbox" required> I have this tool type covered. Hide matching tool-type deals.</label><button class="btn primary" type="submit">Add covered tool type</button><p class="save-hint">For a specific Harbor Freight product, use “Find a catalog product” in My tools.</p></form>`;document.body.append(dialog);
  $('collection-search').addEventListener('input',e=>{query=e.target.value;limit=24;render();});
  $('collection-group').addEventListener('change',e=>{group=e.target.value;selectedType='';limit=24;render();});
  $('collection-clear').addEventListener('click',()=>{query='';group='';selectedType='';limit=24;$('collection-search').value='';$('collection-group').value='';render();});
  $('collection-add').addEventListener('click',()=>openManual());
  $('collection-type-search').addEventListener('input',e=>{const old=$('collection-manual-type').value;$('collection-manual-type').innerHTML=optionGroups(e.target.value);if([...$('collection-manual-type').options].some(o=>o.value===old))$('collection-manual-type').value=old;manualFields();});
  $('collection-manual-type').addEventListener('change',manualFields);
  $('collection-exact-sizes').addEventListener('click',()=>{const t=types.get($('collection-manual-type').value);dialog.close();openSizes(t?.family);});
  $('collection-tool-form').addEventListener('submit',e=>{e.preventDefault();const t=types.get($('collection-manual-type').value);if(!t||!$('collection-confirm-type').checked)return;const label=$('collection-manual-label').value.trim()||t.label;update(p=>p.inventory.push({id:uid(),label,toolType:t.id,source:'manual-type',condition:'usable',capabilities:[]}));dialog.close();toast('Added to your tools; matching tool types are hidden.');});
  dialog.querySelector('[data-collection-close]').addEventListener('click',()=>dialog.close());
  $('inventory-panel').addEventListener('click',e=>{
   const tab=e.target.closest('[data-collection-view]');if(tab){mode=tab.dataset.collectionView;limit=24;render();}
   const products=e.target.closest('[data-type-products]');if(products){selectedType=products.dataset.typeProducts;group=types.get(selectedType)?.group||'';query='';$('collection-search').value='';$('collection-group').value=group;mode='products';limit=24;render();}
   const sizes=e.target.closest('[data-enter-sizes]');if(sizes)openSizes(sizes.dataset.enterSizes);
   const manual=e.target.closest('[data-type-add]');if(manual)openManual(manual.dataset.typeAdd);
   const own=e.target.closest('[data-collection-own]');if(own)markOwned(own.dataset.collectionOwn);
   if(e.target.closest('[data-collection-more]')){limit+=24;render();}
  });
  $('inventory-panel').addEventListener('change',e=>{
   const type=e.target.dataset.typeRule;if(type&&types.has(type))update(p=>{p.rules=p.rules.filter(r=>!(r.mode==='type'&&r.type===type));if(e.target.checked)p.rules.push({family:types.get(type).family,type,mode:'type',enabled:true});});
   const family=e.target.dataset.familyRule;if(family)update(p=>{p.rules=p.rules.filter(r=>!(r.mode==='family'&&r.family===family));if(e.target.checked)p.rules.push({family,mode:'family',enabled:true});});
  });render();
 }
 function manualFields(){const t=types.get($('collection-manual-type').value);$('collection-exact-sizes').hidden=!['sockets','wrenches','hex-keys','drill-bits','driver-bits'].includes(t?.family);}
 function openManual(type) {$('collection-tool-form').reset();$('collection-manual-type').innerHTML=optionGroups();if(type&&types.has(type))$('collection-manual-type').value=type;else if(selectedType)$('collection-manual-type').value=selectedType;manualFields();$('collection-tool-dialog').showModal();}
 function render() {
  if(!$('collection-results'))return;
  const p=prefs(),activeTypes=new Set(p.rules.filter(r=>r.mode==='type'&&r.enabled!==false).map(r=>r.type));
  p.inventory.filter(x=>!x.sku&&x.toolType&&!['broken','missing','retired'].includes(x.condition)).forEach(x=>activeTypes.add(x.toolType));
  $('collection-owned-count').textContent=p.inventory.length;
  $('inventory-panel').querySelectorAll('[data-collection-view]').forEach(b=>{const active=b.dataset.collectionView===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $('collection-clear').hidden=!query&&!group&&!selectedType;
  $('collection-selected-type').hidden=mode!=='products'||!selectedType;$('collection-selected-type').textContent=selectedType?'Showing '+(types.get(selectedType)?.label||selectedType):'';
  $('family-rules').innerHTML=ToolOwnership.FAMILIES.map(f=>`<label><input type="checkbox" data-family-rule="${esc(f.id)}" ${p.rules.some(r=>r.mode==='family'&&r.family===f.id&&r.enabled!==false)?'checked':''}> Hide all ${esc(f.label.toLowerCase())}</label>`).join('');
  let html='';
  if(mode==='types') {
   const list=taxonomy.TYPES.filter(t=>(!group||t.group===group)&&matches(typeText(t)));
   $('collection-result-count').textContent=`${list.length} tool types · ${activeTypes.size} types covered. Check a type only when you want to hide all its matching products.`;
   html=taxonomy.GROUPS.map(g=>{const ts=list.filter(t=>t.group===g.id);return ts.length?`<section class="collection-type-section"><h3>${esc(g.label)} <span>${ts.length}</span></h3><div class="collection-type-grid">${ts.map(t=>`<article class="collection-type ${activeTypes.has(t.id)?'is-covered':''}"><label><input type="checkbox" data-type-rule="${esc(t.id)}" ${activeTypes.has(t.id)?'checked':''} ${p.inventory.some(x=>!x.sku&&x.toolType===t.id&&!['broken','missing','retired'].includes(x.condition))?'disabled':''}><span><b>${esc(t.label)}</b><small>${activeTypes.has(t.id)?'Covered · matching deals hidden':'I have this tool type covered'}</small></span></label><div class="collection-type-actions"><button class="text-btn" data-type-products="${esc(t.id)}">${counts.get(t.id)||0} catalog products</button>${['sockets','wrenches','hex-keys','drill-bits','driver-bits'].includes(t.family)?`<button class="text-btn" data-enter-sizes="${esc(t.family)}">Enter exact sizes</button>`:`<button class="text-btn" data-type-add="${esc(t.id)}">Add my tool</button>`}</div></article>`).join('')}</div></section>`:'';}).join('');
  } else if(mode==='products') {
   const list=rows.filter(r=>{const c=classifications.get(r['Item Number']);return (!group||c.group===group)&&(!selectedType||c.type===selectedType)&&matches([r.Product,r.Brand,r['Item Number'],r.Category,r['Sizes Reviewed'],typeText(types.get(c.type)||{})].join(' '));});
   $('collection-result-count').textContent=`${list.length} catalog products · select the exact products you already own.`;
   html=`<div class="collection-product-grid">${list.slice(0,limit).map(r=>{const sku=r['Item Number'],owned=p.inventory.some(x=>x.sku===sku);return `<article class="collection-product">${IMAGES?.[sku]?`<img src="${esc(IMAGES[sku])}" alt="" loading="lazy">`:''}<div><small>${esc(r.Brand)} · SKU ${esc(sku)}</small><h3>${esc(r.Product)}</h3><p>${esc(types.get(classifications.get(sku).type)?.label||r.Category)}</p><button class="btn ${owned?'':'primary'}" data-collection-own="${esc(sku)}" ${owned?'disabled':''}>${owned?'✓ In my collection':'I own this product'}</button></div></article>`;}).join('')}</div>${list.length>limit?'<button class="btn collection-more" data-collection-more>Show 24 more products</button>':''}`;
  } else {
   const list=p.inventory.filter(x=>{const row=DATA.find(r=>r['Item Number']===x.sku),c=row?taxonomy.classify(row):types.get(x.toolType),ownedGroups=new Set([c?.group,...(x.capabilities||[]).flatMap(cap=>taxonomy.TYPES.filter(t=>t.family===cap.family).map(t=>t.group))]);return (!group||ownedGroups.has(group))&&matches([x.label,x.sku,details(x),row?.Brand,c?.label,...(x.capabilities||[]).map(cap=>cap.family)].join(' '));});
   $('collection-result-count').textContent=`${list.length} owned tools or sets${p.inventory.length!==list.length?' match your filters':''}. Remove an entry to consider it again.`;
   html=`<ul class="record-list">${list.map(x=>`<li><div><b>${esc(x.label||x.sku||'Owned tool')}</b><small>${esc(details(x))}</small></div><button data-remove-inventory="${esc(x.id)}" class="text-btn">Remove</button></li>`).join('')}</ul>`;
  }
  $('collection-results').innerHTML=html||'<div class="collection-empty"><h3>No matches in this view</h3><p>Try another term or tool area, or add a tool from any brand.</p></div>';
 }
 return {init,render,openManual};
}
window.ToolCollection={create};
})();
