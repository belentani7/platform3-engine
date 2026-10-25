import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichLead, normalizeLead, redisConnection, QUEUE_NAME } from '../src/contract.ts';

test('normalizes a minimal lead without inventing enrichment', () => {
  assert.deepEqual(enrichLead({ sourceId: 'demo-1', name: '  Sabons   Alejandra  ' }), {
    sourceId: 'demo-1', name: 'Sabons Alejandra', status: 'normalized-offline',
  });
  assert.equal(QUEUE_NAME, 'platform3-enrichment');
});

test('normalizes optional city and HTTPS website', () => {
  assert.deepEqual(normalizeLead({ sourceId: 'item.2', name: ' Café ', city: '  São  Paulo ', website: 'https://example.org' }), {
    sourceId: 'item.2', name: 'Café', city: 'São Paulo', website: 'https://example.org/',
  });
});

test('rejects extra fields and malformed input rather than storing PII', () => {
  for (const value of [null, [], {}, {sourceId:'x',name:'ok',email:'a@example.com'}, {sourceId:'x',name:' '}, {sourceId:'../bad',name:'ok'}, {sourceId:'x',name:'ok',website:'http://example.com'}, {sourceId:'x',name:'ok',website:'https://u:p@example.com'}, {sourceId:'x',name:'ok',city:5}]) {
    assert.throws(() => normalizeLead(value));
  }
});

test('accepts only local Redis by default and never leaks credentials', () => {
  assert.deepEqual(redisConnection(undefined), {host:'127.0.0.1',port:6379});
  assert.deepEqual(redisConnection('redis://localhost:6380/0'), {host:'localhost',port:6380});
  assert.throws(() => redisConnection('https://localhost:6379'), /redis or rediss/);
  assert.throws(() => redisConnection('redis://redis.example.org:6379'), /Remote Redis/);
  assert.throws(() => redisConnection('redis://localhost:6379/5'), /Unsupported Redis/);
});
