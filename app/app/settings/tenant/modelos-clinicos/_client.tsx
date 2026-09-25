"use client";

/**
 * FORK clinic (prontuário F3) — Configurações › Modelos clínicos: duas abas,
 * os modelos (com o editor) e os requisitos de finalização.
 */
import { EditorDeRequisitos } from "@/components/clinic/modelos/EditorDeRequisitos";
import { ListaDeModelos } from "@/components/clinic/modelos/ListaDeModelos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/hooks/i18n/useT";

export function ModelosClinicosClient() {
  const t = useT();
  return (
    <Tabs defaultValue="modelos">
      <TabsList>
        <TabsTrigger value="modelos">{t("Modelos")}</TabsTrigger>
        <TabsTrigger value="requisitos" data-testid="aba-requisitos">
          {t("Requisitos para finalizar")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="modelos" className="mt-4">
        <ListaDeModelos />
      </TabsContent>
      <TabsContent value="requisitos" className="mt-4">
        <EditorDeRequisitos />
      </TabsContent>
    </Tabs>
  );
}
