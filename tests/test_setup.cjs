'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Setup=require('../site/assets/setup.js');

test('first-open setup also prompts existing users who have no setup marker',()=>{
 assert.equal(Setup.needsSetup(),true);
 assert.equal(Setup.needsSetup({monthlyBudget:200,member:true}),true);
 assert.equal(Setup.needsSetup({setupVersion:0}),true);
 assert.equal(Setup.needsSetup({setupVersion:1}),false);
 assert.equal(Setup.needsSetup({setupVersion:2}),false);
});
test('opening setup pre-fills the existing preferences without changing them',()=>{
 const original={settings:{monthlyBudget:150,member:true,zip:'95051',storeName:'Santa Clara',storeUrl:'https://www.harborfreight.com/storelocator/',planMode:'wishlist'},inventory:[{id:'owned'}]};
 const before=JSON.stringify(original),draft=Setup.draftFromPreferences(original);
 assert.deepEqual(draft,{monthlyBudget:'150',member:true,zip:'95051',storeName:'Santa Clara',planMode:'wishlist'});
 assert.equal(JSON.stringify(original),before);
 assert.deepEqual(Setup.draftFromPreferences({}),{monthlyBudget:'',member:false,zip:'',storeName:'',planMode:'collection'});
});
test('budget and ZIP are optional, while a zero budget is preserved',()=>{
 const empty=Setup.validateDraft({monthlyBudget:'',zip:''});
 assert.equal(empty.valid,true);assert.equal(empty.settings.monthlyBudget,null);assert.equal(empty.settings.zip,'');
 const zero=Setup.validateDraft({monthlyBudget:'0',zip:'01234'});
 assert.equal(zero.valid,true);assert.equal(zero.settings.monthlyBudget,0);assert.equal(zero.settings.zip,'01234');
 assert.equal(Setup.validateDraft({monthlyBudget:' 125.50 ',zip:' 95051 '}).settings.monthlyBudget,125.5);
});
test('invalid budgets and malformed ZIP codes block saving',()=>{
 for(const value of ['-1','Infinity','NaN','not a number']){
  const result=Setup.validateDraft({monthlyBudget:value,zip:''});
  assert.equal(result.valid,false,value);assert.ok(result.errors.monthlyBudget,value);
 }
 for(const zip of ['1234','123456','9505a','12345-6789'])assert.ok(Setup.validateDraft({zip}).errors.zip,zip);
 assert.equal(Setup.settingsAfterSetup({}, {monthlyBudget:'-1'}),null);
});
test('finishing setup updates only its fields and preserves other preferences',()=>{
 const current={monthlyBudget:100,member:false,zip:'90001',storeName:'Old store',storeUrl:'https://www.harborfreight.com/storelocator/',notifications:true,alertDiscount:35,hideCovered:false,custom:'keep'};
 const next=Setup.settingsAfterSetup(current,{monthlyBudget:'175.99',member:true,zip:'95051',storeName:' New store ',planMode:'wishlist'});
 assert.equal(next.setupVersion,1);assert.equal(next.monthlyBudget,175.99);assert.equal(next.member,true);assert.equal(next.zip,'95051');assert.equal(next.storeName,'New store');assert.equal(next.planMode,'wishlist');
 for(const key of ['storeUrl','notifications','alertDiscount','hideCovered','custom'])assert.equal(next[key],current[key]);
 assert.equal(current.monthlyBudget,100);
});
test('skip and Escape semantics persist only the prompt marker, ignoring unsaved or invalid fields',()=>{
 const current={monthlyBudget:150,member:true,zip:'95051',storeName:'My store',planMode:'wishlist',notifications:false};
 const skipped=Setup.settingsAfterSetup(current,{monthlyBudget:'-20',member:false,zip:'invalid',storeName:'Changed',planMode:'collection'},{skip:true});
 assert.deepEqual(skipped,{...current,setupVersion:1});
 assert.equal(Setup.needsSetup(skipped),false);
});
test('setup changes do not replace inventory, purchases, saved products, or notes',()=>{
 const state={settings:{monthlyBudget:100},inventory:[{id:'tool'}],purchases:[{id:'purchase'}],saved:['12345'],notes:{'12345':'My note'},rules:[{family:'sockets'}]};
 const references={...state};
 state.settings=Setup.settingsAfterSetup(state.settings,{monthlyBudget:'200',planMode:'collection'});
 for(const key of ['inventory','purchases','saved','notes','rules'])assert.strictEqual(state[key],references[key]);
});
test('store names are bounded, whitespace trimmed, and unknown modes use collection',()=>{
 const result=Setup.validateDraft({storeName:'  '+'x'.repeat(140)+'  ',planMode:'unknown'});
 assert.equal(result.valid,true);assert.equal(result.settings.storeName.length,120);assert.equal(result.settings.planMode,'collection');
});
