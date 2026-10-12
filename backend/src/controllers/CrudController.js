const CrudService = require('../services/CrudService');

function makeCrudController(repo, entity) {
  const svc = new CrudService(repo, entity);

  return {
    async list(req, res) {
      try { res.json(await svc.findAll()); }
      catch (e) { res.status(500).json({ error: e.message }); }
    },
    async get(req, res) {
      try {
        const item = await svc.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Não encontrado' });
        res.json(item);
      } catch (e) { res.status(500).json({ error: e.message }); }
    },
    async create(req, res) {
      try { res.status(201).json(await svc.create(req.body)); }
      catch (e) { res.status(500).json({ error: e.message }); }
    },
    async update(req, res) {
      try { res.json(await svc.update(req.params.id, req.body)); }
      catch (e) { res.status(500).json({ error: e.message }); }
    },
    async remove(req, res) {
      try { await svc.remove(req.params.id); res.json({ ok: true }); }
      catch (e) { res.status(500).json({ error: e.message }); }
    },
  };
}

module.exports = makeCrudController;
