import { WeekHours } from '../lib/hours';

export interface MenuItem {
  name: string;
  price: number;
  description?: string;
}

/** Régime déclaré (source : tags OpenStreetMap, jamais déduit). */
export type Diet = 'vegan' | 'vegetarian' | 'halal' | 'gluten_free';

export interface Restaurant {
  id: string;
  name: string;
  rating: number;
  price: number;
  distance: string;
  distanceMeters?: number;
  cuisine: string;
  image: string;
  extraImages?: string[];
  address: string;
  lat?: number;
  lng?: number;
  description: string;
  menu?: MenuItem[];
  reviews?: number;
  website?: string;
  phone?: string;
  hours?: WeekHours;
  /** Régimes déclarés (vegan, végétarien, halal, sans gluten) */
  diets?: Diet[];
  dataSource?: 'mock' | 'google-places' | 'osm';
  /** 'community' = photo d'un foodie, 'restaurant' = plat envoyé par le restaurateur, 'site' = photo de son site (avec accord), 'google' = photo Google Maps, 'dish' = plat typique ; sinon illustration. */
  photoSource?: 'community' | 'google' | 'dish' | 'site' | 'restaurant';
  /** Auteur de la photo (affiché obligatoirement pour Google et pour les plats typiques) */
  photoCredit?: string;
  /** Licence et page source de la photo de plat typique (Wikimedia Commons) */
  photoLicense?: string;
  photoPage?: string;
  updatedAt?: string;
  sponsored?: boolean;
  sponsorLabel?: string;
}

const baseMockRestaurants: Restaurant[] = [
  {
    id: '1',
    name: 'Michel Sarran',
    rating: 4.9,
    price: 145,
    distance: '800 m',
    distanceMeters: 800,
    cuisine: 'Gastronomique',
    address: '21 Boulevard Armand-Duportal, 31000 Toulouse',
    lat: 43.6072463,
    lng: 1.4346083,
    description: 'Une maison plus qu\'un restaurant. Chef Michel Sarran signe une cuisine ensoleillée du Sud-Ouest, ancrée dans les meilleurs produits régionaux, où épices, marinades et influences du Maghreb se fondent avec élégance. 1 étoile Michelin depuis 2000.',
    reviews: 1240,
    website: 'https://www.michel-sarran.com',
    image: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?q=80&w=800&auto=format&fit=crop',
    extraImages: [
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600803907087-f56d462fd26b?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=600&auto=format&fit=crop',
    ],
    menu: [
      { name: 'Menu Capitole', price: 75, description: 'Déjeuner uniquement — vins & café compris, 4 services' },
      { name: 'Menu Saveurs', price: 145, description: '5 services autour des produits d\'exception de la région' },
      { name: 'Menu Surprise', price: 195, description: '4 plats, fromage et deux desserts — accord vins +80€' },
      { name: 'Magret de Canard 5 Épices & Abricot', price: 52 },
      { name: 'Pigeon de l\'Aveyron rôti à la broche', price: 48 },
      { name: 'Truffe Noire du Périgord en croûte de sel', price: 62 },
    ],
  },
  {
    id: '2',
    name: 'Le Genty Magre',
    rating: 4.7,
    price: 52,
    distance: '900 m',
    distanceMeters: 900,
    cuisine: 'Gastronomique',
    address: '3 Rue Genty Magre, 31000 Toulouse',
    lat: 43.6014896,
    lng: 1.4453211,
    description: 'Le chef Romain Brard a remporté le titre du meilleur cassoulet toulousain 2023. Une cuisine de marché inventive qui suit les saisons : truffes en hiver, asperges et pigeon au printemps, fruits de mer en été, gibier et racines à l\'automne.',
    reviews: 1420,
    website: 'https://www.legentymagre.com',
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=800&auto=format&fit=crop',
    extraImages: [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=600&auto=format&fit=crop',
    ],
    menu: [
      { name: 'Menu Déjeuner', price: 34, description: 'Entrée + plat ou plat + dessert — tout du marché' },
      { name: 'Menu Découverte', price: 55, description: '4 temps : entrée, poisson, viande, dessert du chef' },
      { name: 'Cassoulet Genty Magre', price: 32, description: 'Lauréat 2023 — haricots Tarbais, confit canard, saucisse de Toulouse' },
      { name: 'Magret de Canard Rossini', price: 29, description: 'Foie gras poêlé, truffe noire, jus de Porto réduit' },
      { name: 'Soufflé au Grand Marnier', price: 11, description: 'Soufflé chaud minute, glace vanille Bourbon' },
    ],
  },
  {
    id: '3',
    name: 'Une Table à Deux',
    rating: 4.8,
    price: 39,
    distance: '500 m',
    distanceMeters: 500,
    cuisine: 'Bistronomie',
    address: '10 Rue de la Pleau, 31000 Toulouse',
    lat: 43.5968505,
    lng: 1.4469823,
    description: 'Nicolas et Morgane, formés dans des tables étoilées, ont ouvert leur bistronomique discret dans le quartier des Carmes en 2018. Menu renouvelé toutes les deux semaines avec les récoltes du jardin potager de Nicolas. Référencé au Guide Michelin.',
    reviews: 1131,
    website: 'https://www.unetableadeux.fr',
    image: 'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?q=80&w=800&auto=format&fit=crop',
    extraImages: [
      'https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1486195128895-2eb2bfbb57b6?q=80&w=600&auto=format&fit=crop',
    ],
    menu: [
      { name: 'Formule Déjeuner', price: 29, description: 'Entrée + Plat + Dessert — produits du marché du jour' },
      { name: 'Menu 4 Temps', price: 39, description: 'Entrée, 2 plats, dessert de saison' },
      { name: 'Menu Gastro 8 Temps', price: 82, description: 'Parcours complet, accord mets & vins disponible' },
      { name: 'Tataki de Thon Germon', price: 18, description: 'Ponzu maison, avocat du domaine, graines de sésame doré' },
      { name: 'Pavlova aux Fruits Rouges du Jardin', price: 9 },
      { name: 'Crémeux Chocolat Araguani 72%', price: 9, description: 'Sorbet cacao, tuile croustillante' },
    ],
  },
  {
    id: '4',
    name: 'Pizza Lola',
    sponsored: true,
    sponsorLabel: 'Partenaire Fooder',
    rating: 4.6,
    price: 17,
    distance: '1.2 km',
    distanceMeters: 1200,
    cuisine: 'Italien',
    address: '42 Rue Peyrolière, 31000 Toulouse',
    lat: 43.6010091,
    lng: 1.4406047,
    description: 'La vraie pizza napolitaine à Toulouse. Pâte levée 48h avec farine Caputo 00, tomates San Marzano DOP et fior di latte importés de Naples. Cuisson au feu de bois à 430°C. Classée meilleure pizza de Toulouse par Toulouse Secret.',
    reviews: 1820,
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=800&auto=format&fit=crop',
    extraImages: [
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=600&auto=format&fit=crop',
    ],
    menu: [
      { name: 'Margherita Royale', price: 14, description: 'San Marzano, fior di latte, basilic frais, grand format' },
      { name: 'Tartufo Bianco', price: 21, description: 'Crème de truffe, champignons, parmesan 24 mois, roquette' },
      { name: 'Diavola Calabrese', price: 16, description: 'Piment de Calabre, saucisse poivrée, pecorino, miel' },
      { name: 'Quattro Formaggi', price: 17, description: 'Gorgonzola, mozzarella, parmesan, fontina valdostana' },
      { name: 'Tiramisu Classico', price: 7.5, description: 'Mascarpone maison, savoiardi, café Arabica, cacao Valrhona' },
      { name: 'Supplì Roma', price: 6.5, description: 'Croquettes riz & fromage fondant, sauce tomate maison' },
    ],
  },
  {
    id: '5',
    name: 'Saveurs de l\'Everest',
    rating: 4.4,
    price: 21,
    distance: '1.8 km',
    distanceMeters: 1800,
    cuisine: 'Népalais',
    address: '30 Rue Jean Palaprat, 31000 Toulouse',
    lat: 43.6056944,
    lng: 1.4523488,
    description: 'Authentique cuisine népalaise et indienne au cœur de Toulouse. Épices fraîches moulues chaque matin, momos faits main et currys parfumés aux herbes himalayennes. Options végétariennes et vegan disponibles.',
    reviews: 638,
    website: 'https://saveurs-de-l-everest-toulouse.fr',
    image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?q=80&w=800&auto=format&fit=crop',
    extraImages: [
      'https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?q=80&w=600&auto=format&fit=crop',
    ],
    menu: [
      { name: 'Momos Népalais (8 pièces)', price: 9.5, description: 'Raviolis vapeur farcis poulet ou légumes, sauce sésame' },
      { name: 'Chicken Tikka Masala', price: 15.5, description: 'Poulet mariné au tandoor, sauce tomate-crème épicée' },
      { name: 'Agneau Garam Masala', price: 17, description: 'Agneau confit longtemps, épices grillées, riz basmati' },
      { name: 'Daal Bhat', price: 12.5, description: 'Lentilles épicées, riz, légumes sautés, achar népalais' },
      { name: 'Cheese Naan XXL', price: 4.5, description: 'Pain au levain, fromage fondu, beurre clarifié' },
      { name: 'Chai Masala', price: 3, description: 'Thé noir, cardamome, gingembre, lait entier' },
    ],
  },
  {
    id: '6',
    name: 'Burger Gourmet Capitole',
    sponsored: true,
    sponsorLabel: 'Partenaire Fooder',
    rating: 4.7,
    price: 17,
    distance: '300 m',
    distanceMeters: 300,
    cuisine: 'Burger',
    address: '8 Place du Capitole, 31000 Toulouse',
    lat: 43.6043987,
    lng: 1.4433516,
    description: 'Le burger artisanal au pied du Capitole. Viande charolaise locale, pain brioché cuit chaque matin sur place, fromages affinés et sauces maison. Frites coupées au couteau, cuites dans la graisse de canard.',
    reviews: 2340,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800&auto=format&fit=crop',
    extraImages: [
      'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1596956470007-2bf6095e7e16?q=80&w=600&auto=format&fit=crop',
    ],
    menu: [
      { name: 'Le Toulousain', price: 15.5, description: 'Saucisse de Toulouse, emmental fondu, oignons confits, moutarde violette' },
      { name: 'Le Charolais', price: 17, description: 'Bœuf charolais 180g, fourme d\'Ambert, bacon fumé, mayo truffe' },
      { name: 'Classic Bacon', price: 13.5, description: 'Double steak 2×80g, bacon croustillant, cheddar, sauce BBQ maison' },
      { name: 'Frites au Canard', price: 5, description: 'Coupées au couteau, graisse de canard, fleur de sel de Guérande' },
      { name: 'Cookie Géant Chocolat Noir', price: 4.5, description: 'Chocolat Valrhona 70%, noisettes du Piémont' },
    ],
  },
  {
    id: '7',
    name: 'La Trattoria Da Luigi',
    rating: 4.5,
    price: 28,
    distance: '1.4 km',
    distanceMeters: 1400,
    cuisine: 'Italien',
    address: '3 Rue Gambetta, 31000 Toulouse',
    lat: 43.6028833,
    lng: 1.4415363,
    description: 'Une trattoria familiale napolitaine où Luigi prépare ses pâtes fraîches chaque matin. Carbonara sans crème comme à Rome, risotto au Barolo, antipasti généreux. Vins naturels italiens et service à la bonne franquette — exactement comme à Naples.',
    reviews: 780,
    image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?q=80&w=800&auto=format&fit=crop',
    extraImages: [
      'https://images.unsplash.com/photo-1534422298391-e4f8c170db06?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1499540813422-a9e5756e9fa2?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=600&auto=format&fit=crop',
    ],
    menu: [
      { name: 'Carbonara Authentica', price: 16, description: 'Pâtes fraîches maison, guanciale, œuf entier, pecorino Romano — jamais de crème' },
      { name: 'Cacio e Pepe', price: 15, description: 'Tonnarelli maison, pecorino Romano DOP, poivre noir de Sarawak' },
      { name: 'Risotto Barolo & Cèpes', price: 19, description: 'Riz Carnaroli, Barolo 2021, cèpes séchés, copeaux de truffe d\'été' },
      { name: 'Antipasti della Casa', price: 13.5, description: 'Burrata pugliese, charcuteries italiennes, olives taggiasca, bruschetta' },
      { name: 'Tiramisu Classico', price: 7.5, description: 'Mascarpone Galbani, savoiardi, espresso Illy, cacao Valrhona' },
      { name: 'Panna Cotta Pistache de Bronte', price: 6.5 },
    ],
  },
  {
    id: '8',
    name: 'Le Kabab du Coin',
    rating: 4.3,
    price: 11,
    distance: '1.1 km',
    distanceMeters: 1100,
    cuisine: 'Kebab',
    address: '15 Rue de Metz, 31000 Toulouse',
    lat: 43.6002466,
    lng: 1.4428745,
    description: 'Une institution toulousaine pour les vrais amateurs. Pain cuit sur place à la commande, broche artisanale tournant depuis l\'ouverture, sauces secrètes transmises de génération en génération. Ouvert jusqu\'à 4h du matin le week-end.',
    reviews: 892,
    image: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?q=80&w=800&auto=format&fit=crop',
    extraImages: [
      'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1626700051175-65fc00085871?q=80&w=600&auto=format&fit=crop',
    ],
    menu: [
      { name: 'Kebab Complet Frites', price: 9.5, description: 'Pain maison, viande mixte agneau-poulet, frites dorées, sauce blanche' },
      { name: 'Assiette Mixte Grill', price: 13.5, description: 'Agneau, poulet, brochette de kefta + salade fraîche + frites' },
      { name: 'Wrap Signature', price: 8, description: 'Galette fine, poulet mariné, sauce blanche maison, légumes frais' },
      { name: 'Dürüm Agneau', price: 9, description: 'Agneau mariné 24h, fromage fondant, crudités, harissa douce' },
      { name: 'Baklava Maison', price: 3.5, description: 'Feuilleté pistache et miel, recette familiale turque' },
    ],
  },
];

const LUNCH_DINNER: WeekHours = [
  [], [[720, 810], [1170, 1290]], [[720, 810], [1170, 1290]], [[720, 810], [1170, 1290]], [[720, 810], [1170, 1290]], [[720, 810], [1170, 1290]], [],
];
const BISTRO: WeekHours = [
  [], [[720, 840], [1170, 1320]], [[720, 840], [1170, 1320]], [[720, 840], [1170, 1320]], [[720, 840], [1170, 1320]], [[720, 840], [1170, 1320]], [],
];
const EVERY_DAY = (ranges: [number, number][]): WeekHours => Array.from({ length: 7 }, () => ranges);

const MOCK_HOURS: Record<string, WeekHours> = {
  '1': LUNCH_DINNER,
  '2': BISTRO,
  '3': BISTRO,
  '4': EVERY_DAY([[690, 870], [1110, 1380]]),
  '5': [[[705, 870], [1110, 1350]], [[705, 870], [1110, 1350]], [[705, 870], [1110, 1350]], [[705, 870], [1110, 1350]], [[705, 870], [1110, 1350]], [[705, 870], [1110, 1350]], [[1110, 1350]]],
  '6': EVERY_DAY([[690, 1350]]),
  '7': [[[720, 840], [1140, 1350]], [[720, 840], [1140, 1350]], [[720, 840], [1140, 1350]], [[720, 840], [1140, 1350]], [[720, 840], [1140, 1380]], [[720, 840], [1140, 1380]], []],
  '8': EVERY_DAY([[660, 1470]]),
};

export const mockRestaurants: Restaurant[] = baseMockRestaurants.map((restaurant) => ({
  ...restaurant,
  hours: MOCK_HOURS[restaurant.id],
  dataSource: 'mock',
  updatedAt: '2026-05-10T12:00:00.000Z',
}));
