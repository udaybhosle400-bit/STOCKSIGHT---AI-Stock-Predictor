const aiPredictionEngineService = require('./services/aiPredictionEngineService');
const aiPredictionModel = require('./models/aiPredictionModel');
const companyRegistry = require('./config/companyRegistry');

async function runAIPredictionTest() {
  console.log('========================================================');
  console.log('🚀 TESTING PROFESSIONAL AI STOCK PREDICTION ENGINE (PHASE 15)');
  console.log('========================================================\n');

  const allSymbols = companyRegistry.getAllSymbols();
  console.log(`Master Registry Companies: ${allSymbols.length}`);

  console.log(`Training ML Models & Generating Ensemble Predictions across all ${allSymbols.length} companies...`);
  const result = await aiPredictionEngineService.trainAndPredictAllCompanies(allSymbols);

  console.log('\n✅ AI Engine Training & Inference Complete:');
  console.log(`- Total Duration: ${result.durationMs}ms`);
  console.log(`- Trained Companies: ${result.trainedCompanies}`);
  console.log(`- Failed Companies: ${result.failedCompanies}`);

  console.log('\n--------------------------------------------------------');
  console.log('1. TESTING ENSEMBLE AI PREDICTION & XAI (AAPL)');
  console.log('--------------------------------------------------------');
  const aaplPred = await aiPredictionModel.getLatestPrediction('AAPL');
  console.log('- Symbol:', aaplPred.symbol);
  console.log('- Current Price:', aaplPred.current_price);
  console.log('- Predicted Price:', aaplPred.predicted_price);
  console.log('- Predicted Return:', `${aaplPred.predicted_return}%`);
  console.log('- Signal:', aaplPred.signal);
  console.log('- Confidence Score:', `${aaplPred.confidence_score}%`);
  console.log('- Expected Volatility:', `${aaplPred.expected_volatility}% (${aaplPred.expected_risk} Risk)`);
  console.log('- Multi-Target Horizon Returns:');
  console.log(`  • 5-Day Return:  +${aaplPred.return_5d}%`);
  console.log(`  • 7-Day Return:  +${aaplPred.return_7d}%`);
  console.log(`  • 30-Day Return: +${aaplPred.return_30d}%`);
  console.log(`  • Prob of Price Increase: ${aaplPred.prob_increase}%`);
  console.log('- Top 3 Feature Attribution Weights:');
  console.log(aaplPred.top_features ? aaplPred.top_features.slice(0, 3) : []);
  console.log('- Explainable AI (XAI) Reasons:');
  console.log(aaplPred.xai_reasons ? aaplPred.xai_reasons : []);

  console.log('\n--------------------------------------------------------');
  console.log('2. TESTING ENSEMBLE AI PREDICTION & XAI (RELIANCE.NS)');
  console.log('--------------------------------------------------------');
  const relPred = await aiPredictionModel.getLatestPrediction('RELIANCE.NS');
  console.log('- Symbol:', relPred.symbol);
  console.log('- Current Price:', relPred.current_price);
  console.log('- Predicted Price:', relPred.predicted_price);
  console.log('- Predicted Return:', `${relPred.predicted_return}%`);
  console.log('- Signal:', relPred.signal);
  console.log('- Confidence Score:', `${relPred.confidence_score}%`);
  console.log('- Explainable AI (XAI) Reasons:');
  console.log(relPred.xai_reasons ? relPred.xai_reasons : []);

  console.log('\n--------------------------------------------------------');
  console.log('3. AI MONITORING DASHBOARD STATS');
  console.log('--------------------------------------------------------');
  const status = await aiPredictionModel.getEngineStatus();
  console.log(JSON.stringify(status, null, 2));

  console.log('\n========================================================');
  console.log('🎉 PROFESSIONAL AI STOCK PREDICTION ENGINE TEST SUCCESSFUL!');
  console.log('========================================================\n');
}

runAIPredictionTest().catch(err => {
  console.error('❌ AI Prediction Engine Test Failed:', err);
  process.exit(1);
});
