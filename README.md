# Mandala Chart AI App - Vercelデプロイガイド

このアプリは **Vercel** にデプロイすることで、Google Gemini API を安全に利用できるように設計されています。

## 手順 1: Vercelへのデプロイ

1.  GitHubにこのプロジェクトをプッシュします。
2.  [Vercelのダッシュボード](https://vercel.com/new) にアクセスし、このリポジトリをインポートします。
3.  設定は基本的にデフォルトのままでOKですが、「Framework Preset」が **Vite** になっていることを確認してください。

## 手順 2: 環境変数の設定 (重要！)

AI機能を動かすためには、Vercel上でAPIキーを設定する必要があります。

1.  Vercelのプロジェクト画面で **[Settings]** タブをクリックします。
2.  左メニューから **[Environment Variables]** を選びます。
3.  以下の内容を入力して [Add] をクリックします。

    - **Key**: `GEMINI_API_KEY`
    - **Value**: (あなたのGoogle AI StudioのAPIキー)

4.  設定後、念のため **[Deployments]** タブから最新のデプロイを "Redeploy" するか、新しいコミットをプッシュして再デプロイしてください（環境変数の反映のため）。

## ローカル開発での注意点

ローカル環境 (`npm run dev`) では、通常 `.env` ファイルなどが必要ですが、Vercelの機能を使うため、ローカルでAPIをテストする場合は `vercel dev` コマンドを使うのが一番確実です。

```bash
# 事前にVercel CLIのインストールとログインが必要です
npm i -g vercel
vercel login

# 開発サーバー起動
vercel dev
```

## 使用技術

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Vercel Serverless Functions
- **AI**: Google Gemini API
