
// LINE APIのラッパー
class DataStore {
  data = {};

  // データの保存
  async save(user_id, data) {
    this.data[user_id] = data;
  }

  // データの読み出し
  async load(user_id) {
    return this.data[user_id];
  }
}

export {
  DataStore
}
