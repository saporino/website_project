# MOTOR LOGÍSTICO COFICO / REPCO

**Especificação Técnica, Operacional e Financeira — ADMIN ONLY**

**Versão 1.1 — Agosto/2026**

> Documento interno restrito à administração, operação autorizada e desenvolvimento. Não distribuir a representantes, clientes ou terceiros.

## 1. Objetivo

Implementar no ecossistema RepCo / COFICO Entregas um motor logistico inteligente que decida, no momento da venda e durante a consolidacao das rotas, a forma mais eficiente e economicamente segura de entregar pedidos B2B.

O motor deve comparar continuamente:

1. entrega com frota propria COFICO;
2. consolidacao de pedidos em rota COFICO;
3. transportadoras terceirizadas cadastradas (ex.: Total Express, Jadlog, Rodonaves e futuras);
4. prazo prometido / urgencia;
5. capacidade disponivel da frota;
6. custo efetivo da entrega;
7. cobertura interna de frete por kg;
8. adicional de frete que deve ser cobrado do cliente, quando necessario.

O vendedor NAO deve conhecer a formula financeira interna. Ele deve receber apenas a decisao comercial final de frete e o prazo/previsao de entrega.

---

## 2. Principios financeiros internos

### 2.1 Cobertura interna de frete

A COFICO recebe internamente uma cobertura logistica de:

**R$ 1,50 por kg expedido.**

Essa informacao e confidencial e deve ser visivel somente para perfis administrativos autorizados.

Formula:

`cobertura_frete_pedido = peso_total_kg * 1.50`

Exemplos:

- 100 kg -> R$ 150,00 de cobertura interna;
- 250 kg -> R$ 375,00;
- 500 kg -> R$ 750,00;
- 750 kg -> R$ 1.125,00.

A cobertura de R$ 1,50/kg e o primeiro recurso usado para pagar a logistica daquele pedido/rota.

### 2.2 Receita de 2% sobre vendas

A COFICO recebe adicionalmente **2% sobre o valor das vendas**.

Essa receita NAO deve ser utilizada pelo motor para reduzir o frete cobrado do cliente. Ela sera tratada como receita interna destinada a ajudar a suportar galpao / estrutura operacional / overhead da operacao.

Exemplo gerencial:

- 20.000 kg/mes;
- valor medio aproximado: R$ 38,00/kg;
- faturamento aproximado: R$ 760.000,00;
- 2%: R$ 15.200,00.

O percentual deve ser configuravel pelo administrador, pois pode mudar no futuro.

### 2.3 Separacao obrigatoria de fundos

O sistema deve manter separacao contabil/gerencial entre:

- **Cobertura de Frete:** R$ 1,50/kg, usada na decisao logistica;
- **Reserva Logistica:** sobras positivas de fretes/rotas ja liquidados;
- **Receita de Estrutura:** 2% das vendas, destinada ao galpao/overhead;
- **Frete Cobrado do Cliente:** somente o valor adicional necessario quando a cobertura interna nao for suficiente.

Nunca misturar os quatro saldos na interface ou nas regras.

---

## 3. Regra fundamental de cobranca ao cliente

A COFICO absorve o custo logistico ate o limite economico coberto por R$ 1,50/kg.

Se o custo escolhido pelo motor for menor ou igual a cobertura interna:

`frete_cliente = R$ 0,00`

A diferenca positiva NAO vira desconto ao cliente. Depois da liquidacao dos custos reais, a sobra vai para a Reserva Logistica.

Se o custo escolhido for maior que a cobertura interna:

`frete_cliente = custo_logistico_escolhido - cobertura_interna`

Exemplo:

- peso: 333,33 kg;
- cobertura interna aproximada: R$ 500,00;
- custo logistico escolhido: R$ 605,00;
- frete adicional ao cliente: R$ 105,00.

O vendedor enxerga apenas:

**Frete: R$ 105,00**

Ele nao enxerga a cobertura interna de R$ 500,00 nem a regra de R$ 1,50/kg.

---

## 4. Reserva Logistica COFICO

Criar um ledger/banco de reserva logistica auditavel.

### 4.1 Entradas da reserva

Entram na Reserva Logistica:

- sobra de cobertura interna depois de pagar uma transportadora terceirizada;
- sobra final de uma rota propria apos reconciliar os custos reais;
- ajustes positivos autorizados por administradores.

### 4.2 Saidas da reserva

A reserva pode ser utilizada somente para despesas logisticas extraordinarias / emergenciais autorizadas, por exemplo:

- combustivel emergencial;
- pedagio extraordinario;
- pane / socorro;
- estacionamento especial;
- reentrega excepcional;
- diferenca operacional autorizada;
- outras ocorrencias logisticas registradas.

A reserva NAO deve ser usada automaticamente para dar frete gratis ou reduzir o frete comercial de um novo cliente.

### 4.3 Rastreabilidade

Cada movimento deve registrar:

- data/hora;
- tipo de movimento;
- valor;
- rota relacionada;
- pedido(s) relacionado(s);
- veiculo;
- transportadora, se aplicavel;
- usuario responsavel;
- justificativa;
- comprovante/anexo opcional;
- saldo antes;
- saldo depois.

O painel administrativo deve mostrar:

- saldo atual;
- entradas no mes;
- saidas no mes;
- saldo por origem (rota propria / transportadora / ajuste);
- historico completo.

---

## 5. Custo-base da frota propria

Usar como parametro inicial administrativo:

**R$ 350,00 por veiculo COFICO efetivamente despachado no dia.**

Este e um valor estimado/gerencial, nao uma constante imutavel.

Deve existir campo de configuracao no admin:

`custo_base_diario_por_veiculo = 350.00`

Se dois veiculos COFICO forem despachados no mesmo dia, cada um possui sua propria base operacional. Portanto, a base total do dia e R$ 700,00, antes das despesas variaveis de cada rota.

O custo economico de uma rota propria sera:

`custo_rota = custo_base_veiculo + combustivel_estimado + pedagios_estimados + estacionamentos + adicionais_previstos`

Depois do retorno do veiculo, o sistema deve substituir estimativas pelos valores reais sempre que estes forem informados:

`custo_real_rota = custo_base_veiculo + combustivel_real + pedagios_reais + estacionamentos_reais + outros_custos_reais`

A diferenca entre o provisionado e o real e reconciliada na Reserva Logistica.

---

## 6. Capacidade da frota COFICO

### 6.1 Capacidade padrao

Cada veiculo/rota COFICO deve iniciar com capacidade configurada de:

**750 kg por viagem/dia.**

Capacidade deve pertencer ao cadastro do veiculo, pois futuros veiculos podem ter limites diferentes.

`capacidade_padrao_veiculo_kg = 750`

Se houver dois veiculos de 750 kg ativos e disponiveis, a capacidade operacional potencial do dia passa a 1.500 kg, distribuida em duas rotas/veiculos.

### 6.2 Excesso de capacidade

Se uma rota atingir 750 kg:

- novos pedidos nao entram naquele veiculo;
- o sistema tenta outro veiculo COFICO disponivel;
- se nao houver, programa o excedente para a proxima rota/data;
- simultaneamente compara transportadora terceirizada;
- se terceirizada for economicamente e operacionalmente melhor, pode recomendar terceirizacao sem esperar a proxima rota COFICO.

---

## 7. Pedido minimo dinamico - por rota, nao por cliente

Nao criar um pedido minimo universal por cliente.

O motor deve determinar se uma rota esta economicamente pronta a partir do conjunto de pedidos.

Uma rota COFICO torna-se candidata a despacho quando:

1. os pedidos pertencem a um corredor/cluster logistico compativel;
2. o peso total cabe no veiculo;
3. a cobertura total da rota e suficiente ou o adicional necessario pode ser cobrado;
4. o custo e competitivo em relacao as transportadoras;
5. o SLA/prazo comercial permite aguardar consolidacao.

A cobertura interna da rota e:

`cobertura_rota = soma(peso_pedido * 1.50)`

Nao e necessario atingir 750 kg para sair. O peso minimo e economico e dinamico.

Exemplo:

- uma rota pode ser viavel com 420 kg se a geografia for barata;
- outra pode precisar de 650 kg para justificar a viagem;
- outra pode nunca ser mais barata que uma transportadora naquele dia.

---

## 8. Cobertura comercial x zonas / corredores logísticos

### 8.1 Separação obrigatória de conceitos

O sistema deve manter separados:

- **Cobertura comercial:** responde se a COFICO atende determinado município/endereço. Pode alimentar a informação exibida ao representante.
- **Zona/corredor logístico:** classificação interna usada para roteirização, consolidação, histórico e aprendizado do motor.
- **Política de frete:** resultado econômico calculado pelo motor. Cidade atendida ou pertencente a uma zona **não significa automaticamente frete incluso/grátis**.

As Diretrizes Comerciais do representante devem trabalhar apenas com cobertura de atendimento e resultado final de frete. As zonas A–G permanecem no Motor Logístico/Admin.

### 8.2 Zonas / corredores logísticos iniciais de São Paulo

O vendedor nao seleciona a zona. O sistema identifica automaticamente pelo endereco/CEP e pode reclassificar com base no roteamento real.

Mapa inicial sugerido, totalmente configuravel:

- **Zona A - Local / CD:** Varzea Paulista, Jundiai e entorno imediato;
- **Zona B - Campinas / Oeste:** Campinas, Valinhos, Vinhedo, Louveira, Americana, Santa Barbara d'Oeste e corredor relacionado;
- **Zona C - Circuito das Aguas / Bragantina:** Atibaia, Braganca Paulista, Serra Negra e corredor relacionado;
- **Zona D - Grande Sao Paulo:** Barueri, Osasco, Sao Paulo e municipios do corredor metropolitano;
- **Zona E - Sorocaba:** Sorocaba e entorno;
- **Zona F - Piracicaba / Rio Claro:** Piracicaba, Rio Claro e entorno;
- **Zona G - Baixada / Litoral:** Santos, Sao Vicente, Praia Grande e demais destinos litoraneos definidos.

As zonas nao devem funcionar como uma tabela rigida de preco. Sao clusters para consolidacao, aprendizado e programacao de rotas.

---

## 9. Comparacao frota propria x transportadoras

Para cada pedido ou conjunto de pedidos, o motor deve calcular alternativas.

### 9.1 Alternativa COFICO

Calcular:

- rota mais eficiente;
- km estimados;
- custo-base do veiculo;
- combustivel;
- pedagios;
- capacidade utilizada;
- pedidos ja consolidados;
- custo estimado total;
- prazo estimado;
- custo alocado por pedido.

### 9.2 Alternativa terceirizada

Consultar, sempre que possivel:

- Total Express;
- Jadlog;
- Rodonaves;
- futuras transportadoras cadastradas.

Fonte de tarifa pode ser:

1. API em tempo real;
2. integracao de cotacao;
3. tabela comercial versionada;
4. historico real de fretes pagos.

### 9.3 Elegibilidade antes de preço

O motor NÃO deve comparar preço de uma modalidade que não consiga cumprir os requisitos reais do destino. Antes da comparação econômica, filtrar as alternativas por elegibilidade.

Cada transportadora/modal deve possuir capacidades e restrições cadastradas, incluindo quando aplicável:

- entrega B2B;
- entrega em loja;
- entrega em centro de distribuição de rede;
- agendamento obrigatório;
- janela de descarga;
- paletização;
- comprovante de entrega/POD;
- restrição de veículo;
- limite de peso/volume/cubagem;
- abrangência por CEP/região;
- SLA;
- necessidade de ajudante;
- exigências documentais;
- restrições específicas do cliente/destino.

O cadastro do cliente/endereço deve permitir classificar o **tipo de destino**, por exemplo: loja independente, supermercado, atacadista, CD de rede, cliente com agendamento obrigatório ou outro tipo configurável.

Uma transportadora de encomendas pode ser adequada para uma loja isolada e inadequada para um CD de rede. Se não cumprir agendamento, janela, paletização, conferência ou outra exigência obrigatória, deve ser eliminada antes da comparação de preço.

Fluxo obrigatório:

`VALIDAR DADOS -> IDENTIFICAR REQUISITOS DO DESTINO -> FILTRAR ELEGIBILIDADE -> CALCULAR CUSTO TOTAL -> VALIDAR SLA -> ESCOLHER MENOR CUSTO TOTAL VÁLIDO`

### 9.4 Regra de escolha - menor custo total válido

A regra primária do motor é objetiva:

**entre todas as alternativas elegíveis e operacionalmente válidas que atendam o SLA/prazo prometido e as restrições do pedido, escolher a de MENOR CUSTO TOTAL para a COFICO.**

Isso vale mesmo quando existe rota ou veiculo proprio disponivel. A existencia de frota COFICO nao cria preferencia automatica pela frota propria.

Exemplo:

- COFICO propria: R$ 500;
- Total Express: R$ 430;
- Jadlog: R$ 350;
- Rodonaves: R$ 280.

Se todas as alternativas forem validas para o destino e prazo, o motor escolhe **Rodonaves por R$ 280**.

Se a cobertura interna do pedido for R$ 750, o vendedor recebe apenas:

**Frete ao cliente: GRATIS**

A diferenca positiva entre cobertura e custo efetivamente liquidado alimenta a Reserva Logistica.

Se uma opcao mais barata nao cumprir prazo, restricao de recebimento, tipo de carga ou outra regra operacional obrigatoria, ela e descartada e o motor seleciona a proxima alternativa valida de menor custo.

Nunca manter pedido aguardando consolidacao de frota propria quando uma transportadora homologada for mais barata, operacionalmente valida e atender o prazo.

---

## 10. Alocacao do custo da rota propria entre pedidos

### 10.1 Versao inicial

Ratear o custo economico da rota proporcionalmente ao peso de cada pedido.

Exemplo:

- Cliente A: 100 kg -> 20% do peso;
- Cliente B: 150 kg -> 30%;
- Cliente C: 250 kg -> 50%;
- total: 500 kg.

Se o custo da rota for R$ 600:

- A recebe custo alocado de R$ 120;
- B recebe R$ 180;
- C recebe R$ 300.

Cobertura interna dos pedidos:

- A: 100 x 1,50 = R$ 150 -> sobra R$ 30;
- B: 150 x 1,50 = R$ 225 -> sobra R$ 45;
- C: 250 x 1,50 = R$ 375 -> sobra R$ 75.

Sobra total antes de ajustes adicionais: R$ 150.

A sobra pertence a operacao/Reserva Logistica, nao aos clientes.

### 10.2 Evolucao futura

Depois que houver historico suficiente, o rateio pode evoluir para ponderacao por:

- peso;
- km adicionais/desvio provocado pela parada;
- tempo de descarga;
- pedagio especifico;
- dificuldade de acesso;
- agendamento;
- janela de recebimento.

O sistema deve guardar os dados desde o inicio para permitir essa evolucao sem refazer o banco.

---

## 11. O que significa "custo marginal de adicionar um cliente"

Para o projeto, custo marginal significa apenas:

**quanto a rota fica mais cara se este pedido for incluido.**

Exemplo:

- rota atual: CD -> Campinas -> Americana -> CD = R$ 430;
- incluir Santa Barbara d'Oeste aumenta km/pedagio/tempo e leva o custo para R$ 470;
- custo marginal dessa parada = R$ 40.

O vendedor nao ve esse numero. O motor usa internamente para decidir se vale encaixar o pedido na rota existente ou usar outra opcao.

---

## 12. O que significa "quanto o pedido contribui para a operacao"

Neste projeto, a contribuicao logistica do pedido significa:

`peso_kg * R$ 1,50`

Exemplo:

- pedido 250 kg -> contribui com R$ 375 de cobertura de frete.

O percentual de 2% das vendas NAO entra nessa decisao de frete. Ele e separado e destinado a estrutura/galpao.

---

## 13. Embalagem, volumes, cubagem e paletizacao

### 13.1 Estrutura conhecida

Cafe 500 g sanfonado:

- 1 pacote = 500 g;
- 1 fardo = 10 pacotes;
- 1 fardo = 5 kg;
- 1 camada/lastro = 10 fardos;
- 1 camada = 50 kg;
- capacidade operacional informada por palete/veiculo para esta rotina: ate 750 kg;
- 750 kg = 150 fardos = 1.500 pacotes de 500 g.

### 13.2 Parametros operacionais iniciais do fardo de 5 kg

Cadastrar como parametros operacionais iniciais, sujeitos a validacao fisica e alteracao administrativa sem deploy:

- 10 pacotes de 500 g por fardo;
- peso liquido do fardo: **5,000 kg**;
- peso bruto operacional inicial: **5,100 kg**;
- comprimento: **40 cm**;
- largura: **22 cm**;
- altura: **16 cm**;
- volume unitario: **0,01408 m3**.

Essas dimensoes nao devem ser hardcoded na regra de negocio. Devem morar no cadastro de embalagem/SKU e permanecer editaveis pelo administrador. Antes da entrada definitiva em producao, conferir fisicamente uma amostra real do fardo e ajustar se necessario.

Criar no cadastro de embalagem:

- `comprimento_cm`;
- `largura_cm`;
- `altura_cm`;
- `peso_liquido_kg`;
- `peso_bruto_kg`;
- `unidades_por_fardo`;
- `fardos_por_camada`;
- `fardos_por_palete`;
- `peso_maximo_palete_kg`;
- `fator_cubagem_transportadora`.

Com isso, o vendedor nunca digita C x L x A. O pedido calcula automaticamente volumes, peso real e cubagem a partir dos itens vendidos.

Para uma transportadora com fator de 300 kg/m3, o fardo acima gera peso cubado de:

`0,01408 m3 * 300 = 4,224 kg`

Como o peso bruto operacional e 5,100 kg, nesse exemplo prevalece o peso real.

Regra geral:

`peso_faturavel = max(peso_real, peso_cubado)`

O fator deve ser configuravel por transportadora/tabela.

---

## 14. Dados necessários para cotação e requisitos do destino

O pedido deve obter automaticamente, sempre que possível:

- endereco completo da origem (CD COFICO);
- endereco completo do destino (cadastro do cliente);
- tipo de mercadoria (cafe / produto cadastrado);
- CNPJ/CPF do remetente;
- CNPJ/CPF do destinatario;
- pagador do frete;
- quantidade de volumes;
- peso total;
- valor da NF/pedido;
- dimensões e cubagem calculadas pelo cadastro de embalagem;
- tipo de destino/recebimento;
- necessidade de agendamento;
- janela de recebimento;
- exigência de paletização;
- restrição de veículo/acesso;
- exigências documentais ou operacionais cadastradas para aquele cliente/endereço.

O vendedor nao deve redigitar informacoes ja existentes no sistema.

Se faltar dado obrigatorio, mostrar exatamente o campo que impede a cotacao.

---

## 15. Experiencia do vendedor no momento da venda

Na tela do pedido, criar bloco **Frete / Entrega**.

O vendedor deve ver somente informacao comercial:

- `Frete incluso / R$ 0,00`;
- `Frete adicional: R$ X`;
- `Entrega COFICO - aguardando consolidacao`;
- `Entrega COFICO - previsao dd/mm`;
- `Transportadora - coleta prevista dd/mm`;
- `Requer dado de endereco/documento`;
- `Requer aprovacao`;
- `Sem opcao de entrega calculada`.

Nunca mostrar ao vendedor:

- R$ 1,50/kg;
- 2% das vendas;
- saldo da Reserva Logistica;
- custo-base interno do veiculo;
- margem/sobra interna do frete;
- comparativo de lucro interno entre modais.

Esses dados sao exclusivos do admin.

---

## 16. Estados da fila / rota

Sugestao de status operacionais:

- **Cotando**;
- **Frete calculado**;
- **Aguardando consolidacao**;
- **Rota economicamente pronta**;
- **Aguardando capacidade**;
- **Programada COFICO**;
- **Coleta terceirizada solicitada**;
- **Coleta confirmada**;
- **Despachada**;
- **Em rota**;
- **Entregue**;
- **Ocorrencia**;
- **Reentrega**;
- **Cancelada**.

Para o vendedor, simplificar os estados tecnicos em mensagens claras.

---

## 17. Logica de decisao resumida

Para cada pedido:

1. validar endereco e dados necessarios;
2. calcular peso, volumes e cubagem automaticamente;
3. calcular cobertura interna de frete (oculta);
4. identificar zona/corredor logistico automaticamente;
5. procurar rotas COFICO abertas/planejadas compativeis;
6. verificar capacidade disponivel do(s) veiculo(s);
7. estimar custo COFICO com e sem o novo pedido;
8. identificar tipo de destino e requisitos de recebimento;
9. cotar transportadoras/modais cadastrados;
10. eliminar alternativas não elegíveis para o destino, SLA, restrições ou requisitos operacionais;
11. entre as alternativas válidas, escolher a de menor custo total;
12. calcular adicional a cobrar do cliente, se houver;
13. apresentar somente resultado comercial ao vendedor;
14. ao despachar, reservar capacidade quando for frota própria;
15. ao concluir, reconciliar custo real;
16. registrar sobra/déficit e movimentar Reserva Logística conforme regra.

---

## 18. Regra de consolidação e urgência

O motor não deve deixar um pedido parado indefinidamente esperando completar 750 kg.

Criar parâmetro administrativo configurável:

`MAX_CONSOLIDATION_WAIT_BUSINESS_DAYS`

Não hardcode. Como referência inicial de teste pode-se usar **2 dias úteis**, mas esse valor permanece sujeito à validação operacional e alteração administrativa.

O prazo máximo pode futuramente admitir regras específicas por zona/cliente/condição comercial.

IMPORTANTE: esse prazo é um limite de espera, não uma obrigação de esperar. Se antes dele existir transportadora/modal elegível, mais econômica e compatível com o SLA, o motor deve poder selecionar essa alternativa imediatamente.

Enquanto o pedido aguarda:

- procurar novos pedidos compativeis;
- recalcular rota sempre que um pedido entrar;
- recalcular cotacoes terceirizadas quando necessario;
- se terceirizada se tornar racionalmente melhor, recomendar terceirizacao;
- alertar vendedor quando houver previsao real de saida.

A capacidade de 750 kg e teto do veiculo, nao meta obrigatoria para despacho.

---

## 19. Inteligencia historica de transportadoras

Toda cotacao e todo frete realizado deve alimentar historico por:

- transportadora;
- origem;
- destino/CEP/municipio;
- zona comercial;
- peso real;
- peso cubado;
- faixa de peso;
- valor NF;
- custo cotado;
- custo faturado real;
- taxas adicionais;
- prazo prometido;
- prazo real;
- ocorrencias;
- reentregas;
- devolucoes;
- data de vigencia da tabela.

A tabela Total Express anexada deve ser cadastrada como **tabela versionada**, nao como verdade permanente. Ela possui valores por regiao/faixa de peso e adicionais e precisa de data de vigencia.

Conforme fretes reais forem realizados, o sistema deve comparar:

`cotado x faturado x prazo prometido x prazo realizado`

E gerar score por transportadora/rota.

---

## 20. Estrutura da tabela Total Express como referencia de modelo

A tabela analisada trabalha com:

- geografia comercial por zona;
- faixas de peso 10, 20, 30, 50, 70 e 100 kg;
- adicional por kg acima da faixa maxima;
- diferenca de tarifa por localidade;
- abrangencia por CEP;
- prazos;
- taxas e adicionais.

Exemplo interior de SP para 100 kg na tabela:

- SP1: R$ 146,51;
- SP2: R$ 177,50;
- SP3: R$ 210,87.

Acima de 100 kg:

- SP1: R$ 2,42/kg adicional;
- SP2: R$ 2,64/kg adicional;
- SP3: R$ 3,04/kg adicional.

Esses valores sao referencia da tabela anexada e NAO devem ser hardcoded como valores permanentes. Criar importacao/versionamento de tabela.

---

## 20A. Camada econômica x camada fiscal do frete — P0

O valor interno de **R$ 1,50/kg** é um parâmetro econômico/gerencial de cobertura logística. O sistema NÃO deve assumir que esse valor precisa aparecer fiscalmente como “frete embutido no preço” ou de qualquer outra forma específica na NF.

A arquitetura deve separar:

- **Camada econômica:** cobertura interna, custo logístico, frete adicional ao cliente, reserva e decisão de modal.
- **Camada fiscal/documental:** CIF/FOB, destaque ou não de frete, base de cálculo, campos da NF-e e demais tratamentos definidos pela contabilidade/fiscal.

**P0 antes da automação fiscal em produção:** validar com contador/fiscal o tratamento correto para os cenários operacionais da COFICO.

Como hipótese operacional a validar, e não como regra fiscal definitiva:

- CIF quando a COFICO organiza/contrata o transporte;
- FOB quando o cliente retira ou contrata o transporte sob responsabilidade dele.

O Motor Logístico deve continuar funcionando mesmo se o tratamento fiscal mudar. Uma alteração fiscal não deve exigir reescrever a lógica econômica central.

---

## 21. Integracao com a tela COFICO Entregas existente

Nao reconstruir o modulo do zero. Evoluir a tela existente que ja possui:

- Motoristas;
- Frota;
- Rotas despachadas;
- fila de pedidos;
- montagem de rota;
- atribuicao de motorista;
- data de saida;
- despacho de rota.

Adicionar:

### No card do pedido

- peso;
- zona automática (uso operacional; não confundir com cobertura comercial);
- tipo de destino/recebimento;
- requisitos especiais de entrega;
- status logistico;
- previsao;
- frete comercial ao cliente;
- indicacao de COFICO/terceirizada (quando apropriado);
- alerta de dados faltantes.

### No painel Montar Rota

- capacidade do veiculo: usado / 750 kg;
- cobertura interna total (somente admin);
- custo estimado rota (somente admin);
- custo por pedido (somente admin);
- comparativo terceirizadas (somente admin);
- recomendacao do motor;
- status economico da rota;
- km estimados;
- pedagios estimados;
- combustivel estimado;
- previsao de saldo da rota.

### Apos retorno

Criar fechamento da rota:

- km real;
- combustivel real;
- pedagios reais;
- outros custos;
- comprovantes;
- custo real;
- saldo final;
- movimento automatico da Reserva Logistica.

---

## 22. Permissoes

### Vendedor

Pode ver:

- valor final do frete ao cliente;
- previsao/status de entrega;
- se precisa aguardar consolidacao;
- dados faltantes;
- opcao recomendada de entrega sem detalhes financeiros internos.

### Operacao/Logistica

Pode ver:

- rotas;
- pesos;
- capacidade;
- veiculos;
- motorista;
- transportadora;
- coleta;
- custos operacionais autorizados para execucao.

### Admin/CFO/Diretoria

Pode ver e editar:

- R$ por kg interno;
- percentual de estrutura;
- custo-base por veiculo;
- capacidade;
- reserva logistica;
- tabelas de transportadoras;
- formulas/configuracoes;
- custos completos;
- historico;
- regras de aprovacao.

---

## 23. Parametros administrativos obrigatorios

Criar configuracao, sem hardcode:

- cobertura frete por kg: default R$ 1,50;
- percentual estrutura sobre vendas: default 2,00%;
- custo-base diario por veiculo: default R$ 350,00;
- capacidade por veiculo;
- preco combustivel de referencia;
- consumo km/l por veiculo;
- margem de seguranca de estimativa;
- `MAX_CONSOLIDATION_WAIT_BUSINESS_DAYS` (default inicial de teste sugerido: 2, sujeito a validação);
- regras de frete gratis/adicional;
- zonas/corredores;
- transportadoras ativas;
- tabelas tarifarias e vigencias;
- fatores de cubagem;
- adicionais por transportadora;
- capacidades/restrições por transportadora/modal;
- tipos de destino;
- requisitos de recebimento por cliente/endereço;
- regras de elegibilidade;
- parâmetros fiscais/documentais após validação contábil.

Toda alteracao deve ficar auditada.

---

## 24. Formulas centrais

### Cobertura interna do pedido

`C_pedido = peso_kg * tarifa_interna_kg`

### Cobertura da rota

`C_rota = soma(C_pedido)`

### Custo proprio estimado

`CP = custo_base_veiculo + combustivel + pedagios + estacionamento + adicionais`

### Custo terceirizado

`CT = tarifa_transportadora + pedagio + seguro + GRIS + taxas + adicionais`

### Custo escolhido

`CE = melhor alternativa que atenda custo + SLA + capacidade + restricoes`

### Frete ao cliente

`FC = max(0, custo_alocado_pedido - C_pedido)`

### Saldo logistico final

`SL = cobertura_interna + frete_cliente_recebido - custo_real`

Se `SL > 0`, creditar Reserva Logistica.

Se `SL < 0`, gerar deficit/ocorrencia para admin; nao consumir Reserva automaticamente sem regra/autorizacao.

---

## 25. Criterios de aceite

O modulo somente esta pronto quando:

1. vendedor consegue fechar pedido sem conhecer R$ 1,50/kg ou 2%;
2. vendedor recebe frete gratis ou adicional calculado;
3. endereco e itens calculam peso/volumes automaticamente;
4. sistema identifica zona sem selecao manual;
5. COFICO respeita capacidade de 750 kg por veiculo configurado;
6. pedidos podem aguardar consolidacao sem ficarem esquecidos;
7. motor compara frota propria x terceirizadas;
8. tabela de transportadora e versionada;
9. custos estimados sao reconciliados com custos reais;
10. sobras alimentam Reserva Logistica auditavel;
11. reserva nao reduz automaticamente frete de novos clientes;
12. 2% sobre vendas permanece separado do motor de frete;
13. admin consegue alterar parametros sem deploy;
14. existe historico de cotacao e custo real por rota/transportadora;
15. módulo reutiliza a tela COFICO Entregas existente e não duplica estruturas;
16. sistema filtra elegibilidade antes de comparar preço;
17. CD de rede/agendamento/janela/paletização podem impedir modalidades incompatíveis;
18. cobertura comercial e zona logística são conceitos separados;
19. prazo máximo de consolidação é configurável e não obriga esperar quando já existe opção melhor;
20. camada econômica do frete permanece separada da camada fiscal/documental;
21. automação fiscal de frete não entra em produção antes da validação do contador/fiscal.

---

## 26. Validacao fisica dos parametros de embalagem antes da producao

O motor ja pode ser implementado com os parametros operacionais iniciais cadastrados para o fardo de 5 kg:

- 40 cm x 22 cm x 16 cm;
- 5,100 kg de peso bruto operacional;
- 10 pacotes de 500 g.

Antes de liberar cotacoes reais de producao, a operacao deve medir uma amostra fisica do fardo fechado e confirmar ou corrigir os valores no cadastro.

A correcao deve ser administrativa e versionada, sem alteracao de codigo.

## 27. Pendências P0 antes da produção

Estas pendências não impedem desenvolvimento estrutural do Motor, mas impedem ativar determinadas decisões automáticas em produção:

1. **Fiscal/contábil:** validar CIF/FOB, frete destacado/embutido, base de cálculo e reflexos na NF-e.
2. **Embalagem:** medir fisicamente fardo fechado e confirmar peso bruto e dimensões cadastradas.
3. **Transportadoras:** validar quais providers atendem efetivamente loja, B2B e CD de rede, incluindo agendamento, janela, paletização e restrições.
4. **SLA de consolidação:** validar o valor inicial de `MAX_CONSOLIDATION_WAIT_BUSINESS_DAYS`; sugestão de teste = 2 dias úteis, não regra definitiva.
5. **Cadastros de destino:** garantir que clientes/endereços críticos possuam requisitos de recebimento antes da decisão automática.

Nenhum P0 deve ser “resolvido” por inferência do sistema. Quando faltar dado obrigatório, o Motor deve retornar **REQUER APROVAÇÃO / REQUER DADO**.

---

## 28. Resultado esperado

O RepCo deve funcionar como um despachante economico inteligente.

A pergunta deixa de ser:

> "Quanto cobro de frete para esse cliente?"

E passa a ser:

> "Qual e a melhor maneira de entregar este pedido, considerando todos os pedidos ja existentes, capacidade da COFICO, transportadoras disponiveis, custo, prazo e cobertura logistica interna?"

O vendedor recebe uma resposta simples. A complexidade fica no motor.
