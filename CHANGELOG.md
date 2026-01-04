# 変更履歴

## 2024年 - JSONコンフィグファイルによる初期値設定機能

### 概要
Ollama LLM名とUSIサーバーURLの初期値を、JSONコンフィグファイル（`config.json`）で設定できるようにしました。

### 変更内容

#### 1. 新規ファイル作成

**`config.json`**
- OllamaとUSIの設定をJSON形式で定義
- デフォルト値として以下を設定：
  - Ollama: `endpoint`, `model`, `timeout`
  - USI: `serverUrl`, `timeout`

**`config.js`**
- JSONファイルを非同期で読み込むモジュール
- デフォルト値のフォールバック機能を実装
- `loadConfig()`: コンフィグファイルを読み込む
- `getConfig()`: 既に読み込まれた設定を取得

#### 2. `constants.js`の修正

- コンフィグを動的に読み込む機能を追加
- `initializeConfig()`: コンフィグを初期化する非同期関数
- `getOllamaConfig()`: Ollama設定を取得する関数
- `getUSIConfig()`: USI設定を取得する関数
- `OLLAMA_CONFIG`と`USI_CONFIG`を動的に更新可能に変更

#### 3. `game.js`の修正

- `DOMContentLoaded`イベントでコンフィグを読み込み
- HTMLの初期値（LLM名とURL）をJSONから自動設定
  - `ollamaModelSente` / `ollamaModelGote`
  - `usiServerUrlSente` / `usiServerUrlGote`

#### 4. `ai.js`の修正

- `configureOllama()`: `getOllamaConfig()`を使用して動的にコンフィグを取得
- `configureUSI()`: `getUSIConfig()`を使用して動的にコンフィグを取得

### 使用方法

1. `config.json`ファイルを編集して、LLM名やURLを変更：

```json
{
  "ollama": {
    "endpoint": "http://localhost:11434",
    "model": "qwen3:14b-q4_k_m",
    "timeout": 180000
  },
  "usi": {
    "serverUrl": "http://localhost:8082",
    "timeout": 30000
  }
}
```

2. ブラウザをリロードすると、HTMLの入力フィールドの初期値が自動的に更新されます。

### 技術的な詳細

- **非同期読み込み**: `config.json`は`DOMContentLoaded`イベントで非同期に読み込まれます
- **フォールバック**: `config.json`が読み込めない場合、デフォルト値が使用されます
- **動的更新**: コンフィグは実行時に読み込まれ、`OLLAMA_CONFIG`と`USI_CONFIG`が更新されます

### メリット

- **設定の一元管理**: すべての初期設定を1つのJSONファイルで管理
- **環境ごとの設定**: 開発環境と本番環境で異なる設定ファイルを使用可能
- **メンテナンス性**: コードを変更せずに設定を変更可能

### 注意事項

- `config.json`が読み込めない場合、デフォルト値が使用されます
- ブラウザのキャッシュをクリアするか、ハードリロード（Ctrl+Shift+R）が必要な場合があります

