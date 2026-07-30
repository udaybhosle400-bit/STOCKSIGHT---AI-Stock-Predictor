const alertModel = require('../models/alertModel');

async function getAlerts(req, res, next) {
  try {
    const alerts = await alertModel.getUserAlerts(req.user.id);
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (err) {
    next(err);
  }
}

async function createAlert(req, res, next) {
  try {
    const { symbol, targetPrice, alertType } = req.body;
    if (!symbol || targetPrice === undefined) {
      return res.status(400).json({
        success: false,
        error: { message: 'Symbol and targetPrice are required.', status: 400 }
      });
    }
    const alert = await alertModel.createAlert(req.user.id, symbol, targetPrice, alertType);
    res.status(201).json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
}

async function deleteAlert(req, res, next) {
  try {
    const { id } = req.params;
    await alertModel.deleteAlert(req.user.id, id);
    res.json({ success: true, message: `Alert ${id} deleted successfully.` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAlerts,
  createAlert,
  deleteAlert
};
