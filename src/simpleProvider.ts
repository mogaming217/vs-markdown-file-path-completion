import * as vscode from 'vscode';
import { FileScannerVscode } from './fileScannerVscode';

export class SimpleCompletionProvider implements vscode.CompletionItemProvider {
    private fileCache: string[] | null = null;
    
    constructor(
        private outputChannel: vscode.OutputChannel,
        private fileScanner: FileScannerVscode
    ) {}
    
    public invalidateCache(): void {
        this.fileCache = null;
        this.outputChannel.appendLine('File cache invalidated');
    }
    
    public async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList | undefined> {
        this.outputChannel.appendLine('SimpleCompletionProvider.provideCompletionItems called');
        this.outputChannel.appendLine('Trigger kind: ' + context.triggerKind);
        this.outputChannel.appendLine('Trigger character: ' + context.triggerCharacter);
        console.log('SimpleCompletionProvider.provideCompletionItems called');
        console.log('Trigger kind:', context.triggerKind);
        console.log('Trigger character:', context.triggerCharacter);
        
        const line = document.lineAt(position.line).text;
        const prefix = line.substring(0, position.character);
        this.outputChannel.appendLine('Line text: "' + line + '"');
        this.outputChannel.appendLine('Position character: ' + position.character);
        this.outputChannel.appendLine('Line prefix: "' + prefix + '"');
        console.log('Line prefix:', prefix);
        
        // Find the most recent @ before cursor position that forms a valid completion context
        let atIndex = -1;
        let searchIndex = position.character - 1;
        
        // First, check if we're currently typing right after an @
        while (searchIndex >= 0) {
            const char = line.charAt(searchIndex);
            
            if (char === '@') {
                atIndex = searchIndex;
                break;
            }
            
            // If we hit a space, tab, or other delimiter, stop searching
            if (char === ' ' || char === '\t' || char === '\n' || char === ',' || char === ';') {
                break;
            }
            
            searchIndex--;
        }
        
        if (atIndex === -1) {
            this.outputChannel.appendLine('No @ found in current word context');
            return undefined;
        }
        
        // Get the text between @ and cursor
        const query = line.substring(atIndex + 1, position.character);
        
        // If query contains spaces or other breaking characters, it's not a valid completion context
        if (query.match(/[\s\t\n,;]/)) {
            this.outputChannel.appendLine('Invalid characters in query, not completing');
            return undefined;
        }
        
        this.outputChannel.appendLine('@ found at index ' + atIndex + ', query: "' + query + '"');
        
        // Get actual files from the workspace
        const items: vscode.CompletionItem[] = [];
        
        try {
            // Get file list from scanner with caching
            const startTime = Date.now();
            let allFiles: string[];
            
            // Use cache if available, otherwise scan workspace
            if (this.fileCache) {
                allFiles = this.fileCache;
                this.outputChannel.appendLine('Using cached file list (' + allFiles.length + ' files)');
            } else {
                allFiles = await this.fileScanner.scanWorkspace();
                this.fileCache = allFiles;
                const scanTime = Date.now() - startTime;
                this.outputChannel.appendLine('Found ' + allFiles.length + ' files in workspace (scan took ' + scanTime + 'ms)');
            }
            
            // Log summary info on first scan (when we just populated the cache)
            if (allFiles.length > 0 && this.fileCache === allFiles) {
                const dartFiles = allFiles.filter((f: string) => f.endsWith('.dart'));
                this.outputChannel.appendLine('File types: ' + dartFiles.length + ' .dart files out of ' + allFiles.length + ' total files');
                
                // Quick check for firestore files
                const firestoreFiles = allFiles.filter((f: string) => f.toLowerCase().includes('firestore'));
                if (firestoreFiles.length > 0) {
                    this.outputChannel.appendLine('Found ' + firestoreFiles.length + ' files containing "firestore"');
                }
            }
            
            // Filter files based on query
            let filteredFiles = allFiles;
            if (query.length > 0) {
                const queryLower = query.toLowerCase();
                filteredFiles = allFiles.filter((file: string) => {
                    const fileName = file.toLowerCase();
                    const lastSlash = fileName.lastIndexOf('/');
                    const baseName = lastSlash >= 0 ? fileName.substring(lastSlash + 1) : fileName;
                    
                    
                    return baseName.includes(queryLower) || fileName.includes(queryLower);
                });
                this.outputChannel.appendLine('Filtered to ' + filteredFiles.length + ' files matching query: "' + query + '"');
            } else {
                // When no query, show most recently modified files or alphabetically sorted
                this.outputChannel.appendLine('No query, showing all ' + allFiles.length + ' files');
                // Sort alphabetically for consistency
                filteredFiles = [...allFiles].sort();
            }
            
            // Limit results
            const maxResults = 50;
            const limitedFiles = filteredFiles.slice(0, maxResults);
            
            if (filteredFiles.length > maxResults) {
                this.outputChannel.appendLine('Limited results from ' + filteredFiles.length + ' to ' + maxResults);
            }
            
            limitedFiles.forEach((file: string, index: number) => {
                const item = new vscode.CompletionItem(file, vscode.CompletionItemKind.File);
                item.insertText = file;
                item.sortText = index.toString().padStart(5, '0');
                
                // Extract filename for display
                const lastSlash = file.lastIndexOf('/');
                const fileName = lastSlash >= 0 ? file.substring(lastSlash + 1) : file;
                item.label = fileName;
                item.detail = file;
                item.documentation = 'Insert file path: ' + file;
                
                // Set the range to replace text after @
                item.range = new vscode.Range(
                    new vscode.Position(position.line, atIndex + 1),
                    position
                );
                
                // Remove verbose logging for each item
                
                items.push(item);
            });
            
        } catch (error) {
            this.outputChannel.appendLine('Error getting files: ' + error);
            console.error('Error getting files:', error);
            // Clear cache on error
            this.invalidateCache();
        }
        
        this.outputChannel.appendLine('Returning ' + items.length + ' completion items');
        
        // Return as CompletionList with isIncomplete=true to ensure VSCode
        // continues to trigger completion as user types
        return new vscode.CompletionList(items, true);
    }
}

export function registerSimpleProvider(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, fileScanner: FileScannerVscode): { disposable: vscode.Disposable, provider: SimpleCompletionProvider } {
    outputChannel.appendLine('Registering simple completion provider');
    console.log('Registering simple completion provider');
    
    const provider = new SimpleCompletionProvider(outputChannel, fileScanner);
    
    // Register with proper document selector including scheme
    const selector: vscode.DocumentSelector = [
        { language: 'markdown', scheme: 'file' },
        { language: 'markdown', scheme: 'untitled' }
    ];
    
    // Register with @ as the primary trigger character
    const triggerCharacters = ['@'];
    
    const disposable = vscode.languages.registerCompletionItemProvider(
        selector,
        provider,
        ...triggerCharacters
    );
    
    outputChannel.appendLine('Simple provider registered with @ trigger and continuous completion');
    console.log('Simple provider registered with @ trigger and continuous completion');
    
    return { disposable, provider };
}