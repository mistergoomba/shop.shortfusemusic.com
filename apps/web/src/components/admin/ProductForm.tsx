"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import {
  AVAILABILITY,
  SIZE_LADDER,
  formatCents,
  parseDollarsToCents,
  type Availability,
} from "@sf/shared";
import { saveProduct, type SaveState } from "@/app/admin/(dash)/products/actions";
import { Card, inputClass, labelClass } from "./ui";

interface SizeDraft {
  id?: number;
  label: string;
  availability: Availability;
}
interface ImageDraft {
  id?: number;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

export interface ProductFormData {
  id?: number;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  salePriceCents: number | null;
  categoryId: number | null;
  availability: Availability;
  featured: boolean;
  active: boolean;
  sortPosition: number;
  sizes: SizeDraft[];
  images: ImageDraft[];
  relatedProductIds: number[];
}

const AVAILABILITY_LABEL: Record<Availability, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  SOLD_OUT: "Sold out",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dollars(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="stamp min-h-11 bg-blood px-6 py-2.5 text-bone hover:bg-blood-bright disabled:bg-ink-card disabled:text-bone-faint"
    >
      {pending ? "Saving…" : "Save Product"}
    </button>
  );
}

export function ProductForm({
  initial,
  categories,
  productOptions,
}: {
  initial: ProductFormData;
  categories: { id: number; name: string }[];
  productOptions: { id: number; name: string; active: boolean }[];
}) {
  const [state, formAction] = useActionState<SaveState, FormData>(saveProduct, {});

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(initial.slug !== "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [price, setPrice] = useState(dollars(initial.priceCents));
  const [salePrice, setSalePrice] = useState(dollars(initial.salePriceCents));
  const [categoryId, setCategoryId] = useState<number | null>(initial.categoryId);
  const [availability, setAvailability] = useState<Availability>(initial.availability);
  const [featured, setFeatured] = useState(initial.featured);
  const [active, setActive] = useState(initial.active);
  const [sortPosition, setSortPosition] = useState(String(initial.sortPosition));
  const [sizes, setSizes] = useState<SizeDraft[]>(initial.sizes);
  const [images, setImages] = useState<ImageDraft[]>(initial.images);
  const [relatedIds, setRelatedIds] = useState<number[]>(initial.relatedProductIds);
  const [newImageUrl, setNewImageUrl] = useState("");

  const priceCents = parseDollarsToCents(price) ?? 0;
  const salePriceCents = salePrice.trim() === "" ? null : parseDollarsToCents(salePrice);

  const payload = {
    name,
    slug,
    description: description.trim() === "" ? null : description,
    priceCents,
    salePriceCents,
    categoryId,
    availability,
    featured,
    active,
    sortPosition: Number(sortPosition) || 0,
    sizes: sizes.map((s) => ({ id: s.id, label: s.label, availability: s.availability })),
    images,
    relatedProductIds: relatedIds,
  };

  const err = state.fieldErrors ?? {};
  const unusedLadderSizes = SIZE_LADDER.filter(
    (l) => !sizes.some((s) => s.label === l),
  );

  function move<T>(list: T[], from: number, to: number): T[] {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    return next;
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      {state.error && (
        <p role="alert" className="border border-blood px-4 py-3 text-sm text-bone">
          {state.error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card title="Basics">
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="p-name" className={labelClass}>
                  Name
                </label>
                <input
                  id="p-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }}
                  className={inputClass}
                  required
                />
                {err.name && <p className="mt-1 text-sm text-blood-bright">{err.name}</p>}
              </div>

              <div>
                <label htmlFor="p-slug" className={labelClass}>
                  Slug{" "}
                  <span className="text-bone-faint">
                    (/product/{slug || "…"})
                  </span>
                </label>
                <input
                  id="p-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  className={inputClass}
                  required
                />
                {err.slug && <p className="mt-1 text-sm text-blood-bright">{err.slug}</p>}
              </div>

              <div>
                <label htmlFor="p-desc" className={labelClass}>
                  Description{" "}
                  <span className="text-bone-faint">
                    (basic HTML allowed: paragraphs, lists, links)
                  </span>
                </label>
                <textarea
                  id="p-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={12}
                  className={`${inputClass} min-h-40 font-mono text-xs leading-relaxed`}
                />
              </div>
            </div>
          </Card>

          {/* ---- Sizes ---- */}
          <Card title="Sizes">
            <p className="mb-4 text-sm text-bone-faint">
              Leave empty for products that don&rsquo;t come in sizes. A product
              with sizes is sold out only when every size is.
            </p>

            {sizes.length > 0 && (
              <ul className="mb-4 flex flex-col gap-2">
                {sizes.map((size, i) => (
                  <li key={size.id ?? `new-${i}`} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-sm text-bone">{size.label}</span>
                    <select
                      value={size.availability}
                      onChange={(e) =>
                        setSizes(
                          sizes.map((s, n) =>
                            n === i
                              ? { ...s, availability: e.target.value as Availability }
                              : s,
                          ),
                        )
                      }
                      className="min-h-11 flex-1 border border-ink-line bg-ink-card px-2 py-1.5 text-sm text-bone"
                      aria-label={`Availability for ${size.label}`}
                    >
                      {AVAILABILITY.map((a) => (
                        <option key={a} value={a}>
                          {AVAILABILITY_LABEL[a]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setSizes(sizes.filter((_, n) => n !== i))}
                      className="min-h-11 px-3 text-sm text-bone-faint hover:text-blood-bright"
                    >
                      Remove<span className="sr-only"> {size.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {unusedLadderSizes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-bone-faint">Add:</span>
                {unusedLadderSizes.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      setSizes([...sizes, { label, availability: "IN_STOCK" }])
                    }
                    className="min-h-11 border border-ink-line px-3 py-1.5 text-sm text-bone-dim hover:border-blood hover:text-bone"
                  >
                    + {label}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* ---- Images ---- */}
          <Card title="Images">
            <p className="mb-4 text-sm text-bone-faint">
              First image is the primary. Second is used for the hover swap on
              product cards.
            </p>

            {images.length > 0 && (
              <ul className="mb-4 flex flex-col gap-3">
                {images.map((img, i) => (
                  <li
                    key={img.id ?? `new-${i}`}
                    className="flex items-center gap-3 border border-ink-line p-2"
                  >
                    <Image
                      src={img.url}
                      alt=""
                      width={56}
                      height={56}
                      className="h-14 w-14 shrink-0 object-cover"
                      unoptimized
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-bone-faint">{img.url}</p>
                      <input
                        value={img.alt ?? ""}
                        onChange={(e) =>
                          setImages(
                            images.map((m, n) =>
                              n === i ? { ...m, alt: e.target.value } : m,
                            ),
                          )
                        }
                        placeholder="Alt text (describe the image)"
                        aria-label={`Alt text for image ${i + 1}`}
                        className="mt-1 min-h-9 w-full border border-ink-line bg-ink-card px-2 py-1 text-xs text-bone"
                      />
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => setImages(move(images, i, i - 1))}
                        disabled={i === 0}
                        className="px-2 text-bone-dim hover:text-bone disabled:opacity-30"
                        aria-label={`Move image ${i + 1} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => setImages(move(images, i, i + 1))}
                        disabled={i === images.length - 1}
                        className="px-2 text-bone-dim hover:text-bone disabled:opacity-30"
                        aria-label={`Move image ${i + 1} down`}
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImages(images.filter((_, n) => n !== i))}
                      className="min-h-11 shrink-0 px-2 text-sm text-bone-faint hover:text-blood-bright"
                    >
                      Remove<span className="sr-only"> image {i + 1}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <input
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="https://… or /media/filename.webp"
                aria-label="New image URL"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  const url = newImageUrl.trim();
                  if (!url) return;
                  setImages([...images, { url, alt: name, width: null, height: null }]);
                  setNewImageUrl("");
                }}
                className="stamp min-h-11 shrink-0 border border-ink-line px-4 text-sm text-bone-dim hover:text-bone"
              >
                Add
              </button>
            </div>
          </Card>

          {/* ---- Related ---- */}
          <Card title="You Might Also Dig">
            <p className="mb-4 text-sm text-bone-faint">
              Hand-picked, shown in this order. Any leftover slots fill
              automatically with other items from the same category.
            </p>

            {relatedIds.length > 0 && (
              <ol className="mb-4 flex flex-col gap-2">
                {relatedIds.map((rid, i) => {
                  const p = productOptions.find((o) => o.id === rid);
                  return (
                    <li key={rid} className="flex items-center gap-2">
                      <span className="w-6 text-sm text-bone-faint">{i + 1}.</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-bone">
                        {p?.name ?? `Product ${rid}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRelatedIds(move(relatedIds, i, i - 1))}
                        disabled={i === 0}
                        className="px-2 text-bone-dim hover:text-bone disabled:opacity-30"
                        aria-label={`Move ${p?.name ?? "item"} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => setRelatedIds(move(relatedIds, i, i + 1))}
                        disabled={i === relatedIds.length - 1}
                        className="px-2 text-bone-dim hover:text-bone disabled:opacity-30"
                        aria-label={`Move ${p?.name ?? "item"} down`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRelatedIds(relatedIds.filter((x) => x !== rid))
                        }
                        className="min-h-11 px-2 text-sm text-bone-faint hover:text-blood-bright"
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            <select
              value=""
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id && !relatedIds.includes(id)) setRelatedIds([...relatedIds, id]);
              }}
              aria-label="Add a related product"
              className={inputClass}
            >
              <option value="">Add a related product…</option>
              {productOptions
                .filter((o) => o.id !== initial.id && !relatedIds.includes(o.id))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {!o.active ? " (hidden)" : ""}
                  </option>
                ))}
            </select>
          </Card>
        </div>

        {/* ---- Sidebar ---- */}
        <div className="flex flex-col gap-6">
          <Card title="Publish">
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-3 text-sm text-bone">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-5 w-5 accent-[#c1121f]"
                />
                Visible in the shop
              </label>

              <label className="flex items-center gap-3 text-sm text-bone">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="h-5 w-5 accent-[#c1121f]"
                />
                Featured on the homepage
              </label>

              <div>
                <label htmlFor="p-sort" className={labelClass}>
                  Sort position
                </label>
                <input
                  id="p-sort"
                  type="number"
                  value={sortPosition}
                  onChange={(e) => setSortPosition(e.target.value)}
                  className={inputClass}
                />
              </div>

              <SaveButton />
            </div>
          </Card>

          <Card title="Pricing">
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="p-price" className={labelClass}>
                  Price (USD)
                </label>
                <input
                  id="p-price"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={inputClass}
                  required
                />
                {err.priceCents && (
                  <p className="mt-1 text-sm text-blood-bright">{err.priceCents}</p>
                )}
              </div>

              <div>
                <label htmlFor="p-sale" className={labelClass}>
                  Sale price <span className="text-bone-faint">(blank = no sale)</span>
                </label>
                <input
                  id="p-sale"
                  inputMode="decimal"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className={inputClass}
                />
                {err.salePriceCents && (
                  <p className="mt-1 text-sm text-blood-bright">
                    {err.salePriceCents}
                  </p>
                )}
                {salePriceCents !== null && salePriceCents < priceCents && (
                  <p className="mt-1 text-xs text-bone-faint">
                    Customer pays {formatCents(salePriceCents)}, saving{" "}
                    {formatCents(priceCents - salePriceCents)}.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card title="Stock &amp; category">
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="p-avail" className={labelClass}>
                  Availability
                  {sizes.length > 0 && (
                    <span className="text-bone-faint"> (per-size overrides this)</span>
                  )}
                </label>
                <select
                  id="p-avail"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value as Availability)}
                  className={inputClass}
                >
                  {AVAILABILITY.map((a) => (
                    <option key={a} value={a}>
                      {AVAILABILITY_LABEL[a]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="p-cat" className={labelClass}>
                  Category
                </label>
                <select
                  id="p-cat"
                  value={categoryId ?? ""}
                  onChange={(e) =>
                    setCategoryId(e.target.value ? Number(e.target.value) : null)
                  }
                  className={inputClass}
                >
                  <option value="">Uncategorised</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {initial.id && (
            <Link
              href={`/product/${initial.slug}`}
              target="_blank"
              rel="noopener"
              className="text-center text-sm text-bone-faint underline underline-offset-4 hover:text-bone"
            >
              View on the shop ↗
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
