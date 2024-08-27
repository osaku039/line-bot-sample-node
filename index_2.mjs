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
      await datastore.voting(request.headers.vote_result);
      console.log("yeah");
      
      break;

    default:
      console.log("other");
      response.status(404).send('Not Found');
  }
});

const userState = {};  // 各ユーザーの状態を保持するオブジェクト
const userBookData = {};  // 各ユーザーの書籍データを保持するオブジェクト

// webhookを受け取るエンドポイント
app.post('/webhook', async (request, response) => {
  const body = request.body;

  // 署名検証
  if (!verifySignature(request.rawBody, request.headers['x-line-signature'], CHANNEL_SECRET)) {
    response.status(401).send({});
    return;
  }

  body.events.forEach(async (event) => {
    const userId = event.source.userId;

    if (!userState[userId]) {
      userState[userId] = "StertRecord";  // ユーザーの初期状態を設定
      userBookData[userId] = {};  // ユーザーの書籍データを初期化
    }

    switch (event.type) {
      case 'message':
        if (event.source.type == "user") {
          const usermessage = event.message.text;

          if (usermessage == "記録") {
            userState[userId] = "StertRecord";
            userBookData[userId] = {}; 
            await myLog(usermessage, userId, event);
          } else if (userState[userId]) {
            await myLog(usermessage, userId, event);
          }
        }
        break;

      case "postback":
        if (event.source.type == "user") {
          const data = new URLSearchParams(event.postback.data);
          userBookData[userId].title = data.get('title');
          userBookData[userId].cover = decodeURIComponent(data.get('image'));

          userState[userId] = "WatingImpressions";
          await lineApi.replyMessage(
            event.replyToken,
            "感想をどうぞ"
          );
        }
        break;
    }
  });

  response.sendStatus(200); // LINEのAPIに対してリクエストが成功したことを伝える
});

async function myLog(usermessage, userId, event) {
  switch (userState[userId]) {
    case 'StertRecord':
      userState[userId] = "WatingTitle";
      await lineApi.replyMessage(
        event.replyToken,
        "題名は？"
      );
      break;

    case 'WatingTitle':
      userBookData[userId].title = usermessage;
      userState[userId] = "WatingisDigital";
      await lineApi.replyBotton(
        event.replyToken,
        "web本ですか？"
      );
      break;

    case "WatingisDigital":
      if (usermessage == "はい") {
        userState[userId] = "WatingURL";
        userBookData[userId].cover = "https://i.ibb.co/1np5tmC/25480354.png";
        await lineApi.replyMessage(
          event.replyToken,
          "URLを記入してください"
        );
      } else if (usermessage == "いいえ") {
        const items = await SearchBooks(userBookData[userId].title);
        userBookData[userId].url = ""

        const columns = items.map(item => ({
          thumbnailImageUrl: item.image.replace('http://', 'https://'),
          imageBackgroundColor: "#FFFFFF",
          title: item.title.length > 20 ? item.title.slice(0, 17) + '...' : item.title,
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
          title: userBookData[userId].title,
          text: "Book Cover",
          defaultAction: {
            type: "postback",
            label: "表紙みつからなかった",
            data: `title=${userBookData[userId].title}&image=${encodeURIComponent("https://i.ibb.co/1np5tmC/25480354.png")}`
          },
          actions: [
            {
              type: "postback",
              label: "表紙みつからなかった",
              data: `title=${userBookData[userId].title}&image=${encodeURIComponent("https://i.ibb.co/1np5tmC/25480354.png")}`
            }
          ]
        });
        await lineApi.replyBookCover(
          event.replyToken,
          columns,
        );
      }
      break;

    case "WatingURL":
      userBookData[userId].url = usermessage;
      userState[userId] = "WatingImpressions";
      await lineApi.replyMessage(
        event.replyToken,
        "感想をどうぞ"
      );
      break;

    case "WatingImpressions":
      userBookData[userId].impressions = usermessage;
      userState[userId] = "LogEnd";

      const state = await datastore.load(userId);
      console.log("userBookData[userId].url = " + userBookData[userId].url)
      // if (userBookData[userId].url == "undefined"){
      //   userBookData[userId].url = "";
      // }
      await datastore.save(userId, {
        BookLog: [
          {
            bookTitle: userBookData[userId].title,
            bookUrl: userBookData[userId].url,
            bookImpressions: userBookData[userId].impressions,
            bookCover: userBookData[userId].cover,
            createdAt: formatDate(Date.now()),
          },
          ...(state['BookLog'] ?? []),
        ],
      });

      await datastore.save_global({
        BookLog: [
          {
            bookTitle: userBookData[userId].title,
            bookUrl: userBookData[userId].url,
            bookImpressions: userBookData[userId].impressions,
            bookCover: userBookData[userId].cover,
            createdAt: formatDate(Date.now()),
          },
        ],
      });

      // 初期化
      delete userState[userId];
      delete userBookData[userId];

      await lineApi.replyMessage(
        event.replyToken,
        "記録したよ"
      );

      const state_global = await datastore.load_global();
      const state_fes = await datastore.load_fes();
      const log_global = state_global['BookLog'] || [];
      const isStateFesEmpty = Object.keys(state_fes).length === 0;

      if ((log_global.length === 2) && isStateFesEmpty) {
        console.log("フェス始めます!");
        await startFes(event);
      }
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

async function startFes(event) {
  console.log("ビブリオフェス開催");
  const data = await datastore.load_global();
  console.log(data);
  await datastore.make_fes(data);
}

function verifySignature(body, receivedSignature, channelSecret) {
  const signature = crypto
    .createHmac("SHA256", channelSecret)
    .update(body)
    .digest("base64");
  return signature === receivedSignature;
}
