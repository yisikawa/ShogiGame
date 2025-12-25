# USIエンジン選択時のURL表示テスト結果

## テスト日時
2025-12-25

## テスト内容
USIエンジンが選択されたときに、エンジン名が表示されている状態からURL表示に戻る機能をテストしました。

## テスト結果

### ✅ 成功した点

1. **USIエンジン選択時のURL表示**
   - ✅ USIエンジンを選択すると、`dataset.originalUrl`が保存されている場合はそのURLが表示される
   - ✅ `dataset.originalUrl`が保存されていない場合、現在の値がURL形式ならそれを保持
   - ✅ それ以外の場合はデフォルト値 (`http://localhost:8080`) が使用される

2. **エンジン名表示後の再選択**
   - ✅ エンジン名が表示されている状態でUSIエンジンを再度選択すると、URL表示に戻る
   - ✅ `title`属性がクリアされる（空文字列になる）

3. **URL設定の保持**
   - ✅ 先手: `http://localhost:8082` が正しく設定・保持される
   - ✅ 後手: `http://localhost:8081` が正しく設定・保持される

4. **ShogiServerとの連携**
   - ✅ `server1` (port 8081): 正常に動作
   - ✅ `server2` (port 8082): 正常に動作

## テスト手順

1. ShogiServerを起動（`server1`: 8081, `server2`: 8082）
2. ShogiGameを起動（`http://localhost:8080`）
3. USIエンジンを選択
4. URLを設定（先手: `http://localhost:8082`, 後手: `http://localhost:8081`）
5. エンジン名が表示されるまで待機
6. 人間に変更
7. USIエンジンを再度選択
8. URL表示に戻ることを確認

## 確認事項

- **先手のURL表示**: `http://localhost:8082` ✅
- **後手のURL表示**: `http://localhost:8081` ✅
- **URL表示への復帰**: 正常に動作 ✅
- **`title`属性のクリア**: 正常に動作 ✅

## テスト結果詳細

### エンジン名表示後の再選択テスト

1. **エンジン名を模擬的に設定**
   - 先手: `Suisho5(20211123)-YaneuraOu-v7.5.0 (yaneurao, tayayan)`
   - 後手: `dlshogi (Tadao Yamaoka)`

2. **人間に変更**
   - 先手・後手ともに「人間」に変更

3. **USIエンジンを再度選択**
   - 先手・後手ともに「USIエンジン」に変更

4. **結果**
   - ✅ 先手のURL表示: `http://localhost:8082`
   - ✅ 後手のURL表示: `http://localhost:8081`
   - ✅ `title`属性: 空文字列（クリアされている）

## 結論

USIエンジンが選択されたときに、エンジン名が表示されている状態からURL表示に戻る機能は正常に動作しています。実装したコード（`game.js`の`aiLevelSente`と`aiLevelGote`の`change`イベントハンドラ）が期待通りに機能していることが確認できました。

