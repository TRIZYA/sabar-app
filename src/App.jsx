import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import AuthScreen from './components/AuthScreen.jsx'
import { api, ApiError } from './utils/api.js'
import { auth, authPersistenceReady, firebaseAuthConfigured } from './utils/firebase.js'
import './App.css'

const initialProductForm = {
  url: '',
  name: '',
  currentPrice: '',
  targetPrice: '',
  image: '',
}

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatPrice(value) {
  const price = Number(value)
  return Number.isSafeInteger(price) && price > 0 ? currencyFormatter.format(price) : 'Belum diatur'
}

function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return 'Belum pernah'
  return new Intl.DateTimeFormat('id-ID', options).format(new Date(value))
}

function isTargetReached(product) {
  const currentPrice = Number(product.currentPrice)
  const targetPrice = Number(product.targetPrice)
  return Number.isSafeInteger(currentPrice) && currentPrice > 0
    && Number.isSafeInteger(targetPrice) && targetPrice > 0
    && currentPrice <= targetPrice
}

function hasProductUrl(product) {
  try {
    const url = new URL(product?.url)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}

function isProductIncomplete(product) {
  return !(typeof product?.name === 'string' && product.name.trim())
    || !hasProductUrl(product)
    || !Number.isSafeInteger(Number(product.currentPrice)) || Number(product.currentPrice) <= 0
    || !Number.isSafeInteger(Number(product.targetPrice)) || Number(product.targetPrice) <= 0
}

function getProductName(product) {
  const name = typeof product?.name === 'string' ? product.name.trim() : ''
  return name || 'Produk tanpa nama'
}

function getVisibleProducts(products, search, storeFilter, statusFilter) {
  return products
    .filter((product) => {
      const searchableText = `${getProductName(product)} ${product.store || ''} ${product.url || ''}`.toLowerCase()
      const matchesSearch = searchableText.includes(search.trim().toLowerCase())
      const matchesStore = storeFilter === 'all' || product.store === storeFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'target' && isTargetReached(product))
        || (statusFilter === 'error' && (product.status === 'error' || isProductIncomplete(product)))
        || (statusFilter === 'paused' && product.status === 'dijeda')
        || (statusFilter === 'active' && product.status === 'aktif' && !isTargetReached(product))
      return matchesSearch && matchesStore && matchesStatus
    })
    .sort((left, right) => {
      const targetOrder = Number(isTargetReached(right)) - Number(isTargetReached(left))
      return targetOrder || Number(right.createdAt || 0) - Number(left.createdAt || 0)
    })
}

function PriceChart({ points, targetPrice }) {
  if (points.length === 0) {
    return <div className="chart-empty">Riwayat harga belum tersedia.</div>
  }

  const width = 760
  const height = 250
  const padding = 28
  const hasTarget = Number.isSafeInteger(Number(targetPrice)) && Number(targetPrice) > 0
  const prices = points.map((point) => Number(point.price))
  if (hasTarget) prices.push(Number(targetPrice))
  const minimum = Math.min(...prices)
  const maximum = Math.max(...prices)
  const range = maximum - minimum || 1
  const xFor = (index) => padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2)
  const yFor = (price) => height - padding - ((Number(price) - minimum) / range) * (height - padding * 2)
  const linePoints = points.map((point, index) => `${xFor(index)},${yFor(point.price)}`).join(' ')

  return (
    <svg
      className="price-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Grafik riwayat harga dan harga target"
      preserveAspectRatio="none"
    >
      <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} className="chart-axis" />
      {hasTarget && <line x1={padding} x2={width - padding} y1={yFor(targetPrice)} y2={yFor(targetPrice)} className="chart-target" />}
      <polyline points={linePoints} className="chart-line" />
      {points.map((point, index) => (
        <circle key={`${point.id}-${point.checkedAt}`} cx={xFor(index)} cy={yFor(point.price)} r="4" className="chart-point">
          <title>{`${formatPrice(point.price)} - ${formatDate(point.checkedAt)}`}</title>
        </circle>
      ))}
    </svg>
  )
}

function StatusBadge({ product }) {
  if (product.status === 'error') {
    return <span className="status-badge status-error"><span className="status-dot" />Butuh perhatian</span>
  }
  if (product.status === 'dijeda') {
    return <span className="status-badge status-paused"><span className="status-dot" />Dijeda</span>
  }
  if (isProductIncomplete(product)) {
    return <span className="status-badge status-error"><span className="status-dot" />Data belum lengkap</span>
  }
  if (isTargetReached(product)) {
    return <span className="status-badge status-target"><span className="status-dot" />Target tercapai</span>
  }
  return <span className="status-badge status-active"><span className="status-dot" />Aktif</span>
}

function ProductImage({ product }) {
  const initials = getProductName(product)
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()

  return (
    <div className="product-image" aria-hidden="true">
      <span>{initials || 'PR'}</span>
      {product.image && <img src={product.image} alt="" onError={(event) => event.currentTarget.remove()} />}
    </div>
  )
}

function Dashboard({ user }) {
  const [products, setProducts] = useState([])
  const [pageState, setPageState] = useState('loading')
  const [pageError, setPageError] = useState('')
  const [connectionState, setConnectionState] = useState('checking')
  const [search, setSearch] = useState('')
  const [storeFilter, setStoreFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formStep, setFormStep] = useState(1)
  const [productForm, setProductForm] = useState(initialProductForm)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [notice, setNotice] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [priceHistory, setPriceHistory] = useState([])
  const [isPriceEditorOpen, setIsPriceEditorOpen] = useState(false)
  const [priceEditValue, setPriceEditValue] = useState('')
  const [priceEditError, setPriceEditError] = useState('')
  const [historyRange, setHistoryRange] = useState('30')
  const [historyAnchor, setHistoryAnchor] = useState(0)
  const [detailState, setDetailState] = useState('idle')
  const [isProductEditorOpen, setIsProductEditorOpen] = useState(false)
  const [productEditForm, setProductEditForm] = useState({ name: '', url: '', targetPrice: '' })
  const [productEditError, setProductEditError] = useState('')
  const [isSavingProductEdit, setIsSavingProductEdit] = useState(false)

  useEffect(() => {
    let active = true

    api.getProducts()
      .then((items) => {
        if (!active) return
        setProducts(items)
        setPageState('ready')
      })
      .catch((error) => {
        if (!active) return
        setPageError(error.message)
        setPageState('error')
      })

    api.healthFirebase()
      .then(() => active && setConnectionState('online'))
      .catch(() => active && setConnectionState('offline'))

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), 4200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const visibleProducts = getVisibleProducts(products, search, storeFilter, statusFilter)
  const stores = [...new Set(products.map((product) => product.store).filter(Boolean))].sort()
  const reachedCount = products.filter(isTargetReached).length
  const issueCount = products.filter((product) => product.status === 'error' || isProductIncomplete(product)).length
  const pausedCount = products.filter((product) => product.status === 'dijeda').length

  async function refreshProducts(showLoading = false) {
    if (showLoading) setIsRefreshing(true)
    try {
      const items = await api.getProducts()
      setProducts(items)
      setPageError('')
      setPageState('ready')
    } catch (error) {
      setPageError(error.message)
      if (products.length === 0) setPageState('error')
      else setNotice({ type: 'error', message: error.message })
    } finally {
      setIsRefreshing(false)
    }
  }

  function openAddForm() {
    setProductForm(initialProductForm)
    setFormStep(1)
    setFormError('')
    setIsAddOpen(true)
  }

  function closeAddForm() {
    if (isSaving) return
    setIsAddOpen(false)
    setFormError('')
  }

  function continueToDetails(event) {
    event.preventDefault()
    setFormError('')
    try {
      const url = new URL(productForm.url.trim())
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Gunakan URL produk publik yang diawali http:// atau https://.')
      }
      setProductForm((current) => ({ ...current, url: url.toString() }))
      setFormStep(2)
    } catch (error) {
      setFormError(error.message || 'Masukkan URL produk yang valid.')
    }
  }

  async function saveProduct(event) {
    event.preventDefault()
    setFormError('')
    setIsSaving(true)
    try {
      const created = await api.createProduct({
        url: productForm.url,
        name: productForm.name,
        currentPrice: Number(productForm.currentPrice),
        targetPrice: Number(productForm.targetPrice),
        ...(productForm.image.trim() ? { image: productForm.image.trim() } : {}),
      })
      setProducts((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setPageState('ready')
      setIsAddOpen(false)
      setNotice({ type: 'success', message: 'Produk berhasil ditambahkan.' })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'DUPLICATE_PRODUCT') {
        setFormError('Tautan ini sudah ada di daftar pantauan.')
      } else {
        setFormError(error.message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function openProductDetails(product) {
    setSelectedProduct(product)
    setPriceHistory([])
    setPriceEditValue(String(product.currentPrice))
    setPriceEditError('')
    setIsPriceEditorOpen(false)
    setIsProductEditorOpen(false)
    setProductEditError('')
    setHistoryRange('30')
    setHistoryAnchor(Date.now())
    setDetailState('loading')
    try {
      const [detail, points] = await Promise.all([
        api.getProduct(product.id),
        api.getPriceHistory(product.id, 90),
      ])
      setSelectedProduct(detail)
      setPriceHistory(points)
      setDetailState('ready')
    } catch (error) {
      setDetailState('error')
      setNotice({ type: 'error', message: error.message })
    }
  }

  function openProductEditor(product) {
    setProductEditForm({
      name: typeof product.name === 'string' ? product.name : '',
      url: typeof product.url === 'string' ? product.url : '',
      targetPrice: Number.isSafeInteger(Number(product.targetPrice)) && Number(product.targetPrice) > 0
        ? String(product.targetPrice)
        : '',
    })
    setProductEditError('')
    setIsProductEditorOpen(true)
  }

  async function saveProductDetails(event) {
    event.preventDefault()
    setProductEditError('')
    const targetPrice = Number(productEditForm.targetPrice)
    if (!Number.isSafeInteger(targetPrice) || targetPrice <= 0) {
      setProductEditError('Masukkan harga target berupa bilangan bulat yang lebih dari nol.')
      return
    }

    setIsSavingProductEdit(true)
    try {
      const updated = await api.updateProduct(selectedProduct.id, {
        name: productEditForm.name.trim(),
        url: productEditForm.url.trim(),
        targetPrice,
      })
      setProducts((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setSelectedProduct(updated)
      setIsProductEditorOpen(false)
      setNotice({ type: 'success', message: 'Detail produk berhasil diperbaiki.' })
    } catch (error) {
      setProductEditError(error instanceof ApiError && error.code === 'DUPLICATE_PRODUCT'
        ? 'Tautan ini sudah digunakan oleh produk lain.'
        : error.message)
    } finally {
      setIsSavingProductEdit(false)
    }
  }

  async function updateProduct(product, patch) {
    setPendingAction(product.id)
    try {
      const updated = await api.updateProduct(product.id, patch)
      setProducts((current) => current.map((item) => (item.id === product.id ? updated : item)))
      setSelectedProduct((current) => current?.id === product.id ? updated : current)
      setNotice({ type: 'success', message: 'Perubahan produk tersimpan.' })
      if (patch.currentPrice !== undefined) {
        try {
          const points = await api.getPriceHistory(product.id, 90)
          setPriceHistory(points)
        } catch (error) {
          setNotice({ type: 'error', message: error.message })
        }
      }
      return true
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
      return false
    } finally {
      setPendingAction('')
    }
  }

  async function saveCurrentPrice(event) {
    event.preventDefault()
    setPriceEditError('')
    const currentPrice = Number(priceEditValue)
    if (!Number.isSafeInteger(currentPrice) || currentPrice <= 0) {
      setPriceEditError('Masukkan harga berupa bilangan bulat yang lebih dari nol.')
      return
    }
    const saved = await updateProduct(selectedProduct, { currentPrice })
    if (saved) setIsPriceEditorOpen(false)
  }

  async function removeProduct(product) {
    if (!window.confirm(`Hapus pantauan untuk "${getProductName(product)}" beserta riwayat harganya?`)) return
    setPendingAction(product.id)
    try {
      await api.deleteProduct(product.id)
      setProducts((current) => current.filter((item) => item.id !== product.id))
      if (selectedProduct?.id === product.id) setSelectedProduct(null)
      setNotice({ type: 'success', message: 'Produk dan riwayatnya berhasil dihapus.' })
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    } finally {
      setPendingAction('')
    }
  }

  function applySuggestedTarget() {
    const currentPrice = Number(productForm.currentPrice)
    if (currentPrice > 0) {
      setProductForm((current) => ({
        ...current,
        targetPrice: String(Math.round(currentPrice * 0.9)),
      }))
    }
  }

  const displayedHistory = priceHistory.filter((point) => {
    if (historyRange === 'all') return true
    const dayCount = Number(historyRange)
    return Number(point.checkedAt) >= historyAnchor - dayCount * 24 * 60 * 60 * 1000
  })

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Sabar, ke ringkasan">
          <img className="brand-mark" src="/icon-192.png" alt="" />
          <span className="brand-copy"><strong>Sabar</strong><small>PRICE WATCH</small></span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Navigasi utama">
          <a className="nav-item nav-item-active" href="#overview"><span className="nav-symbol">01</span>Ringkasan</a>
          <a className="nav-item" href="#products"><span className="nav-symbol">02</span>Produk dipantau</a>
        </nav>
        <div className="sidebar-bottom">
          <span className="sidebar-status"><span className={`connection-dot connection-${connectionState}`} />API {connectionState === 'online' ? 'terhubung' : connectionState === 'offline' ? 'terputus' : 'memeriksa'}</span>
          <span className="sidebar-caption">Pemantau harga pribadi</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>WORKSPACE</span><span className="breadcrumb-divider">/</span><strong>Ringkasan</strong></div>
          <div className="topbar-right"><span className="account-email" title={user.email}>{user.email}</span><button type="button" className="account-signout" onClick={() => signOut(auth)}>Keluar</button></div>
        </header>

        <div className="page-content">
          <section className="welcome-row" id="overview">
            <div>
              <p className="eyebrow">PANTAU HARGA, TENTUKAN WAKTU</p>
              <h1>Ringkasan pantauan</h1>
              <p className="welcome-copy">Semua yang kamu incar, terlihat dalam satu tempat.</p>
            </div>
            <button type="button" className="button button-primary add-button" onClick={openAddForm}>
              <span className="button-plus" aria-hidden="true">+</span> Tambah produk
            </button>
          </section>

          <section className="summary-grid" aria-label="Ringkasan produk">
            <article className="summary-item summary-total">
              <span className="summary-label">Produk dipantau</span>
              <strong className="summary-value">{pageState === 'loading' ? '—' : products.length}</strong>
              <span className="summary-note">Seluruh daftar pantauan</span>
            </article>
            <article className="summary-item summary-reached">
              <span className="summary-label">Target tercapai</span>
              <strong className="summary-value">{pageState === 'loading' ? '—' : reachedCount}</strong>
              <span className="summary-note">Harga sekarang di bawah target</span>
            </article>
            <article className="summary-item summary-attention">
              <span className="summary-label">Perlu perhatian</span>
              <strong className="summary-value">{pageState === 'loading' ? '—' : issueCount}</strong>
              <span className="summary-note">{pausedCount} pantauan dijeda</span>
            </article>
          </section>

          <section className="products-section" id="products">
            <div className="section-heading">
              <div>
                <p className="eyebrow">DAFTAR AKTIF</p>
                <h2>Produk yang dipantau</h2>
              </div>
              <button type="button" className="button button-quiet refresh-button" onClick={() => refreshProducts(true)} disabled={isRefreshing || pageState === 'loading'}>
                <span className={isRefreshing ? 'refresh-glyph is-spinning' : 'refresh-glyph'} aria-hidden="true">↻</span>
                {isRefreshing ? 'Memuat' : 'Segarkan'}
              </button>
            </div>

            <div className="filter-bar">
              <label className="search-control">
                <span aria-hidden="true" className="search-glyph">⌕</span>
                <span className="visually-hidden">Cari produk</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari produk atau toko" />
              </label>
              <label className="select-control">
                <span className="visually-hidden">Filter toko</span>
                <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
                  <option value="all">Semua toko</option>
                  {stores.map((store) => <option key={store} value={store}>{store}</option>)}
                </select>
              </label>
              <label className="select-control">
                <span className="visually-hidden">Filter status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">Semua status</option>
                  <option value="target">Target tercapai</option>
                  <option value="active">Aktif</option>
                  <option value="paused">Dijeda</option>
                  <option value="error">Bermasalah</option>
                </select>
              </label>
              <span className="result-count">{visibleProducts.length} produk</span>
            </div>

            <div className="product-list-wrap">
              {pageState === 'loading' && (
                <div className="state-panel loading-state" role="status"><span className="loading-ring" />Memuat data pantauan...</div>
              )}
              {pageState === 'error' && (
                <div className="state-panel error-state" role="alert">
                  <span className="state-kicker">KONEKSI TERGANGGU</span>
                  <h3>Daftar belum dapat dimuat</h3>
                  <p>{pageError}</p>
                  <button type="button" className="button button-secondary" onClick={() => refreshProducts(true)}>Coba lagi</button>
                </div>
              )}
              {pageState === 'ready' && products.length === 0 && (
                <div className="state-panel empty-state">
                  <div className="empty-illustration" aria-hidden="true"><span className="empty-ring" /><span className="empty-star">+</span></div>
                  <p className="state-kicker">MULAI DARI SATU PRODUK</p>
                  <h3>Belum ada yang dipantau</h3>
                  <p>Tambahkan produk dan tentukan harga yang ingin kamu capai.</p>
                  <button type="button" className="button button-primary" onClick={openAddForm}><span className="button-plus" aria-hidden="true">+</span> Tambah produk</button>
                </div>
              )}
              {pageState === 'ready' && products.length > 0 && visibleProducts.length === 0 && (
                <div className="state-panel no-results"><h3>Tidak ada hasil yang cocok</h3><p>Ubah pencarian atau filter, lalu coba lagi.</p></div>
              )}
              {pageState === 'ready' && visibleProducts.length > 0 && (
                <div className="table-scroll">
                  <table className="product-table">
                    <thead>
                      <tr><th>Produk</th><th>Harga sekarang</th><th>Target</th><th>Status</th><th>Terakhir dicek</th><th><span className="visually-hidden">Aksi</span></th></tr>
                    </thead>
                    <tbody>
                      {visibleProducts.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <div className="product-cell">
                              <ProductImage product={product} />
                              <div className="product-copy">
                                <button type="button" className="product-name" onClick={() => openProductDetails(product)}>{getProductName(product)}</button>
                                {hasProductUrl(product)
                                  ? <a className="product-store product-link" href={product.url} target="_blank" rel="noreferrer">{product.store || new URL(product.url).hostname}</a>
                                  : <span className="product-store">Tautan belum ada</span>}
                              </div>
                            </div>
                          </td>
                          <td className="price-cell">{formatPrice(product.currentPrice)}</td>
                          <td>
                            <div className="target-cell">
                              <strong>{formatPrice(product.targetPrice)}</strong>
                              {Number.isSafeInteger(Number(product.currentPrice)) && Number(product.currentPrice) > 0
                                && Number.isSafeInteger(Number(product.targetPrice)) && Number(product.targetPrice) > 0
                                && Number(product.currentPrice) > Number(product.targetPrice) && (
                                <span className="target-gap">{formatPrice(Number(product.currentPrice) - Number(product.targetPrice))} lagi</span>
                              )}
                            </div>
                          </td>
                          <td><StatusBadge product={product} /></td>
                          <td className="date-cell">{formatDate(product.lastCheckedAt)}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="icon-button"
                                title={product.status === 'dijeda' ? 'Lanjutkan pantauan' : 'Jeda pantauan'}
                                aria-label={product.status === 'dijeda' ? `Lanjutkan ${getProductName(product)}` : `Jeda ${getProductName(product)}`}
                                disabled={pendingAction === product.id || product.status === 'error'}
                                onClick={() => updateProduct(product, { status: product.status === 'dijeda' ? 'aktif' : 'dijeda' })}
                              >{product.status === 'dijeda' ? '▶' : 'Ⅱ'}</button>
                              <button type="button" className="icon-button icon-button-danger" title="Hapus produk" aria-label={`Hapus ${getProductName(product)}`} disabled={pendingAction === product.id} onClick={() => removeProduct(product)}>×</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="list-footer"><span>Urutan: target tercapai, lalu terbaru</span><span>Menampilkan maksimal 100 produk</span></div>
          </section>

          <footer className="page-footer"><span>Sabar <span className="footer-separator">/</span> Pemantau Harga</span><span>Data tersimpan di Firebase Realtime Database</span></footer>
        </div>
      </main>

      {notice && <div className={`toast toast-${notice.type}`} role="status"><span className="toast-mark">{notice.type === 'success' ? 'OK' : '!'}</span>{notice.message}<button type="button" aria-label="Tutup notifikasi" onClick={() => setNotice(null)}>×</button></div>}

      {isAddOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeAddForm()}>
          <section className="modal-card add-modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
            <div className="modal-header">
              <div><p className="eyebrow">PRODUK BARU</p><h2 id="add-title">Tambah pantauan</h2></div>
              <button type="button" className="icon-button modal-close" aria-label="Tutup" onClick={closeAddForm}>×</button>
            </div>
            <div className="step-indicator" aria-label={`Langkah ${formStep} dari 2`}>
              <span className={formStep === 1 ? 'step active' : 'step complete'}><b>01</b> Tautan</span>
              <span className="step-line" />
              <span className={formStep === 2 ? 'step active' : 'step'}><b>02</b> Detail</span>
            </div>
            {formStep === 1 ? (
              <form className="form-body" onSubmit={continueToDetails}>
                <label className="form-field">
                  <span>Tautan produk</span>
                  <input autoFocus type="url" inputMode="url" placeholder="https://toko.com/produk/..." value={productForm.url} onChange={(event) => setProductForm((current) => ({ ...current, url: event.target.value }))} required />
                </label>
                <p className="form-note">Pratinjau otomatis belum tersedia. Kamu tetap bisa menyimpan produk dengan mengisi nama dan harga secara manual.</p>
                {formError && <p className="form-error" role="alert">{formError}</p>}
                <div className="form-actions"><button type="button" className="button button-quiet" onClick={closeAddForm}>Batal</button><button type="submit" className="button button-primary">Lanjut ke detail <span aria-hidden="true">→</span></button></div>
              </form>
            ) : (
              <form className="form-body" onSubmit={saveProduct}>
                <div className="manual-preview"><span className="manual-preview-mark">i</span><span><strong>Isi detail produk manual</strong><small>Nama dan harga belum diambil otomatis dari toko.</small></span></div>
                <div className="source-link"><span>TAUTAN</span><strong>{productForm.url}</strong><button type="button" onClick={() => setFormStep(1)}>Ubah</button></div>
                <label className="form-field">
                  <span>Nama produk</span>
                  <input autoFocus type="text" maxLength="240" placeholder="Contoh: Headphone wireless" value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} required />
                </label>
                <div className="form-grid-two">
                  <label className="form-field">
                    <span>Harga sekarang</span>
                    <div className="input-with-prefix"><span>Rp</span><input type="number" min="1" step="1" inputMode="numeric" placeholder="0" value={productForm.currentPrice} onChange={(event) => setProductForm((current) => ({ ...current, currentPrice: event.target.value }))} required /></div>
                  </label>
                  <label className="form-field">
                    <span>Harga target</span>
                    <div className="input-with-prefix"><span>Rp</span><input type="number" min="1" step="1" inputMode="numeric" placeholder="0" value={productForm.targetPrice} onChange={(event) => setProductForm((current) => ({ ...current, targetPrice: event.target.value }))} required /></div>
                  </label>
                </div>
                <button type="button" className="suggestion-link" onClick={applySuggestedTarget}>Gunakan saran target 10% lebih rendah</button>
                <label className="form-field">
                  <span>URL gambar <small>Opsional</small></span>
                  <input type="url" inputMode="url" placeholder="https://..." value={productForm.image} onChange={(event) => setProductForm((current) => ({ ...current, image: event.target.value }))} />
                </label>
                {formError && <p className="form-error" role="alert">{formError}</p>}
                <div className="form-actions"><button type="button" className="button button-quiet" onClick={() => setFormStep(1)}>Kembali</button><button type="submit" className="button button-primary" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan produk'}</button></div>
              </form>
            )}
          </section>
        </div>
      )}

      {selectedProduct && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedProduct(null)}>
          <section className="modal-card detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <div className="modal-header detail-header">
              <div className="detail-title-wrap"><ProductImage product={selectedProduct} /><div><p className="eyebrow">DETAIL PANTAUAN</p><h2 id="detail-title">{getProductName(selectedProduct)}</h2>{hasProductUrl(selectedProduct) ? <a href={selectedProduct.url} target="_blank" rel="noreferrer">Buka halaman produk <span aria-hidden="true">↗</span></a> : <span className="missing-product-link">Tautan belum ada</span>}</div></div>
              <button type="button" className="icon-button modal-close" aria-label="Tutup detail" onClick={() => setSelectedProduct(null)}>×</button>
            </div>
            <div className="detail-status"><StatusBadge product={selectedProduct} /><span>{selectedProduct.store || 'Toko belum diketahui'}</span><span>Terakhir dicek {formatDate(selectedProduct.lastCheckedAt)}</span></div>
            {isProductIncomplete(selectedProduct) && !isProductEditorOpen && (
              <div className="incomplete-notice" role="status">
                Data lama belum lengkap. Masukkan nama, tautan, dan target yang benar agar bisa dipantau.
                <button type="button" className="auth-text-button" onClick={() => openProductEditor(selectedProduct)}>Perbaiki data</button>
              </div>
            )}
            {isProductEditorOpen && (
              <form className="product-edit-form" onSubmit={saveProductDetails}>
                <p className="price-edit-note">Isi data yang benar dari halaman toko. Aplikasi belum mengambil nama atau harga secara otomatis.</p>
                <label className="form-field"><span>Nama produk</span><input type="text" maxLength="240" value={productEditForm.name} onChange={(event) => setProductEditForm((current) => ({ ...current, name: event.target.value }))} required /></label>
                <label className="form-field"><span>Tautan produk</span><input type="url" inputMode="url" value={productEditForm.url} onChange={(event) => setProductEditForm((current) => ({ ...current, url: event.target.value }))} required /></label>
                <label className="form-field"><span>Harga target</span><div className="input-with-prefix"><span>Rp</span><input type="number" min="1" step="1" inputMode="numeric" placeholder="Masukkan target" value={productEditForm.targetPrice} onChange={(event) => setProductEditForm((current) => ({ ...current, targetPrice: event.target.value }))} required /></div></label>
                {productEditError && <p className="form-error" role="alert">{productEditError}</p>}
                <div className="form-actions"><button type="button" className="button button-quiet" onClick={() => setIsProductEditorOpen(false)}>Batal</button><button type="submit" className="button button-primary" disabled={isSavingProductEdit}>{isSavingProductEdit ? 'Menyimpan...' : 'Simpan detail'}</button></div>
              </form>
            )}
            <div className="detail-metrics">
              <div><span>Harga sekarang</span><strong>{formatPrice(selectedProduct.currentPrice)}</strong></div>
              <div><span>Harga target</span><strong>{formatPrice(selectedProduct.targetPrice)}</strong></div>
              <div><span>Terendah</span><strong>{formatPrice(selectedProduct.lowestPrice)}</strong></div>
              <div><span>Tertinggi</span><strong>{formatPrice(selectedProduct.highestPrice)}</strong></div>
            </div>
            <div className="price-edit-toggle">
              <button type="button" className="auth-text-button" onClick={() => {
                setPriceEditValue(String(selectedProduct.currentPrice))
                setPriceEditError('')
                setIsPriceEditorOpen((open) => !open)
              }}>{isPriceEditorOpen ? 'Tutup form harga' : 'Ubah harga sekarang'}</button>
            </div>
            {isPriceEditorOpen && (
              <form className="price-edit-form" onSubmit={saveCurrentPrice}>
                <label className="form-field">
                  <span>Harga sekarang</span>
                  <div className="input-with-prefix"><span>Rp</span><input type="number" min="1" step="1" inputMode="numeric" value={priceEditValue} onChange={(event) => setPriceEditValue(event.target.value)} required /></div>
                </label>
                <p className="price-edit-note">Harga ini akan dicatat sebagai titik riwayat manual.</p>
                {priceEditError && <p className="form-error" role="alert">{priceEditError}</p>}
                <div className="form-actions">
                  <button type="button" className="button button-quiet" onClick={() => { setIsPriceEditorOpen(false); setPriceEditError('') }}>Batal</button>
                  <button type="submit" className="button button-primary" disabled={pendingAction === selectedProduct.id}>{pendingAction === selectedProduct.id ? 'Menyimpan...' : 'Simpan harga'}</button>
                </div>
              </form>
            )}
            <div className="history-heading"><div><p className="eyebrow">PERGERAKAN HARGA</p><h3>Riwayat harga</h3></div><div className="range-control" aria-label="Rentang grafik">
              {[['7', '7 hari'], ['30', '30 hari'], ['all', 'Semua']].map(([value, label]) => <button key={value} type="button" className={historyRange === value ? 'range-active' : ''} onClick={() => setHistoryRange(value)}>{label}</button>)}
            </div></div>
            <div className="chart-legend">
              <span><i className="legend-current" />Harga tercatat</span>
              {Number.isSafeInteger(Number(selectedProduct.targetPrice)) && Number(selectedProduct.targetPrice) > 0 && <span><i className="legend-target" />Harga target</span>}
            </div>
            {detailState === 'loading' && <div className="detail-loading"><span className="loading-ring" />Memuat riwayat...</div>}
            {detailState === 'error' && <div className="chart-empty">Riwayat belum dapat dimuat.</div>}
            {detailState === 'ready' && <PriceChart points={displayedHistory} targetPrice={selectedProduct.targetPrice} />}
            {detailState === 'ready' && displayedHistory.length > 0 && (
              <div className="history-list">
                {displayedHistory.slice(-5).reverse().map((point) => <div className="history-row" key={`${point.id}-${point.checkedAt}`}><span>{formatDate(point.checkedAt)}</span><strong>{formatPrice(point.price)}</strong><span className="history-source">{point.source === 'manual' ? 'Manual' : 'Otomatis'}</span></div>)}
              </div>
            )}
            <div className="detail-actions">
              <button type="button" className="button button-secondary" onClick={() => openProductEditor(selectedProduct)} disabled={isSavingProductEdit}>Ubah detail</button>
              <button type="button" className="button button-secondary" disabled={pendingAction === selectedProduct.id || selectedProduct.status === 'error'} onClick={() => updateProduct(selectedProduct, { status: selectedProduct.status === 'dijeda' ? 'aktif' : 'dijeda' })}>{selectedProduct.status === 'dijeda' ? 'Lanjutkan pantauan' : 'Jeda pantauan'}</button>
              <button type="button" className="button button-danger" disabled={pendingAction === selectedProduct.id} onClick={() => removeProduct(selectedProduct)}>Hapus produk</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [authState, setAuthState] = useState(firebaseAuthConfigured ? 'loading' : 'configuration-error')

  useEffect(() => {
    if (!auth) return undefined

    let active = true
    let unsubscribe

    authPersistenceReady
      .then(() => {
        if (!active) return
        unsubscribe = onAuthStateChanged(auth, (nextUser) => {
          setUser(nextUser)
          if (!nextUser) setAuthState('signed-out')
          else if (nextUser.emailVerified) setAuthState('authenticated')
          else setAuthState('unverified')
        }, () => {
          if (active) setAuthState('auth-error')
        })
      })
      .catch(() => {
        if (active) setAuthState('auth-error')
      })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  if (authState === 'configuration-error') {
    return <AuthScreen setupError="Konfigurasi Firebase Auth belum lengkap. Periksa VITE_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, dan APP_ID di .env." />
  }
  if (authState === 'auth-error') {
    return <AuthScreen setupError="Sesi tidak dapat dimuat. Muat ulang halaman atau periksa konfigurasi Firebase Auth." />
  }
  if (authState === 'loading') {
    return <main className="auth-loading"><span className="loading-ring" />Memeriksa sesi akun...</main>
  }
  if (authState === 'unverified') return <AuthScreen user={user} onVerified={(verifiedUser) => { setUser(verifiedUser); setAuthState('authenticated') }} />
  if (authState === 'signed-out') return <AuthScreen />
  return <Dashboard user={user} />
}

export default App
