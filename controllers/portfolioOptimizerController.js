const portfolioOptimizerService = require('../services/portfolioOptimizerService');

async function optimizePortfolio(req, res, next) {
  try {
    const { investmentAmount, selectedStocks, riskLevel, investmentHorizon } = req.body;
    const result = await portfolioOptimizerService.optimizePortfolio({
      investmentAmount: parseFloat(investmentAmount || 100000),
      selectedStocks: Array.isArray(selectedStocks) ? selectedStocks : ['AAPL', 'MSFT', 'RELIANCE.NS', 'ICICIBANK', 'INFY.NS'],
      riskLevel: riskLevel || 'Medium',
      investmentHorizon: investmentHorizon || '1Y'
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function runMonteCarlo(req, res, next) {
  try {
    const { selectedStocks, investmentAmount, riskLevel } = req.body;
    const result = await portfolioOptimizerService.optimizePortfolio({
      investmentAmount: parseFloat(investmentAmount || 100000),
      selectedStocks,
      riskLevel
    });

    res.json({
      success: true,
      simulatedPortfolios: result.simulatedPortfolios,
      summary: result.summary
    });
  } catch (err) {
    next(err);
  }
}

async function getRiskAnalytics(req, res, next) {
  try {
    const { selectedStocks, investmentAmount } = req.body;
    const result = await portfolioOptimizerService.optimizePortfolio({
      investmentAmount: parseFloat(investmentAmount || 100000),
      selectedStocks
    });

    res.json({
      success: true,
      summary: result.summary,
      correlationMatrix: result.correlationMatrix,
      assetAllocations: result.assetAllocations,
      sectorAllocations: result.sectorAllocations
    });
  } catch (err) {
    next(err);
  }
}

async function getDiversification(req, res, next) {
  try {
    const { selectedStocks } = req.body;
    const result = await portfolioOptimizerService.optimizePortfolio({ selectedStocks });
    res.json({
      success: true,
      diversificationScore: result.summary.diversificationScore,
      sectorAllocations: result.sectorAllocations
    });
  } catch (err) {
    next(err);
  }
}

async function getAiRecommendations(req, res, next) {
  try {
    const { selectedStocks, investmentAmount } = req.body;
    const result = await portfolioOptimizerService.optimizePortfolio({ investmentAmount, selectedStocks });
    res.json({
      success: true,
      aiRebalancingSuggestions: result.aiRebalancingSuggestions
    });
  } catch (err) {
    next(err);
  }
}

async function runStressTest(req, res, next) {
  try {
    const { selectedStocks, scenario } = req.body;
    const scenarios = {
      '2008_CRASH': { drop: -38.5, recoveryMonths: 18 },
      'COVID_CRASH': { drop: -28.2, recoveryMonths: 5 },
      'INFLATION_SPIKE': { drop: -15.4, recoveryMonths: 8 },
      'TECH_SELLOFF': { drop: -22.1, recoveryMonths: 9 }
    };
    const sc = scenarios[scenario] || scenarios['COVID_CRASH'];
    res.json({
      success: true,
      scenario: scenario || 'COVID_CRASH',
      projectedDrawdownPct: sc.drop,
      estimatedRecoveryMonths: sc.recoveryMonths,
      resilienceScore: Math.round(100 + sc.drop)
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  optimizePortfolio,
  runMonteCarlo,
  getRiskAnalytics,
  getDiversification,
  getAiRecommendations,
  runStressTest
};
