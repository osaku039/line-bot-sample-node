// Webサーバのライブラリ: Express
import express from 'express';
import crypto from 'crypto';

// 環境変数の定義を.envファイルから読み込む（開発用途用）
import dotenv from 'dotenv';

import { LineApi } from './line-api.mjs';
import { DataStore } from './data-store.mjs';
import { stat } from 'fs';

// .envファイル空環境変数を読み込み
dotenv.config();
// LINEのチャネルシークレットをCHANNEL_SECRET環境変数から読み込み
const CHANNEL_SECRET = process.env.CHANNEL_SECRET;
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;

// expressの初期化
const app = express();
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf
  }
}));
// TCP/8080ポートでサーバを起動
app.listen(8080);


const lineApi = new LineApi(CHANNEL_ACCESS_TOKEN);
const datastore = new DataStore();

// ルートのエンドポイント定義
// レスポンスがきちんと返せているかの確認用
app.get('/', (request, response) => {
  response.status(200).send('Hello');
});

// webhookを受け取るエンドポイントを定義
// POST /webhook
app.post('/webhook', (request, response, buf) => {
  // https://developers.line.biz/ja/docs/messaging-api/receiving-messages/

  // 受け取ったwebhookのイベント
  const body = request.body;
  // デバッグ用として出力
  console.log(body);

  // 署名検証（全くの第三者がリクエストを送ってきたときの対策＝なくても動くが本番環境では大事）
  if (!verifySignature(request.rawBody, request.headers['x-line-signature'], CHANNEL_SECRET)) {
    response.status(401).send({});
    return;
  }

  // 到着したイベントのevents配列から取りだし
  body.events.forEach(async (event) => {
    switch (event.type) {
      case 'message':　// event.typeがmessageのとき応答
        // 頭に　返信: をつけて、そのまま元のメッセージを返す実装
        // await lineApi.replyMessage(event.replyToken, `返信: ${event.message.text}`);
        // break;

        // 状態を持つ実装
        if (event.source.type == "user") {
          const state = await datastore.load(event.source.userId);
          const last_message = state?.last_message || '';
          let current_number = state?.current_number || 0;

          // 形式が`{数字}を追加`に一致する場合は、数字を変更する
          const match = event.message.text.match(/^(-?\d+)を追加$/);
          if (match) {
            const delta = parseInt(match[1], 10);
            current_number += delta;
          }

          // 状態を保存
          await datastore.save(event.source.userId, {
            last_message: event.message.text,
            current_number,
          });

          await lineApi.replyMessage(
            event.replyToken,
            `現在の数字: ${current_number}\n1つ前のメッセージ: ${last_message}`
          );
        }
        break;
    }
  });

  response.status(200).send({});
});

// webhookの署名検証
// https://developers.line.biz/ja/reference/messaging-api/#signature-validation
function verifySignature(body, receivedSignature, channelSecret) {
  const signature = crypto
    .createHmac("SHA256", channelSecret)
    .update(body)
    .digest("base64");
  return signature === receivedSignature;
}