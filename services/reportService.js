const PDFDocument = require('pdfkit');
const companyRegistry = require('../config/companyRegistry');
const logger = require('../utils/logger');
const db = require('../config/database');

class ReportService {
  /**
   * Save report metadata record to PostgreSQL database
   */
  async saveReportRecord(userId, symbol, title, type, data) {
    try {
      const res = await db.query(
        `INSERT INTO saved_reports (user_id, symbol, report_title, report_type, report_data)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId || 1, (symbol || 'AAPL').toUpperCase(), title, type, JSON.stringify(data || {})]
      );
      return res.rows[0];
    } catch (e) {
      if (logger && logger.error) logger.error(`Failed to save report record to DB: ${e.message}`);
    }
  }

  /**
   * Retrieve saved reports from PostgreSQL database
   */
  async getSavedReports(userId, limit = 50) {
    try {
      const res = await db.query(
        `SELECT * FROM saved_reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [userId || 1, limit]
      );
      return res.rows;
    } catch (e) {
      return [];
    }
  }

  /**
   * Generate CSV research report string
   */
  generateCSVReport(data) {
    this.saveReportRecord(data.userId || 1, data.symbol || 'AAPL', `CSV Research Report - ${data.symbol || 'AAPL'}`, 'CSV', data);

    const rawSym = data.symbol || 'MARKET';
    const company = companyRegistry.getCompany(rawSym);
    const symbol = company ? `${company.name} (${company.sym})` : rawSym;
    const model = data.modelName || 'QUANT_MODEL';
    const metrics = data.metrics || {};

    let csv = `StockSight Institutional Quantitative Research Report\n`;
    csv += `Date,${new Date().toISOString()}\n`;
    csv += `Company,${symbol}\n`;
    csv += `Sector,${company ? company.sector : 'N/A'}\n`;
    csv += `Model Name,${model}\n`;
    csv += `Date Range,${data.dateRange || '1y'}\n\n`;

    csv += `--- EVALUATION METRICS ---\n`;
    csv += `Metric,Value\n`;
    csv += `RMSE (Root Mean Squared Error),${metrics.rmse || 0}\n`;
    csv += `MAE (Mean Absolute Error),${metrics.mae || 0}\n`;
    csv += `MAPE (Mean Absolute Percentage Error %),${metrics.mape || 0}%\n`;
    csv += `Directional Accuracy %,${metrics.directionalAccuracy || 0}%\n`;
    csv += `Prediction Confidence %,${metrics.confidence || 0}%\n\n`;

    if (data.charts && data.charts.actualVsPredicted) {
      csv += `--- ACTUAL VS PREDICTED PRICE DATA ---\n`;
      csv += `Date,Actual Price,Predicted Price,Residual (Error)\n`;
      data.charts.actualVsPredicted.forEach(row => {
        const residual = (row.actual - row.predicted).toFixed(2);
        csv += `${row.date},${row.actual},${row.predicted},${residual}\n`;
      });
    }

    return csv;
  }

  /**
   * Generate PDF research report stream/buffer using PDFKit
   */
  generatePDFReport(data, res) {
    this.saveReportRecord(data.userId || 1, data.symbol || 'AAPL', `PDF Research Report - ${data.symbol || 'AAPL'}`, 'PDF', data);

    const doc = new PDFDocument({ margin: 50 });
    const filename = `Quant_Research_Report_${data.symbol || 'STOCK'}_${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Title & Header
    doc.fillColor('#0f172a').fontSize(22).text('StockSight Institutional Quant Research', { align: 'center' });
    doc.moveDown(0.3);
    doc.fillColor('#475569').fontSize(12).text(`Quantitative Model Evaluation & Research Report`, { align: 'center' });
    doc.moveDown(1);

    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    // Metadata Table
    doc.fillColor('#1e293b').fontSize(11).text(`Report Date: ${new Date().toLocaleDateString()}`);
    doc.text(`Stock Symbol: ${data.symbol || 'AAPL'}`);
    doc.text(`Evaluated Model: ${data.modelName || 'LSTM'}`);
    doc.text(`Time Horizon: ${data.dateRange || '1y'}`);
    doc.moveDown(1.5);

    // Section 1: Metrics
    doc.fillColor('#0284c7').fontSize(14).text('1. Statistical Evaluation Metrics');
    doc.moveDown(0.5);

    const metrics = data.metrics || {};
    doc.fillColor('#334155').fontSize(11);
    doc.text(`• RMSE (Root Mean Squared Error): ${metrics.rmse || 0}`);
    doc.text(`• MAE (Mean Absolute Error): ${metrics.mae || 0}`);
    doc.text(`• MAPE (Mean Absolute Percentage Error): ${metrics.mape || 0}%`);
    doc.text(`• Directional Accuracy: ${metrics.directionalAccuracy || 0}%`);
    doc.text(`• Prediction Confidence Score: ${metrics.confidence || 0}%`);
    doc.moveDown(1.5);

    // Section 2: Model Architecture
    doc.fillColor('#0284c7').fontSize(14).text('2. Quantitative Methodology');
    doc.moveDown(0.5);
    doc.fillColor('#334155').fontSize(10).text(
      `The evaluated ${data.modelName || 'LSTM'} model captures non-linear price movement dynamics over past trading days. ` +
      `Features evaluated include lagged OHLC prices, Relative Strength Index (RSI), MACD signal crossovers, volume trends, ` +
      `and 20-day volatility.`
    );
    doc.moveDown(1.5);

    // Footer
    doc.fontSize(9).fillColor('#94a3b8').text('Generated automatically by StockSight Bloomberg + Jane Street Quant Engine.', 50, 700, { align: 'center' });

    doc.end();
  }
}

module.exports = new ReportService();
