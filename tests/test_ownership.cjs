'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const api=require('../site/assets/ownership.js');
const cap=(sizes,overrides={})=>({family:'sockets',system:'metric',drive:'3/8',depth:'deep',impact:false,points:'6',profile:'hex',style:'fixed',sizes,...overrides});
const row={sku:'candidate'};
const descriptor=(capabilities,extra={})=>({sku:'candidate',family:'sockets',families:['sockets'],label:'Test sockets',capabilities,coverageComplete:true,issues:[],...extra});
const check=(d,inventory=[],rules=[],overrides={})=>api.coverageForProduct(row,inventory,rules,overrides,{candidate:d});
const own=(capabilities,extra={})=>({id:'mine',label:'Any brand tools',capabilities,...extra});
test('exact fractions canonicalize without metric/SAE cross-conversion',()=>{
 assert.equal(api.normalizeSize('2/4 in.','SAE'),'1/2');assert.equal(api.normalizeSize('1-1/4','sae'),'5/4');
 assert.equal(api.normalizeSize('0.05 in.','sae'),'1/20');assert.equal(api.normalizeSize('5.50 mm','metric'),'5.5');
 assert.equal(api.normalizeSize('1/0','sae'),null);assert.equal(api.normalizeSize('TR10','torx'),'T10');
});
test('subsets are covered; endpoint extensions remain visible',()=>{
 const inventory=[own([cap(['8','9','10','11','12','13','14','15','16','17','18','19'])])];
 assert.equal(check(descriptor([cap(['10','11','12'])]),inventory).hidden,true);
 const partial=check(descriptor([cap(['18','19','20','21'])]),inventory);
 assert.equal(partial.status,'partial');assert.equal(partial.hidden,false);assert.deepEqual(partial.missing.map(x=>x.size),['20','21']);
});
test('owned capabilities combine across brands and sets',()=>{
 assert.equal(check(descriptor([cap(['8','9','10'])]),[own([cap(['8','9'])]),own([cap(['10'])],{id:'second'})]).covered,true);
});
test('missing sizes are subtracted and not silently filled',()=>{
 const result=check(descriptor([cap(['8','9','10'])]),[own([cap(['8','9','10'])],{missingSizes:['10']})]);
 assert.deepEqual(result.missing.map(x=>x.size),['10']);assert.equal(result.hidden,false);
});
test('depth, impact, drive, points and profile remain distinct',()=>{
 for(const patch of [{depth:'shallow'},{impact:true},{drive:'1/2'},{points:'12'},{profile:'torx'}]) {
  assert.equal(check(descriptor([cap(['10'])]),[own([cap(['10'],patch)])]).hidden,false,JSON.stringify(patch));
 }
 assert.equal(check(descriptor([cap(['10'])]),[own([cap(['10'],{system:'sae'})])]).hidden,false);
});
test('unknown profile prevents automatic hiding even if unknowns match',()=>{
 const d=descriptor([cap(['10'],{points:'unknown'})],{coverageComplete:false,issues:['Unverified points.']});
 const result=check(d,[own([cap(['10'],{points:'unknown'})])]);assert.equal(result.hidden,false);assert.equal(result.status,'unknown');
});
test('mixed kits stay visible while unverified components remain',()=>{
 const d=descriptor([cap(['10'])],{coverageComplete:false,families:['sockets','ratchets'],issues:['Unverified ratchet.']});
 assert.equal(check(d,[own([cap(['10'])])]).hidden,false);
 assert.equal(check(d,[],[{family:'sockets'}]).hidden,false);
 assert.equal(check(d,[],[{family:'sockets'},{family:'ratchets'}]).hidden,true);
});
test('whole-family rules are explicit, reversible and independent of exact profiles',()=>{
 const d=descriptor([],{coverageComplete:false,issues:['Unknown.']});
 assert.equal(check(d,[],[{family:'sockets'}]).source,'family');
 assert.equal(check(d,[],[{family:'sockets',enabled:false}]).hidden,false);
 assert.equal(check(d,[],[{family:'sockets'}],{candidate:'show'}).hidden,false);
});
test('exact SKU ownership works with sparse evidence; replacements override it',()=>{
 const d=descriptor([],{coverageComplete:false,issues:['Unknown.']});
 const inventory=[own([],{sku:'candidate'})];assert.equal(check(d,inventory).status,'owned');
 assert.equal(check(d,inventory,[],{candidate:'replacement'}).hidden,false);
 assert.equal(check(d,[own([],{sku:'candidate',condition:'broken'})]).hidden,false);
});
test('normalization preserves retired SKU/manual evidence without current catalog membership',()=>{
 const normalized=api.normalizeInventory([own([cap(['10'])],{sku:'retired-product',paidPrice:29.99,acquiredAt:'2026-10-26',evidence:{source:'My saved tool manual',verifiedAt:'2026-10-26',issues:[]}})]);
 assert.equal(normalized[0].sku,'retired-product');assert.equal(normalized[0].paidPrice,29.99);
 assert.equal(normalized[0].evidence.source,'My saved tool manual');
 assert.equal(check(descriptor([cap(['10'])]),normalized).hidden,true);
});
test('manual wildcard is intentional and never inferred',()=>{
 const d=descriptor([cap(['10'],{points:'unknown'})],{coverageComplete:false,issues:['Unverified points.']});
 assert.equal(check(d,[own([cap(['10'],{points:'any'})])]).hidden,false);
});
test('blank, invalid or unsupported manual size entries are rejected; sparse exact SKUs remain',()=>{
 assert.deepEqual(api.normalizeInventory([{family:'sockets',system:'metric',sizes:''}]),[]);
 assert.deepEqual(api.normalizeInventory([{family:'sockets',system:'metric',sizes:'not sizes'}]),[]);
 assert.deepEqual(api.normalizeInventory([{family:'pliers',system:'metric',sizes:'10,12'}]),[]);
 assert.equal(api.normalizeInventory([{sku:'old-exact-sku',capabilities:[]}]).length,1);
});
test('manual TORX and crowfoot dimensions stay distinct from ordinary sockets/wrenches',()=>{
 const torx=cap(['T20'],{system:'torx',profile:'torx',points:'not-applicable',depth:'not-applicable'});
 assert.equal(check(descriptor([torx]),[own([torx])]).hidden,true);
 assert.equal(check(descriptor([torx]),[own([cap(['T20'],{system:'torx',profile:'torx'})])]).hidden,false);
 const wrench={family:'wrenches',system:'metric',style:'crowfoot',ratcheting:false,head:'fixed',length:'standard',points:'not-applicable',drive:'3/8',sizes:['10']};
 assert.equal(check(descriptor([wrench],{family:'wrenches',families:['wrenches']}),[own([wrench])]).hidden,true);
 assert.equal(check(descriptor([wrench],{family:'wrenches',families:['wrenches']}),[own([{...wrench,drive:'not-applicable'}])]).hidden,false);
});
test('real catalog parsing separates dimensional drives and bit profiles',()=>{
 const r={'Item Number':'x',Category:'Bit socket sets',Product:'1/4 in. and 3/8 in. Drive Star Bit Socket Set','Size Review Status':'No skipped standard sizes found','Sizes Reviewed':'1/4 in. drive: T10, T15; 3/8 in. drive: T30, T40','Measurement System':''};
 const d=api.classifyProduct(r);assert.equal(d.capabilities.length,2);assert.equal(d.capabilities[0].drive,'1/4');assert.equal(d.capabilities[1].drive,'3/8');
 assert.deepEqual(d.capabilities[0].sizes,['T10','T15']);assert.equal(d.coverageComplete,false);
});
test('family classifiers do not swallow adjustable, torque or powered ratchet tools',()=>{
 assert.equal(api.classifyProduct({Product:'3/8 in. Torque Wrench',Category:'Torque Tools'}).family,'torque-wrenches');
 assert.equal(api.classifyProduct({Product:'10 in. Adjustable Wrench',Category:'Adjustable and pipe wrenches'}).family,'adjustable-wrenches');
 assert.equal(api.classifyProduct({Product:'3/8 in. Air Ratchet Wrench',Category:'Air Ratchet Wrenches'}).family,'air-tools');
});
