// LINE APIのラッパー
class DataStore {
  data = {};
  vote = [2,1,1];
  
  constructor() {
    // 初期化
    this.vote = [2, 1, 1];
  }

  // データの保存
  async save(userId, data) {
    this.data[userId] = data;
  }
  // async save_global(data) {
  //   this.data['global'] = data;
  // }
  
  async save_global(data) {
    // グローバルデータが存在しない場合、新しいオブジェクトを作成
    if (!this.data['global']) {
        this.data['global'] = { BookLog: [] };
    }

    // 既存のBookLogに新しいデータを追加
    this.data['global'].BookLog = [
        ...data.BookLog,
        ...(this.data['global'].BookLog || [])
    ];

    // 最新の10件に絞る（必要に応じて）
    //this.data['global'].BookLog = this.data['global'].BookLog.slice(0, 10);
  }

  async make_fes(data) {
    this.data['fes'] = data;
  }

  // データの読み出し
  async load(userId) {
    return this.data[userId] ?? {};
  }


  async load_global() {
    return this.data['global'] ?? {};
  }

  async load_fes() {
    return this.data['fes'] ?? {};
  }

  async start_vote() {
    if (!this.vote) {
      this.vote = [2, 1, 1];
  }
  }

  async voting(which) {
    this.vote[0]++;
    if (which == '1') {
      this.vote[1]++;
    }else if (which == '2') {
      this.vote[2]++;
    }
  }

  async load_vote() {
    return this.vote;
  }

}

export {
  DataStore
}
