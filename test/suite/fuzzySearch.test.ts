import * as assert from 'assert';
import { FuzzySearcher } from '../../src/fuzzySearch';

suite('FuzzySearcher Test Suite', () => {
    let searcher: FuzzySearcher;

    setup(() => {
        searcher = new FuzzySearcher({ caseInsensitive: true });
    });

    test('Should match files with symbols removed (normalized search)', () => {
        const testFiles = [
            'lib/model/recipe_menu.codegen.dart',
            'src/components/user-profile-settings.ts',
            'src/ProductList_Component.jsx',
            'lib/utils/data_processing_utils.py',
            'lib/firestore_service.dart'
        ];

        // Test case 1: recipe_menu.codegen.dart with "recipemenu"
        const results1 = searcher.search('recipemenu', testFiles, 5);
        assert.ok(results1.length > 0, 'Should find results for "recipemenu"');
        assert.strictEqual(results1[0].path, 'lib/model/recipe_menu.codegen.dart', 
            'Should find recipe_menu.codegen.dart as top result');

        // Test case 2: user-profile-settings.ts with "userprofile"
        const results2 = searcher.search('userprofile', testFiles, 5);
        assert.ok(results2.length > 0, 'Should find results for "userprofile"');
        const topResults2 = results2.map(r => r.path);
        assert.ok(topResults2.includes('src/components/user-profile-settings.ts'), 
            'Should find user-profile-settings.ts in results');

        // Test case 3: ProductList_Component.jsx with "productlist"
        const results3 = searcher.search('productlist', testFiles, 5);
        assert.ok(results3.length > 0, 'Should find results for "productlist"');
        assert.strictEqual(results3[0].path, 'src/ProductList_Component.jsx', 
            'Should find ProductList_Component.jsx as top result');

        // Test case 4: data_processing_utils.py with "dataprocessing"
        const results4 = searcher.search('dataprocessing', testFiles, 5);
        assert.ok(results4.length > 0, 'Should find results for "dataprocessing"');
        assert.strictEqual(results4[0].path, 'lib/utils/data_processing_utils.py', 
            'Should find data_processing_utils.py as top result');
    });

    test('Should handle case insensitive search', () => {
        const testFiles = [
            'src/UserProfile.ts',
            'src/userprofile.ts',
            'src/USERPROFILE.ts'
        ];

        const results = searcher.search('userprofile', testFiles, 10);
        assert.strictEqual(results.length, 3, 'Should find all variations');
    });

    test('Should score exact matches higher than partial matches', () => {
        const testFiles = [
            'src/profile.ts',
            'src/userprofile.ts',
            'src/user_profile_extended.ts'
        ];

        const results = searcher.search('userprofile', testFiles, 10);
        assert.ok(results.length >= 2, 'Should find at least 2 results');
        assert.strictEqual(results[0].path, 'src/userprofile.ts', 
            'Exact match should score highest');
    });

    test('Should handle empty query', () => {
        const testFiles = [
            'src/file1.ts',
            'src/file2.ts'
        ];

        const results = searcher.search('', testFiles, 2);
        assert.strictEqual(results.length, 2, 'Should return all files up to limit');
        assert.strictEqual(results[0].score, 0, 'Empty query should have 0 score');
    });

    test('Should respect maxResults limit', () => {
        const testFiles = Array.from({ length: 100 }, (_, i) => `src/file${i}.ts`);

        const results = searcher.search('file', testFiles, 10);
        assert.strictEqual(results.length, 10, 'Should limit results to maxResults');
    });

    test('Should handle fuzzy matching with character gaps', () => {
        const testFiles = [
            'src/components/RecipeMenuComponent.tsx',
            'src/recipe_menu.ts',
            'lib/recipe/menu.dart'
        ];

        const results = searcher.search('rcpmnu', testFiles, 10);
        assert.ok(results.length > 0, 'Should find results with fuzzy matching');
        
        // At least one of the recipe menu files should be found
        const paths = results.map(r => r.path);
        const foundRecipeMenu = paths.some(p => 
            p.includes('RecipeMenuComponent') || 
            p.includes('recipe_menu') || 
            p.includes('recipe/menu')
        );
        assert.ok(foundRecipeMenu, 'Should find recipe menu files with fuzzy query');
    });

    test('Should prioritize filename matches over path matches', () => {
        const testFiles = [
            'some/deep/path/recipe.ts',
            'recipe/other.ts',
            'src/recipe.ts'
        ];

        const results = searcher.search('recipe', testFiles, 10);
        assert.ok(results.length >= 2, 'Should find multiple results');
        
        // Files with 'recipe' in the filename should score higher
        const filenameMatches = results.filter(r => r.path.endsWith('recipe.ts'));
        assert.ok(filenameMatches.length > 0, 'Should find files with recipe in filename');
        assert.ok(results[0].path.endsWith('recipe.ts'), 
            'Filename match should be ranked highest');
    });
});