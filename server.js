// 読むだけでOK
// ブラウザと さくらのAI Engine の間に立つ「自分のサーバー」です。
// APIキーはこのサーバーの中だけで使い、ブラウザには渡しません。
import express from "express";
import { spawnSync } from "node:child_process";
import { buildMessages } from "./src/prompt.js";
import { askAI } from "./src/ai.js";
import { checkReply } from "./src/validate.js";

const PORT = 3000;
const MAX_WORD_LENGTH = 30;

// ---- config.js の読み込み ----

// config.js に書き間違いがあると、英語のエラーで止まってしまう。
// そこで先に Node.js の文法チェック（node --check）にかけ、間違いがあれば日本語で知らせる
function checkConfigSyntax() {
  const result = spawnSync(process.execPath, ["--check", "config.js"], { encoding: "utf8" });
  if (result.status === 0) {
    return;
  }
  const found = result.stderr.match(/config\.js:(\d+)/); // エラーの表示から行番号を探す
  console.error("");
  console.error("【config.js の書き方に間違いがあります】");
  if (found) {
    console.error(`${found[1]} 行目か、その1つ前の行を見てください。`);
  }
  console.error("カンマ（,）、かっこ { } [ ]、ダブルクォート \" が抜けていないかを確認します。");
  console.error("直して保存したら、Ctrl + C でサーバーを止めて、もう一度  npm start  を実行してください。");
  console.error("");
  process.exit(1);
}

checkConfigSyntax();
// チェックが終わってから読み込みたいので、ファイル先頭の import 文ではなく、この書き方にしている
const { config } = await import("./config.js");

// ---- 起動時のキーのチェック ----

// キーの形は「UUID:シークレット」（例: 1a2b3c4d-....-....-....-............:abcdef...）
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:\S+$/i;

function checkToken() {
  const token = process.env.SAKURA_AI_TOKEN ?? "";
  if (token.trim() === "") {
    console.error("");
    console.error("【.env にキーが入っていません】");
    console.error(".env を開き、SAKURA_AI_TOKEN= の後ろに取得した受け取ったキーを貼って保存してください。");
    console.error("保存したら、Ctrl + C でサーバーを止めて、もう一度  npm start  を実行してください。");
    console.error("");
    process.exit(1);
  }
  if (!TOKEN_PATTERN.test(token)) {
    // 形が違っても動く可能性はあるので、止めずに注意だけ出す
    console.warn("");
    console.warn(`【注意】キー（${maskToken(token)}）の形がいつもと違うようです。`);
    console.warn("貼り間違い（前後の空白、一部だけ貼った、別の文字が混ざった）がないか確認してください。");
    console.warn("");
  }
}

// キーを伏せ字にする（先頭4文字だけ残す）
function maskToken(token) {
  return token.slice(0, 4) + "****";
}

// ---- 通信の記録（のぞき窓に出す内容）を作る ----

function makeRequestLog(body) {
  return {
    url: config.endpoint,
    headers: {
      "Authorization": `Bearer ${maskToken(process.env.SAKURA_AI_TOKEN)}`,
      "Content-Type": "application/json",
    },
    body: body,
  };
}

function makeAttemptLog(number, reply) {
  return {
    number: number, // 何回目か
    status: reply.status, // 200 なら成功
    text: reply.text, // AI の返事（チェックする前の生の文字）
    finishReason: reply.finishReason,
    usage: reply.usage, // 使ったトークン数
    ms: reply.ms, // かかった時間
    error: reply.error,
    check: null, // チェック結果はあとで入れる
  };
}

// ---- カードを作る ----

// 入力された言葉をチェックする。問題があれば日本語の理由を返す
function checkWord(word) {
  if (word === "") return "言葉を入力してください";
  if (word.length > MAX_WORD_LENGTH) return `${MAX_WORD_LENGTH}文字以内で入力してください`;
  return "";
}

async function makeCard(request, response) {
  const word = String(request.body?.word ?? "").trim();
  const wordProblem = checkWord(word);
  if (wordProblem !== "") {
    response.status(400).json({ ok: false, error: wordProblem });
    return;
  }

  const messages = buildMessages(config, word);
  const log = { request: null, attempts: [] };

  // 最初の1回 ＋ やり直し maxRetries 回まで
  for (let i = 0; i <= config.maxRetries; i++) {
    const reply = await askAI(config, messages);
    log.request = makeRequestLog(reply.body);
    const attempt = makeAttemptLog(i + 1, reply);
    log.attempts.push(attempt);

    // 通信そのものが失敗したときは、やり直さずにすぐ知らせる
    if (reply.error !== "") {
      response.status(502).json({ ok: false, error: reply.error, log: log });
      return;
    }

    attempt.check = checkReply(config.fields, reply.text);
    if (!attempt.check.ok && reply.finishReason === "length") {
      attempt.check.problems.push("返事が長すぎて途中で切れた");
    }
    if (attempt.check.ok) {
      response.json({ ok: true, card: attempt.check.card, fields: config.fields, log: log });
      return;
    }
  }

  const tries = config.maxRetries + 1;
  response.status(502).json({
    ok: false,
    error: `${tries}回やってみましたが、AI の返事をカードにできませんでした。のぞき窓で理由を見てみましょう`,
    log: log,
  });
}

// ---- サーバーの設定 ----

checkToken();

const app = express();
app.use(express.json()); // ブラウザから届いた JSON を読めるようにする
app.use(express.static("public")); // public フォルダの中身（画面）をそのまま配る

// 画面のタイトルを教える
app.get("/api/config", (request, response) => {
  response.json({ title: config.title });
});

// カードを作る
app.post("/api/card", makeCard);

// 思わぬエラーが起きても、サーバーを止めずに日本語で返す
app.use((error, request, response, next) => {
  console.error(error);
  response.status(500).json({ ok: false, error: "サーバーで思わぬエラーが起きました。ターミナルの表示を確認してください" });
});

app.listen(PORT, (error) => {
  // npm start を2回実行すると、ポートが取り合いになって起動できない
  if (error) {
    console.error("");
    console.error(`【ポート ${PORT} がすでに使われています】`);
    console.error("別のターミナルで npm start が動いていないか確認してください。止めるときは、そのターミナルで Ctrl + C を押します。");
    console.error("");
    process.exit(1);
  }
  console.log(`サーバーが起動しました。ポート ${PORT} で待っています。`);
  console.log("Codespaces なら、画面下の「ポート」タブから 3000 番を開いてください。");
});
