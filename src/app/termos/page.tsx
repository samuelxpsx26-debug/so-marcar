import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Termos de uso" };

export default function Termos() {
  return (
    <LegalPage title="Termos de uso">
      <p>Ao criar uma conta ou agendar um horário pelo Só Marcar, você concorda com estes termos.</p>

      <h2>O serviço</h2>
      <p>O Só Marcar oferece uma agenda online para estabelecimentos receberem agendamentos de seus clientes. O atendimento, os preços dos serviços e as regras de cada estabelecimento são de responsabilidade dele.</p>

      <h2>Conta do estabelecimento</h2>
      <ul>
        <li>Você é responsável pelas informações cadastradas e por manter seu acesso seguro.</li>
        <li>Você deve tratar os dados dos seus clientes de acordo com a LGPD e usá-los apenas para o atendimento.</li>
        <li>Não é permitido usar a plataforma para atividades ilegais, spam ou para enganar clientes.</li>
      </ul>

      <h2>Teste grátis, assinatura e cancelamento</h2>
      <ul>
        <li>Todo estabelecimento começa com um período de teste grátis, informado no momento do cadastro.</li>
        <li>Alguns dias antes do fim do teste, enviamos um aviso com a data e o valor da primeira cobrança.</li>
        <li>A assinatura é mensal, sem fidelidade e sem comissão sobre os agendamentos. A cobrança é feita pela Stripe.</li>
        <li>Você pode cancelar a qualquer momento em Ajustes. A agenda continua funcionando até o fim do período já pago ou do teste, sem novas cobranças.</li>
        <li>Se o pagamento falhar, a agenda pública pode ser pausada após alguns dias, até a regularização. Seus dados não são apagados por isso.</li>
      </ul>

      <h2>Clientes que agendam</h2>
      <p>Ao agendar, o cliente informa seus dados ao estabelecimento escolhido e aceita a política de cancelamento dele. Cancelamentos e remarcações podem ser feitos pelo link recebido, dentro do prazo definido pelo estabelecimento.</p>

      <h2>Disponibilidade e limitações</h2>
      <p>Trabalhamos para manter o serviço sempre no ar, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros. O Só Marcar não se responsabiliza pelo atendimento prestado pelos estabelecimentos nem por pagamentos feitos diretamente a eles.</p>

      <h2>Privacidade</h2>
      <p>O tratamento de dados pessoais está descrito na <Link className="underline" href="/privacidade">Política de privacidade</Link>.</p>

      <h2>Mudanças e contato</h2>
      <p>Podemos atualizar estes termos e avisaremos sobre mudanças relevantes. Dúvidas: <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Fica eleito o foro do domicílio do consumidor.</p>
    </LegalPage>
  );
}
