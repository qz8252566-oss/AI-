// 読むだけでOK
// config.js の fields と rules から、AI に送るメッセージ（プロンプト）を組み立てます。
// fields を増やせば、ここで作る指示も自動で変わります。

// 項目1つぶんの「どんな値を入れてほしいか」を文章にする
function describeField(field) {
  if (field.type === "number") {
    if (field.min !== undefined && field.max !== undefined) {
      return `${field.min}〜${field.max} の整数`;
    }
    return "整数";
  }
  if (field.maxLength !== undefined) {
    return `${field.maxLength}文字以内の文字`;
  }
  return "文字";
}

// 「次の形の JSON だけを返してください」の部分を作る
function buildJsonInstruction(fields) {
  const lines = [];
  for (const field of fields) {
    lines.push(`  "${field.key}": ${describeField(field)}`);
  }
  return [
    "次の形の JSON だけを返してください。前後に説明文やコードブロックの記号をつけないでください。",
    "{",
    lines.join(",\n"),
    "}",
  ].join("\n");
}

// 「ルール:」の部分を作る
function buildRules(rules) {
  const lines = ["ルール:"];
  for (const rule of rules) {
    lines.push(`- ${rule}`);
  }
  return lines.join("\n");
}

// AI に送るメッセージ一式を作る
// system = AI への役割や指示、user = 受講者が入力した言葉
export function buildMessages(config, word) {
  const parts = [];
  parts.push(`あなたは「${config.title}」の編集者です。`);
  parts.push("ユーザーが送った言葉について、図鑑のデータを作ってください。");

  // 実験用の設定が true のときは、JSON の形の指示を入れない
  if (config.experimentNoJsonInstruction !== true) {
    parts.push("");
    parts.push(buildJsonInstruction(config.fields));
  }

  if (config.rules.length > 0) {
    parts.push("");
    parts.push(buildRules(config.rules));
  }

  return [
    { role: "system", content: parts.join("\n") },
    { role: "user", content: word },
  ];
}
