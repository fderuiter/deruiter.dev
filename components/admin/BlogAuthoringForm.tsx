"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CONTENT_PILLARS, type ContentPillar } from "@/lib/blog/types";
import { RichNarrative } from "@/components/RichNarrative";
import {
  IconDeviceFloppy,
  IconSend,
  IconTrash,
  IconEye,
  IconEdit,
  IconArrowLeft,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import Link from "next/link";
import { apiClient, type ApiClientResponse } from "@/lib/api-client";
import {
  BlogDraftCreateSchema,
  BlogDraftUpdateSchema,
  toFieldErrors,
} from "@/lib/schemas";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface BlogPostFormData {
  id?: string;
  title: string;
  slug: string;
  dek: string;
  body: string;
  pillar: ContentPillar;
  tags: string;
  hero_image_url?: string | null;
  published?: boolean;
}

interface BlogMutationResponse {
  data?: { id?: string };
}

/** Throws the server's envelope message, or `fallback` when it sent none. */
function throwIfFailed<T>(res: ApiClientResponse<T>, fallback: string): void {
  if (!res.ok) {
    throw new Error(res.error || res.details[0]?.message || fallback);
  }
}

/**
 * Editable fields in visual order, mapped to their input ids, so the first
 * invalid one can take focus and each error can be tied to its input.
 */
const FIELD_INPUT_IDS = [
  ["title", "blog-title"],
  ["slug", "blog-slug"],
  ["pillar", "blog-pillar"],
  ["dek", "blog-dek"],
  ["tags", "blog-tags"],
  ["heroImageUrl", "blog-hero-url"],
  ["body", "blog-body"],
] as const;

type BlogFormField = (typeof FIELD_INPUT_IDS)[number][0];

const INPUT_BASE_CLASS =
  "w-full px-3 py-2 rounded bg-[#13151a] border text-zinc-100 focus:outline-none";

/** Border classes for an input, red while its field has an error. */
function borderClass(hasError: boolean): string {
  return hasError
    ? "border-red-500/60 focus:border-red-500"
    : "border-white/10 focus:border-amber-500";
}

/** The inline message for one field, referenced by its input's aria-describedby. */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="text-[11px] font-mono text-red-400">
      {message}
    </span>
  );
}

interface BlogAuthoringFormProps {
  initialData?: BlogPostFormData;
  isNew?: boolean;
}

export function BlogAuthoringForm({
  initialData,
  isNew = false,
}: BlogAuthoringFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [manualSlug, setManualSlug] = useState(!isNew);
  const [dek, setDek] = useState(initialData?.dek || "");
  const [body, setBody] = useState(initialData?.body || "");
  const [pillar, setPillar] = useState<ContentPillar>(
    initialData?.pillar || CONTENT_PILLARS[0]
  );
  const [tags, setTags] = useState(initialData?.tags || "");
  const [heroImageUrl, setHeroImageUrl] = useState(
    initialData?.hero_image_url || ""
  );
  const [published, setPublished] = useState(initialData?.published || false);

  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<BlogFormField, string>>
  >({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const deriveSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const clearFieldError = (...fields: BlogFormField[]) => {
    if (fields.some((field) => fieldErrors[field])) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        for (const field of fields) delete next[field];
        return next;
      });
    }
  };

  /** Props tying an input to its inline error for assistive technology. */
  const errorProps = (field: BlogFormField, inputId: string) => ({
    "aria-invalid": !!fieldErrors[field],
    "aria-describedby": fieldErrors[field] ? `${inputId}-error` : undefined,
  });

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!manualSlug) {
      setSlug(deriveSlug(val));
      clearFieldError("title", "slug");
    } else {
      clearFieldError("title");
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualSlug(true);
    setSlug(e.target.value);
    clearFieldError("slug");
  };

  const handleSubmit = async (publishTargetState: boolean) => {
    setError(null);
    setSuccessMessage(null);

    const tagArray = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: {
      title: string;
      slug: string;
      dek: string;
      body: string;
      pillar: ContentPillar;
      tags: string[];
      heroImageUrl?: string | null;
      published?: boolean;
    } = {
      title,
      slug,
      dek,
      body,
      pillar,
      tags: tagArray,
      heroImageUrl: heroImageUrl.trim() || null,
    };
    if (!isNew) payload.published = publishTargetState;

    // Validate against the contract the admin blog routes enforce, so slug
    // format, missing tags and length bounds are caught before a roundtrip.
    const parsed = isNew
      ? BlogDraftCreateSchema.safeParse(payload)
      : BlogDraftUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error) as Partial<
        Record<BlogFormField, string>
      >;
      setFieldErrors(errors);
      const firstInvalid = FIELD_INPUT_IDS.find(([field]) => errors[field]);
      setError(
        firstInvalid
          ? "Please fix the highlighted fields before saving."
          : (parsed.error.issues[0]?.message ?? "Please check the form.")
      );
      if (firstInvalid) document.getElementById(firstInvalid[1])?.focus();
      return;
    }

    setFieldErrors({});
    setSaving(true);

    try {
      if (isNew) {
        // First create as draft
        const res = await apiClient.post<BlogMutationResponse>(
          "/api/admin/blog",
          payload
        );
        throwIfFailed(res, "Failed to create blog post");

        const createdId = res.data?.data?.id;

        if (publishTargetState && createdId) {
          // Explicitly publish after draft creation
          const pubRes = await apiClient.patch<BlogMutationResponse>(
            `/api/admin/blog/${createdId}`,
            { published: true }
          );
          throwIfFailed(pubRes, "Created draft, but failed to publish");
        }

        setSuccessMessage(
          publishTargetState
            ? "Blog post created and published!"
            : "Draft created successfully!"
        );
        setTimeout(() => {
          router.push("/admin/blog");
          router.refresh();
        }, 1000);
      } else {
        // Edit existing post/draft
        const res = await apiClient.patch<BlogMutationResponse>(
          `/api/admin/blog/${initialData?.id}`,
          payload
        );
        throwIfFailed(res, "Failed to update blog post");

        setPublished(publishTargetState);
        setSuccessMessage(
          publishTargetState
            ? "Blog post published successfully!"
            : "Draft updated successfully!"
        );
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    if (
      !window.confirm(
        "Are you sure you want to delete this blog post? This action cannot be undone."
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await apiClient.delete(`/api/admin/blog/${initialData.id}`);
      if (!res.ok) {
        throw new Error(res.error || "Failed to delete blog post");
      }
      router.push("/admin/blog");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setError(msg);
      setSaving(false);
    }
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(val) => setActiveTab(val as "edit" | "preview")}
      className="flex flex-col gap-6 w-full max-w-5xl mx-auto"
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/blog"
            className="p-2 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors border border-white/5"
            aria-label="Back to Blog Management"
          >
            <IconArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-mono">
              {isNew ? "Create BlogPost" : `Edit: ${initialData?.title}`}
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              {isNew
                ? "Draft a new dispatch for the systems blog."
                : `ID: ${initialData?.id} • Status: ${published ? "PUBLISHED" : "DRAFT"}`}
            </p>
          </div>
        </div>

        {/* Tab Toggle: Edit vs Preview */}
        <TabsList
          aria-label="Article authoring views"
          className="flex items-center gap-2 bg-[#0d0e11] p-1 rounded-lg border border-white/10"
        >
          <TabsTrigger
            value="edit"
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-colors ${
              activeTab === "edit"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <IconEdit className="w-4 h-4" aria-hidden="true" />
            <span>Editor</span>
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-colors ${
              activeTab === "preview"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <IconEye className="w-4 h-4" aria-hidden="true" />
            <span>Live Preview</span>
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Notifications */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono flex items-center gap-2"
        >
          <IconAlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
          <IconCheck className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Editor Panel */}
      <TabsContent value="edit">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(published);
          }}
          className="space-y-6"
        >
          {/* Main Grid Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-lg border border-white/10 bg-[#0d0e11]">
            {/* Title */}
            <div className="flex flex-col gap-2 md:col-span-2">
              <label
                htmlFor="blog-title"
                className="text-xs font-mono font-medium text-zinc-300"
              >
                Article Title <span className="text-amber-500">*</span>
              </label>
              <input
                id="blog-title"
                type="text"
                required
                value={title}
                onChange={handleTitleChange}
                placeholder="e.g. Formal Verification in WebAssembly Runtimes"
                {...errorProps("title", "blog-title")}
                className={`${INPUT_BASE_CLASS} ${borderClass(!!fieldErrors.title)} font-mono text-sm`}
              />
              <FieldError id="blog-title-error" message={fieldErrors.title} />
            </div>

            {/* Slug */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="blog-slug"
                className="text-xs font-mono font-medium text-zinc-300"
              >
                URL Slug <span className="text-amber-500">*</span>
              </label>
              <input
                id="blog-slug"
                type="text"
                required
                value={slug}
                onChange={handleSlugChange}
                placeholder="formal-verification-wasm"
                {...errorProps("slug", "blog-slug")}
                className={`${INPUT_BASE_CLASS} ${borderClass(!!fieldErrors.slug)} font-mono text-sm`}
              />
              <FieldError id="blog-slug-error" message={fieldErrors.slug} />
              <span className="text-[10px] text-zinc-500 font-mono">
                Canonical URL: /blog/{slug || "slug"}
              </span>
            </div>

            {/* Pillar */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="blog-pillar"
                className="text-xs font-mono font-medium text-zinc-300"
              >
                Content Pillar Taxonomy{" "}
                <span className="text-amber-500">*</span>
              </label>
              <select
                id="blog-pillar"
                value={pillar}
                onChange={(e) => {
                  setPillar(e.target.value as ContentPillar);
                  clearFieldError("pillar");
                }}
                {...errorProps("pillar", "blog-pillar")}
                className={`${INPUT_BASE_CLASS} ${borderClass(!!fieldErrors.pillar)} font-mono text-sm`}
              >
                {CONTENT_PILLARS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <FieldError id="blog-pillar-error" message={fieldErrors.pillar} />
            </div>

            {/* Dek / Standfirst Summary */}
            <div className="flex flex-col gap-2 md:col-span-2">
              <label
                htmlFor="blog-dek"
                className="text-xs font-mono font-medium text-zinc-300"
              >
                Dek / Standfirst Summary{" "}
                <span className="text-amber-500">*</span>
              </label>
              <textarea
                id="blog-dek"
                required
                rows={2}
                value={dek}
                onChange={(e) => {
                  setDek(e.target.value);
                  clearFieldError("dek");
                }}
                placeholder="A concise 1-2 sentence standfirst summary displayed on index cards and OpenGraph metadata."
                {...errorProps("dek", "blog-dek")}
                className={`${INPUT_BASE_CLASS} ${borderClass(!!fieldErrors.dek)} font-sans text-sm`}
              />
              <FieldError id="blog-dek-error" message={fieldErrors.dek} />
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="blog-tags"
                className="text-xs font-mono font-medium text-zinc-300"
              >
                Tags (Comma-Separated) <span className="text-amber-500">*</span>
              </label>
              <input
                id="blog-tags"
                type="text"
                required
                value={tags}
                onChange={(e) => {
                  setTags(e.target.value);
                  clearFieldError("tags");
                }}
                placeholder="security, runtime, formal-methods"
                {...errorProps("tags", "blog-tags")}
                className={`${INPUT_BASE_CLASS} ${borderClass(!!fieldErrors.tags)} font-mono text-sm`}
              />
              <FieldError id="blog-tags-error" message={fieldErrors.tags} />
            </div>

            {/* Hero Image URL */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="blog-hero-url"
                className="text-xs font-mono font-medium text-zinc-300"
              >
                Hero Image URL (Optional)
              </label>
              <input
                id="blog-hero-url"
                type="url"
                value={heroImageUrl}
                onChange={(e) => {
                  setHeroImageUrl(e.target.value);
                  clearFieldError("heroImageUrl");
                }}
                placeholder="https://deruiter.dev/assets/hero.png"
                {...errorProps("heroImageUrl", "blog-hero-url")}
                className={`${INPUT_BASE_CLASS} ${borderClass(!!fieldErrors.heroImageUrl)} font-mono text-sm`}
              />
              <FieldError
                id="blog-hero-url-error"
                message={fieldErrors.heroImageUrl}
              />
            </div>

            {/* Published Toggle */}
            <div className="flex items-center gap-3 md:col-span-2 pt-2 border-t border-zinc-800">
              <input
                id="blog-published-toggle"
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-900"
              />
              <label
                htmlFor="blog-published-toggle"
                className="text-xs font-mono text-zinc-200 cursor-pointer"
              >
                Published State (Visible on live index & RSS when checked)
              </label>
            </div>
          </div>

          {/* Article Markup Body */}
          <div className="p-6 rounded-lg border border-white/10 bg-[#0d0e11] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="blog-body"
                className="text-xs font-mono font-medium text-zinc-300"
              >
                Sanitized HTML Body Markup{" "}
                <span className="text-amber-500">*</span>
              </label>
              <span className="text-[10px] font-mono text-zinc-500">
                Shared CaseStudy Allowlist (`h2`-`h4`, `p`, `pre`/`code`,
                `ul`/`ol`/`li`)
              </span>
            </div>
            <textarea
              id="blog-body"
              required
              rows={16}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                clearFieldError("body");
              }}
              placeholder="<h2>System Architecture</h2><p>Article narrative here...</p>"
              {...errorProps("body", "blog-body")}
              className={`w-full p-4 rounded bg-[#13151a] border text-zinc-100 focus:outline-none ${borderClass(!!fieldErrors.body)} font-mono text-xs leading-relaxed`}
            />
            <FieldError id="blog-body-error" message={fieldErrors.body} />
          </div>

          {/* Form Action Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
            <div>
              {!isNew && initialData?.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-4 py-2 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-mono flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <IconTrash className="w-4 h-4" />
                  <span>Delete BlogPost</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={saving}
                className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 text-xs font-mono flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <IconDeviceFloppy className="w-4 h-4 text-amber-400" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={saving}
                className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs font-mono flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <IconSend className="w-4 h-4" />
                <span>Publish Post</span>
              </button>
            </div>
          </div>
        </form>
      </TabsContent>

      {/* Preview Panel */}
      <TabsContent value="preview">
        <div className="rounded-xl border border-white/10 bg-[#0d0e11] p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider">
              Live Article Preview Mode
            </span>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-zinc-800 text-zinc-300 border border-white/5">
              {pillar}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 tracking-tight leading-tight">
            {title || "Untitled Blog Post"}
          </h1>

          <p className="text-base text-zinc-400 font-medium">
            {dek || "No standfirst / summary provided."}
          </p>

          {tags.trim() && (
            <div className="flex flex-wrap gap-2 pb-4 border-b border-zinc-900">
              {tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 text-xs font-mono bg-zinc-900/60 border border-zinc-800 text-zinc-400 rounded"
                  >
                    {tag}
                  </span>
                ))}
            </div>
          )}

          {heroImageUrl.trim() && (
            <div className="my-4 overflow-hidden rounded-lg border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImageUrl}
                alt={title}
                className="w-full h-auto object-cover max-h-80"
              />
            </div>
          )}

          <article className="prose prose-invert max-w-none text-neutral-300 leading-relaxed space-y-8 mt-6">
            <RichNarrative html={body} />
          </article>
        </div>
      </TabsContent>
    </Tabs>
  );
}
