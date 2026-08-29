"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteCategory,
  saveCategory,
  type CategoryState,
} from "@/app/admin/(dash)/categories/actions";
import { Card, inputClass, labelClass } from "./ui";

interface Row {
  id: number;
  name: string;
  slug: string;
  sortPosition: number;
  active: boolean;
  productCount: number;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="stamp min-h-11 bg-blood px-5 py-2 text-sm text-bone hover:bg-blood-bright disabled:bg-ink-card disabled:text-bone-faint"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function CategoryRow({ row }: { row: Row }) {
  const [state, action] = useActionState<CategoryState, FormData>(saveCategory, {});
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="border border-ink-line p-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={row.id} />

        <div className="min-w-40 flex-1">
          <label htmlFor={`name-${row.id}`} className={labelClass}>
            Name
          </label>
          <input
            id={`name-${row.id}`}
            name="name"
            defaultValue={row.name}
            className={inputClass}
            required
          />
        </div>

        <div className="min-w-40 flex-1">
          <label htmlFor={`slug-${row.id}`} className={labelClass}>
            Slug
          </label>
          <input
            id={`slug-${row.id}`}
            name="slug"
            defaultValue={row.slug}
            className={inputClass}
            required
          />
        </div>

        <div className="w-24">
          <label htmlFor={`sort-${row.id}`} className={labelClass}>
            Order
          </label>
          <input
            id={`sort-${row.id}`}
            name="sortPosition"
            type="number"
            defaultValue={row.sortPosition}
            className={inputClass}
          />
        </div>

        <label className="flex min-h-11 items-center gap-2 text-sm text-bone">
          <input
            type="checkbox"
            name="active"
            defaultChecked={row.active}
            className="h-5 w-5 accent-[#c1121f]"
          />
          Visible
        </label>

        <Submit label="Save" />

        <span className="text-sm text-bone-faint">
          {row.productCount} {row.productCount === 1 ? "product" : "products"}
        </span>
      </form>

      {(state.error || state.ok) && (
        <p
          role="status"
          className={`mt-2 text-sm ${state.error ? "text-blood-bright" : "text-bone-dim"}`}
        >
          {state.error ?? state.ok}
        </p>
      )}

      <div className="mt-3">
        {confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-bone">
              Delete &ldquo;{row.name}&rdquo;?{" "}
              {row.productCount > 0 &&
                `${row.productCount} ${row.productCount === 1 ? "product becomes" : "products become"} uncategorised.`}
            </span>
            <button
              type="button"
              onClick={() => deleteCategory(row.id)}
              className="stamp min-h-11 bg-blood px-4 text-sm text-bone hover:bg-blood-bright"
            >
              Yes, delete
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-11 text-sm text-bone-dim hover:text-bone"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-bone-faint underline underline-offset-4 hover:text-blood-bright"
          >
            Delete category
          </button>
        )}
      </div>
    </li>
  );
}

function NewCategoryForm() {
  const [state, action] = useActionState<CategoryState, FormData>(saveCategory, {});

  return (
    <Card title="Add a category">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <label htmlFor="new-name" className={labelClass}>
            Name
          </label>
          <input id="new-name" name="name" className={inputClass} required />
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor="new-slug" className={labelClass}>
            Slug
          </label>
          <input
            id="new-slug"
            name="slug"
            className={inputClass}
            placeholder="t-shirts"
            required
          />
        </div>
        <div className="w-24">
          <label htmlFor="new-sort" className={labelClass}>
            Order
          </label>
          <input
            id="new-sort"
            name="sortPosition"
            type="number"
            defaultValue={0}
            className={inputClass}
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-bone">
          <input
            type="checkbox"
            name="active"
            defaultChecked
            className="h-5 w-5 accent-[#c1121f]"
          />
          Visible
        </label>
        <Submit label="Create" />
      </form>

      {(state.error || state.ok) && (
        <p
          role="status"
          className={`mt-3 text-sm ${state.error ? "text-blood-bright" : "text-bone-dim"}`}
        >
          {state.error ?? state.ok}
        </p>
      )}
    </Card>
  );
}

export function CategoryManager({ categories }: { categories: Row[] }) {
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-3">
        {categories.map((c) => (
          <CategoryRow key={c.id} row={c} />
        ))}
      </ul>
      <NewCategoryForm />
    </div>
  );
}
