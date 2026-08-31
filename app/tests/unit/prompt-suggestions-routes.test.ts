import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ok } from "@/lib/errors/app-error";
import { GET } from "@/app/api/prompt-suggestions/route";
import { POST as rejectRoute } from "@/app/api/prompt-suggestions/[id]/reject/route";
import { POST as approveRoute } from "@/app/api/prompt-suggestions/[id]/approve/route";

const mockGetActorAndServices = vi.fn();

vi.mock("@/lib/api/actor", () => ({
  getActorAndServices: () => mockGetActorAndServices(),
}));

const ownerActor = {
  userId: "u1",
  clinicIds: ["c1"],
  defaultClinicId: "c1",
  memberships: [{ clinicId: "c1", role: "owner" }],
};

describe("prompt-suggestions API routes", () => {
  beforeEach(() => {
    mockGetActorAndServices.mockReset();
  });

  it("GET /prompt-suggestions returns 401 when unauthenticated", async () => {
    mockGetActorAndServices.mockRejectedValue(AppError.unauthorized());

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("GET /prompt-suggestions lists pending suggestions for the actor", async () => {
    const listPending = vi.fn().mockResolvedValue(ok([{ id: "sugg-1", status: "pending" }]));
    mockGetActorAndServices.mockResolvedValue({ actor: ownerActor, promptSuggestion: { listPending } });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listPending).toHaveBeenCalledWith(ownerActor);
  });

  it("POST reject returns 401 when unauthenticated", async () => {
    mockGetActorAndServices.mockRejectedValue(AppError.unauthorized());

    const response = await rejectRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/reject", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("POST reject delegates to the service with the actor and id", async () => {
    const reject = vi.fn().mockResolvedValue(ok({ id: "sugg-1", status: "rejected" }));
    mockGetActorAndServices.mockResolvedValue({ actor: ownerActor, promptSuggestion: { reject } });

    const response = await rejectRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/reject", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );

    expect(response.status).toBe(200);
    expect(reject).toHaveBeenCalledWith(ownerActor, "sugg-1");
  });

  it("POST approve returns 401 when unauthenticated", async () => {
    mockGetActorAndServices.mockRejectedValue(AppError.unauthorized());

    const response = await approveRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("POST approve reports published:false when regression could not be confirmed", async () => {
    const approve = vi.fn().mockResolvedValue(ok({ id: "sugg-1", status: "pending" }));
    mockGetActorAndServices.mockResolvedValue({ actor: ownerActor, promptSuggestion: { approve } });

    const response = await approveRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );
    const body = (await response.json()) as { data: { published: boolean } };

    expect(response.status).toBe(200);
    expect(body.data.published).toBe(false);
    expect(approve).toHaveBeenCalledWith(ownerActor, "sugg-1");
  });

  it("POST approve reports published:true on a successful publish", async () => {
    const approve = vi.fn().mockResolvedValue(ok({ id: "sugg-1", status: "published" }));
    mockGetActorAndServices.mockResolvedValue({ actor: ownerActor, promptSuggestion: { approve } });

    const response = await approveRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );
    const body = (await response.json()) as { data: { published: boolean } };

    expect(response.status).toBe(200);
    expect(body.data.published).toBe(true);
  });

  it("POST approve reports a non-empty message for the 'approved' status (non-prompt category, no regression run)", async () => {
    const approve = vi.fn().mockResolvedValue(ok({ id: "sugg-1", status: "approved" }));
    mockGetActorAndServices.mockResolvedValue({ actor: ownerActor, promptSuggestion: { approve } });

    const response = await approveRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );
    const body = (await response.json()) as { data: { published: boolean; message: string } };

    expect(response.status).toBe(200);
    expect(body.data.published).toBe(false);
    expect(body.data.message).not.toBe("");
  });
});
