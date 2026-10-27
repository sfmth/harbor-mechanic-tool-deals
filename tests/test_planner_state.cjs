'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ToolOwnership=require('../site/assets/ownership.js');
const window={ToolOwnership};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../site/assets/planner-ui.js'),'utf8'),{window,ToolOwnership,URL,console});
const {sanitize,merge}=window.MechanicPlanner;
const plain=value=>JSON.parse(JSON.stringify(value));
const rows=new Map([
 ['10001',{'Item Number':'10001',Product:'My catalog jack',Category:'Jacks',_included:true}],
 ['10002',{'Item Number':'10002',Product:'My other catalog tool',Category:'Pliers',_included:true}]
]);
const base=()=>({version:2,saved:['10001'],reviews:{'10001':'consider'},notes:{'10001':'Keep this note'},inventory:[{id:'already-owned',sku:'10002',label:'Existing owned tool',capabilities:[]}],rules:[{family:'jacks',mode:'family',enabled:true}],settings:{monthlyBudget:125,member:true,zip:'95060',storeName:'My store',notifications:true,alertDiscount:30},overrides:{'10001':'show'},purchases:[{id:'purchase-1',sku:'10002',label:'Purchased tool',date:'2026-10-26',price:29.99,quantity:1}],alerts:[{id:'alert-1',title:'Existing alert'}],seenAlerts:['seen-1']});

test('version-1 reviews migrate owned SKUs once and preserve legacy shortlist and notes',()=>{
 const old={version:1,saved:['10001'],reviews:{'10001':'owned','10002':'consider'},notes:{'10001':'My note'}};
 const result=plain(sanitize(old,rows));
 assert.equal(result.version,2);assert.deepEqual(result.saved,['10001']);assert.equal(result.notes['10001'],'My note');
 assert.equal(result.inventory.length,1);assert.equal(result.inventory[0].sku,'10001');
 assert.equal(result.reviews['10002'],'consider');
 assert.equal(sanitize(result,rows).inventory.length,1);
});
test('version-2 inventory removal is authoritative and does not recreate ownership from stale reviews',()=>{
 const result=plain(sanitize({version:2,saved:[],reviews:{'10001':'owned'},inventory:[]},rows));
 assert.deepEqual(result.inventory,[]);
 assert.deepEqual(plain(sanitize(result,rows)).inventory,[]);
});
test('manual and retired-SKU inventory survives even when absent from the current catalog',()=>{
 const input={version:2,saved:[],inventory:[{id:'retired',sku:'old-unlisted-sku',label:'My old tool',capabilities:[],evidence:{source:'Saved manual',verifiedAt:'2026-10-26',issues:[]}}]};
 const result=plain(sanitize(input,rows));
 assert.equal(result.inventory[0].sku,'old-unlisted-sku');assert.equal(result.inventory[0].evidence.source,'Saved manual');
});
test('importing a legacy backup preserves newer settings and planner state',()=>{
 const current=base();
 const result=plain(merge(current,{version:1,saved:['10002'],reviews:{'10001':'owned'},notes:{'10002':'Imported note'}},rows));
 assert.equal(result.settings.monthlyBudget,125);assert.equal(result.settings.member,true);assert.equal(result.settings.zip,'95060');
 assert.equal(result.settings.notifications,true);assert.equal(result.settings.alertDiscount,30);
 assert.deepEqual(result.overrides,current.overrides);assert.deepEqual(result.alerts,current.alerts);assert.deepEqual(result.seenAlerts,current.seenAlerts);
 assert.equal(result.purchases.length,1);assert.deepEqual(result.saved,['10001','10002']);
 assert.equal(result.notes['10001'],'Keep this note');assert.equal(result.notes['10002'],'Imported note');
 assert.ok(result.inventory.some(x=>x.sku==='10001'),'Imported legacy ownership should apply immediately');
 assert.ok(result.inventory.some(x=>x.id==='already-owned'));
});
test('version-2 inventory and purchase imports merge by persistent ID',()=>{
 const current=base();
 const result=plain(merge(current,{version:2,saved:[],inventory:[{id:'already-owned',sku:'10002',label:'Updated label',capabilities:[]},{id:'another',sku:'retired-sku',label:'Another tool',capabilities:[]}],purchases:[{id:'purchase-1',sku:'10002',label:'Corrected purchase',date:'2026-10-26',price:25,quantity:1}]},rows));
 assert.equal(result.inventory.length,2);assert.equal(result.inventory.find(x=>x.id==='already-owned').label,'Updated label');
 assert.equal(result.purchases.length,1);assert.equal(result.purchases[0].price,25);
});
test('malformed manual coverage does not become a meaningless inventory row',()=>{
 const result=plain(sanitize({version:2,saved:[],inventory:[{id:'invalid',family:'sockets',system:'metric',sizes:'not sizes'}]},rows));
 assert.deepEqual(result.inventory,[]);
});
