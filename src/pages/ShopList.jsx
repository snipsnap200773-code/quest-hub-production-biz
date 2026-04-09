import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
// 🆕 小カテゴリを取得する関数をマスターから読み込む
import { getSubCategories } from '../constants/industryMaster';
import { ChevronLeft } from 'lucide-react';

function ShopList() {
  const { categoryId } = useParams(); // 大カテゴリ名（例：訪問サービス）
  const navigate = useNavigate();
const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubCat, setActiveSubCat] = useState('すべて');
  // 🆕 小カテゴリーの画像データを保持するState
  const [subCategoryData, setSubCategoryData] = useState([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchFilteredShops();
    // 🆕 ページ読み込み時に小カテゴリーの画像一覧も取得
    fetchSubCategoryImages();
  }, [categoryId, activeSubCat]);

  // 🆕 データベース（portal_categories）から小カテゴリーの画像を取得する関数
  const fetchSubCategoryImages = async () => {
    const { data } = await supabase
      .from('portal_categories')
      .select('name, image_url')
      .in('name', subCategories); // industryMasterで定義した小カテゴリー名でフィルタ
    if (data) setSubCategoryData(data);
  };

  // 🆕 大カテゴリに対応する小カテゴリリストを取得
  const subCategories = getSubCategories(categoryId);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchFilteredShops();
  }, [categoryId, activeSubCat]); // 🆕 小カテゴリが変わった時も再取得

  const fetchFilteredShops = async () => {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('*')
      .eq('is_suspended', false)
      // ✅ 🆕 修正：プラン2（フルプラン）の店舗だけをリストに表示する
      .eq('service_plan', 2) 
      .eq('business_type', categoryId) 
      .not('business_name', 'is', null);

    // 🆕 小カテゴリが選ばれている場合は、その条件を追加
    if (activeSubCat !== 'すべて') {
      query = query.eq('sub_business_type', activeSubCat);
    }

    const { data, error } = await query.order('business_name_kana', { ascending: true });
    if (!error && data) setShops(data);
    setLoading(false);
  };

  return (
    <div style={{ backgroundColor: '#f4f7f9', minHeight: '100vh', fontFamily: '"Hiragino Sans", "Meiryo", sans-serif', color: '#333' }}>
      
      {/* 1. ヘッダー - 🆕 戻り先をトップページに変更 */}
      <div style={{ background: '#fff', padding: '15px 20px', borderBottom: '1px solid #eee', position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center' }}>
        <button onClick={() => navigate('/')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '5px' }}>
          <ChevronLeft size={24} color="#333" />
        </button>
        <div style={{ marginLeft: '10px' }}>
          <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 'bold' }}>{categoryId}</h2>
          <p style={{ fontSize: '0.65rem', color: '#999', margin: 0 }}>Category Search</p>
        </div>
      </div>

{/* 2. メインコンテンツ */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        
{/* 🆕 小カテゴリーの画像付きミニカード */}
        {subCategories.length > 0 && (
          <div style={{ 
            marginBottom: '25px', 
            overflowX: 'auto', 
            display: 'flex', 
            gap: '12px', 
            padding: '5px 5px 15px 5px', 
            WebkitOverflowScrolling: 'touch' 
          }}>
            {/* 「すべて」ボタン（これはシンプルに） */}
            <div 
              onClick={() => setActiveSubCat('すべて')}
              style={{
                minWidth: '70px', height: '70px', borderRadius: '12px',
                background: activeSubCat === 'すべて' ? '#1e293b' : '#fff',
                color: activeSubCat === 'すべて' ? '#fff' : '#64748b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)', flexShrink: 0
              }}
            >
              すべて
            </div>

            {subCategories.map(sub => {
              // 対応する画像を探す
              const catInfo = subCategoryData.find(d => d.name === sub);
              const isActive = activeSubCat === sub;

              return (
                <div 
                  key={sub}
                  onClick={() => setActiveSubCat(sub)}
                  style={{
                    minWidth: '100px', height: '70px', borderRadius: '12px',
                    position: 'relative', overflow: 'hidden', cursor: 'pointer',
                    flexShrink: 0, transition: '0.2s',
                    boxShadow: isActive ? `0 0 0 3px #2563eb` : '0 4px 10px rgba(0,0,0,0.1)',
                    transform: isActive ? 'scale(0.95)' : 'none'
                  }}
                >
                  {/* 背景画像 */}
<div style={{
  position: 'absolute', inset: 0,
  background: '#e2e8f0', // 画像がない時のベース色
  // 🆕 画像がある時だけグラデーションとurl()を合成する
  ...(catInfo?.image_url && { 
    backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.6)), url(${catInfo.image_url})` 
  }),
  backgroundSize: 'cover', 
  backgroundPosition: 'center'
}} />
                  {/* 文字 */}
                  <div style={{
                    position: 'relative', height: '100%', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', padding: '5px',
                    color: '#fff', fontSize: '0.65rem', fontWeight: 'bold', textAlign: 'center',
                    lineHeight: '1.2'
                  }}>
                    {sub}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '0.85rem', color: '#666' }}>
            「<b>{categoryId}</b>」に該当する店舗： <b>{shops.length}</b> 件
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>読み込み中...</div>
        ) : shops.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <p style={{ color: '#999', fontSize: '0.9rem' }}>ごめんなさい！<br />現在、このカテゴリに掲載店舗はありません。</p>
            {/* 🆕 リンク先をトップページに変更 */}
            <Link to="/" style={{ display: 'inline-block', marginTop: '20px', color: '#2563eb', fontWeight: 'bold', textDecoration: 'none', fontSize: '0.85rem' }}>← 他のカテゴリを探す</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {shops.map(shop => (
              <div key={shop.id} style={{ 
                background: '#fff', 
                border: '1px solid #eee', 
                borderRadius: '8px', 
                overflow: 'hidden', 
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                display: 'flex',
                height: '120px' 
              }}>
                <Link to={`/shop/${shop.id}/detail`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', width: '100%' }}>
                  {/* 左側：1:1画像エリア（余白なし） */}
                  <div style={{ 
                    width: '120px', 
                    minWidth: '120px', 
                    height: '120px',
                    background: '#f0f0f0',
                    backgroundImage: shop.image_url ? `url(${shop.image_url})` : 'none', 
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    flexShrink: 0
                  }}>
                    {!shop.image_url && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '0.6rem', color: '#ccc' }}>NO IMAGE</div>}
                  </div>

                  {/* 右側：情報エリア */}
                  <div style={{ padding: '12px 15px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shop.business_name}
                    </h4>
                    
                    {/* サブタイトル内の「/」を改行に変換 */}
                    <p style={{ fontSize: '0.75rem', color: '#666', margin: 0, lineHeight: '1.4' }}>
                      {shop.description 
                        ? shop.description.split('/').map((line, idx) => (
                            <React.Fragment key={idx}>
                              {line}
                              {idx < shop.description.split('/').length - 1 && <br />}
                            </React.Fragment>
                          ))
                        : '店舗の詳細情報は準備中です。'
                      }
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#cbd5e1', fontSize: '0.7rem' }}>
        © 2026 Solopreneur Portal SoloPre
      </div>
    </div>
  );
}

export default ShopList;