'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const taxonomy=require('../site/assets/tool-taxonomy.js');
const ownership=require('../site/assets/ownership.js');
const row=(Product,Category='',sku='candidate')=>({Product,Category,'Item Number':sku});
const coverage=(product,inventory=[],rules=[],catalog)=>ownership.coverageForProduct(product,inventory,rules,{},catalog);

test('tool choices are unique, grouped and searchable with practical synonyms',()=>{
  assert.ok(taxonomy.TYPES.length>=100);
  assert.equal(new Set(taxonomy.TYPES.map(t=>t.id)).size,taxonomy.TYPES.length);
  for(const t of taxonomy.TYPES) {
    assert.ok(taxonomy.GROUPS.some(g=>g.id===t.group),t.id);
    assert.ok(ownership.FAMILIES.some(f=>f.id===t.family),t.id);
  }
  assert.ok(taxonomy.searchTypes('allen').some(t=>t.id==='hex-keys'));
  assert.ok(taxonomy.searchTypes('crow foot').some(t=>t.id==='crowfoot-wrenches'));
  assert.ok(taxonomy.searchTypes('impact','air-tools').every(t=>t.group==='air-tools'));
  assert.equal(taxonomy.searchTypes('no such tool abcd123').length,0);
});

test('air tools and electric tools remain different even for identical jobs',()=>{
  for(const [air,electric,type] of [
    ['1/2 in. Air Impact Wrench','20V Cordless 1/2 in. Impact Wrench','impact-wrenches'],
    ['3/8 in. Air Ratchet Wrench','12V Cordless Ratchet','ratchets'],
    ['1/2 in. Air Drill','20V Cordless Drill','drills'],
  ]) {
    assert.equal(taxonomy.classify(row(air)).type,`air-${type}`);
    assert.equal(taxonomy.classify(row(electric)).type,`electric-${type}`);
    assert.equal(ownership.classifyProduct(row(air)).family,'air-tools');
    assert.equal(ownership.classifyProduct(row(electric)).family,'power-tools');
  }
  assert.equal(taxonomy.classify(row('Refrigerant Manifold Gauge Set','Air Conditioning')).group,'engine');
  assert.equal(taxonomy.classify(row('Two-Stage A/C Vacuum Pump','Air Conditioning')).group,'engine');
});

test('sockets distinguish deep, shallow, impact, bits and mixed kits',()=>{
  const cases=[
    ['Metric Deep Chrome Socket Set','chrome-deep-sockets'],
    ['Metric Shallow Chrome Socket Set','chrome-shallow-sockets'],
    ['SAE Deep Impact Socket Set','impact-deep-sockets'],
    ['SAE Shallow Impact Socket Set','impact-shallow-sockets'],
    ['3/8 in. Drive Star Bit Socket Set','torx-sockets'],
    ['Hex Bit Socket Set','hex-bit-sockets'],
    ['Mechanics Tool Set','mixed-socket-sets'],
  ];
  for(const [name,id] of cases) assert.equal(taxonomy.classify(row(name)).type,id,name);
  assert.equal(taxonomy.classify(row('Socket Organizer Rails')).group,'storage');
});

test('broad source categories do not override the actual tool or turn kits into batteries',()=>{
  assert.equal(taxonomy.classify(row('10 in. Adjustable Wrench','Adjustable and pipe wrenches')).type,'adjustable-wrenches');
  assert.equal(taxonomy.classify(row('Titanium Drill Bit Set','Drill bit and drill tap sets')).type,'twist-drill-bits');
  assert.equal(taxonomy.classify(row('20V Cordless Hammer Drill Kit with Battery and Charger','Cordless drill and screwdriver kits')).type,'electric-drills');
  assert.equal(taxonomy.classify(row('12V 2 Ah Lithium-Ion Compact Lightweight Battery','Hercules Battery System')).type,'power-batteries-chargers');
  assert.equal(taxonomy.classify(row('Air Compressor Accessory Kit','Air compressor accessory and connector kits')).type,'air-fittings-accessories');
  assert.equal(taxonomy.classify(row('4 in. Drill Press Vise','Clamps, vises and anvils')).type,'clamps-vises');
  assert.equal(taxonomy.classify(row('Pressure Washer Stubby Spray Gun','Car Washing Accessories')).type,'vacuum-cleaning');
});

test('type rules suppress exactly one selected type and can be disabled',()=>{
  const deep=row('Metric Deep Impact Socket Set'), shallow=row('Metric Shallow Impact Socket Set');
  const rules=[{mode:'type',type:'impact-deep-sockets',family:'sockets',enabled:true}];
  assert.equal(coverage(deep,[],rules).source,'type');
  assert.equal(coverage(deep,[],rules).hidden,true);
  assert.equal(coverage(shallow,[],rules).hidden,false);
  assert.equal(coverage(deep,[],[{...rules[0],enabled:false}]).hidden,false);
  const air=row('1/2 in. Air Impact Wrench'),electric=row('20V Cordless Impact Wrench');
  assert.equal(coverage(air,[],[{mode:'type',type:'air-impact-wrenches',family:'air-tools'}]).hidden,true);
  assert.equal(coverage(electric,[],[{mode:'type',type:'air-impact-wrenches',family:'air-tools'}]).hidden,false);
});

test('unknown or malformed type rules are rejected rather than broadened to families',()=>{
  assert.deepEqual(ownership.normalizeRules([{mode:'type',type:'not-valid',family:'sockets'}]),[]);
  assert.deepEqual(ownership.normalizeRules([{mode:'type',family:'sockets'}]),[]);
  assert.equal(coverage(row('Deep Impact Socket Set'),[],[{mode:'type',type:'not-valid',family:'sockets'}]).hidden,false);
  const rule=ownership.normalizeRules([{mode:'type',type:'air-ratchets',family:'sockets'}])[0];
  assert.equal(rule.family,'air-tools');
  assert.equal(rule.type,'air-ratchets');
});

test('explicit any-brand nonsized ownership survives normalization and covers only its chosen type',()=>{
  const inventory=ownership.normalizeInventory([{id:'my-meter',label:'My Fluke meter',toolType:'multimeters-testers',source:'manual'}]);
  assert.equal(inventory.length,1);
  assert.deepEqual(inventory[0].capabilities,[]);
  assert.equal(inventory[0].toolType,'multimeters-testers');
  assert.equal(coverage(row('Digital Multimeter','Multimeters and Testers'),inventory).hidden,true);
  assert.equal(coverage(row('OBD2 Scan Tool','Diagnostic Testing and Scanning'),inventory).hidden,false);
  assert.equal(coverage(row('Digital Multimeter'),[{...inventory[0],condition:'broken'}]).hidden,false);
  assert.deepEqual(ownership.normalizeInventory([{label:'Invalid tool',toolType:'not-valid'}]),[]);
});

test('catalog ownership metadata never hides neighboring products of the same type',()=>{
  const first=row('Digital Multimeter','Multimeters and Testers','123');
  const second=row('Digital Multimeter with Leads','Multimeters and Testers','456');
  const owned=ownership.inventoryFromProduct(first);
  assert.equal(owned.toolType,'multimeters-testers');
  assert.equal(coverage(first,[owned]).source,'sku');
  assert.equal(coverage(second,[owned]).hidden,false);
});

test('family rules remain compatible while air and electric families suppress independently',()=>{
  const normalized=ownership.normalizeRules([{family:'wrenches'},{family:'sockets',mode:'exact',dimensions:{system:'metric'}}]);
  assert.equal(normalized[0].mode,'family');
  assert.equal(normalized[1].mode,'exact');
  assert.equal(coverage(row('Metric Combination Wrench Set'),[],[{family:'wrenches'}]).hidden,true);
  assert.equal(coverage(row('Air Ratchet'),[],[{family:'power-tools'}]).hidden,false);
  assert.equal(coverage(row('Air Ratchet'),[],[{family:'air-tools'}]).hidden,true);
  assert.equal(coverage(row('Cordless Ratchet'),[],[{family:'air-tools'}]).hidden,false);
});

test('cached descriptors receive the air/electric split without losing existing dimensional evidence',()=>{
  const product=row('1/2 in. Air Impact Wrench','Air Impact Wrenches and Hammers','123');
  const cached={sku:'123',family:'hammers',families:['hammers'],capabilities:[],dimensions:{drive:'1/2'},issues:['Preserved issue'],coverageComplete:false};
  const d=ownership.classifyProduct(product,{'123':cached});
  assert.equal(d.family,'air-tools');
  assert.deepEqual(d.families,['air-tools']);
  assert.deepEqual(d.dimensions,{drive:'1/2'});
  assert.deepEqual(d.issues,['Preserved issue']);
  assert.equal(cached.family,'hammers');
  const socket=row('Deep Chrome Socket Set','Socket sets','456');
  const profile={family:'sockets',system:'metric',drive:'3/8',depth:'deep',impact:false,points:'6',profile:'hex',style:'fixed',sizes:['10','11']};
  const ready={...cached,sku:'456',family:'sockets',families:['sockets'],capabilities:[profile],coverageComplete:true};
  assert.deepEqual(ownership.classifyProduct(socket,{'456':ready}).capabilities,[profile]);
});

test('show and replacement overrides beat explicit typed ownership',()=>{
  const product=row('Air Impact Wrench');
  const inventory=[{toolType:'air-impact-wrenches',label:'My air wrench'}];
  assert.equal(ownership.coverageForProduct(product,inventory,[],{candidate:'show'}).hidden,false);
  assert.equal(ownership.coverageForProduct(product,inventory,[],{candidate:'replacement'}).hidden,false);
});

test('every saved catalog row resolves to a valid type and every powered cached family is corrected',()=>{
  const source=fs.readFileSync(require.resolve('../site/index.html'),'utf8');
  const products=JSON.parse(source.match(/<script id="catalog-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const capabilities=JSON.parse(fs.readFileSync(require.resolve('../site/data/capabilities.json'),'utf8'));
  for(const product of products) {
    const type=taxonomy.classify(product);
    assert.ok(taxonomy.getType(type.type),product.Product);
    if(type.group==='air-tools'||type.group==='power-tools') {
      const d=ownership.classifyProduct(product,capabilities);
      assert.equal(d.family,type.family,product.Product);
      assert.deepEqual(d.families,[type.family],product.Product);
    }
  }
});

test('vehicle battery tools never become power-tool batteries, including mixed-feature jump packs',()=>{
  const cases=[
    ['Battery Terminal Cleaner','Battery Testers, Tools and Accessories','battery-service-tools'],
    ['100 Amp, 6/12V Battery Load Tester','Diagnostic Testing and Scanning','battery-testers'],
    ['12V Alternator/Battery Checker','Diagnostic Testing and Scanning','battery-testers'],
    ['6/12/24V Digital Battery and System Tester with Printer','Diagnostic Testing and Scanning','battery-testers'],
    ['0.5 Amp, 12V Automatic Battery Maintainer','Battery Chargers and Maintainers','battery-chargers'],
    ['50 Amp, 12V Analog Charger with Engine Start','Battery Chargers and Maintainers','battery-chargers'],
    ['1700 Peak Amp Portable Car Battery Jump Starter and Power Pack','Jump Starters','jump-starters-cables'],
    ['1000 Peak Amp Multifunction Jump Starter and Power Pack with 150 PSI Air Compressor','Jump Starters','jump-starters-cables'],
    ['750 Peak Amp Portable Car Battery Jump Starter with LED Work Light','Jump Starters','jump-starters-cables'],
    ['12 ft. Heavy Duty Booster Cables','Booster Cables','jump-starters-cables'],
  ];
  for(const [name,category,id] of cases) {
    const actual=taxonomy.classify(row(name,category));
    assert.equal(actual.type,id,name);
    assert.equal(actual.group,'diagnostics',name);
  }
  assert.equal(taxonomy.classify(row('Battery-Operated Liquid Transfer Pump','Fluid Collection')).type,'fluid-transfer');
  assert.equal(taxonomy.classify(row('12V Cordless Rotary Tool Kit with Accessories, Battery, and Charger','Rotary tool kits')).type,'electric-grinders');
  assert.equal(taxonomy.classify(row('12V Cordless Oscillating Multi-Tool Kit with Battery and Charger','Oscillating Multi-Tools')).type,'electric-saws');
  assert.equal(taxonomy.classify(row('12V Cordless Drill and Flashlight 2-Tool Combo Kit with Battery and Charger','Cordless drill and screwdriver kits')).type,'electric-combo-kits');
});

test('all catalog vehicle battery equipment routes separately from rechargeable tool batteries',()=>{
  const source=fs.readFileSync(require.resolve('../site/index.html'),'utf8');
  const rows=JSON.parse(source.match(/<script id="catalog-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  for(const product of rows.filter(p=>['Battery Chargers and Maintainers','Battery Testers, Tools and Accessories','Jump Starters','Booster Cables'].includes(p.Category))) {
    assert.equal(taxonomy.classify(product).group,'diagnostics',product.Product);
  }
  for(const product of rows.filter(p=>/Bauer Battery System|Hercules Battery System/.test(p.Category))) {
    assert.equal(taxonomy.classify(product).type,/inverter/i.test(product.Product)?'garage-power':'power-batteries-chargers',product.Product);
  }
});

test('fluid extraction and fastener extraction stay distinct despite pneumatic, socket and drill wording',()=>{
  const cases=[
    ['2.3 Gallon Manual Fluid Extractor','Fluid Collection','fluid-transfer'],
    ['Deluxe Manual Fluid Extractor and Dispenser','Fluid Collection','fluid-transfer'],
    ['Pneumatic Air-Operated Fluid Extractor','Fluid Collection','fluid-transfer'],
    ['Fluid Siphon Pump','Fluid Collection','fluid-transfer'],
    ['3/8 in. Drive SAE Bolt Extractor Socket Set, 9-Piece','Extractor sets','extractors'],
    ['Screw Extractor and Left-Hand Drill Bit Combo Set, 10-Piece','Extractor sets','extractors'],
    ['Impact-Rated Screw Extractor Set, 3-Piece','Extractor sets','extractors'],
    ['Pneumatic Dent Puller','Auto Body','bodywork-tools'],
    ['Slide Hammer and Bearing Puller Set, 5-Piece','Hammer sets','pullers-bearing-tools'],
  ];
  for(const [name,category,id] of cases) assert.equal(taxonomy.classify(row(name,category)).type,id,name);
  const rule=[{mode:'type',type:'extractors',family:'other-tools'}];
  assert.equal(coverage(row('Bolt Extractor Socket Set'),[],rule).hidden,true);
  assert.equal(coverage(row('Manual Fluid Extractor'),[],rule).hidden,false);
});

test('actual catalog fluid extractors and all extractor sets use their intended service types',()=>{
  const source=fs.readFileSync(require.resolve('../site/index.html'),'utf8');
  const rows=JSON.parse(source.match(/<script id="catalog-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  for(const sku of ['62643','70795','57056']) {
    const product=rows.find(p=>p['Item Number']===sku);
    assert.ok(product,sku);
    assert.equal(taxonomy.classify(product).type,'fluid-transfer',product.Product);
  }
  for(const product of rows.filter(p=>p.Category==='Extractor sets')) assert.equal(taxonomy.classify(product).type,'extractors',product.Product);
});

test('storage wheels and lighting clamps remain features rather than changing the tool type',()=>{
  assert.equal(taxonomy.classify(row('Modular Rolling Toolbox with 8 in. Wheels and Removable Handle','Tool Boxes')).type,'tool-bags-boxes');
  assert.equal(taxonomy.classify(row('4200 Lumen LED Rechargeable Heavy Duty Clamp Light','Work Lights')).type,'work-lights');
  assert.equal(taxonomy.classify(row('20V Cordless Work Light, Tool Only','Work Lights')).type,'work-lights');
  assert.equal(taxonomy.classify(row('1000 Lumen Dual-Sided Rechargeable Slim Bar Light with UV Inspection','Work Lights')).type,'work-lights');
  const source=fs.readFileSync(require.resolve('../site/index.html'),'utf8');
  const rows=JSON.parse(source.match(/<script id="catalog-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  for(const product of rows.filter(p=>['Work Lights','Flashlights','Portable Work Lights','Ultra-Bright Flashlights','Job Site Lighting','Motion Activated Lights'].includes(p.Category))) assert.equal(taxonomy.classify(product).group,'lighting',product.Product);
  for(const product of rows.filter(p=>['Tool Boxes','Tool Bags','Tool Carts','Tool Organizers','Drawer Organizers','Organizers','Garage Shelving and Storage','Parts Bins and Racks','Parts Cases','Storage Accessories'].includes(p.Category))) assert.equal(taxonomy.classify(product).group,'storage',product.Product);
});
