import test from 'node:test';
import assert from 'node:assert/strict';
import {orderSchema,priceOrder} from '../server/orders.js';
import {shippingFee} from '../shared/products.js';
const valid={customer:{name:'Client Test',phone:'0700000000',city:'Daloa',address:'Quartier Commerce'},items:[{id:'casque',quantity:2}],payment:'cash',requestId:'6a746bf7-65e2-450b-b563-48c13baef05c'};
test('Validates a local order and normalizes fields',()=>{assert.equal(orderSchema.parse(valid).customer.note,'');});
test('Rejects unsupported cities, payment methods and invalid quantities',()=>{for(const value of [{...valid,payment:'card'},{...valid,customer:{...valid.customer,city:'Abidjan'}},{...valid,items:[{id:'casque',quantity:-1}]},{...valid,customer:{...valid.customer,phone:'123'}},{...valid,total:1}])assert.equal(orderSchema.safeParse(value).success,false);});
test('Calculates prices server-side and shipping at threshold',()=>{assert.deepEqual(priceOrder(valid.items),{lines:[{id:'casque',name:'Casque sans fil Studio',quantity:2,unitPrice:12900}],subtotal:25800,delivery:1500,total:27300});assert.equal(shippingFee(50000),0);assert.equal(priceOrder([{id:'casque',quantity:3}]).total,40200);});
test('Rejects duplicate and unknown products',()=>{assert.throws(()=>priceOrder([{id:'bad',quantity:1}]));assert.throws(()=>priceOrder([{id:'casque',quantity:1},{id:'casque',quantity:1}]));});
