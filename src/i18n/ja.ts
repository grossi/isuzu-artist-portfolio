const ja = {
  "meta.title": "isuZuの画廊",
  "meta.description": "イラストレーターisuZuの作品ギャラリーと職務経歴書",
  "nav.work": "仕事",
  "nav.history": "職務経歴書",
  "header.language": "表示言語",
  "home.profile": "プロフィール",
  "home.books": "著書",
  "sidebar.avatarAlt": "isuZuのアイコン",
  "social.email": "メール",
  "workCard.bannerAlt": "{name}のバナー",
  "gallery.label": "イラスト一覧",
  "gallery.photoAlt": "isuZuのイラスト{n}",
  "common.close": "閉じる",
  "footer.copyright": "Copyright © {year} isuZu 無断転載を禁じます。",
};

export type TranslationKey = keyof typeof ja;
export type Translations = Record<TranslationKey, string>;

export default ja;
