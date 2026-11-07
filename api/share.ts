export default function handler(req: any, res: any) {
  const collection = String(req.query?.collection || req.query?.c || 'one-piece').toLowerCase().trim();

  const collectionsData: Record<string, { title: string; desc: string; image: string }> = {
    'one-piece': {
      title: 'One Piece Closets Manufacturer & B2B Wholesale | Hightone Ceramic',
      desc: 'Direct manufacturer of vitrified ceramic one piece closets in Thangadh, Gujarat. High-performance siphonic flush & concealed traps for wholesale dealers & builders.',
      image: 'https://images.unsplash.com/photo-1585060544812-6b45742d762f?auto=format&fit=crop&w=1200&h=630&q=80'
    },
    'wall-hung': {
      title: 'Wall Hung Closets Manufacturer & B2B Wholesale | Hightone Ceramic',
      desc: 'Direct manufacturer of rimless blind fix wall hung ceramic closets in Thangadh, Gujarat. 400kg load-tested floating suites for wholesale dealers.',
      image: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1200&h=630&q=80'
    },
    'table-top': {
      title: 'Table Top Vanity Basins Manufacturer | Hightone Ceramic Thangadh',
      desc: 'Designer countertop luxury ceramic art basins with razor-thin precision lip and nano-sheen glaze direct from Thangadh manufacturer.',
      image: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=1200&h=630&q=80'
    },
    'pedestal': {
      title: 'Full & Half Pedestal Basins | Hightone Ceramic Thangadh',
      desc: 'Freestanding ceramic basin sets with solid pedestals, integrated soap ledges, and pre-punched faucet holes.',
      image: 'https://images.unsplash.com/photo-160058515340-be6161a56a0c?auto=format&fit=crop&w=1200&h=630&q=80'
    },
    'floor-mount': {
      title: 'Floor Mount Water Closets | Hightone Ceramic Thangadh',
      desc: 'European water closets and couple suites engineered for heavy-duty residential and commercial installations.',
      image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&h=630&q=80'
    },
    'orissa-pan': {
      title: 'Orissa Pan & Indian Closets | Hightone Ceramic Thangadh',
      desc: '20" & 21" deep high-density vitrified squatting pans with aqua rim and integrated anti-slip textured footrests.',
      image: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&h=630&q=80'
    },
    'urinal': {
      title: 'Commercial Ceramic Urinals | Hightone Ceramic Thangadh',
      desc: 'Heavy-duty ceramic urinals for high-traffic washrooms with deep parabolic bowls and eco spreaders.',
      image: 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=1200&h=630&q=80'
    }
  };

  const meta = collectionsData[collection] || collectionsData['one-piece'];
  const targetUrl = `https://hightoneceramic.com/#collections/${collection}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title}</title>
  <meta name="description" content="${meta.desc}">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Hightone Ceramic">
  <meta property="og:title" content="${meta.title}">
  <meta property="og:description" content="${meta.desc}">
  <meta property="og:image" content="${meta.image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${targetUrl}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${meta.title}">
  <meta name="twitter:description" content="${meta.desc}">
  <meta name="twitter:image" content="${meta.image}">

  <meta http-equiv="refresh" content="0;url=${targetUrl}">
  <link rel="canonical" href="${targetUrl}">
</head>
<body style="font-family:sans-serif;text-align:center;padding:60px 20px;color:#0F2E52;background:#f7f9fb;">
  <h2 style="margin-bottom:12px;">Hightone Ceramic</h2>
  <p style="color:#64748b;margin-bottom:24px;">Opening ${meta.title}...</p>
  <p><a href="${targetUrl}" style="display:inline-block;padding:10px 20px;background:#0F2E52;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:600;">Click to view catalog</a></p>
  <script>
    window.location.replace("${targetUrl}");
  </script>
</body>
</html>`);
}
