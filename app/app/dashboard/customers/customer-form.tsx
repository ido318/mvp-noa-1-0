"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type CustomerFormProps = {
  clinicId: string;
};

export function CustomerForm({ clinicId }: CustomerFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId,
        fullName,
        phone: phone || null,
        email: email || null,
        preferredContactMethod: "phone",
        status: "active",
      }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Failed to create customer");
      return;
    }

    router.push("/dashboard/customers");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="fullName">
          Full name
        </label>
        <input
          id="fullName"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="phone">
          Phone
        </label>
        <input
          id="phone"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Creating..." : "Create customer"}
      </button>
    </form>
  );
}
