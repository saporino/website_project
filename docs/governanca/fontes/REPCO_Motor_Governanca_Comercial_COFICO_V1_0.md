# REPCO --- MOTOR DE GOVERNANÇA COMERCIAL COFICO

## Especificação funcional para Diretrizes Comerciais Dinâmicas

**Versão:** 1.0\
**Data-base:** Agosto/2026\
**Proprietário:** COFICO BRASIL LTDA\
**Classificação:** ADMIN ONLY

## 1. VISÃO

Transformar as Diretrizes Comerciais da COFICO em um **Motor de
Governança Comercial reutilizável** dentro do RepCo.

A governança COFICO deve ser a base permanente. Representadas, marcas,
categorias, produtos, SKUs, preços, embalagens, margens, prazos e regras
específicas devem ser **dados configuráveis e versionados**, não texto
fixo.

Fluxo: **COFICO Governança → Representada → Marca → Categoria →
Produto/SKU → Política → Geração controlada → PDF vigente →
Representantes**

O motor deve funcionar hoje para café e amanhã para açúcar, guaraná,
bebidas ou outros alimentos sem reconstruir as Diretrizes do zero.

## 2. TRÊS CAMADAS

### 2.1 CORE COFICO

Regras corporativas reutilizáveis: - governança e alçadas; -
confidencialidade; - disciplina comercial; - análise de crédito; -
processo de negociação e aprovação; - conduta e relação contratual do
representante; - uso do RepCo; - compromisso de entrega; - pós-venda; -
cultura comercial; - auditoria e versionamento; - matriz de decisão.

Não duplicar essas regras por fornecedor.

### 2.2 MÓDULOS CONFIGURÁVEIS

Podem variar por representada/categoria/canal: - pagamento e prazo; -
crédito específico; - pedido mínimo; - descontos/verbas/bonificações; -
degustação/promotoria; - devoluções/validade; - território; - frete; -
canais; - alçadas especiais; - preço; - mix; - marketing; - regras
fiscais/comerciais específicas.

### 2.3 DADOS VOLÁTEIS

Nunca devem exigir reescrever o documento: - representada/razão
social; - marcas/categorias; - produtos/SKUs; - descrição; -
peso/volume/unidade; - embalagem; - GTIN/EAN/DUN/NCM; -
preço/piso/referência; - composição técnica oficialmente aprovada; -
certificações; - vigência; - disponibilidade/status.

## 3. MULTIEMPRESA E MULTICATEGORIA

Criar seletor **Empresa / Representada**. Ao selecionar, carregar
cadastro, marcas, categorias, SKUs, tabela vigente, regras, exceções,
documentos, cobertura, logística aplicável e versão publicada.

Exemplo atual: **COFICO → Café Fazendinha Ltda. → Café → Tradicional /
Extra Forte / São Felipe / Horizon**

Exemplos futuros: **COFICO → Fornecedor X → Açúcar → Cristal /
Refinado** **COFICO → Fornecedor Y → Bebidas → Guaraná → 350 ml / 2 L**

Nunca presumir que todo produto é café, 500 g, fardo ou preço/kg.

## 4. HIERARQUIA DE REGRAS

Precedência: 1. obrigação legal/fiscal; 2. regra corporativa COFICO; 3.
contrato vigente com representada; 4. regra da representada; 5.
categoria; 6. marca; 7. SKU; 8. canal/cliente/rede; 9. exceção formal
aprovada e vigente.

Conflito deve bloquear publicação automática, mostrar
origem/versão/vigência das regras e pedir decisão humana.

## 5. CADASTROS MESTRES

### Representada

ID, razão social, nome fantasia, CNPJ, status, período da representação,
território, canais, contatos, contrato/documentos, marcas, categorias,
regras, última revisão.

### Marca

ID, representada, nome, status, categorias, identidade/documentos e
regras.

### Categoria

Modelo extensível: café, açúcar, bebida não alcoólica, alimento seco
etc. Cada categoria ativa atributos próprios.

### Produto/SKU

ID, representada, marca, categoria, nome, variante, descrição oficial,
unidade, peso líquido/bruto, dimensões, unidades por caixa/fardo,
GTIN/EAN, DUN, NCM, status, disponibilidade, documentos técnicos,
certificações e imagem oficial.

### Tabela comercial

Representada, SKU, canal/região, valor, tipo de preço, unidade do preço,
moeda, piso quando permitido, início/fim de vigência, status, aprovador,
timestamp, versão e justificativa. Nunca sobrescrever preço antigo;
manter histórico.

## 6. MOTOR DE DIRETRIZES

Montar documento por blocos estruturados, não um texto monolítico: capa,
escopo, portfólio, tabela, preço, mix, margem/markup, redes, crédito,
pagamento, degustação, reuniões, pós-venda, marketing, representantes,
matriz de decisão, frete, exercícios, consulta rápida e cultura.

Cada bloco: ID, título, template, proprietário, origem, escopo, status,
versão, vigência, dependências, aprovação, visibilidade e ordem.

## 7. TOKENS

Exemplos: `{{representada.nome}}`, `{{marca.nome}}`, `{{produto.nome}}`,
`{{produto.unidade_venda}}`, `{{preco.valor}}`, `{{preco.unidade}}`,
`{{preco.vigencia_inicio}}`, `{{politica.prazos}}`, `{{politica.mix}}`,
`{{cobertura.descricao}}`.

Validar tokens obrigatórios antes de publicar.

## 8. APLICABILIDADE

Cada regra deve declarar escopo: COFICO, representada, marca, categoria,
SKU, canal, cliente/rede, região ou combinação.

Regra não aplicável deve ser omitida; nunca inventada para preencher
capítulo.

## 9. GOVERNANÇA DE PREÇOS

Preço é dado versionado. Ao alterar: 1. criar versão; 2. definir
vigência; 3. manter histórico; 4. registrar responsável; 5. recalcular
exemplos; 6. detectar pisos/margens afetados; 7. marcar documentos
desatualizados; 8. sugerir nova publicação; 9. exigir aprovação
configurada; 10. auditar.

Mudar R\$19,00 para R\$19,50 não pode exigir reescrever a política.

## 10. EXEMPLOS DINÂMICOS

Exercícios numéricos devem buscar tabela vigente e calcular
automaticamente. Armazenar fórmula, unidade e dados usados. Mudou preço,
mudou exemplo. Testar fórmula antes da publicação.

## 11. MIX

Módulo configurável: ativo?, SKUs elegíveis, SKU âncora, proporções
permitidas/preferenciais, teto, piso, finalidade, restrições, aprovação
e vigência. Desativar para representadas sem mix.

## 12. CRÉDITO, PRAZO E ALÇADAS

Estruturar venda à vista/a prazo, prazos, parcelamentos, análise
obrigatória, limites, exceções, aprovadores e validade. PDF mostra só o
necessário ao representante; sensíveis ficam ADMIN ONLY.

## 13. LOGÍSTICA

Consumir o resultado do **Motor Logístico COFICO / COFICO Entregas**,
sem duplicar sua inteligência. Diretrizes mostram
área/procedimento/compromisso permitido. Nunca expor cobertura
interna/kg, reserva, receita interna, custo de veículo, margem ou
fórmulas confidenciais.

## 14. GERADOR DE DOCUMENTOS

Tela: 1. selecionar representada; 2. marca(s); 3. categoria(s); 4.
território/canal; 5. versão da política; 6. tabela vigente; 7. tipo:
Completa / Bolso / Atualização de tabela / Anexo; 8. prévia; 9.
validação; 10. aprovação; 11. gerar PDF; 12. publicar.

PDF: representada, escopo, versão, data, validade, ID da publicação,
confidencialidade, paginação, sumário, rodapé e identificador de versão.

## 15. QA PRÉ-PUBLICAÇÃO

Bloquear se houver token obrigatório vazio, produto sem unidade, preço
sem vigência/vencido, conflito, cálculo inconsistente, SKU inativo,
aprovação faltante, pendência técnica apresentada como fato, vazamento
ADMIN ONLY, paginação/sumário inválidos ou exemplo usando tabela errada.

Alertar sobre política perto do vencimento, documento técnico antigo,
mudança recente, regra sem revisão e lacuna de governança.

## 16. WORKFLOW

**Rascunho → Em revisão → Requer decisão → Aprovado → Publicado →
Substituído → Arquivado**

IA não publica mudança material sozinha. Preço, piso, crédito, prazo,
desconto, alçada, território, mix, exceção, obrigação contratual/fiscal,
promessa logística, devolução e mudança de risco podem exigir aprovação
humana.

## 17. DISTRIBUIÇÃO

Após aprovação: gerar PDF, registrar publicador/versão/data,
disponibilizar para WhatsApp, manter versão vigente e arquivar anterior.
Opcional: ciência do representante.

Nova versão deve informar qual substitui e a partir de quando.

## 18. DIRETRIZES X TABELA

Não republicar obrigatoriamente o manual inteiro quando só o preço
mudar. Suportar Diretrizes completas, tabela comercial vigente,
comunicado de alteração e versão de bolso. A governança pode manter
versão própria enquanto tabela possui versão/vigência independente.

## 19. GUARDIAN COFICO

Criar inteligência que **observa, detecta e recomenda**, sem alterar
política.

Analisar pedidos, propostas, perdas/motivos, descontos, exceções,
crédito, inadimplência, devoluções, logística, recompra, giro,
reclamações, CRM, reuniões, contratos e aprovações.

Detectar: - regra gerando muitas exceções; - preço perdendo
competitividade; - compressão de margem; - erro recorrente de
representante; - promessa não coberta; - nova exigência de rede; -
contradição/desatualização; - ausência de regra; - gargalo de
aprovação; - prazo problemático; - devolução/avaria; - logística
afetando fechamento; - baixa recompra; - necessidade de treinamento.

## 20. BENCHMARK DO MUNDO REAL

Permitir referência externa, separando claramente: **fato interno**,
**regra aprovada**, **obrigação contratual**, **obrigação
legal/fiscal**, **benchmark externo**, **recomendação IA**.

Benchmark nunca vira política automaticamente. Guardar fonte, data,
jurisdição, resumo, confiança e impacto. Mudança legal/fiscal exige
validação humana/profissional.

## 21. MELHORIA CONTÍNUA

**Acontecimento → Detecção → Evidência → Lacuna → Recomendação → Impacto
→ Aprovação humana → Ajuste → Versão → Publicação → Monitoramento**

IA nunca inventa política e a coloca em vigor sozinha.

## 22. DECISION LOG

Campos: ID, data, problema, evidências, política afetada, recomendação,
alternativas, impacto, decisão humana, aprovador, justificativa,
vigência, versão criada e revisão futura.

Evitar perder decisões em WhatsApp, reunião ou conversa com IA.

## 23. PAINEL DE LACUNAS

Lacuna, severidade, frequência, impacto, evidências, área, representada,
responsável, status, recomendação e decisão. Recorrência pode gerar
sugestão de revisão, nunca mudança automática.

## 24. VISIBILIDADE / RBAC

Representante: diretrizes, tabela autorizada, condições e aprovações.
Diretoria: políticas, pisos, alçadas, exceções, histórico,
recomendações. Financeiro/CFO: crédito, impacto e aprovações conforme
permissão. Operações: regras operacionais/entrega. Admin: motor,
permissões, templates e parâmetros.

Aplicar menor privilégio.

## 25. AUDITORIA

Registrar usuário, data/hora, valor anterior/novo, motivo, aprovação,
origem e versão. Documento publicado é imutável. Correção gera nova
versão.

## 26. SINGLE SOURCE OF TRUTH

Não duplicar preço em texto+tabela, crédito em módulos diferentes,
logística em dois motores, SKU em bases paralelas ou política em
documentos soltos. Gerador apenas consome fontes oficiais.

## 27. INTEGRAÇÃO REPCO

Reutilizar estruturas existentes de empresas, contatos, clientes,
produtos, CRM, pedidos, usuários, permissões, RepCo, COFICO Entregas,
auditoria e documentos. Auditar schema antes de criar tabela. Não criar
sistema paralelo.

## 28. P0

Antes de implementar: 1. mapear schema atual; 2. mapear
autenticação/RBAC; 3. identificar tabelas reutilizáveis; 4. localizar
empresas/produtos/pedidos/preços/documentos; 5. definir fonte oficial;
6. separar CORE COFICO de regras específicas; 7. estruturar
preços/produtos; 8. definir aprovação; 9. versionamento; 10. permissões;
11. integração COFICO Entregas; 12. gerador PDF + QA; 13. classificar
regras da V3.0 em corporativas vs Café Fazendinha; 14. nunca migrar
automaticamente regra de café para outra categoria.

## 29. MIGRAÇÃO DA V3.0

Usar **Diretrizes Comerciais COFICO --- Café Fazendinha Ltda. V3.0**
como primeiro caso real.

Classificar cada trecho: CORE COFICO, regra Fazendinha, regra da
categoria café, dado de produto, preço, exemplo calculado, treinamento,
logística, pendência externa, confidencial ou publicável.

A V3.0 atual é específica dos produtos Café Fazendinha; a generalização
deve ocorrer na arquitetura, preservando esse documento como caso
específico.

## 30. TESTE DE GENERALIZAÇÃO

Testar: - Café: SKUs, pacote, fardo, mix, degustação. - Açúcar:
saco/pacote/caixa, sem mix de café. - Guaraná/bebida:
unidade/caixa/fardo, volumes e regras próprias.

Critério: mudança de tipo de produto não deve exigir alteração de código
quando puder ser configuração/política.

## 31. CRITÉRIOS DE ACEITE

-   [ ] seletor de representada;
-   [ ] marcas/produtos/regras corretos;
-   [ ] nova categoria sem quebrar café;
-   [ ] preço muda sem editar capítulos;
-   [ ] histórico preservado;
-   [ ] exemplos recalculados;
-   [ ] regras não aplicáveis omitidas;
-   [ ] conflitos detectados;
-   [ ] aprovação humana;
-   [ ] zero vazamento ADMIN ONLY;
-   [ ] PDF versionado/vigente;
-   [ ] completa e bolso;
-   [ ] versão anterior arquivada;
-   [ ] versão vigente inequívoca;
-   [ ] Guardian detecta sem alterar;
-   [ ] decisões registradas;
-   [ ] COFICO Entregas permanece fonte logística;
-   [ ] café/açúcar/bebida funcionam;
-   [ ] sem duplicação injustificada.

## 32. ROADMAP

**F0 Auditoria → F1 Modelo de dados → F2 Policy Engine → F3 Migração
Fazendinha → F4 Gerador/QA/PDF → F5 Multiempresa/multicategoria → F6
Guardian → F7 Aprendizado operacional**

## 33. REGRA DE OURO

**A COFICO possui a governança. A representada fornece suas condições.
Os produtos fornecem seus dados. O RepCo resolve a política aplicável. A
IA identifica riscos e oportunidades. A pessoa autorizada decide. O
sistema versiona. O PDF comunica.**

O objetivo é construir a **memória institucional e o sistema operacional
da governança comercial da COFICO**.

## 34. INSTRUÇÃO À EQUIPE TÉCNICA / CLAUDE CODE

Antes de código: 1. auditar RepCo existente; 2. cruzar esta
especificação com schema/módulos; 3. apontar reuso; 4. conflitos; 5.
lacunas; 6. plano por fases; 7. migrations; 8. UI; 9. APIs/serviços; 10.
RBAC; 11. testes; 12. riscos; 13. decisões humanas; 14. aguardar
aprovação do plano.

**Não duplicar módulos. Não hardcodar Café Fazendinha. Não hardcodar
café, 500 g, fardo ou preços. Não permitir que IA publique política
material sem aprovação humana.**
