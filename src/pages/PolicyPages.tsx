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

export const ShippingPolicy = () => (
    <PolicyLayout title="Política de Frete e Entrega – Café Saporino Ltda.">
        <p className="text-sm text-gray-500 mb-6"><strong>Última atualização:</strong> 19 de novembro de 2025</p>

        <p className="mb-4">A Café Saporino Ltda. busca oferecer transparência e segurança em todas as etapas do processo de compra. Esta Política de Frete e Entrega estabelece as condições aplicáveis às entregas realizadas por meio do site oficial, assinaturas e demais canais de venda da empresa.</p>
        <p className="mb-6">Ao realizar uma compra, o cliente declara estar ciente e de acordo com as condições abaixo.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Identificação da empresa</h2>
        <p className="mb-1"><strong>Razão Social:</strong> Café Saporino Ltda. — <strong>CNPJ:</strong> 61.109.694/0001-94</p>
        <p className="mb-1">Al. Rio Negro, 503 – Sala 2005 – Alphaville Industrial – Barueri/SP – CEP 06454-000</p>
        <p className="mb-4">E-mail: <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a></p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Área de atendimento</h2>
        <p className="mb-2">A Café Saporino realiza entregas para todo o território nacional, sujeitas à disponibilidade das transportadoras e operadores logísticos parceiros. Algumas localidades poderão possuir restrições operacionais, prazos diferenciados ou indisponibilidade temporária de entrega.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Formas de entrega</h2>
        <p className="mb-2">As entregas poderão ser realizadas por empresas parceiras, incluindo, mas não se limitando a: Correios, Jadlog, Total Express, BBM Logística, BBM E-Commerce, transportadoras regionais e outras transportadoras contratadas pela Café Saporino. A escolha da modalidade de entrega será disponibilizada durante o checkout, quando aplicável. A disponibilidade de cada transportadora poderá variar conforme a região atendida.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Prazo de processamento dos pedidos</h2>
        <p className="mb-2">Após a confirmação do pagamento, o pedido passará pelas etapas de aprovação financeira, validação antifraude (quando aplicável), separação, faturamento e expedição. O prazo de entrega informado ao cliente começa a contar após a conclusão dessas etapas.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Prazos de entrega</h2>
        <p className="mb-2">Os prazos informados durante a compra são estimativas fornecidas pelas transportadoras e poderão sofrer alterações em razão de fatores externos, como condições climáticas, greves, acidentes, restrições logísticas, períodos de alta demanda, eventos de força maior e problemas operacionais das transportadoras. A Café Saporino não poderá ser responsabilizada por atrasos decorrentes de situações fora de seu controle razoável.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Frete grátis</h2>
        <p className="mb-2">A Café Saporino poderá oferecer campanhas promocionais de frete grátis. Atualmente, pedidos com peso total igual ou superior a 5 kg possuem frete grátis para todo o Brasil através do site oficial, conforme disponibilidade logística.</p>
        <p className="mb-4">As condições promocionais poderão ser alteradas, suspensas ou encerradas sem aviso prévio. As promoções vigentes serão sempre aquelas apresentadas no momento da compra.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Frete nas assinaturas</h2>
        <p className="mb-2"><strong>Plano Mensal:</strong> o frete será cobrado normalmente conforme a região e modalidade escolhida.</p>
        <p className="mb-2"><strong>Plano Semestral:</strong> frete grátis durante toda a vigência da assinatura.</p>
        <p className="mb-2"><strong>Plano Anual:</strong> frete grátis durante toda a vigência da assinatura.</p>
        <p className="mb-4">As condições completas encontram-se detalhadas na Política de Assinatura.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Marketplaces</h2>
        <p className="mb-2">Compras realizadas através de marketplaces poderão seguir regras próprias de frete definidas por cada plataforma, entre elas Amazon, Mercado Livre, Shopee e TikTok Shop. Os valores, prazos e condições de frete apresentados nesses canais poderão ser diferentes daqueles praticados no site oficial da Café Saporino.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Responsabilidade do cliente</h2>
        <p className="mb-2">O cliente é responsável por fornecer corretamente nome do destinatário, endereço completo, CEP, complementos e telefone para contato. A Café Saporino não se responsabiliza por atrasos ou falhas de entrega decorrentes de informações incorretas fornecidas pelo comprador.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Tentativas de entrega</h2>
        <p className="mb-2">As transportadoras poderão realizar tentativas de entrega conforme seus procedimentos internos. Caso a entrega não seja concluída por ausência do destinatário, endereço incorreto ou incompleto, recusa injustificada ou impossibilidade de acesso, o pedido poderá retornar ao remetente. Nesses casos, um novo frete poderá ser cobrado para reenvio.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Conferência do pedido</h2>
        <p className="mb-2">No momento do recebimento, recomendamos que o cliente verifique a integridade da embalagem, a quantidade recebida e as condições aparentes dos produtos. Caso seja identificada qualquer irregularidade, o cliente deverá comunicar imediatamente a Café Saporino através do e-mail <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a>.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Extravios e avarias</h2>
        <p className="mb-2">Caso o pedido seja extraviado ou sofra danos durante o transporte, a Café Saporino realizará a análise da ocorrência junto à transportadora. Confirmada a responsabilidade logística, a empresa poderá reenviar os produtos, disponibilizar crédito ou efetuar o reembolso do valor pago.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Devoluções e frete</h2>
        <p className="mb-2">As regras para devoluções e reembolsos seguem a Política de Trocas, Devoluções e Reembolsos da Café Saporino. Nos casos previstos em lei, os custos de devolução serão tratados conforme a legislação aplicável.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">14. Alterações desta política</h2>
        <p className="mb-4">A Café Saporino poderá atualizar esta Política de Frete e Entrega a qualquer momento para refletir alterações operacionais, comerciais ou legais. A versão vigente estará sempre disponível em seus canais oficiais.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">15. Contato</h2>
        <p className="mb-1"><strong>Café Saporino Ltda.</strong> — CNPJ: 61.109.694/0001-94</p>
        <p className="mb-1">Al. Rio Negro, 503 – Sala 2005 – Alphaville Industrial – Barueri/SP – CEP 06454-000</p>
        <p className="mb-4">E-mail: <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a></p>
        <p className="text-sm text-gray-500 italic">Café Saporino — O Verdadeiro Sabor de Minas®</p>
    </PolicyLayout>
);

export const RefundPolicy = () => (
    <PolicyLayout title="Política de Trocas, Devoluções e Reembolsos – Café Saporino Ltda.">
        <p className="text-sm text-gray-500 mb-6"><strong>Última atualização:</strong> 19 de novembro de 2025</p>

        <p className="mb-4">A Café Saporino Ltda. busca garantir a satisfação de seus clientes e, por isso, adota esta Política de Trocas, Devoluções e Reembolsos em conformidade com o Código de Defesa do Consumidor.</p>
        <p className="mb-6">Ao realizar uma compra em nossos canais oficiais, o cliente declara estar ciente e de acordo com as condições abaixo.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Orientações importantes</h2>
        <p className="mb-2">Antes de solicitar qualquer troca ou devolução, recomendamos que o cliente:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>confira o produto no momento do recebimento;</li>
            <li>verifique se a embalagem está íntegra;</li>
            <li>confirme se o item recebido corresponde ao pedido realizado;</li>
            <li>preserve a nota fiscal;</li>
            <li>mantenha a embalagem original.</li>
        </ul>
        <p className="mb-4">Toda solicitação deverá ser realizada através do e-mail <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a>.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Direito de arrependimento</h2>
        <p className="mb-2">Nos termos do artigo 49 do Código de Defesa do Consumidor, o cliente poderá desistir da compra realizada pela internet no prazo de até 7 (sete) dias corridos contados do recebimento do produto. Para que a devolução seja aceita:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>o produto deverá estar sem uso;</li>
            <li>deverá permanecer lacrado quando aplicável;</li>
            <li>deverá ser devolvido com a embalagem original;</li>
            <li>deverá estar acompanhado da nota fiscal.</li>
        </ul>
        <p className="mb-4">Após o recebimento e análise do produto, o reembolso será processado conforme a forma de pagamento utilizada.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Produtos alimentícios</h2>
        <p className="mb-2">Por se tratar de produto alimentício, não será aceita devolução por arrependimento quando:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>a embalagem estiver aberta;</li>
            <li>o lacre estiver rompido;</li>
            <li>houver sinais de consumo;</li>
            <li>o produto tiver sido armazenado inadequadamente após o recebimento.</li>
        </ul>
        <p className="mb-4">Essa restrição não se aplica aos casos de defeito, vício de qualidade ou divergência comprovada do produto.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Produto recebido em desacordo com o pedido</h2>
        <p className="mb-2">Caso o cliente receba produto diferente daquele adquirido, deverá comunicar a Café Saporino em até 7 (sete) dias corridos após o recebimento. Após análise da ocorrência, a empresa poderá:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>providenciar a substituição;</li>
            <li>realizar o reembolso;</li>
            <li>disponibilizar crédito para nova compra.</li>
        </ul>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Produto com avaria ou defeito</h2>
        <p className="mb-2">Se o produto apresentar defeito de fabricação, avaria ou problema de qualidade, o cliente deverá comunicar a Café Saporino o mais rápido possível. Poderão ser solicitadas fotografias, vídeos, número do lote e informações complementares. Após análise, a Café Saporino poderá:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>substituir o produto;</li>
            <li>reembolsar o valor pago;</li>
            <li>gerar crédito para nova compra.</li>
        </ul>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Análise da devolução</h2>
        <p className="mb-2">Todo produto devolvido passará por avaliação interna. Caso seja constatado uso indevido, consumo parcial, ausência de embalagem, violação do produto ou danos causados após o recebimento, a devolução poderá ser recusada.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Reembolsos</h2>
        <p className="mb-2"><strong>Cartão de crédito:</strong> o estorno será solicitado à administradora do cartão. O prazo dependerá exclusivamente da operadora e do banco emissor, podendo aparecer em até duas faturas subsequentes.</p>
        <p className="mb-2"><strong>PIX:</strong> o reembolso será realizado para conta de mesma titularidade do comprador.</p>
        <p className="mb-4"><strong>Boleto bancário:</strong> o reembolso será realizado mediante transferência bancária para conta de mesma titularidade do comprador.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Vale-compra</h2>
        <p className="mb-2">Em situações específicas, a Café Saporino poderá disponibilizar crédito para utilização em futuras compras, com validade informada no momento da emissão. O vale-compra é pessoal e intransferível, não poderá ser convertido em dinheiro (salvo quando exigido por lei) e somente poderá ser utilizado nos canais oficiais da Café Saporino.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Pedidos com frete grátis</h2>
        <p className="mb-4">Quando o pedido tiver recebido benefício de frete grátis em razão de campanhas promocionais ou regras de elegibilidade e ocorrer devolução parcial dos produtos, a Café Saporino poderá recalcular o benefício concedido. Caso a devolução faça com que o pedido deixe de atender aos requisitos da promoção, o valor correspondente ao frete originalmente subsidiado poderá ser descontado do valor a ser reembolsado, observada a legislação aplicável.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Devoluções por endereço incorreto ou ausência</h2>
        <p className="mb-2">Caso a encomenda retorne por endereço incorreto informado pelo cliente, destinatário desconhecido, mudança de endereço, ausência repetida do destinatário ou não retirada da encomenda quando exigido pela transportadora, o custo de novo envio poderá ser cobrado do cliente.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Compras em marketplaces</h2>
        <p className="mb-4">Compras realizadas através de Amazon, Mercado Livre, Shopee, TikTok Shop ou outras plataformas parceiras também poderão estar sujeitas às políticas de devolução, mediação, reembolso e proteção ao comprador da respectiva plataforma. Quando houver conflito entre procedimentos, poderão prevalecer as regras obrigatórias da plataforma utilizada para a compra.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Produtos não elegíveis para troca por preferência pessoal</h2>
        <p className="mb-2">Após abertura da embalagem ou consumo do produto, não serão aceitas solicitações de troca ou devolução motivadas exclusivamente por preferência de sabor, intensidade, aroma, torra ou expectativa subjetiva do consumidor. Essa restrição não afeta os direitos legais do consumidor nos casos de defeito, vício ou erro de envio.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Prazo de análise</h2>
        <p className="mb-4">Após o recebimento do produto devolvido, a Café Saporino poderá realizar análise técnica para validação da solicitação. O prazo médio de análise poderá ser de até 10 (dez) dias úteis, sem prejuízo de prazos menores quando possível.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">14. Contato</h2>
        <p className="mb-1"><strong>Café Saporino Ltda.</strong> — CNPJ: 61.109.694/0001-94</p>
        <p className="mb-1">Al. Rio Negro, 503 – Sala 2005 – Alphaville Industrial – Barueri/SP – CEP 06454-000</p>
        <p className="mb-4">E-mail: <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a></p>
        <p className="text-sm text-gray-500 italic">Café Saporino — O Verdadeiro Sabor de Minas®</p>
    </PolicyLayout>
);

export const TermsOfService = () => (
    <PolicyLayout title="Termos de Serviço – Café Saporino Ltda.">
        <p className="text-sm text-gray-500 mb-6"><strong>Última atualização:</strong> 19 de novembro de 2025</p>

        <p className="mb-4">Bem-vindo ao site da Café Saporino Ltda. Ao acessar, navegar, cadastrar-se, realizar compras ou utilizar qualquer funcionalidade disponibilizada pela Café Saporino, o usuário declara que leu, compreendeu e concorda integralmente com estes Termos de Serviço.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Identificação da empresa</h2>
        <p className="mb-1"><strong>Razão Social:</strong> Café Saporino Ltda. — <strong>CNPJ:</strong> 61.109.694/0001-94</p>
        <p className="mb-1">Al. Rio Negro, 503 – Sala 2005 – Alphaville Industrial – Barueri/SP – CEP 06454-000</p>
        <p className="mb-4">E-mail: <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a></p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Objeto</h2>
        <p className="mb-2">Os presentes Termos regulam o acesso e utilização dos serviços disponibilizados pela Café Saporino através de: site oficial, loja virtual, programas de assinatura, canais de atendimento, marketplaces parceiros e aplicativos ou plataformas eventualmente utilizados pela empresa.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Aceitação dos termos</h2>
        <p className="mb-2">Ao utilizar qualquer serviço da Café Saporino, o usuário declara que possui capacidade civil para contratar, fornecerá informações verdadeiras e atualizadas, utilizará os serviços de forma lícita, respeitará a legislação aplicável e concorda com as políticas publicadas pela empresa.</p>
        <p className="mb-4">Caso o usuário não concorde com estes Termos, deverá interromper imediatamente a utilização do site e dos serviços.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Cadastro de clientes</h2>
        <p className="mb-2">Algumas funcionalidades poderão exigir cadastro. O cliente compromete-se a fornecer informações verdadeiras, completas e atualizadas. A Café Saporino poderá solicitar documentos para validação, realizar verificações cadastrais, suspender cadastros com informações inconsistentes e cancelar pedidos considerados suspeitos. O usuário é responsável pela confidencialidade de sua senha e dados de acesso.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Produtos e serviços</h2>
        <p className="mb-2">A Café Saporino comercializa produtos relacionados ao universo do café, incluindo cafés torrados e moídos, em grãos, gourmet, especiais e edição limitada, kits promocionais, programas de assinatura, xícaras, canecas, coadores, filtros e acessórios para preparo de café. A disponibilidade dos produtos poderá variar sem aviso prévio.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Preços</h2>
        <p className="mb-2">Todos os preços apresentados estão sujeitos a alteração sem aviso prévio. O valor válido para a compra será aquele exibido no momento da conclusão do pedido. Promoções poderão possuir regras específicas de participação e validade.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Formas de pagamento</h2>
        <p className="mb-2">Os pagamentos poderão ser realizados através dos meios disponibilizados durante o checkout, podendo incluir cartão de crédito, PIX, boleto bancário, carteiras digitais e outros meios disponibilizados futuramente. A aprovação da compra depende da validação do pagamento pelos respectivos processadores financeiros.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Análise antifraude</h2>
        <p className="mb-2">Para proteção dos consumidores e da própria empresa, os pedidos poderão ser submetidos a sistemas de análise de risco e prevenção à fraude. A Café Saporino poderá solicitar documentos adicionais, confirmar dados cadastrais, validar endereço, verificar titularidade do pagamento e cancelar pedidos suspeitos. A recusa de aprovação por mecanismos antifraude não gera obrigação de venda por parte da empresa.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Entrega dos produtos</h2>
        <p className="mb-2">As entregas serão realizadas por transportadoras parceiras ou pelos Correios (como Correios, Jadlog, Total Express, BBM Logística, BBM E-Commerce e outras). Os prazos informados são estimativas e passam a contar após a confirmação do pagamento, aprovação da análise antifraude e processamento do pedido. Mais informações estão disponíveis na Política de Frete.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Assinaturas</h2>
        <p className="mb-2">A Café Saporino poderá disponibilizar programas de assinatura com benefícios exclusivos:</p>
        <ul className="list-disc pl-6 mb-2 space-y-2">
            <li><strong>Plano Mensal:</strong> desconto de 5%, sem fidelidade, cancelamento a qualquer momento.</li>
            <li><strong>Plano Semestral:</strong> desconto de 7%, fidelidade de 6 meses, frete grátis, brinde promocional conforme campanha vigente.</li>
            <li><strong>Plano Anual:</strong> desconto de 12%, fidelidade de 12 meses, frete grátis, brindes promocionais conforme campanha vigente.</li>
        </ul>
        <p className="mb-4">As condições completas estão detalhadas na Política de Assinatura.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Trocas, devoluções e reembolsos</h2>
        <p className="mb-2">As solicitações de troca, devolução ou reembolso serão tratadas conforme a Política de Trocas, Devoluções e Reembolsos da Café Saporino e de acordo com a legislação brasileira aplicável.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Propriedade intelectual</h2>
        <p className="mb-2">Todo o conteúdo disponibilizado pela Café Saporino é protegido pelas leis de propriedade intelectual, incluindo marca, logotipos, imagens, fotografias, vídeos, textos, embalagens, layouts, materiais promocionais e conteúdo institucional. É proibida a reprodução, distribuição, modificação ou utilização sem autorização prévia e expressa da empresa.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Limitação de responsabilidade</h2>
        <p className="mb-2">A Café Saporino não será responsável por falhas de internet do usuário, indisponibilidade temporária de sistemas de terceiros, interrupções causadas por força maior, erros decorrentes de informações incorretas fornecidas pelo cliente, uso inadequado dos produtos após a entrega ou danos decorrentes de armazenamento inadequado realizado pelo consumidor.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">14. Marketplaces e plataformas parceiras</h2>
        <p className="mb-2">Os produtos da Café Saporino poderão ser comercializados através do site oficial, Amazon, Mercado Livre, Shopee, TikTok Shop e outros marketplaces parceiros. Compras realizadas por essas plataformas também poderão estar sujeitas às políticas específicas de cada operador.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">15. Privacidade e proteção de dados</h2>
        <p className="mb-2">O tratamento dos dados pessoais dos usuários é realizado conforme a Política de Privacidade, a Política de Cookies e a Lei Geral de Proteção de Dados (LGPD). Ao utilizar nossos serviços, o usuário declara estar ciente dessas políticas.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">16. Comunicações</h2>
        <p className="mb-2">A Café Saporino poderá entrar em contato com o cliente através de e-mail, telefone, WhatsApp, SMS, notificações relacionadas aos pedidos, comunicações relacionadas à assinatura e comunicações necessárias para execução do contrato. As comunicações promocionais poderão ser canceladas pelo usuário quando aplicável.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">17. Alterações dos termos</h2>
        <p className="mb-2">A Café Saporino poderá atualizar estes Termos de Serviço a qualquer momento para refletir alterações legais, operacionais ou comerciais. A versão vigente estará sempre disponível em seus canais oficiais. A continuidade da utilização dos serviços após a atualização constitui aceitação dos novos termos.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">18. Legislação aplicável e foro</h2>
        <p className="mb-2">Os presentes Termos de Serviço serão interpretados de acordo com as leis da República Federativa do Brasil. Fica eleito o foro da Comarca de Barueri/SP para dirimir eventuais controvérsias decorrentes destes Termos, observadas as garantias legais do consumidor previstas na legislação brasileira.</p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">19. Contato</h2>
        <p className="mb-1"><strong>Café Saporino Ltda.</strong> — CNPJ: 61.109.694/0001-94</p>
        <p className="mb-1">Al. Rio Negro, 503 – Sala 2005 – Alphaville Industrial – Barueri/SP – CEP 06454-000</p>
        <p className="mb-4">E-mail: <a href="mailto:sac@cafesaporino.com.br" className="text-[#a4240e] hover:underline">sac@cafesaporino.com.br</a></p>
        <p className="text-sm text-gray-500 italic">Café Saporino — O Verdadeiro Sabor de Minas®</p>
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

export const CareersPage = () => (
    <PolicyLayout title="Trabalhe Conosco">
        <p className="mb-4">A Café Saporino está sempre em busca de pessoas apaixonadas por café, comprometidas com qualidade e que queiram crescer junto com a marca. Aqui, valorizamos dedicação, atitude e o verdadeiro sabor de fazer bem feito.</p>
        <p className="mb-4">Se você quer fazer parte do nosso time — em áreas como produção, logística, comercial, atendimento ou representação — envie seu currículo e conte um pouco sobre você.</p>
        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Como se candidatar</h2>
        <p className="mb-2">Envie seu currículo e a área de interesse para:</p>
        <p className="mb-4 text-lg"><a href="mailto:trabalheconosco@cafesaporino.com.br" className="text-[#a4240e] font-semibold hover:underline">trabalheconosco@cafesaporino.com.br</a></p>
        <p className="text-sm text-gray-500">Analisamos todas as candidaturas e entramos em contato com os perfis compatíveis com as vagas disponíveis.</p>
    </PolicyLayout>
);

export const PressPage = () => (
    <PolicyLayout title="Imprensa">
        <p className="mb-4">Esta é a área de imprensa da Café Saporino. Aqui, jornalistas, veículos de comunicação e criadores de conteúdo podem solicitar informações sobre a marca, entrevistas, materiais oficiais e imagens em alta resolução.</p>
        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Solicitações de imprensa</h2>
        <p className="mb-2">Para pautas, entrevistas, materiais de marca (logotipos, fotos, releases) e demais assuntos de imprensa, fale com a nossa assessoria:</p>
        <p className="mb-4 text-lg"><a href="mailto:imprensa@cafesaporino.com.br" className="text-[#a4240e] font-semibold hover:underline">imprensa@cafesaporino.com.br</a></p>
        <p className="text-sm text-gray-500">Pedimos que identifique o veículo, o assunto e o prazo da matéria para agilizarmos o atendimento.</p>
    </PolicyLayout>
);

export const PrivateLabelPage = () => (
    <PolicyLayout title="Marca Própria">
        <p className="mb-4">A Café Saporino oferece soluções de <strong>marca própria (private label)</strong>: produzimos café de qualidade com a sua marca, do grão à embalagem. Ideal para supermercados, redes, cafeterias, restaurantes, padarias e empresas que desejam ter o próprio café.</p>
        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">O que oferecemos</h2>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Café 100% Arábica selecionado, com torra e moagem conforme o perfil desejado;</li>
            <li>Embalagem personalizada com a identidade da sua marca;</li>
            <li>Padrão de qualidade e regularidade no fornecimento;</li>
            <li>Atendimento próximo para definir blend, torra, granulometria e volumes.</li>
        </ul>
        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Fale com o time de marca própria</h2>
        <p className="mb-4 text-lg"><a href="mailto:marcapropia@cafesaporino.com.br" className="text-[#a4240e] font-semibold hover:underline">marcapropia@cafesaporino.com.br</a></p>
        <p className="text-sm text-gray-500">Conte sobre o seu projeto (segmento, volume estimado e perfil de café) que retornamos com uma proposta.</p>
    </PolicyLayout>
);

export const GreenCoffeePage = () => (
    <PolicyLayout title="Café Cru (Café Verde)">
        <p className="mb-4">Além do café torrado, a Café Saporino também comercializa <strong>café cru (café verde)</strong> — grãos selecionados do Cerrado Mineiro para torrefações, cafeterias, indústrias e empresas que torram o próprio café.</p>
        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Para quem é</h2>
        <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Torrefações que buscam grãos de origem e qualidade consistente;</li>
            <li>Cafeterias e microtorrefadores;</li>
            <li>Indústrias e empresas que processam café;</li>
            <li>Quem deseja café verde por saca ou em volumes definidos.</li>
        </ul>
        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Solicite cotação de café cru</h2>
        <p className="mb-2">Informe a variedade, o volume desejado e o perfil de café que procura:</p>
        <p className="mb-4 text-lg"><a href="mailto:cafecru@cafesaporino.com.br" className="text-[#a4240e] font-semibold hover:underline">cafecru@cafesaporino.com.br</a></p>
        <p className="text-sm text-gray-500">Disponibilidade e preços conforme safra, lote e volume.</p>
    </PolicyLayout>
);

export const BusinessPage = () => (
    <PolicyLayout title="Para Seu Negócio">
        <p>Soluções corporativas do Café Saporino...</p>
        <p>Entre em contato conosco para saber mais sobre fornecimento para empresas.</p>
    </PolicyLayout>
);
