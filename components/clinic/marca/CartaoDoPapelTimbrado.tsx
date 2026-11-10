"use client";

/**
 * FORK clinic (8013) — o papel timbrado em Configurações › Marca.
 *
 * Dois controles:
 *  - a COR DO PAPEL TIMBRADO: pinta o documento inteiro (faixa, títulos, tabelas,
 *    filetes); vazia, vale a cor da Marca (issue #126). A coluna segue
 *    `cor_filetes` (nome histórico — não se renomeia campo em uso).
 *    Vazia, o papel usa um tom claro derivado da cor da marca. Nunca vira texto.
 *  - "Baixar modelo": o PDF do papel timbrado desta empresa como ele sai em todo
 *    documento, com [placeholders] no que ainda falta preencher — o laço de
 *    retorno entre as Configurações e os documentos.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/i18n/useT";

const HEX = /^#[0-9a-fA-F]{6}$/;

export function CartaoDoPapelTimbrado({ corDosFiletes }: { corDosFiletes: string | null }) {
  const t = useT();
  const router = useRouter();
  const [cor, setCor] = useState(corDosFiletes ?? "");
  const [salvando, startTransition] = useTransition();
  const valida = cor.trim() === "" || HEX.test(cor.trim());

  function salvar(hex: string | null) {
    startTransition(async () => {
      const r = await fetch("/api/v1/clinic/marca/cor-filetes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hex }),
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(t(corpo?.error?.message ?? "Não consegui salvar a cor agora."));
        return;
      }
      toast.success(t("Papel timbrado atualizado."));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4" data-papel-timbrado>
      <div className="space-y-2">
        <Label htmlFor="cor-filetes">{t("Cor do papel timbrado (opcional)")}</Label>
        <div className="flex flex-wrap items-center gap-3">
          <label
            className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-sm border border-border"
            style={{ backgroundColor: HEX.test(cor) ? cor : "transparent" }}
          >
            <span className="sr-only">{t("Escolher a cor visualmente")}</span>
            <input
              type="color"
              value={HEX.test(cor) ? cor : "#d4af7c"}
              onChange={(e) => setCor(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <Input
            id="cor-filetes"
            value={cor}
            onChange={(e) => setCor(e.target.value)}
            placeholder="#d4af7c"
            className="w-36 font-mono"
            aria-invalid={!valida}
          />
          <Button type="button" onClick={() => salvar(cor.trim() ? cor.trim().toLowerCase() : null)} disabled={salvando || !valida}>
            {salvando ? t("Salvando…") : t("Salvar cor")}
          </Button>
        </div>
        <p className="text-xs text-text-muted">
          {t("Pinta o documento inteiro: faixa do topo, títulos, tabelas e filetes. Vazio, o papel usa a cor da marca. Se a cor for clara demais para leitura, os textos saem num tom mais escuro dela.")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button asChild variant="outline">
          <a href="/api/v1/clinic/documentos/modelo" target="_blank" rel="noopener" data-baixar-modelo>
            {t("Baixar modelo do papel timbrado")}
          </a>
        </Button>
        <p className="text-xs text-text-muted">
          {t("Mostra o papel como ele sai em todo documento. O que estiver entre colchetes ainda falta em Configurações › Organização ou › Marca.")}
        </p>
      </div>
    </div>
  );
}
