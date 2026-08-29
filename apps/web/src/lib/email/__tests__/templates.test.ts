import { describe, expect, it } from "vitest";
import {
  merchantOrderAlertEmail,
  orderConfirmationEmail,
  orderShippedEmail,
  type EmailOrder,
} from "../templates";

const SITE = "https://shop.shortfusemusic.com";

function order(over: Partial<EmailOrder> = {}): EmailOrder {
  return {
    orderNumber: "SF-1042",
    publicRef: "abc123def456",
    email: "fan@example.com",
    customerName: "Jamie Rivera",
    items: [
      {
        productName: "Atomic Mutation T-Shirt",
        sizeLabel: "XX Large",
        quantity: 2,
        unitPriceCents: 2000,
        lineTotalCents: 4000,
        isOffer: false,
      },
      {
        productName: "Sticker Pack",
        sizeLabel: null,
        quantity: 1,
        unitPriceCents: 500,
        lineTotalCents: 500,
        isOffer: true,
      },
    ],
    subtotalCents: 4500,
    discountCents: 400,
    shippingCents: 500,
    taxCents: 0,
    totalCents: 4600,
    shipName: "Jamie Rivera",
    shipLine1: "123 Test St",
    shipLine2: null,
    shipCity: "Austin",
    shipState: "TX",
    shipPostalCode: "78701",
    shipCountry: "US",
    trackingNumber: null,
    ...over,
  };
}

describe("orderConfirmationEmail", () => {
  it("shows the order number in the subject and the body", () => {
    const mail = orderConfirmationEmail(order(), SITE);
    expect(mail.subject).toContain("SF-1042");
    expect(mail.html).toContain("SF-1042");
    expect(mail.text).toContain("SF-1042");
  });

  it("lists every item with its size and quantity", () => {
    const mail = orderConfirmationEmail(order(), SITE);
    expect(mail.html).toContain("Atomic Mutation T-Shirt");
    expect(mail.html).toContain("2XL"); // short label, as on the site
    expect(mail.html).toContain("Sticker Pack");
    expect(mail.text).toContain("2 x Atomic Mutation T-Shirt");
  });

  it("marks the add-on line so the discount is explicable", () => {
    const mail = orderConfirmationEmail(order(), SITE);
    expect(mail.html).toContain("ADD-ON");
    expect(mail.text).toContain("[add-on]");
  });

  /** The receipt has to survive a customer adding it up by hand. */
  it("shows totals that reconcile", () => {
    const mail = orderConfirmationEmail(order(), SITE);
    expect(mail.html).toContain("$45.00"); // subtotal
    expect(mail.html).toContain("-$4.00"); // discount
    expect(mail.html).toContain("$5.00"); // shipping
    expect(mail.html).toContain("$46.00"); // total
    expect(mail.text).toContain("Total: $46.00");
  });

  it("links to the order page using the unguessable ref", () => {
    const mail = orderConfirmationEmail(order(), SITE);
    expect(mail.html).toContain(`${SITE}/order/abc123def456`);
    expect(mail.text).toContain(`${SITE}/order/abc123def456`);
  });

  it("includes the shipping address when there is one", () => {
    const mail = orderConfirmationEmail(order(), SITE);
    expect(mail.html).toContain("123 Test St");
    expect(mail.html).toContain("Austin, TX, 78701");
  });

  it("omits the address block entirely when there is none", () => {
    const mail = orderConfirmationEmail(order({ shipLine1: null }), SITE);
    expect(mail.html).not.toContain("Shipping to");
  });

  it("hides a zero discount and zero tax rather than showing $0.00 rows", () => {
    const mail = orderConfirmationEmail(
      order({ discountCents: 0, taxCents: 0, totalCents: 5000 }),
      SITE,
    );
    expect(mail.html).not.toContain("Add-on discount");
    expect(mail.html).not.toContain(">Tax<");
  });

  it("says Free rather than $0.00 when shipping is free", () => {
    const mail = orderConfirmationEmail(order({ shippingCents: 0 }), SITE);
    expect(mail.html).toContain("Free");
  });

  it("greets a customer with no name on file without saying 'undefined'", () => {
    const mail = orderConfirmationEmail(order({ customerName: null }), SITE);
    expect(mail.html).toContain("Thanks there");
    expect(mail.html).not.toContain("undefined");
    expect(mail.text).not.toContain("undefined");
  });

  /**
   * Product names are admin-authored and could contain markup. An email that
   * renders it is a phishing vector inside a trusted-looking receipt.
   *
   * The property that matters is that no *tag* can form from injected text.
   * The characters of something like `onerror=` may well survive as literal
   * text -- that is harmless, because the surrounding angle brackets are
   * escaped, so it renders as words rather than an attribute.
   */
  it("escapes injected markup so no live tag can form", () => {
    const mail = orderConfirmationEmail(
      order({
        customerName: "<script>alert(1)</script>",
        items: [
          {
            productName: '<img src=x onerror="alert(1)">Shirt',
            sizeLabel: null,
            quantity: 1,
            unitPriceCents: 100,
            lineTotalCents: 100,
            isOffer: false,
          },
        ],
      }),
      SITE,
    );

    expect(mail.html).not.toContain("<script");
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("ships a plain-text alternative alongside the HTML", () => {
    const mail = orderConfirmationEmail(order(), SITE);
    expect(mail.text.length).toBeGreaterThan(50);
    expect(mail.text).not.toContain("<");
  });
});

describe("orderShippedEmail", () => {
  it("leads with the tracking number when there is one", () => {
    const mail = orderShippedEmail(order({ trackingNumber: "9400111899223" }), SITE);
    expect(mail.subject).toContain("shipped");
    expect(mail.html).toContain("9400111899223");
    expect(mail.text).toContain("Tracking number: 9400111899223");
  });

  /** Marking shipped without tracking is allowed; the email must still work. */
  it("omits the tracking block when there is no number", () => {
    const mail = orderShippedEmail(order({ trackingNumber: null }), SITE);
    expect(mail.html).not.toContain("Tracking number");
    expect(mail.text).not.toContain("Tracking number");
    expect(mail.html).toContain("on its way");
  });

  it("still links back to the order page", () => {
    const mail = orderShippedEmail(order(), SITE);
    expect(mail.html).toContain(`${SITE}/order/abc123def456`);
  });
});

describe("merchantOrderAlertEmail", () => {
  it("puts the order number and total in the subject, for a lock screen", () => {
    const mail = merchantOrderAlertEmail(order(), SITE, `${SITE}/admin/orders/42`);
    expect(mail.subject).toBe("New order SF-1042 — $46.00");
  });

  it("leads with what was sold and where it goes", () => {
    const mail = merchantOrderAlertEmail(order(), SITE, `${SITE}/admin/orders/42`);
    expect(mail.html).toContain("Atomic Mutation T-Shirt");
    expect(mail.html).toContain("2XL");
    expect(mail.html).toContain("123 Test St");
    expect(mail.html).toContain("Austin, TX, 78701");
  });

  it("includes the customer's address so replying reaches them", () => {
    const mail = merchantOrderAlertEmail(order(), SITE, `${SITE}/admin/orders/42`);
    expect(mail.html).toContain("fan@example.com");
  });

  it("links straight to the admin order page", () => {
    const mail = merchantOrderAlertEmail(order(), SITE, `${SITE}/admin/orders/42`);
    expect(mail.html).toContain(`${SITE}/admin/orders/42`);
    expect(mail.text).toContain(`${SITE}/admin/orders/42`);
  });

  /**
   * The alert fires from the webhook, which is also what writes the address.
   * If a session ever arrives without one, the band still needs the email.
   */
  it("still sends usefully when there is no address yet", () => {
    const mail = merchantOrderAlertEmail(
      order({ shipLine1: null, shipCity: null }),
      SITE,
      `${SITE}/admin/orders/42`,
    );
    expect(mail.html).toContain("No address on the order yet");
    expect(mail.text).toContain("(no address yet)");
    expect(mail.subject).toContain("SF-1042");
  });

  it("escapes injected markup like the customer emails do", () => {
    const mail = merchantOrderAlertEmail(
      order({ customerName: "<script>alert(1)</script>" }),
      SITE,
      `${SITE}/admin/orders/42`,
    );
    expect(mail.html).not.toContain("<script");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});
