// CTO board: the tickets of one Herdr space, live, from ~/claude-workflows/*/state.md.
// Props: { space } shows the board; { file } shows that markdown file (the plan view).
// Read-only: it never writes a state file and never sends anything to a Lead.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { spaces, terminals, props, theme, settings, run, hc, exec, home, readTextFile, watchFolder, openOverlay, closeOverlay, notify, playSound } from "herdr";
import { parseState, mdPath, steps, ago, hhmm, LIST_STATES, splitStates } from "./parse.js";

const ASK = { plan_ready: "plano pronto", blocked: "bloqueado" };
const WAIT = { plan_ready: "esperando a sua aprovação do plano", blocked: "esperando a sua resposta" }; // "agora" without a live message
const NO_LEAD = new Set(["queued", "done", "cancelled"]); // without a live Lead, anything else is an orphan
const DAY = 86400000;

const mono = () => settings().font_family ?? "JetBrains Mono";
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const openFile = (file, on) => openOverlay({ mod: "cto-board", props: { file, on }, kind: "dialog", width: 0.6, height: 0.8 });
// A space of this window: on this computer its id is the bare id, on another machine "<machine>/<id>".
const spaceOf = (id) => spaces().find((s) => s.id === id || s.id.endsWith(`/${id}`)) ?? null;
const exists = (path, on) => readTextFile(path, { on }).then((x) => x !== null, () => false);

const chip = (text, color) =>
  div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(color + "26").text_size(10.5).font_semibold().text_color(color).child(text);

// A chip that opens `url`, and not the card under it.
const linkChip = (text, url, color, id) => chip(`${text} ↗`, color).font_family(mono()).id(id).cursor_pointer()
  .hover((st) => st.bg(color + "40")).on_click((_e, cx) => { cx.stop_propagation(); cx.open_url(url); });

// The ticket id; with a URL, a link to the ticket.
const ticketChip = (t, s, id) => s.url ? linkChip(s.ticket, s.url, t.accent, id) : chip(s.ticket, t.muted).font_family(mono());

const title = (text) => div().min_w(0).truncate().text_size(13.5).font_bold().child(text);

const button = (t, id, label, act) =>
  div().id(id).flex_none().px(8).h(22).flex().items_center().rounded(5).border(1).border_color(t.border)
    .text_size(11.5).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover))
    .on_click((_e, cx) => { cx.stop_propagation(); act(cx); })
    .child(label);

const section = (t, title) => div().pt(12).pb(2).text_size(11).font_medium().text_color(t.dim).child(title);

const card = (t, id, border) => v_flex().id(id).flex_none().p(10).gap(6).rounded(8).bg(t.background).border(1).border_color(border ?? t.border);

function step(t, x, amber) {
  const el = div().flex_1().min_w(0).h(18).px(4).rounded(5).border(1).text_size(10.5).text_center().truncate();
  if (x.state === "done") return el.bg(t.raised).border_color(t.raised).text_color(t.muted).child(x.name);
  if (x.state !== "current") return el.border_color(t.border).text_color(t.dim).child(x.name);
  const c = amber ? t.blocked : t.accent;
  return el.bg(c + "26").border_color(c).text_color(c).font_semibold().child(x.name);
}

export default class CtoBoard extends View {
  init(_props, cx) {
    const p = props() ?? {};
    this.tickets = [];
    this.extra = {}; // address -> { labels, name } from `hc get`, only for terminals that come without labels
    if (p.file) {
      cx.spawn(async (cx) => { this.text = await readTextFile(p.file, { on: p.on ?? null }).catch(() => null); this.read = true; cx.notify(); });
      return;
    }
    if (!p.space) return;
    this.dir = `${home()}/claude-workflows`;
    this.reload(cx);
    // Verifiers write many screenshots: events only mark the board dirty, this timer reloads.
    cx.timer.every(2000, (cx) => { if (this.dirty) this.reload(cx); });
    cx.timer.every(30000, (cx) => this.reload(cx));
    if (spaceOf(p.space)?.machine) return; // another machine: no watch here, the 30 s reload reads it
    cx.spawn(async (cx) => {
      try {
        for (;;) {
          const paths = await watchFolder(this.dir);
          // A state.md, a ticket folder, or the root (refresh everything).
          if (paths.some((f) => f.endsWith("/state.md") || !f.slice(this.dir.length + 1).includes("/"))) this.dirty = true;
          await cx.sleep(0); // throws once a newer build replaces this one, ending the loop
        }
      } catch {} // no watch: the 30 s reload still runs
    });
  }

  reload(cx) {
    // A call that never returns (a dropped SSH link) must not freeze the board: after 60 s, reload again.
    if (this.loading && Date.now() - this.loading < 60000) return;
    const mine = (this.loading = Date.now());
    this.dirty = false;
    cx.spawn(async (cx) => {
      try {
        const space = props().space;
        const on = spaceOf(space)?.machine ?? null;
        // The state files live on the space's machine. One exec reads them all: a read per file
        // overflows the 1024 host tasks that every mod copy shares. Unreachable: keep the last board.
        const got = await exec("sh", ["-c", LIST_STATES, "sh", space], { on, timeout: 20000 }).then((r) => splitStates(r.stdout), () => null);
        if (!got) return;
        const tickets = (await Promise.all(got.states.map(async ({ dir, text }) => {
          const name = dir.split("/").pop();
          const s = parseState(text, name);
          if (s.space !== space) return null;
          s.key = name;
          s.dir = dir;
          s.on = on;
          const md = s.status === "blocked" ? mdPath(s.last?.text, dir, got.home) : null;
          s.md = md && (await exists(md, on)) ? md : null;
          return s;
        }))).filter(Boolean);
        await this.fillLabels(cx, on);
        if (mine !== this.loading) return; // a newer reload took over
        this.alert(tickets);
        this.tickets = tickets;
        this.loadedAt = new Date();
      } finally {
        if (mine === this.loading) this.loading = 0;
        cx.notify();
      }
    });
  }

  // terminals() carries labels and name; this fallback reads `hc get` once per address when not.
  // Only the terminals of the space's machine, and 5 s at most each: another machine's dropped
  // link must not hold this board.
  async fillLabels(cx, on) {
    for (const t of terminals()) {
      if (t.state !== "live" || t.labels || this.extra[t.address]) continue;
      if ((t.address.includes("/") ? t.address.split("/")[0] : null) !== on) continue;
      const r = await Promise.race([hc(["get", t.address, "--json"]).catch(() => null), cx.sleep(5000).then(() => null)]);
      try {
        const j = JSON.parse(r.stdout);
        this.extra[t.address] = { labels: j.labels ?? {}, name: j.name };
      } catch {}
    }
  }

  // Live terminals of this space, with their labels and the agent's own line ("approve Bash: …").
  // terminals() has it in `report` ({ app, kind, msg, state }, or a string); `hc get` in `status`.
  live() {
    const space = props().space;
    return terminals().filter((t) => t.state === "live").map((t) => {
      const x = this.extra[t.address];
      const msg = [t.report, t.report?.msg, t.status?.msg].find((m) => typeof m === "string" && m.trim()) ?? null;
      return { address: t.address, status: t.status, msg, name: t.name ?? x?.name, labels: t.labels ?? x?.labels ?? {} };
    }).filter((t) => t.labels["herdr.space"] === space);
  }

  leadOf(s, leads) {
    return leads.find((t) => t.labels.ticket === s.ticket || (s.lead && t.name === s.lead)) ?? null;
  }

  // A ticket that turned plan_ready or blocked since the last reload of this copy.
  alert(tickets) {
    const before = this.before;
    this.before = new Map(tickets.map((s) => [s.key, s.status]));
    if (!before) return;
    const leads = this.live().filter((t) => t.labels.role === "lead");
    let sound = false;
    for (const s of tickets) {
      if (!ASK[s.status] || before.get(s.key) === s.status) continue;
      const lead = this.leadOf(s, leads);
      notify({ title: `${s.ticket} ${ASK[s.status]}`, body: s.last?.text ?? "", level: "warning",
        ...(lead && { action: { name: "agent.focus", args: { terminal: lead.address } } }) });
      sound = true;
    }
    if (sound) playSound("blocked");
  }

  render(cx) {
    const t = theme();
    const p = props() ?? {};
    if (p.file) return this.planView(t, p);
    const root = v_flex().id("cto-board").size_full().min_h(0).bg(t.surface).text_color(t.foreground).text_size(12.5);
    const space = p.space && spaceOf(p.space);
    const problem = !p.space ? "Space não informado."
      : !space ? `Space ${p.space} não existe nesta janela.` : null;
    if (problem) return root.p(16).child(div().text_color(t.muted).child(problem));

    const now = Date.now();
    const live = this.live();
    const leads = live.filter((x) => x.labels.role === "lead");
    const cto = live.find((x) => x.labels.role === "cto");
    const rows = this.tickets.map((s) => ({ s, lead: this.leadOf(s, leads) }));
    const need = rows.flatMap((r) => {
      const why = ASK[r.s.status] ?? (r.lead?.status === "blocked" ? "pedido de permissão" : null);
      return why ? [{ ...r, why }] : [];
    });
    const needs = new Set(need.map((r) => r.s.key));
    const working = rows.filter((r) => r.lead || !NO_LEAD.has(r.s.status))
      .sort((a, b) => Number(Boolean(b.lead)) - Number(Boolean(a.lead)) || (b.s.updatedAt ?? 0) - (a.s.updatedAt ?? 0));
    const queue = this.tickets.filter((s) => s.status === "queued").sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
    const activity = this.tickets
      .flatMap((s) => s.log.map((l, i) => ({ ...l, i, s })).filter((l) => l.at && now - l.at <= DAY))
      .sort((a, b) => b.at - a.at || b.i - a.i)
      .slice(0, 12);

    const sub = [cto && `CTO ${cto.address}`, this.loadedAt && `atualizado ${ago(this.loadedAt, now)}`].filter(Boolean).join(" · ");
    const header = h_flex().flex_none().px(12).py(10).gap(8).items_start().border_b(1).border_color(t.border)
      .child(v_flex().flex_1().min_w(0).gap(2)
        .child(div().truncate().text_size(15).font_semibold().child(space.name))
        .child(div().truncate().text_size(11).text_color(t.dim).child(sub)))
      .child(h_flex().flex_none().gap(4).pt(2)
        .child(chip(count(leads.length, "Lead", "Leads"), t.muted))
        .child(chip(`${queue.length} na fila`, t.muted))
        .when(need.length > 0, (el) => el.child(chip(`${need.length} espera você`, t.blocked))));

    const body = v_flex().id("cto-body").flex_1().min_h(0).overflow_y_scrollbar().px(12).pb(12).gap(6);
    if (this.loadedAt && !this.tickets.length) body.child(div().pt(12).text_color(t.muted).child("Nenhum ticket neste space. Peça um no chat do CTO."));
    if (need.length) body.child(section(t, "Precisa de você")).children(need.map((r) => this.needCard(t, r, now)));
    if (working.length) body.child(section(t, "Leads")).children(working.map((r) => this.leadCard(t, r, now)));
    if (queue.length) body.child(section(t, "Fila")).children(queue.map((s, k) =>
      h_flex().flex_none().gap(8).items_center().py(2)
        .child(div().size(8).flex_none().rounded(4).border(1.5).border_color(t.dim))
        .when(Boolean(s.title), (el) => el.child(title(s.title)))
        .child(ticketChip(t, s, `tk-q-${s.key}`))
        .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(s.last?.text ?? ""))
        .child(div().flex_none().text_size(11).text_color(t.dim).child(`${k + 1}º da fila`))));
    if (activity.length) body.child(section(t, "Atividade")).children(activity.map((a) =>
      h_flex().flex_none().gap(8).items_center().text_size(11.5).text_color(needs.has(a.s.key) ? t.blocked : t.muted)
        .child(div().flex_none().font_family(mono()).text_color(t.dim).child(hhmm(a.at)))
        .child(div().flex_none().font_family(mono()).child(a.s.ticket))
        .child(div().flex_1().min_w(0).truncate().child(a.text))));
    return root.child(header).child(body);
  }

  needCard(t, { s, lead, why }, now) {
    const buttons = [];
    if (s.status === "plan_ready") buttons.push(button(t, `plan-${s.key}`, "Abrir plano", () => openFile(`${s.dir}/plan.md`, s.on)));
    if (s.status === "blocked" && s.md) buttons.push(button(t, `md-${s.key}`, "Abrir", () => openFile(s.md, s.on)));
    if (lead) buttons.push(button(t, `go-${s.key}`, "Ir para a tab", () => run("agent.focus", { terminal: lead.address })));
    return card(t, `need-${s.key}`, t.blocked)
      .child(s.title ? title(s.title) : div().truncate().text_color(t.muted).child(s.last?.text ?? ""))
      .child(h_flex().gap(6).items_center()
        .child(ticketChip(t, s, `tk-need-${s.key}`))
        .child(chip(why, t.blocked))
        .child(div().flex_1())
        .child(div().flex_none().text_size(11).text_color(t.dim).child(ago(s.updatedAt, now))))
      .when(buttons.length > 0, (el) => el.child(h_flex().gap(6).children(buttons)));
  }

  leadCard(t, { s, lead }, now) {
    const path = steps(s.status);
    const word = path[0].state === "off" ? s.status ?? "?" : null; // blocked, failed or a status off the path
    const right = [lead ? lead.status : "sem tab", ago(s.updatedAt, now)].filter(Boolean).join(" · ");
    const busy = lead?.status === "working";
    // An idle Lead's last message is stale; the waiting text says more.
    const msg = (!busy && WAIT[s.status]) || lead?.msg || null;
    return card(t, `lead-${s.key}`)
      .when(Boolean(lead), (el) => el.cursor_pointer().hover((st) => st.bg(t.hover)).on_click(() => run("agent.focus", { terminal: lead.address })))
      .when(!lead, (el) => el.opacity(0.55))
      .child(h_flex().gap(6).items_center()
        // The same native spinner as Herdr's agent list; render never runs for it.
        .child(busy ? svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)
          : div().size(8).flex_none().rounded(4).bg(lead ? t[lead.status] ?? t.idle : t.dim))
        .child(s.title ? title(s.title).flex_1() : div().flex_1().min_w(0).truncate().font_family(mono()).font_bold().child(s.ticket))
        .when(Boolean(word), (el) => el.child(div().flex_none().text_size(11).font_semibold()
          .text_color(s.status === "blocked" ? t.blocked : s.status === "failed" ? t.ansi1 : t.muted).child(word)))
        .child(div().flex_none().text_size(11).text_color(busy ? t.working : t.dim).child(right)))
      .child(h_flex().gap(6).items_center().text_size(11.5)
        .child(ticketChip(t, s, `tk-lead-${s.key}`))
        .when(Boolean(s.pr), (el) => el.child(linkChip(`PR #${s.pr?.split("/").pop()}`, s.pr, t.ansi2, `pr-${s.key}`)))
        .when(Boolean(s.source), (el) => el.child(div().flex_none().text_color(t.dim).child(s.source)))
        .when(Boolean(s.type), (el) => el.child(chip(s.type, t.muted)))
        .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(lead?.name ?? s.lead ?? "")))
      .when(Boolean(msg), (el) => el.child(h_flex().gap(6).items_center().text_size(11.5)
        .child(div().flex_none().font_semibold().text_color(busy ? t.accent : t.dim).child("agora"))
        .child(div().flex_1().min_w(0).truncate().text_color(busy ? t.foreground : t.muted).child(msg))))
      .child(h_flex().gap(3).children(path.map((x) => step(t, x, s.status === "plan_ready"))))
      .child(h_flex().gap(8).items_center().text_size(11.5)
        .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(s.last ? `${hhmm(s.last.at)} ${s.last.text}`.trim() : ""))
        .child(div().flex_none().text_color(t.dim).child(count(s.files, "arquivo", "arquivos"))));
  }

  planView(t, p) {
    return v_flex().id("cto-plan").size_full().min_h(0).bg(t.surface).text_color(t.foreground).text_size(13)
      .child(h_flex().flex_none().h(36).px(12).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().flex_1().min_w(0).truncate().font_semibold().child(p.file.split("/").pop()))
        .when(Boolean(p.overlay), (el) => el.child(button(t, "plan-close", "Fechar", () => closeOverlay(p.overlay)))))
      .child(v_flex().id("cto-plan-body").flex_1().min_h(0).overflow_y_scrollbar().p(16)
        .child(this.text ? TextView.markdown("cto-plan-md", this.text).selectable(true)
          : div().text_color(t.dim).child(this.read ? "Arquivo não encontrado." : "…")));
  }
}
