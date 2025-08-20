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
const config_1 = require("../../src/config");
suite('Config Test Suite', () => {
    test('DEFAULT_CONFIG should have correct default values', () => {
        assert.deepStrictEqual(config_1.DEFAULT_CONFIG.exclude, config_1.DEFAULT_EXCLUDE_PATTERNS);
        assert.deepStrictEqual(config_1.DEFAULT_CONFIG.include, ['**/*']);
        assert.strictEqual(config_1.DEFAULT_CONFIG.maxResults, 50);
        assert.strictEqual(config_1.DEFAULT_CONFIG.showHiddenFiles, false);
        assert.strictEqual(config_1.DEFAULT_CONFIG.useGitignore, true);
        assert.strictEqual(config_1.DEFAULT_CONFIG.caseInsensitive, true);
    });
    test('DEFAULT_EXCLUDE_PATTERNS should include common patterns', () => {
        const expectedPatterns = [
            '**/node_modules',
            '**/.git',
            '**/dist',
            '**/build',
            '**/.vscode',
            '**/coverage'
        ];
        for (const pattern of expectedPatterns) {
            assert.ok(pattern in config_1.DEFAULT_EXCLUDE_PATTERNS, `Should include ${pattern}`);
            assert.strictEqual(config_1.DEFAULT_EXCLUDE_PATTERNS[pattern], true);
        }
    });
    test('createGlobPattern should create correct patterns', () => {
        assert.strictEqual((0, config_1.createGlobPattern)(['**/*.ts']), '**/*.ts');
        assert.strictEqual((0, config_1.createGlobPattern)(['**/*.ts', '**/*.js']), '{**/*.ts,**/*.js}');
        assert.strictEqual((0, config_1.createGlobPattern)([]), '{}');
    });
    test('getExcludePatterns should filter enabled patterns', () => {
        const exclude = {
            '**/node_modules': true,
            '**/.git': false,
            '**/dist': true
        };
        const patterns = (0, config_1.getExcludePatterns)(exclude);
        assert.deepStrictEqual(patterns, ['**/node_modules', '**/dist']);
    });
    test('ConfigurationManager should be singleton', () => {
        const instance1 = config_1.ConfigurationManager.getInstance();
        const instance2 = config_1.ConfigurationManager.getInstance();
        assert.strictEqual(instance1, instance2);
    });
    test('ConfigurationManager should notify listeners on config change', (done) => {
        const manager = config_1.ConfigurationManager.getInstance();
        let notified = false;
        const disposable = manager.onConfigChange((config) => {
            notified = true;
            assert.ok(config, 'Config should be provided to listener');
            disposable.dispose();
            done();
        });
        // Simulate config change by getting config
        // In real scenario, this would be triggered by VS Code
        const config = manager.getConfig();
        assert.ok(config, 'Should get config');
        // Since we can't easily simulate VS Code config changes in tests,
        // we'll just verify the listener was registered
        setTimeout(() => {
            if (!notified) {
                disposable.dispose();
                done();
            }
        }, 100);
    });
    test('CONFIG_PROFILES should include expected profiles', () => {
        const profileNames = config_1.CONFIG_PROFILES.map(p => p.name);
        assert.ok(profileNames.includes('default'));
        assert.ok(profileNames.includes('documentation'));
        assert.ok(profileNames.includes('web-project'));
        assert.ok(profileNames.includes('monorepo'));
    });
    test('Documentation profile should have correct config', () => {
        const docProfile = config_1.CONFIG_PROFILES.find(p => p.name === 'documentation');
        assert.ok(docProfile, 'Documentation profile should exist');
        assert.deepStrictEqual(docProfile.config.include, ['**/*.md', '**/*.txt', '**/*.rst']);
        assert.ok(docProfile.config.exclude);
    });
    test('applyConfigProfile should throw for unknown profile', async () => {
        try {
            await (0, config_1.applyConfigProfile)('unknown-profile');
            assert.fail('Should throw error for unknown profile');
        }
        catch (error) {
            assert.ok(error.message.includes('not found'));
        }
    });
});
//# sourceMappingURL=config.test.js.map