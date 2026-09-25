"use client";

/**
 * FORK clinic (9015) — o editor do POP (Tiptap): UM documento, sem campos.
 *
 * Só o que o esquema do servidor aceita (lib/clinic/pops/documento.ts): títulos
 * 1–3, parágrafo, negrito/itálico/sublinhado, listas, tabela simples, linha,
 * quebra de página. Link, imagem, código e HTML colado ficam FORA: as extensões
 * não são carregadas, então o editor nem produz esses nós.
 */
import { EditorContent, Node, mergeAttributes, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import * as React from "react";

import { useT } from "@/hooks/i18n/useT";
import type { Documento } from "@/lib/clinic/pops/documento";
import { cn } from "@/lib/utils";

import "./documento.css";

/** A quebra de página: um bloco atômico que o PDF transforma em página nova. */
const QuebraDePagina = Node.create({
  name: "quebraDePagina",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-quebra-de-pagina]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-quebra-de-pagina": "", class: "pop-quebra-de-pagina" }), "Quebra de página"];
  },
});

export const EXTENSOES_DO_POP = (placeholder: string) => [
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
  QuebraDePagina,
];

function Botao({
  rotulo,
  ativo,
  onClick,
  desabilitado,
  children,
}: {
  rotulo: string;
  ativo?: boolean;
  onClick: () => void;
  desabilitado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      aria-pressed={ativo === undefined ? undefined : ativo}
      disabled={desabilitado}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "min-h-8 min-w-8 rounded-md px-2 text-sm hover:bg-muted disabled:opacity-40",
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
  const c = () => editor.chain().focus();
  const naTabela = editor.isActive("table");
  return (
    <div role="toolbar" aria-label={t("Formatação do documento")} className="flex flex-wrap items-center gap-0.5 border-b bg-surface p-1" data-testid="pop-barra">
      <Botao rotulo={t("Título 1")} ativo={editor.isActive("heading", { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()}>
        H1
      </Botao>
      <Botao rotulo={t("Título 2")} ativo={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>
        H2
      </Botao>
      <Botao rotulo={t("Título 3")} ativo={editor.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}>
        H3
      </Botao>
      <Botao rotulo={t("Parágrafo")} ativo={editor.isActive("paragraph")} onClick={() => c().setParagraph().run()}>
        ¶
      </Botao>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Botao rotulo={t("Negrito")} ativo={editor.isActive("bold")} onClick={() => c().toggleBold().run()}>
        <b>N</b>
      </Botao>
      <Botao rotulo={t("Itálico")} ativo={editor.isActive("italic")} onClick={() => c().toggleItalic().run()}>
        <i>I</i>
      </Botao>
      <Botao rotulo={t("Sublinhado")} ativo={editor.isActive("underline")} onClick={() => c().toggleUnderline().run()}>
        <u>S</u>
      </Botao>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Botao rotulo={t("Lista com marcadores")} ativo={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}>
        •≡
      </Botao>
      <Botao rotulo={t("Lista numerada")} ativo={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}>
        1≡
      </Botao>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Botao rotulo={t("Inserir tabela")} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        ⊞
      </Botao>
      <Botao rotulo={t("Adicionar linha")} desabilitado={!naTabela} onClick={() => c().addRowAfter().run()}>
        +≡
      </Botao>
      <Botao rotulo={t("Adicionar coluna")} desabilitado={!naTabela} onClick={() => c().addColumnAfter().run()}>
        +‖
      </Botao>
      <Botao rotulo={t("Remover linha")} desabilitado={!naTabela} onClick={() => c().deleteRow().run()}>
        −≡
      </Botao>
      <Botao rotulo={t("Remover coluna")} desabilitado={!naTabela} onClick={() => c().deleteColumn().run()}>
        −‖
      </Botao>
      <Botao rotulo={t("Remover tabela")} desabilitado={!naTabela} onClick={() => c().deleteTable().run()}>
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
      <Botao rotulo={t("Desfazer")} desabilitado={!editor.can().undo()} onClick={() => c().undo().run()}>
        ↶
      </Botao>
      <Botao rotulo={t("Refazer")} desabilitado={!editor.can().redo()} onClick={() => c().redo().run()}>
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
  const aoMudar = React.useRef(onChange);
  React.useEffect(() => {
    aoMudar.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: editavel,
    extensions: EXTENSOES_DO_POP(t("Escreva o POP aqui…")),
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
    editor?.setEditable(editavel);
  }, [editor, editavel]);

  return (
    <div className="overflow-hidden rounded-xl border bg-background" data-testid="pop-editor" data-editavel={editavel}>
      {editor && editavel ? <Barra editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}
