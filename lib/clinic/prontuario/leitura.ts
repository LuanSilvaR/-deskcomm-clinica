/**
 * FORK clinic (prontuário F2) — leitura dos registros clínicos de atendimentos.
 *
 * Uma consulta por tabela para um LOTE de atendimentos (a linha do tempo pede 20
 * de uma vez), sempre com o client da SESSÃO: a RLS (9018/9019) só devolve linha
 * a quem tem `prontuario.ver` na empresa. Nada aqui decide acesso — a rota exige
 * a permissão e o banco confere de novo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { camposSchema, type Campo, type Respostas } from "@/lib/clinic/formularios/campos";

export type TipoDeFormulario = "anamnese" | "avaliacao";
export const TIPOS_DE_FORMULARIO: readonly TipoDeFormulario[] = ["anamnese", "avaliacao"];

export interface FormularioLido {
  id: string;
  tipo: TipoDeFormulario;
  versao: number;
  status: "rascunho" | "finalizado";
  respostas: Respostas;
  modelo_versao_id: string;
  modelo_nome: string | null;
  campos: Campo[];
}

export interface EvolucaoLida {
  id: string;
  versao: number;
  status: "rascunho" | "finalizado";
  resposta: string | null;
  observacoes: string | null;
  intercorrencias: string | null;
  orientacoes: string | null;
  proxima_conduta: string | null;
}

export interface AdendoLido {
  id: string;
  alvo_tipo: "formulario" | "evolucao";
  alvo_id: string;
  texto: string;
  motivo: string;
  autor: string | null;
  criado_em: string;
}

export interface RegistrosDoAtendimento {
  formularios: Partial<Record<TipoDeFormulario, FormularioLido>>;
  evolucao: EvolucaoLida | null;
  adendos: AdendoLido[];
}

type Um<T> = T | T[] | null;
const primeiro = <T>(v: Um<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Campos gravados no banco, lidos com tolerância: versão antiga que não valide vira lista vazia, nunca exceção. */
export function lerCampos(bruto: unknown): Campo[] {
  const r = camposSchema.safeParse(bruto);
  return r.success ? r.data : [];
}

export async function registrosDosAtendimentos(
  supabase: SupabaseClient,
  organizationId: string,
  atendimentoIds: readonly string[],
): Promise<Map<string, RegistrosDoAtendimento>> {
  const mapa = new Map<string, RegistrosDoAtendimento>(
    atendimentoIds.map((id) => [id, { formularios: {}, evolucao: null, adendos: [] }]),
  );
  if (atendimentoIds.length === 0) return mapa;
  const ids = [...atendimentoIds];

  const [forms, evos, adendos] = await Promise.all([
    supabase
      .from("clinic_formularios_preenchidos")
      .select(
        "id, atendimento_id, tipo, versao, status, respostas, modelo_versao_id, " +
          "clinic_modelos_formulario_versoes(campos, clinic_modelos_formulario(nome))",
      )
      .eq("organization_id", organizationId)
      .in("atendimento_id", ids),
    supabase
      .from("clinic_evolucoes")
      .select("id, atendimento_id, versao, status, resposta, observacoes, intercorrencias, orientacoes, proxima_conduta")
      .eq("organization_id", organizationId)
      .in("atendimento_id", ids),
    supabase
      .from("clinic_adendos")
      .select("id, atendimento_id, alvo_tipo, alvo_id, texto, motivo, autor, created_at")
      .eq("organization_id", organizationId)
      .in("atendimento_id", ids)
      .order("created_at", { ascending: true }),
  ]);
  const erro = forms.error ?? evos.error ?? adendos.error;
  if (erro) throw new Error(erro.message);

  // Nome de quem escreveu o adendo: o cadastro de profissional, quando houver.
  const autores = [...new Set((adendos.data ?? []).map((a) => a.autor as string | null).filter((x): x is string => !!x))];
  const { data: profs } = autores.length
    ? await supabase.from("clinic_professionals").select("user_id, display_name").eq("organization_id", organizationId).in("user_id", autores)
    : { data: [] };
  const nomeDe = new Map((profs ?? []).map((p) => [p.user_id as string, (p.display_name as string | null) ?? null]));

  for (const f of (forms.data ?? []) as unknown as Array<{
    id: string;
    atendimento_id: string;
    tipo: TipoDeFormulario;
    versao: number;
    status: "rascunho" | "finalizado";
    respostas: Respostas;
    modelo_versao_id: string;
    clinic_modelos_formulario_versoes: Um<{ campos: unknown; clinic_modelos_formulario: Um<{ nome: string }> }>;
  }>) {
    const versao = primeiro(f.clinic_modelos_formulario_versoes);
    const alvo = mapa.get(f.atendimento_id);
    if (!alvo) continue;
    alvo.formularios[f.tipo] = {
      id: f.id,
      tipo: f.tipo,
      versao: f.versao,
      status: f.status,
      respostas: f.respostas ?? {},
      modelo_versao_id: f.modelo_versao_id,
      modelo_nome: primeiro(versao?.clinic_modelos_formulario ?? null)?.nome ?? null,
      campos: lerCampos(versao?.campos),
    };
  }
  for (const e of (evos.data ?? []) as unknown as Array<EvolucaoLida & { atendimento_id: string }>) {
    const alvo = mapa.get(e.atendimento_id);
    if (!alvo) continue;
    const { atendimento_id: _ignorado, ...evolucao } = e;
    alvo.evolucao = evolucao;
  }
  for (const a of (adendos.data ?? []) as unknown as Array<{
    id: string;
    atendimento_id: string;
    alvo_tipo: "formulario" | "evolucao";
    alvo_id: string;
    texto: string;
    motivo: string;
    autor: string | null;
    created_at: string;
  }>) {
    mapa.get(a.atendimento_id)?.adendos.push({
      id: a.id,
      alvo_tipo: a.alvo_tipo,
      alvo_id: a.alvo_id,
      texto: a.texto,
      motivo: a.motivo,
      autor: a.autor ? (nomeDe.get(a.autor) ?? null) : null,
      criado_em: a.created_at,
    });
  }
  return mapa;
}
