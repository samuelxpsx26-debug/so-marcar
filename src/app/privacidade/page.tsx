import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function Privacidade() {
  return (
    <LegalPage title="Política de privacidade">
      <p>O Só Marcar é uma plataforma de agendamento online para estabelecimentos como barbearias, salões, estúdios e profissionais autônomos. Esta política explica quais dados tratamos, por quê e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>

      <h2>Quem somos</h2>
      <p>O Só Marcar é o controlador dos dados das contas dos estabelecimentos. Os dados dos clientes que agendam um horário são tratados em nome do estabelecimento escolhido, que decide como usá-los no seu atendimento. Contato do encarregado: <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>

      <h2>Dados que coletamos</h2>
      <ul>
        <li><strong>Donos e equipes de estabelecimentos:</strong> nome, e-mail, foto do perfil (quando entra com Google), dados do negócio (nome, endereço, WhatsApp, horários, serviços e preços).</li>
        <li><strong>Clientes que agendam:</strong> nome, WhatsApp, e-mail (opcional), horários marcados e observações.</li>
        <li><strong>Assinatura:</strong> o pagamento da mensalidade é feito pela Stripe. Não armazenamos número de cartão; guardamos apenas identificadores e o status da assinatura.</li>
        <li><strong>Dados técnicos:</strong> registros de acesso e cookies necessários para manter você conectado.</li>
      </ul>

      <h2>Login com Google</h2>
      <p>Se você escolher entrar com Google, recebemos apenas seu nome, e-mail e foto de perfil, usados exclusivamente para criar e identificar sua conta. Não acessamos seus contatos, arquivos, agenda do Google ou qualquer outro dado da sua conta Google, e não compartilhamos essas informações com terceiros. O uso dessas informações segue a Política de Dados do Usuário dos Serviços de API do Google, incluindo os requisitos de uso limitado.</p>

      <h2>Para que usamos os dados</h2>
      <ul>
        <li>Criar e manter sua conta e sua agenda online.</li>
        <li>Registrar agendamentos e enviar confirmações, lembretes e avisos de remarcação ou cancelamento.</li>
        <li>Cobrar a assinatura e avisar antes da primeira cobrança.</li>
        <li>Garantir a segurança da plataforma e cumprir obrigações legais.</li>
      </ul>
      <p>Não vendemos dados pessoais e não usamos os dados dos clientes dos estabelecimentos para publicidade própria.</p>

      <h2>Com quem compartilhamos</h2>
      <p>Somente com fornecedores necessários para o serviço funcionar: hospedagem (Vercel), banco de dados (Supabase), envio de e-mails (Resend) e pagamentos (Stripe). Cada estabelecimento vê apenas os dados dos próprios clientes.</p>

      <h2>Por quanto tempo guardamos</h2>
      <p>Enquanto a conta estiver ativa. Após o cancelamento, os dados ficam guardados por até 6 meses para permitir a volta do estabelecimento e depois são excluídos, salvo o que a lei exigir manter.</p>

      <h2>Seus direitos</h2>
      <p>Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, e revogar consentimentos, pelo e-mail <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Clientes de um estabelecimento também podem falar diretamente com ele.</p>

      <h2>Segurança</h2>
      <p>Usamos conexão criptografada (HTTPS), controle de acesso por estabelecimento no banco de dados e credenciais guardadas apenas no servidor.</p>

      <h2>Mudanças</h2>
      <p>Se esta política mudar de forma relevante, avisaremos pelo app ou por e-mail.</p>
    </LegalPage>
  );
}
