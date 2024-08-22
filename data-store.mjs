
// LINE APIのラッパー
class DataStore {
  data = {};

  // データの保存
  async save(userId, data) {
    this.data[userId] = data;
  }
  async save_global(data) {
    this.data['global'] = data;
  }

  // データの読み出し
  async load(userId) {
    return this.data[userId] ?? {};
  }
  async load_global(data) {
    return this.data['global'] ?? {};
  }
}

export {
  DataStore
}
