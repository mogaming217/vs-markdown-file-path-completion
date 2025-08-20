import * as vscode from 'vscode';
import { FileScanner } from './fileScanner';
import { getConfiguration } from './config';
import { extractQueryFromLine, filterAndSortFiles, createCompletionItem } from './utils';

export class MarkdownFilePathCompletionProvider implements vscode.CompletionItemProvider {
    private fileScanner: FileScanner;

    constructor(fileScanner: FileScanner) {
        this.fileScanner = fileScanner;
    }

    public async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        _context: vscode.CompletionContext // eslint-disable-line @typescript-eslint/no-unused-vars
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
            // Get matching files
            const matchingFiles = await this.fileScanner.getMatchingFiles(query);
            
            if (token.isCancellationRequested) {
                return undefined;
            }

            const config = getConfiguration();
            
            // Filter and sort files based on relevance
            const fileMatches = filterAndSortFiles(
                matchingFiles,
                query,
                config.maxResults,
                config.caseInsensitive
            );

            // Calculate the range to replace (from @ to cursor)
            const atIndex = this.findAtSymbolIndex(lineText, cursorPosition);
            let replaceRange: vscode.Range | undefined;
            
            if (atIndex !== -1) {
                replaceRange = new vscode.Range(
                    new vscode.Position(position.line, atIndex),
                    position
                );
            }

            // Create completion items
            const completionItems = fileMatches.map(fileMatch => 
                createCompletionItem(fileMatch, replaceRange)
            );

            // Return as CompletionList to indicate that the list is complete
            return new vscode.CompletionList(completionItems, false);

        } catch (error) {
            console.error('Error providing completions:', error);
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
    
    return vscode.languages.registerCompletionItemProvider(
        { scheme: 'file', language: 'markdown' },
        provider,
        '@' // Trigger character
    );
}