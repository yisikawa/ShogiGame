# server1, server2 テスト結果

## テスト日時
2025-12-25

## テスト環境
- **server1**: `http://localhost:8081` (dlshogi)
- **server2**: `http://localhost:8082` (Suisho5(20211123)-YaneuraOu-v7.5.0)
- **先手**: server2 (ポート8082)
- **後手**: server1 (ポート8081)

## テスト結果

### ✅ 成功した点

1. **サーバー接続**
   - `server1` (ポート8081): 正常に動作中
   - `server2` (ポート8082): 正常に動作中

2. **先手（server2）の動作**
   - ✅ エンジン名が正しく表示: `Suisho5(20211123)-YaneuraOu-v7.5.0 (yaneurao, tayayan)`
   - ✅ AIインスタンスが正しいURL (`http://localhost:8082`) に接続
   - ✅ ゲームが正常に進行

3. **後手（server1）の動作**
   - ✅ AIインスタンスが正しいURL (`http://localhost:8081`) に接続
   - ✅ ゲームが正常に進行

4. **ゲーム進行**
   - ✅ ゲームが正常に開始・進行
   - ✅ AI同士の対戦が正常に動作
   - ✅ 手数カウント、棋譜記録が正常

### ⚠️ 問題点

1. **後手（server1）のエンジン名表示**
   - ❌ エンジン名が表示されていない（URLのみ表示: `http://localhost:8081`）
   - `server1`の`health`エンドポイントでは`engineName: "dlshogi"`が返されるが、`engineRunning: false`、`engineReady: false`
   - `USIClient`の`engineName`が`null`のまま

2. **エンジンの状態**
   - `server1`のエンジンが起動していない可能性がある
   - `engineRunning: false`、`engineReady: false`の状態

## 詳細情報

### サーバー状態（テスト時点）

**server1 (ポート8081)**:
```json
{
  "status": "ok",
  "serverName": "server1",
  "port": 8081,
  "engineRunning": false,
  "engineReady": false,
  "engineName": "dlshogi"
}
```

**server2 (ポート8082)**:
```json
{
  "status": "ok",
  "serverName": "server2",
  "port": 8082,
  "engineRunning": true,
  "engineReady": true,
  "engineName": "Suisho5(20211123)-YaneuraOu-v7.5.0"
}
```

### AIインスタンス状態

**先手（server2）**:
- `serverUrl`: `http://localhost:8082` ✅
- `connected`: `true` ✅
- `engineName`: `Suisho5(20211123)-YaneuraOu-v7.5.0` ✅
- `engineAuthor`: `yaneurao, tayayan` ✅

**後手（server1）**:
- `serverUrl`: `http://localhost:8081` ✅
- `connected`: `true` ✅
- `engineName`: `null` ❌
- `engineAuthor`: `null` ❌

## 確認結果

### server1のエンジン状態

1. **エンジン起動**: `/usi/connect`エンドポイントでエンジンを起動しました
   - レスポンス: `{"connected": true, "engineRunning": true}`

2. **エンジン名取得**: `/usi/usi`エンドポイントでエンジン名を取得可能
   - レスポンス: `{"ready": false, "name": "dlshogi", "author": "Tadao Yamaoka"}`
   - ✅ エンジン名は取得できている（`ready: false`でも`name`は返される）

3. **ブラウザ側の状態**
   - ❌ `USIClient`の`connected: false`
   - ❌ `USIClient`の`engineName: null`
   - ❌ UIにエンジン名が表示されていない

### 問題の原因

`server1`のエンジンは起動しており、サーバー側ではエンジン名が取得できていますが、ブラウザ側の`USIClient`がエンジン名を取得できていません。

考えられる原因:
1. `USIClient`が`server1`に接続していない
2. `USIClient`のエンジン名取得ロジックが`ready: false`の場合に正しく動作していない
3. エンジン名のUI更新ロジックが動作していない

## 結論

`server1`と`server2`の基本的な動作は確認できましたが、`server1`のエンジン名がブラウザ側で表示されない問題があります。サーバー側ではエンジン名が取得できているため、ブラウザ側の`USIClient`の接続・エンジン名取得ロジックを確認する必要があります。

## 推奨事項

1. `USIClient`の接続ロジックを確認（`server1`への接続が成功しているか）
2. `USIClient`のエンジン名取得ロジックを確認（`ready: false`でも`name`を取得できるか）
3. エンジン名のUI更新ロジックを確認（取得したエンジン名がUIに反映されるか）
