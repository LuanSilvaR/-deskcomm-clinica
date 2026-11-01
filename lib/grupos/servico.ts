/**
 * Os grupos do WhatsApp de uma conexão — recorte do upstream `lib/grupos/servico.ts`
 * para o aviso de agendamento em grupo (#84, upstream #3460).
 *
 * O upstream tem o subsistema inteiro de grupos (a tabela que liga um grupo na
 * inbox, a chave "a IA responde neste grupo", o filtro de entrada no WAHA). O
 * fork ainda não tem nada disso: aqui fica SÓ a leitura — "em que grupos este
 * número está?" —, que é o que o aviso precisa para a tela mostrar os grupos e
 * para o servidor conferir que o grupo escolhido é desta conexão.
 *
 * A forma (`DepsDeGrupos`, `GrupoDoNumero`, `listarGruposDoNumero`) é a do
 * upstream, para o código do aviso e os testes dele virem sem mudança. Sem a
 * tabela, `listarLinhas` volta vazio: nenhum grupo "ligado na inbox", então não
 * há órfão, e `enabled`/`iaResponde` são sempre `false`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveSessionRef, CHANNEL_SESSION_REF_COLUMNS, type ChannelSessionRef } from "@/lib/channels/session-ref";
import type { ChannelProvider } from "@/lib/channels/types";
import { getWahaClient } from "@/lib/waha/client";

export class GrupoError extends Error {
  constructor(
    public readonly code: "sessao_nao_encontrada" | "provedor_sem_grupos",
    message: string,
  ) {
    super(message);
    this.name = "GrupoError";
  }
}

export interface GrupoDoNumero {
  chatId: string;
  subject: string | null;
  enabled: boolean;
  enabledAt: string | null;
  /** O WhatsApp devolveu este grupo agora? `false` = órfão (só existe com a tabela do upstream). */
  presente: boolean;
  iaResponde: boolean;
}

/** Uma linha da tabela de grupos do upstream. O fork não a tem: a lista é sempre vazia. */
export interface LinhaDeGrupo {
  group_chat_id: string;
  subject: string | null;
  enabled: boolean;
  enabled_at: string | null;
  ia_responde: boolean;
}

export interface GruposDb {
  lerSessao(
    org: string,
    sessionId: string,
  ): Promise<{ provider: ChannelProvider; sessionRef: string; groupsCapability: "full" | "limited" | "none" } | null>;
  listarLinhas(org: string, sessionId: string): Promise<LinhaDeGrupo[]>;
  contarLigados(org: string, sessionId: string): Promise<number>;
  gravarLinha(org: string, sessionId: string, row: Record<string, unknown>): Promise<{ id: string }>;
  definirIa(org: string, sessionId: string, groupChatId: string, valor: boolean): Promise<{ id: string } | null>;
}

export interface DepsDeGrupos {
  db: GruposDb;
  listGroups(provider: ChannelProvider, sessionRef: string): Promise<Array<{ chatId: string; subject?: string | null }>>;
  setGroupIntake(provider: ChannelProvider, sessionRef: string, receive: boolean): Promise<boolean>;
  audit(entry: {
    action: string;
    organizationId: string;
    actorUserId: string;
    resourceId: string;
    requestId: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
  agora(): Date;
}

export async function listarGruposDoNumero(
  deps: DepsDeGrupos,
  e: { organizationId: string; channelSessionId: string },
): Promise<GrupoDoNumero[]> {
  const s = await deps.db.lerSessao(e.organizationId, e.channelSessionId);
  if (!s) throw new GrupoError("sessao_nao_encontrada", "Conexão não encontrada.");
  if (s.groupsCapability === "none") throw new GrupoError("provedor_sem_grupos", "Esta conexão não lista grupos.");
  const [doCanal, gravados] = await Promise.all([
    deps.listGroups(s.provider, s.sessionRef),
    deps.db.listarLinhas(e.organizationId, e.channelSessionId),
  ]);
  const porId = new Map(gravados.map((l) => [l.group_chat_id, l]));
  const daLista = doCanal.map((g) => {
    const l = porId.get(g.chatId);
    porId.delete(g.chatId);
    return {
      chatId: g.chatId,
      subject: g.subject ?? l?.subject ?? null,
      enabled: l?.enabled ?? false,
      enabledAt: l?.enabled_at ?? null,
      presente: true,
      iaResponde: l?.ia_responde === true,
    };
  });
  // Órfãos: ligados no banco e que o WhatsApp não devolveu mais.
  const orfaos = [...porId.values()]
    .filter((l) => l.enabled)
    .map((l) => ({
      chatId: l.group_chat_id,
      subject: l.subject,
      enabled: l.enabled,
      enabledAt: l.enabled_at,
      presente: false,
      iaResponde: l.ia_responde === true,
    }));
  return [...daLista, ...orfaos];
}

/** As dependências de produção. Só o WAHA lista grupos no fork. */
export function criarDepsDeGrupos(admin: SupabaseClient): DepsDeGrupos {
  const naoSuportado = (): never => {
    throw new Error("grupos_na_inbox_indisponivel_no_fork");
  };
  return {
    db: {
      async lerSessao(org, sessionId) {
        // ⚠️ `organization_id` filtrado À MÃO: o client é o de service role.
        const { data, error } = await admin
          .from("channel_sessions")
          .select(`id, ${CHANNEL_SESSION_REF_COLUMNS}`)
          .eq("organization_id", org)
          .eq("id", sessionId)
          .is("archived_at", null)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return null;
        const ref = data as unknown as ChannelSessionRef;
        return {
          provider: ref.provider,
          sessionRef: resolveSessionRef(ref),
          groupsCapability: ref.provider === "waha" ? "full" : "none",
        };
      },
      async listarLinhas() {
        return [];
      },
      async contarLigados() {
        return 0;
      },
      gravarLinha: naoSuportado,
      definirIa: naoSuportado,
    },
    async listGroups(provider, sessionRef) {
      if (provider !== "waha") return [];
      const client = getWahaClient();
      if (!client) return [];
      return client.listarGrupos(sessionRef);
    },
    async setGroupIntake() {
      return false;
    },
    async audit() {},
    agora: () => new Date(),
  };
}
