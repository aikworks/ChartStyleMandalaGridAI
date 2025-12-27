# GitHub連携ガイド

プロジェクトは手元で「Gitの準備（初期化とコミット）」まで完了させました。
あとは、インターネット上のGitHubに「箱（リポジトリ）」を作って、そこへ送るだけです。

以下の3ステップを行ってください。

## ステップ 1: GitHubでリポジトリを作る
1. ブラウザで [GitHub](https://github.com/new) を開きます。
2. **Repository name** に `MandalaChartApp` と入力します。
3. 他の設定（Public/Privateなど）は好みで選びます（Private推奨）。
4. **"Initialize this repository with..." のチェックは全て外したままにします**（重要）。
5. **[Create repository]** ボタンを押します。

## ステップ 2: コマンドをコピーする
作成後の画面に、いくつかコマンドが表示されます。
**「…or push an existing repository from the command line」** というセクションを探してください。
そこにある3行ほどのコマンドを使います。通常は以下のようになっています：

```bash
git remote add origin https://github.com/[あなたのユーザー名]/MandalaChartApp.git
git branch -M main
git push -u origin main
```

## ステップ 3: コマンドを実行する
このチャットに戻り、**「ステップ2」でコピーしたコマンドを貼り付けて送信してください。**
私が代わりに実行します。

---
※もしご自身でターミナルで実行される場合は、`MandalaChartApp` フォルダ内で実行してください。
