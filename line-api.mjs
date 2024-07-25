// HTTP APIを実行しやすくするためのライブラリ: Axios
import axios from 'axios';

// LINE APIのラッパー
class LineApi {
  constructor(channelSecret) {
    this.api = new axios.create({
      baseURL: 'https://api.line.me/v2',
      headers: {
        Authorization: `Bearer ${channelSecret}`,
        'Content-Type': 'application/json',
      },
    });

    this.dataApi = new axios.create({
      baseURL: 'https://api-data.line.me/v2',
      headers: {
        Authorization: `Bearer ${channelSecret}`,
      },
    });
  }

  // 応答メッセージAPI
  async replyMessage(replyToken, message) {
    const body = {
      replyToken,
      messages: [
        {
          type: 'text',
          text: message,
        }
      ]
    };

    return await this.api.post('/bot/message/reply', body);
  }

  // リッチメニュー作成API
  async createRichMenu(size, selected, name, chatBarText, areas) {
    const body = {
      size,
      selected,
      name,
      chatBarText,
      areas,
    };

    return await this.api.post('/bot/richmenu', body);
  }

  // リッチメニュー画像アップロードAPI
  async updateRichMenuImage(richMenuId, image) {
    return await this.dataApi.post(`/bot/richmenu/${richMenuId}/content`, image, { headers: { 'Content-Type': 'image/png' } });
  }

  // デフォルトのリッチメニュー設定API
  async setRichMenuDefault(richMenuId) {
    return await this.api.post(`/bot/user/all/richmenu/${richMenuId}`);
  }

  // リッチメニュー一覧API
  async getRichMenuList() {
    return await this.api.get('/bot/richmenu/list');
  }

  // リッチメニュー削除API
  async deleteRichMenu(richMenuId) {
    return await this.api.delete(`/bot/richmenu/${richMenuId}`);
  }

  // ここにさらに必要に応じてAPIを呼び出すメソッドを定義しましょう
}

export {
  LineApi
}
