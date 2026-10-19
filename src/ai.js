// 読むだけでOK（チュートリアル02で読みます）
// さくらのAI Engine に「質問」を送り、「返事」を受け取る部分です。

// 返事の長さの上限（AI が考える分も含む）。小さすぎると返事が途中で切れます
// 実測では 1 回 400〜600 ほど使い、200 にすると本文が空になりました
const MAX_TOKENS = 3000;

// async は「この関数の中に、終わるまで時間がかかる処理がある」という印です。
// AI の返事が届くまでには数秒かかります。async をつけた関数の中では await が使えて、
// 「返事が届くまでここで待ち、届いたら次の行へ進む」と書けます。
// 待っている間もサーバーは止まらず、ほかの人からの注文を受け付けられます。
export async function askAI(config, messages) {
  const startTime = Date.now(); // かかった時間を測り始める
  const body = {
    model: config.model, // どの AI を使うか
    messages: messages, // AI への指示と、入力された言葉
    temperature: config.temperature, // 答えのバラつき具合
    max_tokens: MAX_TOKENS,
  };
  const result = { body: body, status: null, text: "", usage: null, finishReason: null, error: "" };

  try {
    // API の住所に、POST という方法でデータを送る
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.SAKURA_AI_TOKEN}`, // 自分を証明するキー
        "Content-Type": "application/json", // 送るのは JSON という形のデータです、という印
      },
      body: JSON.stringify(body), // JavaScript のデータを JSON の文字に変える
    });
    result.status = response.status; // 200 なら成功、それ以外は何かの失敗
    if (response.ok) {
      const data = await response.json(); // 返ってきた JSON を JavaScript のデータに戻す
      result.text = data.choices[0].message.content ?? ""; // AI の返事の本文
      result.finishReason = data.choices[0].finish_reason; // "length" なら途中で切れた
      result.usage = data.usage; // 使ったトークン数
    } else {
      result.error = toJapanese(response.status);
    }
  } catch (error) {
    result.error = "AI のサーバーにつながりませんでした。もう一度押してください";
  }

  result.ms = Date.now() - startTime; // かかった時間（ミリ秒。1000 で 1 秒）
  return result;
}

// 失敗したときの番号（ステータスコード）を、日本語の案内に変える
function toJapanese(status) {
  if (status === 401 || status === 403) return "キーが正しくないようです。.env を確認してください";
  if (status === 429) return "混み合っています。少し待ってからもう一度押してください";
  if (status === 400 || status === 404) return "AI が受け付けてくれませんでした。config.js の model の名前を確認してください";
  return "AI のサーバーにつながりませんでした。もう一度押してください";
}
