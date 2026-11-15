import { describe, expect, it } from "vitest";
import { computeSplit, sharedBalances, userShare } from "./finance";

describe("divisão de contas", () => {
  it("divide 90€ igualmente entre Victor, Ana e João (30€ cada)", () => {
    const r = computeSplit(90, [{ nome: "Victor", is_self: true }, { nome: "Ana" }, { nome: "João" }]);
    expect(r.ok && r.shares.map((s) => s.valor)).toEqual([30, 30, 30]);
  });

  it("divide 800€ com 60% / 40% em 480€ e 320€", () => {
    const r = computeSplit(800, [
      { nome: "Victor", is_self: true, percentual: 60 },
      { nome: "Ana", percentual: 40 },
    ]);
    expect(r.ok && r.shares.map((s) => s.valor)).toEqual([480, 320]);
  });

  it("a soma das parcelas é sempre igual ao total", () => {
    const r = computeSplit(100, [{ nome: "A" }, { nome: "B" }, { nome: "C" }]);
    expect(r.ok && Math.round(r.shares.reduce((a, s) => a + s.valor, 0) * 100)).toBe(10000);
  });

  it("rejeita percentagens que não somam 100%", () => {
    const r = computeSplit(800, [
      { nome: "Victor", percentual: 60 },
      { nome: "Ana", percentual: 30 },
    ]);
    expect(r.ok).toBe(false);
  });
});

describe("saldos partilhados", () => {
  const tx = { id: "t1", tipo: "despesa", valor: 90, categoria: "Contas", data: "2026-11-01", pago_por: null };
  const splits = [
    { transaction_id: "t1", membro: "Victor", is_self: true, valor: 30, liquidado: false },
    { transaction_id: "t1", membro: "Ana", is_self: false, valor: 30, liquidado: false },
    { transaction_id: "t1", membro: "João", is_self: false, valor: 30, liquidado: true },
  ];

  it("conta só a parte do utilizador como despesa dele", () => {
    expect(userShare(tx, splits)).toBe(30);
  });

  it("quando o utilizador paga, os outros devem-lhe as partes por liquidar", () => {
    const b = sharedBalances([tx], splits);
    expect([b.pagoPeloUtilizador, b.devemAoUtilizador, b.utilizadorDeve]).toEqual([90, 30, 0]);
  });

  it("quando outra pessoa paga, o utilizador deve a sua parte a essa pessoa", () => {
    const b = sharedBalances([{ ...tx, pago_por: "Ana" }], splits);
    expect(b.utilizadorDeve).toBe(30);
  });
});

import { parseAmount, validateGoal } from "./finance";

describe("valores escritos pelo utilizador", () => {
  it("aceita vírgula decimal: '12,50' é 12.5", () => expect(parseAmount("12,50")).toBe(12.5));
  it("aceita '1 200 €' como 1200", () => expect(parseAmount("1 200 €")).toBe(1200));
  it("recusa texto que não é valor", () => expect(parseAmount("doze")).toBeNaN());
});

describe("metas", () => {
  const hoje = "2026-11-15";
  it("aceita meta de 2000€ para férias até agosto", () =>
    expect(validateGoal({ nome: "Férias", valor_objetivo: 2000, prazo: "2027-08-31" }, hoje)).toBeNull());
  it("recusa meta sem prazo", () => expect(validateGoal({ nome: "Férias", valor_objetivo: 2000, prazo: "" }, hoje)).not.toBeNull());
  it("recusa meta com valor zero", () => expect(validateGoal({ nome: "Férias", valor_objetivo: 0, prazo: "2027-08-31" }, hoje)).not.toBeNull());
  it("recusa prazo no passado", () => expect(validateGoal({ nome: "Férias", valor_objetivo: 2000, prazo: "2026-01-01" }, hoje)).not.toBeNull());
});
