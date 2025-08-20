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

/**
 * Configuration change handler
 */
export class ConfigurationManager {
    private static instance: ConfigurationManager;
    private config: ExtensionConfig;
    private listeners: ((config: ExtensionConfig) => void)[] = [];
    private disposables: vscode.Disposable[] = [];

    private constructor() {
        this.config = getConfiguration();
        this.setupConfigurationWatcher();
    }

    static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    private setupConfigurationWatcher(): void {
        const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('markdownPathCompletion')) {
                this.config = getConfiguration();
                this.notifyListeners();
            }
        });
        this.disposables.push(configWatcher);
    }

    /**
     * Get current configuration
     */
    getConfig(): ExtensionConfig {
        return this.config;
    }

    /**
     * Subscribe to configuration changes
     */
    onConfigChange(listener: (config: ExtensionConfig) => void): vscode.Disposable {
        this.listeners.push(listener);
        
        return new vscode.Disposable(() => {
            const index = this.listeners.indexOf(listener);
            if (index >= 0) {
                this.listeners.splice(index, 1);
            }
        });
    }

    private notifyListeners(): void {
        for (const listener of this.listeners) {
            listener(this.config);
        }
    }

    dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.listeners = [];
    }
}

/**
 * Workspace-specific configuration support
 */
export function getWorkspaceConfig(workspaceFolder: vscode.WorkspaceFolder): ExtensionConfig {
    const workspaceConfig = vscode.workspace.getConfiguration('markdownPathCompletion', workspaceFolder.uri);
    
    // Merge workspace-specific config with global config
    const globalConfig = getConfiguration();
    
    return {
        exclude: workspaceConfig.get('exclude', globalConfig.exclude),
        include: workspaceConfig.get('include', globalConfig.include),
        maxResults: workspaceConfig.get('maxResults', globalConfig.maxResults),
        showHiddenFiles: workspaceConfig.get('showHiddenFiles', globalConfig.showHiddenFiles),
        useGitignore: workspaceConfig.get('useGitignore', globalConfig.useGitignore),
        caseInsensitive: workspaceConfig.get('caseInsensitive', globalConfig.caseInsensitive)
    };
}

/**
 * Configuration profiles for different project types
 */
export interface ConfigProfile {
    name: string;
    config: Partial<ExtensionConfig>;
}

export const CONFIG_PROFILES: ConfigProfile[] = [
    {
        name: 'default',
        config: {}
    },
    {
        name: 'documentation',
        config: {
            include: ['**/*.md', '**/*.txt', '**/*.rst'],
            exclude: {
                ...DEFAULT_EXCLUDE_PATTERNS,
                '**/api-docs': true,
                '**/generated': true
            }
        }
    },
    {
        name: 'web-project',
        config: {
            exclude: {
                ...DEFAULT_EXCLUDE_PATTERNS,
                '**/.cache': true,
                '**/.next': true,
                '**/.nuxt': true,
                '**/public': true,
                '**/static': true
            }
        }
    },
    {
        name: 'monorepo',
        config: {
            exclude: {
                ...DEFAULT_EXCLUDE_PATTERNS,
                '**/packages/*/node_modules': true,
                '**/lerna-debug.log': true,
                '**/.yarn': true
            }
        }
    }
];

/**
 * Apply a configuration profile
 */
export async function applyConfigProfile(profileName: string): Promise<void> {
    const profile = CONFIG_PROFILES.find(p => p.name === profileName);
    if (!profile) {
        throw new Error(`Profile '${profileName}' not found`);
    }
    
    const config = vscode.workspace.getConfiguration('markdownPathCompletion');
    
    for (const [key, value] of Object.entries(profile.config)) {
        await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    }
}