"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      className="h-8 w-8 p-0 text-muted-foreground"
    >
      <LogOut className="h-4 w-4" />
    </Button>
  );
}
