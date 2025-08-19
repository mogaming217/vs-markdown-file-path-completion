import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getConfiguration, getExcludePatterns } from './config';
import { getRelativePath, shouldIncludeFile } from './utils';

export class FileScanner {
    private fileCache: string[] = [];
    private lastScanTime = 0;
    private cacheValidityDuration = 30000; // 30 seconds
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    constructor() {
        this.setupFileWatcher();
    }

    /**
     * Sets up file system watcher to invalidate cache on file changes
     */
    private setupFileWatcher(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }

        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        // Invalidate cache on file changes
        this.fileWatcher.onDidCreate(() => this.invalidateCache());
        this.fileWatcher.onDidDelete(() => this.invalidateCache());
    }

    /**
     * Invalidates the file cache
     */
    private invalidateCache(): void {
        this.fileCache = [];
        this.lastScanTime = 0;
    }

    /**
     * Checks if the cache is still valid
     */
    private isCacheValid(): boolean {
        return this.fileCache.length > 0 && 
               (Date.now() - this.lastScanTime) < this.cacheValidityDuration;
    }

    /**
     * Scans the workspace for all files, applying exclusion patterns
     */
    public async scanWorkspace(): Promise<string[]> {
        // Return cached results if still valid
        if (this.isCacheValid()) {
            return this.fileCache;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const config = getConfiguration();
        const excludePatterns = getExcludePatterns(config.exclude);
        const files: string[] = [];

        for (const workspaceFolder of workspaceFolders) {
            const workspaceFiles = await this.scanFolder(
                workspaceFolder.uri.fsPath,
                workspaceFolder.uri.fsPath,
                excludePatterns,
                config.showHiddenFiles,
                config.useGitignore
            );
            files.push(...workspaceFiles);
        }

        // Update cache
        this.fileCache = files;
        this.lastScanTime = Date.now();

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
        const config = getConfiguration();

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
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }
        this.invalidateCache();
    }
}