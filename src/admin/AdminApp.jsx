// Espace de gestion Global Shop Daloa (/admin).
// Authentification par mot de passe (ADMIN_PASSWORD côté serveur) puis jeton de session signé,
// conservé dans sessionStorage : il disparaît à la fermeture de l'onglet.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  Clock,
  Copy,
  ImageUp,
  Lock,
  LogOut,
  MessageCircle,
  Package,
  Phone,
  RefreshCw,
  Trash2,
  TrendingUp,
  Truck,
} from "lucide-react";
import "./admin.css";

const TOKEN_KEY = "gs-admin-token";
const money = (value) => new Intl.NumberFormat("fr-CI").format(value ?? 0) + " FCFA";
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

// Colonnes du suivi des commandes : trois colonnes, comme au comptoir.
// Les commandes livrées et annulées partagent la colonne « Terminées » (l'annulation est un cas de clôture).
export const orderColumns = [
  {
    id: "nouvelle",
    title: "Nouvelles",
    hint: "À confirmer par téléphone",
    advance: {status: "en_preparation", label: "Passer en préparation"},
  },
  {
    id: "en_preparation",
    title: "En préparation",
    hint: "Prêtes à être livrées",
    advance: {status: "livree", label: "Marquer comme livrée"},
  },
  {
    id: "terminees",
    title: "Terminées",
    hint: "Livrées ou annulées",
    statuses: ["livree", "annulee"],
    cancel: true,
  },
];

const statusLabel = {nouvelle: "Nouvelle", en_preparation: "En préparation", livree: "Livrée", annulee: "Annulée"};

// Même calcul que le serveur : l'étiquette de promotion découle du prix barré, jamais d'une saisie libre.
export function promotionLabel(price, oldPrice) {
  const sale = Number(price);
  const reference = Number(oldPrice);
  if (!Number.isFinite(sale) || !Number.isFinite(reference) || reference <= sale) return "";
  const rate = Math.round((1 - sale / reference) * 100);
  return rate > 0 ? `−${rate} %` : "";
}

// Jour civil d'Abidjan, aligné sur le calcul du serveur (fuseau explicite, pas celui du navigateur).
export function abidjanDate(offsetDays = 0, now = Date.now()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {timeZone: "Africa/Abidjan", year: "numeric", month: "2-digit", day: "2-digit"})
      .formatToParts(new Date(now + offsetDays * 86_400_000))
      .map(part => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Les dates arrivent déjà en heure d'Abidjan (colonne calculée en SQL) : aucun fuseau n'est réinterprété.
const abidjanLabel = (value) => {
  const [date, time] = String(value ?? "").split("T");
  const [year, month, day] = (date ?? "").split("-");
  return year && time ? `${day}/${month}/${year} à ${time}` : date || "—";
};

const customerPhone = (order) => String(order.customer?.phone ?? "").replace(/\D/g, "");
const whatsappPhone = (order) => {
  const digits = customerPhone(order);
  if (!digits) return "";
  return digits.length === 10 ? `225${digits}` : digits.replace(/^00/, "");
};

async function api(path, {token, method = "GET", body} = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof Blob)) headers["Content-Type"] = "application/json";
  const response = await fetch(`/api/admin${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(Error(payload?.error ?? "Requête refusée."), {status: response.status});
  return payload;
}

function Login({onToken}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const {token} = await api("/session", {method: "POST", body: {password}});
      onToken(token);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin-login">
      <form className="admin-card" onSubmit={submit}>
        <span className="admin-eyebrow">
          <Lock size={14} /> ESPACE DE GESTION
        </span>
        <h1>Global Shop Daloa</h1>
        <p>
          Commandes, produits, promotions et ventes. Accès réservé à l’équipe de la boutique.
          Le mot de passe est celui configuré dans <code>ADMIN_PASSWORD</code>.
        </p>
        <label>
          Mot de passe
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p className="admin-error" role="alert">
            <AlertTriangle size={15} /> {error}
          </p>
        )}
        <button className="admin-button primary" type="submit" disabled={busy || !password}>
          {busy ? "Connexion…" : "Se connecter"} {!busy && <ArrowRight size={16} />}
        </button>
        <small>
          Sans <code>ADMIN_PASSWORD</code> sur le serveur, l’espace de gestion reste fermé :
          aucune donnée client n’est accessible.
        </small>
      </form>
    </div>
  );
}

function OrderCard({order, whatsappNumber, onStatus, busy}) {
  const [copied, setCopied] = useState(false);
  const lines = Array.isArray(order.lines) ? order.lines : [];
  const message = [
    `Bonjour ${order.customer?.name ?? ""}, Global Shop Daloa au sujet de votre commande ${order.reference}.`,
    order.deliverySlot ? `Créneau souhaité : ${order.deliverySlot} (heure d’Abidjan).` : "",
    `Adresse : ${order.customer?.address ?? ""}, ${order.customer?.city ?? ""}.`,
    `Montant à régler à la livraison : ${money(order.total)}.`,
  ]
    .filter(Boolean)
    .join("\n");
  const link = whatsappNumber && whatsappPhone(order)
    ? `https://wa.me/${whatsappPhone(order)}?text=${encodeURIComponent(message)}`
    : "";
  const summary = [
    `Commande ${order.reference} — ${statusLabel[order.status] ?? order.status}`,
    `Reçue le ${abidjanLabel(order.createdAtAbidjan)} (heure d’Abidjan)`,
    order.customer ? `Client : ${order.customer.name} · ${order.customer.phone}` : "",
    order.customer ? `Livraison : ${order.customer.address}, ${order.customer.city}` : "",
    order.deliverySlot ? `Créneau souhaité : ${order.deliverySlot}` : "Créneau : à confirmer par téléphone",
    ...lines.map((line) => `${line.quantity} × ${line.name}`),
    `Total : ${money(order.total)}`,
    order.customer?.note ? `Note : ${order.customer.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <article className={`order-card status-${order.status}`}>
      <header>
        <b>{order.reference}</b>
        <span className={`status-pill status-${order.status}`}>{statusLabel[order.status] ?? order.status}</span>
      </header>
      <p className="order-meta">
        <Clock size={13} /> {abidjanLabel(order.createdAtAbidjan)} · Abidjan
      </p>
      <div className="order-customer">
        <span>
          <b>{order.customer?.name ?? "Client"}</b>
          <a href={`tel:${customerPhone(order)}`}>{order.customer?.phone ?? ""}</a>
        </span>
        <span>
          {order.customer?.address}
          <br />
          {order.customer?.city}
        </span>
        <span className={order.deliverySlot ? "slot" : "slot pending"}>
          <Truck size={13} /> {order.deliverySlot ?? "Créneau à confirmer"}
        </span>
        {order.customer?.note && <span className="order-note">« {order.customer.note} »</span>}
      </div>
      <ul className="order-lines">
        {lines.map((line) => (
          <li key={line.id}>
            <span>
              {line.quantity} × {line.name}
            </span>
            <b>{money(line.quantity * line.unitPrice)}</b>
          </li>
        ))}
      </ul>
      <div className="order-total">
        <span>À encaisser à la livraison</span>
        <b>{money(order.total)}</b>
      </div>
      <div className="order-actions">
        {onStatus.advance && (
          <button className="admin-button primary small" disabled={busy} onClick={() => onStatus.onAdvance(order, onStatus.advance)}>
            {onStatus.advance.label} <ArrowRight size={14} />
          </button>
        )}
        {onStatus.cancel && order.status !== "annulee" && (
          <button className="admin-button danger small" disabled={busy} onClick={() => onStatus.onCancel(order)}>
            <Ban size={14} /> Annuler (stock restitué)
          </button>
        )}
        {link && (
          <a className="admin-button whatsapp small" href={link} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={14} /> WhatsApp
          </a>
        )}
        <a className="admin-button ghost small" href={`tel:${customerPhone(order)}`}>
          <Phone size={14} /> Appeler
        </a>
        <button
          className="admin-button ghost small"
          onClick={() => {
            navigator.clipboard?.writeText(summary).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              },
              () => {},
            );
          }}
        >
          <Copy size={14} /> {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </article>
  );
}

function OrdersBoard({token, whatsappNumber, notify, expired}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {orders: list} = await api("/orders", {token});
      setOrders(list);
    } catch (error) {
      if (error.status === 401) expired();
      else notify(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [token, expired, notify]);

  useEffect(() => {
    load();
    // Rafraîchissement automatique : le comptoir suit les commandes sans recharger la page.
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const changeStatus = async (order, status, message) => {
    setBusyId(order.id);
    try {
      const {order: updated} = await api(`/orders/${order.id}`, {token, method: "PATCH", body: {status}});
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      notify(message);
    } catch (error) {
      if (error.status === 401) expired();
      else notify(error.message, "error");
    } finally {
      setBusyId("");
    }
  };

  const inColumn = (column) =>
    orders.filter((order) => (column.statuses ? column.statuses.includes(order.status) : order.status === column.id));

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h2>Commandes</h2>
          <p>
            Trois colonnes : nouvelles, en préparation, terminées. Les créneaux sont affichés à
            l’heure d’Abidjan (GMT).
          </p>
        </div>
        <button className="admin-button ghost" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} /> Actualiser
        </button>
      </div>
      <div className="orders-board">
        {orderColumns.map((column) => {
          const items = inColumn(column);
          return (
            <div className="orders-column" key={column.id}>
              <div className="orders-column-head">
                <h3>
                  {column.title} <span>{items.length}</span>
                </h3>
                <small>{column.hint}</small>
              </div>
              {items.length === 0 && <p className="orders-empty">Aucune commande ici.</p>}
              {items.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  whatsappNumber={whatsappNumber}
                  busy={busyId === order.id}
                  onStatus={{
                    ...column,
                    onAdvance: (target, advance) => changeStatus(target, advance.status, `${target.reference} : ${statusLabel[advance.status]}.`),
                    onCancel: (target) => changeStatus(target, "annulee", `${target.reference} annulée, stock restitué.`),
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProductsPanel({token, notify, expired}) {
  const [products, setProducts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {products: list} = await api("/products", {token});
      setProducts(list);
      setDrafts(
        Object.fromEntries(
          list.map((product) => [
            product.id,
            {price: product.price, oldPrice: product.oldPrice ?? "", active: product.active, stock: product.stock},
          ]),
        ),
      );
    } catch (error) {
      if (error.status === 401) expired();
      else notify(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [token, expired, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const draft = (id) => drafts[id] ?? {};

  const save = async (product) => {
    const values = draft(product.id);
    const oldPrice = values.oldPrice === "" || values.oldPrice === null ? null : Number(values.oldPrice);
    const preview = promotionLabel(Number(values.price), oldPrice);
    if (oldPrice !== null && oldPrice <= Number(values.price)) {
      notify("Le prix barré doit être supérieur au prix de vente.", "error");
      return;
    }
    setBusyId(product.id);
    try {
      const {product: updated} = await api(`/products/${product.id}`, {
        token,
        method: "PATCH",
        body: {price: Number(values.price), oldPrice, active: Boolean(values.active), stock: Number(values.stock)},
      });
      setProducts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      notify(
        preview
          ? `${updated.name} enregistré · étiquette automatique ${preview}`
          : `${updated.name} enregistré`,
      );
    } catch (error) {
      if (error.status === 401) expired();
      else notify(error.message, "error");
    } finally {
      setBusyId("");
    }
  };

  const uploadPhoto = async (product, view, file) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      notify("Format accepté : JPEG, PNG ou WebP.", "error");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      notify("Photo trop volumineuse : 2 Mo maximum.", "error");
      return;
    }
    setBusyId(product.id);
    try {
      await api(`/products/${product.id}/photos/${view}`, {token, method: "PUT", body: file});
      await load();
      notify(`Photo « ${view} » de ${product.name} enregistrée dans PostgreSQL.`);
    } catch (error) {
      if (error.status === 401) expired();
      else notify(error.message, "error");
    } finally {
      setBusyId("");
    }
  };

  const removePhoto = async (product, view) => {
    setBusyId(product.id);
    try {
      await api(`/products/${product.id}/photos/${view}`, {token, method: "DELETE"});
      await load();
      notify(`Photo « ${view} » retirée : retour à la photo du catalogue.`);
    } catch (error) {
      if (error.status === 401) expired();
      else notify(error.message, "error");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h2>Produits, prix et promotions</h2>
          <p>
            Les promotions utilisent une étiquette calculée automatiquement à partir du prix barré.
            Les photos téléversées sont stockées dans PostgreSQL et remplacent celles du catalogue.
          </p>
        </div>
        <button className="admin-button ghost" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} /> Actualiser
        </button>
      </div>
      <div className="products-table">
        {products.map((product) => {
          const values = draft(product.id);
          const preview = promotionLabel(Number(values.price), values.oldPrice === "" ? null : Number(values.oldPrice));
          const fromDatabase = String(product.image).startsWith("/api/");
          return (
            <article className={`product-row${product.active ? "" : " hidden-product"}`} key={product.id}>
              <div className="product-visual">
                <img src={product.image} alt={product.name} loading="lazy" />
                <img src={product.extra} alt="" aria-hidden="true" loading="lazy" />
                {!product.active && <span className="hidden-flag">Masqué</span>}
              </div>
              <div className="product-fields">
                <header>
                  <b>{product.name}</b>
                  <span className="product-category">{product.category}</span>
                  {preview && <span className="promo-pill">{preview} automatique</span>}
                </header>
                <div className="product-inputs">
                  <label>
                    Prix de vente
                    <input
                      type="number"
                      min="0"
                      max="50000000"
                      value={values.price ?? ""}
                      onChange={(event) => setDrafts((current) => ({...current, [product.id]: {...values, price: event.target.value}}))}
                    />
                  </label>
                  <label>
                    Prix barré (promo)
                    <input
                      type="number"
                      min="0"
                      max="50000000"
                      placeholder="aucun"
                      value={values.oldPrice ?? ""}
                      onChange={(event) => setDrafts((current) => ({...current, [product.id]: {...values, oldPrice: event.target.value}}))}
                    />
                  </label>
                  <label>
                    Stock
                    <input
                      type="number"
                      min="0"
                      max="1000000"
                      value={values.stock ?? ""}
                      onChange={(event) => setDrafts((current) => ({...current, [product.id]: {...values, stock: event.target.value}}))}
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(values.active)}
                      onChange={(event) => setDrafts((current) => ({...current, [product.id]: {...values, active: event.target.checked}}))}
                    />
                    Visible sur le site
                  </label>
                </div>
                <div className="product-actions">
                  <button className="admin-button primary small" disabled={busyId === product.id} onClick={() => save(product)}>
                    <Check size={14} /> Enregistrer
                  </button>
                  <label className="admin-button ghost small file-button">
                    <ImageUp size={14} /> Photo principale
                    <input type="file" accept={PHOTO_TYPES.join(",")} disabled={busyId === product.id} onChange={(event) => {uploadPhoto(product, "main", event.target.files?.[0]); event.target.value = "";}} />
                  </label>
                  <label className="admin-button ghost small file-button">
                    <ImageUp size={14} /> Photo secondaire
                    <input type="file" accept={PHOTO_TYPES.join(",")} disabled={busyId === product.id} onChange={(event) => {uploadPhoto(product, "extra", event.target.files?.[0]); event.target.value = "";}} />
                  </label>
                  {fromDatabase && (
                    <button className="admin-button danger small" disabled={busyId === product.id} onClick={() => removePhoto(product, "main")}>
                      <Trash2 size={14} /> Retirer la photo
                    </button>
                  )}
                  <small className="product-note">
                    {fromDatabase ? "Photo servie depuis PostgreSQL." : "Photo actuelle du catalogue (fichier statique)."}
                  </small>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SalesPanel({token, notify, expired}) {
  const [range, setRange] = useState("30");
  const [from, setFrom] = useState(abidjanDate(-29));
  const [to, setTo] = useState(abidjanDate(0));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const preset = (value) => {
    setRange(value);
    if (value === "7") {
      setFrom(abidjanDate(-6));
      setTo(abidjanDate(0));
    } else if (value === "30") {
      setFrom(abidjanDate(-29));
      setTo(abidjanDate(0));
    } else if (value === "month") {
      setFrom(`${abidjanDate(0).slice(0, 7)}-01`);
      setTo(abidjanDate(0));
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await api(`/sales?from=${from}&to=${to}`, {token}));
    } catch (error) {
      if (error.status === 401) expired();
      else notify(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [from, to, token, expired, notify]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h2>Ventes par période</h2>
          <p>
            Jours civils d’Abidjan (GMT). Les commandes annulées sont exclues du chiffre
            d’affaires.
          </p>
        </div>
        <div className="sales-presets">
          <button className={`admin-button ghost small${range === "7" ? " active" : ""}`} onClick={() => preset("7")}>
            7 jours
          </button>
          <button className={`admin-button ghost small${range === "30" ? " active" : ""}`} onClick={() => preset("30")}>
            30 jours
          </button>
          <button className={`admin-button ghost small${range === "month" ? " active" : ""}`} onClick={() => preset("month")}>
            Mois en cours
          </button>
        </div>
      </div>
      <div className="sales-range">
        <label>
          Du
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setRange("custom");
              setFrom(event.target.value);
            }}
          />
        </label>
        <label>
          Au
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setRange("custom");
              setTo(event.target.value);
            }}
          />
        </label>
        <button className="admin-button primary small" onClick={load} disabled={loading}>
          <TrendingUp size={14} /> Calculer
        </button>
      </div>
      {report && (
        <>
          <div className="sales-totals">
            <div>
              <small>Commandes</small>
              <b>{report.totals.orders}</b>
            </div>
            <div>
              <small>Chiffre d’affaires attendu</small>
              <b>{money(report.totals.total)}</b>
            </div>
            <div>
              <small>Période</small>
              <b>
                {report.from} → {report.to}
              </b>
            </div>
            <div>
              <small>Fuseau</small>
              <b>{report.timezone}</b>
            </div>
          </div>
          <table className="sales-table">
            <thead>
              <tr>
                <th>Jour (Abidjan)</th>
                <th>Commandes</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              {[...report.days].reverse().map((day) => (
                <tr key={day.date} className={day.orders ? "" : "empty-day"}>
                  <td>{abidjanLabel(`${day.date}T00:00`).split(" à ")[0]}</td>
                  <td>{day.orders}</td>
                  <td>{money(day.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

export default function AdminApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? "");
  const [tab, setTab] = useState("orders");
  const [products, setProducts] = useState([]);
  const [notice, setNotice] = useState(null);

  const notify = useCallback((message, kind = "success") => setNotice({message, kind}), []);
  const expired = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setNotice({message: "Session expirée : reconnectez-vous.", kind: "error"});
  }, []);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    api("/products", {token})
      .then(({products: list, whatsappNumber: number}) => {
        if (alive) setProducts({list, number});
      })
      .catch((error) => {
        if (error.status === 401) expired();
      });
    return () => {
      alive = false;
    };
  }, [token, expired]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!token) {
    return (
      <Login
        onToken={(value) => {
          sessionStorage.setItem(TOKEN_KEY, value);
          setToken(value);
        }}
      />
    );
  }

  const whatsappNumber = products?.number ?? "";
  const catalog = products?.list ?? [];
  const lowStock = catalog.filter((product) => product.stock === 0).length;

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">
          <span className="admin-mark">GS</span>
          <span>
            <b>Espace de gestion</b>
            <small>Global Shop Daloa · heures d’Abidjan</small>
          </span>
        </div>
        <nav className="admin-tabs">
          <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>
            <Package size={15} /> Commandes
          </button>
          <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>
            <ImageUp size={15} /> Produits
          </button>
          <button className={tab === "sales" ? "active" : ""} onClick={() => setTab("sales")}>
            <TrendingUp size={15} /> Ventes
          </button>
        </nav>
        <div className="admin-header-side">
          <span className={whatsappNumber ? "wa-ok" : "wa-off"}>
            <MessageCircle size={14} /> {whatsappNumber ? `WhatsApp +${whatsappNumber}` : "WHATSAPP_NUMBER absent"}
          </span>
          {lowStock > 0 && <span className="stock-alert">{lowStock} produit(s) épuisé(s)</span>}
          <button
            className="admin-button ghost small"
            onClick={() => {
              sessionStorage.removeItem(TOKEN_KEY);
              setToken("");
            }}
          >
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </header>
      <main className="admin-main">
        {whatsappNumber === "" && tab !== "sales" && (
          <p className="admin-warning">
            <AlertTriangle size={15} /> <code>WHATSAPP_NUMBER</code> n’est pas configuré : les liens
            wa.me restent indisponibles. Aucun message n’est jamais envoyé automatiquement par le
            site.
          </p>
        )}
        {tab === "orders" && <OrdersBoard token={token} whatsappNumber={whatsappNumber} notify={notify} expired={expired} />}
        {tab === "products" && <ProductsPanel token={token} notify={notify} expired={expired} />}
        {tab === "sales" && <SalesPanel token={token} notify={notify} expired={expired} />}
      </main>
      <div className="admin-toast" role="status" aria-live="polite">
        {notice && <span className={notice.kind}>{notice.message}</span>}
      </div>
    </div>
  );
}
