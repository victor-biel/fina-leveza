import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CATEGORIAS, CATEGORIAS_RECEITA, computeSplit, round2, userShare, sharedBalances, goalProgress } from "./finance";

type DB = SupabaseClient<Database>;

export function todayLisbon(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
}

const dateField = { type: "string", description: "Data no formato AAAA-MM-DD" };

export const agentTools = [
  {
    type: "function" as const,
    name: "registar_transacao",
    description: "Regista uma despesa ou receita do utilizador. Use sempre que o utilizador disser que gastou, pagou, recebeu ou ganhou dinheiro.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["despesa", "receita"] },
        valor: { type: "number", description: "Valor positivo" },
        categoria: { type: "string", description: `Despesa: ${CATEGORIAS.join(", ")}. Receita: ${CATEGORIAS_RECEITA.join(", ")}.` },
        descricao: { type: "string", description: "Descrição curta, ex.: 'Café', 'Supermercado Pingo Doce'" },
        data: dateField,
      },
      required: ["tipo", "valor", "categoria", "descricao", "data"],
    },
  },
  {
    type: "function" as const,
    name: "apagar_transacao",
    description: "Apaga uma transação pelo id (para corrigir enganos, apenas quando o utilizador pedir).",
    strict: false,
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    type: "function" as const,
    name: "consultar_financas",
    description: "Consulta receitas, despesas, saldo e gastos por categoria num período, com comparação ao período anterior de igual duração. Use para responder a perguntas e gerar insights.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        inicio: dateField,
        fim: dateField,
        categoria: { type: "string", description: "Opcional: filtrar por categoria" },
      },
      required: ["inicio", "fim"],
    },
  },
  {
    type: "function" as const,
    name: "criar_meta",
    description: "Cria uma meta financeira. Precisa de nome, valor objetivo e prazo. Se o utilizador não disser o prazo, pergunte antes de criar.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        nome: { type: "string" },
        valor_objetivo: { type: "number" },
        prazo: dateField,
        valor_atual: { type: "number", description: "Opcional: valor já poupado" },
      },
      required: ["nome", "valor_objetivo", "prazo"],
    },
  },
  {
    type: "function" as const,
    name: "contribuir_meta",
    description: "Adiciona (ou retira, com valor negativo) dinheiro poupado a uma meta existente.",
    strict: false,
    parameters: {
      type: "object",
      properties: { meta: { type: "string", description: "Nome ou id da meta" }, valor: { type: "number" } },
      required: ["meta", "valor"],
    },
  },
  {
    type: "function" as const,
    name: "listar_metas",
    description: "Lista as metas com progresso, poupança mensal recomendada e previsão de conclusão.",
    strict: false,
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function" as const,
    name: "criar_grupo",
    description: "Cria um grupo de divisão reutilizável (ex.: Casa, Família). Inclua o utilizador como membro com is_self=true. Percentagens padrão opcionais (todas ou nenhuma, a somar 100).",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        nome: { type: "string" },
        membros: {
          type: "array",
          items: {
            type: "object",
            properties: { nome: { type: "string" }, is_self: { type: "boolean" }, percentual: { type: "number" } },
            required: ["nome"],
          },
        },
      },
      required: ["nome", "membros"],
    },
  },
  {
    type: "function" as const,
    name: "editar_grupo",
    description: "Adiciona ou remove membros de um grupo e/ou redefine as percentagens padrão.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        grupo: { type: "string", description: "Nome ou id do grupo" },
        adicionar: { type: "array", items: { type: "object", properties: { nome: { type: "string" }, percentual: { type: "number" } }, required: ["nome"] } },
        remover: { type: "array", items: { type: "string" } },
        percentuais: { type: "array", description: "Lista completa de percentagens novas", items: { type: "object", properties: { nome: { type: "string" }, percentual: { type: "number" } }, required: ["nome", "percentual"] } },
      },
      required: ["grupo"],
    },
  },
  {
    type: "function" as const,
    name: "listar_grupos",
    description: "Lista os grupos de divisão e os seus membros, e os saldos pendentes (quem deve a quem).",
    strict: false,
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function" as const,
    name: "dividir_despesa",
    description: "Divide uma despesa entre pessoas ou por um grupo. Cria a despesa (ou usa transacao_id existente) e as parcelas. Sem percentagens divide igualmente; com grupo usa as percentagens padrão do grupo. O utilizador é sempre incluído com is_self=true quando participa.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        transacao_id: { type: "string", description: "Opcional: id de uma despesa já registada (ex.: fatura confirmada)" },
        valor: { type: "number", description: "Valor total (obrigatório se não houver transacao_id)" },
        descricao: { type: "string" },
        categoria: { type: "string" },
        data: dateField,
        grupo: { type: "string", description: "Opcional: nome do grupo" },
        participantes: {
          type: "array",
          description: "Opcional se usar grupo. Pessoas e percentagens.",
          items: {
            type: "object",
            properties: { nome: { type: "string" }, is_self: { type: "boolean" }, percentual: { type: "number" } },
            required: ["nome"],
          },
        },
        pago_por: { type: "string", description: "Quem pagou a conta. Omitir ou 'eu' se foi o utilizador." },
      },
      required: [],
    },
  },
  {
    type: "function" as const,
    name: "acertar_contas",
    description: "Marca como liquidadas (pagas) as parcelas pendentes com uma pessoa.",
    strict: false,
    parameters: { type: "object", properties: { pessoa: { type: "string" } }, required: ["pessoa"] },
  },
];

export type ToolName = (typeof agentTools)[number]["name"];

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

async function findGoal(db: DB, ref: string) {
  if (isUuid(ref)) return (await db.from("goals").select("*").eq("id", ref).maybeSingle()).data;
  const { data } = await db.from("goals").select("*").ilike("nome", `%${ref.trim()}%`).limit(1);
  return data?.[0] ?? null;
}

async function findGroup(db: DB, ref: string) {
  if (isUuid(ref)) return (await db.from("split_groups").select("*").eq("id", ref).maybeSingle()).data;
  const { data } = await db.from("split_groups").select("*").ilike("nome", `%${ref.trim()}%`).limit(1);
  return data?.[0] ?? null;
}

function shiftDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function periodSummary(db: DB, inicio: string, fim: string, categoria?: string) {
  let q = db.from("transactions").select("id,tipo,valor,categoria,descricao,data,pago_por").gte("data", inicio).lte("data", fim).order("data", { ascending: false }).limit(1000);
  if (categoria) q = q.ilike("categoria", categoria);
  const { data: txs, error } = await q;
  if (error) throw new Error(error.message);
  const ids = (txs ?? []).map((t) => t.id);
  const { data: splits } = ids.length
    ? await db.from("expense_splits").select("transaction_id,membro,is_self,valor,liquidado").in("transaction_id", ids)
    : { data: [] };
  let receitas = 0;
  let despesas = 0;
  const porCategoria: Record<string, number> = {};
  for (const t of txs ?? []) {
    if (t.tipo === "receita") receitas += Number(t.valor);
    else {
      const v = userShare(t, splits ?? []);
      despesas += v;
      porCategoria[t.categoria] = round2((porCategoria[t.categoria] ?? 0) + v);
    }
  }
  return {
    receitas: round2(receitas),
    despesas: round2(despesas),
    saldo: round2(receitas - despesas),
    porCategoria,
    numTransacoes: txs?.length ?? 0,
    transacoes: (txs ?? []).slice(0, 12).map((t) => ({ id: t.id, tipo: t.tipo, valor: Number(t.valor), categoria: t.categoria, descricao: t.descricao, data: t.data })),
  };
}

/** Arguments the model may send to any tool. Every field is optional and validated inside runTool. */
export type ToolArgs = {
  tipo?: any; valor?: any; categoria?: any; descricao?: any; data?: any; id?: any;
  inicio?: any; fim?: any; nome?: any; valor_objetivo?: any; prazo?: any; valor_atual?: any;
  meta?: any; membros?: any; grupo?: any; adicionar?: any; remover?: any; percentuais?: any;
  transacao_id?: any; participantes?: any; pago_por?: any; pessoa?: any;
};

export async function runTool(db: DB, userId: string, name: string, args: ToolArgs): Promise<unknown> {
  switch (name) {
    case "registar_transacao": {
      const valor = Number(args.valor);
      if (!(valor > 0)) throw new Error("O valor tem de ser maior que zero.");
      if (!args.categoria) throw new Error("Falta a categoria.");
      const { data, error } = await db
        .from("transactions")
        .insert({ user_id: userId, tipo: args.tipo === "receita" ? "receita" : "despesa", valor: round2(valor), categoria: String(args.categoria), descricao: args.descricao ?? null, data: args.data || todayLisbon(), origem: "chat" })
        .select("id,tipo,valor,categoria,descricao,data")
        .single();
      if (error) throw new Error(error.message);
      return { ...data, valor: Number(data.valor) };
    }
    case "apagar_transacao": {
      const { error } = await db.from("transactions").delete().eq("id", String(args.id));
      if (error) throw new Error(error.message);
      return { apagada: true };
    }
    case "consultar_financas": {
      const inicio = String(args.inicio);
      const fim = String(args.fim);
      const dias = Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 86400000) + 1;
      const atual = await periodSummary(db, inicio, fim, args.categoria);
      const anterior = await periodSummary(db, shiftDays(inicio, -dias), shiftDays(inicio, -1), args.categoria);
      return { periodo: { inicio, fim }, atual, periodoAnterior: { receitas: anterior.receitas, despesas: anterior.despesas, porCategoria: anterior.porCategoria } };
    }
    case "criar_meta": {
      if (!args.nome || !(Number(args.valor_objetivo) > 0) || !args.prazo) throw new Error("Uma meta precisa de nome, valor objetivo e prazo.");
      const { data, error } = await db
        .from("goals")
        .insert({ user_id: userId, nome: String(args.nome), valor_objetivo: round2(Number(args.valor_objetivo)), prazo: String(args.prazo), valor_atual: round2(Number(args.valor_atual ?? 0)) })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const p = goalProgress(data);
      return { id: data.id, nome: data.nome, valor_objetivo: p.alvo, valor_atual: p.atual, prazo: data.prazo, percent: p.percent, poupancaMensal: p.poupancaMensal };
    }
    case "contribuir_meta": {
      const goal = await findGoal(db, String(args.meta));
      if (!goal) throw new Error("Não encontrei essa meta.");
      const novo = Math.max(0, round2(Number(goal.valor_atual) + Number(args.valor)));
      const { data, error } = await db.from("goals").update({ valor_atual: novo }).eq("id", goal.id).select("*").single();
      if (error) throw new Error(error.message);
      const p = goalProgress(data);
      return { nome: data.nome, valor_atual: p.atual, valor_objetivo: p.alvo, percent: p.percent, falta: p.falta };
    }
    case "listar_metas": {
      const { data, error } = await db.from("goals").select("*").order("prazo");
      if (error) throw new Error(error.message);
      return (data ?? []).map((g) => {
        const p = goalProgress(g);
        return { id: g.id, nome: g.nome, valor_objetivo: p.alvo, valor_atual: p.atual, prazo: g.prazo, percent: p.percent, poupancaMensalRecomendada: p.poupancaMensal, previsaoConclusao: p.previsao?.toISOString().slice(0, 10) ?? null };
      });
    }
    case "criar_grupo": {
      const membros = (args.membros ?? []) as { nome: string; is_self?: boolean; percentual?: number }[];
      if (!args.nome || membros.length < 2) throw new Error("Um grupo precisa de nome e pelo menos 2 membros.");
      const withPct = membros.filter((m) => m.percentual != null);
      if (withPct.length) {
        const check = computeSplit(100, membros);
        if (!check.ok) throw new Error(check.error);
      }
      const { data: g, error } = await db.from("split_groups").insert({ user_id: userId, nome: String(args.nome) }).select("*").single();
      if (error) throw new Error(error.message);
      const { error: e2 } = await db.from("group_members").insert(
        membros.map((m) => ({ user_id: userId, group_id: g.id, nome: m.nome.trim(), is_self: !!m.is_self, percentual_padrao: m.percentual ?? null })),
      );
      if (e2) throw new Error(e2.message);
      return { id: g.id, nome: g.nome, membros };
    }
    case "editar_grupo": {
      const g = await findGroup(db, String(args.grupo));
      if (!g) throw new Error("Não encontrei esse grupo.");
      for (const nome of (args.remover ?? []) as string[]) {
        await db.from("group_members").delete().eq("group_id", g.id).ilike("nome", nome.trim());
      }
      const add = (args.adicionar ?? []) as { nome: string; percentual?: number }[];
      if (add.length) {
        const { error } = await db.from("group_members").insert(add.map((m) => ({ user_id: userId, group_id: g.id, nome: m.nome.trim(), percentual_padrao: m.percentual ?? null })));
        if (error) throw new Error(error.message);
      }
      const pcts = (args.percentuais ?? []) as { nome: string; percentual: number }[];
      if (pcts.length) {
        const sum = pcts.reduce((a, p) => a + Number(p.percentual), 0);
        if (Math.abs(sum - 100) > 0.01) throw new Error(`As percentagens somam ${sum}%, têm de somar 100%.`);
        for (const p of pcts) await db.from("group_members").update({ percentual_padrao: p.percentual }).eq("group_id", g.id).ilike("nome", p.nome.trim());
      }
      const { data: membros } = await db.from("group_members").select("nome,is_self,percentual_padrao").eq("group_id", g.id);
      return { grupo: g.nome, membros };
    }
    case "listar_grupos": {
      const { data: grupos } = await db.from("split_groups").select("id,nome,group_members(nome,is_self,percentual_padrao)");
      const { data: splits } = await db.from("expense_splits").select("transaction_id,membro,is_self,valor,liquidado");
      const txIds = [...new Set((splits ?? []).map((s) => s.transaction_id))];
      const { data: txs } = txIds.length ? await db.from("transactions").select("id,tipo,valor,categoria,data,pago_por").in("id", txIds) : { data: [] };
      return { grupos, saldos: sharedBalances(txs ?? [], splits ?? []) };
    }
    case "dividir_despesa": {
      let tx: { id: string; valor: number; descricao: string | null } | null = null;
      if (args.transacao_id) {
        const { data } = await db.from("transactions").select("id,valor,descricao").eq("id", String(args.transacao_id)).maybeSingle();
        if (!data) throw new Error("Não encontrei essa despesa.");
        tx = { ...data, valor: Number(data.valor) };
      }
      const total = tx ? tx.valor : Number(args.valor);
      let participantes = (args.participantes ?? []) as { nome: string; is_self?: boolean; percentual?: number | null }[];
      let groupId: string | null = null;
      if (args.grupo) {
        const g = await findGroup(db, String(args.grupo));
        if (!g) throw new Error(`Não encontrei o grupo "${args.grupo}".`);
        groupId = g.id;
        if (!participantes.length) {
          const { data: m } = await db.from("group_members").select("nome,is_self,percentual_padrao").eq("group_id", g.id);
          participantes = (m ?? []).map((x) => ({ nome: x.nome, is_self: x.is_self, percentual: x.percentual_padrao == null ? null : Number(x.percentual_padrao) }));
          if (participantes.some((p) => p.percentual == null)) participantes = participantes.map((p) => ({ ...p, percentual: null }));
        }
      }
      const split = computeSplit(total, participantes);
      if (!split.ok) throw new Error(split.error);
      const pagoPor = args.pago_por && String(args.pago_por).toLowerCase() !== "eu" ? String(args.pago_por) : null;
      if (tx) {
        await db.from("expense_splits").delete().eq("transaction_id", tx.id);
        if (pagoPor) await db.from("transactions").update({ pago_por: pagoPor }).eq("id", tx.id);
      } else {
        if (!(total > 0)) throw new Error("Indique o valor total da conta.");
        const { data, error } = await db
          .from("transactions")
          .insert({ user_id: userId, tipo: "despesa", valor: round2(total), categoria: args.categoria || "Contas", descricao: args.descricao ?? "Despesa partilhada", data: args.data || todayLisbon(), pago_por: pagoPor, origem: "chat" })
          .select("id,valor,descricao")
          .single();
        if (error) throw new Error(error.message);
        tx = { ...data, valor: Number(data.valor) };
      }
      const { error: e2 } = await db.from("expense_splits").insert(
        split.shares.map((s) => ({ user_id: userId, transaction_id: tx!.id, group_id: groupId, membro: s.nome, is_self: s.is_self, valor: s.valor, percentual: s.percentual })),
      );
      if (e2) throw new Error(e2.message);
      return { transacao_id: tx.id, descricao: tx.descricao, total, pago_por: pagoPor ?? "utilizador", parcelas: split.shares };
    }
    case "acertar_contas": {
      const pessoa = String(args.pessoa).trim();
      const { data: owedToMe } = await db.from("expense_splits").update({ liquidado: true }).ilike("membro", pessoa).eq("is_self", false).eq("liquidado", false).select("id");
      const { data: paidByThem } = await db.from("transactions").select("id").ilike("pago_por", pessoa);
      let mine = 0;
      if (paidByThem?.length) {
        const { data } = await db.from("expense_splits").update({ liquidado: true }).in("transaction_id", paidByThem.map((t) => t.id)).eq("is_self", true).eq("liquidado", false).select("id");
        mine = data?.length ?? 0;
      }
      return { pessoa, parcelasLiquidadas: (owedToMe?.length ?? 0) + mine };
    }
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}

export function systemPrompt(opts: { nome?: string | null | undefined; receita?: number | null | undefined; objetivos?: string | null | undefined; partilha?: string | null | undefined; moeda: string; hoje: string }) {
  return `És a Fina, uma assistente financeira pessoal, calorosa e muito simples de entender. Falas português de Portugal (tratas o utilizador por "você" de forma informal e simpática). A moeda é ${opts.moeda}.

Hoje é ${opts.hoje}. "Ontem" = dia anterior. Converte sempre datas relativas para AAAA-MM-DD.

Sobre o utilizador:
- Nome: ${opts.nome ?? "desconhecido"} (nas divisões de contas, o utilizador é "${opts.nome ?? "Eu"}" com is_self=true)
- Receita mensal aproximada: ${opts.receita ?? "não indicada"}
- Objetivos: ${opts.objetivos ?? "não indicados"}
- Partilha despesas com: ${opts.partilha ?? "ninguém indicado"}

Regras:
- Usa as ferramentas para registar e consultar dados. Nunca inventes números: consulta primeiro.
- Quando o utilizador menciona um gasto ou receita, regista logo com a categoria mais adequada e confirma numa frase curta (valor, categoria, data).
- Toda despesa precisa de valor, categoria e data. Toda meta precisa de nome, valor objetivo e prazo — se faltar o prazo, pergunta.
- Na divisão de contas, as parcelas têm de somar o total; percentagens têm de somar 100%. Mostra o resultado como lista "Nome → valor".
- Se o utilizador disser "esta fatura" ou "esta conta", usa a despesa mais recente mencionada na conversa (transacao_id).
- Respostas curtas, claras, sem jargão. Usa listas e negrito com moderação. No máximo 1 emoji quando fizer sentido.
- Quando fizer sentido, dá uma recomendação prática e simples (poupança, excesso de gastos numa categoria, progresso de metas, sugerir criar um grupo se dividir muitas vezes com as mesmas pessoas).
- Não dês aconselhamento de investimento específico.`;
}
