export type ClinicRole = "owner" | "admin" | "staff" | "veterinarian";

export type Clinic = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ClinicMembership = {
  id: string;
  clinicId: string;
  userId: string;
  role: ClinicRole;
  createdAt: string;
  updatedAt: string;
};

export type ClinicMembershipWithClinic = ClinicMembership & {
  clinic: Pick<Clinic, "id" | "name" | "slug">;
};
