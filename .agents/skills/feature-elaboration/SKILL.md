---
name: feature-elaboration
description: >-
  Use this skill whenever the user asks to elaborate, detail, plan, or design a feature
  (e.g., passing a feature scope, idea, or roadmap item). Produces a complete technical
  specification based on the provided scope and proactively suggests cohesive increments
  to enrich ("encorpar") the feature before implementation begins.
---

# Elaboração Técnica e Incremento de Features

Use este workflow sempre que o usuário pedir para elaborar, planejar ou detalhar uma feature a partir de um escopo inicial, descrição ou item de roadmap.

> **Regra de Ouro:** Durante a fase de elaboração, **não altere o código-fonte de produção** da aplicação. O objetivo desta skill é produzir o estudo técnico, validar viabilidade e alinhar os incrementos com o usuário antes de codar.

---

## Passo 1: Imersão no Escopo e Descoberta Técnica
Antes de escrever a especificação:
1. **Entenda o escopo base** passado pelo usuário (objetivo principal, regras de negócio e onde se encaixa no produto).
2. **Mapeie o código atual**:
   - Inspecione os componentes de UI, rotas, hooks, estado/cache e tabelas/migrations que serão tocados.
   - Identifique o que **já existe** no projeto e pode ser reaproveitado (colunas de banco já criadas, clientes de API, componentes visuais, utilitários).
3. **Valide integrações e limites técnicos**:
   - Se a feature envolver APIs externas ou bibliotecas novas, valide os campos reais retornados, limites de rate-limit, autenticação e impacto em custos (ex.: manter segurança dentro de planos *Free Tier*).

---

## Passo 2: Construção do Detalhamento Técnico (Artefato)
Gere um artefato Markdown dedicado (`feature_<nome_ou_numero>_spec.md`) contendo obrigatoriamente as seguintes seções:

### 1. Visão Geral e Escopo Base
- Resumo claro do problema resolvido e do comportamento esperado conforme solicitado pelo usuário.

### 2. Arquitetura e Fluxo de Dados
- Como os dados nascem, são buscados, processados e persistidos.
- Diagrama `mermaid` (`flowchart LR` ou `sequenceDiagram`) ilustrando o fluxo entre Front-end, Server/API, serviços externos e Banco de Dados.
- Estratégia de cache e carregamento (*lazy loading*, invalidação de cache, prevenção de *N+1 requests*).

### 3. Modelagem de Dados e Contratos (Backend / DB)
- **Banco de Dados**: Alterações de schema necessárias (novas tabelas, colunas, índices, políticas de acesso/RLS) e estratégia de retrocompatibilidade.
- **Contratos / Endpoints / Server Functions**: Assinatura de entrada (validação), saída tipada e tratamento de erros/fallbacks.

### 4. Especificação de UI/UX e Estados da Interface
- Onde e como as informações entram na tela/modal atual.
- Tratamento explícito dos 4 estados:
  1. **Loading** (Skeletons / spinners discretos sem travar a tela).
  2. **Sucesso** (Layout completo).
  3. **Parcial / Sem Dados** (Ex.: jogo ainda não lançado ou sem dados na API externa).
  4. **Erro** (Degradação graciosa sem quebrar a experiência principal).

### 5. Segurança, Performance e Custos
- Garantias de autenticação/autorização, sanitização de inputs e impacto de cota (subrequests, tempo de execução serverless, tamanho de payload).

### 6. Incrementos Sugeridos (Para "Encorpar" a Feature)
Proponha de **3 a 5 incrementos coesos** que elevem o nível da feature aproveitando o mesmo contexto técnico e de UI que já será mexido. Para cada incremento, apresente:
- **Nome e Descrição Prática**: O que ele adiciona na experiência do usuário.
- **Por que faz sentido junto**: Como ele aproveita os mesmos dados/componentes do escopo base.
- **Esforço Adicional**: `Baixo` (+15–30 min), `Médio` (+1–2h) ou `Alto`.
- **Recomendação**: Indicar se vale entrar já na **V1 (junto com a entrega principal)** ou ficar como **V2**.

### 7. Plano de Implementação (Passo a Passo)
- Sequência enxuta de etapas atômicas (Banco → Backend/API → UI → Testes/Build) para quando o usuário autorizar o desenvolvimento.

### 8. Pontos de Decisão para Aprovação
- Feche com perguntas diretas ao usuário:
  1. Quais dos **Incrementos Sugeridos** ele deseja incorporar no escopo final?
  2. Eventuais dúvidas de regra de negócio ou preferência visual.

---

## Passo 3: Apresentação ao Usuário
Após criar o artefato:
- Não repita todo o texto do artefato no chat.
- Apresente um resumo executivo curto, aponte o link para o artefato gerado e destaque os **Incrementos Sugeridos** e as **perguntas de decisão** para o usuário escolher o que entra antes de iniciar o código.
