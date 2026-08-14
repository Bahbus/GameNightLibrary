import { describe, expect, it, vi } from "vitest";
import {
  beginSetupVerification,
  clearSetupAccessSession,
  parseSetupServiceUrl,
  readSetupAccessSession,
  storeSetupAccessSession,
  submitHouseAnswers,
  takeSetupAuthValues,
  verifySetupAccess
} from "../../src/lib/setupAccess";

describe("setup collaborator access", () => {
  const repositoryUrl = __GITHUB_REPOSITORY_URL__;

  it("accepts HTTPS services and local development HTTP only", () => {
    expect(parseSetupServiceUrl("https://auth.example.test/api")?.href).toBe(
      "https://auth.example.test/api/"
    );
    expect(parseSetupServiceUrl("http://127.0.0.1:4173/test")?.href).toBe(
      "http://127.0.0.1:4173/test/"
    );
    expect(parseSetupServiceUrl("http://auth.example.test")).toBeUndefined();
    expect(parseSetupServiceUrl("https://user:secret@auth.example.test")).toBeUndefined();
  });

  it("treats browser session storage as untrusted input", () => {
    const storage = {
      value: "",
      getItem() {
        return this.value;
      },
      setItem(_key: string, value: string) {
        this.value = value;
      },
      removeItem() {
        this.value = "";
      }
    };
    storage.value = '{"grant":7,"login":"owner","expiresAt":"tomorrow"}';
    expect(readSetupAccessSession(storage)).toBeUndefined();

    const session = {
      grant: "opaque-grant",
      login: "owner",
      expiresAt: "2099-01-01T00:00:00.000Z"
    };
    storeSetupAccessSession(session, storage);
    expect(readSetupAccessSession(storage)).toEqual(session);
    clearSetupAccessSession(storage);
    expect(readSetupAccessSession(storage)).toBeUndefined();
  });

  it("fails safely when browser policy blocks sessionStorage itself", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get() {
        throw new globalThis.DOMException("Storage access denied", "SecurityError");
      }
    });
    const session = {
      grant: "opaque-grant",
      login: "owner",
      expiresAt: "2099-01-01T00:00:00.000Z"
    };
    try {
      expect(readSetupAccessSession()).toBeUndefined();
      expect(takeSetupAuthValues()).toBeUndefined();
      expect(() => clearSetupAccessSession()).not.toThrow();
      expect(() => storeSetupAccessSession(session)).toThrow(/Storage access denied/);
      await expect(
        beginSetupVerification(new URL("https://auth.example.test/"), {
          origin: "https://bahbus.github.io",
          pathname: "/GameNightLibrary/",
          assign() {}
        })
      ).rejects.toThrow(/Storage access denied/);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "sessionStorage", descriptor);
      else Reflect.deleteProperty(globalThis, "sessionStorage");
    }
  });

  it("requires the service to reconfirm a stored grant", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          verified: true,
          login: "Bahbus",
          expiresAt: "2099-01-01T00:00:00.000Z"
        }),
        { status: 200 }
      )
    );
    const verified = await verifySetupAccess(
      new URL("https://auth.example.test/"),
      {
        grant: "opaque-grant",
        login: "untrusted-name",
        expiresAt: "2098-01-01T00:00:00.000Z"
      },
      fetcher
    );

    expect(verified.login).toBe("Bahbus");
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://auth.example.test/api/setup/session"),
      expect.objectContaining({
        headers: { authorization: "Bearer opaque-grant" },
        method: "POST"
      })
    );
  });

  it("fails closed when verification is rejected", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 }));
    await expect(
      verifySetupAccess(
        new URL("https://auth.example.test/"),
        {
          grant: "expired",
          login: "someone",
          expiresAt: "2099-01-01T00:00:00.000Z"
        },
        fetcher
      )
    ).rejects.toThrow(/could not confirm collaborator access/i);
  });

  it("starts GitHub verification with PKCE and a hashed nonce", async () => {
    const values = new Map<string, string>();
    const location = {
      assigned: "",
      origin: "https://bahbus.github.io",
      pathname: "/GameNightLibrary/",
      assign(value: string) {
        this.assigned = value;
      }
    };
    await beginSetupVerification(new URL("https://auth.example.test/"), location, {
      removeItem(key) {
        values.delete(key);
      },
      setItem(key, value) {
        values.set(key, value);
      }
    });
    const target = new URL(location.assigned);
    expect(target.origin).toBe("https://auth.example.test");
    expect(target.searchParams.get("callback")).toBe("https://bahbus.github.io/GameNightLibrary/");
    expect(target.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(target.searchParams.get("nonce_hash")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect([...values.values()]).toHaveLength(2);
    expect(target.href).not.toContain([...values.values()][0]);
  });

  it("clears partial PKCE state when verification storage fails", async () => {
    const values = new Map<string, string>();
    const storage = {
      removeItem(key: string) {
        values.delete(key);
      },
      setItem(key: string, value: string) {
        if (values.size) throw new globalThis.DOMException("Storage is full", "QuotaExceededError");
        values.set(key, value);
      }
    };

    await expect(
      beginSetupVerification(
        new URL("https://auth.example.test/"),
        {
          origin: "https://bahbus.github.io",
          pathname: "/GameNightLibrary/",
          assign() {}
        },
        storage
      )
    ).rejects.toThrow(/Storage is full/);
    expect(values.size).toBe(0);
  });

  it("accepts only the expected repository pull request response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          pullRequestNumber: 42,
          pullRequestUrl: `${repositoryUrl}/pull/42`
        }),
        { status: 201 }
      )
    );
    await expect(
      submitHouseAnswers(
        new URL("https://auth.example.test/"),
        "grant",
        "csv",
        "a".repeat(40),
        fetcher
      )
    ).resolves.toEqual({
      pullRequestNumber: 42,
      pullRequestUrl: `${repositoryUrl}/pull/42`
    });

    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pullRequestNumber: 42,
          pullRequestUrl: "https://attacker.example/pull/42"
        }),
        { status: 201 }
      )
    );
    await expect(
      submitHouseAnswers(
        new URL("https://auth.example.test/"),
        "grant",
        "csv",
        "a".repeat(40),
        fetcher
      )
    ).rejects.toThrow(/unexpected pull request URL/i);
  });
});
