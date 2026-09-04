import React from 'react';
import LegalLayout from './LegalLayout';
import { COMPANY } from '../../config/companyInfo';

/**
 * 特定商取引法に基づく表記　src/pages/legal/Legal.jsx
 *
 * ★ 記載内容の変更は src/config/companyInfo.js を編集してください。
 *
 * ⚠️ 有料プラン開始時には「販売価格」「支払時期」「支払方法」の
 *    書き換えが必要です。現在はベータ版の無償提供を前提とした記載です。
 */
function Legal() {
  return (
    <LegalLayout title="特定商取引法に基づく表記" updatedAt={COMPANY.lastUpdated}>

      <table>
        <tbody>
          <tr>
            <th>販売事業者名</th>
            <td>{COMPANY.name}</td>
          </tr>
          <tr>
            <th>運営統括責任者</th>
            <td>{COMPANY.representative}</td>
          </tr>
          <tr>
            <th>所在地</th>
            <td>〒{COMPANY.postalCode}<br />{COMPANY.address}</td>
          </tr>
          <tr>
            <th>電話番号</th>
            <td>
              {COMPANY.phone}<br />
              <span style={{ fontSize: '.87rem', color: '#64748b' }}>
                受付時間：{COMPANY.phoneHours}
              </span>
            </td>
          </tr>
          <tr>
            <th>メールアドレス</th>
            <td>{COMPANY.email}</td>
          </tr>
          <tr>
            <th>ホームページ</th>
            <td>
              <a href={COMPANY.siteUrl} target="_blank" rel="noopener noreferrer">
                {COMPANY.siteUrl}
              </a>
            </td>
          </tr>
          <tr>
            <th>販売価格</th>
            <td>
              ベータ版の提供期間中は無償です。<br />
              有料プランの提供を開始する際は、本ページおよび料金ページに掲載し、
              あらかじめ利用者へ通知します。
            </td>
          </tr>
          <tr>
            <th>商品代金以外の必要料金</th>
            <td>
              インターネット接続にかかる通信費は、利用者のご負担となります。<br />
              LINE公式アカウントを連携される場合、LINEヤフー株式会社に対する
              メッセージ配信料等が別途発生することがあります。
            </td>
          </tr>
          <tr>
            <th>お支払い方法</th>
            <td>
              ベータ版の提供期間中はお支払いの必要はありません。<br />
              有料プラン移行後は、クレジットカードによる決済（決済代行：Stripe）を予定しています。
            </td>
          </tr>
          <tr>
            <th>お支払い時期</th>
            <td>
              ベータ版の提供期間中は発生しません。<br />
              有料プラン移行後は、お申し込み時に初回分を決済し、
              以後は選択されたプランに応じて月ごとまたは年ごとに自動で決済されます。
            </td>
          </tr>
          <tr>
            <th>サービスの提供時期</th>
            <td>
              利用登録の完了後、ただちにご利用いただけます。
            </td>
          </tr>
          <tr>
            <th>返品・キャンセルについて</th>
            <td>
              本サービスはデジタルコンテンツの提供であるため、
              サービスの性質上、返品・返金はお受けしておりません。<br />
              有料プランはいつでも解約できます。解約された場合、
              既にお支払いいただいた期間の末日までご利用いただけますが、
              当該期間の料金の日割り返金は行いません。<br />
              当方の責めに帰すべき事由によりサービスを提供できなかった場合は、この限りではありません。
            </td>
          </tr>
          <tr>
            <th>動作環境</th>
            <td>
              インターネットに接続されたパソコンまたはスマートフォンでご利用いただけます。<br />
              推奨ブラウザ：Google Chrome、Safari、Microsoft Edge の各最新版<br />
              上記以外の環境では、一部の機能が正しく動作しないことがあります。
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: '.88rem', color: '#64748b', marginTop: '28px' }}>
        本ページに記載のない事項については、
        <a href="/terms">利用規約</a>および
        <a href="/privacy">プライバシーポリシー</a>によります。
      </p>

    </LegalLayout>
  );
}

export default Legal;
