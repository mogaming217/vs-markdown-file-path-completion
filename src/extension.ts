import * as vscode from "vscode";
import { FileScanner } from "./fileScanner";
import { createCompletionProvider } from "./completionProvider";

let fileScanner: FileScanner | undefined;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel("Markdown Path Completion");
  outputChannel.show();

  outputChannel.appendLine("Markdown File Path Completion is now active!");
  outputChannel.appendLine(
    "Workspace folders: " +
      vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath).join(", ")
  );

  try {
    // Initialize the file scanner
    fileScanner = new FileScanner();

    // Pre-populate cache in the background
    fileScanner
      .scanWorkspace()
      .then((files) => {
        outputChannel.appendLine(
          `Pre-scan completed: ${files.length} files cached`
        );
      })
      .catch((error) => {
        outputChannel.appendLine(`Pre-scan failed: ${error}`);
      });

    // Create and register the completion provider
    const completionProvider = createCompletionProvider(fileScanner);
    context.subscriptions.push(completionProvider);

    // Debug: Test if trigger character is working
    outputChannel.appendLine(
      "Completion provider registered for markdown files with @ trigger"
    );

    // Register the file scanner for disposal
    context.subscriptions.push({
      dispose: () => {
        if (fileScanner) {
          fileScanner.dispose();
          fileScanner = undefined;
        }
      },
    });

    outputChannel.appendLine(
      "Markdown File Path Completion provider registered successfully"
    );

    // Add debug command to manually scan workspace
    const debugCommand = vscode.commands.registerCommand(
      "markdownPathCompletion.debugScan",
      async () => {
        outputChannel.appendLine("=== Manual Debug Scan ===");
        outputChannel.appendLine(
          "Workspace folders: " +
            vscode.workspace.workspaceFolders
              ?.map((f) => f.uri.fsPath)
              .join(", ")
        );

        if (fileScanner) {
          const files = await fileScanner.scanWorkspace();
          outputChannel.appendLine("Total files found: " + files.length);
          if (files.length > 0) {
            outputChannel.appendLine("First 10 files:");
            files
              .slice(0, 10)
              .forEach((f) => outputChannel.appendLine("  - " + f));

            const recipeFiles = files.filter((f) =>
              f.toLowerCase().includes("recipe")
            );
            outputChannel.appendLine(
              'Files containing "recipe": ' + recipeFiles.length
            );
            recipeFiles.forEach((f) => outputChannel.appendLine("  - " + f));
          }
        }
      }
    );
    context.subscriptions.push(debugCommand);
  } catch (error) {
    outputChannel.appendLine(
      "Failed to activate Markdown File Path Completion extension: " + error
    );
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
