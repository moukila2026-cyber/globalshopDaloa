import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const outputDirectory = fileURLToPath(
  new URL("../public/images/products/", import.meta.url),
);

// Original vector artwork made for the Global Shop Daloa demo. No stock photos,
// third-party illustrations, external fonts, or remote image services are used.
const products = {
  casque: {
    title: "Casque sans fil Studio",
    colors: ["#e8ddc8", "#f4eee2", "#b7a287", "#344d43"],
    main: `
      <path d="M267 571v-82c0-163 82-279 183-279s183 116 183 279v82" fill="none" stroke="url(#material)" stroke-width="55" stroke-linecap="round"/>
      <path d="M294 492c3-117 63-216 156-216s153 99 156 216" fill="none" stroke="#fff9ed" stroke-opacity=".7" stroke-width="7" stroke-linecap="round"/>
      <rect x="218" y="475" width="113" height="285" rx="49" fill="url(#material)" stroke="#8f806b" stroke-width="3"/>
      <rect x="568" y="475" width="113" height="285" rx="49" fill="url(#material)" stroke="#8f806b" stroke-width="3"/>
      <rect x="235" y="496" width="78" height="244" rx="36" fill="#f6efe2" opacity=".9"/>
      <rect x="586" y="496" width="78" height="244" rx="36" fill="#f6efe2" opacity=".9"/>
      <path d="M240 713h69M590 713h69" stroke="#baa98e" stroke-width="3" stroke-linecap="round"/>
      <circle cx="275" cy="621" r="8" fill="#c1ae91"/><circle cx="624" cy="621" r="8" fill="#c1ae91"/>`,
    extra: `
      <g transform="translate(8 4) rotate(-12 450 570)">
        <path d="M285 578v-78c0-147 75-253 169-253s169 106 169 253v78" fill="none" stroke="url(#material)" stroke-width="51" stroke-linecap="round"/>
        <path d="M309 502c5-112 61-208 145-208s140 96 145 208" fill="none" stroke="#fff9ed" stroke-opacity=".7" stroke-width="7" stroke-linecap="round"/>
        <rect x="229" y="478" width="108" height="278" rx="47" fill="url(#material)" stroke="#8f806b" stroke-width="3"/>
        <rect x="555" y="478" width="108" height="278" rx="47" fill="url(#material)" stroke="#8f806b" stroke-width="3"/>
        <rect x="245" y="498" width="75" height="239" rx="34" fill="#f6efe2" opacity=".92"/>
        <rect x="572" y="498" width="75" height="239" rx="34" fill="#f6efe2" opacity=".92"/>
        <path d="M250 710h65M577 710h65" stroke="#baa98e" stroke-width="3" stroke-linecap="round"/>
      </g>`,
  },
  sac: {
    title: "Sac porté épaule Élise",
    colors: ["#ead9c3", "#f7efe3", "#b77551", "#623f30"],
    main: `
      <path d="M327 507v-113c0-85 53-145 123-145s123 60 123 145v113" fill="none" stroke="#754d39" stroke-width="25"/>
      <path d="M347 500v-101c0-67 40-113 103-113s103 46 103 113v101" fill="none" stroke="#d9a77f" stroke-width="8"/>
      <path d="M252 494q0-34 39-43l159-28 159 28q39 9 39 43v293q0 35-39 42H291q-39-7-39-42z" fill="url(#material)" stroke="#754d39" stroke-width="5"/>
      <path d="M270 519q180-38 360 0v251q0 23-25 27H295q-25-4-25-27z" fill="#b87952" opacity=".44"/>
      <path d="M286 531q164-33 328 0M287 764q163 28 326 0" fill="none" stroke="#f1c39c" stroke-width="5" opacity=".8"/>
      <path d="M326 493v48m246-48v48" stroke="#e4b18a" stroke-width="7"/>
      <rect x="415" y="640" width="70" height="8" rx="4" fill="#5c4131" opacity=".4"/>
      <circle cx="347" cy="499" r="13" fill="#d8b38b"/><circle cx="553" cy="499" r="13" fill="#d8b38b"/>`,
    extra: `
      <g transform="rotate(-8 450 580)">
        <path d="M346 526v-111q0-133 104-133t104 133v111" fill="none" stroke="#704b38" stroke-width="23"/>
        <path d="M365 518v-99q0-105 85-105t85 105v99" fill="none" stroke="#dda984" stroke-width="7"/>
        <path d="M247 512q0-32 36-41l167-31 167 31q36 9 36 41v272q0 37-39 44H286q-39-7-39-44z" fill="url(#material)" stroke="#704b38" stroke-width="5"/>
        <path d="M269 540q181-35 362 0v227q0 31-32 37H301q-32-6-32-37z" fill="#b87952" opacity=".43"/>
        <path d="M276 546q174-31 348 0" fill="none" stroke="#f3c7a3" stroke-width="5"/>
        <rect x="417" y="657" width="66" height="8" rx="4" fill="#5c4131" opacity=".4"/>
        <circle cx="336" cy="520" r="12" fill="#d8b38b"/><circle cx="564" cy="520" r="12" fill="#d8b38b"/>
      </g>`,
  },
  baskets: {
    title: "Baskets Essential",
    colors: ["#e5e2da", "#f8f7f2", "#bd9a70", "#4b4e46"],
    main: `
      <g transform="translate(148 448) rotate(-8 290 160)">
        <path d="M36 174q36-19 64-71l68-94q19-24 47-10l91 50q54 29 81 76l81 44q33 18 23 61l-10 37q-7 24-38 24H83q-54 0-60-40l-5-33q-5-29 18-44z" fill="url(#material)" stroke="#a49c8b" stroke-width="5"/>
        <path d="M33 211q193 38 449-4l14 27q-7 30-38 30H83q-54 0-60-40z" fill="#b9956a" stroke="#8b7557" stroke-width="5"/>
        <path d="M170 29q83 3 142 63l-46 74-167-16z" fill="#faf8f1"/>
        <path d="M111 123l168 23m-185-2 174 23m-137-78 31 64m19-54 30 59m17-45 29 45" stroke="#ad987b" stroke-width="7" stroke-linecap="round"/>
        <path d="M70 182q111 18 181 9" stroke="#d0b98f" stroke-width="7" stroke-linecap="round"/>
      </g>
      <g transform="translate(524 557) scale(.52) rotate(9 290 160)" opacity=".92">
        <path d="M36 174q36-19 64-71l68-94q19-24 47-10l91 50q54 29 81 76l81 44q33 18 23 61l-10 37q-7 24-38 24H83q-54 0-60-40l-5-33q-5-29 18-44z" fill="#ece9e1" stroke="#aaa28f" stroke-width="7"/>
        <path d="M33 211q193 38 449-4l14 27q-7 30-38 30H83q-54 0-60-40z" fill="#b9956a" stroke="#8b7557" stroke-width="7"/>
      </g>`,
    extra: `
      <g transform="translate(191 464) rotate(5 255 170) scale(1.03)">
        <path d="M36 174q36-19 64-71l68-94q19-24 47-10l91 50q54 29 81 76l81 44q33 18 23 61l-10 37q-7 24-38 24H83q-54 0-60-40l-5-33q-5-29 18-44z" fill="url(#material)" stroke="#a49c8b" stroke-width="5"/>
        <path d="M33 211q193 38 449-4l14 27q-7 30-38 30H83q-54 0-60-40z" fill="#b9956a" stroke="#8b7557" stroke-width="5"/>
        <path d="M170 29q83 3 142 63l-46 74-167-16z" fill="#faf8f1"/>
        <path d="M111 123l168 23m-185-2 174 23m-137-78 31 64m19-54 30 59m17-45 29 45" stroke="#ad987b" stroke-width="7" stroke-linecap="round"/>
        <path d="M70 182q111 18 181 9" stroke="#d0b98f" stroke-width="7" stroke-linecap="round"/>
      </g>
      <path d="M673 580q60-39 92-3" fill="none" stroke="#9d8767" stroke-width="3" opacity=".6"/>`,
  },
  serum: {
    title: "Sérum éclat botanique",
    colors: ["#e4e9dc", "#f4f1e7", "#b77551", "#4d6751"],
    main: `
      <path d="M267 756q-122-86-96-224 88 17 117 128m315 112q119-101 64-236-86 29-111 145" fill="none" stroke="#81966f" stroke-width="13" stroke-linecap="round"/>
      <path d="M205 578q-12-75-76-104m450 247q15-87 92-132" fill="none" stroke="#a5b28e" stroke-width="9" stroke-linecap="round"/>
      <path d="M367 353h166v70H367z" fill="#d1c6ae" stroke="#97866d" stroke-width="4"/>
      <path d="M389 253q0-38 61-38t61 38v100H389z" fill="#484238"/>
      <path d="M418 234v-45q0-16 32-16t32 16v45" fill="none" stroke="#e6d6b8" stroke-width="8"/>
      <path d="M334 444q0-33 34-42h164q34 9 34 42v346q0 35-36 41H370q-36-6-36-41z" fill="url(#material)" stroke="#874f32" stroke-width="5"/>
      <path d="M352 471q98-21 196 0v298q-98 22-196 0z" fill="#a45e39" opacity=".48"/>
      <rect x="374" y="543" width="152" height="130" rx="10" fill="#f1e4c9" opacity=".96"/>
      <text x="450" y="579" text-anchor="middle" fill="#49604b" font-size="18" letter-spacing="4" font-family="Arial,sans-serif">BOTANIQUE</text>
      <text x="450" y="622" text-anchor="middle" fill="#79553d" font-size="34" font-family="Georgia,serif">éclat</text>
      <text x="450" y="649" text-anchor="middle" fill="#756b58" font-size="12" letter-spacing="2" font-family="Arial,sans-serif">30 ML · DALOA</text>
      <path d="M150 749q32-7 64 15m473-20q34-18 63-7" stroke="#788c68" stroke-width="8" fill="none" stroke-linecap="round"/>`,
    extra: `
      <path d="M220 820q-82-100-55-205 69 16 90 110m385 90q80-112 41-211-73 24-93 125" fill="none" stroke="#8a9c75" stroke-width="11" stroke-linecap="round"/>
      <path d="M364 364h172v65H364z" fill="#d3c6ab" stroke="#94836c" stroke-width="4"/>
      <path d="M389 260q0-35 61-35t61 35v104H389z" fill="#49433a"/>
      <path d="M417 240v-47q0-15 33-15t33 15v47" fill="none" stroke="#e8d9be" stroke-width="8"/>
      <path d="M321 447q0-33 37-43h184q37 10 37 43v354q0 40-39 47H360q-39-7-39-47z" fill="url(#material)" stroke="#874f32" stroke-width="5"/>
      <path d="M342 473q108-24 216 0v311q-108 24-216 0z" fill="#a45e39" opacity=".47"/>
      <rect x="359" y="555" width="182" height="144" rx="10" fill="#f4e8d0" opacity=".97"/>
      <text x="450" y="592" text-anchor="middle" fill="#49604b" font-size="18" letter-spacing="4" font-family="Arial,sans-serif">BOTANIQUE</text>
      <text x="450" y="639" text-anchor="middle" fill="#79553d" font-size="36" font-family="Georgia,serif">éclat</text>
      <text x="450" y="674" text-anchor="middle" fill="#756b58" font-size="12" letter-spacing="2" font-family="Arial,sans-serif">SÉRUM · 30 ML</text>`,
  },
  lampe: {
    title: "Lampe de table Alma",
    colors: ["#e9e0d1", "#f5f0e6", "#c7a676", "#53564a"],
    main: `
      <circle cx="450" cy="475" r="210" fill="#f4ce83" opacity=".16"/>
      <path d="M450 260v468" stroke="#a78960" stroke-width="17" stroke-linecap="round"/>
      <path d="M278 421q27-188 172-188t172 188z" fill="url(#material)" stroke="#887557" stroke-width="5"/>
      <path d="M278 421q172 25 344 0" fill="none" stroke="#f9edcf" stroke-width="9" opacity=".95"/>
      <ellipse cx="450" cy="733" rx="115" ry="29" fill="#8f7858" opacity=".35"/>
      <path d="M350 737q100-30 200 0l30 56q-130 42-260 0z" fill="#c4a577" stroke="#897552" stroke-width="5"/>
      <path d="M374 778q76 22 152 0" fill="none" stroke="#e6d3b0" stroke-width="5"/>
      <circle cx="450" cy="428" r="7" fill="#f6e7c0"/>
      <path d="M244 875h412" stroke="#b8aa92" stroke-width="3" opacity=".5"/>`,
    extra: `
      <circle cx="450" cy="477" r="205" fill="#f0c66f" opacity=".19"/>
      <g transform="rotate(-7 450 560)">
        <path d="M450 277v448" stroke="#a78960" stroke-width="18" stroke-linecap="round"/>
        <path d="M265 430q36-186 185-186t185 186z" fill="url(#material)" stroke="#887557" stroke-width="5"/>
        <path d="M265 430q185 27 370 0" fill="none" stroke="#f9edcf" stroke-width="9"/>
        <path d="M353 732q97-31 194 0l31 60q-128 39-256 0z" fill="#c4a577" stroke="#897552" stroke-width="5"/>
        <path d="M376 777q74 20 148 0" fill="none" stroke="#e6d3b0" stroke-width="5"/>
      </g>
      <path d="M690 404v133m-23-110h46" stroke="#927c5f" stroke-width="4" opacity=".56"/>`,
  },
  montre: {
    title: "Montre connectée Active",
    colors: ["#e6e6e1", "#f4f3ef", "#89928c", "#353b37"],
    main: `
      <path d="M392 210q58-30 116 0l31 192H361z" fill="url(#material)" stroke="#777f79" stroke-width="5"/>
      <path d="M361 658h178l-31 192q-58 30-116 0z" fill="url(#material)" stroke="#777f79" stroke-width="5"/>
      <rect x="291" y="383" width="318" height="318" rx="84" fill="#434a45" stroke="#b2b7af" stroke-width="9"/>
      <rect x="318" y="410" width="264" height="264" rx="61" fill="#172520"/>
      <circle cx="450" cy="542" r="85" fill="none" stroke="#d5a06f" stroke-width="10"/>
      <path d="M450 470v73l49 29" fill="none" stroke="#f2e8d7" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="450" cy="543" r="9" fill="#b77551"/>
      <path d="M357 624q93 27 186 0" fill="none" stroke="#7f9a86" stroke-width="5" stroke-linecap="round"/>
      <rect x="605" y="492" width="14" height="68" rx="7" fill="#a6aaa3"/>`,
    extra: `
      <g transform="translate(450 560) rotate(-15) translate(-450 -560)">
        <path d="M392 202q58-30 116 0l31 192H361z" fill="url(#material)" stroke="#777f79" stroke-width="5"/>
        <path d="M361 658h178l-31 192q-58 30-116 0z" fill="url(#material)" stroke="#777f79" stroke-width="5"/>
        <rect x="291" y="383" width="318" height="318" rx="84" fill="#434a45" stroke="#b2b7af" stroke-width="9"/>
        <rect x="318" y="410" width="264" height="264" rx="61" fill="#172520"/>
        <circle cx="450" cy="542" r="85" fill="none" stroke="#d5a06f" stroke-width="10"/>
        <path d="M450 470v73l49 29" fill="none" stroke="#f2e8d7" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="450" cy="543" r="9" fill="#b77551"/>
        <path d="M357 624q93 27 186 0" fill="none" stroke="#7f9a86" stroke-width="5" stroke-linecap="round"/>
      </g>
      <path d="M670 293q48 25 74 73m-68 370q44-17 68-63" fill="none" stroke="#aeb5ac" stroke-width="4" opacity=".65"/>`,
  },
  vase: {
    title: "Vase céramique Terra",
    colors: ["#ebded2", "#f6eee5", "#b77551", "#794b38"],
    main: `
      <path d="M415 286h70v100q0 30 31 64 87 91 74 227-13 140-172 140T246 677q-13-136 74-227 31-34 31-64V286z" fill="url(#material)" stroke="#8c5940" stroke-width="5"/>
      <ellipse cx="450" cy="290" rx="35" ry="10" fill="#8d5b42"/>
      <path d="M350 523q100 42 200 0m-219 77q119 42 238 0m-231 73q112 31 224 0" fill="none" stroke="#e2b08d" stroke-width="5" opacity=".72"/>
      <path d="M449 292v-142m1 118q-60-59-85-119m84 146q56-78 85-141" fill="none" stroke="#5c7555" stroke-width="8" stroke-linecap="round"/>
      <path d="M450 198q-53-74-116-40 19 72 116 73m0 5q61-84 126-46-23 81-126 80" fill="#7f966c" stroke="#617b59" stroke-width="4"/>
      <path d="M449 172q-5-60 42-93 44 47-23 112" fill="#9aab7c" stroke="#617b59" stroke-width="4"/>
      <circle cx="332" cy="357" r="4" fill="#edc2a0"/><circle cx="565" cy="431" r="5" fill="#edc2a0"/><circle cx="358" cy="712" r="4" fill="#edc2a0"/>`,
    extra: `
      <path d="M416 289h68v94q0 32 33 66 91 94 75 232-17 137-176 137T240 681q-16-138 75-232 33-34 33-66v-94z" fill="url(#material)" stroke="#8c5940" stroke-width="5"/>
      <ellipse cx="450" cy="291" rx="34" ry="10" fill="#8d5b42"/>
      <path d="M343 520q107 47 214 0m-228 81q121 39 242 0m-235 73q110 34 220 0" fill="none" stroke="#e2b08d" stroke-width="5" opacity=".72"/>
      <path d="M451 293v-127m0 110q-53-71-89-123m88 142q63-86 107-137" fill="none" stroke="#5c7555" stroke-width="8" stroke-linecap="round"/>
      <path d="M450 210q-47-78-110-44 20 69 110 73m1-5q61-88 124-50-18 79-124 83" fill="#7f966c" stroke="#617b59" stroke-width="4"/>
      <path d="M451 184q-8-56 38-88 43 48-17 107" fill="#9aab7c" stroke="#617b59" stroke-width="4"/>`,
  },
  lunettes: {
    title: "Lunettes de soleil Riviera",
    colors: ["#e9e0d4", "#f8f3eb", "#8a5b3e", "#3c4038"],
    main: `
      <path d="M190 475q-34-30-73-25m593 0q-39-5-73 25" fill="none" stroke="#70513b" stroke-width="13" stroke-linecap="round"/>
      <path d="M155 454q20-44 70-44h133q38 0 45 36l-16 164q-5 53-59 57H236q-49-5-58-55z" fill="#66513f" fill-opacity=".22" stroke="url(#material)" stroke-width="18"/>
      <path d="M497 446q7-36 45-36h133q50 0 70 44l-23 158q-9 50-58 55H548q-54-4-59-57z" fill="#66513f" fill-opacity=".22" stroke="url(#material)" stroke-width="18"/>
      <path d="M401 462q49-38 98 0" fill="none" stroke="#6c4d38" stroke-width="15" stroke-linecap="round"/>
      <path d="M204 472q65-34 139-11m188-1q76-23 143 11" stroke="#d8b08c" stroke-width="7" opacity=".7" fill="none"/>
      <path d="M190 650q-26 37-63 45m583-45q26 37 63 45" fill="none" stroke="#70513b" stroke-width="8" stroke-linecap="round"/>
      <circle cx="450" cy="489" r="5" fill="#d6ae85"/>`,
    extra: `
      <g transform="translate(0 15) rotate(-7 450 550)">
        <path d="M190 475q-34-30-73-25m593 0q-39-5-73 25" fill="none" stroke="#70513b" stroke-width="13" stroke-linecap="round"/>
        <path d="M155 454q20-44 70-44h133q38 0 45 36l-16 164q-5 53-59 57H236q-49-5-58-55z" fill="#66513f" fill-opacity=".22" stroke="url(#material)" stroke-width="18"/>
        <path d="M497 446q7-36 45-36h133q50 0 70 44l-23 158q-9 50-58 55H548q-54-4-59-57z" fill="#66513f" fill-opacity=".22" stroke="url(#material)" stroke-width="18"/>
        <path d="M401 462q49-38 98 0" fill="none" stroke="#6c4d38" stroke-width="15" stroke-linecap="round"/>
        <path d="M204 472q65-34 139-11m188-1q76-23 143 11" stroke="#d8b08c" stroke-width="7" opacity=".7" fill="none"/>
        <path d="M190 650q-26 37-63 45m583-45q26 37 63 45" fill="none" stroke="#70513b" stroke-width="8" stroke-linecap="round"/>
      </g>
      <path d="M713 711q-94 45-190 36" fill="none" stroke="#9c856a" stroke-width="4" opacity=".5"/>`,
  },
};

function illustration(id, product, view, artwork) {
  const [background, highlight, accent, material] = product.colors;
  const label = view === "extra" ? "Vue détaillée" : "Vue principale";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1060" role="img" aria-labelledby="title description">
  <title id="title">${product.title} — ${label}</title>
  <desc id="description">Illustration vectorielle originale du produit ${product.title}, réalisée pour la maquette Global Shop Daloa.</desc>
  <defs>
    <linearGradient id="canvas" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${highlight}"/><stop offset="1" stop-color="${background}"/></linearGradient>
    <linearGradient id="material" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${highlight}"/><stop offset=".48" stop-color="${accent}"/><stop offset="1" stop-color="${material}"/></linearGradient>
    <radialGradient id="softLight"><stop stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <filter id="softShadow" x="-.3" y="-.3" width="1.6" height="1.8"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="900" height="1060" fill="url(#canvas)"/>
  <ellipse cx="450" cy="505" rx="360" ry="390" fill="url(#softLight)"/>
  <path d="M0 832q212-99 450-49 240 48 450-17v294H0z" fill="#ffffff" opacity=".17"/>
  <path d="M87 114h726M87 144h125" stroke="#6b685b" stroke-opacity=".18" stroke-width="2"/>
  <text x="87" y="98" fill="#525e50" fill-opacity=".76" font-family="Arial,sans-serif" font-size="15" letter-spacing="4">GLOBAL SHOP · SÉLECTION</text>
  <ellipse cx="450" cy="852" rx="246" ry="45" fill="#3c3329" opacity=".17" filter="url(#softShadow)"/>
  <rect x="181" y="835" width="538" height="86" rx="15" fill="#fffdf7" opacity=".36"/>
  <path d="M181 854q269 30 538 0" stroke="#fff" stroke-opacity=".6" stroke-width="3" fill="none"/>
${artwork.trim()}
  <path d="M87 961h726" stroke="#5a5c50" stroke-opacity=".22" stroke-width="2"/>
  <text x="87" y="997" fill="#596052" fill-opacity=".78" font-family="Arial,sans-serif" font-size="13" letter-spacing="3">DALOA · BIEN CHOISI, TOUT PRÈS DE VOUS</text>
  <text x="812" y="997" text-anchor="end" fill="#596052" fill-opacity=".62" font-family="Arial,sans-serif" font-size="12" letter-spacing="2">${id.toUpperCase()}</text>
</svg>`;
}

await mkdir(outputDirectory, { recursive: true });
for (const [id, product] of Object.entries(products)) {
  await writeFile(
    path.join(outputDirectory, `${id}.svg`),
    illustration(id, product, "main", product.main),
  );
  await writeFile(
    path.join(outputDirectory, `${id}-extra.svg`),
    illustration(id, product, "extra", product.extra),
  );
}

await writeFile(
  path.join(outputDirectory, "produit-indisponible.svg"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1060" role="img" aria-labelledby="t d"><title id="t">Image produit indisponible</title><desc id="d">Illustration de remplacement Global Shop.</desc><rect width="900" height="1060" fill="#f3f0e8"/><rect x="205" y="280" width="490" height="480" rx="32" fill="#e7e4da"/><path d="M330 610l96-109 72 76 47-52 92 108H330z" fill="#b8c3b3"/><circle cx="560" cy="402" r="45" fill="#d9b68d"/><text x="450" y="850" text-anchor="middle" fill="#2b4e40" font-family="Arial,sans-serif" font-size="28" letter-spacing="4">GLOBAL SHOP</text></svg>\n`,
);

console.log(
  `Generated ${Object.keys(products).length * 2} original local product illustrations in ${outputDirectory}`,
);
