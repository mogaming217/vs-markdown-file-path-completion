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
        _context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList | undefined> {
        
        // Only provide completions in markdown files
        if (document.languageId !== 'markdown') {
            return undefined;
        }

        const line = document.lineAt(position.line);
        const lineText = line.text;
        const cursorPosition = position.character;

        
        // Extract the query after the @ character
        const query = extractQueryFromLine(lineText, cursorPosition);
        
        if (query === null) {
            return undefined;
        }

        // If cancellation is requested, return early
        if (token.isCancellationRequested) {
            return undefined;
        }

        try {
            
            // Calculate the range to replace (from @ to cursor)
            const atIndex = this.findAtSymbolIndex(lineText, cursorPosition);
            let replaceRange: vscode.Range | undefined;
            
            if (atIndex !== -1) {
                // Important: Include the @ symbol in the replacement range
                replaceRange = new vscode.Range(
                    position.line,
                    atIndex,
                    position.line,
                    position.character
                );
            }

            
            // Get matching files with VSCode-like fuzzy search
            const matches = await this.fileScanner.getMatchingFiles(query, token);
            
            // Convert matches to completion items
            const completionItems = matches.map((match) => {
                const item = createCompletionItemFromFuzzyMatch(match, replaceRange);
                return item;
            });

            
            // Log the CompletionList object
            const completionList = new vscode.CompletionList(completionItems, true);
            
            // Return as CompletionList with isIncomplete: true
            // This ensures VSCode continues to request completions as the user types
            return completionList;

        } catch (error) {
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
    
    
    // Register with @ as trigger character
    // This ensures completion is automatically shown when @ is typed
    const disposable = vscode.languages.registerCompletionItemProvider(
        { scheme: 'file', language: 'markdown' },
        provider,
        '@' // Trigger character - completion will show automatically after @
    );
    
    
    return disposable;
}
