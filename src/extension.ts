import * as vscode from "vscode";
import { FileScanner } from "./fileScanner";
import { createCompletionProvider } from "./completionProvider";

let fileScanner: FileScanner | undefined;

export function activate(context: vscode.ExtensionContext) {

  try {
    // Initialize the file scanner
    fileScanner = new FileScanner();

    // Pre-populate cache in the background
    fileScanner.scanWorkspace().catch(() => {
      // Silently handle pre-scan errors
    });

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
      },
    });

  } catch (error) {
    vscode.window.showErrorMessage(
      "Failed to activate Markdown File Path Completion extension"
    );
  }
}

export function deactivate() {
  if (fileScanner) {
    fileScanner.dispose();
    fileScanner = undefined;
  }
}
