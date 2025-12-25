# 3つのUSIエンジンのテスト手順

## 前提条件

1. ShogiServerで3つのサーバーが起動していること
   - server1: http://localhost:8081 (dlshogi_tensorrt.exe)
   - server2: http://localhost:8082 (YaneuraOu_NNUE-tournament-clang++-zen2.exe)
   - server3: http://localhost:8083 (dlshogi_onnxruntime.exe)

2. ShogiGameのサーバーが起動していること
   - http://localhost:8080

## テスト手順

### 1. 各サーバーにエンジンを接続

#### Server1 (ポート8081)
```powershell
$body = @{ enginePath = ".\dlshogi-dr2_exhi\dlshogi_tensorrt.exe" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8081/usi/connect" -Method POST -ContentType "application/json" -Body $body
```

#### Server2 (ポート8082)
```powershell
$body = @{ enginePath = ".\Suisho5-YaneuraOu-v7.5.0-windows\YaneuraOu_NNUE-tournament-clang++-zen2.exe" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8082/usi/connect" -Method POST -ContentType "application/json" -Body $body
```

#### Server3 (ポート8083)
```powershell
$body = @{ enginePath = ".\dlshogi-dr2_exhi\dlshogi_onnxruntime.exe" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8083/usi/connect" -Method POST -ContentType "application/json" -Body $body
```

### 2. 各エンジンを初期化

各サーバーで `/usi/usi` エンドポイントを呼び出してエンジンを初期化します。

### 3. ShogiGameでテスト

1. ブラウザで http://localhost:8080 を開く

2. **先手の設定:**
   - AI強さ: "USIエンジン" を選択
   - USIサーバーURL: `http://localhost:8081` を入力

3. **後手の設定:**
   - AI強さ: "USIエンジン" を選択
   - USIサーバーURL: `http://localhost:8082` を入力

4. "ニューゲーム" ボタンをクリック

5. ゲームが開始され、各エンジンが思考することを確認

### 4. 異なる組み合わせでテスト

#### テストケース1: Server1 vs Server2
- 先手: http://localhost:8081
- 後手: http://localhost:8082

#### テストケース2: Server2 vs Server3
- 先手: http://localhost:8082
- 後手: http://localhost:8083

#### テストケース3: Server1 vs Server3
- 先手: http://localhost:8081
- 後手: http://localhost:8083

## 確認事項

- [ ] 各サーバーが正常に起動している
- [ ] 各エンジンが正常に接続されている
- [ ] 各エンジンが正常に初期化されている
- [ ] ShogiGameで先手と後手に異なるエンジンを設定できる
- [ ] ゲームが正常に開始される
- [ ] 各エンジンが正常に思考する
- [ ] 手が正常に反映される
