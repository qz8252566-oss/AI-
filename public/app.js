// 読むだけでOK
// 画面の動きを担当します。ブラウザの中で動くプログラムです。
// ここには APIキーがありません。AI を呼ぶのは、自分のサーバー（server.js）の仕事です。

const form = document.querySelector("#form");
const wordInput = document.querySelector("#word");
const button = document.querySelector("#button");
const message = document.querySelector("#message");
const current = document.querySelector("#current");
const peek = document.querySelector("#peek");
const peekBody = document.querySelector("#peek-body");
const historyList = document.querySelector("#history");
const historyEmpty = document.querySelector("#history-empty");

// ---- 小さな道具 ----

// タグを1つ作り、中に文字を入れる
function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// 文字から色を決める（同じ文字なら、いつも同じ色になる）
function colorFromText(text) {
  let total = 0;
  for (const char of text) {
    total = (total * 31 + char.codePointAt(0)) % 360;
  }
  return `hsl(${total}, 55%, 42%)`;
}

// ---- カードを作る ----

// 数字の項目：ラベル・数字・横棒ゲージ
function makeNumberRow(field, value) {
  const row = makeElement("div", "card-row");
  row.append(makeElement("dt", "", field.label));
  const dd = makeElement("dd", "", String(value));
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  const percent = ((value - min) / (max - min)) * 100;
  const gauge = makeElement("div", "gauge");
  const bar = makeElement("div", "gauge-bar");
  bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  gauge.append(bar);
  dd.append(gauge);
  row.append(dd);
  return row;
}

// 文字の項目：ラベルと値
function makeTextRow(field, value) {
  const row = makeElement("div", "card-row");
  row.append(makeElement("dt", "", field.label));
  row.append(makeElement("dd", "", value));
  return row;
}

function makeCard(card, fields) {
  // 色は「ぶんるい」から決める。なければ「なまえ」から
  const colorSource = card.category ?? card.name ?? "";
  const element = makeElement("article", "card");
  element.style.setProperty("--card-color", colorFromText(colorSource));

  // name の項目があれば、カードの見出しにする
  if (card.name !== undefined) {
    element.append(makeElement("h3", "card-name", card.name));
  }

  const rows = makeElement("dl", "card-rows");
  for (const field of fields) {
    if (field.key === "name") continue;
    if (field.type === "number") {
      rows.append(makeNumberRow(field, card[field.key]));
    } else {
      rows.append(makeTextRow(field, card[field.key]));
    }
  }
  element.append(rows);
  return element;
}

// ---- のぞき窓 ----

function makePre(data) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return makeElement("pre", "", text);
}

function makeList(items) {
  const list = makeElement("ul");
  for (const item of items) {
    list.append(makeElement("li", "", item));
  }
  return list;
}

// 1回ぶんの AI とのやり取り
function makeAttempt(attempt) {
  const box = makeElement("div", "attempt");
  box.append(makeElement("h3", "", `${attempt.number}回目（${(attempt.ms / 1000).toFixed(1)}秒）`));

  if (attempt.error) {
    box.append(makeElement("p", "result-ng", `通信エラー（${attempt.status ?? "つながらない"}）：${attempt.error}`));
    return box;
  }

  box.append(makeElement("p", "", "返ってきたもの（チェックする前の、AI の返事そのまま）"));
  box.append(makePre(attempt.text === "" ? "（空っぽでした）" : attempt.text));

  if (attempt.check.ok) {
    box.append(makeElement("p", "result-ok", "チェック結果：OK"));
  } else {
    box.append(makeElement("p", "result-ng", "チェック結果：NG"));
    box.append(makeList(attempt.check.problems));
  }
  if (attempt.check.fixes.length > 0) {
    box.append(makeElement("p", "", "自動で直したところ："));
    box.append(makeList(attempt.check.fixes));
  }

  if (attempt.usage) {
    const u = attempt.usage;
    box.append(makeElement("p", "", `使ったトークン数：入力 ${u.prompt_tokens} ／ 出力 ${u.completion_tokens} ／ 合計 ${u.total_tokens}`));
  }
  return box;
}

function showLog(log) {
  peekBody.replaceChildren();
  peekBody.append(makeElement("h3", "", "送ったもの"));
  peekBody.append(makeElement("p", "", `送り先：POST ${log.request.url}`));
  peekBody.append(makePre(log.request.headers));
  peekBody.append(makePre(log.request.body));

  // JSON の中では改行が \n になって読みにくいので、AI への指示だけ読みやすく出し直す
  peekBody.append(makeElement("p", "", "上の messages の中の、AI への指示（system）を読みやすくしたもの："));
  peekBody.append(makePre(log.request.body.messages[0].content));

  let totalMs = 0;
  for (const attempt of log.attempts) {
    peekBody.append(makeAttempt(attempt));
    totalMs = totalMs + attempt.ms;
  }
  peekBody.append(makeElement("p", "", `ぜんぶでかかった時間：${(totalMs / 1000).toFixed(1)}秒`));
  peek.hidden = false;
}

// ---- 「つくる」ボタン ----

function setBusy(busy) {
  button.disabled = busy;
  wordInput.disabled = busy;
  if (busy) {
    showMessage("図鑑を書いています…（数秒かかります）", false);
  }
}

function showMessage(text, isError) {
  message.textContent = text;
  message.className = isError ? "message error" : "message";
}

function addToHistory(card, fields) {
  historyEmpty.hidden = true;
  historyList.prepend(makeCard(card, fields));
}

async function requestCard(word) {
  try {
    const response = await fetch("/api/card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: word }),
    });
    return await response.json();
  } catch (error) {
    return { ok: false, error: "サーバーにつながりませんでした。ターミナルで npm start が動いているか確認してください" };
  }
}

async function onSubmit(event) {
  event.preventDefault(); // ページが再読み込みされないようにする
  const word = wordInput.value.trim();
  if (word === "") return;

  setBusy(true);
  const result = await requestCard(word);
  setBusy(false);

  if (result.log) showLog(result.log);
  if (result.ok) {
    showMessage("", false);
    current.replaceChildren(makeCard(result.card, result.fields));
    addToHistory(result.card, result.fields);
  } else {
    current.replaceChildren(); // 前のカードが残っていると、成功したように見えてしまうので消す
    showMessage(result.error, true);
  }
  wordInput.focus();
}

// ---- はじめに1回だけ動く ----

async function loadTitle() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();
    document.querySelector("#title").textContent = data.title;
    document.title = data.title;
  } catch (error) {
    showMessage("サーバーにつながりませんでした。ターミナルで npm start が動いているか確認してください", true);
  }
}

form.addEventListener("submit", onSubmit);
loadTitle();
