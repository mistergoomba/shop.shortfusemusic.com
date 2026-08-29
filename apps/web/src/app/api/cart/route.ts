import { cartInput } from "@sf/shared";
import { parseBody, serverError } from "@/lib/api";
import { priceCartFromDatabase } from "@/lib/price-cart-server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-prices a cart from authoritative database data.
 *
 * The browser sends product ids, size ids, quantities, an optional offer id
 * and a country. It does not send prices, and any it did send would be
 * ignored: the response is built entirely from the database.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, cartInput);
  if (!parsed.ok) return parsed.response;

  try {
    const cart = await priceCartFromDatabase(parsed.data);
    return NextResponse.json(cart);
  } catch (err) {
    return serverError("cart.price", err);
  }
}
