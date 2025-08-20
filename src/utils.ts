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
 * Fuzzy matching implementation for better search results
 * Returns a score based on how well the query matches the target string
 */
function fuzzyMatch(query: string, target: string, caseInsensitive = true): number {
    const searchQuery = caseInsensitive ? query.toLowerCase() : query;
    const searchTarget = caseInsensitive ? target.toLowerCase() : target;
    
    if (!searchQuery) {return 1;}
    if (searchTarget === searchQuery) {return 100;}
    
    let score = 0;
    let queryIndex = 0;
    let targetIndex = 0;
    let consecutiveMatches = 0;
    
    while (queryIndex < searchQuery.length && targetIndex < searchTarget.length) {
        if (searchQuery[queryIndex] === searchTarget[targetIndex]) {
            score += 10;
            
            // Bonus for consecutive matches
            consecutiveMatches++;
            score += consecutiveMatches * 2;
            
            // Bonus for matching at word boundaries
            if (targetIndex === 0 || target[targetIndex - 1] === '/' || target[targetIndex - 1] === '-' || target[targetIndex - 1] === '_') {
                score += 15;
            }
            
            queryIndex++;
        } else {
            consecutiveMatches = 0;
        }
        targetIndex++;
    }
    
    // If we didn't match all query characters, penalize heavily
    if (queryIndex < searchQuery.length) {
        score = score * queryIndex / searchQuery.length;
    }
    
    // Bonus for shorter targets (more specific matches)
    score += Math.max(0, 50 - target.length) / 5;
    
    return score;
}

/**
 * Calculates the Levenshtein distance between two strings
 * Lower values indicate more similar strings
 */
function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    
    if (m === 0) {return n;}
    if (n === 0) {return m;}
    
    const matrix: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) {
        matrix[i][0] = i;
    }
    
    for (let j = 0; j <= n; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    
    return matrix[m][n];
}

/**
 * Calculates a relevance score for a file match based on the search query
 * Higher scores indicate better matches
 */
export function calculateScore(filePath: string, query: string, caseInsensitive = true): number {
    const fileName = path.basename(filePath);
    const searchQuery = caseInsensitive ? query.toLowerCase() : query;
    const searchFileName = caseInsensitive ? fileName.toLowerCase() : fileName;

    // If query is empty, return base score
    if (!searchQuery) {
        return 1;
    }

    let score = 0;

    // Exact filename match gets highest score
    if (searchFileName === searchQuery) {
        score += 200;
    }
    // Use fuzzy matching for partial matches
    else {
        // Fuzzy match on filename (weighted higher)
        const fileNameFuzzyScore = fuzzyMatch(query, fileName, caseInsensitive);
        score += fileNameFuzzyScore * 1.5;
        
        // Fuzzy match on full path
        const pathFuzzyScore = fuzzyMatch(query, filePath, caseInsensitive);
        score += pathFuzzyScore * 0.5;
        
        // Levenshtein distance bonus (inverse - closer strings get higher scores)
        const distance = levenshteinDistance(searchQuery, searchFileName);
        const maxDistance = Math.max(searchQuery.length, searchFileName.length);
        const similarityScore = (1 - (distance / maxDistance)) * 50;
        score += similarityScore;
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
    
    // Bonus for files that start with query
    if (searchFileName.startsWith(searchQuery)) {
        score += 30;
    }
    
    // Bonus for camelCase/snake_case boundary matches
    const boundaryMatches = query.split('').filter((char, index) => {
        const charLower = char.toLowerCase();
        const fileNameIndex = fileName.toLowerCase().indexOf(charLower, index);
        if (fileNameIndex > 0) {
            const prevChar = fileName[fileNameIndex - 1];
            return prevChar === '_' || prevChar === '-' || 
                   (prevChar.toLowerCase() === prevChar && fileName[fileNameIndex] !== fileName[fileNameIndex].toLowerCase());
        }
        return fileNameIndex === 0;
    }).length;
    score += boundaryMatches * 10;

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
        // Lower threshold to include more fuzzy matches
        if (score > 10 || !query) {
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