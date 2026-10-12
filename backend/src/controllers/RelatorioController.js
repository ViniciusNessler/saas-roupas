const relatorioService = require('../services/RelatorioService');

module.exports = {
  async list(req, res) {
    res.json(relatorioService.listar());
  },
  async run(req, res) {
    try {
      const dados = await relatorioService.executar(req.params.slug);
      res.json({ slug: req.params.slug, dados });
    } catch (e) {
      res.status(e.message.includes('não encontrado') ? 404 : 500).json({ error: e.message });
    }
  },
};
