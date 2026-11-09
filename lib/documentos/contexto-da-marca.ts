/**
 * FORK clinic — o CONTEXTO DA MARCA: o único contrato entre Configurações
 * (› Organização e › Marca) e qualquer documento. Nenhum template lê o banco.
 *
 * `montarContextoDaMarca` é PURA (testável): recebe os campos crus e os bytes
 * do logo/favicon e devolve tudo já formatado, com vazios descartados.
 * `resolverContextoDaMarca` é a leitura do servidor: organização da SESSÃO (ou
 * a que o chamador já resolveu de fonte confiável), logo e favicon do bucket
 * `brand-logos` — só sob o prefixo da própria organização.
 *
 * Sem cache entre requisições: mudar a Organização ou a Marca vale no próximo
 * documento. (Dentro de uma requisição, o chamador resolve uma vez e reusa.)
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { baseDoStorage, caminhoBateComPrefixo, prefixoDaOrganizacao, urlPublicaDoLogo } from "@/lib/branding/logo";
import { marcaDaOrganizacaoDeSettings } from "@/lib/branding/organizacao";
import { faviconDeSettings } from "@/lib/clinic/marca/favicon";

import {
  cidadeUf,
  cidadeUfCep,
  formatarCnpj,
  formatarSite,
  linhaDoEndereco,
  linhaDoResponsavel,
  linhasDeContato,
  textoLimpo,
} from "./formatar";
import { silhuetaTingida, temTransparencia, tratarFavicon, tratarLogo, type ImagemDoDocumento } from "./imagens";
import { resolverPaleta, type Papeis } from "./paleta";
import { MARCA_DAGUA } from "./tema";

/** O que as duas telas de Configurações guardam — cru, como vem do banco. */
export interface EntradaDoContexto {
  nomeDaMarca?: string | null;
  nomeDeExibicao?: string | null;
  razaoSocial?: string | null;
  cnpj?: string | null;
  site?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  descritor?: string | null;
  responsavelNome?: string | null;
  responsavelRegistro?: string | null;
  endereco?: {
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
  };
  corDaMarca?: string | null;
  corDosFiletes?: string | null;
  logo?: Buffer | null;
  favicon?: Buffer | null;
  /**
   * Modelo em branco (emptyFieldPolicy.blankTemplateMode): campo vazio vira
   * "[Telefone / WhatsApp]", "[Endereço completo]"… Só para gerar o modelo —
   * documento EMITIDO nunca liga isto.
   */
  modeloEmBranco?: boolean;
}

export interface ContextoDaMarca {
  /** Wordmark e cabeçalho compacto. Nunca vazio (cai no nome de exibição, na razão social e, por fim, em "Documento"). */
  nomeDaMarca: string;
  /** Rodapé, em negrito. */
  razaoSocial: string;
  descritor: string | null;
  site: { exibir: string; url: string } | null;
  contatos: string[];
  cidadeUf: string | null;
  enderecoLinha: string | null;
  cidadeUfCep: string | null;
  cnpj: string | null;
  responsavel: string | null;
  logo: ImagemDoDocumento | null;
  /** Largura em px do logo original — decide a marca d'água (≥ 600). */
  larguraDoLogoOriginal: number;
  favicon: ImagemDoDocumento | null;
  /**
   * O SÍMBOLO da marca — coluna do logo no cabeçalho e marca d'água. É o logo
   * quando ele é compacto (proporção até 1,6:1); quando o logo é horizontal (já
   * traz o nome escrito, que o wordmark repetiria), é o favicon. Sem nenhum
   * dos dois, `null`: o cabeçalho fica só com o wordmark em texto.
   */
  simbolo: ImagemDoDocumento | null;
  /** Largura em px do arquivo de onde o símbolo veio. */
  larguraDoSimboloOriginal: number;
  /**
   * A marca d'água já pronta: a silhueta do símbolo tingida de `primary`.
   * `null` quando a régua não deixa — símbolo sem transparência, logo com menos
   * de 600 px ou favicon com menos de 512 px.
   */
  marcaDagua: ImagemDoDocumento | null;
  /** Modo "modelo em branco": campos vazios aparecem como [placeholder]. */
  modeloEmBranco: boolean;
  cores: Papeis;
  /** O que não saiu como cadastrado (CNPJ inválido, logo opaco, cor ajustada) — para a tela e o log. */
  avisos: string[];
}

/** Logo mais largo que isto é "horizontal" (traz o nome) e não serve de símbolo. */
const PROPORCAO_MAXIMA_DO_SIMBOLO = 1.6;

export async function montarContextoDaMarca(e: EntradaDoContexto): Promise<ContextoDaMarca> {
  const avisos: string[] = [];
  const nomeDaMarca =
    textoLimpo(e.nomeDaMarca) ?? textoLimpo(e.nomeDeExibicao) ?? textoLimpo(e.razaoSocial) ?? "Documento";
  const razaoSocial = textoLimpo(e.razaoSocial) ?? nomeDaMarca;

  const cnpj = formatarCnpj(e.cnpj);
  if (textoLimpo(e.cnpj) && !cnpj) avisos.push("O CNPJ cadastrado não confere (dígitos verificadores) e foi omitido dos documentos.");

  const logo = await tratarLogo(e.logo ?? null);
  if (logo.aviso) avisos.push(logo.aviso);

  const favicon = tratarFavicon(e.favicon ?? null);
  const logoCompacto = logo.imagem && logo.imagem.largura / logo.imagem.altura <= PROPORCAO_MAXIMA_DO_SIMBOLO ? logo.imagem : null;
  const simbolo = logoCompacto ?? favicon ?? null;
  const larguraDoSimboloOriginal = logoCompacto ? logo.larguraOriginal : (favicon?.largura ?? 0);

  const paleta = resolverPaleta({ semente: e.corDaMarca, corDosFiletes: e.corDosFiletes });
  avisos.push(...paleta.avisos);

  const reguaDaMarcaDagua = logoCompacto
    ? logo.larguraOriginal >= MARCA_DAGUA.larguraMinimaDoLogo
    : temTransparencia(favicon) && (favicon?.largura ?? 0) >= MARCA_DAGUA.larguraMinimaDoFavicon;
  const marcaDagua = simbolo && reguaDaMarcaDagua ? await silhuetaTingida(simbolo, paleta.papeis.primary) : null;

  // Modelo em branco: o placeholder entra NO LUGAR do campo vazio, nunca de um cheio.
  const branco = Boolean(e.modeloEmBranco);
  const ou = <T,>(valor: T | null, placeholder: T): T | null => (valor ?? (branco ? placeholder : null));
  const contatos = linhasDeContato(e.telefone, e.whatsapp);
  const cep = textoLimpo(e.endereco?.cep) ? cidadeUfCep({ cep: e.endereco?.cep }) : branco ? "[CEP]" : null;
  const cidade = cidadeUf(e.endereco ?? {}) ?? (branco ? "[Cidade – UF]" : null);
  const responsavelNome = textoLimpo(e.responsavelNome) ?? (branco ? "[Nome do(a) responsável técnico(a)]" : null);
  const responsavelRegistro = textoLimpo(e.responsavelRegistro) ?? (branco ? "[Registro profissional]" : null);

  const end = e.endereco ?? {};
  return {
    nomeDaMarca,
    razaoSocial,
    descritor: textoLimpo(e.descritor),
    site: ou(formatarSite(e.site), { exibir: "[site.com.br]", url: "" }),
    contatos: contatos.length ? contatos : branco ? ["[Telefone / WhatsApp]"] : [],
    cidadeUf: cidade,
    enderecoLinha: ou(linhaDoEndereco(end), "[Endereço completo]"),
    cidadeUfCep: [cidade, cep].filter(Boolean).join(" · ") || null,
    cnpj: ou(cnpj, "[00.000.000/0000-00]"),
    responsavel: linhaDoResponsavel(responsavelNome, responsavelRegistro),
    logo: logo.imagem,
    larguraDoLogoOriginal: logo.larguraOriginal,
    favicon,
    simbolo,
    larguraDoSimboloOriginal,
    marcaDagua,
    modeloEmBranco: Boolean(e.modeloEmBranco),
    cores: paleta.papeis,
    avisos,
  };
}

// ── servidor ────────────────────────────────────────────────────────────────

const LIMITE_DE_BYTES = 512 * 1024;

/** Baixa um arquivo do bucket de marcas, só sob o prefixo da organização. Nunca lança. */
async function baixarDaMarca(caminho: string | null | undefined, orgId: string): Promise<Buffer | null> {
  if (!caminho || !caminhoBateComPrefixo(caminho, prefixoDaOrganizacao(orgId))) return null;
  const base = baseDoStorage();
  if (!base) return null;
  try {
    const r = await fetch(urlPublicaDoLogo(caminho, base), { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 0 && buf.length <= LIMITE_DE_BYTES ? buf : null;
  } catch {
    return null;
  }
}

/** Colunas lidas de `organizations`. As de contato/endereço vêm da 8011. */
const COLUNAS =
  "display_name, legal_name, cnpj, settings, contact_phone, address_street, address_number, address_complement, address_district, address_city, address_uf, address_cep, website, whatsapp_phone, descriptor, technical_lead_name, technical_lead_registry";

interface LinhaDaOrganizacao {
  display_name: string | null;
  legal_name: string | null;
  cnpj: string | null;
  settings: unknown;
  contact_phone: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_uf: string | null;
  address_cep: string | null;
  website: string | null;
  whatsapp_phone: string | null;
  descriptor: string | null;
  technical_lead_name: string | null;
  technical_lead_registry: string | null;
}

/** Cliente do Supabase da leitura: sessão, ou service role já filtrado pela organização. */
type LeitorDeOrganizacao = SupabaseClient;

/** Os campos crus da organização (sem baixar arquivos). `null` se não achou. */
export async function lerEntradaDoContexto(
  leitor: LeitorDeOrganizacao,
  orgId: string,
): Promise<(EntradaDoContexto & { logoPath: string | null; faviconPath: string | null }) | null> {
  const { data } = await leitor.from("organizations").select(COLUNAS).eq("id", orgId).maybeSingle();
  if (!data) return null;
  const o = data as LinhaDaOrganizacao;
  const marca = marcaDaOrganizacaoDeSettings(o.settings);
  const clinic = (o.settings as { clinic?: Record<string, unknown> } | null)?.clinic ?? {};
  const texto = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    nomeDaMarca: marca?.app_name ?? null,
    nomeDeExibicao: o.display_name,
    razaoSocial: o.legal_name,
    cnpj: o.cnpj,
    telefone: o.contact_phone,
    whatsapp: o.whatsapp_phone,
    site: o.website,
    descritor: o.descriptor,
    responsavelNome: o.technical_lead_name,
    responsavelRegistro: o.technical_lead_registry,
    corDaMarca: marca?.accent_hex ?? null,
    corDosFiletes: texto(clinic.cor_filetes),
    endereco: {
      logradouro: o.address_street,
      numero: o.address_number,
      complemento: o.address_complement,
      bairro: o.address_district,
      cidade: o.address_city,
      uf: o.address_uf,
      cep: o.address_cep,
    },
    logoPath: marca?.logo_path ?? null,
    faviconPath: faviconDeSettings(o.settings),
  };
}

/**
 * O contexto completo de uma organização. `orgId` vem SEMPRE de fonte
 * confiável (sessão, token de link) — nunca do corpo de uma requisição.
 */
export async function resolverContextoDaMarca(leitor: LeitorDeOrganizacao, orgId: string): Promise<ContextoDaMarca | null> {
  const entrada = await lerEntradaDoContexto(leitor, orgId);
  if (!entrada) return null;
  const [logo, favicon] = await Promise.all([baixarDaMarca(entrada.logoPath, orgId), baixarDaMarca(entrada.faviconPath, orgId)]);
  return montarContextoDaMarca({ ...entrada, logo, favicon });
}

/**
 * O que fica guardado no documento EMITIDO (`clinic_documentos_emitidos.
 * marca_snapshot`, migration 8014): os campos CRUS das Configurações no dia
 * da primeira geração, mais os caminhos do logo e do favicon. Reimprimir
 * remonta o contexto a partir daqui — mudar a marca depois não muda o documento.
 */
export type SnapshotDaMarca = Omit<EntradaDoContexto, "logo" | "favicon" | "modeloEmBranco"> & {
  logoPath: string | null;
  faviconPath: string | null;
};

/** Valida o formato mínimo de um snapshot lido do banco. */
export function ehSnapshotDaMarca(x: unknown): x is SnapshotDaMarca {
  return typeof x === "object" && x !== null && !Array.isArray(x) && "logoPath" in x && "faviconPath" in x;
}

/**
 * O contexto de um snapshot. Logo e favicon são baixados pelos caminhos
 * guardados — se o arquivo já não existir (a marca trocou o logo e o antigo
 * foi apagado), o documento sai com o wordmark em texto, nunca com o logo novo.
 */
export async function contextoDoSnapshot(snapshot: SnapshotDaMarca, orgId: string): Promise<ContextoDaMarca> {
  const [logo, favicon] = await Promise.all([baixarDaMarca(snapshot.logoPath, orgId), baixarDaMarca(snapshot.faviconPath, orgId)]);
  return montarContextoDaMarca({ ...snapshot, logo, favicon });
}
