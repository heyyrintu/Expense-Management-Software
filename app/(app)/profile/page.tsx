import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/guard";
import { maskAccountNumber } from "@/lib/domain/reimbursement";
import { scopedDb } from "@/lib/db/scoped";
import { BankDetailsForm } from "./bank-details-form";

export default async function ProfilePage() {
  const ctx = await requireSession();
  const user = await scopedDb(ctx.orgId).user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: {
      name: true,
      email: true,
      bankAccountName: true,
      bankAccountNumber: true,
      bankIfsc: true,
      upiId: true,
    },
  });

  return (
    <section className="grid max-w-md gap-4">
      <div>
        <h1 className="text-xl font-semibold">My profile</h1>
        <p className="text-muted-foreground text-sm">
          {user.name} · {user.email}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bank details for reimbursement</CardTitle>
          <CardDescription>
            Finance uses these to pay you. Your account number is stored
            securely and always shown masked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.bankAccountNumber ? (
            <div className="mb-4 grid gap-1 rounded-lg border p-3 text-sm">
              <p><span className="text-muted-foreground">Account holder:</span> {user.bankAccountName}</p>
              <p>
                <span className="text-muted-foreground">Account number:</span>{" "}
                {maskAccountNumber(user.bankAccountNumber)}
              </p>
              {user.bankIfsc ? (
                <p><span className="text-muted-foreground">IFSC:</span> {user.bankIfsc}</p>
              ) : null}
              {user.upiId ? (
                <p><span className="text-muted-foreground">UPI:</span> {user.upiId}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground mb-4 text-sm">
              No bank details on file yet.
            </p>
          )}
          <BankDetailsForm
            defaults={{
              bankAccountName: user.bankAccountName ?? "",
              bankIfsc: user.bankIfsc ?? "",
              upiId: user.upiId ?? "",
            }}
            hasExisting={user.bankAccountNumber !== null}
          />
        </CardContent>
      </Card>
    </section>
  );
}
