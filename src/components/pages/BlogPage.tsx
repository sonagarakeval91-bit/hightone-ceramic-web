import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Link2,
  List,
  MessageSquare,
  Search,
  Share2,
  X
} from 'lucide-react';
import { BlogCategory, BlogPost, PageId } from '../../types';
import { useWebsiteData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { BLOG_CATEGORIES, formatBlogDate } from '../../data/blogPosts';
import { buildMergedCategoriesList } from './CollectionsPage';
import { parseBlogMarkdown, resolveBlogCoverImage } from '../../utils/blogMarkdown';
import { updateDocumentSeo } from '../../services/seoService';
import { trackEvent } from '../../services/analyticsService';

interface BlogPageProps {
  activeSlug: string | null;
  onSelectPost: (slug: string | null) => void;
  onNavigate: (page: PageId, category?: string) => void;
  onOpenQuote: (initialInterest?: string) => void;
}

const CANONICAL_ORIGIN = 'https://hightoneceramic.com';

function renderInlineFormattedText(text: string): React.ReactNode {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#0F2E52]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

interface CoverImageFrameProps {
  rawCoverImage: string;
  alt: string;
  categories: ReturnType<typeof buildMergedCategoriesList>;
  siteMedia: ReturnType<typeof useWebsiteData>['siteMedia'];
  className?: string;
  priority?: boolean;
}

const CoverImageFrame: React.FC<CoverImageFrameProps> = ({
  rawCoverImage,
  alt,
  categories,
  siteMedia,
  className = '',
  priority = false
}) => {
  const { primarySrc, fallbackSrc } = useMemo(
    () => resolveBlogCoverImage(rawCoverImage, categories, siteMedia),
    [rawCoverImage, categories, siteMedia]
  );
  const [src, setSrc] = useState(primarySrc);

  useEffect(() => {
    setSrc(primarySrc);
  }, [primarySrc]);

  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      referrerPolicy="no-referrer"
      onError={() => {
        if (src !== fallbackSrc) setSrc(fallbackSrc);
      }}
      className={className}
    />
  );
};

export const BlogPage: React.FC<BlogPageProps> = ({
  activeSlug,
  onSelectPost,
  onNavigate,
  onOpenQuote
}) => {
  const { blogPosts, collectionsMeta, siteMedia, products } = useWebsiteData();
  const { toastSuccess, toastError } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<'All' | BlogCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const categoriesList = useMemo(
    () => buildMergedCategoriesList(collectionsMeta, siteMedia, products),
    [collectionsMeta, siteMedia, products]
  );

  const publishedPosts = useMemo(
    () =>
      blogPosts
        .filter((p) => p.status === 'published')
        .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || '')),
    [blogPosts]
  );

  const activePost: BlogPost | null = useMemo(() => {
    if (!activeSlug) return null;
    const target = activeSlug.trim().toLowerCase();
    return publishedPosts.find((p) => p.slug.toLowerCase() === target) || null;
  }, [activeSlug, publishedPosts]);

  // Reading progress hairline on single-article view
  useEffect(() => {
    if (!activePost) {
      setScrollProgress(0);
      return;
    }
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setScrollProgress(0);
        return;
      }
      setScrollProgress(Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)));
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activePost]);

  // Dynamic SEO head & JSON-LD synchronization for /blog and /blog/:slug
  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : CANONICAL_ORIGIN;

    if (activePost) {
      const articleUrl = `${origin}/blog/${activePost.slug}`;
      const ogImageUrl = `${CANONICAL_ORIGIN}/og-image/blog-${encodeURIComponent(activePost.slug)}.jpg`;
      trackEvent('page_view', `Blog: ${activePost.title}`, activePost.slug, `blog/${activePost.slug}`);

      updateDocumentSeo({
        title: activePost.seoTitle || `${activePost.title} | Hightone Ceramic Blog`,
        description: activePost.seoDescription || activePost.excerpt,
        keywords:
          activePost.seoKeywords ||
          `${activePost.category.toLowerCase()}, sanitaryware technical guide, Hightone Ceramic Thangadh`,
        image: ogImageUrl,
        url: articleUrl,
        ogType: 'article',
        customSchema: {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'BlogPosting',
              headline: activePost.title,
              description: activePost.seoDescription || activePost.excerpt,
              image: ogImageUrl,
              datePublished: activePost.publishedAt,
              dateModified: activePost.updatedAt || activePost.publishedAt,
              articleSection: activePost.category,
              author: {
                '@type': 'Organization',
                name: activePost.author || 'Hightone Ceramic Engineering Desk',
                url: CANONICAL_ORIGIN
              },
              publisher: {
                '@type': 'Organization',
                name: 'Hightone Ceramic',
                url: CANONICAL_ORIGIN,
                logo: {
                  '@type': 'ImageObject',
                  url: `${CANONICAL_ORIGIN}/favicon-192x192.png`
                }
              },
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': `${CANONICAL_ORIGIN}/blog/${activePost.slug}`
              }
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: `${CANONICAL_ORIGIN}/` },
                { '@type': 'ListItem', position: 2, name: 'Blog', item: `${CANONICAL_ORIGIN}/blog` },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: activePost.title,
                  item: `${CANONICAL_ORIGIN}/blog/${activePost.slug}`
                }
              ]
            }
          ]
        }
      });
      return;
    }

    const blogIndexUrl = `${origin}/blog`;
    updateDocumentSeo({
      title: 'Sanitaryware Technical Guides & B2B Blog | Hightone Ceramic Thangadh',
      description:
        'Factory-authored technical guides on S-trap vs P-trap rough-ins, rimless vs siphonic flushing, 1200°C ceramic vitrification, and Thangadh B2B sanitaryware sourcing.',
      keywords:
        'sanitaryware blog India, S-trap vs P-trap guide, Thangadh sanitaryware sourcing, rimless toilet guide, sanitaryware dealership India, Hightone Ceramic',
      image: `${CANONICAL_ORIGIN}/og-image/blog.jpg`,
      url: blogIndexUrl,
      ogType: 'website',
      customSchema: {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'Hightone Ceramic Technical Guides & B2B Insights',
        description:
          'Technical sanitaryware installation manuals, vitreous quality standards, and Thangadh B2B dealership guides by Hightone Ceramic.',
        url: `${CANONICAL_ORIGIN}/blog`,
        publisher: {
          '@type': 'Organization',
          name: 'Hightone Ceramic',
          url: CANONICAL_ORIGIN
        }
      }
    });
  }, [activePost]);

  const handleCopyArticleUrl = async (slug: string) => {
    const shareUrl = `${CANONICAL_ORIGIN}/blog/${slug}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2400);
      toastSuccess('Article link copied for WhatsApp or LinkedIn sharing.', 'Link Copied');
    } catch {
      toastError('Could not copy link automatically.', 'Copy Failed');
    }
  };

  // =========================================================================
  // VIEW 1: SINGLE ARTICLE READER (/blog/:slug)
  // =========================================================================
  if (activeSlug) {
    if (!activePost) {
      return (
        <section className="bg-[#f7f9fb] py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#515f74]">
              Hightone Ceramic Journal
            </p>
            <h1 className="font-display text-3xl font-bold text-[#0F2E52] [text-wrap:balance]">
              Guide Not Found
            </h1>
            <p className="text-sm text-[#515f74] max-w-md mx-auto leading-relaxed">
              The article you opened may have been moved to draft or updated with a new URL. Browse all technical guides below.
            </p>
            <div className="pt-2">
              <a
                href="/blog"
                onClick={(e) => {
                  e.preventDefault();
                  onSelectPost(null);
                }}
                className="inline-flex items-center space-x-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-sm font-semibold px-5 py-2.5 rounded-[3px] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to All Guides</span>
              </a>
            </div>
          </div>
        </section>
      );
    }

    const { blocks, headings } = parseBlogMarkdown(activePost.content);
    const canonicalArticleUrl = `${CANONICAL_ORIGIN}/blog/${activePost.slug}`;
    const relatedCollections = activePost.relatedCollectionIds
      .map((colId) => categoriesList.find((c) => c.id === colId))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    const relatedPosts = publishedPosts
      .filter((p) => p.id !== activePost.id)
      .sort((a, b) => {
        const aSameCat = a.category === activePost.category ? 1 : 0;
        const bSameCat = b.category === activePost.category ? 1 : 0;
        return bSameCat - aSameCat;
      })
      .slice(0, 3);

    return (
      <article className="bg-[#f7f9fb] pb-20">
        {/* Reading Progress Hairline */}
        <div className="sticky top-18 z-30 h-[2px] w-full bg-slate-200/70">
          <div
            className="h-full bg-[#0F2E52] transition-[width] duration-75"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>

        {/* Editorial Article Masthead */}
        <header className="bg-white border-b border-[#e2e8f0]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10 lg:pt-12 lg:pb-12">
            {/* Breadcrumb Trail */}
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-[#515f74] mb-6">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('home');
                }}
                className="hover:text-[#0F2E52] transition-colors"
              >
                Home
              </a>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <a
                href="/blog"
                onClick={(e) => {
                  e.preventDefault();
                  onSelectPost(null);
                }}
                className="hover:text-[#0F2E52] transition-colors"
              >
                Blog
              </a>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[#0F2E52] font-medium">{activePost.category}</span>
            </nav>

            <div className="max-w-4xl space-y-5">
              {/* Zero-pill unboxed metadata kicker */}
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#515f74] flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-[#0F2E52]">{activePost.category}</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="tabular-nums">Updated {formatBlogDate(activePost.updatedAt || activePost.publishedAt)}</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="tabular-nums">{activePost.readTimeMinutes} min read</span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-bold tracking-tight text-[#0F2E52] leading-[1.15] [text-wrap:balance]">
                {activePost.title}
              </h1>

              <p className="text-base sm:text-lg text-[#515f74] leading-relaxed max-w-3xl">
                {activePost.excerpt}
              </p>

              {/* Byline & Share Utility Row */}
              <div className="pt-4 border-t border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-[#515f74]">
                  <span className="font-semibold text-[#0F2E52] block">{activePost.author}</span>
                  <span>Thangadh Manufacturing Cluster · Gujarat, India</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyArticleUrl(activePost.slug)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F2E52] bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] rounded-[3px] transition-colors cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Link2 className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
                  </button>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `*${activePost.title}*\n${activePost.excerpt}\n\nRead Guide: ${canonicalArticleUrl}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F2E52] bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] rounded-[3px] transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                    <span>WhatsApp</span>
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonicalArticleUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F2E52] bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] rounded-[3px] transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>LinkedIn</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Asymmetric 70/30 Reading Canvas */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 lg:pt-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            {/* Primary Reading Sheet (8 cols) */}
            <div className="lg:col-span-8 bg-white border border-[#e2e8f0] rounded-[4px] overflow-hidden">
              <figure className="border-b border-[#e2e8f0] bg-slate-100">
                <div className="aspect-16/9 w-full overflow-hidden">
                  <CoverImageFrame
                    rawCoverImage={activePost.coverImage}
                    alt={activePost.coverImageAlt || activePost.title}
                    categories={categoriesList}
                    siteMedia={siteMedia}
                    priority
                    className="w-full h-full object-cover"
                  />
                </div>
                {activePost.coverImageAlt && (
                  <figcaption className="px-6 py-2.5 bg-[#f8fafc] text-[11px] text-[#64748b] border-t border-[#e2e8f0]">
                    {activePost.coverImageAlt}
                  </figcaption>
                )}
              </figure>

              <div className="px-6 py-8 sm:px-10 sm:py-10">
                <div className="max-w-[70ch] space-y-6 text-[16px] leading-[1.75] text-[#334155]">
                  {blocks.map((block, idx) => {
                    if (block.type === 'h2') {
                      return (
                        <h2
                          key={idx}
                          id={block.id}
                          className="scroll-mt-28 font-display text-2xl font-bold text-[#0F2E52] tracking-tight pt-4 border-t border-[#f1f5f9] first:border-t-0 first:pt-0 [text-wrap:balance]"
                        >
                          {block.text}
                        </h2>
                      );
                    }

                    if (block.type === 'h3') {
                      return (
                        <h3
                          key={idx}
                          id={block.id}
                          className="scroll-mt-28 font-display text-lg font-bold text-[#0F2E52] pt-2"
                        >
                          {block.text}
                        </h3>
                      );
                    }

                    if (block.type === 'image') {
                      return (
                        <figure
                          key={idx}
                          className="my-7 border border-[#e2e8f0] rounded-[4px] overflow-hidden bg-[#f8fafc]"
                        >
                          <img
                            src={block.url}
                            alt={block.alt || activePost.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full max-h-[480px] object-cover block"
                          />
                          {block.alt && (
                            <figcaption className="px-4 py-2.5 text-xs text-[#64748b] border-t border-[#e2e8f0]">
                              {block.alt}
                            </figcaption>
                          )}
                        </figure>
                      );
                    }

                    if (block.type === 'quote') {
                      return (
                        <blockquote
                          key={idx}
                          className="my-7 py-5 border-y border-[#cbd5e1] text-[15px] leading-[1.7] text-[#0F2E52] font-medium"
                        >
                          {renderInlineFormattedText(block.text)}
                        </blockquote>
                      );
                    }

                    if (block.type === 'table') {
                      return (
                        <div key={idx} className="my-6 overflow-x-auto border border-[#e2e8f0] rounded-[3px]">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                                {block.headers.map((h, hIdx) => (
                                  <th
                                    key={hIdx}
                                    className="py-3 px-4 font-display font-bold text-xs uppercase tracking-wider text-[#0F2E52]"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e2e8f0]">
                              {block.rows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-[#f8fafc]/70">
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className={`py-3 px-4 align-top tabular-nums ${
                                        cIdx === 0 ? 'font-semibold text-[#0F2E52]' : 'text-[#334155]'
                                      }`}
                                    >
                                      {renderInlineFormattedText(cell)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    if (block.type === 'ul') {
                      return (
                        <ul key={idx} className="space-y-2.5 pl-5 list-disc marker:text-[#0F2E52]">
                          {block.items.map((item, iIdx) => (
                            <li key={iIdx} className="pl-1">
                              {renderInlineFormattedText(item)}
                            </li>
                          ))}
                        </ul>
                      );
                    }

                    if (block.type === 'ol') {
                      return (
                        <ol key={idx} className="space-y-2.5 pl-5 list-decimal marker:text-[#0F2E52] marker:font-semibold">
                          {block.items.map((item, iIdx) => (
                            <li key={iIdx} className="pl-1">
                              {renderInlineFormattedText(item)}
                            </li>
                          ))}
                        </ol>
                      );
                    }

                    return <p key={idx}>{renderInlineFormattedText(block.text)}</p>;
                  })}
                </div>

                {/* Bottom Article Footer Strip */}
                <div className="mt-12 pt-6 border-t border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <a
                    href="/blog"
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectPost(null);
                    }}
                    className="inline-flex items-center space-x-2 text-sm font-semibold text-[#0F2E52] hover:text-[#1e3a5f] transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>All Technical Guides</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => onOpenQuote(`Inquiry from Guide: ${activePost.title}`)}
                    className="inline-flex items-center justify-center space-x-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-sm font-semibold px-5 py-2.5 rounded-[3px] transition-colors cursor-pointer"
                  >
                    <span>Request Factory Spec Sheet &amp; Pricing</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Sticky Margin Rail (4 cols) */}
            <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
              {/* Auto-generated Table of Contents */}
              {headings.length > 0 && (
                <div className="bg-white border border-[#e2e8f0] rounded-[4px] p-5 space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-[0.12em] text-[#0F2E52] pb-2.5 border-b border-[#e2e8f0]">
                    <List className="w-3.5 h-3.5" />
                    <span>On This Page</span>
                  </div>
                  <nav aria-label="Article table of contents" className="space-y-2">
                    {headings.map((h) => (
                      <a
                        key={h.id}
                        href={`#${h.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          const el = document.getElementById(h.id);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className={`block text-xs leading-snug text-[#515f74] hover:text-[#0F2E52] transition-colors ${
                          h.level === 3 ? 'pl-3' : 'font-medium'
                        }`}
                      >
                        {h.text}
                      </a>
                    ))}
                  </nav>
                </div>
              )}

              {/* Related Sanitaryware Collections (Internal SEO Cross-Linking) */}
              {relatedCollections.length > 0 && (
                <div className="bg-white border border-[#e2e8f0] rounded-[4px] p-5 space-y-3.5">
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#0F2E52] pb-2.5 border-b border-[#e2e8f0]">
                    Related Collections
                  </div>
                  <div className="divide-y divide-[#f1f5f9]">
                    {relatedCollections.map((col) => (
                      <a
                        key={col.id}
                        href={`/collections/${col.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate('collections', col.id);
                        }}
                        className="group flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#0F2E52] group-hover:underline truncate">
                            {col.title}
                          </div>
                          <div className="text-xs text-[#64748b] truncate">
                            {col.subtitle}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0F2E52] group-hover:translate-x-0.5 transition-all shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Focused B2B Conversion Card */}
              <div className="bg-[#0F2E52] text-white rounded-[4px] p-6 space-y-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Thangadh Factory Direct
                </div>
                <h2 className="font-display text-lg font-bold leading-snug [text-wrap:balance]">
                  Planning a Dealership Stock Mix or Builder Project?
                </h2>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Get direct ex-factory pricing, mixed-category full-truckload loading plans, and CAD rough-in drawings from our Thangadh sales desk.
                </p>
                <div className="pt-1 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenQuote(`B2B Quote — ${activePost.category}`)}
                    className="w-full bg-white hover:bg-slate-100 text-[#0F2E52] text-xs font-bold py-2.5 px-4 rounded-[3px] transition-colors cursor-pointer"
                  >
                    Request Wholesale Quote
                  </button>
                  <a
                    href="/b2b"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('b2b');
                    }}
                    className="w-full text-center text-xs font-semibold text-slate-200 hover:text-white py-2 border border-white/25 hover:border-white/50 rounded-[3px] transition-colors"
                  >
                    Explore Dealer Portal
                  </a>
                </div>
              </div>
            </aside>
          </div>

          {/* Related Guides Footer */}
          {relatedPosts.length > 0 && (
            <section className="mt-16 pt-12 border-t border-[#e2e8f0] space-y-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#515f74] mb-1">
                    Continue Reading
                  </p>
                  <h2 className="font-display text-2xl font-bold text-[#0F2E52]">
                    More Technical &amp; B2B Guides
                  </h2>
                </div>
                <a
                  href="/blog"
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectPost(null);
                  }}
                  className="text-xs font-semibold text-[#0F2E52] hover:underline inline-flex items-center space-x-1"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedPosts.map((post) => (
                  <a
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectPost(post.slug);
                    }}
                    className="group bg-white border border-[#e2e8f0] hover:border-[#94a3b8] rounded-[4px] overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-0.5"
                  >
                    <div className="aspect-16/10 bg-slate-100 overflow-hidden border-b border-[#e2e8f0]">
                      <CoverImageFrame
                        rawCoverImage={post.coverImage}
                        alt={post.coverImageAlt || post.title}
                        categories={categoriesList}
                        siteMedia={siteMedia}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    </div>
                    <div className="p-5 flex-1 flex flex-col space-y-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#515f74] tabular-nums">
                        {post.category} · {post.readTimeMinutes} min read
                      </div>
                      <h3 className="font-display text-base font-bold text-[#0F2E52] leading-snug group-hover:text-[#1e3a5f] line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="text-xs text-[#515f74] leading-relaxed line-clamp-2 flex-1">
                        {post.excerpt}
                      </p>
                      <span className="pt-2 text-xs font-semibold text-[#0F2E52] inline-flex items-center space-x-1">
                        <span>Read Guide</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    );
  }

  // =========================================================================
  // VIEW 2: BLOG INDEX (/blog) — 3-Tier Editorial Hierarchy
  // =========================================================================
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isFiltered = selectedCategory !== 'All' || normalizedQuery.length > 0;

  const filteredPosts = publishedPosts.filter((post) => {
    if (selectedCategory !== 'All' && post.category !== selectedCategory) return false;
    if (!normalizedQuery) return true;
    const haystack = [
      post.title,
      post.excerpt,
      post.category,
      post.seoKeywords || '',
      post.author
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const featuredPost = !isFiltered
    ? publishedPosts.find((p) => p.featured) || publishedPosts[0] || null
    : null;

  const archivePosts = featuredPost
    ? filteredPosts.filter((p) => p.id !== featuredPost.id)
    : filteredPosts;

  return (
    <div className="bg-[#f7f9fb] pb-20">
      {/* Compact Editorial Masthead */}
      <section className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-10 lg:pt-14 lg:pb-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#515f74]">
                Hightone Ceramic Engineering &amp; B2B Journal
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-[#0F2E52] leading-[1.12] [text-wrap:balance]">
                Sanitaryware Technical Guides &amp; Factory Insights
              </h1>
              <p className="text-sm sm:text-base text-[#515f74] leading-relaxed max-w-2xl">
                Practical plumbing rough-in standards, 1200°C ceramic vitrification checks, and direct Thangadh dealership playbooks written for builders, architects, and wholesale partners.
              </p>
            </div>

            <div className="text-xs text-[#515f74] tabular-nums lg:text-right shrink-0">
              <div className="font-semibold text-[#0F2E52]">{publishedPosts.length} Published Guides</div>
              <div>Updated from Thangadh, Gujarat</div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-10">
        {/* Tier 1: Lead Featured Spotlight (Asymmetric 7/5 Split) */}
        {featuredPost && (
          <section aria-label="Featured guide">
            <a
              href={`/blog/${featuredPost.slug}`}
              onClick={(e) => {
                e.preventDefault();
                onSelectPost(featuredPost.slug);
              }}
              className="group grid grid-cols-1 lg:grid-cols-12 items-stretch bg-white border border-[#e2e8f0] hover:border-[#94a3b8] rounded-[4px] overflow-hidden transition-colors"
            >
              <div className="lg:col-span-7 bg-slate-100 overflow-hidden min-h-[240px] lg:min-h-[380px]">
                <CoverImageFrame
                  rawCoverImage={featuredPost.coverImage}
                  alt={featuredPost.coverImageAlt || featuredPost.title}
                  categories={categoriesList}
                  siteMedia={siteMedia}
                  priority
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
              </div>

              <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  {/* Zero-pill unboxed metadata */}
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#515f74] tabular-nums flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[#0F2E52]">Featured</span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>{featuredPost.category}</span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>{formatBlogDate(featuredPost.publishedAt)}</span>
                  </div>

                  <h2 className="font-display text-2xl sm:text-[1.75rem] font-bold text-[#0F2E52] leading-[1.2] tracking-tight group-hover:text-[#1e3a5f] [text-wrap:balance]">
                    {featuredPost.title}
                  </h2>

                  <p className="text-sm text-[#515f74] leading-relaxed">
                    {featuredPost.excerpt}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#e2e8f0] flex items-center justify-between">
                  <span className="text-xs text-[#64748b] tabular-nums">
                    {featuredPost.readTimeMinutes} min read
                  </span>
                  <span className="inline-flex items-center space-x-1.5 text-sm font-semibold text-[#0F2E52] group-hover:translate-x-0.5 transition-transform">
                    <span>Read Technical Guide</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </a>
          </section>
        )}

        {/* Tier 2: Topic Filter Bar & Search */}
        <section
          aria-label="Filter guides"
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0]"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {(['All', ...BLOG_CATEGORIES] as Array<'All' | BlogCategory>).map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-[3px] transition-colors cursor-pointer border ${
                    active
                      ? 'bg-[#0F2E52] text-white border-[#0F2E52]'
                      : 'bg-white text-[#515f74] border-[#cbd5e1] hover:border-[#0F2E52] hover:text-[#0F2E52]'
                  }`}
                >
                  {cat === 'All' ? 'All Guides' : cat}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rough-ins, kiln, B2B..."
              aria-label="Search blog guides"
              className="w-full pl-9 pr-8 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#191c1e] placeholder:text-slate-400 focus:outline-none focus:border-[#0F2E52]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0F2E52] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </section>

        {/* Tier 3: Editorial Archive Grid */}
        {archivePosts.length === 0 ? (
          <div className="bg-white border border-[#e2e8f0] rounded-[4px] py-14 px-6 text-center space-y-3">
            <BookOpen className="w-7 h-7 text-slate-300 mx-auto" />
            <h3 className="font-display text-lg font-bold text-[#0F2E52]">
              No matching guides found
            </h3>
            <p className="text-xs text-[#515f74] max-w-md mx-auto">
              Try a broader search term or switch back to all sanitaryware topics.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="mt-2 inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-[#0F2E52] hover:bg-[#1e3a5f] rounded-[3px] cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <section aria-label="Technical guides archive" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {archivePosts.map((post) => (
              <a
                key={post.id}
                href={`/blog/${post.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  onSelectPost(post.slug);
                }}
                className="group bg-white border border-[#e2e8f0] hover:border-[#94a3b8] rounded-[4px] overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-0.5"
              >
                <div className="aspect-16/10 bg-slate-100 overflow-hidden border-b border-[#e2e8f0]">
                  <CoverImageFrame
                    rawCoverImage={post.coverImage}
                    alt={post.coverImageAlt || post.title}
                    categories={categoriesList}
                    siteMedia={siteMedia}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                </div>

                <div className="p-6 flex-1 flex flex-col space-y-3">
                  {/* Zero-pill unboxed metadata kicker */}
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#515f74] tabular-nums">
                    {post.category} · {formatBlogDate(post.publishedAt)} · {post.readTimeMinutes} min
                  </div>

                  <h3 className="font-display text-lg font-bold text-[#0F2E52] leading-snug group-hover:text-[#1e3a5f] [text-wrap:balance]">
                    {post.title}
                  </h3>

                  <p className="text-xs sm:text-[13px] text-[#515f74] leading-relaxed line-clamp-3 flex-1">
                    {post.excerpt}
                  </p>

                  <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-xs font-semibold text-[#0F2E52]">
                    <span>Read Guide</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </a>
            ))}
          </section>
        )}

        {/* Bottom Direct-Factory B2B Strip */}
        <section className="bg-white border border-[#e2e8f0] rounded-[4px] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#515f74]">
              Direct Manufacturing Desk · Thangadh, Gujarat
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0F2E52] [text-wrap:balance]">
              Need Technical Specifications or Wholesale Rates for Your Next Project?
            </h2>
            <p className="text-xs sm:text-sm text-[#515f74] leading-relaxed">
              Request updated digital catalogs, rough-in templates, or mixed full-truckload pricing directly from Hightone Ceramic.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onOpenQuote('Technical Guide / B2B Inquiry')}
              className="bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-[3px] transition-colors cursor-pointer"
            >
              Get Factory Quote
            </button>
            <a
              href="/collections"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('collections', 'all');
              }}
              className="bg-white hover:bg-[#f8fafc] text-[#0F2E52] border border-[#cbd5e1] text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-[3px] transition-colors"
            >
              Browse Collections
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};
