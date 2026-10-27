/* Functional ownership coverage. Unknown specifications never prove equivalence. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToolOwnership = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 2;
  const FAMILIES = [
    ['sockets', 'Sockets and socket sets', ['system','drive','depth','impact','points','profile','style']],
    ['wrenches', 'Fixed-size wrenches', ['system','style','ratcheting','head','length','points','drive']],
    ['hex-keys', 'Hex and TORX keys', ['system','profile','style']],
    ['drill-bits', 'Drill bits', ['system','style','material','shank']],
    ['driver-bits', 'Driver bits and nut setters', ['system','profile','style','impact','shank']],
    ['socket-accessories', 'Socket extensions and adapters', []],
    ['ratchets', 'Hand ratchets', []], ['torque-wrenches', 'Torque tools', []],
    ['breaker-bars', 'Breaker bars', []], ['adjustable-wrenches', 'Adjustable and pipe wrenches', []],
    ['pliers', 'Pliers and wire tools', []], ['hammers', 'Hammers and mallets', []],
    ['jacks', 'Jacks', []], ['jack-stands', 'Jack stands', []], ['ramps', 'Vehicle ramps', []],
    ['diagnostics', 'Diagnostics and electrical testing', []], ['power-tools', 'Power and air tools', []],
    ['lighting', 'Garage lighting', []], ['storage', 'Tool storage and organizers', []],
    ['other-tools', 'Other tools and garage equipment', []]
  ].map(([id,label,dimensions]) => Object.freeze({id,label,dimensions:Object.freeze(dimensions)}));
  const familyMap = new Map(FAMILIES.map(f => [f.id,f]));
  const DIMENSIONS = ['system','drive','depth','impact','points','style','profile','ratcheting','head','length','material','shank'];
  const UNKNOWN = 'unknown';
  const clean = v => String(v == null ? '' : v).trim();
  const uniq = values => [...new Set(values)];
  const gcd = (a,b) => b ? gcd(b,a%b) : a;
  function rational(value) {
    let v = clean(value).replace(/[″”"]/g,'').replace(/\s*(?:inches|inch|in\.)\s*$/i,'').trim();
    let n,d;
    let m = v.match(/^(\d+)[ -]+(\d+)\/(\d+)$/);
    if (m) { d=Number(m[3]); n=Number(m[1])*d+Number(m[2]); }
    else if ((m=v.match(/^(\d+)\/(\d+)$/))) { n=Number(m[1]); d=Number(m[2]); }
    else if (/^\d+(?:\.\d+)?$/.test(v)) {
      const places=(v.split('.')[1]||'').length; if (places>6) return null;
      d=10**places; n=Math.round(Number(v)*d);
    } else return null;
    if (!(n>0 && d>0 && Number.isSafeInteger(n) && Number.isSafeInteger(d))) return null;
    const g=gcd(n,d); n/=g; d/=g; return d===1?String(n):`${n}/${d}`;
  }
  function systemName(value) {
    const v=clean(value).toLowerCase();
    if (['sae','inch','inches','fractional'].includes(v)) return 'sae';
    if (['metric','mm'].includes(v)) return 'metric';
    if (['torx','external-torx','number','letter'].includes(v)) return v;
    return UNKNOWN;
  }
  function normalizeSize(value, system) {
    const sys=systemName(system); let v=clean(value);
    if (sys==='sae') return rational(v);
    if (sys==='metric') { v=v.replace(/\s*mm$/i,'').trim(); return /^\d+(?:\.\d+)?$/.test(v)&&Number(v)>0?String(Number(v)):null; }
    if (sys==='torx'||sys==='external-torx') { const m=v.toUpperCase().match(/^(T|TR|E)?(\d+)$/);return m?`${sys==='external-torx'?'E':'T'}${Number(m[2])}`:null; }
    if (sys==='number') return /^#?\d+$/.test(v)?`#${Number(v.replace('#',''))}`:null;
    if (sys==='letter') return /^[A-Z]$/i.test(v)?v.toUpperCase():null;
    return null;
  }
  function normalizeSizes(values, system) {
    if (typeof values==='string') values=values.split(/[,;\n]+/);
    return uniq((Array.isArray(values)?values:[]).slice(0,500).map(v=>normalizeSize(v,system)).filter(Boolean));
  }
  function familyOf(row) {
    const c=clean(row.Category).toLowerCase(), n=clean(row.Product||row.label).toLowerCase(), t=`${c} ${n}`;
    if (/torque wrench|torque tools|torque adapter/.test(t)) return 'torque-wrenches';
    if (/breaker bar/.test(t)) return 'breaker-bars';
    if (/socket extensions|socket.*adapter|socket accessory|socket driver|socket adapter/.test(t)&&!/nut setter/.test(t)) return 'socket-accessories';
    if (/jack stands|jack stand|support stand/.test(n)) return 'jack-stands';
    if (/ratchets$/.test(c)) return 'ratchets';
    if (/adjustable.*wrench|pipe wrench/.test(t)) return 'adjustable-wrenches';
    if (/hex and torx key|hex key|torx.*key/.test(t)) return 'hex-keys';
    if (/crowfoot|flare nut|wrench sets|ratcheting wrench/.test(t)&&!/air ratchet/.test(t)) return 'wrenches';
    if (/socket/.test(t)&&!/socket holder|socket organizer|socket rail/.test(t)) return 'sockets';
    if (/drill bit|step drill/.test(t)) return 'drill-bits';
    if (/driver bit|nut setter|nut driver/.test(t)) return 'driver-bits';
    if (/pliers|plier sets|wire tools/.test(c)) return 'pliers';
    if (/hammer|mallet/.test(c)) return 'hammers';
    if (/jacks|bottle jack|floor jack/.test(t)) return 'jacks';
    if (/vehicle ramp|automotive ramp|service ramp/.test(t)) return 'ramps';
    if (/diagnostic|multimeter|electrical test|battery test|code reader|scan tool/.test(t)) return 'diagnostics';
    if (/light|flashlight/.test(c)) return 'lighting';
    if (/storage|organizer|tool cart|tool chest|tool bag|tool box/.test(c)) return 'storage';
    if (/air tools|air drills|air ratchet|impact wrench|cordless|corded|power tools|grinders|saws/.test(t)) return 'power-tools';
    return 'other-tools';
  }
  function spec(row, pattern) { return clean(Object.entries(row._enrichment?.specs||{}).find(([k])=>pattern.test(k))?.[1]); }
  function singleDrive(value) {
    const matches=uniq((clean(value).match(/(?:\d+[ -])?\d+\/\d+/g)||[]).map(rational).filter(Boolean));
    return matches.length===1?matches[0]:UNKNOWN;
  }
  function baseDimensions(row,family,context) {
    const name=clean(row.Product).toLowerCase(), t=(context||name).toLowerCase();
    const dim={system:systemName(row['Measurement System'])};
    if (family==='sockets') {
      dim.drive=singleDrive(spec(row,/^drive size$/i)||name.match(/^(.+?)\bdrive\b/)?.[1]);
      dim.depth=/semi.?deep/.test(t)?'semi-deep':/\bdeep\b/.test(t)?'deep':/shallow|standard socket/.test(t)?'shallow':UNKNOWN;
      dim.impact=/impact/.test(name)||/impact socket/i.test(row.Category)?true:/chrome|chrome plated/.test(name+' '+spec(row,/^coating$|^finish$/i))?false:UNKNOWN;
      dim.profile=/triple.?square/.test(name)?'triple-square':/e-socket|external.?torx/.test(name)?'external-torx':/torx|star bit/.test(name)?'torx':/hex.*(?:bit|socket)|ball hex/.test(name)?'hex-bit':/spline/.test(name)?'spline':/screwdriver bit/.test(name)?'screwdriver': 'hex';
      dim.style=/pass.?thru/.test(name)?'pass-through':/swivel|universal.*socket/.test(name)?'swivel':/low.?profile/.test(name)?'low-profile':/ball/.test(name)?'ball-end':/long/.test(name)?'long':'fixed';
      const points=spec(row,/^points of contact$/i)||name.match(/\b(6|12)[ -]point/)?.[1];
      dim.points=/^(?:6|12)$/.test(points)?String(points):['torx','external-torx','hex-bit','triple-square','screwdriver'].includes(dim.profile)?'not-applicable':UNKNOWN;
      if (dim.profile!=='hex'&&dim.depth===UNKNOWN) dim.depth='not-applicable';
    } else if (family==='wrenches') {
      dim.style=/crowfoot/.test(name)?(/flare/.test(name)?'crowfoot-flare':'crowfoot'):/flare/.test(name)?'flare-nut':/combination/.test(name)?'combination':/open.?end/.test(name)?'open-end':/service wrench/.test(name)?'service':/box|offset.*ratchet/.test(name)?'box-end':/obstruction|s-type|s-shaped/.test(name)?'obstruction':UNKNOWN;
      dim.ratcheting=/ratchet/.test(name);
      dim.head=/flex/.test(name)?'flex':/offset/.test(name)?'offset':/angled/.test(name)?'angled':'fixed';
      dim.length=/stubby/.test(name)?'stubby':/extra.?long/.test(name)?'extra-long':/long/.test(name)?'long':'standard';
      const points=spec(row,/^points of contact$/i)||name.match(/\b(6|12)[ -]point/)?.[1];
      dim.points=/^(?:6|12)$/.test(points)?String(points):['open-end','service','crowfoot'].includes(dim.style)?'not-applicable':UNKNOWN;
      dim.drive=/crowfoot/.test(dim.style)?singleDrive(spec(row,/^drive size$/i)||name.match(/^(.+?)\bdrive\b/)?.[1]):'not-applicable';
    } else if (family==='hex-keys') {
      dim.profile=/torx|star/.test(name)?(/tamper|security/.test(name)?'security-torx':'torx'):/ball/.test(name)?'ball-hex':'hex';
      dim.style=/t-handle/.test(name)?'t-handle':/fold/.test(name)?'folding':/l-shap|l-shape/.test(name)?'l-key':UNKNOWN;
    } else if (family==='drill-bits') {
      dim.style=/step/.test(name)?'step':/tap/.test(name)?'drill-tap':'twist';
      dim.material=/cobalt/.test(name)?'cobalt':/high.?speed steel|titanium|black oxide/.test(name)?'hss':UNKNOWN;
      dim.shank=/hex shank|quick.?change/.test(name)?'hex':/round shank/.test(name+' '+spec(row,/shank type|shank style/i))?'round':UNKNOWN;
    } else if (family==='driver-bits') {
      dim.profile=/nut/.test(name)?'hex-nut':/torx|star/.test(name)?'torx':/hex/.test(name)?'hex':UNKNOWN;
      dim.style=/nut setter/.test(name)?'nut-setter':/nut driver/.test(name)?'nut-driver':'bit';
      dim.impact=/impact/.test(name)?true:UNKNOWN;
      dim.shank=/nut driver/.test(name)?'integral-handle':/hex|nut setter/.test(name)?'1/4-hex':UNKNOWN;
    }
    return dim;
  }
  function extractSizes(text,system) {
    const s=clean(text), sys=systemName(system); let raw=[];
    if (sys==='metric') raw=(s.match(/(?:\d+\.\d+|\d+)\s*mm\b/gi)||[]);
    else if (sys==='sae') raw=(s.match(/(?:\d+[ -])?\d+\/\d+\s*(?:in\.|inches|inch)?|\b\d+(?:\.\d+)?\s*(?:in\.|inches|inch)/gi)||[]);
    else if (sys==='torx'||sys==='external-torx') raw=s.match(/\b(?:TR|T|E)\d+\b/gi)||[];
    // Reviewed lists occasionally put the unit once, at the end of a plain list.
    if (sys==='metric' && /^\s*\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)+\s*mm\s*$/i.test(s)) raw=s.replace(/mm/i,'').split(',');
    if (sys==='sae' && /SAE inches:/i.test(s)) raw=s.replace(/^.*?SAE inches:/i,'').split(/[,;]/);
    return normalizeSizes(raw,sys);
  }
  function classifyProduct(row, catalog) {
    const sku=clean(row['Item Number']||row.sku);
    const ready=catalog?.products?.[sku]||catalog?.[sku];
    if (ready && ready.capabilities) return ready;
    const family=familyOf(row), label=clean(row.Product||row.label), dim=baseDimensions(row,family);
    const result={sku,family,families:[family],label,dimensions:dim,capabilities:[],coverageComplete:false,issues:[]};
    const definition=familyMap.get(family);
    if (!definition?.dimensions.length) { result.issues.push('This family currently supports exact-SKU ownership and explicit family rules.');return result; }
    const reviewed=clean(row['Sizes Reviewed']);
    if (row['Size Review Status']!=='No skipped standard sizes found'||!reviewed) { result.issues.push('A verified size list is required for automatic size coverage.');return result; }
    const mixed=/socket and ratchet|master|modular general service|pass-thru/i.test(row.Category+' '+label)||/universal joint|extension bars|spinner handle|ratchet:|breaker bar:|phillips.*slotted|numbered sizes|letter sizes|other_forms/i.test(reviewed);
    if (mixed) {
      result.issues.push('Mixed contents need confirmed component-to-profile assignments; this kit is not automatically hidden by size coverage.');
      if (/ratchet|master socket/i.test(label)||/ratchet:/i.test(reviewed)) result.families.push('ratchets');
      if (/extension|universal joint|spinner handle/.test(reviewed)) result.families.push('socket-accessories');
      if (/breaker bar/.test(reviewed)) result.families.push('breaker-bars');
      result.families=uniq(result.families); return result;
    }
    let contexts=[{text:reviewed,dim:{...dim}}];
    // Multiple explicitly labeled drives must be associated with their own sizes.
    if (family==='sockets' && /drive\s*:/i.test(reviewed)) {
      contexts=reviewed.split(';').filter(Boolean).map(part=>({text:part.replace(/^.*?drive\s*:/i,''),dim:{...dim,drive:singleDrive(part.match(/^(.+?)\bdrive\s*:/i)?.[1])}}));
    } else if (family==='sockets' && dim.drive===UNKNOWN) result.issues.push('Drive size is not unambiguous.');
    for (const context of contexts) {
      let systems=[];
      if (['torx','external-torx'].includes(context.dim.profile)||family==='hex-keys'&&/torx/.test(context.dim.profile)) systems=[context.dim.profile==='external-torx'?'external-torx':'torx'];
      else if (/\bmm\b|\dmm\b/i.test(context.text)) systems.push('metric');
      if (/(?:in\.|inches|inch|\d\/\d)/i.test(context.text)) systems.push('sae');
      if (!systems.length && context.dim.system!==UNKNOWN) systems=[context.dim.system];
      for (const system of uniq(systems)) {
        const sizes=extractSizes(context.text,system);
        if (sizes.length) result.capabilities.push({...context.dim,family,system,sizes});
      }
    }
    if (!result.capabilities.length) result.issues.push('Sizes could not be safely normalized from the reviewed evidence.');
    const required=definition.dimensions;
    for (const cap of result.capabilities) {
      const unknown=required.filter(k=>cap[k]===UNKNOWN||cap[k]===undefined||cap[k]===null);
      if (unknown.length) result.issues.push(`Unverified ${unknown.join(', ')} for ${cap.system} coverage.`);
    }
    // Complex drill ranges, threaded tools and step-bit combinations stay conservative.
    if (family==='drill-bits' && (/\bto\b|\bthrough\b|\b[a-z]\s*\(0\.|#\d\s*-|Size\(s\):.*#\d/i.test(reviewed)||/step drill bit sets/i.test(row.Category))) result.issues.push('Range or multibit profile requires an explicit component mapping.');
    result.issues=uniq(result.issues);
    result.coverageComplete=result.capabilities.length>0&&!result.issues.length;
    return result;
  }
  function normalizeCapability(value) {
    if (!value || typeof value!=='object') return null;
    const family=clean(value.family), definition=familyMap.get(family);
    if (!definition || !definition.dimensions.length) return null;
    const input={...(value.dimensions||{}),...value}, cap={family,system:systemName(input.system)};
    for (const k of definition.dimensions) {
      if (k==='system') continue;
      let x=input[k];
      if (k==='drive'&&x&&x!=='not-applicable'&&x!=='any') x=rational(x);
      if (typeof x==='boolean') cap[k]=x;
      else cap[k]=clean(x).toLowerCase()||UNKNOWN;
    }
    cap.sizes=normalizeSizes(input.sizes,cap.system);
    const absent=normalizeSizes(input.missingSizes||value.missing,cap.system);
    cap.sizes=cap.sizes.filter(s=>!absent.includes(s));
    return cap.sizes.length?cap:null;
  }
  function normalizeInventory(entries) {
    const source=Array.isArray(entries)?entries:entries?.inventory;
    return (Array.isArray(source)?source:[]).slice(0,5000).filter(v=>v&&typeof v==='object').map((v,index)=>{
      const raw=Array.isArray(v.capabilities)?v.capabilities:[v];
      const caps=raw.map(c=>normalizeCapability({...c,missingSizes:c.missingSizes||v.missingSizes})).filter(Boolean);
      const proof=v.evidence&&typeof v.evidence==='object'?{
        source:clean(v.evidence.source).slice(0,1000),
        verifiedAt:clean(v.evidence.verifiedAt).slice(0,100),
        issues:Array.isArray(v.evidence.issues)?v.evidence.issues.filter(x=>typeof x==='string').slice(0,30).map(x=>x.slice(0,1000)):[]
      }:null;
      return {id:clean(v.id).slice(0,200)||`inventory-${index}`,sku:clean(v.sku||v['Item Number']).slice(0,100),label:clean(v.label||v.name).slice(0,1000),source:clean(v.source)||'manual',condition:clean(v.condition)||'usable',capabilities:caps,coverageComplete:v.coverageComplete!==false,evidence:proof,acquiredAt:clean(v.acquiredAt)||null,paidPrice:Number.isFinite(v.paidPrice)&&v.paidPrice>=0?v.paidPrice:null};
    }).filter(v=>v.sku||v.capabilities.length);
  }
  function normalizeRules(rules) {
    return (Array.isArray(rules)?rules:[]).slice(0,500).filter(r=>r&&familyMap.has(r.family)).map(r=>({id:clean(r.id)||`family-${r.family}`,family:r.family,mode:r.mode==='exact'?'exact':'family',enabled:r.enabled!==false,dimensions:r.dimensions&&typeof r.dimensions==='object'?{...r.dimensions}:{}}));
  }
  function dimensionsMatch(required,owned) {
    const definition=familyMap.get(required.family);
    if (!definition||required.family!==owned.family) return false;
    return definition.dimensions.every(k=>{
      const want=required[k], have=owned[k];
      if (have==='any') return true; // An intentional manual wildcard; never inferred.
      if (want===UNKNOWN||want===undefined||want===null||have===UNKNOWN||have===undefined||have===null) return false;
      return have===want;
    });
  }
  function atomLabel(cap,size) { return `${size}${cap.system==='metric'?' mm':cap.system==='sae'?' in.':''} ${familyMap.get(cap.family)?.label||cap.family}`; }
  function coverageForProduct(row,inventory,rules,overrides,catalog) {
    const descriptor=classifyProduct(row,catalog), sku=descriptor.sku;
    const result={status:'new',covered:false,hidden:false,source:'none',matched:[],missing:[],unknown:[],explanation:'No owned coverage recorded.',descriptor};
    const override=typeof overrides?.[sku]==='object'?overrides[sku].mode:overrides?.[sku];
    if (override==='show'||override==='replacement') return {...result,source:'override',explanation:override==='replacement'?'Shown because you want a replacement.':'Shown by your override.'};
    if (override==='hide') return {...result,status:'covered',covered:true,hidden:true,source:'override',explanation:'Hidden by your product rule.'};
    const owned=normalizeInventory(inventory).filter(v=>v.condition!=='broken'&&v.condition!=='missing'&&v.condition!=='retired');
    if (sku&&owned.some(v=>v.sku===sku)) return {...result,status:'owned',covered:true,hidden:true,source:'sku',explanation:'You already own this exact product.'};
    const broad=normalizeRules(rules).filter(r=>r.enabled&&r.mode==='family');
    const suppressedFamilies=new Set(broad.map(r=>r.family));
    if (descriptor.families.length&&descriptor.families.every(f=>suppressedFamilies.has(f))) return {...result,status:'covered',covered:true,hidden:true,source:'family',explanation:'Hidden by your explicit whole-family preference.'};
    const caps=owned.flatMap(v=>v.capabilities);
    for (const cap of descriptor.capabilities) for (const size of cap.sizes) {
      const atom={family:cap.family,system:cap.system,size,label:atomLabel(cap,size)};
      if (suppressedFamilies.has(cap.family)||caps.some(h=>h.sizes.includes(size)&&dimensionsMatch(cap,h))) result.matched.push(atom);
      else result.missing.push(atom);
    }
    result.unknown=descriptor.issues.slice();
    if (!descriptor.coverageComplete) {
      result.status=result.matched.length?'partial':'unknown';
      result.explanation=result.matched.length?`${result.matched.length} size capabilities covered; unverified contents remain visible.`:'Coverage needs confirmation; this product remains visible.';
    } else if (!result.missing.length&&result.matched.length) {
      result.status='covered';result.covered=true;result.hidden=true;result.source='capabilities';
      result.explanation='All verified sizes and tool profiles are covered by your usable tools.';
    } else if (result.matched.length) {
      result.status='partial';result.source='capabilities';result.explanation=`Adds ${result.missing.map(v=>v.label).join(', ')}.`;
    } else result.explanation=result.missing.length?`Adds ${result.missing.map(v=>v.label).join(', ')}.`:result.explanation;
    return result;
  }
  function inventoryFromProduct(row,catalog,options) {
    const d=classifyProduct(row,catalog), o=options||{};
    return normalizeInventory([{id:o.id||`owned-${d.sku}`,sku:d.sku,label:d.label,source:'catalog',capabilities:d.capabilities,coverageComplete:d.coverageComplete,evidence:{source:clean(row['Size Evidence URL']||row['Product URL']),verifiedAt:clean(row['Checked Date']),issues:d.issues},acquiredAt:o.acquiredAt,paidPrice:o.paidPrice}])[0];
  }
  return Object.freeze({VERSION,FAMILIES,DIMENSIONS,UNKNOWN,normalizeSize,normaliseSize:normalizeSize,normalizeSizes,classifyProduct,normalizeInventory,normaliseInventory:normalizeInventory,normalizeRules,normaliseRules:normalizeRules,coverageForProduct,inventoryFromProduct,dimensionsMatch});
});
