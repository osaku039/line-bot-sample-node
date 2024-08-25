// 本を検索して結果を返す
export const SearchBooks = async (title) => {
    // Google Books APIs のエンドポイント
    const endpoint = 'https://www.googleapis.com/books/v1/volumes?q=';
    console.log("ure = " + `${endpoint}search+${title}`)
  
    try{
    // 検索 API を叩く
    const res = await fetch(`${endpoint}search+${title}`);
    // JSON に変換
    const data = await res.json();
    console.log("data =" + data); // レスポンス全体を確認する
    
    // 必要なものだけ抜き出してわかりやすいフォーマットに変更する
    const items = data.items
  .filter(item => item.volumeInfo.imageLinks)  // imageLinks が存在するアイテムのみをフィルタリング
  .slice(0, 4)  // 上位4件のみ取得
  .map(item => {
    const vi = item.volumeInfo;
    return {
      title: vi.title,
      image: vi.imageLinks.smallThumbnail,  // サムネイル画像のURLを取得
    };
  });

    console.log(items)
    if (!items || items.length == 0) {
      console.log("0だよ")
      return {
        title: title,
        image: "https://i.ibb.co/1np5tmC/25480354.png",  // サムネイル画像のURLを取得
      };
    }
    else{
      return items;
    }
    
  } catch (error) {
    console.error('Error fetching books:', error);
    return []; // エラー時は空の配列を返す
  }
};
  