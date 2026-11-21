// Site copy in one place. Wording comes from Checko-Homepage-Concepts.html and the approved hero.

export const site = {
  name: 'Checko',
  url: 'https://checko.ai',
  title: 'Checko | Scan it. Know it’s genuine.',
  description:
    'Checko protects products with tactile 3D labels made of randomly set ink. Anyone can verify a product in seconds with a smartphone. Born at IIT Kanpur.',
  tagline: 'The fingerprint of things.',
};

export const nav = [
  { href: '#problem', label: 'The problem' },
  { href: '#solutions', label: 'Solutions' },
  { href: '#industries', label: 'Industries' },
  { href: '#about', label: 'About' },
];

export type Product = { id: string; name: string; category: string; aspect: number; tag: [number, number, number, number] };

// tag: the Checko label's box inside each photo (x, y, w, h as fractions), used to frame the phone camera on it
// v2: unbranded products (from the Industries set), each wearing a Checko label
export const products: Product[] = [
  { id: 'v2c-lub', name: 'Engine oil', category: 'Lubricants', aspect: 0.5389, tag: [0.2819, 0.3434, 0.2236, 0.1004] as [number, number, number, number] },
  { id: 'v2c-shoes', name: 'Leather shoes', category: 'Footwear', aspect: 1.6565, tag: [0.7891, 0.4367, 0.1236, 0.1706] as [number, number, number, number] },
  { id: 'v2c-apparel', name: 'Formal shirt', category: 'Clothing', aspect: 0.9855, tag: [0.4991, 0.4347, 0.1591, 0.1307] as [number, number, number, number] },
  { id: 'v2c-pharma', name: 'Tablets', category: 'Medicines', aspect: 1.1427, tag: [0.1603, 0.2016, 0.1602, 0.1525] as [number, number, number, number] },
  { id: 'v2c-elec', name: 'Cable and switch', category: 'Electricals', aspect: 1.4116, tag: [0.1326, 0.4659, 0.1516, 0.1784] as [number, number, number, number] },
  { id: 'v2c-metal', name: 'Steel strip coil', category: 'Metal strips', aspect: 1.0346, tag: [0.4068, 0.2905, 0.1217, 0.1049] as [number, number, number, number] },
];


export const v2Products = {
  lub: { aspect: 0.5389, tag: [0.2819, 0.3434, 0.2236, 0.1004] as [number, number, number, number] },
  elec: { aspect: 1.4116, tag: [0.1326, 0.4659, 0.1516, 0.1784] as [number, number, number, number] },
  pharma: { aspect: 1.1427, tag: [0.1603, 0.2016, 0.1602, 0.1525] as [number, number, number, number] },
};

export const solutions = [
  {
    key: 'auth', name: 'Checko Authenticate', q: 'Is it real?',
    head: 'Your customers know it’s real, instantly.',
    body: 'A tactile 3D label, checked by AI that tells real depth from a flat copy. Any smartphone can scan it.',
    chips: ['Tactile 3D label', 'AI verification', 'Any smartphone'],
  },
  {
    key: 'engage', name: 'Checko Engage', q: 'Who bought it?',
    head: 'Speak to every customer after the scan.',
    body: 'The scan that proves it’s genuine opens a direct line to the buyer: warranty, demos and offers.',
    chips: ['Warranty registration', 'Demos and AR', 'Offers and cross-sell'],
  },
  {
    key: 'trace', name: 'Checko Trace', q: 'Where has it been?',
    head: 'Follow every product from line to shelf.',
    body: 'Link each unit to its carton and pallet, and follow it from factory to shop. Catch diversion early.',
    chips: ['Unit-to-pallet linking', 'Handheld scanning', 'Chain of custody'],
  },
  {
    key: 'insights', name: 'Checko Insights', q: 'What is the market telling you?',
    head: 'Turn every scan into market intelligence.',
    body: 'See where fakes appear and where genuine demand grows, region by region, with alerts when something looks wrong.',
    chips: ['Scans by region', 'Suspect-scan alerts', 'Scheduled reports'],
  },
] as const;

// img: public/assets/industries/<img>.webp (AI-generated studio shots, unbranded). Copy from the concept file.
export const useCases = {
  auth: 'Authentication', trace: 'Track and trace', geo: 'Geo-fencing', loyalty: 'Secure loyalty', warranty: 'Warranty registration', engage: 'Customer engagement',
} as const;
export type UseCase = keyof typeof useCases;

// copy from the concept sheet; use cases are the team's draft (only the ones that apply are shown)
export const industries: { img: string; name: string; who: string; risk: string; fit: string; uses: UseCase[] }[] = [
  { img: 'lub', name: 'Lubricants', who: 'Drivers and mechanics', risk: 'Fake oil wrecks engines.', fit: 'Authenticate every can, and reward the mechanics who recommend the real thing.', uses: ['auth', 'trace', 'geo', 'loyalty', 'engage'] },
  { img: 'agro', name: 'Agrochemicals & seeds', who: 'Farmers', risk: 'Fake inputs destroy crops and farmer incomes.', fit: 'Farmer-friendly scans in local languages, with rewards for buying genuine.', uses: ['auth', 'trace', 'geo', 'loyalty', 'engage'] },
  { img: 'auto', name: 'Automotive spares', who: 'Drivers and fleets', risk: 'Counterfeit spares put drivers at risk.', fit: 'Verification for mechanics and fleets, plus traceability from plant to workshop.', uses: ['auth', 'trace', 'loyalty', 'warranty', 'engage'] },
  { img: 'elec', name: 'Electricals & building', who: 'Families at home', risk: 'Fake wires and switches cause fires.', fit: 'Authentication and digital warranty registration in a single scan.', uses: ['auth', 'loyalty', 'warranty', 'engage'] },
  { img: 'pharma', name: 'Pharma & healthcare', who: 'Patients', risk: 'Fake medicines harm patients.', fit: 'Unit-level authentication and traceability, checkable at the pharmacy counter.', uses: ['auth', 'trace', 'geo', 'engage'] },
  { img: 'fmcg', name: 'FMCG', who: 'Everyday shoppers', risk: 'High-volume fakes slip onto shop shelves.', fit: 'Scan-to-verify with loyalty rewards that bring shoppers back to the real brand.', uses: ['auth', 'trace', 'geo', 'loyalty', 'engage'] },
  { img: 'apparel', name: 'Apparel & textiles', who: 'Shoppers', risk: 'Fake brand tags pass for the real thing.', fit: 'Woven-in or swing-tag labels that shoppers can check in seconds.', uses: ['auth', 'engage'] },
  { img: 'ecom', name: 'E-commerce', who: 'Online buyers', risk: 'Deliveries get opened and swapped on the way.', fit: 'Tamper-evident security tape and labels for every parcel.', uses: ['auth', 'trace'] },
  { img: 'docs', name: 'Documents', who: 'Students and institutions', risk: 'Certificates and official papers get forged.', fit: 'Tamper-proof seals that anyone can verify.', uses: ['auth'] },
];

// Figures retained from the supplied concept. Confirm with the Checko team before launch.
export const proof = [
  { value: '400M+', label: 'products protected' },
  { value: 'IIT Kanpur', label: 'where Checko was born', prefix: true },
  { value: '10+', label: 'industries' },
];
