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
