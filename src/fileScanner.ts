import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigurationManager, getExcludePatterns, getWorkspaceConfig } from './config';
import { getRelativePath, shouldIncludeFile } from './utils';
import { FileCache } from './cache';
import { FuzzySearcher, FuzzyMatch } from './fuzzySearch';
import { HierarchicalSearchCache } from './searchCache';
import { AsyncBatchProcessor } from './asyncBatchProcessor';

interface GitignorePattern {
    pattern: string;
    baseDir: string;
}

export class FileScanner {
    private fileCache: FileCache;
    private configManager: ConfigurationManager;
    private configChangeListener: vscode.Disposable | undefined;
    private globalFileWatcher: vscode.FileSystemWatcher | undefined;
    private fuzzySearcher: FuzzySearcher;
    private searchCache: HierarchicalSearchCache;
    private batchProcessor: AsyncBatchProcessor;

    constructor() {
        this.configManager = ConfigurationManager.getInstance();
        this.fileCache = new FileCache(10); // 10 workspaces max
        this.fuzzySearcher = new FuzzySearcher({ caseInsensitive: true });
        this.searchCache = new HierarchicalSearchCache(100); // 100 queries max
        this.batchProcessor = new AsyncBatchProcessor({
            batchSize: 20,
            delayMs: 10,
            maxBatches: 50
        });
        this.setupGlobalFileWatcher();
        this.setupConfigListener();
    }

    /**
     * Sets up global file system watcher for major changes
     */
    private setupGlobalFileWatcher(): void {
        if (this.globalFileWatcher) {
            this.globalFileWatcher.dispose();
        }

        // Watch for major structural changes
        this.globalFileWatcher = vscode.workspace.createFileSystemWatcher('**/{.gitignore,package.json,tsconfig.json}');
        
        // Invalidate all caches on major changes
        this.globalFileWatcher.onDidCreate(() => this.invalidateCache());
        this.globalFileWatcher.onDidChange(() => this.invalidateCache());
        this.globalFileWatcher.onDidDelete(() => this.invalidateCache());
    }

    /**
     * Sets up configuration change listener
     */
    private setupConfigListener(): void {
        this.configChangeListener = this.configManager.onConfigChange(() => {
            // Invalidate cache when configuration changes
            this.invalidateCache();
        });
    }

    /**
     * Invalidates the file cache
     */
    private invalidateCache(): void {
        this.fileCache.clear();
        this.searchCache.clear();
    }


    /**
     * Scans the workspace for all files, applying exclusion patterns
     */
    public async scanWorkspace(): Promise<string[]> {
        // Cached results are now handled per workspace in the loop below
        console.log('FileScanner.scanWorkspace called');

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.log('No workspace folders found in scanWorkspace');
            console.log('vscode.workspace.workspaceFolders:', vscode.workspace.workspaceFolders);
            return [];
        }
        console.log('Found workspace folders:', workspaceFolders.map(f => f.uri.fsPath));

        const files: string[] = [];

        for (const workspaceFolder of workspaceFolders) {
            const workspacePath = workspaceFolder.uri.fsPath;
            
            // Check cache for this specific workspace
            const cachedFiles = this.fileCache.getCachedFiles(workspacePath);
            if (cachedFiles) {
                files.push(...cachedFiles);
                continue;
            }
            
            // Get workspace-specific config
            const workspaceConfig = getWorkspaceConfig(workspaceFolder);
            const workspaceExcludePatterns = getExcludePatterns(workspaceConfig.exclude);
            
            const workspaceFiles = await this.scanFolder(
                workspacePath,
                workspacePath,
                workspaceExcludePatterns,
                workspaceConfig.showHiddenFiles,
                workspaceConfig.useGitignore,
                [] // No parent gitignore patterns for root
            );
            
            // Update cache for this workspace
            this.fileCache.setCachedFiles(workspacePath, workspaceFiles);
            
            files.push(...workspaceFiles);
        }

        console.log('scanWorkspace returning', files.length, 'files');
        return files;
    }

    /**
     * Recursively scans a folder for files
     */
    private async scanFolder(
        folderPath: string,
        workspaceRoot: string,
        excludePatterns: string[],
        showHiddenFiles: boolean,
        useGitignore: boolean,
        parentGitignorePatterns: GitignorePattern[] = [],
        maxFiles = 10000
    ): Promise<string[]> {
        const files: string[] = [];
        let currentGitignorePatterns: GitignorePattern[] = [...parentGitignorePatterns];

        // Load .gitignore patterns from current directory if enabled
        if (useGitignore) {
            const localPatterns = await this.loadGitignorePatterns(folderPath, workspaceRoot);
            if (localPatterns.length > 0) {
                console.log(`Loaded ${localPatterns.length} gitignore patterns from ${folderPath}`);
                currentGitignorePatterns = [...currentGitignorePatterns, ...localPatterns];
            }
        }

        try {
            const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
            console.log(`Scanning folder: ${folderPath}, found ${entries.length} entries`);

            for (const entry of entries) {
                // Early exclusion for common large directories
                if (entry.isDirectory()) {
                    const dirName = entry.name.toLowerCase();
                    if (dirName === 'node_modules' || dirName === '.git' || dirName === 'dist' || 
                        dirName === 'build' || dirName === 'out' || dirName === 'coverage' ||
                        dirName === '.next' || dirName === '.nuxt' || dirName === 'vendor') {
                        console.log(`Skipping known large directory: ${entry.name}`);
                        continue;
                    }
                }
                
                const fullPath = path.join(folderPath, entry.name);
                const relativePath = getRelativePath(fullPath, workspaceRoot);

                // Check hidden files first (faster)
                if (!shouldIncludeFile(relativePath, showHiddenFiles)) {
                    console.log(`Excluding hidden file/dir: ${relativePath}`);
                    continue;
                }

                // Check if path should be excluded
                if (this.shouldExcludePath(relativePath, excludePatterns, currentGitignorePatterns, entry.isDirectory())) {
                    if (entry.isDirectory() && relativePath.includes('Pods')) {
                        console.log(`Excluding Pods directory: ${relativePath}/ (gitignore patterns: ${currentGitignorePatterns.map(p => p.pattern).join(', ')})`);
                    } else {
                        console.log(`Excluding path (pattern match): ${relativePath}${entry.isDirectory() ? '/' : ''}`);
                    }
                    continue;
                }

                if (entry.isDirectory()) {
                    // Check if we've already hit the file limit
                    if (files.length >= maxFiles) {
                        console.log(`Already at max file limit (${maxFiles}), skipping directory: ${entry.name}`);
                        continue;
                    }
                    
                    // Recursively scan subdirectories
                    const subFiles = await this.scanFolder(
                        fullPath,
                        workspaceRoot,
                        excludePatterns,
                        showHiddenFiles,
                        useGitignore,
                        currentGitignorePatterns,
                        maxFiles - files.length  // Pass remaining file count
                    );
                    files.push(...subFiles);
                } else if (entry.isFile()) {
                    files.push(relativePath);
                    
                    // Limit file count for performance
                    if (files.length >= maxFiles) {
                        console.log(`Reached max file limit (${maxFiles}), stopping scan`);
                        return files;
                    }
                }
            }
        } catch (error) {
            // Silently ignore permission errors and continue scanning
            console.warn(`Failed to scan folder ${folderPath}:`, error);
        }

        return files;
    }


    /**
     * Loads .gitignore patterns from a directory
     */
    private async loadGitignorePatterns(folderPath: string, workspaceRoot: string): Promise<GitignorePattern[]> {
        const gitignorePath = path.join(folderPath, '.gitignore');
        
        try {
            const content = await fs.promises.readFile(gitignorePath, 'utf-8');
            const relativeBasePath = path.relative(workspaceRoot, folderPath);
            const patterns = content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'))
                .map(pattern => {
                    pattern = pattern.trim();
                    
                    // Handle negation patterns (not supported yet, skip)
                    if (pattern.startsWith('!')) {
                        return null;
                    }
                    
                    const gitignorePattern: GitignorePattern = {
                        pattern: pattern,
                        baseDir: relativeBasePath || '.'
                    };
                    
                    return gitignorePattern;
                });
            
            // Filter nulls
            return patterns.filter((p): p is GitignorePattern => p !== null);
        } catch {
            return [];
        }
    }

    /**
     * Checks if a path should be excluded based on patterns
     */
    private shouldExcludePath(
        relativePath: string,
        excludePatterns: string[],
        gitignorePatterns: GitignorePattern[],
        isDirectory: boolean = false
    ): boolean {
        // Check standard exclude patterns
        for (const pattern of excludePatterns) {
            if (this.matchesGlobPattern(relativePath, pattern)) {
                return true;
            }
        }
        
        // Check gitignore patterns
        for (const gitignorePattern of gitignorePatterns) {
            if (this.matchesGitignorePattern(relativePath, gitignorePattern, isDirectory)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Matches a path against a gitignore pattern
     */
    private matchesGitignorePattern(relativePath: string, gitignorePattern: GitignorePattern, isDirectory: boolean): boolean {
        const { pattern, baseDir } = gitignorePattern;
        
        // Calculate path relative to gitignore location
        let pathToCheck = relativePath;
        if (baseDir !== '.') {
            // If path doesn't start with baseDir, it can't match
            if (!relativePath.startsWith(baseDir + '/')) {
                return false;
            }
            // Get path relative to gitignore location
            pathToCheck = relativePath.substring(baseDir.length + 1);
        }
        
        // Handle directory patterns
        if (pattern.endsWith('/')) {
            if (!isDirectory) return false;
            const dirPattern = pattern.slice(0, -1);
            
            // Special handling for **/dirname/ patterns
            if (dirPattern.startsWith('**/')) {
                const dirName = dirPattern.substring(3);
                // Check if the path ends with the directory name
                const parts = pathToCheck.split('/');
                return parts[parts.length - 1] === dirName;
            }
            
            return this.matchesGitignorePatternInternal(pathToCheck, dirPattern);
        }
        
        // Handle patterns starting with /
        if (pattern.startsWith('/')) {
            // Exact match from gitignore location
            const exactPattern = pattern.slice(1);
            return this.matchesGitignorePatternInternal(pathToCheck, exactPattern);
        }
        
        // Handle ** patterns
        if (pattern.includes('**/')) {
            return this.matchesGitignorePatternInternal(pathToCheck, pattern);
        }
        
        // Regular pattern - can match at any level
        if (pathToCheck === pattern || pathToCheck.endsWith('/' + pattern)) {
            return true;
        }
        
        // For directories, also check if the pattern matches a parent
        if (isDirectory && (pathToCheck + '/').includes(pattern + '/')) {
            return true;
        }
        
        return this.matchesGitignorePatternInternal(pathToCheck, pattern);
    }
    
    /**
     * Internal gitignore pattern matching
     */
    private matchesGitignorePatternInternal(path: string, pattern: string): boolean {
        // Convert gitignore pattern to regex
        let regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
            .replace(/\*\*/g, '___DOUBLESTAR___')
            .replace(/\*/g, '[^/]*')
            .replace(/___DOUBLESTAR___/g, '.*')
            .replace(/\?/g, '[^/]');
        
        // Handle exact matches
        if (!pattern.includes('*') && !pattern.includes('?')) {
            return path === pattern || path.startsWith(pattern + '/');
        }
        
        try {
            const regex = new RegExp('^' + regexPattern + '(/.*)?$');
            return regex.test(path);
        } catch {
            return false;
        }
    }

    /**
     * Simple glob pattern matching
     */
    private matchesGlobPattern(path: string, pattern: string): boolean {
        // Special handling for common patterns
        if (pattern === '**/node_modules' || pattern === '**/node_modules/**') {
            return path.includes('node_modules');
        }
        if (pattern === '**/.git' || pattern === '**/.git/**') {
            return path.includes('.git');
        }
        
        // Convert glob pattern to regex
        let regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except * and ?
            .replace(/\*\*/g, '___DOUBLESTAR___')
            .replace(/\*/g, '[^/]*')
            .replace(/___DOUBLESTAR___/g, '.*')
            .replace(/\?/g, '[^/]');

        // Handle exact matches
        if (!pattern.includes('*') && !pattern.includes('?')) {
            return path === pattern || path.startsWith(pattern + '/');
        }

        try {
            const regex = new RegExp('^' + regexPattern + '$');
            return regex.test(path);
        } catch {
            // If regex is invalid, fall back to simple string matching
            return path.includes(pattern.replace(/\*/g, ''));
        }
    }

    /**
     * Gets files that match a partial query using VSCode-like fuzzy search
     */
    public async getMatchingFiles(query: string, token?: vscode.CancellationToken): Promise<FuzzyMatch[]> {
        console.log('=== getMatchingFiles called ===');
        console.log('Query:', query);
        
        // Check hierarchical cache first
        const cachedResults = this.searchCache.getCachedResults(query);
        if (cachedResults) {
            console.log('Found cached results:', cachedResults.length);
            // Filter cached results for more specific query
            const filtered = this.searchCache.filterCachedResults(cachedResults, query);
            const searchResults = this.fuzzySearcher.search(query, filtered.map(m => m.path), this.configManager.getConfig().maxResults);
            console.log('Returning', searchResults.length, 'results from cache');
            return searchResults;
        }

        // Check for cancellation
        if (token?.isCancellationRequested) {
            console.log('Search cancelled by token');
            return [];
        }

        // Get all files from workspace
        console.log('Scanning workspace...');
        const allFiles = await this.scanWorkspace();
        console.log('Scan complete. Total files:', allFiles.length);
        
        if (allFiles.length === 0) {
            console.log('WARNING: No files found in workspace!');
            console.log('WorkspaceFolders:', vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath));
            return [];
        }
        
        // Log sample of files
        console.log('Sample files:', allFiles.slice(0, 10));
        
        // Log files containing "recipe"
        const recipeFiles = allFiles.filter(f => f.toLowerCase().includes('recipe'));
        console.log('Files containing "recipe":', recipeFiles.length);
        if (recipeFiles.length > 0) {
            console.log('Recipe files:', recipeFiles.slice(0, 5));
        }
        
        const config = this.configManager.getConfig();

        // Perform fuzzy search
        console.log('Performing fuzzy search with query:', query, 'on', allFiles.length, 'files');
        console.log('Max results:', config.maxResults);
        console.log('Case insensitive:', config.caseInsensitive);
        
        const matches = this.fuzzySearcher.search(query, allFiles, config.maxResults * 2);
        console.log('Fuzzy search returned', matches.length, 'matches');
        
        if (matches.length === 0) {
            console.log('No matches found for query:', query);
            // Try a simple substring search to debug
            const simpleMatches = allFiles.filter(f => f.toLowerCase().includes(query.toLowerCase()));
            console.log('Simple substring search found:', simpleMatches.length, 'files');
            if (simpleMatches.length > 0) {
                console.log('Simple matches:', simpleMatches.slice(0, 5));
            }
        }

        // Apply file type weights
        for (const match of matches) {
            match.score *= FuzzySearcher.getFileTypeWeight(match.path);
        }

        // Sort by score
        matches.sort((a, b) => b.score - a.score);

        // Cache the results
        this.searchCache.setCachedResults(query, matches);

        // Return limited results
        return matches.slice(0, config.maxResults);
    }

    /**
     * Gets files that match a partial query with async batch processing
     */
    public async *getMatchingFilesAsync(query: string, token: vscode.CancellationToken): AsyncGenerator<FuzzyMatch[], void, unknown> {
        const matches = await this.getMatchingFiles(query, token);
        
        // Process matches in prioritized batches
        for await (const batch of this.batchProcessor.processFuzzyMatchBatches(matches, token)) {
            yield batch;
        }
    }

    /**
     * Disposes the file scanner and cleans up resources
     */
    public dispose(): void {
        if (this.globalFileWatcher) {
            this.globalFileWatcher.dispose();
            this.globalFileWatcher = undefined;
        }
        if (this.configChangeListener) {
            this.configChangeListener.dispose();
            this.configChangeListener = undefined;
        }
        this.fileCache.dispose();
        this.searchCache.clear();
    }
}