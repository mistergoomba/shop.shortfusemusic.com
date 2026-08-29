import { describe, expect, it } from "vitest";
import { emailListIsValid, parseEmailList } from "../contracts";

describe("parseEmailList", () => {
  it("splits on commas, semicolons and newlines", () => {
    expect(parseEmailList("a@x.com, b@x.com; c@x.com\nd@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
    ]);
  });

  it("trims whitespace and lowercases", () => {
    expect(parseEmailList("  Info@ShortFuseMusic.com  ")).toEqual([
      "info@shortfusemusic.com",
    ]);
  });

  /** A trailing comma or a doubled address must not mail anyone twice. */
  it("drops empties and de-duplicates", () => {
    expect(parseEmailList("a@x.com,,a@x.com, ,A@X.com")).toEqual(["a@x.com"]);
  });

  it("silently skips entries that are not addresses", () => {
    expect(parseEmailList("good@x.com, not-an-email, also bad")).toEqual([
      "good@x.com",
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(parseEmailList(null)).toEqual([]);
    expect(parseEmailList(undefined)).toEqual([]);
    expect(parseEmailList("   ")).toEqual([]);
  });

  it("handles the real configured list", () => {
    expect(
      parseEmailList(
        "info@shortfusemusic.com\nmistergoomba@gmail.com\nmykedeath@gmail.com",
      ),
    ).toEqual([
      "info@shortfusemusic.com",
      "mistergoomba@gmail.com",
      "mykedeath@gmail.com",
    ]);
  });
});

describe("emailListIsValid", () => {
  /**
   * Validation is stricter than parsing on purpose: parsing skips junk so a
   * bad entry cannot stop the good ones being notified, but the admin form
   * should refuse to save a typo rather than silently ignoring it.
   */
  it("accepts empty and well-formed lists", () => {
    expect(emailListIsValid(null)).toBe(true);
    expect(emailListIsValid("")).toBe(true);
    expect(emailListIsValid("a@x.com, b@y.com")).toBe(true);
  });

  it("rejects a list containing anything invalid", () => {
    expect(emailListIsValid("a@x.com, oops")).toBe(false);
    expect(emailListIsValid("no-at-sign")).toBe(false);
  });
});
