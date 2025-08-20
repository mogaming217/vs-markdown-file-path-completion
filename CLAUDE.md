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
│   ├── completionProvider.ts # 補完プロバイダーの実装
│   ├── fileScanner.ts       # ファイルスキャン処理
│   ├── config.ts            # 設定管理
│   └── utils.ts             # ユーティリティ関数
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

### 完了済み（Phase 1: MVP）
- [x] 基本的なCompletionProvider実装
- [x] `@`トリガーでの補完起動
- [x] シンプルなファイルスキャン
- [x] デフォルト除外パターンの実装

### 完了済み（Phase 2: 高度な機能）
- [x] 部分一致検索の最適化（ファジーマッチングとLevenshtein距離実装）
- [x] スコアリングアルゴリズムの改善（高度なスコアリング実装）
- [x] 設定システムの拡張（動的設定リロード、プロファイル機能実装）
- [x] キャッシュ機構の最適化（LRUキャッシュ、インクリメンタル更新実装）

### 実装予定（Phase 3: ユーザビリティ向上）
- [ ] アイコン表示（ファイルタイプ別）
- [ ] プレビュー機能
- [ ] エラーハンドリング強化（現在基本的なエラーハンドリングは実装済み）

### 実装予定（Phase 4: 拡張機能）
- [ ] 相対パス/絶対パス切り替え
- [ ] リンクの検証機能
- [ ] Quick Fix機能（壊れたリンクの修正提案）

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

## Phase 1 MVP実装の技術詳細

### 実装済み機能
1. **基本的なCompletionProvider**
   - Markdownファイルでのみ動作
   - `@`文字をトリガーとして補完を起動
   - カーソル位置から`@`以降のテキストを抽出

2. **シンプルなファイルスキャン**
   - ワークスペース内の全ファイルを再帰的にスキャン
   - 基本的な30秒キャッシュ機能
   - ファイルシステムウォッチャーによる変更検知

3. **デフォルト除外パターン**
   - node_modules、.git、dist等の一般的なディレクトリを除外
   - 設定ファイルからの除外パターン読み込み
   - .gitignoreサポート（useGitignore設定による）

4. **基本的な部分一致とスコアリング**
   - ファイル名とパスの部分一致検索
   - シンプルなスコアリング（完全一致、前方一致、部分一致）
   - 結果の並び替え

## Phase 2 高度な機能実装の技術詳細

### 実装済み機能
1. **高度な検索アルゴリズム**
   - ファジーマッチングによる柔軟な検索
   - Levenshtein距離による類似度計算
   - camelCase/snake_case境界マッチング

2. **改善されたスコアリングシステム**
   - 多次元スコアリング（完全一致、ファジーマッチ、編集距離）
   - 連続文字マッチボーナス
   - 単語境界マッチボーナス
   - ファイルタイプ別の重み付け

3. **拡張された設定管理**
   - ConfigurationManagerによる動的設定管理
   - 設定変更時の自動リロード
   - ワークスペース固有設定のサポート
   - プロジェクトタイプ別プロファイル（documentation、web-project、monorepo）

4. **最適化されたキャッシュシステム**
   - LRUキャッシュによるメモリ効率的な管理
   - ワークスペース別のキャッシュ分離
   - インクリメンタルファイル更新（ファイル追加/削除の差分適用）
   - デバウンス処理による効率的な更新

## 次のステップ

1. テストの実装 - 機能の動作確認
2. VSCode拡張機能としてのパッケージング
3. マーケットプレイスへの公開準備
4. Phase 3の機能実装（アイコン表示など）