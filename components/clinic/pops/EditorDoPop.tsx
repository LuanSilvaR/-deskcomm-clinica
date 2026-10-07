"use client";

/**
 * FORK clinic (9015) — o editor do POP (Tiptap): UM documento, sem campos.
 *
 * Só o que o esquema do servidor aceita (lib/clinic/pops/documento.ts): títulos
 * 1–3, parágrafo, negrito/itálico/sublinhado, listas, tabela simples, linha,
 * quebra de página. Link, imagem, código e HTML colado ficam FORA: as extensões
 * não são carregadas, então o editor nem produz esses nós.
 *
 * Teclado (padrão WAI-ARIA de toolbar): Alt+F10 leva do texto à barra; na
 * barra, setas/Home/End andam entre os botões (um só fica no Tab) e Esc volta
 * ao texto. Cada botão anuncia o atalho (aria-keyshortcuts) e o estado
 * (aria-pressed), lido do editor a cada transação (useEditorState — o Tiptap 3
 * não re-renderiza sozinho).
 */
import { EditorContent, Extension, Node, mergeAttributes, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import * as React from "react";

import { useT } from "@/hooks/i18n/useT";
import type { Documento } from "@/lib/clinic/pops/documento";
import { cn } from "@/lib/utils";

import "./documento.css";

/** A quebra de página: um bloco atômico que o PDF transforma em página nova. */
const QuebraDePagina = Node.create<{ rotulo: string }>({
  name: "quebraDePagina",
  group: "block",
  atom: true,
  selectable: true,
  addOptions() {
    return { rotulo: "Quebra de página" };
  },
  parseHTML() {
    return [{ tag: "div[data-quebra-de-pagina]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-quebra-de-pagina": "", class: "pop-quebra-de-pagina" }), this.options.rotulo];
  },
});

/** Alt+F10: do texto para o botão da barra que está no Tab (o último usado). */
const IrParaABarra = Extension.create({
  name: "irParaABarra",
  addKeyboardShortcuts() {
    return {
      "Alt-F10": ({ editor }) => {
        const barra = editor.view.dom.closest("[data-pop-editor]")?.querySelector<HTMLElement>('[role="toolbar"] button[tabindex="0"]');
        if (!barra) return false;
        barra.focus();
        return true;
      },
    };
  },
});

export const EXTENSOES_DO_POP = (placeholder: string, rotuloDaQuebra = "Quebra de página") => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    strike: false,
    link: false,
  }),
  TableKit.configure({ table: { resizable: false } }),
  Placeholder.configure({ placeholder }),
  QuebraDePagina.configure({ rotulo: rotuloDaQuebra }),
  IrParaABarra,
];

function Botao({
  rotulo,
  atalho,
  ativo,
  onClick,
  desabilitado,
  children,
}: {
  rotulo: string;
  /** Atalho do Tiptap, no formato de aria-keyshortcuts (ex.: "Control+B"). */
  atalho?: string;
  ativo?: boolean;
  onClick: () => void;
  desabilitado?: boolean;
  children: React.ReactNode;
}) {
  const dica = atalho ? `${rotulo} (${atalho.replace(/Control/g, "Ctrl")})` : rotulo;
  return (
    <button
      type="button"
      aria-label={rotulo}
      aria-keyshortcuts={atalho}
      title={dica}
      aria-pressed={ativo === undefined ? undefined : ativo}
      disabled={desabilitado}
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "min-h-11 min-w-11 rounded-md px-2 text-sm hover:bg-muted disabled:opacity-40 md:min-h-8 md:min-w-8",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        ativo && "bg-accent-soft text-accent font-semibold",
      )}
    >
      {children}
    </button>
  );
}

function Barra({ editor }: { editor: Editor }) {
  const t = useT();
  const ref = React.useRef<HTMLDivElement>(null);
  const [foco, setFoco] = React.useState(0);
  const c = () => editor.chain().focus();
  const e = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      h1: ed.isActive("heading", { level: 1 }),
      h2: ed.isActive("heading", { level: 2 }),
      h3: ed.isActive("heading", { level: 3 }),
      paragrafo: ed.isActive("paragraph"),
      negrito: ed.isActive("bold"),
      italico: ed.isActive("italic"),
      sublinhado: ed.isActive("underline"),
      marcadores: ed.isActive("bulletList"),
      numerada: ed.isActive("orderedList"),
      naTabela: ed.isActive("table"),
      podeDesfazer: ed.can().undo(),
      podeRefazer: ed.can().redo(),
    }),
  });

  // Tabindex móvel: só o botão "da vez" entra no Tab; os desabilitados são pulados.
  const botoes = React.useCallback(
    () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? []),
    [],
  );
  React.useEffect(() => {
    const lista = botoes();
    const alvo = lista[foco]?.disabled ? lista.findIndex((b) => !b.disabled) : foco;
    lista.forEach((b, i) => (b.tabIndex = i === alvo ? 0 : -1));
  });

  function aoTeclar(ev: React.KeyboardEvent<HTMLDivElement>) {
    const lista = botoes();
    const ativos = lista.map((b, i) => (b.disabled ? -1 : i)).filter((i) => i >= 0);
    const atual = lista.indexOf(document.activeElement as HTMLButtonElement);
    const pos = ativos.indexOf(atual);
    let proximo: number | undefined;
    if (ev.key === "ArrowRight") proximo = ativos[(pos + 1) % ativos.length];
    else if (ev.key === "ArrowLeft") proximo = ativos[(pos - 1 + ativos.length) % ativos.length];
    else if (ev.key === "Home") proximo = ativos[0];
    else if (ev.key === "End") proximo = ativos[ativos.length - 1];
    else if (ev.key === "Escape") {
      ev.preventDefault();
      editor.commands.focus();
      return;
    }
    if (proximo === undefined) return;
    ev.preventDefault();
    setFoco(proximo);
    lista[proximo]?.focus();
  }

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={t("Formatação do documento")}
      aria-orientation="horizontal"
      onKeyDown={aoTeclar}
      onFocus={(ev) => {
        const i = botoes().indexOf(ev.target as unknown as HTMLButtonElement);
        if (i >= 0) setFoco(i);
      }}
      className="flex flex-wrap items-center gap-0.5 border-b bg-surface p-1"
      data-testid="pop-barra"
    >
      <Botao rotulo={t("Título 1")} atalho="Control+Alt+1" ativo={e.h1} onClick={() => c().toggleHeading({ level: 1 }).run()}>
        H1
      </Botao>
      <Botao rotulo={t("Título 2")} atalho="Control+Alt+2" ativo={e.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>
        H2
      </Botao>
      <Botao rotulo={t("Título 3")} atalho="Control+Alt+3" ativo={e.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>
        H3
      </Botao>
      <Botao rotulo={t("Parágrafo")} atalho="Control+Alt+0" ativo={e.paragrafo} onClick={() => c().setParagraph().run()}>
        ¶
      </Botao>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Botao rotulo={t("Negrito")} atalho="Control+B" ativo={e.negrito} onClick={() => c().toggleBold().run()}>
        <b>N</b>
      </Botao>
      <Botao rotulo={t("Itálico")} atalho="Control+I" ativo={e.italico} onClick={() => c().toggleItalic().run()}>
        <i>I</i>
      </Botao>
      <Botao rotulo={t("Sublinhado")} atalho="Control+U" ativo={e.sublinhado} onClick={() => c().toggleUnderline().run()}>
        <u>S</u>
      </Botao>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Botao rotulo={t("Lista com marcadores")} atalho="Control+Shift+8" ativo={e.marcadores} onClick={() => c().toggleBulletList().run()}>
        •≡
      </Botao>
      <Botao rotulo={t("Lista numerada")} atalho="Control+Shift+7" ativo={e.numerada} onClick={() => c().toggleOrderedList().run()}>
        1≡
      </Botao>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Botao rotulo={t("Inserir tabela")} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        ⊞
      </Botao>
      <Botao rotulo={t("Adicionar linha")} desabilitado={!e.naTabela} onClick={() => c().addRowAfter().run()}>
        +≡
      </Botao>
      <Botao rotulo={t("Adicionar coluna")} desabilitado={!e.naTabela} onClick={() => c().addColumnAfter().run()}>
        +‖
      </Botao>
      <Botao rotulo={t("Remover linha")} desabilitado={!e.naTabela} onClick={() => c().deleteRow().run()}>
        −≡
      </Botao>
      <Botao rotulo={t("Remover coluna")} desabilitado={!e.naTabela} onClick={() => c().deleteColumn().run()}>
        −‖
      </Botao>
      <Botao rotulo={t("Remover tabela")} desabilitado={!e.naTabela} onClick={() => c().deleteTable().run()}>
        ⊠
      </Botao>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Botao rotulo={t("Linha horizontal")} onClick={() => c().setHorizontalRule().run()}>
        ―
      </Botao>
      <Botao rotulo={t("Quebra de página")} onClick={() => c().insertContent({ type: "quebraDePagina" }).run()}>
        ⤓
      </Botao>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Botao rotulo={t("Desfazer")} atalho="Control+Z" desabilitado={!e.podeDesfazer} onClick={() => c().undo().run()}>
        ↶
      </Botao>
      <Botao rotulo={t("Refazer")} atalho="Control+Shift+Z" desabilitado={!e.podeRefazer} onClick={() => c().redo().run()}>
        ↷
      </Botao>
    </div>
  );
}

export function EditorDoPop({
  conteudo,
  editavel,
  onChange,
  rotulo,
}: {
  conteudo: Documento;
  editavel: boolean;
  onChange?: (doc: Documento) => void;
  /** Nome acessível da área de texto. */
  rotulo: string;
}) {
  const t = useT();
  const idDaDica = React.useId();
  const aoMudar = React.useRef(onChange);
  React.useEffect(() => {
    aoMudar.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: editavel,
    extensions: EXTENSOES_DO_POP(t("Escreva o POP aqui…"), t("Quebra de página")),
    content: conteudo,
    editorProps: {
      attributes: {
        "aria-label": rotulo,
        "aria-multiline": "true",
        role: "textbox",
        class: "pop-documento min-h-[420px] px-6 py-4 focus:outline-hidden",
        "data-testid": "pop-texto",
      },
    },
    onUpdate: ({ editor: e }) => aoMudar.current?.(e.getJSON() as Documento),
  });

  React.useEffect(() => {
    if (!editor) return;
    editor.setEditable(editavel);
    // A dica de teclado só existe (e só é descrita) enquanto o texto é editável.
    const attrs: Record<string, string> = { ...(editor.options.editorProps.attributes as Record<string, string>), "aria-readonly": editavel ? "false" : "true" };
    if (editavel) attrs["aria-describedby"] = idDaDica;
    else delete attrs["aria-describedby"];
    editor.setOptions({ editorProps: { ...editor.options.editorProps, attributes: attrs } });
  }, [editor, editavel, idDaDica]);

  return (
    <div className="overflow-hidden rounded-xl border bg-background" data-testid="pop-editor" data-pop-editor="" data-editavel={editavel}>
      {editor && editavel ? <Barra editor={editor} /> : null}
      <EditorContent editor={editor} />
      {editavel ? (
        <p id={idDaDica} className="border-t px-6 py-1.5 text-xs text-text-muted" data-testid="pop-dica-teclado">
          {t("Alt+F10 leva à barra de formatação; setas andam entre os botões e Esc volta ao texto.")}
        </p>
      ) : null}
    </div>
  );
}
