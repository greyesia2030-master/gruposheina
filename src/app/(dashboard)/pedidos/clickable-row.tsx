"use client";

import { useRouter } from "next/navigation";

interface ClickableRowProps {
  href: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * <tr> clickable que navega a href.
 * Los botones de acción deben llamar e.stopPropagation() para no activar la navegación.
 */
export function ClickableRow({ href, className = "", children }: ClickableRowProps) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(href)}
      className={`cursor-pointer ${className}`}
    >
      {children}
    </tr>
  );
}
