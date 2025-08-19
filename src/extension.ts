import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Markdown File Path Completion is now active!');

    const provider = vscode.languages.registerCompletionItemProvider(
        'markdown',
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const linePrefix = document.lineAt(position).text.substring(0, position.character);
                if (!linePrefix.endsWith('@')) {
                    return undefined;
                }

                // TODO: Implement file scanning and completion items generation
                const completionItem = new vscode.CompletionItem('example.md');
                completionItem.kind = vscode.CompletionItemKind.File;

                return [completionItem];
            }
        },
        '@'
    );

    context.subscriptions.push(provider);
}

export function deactivate() {}