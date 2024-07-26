import { LineApi } from './line-api.mjs';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const CHANNEL_SECRET = process.env.CHANNEL_SECRET;
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;

const lineApi = new LineApi(CHANNEL_ACCESS_TOKEN);

// リッチメニューを作成
const richMenuId = (await lineApi.createRichMenu(
  {
    width: 2500,
    height: 1000,
  },
  true,
  "リッチメニューです",
  "開いてね",
  [
    {
      bounds: {
        x: 0,
        y: 0,
        width: 2500,
        height: 250,
      },
      action: {
        type: "uri",
        label: "戦績を見る",
        uri: `https://liff.line.me/${process.env.LIFF_ID}`,
      }
    },
    {
      bounds: {
        x: 0,
        y: 250,
        width: 828,
        height: 742,
      },
      action: {
        type: "message",
        label: "グー",
        text: "グー",
      }
    },
    {
      bounds: {
        x: 836,
        y: 250,
        width: 828,
        height: 742,
      },
      action: {
        type: "message",
        label: "チョキ",
        text: "チョキ",
      }
    },
    {
      bounds: {
        x: 1672,
        y: 250,
        width: 828,
        height: 742,
      },
      action: {
        type: "message",
        label: "パー",
        text: "パー",
      }
    }
  ]
)).data.richMenuId;

console.log(richMenuId);
// 画像を設定
await lineApi.updateRichMenuImage(richMenuId, readFileSync("image.png"));
// 作成したリッチメニューをデフォルトにする
await lineApi.setRichMenuDefault(richMenuId);
// リッチメニューの一覧を取得
const richMenuList = (await lineApi.getRichMenuList()).data.richmenus;

// 他のリッチメニューは削除する
Promise.all(
  richMenuList.map(async (richMenu) => {
    if (richMenu.richMenuId != richMenuId) {
      await lineApi.deleteRichMenu(richMenu.richMenuId);
    }
  })
);