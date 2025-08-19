# VS Markdown File Path Completion 拡張機能開発計画

## 概要

Markdownファイル編集時に、`@`をトリガーとしてプロジェクト内のファイルパスを補完するVSCode拡張機能を開発します。

### 主要機能
- `.md`ファイルでのみ有効
- `@`文字をトリガーとしてファイルパス補完を起動
- ファイル名の部分一致でも補完可能（例：`@source`で`./path/to/source.ts`を補完）
- プロジェクトルートからの相対パスで補完

## 技術仕様

### CompletionProvider実装
```typescript
// 基本的な実装方針
vscode.languages.registerCompletionItemProvider(
    'markdown',
    {
        provideCompletionItems(document, position, token, context) {
            // @の後の文字列を取得
            // ファイルシステムをスキャンして候補を生成
            // CompletionItemの配列を返す
        }
    },
    '@' // トリガー文字
);
```

### ファイル検索アルゴリズム
1. ワークスペースルートからの全ファイルをスキャン
2. 除外パターンに基づいてフィルタリング
3. 入力文字列との部分一致検索
4. スコアリングして並び替え（完全一致 > 前方一致 > 部分一致）

## ファイル除外設定

### デフォルト除外パターン
以下のパターンはデフォルトで検索対象から除外します：

```json
{
  "**/node_modules": true,
  "**/.git": true,
  "**/dist": true,
  "**/build": true,
  "**/out": true,
  "**/.vscode": true,
  "**/coverage": true,
  "**/*.log": true,
  "**/.DS_Store": true,
  "**/Thumbs.db": true,
  "**/.idea": true,
  "**/.vs": true,
  "**/__pycache__": true,
  "**/*.pyc": true,
  "**/tmp": true,
  "**/temp": true
}
```

### 設定項目

#### `markdownPathCompletion.exclude`
- **型**: `object`
- **デフォルト**: 上記のデフォルト除外パターン
- **説明**: 除外するファイル/フォルダのglob パターン

#### `markdownPathCompletion.include`
- **型**: `array<string>`
- **デフォルト**: `["**/*"]`
- **説明**: 含めるファイルのglobパターン（特定の拡張子のみに限定する場合など）

#### `markdownPathCompletion.maxResults`
- **型**: `number`
- **デフォルト**: `50`
- **説明**: 表示する補完候補の最大数

#### `markdownPathCompletion.showHiddenFiles`
- **型**: `boolean`
- **デフォルト**: `false`
- **説明**: ドットファイル（.で始まるファイル）を補完候補に含めるか

#### `markdownPathCompletion.useGitignore`
- **型**: `boolean`
- **デフォルト**: `true`
- **説明**: .gitignoreのパターンを除外に使用するか

#### `markdownPathCompletion.caseInsensitive`
- **型**: `boolean`
- **デフォルト**: `true`
- **説明**: 大文字小文字を区別しない検索を行うか

## カスタマイズ性の設計方針

### 柔軟性と使いやすさのバランス
1. **デフォルト設定で即座に使える**: インストール直後から一般的なプロジェクトで有用
2. **段階的なカスタマイズ**: 必要に応じて細かく調整可能
3. **設定のリセット機能**: デフォルトに戻せるオプション

### ワークスペース設定との統合
- ワークスペース固有の設定を`.vscode/settings.json`で上書き可能
- チーム内で設定を共有できる

## プロジェクト構造

```
vs-markdown-file-path-completion/
├── docs/
│   └── 00_base.md (このファイル)
├── src/
│   ├── extension.ts          # エントリーポイント
│   ├── completionProvider.ts # 補完プロバイダーの実装
│   ├── fileScanner.ts        # ファイルスキャン処理
│   ├── config.ts             # 設定管理
│   └── utils.ts              # ユーティリティ関数
├── test/
│   └── suite/
│       ├── completionProvider.test.ts
│       └── fileScanner.test.ts
├── .vscode/
│   ├── launch.json
│   └── tasks.json
├── package.json
├── tsconfig.json
├── .vscodeignore
├── README.md
└── CHANGELOG.md
```

## 実装フェーズ

### Phase 1: 基本機能（MVP）
- [ ] プロジェクトセットアップ
- [ ] 基本的なCompletionProvider実装
- [ ] `@`トリガーでの補完起動
- [ ] シンプルなファイルスキャン
- [ ] デフォルト除外パターンの実装

### Phase 2: 高度な機能
- [ ] 部分一致検索の最適化
- [ ] スコアリングアルゴリズム
- [ ] 設定システムの実装
- [ ] キャッシュ機構

### Phase 3: ユーザビリティ向上
- [ ] アイコン表示（ファイルタイプ別）
- [ ] プレビュー機能
- [ ] パフォーマンス最適化
- [ ] エラーハンドリング強化

### Phase 4: 拡張機能
- [ ] 相対パス/絶対パス切り替え
- [ ] リンクの検証機能
- [ ] Quick Fix機能（壊れたリンクの修正提案）

## パフォーマンス考慮事項

- 大規模プロジェクトでの応答性を保つため、ファイルリストをキャッシュ
- ファイルシステムの変更を監視して、必要な時のみキャッシュを更新
- 非同期処理を活用して、UIをブロックしない

## セキュリティ考慮事項

- シンボリックリンクの扱い（無限ループ防止）
- 巨大ファイルの除外
- システムファイルへのアクセス制限

## 今後の拡張可能性

- 画像ファイルのプレビュー表示
- ファイル内容のスニペット表示
- 他の記法（Wiki記法など）への対応
- マルチルートワークスペース対応