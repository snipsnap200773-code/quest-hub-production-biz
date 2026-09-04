/**
 * 事業者情報の一元管理
 * src/config/companyInfo.js
 *
 * ★ 電話番号・メールアドレス・日付などが変わったら、このファイルだけを直してください。
 *   利用規約・プライバシーポリシー・特商法表記・お問い合わせページに自動で反映されます。
 */

export const COMPANY = {
  // 事業者
  name: 'infec',
  serviceName: 'QUEST HUB',
  representative: '三土手 大造',

  // 所在地
  postalCode: '227-0055',
  address: '神奈川県横浜市青葉区つつじヶ丘36-22-102',

  // 連絡先
  phone: '070-5074-3437',
  phoneHours: '平日 10:00〜18:00（土日祝を除く）',
  email: 'snipsnap.2007.7.3@gmail.com',
  lineUrl: 'https://lin.ee/TSv9mpP',
  siteUrl: 'https://questhub-portal.vercel.app/biz',

  // サポート
  supportHours: '平日 10:00〜18:00',

  // 日付
  betaStartDate: '2026年11月18日',   // ベータ版の提供開始日（＝規約の施行日）
  lastUpdated: '2026年11月18日',     // 各文書の最終更新日
};

export default COMPANY;
