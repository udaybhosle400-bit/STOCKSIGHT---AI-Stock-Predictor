const quantBacktestService = require('./services/quantBacktestService');
const backtestModel = require('./models/backtestModel');
const companyRegistry = require('./config/companyRegistry');

async function runQuantBacktestTest() {
  console.log('========================================================');
  console.log('🚀 TESTING INSTITUTIONAL QUANTITATIVE BACKTESTING ENGINE (PHASE 16)');
  console.log('========================================================\n');

  const allSymbols = companyRegistry.getAllSymbols();
  console.log(`Master Registry Companies: ${allSymbols.length}`);

  console.log(`Executing AI Strategy Backtest across all ${allSymbols.length} companies...`);
  const pipelineResult = await quantBacktestService.runFullBacktestPipeline(allSymbols, 'AI_PREDICTION');

  console.log('\n✅ Backtest Pipeline Execution Complete:');
  console.log(`- Total Duration: ${pipelineResult.durationMs}ms`);
  console.log(`- Processed Companies: ${pipelineResult.processedCompanies}`);
  console.log(`- Failed Companies: ${pipelineResult.failedCompanies}`);
  console.log(`- Strategy Tested: ${pipelineResult.strategyTested}`);

  console.log('\n--------------------------------------------------------');
  console.log('1. TESTING SAMPLE BACKTEST RUN & METRICS (AAPL)');
  console.log('--------------------------------------------------------');
  const aaplRun = await quantBacktestService.runBacktestForCompany('AAPL', 'AI_PREDICTION', 100000);
  console.log('- Symbol:', aaplRun.symbol);
  console.log('- Strategy:', aaplRun.strategyName);
  console.log('- Initial Capital:', `$${aaplRun.initialCapital}`);
  console.log('- Final Equity:', `$${aaplRun.finalEquity}`);
  console.log('- Total Return:', `${aaplRun.totalReturnPct}%`);
  console.log('- CAGR:', `${aaplRun.cagr}%`);
  console.log('- Sharpe Ratio:', aaplRun.sharpeRatio);
  console.log('- Sortino Ratio:', aaplRun.sortinoRatio);
  console.log('- Calmar Ratio:', aaplRun.metrics.calmarRatio);
  console.log('- Treynor Ratio:', aaplRun.metrics.treynorRatio);
  console.log('- Information Ratio:', aaplRun.metrics.informationRatio);
  console.log('- Alpha:', `${aaplRun.metrics.alpha}%`);
  console.log('- Beta:', aaplRun.metrics.beta);
  console.log('- Annualized Volatility:', `${aaplRun.metrics.volatility}%`);
  console.log('- Max Drawdown:', `-${aaplRun.maxDrawdownPct}%`);
  console.log('- Win Rate:', `${aaplRun.winRatePct}%`);
  console.log('- Profit Factor:', aaplRun.metrics.profitFactor);
  console.log('- Expectancy:', `$${aaplRun.metrics.expectancy}`);
  console.log('- Trades Executed Count:', aaplRun.trades.length);

  console.log('\nSample Executed Trade Ledger Entry:');
  if (aaplRun.trades.length > 0) {
    console.log(aaplRun.trades[0]);
  }

  console.log('\n--------------------------------------------------------');
  console.log('2. TESTING BENCHMARK COMPARISON METRICS (AAPL)');
  console.log('--------------------------------------------------------');
  console.log(aaplRun.benchmarkComparison);

  console.log('\n--------------------------------------------------------');
  console.log('3. BACKTEST ENGINE MONITORING STATS');
  console.log('--------------------------------------------------------');
  const stats = await backtestModel.getBacktestStats();
  console.log(JSON.stringify(stats, null, 2));

  console.log('\n========================================================');
  console.log('🎉 QUANTITATIVE BACKTESTING & STRATEGY EVALUATION TEST SUCCESSFUL!');
  console.log('========================================================\n');
}

runQuantBacktestTest().catch(err => {
  console.error('❌ Backtest Test Failed:', err);
  process.exit(1);
});
