import * as vscode from 'vscode';
import { FileScanner } from './fileScanner';
import { extractQueryFromLine, createCompletionItemFromFuzzyMatch } from './utils';

export class MarkdownFilePathCompletionProvider implements vscode.CompletionItemProvider {
    private fileScanner: FileScanner;

    constructor(fileScanner: FileScanner) {
        this.fileScanner = fileScanner;
    }

    public async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList | undefined> {
        console.log('provideCompletionItems called');
        console.log('Document language:', document.languageId);
        console.log('Position:', position.line, position.character);
        console.log('Trigger kind:', context.triggerKind);
        console.log('Trigger character:', context.triggerCharacter);
        
        // Only provide completions in markdown files
        if (document.languageId !== 'markdown') {
            console.log('Not a markdown file, skipping');
            return undefined;
        }

        const line = document.lineAt(position.line);
        const lineText = line.text;
        const cursorPosition = position.character;

        // Log before extraction
        console.log('Line text:', lineText);
        console.log('Cursor position:', cursorPosition);
        console.log('Text before cursor:', lineText.substring(0, cursorPosition));
        
        // Extract the query after the @ character
        const query = extractQueryFromLine(lineText, cursorPosition);
        console.log('Extracted query:', JSON.stringify(query));
        
        if (query === null) {
            console.log('No valid query found');
            return undefined;
        }

        // If cancellation is requested, return early
        if (token.isCancellationRequested) {
            return undefined;
        }

        try {
            console.log('Starting file search for query:', query);
            
            // Calculate the range to replace (from @ to cursor)
            const atIndex = this.findAtSymbolIndex(lineText, cursorPosition);
            console.log('@ symbol index:', atIndex);
            let replaceRange: vscode.Range | undefined;
            
            if (atIndex !== -1) {
                // Important: Include the @ symbol in the replacement range
                replaceRange = new vscode.Range(
                    position.line,
                    atIndex,
                    position.line,
                    position.character
                );
                console.log('Replace range:', replaceRange.start.character, '->', replaceRange.end.character);
                console.log('Detailed Range:', JSON.stringify(replaceRange));
            }

            console.log('Getting matching files...');
            
            // Get matching files with VSCode-like fuzzy search
            const matches = await this.fileScanner.getMatchingFiles(query, token);
            console.log('Got matches:', matches.length);
            if (matches.length > 0) {
                console.log('First 5 matches:', matches.slice(0, 5).map(m => ({ path: m.path, score: m.score })));
            }
            
            // Convert matches to completion items
            const completionItems = matches.map((match, index) => {
                const item = createCompletionItemFromFuzzyMatch(match, replaceRange);
                if (index < 3) {
                    console.log(`Completion item ${index}:`, {
                        label: item.label,
                        insertText: item.insertText,
                        range: item.range,
                        filterText: item.filterText,
                        sortText: item.sortText
                    });
                }
                return item;
            });

            console.log('Total completion items:', completionItems.length);
            if (completionItems.length === 0) {
                console.log('No completion items created!');
            }
            
            // Log the CompletionList object
            const completionList = new vscode.CompletionList(completionItems, true);
            console.log('Returning CompletionList:', {
                items: completionList.items.length,
                isIncomplete: completionList.isIncomplete,
                firstItem: completionList.items[0] ? {
                    label: completionList.items[0].label,
                    kind: completionList.items[0].kind,
                    insertText: completionList.items[0].insertText,
                    range: completionList.items[0].range
                } : null
            });
            
            // Return as CompletionList with isIncomplete: true
            // This ensures VSCode continues to request completions as the user types
            return completionList;

        } catch (error) {
            console.error('Error in provideCompletionItems:', error);
            return undefined;
        }
    }

    /**
     * Finds the index of the @ symbol that triggers this completion
     */
    private findAtSymbolIndex(line: string, cursorPosition: number): number {
        for (let i = cursorPosition - 1; i >= 0; i--) {
            if (line[i] === '@') {
                return i;
            }
            // Stop if we hit whitespace
            if (line[i] === ' ' || line[i] === '\t' || line[i] === '\n') {
                break;
            }
        }
        return -1;
    }

    /**
     * Resolve additional information for a completion item
     */
    public resolveCompletionItem(
        item: vscode.CompletionItem,
        _token: vscode.CancellationToken // eslint-disable-line @typescript-eslint/no-unused-vars
    ): vscode.ProviderResult<vscode.CompletionItem> {
        // For now, we don't need to resolve additional information
        // This could be used in the future to add more details like file size, last modified, etc.
        return item;
    }
}

/**
 * Factory function to create and register the completion provider
 */
export function createCompletionProvider(fileScanner: FileScanner): vscode.Disposable {
    const provider = new MarkdownFilePathCompletionProvider(fileScanner);
    
    console.log('Registering completion provider for markdown files');
    console.log('Trigger character: @');
    
    // Register with @ as trigger character
    // This ensures completion is automatically shown when @ is typed
    const disposable = vscode.languages.registerCompletionItemProvider(
        { scheme: 'file', language: 'markdown' },
        provider,
        '@' // Trigger character - completion will show automatically after @
    );
    
    console.log('Completion provider registration complete');
    
    return disposable;
}
