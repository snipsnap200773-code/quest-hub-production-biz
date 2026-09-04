import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { COMPANY } from '../config/companyInfo';

/**
 * QUEST HUB ランディングページ（ベータ募集版）
 *
 * ▼ 差し替えが必要な箇所は「TODO:」で検索してください
 * ▼ 必要な画像（すべて public/ 直下）
 *    - admin-dashboard.png / mobile-calendar.png（既存）
 *    - admin-timeline.png / admin-management.png（既存）
 *    - reservation-form.png / time-selection.png / confirm-reservation.png（既存）
 *    - portal-home.png / portal-list.png / portal-detail.png（既存）
 *    - admin-inventory.png（新規：在庫管理の画面。未撮影なら該当の<img>を消してもレイアウトは崩れません）
 */

function LandingPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="qh-lp">
      <style>{`
        .qh-lp {
          --ink: #0f172a;
          --body: #475569;
          --muted: #64748b;
          --line: #e2e8f0;
          --tint: #f8fafc;
          --brand: #2563eb;
          --brand-deep: #1e3a8a;
          --brand-tint: #eff6ff;
          --accent: #0d9488;

          font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN",
                       "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif;
          color: var(--body);
          line-height: 1.8;
          background: #fff;
          -webkit-font-smoothing: antialiased;
        }

        .qh-lp *, .qh-lp *::before, .qh-lp *::after { box-sizing: border-box; }
        .qh-lp img { max-width: 100%; }
        .qh-lp a:focus-visible { outline: 3px solid var(--brand); outline-offset: 3px; border-radius: 4px; }

        .qh-container { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
        .qh-section { padding: 88px 0; }
        .qh-section--tint { background: var(--tint); }

        .qh-eyebrow {
          display: inline-block;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--brand);
          background: var(--brand-tint);
          padding: 6px 14px;
          border-radius: 999px;
          margin-bottom: 18px;
        }

        .qh-h2 {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--ink);
          line-height: 1.45;
          letter-spacing: -0.02em;
          margin: 0 0 14px;
        }
        .qh-lead { font-size: 1.02rem; color: var(--muted); margin: 0 0 44px; max-width: 40em; }
        .qh-center { text-align: center; }
        .qh-center .qh-lead { margin-left: auto; margin-right: auto; }

        /* ---- CTA ---- */
        .qh-cta {
          display: inline-block;
          background: var(--brand);
          color: #fff;
          padding: 17px 40px;
          border-radius: 10px;
          font-size: 1.08rem;
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.22);
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .qh-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 26px rgba(37,99,235,.3); }
        .qh-cta--ghost {
          background: #fff; color: var(--brand);
          border: 2px solid var(--brand); box-shadow: none;
        }
        .qh-cta--onblue { background: #fff; color: var(--brand); box-shadow: 0 8px 20px rgba(0,0,0,.18); }
        .qh-cta-note { font-size: .86rem; color: var(--muted); margin-top: 14px; }

        /* ---- Hero ---- */
        .qh-hero { background: linear-gradient(160deg, #eff6ff 0%, #dbeafe 100%); padding: 72px 0 80px; }
        .qh-hero-grid { display: flex; flex-direction: column; gap: 48px; }
        .qh-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--brand-deep); color: #fff;
          font-size: .84rem; font-weight: 700;
          padding: 7px 16px; border-radius: 999px; margin-bottom: 22px;
        }
        .qh-h1 {
          font-size: clamp(1.85rem, 5.2vw, 2.5rem);
          font-weight: 900;
          color: var(--brand-deep);
          line-height: 1.4;
          letter-spacing: -0.035em;
          margin: 0 0 20px;
        }
        .qh-hero p { font-size: 1.05rem; color: #475569; margin: 0 0 32px; }
        .qh-hero-shots { position: relative; display: flex; flex-direction: column; align-items: center; gap: 26px; }
        .qh-shot-pc {
          width: 100%; max-width: 600px; border-radius: 14px;
          border: 4px solid #cbd5e1; box-shadow: 0 20px 30px -8px rgba(15,23,42,.22);
          object-fit: cover; background: #fff;
        }
        .qh-shot-sp {
          width: 218px; height: auto; border-radius: 28px;
          border: 8px solid #1e293b; box-shadow: 0 18px 30px rgba(15,23,42,.3);
          object-fit: cover; background: #fff;
        }

        /* ---- 課題 ---- */
        .qh-pains { display: grid; grid-template-columns: 1fr; gap: 14px; max-width: 760px; margin: 0 auto; }
        .qh-pain {
          display: flex; gap: 14px; align-items: flex-start;
          background: #fff; border: 1px solid var(--line);
          border-left: 4px solid var(--brand); border-radius: 8px;
          padding: 18px 22px; font-size: 1rem; color: var(--ink);
        }
        .qh-pain span { color: var(--brand); font-weight: 800; flex-shrink: 0; }

        /* ---- 機能ブロック ---- */
        .qh-feature { display: flex; flex-direction: column; gap: 32px; margin-bottom: 72px; }
        .qh-feature:last-child { margin-bottom: 0; }
        .qh-feature-body { flex: 1; }
        .qh-feature-shot { flex: 1; }
        .qh-h3 { font-size: 1.22rem; font-weight: 800; color: var(--ink); margin: 0 0 10px; line-height: 1.5; }
        .qh-feature p { margin: 0 0 18px; font-size: .99rem; }
        .qh-shot {
          width: 100%; border-radius: 12px; border: 3px solid #cbd5e1;
          box-shadow: 0 10px 18px -6px rgba(15,23,42,.16); object-fit: cover; background: #fff;
        }

        .qh-points { list-style: none; margin: 0; padding: 0; }
        .qh-points li {
          position: relative; padding-left: 26px; margin-bottom: 11px;
          font-size: .97rem; color: var(--body);
        }
        .qh-points li::before {
          content: ""; position: absolute; left: 4px; top: .62em;
          width: 8px; height: 8px; border-radius: 50%; background: var(--brand);
        }

        /* ---- スマホ3枚並び ---- */
        .qh-sp-row { display: flex; gap: 26px; justify-content: center; flex-wrap: wrap; }

        /* ---- 新機能バッジ ---- */
        .qh-new {
          display: inline-block; background: var(--accent); color: #fff;
          font-size: .72rem; font-weight: 700; padding: 3px 9px;
          border-radius: 5px; margin-left: 10px; vertical-align: middle;
        }

        /* ---- 訪問・出張サービス ---- */
        .qh-visit-grid { display: grid; grid-template-columns: 1fr; gap: 18px; }
        .qh-visit-card {
          background: #fff; border: 1px solid var(--line); border-radius: 12px;
          padding: 26px 24px;
        }
        .qh-visit-card .qh-h3 { margin-bottom: 12px; }
        .qh-visit-card p { margin: 0; font-size: .95rem; }

        /* ---- 開発ストーリー ---- */
        .qh-story {
          max-width: 720px; margin: 0 auto;
          border-left: 4px solid var(--brand); padding: 4px 0 4px 28px;
        }
        .qh-story p { font-size: 1.02rem; margin: 0 0 18px; }
        .qh-story p:last-child { margin-bottom: 0; }
        .qh-story-sign { font-size: .92rem; color: var(--muted); }

        /* ---- ベータ ---- */
        .qh-beta { background: var(--brand-deep); color: #fff; padding: 84px 0; text-align: center; }
        .qh-beta h2 { font-size: clamp(1.6rem, 4.6vw, 2.1rem); font-weight: 900; color: #fff; margin: 0 0 16px; line-height: 1.45; letter-spacing: -0.03em; }
        .qh-beta > .qh-container > p { color: #c7d7f5; font-size: 1.02rem; margin: 0 0 40px; }
        .qh-terms {
          display: grid; grid-template-columns: 1fr; gap: 1px;
          background: rgba(255,255,255,.16); border-radius: 12px; overflow: hidden;
          max-width: 720px; margin: 0 auto 40px; text-align: left;
        }
        .qh-term { background: var(--brand-deep); padding: 18px 24px; display: flex; gap: 16px; align-items: baseline; }
        .qh-term dt { font-size: .87rem; color: #a5c0ef; font-weight: 700; flex-shrink: 0; width: 7.5em; }
        .qh-term dd { margin: 0; font-size: 1rem; color: #fff; font-weight: 600; }

        /* ---- FAQ ---- */
        .qh-faq { max-width: 760px; margin: 0 auto; }
        .qh-faq details {
          border-bottom: 1px solid var(--line);
          padding: 20px 0;
        }
        .qh-faq summary {
          font-size: 1.02rem; font-weight: 700; color: var(--ink);
          cursor: pointer; list-style: none; position: relative; padding-right: 32px;
        }
        .qh-faq summary::-webkit-details-marker { display: none; }
        .qh-faq summary::after {
          content: "+"; position: absolute; right: 4px; top: -2px;
          font-size: 1.4rem; font-weight: 400; color: var(--brand); line-height: 1;
        }
        .qh-faq details[open] summary::after { content: "−"; }
        .qh-faq details p { margin: 14px 0 0; font-size: .97rem; color: var(--body); }

        /* ---- Footer ---- */
        .qh-footer { background: var(--ink); color: #94a3b8; padding: 56px 0 40px; font-size: .9rem; }
        .qh-footer-top { display: flex; flex-direction: column; gap: 28px; margin-bottom: 36px; }
        .qh-footer-brand strong { display: block; color: #fff; font-size: 1.15rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; }
        .qh-footer nav { display: flex; flex-wrap: wrap; gap: 10px 24px; }
        .qh-footer nav a { color: #cbd5e1; text-decoration: none; }
        .qh-footer nav a:hover { color: #fff; text-decoration: underline; }
        .qh-footer-legal { border-top: 1px solid #1e293b; padding-top: 24px; font-size: .84rem; line-height: 1.9; }

        @media (min-width: 768px) {
          .qh-section { padding: 104px 0; }
          .qh-hero { padding: 88px 0 96px; }
          .qh-hero-grid { flex-direction: row; align-items: center; gap: 40px; }
          .qh-hero-grid > div { flex: 1; }
          .qh-hero-shots { flex-direction: row; }
          .qh-shot-sp {
            position: absolute; bottom: -28px; right: -8px;
            width: 178px; border-width: 6px; border-radius: 22px;
          }
          .qh-h2 { font-size: 2.05rem; }
          .qh-feature { flex-direction: row; align-items: center; gap: 52px; }
          .qh-feature--flip { flex-direction: row-reverse; }
          .qh-pains { grid-template-columns: 1fr 1fr; }
          .qh-visit-grid { grid-template-columns: repeat(3, 1fr); gap: 22px; }
          .qh-footer-top { flex-direction: row; justify-content: space-between; align-items: flex-start; }
        }

        @media (prefers-reduced-motion: reduce) {
          .qh-lp * { transition: none !important; }
        }
      `}</style>

      {/* ======================= 1. ヒーロー ======================= */}
      <section className="qh-hero">
        <div className="qh-container qh-hero-grid">
          <div>
            <span className="qh-badge">ベータ版テスター募集中</span>
            <h1 className="qh-h1">
              今の業務スタイルを変えずに、<br />新しい予約の入り口を増やす。
            </h1>
            <p>
              予約台帳・レジ・在庫・顧客名簿・LINE連携までを1つに。<br />
              スマホ1台で完結する予約管理システム「QUEST HUB」。
            </p>
            <Link to="/trial" className="qh-cta">ベータ版を無料ではじめる</Link>
            <p className="qh-cta-note">登録は3分ほど。ベータ期間中は全機能を無料でご利用いただけます。</p>
          </div>

          <div className="qh-hero-shots">
            <img src="/admin-dashboard.png" alt="QUEST HUB 管理ダッシュボード" className="qh-shot-pc" />
            <img src="/mobile-calendar.png" alt="スマホ版 予約カレンダー" className="qh-shot-sp" />
          </div>
        </div>
      </section>

      {/* ======================= 2. 課題提起 ======================= */}
      <section className="qh-section qh-section--tint">
        <div className="qh-container qh-center">
          <h2 className="qh-h2">こんな場面、ありませんか</h2>
          <p className="qh-lead">
            予約システムを入れたいけれど、今のやり方を全部変えるのは避けたい。
            QUEST HUBは、そのための道具です。
          </p>
          <div className="qh-pains">
            <div className="qh-pain"><span>—</span>営業時間外の電話に出られず、予約を取り逃している</div>
            <div className="qh-pain"><span>—</span>飛び込みのお客様を紙の台帳に書き足して、あとで転記している</div>
            <div className="qh-pain"><span>—</span>店販商品の在庫を、なんとなくの目視で管理している</div>
            <div className="qh-pain"><span>—</span>導入したシステムが自店のメニュー構成に合わず、結局使わなくなった</div>
          </div>
        </div>
      </section>

      {/* ======================= 3. 予約を受ける ======================= */}
      <section className="qh-section">
        <div className="qh-container">
          <div className="qh-center">
            <span className="qh-eyebrow">予約を受ける</span>
            <h2 className="qh-h2">24時間受付できる入り口を、もう1つ</h2>
            <p className="qh-lead">
              電話・メール・飛び込みはそのまま。そこにWeb予約とLINE予約を足すだけです。
            </p>
          </div>

          <div className="qh-feature">
            <div className="qh-feature-shot qh-sp-row">
              <img src="/reservation-form.png" alt="メニュー・スタッフ指名の選択画面" className="qh-shot-sp" style={{ position: 'static', width: '218px', borderWidth: '8px', borderRadius: '28px' }} />
              <img src="/time-selection.png" alt="空き時間の検索画面" className="qh-shot-sp" style={{ position: 'static', width: '218px', borderWidth: '8px', borderRadius: '28px' }} />
            </div>
            <div className="qh-feature-body">
              <h3 className="qh-h3">数タップで完了する予約フロー</h3>
              <p>
                メニューの所要時間と空き状況をリアルタイムに計算し、実際に予約できる日時だけを提示します。
                お客様が選んだ時点で予約が成立するので、折り返しの電話は不要です。
              </p>
              <ul className="qh-points">
                <li>オプション（枝メニュー）・複数名予約・スタッフ指名に対応</li>
                <li>予約完了メールと前日リマインドを自動送信</li>
                <li>キャンセルもお客様自身の操作で完結（当日キャンセル防止の設定つき）</li>
              </ul>
            </div>
          </div>

          <div className="qh-feature qh-feature--flip">
            <div className="qh-feature-shot">
              <img src="/confirm-reservation.png" alt="予約内容の確認画面" className="qh-shot-sp" style={{ position: 'static', width: '218px', borderWidth: '8px', borderRadius: '28px', display: 'block', margin: '0 auto' }} />
            </div>
            <div className="qh-feature-body">
              <h3 className="qh-h3">LINE公式アカウントと連携できます</h3>
              <p>
                お客様はいつも使っているLINEから、そのまま予約できます。
                予約完了通知やリマインドもLINEに届くため、メールより開封されやすく、無断キャンセルが減ります。
              </p>

              <h3 className="qh-h3" style={{ marginTop: '30px' }}>聞きたいことを、予約時に聞ける</h3>
              <p>
                予約フォームの入力項目は、店舗ごとに自由に組み替えられます。
                「駐車場を使いますか」「今日は何が気になりますか」といった質問を追加して、来店前に必要な情報を集められます。
              </p>

              <h3 className="qh-h3" style={{ marginTop: '30px' }}>受付ルールは細かく設定できます</h3>
              <ul className="qh-points">
                <li>1コマの単位、定休日、長期休暇、同時受付の上限</li>
                <li>予約を自動で前に詰めて、空き時間を減らすロジック</li>
                <li>管理者だけが使える非公開メニューの登録</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= 4. 現場をまわす ======================= */}
      <section className="qh-section qh-section--tint">
        <div className="qh-container">
          <div className="qh-center">
            <span className="qh-eyebrow">現場をまわす</span>
            <h2 className="qh-h2">紙の台帳と同じ感覚で、そのまま使えます</h2>
            <p className="qh-lead">
              覚えることを増やさないために、画面はできるだけ台帳に近づけました。
            </p>
          </div>

          <div className="qh-feature">
            <div className="qh-feature-shot">
              <img src="/admin-timeline.png" alt="タイムライン形式の予約台帳" className="qh-shot" />
            </div>
            <div className="qh-feature-body">
              <h3 className="qh-h3">タップで入れて、タップで塞ぐ</h3>
              <p>
                電話予約や飛び込みのお客様が来たら、カレンダーの空き枠をタップするだけで「ねじ込み予約」が完了します。
                急な休憩やミーティングが入ったときも、ワンタップで枠をブロックできます。
              </p>
              <ul className="qh-points">
                <li>カレンダー表示とタイムライン表示を切り替え</li>
                <li>ドラッグで予約の移動・時間変更</li>
                <li>プライベート予定も同じ画面で管理</li>
              </ul>
              {/* TODO: デモ画面のルートが /demo/calendar で合っているか確認 */}
              <Link to="/demo/calendar" target="_blank" className="qh-cta qh-cta--ghost" style={{ marginTop: '10px', padding: '13px 28px', fontSize: '.98rem' }}>
                デモ画面を操作してみる
              </Link>
            </div>
          </div>

          <div className="qh-feature qh-feature--flip">
            <div className="qh-feature-shot">
              <img src="/admin-management.png" alt="レジ・売上管理画面" className="qh-shot" />
            </div>
            <div className="qh-feature-body">
              <h3 className="qh-h3">レジと売上管理</h3>
              <p>
                複数メニューの組み合わせ、オプション、店販商品、割引や指名料まで、お会計は自動で計算されます。
                売上はそのまま分析画面に集計され、CSVで書き出せます。
              </p>
              <ul className="qh-points">
                <li>顧客名簿は重複のマージや出禁管理にも対応</li>
                <li>他社レジをお使いなら、お会計をスキップする「自動売上確定モード」も選べます</li>
              </ul>
            </div>
          </div>

          <div className="qh-feature">
            {/* TODO: 在庫管理のスクリーンショットを public/admin-inventory.png に置いてください。
                     未撮影の場合は、この <div> ごと削除すればテキストが横幅いっぱいに広がります。 */}
            <div className="qh-feature-shot">
              <img src="/admin-inventory.png" alt="在庫管理画面" className="qh-shot" />
            </div>
            <div className="qh-feature-body">
              <h3 className="qh-h3">
                在庫管理
                <span className="qh-new">NEW</span>
              </h3>
              <p>
                店販商品の在庫を、お会計と連動して自動で減らします。
                「売れたのに在庫表を直し忘れる」が起きないので、発注のタイミングを勘に頼らずに決められます。
              </p>
              <ul className="qh-points">
                <li>お会計の確定と同時に在庫数を自動更新</li>
                <li>残数の確認と手動での棚卸し調整</li>
                <li>商品マスターはレジ設定と共通なので、二重登録は不要</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= 5. ポータル ======================= */}
      <section className="qh-section">
        <div className="qh-container qh-center">
          <span className="qh-eyebrow">お客様に見つけてもらう</span>
          <h2 className="qh-h2">お店の専用ページが、自動でできます</h2>
          <p className="qh-lead">
            メニュー表・ギャラリー・代表者メッセージをまとめた店舗ページを自動生成。
            総合ポータルのカテゴリ検索からも見つけてもらえます。
          </p>
          <div className="qh-sp-row" style={{ marginBottom: '40px' }}>
            <img src="/portal-home.png" alt="総合ポータルのホーム画面" className="qh-shot-sp" style={{ position: 'static', width: '218px', borderWidth: '8px', borderRadius: '28px' }} />
            <img src="/portal-list.png" alt="カテゴリ別の店舗検索画面" className="qh-shot-sp" style={{ position: 'static', width: '218px', borderWidth: '8px', borderRadius: '28px' }} />
            <img src="/portal-detail.png" alt="店舗詳細ページ" className="qh-shot-sp" style={{ position: 'static', width: '218px', borderWidth: '8px', borderRadius: '28px' }} />
          </div>
          <p className="qh-lead" style={{ marginBottom: 0 }}>
            予約用URL・問い合わせURL・QRコードは管理画面から1クリックで発行できます。
            SNSのプロフィール欄や店頭のPOPにそのまま使えます。
          </p>
        </div>
      </section>

      {/* ======================= 6. 訪問・出張サービス ======================= */}
      <section className="qh-section qh-section--tint">
        <div className="qh-container">
          <div className="qh-center">
            <span className="qh-eyebrow">出張・訪問される方へ</span>
            <h2 className="qh-h2">お客様のご自宅へ伺うサービスにも</h2>
            <p className="qh-lead">
              訪問カットや家事代行など、こちらから出向くスタイルのお仕事にもお使いいただけます。
            </p>
          </div>

          <div className="qh-visit-grid">
            <div className="qh-visit-card">
              <h3 className="qh-h3">予約時に住所を伺えます</h3>
              <p>
                予約フォームに住所の入力欄を追加できます。
                建物名や駐車場の有無など、訪問前に確認しておきたいことを質問として設定できます。
              </p>
            </div>
            <div className="qh-visit-card">
              <h3 className="qh-h3">移動時間を自動で確保</h3>
              <p>
                施術時間の前後に移動のための時間を自動で挟み込めます。
                予約が詰まりすぎて次の訪問に間に合わない、という事故を防げます。
              </p>
            </div>
            <div className="qh-visit-card">
              <h3 className="qh-h3">スマホだけで完結</h3>
              <p>
                移動中や訪問先でも、スマートフォンから予約の確認・変更・お会計まで行えます。
                事務所に戻ってからの入力作業が不要になります。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= 7. 開発ストーリー ======================= */}
      <section className="qh-section">
        <div className="qh-container">
          <div className="qh-center">
            <span className="qh-eyebrow">開発の背景</span>
            <h2 className="qh-h2">現場で毎日使いながら、作っています</h2>
          </div>
          <div className="qh-story">
            <p>
              QUEST HUBは、現役の美容室オーナーが自分の店の困りごとを解決するために作ったシステムです。
            </p>
            <p>
              既製の予約システムをいくつか試しましたが、メニュー構成が合わなかったり、飛び込みのお客様を入れる操作が面倒だったりで、
              結局は紙の台帳に戻ってしまいました。それなら自分で作ろう、というのが出発点です。
            </p>
            <p>
              今も自店で毎日使いながら、現場で「これがないと困る」と感じた機能だけを足しています。
              使わない機能で画面が重くならないよう、増やすより削ることを大事にしています。
            </p>
            {/* TODO: お名前を入れるか、「QUEST HUB 開発者」のままにするか決めてください */}
            <p className="qh-story-sign">QUEST HUB 開発者 / infec</p>
          </div>
        </div>
      </section>

      {/* ======================= 8. ベータ版CTA ======================= */}
      <section className="qh-beta">
        <div className="qh-container">
          <h2>ベータ版テスターを募集しています</h2>
          <p>実際に店舗で使っていただき、率直な感想を聞かせてください。</p>

          <dl className="qh-terms">
            <div className="qh-term">
              <dt>利用料金</dt>
              <dd>ベータ期間中は全機能が無料</dd>
            </div>
            <div className="qh-term">
              <dt>お願いすること</dt>
              <dd>実際の店舗業務でお使いいただき、使いにくい点や不具合をお知らせください</dd>
            </div>
            <div className="qh-term">
              <dt>サポート</dt>
              <dd>LINEで直接ご相談いただけます（平日10:00〜18:00）</dd>
            </div>
            <div className="qh-term">
              <dt>はじめ方</dt>
              <dd>登録フォームを送信すると、その場でアカウントが発行されます</dd>
            </div>
          </dl>

          <Link to="/trial" className="qh-cta qh-cta--onblue">ベータ版を無料ではじめる</Link>
        </div>
      </section>

      {/* ======================= 9. FAQ ======================= */}
      <section className="qh-section">
        <div className="qh-container">
          <div className="qh-center">
            <h2 className="qh-h2">よくあるご質問</h2>
          </div>
          <div className="qh-faq">
            <details>
              <summary>ベータ期間が終わったらどうなりますか</summary>
              <p>
                有料プランへの移行をご案内しますが、そのまま継続するかどうかは自由にお決めいただけます。
                終了の1か月前までに、料金と移行方法をお知らせします。
              </p>
            </details>
            <details>
              <summary>今使っている予約台帳やレジは、そのまま使えますか</summary>
              <p>
                使えます。お会計機能をスキップして予約管理だけに絞る「自動売上確定モード」があるので、
                売上管理は今のレジのままで、予約だけQUEST HUBに任せる使い方ができます。
              </p>
            </details>
            <details>
              <summary>LINE公式アカウントを持っていなくても使えますか</summary>
              <p>
                使えます。LINE連携は任意の機能で、Web予約フォームだけでも問題なく運用できます。
                あとからLINEを追加することも可能です。
              </p>
            </details>
            <details>
              <summary>パソコンがなくても大丈夫ですか</summary>
              <p>
                スマートフォンだけで、予約の登録・変更・お会計まで一通りの操作ができます。
                初期設定はパソコンのほうが進めやすいですが、スマホでも設定できます。
              </p>
            </details>
            <details>
              <summary>設定が難しそうです</summary>
              <p>
                設定手順の動画をご用意しています。それでも分からない部分は、LINEのサポート窓口から個別にご案内します。
                初期設定を一緒に進めることもできますので、遠慮なくご相談ください。
              </p>
            </details>
            <details>
              <summary>お客様のご自宅へ訪問するスタイルでも使えますか</summary>
              <p>
                お使いいただけます。予約フォームに住所の入力欄を追加でき、
                施術時間の前後に移動時間を自動で確保する設定もご用意しています。
              </p>
            </details>
            <details>
              <summary>美容室以外の業種でも使えますか</summary>
              <p>
                ベータ版では、美容室・理容室、ネイル・アイラッシュ、エステ・リラク、
                整体・接骨院・鍼灸、および個人宅への訪問サービスを対象としています。
                それ以外の業種については、順次対応を広げていく予定です。
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ======================= 10. フッター ======================= */}
      <footer className="qh-footer">
        <div className="qh-container">
          <div className="qh-footer-top">
            <div className="qh-footer-brand">
              <strong>{COMPANY.serviceName}</strong>
              <span>運営：{COMPANY.name}</span>
            </div>
            {/* TODO: /terms /privacy /legal のルートを実装してください */}
            <nav>
              <Link to="/trial">ベータ版をはじめる</Link>
              <Link to="/terms">利用規約</Link>
              <Link to="/privacy">プライバシーポリシー</Link>
              <Link to="/legal">特定商取引法に基づく表記</Link>
              <Link to="/contact">お問い合わせ</Link>
              <a href={COMPANY.lineUrl} target="_blank" rel="noopener noreferrer">LINEで問い合わせる</a>
            </nav>
          </div>
          <div className="qh-footer-legal">
            © {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
