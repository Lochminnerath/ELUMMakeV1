import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PlaneTakeoff, TicketCheck, CheckCircle2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Step =
  | "form"
  | "perks"
  | "perksDigits"
  | "processingPerks"
  | "processing1"
  | "welcome"
  | "processing2"
  | "confirmed";

function useProgress(durationMs: number, active: boolean) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  const startTs = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const step = (ts: number) => {
      if (startTs.current == null) startTs.current = ts;
      const elapsed = ts - startTs.current;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setValue(pct);
      if (pct < 100) {
        raf.current = requestAnimationFrame(step);
      }
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      startTs.current = null;
      setValue(0);
    };
  }, [durationMs, active]);

  return value;
}

function generateBenefitCode() {
  const endings = ["500", "600", "700", "800"] as const;
  const ending = endings[Math.floor(Math.random() * endings.length)];
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let body = "";
  for (let i = 0; i < 8; i++) {
    body += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  const code = `SL-${body}-${ending}`;
  let benefit = "";
  if (ending === "500") benefit = "Vouchers issued";
  if (ending === "600") benefit = "One flight within the first 3 weeks";
  if (ending === "700") benefit = "Cash compensation";
  if (ending === "800") benefit = "Full refund plus an additional flight";
  return { code, ending, benefit };
}

export default function Index() {
  const [step, setStep] = useState<Step>("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [last4, setLast4] = useState("");
  const [generated, setGenerated] = useState<{
    code: string;
    ending: string;
    benefit: string;
  } | null>(null);
  const name = useMemo(
    () => `${firstName.trim()} ${lastName.trim()}`.trim(),
    [firstName, lastName],
  );

  const [durationP, setDurationP] = useState<number>(1600);
  const [duration1, setDuration1] = useState<number>(2400);
  const [duration2, setDuration2] = useState<number>(2200);
  const progressP = useProgress(durationP, step === "processingPerks");
  const progress1 = useProgress(duration1, step === "processing1");
  const progress2 = useProgress(duration2, step === "processing2");
  const [rebookPulse, setRebookPulse] = useState(false);

  useEffect(() => {
    let showTimer: number | undefined;
    let hideTimer: number | undefined;

    function schedule() {
      const delay = Math.floor(7000 + Math.random() * 9000); // 7–16s
      showTimer = window.setTimeout(() => {
        setRebookPulse(true);
        hideTimer = window.setTimeout(() => {
          setRebookPulse(false);
          schedule();
        }, 2000); // highlight for 2s
      }, delay);
    }

    if (step === "confirmed") {
      schedule();
    }

    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
      setRebookPulse(false);
    };
  }, [step]);

  useEffect(() => {
    if (step === "processingPerks") {
      const d = Math.floor(1200 + Math.random() * 1600);
      setDurationP(d);
      const t = setTimeout(() => setStep("processing1"), d + 120);
      return () => clearTimeout(t);
    }
    if (step === "processing1") {
      const d = Math.floor(1800 + Math.random() * 2200);
      setDuration1(d);
      const t = setTimeout(() => setStep("welcome"), d + 150);
      return () => clearTimeout(t);
    }
    if (step === "processing2") {
      const d = Math.floor(1800 + Math.random() * 2600);
      setDuration2(d);
      const t = setTimeout(() => {
        const g = generateBenefitCode();
        setGenerated(g);
        try {
          localStorage.setItem("sl_cancel_code", g.code);
        } catch {}
        setStep("confirmed");
      }, d + 150);
      return () => clearTimeout(t);
    }
  }, [step]);

  const disabled = !firstName.trim() || !lastName.trim();

  const onCopy = async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.code);
      alert("Code copied. Please save this code for your records.");
    } catch {}
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_600px_at_80%_-10%,hsl(var(--accent)/.35),transparent),radial-gradient(800px_400px_at_10%_20%,hsl(var(--secondary)/.8),transparent)] from-background to-background">
      <section className="container py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <Card className="backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-white/5 border-0 shadow-xl">
            <CardHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-3 text-primary">
                <PlaneTakeoff className="h-6 w-6" />
                <CardTitle className="text-3xl">Flight Cancellation</CardTitle>
              </div>
              <CardDescription>
                Manage a cancellation in a few simple steps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {step === "form" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        First name
                      </label>
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                        autoComplete="given-name"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Last name
                      </label>
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last name"
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      size="lg"
                      className="px-8"
                      onClick={() => setStep("perks")}
                      disabled={disabled}
                    >
                      Continue
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      We’ll verify your details securely.
                    </p>
                  </div>
                </div>
              )}

              {step === "perks" && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold">
                    Do you have a perks card?
                  </h3>
                  <div className="flex gap-3">
                    <Button onClick={() => setStep("perksDigits")}>Yes</Button>
                    <Button
                      variant="secondary"
                      onClick={() => setStep("processing1")}
                    >
                      No
                    </Button>
                  </div>
                </div>
              )}

              {step === "perksDigits" && (
                <div className="space-y-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Last 4 digits of your card
                    </label>
                    <Input
                      inputMode="numeric"
                      pattern="\\d{4}"
                      maxLength={4}
                      placeholder="1234"
                      value={last4}
                      onChange={(e) => {
                        const v = e.target.value
                          .replace(/[^0-9]/g, "")
                          .slice(0, 4);
                        setLast4(v);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => setStep("processingPerks")}
                      disabled={last4.length !== 4}
                    >
                      Verify
                    </Button>
                    <Button variant="ghost" onClick={() => setStep("perks")}>
                      Back
                    </Button>
                  </div>
                </div>
              )}

              {step === "processingPerks" && (
                <div className="space-y-6">
                  <p className="text-lg">Validating perks securely…</p>
                  <Progress value={progressP} />
                  <p className="text-sm text-muted-foreground">
                    Checking your perks details.
                  </p>
                </div>
              )}

              {step === "processing1" && (
                <div className="space-y-6">
                  <p className="text-lg">Processing securely…</p>
                  <Progress value={progress1} />
                  <p className="text-sm text-muted-foreground">
                    Verifying your details. This only takes a few seconds.
                  </p>
                </div>
              )}

              {step === "welcome" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold">
                      Welcome back{name ? `, ${name.split(" ")[0]}` : ""}.
                    </h2>
                    <p className="text-muted-foreground">
                      We’re sorry plans changed.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="lg"
                        variant="destructive"
                        className="h-14 text-lg px-8"
                      >
                        Cancel my flight
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Confirm cancellation
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will cancel your current flight. You can rebook
                          afterward.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep my flight</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => setStep("processing2")}
                        >
                          Confirm cancel
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {step === "processing2" && (
                <div className="space-y-6">
                  <p className="text-lg">Processing your cancellation…</p>
                  <Progress value={progress2} />
                  <p className="text-sm text-muted-foreground">Almost there.</p>
                </div>
              )}

              {step === "confirmed" && generated && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-6 w-6" />
                    <h3 className="text-xl font-semibold">
                      We’ve confirmed your cancellation.
                    </h3>
                  </div>

                  <div className={cn("rounded-lg border p-4 bg-muted/30")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TicketCheck className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                          Your benefit code
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={onCopy}>
                        <Copy className="h-4 w-4" /> Copy
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-baseline gap-3">
                      <span className="animated-code text-3xl font-extrabold tabular-nums">
                        {generated.code}
                      </span>
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                        ends with {generated.ending}
                      </span>
                    </div>
                    <p className="mt-3 text-sm">
                      {generated.ending === "500" &&
                        "500: You’ll receive vouchers you can apply to future journeys."}
                      {generated.ending === "600" &&
                        "600: One flight within the first 3 weeks from today."}
                      {generated.ending === "700" &&
                        "700: Monetary compensation will be arranged."}
                      {generated.ending === "800" &&
                        "800: Full refund plus an additional flight on us."}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Save this code now. We don’t store it for you.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href="https://slairlines.netlify.app/flights"
                      target="_blank"
                      rel="noreferrer"
                      className="w-full sm:w-auto"
                    >
                      <Button
                        size="lg"
                        className={cn("w-full", rebookPulse && "btn-attention")}
                      >
                        Rebook
                      </Button>
                    </a>
                    <a
                      href="https://slairlines.netlify.app"
                      target="_blank"
                      rel="noreferrer"
                      className="w-full sm:w-auto"
                    >
                      <Button size="lg" className="w-full">
                        Proceed to your account
                      </Button>
                    </a>
                    <a href="/benefits" className="w-full sm:w-auto">
                      <Button size="lg" variant="secondary" className="w-full">
                        See my benefits
                      </Button>
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
