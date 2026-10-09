const productImage = (id, view = "main") =>
  `/images/products/${id}${view === "extra" ? "-extra" : ""}.svg`;
// Stocks are demonstration seed values; the live quantity comes from PostgreSQL.
// Prices on the casque/sac photo references are indicative local-market comparisons.
export const products = [
  {
    id: "casque",
    name: "Casque sans fil Studio",
    category: "High-tech",
    price: 12900,
    oldPrice: null,
    image: "/images/products/casque.png",
    extra: "/images/products/casque-extra.jpg",
    rating: 4.8,
    reviews: 24,
    badge: "BEST-SELLER",
    color: "Blanc",
    stock: 18,
    description:
      "Un casque blanc à arceau pour vos moments d’écoute. Les images sont des références visuelles ; le modèle exact, l’autonomie et les accessoires sont à confirmer auprès de Global Shop avant la commande.",
    specs: [
      "Format supra-auriculaire · coloris de référence : blanc",
      "Version Bluetooth et autonomie à confirmer",
      "Accessoires et garantie à confirmer avant l’achat",
    ],
    review:
      "Très agréable à porter, et le son est vraiment bon. Mon nouveau compagnon au quotidien.",
  },
  {
    id: "sac",
    name: "Sac porté épaule Élise",
    category: "Mode",
    price: 9200,
    oldPrice: null,
    image: "/images/products/sac.jpg",
    extra: "/images/products/sac-extra.jpg",
    rating: 4.9,
    reviews: 18,
    badge: "COUP DE CŒUR",
    color: "Tons neutres",
    stock: 12,
    description:
      "Un sac porté épaule dans des tons neutres, présenté à partir de photos de référence. Le modèle, la matière, les dimensions et la couleur exacte de l’article disponible sont à confirmer auprès de Global Shop avant la commande.",
    specs: [
      "Type illustré : sac à main porté épaule",
      "Matière et dimensions exactes à confirmer",
      "Coloris de l’article disponible à confirmer avant l’achat",
    ],
    review:
      "La couleur est magnifique et la taille parfaite pour mes affaires. Très satisfaite !",
  },
  {
    id: "baskets",
    name: "Baskets Essential",
    category: "Mode",
    price: 22000,
    oldPrice: 28000,
    image: productImage("baskets"),
    extra: productImage("baskets", "extra"),
    rating: 4.7,
    reviews: 32,
    badge: "−21 %",
    color: "Blanc / caramel",
    stock: 20,
    description:
      "Une paire facile à aimer et à porter. Des lignes sobres, une semelle confortable et un style qui s’associe à toutes vos envies.",
    specs: [
      "Pointures disponibles : 38 à 43",
      "Semelle en caoutchouc",
      "Tige synthétique · Coupe standard",
    ],
    review: "Confortables dès le premier jour. Elles vont avec tout !",
  },
  {
    id: "serum",
    name: "Sérum éclat botanique",
    category: "Beauté",
    price: 9500,
    oldPrice: null,
    image: productImage("serum"),
    extra: productImage("serum", "extra"),
    rating: 4.8,
    reviews: 16,
    badge: "NOUVEAU",
    color: "30 ml",
    stock: 25,
    description:
      "Un geste simple pour une routine qui fait du bien. Une texture légère et une formule hydratante pour retrouver une peau douce et lumineuse.",
    specs: [
      "Flacon de 30 ml avec pipette",
      "Usage quotidien · Tous types de peaux",
      "Tester sur une petite zone avant usage",
    ],
    review:
      "Texture légère et agréable. Le flacon est aussi très joli dans ma salle de bain.",
  },
  {
    id: "lampe",
    name: "Lampe de table Alma",
    category: "Maison",
    price: 16500,
    oldPrice: 20000,
    image: productImage("lampe"),
    extra: productImage("lampe", "extra"),
    rating: 4.6,
    reviews: 12,
    badge: "",
    color: "Naturel",
    stock: 8,
    description:
      "La lumière qu’il manquait à votre intérieur. Une lampe aux lignes douces pour créer une atmosphère chaleureuse sur une table de chevet ou un bureau.",
    specs: [
      "Hauteur : 35 cm",
      "Douille E27 · Ampoule non incluse",
      "Alimentation secteur 220 V",
    ],
    review: "Une lumière très douce et un beau rendu dans mon salon.",
  },
  {
    id: "montre",
    name: "Montre connectée Active",
    category: "High-tech",
    price: 29900,
    oldPrice: 39000,
    image: productImage("montre"),
    extra: productImage("montre", "extra"),
    rating: 4.7,
    reviews: 21,
    badge: "−23 %",
    color: "Argent",
    stock: 15,
    description:
      "Gardez le rythme sans perdre le style. Notifications, suivi d’activité et cadran élégant : les essentiels réunis à votre poignet.",
    specs: [
      "Compatible Android et iOS",
      "Suivi des pas et des activités",
      "Bracelet réglable · Câble inclus",
    ],
    review:
      "Facile à utiliser et très pratique pour suivre mes pas au quotidien.",
  },
  {
    id: "vase",
    name: "Vase céramique Terra",
    category: "Maison",
    price: 8500,
    oldPrice: null,
    image: productImage("vase"),
    extra: productImage("vase", "extra"),
    rating: 4.9,
    reviews: 9,
    badge: "",
    color: "Terracotta",
    stock: 11,
    description:
      "Un bel objet, tout simplement. Sa finition mate et sa silhouette sculpturale donnent du caractère à votre intérieur, avec ou sans bouquet.",
    specs: [
      "Céramique · Finition mate",
      "Hauteur : 22 cm",
      "Nettoyage avec un chiffon doux",
    ],
    review:
      "Encore plus beau en vrai. Il apporte une jolie touche à mon intérieur.",
  },
  {
    id: "lunettes",
    name: "Lunettes de soleil Riviera",
    category: "Mode",
    price: 7500,
    oldPrice: 10000,
    image: productImage("lunettes"),
    extra: productImage("lunettes", "extra"),
    rating: 4.6,
    reviews: 14,
    badge: "−25 %",
    color: "Écaille",
    stock: 24,
    description:
      "Des journées ensoleillées, un style affirmé. Une monture légère et intemporelle à emporter partout avec vous.",
    specs: [
      "Protection UV400",
      "Monture légère en acétate",
      "Étui souple inclus",
    ],
    review:
      "Très belles lunettes, légères et confortables. Excellent rapport qualité-prix.",
  },
];
export const shippingFee = (subtotal) => (subtotal >= 50000 ? 0 : 1500);
