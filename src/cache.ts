import * as vscode from 'vscode';

/**
 * LRU (Least Recently Used) Cache implementation
 */
export class LRUCache<K, V> {
    private cache: Map<K, V> = new Map();
    private readonly maxSize: number;

    constructor(maxSize: number) {
        this.maxSize = maxSize;
    }

    /**
     * Get a value from the cache
     */
    get(key: K): V | undefined {
        if (!this.cache.has(key)) {
            return undefined;
        }

        // Move to end (most recently used)
        const value = this.cache.get(key);
        if (value === undefined) {
            return undefined;
        }
        this.cache.delete(key);
        this.cache.set(key, value);
        
        return value;
    }

    /**
     * Set a value in the cache
     */
    set(key: K, value: V): void {
        // Remove key if it exists (to update position)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Add to end (most recently used)
        this.cache.set(key, value);

        // Remove oldest if over capacity
        if (this.cache.size > this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    /**
     * Check if a key exists in the cache
     */
    has(key: K): boolean {
        return this.cache.has(key);
    }

    /**
     * Clear the cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get the current size of the cache
     */
    get size(): number {
        return this.cache.size;
    }
}

/**
 * File cache entry with metadata
 */
export interface FileCacheEntry {
    files: string[];
    version: number;
}

/**
 * Enhanced file cache with incremental updates
 */
export class FileCache {
    private cache: LRUCache<string, FileCacheEntry>;
    private fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
    private pendingUpdates: Map<string, Set<string>> = new Map();
    private updateDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private readonly debounceDelay = 500; // 500ms debounce for file changes

    constructor(maxSize = 10) {
        this.cache = new LRUCache(maxSize);
    }

    /**
     * Get cached files for a workspace
     */
    getCachedFiles(workspacePath: string): string[] | undefined {
        const entry = this.cache.get(workspacePath);
        return entry?.files;
    }

    /**
     * Set cached files for a workspace
     */
    setCachedFiles(workspacePath: string, files: string[]): void {
        const entry: FileCacheEntry = {
            files,
            version: Date.now()
        };

        this.cache.set(workspacePath, entry);
        this.setupWatcherForWorkspace(workspacePath);
    }

    /**
     * Setup file system watcher for incremental updates
     */
    private setupWatcherForWorkspace(workspacePath: string): void {
        // Remove existing watcher if any
        const existingWatcher = this.fileWatchers.get(workspacePath);
        if (existingWatcher) {
            existingWatcher.dispose();
        }

        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspacePath, '**/*')
        );

        // Handle file creation
        watcher.onDidCreate((uri) => {
            this.handleFileChange(workspacePath, uri.fsPath, 'create');
        });

        // Handle file deletion
        watcher.onDidDelete((uri) => {
            this.handleFileChange(workspacePath, uri.fsPath, 'delete');
        });

        // Handle file rename (treated as delete + create)
        watcher.onDidChange(() => {
            // For simple cache, we don't track content changes
            // Only structural changes (create/delete/rename)
        });

        this.fileWatchers.set(workspacePath, watcher);
    }

    /**
     * Handle incremental file changes
     */
    private handleFileChange(workspacePath: string, filePath: string, changeType: 'create' | 'delete'): void {
        // Get or create pending updates set
        if (!this.pendingUpdates.has(workspacePath)) {
            this.pendingUpdates.set(workspacePath, new Set());
        }

        const updates = this.pendingUpdates.get(workspacePath);
        if (!updates) {
            return;
        }
        
        // Add change to pending updates
        if (changeType === 'create') {
            updates.add(filePath);
        } else {
            updates.add(`-${filePath}`); // Prefix with - for deletions
        }

        // Debounce updates
        this.debounceUpdate(workspacePath);
    }

    /**
     * Debounce and apply incremental updates
     */
    private debounceUpdate(workspacePath: string): void {
        // Clear existing timer
        const existingTimer = this.updateDebounceTimers.get(workspacePath);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new timer
        const timer = setTimeout(() => {
            this.applyIncrementalUpdates(workspacePath);
            this.updateDebounceTimers.delete(workspacePath);
        }, this.debounceDelay);

        this.updateDebounceTimers.set(workspacePath, timer);
    }

    /**
     * Apply pending incremental updates to cache
     */
    private applyIncrementalUpdates(workspacePath: string): void {
        const entry = this.cache.get(workspacePath);
        const updates = this.pendingUpdates.get(workspacePath);

        if (!entry || !updates || updates.size === 0) {
            return;
        }

        // Create a new file list based on updates
        const fileSet = new Set(entry.files);

        for (const update of updates) {
            if (update.startsWith('-')) {
                // Deletion
                const filePath = update.substring(1);
                fileSet.delete(filePath);
            } else {
                // Addition
                fileSet.add(update);
            }
        }

        // Update cache entry
        entry.files = Array.from(fileSet);
        entry.version = Date.now();
        
        // Clear pending updates
        this.pendingUpdates.delete(workspacePath);
    }

    /**
     * Invalidate cache for a specific workspace
     */
    invalidateWorkspace(workspacePath: string): void {
        this.cache.clear();
        const watcher = this.fileWatchers.get(workspacePath);
        if (watcher) {
            watcher.dispose();
            this.fileWatchers.delete(workspacePath);
        }
        this.pendingUpdates.delete(workspacePath);
        
        const timer = this.updateDebounceTimers.get(workspacePath);
        if (timer) {
            clearTimeout(timer);
            this.updateDebounceTimers.delete(workspacePath);
        }
    }

    /**
     * Clear all caches
     */
    clear(): void {
        this.cache.clear();
        
        // Dispose all watchers
        for (const watcher of this.fileWatchers.values()) {
            watcher.dispose();
        }
        this.fileWatchers.clear();
        
        // Clear all pending updates
        this.pendingUpdates.clear();
        
        // Clear all timers
        for (const timer of this.updateDebounceTimers.values()) {
            clearTimeout(timer);
        }
        this.updateDebounceTimers.clear();
    }

    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.clear();
    }
}