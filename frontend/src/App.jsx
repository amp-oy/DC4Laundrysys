import { useEffect, useState } from 'react'
import { apiRequest } from './api.js'
import './App.css'

const statusOrder = ['Received', 'Washing', 'Drying', 'Ready for Pickup', 'Completed']

const navItems = [
  { label: 'Overview', icon: 'grid' },
  { label: 'Orders', icon: 'clipboard' },
  { label: 'Customers', icon: 'users' },
  { label: 'Services', icon: 'shirt' },
  { label: 'Payments', icon: 'wallet' },
]

function Icon({ name, size = 20, ...props }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5.5h6a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 5.5Z" /><path d="M9 11h6M9 15h6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    shirt: <><path d="m16 4 5 3-3 4-2-1v10H8V10l-2 1-3-4 5-3a4 4 0 0 0 8 0Z" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 15h.01" /><path d="M7 5V3h10v2" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14m-7-7 7 7-7 7" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    down: <path d="m7 10 5 5 5-5" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    sparkle: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    filter: <><path d="M4 7h16M7 12h10m-7 5h4" /></>,
    dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2Z" transform="translate(-1 -1)" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  }

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths[name] || paths.grid}
    </svg>
  )
}

function formatCurrency(amount) {
  return `₱${Number(amount).toLocaleString('en-PH')}`
}

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function orderDateLabel(value) {
  const date = new Date(value)
  const dayDifference = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000)
  const dateLabel = dayDifference === 0
    ? 'Today'
    : dayDifference === 1
      ? 'Yesterday'
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return `${dateLabel}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function pickupDateLabel(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function AuthScreen({ onAuthenticated }) {
  const [accountType, setAccountType] = useState('customer')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    const formData = new FormData(event.currentTarget)
    const requestMode = accountType === 'customer' ? mode : 'login'
    const body = {
      ...Object.fromEntries(formData.entries()),
      ...(requestMode === 'login' ? { role: accountType } : {}),
    }

    try {
      const result = await apiRequest(requestMode === 'login' ? '/login' : '/register', { method: 'POST', body })
      onAuthenticated(result)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <a className="brand auth-brand" href="#login"><span className="brand-mark"><Icon name="sparkle" size={23} /></span><span className="brand-name">freshfold<span>.</span><small>LAUNDRY STUDIO</small></span></a>
        <div className="auth-heading"><span className="modal-kicker">LAUNDRY ORDER TRACKING</span><h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}<span className="heading-period">.</span></h1><p>{mode === 'login' ? 'Sign in to manage and track your laundry orders.' : 'Create an account to place and track orders.'}</p></div>
        <div className="auth-account-switch" role="tablist" aria-label="Account type">
          <button type="button" role="tab" aria-selected={accountType === 'admin'} className={accountType === 'admin' ? 'active' : ''} onClick={() => { setAccountType('admin'); setMode('login'); setError('') }}>Admin</button>
          <button type="button" role="tab" aria-selected={accountType === 'customer'} className={accountType === 'customer' ? 'active' : ''} onClick={() => { setAccountType('customer'); setError('') }}>Users</button>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && <label>Full name<input name="name" autoComplete="name" placeholder="Your name" required /></label>}
          <label>Email address<input name="email" type="email" autoComplete={accountType === 'admin' ? 'username' : 'email'} placeholder={accountType === 'admin' ? 'staff@freshfold.test' : 'you@example.com'} required /></label>
          <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : undefined} placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'} required /></label>
          {mode === 'register' && <label>Confirm password<input name="password_confirmation" type="password" autoComplete="new-password" minLength="8" placeholder="Re-enter your password" required /></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? `Sign in as ${accountType === 'admin' ? 'admin' : 'user'}` : 'Create account'}</button>
        </form>
        {accountType === 'customer' && <p className="auth-switch">{mode === 'login' ? 'New to Freshfold?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>}
        {accountType === 'admin' && import.meta.env.DEV && <p className="auth-demo">Demo admin: <strong>staff@freshfold.test</strong> / <strong>password</strong></p>}
      </section>
    </main>
  )
}

function App() {
  const [token, setToken] = useState(() => window.localStorage.getItem('freshfold-token') || '')
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(() => !window.localStorage.getItem('freshfold-token'))
  const [orders, setOrders] = useState([])
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const [dashboard, setDashboard] = useState({ total_orders: 0, in_progress: 0, ready_for_pickup: 0, unpaid_orders: 0, unpaid_amount: 0, received: 0, washing: 0, drying: 0 })
  const [services, setServices] = useState([])
  const [customers, setCustomers] = useState([])
  const [activeNav, setActiveNav] = useState('Overview')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [serviceFilter, setServiceFilter] = useState('All services')
  const [paymentFilter, setPaymentFilter] = useState('All payments')
  const [todayOnly, setTodayOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [editingService, setEditingService] = useState(null)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [pickupDate, setPickupDate] = useState('')
  const [notice, setNotice] = useState('')
  const isStaff = user?.role === 'admin' || user?.role === 'staff'
  const visibleNav = isStaff ? navItems : navItems.filter((item) => ['Overview', 'Orders'].includes(item.label))
  const today = new Date()
  const formattedToday = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  useEffect(() => {
    if (!token) {
      return
    }

    let active = true
    apiRequest('/me', { token })
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser)
      })
      .catch(() => {
        window.localStorage.removeItem('freshfold-token')
        if (active) {
          setToken('')
          setUser(null)
          setNotice('Your session expired. Please sign in again.')
        }
      })
      .finally(() => {
        if (active) setAuthChecked(true)
      })

    return () => { active = false }
  }, [token])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    if (!token || !user) return
    let active = true
    Promise.all([
      apiRequest('/dashboard', { token }),
      apiRequest('/services', { token }),
      isStaff ? apiRequest('/customers', { token }) : Promise.resolve({ data: [] }),
    ])
      .then(([dashboardData, serviceData, customerData]) => {
        if (!active) return
        setDashboard(dashboardData)
        setServices(serviceData.data)
        setCustomers(customerData.data)
      })
      .catch((error) => {
        if (active) setNotice(error.message)
      })

    return () => { active = false }
  }, [token, user, isStaff, refreshKey])

  useEffect(() => {
    if (!token || !user) return
    const controller = new AbortController()
    const parameters = new URLSearchParams({
      page: String(page),
      per_page: activeNav === 'Overview' ? '5' : '8',
    })
    if (debouncedSearch) parameters.set('search', debouncedSearch)
    if (statusFilter !== 'All statuses') parameters.set('status', statusFilter)
    if (serviceFilter !== 'All services') parameters.set('service_id', serviceFilter)
    if (todayOnly) parameters.set('date', localDateInputValue())
    if (isStaff && paymentFilter !== 'All payments') parameters.set('payment_status', paymentFilter.toLowerCase())

    apiRequest(`/orders?${parameters.toString()}`, { token, signal: controller.signal })
      .then((result) => {
        setOrders(result.data.map((order) => ({
          ...order,
          date: orderDateLabel(order.date),
          pickup_date: order.pickup,
          pickup: pickupDateLabel(order.pickup),
        })))
        setPagination({
          current_page: result.current_page,
          last_page: result.last_page,
          total: result.total,
          from: result.from,
          to: result.to,
        })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setNotice(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [token, user, isStaff, activeNav, page, debouncedSearch, statusFilter, serviceFilter, paymentFilter, todayOnly, refreshKey])

  function handleAuthenticated(result) {
    window.localStorage.setItem('freshfold-token', result.token)
    setToken(result.token)
    setUser(result.user)
    setAuthChecked(true)
    setNotice(`Welcome, ${result.user.name}.`)
  }

  async function signOut() {
    try {
      await apiRequest('/logout', { token, method: 'POST' })
    } catch (error) {
      setNotice(`Could not sign out: ${error.message}`)
      return
    }
    window.localStorage.removeItem('freshfold-token')
    setToken('')
    setUser(null)
    setActiveNav('Overview')
    setNotice('')
  }

  function handleRequestError(error) {
    setNotice(error.message)
  }

  async function advanceOrder(orderId) {
    const order = orders.find((candidate) => candidate.id === orderId)
    const nextStatus = statusOrder[statusOrder.indexOf(order?.status) + 1]
    if (!nextStatus) return

    try {
      await apiRequest(`/orders/${encodeURIComponent(orderId)}/status`, { token, method: 'PATCH', body: { status: nextStatus } })
      setRefreshKey((key) => key + 1)
      setNotice(`${orderId} moved to ${nextStatus}.`)
    } catch (error) {
      handleRequestError(error)
    }
  }

  async function markPaid(orderId) {
    try {
      await apiRequest(`/orders/${encodeURIComponent(orderId)}/payment`, { token, method: 'POST', body: { method: 'cash' } })
      setRefreshKey((key) => key + 1)
      setNotice(`${orderId} marked as paid.`)
    } catch (error) {
      handleRequestError(error)
    }
  }

  async function cancelOrder(orderId) {
    if (!window.confirm(`Cancel order ${orderId}?`)) return
    try {
      await apiRequest(`/orders/${encodeURIComponent(orderId)}`, { token, method: 'DELETE' })
      setRefreshKey((key) => key + 1)
      setNotice(`${orderId} cancelled.`)
    } catch (error) {
      handleRequestError(error)
    }
  }

  async function saveOrder(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const body = {
      service_type_id: Number(formData.get('service_type_id')),
      quantity: Number(formData.get('quantity')),
      pickup_date: String(formData.get('pickup_date')),
    }
    if (isStaff) body.customer_id = Number(formData.get('customer_id'))

    try {
      const result = await apiRequest(editingOrder ? `/orders/${encodeURIComponent(editingOrder.id)}` : '/orders', {
        token,
        method: editingOrder ? 'PUT' : 'POST',
        body,
      })
      setShowOrderForm(false)
      const wasEditing = Boolean(editingOrder)
      setEditingOrder(null)
      setActiveNav('Orders')
      setPage(1)
      setSearch('')
      setDebouncedSearch('')
      setStatusFilter('All statuses')
      setServiceFilter('All services')
      setPaymentFilter('All payments')
      setTodayOnly(false)
      setRefreshKey((key) => key + 1)
      setNotice(`${result.data.id} ${wasEditing ? 'updated' : 'created'} successfully.`)
    } catch (error) {
      handleRequestError(error)
    }
  }

  async function saveService(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const body = {
      name: String(formData.get('name')).trim(),
      description: String(formData.get('description')).trim(),
      price: Number(formData.get('price')),
      unit: String(formData.get('unit')),
      is_active: formData.get('is_active') === 'true',
    }

    try {
      const result = await apiRequest(editingService ? `/services/${editingService.id}` : '/services', {
        token,
        method: editingService ? 'PUT' : 'POST',
        body,
      })
      setShowServiceForm(false)
      setEditingService(null)
      setRefreshKey((key) => key + 1)
      setNotice(`${result.data.name} ${editingService ? 'updated' : 'created'}.`)
    } catch (error) {
      handleRequestError(error)
    }
  }

  async function removeService(service) {
    const action = service.is_active ? 'Deactivate' : 'Reactivate'
    if (!window.confirm(`${action} ${service.name}?`)) return
    try {
      if (service.is_active) {
        await apiRequest(`/services/${service.id}`, { token, method: 'DELETE' })
      } else {
        await apiRequest(`/services/${service.id}`, {
          token,
          method: 'PUT',
          body: {
            name: service.name,
            description: service.description,
            price: Number(service.price),
            unit: service.unit,
            is_active: true,
          },
        })
      }
      setRefreshKey((key) => key + 1)
      setNotice(`${service.name} ${service.is_active ? 'deactivated' : 'reactivated'}.`)
    } catch (error) {
      handleRequestError(error)
    }
  }

  async function saveCustomer(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const body = {
      name: String(formData.get('name')).trim(),
      email: String(formData.get('email')).trim(),
    }
    const password = String(formData.get('password') || '')
    if (password) body.password = password

    try {
      const result = await apiRequest(editingCustomer ? `/customers/${editingCustomer.id}` : '/customers', {
        token,
        method: editingCustomer ? 'PUT' : 'POST',
        body,
      })
      const wasEditing = Boolean(editingCustomer)
      setShowCustomerForm(false)
      setEditingCustomer(null)
      setRefreshKey((key) => key + 1)
      setNotice(`${result.data.name} ${wasEditing ? 'updated' : 'created'}.`)
    } catch (error) {
      handleRequestError(error)
    }
  }

  async function removeCustomer(customer) {
    if (!window.confirm(`Delete customer ${customer.name}? Customers with order history cannot be deleted.`)) return
    try {
      await apiRequest(`/customers/${customer.id}`, { token, method: 'DELETE' })
      setRefreshKey((key) => key + 1)
      setNotice(`${customer.name} deleted.`)
    } catch (error) {
      handleRequestError(error)
    }
  }

  function changeSection(section) {
    setActiveNav(section)
    setPage(1)
    setSearch('')
    setDebouncedSearch('')
    setStatusFilter('All statuses')
    setServiceFilter('All services')
    setPaymentFilter('All payments')
    setTodayOnly(false)
  }

  if (!authChecked) {
    return <main className="auth-page"><div className="auth-loading"><span className="live-dot" /> Connecting to Freshfold…</div></main>
  }

  if (!token || !user) {
    return <><AuthScreen onAuthenticated={handleAuthenticated} />{notice && <div className="toast-message" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}</>
  }

  const pageTitle = activeNav === 'Overview' ? (isStaff ? 'Good morning, John' : `Welcome, ${user.name.split(' ')[0]}`) : activeNav

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => changeSection('Overview')}>
          <span className="brand-mark"><Icon name="sparkle" size={23} /></span>
          <span className="brand-name">freshfold<span>.</span><small>LAUNDRY STUDIO</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {visibleNav.map((item) => (
            <button className={`nav-link ${activeNav === item.label ? 'active' : ''}`} key={item.label} onClick={() => changeSection(item.label)}>
              <Icon name={item.icon} size={19} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><div className="help-icon"><Icon name="sparkle" size={18} /></div><strong>Need a hand?</strong><p>We’re here to help your business run smoothly.</p><button onClick={() => setNotice('Contact your shop administrator for help.')}>Get support <Icon name="arrow" size={14} /></button></div>
          <button className="profile-card" onClick={signOut}>
            <span className="profile-avatar">{user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
            <span className="profile-info"><strong>{user.name}</strong><small>{user.role === 'customer' ? 'Customer account' : 'Shop administrator'}</small></span>
            <Icon name="logout" size={17} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><Icon name="chevron" size={15} /><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <span className="today-date"><Icon name="calendar" size={16} /> {formattedToday}</span>
            <button className="icon-button notification-button" aria-label="Refresh dashboard" onClick={() => setRefreshKey((key) => key + 1)}><Icon name="bell" size={19} /></button>
            <span className="topbar-avatar">{user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="live-dot" /> {formattedToday.toUpperCase()}, {today.getFullYear()}</div><h1>{pageTitle}<span className="heading-period">.</span></h1><p className="page-subtitle">{activeNav === 'Overview' ? 'Here’s what’s happening at your shop today.' : `Keep your ${activeNav.toLowerCase()} organized and up to date.`}</p></div>
            <button className="primary-button" onClick={() => { setEditingOrder(null); setPickupDate(localDateInputValue(new Date(Date.now() + 86400000))); setShowOrderForm(true) }}><Icon name="plus" size={18} /> New order</button>
          </section>

          {activeNav === 'Overview' ? (
            <>
              <section className="stats-grid" aria-label="Order summary">
                <article className="stat-card"><div className="stat-top"><span>Total orders</span><span className="stat-icon icon-blue"><Icon name="clipboard" size={18} /></span></div><div className="stat-value">{dashboard.total_orders}</div><div className="stat-caption">All orders in the system</div><div className="mini-bars blue-bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></article>
                <article className="stat-card"><div className="stat-top"><span>In progress</span><span className="stat-icon icon-violet"><Icon name="clock" size={18} /></span></div><div className="stat-value">{dashboard.in_progress}<span className="stat-unit">orders</span></div><div className="stat-caption">Being taken care of right now</div><div className="stat-footer"><span className="tiny-dot violet-dot" /> Washing <strong>{dashboard.washing}</strong><span className="footer-divider" /><span className="tiny-dot orange-dot" /> Drying <strong>{dashboard.drying}</strong></div></article>
                <article className="stat-card"><div className="stat-top"><span>Ready for pickup</span><span className="stat-icon icon-green"><Icon name="check" size={18} /></span></div><div className="stat-value">{dashboard.ready_for_pickup}<span className="stat-unit">orders</span></div><div className="stat-caption">Customers are waiting for these</div><div className="stat-footer ready-footer"><span className="tiny-dot green-dot" /> {dashboard.ready_for_pickup ? 'Ready for collection' : 'All caught up'}</div></article>
                <article className="stat-card"><div className="stat-top"><span>Unpaid orders</span><span className="stat-icon icon-peach"><Icon name="wallet" size={18} /></span></div><div className="stat-value">{dashboard.unpaid_orders}<span className="stat-unit">orders</span></div><div className="stat-caption">{formatCurrency(dashboard.unpaid_amount)} outstanding</div><div className="stat-footer"><span className="tiny-dot orange-dot" /> Payment follow-up needed</div></article>
              </section>
              <section className="welcome-banner">
                <div className="banner-copy"><span className="banner-kicker"><Icon name="sparkle" size={14} /> YOUR DAILY SNAPSHOT</span><h2>A fresh start to a<br />productive day.</h2><p>You’ve got <strong>{dashboard.received} new orders</strong> to take care of. Keep up the great work!</p><button onClick={() => changeSection('Orders')}>View all orders <Icon name="arrow" size={15} /></button></div>
                <div className="banner-art" aria-hidden="true"><div className="sun-orb" /><div className="bubble bubble-one" /><div className="bubble bubble-two" /><div className="bubble bubble-three" /><div className="laundry-basket"><div className="basket-clothes"><i /><i /><i /><i /></div><div className="basket-rim" /><div className="basket-body"><span /></div></div><div className="sparkle-mark sparkle-one">✦</div><div className="sparkle-mark sparkle-two">✦</div><div className="art-ground" /></div>
                <div className="banner-corner">FRESH<br />EVERY DAY</div>
              </section>
              <OrdersPanel orders={orders} pagination={pagination} loading={loading} search={search} setSearch={(value) => { setSearch(value); setPage(1) }} statusFilter={statusFilter} setStatusFilter={(value) => { setStatusFilter(value); setPage(1) }} services={services} serviceFilter={serviceFilter} setServiceFilter={(value) => { setServiceFilter(value); setPage(1) }} todayOnly={todayOnly} setTodayOnly={(value) => { setTodayOnly(value); setPage(1) }} isStaff={isStaff} paymentFilter={paymentFilter} setPaymentFilter={(value) => { setPaymentFilter(value); setPage(1) }} advanceOrder={advanceOrder} markPaid={markPaid} cancelOrder={cancelOrder} editOrder={(order) => { setEditingOrder(order); setPickupDate(order.pickup_date); setShowOrderForm(true) }} setActiveNav={changeSection} onPageChange={setPage} />
            </>
          ) : activeNav === 'Customers' ? (
            <section className="orders-section secondary-section"><div className="section-heading"><div><h2>Customers</h2><p>Registered customers and their account details.</p></div><button className="primary-button" onClick={() => { setEditingCustomer(null); setShowCustomerForm(true) }}><Icon name="plus" size={16} /> Add customer</button></div><div className="customer-list">{customers.length ? customers.map((customer) => <div className="customer-list-row" key={customer.id}><span className="customer-avatar avatar-blue">{customer.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span><strong>{customer.name}</strong><small>{customer.email}</small></span><span className="customer-order-count">{customer.orders_count} orders</span><div className="customer-actions"><button onClick={() => { setEditingCustomer(customer); setShowCustomerForm(true) }}>Edit</button><button onClick={() => removeCustomer(customer)}>Delete</button></div></div>) : <p className="service-empty">No customers found.</p>}</div></section>
          ) : activeNav === 'Services' ? (
            <section className="orders-section secondary-section"><div className="section-heading"><div><h2>Services</h2><p>Active laundry services and current pricing.</p></div><button className="primary-button" onClick={() => { setEditingService(null); setShowServiceForm(true) }}><Icon name="plus" size={16} /> Add service</button></div><div className="service-cards">{services.length ? services.map((service) => <article className={`service-card ${service.is_active ? '' : 'service-card-inactive'}`} key={service.id}><span className="service-card-icon"><Icon name="shirt" size={19} /></span><h3>{service.name}{!service.is_active && <small className="inactive-label">Inactive</small>}</h3><p>{service.description}</p><strong>{formatCurrency(service.price)} <small>/ {service.unit}</small></strong><div className="service-card-actions"><button onClick={() => { setEditingService(service); setShowServiceForm(true) }}>Edit</button><button onClick={() => removeService(service)}>{service.is_active ? 'Deactivate' : 'Reactivate'}</button></div></article>) : <p className="service-empty">No services. Add a service to accept new orders.</p>}</div></section>
          ) : (
            <section className="orders-section secondary-section">
              <div className="section-heading"><div><h2>{activeNav === 'Payments' ? 'Payments' : 'All orders'}</h2><p>{activeNav === 'Payments' ? 'Review collected payments and outstanding balances.' : 'Search, filter, and manage your laundry orders.'}</p></div><span className="order-total">{pagination.total} {activeNav === 'Payments' ? 'records' : 'orders'}</span></div>
              <OrdersPanel orders={orders} pagination={pagination} loading={loading} search={search} setSearch={(value) => { setSearch(value); setPage(1) }} statusFilter={statusFilter} setStatusFilter={(value) => { setStatusFilter(value); setPage(1) }} services={services} serviceFilter={serviceFilter} setServiceFilter={(value) => { setServiceFilter(value); setPage(1) }} todayOnly={todayOnly} setTodayOnly={(value) => { setTodayOnly(value); setPage(1) }} isStaff={isStaff} paymentFilter={paymentFilter} setPaymentFilter={(value) => { setPaymentFilter(value); setPage(1) }} advanceOrder={advanceOrder} markPaid={markPaid} cancelOrder={cancelOrder} editOrder={(order) => { setEditingOrder(order); setPickupDate(order.pickup_date); setShowOrderForm(true) }} setActiveNav={changeSection} onPageChange={setPage} />
            </section>
          )}
          <footer className="page-footer"><span>© {today.getFullYear()} Freshfold Laundry Studio</span><span><i className="footer-status-dot" /> Connected to Laravel API</span></footer>
        </div>
      </main>

      {notice && <div className="toast-message" role="status"><span className="toast-check"><Icon name="check" size={15} /></span>{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
      {showOrderForm && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowOrderForm(false); setEditingOrder(null) } }}>
          <section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="new-order-title">
            <div className="modal-heading"><div><span className="modal-kicker">ORDER MANAGEMENT</span><h2 id="new-order-title">{editingOrder ? `Edit ${editingOrder.id}` : 'Create a new order'}</h2><p>{isStaff ? 'Select a customer and service for this order.' : 'Choose a service and pickup date.'}</p></div><button className="modal-close" aria-label="Close" onClick={() => { setShowOrderForm(false); setEditingOrder(null) }}>×</button></div>
            <form onSubmit={saveOrder}>
              {isStaff ? <label>Customer<select name="customer_id" required defaultValue={editingOrder?.customer_id ?? ''}><option value="" disabled>Select a customer</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name} — {customer.email}</option>)}</select></label> : <label>Customer<input value={`${user.name} (${user.email})`} readOnly /></label>}
              <div className="form-row"><label>Service<select name="service_type_id" required defaultValue={editingOrder?.service_type_id ?? services.find((service) => service.is_active)?.id ?? ''}>{services.filter((service) => service.is_active).map((service) => <option key={service.id} value={service.id}>{service.name} — {formatCurrency(service.price)} / {service.unit}</option>)}</select></label><label>Quantity<input name="quantity" type="number" min="0.1" step="0.1" defaultValue={editingOrder?.quantity ?? 1} required /></label></div>
              <label>Pickup date<input name="pickup_date" type="date" min={localDateInputValue()} value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} required /></label>
              {(!services.length || (isStaff && !customers.length)) && <p className="auth-error">Service/customer data is not available. Seed the Laravel database and try again.</p>}
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setShowOrderForm(false); setEditingOrder(null) }}>Cancel</button><button type="submit" className="primary-button" disabled={!services.some((service) => service.is_active) || (isStaff && !customers.length)}><Icon name="plus" size={17} /> {editingOrder ? 'Save changes' : 'Create order'}</button></div>
            </form>
          </section>
        </div>
      )}
      {showServiceForm && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowServiceForm(false); setEditingService(null) } }}>
          <section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="service-form-title">
            <div className="modal-heading"><div><span className="modal-kicker">SERVICE MANAGEMENT</span><h2 id="service-form-title">{editingService ? 'Edit service' : 'Add a service'}</h2><p>Set a service name, unit, and price.</p></div><button className="modal-close" aria-label="Close" onClick={() => { setShowServiceForm(false); setEditingService(null) }}>×</button></div>
            <form onSubmit={saveService}>
              <label>Service name<input name="name" required maxLength="120" defaultValue={editingService?.name ?? ''} /></label>
              <label>Description<input name="description" maxLength="1000" defaultValue={editingService?.description ?? ''} /></label>
              <div className="form-row"><label>Price<input name="price" type="number" min="0.01" step="0.01" required defaultValue={editingService?.price ?? ''} /></label><label>Unit<select name="unit" defaultValue={editingService?.unit ?? 'kg'}><option value="kg">per kg</option><option value="item">per item</option></select></label></div>
              <label>Availability<select name="is_active" defaultValue={String(editingService?.is_active ?? true)}><option value="true">Active</option><option value="false">Inactive</option></select></label>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setShowServiceForm(false); setEditingService(null) }}>Cancel</button><button type="submit" className="primary-button">{editingService ? 'Save changes' : 'Add service'}</button></div>
            </form>
          </section>
        </div>
      )}
      {showCustomerForm && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowCustomerForm(false); setEditingCustomer(null) } }}>
          <section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
            <div className="modal-heading"><div><span className="modal-kicker">CUSTOMER MANAGEMENT</span><h2 id="customer-form-title">{editingCustomer ? 'Edit customer' : 'Add a customer'}</h2><p>{editingCustomer ? 'Update the customer account details.' : 'Create a customer account for the shop.'}</p></div><button className="modal-close" aria-label="Close" onClick={() => { setShowCustomerForm(false); setEditingCustomer(null) }}>×</button></div>
            <form onSubmit={saveCustomer}>
              <label>Full name<input name="name" autoComplete="name" required maxLength="120" defaultValue={editingCustomer?.name ?? ''} /></label>
              <label>Email address<input name="email" type="email" autoComplete="email" required maxLength="255" defaultValue={editingCustomer?.email ?? ''} /></label>
              <label>{editingCustomer ? 'New password (optional)' : 'Password'}<input name="password" type="password" autoComplete="new-password" minLength="8" required={!editingCustomer} placeholder={editingCustomer ? 'Leave blank to keep current password' : 'At least 8 characters'} /></label>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setShowCustomerForm(false); setEditingCustomer(null) }}>Cancel</button><button type="submit" className="primary-button">{editingCustomer ? 'Save changes' : 'Add customer'}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

function OrdersPanel({ orders, pagination, loading, search, setSearch, statusFilter, setStatusFilter, services, serviceFilter, setServiceFilter, todayOnly, setTodayOnly, isStaff, paymentFilter, setPaymentFilter, advanceOrder, markPaid, cancelOrder, editOrder, setActiveNav, onPageChange }) {
  return (
    <section className="orders-section">
      <div className="section-heading">
        <div><h2>Recent orders</h2><p>A little overview of what’s moving through the shop.</p></div>
        <button className="text-button" onClick={() => setActiveNav('Orders')}>View all orders <Icon name="arrow" size={15} /></button>
      </div>
      <div className="table-toolbar">
        <label className="search-field"><Icon name="search" size={17} /><input aria-label="Search orders" placeholder="Search orders..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="filter-select"><Icon name="filter" size={17} /><select aria-label="Filter by order status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{statusOrder.map((status) => <option key={status}>{status}</option>)}</select><Icon name="down" size={14} /></label>
        <label className="service-filter"><select aria-label="Filter by service type" value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}><option>All services</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label>
        {isStaff && <label className="payment-filter"><select aria-label="Filter by payment status" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option>All payments</option><option value="Paid">Paid</option><option value="Unpaid">Unpaid</option></select></label>}
        <button className={`date-filter ${todayOnly ? 'date-filter-active' : ''}`} aria-pressed={todayOnly} onClick={() => setTodayOnly(!todayOnly)}><Icon name="calendar" size={16} /> Today <Icon name="down" size={14} /></button>
      </div>
      <div className="table-scroll">
        <table className="orders-table">
          <thead><tr><th>ORDER</th><th>CUSTOMER</th><th>SERVICE</th><th>PICKUP</th><th>AMOUNT</th><th>STATUS</th><th>PAYMENT</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {loading ? <tr><td className="empty-cell" colSpan="8"><span className="empty-icon"><Icon name="clock" size={22} /></span><strong>Loading orders…</strong></td></tr> : orders.length ? orders.map((order) => (
              <tr key={order.id}>
                <td><span className="order-id">{order.id}</span><small className="order-date">{order.date}</small></td>
                <td><span className="customer-cell"><span className={`customer-avatar avatar-${order.color}`}>{order.initials}</span><span className="customer-name">{order.customer}</span></span></td>
                <td><span className="service-name">{order.service}</span><small className="order-date">{order.weight}</small></td>
                <td><span className="pickup-date">{order.pickup}</span></td>
                <td><span className="amount-cell">{formatCurrency(order.amount)}</span></td>
                <td><span className={`status-badge status-${order.status.toLowerCase().replaceAll(' ', '-')}`}><i />{order.status}</span></td>
                <td><button className={`payment-badge payment-${order.payment.toLowerCase()}`} onClick={() => isStaff && order.payment !== 'Paid' && markPaid(order.id)} disabled={!isStaff || order.payment === 'Paid'} aria-label={order.payment === 'Paid' ? `${order.id} paid` : isStaff ? `Mark ${order.id} as paid` : `${order.id} payment ${order.payment.toLowerCase()}`}><i />{order.payment}</button></td>
                <td className="order-actions">
                  {order.status === 'Received' && order.payment !== 'Paid' && <button className="cancel-order" onClick={() => editOrder(order)} aria-label={`Edit ${order.id}`}>Edit</button>}
                  {isStaff
                    ? <button className="row-action" title={order.status === 'Completed' ? 'Order completed' : 'Advance order status'} aria-label={order.status === 'Completed' ? `${order.id} is completed` : `Advance ${order.id} status`} onClick={() => advanceOrder(order.id)} disabled={order.status === 'Completed'}><Icon name="arrow" size={15} /></button>
                    : order.status === 'Received' && order.payment !== 'Paid' && <button className="cancel-order" onClick={() => cancelOrder(order.id)} aria-label={`Cancel ${order.id}`}>Cancel</button>}
                </td>
              </tr>
            )) : <tr><td className="empty-cell" colSpan="8"><span className="empty-icon"><Icon name="search" size={22} /></span><strong>No orders found</strong><span>Try another search or status filter.</span></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-footer"><span>Showing <strong>{pagination.from ?? 0}–{pagination.to ?? 0}</strong> of <strong>{pagination.total}</strong> orders</span><div><button disabled={pagination.current_page <= 1} aria-label="Previous page" onClick={() => onPageChange(pagination.current_page - 1)}>←</button><span className="pagination-label">Page {pagination.current_page} of {pagination.last_page}</span><button disabled={pagination.current_page >= pagination.last_page} aria-label="Next page" onClick={() => onPageChange(pagination.current_page + 1)}>→</button></div></div>
    </section>
  )
}

export default App
