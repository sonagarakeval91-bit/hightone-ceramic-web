import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Star,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { BlogCategory, BlogPost, CategoryMeta } from '../../types';
import { SiteMediaMap } from '../../services/googleSheetsService';
import { BLOG_CATEGORIES, estimateReadTimeMinutes, formatBlogDate, slugifyBlogTitle } from '../../data/blogPosts';
import { parseBlogMarkdown, resolveBlogCoverImage } from '../../utils/blogMarkdown';
import { compressBlogImageFile, inspectBlogImageUrl } from '../../utils/blogImageUpload';
import { ConfirmDialogConfig } from './adminTypes';

interface AdminBlogPanelProps {
  blogPosts: BlogPost[];
  categoriesList: CategoryMeta[];
  siteMedia: SiteMediaMap;
  onSavePost: (post: BlogPost) => { success: boolean; message: string; savedPost?: BlogPost };
  onDeletePost: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onRestoreStarterPosts: () => { addedCount: number };
  onRequestConfirm: (config: ConfirmDialogConfig) => void;
  onCopyUrl: (url: string) => void;
  onNotify: (type: 'success' | 'info' | 'warning' | 'error', title: string, message: string) => void;
}

const COVER_PRESETS = [
  { label: 'One Piece Closet', value: '/og-image/one-piece.jpg' },
  { label: 'Wall Hung Suite', value: '/og-image/wall-hung.jpg' },
  { label: 'Table Top Basin', value: '/og-image/table-top.jpg' },
  { label: 'Pedestal Basin', value: '/og-image/pedestal.jpg' },
  { label: 'Factory B2B Dispatch', value: '/og-image/b2b.jpg' },
  { label: 'Tunnel Kiln Plant', value: '/og-image/about.jpg' },
  { label: 'Showroom Catalog', value: '/og-image/collections.jpg' }
];

function createEmptyPost(): BlogPost {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `blog-${Date.now().toString(36)}`,
    slug: '',
    title: '',
    excerpt: '',
    category: 'Technical Specs',
    coverImage: '/og-image/one-piece.jpg',
    coverImageAlt: '',
    author: 'Hightone Ceramic Engineering Desk',
    publishedAt: today,
    updatedAt: today,
    readTimeMinutes: 4,
    status: 'draft',
    featured: false,
    content: `## Key Takeaways for Sanitaryware Buyers\n\nWrite a clear, factory-backed introduction tailored for dealers, builders, and architects.\n\n## Technical Specifications\n\n| Parameter | Standard Specification | Benefit |\n| --- | --- | --- |\n| Vitrification | 1200°C Tunnel Kiln | < 0.5% water absorption |\n| Packing | 5-Ply Corrugated Box | Safe interstate FTL transit |\n\n- Add actionable checklist items here.\n- Highlight exact dimensions, trap distances, or load ratings.\n\n> Factory Tip: Share a practical recommendation directly from the Thangadh engineering desk.`,
    relatedCollectionIds: ['one-piece'],
    seoTitle: '',
    seoDescription: '',
    seoKeywords: ''
  };
}

export const AdminBlogPanel: React.FC<AdminBlogPanelProps> = ({
  blogPosts,
  categoriesList,
  siteMedia,
  onSavePost,
  onDeletePost,
  onToggleStatus,
  onRestoreStarterPosts,
  onRequestConfirm,
  onCopyUrl,
  onNotify
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');

  // Cover & inline image upload state
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const inlineFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [showInlineImagePanel, setShowInlineImagePanel] = useState(false);
  const [inlineImageUrl, setInlineImageUrl] = useState('');
  const [inlineImageAlt, setInlineImageAlt] = useState('');
  const [isUploadingInline, setIsUploadingInline] = useState(false);

  const counts = useMemo(() => {
    const published = blogPosts.filter((p) => p.status === 'published').length;
    return {
      total: blogPosts.length,
      published,
      draft: blogPosts.length - published
    };
  }, [blogPosts]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...blogPosts]
      .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
      .filter((post) => {
        if (statusFilter !== 'all' && post.status !== statusFilter) return false;
        if (!q) return true;
        return (
          post.title.toLowerCase().includes(q) ||
          post.slug.toLowerCase().includes(q) ||
          post.category.toLowerCase().includes(q) ||
          (post.seoKeywords || '').toLowerCase().includes(q)
        );
      });
  }, [blogPosts, statusFilter, searchQuery]);

  const handleStartCreate = () => {
    setEditingPost(createEmptyPost());
    setSlugTouched(false);
    setEditorTab('write');
  };

  const handleStartEdit = (post: BlogPost) => {
    setEditingPost({ ...post, relatedCollectionIds: [...(post.relatedCollectionIds || [])] });
    setSlugTouched(true);
    setEditorTab('write');
  };

  const handleSubmitEditor = (targetStatus?: 'published' | 'draft') => {
    if (!editingPost) return;
    const payload: BlogPost = {
      ...editingPost,
      status: targetStatus || editingPost.status
    };
    const res = onSavePost(payload);
    if (res.success) {
      onNotify('success', 'Guide Saved', res.message);
      setEditingPost(null);
    } else {
      onNotify('error', 'Validation Error', res.message);
    }
  };

  const insertMarkdownSnippet = (snippet: string) => {
    if (!editingPost) return;
    setEditingPost({
      ...editingPost,
      content: `${editingPost.content.trimEnd()}\n\n${snippet}`
    });
  };

  const toggleRelatedCollection = (colId: string) => {
    if (!editingPost) return;
    const exists = editingPost.relatedCollectionIds.includes(colId);
    setEditingPost({
      ...editingPost,
      relatedCollectionIds: exists
        ? editingPost.relatedCollectionIds.filter((id) => id !== colId)
        : [...editingPost.relatedCollectionIds, colId]
    });
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editingPost) return;

    setIsUploadingCover(true);
    try {
      const compressed = await compressBlogImageFile(file, {
        maxWidth: 1200,
        maxHeight: 800,
        targetMaxBytes: 90_000
      });
      setEditingPost((prev) =>
        prev
          ? {
              ...prev,
              coverImage: compressed.dataUrl,
              coverImageAlt:
                prev.coverImageAlt ||
                prev.title ||
                file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
            }
          : prev
      );
      onNotify(
        'success',
        'Cover Photo Uploaded',
        `Optimized to ${compressed.width}×${compressed.height} (${compressed.sizeKb} KB). Save article to publish.`
      );
    } catch (err) {
      onNotify(
        'error',
        'Upload Failed',
        err instanceof Error ? err.message : 'Could not process the selected image.'
      );
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleCoverUrlChange = (rawVal: string) => {
    if (!editingPost) return;
    const inspection = inspectBlogImageUrl(rawVal);
    const shouldAutoConvert =
      inspection.kind === 'google-drive' || inspection.kind === 'google-search';
    setEditingPost({
      ...editingPost,
      coverImage: shouldAutoConvert ? inspection.normalizedUrl : rawVal
    });
  };

  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploadingInline(true);
    try {
      const compressed = await compressBlogImageFile(file, {
        maxWidth: 960,
        maxHeight: 680,
        targetMaxBytes: 65_000
      });
      setInlineImageUrl(compressed.dataUrl);
      if (!inlineImageAlt.trim()) {
        setInlineImageAlt(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
      }
      onNotify(
        'success',
        'Inline Photo Ready',
        `Optimized to ${compressed.sizeKb} KB. Click "Insert into Article" to place it in your guide.`
      );
    } catch (err) {
      onNotify(
        'error',
        'Upload Failed',
        err instanceof Error ? err.message : 'Could not process the selected image.'
      );
    } finally {
      setIsUploadingInline(false);
    }
  };

  const handleInsertInlineImage = () => {
    const inspection = inspectBlogImageUrl(inlineImageUrl);
    if (!inspection.normalizedUrl || inspection.kind === 'invalid' || inspection.kind === 'empty') {
      onNotify('error', 'Invalid Image', inspection.notice || 'Upload an image or paste a valid Google / HTTPS image link.');
      return;
    }
    if (inspection.kind === 'google-photos-share') {
      onNotify('warning', 'Use Direct Image Address', inspection.notice || 'Right-click the image and copy its direct image address.');
      return;
    }
    const safeAlt = (inlineImageAlt.trim() || 'Hightone Ceramic technical guide photo').replace(/[\[\]]/g, '');
    insertMarkdownSnippet(`![${safeAlt}](${inspection.normalizedUrl})`);
    setInlineImageUrl('');
    setInlineImageAlt('');
    setShowInlineImagePanel(false);
    onNotify('success', 'Image Inserted', 'Added image block to the article body.');
  };

  // =========================================================================
  // EDITOR MODE
  // =========================================================================
  if (editingPost) {
    const previewCover = resolveBlogCoverImage(editingPost.coverImage, categoriesList, siteMedia);
    const coverInspection = inspectBlogImageUrl(editingPost.coverImage);
    const isUploadedCover = editingPost.coverImage.startsWith('data:image/');
    const liveReadMins = estimateReadTimeMinutes(editingPost.content);
    const computedSlug = slugifyBlogTitle(editingPost.slug || editingPost.title);
    const parsedPreview = editorTab === 'preview' ? parseBlogMarkdown(editingPost.content) : null;

    return (
      <div className="space-y-5">
        {/* Top Editor Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setEditingPost(null)}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 cursor-pointer"
              aria-label="Back to articles list"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                Blog &amp; Technical Guides CMS
              </p>
              <h1 className="font-display font-bold text-xl text-slate-900">
                {blogPosts.some((p) => p.id === editingPost.id) ? 'Edit Article' : 'New Technical Guide'}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmitEditor('draft')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => handleSubmitEditor('published')}
              className="px-4 py-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save &amp; Publish Live</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 8 cols: Article Copy & Cover */}
          <div className="lg:col-span-8 space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800 block">
                  Article Headline (H1) *
                </label>
                <input
                  type="text"
                  value={editingPost.title}
                  onChange={(e) => {
                    const nextTitle = e.target.value;
                    setEditingPost({
                      ...editingPost,
                      title: nextTitle,
                      slug: slugTouched ? editingPost.slug : slugifyBlogTitle(nextTitle)
                    });
                  }}
                  placeholder="e.g., S-Trap vs. P-Trap One Piece Closets: Complete Rough-In Guide"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-700">URL Slug *</label>
                  <span className="font-mono text-[11px] text-slate-500 truncate max-w-[70%]">
                    https://hightoneceramic.com/blog/{computedSlug || 'your-slug'}
                  </span>
                </div>
                <input
                  type="text"
                  value={editingPost.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setEditingPost({
                      ...editingPost,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                    });
                  }}
                  placeholder="s-trap-vs-p-trap-one-piece-closet-guide"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Short Summary / Excerpt *
                </label>
                <textarea
                  rows={2}
                  value={editingPost.excerpt}
                  onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                  placeholder="2-sentence executive summary displayed on the /blog archive cards and social previews."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
            </div>

            {/* Cover Photo Selector: Upload OR Direct Google / Web Link */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-800 block">
                    Article Cover Image (Upload Photo or Paste Google Link)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Supports JPG/PNG/WebP upload, Google Drive links, Google Images direct links, or factory presets
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={coverFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingCover}
                    onClick={() => coverFileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-[#0F2E52] hover:bg-[#1e3a5f] disabled:opacity-60 text-white text-xs font-semibold rounded-lg inline-flex items-center space-x-1.5 cursor-pointer transition-colors"
                  >
                    {isUploadingCover ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{isUploadingCover ? 'Optimizing...' : 'Upload Image'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                <div className="sm:col-span-7 space-y-2.5">
                  {isUploadedCover ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                      <div className="flex items-center space-x-2 min-w-0 text-emerald-900">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-semibold truncate">
                          Uploaded Cover Photo ({Math.max(1, Math.round(editingPost.coverImage.length / 1024))} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPost({ ...editingPost, coverImage: '/og-image/one-piece.jpg' })}
                        className="text-[11px] font-semibold text-slate-600 hover:text-rose-600 inline-flex items-center space-x-1 cursor-pointer shrink-0"
                      >
                        <X className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Link2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={editingPost.coverImage}
                        onChange={(e) => handleCoverUrlChange(e.target.value)}
                        placeholder="Paste Google Drive share link, Google Image URL, or https://..."
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                      />
                    </div>
                  )}

                  {coverInspection.notice && !isUploadedCover && (
                    <div
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] flex items-start space-x-1.5 border ${
                        coverInspection.kind === 'google-photos-share' || coverInspection.kind === 'invalid'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-blue-50 border-blue-200 text-blue-900'
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{coverInspection.notice}</span>
                    </div>
                  )}

                  <input
                    type="text"
                    value={editingPost.coverImageAlt}
                    onChange={(e) => setEditingPost({ ...editingPost, coverImageAlt: e.target.value })}
                    placeholder="Image Alt Text / Caption (important for Google Images SEO)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                  />

                  <div className="space-y-1 pt-0.5">
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Or choose a Factory Preset:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {COVER_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setEditingPost({ ...editingPost, coverImage: preset.value })}
                          className={`px-2 py-1 text-[11px] font-medium rounded border cursor-pointer transition-colors ${
                            editingPost.coverImage === preset.value
                              ? 'bg-[#0F2E52] text-white border-[#0F2E52]'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-5 space-y-1.5">
                  <div className="aspect-16/10 bg-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    <img
                      src={previewCover.primarySrc}
                      alt={editingPost.coverImageAlt || editingPost.title || 'Cover preview'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-snug">
                    Tip: For Google Images, right-click any image → <strong>Copy image address</strong> and paste above. For Google Drive, set sharing to <em>Anyone with the link</em>.
                  </p>
                </div>
              </div>
            </div>

            {/* Body Content Editor with Write / Live Preview Tabs */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setEditorTab('write')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                      editorTab === 'write'
                        ? 'bg-[#0F2E52] text-white'
                        : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    Write Content
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('preview')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                      editorTab === 'preview'
                        ? 'bg-[#0F2E52] text-white'
                        : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    Live Preview
                  </button>
                </div>

                {editorTab === 'write' && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => insertMarkdownSnippet('## New Section Heading\n\nSection explanation goes here.')}
                      className="px-2 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded text-slate-700 font-semibold cursor-pointer"
                    >
                      + H2
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        insertMarkdownSnippet(
                          '| Spec | Value | Notes |\n| --- | --- | --- |\n| Rough-In | 220mm / 300mm | Finished wall |'
                        )
                      }
                      className="px-2 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded text-slate-700 font-semibold cursor-pointer"
                    >
                      + Table
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdownSnippet('- **Key Point**: Add concise detail here.\n- **Second Point**: Add detail here.')}
                      className="px-2 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded text-slate-700 font-semibold cursor-pointer"
                    >
                      + List
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdownSnippet('> Factory Tip: Share a practical specification tip for buyers.')}
                      className="px-2 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded text-slate-700 font-semibold cursor-pointer"
                    >
                      + Quote
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInlineImagePanel((prev) => !prev)}
                      className={`px-2 py-1 border rounded font-semibold inline-flex items-center space-x-1 cursor-pointer transition-colors ${
                        showInlineImagePanel
                          ? 'bg-[#0F2E52] text-white border-[#0F2E52]'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <ImageIcon className="w-3 h-3" />
                      <span>+ Image</span>
                    </button>
                    <span className="text-slate-500 font-mono tabular-nums ml-1">
                      ~{liveReadMins} min read
                    </span>
                  </div>
                )}
              </div>

              {editorTab === 'write' ? (
                <div className="p-4 space-y-3">
                  {showInlineImagePanel && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Insert Image into Article Body (Upload or Google Link)
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowInlineImagePanel(false)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          aria-label="Close image inserter"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          ref={inlineFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleInlineImageUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={isUploadingInline}
                          onClick={() => inlineFileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                        >
                          {isUploadingInline ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <span>{isUploadingInline ? 'Optimizing...' : 'Upload Photo'}</span>
                        </button>

                        <input
                          type="text"
                          value={inlineImageUrl.startsWith('data:image/') ? 'Uploaded photo ready' : inlineImageUrl}
                          readOnly={inlineImageUrl.startsWith('data:image/')}
                          onChange={(e) => {
                            const val = e.target.value;
                            const insp = inspectBlogImageUrl(val);
                            setInlineImageUrl(
                              insp.kind === 'google-drive' || insp.kind === 'google-search'
                                ? insp.normalizedUrl
                                : val
                            );
                          }}
                          placeholder="Or paste Google Drive / Google Image / https:// URL..."
                          className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={inlineImageAlt}
                          onChange={(e) => setInlineImageAlt(e.target.value)}
                          placeholder="Image caption / alt text (e.g., S-trap 220mm floor outlet diagram)"
                          className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={handleInsertInlineImage}
                          className="px-3.5 py-1.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-semibold rounded-lg cursor-pointer shrink-0"
                        >
                          Insert into Article
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    rows={16}
                    value={editingPost.content}
                    onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                    placeholder="Use ## for headings, - for bullets, 1. for numbered steps, | col | col | for spec tables, > for pull quotes, ![caption](url) for images, and **bold** for highlights."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono leading-relaxed text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
              ) : (
                <div className="p-6 max-w-3xl space-y-4 text-sm leading-relaxed text-slate-700">
                  {parsedPreview?.blocks.map((block, idx) => {
                    if (block.type === 'h2') {
                      return (
                        <h2 key={idx} className="font-display text-xl font-bold text-[#0F2E52] pt-2">
                          {block.text}
                        </h2>
                      );
                    }
                    if (block.type === 'h3') {
                      return (
                        <h3 key={idx} className="font-display text-base font-bold text-[#0F2E52]">
                          {block.text}
                        </h3>
                      );
                    }
                    if (block.type === 'image') {
                      return (
                        <figure key={idx} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <img
                            src={block.url}
                            alt={block.alt || editingPost.title}
                            referrerPolicy="no-referrer"
                            className="w-full max-h-80 object-cover block"
                          />
                          {block.alt && (
                            <figcaption className="px-3 py-2 text-xs text-slate-500 border-t border-slate-200">
                              {block.alt}
                            </figcaption>
                          )}
                        </figure>
                      );
                    }
                    if (block.type === 'quote') {
                      return (
                        <blockquote key={idx} className="py-3 border-y border-slate-300 text-[#0F2E52] font-medium">
                          {block.text}
                        </blockquote>
                      );
                    }
                    if (block.type === 'table') {
                      return (
                        <div key={idx} className="overflow-x-auto border border-slate-200 rounded">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                {block.headers.map((h, i) => (
                                  <th key={i} className="py-2 px-3 font-bold text-[#0F2E52]">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {block.rows.map((r, ri) => (
                                <tr key={ri}>
                                  {r.map((cell, ci) => (
                                    <td key={ci} className="py-2 px-3 tabular-nums">
                                      {cell}
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
                        <ul key={idx} className="list-disc pl-5 space-y-1">
                          {block.items.map((item, ii) => (
                            <li key={ii}>{item}</li>
                          ))}
                        </ul>
                      );
                    }
                    if (block.type === 'ol') {
                      return (
                        <ol key={idx} className="list-decimal pl-5 space-y-1">
                          {block.items.map((item, ii) => (
                            <li key={ii}>{item}</li>
                          ))}
                        </ol>
                      );
                    }
                    return <p key={idx}>{block.text}</p>;
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right 4 cols: Metadata, Linked Collections & SEO */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
                Publishing Settings
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 block">Status</label>
                  <select
                    value={editingPost.status}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        status: e.target.value === 'draft' ? 'draft' : 'published'
                      })
                    }
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                  >
                    <option value="published">Published (Live)</option>
                    <option value="draft">Draft (Hidden)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 block">Topic Category</label>
                  <select
                    value={editingPost.category}
                    onChange={(e) =>
                      setEditingPost({ ...editingPost, category: e.target.value as BlogCategory })
                    }
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                  >
                    {BLOG_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 block">Publish Date</label>
                  <input
                    type="date"
                    value={editingPost.publishedAt}
                    onChange={(e) => setEditingPost({ ...editingPost, publishedAt: e.target.value })}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 block">Author Desk</label>
                  <input
                    type="text"
                    value={editingPost.author}
                    onChange={(e) => setEditingPost({ ...editingPost, author: e.target.value })}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                  />
                </div>
              </div>

              <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editingPost.featured)}
                  onChange={(e) => setEditingPost({ ...editingPost, featured: e.target.checked })}
                  className="rounded border-slate-300 text-[#0F2E52]"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Pin as Featured Lead Spotlight on /blog
                </span>
              </label>
            </div>

            {/* Linked Collections for Internal SEO */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Linked Product Collections
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Shown in the article sidebar to pass SEO authority to collection pages.
                </p>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {categoriesList.map((cat) => {
                  const checked = editingPost.relatedCollectionIds.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'bg-blue-50/70 border-blue-200 text-slate-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{cat.title}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRelatedCollection(cat.id)}
                        className="rounded border-slate-300 text-blue-600 shrink-0 ml-2"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Search Engine Metadata */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
                SEO &amp; Google Snippet
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <label className="font-semibold text-slate-700">SEO Title</label>
                  <span className="font-mono tabular-nums text-slate-400">
                    {(editingPost.seoTitle || editingPost.title).length} / 60
                  </span>
                </div>
                <input
                  type="text"
                  value={editingPost.seoTitle || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, seoTitle: e.target.value })}
                  placeholder="Optional custom title tag"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <label className="font-semibold text-slate-700">Meta Description</label>
                  <span className="font-mono tabular-nums text-slate-400">
                    {(editingPost.seoDescription || editingPost.excerpt).length} / 160
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={editingPost.seoDescription || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, seoDescription: e.target.value })}
                  placeholder="Optional search description (defaults to excerpt)"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 block">Target Keywords</label>
                <input
                  type="text"
                  value={editingPost.seoKeywords || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, seoKeywords: e.target.value })}
                  placeholder="comma, separated, b2b keywords"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                />
              </div>

              {/* Google Search Preview */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="text-[11px] text-slate-600 truncate">
                  hightoneceramic.com › blog › {computedSlug || 'guide'}
                </div>
                <div className="text-sm text-[#1a0dab] font-medium line-clamp-1">
                  {editingPost.seoTitle || editingPost.title || 'Article Headline'}
                </div>
                <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                  {editingPost.seoDescription || editingPost.excerpt || 'Article summary appears here in Google Search results.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // LIST MODE
  // =========================================================================
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
            Content SEO &amp; Technical Guides
          </p>
          <h1 className="font-display font-bold text-2xl text-slate-900">
            Blog &amp; Guides Manager
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Publish factory technical guides synced live via Firestore. Every published post automatically appears at <code>/blog/&lt;slug&gt;</code>, updates <code>/sitemap.xml</code>, and generates LinkedIn/WhatsApp preview cards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              const res = onRestoreStarterPosts();
              if (res.addedCount > 0) {
                onNotify('success', 'Starter Guides Restored', `Added ${res.addedCount} missing starter guide(s).`);
              } else {
                onNotify('info', 'All Starter Guides Present', 'All 6 B2B starter guides are already in your blog.');
              }
            }}
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Starters</span>
          </button>

          <button
            type="button"
            onClick={handleStartCreate}
            className="px-4 py-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Guide</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'all', label: `All (${counts.total})` },
              { id: 'published', label: `Published (${counts.published})` },
              { id: 'draft', label: `Drafts (${counts.draft})` }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[#0F2E52] text-white border-[#0F2E52]'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter articles by title or slug..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
          />
        </div>
      </div>

      {/* Articles List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredPosts.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <BookOpen className="w-7 h-7 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-600 font-medium">No articles match this filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPosts.map((post) => {
              const cover = resolveBlogCoverImage(post.coverImage, categoriesList, siteMedia);
              const liveUrl = `https://hightoneceramic.com/blog/${post.slug}`;
              return (
                <div
                  key={post.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-24 h-16 bg-slate-100 border border-slate-200 rounded-lg overflow-hidden shrink-0 hidden sm:block">
                      <img
                        src={cover.primarySrc}
                        alt={post.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                        <span
                          className={
                            post.status === 'published' ? 'text-emerald-700' : 'text-amber-700'
                          }
                        >
                          {post.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-600">{post.category}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 tabular-nums">
                          {formatBlogDate(post.publishedAt)} · {post.readTimeMinutes} min
                        </span>
                        {post.featured && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-blue-700 inline-flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-blue-600 text-blue-600" />
                              Featured
                            </span>
                          </>
                        )}
                      </div>
                      <div className="font-display font-bold text-sm text-slate-900 line-clamp-1">
                        {post.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 truncate">
                        /blog/{post.slug}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(post)}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center space-x-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onToggleStatus(post.id);
                        onNotify(
                          'info',
                          post.status === 'published' ? 'Moved to Draft' : 'Published Live',
                          `"${post.title}" is now ${post.status === 'published' ? 'hidden as draft' : 'live on /blog'}.`
                        );
                      }}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center space-x-1 cursor-pointer"
                      title={post.status === 'published' ? 'Unpublish to Draft' : 'Publish Live'}
                    >
                      {post.status === 'published' ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                          <span>Unpublish</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Publish</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onCopyUrl(liveUrl)}
                      className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-lg cursor-pointer"
                      title="Copy Live Article URL"
                      aria-label="Copy Live Article URL"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <a
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-lg"
                      title="Open Live Article"
                      aria-label="Open Live Article"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() =>
                        onRequestConfirm({
                          title: 'Delete Blog Guide',
                          message: `Permanently delete "${post.title}"? This will remove /blog/${post.slug} from your website and sitemap.`,
                          confirmLabel: 'Delete Guide',
                          tone: 'danger',
                          onConfirm: () => {
                            onDeletePost(post.id);
                            onNotify('info', 'Guide Deleted', `"${post.title}" has been removed.`);
                          }
                        })
                      }
                      className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-rose-600 rounded-lg cursor-pointer"
                      title="Delete Article"
                      aria-label="Delete Article"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick SEO Tip Footer */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start space-x-2.5 text-xs text-slate-600">
        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-900">Automatic Google &amp; Social Indexing:</strong> Every published guide is immediately served with server-side <code>BlogPosting</code> Schema.org JSON-LD, OpenGraph article previews, and included in <code>https://hightoneceramic.com/sitemap.xml</code>.
        </p>
      </div>
    </div>
  );
};
