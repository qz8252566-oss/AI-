// 読むだけでOK（チュートリアル05で読みます）
// AI の返事が、プログラムで使える形になっているかをチェックします。
// AI の返事は毎回同じとは限らないので、そのまま使わずに必ず確かめます。

// 返事の文字から、JSON の部分だけを取り出す
function extractJson(text) {
  // 前後の空白と、```json や ``` というコードブロックの記号を取り除く
  let cleaned = text.trim();
  cleaned = cleaned.replaceAll("```json", "");
  cleaned = cleaned.replaceAll("```", "");

  // 最初の { から最後の } までを取り出す（前後に説明文がついていても大丈夫にするため）
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  return cleaned.slice(start, end + 1);
}

// 数字の項目をチェックして直す。直せないときは null を返す
function fixNumber(field, value, fixes) {
  const number = Math.round(Number(value)); // "85" のような文字でも数字に変える
  if (Number.isNaN(number)) {
    return null;
  }
  let fixed = number;
  if (field.min !== undefined && fixed < field.min) fixed = field.min;
  if (field.max !== undefined && fixed > field.max) fixed = field.max;
  if (fixed !== Number(value)) {
    fixes.push(`${field.label} を ${value} から ${fixed} に直した`);
  }
  return fixed;
}

// 文字の項目をチェックして直す
function fixText(field, value, fixes) {
  const text = String(value); // 数字が返ってきても文字として扱う
  if (field.maxLength !== undefined && text.length > field.maxLength) {
    fixes.push(`${field.label} が ${text.length} 文字あったので ${field.maxLength} 文字に切り詰めた`);
    return text.slice(0, field.maxLength);
  }
  return text;
}

// 返事をチェックする
// 結果は { ok: OK かどうか, card: カードのデータ, problems: NG の理由, fixes: 直したところ }
export function checkReply(fields, text) {
  const problems = [];
  const fixes = [];

  const jsonText = extractJson(text);
  if (jsonText === null) {
    problems.push("JSON として読めなかった（{ } が見つからなかった）");
    return { ok: false, card: null, problems: problems, fixes: fixes };
  }

  let data;
  try {
    data = JSON.parse(jsonText); // 文字を JavaScript のデータに変える。形が崩れていると失敗する
  } catch (error) {
    problems.push("JSON として読めなかった");
    return { ok: false, card: null, problems: problems, fixes: fixes };
  }

  // config.js の fields に書いた項目が1つずつそろっているか確かめる
  const card = {};
  for (const field of fields) {
    const value = data[field.key];
    if (value === undefined || value === null || value === "") {
      problems.push(`${field.label} がなかった`);
    } else if (field.type === "number") {
      const fixed = fixNumber(field, value, fixes);
      if (fixed === null) {
        problems.push(`${field.label} が数字ではなかった（${value}）`);
      }
      card[field.key] = fixed;
    } else {
      card[field.key] = fixText(field, value, fixes);
    }
  }

  if (problems.length > 0) {
    return { ok: false, card: null, problems: problems, fixes: fixes };
  }
  return { ok: true, card: card, problems: problems, fixes: fixes };
}
