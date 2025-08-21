import * as path from 'path';

export interface FuzzyMatch {
    path: string;
    score: number;
    matches: number[];
}

export interface FuzzySearchOptions {
    caseInsensitive?: boolean;
    pathSeparator?: string;
}

export class FuzzySearcher {
    private readonly caseInsensitive: boolean;
    private readonly pathSeparator: string;

    constructor(options: FuzzySearchOptions = {}) {
        this.caseInsensitive = options.caseInsensitive ?? true;
        this.pathSeparator = options.pathSeparator ?? path.sep;
    }

    /**
     * Performs fuzzy search on a list of file paths
     */
    public search(query: string, filePaths: string[], maxResults = 50): FuzzyMatch[] {
        
        if (!query) {
            return filePaths.slice(0, maxResults).map(path => ({
                path,
                score: 0,
                matches: []
            }));
        }

        const searchQuery = this.caseInsensitive ? query.toLowerCase() : query;
        const normalizedQuery = this.normalizeForSearch(searchQuery);
        
        const results: FuzzyMatch[] = [];

        for (const filePath of filePaths) {
            const match = this.fuzzyMatch(searchQuery, filePath);
            const normalizedMatch = this.fuzzyMatchNormalized(normalizedQuery, filePath);
            
            // Use the better score between regular and normalized matching
            if (match || normalizedMatch) {
                const bestMatch = (!match || (normalizedMatch && normalizedMatch.score > match.score)) 
                    ? normalizedMatch 
                    : match;
                if (bestMatch) {
                    results.push(bestMatch);
                }
            }
            
        }
        

        // Sort by score (descending) and limit results
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
    }

    /**
     * Performs fuzzy matching on a single path
     */
    private fuzzyMatch(query: string, filePath: string): FuzzyMatch | null {
        const searchPath = this.caseInsensitive ? filePath.toLowerCase() : filePath;
        const fileName = path.basename(searchPath);
        
        // Try different matching strategies
        const fileNameMatch = this.fuzzyMatchString(query, fileName);
        const pathMatch = this.fuzzyMatchString(query, searchPath);
        const pathSegmentMatch = this.fuzzyMatchPathSegments(query, filePath);

        // Calculate combined score
        let bestScore = 0;
        let bestMatches: number[] = [];

        if (fileNameMatch) {
            const fileNameBonus = 2.0; // Prioritize filename matches
            const score = fileNameMatch.score * fileNameBonus;
            if (score > bestScore) {
                bestScore = score;
                bestMatches = fileNameMatch.matches;
            }
        }

        if (pathMatch && pathMatch.score > bestScore) {
            bestScore = pathMatch.score;
            bestMatches = pathMatch.matches;
        }

        if (pathSegmentMatch && pathSegmentMatch.score > bestScore) {
            bestScore = pathSegmentMatch.score;
            bestMatches = pathSegmentMatch.matches;
        }

        if (bestScore > 0) {
            return {
                path: filePath,
                score: bestScore,
                matches: bestMatches
            };
        }

        return null;
    }

    /**
     * Fuzzy matches a query against a string
     */
    private fuzzyMatchString(query: string, target: string): { score: number; matches: number[] } | null {
        const searchTarget = this.caseInsensitive ? target.toLowerCase() : target;
        let queryIndex = 0;
        let targetIndex = 0;
        const matches: number[] = [];
        let score = 0;
        let consecutiveMatches = 0;
        let lastMatchIndex = -1;


        while (queryIndex < query.length && targetIndex < searchTarget.length) {
            if (query[queryIndex] === searchTarget[targetIndex]) {
                matches.push(targetIndex);
                
                // Score calculation
                score += 1;
                
                // Bonus for consecutive matches
                if (lastMatchIndex === targetIndex - 1) {
                    consecutiveMatches++;
                    score += consecutiveMatches * 0.5;
                } else {
                    consecutiveMatches = 0;
                }
                
                // Bonus for matching at word boundaries
                if (targetIndex === 0 || !this.isAlphanumeric(searchTarget[targetIndex - 1])) {
                    score += 1;
                }
                
                // Bonus for matching capital letters (camelCase)
                if (target[targetIndex] !== searchTarget[targetIndex]) { // Original was uppercase
                    score += 0.5;
                }
                
                lastMatchIndex = targetIndex;
                queryIndex++;
            }
            targetIndex++;
        }

        if (queryIndex === query.length) {
            // Normalize score by query length and target length
            const lengthPenalty = 1 - (matches[matches.length - 1] - matches[0]) / target.length;
            score *= lengthPenalty;
            
            // Bonus for exact match
            if (query === searchTarget) {
                score *= 2;
            }
            
            return { score, matches };
        }

        return null;
    }

    /**
     * Fuzzy matches against path segments (directories and filename)
     */
    private fuzzyMatchPathSegments(query: string, filePath: string): { score: number; matches: number[] } | null {
        const segments = filePath.split(this.pathSeparator);
        const searchSegments = this.caseInsensitive ? 
            segments.map(s => s.toLowerCase()) : segments;
        
        // Try to match query parts against path segments
        const queryParts = query.split(/[\\/\-_.]/);
        let totalScore = 0;
        const allMatches: number[] = [];
        let currentIndex = 0;

        for (let i = 0; i < segments.length; i++) {
            const segment = searchSegments[i];
            let segmentScore = 0;
            
            for (const queryPart of queryParts) {
                const match = this.fuzzyMatchString(queryPart, segment);
                if (match) {
                    segmentScore += match.score;
                    // Convert segment-relative matches to path-relative matches
                    allMatches.push(...match.matches.map(m => m + currentIndex));
                }
            }
            
            // Bonus for matching the filename (last segment)
            if (i === segments.length - 1 && segmentScore > 0) {
                segmentScore *= 1.5;
            }
            
            totalScore += segmentScore;
            currentIndex += segments[i].length + 1; // +1 for separator
        }

        if (totalScore > 0) {
            return {
                score: totalScore,
                matches: allMatches
            };
        }

        return null;
    }

    /**
     * Checks if a character is alphanumeric
     */
    private isAlphanumeric(char: string): boolean {
        return /[a-zA-Z0-9]/.test(char);
    }

    /**
     * Calculates the file type weight for scoring
     */
    public static getFileTypeWeight(filePath: string): number {
        const ext = path.extname(filePath).toLowerCase();
        
        // Common source code files get higher weight
        const sourceCodeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs'];
        if (sourceCodeExtensions.includes(ext)) {
            return 1.2;
        }
        
        // Documentation files
        const docExtensions = ['.md', '.mdx', '.rst', '.txt'];
        if (docExtensions.includes(ext)) {
            return 1.1;
        }
        
        // Config files
        const configExtensions = ['.json', '.yaml', '.yml', '.toml', '.xml'];
        if (configExtensions.includes(ext)) {
            return 1.05;
        }
        
        // Default weight
        return 1.0;
    }

    /**
     * Normalizes a string for search by removing non-alphanumeric characters
     */
    private normalizeForSearch(str: string): string {
        // Remove all non-alphanumeric characters and convert to lowercase
        return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    }

    /**
     * Performs fuzzy matching with normalized strings (symbols removed)
     */
    private fuzzyMatchNormalized(normalizedQuery: string, filePath: string): FuzzyMatch | null {
        if (!normalizedQuery) {
            return null;
        }
        
        const fileName = path.basename(filePath);
        const normalizedFileName = this.normalizeForSearch(fileName);
        const normalizedPath = this.normalizeForSearch(filePath);
        
        // Try matching against normalized filename first
        const fileNameMatch = this.fuzzyMatchString(normalizedQuery, normalizedFileName);
        const pathMatch = this.fuzzyMatchString(normalizedQuery, normalizedPath);
        
        let bestScore = 0;
        let bestMatches: number[] = [];
        
        if (fileNameMatch) {
            const fileNameBonus = 3.0; // Higher bonus for normalized matches
            const score = fileNameMatch.score * fileNameBonus;
            if (score > bestScore) {
                bestScore = score;
                bestMatches = fileNameMatch.matches;
            }
        }
        
        if (pathMatch && pathMatch.score * 0.8 > bestScore) {
            bestScore = pathMatch.score * 0.8;
            bestMatches = pathMatch.matches;
        }
        
        if (bestScore > 0) {
            return {
                path: filePath,
                score: bestScore,
                matches: bestMatches
            };
        }
        
        return null;
    }
}