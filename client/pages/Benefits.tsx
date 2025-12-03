import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, TicketCheck, Copy } from "lucide-react";

function parseBenefit(code: string | null) {
  if (!code) return null;
  const digits = code.replace(/\D+/g, "");
  const last3 = digits.slice(-3);
  if (!["500", "600", "700", "800"].includes(last3)) return null;
  const map: Record<string, { title: string; desc: string }> = {
    "500": {
      title: "Vouchers",
      desc: "Vouchers issued for future travel.",
    },
    "600": {
      title: "One flight in the first 3 weeks",
      desc: "Book one eligible flight within the first three weeks.",
    },
    "700": {
      title: "Money",
      desc: "Cash compensation will be arranged according to policy.",
    },
    "800": {
      title: "Full refund + extra flight",
      desc: "You’ll get a full refund and an additional flight.",
    },
  };
  return { ending: last3, ...map[last3] };
}

export default function Benefits() {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sl_cancel_code");
      setCode(saved);
    } catch {
      setCode(null);
    }
  }, []);

  const benefit = useMemo(() => parseBenefit(code), [code]);

  if (!benefit || !code) {
    return (
      <main className="min-h-[70vh] container py-16">
        <div className="max-w-xl mx-auto">
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle>No benefit found</CardTitle>
              <CardDescription>
                We couldn’t find a saved cancellation code on this device.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <a href="/">
                <Button size="lg">Start a cancellation</Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] container py-16">
      <div className="max-w-3xl mx-auto">
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-6 w-6" />
              <CardTitle>Benefit confirmed</CardTitle>
            </div>
            <CardDescription>
              Your personalized benefit from your cancellation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border p-5 bg-muted/30">
              <div className="flex items-center gap-2">
                <TicketCheck className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Your code
                </span>
              </div>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="animated-code text-lg sm:text-3xl font-extrabold tabular-nums select-all whitespace-nowrap">
                  {code}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(code);
                    } catch {}
                  }}
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xl font-semibold">{benefit.title}</p>
              <p className="text-muted-foreground">{benefit.desc}</p>
            </div>

            <p className="text-sm text-muted-foreground">
              Save this code now. We don’t store it for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href="/" className="flex-1 sm:flex-initial">
                <Button variant="secondary" className="w-full">
                  Back home
                </Button>
              </a>
              <a
                href="https://slairlines.netlify.app"
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-initial"
              >
                <Button className="w-full">Account</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
