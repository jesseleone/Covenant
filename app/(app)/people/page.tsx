"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PERSON_TYPES } from "@/lib/schema";
import { useDB } from "@/lib/store";
import { companyById, currentAffiliation, dealsForPerson, lastTouchAt, relationshipStrength, userById } from "@/lib/selectors";
import { fmtDate, titleCase } from "@/lib/format";
import { Avatar, PageHeader, Table, TD, TH, THead, TR, TextLink, cn } from "@/components/ui/primitives";
import { StrengthChip } from "@/components/ui/chips";

export default function PeoplePage() {
  const db = useDB();
  const router = useRouter();
  const [type, setType] = useState<string>("all");

  const rows = useMemo(() => db.people
    .filter((p) => type === "all" || p.personType === type)
    .map((p) => {
      const aff = currentAffiliation(db, p.id);
      return { p, aff, company: companyById(db, aff?.companyId), strength: relationshipStrength(db, p.id), last: lastTouchAt(db, p.id), deals: dealsForPerson(db, p.id).length };
    })
    .sort((a, b) => a.p.fullName.localeCompare(b.p.fullName)), [db, type]);

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-6 py-6">
      <PageHeader title="People" subtitle="Management teams, sponsors, bankers, advisors and lenders." />
      <div className="flex flex-wrap gap-1.5">
        {["all", ...PERSON_TYPES.filter((t) => t !== "internal")].map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={cn("h-8 rounded-full border px-3 text-[13px]", type === t ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:text-text")}>
            {t === "all" ? "All" : titleCase(t)}
          </button>
        ))}
      </div>
      <Table>
        <THead><tr><TH>Name</TH><TH>Title</TH><TH>Company</TH><TH>Type</TH><TH>Relationship</TH><TH>Last touch</TH><TH className="text-right">Deals</TH><TH>Owner</TH></tr></THead>
        <tbody>
          {rows.map(({ p, aff, company, strength, last, deals }) => {
            const owner = userById(db, p.relationshipOwnerId);
            return (
              <TR key={p.id} onClick={() => router.push(`/people/${p.id}/overview`)}>
                <TD className="font-medium"><TextLink href={`/people/${p.id}/overview`}>{p.fullName}</TextLink></TD>
                <TD className="text-text-2">{aff?.title}</TD>
                <TD>{company && <TextLink href={`/companies/${company.id}/overview`}>{company.name}</TextLink>}</TD>
                <TD className="text-text-2">{titleCase(p.personType)}</TD>
                <TD><StrengthChip strength={strength} /></TD>
                <TD className="text-text-2">{fmtDate(last)}</TD>
                <TD className="text-right tabular-nums">{deals || "—"}</TD>
                <TD>{owner && <Avatar initials={owner.initials} title={owner.name} />}</TD>
              </TR>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
