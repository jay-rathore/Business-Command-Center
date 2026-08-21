import { Suspense } from "react";
import { LoginForm } from "@/components/shared/LoginForm";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <Card className="w-full max-w-sm p-8">
      <div className="mb-6 flex flex-col gap-1">
        <span className="font-display text-lg font-semibold text-text-primary">HPL Maker</span>
        <span className="text-sm text-text-muted">Business Owner Command Center</span>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </Card>
  );
}
