import * as assert from 'assert';
import * as vscode from 'vscode';
import {
    normalizePath,
    getRelativePath,
    calculateScore,
    filterAndSortFiles,
    shouldIncludeFile,
    extractQueryFromLine,
    createCompletionItem,
    FileMatch
} from '../../src/utils';

suite('Utils Test Suite', () => {
    test('normalizePath should normalize file paths', () => {
        assert.strictEqual(normalizePath('path\\to\\file.txt'), 'path/to/file.txt');
        assert.strictEqual(normalizePath('./path/to/file.txt'), 'path/to/file.txt');
        assert.strictEqual(normalizePath('path/to/file.txt'), 'path/to/file.txt');
    });

    test('getRelativePath should return relative path from workspace root', () => {
        const workspaceRoot = '/Users/test/project';
        const filePath = '/Users/test/project/src/file.ts';
        assert.strictEqual(getRelativePath(filePath, workspaceRoot), 'src/file.ts');
    });

    test('calculateScore should return appropriate scores for different matches', () => {
        // Exact filename match
        assert.strictEqual(calculateScore('test.md', 'test.md'), 200);
        
        // Fuzzy matching tests
        const scoreExact = calculateScore('src/utils/helpers.ts', 'helpers');
        const scorePartial = calculateScore('src/utils/helpers.ts', 'help');
        const scoreWeak = calculateScore('src/utils/helpers.ts', 'xyz');
        
        assert.ok(scoreExact > scorePartial, 'Exact match should score higher than partial');
        assert.ok(scorePartial > scoreWeak, 'Partial match should score higher than weak match');
        
        // Case insensitive matching
        const scoreCaseInsensitive = calculateScore('TestFile.md', 'testfile', true);
        assert.ok(scoreCaseInsensitive > 10, 'Case insensitive match should have reasonable score');
    });

    test('fuzzy matching should work for common patterns', () => {
        // Test camelCase matching
        const camelCaseScore = calculateScore('getUserInfo.ts', 'gui');
        assert.ok(camelCaseScore > 50, 'Should match camelCase boundaries');
        
        // Test snake_case matching
        const snakeCaseScore = calculateScore('get_user_info.py', 'gui');
        assert.ok(snakeCaseScore > 50, 'Should match snake_case boundaries');
        
        // Test consecutive character matching
        const consecutiveScore = calculateScore('helpers.ts', 'help');
        assert.ok(consecutiveScore > 80, 'Consecutive characters should score high');
    });

    test('filterAndSortFiles should filter and sort files correctly', () => {
        const files = [
            'src/utils/helpers.ts',
            'src/components/Button.tsx',
            'test/helpers.test.ts',
            'README.md',
            'package.json'
        ];
        
        // Test with query
        const results = filterAndSortFiles(files, 'help', 10);
        assert.ok(results.length > 0, 'Should find matches for "help"');
        assert.ok(results[0].relativePath.includes('help'), 'First result should contain "help"');
        
        // Test empty query
        const allResults = filterAndSortFiles(files, '', 10);
        assert.strictEqual(allResults.length, files.length, 'Empty query should return all files');
        
        // Test max results
        const limitedResults = filterAndSortFiles(files, '', 2);
        assert.strictEqual(limitedResults.length, 2, 'Should respect maxResults limit');
    });

    test('shouldIncludeFile should respect hidden file settings', () => {
        // Hidden files
        assert.strictEqual(shouldIncludeFile('.hidden/file.txt', false), false);
        assert.strictEqual(shouldIncludeFile('.hidden/file.txt', true), true);
        assert.strictEqual(shouldIncludeFile('normal/.hidden/file.txt', false), false);
        
        // Normal files
        assert.strictEqual(shouldIncludeFile('normal/file.txt', false), true);
        assert.strictEqual(shouldIncludeFile('normal/file.txt', true), true);
    });

    test('extractQueryFromLine should extract query after @ symbol', () => {
        // Valid queries
        assert.strictEqual(extractQueryFromLine('Check @src/file', 9), 'src');
        assert.strictEqual(extractQueryFromLine('File: @helpers.ts', 14), 'helpers');
        assert.strictEqual(extractQueryFromLine('@', 1), '');
        
        // Invalid queries
        assert.strictEqual(extractQueryFromLine('No at symbol', 5), null);
        assert.strictEqual(extractQueryFromLine('Email @ space', 8), null);
        assert.strictEqual(extractQueryFromLine('Before cursor @after', 10), null);
    });

    test('createCompletionItem should create proper completion items', () => {
        const fileMatch: FileMatch = {
            relativePath: 'src/utils/helpers.ts',
            fileName: 'helpers.ts',
            score: 100
        };
        
        const item = createCompletionItem(fileMatch);
        
        assert.strictEqual(item.label, 'src/utils/helpers.ts');
        assert.strictEqual(item.kind, vscode.CompletionItemKind.File);
        assert.ok(item.detail?.includes('helpers.ts'));
        assert.ok(item.documentation);
        assert.strictEqual(item.sortText, '0900'); // 1000 - 100 = 900, padded
    });

    test('Levenshtein distance calculation should work correctly', () => {
        // Test by checking score differences
        const exactScore = calculateScore('test.md', 'test');
        const oneCharOffScore = calculateScore('test.md', 'tast');
        const twoCharOffScore = calculateScore('test.md', 'taxt');
        
        assert.ok(exactScore > oneCharOffScore, 'Exact match should score higher than one char off');
        assert.ok(oneCharOffScore > twoCharOffScore, 'One char off should score higher than two chars off');
    });
});