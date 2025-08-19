import * as vscode from 'vscode';

export interface ExtensionConfig {
    exclude: Record<string, boolean>;
    include: string[];
    maxResults: number;
    showHiddenFiles: boolean;
    useGitignore: boolean;
    caseInsensitive: boolean;
}

export const DEFAULT_EXCLUDE_PATTERNS: Record<string, boolean> = {
    '**/node_modules': true,
    '**/.git': true,
    '**/dist': true,
    '**/build': true,
    '**/out': true,
    '**/.vscode': true,
    '**/coverage': true,
    '**/*.log': true,
    '**/.DS_Store': true,
    '**/Thumbs.db': true,
    '**/.idea': true,
    '**/.vs': true,
    '**/__pycache__': true,
    '**/*.pyc': true,
    '**/tmp': true,
    '**/temp': true
};

export const DEFAULT_CONFIG: ExtensionConfig = {
    exclude: DEFAULT_EXCLUDE_PATTERNS,
    include: ['**/*'],
    maxResults: 50,
    showHiddenFiles: false,
    useGitignore: true,
    caseInsensitive: true
};

export function getConfiguration(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('markdownPathCompletion');
    
    return {
        exclude: config.get('exclude', DEFAULT_CONFIG.exclude),
        include: config.get('include', DEFAULT_CONFIG.include),
        maxResults: config.get('maxResults', DEFAULT_CONFIG.maxResults),
        showHiddenFiles: config.get('showHiddenFiles', DEFAULT_CONFIG.showHiddenFiles),
        useGitignore: config.get('useGitignore', DEFAULT_CONFIG.useGitignore),
        caseInsensitive: config.get('caseInsensitive', DEFAULT_CONFIG.caseInsensitive)
    };
}

export function createGlobPattern(include: string[]): string {
    const includePattern = include.length === 1 ? include[0] : `{${include.join(',')}}`;
    return includePattern;
}

export function getExcludePatterns(exclude: Record<string, boolean>): string[] {
    return Object.entries(exclude)
        .filter(([, enabled]) => enabled)
        .map(([pattern]) => pattern);
}