// 触らなくてOK
// npm start の直前に自動で動き、.env ファイルがあるかを確かめます。
// （.env がないと Node.js が英語のエラーで止まってしまうので、その前に日本語で案内するため）
import { existsSync } from "node:fs";

if (!existsSync(".env")) {
  console.error("");
  console.error("【まだ .env ファイルがありません】");
  console.error(".env.example をコピーして .env を作り、取得したキーを貼ってください。");
  console.error("やり方: ターミナルで  cp .env.example .env  を実行し、できた .env を開いて = の後ろにキーを貼ります。");
  console.error("貼ったら保存して、もう一度  npm start  を実行してください。");
  console.error("");
  process.exit(1);
}
