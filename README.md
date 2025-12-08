# 将棋ゲーム

ブラウザで動作する将棋ゲームです。JavaScriptで実装されており、人間対人間、人間対AI、AI対AIのモードでプレイできます。

## 機能

- 9x9の将棋盤で将棋をプレイ
- 人間対人間モード
- 人間対AIモード（初級・中級・上級・Ollama LLM）
- AI対AIモード
- 持ち駒の表示（後手は左側、先手は右側）
- 棋譜の記録と再生
- 成りの選択
- 合法手のハイライト表示
- 千日手の判定と対策

## 使い方

### ローカルサーバーを起動（推奨）

ES6モジュールを使用しているため、ローカルサーバーが必要です。

1. ターミナルで以下のコマンドを実行：
   ```bash
   cd ShogiGame
   python -m http.server 8000
   ```

2. ブラウザで以下のURLにアクセス：
   ```
   http://localhost:8000
   ```

3. プレイモードを選択
4. 駒をクリックして選択し、移動先をクリックして移動

### その他のサーバー起動方法

- **Node.jsを使用する場合**:
  npx http-server -p 8000
  ```

- **PHPを使用する場合**:
  ```bash
  php -S localhost:8000
  ```

## Ollama LLMの使用（オプション）

Ollamaを使用してLLMベースのAIと対戦できます。

### セットアップ

1. Ollamaをインストール: https://ollama.ai/
2. モデルをダウンロード（例）:
   ```bash
   ollama pull llama3.2
   ```
3. Ollamaサーバーを起動:
   ```bash
   ollama serve
   ```
4. ゲーム内で「AI強さ」から「Ollama LLM」を選択
5. 必要に応じてエンドポイントとモデル名を設定

### 注意事項

- ブラウザから直接Ollamaにアクセスする場合、CORSの問題が発生する可能性があります
- CORSエラーが発生する場合は、OllamaサーバーでCORSを有効にするか、プロキシサーバーを使用してください
- エラー時は自動的に中級AIにフォールバックします

## ファイル構成

- `index.html` - HTML構造
- `game.js` - ゲームロジック（メイン）
- `ai.js` - AIプレイヤーの実装（Ollama対応）
- `pieceMoves.js` - 駒の移動ロジック
- `constants.js` - 定数定義
- `style.css` - スタイルシート

## ライセンス

MIT License


