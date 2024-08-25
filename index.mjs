// Webサーバのライブラリ: Express
import express from 'express';
import crypto from 'crypto';

// 環境変数の定義を.envファイルから読み込む（開発用途用）
import dotenv from 'dotenv';

import { SearchBooks } from './search-books.mjs';
import { LineApi } from './line-api.mjs';
import { FesLiff } from './fes-liff.mjs';
import { ShowMyLogsLiff } from './show-mylogs.mjs';
import { ShowAllLogsLiff } from './show-all-logs.mjs';
import { DataStore } from './data-store.mjs';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { readFileSync } from 'fs';
import { log } from 'console';

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
const fesLiff = new FesLiff();
const showMyLogs = new ShowMyLogsLiff();
const showAllLogs = new ShowAllLogsLiff();
const datastore = new DataStore();
// const serchBooks = new SearchBooks();


app.get('*', async (request, response) => {
  const path = request.path;
  // const liffState = request.query['liff.state'];
  // console.log(liffState);  // '/showMyLog' が表示される  
  //console.log(request);
  //console.log(response);
  //console.log(path2);  // '/?liff.state=%2FshowMyLog' が表示される
  //console.log(path);


  switch (path) {
    case '/showMyLog':
      console.log("showmylog");
      await showMyLogs.myLogs(request, response, datastore);
      break;

    case '/fes':
      console.log("fesliff");
      await fesLiff.fes(request, response, datastore);
      break;

    case '/showAllLog':
      console.log("showAllLog");
      await showAllLogs.allLogs(request, response, datastore);
      break;
    
    case '/':
      console.log("fesliff");
      await fesLiff.fes(request, response, datastore);
      break;

    case '/vote':
      console.log("vote");
      await datastore.vote(request.headers.vote_result);
      break;

    default:
      console.log("other");
      response.status(404).send('Not Found');
  }
});


const userState = {};
let bookTitle = "";
let bookUrl = "";
let bookImpressions = "";
let bookLog = false;
let bookCover = "";
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
      break;
      case "postback":
        if (event.source.type == "user") {
          const userId = event.source.userId;
          const data = new URLSearchParams(event.postback.data);
          bookTitle = data.get('title');
          bookCover = decodeURIComponent(data.get('image'));

          userState[userId] = "WatingImpressions"
          await lineApi.replyMessage(
            event.replyToken,
            "感想をどうぞ"
          )
        }
        break;
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
        bookCover = "https://i.ibb.co/1np5tmC/25480354.png";
        await lineApi.replyMessage(
          event.replyToken,
          "URLを記入してください"
        )
      }else if (usermessage == "いいえ"){
        console.log("とりまここ")

        const items = await SearchBooks(bookTitle);

        const columns = items.map(item => ({
          thumbnailImageUrl: item.image.replace('http://', 'https://'),
          imageBackgroundColor: "#FFFFFF",
          title:  item.title.length > 20 ? item.title.slice(0, 17) + '...' : item.title,
          text: "Book Cover",
          defaultAction: {
            "type": "postback",
            "label": "表紙はこれ！",
            "data": `title=${item.title}&image=${encodeURIComponent(item.image.replace('http://', 'https://'))}`
          },
          actions: [
            {
              "type": "postback",
              "label": "表紙はこれ！",
              "data": `title=${item.title}&image=${encodeURIComponent(item.image.replace('http://', 'https://'))}`
            }
          ]
        }));
        columns.push({
          thumbnailImageUrl: "https://i.ibb.co/1np5tmC/25480354.png",
          imageBackgroundColor: "#FFFFFF",
          title: bookTitle,
          text: "Book Cover",
          defaultAction: {
            type: "postback",
            label: "表紙みつからなかった",
            data: `title=${bookTitle}&image=${encodeURIComponent("https://i.ibb.co/1np5tmC/25480354.png")}`
          },
          actions: [
            {
              type: "postback",
              label: "表紙みつからなかった",
              data: `title=${bookTitle}&image=${encodeURIComponent("https://i.ibb.co/1np5tmC/25480354.png")}`
            }
          ]
        });
        await lineApi.replyBookCover(
          event.replyToken,
          columns,
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
                bookCover,
                createdAt: formatDate(Date.now()),
              },
              ...(state['BookLog'] ?? []),
            ],
          });
      await datastore.save_global({
        BookLog: [
              {
                bookTitle,
                bookUrl,
                bookImpressions,
                bookCover,
                createdAt: formatDate(Date.now()),
              },
            ],
          });
      await lineApi.replyMessage(
        event.replyToken,
        "記録したよ"
      )
    break;
  }  
}

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

