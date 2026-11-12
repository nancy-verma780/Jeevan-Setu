import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { staff } from "@/lib/api/endpoints";
import { formatStamp } from "@/lib/format";

function NoteList({ queryKey, load, add, label, empty, max }: { queryKey: unknown[]; load: () => Promise<{ id: number; text: string; created_at: string; author: string }[]>; add: (text: string) => Promise<unknown>; label: string; empty: string; max: number }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [text, setText] = useState("");
  const list = useQuery({ queryKey, queryFn: load });
  const save = useMutation({
    mutationFn: () => add(text.trim()),
    onSuccess: () => {
      setText("");
      void client.invalidateQueries({ queryKey });
    },
  });
  return (
    <div className="flex flex-col gap-2">
      {list.data && list.data.length === 0 && <p className="text-sm text-slate-600">{empty}</p>}
      {list.data && list.data.length > 0 && (
        <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
          {list.data.map((n) => (
            <li key={n.id} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm">
              <p className="whitespace-pre-wrap">{n.text}</p>
              <p className="mt-1 text-xs text-slate-600">
                {n.author}, {formatStamp(n.created_at, true)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Textarea aria-label={label} value={text} maxLength={max} onChange={(e) => setText(e.target.value)} placeholder={label} className="min-h-[64px]" />
      <Button size="sm" variant="secondary" disabled={!text.trim()} loading={save.isPending} onClick={() => save.mutate()}>
        {t("notes.add")}
      </Button>
    </div>
  );
}

/** Internal comments on one case, visible only to this hospital's staff. */
export function CaseComments({ assignmentId }: { assignmentId: number }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="case-comments" className="flex flex-col gap-2">
      <h3 id="case-comments" className="text-sm font-semibold text-slate-700">
        {t("notes.caseTitle")}
      </h3>
      <NoteList queryKey={["comments", assignmentId]} load={() => staff.comments(assignmentId)} add={(x) => staff.addComment(assignmentId, x)} label={t("notes.casePlaceholder")} empty={t("notes.caseEmpty")} max={500} />
    </section>
  );
}

/** Shift handover notes for the hospital team. */
export function HandoverNotes() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="handover" className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
      <h2 id="handover" className="font-bold">
        {t("notes.handoverTitle")}
      </h2>
      <NoteList queryKey={["handover"]} load={staff.handover} add={staff.addHandover} label={t("notes.handoverPlaceholder")} empty={t("notes.handoverEmpty")} max={1000} />
    </section>
  );
}
