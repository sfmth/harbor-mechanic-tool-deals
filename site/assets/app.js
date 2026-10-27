(() => {
'use strict';
const DATA = JSON.parse(document.getElementById('catalog-data').textContent);
const IMAGES = JSON.parse(document.getElementById('image-data').textContent);
const $ = id => document.getElementById(id);
const ICONS = {
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
 bookmark:'<path d="M6 4h12v17l-6-4-6 4z"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 external:'<path d="M14 4h6v6m0-6-10 10M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 list:'<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
 sliders:'<path d="M4 6h8m4 0h4M4 12h2m4 0h10M4 18h10m4 0h2"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m8 12 3 3 5-6"/>',
 tool:'<path d="M14 6a6 6 0 0 0-7 7L2 18a3 3 0 0 0 4 4l6-6a6 6 0 0 0 7-8l-4 4-4-4 4-4z"/>',
 minus:'<path d="M5 12h14"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">'+(ICONS[name] || ICONS.tool)+'</svg>';
const icons = (root=document) => root.querySelectorAll('[data-icon]').forEach(e => e.innerHTML=icon(e.dataset.icon));
icons();
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const nf = n => new Intl.NumberFormat('en-US').format(n);
const text = (r,k) => String(r[k] ?? '').trim();
const safeURL = value => { try { const u=new URL(value); return u.protocol==='https:' && (u.hostname==='harborfreight.com'||u.hostname.endsWith('.harborfreight.com')) ? u.href : ''; } catch { return ''; } };
const statusKey = r => r['Size Review Status']==='No skipped standard sizes found'?'pass':r['Size Review Status']==='Size continuity not applicable'?'na':r['Size Review Status']==='Confirmed size gaps'?'gap':'unknown';
const STATUS = {pass:['No skips found','check'],na:['Not applicable','minus'],gap:['Size gaps found','info'],unknown:['Sizes unverified','info']};
const reviewLabels = {unreviewed:'Not selected',consider:'Considering',buy:'Want to buy',owned:'Already own',skip:'Pass for now'};
const bySKU = new Map(DATA.map(r=>[text(r,'Item Number'),r]));
const STORE_KEY='hf-mechanic-tool-review-v1';
let preferences={saved:[],reviews:{},notes:{}};
let storageOK=true;
try { const v=JSON.parse(localStorage.getItem(STORE_KEY)||'null'); if(v && typeof v==='object') preferences=validatePrefs(v); } catch { storageOK=false; }
function validatePrefs(v) { return MechanicPlanner.sanitize(v,bySKU); }
preferences=validatePrefs(preferences);
const state={scope:'included',savedOnly:false,search:'',group:'',category:'',brand:'',min:0,max:200,status:'',measurement:'',format:'',power:'',review:'',sort:'deal',view:'grid',page:1,pageSize:24};
let compare=[]; let filtered=[]; let toastTimer; let currentDetail='';
const renderedHTML=new Map();
function setHTML(id,markup){if(renderedHTML.get(id)===markup)return false;$(id).innerHTML=markup;renderedHTML.set(id,markup);return true;}
const planner=MechanicPlanner.create({$,DATA,IMAGES,esc,money,toast,bySKU,getPreferences:()=>preferences,setPreferences:p=>{preferences=p},useIncluded:()=>{state.scope='included';state.savedOnly=false;},persist,render});
const imageURL=r=>IMAGES[text(r,'Item Number')]||'';
const statusTag=r=>{const k=statusKey(r);if(k==='na')return '';return '<span class="status-tag status-'+k+'" title="'+esc(r['Size Review Status'])+'">'+icon(STATUS[k][1])+STATUS[k][0]+'</span>'};
function persist(){try{localStorage.setItem(STORE_KEY,JSON.stringify(preferences));storageOK=true;}catch{storageOK=false;toast('Browser storage is unavailable. Use Backup to keep your changes.');}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3600);}
function populate(id,key,first){ const values=[...new Set(DATA.map(r=>text(r,key)).filter(Boolean))].sort((a,b)=>a.localeCompare(b)); $(id).innerHTML='<option value="">'+first+'</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join(''); }
populate('category','Category','All categories');populate('brand','Brand','All brands');populate('format','Format','All formats');
$('tool-group').innerHTML='<option value="">All tool areas</option>'+ToolTaxonomy.GROUPS.map(group=>'<option value="'+esc(group.id)+'">'+esc(group.label)+'</option>').join('');
function usefulSpecs(r){
 const specs=r._enrichment?.specs||{};
 const found=[];
 const add=(label,value)=>{if(value&&String(value).trim()&&!found.some(x=>x[1]===String(value)))found.push([label,String(value)]);};
 const get=(test)=>Object.entries(specs).find(([k])=>test.test(k))?.[1];
 add('Pieces',text(r,'Piece Count')?text(r,'Piece Count')+' pc.':'');
 add('System',text(r,'Measurement System'));
 add('Drive',get(/^drive size$/i)||get(/drive size/i));
 add('Capacity',get(/^(load capacity|working load|lifting capacity|maximum lift capacity|volume|capacity)$/i));
 add('Voltage',get(/^(voltage|volts)$/i));
 add('Material',get(/^material$/i));
 if(r['Power Package']==='Tool only')found.unshift(['Power package','Tool only · battery separate']);else if(r['Power Package']==='Battery and charger included')found.unshift(['Power package','Battery & charger included']);
 add('Format',found.length<2?text(r,'Format'):'');
 return found.slice(0,3);
}
function photo(r,cls='',lazy=true){const src=imageURL(r);return src?'<img '+(lazy?'loading="lazy"':'loading="eager"')+' decoding="async" src="'+src+'" alt="'+esc(r.Brand+' '+r.Product)+'"'+(cls?' class="'+cls+'"':'')+'>':'<div class="photo-placeholder">'+icon('tool')+'<span>Photo unavailable</span></div>';}
function card(r){
 const sku=text(r,'Item Number'), saved=preferences.saved.includes(sku), rev=preferences.reviews[sku];
 return `<article class="product-card${saved?' saved':''}" data-sku="${esc(sku)}"><div class="card-photo"><span class="photo-label">#${esc(sku)}</span>${photo(r)}<button class="card-save" data-save="${esc(sku)}" aria-label="${saved?'Remove from':'Add to'} shortlist: ${esc(r.Product)}" aria-pressed="${saved}" title="${saved?'Remove from shortlist':'Save to shortlist'}">${icon('bookmark')}</button></div><div class="card-body"><div class="card-kicker"><span class="brand">${esc(r.Brand)}</span><span class="sku">SKU ${esc(sku)}</span></div><h3 class="card-name"><button data-detail="${esc(sku)}">${esc(r.Product)}</button></h3>${planner.priceMarkup(r)}<div class="spec-chips">${usefulSpecs(r).map(([k,v])=>`<span class="spec-chip" title="${esc(k+': '+v)}">${esc(v)}</span>`).join('')}</div>${rev&&rev!=='unreviewed'?`<div class="card-review">${esc(reviewLabels[rev])}${preferences.notes[sku]?' · Has notes':''}</div>`:''}${statusTag(r)}${planner.cardExtras(r)}</div><div class="card-footer"><label class="compare-check"><input type="checkbox" data-compare="${esc(sku)}"${compare.includes(sku)?' checked':''} aria-label="Compare ${esc(r.Product)}"> Compare</label><button class="card-detail" data-detail="${esc(sku)}">View details ${icon('arrow')}</button></div></article>`;
}
function matches(r){
 if(!planner.matches(r,state))return false;
 if(state.savedOnly){if(!preferences.saved.includes(text(r,'Item Number')))return false;}
 else if(state.scope!=='all' && (r._included?'included':'excluded')!==state.scope)return false;
 if(state.group&&ToolTaxonomy.classify(r).group!==state.group)return false;
 if(state.category&&r.Category!==state.category)return false;
 if(state.brand&&r.Brand!==state.brand)return false;
 if(planner.effectivePrice(r)<state.min || planner.effectivePrice(r)>state.max)return false;
 if(state.status&&statusKey(r)!==state.status)return false;
 if(state.measurement&&(state.measurement==='unspecified'?Boolean(text(r,'Measurement System')):text(r,'Measurement System')!==(state.measurement==='Both'?'SAE and Metric':state.measurement)))return false;
 if(state.format&&r.Format!==state.format)return false;
 if(state.power&&(state.power==='other'?['Tool only','Battery and charger included'].includes(r['Power Package']):r['Power Package']!==state.power))return false;
 if(state.review&&(preferences.reviews[text(r,'Item Number')]||'unreviewed')!==state.review)return false;
 if(state.search){const hay=[r.Product,r.Brand,r.Category,r['Item Number'],r['Sizes Reviewed'],r['Missing Sizes'],r['Size Review Notes'],r['Measurement System'],...Object.values(r._enrichment?.specs||{})].join(' ').toLowerCase();if(!state.search.toLowerCase().split(/\s+/).every(word=>hay.includes(word)))return false;}
 return true;
}
const sorter={deal:(a,b)=>planner.score(b)-planner.score(a)||a.Product.localeCompare(b.Product),category:(a,b)=>a.Category.localeCompare(b.Category)||a.Product.localeCompare(b.Product),name:(a,b)=>a.Product.localeCompare(b.Product),'price-asc':(a,b)=>planner.effectivePrice(a)-planner.effectivePrice(b)||a.Product.localeCompare(b.Product),'price-desc':(a,b)=>planner.effectivePrice(b)-planner.effectivePrice(a)||a.Product.localeCompare(b.Product),brand:(a,b)=>a.Brand.localeCompare(b.Brand)||a.Product.localeCompare(b.Product),pieces:(a,b)=>(parseInt(b['Piece Count'])||0)-(parseInt(a['Piece Count'])||0)||a.Product.localeCompare(b.Product)};
function render(keepPage=false){
 if(!keepPage)state.page=1;
 filtered=DATA.filter(matches).sort(sorter[state.sort]);
 const pages=Math.max(1,Math.ceil(filtered.length/state.pageSize));state.page=Math.min(state.page,pages);
 $('product-grid').classList.toggle('list-view',state.view==='list');
 const start=(state.page-1)*state.pageSize;
 setHTML('product-grid',filtered.slice(start,start+state.pageSize).map(card).join(''));
 $('empty').hidden=filtered.length!==0;
 $('empty-message').textContent=state.savedOnly&&!preferences.saved.length?'Save a tool with its bookmark button to start your shortlist.':'Try a broader search, choose another tool area, or reset a filter.';
 $('result-count').textContent=nf(filtered.length)+(filtered.length===1?' item':' items');
 $('result-context').textContent=state.savedOnly?'in your shortlist':state.scope==='included'?'in your selection':state.scope==='excluded'?'sets with missing or unlisted sizes':'across all selections';
 $('excluded-notice').hidden=state.savedOnly||state.scope==='included';
 $('shortlist-bar').hidden=!state.savedOnly;
 $('saved-top').setAttribute('aria-pressed',String(state.savedOnly));
 $('saved-count-top').textContent=preferences.saved.length;
 const allSaved=preferences.saved.map(k=>bySKU.get(k));
 const subtotal=allSaved.reduce((sum,r)=>sum+r['Price USD'],0);
 $('shortlist-summary').textContent=`${allSaved.length} item${allSaved.length===1?'':'s'} · ${money(subtotal)} subtotal${filtered.length!==allSaved.length?' · '+filtered.length+' shown after filters':''}`;
 $('export-label').textContent=state.savedOnly?'Export shortlist':'Export results';
 $('export').setAttribute('aria-label',state.savedOnly?'Export full shortlist to CSV':'Export filtered results to CSV');
 $('export').disabled=state.savedOnly?!preferences.saved.length:!filtered.length;
 $('clear-search').hidden=!state.search;
 renderChips();renderPages(pages,start);renderCompare();
 document.querySelectorAll('[data-scope]').forEach(b=>{const active=state.scope===b.dataset.scope&&!state.savedOnly;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 $('grid-view').classList.toggle('active',state.view==='grid');$('grid-view').setAttribute('aria-pressed',String(state.view==='grid'));
 $('list-view').classList.toggle('active',state.view==='list');$('list-view').setAttribute('aria-pressed',String(state.view==='list'));
 planner.onRender();
}
function filterList(){const a=[];if(state.search)a.push(['search','Search: '+state.search]);if(state.group)a.push(['group',ToolTaxonomy.GROUPS.find(g=>g.id===state.group)?.label||state.group]);if(state.category)a.push(['category',state.category]);if(state.brand)a.push(['brand',state.brand]);if(state.min>0||state.max<200)a.push(['price',money(state.min)+' – '+money(state.max)]);if(state.status)a.push(['status',STATUS[state.status][0]]);if(state.measurement)a.push(['measurement',state.measurement==='unspecified'?'System not specified':state.measurement==='Both'?'Metric & SAE':state.measurement]);if(state.format)a.push(['format',state.format]);if(state.power)a.push(['power',state.power==='other'?'Other power package':state.power]);if(state.review)a.push(['review',reviewLabels[state.review]]);return a;}
function renderChips(){const a=filterList();setHTML('active-filters',a.map(([k,v])=>'<button class="filter-chip" data-remove-filter="'+k+'" aria-label="Remove filter: '+esc(v)+'">'+esc(v)+icon('close')+'</button>').join(''));$('filter-count').textContent=a.length||'';}
function renderPages(pages,start){
 if(!filtered.length){setHTML('pagination','');return;}
 const visible=new Set([1,pages,state.page-1,state.page,state.page+1]);
 let buttons='',last=0;[...visible].filter(n=>n>=1&&n<=pages).sort((a,b)=>a-b).forEach(n=>{if(last&&n>last+1)buttons+='<span aria-hidden="true">…</span>';buttons+=`<button class="page-btn${n===state.page?' active':''}" data-page="${n}"${n===state.page?' aria-current="page"':''} aria-label="Page ${n}">${n}</button>`;last=n;});
 const markup=`<span>Showing ${nf(start+1)}–${nf(Math.min(start+state.pageSize,filtered.length))} of ${nf(filtered.length)}</span><div class="page-buttons"><button class="page-btn" data-page="${state.page-1}" ${state.page===1?'disabled':''} aria-label="Previous page">‹</button>${buttons}<button class="page-btn" data-page="${state.page+1}" ${state.page===pages?'disabled':''} aria-label="Next page">›</button></div><label>Per page <select id="page-size">${[24,48,96].map(n=>`<option${n===state.pageSize?' selected':''}>${n}</option>`).join('')}</select></label>`;
 if(!setHTML('pagination',markup))return;
 $('page-size').addEventListener('change',e=>{state.pageSize=Number(e.target.value);render();});
}
function syncControls(){ $('search').value=state.search;$('tool-group').value=state.group;$('category').value=state.category;$('brand').value=state.brand;$('price-min').value=state.min;$('price-max').value=state.max;$('price-range').value=state.max;$('status').value=state.status;$('measurement').value=state.measurement;$('format').value=state.format;$('power-package').value=state.power;$('review-filter').value=state.review;$('sort').value=state.sort; }
function reset(){Object.assign(state,{search:'',group:'',category:'',brand:'',min:0,max:200,status:'',measurement:'',format:'',power:'',review:''});syncControls();render();}
function saveToggle(sku){const index=preferences.saved.indexOf(sku);if(index>=0)preferences.saved.splice(index,1);else preferences.saved.push(sku);persist();planner.changed();if(currentDetail===sku)updateDetailSave(sku);toast(index>=0?'Removed from shortlist':'Saved to shortlist');}
function updateDetailSave(sku){const b=$('detail-save');if(b){const on=preferences.saved.includes(sku);b.innerHTML=icon('bookmark')+(on?'Saved to shortlist':'Save to shortlist');b.setAttribute('aria-pressed',String(on));}}
function compareToggle(sku){const index=compare.indexOf(sku);if(index>=0)compare.splice(index,1);else if(compare.length<4)compare.push(sku);else toast('Compare up to four tools. Remove one to add another.');render(true);}
function renderCompare(){ $('compare-tray').hidden=!compare.length;$('compare-count').textContent=compare.length;$('compare-names').textContent=compare.map(k=>bySKU.get(k).Brand+' #'+k).join(' · ');$('compare-open').disabled=compare.length<2; }
function link(label,url,cls='evidence-link'){const safe=safeURL(url);return safe?`<a class="${cls}" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)} ${icon('external')}</a>`:'';}
function normalizedSpecs(r){const out={};const specs=r._enrichment?.specs||{};Object.entries(specs).forEach(([k,v])=>{if(String(v).trim()&&!/^warranty|^shipping|^important|^warning|^prop\s*65|^ca residents/i.test(k))out[k]=String(v)});if(!Object.keys(out).some(k=>/^brand$/i.test(k)))out.Brand=r.Brand;if(!Object.keys(out).some(k=>/^sku|item number/i.test(k)))out['Item number']=r['Item Number'];out['Product format']=r.Format;if(r['Power Package'])out['Power package']=r['Power Package'];if(r['Piece Count']&&!Object.keys(out).some(k=>/quantity|piece count|number of pieces/i.test(k)))out['Pieces in set']=r['Piece Count'];if(r['Measurement System']&&!Object.keys(out).some(k=>/^sae|measurement/i.test(k)))out['Measurement system']=r['Measurement System']==='Both'?'Metric & SAE':r['Measurement System'];return out;}
function openDetail(sku){
 const r=bySKU.get(sku);if(!r)return;currentDetail=sku;
 const e=r._enrichment||{},k=statusKey(r),specs=normalizedSpecs(r),rev=preferences.reviews[sku]||'unreviewed';
 const missing=k==='unknown'?'The advertised size list is unavailable. Check the included sizes before choosing this set.':k==='na'?'Not applicable to this assortment.':r['Missing Sizes']||'No standard sizes missing within the advertised range.';
 const sizes=text(r,'Sizes Reviewed')||(k==='na'?'This tool is not a graduated size set.':'The included size list is unavailable.');
 $('detail-content').innerHTML=`<div class="dialog-top"><div><div class="eyebrow">${r._included?'TOOL SELECTION':'CHECK SET SIZES'} / SKU ${esc(sku)}</div><h2 id="detail-title">Tool details</h2></div><button class="icon-btn dialog-close" data-close="detail-dialog" aria-label="Close product details">${icon('close')}</button></div><div class="detail-main"><div class="detail-visual"><div class="detail-photo">${photo(r,'',false)}</div><div class="photo-caption">${imageURL(r)?'Harbor Freight product photo<br>Check the product page for included accessories.':'Product photo unavailable.'}</div>${planner.detailMarkup(r)}<div class="detail-actions"><button id="detail-save" class="btn" data-save="${esc(sku)}" aria-pressed="${preferences.saved.includes(sku)}"></button>${link('View at Harbor Freight',r['Product URL'],'btn primary')}</div></div><div class="detail-info"><div class="card-kicker"><span class="brand">${esc(r.Brand)}</span><span class="sku">SKU ${esc(sku)}</span></div><h3 class="detail-title">${esc(r.Product)}</h3><div class="detail-category">${esc(r.Category)}</div>${statusTag(r)}${e.description?`<p class="description"><strong>From Harbor Freight</strong><br>“${esc(e.description)}”</p>`:`<p class="description">Check the specifications below and open the Harbor Freight page for the current product details.</p>`}${Array.isArray(e.features)&&e.features.length?'<ul class="features">'+e.features.slice(0,8).map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>':''}</div></div><section class="detail-section"><h3>Specifications</h3><table class="spec-table"><tbody>${Object.entries(specs).map(([name,value])=>`<tr><th scope="row">${esc(name)}</th><td>${esc(value)}</td></tr>`).join('')}</tbody></table><p class="save-hint">Specifications may vary by product revision. Check the retailer page for the latest details.</p></section>${k==='na'?'':`<section class="detail-section"><h3>Set sizes</h3><div class="audit-box ${k}"><div class="audit-heading">${icon(STATUS[k][1])}${esc(STATUS[k][0])}</div><div class="audit-body"><div class="audit-row"><span>Included sizes</span><p>${esc(sizes)}</p></div><div class="audit-row"><span>Missing sizes</span><p>${esc(missing)}</p></div><div class="audit-row"><span>Size notes</span><p>${esc(r['Size Review Notes'])}</p></div>${link('Check included sizes at Harbor Freight',r['Size Evidence URL'])}</div></div></section>`}<section class="detail-section"><h3>Your plans & notes</h3><div class="review-editor"><div><label for="detail-review">Shopping status</label><select id="detail-review">${Object.entries(reviewLabels).map(([v,label])=>'<option value="'+v+'"'+(rev===v?' selected':'')+'>'+label+'</option>').join('')}</select></div><div><label for="detail-notes">Personal notes</label><textarea id="detail-notes" maxlength="20000" placeholder="Fitment, jobs, duplicates, things to check…"></textarea><p class="save-hint" id="notes-save-hint">Saved automatically in this browser. Include with Backup.</p></div></div></section>`;
 updateDetailSave(sku);
 $('detail-notes').value=preferences.notes[sku]||'';
 $('detail-review').addEventListener('change',ev=>{if(ev.target.value==='owned'){planner.markOwned(sku);return;}preferences.reviews[sku]=ev.target.value;persist();planner.changed();});
 $('detail-notes').addEventListener('input',ev=>{preferences.notes[sku]=ev.target.value;persist();$('notes-save-hint').textContent=storageOK?'Saved in this browser. Include with Backup.':'Browser storage unavailable. Use Backup before closing.';});
 $('detail-dialog').showModal();$('detail-dialog').scrollTop=0;
}
function openComparison(){
 if(compare.length<2)return;
 const rs=compare.map(k=>bySKU.get(k));
 const keys=['Category','Product format','Pieces in set','Measurement system','Drive size','Material','Capacity','Set sizes','Included sizes','Missing sizes','Your plans'];
 const lookup=(r,key)=>{const s=normalizedSpecs(r);if(key==='Category')return r.Category;if(key==='Product format')return r.Format;if(key==='Pieces in set')return text(r,'Piece Count')||Object.entries(s).find(([k])=>/quantity|number of pieces/i.test(k))?.[1]||'Not listed';if(key==='Measurement system')return text(r,'Measurement System')||Object.entries(s).find(([k])=>/sae.*metric|measurement/i.test(k))?.[1]||'Not listed / not applicable';if(key==='Drive size')return Object.entries(s).find(([k])=>/drive size/i.test(k))?.[1]||'Not listed / not applicable';if(key==='Material')return Object.entries(s).find(([k])=>/^material$/i.test(k))?.[1]||'Not listed';if(key==='Capacity')return Object.entries(s).find(([k])=>/capacity|working load/i.test(k))?.[1]||'Not listed / not applicable';if(key==='Set sizes')return STATUS[statusKey(r)][0];if(key==='Included sizes')return text(r,'Sizes Reviewed')||(statusKey(r)==='na'?'Not applicable':'Not established');if(key==='Missing sizes')return text(r,'Missing Sizes')||(statusKey(r)==='unknown'?'Not established':statusKey(r)==='na'?'Not applicable':'None identified');if(key==='Your plans')return reviewLabels[preferences.reviews[r['Item Number']]||'unreviewed'];return '';};
 $('compare-content').innerHTML='<div class="compare-scroll"><table class="comparison-table"><tbody><tr><th scope="row">Tool</th>'+rs.map(r=>`<td><div class="compare-product">${photo(r,'',false)}<span class="brand">${esc(r.Brand)} · #${esc(r['Item Number'])}</span><h3>${esc(r.Product)}</h3><div class="card-price">${money(r['Price USD'])}</div>${link('Retailer page',r['Product URL'],'btn')}${statusTag(r)}</div></td>`).join('')+'</tr>'+keys.map(key=>'<tr><th scope="row">'+key+'</th>'+rs.map(r=>'<td>'+esc(lookup(r,key))+'</td>').join('')+'</tr>').join('')+'</tbody></table><p class="save-hint">Catalog prices were recorded October 26, 2026. Check current offers and included accessories before buying.</p></div>';
 $('compare-dialog').showModal();
}
function download(content,type,name){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function csvExport(){const rows=state.savedOnly?preferences.saved.map(k=>bySKU.get(k)):filtered;if(planner.exportCSV(rows))return;const cols=Object.keys(DATA[0]).filter(k=>!k.startsWith('_'));const more=['In tool selection','Your plans','Your notes'];const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const csv=[cols.concat(more).map(cell).join(','),...rows.map(r=>cols.map(k=>r[k]).concat([r._included?'Yes':'No',reviewLabels[preferences.reviews[r['Item Number']]||'unreviewed'],preferences.notes[r['Item Number']]||'']).map(v=>cell(typeof v==='string'&&/^[=+@\-\t\r]/.test(v)?"'"+v:v)).join(','))].join('\r\n');download('\ufeff'+csv,'text/csv;charset=utf-8',state.savedOnly?'harbor_freight_shortlist.csv':'harbor_freight_filtered_results.csv');toast(`Exported ${rows.length} item${rows.length===1?'':'s'}${state.savedOnly?' from your full shortlist':''}`);}
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-save],[data-detail],[data-compare],[data-page],[data-scope],[data-close],[data-remove-filter]');if(!t)return;
 if(t.dataset.save){saveToggle(t.dataset.save);return;}
 if(t.dataset.detail){openDetail(t.dataset.detail);return;}
 if(t.dataset.compare){compareToggle(t.dataset.compare);return;}
 if(t.dataset.page){state.page=Number(t.dataset.page);render(true);$('results').scrollIntoView({block:'start',behavior:'instant'});return;}
 if(t.dataset.scope){state.scope=t.dataset.scope;state.savedOnly=false;render();return;}
 if(t.dataset.close){$(t.dataset.close).close();return;}
 if(t.dataset.removeFilter){const k=t.dataset.removeFilter;if(k==='price'){state.min=0;state.max=200;}else state[k]='';syncControls();render();}
});
for(const dialog of [$('detail-dialog'),$('compare-dialog')]){dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});}
$('detail-dialog').addEventListener('close',()=>{currentDetail='';});
let searchTimer;$('search').addEventListener('input',e=>{state.search=e.target.value.trim();clearTimeout(searchTimer);searchTimer=setTimeout(()=>render(),140);});
$('clear-search').addEventListener('click',()=>{state.search='';$('search').value='';render();$('search').focus();});
[['tool-group','group'],['category','category'],['brand','brand'],['status','status'],['measurement','measurement'],['format','format'],['power-package','power'],['review-filter','review'],['sort','sort']].forEach(([id,key])=>$(id).addEventListener('change',e=>{state[key]=e.target.value;render();}));
function priceUpdate(source){let min=Number($('price-min').value)||0,max=Number($('price-max').value);if(!Number.isFinite(max))max=200;min=Math.max(0,Math.min(200,min));max=Math.max(0,Math.min(200,max));if(min>max){if(source==='min')max=min;else min=max;}state.min=min;state.max=max;syncControls();render();}
$('price-min').addEventListener('change',()=>priceUpdate('min'));$('price-max').addEventListener('change',()=>priceUpdate('max'));
function priceLive(){const a=$('price-min').value,b=$('price-max').value;if(a===''||b==='')return;const min=Number(a),max=Number(b);if(Number.isFinite(min)&&Number.isFinite(max)&&min>=0&&max<=200&&min<=max){state.min=min;state.max=max;$('price-range').value=max;render();}}
$('price-min').addEventListener('input',priceLive);$('price-max').addEventListener('input',priceLive);
$('price-range').addEventListener('input',e=>{state.max=Number(e.target.value);if(state.min>state.max)state.min=state.max;$('price-max').value=state.max;$('price-min').value=state.min;render();});
$('reset-filters').addEventListener('click',reset);$('empty-reset').addEventListener('click',reset);
$('saved-top').addEventListener('click',()=>{state.savedOnly=!state.savedOnly;render();});$('show-all-items').addEventListener('click',()=>{state.savedOnly=false;render();});
$('grid-view').addEventListener('click',()=>{state.view='grid';render(true);});$('list-view').addEventListener('click',()=>{state.view='list';render(true);});
$('export').addEventListener('click',csvExport);
$('compare-clear').addEventListener('click',()=>{compare=[];render(true);});$('compare-open').addEventListener('click',openComparison);
$('backup').addEventListener('click',()=>{download(JSON.stringify({format:'hf-mechanic-tool-review',version:2,created:new Date().toISOString(),...preferences},null,2),'application/json','harbor_freight_review_backup.json');toast('Backup includes your tools, budget, purchases, shortlist and notes');});
$('restore').addEventListener('click',()=>$('restore-file').click());$('restore-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5*1024*1024)throw Error('File too large');const v=JSON.parse(await f.text());if(v.format!=='hf-mechanic-tool-review'||![1,2].includes(v.version)||!Array.isArray(v.saved))throw Error('Invalid backup');preferences=MechanicPlanner.merge(preferences,v,bySKU);persist();planner.changed();toast('Backup restored. Your tools, preferences, shortlist and notes were updated.');}catch{toast('Could not restore this file. Choose a backup created by this site.');}e.target.value='';});
let lastFocus;
const mobileQuery=window.matchMedia('(max-width:700px)');
function filterAccessibility(){
 const mobile=mobileQuery.matches,open=mobile&&$('filters').classList.contains('open');
 $('filters').inert=mobile&&!open;
 ['.masthead','.intro','.catalog','#compare-tray'].forEach(selector=>{document.querySelector(selector).inert=open;});
 if(open){$('filters').setAttribute('role','dialog');$('filters').setAttribute('aria-modal','true');}
 else{$('filters').removeAttribute('role');$('filters').removeAttribute('aria-modal');}
 if(!mobile){$('filters').classList.remove('open');$('filter-backdrop').hidden=true;$('open-filters').setAttribute('aria-expanded','false');}
}
mobileQuery.addEventListener('change',filterAccessibility);
window.addEventListener('resize',filterAccessibility);
function closeFilters(){$('filters').classList.remove('open');$('filter-backdrop').hidden=true;$('open-filters').setAttribute('aria-expanded','false');filterAccessibility();if(lastFocus)lastFocus.focus();}
$('open-filters').setAttribute('aria-expanded','false');$('open-filters').setAttribute('aria-controls','filters');
$('open-filters').addEventListener('click',()=>{lastFocus=document.activeElement;$('filters').classList.add('open');$('filter-backdrop').hidden=false;$('open-filters').setAttribute('aria-expanded','true');filterAccessibility();$('close-filters').focus();});
$('close-filters').addEventListener('click',closeFilters);$('filter-backdrop').addEventListener('click',closeFilters);
document.addEventListener('keydown',e=>{if(!$('filters').classList.contains('open'))return;if(e.key==='Escape'){closeFilters();return;}if(e.key==='Tab'){const nodes=[...$('filters').querySelectorAll('button,input,select')].filter(n=>n.offsetParent!==null);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'){const img=e.target;const div=document.createElement('div');div.className='photo-placeholder';div.innerHTML=icon('tool')+'<span>Photo could not load</span>';img.replaceWith(div);}},true);
syncControls();render();filterAccessibility();planner.init();
})();
