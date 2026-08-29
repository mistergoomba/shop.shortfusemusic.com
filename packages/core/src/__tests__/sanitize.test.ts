import { describe, expect, it } from "vitest";
import {
  bigCartelDescriptionToHtml,
  descriptionToPlainText,
  sanitizeDescription,
  truncate,
} from "../sanitize";

describe("sanitizeDescription", () => {
  it("strips scripts and event handlers", () => {
    expect(sanitizeDescription('<script>alert(1)</script><p>Hi</p>')).toBe("<p>Hi</p>");
    expect(sanitizeDescription('<p onclick="steal()">Hi</p>')).toBe("<p>Hi</p>");
    expect(sanitizeDescription('<img src=x onerror="alert(1)">')).toBe("");
  });

  it("rejects javascript: and data: URLs on links", () => {
    expect(sanitizeDescription('<a href="javascript:alert(1)">x</a>')).not.toContain(
      "javascript:",
    );
    expect(sanitizeDescription('<a href="data:text/html,<b>">x</a>')).not.toContain(
      "data:",
    );
  });

  it("keeps the formatting a track listing needs", () => {
    const html = sanitizeDescription(
      "<p>Released 2025<br />1) Virus</p><ul><li>One</li></ul>",
    );
    expect(html).toContain("<br />");
    expect(html).toContain("<li>One</li>");
  });

  it("forces safe rel and target on outbound links", () => {
    const html = sanitizeDescription('<a href="https://open.spotify.com/x">Spotify</a>');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
  });

  it("handles null and empty input", () => {
    expect(sanitizeDescription(null)).toBe("");
    expect(sanitizeDescription(undefined)).toBe("");
    expect(sanitizeDescription("")).toBe("");
  });
});

describe("bigCartelDescriptionToHtml", () => {
  /** The real shape of the imported Grim Chronicles description. */
  const source =
    "Released 2025\r\n\r\nChapter 1: The Plague\r\n1) Virus\r\n2) Massive Explosion\r\n\r\n" +
    'Also available on:\r\n<a href="https://open.spotify.com/album/x">Spotify</a>';

  it("turns blank lines into paragraphs and single newlines into breaks", () => {
    const html = bigCartelDescriptionToHtml(source);
    expect(html).toContain("<p>Released 2025</p>");
    expect(html).toContain("Chapter 1: The Plague<br />1) Virus<br />2) Massive Explosion");
  });

  it("preserves streaming links as real anchors", () => {
    const html = bigCartelDescriptionToHtml(source);
    expect(html).toContain('href="https://open.spotify.com/album/x"');
    expect(html).toContain(">Spotify</a>");
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("escapes text that looks like markup rather than rendering it", () => {
    const html = bigCartelDescriptionToHtml("5 < 10 & 20 > 15\r\n<script>bad()</script>");
    expect(html).toContain("&lt;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain("<script>");
  });

  it("escapes ampersands inside preserved link URLs", () => {
    const html = bigCartelDescriptionToHtml(
      '<a href="https://music.amazon.com/albums/B0?a=1&b=2">Amazon</a>',
    );
    expect(html).toContain("a=1&amp;b=2");
  });

  it("returns empty for empty input", () => {
    expect(bigCartelDescriptionToHtml(null)).toBe("");
    expect(bigCartelDescriptionToHtml("")).toBe("");
  });
});

describe("descriptionToPlainText", () => {
  it("strips all markup for meta descriptions", () => {
    expect(
      descriptionToPlainText("<p>Released 2025</p><p>Chapter <b>1</b></p>"),
    ).toBe("Released 2025Chapter 1");
  });

  it("collapses whitespace", () => {
    expect(descriptionToPlainText("<p>a\n\n   b</p>")).toBe("a b");
  });
});

describe("truncate", () => {
  it("leaves short text alone", () => {
    expect(truncate("short", 10)).toBe("short");
  });

  it("adds an ellipsis when cutting", () => {
    const out = truncate("abcdefghijklmnop", 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith("…")).toBe(true);
  });
});
