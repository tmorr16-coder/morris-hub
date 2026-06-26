"use client";

import { useRouter } from "next/navigation";
import { PlaidLink } from "@/components/PlaidLink";

export default function ConnectSection({
  label,
  variant,
}: {
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  return (
    <PlaidLink
      onConnected={() => router.refresh()}
      label={label}
      variant={variant}
    />
  );
}
