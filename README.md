# Markdown File Path Completion

VSCode extension that provides file path autocompletion in Markdown files triggered by the `@` character.

## Features

- Trigger file path completion with `@` in Markdown files
- Fuzzy search for files in your workspace
- Configurable exclusion patterns
- Support for gitignore patterns
- Case-insensitive search option

## Usage

1. Open a Markdown file (`.md`)
2. Type `@` to trigger file path completion
3. Start typing part of a filename
4. Select from the suggested file paths

## Extension Settings

This extension contributes the following settings:

* `markdownPathCompletion.exclude`: Glob patterns for files/folders to exclude
* `markdownPathCompletion.include`: Glob patterns for files to include
* `markdownPathCompletion.maxResults`: Maximum number of suggestions (default: 50)
* `markdownPathCompletion.showHiddenFiles`: Include hidden files (default: false)
* `markdownPathCompletion.useGitignore`: Use .gitignore patterns (default: true)
* `markdownPathCompletion.caseInsensitive`: Case-insensitive matching (default: true)

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Run tests
npm test
```

## License

MIT