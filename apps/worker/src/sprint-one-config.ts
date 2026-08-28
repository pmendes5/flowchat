export const SPRINT_ONE_BEHAVIOR = Object.freeze({
  keyword: 'QUERO',
  publicReply: 'Te mandei uma mensagem. Dá uma olhadinha na sua DM.',
  privateReply: 'Oi!\nVi que você comentou QUERO.\nClique abaixo para continuar.',
  button: Object.freeze({ title: 'INICIAR AQUI', payload: 'FLOW_CONTINUE' }),
  continuation: 'Funcionou ✅ O FlowChat recebeu seu clique e continuou a automação.',
});
