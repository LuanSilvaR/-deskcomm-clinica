/**
 * O lembrete só é útil se acertar a HORA e não vazar entre organizações.
 *
 * As duas regras são testadas de formas diferentes de propósito:
 *
 * - `estaNaHora` e `montarLembrete` são puras, então o teste as exercita de
 *   verdade, inclusive nas bordas (cedo demais, tarde demais, exatamente na
 *   hora) — que é onde um lembrete deixa de ser lembrete.
 *
 * - O isolamento entre organizações é ESTRUTURAL: ele não vive numa função, vive
 *   no encadeamento da consulta. Montar um dublê de Supabase para provar isso
 *   testaria o dublê. O que prende é ler a fonte e cobrar o filtro — o mesmo
 *   estilo de `tests/unit/cron-audita-so-quando-ha-efeito.test.ts`, que varre o
 *   AST das rotas deste diretório.
 *
 * O medo é explícito no código que criou a coluna
 * (`app/api/v1/agenda/agendamentos/_handler.ts`): "no dia em que o worker de
 * lembrete nascer, esta linha vira a organização A mandando WhatsApp para o
 * cliente da B". Este é o dia, e esta é a cerca.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { degrausPendentes, estaNaHora, montarLembrete } from "./route";

const MIN = 60_000;

describe("estaNaHora", () => {
  const agora = new Date("2026-08-31T12:00:00Z");

  it("não avisa cedo demais", () => {
    // compromisso em 3h, antecedência de 60 min: ainda não.
    const comeca = new Date(agora.getTime() + 180 * MIN);
    expect(estaNaHora(agora, comeca, 60)).toBe(false);
  });

  it("avisa quando a antecedência é alcançada", () => {
    const comeca = new Date(agora.getTime() + 59 * MIN);
    expect(estaNaHora(agora, comeca, 60)).toBe(true);
  });

  it("avisa no instante exato da fronteira", () => {
    const comeca = new Date(agora.getTime() + 60 * MIN);
    expect(estaNaHora(agora, comeca, 60)).toBe(true);
  });

  it("NÃO avisa compromisso que já começou", () => {
    // Lembrar às 15h de uma retirada das 14h não é lembrete, é ruído.
    const comeca = new Date(agora.getTime() - 1 * MIN);
    expect(estaNaHora(agora, comeca, 1440)).toBe(false);
  });

  it("NÃO avisa compromisso que começa exatamente agora", () => {
    expect(estaNaHora(agora, new Date(agora.getTime()), 1440)).toBe(false);
  });

  it("antecedência longa não antecipa o que ainda está longe", () => {
    // 30 dias de antecedência (o teto da coluna) com compromisso em 31 dias.
    const comeca = new Date(agora.getTime() + 31 * 24 * 60 * MIN);
    expect(estaNaHora(agora, comeca, 43_200)).toBe(false);
  });
});

describe("montarLembrete", () => {
  const quando = new Date("2026-08-31T12:45:00Z"); // 09:45 em São Paulo

  it("diz o quê, quando e onde", () => {
    const texto = montarLembrete({
      nomeDoContato: "Rose",
      titulo: "Retirada de manipulado — Poços de Caldas",
      quando,
      timezone: "America/Sao_Paulo",
      local: "R. Ceará, 300 — Centro",
    });

    expect(texto).toContain("Rose");
    expect(texto).toContain("Retirada de manipulado — Poços de Caldas");
    expect(texto).toContain("09:45");
    expect(texto).toContain("R. Ceará, 300 — Centro");
  });

  it("respeita o fuso da organização", () => {
    const emManaus = montarLembrete({
      nomeDoContato: null,
      titulo: "Retirada",
      quando,
      timezone: "America/Manaus", // uma hora atrás de São Paulo
      local: null,
    });
    expect(emManaus).toContain("08:45");
    expect(emManaus).not.toContain("09:45");
  });

  it("sem nome, cumprimenta sem inventar", () => {
    const texto = montarLembrete({
      nomeDoContato: null,
      titulo: "Retirada",
      quando,
      timezone: "America/Sao_Paulo",
      local: null,
    });
    expect(texto.startsWith("Oi!")).toBe(true);
    expect(texto).not.toContain("null");
    expect(texto).not.toContain("undefined");
  });

  it("sem endereço, não promete um", () => {
    const texto = montarLembrete({
      nomeDoContato: "Ana",
      titulo: "Retirada",
      quando,
      timezone: "America/Sao_Paulo",
      local: null,
    });
    expect(texto).not.toContain("Endereço");
  });

  it("molde próprio interpola nome, dia e hora, e deixa chave desconhecida no texto", () => {
    const texto = montarLembrete({
      nomeDoContato: "Ian Couto",
      titulo: "Atendimento",
      quando,
      timezone: "America/Sao_Paulo",
      local: "Sala 2",
      molde: "Oi {{primeiro_nome}}! {{titulo}} {{dia}} às {{hora}} em {{endereco}}. {{foo}}",
      tipoNome: "Consulta",
    });
    expect(texto).toBe("Oi Ian! Atendimento segunda-feira, 31/08 às 09:45 em Sala 2. {{foo}}");
  });

  it("molde em branco cai na frase padrão", () => {
    const comMolde = montarLembrete({
      nomeDoContato: "Ana",
      titulo: "Retirada",
      quando,
      timezone: "America/Sao_Paulo",
      local: null,
      molde: "   ",
    });
    const semMolde = montarLembrete({
      nomeDoContato: "Ana",
      titulo: "Retirada",
      quando,
      timezone: "America/Sao_Paulo",
      local: null,
    });
    expect(comMolde).toBe(semMolde);
  });
});

describe("isolamento entre organizações (estrutural)", () => {
  const fonte = readFileSync(join(__dirname, "route.ts"), "utf8");

  it("resolve o contato DENTRO da organização do compromisso", () => {
    // O trecho tem de conter a busca em `contacts` filtrada por organization_id.
    // Sem isso, um contact_id de outra organização viraria WhatsApp enviado ao
    // cliente dela — o defeito que o handler de agendamentos antecipa.
    const buscaDeContato = fonte.slice(fonte.indexOf('.from("contacts")'));
    expect(fonte).toContain('.from("contacts")');
    expect(buscaDeContato.slice(0, 400)).toContain('.eq("organization_id", org)');
  });

  it("resolve o canal DENTRO da organização do compromisso", () => {
    const buscaDeCanal = fonte.slice(fonte.indexOf('.from("channel_sessions")'));
    expect(fonte).toContain('.from("channel_sessions")');
    expect(buscaDeCanal.slice(0, 400)).toContain('.eq("organization_id", org)');
  });

  it("carimba o compromisso DENTRO da organização dele", () => {
    const carimbo = fonte.slice(fonte.indexOf("reminder_sent_at: new Date()"));
    expect(carimbo.slice(0, 400)).toContain('.eq("organization_id", org)');
  });

  it("a organização vem da linha do compromisso, nunca de parâmetro", () => {
    expect(fonte).toContain("const org = linha.organization_id");
    // controle: se alguém trocar por leitura de query string, isto reprova.
    expect(fonte).not.toContain("searchParams.get(\"organization_id\")");
  });
});

describe("degrausPendentes — o lembrete que tem mais de um degrau", () => {
  const comeca = new Date("2026-09-20T14:00:00.000Z");
  const base = { comeca, principal: 1440, extras: [180], jaEnviados: null as number[] | null };

  it("dois dias antes não deve nada — nem o degrau mais antecipado venceu", () => {
    expect(degrausPendentes({ ...base, agora: new Date("2026-09-18T14:00:00.000Z") })).toEqual([]);
  });

  it("um dia antes deve só o degrau de um dia", () => {
    expect(degrausPendentes({ ...base, agora: new Date("2026-09-19T15:00:00.000Z") })).toEqual([1440]);
  });

  it("três horas antes, com o de um dia já enviado, deve o de três horas", () => {
    expect(
      degrausPendentes({ ...base, agora: new Date("2026-09-20T11:30:00.000Z"), jaEnviados: [1440] }),
    ).toEqual([180]);
  });

  it("com os dois já enviados não deve nada — é o que impede a mensagem repetida", () => {
    expect(
      degrausPendentes({ ...base, agora: new Date("2026-09-20T13:00:00.000Z"), jaEnviados: [1440, 180] }),
    ).toEqual([]);
  });

  it("cron parado: dois degraus vencidos saem JUNTOS, para virarem uma mensagem só", () => {
    // Quem chama manda um texto e carimba os dois. Se esta função devolvesse um
    // por rodada, a pessoa receberia o mesmo aviso duas vezes seguidas.
    expect(degrausPendentes({ ...base, agora: new Date("2026-09-20T13:00:00.000Z") })).toEqual([1440, 180]);
  });

  it("depois de começar não deve nada — lembrete atrasado não é lembrete", () => {
    expect(degrausPendentes({ ...base, agora: new Date("2026-09-20T14:00:00.000Z") })).toEqual([]);
  });

  it("sem extras se comporta exatamente como antes", () => {
    const so = { ...base, extras: null };
    expect(degrausPendentes({ ...so, agora: new Date("2026-09-19T15:00:00.000Z") })).toEqual([1440]);
    expect(degrausPendentes({ ...so, agora: new Date("2026-09-19T15:00:00.000Z"), jaEnviados: [1440] })).toEqual([]);
  });

  it("extra igual ao principal não duplica o aviso", () => {
    expect(
      degrausPendentes({ ...base, extras: [1440], agora: new Date("2026-09-19T15:00:00.000Z") }),
    ).toEqual([1440]);
  });
});

describe("o cron NÃO pode filtrar por reminder_sent_at", () => {
  it("o filtro antigo não voltou — com ele o segundo degrau nunca sairia", () => {
    // Guarda estrutural: este filtro passou a ser errado quando o lembrete ganhou
    // degraus, e o erro não daria sinal nenhum — o compromisso simplesmente não
    // receberia o segundo aviso, em silêncio.
    //
    // Os comentários saem antes: o texto que EXPLICA o filtro é o mais parecido
    // com o filtro, e é ele que faria a asserção passar com o código removido.
    const fonte = readFileSync(join(__dirname, "route.ts"), "utf8").replace(/--[^\n]*|\/\/[^\n]*/g, "");
    expect(fonte).not.toMatch(/\.is\(\s*["']reminder_sent_at["']/);
    expect(fonte).toMatch(/reminder_sent_offsets_minutes/);
  });

  it("lê o texto POR degrau — senão extra sai com a frase do principal", () => {
    const fonte = readFileSync(join(__dirname, "route.ts"), "utf8");
    expect(fonte).toMatch(/reminder_bodies/);
    expect(fonte).toMatch(/moldeDoDegrau/);
  });
});

// ─── O ramo da chave `lembrete_com_reserva` (#83) ───────────────────────────
// Aqui o Supabase É um dublê, porque o que se prova é a TRADUÇÃO do desfecho
// em carimbo/falha, e não uma consulta. O envio de verdade (canal oficial/QR) é outro
// módulo, mockado: nenhum teste chama rede.

const h = vi.hoisted(() => ({
  admin: null as unknown,
  enviar: vi.fn(),
  registrarPedido: vi.fn(async () => undefined),
  pedeConfirmacao: false,
  sendMessage: vi.fn(async () => ({ id: "m-texto" })),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/auth/cron-auth", () => ({ autorizaCron: () => true }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/automation/start-conversation", () => ({ ensureConversation: async () => "conv-1" }));
vi.mock("@/lib/automation/janela-do-canal", () => ({ adiarAteAJanelaAbrir: async () => false }));
vi.mock("@/lib/automation/throttle", () => ({ espacarEnvio: async () => undefined }));
vi.mock("@/app/api/v1/messages/_handler", () => ({ sendMessageHandler: h.sendMessage }));
vi.mock("@/lib/clinic/lembrete-com-reserva/enviar", () => ({ enviarLembreteComReserva: h.enviar }));
vi.mock("@/lib/clinic/confirmacao/servidor", () => ({
  deveAnexarPedido: async () => h.pedeConfirmacao,
  registrarPedido: h.registrarPedido,
}));

import { GET } from "./route";
import { PROVIDER_PREFERIDO_DO_LEMBRETE as OFICIAL, PROVIDER_DE_RESERVA_DO_LEMBRETE as QR } from "@/lib/channels/lembrete";

interface Cenario {
  settingsLigada: boolean;
  bloqueado?: boolean;
  tentativas?: Record<string, number> | null;
}

function montarAdmin(c: Cenario) {
  const updates: Record<string, unknown>[] = [];
  const consultas: { tabela: string; limit?: number }[] = [];
  const linha = {
    id: "ap-1",
    organization_id: "org-1",
    contact_id: "ct-1",
    title: "Consulta",
    starts_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    location_details: "Rua A, 12",
    reminder_sent_offsets_minutes: null,
    reminder_tentativas: c.tentativas ?? null,
    calendar_event_types: {
      name: "Consulta",
      reminder_enabled: true,
      reminder_minutes_before: 1440,
      reminder_extra_offsets_minutes: null,
      reminder_template_name: null,
      reminder_body: null,
      reminder_bodies: null,
      location_details: null,
      reminder_meta_template_id: "tpl-1",
    },
  };
  const dados: Record<string, unknown> = {
    calendar_appointments: [linha],
    contacts: { id: "ct-1", name: "Maria Souza", display_name: null, phone_number: "5511", is_blocked: c.bloqueado ?? false },
    organizations: {
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
      settings: { clinic: { lembrete_com_reserva: c.settingsLigada } },
    },
    channel_sessions: { id: "canal-1" },
    messages: { conversation_id: "conv-9" },
  };
  const admin = {
    from(tabela: string) {
      const q: Record<string, unknown> = {};
      let ehUpdate = false;
      const registro = { tabela } as { tabela: string; limit?: number };
      consultas.push(registro);
      const chain = () => q;
      for (const m of ["select", "eq", "not", "gt", "lte", "order", "or", "is"]) q[m] = chain;
      q.limit = (n: number) => {
        registro.limit = n;
        return q;
      };
      q.update = (v: Record<string, unknown>) => {
        ehUpdate = true;
        updates.push(v);
        return q;
      };
      q.maybeSingle = async () => ({ data: dados[tabela] ?? null, error: null });
      q.then = (res: (v: unknown) => unknown) => res({ data: ehUpdate ? null : dados[tabela], error: null });
      return q;
    },
  };
  return { admin, updates, consultas };
}

const entradaEnviada = () => (h.enviar.mock.calls[0] as unknown[])[1] as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function rodar(c: Cenario) {
  const m = montarAdmin(c);
  h.admin = m.admin;
  const res = await GET({} as never);
  return { ...m, corpo: await res.json() };
}

describe("cron com a chave do lembrete com reserva", () => {
  beforeEach(() => {
    h.enviar.mockReset();
    h.registrarPedido.mockClear();
    h.sendMessage.mockClear();
    h.pedeConfirmacao = false;
  });

  it("chave desligada: não chama enviarLembreteComReserva e lê channel_sessions com limit(1)", async () => {
    const { consultas, updates } = await rodar({ settingsLigada: false });
    expect(h.enviar).not.toHaveBeenCalled();
    expect(h.sendMessage).toHaveBeenCalledTimes(1);
    expect(consultas.find((q) => q.tabela === "channel_sessions")?.limit).toBe(1);
    expect(updates[0]).not.toHaveProperty("reminder_falha");
  });

  it("chave ligada e enviado: carimba e limpa reminder_falha", async () => {
    h.enviar.mockResolvedValue({ desfecho: "enviado", canalId: "c", provider: OFICIAL, mensagemId: "m1", via: "modelo" });
    const { updates, corpo } = await rodar({ settingsLigada: true });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ reminder_sent_offsets_minutes: [1440], reminder_falha: null, reminder_falha_at: null });
    expect(updates[0]?.reminder_sent_at).toBeTruthy();
    expect(corpo.data.enviados).toBe(1);
    const entrada = entradaEnviada();
    expect(entrada.pecasDoModelo.primeiro_nome).toBe("Maria");
    expect(entrada.pecasDoModelo.quando).toContain("às");
    expect(entrada.modeloDoTipoId).toBe("tpl-1");
    expect(entrada.tentativa).toBe(1);
    expect(h.sendMessage).not.toHaveBeenCalled();
  });

  it("chave ligada e enviado com confirmação: registra o pedido com a mensagem do envio", async () => {
    h.pedeConfirmacao = true;
    h.enviar.mockResolvedValue({ desfecho: "enviado", canalId: "c", provider: QR, mensagemId: "m7", via: "texto" });
    await rodar({ settingsLigada: true });
    expect(h.registrarPedido).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reminderMessageId: "m7", conversationId: "conv-9" }),
    );
    expect(entradaEnviada().textoLivre).toContain("\n\n");
  });

  it("chave ligada e ambiguo: carimba e grava envio_nao_confirmado; rodada seguinte não chama de novo", async () => {
    h.enviar.mockResolvedValue({ desfecho: "ambiguo", canalId: "c", mensagemId: null });
    const { updates } = await rodar({ settingsLigada: true });
    expect(updates[0]).toMatchObject({ reminder_sent_offsets_minutes: [1440], reminder_falha: "envio_nao_confirmado" });
    // O degrau carimbado não volta a ser pendente: é isso que impede o reenvio.
    expect(
      degrausPendentes({
        agora: new Date(),
        comeca: new Date(Date.now() + 3_600_000),
        principal: 1440,
        extras: null,
        jaEnviados: [1440],
      }),
    ).toEqual([]);
  });

  it("chave ligada e nao_saiu na 1ª: não carimba, tentativas 1440 = 1", async () => {
    h.enviar.mockResolvedValue({ desfecho: "nao_saiu", motivo: "sem_caminho" });
    const { updates } = await rodar({ settingsLigada: true });
    expect(updates[0]).toMatchObject({ reminder_tentativas: { "1440": 1 }, reminder_falha: "sem_caminho" });
    expect(updates[0]).not.toHaveProperty("reminder_sent_at");
  });

  it("chave ligada e nao_saiu na 3ª: carimba e grava erro_apos_tentativas", async () => {
    h.enviar.mockResolvedValue({ desfecho: "nao_saiu", motivo: "erro_apos_tentativas" });
    const { updates } = await rodar({ settingsLigada: true, tentativas: { "1440": 2 } });
    expect(entradaEnviada().tentativa).toBe(3);
    expect(updates[0]).toMatchObject({
      reminder_tentativas: { "1440": 3 },
      reminder_sent_offsets_minutes: [1440],
      reminder_falha: "erro_apos_tentativas",
    });
  });

  it("chave ligada e fora_do_horario: não carimba nem conta tentativa", async () => {
    h.enviar.mockResolvedValue({ desfecho: "nao_saiu", motivo: "fora_do_horario" });
    const { updates, corpo } = await rodar({ settingsLigada: true, tentativas: { "1440": 1 } });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ reminder_falha: "fora_do_horario" });
    expect(updates[0]).not.toHaveProperty("reminder_sent_at");
    expect(updates[0]).not.toHaveProperty("reminder_tentativas");
    expect(corpo.data.motivos.fora_da_janela).toBe(1);
  });

  it("chave ligada e is_blocked: não chama o envio nem grava falha", async () => {
    const { updates, corpo } = await rodar({ settingsLigada: true, bloqueado: true });
    expect(h.enviar).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
    expect(corpo.data.motivos.contato_bloqueado).toBe(1);
  });
});
