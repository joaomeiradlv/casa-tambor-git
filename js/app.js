(function () {
  'use strict';

  // ---------- utilidades ----------
  const app = document.getElementById('app');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const icon = (name, label) => window.productIcon(name, esc(label));
  const FREE_FROM = 30000;
  const SHIPPING = 2500;

  const STATUS = {
    pending: 'Aguardando pagamento', paid: 'Pago', shipped: 'Enviado', rejected: 'Pagamento recusado',
    cancelled: 'Cancelado', expired: 'Expirado', refunded: 'Reembolsado',
  };

  function getCookie(name) {
    return document.cookie.split('; ').find((c) => c.startsWith(name + '='))?.split('=')[1] || '';
  }

  async function api(path, { method = 'GET', body } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET') {
      if (!getCookie('csrf')) await fetch('/api/auth/me', { credentials: 'same-origin' });
      headers['X-CSRF-Token'] = getCookie('csrf');
    }
    const res = await fetch('/api' + path, {
      method, headers, credentials: 'same-origin', body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Algo deu errado. Tente de novo.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- estado ----------
  const state = { user: null, products: [], loaded: false };

  const cart = {
    read() {
      try { return JSON.parse(localStorage.getItem('cart') || '{}') || {}; } catch { return {}; }
    },
    write(c) {
      try { localStorage.setItem('cart', JSON.stringify(c)); } catch { /* armazenamento indisponível */ }
      updateCartCount();
    },
    add(id, qty = 1) {
      const c = this.read();
      const p = state.products.find((x) => x.id === id);
      const max = Math.min(20, p ? p.stock : 20);
      c[id] = Math.min(max, (c[id] || 0) + qty);
      this.write(c);
    },
    set(id, qty) {
      const c = this.read();
      if (qty <= 0) delete c[id]; else c[id] = Math.min(20, qty);
      this.write(c);
    },
    clear() { this.write({}); },
    lines() {
      const c = this.read();
      return Object.entries(c)
        .map(([id, qty]) => ({ product: state.products.find((p) => p.id === Number(id)), qty }))
        .filter((l) => l.product && l.qty > 0);
    },
    totals() {
      const subtotal = this.lines().reduce((s, l) => s + l.product.price_cents * l.qty, 0);
      const shipping = subtotal === 0 || subtotal >= FREE_FROM ? 0 : SHIPPING;
      return { subtotal, shipping, total: subtotal + shipping };
    },
  };

  function updateCartCount() {
    const n = Object.values(cart.read()).reduce((s, q) => s + q, 0);
    document.getElementById('cart-count').textContent = n;
  }

  function updateAuthUI() {
    document.body.classList.remove('auth-in', 'auth-out', 'auth-admin');
    if (!state.user) document.body.classList.add('auth-out');
    else document.body.classList.add(state.user.role === 'admin' ? 'auth-admin' : 'auth-in');
  }

  async function loadProducts() {
    const { products } = await api('/products');
    state.products = products;
    state.loaded = true;
  }

  // ---------- telas ----------
  const HERO_DRUM = `
    <svg class="hero-drum" viewBox="0 0 200 240" aria-hidden="true">
      <ellipse cx="100" cy="30" rx="80" ry="20" fill="var(--ill-c)" stroke="currentColor" stroke-width="5"/>
      <path d="M20 30v180c0 11 36 20 80 20s80-9 80-20V30" fill="var(--blue)" stroke="currentColor" stroke-width="5"/>
      <path class="band" d="M20 88c0 11 36 20 80 20s80-9 80-20v22c0 11-36 20-80 20s-80-9-80-20z" stroke="currentColor" stroke-width="5"/>
      <path d="M20 160c0 11 36 20 80 20s80-9 80-20" fill="none" stroke="currentColor" stroke-width="5"/>
      <ellipse cx="100" cy="30" rx="80" ry="20" fill="var(--ill-c)" stroke="currentColor" stroke-width="5"/>
      <ellipse cx="136" cy="30" rx="9" ry="3.5" fill="currentColor"/>
    </svg>`;

  function productCard(p) {
    return `
      <a class="card" href="#/produto/${esc(p.slug)}">
        <div class="card-art">${icon(p.icon, p.name)}</div>
        <div class="card-body">
          <span class="card-cat">${esc(p.category)}</span>
          <span class="card-name">${esc(p.name)}</span>
          <div class="card-foot">
            <span class="price">${brl(p.price_cents)}</span>
            ${p.stock === 0 ? '<span class="stock-low">Esgotado</span>' : p.stock <= 3 ? `<span class="stock-low">Últimas ${p.stock}</span>` : ''}
          </div>
        </div>
      </a>`;
  }

  function viewHome(params) {
    const cats = [...new Set(state.products.map((p) => p.category))];
    const active = params.get('cat') || '';
    const list = active ? state.products.filter((p) => p.category === active) : state.products;

    app.innerHTML = `
      <section class="hero">
        <div>
          <h1>Tambor, lata, madeira e alumínio.</h1>
          <p>Pufs feitos de tambor reaproveitado, bancos de madeira, mesas e tudo o que vai para a mesa. Pague com Pix, cartão ou boleto.</p>
        </div>
        ${HERO_DRUM}
      </section>
      <div class="filters" role="group" aria-label="Filtrar por categoria">
        <button class="chip" data-cat="" aria-pressed="${!active}">Tudo</button>
        ${cats.map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${c === active}">${esc(c)}</button>`).join('')}
      </div>
      <section class="grid" aria-label="Produtos">${list.map(productCard).join('')}</section>`;

    app.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      const c = b.dataset.cat;
      location.hash = c ? `#/?cat=${encodeURIComponent(c)}` : '#/';
    }));
  }

  function viewProduct(slug) {
    const p = state.products.find((x) => x.slug === slug);
    if (!p) return viewNotFound();
    let qty = 1;
    const soldOut = p.stock === 0;
    app.innerHTML = `
      <section class="product">
        <div class="product-art">${icon(p.icon, p.name)}</div>
        <div>
          <a class="back" href="#/">Voltar para a loja</a>
          <p class="muted">${esc(p.category)}</p>
          <h1>${esc(p.name)}</h1>
          <span class="price">${brl(p.price_cents)}</span>
          <p>${esc(p.description)}</p>
          <p class="hint">${soldOut ? 'Esgotado no momento.' : `${p.stock} em estoque`}</p>
          <div class="buy-row">
            <div class="qty" aria-label="Quantidade">
              <button type="button" data-d="-1" aria-label="Diminuir">−</button>
              <span id="qty">1</span>
              <button type="button" data-d="1" aria-label="Aumentar">+</button>
            </div>
            <button class="btn" id="add" ${soldOut ? 'disabled' : ''}>Adicionar ao carrinho</button>
          </div>
        </div>
      </section>`;
    app.querySelectorAll('.qty button').forEach((b) => b.addEventListener('click', () => {
      qty = Math.max(1, Math.min(Math.min(20, p.stock), qty + Number(b.dataset.d)));
      document.getElementById('qty').textContent = qty;
    }));
    document.getElementById('add').addEventListener('click', () => {
      cart.add(p.id, qty);
      toast(`${p.name} adicionado ao carrinho`);
    });
  }

  function summaryBox(t, cta) {
    const missing = FREE_FROM - t.subtotal;
    return `
      <aside class="summary">
        <h2>Resumo</h2>
        <div class="sum-row"><span>Produtos</span><span>${brl(t.subtotal)}</span></div>
        <div class="sum-row"><span>Frete</span><span>${t.shipping ? brl(t.shipping) : 'Grátis'}</span></div>
        ${missing > 0 ? `<p class="hint">Faltam ${brl(missing)} para o frete grátis.</p>` : ''}
        <div class="sum-row sum-total"><span>Total</span><span>${brl(t.total)}</span></div>
        ${cta}
        <p class="secure">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V8a6 6 0 1 1 12 0v2h1v12H5V10zm2 0h8V8a4 4 0 1 0-8 0z" fill="currentColor"/></svg>
          Você paga no ambiente seguro do Mercado Pago. Os dados do cartão não passam pela nossa loja.
        </p>
      </aside>`;
  }

  function viewCart() {
    const lines = cart.lines();
    if (!lines.length) {
      app.innerHTML = `<section class="page empty"><h1>Seu carrinho está vazio</h1><p>Escolha um puf, um banco ou uma caneca e volte aqui para finalizar.</p><a class="btn" href="#/">Ver produtos</a></section>`;
      return;
    }
    const t = cart.totals();
    app.innerHTML = `
      <section class="page">
        <h1>Carrinho</h1>
        <div class="layout-2">
          <div class="lines">
            ${lines.map(({ product: p, qty }) => `
              <div class="line">
                <div class="line-art">${icon(p.icon, p.name)}</div>
                <div>
                  <a class="line-name" href="#/produto/${esc(p.slug)}">${esc(p.name)}</a>
                  <div class="line-actions">
                    <div class="qty">
                      <button type="button" data-id="${p.id}" data-d="-1" aria-label="Diminuir">−</button>
                      <span>${qty}</span>
                      <button type="button" data-id="${p.id}" data-d="1" aria-label="Aumentar">+</button>
                    </div>
                    <button class="linklike" data-remove="${p.id}">Remover</button>
                  </div>
                  ${qty > p.stock ? `<p class="error">Só temos ${p.stock} em estoque.</p>` : ''}
                </div>
                <strong>${brl(p.price_cents * qty)}</strong>
              </div>`).join('')}
          </div>
          ${summaryBox(t, `<a class="btn" href="#/checkout">Ir para o pagamento</a>`)}
        </div>
      </section>`;
    app.querySelectorAll('.qty button').forEach((b) => b.addEventListener('click', () => {
      const id = Number(b.dataset.id);
      const p = state.products.find((x) => x.id === id);
      const cur = cart.read()[id] || 0;
      cart.set(id, Math.min(p.stock, cur + Number(b.dataset.d)));
      viewCart();
    }));
    app.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
      cart.set(Number(b.dataset.remove), 0);
      viewCart();
    }));
  }

  function viewAuth(mode) {
    const isLogin = mode === 'login';
    if (state.user) {
      app.innerHTML = `
        <section class="page narrow">
          <h1>Você já entrou</h1>
          <p>Você está conectado como <strong>${esc(state.user.name)}</strong> (${esc(state.user.email)}).</p>
          <p class="hint">Para entrar com outra conta ou testar outra senha, saia primeiro.</p>
          <div class="buy-row">
            <a class="btn" href="#/">Ir para a loja</a>
            <button class="btn ghost" id="auth-logout" type="button">Sair desta conta</button>
          </div>
        </section>`;
      document.getElementById('auth-logout').addEventListener('click', () => document.getElementById('logout').click());
      return;
    }
    app.innerHTML = `
      <section class="page narrow">
        <h1>${isLogin ? 'Entrar' : 'Criar conta'}</h1>
        <p class="muted">${isLogin ? 'Use o e-mail e a senha que você cadastrou.' : 'Você está criando uma conta nova. Se já tem cadastro, <a href="#/entrar">entre por aqui</a>.'}</p>
        <form class="form" id="auth-form" novalidate>
          ${isLogin ? '' : `<div class="field"><label for="name">Nome</label><input id="name" name="name" autocomplete="name" required maxlength="80"></div>`}
          <div class="field"><label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="120"></div>
          <div class="field">
            <label for="password">Senha</label>
            <input id="password" name="password" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required minlength="${isLogin ? 1 : 8}" maxlength="128">
            ${isLogin ? '' : '<p class="hint">Pelo menos 8 caracteres, com letras e números.</p>'}
          </div>
          <p class="error" id="auth-error" role="alert"></p>
          <button class="btn" type="submit">${isLogin ? 'Entrar' : 'Criar conta'}</button>
          <p>${isLogin ? 'Ainda não tem conta? <a href="#/cadastro">Criar conta</a>' : 'Já tem conta? <a href="#/entrar">Entrar</a>'}</p>
        </form>
      </section>`;
    const form = document.getElementById('auth-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const fd = Object.fromEntries(new FormData(form));
      btn.disabled = true;
      try {
        const { user } = await api(isLogin ? '/auth/login' : '/auth/register', { method: 'POST', body: fd });
        state.user = user;
        updateAuthUI();
        const next = sessionStorage.getItem('next') || '#/';
        sessionStorage.removeItem('next');
        location.hash = next;
        toast(isLogin ? `Olá, ${user.name.split(' ')[0]}` : 'Conta criada');
      } catch (err) {
        document.getElementById('auth-error').textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    });
  }

  function requireLogin(next) {
    if (state.user) return true;
    try { sessionStorage.setItem('next', next); } catch { /* ignore */ }
    location.hash = '#/entrar';
    return false;
  }

  const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

  function viewCheckout() {
    if (!requireLogin('#/checkout')) return;
    const lines = cart.lines();
    if (!lines.length) { location.hash = '#/carrinho'; return; }
    const t = cart.totals();
    const f = (id, label, cls, attrs = '') => `<div class="field ${cls}"><label for="${id}">${label}</label><input id="${id}" name="${id}" ${attrs}></div>`;
    app.innerHTML = `
      <section class="page">
        <h1>Entrega e pagamento</h1>
        <div class="layout-2">
          <form id="checkout" novalidate>
            <div class="form-grid">
              ${f('name', 'Nome de quem recebe', 'c4', `autocomplete="name" required value="${esc(state.user.name)}"`)}
              ${f('phone', 'Telefone', 'c2', 'autocomplete="tel" inputmode="tel" placeholder="(11) 91234-5678" required')}
              ${f('cep', 'CEP', 'c2', 'autocomplete="postal-code" inputmode="numeric" placeholder="00000-000" required')}
              ${f('street', 'Rua', 'c4', 'autocomplete="address-line1" required')}
              ${f('number', 'Número', 'c2', 'required')}
              ${f('complement', 'Complemento (opcional)', 'c4', 'autocomplete="address-line2"')}
              ${f('district', 'Bairro', 'c2', 'required')}
              ${f('city', 'Cidade', 'c3', 'autocomplete="address-level2" required')}
              <div class="field c3"><label for="state">Estado</label>
                <select id="state" name="state" required><option value="">Selecione</option>${UFS.map((u) => `<option>${u}</option>`).join('')}</select>
              </div>
            </div>
            <p class="error" id="co-error" role="alert"></p>
          </form>
          ${summaryBox(t, `<button class="btn" id="pay" form="checkout" type="submit">Pagar ${brl(t.total)}</button>`)}
        </div>
      </section>`;

    document.getElementById('checkout').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('co-error');
      const btn = document.getElementById('pay');
      const shipping = Object.fromEntries(new FormData(e.target));
      errEl.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Abrindo pagamento…';
      try {
        const items = cart.lines().map((l) => ({ productId: l.product.id, qty: l.qty }));
        const { redirectUrl } = await api('/orders', { method: 'POST', body: { items, shipping } });
        cart.clear();
        // Só redireciona para o Mercado Pago ou para dentro da própria loja
        const url = new URL(redirectUrl, location.origin);
        const allowed = url.origin === location.origin || /(^|\.)mercadopago\.com(\.br)?$|(^|\.)mercadolivre\.com$/.test(url.hostname);
        if (!allowed) throw new Error('Endereço de pagamento inesperado.');
        location.href = url.href;
      } catch (err) {
        errEl.textContent = err.message;
        btn.disabled = false;
        btn.textContent = `Pagar ${brl(t.total)}`;
        if (err.status === 409) await loadProducts();
      }
    });
  }

  let pollTimer;
  async function viewOrder(id) {
    if (!requireLogin(`#/pedido/${id}`)) return;
    app.innerHTML = '<p class="loading">Carregando pedido…</p>';
    let data;
    try { data = await api(`/orders/${encodeURIComponent(id)}`); } catch (err) { return viewNotFound(err.message); }
    const o = data.order;
    const paid = ['paid', 'shipped'].includes(o.status);
    const title = { pending: 'Aguardando a confirmação do pagamento', paid: 'Pagamento aprovado', shipped: 'Pedido enviado',
      rejected: 'O pagamento não foi aprovado', cancelled: 'Pedido cancelado', expired: 'O prazo para pagar terminou', refunded: 'Pedido reembolsado' }[o.status];

    app.innerHTML = `
      <section class="page mid">
        <a class="back" href="#/pedidos">Meus pedidos</a>
        <h1>${esc(title)}</h1>
        <p class="muted">Pedido ${esc(o.id)} · ${new Date(o.created_at + 'Z').toLocaleString('pt-BR')}</p>
        <ol class="steps" aria-label="Andamento">
          <li class="done">Pedido feito</li>
          <li class="${paid ? 'done' : ''}">Pagamento aprovado</li>
          <li class="${o.status === 'shipped' ? 'done' : ''}">Enviado</li>
        </ol>
        ${o.status === 'pending' ? '<p>Assim que o Mercado Pago confirmar, esta página atualiza sozinha. Pagamentos por Pix costumam cair em segundos; boleto leva até 3 dias úteis.</p>' : ''}
        ${o.status === 'rejected' ? '<p>Nenhum valor foi cobrado. Você pode montar o carrinho de novo e tentar com outra forma de pagamento.</p>' : ''}
        ${data.demo && o.status === 'pending' ? `
          <div class="demo-box">
            <strong>Modo demonstração</strong>
            <p class="hint">O Mercado Pago ainda não foi configurado. Simule o resultado do pagamento:</p>
            <div class="buy-row flush">
              <button class="btn small" data-demo="1">Simular pagamento aprovado</button>
              <button class="btn small ghost" data-demo="0">Simular recusa</button>
            </div>
          </div>` : ''}
        <div class="lines gap-top">
          ${o.items.map((it) => `<div class="sum-row item-row"><span>${it.qty} × ${esc(it.name)}</span><span>${brl(it.unit_price_cents * it.qty)}</span></div>`).join('')}
          <div class="sum-row"><span>Frete</span><span>${o.shipping_cents ? brl(o.shipping_cents) : 'Grátis'}</span></div>
          <div class="sum-row sum-total"><span>Total</span><span>${brl(o.total_cents)}</span></div>
        </div>
        <p class="hint gap-top">Entrega para ${esc(o.shipping.name)}: ${esc(o.shipping.street)}, ${esc(o.shipping.number)} ${esc(o.shipping.complement || '')} · ${esc(o.shipping.district)}, ${esc(o.shipping.city)}/${esc(o.shipping.state)} · CEP ${esc(o.shipping.cep)}</p>
      </section>`;

    app.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', async () => {
      await api(`/orders/${encodeURIComponent(id)}/demo-pay`, { method: 'POST', body: { approve: b.dataset.demo === '1' } });
      await loadProducts();
      viewOrder(id);
    }));

    clearTimeout(pollTimer);
    if (o.status === 'pending' && !data.demo) {
      pollTimer = setTimeout(() => { if (location.hash === `#/pedido/${id}`) viewOrder(id); }, 5000);
    }
  }

  async function viewOrders() {
    if (!requireLogin('#/pedidos')) return;
    app.innerHTML = '<p class="loading">Carregando pedidos…</p>';
    const { orders } = await api('/orders');
    app.innerHTML = `
      <section class="page mid">
        <h1>Meus pedidos</h1>
        ${orders.length ? orders.map((o) => `
          <article class="order-card">
            <div class="order-head">
              <h3><a href="#/pedido/${esc(o.id)}">Pedido ${esc(o.id)}</a></h3>
              <span class="status ${esc(o.status)}">${esc(STATUS[o.status])}</span>
            </div>
            <p class="muted flush">${new Date(o.created_at + 'Z').toLocaleDateString('pt-BR')} · ${o.items.reduce((s, i) => s + i.qty, 0)} item(ns) · ${brl(o.total_cents)}</p>
          </article>`).join('') : '<div class="empty"><p>Você ainda não fez nenhum pedido.</p><a class="btn" href="#/">Ver produtos</a></div>'}
      </section>`;
  }

  async function viewAdmin(tab = 'pedidos') {
    if (!requireLogin('#/admin')) return;
    if (state.user.role !== 'admin') return viewNotFound('Área restrita à administração.');
    app.innerHTML = '<p class="loading">Carregando…</p>';
    const [sum, ordersRes, prodRes] = await Promise.all([api('/admin/summary'), api('/admin/orders'), api('/admin/products')]);

    app.innerHTML = `
      <section class="page">
        <h1>Administração</h1>
        <div class="stats">
          <div class="stat"><b>${brl(sum.revenue_cents)}</b><span>Vendido (pago)</span></div>
          <div class="stat"><b>${sum.to_ship}</b><span>Pedidos para enviar</span></div>
          <div class="stat"><b>${sum.pending}</b><span>Aguardando pagamento</span></div>
          <div class="stat"><b>${sum.low_stock}</b><span>Produtos com estoque baixo</span></div>
        </div>
        <div class="tabs" role="group">
          <button class="chip" data-tab="pedidos" aria-pressed="${tab === 'pedidos'}">Pedidos</button>
          <button class="chip" data-tab="produtos" aria-pressed="${tab === 'produtos'}">Produtos e estoque</button>
        </div>
        <div id="admin-body"></div>
      </section>`;

    app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => viewAdmin(b.dataset.tab)));
    const body = document.getElementById('admin-body');

    if (tab === 'pedidos') {
      body.innerHTML = `
        <div class="table-wrap"><table>
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Total</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>${ordersRes.orders.map((o) => `
            <tr>
              <td><a href="#/pedido/${esc(o.id)}">${esc(o.id)}</a></td>
              <td>${esc(o.shipping.name)}<br><span class="hint">${esc(o.user_email)}</span></td>
              <td>${new Date(o.created_at + 'Z').toLocaleString('pt-BR')}</td>
              <td>${brl(o.total_cents)}</td>
              <td><span class="status ${esc(o.status)}">${esc(STATUS[o.status])}</span></td>
              <td>${o.status === 'paid' ? `<button class="btn small" data-ship="${esc(o.id)}">Marcar como enviado</button>`
                : o.status === 'pending' ? `<button class="btn small danger" data-cancel="${esc(o.id)}">Cancelar</button>` : ''}</td>
            </tr>`).join('') || '<tr><td colspan="6">Nenhum pedido ainda.</td></tr>'}
          </tbody></table></div>`;
      const act = async (id, status) => {
        try { await api(`/admin/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } }); toast('Pedido atualizado'); viewAdmin('pedidos'); }
        catch (err) { toast(err.message); }
      };
      body.querySelectorAll('[data-ship]').forEach((b) => b.addEventListener('click', () => act(b.dataset.ship, 'shipped')));
      body.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => { if (confirm('Cancelar este pedido e devolver os itens ao estoque?')) act(b.dataset.cancel, 'cancelled'); }));
    } else {
      body.innerHTML = `
        <div class="table-wrap"><table>
          <thead><tr><th>Produto</th><th>Categoria</th><th>Preço (R$)</th><th>Estoque</th><th>À venda</th><th></th></tr></thead>
          <tbody>${prodRes.products.map((p) => `
            <tr data-id="${p.id}">
              <td><strong>${esc(p.name)}</strong></td>
              <td>${esc(p.category)}</td>
              <td><input type="number" step="0.01" min="0.01" name="price" value="${(p.price_cents / 100).toFixed(2)}" aria-label="Preço de ${esc(p.name)}"></td>
              <td><input type="number" step="1" min="0" name="stock" value="${p.stock}" aria-label="Estoque de ${esc(p.name)}"></td>
              <td><input type="checkbox" name="active" ${p.active ? 'checked' : ''} class="check" aria-label="${esc(p.name)} à venda"></td>
              <td><button class="btn small" data-save>Salvar</button></td>
            </tr>`).join('')}
          </tbody></table></div>`;
      body.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', async () => {
        const row = b.closest('tr');
        const price_cents = Math.round(Number(row.querySelector('[name=price]').value) * 100);
        const stock = Number(row.querySelector('[name=stock]').value);
        const active = row.querySelector('[name=active]').checked;
        try {
          await api(`/admin/products/${row.dataset.id}`, { method: 'PATCH', body: { price_cents, stock, active } });
          await loadProducts();
          toast('Produto salvo');
        } catch (err) { toast(err.message); }
      }));
    }
  }

  function viewNotFound(msg) {
    app.innerHTML = `<section class="page empty"><h1>Página não encontrada</h1><p>${esc(msg || 'O endereço pode estar errado ou o item saiu da loja.')}</p><a class="btn" href="#/">Voltar para a loja</a></section>`;
  }

  // ---------- rotas ----------
  async function route() {
    clearTimeout(pollTimer);
    const hash = location.hash.slice(1) || '/';
    const [path, query = ''] = hash.split('?');
    const params = new URLSearchParams(query);
    const parts = path.split('/').filter(Boolean);
    window.scrollTo(0, 0);

    try {
      if (!state.loaded) await loadProducts();
      switch (parts[0]) {
        case undefined: return viewHome(params);
        case 'produto': return viewProduct(decodeURIComponent(parts[1] || ''));
        case 'carrinho': return viewCart();
        case 'entrar': return viewAuth('login');
        case 'cadastro': return viewAuth('register');
        case 'checkout': return viewCheckout();
        case 'pedidos': return viewOrders();
        case 'pedido': return viewOrder(decodeURIComponent(parts[1] || ''));
        case 'admin': return viewAdmin();
        default: return viewNotFound();
      }
    } catch (err) {
      if (err.status === 401) { state.user = null; updateAuthUI(); location.hash = '#/entrar'; return; }
      app.innerHTML = `<section class="page empty"><h1>Não foi possível carregar</h1><p>${esc(err.message)}</p><button class="btn" id="retry">Tentar de novo</button></section>`;
      document.getElementById('retry').addEventListener('click', route);
    }
  }

  document.getElementById('logout').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    state.user = null;
    updateAuthUI();
    if (location.hash === '#/entrar') route(); else location.hash = '#/entrar';
    toast('Você saiu da conta');
  });

  window.addEventListener('hashchange', route);

  (async function init() {
    updateCartCount();
    try { state.user = (await api('/auth/me')).user; } catch { state.user = null; }
    updateAuthUI();
    route();
  })();
})();
