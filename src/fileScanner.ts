import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigurationManager, getExcludePatterns, getWorkspaceConfig } from './config';
import { getRelativePath, shouldIncludeFile } from './utils';
import { FileCache } from './cache';

export class FileScanner {
    private fileCache: FileCache;
    private configManager: ConfigurationManager;
    private configChangeListener: vscode.Disposable | undefined;
    private globalFileWatcher: vscode.FileSystemWatcher | undefined;

    constructor() {
        this.configManager = ConfigurationManager.getInstance();
        this.fileCache = new FileCache(10, 60000); // 10 workspaces max, 60 second validity
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
    }


    /**
     * Scans the workspace for all files, applying exclusion patterns
     */
    public async scanWorkspace(): Promise<string[]> {
        // Cached results are now handled per workspace in the loop below

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

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
                workspaceConfig.useGitignore
            );
            
            // Update cache for this workspace
            this.fileCache.setCachedFiles(workspacePath, workspaceFiles);
            
            files.push(...workspaceFiles);
        }

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
        useGitignore: boolean
    ): Promise<string[]> {
        const files: string[] = [];
        let gitignorePatterns: string[] = [];

        // Load .gitignore patterns if enabled
        if (useGitignore) {
            gitignorePatterns = await this.loadGitignorePatterns(folderPath);
        }

        try {
            const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(folderPath, entry.name);
                const relativePath = getRelativePath(fullPath, workspaceRoot);

                // Check if path should be excluded
                if (this.shouldExcludePath(relativePath, excludePatterns, gitignorePatterns)) {
                    continue;
                }

                // Check hidden files
                if (!shouldIncludeFile(relativePath, showHiddenFiles)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    // Recursively scan subdirectories
                    const subFiles = await this.scanFolder(
                        fullPath,
                        workspaceRoot,
                        excludePatterns,
                        showHiddenFiles,
                        useGitignore
                    );
                    files.push(...subFiles);
                } else if (entry.isFile()) {
                    files.push(relativePath);
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
    private async loadGitignorePatterns(folderPath: string): Promise<string[]> {
        const gitignorePath = path.join(folderPath, '.gitignore');
        
        try {
            const content = await fs.promises.readFile(gitignorePath, 'utf-8');
            return content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'))
                .map(pattern => {
                    // Convert gitignore patterns to glob patterns
                    if (pattern.endsWith('/')) {
                        return `**/${pattern}**`;
                    }
                    return `**/${pattern}`;
                });
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
        gitignorePatterns: string[]
    ): boolean {
        const allPatterns = [...excludePatterns, ...gitignorePatterns];
        
        for (const pattern of allPatterns) {
            if (this.matchesGlobPattern(relativePath, pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Simple glob pattern matching
     */
    private matchesGlobPattern(path: string, pattern: string): boolean {
        // Convert glob pattern to regex
        let regexPattern = pattern
            .replace(/\*\*/g, '___DOUBLESTAR___')
            .replace(/\*/g, '[^/]*')
            .replace(/___DOUBLESTAR___/g, '.*')
            .replace(/\?/g, '[^/]');

        // Ensure the pattern matches the full path
        if (!regexPattern.startsWith('.*')) {
            regexPattern = '^' + regexPattern;
        }
        if (!regexPattern.endsWith('.*')) {
            regexPattern = regexPattern + '$';
        }

        try {
            const regex = new RegExp(regexPattern);
            return regex.test(path);
        } catch {
            // If regex is invalid, fall back to simple string matching
            return path.includes(pattern.replace(/\*/g, ''));
        }
    }

    /**
     * Gets files that match a partial query
     */
    public async getMatchingFiles(query: string): Promise<string[]> {
        const allFiles = await this.scanWorkspace();
        const config = this.configManager.getConfig();

        if (!query) {
            return allFiles.slice(0, config.maxResults);
        }

        const searchQuery = config.caseInsensitive ? query.toLowerCase() : query;
        
        return allFiles.filter(filePath => {
            const searchPath = config.caseInsensitive ? filePath.toLowerCase() : filePath;
            const fileName = path.basename(searchPath);
            
            // Match against filename or full path
            return fileName.includes(searchQuery) || searchPath.includes(searchQuery);
        });
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
    }
}