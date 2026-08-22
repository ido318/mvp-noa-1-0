import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetActorAndServices = vi.fn();

vi.mock("@/lib/api/actor", () => ({
  getActorAndServices: () => mockGetActorAndServices(),
}));

describe("phase2 API routes", () => {
  beforeEach(() => {
    mockGetActorAndServices.mockReset();
  });

  it("POST /api/customers returns 400 on invalid payload", async () => {
    const { POST } = await import("@/app/api/customers/route");
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      customer: { createCustomer: vi.fn() },
    });

    const response = await POST(
      new Request("http://localhost/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("POST /api/customers returns 400 on malformed JSON", async () => {
    const { POST } = await import("@/app/api/customers/route");
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      customer: { createCustomer: vi.fn() },
    });

    const response = await POST(
      new Request("http://localhost/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/customers returns service items", async () => {
    const { GET } = await import("@/app/api/customers/route");
    const listCustomers = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ id: "cust1", fullName: "Test", clinicId: "c1" }],
    });
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      customer: { listCustomers },
    });

    const response = await GET(new Request("http://localhost/api/customers?q=te"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.items).toHaveLength(1);
  });

  it("GET /api/search rejects unknown entity", async () => {
    const { GET } = await import("@/app/api/search/route");
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      customer: { listCustomers: vi.fn() },
      pet: { listPets: vi.fn() },
    });

    const response = await GET(
      new Request("http://localhost/api/search?entity=unknown&q=abc"),
    );
    expect(response.status).toBe(400);
  });

  it("GET /api/pets returns 400 on invalid customerId", async () => {
    const { GET } = await import("@/app/api/pets/route");
    const listPets = vi.fn();
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      pet: { listPets },
    });

    const response = await GET(
      new Request("http://localhost/api/pets?customerId=not-a-uuid"),
    );

    expect(response.status).toBe(400);
    expect(listPets).not.toHaveBeenCalled();
  });
});
