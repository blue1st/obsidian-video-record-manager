# 🎬 Video Record Manager for Obsidian

<p align="center">
  <img src="https://img.shields.io/badge/Obsidian-v0.15.0%2B-purple?style=for-the-badge&logo=obsidian" alt="Obsidian Version" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License MIT" />
  <img src="https://img.shields.io/badge/PRs-welcome-green?style=for-the-badge" alt="PRs Welcome" />
</p>

A seamless video status, watching notes, and review manager for [Obsidian](https://obsidian.md) (Movies, Dramas, and Anime). It helps you manage your watching list, track episode-by-episode progress, take detailed video notes, and automatically compile a beautiful directory/dashboard of all your video logs in your vault.

---

### 🌐 Language / 言語
- [English (Current)](#english)
- [日本語 (Japanese)](#japanese)

---

<a name="english"></a>

## English

## ✨ Key Features

- 🎛️ **Unified Control Panel (Ribbon Integration)**
  - Consolidates all commands into **one single sidebar Ribbon icon** that launches a beautiful 2x2 grid Control Panel.
  - Instantly trigger core actions: Add Video, Edit Properties, Toggle Status, or Open the Custom Sidebar Tracker in a single place.
- 🍿 **Visual Video Tracker Sidebar View**
  - Features an interactive custom right-hand sidebar panel showing stats badges for To Watch, Watching, and Watched counts.
  - Displays list of "Currently Watching" items with quick actions.
  - **⏭️ Next Episode Automation (Drama/Anime)**: Click "Next Ep" to automatically mark the current episode as `Watched`, generate the next episode's markdown file with correct metadata, and open it instantly in the editor!
- 🖱️ **File Context Menu Actions**
  - Adds a direct right-click integration on any video file in the File Explorer. Right-click any video note to instantly toggle status or edit properties.
- 📖 **Seamless Video Entry Creation**
  - Add new logs with rich metadata (Title, Type: Movie/Drama/Anime, Series Name, Season, Episode, Director/Creator, Genre, Subgenre, Status).
  - **Movie vs. Series smart fields**: Selecting `Movie` automatically hides series-specific fields, while selecting `Drama` or `Anime` activates them.
- 🔍 **Intelligent Suggestors (Autocomplete & Auto-Increment)**
  - Quickly input metadata using autocomplete suggestions for **Series**, **Director**, **Genre**, and **Subgenre** based on your existing logs.
  - **Smart Increment**: Selecting an existing series automatically detects your latest watched episode (e.g. S01E12) and proposes the next one (S01E13).
- 🔄 **Circular Status Toggle**
  - Cycle through watching statuses (`To Watch` ➡️ `Watching` ➡️ `Watched`) instantly via commands, ribbon icon, or custom hotkey.
  - Automatically logs the **completion date** (`end_date`) as a frontmatter property when marked as `Watched`.
- ✏️ **Dynamic Property Editor & Renamer**
  - Edit existing video details in an intuitive modal.
  - **Auto-Rename/Move**: If you change the Series name, the plugin automatically renames and moves the `.md` file to the correct subfolder (e.g. `Videos/My Series Name/`) to keep your library organized.
- 📊 **Master Video List Dashboard**
  - Automatically compiles and updates a centralized dashboard list at `Videos/Master Video List.md`.
  - Includes real-time statistics (Total Videos, To Watch, Watching, Watched) categorized by Movies, Dramas, and Anime.
  - Renders a clean Markdown table with colorful HTML badges for statuses and types.
- 👻 **Archiving / Hidden Watched Filter**
  - Keep your dashboard clean. Automatically hides completed videos from the directory table after a configurable number of days (default: 7 days), leaving only active logs.
- ⚡ **Metadata Cache Watcher**
  - Updates the Master Video List automatically in the background whenever a video's properties are updated.

---

## 📂 Vault Directory Structure

The plugin automatically organizes your notes within a parent directory named `Videos/`:

```text
vault-root/
└── Videos/
    ├── Master Video List.md             # The auto-generated dashboard
    ├── Inception.md                     # Individual standalone movies
    └── Breaking Bad/                    # Subfolder generated automatically for series
        ├── Breaking Bad S01E01.md       # Structured episode note file
        └── Breaking Bad S01E02.md
```

Each video file is created with standard Markdown frontmatter and template structures:

```yaml
---
title: "Breaking Bad S01E01"
type: "Drama"
status: "Watching"
director: "Vince Gilligan"
series: "Breaking Bad"
season: "01"
episode: "01"
genre: "Crime"
subgenre: "Drama"
updated: 2026-05-08 22:00
---

## Watching Notes

- 

## Final Review


```

---

## ⚙️ Plugin Settings

- **Enable Hide Watched**: Toggle whether watched videos should be hidden from the directory list.
- **Hide Watched Days**: Specify the threshold of days after which a watched video is hidden from the directory (default is `7` days).

---

## 🛠️ Installation

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. In your Obsidian vault, go to `.obsidian/plugins/` (create the folder if it doesn't exist).
3. Create a folder named `video-record-manager`.
4. Move `main.js`, `manifest.json`, and `styles.css` into that folder.
5. Reload community plugins in Obsidian and toggle on **Video Record Manager**.

---

## 🧑‍💻 Development

If you want to compile and build the plugin locally:

### Clone & Install
```bash
git clone <your-repo-url>
cd video-record-manager
npm install
```

### Dev Mode (Watcher)
Runs esbuild in watch mode to automatically compile files when they change:
```bash
npm run dev
```

### Production Build
Compiles TypeScript and bundles styles for release:
```bash
npm run build
```

---

<br />
<hr />
<br />

<a name="japanese"></a>

## 日本語 (Japanese)

## ✨ 主な機能

- 🎛️ **統合コントロールパネル（リボンアイコンの集約）**
  - すべての操作をサイドバーの**1つのビデオカメラ・リボンアイコン**に集約。クリックすると美しく整列された2×2グリッド形式の「コントロールパネル」が開きます。
  - 動画追加、情報編集、ステータスの切り替え、カスタムサイドバーの起動などを1クリックで直感的に選択・起動できます。
- 🍿 **ビジュアル動画トラッカー（サイドバービュー）**
  - 画面右側のサイドバーに、未視聴・視聴中・視聴完了の統計数が一目でわかる美しいバッジ表示。
  - 「視聴中」の動画がリストアップされ、チェックボタンでの視聴完了切り替えや、ワンクリックでの動画ノート開封が可能です。
  - **⏭️ 次話自動生成 (ドラマ/アニメ)**: 「Next Ep」ボタンをクリックするだけで、現在見ている話を `Watched`（完了）にし、自動で次の話数（例: S01E13）のMarkdownノートを正しいフォルダ構造で自動生成し、エディタで瞬時に開くことができます！
- 🖱️ **ファイル右クリックコンテキストメニュー統合**
  - ファイルエクスプローラー（またはエディタタイトル）上の動画ファイルを右クリックするだけで、ステータスの切り替えや動画プロパティの編集モーダルを瞬時に呼び出せます。
- 📖 **スムーズな動画追加**
  - タイプ（映画/ドラマ/アニメ）、タイトル、シリーズ名、シーズン、話数、監督、ジャンル、サブジャンルを入力して動画用のMarkdownノートを簡単に新規作成。
  - **スマートフィールド**: `Movie`（映画）を選択するとシリーズ情報などの不要なフィールドが自動的に非表示になり、`Drama` や `Anime` の時だけ自動展開されます。
- 🔍 **インテリジェントなサジェスト（自動補完 & 話数自動インクリメント）**
  - 既に作成したデータベースから、**シリーズ**、**監督**、**ジャンル**、**サブジャンル**を検出してリアルタイムで補完候補を提示します。
  - **最新話の自動検出**: サジェストから既存のシリーズを選択すると、自動的に最後に見た話数（例: S01E12）を検出し、次の話数（S01E13）を予測して入力欄にセットします。
- 🔄 **視聴ステータスのワンクリックトグル**
  - ステータス（`未視聴 (To Watch)` ➡️ `視聴中 (Watching)` ➡️ `視聴完了 (Watched)`）を、リボンアイコンやカスタムショートカットキーから瞬時に循環切り替え。
  - `視聴完了 (Watched)` に切り替えると、自動的に完了日（`end_date`）がプロパティに自動追加されます。
- ✏️ **動画プロパティの編集と自動リネーム・移動**
  - 作成済みの動画ノートのプロパティを専用モーダルから簡単に再編集。
  - シリーズ名を編集すると、フォルダ構成に合わせて**自動的にファイルをリネームし、適切なシリーズフォルダへ自動移動**します。
- 📊 **動画ダッシュボード (Master Video List)**
  - `Videos/Master Video List.md` に、映画・ドラマ・アニメのすべての動画を一覧できるダッシュボードを自動生成。
  - 全体の統計（合計数、未視聴数、視聴中、視聴完了数）をMovie, Drama, Anime別にリアルタイムに集計。
  - 各ステータスやコンテンツタイプをカラフルなHTMLバッジ付きで一覧表（Markdown Table）として整理。
- 👻 **アーカイブ機能 (視聴完了フィルター)**
  - 視聴完了後指定日数（デフォルトは7日）が経過した動画を自動的に一覧から非表示にし、現在見ている作品や未視聴の作品に集中可能。オンオフや表示期間は設定タブから変更可能。
- ⚡ **自動同期機能 (Metadata Cache Watcher)**
  - 動画のノートのプロパティをエディタ上で手動変更した場合も、変更イベントを監視して自動的にダッシュボードの一覧を最新に同期します。

---

## 📂 フォルダ構成

本プラグインは、作成した動画ファイルを自動的に `Videos/` フォルダ配下へ構造化して整理します：

```text
vault-root/
└── Videos/
    ├── Master Video List.md             # 自動生成されるダッシュボード
    ├── タイタニック.md                     # シリーズ設定のない単発の映画
    └── 呪術廻戦/                          # シリーズ名に応じて自動作成されるフォルダ
        ├── 呪術廻戦 S01E01.md            # 構造化されたエピソードごとのファイル
        └── 呪術廻戦 S01E02.md
```

作成されるファイルには標準のフロントマターと、ノート用見出しがテンプレートとして組み込まれます：

```yaml
---
title: "呪術廻戦 S01E01"
type: "Anime"
status: "Watching"
director: "朴性厚"
series: "呪術廻戦"
season: "01"
episode: "01"
genre: "ダークファンタジー"
subgenre: "バトル漫画"
updated: 2026-05-08 22:00
---

## Watching Notes

- 

## Final Review


```

---

## ⚙️ 設定項目

- **Enable Hide Watched (視聴完了本を非表示にする)**: 視聴完了した作品をダッシュボード一覧から隠すかどうかを指定します。
- **Hide Watched Days (非表示にするまでの日数)**: 作品が視聴完了になってからダッシュボード上で非表示（アーカイブ）にするまでの経過日数を指定します（デフォルト: `7` 日）。

---

## 🛠️ インストール方法

1. 最新リリースから `main.js`, `manifest.json`, `styles.css` をダウンロードします。
2. Obsidian の保管庫（Vault）のルートにある `.obsidian/plugins/` フォルダを開きます。
3. `video-record-manager` という名前のフォルダを新規作成します。
4. ダウンロードした3つのファイルをそのフォルダの中に配置します。
5. Obsidian の設定の「コミュニティプラグイン」から「プラグインの再読み込み」を押し、**Video Record Manager** を有効化（ON）にします。

---

## 🧑‍💻 開発方法

ローカルでビルドやソースコードの修正を行う場合：

### 環境構築
```bash
git clone <リポジトリのURL>
cd video-record-manager
npm install
```

### 開発モード (コードの監視ビルド)
コードの変更を自動で検知してコンパイルするウォッチャーを起動します：
```bash
npm run dev
```

### 本番用ビルド
TypeScriptをコンパイルし、配布用のバンドルファイルを生成します：
```bash
npm run build
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
