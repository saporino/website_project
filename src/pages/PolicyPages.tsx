import { useEffect } from 'react';

const PolicyLayout = ({ title, children }: { title: string; children: React.ReactNode }) => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-white pt-24 pb-16">
            <div className="max-w-4xl mx-auto px-6 lg:px-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-8">{title}</h1>
                <div className="prose prose-stone max-w-none">
                    {children}
                </div>
            </div>
        </div>
    );
};

export const PrivacyPolicy = () => {
    const handleAccept = () => {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.scrollTo(0, 0);
    };

    return (
        <PolicyLayout title="Política de Privacidade – Café Saporino Ltda.">
            <p className="text-sm text-gray-500 mb-6"><strong>Última atualização:</strong> 19 de novembro de 2025</p>

            <p className="mb-4">
                A Café Saporino Ltda. ("Café Saporino", "nós", "nosso" ou "Empresa") leva sua privacidade a sério e está comprometida em proteger os dados pessoais dos clientes, parceiros e visitantes de nossos canais digitais. Esta Política de Privacidade explica como coletamos, usamos, compartilhamos e armazenamos seus dados quando você acessa nosso site <a href="http://www.cafesaporino.com.br" className="text-[#a4240e] hover:underline">www.cafesaporino.com.br</a> ("Site"), compra nossos produtos em marketplaces parceiros (como Amazon, Mercado Livre e Shopee) ou se comunica conosco por qualquer canal.
            </p>

            <p className="mb-6">
                Ao utilizar nossos serviços, você declara estar ciente e de acordo com as condições aqui descritas. Se não concordar com esta política, recomendamos que não forneça dados pessoais nem utilize nossos serviços.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Quem somos</h2>
            <p className="mb-4">
                A Café Saporino Ltda. é uma pessoa jurídica de direito privado, inscrita no CNPJ sob nº 61.109.694/0001-94, com sede à Al. Rio Negro, 503 – Sala 2005 – Alphaville Industrial, Barueri – SP, 06454‑000. Somos responsáveis pelo tratamento dos dados pessoais de nossos clientes quando estes são coletados diretamente por nós (por exemplo, ao se cadastrar em nosso Site ou ao realizar compras conosco). Para assuntos relacionados à privacidade e proteção de dados, disponibilizamos o e‑mail <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a>, que também é o canal do nosso Encarregado de Proteção de Dados (DPO).
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Definições</h2>
            <p className="mb-2"><strong>Dados pessoais:</strong> qualquer informação que identifique ou possa identificar uma pessoa natural, como nome, CPF, endereço de e‑mail, endereço de entrega e número de telefone.</p>
            <p className="mb-2"><strong>Dados sensíveis:</strong> informações sobre origem racial ou étnica, convicção religiosa, opinião política, filiação a sindicato, dados referentes à saúde ou à vida sexual, dados genéticos ou biométricos.</p>
            <p className="mb-2"><strong>Tratamento:</strong> toda operação realizada com dados pessoais, incluindo coleta, uso, armazenamento, compartilhamento e eliminação.</p>
            <p className="mb-4"><strong>LGPD:</strong> Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), que regulamenta o tratamento de dados pessoais no Brasil.</p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Quais dados coletamos</h2>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">3.1 Dados fornecidos diretamente por você</h3>
            <p className="mb-2">Podemos solicitar e coletar dados pessoais quando você:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Cria uma conta ou faz um cadastro no Site:</strong> nome completo, CPF/CNPJ, data de nascimento, endereço, e‑mail, telefone e senha.</li>
                <li><strong>Realiza compras no Site ou em marketplaces parceiros:</strong> nome, CPF/CNPJ, e‑mail, telefone, endereço de entrega e de faturamento, dados de pagamento (geralmente processados pelo próprio marketplace ou por intermediadores de pagamento; não armazenamos dados completos de cartão de crédito).</li>
                <li><strong>Entra em contato via e‑mail, chat ou formulários:</strong> informações que você decide incluir nas comunicações (comentários, dúvidas, reclamações ou sugestões).</li>
                <li><strong>Assina newsletters ou aceita receber promoções:</strong> endereço de e‑mail e preferências de comunicação.</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">3.2 Dados coletados automaticamente</h3>
            <p className="mb-2">Ao navegar em nosso Site, podemos registrar:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Dados de navegação:</strong> endereço IP, tipo de navegador, sistema operacional, páginas visitadas, data e hora de acesso.</li>
                <li><strong>Dados de dispositivo:</strong> modelo do dispositivo, geolocalização aproximada, idioma e resolução de tela.</li>
                <li><strong>Cookies e tecnologias semelhantes:</strong> usamos cookies e pixels para lembrar suas preferências, analisar tráfego e personalizar conteúdo. Você pode gerenciar os cookies no seu navegador; no entanto, bloqueá‑los pode impactar o funcionamento de algumas funcionalidades.</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">3.3 Dados recebidos de terceiros</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Marketplaces parceiros (Amazon, Mercado Livre, Shopee):</strong> quando você compra nossos produtos nessas plataformas, recebemos informações necessárias para processar o pedido (por exemplo, seu nome, endereço e dados da compra). Esses marketplaces têm suas próprias políticas de privacidade; recomendamos que você as leia ao utilizar seus serviços.</li>
                <li><strong>Prestadores de serviços de pagamento e logística:</strong> podemos receber confirmações de pagamento e status de entrega para cumprir nosso contrato de venda.</li>
                <li><strong>Ferramentas de análise de dados e marketing:</strong> podemos utilizar parceiros que coletam dados de uso por meio de cookies, pixels ou SDKs para analisar performance de campanhas e personalizar ofertas.</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Para que usamos seus dados e bases legais</h2>
            <p className="mb-4">Coletamos e tratamos dados pessoais somente quando temos uma base legal que autorize o tratamento, conforme a LGPD:</p>

            <div className="overflow-x-auto mb-6">
                <table className="min-w-full border border-gray-300">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Finalidade</th>
                            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Descrição</th>
                            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Base legal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border border-gray-300 px-4 py-2">Processamento de compras</td>
                            <td className="border border-gray-300 px-4 py-2">Registrar pedidos, processar pagamentos, emitir notas fiscais, organizar entrega e eventuais trocas ou devoluções</td>
                            <td className="border border-gray-300 px-4 py-2">Execução de contrato (Art. 7º, V da LGPD)</td>
                        </tr>
                        <tr>
                            <td className="border border-gray-300 px-4 py-2">Atendimento ao cliente</td>
                            <td className="border border-gray-300 px-4 py-2">Responder dúvidas, solicitações e reclamações por e‑mail, telefone ou chat</td>
                            <td className="border border-gray-300 px-4 py-2">Legítimo interesse (Art. 7º, IX)</td>
                        </tr>
                        <tr>
                            <td className="border border-gray-300 px-4 py-2">Envio de marketing</td>
                            <td className="border border-gray-300 px-4 py-2">Enviar ofertas, novidades e promoções via e‑mail ou mensagem de texto</td>
                            <td className="border border-gray-300 px-4 py-2">Consentimento (Art. 7º, I); você pode revogá‑lo a qualquer momento</td>
                        </tr>
                        <tr>
                            <td className="border border-gray-300 px-4 py-2">Personalização e experiência</td>
                            <td className="border border-gray-300 px-4 py-2">Personalizar navegação, lembrar preferências, recomendar produtos</td>
                            <td className="border border-gray-300 px-4 py-2">Consentimento (cookies) ou legítimo interesse quando não impactar direitos dos titulares</td>
                        </tr>
                        <tr>
                            <td className="border border-gray-300 px-4 py-2">Cumprimento de obrigações legais</td>
                            <td className="border border-gray-300 px-4 py-2">Atender exigências fiscais e regulatórias, responder a solicitações de autoridades</td>
                            <td className="border border-gray-300 px-4 py-2">Obrigação legal (Art. 7º, II)</td>
                        </tr>
                        <tr>
                            <td className="border border-gray-300 px-4 py-2">Prevenção a fraudes e segurança</td>
                            <td className="border border-gray-300 px-4 py-2">Verificar pedidos suspeitos, detectar atividades irregulares, proteger direitos de titulares e da empresa</td>
                            <td className="border border-gray-300 px-4 py-2">Legítimo interesse</td>
                        </tr>
                        <tr>
                            <td className="border border-gray-300 px-4 py-2">Análises e melhorias</td>
                            <td className="border border-gray-300 px-4 py-2">Realizar pesquisas, estatísticas e análises para melhorar nossos produtos e serviços</td>
                            <td className="border border-gray-300 px-4 py-2">Legítimo interesse, com dados pseudonimizados ou agregados</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <p className="mb-4">Não utilizamos dados sensíveis, nem realizamos decisões automatizadas que afetem seus direitos sem intervenção humana.</p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Com quem compartilhamos seus dados</h2>
            <p className="mb-4">Compartilhamos dados pessoais apenas quando necessário e para as finalidades descritas acima:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Marketplaces e processadores de pagamento:</strong> ao comprar em plataformas como Amazon, Mercado Livre e Shopee, seus dados são processados pelos próprios marketplaces. Nós recebemos apenas o necessário para atender seu pedido. Para pagamentos feitos diretamente no Site, utilizamos intermediadores (por exemplo, gateways de pagamento), que tratam os dados de cartão de forma segura e em conformidade com a LGPD.</li>
                <li><strong>Prestadores de serviços:</strong> empresas de logística, correios, serviços de hospedagem de site, provedores de e‑mail marketing, serviços de análise e suporte de TI. Exigimos que essas empresas tratem os dados conforme esta Política e a legislação aplicável.</li>
                <li><strong>Autoridades públicas:</strong> podemos compartilhar dados para cumprir obrigações legais ou ordens judiciais.</li>
                <li><strong>Reorganizações societárias:</strong> em caso de fusão, aquisição ou venda de ativos, seus dados poderão ser transferidos, observando a continuidade das práticas de privacidade.</li>
                <li><strong>Com seu consentimento:</strong> quando você autoriza expressamente o compartilhamento, por exemplo, ao integrar o login com redes sociais ou participar de promoções em conjunto com outras empresas.</li>
            </ul>
            <p className="mb-4">Não comercializamos dados pessoais para terceiros.</p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Transferências internacionais</h2>
            <p className="mb-4">
                Alguns de nossos prestadores de serviços podem estar localizados fora do Brasil. Quando houver transferência internacional de dados, adotaremos medidas técnicas e contratuais para garantir a proteção adequada, como cláusulas contratuais padrão aprovadas pela ANPD. Caso você adquira produtos por marketplaces estrangeiros, verifique também as políticas de privacidade das respectivas plataformas.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Cookies e tecnologias semelhantes</h2>
            <p className="mb-2">Utilizamos cookies e tecnologias de rastreamento para:</p>
            <ul className="list-disc pl-6 mb-4">
                <li>Garantir o funcionamento e a segurança do Site;</li>
                <li>Lembrar suas preferências e facilitar o login;</li>
                <li>Analisar o tráfego e compreender como os serviços são utilizados;</li>
                <li>Exibir publicidade de forma personalizada, somente com seu consentimento.</li>
            </ul>
            <p className="mb-4">
                Ao acessar nosso Site pela primeira vez, você poderá gerenciar suas preferências de cookies. A qualquer momento, é possível alterar essas escolhas nas configurações do navegador; contudo, algumas funcionalidades podem deixar de funcionar corretamente.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Direitos do titular de dados</h2>
            <p className="mb-4">
                Você tem direitos previstos nos artigos 18 e 20 da LGPD, que podem ser exercidos a qualquer momento mediante solicitação ao nosso canal de atendimento (<a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a>):
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e ter acesso a eles.</li>
                <li><strong>Correção:</strong> solicitar a correção de dados incompletos, inexatos ou desatualizados.</li>
                <li><strong>Anonimização, bloqueio ou eliminação:</strong> de dados desnecessários, excessivos ou tratados em desconformidade.</li>
                <li><strong>Portabilidade:</strong> solicitar a transferência dos seus dados a outro fornecedor de serviço ou produto.</li>
                <li><strong>Eliminação de dados tratados com consentimento:</strong> quando aplicável, exceto quando a lei permitir ou exigir a manutenção.</li>
                <li><strong>Informação sobre compartilhamento:</strong> saber com quais entidades públicas e privadas compartilhamos seus dados.</li>
                <li><strong>Oposição:</strong> opor‑se a tratamentos realizados com base em legítimo interesse, quando houver descumprimento da lei.</li>
                <li><strong>Revogação do consentimento:</strong> cancelar a autorização para tratarmos seus dados para finalidades específicas (por exemplo, marketing).</li>
            </ul>
            <p className="mb-4">
                Responderemos às solicitações no prazo legal, podendo solicitar comprovação de identidade para garantir a segurança do processo.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Segurança e retenção de dados</h2>
            <p className="mb-4">
                Adotamos medidas técnicas e administrativas de segurança para proteger os dados pessoais contra acesso não autorizado, perda, destruição ou alteração. Isso inclui controle de acesso, criptografia de dados sensíveis, uso de servidor seguro (HTTPS) e treinamento de colaboradores. Contudo, nenhum sistema é 100 % infalível. Caso identifique ou suspeite de qualquer incidente de segurança, entre em contato imediatamente pelo e‑mail <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a>.
            </p>
            <p className="mb-4">
                Mantemos seus dados pelo tempo necessário para cumprir as finalidades desta Política, obedecendo aos prazos legais e regulatórios (por exemplo, armazenamento de documentos fiscais). Após o término das finalidades ou do período obrigatório, os dados serão eliminados ou anonimizados.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Serviços de terceiros e links externos</h2>
            <p className="mb-4">
                Nosso Site pode conter links para páginas de terceiros (como redes sociais, blogs ou sites parceiros) e incorporar widgets ou plug‑ins (por exemplo, vídeos, botões de compartilhamento). Não somos responsáveis pelas práticas de privacidade desses terceiros. Recomendamos que você leia as políticas de privacidade de cada serviço antes de fornecer seus dados.
            </p>
            <p className="mb-4">
                Compras realizadas em marketplaces parceiros (Amazon, Mercado Livre, Shopee) obedecem às políticas de privacidade dessas plataformas. Seu relacionamento com esses marketplaces é regido pelos termos e condições e políticas que eles disponibilizam.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Menores de idade</h2>
            <p className="mb-4">
                Nossos produtos não são destinados a menores de 12 anos. Não coletamos intencionalmente dados de crianças sem o consentimento dos pais ou responsáveis. Caso identifiquemos a coleta inadvertida, procederemos à exclusão dos dados.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Atualizações desta Política</h2>
            <p className="mb-4">
                Esta Política de Privacidade pode ser atualizada a qualquer momento para refletir mudanças em nossas práticas, em requisitos legais ou em funcionalidades dos serviços. A versão mais recente estará sempre disponível em nosso Site, com a data de "Última atualização" indicada no início do documento. Se houver alterações substanciais, podemos notificá‑lo por e‑mail ou por aviso destacado no Site. O uso continuado dos nossos serviços após a atualização implica concordância com os novos termos.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Contato e encarregado</h2>
            <p className="mb-4">
                Para exercer seus direitos ou esclarecer dúvidas sobre esta Política de Privacidade ou sobre as práticas de tratamento de dados da Café Saporino, entre em contato com nosso Encarregado de Proteção de Dados (DPO):
            </p>
            <p className="mb-2"><strong>E‑mail:</strong> <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a></p>
            <p className="mb-6"><strong>Endereço:</strong> Al. Rio Negro, 503 – Sala 2005 – Alphaville Industrial, Barueri – SP, 06454‑000</p>
            <p className="mb-8">
                Responderemos às solicitações dentro de um prazo razoável e de acordo com a legislação aplicável.
            </p>

            <div className="flex justify-center mt-12 mb-8">
                <button
                    onClick={handleAccept}
                    className="px-8 py-4 bg-[#a4240e] text-white text-lg font-semibold rounded-full hover:bg-[#8a1f0c] transition-all shadow-lg"
                >
                    Li e Concordo
                </button>
            </div>
        </PolicyLayout>
    );
};

export const ShippingPolicy = () => {
    const handleAccept = () => {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.scrollTo(0, 0);
    };

    return (
        <PolicyLayout title="Política de Frete e Entrega – Café Saporino Ltda.">
            <p className="text-sm text-gray-500 mb-6"><strong>Última atualização:</strong> 19 de novembro de 2025</p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Informações Gerais</h2>
            <p className="mb-4">
                O cálculo do valor e do prazo de entrega é feito com base no CEP de destino. Insira seu CEP no carrinho ou durante o checkout para visualizar as opções e os prazos disponíveis.
            </p>
            <p className="mb-4">
                Todos os prazos informados consideram dias úteis. Pedidos realizados ou aprovados em fins de semana e feriados serão processados a partir do próximo dia útil.
            </p>
            <p className="mb-4">
                Para otimizar o envio e o custo de frete, recomenda-se agrupar todos os itens desejados em um único pedido.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Modalidades de Envio</h2>
            <p className="mb-2"><strong>Correios (PAC ou Sedex):</strong> Disponibilizamos as modalidades PAC (mais econômica, com prazo maior) e Sedex (entrega expressa) para a maioria dos endereços atendidos pelos Correios. A disponibilidade depende do CEP de entrega.</p>
            <p className="mb-2"><strong>Transportadoras parceiras:</strong> Em algumas regiões ou para pedidos de maior volume, utilizamos transportadoras privadas que oferecem prazos competitivos. Caso haja restrição de atendimento no seu endereço, você será informado no momento da cotação.</p>
            <p className="mb-4"><strong>Logística de marketplaces:</strong> Os pedidos efetuados em plataformas como Amazon, Mercado Livre e Shopee são enviados de acordo com as regras e opções de frete dessas plataformas, podendo variar conforme o vendedor e a localidade.</p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Prazos de Postagem e Rastreamento</h2>
            <p className="mb-4">
                O prazo de entrega começa a contar após a confirmação do pagamento. Para pagamentos via cartão de crédito ou pix, a confirmação é imediata; para boletos bancários, pode levar até 3 dias úteis.
            </p>
            <p className="mb-4">
                Assim que o pedido for despachado, enviaremos o código de rastreamento por e‑mail em até 48 horas úteis, permitindo que você acompanhe a encomenda.
            </p>
            <p className="mb-4">
                Caso haja algum atraso ou dificuldade na entrega, entre em contato com nosso atendimento pelo e‑mail <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a> informando o número do pedido e o código de rastreio.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Recebimento e Conferência</h2>
            <p className="mb-4">
                No ato da entrega, verifique se a embalagem está lacrada e se os itens recebidos estão de acordo com o pedido. Se houver indícios de violação ou divergência, recuse a entrega e avise nosso atendimento para que possamos tomar as providências.
            </p>
            <p className="mb-4">
                Se a entrega não puder ser concluída por ausência do destinatário ou endereço incorreto, a encomenda retornará para nós. Será possível reprogramar o envio mediante pagamento de um novo frete.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Trocas, Devoluções e Direito de Arrependimento</h2>
            <p className="mb-2"><strong>Arrependimento:</strong> você pode desistir da compra em até 7 dias corridos após o recebimento, conforme previsto no Código de Defesa do Consumidor. O produto deve ser devolvido sem sinais de uso, em perfeitas condições e na embalagem original. Solicite a devolução pelo e‑mail <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a> para receber as instruções.</p>
            <p className="mb-2"><strong>Produto divergente ou defeituoso:</strong> caso receba um item diferente do adquirido ou com defeito de fabricação, entre em contato em até 7 dias corridos após a entrega. Se o item correto não estiver disponível, você poderá escolher outro produto de igual valor ou solicitar reembolso.</p>
            <p className="mb-4"><strong>Restituição de valores:</strong> após o recebimento e a verificação do item devolvido, procederemos ao estorno ou reembolso conforme a forma de pagamento original. Para pagamentos com cartão, o estorno será solicitado junto à administradora; para boleto ou transferência, efetuaremos depósito em conta a ser informada pelo cliente.</p>

            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Observações Finais</h2>
            <p className="mb-4">
                Empenhamos todos os esforços para que os prazos de entrega sejam cumpridos. Contudo, atrasos podem ocorrer por fatores externos, como greves, restrições de transporte, condições climáticas ou problemas logísticos dos Correios e transportadoras. Caso haja qualquer imprevisto, comunicaremos você o quanto antes.
            </p>
            <p className="mb-8">
                Nosso compromisso é proporcionar uma experiência de compra segura e satisfatória. Para dúvidas adicionais sobre frete, prazos ou devoluções, contate nosso atendimento pelo e‑mail <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a>.
            </p>

            <div className="flex justify-center mt-12 mb-8">
                <button
                    onClick={handleAccept}
                    className="px-8 py-4 bg-[#a4240e] text-white text-lg font-semibold rounded-full hover:bg-[#8a1f0c] transition-all shadow-lg"
                >
                    Li e Concordo
                </button>
            </div>
        </PolicyLayout>
    );
};

export const RefundPolicy = () => (
    <PolicyLayout title="Política de Reembolso">
        <p>Nossa política de devolução e reembolso...</p>
        <p>Em construção...</p>
    </PolicyLayout>
);

export const TermsOfService = () => (
    <PolicyLayout title="Termos de Serviço">
        <p>Termos e condições de uso do site...</p>
        <p>Em construção...</p>
    </PolicyLayout>
);

export const CookiePolicy = () => (
    <PolicyLayout title="Política de Cookies – Café Saporino Ltda.">
        <p className="text-sm text-gray-500 mb-6"><strong>Última atualização:</strong> 19 de novembro de 2025</p>

        <p className="mb-4">A presente Política de Cookies explica como a Café Saporino Ltda., inscrita no CNPJ nº 61.109.694/0001-94, utiliza cookies e tecnologias semelhantes em seu site.</p>
        <p className="mb-6">Ao acessar e utilizar nossos serviços, você concorda com o uso de cookies conforme descrito nesta política, observadas as configurações escolhidas por você em seu navegador ou em nosso sistema de gerenciamento de consentimento.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. O que são cookies</h2>
        <p className="mb-4">Cookies são pequenos arquivos de texto armazenados em seu dispositivo quando você visita um site. Esses arquivos permitem que determinadas informações sejam lembradas durante sua navegação, contribuindo para melhorar a experiência do usuário, aumentar a segurança e possibilitar análises estatísticas sobre o uso do site.</p>
        <p className="mb-4">Os cookies não danificam seu dispositivo e ajudam a tornar a navegação mais eficiente.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Por que utilizamos cookies</h2>
        <p className="mb-2">A Café Saporino utiliza cookies para:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>permitir o funcionamento adequado do site;</li>
            <li>manter sessões de login;</li>
            <li>armazenar preferências de navegação;</li>
            <li>lembrar itens adicionados ao carrinho;</li>
            <li>melhorar a experiência do usuário;</li>
            <li>medir desempenho e tráfego;</li>
            <li>analisar comportamento de navegação;</li>
            <li>personalizar conteúdos;</li>
            <li>exibir anúncios mais relevantes;</li>
            <li>realizar campanhas de marketing e remarketing;</li>
            <li>prevenir fraudes e aumentar a segurança.</li>
        </ul>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Tipos de cookies utilizados</h2>
        <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Cookies necessários</h3>
        <p className="mb-2">Essenciais para o funcionamento do site. Sem eles, algumas funcionalidades podem não operar corretamente. Exemplos: autenticação de usuários, segurança, carrinho de compras e processamento de pedidos. Esses cookies não podem ser desativados pelos sistemas do site.</p>
        <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Cookies de desempenho e análise</h3>
        <p className="mb-2">Permitem compreender como os visitantes utilizam o site, para análise estatística, melhoria de conteúdo e navegação, e identificação de erros. Podemos utilizar ferramentas como Google Analytics, Google Tag Manager ou equivalentes.</p>
        <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Cookies de funcionalidade</h3>
        <p className="mb-2">Permitem memorizar escolhas do usuário, como idioma, região, preferências de navegação e configurações personalizadas.</p>
        <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Cookies de marketing e publicidade</h3>
        <p className="mb-4">Utilizados para exibir anúncios mais relevantes. Podem ser usados por parceiros para remarketing, personalização de anúncios, medição de conversões e segmentação de público. Podemos utilizar plataformas como Google Ads, Meta Ads (Facebook e Instagram), TikTok Ads e outras ferramentas de marketing digital.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Cookies de terceiros</h2>
        <p className="mb-4">Alguns cookies podem ser instalados por serviços de terceiros utilizados pela Café Saporino. Esses terceiros possuem suas próprias políticas de privacidade e cookies. A Café Saporino não controla diretamente a forma como terceiros tratam os dados coletados por seus próprios cookies. Recomendamos a leitura das respectivas políticas dos fornecedores utilizados.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Gerenciamento dos cookies</h2>
        <p className="mb-2">O usuário pode controlar ou excluir cookies diretamente nas configurações de seu navegador. A maioria dos navegadores permite:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>visualizar cookies armazenados;</li>
            <li>excluir cookies existentes;</li>
            <li>bloquear cookies futuros;</li>
            <li>definir preferências específicas para determinados sites.</li>
        </ul>
        <p className="mb-4">A desativação de determinados cookies poderá afetar funcionalidades do site.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Consentimento</h2>
        <p className="mb-4">Quando exigido pela legislação aplicável, especialmente pela Lei Geral de Proteção de Dados (LGPD), a Café Saporino solicitará o consentimento do usuário antes da instalação de determinados tipos de cookies. O consentimento poderá ser alterado ou revogado a qualquer momento por meio das configurações disponíveis no site ou no navegador utilizado.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Proteção de dados</h2>
        <p className="mb-2">As informações eventualmente coletadas por meio de cookies serão tratadas de acordo com nossa Política de Privacidade e com a legislação brasileira aplicável, observando os princípios de finalidade, necessidade, transparência, segurança, adequação e livre acesso.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Alterações desta política</h2>
        <p className="mb-4">A Café Saporino poderá atualizar esta Política de Cookies a qualquer momento para refletir alterações legais, operacionais ou tecnológicas. A versão vigente estará sempre disponível em nosso site.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Contato</h2>
        <p className="mb-1"><strong>Café Saporino Ltda.</strong> — CNPJ: 61.109.694/0001-94</p>
        <p className="mb-1">Al. Rio Negro, 503 – Sala 2005 – Alphaville Industrial – Barueri/SP – CEP 06454-000</p>
        <p className="mb-4">E-mail: <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a></p>
        <p className="text-sm text-gray-500 italic">Café Saporino — O Verdadeiro Sabor de Minas®</p>
    </PolicyLayout>
);

export const SubscriptionPolicy = () => (
    <PolicyLayout title="Política de Assinatura – Café Saporino Ltda.">
        <p className="text-sm text-gray-500 mb-6"><strong>Última atualização:</strong> 19 de novembro de 2025</p>

        <p className="mb-4">A presente Política de Assinatura estabelece as condições aplicáveis aos planos de assinatura oferecidos pela Café Saporino Ltda., inscrita no CNPJ nº 61.109.694/0001-94, com sede na Al. Rio Negro, 503 – Sala 2005 – Alphaville Industrial – Barueri/SP – CEP 06454-000.</p>
        <p className="mb-6">Ao contratar qualquer plano de assinatura da Café Saporino, o cliente declara estar ciente e de acordo com todos os termos descritos nesta política.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Sobre a Assinatura Café Saporino</h2>
        <p className="mb-4">A Assinatura Café Saporino foi criada para proporcionar praticidade, economia e comodidade aos consumidores que desejam receber regularmente os cafés da marca sem a necessidade de realizar novos pedidos a cada compra.</p>
        <p className="mb-4">A assinatura permite que o cliente receba cafés selecionados de forma recorrente, com benefícios exclusivos de acordo com o plano escolhido.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Planos disponíveis</h2>
        <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Plano Mensal</h3>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Desconto de 5% sobre os produtos elegíveis da assinatura;</li>
            <li>Sem fidelidade;</li>
            <li>Cancelamento a qualquer momento;</li>
            <li>Frete cobrado normalmente conforme a região de entrega.</li>
        </ul>
        <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Plano Semestral (6 Meses)</h3>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Desconto de 7% durante toda a vigência do plano;</li>
            <li>Frete grátis durante todo o período contratado;</li>
            <li>Fidelidade de 6 meses;</li>
            <li>Recebimento de 1 (um) Café Gourmet Edição Limitada de 250g como brinde de boas-vindas.</li>
        </ul>
        <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Plano Anual (12 Meses)</h3>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Desconto de 12% durante toda a vigência do plano;</li>
            <li>Frete grátis durante todo o período contratado;</li>
            <li>Fidelidade de 12 meses;</li>
            <li>Recebimento de 1 (um) Café Especial de 250g na adesão;</li>
            <li>Recebimento de 1 (um) Café Especial de 250g após completar 6 meses de assinatura ativa.</li>
        </ul>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Cobrança recorrente</h2>
        <p className="mb-4">As assinaturas funcionam por meio de cobrança recorrente automática. Ao aderir a qualquer plano, o assinante autoriza a Café Saporino a realizar as cobranças periódicas no método de pagamento cadastrado.</p>
        <p className="mb-4">É responsabilidade do cliente manter os dados de pagamento atualizados durante toda a vigência da assinatura. A não aprovação da cobrança poderá resultar na suspensão ou cancelamento da assinatura.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Frete das assinaturas</h2>
        <p className="mb-2"><strong>Plano Mensal:</strong> o frete será calculado normalmente conforme o CEP de entrega e a modalidade escolhida pelo cliente.</p>
        <p className="mb-2"><strong>Plano Semestral (6 Meses):</strong> frete gratuito durante toda a vigência da assinatura.</p>
        <p className="mb-4"><strong>Plano Anual (12 Meses):</strong> frete gratuito durante toda a vigência da assinatura.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Brindes e benefícios promocionais</h2>
        <p className="mb-2">Os brindes oferecidos pela Café Saporino são benefícios promocionais concedidos exclusivamente aos assinantes dos planos elegíveis. Os brindes:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>não possuem valor de revenda;</li>
            <li>não poderão ser convertidos em dinheiro;</li>
            <li>não poderão ser trocados por outros produtos;</li>
            <li>poderão ser substituídos por itens equivalentes em caso de indisponibilidade.</li>
        </ul>
        <p className="mb-4">A Café Saporino reserva-se o direito de alterar brindes futuros sem aviso prévio, respeitando os benefícios já prometidos aos assinantes ativos.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Cancelamento</h2>
        <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Plano Mensal</h3>
        <p className="mb-4">O assinante poderá cancelar sua assinatura a qualquer momento. O cancelamento impedirá apenas futuras cobranças, não afetando pedidos já faturados, processados ou enviados.</p>
        <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Plano Semestral (6 Meses) e Plano Anual (12 Meses)</h3>
        <p className="mb-2">Os planos de fidelidade possuem descontos, frete promocional e brindes concedidos em razão do compromisso assumido pelo assinante durante todo o período contratado. Em caso de cancelamento antecipado por iniciativa do assinante:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>a assinatura será encerrada;</li>
            <li>os benefícios promocionais poderão ser perdidos;</li>
            <li>os descontos concedidos poderão ser recalculados;</li>
            <li>o frete promocional poderá ser recalculado;</li>
            <li>os brindes recebidos poderão ser considerados no recálculo dos benefícios concedidos.</li>
        </ul>
        <p className="mb-4">A Café Saporino poderá cobrar do assinante a diferença correspondente aos valores efetivamente economizados até a data do cancelamento.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Alteração de dados cadastrais</h2>
        <p className="mb-2">O assinante é responsável por manter sempre atualizados: nome, endereço, telefone, e-mail e informações de pagamento.</p>
        <p className="mb-4">A Café Saporino não se responsabiliza por atrasos, falhas de entrega ou cobranças recusadas decorrentes de informações incorretas fornecidas pelo assinante.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Alteração de preços</h2>
        <p className="mb-4">A Café Saporino poderá revisar os valores dos planos de assinatura a qualquer momento. Alterações futuras não afetarão pedidos já faturados. Quando aplicável, os assinantes serão comunicados previamente sobre reajustes aplicáveis às próximas renovações.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Indisponibilidade de produtos</h2>
        <p className="mb-2">Em situações excepcionais de indisponibilidade de determinado café, lote ou edição especial, a Café Saporino poderá:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>substituir o produto por item equivalente;</li>
            <li>disponibilizar opção semelhante;</li>
            <li>oferecer crédito correspondente;</li>
            <li>entrar em contato para alinhamento da entrega.</li>
        </ul>
        <p className="mb-4">Sempre que possível, a substituição buscará manter características semelhantes de qualidade e categoria.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Suspensão ou cancelamento por fraude</h2>
        <p className="mb-2">A Café Saporino poderá suspender ou cancelar assinaturas quando houver indícios de:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>fraude;</li>
            <li>informações falsas;</li>
            <li>uso indevido dos benefícios da assinatura;</li>
            <li>tentativa de obtenção indevida de descontos ou brindes;</li>
            <li>violação dos Termos de Serviço.</li>
        </ul>
        <p className="mb-4">Nesses casos, a empresa poderá adotar as medidas administrativas e legais cabíveis.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Marketplaces</h2>
        <p className="mb-4">A assinatura Café Saporino é válida exclusivamente nos canais em que essa modalidade estiver disponível. Compras realizadas através de marketplaces como Amazon, Mercado Livre, Shopee, TikTok Shop ou outras plataformas parceiras poderão seguir regras específicas da respectiva plataforma.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Alterações desta política</h2>
        <p className="mb-4">A Café Saporino poderá atualizar esta Política de Assinatura a qualquer momento para refletir alterações operacionais, comerciais ou legais. A versão vigente estará sempre disponível em seus canais oficiais.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Contato</h2>
        <p className="mb-2">Em caso de dúvidas relacionadas à assinatura:</p>
        <p className="mb-1"><strong>Café Saporino Ltda.</strong> — CNPJ: 61.109.694/0001-94</p>
        <p className="mb-1">Al. Rio Negro, 503 – Sala 2005 – Alphaville Industrial – Barueri/SP – CEP 06454-000</p>
        <p className="mb-4">E-mail: <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a></p>
        <p className="text-sm text-gray-500 italic">Café Saporino — O Verdadeiro Sabor de Minas®</p>
    </PolicyLayout>
);

export const BusinessPage = () => (
    <PolicyLayout title="Para Seu Negócio">
        <p>Soluções corporativas do Café Saporino...</p>
        <p>Entre em contato conosco para saber mais sobre fornecimento para empresas.</p>
    </PolicyLayout>
);
