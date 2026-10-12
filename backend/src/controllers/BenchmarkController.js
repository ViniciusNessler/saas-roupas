const { readLogs } = require('../benchmark/logger');

module.exports = {
  getLogs(req, res) {
    res.json(readLogs());
  },
};
