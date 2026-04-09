import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
// 🆕 共通マスター（大カテゴリのリスト）をインポート
import { INDUSTRY_LABELS } from '../constants/industryMaster';
import { MapPin, User, LogIn, Heart, Calendar, LogOut, X, Mail, ChevronRight } from 'lucide-react';
// 🎮 🆕 ゲームの司令塔（ハブ）をインポート！ [cite: 2025-12-03]
import GameQuestHub from '../components/game/GameQuestHub';
const profileInputStyle = { width: '100%', padding: '8px', borderRadius: '6px', border: 'none', color: '#333', fontSize: '0.9rem', boxSizing: 'border-box' };
const profileSmallBtnStyle = { padding: '8px 12px', background: '#fff', color: '#07aadb', border: 'none', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' };
const profileActionBtnStyle = { flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' };

// 🆕 ここから追記：モーダル内で使う共通スタイル（エラー解消用）
const modalInputStyle = { padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', width: '100%', boxSizing: 'border-box' };
const modalPrimaryBtnStyle = { background: '#0f172a', color: '#fff', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px', fontSize: '1.05rem', boxShadow: '0 10px 15px -3px rgba(15,23,42,0.3)', width: '100%' };

function Home() {
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [newShops, setNewShops] = useState([]); 
  const [currentSlide, setCurrentSlide] = useState(0);
  const [topics, setTopics] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  // 🆕 プロフィール編集モードのON/OFF
  const [isEditingProfile, setIsEditingProfile] = useState(false); 
  // 🆕 編集中の各項目をまとめて管理する箱
  const [editFields, setEditFields] = useState({
    display_name: '',
    zip_code: '',
    address: '',
    phone: ''
  });
const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // 🆕 追加：多段登録フロー用
  const [signUpStep, setSignUpStep] = useState('email'); // 'email' | 'otp' | 'password' | 'profile'
  const [otpCode, setOtpCode] = useState('');
  // 🆕 追記：ローカルで生成した6ケタを一時保存する箱
  const [generatedOtpTemp, setGeneratedOtpTemp] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [regName, setRegName] = useState('');
  const [activeTabModal, setActiveTabModal] = useState(null);
  const [favorites, setFavorites] = useState([]); 
  const [myHistory, setMyHistory] = useState([]); // 履歴用

  const getDaysUntil = (dateStr) => {
    const target = new Date(dateStr);
    const today = new Date();
    // 時刻のズレで計算が狂わないよう、00:00:00にリセット [cite: 2025-12-01]
    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    // ミリ秒の差分を日にちに変換
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const sliderImages = [
    { id: 1, url: 'https://images.unsplash.com/photo-1600880210836-8f8fe100a35c?auto=format&fit=crop&w=1200&q=80', title: '自分らしく、働く。', desc: 'Solopreneurを支えるポータルサイト' },
    { id: 2, url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80', title: '次世代の予約管理', desc: 'SOLOでビジネスを加速させる' },
    { id: 3, url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80', title: '新しい繋がりを。', desc: 'あなたのサービスを世界へ届けよう' },
  ];

  // 🆕 1. 【部品】ポータルデータを読み込む関数（最優先で実行される）
  const fetchPortalData = async () => {
    try {
      // ✅ 🆕 修正：プラン2（フルプラン）かつ「店舗(shop)」だけを表示する
      const shopRes = await supabase
        .from('profiles')
        .select('*')
        .eq('is_suspended', false)
        .eq('service_plan', 2)
        .eq('role', 'shop') // 🚀 ここを追記！これで管理者がリストから消えます
        .not('business_name', 'is', null);

      if (shopRes.data) {
        setShops(shopRes.data);
        setNewShops([...shopRes.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3));
      }
      const newsRes = await supabase.from('portal_news').select('*').order('sort_order', { ascending: true });
      if (newsRes.data) setTopics(newsRes.data);
      const catRes = await supabase.from('portal_categories').select('*').order('sort_order', { ascending: true });
      if (catRes.data) setCategoryList(catRes.data);
    } catch (err) {
      console.error("Portal Data Error:", err);
    }
  };

  // 🆕 2. 【部品】ユーザー情報と履歴を同期する関数
const handleSyncUser = async (session) => {
    if (!session) return;
    try {
      // 1. まず、app_usersにデータがあるか確認（読み込みを先に行う）
      const { data: appUser, error: fetchError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      let currentUser = appUser;

      // 🆕 強化ポイント：データが「本当に存在しない」時だけ作成処理を行う
      if (!appUser && !fetchError) {
        const randomId = `user_${Math.random().toString(36).substring(2, 7)}`;
        
        // upsertを使用し、もし一瞬の差でデータが作られていてもエラーにしない設定
        const { data: newUser, error: insError } = await supabase
          .from('app_users')
          .upsert({
            id: session.user.id,
            display_id: randomId,
            display_name: session.user.user_metadata?.full_name || 'ゲストユーザー',
            email: session.user.email,
            avatar_url: session.user.user_metadata?.avatar_url || null
          }, { onConflict: 'id' }) // IDが重なったら更新（無視）する
          .select()
          .single();
        
if (!insError) {
          currentUser = newUser;
        }
      }

      // 🤝 ここに配置することで、新規登録時もリロード時も常に最新の名寄せを試みます
      if (currentUser) {
        setUserProfile(currentUser);

        // 🆕 1. メールアドレスで紐付け（存在する場合のみ）
        if (session.user.email) {
          supabase.from('customers')
            .update({ auth_id: session.user.id })
            .eq('email', session.user.email)
            .then();
        }

        // 🆕 2. 電話番号で紐付け
        // Googleから取得できる場合、または今後プロフィールに電話番号を保存した場合に備えます
        const userPhone = currentUser.phone || session.user.phone || session.user.user_metadata?.phone;
        if (userPhone) {
          supabase.from('customers')
            .update({ auth_id: session.user.id })
            .eq('phone', userPhone)
            .then();
        }
      }
      // 2. プロフィール情報をセット
      if (currentUser) {
        setUserProfile(currentUser);
      }

      // 3. 履歴取得（独立したtry-catchで安全に実行）
try {
        // 1. 予約履歴の取得
        const { data: history } = await supabase
          .from('reservations')
          .select('*, profiles(id, business_name)')
          .eq('customer_email', session.user.email)
          .order('start_time', { ascending: false });
        if (history) setMyHistory(history);

        // 🆕 2. お気に入り店舗の取得（店舗詳細 profiles も結合）
        const { data: favs } = await supabase
          .from('favorites')
          .select('*, profiles(*)')
          .eq('user_id', session.user.id);

        if (favs) {
          // ✅ 🆕 修正：プラン2（フルプラン）の店舗だけに絞り込む
          // profilesが存在しない（店舗削除済み）や、プラン1の店舗を一覧から除外します
          const activeFavs = favs.filter(f => f.profiles && f.profiles.service_plan === 2);
          setFavorites(activeFavs);
        }

      } catch (hErr) {
        console.warn("データの同期をスキップしました:", hErr);
      }

} catch (err) {
      console.error("ユーザー同期中にエラーが発生しました:", err);
    }
  };

// 🆕 プロフィール情報をデータベースに保存する関数
  const handleUpdateProfile = async () => {
    if (!editFields.display_name.trim()) return alert("お名前は必須です");

    try {
      const { error } = await supabase
        .from('app_users')
        .update({ 
          display_name: editFields.display_name,
          zip_code: editFields.zip_code,
          address: editFields.address,
          phone: editFields.phone
        })
        .eq('id', user.id);

      if (error) throw error;

      // 保存成功：画面表示を最新にする
      setUserProfile({ ...userProfile, ...editFields });
      setIsEditingProfile(false);

      // 🤝 【重要】電話番号が登録されたなら、名寄せ（customersテーブルとの紐付け）を実行
      if (editFields.phone) {
        await supabase.from('customers')
          .update({ auth_id: user.id })
          .eq('phone', editFields.phone);
      }

      alert("プロフィールを更新しました！");
    } catch (err) {
      console.error("Profile Update Error:", err);
      alert("更新に失敗しました。");
    }
  };

  // 🆕 郵便番号から住所を自動取得する関数
  const handleZipSearch = async () => {
    const zip = editFields.zip_code.replace(/[^0-9]/g, '');
    if (zip.length < 7) return alert("郵便番号を7桁で入力してください");
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`);
      const data = await res.json();
      if (data.results) {
        const { address1, address2, address3 } = data.results[0];
        setEditFields({ ...editFields, address: `${address1}${address2}${address3}` });
      } else {
        alert("住所が見つかりませんでした");
      }
    } catch (err) { console.error("Zip Search Error:", err); }
  };
    
  // 🆕 3. 【司令塔】useEffect：ページを開いた瞬間に一度だけ動く
  useEffect(() => {
    const scrollTimer = setTimeout(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, 100);
    const sliderTimer = setInterval(() => { setCurrentSlide((prev) => (prev === sliderImages.length - 1 ? 0 : prev + 1)); }, 5000);

    // 🔥 トピック読み込みを真っ先に実行！
    fetchPortalData();

    // 初期セッションチェック
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        handleSyncUser(session);
      }
    };
    checkSession();

// 認証状態の監視
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      
      if (session) {
        // 🆕 参照用フラグ(Ref)を見て、登録中ならモーダルを閉じないようにする
        if (isSignUpModeRef.current) {
          console.log("🛠 登録フロー継続中：モーダルを維持します");
        } else {
          setIsModalOpen(false);
        }
        handleSyncUser(session);
      } else {
        setUserProfile(null);
        setMyHistory([]);
      }
    });

    return () => {
      clearTimeout(scrollTimer);
      clearInterval(sliderTimer);
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 🆕 ステート
const [isSignUpMode, setIsSignUpMode] = useState(false);
  // 🆕 追加：監視役（useEffect）が参照するための最新フラグ
  const isSignUpModeRef = React.useRef(false);

  // ステートが変わるたびに参照用フラグも更新する
  useEffect(() => {
    isSignUpModeRef.current = isSignUpMode;
  }, [isSignUpMode]);

// 🆕 1. 新規登録フロー：自前の Edge Function (Resend) を使用
  const handleSignUpFlow = async (e) => {
    e.preventDefault();
    try {
      if (signUpStep === 'email') {
        // 【ステップ1】自前で6ケタの数字を生成して送信
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedOtpTemp(generatedOtp); // 検証用に保存

        // Edge Function 'resend' を呼び出し
        const { data, error } = await supabase.functions.invoke('resend', {
          body: { 
            type: 'signup_otp', 
            customerEmail: email, 
            otpCode: generatedOtp 
          }
        });

if (error) {
          console.error("Function Error:", error);
          throw error;
        }

        // 🆕 修正ポイント：サーバーからの返答が「文字列」でも「オブジェクト」でも100%見抜く
        console.log("Server Raw Data:", data);
        
        let isSuccess = false;
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            isSuccess = parsed.success === true;
          } catch (e) { isSuccess = false; }
        } else {
          isSuccess = data?.success === true;
        }

        if (isSuccess) {
          // 成功した時だけ次のステップへ進む
          setSignUpStep('otp');
          alert("認証コードを @snipsnap.biz から送信しました！");
        } else {
          console.error("判定失敗時のデータ:", data);
          throw new Error("メール送信に失敗しました（サーバーからの返答を確認できません）");
        }

      } else if (signUpStep === 'otp') {

        // 【ステップ2】ローカルで数字が一致するかチェック
        if (otpCode === generatedOtpTemp) {
          setSignUpStep('password');
        } else {
          alert("認証コードが一致しません。");
        }
        
      } else if (signUpStep === 'password') {
        // 【ステップ3】パスワード設定 ＆ Supabaseへの本登録
        if (password !== confirmPassword) return alert("パスワードが一致しません");
        if (password.length < 8) return alert("8文字以上で入力してください");
        
        // ここで実際に Supabase Auth にアカウントを作成
        // ※Supabase管理画面で "Confirm email" を OFF にしておくとスムーズです
        const { error } = await supabase.auth.signUp({ 
          email, 
          password 
        });

        if (error) throw error;
        setSignUpStep('profile');

} else if (signUpStep === 'password') {
        // 🔑 【ステップ3】パスワード設定（アカウントの作成）
        if (password !== confirmPassword) return alert("パスワードが一致しません");
        if (password.length < 8) return alert("8文字以上で入力してください");
        
        // 🆕 重要：自前OTPで確認済みなので、ここで初めて Auth にユーザーを作ります
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password 
        });

        if (signUpError) throw signUpError;
        
        // 🆕 ユーザーが作成されたら、次の「プロフィール（電話番号）」ステップへ
        if (signUpData.user) {
          console.log("👤 ユーザー作成成功:", signUpData.user.id);
          setSignUpStep('profile');
        }

} else if (signUpStep === 'profile') {
        // 📱 【ステップ4】お名前と電話番号の最終登録
        if (!regName) return alert("お名前を入力してください");
        if (!phone) return alert("電話番号を入力してください");
        
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error("セッションが見つかりません。");

        const randomId = `user_${Math.random().toString(36).substring(2, 7)}`;

        const { error: updateError } = await supabase.from('app_users').upsert({ 
          id: currentUser.id,
          display_id: randomId,
          phone: phone,
          email: currentUser.email,
          display_name: regName, // 🆕 '新ユーザー' から変更
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        
        if (updateError) throw updateError;

        alert(`ご登録ありがとうございます、${regName} 様！`);
        
        setIsSignUpMode(false); 
        setIsModalOpen(false);
        setSignUpStep('email'); 
        handleSyncUser({ user: currentUser });
      }      
        } catch (err) {
      alert("エラーが発生しました: " + err.message);
    }
  };

  // 🆕 2. ログイン専用の関数
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      let loginEmail = email;
      // IDログイン対応
      if (!email.includes('@')) {
        const { data: profile } = await supabase.from('app_users').select('email').eq('display_id', email).maybeSingle();
        if (!profile) return alert("ユーザーIDが見つかりません。");
        loginEmail = profile.email;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error) throw error;
      
      setIsModalOpen(false);
    } catch (err) {
      alert("ログイン失敗: " + err.message);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) alert(error.message);
  };

  const handleLogout = async () => {
    if (window.confirm("ログアウトしますか？")) {
      await supabase.auth.signOut();
    }
  };

  return (
    <div style={{ backgroundColor: '#f4f7f9', minHeight: '100vh', fontFamily: '"Hiragino Sans", "Meiryo", sans-serif', color: '#333', width: '100%' }}>
      
      {/* 1. ヘッダーエリア（🆕 ログイン対応版） */}
      <div style={{ background: '#fff', padding: '15px 20px', borderBottom: '1px solid #eee', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1 style={{ color: '#07aadb', fontSize: '1.6rem', fontWeight: '900', margin: 0, letterSpacing: '-1.5px' }}>SOLO</h1>
            <div style={{ height: '20px', width: '1px', background: '#ccc', margin: '0 12px' }}></div>
            <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>Solopreneur Portal</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
{user.user_metadata?.avatar_url ? (
  <img 
    src={user.user_metadata.avatar_url} 
    style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #07aadb' }} 
    alt="profile" 
  />
) : (
  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #07aadb' }}>
    <User size={18} color="#07aadb" />
  </div>
)}
         <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><LogOut size={18} color="#666" /></button>
              </div>
            ) : (
              <button onClick={() => setIsModalOpen(true)} style={{ background: '#07aadb', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(7,170,219,0.2)' }}>
                ログイン
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. 自動カルーセルスライダー */}
      <div style={{ width: '100%', position: 'relative', height: '320px', overflow: 'hidden', background: '#000' }}>
        {sliderImages.map((slide, index) => (
          <div
            key={slide.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundImage: `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.5)), url(${slide.url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: index === currentSlide ? 1 : 0,
              transition: 'opacity 1.5s ease-in-out',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#fff',
              textAlign: 'center'
            }}
          >
            <h2 style={{ fontSize: '2rem', fontWeight: '900', margin: '0 0 10px 0', textShadow: '0 2px 15px rgba(0,0,0,0.6)', transform: index === currentSlide ? 'translateY(0)' : 'translateY(20px)', transition: '0.8s ease-out' }}>
              {slide.title}
            </h2>
            <p style={{ fontSize: '1rem', margin: 0, textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
              {slide.desc}
            </p>
          </div>
        ))}
        <div style={{ position: 'absolute', bottom: '20px', width: '100%', display: 'flex', justifyContent: 'center', gap: '10px' }}>
          {sliderImages.map((_, i) => (
            <div key={i} onClick={() => setCurrentSlide(i)} style={{ width: '8px', height: '8px', borderRadius: '50%', background: i === currentSlide ? '#fff' : 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: '0.3s' }}></div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
        
{/* 🆕 お客様専用：ログイン後のパーソナライズボード */}
{user && !isSignUpMode && (
  <div style={{ background: 'linear-gradient(135deg, #07aadb 0%, #0284c7 100%)', borderRadius: '16px', padding: '20px', marginBottom: '25px', color: '#fff', boxShadow: '0 8px 20px rgba(7, 170, 219, 0.2)' }}>
    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 'normal' }}>
        @{userProfile?.display_id || 'guest_user'}
      </span>

      {/* 🆕 プロフィール編集モードの条件分岐 */}
      {isEditingProfile ? (
        /* --- 編集用フォームを表示 --- */
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '12px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '4px', opacity: 0.9 }}>お名前</label>
            <input value={editFields.display_name} onChange={(e) => setEditFields({...editFields, display_name: e.target.value})} style={profileInputStyle} />
          </div>
          
          <div>
            <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '4px', opacity: 0.9 }}>メールアドレス（編集不可）</label>
            <div style={{ fontSize: '0.9rem', padding: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '6px', opacity: 0.8 }}>{userProfile?.email}</div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '4px', opacity: 0.9 }}>郵便番号</label>
              <input value={editFields.zip_code} onChange={(e) => setEditFields({...editFields, zip_code: e.target.value})} placeholder="000-0000" style={profileInputStyle} />
            </div>
            <button onClick={handleZipSearch} style={profileSmallBtnStyle}>住所検索</button>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '4px', opacity: 0.9 }}>住所</label>
            <input value={editFields.address} onChange={(e) => setEditFields({...editFields, address: e.target.value})} style={profileInputStyle} />
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '4px', opacity: 0.9 }}>電話番号</label>
            <input value={editFields.phone} onChange={(e) => setEditFields({...editFields, phone: e.target.value})} style={profileInputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
            <button onClick={handleUpdateProfile} style={{ ...profileActionBtnStyle, background: '#fff', color: '#07aadb' }}>保存する</button>
            <button onClick={() => setIsEditingProfile(false)} style={{ ...profileActionBtnStyle, background: 'rgba(255,255,255,0.2)', color: '#fff' }}>キャンセル</button>
          </div>
        </div>
      ) : (
        /* --- 通常の表示を表示 --- */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.2rem', lineHeight: '1.4' }}>
              {/* 🆕 時間帯で挨拶を変えるロジック */}
              {(() => {
                const hour = new Date().getHours();
                if (hour >= 5 && hour < 11) return 'おはようございます';
                if (hour >= 11 && hour < 18) return 'こんにちは';
                return 'こんばんは';
              })()}
              <br /> {/* 🆕 挨拶の後で改行 */}
              <span style={{ fontSize: '1.4rem', fontWeight: '900' }}>
                {userProfile?.display_name || 'ゲスト'} 様
              </span>
            </span>
            
            <button 
              onClick={() => {
                setEditFields({
                  display_name: userProfile?.display_name || '',
                  zip_code: userProfile?.zip_code || '',
                  address: userProfile?.address || '',
                  phone: userProfile?.phone || ''
                });
                setIsEditingProfile(true);
              }}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 'bold' }}
            >
              プロフィール編集
            </button>
          </div>
          {/* 🆕 住所表示(MapPin)のブロックを削除しました */}
        </div>
      )}
    </h2>

<div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
  {/* 予約確認ボタン */}
  <div 
    onClick={() => setActiveTabModal('history')}
    style={{ flex: 1, background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer' }}
  >
    <Calendar size={20} style={{ marginBottom: '4px' }} /><br/><span style={{ fontSize: '0.7rem' }}>予約確認</span>
  </div>

  {/* 🆕 履歴ボタンを追加 [cite: 2025-12-01] */}
  <div 
    onClick={() => setActiveTabModal('past_history')}
    style={{ flex: 1, background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer' }}
  >
    <div style={{ fontSize: '1.2rem', marginBottom: '4px', lineHeight: 1 }}>📚</div>
    <span style={{ fontSize: '0.7rem' }}>利用履歴</span>
  </div>

  {/* お気に入りボタン */}
  <div 
    onClick={() => setActiveTabModal('favorites')}
    style={{ flex: 1, background: 'rgba(255,255,255,0.15)', padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer' }}
  >
    <Heart size={20} style={{ marginBottom: '4px' }} /><br/><span style={{ fontSize: '0.7rem' }}>お気に入り</span>
  </div>
</div>
  </div>
)}

        {/* 3. 最新トピック */}
        {topics.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '15px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#e60012' }}>●</span> 最新トピック
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topics.map((topic, idx) => (
                <div key={topic.id} style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  padding: '10px 0', 
                  borderBottom: idx === topics.length - 1 ? 'none' : '1px solid #f0f0f0', 
                  gap: '10px' 
                }}>
                  <span style={{ fontSize: '0.75rem', color: '#999', minWidth: '68px', flexShrink: 0, paddingTop: '2px' }}>
                    {topic.publish_date}
                  </span>
                  <span style={{ 
                    fontSize: '0.6rem', 
                    background: topic.category === '重要' ? '#fee2e2' : '#f1f5f9', 
                    color: topic.category === '重要' ? '#ef4444' : '#64748b', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    minWidth: '50px',
                    textAlign: 'center'
                  }}>
                    {topic.category}
                  </span>
                  <span style={{ 
                    fontSize: '0.85rem', 
                    color: '#333', 
                    cursor: 'pointer',
                    flex: 1,
                    lineHeight: '1.5',
                    whiteSpace: 'normal',
                    wordBreak: 'break-all'
                  }}>
                    {topic.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Pick Up Solopreneur */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', letterSpacing: '1px', color: '#1a1a1a' }}>Pick Up Solopreneur</h3>
            <span style={{ fontSize: '0.7rem', color: '#999' }}>注目のソロ起業家たち</span>
          </div>
          <div style={{ display: 'grid', gap: '15px' }}>
            {newShops.map(shop => (
              <div key={shop.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', height: '120px' }}>
                <Link to={`/shop/${shop.id}/detail`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', width: '100%' }}>
<div style={{ 
  width: '120px', 
  minWidth: '120px', 
  height: '120px', 
  background: '#f1f5f9', // 🆕 少し明るいグレーに変更
  // 🆕 三土手さん案：画像がある時だけurl()を作る
  ...(shop.image_url && { backgroundImage: `url(${shop.image_url})` }), 
  backgroundSize: 'cover', 
  backgroundPosition: 'center', 
  position: 'relative', 
  flexShrink: 0 
}}>
                      {!shop.image_url && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '0.6rem', color: '#ccc' }}>NO IMAGE</div>}
                    <div style={{ position: 'absolute', top: '0', left: '0', background: 'rgba(230,0,18,0.9)', color: '#fff', fontSize: '0.5rem', fontWeight: 'bold', padding: '4px 8px', borderRadius: '0 0 4px 0' }}>PICK UP</div>
                  </div>
                  <div style={{ padding: '12px 15px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: '#2563eb', fontWeight: 'bold', marginBottom: '2px' }}>{shop.business_type}</div>
                    <h4 style={{ margin: '0 0 3px 0', fontSize: '1rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.business_name}</h4>
                    <p style={{ fontSize: '0.75rem', color: '#666', margin: 0, lineHeight: '1.4' }}>
                      {shop.description ? shop.description.substring(0, 50) + '...' : '店舗の詳細情報は準備中です。'}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>

{/* 5. カテゴリグリッド（大カテゴリのみを表示） */}
        <div style={{ marginBottom: '50px' }}>
          <div style={{ borderLeft: '4px solid #1e293b', paddingLeft: '15px', marginBottom: '25px' }}>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '900', color: '#1e293b' }}>FIND YOUR SERVICE</h3>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>カテゴリーから探す</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
            {/* 🆕 大カテゴリ（INDUSTRY_LABELS）に名前が含まれるものだけを抽出して表示 */}
            {categoryList
              .filter(cat => INDUSTRY_LABELS.includes(cat.name))
              .map((cat) => (
                <Link key={cat.name} to={`/category/${cat.name}`} style={{ textDecoration: 'none' }}>
                  <div style={{ height: '140px', borderRadius: '16px', backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.7)), url(${cat.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '15px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ color: '#fff', fontSize: '0.55rem', fontWeight: 'bold', letterSpacing: '1px', opacity: 0.8, marginBottom: '2px' }}>{cat.en_name}</div>
                      <div style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '900', letterSpacing: '0.5px' }}>{cat.name}</div>
                    </div>
                  </div>
                </Link>
            ))}
          </div>
        </div>
      </div>

{/* 🆕 ログイン・新規登録モーダル（中身を完全に復元） */}
      {isModalOpen && (
        <div 
          onClick={() => setIsModalOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ background: '#fff', width: '100%', maxWidth: '420px', borderRadius: '32px', padding: '40px', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
          >
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={24} color="#94a3b8" />
            </button>
            
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#1e293b', marginBottom: '8px' }}>
                {!isSignUpMode ? 'SOLOにログイン' : 
                  signUpStep === 'email' ? '新規アカウント作成' : 
                  signUpStep === 'otp' ? '認証コードを確認' : 
                  signUpStep === 'password' ? 'パスワード設定' : 'プロフィール登録'}
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                {!isSignUpMode ? 'スマートな予約体験を。' : 
                  signUpStep === 'email' ? 'まずはメールアドレスを送信してください' : 
                  signUpStep === 'otp' ? 'メールに届いた6ケタの番号を入力' : 
                  signUpStep === 'password' ? 'ログイン用のパスワードを決めましょう' : '最後に連絡先を教えてください'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(!isSignUpMode || signUpStep === 'email') && (
                <>
                  <button onClick={handleGoogleLogin} style={{ background: '#fff', color: '#334155', border: '2px solid #e2e8f0', padding: '14px', borderRadius: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', fontSize: '1rem' }}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="G" /> 
                    Googleで{!isSignUpMode ? 'ログイン' : '登録'}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }}></div>
                    <span style={{ padding: '0 16px', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>OR</span>
                    <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }}></div>
                  </div>
                </>
              )}

              <form onSubmit={isSignUpMode ? handleSignUpFlow : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {!isSignUpMode ? (
                  <>
                    <input type="text" placeholder="メールアドレス または ID" value={email} onChange={(e) => setEmail(e.target.value)} style={modalInputStyle} required />
                    <input type="password" placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)} style={modalInputStyle} required />
                    <button type="submit" style={modalPrimaryBtnStyle}>ログインして進む</button>
                  </>
                ) : (
                  <>
                    {signUpStep === 'email' && (
                      <>
                        <input type="email" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} style={modalInputStyle} required />
                        <button type="submit" style={modalPrimaryBtnStyle}>認証コードを送信</button>
                      </>
                    )}
                    {signUpStep === 'otp' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input type="text" placeholder="000000" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))} style={{ ...modalInputStyle, textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem', fontWeight: '900' }} required />
                        <button type="submit" style={modalPrimaryBtnStyle}>番号を認証する</button>
                        <button type="button" onClick={() => setSignUpStep('email')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>やり直す</button>
                      </div>
                    )}
                    {signUpStep === 'password' && (
                      <>
                        <input type="password" placeholder="新しいパスワード（8文字以上）" value={password} onChange={(e) => setPassword(e.target.value)} style={modalInputStyle} required />
                        <input type="password" placeholder="パスワード（確認用）" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={modalInputStyle} required />
                        <button type="submit" style={modalPrimaryBtnStyle}>パスワードを確定して次へ</button>
                      </>
                    )}
                    {signUpStep === 'profile' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <input type="text" placeholder="例：三土手 太郎" value={regName} onChange={(e) => setRegName(e.target.value)} style={modalInputStyle} required />
                        <input type="tel" placeholder="09012345678" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} style={modalInputStyle} required />
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0, lineHeight: '1.5' }}>💡 予約には住所が必要です。登録後、マイページから設定をお願いします。</p>
                        </div>
                        <button type="submit" style={modalPrimaryBtnStyle}>すべての登録を完了する</button>
                      </div>
                    )}
                  </>
                )}
              </form>

              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <button onClick={() => setIsSignUpMode(!isSignUpMode)} style={{ background: 'none', border: 'none', color: '#07aadb', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>
                  {isSignUpMode ? 'すでにアカウントをお持ちの方（ログイン）' : 'まだアカウントをお持ちでない方（新規登録）'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 予約履歴・お気に入り専用モーダル（背景タップ対応・ソート済み） */}
      {activeTabModal && (
        <div 
          onClick={() => setActiveTabModal(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(8px)' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ background: '#fff', width: '100%', maxWidth: '480px', borderRadius: '28px', padding: '30px', position: 'relative', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}
          >
            <button onClick={() => setActiveTabModal(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={24} color="#94a3b8" />
            </button>

            <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {activeTabModal === 'history' ? <Calendar size={24} color="#07aadb" /> : <Heart size={24} color="#07aadb" />}
              {activeTabModal === 'history' ? 'My Journey' : 'My Favorite'}
            </h3>

{/* 🆕 予約履歴・利用履歴の切り分け表示ロジック [cite: 2025-12-01] */}
{(activeTabModal === 'history' || activeTabModal === 'past_history') ? (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
    {myHistory.length > 0 ? (
      <>
        {/* 📅 「予約確認」タブの時：これからの予定（未来）だけを表示 [cite: 2026-03-01] */}
        {activeTabModal === 'history' && (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#07aadb', fontWeight: '900', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', background: '#07aadb', borderRadius: '50%' }}></div>
              これからの予定
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {myHistory
                .filter(res => new Date(res.start_time) >= new Date())
                .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                .map(res => (
                  <Link key={res.id} to={`/shop/${res.profiles?.id}/detail`} onClick={() => setActiveTabModal(null)} style={{ textDecoration: 'none' }}>
                    <div style={{ background: '#f0f9ff', borderRadius: '16px', padding: '16px', border: '2px solid #07aadb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontSize: '0.85rem', color: '#07aadb', fontWeight: 'bold' }}>
                            {new Date(res.start_time).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          
                          {/* 🆕 カウントダウンバッジ [cite: 2026-03-01] */}
                          {(() => {
                            const days = getDaysUntil(res.start_time);
                            if (days < 0) return null;
                            return (
                              <div style={{ background: days === 0 ? '#ef4444' : (days <= 3 ? '#f59e0b' : '#07aadb'), color: '#fff', padding: '2px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '900' }}>
                                {days === 0 ? '本日予約！' : `あと ${days} 日`}
                              </div>
                            );
                          })()}
                        </div>
                        <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#1e293b', margin: '2px 0' }}>{res.profiles?.business_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{res.menu_name}</div>
                      </div>
                      <ChevronRight size={20} color="#07aadb" />
                    </div>
                  </Link>
                ))}
            </div>
            {/* 未来の予約がない場合のメッセージ [cite: 2025-12-01] */}
            {myHistory.filter(res => new Date(res.start_time) >= new Date()).length === 0 && (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: '0.85rem' }}>現在、予定されている予約はありません</p>
            )}
          </div>
        )}

        {/* 📚 「利用履歴」タブの時：過去の履歴（ショップ別）だけを表示 [cite: 2025-12-01] */}
        {activeTabModal === 'past_history' && (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '900', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              ショップ別のご利用記録
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {(() => {
                const past = myHistory.filter(res => new Date(res.start_time) < new Date());
                if (past.length === 0) return <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: '0.85rem' }}>過去のご利用履歴はありません</p>;

                const shopGroups = past.reduce((acc, res) => {
                  const sId = res.profiles?.id || 'unknown';
                  if (!acc[sId]) {
                    acc[sId] = { profile: res.profiles, visits: [] };
                  }
                  acc[sId].visits.push(res);
                  return acc;
                }, {});

                return Object.values(shopGroups).map((group) => (
                  <Link key={group.profile.id} to={`/shop/${group.profile.id}/detail`} onClick={() => setActiveTabModal(null)} style={{ textDecoration: 'none' }}>
                    <div style={{ background: '#fff', borderRadius: '20px', padding: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#1e293b' }}>{group.profile.business_name}</div>
                          <div style={{ fontSize: '0.7rem', color: '#07aadb', fontWeight: 'bold', marginTop: '2px' }}>来店回数：{group.visits.length}回</div>
                        </div>
                        <ChevronRight size={20} color="#cbd5e1" />
                      </div>
                      <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '10px', fontSize: '0.75rem' }}>
                        <div style={{ color: '#64748b', marginBottom: '4px', fontSize: '0.65rem' }}>最新の利用日：{new Date(group.visits[0].start_time).toLocaleDateString('ja-JP')}</div>
                        <div style={{ color: '#1e293b', fontWeight: 'bold' }}>{group.visits[0].menu_name}</div>
                      </div>
                    </div>
                  </Link>
                ));
              })()}
            </div>
          </div>
        )}
      </>
    ) : (
      <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>履歴はありません</p>
    )}
  </div>
) : (
  /* --- お気に入り表示ロジック --- */
  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    {/* ...（既存のお気に入りコード）... */}
                    {favorites.length > 0 ? (
                  [...favorites].sort((a, b) => (a.profiles?.business_name || "").localeCompare(b.profiles?.business_name || "", 'ja'))
                  .map((fav) => (
                    <Link key={fav.id} to={`/shop/${fav.profiles?.id}/detail`} onClick={() => setActiveTabModal(null)} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ background: '#fff', borderRadius: '16px', padding: '12px', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.2s ease' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                        {fav.profiles?.image_url ? (
                          <img src={fav.profiles.image_url} style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover' }} alt="" />
                        ) : (
                          <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', color: '#cbd5e1', fontWeight: 'bold' }}>NO IMAGE</div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '900', fontSize: '1rem', color: '#1e293b' }}>{fav.profiles?.business_name}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>{fav.profiles?.business_type}</div>
                        </div>
                        <div style={{ color: '#cbd5e1' }}><ChevronRight size={20} /></div>
                      </div>
                    </Link>
                  ))
                ) : <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>登録はありません</p>}
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#cbd5e1', fontSize: '0.7rem' }}>
        <p>© 2026 Solopreneur Portal SOLO</p>
      </div>    </div>
  );
}

export default Home;