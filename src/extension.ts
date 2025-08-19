import * as vscode from 'vscode';
import { FileScanner } from './fileScanner';
import { createCompletionProvider } from './completionProvider';

let fileScanner: FileScanner | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Markdown File Path Completion is now active!');

    try {
        // Initialize the file scanner
        fileScanner = new FileScanner();

        // Create and register the completion provider
        const completionProvider = createCompletionProvider(fileScanner);
        context.subscriptions.push(completionProvider);

        // Register the file scanner for disposal
        context.subscriptions.push({
            dispose: () => {
                if (fileScanner) {
                    fileScanner.dispose();
                    fileScanner = undefined;
                }
            }
        });

        console.log('Markdown File Path Completion provider registered successfully');

    } catch (error) {
        console.error('Failed to activate Markdown File Path Completion extension:', error);
        vscode.window.showErrorMessage('Failed to activate Markdown File Path Completion extension');
    }
}

export function deactivate() {
    if (fileScanner) {
        fileScanner.dispose();
        fileScanner = undefined;
    }
}