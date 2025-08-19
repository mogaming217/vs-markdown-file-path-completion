# VS Markdown File Path Completion プロジェクトの開発ガイド

## プロジェクト概要

Markdownファイル編集時に、`@`文字をトリガーとしてプロジェクト内のファイルパスを補完するVSCode拡張機能です。

## 開発コマンド

```bash
# 依存関係のインストール
npm install

# TypeScriptのコンパイル
npm run compile

# 開発時の自動コンパイル（ウォッチモード）
npm run watch

# Lintの実行
npm run lint

# テストの実行
npm test
```

## プロジェクト構造

```
vs-markdown-file-path-completion/
├── docs/
│   └── 00_base.md           # 開発計画と仕様書
├── src/
│   ├── extension.ts         # エントリーポイント
│   ├── completionProvider.ts # 補完プロバイダーの実装（未実装）
│   ├── fileScanner.ts       # ファイルスキャン処理（未実装）
│   ├── config.ts            # 設定管理（未実装）
│   └── utils.ts             # ユーティリティ関数（未実装）
├── test/suite/              # テストファイル（未実装）
├── .vscode/                 # VSCode開発設定
├── package.json             # npm設定
├── tsconfig.json            # TypeScript設定
└── README.md                # ユーザー向けドキュメント
```

## 実装状況

### 完了済み
- [x] プロジェクトの基本構造を作成
- [x] package.jsonの作成と基本設定
- [x] TypeScript設定（tsconfig.json）の作成
- [x] VSCode拡張機能のエントリーポイント（extension.ts）を作成
- [x] .vscodeignoreファイルの作成
- [x] 開発用VSCode設定（.vscode/launch.json）の作成
- [x] README.mdの作成
- [x] .gitignoreの作成
- [x] .eslintrc.jsonの作成
- [x] npm installで依存関係をインストール

### 実装予定（Phase 1: MVP）
- [ ] 基本的なCompletionProvider実装
- [ ] `@`トリガーでの補完起動
- [ ] シンプルなファイルスキャン
- [ ] デフォルト除外パターンの実装

### 実装予定（Phase 2: 高度な機能）
- [ ] 部分一致検索の最適化
- [ ] スコアリングアルゴリズム
- [ ] 設定システムの実装
- [ ] キャッシュ機構

## 主要機能

1. **トリガー**: `@`文字でファイルパス補完を起動
2. **部分一致**: ファイル名の一部でも検索可能（例：`@source`で`./path/to/source.ts`を補完）
3. **除外設定**: node_modules、.git、distなどを自動除外
4. **カスタマイズ**: 各種設定で動作を調整可能

## 設定項目

- `markdownPathCompletion.exclude`: 除外するファイル/フォルダのglobパターン
- `markdownPathCompletion.include`: 含めるファイルのglobパターン
- `markdownPathCompletion.maxResults`: 表示する補完候補の最大数（デフォルト: 50）
- `markdownPathCompletion.showHiddenFiles`: ドットファイルを含めるか（デフォルト: false）
- `markdownPathCompletion.useGitignore`: .gitignoreパターンを使用するか（デフォルト: true）
- `markdownPathCompletion.caseInsensitive`: 大文字小文字を区別しない検索（デフォルト: true）

## 開発のポイント

1. **パフォーマンス**: 大規模プロジェクトでも高速に動作するよう、ファイルリストをキャッシュ
2. **ユーザビリティ**: デフォルト設定で即座に使えるよう設計
3. **拡張性**: 将来的な機能追加を考慮した設計

## 次のステップ

1. `completionProvider.ts`の実装 - ファイル補完ロジックの中核
2. `fileScanner.ts`の実装 - ワークスペース内のファイルスキャン
3. `config.ts`の実装 - ユーザー設定の管理
4. テストの実装 - 機能の動作確認