import { describe, expect, it } from "vitest";
import { userHash, usernameFromHash } from "./route";

describe("hash routes", () => {
  it("round-trips usernames through the hash", () => {
    expect(userHash("octocat")).toBe("/user/octocat");
    expect(usernameFromHash(`#${userHash("octocat")}`)).toBe("octocat");
    expect(usernameFromHash("#/user/Octo-Cat?tab=1")).toBe("Octo-Cat");
  });

  it("ignores unrelated or malformed hashes", () => {
    expect(usernameFromHash("")).toBe("");
    expect(usernameFromHash("#/repo/octocat")).toBe("");
    expect(usernameFromHash("#/user/%E0%A4%A")).toBe("");
  });
});
