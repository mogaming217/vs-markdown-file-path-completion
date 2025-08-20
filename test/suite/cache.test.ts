import * as assert from 'assert';
import { LRUCache, FileCache, FileCacheEntry } from '../../src/cache';

suite('Cache Test Suite', () => {
    suite('LRUCache', () => {
        test('should store and retrieve values', () => {
            const cache = new LRUCache<string, string>(3);
            
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            
            assert.strictEqual(cache.get('key1'), 'value1');
            assert.strictEqual(cache.get('key2'), 'value2');
            assert.strictEqual(cache.get('key3'), undefined);
        });

        test('should evict least recently used items when full', () => {
            const cache = new LRUCache<string, string>(3);
            
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');
            cache.set('key4', 'value4'); // Should evict key1
            
            assert.strictEqual(cache.get('key1'), undefined);
            assert.strictEqual(cache.get('key2'), 'value2');
            assert.strictEqual(cache.get('key3'), 'value3');
            assert.strictEqual(cache.get('key4'), 'value4');
        });

        test('should update LRU order on get', () => {
            const cache = new LRUCache<string, string>(3);
            
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');
            
            // Access key1 to make it most recently used
            cache.get('key1');
            
            cache.set('key4', 'value4'); // Should evict key2, not key1
            
            assert.strictEqual(cache.get('key1'), 'value1');
            assert.strictEqual(cache.get('key2'), undefined);
            assert.strictEqual(cache.get('key3'), 'value3');
            assert.strictEqual(cache.get('key4'), 'value4');
        });

        test('should update value for existing key', () => {
            const cache = new LRUCache<string, string>(3);
            
            cache.set('key1', 'value1');
            cache.set('key1', 'updatedValue1');
            
            assert.strictEqual(cache.get('key1'), 'updatedValue1');
            assert.strictEqual(cache.size, 1);
        });

        test('should clear cache', () => {
            const cache = new LRUCache<string, string>(3);
            
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            
            cache.clear();
            
            assert.strictEqual(cache.size, 0);
            assert.strictEqual(cache.get('key1'), undefined);
            assert.strictEqual(cache.get('key2'), undefined);
        });

        test('should check if key exists', () => {
            const cache = new LRUCache<string, string>(3);
            
            cache.set('key1', 'value1');
            
            assert.strictEqual(cache.has('key1'), true);
            assert.strictEqual(cache.has('key2'), false);
        });
    });

    suite('FileCache', () => {
        test('should cache and retrieve files', () => {
            const cache = new FileCache(5, 60000);
            const files = ['file1.ts', 'file2.ts', 'file3.ts'];
            
            cache.setCachedFiles('/workspace', files);
            
            const cachedFiles = cache.getCachedFiles('/workspace');
            assert.deepStrictEqual(cachedFiles, files);
        });

        test('should return undefined for non-cached workspace', () => {
            const cache = new FileCache(5, 60000);
            
            const cachedFiles = cache.getCachedFiles('/non-existent');
            assert.strictEqual(cachedFiles, undefined);
        });

        test('should invalidate cache after validity duration', (done) => {
            const cache = new FileCache(5, 100); // 100ms validity
            const files = ['file1.ts'];
            
            cache.setCachedFiles('/workspace', files);
            
            // Should be valid immediately
            assert.deepStrictEqual(cache.getCachedFiles('/workspace'), files);
            
            // Should be invalid after timeout
            setTimeout(() => {
                assert.strictEqual(cache.getCachedFiles('/workspace'), undefined);
                done();
            }, 150);
        });

        test('should invalidate specific workspace', () => {
            const cache = new FileCache(5, 60000);
            
            cache.setCachedFiles('/workspace1', ['file1.ts']);
            cache.setCachedFiles('/workspace2', ['file2.ts']);
            
            cache.invalidateWorkspace('/workspace1');
            
            assert.strictEqual(cache.getCachedFiles('/workspace1'), undefined);
            assert.deepStrictEqual(cache.getCachedFiles('/workspace2'), ['file2.ts']);
        });

        test('should clear all caches', () => {
            const cache = new FileCache(5, 60000);
            
            cache.setCachedFiles('/workspace1', ['file1.ts']);
            cache.setCachedFiles('/workspace2', ['file2.ts']);
            
            cache.clear();
            
            assert.strictEqual(cache.getCachedFiles('/workspace1'), undefined);
            assert.strictEqual(cache.getCachedFiles('/workspace2'), undefined);
        });

        test('should respect max size limit', () => {
            const cache = new FileCache(2, 60000); // Max 2 workspaces
            
            cache.setCachedFiles('/workspace1', ['file1.ts']);
            cache.setCachedFiles('/workspace2', ['file2.ts']);
            cache.setCachedFiles('/workspace3', ['file3.ts']); // Should evict workspace1
            
            assert.strictEqual(cache.getCachedFiles('/workspace1'), undefined);
            assert.deepStrictEqual(cache.getCachedFiles('/workspace2'), ['file2.ts']);
            assert.deepStrictEqual(cache.getCachedFiles('/workspace3'), ['file3.ts']);
        });
    });
});