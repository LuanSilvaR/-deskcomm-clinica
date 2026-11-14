/**
 * FORK clinic (8011) — o banco guarda telefone e CEP só com dígitos; a tela
 * mostra formatado. Quem salva normaliza de volta (`tenantSchema`), então o
 * formato aqui é só de exibição. O que não reconhece volta como está.
 */
export function formatarCep(cep: string | null | undefined): string | null {
  if (!cep) return cep ?? null;
  return /^\d{8}$/.test(cep) ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep;
}

export function formatarTelefone(tel: string | null | undefined): string | null {
  if (!tel) return tel ?? null;
  let d = tel;
  let ddi = "";
  if (/^\d{12,13}$/.test(d) && d.startsWith("55")) {
    ddi = "+55 ";
    d = d.slice(2);
  }
  if (/^\d{11}$/.test(d)) return `${ddi}(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (/^\d{10}$/.test(d)) return `${ddi}(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}
