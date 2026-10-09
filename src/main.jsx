import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  ShoppingBag,
  Search,
  X,
  Plus,
  Minus,
  Heart,
  Star,
  Truck,
  ShieldCheck,
  MapPin,
  ChevronDown,
  Check,
  Menu,
  SlidersHorizontal,
  Package,
  Headphones,
  Leaf,
  CreditCard,
  CheckCircle2,
  Instagram,
  Facebook,
  Sparkles,
} from "lucide-react";
import { shippingFee } from "../shared/products.js";
import { BRAND_LOGO_ALT, BRAND_LOGO_PATH } from "./brand.js";
import "./styles.css";
const money = (n) => new Intl.NumberFormat("fr-CI").format(n) + " FCFA";
const categories = ["Tout voir", "Mode", "High-tech", "Maison", "Beauté"];
const imageFallback = "/images/products/produit-indisponible.svg";
function Photo({ src, alt, ...props }) {
  return (
    <img
      src={src || imageFallback}
      alt={alt}
      loading="lazy"
      onError={(e) => {
        const image = e.currentTarget;
        if (image.src.endsWith(imageFallback)) return;
        image.onerror = null;
        image.src = imageFallback;
      }}
      {...props}
    />
  );
}
function BrandLogo() {
  const [unavailable, setUnavailable] = useState(false);
  if (unavailable) {
    return (
      <span className="brand-symbol" aria-hidden="true">
        g<span>•</span>
      </span>
    );
  }
  return (
    <img
      className="brand-logo"
      src={BRAND_LOGO_PATH}
      alt={BRAND_LOGO_ALT}
      onError={() => setUnavailable(true)}
    />
  );
}
function Rating({ value, count }) {
  return (
    <span className="rating">
      <Star size={12} fill="currentColor" /> <b>{value.toFixed(1)}</b>
      {count !== undefined && <span>({count} avis)</span>}
    </span>
  );
}
function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem("gs-cart-v1") || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (i) =>
              typeof i.id === "string" &&
              Number.isInteger(i.quantity) &&
              i.quantity > 0,
          )
          .map((i) => ({ ...i, quantity: Math.min(i.quantity, 10) }))
      : [];
  } catch {
    return [];
  }
}
function App() {
  const [products, setProducts] = useState([]),
    [loadError, setLoadError] = useState(false),
    [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("Tout voir"),
    [sort, setSort] = useState("featured"),
    [search, setSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [saleOnly, setSaleOnly] = useState(false);
  const [cart, setCart] = useState(readCart),
    [cartOpen, setCartOpen] = useState(false),
    [selected, setSelected] = useState(null),
    [gallery, setGallery] = useState(0),
    [quantity, setQuantity] = useState(1),
    [lightbox, setLightbox] = useState(null);
  const [favorites, setFavorites] = useState(() => {
      try {
        const v = JSON.parse(localStorage.getItem("gs-favorites") || "[]");
        return Array.isArray(v) ? v.filter((i) => typeof i === "string") : [];
      } catch {
        return [];
      }
    }),
    [favoriteOnly, setFavoriteOnly] = useState(false);
  const [toast, setToast] = useState(""),
    [info, setInfo] = useState(null),
    [checkout, setCheckout] = useState(false),
    [step, setStep] = useState(1),
    [submitting, setSubmitting] = useState(false),
    [orderError, setOrderError] = useState(""),
    [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
      name: "",
      phone: "",
      city: "Daloa",
      address: "",
      note: "",
    }),
    [consent, setConsent] = useState(false);
  const requestId = useRef(null),
    lastFocus = useRef(null),
    overlayRef = useRef(null),
    lightboxTrigger = useRef(null),
    lightboxRef = useRef(null),
    submittingRef = useRef(false),
    touchStart = useRef(null);
  lightboxRef.current = lightbox;
  submittingRef.current = submitting;
  async function loadProducts() {
    setLoading(true);
    setLoadError(false);
    try {
      const r = await fetch("/api/products");
      if (!r.ok) throw Error();
      setProducts(await r.json());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadProducts();
  }, []);
  useEffect(() => {
    const favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) return;
    const logoProbe = new Image();
    logoProbe.onload = () => {
      favicon.href = BRAND_LOGO_PATH;
      favicon.type = BRAND_LOGO_PATH.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/svg+xml";
    };
    logoProbe.onerror = () => {
      favicon.href = "/favicon.svg";
      favicon.type = "image/svg+xml";
    };
    logoProbe.src = BRAND_LOGO_PATH;
    return () => {
      logoProbe.onload = null;
      logoProbe.onerror = null;
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("gs-cart-v1", JSON.stringify(cart));
    } catch {}
  }, [cart]);
  useEffect(() => {
    try {
      localStorage.setItem("gs-favorites", JSON.stringify(favorites));
    } catch {}
  }, [favorites]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);
  const modalOpen = !!(cartOpen || selected || checkout || info || lightbox);
  const lightboxOpen = Boolean(lightbox);
  useEffect(() => {
    if (lightboxOpen) {
      const timer = setTimeout(
        () => overlayRef.current?.querySelector(".lightbox-close")?.focus(),
        0,
      );
      return () => clearTimeout(timer);
    }
    const trigger = lightboxTrigger.current;
    if (!trigger?.isConnected) {
      lightboxTrigger.current = null;
      return;
    }
    const timer = setTimeout(() => {
      trigger.focus();
      lightboxTrigger.current = null;
    }, 0);
    return () => clearTimeout(timer);
  }, [lightboxOpen]);
  useEffect(() => {
    if (!modalOpen) return;
    lastFocus.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const initialFocus = setTimeout(
      () =>
        overlayRef.current
          ?.querySelector(
            "button:not([disabled]), input:not([disabled]), select",
          )
          ?.focus(),
      30,
    );
    const keyboard = (e) => {
      const activeLightbox = lightboxRef.current;
      if (e.key === "Escape" && !submittingRef.current) {
        e.preventDefault();
        if (activeLightbox) {
          setLightbox(null);
        } else {
          setCartOpen(false);
          setSelected(null);
          setCheckout(false);
          setInfo(null);
        }
      }
      if (activeLightbox && e.key === "ArrowLeft") {
        e.preventDefault();
        setLightbox((current) =>
          current
            ? {
                ...current,
                index:
                  (current.index - 1 + current.images.length) %
                  current.images.length,
              }
            : current,
        );
      }
      if (activeLightbox && e.key === "ArrowRight") {
        e.preventDefault();
        setLightbox((current) =>
          current
            ? { ...current, index: (current.index + 1) % current.images.length }
            : current,
        );
      }
      if (e.key === "Tab") {
        const dialog = overlayRef.current;
        const nodes = dialog?.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (!nodes?.length) {
          e.preventDefault();
          dialog?.focus();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const focusOutside = !dialog?.contains(document.activeElement);
        if ((e.shiftKey && document.activeElement === first) || focusOutside) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      clearTimeout(initialFocus);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keyboard);
      if (lastFocus.current?.isConnected) lastFocus.current.focus();
    };
  }, [modalOpen]);
  const cartItems = cart
    .map((i) => {
      const p = products.find((p) => p.id === i.id);
      return p ? { ...p, quantity: i.quantity } : null;
    })
    .filter(Boolean);
  const cartCount = cart.reduce((n, i) => n + i.quantity, 0),
    subtotal = cartItems.reduce((n, p) => n + p.price * p.quantity, 0),
    delivery = shippingFee(subtotal);
  const filtered = useMemo(() => {
    let list = products.filter(
      (p) =>
        (category === "Tout voir" || p.category === category) &&
        (!saleOnly || p.oldPrice) &&
        (!favoriteOnly || favorites.includes(p.id)) &&
        `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()),
    );
    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
    if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    if (sort === "new")
      list.sort((a, b) => (b.badge === "NOUVEAU") - (a.badge === "NOUVEAU"));
    return list;
  }, [products, category, saleOnly, favoriteOnly, favorites, search, sort]);
  function browse(cat = "Tout voir", sale = false) {
    setCategory(cat);
    setSaleOnly(sale);
    setFavoriteOnly(false);
    setMobileNav(false);
    document
      .getElementById("catalogue")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  function add(p, n = 1) {
    const current = cart.find((i) => i.id === p.id)?.quantity || 0;
    if (current + n > Math.min(10, p.stock)) {
      setToast("La quantité disponible a été atteinte.");
      return;
    }
    setCart((c) => {
      const item = c.find((i) => i.id === p.id);
      return item
        ? c.map((i) => (i.id === p.id ? { ...i, quantity: i.quantity + n } : i))
        : [...c, { id: p.id, quantity: n }];
    });
    setToast(`${p.name} ajouté au panier`);
  }
  function update(id, delta) {
    setCart((c) =>
      c.flatMap((i) => {
        if (i.id !== id) return [i];
        const n = i.quantity + delta;
        return n <= 0
          ? []
          : [
              {
                ...i,
                quantity: Math.min(
                  n,
                  10,
                  products.find((p) => p.id === id)?.stock ?? 10,
                ),
              },
            ];
      }),
    );
  }
  function favorite(id) {
    setFavorites((f) =>
      f.includes(id) ? f.filter((x) => x !== id) : [...f, id],
    );
  }
  function openProduct(p) {
    setSelected(p);
    setGallery(0);
    setQuantity(1);
  }
  function openLightbox(images, index, title, trigger) {
    const validImages = images.filter(Boolean);
    if (!validImages.length) return;
    lightboxTrigger.current = trigger || document.activeElement;
    setLightbox({
      images: validImages,
      index: Math.min(Math.max(index, 0), validImages.length - 1),
      title,
    });
  }
  function moveLightbox(direction) {
    setLightbox((current) =>
      current
        ? {
            ...current,
            index:
              (current.index + direction + current.images.length) %
              current.images.length,
          }
        : current,
    );
  }
  function handleLightboxTouchStart(event) {
    const touch = event.changedTouches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }
  function handleLightboxTouchEnd(event) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
      return;
    }
    moveLightbox(deltaX < 0 ? 1 : -1);
  }
  function beginCheckout() {
    setCartOpen(false);
    setCheckout(true);
    setStep(1);
    setSuccess(null);
    setOrderError("");
    setConsent(false);
    requestId.current = crypto.randomUUID();
  }
  async function submitOrder() {
    setSubmitting(true);
    setOrderError("");
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { ...form, phone: form.phone.replace(/[\s.-]/g, "") },
          items: cart.map((i) => ({ id: i.id, quantity: i.quantity })),
          payment: "cash",
          requestId: requestId.current,
        }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || "Commande indisponible.");
      setSuccess(result);
      setCart([]);
      loadProducts();
    } catch (e) {
      setOrderError(e.message);
    } finally {
      setSubmitting(false);
    }
  }
  const closeOverlay = () => {
    if (submitting) return;
    setCartOpen(false);
    setSelected(null);
    setCheckout(false);
    setInfo(null);
  };
  return (
    <>
      <div className="announcement">
        <span>Le meilleur du quotidien, à deux pas de chez vous.</span>
        <span>
          <Truck size={13} /> Livraison à Daloa & Bouaké{" "}
          <span className="announcement-separator">·</span> Offerte dès 50 000
          FCFA <ArrowUpRight size={13} />
        </span>
      </div>
      <header>
        <div className="header-main wrap">
          <a href="#" className="brand" aria-label="Global Shop Daloa, accueil">
            <BrandLogo />
            <span>
              global shop<span className="brand-sub">D A L O A</span>
            </span>
          </a>
          <nav aria-label="Navigation principale">
            <button
              className={!saleOnly ? "nav-current" : ""}
              onClick={() => browse()}
            >
              La boutique
            </button>
            <button
              onClick={() =>
                document
                  .getElementById("collections")
                  .scrollIntoView({ behavior: "smooth" })
              }
            >
              Nos collections
            </button>
            <button onClick={() => browse("Tout voir", true)}>
              Les bonnes affaires <span className="tiny-dot" />
            </button>
            <button
              onClick={() =>
                document
                  .getElementById("about")
                  .scrollIntoView({ behavior: "smooth" })
              }
            >
              Notre univers
            </button>
          </nav>
          <div className="header-actions">
            <button
              aria-label="Rechercher un produit"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search size={21} />
            </button>
            <button
              className={favoriteOnly ? "active" : ""}
              aria-label="Voir mes favoris"
              onClick={() => {
                setFavoriteOnly(!favoriteOnly);
                setCategory("Tout voir");
                setSaleOnly(false);
                document
                  .getElementById("catalogue")
                  .scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Heart size={21} />
              {favorites.length > 0 && <i className="favorite-dot" />}
            </button>
            <button
              className="bag-button"
              aria-label={`Ouvrir le panier, ${cartCount} articles`}
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag size={20} />
              <span>Panier</span>
              <b>{cartCount}</b>
            </button>
            <button
              className="mobile-menu"
              aria-label="Ouvrir le menu"
              onClick={() => setMobileNav(!mobileNav)}
            >
              {mobileNav ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {mobileNav && (
          <div className="mobile-navigation">
            <button onClick={() => browse()}>La boutique</button>
            <button
              onClick={() => {
                setMobileNav(false);
                document
                  .getElementById("collections")
                  .scrollIntoView({ behavior: "smooth" });
              }}
            >
              Nos collections
            </button>
            <button onClick={() => browse("Tout voir", true)}>
              Les bonnes affaires
            </button>
          </div>
        )}
        {searchOpen && (
          <div className="search-bar wrap">
            <Search size={20} />
            <input
              autoFocus
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                document
                  .getElementById("catalogue")
                  .scrollIntoView({ behavior: "smooth" });
              }}
              placeholder="Un sac, un casque, une envie…"
              aria-label="Rechercher dans le catalogue"
            />
            <button
              onClick={() => {
                setSearch("");
                setSearchOpen(false);
              }}
              aria-label="Fermer la recherche"
            >
              <X size={20} />
            </button>
          </div>
        )}
      </header>
      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-dot" /> VOTRE NOUVELLE ADRESSE PRÉFÉRÉE
            </span>
            <h1>
              Le quotidien,
              <br />
              en <em>mieux.</em>
            </h1>
            <p>
              De belles trouvailles. Des prix qui font sourire.
              <br />
              Tout ce que vous aimez, livré près de chez vous.
            </p>
            <button className="button dark" onClick={() => browse()}>
              Explorer la boutique <ArrowUpRight size={19} />
            </button>
            <div className="hero-social">
              <div className="avatar-stack" aria-hidden="true">
                <span>D</span>
                <span>B</span>
                <span>GS</span>
              </div>
              <div>
                <small>Une sélection pensée tout près de vous</small>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <img
              src="/images/hero.png"
              alt="Sélection de sacs, casque et essentiels dans une ambiance chaleureuse"
              fetchPriority="high"
            />
            <div className="hero-stamp">
              <Sparkles size={21} />
              <span>
                Bien choisi.
                <br />
                <b>Bien chez vous.</b>
              </span>
            </div>
            <div className="hero-image-footer">
              <span>LA SÉLECTION GLOBAL SHOP</span>
              <span>01 — 04</span>
            </div>
          </div>
          <span className="hero-bottom-note">
            À DALOA, À BOUAKÉ, ET DANS VOTRE QUOTIDIEN.
          </span>
        </section>
        <section className="benefits wrap" aria-label="Nos engagements">
          <div>
            <Truck />
            <span>
              <b>Tout près de vous</b>
              <small>Livraison à Daloa et Bouaké</small>
            </span>
          </div>
          <div>
            <ShieldCheck />
            <span>
              <b>Achetez l’esprit tranquille</b>
              <small>Paiement à la livraison</small>
            </span>
          </div>
          <div>
            <Package />
            <span>
              <b>Des trouvailles bien choisies</b>
              <small>Une sélection pour chaque envie</small>
            </span>
          </div>
          <div>
            <Headphones />
            <span>
              <b>On est là pour vous</b>
              <small>Une équipe à votre écoute</small>
            </span>
          </div>
        </section>
        <section className="collections wrap" id="collections">
          <div className="section-heading">
            <div>
              <span className="eyebrow">UN MONDE DE POSSIBILITÉS</span>
              <h2>À chaque envie, sa collection.</h2>
            </div>
            <button className="text-button" onClick={() => browse()}>
              Tout explorer <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="collection-grid">
            {[
              {
                cat: "Mode",
                caption: "Votre style, tout simplement.",
                image: "/images/products/sac.jpg",
                className: "fashion",
              },
              {
                cat: "High-tech",
                caption: "Connecté à ce qui compte.",
                image: "/images/products/casque.jpg",
                className: "tech",
              },
              {
                cat: "Maison",
                caption: "Un peu plus chez vous.",
                image: "/images/products/lampe.jpg",
                className: "home",
              },
              {
                cat: "Beauté",
                caption: "Du temps pour vous.",
                image: "/images/products/serum.jpg",
                className: "beauty",
              },
            ].map((c) => (
              <button
                key={c.cat}
                className={`collection-card ${c.className}`}
                onClick={() => browse(c.cat)}
              >
                <Photo src={c.image} alt={`Collection ${c.cat}`} />
                <div className="collection-copy">
                  <span>{c.cat}</span>
                  <small>{c.caption}</small>
                </div>
                <span className="circle-arrow">
                  <ArrowUpRight size={19} />
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="catalogue wrap" id="catalogue">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                SÉLECTIONNÉS AVEC SOIN, AIMÉS AU QUOTIDIEN
              </span>
              <h2>
                {favoriteOnly
                  ? "Vos coups de cœur."
                  : saleOnly
                    ? "Les petits prix, les grandes envies."
                    : "Vos prochains coups de cœur."}
              </h2>
            </div>
            <span className="selection-note">
              <span className="tiny-dot" /> Prix repères · stocks provisoires
            </span>
          </div>
          <div className="catalogue-toolbar">
            <div
              className="tabs"
              role="group"
              aria-label="Filtrer par catégorie"
            >
              {categories.map((c) => (
                <button
                  key={c}
                  className={category === c ? "selected" : ""}
                  onClick={() => setCategory(c)}
                >
                  {c}
                  {c === "Tout voir" && <span>{products.length}</span>}
                </button>
              ))}
            </div>
            <div className="sort">
              <SlidersHorizontal size={15} />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Trier les produits"
              >
                <option value="featured">Nos recommandations</option>
                <option value="price-asc">Prix : croissant</option>
                <option value="price-desc">Prix : décroissant</option>
                <option value="rating">Les mieux notés</option>
                <option value="new">Les nouveautés</option>
              </select>
              <ChevronDown size={13} />
            </div>
          </div>
          {(search || saleOnly || favoriteOnly) && (
            <div className="active-filters">
              <span>
                {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
                {search && ` pour « ${search} »`}
              </span>
              {saleOnly && (
                <button onClick={() => setSaleOnly(false)}>
                  En promotion <X size={12} />
                </button>
              )}
              {favoriteOnly && (
                <button onClick={() => setFavoriteOnly(false)}>
                  Mes favoris <X size={12} />
                </button>
              )}
              {search && (
                <button onClick={() => setSearch("")}>
                  Effacer la recherche <X size={12} />
                </button>
              )}
            </div>
          )}
          {loading ? (
            <div className="product-grid">
              {[1, 2, 3, 4].map((n) => (
                <div className="skeleton" key={n} />
              ))}
            </div>
          ) : loadError ? (
            <div className="empty-state">
              <Package size={34} />
              <h3>Le catalogue se fait attendre.</h3>
              <p>Vérifiez votre connexion, puis réessayez.</p>
              <button className="button dark" onClick={loadProducts}>
                Réessayer
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Search size={32} />
              <h3>Aucune trouvaille pour le moment.</h3>
              <p>
                {favoriteOnly
                  ? "Touchez le cœur d’un produit pour le retrouver ici."
                  : "Essayez une autre recherche ou une autre collection."}
              </p>
              <button
                className="button dark"
                onClick={() => {
                  setSearch("");
                  browse();
                }}
              >
                Voir toute la sélection
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {filtered.map((p) => (
                <article className="product-card" key={p.id}>
                  <div className="product-picture">
                    <button
                      className="product-image-button"
                      onClick={(event) =>
                        openLightbox(
                          [p.image, p.extra],
                          0,
                          p.name,
                          event.currentTarget,
                        )
                      }
                      aria-label={`Agrandir les images de ${p.name}`}
                    >
                      <Photo src={p.image} alt={`${p.name} — vue principale`} />
                    </button>
                    {p.badge && (
                      <span
                        className={`product-badge ${p.badge.includes("%") ? "sale" : p.badge === "NOUVEAU" ? "new" : ""}`}
                      >
                        {p.badge}
                      </span>
                    )}
                    <button
                      className={`favorite-button ${favorites.includes(p.id) ? "is-favorite" : ""}`}
                      aria-label={`${favorites.includes(p.id) ? "Retirer des" : "Ajouter aux"} favoris : ${p.name}`}
                      onClick={() => favorite(p.id)}
                    >
                      <Heart
                        size={17}
                        fill={
                          favorites.includes(p.id) ? "currentColor" : "none"
                        }
                      />
                    </button>
                    <button
                      className="quick-add"
                      onClick={() => add(p)}
                      disabled={!p.stock}
                      aria-label={`Ajouter ${p.name} au panier`}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="product-meta">
                    <span>{p.category}</span>
                    <Rating value={p.rating} count={p.reviews} />
                  </div>
                  <button
                    className="product-name"
                    onClick={() => openProduct(p)}
                  >
                    {p.name}
                  </button>
                  <div className="product-price">
                    <b>{money(p.price)}</b>
                    {p.oldPrice && <del>{money(p.oldPrice)}</del>}
                  </div>
                  <small className={`product-stock ${p.stock ? "" : "out-of-stock"}`}>
                    {p.stock
                      ? `${p.stock} disponible${p.stock === 1 ? "" : "s"}`
                      : "Épuisé"}
                  </small>
                </article>
              ))}
            </div>
          )}
          <div className="catalogue-bottom">
            <span>De petites envies. De grandes découvertes.</span>
            <button
              className="text-button"
              onClick={() => {
                setInfo("selection");
              }}
            >
              Une sélection qui vous ressemble <ArrowUpRight size={17} />
            </button>
          </div>
        </section>
        <section className="story wrap" id="about">
          <div className="story-image">
            <Photo
              src="/images/hero.png"
              alt="Sélection Global Shop mise en scène dans un intérieur chaleureux"
            />
            <span className="story-label">
              <Leaf size={16} /> LES BELLES CHOSES SONT TOUT PRÈS.
            </span>
          </div>
          <div className="story-copy">
            <span className="eyebrow">PLUS QU’UNE BOUTIQUE, UN LIEN.</span>
            <h2>
              D’ici.
              <br />
              Pour <em>vous.</em>
            </h2>
            <p>
              Nous croyons que les belles choses devraient être accessibles à
              tous. Global Shop réunit les essentiels qui embellissent votre
              quotidien, sans compliquer votre budget.
            </p>
            <p>
              Ancrés à Daloa et à Bouaké, nous mettons la proximité, le soin et
              la simplicité au cœur de chaque commande.
            </p>
            <button className="text-button" onClick={() => setInfo("about")}>
              Bienvenue dans notre univers <ArrowUpRight size={18} />
            </button>
            <div className="city-tags">
              <span>
                <MapPin size={13} /> Daloa
              </span>
              <span>
                <MapPin size={13} /> Bouaké
              </span>
              <span>100 % proche de vous</span>
            </div>
          </div>
        </section>
        <section className="testimonials wrap">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LE BONHEUR SE PARTAGE</span>
              <h2>De belles trouvailles, de beaux sourires.</h2>
            </div>
            <span className="demo-label">Avis illustratifs</span>
          </div>
          <div className="reviews-grid">
            {[
              {
                name: "Aminata K.",
                city: "Daloa",
                text: "Le sac est encore plus beau en vrai ! Une commande simple et une livraison soignée. Je reviendrai sans hésiter.",
                product: "Sac porté épaule Élise",
              },
              {
                name: "Kouamé J.",
                city: "Bouaké",
                text: "Enfin une boutique qui livre aussi à Bouaké. Le casque est top, et payer à la livraison, c’est rassurant.",
                product: "Casque sans fil Studio",
              },
              {
                name: "Mariame D.",
                city: "Daloa",
                text: "J’ai trouvé de jolies choses pour la maison à des prix accessibles. Une belle découverte tout près de chez nous.",
                product: "Collection Maison",
              },
            ].map((r) => (
              <article key={r.name}>
                <div className="five-stars">★★★★★</div>
                <p>« {r.text} »</p>
                <div className="review-author">
                  <span className="initial-avatar">{r.name[0]}</span>
                  <span>
                    <b>{r.name}</b>
                    <small>
                      {r.city} · {r.product}
                    </small>
                  </span>
                  <CheckCircle2 size={16} />
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="newsletter wrap">
          <div className="newsletter-icon">
            <ShoppingBag size={29} />
            <Sparkles size={17} />
          </div>
          <div>
            <span className="eyebrow">
              NE MANQUEZ PAS VOTRE PROCHAIN COUP DE CŒUR
            </span>
            <h2>Les bonnes choses se découvrent ici.</h2>
            <p>
              Explorez les nouveautés et les petits prix de notre sélection.
            </p>
          </div>
          <button
            className="button dark"
            onClick={() => {
              setSort("new");
              browse();
            }}
          >
            Voir les nouveautés <ArrowUpRight size={18} />
          </button>
        </section>
      </main>
      <footer>
        <div className="footer-main wrap">
          <div className="footer-brand">
            <a
              href="#"
              className="brand"
              aria-label="Global Shop Daloa, accueil"
            >
              <BrandLogo />
              <span>
                global shop<span className="brand-sub">D A L O A</span>
              </span>
            </a>
            <p>
              Tout ce que vous aimez.
              <br />
              Tout près de chez vous.
            </p>
            <div className="socials">
              <button
                aria-label="Informations Facebook"
                onClick={() => setInfo("social")}
              >
                <Facebook size={17} />
              </button>
              <button
                aria-label="Informations Instagram"
                onClick={() => setInfo("social")}
              >
                <Instagram size={17} />
              </button>
            </div>
          </div>
          <div className="footer-column">
            <h4>La boutique</h4>
            {categories.slice(1).map((c) => (
              <button key={c} onClick={() => browse(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="footer-column">
            <h4>À votre service</h4>
            <button onClick={() => setInfo("delivery")}>
              Livraison & retours
            </button>
            <button onClick={() => setInfo("payment")}>
              Modes de paiement
            </button>
            <button onClick={() => setInfo("contact")}>Nous contacter</button>
            <button onClick={() => setInfo("faq")}>Questions fréquentes</button>
          </div>
          <div className="footer-location">
            <h4>Près de chez vous</h4>
            <span>
              <MapPin size={16} /> Daloa & Bouaké, Côte d’Ivoire
            </span>
            <p>Votre quotidien mérite de belles choses.</p>
            <span className="payment-tag">
              <ShieldCheck size={16} /> Paiement à la livraison
            </span>
          </div>
        </div>
        <div className="footer-bottom wrap">
          <span>
            © {new Date().getFullYear()} Global Shop Daloa. Tous droits
            réservés.
          </span>
          <div>
            <button onClick={() => setInfo("legal")}>Mentions légales</button>
            <button onClick={() => setInfo("privacy")}>Confidentialité</button>
            <span>
              Fait avec soin, en Côte d’Ivoire <span className="flag">▮▮▮</span>
            </span>
          </div>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button
            onClick={() => {
              setToast("");
              setSelected(null);
              setCartOpen(true);
            }}
          >
            Voir le panier <ArrowRight size={14} />
          </button>
        </div>
      )}
      {modalOpen && (
        <div
          className={`overlay ${lightbox ? "lightbox-overlay" : cartOpen ? "drawer-overlay" : ""}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              if (lightbox) setLightbox(null);
              else closeOverlay();
            }
          }}
        >
          <div
            ref={overlayRef}
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby={lightbox ? "lightbox-title" : "dialog-title"}
            className={
              lightbox
                ? "lightbox-modal"
                : cartOpen
                  ? "cart-drawer"
                  : selected
                    ? "product-modal"
                    : checkout
                      ? "checkout-modal"
                      : "info-modal"
            }
          >
            {lightbox ? (
              <div
                className="lightbox-viewer"
                onTouchStart={handleLightboxTouchStart}
                onTouchEnd={handleLightboxTouchEnd}
                onMouseDown={(e) => {
                  const target = e.target;
                  const onBackdrop =
                    target === e.currentTarget ||
                    target.classList.contains("lightbox-stage") ||
                    target.classList.contains("lightbox-figure") ||
                    target.classList.contains("lightbox-artwork");
                  if (onBackdrop) setLightbox(null);
                }}
              >
                <h2 id="lightbox-title" className="sr-only">
                  Visionneuse d’images : {lightbox.title}
                </h2>
                <div className="lightbox-toolbar">
                  <span className="lightbox-kicker">GALERIE PRODUIT</span>
                  <button
                    type="button"
                    className="close-button lightbox-close"
                    onClick={() => setLightbox(null)}
                    aria-label="Fermer la visionneuse"
                  >
                    <X />
                  </button>
                </div>
                <div className="lightbox-stage">
                  {lightbox.images.length > 1 && (
                    <button
                      type="button"
                      className="lightbox-navigation previous"
                      onClick={() => moveLightbox(-1)}
                      aria-label="Image précédente"
                    >
                      <ArrowLeft size={22} />
                    </button>
                  )}
                  <figure className="lightbox-figure">
                    <div className="lightbox-artwork">
                      <Photo
                        src={lightbox.images[lightbox.index]}
                        alt={`${lightbox.title} — vue ${lightbox.index + 1}`}
                        loading="eager"
                        draggable={false}
                      />
                    </div>
                    <figcaption>
                      <span>{lightbox.title}</span>
                      <small role="status" aria-live="polite">
                        Vue {lightbox.index + 1} sur {lightbox.images.length}
                      </small>
                    </figcaption>
                  </figure>
                  {lightbox.images.length > 1 && (
                    <button
                      type="button"
                      className="lightbox-navigation next"
                      onClick={() => moveLightbox(1)}
                      aria-label="Image suivante"
                    >
                      <ArrowRight size={22} />
                    </button>
                  )}
                </div>
                <div className="lightbox-footer">
                  <span>
                    Balayez ou utilisez les flèches du clavier pour naviguer.
                  </span>
                  <div
                    className="lightbox-indicators"
                    role="group"
                    aria-label="Choisir une image"
                  >
                    {lightbox.images.map((image, index) => (
                      <button
                        type="button"
                        key={`${image}-${index}`}
                        className={index === lightbox.index ? "current" : ""}
                        aria-label={`Afficher la vue ${index + 1}`}
                        aria-current={
                          index === lightbox.index ? "true" : undefined
                        }
                        onClick={() =>
                          setLightbox((current) =>
                            current ? { ...current, index } : current,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {cartOpen && (
                  <>
                    <div className="drawer-header">
                      <div>
                        <span className="eyebrow">VOS BELLES TROUVAILLES</span>
                        <h2 id="dialog-title">
                          Votre panier <span>({cartCount})</span>
                        </h2>
                      </div>
                      <button
                        className="close-button"
                        onClick={closeOverlay}
                        aria-label="Fermer le panier"
                      >
                        <X />
                      </button>
                    </div>
                    {cartItems.length > 0 ? (
                      <>
                        <div className="shipping-progress">
                          <Truck size={18} />
                          <span>
                            {subtotal >= 50000 ? (
                              "Bonne nouvelle : votre livraison est offerte !"
                            ) : (
                              <>
                                Encore <b>{money(50000 - subtotal)}</b> pour la
                                livraison offerte.
                              </>
                            )}
                          </span>
                          <div>
                            <i
                              style={{
                                width: `${Math.min(100, subtotal / 500)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="cart-lines">
                          {cartItems.map((p) => (
                            <div className="cart-line" key={p.id}>
                              <Photo src={p.image} alt={p.name} />
                              <div>
                                <small>{p.category}</small>
                                <b>{p.name}</b>
                                <span>{money(p.price)}</span>
                                <div className="quantity-controls">
                                  <button
                                    onClick={() => update(p.id, -1)}
                                    aria-label={`Diminuer la quantité de ${p.name}`}
                                  >
                                    <Minus size={13} />
                                  </button>
                                  <span>{p.quantity}</span>
                                  <button
                                    disabled={
                                      p.quantity >= Math.min(10, p.stock)
                                    }
                                    onClick={() => update(p.id, 1)}
                                    aria-label={`Augmenter la quantité de ${p.name}`}
                                  >
                                    <Plus size={13} />
                                  </button>
                                </div>
                              </div>
                              <button
                                className="remove-item"
                                onClick={() =>
                                  setCart((c) => c.filter((i) => i.id !== p.id))
                                }
                                aria-label={`Retirer ${p.name}`}
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="cart-summary">
                          <div>
                            <span>Sous-total</span>
                            <b>{money(subtotal)}</b>
                          </div>
                          <div>
                            <span>Livraison</span>
                            <span>
                              {delivery === 0 ? "Offerte" : money(delivery)}
                            </span>
                          </div>
                          <div className="total">
                            <span>Total</span>
                            <b>{money(subtotal + delivery)}</b>
                          </div>
                          <button
                            className="button dark full"
                            onClick={beginCheckout}
                          >
                            Passer ma commande <ArrowRight size={18} />
                          </button>
                          <p>
                            <ShieldCheck size={14} /> Paiement à la livraison ·
                            Sans compte
                          </p>
                          <button
                            className="continue-button"
                            onClick={closeOverlay}
                          >
                            Continuer mes découvertes
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="empty-state">
                        <ShoppingBag size={48} />
                        <h3>Le début de belles découvertes.</h3>
                        <p>
                          Votre panier est encore vide. Trouvons votre prochain
                          coup de cœur.
                        </p>
                        <button
                          className="button dark"
                          onClick={() => {
                            closeOverlay();
                            browse();
                          }}
                        >
                          Explorer la boutique <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </>
                )}
                {selected && (
                  <>
                    <button
                      className="close-button modal-close"
                      onClick={closeOverlay}
                      aria-label="Fermer la fiche produit"
                    >
                      <X />
                    </button>
                    <div className="detail-gallery">
                      <button
                        type="button"
                        className="detail-main-image-button"
                        onClick={(event) =>
                          openLightbox(
                            [selected.image, selected.extra],
                            gallery,
                            selected.name,
                            event.currentTarget,
                          )
                        }
                        aria-label={`Agrandir l’image ${gallery + 1} de ${selected.name}`}
                      >
                        <Photo
                          className="detail-main-image"
                          src={gallery === 0 ? selected.image : selected.extra}
                          alt={`${selected.name}, vue ${gallery + 1}`}
                        />
                        <span className="detail-image-hint">
                          <Search size={15} /> Agrandir
                        </span>
                      </button>
                      <div className="thumbnails">
                        {[selected.image, selected.extra].map((im, i) => (
                          <button
                            type="button"
                            key={im}
                            onClick={(event) => {
                              setGallery(i);
                              openLightbox(
                                [selected.image, selected.extra],
                                i,
                                selected.name,
                                event.currentTarget,
                              );
                            }}
                            className={gallery === i ? "selected" : ""}
                            aria-label={`Agrandir la vue ${i + 1} de ${selected.name}`}
                          >
                            <Photo
                              src={im}
                              alt={`Vue ${i + 1} de ${selected.name}`}
                            />
                          </button>
                        ))}
                      </div>
                      <small>
                        Photos de référence non contractuelles · modèle exact à confirmer.
                      </small>
                    </div>
                    <div className="detail-info">
                      <span className="eyebrow">
                        {selected.category} / LA SÉLECTION GLOBAL SHOP
                      </span>
                      <h2 id="dialog-title">{selected.name}</h2>
                      <Rating
                        value={selected.rating}
                        count={selected.reviews}
                      />
                      <div className="detail-price">
                        <b>{money(selected.price)}</b>
                        {selected.oldPrice && (
                          <del>{money(selected.oldPrice)}</del>
                        )}
                      </div>
                      <p>{selected.description}</p>
                      <div className="product-option">
                        <span>
                          Finition / format : <b>{selected.color}</b>
                        </span>
                        <span className="stock-status">
                          <span className="tiny-dot" />
                          {selected.stock
                            ? `${selected.stock} disponible${selected.stock === 1 ? "" : "s"}`
                            : "Épuisé"}
                        </span>
                      </div>
                      <ul className="specs">
                        {selected.specs.map((s) => (
                          <li key={s}>
                            <Check size={14} />
                            {s}
                          </li>
                        ))}
                      </ul>
                      <div className="detail-add">
                        <div className="quantity-controls">
                          <button
                            disabled={quantity <= 1}
                            onClick={() => setQuantity((q) => q - 1)}
                            aria-label="Diminuer la quantité"
                          >
                            <Minus size={15} />
                          </button>
                          <span>{quantity}</span>
                          <button
                            disabled={quantity >= Math.min(10, selected.stock)}
                            onClick={() => setQuantity((q) => q + 1)}
                            aria-label="Augmenter la quantité"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                        <button
                          className="button dark"
                          disabled={!selected.stock}
                          onClick={() => add(selected, quantity)}
                        >
                          <ShoppingBag size={18} /> Ajouter au panier
                        </button>
                        <button
                          className="detail-heart"
                          aria-label="Ajouter ou retirer des favoris"
                          onClick={() => favorite(selected.id)}
                        >
                          <Heart
                            size={19}
                            fill={
                              favorites.includes(selected.id)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      </div>
                      <div className="detail-delivery">
                        <Truck size={18} />
                        <span>
                          Livraison à Daloa & Bouaké
                          <br />
                          <small>1 500 FCFA · Offerte dès 50 000 FCFA</small>
                        </span>
                      </div>
                      <div className="detail-review">
                        <div>
                          <b>Ils ont aimé</b>
                          <span className="demo-label">
                            Avis de démonstration
                          </span>
                        </div>
                        <span className="five-stars">★★★★★</span>
                        <p>« {selected.review} »</p>
                        <small>Client Global Shop · Avis illustratif</small>
                      </div>
                    </div>
                  </>
                )}
                {checkout && (
                  <>
                    <div className="drawer-header">
                      <div>
                        <span className="eyebrow">
                          SIMPLE, SEREIN, TOUT PRÈS.
                        </span>
                        <h2 id="dialog-title">
                          {success
                            ? "Merci pour votre commande !"
                            : "Votre commande"}
                        </h2>
                      </div>
                      <button
                        className="close-button"
                        disabled={submitting}
                        onClick={closeOverlay}
                        aria-label="Fermer la commande"
                      >
                        <X />
                      </button>
                    </div>
                    {success ? (
                      <div className="order-success">
                        <span className="success-brand">
                          <BrandLogo />
                        </span>
                        <span className="success-icon">
                          <Check size={36} />
                        </span>
                        <h3>Vos trouvailles sont réservées.</h3>
                        <p>
                          Votre commande a été enregistrée dans notre boutique.
                          Conservez votre référence pour le suivi.
                        </p>
                        <div className="reference">{success.reference}</div>
                        <p>
                          Montant à régler à la livraison
                          <br />
                          <b>{money(success.total)}</b>
                        </p>
                        <small>
                          Livraison à {form.city}. Notre équipe devra confirmer
                          la disponibilité et le créneau de livraison par
                          téléphone.
                        </small>
                        <button
                          className="button dark full"
                          onClick={closeOverlay}
                        >
                          Continuer mes découvertes <ArrowRight size={17} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="checkout-steps">
                          <span className={step === 1 ? "current" : "done"}>
                            <b>{step > 1 ? <Check size={12} /> : 1}</b>{" "}
                            Livraison
                          </span>
                          <i />
                          <span className={step === 2 ? "current" : ""}>
                            <b>2</b> Confirmation
                          </span>
                        </div>
                        {step === 1 ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              setStep(2);
                              setOrderError("");
                            }}
                            className="checkout-form"
                          >
                            <p>Où livrer vos belles trouvailles ?</p>
                            <label>
                              Votre nom complet
                              <input
                                required
                                minLength={2}
                                maxLength={100}
                                autoComplete="name"
                                value={form.name}
                                onChange={(e) =>
                                  setForm({ ...form, name: e.target.value })
                                }
                                placeholder="Ex. Aminata Kouamé"
                              />
                            </label>
                            <label>
                              Numéro de téléphone ivoirien
                              <input
                                type="tel"
                                required
                                pattern="(\+225)?[0-9\s.-]{10,18}"
                                maxLength={22}
                                autoComplete="tel"
                                value={form.phone}
                                onChange={(e) =>
                                  setForm({ ...form, phone: e.target.value })
                                }
                                placeholder="Ex. 07 00 00 00 00"
                                onBlur={(e) =>
                                  e.currentTarget.setCustomValidity(
                                    /^(\+225)?[0-9]{10}$/.test(
                                      form.phone.replace(/[\s.-]/g, ""),
                                    )
                                      ? ""
                                      : "Saisissez 10 chiffres, avec +225 facultatif.",
                                  )
                                }
                                onInput={(e) =>
                                  e.currentTarget.setCustomValidity("")
                                }
                              />
                            </label>
                            <label>
                              Ville de livraison
                              <select
                                value={form.city}
                                onChange={(e) =>
                                  setForm({ ...form, city: e.target.value })
                                }
                              >
                                <option>Daloa</option>
                                <option>Bouaké</option>
                              </select>
                            </label>
                            <label>
                              Quartier, rue et repère
                              <input
                                required
                                minLength={8}
                                maxLength={300}
                                autoComplete="street-address"
                                value={form.address}
                                onChange={(e) =>
                                  setForm({ ...form, address: e.target.value })
                                }
                                placeholder="Ex. Quartier Commerce, près de la pharmacie"
                              />
                            </label>
                            <label>
                              Une précision pour le livreur{" "}
                              <span>(facultatif)</span>
                              <textarea
                                maxLength={500}
                                value={form.note}
                                onChange={(e) =>
                                  setForm({ ...form, note: e.target.value })
                                }
                                placeholder="Repère, disponibilité…"
                              />
                            </label>
                            <button className="button dark full" type="submit">
                              Vérifier ma commande <ArrowRight size={17} />
                            </button>
                            <small className="form-security">
                              <ShieldCheck size={13} /> Vos coordonnées sont
                              utilisées uniquement pour votre commande.
                            </small>
                          </form>
                        ) : (
                          <div className="checkout-confirm">
                            <button
                              className="text-button"
                              onClick={() => setStep(1)}
                            >
                              <ArrowLeft size={14} /> Modifier mes coordonnées
                            </button>
                            <div className="address-summary">
                              <MapPin size={20} />
                              <div>
                                <b>{form.name}</b>
                                <span>
                                  {form.address}, {form.city}
                                </span>
                                <span>{form.phone}</span>
                              </div>
                            </div>
                            <h4>Vos articles</h4>
                            {cartItems.map((p) => (
                              <div className="confirmation-line" key={p.id}>
                                <span>
                                  {p.quantity} × {p.name}
                                </span>
                                <b>{money(p.quantity * p.price)}</b>
                              </div>
                            ))}
                            <div className="confirmation-line">
                              <span>Livraison</span>
                              <b>{delivery ? money(delivery) : "Offerte"}</b>
                            </div>
                            <div className="confirmation-total">
                              <span>Total à régler</span>
                              <b>{money(subtotal + delivery)}</b>
                            </div>
                            <div className="cash-payment">
                              <CreditCard size={22} />
                              <div>
                                <b>Paiement à la livraison</b>
                                <p>
                                  Réglez en espèces à la réception. Aucun
                                  paiement en ligne ne vous sera demandé.
                                </p>
                              </div>
                              <CheckCircle2 size={18} />
                            </div>
                            <label className="consent">
                              <input
                                type="checkbox"
                                checked={consent}
                                onChange={(e) => setConsent(e.target.checked)}
                              />
                              <span>
                                Je confirme ma commande et j’accepte
                                l’utilisation de mes coordonnées pour sa
                                préparation et sa livraison.
                              </span>
                            </label>
                            {orderError && (
                              <p className="form-error" role="alert">
                                {orderError}
                              </p>
                            )}
                            <button
                              className="button dark full"
                              disabled={
                                !consent || submitting || !cartItems.length
                              }
                              onClick={submitOrder}
                            >
                              {submitting
                                ? "Enregistrement en cours…"
                                : "Confirmer ma commande"}{" "}
                              {!submitting && <ArrowRight size={17} />}
                            </button>
                            <small className="form-security">
                              <ShieldCheck size={13} /> Sans compte. Sans
                              paiement anticipé.
                            </small>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
                {info && <Info type={info} close={closeOverlay} />}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
const information = {
  selection: {
    title: "De belles trouvailles, bien choisies.",
    paragraphs: [
      "Mode, high-tech, maison et beauté : une sélection pensée pour votre quotidien à Daloa et à Bouaké.",
      "Les prix affichés restent indicatifs. Le casque (12 900 FCFA) et le sac (9 200 FCFA) sont alignés sur des offres comparables observées en Côte d’Ivoire ; leurs références exactes, le prix final, les stocks et les avis doivent être confirmés par Global Shop avant toute commande.",
    ],
  },
  about: {
    title: "Global Shop, tout près de vous.",
    paragraphs: [
      "Notre ambition : rendre les essentiels du quotidien accessibles, avec une boutique simple à utiliser et une livraison locale à Daloa et à Bouaké.",
      "Vous découvrez, vous choisissez, vous commandez. Sans créer de compte, et avec un paiement à la livraison.",
    ],
  },
  delivery: {
    title: "Livraison & retours",
    paragraphs: [
      "La livraison est disponible à Daloa et à Bouaké. Les frais sont de 1 500 FCFA, et la livraison est offerte à partir de 50 000 FCFA d’achats.",
      "Votre adresse et un repère précis nous aident à organiser la livraison. Le créneau sera confirmé par téléphone par l’équipe de la boutique.",
      "En cas de produit endommagé ou non conforme, signalez-le au livreur et conservez votre référence de commande. La politique définitive de retours et les délais de livraison devront être publiés avant l’ouverture commerciale.",
    ],
  },
  payment: {
    title: "Payez à la réception.",
    paragraphs: [
      "Le mode de paiement disponible est le paiement en espèces à la livraison. Aucun numéro de carte ni code Mobile Money n’est demandé sur ce site.",
      "Orange Money, MTN Mobile Money et Wave ne sont pas encore intégrés. Ils nécessitent une connexion à un prestataire de paiement agréé.",
    ],
  },
  contact: {
    title: "Une équipe à votre écoute.",
    paragraphs: [
      "Nous livrons à Daloa et à Bouaké, en Côte d’Ivoire.",
      "Après une commande, conservez votre référence. Le téléphone et l’adresse e-mail officiels de Global Shop devront être renseignés par le propriétaire avant l’ouverture de la boutique. Aucun contact fictif n’est présenté ici.",
    ],
  },
  faq: {
    title: "Tout simplement.",
    paragraphs: [
      "Faut-il un compte ? Non. Votre nom, votre téléphone et votre adresse suffisent pour commander.",
      "Comment payer ? En espèces, au moment de recevoir votre commande.",
      "Où livrez-vous ? À Daloa et à Bouaké. La livraison coûte 1 500 FCFA et devient gratuite dès 50 000 FCFA.",
      "Le panier est-il conservé ? Oui, sur votre appareil. Vous pouvez revenir et continuer vos découvertes.",
      "Les avis sont-ils vérifiés ? Les avis affichés dans cette version sont des exemples illustratifs, pas des avis d’acheteurs vérifiés.",
    ],
  },
  social: {
    title: "Retrouvons-nous bientôt.",
    paragraphs: [
      "Les comptes officiels Facebook et Instagram de Global Shop Daloa seront ajoutés à l’ouverture. En attendant, explorez nos collections directement ici.",
    ],
  },
  legal: {
    title: "Mentions légales",
    paragraphs: [
      "Site : Global Shop Daloa. Zone de service : Daloa et Bouaké, Côte d’Ivoire.",
      "Version de démonstration fonctionnelle. Avant l’ouverture commerciale, le propriétaire doit renseigner sa raison sociale, son immatriculation, son adresse, son contact officiel, son hébergeur et ses conditions générales de vente.",
      "Les images sont illustratives. Les prix, les stocks et les avis sont des exemples et doivent être remplacés ou validés avant toute vente réelle.",
    ],
  },
  privacy: {
    title: "Vos données, avec soin.",
    paragraphs: [
      "Votre panier et vos favoris sont conservés uniquement dans le stockage local de votre navigateur. Aucun cookie publicitaire ni outil de suivi n’est utilisé.",
      "Lorsque vous commandez, votre nom, téléphone, adresse et les détails de votre commande sont enregistrés dans une base PostgreSQL privée sur le serveur pour préparer la livraison. Ils ne sont pas accessibles par une API publique.",
      "N’indiquez aucune information bancaire ou donnée sensible dans les notes de commande. Le contact du responsable, les modalités d’exercice de vos droits et la durée de conservation doivent être finalisés avant la mise en service commerciale.",
    ],
  },
};
function Info({ type, close }) {
  const content = information[type];
  return (
    <>
      <button
        className="close-button modal-close"
        aria-label="Fermer"
        onClick={close}
      >
        <X />
      </button>
      <span className="eyebrow">GLOBAL SHOP DALOA</span>
      <h2 id="dialog-title">{content.title}</h2>
      {content.paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <button className="button dark" onClick={close}>
        C’est noté <Check size={16} />
      </button>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
