// 触らなくてOK
// src/validate.js のテストです。npm test で実行します。
// config.js を書き換えてもテストが壊れないよう、項目はここで別に用意しています。
// 「実物」とついたケースは、さくらのAI Engine から実際に返ってきた返事をもとにしています。
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkReply } from "../src/validate.js";

const fields = [
  { key: "name", label: "なまえ", type: "text" },
  { key: "category", label: "ぶんるい", type: "text" },
  { key: "power", label: "つよさ", type: "number", min: 1, max: 100 },
  { key: "description", label: "せつめい", type: "text", maxLength: 10 },
];

const good = { name: "たこ焼き", category: "たべもの", power: 40, description: "まるい" };

test("きれいな JSON はそのまま OK", () => {
  const result = checkReply(fields, JSON.stringify(good));
  assert.equal(result.ok, true);
  assert.deepEqual(result.card, good);
  assert.deepEqual(result.fixes, []);
});

test("```json のコードブロックで囲まれていても OK", () => {
  const text = "```json\n" + JSON.stringify(good, null, 2) + "\n```";
  assert.equal(checkReply(fields, text).ok, true);
});

test("前後に説明文がついていても OK", () => {
  const text = "はい、図鑑のデータです。\n" + JSON.stringify(good) + "\nいかがでしょうか？";
  assert.equal(checkReply(fields, text).ok, true);
});

test("実物：gpt-oss-120b の正常な返事（改行・字下げつき）は OK", () => {
  const text = '{\n  "name": "たこ焼き",\n  "category": "食べ物",\n  "power": 70,\n  "cuteness": 85,\n  "description": "外はカリッと、内はとろ～な丸いおやつ。"\n}';
  assert.equal(checkReply(fields, text).ok, true);
});

test("実物：JSON の指示を外したときの表形式の返事は NG", () => {
  const text = "**たこ焼き（たこやき）**  \n\n| 項目 | 内容 |\n|------|------|\n| **なにもの？** | 小さく丸い形をした、熱々の粉もの料理です。 |";
  const result = checkReply(fields, text);
  assert.equal(result.ok, false);
  assert.match(result.problems[0], /JSON として読めなかった/);
});

test("実物：system の指示に従わず、ふつうの文章で答えたモデルの返事は NG", () => {
  const text = "たこ焼きは、日本の大阪発祥の伝統的なストリートフードです。\n\n1. 材料:\n   - 小麦粉\n   - タコの切り身";
  assert.equal(checkReply(fields, text).ok, false);
});

test("実物：max_tokens が足りず本文が空（content が null）のときは NG", () => {
  // ai.js は content が null のとき "" にして渡す
  assert.equal(checkReply(fields, "").ok, false);
});

test("途中で切れた JSON は NG", () => {
  const text = '{"name": "たこ焼き", "category": "たべもの", "power": 40, "descr';
  assert.equal(checkReply(fields, text).ok, false);
});

test("カンマの抜けなどで形が崩れた JSON は NG", () => {
  const text = '{"name": "たこ焼き" "category": "たべもの"}';
  const result = checkReply(fields, text);
  assert.equal(result.ok, false);
  assert.deepEqual(result.problems, ["JSON として読めなかった"]);
});

test("項目が足りないと、足りない項目のラベルが理由に入る", () => {
  const text = JSON.stringify({ name: "たこ焼き", category: "たべもの" });
  const result = checkReply(fields, text);
  assert.equal(result.ok, false);
  assert.deepEqual(result.problems, ["つよさ がなかった", "せつめい がなかった"]);
});

test("項目名を英語以外で返してきたら NG", () => {
  const text = JSON.stringify({ なまえ: "たこ焼き", ぶんるい: "たべもの", つよさ: 40, せつめい: "まるい" });
  assert.equal(checkReply(fields, text).ok, false);
});

test("範囲外の数字は NG にせず min〜max に直す", () => {
  const result = checkReply(fields, JSON.stringify({ ...good, power: 150 }));
  assert.equal(result.ok, true);
  assert.equal(result.card.power, 100);
  assert.equal(result.fixes.length, 1);
  assert.equal(checkReply(fields, JSON.stringify({ ...good, power: 0 })).card.power, 1);
});

test("小数は整数に、文字の数字は数字に直す", () => {
  assert.equal(checkReply(fields, JSON.stringify({ ...good, power: 42.6 })).card.power, 43);
  const result = checkReply(fields, JSON.stringify({ ...good, power: "85" }));
  assert.equal(result.card.power, 85);
  assert.deepEqual(result.fixes, []);
});

test("数字にできない値は NG", () => {
  const result = checkReply(fields, JSON.stringify({ ...good, power: "とても強い" }));
  assert.equal(result.ok, false);
  assert.match(result.problems[0], /つよさ が数字ではなかった/);
});

test("長すぎる文字は maxLength で切り詰める", () => {
  const result = checkReply(fields, JSON.stringify({ ...good, description: "あいうえおかきくけこさしすせそ" }));
  assert.equal(result.ok, true);
  assert.equal(result.card.description, "あいうえおかきくけこ");
});

test("文字の項目に数字が返ってきたら文字にする", () => {
  assert.equal(checkReply(fields, JSON.stringify({ ...good, name: 7 })).card.name, "7");
});

test("fields にない余分な項目はカードに入れない", () => {
  const result = checkReply(fields, JSON.stringify({ ...good, extra: "おまけ" }));
  assert.equal(result.card.extra, undefined);
});
