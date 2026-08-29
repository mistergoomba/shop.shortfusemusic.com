"use client";

import { useState } from "react";
import Image from "next/image";
import type { ImageView } from "@/lib/catalog";

export function ProductGallery({
  images,
  productName,
}: {
  images: ImageView[];
  productName: string;
}) {
  const [index, setIndex] = useState(0);
  const active = images[index];

  if (!active) {
    return (
      <div className="flex aspect-square items-center justify-center border border-ink-line bg-ink-card text-bone-faint">
        <span className="stamp">No image</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden border border-ink-line bg-ink-card">
        <Image
          key={active.url}
          src={active.url}
          alt={active.alt ?? productName}
          width={active.width ?? 1200}
          height={active.height ?? 1200}
          priority
          sizes="(max-width: 1024px) 100vw, 640px"
          className="h-full w-full object-cover"
        />
      </div>

      {images.length > 1 && (
        <ul className="grid grid-cols-5 gap-2" role="list">
          {images.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === index ? "true" : undefined}
                className={`relative block aspect-square w-full overflow-hidden border transition-colors ${
                  i === index
                    ? "border-blood"
                    : "border-ink-line hover:border-bone-faint"
                }`}
              >
                <Image
                  src={img.url}
                  alt=""
                  aria-hidden="true"
                  width={200}
                  height={200}
                  loading="lazy"
                  sizes="120px"
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
