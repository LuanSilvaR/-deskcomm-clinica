/**
 * FORK clinic (prontuário F2) — a fila de gravação do autosave, sem React.
 *
 * Regras (plano, seção 33/34):
 *   - UMA gravação em voo por seção; o que mudar enquanto ela voa vira a
 *     PRÓXIMA gravação (só a última versão do texto, nunca uma fila de todas);
 *   - cada gravação leva a `versao` que a tela conhece; o servidor devolve a nova;
 *   - conflito (outra aba/pessoa gravou antes) PARA a fila: nada é reenviado e
 *     nada é sobrescrito até a pessoa recarregar;
 *   - erro comum não perde o texto: a próxima edição (ou "tentar de novo") reenvia.
 */
export type EstadoDoAutosave =
  | { tipo: "ocioso" }
  | { tipo: "salvando" }
  | { tipo: "salvo"; em: Date }
  | { tipo: "erro" }
  | { tipo: "conflito" };

export type Gravar<T> = (valor: T, versao: number) => Promise<{ versao: number }>;

export class FilaDeGravacao<T> {
  private emVoo = false;
  private pendente: { valor: T } | null = null;
  private ultimoComErro: { valor: T } | null = null;
  private parado = false;

  constructor(
    private readonly gravar: Gravar<T>,
    public versao: number,
    private readonly avisar: (e: EstadoDoAutosave) => void,
    private readonly ehConflito: (erro: unknown) => boolean,
  ) {}

  get emConflito(): boolean {
    return this.parado;
  }

  async enviar(valor: T): Promise<void> {
    if (this.parado) return;
    if (this.emVoo) {
      this.pendente = { valor };
      return;
    }
    this.emVoo = true;
    this.avisar({ tipo: "salvando" });
    try {
      const r = await this.gravar(valor, this.versao);
      this.versao = r.versao;
      this.ultimoComErro = null;
      if (!this.pendente) this.avisar({ tipo: "salvo", em: new Date() });
    } catch (erro) {
      if (this.ehConflito(erro)) {
        this.parado = true;
        this.pendente = null;
        this.avisar({ tipo: "conflito" });
      } else {
        this.ultimoComErro = { valor };
        this.avisar({ tipo: "erro" });
      }
    } finally {
      this.emVoo = false;
    }
    const proximo = this.pendente;
    this.pendente = null;
    if (proximo && !this.parado) await this.enviar(proximo.valor);
  }

  /** "Tentar de novo" depois de um erro comum. */
  async tentarDeNovo(): Promise<void> {
    const alvo = this.ultimoComErro;
    if (alvo) await this.enviar(alvo.valor);
  }
}
