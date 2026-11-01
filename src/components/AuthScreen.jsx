import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { auth } from '../utils/firebase.js'
import './AuthScreen.css'

function getAuthMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'Email ini sudah memiliki akun. Coba masuk.',
    'auth/account-exists-with-different-credential': 'Email ini sudah terhubung ke metode masuk lain.',
    'auth/cancelled-popup-request': 'Permintaan masuk dibatalkan. Coba lagi.',
    'auth/invalid-credential': 'Email atau kata sandi tidak cocok.',
    'auth/invalid-email': 'Format email belum benar.',
    'auth/network-request-failed': 'Koneksi terputus. Periksa jaringan lalu coba lagi.',
    'auth/operation-not-allowed': 'Provider masuk belum diaktifkan di Firebase Console.',
    'auth/popup-blocked': 'Popup diblokir browser. Izinkan popup atau coba lagi.',
    'auth/popup-closed-by-user': 'Jendela Google ditutup sebelum proses selesai.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa saat nanti.',
    'auth/unauthorized-domain': 'Domain ini belum diizinkan di pengaturan Firebase Authentication.',
    'auth/weak-password': 'Gunakan kata sandi minimal 8 karakter.',
  }
  return messages[error.code] || 'Permintaan belum berhasil. Periksa data dan coba lagi.'
}

export default function AuthScreen({ user = null, setupError = '', onVerified = () => {} }) {
  const [view, setView] = useState('sign-in')
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function signInWithGoogle() {
    setError('')
    setNotice('')
    setIsSubmitting(true)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })

    try {
      const useRedirect = window.matchMedia('(pointer: coarse)').matches
      if (useRedirect) {
        await signInWithRedirect(auth, provider)
        return
      }
      await signInWithPopup(auth, provider)
    } catch (requestError) {
      if (requestError.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, provider)
          return
        } catch (redirectError) {
          setError(getAuthMessage(redirectError))
        }
      } else {
        setError(getAuthMessage(requestError))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSubmitting(true)

    try {
      if (view === 'sign-up') {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await sendEmailVerification(credential.user)
        setNotice('Tautan verifikasi sudah dikirim. Verifikasi email lalu masuk.')
      } else if (view === 'reset') {
        await sendPasswordResetEmail(auth, email.trim())
        setNotice('Jika email terdaftar, tautan reset kata sandi akan segera dikirim.')
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
    } catch (requestError) {
      setError(getAuthMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resendVerification() {
    setError('')
    setNotice('')
    setIsSubmitting(true)
    try {
      await sendEmailVerification(user)
      setNotice('Tautan verifikasi baru sudah dikirim.')
    } catch (requestError) {
      setError(getAuthMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function checkEmailVerification() {
    setError('')
    setNotice('')
    setIsSubmitting(true)
    try {
      await reload(user)
      if (!auth.currentUser?.emailVerified) {
        setError('Email belum terverifikasi. Buka tautan di inbox lalu coba lagi.')
        return
      }
      await auth.currentUser.getIdToken(true)
      onVerified(auth.currentUser)
    } catch (requestError) {
      setError(getAuthMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignOut() {
    setError('')
    try {
      await signOut(auth)
    } catch (requestError) {
      setError(getAuthMessage(requestError))
    }
  }

  const isVerifiedNotice = Boolean(user && !user.emailVerified)
  const title = isVerifiedNotice
    ? 'Verifikasi email kamu'
    : view === 'sign-up'
      ? 'Buat akun Sabar'
      : view === 'reset'
        ? 'Atur ulang kata sandi'
        : 'Selamat datang kembali'

  return (
    <main className="auth-page">
      <section className="auth-story">
        <a className="auth-brand" href="#home" aria-label="Sabar">
          <img className="brand-mark" src="/icon-192.png" alt="" />
          <span><strong>Sabar</strong><small>PRICE WATCH</small></span>
        </a>
        <div className="auth-story-copy">
          <p className="auth-kicker">PANTAU DENGAN TENANG</p>
          <h1>Harga yang kamu tunggu, dalam jangkauan.</h1>
          <p>Masuk untuk melihat produk dan riwayat harga yang tersimpan di akunmu.</p>
        </div>
        <p className="auth-story-foot">Akses akun dilindungi Firebase Authentication.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">AKUN SABAR</p>
          <h2>{title}</h2>

          {setupError ? (
            <div className="auth-message auth-error" role="alert">{setupError}</div>
          ) : isVerifiedNotice ? (
            <div className="verification-panel">
              <p>Tautan verifikasi sudah dikirim. Verifikasi email sebelum data pantauan dibuka.</p>
              <p className="verification-email">{user.email}</p>
              {notice && <div className="auth-message auth-success" role="status">{notice}</div>}
              {error && <div className="auth-message auth-error" role="alert">{error}</div>}
              <button type="button" className="auth-submit" onClick={resendVerification} disabled={isSubmitting}>
                {isSubmitting ? 'Mengirim...' : 'Kirim ulang verifikasi'}
              </button>
              <button type="button" className="auth-secondary" onClick={checkEmailVerification} disabled={isSubmitting}>
                Saya sudah verifikasi
              </button>
              <button type="button" className="auth-text-button" onClick={handleSignOut}>Keluar</button>
            </div>
          ) : (
            <>
              {view !== 'reset' && (
                <>
                  <button type="button" className="google-auth-button" onClick={signInWithGoogle} disabled={isSubmitting}>
                    <span className="google-mark" aria-hidden="true">G</span>
                    Lanjutkan dengan Google
                  </button>
                  <div className="auth-divider"><span>ATAU DENGAN EMAIL</span></div>
                </>
              )}
              {view !== 'reset' && (
                <div className="auth-tabs" role="tablist" aria-label="Jenis akun">
                  <button type="button" role="tab" aria-selected={view === 'sign-in'} className={view === 'sign-in' ? 'auth-tab auth-tab-active' : 'auth-tab'} onClick={() => { setView('sign-in'); setError(''); setNotice('') }}>Masuk</button>
                  <button type="button" role="tab" aria-selected={view === 'sign-up'} className={view === 'sign-up' ? 'auth-tab auth-tab-active' : 'auth-tab'} onClick={() => { setView('sign-up'); setError(''); setNotice('') }}>Daftar</button>
                </div>
              )}
              <form className="auth-form" onSubmit={handleSubmit}>
                <label className="form-field">
                  <span>Email</span>
                  <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </label>
                {view !== 'reset' && (
                  <label className="form-field">
                    <span>Kata sandi</span>
                    <input type="password" autoComplete={view === 'sign-up' ? 'new-password' : 'current-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
                    {view === 'sign-up' && <small>Minimal 8 karakter</small>}
                  </label>
                )}
                {error && <p className="form-error" role="alert">{error}</p>}
                {notice && <p className="auth-message auth-success" role="status">{notice}</p>}
                <button className="auth-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Memproses...' : view === 'sign-up' ? 'Buat akun' : view === 'reset' ? 'Kirim tautan reset' : 'Masuk'}
                </button>
              </form>
              {view === 'sign-in' && <button type="button" className="auth-text-button auth-forgot" onClick={() => { setView('reset'); setError(''); setNotice('') }}>Lupa kata sandi?</button>}
              {view === 'reset' && <button type="button" className="auth-text-button auth-forgot" onClick={() => { setView('sign-in'); setError(''); setNotice('') }}>Kembali ke masuk</button>}
              {view === 'sign-up' && <p className="auth-terms">Dengan membuat akun, data pantauan akan disimpan terpisah untuk akunmu.</p>}
            </>
          )}
        </div>
      </section>
    </main>
  )
}