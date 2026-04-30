# HI-TOP LP Studio

中古車販売向けランディングページ自動生成アプリ。

## プロジェクト構造

- `apps/web` — React + Vite フロントエンド（管理画面）
- `apps/worker` — Cloudflare Workers バックエンド（Hono）

## コマンド

```bash
# 開発
PATH="/Users/pancho/nodejs/bin:$PATH" npm run dev --workspace=apps/web

# ビルド
PATH="/Users/pancho/nodejs/bin:$PATH" npm run build --workspace=apps/web
PATH="/Users/pancho/nodejs/bin:$PATH" npm run build --workspace=apps/worker

# デプロイ
PATH="/Users/pancho/nodejs/bin:$PATH" npx wrangler pages deploy apps/web/dist --project-name=hitoplp-admin
PATH="/Users/pancho/nodejs/bin:$PATH" npm run deploy --workspace=apps/worker

# Lint
PATH="/Users/pancho/nodejs/bin:$PATH" npx eslint apps/web/src

# テスト
PATH="/Users/pancho/nodejs/bin:$PATH" npm run test --workspace=apps/web
```

## 外部サービス

- **Firebase**: Firestore（車両データ）
- **Cloudflare**: Workers（API）+ Pages（管理画面ホスティング）+ R2（画像/動画ストレージ）
- **Anthropic Claude**: LP文章生成
- **fal.ai**: 画像拡張（nano-banana-pro）+ 動画生成（Kling）
- **ElevenLabs**: ナレーション音声（TTS）
- **Netlify**: LP公開ホスティング
- **Google Analytics 4**: LP アクセス解析（G-95LD1B13QH）

---

# 開発ハーネスルール

## 自動セルフチェック

機能実装が完了したら、必ず reviewer サブエージェント（`.claude/agents/reviewer.md`）を起動してセルフチェックを実行せよ。

### reviewer を起動する条件
- 新規ファイルの作成
- 既存ファイルへの10行以上の変更
- 認証・認可ロジックの変更
- API連携コードの変更（fal.ai, Anthropic, ElevenLabs）

### reviewer をスキップしてよい条件
- コメントの追加・修正のみ
- import文の整理のみ
- 変数名のリネームのみ（5箇所以下）
- プロンプト文言の微調整のみ

### フロー
1. 機能を実装する
2. reviewer を起動する
3. 不合格 → 指摘事項を全て修正 → reviewer を再起動 → 合格するまで繰り返す
4. 合格 → 次の機能に進む

## コーディングルール
- 1ファイル300行以下（超えたら分割が完了するまで次に進むな）
- TypeScript strict モード
- any 型禁止（やむを得ない場合はコメントで理由明記）
- new Date() 単体禁止（タイムゾーン明示必須）
- 空 catch ブロック禁止
- console.log は本番コードに残さない

## スキル参照
- やらかしリスト: `.claude/skills/yarakashi-list/SKILL.md`
- レビュー観点: `.claude/skills/review-checklist/SKILL.md`
