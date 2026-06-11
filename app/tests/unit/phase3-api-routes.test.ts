import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetActorAndServices = vi.fn();

vi.mock("@/lib/api/actor", () => ({
  getActorAndServices: () => mockGetActorAndServices(),
}));

describe("phase3 API routes", () => {
  beforeEach(() => {
    mockGetActorAndServices.mockReset();
  });

  it("POST /api/appointments returns 400 on invalid payload", async () => {
    const { POST } = await import("@/app/api/appointments/route");
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      appointment: { createAppointment: vi.fn() },
    });

    const response = await POST(
      new Request("http://localhost/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("GET /api/calendar/availability validates required query params", async () => {
    const { GET } = await import("@/app/api/calendar/availability/route");
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      calendar: { availabilityByDate: vi.fn() },
    });

    const response = await GET(new Request("http://localhost/api/calendar/availability"));
    expect(response.status).toBe(400);
  });
});
