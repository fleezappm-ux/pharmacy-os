/**
 * Pharmacy OS 設定ファイル
 * 店舗ごとに変わる値はここだけ書き換えればOKです。
 * このファイルは他のすべてのJS/HTMLより先に読み込む必要があります。
 */
const PHARMACY_CONFIG = {
  // GAS（Google Apps Script）のデプロイURL
  GAS_URL: "https://script.google.com/macros/s/AKfycbzS1F43nO_ZDG6X6gH4qfUeprWmFFOZuthQKjbXxuxkoTWY0QMvbAfURd2speGZEa6x/exec",

  // 薬剤師名簿（確認印プルダウンなどで使用）
  PHARMACISTS: ["降旗敏文", "藤川律子", "金井佳美", "井内淳一郎", "井内学"],

  // 薬局名
  PHARMACY_NAME: "あおい薬局"
};
