// Webサーバのライブラリ: Express
import express from 'express';
import crypto from 'crypto';

// 環境変数の定義を.envファイルから読み込む（開発用途用）
import dotenv from 'dotenv';

import { LineApi } from './line-api.mjs';
import { DataStore } from './data-store.mjs';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { readFileSync } from 'fs';

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

app.get('/', async (request, response, buf) => {

  const authHeader = request.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const template = readFileSync('results.html').toString();
    let html = template.replaceAll("$LIFF_ID", `'${process.env.LIFF_ID_MYLOG}'`);

    const idToken = authHeader.substring(7);
    const verifyResponse = await lineApi.verify(idToken, process.env.CHANNEL_ID);
    if (verifyResponse.status === 200) {
      const userProfile = verifyResponse.data;
      console.log('User Profile:', userProfile);

      html = html.replaceAll('$USER_NAME', userProfile.name);

      console.log(userProfile.sub);
      const state = await datastore.load(userProfile.sub);
      console.log(state);
      //もしstate['logs']が存在すればその値を、存在しなければからの配列をlogsに代入している。
      const logs = state['logs'] || [];
      console.log(logs);

      const totalBooks = logs.length;
      const wins = logs.filter(r => r.result === "負け").length;  // ユーザーの勝利はBOTの負け
      const losses = logs.filter(r => r.result === "勝ち").length;  // ユーザーの敗北はBOTの勝ち

      html = html.replace('$TOTAL_BOOKS', totalBooks);
      html = html.replace('$WINS', wins);
      html = html.replace('$LOSSES', losses);

      console.log(totalBooks);

      if (logs.length >= 0) {
        html = html.replace(
          '$LOGS',
          logs.map((result => {
            const resultClass = result.result === "負け" ? "text-green-600" : (result.result === "勝ち" ? "text-red-600" : "text-yellow-600");
            return `
              <div class="bg-gray-50 p-4 rounded-lg">
                <p class="font-semibold ${resultClass}">${result.result === "負け" ? "勝利" : (result.result === "勝ち" ? "敗北" : "引き分け")}</p>
                <p>YourHands: ${result.userHand} / BOT'sHands: ${result.botHand}</p>
                <p class="text-sm text-gray-500">${result.createdAt}</p>
              </div>
            `;
          })).join('\n')
        );
      } else {
        html = html.replace('$LOGS', '<p class="text-gray-500">enoughだよー</p>');
      }

      response.status(200).send(html);
    }
  } else {
    const template = readFileSync('loading.html').toString();
    let html = template.replaceAll("$LIFF_ID", `'${process.env.LIFF_ID_MYLOG}'`);

    response.status(200).send(html);
  }
});

const userState = {};
let bookTitle = "";
let bookUrl = "";
let bookImpressions = "";
let bookLog = false;
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
      case 'message': // event.typeがmessageのとき応答
        if (event.source.type == "user") {
          const userId = event.source.userId;
          const usermessage = event.message.text;

          if (usermessage == "記録"){
            userState[userId] = "StertRecord"
            bookLog = true;
          }
          if (bookLog == true){
            await myLog(usermessage, userId, event);
          }        
          
        }
      }
    }
)}
)

async function myLog(usermessage, userId, event){
  switch(userState[userId]){
    case 'StertRecord':
      userState[userId] = "WatingTitle"
      await lineApi.replyMessage(
        event.replyToken,
        "題名は？"
      );
    break;
    
    case 'WatingTitle':
      bookTitle = usermessage;
      userState[userId] = "WatingisDigital"
      await lineApi.replyBotton(
        event.replyToken,
        "web本ですか？"
      )
    break;
    
    case "WatingisDigital":
      if (usermessage == "はい"){
        userState[userId] = "WatingURL";
        await lineApi.replyMessage(
          event.replyToken,
          "URLを記入してください"
        )
      }else if (usermessage == "いいえ"){
        userState[userId] = "WatingImpressions"
        await lineApi.replyMessage(
          event.replyToken,
          "感想をどうぞ"
        )
      }
    break;

    case "WatingURL":
      bookUrl = usermessage;
      userState[userId] = "WatingImpressions"
      await lineApi.replyMessage(
        event.replyToken,
        "感想をどうぞ"
      )
    break;

    case "WatingImpressions":
      bookImpressions = usermessage;
      userState[userId] = "LogEnd"
      bookLog = false;
      const state = await datastore.load(userId);
      await datastore.save(userId, {
        BookLog: [
              {
                bookTitle,
                bookUrl,
                bookImpressions,
                createdAt: formatDate(Date.now()),
              },
              ...(state['logs'] ?? []),
            ],
          });
      await lineApi.replyMessage(
        event.replyToken,
        "記録したよ"
      )
    break;
  }  
}




          // // BOTの手を選ぶ
          // const botHand = ["グー", "チョキ", "パー"][Math.floor(Math.random() * 3)];
          // const userHand = event.message.text;s

          // // 勝ち負け判定
          // const result = judge(botHand, userHand)

          // // 戦績を保存
          // const state = await datastore.load(userId);
          // console.log(userId);
          // await datastore.save(userId, {
          //   logs: [
          //     {
          //       result,
          //       botHand,
          //       userHand,
          //       createdAt: formatDate(Date.now()),
          //     },
          //     ...(state['logs'] ?? []),
          //   ],
          // });

          // 返信
//           await lineApi.replyMessage(
//             event.replyToken,
//             createReplyText(result, botHand),
            
//           );
//         }
//         break;
//     }
//   });

//   response.status(200).send({});
// });

// function createReplyText(result, botHand) {
//   const handEmoji = {
//     'グー': '✊',
//     'チョキ': '✌️',
//     'パー': '🖐️'
//   };

//   const baseMessage = `BOTの手は${handEmoji[botHand]}${botHand}でした！\n`;

//   switch (result) {
//     case "勝ち":
//       return baseMessage + "BOTの勝ちです！😆 次は勝てるかな？";
//     case "負け":
//       return baseMessage + "あなたの勝ちです！🎉 さすがですね！";
//     case "引き分け":
//       return baseMessage + "引き分けです！😮 もう一回勝負しましょう！";
//     default:
//       return "手は「グー」「チョキ」「パー」の中から選んでね！";
//   }
// }

// //勝ち負けの判定
// function judge(myHand, otherHand) {
//   const validHands = ['グー', 'チョキ', 'パー'];
//   const winCombos = {
//     'グー': 'チョキ',
//     'チョキ': 'パー',
//     'パー': 'グー'
//   };

//   // 有効な手かどうかをチェック
//   if (!validHands.includes(myHand) || !validHands.includes(otherHand)) {
//     return null;
//   }

//   //手が同じだったら引分け。キーがwinCombosと同じだったら勝ちとか負けとかやる
//   if (myHand === otherHand) return "引き分け";
//   return winCombos[myHand] === otherHand ? "勝ち" : "負け";
// }

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
}

// // webhookの署名検証
// // https://developers.line.biz/ja/reference/messaging-api/#signature-validation
function verifySignature(body, receivedSignature, channelSecret) {
  const signature = crypto
    .createHmac("SHA256", channelSecret)
    .update(body)
    .digest("base64");
  return signature === receivedSignature;
}
