"use client";

import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";

import { useT } from "@/hooks/i18n/useT";
import { useState } from "react";
import { format } from "date-fns";
import { ShieldCheck, PencilSimple } from "@/lib/ui/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ChipDeEtiqueta } from "@/components/tags/ChipDeEtiqueta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useContact } from "@/hooks/contacts/useContact";
import { useHierarquiaDoAnuncio } from "@/hooks/contacts/useHierarquiaDoAnuncio";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useDefaultPipeline } from "@/hooks/pipelines/useDefaultPipeline";
import { camposDoFunil } from "@/lib/leads/campos-do-funil";
import { ROLE_RANK } from "@/lib/auth/types";
import { TimelineView } from "@/components/contacts/TimelineView";
import { EditContactDialog } from "@/components/contacts/EditContactDialog";
import { AnonymizeDialog } from "@/components/contacts/AnonymizeDialog";
import { AtestadoDoPaciente } from "@/components/clinic/lgpd/AtestadoDoPaciente";
import { PropostasDeDado } from "@/components/contacts/PropostasDeDado";
import { ConversaNoDossie } from "@/components/kanban/ConversaNoDossie";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { origemDoContato } from "@/lib/leads/origem-do-contato";
import { phoneForDisplay } from "@/lib/channels/phone-variants";
import { FichaDoPaciente } from "@/components/clinic/FichaDoPaciente";
import { AnexosDoPaciente } from "@/components/clinic/anexos/AnexosDoPaciente";
import { DocumentosDoPaciente } from "@/components/clinic/documentos/DocumentosDoPaciente";
import { OrcamentosDoPaciente } from "@/components/clinic/orcamentos/OrcamentosDoPaciente";
import { PlanosDoPaciente } from "@/components/clinic/planos/PlanosDoPaciente";
import { ProntuarioDoPaciente } from "@/components/clinic/prontuario/ProntuarioDoPaciente";
import { usePermissoes } from "@/lib/clinic/acesso/use-permissoes";
import { HistoricoDeAtendimentos } from "@/components/clinic/HistoricoDeAtendimentos";
import { DialButton } from "@/components/voice/DialButton";
import type { Contact } from "@/lib/types/contacts";
import { NovoTelefoneExtra, RemoverTelefoneExtra } from "@/components/clinic/TelefonesExtras";

interface Props {
  contactId: string;
  /** FORK clinic (prontuário F2): `?aba=` da URL, lido pela página (servidor). */
  abaInicial?: string;
  /** FORK clinic (#85): `settings.clinic.varios_telefones` — adicionar/remover telefones extras. */
  variosTelefones?: boolean;
}

/**
 * Um nível da origem, ou nada.
 *
 * Escondido quando não há valor, em vez de mostrar "—": quatro travessões
 * seguidos leem como cadastro quebrado, e não como "este contato não veio de
 * campanha". O rótulo chega já traduzido porque `t()` com argumento não literal
 * escapa do guardião de espanhol.
 */
function NivelDaOrigem({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <dt className="text-xs uppercase text-muted-foreground">{rotulo}</dt>
      <dd className="mt-1 break-words">{valor}</dd>
    </div>
  );
}

/**
 * Rótulos do tipo e do WhatsApp de um telefone (#85, upstream Spec 31 B1). Cada ramo traz o
 * `t("...")` LITERAL: o guardião de espanhol só enxerga texto escrito na tela, e
 * `t(variavel)` escapa dele.
 */
function textoDoTipoDoTelefone(tipo: string | null | undefined, t: (texto: string) => string): string | null {
  if (tipo === "fixo") return t("Fixo");
  if (tipo === "celular") return t("Celular");
  if (tipo === "outro") return t("Outro");
  return null;
}

function textoDoWhatsappDoTelefone(
  whatsapp: string | null | undefined,
  t: (texto: string) => string,
): string | null {
  if (whatsapp === "sim") return t("Tem WhatsApp");
  if (whatsapp === "nao") return t("Sem WhatsApp");
  if (whatsapp === "nao_sei") return t("WhatsApp: não sabemos");
  return null;
}

/**
 * O bloco "Telefones" da ficha (Spec 31, B1), SÓ LEITURA: o principal e cada
 * extra, com tipo, WhatsApp, rótulo e, quando a fusão trouxe o número, a origem.
 * Editar é a próxima entrega (B2). Só aparece com extra; sem extra a ficha segue
 * como hoje, com o tipo ao lado do número.
 */
function BlocoDeTelefones({
  contato,
  t,
  editavel = false,
}: {
  contato: Contact;
  t: (texto: string) => string;
  /** FORK clinic (#85): com a opção ligada, remover cada extra e adicionar um novo. */
  editavel?: boolean;
}) {
  const extras = contato.additional_phones ?? [];
  return (
    <div className="md:col-span-2">
      <dt className="text-xs uppercase text-muted-foreground">{t("Telefones")}</dt>
      <dd className="mt-1">
        <ul className="flex flex-col gap-2">
          {contato.phone_number && (
            <li className="flex flex-wrap items-center gap-2">
              <span>{phoneForDisplay(contato.phone_number)}</span>
              <Badge variant="secondary">{t("Principal")}</Badge>
              {textoDoTipoDoTelefone(contato.phone_type, t) && (
                <span className="text-xs text-muted-foreground">
                  {textoDoTipoDoTelefone(contato.phone_type, t)}
                </span>
              )}
              {textoDoWhatsappDoTelefone(contato.phone_whatsapp, t) && (
                <span className="text-xs text-muted-foreground">
                  {textoDoWhatsappDoTelefone(contato.phone_whatsapp, t)}
                </span>
              )}
            </li>
          )}
          {extras.map((extra) => (
            <li key={extra.phone_number} className="flex flex-wrap items-center gap-2">
              <span>{phoneForDisplay(extra.phone_number)}</span>
              {textoDoTipoDoTelefone(extra.type, t) && (
                <span className="text-xs text-muted-foreground">
                  {textoDoTipoDoTelefone(extra.type, t)}
                </span>
              )}
              {textoDoWhatsappDoTelefone(extra.whatsapp, t) && (
                <span className="text-xs text-muted-foreground">
                  {textoDoWhatsappDoTelefone(extra.whatsapp, t)}
                </span>
              )}
              {extra.label && <span className="text-xs text-muted-foreground">{extra.label}</span>}
              {extra.origin === "fusao" && (
                <span className="text-xs text-muted-foreground">{t("Veio da junção de fichas")}</span>
              )}
              {editavel && <RemoverTelefoneExtra contactId={contato.id} telefone={extra.phone_number} />}
            </li>
          ))}
        </ul>
        {editavel && <NovoTelefoneExtra contactId={contato.id} />}
      </dd>
    </div>
  );
}

export function ContactDetailClient({ contactId, abaInicial, variosTelefones = false }: Props) {
  const localeDaData = useLocaleDeData();
  const t = useT();
  // FORK clinic (prontuário F2): a aba Prontuário só existe para quem tem
  // `prontuario.ver` — administrar o sistema não é ver conteúdo clínico.
  const { can } = usePermissoes();
  const verProntuario = can("prontuario.ver");
  const verPlanos = can("planos.ver");
  const verDocumentos = can("documentos.ver");
  // FORK clinic (orçamento O2): não é conteúdo clínico — a recepção vê.
  const verOrcamentos = can("orcamentos.ver");
  const abaPedida = abaInicial ?? null;
  const q = useContact(contactId);
  const { user, activeOrg } = useAuth();
  const clientesLigado = activeOrg?.cliente_pela_agenda === true;
  // As DEFINIÇÕES continuam no funil (`crm_pipelines.settings.fields[]`) — só o
  // VALOR mora no contato. `camposDoFunil` é o mesmo leitor que o Kanban usa.
  const pipelineQuery = useDefaultPipeline(Boolean(activeOrg));
  const [editOpen, setEditOpen] = useState(false);
  const [anonOpen, setAnonOpen] = useState(false);

  /*
    Pede o nome da campanha SÓ quando há um anúncio e ainda não há nome.

    Quem chegou pelo site já trouxe os nomes na URL, e quem já foi resolvido uma
    vez tem `campaign_name` no metadata — nos dois casos, perguntar à plataforma
    gastaria cota para receber o que já está na tela. Cota é o recurso escasso
    desta conta, não latência.

    Derivado de `q.data` e não de `contact` porque hook não pode ficar depois de
    um `return` condicional — e os dois `if` de carregamento vêm logo abaixo.
  */
  const metadataDoContato = (q.data?.data.source_metadata ?? {}) as Record<string, unknown>;
  const temAnuncio =
    typeof metadataDoContato.ad_id === "string" && metadataDoContato.ad_id.trim() !== "";
  const jaTemNome = typeof metadataDoContato.campaign_name === "string";
  const hierarquia = useHierarquiaDoAnuncio(contactId, temAnuncio && !jaTemNome);

  if (q.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center text-sm text-error-fg">{t("Erro ao carregar paciente.")}</Card>
      </div>
    );
  }

  const contact = q.data.data;
  const isAdmin =
    (user.is_platform_admin && !user.support) || (activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin);

  // Uma decisão, um lugar (lib/contacts/rotulo-do-contato.ts). Esta tela era
  // uma das DUAS que ignoravam o telefone: contato com número e sem nome
  // aparecia como "Sem nome" aqui e com o número no inbox.
  const displayName = rotuloDoContato(contact, t);

  // Os quatro níveis que quem opera tráfego lê. O jsonb já os recebia dos dois
  // caminhos de entrada — site e clique-para-WhatsApp — e nenhuma tela o abria.
  //
  // O que a plataforma respondeu entra COMO SE fosse metadata, e não como um
  // segundo caminho na tela: as três chaves resolvidas (`campaign_name`,
  // `adset_name`, `ad_name`) são exatamente as que `origemDoContato` já lê, no
  // degrau abaixo da UTM. Uma regra de precedência só, e ela já estava escrita.
  const origem = origemDoContato(
    hierarquia.data
      ? { ...(contact.source_metadata ?? {}), ...hierarquia.data }
      : contact.source_metadata,
    contact.source,
  );

  return (
    <div className="space-y-4 p-6">
      {contact.is_anonymized && (
        <div
          role="alert"
          className="border-error-fg/30 sticky top-0 z-20 flex items-center gap-3 rounded-md border bg-error-bg p-3 text-sm text-error-fg"
        >
          <ShieldCheck size={18} weight="duotone" aria-hidden />
          <span>
            {t("Paciente anonimizado (LGPD)")}
            {contact.anonymized_at &&
              ` em ${format(new Date(contact.anonymized_at), "dd/MM/yyyy", { locale: localeDaData })}`}
            {t(" — edição bloqueada.")}
          </span>
        </div>
      )}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          {/* Sem truncar: nome é dado que a tela existe pra mostrar, e cortar
              com reticências sem um jeito de ver o resto violaria o princípio
              de nunca esconder informação crítica. Deixa quebrar linha. */}
          <h1 className="break-words text-2xl font-semibold tracking-tight">{displayName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {contact.email && <span>{contact.email}</span>}
            {contact.email && contact.phone_number && <span>•</span>}
            {contact.phone_number && <span>{phoneForDisplay(contact.phone_number)}</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {contact.tags.map((t) => (
              <ChipDeEtiqueta key={t} tag={t} />
            ))}
            {contact.is_blocked && <Badge variant="warning">{t("Bloqueado")}</Badge>}
            {contact.is_anonymized && <Badge variant="destructive">{t("Anonimizado")}</Badge>}
          </div>
        </div>
        {!contact.is_anonymized && user.support?.access_mode !== "support_readonly" && (
          <div className="flex shrink-0 items-center gap-2">
            <DialButton contactId={contactId} hasPhone={!!contact.phone_number} />
            <Button variant="outline" onClick={() => setEditOpen(true)} className="shrink-0">
              <PencilSimple size={16} weight="bold" aria-hidden />
              <span>{t("Editar")}</span>
            </Button>
          </div>
        )}
      </header>

      <ConversaNoDossie conversa={contact.conversa} />

      {/* ANTES das abas, e não dentro de uma delas: é o único conteúdo desta
          tela que PEDE uma ação. Enterrado numa aba, viraria pendência que só
          quem já sabe que existe encontra — e a fila deixaria de ser fila.
          Some sozinho quando não há nada aguardando. */}
      {!contact.is_anonymized && user.support?.access_mode !== "support_readonly" && (
        <PropostasDeDado
          contactId={contactId}
          podeDecidir={Boolean(activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.agent)}
          aoDecidir={() => void q.refetch()}
        />
      )}

      <Tabs defaultValue={["prontuario", "planos", "documentos", "anexos", "orcamentos"].includes(abaPedida ?? "") ? abaPedida! : "overview"}>
        <TabsList>
          <TabsTrigger value="overview">{t("Visão geral")}</TabsTrigger>
          <TabsTrigger value="ficha">{t("Ficha do paciente")}</TabsTrigger>
          {verProntuario && (
            <TabsTrigger value="prontuario" data-testid="aba-prontuario">
              {t("Prontuário")}
            </TabsTrigger>
          )}
          {verProntuario && (
            <TabsTrigger value="anexos" data-testid="aba-anexos">
              {t("Fotos e anexos")}
            </TabsTrigger>
          )}
          {verDocumentos && (
            <TabsTrigger value="documentos" data-testid="aba-documentos">
              {t("Documentos")}
            </TabsTrigger>
          )}
          {verOrcamentos && (
            <TabsTrigger value="orcamentos" data-testid="aba-orcamentos">
              {t("Orçamentos")}
            </TabsTrigger>
          )}
          {verPlanos && (
            <TabsTrigger value="planos" data-testid="aba-planos">
              {t("Planos")}
            </TabsTrigger>
          )}
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          {isAdmin && <TabsTrigger value="lgpd">LGPD</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card className="p-4">
            <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-muted-foreground">{t("Nome")}</dt>
                <dd className="mt-1">{contact.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">{t("Nome")} · WhatsApp</dt>
                <dd className="mt-1">{contact.display_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Email</dt>
                <dd className="mt-1">{contact.email ?? "—"}</dd>
              </div>
              {/*
                Com telefone extra, o bloco lista o principal e os extras (Spec 31,
                B1). Sem extra, a linha segue como hoje; o tipo do número vai ao lado.
              */}
              {variosTelefones || (contact.additional_phones && contact.additional_phones.length > 0) ? (
                <BlocoDeTelefones contato={contact} t={t} editavel={variosTelefones} />
              ) : (
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">{t("Telefone")}</dt>
                  <dd className="mt-1">
                    {contact.phone_number ? phoneForDisplay(contact.phone_number) : "—"}
                    {contact.phone_number && textoDoTipoDoTelefone(contact.phone_type, t) && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {textoDoTipoDoTelefone(contact.phone_type, t)}
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {/*
                A origem sai do `source_metadata` quando ele tem algo melhor a
                dizer, e cai na coluna `source` quando não tem. Antes esta linha
                lia só a coluna, e a resposta era `site` para quem chegou pelo
                link do site, ou o nome da plataforma para quem clicou num
                anúncio — mesmo com o `utm_source` da campanha gravado ao lado.
              */}
              <div>
                <dt className="text-xs uppercase text-muted-foreground">{t("Origem")}</dt>
                <dd className="mt-1">{origem.origem}</dd>
              </div>
              <NivelDaOrigem rotulo={t("Campanha")} valor={origem.campanha} />
              <NivelDaOrigem rotulo={t("Conjunto")} valor={origem.conjunto} />
              <NivelDaOrigem rotulo={t("Anúncio")} valor={origem.anuncio} />
              <NivelDaOrigem rotulo={t("Posicionamento")} valor={origem.posicionamento} />
              {origem.semPosicionamentoDeAnuncio && (
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    {t("Posicionamento")}
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    {t("A plataforma não informa o posicionamento de cada clique em anúncio.")}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase text-muted-foreground">{t("Última atividade")}</dt>
                <dd className="mt-1">
                  {contact.last_activity_at
                    ? format(new Date(contact.last_activity_at), "dd/MM/yyyy HH:mm", {
                        locale: localeDaData,
                      })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">{t("Criado em")}</dt>
                <dd className="mt-1">
                  {format(new Date(contact.created_at), "dd/MM/yyyy", { locale: localeDaData })}
                </dd>
              </div>
              {/*
                Escondido quando nulo, em vez de mostrar "—": aqui a ausência não
                é dado faltando, é "ainda não é cliente". Um travessão nesta
                linha leria como falha de cadastro. E escondido com a regra
                "Clientes pela agenda" desligada: a data está congelada.
              */}
              {clientesLigado && contact.first_service_at && (
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    {t("Cliente desde")}
                  </dt>
                  <dd className="mt-1">
                    {format(new Date(contact.first_service_at), "dd/MM/yyyy", {
                      locale: localeDaData,
                    })}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Tags</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {contact.tags.length === 0
                    ? "—"
                    : contact.tags.map((t) => (
                        <ChipDeEtiqueta key={t} tag={t} />
                      ))}
                </dd>
              </div>
            </dl>
          </Card>
        </TabsContent>

        {/* FORK clinic (migration 9002): a ficha cadastral do paciente. */}
        <TabsContent value="ficha" className="mt-4">
          <Card className="p-4">
            <FichaDoPaciente
              contactId={contactId}
              podeEditar={Boolean(activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.agent)}
            />
          </Card>
        </TabsContent>

        {verProntuario && (
          <TabsContent value="anexos" className="mt-4">
            <Card className="p-4">
              <AnexosDoPaciente contactId={contactId} />
            </Card>
          </TabsContent>
        )}
        {verDocumentos && (
          <TabsContent value="documentos" className="mt-4">
            <Card className="p-4">
              <DocumentosDoPaciente contactId={contactId} />
            </Card>
          </TabsContent>
        )}
        {verOrcamentos && (
          <TabsContent value="orcamentos" className="mt-4">
            <Card className="p-4">
              <OrcamentosDoPaciente contactId={contactId} />
            </Card>
          </TabsContent>
        )}
        {verPlanos && (
          <TabsContent value="planos" className="mt-4">
            <Card className="p-4">
              <PlanosDoPaciente contactId={contactId} />
            </Card>
          </TabsContent>
        )}
        {verProntuario && (
          <TabsContent value="prontuario" className="mt-4">
            <Card className="p-4">
              <ProntuarioDoPaciente contactId={contactId} />
            </Card>
          </TabsContent>
        )}

        <TabsContent value="timeline" className="mt-4 space-y-4">
          {/* FORK clinic (migration 9003): agendamentos e atendimentos do paciente. */}
          <HistoricoDeAtendimentos contactId={contactId} />
          <TimelineView contactId={contactId} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="lgpd" className="mt-4">
            <Card className="space-y-4 p-4">
              <div>
                <h2 className="text-lg font-semibold">{t("Direito ao esquecimento (LGPD)")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(
                    "A anonimização é irreversível. Use somente após confirmação formal do titular ou ordem judicial.",
                  )}
                </p>
              </div>
              {contact.is_anonymized ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t("Este paciente já foi anonimizado")}
                    {contact.anonymized_at &&
                      ` em ${format(new Date(contact.anonymized_at), "dd/MM/yyyy HH:mm", { locale: localeDaData })}`}
                    .
                  </p>
                  <AtestadoDoPaciente contactId={contactId} />
                </div>
              ) : (
                <Button variant="destructive" onClick={() => setAnonOpen(true)}>
                  {t("Anonimizar paciente")}
                </Button>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <EditContactDialog
        contact={contact}
        open={editOpen}
        onOpenChange={setEditOpen}
        customFieldDefs={camposDoFunil(pipelineQuery.data?.pipeline.settings ?? null)}
      />
      <AnonymizeDialog contactId={contactId} open={anonOpen} onOpenChange={setAnonOpen} />
    </div>
  );
}
