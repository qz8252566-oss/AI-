// ★ このファイルは自由に書き換えてOK
// 保存すると、サーバーが自動で再起動します。ブラウザを再読み込みしてください。

export const config = {
  // 図鑑の名前（画面のタイトルに出ます）
  title: "なんでも図鑑",

  // カードにのせる項目
  // type は "text"（文字）か "number"（数字）
  fields: [
    { key: "name",        label: "なまえ",   type: "text" },
    { key: "category",    label: "ぶんるい", type: "text" },
    { key: "power",       label: "つよさ",   type: "number", min: 1, max: 100 },
    { key: "cuteness",    label: "かわいさ", type: "number", min: 1, max: 100 },
    { key: "description", label: "せつめい", type: "text", maxLength: 80 },
  ],

  // AI に追加で守ってほしいルール（1行に1つ）
  rules: [
    "説明は小学生にもわかる言葉で書く",
  ],

  // 0 に近いほど毎回同じような答え、1 に近いほどバラバラな答えになる
  temperature: 0.7,

  // 使うモデル
  model: "gpt-oss-120b",

  // ---- ここから下は、チュートリアル05まで触らなくてOK ----

  // AI の返事が壊れていたとき、何回までやり直すか
  maxRetries: 2,

  // true にすると「JSONで答えて」という指示を外す（壊れた返事を体験するため）
  experimentNoJsonInstruction: false,

  // API の住所
  endpoint: "https://api.ai.sakura.ad.jp/v1/chat/completions",
};
