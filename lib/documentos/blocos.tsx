/**
 * FORK clinic — o CORPO do documento: blocos semânticos, nunca estilo.
 *
 * Cada tipo de documento entrega só uma árvore de nós (a mesma lista fechada
 * do editor de POP — `lib/clinic/pops/documento.ts` — mais o nó `aviso`), e
 * quem desenha é daqui, com os tokens de `tema.ts` e as cores de `paleta.ts`.
 * Texto é sempre texto: nada é interpretado como marcação.
 */
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import React from "react";

import type { NoDoDocumento } from "@/lib/clinic/pops/documento";

import { ESTADOS, coresDoAviso, type Estado, type Papeis } from "./paleta";
import { AVISO, FAMILIA, TABELA, TIPO } from "./tema";

export function estilosDoCorpo(c: Papeis) {
  return { ...criarEstilosDoCorpo(c), cores: c };
}

function criarEstilosDoCorpo(c: Papeis) {
  return StyleSheet.create({
    p: { fontFamily: FAMILIA.texto, fontSize: TIPO.corpo.tamanho, lineHeight: TIPO.corpo.entrelinha, marginBottom: TIPO.corpo.depois, color: c.ink },
    h1: { fontFamily: FAMILIA.titulo, fontWeight: TIPO.h1.peso, fontSize: TIPO.h1.tamanho, lineHeight: TIPO.h1.entrelinha, marginTop: TIPO.h1.antes, marginBottom: TIPO.h1.depois, color: c.ink },
    h2: { fontFamily: FAMILIA.titulo, fontWeight: TIPO.h2.peso, fontSize: TIPO.h2.tamanho, lineHeight: TIPO.h2.entrelinha, marginTop: TIPO.h2.antes, marginBottom: TIPO.h2.depois, color: c.primary },
    h3: { fontFamily: FAMILIA.texto, fontWeight: TIPO.h3.peso, fontSize: TIPO.h3.tamanho, lineHeight: TIPO.h3.entrelinha, marginTop: TIPO.h3.antes, marginBottom: TIPO.h3.depois, color: c.ink },
    lista: { marginBottom: TIPO.corpo.depois },
    item: { flexDirection: "row", paddingLeft: TIPO.lista.recuo - TIPO.lista.deslocamento },
    marcador: { width: TIPO.lista.deslocamento, fontFamily: FAMILIA.texto, fontSize: TIPO.corpo.tamanho, lineHeight: TIPO.corpo.entrelinha, color: c.primary },
    itemCorpo: { flex: 1 },
    hr: { borderTopWidth: TABELA.divisoria, borderTopColor: c.border, marginVertical: 8 },
    tabela: { marginBottom: TIPO.corpo.depois, borderTopWidth: TABELA.divisoria, borderTopColor: c.border },
    linha: { flexDirection: "row", minHeight: TABELA.alturaMinima, borderBottomWidth: TABELA.divisoria, borderBottomColor: c.border },
    linhaCabecalho: { flexDirection: "row", minHeight: TABELA.alturaMinima, backgroundColor: c.surface, borderBottomWidth: TABELA.divisoria, borderBottomColor: c.border },
    celula: { flex: 1, padding: TABELA.padding, justifyContent: "center" },
    textoDaCelula: { fontFamily: FAMILIA.texto, fontSize: 10, lineHeight: 1.35, color: c.ink },
    textoDoCabecalho: { fontFamily: FAMILIA.texto, fontWeight: TABELA.cabecalho.peso, fontSize: TABELA.cabecalho.tamanho, color: c.ink },
  });
}
export type EstilosDoCorpo = ReturnType<typeof estilosDoCorpo>;

/** Caixa de aviso (5.10): fundo surface + borda primary + ícone + texto, na paleta do papel (#126). Nunca usa `accent`. */
export function CaixaDeAviso({ estado, texto, cores }: { estado: Estado; texto: string; cores: Papeis }) {
  const e = coresDoAviso(estado, cores);
  return (
    <View
      wrap={false}
      style={{ flexDirection: "row", backgroundColor: e.fundo, borderWidth: AVISO.borda, borderColor: e.borda, padding: AVISO.padding, marginBottom: TIPO.corpo.depois }}
    >
      <Text style={{ fontFamily: FAMILIA.texto, fontWeight: 700, fontSize: AVISO.tamanho, color: e.texto, width: 18 }}>{e.icone}</Text>
      <Text style={{ flex: 1, fontFamily: FAMILIA.texto, fontWeight: 700, fontSize: AVISO.tamanho, lineHeight: 1.35, color: e.texto }}>{texto}</Text>
    </View>
  );
}

/** Texto com negrito e sublinhado. Itálico sai normal (ver `fontes.ts`). */
function emLinha(nos: NoDoDocumento[] | undefined, chave: string): React.ReactNode[] {
  return (nos ?? []).map((n, i) => {
    if (n.type === "hardBreak") return "\n";
    if (n.type !== "text" || !n.text) return null;
    const negrito = n.marks?.some((m) => m.type === "bold");
    const sublinhado = n.marks?.some((m) => m.type === "underline");
    return (
      <Text key={`${chave}-${i}`} style={{ fontWeight: negrito ? 700 : 400, textDecoration: sublinhado ? "underline" : "none" }}>
        {n.text}
      </Text>
    );
  });
}

function textoPlano(nos: NoDoDocumento[] | undefined): string {
  return (nos ?? []).map((n) => (n.type === "text" ? (n.text ?? "") : n.type === "hardBreak" ? "\n" : textoPlano(n.content))).join("");
}

export function Bloco({ no: n, s, chave, ordem }: { no: NoDoDocumento; s: EstilosDoCorpo; chave: string; ordem?: number }): React.ReactElement | null {
  const filhos = n.content ?? [];
  switch (n.type) {
    case "heading": {
      const nivel = (n.attrs?.level as number | undefined) ?? 2;
      return (
        <Text style={nivel === 1 ? s.h1 : nivel === 2 ? s.h2 : s.h3} minPresenceAhead={40}>
          {emLinha(filhos, chave)}
        </Text>
      );
    }
    case "paragraph":
      return <Text style={s.p}>{filhos.length ? emLinha(filhos, chave) : " "}</Text>;
    case "bulletList":
    case "orderedList": {
      const inicio = (n.attrs?.start as number | undefined) ?? 1;
      return (
        <View style={s.lista}>
          {filhos.map((f, i) => (
            <Bloco key={`${chave}-${i}`} no={f} s={s} chave={`${chave}-${i}`} ordem={n.type === "orderedList" ? inicio + i : undefined} />
          ))}
        </View>
      );
    }
    case "listItem":
      return (
        <View style={s.item} wrap={false}>
          <Text style={s.marcador}>{ordem !== undefined ? `${ordem}.` : TIPO.lista.marcador}</Text>
          <View style={s.itemCorpo}>
            {filhos.map((f, i) =>
              f.type === "paragraph" ? (
                <Text key={`${chave}-${i}`} style={{ ...s.p, marginBottom: 2 }}>
                  {emLinha(f.content, `${chave}-${i}`)}
                </Text>
              ) : (
                <Bloco key={`${chave}-${i}`} no={f} s={s} chave={`${chave}-${i}`} />
              ),
            )}
          </View>
        </View>
      );
    case "table": {
      const linhas = filhos;
      const ehCabecalho = (l: NoDoDocumento) => (l.content ?? []).length > 0 && (l.content ?? []).every((c) => c.type === "tableHeader");
      return (
        <View style={s.tabela}>
          {linhas.map((linha, i) => {
            const cab = ehCabecalho(linha);
            return (
              // O cabeçalho é `fixed`: repete no topo de cada página que a tabela atravessa.
              <View key={`${chave}-${i}`} style={cab ? s.linhaCabecalho : s.linha} wrap={false} fixed={cab && i === 0}>
                {(linha.content ?? []).map((cel, j) => (
                  <View key={`${chave}-${i}-${j}`} style={s.celula}>
                    <Text style={cel.type === "tableHeader" ? s.textoDoCabecalho : s.textoDaCelula}>{textoPlano(cel.content)}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      );
    }
    case "aviso": {
      const estado = ((n.attrs?.estado as string | undefined) ?? "atencao") as Estado;
      return <CaixaDeAviso estado={estado in ESTADOS ? estado : "atencao"} texto={textoPlano(filhos)} cores={s.cores} />;
    }
    case "horizontalRule":
      return <View style={s.hr} />;
    case "quebraDePagina":
      return <View break />;
    default:
      return null;
  }
}
