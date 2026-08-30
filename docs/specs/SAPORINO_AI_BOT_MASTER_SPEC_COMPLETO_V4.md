# SAPORINO AI.BOT MASTER SPEC COMPLETO — V4
## Centro de Inteligência Comercial, E-Commerce, Mercado, Produto, Consumidor e Agentes da Saporino

**Projeto:** Saporino Ai.Bot  
**Idioma obrigatório:** Português do Brasil  
**Local inicial:** Painel Administrativo da Saporino  
**Integrações estratégicas futuras:** RepCo, E-CoHub, Bling, Saporino Studio, marketplaces, site Saporino, CRM, WhatsApp Business, ferramentas de pesquisa, APIs e bases autorizadas  
**Objetivo:** criar uma máquina central de inteligência e automação comercial capaz de observar toda a operação, aprender com vendas, clientes, representantes, creators, concorrentes, e-commerce e consumidores, e transformar esses dados em decisões, recomendações e ações mensuráveis.

---

# 1. VISÃO PRINCIPAL

O Saporino Ai.Bot não será apenas um chatbot.

Ele será o:

# CENTRO DE COMANDO DE INTELIGÊNCIA DA SAPORINO

O sistema deverá conectar e interpretar informações provenientes de:

- vendas B2B;
- representantes comerciais;
- distribuidores;
- pedidos;
- clientes;
- regiões;
- produtos;
- e-commerce;
- marketplaces;
- site próprio;
- Bling;
- E-CoHub;
- RepCo;
- RepCo Studio;
- perfis sociais;
- concorrentes;
- creators;
- avaliações;
- comentários;
- campanhas;
- preços;
- estoque;
- recompra;
- margem;
- atendimento;
- pesquisas comerciais;
- documentos e conhecimento interno.

Objetivo final:

> **Transformar todos os sinais comerciais e de mercado da Saporino em conhecimento operacional, decisão, ação e aprendizado contínuo.**

---

# 2. PRINCÍPIO CENTRAL

## OBSERVAR → ENTENDER → EXPLICAR → TESTAR → AGIR → MEDIR → APRENDER

O Ai.Bot deve seguir o ciclo:

```text
DADOS
↓
OBSERVAÇÃO
↓
ANÁLISE
↓
HIPÓTESE
↓
RECOMENDAÇÃO
↓
AÇÃO
↓
RESULTADO
↓
APRENDIZADO
↓
MEMÓRIA DE MERCADO
```

Nunca transformar correlação em causalidade automaticamente.

---

# 3. REGRA DE EVIDÊNCIA

Todo insight importante deve ser classificado em:

## Nível 1 — Fato observado

Exemplo:

```text
O representante João vendeu 480 caixas no mês.
```

## Nível 2 — Interpretação

```text
João aparenta ter maior desempenho na região de Campinas.
```

## Nível 3 — Predição

```text
Se mantiver o ritmo atual, poderá vender X caixas no próximo mês.
```

## Nível 4 — Evidência causal

```text
A campanha X aumentou vendas em 18% após teste controlado.
```

O sistema deve mostrar essa diferença claramente.

---

# 4. REGRA DE IDIOMA

Toda a interface deve ser em:

# PORTUGUÊS DO BRASIL

Incluindo:

- menus;
- botões;
- dashboards;
- alertas;
- relatórios;
- respostas dos agentes;
- logs legíveis;
- status;
- mensagens;
- notificações;
- ajuda;
- configurações.

Código interno, APIs e enums podem permanecer em inglês quando tecnicamente necessário.

---

# 5. ARQUITETURA GERAL

```text
                           SAPORINO AI.BOT
                                 │
                        AGENTE EXECUTIVO
                                 │
         ┌───────────────────────┼────────────────────────┐
         │                       │                        │
   INTELIGÊNCIA COMERCIAL   INTELIGÊNCIA E-COMMERCE   INTELIGÊNCIA DE MERCADO
         │                       │                        │
      REPCO                  E-CoHub / Bling          Studio / Concorrentes
         │                       │                        │
         ├────────────┬──────────┼───────────┬────────────┤
         │            │          │           │            │
 REPRESENTANTES    CLIENTES   PRODUTOS    CREATORS    CONSUMIDORES
         │            │          │           │            │
         └────────────┴──────────┴───────────┴────────────┘
                                 │
                           MARKET MEMORY
                                 │
                         APRENDIZADO CONTÍNUO
```

---

# 6. CONEXÃO COM O REPCO

O RepCo será uma das principais fontes de inteligência do Ai.Bot.

O Ai.Bot deverá conseguir consultar, quando permitido:

- representantes comerciais;
- vendedores;
- clientes;
- leads;
- pedidos;
- produtos;
- regiões;
- cidades;
- estados;
- campanhas;
- histórico de contatos;
- oportunidades;
- CRM;
- recompra;
- resultados;
- Studio;
- análises sociais;
- inteligência de concorrência;
- Arqueologia Emocional;
- Market Memory.

O Ai.Bot não deve duplicar desnecessariamente funções do RepCo.

Ele deve atuar como:

> **camada de raciocínio, coordenação, comparação, explicação e ação sobre os dados do RepCo.**

---

# 7. INTELIGÊNCIA DE REPRESENTANTES COMERCIAIS

Criar módulo:

# Inteligência de Representantes

O Ai.Bot deverá analisar automaticamente cada representante.

Indicadores:

- faturamento;
- unidades;
- caixas;
- SKUs vendidos;
- clientes ativos;
- novos clientes;
- clientes recorrentes;
- ticket médio;
- margem;
- frequência de pedidos;
- mix;
- região;
- cidades;
- conversão;
- visitas ou contatos;
- oportunidades abertas;
- clientes perdidos;
- reativação;
- crescimento;
- queda;
- concentração de carteira.

Exemplo:

```text
REPRESENTANTE:
João Silva

Região:
Campinas

Vendas no mês:
R$ 128.420

Clientes ativos:
42

Novos clientes:
7

Produto mais vendido:
Saporino Clássico Tradicional 500g

Ticket médio:
R$ X

Crescimento vs. mês anterior:
+18%

Risco:
Alta concentração em 3 clientes
```

---

# 8. SCORE DE REPRESENTANTE

Criar score explicável.

Exemplo:

```text
Score Comercial:
91/100

Componentes:
Vendas: 95
Margem: 89
Novos clientes: 93
Recompra: 87
Mix: 85
Cobertura territorial: 92
CRM atualizado: 96
```

Nunca usar apenas faturamento como indicador de qualidade.

---

# 9. COACHING DE REPRESENTANTES

O Ai.Bot deverá atuar como treinador comercial.

Exemplo:

```text
João vende muito Saporino 500g,
mas quase não oferece SKU X.

Clientes semelhantes da região
compram ambos.

Sugestão:
trabalhar cross-sell em 17 contas.
```

Outro exemplo:

```text
Maria abriu muitos clientes,
mas recompra está abaixo da média.

Sugestão:
priorizar follow-up pós-primeiro pedido.
```

---

# 10. COMPARAÇÃO DE REPRESENTANTES

Permitir:

- ranking por venda;
- ranking por margem;
- ranking por novos clientes;
- ranking por recompra;
- ranking por crescimento;
- ranking por mix;
- ranking por retenção;
- ranking por território.

Evitar transformar ranking em punição automática.

Usar para diagnóstico e aprendizado.

---

# 11. INTELIGÊNCIA TERRITORIAL

Criar:

# Mapa Comercial

Analisar:

- estado;
- região;
- cidade;
- CEP;
- território;
- densidade de clientes;
- vendas;
- crescimento;
- margem;
- mix;
- cobertura;
- potencial;
- ausência de cobertura.

Exemplo:

```text
Campinas
Vendas: R$ X
Clientes: 38
Produto líder: Saporino 500g
Crescimento: +22%

Sorocaba
Vendas: R$ Y
Clientes: 19
Potencial: Alto
Cobertura atual: Baixa
```

---

# 12. VENDAS POR REGIÃO

O Ai.Bot deverá responder perguntas como:

> Qual região vende mais café?

> Qual cidade está crescendo mais?

> Onde temos pouca cobertura?

> Onde o Saporino 500g vende melhor?

> Onde determinado SKU quase não vende?

> Qual região possui maior ticket?

> Qual região gera maior margem?

---

# 13. VENDA NÃO É CONSUMO

Regra importante:

Se os dados disponíveis forem apenas pedidos ou sell-in, o sistema deve dizer:

> **Venda registrada**

e não:

> **Consumo real**

Só usar “consumo” quando houver evidência de sell-out ou dado de consumo.

---

# 14. INTELIGÊNCIA POR PRODUTO

Criar:

# Inteligência de Produtos

Para cada SKU:

- vendas;
- unidades;
- caixas;
- clientes;
- regiões;
- canais;
- margem;
- ticket;
- recompra;
- frequência;
- devoluções;
- avaliações;
- reclamações;
- sazonalidade;
- crescimento.

Perguntas:

> Qual café está vendendo mais?

> Qual café tem melhor margem?

> Qual café recompra mais?

> Qual café vende melhor em Minas?

> Qual SKU está acelerando?

> Qual SKU está perdendo força?

---

# 15. MATRIZ PRODUTO × REGIÃO

Criar análise:

```text
Produto × Estado
Produto × Cidade
Produto × Canal
Produto × Representante
Produto × Cliente
Produto × Período
```

Exemplo:

```text
Saporino 500g
Campinas: forte
Sorocaba: médio
Ribeirão Preto: forte
Bauru: baixo
```

---

# 16. MATRIZ REPRESENTANTE × PRODUTO

Exemplo:

```text
João
Saporino 500g: forte
SKU B: médio
SKU C: baixo

Maria
Saporino 500g: médio
SKU B: forte
SKU C: forte
```

Objetivo:

- descobrir especialização;
- detectar oportunidade de mix;
- descobrir boas práticas.

---

# 17. CONEXÃO COM O E-COHUB

O Ai.Bot deverá utilizar o E-CoHub para observar:

- Amazon;
- Mercado Livre;
- Shopee;
- TikTok Shop;
- site Saporino;
- pedidos;
- estoque;
- pricing;
- margem;
- logística;
- avaliações;
- devoluções;
- financeiro;
- exceções.

Fluxo:

```text
Marketplaces / Site
↓
Bling
↓
E-CoHub
↓
Saporino Ai.Bot
```

---

# 18. INTELIGÊNCIA DE E-COMMERCE

Criar:

# Agente de E-Commerce

Perguntas que deverá responder:

> Qual canal vende mais?

> Qual canal dá mais lucro?

> Qual produto lidera na Amazon?

> Qual SKU tem melhor conversão?

> Onde estamos perdendo margem?

> Qual marketplace cresceu mais?

> Qual listing está performando pior?

> Qual canal tem mais devolução?

---

# 19. NÃO CONFUNDIR GMV COM LUCRO

O Ai.Bot deverá separar:

```text
GMV
Receita bruta
Receita líquida
Comissão
Frete
Imposto
Mídia
CMV
Embalagem
Custo operacional
Margem
Lucro estimado
```

Exemplo:

```text
TikTok Shop vende mais.
Amazon gera maior margem.
Mercado Livre tem maior ticket.
```

---

# 20. POR QUE ESTÁ VENDENDO?

O Ai.Bot deverá tentar explicar performance usando evidências.

Variáveis possíveis:

- preço;
- promoção;
- frete;
- prazo;
- reviews;
- nota;
- posição;
- título;
- imagens;
- oferta;
- creator;
- campanha;
- tráfego;
- concorrência;
- disponibilidade;
- sazonalidade;
- bundle;
- cupom;
- conteúdo.

Nunca afirmar causalidade sem teste.

Exemplo correto:

> “As vendas aumentaram 24% após a mudança de preço. Isso é uma associação temporal; precisamos de teste ou controle para afirmar causalidade.”

---

# 21. MÁQUINA DE INTELIGÊNCIA REVERSA

Criar módulo:

# Inteligência Reversa

Objetivo:

Observar quem está vencendo no mercado e decompor os fatores possíveis.

Fluxo:

```text
CONCORRENTE / PRODUTO / CAMPANHA
↓
OBSERVAÇÃO
↓
COLETA DE EVIDÊNCIAS
↓
DECOMPOSIÇÃO
↓
HIPÓTESES
↓
O QUE PODEMOS APRENDER
↓
O QUE NÃO DEVEMOS COPIAR
↓
TESTE SAPORINO
↓
RESULTADO
```

---

# 22. REPco STUDIO COMO FONTE

O Ai.Bot deverá consultar o RepCo Studio quando disponível.

O Studio já poderá conter:

- perfis de Instagram;
- conteúdo de concorrentes;
- vídeos;
- legendas;
- frequência;
- formatos;
- hooks;
- CTAs;
- comentários;
- engajamento;
- campanhas;
- análise de criativos.

O Ai.Bot deverá transformar isso em inteligência integrada com vendas.

Exemplo:

```text
Concorrente aumentou Reels de humor
↓
engajamento aumentou
↓
comentários cresceram
↓
não sabemos se vendas cresceram
↓
hipótese:
testar conteúdo equivalente adaptado à Saporino
```

---

# 23. ANÁLISE DE CONCORRENTES

Criar entidade de concorrente com:

- marca;
- produto;
- preço;
- embalagem;
- peso;
- canal;
- promoções;
- conteúdo;
- frequência;
- seguidores;
- engajamento;
- reviews;
- nota;
- comentários;
- reclamações;
- pontos fortes;
- pontos fracos;
- tendências observadas;
- datas;
- fontes.

---

# 24. COMPETITOR PLAYBOOK

O Ai.Bot deverá gerar:

```text
O que o concorrente faz bem
O que o concorrente faz mal
O que está crescendo
O que está repetindo
Que objeções aparecem
Que reclamações aparecem
Que mensagens parecem funcionar
Que oportunidades estão abertas
```

Sem copiar identidade, marca ou propriedade intelectual.

---

# 25. VOZ DO CONSUMIDOR

Criar:

# Agente de Inteligência do Consumidor

Fontes:

- reviews;
- comentários;
- SAC;
- e-commerce;
- Instagram;
- TikTok;
- YouTube;
- marketplaces;
- site;
- pesquisas.

Categorias:

- aroma;
- sabor;
- intensidade;
- amargor;
- moagem;
- frescor;
- preço;
- embalagem;
- entrega;
- qualidade;
- preparo;
- recompra;
- nostalgia;
- ritual;
- família;
- praticidade;
- confiança;
- frustração.

---

# 26. ARQUEOLOGIA EMOCIONAL

Integrar ao RepCo.

O sistema poderá identificar padrões coletivos como:

- nostalgia;
- ritual;
- conforto;
- identidade;
- família;
- confiança;
- objeção;
- frustração;
- desejo;
- experiência sensorial.

Regra:

> Não tratar comentário como representação de todo o mercado.

---

# 27. MAPA DE REPRESENTATIVIDADE

Exibir:

- quantos comentários;
- de quais canais;
- período;
- região quando conhecida;
- perfil observado;
- segmentos ausentes;
- possíveis vieses.

Exemplo:

```text
Insight baseado em:
482 reviews
3 marketplaces
90 dias

Limitação:
não representa consumidores offline.
```

---

# 28. DETECÇÃO DE ERROS DO CONCORRENTE

O Ai.Bot deverá identificar padrões de reclamação.

Exemplo:

```text
Concorrente X
Reclamações recorrentes:
- embalagem
- atraso
- moagem
- sabor inconsistente
```

Depois:

```text
Oportunidade Saporino:
reforçar controle de embalagem
monitorar lote
não repetir problema
```

---

# 29. NÃO COPIAR ERROS

O sistema deverá criar:

# Biblioteca de Erros do Mercado

Campos:

- problema;
- marca;
- fonte;
- frequência;
- período;
- gravidade;
- impacto;
- oportunidade;
- prevenção Saporino;
- status.

---

# 30. BASE DE CONHECIMENTO DO CAFÉ

Criar módulo:

# Conhecimento → Café e Produtos

Permitir upload de:

- PDF;
- Word;
- Excel;
- CSV;
- fichas técnicas;
- laudos;
- certificados;
- apresentações;
- tabelas;
- materiais comerciais;
- fotos;
- FAQs;
- documentos de produto.

---

# 31. AGENTE ESPECIALISTA EM CAFÉ

O agente deverá conhecer profundamente:

- espécie;
- variedade;
- origem;
- altitude;
- processamento;
- torra;
- moagem;
- aroma;
- corpo;
- acidez;
- doçura;
- intensidade;
- preparo;
- conservação;
- embalagem;
- validade;
- público;
- posicionamento;
- diferenciais;
- margem;
- objeções;
- categoria;
- canais.

---

# 32. CONHECIMENTO OFICIAL VS APRENDIZADO

Separar:

## Conhecimento Oficial

Dados aprovados pela Saporino.

## Aprendizado Comercial

Padrões observados em vendas e mercado.

Nunca misturar os dois.

---

# 33. CLAIMS APROVADOS

Criar:

- claims permitidos;
- claims proibidos;
- claims pendentes;
- fonte;
- validade;
- responsável;
- data.

O agente só poderá fazer afirmações oficiais sobre Saporino usando claims aprovados.

---

# 34. FONTES E RASTREABILIDADE

Todo fato de produto deve guardar:

- fonte;
- arquivo;
- versão;
- data;
- aprovação;
- responsável;
- confiança.

---

# 35. EXTRAÇÃO DE DOCUMENTOS

Fluxo:

```text
Upload
↓
IA extrai
↓
IA organiza
↓
IA mostra fatos encontrados
↓
Usuário revisa
↓
Aprova
↓
Base oficial
```

Não publicar automaticamente informação extraída sem validação.

---

# 36. PLAYBOOK DE VENDAS DE CAFÉ

Criar biblioteca especializada em:

- supermercado;
- distribuidor;
- atacadista;
- padaria;
- empório;
- hotel;
- restaurante;
- food service;
- escritório;
- e-commerce.

Cada canal deve ter:

- dores;
- critérios de compra;
- objeções;
- argumentos;
- pedido inicial;
- mix;
- margem;
- frequência;
- follow-up;
- expansão.

---

# 37. SIMULADOR DE MARGEM DO CLIENTE

O Ai.Bot deverá conseguir demonstrar margem quando os dados forem reais.

Exemplo:

```text
Custo cliente: R$ X
Preço sugerido: R$ Y
Margem bruta estimada: Z%
```

Nunca inventar custo ou preço.

---

# 38. GIRO E COBERTURA

O agente deverá falar a linguagem comercial de:

- giro;
- estoque;
- cobertura;
- capital parado;
- ruptura;
- reposição;
- frequência;
- pedido inicial.

---

# 39. PEDIDO INICIAL INTELIGENTE

Sugerir primeiro pedido baseado em:

- tamanho;
- canal;
- número de lojas;
- perfil;
- histórico;
- região;
- risco;
- giro comparável.

Exemplo:

```text
Sugestão:
começar com teste controlado de X caixas.
```

---

# 40. MIX RECOMENDADO

Identificar:

- produto de entrada;
- produto de expansão;
- cross-sell;
- upsell;
- bundle;
- SKU por canal.

---

# 41. BIBLIOTECA DE OBJEÇÕES

Exemplos:

```text
“Já tenho fornecedor.”
“Está caro.”
“Não conheço a marca.”
“Não tenho espaço.”
“Só vendo marcas conhecidas.”
“Qual a margem?”
“Qual pedido mínimo?”
```

Cada objeção deve ter:

- resposta aprovada;
- provas;
- materiais;
- quando usar;
- taxa de sucesso;
- canal;
- segmento.

---

# 42. WIN / LOSS INTELLIGENCE

Depois de negócios ganhos ou perdidos:

```text
Motivo da vitória
Motivo da perda
Preço
Marca
Prazo
Logística
Produto
Relacionamento
Concorrente
Condição
```

Guardar aprendizado.

---

# 43. PROSPECÇÃO AUTÔNOMA

O usuário poderá pedir:

> Encontre 100 distribuidores de alimentos em São Paulo.

O Ai.Bot deverá:

```text
Planejar busca
↓
Pesquisar fontes autorizadas
↓
Encontrar empresas
↓
Visitar sites
↓
Extrair dados comerciais públicos
↓
Deduplicar
↓
Enriquecer
↓
Classificar
↓
Lead Score
↓
CRM
↓
Abordagem
```

---

# 44. FONTES DE PROSPECÇÃO

Possíveis fontes:

- web;
- Google;
- sites oficiais;
- diretórios;
- APIs;
- Google Business/Maps quando permitido;
- Apify;
- bases próprias;
- dados importados.

Não depender de uma única fonte.

---

# 45. MISSÕES DE PROSPECÇÃO

Criar tela:

# Missões Comerciais

Campos:

- objetivo;
- região;
- segmento;
- quantidade;
- score mínimo;
- custo máximo;
- tempo máximo;
- status;
- encontrados;
- qualificados;
- CRM;
- data.

---

# 46. RADAR COMERCIAL

Criar tela:

```text
Novas oportunidades hoje
Novas esta semana
Score 90–100
Score 80–89
Regiões em crescimento
Territórios sem cobertura
```

---

# 47. IMPORTAÇÃO DE LISTAS

Permitir:

- CSV;
- XLSX;
- XLS.

Fluxo:

```text
Upload
↓
Preview
↓
Mapeamento
↓
Validação
↓
Normalização
↓
Deduplicação
↓
Classificação
↓
Score
↓
Mensagem
↓
Aprovação
```

---

# 48. LEAD SCORE

Score 0–100.

Fatores:

- perfil;
- segmento;
- região;
- porte;
- presença comercial;
- compatibilidade;
- qualidade dos dados;
- histórico;
- comportamento;
- respostas;
- potencial.

Nunca usar atributos sensíveis.

---

# 49. CRM AUTOMÁTICO

Status:

```text
Novo
Em análise
Qualificado
Alta prioridade
Contato preparado
Contatado
Respondeu
Interessado
Lead quente
Negociação
Amostra enviada
Proposta enviada
Cliente
Sem interesse
Sem retorno
Opt-out
Descartado
```

---

# 50. MENSAGENS COMERCIAIS

Criar mensagens personalizadas por:

- segmento;
- região;
- objetivo;
- produto;
- histórico;
- estágio do funil.

Nunca inventar fatos sobre a empresa prospectada.

---

# 51. WHATSAPP

Preparar integração futura com canal empresarial oficial.

Não usar:

- automação de WhatsApp Web;
- disparo não autorizado;
- bypass;
- spam;
- números privados desnecessários.

Respeitar opt-out e políticas aplicáveis.

---

# 52. FOLLOW-UP

Motor configurável.

Exemplo:

```text
D0 mensagem inicial
D3 follow-up
D7 follow-up final
```

Se responder:

- parar sequência;
- classificar;
- atualizar CRM;
- gerar próxima ação.

---

# 53. CLASSIFICAÇÃO DE RESPOSTAS

Categorias:

- interessado;
- muito interessado;
- pedir tabela;
- pedir catálogo;
- pedir amostra;
- falar com comprador;
- sem interesse;
- já possui fornecedor;
- preço;
- número incorreto;
- opt-out;
- outro.

---

# 54. NEXT BEST ACTION

Para cada conta:

```text
Ação atual
Próxima ação
Motivo
Prazo
Confiança
Risco
```

---

# 55. DIGITAL SALES TWIN DA EMPRESA

Criar perfil comportamental comercial da conta.

Exemplo:

```text
Prefere WhatsApp
Responde pela manhã
Compra no fim do mês
Ciclo médio: 31 dias
Objeção principal: preço
Ticket médio: R$ X
Produto favorito: SKU Y
```

Somente com dados legítimos e necessários.

---

# 56. RECOMPRA

Criar:

# Agente de Recompra

Detectar:

- cliente atrasado;
- queda de volume;
- SKU abandonado;
- menor frequência;
- risco de churn.

---

# 57. EXPANSÃO DE CONTA

Identificar:

- aumento de volume;
- novos SKUs;
- mais lojas;
- novos canais;
- maior frequência.

---

# 58. SALES COACH

O Ai.Bot deverá sugerir como melhorar a abordagem de representantes e agentes.

Basear em:

- resultados;
- objeções;
- conversão;
- margem;
- recompra;
- mix;
- histórico.

---

# 59. META COMERCIAL

O usuário poderá dizer:

> Quero abrir 30 novos clientes B2B este mês.

O sistema deverá decompor:

```text
Meta
↓
Leads necessários
↓
Qualificados
↓
Contatos
↓
Respostas
↓
Reuniões
↓
Propostas
↓
Fechamentos
```

---

# 60. DIRETOR COMERCIAL IA

Criar agente:

# Diretor Comercial IA

Função:

- consolidar operação;
- criar plano;
- delegar tarefas;
- acompanhar meta;
- identificar risco;
- sugerir intervenção humana;
- aprender com resultados.

---

# 61. AGENTE EXECUTIVO

O Agente Executivo será o coordenador geral.

Pergunta:

> O que merece minha atenção hoje?

Resposta esperada:

```text
Vendas
Margem
Estoque
E-commerce
Representantes
Clientes
Creators
Mercado
Concorrentes
Alertas
Oportunidades
Aprovações
```

---

# 62. AGENTES ESPECIALIZADOS

Criar arquitetura para:

- Agente Executivo;
- Diretor Comercial IA;
- Agente Comercial;
- Agente de Representantes;
- Agente E-Commerce;
- Agente Fiscal de Exceções;
- Agente de Estoque;
- Agente de Creators;
- Agente de Inteligência de Mercado;
- Agente de Concorrência;
- Agente do Consumidor;
- Agente Especialista em Café;
- Agente de Marketing;
- Agente de Experimentos;
- Agente de Recompra;
- Agente Financeiro;
- Agente de Win/Loss.

---

# 63. EVITAR LOOPS DE AGENTES

Arquitetura preferida:

```text
Agente Executivo
↓
Fila de Tarefas
↓
Agente Especialista
↓
Resultado
↓
Banco
↓
Memória
```

Limites:

- passos;
- custo;
- tempo;
- tentativas;
- subagentes;
- retry.

---

# 64. NÍVEIS DE AUTONOMIA

```text
NÍVEL 0 — Monitorar
NÍVEL 1 — Recomendar
NÍVEL 2 — Aprovação obrigatória
NÍVEL 3 — Automação limitada
NÍVEL 4 — Automático
```

---

# 65. POLICY ENGINE

Toda ação deve passar por:

```text
AGENTE
↓
POLÍTICA
↓
PERMISSÃO
↓
LIMITE
↓
AÇÃO OU APROVAÇÃO
↓
AUDIT LOG
```

---

# 66. CENTRAL DE APROVAÇÕES

Campos:

- agente;
- ação;
- motivo;
- evidência;
- impacto;
- risco;
- custo;
- confiança;
- aprovar;
- rejeitar;
- editar.

---

# 67. MARKET MEMORY

Guardar:

- observação;
- interpretação;
- hipótese;
- ação;
- resultado;
- evidência;
- contexto;
- região;
- produto;
- canal;
- representante;
- período;
- aprendizado.

---

# 68. EXPERIMENT ENGINE

Todo insight acionável importante poderá virar teste.

Exemplo:

```text
Hipótese:
Promoção X aumenta conversão.

Teste:
A vs B

Métrica:
margem incremental

Resultado:
...

Conclusão:
...
```

---

# 69. MÉTRICAS DE E-COMMERCE

Medir:

- GMV;
- receita líquida;
- margem;
- pedidos;
- unidades;
- conversão;
- ticket;
- devolução;
- cancelamento;
- custo;
- CAC;
- recompra.

---

# 70. MÉTRICAS COMERCIAIS

Medir:

- leads;
- score;
- contatos;
- respostas;
- reuniões;
- propostas;
- vendas;
- margem;
- novos clientes;
- recompra;
- expansão;
- receita.

---

# 71. MÉTRICAS DE REPRESENTANTES

Medir:

- faturamento;
- margem;
- mix;
- clientes;
- novos clientes;
- retenção;
- recompra;
- território;
- crescimento;
- concentração;
- atividade.

---

# 72. MÉTRICAS DE MERCADO

Medir:

- preço concorrente;
- promoções;
- reviews;
- nota;
- conteúdo;
- frequência;
- engajamento;
- reclamações;
- tendências.

---

# 73. COST CENTER DOS AGENTES

Mostrar:

- execuções;
- tokens;
- custo de modelo;
- busca;
- Apify;
- APIs;
- custo por tarefa;
- custo por agente;
- custo diário;
- custo mensal.

---

# 74. DAILY BRIEF

Exemplo:

```text
Bom dia.

Vendas ontem:
R$ X

Margem:
X%

Melhor representante:
X

Região que mais cresceu:
Y

Produto líder:
Z

Canal e-commerce líder:
Mercado Livre

Maior oportunidade:
...

Maior risco:
...

Concorrente:
...

Clientes em risco:
...

Aguardando aprovação:
...
```

---

# 75. BASE DE CONHECIMENTO

Criar estrutura:

```text
Conhecimento
├── Produtos
├── Cafés
├── Fichas Técnicas
├── Claims
├── Objeções
├── Argumentos
├── FAQs
├── Materiais Comerciais
├── Concorrentes
├── Mercado
└── Documentos
```

---

# 76. CERTIFICADO A1

Quando necessário:

## PARAR.

Solicitar ao proprietário:

- `.pfx` ou `.p12`;
- senha;
- CNPJ correspondente.

O proprietário solicitará ao contador.

Nunca salvar segredo em Git, Markdown ou logs.

---

# 77. DADOS FISCAIS

Quando necessário:

## PARAR.

Solicitar validação do contador para:

- regime;
- IE;
- CNAE;
- NCM;
- CFOP;
- CST;
- CSOSN;
- ICMS;
- PIS;
- COFINS;
- CEST;
- natureza da operação;
- regras interestaduais.

Nunca inventar.

---

# 78. CD SAPORINO — VÁRZEA

Regra operacional:

> Toda mercadoria da operação e-commerce sai do CD Saporino em Várzea.

Não ativar fulfillment externo sem autorização explícita.

---

# 79. SEGURANÇA

Implementar:

- RBAC;
- tenant isolation;
- least privilege;
- audit log;
- secrets;
- criptografia;
- idempotência;
- timeout;
- retry;
- rollback;
- limites de custo;
- aprovação;
- proteção contra loops.

---

# 80. PRIVACIDADE E COMPLIANCE

Não criar:

- dossiês invasivos;
- inferência sensível desnecessária;
- coleta privada não autorizada;
- spam;
- bypass;
- scraping de áreas privadas;
- armazenamento de dados desnecessários.

Priorizar:

- dados empresariais;
- dados públicos permitidos;
- APIs oficiais;
- first-party data;
- finalidade legítima;
- minimização.

---

# 81. EVENTOS

Exemplos:

```text
NOVO_PEDIDO
NOVO_CLIENTE
CLIENTE_RECOMPROU
CLIENTE_EM_RISCO
VENDA_REGISTRADA
META_EM_RISCO
ESTOQUE_BAIXO
NF_E_REJEITADA
NOVO_REVIEW
CONCORRENTE_MUDOU_PRECO
CREATOR_ENCONTRADO
REPRESENTANTE_CAIU_PERFORMANCE
REGIAO_ACELEROU
SKU_ACELEROU
```

---

# 82. FUNCIONAMENTO 24/7

A operação final deve rodar em cloud.

Não depender de:

- notebook;
- navegador;
- Cowork aberto;
- sessão local.

Usar:

- APIs;
- webhooks;
- jobs;
- queues;
- workers;
- scheduler;
- cron;
- banco persistente.

---

# 83. PAPEL DO CLAUDE / COWORK

Claude/Cowork deverá:

- auditar;
- projetar;
- construir;
- testar;
- documentar;
- criar integrações;
- criar agentes;
- revisar;
- melhorar.

Não será o único runtime da operação.

---

# 84. FASE 0 — AUDITORIA OBRIGATÓRIA

Antes de programar:

Analisar:

- painel Saporino;
- RepCo;
- RepCo Studio;
- E-CoHub;
- Saporino Studio;
- banco;
- Supabase;
- autenticação;
- CRM;
- pedidos;
- representantes;
- produtos;
- APIs;
- MCPs;
- jobs;
- scheduler;
- webhooks;
- deployment;
- logs;
- testes.

Criar:

```text
docs/saporino-ai-bot/CURRENT_STATE_AUDIT.md
```

---

# 85. FASE 1 — FUNDAÇÃO

Criar:

- aba Saporino Ai.Bot;
- Visão Geral;
- Chat;
- Agentes;
- Ações;
- Aprovações;
- Atividades;
- Oportunidades;
- Alertas;
- Memória;
- Desempenho;
- Custos;
- Conhecimento;
- Inteligência Comercial;
- Inteligência E-Commerce;
- Inteligência de Mercado;
- Representantes;
- Produtos;
- Regiões;
- Configurações.

Tudo inicialmente com mocks ou leitura segura.

---

# 86. FASE 2 — CONEXÃO REPCO

Conectar leitura de:

- CRM;
- representantes;
- pedidos;
- clientes;
- produtos;
- regiões;
- campanhas;
- Studio;
- Market Memory.

Sem ações destrutivas.

---

# 87. FASE 3 — REPRESENTANTES E TERRITÓRIO

Criar:

- dashboards;
- score;
- coaching;
- produto × representante;
- região × representante;
- clientes;
- recompra;
- expansão.

---

# 88. FASE 4 — E-COMMERCE

Conectar progressivamente:

- E-CoHub;
- Bling;
- marketplaces;
- site.

---

# 89. FASE 5 — CONCORRÊNCIA E STUDIO

Integrar:

- RepCo Studio;
- perfis;
- conteúdo;
- comentários;
- tendências;
- competitor intelligence.

---

# 90. FASE 6 — VOZ DO CONSUMIDOR

Integrar:

- reviews;
- comentários;
- SAC;
- Arqueologia Emocional.

---

# 91. FASE 7 — ESPECIALISTA EM CAFÉ

Criar:

- base de conhecimento;
- uploads;
- extração;
- claims;
- playbooks;
- objeções;
- treinamento.

---

# 92. FASE 8 — PROSPECÇÃO

Criar:

- missões;
- radar comercial;
- importação;
- busca;
- score;
- CRM;
- mensagens;
- aprovação.

---

# 93. FASE 9 — AUTOMAÇÃO EXTERNA

Somente após validação:

- WhatsApp;
- e-mail;
- follow-up;
- ações aprovadas.

---

# 94. FASE 10 — APRENDIZADO CONTÍNUO

Ativar:

- Market Memory;
- Experiment Engine;
- win/loss;
- otimização;
- predição.

---

# 95. MODELO DE DADOS SUGERIDO

Adaptar à arquitetura existente.

```text
ai_agents
ai_agent_runs
ai_agent_tasks
ai_agent_events
ai_agent_actions
ai_agent_approvals
ai_agent_memories
ai_agent_costs
ai_agent_metrics
ai_agent_alerts
ai_agent_policies
ai_knowledge_documents
ai_knowledge_facts
ai_product_claims
ai_sales_playbooks
ai_objections
ai_representative_metrics
ai_region_metrics
ai_product_region_metrics
ai_ecommerce_metrics
ai_competitor_snapshots
ai_consumer_insights
ai_market_hypotheses
ai_experiments
ai_win_loss
ai_lead_missions
ai_lead_scores
ai_sales_twins
```

Todas as entidades devem considerar `tenant_id` quando aplicável.

---

# 96. DESIGN DO PAINEL

Interface:

- moderna;
- executiva;
- limpa;
- clara;
- rápida;
- responsiva;
- em Português do Brasil.

Usar:

- cards;
- tabelas;
- gráficos;
- mapas;
- timelines;
- filtros;
- badges;
- alertas;
- drill-down;
- chat.

---

# 97. VISÃO DA HOME

```text
SAPORINO AI.BOT
Centro de Inteligência

Hoje:

Vendas B2B             R$ X
Vendas E-Commerce      R$ Y
Margem                 X%
Novos clientes         X
Clientes em risco      X
Melhor região          X
Produto líder          X
Representante líder    X
Oportunidades          X
Alertas                 X
Aprovações              X
```

---

# 98. PERGUNTAS QUE O AI.BOT DEVE RESPONDER

Exemplos:

> Quem vendeu mais este mês?

> Qual representante mais cresceu?

> Qual região está vendendo mais?

> Qual café vende melhor em cada região?

> Qual produto tem melhor margem?

> Qual marketplace gera mais lucro?

> Quem compra mais Saporino 500g?

> Quais clientes estão diminuindo pedidos?

> Qual representante precisa de ajuda?

> Que região está subatendida?

> O que os concorrentes estão fazendo diferente?

> Quais reclamações aparecem com frequência nos concorrentes?

> Quais erros do mercado devemos evitar?

> O que nossos clientes mais elogiam?

> O que nossos clientes mais reclamam?

> Qual campanha parece ter contribuído para crescimento?

> Qual hipótese devemos testar?

> O que merece minha atenção hoje?

---

# 99. REGRA DE NÃO INVENTAR

Quando faltar dado:

> **“Não tenho dados suficientes para concluir.”**

Nunca preencher lacunas com suposição apresentada como fato.

---

# 100. PRIMEIRA RESPOSTA DO CLAUDE

Antes de qualquer alteração, responder:

1. O que entendeu sobre o Saporino Ai.Bot.
2. Como ele deve se conectar ao RepCo.
3. Como deve usar o RepCo Studio.
4. Como deve se conectar ao E-CoHub.
5. Como deve se conectar ao Bling.
6. Como analisará representantes.
7. Como analisará regiões.
8. Como analisará produtos.
9. Como analisará e-commerce.
10. Como fará inteligência reversa de concorrentes.
11. Como integrará comentários e reviews.
12. Como funcionará a Base de Conhecimento do Café.
13. Como funcionará Market Memory.
14. Como evitará confundir correlação com causalidade.
15. Como implementará permissões.
16. Como controlará custo.
17. O que já existe e pode ser reaproveitado.
18. O que precisa ser criado.
19. Principais riscos.
20. Roadmap recomendado.
21. Confirmação de que toda interface será em Português do Brasil.
22. Confirmação de que nenhuma integração destrutiva ou envio externo será ativado nesta primeira fase.

Depois da auditoria, se não houver bloqueadores:

# INICIAR SOMENTE A FASE 1 — FUNDAÇÃO

---

# 101. REGRA FINAL

Use este documento como especificação mestre do Saporino Ai.Bot.

O objetivo não é construir apenas um agente que conversa.

O objetivo é construir uma:

# MÁQUINA DE INTELIGÊNCIA COMERCIAL E DE MERCADO

capaz de:

```text
observar
↓
comparar
↓
explicar
↓
aprender
↓
recomendar
↓
agir com autorização
↓
medir
↓
melhorar continuamente
```

O Ai.Bot deverá conectar vendas B2B, representantes, clientes, produtos, regiões, e-commerce, concorrentes, Studio, comentários, reviews, creators e conhecimento de café em uma única camada de inteligência operacional.

A Saporino será o primeiro ambiente de uso.

A arquitetura deve ser modular o suficiente para que, futuramente, essa inteligência possa ser reaproveitada e oferecida dentro do RepCo SaaS.
---

# 102. ATUALIZAÇÃO ESTRATÉGICA — CASA COFICO, INTELIGÊNCIA REVERSA E EXPERIÊNCIA DO CLIENTE

Esta seção complementa a especificação mestre do Saporino Ai.Bot.

# 103. CASA COFICO

O Ai.Bot deverá reconhecer **CASA COFICO** como identidade comercial planejada para as lojas online da COFICO no TikTok Shop Brasil, Mercado Livre Brasil, Shopee Brasil e Amazon Brasil.

A Casa Cofico poderá vender Saporino, Café Fazendinha e outras marcas autorizadas.

Sempre separar:

```text
LOJA = Casa Cofico
MARCA = Saporino / Fazendinha / outra
PRODUTO = SKU específico
```

# 104. VISÃO ÚNICA DO NEGÓCIO

O Ai.Bot deverá enxergar, com permissões adequadas, vendas B2B, representantes, CRM, pedidos, clientes, estoque, produtos, regiões, Casa Cofico, marketplaces, site, E-CoHub, Bling, RepCo, RepCo Studio, Saporino Studio, creators, comentários, reviews, atendimento, devoluções, reembolsos, margem e campanhas.

Objetivo: analisar o negócio como um único organismo.

# 105. CONSUMER INTEL CONTÍNUO

Criar fluxo contínuo:

```text
COLETA
↓
CLASSIFICAÇÃO
↓
AGRUPAMENTO
↓
PADRÕES
↓
RISCO / OPORTUNIDADE
↓
AÇÃO
↓
RESULTADO
↓
MEMÓRIA
```

Fontes: reviews próprios e de concorrentes, comentários sociais, marketplaces, Instagram, TikTok, YouTube, SAC, pós-compra, pesquisas e RepCo Studio.

# 106. MÁQUINA DE INTELIGÊNCIA REVERSA

Criar **Reverse Commerce Intelligence** para decompor produtos, lojas e campanhas que performam bem.

Analisar preço, desconto, frete, bundle, variações, prova social, reviews, UGC, creators, afiliados, narrativa, título, descrição, imagens, vídeos, CTA, frequência, oferta, canal, ranking, volume vendido, reclamações, pontos de fricção e pós-venda.

# 107. MECÂNICAS QUE PODEM SER TESTADAS

O Ai.Bot deverá reconhecer e testar, quando fizer sentido:

- estratégia de preço por canal
- frete grátis
- kits 1/2/3 unidades
- prova social real
- narrativa emocional
- afiliados
- múltiplos SKUs ocupando busca
- UGC
- creators de nicho
- live commerce

Nunca copiar identidade, texto, criativo, embalagem, marca ou claims do concorrente.

Nunca replicar desconto fictício, preço âncora enganoso, criativo que sugere formato diferente do produto real ou origem inconsistente.

# 108. PRODUCT TRUTH ENGINE

Antes da publicação, conferir:

```text
O criativo mostra grãos?
O SKU é em grãos?

O texto fala moagem?
Está aprovado?

O texto fala origem?
Existe fonte?

O vídeo promete característica?
Está na base oficial?
```

Se houver inconsistência, bloquear publicação.

# 109. AGENTE DE PUBLICAÇÃO COMERCIAL

Quando houver intenção de vender produto, montar estratégia completa:

```text
Produto
↓
Canal
↓
Público
↓
Objetivo
↓
Oferta
↓
Hook
↓
Narrativa
↓
Prova
↓
CTA
↓
Criativo
↓
Legenda
↓
Comentário fixado
↓
Respostas
↓
Métrica
```

# 110. PLAYBOOK DE POSTAGEM

Para cada publicação comercial gerar objetivo, público, estágio do funil, hook, roteiro, descrição, CTA, hashtags quando relevantes, comentário fixado, perguntas esperadas, respostas aprovadas, risco de claims, métrica de sucesso e hipótese testada.

# 111. NARRATIVA DE ORIGEM

Usar apenas fatos aprovados na Base de Conhecimento. Narrativa emocional sem transformar ficção em origem factual.

# 112. ESTRATÉGIA DE CONTEÚDO PARA COMMERCE

Criar matrizes de conteúdo de descoberta, prova, produto, comparação, uso, origem, review, creator, oferta e recompra.

Aprender quais formatos geram views, clique, add-to-cart, compra, margem e recompra.

# 113. CREATOR COMMERCE INTELLIGENCE

Analisar creator, vídeos, hooks, views, comentários, produtos promovidos, histórico de venda quando disponível, afinidade, brand safety, comissão, ticket, GMV próprio, recompra e CAC.

Não escolher creator somente por seguidores.

# 114. AFILIADOS

Preparar:

```text
Descoberta
↓
Score
↓
Convite
↓
Amostra
↓
Conteúdo
↓
Venda
↓
Comissão
↓
Recompra
↓
Creator Memory
```

# 115. COMENTÁRIOS COMO CANAL DE VENDA E INTELIGÊNCIA

Classificar elogio, dúvida, intenção de compra, objeção, reclamação, comparação, suporte, preparo, preço, entrega e disponibilidade.

# 116. AGENTE DE RELACIONAMENTO DIGITAL

Atuação futura em TikTok, Instagram, reviews, marketplaces e site.

Respostas devem variar por marca, produto, canal, contexto e histórico, evitando respostas robóticas.

# 117. FEEDBACK POSITIVO

Quando permitido pela plataforma e política, feedback 5 estrelas simples poderá receber resposta automática aprovada.

# 118. FEEDBACK NEGATIVO

Fluxo obrigatório:

```text
Feedback negativo
↓
classificar
↓
localizar pedido
↓
identificar produto
↓
identificar lote
↓
identificar causa provável
↓
verificar política
↓
criar solução
↓
executar ação autorizada
↓
responder
```

Nunca mandar o cliente de volta para um SAC que já falhou.

# 119. CUSTOMER PROTECTION AGENT

Monitorar atraso, ausência de tracking, pedido parado, reclamação sem resposta, reembolso pendente, pedido incompleto, dano, problema de embalagem, possível defeito de lote e palavras críticas.

# 120. PALAVRAS DE RISCO

Classificar como alto risco termos como:

```text
golpe
fraude
ninguém responde
Procon
processo
não chegou
quero meu dinheiro
mofado
estragado
aberto
faltando
```

# 121. CUSTOMER FRUSTRATION SCORE

Calcular risco de escalada e priorizar casos críticos.

# 122. ZERO RECLAMAÇÃO

Criar dashboard com entregues no prazo, pedidos atrasados, pedidos sem tracking, mensagens acima do SLA, reembolsos pendentes, reclamações de embalagem/sabor, lotes em observação, clientes críticos, reviews negativos e taxa de resolução.

# 123. BIBLIOTECA DE ERROS DO MERCADO

Campos: concorrente, problema, canal, frequência, gravidade, evidência, data, risco para Casa Cofico, prevenção, responsável interno, status e resultado da prevenção.

# 124. NÃO COPIAR O CONCORRENTE — COPIAR A MECÂNICA BOA

Separar MECÂNICA da EXECUÇÃO ESPECÍFICA.

Exemplo:

```text
Mecânica: bundle de 3 unidades → pode testar
Copiar imagem/texto do concorrente → não permitido
```

# 125. ESTRATÉGIA DE CANAL

Comparar TikTok Shop, Mercado Livre, Shopee, Amazon e site e sugerir papéis diferentes: aquisição, margem, recompra, descoberta, bundle e creator commerce.

# 126. RANKING DE OPORTUNIDADES

Criar score de Impacto, Confiança, Custo, Esforço, Risco e Prioridade.

# 127. EXPERIMENTOS DE COMMERCE

Transformar frete grátis, kit 2, kit 3, creator, hook, narrativa de origem, imagem, descrição, cupom, live, preço e pós-compra em testes mensuráveis.

Métrica prioritária: margem incremental e recompra, não apenas views.

# 128. CONEXÃO COM REPCO STUDIO

Cruzar conteúdo concorrente + engajamento + comentários + oferta + marketplace + vendas observáveis + reviews.

Objetivo: gerar hipóteses testáveis.

# 129. CONEXÃO COM VENDAS OFFLINE

Cruzar comércio digital com representantes.

Exemplo:

```text
Produto acelera no TikTok em região X
↓
clientes B2B da mesma região
↓
representantes locais
↓
oportunidade de sell-in
```

# 130. FEEDBACK LOOP COMPLETO

```text
Conteúdo
↓
Clique
↓
Venda
↓
Entrega
↓
Review
↓
Recompra
↓
Comentário
↓
Ai.Bot
↓
Aprendizado
↓
Próxima campanha
```

# 131. CHECKLIST OBRIGATÓRIO PARA CLAUDE

Claude deverá criar checklist mestre separado em Arquitetura, Banco, RepCo, RepCo Studio, E-CoHub, Bling, Casa Cofico, Produtos, Estoque, Commerce Intelligence, Consumer Intelligence, Reviews, Social, Creators, Publicações, Atendimento, Reputação, Experimentos, Segurança, Custos, Testes, Observabilidade e Go-live.

Cada item: ID, descrição, dependência, prioridade, status, responsável, risco, teste, critério de aceite e evidência de conclusão.

Não marcar tarefa concluída sem evidência.

# 132. ORDEM DE EXECUÇÃO

1. ler toda documentação existente
2. auditar sistema
3. mapear o que já existe
4. não duplicar módulos
5. desenhar integrações
6. criar checklist
7. priorizar fundação
8. implementar por fases
9. testar cada fase
10. documentar
11. apresentar próximo bloco
12. aguardar aprovação em mudanças críticas

# 133. REGRA DE MELHORIA CONTÍNUA

Quando surgir nova ideia:

```text
NOVA IDEIA
↓
classificar
↓
verificar se já existe
↓
identificar módulo afetado
↓
avaliar dependências
↓
registrar backlog
↓
priorizar
↓
implementar
↓
medir
↓
incorporar aprendizado
```

# 134. META

A meta não é copiar quem vende muito.

A meta é entender por que vende, replicar apenas mecânicas legítimas, eliminar defeitos observados no mercado e construir experiência superior de produto, compra, entrega, atendimento e recompra.

O Ai.Bot deverá otimizar para crescimento, margem, reputação, recompra, satisfação, eficiência e aprendizado contínuo.


---

# 135. SALES SWARM — REDE DE FORMIGUINHAS DIGITAIS

Objetivo: o Saporino Ai.Bot deverá ajudar a Casa Cofico a construir, aprender e otimizar uma rede extensa de creators, afiliados, live sellers e sellers de marketplace capazes de vender café continuamente.

A prioridade não é encontrar somente celebridades. É encontrar muitas pessoas com capacidade real de venda.

## 135.1 Radar de parceiros

O Ai.Bot deverá pesquisar continuamente, sob demanda ou por missão aprovada:

- creators que vendem café;
- creators que promovem concorrentes;
- creators de achadinhos;
- creators de alimentação;
- creators de lifestyle;
- especialistas em café;
- reviewers;
- live sellers;
- afiliados;
- sellers de marketplace;
- perfis que demonstrem intenção comercial nos comentários.

## 135.2 Cobertura de concorrentes

A busca não pode ficar limitada ao Varanda de Vó.

O radar deverá poder receber missões como:

> Encontre creators e sellers que estejam promovendo café no Brasil, incluindo Saporino, Fazendinha e marcas concorrentes relevantes.

ou:

> Encontre 200 perfis que já venderam ou divulgaram café nos últimos 90 dias.

## 135.3 Coffee Seller Graph

Criar grafo:

```text
CREATOR
  ↓ promove
PRODUTO
  ↓ pertence
MARCA
  ↓ vendido por
SELLER
  ↓ opera em
PLATAFORMA
```

Isso permitirá descobrir quais creators trabalham com quais marcas, produtos e sellers.

## 135.4 Creator Score e Sales Creator Score

Criar dois scores diferentes.

### Creator Score
Avalia qualidade de conteúdo, afinidade, consistência, brand safety e audiência.

### Sales Creator Score
Avalia sinais de capacidade comercial, como:

- histórico promovendo produtos;
- experiência com café;
- conteúdo com intenção de compra;
- volume observável;
- frequência;
- qualidade de CTA;
- live commerce;
- conversão quando houver dado first-party;
- margem e recompra geradas quando parceiro da Casa Cofico.

O score deve ser explicável.

## 135.5 Por que este perfil foi encontrado?

Toda ficha deve apresentar explicação em linguagem natural.

Exemplo:

> Este perfil foi encontrado porque publicou quatro vídeos sobre café, utiliza TikTok Shop, já promoveu duas marcas concorrentes e os comentários apresentam perguntas de preço e compra.

## 135.6 Perfil antes do contato

Regra obrigatória:

```text
ENCONTRADO
↓
PERFIL COMPLETO
↓
LINK ORIGINAL
↓
CONTEÚDOS RELACIONADOS
↓
PRODUTOS/MARCAS VENDIDOS
↓
SCORE + JUSTIFICATIVA
↓
APROVAÇÃO HUMANA
↓
CONTATO
```

O Ai.Bot nunca deve iniciar contato automaticamente com perfil ainda não revisado, salvo política explicitamente aprovada no futuro.

## 135.7 Estratégia de abordagem personalizada

Após aprovação, o Ai.Bot deverá preparar abordagem baseada no perfil real do parceiro.

Considerar:

- plataforma;
- nicho;
- produtos promovidos;
- marcas concorrentes;
- estilo de conteúdo;
- ticket típico;
- comissão aparente quando pública;
- tipo de audiência;
- potencial para Saporino;
- potencial para Fazendinha.

Evitar mensagens genéricas em massa.

## 135.8 Oferta ao parceiro

O Ai.Bot deverá sugerir pacote comercial, sujeito a política e aprovação:

- produto ideal;
- kit ideal;
- comissão;
- amostra;
- cupom;
- link oficial;
- briefing de conteúdo;
- diferenciais do produto;
- claims autorizados;
- argumentos de venda;
- CTA;
- prazo da campanha.

## 135.9 Playbook para vender melhor

O objetivo é ajudar o parceiro a vender melhor do que já vende, sem enganar o consumidor.

Fornecer:

- hooks testáveis;
- roteiros;
- objeções;
- comparação de formatos;
- FAQs;
- demonstração correta do produto;
- como explicar moagem;
- como explicar origem;
- como falar de sabor;
- como criar prova social legítima;
- como usar bundle;
- como fazer live;
- como responder comentários.

## 135.10 Afiliados oficiais vs programa próprio

O Ai.Bot deverá entender que existem dois mundos:

### Programa oficial da plataforma
Atribuição/comissão/pagamento seguem a plataforma.

### Programa próprio Casa Cofico
Atribuição e comissão podem ser gerenciadas pelo E-CoHub/site quando houver infraestrutura e regra fiscal aprovadas.

O Ai.Bot jamais deve assumir quem paga uma comissão sem consultar a integração/documentação da plataforma.

## 135.11 Commission Optimizer

Criar motor para sugerir comissão ideal com base em:

- margem do SKU;
- comissão da plataforma;
- frete/subsídio;
- preço;
- creator commission;
- CAC;
- ticket;
- taxa de cancelamento;
- recompra;
- margem incremental.

Nunca sugerir comissão que torne a operação estruturalmente negativa sem deixar o alerta explícito.

## 135.12 Partner P&L

Cada parceiro deve ter P&L simplificado:

```text
Receita atribuída
- custo do produto
- taxa da plataforma
- frete/subsídio
- comissão do parceiro
- devoluções/cancelamentos
= margem de contribuição
```

## 135.13 Partner Memory

Guardar histórico:

- convite;
- resposta;
- comissão acordada;
- amostras;
- campanhas;
- vídeos;
- vendas;
- margem;
- reviews;
- recompra;
- problemas;
- aprendizados.

## 135.14 Detecção de migração de creators

O radar deverá conseguir detectar mudanças como:

> Creator antes promovia Marca A e passou a promover Marca B.

Isso vira sinal de mercado e pode gerar investigação.

## 135.15 Long Tail Creator Strategy

Priorizar também micro e nano creators.

O sistema deverá avaliar se dezenas ou centenas de parceiros pequenos geram mais vendas incrementais do que poucos perfis grandes.

## 135.16 Missões de recrutamento

Exemplos:

> Encontre 50 creators de café para TikTok Shop.

> Encontre 100 sellers de café no Mercado Livre e Shopee.

> Encontre creators que vendem produtos de alimentação e já trabalham com afiliados.

> Encontre creators que falam de café mas ainda não promovem nenhuma marca.

## 135.17 Funnel de parceiros

```text
Descobertos
↓
Qualificados
↓
Aprovados
↓
Convidados
↓
Aceitaram
↓
Receberam amostra
↓
Publicaram
↓
Geraram venda
↓
Geraram recompra
↓
Parceiros Elite
```

## 135.18 KPIs da rede

- parceiros descobertos;
- aprovados;
- taxa de aceite;
- ativos;
- parceiros que venderam;
- vendas por parceiro;
- margem por parceiro;
- creators novos por semana;
- GMV atribuído;
- CAC;
- comissão média;
- ROI;
- recompra dos clientes originados;
- concentração de vendas;
- churn de parceiros.

## 135.19 Ajuda integrada do Ai.Bot

Em qualquer tela relacionada a creators, sellers, comissões ou afiliados, incluir opção **? Ajuda** e **Perguntar ao Ai.Bot**.

Exemplos:

- "O que significa comissão atribuída?"
- "Quem paga este afiliado?"
- "Como aprovo este creator?"
- "Por que este perfil recebeu score 82?"
- "Como faço o primeiro convite?"
- "Qual produto devo oferecer para ele?"

As respostas devem usar o estado real do sistema e documentação vigente.

## 135.20 Modo tutor

Criar onboarding guiado para o usuário aprender usando o próprio sistema.

O Ai.Bot deve explicar a próxima ação recomendada, sem executar ações comerciais irreversíveis sem autorização.

## 135.21 Checklist Claude — Creator & Affiliate System

Claude deverá produzir checklist específico para:

1. modelo de dados;
2. creator profiles;
3. seller profiles;
4. platform links;
5. discovery;
6. scoring;
7. human approval;
8. outreach;
9. product assignment;
10. affiliate links;
11. commission engine;
12. platform commission ingestion;
13. own-site attribution;
14. payout reconciliation;
15. returns/cancellations;
16. partner P&L;
17. creator campaigns;
18. samples;
19. performance dashboard;
20. help center;
21. guided onboarding;
22. audit logs;
23. tests;
24. permissions;
25. go-live.

Claude deve validar cada integração de plataforma na documentação oficial mais recente antes de implementar.


---

# V4 — INSTRUÇÕES DE IMPLEMENTAÇÃO PARA CLAUDE CODE

Esta V4 deve ser usada junto com a Auditoria Mestre mais recente.

## Regras obrigatórias

1. Ler toda a especificação e a auditoria.
2. Não assumir que algo existe só porque aparece em .md antigo.
3. Reutilizar Studio, Brand Guardrails, FAQ, RepCo, BI e padrões existentes.
4. Não criar segundo CRM, segundo chat ou comissão B2B duplicada.
5. Não criar dezenas de agentes redundantes.
6. Preferir capabilities, workflows, services e tools compartilhadas.
7. Toda ação externa passa por Policy Engine.
8. Toda ação financeira/pública/irreversível exige aprovação conforme política.
9. Nunca contatar creator automaticamente antes de aprovação humana.
10. Nunca inventar claims, produto, origem, preço, estoque, fiscal ou política.
11. UI sempre em Português do Brasil.
12. Toda tela deve ser user-friendly, com `? Ajuda`.
13. Ao final de cada fase, gerar relatório e PARAR para revisão.

Criar/manter:
`docs/SAPORINO_AI_BOT_V4_IMPLEMENTATION_REPORT.md`

Terminar sempre com:

**RESULTADO PARA REVISÃO — TRAZER ESTE RELATÓRIO DE VOLTA AO CHAT DE INTELIGÊNCIA REPCO ANTES DE CONTINUAR.**

---

# V4.1 — PAPEL DO SAPORINO AI.BOT

O Ai.Bot é a camada de decisão e coordenação.

Ele NÃO é:
- ERP;
- fiscal;
- estoque;
- marketplace;
- transportadora;
- CRM duplicado.

Ele conecta:
RepCo + Studio + Consumer Intelligence + E-CoHub + Bling + Casa Cofico + Marketplaces + Creator Commerce + Customer Experience + Market Memory.

---

# V4.2 — ORQUESTRAÇÃO

Fluxo:
PERGUNTA/EVENTO
→ CONTEXTO
→ CLASSIFICAÇÃO
→ PLANO
→ CAPACIDADE ESPECIALIZADA
→ POLICY ENGINE
→ RESULTADO
→ MEMÓRIA

Limites:
- max steps;
- timeout;
- max cost;
- max retries;
- sem loops infinitos;
- audit trail.

---

# V4.3 — CAPACIDADES ESPECIALIZADAS

Preferir capacidades:
- Comercial
- Representantes
- E-Commerce
- Estoque
- Freight Intelligence
- Consumer Intelligence
- Market Intelligence
- Coffee Knowledge
- Content Intelligence
- Creator Intelligence
- Customer Experience
- Finance Intelligence
- Experiment Intelligence

Criar agente separado apenas quando houver motivo claro de permissão, toolset ou isolamento.

---

# V4.4 — SOCIAL GROWTH SEM DUPLICAÇÃO

A auditoria mostrou que o Studio já possui importação, análise, copy, guardrails e publicação Instagram.

Portanto:
não criar Social Growth Engine isolado.

Ampliar Studio/RepCo com:
- planejamento;
- comentários;
- métricas pós-publicação;
- memória;
- experimentos;
- Content DNA;
- Community Intelligence;
- oportunidades.

Ai.Bot consome e decide.

---

# V4.5 — LOOP DE PERFORMANCE

PLANEJAR
→ CRIAR
→ APROVAR
→ PUBLICAR
→ MEDIR
→ INTERPRETAR
→ APRENDER
→ RECOMENDAR

Coletar quando permitido:
- reach;
- views;
- watch time;
- retention;
- completion;
- saves;
- shares;
- comments;
- clicks;
- product views;
- carts;
- sales atribuíveis.

Separar vaidade de resultado comercial.

---

# V4.6 — CONTENT DNA

Aprender por:
MARCA + PRODUTO + PÚBLICO + CANAL + OBJETIVO + FORMATO + HOOK + CTA + CREATOR + OFERTA

Não generalizar sem evidência.

---

# V4.7 — BRAND GUARDIAN V4

Estender guardrails atuais para validar:
- marca;
- produto;
- SKU;
- embalagem;
- logo;
- peso;
- moagem;
- origem;
- claims;
- tom;
- canal;
- B2B/B2C;
- CTA;
- assets.

Níveis:
INFO
WARNING
BLOCK

---

# V4.8 — PRODUCT TRUTH ENGINE

Cruzar conteúdo com Base de Conhecimento e SKU.

Exemplos de bloqueio:
- criativo mostra grãos e SKU é moído;
- peso incorreto;
- origem não aprovada;
- moagem errada;
- claim não confirmado;
- embalagem não oficial.

---

# V4.9 — CONSUMER INTELLIGENCE

Pipeline:
SINAIS
→ NORMALIZAÇÃO
→ CLASSIFICAÇÃO
→ CLUSTERS
→ EVIDÊNCIA
→ OPORTUNIDADE/RISCO
→ AÇÃO
→ RESULTADO

Fontes quando disponíveis:
- reviews;
- comentários;
- atendimento;
- pós-compra;
- Reclame Aqui;
- marketplace;
- social;
- pesquisas;
- dados próprios.

---

# V4.10 — BIBLIOTECA DE ERROS DO MERCADO

Registrar:
- concorrente;
- produto;
- canal;
- problema;
- tema;
- frequência;
- severidade;
- evidência;
- período;
- risco interno;
- prevenção;
- ação;
- resultado.

Objetivo:
aprender com erros do mercado antes que aconteçam conosco.

---

# V4.11 — CUSTOMER PROTECTION

Consumir sinais do E-CoHub:
- atraso;
- ausência de tracking;
- objeto parado;
- pedido incompleto;
- reembolso;
- embalagem;
- possível lote;
- review negativo;
- mensagem sem resposta.

Ai.Bot interpreta prioridade; E-CoHub continua fonte transacional.

---

# V4.12 — CUSTOMER FRUSTRATION SCORE

Usar sinais operacionais legítimos:
- atraso;
- SLA;
- múltiplos contatos;
- reembolso;
- review;
- reincidência.

Nunca usar atributos sensíveis.

---

# V4.13 — RELACIONAMENTO DIGITAL

Auxiliar respostas em:
- Instagram;
- TikTok;
- marketplaces;
- site;
- reviews;
- atendimento.

Classificar:
- elogio;
- dúvida;
- intenção de compra;
- objeção;
- suporte;
- reclamação;
- preparo;
- entrega;
- preço;
- disponibilidade.

---

# V4.14 — POLÍTICA DE RESPOSTA

L1 — seguro:
feedback positivo simples.

L2 — contextual:
dúvida/crítica leve.

L3 — sensível:
atraso, dano, reembolso, acusação, sanitário.

Em L3, investigar antes de responder.

---

# V4.15 — CREATOR & SELLER INTELLIGENCE

Radar contínuo para:
- quem vende café;
- quem promove café;
- quem vende concorrentes;
- shop creators;
- live sellers;
- micro creators;
- nano creators;
- nichos adjacentes.

A lista nunca é estática.

---

# V4.16 — PERFIL DE CREATOR/SELLER

Para cada perfil:
- plataforma;
- link;
- nicho;
- produtos;
- marcas;
- conteúdo;
- sinais de venda;
- consistência;
- reputação;
- riscos;
- score;
- justificativa;
- última análise.

Sempre mostrar link original.

---

# V4.17 — SCORES

Coffee Creator Score:
afinidade real com café.

Sales Creator Score:
capacidade comercial.

Não confundir seguidores com venda.

---

# V4.18 — APROVAÇÃO HUMANA ANTES DO CONTATO

DESCOBERTO
→ ANALISADO
→ EM ANÁLISE
→ APROVADO
→ CONTATO PREPARADO
→ ENVIO

Nunca envio automático inicial.

---

# V4.19 — COPY DE CONVITE

Após aprovação, gerar:
- abordagem;
- motivo;
- produto;
- proposta;
- comissão;
- amostra;
- briefing;
- próximos passos.

Sempre com dados reais e política aprovada.

---

# V4.20 — COMMERCE GRAPH

CREATOR → promove → PRODUTO → vendido por → SELLER → MARKETPLACE

E:

CREATOR → CONTEÚDO → CLIQUE → VENDA → COMISSÃO → MARGEM → RECOMPRA

---

# V4.21 — FREIGHT INTELLIGENCE

Ai.Bot NÃO calcula frete do zero.

Consome dados do E-CoHub.

Pode responder:
- qual transportadora está mais competitiva;
- qual região está cara;
- qual pedido está com margem ruim;
- quando consolidar rota;
- qual pedido mínimo faz sentido;
- quais clientes B2B podem ser agrupados.

Toda recomendação deve mostrar base de cálculo.

---

# V4.22 — B2B + LOGÍSTICA

Cruzar:
PEDIDOS B2B → REGIÃO → VOLUME → FREQUÊNCIA → ROTA → FRETE → MARGEM

Exemplo:
sugerir consolidar clientes de uma mesma região.

Recomendação, não execução automática.

---

# V4.23 — ESTOQUE E REPOSIÇÃO

Consumir cobertura calculada pelo E-CoHub.

Gerar:
- risco de ruptura;
- prioridade de reposição;
- aceleração de SKU;
- campanha que deve ser limitada;
- creator que deve pausar promoção por estoque.

Não alterar estoque diretamente sem política/tool autorizada.

---

# V4.24 — CASA COFICO INTELLIGENCE

Distinguir:
LOJA = Casa Cofico
MARCA = Saporino / Fazendinha
CANAL = TikTok Shop / ML / Shopee / Amazon / Site

Permitir perguntas sobre venda, margem, recompra e creators por marca/canal.

---

# V4.25 — ESTRATÉGIA DE CANAL

Não hardcode papel de canal.

Pode começar com hipótese, mas só transformar em aprendizado após dados reais.

---

# V4.26 — EXPERIMENT ENGINE

Testar:
- hook;
- CTA;
- creator;
- bundle;
- preço;
- frete;
- descrição;
- imagem;
- narrativa;
- canal.

Guardar:
- hipótese;
- baseline;
- variável;
- período;
- métrica;
- resultado;
- confiança;
- aprendizado;
- próxima ação.

---

# V4.27 — MARKET MEMORY

Guardar por:
- marca;
- produto;
- região;
- canal;
- público;
- creator;
- oferta;
- período.

Separar:
OBSERVAÇÃO
INTERPRETAÇÃO
PREVISÃO
EVIDÊNCIA CAUSAL

---

# V4.28 — REPRESENTATION / BIAS MAP

Mostrar:
- fontes;
- amostra;
- período;
- segmentos representados;
- ausentes;
- concentração por canal;
- limitações.

Não tratar comentário online como opinião de todo o mercado.

---

# V4.29 — BASE DE CONHECIMENTO DO CAFÉ

UPLOAD
→ EXTRAÇÃO
→ REVISÃO HUMANA
→ APROVAÇÃO
→ CONHECIMENTO OFICIAL

Suportar:
- PDFs;
- fichas;
- origem;
- torra;
- moagem;
- sensorial;
- embalagem;
- validade;
- preparo;
- FAQ;
- políticas.

---

# V4.30 — AJUDA CONTEXTUAL / PERGUNTAR AO AI.BOT

Reutilizar FAQ e Modo Guia existentes.

Em cada tela:
- `? Ajuda`
- `Perguntar ao Ai.Bot`

Contexto:
- tela;
- módulo;
- permissão;
- entidade;
- ajuda relacionada.

Exemplos:
- O que significa este score?
- Como aprovo esse creator?
- Quem paga essa comissão?
- Por que este pedido está crítico?
- Como funciona o frete?
- Qual o próximo passo?

---

# V4.31 — MODO GUIADO

Criar fluxos simples para não desenvolvedor.

Exemplo creator:
1. analisar;
2. aprovar;
3. escolher produto;
4. definir comissão;
5. preparar contato;
6. enviar amostra;
7. acompanhar resultado.

---

# V4.32 — POLICY ENGINE

Toda ação deve registrar:
- action_type;
- actor;
- source;
- target;
- impacto;
- risco;
- aprovação;
- resultado;
- audit log.

Exigir aprovação em:
- preço;
- contato;
- publicação;
- reembolso;
- desconto;
- comissão;
- campanha.

---

# V4.33 — OBSERVABILIDADE DE IA

Registrar:
- modelo;
- tokens;
- custo;
- latência;
- erro;
- retry;
- task;
- capability;
- resultado;
- aprovação.

---

# V4.34 — QUALIDADE DOS AGENTES

Medir:
- precisão;
- taxa de aprovação;
- correção humana;
- conversão;
- margem;
- tempo economizado;
- incidentes;
- respostas inadequadas.

---

# V4.35 — ROADMAP

Fase 0 — estabilização
Fase 1 — fundação Ai.Bot
Fase 2 — inteligência comercial
Fase 3 — Content Intelligence
Fase 4 — Consumer Intelligence
Fase 5 — E-Commerce Intelligence
Fase 6 — Creator/Seller Intelligence
Fase 7 — Customer Experience
Fase 8 — Market Memory

---

# V4.36 — CHECKLIST OBRIGATÓRIO

Claude Code deve gerar checklist com:
- ID;
- fase;
- capability;
- tarefa;
- dependência;
- reutilização;
- arquivos;
- tabelas;
- tool/API;
- aprovação;
- teste;
- critério de aceite;
- status;
- evidência.

---

# V4.37 — RELATÓRIO PARA TRAZER DE VOLTA

Atualizar:
`docs/SAPORINO_AI_BOT_V4_IMPLEMENTATION_REPORT.md`

Incluir:
- estado inicial;
- reutilizado;
- criado;
- alterado;
- dados/tabelas;
- tools/APIs;
- capabilities/agentes;
- policies;
- testes;
- custos;
- riscos;
- pendências;
- próximo passo;
- perguntas para Vlademir.

Terminar com:

**TRAZER ESTE RELATÓRIO DE VOLTA AO CHAT DE INTELIGÊNCIA REPCO ANTES DE CONTINUAR PARA A PRÓXIMA GRANDE FASE.**
