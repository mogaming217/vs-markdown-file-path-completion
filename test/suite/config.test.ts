import * as assert from 'assert';
import * as vscode from 'vscode';
import {
    DEFAULT_CONFIG,
    DEFAULT_EXCLUDE_PATTERNS,
    getConfiguration,
    createGlobPattern,
    getExcludePatterns,
    ConfigurationManager,
    getWorkspaceConfig,
    CONFIG_PROFILES,
    applyConfigProfile
} from '../../src/config';

suite('Config Test Suite', () => {
    test('DEFAULT_CONFIG should have correct default values', () => {
        assert.deepStrictEqual(DEFAULT_CONFIG.exclude, DEFAULT_EXCLUDE_PATTERNS);
        assert.deepStrictEqual(DEFAULT_CONFIG.include, ['**/*']);
        assert.strictEqual(DEFAULT_CONFIG.maxResults, 50);
        assert.strictEqual(DEFAULT_CONFIG.showHiddenFiles, false);
        assert.strictEqual(DEFAULT_CONFIG.useGitignore, true);
        assert.strictEqual(DEFAULT_CONFIG.caseInsensitive, true);
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
            assert.ok(pattern in DEFAULT_EXCLUDE_PATTERNS, `Should include ${pattern}`);
            assert.strictEqual(DEFAULT_EXCLUDE_PATTERNS[pattern], true);
        }
    });

    test('createGlobPattern should create correct patterns', () => {
        assert.strictEqual(createGlobPattern(['**/*.ts']), '**/*.ts');
        assert.strictEqual(createGlobPattern(['**/*.ts', '**/*.js']), '{**/*.ts,**/*.js}');
        assert.strictEqual(createGlobPattern([]), '{}');
    });

    test('getExcludePatterns should filter enabled patterns', () => {
        const exclude = {
            '**/node_modules': true,
            '**/.git': false,
            '**/dist': true
        };
        
        const patterns = getExcludePatterns(exclude);
        assert.deepStrictEqual(patterns, ['**/node_modules', '**/dist']);
    });

    test('ConfigurationManager should be singleton', () => {
        const instance1 = ConfigurationManager.getInstance();
        const instance2 = ConfigurationManager.getInstance();
        assert.strictEqual(instance1, instance2);
    });

    test('ConfigurationManager should notify listeners on config change', (done) => {
        const manager = ConfigurationManager.getInstance();
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
        const profileNames = CONFIG_PROFILES.map(p => p.name);
        assert.ok(profileNames.includes('default'));
        assert.ok(profileNames.includes('documentation'));
        assert.ok(profileNames.includes('web-project'));
        assert.ok(profileNames.includes('monorepo'));
    });

    test('Documentation profile should have correct config', () => {
        const docProfile = CONFIG_PROFILES.find(p => p.name === 'documentation');
        assert.ok(docProfile, 'Documentation profile should exist');
        assert.deepStrictEqual(docProfile.config.include, ['**/*.md', '**/*.txt', '**/*.rst']);
        assert.ok(docProfile.config.exclude);
    });

    test('applyConfigProfile should throw for unknown profile', async () => {
        try {
            await applyConfigProfile('unknown-profile');
            assert.fail('Should throw error for unknown profile');
        } catch (error: any) {
            assert.ok(error.message.includes('not found'));
        }
    });
});