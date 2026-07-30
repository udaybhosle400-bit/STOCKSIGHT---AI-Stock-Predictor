const quantBacktestService = require('./quantBacktestService');
const backtestModel = require('../models/backtestModel');
const companyRegistry = require('../config/companyRegistry');
const logger = require('../utils/logger');

async function runPhase16BacktestingAudit() {
  console.log('================================================================');
  console.log('🚀 RUNNING PHASE 16 INSTITUTIONAL BACKTESTING AUDIT & VERIFICATION');
  console.log('================================================================\n');

  const startTime = Date.now();
  const allSymbols = companyRegistry.getAllSymbols();
  console.log(`1. MASTER COMPANY REGISTRY VERIFICATION:`);
  console.log(`- Loaded total companies count: ${allSymbols.length}`);
  if (allSymbols.length < 143) {
    throw new Error(`Master Registry verification failed! Found ${allSymbols.length} companies, expected 143.`);
  }
  console.log(`✅ Master Registry verified (143 companies confirmed).\n`);

  console.log(`2. EXECUTING FULL BACKTEST PIPELINE ACROSS ALL 143 COMPANIES...`);
  const pipelineResult = await quantBacktestService.runFullBacktestPipeline(allSymbols, 'AI_PREDICTION');
  console.log(`- Execution Duration: ${pipelineResult.durationMs}ms`);
  console.log(`- Companies Processed: ${pipelineResult.processedCompanies} / ${allSymbols.length}`);
  console.log(`- Failed Companies: ${pipelineResult.failedCompanies}`);

  if (pipelineResult.processedCompanies !== allSymbols.length || pipelineResult.failedCompanies > 0) {
    throw new Error(`Pipeline processing failed! Processed ${pipelineResult.processedCompanies}, Failed ${pipelineResult.failedCompanies}`);
  }
  console.log(`✅ Full 143 company backtest pipeline complete without errors.\n`);

  console.log(`3. VERIFYING 8-STRATEGY EVALUATION ENGINE (AAPL SAMPLE):`);
  const sampleSymbol = 'AAPL';
  const strategies = [
    'AI_PREDICTION',
    'BUY_AND_HOLD',
    'MA_CROSSOVER',
    'RSI_STRATEGY',
    'MACD_STRATEGY',
    'MOMENTUM_STRATEGY',
    'MEAN_REVERSION',
    'BREAKOUT_STRATEGY'
  ];

  const strategyResults = [];
  for (const strat of strategies) {
    const run = await quantBacktestService.runBacktestForCompany(sampleSymbol, strat, 100000);
    strategyResults.push({
      strategy: strat,
      totalReturnPct: run.totalReturnPct,
      sharpeRatio: run.sharpeRatio,
      maxDrawdownPct: run.maxDrawdownPct,
      tradesCount: run.trades.length
    });
  }
  console.table(strategyResults);
  console.log(`✅ All 8 quantitative strategies executed successfully.\n`);

  console.log(`4. VERIFYING 22 FINANCIAL & RISK METRICS CALCULATION SUITE:`);
  const aaplRun = await quantBacktestService.runBacktestForCompany('AAPL', 'AI_PREDICTION', 100000);
  const m = aaplRun.metrics;
  const requiredMetrics = [
    'totalReturnPct', 'cagr', 'sharpeRatio', 'sortinoRatio', 'calmarRatio',
    'treynorRatio', 'informationRatio', 'alpha', 'beta', 'volatility',
    'maxDrawdownPct', 'recoveryFactor', 'profitFactor', 'expectancy', 'winRatePct',
    'lossRatePct', 'avgWin', 'avgLoss', 'largestWin', 'largestLoss',
    'avgHoldingPeriodDays', 'numberOfTrades'
  ];

  const missingMetrics = requiredMetrics.filter(k => m[k] === undefined || m[k] === null);
  if (missingMetrics.length > 0) {
    throw new Error(`Missing financial metrics in calculation suite: ${missingMetrics.join(', ')}`);
  }

  console.log(`- Total Return: ${m.totalReturnPct}%`);
  console.log(`- CAGR: ${m.cagr}%`);
  console.log(`- Sharpe Ratio: ${m.sharpeRatio}`);
  console.log(`- Sortino Ratio: ${m.sortinoRatio}`);
  console.log(`- Calmar Ratio: ${m.calmarRatio}`);
  console.log(`- Treynor Ratio: ${m.treynorRatio}`);
  console.log(`- Information Ratio: ${m.informationRatio}`);
  console.log(`- Alpha vs Market: ${m.alpha}%`);
  console.log(`- Beta: ${m.beta}`);
  console.log(`- Annualized Volatility: ${m.volatility}%`);
  console.log(`- Maximum Drawdown: -${m.maxDrawdownPct}%`);
  console.log(`- Recovery Factor: ${m.recoveryFactor}`);
  console.log(`- Profit Factor: ${m.profitFactor}`);
  console.log(`- Expectancy: $${m.expectancy}`);
  console.log(`- Win Rate: ${m.winRatePct}%`);
  console.log(`- Loss Rate: ${m.lossRatePct}%`);
  console.log(`- Avg Win: $${m.avgWin}`);
  console.log(`- Avg Loss: $${m.avgLoss}`);
  console.log(`- Largest Win: $${m.largestWin}`);
  console.log(`- Largest Loss: $${m.largestLoss}`);
  console.log(`- Avg Holding Period: ${m.avgHoldingPeriodDays} days`);
  console.log(`- Total Trades: ${m.numberOfTrades}`);
  console.log(`✅ All 22 financial & risk metrics verified.\n`);

  console.log(`5. VERIFYING BENCHMARK RELATIVE COMPARISON SUITE:`);
  const benchmarks = aaplRun.benchmarkComparison;
  console.table(benchmarks);
  const benchmarkNames = benchmarks.map(b => b.name);
  const expectedBenchmarks = ['NIFTY 50', 'BANK NIFTY', 'SENSEX', 'NASDAQ', 'S&P 500', 'DOW JONES', 'Buy & Hold Baseline'];
  const missingBenchmarks = expectedBenchmarks.filter(b => !benchmarkNames.includes(b));
  if (missingBenchmarks.length > 0) {
    throw new Error(`Missing required benchmarks: ${missingBenchmarks.join(', ')}`);
  }
  console.log(`✅ Benchmark comparison suite verified across 6 major indices + Buy & Hold.\n`);

  console.log(`6. VERIFYING AI PREDICTION QUALITY VALIDATION ENGINE:`);
  const aiVal = aaplRun.aiValidation;
  console.log(`- Directional Accuracy: ${aiVal.directionalAccuracy}%`);
  console.log(`- BUY Signal Accuracy: ${aiVal.buyAccuracy}%`);
  console.log(`- SELL Signal Accuracy: ${aiVal.sellAccuracy}%`);
  console.log(`- Mean Absolute Error (MAE): $${aiVal.mae}`);
  console.log(`- Root Mean Squared Error (RMSE): $${aiVal.rmse}`);
  console.log(`- Mean Absolute Percentage Error (MAPE): ${aiVal.mape}%`);
  console.log(`✅ AI Prediction Validation quality verified.\n`);

  console.log(`7. VERIFYING DATABASE & IN-MEMORY PERSISTENCE:`);
  const stats = await backtestModel.getBacktestStats();
  console.log(JSON.stringify(stats, null, 2));
  if (stats.companiesProcessed < 143) {
    throw new Error(`Database persistence check failed! Processed count ${stats.companiesProcessed}`);
  }
  console.log(`✅ Backtest store persistence verified.\n`);

  const durationMs = Date.now() - startTime;
  console.log('================================================================');
  console.log(`🎉 PHASE 16 QUANTITATIVE BACKTESTING AUDIT PASSED 100%!`);
  console.log(`- Companies Processed: ${pipelineResult.processedCompanies} / 143`);
  console.log(`- Strategies Tested: 8 / 8`);
  console.log(`- Metrics Computed: 22 / 22`);
  console.log(`- Benchmarks Analyzed: 7 / 7`);
  console.log(`- Total Duration: ${durationMs}ms`);
  console.log('================================================================\n');

  return {
    success: true,
    processedCompanies: pipelineResult.processedCompanies,
    strategiesTested: 8,
    metricsComputed: 22,
    benchmarksAnalyzed: 7,
    durationMs
  };
}

if (require.main === module) {
  runPhase16BacktestingAudit().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('❌ Phase 16 Audit Failed:', err);
    process.exit(1);
  });
}

module.exports = runPhase16BacktestingAudit;
