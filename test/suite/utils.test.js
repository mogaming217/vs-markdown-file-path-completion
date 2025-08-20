"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const utils_1 = require("../../src/utils");
suite('Utils Test Suite', () => {
    test('normalizePath should normalize file paths', () => {
        assert.strictEqual((0, utils_1.normalizePath)('path\\to\\file.txt'), 'path/to/file.txt');
        assert.strictEqual((0, utils_1.normalizePath)('./path/to/file.txt'), 'path/to/file.txt');
        assert.strictEqual((0, utils_1.normalizePath)('path/to/file.txt'), 'path/to/file.txt');
    });
    test('getRelativePath should return relative path from workspace root', () => {
        const workspaceRoot = '/Users/test/project';
        const filePath = '/Users/test/project/src/file.ts';
        assert.strictEqual((0, utils_1.getRelativePath)(filePath, workspaceRoot), 'src/file.ts');
    });
    test('calculateScore should return appropriate scores for different matches', () => {
        // Exact filename match
        assert.strictEqual((0, utils_1.calculateScore)('test.md', 'test.md'), 200);
        // Fuzzy matching tests
        const scoreExact = (0, utils_1.calculateScore)('src/utils/helpers.ts', 'helpers');
        const scorePartial = (0, utils_1.calculateScore)('src/utils/helpers.ts', 'help');
        const scoreWeak = (0, utils_1.calculateScore)('src/utils/helpers.ts', 'xyz');
        assert.ok(scoreExact > scorePartial, 'Exact match should score higher than partial');
        assert.ok(scorePartial > scoreWeak, 'Partial match should score higher than weak match');
        // Case insensitive matching
        const scoreCaseInsensitive = (0, utils_1.calculateScore)('TestFile.md', 'testfile', true);
        assert.ok(scoreCaseInsensitive > 10, 'Case insensitive match should have reasonable score');
    });
    test('fuzzy matching should work for common patterns', () => {
        // Test camelCase matching
        const camelCaseScore = (0, utils_1.calculateScore)('getUserInfo.ts', 'gui');
        assert.ok(camelCaseScore > 50, 'Should match camelCase boundaries');
        // Test snake_case matching
        const snakeCaseScore = (0, utils_1.calculateScore)('get_user_info.py', 'gui');
        assert.ok(snakeCaseScore > 50, 'Should match snake_case boundaries');
        // Test consecutive character matching
        const consecutiveScore = (0, utils_1.calculateScore)('helpers.ts', 'help');
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
        const results = (0, utils_1.filterAndSortFiles)(files, 'help', 10);
        assert.ok(results.length > 0, 'Should find matches for "help"');
        assert.ok(results[0].relativePath.includes('help'), 'First result should contain "help"');
        // Test empty query
        const allResults = (0, utils_1.filterAndSortFiles)(files, '', 10);
        assert.strictEqual(allResults.length, files.length, 'Empty query should return all files');
        // Test max results
        const limitedResults = (0, utils_1.filterAndSortFiles)(files, '', 2);
        assert.strictEqual(limitedResults.length, 2, 'Should respect maxResults limit');
    });
    test('shouldIncludeFile should respect hidden file settings', () => {
        // Hidden files
        assert.strictEqual((0, utils_1.shouldIncludeFile)('.hidden/file.txt', false), false);
        assert.strictEqual((0, utils_1.shouldIncludeFile)('.hidden/file.txt', true), true);
        assert.strictEqual((0, utils_1.shouldIncludeFile)('normal/.hidden/file.txt', false), false);
        // Normal files
        assert.strictEqual((0, utils_1.shouldIncludeFile)('normal/file.txt', false), true);
        assert.strictEqual((0, utils_1.shouldIncludeFile)('normal/file.txt', true), true);
    });
    test('extractQueryFromLine should extract query after @ symbol', () => {
        // Valid queries
        assert.strictEqual((0, utils_1.extractQueryFromLine)('Check @src/file', 9), 'src');
        assert.strictEqual((0, utils_1.extractQueryFromLine)('File: @helpers.ts', 14), 'helpers');
        assert.strictEqual((0, utils_1.extractQueryFromLine)('@', 1), '');
        // Invalid queries
        assert.strictEqual((0, utils_1.extractQueryFromLine)('No at symbol', 5), null);
        assert.strictEqual((0, utils_1.extractQueryFromLine)('Email @ space', 8), null);
        assert.strictEqual((0, utils_1.extractQueryFromLine)('Before cursor @after', 10), null);
    });
    test('createCompletionItem should create proper completion items', () => {
        const fileMatch = {
            relativePath: 'src/utils/helpers.ts',
            fileName: 'helpers.ts',
            score: 100
        };
        const item = (0, utils_1.createCompletionItem)(fileMatch);
        assert.strictEqual(item.label, 'src/utils/helpers.ts');
        assert.strictEqual(item.kind, vscode.CompletionItemKind.File);
        assert.ok(item.detail?.includes('helpers.ts'));
        assert.ok(item.documentation);
        assert.strictEqual(item.sortText, '0900'); // 1000 - 100 = 900, padded
    });
    test('Levenshtein distance calculation should work correctly', () => {
        // Test by checking score differences
        const exactScore = (0, utils_1.calculateScore)('test.md', 'test');
        const oneCharOffScore = (0, utils_1.calculateScore)('test.md', 'tast');
        const twoCharOffScore = (0, utils_1.calculateScore)('test.md', 'taxt');
        assert.ok(exactScore > oneCharOffScore, 'Exact match should score higher than one char off');
        assert.ok(oneCharOffScore > twoCharOffScore, 'One char off should score higher than two chars off');
    });
});
//# sourceMappingURL=utils.test.js.map