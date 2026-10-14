// Espace de gestion Global Shop Daloa (/admin).
// Authentification par mot de passe principal (ADMIN_PASSWORD -> Admin) ou par code aléatoire
// unique généré par l'administrateur (AGT-XXXX-XXXX -> Agent).
import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  Clock,
  Copy,
  Eye,
  ImageUp,
  KeyRound,
  Lock,
  LogOut,
  MessageCircle,
  Package,
  Pause,
  Phone,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import BrandLogo from "../BrandLogo.jsx";
import "./admin.css";

const TOKEN_KEY = "gs-admin-token";
const SESSION_META_KEY = "gs-admin-session-meta";
const money = (value) => new Intl.NumberFormat("fr-CI").format(value ?? 0) + " FCFA";
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_CATEGORIES = ["Mode", "High-tech", "Maison", "Beauté"];

// Colonnes du suivi des commandes : trois colonnes, comme au comptoir.
// Les commandes livrées et annulées partagent la colonne « Terminées ».
// L'annulation (stock restitué) est proposée avant livraison ; une commande livrée ne peut plus être annulée.
export const orderColumns = [
  {
    id: "nouvelle",
    title: "Nouvelles",
    hint: "À confirmer par téléphone",
    advance: {status: "en_preparation", label: "Passer en préparation"},
    cancel: true,
  },
  {
    id: "en_preparation",
    title: "En préparation",
    hint: "Prêtes à être livrées",
    advance: {status: "livree", label: "Marquer comme livrée"},
    cancel: true,
  },
  {
    id: "terminees",
    title: "Terminées",
    hint: "Livrées ou annulées",
    statuses: ["livree", "annulee"],
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

function Login({onSession}) {
  const [mode, setMode] = useState("admin");
  const [credential, setCredential] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = mode === "agent"
        ? {agentCode: credential.trim().toUpperCase()}
        : {password: credential};
      const session = await api("/session", {method: "POST", body: payload});
      onSession(session);
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
          Commandes, nouveaux produits, stocks, promotions et suivi en temps réel.
          Connectez-vous en tant qu’administrateur ou avec votre code agent unique.
        </p>
        <div className="login-mode-tabs" role="tablist" aria-label="Mode de connexion">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "admin"}
            className={mode === "admin" ? "active" : ""}
            onClick={() => {
              setMode("admin");
              setError("");
            }}
          >
            <ShieldCheck size={14} /> Administrateur
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "agent"}
            className={mode === "agent" ? "active" : ""}
            onClick={() => {
              setMode("agent");
              setError("");
            }}
          >
            <KeyRound size={14} /> Code Agent
          </button>
        </div>
        <label>
          {mode === "agent" ? "Code d’accès agent unique" : "Mot de passe administrateur"}
          <input
            type={mode === "agent" ? "text" : "password"}
            autoComplete={mode === "agent" ? "off" : "current-password"}
            placeholder={mode === "agent" ? "Ex. AGT-4F8K-92M7" : "Mot de passe ADMIN_PASSWORD"}
            required
            value={credential}
            onChange={(event) => setCredential(event.target.value)}
          />
        </label>
        {error && (
          <p className="admin-error" role="alert">
            <AlertTriangle size={15} /> {error}
          </p>
        )}
        <button className="admin-button primary" type="submit" disabled={busy || !credential.trim()}>
          {busy ? "Connexion…" : "Se connecter"} {!busy && <ArrowRight size={16} />}
        </button>
        <small>
          {mode === "agent"
            ? "Chaque agent dispose d’un code aléatoire unique généré par l’administrateur dans l’onglet « Agents & Codes »."
            : "Sans ADMIN_PASSWORD sur le serveur, l’espace de gestion reste fermé : aucune donnée client n’est accessible."}
        </small>
      </form>
    </div>
  );
}

function RealtimePulseBar({realtime, session, onOpenRealtime, onOpenOrders, onOpenProducts}) {
  if (!realtime) return null;
  const pendingOrders = (realtime.orders?.pending ?? 0) + (realtime.orders?.preparing ?? 0);
  const stockAlerts = (realtime.stock?.outOfStockCount ?? 0) + (realtime.stock?.lowStockCount ?? 0);

  return (
    <div className="realtime-pulse-bar" role="region" aria-label="Aperçu en temps réel">
      <div className="pulse-status">
        <span className="live-dot" aria-hidden="true" />
        <div>
          <b>EN DIRECT · E-COMMERCE</b>
          <small>
            {realtime.serverTimeAbidjan ? `${realtime.serverTimeAbidjan.replace("T", " · ")} GMT` : "Heure d’Abidjan"}
          </small>
        </div>
      </div>
      <div className="pulse-metrics">
        <button type="button" className="pulse-chip" onClick={onOpenRealtime}>
          <Eye size={14} />
          <span>
            <b>{realtime.visitors?.online ?? 0}</b> visiteur(s) en ligne
            {(realtime.visitors?.activeCarts ?? 0) > 0 && ` · ${realtime.visitors.activeCarts} panier(s)`}
          </span>
        </button>
        <button type="button" className="pulse-chip" onClick={onOpenOrders}>
          <Package size={14} />
          <span>
            <b>{pendingOrders}</b> commande(s) à traiter ({realtime.orders?.pending ?? 0} nouv.)
          </span>
        </button>
        <button type="button" className="pulse-chip" onClick={onOpenRealtime}>
          <TrendingUp size={14} />
          <span>
            Aujourd’hui : <b>{money(realtime.orders?.todayRevenue ?? 0)}</b> ({realtime.orders?.todayOrders ?? 0} cmd)
          </span>
        </button>
        <button
          type="button"
          className={`pulse-chip${stockAlerts > 0 ? " alert" : ""}`}
          onClick={onOpenProducts}
        >
          <ShoppingBag size={14} />
          <span>
            <b>{realtime.stock?.activeProducts ?? 0}</b> produits actifs
            {stockAlerts > 0 ? ` · ${stockAlerts} alerte(s) stock` : " · Stocks OK"}
          </span>
        </button>
      </div>
      <div className="pulse-actor">
        <UserCheck size={14} />
        <span>
          {session.role === "admin" ? "Admin principal" : `Agent : ${session.actor}`}
        </span>
      </div>
    </div>
  );
}

function RealtimePanel({token, notify, expired, onNavigate}) {
  const [data, setData] = useState(null);
  const [category, setCategory] = useState("");
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = category ? `?category=${encodeURIComponent(category)}&limit=80` : "?limit=80";
      const result = await api(`/realtime${query}`, {token});
      setData(result);
    } catch (error) {
      if (error.status === 401) expired();
      else notify(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [token, category, expired, notify]);

  useEffect(() => {
    load();
    if (!live) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load, live]);

  const events = data?.events ?? [];
  const visitors = data?.visitors?.sessions ?? [];
  const alerts = data?.stock?.alerts ?? [];

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span className="admin-eyebrow">
            <Activity size={13} /> MONITORING E-COMMERCE EN DIRECT
          </span>
          <h2>Zone de suivi en temps réel</h2>
          <p>
            Suivez en direct tout ce qui se passe sur Global Shop Daloa : visiteurs actifs, paniers,
            commandes, suivis clients, ajouts de produits, mouvements de stock et connexions d’agents.
          </p>
        </div>
        <div className="realtime-controls">
          <button
            type="button"
            className={`admin-button small ${live ? "primary" : "ghost"}`}
            onClick={() => setLive((current) => !current)}
          >
            {live ? <Pause size={14} /> : <Play size={14} />}
            {live ? "Direct actif (5 s)" : "Direct en pause"}
          </button>
          <button type="button" className="admin-button ghost small" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Actualiser
          </button>
        </div>
      </div>

      <div className="realtime-kpi-grid">
        <article className="realtime-kpi-card">
          <header>
            <Eye size={16} />
            <span>Visiteurs & paniers en direct</span>
          </header>
          <b>{data?.visitors?.online ?? 0} en ligne</b>
          <small>
            {data?.visitors?.activeCarts ?? 0} visiteur(s) avec un panier actif (5 dernières minutes)
          </small>
        </article>
        <article className="realtime-kpi-card">
          <header>
            <Package size={16} />
            <span>Commandes en cours</span>
          </header>
          <b>
            {data?.orders?.pending ?? 0} nouvelle(s) · {data?.orders?.preparing ?? 0} en prép.
          </b>
          <small>
            {data?.orders?.delivered ?? 0} livrée(s) · {data?.orders?.cancelled ?? 0} annulée(s) au total
          </small>
        </article>
        <article className="realtime-kpi-card">
          <header>
            <TrendingUp size={16} />
            <span>Activité du jour (Abidjan)</span>
          </header>
          <b>{money(data?.orders?.todayRevenue ?? 0)}</b>
          <small>{data?.orders?.todayOrders ?? 0} commande(s) validée(s) aujourd’hui</small>
        </article>
        <article className="realtime-kpi-card">
          <header>
            <ShoppingBag size={16} />
            <span>Stock & Catalogue</span>
          </header>
          <b>{data?.stock?.totalProducts ?? 0} produits</b>
          <small>
            {data?.stock?.customProductsCount ?? 0} ajouté(s) · {data?.stock?.outOfStockCount ?? 0} rupture(s) · {data?.agents?.activeCount ?? 0} agent(s)
          </small>
        </article>
      </div>

      <div className="realtime-filters">
        {[
          {id: "", label: "Toute l’activité"},
          {id: "commandes", label: "Commandes & Suivis"},
          {id: "visiteurs", label: "Visiteurs & Paniers"},
          {id: "stock", label: "Stock & Produits"},
          {id: "equipe", label: "Équipe & Agents"},
        ].map((item) => (
          <button
            key={item.id || "all"}
            type="button"
            className={`admin-button ghost small${category === item.id ? " active" : ""}`}
            onClick={() => setCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="realtime-columns">
        <div className="realtime-feed-box">
          <div className="realtime-box-head">
            <h3>
              Flux d’événements en direct <span>{events.length}</span>
            </h3>
            <small>Heure d’Abidjan (GMT)</small>
          </div>
          {events.length === 0 ? (
            <p className="orders-empty">Aucun événement enregistré pour ce filtre.</p>
          ) : (
            <ul className="realtime-event-list">
              {events.map((event) => (
                <li key={event.id} className={`realtime-event-item cat-${event.category}`}>
                  <div className="realtime-event-top">
                    <span className={`event-badge cat-${event.category}`}>{event.category}</span>
                    <b>{event.title}</b>
                    <time>{abidjanLabel(event.createdAtAbidjan)}</time>
                  </div>
                  {event.detail && <p>{event.detail}</p>}
                  <small>Acteur : {event.actor}</small>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="realtime-side-column">
          <div className="realtime-feed-box">
            <div className="realtime-box-head">
              <h3>
                Visiteurs actifs sur le site <span>{visitors.length}</span>
              </h3>
              <small>Fenêtre 5 min</small>
            </div>
            {visitors.length === 0 ? (
              <p className="orders-empty">Aucun visiteur actif dans les 5 dernières minutes.</p>
            ) : (
              <ul className="visitor-session-list">
                {visitors.map((v) => (
                  <li key={v.sessionId}>
                    <div>
                      <b>Session #{v.sessionId}</b>
                      <span>{v.lastAction}</span>
                    </div>
                    <div className="visitor-meta">
                      {v.cartCount > 0 && <span className="cart-pill">{v.cartCount} art. au panier</span>}
                      {v.city && <small>{v.city}</small>}
                      <small>{v.updatedAtAbidjan}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="realtime-feed-box">
            <div className="realtime-box-head">
              <h3>
                Alertes de stock en direct <span>{alerts.length}</span>
              </h3>
              <button type="button" className="admin-button ghost small" onClick={() => onNavigate("products")}>
                Gérer le stock
              </button>
            </div>
            {alerts.length === 0 ? (
              <p className="orders-empty">Tous les produits actifs ont un stock suffisant.</p>
            ) : (
              <ul className="stock-alert-list">
                {alerts.map((item) => (
                  <li key={item.id} className={item.level === "rupture" ? "rupture" : "faible"}>
                    <div>
                      <b>{item.name}</b>
                      <small>{item.category}</small>
                    </div>
                    <span>
                      {item.stock === 0 ? "Épuisé (0)" : `Stock faible (${item.stock})`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
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
        {order.updatedBy && <span className="order-updated-by"> · Dernière action par {order.updatedBy}</span>}
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
        {onStatus.cancel && order.status !== "annulee" && order.status !== "livree" && (
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

function OrdersBoard({token, whatsappNumber, notify, expired, onChanged}) {
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
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
  }, [load]);

  const changeStatus = async (order, status, message) => {
    setBusyId(order.id);
    try {
      const {order: updated} = await api(`/orders/${order.id}`, {token, method: "PATCH", body: {status}});
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      notify(message);
      onChanged?.();
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

const emptyNewProduct = {
  name: "",
  category: "Mode",
  price: "",
  oldPrice: "",
  stock: "10",
  color: "Standard",
  badge: "NOUVEAU",
  description: "",
  specsText: "",
  active: true,
  mainPhoto: null,
  extraPhoto: null,
};

function ProductsPanel({token, session, notify, expired, onChanged}) {
  const isAdmin = session?.role === "admin";
  const [products, setProducts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProduct, setNewProduct] = useState(emptyNewProduct);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {products: list} = await api("/products", {token});
      setProducts(list);
      setDrafts(
        Object.fromEntries(
          list.map((product) => [
            product.id,
            {
              name: product.name,
              category: product.category,
              color: product.color ?? "Standard",
              description: product.description ?? "",
              price: product.price,
              oldPrice: product.oldPrice ?? "",
              active: product.active,
              stock: product.stock,
            },
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

  const createProduct = async (event) => {
    event.preventDefault();
    const price = Number(newProduct.price);
    const oldPrice = newProduct.oldPrice === "" || newProduct.oldPrice === null ? null : Number(newProduct.oldPrice);
    const stock = Number(newProduct.stock);
    if (!Number.isFinite(price) || price < 0) {
      notify("Indiquez un prix de vente valide en FCFA.", "error");
      return;
    }
    if (oldPrice !== null && oldPrice <= price) {
      notify("Le prix barré doit être supérieur au prix de vente.", "error");
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      notify("Indiquez une quantité en stock valide (0 ou plus).", "error");
      return;
    }
    setCreating(true);
    try {
      const {product: created} = await api("/products", {
        token,
        method: "POST",
        body: {
          name: newProduct.name.trim(),
          category: newProduct.category.trim() || "Mode",
          price: Math.round(price),
          oldPrice: oldPrice === null ? null : Math.round(oldPrice),
          stock: Math.round(stock),
          color: newProduct.color.trim() || "Standard",
          badge: newProduct.badge.trim(),
          description: newProduct.description.trim(),
          specs: newProduct.specsText,
          active: Boolean(newProduct.active),
        },
      });
      if (newProduct.mainPhoto) {
        await api(`/products/${created.id}/photos/main`, {
          token,
          method: "PUT",
          body: newProduct.mainPhoto,
        });
      }
      if (newProduct.extraPhoto) {
        await api(`/products/${created.id}/photos/extra`, {
          token,
          method: "PUT",
          body: newProduct.extraPhoto,
        });
      }
      setNewProduct(emptyNewProduct);
      setCreateOpen(false);
      await load();
      onChanged?.();
      notify(`Nouveau produit « ${created.name} » ajouté au stock (${created.stock} unité(s)).`);
    } catch (error) {
      if (error.status === 401) expired();
      else notify(error.message, "error");
    } finally {
      setCreating(false);
    }
  };

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
      const patchBody = {
        price: Number(values.price),
        oldPrice,
        active: Boolean(values.active),
        stock: Number(values.stock),
      };
      if (product.custom) {
        patchBody.name = values.name;
        patchBody.category = values.category;
        patchBody.color = values.color;
        patchBody.description = values.description;
      }
      const {product: updated} = await api(`/products/${product.id}`, {
        token,
        method: "PATCH",
        body: patchBody,
      });
      setProducts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      onChanged?.();
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
      onChanged?.();
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
      onChanged?.();
      notify(`Photo « ${view} » retirée : retour à la photo du catalogue.`);
    } catch (error) {
      if (error.status === 401) expired();
      else notify(error.message, "error");
    } finally {
      setBusyId("");
    }
  };

  const deleteCustom = async (product) => {
    setBusyId(product.id);
    try {
      await api(`/products/${product.id}`, {token, method: "DELETE"});
      await load();
      onChanged?.();
      notify(`Produit « ${product.name} » retiré du catalogue.`);
    } catch (error) {
      if (error.status === 401) expired();
      else notify(error.message, "error");
    } finally {
      setBusyId("");
    }
  };

  const newPromoPreview = promotionLabel(
    Number(newProduct.price),
    newProduct.oldPrice === "" ? null : Number(newProduct.oldPrice),
  );

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h2>Produits, stocks, prix et promotions</h2>
          <p>
            {isAdmin
              ? "Seul l’administrateur ajoute de nouveaux produits et ajuste prix, stocks, visibilité et photos."
              : "Consultation en lecture seule : produits, prix, promotions et stocks. Seul l’administrateur peut les modifier."}
          </p>
        </div>
        <div className="panel-head-actions">
          {isAdmin && (
            <button
              type="button"
              className="admin-button primary"
              onClick={() => setCreateOpen((open) => !open)}
            >
              <Plus size={15} /> {createOpen ? "Fermer le formulaire" : "Nouveau produit"}
            </button>
          )}
          <button className="admin-button ghost" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? "spin" : ""} /> Actualiser
          </button>
        </div>
      </div>

      {isAdmin && createOpen && (
        <form className="new-product-form" onSubmit={createProduct}>
          <div className="new-product-head">
            <div>
              <span className="admin-eyebrow">
                <Sparkles size={13} /> ENTRÉE EN STOCK — {session.actor.toUpperCase()}
              </span>
              <h3>Ajouter un nouveau produit dans le stock</h3>
            </div>
            {newPromoPreview && (
              <span className="promo-pill">{newPromoPreview} calculé automatiquement</span>
            )}
          </div>
          <div className="new-product-grid">
            <label>
              Nom du produit *
              <input
                required
                minLength={2}
                maxLength={120}
                placeholder="Ex. Parfum Oud Royal 50 ml"
                value={newProduct.name}
                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
              />
            </label>
            <label>
              Catégorie *
              <select
                value={newProduct.category}
                onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
              >
                {DEFAULT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prix de vente (FCFA) *
              <input
                type="number"
                required
                min="0"
                max="50000000"
                placeholder="Ex. 15000"
                value={newProduct.price}
                onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
              />
            </label>
            <label>
              Prix barré avant promo (FCFA)
              <input
                type="number"
                min="0"
                max="50000000"
                placeholder="Facultatif (ex. 20000)"
                value={newProduct.oldPrice}
                onChange={(e) => setNewProduct({...newProduct, oldPrice: e.target.value})}
              />
            </label>
            <label>
              Quantité initiale en stock *
              <input
                type="number"
                required
                min="0"
                max="1000000"
                placeholder="Ex. 15"
                value={newProduct.stock}
                onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
              />
            </label>
            <label>
              Finition / Format / Couleur
              <input
                maxLength={80}
                placeholder="Ex. Flacon 50 ml, Noir mat, Taille M…"
                value={newProduct.color}
                onChange={(e) => setNewProduct({...newProduct, color: e.target.value})}
              />
            </label>
            <label>
              Étiquette (hors promo)
              <select
                value={newProduct.badge}
                onChange={(e) => setNewProduct({...newProduct, badge: e.target.value})}
              >
                <option value="NOUVEAU">NOUVEAU</option>
                <option value="BEST-SELLER">BEST-SELLER</option>
                <option value="COUP DE CŒUR">COUP DE CŒUR</option>
                <option value="">Aucune étiquette</option>
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={newProduct.active}
                onChange={(e) => setNewProduct({...newProduct, active: e.target.checked})}
              />
              Visible immédiatement dans la boutique
            </label>
          </div>
          <div className="new-product-details">
            <label>
              Description complète du produit
              <textarea
                rows={2}
                maxLength={1000}
                placeholder="Décrivez le produit, ses atouts et les détails utiles au client…"
                value={newProduct.description}
                onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
              />
            </label>
            <label>
              Caractéristiques / Points clés (1 par ligne)
              <textarea
                rows={2}
                maxLength={800}
                placeholder={"Ex. Garantie vérifiée en boutique\nLivraison rapide Daloa & Bouaké"}
                value={newProduct.specsText}
                onChange={(e) => setNewProduct({...newProduct, specsText: e.target.value})}
              />
            </label>
          </div>
          <div className="new-product-footer">
            <div className="new-product-photos">
              <label className="admin-button ghost small file-button">
                <ImageUp size={14} />{" "}
                {newProduct.mainPhoto ? `Principale : ${newProduct.mainPhoto.name}` : "Choisir photo principale"}
                <input
                  type="file"
                  accept={PHOTO_TYPES.join(",")}
                  onChange={(e) => setNewProduct({...newProduct, mainPhoto: e.target.files?.[0] ?? null})}
                />
              </label>
              <label className="admin-button ghost small file-button">
                <ImageUp size={14} />{" "}
                {newProduct.extraPhoto ? `Secondaire : ${newProduct.extraPhoto.name}` : "Choisir photo secondaire"}
                <input
                  type="file"
                  accept={PHOTO_TYPES.join(",")}
                  onChange={(e) => setNewProduct({...newProduct, extraPhoto: e.target.files?.[0] ?? null})}
                />
              </label>
            </div>
            <button type="submit" className="admin-button primary" disabled={creating || !newProduct.name.trim() || newProduct.price === ""}>
              <Check size={15} /> {creating ? "Ajout au stock…" : "Enregistrer le nouveau produit"}
            </button>
          </div>
        </form>
      )}

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
                  {product.custom && (
                    <span className="custom-pill">
                      Ajouté par {product.createdBy || "Admin"}
                    </span>
                  )}
                  {preview && <span className="promo-pill">{preview} automatique</span>}
                </header>
                {product.custom && (
                  <div className="product-inputs custom-meta-inputs">
                    <label>
                      Nom du produit
                      <input disabled={!isAdmin}
                        type="text"
                        value={values.name ?? product.name}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [product.id]: {...values, name: event.target.value},
                          }))
                        }
                      />
                    </label>
                    <label>
                      Catégorie
                      <select disabled={!isAdmin}
                        value={values.category ?? product.category}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [product.id]: {...values, category: event.target.value},
                          }))
                        }
                      >
                        {DEFAULT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Format / Couleur
                      <input disabled={!isAdmin}
                        type="text"
                        value={values.color ?? product.color ?? ""}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [product.id]: {...values, color: event.target.value},
                          }))
                        }
                      />
                    </label>
                    <label>
                      Description
                      <input disabled={!isAdmin}
                        type="text"
                        value={values.description ?? product.description ?? ""}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [product.id]: {...values, description: event.target.value},
                          }))
                        }
                      />
                    </label>
                  </div>
                )}
                <div className="product-inputs">
                  <label>
                    Prix de vente
                    <input disabled={!isAdmin}
                      type="number"
                      min="0"
                      max="50000000"
                      value={values.price ?? ""}
                      onChange={(event) => setDrafts((current) => ({...current, [product.id]: {...values, price: event.target.value}}))}
                    />
                  </label>
                  <label>
                    Prix barré (promo)
                    <input disabled={!isAdmin}
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
                    <input disabled={!isAdmin}
                      type="number"
                      min="0"
                      max="1000000"
                      value={values.stock ?? ""}
                      onChange={(event) => setDrafts((current) => ({...current, [product.id]: {...values, stock: event.target.value}}))}
                    />
                  </label>
                  <label className="checkbox">
                    <input disabled={!isAdmin}
                      type="checkbox"
                      checked={Boolean(values.active)}
                      onChange={(event) => setDrafts((current) => ({...current, [product.id]: {...values, active: event.target.checked}}))}
                    />
                    Visible sur le site
                  </label>
                </div>
                {isAdmin ? (
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
                  {product.custom && session.role === "admin" && (
                    <button className="admin-button danger small" disabled={busyId === product.id} onClick={() => deleteCustom(product)}>
                      <Trash2 size={14} /> Supprimer le produit
                    </button>
                  )}
                  <small className="product-note">
                    {fromDatabase ? "Photo servie depuis PostgreSQL." : "Photo actuelle du catalogue (fichier statique)."}
                  </small>
                </div>
                ) : (
                  <p className="product-note readonly-note">Lecture seule — prix, stock et visibilité gérés par l’administrateur.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AgentsPanel({token, notify, expired, onChanged}) {
  const [agents, setAgents] = useState([]);
  const [name, setName] = useState("");
  const [roleLabel, setRoleLabel] = useState("Agent commandes & livraison");
  const [createdAgent, setCreatedAgent] = useState(null);
  const [copiedId, setCopiedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {agents: list} = await api("/agents", {token});
      setAgents(list);
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

  const generate = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const {agent} = await api("/agents", {
        token,
        method: "POST",
        body: {name: name.trim(), roleLabel},
      });
      setCreatedAgent(agent);
      setName("");
      await load();
      onChanged?.();
      notify(`Code aléatoire unique généré pour ${agent.name} : ${agent.code}`);
    } catch (error) {
      if (error.status === 401) expired();
      else notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (agent) => {
    setBusy(true);
    try {
      await api(`/agents/${agent.id}`, {token, method: "DELETE"});
      if (createdAgent?.id === agent.id) setCreatedAgent(null);
      await load();
      onChanged?.();
      notify(`Code de ${agent.name} révoqué.`);
    } catch (error) {
      if (error.status === 401) expired();
      else notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = (id, text) => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(""), 2000);
      },
      () => {},
    );
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span className="admin-eyebrow">
            <KeyRound size={13} /> ACCÈS ÉQUIPE · CODES UNIQUES GARANTIS
          </span>
          <h2>Générateur de codes aléatoires pour les agents</h2>
          <p>
            Seul l’administrateur principal peut générer ou révoquer des codes d’accès. Chaque
            agent reçoit un code aléatoire strictement unique (<code>AGT-XXXX-XXXX</code>) lui
            permettant de traiter les commandes et de consulter le catalogue en lecture seule.
            Aucun agent ne peut ajouter de produits au stock ni modifier prix, stocks ou photos :
            ces actions sont réservées à l’administrateur.
          </p>
        </div>
        <button className="admin-button ghost" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} /> Actualiser
        </button>
      </div>

      <form className="agent-generator-form" onSubmit={generate}>
        <label>
          Nom complet ou identifiant de l’agent *
          <input
            required
            minLength={2}
            maxLength={80}
            placeholder="Ex. Kouamé Yao — Agent Daloa"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Mission / Rôle
          <select value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)}>
            <option value="Agent commandes & livraison">Agent commandes & livraison</option>
            <option value="Agent polyvalent Daloa">Agent polyvalent Daloa</option>
            <option value="Agent polyvalent Bouaké">Agent polyvalent Bouaké</option>
          </select>
        </label>
        <button type="submit" className="admin-button primary" disabled={busy || name.trim().length < 2}>
          <KeyRound size={15} /> {busy ? "Génération…" : "Générer un code unique"}
        </button>
      </form>

      {createdAgent && (
        <div className="generated-code-banner" role="status">
          <div>
            <span className="admin-eyebrow">NOUVEAU CODE AGENT GÉNÉRÉ</span>
            <h3>
              {createdAgent.name} · <code>{createdAgent.code}</code>
            </h3>
            <p>
              Partagez ce code personnel avec {createdAgent.name}. Deux agents ne peuvent jamais
              recevoir le même code.
            </p>
          </div>
          <div className="generated-code-actions">
            <button
              type="button"
              className="admin-button primary small"
              onClick={() => copyCode("new-code", createdAgent.code)}
            >
              <Copy size={14} /> {copiedId === "new-code" ? "Code copié !" : "Copier le code"}
            </button>
            <button
              type="button"
              className="admin-button ghost small"
              onClick={() =>
                copyCode(
                  "new-msg",
                  `Bonjour ${createdAgent.name}, voici votre code d’accès personnel Global Shop Daloa (/admin -> onglet Code Agent) : ${createdAgent.code}`,
                )
              }
            >
              <Copy size={14} /> {copiedId === "new-msg" ? "Message copié !" : "Copier l’invitation"}
            </button>
          </div>
        </div>
      )}

      <div className="agents-list">
        {agents.length === 0 ? (
          <p className="orders-empty">
            Aucun code agent actif. Utilisez le générateur ci-dessus pour créer un code unique à
            partager avec un agent.
          </p>
        ) : (
          <table className="sales-table agents-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Rôle</th>
                <th>Code unique</th>
                <th>Créé le (Abidjan)</th>
                <th>Dernière connexion</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td>
                    <b>{agent.name}</b>
                  </td>
                  <td>{agent.roleLabel}</td>
                  <td>
                    <code className="agent-code-badge">{agent.code}</code>
                  </td>
                  <td>{abidjanLabel(agent.createdAtAbidjan)}</td>
                  <td>
                    {agent.lastUsedAtAbidjan
                      ? abidjanLabel(agent.lastUsedAtAbidjan)
                      : "Jamais utilisé"}
                  </td>
                  <td>
                    <div className="agent-row-actions">
                      <button
                        type="button"
                        className="admin-button ghost small"
                        onClick={() => copyCode(agent.id, agent.code)}
                      >
                        <Copy size={13} /> {copiedId === agent.id ? "Copié" : "Copier"}
                      </button>
                      <button
                        type="button"
                        className="admin-button danger small"
                        disabled={busy}
                        onClick={() => revoke(agent)}
                      >
                        <Trash2 size={13} /> Révoquer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
  const [sessionMeta, setSessionMeta] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_META_KEY) || "null") || {role: "admin", actor: "Admin"};
    } catch {
      return {role: "admin", actor: "Admin"};
    }
  });
  const [tab, setTab] = useState("orders");
  const [products, setProducts] = useState([]);
  const [realtime, setRealtime] = useState(null);
  const [notice, setNotice] = useState(null);

  const notify = useCallback((message, kind = "success") => setNotice({message, kind}), []);
  const expired = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(SESSION_META_KEY);
    setToken("");
    setNotice({message: "Session expirée : reconnectez-vous.", kind: "error"});
  }, []);

  const refreshHeaderData = useCallback(() => {
    if (!token) return;
    api("/products", {token})
      .then(({products: list, whatsappNumber: number, session}) => {
        setProducts({list, number});
        if (session) {
          setSessionMeta(session);
          sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(session));
        }
      })
      .catch((error) => {
        if (error.status === 401) expired();
      });
    api("/realtime?limit=25", {token})
      .then((overview) => setRealtime(overview))
      .catch(() => {});
  }, [token, expired]);

  useEffect(() => {
    if (!token) return;
    refreshHeaderData();
    const timer = setInterval(refreshHeaderData, 8000);
    return () => clearInterval(timer);
  }, [token, refreshHeaderData]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!token) {
    return (
      <Login
        onSession={(session) => {
          const meta = {role: session.role ?? "admin", actor: session.actor ?? "Admin"};
          sessionStorage.setItem(TOKEN_KEY, session.token);
          sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
          setSessionMeta(meta);
          setToken(session.token);
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
          <BrandLogo className="admin-logo" fallback={<span className="admin-mark">GS</span>} />
          <span>
            <b>Espace de gestion</b>
            <small>Global Shop Daloa · heures d’Abidjan</small>
          </span>
        </div>
        <nav className="admin-tabs">
          <button className={tab === "realtime" ? "active" : ""} onClick={() => setTab("realtime")}>
            <Activity size={15} /> En direct
          </button>
          <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>
            <Package size={15} /> Commandes
          </button>
          <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>
            <ImageUp size={15} /> Produits & Stock
          </button>
          {sessionMeta.role === "admin" && (
            <button className={tab === "agents" ? "active" : ""} onClick={() => setTab("agents")}>
              <Users size={15} /> Agents & Codes
            </button>
          )}
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
              sessionStorage.removeItem(SESSION_META_KEY);
              setToken("");
            }}
          >
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </header>
      <main className="admin-main">
        <RealtimePulseBar
          realtime={realtime}
          session={sessionMeta}
          onOpenRealtime={() => setTab("realtime")}
          onOpenOrders={() => setTab("orders")}
          onOpenProducts={() => setTab("products")}
        />
        {whatsappNumber === "" && tab !== "sales" && (
          <p className="admin-warning">
            <AlertTriangle size={15} /> <code>WHATSAPP_NUMBER</code> n’est pas configuré : les liens
            wa.me restent indisponibles. Aucun message n’est jamais envoyé automatiquement par le
            site.
          </p>
        )}
        {tab === "realtime" && (
          <RealtimePanel
            token={token}
            notify={notify}
            expired={expired}
            onNavigate={(nextTab) => setTab(nextTab)}
          />
        )}
        {tab === "orders" && (
          <OrdersBoard
            token={token}
            whatsappNumber={whatsappNumber}
            notify={notify}
            expired={expired}
            onChanged={refreshHeaderData}
          />
        )}
        {tab === "products" && (
          <ProductsPanel
            token={token}
            session={sessionMeta}
            notify={notify}
            expired={expired}
            onChanged={refreshHeaderData}
          />
        )}
        {tab === "agents" && sessionMeta.role === "admin" && (
          <AgentsPanel
            token={token}
            notify={notify}
            expired={expired}
            onChanged={refreshHeaderData}
          />
        )}
        {tab === "sales" && <SalesPanel token={token} notify={notify} expired={expired} />}
      </main>
      <div className="admin-toast" role="status" aria-live="polite">
        {notice && <span className={notice.kind}>{notice.message}</span>}
      </div>
    </div>
  );
}
