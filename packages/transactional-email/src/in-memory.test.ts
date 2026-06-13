import { describe, expect, it } from "vitest";
import { InMemoryTransactionalEmail } from "./in-memory";

describe("InMemoryTransactionalEmail", () => {
  it("records sent messages and returns a message id", async () => {
    const email = new InMemoryTransactionalEmail();
    const res = await email.send({ to: "a@example.com", subject: "Hi", html: "<p>hi</p>" });

    expect(res.messageId).toMatch(/^mem_/);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({ to: "a@example.com", subject: "Hi" });
  });

  it("rejects an invalid recipient", async () => {
    const email = new InMemoryTransactionalEmail();
    await expect(
      email.send({ to: "not-an-email", subject: "Hi", html: "x" })
    ).rejects.toThrow();
  });

  it("rejects an empty subject", async () => {
    const email = new InMemoryTransactionalEmail();
    await expect(
      email.send({ to: "a@example.com", subject: "", html: "x" })
    ).rejects.toThrow();
  });
});
