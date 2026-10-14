// Logo Global Shop Daloa partagé entre la vitrine (en-tête, pied de page, confirmation)
// et le tableau de bord admin (/admin).
// Le fichier est défini dans src/brand.js ; si l'image ne charge pas, on affiche le repli
// (monogramme « g• » par défaut, « GS » dans l'admin).
import React, { useState } from "react";
import { BRAND_LOGO_ALT, BRAND_LOGO_PATH } from "./brand.js";

const DEFAULT_FALLBACK = (
  <span className="brand-symbol" aria-hidden="true">
    g<span>•</span>
  </span>
);

export default function BrandLogo({ className = "brand-logo", fallback = DEFAULT_FALLBACK }) {
  const [unavailable, setUnavailable] = useState(false);
  if (unavailable) return fallback;
  return (
    <img
      className={className}
      src={BRAND_LOGO_PATH}
      alt={BRAND_LOGO_ALT}
      onError={() => setUnavailable(true)}
    />
  );
}
