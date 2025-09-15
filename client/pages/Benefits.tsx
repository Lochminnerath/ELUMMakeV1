import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Benefits() {
  return (
    <main className="min-h-[70vh] container py-16">
      <div className="max-w-3xl mx-auto">
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle>Benefits</CardTitle>
            <CardDescription>Overview of what each benefit code means.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="font-medium">500 — Vouchers</p>
              <p className="text-muted-foreground">Vouchers issued for future travel.</p>
            </div>
            <div>
              <p className="font-medium">600 — One flight in the first 3 weeks</p>
              <p className="text-muted-foreground">Book one eligible flight within the first three weeks.</p>
            </div>
            <div>
              <p className="font-medium">700 — Money</p>
              <p className="text-muted-foreground">Cash compensation will be arranged according to policy.</p>
            </div>
            <div>
              <p className="font-medium">800 — Full refund + extra flight</p>
              <p className="text-muted-foreground">You’ll get a full refund and an additional flight.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
