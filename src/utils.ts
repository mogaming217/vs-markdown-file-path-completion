import * as path from 'path';
import * as vscode from 'vscode';

export interface FileMatch {
    relativePath: string;
    fileName: string;
    score: number;
}

/**
 * Normalizes a file path to use forward slashes and removes leading './'
 */
export function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Gets the relative path from workspace root to the given file
 */
export function getRelativePath(filePath: string, workspaceRoot: string): string {
    const relativePath = path.relative(workspaceRoot, filePath);
    return normalizePath(relativePath);
}

/**
 * Calculates a relevance score for a file match based on the search query
 * Higher scores indicate better matches
 */
export function calculateScore(filePath: string, query: string, caseInsensitive = true): number {
    const fileName = path.basename(filePath);
    const searchQuery = caseInsensitive ? query.toLowerCase() : query;
    const searchFileName = caseInsensitive ? fileName.toLowerCase() : fileName;
    const searchFilePath = caseInsensitive ? filePath.toLowerCase() : filePath;

    // If query is empty, return base score
    if (!searchQuery) {
        return 1;
    }

    let score = 0;

    // Exact filename match gets highest score
    if (searchFileName === searchQuery) {
        score += 100;
    }
    // Filename starts with query gets high score
    else if (searchFileName.startsWith(searchQuery)) {
        score += 80;
    }
    // Filename contains query gets medium score
    else if (searchFileName.includes(searchQuery)) {
        score += 60;
    }
    // Full path starts with query gets medium score
    else if (searchFilePath.startsWith(searchQuery)) {
        score += 40;
    }
    // Full path contains query gets low score
    else if (searchFilePath.includes(searchQuery)) {
        score += 20;
    }

    // Bonus points for shorter paths (closer to root)
    const pathDepth = filePath.split('/').length;
    score += Math.max(0, 10 - pathDepth);

    // Bonus points for common file types
    const ext = path.extname(fileName).toLowerCase();
    const commonExtensions = ['.md', '.txt', '.js', '.ts', '.json', '.html', '.css', '.py', '.java', '.cpp', '.h'];
    if (commonExtensions.includes(ext)) {
        score += 5;
    }

    return score;
}

/**
 * Filters and sorts file paths based on a search query
 */
export function filterAndSortFiles(
    files: string[],
    query: string,
    maxResults: number,
    caseInsensitive = true
): FileMatch[] {
    const matches: FileMatch[] = [];

    for (const filePath of files) {
        const score = calculateScore(filePath, query, caseInsensitive);
        
        // Only include files that have some relevance to the query
        if (score > 0) {
            matches.push({
                relativePath: filePath,
                fileName: path.basename(filePath),
                score
            });
        }
    }

    // Sort by score (descending) and then by path length (ascending)
    matches.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        return a.relativePath.length - b.relativePath.length;
    });

    return matches.slice(0, maxResults);
}

/**
 * Checks if a file should be included based on hidden file settings
 */
export function shouldIncludeFile(filePath: string, showHiddenFiles: boolean): boolean {
    if (showHiddenFiles) {
        return true;
    }

    // Check if any part of the path starts with a dot (hidden file/folder)
    const parts = filePath.split('/');
    return !parts.some(part => part.startsWith('.') && part.length > 1);
}

/**
 * Extracts the query text after the @ trigger character
 */
export function extractQueryFromLine(line: string, position: number): string | null {
    // Find the last @ character before the cursor position
    let atIndex = -1;
    for (let i = position - 1; i >= 0; i--) {
        if (line[i] === '@') {
            atIndex = i;
            break;
        }
        // If we hit whitespace before finding @, this isn't a valid completion
        if (line[i] === ' ' || line[i] === '\t' || line[i] === '\n') {
            break;
        }
    }

    if (atIndex === -1) {
        return null;
    }

    // Extract text between @ and cursor position
    return line.substring(atIndex + 1, position);
}

/**
 * Creates a VS Code completion item from a file match
 */
export function createCompletionItem(
    fileMatch: FileMatch,
    range?: vscode.Range
): vscode.CompletionItem {
    const item = new vscode.CompletionItem(fileMatch.relativePath, vscode.CompletionItemKind.File);
    
    item.detail = `File: ${fileMatch.fileName}`;
    item.documentation = new vscode.MarkdownString(`Path: \`${fileMatch.relativePath}\``);
    item.sortText = String(1000 - fileMatch.score).padStart(4, '0'); // Ensure proper sorting
    
    // If range is provided, use it for replacement
    if (range) {
        item.range = range;
    }
    
    return item;
}