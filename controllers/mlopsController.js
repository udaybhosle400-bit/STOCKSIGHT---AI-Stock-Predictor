const mlopsService = require('../services/mlopsService');

async function getDashboard(req, res, next) {
  try {
    const data = await mlopsService.getDashboardData();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function triggerRetraining(req, res, next) {
  try {
    const result = await mlopsService.triggerRetraining();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function promoteModel(req, res, next) {
  try {
    const { version } = req.body;
    const result = await mlopsService.promoteModel(version);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function rollbackModel(req, res, next) {
  try {
    const { version } = req.body;
    const result = await mlopsService.rollbackModel(version);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getDriftMetrics(req, res, next) {
  try {
    const data = await mlopsService.getDashboardData();
    res.json({ success: true, driftMetrics: data.driftMetrics });
  } catch (err) {
    next(err);
  }
}

async function getMonitoring(req, res, next) {
  try {
    const data = await mlopsService.getDashboardData();
    res.json({
      success: true,
      inferenceMetrics: data.inferenceMetrics,
      health: data.health
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboard,
  triggerRetraining,
  promoteModel,
  rollbackModel,
  getDriftMetrics,
  getMonitoring
};
