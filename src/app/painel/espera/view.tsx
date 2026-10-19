import { formatDate, waLink } from "@/lib/format";
import { HelpTip } from "@/components/help-tip";
import { dayLabel, PERIOD_LABEL, type WaitlistEntry } from "@/lib/waitlist";
import { EntryActions } from "./entry-actions";

export function EsperaView({ business, entries, open, bookingUrl, today, tomorrow }: { business: { name: string }; entries: WaitlistEntry[]; open: Map<string, string[]>; bookingUrl: string; today: string; tomorrow: string }) {

  const byDay = entries.reduce<Record<string, WaitlistEntry[]>>((acc, e) => ((acc[e.desired_date] ??= []).push(e), acc), {});
  const withOpening = entries.filter((e) => e.status === "waiting" && (open.get(e.id)?.length ?? 0) > 0).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lista de espera<HelpTip>Quando o dia que o cliente quer está lotado, ele deixa nome e WhatsApp na sua página. Se alguém desmarcar, avisamos aqui e em &quot;Hoje&quot; para você chamar quem está na fila. Quando a pessoa marca, ela sai da lista sozinha.</HelpTip></h1>
        <p className="text-sm text-muted">
          {entries.length === 0 ? "Ninguém esperando agora" : `${entries.length} ${entries.length === 1 ? "pessoa esperando" : "pessoas esperando"}`}
          {withOpening > 0 && <> · <span className="font-semibold text-good">{withOpening} com vaga aberta</span></>}
        </p>
      </div>

      {entries.length === 0 && (
        <div className="card text-sm text-muted">Quando um dia lotar, seus clientes podem entrar na fila pela sua página de agendamento. Eles aparecem aqui, na ordem em que chegaram.</div>
      )}

      {Object.entries(byDay).map(([date, list]) => (
        <section key={date} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {date === today ? "Hoje" : date === tomorrow ? "Amanhã" : formatDate(`${date}T12:00:00Z`, "UTC", { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <div className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]">
            {list.map((e, idx) => {
              const times = open.get(e.id) ?? [];
              const name = e.customer?.name ?? "Cliente";
              const msg = times.length
                ? `Oi, ${name.split(" ")[0]}! Abriu horário para ${e.service?.name ?? "o serviço"} ${dayLabel(date, today, tomorrow)} no ${business.name}: ${times.slice(0, 4).join(", ")}. Para garantir, marque aqui: ${bookingUrl}`
                : `Oi, ${name.split(" ")[0]}! Você está na lista de espera do ${business.name} para ${dayLabel(date, today, tomorrow)}. Assim que abrir um horário eu te aviso.`;
              return (
                <div key={e.id} className="flex flex-wrap items-center gap-3 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-sm font-bold">{idx + 1}º</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{name}</p>
                    <p className="truncate text-sm text-muted">{e.service?.name}{e.professional ? ` · ${e.professional.name}` : ""} · {PERIOD_LABEL[e.period]}</p>
                    {times.length > 0
                      ? <p className="mt-1 text-xs font-medium text-good">Vaga aberta: {times.slice(0, 6).join(", ")}{times.length > 6 ? "…" : ""}</p>
                      : <p className="mt-1 text-xs text-muted">Sem vaga no período ainda</p>}
                  </div>
                  {e.status === "notified" && <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">avisado</span>}
                  <div className="flex w-full gap-2 sm:w-auto">
                    {e.customer?.phone && (
                      <EntryActions id={e.id} wa={waLink(e.customer.phone, msg)} notify={times.length > 0} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
