export interface ServerlessBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  coverImage: string;
  coverImageAlt: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  readTimeMinutes: number;
  status: 'published' | 'draft';
  featured?: boolean;
  content: string;
  relatedCollectionIds: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

export const DEFAULT_SERVERLESS_BLOG_POSTS: ServerlessBlogPost[] = [
  {
    id: 'blog-s-trap-vs-p-trap',
    slug: 's-trap-vs-p-trap-one-piece-closet-guide',
    title: 'S-Trap vs. P-Trap One Piece Closets: Complete Rough-In & Plumbing Guide for Builders',
    excerpt:
      'Avoid costly slab re-coring and showroom returns. Compare 220mm vs. 300mm S-trap floor outlets against 180mm P-trap wall outlets with exact site tolerances for Indian apartments and villas.',
    category: 'Technical Specs',
    coverImage: '/og-image/one-piece.jpg',
    coverImageAlt: 'Hightone Ceramic vitrified one-piece water closet showing concealed trap profile',
    author: 'Hightone Ceramic Engineering Desk',
    publishedAt: '2026-04-12',
    updatedAt: '2026-04-18',
    readTimeMinutes: 6,
    status: 'published',
    featured: true,
    relatedCollectionIds: ['one-piece', 'floor-mount', 'wall-hung'],
    seoTitle: 'S-Trap vs P-Trap One Piece Closet Rough-In Guide (220mm / 300mm) | Hightone Ceramic',
    seoDescription:
      'Technical rough-in guide comparing S-trap (220mm/300mm) and P-trap (180mm) one piece closets for builders, plumbers, and sanitaryware dealers in India.',
    seoKeywords:
      'S-trap vs P-trap toilet, 220mm vs 300mm rough in distance, one piece closet installation guide, sanitaryware trap dimension India, Hightone Ceramic Thangadh',
    content:
      'Compare S-trap (220mm/300mm floor outlet) and P-trap (180mm wall outlet) one-piece water closets. Measure rough-in distances after wall tiling, verify 110mm UPVC flush pipe alignment, and match trap configurations for residential towers and villas directly from Hightone Ceramic Thangadh.'
  },
  {
    id: 'blog-source-from-thangadh',
    slug: 'source-sanitaryware-direct-from-thangadh-manufacturers',
    title: 'How to Source Vitreous Sanitaryware Direct from Thangadh Manufacturers',
    excerpt:
      'Why Thangadh, Gujarat produces over half of India’s ceramic sanitaryware—and how wholesale dealers and exporters structure direct factory orders, grading, and full-truckload dispatch.',
    category: 'Dealer & B2B',
    coverImage: '/og-image/b2b.jpg',
    coverImageAlt: 'Hightone Ceramic factory truckload dispatch and B2B sanitaryware supply in Thangadh Gujarat',
    author: 'Hightone B2B Supply Desk',
    publishedAt: '2026-04-08',
    updatedAt: '2026-04-16',
    readTimeMinutes: 7,
    status: 'published',
    featured: false,
    relatedCollectionIds: ['one-piece', 'table-top', 'pedestal', 'orissa-pan'],
    seoTitle: 'Source Sanitaryware Direct from Thangadh Manufacturers | B2B Guide | Hightone Ceramic',
    seoDescription:
      'Step-by-step B2B procurement guide to sourcing vitrified ceramic sanitaryware directly from Thangadh, Gujarat factories with grading, packing, and FTL freight math.',
    seoKeywords:
      'Thangadh sanitaryware manufacturers, buy sanitaryware direct from factory Gujarat, Thangadh ceramic wholesale rates, sanitaryware B2B truckload supply India',
    content:
      'Learn how wholesale dealers, builders, and international exporters source vitreous sanitaryware direct from Thangadh, Gujarat factories. Covers Uty vs S.Uty grading, 5-ply carton vs paper packing, 10-ton and 16-ton FTL load optimization, and Mundra Port container dispatch.'
  },
  {
    id: 'blog-rimless-vs-siphonic',
    slug: 'rimless-vs-siphonic-flush-toilet-comparison',
    title: 'Rimless vs. Siphonic Flush Systems: Which Toilet Fits Residential vs. Hotel Projects?',
    excerpt:
      'Compare direct rimless washdown hygiene against whisper-quiet siphonic vortex suction—water consumption, acoustic levels, maintenance, and plumbing pressure requirements explained.',
    category: 'Technical Specs',
    coverImage: '/og-image/wall-hung.jpg',
    coverImageAlt: 'Hightone Ceramic rimless wall-hung water closet for modern residential and hotel bathrooms',
    author: 'Hightone Ceramic Engineering Desk',
    publishedAt: '2026-04-04',
    updatedAt: '2026-04-14',
    readTimeMinutes: 5,
    status: 'published',
    featured: false,
    relatedCollectionIds: ['wall-hung', 'one-piece', 'floor-mount'],
    seoTitle: 'Rimless vs Siphonic Flush Toilet Comparison for Projects | Hightone Ceramic',
    seoDescription:
      'Engineering comparison of rimless direct-wash vs siphonic vortex toilets for Indian homes, hotels, and hospitals. Water saving, acoustics, and hygiene metrics.',
    seoKeywords:
      'rimless vs siphonic toilet, best flush system for hotels India, wall hung rimless WC, siphonic vortex one piece closet, Hightone Ceramic',
    content:
      'Engineering comparison of rimless direct-wash toilets and siphonic vortex water closets across dual-flush water consumption (3L/6L), acoustic comfort, hard-water scale resistance, and fully glazed internal trapways.'
  },
  {
    id: 'blog-vitrified-quality-test',
    slug: 'vitrified-ceramic-water-absorption-quality-test-guide',
    title: '1200°C Tunnel Kiln Vitrification & Water Absorption: How Dealers Verify Grade-A Ceramic',
    excerpt:
      'Learn the practical factory lab tests—water absorption below 0.5%, crazing autoclave resistance, 400kg static load verification, and warpage gauges—that separate export-grade sanitaryware from low-fired seconds.',
    category: 'Export & Quality',
    coverImage: '/og-image/about.jpg',
    coverImageAlt: 'Hightone Ceramic 120-meter tunnel kiln vitrification and ISO ceramic quality testing plant',
    author: 'Hightone Quality Assurance Lab',
    publishedAt: '2026-03-29',
    updatedAt: '2026-04-12',
    readTimeMinutes: 6,
    status: 'published',
    featured: false,
    relatedCollectionIds: ['one-piece', 'wall-hung', 'table-top'],
    seoTitle: 'Vitreous Ceramic Water Absorption (<0.5%) & Quality Tests | Hightone Ceramic',
    seoDescription:
      'How sanitaryware dealers and export buyers verify Grade-A vitreous china: 1200°C firing, <0.5% water absorption, crazing tests, and 400kg wall-hung load checks.',
    seoKeywords:
      'vitreous china water absorption test, IS 2556 sanitaryware standard, 1200C tunnel kiln ceramic, how to check ceramic toilet quality, Hightone Ceramic quality',
    content:
      'Verify true vitreous china sanitaryware with objective QA metrics: under 0.5% water absorption, 1200°C continuous tunnel kiln firing, thermal crazing checks, 400kg wall-hung load verification, and showroom ring/flatness inspections.'
  },
  {
    id: 'blog-sanitaryware-dealership-india',
    slug: 'how-to-start-sanitaryware-dealership-india',
    title: 'How to Start a Profitable Sanitaryware Dealership in India: Display, Stock & Logistics',
    excerpt:
      'A practical roadmap for building-material retailers and hardware entrepreneurs launching a sanitaryware showroom—covering space layout, opening SKU mix, margin structure, and direct factory supply.',
    category: 'Dealer & B2B',
    coverImage: '/og-image/collections.jpg',
    coverImageAlt: 'Hightone Ceramic showroom display of sanitaryware closets and table-top wash basins',
    author: 'Hightone Dealer Growth Desk',
    publishedAt: '2026-03-22',
    updatedAt: '2026-04-10',
    readTimeMinutes: 7,
    status: 'published',
    featured: false,
    relatedCollectionIds: ['one-piece', 'table-top', 'pedestal', 'urinal'],
    seoTitle: 'How to Start a Sanitaryware Dealership in India (Display & Stock Guide) | Hightone',
    seoDescription:
      'Complete guide to starting a ceramic sanitaryware dealership in India: showroom space planning, high-margin SKU mix, investment planning, and direct Thangadh sourcing.',
    seoKeywords:
      'how to start sanitaryware dealership India, sanitaryware showroom business plan, ceramic sanitaryware distributorship Gujarat, Hightone Ceramic dealer portal',
    content:
      'Practical roadmap for launching a sanitaryware showroom in India: 600–1,500 sq. ft. display design, balanced SKU stock mix across one-piece closets, table-top basins, pedestal sets, and urinals, GST/warehouse setup, and direct Thangadh factory supply.'
  },
  {
    id: 'blog-wash-basin-selection-guide',
    slug: 'table-top-vs-wall-hung-pedestal-wash-basin-guide',
    title: 'Choosing Countertop Table-Top vs. Wall-Hung & Pedestal Basins for Commercial Projects',
    excerpt:
      'Match the right basin architecture to hotels, offices, restaurants, and apartments—covering granite cutout sizing, tap-hole clearance, splash depth, and easy maintenance.',
    category: 'Installation',
    coverImage: '/og-image/table-top.jpg',
    coverImageAlt: 'Hightone Ceramic designer table-top countertop wash basin with slim ceramic rim',
    author: 'Hightone Ceramic Engineering Desk',
    publishedAt: '2026-03-15',
    updatedAt: '2026-04-06',
    readTimeMinutes: 5,
    status: 'published',
    featured: false,
    relatedCollectionIds: ['table-top', 'pedestal', 'urinal'],
    seoTitle: 'Table-Top vs Wall-Hung vs Pedestal Wash Basin Guide | Hightone Ceramic',
    seoDescription:
      'Compare countertop table-top basins, wall-hung half pedestals, and full pedestal wash basins for Indian commercial and residential projects with mounting heights.',
    seoKeywords:
      'table top vs pedestal wash basin, countertop basin installation height India, commercial washroom basin guide, ceramic art basin manufacturer Thangadh',
    content:
      'Compare countertop table-top art basins, wall-hung half-pedestal sets, and full-pedestal ceramic basins across granite counter height (700–730mm), faucet alignment, splash control, and commercial restroom maintenance.'
  }
];
